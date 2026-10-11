// ============================================================
// opening.js — Title scenery, title logo and the new-game opening cinematic
// Pure drawing + timeline data; the state machine lives in main.js.
// ============================================================

var OpeningSystem = {
  DURATION: 22500,          // ms, length of the opening cinematic

  // Narration shown during the opening: { from, to, lines }
  TEXTS: [
    { from: 700,   to: 5100,  lines: ['かつて エルドラシアは、', '光と 平和に 満ちていた。'] },
    { from: 5700,  to: 11200, lines: ['しかし ある夜 ——', '北の果てで 魔王ヴァルザードが 目覚めた。'] },
    { from: 11800, to: 16200, lines: ['闇は 日ごとに 世界を 蝕み、', '人々は 希望を 失いかけていた…'] },
    { from: 17000, to: 21300, lines: ['それでも 三人の 勇者は 立ち上がる。', '世界に 光を とりもどすために。'] },
  ],

  // One-shot sound cues on the timeline (ms)
  CUES: [
    { t: 5300,  fn: 'openingRumble' },
    { t: 6200,  fn: 'openingThunder' },
    { t: 7000,  fn: 'openingThunder' },
    { t: 8600,  fn: 'openingThunder' },
    { t: 11800, fn: 'openingRumble' },
    { t: 16600, fn: 'openingDawn' },
  ],

  // Which BGM the opening wants at time t (null = silence under the storm)
  bgmAt: function(t) {
    return (t < 5200 || t >= 16600) ? 'title' : null;
  },

  // Scene parameters over the opening timeline
  sceneAt: function(t) {
    var c = function(x) { return Math.max(0, Math.min(1, x)); };
    var storm = c((t - 5200) / 2400) - c((t - 16400) / 2400) * 0.75;
    var flash = 0, fl = [6200, 7000, 8600];
    for (var i = 0; i < fl.length; i++) {
      var ft = t - fl[i];
      if (ft >= 0 && ft < 420) flash = Math.max(flash, (1 - ft / 420) * (ft < 90 ? 1 : 0.7 + 0.3 * Math.sin(ft / 25)));
    }
    return {
      t: t,
      storm: storm,
      castle: c((t - 6000) / 2200),
      glow: c((t - 7600) / 2500) * (1 - c((t - 17200) / 2500) * 0.6),
      flash: flash,
      dawn: c((t - 16600) / 3500),
      heroes: c((t - 16800) / 1800),
      quake: (t > 5300 && t < 6300) ? 1 : (t > 11800 && t < 12700 ? 0.7 : 0),
    };
  },

  // ---------- helpers ----------
  mixA: function(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; },
  mix: function(a, b, k) {
    var c = this.mixA(a, b, k);
    return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';
  },
  rnd: function(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); },

  // Night landscape shared by the title screen and the opening.
  // o: { t, storm, castle, glow, flash, dawn, heroes, quake }
  drawScene: function(ctx, o) {
    var w = 640, h = 480, t = o.t, i, k;
    var storm = o.storm || 0, castle = o.castle === undefined ? 1 : o.castle, glow = o.glow || 0, flash = o.flash || 0, dawn = o.dawn || 0;
    ctx.save();
    if (o.quake) ctx.translate((Math.random() - 0.5) * 5 * o.quake, (Math.random() - 0.5) * 5 * o.quake);

    ctx.fillStyle = '#05050f'; ctx.fillRect(-10, -10, w + 20, h + 20);   // base under everything

    // Sky
    var g = ctx.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, this.mix([6, 10, 34], [30, 4, 14], storm));
    g.addColorStop(1, this.mix(this.mixA([24, 28, 78], [96, 16, 26], storm), [214, 124, 80], dawn * 0.6));
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, w + 20, 410);

    // Stars (fade as the storm rolls in)
    for (i = 0; i < 80; i++) {
      var sx = this.rnd(i) * w, sy = this.rnd(i + 99) * 230;
      var tw = 0.5 + 0.5 * Math.sin(t / 420 + i * 1.7);
      ctx.fillStyle = 'rgba(255,255,210,' + (0.25 + 0.55 * tw) * (1 - storm * 0.9) + ')';
      ctx.fillRect(sx, sy, i % 9 === 0 ? 3 : 2, i % 9 === 0 ? 3 : 2);
    }

    // Moon
    var ma = 1 - storm;
    if (ma > 0.02) {
      var mg = ctx.createRadialGradient(110, 76, 6, 110, 76, 70);
      mg.addColorStop(0, 'rgba(255,248,210,' + 0.45 * ma + ')');
      mg.addColorStop(1, 'rgba(255,248,210,0)');
      ctx.fillStyle = mg; ctx.fillRect(30, 0, 160, 160);
      ctx.fillStyle = 'rgba(250,244,214,' + ma + ')';
      ctx.beginPath(); ctx.arc(110, 76, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(205,198,170,' + 0.7 * ma + ')';
      ctx.beginPath(); ctx.arc(103, 70, 5, 0, Math.PI * 2); ctx.arc(118, 84, 4, 0, Math.PI * 2); ctx.fill();
    }

    // Shooting star on the calm night sky
    var sq = (t % 7000) / 900;
    if (sq < 1 && storm < 0.3) {
      var sa = (1 - sq) * (1 - storm * 3);
      ctx.strokeStyle = 'rgba(255,255,230,' + sa + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(380 - sq * 220, 30 + sq * 90); ctx.lineTo(380 - sq * 220 + 40, 30 + sq * 90 - 14); ctx.stroke();
    }

    // Storm clouds drifting
    if (storm > 0.02) {
      for (i = 0; i < 7; i++) {
        var cx = ((i * 150 + t / (28 + i * 4)) % 820) - 90, cy = 26 + i * 30 + Math.sin(t / 2000 + i) * 4;
        ctx.fillStyle = this.mix([44, 12, 22], [20, 6, 14], (i % 3) / 2);
        ctx.globalAlpha = storm * 0.85;
        ctx.beginPath(); ctx.ellipse(cx, cy, 120, 22, 0, 0, Math.PI * 2); ctx.ellipse(cx + 60, cy - 10, 80, 18, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Dawn glow on the horizon
    if (dawn > 0) {
      var dg = ctx.createRadialGradient(150, 340, 10, 150, 340, 340);
      dg.addColorStop(0, 'rgba(255,190,110,' + 0.55 * dawn + ')');
      dg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = dg; ctx.fillRect(0, 0, w, 400);
    }

    // The castle's red glow and the beam into the sky
    if (castle > 0 && (glow > 0 || castle >= 1)) {
      var gl = Math.max(glow, 0.25 * castle) * (0.8 + 0.2 * Math.sin(t / 380));
      var rg = ctx.createRadialGradient(520, 230, 10, 520, 230, 220);
      rg.addColorStop(0, 'rgba(255,50,40,' + 0.55 * gl + ')');
      rg.addColorStop(1, 'rgba(255,50,40,0)');
      ctx.fillStyle = rg; ctx.fillRect(280, 0, 360, 420);
      if (glow > 0.4) {
        var bg = ctx.createLinearGradient(0, 0, 0, 200);
        bg.addColorStop(0, 'rgba(255,60,50,0)');
        bg.addColorStop(1, 'rgba(255,90,60,' + 0.6 * glow + ')');
        ctx.fillStyle = bg;
        ctx.fillRect(520 - 7 - Math.sin(t / 300) * 2, 0, 14 + Math.sin(t / 300) * 4, 200);
      }
    }

    // Far mountains
    ctx.fillStyle = this.mix([14, 14, 38], [26, 8, 16], storm);
    ctx.beginPath(); ctx.moveTo(0, 340); ctx.lineTo(0, 300); ctx.lineTo(70, 262); ctx.lineTo(150, 300); ctx.lineTo(230, 270); ctx.lineTo(330, 318);
    ctx.lineTo(410, 290); ctx.lineTo(470, 230); ctx.lineTo(520, 214); ctx.lineTo(590, 244); ctx.lineTo(640, 270); ctx.lineTo(640, 340); ctx.closePath(); ctx.fill();

    // Demon King's castle on the far peak
    if (castle > 0) {
      ctx.save();
      ctx.globalAlpha = castle;
      ctx.fillStyle = '#0a0510';
      ctx.fillRect(496, 170, 48, 50);                       // keep
      ctx.fillRect(480, 150, 14, 70); ctx.fillRect(546, 150, 14, 70);   // side towers
      ctx.fillRect(512, 140, 16, 40);                       // central tower
      var spire = function(x, base, wd, ht) { ctx.beginPath(); ctx.moveTo(x - wd / 2 - 2, base); ctx.lineTo(x, base - ht); ctx.lineTo(x + wd / 2 + 2, base); ctx.closePath(); ctx.fill(); };
      spire(487, 150, 14, 34); spire(553, 150, 14, 34); spire(520, 140, 16, 46); spire(502, 170, 12, 22); spire(538, 170, 12, 22);
      var wp = 0.6 + 0.4 * Math.sin(t / 300);
      ctx.fillStyle = 'rgba(255,70,50,' + wp + ')';
      ctx.fillRect(516, 156, 8, 10); ctx.fillRect(505, 188, 5, 8); ctx.fillRect(530, 188, 5, 8); ctx.fillRect(485, 176, 4, 7); ctx.fillRect(551, 176, 4, 7);
      ctx.restore();
    }

    // Lightning
    if (flash > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + flash + ')'; ctx.lineWidth = 3;
      var seed = Math.floor(t / 1400);
      var bx = 360 + this.rnd(seed) * 200, by = 0;
      ctx.beginPath(); ctx.moveTo(bx, by);
      for (k = 0; k < 7; k++) { bx += (this.rnd(seed * 9 + k) - 0.45) * 46; by += 40 + this.rnd(seed * 3 + k) * 10; ctx.lineTo(bx, by); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(210,225,255,' + 0.38 * flash + ')'; ctx.fillRect(-10, -10, w + 20, h + 20);
    }

    // Near hill with the village
    ctx.fillStyle = this.mix([8, 8, 22], [14, 6, 12], storm);
    ctx.beginPath(); ctx.moveTo(0, 480); ctx.lineTo(0, 360); ctx.quadraticCurveTo(160, 318, 330, 372); ctx.quadraticCurveTo(480, 410, 640, 384); ctx.lineTo(640, 480); ctx.closePath(); ctx.fill();
    var houses = [[40, 372, 34, 22], [92, 360, 40, 26], [150, 354, 30, 20], [206, 360, 38, 24], [264, 372, 32, 20]];
    for (i = 0; i < houses.length; i++) {
      var hx = houses[i][0], hy = houses[i][1], hw = houses[i][2], hh = houses[i][3];
      ctx.fillStyle = this.mix([12, 12, 30], [20, 8, 14], storm);
      ctx.fillRect(hx, hy, hw, hh);
      ctx.beginPath(); ctx.moveTo(hx - 4, hy); ctx.lineTo(hx + hw / 2, hy - 14); ctx.lineTo(hx + hw + 4, hy); ctx.closePath(); ctx.fill();
      var lit = 0.75 + 0.25 * Math.sin(t / 260 + i * 2.1);
      ctx.fillStyle = 'rgba(255,205,110,' + lit * (1 - storm * 0.55) + ')';
      ctx.fillRect(hx + 6, hy + 7, 6, 6); if (hw > 33) ctx.fillRect(hx + hw - 12, hy + 7, 6, 6);
    }
    ctx.fillStyle = this.mix([6, 10, 18], [12, 6, 10], storm);   // pines
    var pines = [18, 74, 190, 246, 300];
    for (i = 0; i < pines.length; i++) {
      var px = pines[i], py = 376 + (i % 2) * 4;
      for (k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px - 12 + k * 2, py - k * 12); ctx.lineTo(px, py - 22 - k * 12); ctx.lineTo(px + 12 - k * 2, py - k * 12); ctx.closePath(); ctx.fill(); }
    }

    // Mist along the ground
    var mg2 = ctx.createLinearGradient(0, 380, 0, 480);
    mg2.addColorStop(0, 'rgba(80,60,110,0)');
    mg2.addColorStop(1, 'rgba(60,40,80,' + (0.35 + storm * 0.2) + ')');
    ctx.fillStyle = mg2; ctx.fillRect(-10, 380, w + 20, 110);

    // The three heroes on the foreground, back view, lit by the dawn
    if (o.heroes > 0) {
      var ids = ['sam', 'dario', 'sundar'], hs = o.heroes;
      for (i = 0; i < 3; i++) {
        var hq = Math.max(0, Math.min(1, hs * 1.6 - i * 0.3));
        if (hq <= 0) continue;
        var hxp = 232 + i * 80, hyp = 358 - (1 - hq) * 30;
        ctx.save();
        ctx.globalAlpha = hq;
        ctx.translate(hxp, hyp); ctx.scale(2.2, 2.2);
        var col = CHARACTERS[ids[i]].color;
        UI.drawPlayer(ctx, -16, -26, 32, 'up', { body: col, hair: '#222' });
        ctx.restore();
        ctx.save();                                    // darken them until the dawn rises
        ctx.globalAlpha = hq * 0.7 * (1 - dawn);
        ctx.fillStyle = '#05050f';
        ctx.fillRect(hxp - 17, hyp - 56, 34, 72);
        ctx.restore();
      }
    }

    // Vignette
    var vg = ctx.createRadialGradient(w / 2, h / 2, 140, w / 2, h / 2, 420);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(-10, -10, w + 20, h + 20);
    ctx.restore();
  },

  // Title logo: letters drop in one by one, then a light sweep passes over now and then.
  // Returns the time (ms) at which the logo has fully landed.
  drawLogo: function(ctx, t) {
    var text = 'エルドラシア戦記', n = text.length, cx = 320, y = 118, i;
    ctx.save();
    ctx.font = 'bold 40px monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    var step = 44, total = n * step, x0 = cx - total / 2;
    var landed = 300 + (n - 1) * 110 + 520;
    // soft glow behind the logo
    var ga = Math.min(1, t / (landed + 200));
    var lg = ctx.createRadialGradient(cx, y - 14, 10, cx, y - 14, 260);
    lg.addColorStop(0, 'rgba(255,200,80,' + 0.25 * ga + ')');
    lg.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, 640, 380);
    for (i = 0; i < n; i++) {
      var lt = (t - 300 - i * 110) / 520;
      if (lt <= 0) continue;
      var q = Math.min(1, lt);
      var ease = 1 - Math.pow(1 - q, 3), bounce = q < 1 ? Math.sin(q * Math.PI * 2.5) * (1 - q) * 10 : 0;
      var dy = (1 - ease) * -70 + (q < 1 ? -bounce * 0 : 0) - bounce * 0.6;
      ctx.globalAlpha = Math.min(1, lt * 2.5);
      ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#2a1200';
      ctx.strokeText(text[i], x0 + i * step, y + dy);
      var gr = ctx.createLinearGradient(0, y - 34 + dy, 0, y + 4 + dy);
      gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.5, '#ffd700'); gr.addColorStop(1, '#d68a10');
      ctx.fillStyle = gr;
      ctx.fillText(text[i], x0 + i * step, y + dy);
      if (lt >= 1 && lt < 1.5) {                      // impact sparkle as each letter lands
        var sp = (lt - 1) / 0.5;
        ctx.globalAlpha = 1 - sp; ctx.fillStyle = '#fff6c0';
        ctx.fillRect(x0 + i * step + 18 - sp * 14, y - 10 - sp * 14, 3, 3);
        ctx.fillRect(x0 + i * step + 18 + sp * 14, y - 10 + sp * 6, 3, 3);
        ctx.fillRect(x0 + i * step + 18, y - 40 - sp * 6, 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    // light sweep across the finished logo
    var st = (t - landed) % 5200;
    if (t > landed && st < 900) {
      var sx = x0 - 40 + (st / 900) * (total + 120);
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - 10, y - 40, total + 20, 54); ctx.clip();
      var sg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(sx - 30, y + 14); ctx.lineTo(sx - 6, y - 40); ctx.lineTo(sx + 38, y - 40); ctx.lineTo(sx + 14, y + 14); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    return landed;
  },

  // Typewriter narration centred near the bottom of the screen
  drawNarration: function(ctx, t) {
    var cur = null, i;
    for (i = 0; i < this.TEXTS.length; i++) if (t >= this.TEXTS[i].from && t < this.TEXTS[i].to) cur = this.TEXTS[i];
    if (!cur) return;
    var lt = t - cur.from, left = cur.to - t;
    var a = Math.min(1, lt / 300) * Math.min(1, left / 400);
    var shown = Math.floor(lt / 55), line, text;
    ctx.save();
    ctx.globalAlpha = a;
    var band = ctx.createLinearGradient(0, 372, 0, 480);
    band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(0.4, 'rgba(0,0,0,0.7)'); band.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = band; ctx.fillRect(0, 372, 640, 108);
    ctx.font = '20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < cur.lines.length; i++) {
      line = cur.lines[i];
      text = line.slice(0, Math.max(0, shown));
      shown -= line.length;
      ctx.fillStyle = '#000'; ctx.fillText(text, 321, 411 + i * 32);
      ctx.fillStyle = '#f4efe0'; ctx.fillText(text, 320, 410 + i * 32);
    }
    ctx.restore();
  },

  // Full opening frame. Returns nothing; the caller handles completion.
  render: function(ctx, t, skipFade) {
    var sc = this.sceneAt(t);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 640, 480);
    this.drawScene(ctx, sc);
    // hero name plates as they appear
    if (t > 17000) {
      var names = [['サム', '戦士', '#4488cc'], ['ダリオ', '魔法使い', '#cc4488'], ['スンダー', '僧侶', '#44cc88']];
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var i = 0; i < 3; i++) {
        var nt = (t - 17300 - i * 700) / 500;
        if (nt <= 0) continue;
        ctx.globalAlpha = Math.min(1, nt) * Math.max(0, Math.min(1, (21300 - t) / 400));
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#000'; ctx.fillText(names[i][0], 233 + i * 80, 285 - Math.min(1, nt) * 6 + 1);
        ctx.fillStyle = names[i][2]; ctx.fillText(names[i][0], 232 + i * 80, 284 - Math.min(1, nt) * 6);
        ctx.font = '11px monospace'; ctx.fillStyle = '#ddd'; ctx.fillText(names[i][1], 232 + i * 80, 302 - Math.min(1, nt) * 6);
      }
      ctx.restore();
    }
    this.drawNarration(ctx, t);
    // Fade from black at the start, to black at the end (or on skip)
    var fade = Math.max(0, 1 - t / 800);
    var end = Math.max(0, Math.min(1, (t - (this.DURATION - 900)) / 800));
    var a = Math.max(fade, end, skipFade || 0);
    if (a > 0) { ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(0, 0, 640, 480); }
    // skip hint
    if (t > 1200 && t < this.DURATION - 1500) {
      ctx.save(); ctx.textAlign = 'right'; ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('Z: スキップ', 628, 18); ctx.restore();
    }
  },
};
