// Pure utility / formatting helpers

export function calcTotal(v) {
  if(ON_REQUEST_TYPES.has(v.type)) return 0;
  // If vendor has packages, use the cheapest package total for filtering/sorting
  if(v.packages&&v.packages.length>0){
    return Math.min(...v.packages.map(p=>calcPackageTotal(p,v.distance_km||0)));
  }
  const travel = (v.distance_km||0)*(v.per_km_rate||0);
  const overnight = (v.distance_km||0)>(v.overnight_threshold_km||80)?(v.overnight_fee||0):0;
  return (v.fixed_rate||0)+travel+overnight;
}
// Returns cheapest package total (with travel/overnight), or null if no packages
export function calcPackageTotal(pkg, distance_km=0) {
  const travel = distance_km*(pkg.per_km_rate||0);
  const overnight = distance_km>(pkg.overnight_threshold_km||80)?(pkg.overnight_fee||0):0;
  return (pkg.fixed_rate||0)+travel+overnight;
}
export function calcFromPrice(v) {
  // Returns {price, isFrom} — isFrom=true means multiple packages so show "from"
  if(!v.packages||v.packages.length===0) return null;
  const totals=v.packages.map(p=>calcPackageTotal(p,v.distance_km||0));
  const min=Math.min(...totals);
  return {price:min, isFrom:v.packages.length>1};
}
export function isOnRequest(v) { return ON_REQUEST_TYPES.has(v.type); }
// Returns true only if the vendor has NO available day in the selected range.
// For a single day: true if that day is booked.
// For a range (e.g. whole month): true only if EVERY day in the range is booked.
export function isVendorUnavailable(vendor, dateFrom, dateTo) {
  if(!dateFrom) return false;
  const unavailSet = new Set((vendor.unavail_dates||[]).map(d=>d.date));
  const effectiveTo = dateTo && dateTo !== dateFrom ? dateTo : dateFrom;
  // Single day check
  if(dateFrom === effectiveTo) return unavailSet.has(dateFrom);
  // Range check — find if there is at least one free day in the range
  const start = new Date(dateFrom), end = new Date(effectiveTo);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  // Only mark unavailable if ALL days are booked (no free day)
  let bookedDays = 0;
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const key = d.toISOString().slice(0,10);
    if(unavailSet.has(key)) bookedDays++;
  }

const unavailSet = new Set((vendor.unavail_dates||[]).map(d=>d.date));
  const effectiveTo = dateTo && dateTo !== dateFrom ? dateTo : dateFrom;
  // Single day check
  if(dateFrom === effectiveTo) return unavailSet.has(dateFrom);
  // Range check — find if there is at least one free day in the range
  const start = new Date(dateFrom), end = new Date(effectiveTo);
  const totalDays = Math.round((end - start) / 86400000) + 1;
  // Only mark unavailable if ALL days are booked (no free day)
  let bookedDays = 0;
  for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
    const key = d.toISOString().slice(0,10);
    if(unavailSet.has(key)) bookedDays++;
  }

export function fmt(n) { return 'R\u00a0'+Number(n||0).toLocaleString('en-ZA'); }
export function avg(arr) { return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0; }
export function dateKey(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
export function formatDateDisplay(s) { if(!s)return''; const[y,m,d]=s.split('-').map(Number); return`${d} ${MONTHS[m-1]} ${y}`; }
export function nextSaturday() { const d=new Date(); d.setDate(d.getDate()+((6-d.getDay()+7)%7||7)+14); return d.toISOString().split('T')[0]; }
