import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch, loadGoogleMaps, getBatchDistancesKm } from '../../api.js';
import { IC, VendorIcon } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES } from '../../constants.js';
import { fmt, formatDateDisplay, calcTotal, isVendorUnavailable } from '../../utils.js';

function ScenarioVenueInput({scenarioId, initialValue, onPinned, pinned}) {
  const inputRef = useRef();

  useEffect(()=>{
    // Set the initial text without React controlling the field
    if(inputRef.current && initialValue) {
      inputRef.current.value = initialValue;
    }
    loadGoogleMaps().then(google=>{
      if(!inputRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment','geocode'],
        componentRestrictions: {country:'za'},
      });
      ac.addListener('place_changed', ()=>{
        const place = ac.getPlace();
        if(place.geometry){
          const ll = {lat:place.geometry.location.lat(), lng:place.geometry.location.lng()};
          const name = place.formatted_address || place.name;
          if(inputRef.current) inputRef.current.value = name;
          onPinned(name, ll);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only — never re-run

  return (
    <div>
      <input
        ref={inputRef}
        style={{...inputStyle, borderColor: pinned ? 'var(--forest)' : undefined}}
        placeholder="e.g. Babylonstoren, Franschhoek"
      />
      {pinned
        ? <div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:3,fontWeight:500}}>Location pinned — distances will be calculated</div>
        : <div style={{fontSize:'0.68rem',color:'var(--light)',marginTop:3}}>Start typing and select from the dropdown</div>
      }
    </div>
  );
}

function ScenarioBuilder({user,vendors:passedVendors,onClose}) {
  const [scenarios,setScenarios]=useState([{id:1,venue:'',venueLatLng:null,venuePinned:false,date:'',budgets:{}}]);
  const [results,setResults]=useState(null);
  const [selectedVendors,setSelectedVendors]=useState({});
  const [step,setStep]=useState('build');
  const [allVendors,setAllVendors]=useState(passedVendors||[]);
  const [vendorsLoading,setVendorsLoading]=useState(false);
  const [vendorsError,setVendorsError]=useState('');

  // Fetch all vendors on mount regardless of whether parent passed any
  useEffect(()=>{
    if(allVendors.length===0){
      setVendorsLoading(true);
      supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
        .then(data=>{setAllVendors(data||[]);})
        .catch(e=>{setVendorsError('Could not load vendors: '+e.message);})
        .finally(()=>setVendorsLoading(false));
    }
  },[]);

  function addScenario(){
    const id=Date.now();
    setScenarios(s=>[...s,{id,venue:'',venueLatLng:null,venuePinned:false,date:'',budgets:{}}]);
  }
  function removeScenario(id){setScenarios(s=>s.filter(sc=>sc.id!==id));}
  function updateScenario(id,field,val){setScenarios(s=>s.map(sc=>sc.id===id?{...sc,[field]:val}:sc));}
  function updateScenarioVenue(id,name,ll){setScenarios(s=>s.map(sc=>sc.id===id?{...sc,venue:name,venueLatLng:ll,venuePinned:true}:sc));}
  function updateBudget(id,type,val){setScenarios(s=>s.map(sc=>sc.id===id?{...sc,budgets:{...sc.budgets,[type]:val}}:sc));}

  const [running,setRunning]=useState(false);

  async function runScenarios(){
    setRunning(true);
    const res=await Promise.all(scenarios.map(async sc=>{
      // Re-calculate distances for each vendor from this scenario's venue
      let scenVendors=allVendors;
      if(sc.venueLatLng){
        try{
          const kms=await getBatchDistancesKm(sc.venueLatLng,allVendors);
          scenVendors=allVendors.map((v,i)=>({...v,distance_km:kms[i]||0}));
        }catch{scenVendors=allVendors;}
      }

      const availVendors={};
      ALL_TYPES.forEach(type=>{
        const budget=parseFloat(sc.budgets[type])||Infinity;
        availVendors[type]=scenVendors.filter(v=>{
          if(v.type!==type)return false;
          const unavail=sc.date&&(v.unavail_dates||[]).some(d=>d.date===sc.date);
          if(unavail)return false;
          if(ON_REQUEST_TYPES.has(type))return true;
          return calcTotal(v)<=budget;
        });
      });

      // Avg costs per category (using scenario-specific distances)
      const avgCosts={};
      ALL_TYPES.forEach(type=>{
        const tots=availVendors[type].filter(v=>!ON_REQUEST_TYPES.has(v.type)).map(v=>calcTotal(v));
        avgCosts[type]=tots.length?Math.round(tots.reduce((a,b)=>a+b,0)/tots.length):null;
      });

      return{...sc,availVendors,avgCosts};
    }));
    setResults(res);
    setStep('results');
    setRunning(false);
  }

  function toggleSelectVendor(scenId,type,vendorId){
    setSelectedVendors(prev=>{
      const sc={...(prev[scenId]||{})};
      sc[type]=sc[type]===vendorId?null:vendorId;
      return{...prev,[scenId]:sc};
    });
  }

  function buildPrintHTML(scenList, mode) {
    // mode: 'single' (scenList=[one]) or 'comparison' (scenList=all)
    const date = new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'});
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>VowFinds ${mode==='comparison'?'Scenario Comparison':'Scenario Summary'}</title>
    <style>
      body{font-family:'Georgia',serif;color:#2c2c2c;max-width:900px;margin:0 auto;padding:32px 40px;font-size:13px;}
      h1{font-size:2rem;font-weight:300;color:#3a4a3f;margin-bottom:4px;}
      h2{font-size:1.3rem;font-weight:600;color:#3a4a3f;margin:0 0 4px;}
      h3{font-size:1rem;font-weight:600;color:#3a4a3f;margin:12px 0 6px;}
      .meta{color:#6b6b6b;font-size:0.82rem;margin-bottom:16px;}
      .header{border-bottom:2px solid #c9a96e;padding-bottom:12px;margin-bottom:24px;}
      .logo{font-size:1.6rem;color:#c9a96e;letter-spacing:0.08em;margin-bottom:4px;}
      .scenario{border:1px solid #f0e8dc;border-radius:8px;padding:16px 20px;margin-bottom:20px;break-inside:avoid;}
      .scenario-header{background:#3a4a3f;color:#e8d5a3;padding:10px 14px;border-radius:6px;margin-bottom:14px;}
      .vendor-row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f0e8dc;}
      .vendor-row:last-child{border-bottom:none;}
      .type-label{font-size:0.75rem;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.06em;}
      .vendor-name{font-weight:600;color:#3a4a3f;font-size:0.92rem;}
      .vendor-detail{font-size:0.78rem;color:#6b6b6b;margin-top:2px;}
      .price{font-weight:700;color:#c4826a;font-size:0.95rem;text-align:right;}
      .on-request{color:#c4826a;font-style:italic;font-size:0.85rem;}
      .total-row{display:flex;justify-content:space-between;padding:12px 0 0;margin-top:8px;border-top:2px solid #f0e8dc;font-size:1rem;}
      .total-label{font-weight:600;color:#3a4a3f;}
      .total-amount{font-weight:700;color:#c4826a;font-size:1.2rem;}
      .empty-row{color:#a8a8a8;font-style:italic;font-size:0.82rem;padding:4px 0;}
      .comparison-grid{display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;}
      .comparison-cell{border:1px solid #f0e8dc;border-radius:6px;padding:10px 12px;}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #f0e8dc;color:#a8a8a8;font-size:0.75rem;text-align:center;}
      @media print{body{padding:20px;} .no-print{display:none;}}
    </style></head><body>`;
    html+=`<div class="header"><div class="logo">VowFinds</div><h1>${mode==='comparison'?'Scenario Comparison':'Wedding Scenario Summary'}</h1><div class="meta">Generated ${date}</div></div>`;

    if(mode==='comparison'){
      // Side by side comparison header
      html+=`<div style="display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;margin-bottom:16px;">`;
      scenList.forEach((sc,i)=>{
        html+=`<div class="scenario-header" style="background:#3a4a3f;color:#e8d5a3;padding:10px 14px;border-radius:6px;"><strong>Scenario ${i+1}</strong><div style="font-size:0.82rem;opacity:0.8;margin-top:2px;">${sc.venue||'Unnamed Venue'}</div>${sc.date?`<div style="font-size:0.78rem;opacity:0.7;">${formatDateDisplay(sc.date)}</div>`:''}</div>`;
      });
      html+=`</div>`;
      ALL_TYPES.forEach(type=>{
        html+=`<h3>${TYPE_EMOJI[type]} ${type}</h3><div style="display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;margin-bottom:12px;">`;
        scenList.forEach(sc=>{
          const sel=selectedVendors[sc.id]||{};
          const vid=sel[type];
          const vendor=vid?sc.availVendors[type]?.find(v=>v.id===vid):null;
          const avail=sc.availVendors[type]||[];
          html+=`<div class="comparison-cell">`;
          if(vendor){
            html+=`<div class="vendor-name">${vendor.name}</div><div class="vendor-detail">📍 ${vendor.location}</div>`;
            html+=`<div style="margin-top:4px;">${ON_REQUEST_TYPES.has(type)?'<span class="on-request">On Request</span>':`<strong style="color:#c4826a;">${fmt(calcTotal(vendor))}</strong>`}</div>`;
          }else{
            html+=`<span class="empty-row">${avail.length} available — none selected</span>`;
          }
          html+=`</div>`;
        });
        html+=`</div>`;
      });
      // Totals row
      html+=`<h3>Estimated Totals (excl. On Request)</h3><div style="display:grid;grid-template-columns:repeat(${scenList.length},1fr);gap:12px;">`;
      scenList.forEach(sc=>{
        const sel=selectedVendors[sc.id]||{};
        const tot=ALL_TYPES.reduce((sum,type)=>{const vid=sel[type];const v=vid?sc.availVendors[type]?.find(x=>x.id===vid):null;return sum+(v&&!ON_REQUEST_TYPES.has(type)?calcTotal(v):0);},0);
        html+=`<div class="comparison-cell"><strong style="font-size:1.1rem;color:#c4826a;">${fmt(tot)}</strong></div>`;
      });
      html+=`</div>`;
    } else {
      scenList.forEach((sc,idx)=>{
        const sel=selectedVendors[sc.id]||{};
        let fixedTotal=0;
        html+=`<div class="scenario"><div class="scenario-header"><h2 style="color:#e8d5a3;margin:0;">Scenario ${idx+1}: ${sc.venue||'Unnamed Venue'}</h2>${sc.date?`<div style="opacity:0.8;font-size:0.82rem;margin-top:2px;">📅 ${formatDateDisplay(sc.date)}</div>`:''}</div>`;
        ALL_TYPES.forEach(type=>{
          const vid=sel[type];
          const vendor=vid?sc.availVendors[type]?.find(v=>v.id===vid):null;
          html+=`<div class="vendor-row"><div><div class="type-label">${TYPE_EMOJI[type]} ${type}</div>`;
          if(vendor){
            html+=`<div class="vendor-name">${vendor.name}</div><div class="vendor-detail">📍 ${vendor.location}${vendor.instagram?' · '+vendor.instagram:''}</div>`;
            if(!ON_REQUEST_TYPES.has(type)){fixedTotal+=calcTotal(vendor);}
          }else{html+=`<div class="empty-row">Not selected</div>`;}
          html+=`</div><div class="price">${vendor?(ON_REQUEST_TYPES.has(type)?'<span class="on-request">On Request</span>':fmt(calcTotal(vendor))):'-'}</div></div>`;
        });
        if(fixedTotal>0){html+=`<div class="total-row"><span class="total-label">Estimated Total (excl. On Request)</span><span class="total-amount">${fmt(fixedTotal)}</span></div>`;}
        html+=`</div>`;
      });
    }
    html+=`<div class="footer">VowFinds · ${date} · On Request vendors will provide personalised quotes after reviewing your requirements.</div>`;
    html+=`</body></html>`;
    return html;
  }

  function exportPDF(scenarioResult,scenIdx){
    const html=buildPrintHTML([scenarioResult],'single');
    const win=window.open('','_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(()=>{win.print();},500);
  }

  function exportComparison(){
    if(!results||results.length<1)return;
    const html=buildPrintHTML(results,'comparison');
    const win=window.open('','_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(()=>{win.print();},500);
  }

  const ss={padding:'0 24px 12px',maxWidth:960,margin:'0 auto'};

  if(step==='summary'||step==='results') return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setStep(step==='summary'?'results':'build')} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600}}>
          {step==='results'?'Scenario Results':'Scenario Summary'}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          {step==='summary'&&results&&results.length>1&&<button onClick={exportComparison} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'6px 14px',cursor:'pointer',fontSize:'0.78rem',fontWeight:500,display:'flex',alignItems:'center',gap:5}}>{IC.map(14,'var(--forest)')}Compare</button>}
          <button onClick={onClose} style={{background:'none',border:'1px solid var(--parchment)',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.78rem',color:'var(--mid)'}}>Close</button>
        </div>
      </div>
      <div style={{maxWidth:960,margin:'0 auto',padding:'24px 24px 60px'}}>
        {(results||[]).map((sc,idx)=>(
          <div key={sc.id} style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:24,overflow:'hidden'}}>
            <div style={{background:'var(--forest)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--gold-light)',fontWeight:600}}>Scenario {idx+1}: {sc.venue||'Unnamed Venue'}</div>
                {sc.date&&<div style={{fontSize:'0.78rem',color:'rgba(232,213,163,0.7)',marginTop:2,display:'flex',alignItems:'center',gap:5}}>{IC.calendar(12,'rgba(232,213,163,0.7)')}{formatDateDisplay(sc.date)}</div>}
                {sc.venuePinned
                  ? <div style={{fontSize:'0.72rem',color:'rgba(201,169,110,0.8)',marginTop:2}}>Distances calculated from pinned venue</div>
                  : <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginTop:2}}>No venue pinned — distances may not be accurate</div>
                }
              </div>
              {step==='summary'&&<button onClick={()=>exportPDF(sc,idx)} style={{background:'var(--gold)',color:'var(--forest)',border:'none',borderRadius:8,padding:'8px 16px',fontSize:'0.8rem',fontWeight:600,cursor:'pointer'}}>⬇ Export Summary</button>}
            </div>
            <div style={{padding:'16px 20px'}}>
              {ALL_TYPES.map(type=>{
                const vv=sc.availVendors[type]||[];
                const avg=sc.avgCosts[type];
                const selVid=selectedVendors[sc.id]?.[type];
                const selVendor=vv.find(v=>v.id===selVid);
                return(
                  <div key={type} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--parchment)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{display:'flex'}}><VendorIcon type={type} size={16} color='var(--forest)'/></span>
                        <span style={{fontWeight:600,color:'var(--forest)',fontSize:'0.92rem'}}>{type}</span>
                        <span style={{fontSize:'0.72rem',background:'var(--parchment)',color:'var(--mid)',padding:'2px 8px',borderRadius:999}}>{vv.length} available</span>
                      </div>
                      {avg&&!ON_REQUEST_TYPES.has(type)&&<span style={{fontSize:'0.78rem',color:'var(--mid)'}}>Avg: <strong style={{color:'var(--forest)'}}>{fmt(avg)}</strong></span>}
                      {ON_REQUEST_TYPES.has(type)&&<span style={{fontSize:'0.75rem',color:'var(--rose)',fontStyle:'italic'}}>On Request</span>}
                    </div>
                    {vv.length===0?(
                      <div style={{fontSize:'0.8rem',color:'var(--light)',fontStyle:'italic'}}>No available vendors for this scenario.</div>
                    ):(
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {vv.map(v=>{
                          const isSel=selVid===v.id;
                          return(
                            <div key={v.id} onClick={()=>toggleSelectVendor(sc.id,type,v.id)}
                              style={{padding:'8px 12px',borderRadius:9,cursor:'pointer',border:`2px solid ${isSel?'var(--forest)':'var(--parchment)'}`,background:isSel?'rgba(58,74,63,0.07)':'var(--cream)',transition:'all 0.15s',maxWidth:200}}>
                              <div style={{fontSize:'0.82rem',fontWeight:isSel?600:400,color:'var(--forest)'}}>{v.name}</div>
                              <div style={{fontSize:'0.72rem',color:'var(--mid)',marginTop:2}}>
                                {ON_REQUEST_TYPES.has(type)?'On Request':fmt(calcTotal(v))}
                              </div>
                              {isSel&&<div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:3,display:'flex',alignItems:'center',gap:3}}>{IC.check(10,'var(--forest)')}Selected</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {step==='summary'&&selVendor&&(
                      <div style={{marginTop:10,padding:'10px 12px',background:'rgba(58,74,63,0.06)',borderRadius:8,fontSize:'0.8rem',color:'var(--mid)'}}>
                        <strong style={{color:'var(--forest)'}}>{selVendor.name}</strong> · {selVendor.location}
                        {selVendor.instagram&&<> · {selVendor.instagram}</>}
                        {!ON_REQUEST_TYPES.has(type)&&<> · <strong style={{color:'var(--rose)'}}>{fmt(calcTotal(selVendor))}</strong></>}
                      </div>
                    )}
                  </div>
                );
              })}
              {step==='summary'&&(()=>{
                const fixedTotal=ALL_TYPES.reduce((sum,type)=>{
                  const vid=selectedVendors[sc.id]?.[type];
                  const v=vid?sc.availVendors[type]?.find(x=>x.id===vid):null;
                  return sum+(v&&!ON_REQUEST_TYPES.has(type)?calcTotal(v):0);
                },0);
                return fixedTotal>0?(
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:8,fontFamily:"'Cormorant Garamond',serif"}}>
                    <span style={{fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>Estimated Total (excl. On Request)</span>
                    <span style={{fontSize:'1.5rem',color:'var(--rose)',fontWeight:700}}>{fmt(fixedTotal)}</span>
                  </div>
                ):null;
              })()}
            </div>
          </div>
        ))}
        {step==='results'&&<button onClick={()=>setStep('summary')} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'13px',fontSize:'0.9rem',fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',sans-serif",letterSpacing:'0.04em'}}>View Summary with Selected Vendors →</button>}
      </div>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={onClose} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.map(16,'var(--forest)')}Scenario Builder</div>
      </div>
      <div style={{maxWidth:900,margin:'0 auto',padding:'24px 24px 60px'}}>
        <p style={{color:'var(--mid)',fontSize:'0.86rem',marginBottom:24}}>Compare different venues, dates and budgets to find the best combination of vendors for your wedding.</p>

        {scenarios.map((sc,idx)=>(
          <div key={sc.id} style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:20,overflow:'hidden'}}>
            <div style={{background:'var(--forest)',padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--gold-light)',fontWeight:600}}>Scenario {idx+1}</div>
              {scenarios.length>1&&<button onClick={()=>removeScenario(sc.id)} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:6,padding:'4px 10px',color:'rgba(255,255,255,0.7)',cursor:'pointer',fontSize:'0.75rem'}}>Remove</button>}
            </div>
            <div style={{padding:'18px 20px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                <div>
                  <label style={labelStyle}>Venue</label>
                  <ScenarioVenueInput
                    key={sc.id}
                    scenarioId={sc.id}
                    initialValue={sc.venue}
                    pinned={sc.venuePinned}
                    onPinned={(name,ll)=>updateScenarioVenue(sc.id,name,ll)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Wedding Date</label>
                  <input type="date" style={inputStyle} value={sc.date} onChange={e=>updateScenario(sc.id,'date',e.target.value)}/>
                </div>
              </div>
              <div>
                <label style={{...labelStyle,marginBottom:10}}>Max Budget per Category (leave blank for no limit)</label>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {ALL_TYPES.filter(t=>!ON_REQUEST_TYPES.has(t)).map(type=>(
                    <div key={type} style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{display:'flex',flexShrink:0}}><VendorIcon type={type} size={16} color='var(--forest)'/></span>
                      <input style={{...inputStyle,fontSize:'0.8rem',padding:'6px 10px'}} type="number" value={sc.budgets[type]||''} onChange={e=>updateBudget(sc.id,type,e.target.value)} placeholder={`${type} budget`}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {scenarios.some(sc=>!sc.venuePinned&&sc.venue)&&(
          <div style={{background:'rgba(201,169,110,0.1)',border:'1px solid rgba(201,169,110,0.3)',borderRadius:10,padding:'10px 16px',marginBottom:12,fontSize:'0.8rem',color:'var(--mid)',display:'flex',alignItems:'center',gap:8}}>
            Some venues haven't been pinned — select from the dropdown for accurate distance pricing.
          </div>
        )}
        {vendorsError&&<div style={{color:'var(--rose)',fontSize:'0.82rem',marginBottom:12,padding:'10px 14px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{vendorsError}</div>}
        <div style={{display:'flex',gap:12,marginTop:4}}>
          <button onClick={addScenario} style={{flex:1,background:'var(--parchment)',color:'var(--forest)',border:'1.5px dashed var(--blush)',borderRadius:10,padding:'12px',fontSize:'0.88rem',cursor:'pointer',fontWeight:500}}>+ Add Another Scenario</button>
          <button onClick={runScenarios} disabled={vendorsLoading||running} style={{flex:2,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontSize:'0.9rem',fontWeight:500,cursor:(vendorsLoading||running)?'not-allowed':'pointer',letterSpacing:'0.04em'}}>
            {running?'Calculating distances…':vendorsLoading?'Loading vendors…':'Run Scenarios →'}
          </button>
        </div>
        {vendorsLoading&&<p style={{textAlign:'center',fontSize:'0.78rem',color:'var(--light)',marginTop:10}}>Loading all vendors from database…</p>}
        {!vendorsLoading&&allVendors.length>0&&<p style={{textAlign:'center',fontSize:'0.78rem',color:'var(--forest)',marginTop:10}}>{allVendors.length} vendors loaded</p>}
      </div>
    </div>
  );
}


// ── CUSTOMER BROWSE VIEW (logged-in customer browsing vendors) ────────────────

export default ScenarioBuilder;
export {{ ScenarioBuilder }};