'use strict';

// I. PWA
// -----------------------------------------------

function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  // On HTTPS (GitHub Pages / hosted): use real sw.js for proper caching + installability
  // On file:// (local dev): fall back to blob SW
  if (location.protocol === 'https:' || location.hostname === 'localhost') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  } else {
    // Blob fallback for offline file:// usage
    const swCode = `const CACHE='lemon-empire-v4';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>new Response('',{status:503})));});`;
    try {
      const swUrl = URL.createObjectURL(new Blob([swCode],{type:'application/javascript'}));
      navigator.serviceWorker.register(swUrl).catch(()=>{});
    } catch(e) {}
  }
}

// -----------------------------------------------
// J. INIT
// -----------------------------------------------

function init() {
  loadState();       // migrate legacy save if needed
  S = defaultState(); // start with default; loadFromSlot sets real data
  registerPWA();
  initEvents();
  document.getElementById('sound-toggle').checked = S.soundEnabled;
  updateTopBar();
  showScreen('day'); // pre-render day screen behind menu
  S.phase = 'day';
  showMainMenu();    // always show menu on launch

  // Music toggle button setup
  const musicBtn = document.getElementById('music-toggle-btn');
  if (musicBtn) {
    const syncMusicBtn = () => {
      musicBtn.textContent = S.musicEnabled ? 'ON' : 'OFF';
      musicBtn.classList.toggle('off', !S.musicEnabled);
    };
    syncMusicBtn();
    musicBtn.addEventListener('click', () => {
      S.musicEnabled = !S.musicEnabled;
      if (S.musicEnabled) musicStart();
      else musicStop();
      syncMusicBtn();
      saveState();
    });
  }

  // Ripple on primary action buttons
  ['open-stand-btn','next-day-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', addRipple);
  });

  // Periodic music note floaters during selling
  setInterval(() => {
    if (S.phase === 'selling' && _music.on) floatMusicNote();
  }, 3200);
}

document.addEventListener('DOMContentLoaded', init);
