// Vendor type lists, booking order, budget ratios, question sets

export const ALL_TYPES = ['Photography','Catering','Florist','DJ','Entertainment','Videography','Cake & Desserts','Barista','Furniture Rental','Hair & Makeup'];
export const TYPE_EMOJI = {'Photography':'📷','Catering':'🍽','Florist':'💐','DJ':'🎧','Entertainment':'🎶','Videography':'🎬','Cake & Desserts':'🎂','Barista':'☕','Furniture Rental':'🛋','Hair & Makeup':'💄'};

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
