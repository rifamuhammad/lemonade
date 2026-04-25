'use strict';

// ── Seasonal utilities ───────────────────────────────────────────────────────
function getSeason(day) {
  const d = ((day - 1) % 60) + 1;
  if (d <= 15) return 'spring';
  if (d <= 30) return 'summer';
  if (d <= 45) return 'fall';
  return 'winter';
}
function getYear(day) { return Math.floor((day - 1) / 60) + 1; }
function getSeasonDay(day) { return ((day - 1) % 15) + 1; }

function _pickWeatherForSeason(seasonKey, forceNoHeatwave) {
  const wmap = SEASONS[seasonKey].weatherWeights;
  const keys = Object.keys(wmap);
  let r = Math.random();
  let cum = 0;
  for (const k of keys) {
    cum += wmap[k];
    if (r < cum) return k;
  }
  return keys[0];
}

function pickWeatherForDay(day) {
  const season = getSeason(day);
  return _pickWeatherForSeason(season, false);
}

function pickWeather() {
  if (S.activeEvent && S.activeEvent.id === 'heatwave') return 'hot';
  return _pickWeatherForSeason(getSeason(S.day), false);
}

function clampValue(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function getLocationTasteProfile(locationKey) {
  return LOCATION_TASTE_PROFILES[locationKey || S.currentLocation] || {
    lemons: 0, sugar: 0, ice: 0, premiumPenalty: 0, note: ''
  };
}

function getBundleCost(key, qty) {
  const bundle = (MARKET_BUNDLES[key] || []).find(b => b.qty === qty);
  if (!bundle) return roundMoney((S.marketPrices[key] || 0) * qty);

  const baseCost = INGREDIENT_BASE[key] * qty;
  const bundleRatio = baseCost > 0 ? (bundle.cost / baseCost) : 1;
  return roundMoney((S.marketPrices[key] || 0) * qty * bundleRatio);
}

function pickMarketShock() {
  if (Math.random() < 0.45) return null;
  return MARKET_RANDOM_SHOCKS[Math.floor(Math.random() * MARKET_RANDOM_SHOCKS.length)];
}

function buildMarketSignals(weatherId, eventId, shock) {
  const signals = [];
  (MARKET_WEATHER_EFFECTS[weatherId] || []).forEach(sig => signals.push({ ...sig, source: 'weather' }));
  if (eventId) (MARKET_EVENT_EFFECTS[eventId] || []).forEach(sig => signals.push({ ...sig, source: 'event' }));
  if (shock) signals.push({ ...shock, source: 'shock' });
  return signals;
}

function buildMarketForecast(weatherId, pendingEventId) {
  const forecast = [];

  if (weatherId === 'hot' || weatherId === 'warm') {
    forecast.push({ ingredient: 'ice', trend: 'up', text: 'Ice buyers should watch for another tight market tomorrow.' });
  } else if (weatherId === 'rainy') {
    forecast.push({ ingredient: 'ice', trend: 'down', text: 'If the rain sticks around, ice could stay on discount tomorrow.' });
  } else {
    forecast.push({ ingredient: 'lemons', trend: 'flat', text: 'Lemon supply looks steady unless a fresh shock hits overnight.' });
  }

  if (pendingEventId) {
    const event = EVENTS.find(e => e.id === pendingEventId);
    const topSignal = (MARKET_EVENT_EFFECTS[pendingEventId] || [])[0];
    if (event && topSignal) {
      forecast.push({
        ingredient: topSignal.ingredient,
        trend: topSignal.impact >= 0 ? 'up' : 'down',
        text: `${event.title.replace(/^[^\s]+\s*/, '')} may move ${INGREDIENT_INFO[topSignal.ingredient].name.toLowerCase()} prices tomorrow.`,
      });
    }
  }

  if (forecast.length < 2) {
    forecast.push({ ingredient: 'cups', trend: 'flat', text: 'Cup wholesalers are calling tomorrow a mixed, unstable session.' });
  }

  return forecast.slice(0, 2);
}

function refreshMarketPrices() {
  const previous = S.marketPrices ? { ...S.marketPrices } : { ...INGREDIENT_BASE };
  const eventId = S.activeEvent ? S.activeEvent.id : null;
  const shock = pickMarketShock();
  const signals = buildMarketSignals(S.currentWeather, eventId, shock);

  // Seasonal market signals (applied as mild background pressure)
  const seasonSigs = SEASONS[getSeason(S.day)].marketSignals;
  Object.entries(seasonSigs).forEach(([ingredient, impact]) => {
    signals.push({ ingredient, impact: impact * 0.5, source: 'season', reason: `${SEASONS[getSeason(S.day)].label} seasonal pricing.` });
  });

  // New seasonal event market effects
  if (eventId && MARKET_SEASON_EVENT_EFFECTS[eventId]) {
    MARKET_SEASON_EVENT_EFFECTS[eventId].forEach(sig => signals.push({ ...sig, source: 'event' }));
  }
  const nextPrices = {};

  Object.keys(INGREDIENT_BASE).forEach(key => {
    const base = INGREDIENT_BASE[key];
    const volatility = (Math.random() * 0.24) - 0.12;
    const signalImpact = signals
      .filter(sig => sig.ingredient === key)
      .reduce((sum, sig) => sum + sig.impact, 0);
    const multiplier = clampValue(1 + volatility + signalImpact, 0.65, 1.85);
    nextPrices[key] = roundMoney(base * multiplier);
  });

  S.prevMarketPrices = previous;
  S.marketPrices = nextPrices;
  S.marketNews = signals.map(sig => ({
    ingredient: sig.ingredient,
    direction: sig.impact >= 0 ? 'up' : 'down',
    text: sig.reason,
    impact: sig.impact,
  }));
  S.marketForecast = buildMarketForecast(S.currentWeather, S.pendingEvent && S.pendingEvent.id);
}

function upgradeEffects() {
  const u = S.upgrades;
  return {
    lemonMult:       u.juicer      ? 0.75 : 1.0,
    iceMult:         u.iceomatic   ? 0.50 : 1.0,
    iceFridge:       !!u.fridge,
    iceAutoRestore:  u.icemaker    ? 50   : 0,
    extraRep:        u.neon        ? 3    : 0,
    custBonus:       u.neon        ? 0.30 : 0,
    custFlat:        u.soundsystem ? 20   : 0,
    autoDispenser:   u.dispenser   ? 1.15 : 1.0,
    tasteBonus:      0,
    maxRep:          100,
    loyalCustomers:  0,
    franchiseIncome: 0,
    extraPitcherCap: 0,
    fastPour:        !!u.register,
    bigKettle:       false,
    icePersist:      u.fridge ? 999 : 1,
  };
}

function getMaintenanceCost() {
  return 0;
}

function getTradeoffEffects(recipe, tasteScore, price) {
  const standTier = Math.min(3, S.standTier || 0);
  const locKey = S.currentLocation;
  const priceyThresh = LOCATION_PRICEY_THRESH[locKey] || 2.0;
  const premiumPenalty = (getLocationTasteProfile(locKey).premiumPenalty || 0) * standTier;
  const effects = {
    demandMult: 1,
    demandFlat: 0,
    priceSensitivityShift: -premiumPenalty,
    repDeltaBonus: 0,
  };

  if (S.upgrades.neon) {
    const premiumFriendly = price <= priceyThresh + 0.75;
    if (tasteScore >= 0.85 && premiumFriendly) {
      effects.demandMult *= 1.10;
      effects.repDeltaBonus += 1;
    } else if (tasteScore < 0.45 || price > priceyThresh + 1.0) {
      effects.demandMult *= 0.88;
      effects.repDeltaBonus -= 2;
    }
  }

  if (S.upgrades.soundsystem && S.hiredToday && S.hiredToday.musician) {
    effects.demandFlat += 10;
    if (tasteScore >= 0.85) effects.repDeltaBonus += 1;
  }

  if (S.upgrades.canopy && locKey === 'beach' && recipe.icePerCup > 0 && (S.currentWeather === 'hot' || S.currentWeather === 'warm')) {
    effects.demandMult *= 1.10;
  }

  if (S.upgrades.dispenser && S.upgrades.register && tasteScore >= 0.85) {
    effects.demandMult *= 1.04;
  }

  return effects;
}

function getAdEffects() {
  const adsToday = S.adsToday || {};
  let custBonus = 0;
  let repGain = 0;
  const active = [];
  ADS.forEach(ad => {
    if (adsToday[ad.id]) {
      custBonus += ad.custBonus;
      repGain += ad.repGain;
      active.push(ad);
    }
  });
  return { custBonus, repGain, active };
}

function getServingConfig() {
  const u = S.upgrades;
  const hired = S.hiredToday || {};

  let servingTimeMs = 720;
  if (u.register) servingTimeMs = Math.round(servingTimeMs * 0.52);
  if (u.dispenser) servingTimeMs = Math.round(servingTimeMs * 0.48);
  if (hired.lady) servingTimeMs = Math.round(servingTimeMs * 0.68);

  let patienceMs = 2800;
  if (u.soundsystem) patienceMs = Math.round(patienceMs * 1.65);
  if (hired.musician) patienceMs = Math.round(patienceMs * 1.45);

  const standTier = Math.min(3, S.standTier || 0);
  const pitcherCap = STAND_PITCHER_BASE[standTier] + (u.dispenser ? 5 : 0);

  let refillTimeMs = 2600;
  if (u.powerjuicer) refillTimeMs = Math.round(refillTimeMs / 3);
  if (u.dispenser) refillTimeMs = Math.round(refillTimeMs * 0.45);

  const dayDurationMs = (u.dispenser && u.register) ? 90000
    : (u.dispenser || u.register) ? 105000
    : 120000;

  return { servingTimeMs, pitcherCap, refillTimeMs, patienceMs, dayDurationMs };
}

function calcTasteScore(recipe) {
  const eff = upgradeEffects();
  const w = WEATHER.find(item => item.id === S.currentWeather);
  const profile = getLocationTasteProfile(S.currentLocation);
  const idealLemons = IDEAL.lemons + profile.lemons;
  const idealSugar = IDEAL.sugar + profile.sugar;
  let idealIce = IDEAL.ice;

  if (w) {
    if (w.id === 'cloudy') idealIce = 1;
    if (w.id === 'rainy') idealIce = 0;
  }
  idealIce = clampValue(idealIce + profile.ice, 0, 4);

  const dist = Math.sqrt(
    Math.pow(recipe.lemonsPerCup * eff.lemonMult - idealLemons, 2) +
    Math.pow(recipe.sugarPerCup - idealSugar, 2) +
    Math.pow(recipe.icePerCup - idealIce, 2)
  );

  let score = Math.max(0, Math.min(1, 1 - dist / NORM_FACTOR));
  const loc = LOCATIONS[S.currentLocation];

  if (loc && loc.iceBonus && recipe.icePerCup > 0) score = Math.min(1, score + 0.05);
  if (S.upgrades.canopy && recipe.icePerCup > 0) score = Math.min(1, score + 0.05);
  if (S.upgrades.canopy && S.currentLocation === 'beach' && recipe.icePerCup >= 2) score = Math.min(1, score + 0.03);

  // Special ingredient bonuses
  const currentSeason = getSeason(S.day);
  const ri = S.researchedIngredients || {};
  let comboPartnerUsed = {};
  Object.entries(SPECIAL_INGREDIENTS).forEach(([id, ing]) => {
    const perCup = (recipe[id + 'PerCup'] || 0);
    const tier   = ri[id] || 0;
    if (perCup >= 1 && tier >= 1) {
      let bonus = ing.tasteBonus;
      if (ing.bestSeason === currentSeason) bonus *= 1.30;
      if (ing.bestWeather.includes(S.currentWeather)) bonus *= 1.20;
      if (tier >= 2) bonus *= 1.15;
      score = Math.min(1, score + bonus);
      comboPartnerUsed[id] = true;
    }
  });

  // Artisan combo (tier 3): both partners ≥1 per cup
  Object.entries(SPECIAL_INGREDIENTS).forEach(([id, ing]) => {
    if ((ri[id] || 0) >= 3 && comboPartnerUsed[id] && comboPartnerUsed[ing.comboWith]) {
      score = Math.min(1, score + ing.comboBonus);
      if (S.artisanComboUsed === false) S.artisanComboUsed = true;
    }
  });

  return score;
}

function tasteLabel(score) {
  if (score >= 0.85) return { stars: '⭐⭐⭐', label: 'Amazing! 🤩', mult: 1.15 };
  if (score >= 0.45) return { stars: '⭐⭐', label: 'Delicious 😋', mult: 1.0 };
  return { stars: '⭐', label: 'Gross... 🤢', mult: 0.7 };
}

function calcDemand(recipe, price, tasteScore) {
  const loc = LOCATIONS[S.currentLocation];
  const w = WEATHER.find(item => item.id === S.currentWeather);
  const eff = upgradeEffects();
  const tradeoff = getTradeoffEffects(recipe, tasteScore, price);
  let baseCust = loc.customers;

  if (S.activeEvent) {
    if (S.activeEvent.id === 'festival' && S.currentLocation === 'festival') baseCust *= 3;
    if (S.activeEvent.id === 'backtoschool' && S.currentLocation === 'park') baseCust += 20;
  }

  baseCust = Math.round(baseCust * (1 + eff.custBonus));
  baseCust += eff.custFlat;
  baseCust += STAND_CUST_BONUS[Math.min(3, S.standTier || 0)];
  if (S.upgrades.canopy && (S.currentWeather === 'hot' || S.currentWeather === 'warm')) {
    baseCust = Math.round(baseCust * 1.20);
  }
  if (S.hiredToday && S.hiredToday.clown) baseCust += 8;
  baseCust += getAdEffects().custBonus;
  baseCust += tradeoff.demandFlat;

  // Customer personality modifier
  const ctype = CUSTOMER_TYPES[S.customerPersonality || 'regular'];
  baseCust = Math.round(baseCust * (ctype ? ctype.demandMult : 1));

  let priceSensitivity = Math.max(0.04, 1 - ((price - 0.50) / 9.5) * 0.95);
  // Personality shifts price threshold tolerance
  if (ctype && ctype.priceThresholdMult !== 1) {
    const threshShift = (ctype.priceThresholdMult - 1) * 0.15;
    priceSensitivity = clampValue(priceSensitivity + threshShift, 0.04, 1.30);
  }
  priceSensitivity = clampValue(priceSensitivity + tradeoff.priceSensitivityShift, 0.05, 1.25);

  const locRep = (S.locationRep && S.locationRep[S.currentLocation] !== undefined)
    ? S.locationRep[S.currentLocation]
    : S.reputation;
  const repBonus = 1 + (locRep / 260);
  const tasteBonus = tasteLabel(tasteScore).mult;
  const weatherMult = w ? w.mult : 1.0;

  // Seasonal event customer bonuses
  if (S.activeEvent) {
    if (S.activeEvent.id === 'cherryblossom' && S.currentLocation === 'park') baseCust += 25;
    if (S.activeEvent.id === 'beachvolleyball' && S.currentLocation === 'beach') baseCust += 30;
    if (S.activeEvent.id === 'harvestfair' && S.currentLocation === 'market') baseCust += 20;
    if (S.activeEvent.id === 'wintermarket' && (S.currentLocation === 'sidewalk' || S.currentLocation === 'park')) baseCust += 20;
  }

  const raw = baseCust * weatherMult * priceSensitivity * repBonus * tasteBonus * tradeoff.demandMult * 0.92;

  return Math.max(0, Math.round(raw * eff.autoDispenser));
}

function calcIngredientCost(recipe, cups) {
  const c = (cups !== undefined) ? cups : recipe.cupsToMake;
  const eff = upgradeEffects();
  const p = S.marketPrices;
  let raw = c * (
    recipe.lemonsPerCup * eff.lemonMult * p.lemons +
    recipe.sugarPerCup * p.sugar +
    recipe.icePerCup * eff.iceMult * p.ice +
    p.cups
  );
  // Special ingredient costs
  const ri = S.researchedIngredients || {};
  Object.entries(SPECIAL_INGREDIENTS).forEach(([id, ing]) => {
    const perCup = recipe[id + 'PerCup'] || 0;
    if (perCup > 0) {
      const discount = (ri[id] || 0) >= 2 ? 0.85 : 1.0;
      raw += c * perCup * ing.marketPrice * discount;
    }
  });
  return roundMoney(raw);
}

function calcRepDelta(tasteScore, cupsSold, cupsToMake) {
  const eff = upgradeEffects();
  const tradeoff = getTradeoffEffects(S.recipe, tasteScore, S.price);
  let delta = 0;

  if (tasteScore >= 0.85) delta += 5;
  else if (tasteScore >= 0.45) delta += 1;
  else delta -= 5;

  if (cupsSold >= cupsToMake) delta += 2;
  else if (cupsToMake > 0 && (cupsToMake - cupsSold) / cupsToMake > 0.3) delta -= 1;

  delta += eff.extraRep + tradeoff.repDeltaBonus;
  return delta;
}

function simulateSelling() {
  const { recipe, price } = S;
  const tasteScore = calcTasteScore(recipe);
  const demand = calcDemand(recipe, price, tasteScore);
  const cupsSold = Math.min(demand, recipe.cupsToMake);
  const revenue = cupsSold * price;
  const cost = calcIngredientCost(recipe, cupsSold);
  const rent = LOCATIONS[S.currentLocation]?.rent || 0;
  const maintenance = 0;
  const profit = revenue - cost - rent;
  const repDelta = calcRepDelta(tasteScore, cupsSold, recipe.cupsToMake);
  return { tasteScore, demand, cupsSold, revenue, cost, rent, maintenance, profit, repDelta };
}

function applyDayResults(result) {
  const { recipe } = S;
  const eff = upgradeEffects();
  const served = result.cupsSold;

  S.inventory.lemons = Math.max(0, S.inventory.lemons - served * recipe.lemonsPerCup * eff.lemonMult);
  S.inventory.sugar = Math.max(0, S.inventory.sugar - served * recipe.sugarPerCup);
  S.inventory.ice = Math.max(0, S.inventory.ice - served * recipe.icePerCup * eff.iceMult);
  S.inventory.cups = Math.max(0, S.inventory.cups - served);
  S.inventory.lemons = roundMoney(S.inventory.lemons);
  S.inventory.ice = roundMoney(S.inventory.ice);

  const bonus = eff.franchiseIncome;

  S.coins += result.revenue - result.rent + bonus;
  S.totalProfit += result.profit;
  if (result.profit > S.bestDay) S.bestDay = result.profit;
  S.allTimeCustomers += result.cupsSold;

  const adRepGain = getAdEffects().repGain;
  S.reputation = Math.max(0, Math.min(eff.maxRep, S.reputation + result.repDelta + adRepGain));
  if (!S.locationRep) S.locationRep = { sidewalk: 50, park: 50, beach: 50, market: 50, festival: 50 };
  S.locationRep[S.currentLocation] = Math.max(0, Math.min(eff.maxRep,
    (S.locationRep[S.currentLocation] || 50) + result.repDelta + adRepGain));

  S.last7DaysProfits.push(roundMoney(result.profit));
  if (S.last7DaysProfits.length > 7) S.last7DaysProfits.shift();

  S.locationHistory.push(S.currentLocation);
  if (S.locationHistory.length > 7) S.locationHistory.shift();

  // Deduct special ingredient inventory
  if (!S.specialInventory) S.specialInventory = { mint:0, strawberry:0, applecinnamon:0, honey:0 };
  Object.keys(SPECIAL_INGREDIENTS).forEach(id => {
    const perCup = recipe[id + 'PerCup'] || 0;
    if (perCup > 0) {
      S.specialInventory[id] = Math.max(0, roundMoney(S.specialInventory[id] - served * perCup));
    }
  });

  if (result.cupsSold >= recipe.cupsToMake) S.soldOutCount++;
  if (result.tasteScore >= 0.95) S.consecutiveLegendary++;
  else S.consecutiveLegendary = 0;

  // Track seasonal profit for achievement
  if (result.profit > 0) {
    if (!S.seasonsProfit) S.seasonsProfit = { spring:false, summer:false, fall:false, winter:false };
    S.seasonsProfit[getSeason(S.day)] = true;
  }

  S.franchiseIncome = bonus;
  S.dayResult = result;

  checkAchievements(result);
}

function advanceDay() {
  const prevDay    = S.day;
  const prevSeason = getSeason(prevDay);
  const prevYear   = getYear(prevDay);

  S.day++;
  S.phase = 'day';
  S.marketSpentToday = 0;
  S.hiredToday = {};
  S.adsToday = {};
  S.artisanComboUsed = false;

  const newSeason = getSeason(S.day);
  const newYear   = getYear(S.day);

  // Update season + year cache
  S.season = newSeason;
  S.year   = newYear;

  // Ice melt overnight
  const eff = upgradeEffects();
  if (eff.iceFridge) {
    S.iceMeltedYesterday = 0;
  } else {
    S.iceMeltedYesterday = S.inventory.ice;
    S.inventory.ice = 0;
  }
  if (eff.iceAutoRestore > 0) {
    S.inventory.ice += eff.iceAutoRestore;
    S.iceMeltedYesterday = Math.max(0, S.iceMeltedYesterday - eff.iceAutoRestore);
  }

  // Event lifecycle
  if (S.activeEvent) {
    S.activeEventDays--;
    if (S.activeEventDays <= 0) {
      S.activeEvent = null;
      if (S.currentLocation === 'festival') S.currentLocation = 'sidewalk';
    }
  }

  if (S.pendingEvent) {
    S.activeEvent = S.pendingEvent;
    S.activeEventDays = S.pendingEvent.duration;
    S.pendingEvent = null;
    if (S.activeEvent.id === 'festival') {
      S.unlockedLocations = [...new Set([...S.unlockedLocations, 'festival'])];
    }
  }

  // Pick event from seasonal pool (10% chance)
  if (!S.activeEvent && !S.pendingEvent && Math.random() < 0.12) {
    const seasonEvents = SEASONS[newSeason].eventIds
      .map(id => EVENTS.find(e => e.id === id))
      .filter(Boolean);
    if (seasonEvents.length) {
      S.pendingEvent = seasonEvents[Math.floor(Math.random() * seasonEvents.length)];
    }
  }

  // Customer personality: season-driven, high rep nudges toward 'regular'
  S.customerPersonality = SEASONS[newSeason].customerType;
  if ((S.reputation || 0) > 75 && Math.random() < 0.3) S.customerPersonality = 'regular';

  // Season transition announcement
  if (newSeason !== prevSeason) {
    setTimeout(() => showSeasonToast(newSeason, newYear), 600);
  }

  // Year tick
  if (newYear > prevYear) {
    setTimeout(() => showAchievementToast({ name: `Year ${newYear} begins!`, emoji: '📆', desc: 'Your lemonade empire grows stronger.' }), 2000);
  }

  S.currentWeather = pickWeather();

  // 3-day weather forecast
  S.weatherForecast = [
    pickWeatherForDay(S.day + 1),
    pickWeatherForDay(S.day + 2),
    pickWeatherForDay(S.day + 3),
  ];

  refreshMarketPrices();
  saveState();
}

function checkAchievements(result) {
  const newOnes = [];
  const rx = result.rx || {};
  const allStaff = Object.keys(S.hiredToday || {}).length >= 3 ||
    ['lady', 'clown', 'musician'].every(k => S.upgrades[k]);
  const checks = [
    { id: 'first_sale', cond: result.cupsSold > 0 },
    { id: 'first_amazing', cond: result.tasteScore >= 0.85 },
    { id: 'sold_out', cond: S.soldOutCount >= 5 },
    { id: 'weatherproof', cond: S.currentWeather === 'rainy' && result.profit > 0 },
    { id: 'sweet_spot', cond: S.consecutiveLegendary >= 3 },
    { id: 'festival_king', cond: S.currentLocation === 'festival' && result.cupsSold > 0 },
    { id: 'beach_bod', cond: S.currentLocation === 'beach' && result.cupsSold >= 50 },
    { id: 'price_master', cond: result.profit >= 20 },
    { id: 'century', cond: result.cupsSold >= 100 },
    { id: 'heat_wave_king', cond: S.currentWeather === 'hot' && S.recipe.icePerCup >= 3 && result.profit > 0 },
    { id: 'first_upgrade', cond: Object.keys(S.upgrades).length >= 1 },
    { id: 'full_staff', cond: allStaff },
    { id: 'millionaire', cond: S.totalProfit >= 1000 },
    { id: 'week_survivor', cond: S.day >= 7 },
    { id: 'month_survivor', cond: S.day >= 30 },
    { id: 'empire_builder', cond: (S.standTier || 0) >= 3 },
    { id: 'grossophobe', cond: result.cupsSold >= 5 && (rx.gross || 0) === 0 },
    { id: 'reputation_max', cond: S.reputation >= 95 },
    { id: 'season_master', cond: S.seasonsProfit && Object.values(S.seasonsProfit).every(Boolean) },
    { id: 'artisan', cond: S.artisanComboUsed && result.tasteScore >= 0.85 },
    { id: 'year_two', cond: S.day >= 60 },
  ];

  checks.forEach(({ id, cond }) => {
    if (cond && !S.achievements[id]) {
      S.achievements[id] = true;
      newOnes.push(ACHIEVEMENTS_DEF.find(a => a.id === id));
    }
  });

  if (newOnes.length) {
    SFX.achievement();
    newOnes.forEach((a, i) => setTimeout(() => showAchievementToast(a), i * 2200));
  }
}


