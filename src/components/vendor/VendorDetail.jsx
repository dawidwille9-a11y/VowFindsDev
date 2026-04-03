import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { supaFetch } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { fmt, formatDateDisplay, isOnRequest, isVendorUnavailable, calcTotal, calcPackageTotal } from '../../utils.js';
import { ON_REQUEST_TYPES } from '../../constants.js';
import Calendar from '../calendar/Calendar.jsx';
import DetailMap from '../maps/DetailMap.jsx';
import FavStar from './FavStar.jsx';

function VendorDetail({vendor,dateFrom,dateTo,venueLabel,venueLatLng,onBack,onRequestQuote}) {
  const [calYear,setCalYear]=useState(()=>dateFrom?parseInt(dateFrom.split('-')[0]):new Date().getFullYear());
  const [calMonth,setCalMonth]=useState(()=>dateFrom?parseInt(dateFrom.split('-')[1])-1:new Date().getMonth());
  const [enquirySent,setEnquirySent]=useState(false);
  const [enquiryForm,setEnquiryForm]=useState({name:'',email:'',message:''});
  const [enquirySending,setEnquirySending]=useState(false);
  const [enquiryError,setEnquiryError]=useState('');
  const unavailSet=new Set((vendor.unavail_dates||[]).map(d=>d.date));
  const isUnavail=isVendorUnavailable(vendor,dateFrom,dateTo);
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0),overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0,total=(vendor.fixed_rate||0)+travel+overnight;
  const galleryImgs=vendor.images||[];
  const [lightbox,setLightbox]=useState(null);
  return (
    <div style={{background:'var(--cream)',minHeight:'100vh'}}>
      {/* Back button moved into hero overlay below */}
      {isUnavail&&<div style={{display:'flex',alignItems:'center',gap:12,background:'#f5e8e4',border:'1.5px solid #e0b8a8',borderRadius:12,padding:'14px 20px',margin:'20px 32px 0'}}><span style={{display:'flex'}}>{IC.calendar(22,'#c4826a')}</span><div><div style={{fontSize:'0.88rem',color:'var(--deep-rose)',fontWeight:500}}>Unavailable on your wedding date</div><div style={{fontSize:'0.78rem',color:'var(--rose)'}}>This vendor is already booked during your selected dates.</div></div></div>}
      <div className="vf-vendor-detail-hero" style={{position:'relative',height:300,overflow:'hidden',marginTop:0,background:(vendor.display_picture||galleryImgs[0]?.url)?`url(${vendor.display_picture||galleryImgs[0]?.url}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}ff,${vendor.color||'#c8a87a'}88)`}}>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(22,32,24,0.88) 0%,rgba(22,32,24,0.08) 60%)'}}/>
        {/* Back button inside hero */}
        <button onClick={onBack} style={{position:'absolute',top:16,left:20,zIndex:10,display:'inline-flex',alignItems:'center',gap:6,background:'rgba(22,32,24,0.5)',backdropFilter:'blur(4px)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:20,padding:'6px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',color:'rgba(250,246,241,0.9)',cursor:'pointer'}}>{IC.back(14,'rgba(250,246,241,0.9)')} Back</button>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'28px 32px'}}>
          <div style={{display:'inline-block',background:'rgba(201,169,110,0.18)',border:'1px solid var(--gold)',color:'var(--gold-light)',fontSize:'0.68rem',letterSpacing:'0.14em',textTransform:'uppercase',padding:'4px 12px',borderRadius:999,marginBottom:10}}>{vendor.type}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(1.8rem,4vw,2.6rem)',fontWeight:400,color:'var(--cream)',lineHeight:1.1,marginBottom:6}}>{vendor.name}</div>
          <div style={{fontSize:'0.82rem',color:'rgba(250,246,241,0.65)',display:'flex',alignItems:'center',gap:5}}>{IC.pin(13,'rgba(250,246,241,0.65)')}{vendor.location}{venueLabel&&vendor.distance_km?` · ${vendor.distance_km} km from ${venueLabel}`:''}</div>
        </div>
      </div>
      <div className="vf-vendor-detail-grid" style={{maxWidth:1040,margin:'0 auto',padding:'32px 32px 60px',display:'grid',gridTemplateColumns:'1fr 340px',gap:36}}>
        <div>
          <section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>About this vendor</h3><p style={{fontSize:'0.92rem',color:'var(--mid)',lineHeight:1.85}}>{vendor.description} {vendor.extra_info}</p></section>
          {galleryImgs.length>0&&<section style={{marginBottom:28}}>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Gallery</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {galleryImgs.map((img,i)=>(
                  <div key={i} onClick={()=>setLightbox(i)}
                    style={{borderRadius:10,height:90,cursor:'pointer',position:'relative',overflow:'hidden',
                      background:img.url?`url(${img.url}) center/cover`:`linear-gradient(${140+i*30}deg,${vendor.color||'#c8a87a'}dd,${vendor.color||'#c8a87a'}44)`,
                      transition:'transform 0.15s',border:'2px solid transparent'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.borderColor='var(--gold)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.borderColor='transparent';}}>
                    <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0)',display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,0,0,0.15)';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,0,0,0)';}}>
                      <span style={{fontSize:'1rem',opacity:0,transition:'opacity 0.15s'}} className="gallery-zoom">🔍</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Lightbox */}
              {lightbox!==null&&(
                <div onClick={()=>setLightbox(null)}
                  style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',cursor:'zoom-out'}}
                  onKeyDown={e=>{if(e.key==='Escape')setLightbox(null);if(e.key==='ArrowRight')setLightbox(l=>Math.min(l+1,galleryImgs.length-1));if(e.key==='ArrowLeft')setLightbox(l=>Math.max(l-1,0));}}>
                  {/* Close button */}
                  <button onClick={()=>setLightbox(null)}
                    style={{position:'absolute',top:20,right:24,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:40,height:40,color:'white',fontSize:'1.4rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2001}}>×</button>
                  {/* Prev */}
                  {lightbox>0&&<button onClick={e=>{e.stopPropagation();setLightbox(l=>l-1);}}
                    style={{position:'absolute',left:20,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:44,height:44,color:'white',fontSize:'1.4rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>}
                  {/* Next */}
                  {lightbox<galleryImgs.length-1&&<button onClick={e=>{e.stopPropagation();setLightbox(l=>l+1);}}
                    style={{position:'absolute',right:20,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:44,height:44,color:'white',fontSize:'1.4rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>}
                  {/* Image */}
                  <img src={galleryImgs[lightbox]?.url} alt="" onClick={e=>e.stopPropagation()}
                    style={{maxWidth:'90vw',maxHeight:'88vh',objectFit:'contain',borderRadius:8,boxShadow:'0 8px 40px rgba(0,0,0,0.5)'}}/>
                  {/* Counter */}
                  <div style={{position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.7)',fontSize:'0.82rem'}}>
                    {lightbox+1} / {galleryImgs.length}
                  </div>
                </div>
              )}
            </section>}

          {/* ── Packages section ── */}
          {vendor.packages&&vendor.packages.length>0&&!isOnRequest(vendor)&&(
            <section style={{marginBottom:28}}>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:6,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>
                Pricing Packages
              </h3>
              <p style={{fontSize:'0.82rem',color:'var(--light)',marginBottom:16,lineHeight:1.6}}>
                {vendor.packages.length} package{vendor.packages.length!==1?'s':''} available
                {vendor.packages.length>1?' — prices shown include travel costs from your venue':''}
              </p>
              <div style={{display:'grid',gap:14}}>
                {[...vendor.packages]
                  .sort((a,b)=>calcPackageTotal(a,vendor.distance_km||0)-calcPackageTotal(b,vendor.distance_km||0))
                  .map((pkg,i)=>{
                    const pkgTravel=(vendor.distance_km||0)*(pkg.per_km_rate||0);
                    const pkgOvernight=(vendor.distance_km||0)>(pkg.overnight_threshold_km||80)?(pkg.overnight_fee||0):0;
                    const pkgTotal=(pkg.fixed_rate||0)+pkgTravel+pkgOvernight;
                    const isLowest=i===0&&vendor.packages.length>1;
                    return(
                      <div key={pkg.id||i} style={{background:'var(--white)',borderRadius:14,padding:'20px 22px',boxShadow:'var(--card-shadow)',border:'2px solid var(--parchment)'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:pkg.description?12:8}}>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:600,color:'var(--forest)'}}>{pkg.name}</span>
                              {isLowest&&<span style={{fontSize:'0.62rem',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',background:'var(--forest)',color:'var(--gold-light)',borderRadius:999,padding:'2px 8px'}}>Best Value</span>}
                            </div>
                            {pkg.description&&<p style={{fontSize:'0.85rem',color:'var(--mid)',lineHeight:1.65,margin:0}}>{pkg.description}</p>}
                          </div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,color:'var(--rose)',lineHeight:1}}>{fmt(pkgTotal)}</div>
                            <div style={{fontSize:'0.68rem',color:'var(--light)',marginTop:2}}>total estimate</div>
                          </div>
                        </div>
                        <div style={{borderTop:'1px solid var(--parchment)',paddingTop:10,display:'flex',flexWrap:'wrap',gap:8,fontSize:'0.75rem'}}>
                          <span style={{color:'var(--mid)'}}>Base: <strong style={{color:'var(--charcoal)'}}>{fmt(pkg.fixed_rate)}</strong></span>
                          {pkgTravel>0&&<span style={{color:'var(--mid)'}}>Travel: <strong style={{color:'var(--charcoal)'}}>{fmt(pkgTravel)}</strong></span>}
                          {pkgOvernight>0&&<span style={{color:'var(--mid)'}}>Overnight: <strong style={{color:'var(--charcoal)'}}>{fmt(pkgOvernight)}</strong></span>}
                          <span style={{color:'var(--light)'}}>R{pkg.per_km_rate||0}/km · overnight &gt;{pkg.overnight_threshold_km||80}km</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          <section style={{marginBottom:28}}>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>{venueLatLng&&vendor.lat?'Route from your venue':'Vendor location'}</h3>
            {venueLatLng&&vendor.distance_km&&<div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}}>
              {[['distance','Distance',`${vendor.distance_km} km`],['cost','Travel cost',fmt(travel)],...(overnight>0?[['night','Overnight fee',fmt(overnight)]]:[])]
                .map(([icon,label,val],i)=><div key={i} style={{background:'var(--white)',borderRadius:10,padding:'10px 16px',boxShadow:'var(--card-shadow)',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:'1.2rem'}}>{icon}</span><div><div style={{fontSize:'0.7rem',color:'var(--light)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{label}</div><div style={{fontSize:'0.92rem',fontWeight:600,color:'var(--rose)'}}>{val}</div></div></div>)}
            </div>}
            <DetailMap vendor={vendor} venueLatLng={venueLatLng}/>
          </section>
          <section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Availability Calendar</h3><Calendar year={calYear} month={calMonth} unavailDates={unavailSet} weddingDate={dateFrom} onPrev={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}} onNext={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}}/></section>
          {vendor.instagram&&<section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Follow on Instagram</h3><a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:12,background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:12,padding:'14px 20px',textDecoration:'none'}}><div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg></div><div><div style={{fontSize:'0.92rem',fontWeight:500,color:'var(--charcoal)'}}>{vendor.instagram}</div><div style={{fontSize:'0.72rem',color:'var(--light)'}}>View on Instagram</div></div></a></section>}
          {isOnRequest(vendor)&&(
            <section>
              <div style={{display:'flex',alignItems:'flex-start',gap:12,background:'rgba(201,169,110,0.07)',border:'1px solid rgba(201,169,110,0.25)',borderRadius:12,padding:'14px 18px'}}>
                <span style={{fontSize:'1.2rem',flexShrink:0}}>ℹ️</span>
                <div>
                  <div style={{fontWeight:600,color:'var(--forest)',fontSize:'0.86rem',marginBottom:4}}>Pricing Disclaimer</div>
                  <div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.65}}>
                    The costs displayed above reflect <strong>travel and overnight fees only</strong>, calculated based on the distance from this vendor's home base to your venue. Full product and service pricing for {vendor.type} is <strong>on request</strong> — after you submit your quote request, the vendor will review your requirements and respond with a personalised quote.
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
        <div>
          <div className="vf-vendor-detail-sticky" style={{background:'var(--white)',borderRadius:16,padding:24,boxShadow:'var(--card-shadow)',position:'sticky',top:80}}>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',color:'var(--forest)',marginBottom:4}}>
              {isOnRequest(vendor)?'Request a Quote':'Pricing Estimate'}
            </h3>
            <button onClick={()=>onRequestQuote&&onRequestQuote(vendor)} style={{width:'100%',marginBottom:14,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:600,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>{IC.quote(16,'#fff')}Request a Quote</button>
            {isOnRequest(vendor)?(
              <>
                <div style={{background:'rgba(196,130,106,0.06)',borderRadius:10,padding:'12px 14px',marginBottom:14,border:'1px solid rgba(196,130,106,0.15)',textAlign:'center'}}>
                  <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:4}}>Full Pricing</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--rose)',fontStyle:'italic',marginBottom:4}}>On Request</div>
                  <div style={{fontSize:'0.74rem',color:'var(--mid)'}}>Submit the questionnaire and the vendor will respond with a personalised quote.</div>
                </div>
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:10}}>{venueLabel?`Venue: ${venueLabel}`:'Add a venue to see travel costs'}</p>
                {[...(travel>0?[[`Travel (${vendor.distance_km||0} km × R${vendor.per_km_rate}/km)`,fmt(travel)]]:[[`Travel rate`,`R${vendor.per_km_rate||0}/km`]]), ...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])].map(([l,v],i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--parchment)',fontSize:'0.84rem'}}>
                    <span style={{color:'var(--mid)'}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
                  </div>
                ))}
                {overnight>0&&<div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:10,background:'rgba(196,130,106,0.08)',color:'var(--rose)',fontSize:'0.74rem',padding:'5px 11px',borderRadius:8,border:'1px solid rgba(196,130,106,0.22)'}}>{IC.calendar(13,'var(--rose)')}Overnight stay may be required</div>}
              </>
            ):vendor.packages&&vendor.packages.length>0?(
              /* ── Multi-package sidebar ── */
              <>
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:12}}>
                  {venueLabel?`From ${venueLabel}`:'Prices include travel from your venue'}
                </p>
                {[...vendor.packages]
                  .sort((a,b)=>calcPackageTotal(a,vendor.distance_km||0)-calcPackageTotal(b,vendor.distance_km||0))
                  .map((pkg,i)=>{
                    const pkgT=calcPackageTotal(pkg,vendor.distance_km||0);
                    return(
                      <div key={pkg.id||i} style={{borderRadius:10,padding:'10px 12px',marginBottom:8,
                        background:'var(--cream)',
                        border:'1.5px solid var(--parchment)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:pkg.description?4:0}}>
                          <span style={{fontSize:'0.84rem',fontWeight:600,color:'var(--forest)'}}>{pkg.name}</span>
                          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:600,color:'var(--rose)'}}>{fmt(pkgT)}</span>
                        </div>
                        {pkg.description&&<p style={{fontSize:'0.75rem',color:'var(--mid)',margin:0,lineHeight:1.5}}>{pkg.description}</p>}
                      </div>
                    );
                  })}
                <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:8,paddingTop:8,borderTop:'1px solid var(--parchment)'}}>
                  Prices include base rate + travel (R{vendor.packages[0]?.per_km_rate||0}/km)
                  {venueLabel?` from ${venueLabel}`:''}. See all packages above.
                </div>
              </>
            ):(
              /* ── Single price sidebar ── */
              <>
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:18}}>{venueLabel?`Venue: ${venueLabel}`:'Based on your venue location'}</p>
                {[['Base rate',fmt(vendor.fixed_rate)],[`Travel (${vendor.distance_km||0} km × R${vendor.per_km_rate}/km)`,fmt(travel)],...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])].map(([l,v],i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--parchment)',fontSize:'0.84rem'}}><span style={{color:'var(--mid)'}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,paddingTop:14,borderTop:'2px solid var(--parchment)'}}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>Total estimate</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',color:'var(--rose)',fontWeight:600}}>{fmt(total)}</span></div>
                {overnight>0&&<div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:12,background:'rgba(196,130,106,0.08)',color:'var(--rose)',fontSize:'0.74rem',padding:'5px 11px',borderRadius:8,border:'1px solid rgba(196,130,106,0.22)'}}>{IC.calendar(13,'var(--rose)')}Overnight stay required</div>}
              </>
            )}
            {!enquirySent?(
              <>
                <div style={{borderTop:'1px solid var(--parchment)',marginTop:16,paddingTop:16}}>
                  <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>Send an Enquiry</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <input value={enquiryForm.name} onChange={e=>setEnquiryForm(f=>({...f,name:e.target.value}))} placeholder="Your name" style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
                    <input value={enquiryForm.email} onChange={e=>setEnquiryForm(f=>({...f,email:e.target.value}))} placeholder="Your email" type="email" style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
                    <textarea value={enquiryForm.message} onChange={e=>setEnquiryForm(f=>({...f,message:e.target.value}))} placeholder="Tell the vendor about your wedding…" rows={3} style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%',resize:'vertical'}}/>
                  </div>
                  {enquiryError&&<div style={{fontSize:'0.76rem',color:'var(--rose)',marginTop:6}}>{enquiryError}</div>}
                </div>
                <button
                  disabled={isUnavail||enquirySending}
                  onClick={async()=>{
                    if(!enquiryForm.name||!enquiryForm.email){setEnquiryError('Please enter your name and email.');return;}
                    setEnquirySending(true);setEnquiryError('');
                    try{
                      await supaFetch('enquiries',{method:'POST',body:JSON.stringify({
                        vendor_id:vendor.id,
                        customer_name:enquiryForm.name,
                        customer_email:enquiryForm.email,
                        message:enquiryForm.message,
                        wedding_date:dateFrom||null,
                        venue:venueLabel||null,
                      }),prefer:'return=minimal'});
                      setEnquirySent(true);
                    }catch(e){setEnquiryError('Could not send enquiry. Please try again.');}
                    setEnquirySending(false);
                  }}
                  style={{width:'100%',marginTop:12,background:isUnavail?'var(--light)':'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:12,fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:(isUnavail||enquirySending)?'not-allowed':'pointer',letterSpacing:'0.04em'}}>
                  {enquirySending?'Sending…':isUnavail?'Unavailable for your dates':'Send Enquiry'}
                </button>
              </>
            ):(
              <div style={{textAlign:'center',padding:'16px 12px',background:'rgba(58,74,63,0.07)',borderRadius:10,marginTop:16}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:6}}>{IC.check(24,'var(--forest)')}</div>
                <div style={{fontSize:'0.88rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>Enquiry sent!</div>
                <div style={{fontSize:'0.78rem',color:'var(--mid)'}}>The vendor will be in touch at <strong>{enquiryForm.email}</strong></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VENDOR LANE ───────────────────────────────────────────────────────────────
const LANE_PAGE_SIZE = 12; // show 12 cards initially, load more on demand

export default VendorDetail;
export { VendorDetail };