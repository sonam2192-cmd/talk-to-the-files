import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
const api=window.filesAssistant;
export function App(){
  const [state,setState]=useState({roots:[],follow:true}),[messages,setMessages]=useState([]),[question,setQuestion]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[settings,setSettings]=useState(false);
  const [endpoint,setEndpoint]=useState(''),[mode,setMode]=useState('local'),[token,setToken]=useState(''),[clearToken,setClearToken]=useState(false);
  const bottom=useRef(null);
  useEffect(()=>{api.state().then(setState);return api.onState(setState);},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[messages,busy]);
  async function act(fn){setError('');try{await fn();}catch(e){setError(e.message.replace(/^Error invoking remote method '[^']+': Error: /,''));}}
  async function ask(e){e.preventDefault();if(!question.trim()||busy)return;const q=question.trim();setQuestion('');setBusy(true);setError('');
    setMessages(m=>[...m,{role:'user',text:q,scope:state.scope}]);
    try{const result=await api.ask(q);setMessages(m=>[...m,{role:'assistant',...result}]);}catch(e){setError(e.message);}finally{setBusy(false);}}
  function openSettings(){setEndpoint(state.endpoint||'');setMode(state.mode||'local');setToken('');setClearToken(false);setSettings(true);}
  const idx=state.index;
  return <main>
    <header><div className="logo">✦</div><div><h1>TALK TO THE FILES</h1><p>Your documents, in conversation</p></div><button className="icon" onClick={openSettings} title="Settings" aria-label="Settings">⚙</button></header>
    <section className="scope">
      <div className="scope-top"><span className="eyebrow">SEARCH LOCATION</span><label className="follow"><input type="checkbox" checked={!!state.follow} onChange={e=>act(()=>api.follow(e.target.checked))}/> Follow Explorer</label></div>
      <strong className="scope-path" title={state.scope||''}>{state.scope||'Waiting for Explorer…'}</strong>
      <p>{state.scope?'Including all subfolders':state.scopeMessage||'Open a drive or folder in Windows Explorer.'}</p>
      <div className="actions"><button onClick={()=>act(()=>api.choose())}>Choose location</button><button disabled={!state.scope||state.busy} onClick={()=>act(()=>api.allowScope())}>Enable this location</button></div>
      <small>{state.helper}</small>
    </section>
    <div className="index-bar"><span className={state.busy?'dot amber':'dot'}/><span>{idx?.error?'Index error':state.busy?`Indexing • ${idx?.count||0} files checked`:idx?.finishedAt?`${idx.count} files checked${idx.partial?' • partial scan':''}`:'Enable a location to build its index'}</span><button disabled={!state.scope} onClick={()=>act(()=>state.busy?api.stop():api.scan())}>{state.busy?'Stop':'Refresh'}</button></div>
    {idx && <div className="index-detail">{idx.errors||0} read/extraction errors · {idx.skipped||0} excluded entries{idx.root?` · ${idx.root}`:''}</div>}
    <section className="conversation" aria-live="polite">
      {messages.length===0&&<div className="welcome"><div className="sparkle">✦</div><h2>What would you like to find?</h2><p>Ask about files in the drive or folder shown above.</p><div className="suggestions">{['Find my AWS architecture document','What do the documents say about security?','Summarize the project notes'].map(q=><button key={q} onClick={()=>setQuestion(q)}>{q}<span>↗</span></button>)}</div><p className="hint">{state.mode==='api'?'Answer API enabled. Relevant excerpts will be sent to your configured service.':'Local search is ready to use. Add your answer API in Settings for AI-written answers.'}</p></div>}
      {messages.map((m,i)=><article className={'message '+m.role} key={i}>{m.role==='user'?<><p>{m.text}</p><small>{m.scope}</small></>:<><div className="answer-label">✦ {m.mode==='api'?'Answer':'Local search'}</div><p className="answer">{m.answer}</p><small className="answered-scope">Searched: {m.scope}</small>{m.sources?.map(s=><div className="source" key={s.id}><div className="source-head"><strong>{s.name}</strong><button onClick={()=>act(()=>api.open(s.id))}>Open</button></div><small className="source-path">{s.path}</small></div>)}</>}</article>)}
      {busy&&<div className="thinking">✦ Searching your files…</div>}<div ref={bottom}/>
    </section>
    {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
    <footer><form onSubmit={ask}><textarea aria-label="Question" placeholder="Ask about this location…" value={question} maxLength={2000} rows={2} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(e);}}}/><button className="send" aria-label="Send question" disabled={busy||!state.scope||!question.trim()}>Send</button></form><p>{state.mode==='api'?'AI answers can be incomplete. Open the source files to verify.':'Local mode • keyword search • no documents sent to AI'}</p></footer>
    {settings&&<div className="overlay"><section className="settings" role="dialog" aria-modal="true" aria-label="Settings"><div className="settings-title"><h2>Settings</h2><button onClick={()=>setSettings(false)} aria-label="Close settings">×</button></div><label>Answer mode<select value={mode} onChange={e=>setMode(e.target.value)}><option value="local">Local search (no AI credentials)</option><option value="api">Answer API</option></select></label><label>Question API URL<input value={endpoint} onChange={e=>setEndpoint(e.target.value)}/></label><label>Bearer token<input type="password" autoComplete="off" placeholder={state.hasToken?'Saved securely — leave blank to keep':'API token'} value={token} onChange={e=>setToken(e.target.value)}/></label><label className="check"><input type="checkbox" checked={clearToken} onChange={e=>setClearToken(e.target.checked)}/> Remove saved token</label><p className="hint">Answer API mode sends your question, file paths and up to 10 matching text excerpts to this endpoint. The included API uses Amazon Bedrock. AWS credentials stay on the API server.</p><h3>Enabled locations</h3>{state.roots.length===0?<p>No locations enabled yet.</p>:state.roots.map(r=><div className="root" key={r}><span>{r}</span><button disabled={state.busy} onClick={()=>act(()=>api.remove(r))}>Remove</button></div>)}<p className="hint">Removing a location deletes its index entries. Original files are never deleted.</p>{error&&<div className="error" role="alert">{error}</div>}<button className="primary" onClick={()=>act(async()=>{await api.settings({mode,endpoint,token,clearToken});setSettings(false);})}>Save settings</button></section></div>}
  </main>;
}
if(document.getElementById('root')) createRoot(document.getElementById('root')).render(<App/>);
