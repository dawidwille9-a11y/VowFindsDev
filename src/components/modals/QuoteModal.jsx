import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch, storageUrl } from '../../api.js';
import { IC } from '../../icons.jsx';
import { ON_REQUEST_TYPES, ON_REQUEST_QUESTIONS } from '../../constants.jsx';
import { isOnRequest } from '../../utils.js';

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

  const backdropRef=useRef();
  const mouseDownOnBackdrop=useRef(false);
  function handleBackdropMouseDown(e){
    mouseDownOnBackdrop.current=(e.target===backdropRef.current);
  }
  function handleBackdropMouseUp(e){
    if(mouseDownOnBackdrop.current && e.target===backdropRef.current) onClose();
    mouseDownOnBackdrop.current=false;
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
        ...(fileUrl?['Attachment included']:[]),
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
    <div ref={backdropRef} onMouseDown={handleBackdropMouseDown} onMouseUp={handleBackdropMouseUp} style={{position:'fixed',inset:0,background:'rgba(22,32,24,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)',padding:'20px'}}>
      <div style={{background:'var(--white)',borderRadius:20,padding:36,width:520,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.28)',position:'relative'}}>
        <button onClick={onClose} style={{position:'absolute',top:16,right:16,background:'var(--parchment)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:'1rem',color:'var(--mid)',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>×</button>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:10,background:vendor.images?.[0]?.url?`url(${vendor.images[0].url}) center/cover`:`linear-gradient(135deg,${vendor.color||'#c8a87a'}dd,${vendor.color||'#c8a87a'}66)`,flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'var(--forest)',fontWeight:600}}>Request a Quote</div>
            <div style={{fontSize:'0.78rem',color:'var(--mid)',display:'flex',alignItems:'center',gap:5}}>{vendor.name} · <VendorIcon type={vendor.type} size={13} color='var(--mid)'/>{vendor.type}</div>
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
              {uploading?'Uploading…':fileUrl?'File attached':'Attach files (optional)'}
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

export default QuoteModal;
export { QuoteModal };