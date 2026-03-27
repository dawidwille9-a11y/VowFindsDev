import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch, loadGoogleMaps } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES, BOOKING_ORDER, ADDITIONAL_VENDORS, BUDGET_RATIOS } from '../../constants.jsx';
import { fmt, isOnRequest } from '../../utils.js';

function WeddingPlanVenueInput({value, onChange, onLatLng}) {
  const inputRef = useRef();
  useEffect(()=>{
    if(inputRef.current && value) inputRef.current.value = value;
    loadGoogleMaps().then(google=>{
      if(!inputRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment','geocode'],
        componentRestrictions: {country:'za'},
      });
      ac.addListener('place_changed', ()=>{
        const place = ac.getPlace();
        if(place.geometry){
          const name = place.formatted_address || place.name;
          if(inputRef.current) inputRef.current.value = name;
          onChange(name);
          if(onLatLng) onLatLng({lat:place.geometry.location.lat(),lng:place.geometry.location.lng()});
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return (
    <input
      ref={inputRef}
      style={inputStyle}
      defaultValue={value}
      onChange={e=>onChange(e.target.value)}
      placeholder="e.g. Babylonstoren, Franschhoek"
    />
  );
}

function WeddingPlan({onClose, vendors: passedVendors, onSearchVendors}) {
  const [planStep, setPlanStep] = useState('intro');
  const [weddingVenue, setWeddingVenue] = useState('');
  const [weddingVenueLatLng, setWeddingVenueLatLng] = useState(null);
  const [totalBudget, setTotalBudget] = useState('');
  const [onReqAverages, setOnReqAverages] = useState({});
  const [allVendors, setAllVendors] = useState(passedVendors||[]);

  // Fetch all vendors if none passed (so averages always work)
  useEffect(()=>{
    if(allVendors.length===0){
      supaFetch('vendors?select=id,name,type,fixed_rate&order=type')
        .then(d=>setAllVendors(d||[])).catch(()=>{});
    }
    // Fetch admin-set on-request averages
    const keys = [...ON_REQUEST_TYPES].map(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`);
    supaFetch(`app_settings?key=in.(${keys.map(k=>'"'+k+'"').join(',')})&select=key,value`)
      .then(data=>{
        const map = {};
        (data||[]).forEach(row=>{
          const type = [...ON_REQUEST_TYPES].find(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`===row.key);
          if(type && row.value) map[type] = parseInt(row.value)||0;
        });
        setOnReqAverages(map);
      }).catch(()=>{});
  },[]);

  // Calculate average costs from real vendor data + admin on-request averages
  const avgCosts = useMemo(() => {
    const result = {};
    [...BOOKING_ORDER.map(o=>o.type), ...ADDITIONAL_VENDORS.map(a=>a.type)].forEach(type => {
      if(ON_REQUEST_TYPES.has(type)){
        result[type] = onReqAverages[type] || null;
      } else {
        const typed = allVendors.filter(v => v.type === type);
        const tots = typed.map(v => v.fixed_rate || 0).filter(n => n > 0);
        result[type] = tots.length > 0 ? Math.round(tots.reduce((a,b)=>a+b,0)/tots.length) : null;
      }
    });
    return result;
  }, [allVendors, onReqAverages]);

  const budget = parseFloat(totalBudget) || 0;

  // Recommended spend — ratios applied to total budget
  const recommendedSpend = useMemo(() => {
    if (!budget) return {};
    const result = {};
    Object.keys(BUDGET_RATIOS).forEach(type => {
      result[type] = Math.round(budget * BUDGET_RATIOS[type]);
    });
    return result;
  }, [budget]);

  // Leftover budget after primary categories
  const primaryTotal = useMemo(()=>{
    if(!budget) return 0;
    return BOOKING_ORDER.reduce((sum,o)=>sum+(recommendedSpend[o.type]||0),0);
  },[recommendedSpend,budget]);
  const leftover = budget - primaryTotal;

  const cardStyle = {background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:20,overflow:'hidden'};

  // ── INTRO SCREEN ──────────────────────────────────────────────────────────
  if (planStep === 'intro') return (
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={onClose} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.rings(18,'var(--forest)')} Wedding Plan</div>
      </div>
      <div style={{maxWidth:740,margin:'0 auto',padding:'32px 24px 60px'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2.2rem',color:'var(--forest)',fontWeight:300,marginBottom:8}}>Plan Your Perfect Wedding</div>
          <p style={{color:'var(--mid)',fontSize:'0.9rem',maxWidth:500,margin:'0 auto',lineHeight:1.7}}>Follow the recommended booking order to secure the best vendors — before they're taken.</p>
        </div>

        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',padding:'24px',marginBottom:28}}>
          <div style={{fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--mid)',marginBottom:18,fontWeight:500}}>Recommended Booking Order</div>
          {BOOKING_ORDER.map((item,idx)=>(
            <div key={item.step} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:idx<BOOKING_ORDER.length-1?'1px solid var(--parchment)':'none'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--forest)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.8rem',flexShrink:0}}>{item.step}</div>
              <div style={{width:26,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'var(--mid)'}}><VendorIcon type={item.type} size={17} color='var(--mid)'/></div>
              <div style={{fontSize:'0.92rem',fontWeight:500,color:'var(--charcoal)',flex:1}}>{item.type}</div>
              {idx<3&&<span style={{fontSize:'0.66rem',color:'var(--rose)',fontWeight:600,background:'rgba(196,130,106,0.1)',padding:'2px 8px',borderRadius:999}}>Book first</span>}
            </div>
          ))}
        </div>

        <button onClick={()=>setPlanStep('setup')} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:12,padding:'16px',fontFamily:"'DM Sans',sans-serif",fontSize:'1rem',fontWeight:600,cursor:'pointer',letterSpacing:'0.05em'}}>
          Get Started →
        </button>
      </div>
    </div>
  );

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────
  if (planStep === 'setup') return (
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setPlanStep('intro')} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.rings(18,'var(--forest)')} Your Wedding Details</div>
      </div>
      <div style={{maxWidth:580,margin:'0 auto',padding:'40px 24px 60px'}}>
        <p style={{color:'var(--mid)',fontSize:'0.9rem',marginBottom:28,lineHeight:1.7}}>Enter your wedding venue and total vendor budget. We'll break it down into a recommended spend per category based on industry averages.</p>
        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',padding:'28px'}}>
          <div style={{marginBottom:20}}>
            <label style={labelStyle}>Wedding Venue / Location</label>
            <WeddingPlanVenueInput value={weddingVenue} onChange={setWeddingVenue} onLatLng={ll=>setWeddingVenueLatLng(ll)}/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={labelStyle}>Total Vendor Budget (R)</label>
            <input style={inputStyle} type="number" value={totalBudget} onChange={e=>setTotalBudget(e.target.value)} placeholder="e.g. 150000"/>
            <div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:5}}>Your total spend across all wedding vendors, excluding venue hire costs.</div>
          </div>

          {/* Live budget preview */}
          {budget>0&&(
            <div style={{background:'rgba(58,74,63,0.05)',borderRadius:10,padding:'14px 16px',marginBottom:20,border:'1px solid rgba(58,74,63,0.1)'}}>
              <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>Budget breakdown preview</div>
              {BOOKING_ORDER.map(({type})=>(
                <div key={type} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.8rem',padding:'4px 0',borderBottom:'1px solid rgba(58,74,63,0.06)'}}>
                  <span style={{color:'var(--mid)',display:'flex',alignItems:'center',gap:5}}><VendorIcon type={type} size={13} color='var(--mid)'/>{type}{ON_REQUEST_TYPES.has(type)&&<span style={{fontSize:'0.66rem',color:'var(--rose)',marginLeft:4}}>on request</span>}</span>
                  <span style={{fontWeight:600,color:'var(--forest)'}}>{fmt(Math.round(budget*(BUDGET_RATIOS[type]||0.05)))}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.8rem',padding:'6px 0 0',marginTop:4,borderTop:'1px solid rgba(58,74,63,0.12)'}}>
                <span style={{color:'var(--mid)',fontStyle:'italic'}}>+ Additional vendors (Barista etc.)</span>
                <span style={{fontWeight:600,color:'var(--gold)'}}>{fmt(leftover>0?leftover:Math.round(budget*0.04))}</span>
              </div>
            </div>
          )}

          <button onClick={()=>{if(!budget){alert('Please enter a budget to continue.');return;}setPlanStep('plan');}}
            style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.92rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em'}}>
            Build My Wedding Plan →
          </button>
        </div>

        {/* Budget logic explainer */}
        <div style={{marginTop:20,background:'var(--white)',borderRadius:12,boxShadow:'var(--card-shadow)',padding:'20px 22px'}}>
          <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>How we calculate your recommended spend</div>
          <div style={{fontSize:'0.78rem',color:'var(--mid)',lineHeight:1.7}}>
            Your budget is divided using industry-standard ratios based on South African wedding averages:
          </div>
          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:4}}>
            {Object.entries(BUDGET_RATIOS).filter(([t])=>BOOKING_ORDER.some(o=>o.type===t)).map(([type,ratio])=>(
              <div key={type} style={{display:'flex',justifyContent:'space-between',fontSize:'0.76rem',color:'var(--mid)'}}>
                <span style={{display:'flex',alignItems:'center',gap:6}}><VendorIcon type={type} size={14} color='var(--mid)'/>{type}</span>
                <span style={{fontWeight:500,color:'var(--charcoal)'}}>{Math.round(ratio*100)}%</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,fontSize:'0.74rem',color:'var(--light)',lineHeight:1.6}}>
            Catering takes the largest share as it scales with guest count. Photography and videography are premium bookings. The remaining ~4% is set aside for additional vendors like a barista.
          </div>
        </div>
      </div>
    </div>
  );

  // ── FULL PLAN VIEW ────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setPlanStep('setup')} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Edit</button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.rings(18,'var(--forest)')} Wedding Plan</div>
        </div>
        <div style={{textAlign:'right'}}>
          {weddingVenue&&<div style={{fontSize:'0.76rem',color:'var(--mid)',display:'flex',alignItems:'center',gap:4}}>{IC.pin(13,'var(--mid)')}{weddingVenue}</div>}
          <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--rose)'}}>Budget: {fmt(budget)}</div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'24px 24px 60px'}}>
        {/* Mini booking order strip */}
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:28,scrollbarWidth:'none'}}>
          {BOOKING_ORDER.map(item=>(
            <div key={item.step} style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,width:60}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'center'}}><VendorIcon type={item.type} size={18} color='var(--gold-light)'/></div>
              <div style={{fontSize:'0.58rem',color:'var(--mid)',textAlign:'center',lineHeight:1.3,fontWeight:500,maxWidth:56}}>{item.type}</div>
            </div>
          ))}
        </div>

        {/* PRIMARY vendor sections */}
        {BOOKING_ORDER.map((item) => {
          const isOnReq = ON_REQUEST_TYPES.has(item.type);
          const catVendors = allVendors.filter(v => v.type === item.type);
          const prices = catVendors.filter(v=>!isOnReq).map(v=>v.fixed_rate||0).filter(n=>n>0);
          const catAvg = avgCosts[item.type];
          const catMin = prices.length>0 ? Math.min(...prices) : null;
          const catMax = prices.length>0 ? Math.max(...prices) : null;
          const recSpend = recommendedSpend[item.type] || 0;
          const vendorCount = prices.length;
          return (
            <div key={item.type} style={cardStyle}>
              <div style={{background:'var(--forest)',padding:'14px 20px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.15)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.88rem',flexShrink:0}}>{item.step}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:28}}><VendorIcon type={item.type} size={20} color='var(--gold-light)'/></div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--gold-light)',fontWeight:600,flex:1}}>{item.type}</div>
              </div>
              <div style={{padding:'18px 20px'}}>
                <div style={{fontSize:'0.88rem',color:'var(--charcoal)',lineHeight:1.65,marginBottom:8}}>{item.note}</div>
                <div style={{fontSize:'0.8rem',color:'var(--mid)',background:'var(--parchment)',borderRadius:8,padding:'8px 12px',lineHeight:1.55,marginBottom:14}}>
                  <strong style={{color:'var(--forest)'}}>Why book now:</strong> {item.why}
                </div>

                {isOnReq ? (
                  <div>
                    {(catAvg||recSpend>0)&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                        <div style={{background:'var(--parchment)',borderRadius:10,padding:'14px 16px'}}>
                          <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Avg. market cost</div>
                          {catAvg ? (
                            <>
                              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>{fmt(catAvg)}</div>
                              <div style={{fontSize:'0.71rem',color:'var(--light)'}}>Indicative — varies by requirements</div>
                            </>
                          ):<div style={{fontSize:'0.82rem',color:'var(--light)',fontStyle:'italic'}}>Not set yet</div>}
                        </div>
                        <div style={{background:'rgba(58,74,63,0.06)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(58,74,63,0.1)'}}>
                          <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Recommended spend</div>
                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--rose)',marginBottom:4}}>{fmt(recSpend)}</div>
                          <div style={{fontSize:'0.72rem',color:'var(--light)'}}>{Math.round((BUDGET_RATIOS[item.type]||0.05)*100)}% of your budget</div>
                          {catAvg&&<div style={{fontSize:'0.71rem',marginTop:5,color:recSpend>=catAvg?'var(--forest)':'var(--rose)',fontWeight:500}}>{recSpend>=catAvg?'Within range':'Below average'}</div>}
                        </div>
                      </div>
                    )}
                    <div style={{background:'rgba(196,130,106,0.06)',borderRadius:10,padding:'11px 14px',border:'1px solid rgba(196,130,106,0.18)',fontSize:'0.82rem',color:'var(--mid)',lineHeight:1.6}}>
                      Pricing is confirmed on request — the figures above are indicative for budgeting purposes. Use <em>Request a Quote</em> on any {item.type} vendor page.
                    </div>
                    {onSearchVendors&&(
                      <button
                        onClick={()=>onSearchVendors({venueName:weddingVenue,venueLL:weddingVenueLatLng,type:item.type,maxPrice:null})}
                        style={{marginTop:10,width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                        <span style={{display:'flex',alignItems:'center',gap:8}}>{IC.search(16,'var(--gold-light)')} Browse {item.type} Vendors</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div style={{background:'var(--parchment)',borderRadius:10,padding:'14px 16px'}}>
                        <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Market average</div>
                        {catAvg ? (
                          <>
                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>{fmt(catAvg)}</div>
                            <div style={{fontSize:'0.72rem',color:'var(--light)',marginBottom:2}}>Range: {catMin?fmt(catMin):'–'} – {catMax?fmt(catMax):'–'}</div>
                            <div style={{fontSize:'0.71rem',color:'var(--light)'}}>Based on {vendorCount} vendor{vendorCount!==1?'s':''} on VowFinds</div>
                          </>
                        ):<div style={{fontSize:'0.82rem',color:'var(--light)',fontStyle:'italic'}}>No vendors listed yet</div>}
                      </div>
                      <div style={{background:'rgba(58,74,63,0.06)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(58,74,63,0.1)'}}>
                        <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Recommended spend</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--rose)',marginBottom:4}}>{fmt(recSpend)}</div>
                        <div style={{fontSize:'0.72rem',color:'var(--light)'}}>{Math.round((BUDGET_RATIOS[item.type]||0.05)*100)}% of your budget</div>
                        {catAvg&&recSpend>0&&<div style={{fontSize:'0.71rem',marginTop:5,color:recSpend>=catAvg?'var(--forest)':'var(--rose)',fontWeight:500}}>{recSpend>=catAvg?'Within range':'Below average'}</div>}
                      </div>
                    </div>
                    {onSearchVendors&&(
                      <button
                        onClick={()=>onSearchVendors({venueName:weddingVenue,venueLL:weddingVenueLatLng,type:item.type,maxPrice:recSpend||null})}
                        style={{marginTop:12,width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                        <span style={{display:'flex',alignItems:'center',gap:8}}>{IC.search(16,'var(--gold-light)')} Search {item.type} Vendors{recSpend?` · up to ${fmt(recSpend)}`:''}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* ADDITIONAL VENDORS section — leftover budget */}
        {budget>0&&(
          <div style={cardStyle}>
            <div style={{background:'linear-gradient(135deg,var(--gold),#b8932a)',padding:'14px 20px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{display:'flex',alignItems:'center'}}>{IC.star(20,'var(--white)')}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--white)',fontWeight:600,flex:1}}>Additional Vendors</div>
              <div style={{background:'rgba(255,255,255,0.2)',borderRadius:8,padding:'4px 12px'}}>
                <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.8)'}}>Flex budget</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',color:'var(--white)',fontWeight:600}}>{fmt(leftover>0?leftover:Math.round(budget*0.04))}</div>
              </div>
            </div>
            <div style={{padding:'18px 20px'}}>
              <p style={{fontSize:'0.86rem',color:'var(--mid)',lineHeight:1.65,marginBottom:16}}>
                Once your primary vendors are secured, consider these finishing touches. Your flex budget of <strong>{fmt(leftover>0?leftover:Math.round(budget*0.04))}</strong> can be allocated here.
              </p>
              {ADDITIONAL_VENDORS.map(({type,emoji,note})=>{
                const catVendors2 = allVendors.filter(v=>v.type===type);
                const prices2 = catVendors2.map(v=>v.fixed_rate||0).filter(n=>n>0);
                const catAvg2 = prices2.length>0?Math.round(prices2.reduce((a,b)=>a+b,0)/prices2.length):null;
                const catMin2 = prices2.length>0?Math.min(...prices2):null;
                const catMax2 = prices2.length>0?Math.max(...prices2):null;
                const recAdditional = Math.round(budget*(BUDGET_RATIOS[type]||0.04));
                return(
                  <div key={type} style={{borderRadius:12,border:'1px solid var(--parchment)',padding:'14px 16px',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center'}}><VendorIcon type={type} size={20} color='var(--forest)'/></div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)'}}>{type}</div>
                    </div>
                    <div style={{fontSize:'0.82rem',color:'var(--mid)',marginBottom:12,lineHeight:1.55}}>{note}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      <div style={{background:'var(--parchment)',borderRadius:8,padding:'11px 13px'}}>
                        <div style={{fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--mid)',marginBottom:6}}>Market average</div>
                        {catAvg2 ? (
                          <>
                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:600,color:'var(--forest)',marginBottom:2}}>{fmt(catAvg2)}</div>
                            <div style={{fontSize:'0.69rem',color:'var(--light)'}}>Range: {catMin2?fmt(catMin2):'–'} – {catMax2?fmt(catMax2):'–'}</div>
                          </>
                        ):<div style={{fontSize:'0.8rem',color:'var(--light)',fontStyle:'italic'}}>No vendors listed yet</div>}
                      </div>
                      <div style={{background:'rgba(58,74,63,0.05)',borderRadius:8,padding:'11px 13px',border:'1px solid rgba(58,74,63,0.08)'}}>
                        <div style={{fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--mid)',marginBottom:6}}>Suggested spend</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:600,color:'var(--rose)',marginBottom:2}}>{fmt(recAdditional)}</div>
                        <div style={{fontSize:'0.69rem',color:'var(--light)'}}>{Math.round((BUDGET_RATIOS[type]||0.04)*100)}% of your budget</div>
                      </div>
                    </div>
                    {onSearchVendors&&(
                      <button
                        onClick={()=>onSearchVendors({venueName:weddingVenue,venueLL:weddingVenueLatLng,type,maxPrice:recAdditional||null})}
                        style={{marginTop:10,width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'10px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.85rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                        <span style={{display:'flex',alignItems:'center',gap:8}}>{IC.search(16,'var(--gold-light)')} Search {type} Vendors{recAdditional?` · up to ${fmt(recAdditional)}`:''}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── SCENARIO BUILDER ──────────────────────────────────────────────────────────
// Completely uncontrolled venue input — Google Autocomplete owns the DOM value.
// We only call back with name+latLng when a place is selected.
// `scenarioId` in the key ensures a fresh mount per scenario only.

export default WeddingPlan;
export {{ WeddingPlan, WeddingPlanVenueInput }};