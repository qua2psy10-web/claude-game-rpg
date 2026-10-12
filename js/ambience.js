// ============================================================
// ambience.js — Living maps: animated tiles, per-area atmosphere, wandering NPCs,
// the area-name banner and scheduled ambient one-shots (birds, distant thunder).
// Drawing + update helpers; MapSystem (map.js) calls into this.
// ============================================================

var AmbienceSystem = {
  BANNER_MS: 2800,
  WALK_MS: 320,              // how long an NPC takes to glide one tile

  rnd: function(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); },

  // Wind strength 0..1 that also travels across the map as a gust front
  wind: function(now, mx) { return 0.55 + 0.45 * Math.sin(now / 2300 + mx * 0.12); },

  // ---------- animated tiles (drawn right after the static tile) ----------
  tileAnim: function(ctx, ch, px, py, ts, now, mx, my) {
    var ph = mx * 0.9 + my * 1.3, w = this.wind(now, mx), k;
    if (ch === 'W') {                                        // water: sliding ripples and glints
      ctx.fillStyle = 'rgba(190,230,255,0.28)';
      ctx.fillRect(px + 4 + Math.sin(now / 700 + ph) * 4, py + 8, 10, 2);
      ctx.fillRect(px + 14 + Math.sin(now / 800 + ph + 2) * 4, py + 20, 12, 2);
      k = Math.sin(now / 500 + ph * 2.3);
      if (k > 0.88) { ctx.fillStyle = 'rgba(255,255,255,' + (k - 0.88) * 6 + ')'; ctx.fillRect(px + 10 + (mx % 3) * 6, py + 12, 3, 3); }
    } else if (ch === 'L') {                                 // lava: pulsing glow and rising bubbles
      ctx.fillStyle = 'rgba(255,140,30,' + (0.12 + 0.12 * Math.sin(now / 420 + ph)) + ')';
      ctx.fillRect(px, py, ts, ts);
      var bq = ((now / 1600) + this.rnd(mx * 31 + my)) % 1;
      ctx.fillStyle = 'rgba(255,230,120,' + (1 - bq) * 0.8 + ')';
      ctx.beginPath(); ctx.arc(px + 8 + this.rnd(mx + my * 7) * 16, py + ts - bq * ts, 2 + bq * 2, 0, Math.PI * 2); ctx.fill();
    } else if (ch === 'G' || ch === '.') {                   // grass: blades lean with the wind
      var lean = Math.sin(now / 380 + mx * 0.7 + my * 0.3) * (1.2 + 2.2 * w);
      ctx.strokeStyle = ch === '.' ? 'rgba(255,255,255,0.22)' : 'rgba(210,255,170,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 9, py + 16); ctx.lineTo(px + 9 + lean, py + 8);
      ctx.moveTo(px + 22, py + 26); ctx.lineTo(px + 22 + lean, py + 18);
      ctx.stroke();
      if (ch === '.') {                                      // flowers nod
        ctx.fillStyle = (mx + my) % 2 ? '#ffd0e0' : '#fff2a0';
        ctx.fillRect(px + 14 + lean * 0.6, py + 10 + Math.sin(now / 500 + ph) * 0.6, 3, 3);
      }
    } else if (ch === 'F') {                                 // trees: dappled light moves across the canopy
      ctx.fillStyle = 'rgba(200,255,150,0.12)';
      ctx.beginPath(); ctx.arc(px + 12 + Math.sin(now / 1100 + ph) * 4, py + 10 + Math.cos(now / 1300 + ph) * 3, 4, 0, Math.PI * 2); ctx.fill();
    } else if (ch === 'D') {                                 // dark floor: faint violet veins breathe
      ctx.fillStyle = 'rgba(140,60,190,' + (0.04 + 0.06 * Math.sin(now / 900 + ph)) + ')';
      ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
    } else if (ch === 'T') {                                 // throne: the gem glints
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(now / 250)) + ')';
      ctx.fillRect(px + 14, py + 7, 3, 2);
    }
  },

  // ---------- NPC life ----------
  // Interpolated tile position + a small bob while walking / breathing while idle
  npcPos: function(npc, now, idx) {
    var a = npc.anim, x = npc.x, y = npc.y, bob = Math.sin(now / 700 + idx * 1.9) * 0.7;
    if (a) {
      var q = Math.min(1, (now - a.t0) / this.WALK_MS);
      if (q >= 1) { npc.anim = null; }
      else {
        var e = 1 - Math.pow(1 - q, 2);
        x = a.fx + (npc.x - a.fx) * e; y = a.fy + (npc.y - a.fy) * e;
        bob = -Math.abs(Math.sin(q * Math.PI * 2)) * 2.5;
      }
    }
    return { x: x, y: y, bob: bob };
  },

  // Only NPCs flagged `wander: radius` roam (the shopkeepers stay at their counters)
  updateNPCs: function(game, now) {
    var map = MAPS[game.currentMap];
    if (!map || !map.npcs) return;
    for (var i = 0; i < map.npcs.length; i++) {
      var n = map.npcs[i];
      if (!n.wander) continue;
      if (n.hx === undefined) { n.hx = n.x; n.hy = n.y; n.nextMove = now + 1200 + this.rnd(i + 5) * 2500; }
      if (now < n.nextMove || n.anim) continue;
      n.nextMove = now + 2200 + Math.random() * 3600;
      var dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
      var d = dirs[Math.floor(Math.random() * 4)];
      n.dir = d[0];                                          // always turn; sometimes that is all
      if (Math.random() < 0.3) continue;
      var nx = n.x + d[1], ny = n.y + d[2];
      if (Math.abs(nx - n.hx) + Math.abs(ny - n.hy) > n.wander) continue;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      var tc = map.tiles[ny][nx];
      if ('f.GR'.indexOf(tc) < 0) continue;                  // floors and open ground only (never doors / counters)
      if (map.events[nx + ',' + ny]) continue;
      if ((nx === game.playerX && ny === game.playerY) || (game.moveAnim && nx === game.moveAnim.fx && ny === game.moveAnim.fy)) continue;
      var blocked = false;
      for (var j = 0; j < map.npcs.length; j++) if (j !== i && map.npcs[j].x === nx && map.npcs[j].y === ny) blocked = true;
      if (blocked) continue;
      n.anim = { fx: n.x, fy: n.y, t0: now };
      n.x = nx; n.y = ny;
    }
  },

  // Ambient one-shots: birds by day, distant thunder and lightning in the castle
  update: function(game, now) {
    this.updateNPCs(game, now);
    var a = game.ambience;
    if (!a || a.map !== game.currentMap) { a = game.ambience = { map: game.currentMap, nextBird: now + 6000 + Math.random() * 8000, nextBolt: now + 9000 + Math.random() * 12000, boltAt: 0 }; }
    var id = game.currentMap;
    if ((id === 'world' || id === 'millhaven' || id === 'forest') && now >= a.nextBird) {
      a.nextBird = now + 11000 + Math.random() * 16000;
      if (typeof SoundSystem !== 'undefined' && SoundSystem.birdsFar) SoundSystem.birdsFar(id === 'forest');
    }
    if (id === 'castle' && now >= a.nextBolt) {
      a.nextBolt = now + 16000 + Math.random() * 18000;
      a.boltAt = now;
      var thunderIn = 350 + Math.random() * 500;
      setTimeout(function() { if (game.currentMap === 'castle' && typeof SoundSystem !== 'undefined' && SoundSystem.distantThunder) SoundSystem.distantThunder(); }, thunderIn);
    }
  },

  // ---------- area atmosphere (drawn over the map, under the HUD) ----------
  renderOverlay: function(ctx, game, now, w, h) {
    var id = game.currentMap, i;
    var vig = function(r, g, b, a0, a1) {
      var v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
      v.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + a0 + ')');
      v.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',' + a1 + ')');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    };
    ctx.save();
    if (id === 'world') {
      // Cloud shadows drifting across the plain
      for (i = 0; i < 4; i++) {
        var cx = ((now / (46 + i * 9) + i * 230) % (w + 400)) - 200, cy = 60 + i * 120 + Math.sin(now / 4000 + i) * 20;
        var cg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 130);
        cg.addColorStop(0, 'rgba(10,30,60,0.16)'); cg.addColorStop(1, 'rgba(10,30,60,0)');
        ctx.fillStyle = cg; ctx.fillRect(cx - 140, cy - 100, 280, 200);
      }
      this.birds(ctx, now, w, h);
      this.motes(ctx, now, w, h, 'rgba(255,255,220,', 14);
      vig(255, 240, 200, 0, 0.06);
    } else if (id === 'millhaven') {
      var sg = ctx.createRadialGradient(40, 20, 10, 40, 20, 420);
      sg.addColorStop(0, 'rgba(255,236,170,0.16)'); sg.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
      this.motes(ctx, now, w, h, 'rgba(255,245,200,', 16);
      this.butterflies(ctx, now, w, h);
      this.birds(ctx, now, w, h);
    } else if (id === 'forest') {
      vig(0, 24, 0, 0.0, 0.34);
      ctx.fillStyle = 'rgba(0,30,10,0.12)'; ctx.fillRect(0, 0, w, h);
      for (i = 0; i < 4; i++) {                              // slanting light shafts
        var sx = 60 + i * 170 + Math.sin(now / 2600 + i * 1.7) * 28, sa = 0.08 + 0.04 * Math.sin(now / 1800 + i);
        var lg = ctx.createLinearGradient(sx, 0, sx + 140, h);
        lg.addColorStop(0, 'rgba(255,250,170,' + sa * 1.6 + ')'); lg.addColorStop(1, 'rgba(255,250,170,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 56, 0); ctx.lineTo(sx + 230, h); ctx.lineTo(sx + 110, h); ctx.closePath(); ctx.fill();
      }
      for (i = 0; i < 9; i++) {                              // falling leaves
        var lq = ((now / 7000) + this.rnd(i * 3)) % 1;
        var lx = this.rnd(i * 3 + 1) * w + Math.sin(lq * 12 + i) * 30, ly = lq * (h + 30) - 15;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(lq * 9 + i);
        ctx.fillStyle = i % 3 ? 'rgba(150,190,70,0.8)' : 'rgba(210,150,60,0.8)';
        ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
      }
      for (i = 0; i < 12; i++) {                             // fireflies
        var fx = this.rnd(i * 5 + 40) * w + Math.sin(now / 1500 + i * 2) * 22, fy = this.rnd(i * 5 + 41) * h + Math.cos(now / 1900 + i) * 16;
        var fa = 0.5 + 0.5 * Math.sin(now / 520 + i * 1.9);
        if (fa < 0.35) continue;
        var fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 9);
        fg.addColorStop(0, 'rgba(230,255,140,' + fa + ')'); fg.addColorStop(1, 'rgba(230,255,140,0)');
        ctx.fillStyle = fg; ctx.fillRect(fx - 9, fy - 9, 18, 18);
      }
    } else if (id === 'abyss') {
      vig(0, 12, 22, 0.12, 0.66);
      ctx.fillStyle = 'rgba(0,60,90,' + (0.06 + 0.04 * Math.sin(now / 900)) + ')'; ctx.fillRect(0, 0, w, h);
      this.motes(ctx, now, w, h, 'rgba(120,230,240,', 26);
    } else if (id === 'castle') {
      vig(14, 0, 24, 0.12, 0.62);
      ctx.fillStyle = 'rgba(120,0,40,' + (0.05 + 0.04 * Math.sin(now / 700)) + ')'; ctx.fillRect(0, 0, w, h);
      for (i = 0; i < 3; i++) {                              // creeping fog
        var fgx = ((now / (60 + i * 17) + i * 260) % (w + 500)) - 250, fgy = 130 + i * 150;
        var fgg = ctx.createRadialGradient(fgx, fgy, 20, fgx, fgy, 200);
        fgg.addColorStop(0, 'rgba(190,150,220,0.12)'); fgg.addColorStop(1, 'rgba(190,150,220,0)');
        ctx.fillStyle = fgg; ctx.fillRect(fgx - 210, fgy - 120, 420, 240);
      }
      for (i = 0; i < 18; i++) {                             // embers rising
        var eq = ((now / 5200) + this.rnd(i * 7)) % 1;
        var ex = this.rnd(i * 7 + 1) * w + Math.sin(eq * 9 + i) * 14, ey = h - eq * (h + 20);
        ctx.fillStyle = 'rgba(255,' + (110 + Math.floor(this.rnd(i) * 90)) + ',50,' + (1 - eq) * 0.85 + ')';
        ctx.fillRect(ex, ey, 2.5, 2.5);
      }
      var a = game.ambience, bt = a ? now - a.boltAt : 9999;   // lightning through the walls
      if (a && a.boltAt && bt < 520) {
        var fa2 = (bt < 80 ? 0.5 : 0.3 * (1 - bt / 520)) + (bt > 160 && bt < 240 ? 0.15 : 0);
        ctx.fillStyle = 'rgba(210,200,255,' + fa2 + ')'; ctx.fillRect(0, 0, w, h);
      }
    }
    ctx.restore();
  },

  motes: function(ctx, now, w, h, col, n) {
    for (var i = 0; i < n; i++) {
      var q = ((now / 9000) + this.rnd(i * 2)) % 1;
      var x = this.rnd(i * 2 + 1) * w + Math.sin(now / 1700 + i) * 18, y = h - q * (h + 20);
      ctx.fillStyle = col + (0.35 * Math.sin(q * Math.PI)) + ')';
      ctx.fillRect(x, y, 2, 2);
    }
  },

  // Small "v" birds crossing the sky now and then
  birds: function(ctx, now, w, h) {
    for (var i = 0; i < 3; i++) {
      var cycle = 24000, t = (now + i * 7300) % cycle, q = t / 9000;
      if (q >= 1) continue;
      var x = -30 + q * (w + 60), y = 70 + i * 90 + Math.sin(q * 6 + i) * 16;
      var flap = Math.sin(now / 90 + i * 2) * 4;
      ctx.strokeStyle = 'rgba(20,20,30,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 7, y - flap); ctx.lineTo(x, y); ctx.lineTo(x + 7, y - flap); ctx.stroke();
    }
  },

  butterflies: function(ctx, now, w, h) {
    var cols = ['#ffb0d0', '#ffe080'];
    for (var i = 0; i < 2; i++) {
      var x = w * (0.3 + 0.4 * i) + Math.sin(now / 1700 + i * 3) * 120, y = h * 0.55 + Math.sin(now / 1300 + i) * 70 + Math.sin(now / 230) * 3;
      var wing = Math.abs(Math.sin(now / 110 + i)) * 5 + 1;
      ctx.fillStyle = cols[i];
      ctx.beginPath(); ctx.ellipse(x - 3, y, wing, 4, 0, 0, Math.PI * 2); ctx.ellipse(x + 3, y, wing, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
  },

  // ---------- "— Area name —" banner when entering a map ----------
  renderBanner: function(ctx, game, now) {
    var map = MAPS[game.currentMap];
    if (!map) return;
    if (game.bannerMap !== game.currentMap) { game.bannerMap = game.currentMap; game.banner = { t0: now }; }
    var b = game.banner;
    if (!b) return;
    var t = now - b.t0;
    if (t > this.BANNER_MS) { game.banner = null; return; }
    var a = Math.min(1, t / 450) * Math.min(1, (this.BANNER_MS - t) / 700);
    var spread = 1 + (1 - Math.min(1, t / 700)) * 0.5;        // letters glide together as it appears
    ctx.save();
    ctx.globalAlpha = a;
    var cx = 320, cy = 118;
    var bg = ctx.createLinearGradient(0, cy - 40, 0, cy + 40);
    bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.5, 'rgba(0,0,10,0.55)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, cy - 40, 640, 80);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = 'bold 26px monospace';
    var chars = map.name.split(''), step = 28 * spread, total = chars.length * step, x0 = cx - total / 2;
    for (var i = 0; i < chars.length; i++) {
      ctx.fillStyle = '#000'; ctx.fillText(chars[i], x0 + i * step + 1, cy - 4 + 1);
      ctx.fillStyle = '#ffe8a8'; ctx.fillText(chars[i], x0 + i * step, cy - 4);
    }
    if (map.nameEn) {
      ctx.textAlign = 'center'; ctx.font = '11px monospace'; ctx.fillStyle = 'rgba(220,220,240,0.85)';
      ctx.fillText(map.nameEn, cx, cy + 20);
    }
    var lw = 70 + (1 - spread + 0.5) * 0, ly = cy - 4;      // ornament lines either side of the name
    ctx.strokeStyle = 'rgba(255,232,168,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0 - 18, ly); ctx.lineTo(x0 - 18 - lw, ly); ctx.moveTo(x0 + total + 4, ly); ctx.lineTo(x0 + total + 4 + lw, ly); ctx.stroke();
    ctx.restore();
  },
};
