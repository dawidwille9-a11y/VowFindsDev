// VowFinds – Supabase + Google Maps + Auth

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
// ── MOBILE DETECTION ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}


// ── CREDENTIALS ───────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://pvpmmzpzeruzoxvwyhqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cG1tenB6ZXJ1em94dnd5aHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjkwNTQsImV4cCI6MjA4OTQwNTA1NH0.Bz45g6NBSNeHd_E4s9TRddlJOseYUJKhAErtIbcyfks';
const SUPABASE_PUB_KEY  = 'sb_publishable_CBnCOZJzit8uM2fUIIH5-A_WEC3pwS-';
const GOOGLE_MAPS_KEY   = 'AIzaSyAEmYsoBR2eLoBKr30Gxzy0xdpIl3foCq0';
const ADMIN_USER        = 'admin';
const ADMIN_PASS        = 'admin';

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────
async function supaFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_PUB_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Supabase Auth helpers
async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_PUB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || 'Sign up failed');
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_PUB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
  return data; // { access_token, user: { id, email } }
}

function storageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/vendor-images/${path}`;
}

// ── SESSION PERSISTENCE ───────────────────────────────────────────────────────
const SESSION_KEY = 'vowfinds_session';
const REMEMBER_KEY = 'vowfinds_remember';

function saveSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch(e) {}
  // Also save to localStorage if remember me was set
  try {
    const rem = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
    if (rem && rem.email === user.email) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  } catch(e) {}
}

function loadSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (s) return JSON.parse(s);
  } catch(e) {}
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (s) return JSON.parse(s);
  } catch(e) {}
  return null;
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

function saveRemember(email, password) {
  try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({email, password})); } catch(e) {}
}

function loadRemember() {
  try { return JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null'); } catch(e) { return null; }
}

function clearRemember() {
  try { localStorage.removeItem(REMEMBER_KEY); } catch(e) {}
}

// ── GOOGLE MAPS LOADER ────────────────────────────────────────────────────────
let mapsLoaded = false, mapsLoading = false, mapsCallbacks = [];
function loadGoogleMaps() {
  return new Promise((resolve) => {
    if (mapsLoaded) return resolve(window.google);
    mapsCallbacks.push(resolve);
    if (!mapsLoading) {
      mapsLoading = true;
      window.__googleMapsReady = () => { mapsLoaded = true; mapsCallbacks.forEach(cb => cb(window.google)); mapsCallbacks = []; };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&callback=__googleMapsReady`;
      s.async = true; document.head.appendChild(s);
    }
  });
}

// Haversine fallback for a single pair
function haversineKm(origin, dest) {
  const R=6371, dLat=(dest.lat-origin.lat)*Math.PI/180, dLng=(dest.lng-origin.lng)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(origin.lat*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

// Batch distance lookup — ONE API call for up to 25 vendors at once
async function getBatchDistancesKm(origin, vendors) {
  await loadGoogleMaps();
  const BATCH = 25;
  const results = new Array(vendors.length).fill(0);
  for (let i = 0; i < vendors.length; i += BATCH) {
    const chunk = vendors.slice(i, i + BATCH);
    const dests = chunk.filter(v => v.lat && v.lng)
      .map(v => new window.google.maps.LatLng(v.lat, v.lng));
    if (dests.length === 0) continue;
    await new Promise(resolve => {
      new window.google.maps.DistanceMatrixService().getDistanceMatrix({
        origins: [new window.google.maps.LatLng(origin.lat, origin.lng)],
        destinations: dests,
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (res, status) => {
        let destIdx = 0;
        chunk.forEach((v, ci) => {
          if (!v.lat || !v.lng) { results[i + ci] = 0; return; }
          if (status === 'OK') {
            results[i + ci] = Math.round((res.rows[0]?.elements[destIdx]?.distance?.value || 0) / 1000);
          } else {
            results[i + ci] = haversineKm(origin, v);
          }
          destIdx++;
        });
        resolve();
      });
    });
  }
  return results; // array of km values, same order as vendors
}

// Keep single version for backward compat
async function getDistanceKm(origin, dest) {
  const [km] = await getBatchDistancesKm(origin, [dest]);
  return km;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ALL_TYPES  = ['Photography','Catering','Florist','DJ','Entertainment','Videography','Cake & Desserts','Barista'];
const TYPE_EMOJI = {'Photography':'📷','Catering':'🍽','Florist':'💐','DJ':'🎧','Entertainment':'🎶','Videography':'🎬','Cake & Desserts':'🎂','Barista':'☕'};
const TYPE_COLOR = {'Photography':'#c4826a','Catering':'#6a8fa8','Florist':'#8faa6a','DJ':'#9b6aaa','Entertainment':'#aa8f6a','Videography':'#6a9baa','Cake & Desserts':'#aa6a8f','Barista':'#8b5e3c'};
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOWS       = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── ON-REQUEST TYPES & QUESTIONNAIRES ────────────────────────────────────────
const ON_REQUEST_TYPES = new Set(['Florist','Catering','Cake & Desserts']);

const ON_REQUEST_QUESTIONS = {
  'Florist': [
    'What is your overall floral style preference? (e.g. romantic, rustic, modern, wild)',
    'How many bridal party members need bouquets/buttonholes?',
    'Do you need ceremony flowers (arch, aisle, pew decorations)?',
    'How many reception tables need centrepieces?',
    'Do you prefer fresh, dried, or artificial flowers?',
    'Are there any flowers you love or want to avoid?',
    'Do you have a colour palette in mind?',
    'Will you need the florist to assist with setup and breakdown on the day?',
  ],
  'Catering': [
    'How many guests are you expecting?',
    'What meal style do you prefer? (e.g. sit-down, buffet, cocktail, grazing table)',
    'Do you need breakfast, lunch, dinner, or all-day service?',
    'Are there any dietary requirements or allergies we should know about?',
    'Do you need staff (waiters, bartenders) included in the quote?',
    'Will you need crockery, cutlery, and linen, or will the venue provide these?',
    'Do you have a food theme or cuisine preference?',
    'Will you need a late-night snack or additional meal service?',
  ],
  'Cake & Desserts': [
    'How many tiers would you like your wedding cake?',
    'What cake flavours are you considering? (e.g. vanilla, red velvet, lemon)',
    'Do you want a fondant or buttercream finish?',
    'What decoration style appeals to you? (e.g. floral, geometric, minimalist)',
    'How many guests will the cake need to serve?',
    'Do you need a dessert table in addition to the main cake?',
    'Are there any dietary requirements? (e.g. gluten-free, vegan)',
    'Do you have inspiration images or a colour palette to share?',
  ],
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
function calcTotal(v) {
  if(ON_REQUEST_TYPES.has(v.type)) return 0; // on-request, no fixed rate shown
  const travel = (v.distance_km||0)*(v.per_km_rate||0);
  const overnight = (v.distance_km||0)>(v.overnight_threshold_km||80)?(v.overnight_fee||0):0;
  return (v.fixed_rate||0)+travel+overnight;
}
function isOnRequest(v) { return ON_REQUEST_TYPES.has(v.type); }
function fmt(n) { return 'R\u00a0'+Number(n||0).toLocaleString('en-ZA'); }
function avg(arr) { return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0; }
function dateKey(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function formatDateDisplay(s) { if(!s)return''; const[y,m,d]=s.split('-').map(Number); return`${d} ${MONTHS[m-1]} ${y}`; }
function nextSaturday() { const d=new Date(); d.setDate(d.getDate()+((6-d.getDay()+7)%7||7)+14); return d.toISOString().split('T')[0]; }

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const inputStyle = {border:'1.5px solid var(--parchment)',borderRadius:8,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'};
const labelStyle = {fontSize:'0.72rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:4,display:'block'};
const sectionStyle = {background:'var(--white)',borderRadius:16,padding:28,marginBottom:20,boxShadow:'var(--card-shadow)'};
const h3Style = {fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',marginBottom:20,paddingBottom:10,borderBottom:'1px solid var(--parchment)'};

// ── CALENDAR ──────────────────────────────────────────────────────────────────
const Calendar=memo(function Calendar({ year, month, unavailDates=new Set(), weddingDate='', editable=false, onToggle, onPrev, onNext }) {
  const today=new Date(), firstDow=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate();
  let wdY,wdM,wdD; if(weddingDate){[wdY,wdM,wdD]=weddingDate.split('-').map(Number);wdM--;}
  return (
    <div style={{background:'var(--white)',borderRadius:16,padding:20,boxShadow:'var(--card-shadow)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <button onClick={onPrev} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--mid)',padding:'2px 8px'}}>‹</button>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>{MONTHS[month]} {year}</span>
        <button onClick={onNext} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--mid)',padding:'2px 8px'}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {DOWS.map(d=><div key={d} style={{textAlign:'center',fontSize:'0.62rem',color:'var(--light)',letterSpacing:'0.08em',textTransform:'uppercase',paddingBottom:6,fontWeight:500}}>{d}</div>)}
        {Array(firstDow).fill(null).map((_,i)=><div key={'e'+i}/>)}
        {Array.from({length:days},(_,i)=>i+1).map(day=>{
          const key=dateKey(year,month,day),isU=unavailDates.has(key),isT=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===day,isW=weddingDate&&wdY===year&&wdM===month&&wdD===day;
          let bg='transparent',color='var(--charcoal)',fw=400,border='none';
          if(isW){bg='var(--forest)';color='var(--gold-light)';fw=700;}else if(isU){bg='#fce8e4';color='#b85a45';fw=600;}
          if(isT)border='1.5px solid var(--gold)';
          return(<div key={day} onClick={editable?()=>onToggle(key):undefined}
            style={{textAlign:'center',fontSize:'0.78rem',padding:'5px 2px',borderRadius:6,cursor:editable?'pointer':'default',background:bg,color,fontWeight:fw,border,minHeight:28,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s'}}
            onMouseEnter={e=>{if(editable&&!isW)e.currentTarget.style.background=isU?'#f5d5cf':'var(--parchment)';}}
            onMouseLeave={e=>{if(editable&&!isW)e.currentTarget.style.background=isU?'#fce8e4':'transparent';}}
          >{day}</div>);
        })}
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',color:'var(--mid)'}}><div style={{width:10,height:10,borderRadius:3,background:'var(--parchment)',border:'1px solid #ddd'}}/>Available</div>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',color:'var(--mid)'}}><div style={{width:10,height:10,borderRadius:3,background:'#fce8e4'}}/>Unavailable</div>
        {weddingDate&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',color:'var(--mid)'}}><div style={{width:10,height:10,borderRadius:3,background:'var(--forest)'}}/>Your wedding date</div>}
      </div>
    </div>
  );
});

// ── VENUE AUTOCOMPLETE ────────────────────────────────────────────────────────
function VenueAutocomplete({value,onChange,onPlaceSelected,placeholder,style}) {
  const inputRef=useRef();
  const [mapsReady,setMapsReady]=useState(mapsLoaded);
  useEffect(()=>{
    loadGoogleMaps().then(()=>setMapsReady(true));
  },[]);
  useEffect(()=>{
    if(!mapsReady)return;
    loadGoogleMaps().then(google=>{
      if(!inputRef.current)return;
      const ac=new google.maps.places.Autocomplete(inputRef.current,{types:['establishment','geocode'],componentRestrictions:{country:'za'}});
      ac.addListener('place_changed',()=>{const place=ac.getPlace();if(place.geometry){const ll={lat:place.geometry.location.lat(),lng:place.geometry.location.lng()};const name=place.formatted_address||place.name;onChange(name);onPlaceSelected(ll,name);}});
    });
  },[mapsReady]);
  return <input ref={inputRef} type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>;
}

// ── MAPS ──────────────────────────────────────────────────────────────────────
function VendorsMap({vendors,venueLatLng,onSelectVendor}) {
  const mapRef=useRef(), mapInst=useRef(), markers=useRef([]);
  useEffect(()=>{
    loadGoogleMaps().then(google=>{
      if(!mapRef.current)return;
      const center=venueLatLng||{lat:-29.0,lng:25.0};
      if(!mapInst.current){mapInst.current=new google.maps.Map(mapRef.current,{zoom:venueLatLng?8:6,center,mapTypeControl:false,streetViewControl:false,styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'water',stylers:[{color:'#c8dce8'}]},{featureType:'landscape',stylers:[{color:'#f5f0e8'}]}]});}
      else if(venueLatLng)mapInst.current.setCenter(center);
      markers.current.forEach(m=>m.setMap(null)); markers.current=[];
      if(venueLatLng){const vm=new google.maps.Marker({position:venueLatLng,map:mapInst.current,title:'Your Venue',zIndex:999,icon:{path:google.maps.SymbolPath.CIRCLE,scale:12,fillColor:'#3a4a3f',fillOpacity:1,strokeColor:'#e8d5a3',strokeWeight:3}});const vi=new google.maps.InfoWindow({content:'<div style="font-family:sans-serif;font-weight:600;color:#3a4a3f;padding:4px 8px">📍 Your Venue</div>'});vm.addListener('click',()=>vi.open(mapInst.current,vm));markers.current.push(vm);}
      vendors.forEach(v=>{if(!v.lat||!v.lng)return;const color=TYPE_COLOR[v.type]||'#c4826a';const marker=new google.maps.Marker({position:{lat:v.lat,lng:v.lng},map:mapInst.current,title:v.name,icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:color,fillOpacity:0.9,strokeColor:'#ffffff',strokeWeight:2}});const info=new google.maps.InfoWindow({content:`<div style="font-family:sans-serif;padding:6px 10px;max-width:180px"><div style="font-weight:700;color:#2c2c2c;margin-bottom:2px">${v.name}</div><div style="font-size:0.78rem;color:#6b6b6b;margin-bottom:4px">${TYPE_EMOJI[v.type]||''} ${v.type}</div><div style="font-size:0.78rem;color:#6b6b6b">📍 ${v.location}</div>${v.distance_km?`<div style="font-size:0.78rem;color:#c4826a;font-weight:600;margin-top:4px">~${v.distance_km} km away</div>`:''}</div>`});marker.addListener('click',()=>{info.open(mapInst.current,marker);if(onSelectVendor)onSelectVendor(v);});markers.current.push(marker);});
      if(markers.current.length>1){const bounds=new google.maps.LatLngBounds();markers.current.forEach(m=>bounds.extend(m.getPosition()));mapInst.current.fitBounds(bounds);}
    });
  },[vendors,venueLatLng]);
  return (
    <div style={{borderRadius:16,overflow:'hidden',boxShadow:'var(--card-shadow)',margin:'0 32px 40px'}}>
      <div style={{background:'var(--forest)',padding:'12px 20px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:'var(--gold-light)',fontSize:'0.8rem',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase'}}>📍 Vendor Map</span>
        {ALL_TYPES.filter(t=>vendors.some(v=>v.type===t&&v.lat)).map(t=>(
          <div key={t} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.7rem',color:'rgba(255,255,255,0.7)'}}><div style={{width:8,height:8,borderRadius:'50%',background:TYPE_COLOR[t]}}/>{t}</div>
        ))}
      </div>
      <div ref={mapRef} style={{height:420,width:'100%'}}/>
    </div>
  );
}

function DetailMap({vendor,venueLatLng}) {
  const mapRef=useRef();
  useEffect(()=>{
    if(!vendor.lat||!vendor.lng)return;
    loadGoogleMaps().then(google=>{
      if(!mapRef.current)return;
      const vp={lat:vendor.lat,lng:vendor.lng};
      const map=new google.maps.Map(mapRef.current,{zoom:8,center:vp,mapTypeControl:false,streetViewControl:false,styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'water',stylers:[{color:'#c8dce8'}]},{featureType:'landscape',stylers:[{color:'#f5f0e8'}]}]});
      new google.maps.Marker({position:vp,map,title:vendor.name,icon:{path:google.maps.SymbolPath.CIRCLE,scale:11,fillColor:'#c4826a',fillOpacity:1,strokeColor:'#fff',strokeWeight:3}});
      if(venueLatLng){
        new google.maps.Marker({position:venueLatLng,map,title:'Your Venue',icon:{path:google.maps.SymbolPath.CIRCLE,scale:11,fillColor:'#3a4a3f',fillOpacity:1,strokeColor:'#e8d5a3',strokeWeight:3}});
        const ds=new google.maps.DirectionsService(),dr=new google.maps.DirectionsRenderer({map,suppressMarkers:true,polylineOptions:{strokeColor:'#c4826a',strokeOpacity:0.7,strokeWeight:4}});
        ds.route({origin:venueLatLng,destination:vp,travelMode:google.maps.TravelMode.DRIVING},(result,status)=>{if(status==='OK'){dr.setDirections(result);const b=new google.maps.LatLngBounds();b.extend(venueLatLng);b.extend(vp);map.fitBounds(b);}});
      }
    });
  },[vendor,venueLatLng]);
  if(!vendor.lat||!vendor.lng)return<div style={{background:'var(--parchment)',borderRadius:12,padding:'24px',textAlign:'center',color:'var(--light)',fontSize:'0.84rem'}}>📍 This vendor hasn't set their location yet.</div>;
  return<div ref={mapRef} style={{height:280,width:'100%',borderRadius:12,overflow:'hidden',boxShadow:'var(--card-shadow)'}}/>;
}

// ── CUSTOMER AUTH MODAL ──────────────────────────────────────────────────────
function CustomerAuthModal({onLogin, onClose, redirectVendor=null}) {
  const savedC = loadRemember();
  const [mode,setMode]=useState('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState(savedC?.email||'');
  const [password,setPassword]=useState(savedC?.password||'');
  const [remember,setRemember]=useState(!!savedC);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState('');
  const [success,setSuccess]=useState('');

  function handleBackdrop(e){ if(e.target===e.currentTarget) onClose(); }

  async function handleLogin(e){
    e.preventDefault(); setError(''); setLoading('Logging in…');
    try{
      if(remember) saveRemember(email,password); else clearRemember();
      const data=await signIn(email,password);
      // Fetch or create customer record
      let customers=await supaFetch(`customers?user_id=eq.${data.user.id}&select=*`);
      let customer=Array.isArray(customers)?customers[0]:customers;
      if(!customer){
        const res=await supaFetch('customers',{method:'POST',body:JSON.stringify({user_id:data.user.id,name:data.user.user_metadata?.name||email.split('@')[0],email:data.user.email}),prefer:'return=representation'});
        customer=Array.isArray(res)?res[0]:res;
      }
      onLogin({role:'customer',email:data.user.email,userId:data.user.id,customerId:customer?.id,name:customer?.name||email.split('@')[0],token:data.access_token});
      onClose();
    }catch(err){setError(err.message);}
    setLoading('');
  }

  async function handleRegister(e){
    e.preventDefault(); setError(''); setSuccess(''); setLoading('Creating account…');
    try{
      const data=await signUp(email,password);
      // Create customer profile immediately
      if(data.user){
        await supaFetch('customers',{method:'POST',body:JSON.stringify({user_id:data.user.id,name,email}),prefer:'return=minimal'});
      }
      setSuccess('Account created! Please check your email to confirm, then log in.');
      setMode('login');
    }catch(err){setError(err.message);}
    setLoading('');
  }

  return (
    <div onClick={handleBackdrop} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:380,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        {redirectVendor&&(
          <div style={{background:'var(--parchment)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'0.8rem',color:'var(--mid)'}}>
            💍 Sign in to request a quote from <strong>{redirectVendor.name}</strong>
          </div>
        )}
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:600,marginBottom:4}}>
          {mode==='login'?'Welcome back':'Create account'}
        </div>
        <p style={{fontSize:'0.78rem',color:'var(--light)',marginBottom:22}}>
          {mode==='login'?'Login to your customer account':'Join VowFinds to request quotes'}
        </p>
        <form onSubmit={mode==='login'?handleLogin:handleRegister}>
          {mode==='register'&&(
            <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
              <label style={labelStyle}>Your Name</label>
              <input style={{...inputStyle,marginBottom:0}} type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Smith" required/>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Email</label>
            <input style={{...inputStyle,marginBottom:0}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required autoFocus/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Password</label>
            <input style={{...inputStyle,marginBottom:0}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={mode==='register'?6:1}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}} onClick={()=>setRemember(r=>!r)}>
            <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${remember?'var(--rose)':'var(--light)'}`,background:remember?'var(--rose)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
              {remember&&<span style={{color:'white',fontSize:'0.6rem',lineHeight:1}}>✓</span>}
            </div>
            <span style={{fontSize:'0.78rem',color:'var(--mid)',userSelect:'none'}}>Remember my details</span>
          </div>
          {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8,border:'1px solid rgba(196,130,106,0.2)'}}>{error}</div>}
          {success&&<div style={{fontSize:'0.78rem',color:'var(--forest)',marginBottom:12,padding:'10px 12px',background:'rgba(58,74,63,0.07)',borderRadius:8}}>{success}</div>}
          <button type="submit" disabled={!!loading} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:loading?'wait':'pointer',letterSpacing:'0.05em'}}>
            {loading||(mode==='login'?'Login':'Create Account')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:'0.78rem',color:'var(--mid)'}}>
          {mode==='login'?<span>New here?{' '}<span onClick={()=>{setMode('register');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Create account</span></span>
          :<span>Already have an account?{' '}<span onClick={()=>{setMode('login');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Login</span></span>}
        </div>
        <div style={{textAlign:'center',marginTop:10,fontSize:'0.72rem',color:'var(--light)'}}>
          Are you a vendor?{' '}<span style={{color:'var(--forest)',cursor:'pointer',textDecoration:'underline'}} onClick={onClose}>Use the Login button above</span>
        </div>
      </div>
    </div>
  );
}

// ── QUOTE REQUEST MODAL ───────────────────────────────────────────────────────
function QuoteModal({vendor,customer,onClose,onSubmitted}) {
  const onReq = isOnRequest(vendor);
  const questions = ON_REQUEST_QUESTIONS[vendor.type] || [];
  const [form,setForm]=useState({title:'',description:'',budget:'',timeline:''});
  const [answers,setAnswers]=useState({}); // {questionIndex: answer text}
  const [freeText,setFreeText]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const fileRef=useRef();
  const [fileUrl,setFileUrl]=useState('');
  const [uploading,setUploading]=useState(false);

  function handleBackdrop(e){if(e.target===e.currentTarget)onClose();}
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function setAnswer(i,val){setAnswers(prev=>({...prev,[i]:val}));}

  async function uploadFile(file){
    setUploading(true);
    const ext=file.name.split('.').pop();
    const path=`leads/${Date.now()}_${file.name}`;
    const res=await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-images/${path}`,{method:'POST',headers:{'apikey':SUPABASE_PUB_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':file.type},body:file});
    if(res.ok) setFileUrl(storageUrl(path));
    else setError('File upload failed');
    setUploading(false);
  }

  async function submit(e){
    e.preventDefault();
    if(!onReq&&(!form.title||!form.description)){setError('Please fill in the title and description.');return;}
    setSubmitting(true);setError('');
    try{
      const res=await supaFetch('leads',{method:'POST',body:JSON.stringify({
        customer_id:customer.customerId,
        vendor_id:vendor.id,
        title:onReq?`${vendor.type} Quote Request`:form.title,
        description:form.description,
        budget:form.budget,
        timeline:form.timeline,
        file_url:fileUrl||null,
        status:'new',
      }),prefer:'return=representation'});
      const lead=Array.isArray(res)?res[0]:res;
      // Post first message with the details
      const msgLines = onReq ? [
        `Quote Request for ${vendor.name} (${vendor.type})`,
        '',
        ...questions.flatMap((q,i)=>answers[i]?[`${q}`,`→ ${answers[i]}`,'']:[]),
        ...(freeText?['Additional details:',freeText,'']:[]),
        ...(fileUrl?['📎 Attachment included']:[]),
      ] : [
        'Hi! I would like to request a quote.',
        '',
        'Project: ' + form.title,
        '',
        form.description,
        form.budget ? ('Budget: ' + form.budget) : '',
        form.timeline ? ('Timeline: ' + form.timeline) : '',
      ];
      await supaFetch('messages',{method:'POST',body:JSON.stringify({
        lead_id:lead.id,
        sender_role:'customer',
        sender_name:customer.name,
        message_text:msgLines.filter(Boolean).join('\n'),
        file_url:fileUrl||null,
      }),prefer:'return=minimal'});
      onSubmitted(lead);
    }catch(err){setError('Submission failed: '+err.message);}
    setSubmitting(false);
  }

  return(
    <div onClick={handleBackdrop} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:'20px'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:520,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.28)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:10,background:vendor.images?.[0]?.url?`url(${vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${vendor.color||'#c8a87a'}dd,${vendor.color||'#c8a87a'}66)`,flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',fontWeight:600}}>Request a Quote</div>
            <div style={{fontSize:'0.78rem',color:'var(--mid)'}}>{vendor.name} · {TYPE_EMOJI[vendor.type]} {vendor.type}</div>
          </div>
        </div>
        <form onSubmit={submit}>
          {onReq ? (
            /* On-Request questionnaire */
            <div>
              <div style={{fontSize:'0.82rem',color:'var(--mid)',marginBottom:14,padding:'10px 12px',background:'var(--cream)',borderRadius:8}}>
                Please answer the questions below to help <strong>{vendor.name}</strong> prepare your personalised quote. Skip any that don't apply.
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:14}}>
                {questions.map((q,i)=>(
                  <div key={i}>
                    <label style={{...labelStyle,marginBottom:5,textTransform:'none',letterSpacing:0,fontSize:'0.82rem',color:'var(--charcoal)',fontWeight:500}}>{i+1}. {q}</label>
                    <input style={{...inputStyle,padding:'8px 11px',fontSize:'0.83rem'}} value={answers[i]||''} onChange={e=>setAnswer(i,e.target.value)} placeholder="Your answer…"/>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>Anything else you'd like to add?</label>
                <textarea style={{...inputStyle,resize:'vertical',minHeight:70}} value={freeText} onChange={e=>setFreeText(e.target.value)} placeholder="Any additional details, inspiration images descriptions, colour palette, special requests…"/>
              </div>
            </div>
          ) : (
            /* Standard quote form */
            <div>
              <div style={{marginBottom:12}}>
                <label style={labelStyle}>Project Title</label>
                <input style={inputStyle} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Wedding Photography – October 2025" required/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={labelStyle}>Description</label>
                <textarea style={{...inputStyle,resize:'vertical',minHeight:90}} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Tell the vendor about your wedding and what you need…" required/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div><label style={labelStyle}>Budget (optional)</label><input style={inputStyle} value={form.budget} onChange={e=>set('budget',e.target.value)} placeholder="e.g. R15 000"/></div>
                <div><label style={labelStyle}>Timeline / Wedding Date</label><input style={inputStyle} value={form.timeline} onChange={e=>set('timeline',e.target.value)} placeholder="e.g. 15 March 2026"/></div>
              </div>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <div onClick={()=>fileRef.current?.click()} style={{border:'1.5px dashed var(--blush)',borderRadius:8,padding:'10px 14px',cursor:'pointer',fontSize:'0.8rem',color:fileUrl?'var(--forest)':'var(--light)',background:'var(--cream)',textAlign:'center'}}>
              {uploading?'Uploading…':fileUrl?'✓ File attached':'📎 Attach inspiration images or mood boards (optional)'}
            </div>
            <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadFile(e.target.files[0])}/>
          </div>
          {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}
          <div style={{display:'flex',gap:10}}>
            <button type="button" onClick={onClose} style={{flex:1,background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',cursor:'pointer'}}>Cancel</button>
            <button type="submit" disabled={submitting||uploading} style={{flex:2,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:(submitting||uploading)?'wait':'pointer',letterSpacing:'0.04em'}}>
              {submitting?'Sending…':onReq?'Send Quote Request':'Send Quote Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CHAT THREAD ───────────────────────────────────────────────────────────────
function ChatThread({lead,currentRole,currentName,onBack}) {
  const [messages,setMessages]=useState([]);
  const [msgText,setMsgText]=useState('');
  const [sending,setSending]=useState(false);
  const [loadingMsgs,setLoadingMsgs]=useState(true);
  const fileRef=useRef();
  const bottomRef=useRef();

  useEffect(()=>{
    loadMessages();
    const interval=setInterval(loadMessages,5000); // poll every 5s
    return()=>clearInterval(interval);
  },[lead.id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'});},[messages]);

  async function loadMessages(){
    try{
      const data=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.asc&select=*`);
      setMessages(data);
    }catch(e){}
    setLoadingMsgs(false);
  }

  async function sendMessage(e){
    e.preventDefault();
    if(!msgText.trim())return;
    setSending(true);
    try{
      await supaFetch('messages',{method:'POST',body:JSON.stringify({lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:msgText}),prefer:'return=minimal'});
      setMsgText('');
      loadMessages();
    }catch(err){alert('Send failed: '+err.message);}
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

  const STATUS_COLOR={'new':'#c9a96e','responded':'#3a7a5a','closed':'#a8a8a8'};

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 120px)',background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
      {/* Chat header */}
      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',gap:12,background:'var(--white)'}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--mid)',padding:'2px 8px',flexShrink:0}}>‹</button>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:600,color:'var(--forest)'}}>{lead.title}</div>
          <div style={{fontSize:'0.74rem',color:'var(--mid)',marginTop:2}}>
            {currentRole==='vendor'?`Customer: ${lead.customer_name||'Customer'}`:`Vendor: ${lead.vendor_name||'Vendor'}`}
            <span style={{marginLeft:10,background:STATUS_COLOR[lead.status]||'#ccc',color:'white',borderRadius:999,fontSize:'0.65rem',padding:'2px 8px',fontWeight:600,textTransform:'uppercase'}}>{lead.status}</span>
          </div>
        </div>
        {currentRole==='vendor'&&(
          <select value={lead.status} onChange={async e=>{
            await supaFetch(`leads?id=eq.${lead.id}`,{method:'PATCH',body:JSON.stringify({status:e.target.value}),prefer:'return=minimal'});
            lead.status=e.target.value;
          }} style={{fontSize:'0.76rem',border:'1px solid var(--parchment)',borderRadius:6,padding:'4px 8px',background:'var(--cream)',color:'var(--charcoal)',cursor:'pointer'}}>
            <option value="new">New</option>
            <option value="responded">Responded</option>
            <option value="closed">Closed</option>
          </select>
        )}
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:10,background:'var(--cream)'}}>
        {loadingMsgs?<div style={{textAlign:'center',color:'var(--light)',padding:'20px'}}>Loading…</div>:
          messages.length===0?<div style={{textAlign:'center',color:'var(--light)',padding:'20px',fontSize:'0.84rem'}}>No messages yet. Start the conversation!</div>:
          messages.map((m,i)=>{
            const isMe=m.sender_role===currentRole;
            return(
              <div key={m.id||i} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start'}}>
                <div style={{fontSize:'0.68rem',color:'var(--light)',marginBottom:3,paddingLeft:isMe?0:4,paddingRight:isMe?4:0}}>
                  {m.sender_name||m.sender_role} · {m.created_at?new Date(m.created_at).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}):''}
                </div>
                {m.message_text&&(
                  <div style={{maxWidth:'75%',background:isMe?'var(--forest)':'var(--white)',color:isMe?'var(--cream)':'var(--charcoal)',borderRadius:isMe?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'10px 14px',fontSize:'0.86rem',lineHeight:1.55,boxShadow:'0 2px 8px rgba(0,0,0,0.07)',whiteSpace:'pre-wrap'}}>
                    {m.message_text}
                  </div>
                )}
                {m.file_url&&(
                  <a href={m.file_url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:6,background:isMe?'var(--forest)':'var(--white)',color:isMe?'var(--gold-light)':'var(--forest)',borderRadius:10,padding:'8px 12px',fontSize:'0.8rem',textDecoration:'none',boxShadow:'0 2px 8px rgba(0,0,0,0.07)',marginTop:m.message_text?4:0}}>
                    📎 View attachment
                  </a>
                )}
              </div>
            );
          })
        }
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:'12px 16px',borderTop:'1px solid var(--parchment)',background:'var(--white)'}}>
        <form onSubmit={sendMessage} style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <textarea value={msgText} onChange={e=>setMsgText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(e);}}}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            style={{flex:1,border:'1.5px solid var(--parchment)',borderRadius:10,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.86rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',resize:'none'}}/>
          <button type="button" onClick={()=>fileRef.current?.click()} style={{background:'var(--parchment)',border:'none',borderRadius:8,padding:'10px 12px',cursor:'pointer',fontSize:'1rem',color:'var(--mid)',flexShrink:0}}>📎</button>
          <button type="submit" disabled={sending||!msgText.trim()} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'10px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.86rem',fontWeight:500,cursor:(sending||!msgText.trim())?'not-allowed':'pointer',flexShrink:0}}>
            {sending?'…':'Send'}
          </button>
        </form>
        <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadAndSend(e.target.files[0])}/>
      </div>
    </div>
  );
}

// ── CUSTOMER DASHBOARD ────────────────────────────────────────────────────────
// ── CUSTOMER DASHBOARD ───────────────────────────────────────────────────────
function CustomerDashboard({user,onLogout,onBrowse,initialLead=null}) {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeLead,setActiveLead]=useState(initialLead);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const pollRef=useRef(null);

  useEffect(()=>{
    loadLeads();
    // Poll for new messages every 8s
    pollRef.current=setInterval(loadLeads,8000);
    return()=>clearInterval(pollRef.current);
  },[]);

  // If a new lead comes in after quote submit, select it
  useEffect(()=>{
    if(initialLead&&leads.length>0){
      const found=leads.find(l=>l.id===initialLead.id);
      if(found)setActiveLead(found);
    }
  },[leads,initialLead]);

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
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--forest)'}}>💬 Conversations</div>
              <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:2}}>Hi, {user.name}</div>
            </div>
            {unread>0&&<span style={{background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.68rem',padding:'2px 8px',fontWeight:600}}>{unread}</span>}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
            {loading?(
              <div style={{textAlign:'center',padding:'24px',color:'var(--light)',fontSize:'0.82rem'}}>Loading…</div>
            ):leads.length===0?(
              <div style={{textAlign:'center',padding:'32px 16px'}}>
                <div style={{fontSize:'2rem',marginBottom:8}}>💌</div>
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
                        <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.title}</div>
                        <div style={{fontSize:'0.71rem',color:'var(--mid)',marginTop:1}}>{lead.vendor?.name}</div>
                      </div>
                      {hasVendorReply&&!isActive&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--rose)',flexShrink:0}}/>}
                    </div>
                    {lead.last_message&&(
                      <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingLeft:42}}>
                        {lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'📎 Attachment'}
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
        <div style={{flex:1,overflowY:'auto',padding:'0'}}>
          {activeLead?(
            <div style={{maxWidth:760,margin:'0 auto',padding:'20px 20px 60px'}}>
              <ChatThread
                lead={{...activeLead,customer_name:user.name,vendor_name:activeLead.vendor?.name}}
                currentRole="customer"
                currentName={user.name}
                onBack={()=>setActiveLead(null)}
              />
            </div>
          ):(
            <div style={{maxWidth:760,margin:'0 auto',padding:'32px 24px 60px'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:400,marginBottom:4}}>My Quote Requests</div>
              <p style={{color:'var(--light)',fontSize:'0.82rem',marginBottom:24}}>Click any conversation to open the chat.</p>
              {loading?<div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading…</div>:
                leads.length===0?(
                  <div style={{textAlign:'center',padding:'60px 20px',background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)'}}>
                    <div style={{fontSize:'3rem',marginBottom:12}}>💌</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>No quote requests yet</div>
                    <p style={{color:'var(--mid)',fontSize:'0.88rem',marginBottom:16}}>Browse vendors and click "Request a Quote" to get started.</p>
                    <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px 22px',fontSize:'0.88rem',cursor:'pointer'}}>Browse Vendors</button>
                  </div>
                ):(
                  <div style={{display:'grid',gap:12}}>
                    {leads.map(lead=>(
                      <div key={lead.id} onClick={()=>setActiveLead(lead)}
                        style={{background:'var(--white)',borderRadius:14,padding:'16px 20px',boxShadow:'var(--card-shadow)',cursor:'pointer',transition:'box-shadow 0.2s,transform 0.15s',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}
                        onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--card-shadow-hover)';e.currentTarget.style.transform='translateY(-2px)';}}
                        onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--card-shadow)';e.currentTarget.style.transform='';}}>
                        <div style={{width:48,height:48,borderRadius:10,background:lead.vendor?.images?.[0]?.url?`url(${lead.vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}dd,${lead.vendor?.color||'#c8a87a'}66)`,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:150}}>
                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)',marginBottom:2}}>{lead.title}</div>
                          <div style={{fontSize:'0.76rem',color:'var(--mid)'}}>{TYPE_EMOJI[lead.vendor?.type]||''} {lead.vendor?.name}</div>
                          {lead.last_message&&<div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:300}}>{lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'📎 Attachment'}</div>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5}}>
                          <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.68rem',padding:'2px 9px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                          <span style={{fontSize:'0.68rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                          <span style={{fontSize:'0.78rem',color:'var(--rose)',fontWeight:500}}>Open chat →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


// ── LOGIN MODAL ───────────────────────────────────────────────────────────────
function LoginModal({onLogin, onClose}) {
  const saved = loadRemember();
  const [mode,setMode]=useState('login');
  const [identifier,setIdentifier]=useState(saved?.email||'');
  const [password,setPassword]=useState(saved?.password||'');
  const [remember,setRemember]=useState(!!saved);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState('');
  const [success,setSuccess]=useState('');

  function handleBackdrop(e){ if(e.target===e.currentTarget) onClose(); }

  async function handleLogin(e){
    e.preventDefault(); setError(''); setLoading('Logging in…');
    if(identifier===ADMIN_USER && password===ADMIN_PASS){
      const u={role:'admin',email:'admin'};
      if(remember) saveRemember(identifier,password); else clearRemember();
      setLoading(''); onLogin(u); onClose(); return;
    }
    try{
      const data=await signIn(identifier, password);
      if(remember) saveRemember(identifier,password); else clearRemember();
      onLogin({role:'vendor', email:data.user.email, userId:data.user.id, token:data.access_token});
      onClose();
    }catch(err){ setError(err.message); }
    setLoading('');
  }

  async function handleRegister(e){
    e.preventDefault(); setError(''); setSuccess(''); setLoading('Creating account…');
    try{
      await signUp(identifier, password);
      if(remember) saveRemember(identifier,password);
      setSuccess('Account created! Check your email to confirm, then log in.');
      setMode('login');
    }catch(err){ setError(err.message); }
    setLoading('');
  }

  return (
    <div onClick={handleBackdrop} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:360,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:600,marginBottom:4}}>
          {mode==='login' ? 'Welcome back' : 'Create account'}
        </div>
        <p style={{fontSize:'0.78rem',color:'var(--light)',marginBottom:22}}>
          {mode==='login' ? 'Login to manage your vendor profile' : 'Register as a new vendor on VowFinds'}
        </p>
        <form onSubmit={mode==='login' ? handleLogin : handleRegister}>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Email</label>
            <input style={{...inputStyle,marginBottom:0}} type="text" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="your@email.com" required autoFocus/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Password</label>
            <input style={{...inputStyle,marginBottom:0}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={mode==='register'?6:1}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}} onClick={()=>setRemember(r=>!r)}>
            <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${remember?'var(--forest)':'var(--light)'}`,background:remember?'var(--forest)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
              {remember&&<span style={{color:'white',fontSize:'0.6rem',lineHeight:1}}>✓</span>}
            </div>
            <span style={{fontSize:'0.78rem',color:'var(--mid)',userSelect:'none'}}>Remember my details</span>
          </div>
          {error && <div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8,border:'1px solid rgba(196,130,106,0.2)'}}>{error}</div>}
          {success && <div style={{fontSize:'0.78rem',color:'var(--forest)',marginBottom:12,padding:'10px 12px',background:'rgba(58,74,63,0.07)',borderRadius:8}}>{success}</div>}
          <button type="submit" disabled={!!loading} style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:loading?'wait':'pointer',letterSpacing:'0.05em'}}>
            {loading || (mode==='login' ? 'Login' : 'Create Account')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:'0.78rem',color:'var(--mid)'}}>
          {mode==='login' ? (
            <span>Not a vendor yet?{' '}<span onClick={()=>{setMode('register');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Create account</span></span>
          ) : (
            <span>Already have an account?{' '}<span onClick={()=>{setMode('login');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Login</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DATE PICKER ───────────────────────────────────────────────────────────────
// Single button that opens a dropdown with two modes: pick a day or pick a month
function DateRangePicker({dateFrom, dateTo, setDateFrom, setDateTo}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('day'); // 'day' | 'month'
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const ref = useRef();

  // Close on outside click
  useEffect(()=>{
    function handle(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  },[]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build label for the button
  function label() {
    if(!dateFrom) return 'Select date';
    if(mode==='month'||(!dateTo||dateTo===dateFrom)){
      // Check if it's a whole month
      if(dateTo && dateTo !== dateFrom) {
        const from = new Date(dateFrom), to = new Date(dateTo);
        if(from.getDate()===1) {
          const last = new Date(from.getFullYear(), from.getMonth()+1, 0);
          if(to.toISOString().split('T')[0] === last.toISOString().split('T')[0]) {
            return MONTHS[from.getMonth()].slice(0,3) + ' ' + from.getFullYear();
          }
        }
        return formatDateDisplay(dateFrom) + ' – ' + formatDateDisplay(dateTo);
      }
      return formatDateDisplay(dateFrom);
    }
    return formatDateDisplay(dateFrom) + (dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):'');
  }

  function selectDay(day) {
    const key = dateKey(viewYear, viewMonth, day);
    if(!dateFrom || (dateFrom && dateTo && dateFrom!==todayStr)) {
      // Start fresh selection
      setDateFrom(key); setDateTo(key);
    } else if(dateFrom && (!dateTo || dateTo===dateFrom)) {
      // Second click — set end date
      if(key < dateFrom) { setDateFrom(key); setDateTo(dateFrom); }
      else { setDateTo(key); }
      setOpen(false);
    } else {
      setDateFrom(key); setDateTo(key);
    }
  }

  function selectSingleDay(day) {
    const key = dateKey(viewYear, viewMonth, day);
    setDateFrom(key); setDateTo(key);
    setOpen(false);
  }

  function selectMonth(monthIdx, year) {
    const first = `${year}-${String(monthIdx+1).padStart(2,'0')}-01`;
    const lastDay = new Date(year, monthIdx+1, 0).getDate();
    const last = `${year}-${String(monthIdx+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    setDateFrom(first); setDateTo(last);
    setOpen(false);
  }

  function clear() { setDateFrom(''); setDateTo(''); setOpen(false); }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

  const hasSelection = !!dateFrom;
  const btnLabel = label();

  return (
    <div ref={ref} style={{position:'relative',gridColumn:'span 2'}}>
      <label style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:5,display:'block'}}>Wedding Date</label>
      <button
        type="button"
        onClick={()=>setOpen(o=>!o)}
        style={{
          width:'100%',border:`1.5px solid ${open?'var(--rose)':'var(--parchment)'}`,
          borderRadius:9,padding:'11px 14px',
          fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',
          color: hasSelection?'var(--charcoal)':'var(--light)',
          background:'var(--cream)',outline:'none',
          display:'flex',alignItems:'center',justifyContent:'space-between',
          cursor:'pointer',transition:'border-color 0.15s',
          textAlign:'left',
        }}
      >
        <span>📅 {btnLabel}</span>
        <span style={{fontSize:'0.7rem',color:'var(--light)',marginLeft:8}}>{open?'▲':'▼'}</span>
      </button>

      {open&&(
        <div style={{
          position:'absolute',top:'calc(100% + 6px)',left:0,right:0,
          background:'var(--white)',borderRadius:14,
          boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
          border:'1px solid var(--parchment)',
          zIndex:500,overflow:'hidden',
        }}>
          {/* Mode tabs */}
          <div style={{display:'flex',borderBottom:'1px solid var(--parchment)'}}>
            {['day','month'].map(m=>(
              <button key={m} type="button" onClick={()=>setMode(m)} style={{
                flex:1,padding:'10px',border:'none',cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:mode===m?600:400,
                background:mode===m?'var(--cream)':'var(--white)',
                color:mode===m?'var(--forest)':'var(--light)',
                borderBottom:mode===m?'2px solid var(--rose)':'2px solid transparent',
                transition:'all 0.15s',
              }}>
                {m==='day'?'📆 Specific day':'🗓 Whole month'}
              </button>
            ))}
          </div>

          {/* Nav row */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px 6px'}}>
            <button type="button" onClick={()=>{
              if(mode==='month'){setViewYear(y=>y-1);}
              else{let m=viewMonth-1,y=viewYear;if(m<0){m=11;y--;}setViewMonth(m);setViewYear(y);}
            }} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--mid)',padding:'2px 8px'}}>‹</button>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)'}}>
              {mode==='month'?viewYear:`${MONTHS[viewMonth].slice(0,3)} ${viewYear}`}
            </span>
            <button type="button" onClick={()=>{
              if(mode==='month'){setViewYear(y=>y+1);}
              else{let m=viewMonth+1,y=viewYear;if(m>11){m=0;y++;}setViewMonth(m);setViewYear(y);}
            }} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--mid)',padding:'2px 8px'}}>›</button>
          </div>

          {mode==='day'&&(
            <div style={{padding:'4px 12px 12px'}}>
              {/* Day of week headers */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
                {DOWS.map(d=><div key={d} style={{textAlign:'center',fontSize:'0.6rem',color:'var(--light)',fontWeight:500,padding:'3px 0',textTransform:'uppercase',letterSpacing:'0.06em'}}>{d}</div>)}
              </div>
              {/* Days grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                {Array(firstDow).fill(null).map((_,i)=><div key={'e'+i}/>)}
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const key=dateKey(viewYear,viewMonth,day);
                  const isPast=key<todayStr;
                  const isFrom=key===dateFrom, isTo=key===dateTo;
                  const inRange=dateFrom&&dateTo&&key>dateFrom&&key<dateTo;
                  const isToday=key===todayStr;
                  return(
                    <div key={day}
                      onClick={()=>!isPast&&selectSingleDay(day)}
                      style={{
                        textAlign:'center',fontSize:'0.82rem',padding:'7px 3px',
                        borderRadius:7,cursor:isPast?'not-allowed':'pointer',
                        background:isFrom||isTo?'var(--forest)':inRange?'rgba(58,74,63,0.1)':'transparent',
                        color:isFrom||isTo?'var(--gold-light)':isPast?'var(--light)':'var(--charcoal)',
                        fontWeight:isFrom||isTo?700:isToday?600:400,
                        outline:isToday&&!isFrom&&!isTo?'1.5px solid var(--gold)':'none',
                        opacity:isPast?0.35:1,
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={e=>{if(!isPast&&!isFrom&&!isTo)e.currentTarget.style.background='var(--parchment)';}}
                      onMouseLeave={e=>{if(!isPast&&!isFrom&&!isTo)e.currentTarget.style.background=inRange?'rgba(58,74,63,0.1)':'transparent';}}
                    >{day}</div>
                  );
                })}
              </div>
              <div style={{fontSize:'0.7rem',color:'var(--light)',textAlign:'center',marginTop:8}}>Click a day to select it</div>
            </div>
          )}

          {mode==='month'&&(
            <div style={{padding:'6px 12px 14px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {MONTHS.map((m,i)=>{
                  const isPast=new Date(viewYear,i+1,0)<today;
                  const isSelected=dateFrom&&new Date(dateFrom).getMonth()===i&&new Date(dateFrom).getFullYear()===viewYear&&dateTo&&new Date(dateTo).getDate()===new Date(viewYear,i+1,0).getDate();
                  return(
                    <button key={m} type="button"
                      onClick={()=>!isPast&&selectMonth(i,viewYear)}
                      style={{
                        padding:'9px 6px',border:`1.5px solid ${isSelected?'var(--forest)':'var(--parchment)'}`,
                        borderRadius:8,cursor:isPast?'not-allowed':'pointer',
                        fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',
                        background:isSelected?'var(--forest)':'var(--cream)',
                        color:isSelected?'var(--gold-light)':isPast?'var(--light)':'var(--charcoal)',
                        fontWeight:isSelected?600:400,
                        opacity:isPast?0.4:1,
                        transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{if(!isPast&&!isSelected){e.currentTarget.style.background='var(--parchment)';e.currentTarget.style.borderColor='var(--blush)';}}}
                      onMouseLeave={e=>{if(!isPast&&!isSelected){e.currentTarget.style.background='var(--cream)';e.currentTarget.style.borderColor='var(--parchment)';}}}
                    >{m.slice(0,3)}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clear */}
          {hasSelection&&(
            <div style={{borderTop:'1px solid var(--parchment)',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'0.75rem',color:'var(--mid)'}}>
                {dateFrom&&dateTo&&dateFrom!==dateTo?`${formatDateDisplay(dateFrom)} → ${formatDateDisplay(dateTo)}`:dateFrom?formatDateDisplay(dateFrom):''}
              </span>
              <button type="button" onClick={clear} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--rose)',fontWeight:500}}>✕ Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── VENDOR CARD ───────────────────────────────────────────────────────────────
const VendorCard=memo(function VendorCard({vendor,unavail,dateFrom,dateTo,onClick,onRequestQuote,customerId=null,onFav=false}) {
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0),overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0,total=(vendor.fixed_rate||0)+travel+overnight,primaryImg=vendor.images?.[0]?.url;
  return (
    <div onClick={onClick} className="vf-vendor-card" style={{background:'var(--cream)',borderRadius:16,overflow:'hidden',boxShadow:'var(--card-shadow)',flex:'0 0 288px',width:288,position:'relative',cursor:'pointer',transition:'box-shadow 0.25s, transform 0.25s',filter:unavail?'saturate(0.3) opacity(0.75)':'none'}}
      onMouseEnter={e=>{if(!unavail){e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='var(--card-shadow-hover)';}}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--card-shadow)';}}>
      {unavail&&<div style={{position:'absolute',inset:0,background:'rgba(250,246,241,0.85)',borderRadius:16,zIndex:5,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,backdropFilter:'blur(3px)'}}>
        <div style={{fontSize:'2rem'}}>📅</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',color:'var(--mid)',fontWeight:600,textAlign:'center',padding:'0 16px'}}>Unavailable for your date</div>
        <div style={{fontSize:'0.74rem',color:'var(--light)'}}>{dateFrom?formatDateDisplay(dateFrom):''}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</div>
        <div style={{fontSize:'0.74rem',color:'var(--rose)',marginTop:4}}>Tap to view profile →</div>
      </div>}
      <div className="vf-card-img" style={{height:160,position:'relative',background:primaryImg?`url(${primaryImg}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}ee 0%,${vendor.color||'#c8a87a'}66 100%),linear-gradient(160deg,#ede5db 0%,#d8ccc0 100%)`}}>
        <div className="vf-card-type-badge" style={{position:'absolute',top:10,left:10,background:'rgba(58,74,63,0.88)',color:'var(--gold-light)',fontSize:'0.65rem',letterSpacing:'0.12em',textTransform:'uppercase',padding:'3px 9px',borderRadius:999,backdropFilter:'blur(4px)'}}>{vendor.type}</div>
        <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4,alignItems:'center'}}>
          {onFav&&<div onClick={e=>{e.stopPropagation();}} style={{background:'rgba(255,255,255,0.92)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}><FavStar vendor={vendor} customerId={customerId}/></div>}
          {vendor.instagram&&<a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="vf-card-ig" style={{background:'rgba(255,255,255,0.92)',color:'var(--rose)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',textDecoration:'none',fontWeight:700}}>ig</a>}
        </div>
      </div>
      <div className="vf-card-body" style={{padding:'16px 18px 18px'}}>
        <div className="vf-card-name" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:600,color:'var(--forest)',marginBottom:3}}>{vendor.name}</div>
        <div className="vf-card-location" style={{fontSize:'0.75rem',color:'var(--light)',marginBottom:10}}>📍 {vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km away`:''}</div>
        <div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.6,marginBottom:12,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{vendor.description}</div>
        {isOnRequest(vendor)?(
          <div className="vf-card-pricing" style={{background:'var(--cream)',borderRadius:9,padding:'10px 12px',display:'flex',flexDirection:'column',gap:4}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
              <span style={{fontSize:'0.7rem',color:'var(--mid)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Full pricing</span>
              <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--rose)',fontStyle:'italic'}}>On Request</span>
            </div>
            {(vendor.distance_km>0)&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Travel ({vendor.distance_km||0} km × R{vendor.per_km_rate}/km)</span><span style={{fontWeight:500}}>{fmt(travel)}</span></div>}
            {overnight>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Overnight fee</span><span style={{fontWeight:500}}>{fmt(overnight)}</span></div>}
          </div>
        ):(
          <div className="vf-card-pricing" style={{background:'var(--cream)',borderRadius:9,padding:'10px 12px',display:'flex',flexDirection:'column',gap:4}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Base rate</span><span style={{fontWeight:500}}>{fmt(vendor.fixed_rate)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Travel ({vendor.distance_km||0} km × R{vendor.per_km_rate}/km)</span><span style={{fontWeight:500}}>{fmt(travel)}</span></div>
            {overnight>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Overnight fee</span><span style={{fontWeight:500}}>{fmt(overnight)}</span></div>}
            <div style={{borderTop:'1px solid var(--parchment)',marginTop:3,paddingTop:4,display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--forest)',fontWeight:600,fontSize:'0.78rem'}}>Estimated total</span><span style={{color:'var(--rose)',fontWeight:700,fontSize:'0.84rem'}}>{fmt(total)}</span></div>
          </div>
        )}
        <div className="vf-card-btns" style={{marginTop:12,display:'flex',gap:8}}>
          <button style={{flex:1,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:9,fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',fontWeight:500,letterSpacing:'0.04em',cursor:'pointer'}} onClick={e=>{e.stopPropagation();onClick();}}>View profile</button>
          <button style={{flex:1,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:9,fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',fontWeight:500,letterSpacing:'0.04em',cursor:'pointer'}} onClick={e=>{e.stopPropagation();if(onRequestQuote)onRequestQuote();}}>Request Quote</button>
        </div>
      </div>
    </div>
  );
});

// ── VENDOR DETAIL ─────────────────────────────────────────────────────────────
function VendorDetail({vendor,dateFrom,dateTo,venueLabel,venueLatLng,onBack,onRequestQuote}) {
  const [calYear,setCalYear]=useState(()=>dateFrom?parseInt(dateFrom.split('-')[0]):new Date().getFullYear());
  const [calMonth,setCalMonth]=useState(()=>dateFrom?parseInt(dateFrom.split('-')[1])-1:new Date().getMonth());
  const [enquirySent,setEnquirySent]=useState(false);
  const [enquiryForm,setEnquiryForm]=useState({name:'',email:'',message:''});
  const [enquirySending,setEnquirySending]=useState(false);
  const [enquiryError,setEnquiryError]=useState('');
  const unavailSet=new Set((vendor.unavail_dates||[]).map(d=>d.date));
  const isUnavail=dateFrom&&(vendor.unavail_dates||[]).some(d=>{const dd=d.date;return dd>=dateFrom&&(!dateTo||dd<=dateTo);});
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0),overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0,total=(vendor.fixed_rate||0)+travel+overnight;
  const galleryImgs=vendor.images||[];
  return (
    <div style={{background:'var(--cream)',minHeight:'100vh'}}>
      <button onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:8,margin:'24px 32px 0',background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back to results</button>
      {isUnavail&&<div style={{display:'flex',alignItems:'center',gap:12,background:'#f5e8e4',border:'1.5px solid #e0b8a8',borderRadius:12,padding:'14px 20px',margin:'20px 32px 0'}}><span style={{fontSize:'1.4rem'}}>📅</span><div><div style={{fontSize:'0.88rem',color:'var(--deep-rose)',fontWeight:500}}>Unavailable on your wedding date</div><div style={{fontSize:'0.78rem',color:'var(--rose)'}}>This vendor is already booked during your selected dates.</div></div></div>}
      <div className="vf-vendor-detail-hero" style={{position:'relative',height:300,overflow:'hidden',marginTop:16,background:galleryImgs[0]?.url?`url(${galleryImgs[0].url}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}ff,${vendor.color||'#c8a87a'}88)`}}>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(22,32,24,0.88) 0%,rgba(22,32,24,0.08) 60%)'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'28px 32px'}}>
          <div style={{display:'inline-block',background:'rgba(201,169,110,0.18)',border:'1px solid var(--gold)',color:'var(--gold-light)',fontSize:'0.68rem',letterSpacing:'0.14em',textTransform:'uppercase',padding:'4px 12px',borderRadius:999,marginBottom:10}}>{vendor.type}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(1.8rem,4vw,2.6rem)',fontWeight:400,color:'var(--cream)',lineHeight:1.1,marginBottom:6}}>{vendor.name}</div>
          <div style={{fontSize:'0.82rem',color:'rgba(250,246,241,0.65)'}}>📍 {vendor.location}{venueLabel&&vendor.distance_km?` · ${vendor.distance_km} km from ${venueLabel}`:''}</div>
        </div>
      </div>
      <div className="vf-vendor-detail-grid" style={{maxWidth:1040,margin:'0 auto',padding:'32px 32px 60px',display:'grid',gridTemplateColumns:'1fr 340px',gap:36}}>
        <div>
          <section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>About this vendor</h3><p style={{fontSize:'0.92rem',color:'var(--mid)',lineHeight:1.85}}>{vendor.description} {vendor.extra_info}</p></section>
          {galleryImgs.length>0&&<section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Gallery</h3><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>{galleryImgs.slice(0,4).map((img,i)=><div key={i} style={{borderRadius:10,height:90,background:img.url?`url(${img.url}) center/cover`:`linear-gradient(${140+i*30}deg,${vendor.color||'#c8a87a'}dd,${vendor.color||'#c8a87a'}44)`}}/>)}</div></section>}
          <section style={{marginBottom:28}}>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>{venueLatLng&&vendor.lat?'Route from your venue':'Vendor location'}</h3>
            {venueLatLng&&vendor.distance_km&&<div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}}>
              {[['🚗','Distance',`${vendor.distance_km} km`],['💰','Travel cost',fmt(travel)],...(overnight>0?[['🌙','Overnight fee',fmt(overnight)]]:[])]
                .map(([icon,label,val],i)=><div key={i} style={{background:'var(--white)',borderRadius:10,padding:'10px 16px',boxShadow:'var(--card-shadow)',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:'1.2rem'}}>{icon}</span><div><div style={{fontSize:'0.7rem',color:'var(--light)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{label}</div><div style={{fontSize:'0.92rem',fontWeight:600,color:'var(--rose)'}}>{val}</div></div></div>)}
            </div>}
            <DetailMap vendor={vendor} venueLatLng={venueLatLng}/>
          </section>
          <section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Availability Calendar</h3><Calendar year={calYear} month={calMonth} unavailDates={unavailSet} weddingDate={dateFrom} onPrev={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}} onNext={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}}/></section>
          {vendor.instagram&&<section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Follow on Instagram</h3><a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:12,background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:12,padding:'14px 20px',textDecoration:'none'}}><div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg></div><div><div style={{fontSize:'0.92rem',fontWeight:500,color:'var(--charcoal)'}}>{vendor.instagram}</div><div style={{fontSize:'0.72rem',color:'var(--light)'}}>View on Instagram</div></div></a></section>}
          {isOnRequest(vendor)&&(
            <section>
              <div style={{display:'flex',alignItems:'flex-start',gap:12,background:'rgba(201,169,110,0.07)',border:'1px solid rgba(201,169,110,0.25)',borderRadius:12,padding:'14px 18px'}}>
                <span style={{fontSize:'1.2rem',flexShrink:0}}>ℹ️</span>
                <div>
                  <div style={{fontWeight:600,color:'var(--forest)',fontSize:'0.86rem',marginBottom:4}}>Pricing Disclaimer</div>
                  <div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.65}}>
                    The costs displayed above reflect <strong>travel and overnight fees only</strong>, calculated based on the distance from this vendor's home base to your venue. Full product and service pricing for {vendor.type} is <strong>on request</strong> — after you submit your quote request, the vendor will review your requirements and respond with a personalised quote.
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
        <div>
          <div className="vf-vendor-detail-sticky" style={{background:'var(--white)',borderRadius:16,padding:24,boxShadow:'var(--card-shadow)',position:'sticky',top:80}}>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',color:'var(--forest)',marginBottom:4}}>
              {isOnRequest(vendor)?'Request a Quote':'Pricing Estimate'}
            </h3>
            <button onClick={()=>onRequestQuote&&onRequestQuote(vendor)} style={{width:'100%',marginBottom:14,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:600,cursor:'pointer',letterSpacing:'0.04em'}}>💌 {isOnRequest(vendor)?'Request a Quote':'Request a Quote'}</button>
            {isOnRequest(vendor)?(
              <>
                {/* On Request banner */}
                <div style={{background:'rgba(196,130,106,0.06)',borderRadius:10,padding:'12px 14px',marginBottom:14,border:'1px solid rgba(196,130,106,0.15)',textAlign:'center'}}>
                  <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:4}}>Full Pricing</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--rose)',fontStyle:'italic',marginBottom:4}}>On Request</div>
                  <div style={{fontSize:'0.74rem',color:'var(--mid)'}}>Submit the questionnaire and the vendor will respond with a personalised quote.</div>
                </div>
                {/* Travel costs still shown */}
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:10}}>{venueLabel?`Venue: ${venueLabel}`:'Add a venue to see travel costs'}</p>
                {[...(travel>0?[[`Travel (${vendor.distance_km||0} km × R${vendor.per_km_rate}/km)`,fmt(travel)]]:[[`Travel rate`,`R${vendor.per_km_rate||0}/km`]]), ...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])].map(([l,v],i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--parchment)',fontSize:'0.84rem'}}>
                    <span style={{color:'var(--mid)'}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
                  </div>
                ))}
                {overnight>0&&<div style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:10,background:'rgba(196,130,106,0.08)',color:'var(--rose)',fontSize:'0.74rem',padding:'5px 11px',borderRadius:8,border:'1px solid rgba(196,130,106,0.22)'}}>🌙 Overnight stay may be required</div>}
              </>
            ):(
              <>
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:18}}>{venueLabel?`Venue: ${venueLabel}`:'Based on your venue location'}</p>
                {[['Base rate',fmt(vendor.fixed_rate)],[`Travel (${vendor.distance_km||0} km × R${vendor.per_km_rate}/km)`,fmt(travel)],...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])].map(([l,v],i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--parchment)',fontSize:'0.84rem'}}><span style={{color:'var(--mid)'}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,paddingTop:14,borderTop:'2px solid var(--parchment)'}}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>Total estimate</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',color:'var(--rose)',fontWeight:600}}>{fmt(total)}</span></div>
                {overnight>0&&<div style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:12,background:'rgba(196,130,106,0.08)',color:'var(--rose)',fontSize:'0.74rem',padding:'5px 11px',borderRadius:8,border:'1px solid rgba(196,130,106,0.22)'}}>🌙 Overnight stay required</div>}
              </>
            )}
            {!enquirySent?(
              <>
                <div style={{borderTop:'1px solid var(--parchment)',marginTop:16,paddingTop:16}}>
                  <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>Send an Enquiry</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <input value={enquiryForm.name} onChange={e=>setEnquiryForm(f=>({...f,name:e.target.value}))} placeholder="Your name" style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
                    <input value={enquiryForm.email} onChange={e=>setEnquiryForm(f=>({...f,email:e.target.value}))} placeholder="Your email" type="email" style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
                    <textarea value={enquiryForm.message} onChange={e=>setEnquiryForm(f=>({...f,message:e.target.value}))} placeholder="Tell the vendor about your wedding…" rows={3} style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%',resize:'vertical'}}/>
                  </div>
                  {enquiryError&&<div style={{fontSize:'0.76rem',color:'var(--rose)',marginTop:6}}>{enquiryError}</div>}
                </div>
                <button
                  disabled={isUnavail||enquirySending}
                  onClick={async()=>{
                    if(!enquiryForm.name||!enquiryForm.email){setEnquiryError('Please enter your name and email.');return;}
                    setEnquirySending(true);setEnquiryError('');
                    try{
                      await supaFetch('enquiries',{method:'POST',body:JSON.stringify({
                        vendor_id:vendor.id,
                        customer_name:enquiryForm.name,
                        customer_email:enquiryForm.email,
                        message:enquiryForm.message,
                        wedding_date:dateFrom||null,
                        venue:venueLabel||null,
                      }),prefer:'return=minimal'});
                      setEnquirySent(true);
                    }catch(e){setEnquiryError('Could not send enquiry. Please try again.');}
                    setEnquirySending(false);
                  }}
                  style={{width:'100%',marginTop:12,background:isUnavail?'var(--light)':'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:12,fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:(isUnavail||enquirySending)?'not-allowed':'pointer',letterSpacing:'0.04em'}}>
                  {enquirySending?'Sending…':isUnavail?'Unavailable for your dates':'Send Enquiry'}
                </button>
              </>
            ):(
              <div style={{textAlign:'center',padding:'16px 12px',background:'rgba(58,74,63,0.07)',borderRadius:10,marginTop:16}}>
                <div style={{fontSize:'1.5rem',marginBottom:6}}>✓</div>
                <div style={{fontSize:'0.88rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>Enquiry sent!</div>
                <div style={{fontSize:'0.78rem',color:'var(--mid)'}}>The vendor will be in touch at <strong>{enquiryForm.email}</strong></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VENDOR LANE ───────────────────────────────────────────────────────────────
function VendorLane({type,vendors,dateFrom,dateTo,onOpenDetail,isLast,onRequestQuote,customerId=null}) {
  // On-request categories have no fixed pricing — skip the price slider entirely
  const allOnRequest = ON_REQUEST_TYPES.has(type);
  const totals=vendors.map(v=>calcTotal(v));
  const maxT=Math.max(...totals,1000),minT=Math.min(...totals,0),avgT=avg(totals),sliderMax=Math.ceil(maxT*1.15/1000)*1000;
  const [maxPrice,setMaxPrice]=useState(sliderMax);
  const pct=Math.round(((maxPrice-minT)/(sliderMax-minT))*100),avgPct=avgT>0?Math.round(((avgT-minT)/(sliderMax-minT))*100):0;
  const visible=allOnRequest?vendors:vendors.filter(v=>calcTotal(v)<=maxPrice);
  return (
    <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
      <div className="vf-lane-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',marginBottom:16,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{fontSize:'1.3rem'}}>{TYPE_EMOJI[type]}</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
          <span style={{fontSize:'0.75rem',color:'var(--light)',background:'var(--parchment)',padding:'3px 10px',borderRadius:999}}>{visible.length} of {vendors.length} vendor{vendors.length!==1?'s':''}</span>
          {allOnRequest&&<span style={{fontSize:'0.72rem',color:'var(--rose)',fontStyle:'italic',fontWeight:500}}>On Request</span>}
        </div>
        {!allOnRequest&&(
          <div style={{background:'var(--white)',borderRadius:10,padding:'10px 18px',boxShadow:'var(--card-shadow)',display:'flex',flexDirection:'column',gap:6,minWidth:260}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span style={{fontSize:'0.7rem',letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--mid)'}}>Max price</span><span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--rose)'}}>{fmt(maxPrice)}</span></div>
            <div style={{position:'relative'}}>
              <input type="range" min={minT} max={sliderMax} step={500} value={maxPrice} onChange={e=>setMaxPrice(parseInt(e.target.value))} style={{width:'100%',WebkitAppearance:'none',appearance:'none',height:4,borderRadius:2,outline:'none',cursor:'pointer',background:`linear-gradient(to right,var(--rose) 0%,var(--rose) ${pct}%,var(--parchment) ${pct}%,var(--parchment) 100%)`}}/>
              <div style={{position:'absolute',top:-3,left:`${avgPct}%`,transform:'translateX(-50%)',width:2,height:10,background:'var(--gold)',borderRadius:1,pointerEvents:'none'}}/>
            </div>
            <div style={{fontSize:'0.72rem',color:'var(--light)',display:'flex',alignItems:'center',gap:4}}><span>Avg. for this category:</span><span style={{color:'var(--gold)',fontWeight:500}}>{fmt(avgT)}</span></div>
          </div>
        )}
      </div>
      <div style={{position:'relative'}}>
        <div className="vf-lane-fade-left" style={{position:'absolute',top:0,bottom:20,left:0,width:40,background:'linear-gradient(to right,#ffffff,transparent)',zIndex:10,pointerEvents:'none'}}/>
        <div className="vf-lane-fade-right" style={{position:'absolute',top:0,bottom:20,right:0,width:40,background:'linear-gradient(to left,#ffffff,transparent)',zIndex:10,pointerEvents:'none'}}/>
        <div style={{display:'flex',gap:20,overflowX:'auto',padding:'4px 32px 20px',scrollbarWidth:'none'}}>
          {vendors.map(v=>{
            const ok=allOnRequest||calcTotal(v)<=maxPrice;
            const unavail=dateFrom&&(v.unavail_dates||[]).some(d=>{const dd=d.date;return dd>=dateFrom&&(!dateTo||dd<=dateTo);});
            if(!ok)return null;
            return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo} onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)} customerId={customerId} onFav={!!customerId}/>;
          })}
          {visible.length===0&&<div style={{padding:'24px 0',fontSize:'0.85rem',color:'var(--light)',fontStyle:'italic'}}>No vendors match this price filter.</div>}
        </div>
      </div>
      {!isLast&&<hr className="vf-lane-divider" style={{border:'none',borderTop:'1px solid var(--parchment)',margin:'8px 32px 40px'}}/>}
    </div>
  );
}

// ── VENDOR FORM (shared by dashboard + admin) ─────────────────────────────────
function VendorForm({initialData=null, vendorId=null, userId=null, onSaved, onCancel}) {
  const [form,setForm]=useState({name:'',type:'',location:'',description:'',extra_info:'',instagram:'',fixed_rate:'',per_km_rate:'',overnight_fee:'',overnight_threshold_km:'80',...(initialData||{})});
  const [latLng,setLatLng]=useState(initialData?.lat?{lat:initialData.lat,lng:initialData.lng}:null);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [images,setImages]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [unavailDates,setUnavailDates]=useState(new Set(initialData?._unavailDates||[]));
  // Track vendor ID as internal state so images work immediately after first save
  const [currentVendorId,setCurrentVendorId]=useState(vendorId);
  const fileRef=useRef(),locRef=useRef();

  useEffect(()=>{
    if(initialData?.images)setImages(initialData.images.map(i=>({url:i.url,path:''})));
    loadGoogleMaps().then(google=>{
      if(!locRef.current)return;
      const ac=new google.maps.places.Autocomplete(locRef.current,{types:['geocode','establishment'],componentRestrictions:{country:'za'}});
      ac.addListener('place_changed',()=>{const place=ac.getPlace();if(place.geometry){setLatLng({lat:place.geometry.location.lat(),lng:place.geometry.location.lng()});setForm(f=>({...f,location:place.formatted_address||place.name}));}});
    });
  },[]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  async function save(){
    if(!form.name||!form.type){setSaveError('Please fill in Business Name and Type.');return;}
    setSaving(true);setSaveError('');
    try{
      const payload={name:form.name,type:form.type,location:form.location,description:form.description,extra_info:form.extra_info,instagram:form.instagram,fixed_rate:parseInt(form.fixed_rate)||0,per_km_rate:parseInt(form.per_km_rate)||0,overnight_fee:parseInt(form.overnight_fee)||0,overnight_threshold_km:parseInt(form.overnight_threshold_km)||80,distance_km:0,color:'#c8a87a',...(latLng?{lat:latLng.lat,lng:latLng.lng}:{}),...(userId?{user_id:userId}:{})};
      let id=currentVendorId;
      if(id){await supaFetch(`vendors?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(payload),prefer:'return=minimal'});}
      else{const res=await supaFetch('vendors',{method:'POST',body:JSON.stringify(payload)});id=Array.isArray(res)?res[0]?.id:res?.id;setCurrentVendorId(id);}
      if(id){
        await supaFetch(`vendor_unavailable_dates?vendor_id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});
        if(unavailDates.size>0)await supaFetch('vendor_unavailable_dates',{method:'POST',body:JSON.stringify([...unavailDates].map(date=>({vendor_id:id,date}))),prefer:'return=minimal'});
      }
      setSaved(true);setTimeout(()=>setSaved(false),3000);
      if(onSaved)onSaved(id);
    }catch(e){setSaveError('Save failed: '+e.message);}
    setSaving(false);
  }

  async function uploadImages(files){
    if(!currentVendorId){setSaveError('Please save the profile first, then upload images.');return;}
    setUploading(true);
    for(const file of files){
      const ext=file.name.split('.').pop(),path=`${currentVendorId}/${Date.now()}.${ext}`;
      const ur=await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-images/${path}`,{method:'POST',headers:{'apikey':SUPABASE_PUB_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':file.type},body:file});
      if(ur.ok){
        const url=storageUrl(path);
        await supaFetch('vendor_images',{method:'POST',body:JSON.stringify({vendor_id:currentVendorId,url,is_primary:images.length===0,sort_order:images.length}),prefer:'return=minimal'});
        setImages(prev=>[...prev,{url,path}]);
      } else {
        const errText=await ur.text().catch(()=>'Unknown error');
        setSaveError('Image upload failed: '+errText);
      }
    }
    setUploading(false);
  }

  async function removeImage(url){
    if(!currentVendorId)return;
    await supaFetch(`vendor_images?vendor_id=eq.${currentVendorId}&url=eq.${encodeURIComponent(url)}`,{method:'DELETE',prefer:'return=minimal'});
    setImages(prev=>prev.filter(i=>i.url!==url));
  }

  function toggleUnavail(key){setUnavailDates(prev=>{const next=new Set(prev);next.has(key)?next.delete(key):next.add(key);return next;});}

  return (
    <div>
      <div style={sectionStyle}>
        <h3 style={h3Style}>Business Details</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div><label style={labelStyle}>Business Name</label><input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Lumière Photography"/></div>
          <div><label style={labelStyle}>Vendor Type</label><select style={inputStyle} value={form.type} onChange={e=>set('type',e.target.value)}><option value="">— Select type —</option>{ALL_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Business Description</label><textarea style={{...inputStyle,resize:'vertical',minHeight:80}} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Tell couples what makes your business special..."/></div>
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Additional Information</label><textarea style={{...inputStyle,resize:'vertical',minHeight:60}} value={form.extra_info} onChange={e=>set('extra_info',e.target.value)} placeholder="Packages, what's included, special notes..."/></div>
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Home Base Location</label><input ref={locRef} style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Start typing your address…"/>{latLng&&<div style={{fontSize:'0.72rem',color:'var(--forest)',marginTop:5}}>✓ Location pinned ({latLng.lat.toFixed(4)}, {latLng.lng.toFixed(4)})</div>}</div>
          <div><label style={labelStyle}>Instagram Handle</label><input style={inputStyle} value={form.instagram} onChange={e=>set('instagram',e.target.value)} placeholder="@yourbusiness"/></div>
        </div>
      </div>
      <div style={sectionStyle}>
        <h3 style={h3Style}>Pricing Structure</h3>
        {ON_REQUEST_TYPES.has(form.type)&&(
          <div style={{background:'rgba(196,130,106,0.08)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:'0.82rem',color:'var(--mid)',border:'1px solid rgba(196,130,106,0.2)'}}>
            ℹ️ <strong>{form.type}</strong> is an <em>On Request</em> category — customers will not see a fixed price. They will submit a questionnaire to receive your personalised quote.
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {!ON_REQUEST_TYPES.has(form.type)&&<div><label style={labelStyle}>Fixed Base Rate (R)</label><input style={inputStyle} type="number" value={form.fixed_rate} onChange={e=>set('fixed_rate',e.target.value)} placeholder="15000"/></div>}
          {[['Travel Cost per km (R)','per_km_rate','8'],['Overnight Fee (R)','overnight_fee','1200'],['Overnight Threshold (km)','overnight_threshold_km','80']].map(([lbl,key,ph])=>(
            <div key={key}><label style={labelStyle}>{lbl}</label><input style={inputStyle} type="number" value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph}/></div>
          ))}
        </div>
        <div style={{marginTop:14,background:'var(--parchment)',borderRadius:8,padding:'12px 16px',fontSize:'0.8rem',color:'var(--mid)'}}>💡 Travel cost = driving distance from your home base to the customer's venue × your per km rate.</div>
      </div>
      <div style={sectionStyle}>
        <h3 style={h3Style}>Business Images</h3>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
          {images.map((img,i)=><div key={i} style={{position:'relative',width:80,height:80,borderRadius:10,overflow:'hidden'}}><img src={img.url} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/><button onClick={()=>removeImage(img.url)} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.6)',color:'white',border:'none',borderRadius:'50%',width:20,height:20,cursor:'pointer',fontSize:'0.7rem',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>)}
          <div onClick={()=>fileRef.current?.click()} style={{width:80,height:80,borderRadius:10,border:'1.5px dashed var(--blush)',background:'var(--parchment)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'1.4rem',color:'var(--light)'}}>{uploading?'⏳':'+'}</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>uploadImages([...e.target.files])}/>
        <p style={{fontSize:'0.74rem',color:'var(--light)'}}>Save profile first, then upload images.</p>
      </div>

      {saveError&&<p style={{color:'var(--rose)',fontSize:'0.84rem',marginBottom:8}}>{saveError}</p>}
      <div style={{display:'flex',gap:12}}>
        {onCancel&&<button onClick={onCancel} style={{flex:1,background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:10,padding:'13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',cursor:'pointer'}}>Cancel</button>}
        <button onClick={save} disabled={saving} style={{flex:2,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'13px 32px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:saving?'wait':'pointer',letterSpacing:'0.04em'}}>{saving?'Saving…':'Save & Publish Profile'}</button>
      </div>
      {saved&&<div style={{textAlign:'center',color:'var(--forest)',fontSize:'0.88rem',marginTop:12,padding:10,background:'rgba(58,74,63,0.07)',borderRadius:8}}>✓ Profile saved successfully!</div>}
    </div>
  );
}

// ── VENDOR DASHBOARD (logged-in vendor) ───────────────────────────────────────
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
      const data=await supaFetch(`vendors?user_id=eq.${user.userId}&select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=name`);
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
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back to dashboard</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Add New Vendor Profile</h2>
      <VendorForm userId={user.userId} onSaved={()=>{setEditing(null);loadMyVendors();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(editing&&editData)return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back to dashboard</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Edit: {editData.name}</h2>
      <VendorForm initialData={editData} vendorId={editing} userId={user.userId} onSaved={()=>{setEditing(null);loadMyVendors();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(activeLead)return(
    <div style={{padding:'24px 28px',maxWidth:860,margin:'0 auto'}}>
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

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>

      {/* Dashboard header */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'20px 32px',boxShadow:'0 2px 12px rgba(0,0,0,0.04)'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:400,color:'var(--forest)',marginBottom:2}}>Vendor Dashboard</h2>
            <p style={{color:'var(--light)',fontSize:'0.8rem'}}>{user.email}</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setEditing('new')} style={{background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:'9px 18px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>+ Add Vendor</button>
            <button onClick={onLogout} style={{background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:8,padding:'9px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',cursor:'pointer'}}>Logout</button>
          </div>
        </div>
      </div>

      {/* Main dashboard grid */}
      <div style={{maxWidth:1200,margin:'0 auto',padding:'28px 28px 60px',display:'grid',gridTemplateColumns:'1fr 380px',gap:24,alignItems:'start'}}>

        {/* LEFT COLUMN */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>

          {/* ── VENDOR PROFILE SECTION ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>🏪 My Vendor Profile</div>
            </div>
            <div style={{padding:'16px 22px'}}>
              {loading?<div style={{textAlign:'center',padding:'30px',color:'var(--light)'}}>Loading…</div>:
                myVendors.length===0?(
                  <div style={{textAlign:'center',padding:'30px 16px'}}>
                    <div style={{fontSize:'2rem',marginBottom:8}}>🌿</div>
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
                          <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:1}}>{TYPE_EMOJI[v.type]} {v.type} · 📍 {v.location}</div>
                          <div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:1}}>Base: {fmt(v.fixed_rate)} · R{v.per_km_rate}/km</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button onClick={e=>{e.stopPropagation();startEdit(v);}} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:6,padding:'6px 12px',fontSize:'0.75rem',cursor:'pointer'}}>✏️ Edit</button>
                          <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:6,padding:'6px 10px',fontSize:'0.75rem',cursor:'pointer'}}>🗑</button>
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
                💌 Leads & Conversations
                {newLeadsCount>0&&<span style={{marginLeft:8,background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.68rem',padding:'2px 8px',fontWeight:600}}>{newLeadsCount} new</span>}
              </div>
              <button onClick={loadLeads} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--mid)'}}>↻ Refresh</button>
            </div>
            <div style={{padding:'12px 22px 16px'}}>
              {leadsLoading?<div style={{textAlign:'center',padding:'24px',color:'var(--light)'}}>Loading leads…</div>:
                leads.length===0?(
                  <div style={{textAlign:'center',padding:'32px 16px'}}>
                    <div style={{fontSize:'2rem',marginBottom:8}}>📭</div>
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
                          {lead.status==='responded'?'💬':lead.status==='closed'?'✅':'💌'}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'0.88rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.title}</div>
                          <div style={{fontSize:'0.74rem',color:'var(--mid)',marginTop:1}}>👤 {lead.customer_name}</div>
                          {lead.last_message&&<div style={{fontSize:'0.72rem',color:'var(--light)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.last_message.sender_role==='customer'?lead.customer_name+': ':''}{ lead.last_message.message_text||'📎 Attachment'}</div>}
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

        {/* RIGHT COLUMN */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>

          {/* ── AVAILABILITY CALENDAR ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>📅 Availability</div>
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
                  <p style={{fontSize:'0.74rem',color:'var(--mid)',marginBottom:10}}>Click a date to block/unblock it.</p>
                  <Calendar year={cal1Y} month={cal1M} unavailDates={unavailDates} editable onToggle={toggleUnavail}
                    onPrev={()=>{let m=cal1M-1,y=cal1Y;if(m<0){m=11;y--;}setCal1M(m);setCal1Y(y);}}
                    onNext={()=>{let m=cal1M+1,y=cal1Y;if(m>11){m=0;y++;}setCal1M(m);setCal1Y(y);}}/>
                  <div style={{marginTop:12,display:'flex',alignItems:'center',gap:10}}>
                    <button onClick={saveAvailability} disabled={calSaving} style={{flex:1,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:'9px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.84rem',fontWeight:500,cursor:calSaving?'wait':'pointer'}}>
                      {calSaving?'Saving…':'Save'}
                    </button>
                    {calSaved&&<span style={{fontSize:'0.8rem',color:'var(--forest)',fontWeight:500}}>✓ Saved!</span>}
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
function AdminDashboard({onLogout}) {
  const [allVendors,setAllVendors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [editData,setEditData]=useState(null);
  const [adminTab,setAdminTab]=useState('vendors'); // 'vendors' | 'diagnostics'
  const [search,setSearch]=useState('');

  useEffect(()=>{loadAll();},[]);

  async function loadAll(){
    setLoading(true);
    try{const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name');setAllVendors(data);}
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
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--gold-light)',fontWeight:600}}>⚙️ Admin Dashboard</div>
          <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.6)',marginTop:2}}>Full access — all vendor profiles</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{display:'flex',gap:4,background:'rgba(0,0,0,0.2)',borderRadius:8,padding:4}}>
            {['vendors','diagnostics'].map(t=><button key={t} onClick={()=>setAdminTab(t)} style={{background:adminTab===t?'rgba(255,255,255,0.15)':'none',border:'none',color:'rgba(255,255,255,0.9)',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:'0.78rem',fontWeight:500,textTransform:'capitalize'}}>{t==='diagnostics'?'🔧 Diagnostics':'📋 Vendors'}</button>)}
          </div>
          <button onClick={()=>setEditing('new')} style={{background:'var(--gold)',color:'var(--forest)',border:'none',borderRadius:8,padding:'8px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:600,cursor:'pointer'}}>+ Add Vendor</button>
          <button onClick={onLogout} style={{background:'rgba(255,255,255,0.15)',color:'white',border:'none',borderRadius:8,padding:'8px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      {adminTab==='diagnostics'?<DiagnosticPanel/>:(
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
                    onClick={()=>startEdit(v)}
                    style={{background:'var(--white)',borderRadius:12,padding:'16px 20px',boxShadow:'var(--card-shadow)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',cursor:'pointer',transition:'box-shadow 0.15s,transform 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--card-shadow-hover)';e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--card-shadow)';e.currentTarget.style.transform='';}}>
                    <div style={{width:52,height:52,borderRadius:8,background:v.images?.[0]?.url?`url(${v.images[0].url}) center/cover`:`linear-gradient(135deg,${v.color||'#c8a87a'}dd,${v.color||'#c8a87a'}66)`,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:600,color:'var(--forest)'}}>{v.name}</div>
                      <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:2}}>{TYPE_EMOJI[v.type]} {v.type} · 📍 {v.location}</div>
                      {v.user_id&&<div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:2}}>User ID: {v.user_id.slice(0,8)}…</div>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.78rem',color:'var(--forest)',background:'rgba(58,74,63,0.08)',padding:'4px 10px',borderRadius:999,fontWeight:500}}>{ON_REQUEST_TYPES.has(v.type)?'On Request':fmt(v.fixed_rate)}</span>
                      <button onClick={e=>{e.stopPropagation();startEdit(v);}} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',cursor:'pointer'}}>✏️ Edit</button>
                      <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:7,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',cursor:'pointer'}}>🗑 Delete</button>
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
      {results.map((r,i)=><div key={i} style={{background:bg[r.status],border:`1px solid ${colors[r.status]}22`,borderRadius:10,padding:'12px 16px',marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:10}}><span>{r.status==='ok'?'✅':r.status==='warn'?'⚠️':'❌'}</span><span style={{fontWeight:600,fontSize:'0.88rem',color:colors[r.status]}}>{r.label}</span></div><div style={{fontSize:'0.78rem',color:'#555',marginTop:4,fontFamily:'monospace',wordBreak:'break-all'}}>{r.detail}</div></div>)}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
// ── FAVOURITES STAR BUTTON ────────────────────────────────────────────────────
function FavStar({vendor,customerId,size=20}) {
  const [faved,setFaved]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!customerId)return;
    supaFetch(`favourites?customer_id=eq.${customerId}&vendor_id=eq.${vendor.id}&select=id`)
      .then(d=>{if(Array.isArray(d)&&d.length>0)setFaved(true);}).catch(()=>{});
  },[customerId,vendor.id]);

  async function toggle(e){
    e.stopPropagation();
    if(!customerId||loading)return;
    setLoading(true);
    try{
      if(faved){
        await supaFetch(`favourites?customer_id=eq.${customerId}&vendor_id=eq.${vendor.id}`,{method:'DELETE',prefer:'return=minimal'});
        setFaved(false);
      }else{
        await supaFetch('favourites',{method:'POST',body:JSON.stringify({customer_id:customerId,vendor_id:vendor.id}),prefer:'return=minimal'});
        setFaved(true);
      }
    }catch(e){}
    setLoading(false);
  }

  return(
    <button onClick={toggle} title={faved?'Remove from favourites':'Add to favourites'}
      style={{background:'none',border:'none',cursor:customerId?'pointer':'default',padding:2,lineHeight:1,opacity:loading?0.5:1,transition:'transform 0.15s'}}
      onMouseEnter={e=>{if(customerId)e.currentTarget.style.transform='scale(1.2)';}}
      onMouseLeave={e=>e.currentTarget.style.transform=''}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={faved?'#c9a96e':'none'} stroke={faved?'#c9a96e':'#a8a8a8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  );
}

// ── FAVOURITES VIEW ───────────────────────────────────────────────────────────
function FavouritesView({customerId,onOpenDetail,onRequestQuote,dateFrom,dateTo}) {
  const [favVendors,setFavVendors]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!customerId){setLoading(false);return;}
    supaFetch(`favourites?customer_id=eq.${customerId}&select=vendor:vendors(*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date))`)
      .then(data=>{
        const vendors=(data||[]).map(f=>f.vendor).filter(Boolean);
        setFavVendors(vendors);
      }).catch(()=>{}).finally(()=>setLoading(false));
  },[customerId]);

  if(loading)return<div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading favourites…</div>;

  if(!customerId)return(
    <div style={{textAlign:'center',padding:'60px 20px',maxWidth:500,margin:'0 auto'}}>
      <div style={{fontSize:'3rem',marginBottom:12}}>⭐</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>Sign in to save favourites</div>
      <p style={{color:'var(--mid)',fontSize:'0.88rem'}}>Create a customer account to bookmark vendors you love.</p>
    </div>
  );

  if(favVendors.length===0)return(
    <div style={{textAlign:'center',padding:'60px 20px',maxWidth:500,margin:'0 auto'}}>
      <div style={{fontSize:'3rem',marginBottom:12}}>⭐</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>No favourites yet</div>
      <p style={{color:'var(--mid)',fontSize:'0.88rem'}}>Star vendors while browsing to save them here.</p>
    </div>
  );

  const byType={};
  ALL_TYPES.forEach(t=>{const vv=favVendors.filter(v=>v.type===t);if(vv.length)byType[t]=vv;});

  return(
    <div style={{padding:'32px 28px 60px',maxWidth:1200,margin:'0 auto'}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',color:'var(--forest)',marginBottom:4}}>⭐ My Favourites</div>
      <p style={{color:'var(--light)',fontSize:'0.84rem',marginBottom:28}}>{favVendors.length} vendor{favVendors.length!==1?'s':''} saved</p>
      {Object.entries(byType).map(([type,vv])=>(
        <div key={type} style={{marginBottom:32}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            {TYPE_EMOJI[type]} {type}
          </div>
          <div style={{display:'flex',gap:18,overflowX:'auto',paddingBottom:8}}>
            {vv.map(v=>{
              const unavail=dateFrom&&(v.unavail_dates||[]).some(d=>{const dd=d.date;return dd>=dateFrom&&(!dateTo||dd<=dateTo);});
              return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo} onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)} customerId={customerId} onFav={!!customerId}/>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SCENARIO BUILDER ──────────────────────────────────────────────────────────
// Completely uncontrolled venue input — Google Autocomplete owns the DOM value.
// We only call back with name+latLng when a place is selected.
// `scenarioId` in the key ensures a fresh mount per scenario only.
function ScenarioVenueInput({scenarioId, initialValue, onPinned, pinned}) {
  const inputRef = useRef();

  useEffect(()=>{
    // Set the initial text without React controlling the field
    if(inputRef.current && initialValue) {
      inputRef.current.value = initialValue;
    }
    loadGoogleMaps().then(google=>{
      if(!inputRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment','geocode'],
        componentRestrictions: {country:'za'},
      });
      ac.addListener('place_changed', ()=>{
        const place = ac.getPlace();
        if(place.geometry){
          const ll = {lat:place.geometry.location.lat(), lng:place.geometry.location.lng()};
          const name = place.formatted_address || place.name;
          if(inputRef.current) inputRef.current.value = name;
          onPinned(name, ll);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — never re-run

  return (
    <div>
      <input
        ref={inputRef}
        style={{...inputStyle, borderColor: pinned ? 'var(--forest)' : undefined}}
        placeholder="e.g. Babylonstoren, Franschhoek"
      />
      {pinned
        ? <div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:3,fontWeight:500}}>✓ Location pinned — distances will be calculated</div>
        : <div style={{fontSize:'0.68rem',color:'var(--light)',marginTop:3}}>Start typing and select from the dropdown</div>
      }
    </div>
  );
}

function ScenarioBuilder({user,vendors:passedVendors,onClose}) {
  const [scenarios,setScenarios]=useState([{id:1,venue:'',venueLatLng:null,venuePinned:false,date:'',budgets:{}}]);
  const [results,setResults]=useState(null);
  const [selectedVendors,setSelectedVendors]=useState({});
  const [step,setStep]=useState('build');
  const [allVendors,setAllVendors]=useState(passedVendors||[]);
  const [vendorsLoading,setVendorsLoading]=useState(false);
  const [vendorsError,setVendorsError]=useState('');

  // Fetch all vendors on mount regardless of whether parent passed any
  useEffect(()=>{
    if(allVendors.length===0){
      setVendorsLoading(true);
      supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
        .then(data=>{setAllVendors(data||[]);})
        .catch(e=>{setVendorsError('Could not load vendors: '+e.message);})
        .finally(()=>setVendorsLoading(false));
    }
  },[]);

  function addScenario(){
    const id=Date.now();
    setScenarios(s=>[...s,{id,venue:'',venueLatLng:null,venuePinned:false,date:'',budgets:{}}]);
  }
  function removeScenario(id){setScenarios(s=>s.filter(sc=>sc.id!==id));}
  function updateScenario(id,field,val){setScenarios(s=>s.map(sc=>sc.id===id?{...sc,[field]:val}:sc));}
  function updateScenarioVenue(id,name,ll){setScenarios(s=>s.map(sc=>sc.id===id?{...sc,venue:name,venueLatLng:ll,venuePinned:true}:sc));}
  function updateBudget(id,type,val){setScenarios(s=>s.map(sc=>sc.id===id?{...sc,budgets:{...sc.budgets,[type]:val}}:sc));}

  const [running,setRunning]=useState(false);

  async function runScenarios(){
    setRunning(true);
    const res=await Promise.all(scenarios.map(async sc=>{
      // Re-calculate distances for each vendor from this scenario's venue
      let scenVendors=allVendors;
      if(sc.venueLatLng){
        try{
          const kms=await getBatchDistancesKm(sc.venueLatLng,allVendors);
          scenVendors=allVendors.map((v,i)=>({...v,distance_km:kms[i]||0}));
        }catch{scenVendors=allVendors;}
      }

      const availVendors={};
      ALL_TYPES.forEach(type=>{
        const budget=parseFloat(sc.budgets[type])||Infinity;
        availVendors[type]=scenVendors.filter(v=>{
          if(v.type!==type)return false;
          const unavail=sc.date&&(v.unavail_dates||[]).some(d=>d.date===sc.date);
          if(unavail)return false;
          if(ON_REQUEST_TYPES.has(type))return true;
          return calcTotal(v)<=budget;
        });
      });

      // Avg costs per category (using scenario-specific distances)
      const avgCosts={};
      ALL_TYPES.forEach(type=>{
        const tots=availVendors[type].filter(v=>!ON_REQUEST_TYPES.has(v.type)).map(v=>calcTotal(v));
        avgCosts[type]=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):null;
      });

      return{...sc,availVendors,avgCosts};
    }));
    setResults(res);
    setStep('results');
    setRunning(false);
  }

  function toggleSelectVendor(scenId,type,vendorId){
    setSelectedVendors(prev=>{
      const sc={...(prev[scenId]||{})};
      sc[type]=sc[type]===vendorId?null:vendorId;
      return{...prev,[scenId]:sc};
    });
  }

  function buildPrintHTML(scenList, mode) {
    // mode: 'single' (scenList=[one]) or 'comparison' (scenList=all)
    const date = new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'});
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>VowFinds ${mode==='comparison'?'Scenario Comparison':'Scenario Summary'}</title>
    <style>
      body{font-family:'Georgia',serif;color:#2c2c2c;max-width:900px;margin:0 auto;padding:32px 40px;font-size:13px;}
      h1{font-size:2rem;font-weight:300;color:#3a4a3f;margin-bottom:4px;}
      h2{font-size:1.3rem;font-weight:600;color:#3a4a3f;margin:0 0 4px;}
      h3{font-size:1rem;font-weight:600;color:#3a4a3f;margin:12px 0 6px;}
      .meta{color:#6b6b6b;font-size:0.82rem;margin-bottom:16px;}
      .header{border-bottom:2px solid #c9a96e;padding-bottom:12px;margin-bottom:24px;}
      .logo{font-size:1.6rem;color:#c9a96e;letter-spacing:0.08em;margin-bottom:4px;}
      .scenario{border:1px solid #f0e8dc;border-radius:8px;padding:16px 20px;margin-bottom:20px;break-inside:avoid;}
      .scenario-header{background:#3a4a3f;color:#e8d5a3;padding:10px 14px;border-radius:6px;margin-bottom:14px;}
      .vendor-row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f0e8dc;}
      .vendor-row:last-child{border-bottom:none;}
      .type-label{font-size:0.75rem;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.06em;}
      .vendor-name{font-weight:600;color:#3a4a3f;font-size:0.92rem;}
      .vendor-detail{font-size:0.78rem;color:#6b6b6b;margin-top:2px;}
      .price{font-weight:700;color:#c4826a;font-size:0.95rem;text-align:right;}
      .on-request{color:#c4826a;font-style:italic;font-size:0.85rem;}
      .total-row{display:flex;justify-content:space-between;padding:12px 0 0;margin-top:8px;border-top:2px solid #f0e8dc;font-size:1rem;}
      .total-label{font-weight:600;color:#3a4a3f;}
      .total-amount{font-weight:700;color:#c4826a;font-size:1.2rem;}
      .empty-row{color:#a8a8a8;font-style:italic;font-size:0.82rem;padding:4px 0;}
      .comparison-grid{display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;}
      .comparison-cell{border:1px solid #f0e8dc;border-radius:6px;padding:10px 12px;}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #f0e8dc;color:#a8a8a8;font-size:0.75rem;text-align:center;}
      @media print{body{padding:20px;} .no-print{display:none;}}
    </style></head><body>`;
    html+=`<div class="header"><div class="logo">VowFinds</div><h1>${mode==='comparison'?'Scenario Comparison':'Wedding Scenario Summary'}</h1><div class="meta">Generated ${date}</div></div>`;

    if(mode==='comparison'){
      // Side by side comparison header
      html+=`<div style="display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;margin-bottom:16px;">`;
      scenList.forEach((sc,i)=>{
        html+=`<div class="scenario-header" style="background:#3a4a3f;color:#e8d5a3;padding:10px 14px;border-radius:6px;"><strong>Scenario ${i+1}</strong><div style="font-size:0.82rem;opacity:0.8;margin-top:2px;">${sc.venue||'Unnamed Venue'}</div>${sc.date?`<div style="font-size:0.78rem;opacity:0.7;">${formatDateDisplay(sc.date)}</div>`:''}</div>`;
      });
      html+=`</div>`;
      ALL_TYPES.forEach(type=>{
        html+=`<h3>${TYPE_EMOJI[type]} ${type}</h3><div style="display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;margin-bottom:12px;">`;
        scenList.forEach(sc=>{
          const sel=selectedVendors[sc.id]||{};
          const vid=sel[type];
          const vendor=vid?sc.availVendors[type]?.find(v=>v.id===vid):null;
          const avail=sc.availVendors[type]||[];
          html+=`<div class="comparison-cell">`;
          if(vendor){
            html+=`<div class="vendor-name">${vendor.name}</div><div class="vendor-detail">📍 ${vendor.location}</div>`;
            html+=`<div style="margin-top:4px;">${ON_REQUEST_TYPES.has(type)?'<span class="on-request">On Request</span>':`<strong style="color:#c4826a;">${fmt(calcTotal(vendor))}</strong>`}</div>`;
          }else{
            html+=`<span class="empty-row">${avail.length} available — none selected</span>`;
          }
          html+=`</div>`;
        });
        html+=`</div>`;
      });
      // Totals row
      html+=`<h3>Estimated Totals (excl. On Request)</h3><div style="display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;">`;
      scenList.forEach(sc=>{
        const sel=selectedVendors[sc.id]||{};
        const tot=ALL_TYPES.reduce((sum,type)=>{const vid=sel[type];const v=vid?sc.availVendors[type]?.find(x=>x.id===vid):null;return sum+(v&&!ON_REQUEST_TYPES.has(type)?calcTotal(v):0);},0);
        html+=`<div class="comparison-cell"><strong style="font-size:1.1rem;color:#c4826a;">${fmt(tot)}</strong></div>`;
      });
      html+=`</div>`;
    } else {
      scenList.forEach((sc,idx)=>{
        const sel=selectedVendors[sc.id]||{};
        let fixedTotal=0;
        html+=`<div class="scenario"><div class="scenario-header"><h2 style="color:#e8d5a3;margin:0;">Scenario ${idx+1}: ${sc.venue||'Unnamed Venue'}</h2>${sc.date?`<div style="opacity:0.8;font-size:0.82rem;margin-top:2px;">📅 ${formatDateDisplay(sc.date)}</div>`:''}</div>`;
        ALL_TYPES.forEach(type=>{
          const vid=sel[type];
          const vendor=vid?sc.availVendors[type]?.find(v=>v.id===vid):null;
          html+=`<div class="vendor-row"><div><div class="type-label">${TYPE_EMOJI[type]} ${type}</div>`;
          if(vendor){
            html+=`<div class="vendor-name">${vendor.name}</div><div class="vendor-detail">📍 ${vendor.location}${vendor.instagram?' · '+vendor.instagram:''}</div>`;
            if(!ON_REQUEST_TYPES.has(type)){fixedTotal+=calcTotal(vendor);}
          }else{html+=`<div class="empty-row">Not selected</div>`;}
          html+=`</div><div class="price">${vendor?(ON_REQUEST_TYPES.has(type)?'<span class="on-request">On Request</span>':fmt(calcTotal(vendor))):'-'}</div></div>`;
        });
        if(fixedTotal>0){html+=`<div class="total-row"><span class="total-label">Estimated Total (excl. On Request)</span><span class="total-amount">${fmt(fixedTotal)}</span></div>`;}
        html+=`</div>`;
      });
    }
    html+=`<div class="footer">VowFinds · ${date} · On Request vendors will provide personalised quotes after reviewing your requirements.</div>`;
    html+=`</body></html>`;
    return html;
  }

  function exportPDF(scenarioResult,scenIdx){
    const html=buildPrintHTML([scenarioResult],'single');
    const win=window.open('','_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(()=>{win.print();},500);
  }

  function exportComparison(){
    if(!results||results.length<1)return;
    const html=buildPrintHTML(results,'comparison');
    const win=window.open('','_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(()=>{win.print();},500);
  }

  const ss={padding:'0 24px 12px',maxWidth:960,margin:'0 auto'};

  if(step==='summary'||step==='results') return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setStep(step==='summary'?'results':'build')} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600}}>
          {step==='results'?'🔍 Scenario Results':'📋 Scenario Summary'}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          {step==='summary'&&results&&results.length>1&&<button onClick={exportComparison} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'6px 14px',cursor:'pointer',fontSize:'0.78rem',fontWeight:500}}>📊 Compare All</button>}
          <button onClick={onClose} style={{background:'none',border:'1px solid var(--parchment)',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.78rem',color:'var(--mid)'}}>Close</button>
        </div>
      </div>
      <div style={{maxWidth:960,margin:'0 auto',padding:'24px 24px 60px'}}>
        {(results||[]).map((sc,idx)=>(
          <div key={sc.id} style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:24,overflow:'hidden'}}>
            <div style={{background:'var(--forest)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--gold-light)',fontWeight:600}}>Scenario {idx+1}: {sc.venue||'Unnamed Venue'}</div>
                {sc.date&&<div style={{fontSize:'0.78rem',color:'rgba(232,213,163,0.7)',marginTop:2}}>📅 {formatDateDisplay(sc.date)}</div>}
                {sc.venuePinned
                  ? <div style={{fontSize:'0.72rem',color:'rgba(201,169,110,0.8)',marginTop:2}}>✓ Distances calculated from pinned venue</div>
                  : <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginTop:2}}>⚠ No venue pinned — distances may not reflect this venue</div>
                }
              </div>
              {step==='summary'&&<button onClick={()=>exportPDF(sc,idx)} style={{background:'var(--gold)',color:'var(--forest)',border:'none',borderRadius:8,padding:'8px 16px',fontSize:'0.8rem',fontWeight:600,cursor:'pointer'}}>⬇ Export Summary</button>}
            </div>
            <div style={{padding:'16px 20px'}}>
              {ALL_TYPES.map(type=>{
                const vv=sc.availVendors[type]||[];
                const avg=sc.avgCosts[type];
                const selVid=selectedVendors[sc.id]?.[type];
                const selVendor=vv.find(v=>v.id===selVid);
                return(
                  <div key={type} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--parchment)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:'1.1rem'}}>{TYPE_EMOJI[type]}</span>
                        <span style={{fontWeight:600,color:'var(--forest)',fontSize:'0.92rem'}}>{type}</span>
                        <span style={{fontSize:'0.72rem',background:'var(--parchment)',color:'var(--mid)',padding:'2px 8px',borderRadius:999}}>{vv.length} available</span>
                      </div>
                      {avg&&!ON_REQUEST_TYPES.has(type)&&<span style={{fontSize:'0.78rem',color:'var(--mid)'}}>Avg: <strong style={{color:'var(--forest)'}}>{fmt(avg)}</strong></span>}
                      {ON_REQUEST_TYPES.has(type)&&<span style={{fontSize:'0.75rem',color:'var(--rose)',fontStyle:'italic'}}>On Request</span>}
                    </div>
                    {vv.length===0?(
                      <div style={{fontSize:'0.8rem',color:'var(--light)',fontStyle:'italic'}}>No available vendors for this scenario.</div>
                    ):(
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {vv.map(v=>{
                          const isSel=selVid===v.id;
                          return(
                            <div key={v.id} onClick={()=>toggleSelectVendor(sc.id,type,v.id)}
                              style={{padding:'8px 12px',borderRadius:9,cursor:'pointer',border:`2px solid ${isSel?'var(--forest)':'var(--parchment)'}`,background:isSel?'rgba(58,74,63,0.07)':'var(--cream)',transition:'all 0.15s',maxWidth:200}}>
                              <div style={{fontSize:'0.82rem',fontWeight:isSel?600:400,color:'var(--forest)'}}>{v.name}</div>
                              <div style={{fontSize:'0.72rem',color:'var(--mid)',marginTop:2}}>
                                {ON_REQUEST_TYPES.has(type)?'On Request':fmt(calcTotal(v))}
                              </div>
                              {isSel&&<div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:3}}>✓ Selected</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {step==='summary'&&selVendor&&(
                      <div style={{marginTop:10,padding:'10px 12px',background:'rgba(58,74,63,0.06)',borderRadius:8,fontSize:'0.8rem',color:'var(--mid)'}}>
                        <strong style={{color:'var(--forest)'}}>{selVendor.name}</strong> · {selVendor.location}
                        {selVendor.instagram&&<> · {selVendor.instagram}</>}
                        {!ON_REQUEST_TYPES.has(type)&&<> · <strong style={{color:'var(--rose)'}}>{fmt(calcTotal(selVendor))}</strong></>}
                      </div>
                    )}
                  </div>
                );
              })}
              {step==='summary'&&(()=>{
                const fixedTotal=ALL_TYPES.reduce((sum,type)=>{
                  const vid=selectedVendors[sc.id]?.[type];
                  const v=vid?sc.availVendors[type]?.find(x=>x.id===vid):null;
                  return sum+(v&&!ON_REQUEST_TYPES.has(type)?calcTotal(v):0);
                },0);
                return fixedTotal>0?(
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8,fontFamily:"'Cormorant Garamond',serif"}}>
                    <span style={{fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>Estimated Total (excl. On Request)</span>
                    <span style={{fontSize:'1.5rem',color:'var(--rose)',fontWeight:700}}>{fmt(fixedTotal)}</span>
                  </div>
                ):null;
              })()}
            </div>
          </div>
        ))}
        {step==='results'&&<button onClick={()=>setStep('summary')} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'13px',fontSize:'0.9rem',fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.04em'}}>View Summary with Selected Vendors →</button>}
      </div>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={onClose} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600}}>🗂 Scenario Builder</div>
      </div>
      <div style={{maxWidth:900,margin:'0 auto',padding:'24px 24px 60px'}}>
        <p style={{color:'var(--mid)',fontSize:'0.86rem',marginBottom:24}}>Compare different venues, dates and budgets to find the best combination of vendors for your wedding.</p>

        {scenarios.map((sc,idx)=>(
          <div key={sc.id} style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:20,overflow:'hidden'}}>
            <div style={{background:'var(--forest)',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--gold-light)',fontWeight:600}}>Scenario {idx+1}</div>
              {scenarios.length>1&&<button onClick={()=>removeScenario(sc.id)} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:6,padding:'4px 10px',color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:'0.75rem'}}>Remove</button>}
            </div>
            <div style={{padding:'18px 20px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                <div>
                  <label style={labelStyle}>Venue</label>
                  <ScenarioVenueInput
                    key={sc.id}
                    scenarioId={sc.id}
                    initialValue={sc.venue}
                    pinned={sc.venuePinned}
                    onPinned={(name,ll)=>updateScenarioVenue(sc.id,name,ll)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Wedding Date</label>
                  <input type="date" style={inputStyle} value={sc.date} onChange={e=>updateScenario(sc.id,'date',e.target.value)}/>
                </div>
              </div>
              <div>
                <label style={{...labelStyle,marginBottom:10}}>Max Budget per Category (leave blank for no limit)</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {ALL_TYPES.filter(t=>!ON_REQUEST_TYPES.has(t)).map(type=>(
                    <div key={type} style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:'0.9rem',flexShrink:0}}>{TYPE_EMOJI[type]}</span>
                      <input style={{...inputStyle,fontSize:'0.8rem',padding:'6px 10px'}} type="number" value={sc.budgets[type]||''} onChange={e=>updateBudget(sc.id,type,e.target.value)} placeholder={`${type} budget`}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {scenarios.some(sc=>!sc.venuePinned&&sc.venue)&&(
          <div style={{background:'rgba(201,169,110,0.1)',border:'1px solid rgba(201,169,110,0.3)',borderRadius:10,padding:'10px 16px',marginBottom:12,fontSize:'0.8rem',color:'var(--mid)',display:'flex',alignItems:'center',gap:8}}>
            ⚠️ Some venues haven't been pinned via the dropdown — type and select from the suggestions to lock in the location for accurate distance pricing.
          </div>
        )}
        {vendorsError&&<div style={{color:'var(--rose)',fontSize:'0.82rem',marginBottom:12,padding:'10px 14px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{vendorsError}</div>}
        <div style={{display:'flex',gap:12,marginTop:4}}>
          <button onClick={addScenario} style={{flex:1,background:'var(--parchment)',color:'var(--forest)',border:'1.5px dashed var(--blush)',borderRadius:10,padding:'12px',fontSize:'0.88rem',cursor:'pointer',fontWeight:500}}>+ Add Another Scenario</button>
          <button onClick={runScenarios} disabled={vendorsLoading||running} style={{flex:2,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontSize:'0.9rem',fontWeight:500,cursor:(vendorsLoading||running)?'not-allowed':'pointer',letterSpacing:'0.04em'}}>
            {running?'Calculating distances…':vendorsLoading?'Loading vendors…':'Run Scenarios →'}
          </button>
        </div>
        {vendorsLoading&&<p style={{textAlign:'center',fontSize:'0.78rem',color:'var(--light)',marginTop:10}}>Loading all vendors from database…</p>}
        {!vendorsLoading&&allVendors.length>0&&<p style={{textAlign:'center',fontSize:'0.78rem',color:'var(--forest)',marginTop:10}}>✓ {allVendors.length} vendors loaded and ready</p>}
      </div>
    </div>
  );
}


// ── CUSTOMER BROWSE VIEW (logged-in customer browsing vendors) ────────────────
function CustomerBrowseView({user,venue,setVenue,venueLatLng,setVenueLatLng,dateFrom,setDateFrom,dateTo,setDateTo,selectedTypes,setSelectedTypes,vendors,setVendors,loading,setLoading,loadError,setLoadError,calcProgress,setCalcProgress,searched,setSearched,showMap,setShowMap,openDetail,onRequestQuote,onOpenScenario,onOpenFavourites,browseView,setBrowseView}) {
  const activeTypes=selectedTypes.size===0?ALL_TYPES:ALL_TYPES.filter(t=>selectedTypes.has(t));
  const vendorsByType={};activeTypes.forEach(t=>{vendorsByType[t]=vendors.filter(v=>v.type===t);});
  const vendorsWithLoc=vendors.filter(v=>v.lat&&v.lng);

  const toggleType=(type)=>{
    if(type==='all'){setSelectedTypes(prev=>prev.size===ALL_TYPES.length?new Set():new Set(ALL_TYPES));}
    else{setSelectedTypes(prev=>{const next=new Set(prev);next.has(type)?next.delete(type):next.add(type);return next;});}
  };

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
      }else setVendors(data);
      setCalcProgress('');
    }catch(e){setLoadError('Could not load vendors: '+e.message);}
    setLoading(false);
  }

  function search(){if(!venue.trim())return;setSearched(true);loadVendors(venueLatLng);}

  return(
    <div>
      {/* Hero — identical layout to public browse */}
      <div className="vf-hero-padding" style={{background:'linear-gradient(160deg,var(--forest) 0%,#2a3830 60%,#1e2820 100%)',position:'relative',overflow:'hidden',padding:'52px 24px 48px',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 50% at 50% 100%,rgba(201,169,110,0.1) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:-120,right:-120,width:400,height:400,borderRadius:'50%',background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-80,left:-80,width:280,height:280,borderRadius:'50%',background:'rgba(201,169,110,0.05)',pointerEvents:'none'}}/>

        {/* Eyebrow */}
        <div style={{fontSize:'0.7rem',letterSpacing:'0.25em',textTransform:'uppercase',color:'var(--gold)',marginBottom:10,position:'relative',zIndex:2}}>Your wedding, your way</div>
        <h1 className="vf-hero-headline" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.6rem)',fontWeight:300,color:'var(--cream)',lineHeight:1.15,marginBottom:8,textAlign:'center',position:'relative',zIndex:2}}>
          Find the <em style={{fontStyle:'italic',color:'var(--blush)'}}>perfect</em> vendors for your special day
        </h1>
        <p className="vf-hero-sub" style={{color:'rgba(250,246,241,0.5)',fontSize:'0.9rem',fontWeight:300,lineHeight:1.6,marginBottom:32,textAlign:'center',maxWidth:500,position:'relative',zIndex:2}}>
          Enter your venue and wedding window — we'll show real availability and travel costs.
        </p>

        {/* Search box */}
        <div className="vf-search-box" style={{background:'var(--white)',borderRadius:20,padding:'28px 32px',width:'100%',maxWidth:780,boxShadow:'0 16px 60px rgba(0,0,0,0.28)',position:'relative',zIndex:10,marginBottom:16}}>
          <div className="vf-search-grid" style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:14,marginBottom:16,alignItems:'end'}}>
            <div>
              <label style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:5,display:'block'}}>Venue Location</label>
              <VenueAutocomplete value={venue} onChange={setVenue} onPlaceSelected={(ll,name)=>{setVenueLatLng(ll);setVenue(name);}} placeholder="e.g. Babylonstoren, Franschhoek" style={{border:'1.5px solid var(--parchment)',borderRadius:9,padding:'11px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
            </div>
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}/>
          </div>
          <button onClick={search} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'13px 28px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.95rem',fontWeight:500,letterSpacing:'0.06em',cursor:'pointer',width:'100%'}}>
            {loading?(calcProgress||'Loading vendors…'):'Search Vendors'}
          </button>
        </div>

        {/* Category filter — pills row below search, same as public view */}
        <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:780}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:'0.68rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)'}}>Filter by category</span>
            <button onClick={()=>toggleType('all')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px 10px',fontSize:'0.78rem',fontFamily:"'DM Sans',sans-serif",color:selectedTypes.size===ALL_TYPES.length?'var(--gold)':'rgba(255,255,255,0.45)',fontWeight:selectedTypes.size===ALL_TYPES.length?600:400,textDecoration:selectedTypes.size===ALL_TYPES.length?'none':'underline',textUnderlineOffset:'3px',transition:'color 0.15s'}}>
              {selectedTypes.size===ALL_TYPES.length?'✓ All selected':'Select all'}
            </button>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.13)',borderRadius:14,padding:'12px 14px',backdropFilter:'blur(8px)',display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'center'}}>
            {ALL_TYPES.map(t=>{
              const active=selectedTypes.has(t);
              return(
                <div key={t} onClick={()=>toggleType(t)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:999,cursor:'pointer',userSelect:'none',background:active?'rgba(196,130,106,0.28)':'rgba(255,255,255,0.06)',border:`1.5px solid ${active?'rgba(196,130,106,0.65)':'rgba(255,255,255,0.15)'}`,transition:'all 0.15s'}}>
                  <span style={{fontSize:'0.82rem',color:active?'var(--cream)':'rgba(255,255,255,0.6)',fontWeight:active?500:400,whiteSpace:'nowrap'}}>{TYPE_EMOJI[t]} {t}</span>
                </div>
              );
            })}
          </div>
          {selectedTypes.size>0&&selectedTypes.size<ALL_TYPES.length&&<div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.35)'}}>{selectedTypes.size} of {ALL_TYPES.length} categories selected</div>}
          {selectedTypes.size===0&&<div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.3)'}}>No filter — all vendors will show</div>}
        </div>
      </div>

      {/* Results */}
      {searched&&(
        <div className="vf-results-section" style={{padding:'32px 0 60px',background:'#ffffff'}}>
          <div className="vf-results-header" style={{padding:'0 28px 20px',maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',fontWeight:400,color:'var(--forest)'}}>Vendors near <span style={{fontStyle:'italic',color:'var(--rose)'}}>{venue}</span>{dateFrom&&<span style={{fontSize:'1.1rem',color:'var(--mid)',fontStyle:'normal'}}> · {formatDateDisplay(dateFrom)}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</span>}</h2>
              <p style={{color:'var(--mid)',fontSize:'0.84rem',marginTop:3}}>{loading?(calcProgress||'Loading…'):loadError?loadError:'Greyed-out vendors are booked on your dates.'}</p>
            </div>
            {vendorsWithLoc.length>0&&<button onClick={()=>setShowMap(s=>!s)} style={{background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',color:'var(--forest)',cursor:'pointer'}}>{showMap?'🗺 Hide map':'🗺 Show map'}</button>}
          </div>
          {!loading&&!loadError&&showMap&&vendorsWithLoc.length>0&&<VendorsMap vendors={vendorsWithLoc} venueLatLng={venueLatLng} onSelectVendor={openDetail}/>}
          {!loading&&!loadError&&activeTypes.map((type,idx)=>{const tv=vendorsByType[type];if(!tv||tv.length===0)return null;return<VendorLane key={type} type={type} vendors={tv} dateFrom={dateFrom} dateTo={dateTo} onOpenDetail={openDetail} isLast={idx===activeTypes.length-1} onRequestQuote={onRequestQuote} customerId={user?.customerId}/>;  })}
        </div>
      )}
    </div>
  );
}


export default function VowFinds() {
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
  const [customerView,setCustomerView]=useState('browse'); // 'browse' | 'dashboard' | 'favourites' | 'scenario'
  const [newLeadAfterQuote,setNewLeadAfterQuote]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [showScenario,setShowScenario]=useState(false);

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
              {customerView==='browse'?'💬 My Quotes':customerView==='dashboard'?'Browse':customerView==='favourites'?'⭐ Favourites':'🗂 Scenarios'}
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
                {label:'🔍 Browse Vendors',action:()=>{setCustomerView('browse');setMenuOpen(false);}},
                {label:'⭐ My Favourites',action:()=>{setCustomerView('favourites');setMenuOpen(false);}},
                {label:'🗂 Scenario Builder',action:()=>{setCustomerView('scenario');setMenuOpen(false);}},
                {label:'💬 My Quotes',action:()=>{setCustomerView('dashboard');setMenuOpen(false);}},
                {label:'🚪 Logout',action:()=>{handleLogout();setMenuOpen(false);}},
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
      {showLoginModal && <LoginModal onLogin={handleLogin} onClose={()=>setShowLoginModal(false)}/>}
      {showCustomerAuth && <CustomerAuthModal onLogin={handleLogin} onClose={()=>{setShowCustomerAuth(false);setPendingQuoteVendor(null);}} redirectVendor={pendingQuoteVendor}/>}
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
          <button className="vf-nav-login-btns" onClick={()=>setShowLoginModal(true)} style={{background:'rgba(201,169,110,0.15)',border:'1px solid rgba(201,169,110,0.35)',borderRadius:6,color:'var(--gold-light)',fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',padding:'5px 12px',cursor:'pointer'}}>Vendor Login</button>
        </div>
      </nav>
      {/* Public hamburger menu */}
      {menuOpen&&(
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:198}}/>
          <div style={{position:'fixed',top:56,left:0,width:220,background:'var(--white)',boxShadow:'4px 0 20px rgba(0,0,0,0.12)',zIndex:199,borderRight:'1px solid var(--parchment)',padding:'8px 0'}}>
            {[
              {label:'🔍 Browse Vendors',action:()=>{setView('customer');setMenuOpen(false);}},
              {label:'🗂 Scenario Builder',action:()=>{setShowScenario(true);setMenuOpen(false);}},
              {label:'👤 Customer Login',action:()=>{setShowCustomerAuth(true);setMenuOpen(false);}},
              {label:'🏪 Vendor Login',action:()=>{setShowLoginModal(true);setMenuOpen(false);}},
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
                <button onClick={()=>setShowLoginModal(true)} style={{flex:1,background:'rgba(201,169,110,0.1)',color:'var(--forest)',border:'1px solid rgba(201,169,110,0.3)',borderRadius:8,padding:'10px',fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>🏪 Vendor Login</button>
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
                  {selectedTypes.size===ALL_TYPES.length?'✓ All selected':'Select all'}
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
                      <span style={{fontSize:'0.82rem',color:active?'var(--cream)':'rgba(255,255,255,0.6)',fontWeight:active?500:400,whiteSpace:'nowrap'}}>{TYPE_EMOJI[t]} {t}</span>
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
function GlobalStyles(){return(
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{--cream:#faf6f1;--parchment:#f0e8dc;--blush:#e8c4b0;--rose:#c4826a;--deep-rose:#8b4d3a;--forest:#3a4a3f;--gold:#c9a96e;--gold-light:#e8d5a3;--charcoal:#2c2c2c;--mid:#6b6b6b;--light:#a8a8a8;--white:#ffffff;--card-shadow:0 4px 24px rgba(44,44,44,0.08);--card-shadow-hover:0 8px 40px rgba(44,44,44,0.15);}
    body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--charcoal);}
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--rose);border:3px solid white;box-shadow:0 2px 6px rgba(196,130,106,0.45);cursor:pointer;}
    input[type=range]{-webkit-appearance:none;appearance:none;}
    input:focus,select:focus,textarea:focus{border-color:var(--rose)!important;}
    ::-webkit-scrollbar{display:none;}
    .pac-container{z-index:9999!important;font-family:'DM Sans',sans-serif;}
    /* ── Responsive ── */
    @media(max-width:767px){
      /* Nav */
      .vf-nav-login-btns{display:none!important;}

      /* Hero */
      .vf-hero-padding{padding:36px 16px 28px!important;}
      .vf-hero-headline{font-size:1.75rem!important;margin-bottom:8px!important;}

      /* Search box — tighter, single column, z-index so date picker floats above filter */
      .vf-search-box{
        padding:18px 16px 20px!important;
        border-radius:16px!important;
        margin-bottom:14px!important;
        position:relative!important;
        z-index:10!important;
      }
      .vf-search-grid{grid-template-columns:1fr!important;gap:10px!important;margin-bottom:12px!important;}
      .vf-search-grid input[type=date]{
        font-size:0.88rem!important;
        padding:10px 12px!important;
        position:relative!important;
        z-index:20!important;
      }
      /* Filter box sits BELOW with lower z-index so date picker overlaps it */
      .vf-filter-box{
        padding:10px 12px!important;
        position:relative!important;
        z-index:1!important;
      }
      .vf-filter-pill{padding:5px 11px!important;font-size:0.78rem!important;}

      /* Vendor lane — 2 cards visible, peek of 3rd */
      .vf-lane-scroll{
        gap:10px!important;
        padding:0 16px 14px!important;
        scroll-snap-type:x mandatory!important;
      }
      /* Cards: ~2.3 fit on screen so user can see there's more to scroll */
      .vf-vendor-card{
        flex:0 0 calc(44vw - 8px)!important;
        width:calc(44vw - 8px)!important;
        border-radius:12px!important;
        scroll-snap-align:start!important;
      }
      .vf-vendor-card .vf-card-img{height:110px!important;}
      .vf-vendor-card .vf-card-body{padding:10px 11px 12px!important;}
      .vf-vendor-card .vf-card-name{
        font-size:0.88rem!important;
        margin-bottom:2px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .vf-vendor-card .vf-card-location{
        font-size:0.68rem!important;
        margin-bottom:7px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .vf-vendor-card .vf-card-pricing{padding:7px 9px!important;border-radius:7px!important;}
      .vf-vendor-card .vf-card-pricing div{font-size:0.65rem!important;}
      .vf-vendor-card .vf-card-pricing span{font-size:0.72rem!important;}
      .vf-vendor-card .vf-card-btns{margin-top:9px!important;gap:5px!important;}
      .vf-vendor-card .vf-card-btns button{
        padding:7px 6px!important;
        font-size:0.68rem!important;
        border-radius:7px!important;
        letter-spacing:0!important;
      }
      .vf-vendor-card .vf-card-type-badge{
        font-size:0.58rem!important;
        padding:2px 7px!important;
        letter-spacing:0.06em!important;
      }
      .vf-vendor-card .vf-card-ig{width:24px!important;height:24px!important;}

      /* Results section — white backdrop on mobile */
      body{background:#ffffff!important;}
      .vf-results-section{background:#ffffff!important;}
      .vf-lane-wrapper{background:#ffffff!important;}
      .vf-lane-fade-left{background:linear-gradient(to right,#ffffff,transparent)!important;}
      .vf-lane-fade-right{background:linear-gradient(to left,#ffffff,transparent)!important;}
      .vf-lane-divider{border-top-color:#ede8e0!important;margin:4px 16px 28px!important;}

      /* Price slider — clean on mobile */
      .vf-lane-header{
        flex-direction:column!important;
        align-items:flex-start!important;
        padding:0 16px!important;
        gap:8px!important;
        margin-bottom:10px!important;
      }

      .vf-results-header{padding:0 16px 14px!important;}
      .vf-results-title{font-size:1.5rem!important;}

      /* Customer dashboard */
      .vf-customer-dash-body{min-height:100vh!important;}

      /* Vendor detail */
      .vf-vendor-detail-grid{grid-template-columns:1fr!important;}
      .vf-vendor-detail-sticky{position:static!important;}
      .vf-vendor-detail-hero{height:220px!important;}
      .vf-vendor-detail-pad{padding:20px 16px 40px!important;}
    }
    @media(min-width:768px){
      .vf-mobile-only{display:none!important;}
    }
  `}</style>
);}
