import React, { useState, useEffect, useRef, memo } from 'react';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES } from '../../constants.jsx';
import VendorLane from '../vendor/VendorLane.jsx';
import VendorsMap from '../maps/VendorsMap.jsx';
import DateRangePicker from '../calendar/DateRangePicker.jsx';
import VenueAutocomplete from '../maps/VenueAutocomplete.jsx';

function CustomerBrowseView({user,venue,setVenue,venueLatLng,setVenueLatLng,dateFrom,setDateFrom,dateTo,setDateTo,selectedTypes,setSelectedTypes,vendors,setVendors,loading,setLoading,loadError,setLoadError,calcProgress,setCalcProgress,searched,setSearched,showMap,setShowMap,openDetail,onRequestQuote,onOpenScenario,onOpenFavourites,browseView,setBrowseView,planMaxPrices=null}) {
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
              {selectedTypes.size===ALL_TYPES.length?'All selected':'Select all'}
            </button>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.13)',borderRadius:14,padding:'12px 14px',backdropFilter:'blur(8px)',display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'center'}}>
            {ALL_TYPES.map(t=>{
              const active=selectedTypes.has(t);
              return(
                <div key={t} onClick={()=>toggleType(t)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:999,cursor:'pointer',userSelect:'none',background:active?'rgba(196,130,106,0.28)':'rgba(255,255,255,0.06)',border:`1.5px solid ${active?'rgba(196,130,106,0.65)':'rgba(255,255,255,0.15)'}`,transition:'all 0.15s'}}>
                  <span style={{display:'flex',alignItems:'center',gap:6,color:active?'var(--cream)':'rgba(255,255,255,0.6)',fontWeight:active?500:400,whiteSpace:'nowrap'}}><VendorIcon type={t} size={14} color={active?'var(--cream)':'rgba(255,255,255,0.6)'}/>{t}</span>
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
            {vendorsWithLoc.length>0&&<button onClick={()=>setShowMap(s=>!s)} style={{background:'var(--parchment)',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',color:'var(--forest)',cursor:'pointer'}}style={{display:'flex',alignItems:'center',gap:5}}>{IC.map(14,'var(--forest)')}{showMap?'Hide map':'Show map'}</button>}
          </div>
          {!loading&&!loadError&&showMap&&vendorsWithLoc.length>0&&<VendorsMap vendors={vendorsWithLoc} venueLatLng={venueLatLng} onSelectVendor={openDetail}/>}
          {!loading&&!loadError&&activeTypes.map((type,idx)=>{const tv=vendorsByType[type];if(!tv||tv.length===0)return null;return<VendorLane key={type} type={type} vendors={tv} dateFrom={dateFrom} dateTo={dateTo} onOpenDetail={openDetail} isLast={idx===activeTypes.length-1} onRequestQuote={onRequestQuote} customerId={user?.customerId} initialMaxPrice={planMaxPrices?planMaxPrices[type]??null:null}/>;  })}
        </div>
      )}
    </div>
  );
}


// ── MOBILE APP ─────────────────────────────────────────────────────────────────
// Completely separate mobile UI, rendered only when window.innerWidth < 768.
// Desktop components are untouched. Shares all utility functions + Supabase.

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE COMPONENTS — all colors are explicit hex, zero CSS variables
// Background palette: #ffffff (white), #f8f6f3 (off-white), #f0ebe4 (border)
// Text: #1a1a1a (heading), #4a4a4a (body), #8a8a8a (muted)
// Accent: #3a4a3f (forest), #c4826a (rose), #e8d5a3 (gold)
// ─────────────────────────────────────────────────────────────────────────────


export default CustomerBrowseView;
export { CustomerBrowseView };