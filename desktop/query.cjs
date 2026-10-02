const {terms}=require('./core.cjs');
// Small, explicit vocabulary. These improve retrieval; they do not identify people.
const SYNONYMS=[
 ['father','fathers','papa','dad','daddy','pitaji'],
 ['mother','mothers','mummy','mom','mum','maa','mataji'],
 ['aadhaar','aadhar','adhar','adhaar','uidai'],
 ['resume','cv'],['photo','photos','picture','pictures','image','images']
];
const TYPES=[
 {words:['doc','docs','docx','word'],extensions:['.doc','.docx']},
 {words:['pdf','pdfs'],extensions:['.pdf']},
 {words:['ppt','pptx','powerpoint','presentation','presentations'],extensions:['.ppt','.pptx']},
 {words:['xls','xlsx','excel','spreadsheet','spreadsheets'],extensions:['.xls','.xlsx','.csv']}
];
const FILLER=new Set('get locate search searching looking look want need can could would you your have has had named called containing contains related retrieve fetch'.split(' '));
function parseQuery(question){
 const words=terms(question.replace(/['’]s\b/gi,''));
 const types=TYPES.filter(t=>words.some(w=>t.words.includes(w)));
 const extensions=[...new Set(types.flatMap(t=>t.extensions))];
 const remaining=words.filter(w=>!FILLER.has(w)&&!types.some(t=>t.words.includes(w)));
 const groups=[];
 for(const word of remaining){const variants=SYNONYMS.find(s=>s.includes(word))||[word];if(!groups.some(g=>g[0]===variants[0]))groups.push(variants);}
 const clause=g=>'('+g.map(w=>'"'+w.replace(/"/g,'')+'"').join(' OR ')+')';
 return {groups,extensions,strict:groups.map(clause).join(' AND '),broad:groups.map(clause).join(' OR ')};
}
module.exports={parseQuery};
