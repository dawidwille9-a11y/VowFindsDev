import React, { useState, useEffect, useRef, memo } from 'react';
import { signIn, signUp, supaFetch, supabase } from '../../api.js';
import { saveRemember, clearRemember, loadRemember } from '../../session.js';
import { IC } from '../../icons.jsx';

// Password must be 8+ chars, upper+lowercase, and a special character
function validatePassword(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character (e.g. ! @ # $).';
  return null;
}

// Shows a live strength indicator below the password field
function PasswordStrength({password}) {
  if (!password) return null;
  const checks = [
    {label:'8+ characters', ok: password.length >= 8},
    {label:'Uppercase letter', ok: /[A-Z]/.test(password)},
    {label:'Lowercase letter', ok: /[a-z]/.test(password)},
    {label:'Special character', ok: /[^A-Za-z0-9]/.test(password)},
  ];
  const passed = checks.filter(c => c.ok).length;
  const color = passed <= 1 ? '#c4826a' : passed <= 2 ? '#c9a96e' : passed === 3 ? '#8faa6a' : '#3a7a5a';
  return (
    <div style={{marginTop:-6, marginBottom:12}}>
      <div style={{display:'flex', gap:4, marginBottom:6}}>
        {checks.map((_,i) => (
          <div key={i} style={{flex:1, height:3, borderRadius:2,
            background: i < passed ? color : 'var(--parchment)',
            transition:'background 0.2s'}}/>
        ))}
      </div>
      <div style={{display:'flex', flexWrap:'wrap', gap:'4px 12px'}}>
        {checks.map(c => (
          <span key={c.label} style={{fontSize:'0.68rem',
            color: c.ok ? '#3a7a5a' : 'var(--light)',
            display:'flex', alignItems:'center', gap:3}}>
            <span style={{fontSize:'0.7rem'}}>{c.ok ? '✓' : '○'}</span>{c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const labelStyle={fontSize:'0.74rem',fontWeight:500,color:'var(--mid)',marginBottom:4,display:'block',letterSpacing:'0.04em'};
const inputStyle={width:'100%',border:'1.5px solid var(--parchment)',borderRadius:9,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',marginBottom:12};

function CustomerAuthModal({onLogin, onClose, redirectVendor=null, onVendorLogin=null}) {
  const [mode,setMode]=useState('login');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [remember,setRemember]=useState(false);
  useEffect(()=>{
    const savedC = loadRemember();
    if(savedC){setEmail(savedC.email||'');setPassword(savedC.password||'');setRemember(true);}
  },[]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState('');
  const [success,setSuccess]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [mode2,setMode2]=useState('login'); // 'login'|'register'|'forgot'

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
    try{
      if(remember) saveRemember(email,password); else clearRemember();
      const data=await signIn(email,password);
      const user=data.user; const token=data.session?.access_token;
      // supaFetch now auto-attaches the session token via supabase.auth.getSession()
      let customers=await supaFetch(`customers?user_id=eq.${user.id}&select=*`);
      let customer=Array.isArray(customers)?customers[0]:customers;
      if(!customer){
        const res=await supaFetch('customers',{method:'POST',body:JSON.stringify({user_id:user.id,name:user.user_metadata?.name||email.split('@')[0],email:user.email}),prefer:'return=representation'});
        customer=Array.isArray(res)?res[0]:res;
      }
      onLogin({role:'customer',email:user.email,userId:user.id,customerId:customer?.id,name:customer?.name||email.split('@')[0],token});
      onClose();
    }catch(err){setError(err.message);}
    setLoading('');
  }

  async function handleRegister(e){
    e.preventDefault(); setError(''); setSuccess('');
    const pwErr = validatePassword(password);
    if(pwErr){setError(pwErr);return;}
    setLoading('Creating account…');
    try{
      const data=await signUp(email,password);
      // Try to create customer record — may fail if email confirmation required (created on first login instead)
      if(data.user){
        await supaFetch('customers',{method:'POST',body:JSON.stringify({user_id:data.user.id,name,email}),prefer:'return=minimal'}).catch(()=>{});
      }
      setSuccess('Account created! Please check your email to verify your address, then log in.');
      setMode('login');
    }catch(err){setError(err.message);}
    setLoading('');
  }

  async function handleForgotPassword(e) {
    e.preventDefault(); setError(''); setSuccess(''); setLoading('Sending reset email…');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '?reset=1',
      });
      if (error) throw error;
      setSuccess('Password reset email sent! Check your inbox and follow the link to set a new password.');
    } catch(err) { setError(err.message); }
    setLoading('');
  }

  return (
    <div ref={backdropRef} onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
      <div style={{background:'#ffffff',borderRadius:20,padding:36,width:380,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        {redirectVendor&&(
          <div style={{background:'var(--parchment)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'0.8rem',color:'var(--mid)'}}>
            Sign in to request a quote from <strong>{redirectVendor.name}</strong>
          </div>
        )}
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.6rem',color:'var(--forest)',fontWeight:600,marginBottom:4}}>
          {mode==='login'?'Welcome back':mode==='register'?'Create account':'Reset password'}
        </div>
        <p style={{fontSize:'0.78rem',color:'var(--light)',marginBottom:22}}>
          {mode==='login'?'Login to your customer account':mode==='register'?'Join VowFinds to request quotes':'Enter your email and we will send a reset link'}
        </p>
        <form onSubmit={mode==='login'?handleLogin:mode==='register'?handleRegister:handleForgotPassword}>
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
          {mode==='forgot'&&(
            <div style={{fontSize:'0.78rem',color:'var(--mid)',marginBottom:16,padding:'10px 12px',background:'rgba(58,74,63,0.05)',borderRadius:8,lineHeight:1.6}}>
              We will send a password reset link to your email address. Click the link to set a new password.
            </div>
          )}
          {mode!=='forgot'&&(
            <>
              <div style={{marginBottom:12}}>
                <label style={labelStyle}>Password{mode==='register'&&<span style={{fontWeight:400,color:'var(--light)',marginLeft:4}}>— min. 8 chars, upper/lower, special</span>}</label>
                <div style={{position:'relative'}}>
                  <input style={{...inputStyle,marginBottom:0,paddingRight:42}} type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={mode==='register'?8:1} autoComplete={mode==='register'?'new-password':'current-password'}/>
                  <button type="button" onClick={()=>setShowPassword(s=>!s)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--light)',fontSize:'0.75rem',padding:'2px 4px'}}>
                    {showPassword?'Hide':'Show'}
                  </button>
                </div>
              </div>
              {mode==='register'&&<PasswordStrength password={password}/>}
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}} onClick={()=>setRemember(r=>!r)}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${remember?'var(--rose)':'var(--light)'}`,background:remember?'var(--rose)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                  {remember&&<span style={{color:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>{IC.check(10,'white')}</span>}
                </div>
                <span style={{fontSize:'0.78rem',color:'var(--mid)',userSelect:'none'}}>Remember my details</span>
              </div>
            </>
          )}
          {error&&<div style={{fontSize:'0.78rem',color:'var(--rose)',marginBottom:12,padding:'10px 12px',background:'rgba(196,130,106,0.08)',borderRadius:8,border:'1px solid rgba(196,130,106,0.2)'}}>{error}</div>}
          {success&&<div style={{fontSize:'0.78rem',color:'var(--forest)',marginBottom:12,padding:'10px 12px',background:'rgba(58,74,63,0.07)',borderRadius:8}}>{success}</div>}
          <button type="submit" disabled={!!loading} style={{width:'100%',background:'var(--rose)',color:'var(--white)',border:'none',borderRadius:10,padding:'12px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.9rem',fontWeight:500,cursor:loading?'wait':'pointer',letterSpacing:'0.05em'}}>
            {loading||(mode==='login'?'Login':mode==='register'?'Create Account':'Send Reset Email')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:'0.78rem',color:'var(--mid)'}}>
          {mode==='login'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <span>New here?{' '}<span onClick={()=>{setMode('register');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Create account</span></span>
              <span><span onClick={()=>{setMode('forgot');setError('');setSuccess('');}} style={{color:'var(--light)',cursor:'pointer',textDecoration:'underline'}}>Forgot your password?</span></span>
            </div>
          )}
          {mode==='register'&&<span>Already have an account?{' '}<span onClick={()=>{setMode('login');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Login</span></span>}
          {mode==='forgot'&&<span>Remembered it?{' '}<span onClick={()=>{setMode('login');setError('');setSuccess('');}} style={{color:'var(--rose)',cursor:'pointer',fontWeight:500}}>Back to login</span></span>}
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

export default CustomerAuthModal;
export { CustomerAuthModal };