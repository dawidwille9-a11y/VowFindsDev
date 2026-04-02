import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PUB_KEY, GOOGLE_MAPS_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────
// Gets the current session token if a user is logged in, falls back to anon key.
// This is what makes RLS work — authenticated requests carry the user's JWT,
// so Supabase knows who is making the request and can enforce row-level policies.
async function getAuthToken() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch(e) {}
  return SUPABASE_ANON_KEY;
}

export async function supaFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  // Use the current session token so RLS policies recognise the logged-in user.
  // If no session exists (public browsing), fall back to the anon key.
  const token = await getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_PUB_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers, // allow per-call overrides
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ── AUTH HELPERS ──────────────────────────────────────────────────────────────
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

// ── GOOGLE MAPS LOADER ────────────────────────────────────────────────────────
const _maps = { loaded: false, loading: false, callbacks: [] };
export function loadGoogleMaps() {
  return new Promise((resolve) => {
    if (_maps.loaded) return resolve(window.google);
    _maps.callbacks.push(resolve);
    if (!_maps.loading) {
      _maps.loading = true;
      window.__googleMapsReady = () => {
        _maps.loaded = true;
        _maps.callbacks.forEach(cb => cb(window.google));
        _maps.callbacks = [];
      };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&callback=__googleMapsReady`;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

// ── DISTANCE HELPERS ──────────────────────────────────────────────────────────
export function haversineKm(origin, dest) {
  const R=6371, dLat=(dest.lat-origin.lat)*Math.PI/180, dLng=(dest.lng-origin.lng)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(origin.lat*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

export async function getBatchDistancesKm(origin, vendors) {
  await loadGoogleMaps();
  const BATCH = 25;
  const results = new Array(vendors.length).fill(0);
  for (let i = 0; i < vendors.length; i += BATCH) {
    const chunk = vendors.slice(i, i + BATCH);
    const dests = chunk.filter(v => v.lat && v.lng).map(v => new window.google.maps.LatLng(v.lat, v.lng));
    if (dests.length === 0) continue;
    await new Promise(resolve => {
      new window.google.maps.DistanceMatrixService().getDistanceMatrix({
        origins: [new window.google.maps.LatLng(origin.lat, origin.lng)],
        destinations: dests,
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (res, status) => {
        let destIdx = 0;
        chunk.forEach((v, ci) => {
          if (!v.lat || !v.lng) { results[i + ci] = 0; return; }
          results[i + ci] = status === 'OK'
            ? Math.round((res.rows[0]?.elements[destIdx]?.distance?.value || 0) / 1000)
            : haversineKm(origin, v);
          destIdx++;
        });
        resolve();
      });
    });
  }
  return results;
}

export async function getDistanceKm(origin, dest) {
  const [km] = await getBatchDistancesKm(origin, [dest]);
  return km;
}

// Re-export storageUrl for components that import it from api.js
export { storageUrl } from './config.js';

// Session helpers — re-exported from session.js for backward compat
export { saveSession, loadSession, clearSession, saveRemember, loadRemember, clearRemember } from './session.js';
