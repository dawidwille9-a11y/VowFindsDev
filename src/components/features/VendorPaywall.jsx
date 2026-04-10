import React, { useState, useEffect } from 'react';
import { supaFetch } from '../../api.js';
import { IC } from '../../icons.jsx';
import SubscriptionPanel from '../features/SubscriptionPanel.jsx';

// Checks app_settings for paywall_enabled flag
// Returns: loading state + whether to block the vendor
export function usePaywallEnabled() {
  const [enabled, setEnabled] = useState(null); // null=loading
  useEffect(()=>{
    supaFetch("app_settings?key=eq.paywall_enabled&select=value&limit=1")
      .then(data=>{
        if(data&&data.length) setEnabled(data[0].value==='true');
        else setEnabled(false); // default off if key missing
      })
      .catch(()=>setEnabled(false));
  },[]);
  return enabled;
}

// Checks whether a vendor user has an active or trial subscription
export function useVendorSubscription(userId) {
  const [sub, setSub]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    if(!userId){setLoading(false);return;}
    supaFetch(`subscriptions?vendor_user_id=eq.${userId}&limit=1`)
      .then(data=>setSub(data&&data.length?data[0]:null))
      .catch(()=>setSub(null))
      .finally(()=>setLoading(false));
  },[userId]);
  return { sub, loading };
}

export default function VendorPaywall({ user, children }) {
  const paywallEnabled = usePaywallEnabled();
  const { sub, loading: subLoading } = useVendorSubscription(user?.userId);

  // Admin always passes through
  if(user?.adminView) return children;

  // Still loading config
  if(paywallEnabled===null||subLoading) return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'var(--cream)',color:'var(--light)',fontSize:'0.88rem'}}>
      Loading…
    </div>
  );

  // Paywall is off — let everyone through
  if(!paywallEnabled) return children;

  // Paywall is on — check subscription
  const isAllowed = sub && (sub.status==='active'||sub.status==='trial');
  if(isAllowed) return children;

  // Blocked — show payment wall
  return(
    <div style={{minHeight:'100vh',background:'var(--cream)',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{background:'var(--forest)',padding:'18px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em'}}>
          Vow<span style={{color:'#e8b4a0',fontStyle:'italic'}}>Finds</span>
        </div>
        <span style={{fontSize:'0.76rem',color:'rgba(255,255,255,0.5)'}}>Vendor Portal</span>
      </div>

      {/* Paywall content */}
      <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'48px 20px'}}>
        <div style={{maxWidth:640,width:'100%'}}>
          <div style={{textAlign:'center',marginBottom:36}}>
            <div style={{fontSize:'2.8rem',marginBottom:12}}>💍</div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:300,
              color:'var(--forest)',marginBottom:10}}>
              Welcome to VowFinds
            </h1>
            <p style={{color:'var(--mid)',fontSize:'0.92rem',lineHeight:1.75,maxWidth:480,margin:'0 auto'}}>
              Subscribe to list your business and start receiving quote requests from couples planning their wedding in the Boland and beyond.
            </p>
          </div>

          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',padding:'28px'}}>
            <SubscriptionPanel userId={user?.userId} userEmail={user?.email}/>
          </div>

          <p style={{textAlign:'center',marginTop:20,fontSize:'0.78rem',color:'var(--light)'}}>
            Questions? Email us at{' '}
            <a href="mailto:hello@vowfinds.co.za" style={{color:'var(--forest)'}}>hello@vowfinds.co.za</a>
          </p>
        </div>
      </div>
    </div>
  );
}
