import React, { useState, useEffect } from 'react';
import { supaFetch } from '../../api.js';
import SubscriptionPanel from '../features/SubscriptionPanel.jsx';

export function usePaywallEnabled() {
  const [enabled, setEnabled] = useState(null);
  useEffect(()=>{
    supaFetch("app_settings?key=eq.paywall_enabled&select=value&limit=1")
      .then(data=>setEnabled(data&&data.length?data[0].value==='true':false))
      .catch(()=>setEnabled(false));
  },[]);
  return enabled;
}

export function useVendorSubscription(userId) {
  const [sub, setSub] = useState(null);
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

  if(user?.adminView) return children;

  if(paywallEnabled===null||subLoading) return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'var(--cream)',color:'var(--light)',fontSize:'0.88rem'}}>
      Loading…
    </div>
  );

  if(!paywallEnabled) return children;

  const isAllowed = sub && (sub.status==='active'||sub.status==='trial');
  if(isAllowed) return children;

  // Blocked — show payment wall with 3-month trial promise
  const trialEndDate = new Date();
  trialEndDate.setMonth(trialEndDate.getMonth()+3);
  const trialEndStr = trialEndDate.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'});

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)',display:'flex',flexDirection:'column'}}>
      <div style={{background:'var(--forest)',padding:'18px 32px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em'}}>
          Vow<span style={{color:'#e8b4a0',fontStyle:'italic'}}>Finds</span>
        </div>
        <span style={{fontSize:'0.76rem',color:'rgba(255,255,255,0.5)'}}>Vendor Portal</span>
      </div>

      <div style={{flex:1,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'48px 20px'}}>
        <div style={{maxWidth:660,width:'100%',display:'flex',flexDirection:'column',gap:20}}>

          {/* Hero */}
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'2.8rem',marginBottom:10}}>💍</div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:300,color:'var(--forest)',marginBottom:8}}>
              List your business on VowFinds
            </h1>
            <p style={{color:'var(--mid)',fontSize:'0.9rem',lineHeight:1.8,maxWidth:460,margin:'0 auto'}}>
              Reach couples planning their perfect Boland wedding. Choose a plan below — your listing goes live immediately.
            </p>
          </div>

          {/* 3-month trial promise banner */}
          <div style={{background:'rgba(58,122,90,0.07)',border:'1.5px solid rgba(58,122,90,0.25)',
            borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'flex-start',gap:14}}>
            <div style={{fontSize:'1.4rem',flexShrink:0}}>🎁</div>
            <div>
              <div style={{fontWeight:600,color:'var(--forest)',fontSize:'0.92rem',marginBottom:4}}>
                3 months free — no charge until {trialEndStr}
              </div>
              <div style={{fontSize:'0.82rem',color:'var(--mid)',lineHeight:1.7}}>
                Subscribe today and your first payment only processes in 3 months. 
                You can cancel anytime before then and pay nothing. 
                Your listing goes live the moment you subscribe.
              </div>
            </div>
          </div>

          {/* Plan cards */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.08)',padding:'28px'}}>
            <SubscriptionPanel userId={user?.userId} userEmail={user?.email} showTrialBadge={true}/>
          </div>

          <p style={{textAlign:'center',fontSize:'0.78rem',color:'var(--light)'}}>
            Questions? Email us at{' '}
            <a href="mailto:hello@vowfinds.co.za" style={{color:'var(--forest)'}}>hello@vowfinds.co.za</a>
          </p>
        </div>
      </div>
    </div>
  );
}
