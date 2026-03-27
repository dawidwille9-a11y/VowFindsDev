import React, { useState, useEffect, useRef, memo } from 'react';
import { loadGoogleMaps } from '../../api.js';
import { ALL_TYPES, TYPE_EMOJI, TYPE_COLOR } from '../../constants.jsx';

function VendorsMap({vendors,venueLatLng,onSelectVendor}) {
  const mapRef=useRef(), mapInst=useRef(), markers=useRef([]);
  useEffect(()=>{
    loadGoogleMaps().then(google=>{
      if(!mapRef.current)return;
      const center=venueLatLng||{lat:-29.0,lng:25.0};
      if(!mapInst.current){mapInst.current=new google.maps.Map(mapRef.current,{zoom:venueLatLng?8:6,center,mapTypeControl:false,streetViewControl:false,styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'water',stylers:[{color:'#c8dce8'}]},{featureType:'landscape',stylers:[{color:'#f5f0e8'}]}]});}
      else if(venueLatLng)mapInst.current.setCenter(center);
      markers.current.forEach(m=>m.setMap(null)); markers.current=[];
      if(venueLatLng){const vm=new google.maps.Marker({position:venueLatLng,map:mapInst.current,title:'Your Venue',zIndex:999,icon:{path:google.maps.SymbolPath.CIRCLE,scale:12,fillColor:'#3a4a3f',fillOpacity:1,strokeColor:'#e8d5a3',strokeWeight:3}});const vi=new google.maps.InfoWindow({content:'<div style="font-family:sans-serif;font-weight:600;color:#3a4a3f;padding:4px 8px">📍 Your Venue</div>'});vm.addListener('click',()=>vi.open(mapInst.current,vm));markers.current.push(vm);}
      vendors.forEach(v=>{if(!v.lat||!v.lng)return;const color=TYPE_COLOR[v.type]||'#c4826a';const marker=new google.maps.Marker({position:{lat:v.lat,lng:v.lng},map:mapInst.current,title:v.name,icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:color,fillOpacity:0.9,strokeColor:'#ffffff',strokeWeight:2}});const info=new google.maps.InfoWindow({content:`<div style="font-family:sans-serif;padding:6px 10px;max-width:180px"><div style="font-weight:700;color:#2c2c2c;margin-bottom:2px">${v.name}</div><div style="font-size:0.78rem;color:#6b6b6b;margin-bottom:4px">${v.type}</div><div style="font-size:0.78rem;color:#6b6b6b">${v.location}</div>${v.distance_km?`<div style="font-size:0.78rem;color:#c4826a;font-weight:600;margin-top:4px">~${v.distance_km} km away</div>`:''}</div>`});marker.addListener('click',()=>{info.open(mapInst.current,marker);if(onSelectVendor)onSelectVendor(v);});markers.current.push(marker);});
      if(markers.current.length>1){const bounds=new google.maps.LatLngBounds();markers.current.forEach(m=>bounds.extend(m.getPosition()));mapInst.current.fitBounds(bounds);}
    });
  },[vendors,venueLatLng]);
  return (
    <div style={{borderRadius:16,overflow:'hidden',boxShadow:'var(--card-shadow)',margin:'0 32px 40px'}}>
      <div style={{background:'var(--forest)',padding:'12px 20px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:'var(--gold-light)',fontSize:'0.8rem',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>{IC.map(14,'var(--gold-light)')}Vendor Map</span>
        {ALL_TYPES.filter(t=>vendors.some(v=>v.type===t&&v.lat)).map(t=>(
          <div key={t} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.7rem',color:'rgba(255,255,255,0.7)'}}><div style={{width:8,height:8,borderRadius:'50%',background:TYPE_COLOR[t]}}/>{t}</div>
        ))}
      </div>
      <div ref={mapRef} style={{height:420,width:'100%'}}/>
    </div>
  );
}


export default VendorsMap;
export {{ VendorsMap }};