// session.js — localStorage/sessionStorage helpers
// NO imports from other local modules to avoid Rollup temporal dead zone issues

const SESSION_KEY = 'vowfinds_session';
const REMEMBER_KEY = 'vowfinds_remember';

export function saveSession(user) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch(e) {}
  try {
    const rem = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null');
    if (rem && rem.email === user.email) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch(e) {}
}

export function loadSession() {
  try { const s = sessionStorage.getItem(SESSION_KEY); if (s) return JSON.parse(s); } catch(e) {}
  try { const s = localStorage.getItem(SESSION_KEY); if (s) return JSON.parse(s); } catch(e) {}
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
