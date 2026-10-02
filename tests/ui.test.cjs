const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
const {JSDOM}=require('jsdom');const {transformSync}=require('esbuild');
test('React UI submits a question, renders sources, changes scope and saves settings',async()=>{
 const dom=new JSDOM('<div id="test-root"></div>',{url:'http://localhost'});
 global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;global.IS_REACT_ACT_ENVIRONMENT=true;
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 let subscriber,asked,opened,saved;
 let state={scope:'D:\\',roots:['D:\\'],follow:true,mode:'local',endpoint:'http://127.0.0.1:5199/api/file-assistant/ask',helper:'Following Explorer'};
 window.filesAssistant={state:async()=>state,onState:fn=>{subscriber=fn;return()=>{};},ask:async q=>{asked=q;return {scope:'D:\\',mode:'local',answer:'Matching excerpt',sources:[{id:'source-1',name:'Architecture.pdf',path:'D:\\Architecture.pdf',location:'Page 1',excerpt:'IAM roles'}]};},open:async id=>{opened=id;},settings:async s=>{saved=s;},follow:async()=>{},choose:async()=>{},allowScope:async()=>{},scan:async()=>{},stop:async()=>{},remove:async()=>{}};
 const source=fs.readFileSync(path.join(__dirname,'../src/main.jsx'),'utf8').replace("import './style.css';",'');
 const compiled=transformSync(source,{loader:'jsx',format:'cjs'}).code;
 const filename=path.join(__dirname,'../src/ui-test-module.cjs');const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(compiled,filename);
 const React=require('react');const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('test-root'));
 const click=async element=>React.act(async()=>{element.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));});
 try {
  await React.act(async()=>{root.render(React.createElement(mod.exports.App));});
  assert(document.body.textContent.includes('D:\\'));
  await click([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Find my AWS')));
  await React.act(async()=>{document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  assert.equal(asked,'Find my AWS architecture document');assert(document.body.textContent.includes('Matching excerpt'));assert(document.body.textContent.includes('Architecture.pdf'));
  await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Open'));assert.equal(opened,'source-1');
  await React.act(async()=>{subscriber({...state,scope:'D:\\Projects'});});assert.equal(document.querySelector('.scope-path').textContent,'D:\\Projects');
  await click(document.querySelector('[aria-label="Settings"]'));assert(document.querySelector('[role="dialog"]'));
  await click([...document.querySelectorAll('button')].find(b=>b.textContent==='Save settings'));assert.equal(saved.mode,'local');assert(!document.querySelector('[role="dialog"]'));
 }finally {await React.act(async()=>root.unmount());dom.window.close();delete global.window;delete global.document;delete global.HTMLElement;delete global.IS_REACT_ACT_ENVIRONMENT;}
});
