// ============================================================
// sound.js — Web Audio API sound effects (no external files)
// ============================================================

var SoundSystem = (function() {
  var ctx = null;
  var masterVol = 0.5;
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
    g.gain.setValueAtTime(vol * masterVol, t);
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
    g.gain.setValueAtTime(vol * masterVol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(t);
  }

  return {
    init: init,
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
