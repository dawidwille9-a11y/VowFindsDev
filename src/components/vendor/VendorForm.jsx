import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch, storageUrl, loadGoogleMaps, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUB_KEY } from '../../api.js';
import { IC } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES, TYPE_COLOR } from '../../constants.jsx';
import { fmt } from '../../utils.js';

function VendorForm({initialData=null, vendorId=null, userId=null, onSaved, onCancel}) {
  const [form,setForm]=useState({name:'',type:'',location:'',description:'',extra_info:'',instagram:'',fixed_rate:'',per_km_rate:'',overnight_fee:'',overnight_threshold_km:'80',...(initialData||{})});
  const [latLng,setLatLng]=useState(initialData?.lat?{lat:initialData.lat,lng:initialData.lng}:null);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [images,setImages]=useState([]);
  const [uploading,setUploading]=useState(false);
  const [unavailDates,setUnavailDates]=useState(new Set(initialData?._unavailDates||[]));
  // Packages state
  const [packages,setPackages]=useState(initialData?.packages||[]);
  const EMPTY_PKG={name:'',description:'',fixed_rate:'',per_km_rate:'',overnight_fee:'',overnight_threshold_km:'80'};
  const [newPkg,setNewPkg]=useState({...EMPTY_PKG});
  const [editingPkg,setEditingPkg]=useState(null); // index being edited
  // Track vendor ID as internal state so images work immediately after first save
  const [currentVendorId,setCurrentVendorId]=useState(vendorId);
  const fileRef=useRef(),locRef=useRef();

  useEffect(()=>{
    if(initialData?.images)setImages(initialData.images.map(i=>({url:i.url,path:''})));
    // Load packages for existing vendor
    if(vendorId){
      supaFetch(`vendor_packages?vendor_id=eq.${vendorId}&order=created_at.asc`)
        .then(data=>setPackages(data||[])).catch(()=>{});
    }
    loadGoogleMaps().then(google=>{
      if(!locRef.current)return;
      const ac=new google.maps.places.Autocomplete(locRef.current,{types:['geocode','establishment'],componentRestrictions:{country:'za'}});
      ac.addListener('place_changed',()=>{const place=ac.getPlace();if(place.geometry){setLatLng({lat:place.geometry.location.lat(),lng:place.geometry.location.lng()});setForm(f=>({...f,location:place.formatted_address||place.name}));}});
    });
  },[]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const setPkg=(k,v)=>setNewPkg(p=>({...p,[k]:v}));
  const setEditPkg=(k,v)=>setEditingPkg(p=>({...p,[k]:v}));

  async function addPackage(){
    if(!newPkg.name||!newPkg.fixed_rate){setSaveError('Package needs a name and base rate.');return;}
    if(!currentVendorId){setSaveError('Save the vendor profile first before adding packages.');return;}
    setSaveError('');
    const payload={vendor_id:currentVendorId,name:newPkg.name,description:newPkg.description,
      fixed_rate:parseInt(newPkg.fixed_rate)||0,per_km_rate:parseInt(newPkg.per_km_rate)||0,
      overnight_fee:parseInt(newPkg.overnight_fee)||0,overnight_threshold_km:parseInt(newPkg.overnight_threshold_km)||80};
    const res=await supaFetch('vendor_packages',{method:'POST',body:JSON.stringify(payload),prefer:'return=representation'});
    const created=Array.isArray(res)?res[0]:res;
    setPackages(prev=>[...prev,created||payload]);
    setNewPkg({...EMPTY_PKG});
  }

  async function saveEditPackage(pkg){
    const payload={name:pkg.name,description:pkg.description,
      fixed_rate:parseInt(pkg.fixed_rate)||0,per_km_rate:parseInt(pkg.per_km_rate)||0,
      overnight_fee:parseInt(pkg.overnight_fee)||0,overnight_threshold_km:parseInt(pkg.overnight_threshold_km)||80};
    await supaFetch(`vendor_packages?id=eq.${pkg.id}`,{method:'PATCH',body:JSON.stringify(payload),prefer:'return=minimal'});
    setPackages(prev=>prev.map(p=>p.id===pkg.id?{...p,...payload}:p));
    setEditingPkg(null);
  }

  async function deletePackage(id){
    await supaFetch(`vendor_packages?id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});
    setPackages(prev=>prev.filter(p=>p.id!==id));
  }

  async function save(){
    if(!form.name||!form.type){setSaveError('Please fill in Business Name and Type.');return;}
    setSaving(true);setSaveError('');
    try{
      const payload={name:form.name,type:form.type,location:form.location,description:form.description,extra_info:form.extra_info,instagram:form.instagram,fixed_rate:parseInt(form.fixed_rate)||0,per_km_rate:parseInt(form.per_km_rate)||0,overnight_fee:parseInt(form.overnight_fee)||0,overnight_threshold_km:parseInt(form.overnight_threshold_km)||80,distance_km:0,color:'#c8a87a',...(latLng?{lat:latLng.lat,lng:latLng.lng}:{}),...(userId?{user_id:userId}:{})};
      let id=currentVendorId;
      if(id){await supaFetch(`vendors?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(payload),prefer:'return=minimal'});}
      else{const res=await supaFetch('vendors',{method:'POST',body:JSON.stringify(payload)});id=Array.isArray(res)?res[0]?.id:res?.id;setCurrentVendorId(id);}
      if(id){
        await supaFetch(`vendor_unavailable_dates?vendor_id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});
        if(unavailDates.size>0)await supaFetch('vendor_unavailable_dates',{method:'POST',body:JSON.stringify([...unavailDates].map(date=>({vendor_id:id,date}))),prefer:'return=minimal'});
      }
      setSaved(true);setTimeout(()=>setSaved(false),3000);
      if(onSaved)onSaved(id);
    }catch(e){setSaveError('Save failed: '+e.message);}
    setSaving(false);
  }

  async function uploadImages(files){
    if(!currentVendorId){setSaveError('Please save the profile first, then upload images.');return;}
    setUploading(true);
    for(const file of files){
      const ext=file.name.split('.').pop(),path=`${currentVendorId}/${Date.now()}.${ext}`;
      const ur=await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-images/${path}`,{method:'POST',headers:{'apikey':SUPABASE_PUB_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':file.type},body:file});
      if(ur.ok){
        const url=storageUrl(path);
        await supaFetch('vendor_images',{method:'POST',body:JSON.stringify({vendor_id:currentVendorId,url,is_primary:images.length===0,sort_order:images.length}),prefer:'return=minimal'});
        setImages(prev=>[...prev,{url,path}]);
      } else {
        const errText=await ur.text().catch(()=>'Unknown error');
        setSaveError('Image upload failed: '+errText);
      }
    }
    setUploading(false);
  }

  async function removeImage(url){
    if(!currentVendorId)return;
    await supaFetch(`vendor_images?vendor_id=eq.${currentVendorId}&url=eq.${encodeURIComponent(url)}`,{method:'DELETE',prefer:'return=minimal'});
    setImages(prev=>prev.filter(i=>i.url!==url));
  }

  function toggleUnavail(key){setUnavailDates(prev=>{const next=new Set(prev);next.has(key)?next.delete(key):next.add(key);return next;});}

  return (
    <div>
      <div style={sectionStyle}>
        <h3 style={h3Style}>Business Details</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div><label style={labelStyle}>Business Name</label><input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Lumière Photography"/></div>
          <div><label style={labelStyle}>Vendor Type</label><select style={inputStyle} value={form.type} onChange={e=>set('type',e.target.value)}><option value="">— Select type —</option>{ALL_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Business Description</label><textarea style={{...inputStyle,resize:'vertical',minHeight:80}} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Tell couples what makes your business special..."/></div>
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Additional Information</label><textarea style={{...inputStyle,resize:'vertical',minHeight:220}} value={form.extra_info} onChange={e=>set('extra_info',e.target.value)} placeholder="What's included, special notes, terms..."/></div>
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Home Base Location</label><input ref={locRef} style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Start typing your address…"/>{latLng&&<div style={{fontSize:'0.72rem',color:'var(--forest)',marginTop:5}}>Location pinned ({latLng.lat.toFixed(4)}, {latLng.lng.toFixed(4)})</div>}</div>
          <div><label style={labelStyle}>Instagram Handle</label><input style={inputStyle} value={form.instagram} onChange={e=>set('instagram',e.target.value)} placeholder="@yourbusiness"/></div>
        </div>
      </div>
      <div style={sectionStyle}>
        <h3 style={h3Style}>Pricing Structure</h3>
        {ON_REQUEST_TYPES.has(form.type)&&(
          <div style={{background:'rgba(196,130,106,0.08)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:'0.82rem',color:'var(--mid)',border:'1px solid rgba(196,130,106,0.2)'}}>
            ℹ️ <strong>{form.type}</strong> is an <em>On Request</em> category — customers will not see a fixed price. They will submit a questionnaire to receive your personalised quote.
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {!ON_REQUEST_TYPES.has(form.type)&&<div><label style={labelStyle}>Fixed Base Rate (R)</label><input style={inputStyle} type="number" value={form.fixed_rate} onChange={e=>set('fixed_rate',e.target.value)} placeholder="15000"/></div>}
          {[['Travel Cost per km (R)','per_km_rate','8'],['Overnight Fee (R)','overnight_fee','1200'],['Overnight Threshold (km)','overnight_threshold_km','80']].map(([lbl,key,ph])=>(
            <div key={key}><label style={labelStyle}>{lbl}</label><input style={inputStyle} type="number" value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph}/></div>
          ))}
        </div>
        <div style={{marginTop:14,background:'var(--parchment)',borderRadius:8,padding:'12px 16px',fontSize:'0.8rem',color:'var(--mid)'}}> Travel cost = driving distance from your home base to the customer's venue × your per km rate.</div>
      </div>
      {/* ── Packages Section ── */}
      {!ON_REQUEST_TYPES.has(form.type)&&(
      <div style={sectionStyle}>
        <h3 style={h3Style}>Pricing Packages</h3>
        <p style={{fontSize:'0.82rem',color:'var(--mid)',marginBottom:16,lineHeight:1.6}}>
          Add packages to give customers clear pricing options. If you have multiple packages, the lowest price will show as a "From" price on your vendor card.
        </p>

        {/* Existing packages */}
        {packages.map((pkg,idx)=>(
          <div key={pkg.id||idx} style={{background:'var(--parchment)',borderRadius:12,padding:'16px 18px',marginBottom:12,border:'1px solid var(--blush)'}}>
            {editingPkg&&editingPkg.id===pkg.id?(
              /* Edit mode */
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:10}}>
                  <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Package Name</label><input style={inputStyle} value={editingPkg.name} onChange={e=>setEditPkg('name',e.target.value)} placeholder="e.g. Essential Package"/></div>
                  <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Package Description</label><textarea style={{...inputStyle,resize:'vertical',minHeight:70}} value={editingPkg.description} onChange={e=>setEditPkg('description',e.target.value)} placeholder="What's included in this package..."/></div>
                  <div><label style={labelStyle}>Base Rate (R)</label><input style={inputStyle} type="number" value={editingPkg.fixed_rate} onChange={e=>setEditPkg('fixed_rate',e.target.value)}/></div>
                  <div><label style={labelStyle}>Travel per km (R)</label><input style={inputStyle} type="number" value={editingPkg.per_km_rate} onChange={e=>setEditPkg('per_km_rate',e.target.value)}/></div>
                  <div><label style={labelStyle}>Overnight Fee (R)</label><input style={inputStyle} type="number" value={editingPkg.overnight_fee} onChange={e=>setEditPkg('overnight_fee',e.target.value)}/></div>
                  <div><label style={labelStyle}>Overnight Threshold (km)</label><input style={inputStyle} type="number" value={editingPkg.overnight_threshold_km} onChange={e=>setEditPkg('overnight_threshold_km',e.target.value)}/></div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>saveEditPackage(editingPkg)} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'8px 18px',fontSize:'0.82rem',cursor:'pointer',fontWeight:500,display:'flex',alignItems:'center',gap:6}}>{IC.check(13,'var(--gold-light)')}Save Package</button>
                  <button onClick={()=>setEditingPkg(null)} style={{background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:8,padding:'8px 14px',fontSize:'0.82rem',cursor:'pointer'}}>Cancel</button>
                </div>
              </div>
            ):(
              /* View mode */
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>{pkg.name}</div>
                  {pkg.description&&<div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.55,marginBottom:6}}>{pkg.description}</div>}
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:'0.76rem'}}>
                    <span style={{background:'rgba(58,74,63,0.07)',color:'var(--forest)',borderRadius:6,padding:'3px 9px',fontWeight:600}}>Base: {fmt(pkg.fixed_rate)}</span>
                    <span style={{color:'var(--mid)'}}>R{pkg.per_km_rate}/km travel</span>
                    {pkg.overnight_fee>0&&<span style={{color:'var(--mid)'}}>R{pkg.overnight_fee} overnight (&gt;{pkg.overnight_threshold_km}km)</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button onClick={()=>setEditingPkg({...pkg})} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'6px 12px',fontSize:'0.75rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>{IC.edit(12,'var(--gold-light)')}Edit</button>
                  <button onClick={()=>deletePackage(pkg.id)} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:7,padding:'6px 10px',fontSize:'0.75rem',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>{IC.trash(12,'#b85a45')}Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add new package form */}
        <div style={{background:'var(--white)',borderRadius:12,padding:'16px 18px',border:'1.5px dashed var(--parchment)'}}>
          <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:12,display:'flex',alignItems:'center',gap:6}}>{IC.chevronR(14,'var(--forest)')}Add a Package</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Package Name</label><input style={inputStyle} value={newPkg.name} onChange={e=>setPkg('name',e.target.value)} placeholder="e.g. Essential, Premium, Full-Day..."/></div>
            <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Package Description</label><textarea style={{...inputStyle,resize:'vertical',minHeight:70}} value={newPkg.description} onChange={e=>setPkg('description',e.target.value)} placeholder="What's included: hours of coverage, deliverables, extras..."/></div>
            <div><label style={labelStyle}>Base Rate (R)</label><input style={inputStyle} type="number" value={newPkg.fixed_rate} onChange={e=>setPkg('fixed_rate',e.target.value)} placeholder="15000"/></div>
            <div><label style={labelStyle}>Travel per km (R)</label><input style={inputStyle} type="number" value={newPkg.per_km_rate} onChange={e=>setPkg('per_km_rate',e.target.value)} placeholder="8"/></div>
            <div><label style={labelStyle}>Overnight Fee (R)</label><input style={inputStyle} type="number" value={newPkg.overnight_fee} onChange={e=>setPkg('overnight_fee',e.target.value)} placeholder="1200"/></div>
            <div><label style={labelStyle}>Overnight Threshold (km)</label><input style={inputStyle} type="number" value={newPkg.overnight_threshold_km} onChange={e=>setPkg('overnight_threshold_km',e.target.value)} placeholder="80"/></div>
          </div>
          <button onClick={addPackage} style={{marginTop:14,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:'9px 20px',fontSize:'0.82rem',fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>{IC.chevronR(14,'var(--white)')}Add Package</button>
        </div>
      </div>
      )}

      <div style={sectionStyle}>
        <h3 style={h3Style}>Business Images</h3>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
          {images.map((img,i)=><div key={i} style={{position:'relative',width:80,height:80,borderRadius:10,overflow:'hidden'}}><img src={img.url} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/><button onClick={()=>removeImage(img.url)} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.6)',color:'white',border:'none',borderRadius:'50%',width:20,height:20,cursor:'pointer',fontSize:'0.7rem',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button></div>)}
          <div onClick={()=>fileRef.current?.click()} style={{width:80,height:80,borderRadius:10,border:'1.5px dashed var(--blush)',background:'var(--parchment)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'1.4rem',color:'var(--light)'}}>{uploading?'⏳':'+'}</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>uploadImages([...e.target.files])}/>
        <p style={{fontSize:'0.74rem',color:'var(--light)'}}>Save profile first, then upload images.</p>
      </div>

      {saveError&&<p style={{color:'var(--rose)',fontSize:'0.84rem',marginBottom:8}}>{saveError}</p>}
      <div style={{display:'flex',gap:12}}>
        {onCancel&&<button onClick={onCancel} style={{flex:1,background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:10,padding:'13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',cursor:'pointer'}}>Cancel</button>}
        <button onClick={save} disabled={saving} style={{flex:2,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'13px 32px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:saving?'wait':'pointer',letterSpacing:'0.04em'}}>{saving?'Saving…':'Save & Publish Profile'}</button>
      </div>
      {saved&&<div style={{textAlign:'center',color:'var(--forest)',fontSize:'0.88rem',marginTop:12,padding:10,background:'rgba(58,74,63,0.07)',borderRadius:8}}>Profile saved!</div>}
    </div>
  );
}

// ── VENDOR DASHBOARD (logged-in vendor) ───────────────────────────────────────

export default VendorForm;
export { VendorForm };