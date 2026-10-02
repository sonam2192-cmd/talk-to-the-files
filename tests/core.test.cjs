const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const {inside,terms,chunks,realAllowed}=require('../desktop/core.cjs');
const {IndexStore}=require('../desktop/index-store.cjs');
test('Windows scope boundaries exclude sibling prefixes and other drives',()=>{
  assert(inside('D:\\','D:\\Projects\\a.txt',path.win32));
  assert(inside('D:\\Projects','d:\\projects\\AWS\\a.txt',path.win32));
  assert(!inside('D:\\Projects','D:\\Projects-old\\a.txt',path.win32));
  assert(!inside('D:\\Projects','E:\\Projects\\a.txt',path.win32));
  assert(!inside('D:\\Projects','D:\\Projects\\..\\secret.txt',path.win32));
  assert(inside('\\\\server\\share','\\\\server\\share\\docs\\a.txt',path.win32));
});
test('Query tokens remove natural language filler and escape operators',()=>{
  assert.deepEqual(terms('Find my AWS architecture document'),['aws','architecture']);
  assert.deepEqual(terms('" OR *; DROP TABLE files'),['drop','table']);
  assert.equal(chunks('a'.repeat(3000)).length,3);
});
test('Index recursively searches, isolates scope, refreshes and removes deleted files',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ask-files-test-'));const store=new IndexStore(':memory:');
  try{
    const a=path.join(root,'Projects'),b=path.join(root,'Projects-old');await fs.mkdir(path.join(a,'AWS'),{recursive:true});await fs.mkdir(b);
    const file=path.join(a,'AWS','Architecture.txt');await fs.writeFile(file,'AWS security uses IAM roles and encrypted storage.');await fs.writeFile(path.join(b,'private.txt'),'AWS security outside the selected folder.');
    const result=await store.scan(root);assert.equal(result.count,2);
    const hits=store.search(a,'What does AWS architecture say about security?');assert(hits.length);assert(hits.every(h=>inside(a,h.path)));assert(hits.some(h=>h.excerpt.includes('IAM roles')));
    assert(store.search(root,'security').some(h=>inside(b,h.path)));
    await new Promise(r=>setTimeout(r,10));await fs.writeFile(file,'New content mentions bananas only.');await store.scan(root);
    assert(!store.search(a,'IAM').length);assert(store.search(a,'bananas').length);
    await fs.unlink(file);await store.scan(root);assert.equal(store.search(a,'bananas').length,0);
    store.removeRoot(root);assert.equal(store.search(root,'AWS').length,0);
  }finally{store.close();await fs.rm(root,{recursive:true,force:true});}
});
test('Real-path validation blocks symlink escape and scanning skips links',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ask-links-'));const outside=await fs.mkdtemp(path.join(os.tmpdir(),'ask-outside-'));const store=new IndexStore(':memory:');
  try{
    await fs.writeFile(path.join(outside,'secret.txt'),'secret material');await fs.symlink(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(realAllowed(path.join(root,'linked','secret.txt'),[root]),/outside/);
    await store.scan(root);assert.equal(store.search(root,'secret').length,0);
  }finally{store.close();await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});}
});
test('Cancelled scan preserves previously indexed records',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ask-cancel-'));const store=new IndexStore(':memory:');
  try{await fs.writeFile(path.join(root,'notes.txt'),'security architecture');await store.scan(root);const result=await store.scan(root,()=>{},()=>true);assert(result.partial);assert(store.search(root,'security').length);}
  finally{store.close();await fs.rm(root,{recursive:true,force:true});}
});
test('Document intent excludes Docker and Aadhaar synonyms find nested files',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ask-accuracy-'));const store=new IndexStore(':memory:');
 try{
  await fs.mkdir(path.join(root,'Documents','papa adhar card'),{recursive:true});
  await fs.writeFile(path.join(root,'Dockerfile'),'Docker document container');
  await fs.writeFile(path.join(root,'notes.docx'),'dummy fixture');
  await fs.writeFile(path.join(root,'Documents','papa adhar card','scan.jpg'),'image fixture');
  await fs.writeFile(path.join(root,'Documents','papa adhar card.pdf'),'pdf fixture');
  await fs.writeFile(path.join(root,'Documents','mummy aadhar card.jpg'),'image fixture');
  await store.scan(root,()=>{},()=>false,async()=>[]);
  const doc=store.search(root,'doc');assert.equal(doc.length,1);assert.equal(doc[0].name,'notes.docx');
  assert.equal(store.search(root,'find my Word documents').length,1);
  const hits=store.search(root,"find my father's aadhar card");
  assert(hits.some(h=>h.name==='papa adhar card.pdf'));assert(hits.some(h=>h.name==='scan.jpg'));
  assert(hits.every(h=>!h.name.includes('mummy')));assert(hits.every(h=>h.matchType==='all search concepts'));
  const partial=store.search(root,'papa passport');assert(partial.length);assert(partial.every(h=>h.matchType==='partial keyword match'));
 }finally{store.close();await fs.rm(root,{recursive:true,force:true});}
});
test('Existing indexes gain parent-folder search without reindexing files',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ask-migrate-'));const db=path.join(root,'index.db');
 let store=new IndexStore(db);
 try{
  const file=path.join(root,'papa adhar card','scan.jpg');
  store.db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?)').run(file,1,1,'metadata only',root,'old');
  store.db.prepare('INSERT INTO passages VALUES(?,?,?,?,?)').run('old-id',file,'File name','scan.jpg','Name: scan.jpg');
  store.db.exec('PRAGMA user_version=0');store.close();store=new IndexStore(db);
  assert.equal(store.search(root,"father's aadhaar card")[0].path,file);
 }finally{store.close();await fs.rm(root,{recursive:true,force:true});}
});
