import React, { useState, useEffect } from 'react';
import { supaFetch } from '../../api.js';
import { fmt } from '../../utils.js';

const MERCHANT_ID  = import.meta.env.VITE_PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = import.meta.env.VITE_PAYFAST_MERCHANT_KEY;
const SANDBOX      = import.meta.env.VITE_PAYFAST_SANDBOX === 'true';
const PF_URL       = SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';
const SITE_URL     = SANDBOX ? 'https://vow-finds-dev.vercel.app' : 'https://vowfinds.co.za';

const PLANS = {
  monthly: { label: 'Monthly', amount: 300,  billing: 'month', frequency: '3', cycles: '0' },
  annual:  { label: 'Annual',  amount: 2500, billing: 'year',  frequency: '6', cycles: '1', saving: 'Save R1,100 vs monthly' },
};

const FEATURES = [
  'Full vendor profile listing',
  'Unlimited customer quote requests',
  'Photo gallery (6+ images)',
  'Availability calendar',
  'Direct chat with customers',
  'Distance shown from venue',
];

function statusMeta(s) {
  if(s==='active')    return { bg:'rgba(58,122,90,0.1)',   color:'#1a7a4a', dot:'#2aaa6a', label:'Active'    };
  if(s==='trial')     return { bg:'rgba(201,169,110,0.1)', color:'#9a7a3a', dot:'#c9a96e', label:'Trial'     };
  if(s==='past_due')  return { bg:'rgba(196,130,106,0.1)', color:'#c4826a', dot:'#e8352a', label:'Past Due'  };
  if(s==='cancelled') return { bg:'rgba(168,168,168,0.12)',color:'#777',    dot:'#aaa',    label:'Cancelled' };
  return                     { bg:'rgba(168,168,168,0.12)', color:'#777',    dot:'#aaa',    label:'Expired'   };
}

export default function SubscriptionPanel({ userId, userEmail, adminOverride=false, showTrialBadge=false }) {
  const [sub, setSub]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [paying, setPaying]       = useState(null);
  const [payments, setPayments]   = useState([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [showCancel, setShowCancel]     = useState(false);
  const [cancelling, setCancelling]     = useState(false);
  const [cancelDone, setCancelDone]     = useState(false);

  useEffect(()=>{ if(userId) loadSub(); },[userId]);

  async function loadSub() {
    setLoading(true);
    try {
      const data = await supaFetch(`subscriptions?vendor_user_id=eq.${userId}&limit=1`);
      setSub(data&&data.length ? data[0] : null);
    } catch(e) {}
    setLoading(false);
  }

  async function loadHistory() {
    try {
      const data = await supaFetch(`subscription_payments?vendor_user_id=eq.${userId}&order=created_at.desc&limit=24`);
      setPayments(data||[]);
      setShowHistory(true);
    } catch(e) {}
  }

  async function cancelSubscription() {
    setCancelling(true);
    try {
      await supaFetch(`subscriptions?vendor_user_id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'cancelled',
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        }),
      });
      setCancelDone(true);
      setShowCancel(false);
      await loadSub();
    } catch(e) {
      alert('Could not cancel: ' + e.message);
    }
    setCancelling(false);
  }

  function startPayment(planKey) {
    setPaying(planKey);
    const p = PLANS[planKey];
    const mPaymentId = `${userId}:${planKey}:${Date.now()}`;

    // Billing starts 3 months from today (free trial period)
    const billingStart = new Date();
    billingStart.setMonth(billingStart.getMonth() + 3);
    const billingDate = billingStart.toISOString().split('T')[0];

    const params = {
      merchant_id:       MERCHANT_ID,
      merchant_key:      MERCHANT_KEY,
      return_url:        `${SITE_URL}?payment=success`,
      cancel_url:        `${SITE_URL}?payment=cancelled`,
      notify_url:        `${SITE_URL}/api/payfast-notify`,
      name_first:        'Vendor',
      email_address:     userEmail||'hello@vowfinds.co.za',
      m_payment_id:      mPaymentId,
      amount:            '0.00',          // R0 today — trial period
      item_name:         `VowFinds ${p.label} Listing`,
      item_description:  `VowFinds vendor listing. First payment on ${billingDate}.`,
      custom_str1:       userId,
      custom_str2:       planKey,
      subscription_type: '1',
      billing_date:      billingDate,      // first charge in 3 months
      recurring_amount:  p.amount.toFixed(2),
      frequency:         p.frequency,
      cycles:            p.cycles,
    };

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = PF_URL;
    Object.entries(params).forEach(([k,v])=>{
      const el = document.createElement('input');
      el.type='hidden'; el.name=k; el.value=v;
      form.appendChild(el);
    });
    document.body.appendChild(form);
    form.submit();
  }

  if(loading) return <div style={{textAlign:'center',padding:'32px',color:'var(--light)'}}>Loading billing info…</div>;

  const sm        = statusMeta(sub?.status||'trial');
  const trialEnd  = sub?.trial_ends_at   ? new Date(sub.trial_ends_at)        : null;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const daysLeft  = trialEnd ? Math.max(0,Math.ceil((trialEnd-Date.now())/(1000*60*60*24))) : null;
  const isActive  = sub?.status==='active';
  const isTrial   = !sub || sub.status==='trial';
  const isCancelled = sub?.status==='cancelled'||sub?.status==='expired';
  const isPastDue = sub?.status==='past_due';

  return(
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {adminOverride&&(
        <div style={{background:'rgba(201,169,110,0.12)',border:'1px solid var(--gold)',borderRadius:10,padding:'10px 16px',fontSize:'0.8rem',color:'var(--forest)',display:'flex',alignItems:'center',gap:8}}>
          ✓ <strong>Admin view</strong> — subscription paywall bypassed for this vendor.
        </div>
      )}

      {/* Status badge — only show if already have a sub record */}
      {sub&&(
        <div style={{background:sm.bg,borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:sm.dot,flexShrink:0}}/>
            <div>
              <div style={{fontSize:'0.9rem',fontWeight:600,color:sm.color}}>
                {sm.label}{sub.plan?` · ${sub.plan==='annual'?'Annual':'Monthly'} plan`:''}
              </div>
              <div style={{fontSize:'0.74rem',color:'var(--mid)',marginTop:2}}>
                {isTrial&&trialEnd&&`Free trial — ${daysLeft} day${daysLeft!==1?'s':''} left (ends ${trialEnd.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})})`}
                {isActive&&periodEnd&&`Next billing: ${periodEnd.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})}`}
                {isCancelled&&'Your subscription has been cancelled. Your listing is no longer visible to customers.'}
                {isPastDue&&'Payment failed. Please re-subscribe to restore your listing.'}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {sub&&<button onClick={loadHistory} style={{fontSize:'0.72rem',color:'var(--mid)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}}>Payment history</button>}
          </div>
        </div>
      )}

      {/* Trial running low warning */}
      {isTrial&&daysLeft!==null&&daysLeft<=14&&(
        <div style={{background:'rgba(196,130,106,0.08)',border:'1px solid rgba(196,130,106,0.25)',borderRadius:10,padding:'11px 15px',fontSize:'0.83rem',color:'var(--charcoal)',lineHeight:1.6}}>
          ⚠️ Your free trial ends in <strong>{daysLeft} day{daysLeft!==1?'s':''}</strong>. Subscribe below to keep your listing live.
        </div>
      )}

      {/* Cancel done confirmation */}
      {cancelDone&&(
        <div style={{background:'rgba(58,122,90,0.07)',border:'1px solid rgba(58,122,90,0.2)',borderRadius:10,padding:'12px 16px',fontSize:'0.83rem',color:'#1a7a4a'}}>
          ✓ Your subscription has been cancelled. Your listing will remain visible until the end of your current billing period.
          We are sorry to see you go — email <a href="mailto:hello@vowfinds.co.za" style={{color:'var(--forest)'}}>hello@vowfinds.co.za</a> if you change your mind.
        </div>
      )}

      {/* Plan cards — shown when not active, or cancelled */}
      {(!isActive||isCancelled||isPastDue)&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* Trial badge on paywall page */}
          {showTrialBadge&&(
            <div style={{background:'rgba(58,122,90,0.06)',border:'1px solid rgba(58,122,90,0.2)',borderRadius:10,padding:'10px 16px',fontSize:'0.8rem',color:'var(--forest)',textAlign:'center',fontWeight:500}}>
              🎁 First charge only in 3 months — cancel anytime before then and pay nothing
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {Object.entries(PLANS).map(([planKey,plan])=>(
              <div key={planKey} style={{borderRadius:14,border:`2px solid ${planKey==='annual'?'var(--gold)':'var(--parchment)'}`,
                padding:'20px',background:planKey==='annual'?'rgba(201,169,110,0.04)':'var(--white)',
                position:'relative',display:'flex',flexDirection:'column',gap:12}}>
                {planKey==='annual'&&(
                  <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',
                    background:'var(--gold)',color:'var(--forest)',fontSize:'0.64rem',fontWeight:700,
                    padding:'3px 12px',borderRadius:999,whiteSpace:'nowrap',letterSpacing:'0.05em'}}>
                    BEST VALUE
                  </div>
                )}
                <div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>{plan.label}</div>
                  {plan.saving&&<div style={{fontSize:'0.71rem',color:'var(--gold)',fontWeight:600,marginTop:2}}>{plan.saving}</div>}
                </div>
                <div>
                  <div style={{display:'flex',alignItems:'baseline',gap:4}}>
                    <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.9rem',fontWeight:700,color:'var(--charcoal)'}}>
                      R{plan.amount.toLocaleString()}
                    </span>
                    <span style={{fontSize:'0.78rem',color:'var(--light)'}}>/mo starting month 4</span>
                  </div>
                  <div style={{fontSize:'0.72rem',color:'#2aaa6a',fontWeight:600,marginTop:2}}>First 3 months free</div>
                </div>
                <ul style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:5}}>
                  {FEATURES.map(f=>(
                    <li key={f} style={{fontSize:'0.79rem',color:'var(--mid)',display:'flex',alignItems:'center',gap:7}}>
                      <span style={{color:'var(--forest)',flexShrink:0}}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button disabled={paying===planKey} onClick={()=>startPayment(planKey)}
                  style={{marginTop:'auto',background:planKey==='annual'?'var(--gold)':'var(--forest)',
                    color:planKey==='annual'?'var(--forest)':'var(--gold-light)',
                    border:'none',borderRadius:10,padding:'11px',
                    fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:600,
                    cursor:paying===planKey?'wait':'pointer',opacity:paying===planKey?0.7:1}}>
                  {paying===planKey?'Redirecting to PayFast…':`Start free — then R${plan.amount.toLocaleString()}/${plan.billing}`}
                </button>
              </div>
            ))}
          </div>
          <div style={{fontSize:'0.72rem',color:'var(--light)',textAlign:'center',lineHeight:1.7}}>
            No charge for 3 months. Cancel anytime. Payments processed securely by PayFast.
          </div>
        </div>
      )}

      {/* Active subscription management + cancel option */}
      {isActive&&!isCancelled&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{background:'var(--cream)',borderRadius:10,padding:'13px 16px',fontSize:'0.81rem',color:'var(--mid)',lineHeight:1.7}}>
            Your listing is active and visible to all customers on VowFinds.
          </div>

          {/* Cancel subscription */}
          {!showCancel?(
            <button onClick={()=>setShowCancel(true)}
              style={{background:'none',border:'1px solid var(--parchment)',borderRadius:8,padding:'8px 16px',
                fontSize:'0.78rem',color:'var(--light)',cursor:'pointer',alignSelf:'flex-start'}}>
              Cancel subscription
            </button>
          ):(
            <div style={{background:'rgba(196,130,106,0.06)',border:'1.5px solid rgba(196,130,106,0.25)',borderRadius:12,padding:'18px 20px',display:'flex',flexDirection:'column',gap:12}}>
              <div style={{fontWeight:600,color:'var(--charcoal)',fontSize:'0.88rem'}}>Cancel your subscription?</div>
              <div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.7}}>
                Your listing will remain visible until <strong>{periodEnd?.toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})}</strong>, then be removed.
                You can re-subscribe at any time. This action cannot be undone here — contact us if you change your mind.
              </div>
              <div style={{display:'flex',gap:10'}}>
                <button onClick={()=>setShowCancel(false)}
                  style={{flex:1,background:'var(--parchment)',border:'none',borderRadius:8,padding:'9px',
                    fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',fontWeight:500}}>
                  Keep my subscription
                </button>
                <button onClick={cancelSubscription} disabled={cancelling}
                  style={{flex:1,background:'#b85a45',border:'none',borderRadius:8,padding:'9px',
                    fontSize:'0.82rem',color:'white',cursor:cancelling?'wait':'pointer',fontWeight:600,opacity:cancelling?0.7:1}}>
                  {cancelling?'Cancelling…':'Yes, cancel subscription'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment history */}
      {showHistory&&payments.length>0&&(
        <div style={{background:'var(--white)',borderRadius:12,border:'1px solid var(--parchment)',overflow:'hidden'}}>
          <div style={{padding:'11px 15px',borderBottom:'1px solid var(--parchment)',fontSize:'0.8rem',fontWeight:600,color:'var(--forest)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            Payment History
            <button onClick={()=>setShowHistory(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.74rem',color:'var(--light)'}}>Close</button>
          </div>
          {payments.map(p=>(
            <div key={p.id} style={{padding:'9px 15px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,fontSize:'0.79rem'}}>
              <div>
                <div style={{color:'var(--charcoal)',fontWeight:500}}>R{p.amount_rands}</div>
                <div style={{color:'var(--light)',fontSize:'0.71rem'}}>{new Date(p.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})}</div>
              </div>
              <span style={{fontSize:'0.69rem',background:p.status==='COMPLETE'?'rgba(58,122,90,0.1)':'rgba(196,130,106,0.1)',
                color:p.status==='COMPLETE'?'#1a7a4a':'#c4826a',padding:'2px 8px',borderRadius:999,fontWeight:600}}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
