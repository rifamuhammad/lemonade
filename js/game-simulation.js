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

// Visual extras injected into the stand SVG based on owned upgrades
function buildStandExtras(u) {
  const parts = [];

  // Juicer / Power Juicer — orange juicer machine on left counter
  if (u.juicer || u.powerjuicer) {
    const c = u.powerjuicer ? '#FFA000' : '#FF8C00';
    parts.push(`
      <rect x="7" y="85" width="13" height="19" fill="${c}" rx="3"/>
      <circle cx="13" cy="91" r="5" fill="#FFF176" stroke="${c}" stroke-width="1.5"/>
      <rect x="10" y="97" width="7" height="7" fill="#795548" rx="1.5"/>
      ${u.powerjuicer ? '<text x="13" y="110" text-anchor="middle" font-size="6" fill="#FFA000">⚡</text>' : '<text x="13" y="110" text-anchor="middle" font-size="6" fill="#FF8C00">🍊</text>'}
    `);
  }

  // EZserve Cash Register — grey register on right counter
  if (u.register) {
    parts.push(`
      <rect x="111" y="85" width="21" height="19" fill="#37474F" rx="3"/>
      <rect x="113" y="87" width="17" height="9" fill="#4FC3F7" rx="2" opacity="0.85"/>
      <rect x="115" y="90" width="13" height="4" fill="white" rx="1" opacity="0.5"/>
      <rect x="113" y="98" width="17" height="4" fill="#263238" rx="1"/>
      <text x="121" y="109" text-anchor="middle" font-size="6" fill="#4FC3F7">💳</text>
    `);
  }

  // Take2 Dispenser — robot machine center counter
  if (u.dispenser) {
    parts.push(`
      <rect x="60" y="84" width="18" height="20" fill="#607D8B" rx="3"/>
      <rect x="62" y="86" width="14" height="10" fill="#455A64" rx="2"/>
      <circle cx="66" cy="90" r="2" fill="#4FC3F7"/>
      <circle cx="72" cy="90" r="2" fill="#4FC3F7"/>
      <rect x="63" y="98" width="12" height="3" fill="#00BCD4" rx="1.5"/>
      <text x="69" y="111" text-anchor="middle" font-size="6" fill="#607D8B">🤖</text>
    `);
  }

  // Sound System — speakers on both sides
  if (u.soundsystem) {
    parts.push(`
      <rect x="0" y="48" width="11" height="20" fill="#212121" rx="2"/>
      <circle cx="5" cy="56" r="4" fill="#333"/>
      <circle cx="5" cy="56" r="2" fill="#616161"/>
      <rect x="1" y="65" width="9" height="3" fill="#333" rx="1"/>
      <rect x="127" y="48" width="11" height="20" fill="#212121" rx="2"/>
      <circle cx="133" cy="56" r="4" fill="#333"/>
      <circle cx="133" cy="56" r="2" fill="#616161"/>
      <rect x="128" y="65" width="9" height="3" fill="#333" rx="1"/>
      <text x="5" y="44" text-anchor="middle" font-size="7">🎵</text>
    `);
  }

  // Neon System — glowing coloured strips
  if (u.neon) {
    parts.push(`
      <rect x="3" y="79" width="132" height="3" fill="#FF1493" rx="1.5" opacity="0.9"/>
      <rect x="3" y="101" width="132" height="3" fill="#00E5FF" rx="1.5" opacity="0.9"/>
      <rect x="3" y="83" width="132" height="1" fill="#FF69B4" rx="0.5" opacity="0.5"/>
    `);
  }

  // Mr. Fridge — blue fridge left of stand
  if (u.fridge) {
    parts.push(`
      <rect x="0" y="97" width="11" height="27" fill="#4DD0E1" rx="3"/>
      <rect x="2" y="99" width="7" height="11" fill="#E0F7FA" rx="1.5"/>
      <rect x="2" y="112" width="7" height="10" fill="#E0F7FA" rx="1.5"/>
      <circle cx="8" cy="118" r="1" fill="#4DD0E1"/>
      <text x="5" y="131" text-anchor="middle" font-size="6" fill="#00838F">❄️</text>
    `);
  }

  // Ice-O-Matic Dispenser — compact ice machine
  if (u.iceomatic && !u.icemaker) {
    parts.push(`
      <rect x="122" y="90" width="16" height="22" fill="#26C6DA" rx="3"/>
      <rect x="124" y="92" width="12" height="12" fill="#00BCD4" rx="2"/>
      <text x="130" y="101" text-anchor="middle" font-size="5.5" fill="white" font-weight="bold">ICE</text>
      <rect x="125" y="106" width="10" height="3" fill="#00838F" rx="1"/>
    `);
  }

  // High Output Auto Ice Maker — big ice factory
  if (u.icemaker) {
    parts.push(`
      <rect x="121" y="84" width="17" height="30" fill="#0277BD" rx="3"/>
      <rect x="123" y="86" width="13" height="16" fill="#0288D1" rx="2"/>
      <text x="129" y="96" text-anchor="middle" font-size="5" fill="white" font-weight="bold">AUTO</text>
      <text x="129" y="103" text-anchor="middle" font-size="5" fill="white" font-weight="bold">ICE</text>
      <rect x="124" y="105" width="10" height="5" fill="#01579B" rx="1.5"/>
      <text x="129" y="120" text-anchor="middle" font-size="6" fill="#0288D1">🏭</text>
    `);
  }

  // ShadeMaker Canopy — green shade extensions above awning
  if (u.canopy) {
    parts.push(`
      <ellipse cx="69" cy="14" rx="76" ry="8" fill="#43A047" opacity="0.45"/>
      <ellipse cx="69" cy="10" rx="70" ry="6" fill="#66BB6A" opacity="0.35"/>
      <text x="10" y="18" font-size="10">⛱️</text>
    `);
  }

  return parts.join('');
}

function buildStandSVG() {
  const tier = Math.min(3, S.standTier || 0);

  // Tier-specific colour themes
  const themes = [
    { awning1:'#FF8C00', awning2:'#FFD700', fringe:'#F9A825', pole:'#6D4C41', counter:'#8D6E63', body:'#EFCFA0', panel:'#E8BE88', sign:'#FFFDE7', signBorder:'#FF8C00', signText:'🍋 LEMONADE',  extra:'' },
    { awning1:'#1565C0', awning2:'#FFFFFF', fringe:'#90CAF9', pole:'#5D4037', counter:'#5D4037', body:'#FAFAFA',  panel:'#ECEFF1', sign:'#E3F2FD', signBorder:'#1565C0', signText:'🏪 CLASSIC',    extra:'<rect x="55" y="16" width="28" height="6" fill="#1565C0" rx="2"/><rect x="62" y="10" width="14" height="8" fill="#1565C0" rx="2"/>' },
    { awning1:'#C62828', awning2:'#FFD700', fringe:'#FF8F00', pole:'#4E342E', counter:'#4E342E', body:'#FFF8E1',  panel:'#FFE082', sign:'#FFECB3', signBorder:'#C62828', signText:'🍋 LEMON PALACE', extra:'<circle cx="69" cy="9" r="7" fill="#FFD700"/><text x="69" y="13" text-anchor="middle" font-size="9" fill="#C62828">â˜…</text>' },
    { awning1:'#4A148C', awning2:'#FFD700', fringe:'#CE93D8', pole:'#311B92', counter:'#311B92', body:'#F3E5F5',  panel:'#E1BEE7', sign:'#EDE7F6', signBorder:'#4A148C', signText:'👑 LEMON EMPIRE', extra:'<rect x="52" y="0" width="12" height="10" fill="#4A148C"/><rect x="67" y="0" width="12" height="10" fill="#4A148C"/><rect x="82" y="0" width="12" height="10" fill="#4A148C"/><rect x="57" y="6" width="6" height="14" fill="#4A148C"/><rect x="72" y="6" width="6" height="14" fill="#4A148C"/><rect x="87" y="6" width="6" height="14" fill="#4A148C"/>' },
  ];
  const t = themes[tier];

  return `<svg viewBox="0 0 138 158" width="138" height="158" xmlns="http://www.w3.org/2000/svg">
  ${t.extra}
  <!-- Pole -->
  <rect x="65" y="22" width="6" height="92" fill="${t.pole}" rx="3"/>
  <!-- Awning base shape -->
  <path d="M4,38 Q70,2 134,38 Z" fill="${t.awning1}"/>
  <!-- Awning alternating panels -->
  <path d="M4,38 Q25,10 46,7 L70,35 Z"     fill="${t.awning2}"/>
  <path d="M46,7  Q70,2  70,2  L70,35 Z"   fill="${t.awning1}"/>
  <path d="M70,2  Q94,2  92,7  L70,35 Z"   fill="${t.awning2}"/>
  <path d="M92,7  Q112,12 134,38 L70,35 Z" fill="${t.awning1}"/>
  <!-- Awning scallop border -->
  <path d="M4,38 Q14,51 24,38 Q34,51 44,38 Q54,51 64,38 Q74,51 84,38 Q94,51 104,38 Q114,51 124,38 Q129,44 134,38"
        fill="none" stroke="${t.fringe}" stroke-width="2.5" stroke-linecap="round"/>
  <!-- Fringe tassels -->
  <line x1="9"   y1="40" x2="7"   y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <line x1="19"  y1="47" x2="17"  y2="57" stroke="${t.awning1}" stroke-width="2" stroke-linecap="round"/>
  <line x1="29"  y1="40" x2="27"  y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <line x1="39"  y1="46" x2="37"  y2="56" stroke="${t.awning1}" stroke-width="2" stroke-linecap="round"/>
  <line x1="49"  y1="40" x2="47"  y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <line x1="59"  y1="46" x2="57"  y2="56" stroke="${t.awning1}" stroke-width="2" stroke-linecap="round"/>
  <line x1="69"  y1="40" x2="67"  y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <line x1="79"  y1="46" x2="77"  y2="56" stroke="${t.awning1}" stroke-width="2" stroke-linecap="round"/>
  <line x1="89"  y1="40" x2="87"  y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <line x1="99"  y1="46" x2="97"  y2="56" stroke="${t.awning1}" stroke-width="2" stroke-linecap="round"/>
  <line x1="109" y1="40" x2="107" y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <line x1="119" y1="46" x2="117" y2="56" stroke="${t.awning1}" stroke-width="2" stroke-linecap="round"/>
  <line x1="129" y1="40" x2="127" y2="50" stroke="${t.awning2}" stroke-width="2" stroke-linecap="round"/>
  <!-- Sign board -->
  <rect x="12" y="84" width="114" height="20" fill="${t.sign}" rx="5" stroke="${t.signBorder}" stroke-width="1.5"/>
  <text x="69" y="98" text-anchor="middle" font-size="${tier >= 2 ? 9 : 10}" fill="#1A1A2E"
        font-family="'Fredoka One',cursive" font-weight="bold">${t.signText}</text>
  <!-- Counter top -->
  <rect x="4"  y="104" width="130" height="9" fill="${t.counter}" rx="4"/>
  <!-- Counter body -->
  <rect x="7"  y="113" width="124" height="38" fill="${t.body}" rx="4"/>
  <!-- Counter panel -->
  <rect x="11" y="118" width="116" height="28" fill="${t.panel}" rx="3"/>
  <!-- Dividers -->
  <line x1="48"  y1="113" x2="48"  y2="151" stroke="${t.counter}" stroke-width="1" opacity="0.4"/>
  <line x1="90"  y1="113" x2="90"  y2="151" stroke="${t.counter}" stroke-width="1" opacity="0.4"/>
  <!-- Lemon pitcher -->
  <rect x="56" y="91" width="22" height="16" fill="#FFD700" rx="7"/>
  <ellipse cx="67" cy="91" rx="11" ry="4.5" fill="#FFF176"/>
  <path d="M78,95 Q87,95 87,101 Q87,107 78,107" fill="none" stroke="#F9A825" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="67" cy="90" rx="6" ry="3" fill="#FFEE58" opacity="0.75"/>
  <!-- Paper cups left -->
  <path d="M16,104 L18,89 L28,89 L30,104 Z" fill="white" stroke="#90CAF9" stroke-width="1" opacity="0.95"/>
  <path d="M32,104 L34,89 L44,89 L46,104 Z" fill="white" stroke="#90CAF9" stroke-width="1" opacity="0.95"/>
  <line x1="21" y1="89" x2="19" y2="80" stroke="#FF8C00" stroke-width="1.5" stroke-linecap="round"/>
  <!-- Ice bucket right -->
  <rect x="94" y="93" width="28" height="15" fill="#B3E5FC" rx="5"/>
  <ellipse cx="108" cy="93" rx="14" ry="5" fill="#E1F5FE"/>
  <rect x="97"  y="96" width="7"  height="7" fill="white" rx="1.5" opacity="0.8"/>
  <rect x="106" y="97" width="7"  height="6" fill="white" rx="1.5" opacity="0.8"/>
  <rect x="101" y="100" width="6" height="6" fill="white" rx="1.5" opacity="0.8"/>
  <!-- Lemon deco left side -->
  <circle cx="24" cy="62" r="9" fill="#FFD700"/>
  <ellipse cx="24" cy="62" rx="5.5" ry="7" fill="#FFEE58"/>
  <line x1="24" y1="55" x2="24" y2="69" stroke="#F9A825" stroke-width="0.8"/>
  <line x1="17" y1="62" x2="31" y2="62" stroke="#F9A825" stroke-width="0.8"/>
  <!-- Lemon deco right side -->
  <circle cx="114" cy="62" r="9" fill="#FFD700"/>
  <ellipse cx="114" cy="62" rx="5.5" ry="7" fill="#FFEE58"/>
  <line x1="114" y1="55" x2="114" y2="69" stroke="#F9A825" stroke-width="0.8"/>
  <line x1="107" y1="62" x2="121" y2="62" stroke="#F9A825" stroke-width="0.8"/>
  <!-- Cashier emoji behind counter -->
  <text x="68" y="136" text-anchor="middle" font-size="16">😊</text>
  <!-- Upgrade equipment extras (injected per owned upgrade) -->
  ${buildStandExtras(S.upgrades)}
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

// Render hired staff as visible characters beside the stand
function buildStaffOverlay() {
  const el = document.getElementById('scene-staff');
  if (!el) return;
  const hired = S.hiredToday || {};
  const STAFF_DISPLAY = [
    { id:'lady',     emoji:'👩‍🍳', name:'Lady'     },
    { id:'clown',    emoji:'🤡',   name:'Clown'    },
    { id:'musician', emoji:'🎸',   name:'Musician' },
  ];
  el.innerHTML = STAFF_DISPLAY
    .filter(s => hired[s.id])
    .map(s => `<div class="scene-staff-member">
      <span class="staff-emoji">${s.emoji}</span>
      <span class="staff-name">${s.name}</span>
    </div>`)
    .join('');
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
    : 'â° Too long!';
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

  requestAnimationFrame(() => {
    el.classList.add('is-walking');
    el.style.transition = `left ${walkMs}ms linear`;
    el.style.left = targetX + 'px';
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




