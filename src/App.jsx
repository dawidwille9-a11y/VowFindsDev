// VowFinds – Supabase + Google Maps + Auth

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
// ── MOBILE DETECTION ─────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768); // 768px = mobile threshold
  React.useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}


// ── CREDENTIALS ───────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://pvpmmzpzeruzoxvwyhqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cG1tenB6ZXJ1em94dnd5aHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjkwNTQsImV4cCI6MjA4OTQwNTA1NH0.Bz45g6NBSNeHd_E4s9TRddlJOseYUJKhAErtIbcyfks';
const SUPABASE_PUB_KEY  = 'sb_publishable_CBnCOZJzit8uM2fUIIH5-A_WEC3pwS-';
const GOOGLE_MAPS_KEY   = 'AIzaSyAEmYsoBR2eLoBKr30Gxzy0xdpIl3foCq0';
const ADMIN_USER        = 'admin';
const ADMIN_PASS        = 'admin';

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────
async function supaFetch(path, options = {}) {
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
async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_PUB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || 'Sign up failed');
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_PUB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Login failed');
  return data; // { access_token, user: { id, email } }
}

function storageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/vendor-images/${path}`;
}

// ── SESSION PERSISTENCE ───────────────────────────────────────────────────────
const SESSION_KEY = 'vowfinds_session';
const REMEMBER_KEY = 'vowfinds_remember';

function saveSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch(e) {}
  // Also save to localStorage if remember me was set
  try {
    const rem = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
    if (rem && rem.email === user.email) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  } catch(e) {}
}

function loadSession() {
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

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch(e) {}
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

function saveRemember(email, password) {
  try { localStorage.setItem(REMEMBER_KEY, JSON.stringify({email, password})); } catch(e) {}
}

function loadRemember() {
  try { return JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null'); } catch(e) { return null; }
}

function clearRemember() {
  try { localStorage.removeItem(REMEMBER_KEY); } catch(e) {}
}

// ── GOOGLE MAPS LOADER ────────────────────────────────────────────────────────
let mapsLoaded = false, mapsLoading = false, mapsCallbacks = [];
function loadGoogleMaps() {
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
function haversineKm(origin, dest) {
  const R=6371, dLat=(dest.lat-origin.lat)*Math.PI/180, dLng=(dest.lng-origin.lng)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(origin.lat*Math.PI/180)*Math.cos(dest.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

// Batch distance lookup — ONE API call for up to 25 vendors at once
async function getBatchDistancesKm(origin, vendors) {
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
async function getDistanceKm(origin, dest) {
  const [km] = await getBatchDistancesKm(origin, [dest]);
  return km;
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const ALL_TYPES  = ['Photography','Catering','Florist','DJ','Entertainment','Videography','Cake & Desserts','Barista','Furniture Rental','Hair & Makeup'];
const TYPE_EMOJI = {'Photography':'📷','Catering':'🍽','Florist':'💐','DJ':'🎧','Entertainment':'🎶','Videography':'🎬','Cake & Desserts':'🎂','Barista':'☕','Furniture Rental':'🛋','Hair & Makeup':'💄'};

// ── SVG ICON SYSTEM ────────────────────────────────────────────────────────────
// Clean, modern line icons — replaces emoji throughout the app
const IC={
  // Navigation & UI
  menu:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="16" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x:        (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>,
  home:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9,21 9,12 15,12 15,21"/></svg>,
  chat:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  heart:    (sz=20,cl='currentColor',fill='none')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill={fill} stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  star:     (sz=20,cl='currentColor',fill='none')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill={fill} stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  back:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>,
  send:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>,
  pin:      (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  calendar: (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  attach:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  smile:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  logout:   (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  check:    (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>,
  rings:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>,
  eye:      (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  trash:    (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  edit:     (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  map:      (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  settings: (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  // Vendor category icons (line art style)
  camera:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  food:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  flower:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 000 6M12 16a3 3 0 000 6M2 12a3 3 0 006 0M16 12a3 3 0 006 0M4.93 4.93a3 3 0 004.24 4.24M14.83 14.83a3 3 0 004.24 4.24M4.93 19.07a3 3 0 014.24-4.24M14.83 9.17a3 3 0 014.24-4.24"/></svg>,
  music:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  video:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23,7 16,12 23,17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  cake:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4a1 1 0 001-1 1 1 0 001 1 1 1 0 001-1 1 1 0 001 1"/></svg>,
  coffee:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/></svg>,
  furniture:(sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V7a2 2 0 00-2-2H6a2 2 0 00-2 2v2"/><path d="M2 11a2 2 0 012 2v4h16v-4a2 2 0 012-2H2z"/><line x1="6" y1="17" x2="6" y2="21"/><line x1="18" y1="17" x2="18" y2="21"/></svg>,
  makeup:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 00-5 5c0 2 1 4 2 5v3h6v-3c1-1 2-3 2-5a5 5 0 00-5-5z"/><rect x="9" y="15" width="6" height="4" rx="1"/><line x1="9" y1="19" x2="9" y2="21"/><line x1="15" y1="19" x2="15" y2="21"/></svg>,
  // General
  quote:    (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  instagram:(sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5" stroke={cl} strokeWidth="1.8"/><circle cx="17.5" cy="6.5" r="1" fill={cl} stroke="none"/></svg>,
  info:     (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  chevronR: (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>,
  chevronD: (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 12,15 18,9"/></svg>,
  dot:      (sz=8,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={cl}/></svg>,
};

// Map vendor types to icon functions
const TYPE_ICON={
  'Photography': IC.camera,
  'Catering':    IC.food,
  'Florist':     IC.flower,
  'DJ':          IC.music,
  'Entertainment':IC.music,
  'Videography': IC.video,
  'Cake & Desserts':IC.cake,
  'Barista':     IC.coffee,
  'Furniture Rental':IC.furniture,
  'Hair & Makeup':IC.makeup,
};
function VendorIcon({type,size=18,color='currentColor'}){const fn=TYPE_ICON[type];return fn?fn(size,color):<span style={{fontSize:size*0.8}}>{TYPE_EMOJI[type]||'•'}</span>;}
const TYPE_COLOR = {'Photography':'#c4826a','Catering':'#6a8fa8','Florist':'#8faa6a','DJ':'#9b6aaa','Entertainment':'#aa8f6a','Videography':'#6a9baa','Cake & Desserts':'#aa6a8f','Barista':'#8b5e3c','Furniture Rental':'#7a8f6a','Hair & Makeup':'#aa6a8a'};
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOWS       = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── ON-REQUEST TYPES & QUESTIONNAIRES ────────────────────────────────────────
const ON_REQUEST_TYPES = new Set(['Florist','Catering','Cake & Desserts','Furniture Rental','Hair & Makeup']);

const ON_REQUEST_QUESTIONS = {
  'Florist': [
    'What is your overall floral style preference? (e.g. romantic, rustic, modern, wild)',
    'How many bridal party members need bouquets/buttonholes?',
    'Do you need ceremony flowers (arch, aisle, pew decorations)?',
    'How many reception tables need centrepieces?',
    'Do you prefer fresh, dried, or artificial flowers?',
    'Are there any flowers you love or want to avoid?',
    'Do you have a colour palette in mind?',
    'Will you need the florist to assist with setup and breakdown on the day?',
  ],
  'Catering': [
    'How many guests are you expecting?',
    'What meal style do you prefer? (e.g. sit-down, buffet, cocktail, grazing table)',
    'Do you need breakfast, lunch, dinner, or all-day service?',
    'Are there any dietary requirements or allergies we should know about?',
    'Do you need staff (waiters, bartenders) included in the quote?',
    'Will you need crockery, cutlery, and linen, or will the venue provide these?',
    'Do you have a food theme or cuisine preference?',
    'Will you need a late-night snack or additional meal service?',
  ],
  'Cake & Desserts': [
    'How many tiers would you like your wedding cake?',
    'What cake flavours are you considering? (e.g. vanilla, red velvet, lemon)',
    'Do you want a fondant or buttercream finish?',
    'What decoration style appeals to you? (e.g. floral, geometric, minimalist)',
    'How many guests will the cake need to serve?',
    'Do you need a dessert table in addition to the main cake?',
    'Are there any dietary requirements? (e.g. gluten-free, vegan)',
    'Do you have inspiration images or a colour palette to share?',
  ],
  'Furniture Rental': [
    'How many guests are you expecting?',
    'What furniture style do you prefer? (e.g. rustic, modern, bohemian, classic)',
    'Do you need ceremony seating (chairs/benches) or reception seating, or both?',
    'Are you looking for tables only, or a full furniture package (lounge areas, bar tables, etc.)?',
    'Do you need a dance floor included in the rental?',
    'Will you need delivery, setup, and collection included?',
    'Do you have a venue already — is it indoors, outdoors, or both?',
    'Do you have any inspiration images or a colour/style palette to share?',
  ],
  'Hair & Makeup': [
    'How many people in your bridal party need hair and/or makeup?',
    'Do you need both hair and makeup, or just one?',
    'What is your preferred makeup style? (e.g. natural, glam, editorial)',
    'What is your preferred hair style? (e.g. updo, loose waves, braided)',
    'Will a trial session be required before the wedding day?',
    'What time do you need to be ready by on the wedding day?',
    'Will the artist need to travel to your venue or accommodation?',
    'Do you have inspiration images or a colour palette to share?',
  ],
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
function calcTotal(v) {
  if(ON_REQUEST_TYPES.has(v.type)) return 0; // on-request, no fixed rate shown
  const travel = (v.distance_km||0)*(v.per_km_rate||0);
  const overnight = (v.distance_km||0)>(v.overnight_threshold_km||80)?(v.overnight_fee||0):0;
  return (v.fixed_rate||0)+travel+overnight;
}
function isOnRequest(v) { return ON_REQUEST_TYPES.has(v.type); }
function fmt(n) { return 'R\u00a0'+Number(n||0).toLocaleString('en-ZA'); }
function avg(arr) { return arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):0; }
function dateKey(y,m,d) { return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function formatDateDisplay(s) { if(!s)return''; const[y,m,d]=s.split('-').map(Number); return`${d} ${MONTHS[m-1]} ${y}`; }
function nextSaturday() { const d=new Date(); d.setDate(d.getDate()+((6-d.getDay()+7)%7||7)+14); return d.toISOString().split('T')[0]; }

// ── SHARED STYLES ─────────────────────────────────────────────────────────────
const inputStyle = {border:'1.5px solid var(--parchment)',borderRadius:8,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'};
const labelStyle = {fontSize:'0.72rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:4,display:'block'};
const sectionStyle = {background:'var(--white)',borderRadius:16,padding:28,marginBottom:20,boxShadow:'var(--card-shadow)'};
const h3Style = {fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',marginBottom:20,paddingBottom:10,borderBottom:'1px solid var(--parchment)'};

// ── CALENDAR ──────────────────────────────────────────────────────────────────
const Calendar=memo(function Calendar({ year, month, unavailDates=new Set(), weddingDate='', editable=false, onToggle, onPrev, onNext }) {
  const today=new Date(), firstDow=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate();
  let wdY,wdM,wdD; if(weddingDate){[wdY,wdM,wdD]=weddingDate.split('-').map(Number);wdM--;}
  return (
    <div style={{background:'var(--white)',borderRadius:16,padding:20,boxShadow:'var(--card-shadow)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <button onClick={onPrev} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--mid)',padding:'2px 8px'}}>‹</button>
        <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>{MONTHS[month]} {year}</span>
        <button onClick={onNext} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--mid)',padding:'2px 8px'}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {DOWS.map(d=><div key={d} style={{textAlign:'center',fontSize:'0.62rem',color:'var(--light)',letterSpacing:'0.08em',textTransform:'uppercase',paddingBottom:6,fontWeight:500}}>{d}</div>)}
        {Array(firstDow).fill(null).map((_,i)=><div key={'e'+i}/>)}
        {Array.from({length:days},(_,i)=>i+1).map(day=>{
          const key=dateKey(year,month,day),isU=unavailDates.has(key),isT=today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===day,isW=weddingDate&&wdY===year&&wdM===month&&wdD===day;
          let bg='transparent',color='var(--charcoal)',fw=400,border='none';
          if(isW){bg='var(--forest)';color='var(--gold-light)';fw=700;}else if(isU){bg='#fce8e4';color='#b85a45';fw=600;}
          if(isT)border='1.5px solid var(--gold)';
          return(<div key={day} onClick={editable?()=>onToggle(key):undefined}
            style={{textAlign:'center',fontSize:'0.78rem',padding:'5px 2px',borderRadius:6,cursor:editable?'pointer':'default',background:bg,color,fontWeight:fw,border,minHeight:28,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s'}}
            onMouseEnter={e=>{if(editable&&!isW)e.currentTarget.style.background=isU?'#f5d5cf':'var(--parchment)';}}
            onMouseLeave={e=>{if(editable&&!isW)e.currentTarget.style.background=isU?'#fce8e4':'transparent';}}
          >{day}</div>);
        })}
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',color:'var(--mid)'}}><div style={{width:10,height:10,borderRadius:3,background:'var(--parchment)',border:'1px solid #ddd'}}/>Available</div>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',color:'var(--mid)'}}><div style={{width:10,height:10,borderRadius:3,background:'#fce8e4'}}/>Unavailable</div>
        {weddingDate&&<div style={{display:'flex',alignItems:'center',gap:5,fontSize:'0.72rem',color:'var(--mid)'}}><div style={{width:10,height:10,borderRadius:3,background:'var(--forest)'}}/>Your wedding date</div>}
      </div>
    </div>
  );
});

// ── VENUE AUTOCOMPLETE ────────────────────────────────────────────────────────
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
      vendors.forEach(v=>{if(!v.lat||!v.lng)return;const color=TYPE_COLOR[v.type]||'#c4826a';const marker=new google.maps.Marker({position:{lat:v.lat,lng:v.lng},map:mapInst.current,title:v.name,icon:{path:google.maps.SymbolPath.CIRCLE,scale:9,fillColor:color,fillOpacity:0.9,strokeColor:'#ffffff',strokeWeight:2}});const info=new google.maps.InfoWindow({content:`<div style="font-family:sans-serif;padding:6px 10px;max-width:180px"><div style="font-weight:700;color:#2c2c2c;margin-bottom:2px">${v.name}</div><div style="font-size:0.78rem;color:#6b6b6b;margin-bottom:4px">${TYPE_EMOJI[v.type]||''} ${v.type}</div><div style="font-size:0.78rem;color:#6b6b6b">📍 ${v.location}</div>${v.distance_km?`<div style="font-size:0.78rem;color:#c4826a;font-weight:600;margin-top:4px">~${v.distance_km} km away</div>`:''}</div>`});marker.addListener('click',()=>{info.open(mapInst.current,marker);if(onSelectVendor)onSelectVendor(v);});markers.current.push(marker);});
      if(markers.current.length>1){const bounds=new google.maps.LatLngBounds();markers.current.forEach(m=>bounds.extend(m.getPosition()));mapInst.current.fitBounds(bounds);}
    });
  },[vendors,venueLatLng]);
  return (
    <div style={{borderRadius:16,overflow:'hidden',boxShadow:'var(--card-shadow)',margin:'0 32px 40px'}}>
      <div style={{background:'var(--forest)',padding:'12px 20px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{color:'var(--gold-light)',fontSize:'0.8rem',fontWeight:500,letterSpacing:'0.08em',textTransform:'uppercase'}}>📍 Vendor Map</span>
        {ALL_TYPES.filter(t=>vendors.some(v=>v.type===t&&v.lat)).map(t=>(
          <div key={t} style={{display:'flex',alignItems:'center',gap:4,fontSize:'0.7rem',color:'rgba(255,255,255,0.7)'}}><div style={{width:8,height:8,borderRadius:'50%',background:TYPE_COLOR[t]}}/>{t}</div>
        ))}
      </div>
      <div ref={mapRef} style={{height:420,width:'100%'}}/>
    </div>
  );
}

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
  if(!vendor.lat||!vendor.lng)return<div style={{background:'var(--parchment)',borderRadius:12,padding:'24px',textAlign:'center',color:'var(--light)',fontSize:'0.84rem'}}>📍 This vendor hasn't set their location yet.</div>;
  return<div ref={mapRef} style={{height:280,width:'100%',borderRadius:12,overflow:'hidden',boxShadow:'var(--card-shadow)'}}/>;
}

// ── CUSTOMER AUTH MODAL ──────────────────────────────────────────────────────
function CustomerAuthModal({onLogin, onClose, redirectVendor=null, onVendorLogin=null}) {
  const savedC = loadRemember();
  const [mode,setMode]=useState('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState(savedC?.email||'');
  const [password,setPassword]=useState(savedC?.password||'');
  const [remember,setRemember]=useState(!!savedC);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState('');
  const [success,setSuccess]=useState('');

  function handleBackdrop(e){
    if(e.target.closest&&e.target.closest('.pac-container'))return;
    if(e.target.closest('.pac-container')) return;
    if(e.target===e.currentTarget) onClose();
  }

  async function handleLogin(e){
    e.preventDefault(); setError(''); setLoading('Logging in…');
    try{
      if(remember) saveRemember(email,password); else clearRemember();
      const data=await signIn(email,password);
      // Fetch or create customer record
      let customers=await supaFetch(`customers?user_id=eq.${data.user.id}&select=*`);
      let customer=Array.isArray(customers)?customers[0]:customers;
      if(!customer){
        const res=await supaFetch('customers',{method:'POST',body:JSON.stringify({user_id:data.user.id,name:data.user.user_metadata?.name||email.split('@')[0],email:data.user.email}),prefer:'return=representation'});
        customer=Array.isArray(res)?res[0]:res;
      }
      onLogin({role:'customer',email:data.user.email,userId:data.user.id,customerId:customer?.id,name:customer?.name||email.split('@')[0],token:data.access_token});
      onClose();
    }catch(err){setError(err.message);}
    setLoading('');
  }

  async function handleRegister(e){
    e.preventDefault(); setError(''); setSuccess(''); setLoading('Creating account…');
    try{
      const data=await signUp(email,password);
      // Create customer profile immediately
      if(data.user){
        await supaFetch('customers',{method:'POST',body:JSON.stringify({user_id:data.user.id,name,email}),prefer:'return=minimal'});
      }
      setSuccess('Account created! Please check your email to confirm, then log in.');
      setMode('login');
    }catch(err){setError(err.message);}
    setLoading('');
  }

  return (
    <div onClick={handleBackdrop} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:380,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        {redirectVendor&&(
          <div style={{background:'var(--parchment)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'0.8rem',color:'var(--mid)'}}>
            💍 Sign in to request a quote from <strong>{redirectVendor.name}</strong>
          </div>
        )}
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:600,marginBottom:4}}>
          {mode==='login'?'Welcome back':'Create account'}
        </div>
        <p style={{fontSize:'0.78rem',color:'var(--light)',marginBottom:22}}>
          {mode==='login'?'Login to your customer account':'Join VowFinds to request quotes'}
        </p>
        <form onSubmit={mode==='login'?handleLogin:handleRegister}>
          {mode==='register'&&(
            <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
              <label style={labelStyle}>Your Name</label>
              <input style={{...inputStyle,marginBottom:0}} type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Jane Smith" required/>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Email</label>
            <input style={{...inputStyle,marginBottom:0}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required autoFocus/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Password</label>
            <input style={{...inputStyle,marginBottom:0}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={mode==='register'?6:1}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}} onClick={()=>setRemember(r=>!r)}>
            <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${remember?'var(--rose)':'var(--light)'}`,background:remember?'var(--rose)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
              {remember&&<span style={{color:'white',fontSize:'0.6rem',lineHeight:1}}>✓</span>}
            </div>
            <span style={{fontSize:'0.78rem',color:'var(--mid)',userSelect:'none'}}>Remember my details</span>
          </div>
          {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8,border:'1px solid rgba(196,130,106,0.2)'}}>{error}</div>}
          {success&&<div style={{fontSize:'0.78rem',color:'var(--forest)',marginBottom:12,padding:'10px 12px',background:'rgba(58,74,63,0.07)',borderRadius:8}}>{success}</div>}
          <button type="submit" disabled={!!loading} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:loading?'wait':'pointer',letterSpacing:'0.05em'}}>
            {loading||(mode==='login'?'Login':'Create Account')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:'0.78rem',color:'var(--mid)'}}>
          {mode==='login'?<span>New here?{' '}<span onClick={()=>{setMode('register');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Create account</span></span>
          :<span>Already have an account?{' '}<span onClick={()=>{setMode('login');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Login</span></span>}
        </div>
        <div style={{marginTop:16,borderTop:'1px solid var(--parchment)',paddingTop:14,textAlign:'center'}}>
          <div style={{fontSize:'0.72rem',color:'var(--light)',marginBottom:8}}>Are you a wedding vendor?</div>
          <button onClick={()=>{onClose();if(onVendorLogin)onVendorLogin();}}
            style={{width:'100%',background:'none',border:'1.5px solid var(--parchment)',borderRadius:10,padding:'10px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:500,color:'var(--forest)',cursor:'pointer',letterSpacing:'0.02em'}}>
            Sign in as a Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QUOTE REQUEST MODAL ───────────────────────────────────────────────────────
function QuoteModal({vendor,customer,onClose,onSubmitted}) {
  const onReq = isOnRequest(vendor);
  const questions = ON_REQUEST_QUESTIONS[vendor.type] || [];
  const [form,setForm]=useState({title:'',description:'',budget:'',timeline:''});
  const [answers,setAnswers]=useState({}); // {questionIndex: answer text}
  const [freeText,setFreeText]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const fileRef=useRef();
  const [fileUrl,setFileUrl]=useState('');
  const [uploading,setUploading]=useState(false);

  function handleBackdrop(e){
    if(e.target.closest&&e.target.closest('.pac-container'))return;
    if(e.target===e.currentTarget)onClose();
  }
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function setAnswer(i,val){setAnswers(prev=>({...prev,[i]:val}));}

  async function uploadFile(file){
    setUploading(true);
    const ext=file.name.split('.').pop();
    const path=`leads/${Date.now()}_${file.name}`;
    const res=await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-images/${path}`,{method:'POST',headers:{'apikey':SUPABASE_PUB_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':file.type},body:file});
    if(res.ok) setFileUrl(storageUrl(path));
    else setError('File upload failed');
    setUploading(false);
  }

  async function submit(e){
    e.preventDefault();
    if(!onReq&&(!form.title||!form.description)){setError('Please fill in the title and description.');return;}
    setSubmitting(true);setError('');
    try{
      const res=await supaFetch('leads',{method:'POST',body:JSON.stringify({
        customer_id:customer.customerId,
        vendor_id:vendor.id,
        title:onReq?`${vendor.type} Quote Request`:form.title,
        description:form.description,
        budget:form.budget,
        timeline:form.timeline,
        file_url:fileUrl||null,
        status:'new',
      }),prefer:'return=representation'});
      const lead=Array.isArray(res)?res[0]:res;
      // Post first message with the details
      const msgLines = onReq ? [
        `Quote Request for ${vendor.name} (${vendor.type})`,
        '',
        ...questions.flatMap((q,i)=>answers[i]?[`${q}`,`→ ${answers[i]}`,'']:[]),
        ...(freeText?['Additional details:',freeText,'']:[]),
        ...(fileUrl?['📎 Attachment included']:[]),
      ] : [
        'Hi! I would like to request a quote.',
        '',
        'Project: ' + form.title,
        '',
        form.description,
        form.budget ? ('Budget: ' + form.budget) : '',
        form.timeline ? ('Timeline: ' + form.timeline) : '',
      ];
      await supaFetch('messages',{method:'POST',body:JSON.stringify({
        lead_id:lead.id,
        sender_role:'customer',
        sender_name:customer.name,
        message_text:msgLines.filter(Boolean).join('\n'),
        file_url:fileUrl||null,
      }),prefer:'return=minimal'});
      onSubmitted(lead);
    }catch(err){setError('Submission failed: '+err.message);}
    setSubmitting(false);
  }

  return(
    <div onClick={handleBackdrop} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:'20px'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:520,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.28)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:10,background:vendor.images?.[0]?.url?`url(${vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${vendor.color||'#c8a87a'}dd,${vendor.color||'#c8a87a'}66)`,flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',fontWeight:600}}>Request a Quote</div>
            <div style={{fontSize:'0.78rem',color:'var(--mid)'}}>{vendor.name} · {TYPE_EMOJI[vendor.type]} {vendor.type}</div>
          </div>
        </div>
        <form onSubmit={submit}>
          {onReq ? (
            /* On-Request questionnaire */
            <div>
              <div style={{fontSize:'0.82rem',color:'var(--mid)',marginBottom:14,padding:'10px 12px',background:'var(--cream)',borderRadius:8}}>
                Please answer the questions below to help <strong>{vendor.name}</strong> prepare your personalised quote. Skip any that don't apply.
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:14}}>
                {questions.map((q,i)=>(
                  <div key={i}>
                    <label style={{...labelStyle,marginBottom:5,textTransform:'none',letterSpacing:0,fontSize:'0.82rem',color:'var(--charcoal)',fontWeight:500}}>{i+1}. {q}</label>
                    <input style={{...inputStyle,padding:'8px 11px',fontSize:'0.83rem'}} value={answers[i]||''} onChange={e=>setAnswer(i,e.target.value)} placeholder="Your answer…"/>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:14}}>
                <label style={labelStyle}>Anything else you'd like to add?</label>
                <textarea style={{...inputStyle,resize:'vertical',minHeight:70}} value={freeText} onChange={e=>setFreeText(e.target.value)} placeholder="Any additional details, inspiration images descriptions, colour palette, special requests…"/>
              </div>
            </div>
          ) : (
            /* Standard quote form */
            <div>
              <div style={{marginBottom:12}}>
                <label style={labelStyle}>Project Title</label>
                <input style={inputStyle} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Wedding Photography – October 2025" required/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={labelStyle}>Description</label>
                <textarea style={{...inputStyle,resize:'vertical',minHeight:90}} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Tell the vendor about your wedding and what you need…" required/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div><label style={labelStyle}>Budget (optional)</label><input style={inputStyle} value={form.budget} onChange={e=>set('budget',e.target.value)} placeholder="e.g. R15 000"/></div>
                <div><label style={labelStyle}>Timeline / Wedding Date</label><input style={inputStyle} value={form.timeline} onChange={e=>set('timeline',e.target.value)} placeholder="e.g. 15 March 2026"/></div>
              </div>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <div onClick={()=>fileRef.current?.click()} style={{border:'1.5px dashed var(--blush)',borderRadius:8,padding:'10px 14px',cursor:'pointer',fontSize:'0.8rem',color:fileUrl?'var(--forest)':'var(--light)',background:'var(--cream)',textAlign:'center'}}>
              {uploading?'Uploading…':fileUrl?'✓ File attached':'📎 Attach inspiration images or mood boards (optional)'}
            </div>
            <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadFile(e.target.files[0])}/>
          </div>
          {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}
          <div style={{display:'flex',gap:10}}>
            <button type="button" onClick={onClose} style={{flex:1,background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',cursor:'pointer'}}>Cancel</button>
            <button type="submit" disabled={submitting||uploading} style={{flex:2,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:(submitting||uploading)?'wait':'pointer',letterSpacing:'0.04em'}}>
              {submitting?'Sending…':onReq?'Send Quote Request':'Send Quote Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CHAT THREAD ───────────────────────────────────────────────────────────────
const EMOJI_LIST = ['❤️','😊','👍','🙏','✨','🎉','😄','👏','🌸','💫'];

function ChatThread({lead,currentRole,currentName,onBack}) {
  const [messages,setMessages]=useState([]);
  const [msgText,setMsgText]=useState('');
  const [sending,setSending]=useState(false);
  const [loadingMsgs,setLoadingMsgs]=useState(true);
  const [isTyping,setIsTyping]=useState(false);
  const [otherTyping,setOtherTyping]=useState(false);
  const [showEmoji,setShowEmoji]=useState(false);
  const [leadStatus,setLeadStatus]=useState(lead.status||'new');
  const [readUpTo,setReadUpTo]=useState(null); // last message id the other party has seen
  const fileRef=useRef();
  const bottomRef=useRef();
  const textareaRef=useRef();
  const typingTimeout=useRef(null);
  const lastCountRef=useRef(0);
  const intervalRef=useRef(null);

  useEffect(()=>{
    loadMessages();
    intervalRef.current=setInterval(loadMessages,4000);
    return()=>{clearInterval(intervalRef.current);};
  },[lead.id]);

  // Smooth scroll to bottom on new messages
  useEffect(()=>{
    if(messages.length!==lastCountRef.current){
      lastCountRef.current=messages.length;
      bottomRef.current?.scrollIntoView({behavior:'smooth'});
    }
  },[messages]);

  // Mark messages as read when opening chat — store in app_settings
  useEffect(()=>{
    if(messages.length>0){
      const lastId=messages[messages.length-1].id;
      const key=`read_${lead.id}_${currentRole==='vendor'?'vendor':'customer'}`;
      supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:lastId,updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
      // Fetch what the other party has read
      const otherKey=`read_${lead.id}_${currentRole==='vendor'?'customer':'vendor'}`;
      supaFetch(`app_settings?key=eq.${otherKey}&select=value`).then(d=>{
        if(d&&d[0])setReadUpTo(d[0].value);
      }).catch(()=>{});
    }
  },[messages]);

  // Typing indicator — store in app_settings with TTL logic
  function handleTyping(){
    if(!isTyping){
      setIsTyping(true);
      const key=`typing_${lead.id}_${currentRole}`;
      supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:'1',updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current=setTimeout(()=>{
      setIsTyping(false);
      const key=`typing_${lead.id}_${currentRole}`;
      supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:'0',updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
    },2500);
  }

  async function loadMessages(){
    try{
      const data=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.asc&select=*`);
      setMessages(data||[]);
      // Check if other party is typing
      const otherRole=currentRole==='vendor'?'customer':'vendor';
      const typingKey=`typing_${lead.id}_${otherRole}`;
      const tData=await supaFetch(`app_settings?key=eq.${typingKey}&select=value,updated_at`);
      if(tData&&tData[0]&&tData[0].value==='1'){
        const ago=(Date.now()-new Date(tData[0].updated_at).getTime())/1000;
        setOtherTyping(ago<4); // hide if stale
      } else {setOtherTyping(false);}
    }catch(e){}
    setLoadingMsgs(false);
  }

  async function sendMessage(e){
    e.preventDefault();
    if(!msgText.trim())return;
    setSending(true);
    // Optimistic UI — show message immediately
    const optimistic={id:'sending_'+Date.now(),lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:msgText,created_at:new Date().toISOString(),_sending:true};
    setMessages(prev=>[...prev,optimistic]);
    setMsgText('');
    setShowEmoji(false);
    // Clear typing indicator
    clearTimeout(typingTimeout.current);
    setIsTyping(false);
    const key=`typing_${lead.id}_${currentRole}`;
    supaFetch('app_settings',{method:'POST',body:JSON.stringify({key,value:'0',updated_at:new Date().toISOString()}),prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
    try{
      await supaFetch('messages',{method:'POST',body:JSON.stringify({lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:optimistic.message_text}),prefer:'return=minimal'});
      loadMessages();
    }catch(err){
      setMessages(prev=>prev.filter(m=>m.id!==optimistic.id));
      alert('Send failed: '+err.message);
    }
    setSending(false);
  }

  async function uploadAndSend(file){
    const path=`messages/${lead.id}/${Date.now()}_${file.name}`;
    const res=await fetch(`${SUPABASE_URL}/storage/v1/object/vendor-images/${path}`,{method:'POST',headers:{'apikey':SUPABASE_PUB_KEY,'Authorization':`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':file.type},body:file});
    if(res.ok){
      const url=storageUrl(path);
      await supaFetch('messages',{method:'POST',body:JSON.stringify({lead_id:lead.id,sender_role:currentRole,sender_name:currentName,message_text:'',file_url:url}),prefer:'return=minimal'});
      loadMessages();
    }
  }

  function appendEmoji(em){
    setMsgText(prev=>prev+em);
    textareaRef.current?.focus();
  }

  async function updateStatus(newStatus){
    setLeadStatus(newStatus);
    await supaFetch(`leads?id=eq.${lead.id}`,{method:'PATCH',body:JSON.stringify({status:newStatus}),prefer:'return=minimal'});
  }

  // Group messages by date
  function formatMsgDate(ts){
    if(!ts)return'';
    const d=new Date(ts),now=new Date();
    if(d.toDateString()===now.toDateString())return'Today';
    const yest=new Date(now);yest.setDate(now.getDate()-1);
    if(d.toDateString()===yest.toDateString())return'Yesterday';
    return d.toLocaleDateString('en-ZA',{weekday:'short',day:'numeric',month:'short'});
  }

  const STATUS_META={
    new:{label:'New',bg:'rgba(201,169,110,0.15)',color:'#9a7a3a',dot:'#c9a96e'},
    responded:{label:'Responded',bg:'rgba(58,122,90,0.12)',color:'#2a6a4a',dot:'#3a7a5a'},
    closed:{label:'Closed',bg:'rgba(168,168,168,0.15)',color:'#777',dot:'#a8a8a8'},
  };
  const sm=STATUS_META[leadStatus]||STATUS_META.new;

  // Build grouped message list
  const grouped=[];
  let lastDate='';
  messages.forEach((m,i)=>{
    const d=formatMsgDate(m.created_at);
    if(d!==lastDate){grouped.push({type:'date',label:d,key:'date_'+i});lastDate=d;}
    grouped.push({type:'msg',msg:m,key:m.id||'msg_'+i});
  });

  const otherName=currentRole==='vendor'?(lead.customer_name||'Customer'):(lead.vendor_name||'Vendor');
  const avatar=(name)=>(name||'?')[0].toUpperCase();

  return(
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 56px)',background:'var(--white)',overflow:'hidden',borderRadius:0}}>

      {/* ── Header ── */}
      <div style={{padding:'12px 16px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',gap:10,background:'var(--white)',boxShadow:'0 1px 6px rgba(0,0,0,0.05)',flexShrink:0,zIndex:2}}>
        <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'var(--mid)',padding:'6px',borderRadius:8,flexShrink:0,display:'flex',alignItems:'center'}}>{IC.back(20,'var(--mid)')}</button>
        {/* Avatar */}
        <div style={{width:38,height:38,borderRadius:'50%',background:'var(--forest)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.9rem',flexShrink:0}}>{avatar(otherName)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:'0.92rem',color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{otherName}</div>
          <div style={{fontSize:'0.72rem',color:'var(--light)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.title}</div>
        </div>
        {/* Status badge */}
        <div style={{display:'flex',alignItems:'center',gap:6,background:sm.bg,borderRadius:999,padding:'4px 10px',flexShrink:0}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:sm.dot}}/>
          {currentRole==='vendor'?(
            <select value={leadStatus} onChange={e=>updateStatus(e.target.value)}
              style={{border:'none',background:'transparent',fontSize:'0.72rem',fontWeight:600,color:sm.color,cursor:'pointer',outline:'none',padding:0}}>
              <option value="new">New</option>
              <option value="responded">Responded</option>
              <option value="closed">Closed</option>
            </select>
          ):(
            <span style={{fontSize:'0.72rem',fontWeight:600,color:sm.color}}>{sm.label}</span>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:2,background:'#f7f3ee'}}>
        {loadingMsgs?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{textAlign:'center',color:'var(--light)'}}>
              <div style={{fontSize:'1.5rem',marginBottom:6}}>💬</div>
              <div style={{fontSize:'0.84rem'}}>Loading messages…</div>
            </div>
          </div>
        ):grouped.length===0?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{textAlign:'center',color:'var(--light)',padding:'20px'}}>
              <div style={{fontSize:'2rem',marginBottom:8}}>👋</div>
              <div style={{fontSize:'0.88rem',fontWeight:500,color:'var(--mid)',marginBottom:4}}>Start the conversation</div>
              <div style={{fontSize:'0.78rem'}}>Say hello to {otherName}</div>
            </div>
          </div>
        ):(
          grouped.map(item=>{
            if(item.type==='date') return(
              <div key={item.key} style={{display:'flex',alignItems:'center',gap:8,margin:'12px 0 8px'}}>
                <div style={{flex:1,height:1,background:'rgba(0,0,0,0.08)'}}/>
                <span style={{fontSize:'0.68rem',color:'var(--light)',fontWeight:500,letterSpacing:'0.06em'}}>{item.label}</span>
                <div style={{flex:1,height:1,background:'rgba(0,0,0,0.08)'}}/>
              </div>
            );
            const m=item.msg;
            const isMe=m.sender_role===currentRole;
            const isLast=grouped[grouped.length-1].key===item.key||(grouped[grouped.length-1].type==='msg'&&grouped[grouped.length-1].key===item.key);
            const isRead=readUpTo&&m.id===readUpTo&&isMe&&!m._sending;
            const time=m.created_at?new Date(m.created_at).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'}):'';
            return(
              <div key={item.key} style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',marginBottom:2}}>
                <div style={{display:'flex',alignItems:'flex-end',gap:6,flexDirection:isMe?'row-reverse':'row',maxWidth:'82%'}}>
                  {/* Avatar for other party — only on first in a run */}
                  {!isMe&&(
                    <div style={{width:26,height:26,borderRadius:'50%',background:'var(--forest)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,flexShrink:0,marginBottom:2}}>{avatar(otherName)}</div>
                  )}
                  <div style={{display:'flex',flexDirection:'column',alignItems:isMe?'flex-end':'flex-start',gap:2}}>
                    {m.message_text&&(
                      <div style={{
                        background:m._sending?'rgba(58,74,63,0.5)':isMe?'var(--forest)':'var(--white)',
                        color:isMe?'var(--cream)':'var(--charcoal)',
                        borderRadius:isMe?'18px 18px 4px 18px':'18px 18px 18px 4px',
                        padding:'10px 14px',
                        fontSize:'0.875rem',
                        lineHeight:1.5,
                        boxShadow:isMe?'none':'0 1px 3px rgba(0,0,0,0.08)',
                        whiteSpace:'pre-wrap',
                        wordBreak:'break-word',
                        opacity:m._sending?0.7:1,
                      }}>
                        {m.message_text}
                      </div>
                    )}
                    {m.file_url&&(
                      <a href={m.file_url} target="_blank" rel="noreferrer"
                        style={{display:'inline-flex',alignItems:'center',gap:6,background:isMe?'var(--forest)':'var(--white)',color:isMe?'var(--gold-light)':'var(--forest)',borderRadius:12,padding:'8px 12px',fontSize:'0.8rem',textDecoration:'none',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
                        <span style={{fontSize:'1rem'}}>📎</span> View attachment
                      </a>
                    )}
                    {/* Timestamp + read receipt */}
                    <div style={{display:'flex',alignItems:'center',gap:4,paddingLeft:isMe?0:4,paddingRight:isMe?4:0}}>
                      <span style={{fontSize:'0.62rem',color:'var(--light)'}}>{time}{m._sending?' · Sending…':''}</span>
                      {isMe&&!m._sending&&(
                        <span style={{fontSize:'0.68rem',color:isRead?'#3a7a5a':'var(--light)',fontWeight:isRead?600:400}} title={isRead?'Seen':'Delivered'}>
                          {isRead?'✓✓':'✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {otherTyping&&(
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 0 8px'}}>
            <div style={{width:26,height:26,borderRadius:'50%',background:'var(--forest)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',fontWeight:700,flexShrink:0}}>{avatar(otherName)}</div>
            <div style={{background:'var(--white)',borderRadius:'18px 18px 18px 4px',padding:'10px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.08)',display:'flex',gap:4,alignItems:'center'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--light)',display:'inline-block',animation:'bounce 1s infinite'}}/>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--light)',display:'inline-block',animation:'bounce 1s 0.2s infinite'}}/>
              <span style={{width:6,height:6,borderRadius:'50%',background:'var(--light)',display:'inline-block',animation:'bounce 1s 0.4s infinite'}}/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── Emoji picker ── */}
      {showEmoji&&(
        <div style={{background:'var(--white)',borderTop:'1px solid var(--parchment)',padding:'10px 14px',display:'flex',gap:8,flexWrap:'wrap',flexShrink:0}}>
          {EMOJI_LIST.map(em=>(
            <button key={em} onClick={()=>appendEmoji(em)}
              style={{background:'none',border:'none',fontSize:'1.4rem',cursor:'pointer',padding:'2px 4px',borderRadius:6,lineHeight:1}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--parchment)'}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              {em}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{padding:'10px 12px',borderTop:'1px solid var(--parchment)',background:'var(--white)',flexShrink:0}}>
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          {/* Emoji toggle */}
          <button onClick={()=>setShowEmoji(e=>!e)}
            style={{background:showEmoji?'var(--parchment)':'none',border:'none',borderRadius:8,padding:'8px',cursor:'pointer',fontSize:'1.1rem',color:'var(--mid)',flexShrink:0,lineHeight:1,alignSelf:'flex-end'}}>
            😊
          </button>
          {/* Textarea */}
          <div style={{flex:1,background:'var(--cream)',borderRadius:22,border:'1.5px solid var(--parchment)',padding:'8px 14px',display:'flex',alignItems:'flex-end',gap:8}}>
            <textarea
              ref={textareaRef}
              value={msgText}
              onChange={e=>{setMsgText(e.target.value);handleTyping();}}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(e);}}}
              placeholder="Message…"
              rows={1}
              style={{flex:1,border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',outline:'none',resize:'none',maxHeight:100,lineHeight:1.5,padding:0}}
            />
          </div>
          {/* Attach */}
          <button onClick={()=>fileRef.current?.click()}
            style={{background:'none',border:'none',borderRadius:8,padding:'8px',cursor:'pointer',color:'var(--mid)',flexShrink:0,display:'flex',alignSelf:'flex-end'}}>
            {IC.attach(20,'var(--mid)')}
          </button>
          {/* Send */}
          <button onClick={sendMessage} disabled={sending||!msgText.trim()}
            style={{width:38,height:38,borderRadius:'50%',background:msgText.trim()?'var(--forest)':'var(--parchment)',color:msgText.trim()?'var(--gold-light)':'var(--light)',border:'none',cursor:msgText.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s',fontSize:'1rem'}}>
{sending?'…':IC.send(18,'currentColor')}
          </button>
        </div>
        <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>e.target.files[0]&&uploadAndSend(e.target.files[0])}/>
      </div>

      <style>{`
        @keyframes bounce {
          0%,60%,100%{transform:translateY(0);}
          30%{transform:translateY(-4px);}
        }
      `}</style>
    </div>
  );
}

// ── CUSTOMER DASHBOARD ───────────────────────────────────────────────────────
function CustomerDashboard({user,onLogout,onBrowse,initialLead=null}) {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeLead,setActiveLead]=useState(null);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const pollRef=useRef(null);
  // Track whether the initial lead has been applied — only do it once
  const initialLeadApplied=useRef(false);

  useEffect(()=>{
    loadLeads();
    pollRef.current=setInterval(loadLeads,8000);
    return()=>clearInterval(pollRef.current);
  },[]);

  // Apply initialLead only once, after first load
  useEffect(()=>{
    if(initialLead&&leads.length>0&&!initialLeadApplied.current){
      const found=leads.find(l=>l.id===initialLead.id);
      if(found){setActiveLead(found);initialLeadApplied.current=true;}
    }
  },[leads]);

  async function loadLeads(){
    try{
      if(!user.customerId)return;
      const data=await supaFetch(`leads?customer_id=eq.${user.customerId}&select=*,vendor:vendors(name,type,color,images:vendor_images(url))&order=created_at.desc`);
      const withMsgs=await Promise.all((data||[]).map(async lead=>{
        try{
          const msgs=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);
          return{...lead,last_message:Array.isArray(msgs)?msgs[0]:null};
        }catch{return lead;}
      }));
      setLeads(withMsgs);
    }catch(e){}
    setLoading(false);
  }

  const STATUS_COLOR={'new':'#c9a96e','responded':'#3a7a5a','closed':'#a8a8a8'};
  const STATUS_BG={'new':'rgba(201,169,110,0.1)','responded':'rgba(58,122,90,0.1)','closed':'rgba(168,168,168,0.1)'};
  const unread=leads.filter(l=>l.last_message&&l.last_message.sender_role==='vendor').length;

  return(
    <div className="vf-customer-dash-body" style={{minHeight:'100vh',background:'var(--cream)',display:'flex',flexDirection:'column'}}>

      {/* Top bar */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'0 20px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:'0 1px 8px rgba(0,0,0,0.05)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setSidebarOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',borderRadius:6,display:'flex',flexDirection:'column',gap:4,color:'var(--forest)'}}>
            <div style={{width:18,height:2,background:'var(--forest)',borderRadius:2}}/>
            <div style={{width:14,height:2,background:'var(--forest)',borderRadius:2}}/>
            <div style={{width:18,height:2,background:'var(--forest)',borderRadius:2}}/>
          </button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>
            {activeLead?activeLead.title:'My Quotes'}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {activeLead&&(
            <button onClick={()=>setActiveLead(null)} style={{display:'flex',alignItems:'center',gap:5,background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',fontSize:'0.78rem',color:'var(--mid)',cursor:'pointer'}}>
              ‹ Back
            </button>
          )}
          <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'6px 12px',fontSize:'0.78rem',cursor:'pointer',fontWeight:500}}>Browse Vendors</button>
          <button onClick={onLogout} style={{background:'none',border:'1px solid var(--parchment)',borderRadius:7,padding:'6px 12px',fontSize:'0.78rem',color:'var(--mid)',cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',position:'relative'}}>

        {/* Sidebar overlay on mobile */}
        {sidebarOpen&&<div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:50}}/>}

        {/* Sidebar — absolute on mobile so it overlays instead of pushing content right */}
        <div style={{
          width:280,flexShrink:0,background:'var(--white)',borderRight:'1px solid var(--parchment)',
          display:'flex',flexDirection:'column',
          position:window.innerWidth<=700?'absolute':'relative',
          top:0,bottom:0,left:0,
          zIndex:51,
          transition:'transform 0.25s ease',
          transform:sidebarOpen||window.innerWidth>700?'translateX(0)':'translateX(-100%)',
        }}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--forest)',display:'flex',alignItems:'center',gap:6}}>{IC.chat(15,'var(--forest)')} Conversations</div>
              <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:2}}>Hi, {user.name}</div>
            </div>
            {unread>0&&<span style={{background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.68rem',padding:'2px 8px',fontWeight:600}}>{unread}</span>}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
            {loading?(
              <div style={{textAlign:'center',padding:'24px',color:'var(--light)',fontSize:'0.82rem'}}>Loading…</div>
            ):leads.length===0?(
              <div style={{textAlign:'center',padding:'32px 16px'}}>
                <div style={{fontSize:'2rem',marginBottom:8}}>💌</div>
                <div style={{fontSize:'0.84rem',color:'var(--mid)',marginBottom:10}}>No quotes yet</div>
                <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'8px 14px',fontSize:'0.78rem',cursor:'pointer'}}>Browse vendors</button>
              </div>
            ):(
              leads.map(lead=>{
                const isActive=activeLead?.id===lead.id;
                const hasVendorReply=lead.last_message?.sender_role==='vendor';
                return(
                  <div key={lead.id} onClick={()=>{setActiveLead(lead);setSidebarOpen(false);}}
                    style={{padding:'10px 12px',borderRadius:10,cursor:'pointer',marginBottom:4,
                      background:isActive?'rgba(58,74,63,0.08)':'transparent',
                      border:`1.5px solid ${isActive?'var(--forest)':'transparent'}`,
                      transition:'all 0.12s'}}
                    onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background='var(--cream)';}}
                    onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent';}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:34,height:34,borderRadius:7,background:lead.vendor?.images?.[0]?.url?`url(${lead.vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}cc,${lead.vendor?.color||'#c8a87a'}66)`,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.vendor?.name}</div>
                        <div style={{fontSize:'0.71rem',color:'var(--mid)',marginTop:1}}>{lead.title}</div>
                      </div>
                      {hasVendorReply&&!isActive&&<div style={{width:8,height:8,borderRadius:'50%',background:'var(--rose)',flexShrink:0}}/>}
                    </div>
                    {lead.last_message&&(
                      <div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingLeft:42}}>
                        {lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'📎 Attachment'}
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:4,paddingLeft:42}}>
                      <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.62rem',padding:'1px 6px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                      <span style={{fontSize:'0.66rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{flex:1,overflowY:'auto',padding:'0'}}>
          {activeLead?(
            <div style={{maxWidth:760,margin:'0 auto',padding:'20px 20px 60px'}}>
              <ChatThread
                lead={{...activeLead,customer_name:user.name,vendor_name:activeLead.vendor?.name}}
                currentRole="customer"
                currentName={user.name}
                onBack={()=>setActiveLead(null)}
              />
            </div>
          ):(
            <div style={{maxWidth:820,margin:'0 auto',padding:'28px 24px 60px'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:400,marginBottom:4}}>My Quote Requests</div>
              <p style={{color:'var(--light)',fontSize:'0.82rem',marginBottom:24}}>Your conversations grouped by vendor category.</p>
              {loading?(
                <div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading…</div>
              ):leads.length===0?(
                <div style={{textAlign:'center',padding:'60px 20px',background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)'}}>
                  <div style={{fontSize:'3rem',marginBottom:12}}>💌</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>No quote requests yet</div>
                  <p style={{color:'var(--mid)',fontSize:'0.88rem',marginBottom:16}}>Browse vendors and click "Request a Quote" to get started.</p>
                  <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px 22px',fontSize:'0.88rem',cursor:'pointer'}}>Browse Vendors</button>
                </div>
              ):(()=>{
                const grouped={};
                leads.forEach(lead=>{const type=lead.vendor?.type||'Other';if(!grouped[type])grouped[type]=[];grouped[type].push(lead);});
                const orderedTypes=[...ALL_TYPES.filter(t=>grouped[t]),...Object.keys(grouped).filter(t=>!ALL_TYPES.includes(t)&&grouped[t])];
                return orderedTypes.map(type=>(
                  <div key={type} style={{marginBottom:28}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,paddingBottom:8,borderBottom:'2px solid var(--parchment)'}}>
                      <span style={{fontSize:'1.2rem'}}>{TYPE_EMOJI[type]||'💼'}</span>
                      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
                      <span style={{fontSize:'0.72rem',color:'var(--light)',background:'var(--parchment)',padding:'2px 9px',borderRadius:999}}>{grouped[type].length} conversation{grouped[type].length!==1?'s':''}</span>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {grouped[type].map(lead=>{
                        const hasNew=lead.last_message?.sender_role==='vendor'&&lead.status!=='closed';
                        return(
                          <div key={lead.id} onClick={()=>setActiveLead(lead)}
                            style={{background:'var(--white)',borderRadius:12,padding:'14px 18px',boxShadow:'var(--card-shadow)',cursor:'pointer',transition:'box-shadow 0.15s,transform 0.15s',display:'flex',alignItems:'center',gap:14,borderLeft:`3px solid ${hasNew?'var(--rose)':'var(--parchment)'}`}}
                            onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--card-shadow-hover)';e.currentTarget.style.transform='translateY(-2px)';}}
                            onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--card-shadow)';e.currentTarget.style.transform='';}}>
                            <div style={{width:44,height:44,borderRadius:9,background:lead.vendor?.images?.[0]?.url?`url(${lead.vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}dd,${lead.vendor?.color||'#c8a87a'}66)`,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',fontWeight:600,color:'var(--forest)'}}>{lead.vendor?.name}</span>
                                {hasNew&&<span style={{width:7,height:7,borderRadius:'50%',background:'var(--rose)',flexShrink:0,display:'inline-block'}}/>}
                              </div>
                              <div style={{fontSize:'0.74rem',color:'var(--mid)',marginBottom:3}}>{lead.title}</div>
                              {lead.last_message&&<div style={{fontSize:'0.73rem',color:'var(--light)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'📎 Attachment'}</div>}
                            </div>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
                              <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.65rem',padding:'2px 8px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                              <span style={{fontSize:'0.68rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


// ── LOGIN MODAL ───────────────────────────────────────────────────────────────
function LoginModal({onLogin, onClose}) {
  const saved = loadRemember();
  const [mode,setMode]=useState('login');
  const [identifier,setIdentifier]=useState(saved?.email||'');
  const [password,setPassword]=useState(saved?.password||'');
  const [remember,setRemember]=useState(!!saved);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState('');
  const [success,setSuccess]=useState('');

  function handleBackdrop(e){
    if(e.target===e.currentTarget) onClose();
  }

  async function handleLogin(e){
    e.preventDefault(); setError(''); setLoading('Logging in…');
    if(identifier===ADMIN_USER && password===ADMIN_PASS){
      const u={role:'admin',email:'admin'};
      if(remember) saveRemember(identifier,password); else clearRemember();
      setLoading(''); onLogin(u); onClose(); return;
    }
    try{
      const data=await signIn(identifier, password);
      if(remember) saveRemember(identifier,password); else clearRemember();
      onLogin({role:'vendor', email:data.user.email, userId:data.user.id, token:data.access_token});
      onClose();
    }catch(err){ setError(err.message); }
    setLoading('');
  }

  async function handleRegister(e){
    e.preventDefault(); setError(''); setSuccess(''); setLoading('Creating account…');
    try{
      await signUp(identifier, password);
      if(remember) saveRemember(identifier,password);
      setSuccess('Account created! Check your email to confirm, then log in.');
      setMode('login');
    }catch(err){ setError(err.message); }
    setLoading('');
  }

  return (
    <div onClick={handleBackdrop} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:360,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:600,marginBottom:4}}>
          {mode==='login' ? 'Welcome back' : 'Create account'}
        </div>
        <p style={{fontSize:'0.78rem',color:'var(--light)',marginBottom:22}}>
          {mode==='login' ? 'Login to manage your vendor profile' : 'Register as a new vendor on VowFinds'}
        </p>
        <form onSubmit={mode==='login' ? handleLogin : handleRegister}>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Email</label>
            <input style={{...inputStyle,marginBottom:0}} type="text" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="your@email.com" required autoFocus/>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Password</label>
            <input style={{...inputStyle,marginBottom:0}} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={mode==='register'?6:1}/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}} onClick={()=>setRemember(r=>!r)}>
            <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${remember?'var(--forest)':'var(--light)'}`,background:remember?'var(--forest)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
              {remember&&<span style={{color:'white',fontSize:'0.6rem',lineHeight:1}}>✓</span>}
            </div>
            <span style={{fontSize:'0.78rem',color:'var(--mid)',userSelect:'none'}}>Remember my details</span>
          </div>
          {error && <div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8,border:'1px solid rgba(196,130,106,0.2)'}}>{error}</div>}
          {success && <div style={{fontSize:'0.78rem',color:'var(--forest)',marginBottom:12,padding:'10px 12px',background:'rgba(58,74,63,0.07)',borderRadius:8}}>{success}</div>}
          <button type="submit" disabled={!!loading} style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:loading?'wait':'pointer',letterSpacing:'0.05em'}}>
            {loading || (mode==='login' ? 'Login' : 'Create Account')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:'0.78rem',color:'var(--mid)'}}>
          {mode==='login' ? (
            <span>Not a vendor yet?{' '}<span onClick={()=>{setMode('register');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Create account</span></span>
          ) : (
            <span>Already have an account?{' '}<span onClick={()=>{setMode('login');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Login</span></span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DATE PICKER ───────────────────────────────────────────────────────────────
// Single button that opens a dropdown with two modes: pick a day or pick a month
function DateRangePicker({dateFrom, dateTo, setDateFrom, setDateTo}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('day'); // 'day' | 'month'
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const ref = useRef();

  // Close on outside click
  useEffect(()=>{
    function handle(e){ if(ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  },[]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build label for the button
  function label() {
    if(!dateFrom) return 'Select date';
    if(mode==='month'||(!dateTo||dateTo===dateFrom)){
      // Check if it's a whole month
      if(dateTo && dateTo !== dateFrom) {
        const from = new Date(dateFrom), to = new Date(dateTo);
        if(from.getDate()===1) {
          const last = new Date(from.getFullYear(), from.getMonth()+1, 0);
          if(to.toISOString().split('T')[0] === last.toISOString().split('T')[0]) {
            return MONTHS[from.getMonth()].slice(0,3) + ' ' + from.getFullYear();
          }
        }
        return formatDateDisplay(dateFrom) + ' – ' + formatDateDisplay(dateTo);
      }
      return formatDateDisplay(dateFrom);
    }
    return formatDateDisplay(dateFrom) + (dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):'');
  }

  function selectDay(day) {
    const key = dateKey(viewYear, viewMonth, day);
    if(!dateFrom || (dateFrom && dateTo && dateFrom!==todayStr)) {
      // Start fresh selection
      setDateFrom(key); setDateTo(key);
    } else if(dateFrom && (!dateTo || dateTo===dateFrom)) {
      // Second click — set end date
      if(key < dateFrom) { setDateFrom(key); setDateTo(dateFrom); }
      else { setDateTo(key); }
      setOpen(false);
    } else {
      setDateFrom(key); setDateTo(key);
    }
  }

  function selectSingleDay(day) {
    const key = dateKey(viewYear, viewMonth, day);
    setDateFrom(key); setDateTo(key);
    setOpen(false);
  }

  function selectMonth(monthIdx, year) {
    const first = `${year}-${String(monthIdx+1).padStart(2,'0')}-01`;
    const lastDay = new Date(year, monthIdx+1, 0).getDate();
    const last = `${year}-${String(monthIdx+1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    setDateFrom(first); setDateTo(last);
    setOpen(false);
  }

  function clear() { setDateFrom(''); setDateTo(''); setOpen(false); }

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

  const hasSelection = !!dateFrom;
  const btnLabel = label();

  return (
    <div ref={ref} style={{position:'relative',gridColumn:'span 2'}}>
      <label style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:5,display:'block'}}>Wedding Date</label>
      <button
        type="button"
        onClick={()=>setOpen(o=>!o)}
        style={{
          width:'100%',border:`1.5px solid ${open?'var(--rose)':'var(--parchment)'}`,
          borderRadius:9,padding:'11px 14px',
          fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',
          color: hasSelection?'var(--charcoal)':'var(--light)',
          background:'var(--cream)',outline:'none',
          display:'flex',alignItems:'center',justifyContent:'space-between',
          cursor:'pointer',transition:'border-color 0.15s',
          textAlign:'left',
        }}
      >
        <span>📅 {btnLabel}</span>
        <span style={{fontSize:'0.7rem',color:'var(--light)',marginLeft:8}}>{open?'▲':'▼'}</span>
      </button>

      {open&&(
        <div style={{
          position:'absolute',top:'calc(100% + 6px)',left:0,right:0,
          background:'var(--white)',borderRadius:14,
          boxShadow:'0 8px 40px rgba(0,0,0,0.18)',
          border:'1px solid var(--parchment)',
          zIndex:500,overflow:'hidden',
        }}>
          {/* Mode tabs */}
          <div style={{display:'flex',borderBottom:'1px solid var(--parchment)'}}>
            {['day','month'].map(m=>(
              <button key={m} type="button" onClick={()=>setMode(m)} style={{
                flex:1,padding:'10px',border:'none',cursor:'pointer',
                fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:mode===m?600:400,
                background:mode===m?'var(--cream)':'var(--white)',
                color:mode===m?'var(--forest)':'var(--light)',
                borderBottom:mode===m?'2px solid var(--rose)':'2px solid transparent',
                transition:'all 0.15s',
              }}>
                {m==='day'?'📆 Specific day':'🗓 Whole month'}
              </button>
            ))}
          </div>

          {/* Nav row */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px 6px'}}>
            <button type="button" onClick={()=>{
              if(mode==='month'){setViewYear(y=>y-1);}
              else{let m=viewMonth-1,y=viewYear;if(m<0){m=11;y--;}setViewMonth(m);setViewYear(y);}
            }} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--mid)',padding:'2px 8px'}}>‹</button>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)'}}>
              {mode==='month'?viewYear:`${MONTHS[viewMonth].slice(0,3)} ${viewYear}`}
            </span>
            <button type="button" onClick={()=>{
              if(mode==='month'){setViewYear(y=>y+1);}
              else{let m=viewMonth+1,y=viewYear;if(m>11){m=0;y++;}setViewMonth(m);setViewYear(y);}
            }} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.1rem',color:'var(--mid)',padding:'2px 8px'}}>›</button>
          </div>

          {mode==='day'&&(
            <div style={{padding:'4px 12px 12px'}}>
              {/* Day of week headers */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
                {DOWS.map(d=><div key={d} style={{textAlign:'center',fontSize:'0.6rem',color:'var(--light)',fontWeight:500,padding:'3px 0',textTransform:'uppercase',letterSpacing:'0.06em'}}>{d}</div>)}
              </div>
              {/* Days grid */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
                {Array(firstDow).fill(null).map((_,i)=><div key={'e'+i}/>)}
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const key=dateKey(viewYear,viewMonth,day);
                  const isPast=key<todayStr;
                  const isFrom=key===dateFrom, isTo=key===dateTo;
                  const inRange=dateFrom&&dateTo&&key>dateFrom&&key<dateTo;
                  const isToday=key===todayStr;
                  return(
                    <div key={day}
                      onClick={()=>!isPast&&selectSingleDay(day)}
                      style={{
                        textAlign:'center',fontSize:'0.82rem',padding:'7px 3px',
                        borderRadius:7,cursor:isPast?'not-allowed':'pointer',
                        background:isFrom||isTo?'var(--forest)':inRange?'rgba(58,74,63,0.1)':'transparent',
                        color:isFrom||isTo?'var(--gold-light)':isPast?'var(--light)':'var(--charcoal)',
                        fontWeight:isFrom||isTo?700:isToday?600:400,
                        outline:isToday&&!isFrom&&!isTo?'1.5px solid var(--gold)':'none',
                        opacity:isPast?0.35:1,
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={e=>{if(!isPast&&!isFrom&&!isTo)e.currentTarget.style.background='var(--parchment)';}}
                      onMouseLeave={e=>{if(!isPast&&!isFrom&&!isTo)e.currentTarget.style.background=inRange?'rgba(58,74,63,0.1)':'transparent';}}
                    >{day}</div>
                  );
                })}
              </div>
              <div style={{fontSize:'0.7rem',color:'var(--light)',textAlign:'center',marginTop:8}}>Click a day to select it</div>
            </div>
          )}

          {mode==='month'&&(
            <div style={{padding:'6px 12px 14px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {MONTHS.map((m,i)=>{
                  const isPast=new Date(viewYear,i+1,0)<today;
                  const isSelected=dateFrom&&new Date(dateFrom).getMonth()===i&&new Date(dateFrom).getFullYear()===viewYear&&dateTo&&new Date(dateTo).getDate()===new Date(viewYear,i+1,0).getDate();
                  return(
                    <button key={m} type="button"
                      onClick={()=>!isPast&&selectMonth(i,viewYear)}
                      style={{
                        padding:'9px 6px',border:`1.5px solid ${isSelected?'var(--forest)':'var(--parchment)'}`,
                        borderRadius:8,cursor:isPast?'not-allowed':'pointer',
                        fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',
                        background:isSelected?'var(--forest)':'var(--cream)',
                        color:isSelected?'var(--gold-light)':isPast?'var(--light)':'var(--charcoal)',
                        fontWeight:isSelected?600:400,
                        opacity:isPast?0.4:1,
                        transition:'all 0.12s',
                      }}
                      onMouseEnter={e=>{if(!isPast&&!isSelected){e.currentTarget.style.background='var(--parchment)';e.currentTarget.style.borderColor='var(--blush)';}}}
                      onMouseLeave={e=>{if(!isPast&&!isSelected){e.currentTarget.style.background='var(--cream)';e.currentTarget.style.borderColor='var(--parchment)';}}}
                    >{m.slice(0,3)}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clear */}
          {hasSelection&&(
            <div style={{borderTop:'1px solid var(--parchment)',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'0.75rem',color:'var(--mid)'}}>
                {dateFrom&&dateTo&&dateFrom!==dateTo?`${formatDateDisplay(dateFrom)} → ${formatDateDisplay(dateTo)}`:dateFrom?formatDateDisplay(dateFrom):''}
              </span>
              <button type="button" onClick={clear} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--rose)',fontWeight:500}}>✕ Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── VENDOR CARD ───────────────────────────────────────────────────────────────
const VendorCard=memo(function VendorCard({vendor,unavail,dateFrom,dateTo,onClick,onRequestQuote,customerId=null,onFav=false}) {
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0),overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0,total=(vendor.fixed_rate||0)+travel+overnight,primaryImg=vendor.images?.[0]?.url;
  return (
    <div onClick={onClick} className="vf-vendor-card" style={{background:'var(--cream)',borderRadius:16,overflow:'hidden',boxShadow:'var(--card-shadow)',flex:'0 0 288px',width:288,position:'relative',cursor:'pointer',transition:'box-shadow 0.25s, transform 0.25s',filter:unavail?'saturate(0.3) opacity(0.75)':'none'}}
      onMouseEnter={e=>{if(!unavail){e.currentTarget.style.transform='translateY(-4px)';e.currentTarget.style.boxShadow='var(--card-shadow-hover)';}}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--card-shadow)';}}>
      {unavail&&<div style={{position:'absolute',inset:0,background:'rgba(250,246,241,0.85)',borderRadius:16,zIndex:5,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,backdropFilter:'blur(3px)'}}>
        <div style={{fontSize:'2rem'}}>📅</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',color:'var(--mid)',fontWeight:600,textAlign:'center',padding:'0 16px'}}>Unavailable for your date</div>
        <div style={{fontSize:'0.74rem',color:'var(--light)'}}>{dateFrom?formatDateDisplay(dateFrom):''}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</div>
        <div style={{fontSize:'0.74rem',color:'var(--rose)',marginTop:4}}>Tap to view profile →</div>
      </div>}
      <div className="vf-card-img" style={{height:160,position:'relative',background:primaryImg?`url(${primaryImg}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}ee 0%,${vendor.color||'#c8a87a'}66 100%),linear-gradient(160deg,#ede5db 0%,#d8ccc0 100%)`}}>
        <div className="vf-card-type-badge" style={{position:'absolute',top:10,left:10,background:'rgba(58,74,63,0.88)',color:'var(--gold-light)',fontSize:'0.62rem',letterSpacing:'0.1em',textTransform:'uppercase',padding:'3px 9px',borderRadius:999,backdropFilter:'blur(4px)',display:'flex',alignItems:'center',gap:5}}><span style={{display:'flex'}}>{(TYPE_ICON[vendor.type]||IC.camera)(11,'var(--gold-light)')}</span>{vendor.type}</div>
        <div style={{position:'absolute',top:8,right:8,display:'flex',gap:4,alignItems:'center'}}>
          {onFav&&<div onClick={e=>{e.stopPropagation();}} style={{background:'rgba(255,255,255,0.92)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center'}}><FavStar vendor={vendor} customerId={customerId}/></div>}
          {vendor.instagram&&<a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="vf-card-ig" style={{background:'rgba(255,255,255,0.92)',color:'var(--rose)',borderRadius:7,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.68rem',textDecoration:'none',fontWeight:700}}>ig</a>}
        </div>
      </div>
      <div className="vf-card-body" style={{padding:'16px 18px 18px'}}>
        <div className="vf-card-name" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.15rem',fontWeight:600,color:'var(--forest)',marginBottom:3}}>{vendor.name}</div>
        <div className="vf-card-location" style={{fontSize:'0.75rem',color:'var(--light)',marginBottom:10,display:'flex',alignItems:'center',gap:4}}><span style={{display:'flex'}}>{IC.pin(13,'var(--light)')}</span>{vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km away`:''}</div>
        <div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.6,marginBottom:12,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{vendor.description}</div>
        {isOnRequest(vendor)?(
          <div className="vf-card-pricing" style={{background:'var(--cream)',borderRadius:9,padding:'10px 12px',display:'flex',flexDirection:'column',gap:4}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
              <span style={{fontSize:'0.7rem',color:'var(--mid)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Full pricing</span>
              <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--rose)',fontStyle:'italic'}}>On Request</span>
            </div>
            {(vendor.distance_km>0)&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Travel ({vendor.distance_km||0} km × R{vendor.per_km_rate}/km)</span><span style={{fontWeight:500}}>{fmt(travel)}</span></div>}
            {overnight>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Overnight fee</span><span style={{fontWeight:500}}>{fmt(overnight)}</span></div>}
          </div>
        ):(
          <div className="vf-card-pricing" style={{background:'var(--cream)',borderRadius:9,padding:'10px 12px',display:'flex',flexDirection:'column',gap:4}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Base rate</span><span style={{fontWeight:500}}>{fmt(vendor.fixed_rate)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Travel ({vendor.distance_km||0} km × R{vendor.per_km_rate}/km)</span><span style={{fontWeight:500}}>{fmt(travel)}</span></div>
            {overnight>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem'}}><span style={{color:'var(--mid)'}}>Overnight fee</span><span style={{fontWeight:500}}>{fmt(overnight)}</span></div>}
            <div style={{borderTop:'1px solid var(--parchment)',marginTop:3,paddingTop:4,display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--forest)',fontWeight:600,fontSize:'0.78rem'}}>Estimated total</span><span style={{color:'var(--rose)',fontWeight:700,fontSize:'0.84rem'}}>{fmt(total)}</span></div>
          </div>
        )}
        <div className="vf-card-btns" style={{marginTop:12,display:'flex',gap:8}}>
          <button style={{flex:1,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:9,fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',fontWeight:500,letterSpacing:'0.04em',cursor:'pointer'}} onClick={e=>{e.stopPropagation();onClick();}}>View profile</button>
          <button style={{flex:1,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:9,fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',fontWeight:500,letterSpacing:'0.04em',cursor:'pointer'}} onClick={e=>{e.stopPropagation();if(onRequestQuote)onRequestQuote();}}>Request Quote</button>
        </div>
      </div>
    </div>
  );
});

// ── VENDOR DETAIL ─────────────────────────────────────────────────────────────
function VendorDetail({vendor,dateFrom,dateTo,venueLabel,venueLatLng,onBack,onRequestQuote}) {
  const [calYear,setCalYear]=useState(()=>dateFrom?parseInt(dateFrom.split('-')[0]):new Date().getFullYear());
  const [calMonth,setCalMonth]=useState(()=>dateFrom?parseInt(dateFrom.split('-')[1])-1:new Date().getMonth());
  const [enquirySent,setEnquirySent]=useState(false);
  const [enquiryForm,setEnquiryForm]=useState({name:'',email:'',message:''});
  const [enquirySending,setEnquirySending]=useState(false);
  const [enquiryError,setEnquiryError]=useState('');
  const unavailSet=new Set((vendor.unavail_dates||[]).map(d=>d.date));
  const isUnavail=dateFrom&&(vendor.unavail_dates||[]).some(d=>{const dd=d.date;return dd>=dateFrom&&(!dateTo||dd<=dateTo);});
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0),overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0,total=(vendor.fixed_rate||0)+travel+overnight;
  const galleryImgs=vendor.images||[];
  return (
    <div style={{background:'var(--cream)',minHeight:'100vh'}}>
      <button onClick={onBack} style={{display:'inline-flex',alignItems:'center',gap:8,margin:'24px 32px 0',background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back to results</button>
      {isUnavail&&<div style={{display:'flex',alignItems:'center',gap:12,background:'#f5e8e4',border:'1.5px solid #e0b8a8',borderRadius:12,padding:'14px 20px',margin:'20px 32px 0'}}><span style={{fontSize:'1.4rem'}}>📅</span><div><div style={{fontSize:'0.88rem',color:'var(--deep-rose)',fontWeight:500}}>Unavailable on your wedding date</div><div style={{fontSize:'0.78rem',color:'var(--rose)'}}>This vendor is already booked during your selected dates.</div></div></div>}
      <div className="vf-vendor-detail-hero" style={{position:'relative',height:300,overflow:'hidden',marginTop:16,background:galleryImgs[0]?.url?`url(${galleryImgs[0].url}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}ff,${vendor.color||'#c8a87a'}88)`}}>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(22,32,24,0.88) 0%,rgba(22,32,24,0.08) 60%)'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'28px 32px'}}>
          <div style={{display:'inline-block',background:'rgba(201,169,110,0.18)',border:'1px solid var(--gold)',color:'var(--gold-light)',fontSize:'0.68rem',letterSpacing:'0.14em',textTransform:'uppercase',padding:'4px 12px',borderRadius:999,marginBottom:10}}>{vendor.type}</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(1.8rem,4vw,2.6rem)',fontWeight:400,color:'var(--cream)',lineHeight:1.1,marginBottom:6}}>{vendor.name}</div>
          <div style={{fontSize:'0.82rem',color:'rgba(250,246,241,0.65)'}}>📍 {vendor.location}{venueLabel&&vendor.distance_km?` · ${vendor.distance_km} km from ${venueLabel}`:''}</div>
        </div>
      </div>
      <div className="vf-vendor-detail-grid" style={{maxWidth:1040,margin:'0 auto',padding:'32px 32px 60px',display:'grid',gridTemplateColumns:'1fr 340px',gap:36}}>
        <div>
          <section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>About this vendor</h3><p style={{fontSize:'0.92rem',color:'var(--mid)',lineHeight:1.85}}>{vendor.description} {vendor.extra_info}</p></section>
          {galleryImgs.length>0&&<section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Gallery</h3><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>{galleryImgs.slice(0,4).map((img,i)=><div key={i} style={{borderRadius:10,height:90,background:img.url?`url(${img.url}) center/cover`:`linear-gradient(${140+i*30}deg,${vendor.color||'#c8a87a'}dd,${vendor.color||'#c8a87a'}44)`}}/>)}</div></section>}
          <section style={{marginBottom:28}}>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>{venueLatLng&&vendor.lat?'Route from your venue':'Vendor location'}</h3>
            {venueLatLng&&vendor.distance_km&&<div style={{display:'flex',gap:12,marginBottom:14,flexWrap:'wrap'}}>
              {[['🚗','Distance',`${vendor.distance_km} km`],['💰','Travel cost',fmt(travel)],...(overnight>0?[['🌙','Overnight fee',fmt(overnight)]]:[])]
                .map(([icon,label,val],i)=><div key={i} style={{background:'var(--white)',borderRadius:10,padding:'10px 16px',boxShadow:'var(--card-shadow)',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:'1.2rem'}}>{icon}</span><div><div style={{fontSize:'0.7rem',color:'var(--light)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{label}</div><div style={{fontSize:'0.92rem',fontWeight:600,color:'var(--rose)'}}>{val}</div></div></div>)}
            </div>}
            <DetailMap vendor={vendor} venueLatLng={venueLatLng}/>
          </section>
          <section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Availability Calendar</h3><Calendar year={calYear} month={calMonth} unavailDates={unavailSet} weddingDate={dateFrom} onPrev={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);}} onNext={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);}}/></section>
          {vendor.instagram&&<section style={{marginBottom:28}}><h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--parchment)'}}>Follow on Instagram</h3><a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:12,background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:12,padding:'14px 20px',textDecoration:'none'}}><div style={{width:38,height:38,borderRadius:10,background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none"/></svg></div><div><div style={{fontSize:'0.92rem',fontWeight:500,color:'var(--charcoal)'}}>{vendor.instagram}</div><div style={{fontSize:'0.72rem',color:'var(--light)'}}>View on Instagram</div></div></a></section>}
          {isOnRequest(vendor)&&(
            <section>
              <div style={{display:'flex',alignItems:'flex-start',gap:12,background:'rgba(201,169,110,0.07)',border:'1px solid rgba(201,169,110,0.25)',borderRadius:12,padding:'14px 18px'}}>
                <span style={{fontSize:'1.2rem',flexShrink:0}}>ℹ️</span>
                <div>
                  <div style={{fontWeight:600,color:'var(--forest)',fontSize:'0.86rem',marginBottom:4}}>Pricing Disclaimer</div>
                  <div style={{fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.65}}>
                    The costs displayed above reflect <strong>travel and overnight fees only</strong>, calculated based on the distance from this vendor's home base to your venue. Full product and service pricing for {vendor.type} is <strong>on request</strong> — after you submit your quote request, the vendor will review your requirements and respond with a personalised quote.
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
        <div>
          <div className="vf-vendor-detail-sticky" style={{background:'var(--white)',borderRadius:16,padding:24,boxShadow:'var(--card-shadow)',position:'sticky',top:80}}>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',color:'var(--forest)',marginBottom:4}}>
              {isOnRequest(vendor)?'Request a Quote':'Pricing Estimate'}
            </h3>
            <button onClick={()=>onRequestQuote&&onRequestQuote(vendor)} style={{width:'100%',marginBottom:14,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:600,cursor:'pointer',letterSpacing:'0.04em'}}>💌 {isOnRequest(vendor)?'Request a Quote':'Request a Quote'}</button>
            {isOnRequest(vendor)?(
              <>
                {/* On Request banner */}
                <div style={{background:'rgba(196,130,106,0.06)',borderRadius:10,padding:'12px 14px',marginBottom:14,border:'1px solid rgba(196,130,106,0.15)',textAlign:'center'}}>
                  <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:4}}>Full Pricing</div>
                  <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--rose)',fontStyle:'italic',marginBottom:4}}>On Request</div>
                  <div style={{fontSize:'0.74rem',color:'var(--mid)'}}>Submit the questionnaire and the vendor will respond with a personalised quote.</div>
                </div>
                {/* Travel costs still shown */}
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:10}}>{venueLabel?`Venue: ${venueLabel}`:'Add a venue to see travel costs'}</p>
                {[...(travel>0?[[`Travel (${vendor.distance_km||0} km × R${vendor.per_km_rate}/km)`,fmt(travel)]]:[[`Travel rate`,`R${vendor.per_km_rate||0}/km`]]), ...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])].map(([l,v],i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--parchment)',fontSize:'0.84rem'}}>
                    <span style={{color:'var(--mid)'}}>{l}</span><span style={{fontWeight:500}}>{v}</span>
                  </div>
                ))}
                {overnight>0&&<div style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:10,background:'rgba(196,130,106,0.08)',color:'var(--rose)',fontSize:'0.74rem',padding:'5px 11px',borderRadius:8,border:'1px solid rgba(196,130,106,0.22)'}}>🌙 Overnight stay may be required</div>}
              </>
            ):(
              <>
                <p style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:18}}>{venueLabel?`Venue: ${venueLabel}`:'Based on your venue location'}</p>
                {[['Base rate',fmt(vendor.fixed_rate)],[`Travel (${vendor.distance_km||0} km × R${vendor.per_km_rate}/km)`,fmt(travel)],...(overnight>0?[['Overnight fee',fmt(overnight)]]:[])].map(([l,v],i)=><div key={i} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--parchment)',fontSize:'0.84rem'}}><span style={{color:'var(--mid)'}}>{l}</span><span style={{fontWeight:500}}>{v}</span></div>)}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14,paddingTop:14,borderTop:'2px solid var(--parchment)'}}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',fontWeight:600}}>Total estimate</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',color:'var(--rose)',fontWeight:600}}>{fmt(total)}</span></div>
                {overnight>0&&<div style={{display:'inline-flex',alignItems:'center',gap:5,marginTop:12,background:'rgba(196,130,106,0.08)',color:'var(--rose)',fontSize:'0.74rem',padding:'5px 11px',borderRadius:8,border:'1px solid rgba(196,130,106,0.22)'}}>🌙 Overnight stay required</div>}
              </>
            )}
            {!enquirySent?(
              <>
                <div style={{borderTop:'1px solid var(--parchment)',marginTop:16,paddingTop:16}}>
                  <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>Send an Enquiry</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    <input value={enquiryForm.name} onChange={e=>setEnquiryForm(f=>({...f,name:e.target.value}))} placeholder="Your name" style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
                    <input value={enquiryForm.email} onChange={e=>setEnquiryForm(f=>({...f,email:e.target.value}))} placeholder="Your email" type="email" style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
                    <textarea value={enquiryForm.message} onChange={e=>setEnquiryForm(f=>({...f,message:e.target.value}))} placeholder="Tell the vendor about your wedding…" rows={3} style={{border:'1.5px solid var(--parchment)',borderRadius:7,padding:'8px 11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.83rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%',resize:'vertical'}}/>
                  </div>
                  {enquiryError&&<div style={{fontSize:'0.76rem',color:'var(--rose)',marginTop:6}}>{enquiryError}</div>}
                </div>
                <button
                  disabled={isUnavail||enquirySending}
                  onClick={async()=>{
                    if(!enquiryForm.name||!enquiryForm.email){setEnquiryError('Please enter your name and email.');return;}
                    setEnquirySending(true);setEnquiryError('');
                    try{
                      await supaFetch('enquiries',{method:'POST',body:JSON.stringify({
                        vendor_id:vendor.id,
                        customer_name:enquiryForm.name,
                        customer_email:enquiryForm.email,
                        message:enquiryForm.message,
                        wedding_date:dateFrom||null,
                        venue:venueLabel||null,
                      }),prefer:'return=minimal'});
                      setEnquirySent(true);
                    }catch(e){setEnquiryError('Could not send enquiry. Please try again.');}
                    setEnquirySending(false);
                  }}
                  style={{width:'100%',marginTop:12,background:isUnavail?'var(--light)':'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:12,fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:(isUnavail||enquirySending)?'not-allowed':'pointer',letterSpacing:'0.04em'}}>
                  {enquirySending?'Sending…':isUnavail?'Unavailable for your dates':'Send Enquiry'}
                </button>
              </>
            ):(
              <div style={{textAlign:'center',padding:'16px 12px',background:'rgba(58,74,63,0.07)',borderRadius:10,marginTop:16}}>
                <div style={{fontSize:'1.5rem',marginBottom:6}}>✓</div>
                <div style={{fontSize:'0.88rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>Enquiry sent!</div>
                <div style={{fontSize:'0.78rem',color:'var(--mid)'}}>The vendor will be in touch at <strong>{enquiryForm.email}</strong></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VENDOR LANE ───────────────────────────────────────────────────────────────
function VendorLane({type,vendors,dateFrom,dateTo,onOpenDetail,isLast,onRequestQuote,customerId=null,initialMaxPrice=null}) {
  // On-request categories have no fixed pricing — skip the price slider entirely
  const allOnRequest = ON_REQUEST_TYPES.has(type);
  const totals=vendors.map(v=>calcTotal(v));
  const maxT=Math.max(...totals,1000),minT=Math.min(...totals,0),avgT=avg(totals),sliderMax=Math.ceil(maxT*1.15/1000)*1000;
  const [maxPrice,setMaxPrice]=useState(()=>initialMaxPrice!==null?Math.min(initialMaxPrice,sliderMax):sliderMax);
  const pct=Math.round(((maxPrice-minT)/(sliderMax-minT))*100),avgPct=avgT>0?Math.round(((avgT-minT)/(sliderMax-minT))*100):0;
  const visible=allOnRequest?vendors:vendors.filter(v=>calcTotal(v)<=maxPrice);
  return (
    <div className="vf-lane-wrapper" style={{marginBottom:12,background:'#ffffff'}}>
      <div className="vf-lane-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',marginBottom:16,flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <span style={{display:'flex',color:'var(--forest)'}}>{(TYPE_ICON[type]||IC.camera)(20,'var(--forest)')}</span>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
          <span style={{fontSize:'0.75rem',color:'var(--light)',background:'var(--parchment)',padding:'3px 10px',borderRadius:999}}>{visible.length} of {vendors.length} vendor{vendors.length!==1?'s':''}</span>
          {allOnRequest&&<span style={{fontSize:'0.72rem',color:'var(--rose)',fontStyle:'italic',fontWeight:500}}>On Request</span>}
        </div>
        {!allOnRequest&&(
          <div style={{background:'var(--white)',borderRadius:10,padding:'10px 18px',boxShadow:'var(--card-shadow)',display:'flex',flexDirection:'column',gap:6,minWidth:260}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span style={{fontSize:'0.7rem',letterSpacing:'0.09em',textTransform:'uppercase',color:'var(--mid)'}}>Max price</span><span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--rose)'}}>{fmt(maxPrice)}</span></div>
            <div style={{position:'relative'}}>
              <input type="range" min={minT} max={sliderMax} step={500} value={maxPrice} onChange={e=>setMaxPrice(parseInt(e.target.value))} style={{width:'100%',WebkitAppearance:'none',appearance:'none',height:4,borderRadius:2,outline:'none',cursor:'pointer',background:`linear-gradient(to right,var(--rose) 0%,var(--rose) ${pct}%,var(--parchment) ${pct}%,var(--parchment) 100%)`}}/>
              <div style={{position:'absolute',top:-3,left:`${avgPct}%`,transform:'translateX(-50%)',width:2,height:10,background:'var(--gold)',borderRadius:1,pointerEvents:'none'}}/>
            </div>
            <div style={{fontSize:'0.72rem',color:'var(--light)',display:'flex',alignItems:'center',gap:4}}><span>Avg. for this category:</span><span style={{color:'var(--gold)',fontWeight:500}}>{fmt(avgT)}</span></div>
          </div>
        )}
      </div>
      <div style={{position:'relative'}}>
        <div className="vf-lane-fade-left" style={{position:'absolute',top:0,bottom:20,left:0,width:40,background:'linear-gradient(to right,#ffffff,transparent)',zIndex:10,pointerEvents:'none'}}/>
        <div className="vf-lane-fade-right" style={{position:'absolute',top:0,bottom:20,right:0,width:40,background:'linear-gradient(to left,#ffffff,transparent)',zIndex:10,pointerEvents:'none'}}/>
        <div style={{display:'flex',gap:20,overflowX:'auto',padding:'4px 32px 20px',scrollbarWidth:'none'}}>
          {vendors.map(v=>{
            const ok=allOnRequest||calcTotal(v)<=maxPrice;
            const unavail=dateFrom&&(v.unavail_dates||[]).some(d=>{const dd=d.date;return dd>=dateFrom&&(!dateTo||dd<=dateTo);});
            if(!ok)return null;
            return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo} onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)} customerId={customerId} onFav={!!customerId}/>;
          })}
          {visible.length===0&&<div style={{padding:'24px 0',fontSize:'0.85rem',color:'var(--light)',fontStyle:'italic'}}>No vendors match this price filter.</div>}
        </div>
      </div>
      {!isLast&&<hr className="vf-lane-divider" style={{border:'none',borderTop:'1px solid var(--parchment)',margin:'8px 32px 40px'}}/>}
    </div>
  );
}

// ── VENDOR FORM (shared by dashboard + admin) ─────────────────────────────────
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
          <div style={{gridColumn:'1/-1'}}><label style={labelStyle}>Home Base Location</label><input ref={locRef} style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Start typing your address…"/>{latLng&&<div style={{fontSize:'0.72rem',color:'var(--forest)',marginTop:5}}>✓ Location pinned ({latLng.lat.toFixed(4)}, {latLng.lng.toFixed(4)})</div>}</div>
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
        <div style={{marginTop:14,background:'var(--parchment)',borderRadius:8,padding:'12px 16px',fontSize:'0.8rem',color:'var(--mid)'}}>💡 Travel cost = driving distance from your home base to the customer's venue × your per km rate.</div>
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
      {saved&&<div style={{textAlign:'center',color:'var(--forest)',fontSize:'0.88rem',marginTop:12,padding:10,background:'rgba(58,74,63,0.07)',borderRadius:8}}>✓ Profile saved successfully!</div>}
    </div>
  );
}

// ── VENDOR DASHBOARD (logged-in vendor) ───────────────────────────────────────
function VendorDashboard({user,onLogout}) {
  const [myVendors,setMyVendors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [editData,setEditData]=useState(null);
  const [leads,setLeads]=useState([]);
  const [leadsLoading,setLeadsLoading]=useState(false);
  const [activeLead,setActiveLead]=useState(null);
  const [activeVendorForCal,setActiveVendorForCal]=useState(null);
  const [unavailDates,setUnavailDates]=useState(new Set());
  const [calSaving,setCalSaving]=useState(false);
  const [calSaved,setCalSaved]=useState(false);
  const [cal1Y,setCal1Y]=useState(new Date().getFullYear());
  const [cal1M,setCal1M]=useState(new Date().getMonth());
  const [cal2Y,setCal2Y]=useState(()=>{const d=new Date();return d.getMonth()===11?d.getFullYear()+1:d.getFullYear();});
  const [cal2M,setCal2M]=useState(()=>{const m=new Date().getMonth();return m===11?0:m+1;});

  useEffect(()=>{loadMyVendors();},[]);
  useEffect(()=>{if(myVendors.length>0)loadLeads();},[myVendors]);

  async function loadMyVendors(){
    setLoading(true);
    try{
      const data=await supaFetch(`vendors?user_id=eq.${user.userId}&select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=name`);
      setMyVendors(data);
      if(data.length>0){
        setActiveVendorForCal(data[0]);
        setUnavailDates(new Set((data[0].unavail_dates||[]).map(d=>d.date)));
      }
    }catch(e){console.error(e);}
    setLoading(false);
  }

  async function loadLeads(){
    setLeadsLoading(true);
    try{
      const vendorIds=myVendors.map(v=>v.id);
      if(vendorIds.length===0){setLeads([]);setLeadsLoading(false);return;}
      const data=await supaFetch(`leads?vendor_id=in.(${vendorIds.join(',')})&select=*,customer:customers(name,email)&order=created_at.desc`);
      const withMsgs=await Promise.all((data||[]).map(async lead=>{
        try{
          const msgs=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);
          return{...lead,last_message:Array.isArray(msgs)?msgs[0]:null,customer_name:lead.customer?.name||'Customer',vendor_name:myVendors.find(v=>v.id===lead.vendor_id)?.name||''};
        }catch{return{...lead,customer_name:lead.customer?.name||'Customer'};}
      }));
      setLeads(withMsgs);
    }catch(e){setLeads([]);}
    setLeadsLoading(false);
  }

  function selectVendorForCal(v){
    setActiveVendorForCal(v);
    setUnavailDates(new Set((v.unavail_dates||[]).map(d=>d.date)));
    setCalSaved(false);
  }

  function toggleUnavail(key){setUnavailDates(prev=>{const next=new Set(prev);next.has(key)?next.delete(key):next.add(key);return next;});}

  async function saveAvailability(){
    if(!activeVendorForCal)return;
    setCalSaving(true);
    try{
      const id=activeVendorForCal.id;
      await supaFetch(`vendor_unavailable_dates?vendor_id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});
      if(unavailDates.size>0)await supaFetch('vendor_unavailable_dates',{method:'POST',body:JSON.stringify([...unavailDates].map(date=>({vendor_id:id,date}))),prefer:'return=minimal'});
      setCalSaved(true);setTimeout(()=>setCalSaved(false),3000);
      loadMyVendors();
    }catch(e){alert('Save failed: '+e.message);}
    setCalSaving(false);
  }

  async function deleteVendor(id){
    if(!window.confirm('Delete this vendor profile? This cannot be undone.'))return;
    try{await supaFetch(`vendors?id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});loadMyVendors();}
    catch(e){alert('Delete failed: '+e.message);}
  }

  function startEdit(v){setEditData({...v,_unavailDates:(v.unavail_dates||[]).map(d=>d.date)});setEditing(v.id);}

  // ── Editing view ──────────────────────────────────────────────────────────
  if(editing==='new')return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back to dashboard</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Add New Vendor Profile</h2>
      <VendorForm userId={user.userId} onSaved={()=>{setEditing(null);loadMyVendors();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(editing&&editData)return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back to dashboard</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Edit: {editData.name}</h2>
      <VendorForm initialData={editData} vendorId={editing} userId={user.userId} onSaved={()=>{setEditing(null);loadMyVendors();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(activeLead)return(
    <div style={{padding:'24px 28px',maxWidth:860,margin:'0 auto'}}>
      <ChatThread
        lead={{...activeLead,customer_name:activeLead.customer?.name||'Customer',vendor_name:myVendors.find(v=>v.id===activeLead.vendor_id)?.name||''}}
        currentRole="vendor"
        currentName={user.email}
        onBack={()=>{setActiveLead(null);loadLeads();}}
      />
    </div>
  );

  const STATUS_COLOR={'new':'#c9a96e','responded':'#3a7a5a','closed':'#a8a8a8'};
  const STATUS_BG={'new':'rgba(201,169,110,0.1)','responded':'rgba(58,122,90,0.1)','closed':'rgba(168,168,168,0.1)'};
  const newLeadsCount=leads.filter(l=>l.status==='new').length;

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>

      {/* Dashboard header */}
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'20px 32px',boxShadow:'0 2px 12px rgba(0,0,0,0.04)'}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <div>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:400,color:'var(--forest)',marginBottom:2}}>Vendor Dashboard</h2>
            <p style={{color:'var(--light)',fontSize:'0.8rem'}}>{user.email}</p>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setEditing('new')} style={{background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:'9px 18px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>+ Add Vendor</button>
            <button onClick={onLogout} style={{background:'var(--parchment)',color:'var(--mid)',border:'none',borderRadius:8,padding:'9px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',cursor:'pointer'}}>Logout</button>
          </div>
        </div>
      </div>

      {/* Main dashboard grid */}
      <div style={{maxWidth:1200,margin:'0 auto',padding:'28px 28px 60px',display:'grid',gridTemplateColumns:'1fr 380px',gap:24,alignItems:'start'}}>

        {/* LEFT COLUMN */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>

          {/* ── VENDOR PROFILE SECTION ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>🏪 My Vendor Profile</div>
            </div>
            <div style={{padding:'16px 22px'}}>
              {loading?<div style={{textAlign:'center',padding:'30px',color:'var(--light)'}}>Loading…</div>:
                myVendors.length===0?(
                  <div style={{textAlign:'center',padding:'30px 16px'}}>
                    <div style={{fontSize:'2rem',marginBottom:8}}>🌿</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',marginBottom:6}}>No vendor profiles yet</div>
                    <p style={{color:'var(--mid)',fontSize:'0.84rem',marginBottom:14}}>Create your first profile to appear in searches.</p>
                    <button onClick={()=>setEditing('new')} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'9px 20px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.84rem',cursor:'pointer'}}>Create profile</button>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {myVendors.map(v=>(
                      <div key={v.id} onClick={()=>startEdit(v)}
                        style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:10,border:'1.5px solid var(--parchment)',cursor:'pointer',transition:'border-color 0.15s,background 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--rose)';e.currentTarget.style.background='rgba(196,130,106,0.04)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--parchment)';e.currentTarget.style.background='';}}>
                        <div style={{width:48,height:48,borderRadius:9,background:v.images?.[0]?.url?`url(${v.images[0].url}) center/cover`:`linear-gradient(135deg,${v.color||'#c8a87a'}dd,${v.color||'#c8a87a'}66)`,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)'}}>{v.name}</div>
                          <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:1}}>{TYPE_EMOJI[v.type]} {v.type} · 📍 {v.location}</div>
                          <div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:1}}>Base: {fmt(v.fixed_rate)} · R{v.per_km_rate}/km</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button onClick={e=>{e.stopPropagation();startEdit(v);}} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:6,padding:'6px 12px',fontSize:'0.75rem',cursor:'pointer'}}>✏️ Edit</button>
                          <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:6,padding:'6px 10px',fontSize:'0.75rem',cursor:'pointer'}}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* ── LEADS & CONVERSATIONS ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>
                💌 Leads & Conversations
                {newLeadsCount>0&&<span style={{marginLeft:8,background:'var(--rose)',color:'white',borderRadius:999,fontSize:'0.68rem',padding:'2px 8px',fontWeight:600}}>{newLeadsCount} new</span>}
              </div>
              <button onClick={loadLeads} style={{background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--mid)'}}>↻ Refresh</button>
            </div>
            <div style={{padding:'12px 22px 16px'}}>
              {leadsLoading?<div style={{textAlign:'center',padding:'24px',color:'var(--light)'}}>Loading leads…</div>:
                leads.length===0?(
                  <div style={{textAlign:'center',padding:'32px 16px'}}>
                    <div style={{fontSize:'2rem',marginBottom:8}}>📭</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',color:'var(--forest)',marginBottom:4}}>No leads yet</div>
                    <p style={{color:'var(--mid)',fontSize:'0.82rem'}}>When customers request quotes from your profile, they'll appear here.</p>
                  </div>
                ):(
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {leads.map(lead=>(
                      <div key={lead.id} onClick={()=>setActiveLead(lead)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:10,border:'1.5px solid var(--parchment)',cursor:'pointer',transition:'all 0.15s'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--gold)';e.currentTarget.style.background='rgba(201,169,110,0.04)';}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--parchment)';e.currentTarget.style.background='';}}>
                        <div style={{width:36,height:36,borderRadius:8,background:STATUS_BG[lead.status]||STATUS_BG.new,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',flexShrink:0}}>
                          {lead.status==='responded'?'💬':lead.status==='closed'?'✅':'💌'}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'0.88rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.title}</div>
                          <div style={{fontSize:'0.74rem',color:'var(--mid)',marginTop:1}}>👤 {lead.customer_name}</div>
                          {lead.last_message&&<div style={{fontSize:'0.72rem',color:'var(--light)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.last_message.sender_role==='customer'?lead.customer_name+': ':''}{ lead.last_message.message_text||'📎 Attachment'}</div>}
                        </div>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4,flexShrink:0}}>
                          <span style={{background:STATUS_BG[lead.status]||STATUS_BG.new,color:STATUS_COLOR[lead.status]||STATUS_COLOR.new,borderRadius:999,fontSize:'0.65rem',padding:'2px 8px',fontWeight:600,textTransform:'uppercase'}}>{lead.status||'new'}</span>
                          <span style={{fontSize:'0.68rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

        </div>{/* end LEFT COLUMN */}

        {/* RIGHT COLUMN */}
        <div style={{display:'flex',flexDirection:'column',gap:24}}>

          {/* ── AVAILABILITY CALENDAR ── */}
          <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
            <div style={{padding:'16px 22px',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--forest)',fontWeight:600}}>📅 Availability</div>
              {myVendors.length>1&&(
                <select value={activeVendorForCal?.id||''} onChange={e=>{const v=myVendors.find(x=>x.id===e.target.value);if(v)selectVendorForCal(v);}}
                  style={{fontSize:'0.76rem',border:'1px solid var(--parchment)',borderRadius:6,padding:'4px 8px',background:'var(--cream)',color:'var(--charcoal)',cursor:'pointer'}}>
                  {myVendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              )}
            </div>
            <div style={{padding:'14px 16px'}}>
              {myVendors.length===0?(
                <div style={{textAlign:'center',padding:'20px',color:'var(--light)',fontSize:'0.84rem'}}>Create a vendor profile first.</div>
              ):(
                <>
                  {activeVendorForCal&&(
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'8px 10px',background:'var(--cream)',borderRadius:8}}>
                      <div style={{width:32,height:32,borderRadius:7,background:activeVendorForCal.images?.[0]?.url?`url(${activeVendorForCal.images[0].url}) center/cover`:`linear-gradient(135deg,${activeVendorForCal.color||'#c8a87a'}dd,${activeVendorForCal.color||'#c8a87a'}66)`,flexShrink:0}}/>
                      <div style={{fontSize:'0.82rem',fontWeight:500,color:'var(--forest)'}}>{activeVendorForCal.name}</div>
                      <div style={{marginLeft:'auto',fontSize:'0.74rem',color:'var(--rose)',fontWeight:500}}>{unavailDates.size} blocked</div>
                    </div>
                  )}
                  <p style={{fontSize:'0.74rem',color:'var(--mid)',marginBottom:10}}>Click a date to block/unblock it.</p>
                  <Calendar year={cal1Y} month={cal1M} unavailDates={unavailDates} editable onToggle={toggleUnavail}
                    onPrev={()=>{let m=cal1M-1,y=cal1Y;if(m<0){m=11;y--;}setCal1M(m);setCal1Y(y);}}
                    onNext={()=>{let m=cal1M+1,y=cal1Y;if(m>11){m=0;y++;}setCal1M(m);setCal1Y(y);}}/>
                  <div style={{marginTop:12,display:'flex',alignItems:'center',gap:10}}>
                    <button onClick={saveAvailability} disabled={calSaving} style={{flex:1,background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:8,padding:'9px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.84rem',fontWeight:500,cursor:calSaving?'wait':'pointer'}}>
                      {calSaving?'Saving…':'Save'}
                    </button>
                    {calSaved&&<span style={{fontSize:'0.8rem',color:'var(--forest)',fontWeight:500}}>✓ Saved!</span>}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>{/* end RIGHT COLUMN */}

      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
// ── ON-REQUEST PRICING PANEL (admin) ─────────────────────────────────────────
function OnRequestPricingPanel() {
  const [averages, setAverages] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const ON_REQ_LIST = [...ON_REQUEST_TYPES];

  useEffect(()=>{
    loadAverages();
  },[]);

  async function loadAverages(){
    setLoading(true);
    try{
      const keys = ON_REQ_LIST.map(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`);
      const data = await supaFetch(`app_settings?key=in.(${keys.map(k=>`"${k}"`).join(',')})&select=key,value`);
      const map = {};
      (data||[]).forEach(row=>{
        // reverse-map key back to type
        const type = ON_REQ_LIST.find(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`===row.key);
        if(type) map[type] = row.value;
      });
      setAverages(map);
    }catch(e){
      setError('Could not load settings. Run the SQL below to create the app_settings table first.');
    }
    setLoading(false);
  }

  async function saveAverages(){
    setSaving(true); setError(''); setSaved(false);
    try{
      for(const type of ON_REQ_LIST){
        const key = `onreq_avg_${type.replace(/[^a-zA-Z0-9]/g,'_')}`;
        const value = averages[type]||'0';
        // Upsert — insert or update
        await supaFetch('app_settings', {
          method:'POST',
          body: JSON.stringify({key, value, updated_at: new Date().toISOString()}),
          prefer: 'resolution=merge-duplicates,return=minimal',
          headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},
        });
      }
      setSaved(true);
      setTimeout(()=>setSaved(false), 3000);
    }catch(e){
      setError('Save failed: '+e.message);
    }
    setSaving(false);
  }

  return(
    <div style={{padding:'32px',maxWidth:680,margin:'0 auto'}}>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',color:'var(--forest)',fontWeight:400,marginBottom:6}}>On Request Average Pricing</h2>
      <p style={{color:'var(--mid)',fontSize:'0.86rem',marginBottom:24,lineHeight:1.65}}>
        Set the average market cost for each On Request vendor type. These figures are used in the <strong>Wedding Plan</strong> feature to give customers a recommended spend for categories where pricing is not listed on vendor profiles.
      </p>

      {/* SQL setup notice */}
      <div style={{background:'rgba(201,169,110,0.08)',border:'1px solid rgba(201,169,110,0.25)',borderRadius:10,padding:'14px 16px',marginBottom:24,fontSize:'0.8rem',color:'var(--mid)',lineHeight:1.7}}>
        <strong style={{color:'var(--forest)'}}>⚙️ First-time setup:</strong> Run this SQL in Supabase if you haven't already:
        <code style={{display:'block',marginTop:8,background:'rgba(58,74,63,0.06)',padding:'10px 12px',borderRadius:6,fontFamily:'monospace',fontSize:'0.75rem',color:'var(--forest)',lineHeight:1.8}}>
          CREATE TABLE IF NOT EXISTS app_settings (<br/>
          &nbsp;&nbsp;key TEXT PRIMARY KEY,<br/>
          &nbsp;&nbsp;value TEXT,<br/>
          &nbsp;&nbsp;updated_at TIMESTAMPTZ DEFAULT now()<br/>
          );<br/>
          ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;<br/>
          GRANT ALL ON app_settings TO anon;
        </code>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'40px',color:'var(--light)'}}>Loading…</div>
      ) : (
        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',overflow:'hidden'}}>
          <div style={{padding:'0'}}>
            {ON_REQ_LIST.map((type, idx)=>(
              <div key={type} style={{display:'flex',alignItems:'center',gap:16,padding:'18px 24px',borderBottom:idx<ON_REQ_LIST.length-1?'1px solid var(--parchment)':'none'}}>
                <div style={{fontSize:'1.4rem',width:32,textAlign:'center'}}>{TYPE_EMOJI[type]}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)',marginBottom:3}}>{type}</div>
                  <div style={{fontSize:'0.74rem',color:'var(--light)'}}>Average total cost for this vendor category</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:'0.84rem',color:'var(--mid)',fontWeight:500}}>R</span>
                  <input
                    type="number"
                    value={averages[type]||''}
                    onChange={e=>setAverages(prev=>({...prev,[type]:e.target.value}))}
                    placeholder="0"
                    style={{...inputStyle, width:140, marginBottom:0, textAlign:'right', fontSize:'0.92rem', fontWeight:600, color:'var(--forest)'}}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error&&<div style={{color:'var(--rose)',fontSize:'0.82rem',marginTop:16,padding:'10px 14px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}

      <div style={{display:'flex',alignItems:'center',gap:14,marginTop:20}}>
        <button onClick={saveAverages} disabled={saving||loading} style={{background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'12px 28px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:(saving||loading)?'wait':'pointer',letterSpacing:'0.04em'}}>
          {saving?'Saving…':'Save Averages'}
        </button>
        {saved&&<span style={{fontSize:'0.84rem',color:'var(--forest)',fontWeight:500}}>✓ Saved successfully!</span>}
      </div>
    </div>
  );
}


function AdminDashboard({onLogout}) {
  const [allVendors,setAllVendors]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [editData,setEditData]=useState(null);
  const [adminTab,setAdminTab]=useState('vendors'); // 'vendors' | 'diagnostics' | 'pricing'
  const [search,setSearch]=useState('');
  const [viewingVendorDash,setViewingVendorDash]=useState(null); // vendor user object to view full dashboard

  useEffect(()=>{loadAll();},[]);

  async function loadAll(){
    setLoading(true);
    try{const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name');setAllVendors(data);}
    catch(e){console.error(e);}
    setLoading(false);
  }

  async function deleteVendor(id){
    if(!window.confirm('Delete this vendor profile?'))return;
    try{await supaFetch(`vendors?id=eq.${id}`,{method:'DELETE',prefer:'return=minimal'});loadAll();}
    catch(e){alert('Delete failed: '+e.message);}
  }

  function startEdit(v){setEditData({...v,_unavailDates:(v.unavail_dates||[]).map(d=>d.date)});setEditing(v.id);}

  const filtered=allVendors.filter(v=>(v.name+v.type+v.location).toLowerCase().includes(search.toLowerCase()));

  // Show full vendor dashboard when admin clicks a vendor
  if(viewingVendorDash)return(
    <>
      <div style={{background:'var(--deep-rose)',padding:'12px 24px',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>setViewingVendorDash(null)} style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.15)',border:'none',borderRadius:7,padding:'6px 14px',color:'white',cursor:'pointer',fontSize:'0.82rem'}}>‹ Back to Admin</button>
        <span style={{color:'rgba(255,255,255,0.7)',fontSize:'0.8rem'}}>⚙️ Admin — viewing vendor: <strong style={{color:'white'}}>{viewingVendorDash.email}</strong></span>
      </div>
      <VendorDashboard user={viewingVendorDash} onLogout={()=>setViewingVendorDash(null)}/>
    </>
  );

  if(editing==='new')return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Add New Vendor</h2>
      <VendorForm onSaved={()=>{setEditing(null);loadAll();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  if(editing&&editData)return(
    <div style={{padding:'40px 28px',maxWidth:800,margin:'0 auto'}}>
      <button onClick={()=>setEditing(null)} style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:20,background:'none',border:'none',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',color:'var(--mid)',cursor:'pointer',padding:0}}><span style={{fontSize:'1.1rem'}}>‹</span> Back</button>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)',marginBottom:24}}>Edit: {editData.name}</h2>
      <VendorForm initialData={editData} vendorId={editing} onSaved={()=>{setEditing(null);loadAll();}} onCancel={()=>setEditing(null)}/>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      {/* Admin nav */}
      <div style={{background:'var(--deep-rose)',padding:'16px 32px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--gold-light)',fontWeight:600}}>⚙️ Admin Dashboard</div>
          <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.6)',marginTop:2}}>Full access — all vendor profiles</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{display:'flex',gap:4,background:'rgba(0,0,0,0.2)',borderRadius:8,padding:4}}>
            {[['vendors','📋 Vendors'],['pricing','💰 Pricing'],['diagnostics','🔧 Diagnostics']].map(([t,label])=><button key={t} onClick={()=>setAdminTab(t)} style={{background:adminTab===t?'rgba(255,255,255,0.15)':'none',border:'none',color:'rgba(255,255,255,0.9)',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:'0.78rem',fontWeight:500}}>{label}</button>)}
          </div>
          <button onClick={()=>setEditing('new')} style={{background:'var(--gold)',color:'var(--forest)',border:'none',borderRadius:8,padding:'8px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',fontWeight:600,cursor:'pointer'}}>+ Add Vendor</button>
          <button onClick={onLogout} style={{background:'rgba(255,255,255,0.15)',color:'white',border:'none',borderRadius:8,padding:'8px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.82rem',cursor:'pointer'}}>Logout</button>
        </div>
      </div>

      {adminTab==='diagnostics'?<DiagnosticPanel/>:adminTab==='pricing'?<OnRequestPricingPanel/>:(
        <div style={{padding:'32px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
            <div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',color:'var(--forest)',fontWeight:400}}>All Vendors <span style={{fontSize:'1rem',color:'var(--light)',fontStyle:'normal'}}>({allVendors.length} total)</span></h2>
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, type, location…" style={{...inputStyle,width:280,marginBottom:0}}/>
          </div>

          {loading?<div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading all vendors…</div>:(
            <div style={{display:'grid',gap:12}}>
              {filtered.length===0?<div style={{textAlign:'center',padding:'40px',color:'var(--light)'}}>No vendors found.</div>:
                filtered.map(v=>(
                  <div key={v.id}
                    onClick={()=>setViewingVendorDash({role:'vendor',email:v.user_id?v.user_id+'@admin':'vendor@admin',userId:v.user_id||v.id,vendorId:v.id})}
                    style={{background:'var(--white)',borderRadius:12,padding:'16px 20px',boxShadow:'var(--card-shadow)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap',cursor:'pointer',transition:'box-shadow 0.15s,transform 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow='var(--card-shadow-hover)';e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow='var(--card-shadow)';e.currentTarget.style.transform='';}}>
                    <div style={{width:52,height:52,borderRadius:8,background:v.images?.[0]?.url?`url(${v.images[0].url}) center/cover`:`linear-gradient(135deg,${v.color||'#c8a87a'}dd,${v.color||'#c8a87a'}66)`,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:600,color:'var(--forest)'}}>{v.name}</div>
                      <div style={{fontSize:'0.76rem',color:'var(--mid)',marginTop:2}}>{TYPE_EMOJI[v.type]} {v.type} · 📍 {v.location}</div>
                      {v.user_id&&<div style={{fontSize:'0.7rem',color:'var(--light)',marginTop:2}}>User ID: {v.user_id.slice(0,8)}…</div>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:'0.78rem',color:'var(--forest)',background:'rgba(58,74,63,0.08)',padding:'4px 10px',borderRadius:999,fontWeight:500}}>{ON_REQUEST_TYPES.has(v.type)?'On Request':fmt(v.fixed_rate)}</span>
                      <button onClick={e=>{e.stopPropagation();startEdit(v);}} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',cursor:'pointer'}}>✏️ Edit</button>
                      <button onClick={e=>{e.stopPropagation();deleteVendor(v.id);}} style={{background:'#fce8e4',color:'#b85a45',border:'none',borderRadius:7,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',cursor:'pointer'}}>🗑 Delete</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DIAGNOSTICS ───────────────────────────────────────────────────────────────
function DiagnosticPanel() {
  const [results,setResults]=useState([]);const[running,setRunning]=useState(false);
  async function runTests(){
    setRunning(true);setResults([]);
    const log=(label,status,detail)=>setResults(prev=>[...prev,{label,status,detail}]);
    try{const r=await fetch(`${SUPABASE_URL}/rest/v1/`,{headers:{apikey:SUPABASE_PUB_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`}});log('Supabase reachable',r.ok?'ok':'warn',`HTTP ${r.status}`);}catch(e){log('Supabase reachable','fail',e.message);}
    for(const table of['vendors','vendor_images','vendor_unavailable_dates']){try{const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,{headers:{apikey:SUPABASE_PUB_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,Accept:'application/json'}});const body=await r.text();log(`${table} table`,r.ok?'ok':'fail',r.ok?`HTTP ${r.status}`:`HTTP ${r.status} — ${body}`);}catch(e){log(`${table} table`,'fail',e.message);}}
    try{await loadGoogleMaps();log('Google Maps API','ok','Maps loaded successfully');}catch(e){log('Google Maps API','fail',e.message);}
    setRunning(false);
  }
  const colors={ok:'#2d7a4f',warn:'#b07d2a',fail:'#b03a2a'},bg={ok:'#edfaf3',warn:'#fdf6e3',fail:'#fdecea'};
  return(
    <div style={{maxWidth:680,margin:'40px auto',padding:'0 24px 60px'}}>
      <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',marginBottom:6}}>Diagnostics</h2>
      <p style={{fontSize:'0.84rem',color:'var(--mid)',marginBottom:20}}>Tests Supabase connection and Google Maps API.</p>
      <button onClick={runTests} disabled={running} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px 24px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',cursor:running?'wait':'pointer',marginBottom:24}}>{running?'Running…':'Run Connection Tests'}</button>
      {results.map((r,i)=><div key={i} style={{background:bg[r.status],border:`1px solid ${colors[r.status]}22`,borderRadius:10,padding:'12px 16px',marginBottom:10}}><div style={{display:'flex',alignItems:'center',gap:10}}><span>{r.status==='ok'?'✅':r.status==='warn'?'⚠️':'❌'}</span><span style={{fontWeight:600,fontSize:'0.88rem',color:colors[r.status]}}>{r.label}</span></div><div style={{fontSize:'0.78rem',color:'#555',marginTop:4,fontFamily:'monospace',wordBreak:'break-all'}}>{r.detail}</div></div>)}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
// ── FAVOURITES STAR BUTTON ────────────────────────────────────────────────────
function FavStar({vendor,customerId,size=20}) {
  const [faved,setFaved]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!customerId)return;
    supaFetch(`favourites?customer_id=eq.${customerId}&vendor_id=eq.${vendor.id}&select=id`)
      .then(d=>{if(Array.isArray(d)&&d.length>0)setFaved(true);}).catch(()=>{});
  },[customerId,vendor.id]);

  async function toggle(e){
    e.stopPropagation();
    if(!customerId||loading)return;
    setLoading(true);
    try{
      if(faved){
        await supaFetch(`favourites?customer_id=eq.${customerId}&vendor_id=eq.${vendor.id}`,{method:'DELETE',prefer:'return=minimal'});
        setFaved(false);
      }else{
        await supaFetch('favourites',{method:'POST',body:JSON.stringify({customer_id:customerId,vendor_id:vendor.id}),prefer:'return=minimal'});
        setFaved(true);
      }
    }catch(e){}
    setLoading(false);
  }

  return(
    <button onClick={toggle} title={faved?'Remove from favourites':'Add to favourites'}
      style={{background:'none',border:'none',cursor:customerId?'pointer':'default',padding:2,lineHeight:1,opacity:loading?0.5:1,transition:'transform 0.15s'}}
      onMouseEnter={e=>{if(customerId)e.currentTarget.style.transform='scale(1.2)';}}
      onMouseLeave={e=>e.currentTarget.style.transform=''}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill={faved?'#c9a96e':'none'} stroke={faved?'#c9a96e':'#a8a8a8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </button>
  );
}

// ── FAVOURITES VIEW ───────────────────────────────────────────────────────────
function FavouritesView({customerId,onOpenDetail,onRequestQuote,dateFrom,dateTo}) {
  const [favVendors,setFavVendors]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!customerId){setLoading(false);return;}
    supaFetch(`favourites?customer_id=eq.${customerId}&select=vendor:vendors(*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date))`)
      .then(data=>{
        const vendors=(data||[]).map(f=>f.vendor).filter(Boolean);
        setFavVendors(vendors);
      }).catch(()=>{}).finally(()=>setLoading(false));
  },[customerId]);

  if(loading)return<div style={{textAlign:'center',padding:'60px',color:'var(--light)'}}>Loading favourites…</div>;

  if(!customerId)return(
    <div style={{textAlign:'center',padding:'60px 20px',maxWidth:500,margin:'0 auto'}}>
      <div style={{fontSize:'3rem',marginBottom:12}}>⭐</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>Sign in to save favourites</div>
      <p style={{color:'var(--mid)',fontSize:'0.88rem'}}>Create a customer account to bookmark vendors you love.</p>
    </div>
  );

  if(favVendors.length===0)return(
    <div style={{textAlign:'center',padding:'60px 20px',maxWidth:500,margin:'0 auto'}}>
      <div style={{fontSize:'3rem',marginBottom:12}}>⭐</div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',marginBottom:8}}>No favourites yet</div>
      <p style={{color:'var(--mid)',fontSize:'0.88rem'}}>Star vendors while browsing to save them here.</p>
    </div>
  );

  const byType={};
  ALL_TYPES.forEach(t=>{const vv=favVendors.filter(v=>v.type===t);if(vv.length)byType[t]=vv;});

  return(
    <div style={{padding:'32px 28px 60px',maxWidth:1200,margin:'0 auto'}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',color:'var(--forest)',marginBottom:4}}>⭐ My Favourites</div>
      <p style={{color:'var(--light)',fontSize:'0.84rem',marginBottom:28}}>{favVendors.length} vendor{favVendors.length!==1?'s':''} saved</p>
      {Object.entries(byType).map(([type,vv])=>(
        <div key={type} style={{marginBottom:32}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
            {TYPE_EMOJI[type]} {type}
          </div>
          <div style={{display:'flex',gap:18,overflowX:'auto',paddingBottom:8}}>
            {vv.map(v=>{
              const unavail=dateFrom&&(v.unavail_dates||[]).some(d=>{const dd=d.date;return dd>=dateFrom&&(!dateTo||dd<=dateTo);});
              return<VendorCard key={v.id} vendor={v} unavail={unavail} dateFrom={dateFrom} dateTo={dateTo} onClick={()=>onOpenDetail(v)} onRequestQuote={()=>onRequestQuote&&onRequestQuote(v)} customerId={customerId} onFav={!!customerId}/>;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── WEDDING PLAN ──────────────────────────────────────────────────────────────
// ── WEDDING PLAN CONSTANTS ────────────────────────────────────────────────────

// Primary booking order — these are the 10 core vendor categories
const BOOKING_ORDER = [
  {step:1, type:'Photography',     note:'Your photographer captures memories that last a lifetime.',                                              why:'Top photographers book 12+ months ahead. Locking this in early gives you the best selection.'},
  {step:2, type:'Catering',        note:'Food and drink is often the most talked-about part of a wedding reception.',                             why:'Caterers need lead time for menu planning, sourcing, and staffing for your guest count.'},
  {step:3, type:'Florist',         note:'Flowers set the mood — from the ceremony arch to table centrepieces and your bridal bouquet.',           why:'Florals require detailed planning and sourcing. Book early to secure your preferred style and blooms.'},
  {step:4, type:'Videography',     note:'A wedding film lets you relive every moment — sound, movement, and emotion — for years to come.',        why:'Great videographers are often booked alongside photographers and fill calendars quickly.'},
  {step:5, type:'DJ',              note:'Your DJ keeps the energy alive from the first dance to the last song.',                                  why:'Great DJs fill their weekends fast, especially in peak season.'},
  {step:6, type:'Entertainment',   note:'Pre-drinks entertainment keeps guests engaged while you finish photos — bands, soloists, or acts.',      why:'Live entertainers book up quickly for peak wedding season. Unique acts are limited.'},
  {step:7, type:'Cake & Desserts', note:'Your cake is a centrepiece and a treat. Custom designs take time and careful planning.',                 why:'Custom wedding cakes require design sessions, tastings, and preparation weeks in advance.'},
  {step:8, type:'Furniture Rental',note:'Tables, chairs, lounge sets, and dance floors transform a space into your dream setting.',              why:'Popular furniture styles get reserved early, especially for large guest counts.'},
  {step:9, type:'Hair & Makeup',   note:'Looking and feeling your best gives you the confidence to enjoy every moment of your wedding day.',      why:'Sought-after artists book out for wedding season. A trial session is also recommended.'},
];

// Additional vendors — not in the primary order but worth budgeting for
const ADDITIONAL_VENDORS = [
  {type:'Barista', note:'A coffee bar adds a lovely touch during cocktail hour or as an after-dinner treat for guests.'},
];

// Budget ratios — how a typical wedding vendor budget is divided across categories.
// Logic: Based on South African wedding industry averages, weighted as follows:
//   Catering is the largest spend (~30%) as it scales with guest count.
//   Photography (~18%) and Videography (~12%) are premium services booked early.
//   Florist (~8%) and Furniture Rental (~7%) are decor essentials.
//   DJ (~7%) is a reception must-have.
//   Hair & Makeup (~5%), Entertainment (~5%), Cake & Desserts (~4%) round out the plan.
//   The remaining ~4% is left as flex budget for additional vendors like Barista.
// Total of primary categories = 96%, leaving ~4% flex for additional vendors.
const BUDGET_RATIOS = {
  'Photography':    0.18,
  'Catering':       0.30,
  'Florist':        0.08,
  'DJ':             0.07,
  'Entertainment':  0.05,
  'Videography':    0.12,
  'Cake & Desserts':0.04,
  'Furniture Rental':0.07,
  'Hair & Makeup':  0.05,
  // Additional vendors share the remaining ~4%
  'Barista':        0.04,
};

// ── WEDDING PLAN VENUE INPUT (Google Maps autocomplete) ───────────────────────
function WeddingPlanVenueInput({value, onChange, onLatLng}) {
  const inputRef = useRef();
  useEffect(()=>{
    if(inputRef.current && value) inputRef.current.value = value;
    loadGoogleMaps().then(google=>{
      if(!inputRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment','geocode'],
        componentRestrictions: {country:'za'},
      });
      ac.addListener('place_changed', ()=>{
        const place = ac.getPlace();
        if(place.geometry){
          const name = place.formatted_address || place.name;
          if(inputRef.current) inputRef.current.value = name;
          onChange(name);
          if(onLatLng) onLatLng({lat:place.geometry.location.lat(),lng:place.geometry.location.lng()});
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return (
    <input
      ref={inputRef}
      style={inputStyle}
      defaultValue={value}
      onChange={e=>onChange(e.target.value)}
      placeholder="e.g. Babylonstoren, Franschhoek"
    />
  );
}

function WeddingPlan({onClose, vendors: passedVendors, onSearchVendors}) {
  const [planStep, setPlanStep] = useState('intro');
  const [weddingVenue, setWeddingVenue] = useState('');
  const [weddingVenueLatLng, setWeddingVenueLatLng] = useState(null);
  const [totalBudget, setTotalBudget] = useState('');
  const [onReqAverages, setOnReqAverages] = useState({});
  const [allVendors, setAllVendors] = useState(passedVendors||[]);

  // Fetch all vendors if none passed (so averages always work)
  useEffect(()=>{
    if(allVendors.length===0){
      supaFetch('vendors?select=id,name,type,fixed_rate&order=type')
        .then(d=>setAllVendors(d||[])).catch(()=>{});
    }
    // Fetch admin-set on-request averages
    const keys = [...ON_REQUEST_TYPES].map(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`);
    supaFetch(`app_settings?key=in.(${keys.map(k=>'"'+k+'"').join(',')})&select=key,value`)
      .then(data=>{
        const map = {};
        (data||[]).forEach(row=>{
          const type = [...ON_REQUEST_TYPES].find(t=>`onreq_avg_${t.replace(/[^a-zA-Z0-9]/g,'_')}`===row.key);
          if(type && row.value) map[type] = parseInt(row.value)||0;
        });
        setOnReqAverages(map);
      }).catch(()=>{});
  },[]);

  // Calculate average costs from real vendor data + admin on-request averages
  const avgCosts = useMemo(() => {
    const result = {};
    [...BOOKING_ORDER.map(o=>o.type), ...ADDITIONAL_VENDORS.map(a=>a.type)].forEach(type => {
      if(ON_REQUEST_TYPES.has(type)){
        result[type] = onReqAverages[type] || null;
      } else {
        const typed = allVendors.filter(v => v.type === type);
        const tots = typed.map(v => v.fixed_rate || 0).filter(n => n > 0);
        result[type] = tots.length > 0 ? Math.round(tots.reduce((a,b)=>a+b,0)/tots.length) : null;
      }
    });
    return result;
  }, [allVendors, onReqAverages]);

  const budget = parseFloat(totalBudget) || 0;

  // Recommended spend — ratios applied to total budget
  const recommendedSpend = useMemo(() => {
    if (!budget) return {};
    const result = {};
    Object.keys(BUDGET_RATIOS).forEach(type => {
      result[type] = Math.round(budget * BUDGET_RATIOS[type]);
    });
    return result;
  }, [budget]);

  // Leftover budget after primary categories
  const primaryTotal = useMemo(()=>{
    if(!budget) return 0;
    return BOOKING_ORDER.reduce((sum,o)=>sum+(recommendedSpend[o.type]||0),0);
  },[recommendedSpend,budget]);
  const leftover = budget - primaryTotal;

  const cardStyle = {background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:20,overflow:'hidden'};

  // ── INTRO SCREEN ──────────────────────────────────────────────────────────
  if (planStep === 'intro') return (
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={onClose} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.rings(18,'var(--forest)')} Wedding Plan</div>
      </div>
      <div style={{maxWidth:740,margin:'0 auto',padding:'32px 24px 60px'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2.2rem',color:'var(--forest)',fontWeight:300,marginBottom:8}}>Plan Your Perfect Wedding</div>
          <p style={{color:'var(--mid)',fontSize:'0.9rem',maxWidth:500,margin:'0 auto',lineHeight:1.7}}>Follow the recommended booking order to secure the best vendors — before they're taken.</p>
        </div>

        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',padding:'24px',marginBottom:28}}>
          <div style={{fontSize:'0.72rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--mid)',marginBottom:18,fontWeight:500}}>Recommended Booking Order</div>
          {BOOKING_ORDER.map((item,idx)=>(
            <div key={item.step} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:idx<BOOKING_ORDER.length-1?'1px solid var(--parchment)':'none'}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--forest)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.8rem',flexShrink:0}}>{item.step}</div>
              <div style={{width:26,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'var(--mid)'}}><VendorIcon type={item.type} size={17} color='var(--mid)'/></div>
              <div style={{fontSize:'0.92rem',fontWeight:500,color:'var(--charcoal)',flex:1}}>{item.type}</div>
              {idx<3&&<span style={{fontSize:'0.66rem',color:'var(--rose)',fontWeight:600,background:'rgba(196,130,106,0.1)',padding:'2px 8px',borderRadius:999}}>Book first</span>}
            </div>
          ))}
        </div>

        <button onClick={()=>setPlanStep('setup')} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:12,padding:'16px',fontFamily:"'DM Sans',sans-serif",fontSize:'1rem',fontWeight:600,cursor:'pointer',letterSpacing:'0.05em'}}>
          Get Started →
        </button>
      </div>
    </div>
  );

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────
  if (planStep === 'setup') return (
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setPlanStep('intro')} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Back</button>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.rings(18,'var(--forest)')} Your Wedding Details</div>
      </div>
      <div style={{maxWidth:580,margin:'0 auto',padding:'40px 24px 60px'}}>
        <p style={{color:'var(--mid)',fontSize:'0.9rem',marginBottom:28,lineHeight:1.7}}>Enter your wedding venue and total vendor budget. We'll break it down into a recommended spend per category based on industry averages.</p>
        <div style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',padding:'28px'}}>
          <div style={{marginBottom:20}}>
            <label style={labelStyle}>Wedding Venue / Location</label>
            <WeddingPlanVenueInput value={weddingVenue} onChange={setWeddingVenue} onLatLng={ll=>setWeddingVenueLatLng(ll)}/>
          </div>
          <div style={{marginBottom:24}}>
            <label style={labelStyle}>Total Vendor Budget (R)</label>
            <input style={inputStyle} type="number" value={totalBudget} onChange={e=>setTotalBudget(e.target.value)} placeholder="e.g. 150000"/>
            <div style={{fontSize:'0.74rem',color:'var(--light)',marginTop:5}}>Your total spend across all wedding vendors, excluding venue hire costs.</div>
          </div>

          {/* Live budget preview */}
          {budget>0&&(
            <div style={{background:'rgba(58,74,63,0.05)',borderRadius:10,padding:'14px 16px',marginBottom:20,border:'1px solid rgba(58,74,63,0.1)'}}>
              <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>Budget breakdown preview</div>
              {BOOKING_ORDER.map(({type})=>(
                <div key={type} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.8rem',padding:'4px 0',borderBottom:'1px solid rgba(58,74,63,0.06)'}}>
                  <span style={{color:'var(--mid)'}}>{TYPE_EMOJI[type]} {type}{ON_REQUEST_TYPES.has(type)&&<span style={{fontSize:'0.66rem',color:'var(--rose)',marginLeft:4}}>on request</span>}</span>
                  <span style={{fontWeight:600,color:'var(--forest)'}}>{fmt(Math.round(budget*(BUDGET_RATIOS[type]||0.05)))}</span>
                </div>
              ))}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.8rem',padding:'6px 0 0',marginTop:4,borderTop:'1px solid rgba(58,74,63,0.12)'}}>
                <span style={{color:'var(--mid)',fontStyle:'italic'}}>+ Additional vendors (Barista etc.)</span>
                <span style={{fontWeight:600,color:'var(--gold)'}}>{fmt(leftover>0?leftover:Math.round(budget*0.04))}</span>
              </div>
            </div>
          )}

          <button onClick={()=>{if(!budget){alert('Please enter a budget to continue.');return;}setPlanStep('plan');}}
            style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.92rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em'}}>
            Build My Wedding Plan →
          </button>
        </div>

        {/* Budget logic explainer */}
        <div style={{marginTop:20,background:'var(--white)',borderRadius:12,boxShadow:'var(--card-shadow)',padding:'20px 22px'}}>
          <div style={{fontSize:'0.78rem',fontWeight:600,color:'var(--forest)',marginBottom:10}}>How we calculate your recommended spend</div>
          <div style={{fontSize:'0.78rem',color:'var(--mid)',lineHeight:1.7}}>
            Your budget is divided using industry-standard ratios based on South African wedding averages:
          </div>
          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:4}}>
            {Object.entries(BUDGET_RATIOS).filter(([t])=>BOOKING_ORDER.some(o=>o.type===t)).map(([type,ratio])=>(
              <div key={type} style={{display:'flex',justifyContent:'space-between',fontSize:'0.76rem',color:'var(--mid)'}}>
                <span style={{display:'flex',alignItems:'center',gap:6}}><VendorIcon type={type} size={14} color='var(--mid)'/>{type}</span>
                <span style={{fontWeight:500,color:'var(--charcoal)'}}>{Math.round(ratio*100)}%</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:10,fontSize:'0.74rem',color:'var(--light)',lineHeight:1.6}}>
            Catering takes the largest share as it scales with guest count. Photography and videography are premium bookings. The remaining ~4% is set aside for additional vendors like a barista.
          </div>
        </div>
      </div>
    </div>
  );

  // ── FULL PLAN VIEW ────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'var(--cream)'}}>
      <div style={{background:'var(--white)',borderBottom:'1px solid var(--parchment)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setPlanStep('setup')} style={{background:'var(--parchment)',border:'none',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.8rem',color:'var(--mid)'}}>‹ Edit</button>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>{IC.rings(18,'var(--forest)')} Wedding Plan</div>
        </div>
        <div style={{textAlign:'right'}}>
          {weddingVenue&&<div style={{fontSize:'0.76rem',color:'var(--mid)',display:'flex',alignItems:'center',gap:4}}>{IC.pin(13,'var(--mid)')}{weddingVenue}</div>}
          <div style={{fontSize:'0.82rem',fontWeight:600,color:'var(--rose)'}}>Budget: {fmt(budget)}</div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'24px 24px 60px'}}>
        {/* Mini booking order strip */}
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:28,scrollbarWidth:'none'}}>
          {BOOKING_ORDER.map(item=>(
            <div key={item.step} style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,width:60}}>
              <div style={{width:40,height:40,borderRadius:'50%',background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'center'}}><VendorIcon type={item.type} size={18} color='var(--gold-light)'/></div>
              <div style={{fontSize:'0.58rem',color:'var(--mid)',textAlign:'center',lineHeight:1.3,fontWeight:500,maxWidth:56}}>{item.type}</div>
            </div>
          ))}
        </div>

        {/* PRIMARY vendor sections */}
        {BOOKING_ORDER.map((item) => {
          const isOnReq = ON_REQUEST_TYPES.has(item.type);
          const catVendors = allVendors.filter(v => v.type === item.type);
          const prices = catVendors.filter(v=>!isOnReq).map(v=>v.fixed_rate||0).filter(n=>n>0);
          const catAvg = avgCosts[item.type];
          const catMin = prices.length>0 ? Math.min(...prices) : null;
          const catMax = prices.length>0 ? Math.max(...prices) : null;
          const recSpend = recommendedSpend[item.type] || 0;
          const vendorCount = prices.length;
          return (
            <div key={item.type} style={cardStyle}>
              <div style={{background:'var(--forest)',padding:'14px 20px',display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.15)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:'0.88rem',flexShrink:0}}>{item.step}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',width:28}}><VendorIcon type={item.type} size={20} color='var(--gold-light)'/></div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--gold-light)',fontWeight:600,flex:1}}>{item.type}</div>
              </div>
              <div style={{padding:'18px 20px'}}>
                <div style={{fontSize:'0.88rem',color:'var(--charcoal)',lineHeight:1.65,marginBottom:8}}>{item.note}</div>
                <div style={{fontSize:'0.8rem',color:'var(--mid)',background:'var(--parchment)',borderRadius:8,padding:'8px 12px',lineHeight:1.55,marginBottom:14}}>
                  <strong style={{color:'var(--forest)'}}>Why book now:</strong> {item.why}
                </div>

                {isOnReq ? (
                  <div>
                    {(catAvg||recSpend>0)&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                        <div style={{background:'var(--parchment)',borderRadius:10,padding:'14px 16px'}}>
                          <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Avg. market cost</div>
                          {catAvg ? (
                            <>
                              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>{fmt(catAvg)}</div>
                              <div style={{fontSize:'0.71rem',color:'var(--light)'}}>Indicative — varies by requirements</div>
                            </>
                          ):<div style={{fontSize:'0.82rem',color:'var(--light)',fontStyle:'italic'}}>Not set yet</div>}
                        </div>
                        <div style={{background:'rgba(58,74,63,0.06)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(58,74,63,0.1)'}}>
                          <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Recommended spend</div>
                          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--rose)',marginBottom:4}}>{fmt(recSpend)}</div>
                          <div style={{fontSize:'0.72rem',color:'var(--light)'}}>{Math.round((BUDGET_RATIOS[item.type]||0.05)*100)}% of your budget</div>
                          {catAvg&&<div style={{fontSize:'0.71rem',marginTop:5,color:recSpend>=catAvg?'var(--forest)':'var(--rose)',fontWeight:500}}>{recSpend>=catAvg?'Within range':'Below average'}</div>}
                        </div>
                      </div>
                    )}
                    <div style={{background:'rgba(196,130,106,0.06)',borderRadius:10,padding:'11px 14px',border:'1px solid rgba(196,130,106,0.18)',fontSize:'0.82rem',color:'var(--mid)',lineHeight:1.6}}>
                      Pricing is confirmed on request — the figures above are indicative for budgeting purposes. Use <em>Request a Quote</em> on any {item.type} vendor page.
                    </div>
                    {onSearchVendors&&(
                      <button
                        onClick={()=>onSearchVendors({venueName:weddingVenue,venueLL:weddingVenueLatLng,type:item.type,maxPrice:null})}
                        style={{marginTop:10,width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                        <span style={{display:'flex',alignItems:'center',gap:8}}>{IC.search(16,'var(--gold-light)')} Browse {item.type} Vendors</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div style={{background:'var(--parchment)',borderRadius:10,padding:'14px 16px'}}>
                        <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Market average</div>
                        {catAvg ? (
                          <>
                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--forest)',marginBottom:4}}>{fmt(catAvg)}</div>
                            <div style={{fontSize:'0.72rem',color:'var(--light)',marginBottom:2}}>Range: {catMin?fmt(catMin):'–'} – {catMax?fmt(catMax):'–'}</div>
                            <div style={{fontSize:'0.71rem',color:'var(--light)'}}>Based on {vendorCount} vendor{vendorCount!==1?'s':''} on VowFinds</div>
                          </>
                        ):<div style={{fontSize:'0.82rem',color:'var(--light)',fontStyle:'italic'}}>No vendors listed yet</div>}
                      </div>
                      <div style={{background:'rgba(58,74,63,0.06)',borderRadius:10,padding:'14px 16px',border:'1px solid rgba(58,74,63,0.1)'}}>
                        <div style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:8}}>Recommended spend</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',fontWeight:600,color:'var(--rose)',marginBottom:4}}>{fmt(recSpend)}</div>
                        <div style={{fontSize:'0.72rem',color:'var(--light)'}}>{Math.round((BUDGET_RATIOS[item.type]||0.05)*100)}% of your budget</div>
                        {catAvg&&recSpend>0&&<div style={{fontSize:'0.71rem',marginTop:5,color:recSpend>=catAvg?'var(--forest)':'var(--rose)',fontWeight:500}}>{recSpend>=catAvg?'Within range':'Below average'}</div>}
                      </div>
                    </div>
                    {onSearchVendors&&(
                      <button
                        onClick={()=>onSearchVendors({venueName:weddingVenue,venueLL:weddingVenueLatLng,type:item.type,maxPrice:recSpend||null})}
                        style={{marginTop:12,width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'11px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                        <span style={{display:'flex',alignItems:'center',gap:8}}>{IC.search(16,'var(--gold-light)')} Search {item.type} Vendors{recSpend?` · up to ${fmt(recSpend)}`:''}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* ADDITIONAL VENDORS section — leftover budget */}
        {budget>0&&(
          <div style={cardStyle}>
            <div style={{background:'linear-gradient(135deg,var(--gold),#b8932a)',padding:'14px 20px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{display:'flex',alignItems:'center'}}>{IC.star(20,'var(--white)')}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--white)',fontWeight:600,flex:1}}>Additional Vendors</div>
              <div style={{background:'rgba(255,255,255,0.2)',borderRadius:8,padding:'4px 12px'}}>
                <div style={{fontSize:'0.68rem',color:'rgba(255,255,255,0.8)'}}>Flex budget</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1rem',color:'var(--white)',fontWeight:600}}>{fmt(leftover>0?leftover:Math.round(budget*0.04))}</div>
              </div>
            </div>
            <div style={{padding:'18px 20px'}}>
              <p style={{fontSize:'0.86rem',color:'var(--mid)',lineHeight:1.65,marginBottom:16}}>
                Once your primary vendors are secured, consider these finishing touches. Your flex budget of <strong>{fmt(leftover>0?leftover:Math.round(budget*0.04))}</strong> can be allocated here.
              </p>
              {ADDITIONAL_VENDORS.map(({type,emoji,note})=>{
                const catVendors2 = allVendors.filter(v=>v.type===type);
                const prices2 = catVendors2.map(v=>v.fixed_rate||0).filter(n=>n>0);
                const catAvg2 = prices2.length>0?Math.round(prices2.reduce((a,b)=>a+b,0)/prices2.length):null;
                const catMin2 = prices2.length>0?Math.min(...prices2):null;
                const catMax2 = prices2.length>0?Math.max(...prices2):null;
                const recAdditional = Math.round(budget*(BUDGET_RATIOS[type]||0.04));
                return(
                  <div key={type} style={{borderRadius:12,border:'1px solid var(--parchment)',padding:'14px 16px',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'center'}}><VendorIcon type={type} size={20} color='var(--forest)'/></div>
                      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)'}}>{type}</div>
                    </div>
                    <div style={{fontSize:'0.82rem',color:'var(--mid)',marginBottom:12,lineHeight:1.55}}>{note}</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      <div style={{background:'var(--parchment)',borderRadius:8,padding:'11px 13px'}}>
                        <div style={{fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--mid)',marginBottom:6}}>Market average</div>
                        {catAvg2 ? (
                          <>
                            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:600,color:'var(--forest)',marginBottom:2}}>{fmt(catAvg2)}</div>
                            <div style={{fontSize:'0.69rem',color:'var(--light)'}}>Range: {catMin2?fmt(catMin2):'–'} – {catMax2?fmt(catMax2):'–'}</div>
                          </>
                        ):<div style={{fontSize:'0.8rem',color:'var(--light)',fontStyle:'italic'}}>No vendors listed yet</div>}
                      </div>
                      <div style={{background:'rgba(58,74,63,0.05)',borderRadius:8,padding:'11px 13px',border:'1px solid rgba(58,74,63,0.08)'}}>
                        <div style={{fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--mid)',marginBottom:6}}>Suggested spend</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',fontWeight:600,color:'var(--rose)',marginBottom:2}}>{fmt(recAdditional)}</div>
                        <div style={{fontSize:'0.69rem',color:'var(--light)'}}>{Math.round((BUDGET_RATIOS[type]||0.04)*100)}% of your budget</div>
                      </div>
                    </div>
                    {onSearchVendors&&(
                      <button
                        onClick={()=>onSearchVendors({venueName:weddingVenue,venueLL:weddingVenueLatLng,type,maxPrice:recAdditional||null})}
                        style={{marginTop:10,width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'10px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.85rem',fontWeight:500,cursor:'pointer',letterSpacing:'0.04em',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                        <span style={{display:'flex',alignItems:'center',gap:8}}>{IC.search(16,'var(--gold-light)')} Search {type} Vendors{recAdditional?` · up to ${fmt(recAdditional)}`:''}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── SCENARIO BUILDER ──────────────────────────────────────────────────────────
// Completely uncontrolled venue input — Google Autocomplete owns the DOM value.
// We only call back with name+latLng when a place is selected.
// `scenarioId` in the key ensures a fresh mount per scenario only.
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
        ? <div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:3,fontWeight:500}}>✓ Location pinned — distances will be calculated</div>
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
          {step==='results'?'🔍 Scenario Results':'📋 Scenario Summary'}
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          {step==='summary'&&results&&results.length>1&&<button onClick={exportComparison} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:7,padding:'6px 14px',cursor:'pointer',fontSize:'0.78rem',fontWeight:500}}>📊 Compare All</button>}
          <button onClick={onClose} style={{background:'none',border:'1px solid var(--parchment)',borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:'0.78rem',color:'var(--mid)'}}>Close</button>
        </div>
      </div>
      <div style={{maxWidth:960,margin:'0 auto',padding:'24px 24px 60px'}}>
        {(results||[]).map((sc,idx)=>(
          <div key={sc.id} style={{background:'var(--white)',borderRadius:16,boxShadow:'var(--card-shadow)',marginBottom:24,overflow:'hidden'}}>
            <div style={{background:'var(--forest)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.2rem',color:'var(--gold-light)',fontWeight:600}}>Scenario {idx+1}: {sc.venue||'Unnamed Venue'}</div>
                {sc.date&&<div style={{fontSize:'0.78rem',color:'rgba(232,213,163,0.7)',marginTop:2}}>📅 {formatDateDisplay(sc.date)}</div>}
                {sc.venuePinned
                  ? <div style={{fontSize:'0.72rem',color:'rgba(201,169,110,0.8)',marginTop:2}}>✓ Distances calculated from pinned venue</div>
                  : <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.4)',marginTop:2}}>⚠ No venue pinned — distances may not reflect this venue</div>
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
                        <span style={{fontSize:'1.1rem'}}>{TYPE_EMOJI[type]}</span>
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
                              {isSel&&<div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:3}}>✓ Selected</div>}
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
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',fontWeight:600}}>🗂 Scenario Builder</div>
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
                      <span style={{fontSize:'0.9rem',flexShrink:0}}>{TYPE_EMOJI[type]}</span>
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
            ⚠️ Some venues haven't been pinned via the dropdown — type and select from the suggestions to lock in the location for accurate distance pricing.
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
        {!vendorsLoading&&allVendors.length>0&&<p style={{textAlign:'center',fontSize:'0.78rem',color:'var(--forest)',marginTop:10}}>✓ {allVendors.length} vendors loaded and ready</p>}
      </div>
    </div>
  );
}


// ── CUSTOMER BROWSE VIEW (logged-in customer browsing vendors) ────────────────
function CustomerBrowseView({user,venue,setVenue,venueLatLng,setVenueLatLng,dateFrom,setDateFrom,dateTo,setDateTo,selectedTypes,setSelectedTypes,vendors,setVendors,loading,setLoading,loadError,setLoadError,calcProgress,setCalcProgress,searched,setSearched,showMap,setShowMap,openDetail,onRequestQuote,onOpenScenario,onOpenFavourites,browseView,setBrowseView,planMaxPrices=null}) {
  const activeTypes=selectedTypes.size===0?ALL_TYPES:ALL_TYPES.filter(t=>selectedTypes.has(t));
  const vendorsByType={};activeTypes.forEach(t=>{vendorsByType[t]=vendors.filter(v=>v.type===t);});
  const vendorsWithLoc=vendors.filter(v=>v.lat&&v.lng);

  const toggleType=(type)=>{
    if(type==='all'){setSelectedTypes(prev=>prev.size===ALL_TYPES.length?new Set():new Set(ALL_TYPES));}
    else{setSelectedTypes(prev=>{const next=new Set(prev);next.has(type)?next.delete(type):next.add(type);return next;});}
  };

  async function loadVendors(latLng){
    if(!venue.trim())return;
    setLoading(true);setLoadError('');setCalcProgress('');
    try{
      const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name');
      if(latLng){
        setCalcProgress('Calculating distances…');
        try{
          const kms=await getBatchDistancesKm(latLng,data);
          const updated=data.map((v,i)=>({...v,distance_km:kms[i]||0}));
          setVendors(updated);
        }catch{setVendors(data);}
      }else setVendors(data);
      setCalcProgress('');
    }catch(e){setLoadError('Could not load vendors: '+e.message);}
    setLoading(false);
  }

  function search(){if(!venue.trim())return;setSearched(true);loadVendors(venueLatLng);}

  return(
    <div>
      {/* Hero — identical layout to public browse */}
      <div className="vf-hero-padding" style={{background:'linear-gradient(160deg,var(--forest) 0%,#2a3830 60%,#1e2820 100%)',position:'relative',overflow:'hidden',padding:'52px 24px 48px',display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 50% at 50% 100%,rgba(201,169,110,0.1) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:-120,right:-120,width:400,height:400,borderRadius:'50%',background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',bottom:-80,left:-80,width:280,height:280,borderRadius:'50%',background:'rgba(201,169,110,0.05)',pointerEvents:'none'}}/>

        {/* Eyebrow */}
        <div style={{fontSize:'0.7rem',letterSpacing:'0.25em',textTransform:'uppercase',color:'var(--gold)',marginBottom:10,position:'relative',zIndex:2}}>Your wedding, your way</div>
        <h1 className="vf-hero-headline" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.6rem)',fontWeight:300,color:'var(--cream)',lineHeight:1.15,marginBottom:8,textAlign:'center',position:'relative',zIndex:2}}>
          Find the <em style={{fontStyle:'italic',color:'var(--blush)'}}>perfect</em> vendors for your special day
        </h1>
        <p className="vf-hero-sub" style={{color:'rgba(250,246,241,0.5)',fontSize:'0.9rem',fontWeight:300,lineHeight:1.6,marginBottom:32,textAlign:'center',maxWidth:500,position:'relative',zIndex:2}}>
          Enter your venue and wedding window — we'll show real availability and travel costs.
        </p>

        {/* Search box */}
        <div className="vf-search-box" style={{background:'var(--white)',borderRadius:20,padding:'28px 32px',width:'100%',maxWidth:780,boxShadow:'0 16px 60px rgba(0,0,0,0.28)',position:'relative',zIndex:10,marginBottom:16}}>
          <div className="vf-search-grid" style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:14,marginBottom:16,alignItems:'end'}}>
            <div>
              <label style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:5,display:'block'}}>Venue Location</label>
              <VenueAutocomplete value={venue} onChange={setVenue} onPlaceSelected={(ll,name)=>{setVenueLatLng(ll);setVenue(name);}} placeholder="e.g. Babylonstoren, Franschhoek" style={{border:'1.5px solid var(--parchment)',borderRadius:9,padding:'11px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}/>
            </div>
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}/>
          </div>
          <button onClick={search} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'13px 28px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.95rem',fontWeight:500,letterSpacing:'0.06em',cursor:'pointer',width:'100%'}}>
            {loading?(calcProgress||'Loading vendors…'):'Search Vendors'}
          </button>
        </div>

        {/* Category filter — pills row below search, same as public view */}
        <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:780}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontSize:'0.68rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)'}}>Filter by category</span>
            <button onClick={()=>toggleType('all')} style={{background:'none',border:'none',cursor:'pointer',padding:'4px 10px',fontSize:'0.78rem',fontFamily:"'DM Sans',sans-serif",color:selectedTypes.size===ALL_TYPES.length?'var(--gold)':'rgba(255,255,255,0.45)',fontWeight:selectedTypes.size===ALL_TYPES.length?600:400,textDecoration:selectedTypes.size===ALL_TYPES.length?'none':'underline',textUnderlineOffset:'3px',transition:'color 0.15s'}}>
              {selectedTypes.size===ALL_TYPES.length?'✓ All selected':'Select all'}
            </button>
          </div>
          <div style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.13)',borderRadius:14,padding:'12px 14px',backdropFilter:'blur(8px)',display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'center'}}>
            {ALL_TYPES.map(t=>{
              const active=selectedTypes.has(t);
              return(
                <div key={t} onClick={()=>toggleType(t)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:999,cursor:'pointer',userSelect:'none',background:active?'rgba(196,130,106,0.28)':'rgba(255,255,255,0.06)',border:`1.5px solid ${active?'rgba(196,130,106,0.65)':'rgba(255,255,255,0.15)'}`,transition:'all 0.15s'}}>
                  <span style={{fontSize:'0.82rem',color:active?'var(--cream)':'rgba(255,255,255,0.6)',fontWeight:active?500:400,whiteSpace:'nowrap'}}>{TYPE_EMOJI[t]} {t}</span>
                </div>
              );
            })}
          </div>
          {selectedTypes.size>0&&selectedTypes.size<ALL_TYPES.length&&<div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.35)'}}>{selectedTypes.size} of {ALL_TYPES.length} categories selected</div>}
          {selectedTypes.size===0&&<div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.3)'}}>No filter — all vendors will show</div>}
        </div>
      </div>

      {/* Results */}
      {searched&&(
        <div className="vf-results-section" style={{padding:'32px 0 60px',background:'#ffffff'}}>
          <div className="vf-results-header" style={{padding:'0 28px 20px',maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <div>
              <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.8rem',fontWeight:400,color:'var(--forest)'}}>Vendors near <span style={{fontStyle:'italic',color:'var(--rose)'}}>{venue}</span>{dateFrom&&<span style={{fontSize:'1.1rem',color:'var(--mid)',fontStyle:'normal'}}> · {formatDateDisplay(dateFrom)}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</span>}</h2>
              <p style={{color:'var(--mid)',fontSize:'0.84rem',marginTop:3}}>{loading?(calcProgress||'Loading…'):loadError?loadError:'Greyed-out vendors are booked on your dates.'}</p>
            </div>
            {vendorsWithLoc.length>0&&<button onClick={()=>setShowMap(s=>!s)} style={{background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'7px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.78rem',color:'var(--forest)',cursor:'pointer'}}>{showMap?'🗺 Hide map':'🗺 Show map'}</button>}
          </div>
          {!loading&&!loadError&&showMap&&vendorsWithLoc.length>0&&<VendorsMap vendors={vendorsWithLoc} venueLatLng={venueLatLng} onSelectVendor={openDetail}/>}
          {!loading&&!loadError&&activeTypes.map((type,idx)=>{const tv=vendorsByType[type];if(!tv||tv.length===0)return null;return<VendorLane key={type} type={type} vendors={tv} dateFrom={dateFrom} dateTo={dateTo} onOpenDetail={openDetail} isLast={idx===activeTypes.length-1} onRequestQuote={onRequestQuote} customerId={user?.customerId} initialMaxPrice={planMaxPrices?planMaxPrices[type]??null:null}/>;  })}
        </div>
      )}
    </div>
  );
}


// ── MOBILE APP ─────────────────────────────────────────────────────────────────
// Completely separate mobile UI, rendered only when window.innerWidth < 768.
// Desktop components are untouched. Shares all utility functions + Supabase.

// ── Mobile venue autocomplete (uncontrolled, stable) ─────────────────────────
function MobileVenueInput({placeholder,onPinned,initialValue='',style={}}) {
  const ref=useRef();
  useEffect(()=>{
    if(ref.current&&initialValue)ref.current.value=initialValue;
    loadGoogleMaps().then(google=>{
      if(!ref.current)return;
      const ac=new google.maps.places.Autocomplete(ref.current,{types:['establishment','geocode'],componentRestrictions:{country:'za'}});
      ac.addListener('place_changed',()=>{
        const p=ac.getPlace();
        if(p.geometry){
          const ll={lat:p.geometry.location.lat(),lng:p.geometry.location.lng()};
          const name=p.formatted_address||p.name;
          if(ref.current)ref.current.value=name;
          onPinned(name,ll);
        }
      });
    });
  },[]);
  return <input ref={ref} defaultValue={initialValue} placeholder={placeholder||'Search venue…'} style={{border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",fontSize:'1rem',color:'var(--charcoal)',outline:'none',width:'100%',...style}}/>;
}

// ── Mobile Vendor Card (vertical list style) ──────────────────────────────────
function MobileVendorCard({vendor,onOpen,onQuote,customerId}) {
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0);
  const overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0;
  const total=(vendor.fixed_rate||0)+travel+overnight;
  const img=vendor.images?.[0]?.url;
  const onReq=isOnRequest(vendor);
  return(
    <div onClick={onOpen} style={{background:'#fff',borderRadius:12,marginBottom:10,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,0.05)',border:'1px solid #f0ebe4',display:'flex',cursor:'pointer',minHeight:100}}>
      {/* Image */}
      <div style={{width:110,flexShrink:0,background:img?`url(${img}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}cc,${vendor.color||'#c8a87a'}55)`,position:'relative'}}>
        <div style={{position:'absolute',bottom:6,left:6,background:'rgba(58,74,63,0.85)',color:'var(--gold-light)',fontSize:'0.6rem',letterSpacing:'0.08em',textTransform:'uppercase',padding:'3px 8px',borderRadius:999,display:'flex',alignItems:'center',gap:4}}><span style={{display:'flex'}}>{(TYPE_ICON[vendor.type]||IC.camera)(11,'var(--gold-light)')}</span>{vendor.type}</div>
      </div>
      {/* Content */}
      <div style={{flex:1,padding:'12px 14px',display:'flex',flexDirection:'column',justifyContent:'space-between',minWidth:0}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.05rem',fontWeight:600,color:'var(--forest)',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{vendor.name}</div>
          <div style={{fontSize:'0.72rem',color:'var(--light)',marginBottom:6,display:'flex',alignItems:'center',gap:4}}><span style={{display:'flex'}}>{IC.pin(12,'var(--light)')}</span>{vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km`:''}</div>
          {vendor.description&&<div style={{fontSize:'0.75rem',color:'var(--mid)',lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{vendor.description}</div>}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:8}}>
          <div style={{fontSize:'0.78rem'}}>
            {onReq
              ?<span style={{color:'var(--rose)',fontWeight:600,fontStyle:'italic'}}>On Request</span>
              :<span style={{color:'var(--forest)',fontWeight:700}}>{fmt(total)}</span>}
          </div>
          <div style={{display:'flex',gap:6}}>
            {customerId&&<div onClick={e=>e.stopPropagation()} style={{background:'var(--parchment)',borderRadius:7,width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center'}}><FavStar vendor={vendor} customerId={customerId} size={16}/></div>}
            <button onClick={e=>{e.stopPropagation();onQuote();}} style={{background:'var(--rose)',color:'#fff',border:'none',borderRadius:8,padding:'5px 12px',fontSize:'0.72rem',fontWeight:600,cursor:'pointer'}}>Quote</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Search Screen ───────────────────────────────────────────────────────
function MobileSearchScreen({onVendorsLoaded,initialVenue='',initialLL=null}) {
  const [venue,setVenue]=useState(initialVenue);
  const [venueLL,setVenueLL]=useState(initialLL);
  const [venuePinned,setVenuePinned]=useState(!!initialLL);
  const [dateFrom,setDateFrom]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  async function doSearch(){
    if(!venue.trim()){setError('Please enter your wedding venue');return;}
    setLoading(true);setError('');
    try{
      const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name');
      if(venueLL){
        const kms=await getBatchDistancesKm(venueLL,data);
        const withDist=data.map((v,i)=>({...v,distance_km:kms[i]||0}));
        onVendorsLoaded(withDist,venue,venueLL,dateFrom);
      } else {
        onVendorsLoaded(data,venue,venueLL,dateFrom);
      }
    }catch(e){setError('Could not load vendors. Please try again.');}
    setLoading(false);
  }

  return(
    <div style={{flex:1,overflowY:'auto',background:'#fff'}}>
      {/* Hero — light off-white */}
      <div style={{padding:'28px 20px 10px'}}>
        <div style={{fontSize:'0.64rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--rose)',marginBottom:8,fontWeight:500}}>Your wedding, your way</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:300,color:'var(--forest)',lineHeight:1.15,marginBottom:6}}>Find the <em style={{color:'var(--rose)',fontStyle:'italic'}}>perfect</em> vendors</h1>
        <p style={{fontSize:'0.82rem',color:'var(--light)',lineHeight:1.6,marginBottom:20}}>Enter your venue and we'll calculate real travel costs for every vendor.</p>
      </div>

      {/* Search card */}
      <div style={{margin:'0 16px',background:'#fff',borderRadius:14,padding:'18px',boxShadow:'0 2px 14px rgba(0,0,0,0.06)',position:'relative',zIndex:2,border:'1px solid #ede8e0'}}>
        {/* Venue */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:'0.65rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--mid)',marginBottom:6,fontWeight:500}}>Wedding Venue</div>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--cream)',borderRadius:10,padding:'10px 14px',border:`1.5px solid ${venuePinned?'var(--forest)':'var(--parchment)'}`}}>
            <span style={{flexShrink:0,color:'var(--light)',display:'flex'}}>{IC.pin(18,'var(--light)')}</span>
            <MobileVenueInput
              placeholder="e.g. Babylonstoren, Franschhoek"
              initialValue={venue}
              onPinned={(name,ll)=>{setVenue(name);setVenueLL(ll);setVenuePinned(true);}}
              style={{}}
            />
            {venuePinned&&<span style={{fontSize:'0.7rem',color:'var(--forest)',fontWeight:600,flexShrink:0}}>✓</span>}
          </div>
          {venuePinned&&<div style={{fontSize:'0.68rem',color:'var(--forest)',marginTop:4,paddingLeft:4}}>Location pinned — distances will be calculated</div>}
        </div>

        {/* Date */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:'0.65rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--mid)',marginBottom:6,fontWeight:500}}>Wedding Date (optional)</div>
          <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--cream)',borderRadius:10,padding:'10px 14px',border:'1.5px solid var(--parchment)'}}>
            <span style={{flexShrink:0,color:'var(--light)',display:'flex'}}>{IC.calendar(18,'var(--light)')}</span>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',outline:'none',flex:1}}/>
          </div>
        </div>

        {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:10,padding:'8px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8}}>{error}</div>}

        <button onClick={doSearch} disabled={loading} style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:12,padding:'14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.95rem',fontWeight:600,cursor:loading?'wait':'pointer',letterSpacing:'0.04em'}}>
          {loading?'Finding vendors…':'Search Vendors →'}
        </button>
      </div>

      {/* Category quick-picks */}
      <div style={{padding:'20px 16px 8px'}}>
        <div style={{fontSize:'0.72rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--mid)',marginBottom:12,fontWeight:500}}>Browse by category</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {ALL_TYPES.map(t=>(
            <button key={t} onClick={async()=>{
              setLoading(true);setError('');
              try{
                const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=name');
                onVendorsLoaded(data.filter(v=>v.type===t),venue,venueLL,dateFrom,t);
              }catch{setError('Could not load.');}
              setLoading(false);
            }} style={{background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:999,padding:'6px 14px',fontSize:'0.78rem',cursor:'pointer',color:'var(--forest)',fontWeight:500}}>
<span style={{display:'flex',alignItems:'center',gap:5}}><span style={{display:'flex'}}>{(TYPE_ICON[t]||IC.camera)(14,'var(--forest)')}</span>{t}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mobile Results Screen ──────────────────────────────────────────────────────
function MobileResultsScreen({vendors,venue,venueLL,dateFrom,onBack,onOpen,onQuote,customerId,activeType,setActiveType}) {
  const [search,setSearch]=useState('');

  const types=[...new Set(vendors.map(v=>v.type))].filter(t=>ALL_TYPES.includes(t)).sort((a,b)=>ALL_TYPES.indexOf(a)-ALL_TYPES.indexOf(b));

  const filtered=vendors.filter(v=>{
    if(activeType&&v.type!==activeType)return false;
    if(search&&!v.name.toLowerCase().includes(search.toLowerCase())&&!v.location.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'1px solid #f0ebe4',padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <button onClick={onBack} style={{background:'#f5f0eb',border:'none',borderRadius:8,padding:'6px 8px',color:'var(--mid)',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:4}}>{IC.back(18,'var(--mid)')}</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.82rem',fontWeight:600,color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span style={{display:'flex'}}>{IC.pin(14,'var(--rose)')}</span>{venue||'All vendors'}</div>
          <div style={{fontSize:'0.7rem',color:'var(--light)'}}>{vendors.length} vendors found{dateFrom?` · ${formatDateDisplay(dateFrom)}`:''}</div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{background:'#fff',padding:'10px 14px',borderBottom:'1px solid var(--parchment)',flexShrink:0}}>
        <div style={{background:'var(--cream)',borderRadius:10,padding:'8px 14px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{display:'flex'}}>{IC.search(16,'var(--light)')}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendors…" style={{border:'none',background:'transparent',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',outline:'none',flex:1}}/>
          {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:'var(--light)',cursor:'pointer',padding:0,display:'flex'}}>{IC.x(14,'var(--light)')}</button>}
        </div>
      </div>

      {/* Type filter pills */}
      <div style={{background:'#fff',padding:'8px 14px 10px',display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none',flexShrink:0,borderBottom:'1px solid var(--parchment)'}}>
        <button onClick={()=>setActiveType(null)} style={{flexShrink:0,background:!activeType?'var(--forest)':'var(--parchment)',color:!activeType?'var(--gold-light)':'var(--mid)',border:'none',borderRadius:999,padding:'5px 14px',fontSize:'0.76rem',fontWeight:500,cursor:'pointer'}}>All</button>
        {types.map(t=>(
          <button key={t} onClick={()=>setActiveType(activeType===t?null:t)} style={{flexShrink:0,background:activeType===t?'var(--forest)':'var(--parchment)',color:activeType===t?'var(--gold-light)':'var(--mid)',border:'none',borderRadius:999,padding:'5px 14px',fontSize:'0.76rem',fontWeight:500,cursor:'pointer'}}>
            {TYPE_EMOJI[t]} {t}
          </button>
        ))}
      </div>

      {/* Vendor list */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 14px',background:'#fff'}}>
        {filtered.length===0
          ?<div style={{textAlign:'center',padding:'40px 20px',color:'var(--light)'}}>
            <div style={{fontSize:'2rem',marginBottom:8}}>🔍</div>
            <div style={{fontSize:'0.88rem'}}>No vendors match your search</div>
          </div>
          :filtered.map(v=>(
            <MobileVendorCard key={v.id} vendor={v} onOpen={()=>onOpen(v)} onQuote={()=>onQuote(v)} customerId={customerId}/>
          ))
        }
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

// ── Mobile Vendor Detail ───────────────────────────────────────────────────────
function MobileVendorDetail({vendor,dateFrom,venueLabel,venueLatLng,onBack,onQuote}) {
  const [tab,setTab]=useState('about');
  const travel=(vendor.distance_km||0)*(vendor.per_km_rate||0);
  const overnight=(vendor.distance_km||0)>(vendor.overnight_threshold_km||80)?(vendor.overnight_fee||0):0;
  const total=(vendor.fixed_rate||0)+travel+overnight;
  const imgs=vendor.images||[];
  const [imgIdx,setImgIdx]=useState(0);
  const onReq=isOnRequest(vendor);

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Hero image */}
      <div style={{height:240,position:'relative',background:imgs[imgIdx]?.url?`url(${imgs[imgIdx].url}) center/cover`:`linear-gradient(140deg,${vendor.color||'#c8a87a'}cc,${vendor.color||'#c8a87a'}55)`,flexShrink:0}}>
        <button onClick={onBack} style={{position:'absolute',top:12,left:12,background:'rgba(0,0,0,0.35)',border:'none',borderRadius:10,padding:'6px 12px',color:'#fff',cursor:'pointer',fontSize:'0.82rem',backdropFilter:'blur(4px)'}}>‹ Back</button>
        {imgs.length>1&&(
          <div style={{position:'absolute',bottom:10,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5}}>
            {imgs.map((_,i)=><div key={i} onClick={()=>setImgIdx(i)} style={{width:6,height:6,borderRadius:'50%',background:i===imgIdx?'#fff':'rgba(255,255,255,0.4)',cursor:'pointer'}}/>)}
          </div>
        )}
        <div style={{position:'absolute',top:12,right:12,background:'rgba(58,74,63,0.85)',color:'var(--gold-light)',fontSize:'0.65rem',letterSpacing:'0.1em',textTransform:'uppercase',padding:'3px 10px',borderRadius:999}}>{TYPE_EMOJI[vendor.type]} {vendor.type}</div>
      </div>

      {/* Name + price strip */}
      <div style={{background:'#fff',padding:'14px 16px 0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10,marginBottom:4}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:600,color:'var(--forest)',lineHeight:1.2,flex:1}}>{vendor.name}</div>
          <div style={{textAlign:'right',flexShrink:0}}>
            {onReq?<div style={{fontSize:'0.88rem',color:'var(--rose)',fontWeight:700,fontStyle:'italic'}}>On Request</div>:<div style={{fontSize:'1.1rem',color:'var(--rose)',fontWeight:700}}>{fmt(total)}</div>}
            {venueLabel&&<div style={{fontSize:'0.68rem',color:'var(--light)',marginTop:2}}>from {venueLabel}</div>}
          </div>
        </div>
        <div style={{fontSize:'0.76rem',color:'var(--light)',marginBottom:12}}>📍 {vendor.location}{vendor.distance_km?` · ${vendor.distance_km} km away`:''}</div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--parchment)',gap:0}}>
          {['about','pricing','availability'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,background:'none',border:'none',borderBottom:`2px solid ${tab===t?'var(--forest)':'transparent'}`,padding:'8px 4px',fontSize:'0.78rem',fontWeight:tab===t?600:400,color:tab===t?'var(--forest)':'var(--light)',cursor:'pointer',textTransform:'capitalize'}}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflowY:'auto',background:'#fafafa',padding:'14px 16px'}}>
        {tab==='about'&&(
          <div>
            {vendor.description&&<div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:12,fontSize:'0.86rem',color:'var(--charcoal)',lineHeight:1.7}}>{vendor.description}</div>}
            {vendor.extra_info&&<div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:12}}>
              <div style={{fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--mid)',marginBottom:8,fontWeight:500}}>Additional Info</div>
              <div style={{fontSize:'0.84rem',color:'var(--mid)',lineHeight:1.7}}>{vendor.extra_info}</div>
            </div>}
            {vendor.instagram&&(
              <a href={`https://instagram.com/${vendor.instagram.replace('@','')}`} target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',gap:10,background:'#fff',borderRadius:12,padding:'12px 14px',textDecoration:'none',marginBottom:12}}>
                <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{IC.instagram(16,'#fff')}</div>
                <div>
                  <div style={{fontSize:'0.8rem',fontWeight:600,color:'var(--forest)'}}>@{vendor.instagram.replace('@','')}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--light)'}}>View Instagram</div>
                </div>
              </a>
            )}
          </div>
        )}

        {tab==='pricing'&&(
          <div>
            {onReq?(
              <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:12}}>
                <div style={{fontSize:'0.92rem',fontWeight:600,color:'var(--forest)',marginBottom:8}}>Pricing on Request</div>
                <div style={{fontSize:'0.84rem',color:'var(--mid)',lineHeight:1.7,marginBottom:12}}>This vendor's pricing varies based on your specific requirements. Request a quote to get a personalised price.</div>
                {vendor.distance_km>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',padding:'8px 0',borderTop:'1px solid var(--parchment)'}}><span style={{color:'var(--mid)'}}>Travel ({vendor.distance_km} km)</span><span style={{fontWeight:600}}>{fmt(travel)}</span></div>}
                {overnight>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.82rem',padding:'8px 0',borderTop:'1px solid var(--parchment)'}}><span style={{color:'var(--mid)'}}>Overnight fee</span><span style={{fontWeight:600}}>{fmt(overnight)}</span></div>}
              </div>
            ):(
              <div style={{background:'#fff',borderRadius:12,padding:'14px',marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.84rem',padding:'8px 0'}}><span style={{color:'var(--mid)'}}>Base rate</span><span style={{fontWeight:500}}>{fmt(vendor.fixed_rate)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.84rem',padding:'8px 0',borderTop:'1px solid var(--parchment)'}}><span style={{color:'var(--mid)'}}>Travel ({vendor.distance_km||0} km × R{vendor.per_km_rate}/km)</span><span style={{fontWeight:500}}>{fmt(travel)}</span></div>
                {overnight>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'0.84rem',padding:'8px 0',borderTop:'1px solid var(--parchment)'}}><span style={{color:'var(--mid)'}}>Overnight fee</span><span style={{fontWeight:500}}>{fmt(overnight)}</span></div>}
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.92rem',padding:'12px 0 4px',borderTop:'2px solid var(--parchment)',marginTop:4}}><span style={{color:'var(--forest)',fontWeight:700}}>Estimated total</span><span style={{color:'var(--rose)',fontWeight:700}}>{fmt(total)}</span></div>
              </div>
            )}
          </div>
        )}

        {tab==='availability'&&(
          <div style={{background:'#fff',borderRadius:12,padding:'14px'}}>
            <div style={{fontSize:'0.84rem',color:'var(--mid)',marginBottom:12}}>Check available dates for this vendor below.</div>
            <Calendar year={new Date().getFullYear()} month={new Date().getMonth()} unavailDates={new Set((vendor.unavail_dates||[]).map(d=>d.date))} weddingDate={dateFrom}
              onPrev={()=>{}} onNext={()=>{}}/>
          </div>
        )}
        <div style={{height:80}}/>
      </div>

      {/* Sticky CTA */}
      <div style={{background:'#fff',padding:'12px 16px',borderTop:'1px solid var(--parchment)',flexShrink:0}}>
        <button onClick={onQuote} style={{width:'100%',background:'var(--rose)',color:'#fff',border:'none',borderRadius:14,padding:'15px',fontFamily:"'DM Sans',sans-serif",fontSize:'1rem',fontWeight:600,cursor:'pointer',letterSpacing:'0.04em'}}>
          💌 Request a Quote
        </button>
      </div>
    </div>
  );
}

// ── Mobile Quotes Screen ───────────────────────────────────────────────────────
function MobileQuotesScreen({user,onBrowse,initialLead=null,onRequestQuote}) {
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [activeLead,setActiveLead]=useState(null);
  const initialApplied=useRef(false);
  const pollRef=useRef(null);
  const STATUS_META={new:{label:'New',color:'#9a7a3a',bg:'rgba(201,169,110,0.12)'},responded:{label:'Responded',color:'#2a6a4a',bg:'rgba(58,122,90,0.1)'},closed:{label:'Closed',color:'#777',bg:'rgba(168,168,168,0.12)'}};

  useEffect(()=>{
    loadLeads();
    pollRef.current=setInterval(loadLeads,8000);
    return()=>clearInterval(pollRef.current);
  },[]);

  useEffect(()=>{
    if(initialLead&&leads.length>0&&!initialApplied.current){
      const found=leads.find(l=>l.id===initialLead.id);
      if(found){setActiveLead(found);initialApplied.current=true;}
    }
  },[leads]);

  async function loadLeads(){
    try{
      const data=await supaFetch(`leads?customer_id=eq.${user.customerId}&select=*,vendor:vendors(name,type,color,images:vendor_images(url))&order=created_at.desc`);
      const withMsgs=await Promise.all((data||[]).map(async lead=>{
        try{const msgs=await supaFetch(`messages?lead_id=eq.${lead.id}&order=created_at.desc&limit=1&select=*`);return{...lead,last_message:Array.isArray(msgs)?msgs[0]:null};}
        catch{return lead;}
      }));
      setLeads(withMsgs);
    }catch(e){}
    setLoading(false);
  }

  if(activeLead) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <ChatThread lead={{...activeLead,customer_name:user.name,vendor_name:activeLead.vendor?.name}} currentRole="customer" currentName={user.name} onBack={()=>setActiveLead(null)}/>
    </div>
  );

  // Grouped by type
  const grouped={};
  leads.forEach(l=>{const t=l.vendor?.type||'Other';if(!grouped[t])grouped[t]=[];grouped[t].push(l);});
  const orderedTypes=[...ALL_TYPES.filter(t=>grouped[t]),...Object.keys(grouped).filter(t=>!ALL_TYPES.includes(t)&&grouped[t])];
  const unread=leads.filter(l=>l.last_message?.sender_role==='vendor').length;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'1px solid #f0ebe4',padding:'14px 16px 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--gold-light)',fontWeight:600}}>My Quotes</div>
            <div style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.5)',marginTop:2}}>Hi, {user.name}</div>
          </div>
          {unread>0&&<div style={{background:'var(--rose)',color:'#fff',borderRadius:999,fontSize:'0.72rem',fontWeight:700,padding:'3px 10px'}}>{unread} new</div>}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',background:'#fff',padding:'12px 14px'}}>
        {loading?(
          <div style={{textAlign:'center',padding:'60px 20px',color:'var(--light)'}}>
            <div style={{fontSize:'2rem',marginBottom:8}}>💬</div>
            <div>Loading your quotes…</div>
          </div>
        ):leads.length===0?(
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <div style={{fontSize:'3rem',marginBottom:12}}>💌</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',color:'var(--forest)',marginBottom:8}}>No quotes yet</div>
            <p style={{fontSize:'0.84rem',color:'var(--mid)',marginBottom:20,lineHeight:1.6}}>Browse vendors and tap "Request a Quote" to start a conversation.</p>
            <button onClick={onBrowse} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'12px 24px',fontSize:'0.88rem',fontWeight:600,cursor:'pointer'}}>Browse Vendors</button>
          </div>
        ):(
          orderedTypes.map(type=>(
            <div key={type} style={{marginBottom:22}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontSize:'1.1rem'}}>{TYPE_EMOJI[type]||'💼'}</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.1rem',fontWeight:600,color:'var(--forest)'}}>{type}</span>
                <span style={{fontSize:'0.68rem',color:'var(--light)',background:'var(--parchment)',padding:'2px 8px',borderRadius:999}}>{grouped[type].length}</span>
              </div>
              {grouped[type].map(lead=>{
                const sm=STATUS_META[lead.status]||STATUS_META.new;
                const hasNew=lead.last_message?.sender_role==='vendor';
                return(
                  <div key={lead.id} onClick={()=>setActiveLead(lead)}
                    style={{background:'#fff',borderRadius:12,padding:'12px 14px',marginBottom:8,cursor:'pointer',display:'flex',alignItems:'center',gap:12,border:`1px solid ${hasNew?'rgba(196,130,106,0.3)':'#f0ebe4'}`,borderLeft:`3px solid ${hasNew?'var(--rose)':'#f0ebe4'}`}}>
                    <div style={{width:42,height:42,borderRadius:9,background:lead.vendor?.images?.[0]?.url?`url(${lead.vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${lead.vendor?.color||'#c8a87a'}cc,${lead.vendor?.color||'#c8a87a'}55)`,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:1}}>
                        <span style={{fontWeight:600,fontSize:'0.88rem',color:'var(--forest)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.vendor?.name}</span>
                        {hasNew&&<span style={{width:7,height:7,borderRadius:'50%',background:'var(--rose)',flexShrink:0,display:'inline-block'}}/>}
                      </div>
                      <div style={{fontSize:'0.72rem',color:'var(--mid)',marginBottom:hasNew?3:0}}>{lead.title}</div>
                      {lead.last_message&&<div style={{fontSize:'0.71rem',color:'var(--light)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.last_message.sender_role==='vendor'?'Vendor: ':''}{lead.last_message.message_text||'📎 Attachment'}</div>}
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <span style={{fontSize:'0.65rem',fontWeight:600,color:sm.color,background:sm.bg,borderRadius:999,padding:'2px 8px',display:'block',marginBottom:4}}>{sm.label}</span>
                      <span style={{fontSize:'0.65rem',color:'var(--light)'}}>{lead.created_at?new Date(lead.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short'}):''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div style={{height:20}}/>
      </div>
    </div>
  );
}

// ── Mobile Home (public, not logged in) ───────────────────────────────────────
function MobileHomeTab({onVendorsLoaded}) {
  return <MobileSearchScreen onVendorsLoaded={onVendorsLoaded}/>;
}

// ── MOBILE APP ROOT ────────────────────────────────────────────────────────────
function MobileApp({user,onLogin,onLogout,requestQuote,quoteVendor,setQuoteVendor,newLeadAfterQuote,setNewLeadAfterQuote}) {
  const [screen,setScreen]=useState('home'); // 'home'|'browse'|'quotes'|'plan'
  const [vendors,setVendors]=useState([]);
  const [venue,setVenue]=useState('');
  const [venueLL,setVenueLL]=useState(null);
  const [dateFrom,setDateFrom]=useState('');
  const [activeVendor,setActiveVendor]=useState(null);
  const [activeType,setActiveType]=useState(null);
  const [showSearch,setShowSearch]=useState(true);
  const [showCustomerAuth,setShowCustomerAuth]=useState(false);
  const [showVendorLogin,setShowVendorLogin]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);

  useEffect(()=>{if(newLeadAfterQuote)setScreen('quotes');},[newLeadAfterQuote]);

  function handleVendorsLoaded(v,venueName,ll,date,type=null){
    setVendors(v);setVenue(venueName||'');setVenueLL(ll||null);
    setDateFrom(date||'');setActiveType(type);setShowSearch(false);setScreen('browse');
  }
  function handleRequestQuote(vendor){
    if(user&&user.role==='customer')requestQuote(vendor);
    else setShowCustomerAuth(true);
  }
  function goScreen(s){setScreen(s);setMenuOpen(false);}

  const MENU_ITEMS=[
    {id:'home',  icon:IC.home,  label:'Home'},
    {id:'quotes',icon:IC.chat,  label:'My Quotes'},
    {id:'plan',  icon:IC.rings, label:'Wedding Plan'},
  ];

  // Full-screen vendor detail overlay
  if(activeVendor) return(
    <div style={{position:'fixed',inset:0,zIndex:600,background:'#fff',display:'flex',flexDirection:'column'}}>
      <MobileVendorDetail vendor={activeVendor} dateFrom={dateFrom} venueLabel={venue} venueLatLng={venueLL}
        onBack={()=>setActiveVendor(null)} onQuote={()=>{handleRequestQuote(activeVendor);setActiveVendor(null);}}/>
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',background:'#ffffff',fontFamily:"'DM Sans',sans-serif",colorScheme:'light'}}>
      <GlobalStyles/>

      {/* Modals */}
      {quoteVendor&&<QuoteModal vendor={quoteVendor} customer={user} onClose={()=>setQuoteVendor(null)} onSubmitted={lead=>{setQuoteVendor(null);setNewLeadAfterQuote(lead);}}/>}
      {showCustomerAuth&&<CustomerAuthModal onLogin={u=>{onLogin(u);setShowCustomerAuth(false);}} onClose={()=>setShowCustomerAuth(false)} onVendorLogin={()=>setShowVendorLogin(true)}/>}
      {showVendorLogin&&<LoginModal onLogin={u=>{onLogin(u);setShowVendorLogin(false);}} onClose={()=>setShowVendorLogin(false)}/>}

      {/* Burger menu drawer */}
      {menuOpen&&(
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300}}/>
          <div style={{position:'fixed',top:0,left:0,bottom:0,width:260,background:'#fff',zIndex:301,display:'flex',flexDirection:'column',boxShadow:'4px 0 24px rgba(0,0,0,0.1)',paddingTop:'max(20px,env(safe-area-inset-top))'}}>
            {/* Drawer header */}
            <div style={{padding:'16px 20px 20px',borderBottom:'1px solid #f0ebe4'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--forest)',letterSpacing:'0.06em',marginBottom:4}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
              {user&&user.role==='customer'
                ?<div style={{fontSize:'0.76rem',color:'var(--mid)'}}>Hi, {user.name} 👋</div>
                :<div style={{fontSize:'0.76rem',color:'var(--light)'}}>Discover your perfect vendors</div>}
            </div>
            {/* Nav items */}
            <div style={{flex:1,padding:'8px 0'}}>
              {MENU_ITEMS.map(item=>(
                <button key={item.id} onClick={()=>goScreen(item.id)}
                  style={{width:'100%',textAlign:'left',background:screen===item.id?'rgba(58,74,63,0.05)':'none',border:'none',borderLeft:`3px solid ${screen===item.id?'var(--forest)':'transparent'}`,padding:'14px 20px',fontSize:'0.9rem',color:screen===item.id?'var(--forest)':'var(--charcoal)',fontWeight:screen===item.id?600:400,cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontFamily:"'DM Sans',sans-serif"}}>
                  <span style={{color:screen===item.id?'var(--forest)':'var(--light)'}}>{item.icon(20,screen===item.id?'var(--forest)':'var(--light)')}</span>{item.label}
                </button>
              ))}
            </div>
            {/* Auth at bottom */}
            <div style={{padding:'16px 20px',borderTop:'1px solid #f0ebe4',paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
              {user&&user.role==='customer'
                ?<button onClick={()=>{onLogout();setMenuOpen(false);}} style={{width:'100%',background:'#f5f0eb',color:'var(--mid)',border:'none',borderRadius:10,padding:'11px',fontSize:'0.86rem',cursor:'pointer',fontWeight:500}}>Sign Out</button>
                :<div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button onClick={()=>{setShowCustomerAuth(true);setMenuOpen(false);}} style={{width:'100%',background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,padding:'11px',fontSize:'0.86rem',fontWeight:600,cursor:'pointer'}}>Log In</button>
                  <button onClick={()=>{setShowCustomerAuth(true);setMenuOpen(false);}} style={{width:'100%',background:'none',color:'var(--forest)',border:'1.5px solid var(--parchment)',borderRadius:10,padding:'10px',fontSize:'0.86rem',fontWeight:500,cursor:'pointer'}}>Sign Up</button>
                </div>}
            </div>
          </div>
        </>
      )}

      {/* Top nav bar — burger left, brand centre, auth right */}
      <div style={{background:'#fff',borderBottom:'1px solid #f0ebe4',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,flexShrink:0,paddingTop:'env(safe-area-inset-top)',boxShadow:'0 1px 6px rgba(0,0,0,0.04)'}}>
        {/* Burger */}
        <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',borderRadius:8,display:'flex',alignItems:'center'}}>{IC.menu(22,'var(--charcoal)')}</button>
        {/* Brand */}
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',fontWeight:300,color:'var(--forest)',letterSpacing:'0.06em',position:'absolute',left:'50%',transform:'translateX(-50%)'}}>
          Vow<span style={{color:'var(--rose)',fontStyle:'italic'}}>Finds</span>
        </div>
        {/* Auth shortcut */}
        {user&&user.role==='customer'
          ?<div style={{width:32,height:32,borderRadius:'50%',background:'var(--forest)',color:'var(--gold-light)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.78rem',fontWeight:700}}>{(user.name||'U')[0].toUpperCase()}</div>
          :<button onClick={()=>setShowCustomerAuth(true)} style={{background:'none',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'5px 12px',fontSize:'0.76rem',color:'var(--forest)',cursor:'pointer',fontWeight:500}}>Login</button>
        }
      </div>

      {/* Main content */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {screen==='home'&&(
          showSearch
            ?<MobileSearchScreen onVendorsLoaded={handleVendorsLoaded}/>
            :<MobileResultsScreen vendors={vendors} venue={venue} venueLL={venueLL} dateFrom={dateFrom}
                onBack={()=>setShowSearch(true)} onOpen={setActiveVendor} onQuote={handleRequestQuote}
                customerId={user?.customerId} activeType={activeType} setActiveType={setActiveType}/>
        )}

        {screen==='quotes'&&(
          user&&user.role==='customer'
            ?<MobileQuotesScreen user={user} onBrowse={()=>setScreen('browse')} initialLead={newLeadAfterQuote} onRequestQuote={handleRequestQuote}/>
            :<div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:14,background:'#fff'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:4}}>{IC.chat(48,'var(--parchment)')}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',textAlign:'center'}}>Your quotes live here</div>
              <p style={{fontSize:'0.84rem',color:'var(--light)',textAlign:'center',lineHeight:1.7,maxWidth:260}}>Log in to view your conversations with vendors.</p>
              <button onClick={()=>setShowCustomerAuth(true)} style={{background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:12,padding:'12px 32px',fontSize:'0.9rem',fontWeight:600,cursor:'pointer'}}>Log In</button>
            </div>
        )}
        {screen==='plan'&&(
          <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            <WeddingPlan vendors={vendors} onClose={()=>setScreen('home')}
              onSearchVendors={({venueName,venueLL:ll,type})=>{
                setVenue(venueName||venue);
                if(ll)setVenueLL(ll);
                setActiveType(type);
                setShowSearch(false);
                setScreen('home');
                supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
                  .then(async data=>{
                    if(ll){const kms=await getBatchDistancesKm(ll,data);setVendors(data.map((v,i)=>({...v,distance_km:kms[i]||0})));}
                    else setVendors(data);
                  }).catch(()=>{});
              }}/>
          </div>
        )}
      </div>
    </div>
  );
}


export default function VowFinds() {
  const isMobile=useIsMobile();
  const [view,setView]=useState('customer');
  const [venue,setVenue]=useState('');
  const [venueLatLng,setVenueLatLng]=useState(null);
  const [dateFrom,setDateFrom]=useState('');
  const [dateTo,setDateTo]=useState('');
  const [selectedTypes,setSelectedTypes]=useState(new Set());
  const [searched,setSearched]=useState(false);
  const [vendors,setVendors]=useState([]);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [calcProgress,setCalcProgress]=useState('');
  const [activeVendor,setActiveVendor]=useState(null);
  const [prevScroll,setPrevScroll]=useState(0);
  const [showMap,setShowMap]=useState(true);
  const [user,setUser]=useState(()=>loadSession());
  const [showLoginModal,setShowLoginModal]=useState(false);
  const [showCustomerAuth,setShowCustomerAuth]=useState(false);
  const [quoteVendor,setQuoteVendor]=useState(null);
  const [pendingQuoteVendor,setPendingQuoteVendor]=useState(null);
  const [customerView,setCustomerView]=useState('browse'); // 'browse' | 'dashboard' | 'favourites' | 'scenario' | 'weddingplan'
  const [newLeadAfterQuote,setNewLeadAfterQuote]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [showScenario,setShowScenario]=useState(false);
  const [showWeddingPlan,setShowWeddingPlan]=useState(false);
  const [planMaxPrices,setPlanMaxPrices]=useState(null); // set by WeddingPlan search

  function handleLogin(u){
    setUser(u);
    saveSession(u);
    if(u.role==='customer'&&pendingQuoteVendor){setQuoteVendor(pendingQuoteVendor);setPendingQuoteVendor(null);}
  }
  function handleLogout(){setUser(null);clearSession();setView('customer');setCustomerView('browse');setMenuOpen(false);}

  function requestQuote(vendor){
    if(user&&user.role==='customer'){setQuoteVendor(vendor);}
    else{setPendingQuoteVendor(vendor);setShowCustomerAuth(true);}
  }

  // If logged in, show dashboard
  if(user&&user.role==='admin')return(
    <>
      <GlobalStyles/>
      <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',height:60,position:'sticky',top:0,zIndex:200}}>
        <div onClick={()=>handleLogout()} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em',cursor:'pointer'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
        <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.6)'}}>Admin Panel</span>
      </nav>
      <AdminDashboard onLogout={handleLogout}/>
    </>
  );

  if(user&&user.role==='vendor')return(
    <>
      <GlobalStyles/>
      <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',height:60,position:'sticky',top:0,zIndex:200}}>
        <div onClick={()=>handleLogout()} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em',cursor:'pointer'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
        <span style={{fontSize:'0.78rem',color:'rgba(255,255,255,0.6)'}}>Vendor Portal</span>
      </nav>
      <VendorDashboard user={user} onLogout={handleLogout}/>
    </>
  );

  // ── Mobile: render separate mobile UI ────────────────────────────────────────
  if(isMobile&&(!user||user.role==='customer')){
    return(
      <MobileApp
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        requestQuote={requestQuote}
        quoteVendor={quoteVendor}
        setQuoteVendor={setQuoteVendor}
        newLeadAfterQuote={newLeadAfterQuote}
        setNewLeadAfterQuote={setNewLeadAfterQuote}
      />
    );
  }

  if(user&&user.role==='customer'){
    // After submitting a quote, go straight to dashboard with that lead open
    function handleQuoteSubmitted(lead){
      setQuoteVendor(null);
      setNewLeadAfterQuote(lead);
      setCustomerView('dashboard');
    }
    return(
      <>
        <GlobalStyles/>
        {quoteVendor&&<QuoteModal vendor={quoteVendor} customer={user} onClose={()=>setQuoteVendor(null)} onSubmitted={handleQuoteSubmitted}/>}

        {/* Customer nav */}
        <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',height:56,position:'sticky',top:0,zIndex:200,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* Hamburger */}
            <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',display:'flex',flexDirection:'column',gap:4}}>
              <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
              <div style={{width:14,height:2,background:'var(--gold-light)',borderRadius:2}}/>
              <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
            </button>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.06em'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {customerView==='dashboard'&&(
              <button onClick={()=>{setCustomerView('browse');setNewLeadAfterQuote(null);}} style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:'rgba(255,255,255,0.8)',cursor:'pointer'}}>
                ‹ Browse
              </button>
            )}
            <button onClick={()=>setCustomerView(v=>v==='browse'?'dashboard':'browse')}
              style={{background:customerView!=='browse'?'rgba(255,255,255,0.15)':'rgba(201,169,110,0.2)',border:`1px solid ${customerView!=='browse'?'rgba(255,255,255,0.25)':'rgba(201,169,110,0.4)'}`,borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:customerView!=='browse'?'rgba(255,255,255,0.9)':'var(--gold-light)',cursor:'pointer'}}>
              {customerView==='browse'?'My Quotes':customerView==='dashboard'?'Browse':customerView==='favourites'?'⭐ Favourites':'🗂 Scenarios'}
            </button>
            <span style={{fontSize:'0.74rem',color:'rgba(255,255,255,0.5)'}}>Hi, {user.name}</span>
          </div>
        </nav>

        {/* Dropdown menu */}
        {menuOpen&&(
          <>
            <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:198}}/>
            <div style={{position:'fixed',top:56,left:0,width:220,background:'var(--white)',boxShadow:'4px 0 20px rgba(0,0,0,0.12)',zIndex:199,borderRight:'1px solid var(--parchment)',padding:'8px 0'}}>
              {[
                {label:'Wedding Plan',action:()=>{setCustomerView('weddingplan');setMenuOpen(false);}},
                {label:'Browse Vendors',action:()=>{setCustomerView('browse');setMenuOpen(false);}},
                {label:'Favourites',action:()=>{setCustomerView('favourites');setMenuOpen(false);}},
                {label:'Scenario Builder',action:()=>{setCustomerView('scenario');setMenuOpen(false);}},
                {label:'My Quotes',action:()=>{setCustomerView('dashboard');setMenuOpen(false);}},
                {label:'Sign Out',action:()=>{handleLogout();setMenuOpen(false);}},
              ].map(item=>(
                <button key={item.label} onClick={item.action} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 20px',background:'none',border:'none',fontSize:'0.88rem',color:'var(--charcoal)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                  onMouseLeave={e=>e.currentTarget.style.background='none'}>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {customerView==='dashboard'?(
          <CustomerDashboard user={user} onLogout={handleLogout} onBrowse={()=>setCustomerView('browse')} initialLead={newLeadAfterQuote}/>
        ):customerView==='favourites'?(
          <FavouritesView customerId={user?.customerId} onOpenDetail={(v)=>{setActiveVendor(v);setView('detail');setCustomerView('browse');}} onRequestQuote={requestQuote} dateFrom={dateFrom} dateTo={dateTo}/>
        ):customerView==='weddingplan'?(
          <WeddingPlan vendors={vendors} onClose={()=>setCustomerView('browse')}
            onSearchVendors={({venueName,venueLL,type,maxPrice})=>{
              const newVenue=venueName||venue;
              const newLL=venueLL||venueLatLng;
              setVenue(newVenue);
              if(newLL)setVenueLatLng(newLL);
              setSelectedTypes(new Set([type]));
              if(maxPrice!==null)setPlanMaxPrices(prev=>({...(prev||{}),[type]:maxPrice}));
              setSearched(true);
              setCustomerView('browse');
              // Trigger a fresh vendor load so results show immediately
              if(newVenue.trim()){
                setLoading(true);setLoadError('');setCalcProgress('');
                supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
                  .then(async data=>{
                    if(newLL){
                      setCalcProgress('Calculating distances…');
                      const kms=await getBatchDistancesKm(newLL,data);
                      setVendors(data.map((v,i)=>({...v,distance_km:kms[i]||0})));
                    }else setVendors(data);
                    setCalcProgress('');
                  }).catch(e=>setLoadError('Could not load vendors: '+e.message))
                  .finally(()=>setLoading(false));
              }
            }}
          />
        ):customerView==='scenario'?(
          <ScenarioBuilder user={user} vendors={vendors} onClose={()=>setCustomerView('browse')}/>
        ):(
          /* Customer browse view */
          <div>
            {view==='detail'&&activeVendor?(
              <div>
                <div style={{padding:'12px 20px',background:'var(--cream)',borderBottom:'1px solid var(--parchment)',display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>setView('customer')} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',fontSize:'0.82rem',color:'var(--mid)',padding:0}}>‹ Back to results</button>
                </div>
                <VendorDetail vendor={activeVendor} dateFrom={dateFrom} dateTo={dateTo} venueLabel={venue} venueLatLng={venueLatLng} onBack={()=>setView('customer')} onRequestQuote={requestQuote}/>
              </div>
            ):(
              <CustomerBrowseView
                user={user}
                venue={venue} setVenue={setVenue}
                venueLatLng={venueLatLng} setVenueLatLng={setVenueLatLng}
                dateFrom={dateFrom} setDateFrom={setDateFrom}
                dateTo={dateTo} setDateTo={setDateTo}
                selectedTypes={selectedTypes} setSelectedTypes={setSelectedTypes}
                vendors={vendors} setVendors={setVendors}
                loading={loading} setLoading={setLoading}
                loadError={loadError} setLoadError={setLoadError}
                calcProgress={calcProgress} setCalcProgress={setCalcProgress}
                searched={searched} setSearched={setSearched}
                showMap={showMap} setShowMap={setShowMap}
                openDetail={(v)=>{setPrevScroll(0);setActiveVendor(v);setView('detail');window.scrollTo({top:0});}}
                onRequestQuote={requestQuote}
                planMaxPrices={planMaxPrices}
              />
            )}
          </div>
        )}
      </>
    );
  }

  // Public browse view
  const toggleType=(type)=>{if(type==='all'){setSelectedTypes(prev=>prev.size===ALL_TYPES.length?new Set():new Set(ALL_TYPES));}else{setSelectedTypes(prev=>{const next=new Set(prev);next.has(type)?next.delete(type):next.add(type);return next;});}};

  async function loadVendors(latLng){
    if(!venue.trim())return;
    setLoading(true);setLoadError('');setCalcProgress('');
    try{
      const data=await supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name');
      if(latLng){
        setCalcProgress('Calculating distances…');
        try{
          const kms=await getBatchDistancesKm(latLng,data);
          const updated=data.map((v,i)=>({...v,distance_km:kms[i]||0}));
          setVendors(updated);
        }catch{setVendors(data);}
      }
      else setVendors(data);
      setCalcProgress('');
    }catch(e){setLoadError('Could not load vendors: '+e.message);}
    setLoading(false);
  }

  function search(){if(!venue.trim()){document.getElementById('venue-inp')?.focus();return;}setSearched(true);loadVendors(venueLatLng);}
  function openDetail(v){setPrevScroll(window.scrollY);setActiveVendor(v);setView('detail');window.scrollTo({top:0,behavior:'smooth'});}
  function goBack(){setView('customer');setTimeout(()=>window.scrollTo({top:prevScroll,behavior:'smooth'}),50);}

  // When nothing selected treat as all selected (no filter applied)
  const activeTypes=selectedTypes.size===0?ALL_TYPES:ALL_TYPES.filter(t=>selectedTypes.has(t));
  const vendorsByType={};activeTypes.forEach(t=>{vendorsByType[t]=vendors.filter(v=>v.type===t);});
  const vendorsWithLoc=vendors.filter(v=>v.lat&&v.lng);

  return(
    <>
      <GlobalStyles/>
      {showScenario&&<div style={{position:'fixed',inset:0,zIndex:500,background:'var(--cream)',overflowY:'auto'}}><ScenarioBuilder user={null} vendors={vendors} onClose={()=>setShowScenario(false)}/></div>}
      {showWeddingPlan&&<div style={{position:'fixed',inset:0,zIndex:500,background:'var(--cream)',overflowY:'auto'}}><WeddingPlan vendors={vendors} onClose={()=>setShowWeddingPlan(false)}
          onSearchVendors={({venueName,venueLL,type,maxPrice})=>{
            const newVenue=venueName||venue;
            const newLL=venueLL||venueLatLng;
            setVenue(newVenue);
            if(newLL)setVenueLatLng(newLL);
            setSelectedTypes(new Set([type]));
            if(maxPrice!==null)setPlanMaxPrices(prev=>({...(prev||{}),[type]:maxPrice}));
            setSearched(true);
            setShowWeddingPlan(false);
            if(newVenue.trim()){
              setLoading(true);setLoadError('');setCalcProgress('');
              supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
                .then(async data=>{
                  if(newLL){
                    setCalcProgress('Calculating distances…');
                    const kms=await getBatchDistancesKm(newLL,data);
                    setVendors(data.map((v,i)=>({...v,distance_km:kms[i]||0})));
                  }else setVendors(data);
                  setCalcProgress('');
                }).catch(e=>setLoadError('Could not load vendors: '+e.message))
                .finally(()=>setLoading(false));
            }
          }}
        /></div>}
      {showLoginModal && <LoginModal onLogin={handleLogin} onClose={()=>setShowLoginModal(false)}/>}
      {showCustomerAuth && <CustomerAuthModal onLogin={handleLogin} onClose={()=>{setShowCustomerAuth(false);setPendingQuoteVendor(null);}} redirectVendor={pendingQuoteVendor} onVendorLogin={()=>{setShowCustomerAuth(false);setShowLoginModal(true);}}/>}
      {quoteVendor && user?.role==='customer' && <QuoteModal vendor={quoteVendor} customer={user} onClose={()=>setQuoteVendor(null)} onSubmitted={()=>setQuoteVendor(null)}/>}
      <nav style={{background:'var(--forest)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',height:56,position:'sticky',top:0,zIndex:200,boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',display:'flex',flexDirection:'column',gap:4}}>
            <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
            <div style={{width:14,height:2,background:'var(--gold-light)',borderRadius:2}}/>
            <div style={{width:18,height:2,background:'var(--gold-light)',borderRadius:2}}/>
          </button>
          <div onClick={()=>setView('customer')} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.3rem',fontWeight:300,color:'var(--gold-light)',letterSpacing:'0.08em',cursor:'pointer'}}>Vow<span style={{color:'var(--blush)',fontStyle:'italic'}}>Finds</span></div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {view==='detail'&&<button onClick={goBack} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(255,255,255,0.1)',border:'none',borderRadius:6,padding:'5px 12px',fontSize:'0.76rem',color:'rgba(255,255,255,0.8)',cursor:'pointer'}}>‹ Back</button>}
          <button className="vf-nav-login-btns" onClick={()=>setShowCustomerAuth(true)} style={{background:'none',border:'1px solid rgba(255,255,255,0.2)',borderRadius:6,color:'rgba(255,255,255,0.6)',fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',padding:'5px 12px',cursor:'pointer'}}>Customer Login</button>
          <button className="vf-nav-login-btns" onClick={()=>setShowLoginModal(true)} style={{background:'rgba(201,169,110,0.15)',border:'1px solid rgba(201,169,110,0.35)',borderRadius:6,color:'var(--gold-light)',fontFamily:"'DM Sans',sans-serif",fontSize:'0.75rem',padding:'5px 12px',cursor:'pointer'}}>Vendor Login</button>
        </div>
      </nav>
      {/* Public hamburger menu */}
      {menuOpen&&(
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:198}}/>
          <div style={{position:'fixed',top:56,left:0,width:220,background:'var(--white)',boxShadow:'4px 0 20px rgba(0,0,0,0.12)',zIndex:199,borderRight:'1px solid var(--parchment)',padding:'8px 0'}}>
            {[
              {label:'Wedding Plan',action:()=>{setShowWeddingPlan(true);setMenuOpen(false);}},
              {label:'Browse Vendors',action:()=>{setView('customer');setMenuOpen(false);}},
              {label:'Scenario Builder',action:()=>{setShowScenario(true);setMenuOpen(false);}},
              {label:'Customer Login',action:()=>{setShowCustomerAuth(true);setMenuOpen(false);}},
              {label:'Vendor Login',action:()=>{setShowLoginModal(true);setMenuOpen(false);}},
            ].map(item=>(
              <button key={item.label} onClick={item.action} style={{display:'block',width:'100%',textAlign:'left',padding:'12px 20px',background:'none',border:'none',fontSize:'0.88rem',color:'var(--charcoal)',cursor:'pointer',fontFamily:"'DM Sans',sans-serif"}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--cream)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {view==='detail'&&activeVendor?(
        <VendorDetail vendor={activeVendor} dateFrom={dateFrom} dateTo={dateTo} venueLabel={venue} venueLatLng={venueLatLng} onBack={goBack} onRequestQuote={requestQuote}/>
      ):(
        <div>
          {/* Public Hero */}
          <div style={{
            background:'linear-gradient(160deg,var(--forest) 0%,#2a3830 60%,#1e2820 100%)',
            position:'relative',overflow:'hidden',
            padding:'52px 24px 48px',
            display:'flex',flexDirection:'column',alignItems:'center',
          }} className="vf-hero-padding">
            {/* Decorative background glow */}
            <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse 70% 50% at 50% 100%,rgba(201,169,110,0.1) 0%,transparent 70%)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',top:-120,right:-120,width:400,height:400,borderRadius:'50%',background:'rgba(255,255,255,0.03)',pointerEvents:'none'}}/>
            <div style={{position:'absolute',bottom:-80,left:-80,width:280,height:280,borderRadius:'50%',background:'rgba(201,169,110,0.05)',pointerEvents:'none'}}/>

            {/* Eyebrow */}
            <div style={{fontSize:'0.7rem',letterSpacing:'0.25em',textTransform:'uppercase',color:'var(--gold)',marginBottom:10,position:'relative',zIndex:2}}>Your wedding, your way</div>

            {/* Headline */}
            <h1 className="vf-hero-headline" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(2.2rem,4vw,3.6rem)',fontWeight:300,color:'var(--cream)',lineHeight:1.15,marginBottom:8,textAlign:'center',position:'relative',zIndex:2}}>
              Find the <em style={{fontStyle:'italic',color:'var(--blush)'}}>perfect</em> vendors for your special day
            </h1>
            <p className="vf-hero-sub" style={{color:'rgba(250,246,241,0.5)',fontSize:'0.9rem',fontWeight:300,lineHeight:1.6,marginBottom:32,textAlign:'center',maxWidth:500,position:'relative',zIndex:2}}>
              Enter your venue and wedding window — we'll show real availability and travel costs.
            </p>

            {/* ── Main search box ── */}
            <div className="vf-search-box" style={{background:'var(--white)',borderRadius:20,padding:'28px 32px',width:'100%',maxWidth:780,boxShadow:'0 16px 60px rgba(0,0,0,0.28)',position:'relative',zIndex:10,marginBottom:16}}>
              <div className="vf-search-grid" style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:14,marginBottom:16,alignItems:'end'}}>
                {/* Venue */}
                <div>
                  <label style={{fontSize:'0.68rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--mid)',marginBottom:5,display:'block'}}>Venue Location</label>
                  <VenueAutocomplete
                    value={venue} onChange={setVenue}
                    onPlaceSelected={(ll,name)=>{setVenueLatLng(ll);setVenue(name);}}
                    placeholder="e.g. Babylonstoren, Franschhoek"
                    style={{border:'1.5px solid var(--parchment)',borderRadius:9,padding:'11px 14px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',width:'100%'}}
                  />

                </div>
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo}/>
              </div>

              {/* Search button */}
              <button onClick={search} style={{
                background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:10,
                padding:'13px 28px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.95rem',fontWeight:500,
                letterSpacing:'0.06em',cursor:'pointer',width:'100%',
                transition:'background 0.2s',
              }}>
                {loading?(calcProgress||'Loading vendors…'):'Search Vendors'}
              </button>
              {/* Mobile login hint */}
              <div className="vf-mobile-only" style={{textAlign:'center',marginTop:14,paddingTop:14,borderTop:'1px solid var(--parchment)',display:'flex',gap:8,justifyContent:'center'}}>
                <button onClick={()=>setShowCustomerAuth(true)} style={{flex:1,background:'var(--forest)',color:'var(--gold-light)',border:'none',borderRadius:8,padding:'10px',fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>👤 Customer Login</button>
                <button onClick={()=>setShowLoginModal(true)} style={{flex:1,background:'rgba(201,169,110,0.1)',color:'var(--forest)',border:'1px solid rgba(201,169,110,0.3)',borderRadius:8,padding:'10px',fontSize:'0.82rem',fontWeight:500,cursor:'pointer'}}>🏪 Vendor Login</button>
              </div>
            </div>

            {/* ── Category filter ── */}
            <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:780}}>
              {/* Header row: label on left, Select All on right */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:'0.68rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(255,255,255,0.45)'}}>Filter by category</span>
                <button
                  onClick={()=>toggleType('all')}
                  style={{
                    background:'none',border:'none',cursor:'pointer',padding:'4px 10px',
                    fontSize:'0.78rem',fontFamily:"'DM Sans',sans-serif",
                    color:selectedTypes.size===ALL_TYPES.length?'var(--gold)':'rgba(255,255,255,0.45)',
                    fontWeight:selectedTypes.size===ALL_TYPES.length?600:400,
                    letterSpacing:'0.04em',
                    textDecoration:selectedTypes.size===ALL_TYPES.length?'none':'underline',
                    textUnderlineOffset:'3px',
                    transition:'color 0.15s',
                  }}
                >
                  {selectedTypes.size===ALL_TYPES.length?'✓ All selected':'Select all'}
                </button>
              </div>

              {/* Category pills box */}
              <div className="vf-filter-box" style={{
                background:'rgba(255,255,255,0.06)',
                border:'1px solid rgba(255,255,255,0.13)',
                borderRadius:14,
                padding:'12px 14px',
                backdropFilter:'blur(8px)',
                display:'flex',flexWrap:'wrap',gap:8,
                alignItems:'center',
                justifyContent:'center',
              }}>
                {ALL_TYPES.map(t=>{
                  const active=selectedTypes.has(t);
                  return (
                    <div
                      key={t}
                      onClick={()=>toggleType(t)}
                      style={{
                        display:'flex',alignItems:'center',gap:6,
                        padding:'6px 13px',borderRadius:999,cursor:'pointer',userSelect:'none',
                        background:active?'rgba(196,130,106,0.28)':'rgba(255,255,255,0.06)',
                        border:`1.5px solid ${active?'rgba(196,130,106,0.65)':'rgba(255,255,255,0.15)'}`,
                        transition:'all 0.15s',
                      }}
                    >
                      <span style={{fontSize:'0.82rem',color:active?'var(--cream)':'rgba(255,255,255,0.6)',fontWeight:active?500:400,whiteSpace:'nowrap'}}>{TYPE_EMOJI[t]} {t}</span>
                    </div>
                  );
                })}
              </div>

              {/* Selection count hint */}
              {selectedTypes.size>0&&selectedTypes.size<ALL_TYPES.length&&(
                <div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.35)'}}>
                  {selectedTypes.size} of {ALL_TYPES.length} categories selected
                </div>
              )}
              {selectedTypes.size===0&&(
                <div style={{textAlign:'center',marginTop:8,fontSize:'0.7rem',color:'rgba(255,255,255,0.3)'}}>
                  No filter — all vendors will show
                </div>
              )}
            </div>

          </div>

          {/* Results */}
          {searched&&(
            <div className="vf-results-section" style={{padding:'48px 0 60px',background:'#ffffff'}}>
              <div style={{padding:'0 32px 24px',maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                <div>
                  <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'2rem',fontWeight:400,color:'var(--forest)'}}>Vendors near <span style={{fontStyle:'italic',color:'var(--rose)'}}>{venue}</span>{dateFrom&&<span style={{fontSize:'1.2rem',color:'var(--mid)',fontStyle:'normal'}}> · {formatDateDisplay(dateFrom)}{dateTo&&dateTo!==dateFrom?' – '+formatDateDisplay(dateTo):''}</span>}</h2>
                  <p style={{color:'var(--mid)',fontSize:'0.88rem',marginTop:4}}>{loading?(calcProgress||'Loading…'):loadError?loadError:'Each lane has its own price filter. Greyed-out vendors are booked on your date.'}</p>
                </div>
                {vendorsWithLoc.length>0&&<button onClick={()=>setShowMap(s=>!s)} style={{background:'var(--white)',border:'1.5px solid var(--parchment)',borderRadius:8,padding:'8px 16px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.8rem',color:'var(--forest)',cursor:'pointer'}}>{showMap?'🗺 Hide map':'🗺 Show map'}</button>}
              </div>
              {!loading&&!loadError&&showMap&&vendorsWithLoc.length>0&&<VendorsMap vendors={vendorsWithLoc} venueLatLng={venueLatLng} onSelectVendor={openDetail}/>}
              {!loading&&!loadError&&activeTypes.map((type,idx)=>{const tv=vendorsByType[type];if(!tv||tv.length===0)return null;return<VendorLane key={type} type={type} vendors={tv} dateFrom={dateFrom} dateTo={dateTo} onOpenDetail={openDetail} isLast={idx===activeTypes.length-1} onRequestQuote={requestQuote}/>;  })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
function GlobalStyles(){return(
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{--cream:#faf6f1;--parchment:#f0e8dc;--blush:#e8c4b0;--rose:#c4826a;--deep-rose:#8b4d3a;--forest:#3a4a3f;--gold:#c9a96e;--gold-light:#e8d5a3;--charcoal:#2c2c2c;--mid:#6b6b6b;--light:#a8a8a8;--white:#ffffff;--card-shadow:0 4px 24px rgba(44,44,44,0.08);--card-shadow-hover:0 8px 40px rgba(44,44,44,0.15);color-scheme:light;}
    html{color-scheme:light;background:#ffffff;}
    body{font-family:'DM Sans',sans-serif;background:var(--cream);color:var(--charcoal);color-scheme:light;}
    /* Force light mode — prevents Samsung/Android dark mode from inverting colours */
    @media(prefers-color-scheme:dark){
      html,body{color-scheme:light;background:#ffffff!important;color:#2c2c2c!important;}
      input,textarea,select,button{color-scheme:light;}
    }
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--rose);border:3px solid white;box-shadow:0 2px 6px rgba(196,130,106,0.45);cursor:pointer;}
    input[type=range]{-webkit-appearance:none;appearance:none;}
    input:focus,select:focus,textarea:focus{border-color:var(--rose)!important;}
    ::-webkit-scrollbar{display:none;}
    .pac-container{z-index:9999!important;font-family:'DM Sans',sans-serif;}
    /* ── Responsive ── */
    @media(max-width:767px){
      /* Nav */
      .vf-nav-login-btns{display:none!important;}

      /* Hero */
      .vf-hero-padding{padding:36px 16px 28px!important;}
      .vf-hero-headline{font-size:1.75rem!important;margin-bottom:8px!important;}

      /* Search box — tighter, single column, z-index so date picker floats above filter */
      .vf-search-box{
        padding:18px 16px 20px!important;
        border-radius:16px!important;
        margin-bottom:14px!important;
        position:relative!important;
        z-index:10!important;
      }
      .vf-search-grid{grid-template-columns:1fr!important;gap:10px!important;margin-bottom:12px!important;}
      .vf-search-grid input[type=date]{
        font-size:0.88rem!important;
        padding:10px 12px!important;
        position:relative!important;
        z-index:20!important;
      }
      /* Filter box sits BELOW with lower z-index so date picker overlaps it */
      .vf-filter-box{
        padding:10px 12px!important;
        position:relative!important;
        z-index:1!important;
      }
      .vf-filter-pill{padding:5px 11px!important;font-size:0.78rem!important;}

      /* Vendor lane — 2 cards visible, peek of 3rd */
      .vf-lane-scroll{
        gap:10px!important;
        padding:0 16px 14px!important;
        scroll-snap-type:x mandatory!important;
      }
      /* Cards: ~2.3 fit on screen so user can see there's more to scroll */
      .vf-vendor-card{
        flex:0 0 calc(44vw - 8px)!important;
        width:calc(44vw - 8px)!important;
        border-radius:12px!important;
        scroll-snap-align:start!important;
      }
      .vf-vendor-card .vf-card-img{height:110px!important;}
      .vf-vendor-card .vf-card-body{padding:10px 11px 12px!important;}
      .vf-vendor-card .vf-card-name{
        font-size:0.88rem!important;
        margin-bottom:2px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .vf-vendor-card .vf-card-location{
        font-size:0.68rem!important;
        margin-bottom:7px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .vf-vendor-card .vf-card-pricing{padding:7px 9px!important;border-radius:7px!important;}
      .vf-vendor-card .vf-card-pricing div{font-size:0.65rem!important;}
      .vf-vendor-card .vf-card-pricing span{font-size:0.72rem!important;}
      .vf-vendor-card .vf-card-btns{margin-top:9px!important;gap:5px!important;}
      .vf-vendor-card .vf-card-btns button{
        padding:7px 6px!important;
        font-size:0.68rem!important;
        border-radius:7px!important;
        letter-spacing:0!important;
      }
      .vf-vendor-card .vf-card-type-badge{
        font-size:0.58rem!important;
        padding:2px 7px!important;
        letter-spacing:0.06em!important;
      }
      .vf-vendor-card .vf-card-ig{width:24px!important;height:24px!important;}

      /* Force white/light theme on mobile — override system dark mode */
      html,body{background:#ffffff!important;color:#2c2c2c!important;color-scheme:light!important;}
      *{color-scheme:light;}
      .vf-results-section{background:#ffffff!important;}
      .vf-lane-wrapper{background:#ffffff!important;}
      .vf-lane-fade-left{background:linear-gradient(to right,#ffffff,transparent)!important;}
      .vf-lane-fade-right{background:linear-gradient(to left,#ffffff,transparent)!important;}
      .vf-lane-divider{border-top-color:#ede8e0!important;margin:4px 16px 28px!important;}

      /* Price slider — clean on mobile */
      .vf-lane-header{
        flex-direction:column!important;
        align-items:flex-start!important;
        padding:0 16px!important;
        gap:8px!important;
        margin-bottom:10px!important;
      }

      .vf-results-header{padding:0 16px 14px!important;}
      .vf-results-title{font-size:1.5rem!important;}

      /* Customer dashboard */
      .vf-customer-dash-body{min-height:100vh!important;}

      /* Vendor detail */
      .vf-vendor-detail-grid{grid-template-columns:1fr!important;}
      .vf-vendor-detail-sticky{position:static!important;}
      .vf-vendor-detail-hero{height:220px!important;}
      .vf-vendor-detail-pad{padding:20px 16px 40px!important;}
    }
    @media(min-width:768px){
      .vf-mobile-only{display:none!important;}
    }
  `}</style>
);}
