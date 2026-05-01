'use strict';

let _activeMenuTab = 0; // which menu slot tab is selected on the day screen

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

function showSeasonToast(season, year) {
  const sInfo = SEASONS[season];
  const el = document.getElementById('achievement-toast');
  el.textContent = `${sInfo.label} has arrived! — Year ${year}`;
  el.style.background = sInfo.color;
  el.classList.add('toast-show');
  clearTimeout(_achievementTimeout);
  _achievementTimeout = setTimeout(() => {
    el.classList.remove('toast-show');
    el.style.background = '';
  }, 3500);
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
  const _totalCups = (S.menu || []).filter(s => s && s.active).reduce((sum, s) => sum + (s.recipe.cupsToMake || 0), 0);
  document.getElementById('sell-stock-chip').textContent   = `🥤 ${_totalCups} cups`;
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
  // Clear cart when leaving market screen
  if (id !== 'market') _marketCart = {};
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
  renderMenuTabs();
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
  // ── Weather pill (season label embedded inline) ─────────────────────────
  const currentSeason = getSeason(S.day);
  const sInfo     = SEASONS[currentSeason];
  const w = WEATHER.find(x => x.id === S.currentWeather) || WEATHER[0];
  const pctChange = Math.round((w.mult - 1) * 100);
  const wpill = document.getElementById('day-weather-pill');
  wpill.textContent = `${w.emoji} ${w.label.replace(/^[^\s]+\s/, '')} · ${pctChange >= 0 ? '+' : ''}${pctChange}% · ${sInfo.label}`;
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

  // Inventory chips — base + any special ingredients needed by unlocked variants
  const strip = document.getElementById('day-inv-strip');
  const melt = S.iceMeltedYesterday || 0;
  const baseChips = [
    { key:'lemons', e:'🍋' }, { key:'sugar', e:'🍬' },
    { key:'cups',   e:'🥤' }, { key:'ice',   e:'🧊' },
  ];
  // Add special ingredient chips for ingredients used by any active menu slot
  const neededSpecial = new Set();
  (S.menu || []).forEach(slot => {
    if (!slot) return;
    Object.keys(SPECIAL_INGREDIENTS).forEach(id => {
      if ((slot.recipe[id + 'PerCup'] || 0) > 0) neededSpecial.add(id);
    });
  });
  const specialChips = [...neededSpecial].map(id => ({ key: id, e: SPECIAL_INGREDIENTS[id].emoji }));
  strip.innerHTML = [...baseChips, ...specialChips].map(({ key, e }) => {
    const qty = S.inventory[key] !== undefined ? S.inventory[key] : 0;
    const low = qty === 0;
    const meltTag = (key === 'ice' && melt > 0) ? ` <span style="color:#EF9A9A;font-size:0.6rem">-${melt}🌡️</span>` : '';
    return `<div class="day-inv-chip" style="${low ? 'background:rgba(229,57,53,0.25);' : ''}">
      ${e} <span class="chip-qty" style="${low ? 'color:#FF8A80;' : ''}">${qty}</span>${meltTag}
    </div>`;
  }).join('');

  // Price tag on stand — show first active slot's price
  const ptag = document.getElementById('day-ptag');
  if (ptag) {
    const primarySlot = (S.menu || []).find(s => s && s.active) || (S.menu || [])[0];
    if (primarySlot) ptag.textContent = fmt(primarySlot.price);
  }
}

function calcCostPerCup(recipe) {
  const eff = upgradeEffects();
  const p   = S.marketPrices;
  let cost = (recipe.lemonsPerCup * eff.lemonMult * p.lemons)
           + (recipe.sugarPerCup  * p.sugar)
           + (recipe.icePerCup    * eff.iceMult * p.ice)
           + (p.cups);
  Object.entries(SPECIAL_INGREDIENTS).forEach(([id, ing]) => {
    const perCup = recipe[id + 'PerCup'] || 0;
    if (perCup > 0) cost += perCup * ((p && p[id]) ? p[id] : ing.marketPrice);
  });
  return cost;
}

function updateCostPerCup() {
  const el = document.getElementById('cost-per-cup-val');
  if (!el) return;
  const slot = (S.menu || [])[_activeMenuTab] || (S.menu || [])[0];
  if (!slot) return;
  const c      = calcCostPerCup(slot.recipe);
  const margin = roundMoney(slot.price - c);
  const ok     = margin > 0;
  el.textContent = `Cost ${fmt(c)}/cup · ${ok ? '+' : ''}${fmt(margin)} margin`;
  el.style.color = ok ? 'var(--green-dark)' : 'var(--red)';
}

function renderMenuTabs() {
  const bar = document.getElementById('menu-tab-bar');
  if (!bar) return;

  const validSlots = (S.menu || []).filter(Boolean);
  if (_activeMenuTab >= validSlots.length) _activeMenuTab = 0;

  // Hide tab bar entirely when only one drink
  if (validSlots.length <= 1) {
    bar.innerHTML = '';
    renderMenuCard(_activeMenuTab);
    return;
  }

  const tabs = [];
  (S.menu || []).forEach((slot, i) => {
    if (!slot) return;
    const emoji    = getMenuItemEmoji(slot.recipe, slot.variantId);
    const isActive = i === _activeMenuTab;
    const isOff    = !slot.active;
    tabs.push(`<button class="menu-tab-icon ${isActive ? 'active' : ''} ${isOff ? 'inactive-drink' : ''}" data-menu-tab="${i}" title="${getMenuItemName(slot.recipe, slot.variantId)}">${emoji}</button>`);
  });

  const activeSlot = (S.menu || [])[_activeMenuTab];
  const activeName = activeSlot ? getMenuItemName(activeSlot.recipe, activeSlot.variantId) : '';
  const activeOff  = activeSlot && !activeSlot.active;

  bar.innerHTML = `
    <div class="menu-tab-row">
      ${tabs.join('')}
    </div>
    ${activeName ? `<div class="menu-tab-label ${activeOff ? 'label-off' : ''}">${activeName}${activeOff ? ' · <span style="color:#999">Off</span>' : ''}</div>` : ''}
  `;

  renderMenuCard(_activeMenuTab);
}

function renderMenuCard(slotIdx) {
  const menuCardEl = document.getElementById('menu-card');
  if (!menuCardEl) return;
  const slot = (S.menu || [])[slotIdx];
  if (!slot) { menuCardEl.innerHTML = ''; return; }

  const r       = slot.recipe;
  const costPc  = calcCostPerCup(r);
  const name    = getMenuItemName(r, slot.variantId);
  const emoji   = getMenuItemEmoji(r, slot.variantId);
  const variant = MENU_VARIANTS.find(v => v.id === slot.variantId);
  const hint    = variant ? variant.hint : '';
  const margin  = roundMoney(slot.price - costPc);
  const profitOk = margin > 0;

  const multiMenu = (S.menu || []).filter(Boolean).length > 1;
  const toggleHtml = multiMenu
    ? `<button class="btn-slot-toggle ${slot.active ? 'slot-on' : 'slot-off'}" data-action="toggle-slot" data-slot="${slotIdx}">${slot.active ? '✅ On' : '⬜ Off'}</button>`
    : '';

  const stepRow = (e, lbl, key, val, min, max, step = 1) =>
    `<div class="cr-row">
      <span class="cr-icon">${e}</span>
      <span class="cr-label">${lbl}</span>
      <div class="cr-stepper">
        <button class="step-btn cr-btn" data-key="${key}" data-dir="-1" data-min="${min}" data-max="${max}" data-step="${step}">−</button>
        <span class="cr-val" id="sv-${key}-${slotIdx}">${val}</span>
        <button class="step-btn cr-btn" data-key="${key}" data-dir="1" data-min="${min}" data-max="${max}" data-step="${step}">+</button>
      </div>
    </div>`;

  const isClassic = !slot.variantId || slot.variantId === 'classic';

  // Base recipe rows — only for Classic (others have preset lemons/sugar/ice)
  const baseRows = isClassic
    ? `<div class="cr-grid">
        ${stepRow('🍋','Lemons/cup','lemonsPerCup', r.lemonsPerCup, 1, 4)}
        ${stepRow('🍬','Sugar/cup', 'sugarPerCup',  r.sugarPerCup,  1, 4)}
        ${stepRow('🧊','Ice/cup',   'icePerCup',    r.icePerCup,    0, 3)}
      </div>`
    : '';

  // Special ingredient rows — for variants that use them
  let specialRows = '';
  Object.entries(SPECIAL_INGREDIENTS).forEach(([id, ing]) => {
    const perCup  = r[id + 'PerCup'] || 0;
    const inStock = S.inventory[id] || 0;
    // Show if variant has this ingredient OR player has stock for it
    if (perCup > 0 || (!isClassic && inStock > 0)) {
      const stockLabel = inStock === 0
        ? ' <span style="color:#C62828;font-size:0.65rem">⚠️ 0</span>'
        : ` <span style="font-size:0.65rem;color:var(--gray)">(${inStock})</span>`;
      specialRows += stepRow(ing.emoji, ing.label + stockLabel, id + 'PerCup', perCup, 0, 2);
    }
  });

  const ingredientSection = baseRows || specialRows
    ? `<div class="cr-ingredients-section">${baseRows}${specialRows ? `<div class="cr-grid">${specialRows}</div>` : ''}</div>`
    : `<div class="cr-hint" style="margin-bottom:8px">📌 Fixed recipe — just set your price below.</div>`;

  let html = `<div class="card compact-recipe">
    <div class="cr-header">
      <span class="cr-drink-name">${emoji} ${name}</span>
      ${toggleHtml}
    </div>
    ${hint ? `<div class="cr-hint">${hint}</div>` : ''}
    ${ingredientSection}
    <div class="cr-price-row">
      <span class="cr-price-label">💰 Price</span>
      <div class="cr-stepper">
        <button class="step-btn cr-btn" data-key="price" data-dir="-1" data-min="0.25" data-max="15.00" data-step="0.25">−</button>
        <span class="cr-val" id="sv-price-${slotIdx}">${fmt(slot.price)}</span>
        <button class="step-btn cr-btn" data-key="price" data-dir="1" data-min="0.25" data-max="15.00" data-step="0.25">+</button>
      </div>
    </div>
    <div class="cr-cost-row">
      <span id="cost-per-cup-val" style="color:${profitOk ? 'var(--green-dark)' : 'var(--red)'}">Cost ${fmt(costPc)}/cup · ${profitOk ? '+' : ''}${fmt(margin)} margin</span>
    </div>
  </div>`;

  menuCardEl.innerHTML = html;

  // Toggle button handler
  const toggleBtn = menuCardEl.querySelector('[data-action="toggle-slot"]');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const si = parseInt(toggleBtn.dataset.slot);
      if (S.menu[si]) { S.menu[si].active = !S.menu[si].active; saveState(); renderMenuTabs(); }
    });
  }
}

function renderLocationPicker() {
  const grid = document.getElementById('location-grid');
  grid.innerHTML = Object.entries(LOCATIONS).map(([key, loc]) => {
    const selected  = S.currentLocation === key;
    const infoText  = loc.rent > 0
      ? `${loc.customers} customers · $${loc.rent} rent`
      : `${loc.customers} customers · Free`;
    return `<button class="loc-btn ${selected ? 'selected' : ''}"
      data-loc="${key}">
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

// Cart: { 'base:lemons:0': { bundles: N, itemsPerBundle, unitCost, key, isSpecial, specialId } }
// N = how many bundles of that size; itemsPerBundle = qty in one bundle
let _marketCart = {};
let _marketSelected = 'lemons'; // which ingredient is focused in the market panel

function _cartKey(type, id, bundleIdx) { return `${type}:${id}:${bundleIdx}`; }

function _cartEntryTotal(e) {
  return roundMoney(e.bundles * e.unitCost);
}

function _cartTotal() {
  return roundMoney(Object.values(_marketCart).reduce((s, e) => s + _cartEntryTotal(e), 0));
}

function _cartTotalItems(e) { return e.bundles * e.itemsPerBundle; }

function _adjustCart(cartKey, delta) {
  const e = _marketCart[cartKey];
  if (!e) return;
  const newBundles = Math.max(0, e.bundles + delta);
  if (newBundles === 0) {
    delete _marketCart[cartKey];
  } else {
    e.bundles = newBundles;
  }
  _updateCartCounters();
  _updateCartFooter();
}

function _updateCartCounters() {
  // Update qty labels and +/- button states for all stepper rows
  document.querySelectorAll('.bun-stepper[data-cart-key]').forEach(row => {
    const ck = row.dataset.cartKey;
    const e  = _marketCart[ck];
    const bundles = e ? e.bundles : 0;
    const qtyEl = row.querySelector('.bun-step-qty');
    if (qtyEl) qtyEl.textContent = bundles;
    const minusBtn = row.querySelector('[data-step="-1"]');
    if (minusBtn) minusBtn.disabled = bundles === 0;
    row.classList.toggle('has-qty', bundles > 0);
    // Cost label
    const costEl = row.querySelector('.bun-step-cost');
    if (costEl && e) costEl.textContent = bundles > 0 ? fmt(_cartEntryTotal(e)) : '';
  });

  // Disable + buttons that would exceed budget
  const spent = _cartTotal();
  const remaining = S.coins - spent;
  document.querySelectorAll('.bun-stepper[data-cart-key]').forEach(row => {
    const ck = row.dataset.cartKey;
    const e  = _marketCart[ck] || { unitCost: parseFloat(row.dataset.unitCost) || 0 };
    const plusBtn = row.querySelector('[data-step="1"]');
    if (plusBtn) plusBtn.disabled = e.unitCost > remaining + 0.001;
  });
}

function _updateCartFooter() {
  const total   = _cartTotal();
  const entries = Object.values(_marketCart);
  const summaryEl = document.getElementById('cart-summary-line');
  const totalEl   = document.getElementById('cart-total-display');
  const buyBtn    = document.getElementById('cart-buy-btn');
  if (!summaryEl) return;

  if (entries.length === 0) {
    summaryEl.textContent = 'Cart is empty';
    totalEl.textContent   = 'Total: $0.00';
    buyBtn.disabled = true;
    return;
  }

  const parts = entries.map(e => {
    const info = INGREDIENT_INFO[e.key];
    const name = info ? info.name : (e.key || 'Item');
    return `${name} ×${_cartTotalItems(e)}`;
  });
  summaryEl.textContent = parts.join('  ·  ');
  totalEl.textContent   = `Total: ${fmt(total)}`;
  buyBtn.disabled = total > S.coins + 0.001;
}

function checkoutCart() {
  const entries = Object.values(_marketCart).filter(e => e.bundles > 0);
  if (entries.length === 0) return;
  const total = _cartTotal();
  if (total > S.coins + 0.001) {
    showErrorToast(`Not enough coins! Need ${fmt(total)}`);
    return;
  }
  SFX.buy();
  const coinsBefore = S.coins;
  S.coins = Math.round((S.coins - total) * 100) / 100;
  S.marketSpentToday = (S.marketSpentToday || 0) + total;
  entries.forEach(e => {
    const totalItems = _cartTotalItems(e);
    S.inventory[e.key] += totalItems;
  });
  _marketCart = {};
  saveState();
  animateCoinCounter(coinsBefore, S.coins, 500);
  renderMarket();
}

function _makeBundleSteppers(bundles) {
  // Returns HTML for stepper rows (one per bundle size)
  return bundles.map(({ label, qty, unitCost, ck }) => {
    const entry   = _marketCart[ck];
    const count   = entry ? entry.bundles : 0;
    const spent   = _cartTotal();
    const remaining = S.coins - spent;
    const plusOk  = unitCost <= remaining + 0.001;
    return `<div class="bun-stepper${count > 0 ? ' has-qty' : ''}" data-cart-key="${ck}" data-unit-cost="${unitCost}">
      <span class="bun-step-label">${label}</span>
      <span class="bun-step-items">×${qty}</span>
      <div class="bun-step-controls">
        <button class="bun-step-btn" data-cart-key="${ck}" data-step="-1" ${count === 0 ? 'disabled' : ''}>−</button>
        <span class="bun-step-qty">${count}</span>
        <button class="bun-step-btn" data-cart-key="${ck}" data-step="1" ${!plusOk ? 'disabled' : ''}>+</button>
      </div>
      <span class="bun-step-cost">${count > 0 ? fmt(count * unitCost) : ''}</span>
    </div>`;
  }).join('');
}

function renderMarket() {
  // Update sticky top budget bar
  const budgetEl = document.getElementById('ms-budget');
  const spentEl  = document.getElementById('ms-spent');
  if (budgetEl) budgetEl.textContent = fmt(S.coins);
  if (spentEl)  spentEl.textContent  = fmt(S.marketSpentToday || 0);

  // Build available keys
  const neededSpecial = new Set();
  (S.unlockedVariants || ['classic']).forEach(vid => {
    const v = MENU_VARIANTS.find(m => m.id === vid);
    if (!v) return;
    if ((v.recipe.mintPerCup || 0) > 0)          neededSpecial.add('mint');
    if ((v.recipe.strawberryPerCup || 0) > 0)    neededSpecial.add('strawberry');
    if ((v.recipe.applecinnamonPerCup || 0) > 0) neededSpecial.add('applecinnamon');
    if ((v.recipe.honeyPerCup || 0) > 0)         neededSpecial.add('honey');
  });
  const allMarketKeys = ['lemons', 'sugar', 'cups', 'ice', ...[...neededSpecial]];

  // ── Stock bar at top ─────────────────────────────────────────────────────
  const invGrid = document.getElementById('market-inv-grid');
  if (invGrid) {
    invGrid.innerHTML = allMarketKeys.map(key => {
      const info  = INGREDIENT_INFO[key];
      const qty   = S.inventory[key] !== undefined ? S.inventory[key] : 0;
      const low   = qty === 0;
      return `<div class="mkt-stock-chip ${low ? 'low' : ''}">
        <span>${info.emoji}</span>
        <span class="mkt-stock-chip-qty">${qty}</span>
      </div>`;
    }).join('');
  }

  // ── All-ingredients list ──────────────────────────────────────────────────
  const list = document.getElementById('market-items-list');
  if (!list) return;

  const spent     = _cartTotal();
  const remaining = S.coins - spent;

  list.innerHTML = allMarketKeys.map(key => {
    const info   = INGREDIENT_INFO[key];
    const price  = S.marketPrices[key] || INGREDIENT_BASE[key] || 0;
    const prev   = (S.prevMarketPrices && S.prevMarketPrices[key] !== undefined) ? S.prevMarketPrices[key] : INGREDIENT_BASE[key] || price;
    const delta  = roundMoney(price - prev);
    const stock  = S.inventory[key] !== undefined ? S.inventory[key] : 0;
    const isSpec = neededSpecial.has(key);

    const deltaHtml = delta === 0 ? ''
      : `<span class="price-change ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'}${fmt(Math.abs(delta))}</span>`;

    // Cart qty for this ingredient
    const bundles = MARKET_BUNDLES[key] || [];
    let cartQty = 0;
    bundles.forEach((_, idx) => {
      const e = _marketCart[_cartKey('base', key, idx)];
      if (e) cartQty += e.bundles * e.itemsPerBundle;
    });
    const hasCart = cartQty > 0;

    // S / M / L buttons — fixed width so pill never shifts them
    const addBtns = bundles.map((b, idx) => {
      const unitCost  = getBundleCost(key, b.qty);
      const canAfford = unitCost <= remaining + 0.001;
      return `<button class="mkt-add-btn ${canAfford ? '' : 'cant-afford'}" data-mkt-add="${key}:${idx}">
        <span class="mab-size">${b.label}</span>
        <span class="mab-qty">+${b.qty}</span>
        <span class="mab-cost">${fmt(unitCost)}</span>
      </button>`;
    }).join('');

    return `<div class="mkt-ing-row ${isSpec ? 'special' : ''} ${hasCart ? 'has-cart' : ''}">
      <div class="mkt-ing-header">
        <span class="mkt-ing-emoji">${info.emoji}</span>
        <span class="mkt-ing-name">${info.name}${isSpec ? ' <span class="mi-special-badge">✦</span>' : ''}</span>
        <span class="mkt-ing-price">${fmt(price)}/${info.unit} ${deltaHtml}</span>
        <span class="mkt-ing-stock ${stock === 0 ? 'low-stock' : ''}">${stock} held</span>
      </div>
      <div class="mkt-ing-btns-row">
        <div class="mkt-add-btns">${addBtns}</div>
        ${hasCart
          ? `<div class="mkt-cart-badge">🛒 +${cartQty}<button class="mkt-clear-ing" data-mkt-clear="${key}">×</button></div>`
          : `<div class="mkt-cart-badge-placeholder"></div>`}
      </div>
    </div>`;
  }).join('');

  _updateCartFooter();
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

  } else if (_shopTab === 'menu') {
    html += renderMenuShopTab();

  } else {
    // Tools tab - Lemonade Tycoon equipment in order
    UPGRADES.forEach(u => {
      const owned  = !!S.upgrades[u.id];
      const canBuy = !owned && S.coins >= u.cost;
      html += `<div class="upgrade-card ${owned ? 'owned' : ''}">
        <div class="ug-icon">${_getUpgradeIcon(u.id)}</div>
        <div class="ug-info">
          <div class="ug-name">${u.name}</div>
          <div class="ug-desc">${u.desc}</div>
          <div style="font-size:0.72rem;color:var(--orange);margin-top:4px;font-weight:700">${fmt(u.cost)}</div>
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


function renderMenuShopTab() {
  const unlocked = S.unlockedVariants || ['classic'];
  let html = `<div class="employee-section-header" style="background:linear-gradient(135deg,#E65100,#BF360C)">🍹 Drink Variants <span style="font-size:0.72rem;opacity:0.8">Unlock new drinks to sell simultaneously</span></div>`;
  html += `<div style="padding:10px 12px 4px;font-size:0.82rem;color:var(--navy)">Buy a variant to add it to your menu — customers choose between drinks by taste &amp; price appeal.</div>`;

  // Variant cards — skip classic (always owned), show others
  MENU_VARIANTS.filter(v => v.id !== 'classic').forEach(v => {
    const isOwned = unlocked.includes(v.id);
    const canBuy  = !isOwned && S.coins >= v.cost;

    html += `<div class="upgrade-card ${isOwned ? 'owned' : ''}">
      <div class="ug-icon" style="font-size:1.8rem">${v.emoji}</div>
      <div class="ug-info">
        <div class="ug-name">${v.name}</div>
        <div class="ug-desc">${v.hint}</div>
        <div style="font-size:0.72rem;color:var(--orange);margin-top:4px;font-weight:700">${v.cost > 0 ? fmt(v.cost) : 'Free'}</div>
      </div>
      ${isOwned
        ? '<span class="ug-owned-badge">✅ Unlocked</span>'
        : `<button class="ug-buy-btn" data-buy-variant="${v.id}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'Unlock — ' + fmt(v.cost) : 'Need ' + fmt(v.cost)}</button>`
      }
    </div>`;
  });
  return html;
}

function buyMenuVariant(variantId) {
  const v = MENU_VARIANTS.find(mv => mv.id === variantId);
  if (!v) return;
  if (!S.unlockedVariants) S.unlockedVariants = ['classic'];
  if (S.unlockedVariants.includes(variantId)) return;
  if (S.coins < v.cost) { showErrorToast(`Need ${fmt(v.cost)} to unlock!`); return; }
  const coinsBefore = S.coins;
  S.coins = Math.round((S.coins - v.cost) * 100) / 100;
  S.unlockedVariants.push(variantId);
  // Always push a new slot — no slot cap
  const newSlot = {
    variantId: v.id,
    recipe: { cupsToMake:10, ...v.recipe,
      mintPerCup: v.recipe.mintPerCup||0, strawberryPerCup: v.recipe.strawberryPerCup||0,
      applecinnamonPerCup: v.recipe.applecinnamonPerCup||0, honeyPerCup: v.recipe.honeyPerCup||0 },
    price: v.suggestedPrice || 2.00,
    active: true
  };
  // Find first null slot, or append
  const nullIdx = (S.menu || []).indexOf(null);
  if (nullIdx >= 0) {
    S.menu[nullIdx] = newSlot;
  } else {
    if (!S.menu) S.menu = [];
    S.menu.push(newSlot);
  }
  SFX.unlock ? SFX.unlock() : SFX.buy();
  animateCoinCounter(coinsBefore, S.coins, 400);
  saveState();
  renderShop();
  updateTopBar();
  showAchievementToast({ emoji: v.emoji, name: v.name + ' Unlocked!', desc: v.hint });
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
  _playAdEffect(id);   // fire the visual celebration for this ad
}

// ── UPGRADE SVG ICONS ────────────────────────────────────────────────────────
// Returns an inline SVG illustration for each equipment upgrade ID.
function _getUpgradeIcon(id) {
  const svgs = {

    juicer: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- collection jar body -->
      <rect x="11" y="36" width="34" height="16" rx="5" fill="#E3F2FD" stroke="#64B5F6" stroke-width="1.5"/>
      <!-- juice inside jar -->
      <rect x="12" y="43" width="32" height="8" rx="4" fill="#FFD740" opacity="0.75"/>
      <!-- drip channel -->
      <rect x="24" y="30" width="8" height="8" rx="3" fill="#FFD740"/>
      <!-- squeezer cone -->
      <polygon points="28,10 13,30 43,30" fill="#FFA726"/>
      <!-- cone ribs -->
      <line x1="28" y1="11" x2="20" y2="30" stroke="#FF8C00" stroke-width="1.2"/>
      <line x1="28" y1="11" x2="28" y2="30" stroke="#FF8C00" stroke-width="1.2"/>
      <line x1="28" y1="11" x2="36" y2="30" stroke="#FF8C00" stroke-width="1.2"/>
      <!-- lemon half sitting on top -->
      <ellipse cx="28" cy="10" rx="10" ry="6" fill="#FFD740"/>
      <path d="M18,10 a10,6 0 0,0 20,0" fill="#FFF59D" opacity="0.8"/>
      <!-- lemon pip/seed dots -->
      <circle cx="24" cy="9" r="1.2" fill="#FF8C00"/>
      <circle cx="28" cy="9" r="1.2" fill="#FF8C00"/>
      <circle cx="32" cy="9" r="1.2" fill="#FF8C00"/>
      <!-- handle bars -->
      <rect x="3"  y="21" width="12" height="5" rx="2.5" fill="#795548"/>
      <rect x="41" y="21" width="12" height="5" rx="2.5" fill="#795548"/>
      <circle cx="4"  cy="23" r="2.5" fill="#5D4037"/>
      <circle cx="52" cy="23" r="2.5" fill="#5D4037"/>
    </svg>`,

    canopy: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="ugCanopyClip"><path d="M4,30 Q28,4 52,30 Z"/></clipPath></defs>
      <!-- main canopy arc filled orange -->
      <path d="M4,30 Q28,4 52,30 Z" fill="#FF8C00"/>
      <!-- white stripe wedges clipped inside arc -->
      <rect x="6"  y="0" width="5" height="32" fill="#FFF" clip-path="url(#ugCanopyClip)"/>
      <rect x="17" y="0" width="5" height="32" fill="#FFF" clip-path="url(#ugCanopyClip)"/>
      <rect x="28" y="0" width="5" height="32" fill="#FFF" clip-path="url(#ugCanopyClip)"/>
      <rect x="39" y="0" width="5" height="32" fill="#FFF" clip-path="url(#ugCanopyClip)"/>
      <!-- scalloped fringe row -->
      <path d="M4,30 Q28,4 52,30" fill="none" stroke="#E65100" stroke-width="2"/>
      <ellipse cx="7"  cy="30" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="13" cy="31" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="19" cy="31" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="25" cy="31" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="31" cy="31" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="37" cy="31" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="43" cy="31" rx="3" ry="4" fill="#FFD740"/>
      <ellipse cx="49" cy="30" rx="3" ry="4" fill="#FFD740"/>
      <!-- vertical centre pole -->
      <rect x="26" y="30" width="4" height="22" rx="2" fill="#795548"/>
      <rect x="14" y="50" width="28" height="4" rx="2" fill="#5D4037"/>
      <!-- finial spike at top -->
      <polygon points="28,2 25,11 31,11" fill="#FFD740"/>
    </svg>`,

    powerjuicer: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- motor base -->
      <rect x="10" y="38" width="36" height="14" rx="6" fill="#455A64"/>
      <!-- speed buttons -->
      <rect x="13" y="42" width="7"  height="6" rx="2" fill="#EF5350"/>
      <rect x="22" y="42" width="7"  height="6" rx="2" fill="#FFCA28"/>
      <rect x="31" y="42" width="7"  height="6" rx="2" fill="#66BB6A"/>
      <rect x="40" y="42" width="5"  height="6" rx="2" fill="#29B6F6"/>
      <!-- blender jar trapezoid -->
      <path d="M15,14 L12,38 L44,38 L41,14 Z" fill="#B3E5FC" stroke="#42A5F5" stroke-width="1.5"/>
      <!-- yellow lemonade fill -->
      <path d="M15.8,22 L13,38 L43,38 L40.2,22 Z" fill="#FFD740" opacity="0.75"/>
      <!-- swirl/blade indicator -->
      <ellipse cx="28" cy="37" rx="11" ry="3" fill="#78909C" opacity="0.5"/>
      <line x1="17" y1="37" x2="39" y2="37" stroke="#546E7A" stroke-width="2"/>
      <line x1="21" y1="34" x2="35" y2="40" stroke="#546E7A" stroke-width="2"/>
      <!-- bubbles inside jar -->
      <circle cx="21" cy="28" r="2"   fill="#FFF" opacity="0.55"/>
      <circle cx="31" cy="25" r="1.5" fill="#FFF" opacity="0.55"/>
      <circle cx="27" cy="31" r="1"   fill="#FFF" opacity="0.55"/>
      <!-- lid -->
      <rect x="18" y="10" width="20" height="6" rx="3" fill="#37474F"/>
      <circle cx="28" cy="10" r="3" fill="#546E7A"/>
      <!-- lightning bolt badge -->
      <polygon points="50,4 43,20 47,20 40,36 52,16 47,16" fill="#FFD740" stroke="#FF8C00" stroke-width="0.8"/>
    </svg>`,

    register: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- main body -->
      <rect x="5"  y="18" width="46" height="30" rx="5" fill="#37474F"/>
      <!-- display housing -->
      <rect x="8"  y="6"  width="40" height="15" rx="3" fill="#263238"/>
      <!-- screen glow -->
      <rect x="10" y="8"  width="36" height="11" rx="2" fill="#00E5FF" opacity="0.2"/>
      <rect x="10" y="8"  width="36" height="11" rx="2" fill="#00ACC1" opacity="0.35"/>
      <!-- screen text -->
      <text x="28" y="17" font-size="7.5" text-anchor="middle" fill="#E0F7FA" font-weight="bold">$8.50</text>
      <!-- keypad rows -->
      <rect x="9"  y="26" width="7" height="5" rx="1.5" fill="#546E7A"/>
      <rect x="18" y="26" width="7" height="5" rx="1.5" fill="#546E7A"/>
      <rect x="27" y="26" width="7" height="5" rx="1.5" fill="#546E7A"/>
      <rect x="9"  y="33" width="7" height="5" rx="1.5" fill="#546E7A"/>
      <rect x="18" y="33" width="7" height="5" rx="1.5" fill="#546E7A"/>
      <rect x="27" y="33" width="7" height="5" rx="1.5" fill="#4CAF50"/>
      <!-- tall enter key -->
      <rect x="36" y="26" width="11" height="12" rx="2" fill="#4CAF50"/>
      <text x="41.5" y="35" font-size="7" text-anchor="middle" fill="#FFF" font-weight="bold">↵</text>
      <!-- cash drawer -->
      <rect x="5"  y="44" width="46" height="8" rx="3" fill="#1C313A"/>
      <!-- drawer handle bar -->
      <rect x="18" y="46" width="20" height="3" rx="1.5" fill="#78909C"/>
      <!-- coins visible in drawer -->
      <circle cx="9"  cy="48" r="2.2" fill="#FFD740"/>
      <circle cx="14" cy="48" r="2.2" fill="#FFD740"/>
      <circle cx="45" cy="48" r="2.2" fill="#FFD740"/>
      <circle cx="50" cy="48" r="2.2" fill="#C0C0C0"/>
    </svg>`,

    fridge: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- body shadow -->
      <rect x="9" y="5" width="38" height="48" rx="6" fill="#B0BEC5" opacity="0.4"/>
      <!-- main body -->
      <rect x="8" y="4" width="38" height="48" rx="6" fill="#ECEFF1"/>
      <rect x="8" y="4" width="38" height="48" rx="6" fill="none" stroke="#B0BEC5" stroke-width="1.5"/>
      <!-- divider line -->
      <line x1="8" y1="26" x2="46" y2="26" stroke="#90A4AE" stroke-width="1.5"/>
      <!-- freezer handle -->
      <rect x="38" y="10" width="5" height="10" rx="2.5" fill="#90A4AE"/>
      <!-- fridge handle -->
      <rect x="38" y="30" width="5" height="18" rx="2.5" fill="#90A4AE"/>
      <!-- freezer interior hint -->
      <rect x="11" y="7" width="26" height="17" rx="4" fill="#E3F2FD" opacity="0.6"/>
      <!-- snowflake icon in freezer -->
      <text x="22" y="18" font-size="11" text-anchor="middle">❄️</text>
      <!-- fridge contents -->
      <rect x="11" y="28" width="26" height="21" rx="4" fill="#F9FBE7" opacity="0.7"/>
      <circle cx="18" cy="36" r="4" fill="#FFD740"/>
      <circle cx="28" cy="36" r="3.5" fill="#A5D6A7"/>
      <circle cx="37" cy="36" r="3" fill="#EF9A9A"/>
      <rect x="14" y="42" width="26" height="3" rx="1.5" fill="#DCEDC8"/>
      <!-- temp indicator light -->
      <circle cx="12" cy="47" r="2.5" fill="#42A5F5" opacity="0.8"/>
    </svg>`,

    iceomatic: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- machine body -->
      <rect x="7" y="6" width="42" height="40" rx="7" fill="#0D47A1"/>
      <!-- face panel -->
      <rect x="11" y="10" width="34" height="28" rx="5" fill="#1565C0"/>
      <!-- display window glass -->
      <rect x="14" y="12" width="22" height="14" rx="3" fill="#E3F2FD"/>
      <!-- ice cubes in window -->
      <rect x="16" y="14" width="8" height="8" rx="1.5" fill="#B3E5FC" stroke="#90CAF9" stroke-width="0.8"/>
      <rect x="26" y="14" width="8" height="8" rx="1.5" fill="#B3E5FC" stroke="#90CAF9" stroke-width="0.8"/>
      <rect x="16" y="19" width="8" height="6" rx="1"   fill="#E1F5FE" opacity="0.5"/>
      <rect x="26" y="19" width="8" height="6" rx="1"   fill="#E1F5FE" opacity="0.5"/>
      <!-- brand label -->
      <rect x="38" y="12" width="5" height="14" rx="2" fill="#1A237E"/>
      <text x="40.5" y="21" font-size="4.5" text-anchor="middle" fill="#90CAF9" font-weight="bold">ICE</text>
      <!-- dispense nozzle -->
      <rect x="20" y="28" width="16" height="8" rx="3" fill="#0D47A1"/>
      <rect x="23" y="34" width="10" height="4" rx="1.5" fill="#B3E5FC"/>
      <!-- output tray -->
      <rect x="11" y="42" width="34" height="8" rx="4" fill="#0A3364"/>
      <!-- ice cubes in tray -->
      <rect x="13" y="43" width="8" height="6" rx="1.5" fill="#B3E5FC"/>
      <rect x="23" y="43" width="8" height="6" rx="1.5" fill="#B3E5FC"/>
      <rect x="33" y="43" width="8" height="6" rx="1.5" fill="#B3E5FC"/>
      <!-- power button -->
      <circle cx="42" cy="34" r="4" fill="#4CAF50"/>
      <text x="42" y="37" font-size="4.5" text-anchor="middle" fill="#FFF" font-weight="bold">ON</text>
    </svg>`,

    soundsystem: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- left cabinet -->
      <rect x="2" y="14" width="19" height="38" rx="4" fill="#212121"/>
      <rect x="3" y="15" width="17" height="36" rx="3" fill="#1A1A2E"/>
      <!-- left woofer ring + cone -->
      <circle cx="11.5" cy="26" r="7" fill="#333"/>
      <circle cx="11.5" cy="26" r="5.5" fill="#424242"/>
      <circle cx="11.5" cy="26" r="3.5" fill="#FF8C00" opacity="0.85"/>
      <circle cx="11.5" cy="26" r="1.5" fill="#FFD740"/>
      <!-- left tweeter -->
      <circle cx="11.5" cy="38" r="4" fill="#333"/>
      <circle cx="11.5" cy="38" r="2.5" fill="#546E7A"/>
      <circle cx="11.5" cy="38" r="1"   fill="#78909C"/>
      <!-- right cabinet -->
      <rect x="35" y="14" width="19" height="38" rx="4" fill="#212121"/>
      <rect x="36" y="15" width="17" height="36" rx="3" fill="#1A1A2E"/>
      <!-- right woofer -->
      <circle cx="44.5" cy="26" r="7" fill="#333"/>
      <circle cx="44.5" cy="26" r="5.5" fill="#424242"/>
      <circle cx="44.5" cy="26" r="3.5" fill="#FF8C00" opacity="0.85"/>
      <circle cx="44.5" cy="26" r="1.5" fill="#FFD740"/>
      <!-- right tweeter -->
      <circle cx="44.5" cy="38" r="4" fill="#333"/>
      <circle cx="44.5" cy="38" r="2.5" fill="#546E7A"/>
      <circle cx="44.5" cy="38" r="1"   fill="#78909C"/>
      <!-- central mixer/amp unit -->
      <rect x="20" y="24" width="16" height="20" rx="3" fill="#1A1A2E"/>
      <rect x="21" y="26" width="14" height="8" rx="2" fill="#263238"/>
      <!-- knobs on amp -->
      <circle cx="25" cy="30" r="3" fill="#FF8C00"/>
      <circle cx="31" cy="30" r="3" fill="#FFD740"/>
      <line  x1="25" y1="27" x2="25" y2="30" stroke="#1A1A2E" stroke-width="1.2"/>
      <line  x1="31" y1="27" x2="32" y2="30" stroke="#1A1A2E" stroke-width="1.2"/>
      <!-- music notes floating -->
      <text x="22" y="14" font-size="10" fill="#FFD740">♪</text>
      <text x="30" y="10" font-size="12" fill="#FF8C00">♫</text>
    </svg>`,

    neon: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- hanging wires -->
      <line x1="16" y1="2"  x2="14" y2="10" stroke="#90A4AE" stroke-width="1.5"/>
      <line x1="40" y1="2"  x2="42" y2="10" stroke="#90A4AE" stroke-width="1.5"/>
      <circle cx="16" cy="2"  r="2" fill="#90A4AE"/>
      <circle cx="40" cy="2"  r="2" fill="#90A4AE"/>
      <!-- sign board -->
      <rect x="4" y="10" width="48" height="38" rx="6" fill="#0D0D1A"/>
      <!-- outer glow ring (simulate neon glow) -->
      <rect x="4" y="10" width="48" height="38" rx="6" fill="none" stroke="#FFD740" stroke-width="2" opacity="0.4"/>
      <!-- inner border tube -->
      <rect x="7" y="13" width="42" height="32" rx="4" fill="none" stroke="#FF8C00" stroke-width="1.5" stroke-dasharray="4,2" opacity="0.6"/>
      <!-- LEMON big neon text with glow -->
      <text x="28" y="31" font-size="12" font-weight="bold" text-anchor="middle"
        fill="#FFD740" stroke="#FF8C00" stroke-width="0.4">LEMON</text>
      <!-- glow halo under text -->
      <ellipse cx="28" cy="31" rx="18" ry="5" fill="#FFD740" opacity="0.08"/>
      <!-- decorative lemon shape bottom -->
      <ellipse cx="28" cy="38" rx="9" ry="5" fill="none" stroke="#FFD740" stroke-width="1.5" opacity="0.6"/>
      <line x1="28" y1="33" x2="28" y2="36" stroke="#FFD740" stroke-width="1.5" opacity="0.6"/>
      <!-- corner sparkle stars -->
      <text x="6"  y="17" font-size="6" fill="#FFD740" opacity="0.9">✦</text>
      <text x="44" y="17" font-size="6" fill="#FFD740" opacity="0.9">✦</text>
      <text x="6"  y="46" font-size="6" fill="#FFD740" opacity="0.9">✦</text>
      <text x="44" y="46" font-size="6" fill="#FFD740" opacity="0.9">✦</text>
    </svg>`,

    dispenser: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- machine cylinder body -->
      <rect x="13" y="4" width="30" height="40" rx="8" fill="#455A64"/>
      <!-- tank window (clear) -->
      <rect x="17" y="8"  width="22" height="24" rx="5" fill="#B3E5FC" stroke="#42A5F5" stroke-width="1"/>
      <!-- lemonade fill level -->
      <rect x="17" y="18" width="22" height="14" rx="4" fill="#FFD740" opacity="0.85"/>
      <!-- bubbles in drink -->
      <circle cx="22" cy="22" r="2"   fill="#FFF" opacity="0.55"/>
      <circle cx="30" cy="20" r="1.5" fill="#FFF" opacity="0.55"/>
      <circle cx="34" cy="24" r="1"   fill="#FFF" opacity="0.55"/>
      <!-- control row -->
      <rect x="15" y="34" width="26" height="8" rx="3" fill="#37474F"/>
      <circle cx="22" cy="38" r="3.5" fill="#EF5350"/>
      <circle cx="34" cy="38" r="3.5" fill="#66BB6A"/>
      <!-- lemon slice badge on tank -->
      <circle cx="38" cy="13" r="5" fill="#FFD740" stroke="#FF8C00" stroke-width="1"/>
      <line x1="38" y1="8"  x2="38" y2="18" stroke="#FF8C00" stroke-width="0.8"/>
      <line x1="33" y1="13" x2="43" y2="13" stroke="#FF8C00" stroke-width="0.8"/>
      <!-- spout nozzle -->
      <rect x="22" y="42" width="12" height="5" rx="2.5" fill="#546E7A"/>
      <rect x="26" y="47" width="4"  height="5" rx="1.5" fill="#37474F"/>
      <!-- liquid drop -->
      <ellipse cx="28" cy="53" rx="2" ry="3" fill="#FFD740" opacity="0.8"/>
      <!-- capacity badge -->
      <rect x="2" y="6" width="14" height="10" rx="3" fill="#1A1A2E"/>
      <text x="9" y="14" font-size="6.5" text-anchor="middle" fill="#FFD740" font-weight="bold">+5✦</text>
    </svg>`,

    icemaker: `<svg viewBox="0 0 56 56" width="52" height="52" xmlns="http://www.w3.org/2000/svg">
      <!-- main industrial cabinet -->
      <rect x="5" y="4" width="46" height="44" rx="7" fill="#37474F"/>
      <!-- recessed front panel -->
      <rect x="9" y="8" width="38" height="24" rx="5" fill="#455A64"/>
      <!-- digital display -->
      <rect x="11" y="10" width="26" height="10" rx="2" fill="#1A237E"/>
      <text x="24" y="17.5" font-size="6" text-anchor="middle" fill="#82B1FF" font-weight="bold">50🧊/day</text>
      <!-- snowflake panel -->
      <rect x="39" y="10" width="6" height="10" rx="2" fill="#0D47A1"/>
      <text x="42" y="18" font-size="9" text-anchor="middle">❄️</text>
      <!-- three round gauges -->
      <circle cx="17" cy="36" r="6" fill="#263238" stroke="#546E7A" stroke-width="1"/>
      <circle cx="17" cy="36" r="4" fill="#0288D1" opacity="0.85"/>
      <line   x1="17" y1="32" x2="17" y2="36" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="28" cy="36" r="6" fill="#263238" stroke="#546E7A" stroke-width="1"/>
      <circle cx="28" cy="36" r="4" fill="#388E3C" opacity="0.85"/>
      <line   x1="28" y1="32" x2="29" y2="36" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="39" cy="36" r="6" fill="#263238" stroke="#546E7A" stroke-width="1"/>
      <circle cx="39" cy="36" r="4" fill="#D32F2F" opacity="0.85"/>
      <line   x1="39" y1="32" x2="41" y2="36" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/>
      <!-- side pipes -->
      <rect x="0"  y="16" width="7" height="5" rx="2" fill="#546E7A"/>
      <rect x="49" y="16" width="7" height="5" rx="2" fill="#546E7A"/>
      <!-- output tray -->
      <rect x="9"  y="46" width="38" height="8" rx="4" fill="#263238"/>
      <!-- three ice blocks in tray -->
      <rect x="11" y="47" width="10" height="6" rx="2" fill="#B3E5FC"/>
      <rect x="23" y="47" width="10" height="6" rx="2" fill="#B3E5FC"/>
      <rect x="35" y="47" width="10" height="6" rx="2" fill="#B3E5FC"/>
    </svg>`,
  };

  const u = UPGRADES.find(x => x.id === id);
  return svgs[id]
    || `<svg viewBox="0 0 52 52" width="48" height="48"><text x="26" y="36" font-size="30" text-anchor="middle">${u ? u.emoji : '🔧'}</text></svg>`;
}

// ── AD PURCHASE EFFECTS ───────────────────────────────────────────────────────
// Each effect runs once on purchase, then cleans itself up automatically.

function _ensureAdStyles() {
  if (document.getElementById('_adFxCss')) return;
  const s = document.createElement('style');
  s.id = '_adFxCss';
  s.textContent = `
    .adfx-layer{position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden;}

    /* Flyer: paper sheets drift down */
    .adfx-flyer{position:absolute;font-size:1.8rem;top:-60px;
      animation:adfxFall linear forwards;}
    @keyframes adfxFall{
      0%  {opacity:1;transform:rotate(0deg) translateY(0);}
      100%{opacity:0;transform:rotate(540deg) translateY(105vh);}
    }

    /* Radio: icon + expanding rings */
    .adfx-radio-icon{position:absolute;font-size:3.2rem;
      left:50%;top:38%;transform:translate(-50%,-50%);
      animation:adfxPop 2s ease forwards;}
    @keyframes adfxPop{
      0%  {transform:translate(-50%,-50%) scale(0);opacity:0;}
      18% {transform:translate(-50%,-50%) scale(1.3);opacity:1;}
      30% {transform:translate(-50%,-50%) scale(1);opacity:1;}
      82% {transform:translate(-50%,-50%) scale(1);opacity:1;}
      100%{transform:translate(-50%,-50%) scale(0);opacity:0;}
    }
    .adfx-ring{position:absolute;border-radius:50%;
      border:3px solid rgba(255,200,50,0.7);
      left:50%;top:38%;width:70px;height:70px;
      margin-left:-35px;margin-top:-35px;
      animation:adfxRing 1.4s ease-out forwards;}
    @keyframes adfxRing{
      0%  {transform:scale(0);opacity:0.9;}
      100%{transform:scale(5);opacity:0;}
    }

    /* Newspaper: flies in from right, pauses, exits left */
    .adfx-news{position:absolute;top:22%;left:50%;
      transform:translateX(120vw) rotate(12deg);
      font-size:4rem;text-align:center;
      animation:adfxNews 2.4s cubic-bezier(.22,1,.36,1) forwards;}
    @keyframes adfxNews{
      0%  {transform:translateX(120vw) rotate(12deg);opacity:0;}
      22% {transform:translateX(-50%)  rotate(-3deg);opacity:1;}
      68% {transform:translateX(-50%)  rotate(-3deg);opacity:1;}
      100%{transform:translateX(-160vw) rotate(-15deg);opacity:0;}
    }
    .adfx-news-label{display:block;font-size:0.72rem;font-weight:700;
      background:#fff;color:#222;border-radius:4px;
      padding:2px 8px;margin-top:-6px;white-space:nowrap;}

    /* TV: drops from top, flashes, bounces back up */
    .adfx-tv{position:absolute;top:26%;left:50%;
      transform:translate(-50%,-200%) scale(0.4);font-size:4.5rem;
      text-align:center;
      animation:adfxTV 2.4s cubic-bezier(.34,1.56,.64,1) forwards;}
    @keyframes adfxTV{
      0%  {transform:translate(-50%,-200%) scale(0.4);opacity:0;}
      25% {transform:translate(-50%,0)     scale(1.1);opacity:1;}
      35% {transform:translate(-50%,0)     scale(1);  opacity:1;}
      75% {transform:translate(-50%,0)     scale(1);  opacity:1;}
      100%{transform:translate(-50%,-200%) scale(0.4);opacity:0;}
    }
    .adfx-tv-flash{position:absolute;inset:0;
      animation:adfxFlash 0.35s ease-in-out 4 0.4s;}
    @keyframes adfxFlash{
      0%,100%{background:transparent;}
      50%    {background:rgba(255,255,200,0.22);}
    }
    .adfx-tv-label{display:block;font-size:0.72rem;font-weight:700;
      background:#e53935;color:#fff;border-radius:4px;
      padding:2px 8px;margin-top:-4px;white-space:nowrap;}

    /* Blimp: floats right-to-left across the top */
    .adfx-blimp{position:absolute;top:8%;
      display:flex;align-items:center;gap:6px;
      animation:adfxBlimp 3.2s linear forwards;}
    @keyframes adfxBlimp{
      0%  {left:110%;opacity:0;}
      8%  {opacity:1;}
      92% {opacity:1;}
      100%{left:-320px;opacity:0;}
    }
    .adfx-blimp-icon{font-size:3.2rem;line-height:1;}
    .adfx-blimp-banner{font-size:0.72rem;font-weight:700;
      background:#FFD700;color:#1A1A2E;border-radius:4px;
      padding:3px 10px;white-space:nowrap;
      box-shadow:0 2px 6px rgba(0,0,0,0.2);}
  `;
  document.head.appendChild(s);
}

function _playAdEffect(adId) {
  _ensureAdStyles();
  const layer = document.createElement('div');
  layer.className = 'adfx-layer';
  document.body.appendChild(layer);

  let lifetime = 2800;

  if (adId === 'ad_flyer') {
    lifetime = 3400;
    for (let i = 0; i < 12; i++) {
      const f = document.createElement('div');
      f.className = 'adfx-flyer';
      f.textContent = '📄';
      f.style.left  = (3 + Math.random() * 94) + 'vw';
      f.style.animationDelay    = (Math.random() * 0.9) + 's';
      f.style.animationDuration = (1.6 + Math.random() * 0.8) + 's';
      layer.appendChild(f);
    }

  } else if (adId === 'ad_radio') {
    lifetime = 2600;
    const icon = document.createElement('div');
    icon.className = 'adfx-radio-icon';
    icon.textContent = '📻';
    layer.appendChild(icon);
    for (let i = 0; i < 4; i++) {
      const r = document.createElement('div');
      r.className = 'adfx-ring';
      r.style.animationDelay = (i * 0.28) + 's';
      layer.appendChild(r);
    }

  } else if (adId === 'ad_newspaper') {
    lifetime = 2600;
    const el = document.createElement('div');
    el.className = 'adfx-news';
    el.innerHTML = '📰<span class="adfx-news-label">LEMON EMPIRE — TODAY\'S SPECIAL!</span>';
    layer.appendChild(el);

  } else if (adId === 'ad_tv') {
    lifetime = 2800;
    const el = document.createElement('div');
    el.className = 'adfx-tv';
    el.innerHTML = '📺<span class="adfx-tv-label">NOW ON AIR!</span>';
    layer.appendChild(el);
    const flash = document.createElement('div');
    flash.className = 'adfx-tv-flash';
    layer.appendChild(flash);

  } else if (adId === 'ad_blimp') {
    lifetime = 3600;
    const el = document.createElement('div');
    el.className = 'adfx-blimp';
    el.innerHTML = '<span class="adfx-blimp-icon">🎈</span><span class="adfx-blimp-banner">🍋 LEMON EMPIRE LEMONADE!</span>';
    layer.appendChild(el);
  }

  setTimeout(() => layer.remove(), lifetime);
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
      // During result phase, all nav locked — redirect to result screen
      if (S.phase === 'result') {
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

  // Recipe + price steppers — click delegation on #day-controls (menu-card is inside it)
  document.getElementById('day-controls').addEventListener('click', e => {
    const btn = e.target.closest('.step-btn');
    if (!btn) return;
    const key  = btn.dataset.key;
    const dir  = parseFloat(btn.dataset.dir);
    const step = parseFloat(btn.dataset.step);
    const min  = parseFloat(btn.dataset.min);
    const max  = parseFloat(btn.dataset.max);
    const slot = (S.menu || [])[_activeMenuTab];
    if (!slot) return;

    if (key === 'price') {
      const next = Math.round(((slot.price || 1.75) + dir * step) * 100) / 100;
      if (next < min || next > max) return;
      slot.price = next;
      const valEl = document.getElementById(`sv-price-${_activeMenuTab}`);
      if (valEl) valEl.textContent = fmt(next);
      const ptag = document.getElementById('day-ptag');
      if (ptag) { const ps = (S.menu||[]).find(m=>m&&m.active)||(S.menu||[])[0]; if(ps) ptag.textContent = fmt(ps.price); }
    } else {
      const cur  = slot.recipe[key] !== undefined ? slot.recipe[key] : 0;
      const next = Math.round((cur + dir * step) * 10) / 10;
      if (next < min || next > max) return;
      slot.recipe[key] = next;
      const valEl = document.getElementById(`sv-${key}-${_activeMenuTab}`);
      if (valEl) valEl.textContent = next;
    }
    updateCostPerCup();
    renderDayHud();
  });

  // Menu tab bar — switch active slot
  document.getElementById('menu-tab-bar').addEventListener('click', e => {
    const btn = e.target.closest('[data-menu-tab]');
    if (!btn) return;
    SFX.tap();
    _activeMenuTab = parseInt(btn.dataset.menuTab);
    renderMenuTabs();
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

  // Market — add bundle button (S/M/L)
  document.getElementById('market-scroll-area').addEventListener('click', e => {
    // Add button
    const addBtn = e.target.closest('[data-mkt-add]');
    if (addBtn) {
      SFX.tap();
      const [key, idxStr] = addBtn.dataset.mktAdd.split(':');
      const bIdx  = parseInt(idxStr);
      const bundle = MARKET_BUNDLES[key] && MARKET_BUNDLES[key][bIdx];
      if (!bundle) return;
      const ck = _cartKey('base', key, bIdx);
      if (_marketCart[ck]) {
        _marketCart[ck].bundles++;
      } else {
        _marketCart[ck] = { bundles: 1, itemsPerBundle: bundle.qty, unitCost: getBundleCost(key, bundle.qty), key };
      }
      renderMarket();
      return;
    }
    // Clear ingredient from cart
    const clearBtn = e.target.closest('[data-mkt-clear]');
    if (clearBtn) {
      SFX.tap();
      const key = clearBtn.dataset.mktClear;
      const bundles = MARKET_BUNDLES[key] || [];
      bundles.forEach((_, idx) => delete _marketCart[_cartKey('base', key, idx)]);
      renderMarket();
      return;
    }
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
    if (standBtn) { SFX.tap(); purchaseStandUpgrade(standBtn.dataset.stand, parseInt(standBtn.dataset.standtier)); return; }
    const variantBtn = e.target.closest('[data-buy-variant]');
    if (variantBtn) { SFX.tap(); buyMenuVariant(variantBtn.dataset.buyVariant); return; }
    // slot-unlock removed — variants always add directly to menu
  });

  // Cart checkout button
  document.getElementById('cart-buy-btn').addEventListener('click', () => {
    SFX.tap();
    checkoutCart();
  });

  // Modal backdrop close
  document.getElementById('modal-settings').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      document.getElementById('modal-settings').classList.add('hidden');
    }
  });
}


