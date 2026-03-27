import React, { useState, useEffect, useRef, memo } from 'react';
import { signIn, signUp, saveRemember, clearRemember, loadRemember } from '../../api.js';
import { supaFetch } from '../../api.js';
import { IC } from '../../icons.jsx';
import { ADMIN_USER, ADMIN_PASS } from '../../config.js';

const labelStyle={fontSize:'0.74rem',fontWeight:500,color:'var(--mid)',marginBottom:4,display:'block',letterSpacing:'0.04em'};
const inputStyle={width:'100%',border:'1.5px solid var(--parchment)',borderRadius:9,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',marginBottom:12};

function LoginModal({onLogin, onClose}) {
  const saved = loadRemember();
  const [mode,setMode]=useState('login');
  const [identifier,setIdentifier]=useState(saved?.email||'');
  const [password,setPassword]=useState(saved?.password||'');
  const [remember,setRemember]=useState(!!saved);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState('');
  const [success,setSuccess]=useState('');

  const backdropRef=useRef();
  const mouseDownOnBackdrop=useRef(false);
  function handleBackdropMouseDown(e){
    mouseDownOnBackdrop.current=(e.target===backdropRef.current);
  }
  function handleBackdropMouseUp(e){
    if(mouseDownOnBackdrop.current && e.target===backdropRef.current) onClose();
    mouseDownOnBackdrop.current=false;
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
    <div ref={backdropRef} onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
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
              {remember&&<span style={{color:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>{IC.check(10,'white')}</span>}
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

export default LoginModal;
export {{ LoginModal }};