'use strict';

// D. SOUND ENGINE
// -----------------------------------------------

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function playTone({ type='sine', freq=440, duration=0.2, gain=0.4, startDelay=0 }) {
  if (!S.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol); vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(gain, ctx.currentTime + startDelay);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
    osc.start(ctx.currentTime + startDelay);
    osc.stop(ctx.currentTime + startDelay + duration + 0.05);
  } catch(e) {}
}

function playNoiseBurst(duration=0.05, startDelay=0) {
  if (!S.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = ctx.createBufferSource();
    const vol = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 800;
    src.buffer = buf;
    src.connect(filt); filt.connect(vol); vol.connect(ctx.destination);
    vol.gain.setValueAtTime(0.2, ctx.currentTime + startDelay);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);
    src.start(ctx.currentTime + startDelay);
  } catch(e) {}
}

const SFX = {
  coin()       { playTone({ type:'sine', freq:880, duration:0.18, gain:0.35 }); setTimeout(()=>playTone({ type:'sine', freq:1100, duration:0.15, gain:0.2 }),80); },
  customer()   { playNoiseBurst(0.05); },
  soldOut()    { [523,659,784,1047].forEach((f,i) => playTone({ freq:f, duration:0.25, gain:0.3, startDelay:i*0.12 })); },
  poorReview() { [392,330,262,220].forEach((f,i) => playTone({ freq:f, duration:0.25, gain:0.25, startDelay:i*0.12 })); },
  achievement(){ [523,659,784].forEach((f,i) => { playTone({ type:'triangle', freq:f, duration:0.35, gain:0.2, startDelay:i*0.1 }); playTone({ freq:f*2, duration:0.35, gain:0.1, startDelay:i*0.1+0.3 }); }); },
  tap()        { playTone({ type:'triangle', freq:600, duration:0.06, gain:0.15 }); },
  unlock()     { playTone({ freq:440, duration:0.1, gain:0.2 }); playTone({ freq:660, duration:0.15, gain:0.25, startDelay:0.1 }); },
  // Expression-specific sounds
  rxAmazing()  { [880,1100,1320,1760].forEach((f,i)=>playTone({freq:f,duration:0.1,gain:0.18,startDelay:i*0.055})); },
  rxDelicious(){ playTone({freq:880,duration:0.1,gain:0.18}); playTone({freq:1100,duration:0.12,gain:0.16,startDelay:0.09}); },
  rxGood()     { playTone({type:'triangle',freq:700,duration:0.1,gain:0.14}); },
  rxMeh()      { playTone({type:'triangle',freq:440,duration:0.14,gain:0.1}); },
  rxGross()    { playTone({freq:350,duration:0.12,gain:0.18}); playTone({freq:260,duration:0.15,gain:0.18,startDelay:0.1}); },
  rxPricey()   { playTone({type:'triangle',freq:520,duration:0.07,gain:0.12}); playTone({type:'triangle',freq:380,duration:0.1,gain:0.12,startDelay:0.08}); },
  rxWait()     { playTone({type:'triangle',freq:300,duration:0.18,gain:0.1}); },
  rxStock()    { playTone({freq:220,duration:0.2,gain:0.12}); },
  // UI / game events
  buy()        { playTone({type:'triangle',freq:740,duration:0.08,gain:0.2}); playTone({type:'triangle',freq:987,duration:0.1,gain:0.18,startDelay:0.07}); },
  hire()       { [440,554,659].forEach((f,i)=>playTone({type:'triangle',freq:f,duration:0.18,gain:0.18,startDelay:i*0.09})); },
  nextDay()    { [523,659].forEach((f,i)=>playTone({freq:f,duration:0.15,gain:0.22,startDelay:i*0.12})); },
  dayOpen()    { [392,494,587,740].forEach((f,i)=>playTone({type:'triangle',freq:f,duration:0.2,gain:0.18,startDelay:i*0.08})); },
  weatherAlert(){ playTone({type:'triangle',freq:660,duration:0.12,gain:0.18}); playTone({type:'triangle',freq:440,duration:0.15,gain:0.14,startDelay:0.14}); },
  locationPick(){ playTone({type:'triangle',freq:587,duration:0.09,gain:0.15}); playTone({type:'triangle',freq:784,duration:0.12,gain:0.15,startDelay:0.1}); },
  error()      { playTone({freq:280,duration:0.15,gain:0.25}); playTone({freq:220,duration:0.18,gain:0.22,startDelay:0.12}); },
};

// -----------------------------------------------
// D2. BACKGROUND MUSIC ENGINE
// -----------------------------------------------

// Upbeat lemonade-stand tune in C major, 128 BPM
const _BPM  = 128;
const _BEAT = 60 / _BPM; // seconds per quarter note

// Melody line: [freq_hz, quarter_note_duration]  (0 = rest)
const _MELODY = [
  // Phrase A - catchy opener
  [659,0.5],[784,0.5],[880,1],   [784,0.5],[659,0.5],
  [523,0.5],[587,0.5],[659,1.5],[0,0.5],
  // Phrase B - goes up
  [784,0.5],[880,0.5],[988,1],   [880,0.5],[784,0.5],
  [659,0.5],[784,0.5],[880,2],
  // Phrase C - bridge
  [988,0.5],[1047,0.5],[988,0.5],[880,0.5],
  [784,0.5],[880,0.5],[784,0.5],[659,0.5],
  [587,0.5],[659,0.5],[784,1],  [0,1],
  // Phrase D - resolve home
  [659,0.5],[784,0.5],[880,0.5],[784,0.5],
  [659,0.5],[523,0.5],[659,0.5],[523,1.5],[0,0.5],
];

// Bass counter-melody
const _BASS = [
  [262,2],[196,2],
  [220,2],[262,2],
  [294,2],[330,2],
  [262,2],[196,2],
  [220,2],[262,2],
  [294,2],[392,2],
  [349,2],[330,2],
  [262,4],
];

// Chord stabs (background harmony pads)
const _CHORDS = [
  [[262,330,392], 4],   // C maj
  [[196,247,294], 4],   // G
  [[220,277,330], 4],   // A min
  [[196,247,294], 4],   // G
  [[175,220,262], 4],   // F
  [[220,277,330], 4],   // A min
  [[196,247,294], 4],   // G
  [[262,330,392], 4],   // C maj
];

let _music = { on: false, mStep:0, bStep:0, cStep:0, mTimer:null, bTimer:null, cTimer:null, stopTimer:null, runId:0 };

function musicStart() {
  if (!S.musicEnabled) return;
  clearTimeout(_music.stopTimer);
  musicStop();
  _music.runId += 1;
  _music.on = true;
  _music.mStep = 0; _music.bStep = 0; _music.cStep = 0;
  _mMelody(_music.runId); _mBass(_music.runId); _mChord(_music.runId);
}

function musicStop() {
  _music.on = false;
  clearTimeout(_music.stopTimer);
  clearTimeout(_music.mTimer);
  clearTimeout(_music.bTimer);
  clearTimeout(_music.cTimer);
}

function scheduleMusicStop(delay = 0) {
  clearTimeout(_music.stopTimer);
  if (delay <= 0) {
    musicStop();
    return;
  }
  _music.stopTimer = setTimeout(() => musicStop(), delay);
}

function _mMelody(runId) {
  if (!_music.on || !S.musicEnabled || runId !== _music.runId) return;
  const [f, b] = _MELODY[_music.mStep % _MELODY.length];
  const dur = b * _BEAT;
  if (f > 0) playToneRaw({ type:'triangle', freq:f, duration:dur*0.72, gain:0.06 });
  _music.mStep++;
  _music.mTimer = setTimeout(() => _mMelody(runId), dur * 1000);
}

function _mBass(runId) {
  if (!_music.on || !S.musicEnabled || runId !== _music.runId) return;
  const [f, b] = _BASS[_music.bStep % _BASS.length];
  const dur = b * _BEAT;
  if (f > 0) playToneRaw({ type:'sine', freq:f, duration:dur*0.55, gain:0.045 });
  _music.bStep++;
  _music.bTimer = setTimeout(() => _mBass(runId), dur * 1000);
}

function _mChord(runId) {
  if (!_music.on || !S.musicEnabled || runId !== _music.runId) return;
  const [notes, b] = _CHORDS[_music.cStep % _CHORDS.length];
  const dur = b * _BEAT;
  notes.forEach(f => playToneRaw({ type:'sine', freq:f, duration:dur*0.4, gain:0.018 }));
  _music.cStep++;
  _music.cTimer = setTimeout(() => _mChord(runId), dur * 1000);
}

// Raw tone (bypasses S.soundEnabled - music has own toggle)
function playToneRaw({ type='sine', freq=440, duration=0.2, gain=0.3 }) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol); vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  } catch(e) {}
}

// -----------------------------------------------
// D3. JUICE - PARTICLES, SCREEN FEEL, ANIMATION
// -----------------------------------------------

// Spawn flying coin particles from a source element
function spawnCoinBurst(sourceEl, count = 5) {
  const rect = sourceEl ? sourceEl.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2, width:0, height:0 };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'coin-particle';
    el.textContent = '🍋';
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist  = 40 + Math.random() * 60;
    el.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    el.style.setProperty('--dy', Math.sin(angle) * dist - 30 + 'px');
    el.style.left = cx + 'px';
    el.style.top  = cy + 'px';
    el.style.animationDelay = (i * 0.06) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900 + i * 60);
  }
}

// Confetti burst for big wins (sold out, achievement)
function spawnConfetti(count = 28) {
  const colors = ['#FFD700','#FF8C00','#4CAF50','#2196F3','#E91E63','#9C27B0','#FF5722','#00BCD4'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.left = (20 + Math.random() * 60) + 'vw';
    el.style.top  = '-10px';
    const dx = (Math.random() - 0.5) * 120;
    const dy = 220 + Math.random() * 180;
    const rot = (Math.random() - 0.5) * 720;
    el.style.setProperty('--dx', dx + 'px');
    el.style.setProperty('--dy', dy + 'px');
    el.style.setProperty('--rot', rot + 'deg');
    el.style.setProperty('--dur', (0.9 + Math.random() * 0.6) + 's');
    el.style.animationDelay = (Math.random() * 0.3) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}

// Bounce the stand visually (Amazing reaction)
function bounceStand() {
  ['scene-stand-wrapper','day-stand'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('stand-bounce','stand-shake');
    void el.offsetWidth; // reflow
    el.classList.add('stand-bounce');
    setTimeout(() => el.classList.remove('stand-bounce'), 600);
  });
}

// Shake the stand (Gross reaction)
function shakeStand() {
  const el = document.getElementById('scene-stand-wrapper');
  if (!el) return;
  el.classList.remove('stand-bounce','stand-shake');
  void el.offsetWidth;
  el.classList.add('stand-shake');
  setTimeout(() => el.classList.remove('stand-shake'), 500);
}

// Ripple effect on button click
function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const rpl  = document.createElement('span');
  rpl.className = 'ripple-wave';
  rpl.style.width = rpl.style.height = size + 'px';
  rpl.style.left  = (e.clientX - rect.left  - size/2) + 'px';
  rpl.style.top   = (e.clientY - rect.top   - size/2) + 'px';
  btn.classList.add('ripple-host');
  btn.appendChild(rpl);
  setTimeout(() => rpl.remove(), 600);
}

// Float music note near stand (when music is playing)
function floatMusicNote() {
  if (!_music.on) return;
  const el = document.getElementById('scene-stand-wrapper') || document.getElementById('day-stand');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const note = document.createElement('div');
  note.className = 'music-note-float';
    const notes = ['🎵','🎶','♪','♩'];
  note.textContent = notes[Math.floor(Math.random() * notes.length)];
  note.style.left = (rect.left + rect.width * Math.random()) + 'px';
  note.style.top  = (rect.top  + rect.height * 0.2) + 'px';
  note.style.setProperty('--dx', (Math.random() - 0.5) * 40 + 'px');
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 1500);
}

// -----------------------------------------------
// E. GAME ENGINE
// -----------------------------------------------

