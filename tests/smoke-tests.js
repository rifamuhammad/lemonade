'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

function approxEqual(actual, expected, message, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: expected ${expected}, got ${actual}`);
}

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

function createElementStub() {
  return {
    style: {},
    dataset: {},
    className: '',
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    checked: false,
    classList: {
      add() {},
      remove() {},
      toggle() {},
    },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    querySelector() {
      return createElementStub();
    },
    querySelectorAll() {
      return [];
    },
    getContext() {
      return {};
    },
  };
}

function createHarness() {
  const storage = createStorage();
  const screenCalls = [];
  const elements = new Map();
  const math = Object.create(Math);
  math.random = Math.random;

  const context = {
    console,
    Math: math,
    Date,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    localStorage: storage,
    navigator: { serviceWorker: { register() { return Promise.resolve(); } } },
    location: { protocol: 'http:', hostname: 'localhost' },
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, createElementStub());
        return elements.get(id);
      },
      addEventListener() {},
      querySelectorAll() {
        return [];
      },
      createElement() {
        return createElementStub();
      },
    },
    requestAnimationFrame(fn) {
      if (typeof fn === 'function') fn(0);
      return 1;
    },
    cancelAnimationFrame() {},
    setTimeout(fn) {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout() {},
    setInterval() {
      return 1;
    },
    clearInterval() {},
    Blob: function Blob() {},
    URL: { createObjectURL() { return 'blob:test'; } },
    Chart: function Chart() {},
    showScreen(screen) {
      screenCalls.push(screen);
    },
    updateTopBar() {},
    initEvents() {},
    musicStart() {},
    musicStop() {},
    floatMusicNote() {},
    addRipple() {},
    showErrorToast(message) {
      throw new Error(message);
    },
    showAchievementToast() {},
    renderShop() {},
    renderMarket() {},
    renderDay() {},
    renderStats() {},
    renderAchievements() {},
    renderSelling() {},
    renderResult() {},
    spawnConfetti() {},
    animateCoinCounter() {},
    SFX: {
      soldOut() {},
      poorReview() {},
      coin() {},
      unlock() {},
      hire() {},
      achievement() {},
    },
    _music: { on: false },
  };
  context.window = context;

  vm.createContext(context);

  const bundle = [
    fs.readFileSync(path.join(ROOT, 'js', 'game-state.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'js', 'game-economy.js'), 'utf8'),
    `
    globalThis.__hooks = {
      defaultState,
      refreshMarketPrices,
      calcTasteScore,
      calcDemand,
      calcIngredientCost,
      simulateSelling,
      applyDayResults,
      getMaintenanceCost,
      saveState,
      loadFromSlot,
      getSlotInfo,
      resumeLoadedGame,
      initNewGame,
      getBundleCost,
      getLocationTasteProfile,
      INGREDIENT_BASE,
      setState(next) { S = next; },
      getState() { return S; },
      getStorage() { return localStorage; }
    };
    `,
  ].join('\n\n');

  vm.runInContext(bundle, context, { filename: 'game-test-bundle.js' });

  return { context, hooks: context.__hooks, screenCalls };
}

function setRandomSequence(context, values) {
  let index = 0;
  const last = values.length ? values[values.length - 1] : 0.5;
  context.Math.random = () => {
    const value = index < values.length ? values[index] : last;
    index += 1;
    return value;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function testDemandAndProfitHarness() {
  const harness = createHarness();
  const { hooks } = harness;

  const strongState = hooks.defaultState();
  strongState.currentLocation = 'beach';
  strongState.currentWeather = 'hot';
  strongState.price = 2.5;
  strongState.recipe = { cupsToMake: 40, lemonsPerCup: 3, sugarPerCup: 2, icePerCup: 3 };
  strongState.locationRep.beach = 72;
  strongState.upgrades = { canopy: true, register: true, dispenser: true, neon: true };
  hooks.setState(strongState);

  const strongTaste = hooks.calcTasteScore(strongState.recipe);
  const strongDemand = hooks.calcDemand(strongState.recipe, strongState.price, strongTaste);
  const strongResult = hooks.simulateSelling();

  const weakState = hooks.defaultState();
  weakState.currentLocation = 'sidewalk';
  weakState.currentWeather = 'rainy';
  weakState.price = 6;
  weakState.recipe = { cupsToMake: 40, lemonsPerCup: 1, sugarPerCup: 4, icePerCup: 3 };
  weakState.locationRep.sidewalk = 40;
  hooks.setState(weakState);

  const weakTaste = hooks.calcTasteScore(weakState.recipe);
  const weakDemand = hooks.calcDemand(weakState.recipe, weakState.price, weakTaste);

  assert.ok(strongTaste > weakTaste, 'A location-tuned hot-day recipe should taste better than an overpriced rainy-day recipe');
  assert.ok(strongDemand > weakDemand, 'Strong demand scenario should outperform weak demand scenario');
  approxEqual(
    strongResult.profit,
    strongResult.revenue - strongResult.cost - strongResult.rent,
    'simulateSelling profit should match revenue minus cost and rent'
  );

  const coinsBefore = strongState.coins;
  hooks.setState(strongState);
  hooks.applyDayResults(strongResult);
  approxEqual(
    hooks.getState().coins,
    coinsBefore + strongResult.revenue - strongResult.rent,
    'applyDayResults should deduct rent from coin gains'
  );
}

function testDynamicMarketSignals() {
  const harness = createHarness();
  const { hooks, context } = harness;
  const state = hooks.defaultState();
  state.currentWeather = 'hot';
  state.activeEvent = { id: 'heatwave' };
  state.pendingEvent = { id: 'festival' };
  hooks.setState(state);

  setRandomSequence(context, [0.9, 0.5, 0.5, 0.5, 0.5, 0.5]);
  hooks.refreshMarketPrices();

  const nextState = hooks.getState();
  assert.ok(nextState.marketNews.length >= 2, 'Dynamic market should publish at least a couple of news signals on a hot event day');
  assert.ok(nextState.marketForecast.length >= 1, 'Dynamic market should generate a forward-looking forecast');
  assert.ok(nextState.marketPrices.ice > hooks.INGREDIENT_BASE.ice, 'Hot-event market should push ice above its base price');
  assert.ok(nextState.marketPrices.cups > hooks.INGREDIENT_BASE.cups, 'Hot-event market should also pressure cup prices');
}

function testSaveAndLoadRoundTrip() {
  const harness = createHarness();
  const { hooks } = harness;

  const original = hooks.defaultState();
  original.day = 7;
  original.coins = 182.25;
  original.phase = 'result';
  original.inventory = { lemons: 18, sugar: 24, cups: 42, ice: 60 };
  original.marketNews = [{ ingredient: 'lemons', direction: 'up', text: 'Wholesaler delay', impact: 0.18 }];
  original.marketForecast = [{ ingredient: 'ice', trend: 'up', text: 'Tighter market tomorrow' }];
  original.dayResult = { profit: 12.75, cupsSold: 11 };
  hooks.setState(original);
  hooks.saveState();

  const blank = hooks.defaultState();
  blank.day = 1;
  blank.coins = 50;
  hooks.setState(blank);
  hooks.loadFromSlot(0);

  const loaded = hooks.getState();
  assert.equal(loaded.day, 7, 'Load should restore the saved day');
  approxEqual(loaded.coins, 182.25, 'Load should restore coins exactly');
  assert.equal(loaded.phase, 'result', 'Load should restore the saved phase');
  assert.deepEqual(clone(loaded.inventory), { lemons: 18, sugar: 24, cups: 42, ice: 60 }, 'Load should restore inventory');
  assert.deepEqual(clone(loaded.dayResult), { profit: 12.75, cupsSold: 11 }, 'Load should restore result data');
  assert.equal(loaded.marketNews.length, 1, 'Load should restore market news');
  assert.equal(loaded.marketForecast.length, 1, 'Load should restore market forecast');
}

function testResultResumeFlow() {
  const harness = createHarness();
  const { hooks, screenCalls } = harness;

  const resultState = hooks.defaultState();
  resultState.phase = 'result';
  resultState.dayResult = { profit: 9.5 };
  hooks.setState(resultState);
  hooks.resumeLoadedGame();

  assert.equal(screenCalls.at(-1), 'result', 'Reloading a saved result should stay on the result screen');
  assert.equal(hooks.getState().phase, 'result', 'Reloading a saved result should keep the result phase intact');

  screenCalls.length = 0;
  const sellingState = hooks.defaultState();
  sellingState.phase = 'selling';
  hooks.setState(sellingState);
  hooks.resumeLoadedGame();

  assert.equal(screenCalls.at(-1), 'day', 'An in-progress live selling state should safely fall back to the day screen');
  assert.equal(hooks.getState().phase, 'day', 'Fallback from live selling should reset the phase to day');
}

const tests = [
  ['Demand and profit sanity', testDemandAndProfitHarness],
  ['Dynamic market signals', testDynamicMarketSignals],
  ['Save/load round trip', testSaveAndLoadRoundTrip],
  ['Result resume flow', testResultResumeFlow],
];

let passed = 0;
for (const [name, fn] of tests) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

console.log(`\n${passed}/${tests.length} smoke tests passed.`);
