import React, { useState, useEffect, useRef, memo } from 'react';
import { IC, VendorIcon, TYPE_ICON } from '../../icons.jsx';
import { fmt, isOnRequest, isVendorUnavailable, calcTotal, avg } from '../../utils.js';
import { ON_REQUEST_TYPES } from '../../constants.jsx';
import VendorCard from './VendorCard.jsx';

const LANE_PAGE_SIZE = 12;

function VendorLane({type,vendors,dateFrom,dateTo,onOpenDetail,isLast,onRequestQuote,customerId=null,initialMaxPrice=null}) {
  const allOnRequest = ON_REQUEST_TYPES.has(type);
  const totals=vendors.map(v=>calcTotal(v));
  const maxT=Math.max(...totals,1000),minT=Math.min(...totals,0),avgT=avg(totals),sliderMax=Math.ceil(maxT*1.15/1000)*1000;
  const [maxPrice,setMaxPrice]=useState(()=>initialMaxPrice!==null?Math.min(initialMaxPrice,sliderMax):sliderMax);
  // 'default' | 'asc' | 'desc'
  const [sortOrder,setSortOrder]=useState('default');
  const [page,setPage]=useState(1);
  const scrollRef=useRef(null);

  // Reset page when filters change
  useEffect(()=>setPage(1),[maxPrice,sortOrder]);

  const pct=Math.round(((maxPrice-minT)/(sliderMax-minT))*100);
  const avgPct=avgT>0?Math.round(((avgT-minT)/(sliderMax-minT))*100):0;

  // Filter by price
  const filtered=allOnRequest?vendors:vendors.filter(v=>calcTotal(v)<=maxPrice);

  // Sort
  const sorted=[...filtered].sort((a,b)=>{
    if(sortOrder==='asc')return calcTotal(a)-calcTotal(b);
    if(sortOrder==='desc')return calcTotal(b)-calcTotal(a);
    return 0; // default: preserve original order
  });

  // Paginate
  const pageVendors=sorted.slice(0,page*LANE_PAGE_SIZE);
  const hasMore=pageVendors.length<sorted.length;

  const sortLabel=sortOrder==='asc'?'Price: Low → High':sortOrder==='desc'?'Price: High → Low':'Sort';

  function cycleSort(){
    setSortOrder(s=>s==='default'?'asc':s==='asc'?'desc':'default');
  }

  return (
    <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
      <div className="vf-lane-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',marginBottom:16,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{display:'flex',color:'var(--forest)'}}>{(TYPE_ICON[type]||IC.camera)(20,'var(--forest)')}</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
          <span style={{fontSize:'0.75rem',color:'var(--light)',background:'var(--parchment)',padding:'3px 10px',borderRadius:999}}>
            {filtered.length} vendor{filtered.length!==1?'s':''}
            {filtered.length!==vendors.length&&` (${vendors.length} total)`}
          </span>
          {allOnRequest&&<span style={{fontSize:'0.72rem',color:'var(--rose)',fontStyle:'italic',fontWeight:500}}>On Request</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          {/* Sort button */}
          {!allOnRequest&&filtered.length>1&&(
            <button onClick={cycleSort}
              style={{display:'flex',alignItems:'center',gap:6,background:sortOrder!=='default'?'var(--forest)':'var(--white)',
                color:sortOrder!=='default'?'var(--gold-light)':'var(--mid)',
                border:`1.5px solid ${sortOrder!=='default'?'var(--forest)':'var(--parchment)'}`,
                borderRadius:8,padding:'6px 12px',fontSize:'0.76rem',fontWeight:500,cursor:'pointer',
                transition:'all 0.15s',whiteSpace:'nowrap'}}>
              {IC.chevronD(14,sortOrder!=='default'?'var(--gold-light)':'var(--mid)')}
              {sortLabel}
            </button>
          )}
          {/* Price slider */}
          {!allOnRequest&&(
            <div style={{background:'var(--white)',borderRadius:10,padding:'10px 18px',boxShadow:'var(--card-shadow)',display:'flex',flexDirection:'column',gap:6,minWidth:260}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                <span style={{fontSize:'0.7rem',letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--mid)'}}>Max price</span>
                <span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--rose)'}}>{fmt(maxPrice)}</span>
              </div>
              <div style={{position:'relative'}}>
                <input type="range" min={minT} max={sliderMax} step={500} value={maxPrice}
                  onChange={e=>setMaxPrice(parseInt(e.target.value))}
                  style={{width:'100%',WebkitAppearance:'none',appearance:'none',height:4,borderRadius:2,outline:'none',cursor:'pointer',
                    background:`linear-gradient(to right,var(--rose) 0%,var(--rose) ${pct}%,var(--parchment) ${pct}%,var(--parchment) 100%)`}}/>
                <div style={{position:'absolute',top:-3,left:`${avgPct}%`,transform:'translateX(-50%)',width:2,height:10,background:'var(--gold)',borderRadius:1,pointerEvents:'none'}}/>
              </div>
              <div style={{fontSize:'0.72rem',color:'var(--light)',display:'flex',alignItems:'center',gap:4}}>
                <span>Avg. for this category:</span>
                <span style={{color:'var(--gold)',fontWeight:500}}>{fmt(avgT)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{position:'relative'}}>
        {/* Scroll buttons — visible on desktop */}
        <button onClick={()=>{const el=scrollRef.current;if(el)el.scrollBy({left:-320,behavior:'smooth'});}}
          style={{position:'absolute',left:6,top:'50%',transform:'translateY(-60%)',zIndex:20,
            background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:'50%',
            width:36,height:36,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 2px 8px rgba(0,0,0,0.12)',transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--forest)';e.currentTarget.style.borderColor='var(--forest)';e.currentTarget.querySelector('svg').style.stroke='var(--gold-light)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='var(--white)';e.currentTarget.style.borderColor='var(--parchment)';e.currentTarget.querySelector('svg').style.stroke='var(--mid)';}}
          >{IC.back(16,'var(--mid)')}
        </button>
        <button onClick={()=>{const el=scrollRef.current;if(el)el.scrollBy({left:320,behavior:'smooth'});}}
          style={{position:'absolute',right:6,top:'50%',transform:'translateY(-60%)',zIndex:20,
            background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:'50%',
            width:36,height:36,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 2px 8px rgba(0,0,0,0.12)',transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--forest)';e.currentTarget.style.borderColor='var(--forest)';e.currentTarget.querySelector('svg').style.stroke='var(--gold-light)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='var(--white)';e.currentTarget.style.borderColor='var(--parchment)';e.currentTarget.querySelector('svg').style.stroke='var(--mid)';}}>
          {IC.chevronR(16,'var(--mid)')}
        </button>
        <div className="vf-lane-fade-left" style={{position:'absolute',top:0,bottom:20,left:0,width:50,background:'linear-gradient(to right,#ffffff,transparent)',zIndex:10,pointerEvents:'none'}}/>
        <div className="vf-lane-fade-right" style={{position:'absolute',top:0,bottom:20,right:0,width:50,background:'linear-gradient(to left,#ffffff,transparent)',zIndex:10,pointerEvents:'none'}}/>
        <div ref={scrollRef} style={{display:'flex',gap:20,overflowX:'auto',padding:'4px 52px 20px',scrollbarWidth:'none',scrollSnapType:'x mandatory'}}>
          {pageVendors.map(v=>{
            const unavail=isVendorUnavailable(v,dateFrom,dateTo);
            return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo}
              onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)}
              customerId={customerId} onFav={!!customerId}/>;
          })}
          {/* Load more card */}
          {hasMore&&(
            <div style={{flex:'0 0 200px',width:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,
              borderRadius:16,border:'2px dashed var(--parchment)',cursor:'pointer',padding:20,
              background:'var(--cream)',transition:'border-color 0.15s'}}
              onClick={()=>setPage(p=>p+1)}
              onMouseEnter={e=>e.currentTarget.style.borderColor='var(--rose)'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='var(--parchment)'}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--parchment)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {IC.chevronR(20,'var(--mid)')}
              </div>
              <div style={{fontSize:'0.8rem',color:'var(--mid)',fontWeight:500,textAlign:'center'}}>
                {sorted.length-pageVendors.length} more {type} vendor{sorted.length-pageVendors.length!==1?'s':''}
              </div>
            </div>
          )}
          {filtered.length===0&&(
            <div style={{padding:'24px 0',fontSize:'0.85rem',color:'var(--light)',fontStyle:'italic'}}>
              No vendors match this price filter.
            </div>
          )}
        </div>
      </div>
      {!isLast&&<hr className="vf-lane-divider" style={{border:'none',borderTop:'1px solid var(--parchment)',margin:'8px 32px 40px'}}/>}
    </div>
  );
}

// ── VENDOR FORM (shared by dashboard + admin) ─────────────────────────────────

export default VendorLane;
export { VendorLane };