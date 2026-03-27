import React, { useState, useEffect, useRef, memo } from 'react';
import { IC, VendorIcon } from '../../icons.js';
import { fmt, isOnRequest, isVendorUnavailable, calcTotal } from '../../utils.js';
import { ON_REQUEST_TYPES } from '../../constants.js';
import VendorCard from './VendorCard.jsx';

function VendorLane({type,vendors,dateFrom,dateTo,onOpenDetail,isLast,onRequestQuote,customerId=null,initialMaxPrice=null}) {
  // On-request categories have no fixed pricing — skip the price slider entirely
  const allOnRequest = ON_REQUEST_TYPES.has(type);
  const totals=vendors.map(v=>calcTotal(v));
  const maxT=Math.max(...totals,1000),minT=Math.min(...totals,0),avgT=avg(totals),sliderMax=Math.ceil(maxT*1.15/1000)*1000;
  const [maxPrice,setMaxPrice]=useState(()=>initialMaxPrice!==null?Math.min(initialMaxPrice,sliderMax):sliderMax);
  const pct=Math.round(((maxPrice-minT)/(sliderMax-minT))*100),avgPct=avgT>0?Math.round(((avgT-minT)/(sliderMax-minT))*100):0;
  const visible=allOnRequest?vendors:vendors.filter(v=>calcTotal(v)<=maxPrice);
  return (
    <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
      <div className="vf-lane-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',marginBottom:16,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{display:'flex',color:'var(--forest)'}}>{(TYPE_ICON[type]||IC.camera)(20,'var(--forest)')}</span>
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
            const unavail=isVendorUnavailable(v,dateFrom,dateTo);
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

export default VendorLane;
export {{ VendorLane }};