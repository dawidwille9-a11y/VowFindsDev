import React, { useState, useEffect, useRef, memo } from 'react';
import { IC, VendorIcon, TYPE_ICON } from '../../icons.jsx';
import { fmt, isOnRequest, isVendorUnavailable, calcTotal, avg } from '../../utils.js';
import { ON_REQUEST_TYPES, ALL_TYPES } from '../../constants.js';
import VendorCard from './VendorCard.jsx';

// ── VendorGrid — desktop tabbed 3-column grid layout ─────────────────────────
function VendorGrid({vendorsByType,activeTypes,dateFrom,dateTo,onOpenDetail,onRequestQuote,customerId=null,planMaxPrices=null}) {
  // Track which type tab is active — default to first type that has vendors
  const typesWithVendors = activeTypes.filter(t=>(vendorsByType[t]||[]).length>0);
  const [activeTab,setActiveTab]=useState(()=>typesWithVendors[0]||activeTypes[0]||'');
  const [sortOrder,setSortOrder]=useState('default');
  const [maxPrice,setMaxPrice]=useState(null); // initialised per-tab
  const [page,setPage]=useState(1);
  const tabBarRef=useRef(null);
  const gridTopRef=useRef(null);

  // When active types change (filter), reset to first available tab
  useEffect(()=>{
    const first=activeTypes.find(t=>(vendorsByType[t]||[]).length>0);
    if(first&&first!==activeTab)setActiveTab(first);
  },[activeTypes.join(',')]);

  // When tab changes, reset sort/page/price
  useEffect(()=>{
    setSortOrder('default');
    setPage(1);
    const vendors=vendorsByType[activeTab]||[];
    const allReq=ON_REQUEST_TYPES.has(activeTab);
    if(!allReq&&vendors.length){
      const totals=vendors.map(v=>calcTotal(v));
      const sliderMax=Math.ceil(Math.max(...totals,1000)*1.15/1000)*1000;
      const initMax=planMaxPrices?.[activeTab]??null;
      setMaxPrice(initMax!==null?Math.min(initMax,sliderMax):sliderMax);
    }else setMaxPrice(null);
  },[activeTab]);

  useEffect(()=>setPage(1),[sortOrder,maxPrice]);

  const vendors=vendorsByType[activeTab]||[];
  const allOnRequest=ON_REQUEST_TYPES.has(activeTab);
  const totals=vendors.map(v=>calcTotal(v));
  const sliderMax=totals.length?Math.ceil(Math.max(...totals,1000)*1.15/1000)*1000:100000;
  const minT=totals.length?Math.min(...totals,0):0;
  const avgT=totals.length?avg(totals):0;
  const currentMax=maxPrice??sliderMax;
  const pct=sliderMax>minT?Math.round(((currentMax-minT)/(sliderMax-minT))*100):100;
  const avgPct=avgT>0&&sliderMax>minT?Math.round(((avgT-minT)/(sliderMax-minT))*100):0;

  const filtered=allOnRequest?vendors:vendors.filter(v=>calcTotal(v)<=currentMax);
  const sorted=[...filtered].sort((a,b)=>{
    if(sortOrder==='asc')return calcTotal(a)-calcTotal(b);
    if(sortOrder==='desc')return calcTotal(b)-calcTotal(a);
    // default: by distance if available
    if(a.distance_km!=null&&b.distance_km!=null)return a.distance_km-b.distance_km;
    return 0;
  });

  const PAGE_SIZE=9; // 3 cols × 3 rows
  const pageVendors=sorted.slice(0,page*PAGE_SIZE);
  const hasMore=pageVendors.length<sorted.length;

  const sortLabel=sortOrder==='asc'?'Price ↑':sortOrder==='desc'?'Price ↓':vendors[0]?.distance_km!=null?'Distance':'Sort';

  function cycleSort(){setSortOrder(s=>s==='default'?'asc':s==='asc'?'desc':'default');}

  function switchTab(t){
    setActiveTab(t);
    // Scroll tab into view
    setTimeout(()=>{
      const bar=tabBarRef.current;
      if(!bar)return;
      const btn=bar.querySelector(`[data-tab="${t}"]`);
      if(btn)btn.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    },50);
  }

  if(typesWithVendors.length===0)return null;

  return(
    <div style={{maxWidth:1240,margin:'0 auto',padding:'0 24px 60px'}}>

      {/* ── Type tab bar ── */}
      <div ref={tabBarRef} style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:24,
        scrollbarWidth:'none',borderBottom:'2px solid var(--parchment)',flexWrap:'wrap'}}>
        {typesWithVendors.map(t=>{
          const isActive=t===activeTab;
          const count=(vendorsByType[t]||[]).length;
          return(
            <button key={t} data-tab={t} onClick={()=>switchTab(t)}
              style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',
                background:isActive?'var(--forest)':'transparent',
                color:isActive?'var(--gold-light)':'var(--mid)',
                border:'none',borderRadius:'8px 8px 0 0',
                fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:isActive?600:400,
                cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap',
                borderBottom:isActive?'2px solid var(--forest)':'2px solid transparent',
                marginBottom:-2,flexShrink:0}}>
              <span style={{color:isActive?'var(--gold-light)':'var(--mid)',display:'flex'}}>
                {(TYPE_ICON[t]||IC.camera)(15,isActive?'var(--gold-light)':'var(--mid)')}
              </span>
              {t}
              <span style={{fontSize:'0.68rem',background:isActive?'rgba(255,255,255,0.15)':'var(--parchment)',
                color:isActive?'var(--gold-light)':'var(--light)',borderRadius:999,padding:'1px 7px',fontWeight:600}}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Active type header + controls ── */}
      <div ref={gridTopRef} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        flexWrap:'wrap',gap:12,marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--forest)'}}>
            {activeTab}
          </span>
          {allOnRequest&&<span style={{fontSize:'0.72rem',color:'var(--rose)',fontStyle:'italic',fontWeight:500}}>On Request</span>}
          <span style={{fontSize:'0.74rem',color:'var(--light)',background:'var(--parchment)',padding:'3px 10px',borderRadius:999}}>
            {filtered.length} vendor{filtered.length!==1?'s':''}
            {filtered.length!==vendors.length&&` of ${vendors.length}`}
          </span>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {/* Sort */}
          {filtered.length>1&&(
            <button onClick={cycleSort}
              style={{display:'flex',alignItems:'center',gap:6,
                background:sortOrder!=='default'?'var(--forest)':'var(--white)',
                color:sortOrder!=='default'?'var(--gold-light)':'var(--mid)',
                border:`1.5px solid ${sortOrder!=='default'?'var(--forest)':'var(--parchment)'}`,
                borderRadius:8,padding:'7px 14px',fontSize:'0.78rem',fontWeight:500,cursor:'pointer',
                transition:'all 0.15s',whiteSpace:'nowrap'}}>
              {IC.chevronD(13,sortOrder!=='default'?'var(--gold-light)':'var(--mid)')}
              {sortLabel}
            </button>
          )}
          {/* Price slider */}
          {!allOnRequest&&totals.length>0&&(
            <div style={{background:'var(--white)',borderRadius:10,padding:'9px 16px',
              boxShadow:'var(--card-shadow)',display:'flex',flexDirection:'column',gap:5,minWidth:240}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                <span style={{fontSize:'0.68rem',letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--mid)'}}>Max price</span>
                <span style={{fontSize:'0.8rem',fontWeight:600,color:'var(--rose)'}}>{fmt(currentMax)}</span>
              </div>
              <div style={{position:'relative'}}>
                <input type="range" min={minT} max={sliderMax} step={500} value={currentMax}
                  onChange={e=>setMaxPrice(parseInt(e.target.value))}
                  style={{width:'100%',WebkitAppearance:'none',appearance:'none',height:4,borderRadius:2,
                    outline:'none',cursor:'pointer',
                    background:`linear-gradient(to right,var(--rose) 0%,var(--rose) ${pct}%,var(--parchment) ${pct}%,var(--parchment) 100%)`}}/>
                <div style={{position:'absolute',top:-3,left:`${avgPct}%`,transform:'translateX(-50%)',
                  width:2,height:10,background:'var(--gold)',borderRadius:1,pointerEvents:'none'}}/>
              </div>
              <div style={{fontSize:'0.7rem',color:'var(--light)',display:'flex',gap:4}}>
                <span>Avg:</span>
                <span style={{color:'var(--gold)',fontWeight:500}}>{fmt(avgT)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3-column vendor grid ── */}
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'48px 0',color:'var(--light)',fontSize:'0.88rem',fontStyle:'italic'}}>
          No vendors match this price filter. Try increasing the maximum price.
        </div>
      ):(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:22}}>
            {pageVendors.map(v=>{
              const unavail=isVendorUnavailable(v,dateFrom,dateTo);
              return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo}
                onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)}
                customerId={customerId} onFav={!!customerId}/>;
            })}
          </div>
          {/* Load more */}
          {hasMore&&(
            <div style={{textAlign:'center',marginTop:32}}>
              <button onClick={()=>setPage(p=>p+1)}
                style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,
                  padding:'12px 32px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,
                  cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8}}>
                {IC.chevronD(16,'var(--gold-light)')}
                Show {Math.min(PAGE_SIZE,sorted.length-pageVendors.length)} more {activeTab} vendors
              </button>
              <div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:8}}>
                Showing {pageVendors.length} of {sorted.length}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── VendorLane — kept for any code that still imports it (mobile / plan view) ─
function VendorLane({type,vendors,dateFrom,dateTo,onOpenDetail,isLast,onRequestQuote,customerId=null,initialMaxPrice=null}) {
  const allOnRequest = ON_REQUEST_TYPES.has(type);
  const totals=vendors.map(v=>calcTotal(v));
  const maxT=Math.max(...totals,1000),minT=Math.min(...totals,0),avgT=avg(totals),sliderMax=Math.ceil(maxT*1.15/1000)*1000;
  const [maxPrice,setMaxPrice]=useState(()=>initialMaxPrice!==null?Math.min(initialMaxPrice,sliderMax):sliderMax);
  const [sortOrder,setSortOrder]=useState('default');
  const [page,setPage]=useState(1);
  const scrollRef=useRef(null);
  useEffect(()=>setPage(1),[maxPrice,sortOrder]);
  const pct=Math.round(((maxPrice-minT)/(sliderMax-minT))*100);
  const avgPct=avgT>0?Math.round(((avgT-minT)/(sliderMax-minT))*100):0;
  const filtered=allOnRequest?vendors:vendors.filter(v=>calcTotal(v)<=maxPrice);
  const sorted=[...filtered].sort((a,b)=>{
    if(sortOrder==='asc')return calcTotal(a)-calcTotal(b);
    if(sortOrder==='desc')return calcTotal(b)-calcTotal(a);
    return 0;
  });
  const pageVendors=sorted.slice(0,page*12);
  const hasMore=pageVendors.length<sorted.length;
  const sortLabel=sortOrder==='asc'?'Price: Low → High':sortOrder==='desc'?'Price: High → Low':'Sort';
  function cycleSort(){setSortOrder(s=>s==='default'?'asc':s==='asc'?'desc':'default');}
  return(
    <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
      <div className="vf-lane-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',marginBottom:16,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{display:'flex',color:'var(--forest)'}}>{(TYPE_ICON[type]||IC.camera)(20,'var(--forest)')}</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
          <span style={{fontSize:'0.75rem',color:'var(--light)',background:'var(--parchment)',padding:'3px 10px',borderRadius:999}}>{filtered.length} vendor{filtered.length!==1?'s':''}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {!allOnRequest&&filtered.length>1&&(<button onClick={cycleSort} style={{display:'flex',alignItems:'center',gap:6,background:sortOrder!=='default'?'var(--forest)':'var(--white)',color:sortOrder!=='default'?'var(--gold-light)':'var(--mid)',border:`1.5px solid ${sortOrder!=='default'?'var(--forest)':'var(--parchment)'}`,borderRadius:8,padding:'6px 12px',fontSize:'0.76rem',fontWeight:500,cursor:'pointer'}}>{IC.chevronD(14,sortOrder!=='default'?'var(--gold-light)':'var(--mid)')}{sortLabel}</button>)}
          {!allOnRequest&&(<div style={{background:'var(--white)',borderRadius:10,padding:'10px 18px',boxShadow:'var(--card-shadow)',display:'flex',flexDirection:'column',gap:6,minWidth:240}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span style={{fontSize:'0.7rem',letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--mid)'}}>Max price</span><span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--rose)'}}>{fmt(maxPrice)}</span></div><div style={{position:'relative'}}><input type="range" min={minT} max={sliderMax} step={500} value={maxPrice} onChange={e=>setMaxPrice(parseInt(e.target.value))} style={{width:'100%',WebkitAppearance:'none',appearance:'none',height:4,borderRadius:2,outline:'none',cursor:'pointer',background:`linear-gradient(to right,var(--rose) 0%,var(--rose) ${pct}%,var(--parchment) ${pct}%,var(--parchment) 100%)`}}/><div style={{position:'absolute',top:-3,left:`${avgPct}%`,transform:'translateX(-50%)',width:2,height:10,background:'var(--gold)',borderRadius:1,pointerEvents:'none'}}/></div><div style={{fontSize:'0.72rem',color:'var(--light)',display:'flex',alignItems:'center',gap:4}}><span>Avg:</span><span style={{color:'var(--gold)',fontWeight:500}}>{fmt(avgT)}</span></div></div>)}
        </div>
      </div>
      <div style={{position:'relative'}}>
        <button onClick={()=>scrollRef.current?.scrollBy({left:-320,behavior:'smooth'})} style={{position:'absolute',left:6,top:'50%',transform:'translateY(-60%)',zIndex:20,background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:'50%',width:36,height:36,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>{IC.back(16,'var(--mid)')}</button>
        <button onClick={()=>scrollRef.current?.scrollBy({left:320,behavior:'smooth'})} style={{position:'absolute',right:6,top:'50%',transform:'translateY(-60%)',zIndex:20,background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:'50%',width:36,height:36,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.12)'}}>{IC.chevronR(16,'var(--mid)')}</button>
        <div ref={scrollRef} style={{display:'flex',gap:20,overflowX:'auto',padding:'4px 52px 20px',scrollbarWidth:'none'}}>
          {pageVendors.map(v=>{const unavail=isVendorUnavailable(v,dateFrom,dateTo);return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo} onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)} customerId={customerId} onFav={!!customerId}/>;  })}
          {hasMore&&(<div style={{flex:'0 0 200px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,borderRadius:16,border:'2px dashed var(--parchment)',cursor:'pointer',padding:20,background:'var(--cream)'}} onClick={()=>setPage(p=>p+1)}><div style={{fontSize:'0.8rem',color:'var(--mid)',fontWeight:500,textAlign:'center'}}>{sorted.length-pageVendors.length} more</div></div>)}
          {filtered.length===0&&<div style={{padding:'24px 0',fontSize:'0.85rem',color:'var(--light)',fontStyle:'italic'}}>No vendors match this price filter.</div>}
        </div>
      </div>
      {!isLast&&<hr style={{border:'none',borderTop:'1px solid var(--parchment)',margin:'8px 32px 40px'}}/>}
    </div>
  );
}

// ── VENDOR FORM (shared by dashboard + admin) ─────────────────────────────────

export default VendorLane;
export { VendorLane, VendorGrid };
