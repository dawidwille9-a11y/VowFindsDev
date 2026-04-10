import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { supaFetch, getBatchDistancesKm, supabase } from './api.js';
import { loadSession, saveSession, clearSession } from './session.js';
import { useIsMobile } from './hooks.js';
import EmailVerified from './components/modals/EmailVerified.jsx';
import GlobalStyles from './styles.jsx';
import LegalPage from './components/features/LegalPage.jsx';
import CustomerAuthModal from './components/modals/CustomerAuthModal.jsx';
import LoginModal from './components/modals/LoginModal.jsx';
import QuoteModal from './components/modals/QuoteModal.jsx';
import CustomerDashboard from './components/customer/CustomerDashboard.jsx';
import CustomerBrowseView from './components/customer/CustomerBrowseView.jsx';
import FavouritesView from './components/customer/FavouritesView.jsx';
import VendorDashboard from './components/vendor/VendorDashboard.jsx';
import AdminDashboard from './components/features/AdminDashboard.jsx';
import WeddingPlan from './components/features/WeddingPlan.jsx';
import ScenarioBuilder from './components/features/ScenarioBuilder.jsx';
import MobileApp from './components/mobile/MobileApp.jsx';
import { IC } from './icons.jsx';
import { ALL_TYPES } from './constants.js';
import VendorLane, { VendorGrid } from './components/vendor/VendorLane.jsx';
import VendorDetail from './components/vendor/VendorDetail.jsx';
import VendorsMap from './components/maps/VendorsMap.jsx';
import VenueAutocomplete from './components/maps/VenueAutocomplete.jsx';
import DateRangePicker from './components/calendar/DateRangePicker.jsx';
import { VendorIcon } from './icons.jsx';
import { formatDateDisplay, avg } from './utils.js';



// ── Password Reset Screen ─────────────────────────────────────────────────────
// Shown when user clicks the reset link in their email (URL has ?reset=1)
function PasswordResetScreen() {
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [error, setError] = React.useState('');
  const [show, setShow] = React.useState(false);

  async function handleReset(e) {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    setLoading('Updating password…');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess('Password updated! You can now log in with your new password.');
      setTimeout(() => { window.location.href = window.location.origin; }, 3000);
    } catch(err) { setError(err.message); }
    setLoading('');
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--cream)',fontFamily:"'DM Sans',sans-serif",padding:24}}>
      <GlobalStyles/>
      <div style={{background:'var(--white)',borderRadius:20,padding:'48px 40px',maxWidth:420,width:'100%',boxShadow:'0 24px 80px rgba(0,0,0,0.12)'}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',fontWeight:300,color:'var(--forest)',marginBottom:32,letterSpacing:'0.06em',textAlign:'center'}}>
          Vow<span style={{color:'var(--rose)',fontStyle:'italic'}}>Finds</span>
        </div>
        {success ? (
          <>
            <div style={{fontSize:'2.5rem',textAlign:'center',marginBottom:16}}>✅</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',textAlign:'center',marginBottom:8}}>Password updated!</div>
            <p style={{color:'var(--mid)',fontSize:'0.86rem',textAlign:'center'}}>Redirecting you to the site…</p>
          </>
        ) : (
          <>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',color:'var(--forest)',marginBottom:4}}>Set new password</div>
            <p style={{fontSize:'0.78rem',color:'var(--light)',marginBottom:22}}>Choose a strong password for your account.</p>
            <form onSubmit={handleReset}>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:'0.74rem',fontWeight:500,color:'var(--mid)',marginBottom:4,display:'block'}}>New Password</label>
                <div style={{position:'relative'}}>
                  <input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                    style={{width:'100%',border:'1.5px solid var(--parchment)',borderRadius:9,padding:'10px 42px 10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',boxSizing:'border-box'}}
                    placeholder="••••••••" required autoFocus/>
                  <button type="button" onClick={()=>setShow(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--light)',fontSize:'0.75rem'}}>
                    {show?'Hide':'Show'}
                  </button>
                </div>
                <PasswordStrength password={password}/>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:'0.74rem',fontWeight:500,color:'var(--mid)',marginBottom:4,display:'block'}}>Confirm Password</label>
                <input type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)}
                  style={{width:'100%',border:`1.5px solid ${confirm&&confirm!==password?'var(--rose)':'var(--parchment)'}`,borderRadius:9,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none'}}
                  placeholder="••••••••" required/>
                {confirm&&confirm!==password&&<div style={{fontSize:'0.72rem',color:'var(--rose)',marginTop:4}}>Passwords do not match</div>}
              </div>
              {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}
              <button type="submit" disabled={!!loading} style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:loading?'wait':'pointer'}}>
                {loading||'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function validatePassword(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character.';
  return null;
}

function PasswordStrength({password}) {
  if (!password) return null;
  const checks = [{label:'8+ chars',ok:password.length>=8},{label:'Uppercase',ok:/[A-Z]/.test(password)},{label:'Lowercase',ok:/[a-z]/.test(password)},{label:'Special char',ok:/[^A-Za-z0-9]/.test(password)}];
  const passed=checks.filter(c=>c.ok).length;
  const color=passed<=1?'#c4826a':passed<=2?'#c9a96e':passed===3?'#8faa6a':'#3a7a5a';
  return(
    <div style={{marginTop:4,marginBottom:8}}>
      <div style={{display:'flex',gap:4,marginBottom:4}}>{checks.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<passed?color:'var(--parchment)',transition:'background 0.2s'}}/>)}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'4px 10px'}}>{checks.map(c=><span key={c.label} style={{fontSize:'0.67rem',color:c.ok?'#3a7a5a':'var(--light)',display:'flex',alignItems:'center',gap:2}}><span>{c.ok?'✓':'○'}</span>{c.label}</span>)}</div>
    </div>
  );
}

export default function VowFinds() {
  const isMobile=useIsMobile();

  // Handle password reset redirect (?reset=1 in URL with access_token in hash)
  const paymentResult = new URLSearchParams(window.location.search).get('payment');
  const isPasswordReset = window.location.search.includes('reset=1') || 
    (window.location.hash.includes('access_token') && window.location.hash.includes('type=recovery'));
  if (isPasswordReset) return <PasswordResetScreen/>;

  // Handle Supabase email verification redirect
  // Supabase appends #access_token=...&type=signup to the URL after user clicks verify link
  const isEmailVerification = window.location.hash.includes('access_token') &&
    window.location.hash.includes('type=signup');
    // Note: type=recovery is handled by PasswordResetScreen above
  if (isEmailVerification) {
    return (
      <>
        <GlobalStyles/>
        <EmailVerified onVerified={() => {
          window.location.hash = '';
          window.location.reload();
        }}/>
      </>
    );
  }

  const [view,setView]=useState('customer');
  const [venue,setVenue]=useState('');
  const [venueLatLng,setVenueLatLng]=useState(null);
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [selectedTypes,setSelectedTypes]=useState(new Set());
  const [searched,setSearched]=useState(false);
  const [vendors,setVendors]=useState([]);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [calcProgress,setCalcProgress]=useState('');
  const [activeVendor,setActiveVendor]=useState(null);
  const [prevScroll,setPrevScroll]=useState(0);
  const [showMap,setShowMap]=useState(false);
  const [user,setUser]=useState(null);

  // Load session on mount — must be after all useState declarations
  useEffect(()=>{
    const saved = loadSession();
    if(saved) setUser(saved);
  },[]);
  const [showLoginModal,setShowLoginModal]=useState(false);
  const [showCustomerAuth,setShowCustomerAuth]=useState(false);
  const [quoteVendor,setQuoteVendor]=useState(null);
  const [pendingQuoteVendor,setPendingQuoteVendor]=useState(null);
  const [customerView,setCustomerView]=useState('browse'); // 'browse' | 'dashboard' | 'favourites' | 'scenario' | 'weddingplan'
  const [newLeadAfterQuote,setNewLeadAfterQuote]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [showScenario,setShowScenario]=useState(false);
  const [showLegal,setShowLegal]=useState(null); // null | 'terms' | 'privacy'

  // Show legal page when requested — must be after all useState declarations
  const [showWeddingPlan,setShowWeddingPlan]=useState(false);
  const [planMaxPrices,setPlanMaxPrices]=useState(null); // set by WeddingPlan search
  const [fromPlan,setFromPlan]=useState(false); // show "back to plan" banner
  const resultsRef=useRef(null);

  function handleLogin(u){
    setUser(u);
    saveSession(u);
    if(u.role==='customer'&&pendingQuoteVendor){setQuoteVendor(pendingQuoteVendor);setPendingQuoteVendor(null);}
  }
  function handleLogout(){setUser(null);clearSession();setView('customer');setCustomerView('browse');setMenuOpen(false);}

  function requestQuote(vendor){
    if(user&&user.role==='customer'){setQuoteVendor(vendor);}
    else{setPendingQuoteVendor(vendor);setShowCustomerAuth(true);}
  }

  // If logged in, show dashboard
  if(user&&user.role==='admin')return(
    <>
      <GlobalStyles/>
      <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',height:60,position:'sticky',top:0,zIndex:200}}>
        <div onClick={()=>handleLogout()} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em',cursor:'pointer'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
        <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.6)'}}>Admin Panel</span>
      </nav>
      <AdminDashboard onLogout={handleLogout}/>
    </>
  );

  if(user&&user.role==='vendor')return(
    <>
      <GlobalStyles/>
      <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',height:60,position:'sticky',top:0,zIndex:200}}>
        <div onClick={()=>handleLogout()} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em',cursor:'pointer'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
        <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.6)'}}>Vendor Portal</span>
      </nav>
      <VendorDashboard user={user} onLogout={handleLogout}/>
    </>
  );

  // ── Mobile: render separate mobile UI ────────────────────────────────────────
  if(isMobile&&(!user||user.role==='customer')){
    return(
      <>
        <GlobalStyles/>
        <style>{`
          html,body,#root{
            background:#f8f6f3 !important;
            color:#1c2b22 !important;
            color-scheme:light only !important;
          }
        `}</style>
        <MobileApp
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        requestQuote={requestQuote}
        quoteVendor={quoteVendor}
        setQuoteVendor={setQuoteVendor}
        newLeadAfterQuote={newLeadAfterQuote}
        setNewLeadAfterQuote={setNewLeadAfterQuote}
      />
      </>
    );
  }

  if(user&&user.role==='customer'){
    // After submitting a quote, go straight to dashboard with that lead open
    function handleQuoteSubmitted(lead){
      setQuoteVendor(null);
      setNewLeadAfterQuote(lead);
      setCustomerView('dashboard');
    }
    return(
      <>
        <GlobalStyles/>
        {quoteVendor&&<QuoteModal vendor={quoteVendor} customer={user} onClose={()=>setQuoteVendor(null)} onSubmitted={handleQuoteSubmitted}/>}

        {/* Customer nav */}
        <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',height:56,position:'sticky',top:0,zIndex:200,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* Hamburger */}
            <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',display:'flex',flexDirection:'column',gap:4}}>
              <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
              <div style={{width:14,height:2,background:'var(--gold-light)',borderRadius:2}}/>
              <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
            </button>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.06em'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {customerView==='dashboard'&&(
              <button onClick={()=>{setCustomerView('browse');setNewLeadAfterQuote(null);}} style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:'rgba(255,255,255,0.8)',cursor:'pointer'}}>
                ‹ Browse
              </button>
            )}
            {(customerView==='browse'||customerView==='dashboard')&&(
              <button onClick={()=>setCustomerView(v=>v==='browse'?'dashboard':'browse')}
                style={{background:customerView!=='browse'?'rgba(255,255,255,0.15)':'rgba(201,169,110,0.2)',border:`1px solid ${customerView!=='browse'?'rgba(255,255,255,0.25)':'rgba(201,169,110,0.4)'}`,borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:customerView!=='browse'?'rgba(255,255,255,0.9)':'var(--gold-light)',cursor:'pointer'}}>
                {customerView==='browse'?'My Quotes':'Browse'}
              </button>
            )}
            <span style={{fontSize:'0.74rem',color:'rgba(255,255,255,0.5)'}}>Hi, {user.name}</span>
          </div>
        </nav>

        {/* Payment result banner */}
      {paymentResult==='success'&&(
        <div style={{background:'var(--forest)',color:'var(--gold-light)',padding:'10px 20px',textAlign:'center',fontSize:'0.84rem',fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          ✓ Payment successful! Your listing is now active.
          <button onClick={()=>window.history.replaceState({},'',window.location.pathname)} style={{background:'none',border:'none',color:'var(--gold-light)',cursor:'pointer',fontSize:'0.8rem',textDecoration:'underline'}}>Dismiss</button>
        </div>
      )}
      {paymentResult==='cancelled'&&(
        <div style={{background:'rgba(196,130,106,0.12)',color:'var(--rose)',padding:'10px 20px',textAlign:'center',fontSize:'0.84rem',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          Payment was cancelled. You can subscribe anytime from your dashboard.
          <button onClick={()=>window.history.replaceState({},'',window.location.pathname)} style={{background:'none',border:'none',color:'var(--rose)',cursor:'pointer',fontSize:'0.8rem',textDecoration:'underline'}}>Dismiss</button>
        </div>
      )}

      {/* Dropdown menu */}
        {menuOpen&&(
          <>
            <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:198}}/>
            <div style={{position:'fixed',top:56,left:0,width:220,background:'var(--white)',boxShadow:'4px 0 20px rgba(0,0,0,0.12)',zIndex:199,borderRight:'1px solid var(--parchment)',padding:'8px 0'}}>
              {[
                {label:'Wedding Plan',action:()=>{setCustomerView('weddingplan');setMenuOpen(false);}},
                {label:'Browse Vendors',action:()=>{setCustomerView('browse');setMenuOpen(false);}},
                {label:'Favourites',action:()=>{setCustomerView('favourites');setMenuOpen(false);}},
                {label:'Scenario Builder',action:()=>{setCustomerView('scenario');setMenuOpen(false);}},
                {label:'My Quotes',action:()=>{setCustomerView('dashboard');setMenuOpen(false);}},
                {label:'Sign Out',action:()=>{handleLogout();setMenuOpen(false);}},
              ].map(item=>(
                <button key={item.label} onClick={item.action} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 20px',background:'none',border:'none',fontSize:'0.88rem',color:'var(--charcoal)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {customerView==='dashboard'?(
          <CustomerDashboard user={user} onLogout={handleLogout} onBrowse={()=>setCustomerView('browse')} initialLead={newLeadAfterQuote}/>
        ):customerView==='favourites'?(
          <FavouritesView customerId={user?.customerId} onOpenDetail={(v,ll,vn)=>{setActiveVendor(v);if(ll)setVenueLatLng(ll);if(vn)setVenue(vn);setView('detail');setCustomerView('browse');}} onRequestQuote={requestQuote} dateFrom={dateFrom} dateTo={dateTo} venueLatLng={venueLatLng} venue={venue}/>
        ):customerView==='weddingplan'?(
          <WeddingPlan vendors={vendors} onClose={()=>setCustomerView('browse')}
            onSearchVendors={({venueName,venueLL,type,maxPrice})=>{
              const newVenue=venueName||venue;
              const newLL=venueLL||venueLatLng;
              setVenue(newVenue);
              if(newLL)setVenueLatLng(newLL);
              setSelectedTypes(new Set([type]));
              if(maxPrice!==null)setPlanMaxPrices(prev=>({...(prev||{}),[type]:maxPrice}));
              setSearched(true);
              setFromPlan(true);
              setCustomerView('browse');
              // Trigger a fresh vendor load so results show immediately
              if(newVenue.trim()){
                setLoading(true);setLoadError('');setCalcProgress('');
                supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=type,name')
                  .then(async data=>{
                    if(newLL){
                      setCalcProgress('Calculating distances…');
                      const kms=await getBatchDistancesKm(newLL,data);
                      setVendors(data.map((v,i)=>({...v,distance_km:kms[i]||0})));
                    }else setVendors(data);
                    setCalcProgress('');
                  }).catch(e=>setLoadError('Could not load vendors: '+e.message))
                  .finally(()=>setLoading(false));
              }
            }}
          />
        ):customerView==='scenario'?(
          <ScenarioBuilder user={user} vendors={vendors} onClose={()=>setCustomerView('browse')}/>
        ):(
          /* Customer browse view */
          <div>
            {view==='detail'&&activeVendor?(
              <div>
                <div style={{padding:'12px 20px',background:'var(--cream)',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>setView('customer')} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontSize:'0.82rem',color:'var(--mid)',padding:0}}>‹ Back to results</button>
                </div>
                <VendorDetail vendor={activeVendor} dateFrom={dateFrom} dateTo={dateTo} venueLabel={venue} venueLatLng={venueLatLng} onBack={()=>setView('customer')} onRequestQuote={requestQuote}/>
              </div>
            ):(
              <CustomerBrowseView
                user={user}
                venue={venue} setVenue={setVenue}
                venueLatLng={venueLatLng} setVenueLatLng={setVenueLatLng}
                dateFrom={dateFrom} setDateFrom={setDateFrom}
                dateTo={dateTo} setDateTo={setDateTo}
                selectedTypes={selectedTypes} setSelectedTypes={setSelectedTypes}
                vendors={vendors} setVendors={setVendors}
                loading={loading} setLoading={setLoading}
                loadError={loadError} setLoadError={setLoadError}
                calcProgress={calcProgress} setCalcProgress={setCalcProgress}
                searched={searched} setSearched={setSearched}
                fromPlan={fromPlan} onReturnToPlan={()=>{setFromPlan(false);setCustomerView('weddingplan');}}
                showMap={showMap} setShowMap={setShowMap}
                openDetail={(v)=>{setPrevScroll(0);setActiveVendor(v);setView('detail');window.scrollTo({top:0});}}
                onRequestQuote={requestQuote}
                planMaxPrices={planMaxPrices}
              />
            )}
          </div>
        )}
      </>
    );
  }

  // Public browse view
  const toggleType=(type)=>{if(type==='all'){setSelectedTypes(prev=>prev.size===ALL_TYPES.length?new Set():new Set(ALL_TYPES));}else{setSelectedTypes(prev=>{const next=new Set(prev);next.has(type)?next.delete(type):next.add(type);return next;});}};

  async function loadVendors(latLng){
    setLoading(true);setLoadError('');setCalcProgress('');
    try{
      const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=type,name');
      if(latLng){
        setCalcProgress('Calculating distances…');
        try{
          const kms=await getBatchDistancesKm(latLng,data);
          const updated=data.map((v,i)=>({...v,distance_km:kms[i]||0}));
          setVendors(updated);
        }catch{setVendors(data);}
      }
      else setVendors(data);
      setCalcProgress('');
      setTimeout(()=>resultsRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),150);
    }catch(e){setLoadError('Could not load vendors: '+e.message);}
    setLoading(false);
  }

  function search(){setSearched(true);loadVendors(venueLatLng);}
  function openDetail(v){setPrevScroll(window.scrollY);setActiveVendor(v);setView('detail');window.scrollTo({top:0,behavior:'smooth'});}
  function goBack(){setView('customer');setTimeout(()=>window.scrollTo({top:prevScroll,behavior:'smooth'}),50);}

  // When nothing selected treat as all selected (no filter applied)
  const activeTypes=selectedTypes.size===0?ALL_TYPES:ALL_TYPES.filter(t=>selectedTypes.has(t));
  const vendorsByType={};activeTypes.forEach(t=>{vendorsByType[t]=vendors.filter(v=>v.type===t);});
  const vendorsWithLoc=vendors.filter(v=>v.lat&&v.lng);

  return(
    <>
      <GlobalStyles/>
      {showLegal&&<LegalPage initialTab={showLegal} onClose={()=>setShowLegal(null)}/>}
      {showScenario&&<div style={{position:'fixed',inset:0,zIndex:500,background:'var(--cream)',overflowY:'auto'}}><ScenarioBuilder user={null} vendors={vendors} onClose={()=>setShowScenario(false)}/></div>}
      {showWeddingPlan&&<div style={{position:'fixed',inset:0,zIndex:500,background:'var(--cream)',overflowY:'auto'}}><WeddingPlan vendors={vendors} onClose={()=>setShowWeddingPlan(false)}
          onSearchVendors={({venueName,venueLL,type,maxPrice})=>{
            const newVenue=venueName||venue;
            const newLL=venueLL||venueLatLng;
            setVenue(newVenue);
            if(newLL)setVenueLatLng(newLL);
            setSelectedTypes(new Set([type]));
            if(maxPrice!==null)setPlanMaxPrices(prev=>({...(prev||{}),[type]:maxPrice}));
            setSearched(true);
            setFromPlan(true);
            setShowWeddingPlan(false);
            if(newVenue.trim()){
              setLoading(true);setLoadError('');setCalcProgress('');
              supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=type,name')
                .then(async data=>{
                  if(newLL){
                    setCalcProgress('Calculating distances…');
                    const kms=await getBatchDistancesKm(newLL,data);
                    setVendors(data.map((v,i)=>({...v,distance_km:kms[i]||0})));
                  }else setVendors(data);
                  setCalcProgress('');
                }).catch(e=>setLoadError('Could not load vendors: '+e.message))
                .finally(()=>setLoading(false));
            }
          }}
        /></div>}
      {showLoginModal && <LoginModal onLogin={handleLogin} onClose={()=>setShowLoginModal(false)}/>}
      {showCustomerAuth && <CustomerAuthModal onLogin={handleLogin} onClose={()=>{setShowCustomerAuth(false);setPendingQuoteVendor(null);}} redirectVendor={pendingQuoteVendor} onVendorLogin={()=>{setShowCustomerAuth(false);setShowLoginModal(true);}}/>}
      {quoteVendor && user?.role==='customer' && <QuoteModal vendor={quoteVendor} customer={user} onClose={()=>setQuoteVendor(null)} onSubmitted={()=>setQuoteVendor(null)}/>}
      <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',height:56,position:'sticky',top:0,zIndex:200,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',display:'flex',flexDirection:'column',gap:4}}>
            <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
            <div style={{width:14,height:2,background:'var(--gold-light)',borderRadius:2}}/>
            <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
          </button>
          <div onClick={()=>setView('customer')} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em',cursor:'pointer'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {view==='detail'&&<button onClick={goBack} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:'rgba(255,255,255,0.8)',cursor:'pointer'}}>‹ Back</button>}
          <button className="vf-nav-login-btns" onClick={()=>setShowCustomerAuth(true)} style={{background:'none',border:'1px solid rgba(255,255,255,0.2)',borderRadius:6,color:'rgba(255,255,255,0.6)',fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',padding:'5px 12px',cursor:'pointer'}}>Login</button>

        </div>
      </nav>
      {/* Public hamburger menu */}
      {menuOpen&&(
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:198}}/>
          <div style={{position:'fixed',top:56,left:0,width:220,background:'var(--white)',boxShadow:'4px 0 20px rgba(0,0,0,0.12)',zIndex:199,borderRight:'1px solid var(--parchment)',padding:'8px 0'}}>
            {[
              {label:'Wedding Plan',action:()=>{setShowWeddingPlan(true);setMenuOpen(false);}},
              {label:'Browse Vendors',action:()=>{setView('customer');setMenuOpen(false);}},
              {label:'Scenario Builder',action:()=>{setShowScenario(true);setMenuOpen(false);}},
              {label:'Login',action:()=>{setShowCustomerAuth(true);setMenuOpen(false);}},

            ].map(item=>(
              <button key={item.label} onClick={item.action} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 20px',background:'none',border:'none',fontSize:'0.88rem',color:'var(--charcoal)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {view==='detail'&&activeVendor?(
        <VendorDetail vendor={activeVendor} dateFrom={dateFrom} dateTo={dateTo} venueLabel={venue} venueLatLng={venueLatLng} onBack={goBack} onRequestQuote={requestQuote}/>
      ):(
        <div>
          {/* Public Hero */}
          <div style={{
            background:'linear-gradient(160deg,var(--forest) 0%,#2a3830 60%,#1e2820 100%)',
            position:'relative',overflow:'hidden',
            padding:'52px 24px 48px',
            display:'flex',flexDirection:'column',alignItems:'center',
          }} className="vf-hero-padding">
            {/* Decorative background glow */}
            <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 50% at 50% 100%,rgba(201,169,110,0.1) 0%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',top:-120,right:-120,width:400,height:400,borderRadius:'50%',background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',bottom:-80,left:-80,width:280,height:280,borderRadius:'50%',background:'rgba(201,169,110,0.05)',pointerEvents:'none'}}/>

            {/* Eyebrow */}
            <div style={{fontSize:'0.7rem',letterSpacing:'0.25em',textTransform:'uppercase',color:'var(--gold)',marginBottom:10,position:'relative',zIndex:2}}>Your wedding, your way</div>

            {/* Headline */}
            <h1 className="vf-hero-headline" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.6rem)',fontWeight:300,color:'var(--cream)',lineHeight:1.15,marginBottom:8,textAlign:'center',position:'relative',zIndex:2}}>
              Find the <em style={{fontStyle:'italic',color:'var(--blush)'}}>perfect</em> vendors for your special day
            </h1>
            <p className="vf-hero-sub" style={{color:'rgba(250,246,241,0.5)',fontSize:'0.9rem',fontWeight:300,lineHeight:1.6,marginBottom:32,textAlign:'center',maxWidth:500,position:'relative',zIndex:2}}>
              Enter your venue and wedding window — we'll show real availability and travel costs.
            </p>

            {/* ── Main search box ── */}
            <div className="vf-search-box" style={{background:'var(--white)',borderRadius:20,padding:'28px 32px',width:'100%',maxWidth:780,boxShadow:'0 16px 60px rgba(0,0,0,0.28)',position:'relative',zIndex:10,marginBottom:16}}>
              <div className="vf-search-grid" style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:14,marginBottom:16,alignItems:'end'}}>
                {/* Venue */}
                <div>
                  <label style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:5,display:'block'}}>Venue Location</label>
                  <VenueAutocomplete
                    value={venue} onChange={setVenue}
                    onPlaceSelected={(ll,name)=>{setVenueLatLng(ll);setVenue(name);}}
                    placeholder="e.g. Babylonstoren (optional)"
                    style={{border:'1.5px solid var(--parchment)',borderRadius:9,padding:'11px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}
                  />

                </div>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}/>
              </div>

              {/* Search button */}
              <button onClick={search} style={{
                background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,
                padding:'13px 28px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.95rem',fontWeight:500,
                letterSpacing:'0.06em',cursor:'pointer',width:'100%',
                transition:'background 0.2s',
              }}>
                {loading?(calcProgress||'Loading vendors…'):'Search Vendors'}
              </button>
              {/* Mobile login hint */}
              <div className="vf-mobile-only" style={{textAlign:'center',marginTop:14,paddingTop:14,borderTop:'1px solid var(--parchment)',display:'flex',gap:8,justifyContent:'center'}}>
                <button onClick={()=>setShowCustomerAuth(true)} style={{flex:1,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px',fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>Login</button>

              </div>
            </div>

            {/* ── Category filter ── */}
            <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:780}}>
              {/* Header row: label on left, Select All on right */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:'0.68rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)'}}>Filter by category</span>
                <button
                  onClick={()=>toggleType('all')}
                  style={{
                    background:'none',border:'none',cursor:'pointer',padding:'4px 10px',
                    fontSize:'0.78rem',fontFamily:"'DM Sans',sans-serif",
                    color:selectedTypes.size===ALL_TYPES.length?'var(--gold)':'rgba(255,255,255,0.45)',
                    fontWeight:selectedTypes.size===ALL_TYPES.length?600:400,
                    letterSpacing:'0.04em',
                    textDecoration:selectedTypes.size===ALL_TYPES.length?'none':'underline',
                    textUnderlineOffset:'3px',
                    transition:'color 0.15s',
                  }}
                >
                  {selectedTypes.size===ALL_TYPES.length?'All selected':'Select all'}
                </button>
              </div>

              {/* Category pills box */}
              <div className="vf-filter-box" style={{
                background:'rgba(255,255,255,0.06)',
                border:'1px solid rgba(255,255,255,0.13)',
                borderRadius:14,
                padding:'12px 14px',
                backdropFilter:'blur(8px)',
                display:'flex',flexWrap:'wrap',gap:8,
                alignItems:'center',
                justifyContent:'center',
              }}>
                {ALL_TYPES.map(t=>{
                  const active=selectedTypes.has(t);
                  return (
                    <div
                      key={t}
                      onClick={()=>toggleType(t)}
                      style={{
                        display:'flex',alignItems:'center',gap:6,
                        padding:'6px 13px',borderRadius:999,cursor:'pointer',userSelect:'none',
                        background:active?'rgba(196,130,106,0.28)':'rgba(255,255,255,0.06)',
                        border:`1.5px solid ${active?'rgba(196,130,106,0.65)':'rgba(255,255,255,0.15)'}`,
                        transition:'all 0.15s',
                      }}
                    >
                      <span style={{display:'flex',alignItems:'center',gap:6,color:active?'var(--cream)':'rgba(255,255,255,0.6)',fontWeight:active?500:400,whiteSpace:'nowrap'}}><VendorIcon type={t} size={14} color={active?'var(--cream)':'rgba(255,255,255,0.6)'}/>{t}</span>
                    </div>
                  );
                })}
              </div>

              {/* Selection count hint */}
              {selectedTypes.size>0&&selectedTypes.size<ALL_TYPES.length&&(
                <div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.35)'}}>
                  {selectedTypes.size} of {ALL_TYPES.length} categories selected
                </div>
              )}
              {selectedTypes.size===0&&(
                <div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.3)'}}>
                  No filter — all vendors will show
                </div>
              )}
            </div>

          </div>

          {/* Results */}
          {searched&&(
            <div ref={resultsRef} className="vf-results-section" style={{padding:'48px 0 60px',background:'#ffffff'}}>
              <div style={{padding:'0 32px 24px',maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                <div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)'}}>Vendors near <span style={{fontStyle:'italic',color:'var(--rose)'}}>{venue}</span>{dateFrom&&<span style={{fontSize:'1.2rem',color:'var(--mid)',fontStyle:'normal'}}> · {formatDateDisplay(dateFrom)}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</span>}</h2>
                  <p style={{color:'var(--mid)',fontSize:'0.88rem',marginTop:4}}>{loading?(calcProgress||'Loading…'):loadError?loadError:'Each lane has its own price filter. Greyed-out vendors are booked on your date.'}</p>
                </div>
                {vendorsWithLoc.length>0&&<button onClick={()=>setShowMap(s=>!s)} style={{background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'8px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.8rem',color:'var(--forest)',cursor:'pointer'}}>{showMap?'🗺 Hide map':'🗺 Show map'}</button>}
              </div>
              {!loading&&!loadError&&showMap&&vendorsWithLoc.length>0&&<VendorsMap vendors={vendorsWithLoc} venueLatLng={venueLatLng} onSelectVendor={openDetail}/>}
              {!loading&&!loadError&&<VendorGrid vendorsByType={vendorsByType} activeTypes={activeTypes} dateFrom={dateFrom} dateTo={dateTo} onOpenDetail={openDetail} onRequestQuote={requestQuote}/>}
              {!loading&&!loadError&&(()=>{const vis=activeTypes.filter(t=>(vendorsByType[t]||[]).length>0).length;return vis===0&&(
                <div style={{textAlign:'center',padding:'60px 24px',color:'var(--mid)'}}>
                  <div style={{fontSize:'3rem',marginBottom:16}}>🔍</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',marginBottom:8}}>No vendors found</div>
                  <p style={{fontSize:'0.88rem',lineHeight:1.7,maxWidth:400,margin:'0 auto'}}>We could not find any vendors matching your search. Try adjusting your filters or check back soon as new vendors join regularly.</p>
                </div>
              );})()}
            </div>
          )}
        </div>

      )}

      {/* Site footer with legal links */}
      <div style={{background:'var(--forest)',padding:'28px 32px',textAlign:'center',marginTop:40}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--gold-light)',marginBottom:8}}>
          Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span>
        </div>
        <p style={{fontSize:'0.76rem',color:'rgba(255,255,255,0.4)',marginBottom:12}}>The Boland&#39;s wedding vendor marketplace</p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,flexWrap:'wrap'}}>
          <button onClick={()=>setShowLegal('terms')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:'0.74rem',cursor:'pointer',padding:0,textDecoration:'underline'}}>Terms of Service</button>
          <span style={{color:'rgba(255,255,255,0.2)'}}>·</span>
          <button onClick={()=>setShowLegal('privacy')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:'0.74rem',cursor:'pointer',padding:0,textDecoration:'underline'}}>Privacy Policy</button>
          <span style={{color:'rgba(255,255,255,0.2)'}}>·</span>
          <a href="mailto:dawidwille9@gmail.com" style={{color:'rgba(255,255,255,0.55)',fontSize:'0.74rem',textDecoration:'underline'}}>Contact</a>
        </div>
        <p style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.25)',marginTop:10,marginBottom:0}}>
          © 2025 VowFinds · vowfinds.co.za
        </p>
      </div>
    </>
  );
}

