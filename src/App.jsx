import React, { useState, useEffect } from 'react';
import { loadGoogleMaps, getBatchDistancesKm, supaFetch, loadSession, saveSession, clearSession } from './api.js';
import { useIsMobile } from './hooks.js';
import GlobalStyles from './styles.jsx';
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
import { ALL_TYPES } from './constants.jsx';

export default function VowFinds() {
  const isMobile=useIsMobile();
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
  const [showMap,setShowMap]=useState(true);
  const [user,setUser]=useState(()=>loadSession());
  const [showLoginModal,setShowLoginModal]=useState(false);
  const [showCustomerAuth,setShowCustomerAuth]=useState(false);
  const [quoteVendor,setQuoteVendor]=useState(null);
  const [pendingQuoteVendor,setPendingQuoteVendor]=useState(null);
  const [customerView,setCustomerView]=useState('browse'); // 'browse' | 'dashboard' | 'favourites' | 'scenario' | 'weddingplan'
  const [newLeadAfterQuote,setNewLeadAfterQuote]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [showScenario,setShowScenario]=useState(false);
  const [showWeddingPlan,setShowWeddingPlan]=useState(false);
  const [planMaxPrices,setPlanMaxPrices]=useState(null); // set by WeddingPlan search

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
            <button onClick={()=>setCustomerView(v=>v==='browse'?'dashboard':'browse')}
              style={{background:customerView!=='browse'?'rgba(255,255,255,0.15)':'rgba(201,169,110,0.2)',border:`1px solid ${customerView!=='browse'?'rgba(255,255,255,0.25)':'rgba(201,169,110,0.4)'}`,borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:customerView!=='browse'?'rgba(255,255,255,0.9)':'var(--gold-light)',cursor:'pointer'}}>
              {customerView==='browse'?'My Quotes':customerView==='dashboard'?'Browse':customerView==='favourites'?'⭐ Favourites':'🗂 Scenarios'}
            </button>
            <span style={{fontSize:'0.74rem',color:'rgba(255,255,255,0.5)'}}>Hi, {user.name}</span>
          </div>
        </nav>

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
          <FavouritesView customerId={user?.customerId} onOpenDetail={(v)=>{setActiveVendor(v);setView('detail');setCustomerView('browse');}} onRequestQuote={requestQuote} dateFrom={dateFrom} dateTo={dateTo}/>
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
              setCustomerView('browse');
              // Trigger a fresh vendor load so results show immediately
              if(newVenue.trim()){
                setLoading(true);setLoadError('');setCalcProgress('');
                supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
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
    if(!venue.trim())return;
    setLoading(true);setLoadError('');setCalcProgress('');
    try{
      const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name');
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
    }catch(e){setLoadError('Could not load vendors: '+e.message);}
    setLoading(false);
  }

  function search(){if(!venue.trim()){document.getElementById('venue-inp')?.focus();return;}setSearched(true);loadVendors(venueLatLng);}
  function openDetail(v){setPrevScroll(window.scrollY);setActiveVendor(v);setView('detail');window.scrollTo({top:0,behavior:'smooth'});}
  function goBack(){setView('customer');setTimeout(()=>window.scrollTo({top:prevScroll,behavior:'smooth'}),50);}

  // When nothing selected treat as all selected (no filter applied)
  const activeTypes=selectedTypes.size===0?ALL_TYPES:ALL_TYPES.filter(t=>selectedTypes.has(t));
  const vendorsByType={};activeTypes.forEach(t=>{vendorsByType[t]=vendors.filter(v=>v.type===t);});
  const vendorsWithLoc=vendors.filter(v=>v.lat&&v.lng);

  return(
    <>
      <GlobalStyles/>
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
            setShowWeddingPlan(false);
            if(newVenue.trim()){
              setLoading(true);setLoadError('');setCalcProgress('');
              supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
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
          <button className="vf-nav-login-btns" onClick={()=>setShowCustomerAuth(true)} style={{background:'none',border:'1px solid rgba(255,255,255,0.2)',borderRadius:6,color:'rgba(255,255,255,0.6)',fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',padding:'5px 12px',cursor:'pointer'}}>Customer Login</button>

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
              {label:'Customer Login',action:()=>{setShowCustomerAuth(true);setMenuOpen(false);}},

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
                    placeholder="e.g. Babylonstoren, Franschhoek"
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
                <button onClick={()=>setShowCustomerAuth(true)} style={{flex:1,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px',fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>👤 Customer Login</button>

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
            <div className="vf-results-section" style={{padding:'48px 0 60px',background:'#ffffff'}}>
              <div style={{padding:'0 32px 24px',maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                <div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)'}}>Vendors near <span style={{fontStyle:'italic',color:'var(--rose)'}}>{venue}</span>{dateFrom&&<span style={{fontSize:'1.2rem',color:'var(--mid)',fontStyle:'normal'}}> · {formatDateDisplay(dateFrom)}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</span>}</h2>
                  <p style={{color:'var(--mid)',fontSize:'0.88rem',marginTop:4}}>{loading?(calcProgress||'Loading…'):loadError?loadError:'Each lane has its own price filter. Greyed-out vendors are booked on your date.'}</p>
                </div>
                {vendorsWithLoc.length>0&&<button onClick={()=>setShowMap(s=>!s)} style={{background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'8px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.8rem',color:'var(--forest)',cursor:'pointer'}}>{showMap?'🗺 Hide map':'🗺 Show map'}</button>}
              </div>
              {!loading&&!loadError&&showMap&&vendorsWithLoc.length>0&&<VendorsMap vendors={vendorsWithLoc} venueLatLng={venueLatLng} onSelectVendor={openDetail}/>}
              {!loading&&!loadError&&activeTypes.map((type,idx)=>{const tv=vendorsByType[type];if(!tv||tv.length===0)return null;return<VendorLane key={type} type={type} vendors={tv} dateFrom={dateFrom} dateTo={dateTo} onOpenDetail={openDetail} isLast={idx===activeTypes.length-1} onRequestQuote={requestQuote}/>;  })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
