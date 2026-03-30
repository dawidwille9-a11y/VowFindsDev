import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_MAPS_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const GOOGLE_MAPS_KEY = 'AIzaSyAEmYsoBR2eLoBKr30Gxzy0xdpIl3foCq0';
export const ADMIN_USER = 'admin';
export const ADMIN_PASS = 'admin';

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────
export async function supaFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_PUB_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// Supabase Auth helpers
export async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_PUB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || 'Sign up failed');
  return data;
}

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_PUB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
  return data; // { access_token, user: { id, email } }
}

export function storageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/vendor-images/${path}`;
}

// ── SESSION PERSISTENCE ───────────────────────────────────────────────────────
export const SESSION_KEY = 'vowfinds_session';
export const REMEMBER_KEY = 'vowfinds_remember';

export function saveSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch(e) {}
  // Also save to localStorage if remember me was set
  try {
    const rem = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
    if (rem && rem.email === user.email) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  } catch(e) {}
}

export function loadSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    if (s) return JSON.parse(s);
  } catch(e) {}
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (s) return JSON.parse(s);
  } catch(e) {}
  return null;
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

export function saveRemember(email, password) {
  try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({email, password})); } catch(e) {}
}

export function loadRemember() {
  try { return JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null'); } catch(e) { return null; }
}

export function clearRemember() {
  try { localStorage.removeItem(REMEMBER_KEY); } catch(e) {}
}

// ── GOOGLE MAPS LOADER ────────────────────────────────────────────────────────
let mapsLoaded = false, mapsLoading = false, mapsCallbacks = [];
export function loadGoogleMaps() {
  return new Promise((resolve) => {
    if (mapsLoaded) return resolve(window.google);
    mapsCallbacks.push(resolve);
    if (!mapsLoading) {
      mapsLoading = true;
      window.__googleMapsReady = () => { mapsLoaded = true; mapsCallbacks.forEach(cb => cb(window.google)); mapsCallbacks = []; };
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&callback=__googleMapsReady`;
      s.async = true; document.head.appendChild(s);
    }
  });
}

// Haversine fallback for a single pair
export function haversineKm(origin, dest) {
  const R=6371, dLat=(dest.lat-origin.lat)*Math.PI/180, dLng=(dest.lng-origin.lng)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(origin.lat*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

// Batch distance lookup — ONE API call for up to 25 vendors at once
export async function getBatchDistancesKm(origin, vendors) {
  await loadGoogleMaps();
  const BATCH = 25;
  const results = new Array(vendors.length).fill(0);
  for (let i = 0; i < vendors.length; i += BATCH) {
    const chunk = vendors.slice(i, i + BATCH);
    const dests = chunk.filter(v => v.lat && v.lng)
      .map(v => new window.google.maps.LatLng(v.lat, v.lng));
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
          if (status === 'OK') {
            results[i + ci] = Math.round((res.rows[0]?.elements[destIdx]?.distance?.value || 0) / 1000);
          } else {
            results[i + ci] = haversineKm(origin, v);
          }
          destIdx++;
        });
        resolve();
      });
    });
  }
  return results; // array of km values, same order as vendors
}

// Keep single version for backward compat
export async function getDistanceKm(origin, dest) {
  const [km] = await getBatchDistancesKm(origin, [dest]);
  return km;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
