// Vendor type lists, booking order, budget ratios, question sets

export const ALL_TYPES = ['Photography','Catering','Florist','DJ','Entertainment','Videography','Cake & Desserts','Barista','Furniture Rental','Hair & Makeup'];
export const TYPE_EMOJI = {'Photography':'📷','Catering':'🍽','Florist':'💐','DJ':'🎧','Entertainment':'🎶','Videography':'🎬','Cake & Desserts':'🎂','Barista':'☕','Furniture Rental':'🛋','Hair & Makeup':'💄'};

// ── SVG ICON SYSTEM ────────────────────────────────────────────────────────────
// Clean, modern line icons — replaces emoji throughout the app
export const IC ={
  // Navigation & UI
  menu:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="16" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  x:        (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  search:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>,
  home:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><polyline points="9,21 9,12 15,12 15,21"/></svg>,
  chat:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  heart:    (sz=20,cl='currentColor',fill='none')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill={fill} stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  star:     (sz=20,cl='currentColor',fill='none')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill={fill} stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  back:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>,
  send:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>,
  pin:      (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  calendar: (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  attach:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  smile:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  logout:   (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  check:    (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>,
  rings:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>,
  eye:      (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  trash:    (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  edit:     (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  map:      (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>,
  settings: (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  // Vendor category icons (line art style)
  camera:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  food:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  flower:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a3 3 0 000 6M12 16a3 3 0 000 6M2 12a3 3 0 006 0M16 12a3 3 0 006 0M4.93 4.93a3 3 0 004.24 4.24M14.83 14.83a3 3 0 004.24 4.24M4.93 19.07a3 3 0 014.24-4.24M14.83 9.17a3 3 0 014.24-4.24"/></svg>,
  music:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  video:    (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23,7 16,12 23,17"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
  cake:     (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-8a2 2 0 00-2-2H6a2 2 0 00-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4a1 1 0 001-1 1 1 0 001 1 1 1 0 001-1 1 1 0 001 1"/></svg>,
  coffee:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/></svg>,
  furniture:(sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V7a2 2 0 00-2-2H6a2 2 0 00-2 2v2"/><path d="M2 11a2 2 0 012 2v4h16v-4a2 2 0 012-2H2z"/><line x1="6" y1="17" x2="6" y2="21"/><line x1="18" y1="17" x2="18" y2="21"/></svg>,
  makeup:   (sz=20,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 00-5 5c0 2 1 4 2 5v3h6v-3c1-1 2-3 2-5a5 5 0 00-5-5z"/><rect x="9" y="15" width="6" height="4" rx="1"/><line x1="9" y1="19" x2="9" y2="21"/><line x1="15" y1="19" x2="15" y2="21"/></svg>,
  // General
  quote:    (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  instagram:(sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5" stroke={cl} strokeWidth="1.8"/><circle cx="17.5" cy="6.5" r="1" fill={cl} stroke="none"/></svg>,
  info:     (sz=18,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  chevronR: (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>,
  chevronD: (sz=16,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={cl} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 12,15 18,9"/></svg>,
  dot:      (sz=8,cl='currentColor')=><svg width={sz} height={sz} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={cl}/></svg>,
};

// Map vendor types to icon functions
export const TYPE_ICON ={
  'Photography': IC.camera,
  'Catering':    IC.food,
  'Florist':     IC.flower,
  'DJ':          IC.music,
  'Entertainment':IC.music,
  'Videography': IC.video,
  'Cake & Desserts':IC.cake,
  'Barista':     IC.coffee,
  'Furniture Rental':IC.furniture,
  'Hair & Makeup':IC.makeup,
};
export function VendorIcon({type,size=18,color='currentColor'}){const fn=TYPE_ICON[type];return fn?fn(size,color):<span style={{fontSize:size*0.8}}>{TYPE_EMOJI[type]||'•'}</span>;}
export const TYPE_COLOR = {'Photography':'#c4826a','Catering':'#6a8fa8','Florist':'#8faa6a','DJ':'#9b6aaa','Entertainment':'#aa8f6a','Videography':'#6a9baa','Cake & Desserts':'#aa6a8f','Barista':'#8b5e3c','Furniture Rental':'#7a8f6a','Hair & Makeup':'#aa6a8a'};
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DOWS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── ON-REQUEST TYPES & QUESTIONNAIRES ────────────────────────────────────────
export const ON_REQUEST_TYPES = new Set(['Florist','Catering','Cake & Desserts','Furniture Rental','Hair & Makeup']);

export const ON_REQUEST_QUESTIONS = {
  'Florist': [
    'What is your overall floral style preference? (e.g. romantic, rustic, modern, wild)',
    'How many bridal party members need bouquets/buttonholes?',
    'Do you need ceremony flowers (arch, aisle, pew decorations)?',
    'How many reception tables need centrepieces?',
    'Do you prefer fresh, dried, or artificial flowers?',
    'Are there any flowers you love or want to avoid?',
    'Do you have a colour palette in mind?',
    'Will you need the florist to assist with setup and breakdown on the day?',
  ],
  'Catering': [
    'How many guests are you expecting?',
    'What meal style do you prefer? (e.g. sit-down, buffet, cocktail, grazing table)',
    'Do you need breakfast, lunch, dinner, or all-day service?',
    'Are there any dietary requirements or allergies we should know about?',
    'Do you need staff (waiters, bartenders) included in the quote?',
    'Will you need crockery, cutlery, and linen, or will the venue provide these?',
    'Do you have a food theme or cuisine preference?',
    'Will you need a late-night snack or additional meal service?',
  ],
  'Cake & Desserts': [
    'How many tiers would you like your wedding cake?',
    'What cake flavours are you considering? (e.g. vanilla, red velvet, lemon)',
    'Do you want a fondant or buttercream finish?',
    'What decoration style appeals to you? (e.g. floral, geometric, minimalist)',
    'How many guests will the cake need to serve?',
    'Do you need a dessert table in addition to the main cake?',
    'Are there any dietary requirements? (e.g. gluten-free, vegan)',
    'Do you have inspiration images or a colour palette to share?',
  ],
  'Furniture Rental': [
    'How many guests are you expecting?',
    'What furniture style do you prefer? (e.g. rustic, modern, bohemian, classic)',
    'Do you need ceremony seating (chairs/benches) or reception seating, or both?',
    'Are you looking for tables only, or a full furniture package (lounge areas, bar tables, etc.)?',
    'Do you need a dance floor included in the rental?',
    'Will you need delivery, setup, and collection included?',
    'Do you have a venue already — is it indoors, outdoors, or both?',
    'Do you have any inspiration images or a colour/style palette to share?',
  ],
  'Hair & Makeup': [
    'How many people in your bridal party need hair and/or makeup?',
    'Do you need both hair and makeup, or just one?',
    'What is your preferred makeup style? (e.g. natural, glam, editorial)',
    'What is your preferred hair style? (e.g. updo, loose waves, braided)',
    'Will a trial session be required before the wedding day?',
    'What time do you need to be ready by on the wedding day?',
    'Will the artist need to travel to your venue or accommodation?',
    'Do you have inspiration images or a colour palette to share?',
  ],
};

// ── UTILS ─────────────────────────────────────────────────────────────────────

export const BOOKING_ORDER = [
  {step:1, type:'Photography',     note:'Your photographer captures memories that last a lifetime.',                                              why:'Top photographers book 12+ months ahead. Locking this in early gives you the best selection.'},
  {step:2, type:'Catering',        note:'Food and drink is often the most talked-about part of a wedding reception.',                             why:'Caterers need lead time for menu planning, sourcing, and staffing for your guest count.'},
  {step:3, type:'Florist',         note:'Flowers set the mood — from the ceremony arch to table centrepieces and your bridal bouquet.',           why:'Florals require detailed planning and sourcing. Book early to secure your preferred style and blooms.'},
  {step:4, type:'Videography',     note:'A wedding film lets you relive every moment — sound, movement, and emotion — for years to come.',        why:'Great videographers are often booked alongside photographers and fill calendars quickly.'},
  {step:5, type:'DJ',              note:'Your DJ keeps the energy alive from the first dance to the last song.',                                  why:'Great DJs fill their weekends fast, especially in peak season.'},
  {step:6, type:'Entertainment',   note:'Pre-drinks entertainment keeps guests engaged while you finish photos — bands, soloists, or acts.',      why:'Live entertainers book up quickly for peak wedding season. Unique acts are limited.'},
  {step:7, type:'Cake & Desserts', note:'Your cake is a centrepiece and a treat. Custom designs take time and careful planning.',                 why:'Custom wedding cakes require design sessions, tastings, and preparation weeks in advance.'},
  {step:8, type:'Furniture Rental',note:'Tables, chairs, lounge sets, and dance floors transform a space into your dream setting.',              why:'Popular furniture styles get reserved early, especially for large guest counts.'},
  {step:9, type:'Hair & Makeup',   note:'Looking and feeling your best gives you the confidence to enjoy every moment of your wedding day.',      why:'Sought-after artists book out for wedding season. A trial session is also recommended.'},
];

// Additional vendors — not in the primary order but worth budgeting for
export const ADDITIONAL_VENDORS = [
  {type:'Barista', note:'A coffee bar adds a lovely touch during cocktail hour or as an after-dinner treat for guests.'},
];

// Budget ratios — how a typical wedding vendor budget is divided across categories.
// Logic: Based on South African wedding industry averages, weighted as follows:
//   Catering is the largest spend (~30%) as it scales with guest count.
//   Photography (~18%) and Videography (~12%) are premium services booked early.
//   Florist (~8%) and Furniture Rental (~7%) are decor essentials.
//   DJ (~7%) is a reception must-have.
//   Hair & Makeup (~5%), Entertainment (~5%), Cake & Desserts (~4%) round out the plan.
//   The remaining ~4% is left as flex budget for additional vendors like Barista.
// Total of primary categories = 96%, leaving ~4% flex for additional vendors.
export const BUDGET_RATIOS = {
  'Photography':    0.18,
  'Catering':       0.30,
  'Florist':        0.08,
  'DJ':             0.07,
  'Entertainment':  0.05,
  'Videography':    0.12,
  'Cake & Desserts':0.04,
  'Furniture Rental':0.07,
  'Hair & Makeup':  0.05,
  // Additional vendors share the remaining ~4%
  'Barista':        0.04,
};

// ── WEDDING PLAN VENUE INPUT (Google Maps autocomplete) ───────────────────────
export function WeddingPlanVenueInput({value, onChange, onLatLng}) {
