import React, { useState, useEffect, useRef, memo } from 'react';
import { storageUrl } from '../../config.js';
import { supaFetch, loadGoogleMaps } from '../../api.js';
import { storageUrl } from '../../config.js';
import { IC } from '../../icons.jsx';
import { ALL_TYPES, ON_REQUEST_TYPES, TYPE_COLOR } from '../../constants.js';
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
  // Track vendor ID as internal state so images work immediately after first save
  const [currentVendorId,setCurrentVendorId]=useState(vendorId);
  const fileRef=useRef(),locRef=useRef();

  useEffect(()=>{
    if(initialData?.images)setImages(initialData.images.map(i=>({url:i.url,path:''})));
    loadGoogleMaps().then(google=>{
      if(!locRef.current)return;
      const ac=new google.maps.places.Autocomplete(locRef.current,{types:['geocode','establishment'],componentRestrictions:{country:'za'}});
      ac.addListener('place_changed',()=>{const place=ac.getPlace();if(place.geometry){setLatLng({lat:place.geometry.location.lat(),lng:place.geometry.location.lng()});setForm(f=>({...f,location:place.formatted_address||place.name}));}});
    });
  },[]);

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

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
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Additional Information</label><textarea style={{...inputStyle,resize:'vertical',minHeight:60}} value={form.extra_info} onChange={e=>set('extra_info',e.target.value)} placeholder="Packages, what's included, special notes..."/></div>
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
export {{ VendorForm }};