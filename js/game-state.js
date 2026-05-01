'use strict';

// -----------------------------------------------
// A. CONSTANTS
// -----------------------------------------------

const LOCATIONS = {
  sidewalk: { name: 'Sidewalk',        emoji: '🏘️', customers: 30,  rent: 0,  iceBonus: false },
  park:     { name: 'Park',            emoji: '🌳', customers: 50,  rent: 5,  iceBonus: false },
  beach:    { name: 'Beach',           emoji: '🏖️', customers: 70,  rent: 12, iceBonus: true  },
  market:   { name: 'Market Square',   emoji: '🏪', customers: 95,  rent: 20, iceBonus: false },
  festival: { name: 'Festival Grounds',emoji: '🎪', customers: 140, rent: 35, iceBonus: false },
  airport:  { name: 'Airport Terminal',emoji: '✈️', customers: 180, rent: 55, iceBonus: false },
};
// Price above which customers start walking away (location-specific - wealthier spots tolerate higher prices)
const LOCATION_TASTE_PROFILES = {
  sidewalk: { lemons: -0.2, sugar: 0.5, ice: -0.6, premiumPenalty: 0.08, note: 'Neighbourhood crowd prefers sweeter, cheaper cups.' },
  park:     { lemons: -0.1, sugar: 0.3, ice: 0.0, premiumPenalty: 0.03, note: 'Families like balanced sweetness and fair pricing.' },
  beach:    { lemons: 0.2,  sugar: -0.1, ice: 0.8, premiumPenalty: -0.02, note: 'Beachgoers reward colder, sharper lemonade.' },
  market:   { lemons: 0.4,  sugar: -0.2, ice: 0.1, premiumPenalty: -0.05, note: 'Busy foot traffic leans tart and tolerates premium stands.' },
  festival: { lemons: 0.1,  sugar: 0.4, ice: 0.5, premiumPenalty: -0.02, note: 'Festival crowds want bold, crowd-pleasing drinks.' },
};

const LOCATION_PRICEY_THRESH = {
  sidewalk: 1.75,  // Budget neighbourhood - very price sensitive
  park:     3.0,   // Families & joggers - moderately sensitive
  beach:    4.0,   // Tourists & sun-seekers - relaxed about price
  market:   4.75,  // Urban foot traffic - used to higher prices
  festival: 3.75,  // Mixed crowd - festive but not all rich
};

const WEATHER = [
  { id: 'sunny',  label: '☀️ Sunny',  emoji: '☀️',  mult: 0.95, tip: 'Good lemonade weather.',        hotDay: false },
  { id: 'warm',   label: '🌤 Warm',   emoji: '🌤',  mult: 1.10, tip: 'Warm weather helps sales.',     hotDay: false },
  { id: 'hot',    label: '🥵 Hot',    emoji: '🥵',  mult: 1.35, tip: 'Scorching! Add ice for a boost!',hotDay: true  },
  { id: 'cloudy', label: '☁️ Cloudy', emoji: '☁️',  mult: 0.68, tip: 'Foot traffic is a bit softer.', hotDay: false },
  { id: 'rainy',  label: '🌧 Rainy',  emoji: '🌧',  mult: 0.35, tip: 'Rain hurts sales - keep prices sharp.', hotDay: false },
];
const MARKET_WEATHER_EFFECTS = {
  sunny:  [{ ingredient:'lemons', impact:0.05, reason:'Sunny weather keeps lemon demand healthy.' }],
  warm:   [{ ingredient:'ice', impact:0.16, reason:'Warm weather is tightening ice supply.' }, { ingredient:'cups', impact:0.06, reason:'Warm weather means more takeaway cups moving.' }],
  hot:    [{ ingredient:'ice', impact:0.42, reason:'Heat is causing an ice shortage.' }, { ingredient:'cups', impact:0.12, reason:'Hot days burn through cup inventory.' }, { ingredient:'lemons', impact:0.08, reason:'Citrus vendors are seeing stronger demand.' }],
  cloudy: [{ ingredient:'ice', impact:-0.10, reason:'Cooler skies are leaving extra ice on the market.' }],
  rainy:  [{ ingredient:'ice', impact:-0.24, reason:'Rain is creating an ice surplus.' }, { ingredient:'lemons', impact:-0.08, reason:'Rainy foot traffic softens lemon demand.' }],
};

const MARKET_EVENT_EFFECTS = {
  festival:     [{ ingredient:'cups', impact:0.24, reason:'Festival prep is eating into cup stock.' }, { ingredient:'lemons', impact:0.18, reason:'Festival vendors are buying up lemons.' }, { ingredient:'sugar', impact:0.10, reason:'Snack stands are pulling sugar inventory.' }],
  backtoschool: [{ ingredient:'sugar', impact:0.14, reason:'Bake sales are squeezing sugar supply.' }, { ingredient:'cups', impact:0.08, reason:'School events are buying paper goods.' }],
  heatwave:     [{ ingredient:'ice', impact:0.28, reason:'The heat wave is keeping ice scarce.' }, { ingredient:'cups', impact:0.10, reason:'Everyone wants cold drinks to-go.' }],
};

const MARKET_RANDOM_SHOCKS = [
  { ingredient:'lemons', impact:0.18, reason:'A delivery delay hit the lemon wholesaler.' },
  { ingredient:'lemons', impact:-0.16, reason:'A citrus truck arrived early with extra stock.' },
  { ingredient:'sugar',  impact:0.14, reason:'Sugar futures spiked overnight.' },
  { ingredient:'sugar',  impact:-0.12, reason:'A bakery order was cancelled, freeing up sugar.' },
  { ingredient:'ice',    impact:0.22, reason:'A refrigeration breakdown tightened ice supply.' },
  { ingredient:'ice',    impact:-0.18, reason:'A cold-storage surplus is flooding the ice market.' },
  { ingredient:'cups',   impact:0.16, reason:'A paper goods shortage is pushing cup prices up.' },
  { ingredient:'cups',   impact:-0.12, reason:'A packaging overrun left cups on clearance.' },
];

const UPGRADE_MAINTENANCE = {
  juicer: 0.25,
  canopy: 0.75,
  powerjuicer: 1.25,
  register: 1.50,
  fridge: 1.25,
  iceomatic: 1.75,
  soundsystem: 3.00,
  neon: 4.50,
  dispenser: 5.00,
  icemaker: 6.50,
};

const STAND_TIER_MAINTENANCE = [0, 0.50, 1.50, 4.00];

// Per-unit prices match small bundle rates
const INGREDIENT_BASE = { lemons: 0.10, sugar: 0.08, ice: 0.025, cups: 0.015, mint: 0.35, strawberry: 0.70, applecinnamon: 0.50, honey: 0.90 };
const INGREDIENT_INFO = {
  lemons:        { name: 'Lemons',        emoji: '🍋', unit: 'each',    desc: 'Fresh lemons for your recipe' },
  sugar:         { name: 'Sugar',         emoji: '🍬', unit: 'portion', desc: 'Sweetens the lemonade' },
  cups:          { name: 'Cups',          emoji: '🥤', unit: 'each',    desc: 'Paper cups to serve customers' },
  ice:           { name: 'Ice',           emoji: '🧊', unit: 'portion', desc: 'Keeps it cold on hot days' },
  mint:          { name: 'Mint',          emoji: '🌿', unit: 'portion', desc: 'Fresh mint for cool drinks' },
  strawberry:    { name: 'Strawberry',    emoji: '🍓', unit: 'portion', desc: 'Sweet strawberries' },
  applecinnamon: { name: 'Apple Cinnamon',emoji: '🍎', unit: 'portion', desc: 'Warm spiced apple blend' },
  honey:         { name: 'Honey',         emoji: '🍯', unit: 'portion', desc: 'Natural honey sweetener' },
};
const MENU_SLOT_COSTS = [300, 700, 1500]; // unlock slots 2, 3, 4

// Bulk buying bundles (qty, total cost)
const MARKET_BUNDLES = {
  lemons: [
    { qty:15,  cost:1.50, label:'Small',  save:null },
    { qty:30,  cost:2.75, label:'Medium', save:null },
    { qty:50,  cost:4.25, label:'Large',  save:null },
  ],
  sugar:  [
    { qty:15,  cost:1.20, label:'Small',  save:null },
    { qty:30,  cost:2.25, label:'Medium', save:null },
    { qty:50,  cost:3.50, label:'Large',  save:null },
  ],
  ice:    [
    { qty:50,  cost:1.00, label:'Small',  save:null      },
    { qty:200, cost:3.00, label:'Medium', save:null      },
    { qty:500, cost:5.00, label:'Large',  save:null      },
  ],
  cups:   [
    { qty:75,  cost:1.00, label:'Small',  save:null },
    { qty:225, cost:2.35, label:'Medium', save:null },
    { qty:400, cost:3.75, label:'Large',  save:null },
  ],
  mint: [
    { qty:10, cost:3.00,  label:'Small',  save:null },
    { qty:25, cost:6.50,  label:'Medium', save:null },
    { qty:50, cost:11.00, label:'Large',  save:null },
  ],
  strawberry: [
    { qty:10, cost:6.00,  label:'Small',  save:null },
    { qty:25, cost:13.00, label:'Medium', save:null },
    { qty:50, cost:22.00, label:'Large',  save:null },
  ],
  applecinnamon: [
    { qty:10, cost:4.50,  label:'Small',  save:null },
    { qty:25, cost:10.00, label:'Medium', save:null },
    { qty:50, cost:17.00, label:'Large',  save:null },
  ],
  honey: [
    { qty:10, cost:8.00,  label:'Small',  save:null },
    { qty:25, cost:17.00, label:'Medium', save:null },
    { qty:50, cost:28.00, label:'Large',  save:null },
  ],
};

// Authentic Lemonade Tycoon GameHouse equipment upgrades
const UPGRADES = [
  { id:'juicer',      name:'High Output Citrus Juicer', cost:50,   emoji:'🍊', desc:'Get the juice out of lemons in no time! Uses 25% fewer lemons per cup' },
  { id:'canopy',      name:'ShadeMaker 3000 Canopy',    cost:130,  emoji:'⛱️', desc:'Keep your customers cool. +20% customers on hot & warm days, slight taste bonus with ice' },
  { id:'powerjuicer', name:'Miracle 9000 Power Juicer', cost:150,  emoji:'⚡', desc:'Refill pitchers at lightning fast speed! Refill time cut by 3x' },
  { id:'register',    name:'EZserve Cash Register',     cost:250,  emoji:'💳', desc:'Speed up your serving process! Serve each customer 40% faster' },
  { id:'fridge',      name:'Mr. Fridge',                cost:100,  emoji:'❄️', desc:'Never waste money on spoiled lemons again! Ice never melts overnight' },
  { id:'iceomatic',   name:'Ice-O-Matic Dispenser',     cost:400,  emoji:'🧊', desc:'Tired of wasting money on ice cubes? Uses 50% less ice per cup' },
  { id:'soundsystem', name:'High-Five Sound System',    cost:800,  emoji:'🎵', desc:'Have the grooviest music around. +15 customers, they wait 50% longer in line' },
  { id:'neon',        name:'Bright Lights Neon System', cost:1250, emoji:'💡', desc:'Grab their attention from blocks away. +20% customers, +3 reputation per day' },
  { id:'dispenser',   name:'Take2 Lemonade Dispenser',  cost:1600, emoji:'🤖', desc:'Lowers serving time AND fills pitchers faster. +5 pitcher capacity' },
  { id:'icemaker',    name:'High Output Auto Ice Maker', cost:2600, emoji:'🏭', desc:'Never run out of ice again! Automatically restores 50 ice every morning' },
];
// Employees hired per-day (reset each new day)
const EMPLOYEES = [
  { id:'lady',     name:'Lemonade Lady',   emoji:'👩‍🍳', cost:8,  desc:'Serves 30% faster - shorter wait times' },
  { id:'clown',    name:'Party Clown',     emoji:'🤡',   cost:12, desc:'Attracts +8 extra customers today' },
  { id:'musician', name:'Street Musician', emoji:'🎸',   cost:10, desc:'Customers stay in queue 40% longer' },
];
// Advertising tiers - one-time purchase, only best owned is active
const ADS = [
  { id:'ad_flyer',     name:'Paper Flyers',    emoji:'📄', cost:5,    custBonus:15, repGain:2, desc:'+15 customers/day, +2 rep - hand-written flyers around town' },
  { id:'ad_radio',     name:'Radio Spot',      emoji:'📻', cost:10,   custBonus:30, repGain:4, desc:'+30 customers/day, +4 rep - local radio jingle' },
  { id:'ad_newspaper', name:'Newspaper Ad',    emoji:'📰', cost:20,   custBonus:50, repGain:6, desc:'+50 customers/day, +6 rep - Sunday classifieds' },
  { id:'ad_tv',        name:'TV Commercial',   emoji:'📺', cost:50,   custBonus:80, repGain:9, desc:'+80 customers/day, +9 rep - primetime slot!' },
  { id:'ad_blimp',     name:'Blimp Ad',        emoji:'🎈', cost:100,  custBonus:130,repGain:12,desc:'+130 customers/day, +12 rep - everyone sees it!' },
];
const ACHIEVEMENTS_DEF = [
  // -- Early game ----------------------------
  { id:'first_sale',      name:'First Sale',        emoji:'🥤', desc:'Complete your very first day of sales' },
  { id:'first_amazing',   name:'Secret Recipe',     emoji:'🌟', desc:'Get an Amazing taste rating for the first time' },
  { id:'sold_out',        name:'Sold Out!',          emoji:'🎉', desc:'Sell out your full inventory 5 times' },
  { id:'weatherproof',    name:'Weatherproof',       emoji:'☔', desc:'Turn a profit on a Rainy day' },
  // -- Mid game ------------------------------
  { id:'sweet_spot',      name:'Sweet Spot',         emoji:'⭐', desc:'Achieve Amazing taste 3 days in a row' },
  { id:'festival_king',   name:'Festival King',      emoji:'🎪', desc:'Sell lemonade at Festival Grounds' },
  { id:'beach_bod',       name:'Beach Bod',          emoji:'🏖️', desc:'Sell 50+ cups in one day at the Beach' },
  { id:'price_master',    name:'Price Master',       emoji:'💲', desc:'Earn $20+ profit in a single day' },
  { id:'century',         name:'Century Club',       emoji:'💯', desc:'Serve 100 customers in a single day' },
  { id:'heat_wave_king',  name:'Heat Wave King',     emoji:'🔥', desc:'Profit during a Hot day with max ice in recipe' },
  // -- Progression ---------------------------
  { id:'first_upgrade',   name:'Upgraded!',          emoji:'⚡', desc:'Purchase your first equipment upgrade' },
  { id:'full_staff',      name:'Full Team',           emoji:'🧑‍🍳', desc:'Have all 3 staff hired at the same time' },
  { id:'millionaire',     name:'Millionaire',         emoji:'💰', desc:'Accumulate $1000+ total profit' },
  { id:'week_survivor',   name:'Week Survivor',       emoji:'📅', desc:'Survive 7 days in business' },
  { id:'month_survivor',  name:'Lemon Legend',        emoji:'🍋', desc:'Survive 30 days in business' },
  // -- Late game -----------------------------
  { id:'empire_builder',  name:'Empire Builder',      emoji:'🏰', desc:'Purchase the Castle Stand' },
  { id:'grossophobe',     name:'Zero Tolerance',      emoji:'🚫', desc:'Complete a day with zero Gross reactions' },
  { id:'reputation_max',  name:'Town Hero',           emoji:'🦸', desc:'Reach 95+ reputation' },
  // -- Seasonal & Research ------------------
  { id:'season_master',   name:'All-Season Seller',   emoji:'🌏', desc:'Earn a profit in all 4 seasons' },
  { id:'artisan',         name:'Artisan Mixologist',  emoji:'🧪', desc:'Use a Tier 3 artisan combo and achieve Amazing taste' },
  { id:'year_two',        name:'Year Two',            emoji:'📆', desc:'Survive a full year in business (60 days)' },
];

const EVENTS = [
  { id:'festival',       title:'🎡 Summer Festival!',        desc:'Festival Grounds open today — 3× customers!',           duration:1, season:'summer' },
  { id:'backtoschool',   title:'🏫 Back to School',           desc:'Park gets +20 customers for 3 days!',                   duration:3, season:'fall'   },
  { id:'heatwave',       title:'🔥 Heat Wave!',               desc:'All hot weather for 5 days — ice demand doubles!',      duration:5, season:'summer' },
  { id:'cherryblossom',  title:'🌸 Cherry Blossom Festival',  desc:'The park is packed with visitors this weekend!',        duration:2, season:'spring' },
  { id:'farmersmarket',  title:'🥕 Farmers Market Weekend',   desc:'Ingredient prices drop 20% this weekend!',              duration:1, season:'spring' },
  { id:'beachvolleyball',title:'🏐 Beach Volleyball Tournament',desc:'The beach is swarming with athletes and fans!',       duration:2, season:'summer' },
  { id:'harvestfair',    title:'🎃 Harvest Fair',             desc:'Families flood the market square for the fair!',        duration:2, season:'fall'   },
  { id:'wintermarket',   title:'⛄ Winter Market',            desc:'The sidewalk and park buzz with warm-drink seekers!',   duration:3, season:'winter' },
  { id:'hotdrinkcraze',  title:'🍵 Hot Drink Craze',         desc:'Honey lemonade is trending — warm flavors sell better!',duration:2, season:'winter' },
];

// ── Seasonal system ──────────────────────────────────────────────────────────
const SEASONS = {
  spring: {
    label:'🌸 Spring', color:'#43A047', bgAccent:'#E8F5E9', borderColor:'#81C784',
    weatherWeights:{ sunny:0.30, warm:0.30, cloudy:0.25, rainy:0.15, hot:0.00 },
    specialIngredient:'mint',
    customerType:'healthnut',
    eventIds:['cherryblossom','farmersmarket'],
    marketSignals:{ sugar:-0.10, ice:-0.15 },
  },
  summer: {
    label:'☀️ Summer', color:'#F9A825', bgAccent:'#FFFDE7', borderColor:'#FFD740',
    weatherWeights:{ sunny:0.25, warm:0.25, hot:0.35, cloudy:0.10, rainy:0.05 },
    specialIngredient:'strawberry',
    customerType:'tourist',
    eventIds:['heatwave','beachvolleyball','festival'],
    marketSignals:{ ice:0.40, lemons:0.15 },
  },
  fall: {
    label:'🍂 Fall', color:'#E65100', bgAccent:'#FFF3E0', borderColor:'#FFA040',
    weatherWeights:{ sunny:0.20, warm:0.15, cloudy:0.35, rainy:0.25, hot:0.05 },
    specialIngredient:'applecinnamon',
    customerType:'student',
    eventIds:['backtoschool','harvestfair'],
    marketSignals:{ sugar:0.10, cups:0.15 },
  },
  winter: {
    label:'❄️ Winter', color:'#1565C0', bgAccent:'#E3F2FD', borderColor:'#64B5F6',
    weatherWeights:{ sunny:0.10, warm:0.05, cloudy:0.40, rainy:0.30, hot:0.00 },
    specialIngredient:'honey',
    customerType:'comfort',
    eventIds:['wintermarket','hotdrinkcraze'],
    marketSignals:{ ice:-0.30, lemons:-0.10 },
  },
};

// Special ingredient cost data — used by calcIngredientCost for recipe costing
const SPECIAL_INGREDIENTS = {
  mint:         { label:'Mint',          emoji:'🌿', marketPrice:0.30 },
  strawberry:   { label:'Strawberry',    emoji:'🍓', marketPrice:0.60 },
  applecinnamon:{ label:'Apple Cinnamon',emoji:'🍎', marketPrice:0.45 },
  honey:        { label:'Honey',         emoji:'🍯', marketPrice:0.80 },
};

// Purchasable drink variants — each unlocks a new menu slot with that drink
const MENU_VARIANTS = [
  { id:'classic',       name:'Classic Lemonade',    emoji:'🍋',  cost:0,    suggestedPrice:1.75,
    recipe:{ lemonsPerCup:2, sugarPerCup:2, icePerCup:1 },
    tasteBonus:0,    bestSeason:null,     bestWeather:[],
    hint:'The timeless original — beloved everywhere.' },
  { id:'mint',          name:'Mint Lemonade',        emoji:'🌿',  cost:100,  suggestedPrice:2.25,
    recipe:{ lemonsPerCup:2, sugarPerCup:2, icePerCup:2, mintPerCup:1 },
    tasteBonus:0.08, bestSeason:'spring', bestWeather:['cloudy','rainy'],
    hint:'Cool and refreshing. Shines on spring days.' },
  { id:'pink',          name:'Pink Lemonade',        emoji:'🌸',  cost:150,  suggestedPrice:2.25,
    recipe:{ lemonsPerCup:2, sugarPerCup:3, icePerCup:1, strawberryPerCup:1 },
    tasteBonus:0.08, bestSeason:'summer', bestWeather:['hot','warm'],
    hint:'Sweet and photogenic. Tourists love it.' },
  { id:'sparkling',     name:'Sparkling Lemonade',   emoji:'🫧',  cost:200,  suggestedPrice:2.50,
    recipe:{ lemonsPerCup:3, sugarPerCup:2, icePerCup:2 },
    tasteBonus:0.07, bestSeason:null,     bestWeather:['hot','warm'],
    hint:'Premium and bubbly. Commands higher prices.' },
  { id:'strawberry',    name:'Strawberry Lemonade',  emoji:'🍓',  cost:250,  suggestedPrice:2.75,
    recipe:{ lemonsPerCup:2, sugarPerCup:2, icePerCup:2, strawberryPerCup:1 },
    tasteBonus:0.09, bestSeason:'summer', bestWeather:['hot','warm'],
    hint:'Summer blockbuster. Tourists go wild for it.' },
  { id:'applecinnamon', name:'Apple Cinnamon',       emoji:'🍎',  cost:300,  suggestedPrice:2.75,
    recipe:{ lemonsPerCup:2, sugarPerCup:2, icePerCup:0, applecinnamonPerCup:1 },
    tasteBonus:0.10, bestSeason:'fall',   bestWeather:['cloudy','rainy'],
    hint:'Warm and spiced. Fall comfort seekers adore it.' },
  { id:'honey',         name:'Honey Lemonade',       emoji:'🍯',  cost:400,  suggestedPrice:3.00,
    recipe:{ lemonsPerCup:3, sugarPerCup:1, icePerCup:0, honeyPerCup:1 },
    tasteBonus:0.12, bestSeason:'winter', bestWeather:['cloudy','rainy'],
    hint:'Soothing and premium. Winter crowds love it.' },
  { id:'tropical',      name:'Tropical Mix',         emoji:'🌴',  cost:500,  suggestedPrice:3.50,
    recipe:{ lemonsPerCup:2, sugarPerCup:2, icePerCup:2, mintPerCup:1, strawberryPerCup:1 },
    tasteBonus:0.15, bestSeason:'summer', bestWeather:['hot','warm'],
    hint:'The ultimate summer special. Commands premium prices.' },
];

const CUSTOMER_TYPES = {
  tourist:  { label:'🏖️ Tourists',       priceThresholdMult:1.20, demandMult:1.05, tip:'Price-tolerant and love fruity flavors.' },
  student:  { label:'🎓 Students',        priceThresholdMult:0.80, demandMult:0.95, tip:'Budget-conscious — keep prices low!' },
  healthnut:{ label:'🥗 Health Nuts',     priceThresholdMult:1.05, demandMult:1.00, tip:'They reward Amazing taste with bonus rep.' },
  comfort:  { label:'☕ Comfort Seekers', priceThresholdMult:1.00, demandMult:1.00, tip:'Love warm flavors like honey and cinnamon.' },
  regular:  { label:'👥 Regulars',        priceThresholdMult:1.00, demandMult:1.00, tip:'Your loyal crowd — rep matters most.' },
};

// Seasonal market signals for new events
const MARKET_SEASON_EVENT_EFFECTS = {
  cherryblossom:   [{ ingredient:'lemons', impact:0.10, reason:'Festival demand is boosting lemon prices.' }],
  farmersmarket:   [{ ingredient:'lemons', impact:-0.20, reason:'The Farmers Market flooded supply — prices dipped.' }, { ingredient:'sugar', impact:-0.15, reason:'Farmers Market deals cut sugar costs.' }],
  beachvolleyball: [{ ingredient:'ice', impact:0.18, reason:'Tournament crowds are draining ice supply.' }, { ingredient:'cups', impact:0.12, reason:'High cup demand at the beach event.' }],
  harvestfair:     [{ ingredient:'sugar', impact:0.12, reason:'Harvest Fair baking demand is up.' }],
  wintermarket:    [{ ingredient:'ice', impact:-0.20, reason:'Winter cold leaves ice in surplus.' }],
  hotdrinkcraze:   [{ ingredient:'sugar', impact:0.08, reason:'Warm drink trend is pulling sugar demand.' }],
};
// Stand tiers match original Lemonade Tycoon GameHouse pricing
const STAND_UPGRADES = [
  { tier:1, id:'stand_classic', name:'Classic Stand',  emoji:'🏪', cost:450,   custBonus:15, pitcherCap:8,  desc:'A classic look for a guaranteed hit! Pitcher 8, bigger storage space' },
  { tier:2, id:'stand_lemon',   name:'Lemon Stand',    emoji:'🍋', cost:1000,  custBonus:30, pitcherCap:12, desc:'The ultimate stand on the market! Pitcher 12, huge storage capacity' },
  { tier:3, id:'stand_castle',  name:'Castle Stand',   emoji:'🏰', cost:10000, custBonus:60, pitcherCap:20, desc:'Tourists travel just to see it! Pitcher 20, maximum storage' },
];
const STAND_CUST_BONUS   = [0, 15, 30, 60]; // index = tier (0=default, 1=classic, 2=lemon, 3=castle)
const STAND_PITCHER_BASE = [5,  8, 12, 20]; // pitcher capacity per stand tier

// Ideal recipe - all whole numbers so players can actually hit it.
// Default (2,2,1) scores ~0.53 (Delicious). Perfect (3,2,2) = Amazing.
// Weather shifts the ideal ice: hot->2, rainy->0. Remove ice on rainy days!
const IDEAL = { lemons: 3, sugar: 2, ice: 2 };
const NORM_FACTOR = 3.0;

// -----------------------------------------------
// B. STATE
// -----------------------------------------------

let S = {};

function defaultState() {
  return {
    coins: 40,
    day: 1,
    reputation: 50,
    inventory: { lemons: 0, sugar: 0, cups: 0, ice: 0, mint: 0, strawberry: 0, applecinnamon: 0, honey: 0 },
    upgrades: {},
    unlockedLocations: ['sidewalk','park','beach','market'],
    achievements: {},
    last7DaysProfits: [],
    locationHistory: [],
    totalProfit: 0,
    bestDay: 0,
    allTimeCustomers: 0,
    pendingEvent: null,
    activeEvent: null,
    activeEventDays: 0,
    phase: 'day',
    currentLocation: 'sidewalk',
    menuSlots: 1,
    menu: [
      { variantId:'classic', recipe: { cupsToMake:10, lemonsPerCup:2, sugarPerCup:2, icePerCup:1, mintPerCup:0, strawberryPerCup:0, applecinnamonPerCup:0, honeyPerCup:0 }, price:1.75, active:true },
      null, null, null,
    ],
    unlockedVariants: ['classic'],
    consecutiveLegendary: 0,
    soldOutCount: 0,
    currentWeather: 'sunny',
    marketPrices: { ...INGREDIENT_BASE },
    prevMarketPrices: { ...INGREDIENT_BASE },
    marketNews: [],
    marketForecast: [],
    soundEnabled: true,
    musicEnabled: true,
    marketSpentToday: 0,
    dayResult: null,
    franchiseIncome: 0,
    hiredToday: {},
    adsToday: {},
    iceMeltedYesterday: 0,
    standTier: 0,
    locationRep: { sidewalk: 50, park: 50, beach: 50, market: 50, festival: 50 },
    // Seasonal system
    season: 'spring',
    year: 1,
    weatherForecast: [],
    customerPersonality: 'regular',
    seasonsProfit: { spring: false, summer: false, fall: false, winter: false },
    _savedAt: null,
  };
}

// -----------------------------------------------
// C. PERSISTENCE
// -----------------------------------------------

// Multi-slot save system (3 slots + legacy migration)
const SLOT_KEYS   = ['lemonEmpire_slot1', 'lemonEmpire_slot2', 'lemonEmpire_slot3'];
const LAST_SLOT_KEY  = 'lemonEmpire_lastSlot';
const LEGACY_KEY     = 'lemonEmpire_v1';  // old single-save key for migration
let _activeSlot = 0;   // index 0-2

function saveState() {
  try {
    S._savedAt = Date.now();
    localStorage.setItem(SLOT_KEYS[_activeSlot], JSON.stringify(S));
    localStorage.setItem(LAST_SLOT_KEY, String(_activeSlot));
  } catch(e) {}
}

function _parseRaw(raw) {
  const parsed = JSON.parse(raw);
  const ns = Object.assign(defaultState(), parsed);
  ns.inventory = Object.assign({ lemons:0, sugar:0, cups:0, ice:0, mint:0, strawberry:0, applecinnamon:0, honey:0 }, parsed.inventory);
  // Migration: old saves stored special ingredients in specialInventory — merge into inventory
  if (parsed.specialInventory) {
    ['mint','strawberry','applecinnamon','honey'].forEach(id => {
      if (parsed.specialInventory[id]) ns.inventory[id] = (ns.inventory[id]||0) + parsed.specialInventory[id];
    });
  }

  // Menu migration: old saves have recipe/price but not menu
  const defaultRecipe = { cupsToMake:10, lemonsPerCup:2, sugarPerCup:2, icePerCup:1, mintPerCup:0, strawberryPerCup:0, applecinnamonPerCup:0, honeyPerCup:0 };
  if (parsed.recipe && !parsed.menu) {
    ns.menu = [
      { recipe: Object.assign({}, defaultRecipe, parsed.recipe), price: parsed.price || 1.75, active: true },
      null, null, null,
    ];
    ns.menuSlots = 1;
  } else if (Array.isArray(parsed.menu)) {
    ns.menu = [0,1,2,3].map(i => {
      const slot = parsed.menu[i];
      if (!slot) return i === 0 ? { recipe: { ...defaultRecipe }, price: 1.75, active: true } : null;
      return { ...slot, recipe: Object.assign({}, defaultRecipe, slot.recipe), active: slot.active !== false };
    });
    ns.menuSlots = parsed.menuSlots || 1;
  }

  // unlockedVariants: migrate from old researchedIngredients if present
  if (!parsed.unlockedVariants) {
    const ri = parsed.researchedIngredients || {};
    const unlocked = ['classic'];
    if ((ri.mint         || 0) >= 1) unlocked.push('mint');
    if ((ri.strawberry   || 0) >= 1) unlocked.push('strawberry', 'pink');
    if ((ri.applecinnamon|| 0) >= 1) unlocked.push('applecinnamon');
    if ((ri.honey        || 0) >= 1) unlocked.push('honey');
    ns.unlockedVariants = [...new Set(unlocked)];
  } else {
    ns.unlockedVariants = Array.isArray(parsed.unlockedVariants) ? parsed.unlockedVariants : ['classic'];
  }
  ns.seasonsProfit = Object.assign({ spring:false, summer:false, fall:false, winter:false }, parsed.seasonsProfit);
  if (!ns.weatherForecast || !Array.isArray(ns.weatherForecast)) ns.weatherForecast = [];
  ns.marketPrices    = Object.assign({ ...INGREDIENT_BASE }, parsed.marketPrices);
  ns.prevMarketPrices= Object.assign({ ...INGREDIENT_BASE }, parsed.prevMarketPrices);
  ns.marketNews      = Array.isArray(parsed.marketNews) ? parsed.marketNews : [];
  ns.marketForecast  = Array.isArray(parsed.marketForecast) ? parsed.marketForecast : [];
  ns.locationRep     = Object.assign({ sidewalk:50, park:50, beach:50, market:50, festival:50 }, parsed.locationRep);
  if (!ns.adsToday) ns.adsToday = {};
  Object.keys(LOCATIONS).forEach(k => {
    if (!LOCATIONS[k].eventOnly && !ns.unlockedLocations.includes(k)) ns.unlockedLocations.push(k);
  });
  return ns;
}

function getSlotInfo(idx) {
  try {
    const raw = localStorage.getItem(SLOT_KEYS[idx]);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      day:         p.day || 1,
      coins:       p.coins || 0,
      totalProfit: p.totalProfit || 0,
      upgrades:    Object.keys(p.upgrades || {}).length,
      timestamp:   p._savedAt || null,
    };
  } catch(e) { return null; }
}

function loadFromSlot(idx) {
  try {
    const raw = localStorage.getItem(SLOT_KEYS[idx]);
    if (raw) {
      _activeSlot = idx;
      S = _parseRaw(raw);
    } else {
      _activeSlot = idx;
      S = defaultState();
      initNewGame();
    }
  } catch(e) { _activeSlot = idx; S = defaultState(); initNewGame(); }
}

function deleteSlot(idx) {
  try { localStorage.removeItem(SLOT_KEYS[idx]); } catch(e) {}
}

function loadState() {
  // Migrate legacy save ? slot 0 if slot 0 is empty
  try {
    const legRaw = localStorage.getItem(LEGACY_KEY);
    if (legRaw && !localStorage.getItem(SLOT_KEYS[0])) {
      localStorage.setItem(SLOT_KEYS[0], legRaw);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch(e) {}
}

function initNewGame() {
  S.season = getSeason(S.day);
  S.year   = getYear(S.day);
  S.customerPersonality = SEASONS[S.season].customerType;
  S.currentWeather = pickWeather();
  S.weatherForecast = [
    pickWeatherForDay(S.day + 1),
    pickWeatherForDay(S.day + 2),
    pickWeatherForDay(S.day + 3),
  ];
  refreshMarketPrices();
}

function resumeLoadedGame() {
  // Ensure season/year are synced after load
  S.season = getSeason(S.day);
  S.year   = getYear(S.day);
  if (!S.customerPersonality) S.customerPersonality = SEASONS[S.season].customerType;
  if (!S.weatherForecast || !S.weatherForecast.length) {
    S.weatherForecast = [
      pickWeatherForDay(S.day + 1),
      pickWeatherForDay(S.day + 2),
      pickWeatherForDay(S.day + 3),
    ];
  }
  updateTopBar();

  if (S.phase === 'result' && S.dayResult) {
    showScreen('result');
    return;
  }

  // Selling is not persisted as a resumable live simulation, so fall back to the day setup.
  if (S.phase === 'selling') {
    S.phase = 'day';
  }

  showScreen('day');
}

// -- MAIN MENU ----------------------------------

let _slotsMode = 'load'; // 'load' | 'new'

function showMainMenu() {
  document.getElementById('menu-screen').classList.remove('hidden');
  document.getElementById('slots-screen').classList.add('hidden');
  document.getElementById('tutorial-overlay').classList.add('hidden');
  if (S.musicEnabled) musicStart();

  // Show "Continue" button only if last-used slot has data
  const lastSlot = parseInt(localStorage.getItem(LAST_SLOT_KEY) || '0');
  const hasLast  = getSlotInfo(lastSlot) !== null;
  const contBtn  = document.getElementById('menu-continue-btn');
  contBtn.style.display = hasLast ? '' : 'none';
  contBtn.dataset.slot  = String(lastSlot);

  // Show "Load Game" only if any slot has data
  const anySlot = SLOT_KEYS.some((_, i) => getSlotInfo(i) !== null);
  document.getElementById('menu-load-btn').style.display = anySlot ? '' : 'none';
}

function hideMenu() {
  document.getElementById('menu-screen').classList.add('hidden');
  document.getElementById('slots-screen').classList.add('hidden');
}

function showSlotPicker(mode) {
  _slotsMode = mode;
  document.getElementById('slots-title').textContent =
    mode === 'new' ? '🎮 Choose Save Slot' : '📂 Load Game';
  document.getElementById('slots-screen').classList.remove('hidden');
  renderSlots();
}

function renderSlots() {
  const list = document.getElementById('slots-list');
  list.innerHTML = SLOT_KEYS.map((_, idx) => {
    const info = getSlotInfo(idx);
    const num  = `SLOT ${idx + 1}`;
    if (info) {
      const dateStr = info.timestamp
        ? new Date(info.timestamp).toLocaleDateString(undefined, { month:'short', day:'numeric' })
        : '';
      const coinsCol = info.coins < 0 ? '#E53935' : '#FFD700';
      return `<div class="slot-card slot-filled">
        <div class="slot-num">${num}</div>
        <div class="slot-day">📅 Day ${info.day}</div>
        <div class="slot-coins" style="color:${coinsCol}">💰 $${info.coins.toFixed(2)}</div>
        <div class="slot-details">
          <span class="slot-detail-chip">🏆 $${info.totalProfit.toFixed(0)} total</span>
          <span class="slot-detail-chip">🧰 ${info.upgrades} upgrades</span>
        </div>
        ${dateStr ? `<div class="slot-date">Saved ${dateStr}</div>` : ''}
        <div class="slot-actions">
          ${_slotsMode === 'load'
            ? `<button class="slot-btn slot-load-btn" data-slotaction="load" data-slotidx="${idx}">▶ Load</button>`
            : `<button class="slot-btn slot-over-btn" data-slotaction="overwrite" data-slotidx="${idx}">⚠️ Overwrite</button>`}
          <button class="slot-btn slot-del-btn" data-slotaction="delete" data-slotidx="${idx}" title="Delete">🗑️</button>
        </div>
      </div>`;
    } else {
      return `<div class="slot-card slot-empty">
        <div class="slot-num">${num}</div>
        <div class="slot-empty-label">— Empty —</div>
        <button class="slot-btn slot-new-btn" data-slotaction="new" data-slotidx="${idx}" style="width:100%">🍋 Start Here</button>
      </div>`;
    }
  }).join('');
}

function handleSlotAction(idx, action) {
  if (action === 'delete') {
    if (!confirm(`Delete Slot ${idx + 1}? This cannot be undone.`)) return;
    deleteSlot(idx);
    renderSlots();
    // Refresh "Load Game" button visibility on menu
    const anySlot = SLOT_KEYS.some((_,i) => getSlotInfo(i) !== null);
    document.getElementById('menu-load-btn').style.display = anySlot ? '' : 'none';
    return;
  }
  if (action === 'load') {
    loadFromSlot(idx);
    hideMenu();
    resumeLoadedGame();
    saveState(); // write _savedAt
    return;
  }
  if (action === 'new' || action === 'overwrite') {
    if (action === 'overwrite') {
      if (!confirm(`Overwrite Slot ${idx + 1}? Your current progress in this slot will be lost.`)) return;
    }
    deleteSlot(idx);
    _activeSlot = idx;
    S = defaultState();
    initNewGame();
    hideMenu();
    updateTopBar();
    showScreen('day');
    saveState();
    // Show tutorial for brand new game
    setTimeout(() => showTutorial(), 400);
    return;
  }
}

// -- TUTORIAL -----------------------------------

const TUTORIAL_STEPS = [
  {
    emoji: '🍋',
    title: 'Welcome to Lemon Empire!',
    text: 'You\'re about to run your very own lemonade stand. Start small, grow big, and build a lemonade dynasty!',
    art: null,
  },
  {
    emoji: '🛒',
    title: 'Buy Ingredients First',
    text: 'Before you can open your stand, head to the Market tab to buy lemons, sugar, ice, and cups. You can\'t sell without supplies!',
    art: '🍋 Lemons  🍬 Sugar\n🧊 Ice     🥤 Cups',
  },
  {
    emoji: '🧪',
    title: 'Craft Your Recipe',
    text: 'On the Day screen, set how many lemons, sugar, and ice go into each cup. The closer to the ideal mix, the better the taste!',
    art: '⭐⭐⭐ Amazing!   (perfect recipe)\n⭐⭐  Delicious  (close enough)\n⭐    Gross...   (way off)',
  },
  {
    emoji: '🌤️',
    title: 'Weather Changes Everything',
    text: 'Check the weather each day! Hot days -> more ice is better. Rainy days -> skip the ice. Warm days drive more customers!',
    art: '🥵 Hot   -> more ice\n☀️ Sunny -> standard\n🌧 Rainy -> no ice needed',
  },
  {
    emoji: '💰',
    title: 'Set Your Price',
    text: 'Use the price slider to choose how much to charge. Price too high and customers walk away. Price too low and you won\'t profit!',
    art: 'Cost per cup: ~$0.35\nCharge $0.75 -> profit ✅\nCharge $5.00 -> nobody buys ❌',
  },
  {
    emoji: '📍',
    title: 'Pick Your Location',
    text: 'Different spots bring different crowds. The Sidewalk is free but quiet. The Beach is busy but costs rent. Unlock new spots as you earn!',
    art: '🏘️ Sidewalk - 18 customers, free\n🌳 Park     - 28 customers, $5 rent\n🏖️ Beach    - 40 customers, $12 rent',
  },
  {
    emoji: '🏪',
    title: 'Upgrade Your Stand',
    text: 'Visit the Shop to buy equipment, hire staff, and run ads. Upgrades make your stand more efficient, attract more customers, and boost quality!',
    art: '⚡ Equipment - better recipes\n🧑‍🍳 Staff   - more customers\n📣 Ads      - reputation boost',
  },
  {
    emoji: '⭐',
    title: 'Build Your Reputation',
    text: 'Happy customers raise your reputation, bringing even more customers. Amazing reviews boost rep fast - bad ones hurt it. Keep that score high!',
    art: '🤩 Amazing   -> rep +5\n😋 Delicious -> rep +1\n🤢 Gross     -> rep -5',
  },
  {
    emoji: '🏆',
    title: 'You\'re Ready!',
    text: 'Buy ingredients, set your recipe, pick a location, set your price, then tap Open Stand. Watch the customers roll in - and grow your empire!',
    art: null,
  },
];

// ── Menu item name / emoji — uses variantId when available ───────────────────
function getMenuItemName(recipe, variantId) {
  if (variantId) {
    const v = MENU_VARIANTS.find(mv => mv.id === variantId);
    if (v) return v.name;
  }
  // Fallback for legacy saves
  if ((recipe.mintPerCup || 0) >= 1 && (recipe.strawberryPerCup || 0) >= 1) return 'Tropical Mix';
  if ((recipe.honeyPerCup || 0) >= 1)         return 'Honey Lemonade';
  if ((recipe.applecinnamonPerCup || 0) >= 1) return 'Apple Cinnamon';
  if ((recipe.strawberryPerCup || 0) >= 1)    return 'Strawberry Lemonade';
  if ((recipe.mintPerCup || 0) >= 1)          return 'Mint Lemonade';
  return 'Classic Lemonade';
}

function getMenuItemEmoji(recipe, variantId) {
  if (variantId) {
    const v = MENU_VARIANTS.find(mv => mv.id === variantId);
    if (v) return v.emoji;
  }
  if ((recipe.mintPerCup || 0) >= 1 && (recipe.strawberryPerCup || 0) >= 1) return '🌴';
  if ((recipe.honeyPerCup || 0) >= 1)         return '🍯';
  if ((recipe.applecinnamonPerCup || 0) >= 1) return '🍎';
  if ((recipe.strawberryPerCup || 0) >= 1)    return '🍓';
  if ((recipe.mintPerCup || 0) >= 1)          return '🌿';
  return '🍋';
}

let _tutStep = 0;

function showTutorial() {
  _tutStep = 0;
  document.getElementById('tutorial-overlay').classList.remove('hidden');
  renderTutStep();
}

function renderTutStep() {
  const step  = TUTORIAL_STEPS[_tutStep];
  const total = TUTORIAL_STEPS.length;

  document.getElementById('tutorial-dots').innerHTML = TUTORIAL_STEPS
    .map((_, i) => `<div class="tut-dot${i === _tutStep ? ' active' : ''}"></div>`)
    .join('');

  document.getElementById('tutorial-emoji').textContent = step.emoji;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-text').textContent  = step.text;

  const artEl = document.getElementById('tutorial-art');
  if (step.art) {
    artEl.textContent = step.art;
    artEl.style.display = '';
  } else {
    artEl.style.display = 'none';
  }

  const prevBtn = document.getElementById('tut-prev');
  const nextBtn = document.getElementById('tut-next');
  prevBtn.style.display = _tutStep === 0 ? 'none' : '';
  nextBtn.textContent   = _tutStep === total - 1 ? '🍋 Let\'s Go!' : 'Next →';
}



