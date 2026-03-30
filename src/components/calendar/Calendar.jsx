import React, { useState, useEffect, useRef, memo } from 'react';
import { dateKey } from '../../utils.js';
import { MONTHS, DOWS } from '../../constants.jsx';

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

export default Calendar;
export { Calendar };