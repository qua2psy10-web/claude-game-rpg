// ============================================================
// town.js — Shop and inn presentation (comparison panel, buy effects, the inn's night scene)
// Pure drawing / lookup helpers; the state machines live in main.js.
// ============================================================

var TownSystem = {
  INN_DURATION: 8200,       // ms, a full night at the inn
  INN_HEAL_AT: 5000,        // ms into the night when the party wakes and the gauges fill
  INN_CUES: [
    { t: 0,    fn: 'inn' },
    { t: 4100, fn: 'openingDawn' },
    { t: 4300, fn: 'birds' },
    { t: 5000, fn: 'heal' },
  ],

  statTable: function(type) { return type === 'weapon' ? WEAPONS : type === 'armor' ? ARMORS : type === 'accessory' ? ACCESSORIES : ITEMS; },

  // How many of an equipment id the party owns (in the bag + worn)
  ownedCount: function(game, si) {
    var n = 0, i;
    if (si.type === 'item') {
      for (i = 0; i < game.inventory.length; i++) if (game.inventory[i].id === si.id) n += game.inventory[i].count;
      return n;
    }
    for (i = 0; i < game.equipInventory.length; i++) if (game.equipInventory[i].id === si.id) n++;
    for (i = 0; i < game.party.length; i++) if (game.party[i][si.type] === si.id) n++;
    return n;
  },

  // Per-character stat changes if this equipment were worn: [{ name, can, parts: [{ label, from, to }] }]
  equipDiff: function(game, si) {
    var table = this.statTable(si.type), def = table[si.id], out = [];
    if (!def || si.type === 'item') return out;
    var stats = [['atk', 'ATK'], ['def', 'DEF'], ['int', 'INT'], ['spd', 'SPD'], ['hp', 'HP']];
    for (var i = 0; i < game.party.length; i++) {
      var c = game.party[i];
      var can = !def.equip || def.equip.indexOf(c.classId) >= 0;
      var cur = c[si.type] ? table[c[si.type]] : null;
      var parts = [];
      for (var k = 0; k < stats.length; k++) {
        var key = stats[k][0], nv = def[key] || 0, ov = cur ? (cur[key] || 0) : 0;
        if (!nv && !ov) continue;
        var base = key === 'hp' ? c.maxHp : c[key];
        parts.push({ label: stats[k][1], from: base, to: base - ov + nv });
      }
      out.push({ name: c.name, can: can, parts: parts });
    }
    return out;
  },

  // Lower-left message window + lower-right comparison window of the shop screen
  drawShopInfo: function(ctx, game, ss, shop, now) {
    var si = shop.items[ss.index], def = si && this.statTable(si.type)[si.id];
    UI.drawWindow(ctx, 20, 360, 270, 110);
    var msg = ss.msg || ['いらっしゃいませ！', 'ごゆっくり どうぞ。'];
    for (var m = 0; m < msg.length; m++) UI.drawText(ctx, msg[m], 36, 376 + m * 26, ss.msgColor || '#fff');
    UI.drawWindow(ctx, 300, 360, 320, 110);
    if (!def) return;
    var owned = this.ownedCount(game, si);
    if (si.type === 'item') {
      UI.drawText(ctx, def.name, 316, 372, '#ffd700');
      UI.drawText(ctx, def.desc || '', 316, 398, '#ccc', UI.FONT_SMALL);
      UI.drawText(ctx, 'もっている数: ' + owned, 316, 424, '#aaa', UI.FONT_SMALL);
      return;
    }
    UI.drawText(ctx, 'そうび くらべ', 316, 368, '#ffd700', UI.FONT_SMALL);
    UI.drawText(ctx, 'もっている: ' + owned, 490, 368, '#aaa', UI.FONT_SMALL);
    var diff = this.equipDiff(game, si);
    for (var d = 0; d < diff.length; d++) {
      var row = diff[d], y = 392 + d * 22;
      UI.drawText(ctx, row.name, 316, y, row.can ? '#fff' : '#666', UI.FONT_SMALL);
      if (!row.can) { UI.drawText(ctx, 'そうび できない', 398, y, '#666', UI.FONT_SMALL); continue; }
      var x = 398;
      for (var p = 0; p < row.parts.length && p < 2; p++) {
        var part = row.parts[p], delta = part.to - part.from;
        var col = delta > 0 ? '#7f7' : (delta < 0 ? '#f77' : '#aaa');
        var arrow = delta > 0 ? '▲' : (delta < 0 ? '▼' : '＝');
        UI.drawText(ctx, part.label + ' ' + part.from + '→' + part.to + arrow, x, y, col, UI.FONT_SMALL);
        x += 108;
      }
    }
  },

  // Coins fly from the gold window to the bought row; the price floats away in red
  drawBuyFx: function(ctx, ss, rowY, now) {
    var fx = ss.buyFx;
    if (!fx) return;
    var t = now - fx.t0;
    if (t > 1100) { ss.buyFx = null; return; }
    ctx.save();
    if (t < 520) {                                    // the bought row flashes gold
      ctx.fillStyle = 'rgba(255,215,0,' + 0.32 * (1 - t / 520) + ')';
      ctx.fillRect(28, rowY - 4, 584, 26);
    }
    for (var i = 0; i < 9; i++) {
      var q = Math.max(0, Math.min(1, (t - i * 45) / 520));
      if (q <= 0 || q >= 1) continue;
      var sx = 150 + (i % 3) * 14, sy = 38, ex = 70, ey = rowY + 8;
      var x = sx + (ex - sx) * q, y = sy + (ey - sy) * q - Math.sin(q * Math.PI) * 46;
      ctx.globalAlpha = 1 - q * 0.4;
      ctx.fillStyle = '#ffd700'; ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = '#fff4a0'; ctx.fillRect(x - 2, y - 2, 3, 3);
    }
    if (t < 900) {                                    // "-120G" drifts up from the gold counter
      ctx.globalAlpha = 1 - t / 900;
      UI.drawText(ctx, '-' + fx.price + 'G', 330, 30 - t / 40, '#f66');
    }
    if (t > 300 && t < 1000) {                        // sparkles on the new item
      for (var s = 0; s < 6; s++) {
        var st = (t - 300) / 700, a = s / 6 * Math.PI * 2;
        ctx.globalAlpha = 1 - st; ctx.fillStyle = '#fff6c0';
        ctx.fillRect(110 + Math.cos(a) * (10 + st * 26) - 1, rowY + 8 + Math.sin(a) * (4 + st * 12) - 1, 3, 3);
      }
    }
    ctx.restore();
  },

  // ---------- inn ----------
  clamp: function(x) { return Math.max(0, Math.min(1, x)); },

  // The room at night turning into morning. k: 0 (night) .. 1 (morning)
  drawInnRoom: function(ctx, t) {
    var w = 640, h = 480, k = this.clamp((t - 500) / 3600), i;
    var mixc = function(a, b, q) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * q) + ',' + Math.round(a[1] + (b[1] - a[1]) * q) + ',' + Math.round(a[2] + (b[2] - a[2]) * q) + ')'; };
    // Wall and floor
    var wg = ctx.createLinearGradient(0, 0, 0, 360);
    wg.addColorStop(0, '#3a2a22'); wg.addColorStop(1, '#4a3629');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, w, 360);
    ctx.fillStyle = '#5a4030'; ctx.fillRect(0, 360, w, 120);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (i = 0; i < 9; i++) ctx.fillRect(0, 366 + i * 14, w, 2);
    // Window
    var wx = 220, wy = 70, ww = 200, wh = 170;
    ctx.fillStyle = '#2a1c14'; ctx.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    var sg = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sg.addColorStop(0, mixc([8, 12, 40], [110, 150, 220], k));
    sg.addColorStop(1, mixc([22, 26, 70], [255, 190, 130], k));
    ctx.fillStyle = sg; ctx.fillRect(wx, wy, ww, wh);
    for (i = 0; i < 26; i++) {                                    // stars fade with the dawn
      ctx.fillStyle = 'rgba(255,255,220,' + (0.35 + 0.4 * Math.sin(t / 300 + i)) * (1 - k) + ')';
      ctx.fillRect(wx + this.rnd(i) * ww, wy + this.rnd(i + 50) * wh * 0.8, 2, 2);
    }
    ctx.fillStyle = 'rgba(250,244,214,' + (1 - k * 1.2 > 0 ? 1 - k * 1.2 : 0) + ')';   // the moon sinks
    ctx.beginPath(); ctx.arc(wx + 60 - k * 20, wy + 40 + k * 110, 15, 0, Math.PI * 2); ctx.fill();
    var sun = this.clamp((k - 0.55) / 0.45);                      // the sun rises
    if (sun > 0) {
      var sgx = wx + 130, sgy = wy + wh - sun * 50;
      var rg = ctx.createRadialGradient(sgx, sgy, 4, sgx, sgy, 90);
      rg.addColorStop(0, 'rgba(255,240,170,' + 0.9 * sun + ')'); rg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = rg; ctx.fillRect(wx, wy, ww, wh);
    }
    ctx.fillStyle = '#10101e';                                    // rooftops outside
    ctx.fillRect(wx, wy + wh - 22, ww, 22);
    ctx.fillRect(wx + 20, wy + wh - 38, 34, 16); ctx.fillRect(wx + 110, wy + wh - 32, 40, 10);
    ctx.restore();
    ctx.fillStyle = '#2a1c14'; ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh); ctx.fillRect(wx, wy + wh / 2 - 3, ww, 6);

    // Morning light shaft across the floor
    if (k > 0.3) {
      var la = (k - 0.3) / 0.7 * 0.28;
      ctx.fillStyle = 'rgba(255,230,160,' + la + ')';
      ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww, wy + wh); ctx.lineTo(wx + ww + 150, 470); ctx.lineTo(wx - 60, 470); ctx.closePath(); ctx.fill();
    }

    // Beds with the three sleeping heroes
    var cols = ['#4a78b8', '#b84a88', '#4ab888'], names = ['sam', 'dario', 'sundar'];
    for (i = 0; i < 3; i++) {
      var bx = 70 + i * 190, by = 300;
      ctx.fillStyle = '#3a2418'; ctx.fillRect(bx - 4, by - 6, 128, 74);
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(bx + 4, by + 2, 40, 22);               // pillow
      ctx.fillStyle = '#ffcc88'; ctx.fillRect(bx + 12, by + 8, 22, 16);              // face
      ctx.fillStyle = CHARACTERS[names[i]].color; ctx.fillRect(bx + 8, by + 4, 30, 8);   // hair/hat colour
      ctx.fillStyle = k > 0.9 ? '#222' : '#222';
      ctx.fillRect(bx + 15, by + 17, 5, 2); ctx.fillRect(bx + 26, by + 17, 5, 2);     // closed eyes
      ctx.fillStyle = cols[i]; ctx.fillRect(bx + 4, by + 24, 116, 40);                // blanket
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(bx + 4, by + 24, 116, 6);
      if (k < 0.9) {                                                                  // Zzz
        ctx.font = 'bold 18px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        for (var z = 0; z < 3; z++) {
          var zq = ((t / 1600) + z / 3 + i * 0.3) % 1;
          ctx.fillStyle = 'rgba(220,230,255,' + (1 - zq) * (1 - k) + ')';
          ctx.fillText('z', bx + 40 + zq * 26 + z * 6, by - 2 - zq * 52);
        }
      }
    }
    // Lamp that dims as the day comes
    var lamp = (1 - k) * (0.85 + 0.15 * Math.sin(t / 130));
    var lg = ctx.createRadialGradient(560, 240, 4, 560, 240, 170);
    lg.addColorStop(0, 'rgba(255,190,90,' + 0.55 * lamp + ')'); lg.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = lg; ctx.fillRect(380, 80, 260, 320);
    ctx.fillStyle = '#2a1c14'; ctx.fillRect(540, 250, 40, 8); ctx.fillRect(556, 258, 8, 30);
    ctx.fillStyle = 'rgba(255,210,120,' + (0.4 + 0.6 * lamp) + ')'; ctx.fillRect(551, 236, 18, 14);

    // Night darkness lifts toward morning; a white flash at the moment of waking
    ctx.fillStyle = 'rgba(6,6,24,' + 0.58 * (1 - k) + ')'; ctx.fillRect(0, 0, w, h);
    var ft = t - 4100;
    if (ft > 0 && ft < 700) { ctx.fillStyle = 'rgba(255,248,220,' + 0.8 * (1 - ft / 700) + ')'; ctx.fillRect(0, 0, w, h); }
  },
  rnd: function(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); },

  // The party's gauges refill after waking: before -> full
  drawInnStatus: function(ctx, game, inn, t) {
    var st = t - this.INN_HEAL_AT;
    if (st < 0) return;
    var a = this.clamp(st / 300), fill = this.clamp(st / 1700), e = 1 - Math.pow(1 - fill, 3);
    ctx.save();
    ctx.globalAlpha = a;
    UI.drawWindow(ctx, 60, 340, 520, 126);
    for (var i = 0; i < game.party.length; i++) {
      var c = game.party[i], b = inn.before[i], y = 354 + i * 36;
      var hp = Math.round(b.hp + (c.maxHp - b.hp) * e), mp = Math.round(b.mp + (c.maxMp - b.mp) * e);
      UI.drawText(ctx, c.name, 80, y, '#fff');
      UI.drawText(ctx, 'HP ' + hp + '/' + c.maxHp, 190, y, '#fff', UI.FONT_SMALL);
      UI.drawText(ctx, 'MP ' + mp + '/' + c.maxMp, 190, y + 16, '#9cf', UI.FONT_SMALL);
      ctx.fillStyle = '#222'; ctx.fillRect(310, y + 2, 180, 8); ctx.fillRect(310, y + 18, 180, 6);
      ctx.fillStyle = '#4c4'; ctx.fillRect(310, y + 2, 180 * hp / c.maxHp, 8);
      ctx.fillStyle = '#48f'; ctx.fillRect(310, y + 18, 180 * mp / c.maxMp, 6);
      if (!b.alive) {                                                        // revived members glow
        var ra = 0.6 + 0.4 * Math.sin(st / 120);
        UI.drawText(ctx, '復活！', 506, y + 4, 'rgba(255,230,120,' + ra + ')');
      }
      if (fill < 1) {                                                        // sparkles ride the rising gauge
        for (var s = 0; s < 4; s++) {
          var sx = 310 + 180 * hp / c.maxHp - this.rnd(i * 7 + s) * 30, sy = y - 4 - ((st / 300 + s * 0.27) % 1) * 12;
          ctx.fillStyle = '#e8ffe0'; ctx.fillRect(sx, sy, 3, 3);
        }
      }
    }
    ctx.restore();
  },

  // Whole inn-night frame. Returns nothing; main.js handles completion.
  renderNight: function(ctx, game, inn, t) {
    this.drawInnRoom(ctx, t);
    this.drawInnStatus(ctx, game, inn, t);
    var fadeIn = this.clamp(1 - t / 700), fadeOut = this.clamp((t - (this.INN_DURATION - 700)) / 600);
    var a = Math.max(fadeIn, fadeOut);
    if (a > 0) { ctx.fillStyle = 'rgba(0,0,0,' + a + ')'; ctx.fillRect(0, 0, 640, 480); }
    if (t > 800 && t < this.INN_DURATION - 1000) {
      ctx.save(); ctx.textAlign = 'right'; ctx.font = '12px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('Z: スキップ', 628, 18); ctx.restore();
    }
  },
};
