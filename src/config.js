// API keys are read from environment variables set in Vercel.
// In development, create a file called .env.local in your project root with these same values.
// NEVER hardcode real keys here — this file is visible to anyone who views your source code.

export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const SUPABASE_PUB_KEY  = import.meta.env.VITE_SUPABASE_PUB_KEY  || '';
export const GOOGLE_MAPS_KEY   = import.meta.env.VITE_GOOGLE_MAPS_KEY   || '';

// Admin credentials — replace these with a proper auth check against Supabase
export const ADMIN_USER = import.meta.env.VITE_ADMIN_USER || 'admin';
export const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'admin';

export function storageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/vendor-images/${path}`;
}

// Returns a resized/compressed version via Supabase image transformation API.
// Use this for display — saves bandwidth and loads faster on mobile.
// width: pixel width to resize to. quality: 1–100 (default 80 is a good balance).
export function imgUrl(path, width=600, quality=80) {
  if(!path) return '';
  // If it's already a full URL (old uploads), add transform params
  const base = path.startsWith('http') ? path : storageUrl(path);
  return `${base}?width=${width}&quality=${quality}`;
}
