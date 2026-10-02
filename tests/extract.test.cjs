const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {extract}=require('../desktop/extract.cjs');
const dir=path.join(__dirname,'../sample-docs/Projects/AWS');
for(const [file,expected,location] of [['Onboarding.docx','temporary IAM role','Document text'],['Security.pptx','Encrypt backups','Slide 1'],['Budget.xlsx','25000','Sheet 1'],['Architecture.pdf','temporary IAM roles','Page 1']]) {
 test(`Extract ${file} with source location`,async()=>{const sections=await extract(path.join(dir,file));assert(sections.some(s=>s.text.includes(expected)));assert(sections.some(s=>s.location===location));});
}
