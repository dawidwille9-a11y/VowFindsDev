import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch } from '../../api.js';
import { IC } from '../../icons.jsx';

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

export default FavStar;
export { FavStar };