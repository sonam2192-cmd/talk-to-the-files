const fs = require('node:fs/promises');
const path = require('node:path');
const TEXT = new Set('.txt .md .csv .tsv .json .log .cs .js .ts .tsx .jsx .py .yaml .yml .xml .html .css .sql'.split(' '));
const MAX_CHARS = 80000;
async function extract(file) {
  const ext = path.extname(file).toLowerCase();
  if (TEXT.has(ext)) return [{ location: 'Text', text: (await fs.readFile(file, 'utf8')).slice(0,MAX_CHARS) }];
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    return [{ location: 'Document text', text: (await mammoth.extractRawText({ path: file })).value.slice(0,MAX_CHARS) }];
  }
  if (ext === '.pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(file)), useSystemFonts: true, isEvalSupported: false });
    const doc = await loading.promise; const result = []; let total = 0;
    try {
      for(let p=1; p<=Math.min(doc.numPages,200) && total<MAX_CHARS; p++) {
        const page=await doc.getPage(p); const content=await page.getTextContent();
        const text=content.items.map(i=>i.str || '').join(' ').slice(0,MAX_CHARS-total);
        result.push({location:`Page ${p}`,text}); total+=text.length; page.cleanup();
      }
    } finally { await loading.destroy(); }
    return result;
  }
  if (ext === '.pptx' || ext === '.xlsx') {
    const Zip = require('adm-zip'); const {XMLParser}=require('fast-xml-parser');
    const zip=new Zip(file); const parser=new XMLParser({ignoreAttributes:true, processEntities:false});
    const entries=zip.getEntries();
    // Bound expanded archives before reading their text entries.
    if(entries.reduce((n,e)=>n+e.header.size,0)>100*1024*1024) throw new Error('Expanded Office document exceeds 100 MB');
    const collect = value => typeof value==='string' || typeof value==='number' ? String(value) : Array.isArray(value) ? value.map(collect).join(' ') : value && typeof value==='object' ? Object.values(value).map(collect).join(' ') : '';
    if(ext==='.pptx') return entries.filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.entryName)).sort((a,b)=>a.entryName.localeCompare(b.entryName,undefined,{numeric:true})).slice(0,200).map(e=>({location:`Slide ${e.entryName.match(/slide(\d+)\.xml/)[1]}`,text:collect(parser.parse(e.getData().toString('utf8'))).slice(0,4000)}));
    // Preserve shared-string references, cell addresses and sheet numbers.
    const sharedEntry=zip.getEntry('xl/sharedStrings.xml');
    const shared=sharedEntry ? parser.parse(sharedEntry.getData().toString('utf8')).sst?.si : [];
    const values=(Array.isArray(shared)?shared:shared?[shared]:[]).map(collect);
    const cellParser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',processEntities:false});
    return entries.filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/.test(e.entryName)).slice(0,100).map(e=>{
      const sheet=cellParser.parse(e.getData().toString('utf8')); const rows=sheet.worksheet?.sheetData?.row || [];
      const text=(Array.isArray(rows)?rows:[rows]).map(row=>{
        const cells=row.c || []; return (Array.isArray(cells)?cells:[cells]).map(c=>`${c['@_r'] || ''}: ${c['@_t']==='s' ? values[Number(c.v)] || '' : c['@_t']==='inlineStr' ? collect(c.is) : c.v ?? ''}`).join(' | ');
      }).join('\n');
      return {location:`Sheet ${e.entryName.match(/sheet(\d+)/)[1]}`,text:text.slice(0,MAX_CHARS)};
    });
  }
  return [];
}
module.exports={extract,MAX_CHARS};
