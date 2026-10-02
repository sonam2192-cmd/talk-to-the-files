const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs/promises');
const path = require('node:path');
const {inside,chunks,idFor} = require('./core.cjs');
const {parseQuery} = require('./query.cjs');
const {extract} = require('./extract.cjs');
const SKIP = new Set(['node_modules','.git','.svn','windows','program files','program files (x86)','programdata','appdata','$recycle.bin','system volume information']);
class IndexStore {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY,mtime REAL,size INTEGER,status TEXT,root TEXT,seen TEXT);
      CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(id UNINDEXED,path UNINDEXED,location UNINDEXED,name,body,tokenize='unicode61');`);
    // Add parent paths to existing name entries without reparsing original files.
    if(this.db.prepare('PRAGMA user_version').get().user_version<1){
      this.db.exec("BEGIN; UPDATE passages SET body=body || char(10) || 'Path: ' || path WHERE location='File name'; PRAGMA user_version=1; COMMIT;");
    }
  }
  close(){ this.db.close(); }
  async scan(root, progress=()=>{}, cancelled=()=>false, extractor=extract) {
    const scanId=String(Date.now()); let count=0, errors=0, skipped=0, parsed=0, partial=false;
    const walk=async dir=>{
      let entries;
      try { entries=await fs.readdir(dir,{withFileTypes:true}); } catch {errors++; return;}
      for(const e of entries) {
        if(cancelled() || count>=100000) {partial=true; return;}
        if(e.isSymbolicLink() || e.name.startsWith('.') || SKIP.has(e.name.toLowerCase())) {skipped++;continue;}
        const file=path.join(dir,e.name);
        if(e.isDirectory()) {await walk(file); continue;}
        if(!e.isFile()) continue;
        count++;
        try {
          const real=await fs.realpath(file); if(!inside(root,real)) {skipped++;continue;}
          const stat=await fs.stat(real); const old=this.db.prepare('SELECT * FROM files WHERE path=?').get(real);
          if(old && old.mtime===stat.mtimeMs && old.size===stat.size) {
            this.db.prepare('UPDATE files SET root=?,seen=? WHERE path=?').run(root,scanId,real);
          } else {
            let sections=[],status='metadata only';
            if(stat.size<=20*1024*1024) {
              try { sections=await extractor(real); status=sections.some(s=>s.text.trim())?'text indexed':'metadata only'; }
              catch { status='text extraction failed'; errors++; }
            } else status='over 20 MB; metadata only';
            let budget=80000;
            sections=sections.map(s=>{const text=s.text.slice(0,Math.max(0,budget));budget-=text.length;return {...s,text};}).filter(s=>s.text.trim());
            this.db.exec('BEGIN');
            try {
              this.db.prepare('DELETE FROM passages WHERE path=?').run(real);
              const insert=this.db.prepare('INSERT INTO passages(id,path,location,name,body) VALUES(?,?,?,?,?)');
              insert.run(idFor(real,'metadata',0),real,'File name',e.name,`Name: ${e.name}\nPath: ${real}\nModified: ${new Date(stat.mtimeMs).toISOString()}\n${status}`);
              for(const s of sections) chunks(s.text).forEach((text,i)=>insert.run(idFor(real,s.location,i),real,s.location,e.name,text));
              this.db.prepare('INSERT OR REPLACE INTO files VALUES(?,?,?,?,?,?)').run(real,stat.mtimeMs,stat.size,status,root,scanId);
              this.db.exec('COMMIT'); parsed++;
            } catch(error){this.db.exec('ROLLBACK');throw error;}
          }
        }catch{errors++;}
        if(count%20===0) {progress({count,errors,skipped,parsed,root});await new Promise(resolve=>setImmediate(resolve));}
      }
    };
    await walk(root);
    // Never prune after cancellation or traversal errors. Queries revalidate source paths.
    if(!partial && !errors) {
      this.db.exec('BEGIN');
      this.db.prepare('DELETE FROM passages WHERE path IN (SELECT path FROM files WHERE root=? AND seen<>?)').run(root,scanId);
      this.db.prepare('DELETE FROM files WHERE root=? AND seen<>?').run(root,scanId);
      this.db.exec('COMMIT');
    }
    const result={count,errors,skipped,parsed,partial,root,finishedAt:new Date().toISOString()}; progress(result);return result;
  }
  search(scope,question) {
    const query=parseQuery(question); const normalized=path.resolve(scope); const prefix=normalized.endsWith(path.sep)?normalized:normalized+path.sep;
    let filter='(lower(p.path)=lower(?) OR lower(substr(p.path,1,?))=lower(?))';
    const args=[normalized,prefix.length,prefix];
    if(query.extensions.length){
      filter+=' AND ('+query.extensions.map(()=>"lower(p.path) LIKE ?").join(' OR ')+')';
      args.push(...query.extensions.map(ext=>'%'+ext));
    }
    const cols='p.id,p.path,p.location,p.name,p.body AS excerpt,f.mtime,f.size';
    if(!query.groups.length){
      const kind=query.extensions.length?"p.location='File name'":"p.location<>'File name'";
      return this.db.prepare(`SELECT ${cols} FROM passages p JOIN files f ON p.path=f.path WHERE ${filter} AND ${kind} ORDER BY f.mtime DESC LIMIT 32`).all(...args);
    }
    const fetch=match=>this.db.prepare(`SELECT ${cols},bm25(passages,0,0,0,5,1) AS rank FROM passages p JOIN files f ON p.path=f.path WHERE passages MATCH ? AND ${filter} ORDER BY rank LIMIT 100`).all(match,...args);
    const strict=fetch(query.strict);
    if(strict.length)return strict.map(row=>({...row,matchType:'all search concepts'}));
    // Explicit partial matches help content questions; do not silently present them as exact hits.
    return fetch(query.broad).map(row=>{
      const tokens=new Set((row.name+' '+row.excerpt).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
      return {...row,matchType:'partial keyword match',coverage:query.groups.filter(g=>g.some(w=>tokens.has(w))).length};
    }).sort((a,b)=>b.coverage-a.coverage || a.rank-b.rank).slice(0,32);
  }
  removeRoot(root) {
    this.db.exec('BEGIN');this.db.prepare('DELETE FROM passages WHERE path IN (SELECT path FROM files WHERE root=?)').run(root);
    this.db.prepare('DELETE FROM files WHERE root=?').run(root);this.db.exec('COMMIT');
  }
}
module.exports={IndexStore};
