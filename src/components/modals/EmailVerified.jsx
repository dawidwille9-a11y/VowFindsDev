import React, { useState, useEffect } from 'react';
import { supabase } from '../../api.js';

// This component handles the email verification redirect from Supabase.
// Supabase appends #access_token=...&type=signup to the URL after the user clicks verify.
// We read those params, sign the user in, and show a friendly success screen.

export default function EmailVerified({ onVerified }) {
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function handleVerification() {
      try {
        // Supabase puts the token in the URL hash after redirect
        const hash = window.location.hash;
        if (!hash) { setStatus('error'); setMessage('No verification token found. Please try clicking the link in your email again.'); return; }

        // Let Supabase SDK parse the hash and establish the session
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data?.session) {
          setStatus('success');
          // Clear the hash from the URL so it looks clean
          window.history.replaceState(null, '', window.location.pathname);
          // Notify parent after a short delay so user sees the success screen
          setTimeout(() => { if (onVerified) onVerified(); }, 2500);
        } else {
          // Try to exchange the hash token manually
          const { error: sessionError } = await supabase.auth.refreshSession();
          if (sessionError) throw sessionError;
          setStatus('success');
          setTimeout(() => { if (onVerified) onVerified(); }, 2500);
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Verification failed. Please try again.');
      }
    }
    handleVerification();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--cream)', fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      <div style={{
        background: 'var(--white)', borderRadius: 20, padding: '48px 40px',
        maxWidth: 420, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
      }}>
        {/* Logo */}
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 300, color: 'var(--forest)', marginBottom: 32, letterSpacing: '0.06em' }}>
          Vow<span style={{ color: 'var(--rose)', fontStyle: 'italic' }}>Finds</span>
        </div>

        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⏳</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: 'var(--forest)', marginBottom: 8 }}>Verifying your email…</div>
            <p style={{ color: 'var(--mid)', fontSize: '0.86rem' }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>💍</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', color: 'var(--forest)', marginBottom: 8 }}>Email verified!</div>
            <p style={{ color: 'var(--mid)', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: 24 }}>
              Welcome to VowFinds. You're all set to start planning your perfect Boland wedding.
            </p>
            <div style={{ fontSize: '0.78rem', color: 'var(--light)' }}>Taking you to the site…</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: 'var(--forest)', marginBottom: 8 }}>Verification failed</div>
            <p style={{ color: 'var(--mid)', fontSize: '0.86rem', lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
            <a href="/" style={{
              display: 'inline-block', background: 'var(--rose)', color: 'var(--white)',
              border: 'none', borderRadius: 10, padding: '11px 28px',
              fontSize: '0.88rem', fontWeight: 500, textDecoration: 'none', cursor: 'pointer',
            }}>
              Go to VowFinds
            </a>
          </>
        )}
      </div>
    </div>
  );
}
