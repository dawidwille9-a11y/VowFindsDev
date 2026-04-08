import React, { useState, useEffect, useRef, memo } from 'react';
import { loadGoogleMaps } from '../../api.js';
import { IC } from '../../icons.jsx';

function DetailMap({vendor,venueLatLng}) {
  const mapRef=useRef();
  useEffect(()=>{
    if(!vendor.lat||!vendor.lng)return;
    loadGoogleMaps().then(google=>{
      if(!mapRef.current)return;
      const vp={lat:vendor.lat,lng:vendor.lng};
      const map=new google.maps.Map(mapRef.current,{zoom:8,center:vp,mapTypeControl:false,streetViewControl:false,styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]},{featureType:'water',stylers:[{color:'#c8dce8'}]},{featureType:'landscape',stylers:[{color:'#f5f0e8'}]}]});
      new google.maps.Marker({position:vp,map,title:vendor.name,icon:{path:google.maps.SymbolPath.CIRCLE,scale:11,fillColor:'#c4826a',fillOpacity:1,strokeColor:'#fff',strokeWeight:3}});
      if(venueLatLng){
        new google.maps.Marker({position:venueLatLng,map,title:'Your Venue',icon:{path:google.maps.SymbolPath.CIRCLE,scale:11,fillColor:'#3a4a3f',fillOpacity:1,strokeColor:'#e8d5a3',strokeWeight:3}});
        const ds=new google.maps.DirectionsService(),dr=new google.maps.DirectionsRenderer({map,suppressMarkers:true,polylineOptions:{strokeColor:'#c4826a',strokeOpacity:0.7,strokeWeight:4}});
        ds.route({origin:venueLatLng,destination:vp,travelMode:google.maps.TravelMode.DRIVING},(result,status)=>{if(status==='OK'){dr.setDirections(result);const b=new google.maps.LatLngBounds();b.extend(venueLatLng);b.extend(vp);map.fitBounds(b);}});
      }
    });
  },[vendor,venueLatLng]);
  if(!vendor.lat||!vendor.lng)return<div style={{background:'var(--parchment)',borderRadius:12,padding:'24px',textAlign:'center',color:'var(--light)',fontSize:'0.84rem'}}>This vendor hasn't set their location yet.</div>;
  return<div ref={mapRef} style={{height:280,width:'100%',borderRadius:12,overflow:'hidden',boxShadow:'var(--card-shadow)'}}/>;
}

// ── CUSTOMER AUTH MODAL ──────────────────────────────────────────────────────

export default DetailMap;
export { DetailMap };