const {app,BrowserWindow,ipcMain,dialog,shell,safeStorage,screen}=require('electron');
const {Worker}=require('node:worker_threads');
const {spawn}=require('node:child_process');
const {createInterface}=require('node:readline');
const fs=require('node:fs/promises');
const path=require('node:path');
const {inside,realAllowed,safeOpenExtensions}=require('./core.cjs');
let win,worker,helper,configPath,config={roots:[],endpoint:'http://127.0.0.1:5199/api/file-assistant/ask',mode:'local',encryptedToken:'',follow:true};
let state={scope:null,scopeMessage:'Open a drive or folder in Explorer.',helper:'Starting…',index:null,busy:false,roots:[],follow:true};
let seq=0; const pending=new Map(),sources=new Map(); let scanning=false,asking=false; let helperSeen=Date.now(); const watchers=new Map();let scanTimer;
function publicState(){return {...state,roots:config.roots,follow:config.follow,mode:config.mode,endpoint:config.endpoint,hasToken:!!config.encryptedToken};}
function emit(){if(win&&!win.isDestroyed())win.webContents.send('state-changed',publicState());}
async function save(){await fs.writeFile(configPath,JSON.stringify(config,null,2));emit();}
function rpc(type,data={}){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,type,...data});});}
function scopeAllowed(){return state.scope && config.roots.some(r=>inside(r,state.scope));}
async function scanRoot(root){
  if(scanning)throw new Error('Indexing is already running.');scanning=true;state.busy=true;emit();
  try {await realAllowed(root,config.roots,true);state.index=await rpc('scan',{root});}
  finally{scanning=false;state.busy=false;emit();}
}
function watchRoot(root){
  if(watchers.has(root))return;
  try{const watcher=require('node:fs').watch(root,{recursive:true},()=>{
    clearTimeout(scanTimer);scanTimer=setTimeout(()=>{if(!scanning)scanRoot(root).catch(()=>{});},3000);
  });watcher.on('error',()=>{watcher.close();watchers.delete(root);});watchers.set(root,watcher);}catch{}
}
async function addRoot(root){
  root=await fs.realpath(root);
  if(!config.roots.some(r=>inside(r,root))){config.roots.push(root);await save();watchRoot(root);}
  if(!scanning)scanRoot(config.roots.find(r=>inside(r,root))).catch(e=>{state.index={error:e.message};emit();});
}
function startHelper(){
  if(process.platform!=='win32'){state.helper='Explorer tracking needs Windows. Use Choose location for local testing.';emit();return;}
  const exe=app.isPackaged?path.join(process.resourcesPath,'helper','ExplorerBridge.exe'):path.join(__dirname,'../helper/publish/ExplorerBridge.exe');
  helper=spawn(exe,[],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  helper.on('error',()=>{state.helper='Explorer helper unavailable. Run npm run helper, then restart.';emit();});
  helper.on('exit',()=>{state.helper='Explorer tracking stopped. Restart the app to reconnect.';if(config.follow)state.scope=null;emit();});
  helper.stderr.on('data',()=>{});
  createInterface({input:helper.stdout}).on('line',line=>{
    try{const event=JSON.parse(line);helperSeen=Date.now();if(event.heartbeat)return;state.helper=event.message||'Explorer tracking connected';
      if(config.follow){state.scope=event.path||null;state.scopeMessage=event.message||'Current Explorer location';}emit();
    }catch{}
  });
}
setInterval(()=>{if(helper && config.follow && Date.now()-helperSeen>6000){state.scope=null;state.helper='Explorer tracking is not responding. Restart the app or choose a location.';emit();}},2000).unref();
function installIpc(){
  const handle=(channel,fn)=>ipcMain.handle(channel,async(event,...args)=>{
    if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)throw new Error('Untrusted request');
    return fn(...args);
  });
  handle('state',()=>publicState());
  handle('choose',async()=>{const result=await dialog.showOpenDialog(win,{title:'Enable a drive or folder (including subfolders)',properties:['openDirectory']});if(result.canceled)return;
    state.scope=await fs.realpath(result.filePaths[0]);config.follow=false;state.scopeMessage='Pinned location';await addRoot(state.scope);await save();return publicState();});
  handle('follow',async enabled=>{config.follow=!!enabled;state.scope=null;state.scopeMessage=enabled?'Switch to Explorer to detect its location.':'Choose a location to pin.';await save();});
  handle('allow-scope',async()=>{if(!state.scope)throw new Error('No filesystem location detected.');await addRoot(state.scope);});
  handle('scan',async()=>{if(!scopeAllowed())throw new Error('Enable this location first.');await scanRoot(config.roots.find(r=>inside(r,state.scope)));});
  handle('stop',()=>worker.postMessage({type:'cancel'}));
  handle('remove',async root=>{if(!config.roots.includes(root))throw new Error('Unknown root');await rpc('remove',{root});config.roots=config.roots.filter(r=>r!==root);watchers.get(root)?.close();watchers.delete(root);sources.clear();await save();});
  handle('settings',async value=>{
    if(!value || !['local','api'].includes(value.mode))throw new Error('Invalid mode');
    const url=new URL(value.endpoint);
    if(url.username || url.password || url.hash || !(url.protocol==='https:' || url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS, or HTTP only for localhost.');
    config.mode=value.mode;config.endpoint=url.toString();
    if(value.token){if(!safeStorage.isEncryptionAvailable())throw new Error('Secure credential storage is unavailable.');config.encryptedToken=safeStorage.encryptString(value.token).toString('base64');}
    if(value.clearToken)config.encryptedToken='';await save();return publicState();
  });
  handle('ask',async question=>{
    if(asking)throw new Error('Wait for the current answer.');
    if(typeof question!=='string'||!question.trim()||question.length>2000)throw new Error('Enter a question of 1–2000 characters.');
    if(!scopeAllowed())throw new Error('Enable the current drive or folder first.');
    const {real:scope}=await realAllowed(state.scope,config.roots,true);asking=true;
    try {
      const candidates=await rpc('search',{scope,question});const selected=[];const perFile=new Map();
      for(const c of candidates){
        try{const {real,stat}=await realAllowed(c.path,config.roots);
          if(!inside(scope,real)||stat.mtimeMs!==c.mtime||stat.size!==c.size)continue;
          if((perFile.get(real)||0)>=3)continue;perFile.set(real,(perFile.get(real)||0)+1);
          selected.push(c);sources.set(c.id,{...c,scope});if(sources.size>1000)sources.delete(sources.keys().next().value);if(selected.length===10)break;
        }catch{}
      }
      if(!selected.length)return {scope,mode:'local',answer:'No matching indexed content was found in this location. Check indexing status, refresh the index, or try a file name or more specific keywords.',sources:[]};
      if(config.mode==='local')return {scope,mode:'local',answer:'Here are files that may match your question.',sources:selected};
      const token=config.encryptedToken?safeStorage.decryptString(Buffer.from(config.encryptedToken,'base64')):'';
      const response=await fetch(config.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({question,scopePath:scope,includeSubfolders:true,sources:selected.map(({id,path,location,excerpt,matchType})=>({id,path,location,excerpt:matchType==='partial keyword match'?'PARTIAL MATCH: not all search concepts matched.\n'+excerpt:excerpt}))})});
      if(!response.ok)throw new Error(`Answer API returned HTTP ${response.status}. Check API configuration and credentials.`);
      const result=await response.json();if(typeof result.answer!=='string')throw new Error('Answer API must return an answer string.');
      return {scope,mode:'api',answer:result.answer.slice(0,30000),sources:selected};
    }finally{asking=false;}
  });
  handle('open',async id=>{
    const source=sources.get(id);if(!source)throw new Error('Unknown result. Ask again to refresh.');
    const {real,stat}=await realAllowed(source.path,config.roots);
    if(!inside(source.scope,real)||stat.mtimeMs!==source.mtime)throw new Error('File changed. Refresh and ask again.');
    if(!safeOpenExtensions.has(path.extname(real).toLowerCase())) {shell.showItemInFolder(real);return;}
    const error=await shell.openPath(real);if(error)throw new Error(error);
  });
}
app.whenReady().then(async()=>{
  configPath=path.join(app.getPath('userData'),'settings.json');
  try{config={...config,...JSON.parse(await fs.readFile(configPath,'utf8'))};}catch{}
  worker=new Worker(path.join(__dirname,'index-worker.cjs'),{workerData:{db:path.join(app.getPath('userData'),'index.db')}});
  worker.on('message',message=>{if(message.event==='progress'){state.index=message;emit();return;}const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(new Error(message.error)):p.resolve(message.result);}});
  worker.on('error',error=>{for(const p of pending.values())p.reject(error);pending.clear();state.index={error:error.message};emit();});
  const area=screen.getPrimaryDisplay().workArea;
  win=new BrowserWindow({width:490,height:Math.min(850,area.height),minWidth:420,minHeight:550,x:area.x+area.width-500,y:area.y+10,autoHideMenuBar:true,title:'TALK TO THE FILES',backgroundColor:'#f6f8ff',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_,__,callback)=>callback(false));
  installIpc();await win.loadFile(path.join(__dirname,'../dist/index.html'));startHelper();config.roots.forEach(watchRoot);
  // Periodic reconciliation catches missed filesystem notifications and offline edits.
  setInterval(async()=>{for(const root of config.roots){if(!scanning)await scanRoot(root).catch(()=>{});}},300000).unref();
  for(const root of config.roots)await scanRoot(root).catch(()=>{});
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{helper?.kill();worker?.terminate();watchers.forEach(w=>w.close());});
