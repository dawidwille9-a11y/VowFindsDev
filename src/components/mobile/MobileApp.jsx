import React, { useState, useEffect, useRef, memo } from 'react';
import { supaFetch, getBatchDistancesKm } from '../../api.js';
import { IC } from '../../icons.jsx';
import { ALL_TYPES } from '../../constants.jsx';
import GlobalStyles from '../../styles.jsx';
import CustomerAuthModal from '../modals/CustomerAuthModal.jsx';
import LoginModal from '../modals/LoginModal.jsx';
import QuoteModal from '../modals/QuoteModal.jsx';
import WeddingPlan from '../features/WeddingPlan.jsx';
import { MobileSearchScreen, MobileResultsScreen, MobileVendorDetail, MobileQuotesScreen, MobileFavouritesScreen, MobileScenariosScreen } from './MobileComponents.jsx';

function MobileApp({user,onLogin,onLogout,requestQuote,quoteVendor,setQuoteVendor,newLeadAfterQuote,setNewLeadAfterQuote}) {
  const [screen,setScreen]=useState('home'); // 'home'|'browse'|'quotes'|'plan'
  const [vendors,setVendors]=useState([]);
  const [venue,setVenue]=useState('');
  const [venueLL,setVenueLL]=useState(null);
  const [dateFrom,setDateFrom]=useState('');
  const [activeVendor,setActiveVendor]=useState(null);
  const [activeType,setActiveType]=useState(null);
  const [showSearch,setShowSearch]=useState(true);
  const [showCustomerAuth,setShowCustomerAuth]=useState(false);
  const [showVendorLogin,setShowVendorLogin]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);

  useEffect(()=>{if(newLeadAfterQuote)setScreen('quotes');},[newLeadAfterQuote]);

  function handleVendorsLoaded(v,venueName,ll,date,type=null){
    setVendors(v);setVenue(venueName||'');setVenueLL(ll||null);
    setDateFrom(date||'');setActiveType(type);setShowSearch(false);setScreen('home');
  }
  function handleRequestQuote(vendor){
    if(user&&user.role==='customer')requestQuote(vendor);
    else setShowCustomerAuth(true);
  }
  function goScreen(s){setScreen(s);setMenuOpen(false);}

  const MENU_ITEMS=[
    {id:'home',      icon:IC.home,      label:'Home'},
    {id:'quotes',    icon:IC.chat,      label:'My Quotes'},
    {id:'favourites',icon:IC.heart,     label:'Favourites'},
    {id:'scenarios', icon:IC.map,       label:'Scenarios'},
    {id:'plan',      icon:IC.rings,     label:'Wedding Plan'},
  ];

  // Full-screen vendor detail overlay
  if(activeVendor) return(
    <div style={{position:'fixed',inset:0,zIndex:600,background:'#fff',display:'flex',flexDirection:'column'}}>
      <MobileVendorDetail vendor={activeVendor} dateFrom={dateFrom} venueLabel={venue} venueLatLng={venueLL}
        onBack={()=>setActiveVendor(null)} onQuote={()=>{handleRequestQuote(activeVendor);setActiveVendor(null);}}/>
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',background:'#f8f6f3',fontFamily:"'DM Sans',sans-serif"}}>


      {/* Modals */}
      {quoteVendor&&<QuoteModal vendor={quoteVendor} customer={user} onClose={()=>setQuoteVendor(null)} onSubmitted={lead=>{setQuoteVendor(null);setNewLeadAfterQuote(lead);}}/>}
      {showCustomerAuth&&<CustomerAuthModal onLogin={u=>{onLogin(u);setShowCustomerAuth(false);}} onClose={()=>setShowCustomerAuth(false)} onVendorLogin={()=>setShowVendorLogin(true)}/>}
      {showVendorLogin&&<LoginModal onLogin={u=>{onLogin(u);setShowVendorLogin(false);}} onClose={()=>setShowVendorLogin(false)}/>}

      {/* Burger menu drawer */}
      {menuOpen&&(
        <>
          <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:300}}/>
          <div style={{position:'fixed',top:0,left:0,bottom:0,width:260,background:'#fff',zIndex:301,display:'flex',flexDirection:'column',boxShadow:'4px 0 24px rgba(0,0,0,0.1)',paddingTop:'max(20px,env(safe-area-inset-top))'}}>
            {/* Drawer header */}
            <div style={{padding:'16px 20px 20px',borderBottom:'1px solid #f0ebe4'}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.5rem',fontWeight:300,color:'#3a4a3f',letterSpacing:'0.06em',marginBottom:4}}>Vow<span style={{color:'#e8c4b0',fontStyle:'italic'}}>Finds</span></div>
              {user&&user.role==='customer'
                ?<div style={{fontSize:'0.76rem',color:'#6b6b6b'}}>Hi, {user.name} 👋</div>
                :<div style={{fontSize:'0.76rem',color:'#a8a8a8'}}>Discover your perfect vendors</div>}
            </div>
            {/* Nav items */}
            <div style={{flex:1,padding:'8px 0'}}>
              {MENU_ITEMS.map(item=>(
                <button key={item.id} onClick={()=>goScreen(item.id)}
                  style={{width:'100%',textAlign:'left',background:screen===item.id?'rgba(58,74,63,0.05)':'none',border:'none',borderLeft:`3px solid ${screen===item.id?'#3a4a3f':'transparent'}`,padding:'14px 20px',fontSize:'0.9rem',color:screen===item.id?'#3a4a3f':'#2c2c2c',fontWeight:screen===item.id?600:400,cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontFamily:"'DM Sans',sans-serif"}}>
                  <span style={{color:screen===item.id?'#3a4a3f':'#a8a8a8'}}>{item.icon(20,screen===item.id?'#3a4a3f':'#a8a8a8')}</span>{item.label}
                </button>
              ))}
            </div>
            {/* Auth at bottom */}
            <div style={{padding:'16px 20px',borderTop:'1px solid #f0ebe4',paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
              {user&&user.role==='customer'
                ?<button onClick={()=>{onLogout();setMenuOpen(false);}} style={{width:'100%',background:'#f5f0eb',color:'#6b6b6b',border:'none',borderRadius:10,padding:'11px',fontSize:'0.86rem',cursor:'pointer',fontWeight:500}}>Sign Out</button>
                :<div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <button onClick={()=>{setShowCustomerAuth(true);setMenuOpen(false);}} style={{width:'100%',background:'#3a4a3f',color:'#e8d5a3',border:'none',borderRadius:10,padding:'11px',fontSize:'0.86rem',fontWeight:600,cursor:'pointer'}}>Log In</button>
                  <button onClick={()=>{setShowCustomerAuth(true);setMenuOpen(false);}} style={{width:'100%',background:'none',color:'#3a4a3f', border:'1.5px solid #f0e8dc',borderRadius:10,padding:'10px',fontSize:'0.86rem',fontWeight:500,cursor:'pointer'}}>Sign Up</button>
                </div>}
            </div>
          </div>
        </>
      )}

      {/* Top nav bar — burger left, brand centre, auth right */}
      <div style={{background:'#fff',borderBottom:'1px solid #f0ebe4',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,flexShrink:0,paddingTop:'env(safe-area-inset-top)',boxShadow:'0 1px 6px rgba(0,0,0,0.04)'}}>
        {/* Burger */}
        <button onClick={()=>setMenuOpen(o=>!o)} style={{background:'none',border:'none',cursor:'pointer',padding:'6px',borderRadius:8,display:'flex',alignItems:'center'}}>{IC.menu(22,'#2c2c2c')}</button>
        {/* Brand */}
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.25rem',fontWeight:300,color:'#3a4a3f',letterSpacing:'0.06em',position:'absolute',left:'50%',transform:'translateX(-50%)'}}>
          Vow<span style={{color:'#c4826a',fontStyle:'italic'}}>Finds</span>
        </div>
        {/* Auth shortcut */}
        {user&&user.role==='customer'
          ?<div style={{width:32,height:32,borderRadius:'50%',background:'#3a4a3f',color:'#e8d5a3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.78rem',fontWeight:700}}>{(user.name||'U')[0].toUpperCase()}</div>
          :<button onClick={()=>setShowCustomerAuth(true)} style={{background:'none', border:'1.5px solid #f0e8dc',borderRadius:8,padding:'5px 12px',fontSize:'0.76rem',color:'#3a4a3f',cursor:'pointer',fontWeight:500}}>Login</button>
        }
      </div>

      {/* Main content */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {screen==='home'&&(
          showSearch
            ?<MobileSearchScreen onVendorsLoaded={handleVendorsLoaded}/>
            :<MobileResultsScreen vendors={vendors} venue={venue} venueLL={venueLL} dateFrom={dateFrom}
                onBack={()=>setShowSearch(true)} onOpen={setActiveVendor} onQuote={handleRequestQuote}
                customerId={user?.customerId} activeType={activeType} setActiveType={setActiveType}/>
        )}

        {screen==='quotes'&&(
          user&&user.role==='customer'
            ?<MobileQuotesScreen user={user} onBrowse={()=>{setScreen('home');setShowSearch(true);}} initialLead={newLeadAfterQuote} onRequestQuote={handleRequestQuote}/>
            :<div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:14,background:'#fff'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:4}}>{IC.chat(48, '#f0e8dc')}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'1.4rem',color:'#3a4a3f',textAlign:'center'}}>Your quotes live here</div>
              <p style={{fontSize:'0.84rem',color:'#a8a8a8',textAlign:'center',lineHeight:1.7,maxWidth:260}}>Log in to view your conversations with vendors.</p>
              <button onClick={()=>setShowCustomerAuth(true)} style={{background:'#3a4a3f',color:'#e8d5a3',border:'none',borderRadius:12,padding:'12px 32px',fontSize:'0.9rem',fontWeight:600,cursor:'pointer'}}>Log In</button>
            </div>
        )}
        {screen==='favourites'&&(
          <MobileFavouritesScreen
            user={user}
            onOpen={setActiveVendor}
            onQuote={handleRequestQuote}
            dateFrom={dateFrom}
            onLogin={()=>setShowCustomerAuth(true)}
          />
        )}
        {screen==='scenarios'&&(
          <MobileScenariosScreen
            user={user}
            vendors={vendors}
            onLogin={()=>setShowCustomerAuth(true)}
          />
        )}
        {screen==='plan'&&(
          <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>
            <WeddingPlan vendors={vendors} onClose={()=>setScreen('home')}
              onSearchVendors={({venueName,venueLL:ll,type})=>{
                setVenue(venueName||venue);
                if(ll)setVenueLL(ll);
                setActiveType(type);
                setShowSearch(false);
                setScreen('home');
                supaFetch('vendors?select=*,images:vendor_images(*),unavail_dates:vendor_unavailable_dates(date)&order=type,name')
                  .then(async data=>{
                    if(ll){const kms=await getBatchDistancesKm(ll,data);setVendors(data.map((v,i)=>({...v,distance_km:kms[i]||0})));}
                    else setVendors(data);
                  }).catch(()=>{});
              }}/>
          </div>
        )}
      </div>
    </div>
  );
}



export default MobileApp;
export { MobileApp };