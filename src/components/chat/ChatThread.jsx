import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch } from '../../api.js';
import { IC } from '../../icons.jsx';
import { formatDateDisplay } from '../../utils.js';

const EMOJI_LIST = ['❤️','😊','👍','🙏','✨','🎉','😄','👏','🌸','💫'];

function ChatThread({lead,currentRole,currentName,onBack}) {
  const [messages,setMessages]=useState([]);
  const [msgText,setMsgText]=useState('');
  const [sending,setSending]=useState(false);
  const [loadingMsgs,setLoadingMsgs]=useState(true);
  const [isTyping,setIsTyping]=useState(false);
  const [otherTyping,setOtherTyping]=useState(false);
  const [showEmoji,setShowEmoji]=useState(false);
  const [leadStatus,setLeadStatus]=useState(lead.status||'new');
  const [readUpTo,setReadUpTo]=useState(null); // last message id the other party has seen
  const fileRef=useRef();
  const bottomRef=useRef();
  const textareaRef=useRef();
  const typingTimeout=useRef(null);
  const lastCountRef=useRef(0);
  const intervalRef=useRef(null);

  useEffect(()=>{
    loadMessages();
    intervalRef.current=setInterval(loadMessages,4000);
    return()=>{clearInterval(intervalRef.current);};
  },[lead.id]);

  // Smooth scroll to bottom on new messages
  useEffect(()=>{
    if(messages.length!==lastCountRef.current){
      lastCountRef.current=messages.length;
      bottomRef.current?.scrollIntoView({behavior:'smooth'});
    }
  },[messages]);

  // Mark messages as read when opening chat — store in app_settings
  useEffect(()=>{
    if(messages.length>0){
      const lastId=messages[messages.length-1].id;
      const key=`read_${lead.id}_${currentRole==='vendor'?'vendor':'customer'}`;
      supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:lastId,updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
      // Fetch what the other party has read
      const otherKey=`read_${lead.id}_${currentRole==='vendor'?'customer':'vendor'}`;
      supaFetch(`app_settings?key=eq.${otherKey}&select=value`).then(d=>{
        if(d&&d[0])setReadUpTo(d[0].value);
      }).catch(()=>{});
    }
  },[messages]);

  // Typing indicator — store in app_settings with TTL logic
  function handleTyping(){
    if(!isTyping){
      setIsTyping(true);
      const key=`typing_${lead.id}_${currentRole}`;
      supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:'1',updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current=setTimeout(()=>{
      setIsTyping(false);
      const key=`typing_${lead.id}_${currentRole}`;
      supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:'0',updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
    },2500);
  }

  async function loadMessages(){
    try{
      const data=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.asc&select=*`);
      setMessages(data||[]);
      // Check if other party is typing
      const otherRole=currentRole==='vendor'?'customer':'vendor';
      const typingKey=`typing_${lead.id}_${otherRole}`;
      const tData=await supaFetch(`app_settings?key=eq.${typingKey}&select=value,updated_at`);
      if(tData&&tData[0]&&tData[0].value==='1'){
        const ago=(Date.now()-new Date(tData[0].updated_at).getTime())/1000;
        setOtherTyping(ago<4); // hide if stale
      } else {setOtherTyping(false);}
    }catch(e){}
    setLoadingMsgs(false);
  }

  async function sendMessage(e){
    e.preventDefault();
    if(!msgText.trim())return;
    setSending(true);
    // Optimistic UI — show message immediately
    const optimistic={id:'sending_'+Date.now(),lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:msgText,created_at:new Date().toISOString(),_sending:true};
    setMessages(prev=>[...prev,optimistic]);
    setMsgText('');
    setShowEmoji(false);
    // Clear typing indicator
    clearTimeout(typingTimeout.current);
    setIsTyping(false);
    const key=`typing_${lead.id}_${currentRole}`;
    supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:'0',updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
    try{
      await supaFetch('messages',{method:'POST',body:JSON.stringify({lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:optimistic.message_text}),prefer:'return=minimal'});
      loadMessages();
    }catch(err){
      setMessages(prev=>prev.filter(m=>m.id!==optimistic.id));
      alert('Send failed: '+err.message);
    }
    setSending(false);
  }

  async function uploadAndSend(file){
    const path=`messages/${lead.id}/${Date.now()}_${file.name}`;
    const res=await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-images/${path}`,{method:'POST',headers:{'apikey':SUPABASE_PUB_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':file.type},body:file});
    if(res.ok){
      const url=storageUrl(path);
      await supaFetch('messages',{method:'POST',body:JSON.stringify({lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:'',file_url:url}),prefer:'return=minimal'});
      loadMessages();
    }
  }

  function appendEmoji(em){
    setMsgText(prev=>prev+em);
    textareaRef.current?.focus();
  }

  async function updateStatus(newStatus){
    setLeadStatus(newStatus);
    await supaFetch(`leads?id=eq.${lead.id}`,{method:'PATCH',body:JSON.stringify({status:newStatus}),prefer:'return=minimal'});
  }

  // Group messages by date
  function formatMsgDate(ts){
    if(!ts)return'';
    const d=new Date(ts),now=new Date();
    if(d.toDateString()===now.toDateString())return'Today';
    const yest=new Date(now);yest.setDate(now.getDate()-1);
    if(d.toDateString()===yest.toDateString())return'Yesterday';
    return d.toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'});
  }

  const STATUS_META={
    new:{label:'New',bg:'rgba(201,169,110,0.15)',color:'#9a7a3a',dot:'#c9a96e'},
    responded:{label:'Responded',bg:'rgba(58,122,90,0.12)',color:'#2a6a4a',dot:'#3a7a5a'},
    closed:{label:'Closed',bg:'rgba(168,168,168,0.15)',color:'#777',dot:'#a8a8a8'},
  };
  const sm=STATUS_META[leadStatus]||STATUS_META.new;

  // Build grouped message list
  const grouped=[];
  let lastDate='';
  messages.forEach((m,i)=>{
    const d=formatMsgDate(m.created_at);
    if(d!==lastDate){grouped.push({type:'date',label:d,key:'date_'+i});lastDate=d;}
    grouped.push({type:'msg',msg:m,key:m.id||'msg_'+i});
  });

  const otherName=currentRole==='vendor'?(lead.customer_name||'Customer'):(lead.vendor_name||'Vendor');
  const avatar=(name)=>(name||'?')[0].toUpperCase();

  return(
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,background:'var(--white)',overflow:'hidden',borderRadius:0}}>

      {/* ── Header ── */}
      <div style={{padding:'12px 16px',borderBottom:'none',display:'flex',alignItems:'center',gap:10,background:'#075e54',boxShadow:'0 1px 6px rgba(0,0,0,0.15)',flexShrink:0,zIndex:2}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'#ffffff',padding:'6px',borderRadius:8,flexShrink:0,display:'flex',alignItems:'center'}}>{IC.back(20,'#ffffff')}</button>
        {/* Avatar */}
        <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'#ffffff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.9rem',flexShrink:0}}>{avatar(otherName)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:'0.92rem',color:'#ffffff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{otherName}</div>
          <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.75)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.title}</div>
        </div>
        {/* Status badge */}
        <div style={{display:'flex',alignItems:'center',gap:6,background:sm.bg,borderRadius:999,padding:'4px 10px',flexShrink:0}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:sm.dot}}/>
          {currentRole==='vendor'?(
            <select value={leadStatus} onChange={e=>updateStatus(e.target.value)}
              style={{border:'none',background:'transparent',fontSize:'0.72rem',fontWeight:600,color:sm.color,cursor:'pointer',outline:'none',padding:0}}>
              <option value="new">New</option>
              <option value="responded">Responded</option>
              <option value="closed">Closed</option>
            </select>
          ):(
            <span style={{fontSize:'0.72rem',fontWeight:600,color:'rgba(255,255,255,0.9)'}}>{sm.label}</span>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:2,background:'#ece5dd'}}>
        {loadingMsgs?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{textAlign:'center',color:'var(--light)'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:6}}>{IC.chat(28,'#f0e8dc')}</div>
              <div style={{fontSize:'0.84rem'}}>Loading messages…</div>
            </div>
          </div>
        ):grouped.length===0?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{textAlign:'center',color:'var(--light)',padding:'20px'}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>{IC.chat(28,'#f0e8dc')}</div>
              <div style={{fontSize:'0.88rem',fontWeight:500,color:'var(--mid)',marginBottom:4}}>Start the conversation</div>
              <div style={{fontSize:'0.78rem'}}>Say hello to {otherName}</div>
            </div>
          </div>
        ):(
          grouped.map(item=>{
            if(item.type==='date') return(
              <div key={item.key} style={{display:'flex',alignItems:'center',gap:8,margin:'12px 0 8px'}}>
                <div style={{flex:1,height:1,background:'rgba(0,0,0,0.1)'}}/>
                <span style={{fontSize:'0.68rem',color:'#667781',fontWeight:500,letterSpacing:'0.06em',background:'#ece5dd',padding:'2px 10px',borderRadius:999}}>{item.label}</span>
                <div style={{flex:1,height:1,background:'rgba(0,0,0,0.1)'}}/>
              </div>
            );
            const m=item.msg;
            const isMe=m.sender_role===currentRole;
            const isLast=grouped[grouped.length-1].key===item.key||(grouped[grouped.length-1].type==='msg'&&grouped[grouped.length-1].key===item.key);
            const isRead=readUpTo&&m.id===readUpTo&&isMe&&!m._sending;
            const time=m.created_at?new Date(m.created_at).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}):'';
            return(
              <div key={item.key} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',marginBottom:2}}>
                <div style={{display:'flex',alignItems:'flex-end',gap:6,flexDirection:isMe?'row-reverse':'row',maxWidth:'82%'}}>
                  {/* Avatar for other party — only on first in a run */}
                  {!isMe&&(
                    <div style={{width:26,height:26,borderRadius:'50%',background:'#3a4a3f',color:'#e8d5a3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,flexShrink:0,marginBottom:2}}>{avatar(otherName)}</div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:2}}>
                    {m.message_text&&(
                      <div style={{
                        background:m._sending?'rgba(39,119,88,0.5)':isMe?'#dcf8c6':'#ffffff',
                        color:'#111b21',
                        borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',
                        padding:'10px 14px',
                        fontSize:'0.875rem',
                        lineHeight:1.5,
                        boxShadow:isMe?'none':'0 1px 3px rgba(0,0,0,0.08)',
                        whiteSpace:'pre-wrap',
                        wordBreak:'break-word',
                        opacity:m._sending?0.7:1,
                      }}>
                        {m.message_text}
                      </div>
                    )}
                    {m.file_url&&(
                      <a href={m.file_url} target="_blank" rel="noreferrer"
                        style={{display:'inline-flex',alignItems:'center',gap:6,background:isMe?'#dcf8c6':'#ffffff',color:'#111b21',borderRadius:12,padding:'8px 12px',fontSize:'0.8rem',textDecoration:'none',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                        <span style={{display:'flex'}}>{IC.attach(14,'currentColor')}</span> Attachment
                      </a>
                    )}
                    {/* Timestamp + read receipt */}
                    <div style={{display:'flex',alignItems:'center',gap:4,paddingLeft:isMe?0:4,paddingRight:isMe?4:0}}>
                      <span style={{fontSize:'0.62rem',color:'#667781'}}>{time}{m._sending?' · Sending…':''}</span>
                      {isMe&&!m._sending&&(
                        <span style={{fontSize:'0.68rem',color:isRead?'#53bdeb':'#667781',fontWeight:400}} title={isRead?'Seen':'Delivered'}>
                          {isRead?'✓✓':'✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {otherTyping&&(
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0 8px'}}>
            <div style={{width:26,height:26,borderRadius:'50%',background:'#3a4a3f',color:'#e8d5a3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,flexShrink:0}}>{avatar(otherName)}</div>
            <div style={{background:'var(--white)',borderRadius:'18px 18px 18px 4px',padding:'10px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)',display:'flex',gap:4,alignItems:'center'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--light)',display:'inline-block',animation:'bounce 1s infinite'}}/>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--light)',display:'inline-block',animation:'bounce 1s 0.2s infinite'}}/>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--light)',display:'inline-block',animation:'bounce 1s 0.4s infinite'}}/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── Emoji picker ── */}
      {showEmoji&&(
        <div style={{background:'#f0f0f0',borderTop:'1px solid #d9d9d9',padding:'10px 14px',display:'flex',gap:8,flexWrap:'wrap',flexShrink:0}}>
          {EMOJI_LIST.map(em=>(
            <button key={em} onClick={()=>appendEmoji(em)}
              style={{background:'none',border:'none',fontSize:'1.4rem',cursor:'pointer',padding:'2px 4px',borderRadius:6,lineHeight:1}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--parchment)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              {em}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{padding:'10px 12px',borderTop:'1px solid #d9d9d9',background:'#f0f0f0',flexShrink:0}}>
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          {/* Emoji toggle */}
          <button onClick={()=>setShowEmoji(e=>!e)}
            style={{background:'none',border:'none',borderRadius:8,padding:'8px',cursor:'pointer',color:'#54656f',flexShrink:0,display:'flex',alignSelf:'flex-end'}}>
            {IC.smile(20,'var(--mid)')}
          </button>
          {/* Textarea */}
          <div style={{flex:1,background:'#ffffff',borderRadius:22,border:'none',padding:'8px 14px',display:'flex',alignItems:'flex-end',gap:8}}>
            <textarea
              ref={textareaRef}
              value={msgText}
              onChange={e=>{setMsgText(e.target.value);handleTyping();}}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(e);}}}
              placeholder="Message…"
              rows={1}
              style={{flex:1,border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',outline:'none',resize:'none',maxHeight:100,lineHeight:1.5,padding:0}}
            />
          </div>
          {/* Attach */}
          <button onClick={()=>fileRef.current?.click()}
            style={{background:'none',border:'none',borderRadius:8,padding:'8px',cursor:'pointer',color:'#54656f',flexShrink:0,display:'flex',alignSelf:'flex-end'}}>
            {IC.attach(20,'var(--mid)')}
          </button>
          {/* Send */}
          <button onClick={sendMessage} disabled={sending||!msgText.trim()}
            style={{width:38,height:38,borderRadius:'50%',background:msgText.trim()?'#25d366':'#cccccc',color:'#ffffff',border:'none',cursor:msgText.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s'}}>
{sending?'…':IC.send(18,'currentColor')}
          </button>
        </div>
        <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadAndSend(e.target.files[0])}/>
      </div>

      <style>{`
        @keyframes bounce {
          0%,60%,100%{transform:translateY(0);}
          30%{transform:translateY(-4px);}
        }
      `}</style>
    </div>
  );
}

// ── CUSTOMER DASHBOARD ───────────────────────────────────────────────────────

export default ChatThread;
export { ChatThread };