// ─────────────────────────────────────────────────────────────────────────────
// config.js — API keys and environment settings
//
// ⚠️  BEFORE GOING LIVE: move these to Vercel Environment Variables:
//    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GOOGLE_MAPS_KEY
//    Then replace the hardcoded values below with:
//    import.meta.env.VITE_SUPABASE_URL  etc.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL      = 'https://pvpmmzpzeruzoxvwyhqc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2cG1tenB6ZXJ1em94dnd5aHFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjkwNTQsImV4cCI6MjA4OTQwNTA1NH0.Bz45g6NBSNeHd_E4s9TRddlJOseYUJKhAErtIbcyfks';
export const SUPABASE_PUB_KEY  = 'sb_publishable_CBnCOZJzit8uM2fUIIH5-A_WEC3pwS-';
export const GOOGLE_MAPS_KEY   = 'AIzaSyAEmYsoBR2eLoBKr30Gxzy0xdpIl3foCq0';

// ⚠️  BEFORE GOING LIVE: change these to real secure credentials
export const ADMIN_USER = 'admin';
export const ADMIN_PASS = 'admin';

export function storageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/vendor-images/${path}`;
}
