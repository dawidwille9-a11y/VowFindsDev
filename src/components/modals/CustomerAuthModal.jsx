import React, { useState, useEffect, useRef, memo } from 'react';
import { signIn, signUp, saveRemember, clearRemember, loadRemember, supaFetch } from '../../api.js';
import { IC } from '../../icons.jsx';
const labelStyle={fontSize:'0.74rem',fontWeight:500,color:'var(--mid)',marginBottom:4,display:'block',letterSpacing:'0.04em'};
const inputStyle={width:'100%',border:'1.5px solid var(--parchment)',borderRadius:9,padding:'10px 13px',fontFamily:"'DM Sans',sans-serif",fontSize:'0.88rem',color:'var(--charcoal)',background:'var(--cream)',outline:'none',marginBottom:12};

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
    <div ref={backdropRef} onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(3px)'}}>
      <div style={{background:'#ffffff',borderRadius:20,padding:36,width:380,maxWidth:'90vw',boxShadow:'0 24px 80px rgba(0,0,0,0.25)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        {redirectVendor&&(
          <div style={{background:'var(--parchment)',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:'0.8rem',color:'var(--mid)'}}>
            Sign in to request a quote from <strong>{redirectVendor.name}</strong>
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
              {remember&&<span style={{color:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>{IC.check(10,'white')}</span>}
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

export default CustomerAuthModal;
export { CustomerAuthModal };