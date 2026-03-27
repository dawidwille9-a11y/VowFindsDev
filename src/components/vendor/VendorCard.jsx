import React, { useState, useEffect, useRef, memo } from 'react';
import { IC, VendorIcon } from '../../icons.jsx';
import { fmt, formatDateDisplay, isOnRequest, isVendorUnavailable } from '../../utils.js';
import { TYPE_EMOJI } from '../../constants.jsx';
import FavStar from './FavStar.jsx';

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
              <button type="button" onClick={clear} style={{background:'none',border:'none',cursor:'pointer',color:'var(--rose)',fontWeight:500,fontSize:'0.75rem',display:'flex',alignItems:'center',gap:4}}>{IC.x(12,'var(--rose)')}Clear</button>
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
<div style={{display:'flex',justifyContent:'center'}}>{IC.calendar(32,'#f0e8dc')}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',color:'var(--mid)',fontWeight:600,textAlign:'center',padding:'0 16px'}}>Unavailable for your date</div>
        <div style={{fontSize:'0.74rem',color:'var(--light)'}}>{dateFrom?formatDateDisplay(dateFrom):''}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</div>
        <div style={{fontSize:'0.74rem',color:'var(--rose)',marginTop:4}}>Tap to view profile →</div>
      </div>}
      <div className="vf-card-img" style={{height:160,position:'relative',background:primaryImg?`url(${primaryImg}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}ee 0%,${vendor.color||'#c8a87a'}66 100%),linear-gradient(160deg,#ede5db 0%,#d8ccc0 100%)`}}>
        <div className="vf-card-type-badge" style={{position:'absolute',top:10,left:10,background:'rgba(58,74,63,0.88)',color:'var(--gold-light)',fontSize:'0.62rem',letterSpacing:'0.1em',textTransform:'uppercase',padding:'3px 9px',borderRadius:999,backdropFilter:'blur(4px)',display:'flex',alignItems:'center',gap:5}}><span style={{display:'flex'}}>{(TYPE_ICON[vendor.type]||IC.camera)(11,'var(--gold-light)')}</span>{vendor.type}</div>
        <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4,alignItems:'center'}}>
          {onFav&&<div onClick={e=>{e.stopPropagation();}} style={{background:'rgba(255,255,255,0.92)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}><FavStar vendor={vendor} customerId={customerId}/></div>}
          {vendor.instagram&&<a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="vf-card-ig" style={{background:'rgba(255,255,255,0.92)',color:'var(--rose)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',textDecoration:'none',fontWeight:700}}>ig</a>}
        </div>
      </div>
      <div className="vf-card-body" style={{padding:'16px 18px 18px'}}>
        <div className="vf-card-name" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:600,color:'var(--forest)',marginBottom:3}}>{vendor.name}</div>
        <div className="vf-card-location" style={{fontSize:'0.75rem',color:'var(--light)',marginBottom:10,display:'flex',alignItems:'center',gap:4}}><span style={{display:'flex'}}>{IC.pin(13,'var(--light)')}</span>{vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km away`:''}</div>
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

export default VendorCard;
export {{ VendorCard }};