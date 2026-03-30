import React, { useState, useEffect, useRef, memo } from 'react';
import { loadGoogleMaps } from '../../api.js';

function VenueAutocomplete({value,onChange,onPlaceSelected,placeholder,style}) {
  const inputRef=useRef();
  const [mapsReady,setMapsReady]=useState(mapsLoaded);
  useEffect(()=>{
    loadGoogleMaps().then(()=>setMapsReady(true));
  },[]);
  useEffect(()=>{
    if(!mapsReady)return;
    loadGoogleMaps().then(google=>{
      if(!inputRef.current)return;
      const ac=new google.maps.places.Autocomplete(inputRef.current,{types:['establishment','geocode'],componentRestrictions:{country:'za'}});
      ac.addListener('place_changed',()=>{const place=ac.getPlace();if(place.geometry){const ll={lat:place.geometry.location.lat(),lng:place.geometry.location.lng()};const name=place.formatted_address||place.name;onChange(name);onPlaceSelected(ll,name);}});
    });
  },[mapsReady]);
  return <input ref={inputRef} type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={style}/>;
}

// ── MAPS ──────────────────────────────────────────────────────────────────────

export default VenueAutocomplete;
export { VenueAutocomplete };