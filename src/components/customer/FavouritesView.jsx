import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES } from '../../constants.jsx';
import { isVendorUnavailable } from '../../utils.js';
import VendorCard from '../vendor/VendorCard.jsx';

function FavouritesView({customerId,onOpenDetail,onRequestQuote,dateFrom,dateTo}) {
  const [favVendors,setFavVendors]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!customerId){setLoading(false);return;}
    supaFetch(`favourites?customer_id=eq.${customerId}&select=vendor:vendors(*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date),packages:vendor_packages(*))`)
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
            <VendorIcon type={type} size={18} color='var(--forest)'/> {type}
          </div>
          <div style={{display:'flex',gap:18,overflowX:'auto',paddingBottom:8}}>
            {vv.map(v=>{
              const unavail=isVendorUnavailable(v,dateFrom,dateTo);
              return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo} onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)} customerId={customerId} onFav={!!customerId}/>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── WEDDING PLAN ──────────────────────────────────────────────────────────────
// ── WEDDING PLAN CONSTANTS ────────────────────────────────────────────────────

// Primary booking order — these are the 10 core vendor categories

export default FavouritesView;
export { FavouritesView };