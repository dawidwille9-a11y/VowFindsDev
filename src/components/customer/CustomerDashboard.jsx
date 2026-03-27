import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch } from '../../api.js';
import { IC } from '../../icons.jsx';
import { ALL_TYPES, TYPE_COLOR } from '../../constants.js';
import { formatDateDisplay } from '../../utils.js';
import ChatThread from '../chat/ChatThread.jsx';

function CustomerDashboard({user,onLogout,onBrowse,initialLead=null}) {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeLead,setActiveLead]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const pollRef=useRef(null);
  // Track whether the initial lead has been applied — only do it once
  const initialLeadApplied=useRef(false);

  useEffect(()=>{
    loadLeads();
    pollRef.current=setInterval(loadLeads,8000);
    return()=>clearInterval(pollRef.current);
  },[]);

  // Apply initialLead only once, after first load
  useEffect(()=>{
    if(initialLead&&leads.length>0&&!initialLeadApplied.current){
      const found=leads.find(l=>l.id===initialLead.id);
      if(found){setActiveLead(found);initialLeadApplied.current=true;}
    }
  },[leads]);

  async function loadLeads(){
    try{
      if(!user.customerId)return;
      const data=await supaFetch(`leads?customer_id=eq.${user.customerId}&select=*,vendor:vendors(name,type,color,images:vendor_images(url))&order=created_at.desc`);
      const withMsgs=await Promise.all((data||[]).map(async lead=>{
        try{
          const msgs=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);
          return{...lead,last_message:Array.isArray(msgs)?msgs[0]:null};
        }catch{return lead;}
      }));
      setLeads(withMsgs);
    }catch(e){}
    setLoading(false);
  }

  const STATUS_COLOR={'new':'#c9a96e','responded':'#3a7a5a','closed':'#a8a8a8'};
  const STATUS_BG={'new':'rgba(201,169,110,0.1)','responded':'rgba(58,122,90,0.1)','closed':'rgba(168,168,168,0.1)'};
  const unread=leads.filter(l=>l.last_message&&l.last_message.sender_role==='vendor').length;

  return(
    <div className="vf-customer-dash-body" style={{minHeight:'100vh',background:'var(--cream)',display:'flex',flexDirection:'column'}}>

      {/* Top bar */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 1px 8px rgba(0,0,0,0.05)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',borderRadius:6,display:'flex',flexDirection:'column',gap:4,color:'var(--forest)'}}>
            <div style={{width:18,height:2,background:'var(--forest)',borderRadius:2}}/>
            <div style={{width:14,height:2,background:'var(--forest)',borderRadius:2}}/>
            <div style={{width:18,height:2,background:'var(--forest)',borderRadius:2}}/>
          </button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>
            {activeLead?activeLead.title:'My Quotes'}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {activeLead&&(
            <button onClick={()=>setActiveLead(null)} style={{display:'flex',alignItems:'center',gap:5,background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',fontSize:'0.78rem',color:'var(--mid)',cursor:'pointer'}}>
              ‹ Back
            </button>
          )}
          <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'6px 12px',fontSize:'0.78rem',cursor:'pointer',fontWeight:500}}>Browse Vendors</button>
          <button onClick={onLogout} style={{background:'none',border:'1px solid var(--parchment)',borderRadius:7,padding:'6px 12px',fontSize:'0.78rem',color:'var(--mid)',cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>

        {/* Sidebar overlay on mobile */}
        {sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:50}}/>}

        {/* Sidebar — absolute on mobile so it overlays instead of pushing content right */}
        <div style={{
          width:280,flexShrink:0,background:'var(--white)',borderRight:'1px solid var(--parchment)',
          display:'flex',flexDirection:'column',
          position:window.innerWidth<=700?'absolute':'relative',
          top:0,bottom:0,left:0,
          zIndex:51,
          transition:'transform 0.25s ease',
          transform:sidebarOpen||window.innerWidth>700?'translateX(0)':'translateX(-100%)',
        }}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--forest)',display:'flex',alignItems:'center',gap:6}}>{IC.chat(15,'var(--forest)')} Conversations</div>
              <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:2}}>Hi, {user.name}</div>
            </div>
            {unread>0&&<span style={{background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.68rem',padding:'2px 8px',fontWeight:600}}>{unread}</span>}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
            {loading?(
              <div style={{textAlign:'center',padding:'24px',color:'var(--light)',fontSize:'0.82rem'}}>Loading…</div>
            ):leads.length===0?(
              <div style={{textAlign:'center',padding:'32px 16px'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>{IC.chat(36,'#f0e8dc')}</div>
                <div style={{fontSize:'0.84rem',color:'var(--mid)',marginBottom:10}}>No quotes yet</div>
                <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'8px 14px',fontSize:'0.78rem',cursor:'pointer'}}>Browse vendors</button>
              </div>
            ):(
              leads.map(lead=>{
                const isActive=activeLead?.id===lead.id;
                const hasVendorReply=lead.last_message?.sender_role==='vendor';
                return(
                  <div key={lead.id} onClick={()=>{setActiveLead(lead);setSidebarOpen(false);}}
                    style={{padding:'10px 12px',borderRadius:10,cursor:'pointer',marginBottom:4,
                      background:isActive?'rgba(58,74,63,0.08)':'transparent',
                      border:`1.5px solid ${isActive?'var(--forest)':'transparent'}`,
                      transition:'all 0.12s'}}
                    onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='var(--cream)';}}
                    onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent';}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:34,height:34,borderRadius:7,background:lead.vendor?.images?.[0]?.url?`url(${lead.vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}cc,${lead.vendor?.color||'#c8a87a'}66)`,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.vendor?.name}</div>
                        <div style={{fontSize:'0.71rem',color:'var(--mid)',marginTop:1}}>{lead.title}</div>
                      </div>
                      {hasVendorReply&&!isActive&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--rose)',flexShrink:0}}/>}
                    </div>
                    {lead.last_message&&(
                      <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingLeft:42}}>
                        {lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'Attachment'}
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:4,paddingLeft:42}}>
                      <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.62rem',padding:'1px 6px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                      <span style={{fontSize:'0.66rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {activeLead?(
            <ChatThread
              lead={{...activeLead,customer_name:user.name,vendor_name:activeLead.vendor?.name}}
              currentRole="customer"
              currentName={user.name}
              onBack={()=>setActiveLead(null)}
            />
          ):(
            <div style={{flex:1,overflowY:'auto',padding:'0'}}>
            <div style={{}}>
            <div style={{maxWidth:820,margin:'0 auto',padding:'28px 24px 60px'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:400,marginBottom:4}}>My Quote Requests</div>
              <p style={{color:'var(--light)',fontSize:'0.82rem',marginBottom:24}}>Your conversations grouped by vendor category.</p>
              {loading?(
                <div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading…</div>
              ):leads.length===0?(
                <div style={{textAlign:'center',padding:'60px 20px',background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)'}}>
                  <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>{IC.chat(48,'#f0e8dc')}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>No quote requests yet</div>
                  <p style={{color:'var(--mid)',fontSize:'0.88rem',marginBottom:16}}>Browse vendors and click "Request a Quote" to get started.</p>
                  <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px 22px',fontSize:'0.88rem',cursor:'pointer'}}>Browse Vendors</button>
                </div>
              ):(()=>{
                const grouped={};
                leads.forEach(lead=>{const type=lead.vendor?.type||'Other';if(!grouped[type])grouped[type]=[];grouped[type].push(lead);});
                const orderedTypes=[...ALL_TYPES.filter(t=>grouped[t]),...Object.keys(grouped).filter(t=>!ALL_TYPES.includes(t)&&grouped[t])];
                return orderedTypes.map(type=>(
                  <div key={type} style={{marginBottom:28}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,paddingBottom:8,borderBottom:'2px solid var(--parchment)'}}>
                      <span style={{display:'flex'}}>{(TYPE_ICON[type]||IC.camera)(20,'var(--forest)')}</span>
                      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
                      <span style={{fontSize:'0.72rem',color:'var(--light)',background:'var(--parchment)',padding:'2px 9px',borderRadius:999}}>{grouped[type].length} conversation{grouped[type].length!==1?'s':''}</span>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {grouped[type].map(lead=>{
                        const hasNew=lead.last_message?.sender_role==='vendor'&&lead.status!=='closed';
                        return(
                          <div key={lead.id} onClick={()=>setActiveLead(lead)}
                            style={{background:'var(--white)',borderRadius:12,padding:'14px 18px',boxShadow:'var(--card-shadow)',cursor:'pointer',transition:'box-shadow 0.15s,transform 0.15s',display:'flex',alignItems:'center',gap:14,borderLeft:`3px solid ${hasNew?'var(--rose)':'var(--parchment)'}`}}
                            onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--card-shadow-hover)';e.currentTarget.style.transform='translateY(-2px)';}}
                            onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--card-shadow)';e.currentTarget.style.transform='';}}>
                            <div style={{width:44,height:44,borderRadius:9,background:lead.vendor?.images?.[0]?.url?`url(${lead.vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}dd,${lead.vendor?.color||'#c8a87a'}66)`,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',fontWeight:600,color:'var(--forest)'}}>{lead.vendor?.name}</span>
                                {hasNew&&<span style={{width:7,height:7,borderRadius:'50%',background:'var(--rose)',flexShrink:0,display:'inline-block'}}/>}
                              </div>
                              <div style={{fontSize:'0.74rem',color:'var(--mid)',marginBottom:3}}>{lead.title}</div>
                              {lead.last_message&&<div style={{fontSize:'0.73rem',color:'var(--light)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'Attachment'}</div>}
                            </div>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
                              <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.65rem',padding:'2px 8px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                              <span style={{fontSize:'0.68rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
            </div>
          </div>
          )}
        </div>

      </div>
    </div>
  );
}


// ── LOGIN MODAL ───────────────────────────────────────────────────────────────

export default CustomerDashboard;
export {{ CustomerDashboard }};