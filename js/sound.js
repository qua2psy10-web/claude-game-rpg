// ============================================================
// sound.js — Web Audio API sound effects (no external files)
// ============================================================

var SoundSystem = (function() {
  var ctx = null;
  var baseVol = 0.5;
  var seFactor = 1, ambFactor = 1, mul = false;   // player volume settings; mul is true while an ambient one-shot plays
  function masterVol() { return baseVol * (mul ? ambFactor : seFactor); }
  var muted = false;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) {
      ctx = null;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // Play a single oscillator tone
  // freq: Hz, type: oscillator type, vol: peak volume,
  // t: AudioContext start time, dur: duration in seconds, endFreq: optional glide target
  function osc(freq, type, vol, t, dur, endFreq) {
    if (!ctx || muted) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq !== undefined) {
      o.frequency.linearRampToValueAtTime(endFreq, t + dur);
    }
    g.gain.setValueAtTime(vol * masterVol(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.01);
  }

  // Play a burst of white noise (for hit/impact effects)
  function noise(vol, t, dur, maxFreq) {
    if (!ctx || muted) return;
    var len = Math.ceil(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = maxFreq || 2000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol * masterVol(), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }

  // ── Area ambience: quiet looping beds under the BGM (wind, crickets, castle drone) ──
  var amb = null, ambNoise = null;
  function noiseBuf() {
    if (ambNoise) return ambNoise;
    var len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (ambNoise = b);
  }
  function stopAmb(a) {
    if (!a) return;
    var t = ctx.currentTime;
    a.gain.gain.cancelScheduledValues(t);
    a.gain.gain.setValueAtTime(a.gain.gain.value, t);
    a.gain.gain.linearRampToValueAtTime(0, t + 1);
    setTimeout(function() {
      a.nodes.forEach(function(n) { try { n.stop(); } catch (e) {} });
      try { a.gain.disconnect(); } catch (e) {}
    }, 1300);
  }
  function startAmb(name) {
    var g = ctx.createGain(), nodes = [], level = 0.05, f, wg;
    g.gain.value = 0;
    g.connect(ctx.destination);
    var windNoise = function(freq, q, type) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf(); s.loop = true;
      var fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.value = freq; fl.Q.value = q;
      s.connect(fl); s.start(); nodes.push(s); return fl;
    };
    var lfo = function(rate, depth, target, type) {
      var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = rate;
      var d = ctx.createGain(); d.gain.value = depth; o.connect(d); d.connect(target); o.start(); nodes.push(o);
    };
    if (name === 'world' || name === 'millhaven') {            // a breeze that swells and fades
      wg = ctx.createGain(); wg.gain.value = 0.5;
      windNoise(name === 'world' ? 650 : 480, 0.6).connect(wg); wg.connect(g);
      lfo(0.13, 0.35, wg.gain);
      level = name === 'world' ? 0.06 : 0.035;
    } else if (name === 'forest') {                             // soft wind in the leaves + crickets
      wg = ctx.createGain(); wg.gain.value = 0.5;
      windNoise(380, 0.5, 'lowpass').connect(wg); wg.connect(g);
      lfo(0.1, 0.3, wg.gain);
      var cr = ctx.createOscillator(), cg = ctx.createGain(), cm = ctx.createGain();
      cr.type = 'sine'; cr.frequency.value = 4300; cg.gain.value = 0.5; cm.gain.value = 0.12;
      lfo(11, 0.5, cg.gain, 'square');
      cr.connect(cg); cg.connect(cm); cm.connect(g); cr.start(); nodes.push(cr);
      level = 0.045;
    } else if (name === 'castle') {                             // a low drone and a howling draught
      f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240; f.connect(g);
      [55, 82.7].forEach(function(fr, i) {
        var o = ctx.createOscillator(), og = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = fr; og.gain.value = i ? 0.35 : 0.6;
        o.connect(og); og.connect(f); o.start(); nodes.push(o);
        lfo(0.07 + i * 0.03, 1.2, o.frequency);
      });
      wg = ctx.createGain(); wg.gain.value = 0.4;
      windNoise(300, 1.4).connect(wg); wg.connect(g);
      lfo(0.09, 0.3, wg.gain);
      level = 0.085;
    }
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level * baseVol * ambFactor, ctx.currentTime + 1.5);
    return { name: name, gain: g, nodes: nodes, level: level };
  }

  return {
    init: init,
    setSeVolume: function(f) { seFactor = f; },
    setAmbVolume: function(f) {
      ambFactor = f;
      if (amb && ctx) {   // retarget the running bed
        var t = ctx.currentTime;
        amb.gain.gain.cancelScheduledValues(t);
        amb.gain.gain.setValueAtTime(amb.gain.gain.value, t);
        amb.gain.gain.linearRampToValueAtTime(amb.level * baseVol * f, t + 0.1);
      }
    },
    setAmbience: function(name) {
      if (!ctx || muted) name = null;
      if (name !== 'world' && name !== 'millhaven' && name !== 'forest' && name !== 'castle') name = null;
      if ((amb ? amb.name : null) === name) return;
      stopAmb(amb); amb = null;
      if (name) { resume(); amb = startAmb(name); }
    },
    birdsFar: function(forest) {          // 遠くの鳥の声 (森ではフクロウ風)
      resume();
      var t = ctx.currentTime;
      mul = true;
      if (forest) { osc(430, 'sine', 0.04, t, 0.4, 380); osc(430, 'sine', 0.04, t + 0.55, 0.45, 370); mul = false; return; }
      [0, 0.16, 0.34].forEach(function(d, i) { osc(2700 + i * 380, 'sine', 0.025, t + d, 0.09, 3400); });
      mul = false;
    },
    distantThunder: function() {          // 魔王城: 壁越しの遠雷
      resume();
      var t = ctx.currentTime;
      mul = true;
      noise(0.3, t, 1.8, 500);
      osc(48, 'sawtooth', 0.14, t, 1.3, 30);
      mul = false;
    },
    resume: resume,
    isReady: function() { return !!ctx; },
    getCtx: function() { return ctx; },    // AudioContextを共有 (MusicSystem用)
    toggleMute: function() { muted = !muted; return muted; },
    isMuted: function() { return muted; },

    // ── メニュー操作音 ──────────────────────────────────────────

    cursor: function() {
      resume();
      var t = ctx.currentTime;
      osc(1200, 'sine', 0.08, t, 0.04);
    },

    confirm: function() {
      resume();
      var t = ctx.currentTime;
      osc(660, 'square', 0.12, t, 0.06);
      osc(990, 'square', 0.1, t + 0.06, 0.09);
    },

    cancel: function() {
      resume();
      var t = ctx.currentTime;
      osc(440, 'square', 0.1, t, 0.06);
      osc(330, 'square', 0.08, t + 0.06, 0.09);
    },

    // ── 戦闘開始 ──────────────────────────────────────────────

    encounter: function() {              // エンカウント: 警告音の2連打と急降下
      resume();
      var t = ctx.currentTime;
      osc(880, 'square', 0.2, t, 0.09);
      osc(880, 'square', 0.2, t + 0.14, 0.09);
      osc(1320, 'sawtooth', 0.18, t + 0.28, 0.4, 200);
      noise(0.25, t + 0.28, 0.35, 2500);
    },

    battleReady: function() {            // 味方の戦闘態勢: 力強い和音
      resume();
      var t = ctx.currentTime;
      [196, 247, 294, 392].forEach(function(f, i) { osc(f, 'sawtooth', 0.1, t + i * 0.03, 0.45); });
      osc(98, 'triangle', 0.2, t, 0.35, 70);
      osc(1175, 'sine', 0.07, t + 0.1, 0.3);
    },

    battleStart: function() {
      resume();
      var t = ctx.currentTime;
      noise(0.6, t, 0.25, 500);
      osc(110, 'sawtooth', 0.35, t, 0.18);
      osc(165, 'sawtooth', 0.3, t + 0.12, 0.18);
      osc(220, 'square', 0.25, t + 0.24, 0.3);
    },

    // ── 攻撃・ダメージ ────────────────────────────────────────

    attack: function() {
      resume();
      var t = ctx.currentTime;
      noise(0.7, t, 0.1, 900);
      osc(280, 'square', 0.35, t, 0.05, 100);
    },

    weaponHit: function(who, big) {      // 味方の通常攻撃: 武器ごとの命中音
      resume();
      var t = ctx.currentTime;
      if (who === 'Dario') { osc(880, 'triangle', 0.18, t, 0.18, 330); osc(1320, 'sine', 0.1, t + 0.03, 0.22, 660); }
      else if (who === 'Sundar') { osc(196, 'square', 0.22, t, 0.12, 90); osc(784, 'sine', 0.12, t + 0.02, 0.3); }
      else { noise(0.5, t, 0.14, 4500); osc(1200, 'sawtooth', 0.14, t, 0.1, 400); }
      if (big) { osc(90, 'square', 0.3, t, 0.2, 40); noise(0.4, t, 0.25, 800); }
    },

    itemToss: function() {               // アイテムを投げる/使う: 軽い風切り音
      resume();
      var t = ctx.currentTime;
      noise(0.2, t, 0.14, 2500);
      osc(500, 'sine', 0.1, t, 0.15, 900);
    },

    itemHit: function(id) {              // アイテム効果音(アイテムごと)
      resume();
      var t = ctx.currentTime;
      if (id === 'bomb') { noise(0.75, t, 0.55, 1400); osc(140, 'sawtooth', 0.3, t, 0.35, 40); }
      else if (id === 'phoenix') { [392, 523, 659, 784, 1047].forEach(function(f, i) { osc(f, 'triangle', 0.14, t + i * 0.09, 0.5); }); noise(0.25, t, 0.5, 1800); }
      else if (id === 'magicWater') { [880, 1175, 1568].forEach(function(f, i) { osc(f, 'sine', 0.12, t + i * 0.07, 0.25, f * 0.7); }); }
      else { [523, 659, 784].forEach(function(f, i) { osc(f, 'sine', 0.13, t + i * 0.07, 0.22); }); noise(0.1, t, 0.2, 3000); }
    },

    guard: function() {                  // 防御の構え: 盾が展開する音
      resume();
      var t = ctx.currentTime;
      osc(330, 'triangle', 0.16, t, 0.12, 520);
      osc(660, 'sine', 0.12, t + 0.06, 0.3, 880);
      noise(0.18, t, 0.1, 3000);
    },

    guardHit: function(heavy) {          // ガードで受け止める音: 金属の衝撃
      resume();
      var t = ctx.currentTime;
      noise(0.45, t, 0.12, 5000);
      osc(1100, 'square', 0.16, t, 0.08, 500);
      osc(2200, 'sine', 0.08, t, 0.35, 1800);
      osc(heavy ? 90 : 140, 'square', 0.22, t, 0.18, 50);
    },

    escapeRun: function() {              // 逃走成功: 駆け出す足音とドップラー風の風切り音
      resume();
      var t = ctx.currentTime;
      for (var i = 0; i < 8; i++) {
        noise(0.22, t + 0.05 + i * 0.075, 0.05, 700);
        osc(120 + (i % 2) * 40, 'square', 0.08, t + 0.05 + i * 0.075, 0.04, 70);
      }
      noise(0.3, t + 0.1, 0.6, 3000);
      osc(900, 'sine', 0.06, t + 0.15, 0.5, 220);
    },

    escapeFail: function() {             // 逃走失敗: 急停止してつまずく音
      resume();
      var t = ctx.currentTime;
      noise(0.4, t, 0.18, 1800);
      osc(300, 'sawtooth', 0.2, t, 0.25, 90);
      osc(160, 'square', 0.18, t + 0.12, 0.2, 60);
      osc(784, 'triangle', 0.08, t + 0.3, 0.12, 392);
    },

    stunHit: function() {                // スタン: 痺れる電撃音と目が回る音
      resume();
      var t = ctx.currentTime;
      noise(0.4, t, 0.25, 4500);
      for (var i = 0; i < 6; i++) osc(1400 + (i % 2) * 500, 'square', 0.07, t + i * 0.04, 0.04, 700);
      osc(660, 'sine', 0.1, t + 0.2, 0.18, 880);
      osc(880, 'sine', 0.1, t + 0.32, 0.18, 660);
      osc(660, 'sine', 0.08, t + 0.44, 0.2, 440);
    },

    poisonHit: function() {              // 毒を受ける: 不気味なバブル音
      resume();
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) osc(180 + i * 60, 'sine', 0.12, t + i * 0.06, 0.12, 90 + i * 30);
      osc(120, 'sawtooth', 0.1, t, 0.3, 60);
    },

    poisonTick: function() {             // 毒のダメージ: 低くうねる音
      resume();
      var t = ctx.currentTime;
      osc(200, 'sawtooth', 0.12, t, 0.3, 100);
      osc(150, 'sine', 0.1, t + 0.1, 0.25, 80);
    },

    cureHit: function() {                // 状態異常回復: 泡がはじけて澄んだ音が昇る
      resume();
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) noise(0.12, t + i * 0.04, 0.05, 3500);
      [659, 784, 988, 1319].forEach(function(f, i) { osc(f, 'sine', 0.13, t + 0.1 + i * 0.07, 0.3); });
    },

    step: function(tile) {               // マップの足音: 地形ごとの小さな音
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      var soft = { G: 1400, F: 1100, S: 2200, R: 1800, D: 700 }[tile] || 900;
      noise(0.06, t, 0.04, soft);
      if (tile === 'f' || tile === 'd' || tile === 'T') osc(110, 'square', 0.025, t, 0.03, 80);   // 床/ドア: 乾いたコツ
    },

    damage: function() {
      resume();
      var t = ctx.currentTime;
      osc(160, 'sawtooth', 0.45, t, 0.1, 70);
      noise(0.45, t + 0.05, 0.18, 500);
    },

    enemyDie: function() {
      resume();
      var t = ctx.currentTime;
      osc(440, 'square', 0.3, t, 0.07, 220);
      noise(0.55, t + 0.03, 0.3, 700);
    },

    // ── 呪文 ──────────────────────────────────────────────────

    spell: function() {                  // 通常魔法（ファイア等）
      resume();
      var t = ctx.currentTime;
      osc(440, 'sine', 0.18, t, 0.12, 880);
      osc(550, 'sine', 0.14, t + 0.09, 0.14, 1100);
      osc(660, 'sine', 0.11, t + 0.18, 0.2, 1320);
    },

    bigSpell: function() {               // 全体魔法（アイスストーム等）
      resume();
      var t = ctx.currentTime;
      noise(0.5, t, 0.45, 1200);
      osc(220, 'sawtooth', 0.25, t, 0.12, 440);
      osc(330, 'sine', 0.2, t + 0.08, 0.18, 990);
      osc(550, 'sine', 0.16, t + 0.2, 0.28, 1320);
    },

    heal: function() {                   // 回復呪文
      resume();
      var t = ctx.currentTime;
      var notes = [523, 659, 784, 1047]; // C E G C (1オクターブ上)
      for (var i = 0; i < notes.length; i++) {
        osc(notes[i], 'sine', 0.14, t + i * 0.07, 0.22);
      }
    },

    chargeUp: function(kind) {           // 味方の詠唱: 属性ごとに上昇する音
      resume();
      var t = ctx.currentTime;
      var base = { cure: 523, debuffAtk: 247, debuffDef: 185, fire: 220, ice: 440, thunder: 330, heal: 392, holy: 523, light: 659, buffAtk: 196, buffDef: 294 }[kind] || 300;
      osc(base, 'triangle', 0.14, t, 0.42, base * 2);
      osc(base * 1.5, 'sine', 0.08, t + 0.08, 0.36, base * 3);
      if (kind === 'fire' || kind === 'thunder') noise(0.12, t, 0.4, 900);
      if (kind === 'ice') osc(1760, 'sine', 0.05, t + 0.1, 0.3, 2640);
    },

    sweep: function() {                  // なぎはらい: 大きな風切り音と刃の響き
      resume();
      var t = ctx.currentTime;
      noise(0.45, t, 0.45, 2600);
      osc(520, 'sawtooth', 0.14, t, 0.3, 130);
      osc(1040, 'triangle', 0.08, t + 0.04, 0.22, 330);
      noise(0.2, t + 0.22, 0.3, 900);
    },

    spellHit: function(kind) {           // 味方の呪文が着弾する音
      resume();
      var t = ctx.currentTime;
      if (kind === 'fire') { noise(0.5, t, 0.5, 1500); osc(160, 'sawtooth', 0.22, t, 0.3, 50); }
      else if (kind === 'ice') { noise(0.3, t, 0.35, 5000); osc(1320, 'triangle', 0.16, t, 0.25, 440); osc(1760, 'sine', 0.1, t + 0.05, 0.3, 880); }
      else if (kind === 'thunder') { noise(0.65, t, 0.45, 3500); osc(110, 'square', 0.25, t, 0.3, 40); }
      else if (kind === 'light') { [784, 1047, 1568].forEach(function(f, i) { osc(f, 'sine', 0.12, t + i * 0.05, 0.3); }); }
      else if (kind === 'holy') { [523, 659, 784, 1047, 1319].forEach(function(f, i) { osc(f, 'sine', 0.12, t + i * 0.06, 0.5); }); }
      else if (kind === 'cure') { /* cureHit handles it */ }
      else if (kind === 'heal') { [523, 659, 784, 1047].forEach(function(f, i) { osc(f, 'sine', 0.14, t + i * 0.07, 0.24); }); }
      else if (kind === 'debuffAtk' || kind === 'debuffDef') {
        osc(kind === 'debuffAtk' ? 440 : 330, 'sawtooth', 0.2, t, 0.45, 110);
        osc(220, 'square', 0.12, t + 0.05, 0.4, 70);
        noise(0.25, t, 0.3, 900);
      }
      else if (kind === 'buffAtk') { osc(262, 'sawtooth', 0.2, t, 0.3, 392); osc(523, 'square', 0.12, t + 0.1, 0.3); noise(0.2, t, 0.2, 1200); }
      else if (kind === 'buffDef') { osc(392, 'sine', 0.16, t, 0.5); osc(588, 'sine', 0.12, t + 0.08, 0.45); osc(784, 'triangle', 0.1, t + 0.16, 0.4); }
    },

    buff: function() {                   // バフ呪文（ウォークライ、プロテクト）
      resume();
      var t = ctx.currentTime;
      osc(523, 'sine', 0.12, t, 0.4);
      osc(659, 'sine', 0.1, t + 0.05, 0.35);
      osc(784, 'sine', 0.1, t + 0.1, 0.3);
      osc(1047, 'sine', 0.12, t + 0.2, 0.35);
    },

    // ── 逃走 ──────────────────────────────────────────────────

    escape: function() {
      resume();
      var t = ctx.currentTime;
      osc(440, 'square', 0.18, t, 0.07, 880);
      osc(880, 'square', 0.15, t + 0.09, 0.07, 1760);
      osc(1320, 'sine', 0.12, t + 0.18, 0.12);
    },

    // ── 勝利・レベルアップ ────────────────────────────────────

    victory: function() {
      resume();
      var t = ctx.currentTime;
      // ドラクエ風勝利ファンファーレ（短縮版）
      var mel = [392, 392, 392, 392, 523, 659, 784];
      var dur = [0.1, 0.1, 0.1, 0.05, 0.1, 0.1, 0.45];
      var time = t;
      for (var i = 0; i < mel.length; i++) {
        osc(mel[i], 'square', 0.22, time, dur[i] * 0.85);
        osc(mel[i] * 0.5, 'square', 0.08, time, dur[i] * 0.85); // 1オクターブ下でハーモニー
        time += dur[i];
      }
    },

    levelUp: function() {
      resume();
      var t = ctx.currentTime;
      // 上昇アルペジオ
      var scale = [262, 330, 392, 523, 659, 784, 1047];
      for (var i = 0; i < scale.length; i++) {
        osc(scale[i], 'square', 0.18 + i * 0.01, t + i * 0.07, 0.14);
        osc(scale[i] * 1.5, 'sine', 0.07, t + i * 0.07, 0.14);
      }
      // 降り注ぐ光の衝撃音と、締めの和音 + きらめき
      noise(0.3, t, 0.25, 4000);
      osc(98, 'triangle', 0.22, t, 0.5, 65);
      [523, 659, 784, 1047].forEach(function(f) { osc(f, 'triangle', 0.1, t + 0.55, 0.9); });
      for (var j = 0; j < 6; j++) osc(2093 + j * 220, 'sine', 0.05, t + 0.6 + j * 0.09, 0.18);
    },

    // ── 宿屋・宝箱 ────────────────────────────────────────────

    inn: function() {
      resume();
      var t = ctx.currentTime;
      osc(392, 'sine', 0.11, t, 0.5);
      osc(494, 'sine', 0.11, t + 0.4, 0.5);
      osc(523, 'sine', 0.13, t + 0.8, 0.7);
      osc(659, 'sine', 0.1, t + 0.8, 0.7);
    },

    save: function() {                   // セーブ: 澄んだ上昇アルペジオ + きらめき
      resume();
      var t = ctx.currentTime;
      [523, 659, 784, 1047].forEach(function(f, i) { osc(f, 'triangle', 0.1, t + i * 0.09, 0.4); });
      osc(1568, 'sine', 0.08, t + 0.4, 0.7);
      for (var j = 0; j < 4; j++) osc(2093 + j * 260, 'sine', 0.04, t + 0.45 + j * 0.07, 0.15);
    },

    chest: function() {
      resume();
      var t = ctx.currentTime;
      var notes = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < notes.length; i++) {
        osc(notes[i], 'sine', 0.14, t + i * 0.055, 0.18);
      }
    },

    // ── ゲームオーバー ────────────────────────────────────────

    whoosh: function() {                 // 敵の突進: 風を切る音
      resume();
      var t = ctx.currentTime;
      noise(0.35, t + 0.1, 0.2, 1800);
      osc(300, 'sawtooth', 0.1, t + 0.1, 0.18, 120);
    },

    enemyAppear: function(shape) {       // 敵の種族ごとの登場音
      resume();
      var t = ctx.currentTime, i;
      switch (shape) {
        case 'slime':
          osc(200, 'sine', 0.25, t, 0.12, 500);
          osc(500, 'sine', 0.2, t + 0.12, 0.1, 300);
          break;
        case 'goblin':
          osc(140, 'sawtooth', 0.22, t, 0.18, 90);
          osc(180, 'square', 0.1, t + 0.05, 0.12, 110);
          break;
        case 'wolf':                                   // 遠吠え
          osc(400, 'sine', 0.25, t, 0.55, 700);
          osc(405, 'triangle', 0.12, t, 0.55, 705);
          noise(0.1, t, 0.3, 1200);
          break;
        case 'bat':                                    // 甲高い鳴き声
          for (i = 0; i < 3; i++) osc(2200 + i * 200, 'square', 0.09, t + i * 0.1, 0.07, 3200 + i * 200);
          break;
        case 'skeleton':                               // 骨のガラガラ音
          for (i = 0; i < 5; i++) {
            noise(0.35, t + i * 0.06, 0.04, 3000);
            osc(300 + (i % 2) * 120, 'square', 0.08, t + i * 0.06, 0.03);
          }
          break;
        case 'knight':                                 // 金属の打音
          osc(900, 'square', 0.2, t, 0.06, 600);
          noise(0.35, t, 0.12, 4000);
          osc(150, 'sine', 0.3, t, 0.2, 60);
          break;
        case 'mage':                                   // 転移のきらめき
          for (i = 0; i < 6; i++) osc(600 + i * 140, 'sine', 0.12, t + i * 0.05, 0.25);
          break;
        default:
          osc(120, 'sine', 0.3, t, 0.12, 50);
      }
    },

    enemyHit: function(style) {          // 敵の攻撃が当たる音(攻撃の種類ごと)
      resume();
      var t = ctx.currentTime, i;
      switch (style) {
        case 'hop':                                    // ベチャッ
          noise(0.5, t, 0.16, 700);
          osc(220, 'sine', 0.3, t, 0.14, 70);
          break;
        case 'pounce':                                 // 爪の引っかき
          for (i = 0; i < 3; i++) noise(0.4, t + i * 0.035, 0.07, 3500);
          osc(900, 'sawtooth', 0.08, t, 0.12, 400);
          break;
        case 'dive':                                   // 噛みつき
          osc(1400, 'square', 0.14, t, 0.03);
          osc(1300, 'square', 0.14, t + 0.05, 0.03);
          noise(0.25, t, 0.08, 2500);
          break;
        case 'heavy':                                  // 重い斬撃と衝撃
          osc(110, 'sine', 0.5, t, 0.3, 40);
          osc(700, 'square', 0.18, t, 0.08, 300);
          noise(0.6, t, 0.22, 2500);
          break;
        default:                                       // 鋭い斬撃
          osc(1100, 'sawtooth', 0.14, t, 0.1, 350);
          noise(0.4, t, 0.1, 5000);
      }
    },

    thud: function() {                   // 敵の着地: 短い低音
      resume();
      var t = ctx.currentTime;
      osc(120, 'sine', 0.35, t, 0.12, 50);
      noise(0.25, t, 0.08, 300);
    },

    bossAppear: function() {            // ボス出現: 低い地響きと衝撃
      resume();
      var t = ctx.currentTime;
      osc(70, 'sawtooth', 0.5, t, 0.6, 35);
      osc(110, 'square', 0.3, t, 0.35, 55);
      noise(0.7, t, 0.5, 400);
      osc(55, 'sine', 0.5, t + 0.05, 0.8, 30);
    },

    bossPhase: function(n) {              // 魔王の形態変化: 咆哮と、闇が膨らむ低音
      resume();
      var t = ctx.currentTime;
      osc(90, 'sawtooth', 0.4, t, 0.9, 45 + n * 10);
      osc(180, 'square', 0.18, t, 0.7, 70);
      osc(60, 'sine', 0.5, t + 0.05, 1.0, 30);
      noise(0.4, t, 0.8, 500 + n * 300);
      for (var k = 0; k < 4 + n * 2; k++) osc(300 + k * 90, 'sawtooth', 0.05, t + 0.2 + k * 0.06, 0.25, 80);
    },

    bossCharge: function() {              // 大技の予兆: 低く唸りながら力が収束する
      resume();
      var t = ctx.currentTime;
      osc(55, 'sawtooth', 0.35, t, 1.2, 140);
      osc(110, 'sine', 0.25, t, 1.1, 280);
      noise(0.25, t, 1.0, 900);
      for (var k = 0; k < 5; k++) osc(200 + k * 40, 'triangle', 0.06, t + 0.5 + k * 0.1, 0.3, 700);
    },

    gameStart: function() {              // タイトルで「はじめから/つづきから」: 輝く上昇音
      resume();
      var t = ctx.currentTime;
      [523, 659, 784, 1047, 1319].forEach(function(f, i) { osc(f, 'triangle', 0.1, t + i * 0.06, 0.5); });
      osc(262, 'sine', 0.14, t, 0.7);
      noise(0.08, t, 0.5, 6000);
    },

    openingRumble: function() {          // オープニング: 地鳴り
      resume();
      var t = ctx.currentTime;
      osc(48, 'sawtooth', 0.35, t, 1.4, 32);
      osc(72, 'square', 0.12, t, 1.2, 40);
      noise(0.22, t, 1.3, 260);
    },

    openingThunder: function() {         // オープニング: 雷鳴
      resume();
      var t = ctx.currentTime;
      noise(0.55, t, 0.15, 6000);
      noise(0.4, t + 0.1, 1.4, 700);
      osc(60, 'sawtooth', 0.3, t + 0.15, 1.0, 30);
    },

    openingDawn: function() {            // オープニング: 夜明け、希望のきらめき
      resume();
      var t = ctx.currentTime;
      [392, 494, 587, 784].forEach(function(f, i) { osc(f, 'sine', 0.09, t + i * 0.22, 1.6); });
      for (var j = 0; j < 5; j++) osc(1568 + j * 262, 'sine', 0.035, t + 0.9 + j * 0.12, 0.3);
    },

    coin: function() {                   // 購入: コインの澄んだ二音と小さな金属音
      resume();
      var t = ctx.currentTime;
      osc(1319, 'square', 0.08, t, 0.08);
      osc(1760, 'square', 0.08, t + 0.07, 0.35);
      osc(2637, 'sine', 0.05, t + 0.1, 0.4);
      noise(0.05, t, 0.06, 7000);
    },

    denied: function() {                 // 買えない/足りない: 低いブザー
      resume();
      var t = ctx.currentTime;
      osc(160, 'square', 0.12, t, 0.12, 120);
      osc(120, 'square', 0.12, t + 0.12, 0.2, 90);
    },

    doorBell: function() {               // 店に入る: ドアベル
      resume();
      var t = ctx.currentTime;
      osc(1568, 'sine', 0.1, t, 0.5);
      osc(2093, 'sine', 0.07, t + 0.12, 0.7);
      osc(3136, 'sine', 0.03, t + 0.12, 0.4);
    },

    birds: function() {                  // 宿屋の朝: 小鳥のさえずり
      resume();
      var t = ctx.currentTime;
      [0, 0.18, 0.5, 0.68, 0.86].forEach(function(d, i) {
        osc(2600 + (i % 2) * 500, 'sine', 0.05, t + d, 0.1, 3400 + (i % 3) * 300);
      });
    },

    gameoverToll: function() {           // ゲームオーバー画面: 弔いの鐘と魂のささやき
      resume();
      var t = ctx.currentTime;
      [0, 1.1].forEach(function(d) {
        osc(196, 'sine', 0.2, t + d, 1.4);
        osc(392, 'sine', 0.1, t + d, 1.1);
        osc(588, 'sine', 0.06, t + d, 0.8);
        osc(98, 'triangle', 0.18, t + d, 1.2, 80);
      });
      noise(0.1, t + 1.3, 1.6, 600);
    },

    gameOver: function() {
      resume();
      var t = ctx.currentTime;
      var mel = [392, 370, 349, 330, 311, 294, 262];
      for (var i = 0; i < mel.length; i++) {
        osc(mel[i], 'sawtooth', 0.22, t + i * 0.2, 0.28);
      }
    },
  };
})();
