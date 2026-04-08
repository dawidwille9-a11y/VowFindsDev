import React, { useState, useEffect, useRef, memo, useCallback, useTransition } from 'react';
import { supaFetch } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES, TYPE_COLOR } from '../../constants.js';
import { fmt, formatDateDisplay, isOnRequest } from '../../utils.js';
import VendorForm from './VendorForm.jsx';
import ChatThread from '../chat/ChatThread.jsx';
import Calendar from '../calendar/Calendar.jsx';

const inputStyle = {border:'1.5px solid var(--parchment)',borderRadius:8,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'};

// Card wrapper — full width, no overflow
function Card({children, style={}}) {
  return (
    <div style={{
      background:'var(--white)', borderRadius:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
      overflow:'hidden', width:'100%', boxSizing:'border-box', ...style
    }}>
      {children}
    </div>
  );
}

function CardHeader({title, right, icon}) {
  return (
    <div style={{
      padding:'13px 14px', borderBottom:'1px solid var(--parchment)',
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap'
    }}>
      <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem',
        color:'var(--forest)', fontWeight:600, display:'flex', alignItems:'center', gap:7}}>
        {icon}{title}
      </div>
      {right}
    </div>
  );
}

function VendorDashboard({user, onLogout}) {
  const [myVendors, setMyVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [activeLead, setActiveLead] = useState(null);
  const [activeVendorForCal, setActiveVendorForCal] = useState(null);
  const [unavailDates, setUnavailDates] = useState(new Set());
  const [calSaving, setCalSaving] = useState(false);
  const [calSaved, setCalSaved] = useState(false);
  const [cal1Y, setCal1Y] = useState(2025);
  const [cal1M, setCal1M] = useState(new Date().getMonth());
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [leadsStatusFilter,setLeadsStatusFilter]=useState('active');

  useEffect(() => { loadMyVendors(); }, []);
  useEffect(() => { if (myVendors.length > 0) loadLeads(); }, [myVendors]);

  async function loadMyVendors() {
    setLoading(true);
    try {
      const query = user.adminView && user.vendorId
        ? `vendors?id=eq.${user.vendorId}&select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)`
        : `vendors?user_id=eq.${user.userId}&select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=name`;
      const data = await supaFetch(query);
      setMyVendors(data);
      if (data.length > 0) {
        setActiveVendorForCal(data[0]);
        setUnavailDates(new Set((data[0].unavail_dates || []).map(d => d.date)));
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function loadLeads() {
    setLeadsLoading(true);
    try {
      const vendorIds = myVendors.map(v => v.id);
      if (vendorIds.length === 0) { setLeads([]); setLeadsLoading(false); return; }
      const data = await supaFetch(`leads?vendor_id=in.(${vendorIds.join(',')})&select=*,customer:customers(name,email)&order=created_at.desc`);
      const withMsgs = await Promise.all((data || []).map(async lead => {
        try {
          const msgs = await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);
          return { ...lead, last_message: Array.isArray(msgs) ? msgs[0] : null, customer_name: lead.customer?.name || 'Customer', vendor_name: myVendors.find(v => v.id === lead.vendor_id)?.name || '' };
        } catch { return { ...lead, customer_name: lead.customer?.name || 'Customer' }; }
      }));
      setLeads(withMsgs);
    } catch(e) { setLeads([]); }
    setLeadsLoading(false);
  }

  function selectVendorForCal(v) {
    setActiveVendorForCal(v);
    setUnavailDates(new Set((v.unavail_dates || []).map(d => d.date)));
    setCalSaved(false);
  }

  const [isPending, startTransition] = useTransition();
  const toggleUnavail = useCallback((key) => {
    startTransition(() => {
      setUnavailDates(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    });
  }, []);

  function getDashTokenHeaders() {
    try {
      const raw = sessionStorage.getItem('vowfinds_session') || localStorage.getItem('vowfinds_session');
      if (raw) { const p = JSON.parse(raw); if (p?.token) return { Authorization: `Bearer ${p.token}` }; }
    } catch(e) {}
    return {};
  }

  async function saveAvailability() {
    if (!activeVendorForCal) return;
    setCalSaving(true);
    const authH = getDashTokenHeaders();
    try {
      const id = activeVendorForCal.id;
      await supaFetch(`vendor_unavailable_dates?vendor_id=eq.${id}`, { method:'DELETE', prefer:'return=minimal', headers:authH });
      if (unavailDates.size > 0) await supaFetch('vendor_unavailable_dates', { method:'POST', body: JSON.stringify([...unavailDates].map(date => ({ vendor_id: id, date }))), prefer:'return=minimal', headers:authH });
      setCalSaved(true); setTimeout(() => setCalSaved(false), 3000);
      loadMyVendors();
    } catch(e) { alert('Save failed: ' + e.message); }
    setCalSaving(false);
  }


  async function deleteVendor(id) {
    // Optimistically remove from UI immediately so there is no freeze
    setMyVendors(prev => prev.filter(v => v.id !== id));
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await supaFetch(`vendors?id=eq.${id}`, { method:'DELETE', prefer:'return=minimal' });
    } catch(e) {
      // Restore on failure
      loadMyVendors();
      alert('Delete failed: ' + e.message);
    }
    setDeletingId(null);
  }

  function startEdit(v) { setEditData({ ...v, _unavailDates: (v.unavail_dates || []).map(d => d.date) }); setEditing(v.id); }

  // ── Editing view ─────────────────────────────────────────────────────────────
  if (editing === 'new') return (
    <div style={{ padding:'16px', width:'100%', boxSizing:'border-box', maxWidth:680, margin:'0 auto' }}>
      <button onClick={() => setEditing(null)} style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:14, background:'none', border:'none', fontSize:'0.82rem', color:'var(--mid)', cursor:'pointer', padding:0 }}>
        {IC.back(14,'var(--mid)')} Back
      </button>
      <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', fontWeight:400, color:'var(--forest)', marginBottom:18 }}>Add New Vendor Profile</h2>
      <VendorForm userId={user.userId} onSaved={() => { setEditing(null); loadMyVendors(); }} onCancel={() => setEditing(null)} />
    </div>
  );

  if (editing && editData) return (
    <div style={{ padding:'16px', width:'100%', boxSizing:'border-box', maxWidth:680, margin:'0 auto' }}>
      <button onClick={() => setEditing(null)} style={{ display:'inline-flex', alignItems:'center', gap:6, marginBottom:14, background:'none', border:'none', fontSize:'0.82rem', color:'var(--mid)', cursor:'pointer', padding:0 }}>
        {IC.back(14,'var(--mid)')} Back
      </button>
      <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.4rem', fontWeight:400, color:'var(--forest)', marginBottom:18 }}>Edit: {editData.name}</h2>
      <VendorForm initialData={editData} vendorId={editing} userId={user.userId} onSaved={() => { setEditing(null); loadMyVendors(); }} onCancel={() => setEditing(null)} />
    </div>
  );

  if (activeLead) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <ChatThread
        lead={{ ...activeLead, customer_name: activeLead.customer?.name || 'Customer', vendor_name: myVendors.find(v => v.id === activeLead.vendor_id)?.name || '' }}
        currentRole="vendor"
        currentName={user.email}
        onBack={() => { setActiveLead(null); loadLeads(); }}
      />
    </div>
  );

  const STATUS_COLOR = { new:'#c9a96e', responded:'#3a7a5a', closed:'#a8a8a8' };
  const STATUS_BG    = { new:'rgba(201,169,110,0.1)', responded:'rgba(58,122,90,0.1)', closed:'rgba(168,168,168,0.1)' };
  const newLeadsCount = leads.filter(l => l.status === 'new').length;
  const filteredVendorLeads = leads.filter(l => {
    if(leadsStatusFilter==='active') return l.status!=='closed';
    return l.status===leadsStatusFilter;
  });

  // ── Main dashboard ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'var(--cream)', width:'100%', boxSizing:'border-box' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background:'var(--white)', borderBottom:'1px solid var(--parchment)', padding:'12px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.2rem', fontWeight:400, color:'var(--forest)' }}>Vendor Dashboard</div>
            <div style={{ color:'var(--light)', fontSize:'0.7rem', marginTop:1 }}>{user.email}</div>
          </div>
          <div style={{ display:'flex', gap:7, flexShrink:0 }}>
            <button onClick={() => setEditing('new')} style={{ background:'var(--rose)', color:'var(--white)', border:'none', borderRadius:8, padding:'8px 13px', fontSize:'0.78rem', fontWeight:500, cursor:'pointer' }}>
              + Add
            </button>
            <button onClick={onLogout} style={{ background:'var(--parchment)', color:'var(--mid)', border:'none', borderRadius:8, padding:'8px 12px', fontSize:'0.78rem', cursor:'pointer' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── Content — single column, scrollable ─────────────────────────── */}
      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:12, width:'100%', boxSizing:'border-box' }}>

        {/* ── My Vendor Profile ─────────────────────────────────────────── */}
        <Card>
          <CardHeader title="My Profile" icon={IC.settings(15,'var(--forest)')}/>
          <div style={{ padding:'12px' }}>
            {loading ? (
              <div style={{ textAlign:'center', padding:'24px', color:'var(--light)' }}>Loading…</div>
            ) : myVendors.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 12px' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>{IC.flower(32,'#f0e8dc')}</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1.1rem', color:'var(--forest)', marginBottom:6 }}>No profiles yet</div>
                <p style={{ color:'var(--mid)', fontSize:'0.82rem', marginBottom:12 }}>Create your first profile to appear in searches.</p>
                <button onClick={() => setEditing('new')} style={{ background:'var(--forest)', color:'var(--gold-light)', border:'none', borderRadius:8, padding:'9px 18px', fontSize:'0.82rem', cursor:'pointer' }}>Create profile</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {myVendors.map(v => (
                  <div key={v.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px', borderRadius:10, border:'1.5px solid var(--parchment)', background:'var(--cream)' }}>
                    <div style={{ width:42, height:42, borderRadius:8, flexShrink:0, background: v.images?.[0]?.url ? `url(${v.images[0].url}) center/cover` : `linear-gradient(135deg,${v.color||'#c8a87a'}dd,${v.color||'#c8a87a'}66)` }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'0.95rem', fontWeight:600, color:'var(--forest)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.name}</div>
                      <div style={{ fontSize:'0.72rem', color:'var(--mid)', marginTop:1 }}>{v.type}</div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      <button onClick={e => { e.stopPropagation(); startEdit(v); }} style={{ background:'var(--forest)', color:'var(--gold-light)', border:'none', borderRadius:7, padding:'7px 11px', fontSize:'0.74rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                        {IC.edit(12,'var(--gold-light)')} Edit
                      </button>
                      {confirmDeleteId === v.id ? (
                        <div style={{display:'flex',gap:4,flexShrink:0}}>
                          <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}}
                            style={{background:'#b85a45',color:'white',border:'none',borderRadius:7,padding:'7px 10px',fontSize:'0.72rem',cursor:'pointer',fontWeight:500}}>
                            Confirm
                          </button>
                          <button onClick={e=>{e.stopPropagation();setConfirmDeleteId(null);}}
                            style={{background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:7,padding:'7px 8px',fontSize:'0.72rem',cursor:'pointer'}}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(v.id); }} style={{ background:'#fce8e4', color:'#b85a45', border:'none', borderRadius:7, padding:'7px 9px', fontSize:'0.74rem', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                          {IC.trash(12,'#b85a45')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── Leads ─────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader
            title={<>Leads {newLeadsCount > 0 && <span style={{ marginLeft:6, background:'var(--rose)', color:'white', borderRadius:999, fontSize:'0.62rem', padding:'2px 7px', fontWeight:600 }}>{newLeadsCount}</span>}</>}
            icon={IC.chat(15,'var(--forest)')}
            right={<button onClick={loadLeads} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem', color:'var(--mid)', padding:'4px 8px' }}>↻</button>}
          />
          <div style={{display:'flex',gap:4,padding:'6px 12px 2px',flexWrap:'wrap'}}>
            {[['active','Active'],['new','New'],['responded','Responded'],['closed','Closed']].map(([val,label])=>(
              <button key={val} onClick={()=>setLeadsStatusFilter(val)}
                style={{background:leadsStatusFilter===val?'var(--forest)':'var(--parchment)',color:leadsStatusFilter===val?'var(--gold-light)':'var(--mid)',border:'none',borderRadius:999,padding:'3px 9px',fontSize:'0.65rem',fontWeight:600,cursor:'pointer'}}>
                {label}{val==='new'&&newLeadsCount>0?` (${newLeadsCount})`:''}
              </button>
            ))}
          </div>
          <div style={{ padding:'10px 12px' }}>
            {leadsLoading ? (
              <div style={{ textAlign:'center', padding:'20px', color:'var(--light)' }}>Loading…</div>
) : filteredVendorLeads.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 12px' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>{IC.chat(28,'#f0e8dc')}</div>
                <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'1rem', color:'var(--forest)', marginBottom:4 }}>No leads yet</div>
                <p style={{ color:'var(--mid)', fontSize:'0.78rem' }}>Quote requests from customers will appear here.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                {filteredVendorLeads.map(lead => (
                  <div key={lead.id} onClick={() => setActiveLead(lead)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 11px', borderRadius:10, border:'1.5px solid var(--parchment)', cursor:'pointer', background:'var(--cream)' }}>
                    <div style={{ width:32, height:32, borderRadius:7, background: STATUS_BG[lead.status] || STATUS_BG.new, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {lead.status === 'responded' ? IC.chat(13,'#3a7a5a') : lead.status === 'closed' ? IC.check(13,'#a8a8a8') : IC.chat(13,'#c9a96e')}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'0.84rem', fontWeight:600, color:'var(--forest)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.title}</div>
                      <div style={{ fontSize:'0.7rem', color:'var(--mid)', marginTop:1 }}>{lead.customer_name}</div>
                      {lead.last_message && <div style={{ fontSize:'0.68rem', color:'var(--light)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.last_message.message_text || 'Attachment'}</div>}
                    </div>
                    <div style={{ flexShrink:0 }}>
                      <span style={{ background: STATUS_BG[lead.status] || STATUS_BG.new, color: STATUS_COLOR[lead.status] || STATUS_COLOR.new, borderRadius:999, fontSize:'0.6rem', padding:'2px 7px', fontWeight:600, textTransform:'uppercase' }}>{lead.status || 'new'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ── Availability Calendar ─────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Availability"
            icon={IC.calendar(15,'var(--forest)')}
            right={myVendors.length > 1 && (
              <select value={activeVendorForCal?.id || ''} onChange={e => { const v = myVendors.find(x => x.id === e.target.value); if (v) selectVendorForCal(v); }}
                style={{ fontSize:'0.72rem', border:'1px solid var(--parchment)', borderRadius:6, padding:'4px 7px', background:'var(--cream)', color:'var(--charcoal)', cursor:'pointer' }}>
                {myVendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
          />
          <div style={{ padding:'12px' }}>
            {myVendors.length === 0 ? (
              <div style={{ textAlign:'center', padding:'16px', color:'var(--light)', fontSize:'0.82rem' }}>Create a vendor profile first.</div>
            ) : (
              <>
                {activeVendorForCal && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'7px 9px', background:'var(--cream)', borderRadius:8 }}>
                    <div style={{ width:28, height:28, borderRadius:6, flexShrink:0, background: activeVendorForCal.images?.[0]?.url ? `url(${activeVendorForCal.images[0].url}) center/cover` : `linear-gradient(135deg,${activeVendorForCal.color||'#c8a87a'}dd,${activeVendorForCal.color||'#c8a87a'}66)` }}/>
                    <div style={{ fontSize:'0.8rem', fontWeight:500, color:'var(--forest)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeVendorForCal.name}</div>
                    <div style={{ fontSize:'0.7rem', color:'var(--rose)', fontWeight:500, flexShrink:0 }}>{unavailDates.size} blocked</div>
                  </div>
                )}
                <p style={{ fontSize:'0.72rem', color:'var(--mid)', marginBottom:8 }}>Tap a date to block / unblock it.</p>
                {/* Full-width fluid calendar */}
                <div style={{ width:'100%', boxSizing:'border-box', overflowX:'hidden' }}>
                  <Calendar year={cal1Y} month={cal1M} unavailDates={unavailDates} editable onToggle={toggleUnavail}
                    onPrev={() => { let m=cal1M-1, y=cal1Y; if(m<0){m=11;y--;} setCal1M(m); setCal1Y(y); }}
                    onNext={() => { let m=cal1M+1, y=cal1Y; if(m>11){m=0;y++;} setCal1M(m); setCal1Y(y); }}/>
                </div>
                <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:10 }}>
                  <button onClick={saveAvailability} disabled={calSaving} style={{ flex:1, background:'var(--rose)', color:'var(--white)', border:'none', borderRadius:8, padding:'10px', fontSize:'0.84rem', fontWeight:500, cursor: calSaving ? 'wait' : 'pointer' }}>
                    {calSaving ? 'Saving…' : 'Save Availability'}
                  </button>
                  {calSaved && <span style={{ fontSize:'0.78rem', color:'var(--forest)', fontWeight:500, display:'flex', alignItems:'center', gap:4 }}>{IC.check(12,'var(--forest)')} Saved</span>}
                </div>
              </>
            )}
          </div>
        </Card>

        <div style={{ height:20 }}/>
      </div>
    </div>
  );
}

export default VendorDashboard;
export { VendorDashboard };
