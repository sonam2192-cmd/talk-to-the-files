const {parentPort,workerData}=require('node:worker_threads');
const {IndexStore}=require('./index-store.cjs');
const index=new IndexStore(workerData.db); let scanning=false,cancel=false;
parentPort.on('message',async({id,type,...data})=>{
  try {
    if(type==='cancel'){cancel=true;return;}
    if(type==='scan') {
      if(scanning)throw new Error('An indexing job is already running.');
      scanning=true;cancel=false;
      try {const result=await index.scan(data.root,p=>parentPort.postMessage({event:'progress',...p}),()=>cancel);parentPort.postMessage({id,result});}
      finally {scanning=false;}
    } else if(type==='search') parentPort.postMessage({id,result:index.search(data.scope,data.question)});
    else if(type==='remove') {if(scanning)throw new Error('Stop indexing before removing a location.');index.removeRoot(data.root);parentPort.postMessage({id,result:true});}
  }catch(e){parentPort.postMessage({id,error:e.message});}
});
