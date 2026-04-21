'use strict';

// F. UI UTILITIES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function fmt(n) { return '$' + Math.abs(n).toFixed(2); }
function fmtSigned(n) { return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2); }

function updateTopBar() {
  const el = document.getElementById('coin-count');
  const oldVal = parseFloat(el.textContent.replace(/[^0-9.-]/g,'')) || 0;
  el.textContent = fmt(S.coins);
  el.className = S.coins < 0 ? 'negative' : '';
  document.getElementById('day-label').textContent = 'Day ' + S.day;
  document.getElementById('modal-day-info').textContent = S.day;
  if (Math.abs(S.coins - oldVal) > 0.001) {
    el.classList.add('coin-pop');
    el.addEventListener('animationend', () => el.classList.remove('coin-pop'), { once: true });
  }
}

function animateCoinCounter(from, to, duration=800) {
  const el = document.getElementById('coin-count');
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const val = from + (to - from) * ease;
    el.textContent = fmt(val);
    el.className = val < 0 ? 'negative' : '';
    if (t < 1) requestAnimationFrame(step);
    else { el.textContent = fmt(to); el.className = to < 0 ? 'negative' : ''; }
  }
  requestAnimationFrame(step);
  el.classList.add('coin-pop');
  el.addEventListener('animationend', () => el.classList.remove('coin-pop'), { once: true });
}

let _achievementTimeout = null;
function showAchievementToast(a) {
  const el = document.getElementById('achievement-toast');
  el.textContent = `${a.emoji} Achievement Unlocked: ${a.name}!`;
  el.classList.add('toast-show');
  clearTimeout(_achievementTimeout);
  _achievementTimeout = setTimeout(() => el.classList.remove('toast-show'), 3500);
}

let _errorTimeout = null;
function showErrorToast(msg, dur) {
  const el = document.getElementById('error-toast');
  el.textContent = msg;
  el.classList.add('toast-show');
  clearTimeout(_errorTimeout);
  _errorTimeout = setTimeout(() => el.classList.remove('toast-show'), dur || 2500);
}

// â”€â”€ SELLING UI UTILITIES â”€â”€

function updateSellInfoBar() {
  const w   = WEATHER.find(x => x.id === S.currentWeather) || WEATHER[0];
  const eff = upgradeEffects();
  document.getElementById('sell-weather-chip').textContent = `${w.emoji} ${w.label.replace(/^[^\s]+\s/, '')}`;
  document.getElementById('sell-rep-chip').textContent     = `⭐ ${S.reputation} rep`;
  document.getElementById('sell-stock-chip').textContent   = `🥤 ${S.recipe.cupsToMake} cups`;
}

function startDayProgressBar(durationMs) {
  const fill = document.getElementById('day-progress-fill');
  if (!fill) return;
  fill.style.transition = 'none';
  fill.style.width = '100%';
  fill.offsetWidth; // force reflow
  fill.style.transition = `width ${durationMs}ms linear`;
  fill.style.width = '0%';
}

function setDaySpeed(newMult) {
  if (!_activeSS || _activeSS.dayOver) return;
  const ss = _activeSS;

  // Accumulate elapsed game-time up to this moment
  const wallSinceChange = Date.now() - ss._dayStartWall;
  ss._dayElapsedGame += wallSinceChange * ss._speedMult;
  ss._dayStartWall = Date.now();
  ss._speedMult = newMult;
  _speedMult = newMult;

  // Reschedule day-end timer
  clearTimeout(ss._dayTimer);
  const gameRemaining = ss._dayDurationMs - ss._dayElapsedGame;
  const wallRemaining = Math.max(200, gameRemaining / newMult);
  ss._dayTimer = setTimeout(() => _endSellingDay(ss), wallRemaining);

  // Restart progress bar from current fill %
  const fill = document.getElementById('day-progress-fill');
  if (fill) {
    const pct = Math.max(0, (1 - ss._dayElapsedGame / ss._dayDurationMs) * 100);
    fill.style.transition = 'none';
    fill.style.width = pct + '%';
    fill.offsetWidth; // reflow
    fill.style.transition = `width ${wallRemaining}ms linear`;
    fill.style.width = '0%';
  }

  // Speed up existing walking customers — recalculate their remaining CSS transition
  const container = document.getElementById('scene-customers');
  if (container) {
    container.querySelectorAll('.walking-customer.is-walking').forEach(walkerEl => {
      const curLeft = parseFloat(getComputedStyle(walkerEl).left) || 0;
      const destLeft = parseFloat(walkerEl.style.left) || 0;
      const distRemaining = Math.abs(destLeft - curLeft);
      const newWalkMs = Math.round(distRemaining / 140 * 1000 / newMult);
      walkerEl.style.transition = 'none';
      walkerEl.style.left = curLeft + 'px';
      walkerEl.offsetWidth; // reflow
      walkerEl.style.transition = `left ${newWalkMs}ms linear`;
      walkerEl.style.left = destLeft + 'px';
    });
  }

  // Update button label
  const btn = document.getElementById('speed-btn');
  if (btn) {
    btn.textContent = newMult === 4 ? '⚡ 4×' : '▶ 1×';
    btn.classList.toggle('fast', newMult === 4);
  }
}

function updatePitcherUI(ss, cfg) {
  const pct    = cfg.pitcherCap > 0 ? Math.max(0, (ss.pitcherRemaining / cfg.pitcherCap) * 100) : 0;
  const fill   = document.getElementById('pitcher-fill');
  const status = document.getElementById('pitcher-status');
  if (fill) {
    fill.style.width = pct + '%';
    fill.style.background = ss.isRefilling
      ? 'linear-gradient(90deg,#FF9800,#FFB74D)'
      : ss.pitcherRemaining === 0
        ? '#F44336'
        : 'linear-gradient(90deg,#42A5F5,#90CAF9)';
  }
  if (status) {
    status.textContent = ss.isRefilling
      ? '🔄 Refilling...'
      : ss.pitcherRemaining === 0
        ? '⚠️ Empty!'
        : `${ss.pitcherRemaining} / ${cfg.pitcherCap}`;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// G. SCREEN RENDERERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const scr = document.getElementById('screen-' + id);
  if (scr) scr.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === id);
  });
  // Scroll to top
  const container = document.getElementById('screen-container');
  container.scrollTop = 0;
  // Dim (but keep visible) nav during selling so it fills the space
  document.getElementById('bottom-nav').classList.toggle('selling-mode', id === 'selling');
  const renderers = {
    day: renderDay,
    market: renderMarket,
    shop: renderShop,
    stats: renderStats,
    achievements: renderAchievements,
    result: () => renderResult(S.dayResult),
  };
  if (renderers[id]) renderers[id]();
}

// â”€â”€ DAY SCREEN â”€â”€
function renderDay() {
  setupDayScene();
  renderDayHud();
  renderRecipeSliders();
  renderPriceSlider();
  renderLocationPicker();
  // Notify about overnight ice melt
  if (S.iceMeltedYesterday > 0) {
    const eff = upgradeEffects();
    const tip = eff.iceFridge ? '' : eff.iceAutoRestore > 0
      ? ` (Ice Maker restored ${eff.iceAutoRestore})`
      : ' — Buy Mr. Fridge $250 to prevent this!';
    showErrorToast(`🧊 All ${S.iceMeltedYesterday} ice melted overnight${tip}`, 3500);
    S.iceMeltedYesterday = 0;
  }
}

function renderDayHud() {
  // Weather pill — animate slide-in each time day screen opens
  const w = WEATHER.find(x => x.id === S.currentWeather) || WEATHER[0];
  const pctChange = Math.round((w.mult - 1) * 100);
  const wpill = document.getElementById('day-weather-pill');
  wpill.textContent = `${w.emoji} ${w.label.replace(/^[^\s]+\s/, '')} · ${pctChange >= 0 ? '+' : ''}${pctChange}%`;
  wpill.classList.remove('weather-badge-new');
  void wpill.offsetWidth;
  wpill.classList.add('weather-badge-new');

  // Event pill
  const evPill = document.getElementById('day-event-pill');
  if (S.activeEvent) {
    evPill.textContent = S.activeEvent.title + ' (' + S.activeEventDays + 'd)';
    evPill.classList.add('show');
  } else if (S.pendingEvent) {
    evPill.textContent = '📢 Tomorrow: ' + S.pendingEvent.title.replace(/^[^\s]+\s/, '');
    evPill.classList.add('show');
  } else {
    evPill.classList.remove('show');
  }

  // Reputation bar
  const eff = upgradeEffects();
  const pct = Math.min(100, (S.reputation / eff.maxRep) * 100);
  document.getElementById('day-rep-fill').style.width = pct + '%';
  document.getElementById('day-rep-val').textContent = S.reputation + '/' + eff.maxRep;

  // Inventory chips
  const strip = document.getElementById('day-inv-strip');
  const melt = S.iceMeltedYesterday || 0;
  strip.innerHTML = [
    { key:'lemons', e:'🍋' }, { key:'sugar', e:'🍬' },
    { key:'cups',   e:'🥤' }, { key:'ice',   e:'🧊' },
  ].map(({ key, e }) => {
    const qty = S.inventory[key];
    const low = qty === 0;
    const meltTag = (key === 'ice' && melt > 0) ? ` <span style="color:#EF9A9A;font-size:0.6rem">-${melt}🌡️</span>` : '';
    return `<div class="day-inv-chip" style="${low ? 'background:rgba(229,57,53,0.25);' : ''}">
      ${e} <span class="chip-qty" style="${low ? 'color:#FF8A80;' : ''}">${qty}</span>${meltTag}
    </div>`;
  }).join('');

  // Price tag on stand
  const ptag = document.getElementById('day-ptag');
  if (ptag) ptag.textContent = fmt(S.price);
}

function calcCostPerCup(recipe) {
  const eff = upgradeEffects();
  const p   = S.marketPrices;
  return (recipe.lemonsPerCup * eff.lemonMult * p.lemons)
       + (recipe.sugarPerCup  * p.sugar)
       + (recipe.icePerCup    * eff.iceMult * p.ice)
       + (p.cups);
}

function updateCostPerCup() {
  const el = document.getElementById('cost-per-cup-val');
  if (!el) return;
  const c = calcCostPerCup(S.recipe);
  el.textContent = fmt(c) + ' / cup';
  // Colour hint: red if cost > sell price, green if profitable
  el.style.color = c >= S.price ? 'var(--red)' : 'var(--green-dark)';

}

function renderRecipeSliders() {
  const r = S.recipe;
  const svLemons = document.getElementById('sv-lemons');
  const svSugar  = document.getElementById('sv-sugar');
  const svIce    = document.getElementById('sv-ice');
  if (svLemons) svLemons.textContent = r.lemonsPerCup;
  if (svSugar)  svSugar.textContent  = r.sugarPerCup;
  if (svIce)    svIce.textContent    = r.icePerCup;
  updateCostPerCup();
}

function renderPriceSlider() {
  document.getElementById('sl-price').value = S.price;
  document.getElementById('price-val').textContent = fmt(S.price);
  const costPc = calcCostPerCup(S.recipe);
  const margin = S.price - costPc;
  document.getElementById('price-hint').textContent = '';
}

function renderLocationPicker() {
  const grid = document.getElementById('location-grid');
  const festivalAvail = S.activeEvent && S.activeEvent.id === 'festival';
  grid.innerHTML = Object.entries(LOCATIONS).map(([key, loc]) => {
    const isEvent  = loc.eventOnly && !festivalAvail;
    const disabled = isEvent;
    const selected = S.currentLocation === key;
    const infoText = loc.eventOnly
      ? (festivalAvail ? '🎪 Active today!' : '🔒 Event only')
      : (loc.rent > 0 ? `${loc.customers} customers · $${loc.rent} rent` : `${loc.customers} customers · Free`);
    return `<button class="loc-btn ${selected ? 'selected' : ''} ${disabled ? 'locked' : ''}"
      data-loc="${key}" ${disabled ? 'disabled' : ''}>
      <span class="loc-emoji">${loc.emoji}</span>
      <span class="loc-name">${loc.name}</span>
      <span class="loc-info">${infoText}</span>
    </button>`;
  }).join('');
}


// â”€â”€ MARKET SCREEN â”€â”€
// Per-ingredient qty trackers (persist while screen is open)
// Speed system
let _speedMult = 1;
let _activeSS  = null;

function renderMarket() {
  document.getElementById('ms-budget').textContent = fmt(S.coins);
  document.getElementById('ms-spent').textContent = fmt(S.marketSpentToday);
  document.getElementById('ms-remaining').textContent = fmt(Math.max(0, S.coins));


  const invGrid = document.getElementById('market-inv-grid');
  invGrid.innerHTML = ['lemons', 'sugar', 'cups', 'ice'].map(key => {
    const info = INGREDIENT_INFO[key];
    return `<div class="inv-item">
      <span class="inv-emoji">${info.emoji}</span>
      <span class="inv-name">${info.name}</span>
      <span class="inv-qty">${S.inventory[key]}</span>
    </div>`;
  }).join('');

  const list = document.getElementById('market-items-list');
  list.innerHTML = ['lemons', 'sugar', 'cups', 'ice'].map(key => {
    const info = INGREDIENT_INFO[key];
    const price = S.marketPrices[key];
    const prev = (S.prevMarketPrices && S.prevMarketPrices[key] !== undefined) ? S.prevMarketPrices[key] : INGREDIENT_BASE[key];
    const delta = roundMoney(price - prev);
    const deltaHtml = delta === 0
      ? '<span class="price-change"> - flat</span>'
      : `<span class="price-change ${delta > 0 ? 'up' : 'down'}"> ${delta > 0 ? '+' : ''}${fmt(delta)}</span>`;
    const bundles = MARKET_BUNDLES[key];
    const bundleHtml = bundles.map(b => {
      const dynamicCost = getBundleCost(key, b.qty);
      const perUnit = dynamicCost / b.qty;
      const perUnitFmt = perUnit < 0.01 ? ('$' + perUnit.toFixed(3)) : fmt(perUnit);
      const canAfford = dynamicCost <= S.coins + 0.001;
      return `<button class="mi-bundle-btn${canAfford ? '' : ' cannot-afford'}"
          data-buy="${key}" data-qty="${b.qty}" data-cost="${dynamicCost}"
          ${canAfford ? '' : 'disabled'}>
        <span class="bun-label">${b.label}</span>
        <span class="bun-qty">x${b.qty}</span>
        <span class="bun-cost">${fmt(dynamicCost)}</span>
        <span class="bun-save">${b.save ? b.save : perUnitFmt + '/ea'}</span>
      </button>`;
    }).join('');
    return `<div class="market-item-card">
      <span class="mi-emoji">${info.emoji}</span>
      <div class="mi-info">
        <div class="mi-name">${info.name}</div>
        <div class="mi-price">${fmt(price)} / ${info.unit}${deltaHtml}</div>
        <div class="mi-stock">In stock: ${S.inventory[key]}</div>
      </div>
      <div class="mi-bundles">${bundleHtml}</div>
    </div>`;
  }).join('');
}

function buyIngredient(key, qty, fixedCost) {
  if (isNaN(qty) || qty < 1) { showErrorToast('Set quantity to at least 1'); return; }
  const totalCost = (fixedCost !== undefined) ? fixedCost : S.marketPrices[key] * qty;
  if (totalCost > S.coins + 0.001) {
    showErrorToast(`Not enough coins! Need ${fmt(totalCost)}`);
    return;
  }
  SFX.buy();
  const coinsBefore = S.coins;
  S.coins -= totalCost;
  S.coins = Math.round(S.coins * 100) / 100;
  S.inventory[key] += qty;
  S.marketSpentToday += totalCost;
  saveState();
  animateCoinCounter(coinsBefore, S.coins, 400);
  renderMarket();
}
// â”€â”€ SHOP SCREEN â”€â”€
let _shopTab = 'tools'; // active tab: 'tools' | 'ads' | 'staff' | 'stand'

function renderShop() {
  // (shop-coins banner removed — coins shown in top bar)

  // Sync tab bar active state
  document.querySelectorAll('.shop-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _shopTab);
  });

  let html = '';

  if (_shopTab === 'ads') {
    // â”€â”€ Advertising section
    const adsToday = S.adsToday || {};
    const adEff = getAdEffects();
    const totalAdBonus = adEff.custBonus > 0
      ? `+${adEff.custBonus} customers, +${adEff.repGain} rep today`
      : 'No ads running today';
    html += `<div class="employee-section-header" style="background:linear-gradient(135deg,#1565C0,#0D47A1)">📣 Advertise Today — <span style="font-size:0.75rem;opacity:0.85">${totalAdBonus}</span></div>`;
    ADS.forEach(ad => {
      const isActive = !!adsToday[ad.id];
      const canRun   = !isActive && S.coins >= ad.cost;
      html += `<div class="employee-card ${isActive?'hired':''}">
        <span class="emp-emoji">${ad.emoji}</span>
        <div class="emp-info">
          <div class="emp-name">${ad.name}</div>
          <div class="emp-desc">${ad.desc} <strong style="color:#90CAF9">${fmt(ad.cost)}/day</strong></div>
        </div>
        ${isActive
          ? '<span class="emp-hired-badge">✅ Running</span>'
          : `<button class="emp-hire-btn" data-ad="${ad.id}" ${canRun?'':'disabled'}>${canRun?'Run '+fmt(ad.cost):'Need '+fmt(ad.cost)}</button>`
        }
      </div>`;
    });

  } else if (_shopTab === 'staff') {
    // â”€â”€ Employee hire section
    const hired = S.hiredToday || {};
    html += `<div class="employee-section-header">👷 Hire Staff — Today Only</div>`;
    EMPLOYEES.forEach(emp => {
      const isHired = !!hired[emp.id];
      const canHire = !isHired && S.coins >= emp.cost;
      html += `<div class="employee-card ${isHired?'hired':''}">
        <span class="emp-emoji">${emp.emoji}</span>
        <div class="emp-info">
          <div class="emp-name">${emp.name}</div>
          <div class="emp-desc">${emp.desc} <strong style="color:var(--green-dark)">${fmt(emp.cost)}/day</strong></div>
        </div>
        ${isHired
          ? '<span class="emp-hired-badge">✅ Hired</span>'
          : `<button class="emp-hire-btn" data-hire="${emp.id}" ${canHire?'':'disabled'}>${canHire?'Hire '+fmt(emp.cost):'Need '+fmt(emp.cost)}</button>`
        }
      </div>`;
    });

  } else if (_shopTab === 'stand') {
    // â”€â”€ Stand upgrade tiers (matching Lemonade Tycoon GameHouse)
    const curTier = S.standTier || 0;
    const tierNames  = ['Default Stand', 'Classic Stand', 'Lemon Stand', 'Castle Stand'];
    const tierEmojis = ['🪣', '🏪', '🍋', '🏰'];
    const tierDescs  = [
      'Your starting stand — hand-made but full of heart! Pitcher holds 5 cups.',
      'A classic look for a guaranteed hit! Pitcher holds 8 cups, more storage.',
      'The ultimate stand on the market! Pitcher holds 12 cups, huge storage.',
      'Tourists travel just to see it! Pitcher holds 20 cups, max storage.',
    ];

    // Show current tier
    const pitcherNow = STAND_PITCHER_BASE[Math.min(3, curTier)];
    html += `<div class="stand-tier-card current">
      <span class="stand-tier-emoji">${tierEmojis[curTier]}</span>
      <div class="stand-tier-name">Current: ${tierNames[curTier]}</div>
      <div class="stand-tier-desc">${tierDescs[curTier]}</div>
      <div class="stand-tier-bonus">Pitcher: ${pitcherNow} cups${curTier > 0 ? ` · +${STAND_CUST_BONUS[curTier]} base customers` : ''}</div>
    </div>`;

    // Show upgrade path
    html += `<div class="tier-header" style="margin-top:4px">⬆️ Upgrade Path</div>`;
    STAND_UPGRADES.forEach((su, i) => {
      const thisTier = i + 1;
      const isOwned  = curTier >= thisTier;
      const isNext   = curTier === thisTier - 1;
      const canBuy   = isNext && S.coins >= su.cost;
      html += `<div class="stand-tier-card ${isOwned?'owned':''} ${isNext&&!isOwned?'next':''} ${!isOwned&&!isNext?'locked':''}">
        <span class="stand-tier-emoji">${su.emoji}</span>
        <div class="stand-tier-name">${su.name}</div>
        <div class="stand-tier-desc">${su.desc}</div>
        <div class="stand-tier-bonus">+${su.custBonus} base customers</div>
        ${isOwned
          ? '<div style="margin-top:8px;font-family:var(--font);color:var(--green-dark);font-size:0.9rem">✅ Owned</div>'
          : `<button class="stand-upgrade-btn" data-stand="${su.id}" data-standtier="${thisTier}" ${canBuy?'':'disabled'}>${canBuy ? '⬆️ Upgrade — '+fmt(su.cost) : isNext ? 'Need '+fmt(su.cost) : '🔒 Unlock previous first'}</button>`
        }
      </div>`;
    });

  } else {
    // Tools tab - Lemonade Tycoon equipment in order
    UPGRADES.forEach(u => {
      const owned  = !!S.upgrades[u.id];
      const canBuy = !owned && S.coins >= u.cost;
      html += `<div class="upgrade-card ${owned ? 'owned' : ''}">
        <span class="ug-emoji">${u.emoji}</span>
        <div class="ug-info">
          <div class="ug-name">${u.name}</div>
          <div class="ug-desc">${u.desc}</div>
          <div style="font-size:0.7rem;color:var(--orange);margin-top:3px;font-weight:700">${fmt(u.cost)}</div>
        </div>
        ${owned
          ? '<span class="ug-owned-badge">✅ Owned</span>'
          : `<button class="ug-buy-btn" data-upgrade="${u.id}" ${canBuy?'':'disabled'}>${canBuy ? 'Buy' : 'Need '+fmt(u.cost)}</button>`
        }
      </div>`;
    });
  }

  document.getElementById('shop-upgrades').innerHTML = html;
}

function purchaseUpgrade(id) {
  const u = UPGRADES.find(u=>u.id===id);
  if (!u || S.upgrades[id]) return;
  const coinsBefore = S.coins;
  S.coins -= u.cost;
  S.upgrades[id] = true;
  animateCoinCounter(coinsBefore, S.coins, 400);
  if (id === 'icemaker') showAchievementToast({ emoji:'🏭', name:'Auto Ice Maker Online!' });
  saveState();
  renderShop();
  updateTopBar();
  // Refresh day-screen stand preview so new equipment appears immediately
  const dayStand = document.getElementById('day-stand');
  if (dayStand) dayStand.innerHTML = buildStandSVG();
}

function purchaseStandUpgrade(id, tier) {
  const su = STAND_UPGRADES.find(s => s.id === id);
  if (!su) return;
  const curTier = S.standTier || 0;
  if (curTier >= tier) { showErrorToast('Already at this tier!'); return; }
  if (curTier < tier - 1) { showErrorToast('Unlock previous tier first!'); return; }
  if (S.coins < su.cost) { showErrorToast('Not enough coins!'); return; }
  const coinsBefore = S.coins;
  S.coins -= su.cost;
  S.standTier = tier;
  SFX.unlock();
  animateCoinCounter(coinsBefore, S.coins, 400);
  showAchievementToast({ emoji: su.emoji, name: su.name + ' Unlocked!' });
  saveState();
  renderShop();
  updateTopBar();
}

function hireEmployee(id) {
  const emp = EMPLOYEES.find(e=>e.id===id);
  if (!emp) return;
  if (!S.hiredToday) S.hiredToday = {};
  if (S.hiredToday[id]) return; // already hired
  if (S.coins < emp.cost) { showErrorToast(`Need ${fmt(emp.cost)} to hire!`); return; }
  const coinsBefore = S.coins;
  S.coins -= emp.cost;
  S.hiredToday[id] = true;
  SFX.hire();
  animateCoinCounter(coinsBefore, S.coins, 400);
  saveState();
  renderShop();
  updateTopBar();
}

function hireDailyAd(id) {
  const ad = ADS.find(a => a.id === id);
  if (!ad) return;
  if (!S.adsToday) S.adsToday = {};
  if (S.adsToday[id]) return;
  if (S.coins < ad.cost) { showErrorToast(`Need ${fmt(ad.cost)} to run this ad today!`); return; }
  const coinsBefore = S.coins;
  S.coins -= ad.cost;
  S.adsToday[id] = true;
  SFX.coin();
  animateCoinCounter(coinsBefore, S.coins, 400);
  saveState();
  renderShop();
  updateTopBar();
}

// â”€â”€ STATS SCREEN â”€â”€
function renderStats() {
  const statsData = [
    { emoji:'📅', val: S.day,          lbl: 'Days Played' },
    { emoji:'💰', val: fmt(S.totalProfit), lbl: 'Total Profit' },
    { emoji:'🏆', val: fmt(S.bestDay), lbl: 'Best Day' },
    { emoji:'⭐', val: S.reputation,   lbl: 'Reputation' },
    { emoji:'👥', val: S.allTimeCustomers, lbl: 'Customers Served' },
    { emoji:'🎉', val: S.soldOutCount, lbl: 'Sell-Outs' },
  ];
  document.getElementById('stats-grid').innerHTML = statsData.map(s => `
    <div class="stat-card">
      <span class="stat-emoji">${s.emoji}</span>
      <span class="stat-val">${s.val}</span>
      <span class="stat-lbl">${s.lbl}</span>
    </div>
  `).join('');

  renderChart();

  // Location history
  const lh = document.getElementById('location-history');
  if (S.locationHistory.length === 0) {
    lh.innerHTML = '<p style="font-size:0.82rem;color:var(--gray)">No history yet — play some days!</p>';
  } else {
    lh.innerHTML = S.locationHistory.slice().reverse().map((key, i) => {
      const loc = LOCATIONS[key];
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.82rem;border-bottom:1px solid var(--gray-light)">
        <span>${loc ? loc.emoji + ' ' + loc.name : key}</span>
        <span style="color:var(--gray)">Day ${S.day - i}</span>
      </div>`;
    }).join('');
  }
}

let _profitChart = null;
function renderChart() {
  const canvas = document.getElementById('profit-chart');
  const ctx = canvas.getContext('2d');
  if (_profitChart) { _profitChart.destroy(); _profitChart = null; }
  const raw = S.last7DaysProfits.length ? S.last7DaysProfits : [0];
  const labels = raw.map((_, i) => {
    const d = S.day - raw.length + 1 + i;
    return 'D' + Math.max(1, d);
  });
  _profitChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Profit',
        data: raw,
        borderColor: '#FF8C00',
        backgroundColor: 'rgba(255,140,0,0.15)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#FFD700',
        pointBorderColor: '#FF8C00',
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => fmt(ctx.parsed.y) } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Nunito', size: 11 } } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => fmt(v),
            font: { family: 'Nunito', size: 10 }
          }
        }
      }
    }
  });
}

// â”€â”€ ACHIEVEMENTS SCREEN â”€â”€
function renderAchievements() {
  const unlocked = Object.values(S.achievements).filter(Boolean).length;
  document.getElementById('ach-progress').textContent = `${unlocked} / ${ACHIEVEMENTS_DEF.length} unlocked`;

  document.getElementById('achievement-grid').innerHTML = ACHIEVEMENTS_DEF.map(a => {
    const isUnlocked = !!S.achievements[a.id];
    return `<div class="achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}">
      <span class="ach-emoji">${a.emoji}</span>
      <span class="ach-name">${a.name}</span>
      <span class="ach-desc">${a.desc}</span>
      ${isUnlocked ? '<span class="ach-unlocked-label">✅ Unlocked!</span>' : ''}
    </div>`;
  }).join('');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// H. EVENT WIRING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function initEvents() {
  // Bottom nav — clicks blocked during selling (nav stays visible but dimmed)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (S.phase === 'selling') return;
      // During result phase, Day tab re-shows the result (prevents re-opening stand same day)
      if (S.phase === 'result' && btn.dataset.screen === 'day') {
        SFX.tap();
        showScreen('result');
        return;
      }
      SFX.tap();
      showScreen(btn.dataset.screen);
    });
  });

  // Speed toggle button (4× speed during selling)
  document.getElementById('speed-btn').addEventListener('click', () => {
    SFX.tap();
    setDaySpeed(_speedMult === 1 ? 4 : 1);
  });
  document.getElementById('skip-day-btn').addEventListener('click', () => {
    SFX.tap();
    skipSellingDay();
  });

  // Settings
  document.getElementById('settings-btn').addEventListener('click', () => {
    SFX.tap();
    document.getElementById('sound-toggle').checked = S.soundEnabled;
    document.getElementById('modal-settings').classList.remove('hidden');
  });
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal-settings').classList.add('hidden');
    saveState();
  });
  document.getElementById('sound-toggle').addEventListener('change', e => {
    S.soundEnabled = e.target.checked;
    saveState();
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset this save slot? This cannot be undone!')) {
      deleteSlot(_activeSlot);
      S = defaultState();
      initNewGame();
      document.getElementById('modal-settings').classList.add('hidden');
      updateTopBar();
      showScreen('day');
      saveState();
    }
  });

  // Main Menu button (inside settings modal)
  document.getElementById('main-menu-btn').addEventListener('click', () => {
    document.getElementById('modal-settings').classList.add('hidden');
    saveState(); // save before leaving
    showMainMenu();
  });

  // Menu screen buttons
  document.getElementById('menu-continue-btn').addEventListener('click', e => {
    SFX.tap();
    const idx = parseInt(e.currentTarget.dataset.slot || '0');
    loadFromSlot(idx);
    hideMenu();
    resumeLoadedGame();
    saveState();
  });
  document.getElementById('menu-new-btn').addEventListener('click', () => {
    SFX.tap();
    showSlotPicker('new');
  });
  document.getElementById('menu-load-btn').addEventListener('click', () => {
    SFX.tap();
    showSlotPicker('load');
  });
  document.getElementById('menu-how-btn').addEventListener('click', () => {
    SFX.tap();
    showTutorial();
  });

  // Slot picker back button
  document.getElementById('slots-back-btn').addEventListener('click', () => {
    SFX.tap();
    document.getElementById('slots-screen').classList.add('hidden');
  });

  // Slot picker card actions (event delegation)
  document.getElementById('slots-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-slotaction]');
    if (!btn) return;
    SFX.tap();
    handleSlotAction(parseInt(btn.dataset.slotidx), btn.dataset.slotaction);
  });

  // Tutorial nav
  document.getElementById('tut-skip').addEventListener('click', () => {
    document.getElementById('tutorial-overlay').classList.add('hidden');
  });
  document.getElementById('tut-prev').addEventListener('click', () => {
    SFX.tap();
    if (_tutStep > 0) { _tutStep--; renderTutStep(); }
  });
  document.getElementById('tut-next').addEventListener('click', () => {
    SFX.tap();
    if (_tutStep < TUTORIAL_STEPS.length - 1) {
      _tutStep++;
      renderTutStep();
    } else {
      document.getElementById('tutorial-overlay').classList.add('hidden');
    }
  });

  // Open stand button
  document.getElementById('open-stand-btn').addEventListener('click', openStand);

  // Next day button
  document.getElementById('next-day-btn').addEventListener('click', () => {
    SFX.nextDay();
    advanceDay();
    updateTopBar();
    showScreen('day');
  });

  // Recipe steppers — click delegation on #recipe-card
  document.getElementById('recipe-card').addEventListener('click', e => {
    const btn = e.target.closest('.step-btn');
    if (!btn) return;
    const key  = btn.dataset.key;
    const dir  = parseFloat(btn.dataset.dir);
    const step = parseFloat(btn.dataset.step);
    const min  = parseFloat(btn.dataset.min);
    const max  = parseFloat(btn.dataset.max);
    const cur  = S.recipe[key] || 0;
    const next = Math.round((cur + dir * step) * 10) / 10;
    if (next < min || next > max) return;
    S.recipe[key] = next;
    const valMap = { lemonsPerCup:'sv-lemons', sugarPerCup:'sv-sugar', icePerCup:'sv-ice' };
    const valEl = document.getElementById(valMap[key]);
    if (valEl) valEl.textContent = next;
    updateCostPerCup();
    renderDayHud();
  });

  // Price slider
  document.getElementById('sl-price').addEventListener('input', e => {
    S.price = parseFloat(e.target.value);
    document.getElementById('price-val').textContent = fmt(S.price);
    updateCostPerCup();
    document.getElementById('price-hint').textContent = '';
    // Update price tag on stand
    const ptag = document.getElementById('day-ptag');
    if (ptag) ptag.textContent = fmt(S.price);
  });

  // Location picker (event delegation) — all locations free to select, rent deducted at day end
  document.getElementById('location-grid').addEventListener('click', e => {
    const btn = e.target.closest('[data-loc]');
    if (!btn || btn.disabled) return;
    SFX.locationPick();
    const key = btn.dataset.loc;
    const loc = LOCATIONS[key];
    if (loc.rent > 0) {
      showErrorToast(`📍 ${loc.name} — $${loc.rent} rent deducted at end of day`, 2200);
    }
    S.currentLocation = key;
    saveState();
    renderLocationPicker();
    setupDayScene();
  });

  // Market bundle buy (event delegation)
  document.getElementById('market-items-list').addEventListener('click', e => {
    const btn = e.target.closest('[data-buy]');
    if (!btn) return;
    SFX.tap();
    const key  = btn.dataset.buy;
    const qty  = parseInt(btn.dataset.qty);
    const cost = parseFloat(btn.dataset.cost);
    buyIngredient(key, qty, cost);
  });

  // Shop tabs
  document.getElementById('shop-tab-bar').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    SFX.tap();
    _shopTab = tab.dataset.tab;
    renderShop();
  });

  // Shop buy / hire / ad / stand (event delegation)
  document.getElementById('shop-upgrades').addEventListener('click', e => {
    const upgradeBtn = e.target.closest('[data-upgrade]');
    if (upgradeBtn) { SFX.tap(); purchaseUpgrade(upgradeBtn.dataset.upgrade); return; }
    const hireBtn = e.target.closest('[data-hire]');
    if (hireBtn) { SFX.tap(); hireEmployee(hireBtn.dataset.hire); return; }
    const adBtn = e.target.closest('[data-ad]');
    if (adBtn) { SFX.tap(); hireDailyAd(adBtn.dataset.ad); return; }
    const standBtn = e.target.closest('[data-stand]');
    if (standBtn) { SFX.tap(); purchaseStandUpgrade(standBtn.dataset.stand, parseInt(standBtn.dataset.standtier)); }
  });

  // Modal backdrop close
  document.getElementById('modal-settings').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('modal-settings').classList.add('hidden');
    }
  });
}


