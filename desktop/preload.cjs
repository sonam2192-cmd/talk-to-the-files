const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('filesAssistant',Object.freeze({
  state:()=>ipcRenderer.invoke('state'), choose:()=>ipcRenderer.invoke('choose'),
  follow:enabled=>ipcRenderer.invoke('follow',enabled), allowScope:()=>ipcRenderer.invoke('allow-scope'),
  scan:()=>ipcRenderer.invoke('scan'), stop:()=>ipcRenderer.invoke('stop'),
  remove:root=>ipcRenderer.invoke('remove',root),
  ask:question=>ipcRenderer.invoke('ask',question), open:id=>ipcRenderer.invoke('open',id),
  settings:settings=>ipcRenderer.invoke('settings',settings),
  onState:fn=>{const listener=(_,state)=>fn(state);ipcRenderer.on('state-changed',listener);return ()=>ipcRenderer.removeListener('state-changed',listener);}
}));
