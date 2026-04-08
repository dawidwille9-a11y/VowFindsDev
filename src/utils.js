// Pure utility / formatting helpers
import { ON_REQUEST_TYPES, MONTHS } from './constants.js';

export function calcTotal(v) {
  if(ON_REQUEST_TYPES.has(v.type)) return 0;
  if(v.packages&&v.packages.length>0){
    return Math.min(...v.packages.map(p=>calcPackageTotal(p,v.distance_km||0)));
  }
  const travel=(v.distance_km||0)*(v.per_km_rate||0);
  const overnight=(v.distance_km||0)>(v.overnight_threshold_km||80)?(v.overnight_fee||0):0;
  return (v.fixed_rate||0)+travel+overnight;
}

export function calcPackageTotal(pkg, distance_km=0) {
  const travel=distance_km*(pkg.per_km_rate||0);
  const overnight=distance_km>(pkg.overnight_threshold_km||80)?(pkg.overnight_fee||0):0;
  return (pkg.fixed_rate||0)+travel+overnight;
}

export function calcFromPrice(v) {
  if(!v.packages||v.packages.length===0) return null;
  const totals=v.packages.map(p=>calcPackageTotal(p,v.distance_km||0));
  const min=Math.min(...totals);
  return {price:min, isFrom:v.packages.length>1};
}

export function isOnRequest(v) { return ON_REQUEST_TYPES.has(v.type); }

export function isVendorUnavailable(vendor, dateFrom, dateTo) {
  if(!dateFrom) return false;
  const unavailSet=new Set((vendor.unavail_dates||[]).map(d=>d.date));
  const effectiveTo=dateTo&&dateTo!==dateFrom?dateTo:dateFrom;
  if(dateFrom===effectiveTo) return unavailSet.has(dateFrom);
  const start=new Date(dateFrom), end=new Date(effectiveTo);
  const totalDays=Math.round((end-start)/86400000)+1;
  let bookedDays=0;
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const key=d.toISOString().slice(0,10);
    if(unavailSet.has(key)) bookedDays++;
  }
  return bookedDays===totalDays;
}

export function fmt(n) { return 'R '+Number(n||0).toLocaleString('en-ZA'); }
export function avg(arr) { return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0; }
export function dateKey(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
export function formatDateDisplay(s) { if(!s)return''; const[y,m,d]=s.split('-').map(Number); return `${d} ${MONTHS[m-1]} ${y}`; }
export function nextSaturday() { const d=new Date(); d.setDate(d.getDate()+((6-d.getDay()+7)%7||7)+14); return d.toISOString().split('T')[0]; }

// Extract city/town from a full address string for privacy-safe display
// "12 Church St, Stellenbosch, 7600, South Africa" → "Stellenbosch"
// "Babylonstoren, Simondium Rd, Klapmuts, South Africa" → "Klapmuts"
export function cityFromLocation(location) {
  if (!location) return '';
  const parts = location.split(',').map(s => s.trim()).filter(Boolean);
  // Filter out: postcodes (all digits), country names, empty strings
  const ignore = new Set(['south africa','za','south africa (za)']);
  const meaningful = parts.filter(p =>
    !(/^\d+$/.test(p)) &&          // not a postcode
    !ignore.has(p.toLowerCase()) &&  // not a country
    p.length > 1
  );
  if (meaningful.length === 0) return location;
  // The town is usually the LAST meaningful segment
  // e.g. ["12 Church St", "Stellenbosch"] → "Stellenbosch"
  // e.g. ["Babylonstoren", "Simondium Rd", "Klapmuts"] → "Klapmuts"
  // But if only one segment, it might be "Stellenbosch" already - use it
  return meaningful[meaningful.length - 1];
}
