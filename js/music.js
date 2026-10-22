// ============================================================
// music.js — Procedural chiptune BGM engine (Web Audio API)
// All music generated from oscillators — no audio files needed.
//
// Tracks: 'title' / 'town' / 'waystation' / 'field' / 'crystal' / 'abyss' / 'boss' / 'battle' / 'victory' / 'defeat'
// Usage:  MusicSystem.init(audioCtx);
//         MusicSystem.changeTo('battle');
//         MusicSystem.stop();
// ============================================================

var MusicSystem = (function() {
  var ctx = null;
  var masterGain = null;
  var currentTrack = null;
  var isPlaying = false;
  var timerID = null;

  var mIdx = 0, mTime = 0;   // melody cursor
  var bIdx = 0, bTime = 0;   // bass cursor
  var pTime = 0;             // percussion cursor (battle / boss)
  var pIdx = 0;              // beat counter for the percussion pattern
  var aTime = 0, aIdx = 0;   // arpeggio layer cursor (plays only when intensity > 0)
  var boost = false;         // true while the party has an active buff (adds a bright layer)
  var intensity = 0;         // 0 normal, 1 danger, 2 critical (adds a fast arpeggio layer)
  var fadeToken = 0;         // invalidates pending fade-outs when new music starts

  var volume = 0.18;
  var LOOKAHEAD = 0.20;      // seconds to schedule ahead
  var INTERVAL  = 50;        // scheduler poll interval (ms)

  // ── Note frequency table ──────────────────────────────────
  var N = {
    R:0,
    C3:131, D3:147, E3:165, F3:175, G3:196, A3:220, Bb3:233, B3:247,
    C4:262, D4:294, Eb4:311, E4:330, F4:349, Fs4:370, G4:392, Ab4:415, A4:440, Bb4:466, B4:494,
    C5:523, D5:587, Eb5:622, E5:659, F5:698, Fs5:740, G5:784, Ab5:831, A5:880, Bb5:932, B5:988,
    C6:1047,
    Cs4:277, Cs5:554,
  };

  // One bar of eighth-note pulse on a single bass note (4 beats)
  function pulse(n) {
    return [[n,.5],[N.R,.5],[n,.5],[N.R,.5],[n,.5],[N.R,.5],[n,.5],[N.R,.5]];
  }

  // ── Track data ────────────────────────────────────────────
  // Each entry: [frequency_hz, duration_in_beats]  (R=0 = rest)
  // All tracks: 32 beats melody + 32 beats bass (loop-seamless)

  var tracks = {

    // ── 勝利ファンファーレ (132 BPM, C major, 一度だけ鳴る) ──── //
    victory: {
      bpm: 150,
      once: true,
      harmony: 0.8,
      melody: [
        [N.C5,.5],[N.C5,.5],[N.C5,.5],[N.C5,1.5],   // ta-ta-ta-taa
        [N.Ab4,1.5],[N.Bb4,1.5],[N.C5,1],[N.R,.5],
        [N.C5,.5],[N.C5,.5],[N.C5,.5],[N.C5,1],[N.Bb4,.5],[N.C5,1],[N.R,.5],
        [N.D5,1],[N.E5,1],[N.G5,2],[N.C6,4],
      ],
      bass: [
        [N.C3,.5],[N.C3,.5],[N.C3,.5],[N.C3,1.5],
        [N.F3,1.5],[N.G3,1.5],[N.C3,1],[N.R,.5],
        [N.C3,2],[N.F3,2],
        [N.G3,2],[N.G3,2],[N.C3,4],
      ],
    },

    // ── 敗北 (66 BPM, A minor, 一度だけ鳴る) ─────────────── //
    defeat: {
      bpm: 66,
      once: true,
      harmony: 0.84,
      melody: [
        [N.A4,2],[N.G4,2],[N.F4,2],[N.E4,2],
        [N.D4,2],[N.E4,2],[N.A3,4],
      ],
      bass: [
        [N.F3,4],[N.E3,4],
        [N.D3,4],[N.A3,4],
      ],
    },

    // ── タイトル (108 BPM, C major, majestic) ────────────── //
    title: {
      bpm: 108,
      melody: [
        [N.C5,1],[N.E5,1],[N.G5,2],           // bar 1
        [N.A5,1],[N.G5,1],[N.F5,1],[N.E5,1],  // bar 2
        [N.D5,1],[N.F5,1],[N.E5,2],           // bar 3
        [N.C5,4],                              // bar 4
        [N.G4,2],[N.B4,1],[N.D5,1],           // bar 5
        [N.E5,2],[N.D5,1],[N.B4,1],           // bar 6
        [N.C5,1],[N.B4,1],[N.A4,1],[N.G4,1],  // bar 7
        [N.C5,4],                              // bar 8
      ],
      bass: [
        [N.C3,2],[N.G3,2],
        [N.F3,2],[N.C3,2],
        [N.G3,2],[N.D3,2],
        [N.C3,4],
        [N.G3,2],[N.D3,2],
        [N.C3,2],[N.G3,2],
        [N.A3,2],[N.E3,2],
        [N.C3,4],
      ],
    },

    // ── タウン / ミルヘイブン村 (96 BPM, C major, peaceful) ── //
    town: {
      bpm: 96,
      melody: [
        [N.E5,1],[N.D5,1],[N.C5,1],[N.E5,1],      // bar 1
        [N.G5,2],[N.R,2],                           // bar 2
        [N.A5,1],[N.G5,1],[N.E5,1],[N.G5,1],       // bar 3
        [N.F5,3],[N.R,1],                           // bar 4
        [N.E5,1],[N.C5,1],[N.E5,1],[N.G5,1],       // bar 5
        [N.D5,1.5],[N.C5,0.5],[N.B4,2],            // bar 6
        [N.A4,1],[N.B4,1],[N.C5,1],[N.D5,1],       // bar 7
        [N.E5,4],                                   // bar 8
      ],
      bass: [
        [N.C3,2],[N.G3,2],
        [N.C3,2],[N.E3,2],
        [N.A3,2],[N.E3,2],
        [N.F3,4],
        [N.C3,2],[N.G3,2],
        [N.G3,2],[N.D3,2],
        [N.A3,2],[N.F3,2],
        [N.C3,4],
      ],
    },

    // ── フィールド (136 BPM, C major, adventurous) ────────── //
    field: {
      bpm: 136,
      melody: [
        [N.G4,1],[N.A4,0.5],[N.G4,0.5],[N.E4,1],[N.D4,1],  // bar 1
        [N.E4,1],[N.G4,1],[N.A4,2],                          // bar 2
        [N.C5,1],[N.B4,1],[N.A4,1],[N.G4,1],                // bar 3
        [N.A4,3],[N.R,1],                                    // bar 4
        [N.A4,1],[N.B4,1],[N.C5,1],[N.D5,1],                // bar 5
        [N.E5,1.5],[N.D5,0.5],[N.C5,1],[N.B4,1],            // bar 6
        [N.A4,1],[N.C5,1],[N.B4,1],[N.G4,1],                // bar 7
        [N.C5,4],                                            // bar 8
      ],
      bass: [
        [N.C3,2],[N.G3,2],
        [N.C3,2],[N.E3,2],
        [N.F3,2],[N.C3,2],
        [N.G3,4],
        [N.A3,2],[N.E3,2],
        [N.C3,2],[N.G3,2],
        [N.F3,2],[N.D3,2],
        [N.C3,4],
      ],
    },

    // ── ハルカ宿場 (84 BPM, G major, relaxed travelling tune) ── //
    waystation: {
      bpm: 84,
      melody: [
        [N.G4,1],[N.B4,1],[N.D5,1],[N.B4,1],      // bar 1
        [N.C5,2],[N.B4,1],[N.A4,1],               // bar 2
        [N.G4,1],[N.A4,1],[N.B4,1],[N.D5,1],      // bar 3
        [N.E5,3],[N.R,1],                         // bar 4
        [N.D5,1],[N.C5,1],[N.B4,1],[N.A4,1],      // bar 5
        [N.B4,2],[N.G4,2],                        // bar 6
        [N.A4,1],[N.B4,1],[N.C5,1],[N.A4,1],      // bar 7
        [N.G4,4],                                 // bar 8
      ],
      bass: [
        [N.G3,2],[N.D3,2],
        [N.C3,2],[N.G3,2],
        [N.G3,2],[N.B3,2],
        [N.C3,2],[N.E3,2],
        [N.D3,2],[N.A3,2],
        [N.G3,2],[N.D3,2],
        [N.D3,2],[N.A3,2],
        [N.G3,4],
      ],
    },

    // ── 水晶の洞窟 (76 BPM, C major / A minor, a clear arpeggiated tune on a chiming triangle lead) ── //
    crystal: {
      bpm: 76,
      lead: 'triangle',
      leadVol: 0.17,
      harmony: 0.5,
      melody: [
        [N.E5,1],[N.G5,1],[N.E5,1],[N.C5,1],      // bar 1
        [N.D5,2],[N.R,1],[N.E5,1],                // bar 2
        [N.G5,1],[N.A5,1],[N.G5,1],[N.E5,1],      // bar 3
        [N.D5,3],[N.R,1],                         // bar 4
        [N.C5,1],[N.E5,1],[N.G5,1],[N.E5,1],      // bar 5
        [N.A4,2],[N.B4,1],[N.C5,1],               // bar 6
        [N.D5,1],[N.E5,1],[N.D5,1],[N.B4,1],      // bar 7
        [N.C5,3],[N.R,1],                         // bar 8
      ],
      bass: [
        [N.C3,2],[N.G3,2],
        [N.A3,2],[N.E3,2],
        [N.F3,2],[N.C3,2],
        [N.G3,2],[N.D3,2],
        [N.C3,2],[N.G3,2],
        [N.F3,2],[N.A3,2],
        [N.G3,2],[N.D3,2],
        [N.C3,4],
      ],
    },

    // ── 深淵の迷宮 (70 BPM, D minor with a tritone, slow and dread; a heartbeat kick) ── //
    abyss: {
      bpm: 70,
      drums: 'kick',
      lead: 'sawtooth',
      leadVol: 0.09,
      harmony: 0.75,
      melody: [
        [N.D4,2],[N.Eb4,1],[N.D4,1],              // bar 1
        [N.A4,3],[N.R,1],                         // bar 2
        [N.Bb4,2],[N.A4,1],[N.G4,1],              // bar 3
        [N.F4,2],[N.Eb4,2],                       // bar 4
        [N.D4,2],[N.F4,1],[N.G4,1],               // bar 5
        [N.Ab4,2],[N.G4,2],                       // bar 6 (the flat fifth)
        [N.Bb4,1],[N.A4,1],[N.G4,1],[N.F4,1],     // bar 7
        [N.D4,3],[N.R,1],                         // bar 8
      ],
      bass: [
        [N.D3,4],
        [N.D3,2],[N.A3,2],
        [N.Bb3,4],
        [N.F3,4],
        [N.D3,4],
        [N.G3,4],
        [N.Bb3,2],[N.A3,2],
        [N.D3,4],
      ],
    },

    // ── ボス戦 (152 BPM, D minor, ominous & heavy) ───────── //
    boss: {
      bpm: 152,
      drums: 'boss',
      harmony: 2 / 3,                 // a fifth below the lead for a heavy, chunky sound
      arp: [N.D5, N.F5, N.A5, N.F5],
      melody: [
        [N.D4,.5],[N.R,.5],[N.D4,.5],[N.R,.5],[N.F4,1],[N.A4,1],            // bar 1
        [N.Bb4,1],[N.A4,1],[N.G4,1],[N.F4,1],                                // bar 2
        [N.E4,.5],[N.R,.5],[N.E4,.5],[N.R,.5],[N.G4,1],[N.Bb4,1],            // bar 3
        [N.A4,2],[N.Cs5,2],                                                  // bar 4 (dominant tension)
        [N.D5,1],[N.C5,.5],[N.Bb4,.5],[N.A4,1],[N.F4,1],                     // bar 5
        [N.G4,1],[N.Bb4,1],[N.D5,2],                                         // bar 6
        [N.Cs5,.5],[N.D5,.5],[N.E5,1],[N.F5,1],[N.E5,1],                     // bar 7
        [N.D5,2],[N.R,2],                                                    // bar 8
      ],
      bass: [].concat(
        pulse(N.D3), pulse(N.Bb3), pulse(N.G3), pulse(N.A3),
        pulse(N.D3), pulse(N.Bb3),
        pulse(N.G3).slice(0, 4), pulse(N.A3).slice(0, 4),
        [[N.D3,2],[N.R,2]]
      ),
    },

    // ── 戦闘 (168 BPM, A minor, intense) ─────────────────── //
    battle: {
      bpm: 168,
      drums: 'rock',
      harmony: 2 / 3,
      arp: [N.A4, N.C5, N.E5, N.C5],
      melody: [
        // Section A — Am/G/F riff
        [N.A4,0.5],[N.R,0.5],[N.C5,0.5],[N.R,0.5],[N.E5,1],[N.D5,1],   // bar 1
        [N.C5,0.5],[N.R,0.5],[N.B4,0.5],[N.R,0.5],[N.A4,1],[N.G4,1],   // bar 2
        [N.G4,0.5],[N.R,0.5],[N.F4,0.5],[N.R,0.5],[N.G4,1],[N.A4,1],   // bar 3
        [N.E4,2],[N.A4,2],                                               // bar 4
        // Section B — higher register
        [N.C5,1],[N.E5,1],[N.A5,2],                                      // bar 5
        [N.G5,0.5],[N.F5,0.5],[N.E5,0.5],[N.D5,0.5],[N.C5,2],          // bar 6
        [N.B4,1],[N.D5,1],[N.C5,1],[N.B4,1],                            // bar 7
        [N.A4,2],[N.R,2],                                                // bar 8
      ],
      bass: [
        // Staccato 8th-note bass following chord changes
        [N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],  // Am bar1
        [N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],  // Am bar2
        [N.G3,0.5],[N.R,0.5],[N.G3,0.5],[N.R,0.5],[N.G3,0.5],[N.R,0.5],[N.G3,0.5],[N.R,0.5],  // G  bar3
        [N.E3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,1],[N.R,1],                            // E→Am bar4
        [N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],[N.A3,0.5],[N.R,0.5],  // Am bar5
        [N.G3,0.5],[N.R,0.5],[N.G3,0.5],[N.R,0.5],[N.F3,0.5],[N.R,0.5],[N.F3,0.5],[N.R,0.5],  // G/F bar6
        [N.E3,0.5],[N.R,0.5],[N.G3,0.5],[N.R,0.5],[N.E3,0.5],[N.R,0.5],[N.G3,0.5],[N.R,0.5],  // E   bar7
        [N.A3,2],[N.R,2],                                                                        // Am  bar8
      ],
    },
  };

  // ── Oscillator helpers ────────────────────────────────────

  function playNote(freq, type, vol, start, dur) {
    if (!freq || !ctx || !masterGain) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    osc.type = type;
    osc.frequency.value = freq;
    var gate = dur * 0.82;  // note lasts 82% of its slot (staccato feel)
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.008);
    gain.gain.setValueAtTime(vol, start + gate - 0.008);
    gain.gain.linearRampToValueAtTime(0.001, start + gate);
    osc.start(start);
    osc.stop(start + gate + 0.01);
  }

  // Short kick-drum noise burst for battle percussion
  function playKick(start) {
    if (!ctx) return;
    var bufLen = Math.ceil(ctx.sampleRate * 0.07);
    var buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 220;
    var g = ctx.createGain();
    g.gain.setValueAtTime(volume * 1.2, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(start);
  }

  // Hi-hat: a very short, bright tick
  function playHat(start, vol) {
    if (!ctx) return;
    var bufLen = Math.ceil(ctx.sampleRate * 0.03);
    var buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 6500;
    var g = ctx.createGain();
    g.gain.setValueAtTime(volume * vol, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(start);
  }

  // Snare: short burst of high-passed noise
  function playSnare(start) {
    if (!ctx) return;
    var bufLen = Math.ceil(ctx.sampleRate * 0.12);
    var buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 1500;
    var g = ctx.createGain();
    g.gain.setValueAtTime(volume * 0.9, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(start);
  }

  // ── Scheduler loop ────────────────────────────────────────

  function scheduler() {
    if (!isPlaying || !currentTrack || !ctx) return;
    var track = tracks[currentTrack];
    var beatDur = 60.0 / track.bpm;
    var now = ctx.currentTime;

    // Schedule melody notes (square wave — bright, classic chiptune)
    while (mTime < now + LOOKAHEAD) {
      if (track.once && mIdx >= track.melody.length) { mTime = Infinity; break; }   // one-shot jingle: stop after one pass
      var mn = track.melody[mIdx % track.melody.length];
      var mdur = beatDur * mn[1];
      if (mn[0]) {
        playNote(mn[0], track.lead || 'square', track.leadVol || 0.14, mTime, mdur);
        if (track.harmony) playNote(mn[0] * track.harmony, 'square', 0.07, mTime, mdur);
        if (boost && !track.once) playNote(mn[0] * 2, 'square', 0.04, mTime, mdur * 0.9);   // party buffed: bright octave shimmer
      }
      mTime += mdur;
      mIdx++;
    }

    // Schedule bass notes (triangle wave — softer, rounder)
    while (bTime < now + LOOKAHEAD) {
      if (track.once && bIdx >= track.bass.length) { bTime = Infinity; break; }
      var bn = track.bass[bIdx % track.bass.length];
      var bdur = beatDur * bn[1];
      if (bn[0]) playNote(bn[0], 'triangle', 0.2, bTime, bdur);
      bTime += bdur;
      bIdx++;
    }

    // Percussion on eighth-note steps: kick every beat, snare on beats 2 and 4, hi-hat on the
    // off-beats; the boss track adds a syncopated extra kick before the bar line
    if (track.drums) {
      while (pTime < now + LOOKAHEAD) {
        var onBeat = pIdx % 2 === 0, beatNo = pIdx >> 1;
        if (onBeat) {
          playKick(pTime);
          if (track.drums !== 'kick' && beatNo % 2 === 1) playSnare(pTime);
        } else if (track.drums !== 'kick') {
          playHat(pTime, 0.35);
        }
        if (boost && onBeat) playHat(pTime + beatDur / 4, 0.22);   // buffed: extra sixteenth hat
        if (track.drums === 'boss' && pIdx % 8 === 7) playKick(pTime);
        pTime += beatDur / 2;
        pIdx++;
      }
    }

    // Danger layer: a fast sixteenth-note arpeggio that only sounds while intensity > 0
    if (track.arp) {
      var aStep = beatDur / 4;
      while (aTime < now + LOOKAHEAD) {
        if (intensity > 0) {
          playNote(track.arp[aIdx % track.arp.length], 'square', intensity > 1 ? 0.07 : 0.045, aTime, aStep);
        }
        aTime += aStep;
        aIdx++;
      }
    }

    timerID = setTimeout(scheduler, INTERVAL);
  }

  // ── Public API ────────────────────────────────────────────

  function play(name) {
    if (!tracks[name] || !ctx) return;
    if (currentTrack === name && isPlaying) return;
    stop();
    currentTrack = name;
    mIdx = 0; bIdx = 0; pIdx = 0;
    fadeToken++;
    var startTime = ctx.currentTime + 0.05;
    mTime = startTime;
    bTime = startTime;
    pTime = startTime;
    aTime = startTime;
    aIdx = 0;
    isPlaying = true;
    scheduler();
  }

  function stop() {
    clearTimeout(timerID);
    isPlaying = false;
    currentTrack = null;
  }

  return {
    init: function(audioCtx) {
      if (!audioCtx) return;
      ctx = audioCtx;
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    },

    // Smooth crossfade to a new track
    changeTo: function(name, quick) {
      if (currentTrack === name && isPlaying) return;
      if (!isPlaying || !masterGain) { play(name); return; }
      var fadeSec = quick ? 0.08 : 0.35;

      // Fade out current track
      var now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + fadeSec);

      var self = this;
      setTimeout(function() {
        stop();
        if (!masterGain) return;
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        play(name);
        // Fade in new track
        masterGain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.35);
      }, fadeSec * 1000 + 30);
    },

    stop: stop,

    // Smooth fade to silence, then stop (volume is restored for the next track)
    fadeOut: function(sec) {
      if (!isPlaying || !masterGain) { stop(); return; }
      var token = ++fadeToken;
      var now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + sec);
      setTimeout(function() {
        if (token !== fadeToken) return;   // new music started meanwhile
        stop();
        if (masterGain) {
          masterGain.gain.cancelScheduledValues(ctx.currentTime);
          masterGain.gain.setValueAtTime(volume, ctx.currentTime);
        }
      }, sec * 1000 + 30);
    },

    setVolume: function(v) {
      volume = Math.max(0, Math.min(1, v));
      if (masterGain) masterGain.gain.value = volume;
    },

    // 0 normal, 1 danger, 2 critical: layers a fast arpeggio over the current track
    setIntensity: function(n) { intensity = n; },
    getIntensity: function() { return intensity; },

    // true while the party is buffed: adds a bright octave layer and extra hats
    setBoost: function(on) { boost = !!on; },
    getBoost: function() { return boost; },

    current: function() { return currentTrack; },

    // For tests: every track's melody / bass length in beats (a looping track needs them equal to loop seamlessly)
    trackInfo: function() {
      var out = {};
      Object.keys(tracks).forEach(function(k) {
        var sum = function(arr) { return arr.reduce(function(t, n) { return t + n[1]; }, 0); };
        out[k] = { once: !!tracks[k].once, melody: sum(tracks[k].melody), bass: sum(tracks[k].bass) };
      });
      return out;
    },
  };
})();
