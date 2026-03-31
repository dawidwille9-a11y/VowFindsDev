import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES, TYPE_COLOR } from '../../constants.js';
import { fmt, formatDateDisplay, isOnRequest } from '../../utils.js';
import VendorForm from './VendorForm.jsx';
import ChatThread from '../chat/ChatThread.jsx';
import Calendar from '../calendar/Calendar.jsx';

const inputStyle = {border:'1.5px solid var(--parchment)',borderRadius:8,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'};

function VendorDashboard({user,onLogout}) {
  const [myVendors,setMyVendors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [editData,setEditData]=useState(null);
  const [leads,setLeads]=useState([]);
  const [leadsLoading,setLeadsLoading]=useState(false);
  const [activeLead,setActiveLead]=useState(null);
  const [activeVendorForCal,setActiveVendorForCal]=useState(null);
  const [unavailDates,setUnavailDates]=useState(new Set());
  const [calSaving,setCalSaving]=useState(false);
  const [calSaved,setCalSaved]=useState(false);
  const [cal1Y,setCal1Y]=useState(new Date().getFullYear());
  const [cal1M,setCal1M]=useState(new Date().getMonth());
  const [cal2Y,setCal2Y]=useState(()=>{const d=new Date();return d.getMonth()===11?d.getFullYear()+1:d.getFullYear();});
  const [cal2M,setCal2M]=useState(()=>{const m=new Date().getMonth();return m===11?0:m+1;});

  useEffect(()=>{loadMyVendors();},[]);
  useEffect(()=>{if(myVendors.length>0)loadLeads();},[myVendors]);

  async function loadMyVendors(){
    setLoading(true);
    try{
      // Admin view: load specific vendor by ID; normal view: load by user_id
      const query=user.adminView&&user.vendorId
        ?`vendors?id=eq.${user.vendorId}&select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)`
        :`vendors?user_id=eq.${user.userId}&select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=name`;
      const data=await supaFetch(query);
      setMyVendors(data);
      if(data.length>0){
        setActiveVendorForCal(data[0]);
        setUnavailDates(new Set((data[0].unavail_dates||[]).map(d=>d.date)));
      }
    }catch(e){console.error(e);}
    setLoading(false);
  }

  async function loadLeads(){
    setLeadsLoading(true);
    try{
      const vendorIds=myVendors.map(v=>v.id);
      if(vendorIds.length===0){setLeads([]);setLeadsLoading(false);return;}
      const data=await supaFetch(`leads?vendor_id=in.(${vendorIds.join(',')})&select=*,customer:customers(name,email)&order=created_at.desc`);
      const withMsgs=await Promise.all((data||[]).map(async lead=>{
        try{
          const msgs=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);
          return{...lead,last_message:Array.isArray(msgs)?msgs[0]:null,customer_name:lead.customer?.name||'Customer',vendor_name:myVendors.find(v=>v.id===lead.vendor_id)?.name||''};
        }catch{return{...lead,customer_name:lead.customer?.name||'Customer'};}
      }));
      setLeads(withMsgs);
    }catch(e){setLeads([]);}
    setLeadsLoading(false);
  }

  function selectVendorForCal(v){
    setActiveVendorForCal(v);
    setUnavailDates(new Set((v.unavail_dates||[]).map(d=>d.date)));
    setCalSaved(false);
  }

  function toggleUnavail(key){setUnavailDates(prev=>{const next=new Set(prev);next.has(key)?next.delete(key):next.add(key);return next;});}

  async function saveAvailability(){
    if(!activeVendorForCal)return;
    setCalSaving(true);
    try{
      const id=activeVendorForCal.id;
      await supaFetch(`vendor_unavailable_dates?vendor_id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});
      if(unavailDates.size>0)await supaFetch('vendor_unavailable_dates',{method:'POST',body:JSON.stringify([...unavailDates].map(date=>({vendor_id:id,date}))),prefer:'return=minimal'});
      setCalSaved(true);setTimeout(()=>setCalSaved(false),3000);
      loadMyVendors();
    }catch(e){alert('Save failed: '+e.message);}
    setCalSaving(false);
  }

  async function deleteVendor(id){
    if(!window.confirm('Delete this vendor profile? This cannot be undone.'))return;
    try{await supaFetch(`vendors?id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});loadMyVendors();}
    catch(e){alert('Delete failed: '+e.message);}
  }

  function startEdit(v){setEditData({...v,_unavailDates:(v.unavail_dates||[]).map(d=>d.date)});setEditing(v.id);}

  // ── Editing view ──────────────────────────────────────────────────────────
  if(editing==='new')return(
    <div style={{padding:'16px',maxWidth:800,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:16,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:400,color:'var(--forest)',marginBottom:20}}>Add New Vendor Profile</h2>
      <VendorForm userId={user.userId} onSaved={()=>{setEditing(null);loadMyVendors();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(editing&&editData)return(
    <div style={{padding:'16px',maxWidth:800,margin:'0 auto',width:'100%',boxSizing:'border-box'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:16,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:400,color:'var(--forest)',marginBottom:20}}>Edit: {editData.name}</h2>
      <VendorForm initialData={editData} vendorId={editing} userId={user.userId} onSaved={()=>{setEditing(null);loadMyVendors();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(activeLead)return(
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <ChatThread
        lead={{...activeLead,customer_name:activeLead.customer?.name||'Customer',vendor_name:myVendors.find(v=>v.id===activeLead.vendor_id)?.name||''}}
        currentRole="vendor"
        currentName={user.email}
        onBack={()=>{setActiveLead(null);loadLeads();}}
      />
    </div>
  );

  const STATUS_COLOR={'new':'#c9a96e','responded':'#3a7a5a','closed':'#a8a8a8'};
  const STATUS_BG={'new':'rgba(201,169,110,0.1)','responded':'rgba(58,122,90,0.1)','closed':'rgba(168,168,168,0.1)'};
  const newLeadsCount=leads.filter(l=>l.status==='new').length;

  const isMobileVD = typeof window!=='undefined'&&window.matchMedia('(max-width:767px)').matches;

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>

      {/* Dashboard header — compact on mobile */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',
        padding:isMobileVD?'14px 16px':'20px 32px',boxShadow:'0 2px 12px rgba(0,0,0,0.04)'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',
          justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",
              fontSize:isMobileVD?'1.3rem':'1.6rem',fontWeight:400,
              color:'var(--forest)',marginBottom:2}}>Vendor Dashboard</h2>
            <p style={{color:'var(--light)',fontSize:'0.76rem'}}>{user.email}</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setEditing('new')} style={{background:'var(--rose)',color:'var(--white)',
              border:'none',borderRadius:8,padding:isMobileVD?'8px 14px':'9px 18px',
              fontFamily:"'DM Sans',sans-serif",fontSize:'0.8rem',fontWeight:500,cursor:'pointer'}}>
              + Add Vendor
            </button>
            <button onClick={onLogout} style={{background:'var(--parchment)',color:'var(--mid)',
              border:'none',borderRadius:8,padding:isMobileVD?'8px 12px':'9px 16px',
              fontFamily:"'DM Sans',sans-serif",fontSize:'0.8rem',cursor:'pointer'}}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main layout — single column on mobile, two-column on desktop */}
      <div style={{maxWidth:1200,margin:'0 auto',
        padding:isMobileVD?'14px 12px 80px':'28px 28px 60px',
        display:'grid',
        gridTemplateColumns:isMobileVD?'1fr':'1fr 380px',
        gap:isMobileVD?14:24,alignItems:'start'}}>

        {/* LEFT COLUMN */}
        <div style={{display:'flex',flexDirection:'column',gap:isMobileVD?12:24}}>

          {/* ── VENDOR PROFILE SECTION ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.settings(16,'var(--forest)')}My Vendor Profile</div>
            </div>
            <div style={{padding:'16px 22px'}}>
              {loading?<div style={{textAlign:'center',padding:'30px',color:'var(--light)'}}>Loading…</div>:
                myVendors.length===0?(
                  <div style={{textAlign:'center',padding:'30px 16px'}}>
                    <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>{IC.flower(36,'#f0e8dc')}</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',marginBottom:6}}>No vendor profiles yet</div>
                    <p style={{color:'var(--mid)',fontSize:'0.84rem',marginBottom:14}}>Create your first profile to appear in searches.</p>
                    <button onClick={()=>setEditing('new')} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'9px 20px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.84rem',cursor:'pointer'}}>Create profile</button>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {myVendors.map(v=>(
                      <div key={v.id} onClick={()=>startEdit(v)}
                        style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:10,border:'1.5px solid var(--parchment)',cursor:'pointer',transition:'border-color 0.15s,background 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--rose)';e.currentTarget.style.background='rgba(196,130,106,0.04)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--parchment)';e.currentTarget.style.background='';}}>
                        <div style={{width:48,height:48,borderRadius:9,background:v.images?.[0]?.url?`url(${v.images[0].url}) center/cover`:`linear-gradient(135deg,${v.color||'#c8a87a'}dd,${v.color||'#c8a87a'}66)`,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)'}}>{v.name}</div>
                          <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:1}}>{v.type} · {v.location}</div>
                          <div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:1}}>Base: {fmt(v.fixed_rate)} · R{v.per_km_rate}/km</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button onClick={e=>{e.stopPropagation();startEdit(v);}} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:6,padding:'8px 12px',fontSize:'0.75rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5,minHeight:36}}>{IC.edit(13,'var(--gold-light)')}Edit</button>
                          <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:6,padding:'8px 10px',fontSize:'0.75rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5,minHeight:36}}>{IC.trash(13,'#b85a45')}Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* ── LEADS & CONVERSATIONS ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>
                Leads & Conversations
                {newLeadsCount>0&&<span style={{marginLeft:8,background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.68rem',padding:'2px 8px',fontWeight:600}}>{newLeadsCount} new</span>}
              </div>
              <button onClick={loadLeads} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--mid)'}}>↻ Refresh</button>
            </div>
            <div style={{padding:'12px 22px 16px'}}>
              {leadsLoading?<div style={{textAlign:'center',padding:'24px',color:'var(--light)'}}>Loading leads…</div>:
                leads.length===0?(
                  <div style={{textAlign:'center',padding:'32px 16px'}}>
                    <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>{IC.chat(32,'#f0e8dc')}</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',marginBottom:4}}>No leads yet</div>
                    <p style={{color:'var(--mid)',fontSize:'0.82rem'}}>When customers request quotes from your profile, they'll appear here.</p>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {leads.map(lead=>(
                      <div key={lead.id} onClick={()=>setActiveLead(lead)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:10,border:'1.5px solid var(--parchment)',cursor:'pointer',transition:'all 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--gold)';e.currentTarget.style.background='rgba(201,169,110,0.04)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--parchment)';e.currentTarget.style.background='';}}>
                        <div style={{width:36,height:36,borderRadius:8,background:STATUS_BG[lead.status]||STATUS_BG.new,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>
                          {lead.status==='responded'?IC.chat(14,'#3a7a5a'):lead.status==='closed'?IC.check(14,'#a8a8a8'):IC.chat(14,'#c9a96e')}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'0.88rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.title}</div>
                          <div style={{fontSize:'0.74rem',color:'var(--mid)',marginTop:1,display:'flex',alignItems:'center',gap:4}}>{IC.eye(13,'var(--light)')}{lead.customer_name}</div>
                          {lead.last_message&&<div style={{fontSize:'0.72rem',color:'var(--light)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.last_message.sender_role==='customer'?lead.customer_name+': ':''}{ lead.last_message.message_text||'Attachment'}</div>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                          <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.65rem',padding:'2px 8px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                          <span style={{fontSize:'0.68rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

        </div>{/* end LEFT COLUMN */}

        {/* RIGHT COLUMN — stacks below on mobile */}
        <div style={{display:'flex',flexDirection:'column',gap:isMobileVD?12:24}}>

          {/* ── AVAILABILITY CALENDAR ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.calendar(16,'var(--forest)')}Availability</div>
              {myVendors.length>1&&(
                <select value={activeVendorForCal?.id||''} onChange={e=>{const v=myVendors.find(x=>x.id===e.target.value);if(v)selectVendorForCal(v);}}
                  style={{fontSize:'0.76rem',border:'1px solid var(--parchment)',borderRadius:6,padding:'4px 8px',background:'var(--cream)',color:'var(--charcoal)',cursor:'pointer'}}>
                  {myVendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
            </div>
            <div style={{padding:'14px 16px'}}>
              {myVendors.length===0?(
                <div style={{textAlign:'center',padding:'20px',color:'var(--light)',fontSize:'0.84rem'}}>Create a vendor profile first.</div>
              ):(
                <>
                  {activeVendorForCal&&(
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'8px 10px',background:'var(--cream)',borderRadius:8}}>
                      <div style={{width:32,height:32,borderRadius:7,background:activeVendorForCal.images?.[0]?.url?`url(${activeVendorForCal.images[0].url}) center/cover`:`linear-gradient(135deg,${activeVendorForCal.color||'#c8a87a'}dd,${activeVendorForCal.color||'#c8a87a'}66)`,flexShrink:0}}/>
                      <div style={{fontSize:'0.82rem',fontWeight:500,color:'var(--forest)'}}>{activeVendorForCal.name}</div>
                      <div style={{marginLeft:'auto',fontSize:'0.74rem',color:'var(--rose)',fontWeight:500}}>{unavailDates.size} blocked</div>
                    </div>
                  )}
                  <p style={{fontSize:'0.74rem',color:'var(--mid)',marginBottom:10}}>Tap a date to block / unblock it.</p>
                  {/* Calendar wrapper — prevents overflow on mobile */}
                  <div style={{width:'100%',overflowX:'hidden'}}>
                    <Calendar year={cal1Y} month={cal1M} unavailDates={unavailDates} editable onToggle={toggleUnavail}
                      onPrev={()=>{let m=cal1M-1,y=cal1Y;if(m<0){m=11;y--;}setCal1M(m);setCal1Y(y);}}
                      onNext={()=>{let m=cal1M+1,y=cal1Y;if(m>11){m=0;y++;}setCal1M(m);setCal1Y(y);}}/>
                  </div>
                  <div style={{marginTop:12,display:'flex',alignItems:'center',gap:10}}>
                    <button onClick={saveAvailability} disabled={calSaving} style={{flex:1,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:'9px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.84rem',fontWeight:500,cursor:calSaving?'wait':'pointer'}}>
                      {calSaving?'Saving…':'Save'}
                    </button>
                    {calSaved&&<span style={{fontSize:'0.8rem',color:'var(--forest)',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>{IC.check(12,'var(--forest)')}Saved</span>}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>{/* end RIGHT COLUMN */}

      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
// ── ON-REQUEST PRICING PANEL (admin) ─────────────────────────────────────────
function OnRequestPricingPanel() {
  const [averages, setAverages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const ON_REQ_LIST = [...ON_REQUEST_TYPES];

  useEffect(()=>{
    loadAverages();
  },[]);

  async function loadAverages(){
    setLoading(true);
    try{
      const keys = ON_REQ_LIST.map(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`);
      const data = await supaFetch(`app_settings?key=in.(${keys.map(k=>`"${k}"`).join(',')})&select=key,value`);
      const map = {};
      (data||[]).forEach(row=>{
        // reverse-map key back to type
        const type = ON_REQ_LIST.find(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`===row.key);
        if(type) map[type] = row.value;
      });
      setAverages(map);
    }catch(e){
      setError('Could not load settings. Run the SQL below to create the app_settings table first.');
    }
    setLoading(false);
  }

  async function saveAverages(){
    setSaving(true); setError(''); setSaved(false);
    try{
      for(const type of ON_REQ_LIST){
        const key = `onreq_avg_${type.replace(/[^a-zA-Z0-9]/g,'_')}`;
        const value = averages[type]||'0';
        // Upsert — insert or update
        await supaFetch('app_settings', {
          method:'POST',
          body: JSON.stringify({key, value, updated_at: new Date().toISOString()}),
          prefer: 'resolution=merge-duplicates,return=minimal',
          headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        });
      }
      setSaved(true);
      setTimeout(()=>setSaved(false), 3000);
    }catch(e){
      setError('Save failed: '+e.message);
    }
    setSaving(false);
  }

  return(
    <div style={{padding:'32px',maxWidth:680,margin:'0 auto'}}>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',color:'var(--forest)',fontWeight:400,marginBottom:6}}>On Request Average Pricing</h2>
      <p style={{color:'var(--mid)',fontSize:'0.86rem',marginBottom:24,lineHeight:1.65}}>
        Set the average market cost for each On Request vendor type. These figures are used in the <strong>Wedding Plan</strong> feature to give customers a recommended spend for categories where pricing is not listed on vendor profiles.
      </p>

      {/* SQL setup notice */}
      <div style={{background:'rgba(201,169,110,0.08)',border:'1px solid rgba(201,169,110,0.25)',borderRadius:10,padding:'14px 16px',marginBottom:24,fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.7}}>
        <strong style={{color:'var(--forest)',display:'flex',alignItems:'center',gap:6}}>{IC.settings(14,'var(--forest)')}First-time setup:</strong> Run this SQL in Supabase if you haven't already:
        <code style={{display:'block',marginTop:8,background:'rgba(58,74,63,0.06)',padding:'10px 12px',borderRadius:6,fontFamily:'monospace',fontSize:'0.75rem',color:'var(--forest)',lineHeight:1.8}}>
          CREATE TABLE IF NOT EXISTS app_settings (<br/>
          &nbsp;&nbsp;key TEXT PRIMARY KEY,<br/>
          &nbsp;&nbsp;value TEXT,<br/>
          &nbsp;&nbsp;updated_at TIMESTAMPTZ DEFAULT now()<br/>
          );<br/>
          ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;<br/>
          GRANT ALL ON app_settings TO anon;
        </code>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--light)'}}>Loading…</div>
      ) : (
        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
          <div style={{padding:'0'}}>
            {ON_REQ_LIST.map((type, idx)=>(
              <div key={type} style={{display:'flex',alignItems:'center',gap:16,padding:'18px 24px',borderBottom:idx<ON_REQ_LIST.length-1?'1px solid var(--parchment)':'none'}}>
                <div style={{width:32,display:'flex',alignItems:'center',justifyContent:'center'}}><VendorIcon type={type} size={20} color='var(--forest)'/></div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)',marginBottom:3}}>{type}</div>
                  <div style={{fontSize:'0.74rem',color:'var(--light)'}}>Average total cost for this vendor category</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:'0.84rem',color:'var(--mid)',fontWeight:500}}>R</span>
                  <input
                    type="number"
                    value={averages[type]||''}
                    onChange={e=>setAverages(prev=>({...prev,[type]:e.target.value}))}
                    placeholder="0"
                    style={{...inputStyle, width:140, marginBottom:0, textAlign:'right', fontSize:'0.92rem', fontWeight:600, color:'var(--forest)'}}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error&&<div style={{color:'var(--rose)',fontSize:'0.82rem',marginTop:16,padding:'10px 14px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}

      <div style={{display:'flex',alignItems:'center',gap:14,marginTop:20}}>
        <button onClick={saveAverages} disabled={saving||loading} style={{background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'12px 28px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:(saving||loading)?'wait':'pointer',letterSpacing:'0.04em'}}>
          {saving?'Saving…':'Save Averages'}
        </button>
        {saved&&<span style={{fontSize:'0.84rem',color:'var(--forest)',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>{IC.check(13,'var(--forest)')}Saved!</span>}
      </div>
    </div>
  );
}



export default VendorDashboard;
export { VendorDashboard };