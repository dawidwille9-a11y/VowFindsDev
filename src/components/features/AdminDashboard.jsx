import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch } from '../../api.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUB_KEY } from '../../config.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES } from '../../constants.js';
import { fmt } from '../../utils.js';
import VendorDashboard from '../vendor/VendorDashboard.jsx';
import VendorForm from '../vendor/VendorForm.jsx';
import { loadGoogleMaps } from '../../api.js';

const inputStyle = {border:'1.5px solid var(--parchment)',borderRadius:8,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'};

function AdminDashboard({onLogout}) {
  const [allVendors,setAllVendors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [editData,setEditData]=useState(null);
  const [adminTab,setAdminTab]=useState('vendors'); // 'vendors' | 'diagnostics' | 'pricing'
  const [search,setSearch]=useState('');
  const [viewingVendorDash,setViewingVendorDash]=useState(null); // vendor user object to view full dashboard

  useEffect(()=>{loadAll();},[]);

  async function loadAll(){
    setLoading(true);
    try{const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=type,name');setAllVendors(data);}
    catch(e){console.error(e);}
    setLoading(false);
  }

  async function deleteVendor(id){
    if(!window.confirm('Delete this vendor profile?'))return;
    try{await supaFetch(`vendors?id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});loadAll();}
    catch(e){alert('Delete failed: '+e.message);}
  }

  function startEdit(v){setEditData({...v,_unavailDates:(v.unavail_dates||[]).map(d=>d.date)});setEditing(v.id);}

  const filtered=allVendors.filter(v=>(v.name+v.type+v.location).toLowerCase().includes(search.toLowerCase()));

  // Show full vendor dashboard when admin clicks a vendor
  if(viewingVendorDash)return(
    <>
      <div style={{background:'var(--deep-rose)',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>setViewingVendorDash(null)} style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:7,padding:'6px 14px',color:'white',cursor:'pointer',fontSize:'0.82rem'}}>‹ Back to Admin</button>
        <span style={{color:'rgba(255,255,255,0.7)',fontSize:'0.8rem',display:'flex',alignItems:'center',gap:6}}>{IC.settings(14,'rgba(255,255,255,0.7)')}Admin view: <strong style={{color:'white'}}>{viewingVendorDash.email}</strong></span>
      </div>
      <VendorDashboard user={viewingVendorDash} onLogout={()=>setViewingVendorDash(null)}/>
    </>
  );

  if(editing==='new')return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Add New Vendor</h2>
      <VendorForm onSaved={()=>{setEditing(null);loadAll();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(editing&&editData)return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Edit: {editData.name}</h2>
      <VendorForm initialData={editData} vendorId={editing} onSaved={()=>{setEditing(null);loadAll();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      {/* Admin nav */}
      <div style={{background:'var(--deep-rose)',padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--gold-light)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.settings(16,'var(--gold-light)')}&nbsp;Admin Dashboard</div>
          <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.6)',marginTop:2}}>Full access — all vendor profiles</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{display:'flex',gap:4,background:'rgba(0,0,0,0.2)',borderRadius:8,padding:4}}>
            {[['vendors','Vendors'],['billing','Billing'],['pricing','Pricing'],['diagnostics','Diagnostics']].map(([t,label])=><button key={t} onClick={()=>setAdminTab(t)} style={{background:adminTab===t?'rgba(255,255,255,0.15)':'none',border:'none',color:'rgba(255,255,255,0.9)',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:'0.78rem',fontWeight:500}}>{label}</button>)}
          </div>
          <button onClick={()=>setEditing('new')} style={{background:'var(--gold)',color:'var(--forest)',border:'none',borderRadius:8,padding:'8px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:600,cursor:'pointer'}}>+ Add Vendor</button>
          <button onClick={onLogout} style={{background:'rgba(255,255,255,0.15)',color:'white',border:'none',borderRadius:8,padding:'8px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      {adminTab==='diagnostics'?<DiagnosticPanel/>:adminTab==='pricing'?<OnRequestPricingPanel/>:adminTab==='billing'?<PaywallTogglePanel/>:(
        <div style={{padding:'32px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
            <div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',color:'var(--forest)',fontWeight:400}}>All Vendors <span style={{fontSize:'1rem',color:'var(--light)',fontStyle:'normal'}}>({allVendors.length} total)</span></h2>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, type, location…" style={{...inputStyle,width:280,marginBottom:0}}/>
          </div>

          {loading?<div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading all vendors…</div>:(
            <div style={{display:'grid',gap:12}}>
              {filtered.length===0?<div style={{textAlign:'center',padding:'40px',color:'var(--light)'}}>No vendors found.</div>:
                filtered.map(v=>(
                  <div key={v.id}
                    onClick={()=>setViewingVendorDash({role:'vendor',email:v.name,userId:v.user_id||v.id,vendorId:v.id,adminView:true})}
                    style={{background:'var(--white)',borderRadius:12,padding:'16px 20px',boxShadow:'var(--card-shadow)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',cursor:'pointer',transition:'box-shadow 0.15s,transform 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--card-shadow-hover)';e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--card-shadow)';e.currentTarget.style.transform='';}}>
                    <div style={{width:52,height:52,borderRadius:8,background:v.images?.[0]?.url?`url(${v.images[0].url}) center/cover`:`linear-gradient(135deg,${v.color||'#c8a87a'}dd,${v.color||'#c8a87a'}66)`,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:600,color:'var(--forest)'}}>{v.name}</div>
                      <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:2,display:'flex',alignItems:'center',gap:4}}><VendorIcon type={v.type} size={12} color='var(--mid)'/>{v.type} · {IC.pin(12,'var(--mid)')}{v.location}</div>
                      {v.user_id&&<div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:2}}>User ID: {v.user_id.slice(0,8)}…</div>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.78rem',color:'var(--forest)',background:'rgba(58,74,63,0.08)',padding:'4px 10px',borderRadius:999,fontWeight:500}}>{ON_REQUEST_TYPES.has(v.type)?'On Request':fmt(v.fixed_rate)}</span>
                      <button onClick={e=>{e.stopPropagation();startEdit(v);}} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>{IC.edit(13,'var(--gold-light)')}Edit</button>
                      <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:7,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>{IC.trash(13,'#b85a45')}Delete</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DIAGNOSTICS ───────────────────────────────────────────────────────────────

function OnRequestPricingPanel() {
  const [averages, setAverages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const ON_REQ_LIST = [...ON_REQUEST_TYPES];

  useEffect(()=>{ loadAverages(); },[]);

  async function loadAverages(){
    setLoading(true);
    try{
      const keys = ON_REQ_LIST.map(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`);
      const data = await supaFetch(`app_settings?key=in.(${keys.map(k=>'"'+k+'"').join(',')})&select=key,value`);
      const map = {};
      (data||[]).forEach(row=>{
        const type = ON_REQ_LIST.find(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`===row.key);
        if(type && row.value) map[type] = parseInt(row.value)||0;
      });
      setAverages(map);
    }catch(e){
      setError('Could not load settings. Run the SQL for the app_settings table first.');
    }
    setLoading(false);
  }

  async function saveAverages(){
    setSaving(true); setError(''); setSaved(false);
    try{
      for(const type of ON_REQ_LIST){
        const key = `onreq_avg_${type.replace(/[^a-zA-Z0-9]/g,'_')}`;
        await supaFetch('app_settings',{
          method:'POST',
          body: JSON.stringify({key, value: String(averages[type]||0), updated_at: new Date().toISOString()}),
          prefer:'resolution=merge-duplicates,return=minimal',
          headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        });
      }
      setSaved(true); setTimeout(()=>setSaved(false),3000);
    }catch(e){ setError('Save failed: '+e.message); }
    setSaving(false);
  }

  return(
    <div style={{padding:'24px',maxWidth:680,margin:'0 auto'}}>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:400,marginBottom:6}}>On Request Average Pricing</h2>
      <p style={{color:'var(--mid)',fontSize:'0.84rem',marginBottom:20,lineHeight:1.65}}>
        Set the average market cost for on-request categories. These figures are used in the Wedding Plan feature.
      </p>
      {loading ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--light)'}}>Loading…</div>
      ) : (
        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
          {ON_REQ_LIST.map((type, idx)=>(
            <div key={type} style={{display:'flex',alignItems:'center',gap:16,padding:'16px 20px',borderBottom:idx<ON_REQ_LIST.length-1?'1px solid var(--parchment)':'none'}}>
              <div style={{width:28,display:'flex',alignItems:'center',justifyContent:'center'}}><VendorIcon type={type} size={18} color='var(--forest)'/></div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',fontWeight:600,color:'var(--forest)'}}>{type}</div>
                <div style={{fontSize:'0.72rem',color:'var(--light)'}}>Average total cost</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:'0.84rem',color:'var(--mid)',fontWeight:500}}>R</span>
                <input type="number" value={averages[type]||''} onChange={e=>setAverages(prev=>({...prev,[type]:e.target.value}))} placeholder="0"
                  style={{border:'1.5px solid var(--parchment)',borderRadius:8,padding:'7px 10px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:130,textAlign:'right'}}/>
              </div>
            </div>
          ))}
        </div>
      )}
      {error&&<div style={{color:'var(--rose)',fontSize:'0.82rem',marginTop:14,padding:'10px 14px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}
      <div style={{display:'flex',alignItems:'center',gap:14,marginTop:18}}>
        <button onClick={saveAverages} disabled={saving||loading} style={{background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'11px 24px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:(saving||loading)?'wait':'pointer'}}>
          {saving?'Saving…':'Save Averages'}
        </button>
        {saved&&<span style={{fontSize:'0.82rem',color:'var(--forest)',fontWeight:500,display:'flex',alignItems:'center',gap:4}}>{IC.check(13,'var(--forest)')} Saved!</span>}
      </div>
    </div>
  );
}

function DiagnosticPanel() {
  const [results,setResults]=useState([]);const[running,setRunning]=useState(false);
  async function runTests(){
    setRunning(true);setResults([]);
    const log=(label,status,detail)=>setResults(prev=>[...prev,{label,status,detail}]);
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/`,{headers:{apikey:SUPABASE_PUB_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});log('Supabase reachable',r.ok?'ok':'warn',`HTTP ${r.status}`);}catch(e){log('Supabase reachable','fail',e.message);}
    for(const table of['vendors','vendor_images','vendor_unavailable_dates']){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,{headers:{apikey:SUPABASE_PUB_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,Accept:'application/json'}});const body=await r.text();log(`${table} table`,r.ok?'ok':'fail',r.ok?`HTTP ${r.status}`:`HTTP ${r.status} — ${body}`);}catch(e){log(`${table} table`,'fail',e.message);}}
    try{await loadGoogleMaps();log('Google Maps API','ok','Maps loaded successfully');}catch(e){log('Google Maps API','fail',e.message);}
    setRunning(false);
  }
  const colors={ok:'#2d7a4f',warn:'#b07d2a',fail:'#b03a2a'},bg={ok:'#edfaf3',warn:'#fdf6e3',fail:'#fdecea'};
  return(
    <div style={{maxWidth:680,margin:'40px auto',padding:'0 24px 60px'}}>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',marginBottom:6}}>Diagnostics</h2>
      <p style={{fontSize:'0.84rem',color:'var(--mid)',marginBottom:20}}>Tests Supabase connection and Google Maps API.</p>
      <button onClick={runTests} disabled={running} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px 24px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',cursor:running?'wait':'pointer',marginBottom:24}}>{running?'Running…':'Run Connection Tests'}</button>
      {results.map((r,i)=><div key={i} style={{background:bg[r.status],border:`1px solid ${colors[r.status]}22`,borderRadius:10,padding:'12px 16px',marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:10}}><span>{r.status==='ok'?IC.check(16,'#2d7a4f'):r.status==='warn'?IC.info(16,'#b07d2a'):IC.x(16,'#b03a2a')}</span><span style={{fontWeight:600,fontSize:'0.88rem',color:colors[r.status]}}>{r.label}</span></div><div style={{fontSize:'0.78rem',color:'#555',marginTop:4,fontFamily:'monospace',wordBreak:'break-all'}}>{r.detail}</div></div>)}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
// ── FAVOURITES STAR BUTTON ────────────────────────────────────────────────────


// ── PAYWALL TOGGLE ────────────────────────────────────────────────────────────
function PaywallTogglePanel() {
  const [enabled,setEnabled]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [subs,setSubs]=useState([]);
  const [subsLoading,setSubsLoading]=useState(true);
  const [selectedVendor,setSelectedVendor]=useState(null);

  useEffect(()=>{
    // Load paywall setting
    supaFetch("app_settings?key=eq.paywall_enabled&select=value&limit=1")
      .then(d=>setEnabled(d&&d.length?d[0].value==='true':false))
      .catch(()=>setEnabled(false));
    // Load all subscriptions with vendor info
    supaFetch("subscriptions?select=*&order=created_at.desc")
      .then(d=>setSubs(d||[]))
      .catch(()=>{})
      .finally(()=>setSubsLoading(false));
  },[]);

  async function togglePaywall() {
    setSaving(true);
    const next=!enabled;
    try{
      await supaFetch('app_settings',{
        method:'POST',
        body:JSON.stringify({key:'paywall_enabled',value:String(next),updated_at:new Date().toISOString()}),
        headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
      });
      setEnabled(next);setSaved(true);setTimeout(()=>setSaved(false),3000);
    }catch(e){alert('Save failed: '+e.message);}
    setSaving(false);
  }

  async function grantTrial(vendorUserId,months=3) {
    const trialEnd=new Date();trialEnd.setMonth(trialEnd.getMonth()+months);
    try{
      await supaFetch('subscriptions',{
        method:'POST',
        body:JSON.stringify({vendor_user_id:vendorUserId,plan:'monthly',status:'trial',amount_rands:300,trial_ends_at:trialEnd.toISOString(),updated_at:new Date().toISOString()}),
        headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
      });
      const d=await supaFetch("subscriptions?select=*&order=created_at.desc");setSubs(d||[]);
      alert('Trial granted until '+trialEnd.toLocaleDateString('en-ZA'));
    }catch(e){alert('Failed: '+e.message);}
  }

  const statusDot={active:'#2aaa6a',trial:'#c9a96e',past_due:'#e8352a',cancelled:'#aaa',expired:'#aaa'};

  return(
    <div style={{padding:'24px',maxWidth:720,margin:'0 auto',display:'flex',flexDirection:'column',gap:24}}>

      {/* ── Paywall on/off ── */}
      <div style={{background:'var(--white)',borderRadius:14,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>Vendor Paywall</div>
            <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:2}}>
              When <strong>ON</strong>, vendors must have an active subscription or trial to access their dashboard.
              Turn <strong>OFF</strong> during onboarding to let vendors sign up freely.
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            {saved&&<span style={{fontSize:'0.74rem',color:'#1a7a4a',fontWeight:500}}>✓ Saved</span>}
            <button onClick={togglePaywall} disabled={saving||enabled===null}
              style={{background:enabled?'var(--forest)':'var(--parchment)',
                color:enabled?'var(--gold-light)':'var(--mid)',
                border:'none',borderRadius:999,padding:'8px 20px',
                fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:600,
                cursor:saving?'wait':'pointer',minWidth:80,transition:'all 0.2s'}}>
              {enabled===null?'…':saving?'Saving…':enabled?'ON  ●':'OFF ○'}
            </button>
          </div>
        </div>
        <div style={{padding:'14px 20px',fontSize:'0.8rem',color:'var(--mid)',background:enabled?'rgba(58,122,90,0.04)':'rgba(196,130,106,0.04)',lineHeight:1.7}}>
          {enabled
            ?'🔒 Paywall is ON — vendors without an active subscription or trial will see the payment page instead of their dashboard.'
            :'🔓 Paywall is OFF — all vendors can access their dashboard freely. Use this during onboarding.'}
        </div>
      </div>

      {/* ── Vendor billing overview ── */}
      <div style={{background:'var(--white)',borderRadius:14,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>
            Vendor Subscriptions
          </div>
          <div style={{fontSize:'0.74rem',color:'var(--mid)'}}>
            {subs.filter(s=>s.status==='active').length} active &nbsp;·&nbsp;
            {subs.filter(s=>s.status==='trial').length} trial &nbsp;·&nbsp;
            {subs.filter(s=>!['active','trial'].includes(s.status)).length} unpaid
          </div>
        </div>
        {subsLoading?<div style={{padding:'24px',textAlign:'center',color:'var(--light)'}}>Loading…</div>:(
          subs.length===0
            ?<div style={{padding:'24px',textAlign:'center',color:'var(--light)',fontSize:'0.84rem'}}>No subscriptions yet. Run payfast_setup_v3.sql to initialise.</div>
            :<div style={{maxHeight:420,overflowY:'auto'}}>
              {subs.map(s=>{
                const dot=statusDot[s.status]||'#aaa';
                const end=s.trial_ends_at||s.current_period_end;
                const daysLeft=end?Math.max(0,Math.ceil((new Date(end)-Date.now())/(1000*60*60*24))):null;
                return(
                  <div key={s.id} style={{padding:'11px 20px',borderBottom:'1px solid var(--parchment)',
                    display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:'0.78rem',fontWeight:500,color:'var(--charcoal)',fontFamily:'monospace'}}>
                          {s.vendor_user_id.slice(0,16)}…
                        </div>
                        <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:1}}>
                          {s.status} · {s.plan} · R{s.amount_rands}/mo
                          {daysLeft!==null&&` · ${daysLeft}d left`}
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>grantTrial(s.vendor_user_id,3)}
                        style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'5px 10px',
                          fontSize:'0.7rem',color:'var(--mid)',cursor:'pointer',whiteSpace:'nowrap'}}>
                        +3mo trial
                      </button>
                      <button onClick={()=>grantTrial(s.vendor_user_id,6)}
                        style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'5px 10px',
                          fontSize:'0.7rem',color:'var(--mid)',cursor:'pointer',whiteSpace:'nowrap'}}>
                        +6mo trial
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
        )}
      </div>

      {/* ── Bulk onboarding note ── */}
      <div style={{background:'rgba(201,169,110,0.08)',borderRadius:12,padding:'16px 20px',fontSize:'0.82rem',color:'var(--mid)',lineHeight:1.8,border:'1px solid rgba(201,169,110,0.2)'}}>
        <strong style={{color:'var(--forest)'}}>Onboarding strategy:</strong><br/>
        1. Keep paywall <strong>OFF</strong> while signing up early vendors.<br/>
        2. When ready to launch billing, turn paywall <strong>ON</strong>.<br/>
        3. All vendors signed up during free phase will hit the payment wall on next login.<br/>
        4. Use the <strong>+3mo trial</strong> / <strong>+6mo trial</strong> buttons above to manually extend grace periods for specific vendors before flipping the switch — this way they get a smooth transition rather than an abrupt block.
      </div>
    </div>
  );
}

export default AdminDashboard;
export { AdminDashboard };