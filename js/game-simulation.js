'use strict';

// â”€â”€ SELLING SCREEN â”€â”€
function openStand() {
  SFX.dayOpen();
  musicStart(); // begin background music when stand opens
  const r = S.recipe;

  // Auto-calculate cups from available inventory (respect upgrade multipliers)
  const _eff = upgradeEffects();
  const effLemons = r.lemonsPerCup * _eff.lemonMult;
  const effIce    = r.icePerCup    * _eff.iceMult;
  const maxLemons = effLemons > 0 ? Math.floor(S.inventory.lemons / effLemons) : 9999;
  const maxSugar  = r.sugarPerCup > 0 ? Math.floor(S.inventory.sugar  / r.sugarPerCup) : 9999;
  const maxIce    = effIce    > 0 ? Math.floor(S.inventory.ice    / effIce)    : 9999;
  const maxCups   = Math.min(maxLemons, maxSugar, maxIce, S.inventory.cups);
  S.recipe.cupsToMake = Math.max(0, maxCups);

  // Warn but never block
  if (maxCups <= 0) {
    showErrorToast('⚠️ Empty inventory — you\'ll open but sell nothing! Visit Market 🛒 first!');
  } else if (maxCups < 5) {
    showErrorToast(`⚠️ Low stock — only ${maxCups} cup${maxCups !== 1 ? 's' : ''} possible today`);
  }

  const result = simulateSelling();
  S.phase = 'selling';
  showScreen('selling');
  renderSelling(result);
}

// â”€â”€ SCENE SETUP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CUSTOMER_PALETTES = [
  { skin:'#FDBCB4', hair:'#8B4513', shirt:'#E53935', pants:'#1565C0', shoes:'#212121' },
  { skin:'#F4C89A', hair:'#212121', shirt:'#7B1FA2', pants:'#37474F', shoes:'#3E2723' },
  { skin:'#FDBCB4', hair:'#F9A825', shirt:'#0288D1', pants:'#4E342E', shoes:'#212121' },
  { skin:'#C68642', hair:'#212121', shirt:'#2E7D32', pants:'#1A237E', shoes:'#BF360C' },
  { skin:'#FDBCB4', hair:'#E91E63', shirt:'#F57C00', pants:'#37474F', shoes:'#1A1A2E' },
  { skin:'#8D5524', hair:'#1A1A1A', shirt:'#C62828', pants:'#263238', shoes:'#4E342E' },
  { skin:'#FDBCB4', hair:'#795548', shirt:'#00695C', pants:'#37474F', shoes:'#212121' },
  { skin:'#FFCD94', hair:'#D32F2F', shirt:'#5C6BC0', pants:'#4A148C', shoes:'#212121' },
];

// ── EQUIPMENT SVG SNIPPETS (reusable pieces, positioned by caller) ──────────────
// Each _eq* function takes (x,y) as the top-left anchor and returns SVG markup.

// Citrus juicer: cone on collection tray + optional power bolt
function _eqJuicer(x, y, powered) {
  const rc = powered ? '#E65100' : '#BF360C';
  const cc = powered ? '#FF8C00' : '#FF5722';
  return `
    <rect x="${x}" y="${y+11}" width="18" height="8"  rx="2.5" fill="${rc}"/>
    <ellipse cx="${x+9}" cy="${y+11}" rx="8" ry="3.5" fill="${cc}"/>
    <polygon points="${x+9},${y} ${x+1},${y+11} ${x+17},${y+11}" fill="#FFA726"/>
    <ellipse cx="${x+9}" cy="${y}" rx="5.5" ry="3" fill="#FFF176"/>
    <rect x="${x+1}" y="${y+16}" width="16" height="4" rx="1.5" fill="#4E342E"/>
    ${powered ? `<polygon points="${x+14},${y-2} ${x+11},${y+6} ${x+13},${y+6} ${x+10},${y+14} ${x+17},${y+5} ${x+14},${y+5}" fill="#FFD740" opacity="0.9"/>` : ''}`;
}

// EZserve cash register: body + LCD screen + key row + drawer
function _eqRegister(x, y) {
  return `
    <rect x="${x}" y="${y}" width="22" height="17" rx="2.5" fill="#37474F"/>
    <rect x="${x+2}" y="${y+1.5}" width="18" height="8" rx="1.5" fill="#00ACC1" opacity="0.85"/>
    <rect x="${x+4}" y="${y+3.5}" width="14" height="4" rx="1" fill="#E0F7FA" opacity="0.45"/>
    <rect x="${x+2}" y="${y+11}" width="18" height="3" rx="1" fill="#1C313A"/>
    <rect x="${x+4}" y="${y+11.5}" width="10" height="2" rx="0.8" fill="#546E7A"/>
    <rect x="${x}" y="${y+14}" width="22" height="3" rx="1.5" fill="#263238"/>
    <rect x="${x+5}" y="${y+14.5}" width="10" height="2" rx="0.8" fill="#546E7A"/>`;
}

// Take2 lemonade dispenser: cylinder body + yellow fill + tap + buttons
function _eqDispenser(x, y) {
  return `
    <rect x="${x}" y="${y}" width="18" height="22" rx="4" fill="#455A64"/>
    <rect x="${x+2}" y="${y+2}" width="14" height="13" rx="3" fill="#B3E5FC" opacity="0.9"/>
    <rect x="${x+2}" y="${y+9}" width="14" height="6"  rx="2" fill="#FFD740" opacity="0.8"/>
    <circle cx="${x+5}" cy="${y+6}" r="1.5" fill="#FFF" opacity="0.5"/>
    <circle cx="${x+9}" cy="${y+5}" r="1"   fill="#FFF" opacity="0.5"/>
    <rect x="${x+2}" y="${y+16}" width="14" height="4" rx="2" fill="#37474F"/>
    <circle cx="${x+6}" cy="${y+18}" r="1.8" fill="#4CAF50"/>
    <circle cx="${x+12}" cy="${y+18}" r="1.8" fill="#F44336"/>
    <rect x="${x+5}" y="${y+20}" width="8" height="2.5" rx="1.2" fill="#00BCD4"/>`;
}

// Mr. Fridge: two-door unit with snowflake top and handle
function _eqFridge(x, y) {
  return `
    <rect x="${x}" y="${y}" width="11" height="32" rx="3" fill="#4DD0E1"/>
    <rect x="${x+1.5}" y="${y+1.5}" width="8" height="13" rx="2" fill="#E0F7FA"/>
    <rect x="${x+1.5}" y="${y+16}" width="8" height="13" rx="2" fill="#E0F7FA"/>
    <line x1="${x+2}" y1="${y+14.5}" x2="${x+9}" y2="${y+14.5}" stroke="#4DD0E1" stroke-width="1.5"/>
    <rect x="${x+8.5}" y="${y+4}"  width="2" height="6"  rx="1" fill="#80DEEA"/>
    <rect x="${x+8.5}" y="${y+18}" width="2" height="6"  rx="1" fill="#80DEEA"/>
    <circle cx="${x+2.5}" cy="${y+28}" r="1.5" fill="#29B6F6" opacity="0.9"/>`;
}

// Ice-O-Matic: blue machine with ice cube window + output tray
function _eqIceomatic(x, y) {
  return `
    <rect x="${x}" y="${y}" width="15" height="20" rx="3" fill="#0288D1"/>
    <rect x="${x+2}" y="${y+2}" width="11" height="10" rx="2" fill="#E3F2FD" opacity="0.9"/>
    <rect x="${x+3}" y="${y+3}" width="4" height="5" rx="1" fill="#B3E5FC" stroke="#64B5F6" stroke-width="0.6"/>
    <rect x="${x+8}" y="${y+3}" width="4" height="5" rx="1" fill="#B3E5FC" stroke="#64B5F6" stroke-width="0.6"/>
    <rect x="${x+2}" y="${y+13}" width="11" height="3.5" rx="1.5" fill="#01579B"/>
    <rect x="${x+3}" y="${y+16}" width="9"  height="3"   rx="1" fill="#B3E5FC" opacity="0.75"/>`;
}

// High-Output Auto Ice Maker: industrial cabinet + gauges + ice tray
function _eqIcemaker(x, y) {
  return `
    <rect x="${x}" y="${y}" width="16" height="28" rx="3" fill="#01579B"/>
    <rect x="${x+2}" y="${y+2}" width="12" height="10" rx="2" fill="#0288D1"/>
    <rect x="${x+3}" y="${y+3}" width="10" height="5"  rx="1.5" fill="#1A237E" opacity="0.8"/>
    <rect x="${x+4}" y="${y+4}" width="8"  height="3"  rx="1" fill="#82B1FF" opacity="0.55"/>
    <circle cx="${x+5}"  cy="${y+15}" r="3" fill="#0D47A1" stroke="#42A5F5" stroke-width="1"/>
    <circle cx="${x+11}" cy="${y+15}" r="3" fill="#0D47A1" stroke="#4CAF50"  stroke-width="1"/>
    <line x1="${x+5}"  y1="${y+12}" x2="${x+5}"  y2="${y+15}" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="${x+11}" y1="${y+12}" x2="${x+12}" y2="${y+15}" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    <rect x="${x+2}" y="${y+20}" width="12" height="7" rx="1.5" fill="#B3E5FC" opacity="0.75"/>
    <rect x="${x+3}" y="${y+21}" width="4"  height="5" rx="1" fill="#E1F5FE"/>
    <rect x="${x+9}" y="${y+21}" width="4"  height="5" rx="1" fill="#E1F5FE"/>`;
}

// Speaker cabinet: box + woofer ring + tweeter
function _eqSpeaker(x, y) {
  return `
    <rect x="${x}" y="${y}" width="11" height="22" rx="2.5" fill="#1A1A2E"/>
    <rect x="${x+1}" y="${y+1}" width="9" height="20" rx="2" fill="#111827"/>
    <circle cx="${x+5.5}" cy="${y+9}"  r="4.5" fill="#212121"/>
    <circle cx="${x+5.5}" cy="${y+9}"  r="3"   fill="#2A2A3E"/>
    <circle cx="${x+5.5}" cy="${y+9}"  r="1.8" fill="#FF8C00" opacity="0.9"/>
    <circle cx="${x+5.5}" cy="${y+9}"  r="0.8" fill="#FFD740"/>
    <circle cx="${x+5.5}" cy="${y+17}" r="2.5" fill="#212121"/>
    <circle cx="${x+5.5}" cy="${y+17}" r="1.5" fill="#37474F"/>`;
}

// Neon strip pair (top + bottom) — takes full-width x1→x2 and two y positions
function _eqNeon(x1, x2, yTop, yBot) {
  const w = x2 - x1;
  return `
    <rect x="${x1}" y="${yTop}" width="${w}" height="3"   rx="1.5" fill="#FFD700" opacity="0.92"/>
    <rect x="${x1}" y="${yTop}" width="${w}" height="1.2" rx="0.6" fill="#FFF9C4" opacity="0.6"/>
    <rect x="${x1}" y="${yBot}" width="${w}" height="3"   rx="1.5" fill="#FF4081" opacity="0.88"/>
    <rect x="${x1}" y="${yBot}" width="${w}" height="1.2" rx="0.6" fill="#FCE4EC" opacity="0.5"/>`;
}

// Canopy shade panel — orange/white striped to match the awning
function _eqCanopyPanel(x, y, w) {
  const sw = Math.max(4, Math.round(w / 4));
  return `
    <rect x="${x}" y="${y}" width="${w}" height="11" rx="4" fill="#FF8C00" opacity="0.92"/>
    <rect x="${x+sw}"   y="${y}" width="${sw}" height="11" rx="0" fill="#FFF8E1" opacity="0.75"/>
    <rect x="${x+sw*3}" y="${y}" width="${sw}" height="11" rx="0" fill="#FFF8E1" opacity="0.75"/>
    <rect x="${x}" y="${y+8}" width="${w}" height="3" rx="1.5" fill="#E65100" opacity="0.5"/>
    <rect x="${x}" y="${y}" width="${w}" height="11" rx="4" fill="none" stroke="#E65100" stroke-width="0.8" opacity="0.55"/>`;
}

// ── Lady server SVG (drawn inside stand, behind counter) ─────────────────────
// cx = horizontal centre, counterY = y where counter top starts.
// Only upper body is drawn — lower body is "hidden" behind the counter.
function _eqLadyServer(cx, counterY) {
  const hy = counterY - 30; // head centre
  return `
    <!-- Apron / upper body (just above counter) -->
    <rect x="${cx-14}" y="${counterY-16}" width="28" height="20" rx="3" fill="#FF8C00"/>
    <rect x="${cx-8}"  y="${counterY-14}" width="16" height="13" rx="2" fill="white" opacity="0.75"/>
    <!-- Neck -->
    <rect x="${cx-4}" y="${hy+11}" width="8" height="10" rx="3" fill="#F4C89A"/>
    <!-- Head -->
    <ellipse cx="${cx}" cy="${hy}" rx="13" ry="13" fill="#F4C89A"/>
    <!-- Hair bun -->
    <ellipse cx="${cx}" cy="${hy-9}" rx="14" ry="7" fill="#5D4037"/>
    <circle  cx="${cx+10}" cy="${hy-6}" r="6" fill="#5D4037"/>
    <!-- Chef hat body -->
    <rect x="${cx-11}" y="${hy-24}" width="22" height="11" rx="2" fill="white" stroke="#E0E0E0" stroke-width="0.8"/>
    <!-- Chef hat top puff -->
    <ellipse cx="${cx}" cy="${hy-24}" rx="13" ry="6" fill="white" stroke="#E0E0E0" stroke-width="0.8"/>
    <!-- Hat band -->
    <rect x="${cx-11}" y="${hy-15}" width="22" height="3" rx="1" fill="#BDBDBD" opacity="0.55"/>
    <!-- Eyes (bright, friendly) -->
    <ellipse cx="${cx-5}" cy="${hy-1}" rx="2.2" ry="2.8" fill="white"/>
    <ellipse cx="${cx+5}" cy="${hy-1}" rx="2.2" ry="2.8" fill="white"/>
    <circle  cx="${cx-5}" cy="${hy-1}" r="1.6" fill="#2E4057"/>
    <circle  cx="${cx+5}" cy="${hy-1}" r="1.6" fill="#2E4057"/>
    <circle  cx="${cx-4.3}" cy="${hy-1.8}" r="0.6" fill="white"/>
    <circle  cx="${cx+5.7}" cy="${hy-1.8}" r="0.6" fill="white"/>
    <!-- Lashes (upper arc lines) -->
    <path d="M${cx-7},${hy-3.5} Q${cx-5},${hy-6} ${cx-3},${hy-3.5}" fill="none" stroke="#4E342E" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M${cx+3},${hy-3.5} Q${cx+5},${hy-6} ${cx+7},${hy-3.5}" fill="none" stroke="#4E342E" stroke-width="1.1" stroke-linecap="round"/>
    <!-- Smile -->
    <path d="M${cx-5},${hy+5.5} Q${cx},${hy+10} ${cx+5},${hy+5.5}" fill="none" stroke="#D32F2F" stroke-width="1.6" stroke-linecap="round"/>
    <!-- Rosy cheeks -->
    <ellipse cx="${cx-9}" cy="${hy+3}" rx="4.5" ry="3.5" fill="#FFCDD2" opacity="0.6"/>
    <ellipse cx="${cx+9}" cy="${hy+3}" rx="4.5" ry="3.5" fill="#FFCDD2" opacity="0.6"/>
    <!-- Hands resting on counter -->
    <ellipse cx="${cx-19}" cy="${counterY+1}" rx="6" ry="4" fill="#F4C89A"/>
    <ellipse cx="${cx+19}" cy="${counterY+1}" rx="6" ry="4" fill="#F4C89A"/>`;
}

// ── External staff: full-body illustrated SVGs ────────────────────────────────
function _svgClown() {
  return `<svg viewBox="0 0 54 84" width="38" height="60" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
    <!-- Oversized shoes -->
    <ellipse cx="17" cy="80" rx="14" ry="5" fill="#FF5722"/>
    <ellipse cx="37" cy="80" rx="14" ry="5" fill="#FF5722"/>
    <!-- Legs -->
    <rect x="12" y="60" width="11" height="20" rx="5" fill="#E91E63"/>
    <rect x="31" y="60" width="11" height="20" rx="5" fill="#3F51B5"/>
    <!-- Suit body -->
    <rect x="9" y="34" width="36" height="30" rx="6" fill="#E91E63"/>
    <!-- Diamond suit pattern -->
    <polygon points="27,34 35,47 27,60 19,47" fill="#FFD700" opacity="0.88"/>
    <!-- Bow tie -->
    <polygon points="15,41 24,47 15,53" fill="#4CAF50"/>
    <polygon points="39,41 30,47 39,53" fill="#4CAF50"/>
    <circle cx="27" cy="47" r="3.5" fill="#FFEB3B"/>
    <!-- Left arm waving up -->
    <rect x="-2" y="36" width="13" height="7" rx="3.5" fill="#FFD700" transform="rotate(-35,5,39)"/>
    <ellipse cx="0"  cy="33" rx="5" ry="4.5" fill="#FDBCB4" transform="rotate(-35,5,39)"/>
    <!-- Right arm waving up -->
    <rect x="43" y="36" width="13" height="7" rx="3.5" fill="#3F51B5" transform="rotate(35,49,39)"/>
    <ellipse cx="54" cy="33" rx="5" ry="4.5" fill="#FDBCB4" transform="rotate(35,49,39)"/>
    <!-- Neck -->
    <rect x="24" y="27" width="6" height="9" rx="3" fill="#FDBCB4"/>
    <!-- Head -->
    <ellipse cx="27" cy="19" rx="14" ry="14" fill="#FDBCB4"/>
    <!-- Curly colourful hair (left, top, right) -->
    <ellipse cx="13" cy="14" rx="7" ry="9" fill="#E91E63"/>
    <ellipse cx="27" cy="7"  rx="8" ry="7" fill="#FFEB3B"/>
    <ellipse cx="41" cy="14" rx="7" ry="9" fill="#4CAF50"/>
    <!-- Pointy hat -->
    <polygon points="27,0 19,14 35,14" fill="#7B1FA2"/>
    <ellipse cx="27" cy="14" rx="9" ry="3.5" fill="#9C27B0"/>
    <!-- Star on hat -->
    <polygon points="27,3 28.5,7 32,7 29.5,9.5 30.5,13 27,11 23.5,13 24.5,9.5 22,7 25.5,7" fill="#FFD700" opacity="0.9"/>
    <!-- Eyes (big circles) -->
    <circle cx="22" cy="19" r="3.5" fill="white"/>
    <circle cx="32" cy="19" r="3.5" fill="white"/>
    <circle cx="22" cy="19" r="2"   fill="#1565C0"/>
    <circle cx="32" cy="19" r="2"   fill="#1565C0"/>
    <circle cx="22.8" cy="18.2" r="0.7" fill="white"/>
    <circle cx="32.8" cy="18.2" r="0.7" fill="white"/>
    <!-- Red round nose -->
    <circle cx="27" cy="24" r="4.5" fill="#F44336"/>
    <circle cx="25.5" cy="23" r="1.5" fill="#EF9A9A" opacity="0.6"/>
    <!-- Big smile -->
    <path d="M19,29 Q27,37 35,29" fill="none" stroke="#B71C1C" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function _svgMusician() {
  return `<svg viewBox="0 0 58 84" width="40" height="58" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
    <!-- Shoes -->
    <ellipse cx="19" cy="80" rx="10" ry="5" fill="#212121"/>
    <ellipse cx="36" cy="80" rx="10" ry="5" fill="#212121"/>
    <!-- Legs (dark jeans) -->
    <rect x="14" y="58" width="11" height="23" rx="5" fill="#1A237E"/>
    <rect x="33" y="58" width="11" height="23" rx="5" fill="#1A237E"/>
    <!-- Body — dark jacket -->
    <rect x="11" y="31" width="36" height="31" rx="5" fill="#37474F"/>
    <!-- Shirt / collar accent -->
    <rect x="23" y="31" width="12" height="10" rx="2" fill="#ECEFF1" opacity="0.6"/>
    <!-- Orange tie -->
    <polygon points="29,31 26,38 29,37 32,38" fill="#F57C00"/>
    <!-- Guitar body (left, held low) -->
    <ellipse cx="13" cy="54" rx="10" ry="13" fill="#8D6E63"/>
    <ellipse cx="13" cy="54" rx="10" ry="13" fill="none" stroke="#6D4C41" stroke-width="1.2"/>
    <circle  cx="13" cy="54" r="4" fill="#5D4037"/>
    <circle  cx="13" cy="54" r="2" fill="none" stroke="#4E342E" stroke-width="0.8"/>
    <!-- Guitar neck -->
    <rect x="10" y="27" width="6" height="30" rx="3" fill="#A1887F"/>
    <!-- Guitar strings -->
    <line x1="12" y1="29" x2="12" y2="56" stroke="#E0E0E0" stroke-width="0.7" opacity="0.85"/>
    <line x1="14" y1="29" x2="14" y2="56" stroke="#E0E0E0" stroke-width="0.7" opacity="0.85"/>
    <line x1="16" y1="29" x2="16" y2="56" stroke="#E0E0E0" stroke-width="0.7" opacity="0.85"/>
    <!-- Tuning pegs -->
    <circle cx="9"  cy="29" r="2" fill="#6D4C41"/>
    <circle cx="9"  cy="34" r="2" fill="#6D4C41"/>
    <circle cx="18" cy="29" r="2" fill="#6D4C41"/>
    <circle cx="18" cy="34" r="2" fill="#6D4C41"/>
    <!-- Left arm on guitar neck -->
    <rect x="3" y="34" width="10" height="6" rx="3" fill="#37474F"/>
    <ellipse cx="3" cy="37" rx="4.5" ry="3.5" fill="#FDBCB4"/>
    <!-- Right arm strumming -->
    <rect x="47" y="42" width="13" height="6" rx="3" fill="#37474F" transform="rotate(20,47,45)"/>
    <ellipse cx="57" cy="47" rx="4.5" ry="3.5" fill="#FDBCB4" transform="rotate(20,47,45)"/>
    <!-- Head -->
    <ellipse cx="29" cy="17" rx="13" ry="13" fill="#FDBCB4"/>
    <!-- Hair — casual side sweep -->
    <ellipse cx="29" cy="8" rx="14" ry="7" fill="#212121"/>
    <path d="M16,14 Q22,7 35,8 Q42,13 44,18" fill="#212121"/>
    <!-- Eyes -->
    <ellipse cx="25" cy="17" rx="2.2" ry="2.8" fill="white"/>
    <ellipse cx="33" cy="17" rx="2.2" ry="2.8" fill="white"/>
    <circle  cx="25" cy="17" r="1.5" fill="#1A237E"/>
    <circle  cx="33" cy="17" r="1.5" fill="#1A237E"/>
    <circle  cx="25.7" cy="16.2" r="0.6" fill="white"/>
    <circle  cx="33.7" cy="16.2" r="0.6" fill="white"/>
    <!-- Smile -->
    <path d="M24,22 Q29,27 34,22" fill="none" stroke="#C62828" stroke-width="1.5" stroke-linecap="round"/>
    <!-- Floating music notes -->
    <text x="41" y="26" font-size="13" fill="#FFD700" opacity="0.92" font-family="sans-serif">♪</text>
    <text x="46" y="14" font-size="10" fill="#FF8C00" opacity="0.78" font-family="sans-serif">♫</text>
  </svg>`;
}

// ── Per-tier extras (correct coordinate space for each stand SVG) ─────────────

function _extrasDefault(u) {
  // Coordinate space: viewBox="0 0 138 158"
  // Counter area: y=104–158; sign: y=84–104; awning arc bottom: y=38
  const parts = [];

  // Lady server — rendered FIRST so equipment appears in front of her
  if ((S.hiredToday || {}).lady) {
    parts.push(_eqLadyServer(69, 104));
  }

  if (u.canopy) {
    // LEFT-SIDE shade for customer queue:
    // Horizontal arm from the main pole (x=68) extends to the left edge,
    // then fabric hangs down creating a side shelter.
    parts.push(`
      <rect x="4" y="35" width="64" height="4" rx="2" fill="#6D4C41"/>
      <rect x="4" y="37" width="28" height="52" rx="3" fill="#FF8C00" opacity="0.88"/>
      <rect x="4" y="37" width="7"  height="52" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="25" y="37" width="7" height="52" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="4" y="37" width="3"  height="52" rx="1.5" fill="#6D4C41"/>
      <rect x="4" y="87" width="28" height="3" rx="1.5" fill="#E65100" opacity="0.55"/>
    `);
  }
  if (u.neon) {
    // Neon glow along the TOP of the awning arc (clearly visible above everything)
    parts.push(`
      <path d="M4,38 Q70,2 134,38" fill="none" stroke="#FFD700" stroke-width="4" opacity="0.95" stroke-linecap="round"/>
      <path d="M4,38 Q70,2 134,38" fill="none" stroke="#FF4081" stroke-width="2" opacity="0.75" stroke-linecap="round" stroke-dasharray="7,5"/>
      <circle cx="4"   cy="38" r="3.5" fill="#FFD700" opacity="0.9"/>
      <circle cx="70"  cy="2"  r="3.5" fill="#FF4081" opacity="0.9"/>
      <circle cx="134" cy="38" r="3.5" fill="#FFD700" opacity="0.9"/>
    `);
  }
  if (u.soundsystem) {
    parts.push(_eqSpeaker(0, 47));
    parts.push(_eqSpeaker(127, 47));
  }
  if (u.fridge) {
    parts.push(_eqFridge(0, 95));
  }
  if (u.juicer || u.powerjuicer) {
    // Left counter zone (x=8–26, y=110–132)
    parts.push(_eqJuicer(8, 108, !!u.powerjuicer));
  }
  if (u.register) {
    // Right counter zone (x=108–130, y=110–128)
    parts.push(_eqRegister(108, 110));
  }
  if (u.dispenser) {
    // Center counter (x=57–75, y=108–130)
    parts.push(_eqDispenser(57, 108));
  }
  if (u.icemaker) {
    parts.push(_eqIcemaker(118, 100));
  } else if (u.iceomatic) {
    parts.push(_eqIceomatic(120, 104));
  }
  return parts.join('');
}

function _extrasClassic(u) {
  // Coordinate space: viewBox="0 0 160 168"
  // Roof peak y=10, gutter y=64, stand body y=67–168, counter top y=113
  const parts = [];

  // Lady server in the central serving window area
  if ((S.hiredToday || {}).lady) {
    parts.push(_eqLadyServer(80, 113));
  }

  if (u.canopy) {
    // LEFT-SIDE queue shade: arm from left edge along gutter, fabric hangs down
    parts.push(`
      <rect x="2" y="62" width="60" height="4" rx="2" fill="#5D4037"/>
      <rect x="2" y="64" width="28" height="50" rx="3" fill="#FF8C00" opacity="0.88"/>
      <rect x="2" y="64" width="7"  height="50" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="23" y="64" width="7" height="50" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="2" y="64" width="3"  height="50" rx="1.5" fill="#5D4037"/>
      <rect x="2" y="112" width="28" height="3" rx="1.5" fill="#E65100" opacity="0.55"/>
    `);
  }
  if (u.neon) {
    // Neon along the ROOF RIDGE (peak at y=10) and gutter line — clearly at the top
    parts.push(`
      <polygon points="0,62 80,10 160,62" fill="none" stroke="#FFD700" stroke-width="4" opacity="0.9"/>
      <polygon points="0,62 80,10 160,62" fill="none" stroke="#FF4081" stroke-width="2" opacity="0.65" stroke-dasharray="7,5"/>
      <circle cx="80"  cy="10" r="4" fill="#FFD700" opacity="0.9"/>
      <circle cx="0"   cy="62" r="3" fill="#FF4081" opacity="0.8"/>
      <circle cx="160" cy="62" r="3" fill="#FF4081" opacity="0.8"/>
    `);
  }
  if (u.soundsystem) {
    parts.push(_eqSpeaker(0,   62));
    parts.push(_eqSpeaker(149, 62));
  }
  if (u.fridge) {
    parts.push(_eqFridge(0, 100));
  }
  if (u.juicer || u.powerjuicer) {
    // Left counter zone x=8–26, y=120–140
    parts.push(_eqJuicer(8, 118, !!u.powerjuicer));
  }
  if (u.register) {
    // Right counter zone x=130–152, y=120–137
    parts.push(_eqRegister(130, 120));
  }
  if (u.dispenser) {
    // Center counter x=62–80, y=118–140
    parts.push(_eqDispenser(62, 118));
  }
  if (u.icemaker) {
    parts.push(_eqIcemaker(148, 92));
  } else if (u.iceomatic) {
    parts.push(_eqIceomatic(149, 96));
  }
  return parts.join('');
}

function _extrasLemon(u) {
  // Coordinate space: viewBox="0 0 148 168"
  // Lemon body: ellipse cx=74 cy=76 rx=64 ry=62 → left edge ≈x=10, bottom ≈y=138
  // Counter: y=132–168
  const parts = [];

  // Lady server — peeks through the lemon's serving window area
  if ((S.hiredToday || {}).lady) {
    parts.push(_eqLadyServer(74, 132));
  }

  if (u.canopy) {
    // LEFT-SIDE shade: arm from lemon body left side (x≈10, y=76),
    // fabric hangs down the left to protect the queue
    parts.push(`
      <rect x="4" y="74" width="6"  height="62" rx="3" fill="#F57F17"/>
      <rect x="0" y="76" width="10" height="52" rx="3" fill="#FF8C00" opacity="0.88"/>
      <rect x="0" y="76" width="3"  height="52" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="7" y="76" width="3"  height="52" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="0" y="126" width="10" height="3" rx="1.5" fill="#E65100" opacity="0.55"/>
    `);
  }
  if (u.neon) {
    // Neon glow along the TOP of the lemon ellipse outline
    parts.push(`
      <path d="M10,76 Q74,14 138,76" fill="none" stroke="#FFD700" stroke-width="4" opacity="0.9" stroke-linecap="round"/>
      <path d="M10,76 Q74,14 138,76" fill="none" stroke="#FF4081" stroke-width="2" opacity="0.65" stroke-linecap="round" stroke-dasharray="7,5"/>
      <circle cx="74"  cy="14" r="4" fill="#FFD700" opacity="0.9"/>
      <circle cx="10"  cy="76" r="3" fill="#FF4081" opacity="0.8"/>
      <circle cx="138" cy="76" r="3" fill="#FF4081" opacity="0.8"/>
    `);
  }
  if (u.soundsystem) {
    parts.push(_eqSpeaker(0,   68));
    parts.push(_eqSpeaker(137, 68));
  }
  if (u.fridge) {
    parts.push(_eqFridge(0, 124));
  }
  if (u.juicer || u.powerjuicer) {
    // Left counter zone x=10–28, y=138–158
    parts.push(_eqJuicer(10, 136, !!u.powerjuicer));
  }
  if (u.register) {
    // Right counter zone x=110–132, y=138–155
    parts.push(_eqRegister(110, 138));
  }
  if (u.dispenser) {
    // Center counter x=56–74, y=136–158
    parts.push(_eqDispenser(56, 136));
  }
  if (u.icemaker) {
    parts.push(_eqIcemaker(130, 128));
  } else if (u.iceomatic) {
    parts.push(_eqIceomatic(131, 132));
  }
  return parts.join('');
}

function _extrasCastle(u) {
  // Coordinate space: viewBox="0 0 168 178"
  // Left tower: x=0–36; Keep: x=34–134; Right tower: x=132–168
  // Battlements top y=32 (towers), keep top y=48; counter top y=158
  const parts = [];

  // Lady server — framed by the castle gate arch
  if ((S.hiredToday || {}).lady) {
    parts.push(_eqLadyServer(84, 158));
  }

  if (u.canopy) {
    // LEFT-SIDE shade extending from the left tower outward:
    // A shade arm at tower-top height, fabric draping on the left side
    parts.push(`
      <rect x="0" y="42" width="3"  height="90" rx="1.5" fill="#546E7A"/>
      <rect x="0" y="42" width="14" height="78" rx="3" fill="#FF8C00" opacity="0.88"/>
      <rect x="0" y="42" width="4"  height="78" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="10" y="42" width="4" height="78" rx="0" fill="#FFF8E1" opacity="0.72"/>
      <rect x="0" y="118" width="14" height="3" rx="1.5" fill="#E65100" opacity="0.55"/>
    `);
  }
  if (u.neon) {
    // Neon along the TOP of the castle — battlement crests of the keep wall
    parts.push(`
      <line x1="34"  y1="48" x2="134" y2="48" stroke="#FFD700" stroke-width="4" opacity="0.9" stroke-linecap="round"/>
      <line x1="34"  y1="48" x2="134" y2="48" stroke="#FF4081" stroke-width="2" opacity="0.7" stroke-linecap="round" stroke-dasharray="7,5"/>
      <line x1="0"   y1="32" x2="36"  y2="32" stroke="#FFD700" stroke-width="3" opacity="0.8" stroke-linecap="round"/>
      <line x1="132" y1="32" x2="168" y2="32" stroke="#FFD700" stroke-width="3" opacity="0.8" stroke-linecap="round"/>
      <circle cx="34"  cy="48" r="3.5" fill="#FFD700" opacity="0.9"/>
      <circle cx="84"  cy="48" r="3.5" fill="#FF4081" opacity="0.9"/>
      <circle cx="134" cy="48" r="3.5" fill="#FFD700" opacity="0.9"/>
    `);
  }
  if (u.soundsystem) {
    // Speakers mounted inside the tower windows
    parts.push(_eqSpeaker(9,   108));
    parts.push(_eqSpeaker(148, 108));
  }
  if (u.fridge) {
    // Left tower lower section y=128–160
    parts.push(_eqFridge(3, 128));
  }
  if (u.juicer || u.powerjuicer) {
    // Left side of gate counter x=38–56, y=148–168
    parts.push(_eqJuicer(38, 146, !!u.powerjuicer));
  }
  if (u.register) {
    // Right side of gate counter x=110–132, y=148–165
    parts.push(_eqRegister(110, 148));
  }
  if (u.dispenser) {
    // Center gate — dispenser at x=70–88, y=146–168
    parts.push(_eqDispenser(70, 146));
  }
  if (u.icemaker) {
    // Right tower lower section
    parts.push(_eqIcemaker(150, 122));
  } else if (u.iceomatic) {
    parts.push(_eqIceomatic(151, 128));
  }
  return parts.join('');
}

// Dispatcher: picks the right extras function for the current stand tier
function buildStandExtras(u, tier) {
  if (tier === 1) return _extrasClassic(u);
  if (tier === 2) return _extrasLemon(u);
  if (tier === 3) return _extrasCastle(u);
  return _extrasDefault(u);
}

function buildStandSVG() {
  const tier = Math.min(3, S.standTier || 0);
  const u    = S.upgrades || {};
  const ex   = buildStandExtras(u, tier);
  if (tier === 1) return _standClassic(ex);
  if (tier === 2) return _standLemon(ex);
  if (tier === 3) return _standCastle(ex);
  return _standDefault(ex);
}

// ── Tier 0 — Default starter stand (umbrella awning) ─────────────────────────
function _standDefault(ex) {
  return `<svg viewBox="0 0 138 158" width="138" height="158" xmlns="http://www.w3.org/2000/svg">
  <!-- Pole -->
  <rect x="65" y="22" width="6" height="92" fill="#6D4C41" rx="3"/>
  <!-- Awning fill (orange/yellow wedges) -->
  <path d="M4,38 Q70,2 134,38 Z" fill="#FF8C00"/>
  <path d="M4,38 Q25,10 46,7 L70,35 Z"    fill="#FFD700"/>
  <path d="M46,7 Q70,2 70,2 L70,35 Z"     fill="#FF8C00"/>
  <path d="M70,2 Q94,2 92,7 L70,35 Z"     fill="#FFD700"/>
  <path d="M92,7 Q112,12 134,38 L70,35 Z" fill="#FF8C00"/>
  <!-- Awning fringe scallops -->
  <path d="M4,38 Q14,51 24,38 Q34,51 44,38 Q54,51 64,38 Q74,51 84,38 Q94,51 104,38 Q114,51 124,38 Q129,44 134,38"
        fill="none" stroke="#F9A825" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="9"   y1="40" x2="7"   y2="50" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
  <line x1="24"  y1="48" x2="22"  y2="58" stroke="#FF8C00" stroke-width="2" stroke-linecap="round"/>
  <line x1="44"  y1="40" x2="42"  y2="50" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
  <line x1="64"  y1="48" x2="62"  y2="58" stroke="#FF8C00" stroke-width="2" stroke-linecap="round"/>
  <line x1="74"  y1="48" x2="72"  y2="58" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
  <line x1="94"  y1="40" x2="92"  y2="50" stroke="#FF8C00" stroke-width="2" stroke-linecap="round"/>
  <line x1="114" y1="48" x2="112" y2="58" stroke="#FFD700" stroke-width="2" stroke-linecap="round"/>
  <line x1="129" y1="40" x2="127" y2="50" stroke="#FF8C00" stroke-width="2" stroke-linecap="round"/>
  <!-- Sign board -->
  <rect x="12" y="84" width="114" height="20" fill="#FFFDE7" rx="5" stroke="#FF8C00" stroke-width="1.5"/>
  <text x="69" y="98" text-anchor="middle" font-size="10" fill="#1A1A2E"
        font-family="'Fredoka One',cursive" font-weight="bold">🍋 LEMONADE</text>
  <!-- Counter top -->
  <rect x="4"  y="104" width="130" height="9" fill="#8D6E63" rx="4"/>
  <!-- Counter body (clean, no clutter — equipment added via extras) -->
  <rect x="7"  y="113" width="124" height="45" fill="#EFCFA0" rx="4"/>
  <rect x="11" y="118" width="116" height="35" fill="#E8BE88" rx="3"/>
  <!-- Subtle wood grain lines -->
  <line x1="11" y1="126" x2="127" y2="126" stroke="#C9A876" stroke-width="0.8" opacity="0.5"/>
  <line x1="11" y1="134" x2="127" y2="134" stroke="#C9A876" stroke-width="0.8" opacity="0.5"/>
  <line x1="11" y1="142" x2="127" y2="142" stroke="#C9A876" stroke-width="0.8" opacity="0.5"/>
  <!-- Small lemon decal on counter front (branding) -->
  <circle cx="69" cy="148" r="6" fill="#FFD740" opacity="0.6"/>
  <ellipse cx="69" cy="148" rx="6" ry="6" fill="none" stroke="#F9A825" stroke-width="1" opacity="0.5"/>
  ${ex}
</svg>`;
}

// ── Tier 1 — Classic Stand (bigger, solid peaked roof, no umbrella) ───────────
function _standClassic(ex) {
  return `<svg viewBox="0 0 160 168" width="160" height="168" xmlns="http://www.w3.org/2000/svg">
  <!-- Chimney -->
  <rect x="73" y="0" width="14" height="20" fill="#1A237E" rx="2"/>
  <rect x="70" y="14" width="20" height="6"  fill="#283593" rx="1"/>
  <!-- Roof left slope (dark shingles) -->
  <polygon points="0,62 80,10 80,62" fill="#1565C0"/>
  <!-- Roof right slope -->
  <polygon points="160,62 80,10 80,62" fill="#0D47A1"/>
  <!-- Shingle lines on left -->
  <line x1="16"  y1="62" x2="80" y2="31" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <line x1="32"  y1="62" x2="80" y2="39" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <line x1="48"  y1="62" x2="80" y2="47" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <line x1="64"  y1="62" x2="80" y2="55" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <!-- Shingle lines on right -->
  <line x1="144" y1="62" x2="80" y2="31" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <line x1="128" y1="62" x2="80" y2="39" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <line x1="112" y1="62" x2="80" y2="47" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <line x1="96"  y1="62" x2="80" y2="55" stroke="#0A3473" stroke-width="1.2" opacity="0.6"/>
  <!-- Peak star -->
  <polygon points="80,6 83,14 80,12 77,14" fill="#FFD700"/>
  <!-- Fascia / gutter -->
  <rect x="0" y="60" width="160" height="6" fill="#0D47A1"/>
  <rect x="-2" y="64" width="164" height="5" fill="#4E342E" rx="2"/>
  <!-- Stand body (full width) -->
  <rect x="2" y="67" width="156" height="101" fill="#FAFAFA" rx="4"/>
  <!-- Left window -->
  <rect x="10" y="76" width="44" height="36" fill="#E3F2FD" rx="5"/>
  <rect x="10" y="76" width="44" height="36" fill="none" stroke="#1565C0" stroke-width="2" rx="5"/>
  <line x1="32" y1="76" x2="32" y2="112" stroke="#1565C0" stroke-width="1.5" opacity="0.6"/>
  <line x1="10" y1="94" x2="54" y2="94" stroke="#1565C0" stroke-width="1.5" opacity="0.6"/>
  <!-- Right window -->
  <rect x="106" y="76" width="44" height="36" fill="#E3F2FD" rx="5"/>
  <rect x="106" y="76" width="44" height="36" fill="none" stroke="#1565C0" stroke-width="2" rx="5"/>
  <line x1="128" y1="76" x2="128" y2="112" stroke="#1565C0" stroke-width="1.5" opacity="0.6"/>
  <line x1="106" y1="94" x2="150" y2="94" stroke="#1565C0" stroke-width="1.5" opacity="0.6"/>
  <!-- Sign board centre (no cashier emoji) -->
  <rect x="58" y="78" width="44" height="30" fill="#E3F2FD" rx="5" stroke="#1565C0" stroke-width="1.5"/>
  <text x="80" y="90" text-anchor="middle" font-size="8" fill="#1565C0" font-family="'Fredoka One',cursive" font-weight="bold">🏪 CLASSIC</text>
  <text x="80" y="102" text-anchor="middle" font-size="7" fill="#1565C0" font-family="'Fredoka One',cursive">STAND</text>
  <!-- Counter top -->
  <rect x="0"  y="113" width="160" height="10" fill="#5D4037" rx="4"/>
  <!-- Counter body (clean) -->
  <rect x="4"  y="123" width="152" height="45" fill="#ECEFF1" rx="4"/>
  <rect x="8"  y="128" width="144" height="35" fill="#E8E8E8" rx="3"/>
  <!-- Wood grain -->
  <line x1="8"  y1="136" x2="152" y2="136" stroke="#BDBDBD" stroke-width="0.8" opacity="0.6"/>
  <line x1="8"  y1="144" x2="152" y2="144" stroke="#BDBDBD" stroke-width="0.8" opacity="0.6"/>
  <!-- Lemon branding on counter front -->
  <circle cx="80" cy="155" r="7" fill="#FFD740" opacity="0.5"/>
  <ellipse cx="80" cy="155" rx="7" ry="7" fill="none" stroke="#F9A825" stroke-width="1" opacity="0.5"/>
  ${ex}
</svg>`;
}

// ── Tier 2 — Lemon Stand (entire stand shaped like a giant lemon) ─────────────
function _standLemon(ex) {
  return `<svg viewBox="0 0 148 168" width="148" height="168" xmlns="http://www.w3.org/2000/svg">
  <!-- Lemon body (giant ellipse) -->
  <ellipse cx="74" cy="76" rx="64" ry="62" fill="#FFD600"/>
  <!-- Lemon highlight (gloss) -->
  <ellipse cx="50" cy="44" rx="22" ry="16" fill="#FFF176" opacity="0.55"/>
  <!-- Lemon texture segments -->
  <line x1="74" y1="14"  x2="74"  y2="138" stroke="#F9A825" stroke-width="1.2" opacity="0.35"/>
  <line x1="10" y1="76"  x2="138" y2="76"  stroke="#F9A825" stroke-width="1.2" opacity="0.35"/>
  <line x1="24" y1="30"  x2="124" y2="122" stroke="#F9A825" stroke-width="1.2" opacity="0.25"/>
  <line x1="124" y1="30" x2="24"  y2="122" stroke="#F9A825" stroke-width="1.2" opacity="0.25"/>
  <!-- Lemon border -->
  <ellipse cx="74" cy="76" rx="64" ry="62" fill="none" stroke="#F9A825" stroke-width="2"/>
  <!-- Stem -->
  <rect x="71" y="8" width="6" height="16" fill="#558B2F" rx="3"/>
  <rect x="69" y="6" width="10" height="5"  fill="#558B2F" rx="2"/>
  <!-- Leaf left -->
  <ellipse cx="62" cy="14" rx="13" ry="7" fill="#66BB6A" transform="rotate(-35,62,14)"/>
  <line x1="62" y1="8" x2="62" y2="20" stroke="#4CAF50" stroke-width="1" transform="rotate(-35,62,14)" opacity="0.5"/>
  <!-- Leaf right -->
  <ellipse cx="86" cy="14" rx="13" ry="7" fill="#81C784" transform="rotate(35,86,14)"/>
  <line x1="86" y1="8" x2="86" y2="20" stroke="#4CAF50" stroke-width="1" transform="rotate(35,86,14)" opacity="0.5"/>
  <!-- Window (oval cutout in lemon) -->
  <ellipse cx="74" cy="74" rx="32" ry="28" fill="#FFFDE7"/>
  <ellipse cx="74" cy="74" rx="32" ry="28" fill="none" stroke="#F9A825" stroke-width="2"/>
  <!-- Sign text in window -->
  <text x="74" y="66" text-anchor="middle" font-size="7.5" fill="#E65100" font-family="'Fredoka One',cursive" font-weight="bold">🍋 LEMON</text>
  <text x="74" y="77" text-anchor="middle" font-size="7.5" fill="#E65100" font-family="'Fredoka One',cursive" font-weight="bold">PALACE</text>
  <!-- Counter base (clean, no clutter) -->
  <rect x="8"  y="132" width="132" height="10" fill="#F57F17" rx="4"/>
  <rect x="12" y="142" width="124" height="26" fill="#FFF8E1" rx="4"/>
  <!-- Subtle wood grain -->
  <line x1="12" y1="150" x2="136" y2="150" stroke="#FFD180" stroke-width="0.8" opacity="0.5"/>
  <line x1="12" y1="158" x2="136" y2="158" stroke="#FFD180" stroke-width="0.8" opacity="0.5"/>
  ${ex}
</svg>`;
}

// ── Tier 3 — Castle Stand (full castle shape with towers and battlements) ──────
function _standCastle(ex) {
  return `<svg viewBox="0 0 168 178" width="168" height="178" xmlns="http://www.w3.org/2000/svg">
  <!-- === LEFT TOWER === -->
  <rect x="0" y="44" width="36" height="134" fill="#90A4AE" rx="2"/>
  <!-- Left tower battlements -->
  <rect x="0"  y="32" width="10" height="14" fill="#90A4AE" rx="1"/>
  <rect x="13" y="32" width="10" height="14" fill="#90A4AE" rx="1"/>
  <rect x="26" y="32" width="10" height="14" fill="#90A4AE" rx="1"/>
  <!-- Left tower window -->
  <rect x="10" y="68" width="16" height="22" fill="#263238" rx="2"/>
  <path d="M10,80 Q18,68 26,80" fill="#37474F"/>
  <!-- Left tower arrow slit -->
  <rect x="16" y="100" width="4" height="14" fill="#263238" rx="1"/>
  <rect x="13" y="104" width="10" height="4" fill="#263238" rx="1"/>
  <!-- Left tower flag -->
  <rect x="16" y="20" width="3" height="16" fill="#78909C"/>
  <polygon points="19,20 34,26 19,32" fill="#4A148C"/>
  <!-- Left stone texture -->
  <rect x="2"  y="56" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="2"  y="70" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="2"  y="84" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="2"  y="98" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="2" y="112" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="2" y="126" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>

  <!-- === RIGHT TOWER === -->
  <rect x="132" y="44" width="36" height="134" fill="#90A4AE" rx="2"/>
  <!-- Right tower battlements -->
  <rect x="132" y="32" width="10" height="14" fill="#90A4AE" rx="1"/>
  <rect x="145" y="32" width="10" height="14" fill="#90A4AE" rx="1"/>
  <rect x="158" y="32" width="10" height="14" fill="#90A4AE" rx="1"/>
  <!-- Right tower window -->
  <rect x="142" y="68" width="16" height="22" fill="#263238" rx="2"/>
  <path d="M142,80 Q150,68 158,80" fill="#37474F"/>
  <!-- Right tower arrow slit -->
  <rect x="148" y="100" width="4" height="14" fill="#263238" rx="1"/>
  <rect x="145" y="104" width="10" height="4" fill="#263238" rx="1"/>
  <!-- Right tower flag -->
  <rect x="149" y="20" width="3" height="16" fill="#78909C"/>
  <polygon points="152,20 134,26 152,32" fill="#4A148C"/>
  <!-- Right stone texture -->
  <rect x="134" y="56"  width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="134" y="70"  width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="134" y="84"  width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="134" y="98"  width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="134" y="112" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>
  <rect x="134" y="126" width="32" height="5" fill="none" stroke="#78909C" stroke-width="0.8" opacity="0.5" rx="1"/>

  <!-- === MAIN KEEP (centre wall) === -->
  <rect x="34" y="60" width="100" height="118" fill="#B0BEC5" rx="2"/>
  <!-- Keep battlements -->
  <rect x="36" y="48" width="12" height="14" fill="#B0BEC5" rx="1"/>
  <rect x="52" y="48" width="12" height="14" fill="#B0BEC5" rx="1"/>
  <rect x="68" y="48" width="12" height="14" fill="#B0BEC5" rx="1"/>
  <rect x="84" y="48" width="12" height="14" fill="#B0BEC5" rx="1"/>
  <rect x="100" y="48" width="12" height="14" fill="#B0BEC5" rx="1"/>
  <rect x="116" y="48" width="14" height="14" fill="#B0BEC5" rx="1"/>
  <!-- Keep stone rows -->
  <rect x="36"  y="72"  width="96" height="5" fill="none" stroke="#90A4AE" stroke-width="0.8" opacity="0.6" rx="1"/>
  <rect x="36"  y="85"  width="96" height="5" fill="none" stroke="#90A4AE" stroke-width="0.8" opacity="0.6" rx="1"/>
  <rect x="36"  y="98"  width="96" height="5" fill="none" stroke="#90A4AE" stroke-width="0.8" opacity="0.6" rx="1"/>
  <rect x="36" y="150"  width="96" height="5" fill="none" stroke="#90A4AE" stroke-width="0.8" opacity="0.6" rx="1"/>
  <!-- Purple banner / sign -->
  <rect x="42" y="68" width="84" height="24" fill="#4A148C" rx="4"/>
  <text x="84" y="78" text-anchor="middle" font-size="7.5" fill="#FFD700"
        font-family="'Fredoka One',cursive" font-weight="bold">👑 LEMON</text>
  <text x="84" y="88" text-anchor="middle" font-size="7.5" fill="#FFD700"
        font-family="'Fredoka One',cursive" font-weight="bold">EMPIRE</text>
  <!-- Archway / gate -->
  <rect x="54" y="108" width="60" height="70" fill="#263238" rx="2"/>
  <path d="M54,132 Q84,100 114,132" fill="#37474F"/>
  <!-- Gate portcullis bars -->
  <line x1="64"  y1="132" x2="64"  y2="178" stroke="#455A64" stroke-width="2.5" opacity="0.7"/>
  <line x1="74"  y1="132" x2="74"  y2="178" stroke="#455A64" stroke-width="2.5" opacity="0.7"/>
  <line x1="84"  y1="132" x2="84"  y2="178" stroke="#455A64" stroke-width="2.5" opacity="0.7"/>
  <line x1="94"  y1="132" x2="94"  y2="178" stroke="#455A64" stroke-width="2.5" opacity="0.7"/>
  <line x1="104" y1="132" x2="104" y2="178" stroke="#455A64" stroke-width="2.5" opacity="0.7"/>
  <line x1="54"  y1="148" x2="114" y2="148" stroke="#455A64" stroke-width="2" opacity="0.7"/>
  <line x1="54"  y1="160" x2="114" y2="160" stroke="#455A64" stroke-width="2" opacity="0.7"/>
  <!-- Counter top (clean, spans full width) -->
  <rect x="0"   y="158" width="168" height="9" fill="#546E7A" rx="3"/>
  <!-- Counter surface subtle detail -->
  <line x1="36" y1="158" x2="132" y2="158" stroke="#78909C" stroke-width="0.8" opacity="0.4"/>
  ${ex}
</svg>`;
}

function buildCustomerSVG(p) {
  return `<svg viewBox="0 0 38 72" width="34" height="65" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
  <!-- Hair -->
  <circle cx="19" cy="10" r="11" fill="${p.hair}"/>
  <!-- Face -->
  <circle cx="19" cy="12" r="10" fill="${p.skin}"/>
  <!-- Eyes -->
  <circle cx="15" cy="11"  r="1.8" fill="white"/>
  <circle cx="23" cy="11"  r="1.8" fill="white"/>
  <circle cx="15.4" cy="11.4" r="1"   fill="#333"/>
  <circle cx="23.4" cy="11.4" r="1"   fill="#333"/>
  <!-- Eye shine -->
  <circle cx="15.9" cy="10.9" r="0.4" fill="white"/>
  <circle cx="23.9" cy="10.9" r="0.4" fill="white"/>
  <!-- Smile -->
  <path d="M14.5,16 Q19,20.5 23.5,16" fill="none" stroke="#C0392B" stroke-width="1.3" stroke-linecap="round"/>
  <!-- Neck -->
  <rect x="16" y="22" width="6" height="5" fill="${p.skin}" rx="1"/>
  <!-- Body/shirt -->
  <rect x="10" y="27" width="18" height="20" fill="${p.shirt}" rx="4"/>
  <!-- Left arm -->
  <rect x="3"  y="27" width="7" height="16" fill="${p.shirt}" rx="3.5"/>
  <!-- Right arm -->
  <rect x="28" y="27" width="7" height="16" fill="${p.shirt}" rx="3.5"/>
  <!-- Waistband -->
  <rect x="10" y="44" width="18" height="3" fill="${p.pants}" rx="1.5" opacity="0.7"/>
  <!-- Left leg -->
  <rect x="10" y="46" width="8"  height="22" fill="${p.pants}" rx="3"/>
  <!-- Right leg -->
  <rect x="20" y="46" width="8"  height="22" fill="${p.pants}" rx="3"/>
  <!-- Left shoe -->
  <ellipse cx="14" cy="68" rx="6" ry="3" fill="${p.shoes}"/>
  <!-- Right shoe -->
  <ellipse cx="24" cy="68" rx="6" ry="3" fill="${p.shoes}"/>
</svg>`;
}

function getSceneConfig() {
  const w   = WEATHER.find(x => x.id === S.currentWeather) || WEATHER[0];
  const loc = S.currentLocation;

  // Sky colours per weather
  const skies = {
    sunny:  'linear-gradient(180deg,#3FA8E0 0%,#6DC8F5 45%,#B8E8FA 80%,#D4EDA8 100%)',
    warm:   'linear-gradient(180deg,#5BB8E8 0%,#87CEEB 50%,#C5E8F7 80%,#D8EDA8 100%)',
    hot:    'linear-gradient(180deg,#E8743A 0%,#F4A460 40%,#FBBF78 75%,#E8C888 100%)',
    cloudy: 'linear-gradient(180deg,#8899A8 0%,#A8B8C4 40%,#C4D0D8 75%,#C8D0B8 100%)',
    rainy:  'linear-gradient(180deg,#4A5A6A 0%,#607080 40%,#788898 75%,#8898A0 100%)',
  };

  // Ground per location
  const grounds = {
    sidewalk: { fill:'linear-gradient(180deg,#9E9E9E,#787878)', path:'linear-gradient(180deg,#BDBDBD,#9E9E9E)' },
    park:     { fill:'linear-gradient(180deg,#66BB6A,#388E3C)', path:'linear-gradient(180deg,#AED6A0,#8FBF86)' },
    beach:    { fill:'linear-gradient(180deg,#F4D03F,#D4AC0D)', path:'linear-gradient(180deg,#FAE5A0,#F0D060)' },
    market:   { fill:'linear-gradient(180deg,#9E9E9E,#616161)', path:'linear-gradient(180deg,#E0E0E0,#BDBDBD)' },
    festival: { fill:'linear-gradient(180deg,#81C784,#4CAF50)', path:'linear-gradient(180deg,#C8E6C9,#A5D6A7)' },
  };

  return { sky: skies[w.id] || skies.sunny, ground: grounds[loc] || grounds.sidewalk, weather: w, loc };
}

// â”€â”€ SHARED SCENE BUILDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ids: { scene, sky, bg, gfill, gpath, stand, ptag, customers }
// customers is optional (omit for day screen)
function _buildScene(ids) {
  const cfg = getSceneConfig();

  // Sky
  document.getElementById(ids.sky).style.background = cfg.sky;

  // Ground
  document.getElementById(ids.gfill).style.background = cfg.ground.fill;
  document.getElementById(ids.gpath).style.background = cfg.ground.path;

  // Stand SVG
  document.getElementById(ids.stand).innerHTML = buildStandSVG();

  // Price tag
  const ptag = document.getElementById(ids.ptag);
  if (ptag) ptag.textContent = fmt(S.price);

  // Background elements
  const bgEl    = document.getElementById(ids.bg);
  const sceneEl = document.getElementById(ids.scene);
  bgEl.innerHTML = '';

  const loc       = cfg.loc;
  const weatherId = cfg.weather.id;

  if (loc === 'beach') {
    [30, 90].forEach((x, i) => {
      const h = 70 + i * 15;
      const trunk = document.createElement('div');
      trunk.className = 'bg-palm-trunk';
      trunk.style.cssText = `left:${x}px;height:${h}px;`;
      bgEl.appendChild(trunk);
      [-50,-20,10,40,70].forEach((angle, li) => {
        const leaf = document.createElement('div');
        leaf.className = 'bg-palm-leaf';
        leaf.style.cssText = `left:${x+4}px;bottom:${h-4}px;transform:rotate(${angle}deg);transform-origin:left center;background:${li%2===0?'#4CAF50':'#388E3C'}`;
        bgEl.appendChild(leaf);
      });
    });
    const wave = document.createElement('div');
    wave.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:22px;background:linear-gradient(180deg,rgba(33,150,243,0.4),rgba(33,150,243,0.1));border-radius:50% 50% 0 0/80% 80% 0 0;animation:waveRock 2s ease-in-out infinite alternate;';
    bgEl.appendChild(wave);
    if (!document.getElementById('wave-style')) {
      const s = document.createElement('style');
      s.id = 'wave-style';
      s.textContent = '@keyframes waveRock{from{transform:scaleX(1)}to{transform:scaleX(1.04)}}';
      document.head.appendChild(s);
    }
  } else if (loc === 'sidewalk' || loc === 'market') {
    [[8,75,50,'#9E9E9E'],[65,60,40,'#8D8D8D'],[110,80,45,'#AEAEAE'],[160,65,42,'#919191']].forEach(([x,h,w,c]) => {
      const b = document.createElement('div');
      b.className = 'bg-building';
      b.style.cssText = `left:${x}px;width:${w}px;height:${h}px;background:${c};`;
      for (let wy = 10; wy < h - 15; wy += 18) {
        for (let wx = 6; wx < w - 10; wx += 14) {
          const win = document.createElement('div');
          win.className = 'bg-building-window';
          win.style.cssText = `left:${wx}px;top:${wy}px;width:8px;height:10px;`;
          b.appendChild(win);
        }
      }
      bgEl.appendChild(b);
    });
  } else {
    [[15,55],[60,65],[120,50],[185,60]].forEach(([x,h]) => {
      const tree = document.createElement('div');
      tree.className = 'bg-tree';
      tree.style.left = x + 'px';
      const c1 = document.createElement('div');
      c1.className = 'tree-canopy';
      c1.style.cssText = `border-bottom:${h*0.45}px solid #4CAF50;`;
      const c2 = document.createElement('div');
      c2.className = 'tree-canopy-2';
      c2.style.cssText = `border-bottom:${h*0.55}px solid #388E3C;`;
      const tr = document.createElement('div');
      tr.className = 'tree-trunk-bg';
      tr.style.cssText = 'background:linear-gradient(180deg,#8D6E63,#5D4037);';
      tree.appendChild(c1); tree.appendChild(c2); tree.appendChild(tr);
      bgEl.appendChild(tree);
    });
    if (loc === 'festival') {
      const flags = document.createElement('div');
      flags.style.cssText = 'position:absolute;top:5px;left:0;right:0;height:20px;pointer-events:none;';
      const colors = ['#E53935','#FFD700','#4CAF50','#2196F3','#E91E63','#FF9800'];
      for (let i=0;i<12;i++) {
        const f = document.createElement('div');
        f.style.cssText = `position:absolute;left:${i*18+2}px;top:2px;width:14px;height:14px;background:${colors[i%6]};clip-path:polygon(50% 0%,0% 100%,100% 100%);transform:rotate(${(i%2)*180}deg);`;
        flags.appendChild(f);
      }
      bgEl.appendChild(flags);
    }
  }

  // Clouds — scoped to this scene container
  sceneEl.querySelectorAll('.scene-cloud,.scene-sun,.scene-rain').forEach(e => e.remove());

  [['-140px','28px','90px','26px','22s'],['40px','52px','65px','20px','31s'],['-80px','14px','80px','24px','26s','-8s']].forEach(([start,top,w,h,dur,delay='0s']) => {
    const c = document.createElement('div');
    c.className = 'scene-cloud';
    c.style.cssText = `left:${start};top:${top};width:${w};height:${h};animation-duration:${dur};animation-delay:${delay};z-index:2;`;
    sceneEl.appendChild(c);
  });

  if (weatherId === 'rainy') {
    const rain = document.createElement('div'); rain.className = 'scene-rain'; sceneEl.appendChild(rain);
  } else if (weatherId !== 'cloudy') {
    const sun = document.createElement('div'); sun.className = 'scene-sun'; sceneEl.appendChild(sun);
  }

  // Clear customer layer if present
  if (ids.customers) {
    const custEl = document.getElementById(ids.customers);
    if (custEl) custEl.innerHTML = '';
  }
}

// Called when entering selling screen
function setupScene() {
  _buildScene({
    scene:     'selling-scene',
    sky:       'scene-sky',
    bg:        'scene-bg',
    gfill:     'ground-fill',
    gpath:     'ground-path',
    stand:     'scene-stand-wrapper',
    ptag:      'stand-price-tag',
    customers: 'scene-customers',
  });
  buildStaffOverlay();
}

// Render hired staff as visible characters beside the stand.
// Lady is drawn INSIDE the stand SVG via _eqLadyServer() in the extras functions.
// Clown and Musician appear as illustrated SVG figures in the scene.
function buildStaffOverlay() {
  const el = document.getElementById('scene-staff');
  if (!el) return;
  const hired = S.hiredToday || {};
  const members = [];

  if (hired.clown) {
    members.push(`<div class="scene-staff-member staff-clown">
      ${_svgClown()}
      <span class="staff-name">Party Clown</span>
    </div>`);
  }
  if (hired.musician) {
    members.push(`<div class="scene-staff-member staff-musician">
      ${_svgMusician()}
      <span class="staff-name">Musician</span>
    </div>`);
  }
  // Lady handled inside stand SVG — nothing to render here for her

  el.innerHTML = members.join('');
}

// Called when rendering day screen
function setupDayScene() {
  _buildScene({
    scene: 'day-scene',
    sky:   'day-sky',
    bg:    'day-bg',
    gfill: 'day-gfill',
    gpath: 'day-gpath',
    stand: 'day-stand',
    ptag:  'day-ptag',
    // no customers key — static stand only
  });
}

// STAND x-position (left edge from screen right): stand wrapper is right:6px, width 138px â†’ stand left = screenW - 144
// We want customers to stop just left of the counter face = right:6 + 138 = 144px from right â†’ left = containerW - 144
const STAND_SERVE_X = 230; // px from left where customer stops at counter

// â”€â”€ SELLING SIMULATION STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ss = { demand, cupsToMake, actualServed, disappointed,
//         pitcherRemaining, isRefilling, counterBusy,
//         queue:[{el,patienceTimer}], dayOver, preResult, cfg }

function _repositionQueue(ss) {
  ss.queue.forEach((item, idx) => {
    const x = Math.max(8, STAND_SERVE_X - (idx + 1) * 36);
    item.el.style.transition = 'left 260ms ease';
    item.el.style.left = x + 'px';
  });
}


function _disappointEl(el, ss, reason) {
  const container = document.getElementById('scene-customers');
  el.classList.add('is-disappointed');
  // Expression bubble based on reason
  const bx = Math.max(10, parseInt(el.style.left || '0') + 4);
  const bubble = document.createElement('div');
  const bubbleText = reason === 'price' ? '💸 Too pricey!'
    : reason === 'stock' ? '😢 Sold out!'
    : '⏰ Too long!';
  bubble.style.cssText = `position:absolute;left:${bx}px;bottom:90px;font-size:0.78rem;z-index:20;pointer-events:none;animation:scenePopUp 1.0s forwards;white-space:nowrap;background:white;padding:2px 6px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.18);font-family:sans-serif;`;
  bubble.textContent = bubbleText;
  container.appendChild(bubble);
  setTimeout(() => bubble.remove(), 1050);
  // Walk back left
  setTimeout(() => {
    el.classList.remove('is-disappointed');
    el.classList.add('is-walking');
    el.style.transition = 'left 850ms linear';
    el.style.left = '-80px';
    setTimeout(() => el.remove(), 900);
  }, 560);
}

function _dismissQueue(ss) {
  if (ss.queue.length === 0) return;
  ss.queue.forEach(item => {
    clearTimeout(item.patienceTimer);
    item.el.classList.remove('is-waiting');
    _disappointEl(item.el, ss, 'stock');
    ss.disappointed++;
    ss.rx.stock++;

  });
  ss.queue = [];
  updateReactionTally(ss);
  const dis = document.getElementById('live-disappointed');
  if (dis) dis.textContent = ss.disappointed;
}

function _setSkipDayButton(visible, label = '⏭ Skip') {
  const btn = document.getElementById('skip-day-btn');
  if (!btn) return;
  btn.style.display = visible ? '' : 'none';
  btn.textContent = label;
}

function _countRemainingVisitors(ss) {
  const remainingUnspawned = Math.max(0, ss.demand - (ss.spawnedCount || 0));
  const queued = ss.queue.length;
  const inTransit = ss.inTransit;
  const atCounter = ss.counterBusy ? 1 : 0;
  return remainingUnspawned + queued + inTransit + atCounter;
}

function skipSellingDay() {
  const ss = _activeSS;
  if (!ss || ss.dayOver) return;

  const soldOut = ss.cupsToMake <= 0 || ss.actualServed >= ss.cupsToMake;
  if (!soldOut) return;

  clearTimeout(ss._spawnTimer);
  clearTimeout(ss._dayTimer);

  const skippedVisitors = _countRemainingVisitors(ss);
  ss.queue.forEach(item => clearTimeout(item.patienceTimer));
  ss.queue = [];

  if (skippedVisitors > 0) {
    ss.disappointed += skippedVisitors;
    ss.rx.stock += skippedVisitors;
  }

  const liveLeft = document.getElementById('live-disappointed');
  if (liveLeft) liveLeft.textContent = ss.disappointed + (ss.priceyCount || 0);
  updateReactionTally(ss);

  document.querySelectorAll('#scene-customers .walking-customer').forEach(el => el.remove());
  document.getElementById('selling-title-hud').textContent = soldOut && ss.actualServed > 0 ? '🎉 Sold Out!' : '⏭ Day Skipped';
  document.getElementById('selling-status').textContent = skippedVisitors > 0
    ? `${skippedVisitors} later customer${skippedVisitors !== 1 ? 's' : ''} counted as sold out`
    : 'Jumping to results...';
  _setSkipDayButton(false);

  _endSellingDay(ss, { immediate: true, keepTitle: true });
}

function _tryServe(ss) {
  if (ss.dayOver || ss.counterBusy || ss.isRefilling || ss.queue.length === 0) return;

  // Stock is out — dismiss remaining queue
  if (ss.cupsToMake > 0 && ss.actualServed >= ss.cupsToMake) {
    _dismissQueue(ss);
    document.getElementById('selling-title-hud').textContent = '😢 Out of stock!';
    document.getElementById('selling-status').textContent   = 'Sorry, all sold out!';
    return;
  }

  const item = ss.queue.shift();
  clearTimeout(item.patienceTimer);
  item.el.classList.remove('is-waiting');
  _repositionQueue(ss); // shift remaining customers forward
  ss.counterBusy = true;

  const container = document.getElementById('scene-customers');

  // Step forward to counter
  item.el.classList.add('is-walking');
  item.el.style.transition = 'left 200ms ease';
  item.el.style.left = STAND_SERVE_X + 'px';

  setTimeout(() => {
    if (ss.dayOver) { ss.counterBusy = false; item.el.remove(); return; }
    item.el.classList.remove('is-walking');
    item.el.classList.add('is-served');

    // Coin pop
    const coin = document.createElement('div');
    coin.className = 'scene-coin-pop';
    coin.textContent = '💰';
    coin.style.left   = (STAND_SERVE_X + 8) + 'px';
    coin.style.bottom = '85px';
    container.appendChild(coin);
    setTimeout(() => coin.remove(), 1000);

    // Per-customer reaction — same recipe, different people react differently
    // taste score sets the probability distribution; each customer rolls individually
    const taste = ss.preResult.tasteScore;
    let reaction, rxKey, rxSFX;
    const roll = Math.random();

    if (taste >= 0.85) {
      // Amazing recipe: 65% Amazing, 32% Delicious, 3% picky Gross
      if      (roll < 0.65)  { reaction = '🤩 Amazing!';   rxKey = 'amazing';   rxSFX = SFX.rxAmazing;   bounceStand(); }
      else if (roll < 0.97)  { reaction = '😋 Delicious!'; rxKey = 'delicious'; rxSFX = SFX.rxDelicious; }
      else                   { reaction = '🤢 Gross!';      rxKey = 'gross';     rxSFX = SFX.rxGross; ss.yuckServed = (ss.yuckServed||0)+1; shakeStand(); }
    } else if (taste >= 0.45) {
      // Decent recipe: 8% Amazing, 72% Delicious, 20% Gross
      if      (roll < 0.08)  { reaction = '🤩 Amazing!';   rxKey = 'amazing';   rxSFX = SFX.rxAmazing;   }
      else if (roll < 0.80)  { reaction = '😋 Delicious!'; rxKey = 'delicious'; rxSFX = SFX.rxDelicious; }
      else                   { reaction = '🤢 Gross!';      rxKey = 'gross';     rxSFX = SFX.rxGross; ss.yuckServed = (ss.yuckServed||0)+1; shakeStand(); }
    } else {
      // Bad recipe: 2% Amazing, 18% Delicious, 80% Gross
      if      (roll < 0.02)  { reaction = '🤩 Amazing!';   rxKey = 'amazing';   rxSFX = SFX.rxAmazing;   }
      else if (roll < 0.20)  { reaction = '😋 Delicious!'; rxKey = 'delicious'; rxSFX = SFX.rxDelicious; }
      else                   { reaction = '🤢 Gross!';      rxKey = 'gross';     rxSFX = SFX.rxGross; ss.yuckServed = (ss.yuckServed||0)+1; shakeStand(); }
    }
    ss.rx[rxKey]++;
    rxSFX();
    const rbx = Math.max(8, STAND_SERVE_X - 18);
    const rbubble = document.createElement('div');
    rbubble.style.cssText = `position:absolute;left:${rbx}px;bottom:88px;font-size:0.78rem;z-index:22;pointer-events:none;animation:scenePopUp 1.2s forwards;white-space:nowrap;background:white;padding:2px 7px;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.18);font-family:sans-serif;`;
    rbubble.textContent = reaction;
    container.appendChild(rbubble);
    setTimeout(() => rbubble.remove(), 1250);

    // Update counters
    ss.actualServed++;
    ss.pitcherRemaining--;
    document.getElementById('live-cups-sold').textContent = ss.actualServed;
    document.getElementById('live-revenue').textContent   = fmt(ss.actualServed * S.price);
    updateSellLiveInv(ss);
    updatePitcherUI(ss, ss.cfg);

    updateReactionTally(ss);

    // Check sold out
    if (ss.cupsToMake > 0 && ss.actualServed >= ss.cupsToMake) {
      document.getElementById('soldout-overlay').classList.add('show');
      document.getElementById('selling-title-hud').textContent = '🎉 Sold Out!';
      document.getElementById('selling-status').textContent   = 'Every cup served!';
      _setSkipDayButton(true);
    }

    // Walk off right
    setTimeout(() => {
      item.el.classList.remove('is-served');
      item.el.classList.add('is-walking');
      item.el.style.transition = 'left 750ms linear';
      item.el.style.left = '520px';
      setTimeout(() => item.el.remove(), 800);
    }, 350);

    ss.counterBusy = false;

    // Pitcher empty â†’ refill, then serve
    if (ss.pitcherRemaining <= 0 && !ss.dayOver) {
      ss.isRefilling = true;
      updatePitcherUI(ss, ss.cfg);
      document.getElementById('selling-status').textContent = '🔄 Refilling pitcher...';
      setTimeout(() => {
        if (ss.dayOver) return;
        ss.pitcherRemaining = ss.cfg.pitcherCap;
        ss.isRefilling = false;
        updatePitcherUI(ss, ss.cfg);
        document.getElementById('selling-status').textContent = 'Back in business!';
        setTimeout(() => { if (!ss.dayOver) document.getElementById('selling-status').textContent = 'Serving customers...'; }, Math.round(1200 / _speedMult));
        _tryServe(ss);
      }, Math.round(ss.cfg.refillTimeMs / _speedMult));
    } else {
      _tryServe(ss);
    }

  }, Math.round((200 + ss.cfg.servingTimeMs) / _speedMult));
}

function _spawnCustomer(ss) {
  if (ss.dayOver) return;
  const container = document.getElementById('scene-customers');

  const palette = CUSTOMER_PALETTES[Math.floor(Math.random() * CUSTOMER_PALETTES.length)];
  const el = document.createElement('div');
  el.className = 'walking-customer';
  el.innerHTML = buildCustomerSVG(palette);
  const yJitter = Math.floor(Math.random() * 3) * 4;
  el.style.bottom = (44 - yJitter) + 'px';
  el.style.left   = '-60px';
  container.appendChild(el);

  // Assign a walk-target slot based on current queue depth + in-transit customers
  // so concurrent walkers don't pile up at the same x position
  const slotIdx = ss.queue.length + ss.inTransit;
  const targetX = Math.max(8, STAND_SERVE_X - (slotIdx + 1) * 36);
  const walkMs  = Math.round((targetX + 60) / 140 * 1000 / _speedMult); // speed-aware

  ss.inTransit++;

  // Double-rAF: first frame commits the DOM node at left:-60px,
  // second frame ensures the browser has painted that position
  // so the CSS transition actually starts FROM off-screen (fixes mobile).
  requestAnimationFrame(() => {
    void el.offsetLeft; // force reflow so initial position is registered
    requestAnimationFrame(() => {
      el.classList.add('is-walking');
      el.style.transition = `left ${walkMs}ms linear`;
      el.style.left = targetX + 'px';
    });
  });

  setTimeout(() => {
    ss.inTransit--;
    if (ss.dayOver) { el.remove(); return; }
    el.classList.remove('is-walking');

    // No stock â†’ immediately disappointed
    if (ss.cupsToMake <= 0 || ss.actualServed >= ss.cupsToMake) {
      ss.disappointed++;
      ss.rx.stock++;
      document.getElementById('live-disappointed').textContent = ss.disappointed + (ss.priceyCount || 0);
      document.getElementById('selling-title-hud').textContent = '😢 Out of stock!';
      document.getElementById('selling-status').textContent   = 'Sorry, no more lemonade!';
      SFX.rxStock();
      _disappointEl(el, ss, 'stock');

      updateReactionTally(ss);
      return;
    }

    // Price walk-by: location-aware pricey threshold
    // Wealthier spots (beach, market) tolerate higher prices before customers turn away
    const priceyThresh = LOCATION_PRICEY_THRESH[S.currentLocation] || 2.0;
    if (S.price > priceyThresh) {
      const overFactor = Math.min(1, (S.price - priceyThresh) / (priceyThresh * 0.5));
      if (Math.random() < overFactor * 0.75) {
        ss.priceyCount = (ss.priceyCount || 0) + 1;
        ss.rx.pricey++;
        SFX.rxPricey();
        _disappointEl(el, ss, 'price');
        updateReactionTally(ss);
        document.getElementById('live-disappointed').textContent = ss.disappointed + (ss.priceyCount || 0);
        return;
      }
    }

    // Join queue and reposition everyone
    el.classList.add('is-waiting');
    const item = { el, patienceTimer: null };
    ss.queue.push(item);
    _repositionQueue(ss);

    // Patience timer — starts on arrival
    item.patienceTimer = setTimeout(() => {
      const idx = ss.queue.indexOf(item);
      if (idx !== -1) {
        ss.queue.splice(idx, 1);
        _repositionQueue(ss);
        el.classList.remove('is-waiting');
        ss.disappointed++;
        ss.rx.wait++;
        document.getElementById('live-disappointed').textContent = ss.disappointed + (ss.priceyCount || 0);
        document.getElementById('selling-status').textContent = `${ss.disappointed} gave up waiting 😔`;
        SFX.rxWait();
        _disappointEl(el, ss, 'wait');

        updateReactionTally(ss);
      }
    }, Math.round(ss.cfg.patienceMs / _speedMult));

    _tryServe(ss);
  }, walkMs + 40);
}

function renderSelling(preResult) {
  updateSellInfoBar();
  setupScene();

  const cfg = getServingConfig();

  // Reset HUD
  document.getElementById('live-cups-sold').textContent     = '0';
  document.getElementById('live-revenue').textContent       = '$0.00';
  document.getElementById('live-disappointed').textContent  = '0';
  document.getElementById('selling-title-hud').textContent  = 'Stand is Open! 🍋';
  document.getElementById('selling-status').textContent     = 'Customers arriving...';
  document.getElementById('soldout-overlay').classList.remove('show');

  // Build simulation state
  const ss = {
    demand:           preResult.demand,
    cupsToMake:       S.recipe.cupsToMake,
    actualServed:     0,
    disappointed:     0,
    priceyCount:      0,
    yuckServed:       0,
    // Reaction tallies
    rx: { amazing:0, delicious:0, gross:0, pricey:0, wait:0, stock:0 },
    pitcherRemaining: cfg.pitcherCap,
    isRefilling:      false,
    counterBusy:      false,
    queue:            [],
    inTransit:        0,
    spawnedCount:     0,
    dayOver:          false,
    preResult,
    cfg,
    liveInv: {
      lemons: S.inventory.lemons,
      sugar:  S.inventory.sugar,
      cups:   S.inventory.cups,
      ice:    S.inventory.ice,
    },
    _dayTimer:        null,
    _spawnTimer:      null,
    _speedMult:       1,
    _dayStartWall:    Date.now(),
    _dayElapsedGame:  0,
    _dayDurationMs:   cfg.dayDurationMs,
  };

  // Register as active sim and reset speed state
  _activeSS  = ss;
  _speedMult = 1;
  const speedBtn = document.getElementById('speed-btn');
  if (speedBtn) { speedBtn.textContent = '▶ 1×'; speedBtn.classList.remove('fast'); }
  _setSkipDayButton(ss.cupsToMake <= 0);

  // Reset expression panel counters to 0
  ['rx-amazing','rx-delicious','rx-gross','rx-pricey','rx-wait','rx-stock']
    .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });

  updatePitcherUI(ss, cfg);
  updateSellLiveInv(ss);
  startDayProgressBar(cfg.dayDurationMs);

  // Spawn customers over the day
  let spawnCount = 0;
  const avgInterval = cfg.dayDurationMs / Math.max(1, ss.demand * 1.35 + 1);

  function doSpawn() {
    if (ss.dayOver || spawnCount >= ss.demand) return;
    spawnCount++;
    ss.spawnedCount = spawnCount;
    _spawnCustomer(ss);
    if (spawnCount < ss.demand) {
      const jitter = avgInterval * (0.45 + Math.random() * 0.5) / _speedMult;
      ss._spawnTimer = setTimeout(doSpawn, jitter);
    }
  }

  if (ss.demand > 0) {
    ss._spawnTimer = setTimeout(doSpawn, 250);
  } else {
    document.getElementById('selling-title-hud').textContent = 'Slow day...';
    document.getElementById('selling-status').textContent    = 'No customers today 😢';
  }

  // Day end timer
  ss._dayTimer = setTimeout(() => _endSellingDay(ss), cfg.dayDurationMs);
}

function updateSellLiveInv(ss) {
  const r = S.recipe;
  const eff = upgradeEffects();
  if (ss.actualServed > 0) {
    ss.liveInv.lemons = Math.max(0, S.inventory.lemons - ss.actualServed * r.lemonsPerCup * eff.lemonMult);
    ss.liveInv.sugar  = Math.max(0, S.inventory.sugar  - ss.actualServed * r.sugarPerCup);
    ss.liveInv.cups   = Math.max(0, S.inventory.cups   - ss.actualServed);
    ss.liveInv.ice    = Math.max(0, S.inventory.ice    - ss.actualServed * r.icePerCup    * eff.iceMult);
  }
  const strip = document.getElementById('sell-inv-strip');
  if (!strip) return;
  strip.innerHTML = [
    { k:'lemons', e:'🍋', n:'Lemons' },
    { k:'sugar',  e:'🍬', n:'Sugar'  },
    { k:'cups',   e:'🥤', n:'Cups'   },
    { k:'ice',    e:'🧊', n:'Ice'    },
  ].map(({k,e,n}) => {
    const qty = ss.liveInv[k];
    const low = qty === 0;
    return `<div class="sell-inv-chip${low?' low':''}">
      <span class="sic-emoji">${e}</span>
      <span class="sic-qty">${qty}</span>
      <span class="sic-name">${n}</span>
    </div>`;
  }).join('');
}

function updateReactionTally(ss) {
  const rx = ss.rx;
  const map = [
    { id:'rx-amazing',   n: rx.amazing   },
    { id:'rx-delicious', n: rx.delicious },
    { id:'rx-gross',     n: rx.gross     },
    { id:'rx-pricey',    n: rx.pricey    },
    { id:'rx-wait',      n: rx.wait      },
    { id:'rx-stock',     n: rx.stock     },
  ];
  map.forEach(({ id, n }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = parseInt(el.textContent) || 0;
    el.textContent = n;
    if (n > prev) {
      // bump animation on parent card
      const card = el.closest('.rxp-item');
      if (card) {
        card.classList.add('bump');
        setTimeout(() => card.classList.remove('bump'), 200);
      }
    }
  });
}

function _endSellingDay(ss, options = {}) {
  if (ss.dayOver) return;
  ss.dayOver = true;
  clearTimeout(ss._spawnTimer);

  // Clean up speed state
  _activeSS  = null;
  _speedMult = 1;
  const speedBtn = document.getElementById('speed-btn');
  if (speedBtn) { speedBtn.textContent = '▶ 1×'; speedBtn.classList.remove('fast'); }
  _setSkipDayButton(false);
  // Fade out music gracefully
  scheduleMusicStop(800);

  // Dismiss any waiting customers
  _dismissQueue(ss);

  // Title & status
  const soldOut = ss.cupsToMake > 0 && ss.actualServed >= ss.cupsToMake;
  if (!soldOut && !options.keepTitle) {
    if (ss.actualServed === 0) {
      document.getElementById('selling-title-hud').textContent = 'Slow day...';
      document.getElementById('selling-status').textContent    = 'No sales today 😢';
    } else {
      document.getElementById('selling-title-hud').textContent = 'Day Complete!';
      document.getElementById('selling-status').textContent    = `Served ${ss.actualServed} cup${ss.actualServed !== 1 ? 's' : ''}`;
    }
  }

  // Build actual result from real simulation
  const pr = ss.preResult;
  const rent = LOCATIONS[S.currentLocation]?.rent || 0;
  const revenue = ss.actualServed * S.price;
  // Extra rep penalties from customer expressions
  const priceyPenalty = Math.floor((ss.priceyCount || 0) / 3);
  const yuckPenalty   = Math.floor((ss.yuckServed  || 0) / 2);
  const baseRepDelta  = calcRepDelta(pr.tasteScore, ss.actualServed, ss.cupsToMake);
  // Cost of goods sold = only what was actually served (not pre-planned cupsToMake)
  const cost = calcIngredientCost(S.recipe, ss.actualServed);
  // Ad spend was already deducted from coins when hired - include here for display only
  const adSpend = ADS.reduce((sum, ad) => sum + (S.adsToday[ad.id] ? ad.cost : 0), 0);
  const actualResult = {
    ...pr,
    cupsSold: ss.actualServed,
    revenue,
    rent,
    cost,
    adSpend,
    profit:   revenue - cost - rent - adSpend,
    repDelta: Math.max(-20, baseRepDelta - priceyPenalty - yuckPenalty),
    rx:       { ...ss.rx },
  };
  if (options.immediate) {
    finishSelling(actualResult);
    return;
  }
  const delay = soldOut ? 2400 : 1600;
  setTimeout(() => finishSelling(actualResult), delay);
}

function finishSelling(result) {
  const coinsBefore = S.coins;
  applyDayResults(result);

  const soldOut = result.cupsSold >= S.recipe.cupsToMake && S.recipe.cupsToMake > 0;
  if (soldOut) {
    SFX.soldOut();
    setTimeout(() => spawnConfetti(32), 200);
  } else if (result.tasteScore < 0.45) {
    SFX.poorReview();
  } else {
    SFX.coin();
  }

  // Coin burst from top-bar
  const coinEl = document.getElementById('coin-display');
  if (coinEl && result.profit > 0) spawnCoinBurst(coinEl, Math.min(8, Math.ceil(result.profit / 2)));

  animateCoinCounter(coinsBefore, S.coins);
  S.phase = 'result';
  showScreen('result');
  renderResult(result);
  saveState();
}

// â”€â”€ RESULT SCREEN â”€â”€
function renderResult(result = S.dayResult) {
  if (!result) return;

  const profitEl = document.getElementById('result-profit-val');
  profitEl.textContent = (result.profit >= 0 ? '+' : '') + fmt(result.profit);
  profitEl.className = result.profit >= 0 ? 'positive' : 'negative';

  const breakdownParts = [fmt(result.revenue) + ' revenue'];
  breakdownParts.push('− ' + fmt(result.cost) + ' cost of sales');
  if (result.rent > 0) breakdownParts.push('− ' + fmt(result.rent) + ' rent');
  if (result.adSpend > 0) breakdownParts.push('− ' + fmt(result.adSpend) + ' ads');
  if (S.franchiseIncome > 0) breakdownParts.push('+ ' + fmt(S.franchiseIncome) + ' franchise');
  document.getElementById('result-breakdown').textContent = breakdownParts.join(' ');
  const tl = tasteLabel(result.tasteScore);
  document.getElementById('result-stars').textContent = tl.stars;
  document.getElementById('result-taste-lbl').textContent = tl.label;

  document.getElementById('result-cups-sold').textContent = result.cupsSold + ' / ' + S.recipe.cupsToMake;
  document.getElementById('result-revenue').textContent = fmt(result.revenue);
  document.getElementById('result-cost').textContent = fmt(result.cost);
  const rentRow = document.getElementById('result-rent-row');
  if (result.rent > 0) {
    rentRow.style.display = '';
    document.getElementById('result-rent').textContent = '−' + fmt(result.rent);
  } else {
    rentRow.style.display = 'none';
  }
  const adRow = document.getElementById('result-adspend-row');
  if (result.adSpend > 0) {
    adRow.style.display = '';
    document.getElementById('result-adspend').textContent = '−' + fmt(result.adSpend);
  } else {
    adRow.style.display = 'none';
  }

  const rd = document.getElementById('result-rep-delta');
  rd.textContent = (result.repDelta >= 0 ? '+' : '') + result.repDelta + ' rep';
  rd.className = 'rep-delta ' + (result.repDelta >= 0 ? 'pos' : 'neg');

  const rx = {
    amazing: result.rx?.amazing || 0,
    delicious: result.rx?.delicious || 0,
    gross: result.rx?.gross || 0,
    pricey: result.rx?.pricey || 0,
    wait: result.rx?.wait || 0,
    stock: result.rx?.stock || 0,
  };
  document.getElementById('result-rx-amazing').textContent = rx.amazing;
  document.getElementById('result-rx-delicious').textContent = rx.delicious;
  document.getElementById('result-rx-gross').textContent = rx.gross;
  document.getElementById('result-rx-pricey').textContent = rx.pricey;
  document.getElementById('result-rx-wait').textContent = rx.wait;
  document.getElementById('result-rx-stock').textContent = rx.stock;
  document.getElementById('result-rx-total').textContent = rx.amazing + rx.delicious + rx.gross + rx.pricey + rx.wait + rx.stock;

  // Event bonus card
  const bonusCard = document.getElementById('result-event-bonus');
  if (S.franchiseIncome > 0) {
    bonusCard.style.display = 'block';
    document.getElementById('result-event-text').textContent = '🏆 Franchise stand earned ' + fmt(S.franchiseIncome) + ' passive income!';
  } else {
    bonusCard.style.display = 'none';
  }

  document.getElementById('next-day-num').textContent = S.day + 1;
}




