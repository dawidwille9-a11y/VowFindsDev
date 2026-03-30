import React, { useState, useEffect, useRef, memo } from 'react';
import { IC } from '../../icons.jsx';
import { MONTHS } from '../../constants.jsx';
import { formatDateDisplay, dateKey } from '../../utils.js';
import Calendar from './Calendar.jsx';

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
        <span style={{display:'flex',alignItems:'center',gap:6}}>{IC.calendar(14,'currentColor')}{btnLabel}</span>
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
                {m==='day'?'Specific day':'Whole month'}
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
              <button type="button" onClick={clear} style={{background:'none',border:'none',cursor:'pointer',color:'var(--rose)',fontWeight:500,fontSize:'0.75rem',display:'flex',alignItems:'center',gap:4}}>{IC.x(12,'var(--rose)')}Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── VENDOR CARD ───────────────────────────────────────────────────────────────

export default DateRangePicker;
export { DateRangePicker };