import React, { useState, useEffect, useRef, memo } from 'react';

function GlobalStyles(){return(
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;forced-color-adjust:none;-webkit-forced-color-adjust:none;}
    :root{--cream:#faf6f1;--parchment:#f0e8dc;--blush:#e8c4b0;--rose:#c4826a;--deep-rose:#8b4d3a;--forest:#3a4a3f;--gold:#c9a96e;--gold-light:#e8d5a3;--charcoal:#2c2c2c;--mid:#6b6b6b;--light:#a8a8a8;--white:#ffffff;--card-shadow:0 4px 24px rgba(44,44,44,0.08);--card-shadow-hover:0 8px 40px rgba(44,44,44,0.15);color-scheme:light only;}
    html{color-scheme:light only;background:#ffffff;forced-color-adjust:none;}
    body{font-family:'DM Sans',sans-serif;background:#faf6f1;color:#2c2c2c;color-scheme:light only;forced-color-adjust:none;}
    /* Prevent Samsung/Chrome Android dark mode from inverting any element */
    *{forced-color-adjust:none;}
    @media(prefers-color-scheme:dark){
      html{background:#ffffff!important;color-scheme:light only!important;}
      body{background:#ffffff!important;color:#2c2c2c!important;color-scheme:light only!important;}
      *{color-scheme:light only;}
      input,select,textarea,button{background-color:inherit;color:inherit;}
    }
    input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:var(--rose);border:3px solid white;box-shadow:0 2px 6px rgba(196,130,106,0.45);cursor:pointer;}
    input[type=range]{-webkit-appearance:none;appearance:none;}
    input:focus,select:focus,textarea:focus{border-color:var(--rose)!important;}
    ::-webkit-scrollbar{display:none;}
    .pac-container{z-index:9999!important;font-family:'DM Sans',sans-serif;}
    /* ── Responsive ── */
    @media(max-width:767px){
      /* Nav */
      .vf-nav-login-btns{display:none!important;}

      /* Hero */
      .vf-hero-padding{padding:36px 16px 28px!important;}
      .vf-hero-headline{font-size:1.75rem!important;margin-bottom:8px!important;}

      /* Search box — tighter, single column, z-index so date picker floats above filter */
      .vf-search-box{
        padding:18px 16px 20px!important;
        border-radius:16px!important;
        margin-bottom:14px!important;
        position:relative!important;
        z-index:10!important;
      }
      .vf-search-grid{grid-template-columns:1fr!important;gap:10px!important;margin-bottom:12px!important;}
      .vf-search-grid input[type=date]{
        font-size:0.88rem!important;
        padding:10px 12px!important;
        position:relative!important;
        z-index:20!important;
      }
      /* Filter box sits BELOW with lower z-index so date picker overlaps it */
      .vf-filter-box{
        padding:10px 12px!important;
        position:relative!important;
        z-index:1!important;
      }
      .vf-filter-pill{padding:5px 11px!important;font-size:0.78rem!important;}

      /* Vendor lane — 2 cards visible, peek of 3rd */
      .vf-lane-scroll{
        gap:10px!important;
        padding:0 16px 14px!important;
        scroll-snap-type:x mandatory!important;
      }
      /* Cards: ~2.3 fit on screen so user can see there's more to scroll */
      .vf-vendor-card{
        flex:0 0 calc(44vw - 8px)!important;
        width:calc(44vw - 8px)!important;
        border-radius:12px!important;
        scroll-snap-align:start!important;
      }
      .vf-vendor-card .vf-card-img{height:110px!important;}
      .vf-vendor-card .vf-card-body{padding:10px 11px 12px!important;}
      .vf-vendor-card .vf-card-name{
        font-size:0.88rem!important;
        margin-bottom:2px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .vf-vendor-card .vf-card-location{
        font-size:0.68rem!important;
        margin-bottom:7px!important;
        white-space:nowrap!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
      }
      .vf-vendor-card .vf-card-pricing{padding:7px 9px!important;border-radius:7px!important;}
      .vf-vendor-card .vf-card-pricing div{font-size:0.65rem!important;}
      .vf-vendor-card .vf-card-pricing span{font-size:0.72rem!important;}
      .vf-vendor-card .vf-card-btns{margin-top:9px!important;gap:5px!important;}
      .vf-vendor-card .vf-card-btns button{
        padding:7px 6px!important;
        font-size:0.68rem!important;
        border-radius:7px!important;
        letter-spacing:0!important;
      }
      .vf-vendor-card .vf-card-type-badge{
        font-size:0.58rem!important;
        padding:2px 7px!important;
        letter-spacing:0.06em!important;
      }
      .vf-vendor-card .vf-card-ig{width:24px!important;height:24px!important;}

      /* Force white/light theme on mobile — override Samsung/Android dark mode */
      html,body{background:#ffffff!important;color:#2c2c2c!important;color-scheme:light only!important;forced-color-adjust:none!important;}
      *{color-scheme:light only;forced-color-adjust:none;}
      input,select,textarea,button{color-scheme:light only;background-color:inherit;color:inherit;}
      .vf-results-section{background:#ffffff!important;}
      .vf-lane-wrapper{background:#ffffff!important;}
      .vf-lane-fade-left{background:linear-gradient(to right,#ffffff,transparent)!important;}
      .vf-lane-fade-right{background:linear-gradient(to left,#ffffff,transparent)!important;}
      .vf-lane-divider{border-top-color:#ede8e0!important;margin:4px 16px 28px!important;}

      /* Price slider — clean on mobile */
      .vf-lane-header{
        flex-direction:column!important;
        align-items:flex-start!important;
        padding:0 16px!important;
        gap:8px!important;
        margin-bottom:10px!important;
      }

      .vf-results-header{padding:0 16px 14px!important;}
      .vf-results-title{font-size:1.5rem!important;}

      /* Customer dashboard */
      .vf-customer-dash-body{min-height:100vh!important;}

      /* Vendor detail */
      .vf-vendor-detail-grid{grid-template-columns:1fr!important;}
      .vf-vendor-detail-sticky{position:static!important;}
      .vf-vendor-detail-hero{height:220px!important;}
      .vf-vendor-detail-pad{padding:20px 16px 40px!important;}
    }
    @media(min-width:768px){
      .vf-mobile-only{display:none!important;}
    }
  `}</style>
);}

export default GlobalStyles;