import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch, supabase, loadGoogleMaps, getBatchDistancesKm } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES } from '../../constants.js';
import { fmt, formatDateDisplay, isOnRequest, isVendorUnavailable, calcTotal, calcPackageTotal, calcFromPrice } from '../../utils.js';
import FavStar from '../vendor/FavStar.jsx';
import ChatThread from '../chat/ChatThread.jsx';
import Calendar from '../calendar/Calendar.jsx';
import ScenarioBuilder from '../features/ScenarioBuilder.jsx';
import WeddingPlan from '../features/WeddingPlan.jsx';

const M = {
  white:    '#ffffff',
  offWhite: '#f8f6f3',
  border:   '#ede8e0',
  bg:       '#f5f2ee',
  heading:  '#1c2b22',
  body:     '#4a4a4a',
  muted:    '#8a8a8a',
  forest:   '#3a4a3f',
  rose:     '#c4826a',
  gold:     '#e8d5a3',
  parchment:'#f0e8dc',
};

function MobileVenueInput({placeholder, onPinned, initialValue='', style={}}) {
  const ref = useRef();
  useEffect(()=>{
    if(ref.current && initialValue) ref.current.value = initialValue;
    loadGoogleMaps().then(google=>{
      if(!ref.current) return;
      const ac = new google.maps.places.Autocomplete(ref.current, {
        types:['establishment','geocode'], componentRestrictions:{country:'za'}
      });
      ac.addListener('place_changed', ()=>{
        const p = ac.getPlace();
        if(p.geometry){
          const ll = {lat:p.geometry.location.lat(), lng:p.geometry.location.lng()};
          const name = p.formatted_address || p.name;
          if(ref.current) ref.current.value = name;
          onPinned(name, ll);
        }
      });
    });
  }, []);
  return(
    <input ref={ref} defaultValue={initialValue} placeholder={placeholder||'Search venue…'}
      style={{border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",
        fontSize:'0.95rem',color:M.heading,outline:'none',width:'100%', ...style}}/>
  );
}

function MobileVendorCard({vendor, onOpen, onQuote, customerId}) {
  const travel = (vendor.distance_km||0) * (vendor.per_km_rate||0);
  const overnight = (vendor.distance_km||0) > (vendor.overnight_threshold_km||80) ? (vendor.overnight_fee||0) : 0;
  const total = (vendor.fixed_rate||0) + travel + overnight;
  const img = vendor.display_picture || vendor.images?.[0]?.url;
  const onReq = isOnRequest(vendor);
  return(
    <div onClick={onOpen} style={{background:M.white,borderRadius:12,marginBottom:10,overflow:'hidden',
      border:`1px solid ${M.border}`,display:'flex',cursor:'pointer',minHeight:100}}>
      <div style={{width:100,flexShrink:0,background:img?`url(${img}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}cc,${vendor.color||'#c8a87a'}44)`,position:'relative'}}>
        <div style={{position:'absolute',bottom:5,left:5,background:'rgba(28,43,34,0.82)',color:M.gold,
          fontSize:'0.55rem',letterSpacing:'0.08em',textTransform:'uppercase',padding:'2px 6px',
          borderRadius:999,display:'flex',alignItems:'center',gap:3}}>
          <VendorIcon type={vendor.type} size={9} color={M.gold}/>{vendor.type}
        </div>
      </div>
      <div style={{flex:1,padding:'11px 12px',display:'flex',flexDirection:'column',justifyContent:'space-between',minWidth:0}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',fontWeight:600,
            color:M.heading,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{vendor.name}</div>
          <div style={{fontSize:'0.71rem',color:M.muted,marginBottom:5,display:'flex',alignItems:'center',gap:4}}>
            {IC.pin(11, M.muted)}{vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km`:''}
          </div>
          {vendor.description&&<div style={{fontSize:'0.74rem',color:M.body,lineHeight:1.45,overflow:'hidden',
            display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{vendor.description}</div>}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
          <div style={{fontSize:'0.8rem'}}>
            {onReq
              ? <span style={{color:M.rose,fontWeight:600,fontStyle:'italic'}}>On Request</span>
              : (()=>{
                  const fp=calcFromPrice(vendor);
                  if(fp) return <span style={{color:M.forest,fontWeight:700}}>{fp.isFrom?'From ':''}{fmt(fp.price)}</span>;
                  return <span style={{color:M.forest,fontWeight:700}}>{fmt(total)}</span>;
                })()}
          </div>
          <div style={{display:'flex',gap:6}}>
            {customerId&&<div onClick={e=>e.stopPropagation()} style={{background:M.parchment,borderRadius:7,
              width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <FavStar vendor={vendor} customerId={customerId} size={15}/>
            </div>}
            <button onClick={e=>{e.stopPropagation();onQuote();}}
              style={{background:M.rose,color:M.white,border:'none',borderRadius:8,
                padding:'5px 11px',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>
              Quote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileSearchScreen({onVendorsLoaded}) {
  const [venue, setVenue] = useState('');
  const [venueLL, setVenueLL] = useState(null);
  const [venuePinned, setVenuePinned] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function doSearch() {
    if(!venue.trim()){setError('Please enter your wedding venue'); return;}
    setLoading(true); setError('');
    try{
      const data = await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=type,name');
      if(venueLL){
        const kms = await getBatchDistancesKm(venueLL, data);
        onVendorsLoaded(data.map((v,i)=>({...v,distance_km:kms[i]||0})), venue, venueLL, dateFrom);
      } else {
        onVendorsLoaded(data, venue, venueLL, dateFrom);
      }
    }catch(e){setError('Could not load vendors. Please try again.');}
    setLoading(false);
  }

  return(
    <div style={{flex:1,overflowY:'auto',background:M.offWhite}}>
      {/* Light hero */}
      <div style={{padding:'32px 20px 16px',background:M.white}}>
        <div style={{fontSize:'0.62rem',letterSpacing:'0.2em',textTransform:'uppercase',
          color:M.rose,marginBottom:8,fontWeight:500}}>Your wedding, your way</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:300,
          color:M.heading,lineHeight:1.15,marginBottom:6}}>
          Find the <em style={{color:M.rose,fontStyle:'italic'}}>perfect</em> vendors
        </h1>
        <p style={{fontSize:'0.82rem',color:M.muted,lineHeight:1.6,marginBottom:0}}>
          Enter your venue and we'll show real travel costs for every vendor.
        </p>
      </div>

      {/* Search card */}
      <div style={{margin:'12px 16px',background:M.white,borderRadius:14,padding:'18px',
        boxShadow:'0 1px 8px rgba(0,0,0,0.06)',border:`1px solid ${M.border}`}}>
        {/* Venue */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:'0.63rem',letterSpacing:'0.12em',textTransform:'uppercase',
            color:M.muted,marginBottom:6,fontWeight:500}}>Wedding Venue</div>
          <div style={{display:'flex',alignItems:'center',gap:8,background:M.offWhite,borderRadius:10,
            padding:'10px 12px',border:`1.5px solid ${venuePinned?M.forest:M.border}`}}>
            <span style={{display:'flex',flexShrink:0,color:venuePinned?M.forest:M.muted}}>
              {IC.pin(16, venuePinned?M.forest:M.muted)}
            </span>
            <MobileVenueInput placeholder="e.g. Babylonstoren, Franschhoek"
              onPinned={(name,ll)=>{setVenue(name);setVenueLL(ll);setVenuePinned(true);}}/>
            {venuePinned&&<span style={{display:'flex',flexShrink:0}}>{IC.check(14,M.forest)}</span>}
          </div>
          {venuePinned&&<div style={{fontSize:'0.67rem',color:M.forest,marginTop:4,paddingLeft:2}}>
            Location pinned — travel distances will be calculated
          </div>}
        </div>

        {/* Date */}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:'0.63rem',letterSpacing:'0.12em',textTransform:'uppercase',
            color:M.muted,marginBottom:6,fontWeight:500}}>Wedding Date (optional)</div>
          <div style={{display:'flex',alignItems:'center',gap:8,background:M.offWhite,
            borderRadius:10,padding:'10px 12px',border:`1.5px solid ${M.border}`}}>
            <span style={{display:'flex',flexShrink:0,color:M.muted}}>{IC.calendar(16,M.muted)}</span>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              style={{border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",
                fontSize:'0.9rem',color:M.heading,outline:'none',flex:1}}/>
          </div>
        </div>

        {error&&<div style={{fontSize:'0.78rem',color:M.rose,marginBottom:10,padding:'8px 12px',
          background:'rgba(196,130,106,0.06)',borderRadius:8,border:`1px solid rgba(196,130,106,0.2)`}}>{error}</div>}

        <button onClick={doSearch} disabled={loading}
          style={{width:'100%',background:M.forest,color:M.gold,border:'none',borderRadius:12,
            padding:'14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.95rem',fontWeight:600,
            cursor:loading?'wait':'pointer',letterSpacing:'0.04em'}}>
          {loading ? 'Finding vendors…' : 'Search Vendors →'}
        </button>
      </div>

      {/* Category picks */}
      <div style={{padding:'16px 16px 24px'}}>
        <div style={{fontSize:'0.63rem',letterSpacing:'0.12em',textTransform:'uppercase',
          color:M.muted,marginBottom:10,fontWeight:500}}>Browse by category</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {ALL_TYPES.map(t=>(
            <button key={t} onClick={async()=>{
              setLoading(true); setError('');
              try{
                const data = await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*)&order=name');
                onVendorsLoaded(data.filter(v=>v.type===t), venue, venueLL, dateFrom, t);
              }catch{setError('Could not load.');}
              setLoading(false);
            }} style={{background:M.white,border:`1.5px solid ${M.border}`,borderRadius:999,
              padding:'6px 13px',fontSize:'0.78rem',cursor:'pointer',color:M.forest,fontWeight:500,
              display:'flex',alignItems:'center',gap:6}}>
              <VendorIcon type={t} size={13} color={M.forest}/>{t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileResultsScreen({vendors,venue,venueLL,dateFrom,onBack,onOpen,onQuote,customerId,activeType,setActiveType}) {
  const [search, setSearch] = useState('');
  const [venuePrompt, setVenuePrompt] = useState(false);
  const [pendingVendor, setPendingVendor] = useState(null);

  function handleOpen(vendor){
    if(!venueLL){setPendingVendor(vendor);setVenuePrompt(true);return;}
    onOpen(vendor);
  }

  const types = [...new Set(vendors.map(v=>v.type))].filter(t=>ALL_TYPES.includes(t))
    .sort((a,b)=>ALL_TYPES.indexOf(a)-ALL_TYPES.indexOf(b));

  const filtered = vendors.filter(v=>{
    if(activeType && v.type!==activeType) return false;
    if(search && !v.name.toLowerCase().includes(search.toLowerCase()) &&
       !v.location.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:M.offWhite}}>
      {/* Venue prompt bottom sheet */}
      {venuePrompt&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:500,
          display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{background:M.white,borderRadius:'20px 20px 0 0',padding:'24px 20px 32px',
            width:'100%',maxWidth:480}}>
            <div style={{width:36,height:4,background:M.border,borderRadius:2,margin:'0 auto 20px'}}/>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              {IC.pin(20,M.rose)}
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',
                fontWeight:600,color:M.heading}}>Venue needed for accurate pricing</div>
            </div>
            <p style={{fontSize:'0.84rem',color:M.body,lineHeight:1.65,marginBottom:20}}>
              Travel costs to <strong>{pendingVendor?.name}</strong> can't be calculated without a venue.
            </p>
            <button onClick={()=>{setVenuePrompt(false);onBack();}}
              style={{width:'100%',background:M.forest,color:M.gold,border:'none',borderRadius:12,
                padding:'14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.92rem',fontWeight:600,
                cursor:'pointer',marginBottom:10}}>Add my venue</button>
            <button onClick={()=>{setVenuePrompt(false);if(pendingVendor)onOpen(pendingVendor);}}
              style={{width:'100%',background:'none',border:`1.5px solid ${M.border}`,borderRadius:12,
                padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',
                color:M.body,cursor:'pointer'}}>Continue without venue</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:M.white,borderBottom:`1px solid ${M.border}`,padding:'10px 14px',
        display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <button onClick={onBack} style={{background:M.offWhite,border:'none',borderRadius:8,
          padding:'6px 8px',color:M.body,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center'}}>
          {IC.back(18,M.body)}
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'0.82rem',fontWeight:600,color:M.heading,overflow:'hidden',
            textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:5}}>
            {IC.pin(13,M.rose)}{venue||'All vendors'}
          </div>
          <div style={{fontSize:'0.7rem',color:M.muted}}>
            {vendors.length} vendors found{dateFrom?` · ${formatDateDisplay(dateFrom)}`:''}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{background:M.white,padding:'8px 12px',borderBottom:`1px solid ${M.border}`,flexShrink:0}}>
        <div style={{background:M.offWhite,borderRadius:10,padding:'8px 12px',
          display:'flex',alignItems:'center',gap:8}}>
          <span style={{display:'flex',color:M.muted}}>{IC.search(16,M.muted)}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search vendors…"
            style={{border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",
              fontSize:'0.88rem',color:M.heading,outline:'none',flex:1}}/>
          {search&&<button onClick={()=>setSearch('')}
            style={{background:'none',border:'none',color:M.muted,cursor:'pointer',padding:0,display:'flex'}}>
            {IC.x(14,M.muted)}
          </button>}
        </div>
      </div>

      {/* Type filter pills */}
      <div style={{background:M.white,padding:'8px 12px 10px',display:'flex',gap:7,overflowX:'auto',
        scrollbarWidth:'none',flexShrink:0,borderBottom:`1px solid ${M.border}`}}>
        <button onClick={()=>setActiveType(null)}
          style={{flexShrink:0,background:!activeType?M.forest:M.offWhite,
            color:!activeType?M.gold:M.body,border:'none',borderRadius:999,
            padding:'5px 13px',fontSize:'0.76rem',fontWeight:500,cursor:'pointer'}}>All</button>
        {types.map(t=>(
          <button key={t} onClick={()=>setActiveType(activeType===t?null:t)}
            style={{flexShrink:0,background:activeType===t?M.forest:M.offWhite,
              color:activeType===t?M.gold:M.body,border:'none',borderRadius:999,
              padding:'5px 13px',fontSize:'0.76rem',fontWeight:500,cursor:'pointer',
              display:'flex',alignItems:'center',gap:5}}>
            <VendorIcon type={t} size={12} color={activeType===t?M.gold:M.body}/>{t}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 14px',background:M.offWhite}}>
        {filtered.length===0
          ?<div style={{textAlign:'center',padding:'40px 20px',color:M.muted}}>
            <div style={{marginBottom:8,display:'flex',justifyContent:'center'}}>
              {IC.search(36,'#e0dbd4')}
            </div>
            <div style={{fontSize:'0.88rem'}}>No vendors match your search</div>
          </div>
          :filtered.map(v=>(
            <MobileVendorCard key={v.id} vendor={v}
              onOpen={()=>handleOpen(v)} onQuote={()=>onQuote(v)} customerId={customerId}/>
          ))
        }
        <div style={{height:20}}/>
      </div>
    </div>
  );
}


// ── Mobile Availability Tab — full-width scrollable calendar ──────────────────
function MobileAvailabilityTab({vendor, dateFrom}) {
  const [calYear, setCalYear] = useState(()=>dateFrom?parseInt(dateFrom.split('-')[0]):new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(()=>dateFrom?parseInt(dateFrom.split('-')[1])-1:new Date().getMonth());
  const unavailSet = new Set((vendor.unavail_dates||[]).map(d=>d.date));

  function prevMonth(){let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}
  function nextMonth(){let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}

  const bookedCount = [...unavailSet].filter(d=>d.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`)).length;

  return(
    <div>
      {/* Month navigation */}
      <div style={{background:M.white,borderRadius:12,padding:'12px 14px',
        border:`1px solid ${M.border}`,marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
          <button onClick={prevMonth} style={{background:'none',border:'none',cursor:'pointer',
            padding:'4px 8px',borderRadius:8,color:M.body,fontSize:'1.2rem'}}>‹</button>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',
              fontWeight:600,color:M.heading}}>
              {['January','February','March','April','May','June','July','August',
                'September','October','November','December'][calMonth]} {calYear}
            </div>
            {bookedCount>0&&<div style={{fontSize:'0.7rem',color:M.rose,marginTop:2}}>
              {bookedCount} date{bookedCount!==1?'s':''} unavailable this month
            </div>}
          </div>
          <button onClick={nextMonth} style={{background:'none',border:'none',cursor:'pointer',
            padding:'4px 8px',borderRadius:8,color:M.body,fontSize:'1.2rem'}}>›</button>
        </div>
      </div>

      {/* Calendar — full width, no overflow */}
      <div style={{background:M.white,borderRadius:12,border:`1px solid ${M.border}`,
        padding:'10px 8px',overflowX:'auto'}}>
        <div style={{minWidth:280}}>
          <Calendar
            year={calYear} month={calMonth}
            unavailDates={unavailSet}
            weddingDate={dateFrom}
            onPrev={prevMonth}
            onNext={nextMonth}
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{background:M.white,borderRadius:12,padding:'12px 14px',
        border:`1px solid ${M.border}`,marginTop:10,
        display:'flex',gap:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:12,height:12,borderRadius:'50%',background:'var(--forest)'}}/>
          <span style={{fontSize:'0.74rem',color:M.muted}}>Your date</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:12,height:12,borderRadius:'50%',background:'#e0b8a8'}}/>
          <span style={{fontSize:'0.74rem',color:M.muted}}>Unavailable</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:12,height:12,borderRadius:'50%',background:'var(--cream)',
            border:'1px solid var(--parchment)'}}/>
          <span style={{fontSize:'0.74rem',color:M.muted}}>Available</span>
        </div>
      </div>
    </div>
  );
}

function MobileVendorDetail({vendor, dateFrom, venueLabel, venueLatLng, onBack, onQuote}) {
  const [tab, setTab] = useState('about');
  const [lightboxImg, setLightboxImg] = useState(null);
  const travel = (vendor.distance_km||0)*(vendor.per_km_rate||0);
  const overnight = (vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0;
  const total = (vendor.fixed_rate||0)+travel+overnight;
  const imgs = vendor.images||[];
  const [imgIdx, setImgIdx] = useState(0);
  const touchStartX = useRef(null);
  const onReq = isOnRequest(vendor);

  function handleTouchStart(e){touchStartX.current=e.touches[0].clientX;}
  function handleTouchEnd(e){
    if(touchStartX.current===null||imgs.length<2)return;
    const dx=e.changedTouches[0].clientX-touchStartX.current;
    if(Math.abs(dx)>40){
      if(dx<0)setImgIdx(i=>Math.min(i+1,imgs.length-1));
      else setImgIdx(i=>Math.max(i-1,0));
    }
    touchStartX.current=null;
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:M.offWhite}}>
      {/* Hero image — swipeable */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{height:230,position:'relative',flexShrink:0,
          background:imgs[imgIdx]?.url?`url(${imgs[imgIdx].url}) center/cover`
            :`linear-gradient(140deg,${vendor.color||'#c8a87a'}cc,${vendor.color||'#c8a87a'}44)`}}>
        <button onClick={onBack}
          style={{position:'absolute',top:12,left:12,background:'rgba(0,0,0,0.3)',border:'none',
            borderRadius:10,padding:'6px 10px',color:M.white,cursor:'pointer',
            backdropFilter:'blur(4px)',display:'flex',alignItems:'center',gap:4}}>
          {IC.back(16,M.white)}
        </button>
        {imgs.length>1&&(
          <div style={{position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5}}>
            {imgs.map((_,i)=><div key={i} onClick={()=>setImgIdx(i)}
              style={{width:8,height:8,borderRadius:'50%',cursor:'pointer',
                background:i===imgIdx?M.white:'rgba(255,255,255,0.45)',
                transition:'background 0.2s'}}/>)}
          </div>
        )}
        <div style={{position:'absolute',top:12,right:12,background:'rgba(28,43,34,0.82)',
          color:M.gold,fontSize:'0.62rem',letterSpacing:'0.1em',textTransform:'uppercase',
          padding:'3px 9px',borderRadius:999,display:'flex',alignItems:'center',gap:4}}>
          <VendorIcon type={vendor.type} size={10} color={M.gold}/>{vendor.type}
        </div>
      </div>

      {/* Name + price */}
      <div style={{background:M.white,padding:'14px 16px 0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:4}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,
            color:M.heading,lineHeight:1.2,flex:1}}>{vendor.name}</div>
          <div style={{textAlign:'right',flexShrink:0}}>
            {onReq
              ?<div style={{fontSize:'0.88rem',color:M.rose,fontWeight:700,fontStyle:'italic'}}>On Request</div>
              :<div style={{fontSize:'1.1rem',color:M.rose,fontWeight:700}}>{fmt(total)}</div>}
            {venueLabel&&<div style={{fontSize:'0.68rem',color:M.muted,marginTop:2}}>from {venueLabel}</div>}
          </div>
        </div>
        <div style={{fontSize:'0.76rem',color:M.muted,marginBottom:12,display:'flex',alignItems:'center',gap:4}}>
          {IC.pin(13,M.muted)}{vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km away`:''}
        </div>
        {/* Tabs */}
        <div style={{display:'flex',borderBottom:`1px solid ${M.border}`,gap:0}}>
          {['about','pricing','availability'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,background:'none',border:'none',
                borderBottom:`2px solid ${tab===t?M.forest:'transparent'}`,
                padding:'8px 4px',fontSize:'0.78rem',fontWeight:tab===t?600:400,
                color:tab===t?M.forest:M.muted,cursor:'pointer',textTransform:'capitalize'}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflowY:'auto',background:M.offWhite,padding:'14px 16px'}}>
        {tab==='about'&&(
          <div>
            {vendor.description&&<div style={{background:M.white,borderRadius:12,padding:'14px',
              marginBottom:12,fontSize:'0.86rem',color:M.body,lineHeight:1.7,border:`1px solid ${M.border}`}}>
              {vendor.description}</div>}
            {/* Tappable gallery thumbnails */}
            {imgs.length>1&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:'0.7rem',textTransform:'uppercase',letterSpacing:'0.1em',color:M.muted,marginBottom:8,fontWeight:500}}>Gallery — tap to enlarge</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  {imgs.map((img,i)=>(
                    <div key={i} onClick={()=>setLightboxImg(img.url)}
                      style={{height:80,borderRadius:10,background:img.url?`url(${img.url}) center/cover`:'var(--parchment)',cursor:'pointer',border:`1px solid ${M.border}`}}/>
                  ))}
                </div>
              </div>
            )}
            {vendor.extra_info&&<div style={{background:M.white,borderRadius:12,padding:'14px',
              marginBottom:12,border:`1px solid ${M.border}`}}>
              <div style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.1em',
                color:M.muted,marginBottom:8,fontWeight:500}}>Additional Info</div>
              <div style={{fontSize:'0.84rem',color:M.body,lineHeight:1.7}}>{vendor.extra_info}</div>
            </div>}
            {vendor.instagram&&(
              <a href={`https://instagram.com/${vendor.instagram.replace('@','')}`}
                target="_blank" rel="noreferrer"
                style={{display:'flex',alignItems:'center',gap:10,background:M.white,
                  borderRadius:12,padding:'12px 14px',textDecoration:'none',
                  marginBottom:12,border:`1px solid ${M.border}`}}>
                <div style={{width:32,height:32,borderRadius:8,flexShrink:0,
                  background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {IC.instagram(16,M.white)}
                </div>
                <div>
                  <div style={{fontSize:'0.8rem',fontWeight:600,color:M.heading}}>
                    @{vendor.instagram.replace('@','')}</div>
                  <div style={{fontSize:'0.7rem',color:M.muted}}>View on Instagram</div>
                </div>
              </a>
            )}
          </div>
        )}
        {tab==='pricing'&&(
          <div>
            {onReq?(
              <div style={{background:M.white,borderRadius:12,padding:'14px',border:`1px solid ${M.border}`}}>
                <div style={{fontSize:'0.92rem',fontWeight:600,color:M.heading,marginBottom:8}}>Pricing on Request</div>
                <div style={{fontSize:'0.84rem',color:M.body,lineHeight:1.7,marginBottom:12}}>
                  Pricing varies based on your requirements. Request a quote for a personalised price.</div>
                {travel>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',
                  padding:'8px 0',borderTop:`1px solid ${M.border}`}}>
                  <span style={{color:M.body}}>Travel ({vendor.distance_km} km)</span>
                  <span style={{fontWeight:600,color:M.heading}}>{fmt(travel)}</span>
                </div>}
              </div>
            ):vendor.packages&&vendor.packages.length>0?(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:'0.72rem',letterSpacing:'0.1em',textTransform:'uppercase',
                  color:M.muted,fontWeight:500,paddingLeft:2}}>
                  {vendor.packages.length} Package{vendor.packages.length!==1?'s':''}
                </div>
                {[...vendor.packages]
                  .sort((a,b)=>calcPackageTotal(a,vendor.distance_km||0)-calcPackageTotal(b,vendor.distance_km||0))
                  .map((pkg,i)=>{
                    const pkgT=calcPackageTotal(pkg,vendor.distance_km||0);
                    const pkgTravel=(vendor.distance_km||0)*(pkg.per_km_rate||0);
                    const pkgOvernight=(vendor.distance_km||0)>(pkg.overnight_threshold_km||80)?(pkg.overnight_fee||0):0;
                    return(
                      <div key={pkg.id||i} style={{background:M.white,borderRadius:12,
                        padding:'14px',border:`1px solid ${M.border}`}}>
                        <div style={{display:'flex',justifyContent:'space-between',
                          alignItems:'flex-start',marginBottom:pkg.description?8:6}}>
                          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',
                            fontWeight:600,color:M.heading,flex:1,paddingRight:8}}>{pkg.name}</span>
                          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',
                            fontWeight:600,color:M.rose,flexShrink:0}}>{fmt(pkgT)}</span>
                        </div>
                        {pkg.description&&<p style={{fontSize:'0.78rem',color:M.muted,
                          margin:'0 0 8px',lineHeight:1.5}}>{pkg.description}</p>}
                        <div style={{display:'flex',flexWrap:'wrap',gap:6,
                          borderTop:`1px solid ${M.border}`,paddingTop:8}}>
                          <span style={{fontSize:'0.72rem',color:M.muted}}>Base: <strong style={{color:M.body}}>{fmt(pkg.fixed_rate)}</strong></span>
                          {pkgTravel>0&&<span style={{fontSize:'0.72rem',color:M.muted}}>Travel: <strong style={{color:M.body}}>{fmt(pkgTravel)}</strong></span>}
                          {pkgOvernight>0&&<span style={{fontSize:'0.72rem',color:M.muted}}>Overnight: <strong style={{color:M.body}}>{fmt(pkgOvernight)}</strong></span>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ):(
              <div style={{background:M.white,borderRadius:12,padding:'14px',border:`1px solid ${M.border}`}}>
                {[['Base rate',fmt(vendor.fixed_rate)],[`Travel (${vendor.distance_km||0} km)`,fmt(travel)],...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])]                  .map(([l,v],i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',
                    padding:'9px 0',borderBottom:`1px solid ${M.border}`,fontSize:'0.84rem'}}>
                    <span style={{color:M.body}}>{l}</span>
                    <span style={{fontWeight:500,color:M.heading}}>{v}</span>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  marginTop:12,paddingTop:12,borderTop:`2px solid ${M.border}`}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',
                    color:M.heading,fontWeight:600}}>Total estimate</span>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',
                    color:M.rose,fontWeight:600}}>{fmt(total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab==='availability'&&(
          <MobileAvailabilityTab vendor={vendor} dateFrom={dateFrom}/>
        )}
        <div style={{height:80}}/>
      </div>

      {/* Mobile Lightbox */}
      {lightboxImg&&(
        <div onClick={()=>setLightboxImg(null)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:3000,
            display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}>
          <button onClick={()=>setLightboxImg(null)}
            style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.15)',
              border:'none',borderRadius:'50%',width:36,height:36,color:'white',
              fontSize:'1.2rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
          <img src={lightboxImg} alt=""
            style={{maxWidth:'95vw',maxHeight:'90vh',objectFit:'contain',borderRadius:8}}/>
        </div>
      )}

      {/* Sticky CTA */}
      <div style={{background:M.white,padding:'12px 16px',borderTop:`1px solid ${M.border}`,flexShrink:0}}>
        <button onClick={onQuote}
          style={{width:'100%',background:M.rose,color:M.white,border:'none',borderRadius:14,
            padding:'15px',fontFamily:"'DM Sans',sans-serif",fontSize:'1rem',fontWeight:600,
            cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',
            justifyContent:'center',gap:8}}>
          {IC.quote(18,M.white)} Request a Quote
        </button>
      </div>
    </div>
  );
}

function MobileQuotesScreen({user, onBrowse, initialLead=null, onRequestQuote}) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeLead, setActiveLead] = useState(null);
  const initialApplied = useRef(false);
  const channelRef = useRef(null);
  const STATUS_META = {
    new:       {label:'New',        color:'#7a5a1a', bg:'rgba(201,169,110,0.1)'},
    responded: {label:'Responded',  color:'#1a5a3a', bg:'rgba(58,122,90,0.08)'},
    closed:    {label:'Closed',     color:'#666',    bg:'rgba(0,0,0,0.05)'},
  };

  useEffect(()=>{
    loadLeads();
    channelRef.current = supabase
      .channel(`mobile_quotes:${user.customerId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},()=>loadLeads())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads'},()=>loadLeads())
      .subscribe();
    return()=>{if(channelRef.current)supabase.removeChannel(channelRef.current);};
  },[]);

  useEffect(()=>{
    if(initialLead && leads.length>0 && !initialApplied.current){
      const found = leads.find(l=>l.id===initialLead.id);
      if(found){setActiveLead(found);initialApplied.current=true;}
    }
  },[leads]);

  async function loadLeads(){
    try{
      const data = await supaFetch(`leads?customer_id=eq.${user.customerId}&select=*,vendor:vendors(name,type,color,images:vendor_images(url))&order=created_at.desc`);
      const withMsgs = await Promise.all((data||[]).map(async lead=>{
        try{
          const msgs = await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);
          return{...lead, last_message:Array.isArray(msgs)?msgs[0]:null};
        }catch{return lead;}
      }));
      setLeads(withMsgs);
    }catch(e){}
    setLoading(false);
  }

  if(activeLead) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:M.white}}>
      <ChatThread
        lead={{...activeLead,customer_name:user.name,vendor_name:activeLead.vendor?.name}}
        currentRole="customer" currentName={user.name}
        onBack={()=>setActiveLead(null)}/>
    </div>
  );

  const grouped = {};
  leads.forEach(l=>{const t=l.vendor?.type||'Other';if(!grouped[t])grouped[t]=[];grouped[t].push(l);});
  const orderedTypes = [...ALL_TYPES.filter(t=>grouped[t]),
    ...Object.keys(grouped).filter(t=>!ALL_TYPES.includes(t)&&grouped[t])];
  const unread = leads.filter(l=>l.last_message?.sender_role==='vendor').length;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:M.offWhite}}>
      {/* Header — light theme */}
      <div style={{background:M.white,borderBottom:`1px solid ${M.border}`,padding:'14px 16px 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',
              color:M.heading,fontWeight:600}}>My Quotes</div>
            <div style={{fontSize:'0.72rem',color:M.muted,marginTop:2}}>Hi, {user.name}</div>
          </div>
          {unread>0&&<div style={{background:M.rose,color:M.white,borderRadius:999,
            fontSize:'0.72rem',fontWeight:700,padding:'3px 10px'}}>{unread} new</div>}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',background:M.offWhite,padding:'12px 14px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:'60px 20px',color:M.muted}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
              {IC.chat(40,'#e0dbd4')}
            </div>
            <div style={{fontSize:'0.88rem'}}>Loading your quotes…</div>
          </div>
        ):leads.length===0?(
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
              {IC.chat(48,'#e0dbd4')}
            </div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',
              color:M.heading,marginBottom:8}}>No quotes yet</div>
            <p style={{fontSize:'0.84rem',color:M.muted,marginBottom:20,lineHeight:1.6}}>
              Browse vendors and tap "Request a Quote" to start a conversation.</p>
            <button onClick={onBrowse}
              style={{background:M.forest,color:M.gold,border:'none',borderRadius:10,
                padding:'12px 24px',fontSize:'0.88rem',fontWeight:600,cursor:'pointer'}}>
              Browse Vendors
            </button>
          </div>
        ):(
          orderedTypes.map(type=>(
            <div key={type} style={{marginBottom:22}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{display:'flex'}}>
                  <VendorIcon type={type} size={16} color={M.forest}/>
                </span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',
                  fontWeight:600,color:M.heading}}>{type}</span>
                <span style={{fontSize:'0.68rem',color:M.muted,background:M.parchment,
                  padding:'2px 8px',borderRadius:999}}>{grouped[type].length}</span>
              </div>
              {grouped[type].map(lead=>{
                const sm = STATUS_META[lead.status]||STATUS_META.new;
                const hasNew = lead.last_message?.sender_role==='vendor';
                return(
                  <div key={lead.id} onClick={()=>setActiveLead(lead)}
                    style={{background:M.white,borderRadius:12,padding:'12px 14px',marginBottom:8,
                      cursor:'pointer',display:'flex',alignItems:'center',gap:12,
                      border:`1px solid ${hasNew?'rgba(196,130,106,0.3)':M.border}`,
                      borderLeft:`3px solid ${hasNew?M.rose:M.border}`}}>
                    <div style={{width:42,height:42,borderRadius:9,flexShrink:0,
                      background:lead.vendor?.images?.[0]?.url
                        ?`url(${lead.vendor.images[0].url}) center/cover`
                        :`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}cc,${lead.vendor?.color||'#c8a87a'}55)`}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:1}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem',color:M.heading,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {lead.vendor?.name}
                        </span>
                        {hasNew&&<span style={{width:7,height:7,borderRadius:'50%',
                          background:M.rose,flexShrink:0,display:'inline-block'}}/>}
                      </div>
                      <div style={{fontSize:'0.72rem',color:M.body,marginBottom:2}}>{lead.title}</div>
                      {lead.last_message&&<div style={{fontSize:'0.71rem',color:M.muted,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {lead.last_message.sender_role==='vendor'?'Vendor: ':''}
                        {lead.last_message.message_text||'Attachment'}
                      </div>}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <span style={{fontSize:'0.65rem',fontWeight:600,color:sm.color,
                        background:sm.bg,borderRadius:999,padding:'2px 8px',display:'block',
                        marginBottom:4}}>{sm.label}</span>
                      <span style={{fontSize:'0.65rem',color:M.muted}}>
                        {lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',
                          {day:'numeric',month:'short'}):''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

function MobileHomeTab({onVendorsLoaded}) {
  return <MobileSearchScreen onVendorsLoaded={onVendorsLoaded}/>;
}


// ── MOBILE APP ROOT ────────────────────────────────────────────────────────────
// ── Mobile Favourites Screen ──────────────────────────────────────────────────
function MobileFavouritesScreen({user, onOpen, onQuote, dateFrom, onLogin}) {
  const [favVendors, setFavVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if(!user?.customerId){setLoading(false);return;}
    supaFetch(`favourites?customer_id=eq.${user.customerId}&select=vendor:vendors(*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*))`)
      .then(data=>{
        setFavVendors((data||[]).map(f=>f.vendor).filter(Boolean));
      }).catch(()=>{}).finally(()=>setLoading(false));
  },[user?.customerId]);

  if(!user||user.role!=='customer') return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:14,background:'#fff'}}>
      <div style={{display:'flex',justifyContent:'center'}}>{IC.heart(48,'#f0e8dc')}</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'#3a4a3f',textAlign:'center'}}>Save your favourite vendors</div>
      <p style={{fontSize:'0.84rem',color:'#a8a8a8',textAlign:'center',lineHeight:1.7,maxWidth:260}}>Log in to bookmark vendors and find them here.</p>
      <button onClick={onLogin} style={{background:'#3a4a3f',color:'#e8d5a3',border:'none',borderRadius:12,padding:'12px 32px',fontSize:'0.9rem',fontWeight:600,cursor:'pointer'}}>Log In</button>
    </div>
  );

  // Group by type
  const byType={};
  ALL_TYPES.forEach(t=>{const vv=favVendors.filter(v=>v.type===t);if(vv.length)byType[t]=vv;});

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f8f6f3'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'1px solid #ede8e0',padding:'14px 16px 12px',flexShrink:0}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'#1c2b22',fontWeight:600}}>Favourites</div>
        <div style={{fontSize:'0.72rem',color:'#8a8a8a',marginTop:2}}>
          {loading?'Loading…':favVendors.length===0?'No saved vendors yet':`${favVendors.length} vendor${favVendors.length!==1?'s':''} saved`}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'12px 14px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:'60px 20px',color:'#8a8a8a'}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>{IC.heart(40,'#e0dbd4')}</div>
            <div style={{fontSize:'0.88rem'}}>Loading your favourites…</div>
          </div>
        ):favVendors.length===0?(
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>{IC.heart(48,'#e0dbd4')}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'#1c2b22',marginBottom:8}}>No favourites yet</div>
            <p style={{fontSize:'0.84rem',color:'#8a8a8a',lineHeight:1.6}}>Tap the heart icon on any vendor card to save them here.</p>
          </div>
        ):(
          Object.entries(byType).map(([type,vv])=>(
            <div key={type} style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{display:'flex'}}><VendorIcon type={type} size={16} color='#3a4a3f'/></span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:600,color:'#1c2b22'}}>{type}</span>
                <span style={{fontSize:'0.68rem',color:'#8a8a8a',background:'#f0e8dc',padding:'2px 8px',borderRadius:999}}>{vv.length}</span>
              </div>
              {vv.map(v=>(
                <MobileVendorCard key={v.id} vendor={v}
                  onOpen={()=>onOpen(v)}
                  onQuote={()=>onQuote(v)}
                  customerId={user?.customerId}/>
              ))}
            </div>
          ))
        )}
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

// ── Mobile Scenarios Screen ────────────────────────────────────────────────────
function MobileScenariosScreen({user, vendors, onLogin}) {
  if(!user||user.role!=='customer') return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:14,background:'#fff'}}>
      <div style={{display:'flex',justifyContent:'center'}}>{IC.map(48,'#f0e8dc')}</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'#3a4a3f',textAlign:'center'}}>Compare wedding scenarios</div>
      <p style={{fontSize:'0.84rem',color:'#a8a8a8',textAlign:'center',lineHeight:1.7,maxWidth:260}}>Log in to use the scenario comparison tool.</p>
      <button onClick={onLogin} style={{background:'#3a4a3f',color:'#e8d5a3',border:'none',borderRadius:12,padding:'12px 32px',fontSize:'0.9rem',fontWeight:600,cursor:'pointer'}}>Log In</button>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f8f6f3'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'1px solid #ede8e0',padding:'14px 16px 12px',flexShrink:0}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'#1c2b22',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
          {IC.map(18,'#1c2b22')}Scenario Builder
        </div>
        <div style={{fontSize:'0.72rem',color:'#8a8a8a',marginTop:2}}>Compare different venue and vendor combinations</div>
      </div>

      {/* Render full ScenarioBuilder scrollable */}
      <div style={{flex:1,overflowY:'auto'}}>
        <ScenarioBuilder user={user} vendors={vendors} onClose={null}/>
      </div>
    </div>
  );
}



export { MobileVenueInput, MobileVendorCard, MobileSearchScreen, MobileResultsScreen, MobileVendorDetail, MobileQuotesScreen, MobileHomeTab, MobileFavouritesScreen, MobileScenariosScreen };