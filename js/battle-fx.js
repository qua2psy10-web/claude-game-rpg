// ============================================================
// battle-fx.js — Battle effect drawing: enemy casts, hits, damage pops, the boss intro, escape, victory, level-up and every spell / item / attack effect.
// Adds its methods to BattleSystem (defined in battle.js), so load it right after battle.js.
// ============================================================

Object.assign(BattleSystem, {
  // Enemy spell delivery: a fireball flies to its target or a dark wave sweeps the screen,
  // then the whole screen reacts at impact (embers / vortex)
  renderEnemyCastLate: function(ctx, game, w, h, now) {
    var b = game.battle;
    var cf = b.enemyCast;
    if (!cf || cf.ed === undefined) return;
    var t = now - cf.t0;
    if (t < 0 || t > cf.ed + 380) return;
    var caster = b.enemies[cf.idx];
    if (!caster || caster.sx === undefined) return;
    var rgb = cf.tint, i;
    ctx.save();

    // Heal: a pillar of light descends on the caster while sparkles stream upward into it
    if (cf.spellId === 'enemyHeal') {
      var hlt = t - (cf.ed - 200);
      if (hlt > 0 && hlt < 700) {
        var hlp = hlt / 700, hla = Math.sin(Math.PI * hlp);
        var hbw = 30 * (caster.sscale || 1) * (0.6 + 0.4 * hla);
        var hlg = ctx.createLinearGradient(caster.sx - hbw, 0, caster.sx + hbw, 0);
        hlg.addColorStop(0, 'rgba(120,255,170,0)');
        hlg.addColorStop(0.5, 'rgba(210,255,225,' + (0.8 * hla) + ')');
        hlg.addColorStop(1, 'rgba(120,255,170,0)');
        ctx.fillStyle = hlg;
        ctx.fillRect(caster.sx - hbw, 0, hbw * 2, caster.sfoot + 4);
        ctx.fillStyle = '#d8ffe4';
        for (i = 0; i < 14; i++) {
          ctx.globalAlpha = hla;
          ctx.fillRect(caster.sx + (this.fxRnd(i + 2400) - 0.5) * 70 * (caster.sscale || 1),
                       caster.sfoot - hlp * (30 + this.fxRnd(i + 2500) * 90), 3, 7);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Travel phase (last 260 ms of the charge)
    var tp = (t - (cf.ed - 260)) / 260;
    if (tp > 0 && tp < 1 && cf.side === 'party') {
      if (cf.spellId === 'enemyFire' && cf.targetIdx >= 0) {
        var tx = w - 150, ty = h - 178 + cf.targetIdx * 36;
        var sx0 = caster.sx, sy0 = caster.sy;
        for (i = 6; i >= 0; i--) {                     // glowing trail
          var tq = Math.max(0, tp - i * 0.05);
          var fx = sx0 + (tx - sx0) * tq;
          var fy = sy0 + (ty - sy0) * tq - Math.sin(tq * Math.PI) * 50;
          var fr = 16 - i * 1.6;
          var fg = ctx.createRadialGradient(fx, fy, 1, fx, fy, fr * 1.6);
          fg.addColorStop(0, 'rgba(255,240,180,' + (0.95 - i * 0.12) + ')');
          fg.addColorStop(0.5, 'rgba(' + rgb + ',' + (0.8 - i * 0.1) + ')');
          fg.addColorStop(1, 'rgba(' + rgb + ',0)');
          ctx.fillStyle = fg;
          ctx.fillRect(fx - fr * 2, fy - fr * 2, fr * 4, fr * 4);
        }
      } else if (cf.targetIdx === -1) {                // party-wide: expanding wave from the caster
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.8 * (1 - tp * 0.4)) + ')';
        ctx.lineWidth = 10 * (1 - tp * 0.5);
        ctx.shadowColor = 'rgb(' + rgb + ')';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(caster.sx, caster.sy, tp * w * 0.9, tp * h * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Dark tendrils snake out from the caster toward every party member
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(200,110,255,0.85)';
        for (i = 0; i < 3; i++) {
          var ttx = caster.sx + (w - 150 - caster.sx) * tp, tty = caster.sy + (h - 178 + i * 36 - caster.sy) * tp;
          ctx.beginPath();
          ctx.moveTo(caster.sx, caster.sy);
          ctx.quadraticCurveTo((caster.sx + ttx) / 2 + Math.sin(now / 60 + i * 2) * 40,
                               (caster.sy + tty) / 2 - 40 + Math.cos(now / 50 + i) * 30, ttx, tty);
          ctx.stroke();
        }
      }
    }

    // Impact phase
    var lt = t - cf.ed;
    if (lt >= 0 && lt < 380 && cf.side === 'party') {
      var ip = lt / 380;
      if (cf.spellId === 'enemyFire') {
        if (cf.targetIdx >= 0) {                       // fireball explodes on the target's row
          var bx0 = w - 150, by0 = h - 178 + cf.targetIdx * 36;
          var br = 20 + ip * 80;
          var bgx = ctx.createRadialGradient(bx0, by0, 2, bx0, by0, br);
          bgx.addColorStop(0, 'rgba(255,250,200,' + (0.95 * (1 - ip)) + ')');
          bgx.addColorStop(0.5, 'rgba(255,140,40,' + (0.7 * (1 - ip)) + ')');
          bgx.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = bgx;
          ctx.fillRect(bx0 - br, by0 - br, br * 2, br * 2);
          ctx.strokeStyle = 'rgba(255,200,120,' + (0.8 * (1 - ip)) + ')';
          ctx.lineWidth = 4 * (1 - ip) + 1;
          ctx.beginPath();
          ctx.arc(bx0, by0, 10 + ip * 110, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,120,30,' + (0.4 * (1 - ip)) + ')';
        ctx.fillRect(0, 0, w, h);
        for (i = 0; i < 22; i++) {                     // embers raining down
          var ex2 = this.fxRnd(i + 1500) * w;
          var ey2 = (this.fxRnd(i + 1600) * 0.4 + ip * (0.6 + this.fxRnd(i + 1700) * 0.5)) * h;
          ctx.globalAlpha = 1 - ip;
          ctx.fillStyle = i % 3 ? '#ff9a2a' : '#ffe066';
          ctx.fillRect(ex2, ey2, 4, 4);
        }
      } else {
        var vg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.15, w / 2, h * 0.45, w * 0.7);
        vg.addColorStop(0, 'rgba(' + rgb + ',0)');
        vg.addColorStop(1, 'rgba(20,0,40,' + (0.75 * (1 - ip)) + ')');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.7 * (1 - ip)) + ')';
        ctx.lineWidth = 5;
        for (i = 0; i < 3; i++) {                      // violet ripples
          ctx.beginPath();
          ctx.arc(w / 2, h * 0.5, 40 + ip * (260 + i * 90), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  },

  // Claw slashes over the struck party member's status row + red edge flash
  renderPartyHit: function(ctx, game, w, h, now) {
    var b = game.battle;
    var hit = b.partyHit;
    if (!hit || hit.idx < -1) return;
    var t = now - hit.t0;
    if (t < 0 || t > 450) return;
    var p = t / 450;
    ctx.save();

    // Red flash around the screen edges
    var rg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h * 0.45, w * 0.7);
    var tn = hit.tint || '255,0,0';
    rg.addColorStop(0, 'rgba(' + tn + ',0)');
    rg.addColorStop(1, 'rgba(' + tn + ',' + 0.45 * (1 - p) + ')');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);

    // Melee impact: the effect depends on how this species attacks
    if (hit.melee) {
      var hst = hit.style || 'slash';
      var fadeA = 1 - Math.max(0, p - 0.5) / 0.5;
      var gq, gi, ga;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgb(' + tn + ')';
      ctx.shadowBlur = 14;
      ctx.globalAlpha = fadeA;
      if (hst === 'pounce') {                       // wolf: three parallel claw rakes
        for (gi = 0; gi < 3; gi++) {
          gq = Math.max(0, Math.min(1, p * 3.4 - gi * 0.18));
          if (gq <= 0) continue;
          ctx.strokeStyle = gi === 1 ? '#fff' : '#ff6a6a';
          ctx.lineWidth = 8 * (1 - gq * 0.5);
          ctx.beginPath();
          ctx.moveTo(w * 0.30 + gi * 34, h * 0.08);
          ctx.lineTo(w * 0.30 + gi * 34 + w * 0.2 * gq, h * 0.08 + h * 0.62 * gq);
          ctx.stroke();
        }
      } else if (hst === 'dive') {                  // bat: fang punctures with blood drops on the bitten row
        if (hit.idx >= 0) {
          var fx0 = w - 120, fy0 = h - 182 + hit.idx * 36;
          var fq = Math.min(1, p * 4);
          ctx.fillStyle = '#ff3050';
          for (gi = -1; gi <= 1; gi += 2) {
            ctx.beginPath();
            ctx.moveTo(fx0 + gi * 12 - 5, fy0 - 14 * fq);
            ctx.lineTo(fx0 + gi * 12 + 5, fy0 - 14 * fq);
            ctx.lineTo(fx0 + gi * 12, fy0 + 6 * fq);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.arc(fx0 + gi * 12, fy0 + 10 + p * 24, 3, 0, Math.PI * 2);   // drop sliding down
            ctx.fill();
          }
        }
        ga = Math.max(0, 0.3 * (1 - p * 2));
        ctx.fillStyle = 'rgba(200,0,40,' + ga + ')';
        ctx.fillRect(-10, -10, w + 20, h + 20);
      } else if (hst === 'hop') {                   // slime: goo splat spreads across the screen
        ctx.fillStyle = 'rgba(' + tn + ',' + (0.55 * fadeA) + ')';
        for (gi = 0; gi < 12; gi++) {
          var ga2 = gi / 12 * Math.PI * 2 + this.fxRnd(gi + 2000) * 0.4;
          var gd = (40 + this.fxRnd(gi + 2100) * 150) * Math.min(1, p * 3);
          ctx.beginPath();
          ctx.arc(w * 0.5 + Math.cos(ga2) * gd * 1.6, h * 0.58 + Math.sin(ga2) * gd * 0.7, 10 + this.fxRnd(gi + 2200) * 16, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.58, 60 + p * 140, 26 + p * 40, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (hst === 'heavy') {                 // knight / boss: a huge crescent chops across the screen
        gq = Math.max(0, Math.min(1, p * 3));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 18 * (1 - gq * 0.5);
        ctx.beginPath();
        ctx.arc(w * 0.5, -h * 0.25, h * 0.95, Math.PI * (0.12 + 0.76 * (1 - gq)), Math.PI * 0.88);
        ctx.stroke();
        ctx.strokeStyle = 'rgb(' + tn + ')';
        ctx.lineWidth = 8 * (1 - gq * 0.5);
        ctx.beginPath();
        ctx.arc(w * 0.5, -h * 0.25 + 12, h * 0.95, Math.PI * (0.12 + 0.76 * (1 - gq)), Math.PI * 0.88);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(' + tn + ',' + (0.8 * (1 - p)) + ')';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.7, 30 + p * 330, 8 + p * 60, 0, 0, Math.PI * 2);   // ground shockwave
        ctx.stroke();
      } else {                                      // goblin / skeleton / mage: a crossing X slash
        for (gi = 0; gi < 2; gi++) {
          gq = Math.max(0, Math.min(1, p * 3.2 - gi * 0.3));
          if (gq <= 0) continue;
          ctx.strokeStyle = gi ? '#fff' : '#ff6a6a';
          ctx.lineWidth = 9 * (1 - gq * 0.6);
          var xa = gi ? w * 0.64 : w * 0.28, xb = gi ? w * 0.32 : w * 0.58;
          ctx.beginPath();
          ctx.moveTo(xa, h * 0.1);
          ctx.lineTo(xa + (xb - xa) * gq, h * 0.1 + h * 0.6 * gq);
          ctx.stroke();
        }
      }
      if (hit.heavy && p < 0.5) {                    // radial speed lines converge on the impact
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - p / 0.5)) + ')';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (gi = 0; gi < 28; gi++) {
          var ra = gi / 28 * Math.PI * 2 + this.fxRnd(gi + 4000) * 0.2;
          var r0 = w * (0.25 + 0.2 * (p / 0.5)), r1 = r0 + w * (0.15 + this.fxRnd(gi + 4100) * 0.2);
          ctx.moveTo(w / 2 + Math.cos(ra) * r0, h * 0.5 + Math.sin(ra) * r0 * 0.75);
          ctx.lineTo(w / 2 + Math.cos(ra) * r1, h * 0.5 + Math.sin(ra) * r1 * 0.75);
        }
        ctx.stroke();
      }
      if (hit.heavy && p < 0.25) {
        ctx.globalAlpha = 0.45 * (1 - p / 0.25);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }
      ctx.restore();
    }

    // Three claw marks across the member's row (every row for party-wide hits)
    var x0 = w - 215;
    ctx.beginPath();
    ctx.rect(w - 220, h - 200, 215, 120);   // keep marks inside the status window
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgb(' + tn + ')';
    ctx.strokeStyle = 'rgb(' + tn + ')';
    var rows = hit.idx === -1 ? [0, 1, 2] : [hit.idx];
    for (var ri = 0; ri < rows.length; ri++) {
      var rowY = h - 190 + rows[ri] * 36;
      for (var i = 0; i < 3; i++) {
        var sp = Math.max(0, Math.min(1, p * 2.4 - i * 0.2));
        if (sp <= 0) continue;
        ctx.globalAlpha = 1 - Math.max(0, p - 0.55) / 0.45;
        ctx.lineWidth = 4 - sp * 2;
        var sx = x0 + 40 + i * 50;
        ctx.beginPath();
        ctx.moveTo(sx, rowY - 14);
        ctx.lineTo(sx + 30 * sp, rowY - 14 + 44 * sp);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  // Draw floating numbers (called last so party numbers sit above the status window)
  renderPops: function(ctx, game, w, h, now) {
    var b = game.battle;
    if (!b.pops || b.pops.length === 0) return;
    var live = [];
    for (var i = 0; i < b.pops.length; i++) {
      var pp = b.pops[i];
      var t = now - pp.t0;
      if (t >= 1400) continue;
      live.push(pp);
      if (t < 0) continue;   // delayed until the hit lands
      var x, y;
      if (pp.isParty) {
        var k = game.party.indexOf(pp.target);
        // Centre of the screen, one column per party member so numbers don't overlap
        x = w / 2 + (k - (game.party.length - 1) / 2) * 110;
        y = h * 0.52;
      } else {
        if (pp.fixed) {
          x = pp.fixed.x;
          y = pp.fixed.y;
        } else {
          if (pp.target.sx === undefined) continue;
          x = pp.target.sx;
          y = pp.target.sfoot - 22 * pp.target.sscale - 38 * pp.target.sscale;
        }
      }
      var val = (pp.kind === 'exp' || pp.kind === 'alert') ? 0 : (parseInt(pp.text, 10) || 0);
      // Bigger numbers for bigger hits (damage only)
      var size = (pp.crit ? 12 : 0) + (pp.kind === 'alert' ? 48 : pp.kind === 'exp' ? 26 : 44 + (pp.kind === 'dmg' ? Math.min(24, val / 4) : 0));
      var rise = 1 - Math.pow(1 - Math.min(1, t / 900), 3);   // easeOutCubic
      var bounce = (pp.kind !== 'exp' && pp.kind !== 'alert' && t < 300) ? Math.abs(Math.sin(t / 300 * Math.PI)) * 22 : 0;
      var sc = pp.kind === 'exp' ? (t < 200 ? 0.6 + 0.4 * (t / 200) : 1) : (t < 160 ? 2.2 - 1.2 * (t / 160) : 1);   // slam in from large (exp: gentle pop)
      var alpha = t > 1050 ? 1 - (t - 1050) / 350 : 1;
      var top = '#ffffff', bot = '#ffe14d', glow = '#ffb300';
      if (pp.kind === 'heal') { top = '#eaffee'; bot = '#4dff7a'; glow = '#1fd45a'; }
      else if (pp.kind === 'mp') { top = '#eef6ff'; bot = '#5aa8ff'; glow = '#2b7cff'; }
      else if (pp.kind === 'alert') { top = '#ffd0d0'; bot = '#ff2a2a'; glow = '#ff0000'; }
      else if (pp.kind === 'poison') { top = '#f0d0ff'; bot = '#a030e0'; glow = '#7a10c0'; }
      else if (pp.kind === 'exp') { top = '#fff6b0'; bot = '#ffc400'; glow = '#ff9d00'; }
      else if (pp.isParty) { top = '#ffd0d0'; bot = '#ff3030'; glow = '#ff0000'; }
      var text = (pp.kind === 'dmg' || pp.kind === 'exp' || pp.kind === 'alert' || pp.kind === 'poison') ? pp.text : '+' + pp.text;
      var sx = (pp.isParty && pp.kind === 'dmg' && t < 400) ? Math.sin(t / 25) * 5 : 0;   // party hits jitter
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x + sx, y - rise * 46 - bounce);
      ctx.scale(sc, sc);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(size) + 'px monospace';
      ctx.lineJoin = 'round';
      // Glow + thick dark outline, then gradient fill
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#000';
      ctx.strokeText(text, 0, 0);
      ctx.shadowBlur = 0;
      var gr = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      gr.addColorStop(0, top);
      gr.addColorStop(1, bot);
      ctx.fillStyle = gr;
      ctx.fillText(text, 0, 0);
      if (pp.crit) {
        ctx.font = 'bold 16px monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.strokeText('大ダメージ！', 0, -size * 0.78);
        ctx.fillStyle = '#ffd23a';
        ctx.fillText('大ダメージ！', 0, -size * 0.78);
      }
      if (pp.isParty) {
        // Name tag under the number so it's clear who it belongs to
        ctx.font = 'bold 14px monospace';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000';
        ctx.strokeText(pp.target.name, 0, size * 0.62);
        ctx.fillStyle = '#fff';
        ctx.fillText(pp.target.name, 0, size * 0.62);
      }
      ctx.restore();
    }
    b.pops = live;
  },

  // Boss entrance overlay. t = ms since battle start, lt = ms since the boss landed (-1 before)
  renderBossIntro: function(ctx, w, h, t, lt, name) {
    if (t > 2600) return;
    ctx.save();

    // Dark red gloom that lifts as the boss appears
    var gloom = Math.max(0, 0.5 * (1 - t / 2500));
    ctx.fillStyle = 'rgba(40,0,10,' + gloom + ')';
    ctx.fillRect(0, 0, w, h);

    // Distant lightning before the boss shows up
    var flashes = [350, 600];
    for (var i = 0; i < flashes.length; i++) {
      var ft = t - flashes[i];
      if (ft > 0 && ft < 140) {
        ctx.fillStyle = 'rgba(255,255,255,' + 0.5 * (1 - ft / 140) + ')';
        ctx.fillRect(0, 0, w, h);
      }
    }
    // Red flash on impact
    if (lt >= 0 && lt < 350) {
      ctx.fillStyle = 'rgba(255,60,40,' + 0.5 * (1 - lt / 350) + ')';
      ctx.fillRect(0, 0, w, h);
    }

    // Letterbox bars slide in, then out
    var bar = 52 * Math.min(1, t / 300) * (t > 2200 ? Math.max(0, 1 - (t - 2200) / 400) : 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);

    // Boss name banner after the landing
    if (lt >= 250) {
      var nt = lt - 250;
      var a = Math.min(1, nt / 300) * (t > 2200 ? Math.max(0, 1 - (t - 2200) / 400) : 1);
      var track = 14 - Math.min(10, nt / 80);   // letters start spread out, then pull together
      ctx.globalAlpha = a;
      ctx.font = 'bold 44px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      var chars = name.split('');
      var total = 0, k;
      for (k = 0; k < chars.length; k++) total += ctx.measureText(chars[k]).width + track;
      var x = (w - total) / 2;
      var g = ctx.createLinearGradient(0, h * 0.2 - 24, 0, h * 0.2 + 24);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(1, '#ff3a2a');
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#2a0000';
      ctx.shadowColor = '#ff2a00';
      ctx.shadowBlur = 14;
      for (k = 0; k < chars.length; k++) {
        ctx.strokeText(chars[k], x, h * 0.2);
        ctx.fillStyle = g;
        ctx.fillText(chars[k], x, h * 0.2);
        x += ctx.measureText(chars[k]).width + track;
      }
    }
    ctx.restore();
  },

  renderEscape: function(ctx, w, h, t, game) {
    var i;
    ctx.save();

    // Perspective speed lines radiating from the horizon's vanishing point
    var rr = Math.min(1, t / 300);
    var vx = w / 2, vy = h * 0.42;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * rr) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (i = 0; i < 26; i++) {
      var ra = this.fxRnd(i + 1500) * Math.PI * 2;
      var rph = ((t / 420) + this.fxRnd(i + 1600)) % 1;
      var r0 = 40 + rph * rph * 420, r1 = r0 + 20 + rph * 90;
      ctx.moveTo(vx + Math.cos(ra) * r0, vy + Math.sin(ra) * r0 * 0.8);
      ctx.lineTo(vx + Math.cos(ra) * r1, vy + Math.sin(ra) * r1 * 0.8);
    }
    ctx.stroke();

    // Horizontal speed lines streaking past (ramp up, then keep going)
    var ramp = Math.min(1, t / 250);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 * ramp) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (i = 0; i < 22; i++) {
      var y = this.fxRnd(i + 900) * h * 0.85;
      var len = 70 + this.fxRnd(i + 950) * 110;
      var speed = 1.2 + this.fxRnd(i + 990) * 1.2;
      var x = w - ((t * speed + this.fxRnd(i + 1000) * (w + 300)) % (w + 300)) + 100;
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
    }
    ctx.stroke();

    // Dust puffs kicked up along the floor
    for (i = 0; i < 10; i++) {
      var dt = t - i * 70;
      if (dt < 0 || dt > 600) continue;
      var dp = dt / 600;
      ctx.fillStyle = 'rgba(210,200,225,' + 0.55 * (1 - dp) + ')';
      ctx.beginPath();
      ctx.arc(w * 0.62 - dp * 150 + this.fxRnd(i + 1100) * 30, h * 0.6 + this.fxRnd(i + 1200) * 18 - dp * 10, 8 + dp * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Each hero leaves as a coloured comet with afterimages, streaking off toward the right edge
    var pcols = ['#6ab0ff', '#ff7ac0', '#6dffb0'];
    if (game) {
      for (i = 0; i < game.party.length; i++) {
        var ct = t - 150 - i * 70;
        if (ct < 0 || ct > 650) continue;
        var cq = ct / 650;
        var chx = w - 250 + i * 48, chy = h - 238 + 10 - cq * 30;
        var cx2 = chx + cq * cq * (w - chx + 140);
        for (var ca = 0; ca < 7; ca++) {
          var cqa = Math.max(0, cq - ca * 0.035);
          var ax = chx + cqa * cqa * (w - chx + 140), ay = h - 238 + 10 - cqa * 30;
          ctx.globalAlpha = (1 - ca / 7) * 0.7 * (1 - Math.max(0, cq - 0.8) / 0.2);
          ctx.fillStyle = pcols[i % 3];
          ctx.beginPath();
          ctx.ellipse(ax, ay, 14 - ca, 6 - ca * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1 - Math.max(0, cq - 0.8) / 0.2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(cx2, chy, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Enemies left behind: "?" marks wobble over them as they lose the trail
    if (game && game.battle) {
      var qs = game.battle.enemies;
      for (i = 0; i < qs.length; i++) {
        var qe = qs[i];
        if (!qe.alive || qe.sx === undefined) continue;
        var qt = t - 350 - i * 80;
        if (qt < 0) continue;
        var qa = Math.min(1, qt / 120) * (1 - Math.max(0, (t - 800) / 200));
        if (qa <= 0) continue;
        ctx.globalAlpha = qa;
        ctx.font = 'bold ' + Math.round(26 * (qe.sscale || 1)) + 'px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#102a5a';
        ctx.fillStyle = '#ffe66a';
        var qy2 = qe.sfoot - 92 * (qe.sscale || 1) - Math.min(8, qt / 30);
        ctx.save();
        ctx.translate(qe.sx, qy2);
        ctx.rotate(Math.sin(qt / 90) * 0.18);
        ctx.strokeText('？', 0, 0);
        ctx.fillText('？', 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Smoke burst where the party takes off, then a rolling trail of dust clouds behind them
    var bx = w - 200, by = h - 215;
    if (t < 700) {
      var bp = t / 700;
      for (i = 0; i < 9; i++) {
        var ba = Math.PI + (i / 8 - 0.5) * 1.6;
        var bd = 10 + bp * (40 + this.fxRnd(i + 1300) * 40);
        ctx.fillStyle = 'rgba(235,228,245,' + 0.7 * (1 - bp) + ')';
        ctx.beginPath();
        ctx.arc(bx + Math.cos(ba) * bd, by + 20 + Math.sin(ba) * bd * 0.35 - bp * 12, 9 + bp * 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (i = 0; i < 12; i++) {
      var ft = t - 120 - i * 55;
      if (ft < 0 || ft > 520) continue;
      var fp = ft / 520;
      ctx.fillStyle = 'rgba(190,180,205,' + 0.5 * (1 - fp) + ')';
      ctx.beginPath();
      ctx.arc(bx + 30 - i * 14 + fp * 30, by + 24 - fp * 8, 5 + fp * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    // Footprint flashes and sweat drops
    for (i = 0; i < 5; i++) {
      var st = t - 80 - i * 90;
      if (st < 0 || st > 350) continue;
      var sp = st / 350;
      ctx.fillStyle = 'rgba(160,220,255,' + (1 - sp) + ')';
      ctx.beginPath();
      ctx.arc(bx + 24 + i * 12 + sp * 16, by - 22 - sp * 14 + sp * sp * 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // "ダッシュ！" banner sweeping across
    var bt = (t - 60) / 640;
    if (bt > 0 && bt < 1) {
      var bxp = w + 120 - bt * (w + 420);
      ctx.save();
      ctx.globalAlpha = Math.min(1, bt * 6) * (1 - Math.max(0, bt - 0.8) / 0.2);
      ctx.font = 'italic bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#102a5a';
      ctx.fillStyle = '#fff6c0';
      ctx.setTransform(1, 0, -0.25, 1, ctx.getTransform().e + 0, ctx.getTransform().f);
      ctx.strokeText('ダッシュ！', bxp, h * 0.3);
      ctx.fillText('ダッシュ！', bxp, h * 0.3);
      ctx.restore();
    }

    // Iris closes on the battle
    var wt = (t - 700) / 500;
    if (wt > 0) {
      var maxR = Math.sqrt(w * w + h * h) / 2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.rect(-5, -5, w + 10, h + 10);
      ctx.arc(w / 2, h * 0.45, maxR * Math.max(0, 1 - wt), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      // last glint of light as the circle closes
      if (wt > 0.7) {
        var gk = (wt - 0.7) / 0.3;
        ctx.fillStyle = 'rgba(255,255,255,' + (1 - gk) + ')';
        ctx.beginPath(); ctx.arc(w / 2, h * 0.45, 4 + gk * 10, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  },

  // Failed escape: the party skids, dust billows forward, stars spin overhead and the screen flushes red
  renderEscapeFail: function(ctx, game, w, h, now) {
    var b = game.battle;
    var f = b.escapeFail;
    var t = (now - f.t0) / f.dur;
    if (t >= 1) { b.escapeFail = null; return; }
    if (t < 0) return;
    var i;
    var bx = w - 200, by = h - 215;
    ctx.save();
    // Red edge flush
    var rg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h * 0.45, w * 0.7);
    rg.addColorStop(0, 'rgba(255,0,0,0)');
    rg.addColorStop(1, 'rgba(255,30,30,' + (0.4 * Math.sin(Math.PI * Math.min(1, t * 1.3))) + ')');
    ctx.fillStyle = rg;
    ctx.fillRect(-10, -10, w + 20, h + 20);
    // Skid dust billowing forward (toward the enemies = left)
    for (i = 0; i < 10; i++) {
      var dp = Math.min(1, Math.max(0, t * 1.4 - i * 0.04));
      if (dp <= 0) continue;
      ctx.fillStyle = 'rgba(215,205,230,' + 0.6 * (1 - dp) + ')';
      ctx.beginPath();
      ctx.arc(bx - dp * (70 + i * 6), by + 24 - dp * 6 + (i % 3) * 3, 8 + dp * 16, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pincer: red chevrons slam in from both edges toward the party's escape route, then recoil
    var pq = Math.min(1, t / 0.35);
    var pr = t < 0.35 ? pq * pq : 1 - (t - 0.35) * 0.35;
    ctx.fillStyle = 'rgba(255,60,60,' + (0.75 * (1 - Math.max(0, t - 0.6) / 0.4)) + ')';
    for (i = 0; i < 5; i++) {
      var cy2 = h * 0.2 + i * h * 0.12;
      var lx = -30 + pr * (w * 0.32 + (i % 2) * 20), rx = w + 30 - pr * (w * 0.22 + (i % 2) * 20);
      ctx.beginPath();
      ctx.moveTo(lx - 24, cy2 - 14); ctx.lineTo(lx, cy2); ctx.lineTo(lx - 24, cy2 + 14); ctx.lineTo(lx - 16, cy2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rx + 24, cy2 - 14); ctx.lineTo(rx, cy2); ctx.lineTo(rx + 24, cy2 + 14); ctx.lineTo(rx + 16, cy2);
      ctx.closePath(); ctx.fill();
    }
    // Spinning stars over the head
    for (i = 0; i < 4; i++) {
      var sa = t * 9 + i * Math.PI / 2;
      var sx = bx + Math.cos(sa) * 22, sy = by - 34 + Math.sin(sa) * 6;
      ctx.globalAlpha = 1 - Math.max(0, t - 0.7) / 0.3;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(sx - 4, sy - 1, 8, 2);
      ctx.fillRect(sx - 1, sy - 4, 2, 8);
    }
    // Label
    ctx.globalAlpha = Math.min(1, t * 8) * (1 - Math.max(0, t - 0.75) / 0.25);
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3a0a0a';
    ctx.fillStyle = '#ffd0d0';
    var lab = f.blocked ? '逃げられない！' : '回り込まれた！';
    var shk = t < 0.3 ? Math.sin(t * 90) * 3 : 0;
    ctx.strokeText(lab, bx - 40 + shk, by - 70 - t * 10);
    ctx.fillText(lab, bx - 40 + shk, by - 70 - t * 10);
    ctx.restore();
  },

  // Victory scene: golden rays, VICTORY! banner and confetti
  renderVictory: function(ctx, w, h, t) {
    var cx = w / 2, cy = h * 0.3, i;
    ctx.save();

    // Rotating light rays
    var rayA = Math.min(1, t / 300) * 0.2;
    ctx.fillStyle = 'rgba(255,225,120,' + rayA + ')';
    for (i = 0; i < 12; i++) {
      var a0 = i * Math.PI / 6 + t / 2500;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, w, a0, a0 + Math.PI / 20);
      ctx.closePath();
      ctx.fill();
    }

    // Confetti
    var cols = ['#ffd700', '#ff6b6b', '#6bd6ff', '#9dff8a', '#ff9bf0'];
    for (i = 0; i < 70; i++) {
      var start = this.fxRnd(i + 300) * 700;
      var tt = t - start;
      if (tt < 0) continue;
      var speed = 0.12 + this.fxRnd(i + 400) * 0.1;
      var x = this.fxRnd(i) * w + Math.sin(tt / 300 + i) * 14;
      var y = -20 + tt * speed;
      if (y > h) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tt / 150 + i);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }

    // Banner pops in with overshoot, then settles
    var q = Math.min(1, t / 450);
    var sc = 1 + 2.7 * Math.pow(q - 1, 3) + 1.7 * Math.pow(q - 1, 2);   // easeOutBack
    var fadeOut = t > 2200 ? Math.max(0, 1 - (t - 2200) / 300) : 1;
    ctx.globalAlpha = Math.min(1, t / 150) * fadeOut;
    ctx.translate(cx, h * 0.2);
    ctx.scale(sc, sc);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 58px monospace';
    var tg = ctx.createLinearGradient(0, -30, 0, 30);
    tg.addColorStop(0, '#fff6b0');
    tg.addColorStop(0.5, '#ffd700');
    tg.addColorStop(1, '#e08a00');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#3a1a00';
    ctx.strokeText('VICTORY!', 0, 0);
    ctx.fillStyle = tg;
    ctx.fillText('VICTORY!', 0, 0);
    ctx.restore();
  },

  // Level-up scene: golden burst, rising sparkles, popping window, counting stats
  renderLevelUp: function(ctx, lu, w, h, t, color) {
    var cx = 320, cy = 180, i;
    // Character colour (hex) -> "r,g,b" for tinted rays and rings
    var tint = '255,215,0';
    var hm = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color || '');
    if (hm) tint = parseInt(hm[1], 16) + ',' + parseInt(hm[2], 16) + ',' + parseInt(hm[3], 16);
    var star = function(x, y, r) {
      ctx.beginPath();
      for (var k = 0; k < 8; k++) {
        var rr = k % 2 ? r * 0.4 : r, a = k * Math.PI / 4 - Math.PI / 2;
        if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.save();

    // Slowly rotating light rays in the character's colour
    ctx.fillStyle = 'rgba(' + tint + ',' + (0.2 * Math.min(1, t / 400)) + ')';
    for (i = 0; i < 14; i++) {
      var ra = i * Math.PI * 2 / 14 + t / 2200;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, w, ra, ra + Math.PI / 24);
      ctx.closePath();
      ctx.fill();
    }

    // Radial burst behind the window (flash, then a steady glow)
    var glowA = Math.max(0.25, 0.9 - t / 500);
    var gg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70 + Math.min(t, 400) * 0.9);
    gg.addColorStop(0, 'rgba(255,240,150,' + glowA + ')');
    gg.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, w, h);

    // Opening flash and expanding shock rings
    if (t < 260) {
      ctx.fillStyle = 'rgba(255,255,255,' + 0.7 * (1 - t / 260) + ')';
      ctx.fillRect(0, 0, w, h);
    }
    for (i = 0; i < 2; i++) {
      var rt0 = t - i * 140;
      if (rt0 > 0 && rt0 < 800) {
        var rp = rt0 / 800;
        ctx.strokeStyle = 'rgba(' + (i ? tint : '255,240,160') + ',' + (0.8 * (1 - rp)) + ')';
        ctx.lineWidth = 6 * (1 - rp) + 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + rp * 420, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Star burst flying out from the centre
    if (t < 1100) {
      var sa = 1 - t / 1100;
      for (i = 0; i < 36; i++) {
        var ang = this.fxRnd(i + 1300) * Math.PI * 2;
        var spd = 0.25 + this.fxRnd(i + 1400) * 0.4;
        ctx.globalAlpha = sa;
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? '#ffd700' : 'rgb(' + tint + ')');
        star(cx + Math.cos(ang) * spd * t, cy + Math.sin(ang) * spd * t + 0.0002 * t * t, 2 + 6 * sa);
      }
      ctx.globalAlpha = 1;
    }

    // Rising sparkles
    for (i = 0; i < 28; i++) {
      var period = 1600 + this.fxRnd(i + 600) * 1200;
      var ph = ((t + this.fxRnd(i + 700) * period) % period) / period;
      var sx = 110 + this.fxRnd(i + 800) * 420;
      var sy = 290 - ph * 260;
      ctx.globalAlpha = Math.sin(Math.PI * ph) * 0.9;
      ctx.fillStyle = i % 2 ? '#fff6b0' : '#ffd700';
      ctx.fillRect(sx - 1, sy - 4, 2, 8);
      ctx.fillRect(sx - 4, sy - 1, 8, 2);
    }
    ctx.globalAlpha = 1;

    // Descending pillar of light that strikes the window, then lingers as a faint column
    var pillarA = t < 450 ? Math.min(1, t / 150) : Math.max(0.12, 1 - (t - 450) / 700);
    var plw = 54 + (t < 450 ? (1 - t / 450) * 30 : 0);
    var plg = ctx.createLinearGradient(cx - plw, 0, cx + plw, 0);
    plg.addColorStop(0, 'rgba(' + tint + ',0)');
    plg.addColorStop(0.5, 'rgba(255,255,235,' + (0.75 * pillarA) + ')');
    plg.addColorStop(1, 'rgba(' + tint + ',0)');
    ctx.fillStyle = plg;
    ctx.fillRect(cx - plw, 0, plw * 2, 190 * Math.min(1, t / 160) + 90);

    // Fireworks bursting around the window
    var fwSpots = [[70, 60], [570, 70], [50, 230], [590, 210], [320, 30]];
    for (i = 0; i < fwSpots.length; i++) {
      var ft = t - 500 - i * 260;
      if (ft < 0 || ft > 900) continue;
      var fp = ft / 900;
      for (var fk = 0; fk < 12; fk++) {
        var fa = fk / 12 * Math.PI * 2 + i;
        var fd = (1 - Math.pow(1 - fp, 2)) * 46;
        ctx.globalAlpha = 1 - fp;
        ctx.fillStyle = fk % 2 ? '#fff6b0' : 'rgb(' + tint + ')';
        ctx.fillRect(fwSpots[i][0] + Math.cos(fa) * fd - 1.5, fwSpots[i][1] + Math.sin(fa) * fd + fp * fp * 14 - 1.5, 3, 3);
      }
    }
    ctx.globalAlpha = 1;

    // Class runes circling the window's frame (Sam: martial, Dario: arcane, Sundar: holy)
    var runes = { 'サム': '剣勇力闘', 'ダリオ': '炎氷雷魔', 'スンダー': '癒祈聖光' }[lu.name] || '勇者星光';
    ctx.save();   // keep the rune text settings from leaking into the window text
    var rw = 480, rh = 240, rx0 = 80, ry0 = 60;   // just outside the window frame
    var perim = 2 * (rw + rh);
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(' + tint + ',' + (0.9 * Math.min(1, t / 500)) + ')';
    for (i = 0; i < 16; i++) {
      var pd = ((t * 0.12) + i * perim / 16) % perim;
      var rx, ry2;
      if (pd < rw) { rx = rx0 + pd; ry2 = ry0; }
      else if (pd < rw + rh) { rx = rx0 + rw; ry2 = ry0 + (pd - rw); }
      else if (pd < 2 * rw + rh) { rx = rx0 + rw - (pd - rw - rh); ry2 = ry0 + rh; }
      else { rx = rx0; ry2 = ry0 + rh - (pd - 2 * rw - rh); }
      ctx.fillText(runes.charAt(i % runes.length), rx, ry2);
    }
    ctx.restore();

    // Window pop-in (easeOutBack)
    var q = Math.min(1, t / 300);
    var sc = 1 + 2.7 * Math.pow(q - 1, 3) + 1.7 * Math.pow(q - 1, 2);
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    UI.drawWindow(ctx, 100, 80, 440, 200);

    // Title pulses
    var pulse = 1 + Math.sin(t / 120) * 0.04;
    ctx.save();
    ctx.translate(cx, 62);
    ctx.scale(pulse, pulse);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px monospace';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3a1a00';
    ctx.strokeText('LEVEL UP!', 0, 0);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('LEVEL UP!', 0, 0);
    ctx.restore();

    UI.drawText(ctx, lu.name + 'は レベル ' + lu.level + 'に あがった！', 120, 95, '#ffd700');

    // Big level badge: old level flips to the new one with a pop
    var bt = t - 300;
    if (bt > 0) {
      var bsc = bt < 260 ? 2 - bt / 260 : 1;
      ctx.save();
      ctx.translate(450, 178);
      ctx.scale(bsc, bsc);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgb(' + tint + ')';
      ctx.shadowBlur = 18;
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#fff6b0';
      ctx.fillText('LEVEL', 0, -36);
      ctx.font = 'bold 72px monospace';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#3a1a00';
      ctx.strokeText(String(lu.level), 0, 6);
      var lg = ctx.createLinearGradient(0, -30, 0, 40);
      lg.addColorStop(0, '#ffffff');
      lg.addColorStop(1, '#ffc400');
      ctx.fillStyle = lg;
      ctx.fillText(String(lu.level), 0, 6);
      ctx.restore();
    }

    // Stats reveal one by one; numbers count up from old to new
    var stats = ['hp', 'mp', 'atk', 'def', 'spd', 'int'];
    var statNames = ['HP', 'MP', 'ATK', 'DEF', 'SPD', 'INT'];
    for (var si = 0; si < stats.length; si++) {
      var rt = t - (350 + si * 110);
      if (rt < 0) continue;
      var k = Math.min(1, rt / 350);
      var oldV = lu.oldStats[stats[si]], newV = lu.newStats[stats[si]];
      var cur = Math.round(oldV + (newV - oldV) * k);
      var diff = newV - oldV;
      var ry = 125 + si * 22;
      UI.drawText(ctx, statNames[si] + ': ' + oldV + ' → ' + cur, 120, ry, '#fff', UI.FONT_SMALL);
      if (k >= 1) {
        var flashOn = rt < 700 && Math.floor(rt / 90) % 2 === 0;
        var pt = rt - 350;                       // time since the number finished counting
        var psc = pt < 220 ? 1.8 - 0.8 * (pt / 220) : 1;
        ctx.save();
        ctx.translate(300, ry + 7);
        ctx.scale(psc, psc);
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#003a10';
        ctx.strokeText('+' + diff, 0, 0);
        ctx.fillStyle = flashOn ? '#ffffff' : '#7dff8a';
        ctx.fillText('+' + diff, 0, 0);
        ctx.restore();
      }
    }
    if (lu.newSpell && t > 350 + stats.length * 110 + 200) {
      UI.drawText(ctx, lu.newSpell + 'を おぼえた！', 120, 260, '#8ff');
    }
    ctx.restore();
  },

  // Defeat animation: white blink, then the enemy shatters into flying chunks, a soul
  // drifts upward and debris scatters. Bosses blink longer and erupt in chained explosions.
  renderDeaths: function(ctx, game, now) {
    var b = game.battle;
    var cw = ctx.canvas.width, ch = ctx.canvas.height;
    for (var i = 0; i < b.enemies.length; i++) {
      var en = b.enemies[i];
      if (en.alive || en.sx === undefined) continue;
      if (!en.deathStart) {
        en.deathStart = now;
        // Show the EXP this enemy is worth (bosses give none), floating up from where it fell
        if (en.exp > 0) {
          if (!b.pops) b.pops = [];
          b.pops.push({
            target: en, isParty: false, kind: 'exp', text: 'EXP +' + en.exp,
            fixed: { x: en.sx, y: en.sfoot - 22 * en.sscale - 70 * en.sscale },
            t0: now + 350
          });
        }
        if (en.boss) this.shake(game, 10, 900);
      }
      var boss = !!en.boss;
      var blinkEnd = boss ? 1300 : 200;          // white blinking before it breaks apart
      var shatterDur = boss ? 900 : 750;
      var dur = blinkEnd + shatterDur;
      var t = now - en.deathStart;
      if (t >= dur) continue;
      var sc = en.sscale, ex = en.sx, foot = en.sfoot, cy = foot - 22 * sc;
      var k, rnd;
      var seed = i * 37;

      // ---- Phase 1: blinking, boss gets chained explosions ----
      if (t < blinkEnd) {
        ctx.save();
        if (Math.floor(t / (boss ? 70 : 55)) % 2 === 0) ctx.filter = 'brightness(6)';
        ctx.translate(Math.sin(t / 25) * (boss ? 4 : 2), 0);   // trembling
        UI.drawEnemy(ctx, en, ex, cy, sc);
        ctx.restore();
        if (boss) {
          var bursts = [450, 650, 850, 1050, 1200];
          if (!en.burstDone) en.burstDone = {};
          for (k = 0; k < bursts.length; k++) {
            var bt = t - bursts[k];
            if (bt < 0) continue;
            if (!en.burstDone[k]) { en.burstDone[k] = true; this.shake(game, 7, 220); }
            if (bt < 380) {
              var bp = bt / 380;
              var bx = ex + (this.fxRnd(k + 70 + seed) - 0.5) * 90 * sc;
              var by = cy + (this.fxRnd(k + 80 + seed) - 0.5) * 70 * sc;
              var bg = ctx.createRadialGradient(bx, by, 2, bx, by, (24 + bp * 34) * sc);
              bg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1 - bp)) + ')');
              bg.addColorStop(0.5, 'rgba(255,150,40,' + (0.7 * (1 - bp)) + ')');
              bg.addColorStop(1, 'rgba(255,60,0,0)');
              ctx.fillStyle = bg;
              ctx.fillRect(bx - 70 * sc, by - 70 * sc, 140 * sc, 140 * sc);
            }
          }
        }
        continue;
      }

      // ---- Phase 2: shatter ----
      var st = t - blinkEnd;                 // ms since the break
      var q = st / shatterDur;               // 0..1
      var COLS = boss ? 9 : 7, ROWS = 3;
      var halfW = 46 * sc, top = cy - 62 * sc, rowH = 104 * sc / ROWS;
      var colW = halfW * 2 / COLS;
      for (var r = 0; r < ROWS; r++) {
        for (var c = 0; c < COLS; c++) {
          var cid = r * COLS + c;
          var dirx = (c - (COLS - 1) / 2) / ((COLS - 1) / 2);
          rnd = this.fxRnd(cid + 200 + seed);
          var vx = (dirx * 70 + (rnd - 0.5) * 30) * sc;
          var vy = -(30 + this.fxRnd(cid + 300 + seed) * 70 - r * 12) * sc;
          var ox = vx * q * 1.2;
          var oy = vy * q + 130 * sc * q * q;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - Math.pow(q, 1.6));
          ctx.translate(ox, oy);
          ctx.beginPath();
          ctx.rect(ex - halfW + c * colW, top + r * rowH, colW + 0.5, rowH + 0.5);
          ctx.clip();
          if (q < 0.25) ctx.filter = 'brightness(' + (1 + (1 - q / 0.25) * 3) + ')';
          UI.drawEnemy(ctx, en, ex, cy, sc);
          ctx.restore();
        }
      }

      // Burst flash and ground ring at the moment it breaks
      if (st < 260) {
        var fp = st / 260;
        var fg = ctx.createRadialGradient(ex, cy, 2, ex, cy, (boss ? 130 : 70) * sc * (0.6 + fp));
        fg.addColorStop(0, 'rgba(255,255,255,' + (0.85 * (1 - fp)) + ')');
        fg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(ex - 140 * sc, cy - 140 * sc, 280 * sc, 280 * sc);
      }
      if (st < 450) {
        var rp = st / 450;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - rp)) + ')';
        ctx.lineWidth = 3 * (1 - rp) + 1;
        ctx.beginPath();
        ctx.ellipse(ex, foot + 2, (14 + rp * (boss ? 200 : 70)) * sc, (4 + rp * (boss ? 34 : 12)) * sc, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (boss && st < 300) {      // full-screen whiteout when the boss breaks
        ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - st / 300)) + ')';
        ctx.fillRect(-20, -20, cw + 40, ch + 40);
      }

      // Debris: coloured chunks and white sparks fly out and fall with gravity
      ctx.save();
      var n = boss ? 60 : 24;
      for (k = 0; k < n; k++) {
        var ang = this.fxRnd(k + 400 + seed) * Math.PI * 2;
        var spd = (40 + this.fxRnd(k + 500 + seed) * 90) * sc;
        var px = ex + Math.cos(ang) * spd * q * 1.3;
        var py = cy + Math.sin(ang) * spd * q * 0.9 + 90 * sc * q * q;
        var sz = (boss ? 7 : 5) * (1 - q * 0.7) * (0.6 + this.fxRnd(k + 600 + seed) * 0.8);
        ctx.globalAlpha = Math.max(0, 1 - q);
        ctx.fillStyle = k % 4 === 0 ? '#ffffff' : en.color;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.restore();

      // Soul: a pale orb drifts upward and fades
      if (st > 80) {
        var ot = (st - 80) / (shatterDur - 80 + 400);
        if (ot < 1) {
          var ox2 = ex + Math.sin(ot * 6) * 8 * sc;
          var oy2 = cy - ot * 80 * sc;
          var oa = Math.sin(Math.PI * Math.min(1, ot * 1.1));
          var og = ctx.createRadialGradient(ox2, oy2, 1, ox2, oy2, (boss ? 22 : 13) * sc);
          og.addColorStop(0, 'rgba(255,255,255,' + oa + ')');
          og.addColorStop(0.5, 'rgba(200,230,255,' + (0.6 * oa) + ')');
          og.addColorStop(1, 'rgba(200,230,255,0)');
          ctx.fillStyle = og;
          ctx.fillRect(ox2 - 30 * sc, oy2 - 30 * sc, 60 * sc, 60 * sc);
        }
      }
    }
  },

  easeOutBounce: function(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },

  // Deterministic pseudo-random in [0,1) so particles don't flicker between frames
  fxRnd: function(i) {
    var v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  },

  // Draw the active spell effect over its target(s)
  renderEffect: function(ctx, game, w, h, now) {
    var b = game.battle;
    if (b && b.limitCut) { if (now - b.limitCut.t0 >= b.limitCut.dur) b.limitCut = null; else this.renderLimitCut(ctx, b.limitCut, w, h, now); }
    if (b && b.partyCast) this.renderPartyCast(ctx, game, w, h, now);
    if (b && b.pAtk) this.renderPartyAttack(ctx, game, w, h, now);
    if (b && b.itemFx) this.renderItemFx(ctx, game, w, h, now);
    if (b) this.renderGuard(ctx, game, w, h, now);
    if (b) this.renderStun(ctx, game, now);
    if (b) this.renderSleep(ctx, game, now);
    if (b) this.renderBossFx(ctx, game, w, h, now);
    if (b) this.renderDebuff(ctx, game, now);
    if (b) this.renderPoisonCure(ctx, game, w, h, now);
    if (b && b.escapeFail) this.renderEscapeFail(ctx, game, w, h, now);
    var fx = b && b.effect;
    if (!fx) return;
    var p = (now - fx.t0) / fx.dur;
    if (p >= 1) { b.effect = null; return; }
    if (p < 0) return;   // still charging up

    var pts = [];
    if (fx.side === 'enemy') {
      for (var i = 0; i < b.enemies.length; i++) {
        var en = b.enemies[i];
        if ((fx.idx === -1 || fx.idx === i) && en.sx !== undefined) pts.push({ x: en.sx, y: en.sy });
      }
    } else {
      for (var k = 0; k < game.party.length; k++) {
        if (fx.idx === -1 || fx.idx === k) pts.push({ x: w - 150, y: h - 178 + k * 36 });
      }
    }
    for (var n = 0; n < pts.length; n++) {
      this.drawFx(ctx, fx.kind, pts[n].x, pts[n].y, p, n * 50);
      this.drawFxImpact(ctx, fx.kind, pts[n].x, pts[n].y, p, n * 50, fx.side === 'enemy');
    }

    // Full-screen flashes for the big spells
    var flash = 0, tint = '255,255,255';
    if (fx.kind === 'thunder') { flash = Math.max(0, 0.6 - p * 2.2); tint = '220,230,255'; }
    else if (fx.kind === 'holy') { flash = Math.sin(Math.PI * p) * 0.35; tint = '255,245,190'; }
    else if (fx.kind === 'ice') { flash = Math.max(0, 0.3 - p); tint = '170,220,255'; }
    else if (fx.kind === 'dark') { flash = Math.sin(Math.PI * p) * 0.4; tint = '40,0,60'; }
    if (flash > 0) {
      ctx.fillStyle = 'rgba(' + tint + ',' + flash + ')';
      ctx.fillRect(-10, -10, w + 20, h + 20);
    }
  },

  // Limit skill cut-in: the screen dims, a dark band sweeps across with the member's name and the skill's name
  renderLimitCut: function(ctx, lc, w, h, now) {
    var t = (now - lc.t0) / lc.dur;
    if (t < 0 || t >= 1) return;
    var inT = Math.min(1, t / 0.22), outT = t > 0.82 ? (t - 0.82) / 0.18 : 0;
    var ease = 1 - Math.pow(1 - inT, 3);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,20,' + (0.5 * Math.min(1, t * 6) * (1 - outT)) + ')';
    ctx.fillRect(0, 0, w, h);
    var cy = 112, bh = 70, off = (1 - ease) * -w + outT * w;
    var g = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
    g.addColorStop(0, 'rgba(10,20,70,0.95)'); g.addColorStop(0.5, 'rgba(30,60,140,0.95)'); g.addColorStop(1, 'rgba(10,20,70,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(off, cy - bh / 2, w, bh);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(off, cy - bh / 2 - 3, w, 3);
    ctx.fillRect(off, cy + bh / 2, w, 3);
    for (var i = 0; i < 9; i++) {                       // speed lines streaking through the band
      var lx = ((now / 3 + i * 97) % (w + 120)) - 60, ly = cy - bh / 2 + 6 + (i * 13) % (bh - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(lx + off, ly, 60 + (i % 3) * 30, 2);
    }
    ctx.textBaseline = 'middle';
    ctx.font = '14px monospace';
    ctx.fillStyle = '#9bd';
    ctx.fillText(lc.who + 'の ひっさつわざ', 40 + off, cy - 20);
    ctx.font = 'bold 34px monospace';
    ctx.lineWidth = 5; ctx.strokeStyle = '#1a2a6a';
    ctx.strokeText(lc.name, 40 + off, cy + 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(lc.name, 40 + off, cy + 8);
    ctx.restore();
  },

  // Party casting: rune circle at the caster's feet, motes spiralling in, then an orb/bolt flies to the target
  renderPartyCast: function(ctx, game, w, h, now) {
    var b = game.battle;
    var pc = b.partyCast;
    var t = (now - pc.t0) / pc.dur;
    if (t >= 1.05) { b.partyCast = null; return; }
    if (t < 0) return;
    var self = this;
    var rgb = this.PARTY_CAST_TINT[pc.kind] || '255,255,255';
    var cx = w - 250 + pc.idx * 48, cy = h - 238;   // party sprites live in the status window, so the spell gathers just above it
    var charge = Math.min(1, t / 0.7);      // gathering phase
    var fire = t > 0.7 ? Math.min(1, (t - 0.7) / 0.3) : 0;   // release phase
    var i, a, px, py;
    ctx.save();

    // Rune circle on the floor
    ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, t)) * 0.9;
    ctx.strokeStyle = 'rgb(' + rgb + ')';
    ctx.shadowColor = 'rgb(' + rgb + ')';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    var rr = 16 + charge * 16;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 26, rr * 1.5, rr * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 26, rr * 0.9, rr * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (i = 0; i < 6; i++) {
      a = now / 260 + i * Math.PI / 3;
      ctx.fillStyle = 'rgb(' + rgb + ')';
      ctx.fillRect(cx + Math.cos(a) * rr * 1.5 - 2, cy + 26 + Math.sin(a) * rr * 0.5 - 2, 4, 4);
    }

    // Aura column rising around the caster
    var ag = ctx.createLinearGradient(0, cy - 50, 0, cy + 28);
    ag.addColorStop(0, 'rgba(' + rgb + ',0)');
    ag.addColorStop(1, 'rgba(' + rgb + ',' + (0.35 * charge) + ')');
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = ag;
    ctx.fillRect(cx - 20, cy - 50, 40, 78);

    // Motes pulled inward
    for (i = 0; i < 14; i++) {
      var ph = (charge * 1.6 + self.fxRnd(i + 3)) % 1;
      var ang = self.fxRnd(i) * Math.PI * 2 + ph * 2;
      var dist = (1 - ph) * 52;
      px = cx + Math.cos(ang) * dist;
      py = cy - 6 + Math.sin(ang) * dist * 0.7;
      ctx.globalAlpha = Math.sin(Math.PI * ph) * 0.9;
      ctx.fillStyle = i % 2 ? 'rgb(' + rgb + ')' : '#fff';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }

    // Gathering orb above the hand
    var orbR = 3 + charge * 9 + Math.sin(now / 40) * 1.2;
    var hx = cx, hy = cy - 6;
    if (fire === 0 || pc.kind === 'holy' || pc.kind === 'thunder' || pc.kind === 'buffAtk' || pc.kind === 'buffDef' || pc.kind === 'buffInt' || pc.kind === 'sleep') {
      var og = ctx.createRadialGradient(hx, hy, 0, hx, hy, orbR * 2.4);
      og.addColorStop(0, 'rgba(255,255,255,0.95)');
      og.addColorStop(0.35, 'rgba(' + rgb + ',0.8)');
      og.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.globalAlpha = 1 - fire * 0.7;
      ctx.fillStyle = og;
      ctx.fillRect(hx - orbR * 2.4, hy - orbR * 2.4, orbR * 4.8, orbR * 4.8);
    }

    // Release: projectile travelling to each target
    if (fire > 0 && (pc.kind === 'fire' || pc.kind === 'ice' || pc.kind === 'heal' || pc.kind === 'thunder' || pc.kind === 'debuffAtk' || pc.kind === 'debuffDef')) {
      var tpts = [];
      if (pc.side === 'enemy') {
        for (var e = 0; e < b.enemies.length; e++) {
          if ((pc.targetIdx === -1 || pc.targetIdx === e) && b.enemies[e].sx !== undefined) tpts.push({ x: b.enemies[e].sx, y: b.enemies[e].sy });
        }
      } else {
        for (var q = 0; q < game.party.length; q++) {
          if (pc.targetIdx === -1 || pc.targetIdx === q) tpts.push({ x: w - 150, y: h - 178 + q * 36 });
        }
      }
      var ease = fire * fire;
      for (var n = 0; n < tpts.length; n++) {
        if (pc.kind === 'thunder') {
          // sky crackle gathering above the target
          ctx.globalAlpha = fire * 0.8;
          ctx.strokeStyle = '#dfe9ff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          var zx = tpts[n].x, zy = tpts[n].y - 190;
          ctx.moveTo(zx - 30, zy);
          for (i = 1; i <= 5; i++) ctx.lineTo(zx - 30 + i * 12, zy + (i % 2 ? -10 : 8));
          ctx.stroke();
          continue;
        }
        var ox = hx + (tpts[n].x - hx) * ease;
        var oy = hy + (tpts[n].y - hy) * ease - Math.sin(Math.PI * ease) * 36;
        // trail
        for (i = 0; i < 9; i++) {
          var te = Math.max(0, ease - i * 0.05);
          var tx2 = hx + (tpts[n].x - hx) * te;
          var ty2 = hy + (tpts[n].y - hy) * te - Math.sin(Math.PI * te) * 36;
          ctx.globalAlpha = (1 - i / 9) * 0.7;
          ctx.fillStyle = pc.kind === 'fire' ? (i % 2 ? '#ffb030' : '#ff5a1c') : (pc.kind === 'ice' ? '#bfe9ff' : (pc.kind === 'debuffAtk' ? (i % 2 ? '#ff4f9a' : '#6a1040') : (pc.kind === 'debuffDef' ? (i % 2 ? '#8a70ff' : '#2a1a6a') : '#c8ffd8')));
          ctx.beginPath();
          ctx.arc(tx2, ty2, (9 - i) * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ox, oy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  // Boss-only overlays: form-change shockwave, charge warning, the released blast, victory whiteout
  renderBossFx: function(ctx, game, w, h, now) {
    var b = game.battle, i;
    // ---- Form change: white flash, expanding shock rings and a tinted vignette
    var pf = b.bossPhaseFx;
    if (pf) {
      var pt = now - pf.t0, PD = 1300;
      if (pt >= PD) { b.bossPhaseFx = null; }
      else {
        var en = b.enemies[pf.idx], cx = en && en.sx !== undefined ? en.sx : w / 2, cy = en && en.sy !== undefined ? en.sy : h * 0.4;
        var rgb = pf.phase === 1 ? '190,30,140' : '255,110,40';
        ctx.save();
        if (pt < 160) { ctx.fillStyle = 'rgba(255,255,255,' + 0.7 * (1 - pt / 160) + ')'; ctx.fillRect(0, 0, w, h); }
        var vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
        vg.addColorStop(0, 'rgba(' + rgb + ',0)');
        vg.addColorStop(1, 'rgba(' + rgb + ',' + 0.45 * Math.sin(Math.min(1, pt / PD) * Math.PI) + ')');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
        for (var ri = 0; ri < 3; ri++) {
          var rq = (pt - ri * 180) / 800;
          if (rq <= 0 || rq >= 1) continue;
          ctx.globalAlpha = (1 - rq) * 0.8;
          ctx.strokeStyle = 'rgb(' + rgb + ')'; ctx.lineWidth = 6 * (1 - rq) + 1;
          ctx.beginPath(); ctx.ellipse(cx, cy, 30 + rq * 330, 12 + rq * 130, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgb(' + rgb + ')';       // shards of darkness burst upward
        for (var sk = 0; sk < 26; sk++) {
          var sq = Math.min(1, pt / 900), sa = this.fxRnd(sk + 800) * Math.PI * 2, sr = (30 + this.fxRnd(sk + 830) * 170) * sq;
          ctx.globalAlpha = 1 - sq;
          ctx.fillRect(cx + Math.cos(sa) * sr - 2, cy + Math.sin(sa) * sr * 0.8 - sq * 50 - 2, 4, 4);
        }
        ctx.restore();
      }
    }
    // ---- Warning while a boss is storing an attack: pulsing red edges + banner
    var storing = false, storingSkill = 'enemyDark';
    for (i = 0; i < b.enemies.length; i++) if (b.enemies[i].boss && b.enemies[i].alive && b.enemies[i].charging) { storing = true; storingSkill = b.enemies[i].bigSkill; }
    if (storing && b.phase !== 'win' && b.phase !== 'lose' && b.phase !== 'levelup') {
      var wp = 0.5 + 0.5 * Math.sin(now / 160);
      ctx.save();
      var eg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.8);
      eg.addColorStop(0, 'rgba(160,0,40,0)');
      eg.addColorStop(1, 'rgba(160,0,40,' + (0.25 + 0.3 * wp) + ')');
      ctx.fillStyle = eg; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.55 + 0.45 * wp;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px monospace';
      ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a0010'; ctx.fillStyle = '#ff6a8a';
      var wtxt = '▲ ' + (SPELLS[storingSkill] ? SPELLS[storingSkill].name : '暗黒の波動') + 'の 予兆 ▲  ぼうぎょで 備えよ';
      ctx.strokeText(wtxt, w / 2, 40); ctx.fillText(wtxt, w / 2, 40);
      ctx.restore();
    }
    // ---- Released blast: a white-red flash with rays from the boss
    var cb = b.chargedBlast;
    if (cb) {
      var bt = now - cb.t0;
      if (bt > 700) { b.chargedBlast = null; }
      else if (bt >= 0) {
        var ba = 1 - bt / 700;
        ctx.save();
        ctx.fillStyle = 'rgba(255,230,230,' + 0.75 * ba + ')'; ctx.fillRect(0, 0, w, h);
        ctx.translate(w / 2, h * 0.38);
        ctx.fillStyle = 'rgba(255,60,90,' + 0.5 * ba + ')';
        for (var ry = 0; ry < 12; ry++) {
          ctx.save(); ctx.rotate(ry / 12 * Math.PI * 2 + bt / 900);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, -14 - bt / 25); ctx.lineTo(w, 14 + bt / 25); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        ctx.restore();
      }
    }
  },

  // Boss defeated: everything (windows included) whitens and a line fades in before the ending
  renderBossVictory: function(ctx, game, w, h, now) {
    var b = game.battle;
    if (!b || !b.bossWin || !b.winStart) return;
    var wt = now - b.winStart;
    if (wt <= 2800) return;
    var wa = Math.min(1, (wt - 2800) / 1600);
    ctx.save();
    ctx.fillStyle = 'rgba(255,252,235,' + wa + ')'; ctx.fillRect(0, 0, w, h);
    if (wt > 3600) {
      ctx.globalAlpha = Math.min(1, (wt - 3600) / 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '20px monospace'; ctx.fillStyle = '#8a6a20';
      ctx.fillText('…そして 世界に 朝が おとずれた', w / 2, h / 2);
    }
    ctx.restore();
  },

  // Sleep: slow floating Z's over every sleeping enemy for as long as it sleeps, with a soft blue haze
  renderSleep: function(ctx, game, now) {
    var b = game.battle;
    for (var i = 0; i < b.enemies.length; i++) {
      var en = b.enemies[i];
      if (!en.alive || !(en.sleepTurns > 0) || en.sx === undefined) continue;
      var sc = en.sscale || 1, x = en.sx, y = en.sy, headY = en.sfoot - 92 * sc;
      var on = en.sleepAt ? now - en.sleepAt : 9999;
      if (on < 0) continue;
      ctx.save();
      var hg = ctx.createRadialGradient(x, y, 4, x, y, 52 * sc);
      hg.addColorStop(0, 'rgba(120,110,255,' + (0.22 * Math.min(1, on / 300)) + ')'); hg.addColorStop(1, 'rgba(120,110,255,0)');
      ctx.fillStyle = hg; ctx.fillRect(x - 56 * sc, y - 56 * sc, 112 * sc, 112 * sc);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (var k = 0; k < 3; k++) {
        var q = ((now / 1700) + k / 3) % 1;
        ctx.globalAlpha = Math.sin(Math.PI * q) * 0.95;
        ctx.font = 'bold ' + Math.round((10 + q * 10) * Math.max(0.8, sc)) + 'px monospace';
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a1050'; ctx.fillStyle = '#cfd0ff';
        var zx = x + 14 * sc + q * 22 + k * 3, zy = headY - q * 30;
        ctx.strokeText('Z', zx, zy); ctx.fillText('Z', zx, zy);
      }
      ctx.restore();
    }
  },

  // Stun: yellow shock ring, crackling arcs over the body, dizzy stars circling the head, "スタン！" label
  renderStun: function(ctx, game, now) {
    var b = game.battle;
    var i, k;
    for (i = 0; i < b.enemies.length; i++) {
      var en = b.enemies[i];
      if (!en.alive || !en.stunAt || en.sx === undefined) continue;
      var t = now - en.stunAt;
      if (t < 0) continue;
      if (t >= 2000) { en.stunAt = 0; continue; }
      var sc = en.sscale || 1;
      var x = en.sx, y = en.sy, headY = en.sfoot - 92 * sc;
      ctx.save();
      // Onset ring and flash
      if (t < 350) {
        var rp = t / 350;
        ctx.globalAlpha = (1 - rp) * 0.9;
        ctx.strokeStyle = '#ffe94a';
        ctx.lineWidth = 5 * (1 - rp) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y + 18 * sc, (12 + rp * 70) * sc, (4 + rp * 18) * sc, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,250,170,' + (0.5 * (1 - rp)) + ')';
        ctx.beginPath();
        ctx.ellipse(x, y, 34 * sc, 44 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Shock arcs over the body (re-randomised ~20 times a second so they crackle)
      if (t < 1100) {
        var seed = Math.floor(t / 50);
        ctx.globalAlpha = 1 - t / 1100;
        ctx.strokeStyle = '#fff6a0';
        ctx.shadowColor = '#ffd800';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        for (k = 0; k < 3; k++) {
          var ax = x + (this.fxRnd(seed * 3 + k) - 0.5) * 60 * sc;
          var ay = y - 40 * sc + this.fxRnd(seed * 3 + k + 40) * 70 * sc;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          for (var z = 1; z <= 4; z++) {
            ctx.lineTo(ax + (this.fxRnd(seed * 7 + k * 5 + z) - 0.5) * 26 * sc, ay + z * 9 * sc);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
      // Dizzy stars orbiting the head
      var starA = Math.min(1, (2000 - t) / 500) * Math.min(1, t / 150);
      for (k = 0; k < 3; k++) {
        var ang = t / 220 + k * Math.PI * 2 / 3;
        var sx = x + Math.cos(ang) * 26 * sc, sy = headY + Math.sin(ang) * 7 * sc;
        ctx.globalAlpha = starA * (Math.sin(ang) > 0 ? 1 : 0.55);
        ctx.fillStyle = '#ffe94a';
        ctx.beginPath();
        for (var p = 0; p < 10; p++) {
          var pr = p % 2 ? 3 : 7;
          var pa = p * Math.PI / 5 - Math.PI / 2;
          var qx = sx + Math.cos(pa) * pr, qy = sy + Math.sin(pa) * pr;
          if (p === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
        }
        ctx.closePath();
        ctx.fill();
      }
      // Label
      if (t < 1000) {
        var lp = t / 1000;
        ctx.globalAlpha = Math.min(1, t / 80) * (1 - Math.max(0, lp - 0.7) / 0.3);
        var pop = t < 150 ? 0.6 + (t / 150) * 0.6 : 1.2 - Math.min(0.2, (t - 150) / 800 * 0.2);
        ctx.translate(x, headY - 56 - lp * 16);
        ctx.scale(pop, pop);
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#4a3a00';
        ctx.fillStyle = '#fff27a';
        ctx.strokeText('スタン！', 0, 0);
        ctx.fillText('スタン！', 0, 0);
      }
      ctx.restore();
    }
  },

  // Debuff: a label pops when it lands, and afterwards a bobbing down-arrow badge and a gloomy aura
  // mark every enemy whose attack or defence is lowered
  renderDebuff: function(ctx, game, now) {
    var b = game.battle;
    var i, k;
    for (i = 0; i < b.enemies.length; i++) {
      var en = b.enemies[i];
      if (!en.alive || !en.buffs || en.sx === undefined) continue;
      var stats = [];
      if (en.buffs.atk && en.buffs.atk.mult < 1) stats.push('atk');
      if (en.buffs.def && en.buffs.def.mult < 1) stats.push('def');
      if (!stats.length) continue;
      var sc = en.sscale || 1;
      var x = en.sx, y = en.sy, footY = en.sfoot, headY = footY - 88 * sc;
      var onset = en.debuffAt ? now - en.debuffAt : 99999;
      if (onset < 0) continue;
      ctx.save();
      // gloom pooling at the feet
      var gp = 0.5 + 0.12 * Math.sin(now / 260 + i);
      var gg = ctx.createRadialGradient(x, footY, 2, x, footY, 40 * sc);
      gg.addColorStop(0, 'rgba(90,40,140,' + (0.45 * gp) + ')');
      gg.addColorStop(1, 'rgba(40,0,70,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(x - 44 * sc, footY - 20 * sc, 88 * sc, 40 * sc);
      // onset: contracting ring + shake-off
      if (onset < 450) {
        var rp = onset / 450;
        ctx.globalAlpha = 1 - rp;
        ctx.strokeStyle = en.debuffStat === 'def' ? '#8a70ff' : '#ff4f9a';
        ctx.lineWidth = 4 * (1 - rp) + 1;
        ctx.beginPath();
        ctx.ellipse(x, y, (1 - rp) * 60 * sc + 12, ((1 - rp) * 60 * sc + 12) * 1.1, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // badges above the head
      for (k = 0; k < stats.length; k++) {
        var bx = x + (k - (stats.length - 1) / 2) * 30;
        var by = headY - 6 + Math.sin(now / 240 + k * 2 + i) * 3;
        var isAtk = stats[k] === 'atk';
        var turnsLeft = en.buffs[stats[k]].turns;
        ctx.globalAlpha = Math.min(1, onset / 200) * (turnsLeft <= 1 ? 0.55 + 0.35 * Math.sin(now / 120) : 1);
        ctx.fillStyle = isAtk ? '#7a1040' : '#2a2070';
        ctx.strokeStyle = isAtk ? '#ff6fb0' : '#a99aff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 11, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = isAtk ? '#ffb0d6' : '#cfc6ff';
        ctx.beginPath();   // down arrow
        ctx.moveTo(bx - 3, by - 6); ctx.lineTo(bx + 3, by - 6); ctx.lineTo(bx + 3, by); ctx.lineTo(bx + 7, by);
        ctx.lineTo(bx, by + 8); ctx.lineTo(bx - 7, by); ctx.lineTo(bx - 3, by);
        ctx.closePath();
        ctx.fill();
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(isAtk ? '攻' : '防', bx, by - 14);
      }
      // label when it lands
      if (onset < 1100) {
        var lp = onset / 1100;
        ctx.globalAlpha = Math.min(1, onset / 80) * (1 - Math.max(0, lp - 0.7) / 0.3);
        var label = (en.debuffStat === 'def' ? 'ぼうぎょ' : 'こうげき') + 'ダウン！';
        ctx.font = 'bold 18px monospace';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#1a0a2a';
        ctx.fillStyle = en.debuffStat === 'def' ? '#cfc6ff' : '#ffb0d6';
        ctx.strokeText(label, x, headY - 40 - lp * 10);
        ctx.fillText(label, x, headY - 40 - lp * 10);
      }
      ctx.restore();
    }
  },

  // Party poison: purple bubbles seep up around a poisoned member; on cure they burst in a green-white cleansing wave
  renderPoisonCure: function(ctx, game, w, h, now) {
    var b = game.battle;
    var self = this;
    var i, k;
    var spot = function(idx) { return { x: w - 250 + idx * 48, y: h - 238 }; };
    ctx.save();
    // Lingering poison
    for (i = 0; i < game.party.length; i++) {
      var m = game.party[i];
      if (!m.alive || !m.poisoned) continue;
      var sp = spot(i);
      var onset = m.poisonAt ? now - m.poisonAt : 99999;
      if (onset < 0) continue;
      var pg = ctx.createRadialGradient(sp.x, sp.y + 8, 2, sp.x, sp.y + 8, 30);
      pg.addColorStop(0, 'rgba(150,50,210,' + (0.35 + 0.1 * Math.sin(now / 240 + i)) + ')');
      pg.addColorStop(1, 'rgba(80,0,120,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(sp.x - 32, sp.y - 22, 64, 60);
      for (k = 0; k < 6; k++) {
        var ph = ((now / 1100) + self.fxRnd(k + i * 9)) % 1;
        ctx.globalAlpha = Math.sin(Math.PI * ph) * 0.85;
        ctx.fillStyle = k % 2 ? '#b050f0' : '#7a28c0';
        ctx.beginPath();
        ctx.arc(sp.x + (self.fxRnd(k + 30 + i) - 0.5) * 34 + Math.sin(now / 300 + k) * 3, sp.y + 24 - ph * 46, 2 + self.fxRnd(k + 60) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // skull-less badge: droplet with a "毒"
      ctx.fillStyle = '#5a1a8a';
      ctx.strokeStyle = '#d08aff';
      ctx.lineWidth = 2;
      var bx = sp.x + 20, by = sp.y - 22 + Math.sin(now / 260 + i) * 2;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f0d0ff';
      ctx.fillText('毒', bx, by + 4);
      // onset splash
      if (onset < 500) {
        var op = onset / 500;
        ctx.globalAlpha = 1 - op;
        ctx.strokeStyle = '#b050f0';
        ctx.lineWidth = 4 * (1 - op) + 1;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y + 22, 10 + op * 40, 4 + op * 12, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Cure burst
    var c = b.cureFx;
    if (c) {
      var t = (now - c.t0) / c.dur;
      if (t >= 1) b.cureFx = null;
      else if (t >= 0) {
        var cp = spot(c.idx);
        // purple bubbles popping off, flying outward and fading
        for (k = 0; k < 10; k++) {
          var a = self.fxRnd(k + 5) * Math.PI * 2, d = (10 + t * 60) * (0.5 + self.fxRnd(k + 15));
          ctx.globalAlpha = Math.max(0, 1 - t * 1.6);
          ctx.fillStyle = k % 2 ? '#b050f0' : '#7a28c0';
          ctx.beginPath();
          ctx.arc(cp.x + Math.cos(a) * d, cp.y + 8 + Math.sin(a) * d * 0.7 - t * 20, 4 * (1 - t) + 1, 0, Math.PI * 2);
          ctx.fill();
        }
        // cleansing wave: expanding green-white ring and rising light column
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = '#d8ffe8';
        ctx.shadowColor = '#6dffb0';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath();
        ctx.ellipse(cp.x, cp.y + 22, 10 + t * 64, 4 + t * 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        var lg = ctx.createLinearGradient(cp.x - 16, 0, cp.x + 16, 0);
        lg.addColorStop(0, 'rgba(160,255,200,0)');
        lg.addColorStop(0.5, 'rgba(230,255,240,' + (0.7 * Math.sin(Math.PI * Math.min(1, t * 1.3))) + ')');
        lg.addColorStop(1, 'rgba(160,255,200,0)');
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = lg;
        ctx.fillRect(cp.x - 16, cp.y - 60, 32, 90);
        // sparkles
        for (k = 0; k < 8; k++) {
          var sx = cp.x + (self.fxRnd(k + 50) - 0.5) * 50, sy = cp.y + 20 - t * (30 + self.fxRnd(k + 70) * 50);
          var tw = 2 + Math.abs(Math.sin(t * 14 + k)) * 4;
          ctx.globalAlpha = Math.sin(Math.PI * t);
          ctx.fillStyle = '#eafff2';
          ctx.fillRect(sx - tw, sy - 0.75, tw * 2, 1.5);
          ctx.fillRect(sx - 0.75, sy - tw, 1.5, tw * 2);
        }
        // label
        ctx.globalAlpha = Math.min(1, t * 8) * (1 - Math.max(0, t - 0.65) / 0.35);
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0a3a20';
        ctx.fillStyle = '#c8ffdc';
        ctx.strokeText('どくが きえた！', cp.x, cp.y - 52 - t * 14);
        ctx.fillText('どくが きえた！', cp.x, cp.y - 52 - t * 14);
      }
    }
    ctx.restore();
  },

  // Guarding: a shield materialises around the member (burst), stays as a faint barrier badge for the
  // rest of the turn, and flares with sparks and a ring when an enemy attack is blocked
  renderGuard: function(ctx, game, w, h, now) {
    var b = game.battle;
    var self = this;
    var i, k;
    var spot = function(idx) { return { x: w - 250 + idx * 48, y: h - 238 }; };
    var shield = function(x, y, sc, alpha, glow) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(sc, sc);
      ctx.shadowColor = 'rgba(120,200,255,1)';
      ctx.shadowBlur = glow;
      ctx.fillStyle = '#5a8fe0';
      ctx.strokeStyle = '#e6f4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(11, -9); ctx.lineTo(10, 3); ctx.lineTo(0, 14); ctx.lineTo(-10, 3); ctx.lineTo(-11, -9);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-2, -9, 4, 18);
      ctx.fillRect(-7, -3, 14, 4);
      ctx.restore();
    };
    ctx.save();

    // Persistent badge on every member who is braced
    for (i = 0; i < game.party.length; i++) {
      if (!game.party[i].alive || !game.party[i].defending) continue;
      var sp = spot(i);
      var gf = b.guardFx && b.guardFx.idx === i ? Math.min(1, (now - b.guardFx.t0) / b.guardFx.dur) : 1;
      if (gf < 0.35) continue;   // the burst below covers the start
      var pulse = 0.55 + 0.15 * Math.sin(now / 220 + i);
      ctx.globalAlpha = pulse * 0.5;
      ctx.strokeStyle = '#9fd4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y + 26, 26, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      shield(sp.x, sp.y - 6, 0.8, pulse + 0.2, 8);
    }

    // Guard burst
    var g = b.guardFx;
    if (g) {
      var t = (now - g.t0) / g.dur;
      if (t >= 1) { b.guardFx = null; }
      else if (t >= 0) {
        var gp = spot(g.idx);
        var rise = Math.min(1, t / 0.35);
        // hexagonal barrier expanding then settling
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = '#bfe6ff';
        ctx.shadowColor = '#6ab8ff';
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        var hr = 14 + rise * 22;
        ctx.beginPath();
        for (k = 0; k < 6; k++) {
          var ha = Math.PI / 6 + k * Math.PI / 3;
          var hx = gp.x + Math.cos(ha) * hr, hy = gp.y - 4 + Math.sin(ha) * hr * 0.9;
          if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        // floor ripple
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.beginPath();
        ctx.ellipse(gp.x, gp.y + 26, 10 + t * 50, 4 + t * 14, 0, 0, Math.PI * 2);
        ctx.stroke();
        // shield pops in with an overshoot
        var sc = t < 0.35 ? 0.3 + rise * 1.1 : 1.4 - Math.min(1, (t - 0.35) / 0.3) * 0.6;
        shield(gp.x, gp.y - 6, sc, Math.min(1, 1.4 - t), 14);
        // sparkles
        ctx.shadowBlur = 0;
        for (k = 0; k < 8; k++) {
          var sa = self.fxRnd(k + 3) * Math.PI * 2, sd = 14 + t * 40 * (0.5 + self.fxRnd(k + 9));
          ctx.globalAlpha = (1 - t);
          ctx.fillStyle = k % 2 ? '#fff' : '#9fd4ff';
          ctx.fillRect(gp.x + Math.cos(sa) * sd - 1.5, gp.y - 4 + Math.sin(sa) * sd * 0.8 - 1.5, 3, 3);
        }
      }
    }

    // Blocked hit
    var gb = b.guardBlock;
    if (gb) {
      var bt = (now - gb.t0) / gb.dur;
      if (bt >= 1) { b.guardBlock = null; }
      else if (bt >= 0) {
        var bp = spot(gb.idx);
        var sc2 = gb.heavy ? 1.3 : 1;
        // white flare over the shield
        if (bt < 0.25) {
          ctx.globalAlpha = (1 - bt / 0.25) * 0.9;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(bp.x, bp.y - 4, (10 + bt * 80) * sc2, 0, Math.PI * 2);
          ctx.fill();
        }
        shield(bp.x + (bt < 0.2 ? -4 * (1 - bt / 0.2) : 0), bp.y - 6, 1.2 * sc2 - bt * 0.3, 1 - Math.max(0, bt - 0.6) / 0.4, 16);
        ctx.strokeStyle = '#cfeaff';
        ctx.lineWidth = 4 * (1 - bt) + 1;
        ctx.globalAlpha = 1 - bt;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y - 4, (12 + bt * 46) * sc2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        for (k = 0; k < 12; k++) {
          var ba = self.fxRnd(k + 21) * Math.PI * 2, bd = (18 + self.fxRnd(k + 50) * 46) * Math.min(1, bt * 1.6) * sc2;
          ctx.globalAlpha = Math.max(0, 1 - bt * 1.4);
          ctx.fillStyle = k % 2 ? '#fff' : '#9fd4ff';
          ctx.fillRect(bp.x + Math.cos(ba) * bd - 1.5, bp.y - 4 + Math.sin(ba) * bd * 0.8 - 1.5, 3, 3);
        }
        // "GUARD" label
        ctx.globalAlpha = Math.min(1, bt * 8) * (1 - Math.max(0, bt - 0.7) / 0.3);
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0a1a40';
        ctx.fillStyle = '#bfe6ff';
        ctx.strokeText('ガード！', bp.x, bp.y - 44 - bt * 14);
        ctx.fillText('ガード！', bp.x, bp.y - 44 - bt * 14);
      }
    }
    ctx.restore();
  },

  // Item use: the item arcs from the user to its target, then a per-item effect plays
  // (herb: swirling leaves, magic water: droplets + ripples, phoenix feather: flame pillar, bomb: blast)
  renderItemFx: function(ctx, game, w, h, now) {
    var b = game.battle;
    var f = b.itemFx;
    var el = now - f.t0;
    if (el >= f.dur) { b.itemFx = null; return; }
    if (el < 0) return;
    var self = this;
    var x, y;
    if (f.side === 'enemy') {
      var en = b.enemies[f.idx];
      if (!en || en.sx === undefined) return;
      x = en.sx; y = en.sy;
    } else {
      x = w - 250 + f.idx * 48; y = h - 238;   // party sprites live in the status window: effects play just above it
    }
    var ux = w - 250 + f.from * 48, uy = h - 238;
    var COL = { antidote: '170,255,210', herb: '120,255,150', magicWater: '110,180,255', phoenix: '255,150,60', bomb: '255,170,60' }[f.id] || '255,255,255';
    var i;
    ctx.save();
    ctx.lineCap = 'round';

    if (el < f.d) {
      // Toss: item flies in an arc to the target
      var tp = el / f.d;
      var ix = ux + (x - ux) * tp;
      var iy = uy + (y - uy) * tp - Math.sin(Math.PI * tp) * (f.id === 'bomb' ? 70 : 34);
      for (i = 0; i < 6; i++) {
        var te = Math.max(0, tp - i * 0.05);
        ctx.globalAlpha = (1 - i / 6) * 0.6;
        ctx.fillStyle = 'rgb(' + COL + ')';
        ctx.beginPath();
        ctx.arc(ux + (x - ux) * te, uy + (y - uy) * te - Math.sin(Math.PI * te) * (f.id === 'bomb' ? 70 : 34), 5 - i * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (f.id === 'bomb') {
        ctx.fillStyle = '#3a3340';
        ctx.beginPath(); ctx.arc(ix, iy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe066';   // lit fuse spark
        ctx.fillRect(ix + 4 + Math.sin(now / 30) * 2, iy - 11, 4, 4);
      } else {
        ctx.shadowColor = 'rgb(' + COL + ')'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ix, iy, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return;
    }

    var p = (el - f.d) / (f.dur - f.d);
    var fade = Math.sin(Math.PI * Math.min(1, p));
    if (f.id === 'herb' || f.id === 'magicWater') {
      var herb = f.id === 'herb';
      var gl = ctx.createRadialGradient(x, y, 2, x, y, 46);
      gl.addColorStop(0, 'rgba(' + COL + ',' + (0.5 * fade) + ')');
      gl.addColorStop(1, 'rgba(' + COL + ',0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 50, y - 50, 100, 100);
      for (i = 0; i < 10; i++) {
        var ang = p * 5 + i * Math.PI * 2 / 10;
        var rad = 30 * (1 - p * 0.5);
        var px = x + Math.cos(ang) * rad, py = y + 18 - p * 55 - Math.sin(ang) * 6 + (i % 3) * 5;
        ctx.globalAlpha = fade;
        if (herb) {
          ctx.fillStyle = i % 2 ? '#7dff9a' : '#3fd36a';
          ctx.beginPath(); ctx.ellipse(px, py, 6, 3, ang, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = i % 2 ? '#bfe0ff' : '#6aa8ff';
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = fade * 0.7;
      ctx.strokeStyle = 'rgb(' + COL + ')';
      ctx.lineWidth = 2;
      for (i = 0; i < 2; i++) {
        var rq = Math.max(0, Math.min(1, p * 1.6 - i * 0.3));
        ctx.beginPath();
        ctx.ellipse(x, y + 22, 10 + rq * 36, 4 + rq * 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (f.id === 'phoenix') {
      // Fire pillar with a rising feather, then a golden flash as they come back
      var pg = ctx.createLinearGradient(0, y - 120, 0, y + 28);
      pg.addColorStop(0, 'rgba(255,220,100,0)');
      pg.addColorStop(0.5, 'rgba(255,150,50,' + (0.7 * fade) + ')');
      pg.addColorStop(1, 'rgba(255,90,20,' + (0.8 * fade) + ')');
      ctx.fillStyle = pg;
      var pw = 22 + 12 * fade;
      ctx.fillRect(x - pw, y - 120, pw * 2, 148);
      for (i = 0; i < 16; i++) {
        var ex = x + (self.fxRnd(i + 5) - 0.5) * 50;
        var ey = y + 20 - p * (40 + self.fxRnd(i + 30) * 110);
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
        ctx.fillStyle = i % 3 === 0 ? '#fff2a0' : (i % 3 === 1 ? '#ffa030' : '#ff5a1c');
        ctx.beginPath(); ctx.arc(ex, ey, 4 * (1 - p) + 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = Math.min(1, fade * 1.5);
      ctx.fillStyle = '#ffd24a';   // feather
      ctx.beginPath();
      var fy = y + 10 - p * 70;
      ctx.moveTo(x, fy - 14); ctx.lineTo(x - 6, fy + 2); ctx.lineTo(x, fy + 12); ctx.lineTo(x + 6, fy + 2);
      ctx.closePath(); ctx.fill();
      if (p > 0.55) {
        ctx.globalAlpha = Math.sin(Math.PI * (p - 0.55) / 0.45) * 0.45;
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }
    } else if (f.id === 'bomb') {
      var ex0 = Math.min(1, p / 0.35);
      if (p < 0.35) {
        ctx.globalAlpha = 1 - ex0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, 14 + ex0 * 46, 0, Math.PI * 2); ctx.fill();
      }
      var bg = ctx.createRadialGradient(x, y, 4, x, y, 30 + p * 50);
      bg.addColorStop(0, 'rgba(255,230,120,' + (0.9 * (1 - p)) + ')');
      bg.addColorStop(0.5, 'rgba(255,110,20,' + (0.7 * (1 - p)) + ')');
      bg.addColorStop(1, 'rgba(120,20,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = bg;
      ctx.fillRect(x - 90, y - 90, 180, 180);
      ctx.strokeStyle = 'rgba(255,200,120,' + (1 - p) + ')';
      ctx.lineWidth = 5 * (1 - p) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 18, 10 + p * 110, 4 + p * 34, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (i = 0; i < 14; i++) {
        var ba = self.fxRnd(i + 11) * Math.PI * 2, bs = 30 + self.fxRnd(i + 40) * 70;
        var dd = Math.min(1, p * 1.5);
        ctx.globalAlpha = Math.max(0, 1 - dd);
        ctx.fillStyle = i % 2 ? '#5a4a40' : '#ffb030';
        ctx.fillRect(x + Math.cos(ba) * bs * dd - 2, y + Math.sin(ba) * bs * dd * 0.8 + 34 * dd * dd - 2, 4, 4);
      }
      // smoke puff
      ctx.globalAlpha = Math.max(0, 0.5 - p * 0.5);
      ctx.fillStyle = '#3a3340';
      ctx.beginPath(); ctx.arc(x, y - 20 - p * 40, 18 + p * 22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  // Party basic attack: speed lines in, then a weapon-specific strike (Sam: crossed blade slashes,
  // Dario: arcane staff burst, Sundar: holy mace thump) with shockwave and sparks
  renderPartyAttack: function(ctx, game, w, h, now) {
    var b = game.battle;
    var pa = b.pAtk;
    var en = b.enemies[pa.idx];
    var el = now - pa.t0;
    if (el >= pa.dur) { b.pAtk = null; return; }
    if (!en || en.sx === undefined || el < 0) return;
    var x = en.sx, y = en.sy;
    var self = this;
    var col = pa.who === 'Dario' ? '190,120,255' : (pa.who === 'Sundar' ? '255,235,150' : '170,220,255');
    var i;
    ctx.save();
    ctx.lineCap = 'round';
    if (el < pa.ad) {
      // Windup: speed lines rush in from the party side
      var wp = el / pa.ad;
      ctx.strokeStyle = 'rgba(' + col + ',' + (0.8 * wp) + ')';
      ctx.lineWidth = 2;
      for (i = 0; i < 8; i++) {
        var ly = y - 30 + (self.fxRnd(i + pa.seed) - 0.5) * 90 + i * 2;
        var lx = x + 150 - wp * 110 + self.fxRnd(i + 20) * 30;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 40, ly + 12);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    var p = (el - pa.ad) / (pa.dur - pa.ad);
    var fade = 1 - p;
    var sc = pa.big ? 1.35 : 1;

    // Impact flash + shockwave
    if (p < 0.3) {
      var q = p / 0.3;
      ctx.globalAlpha = (1 - q) * 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, (8 + q * 24) * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgb(' + col + ')';
      ctx.lineWidth = 4 * (1 - q) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 18, (10 + q * 60) * sc, (4 + q * 18) * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (pa.who === 'Sam') {
      // Two crossing blade slashes drawn as tapering crescents
      ctx.shadowColor = 'rgb(' + col + ')';
      ctx.shadowBlur = 14;
      for (i = 0; i < (pa.big ? 3 : 2); i++) {
        var sp = Math.max(0, Math.min(1, p * 3.2 - i * 0.28));
        if (sp <= 0) continue;
        var dir = i % 2 ? -1 : 1, off = i === 2 ? 0 : 0;
        var x0 = x - 46 * dir * sc, y0 = y - 50 * sc + off;
        var x1 = x0 + 92 * dir * sc * sp, y1 = y0 + 100 * sc * sp;
        ctx.globalAlpha = Math.min(1, fade * 1.6);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = (7 - sp * 3) * sc;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = 'rgba(' + col + ',0.8)';
        ctx.lineWidth = (14 - sp * 6) * sc;
        ctx.globalAlpha = Math.min(1, fade * 1.6) * 0.45;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    } else if (pa.who === 'Dario') {
      // Arcane star burst from the staff tip
      ctx.shadowColor = 'rgb(' + col + ')';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgb(' + col + ')';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 3;
      var rot = p * 2;
      ctx.globalAlpha = fade;
      for (i = 0; i < 5; i++) {
        var aa = rot + i * Math.PI * 2 / 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(aa) * (14 + p * 44) * sc, y + Math.sin(aa) * (14 + p * 44) * sc);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, (5 + 6 * fade) * sc, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Mace: golden radial thump with a cross of light
      ctx.shadowColor = 'rgb(' + col + ')';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = fade;
      ctx.strokeStyle = 'rgb(' + col + ')';
      ctx.lineWidth = 5 * fade + 1;
      ctx.beginPath();
      ctx.arc(x, y, (10 + p * 52) * sc, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fffbe0';
      var ar = (10 + 40 * (1 - p)) * sc;
      ctx.fillRect(x - 2, y - ar, 4, ar * 2);
      ctx.fillRect(x - ar, y - 2, ar * 2, 4);
    }

    // Sparks
    ctx.shadowBlur = 0;
    for (i = 0; i < (pa.big ? 16 : 10); i++) {
      var ang = self.fxRnd(i + pa.seed + 50) * Math.PI * 2;
      var spd = 24 + self.fxRnd(i + pa.seed + 70) * 56 * sc;
      var d = Math.min(1, p * 1.4);
      ctx.globalAlpha = Math.max(0, 1 - d);
      ctx.fillStyle = i % 2 ? '#fff' : 'rgb(' + col + ')';
      ctx.fillRect(x + Math.cos(ang) * spd * d - 1.5, y + Math.sin(ang) * spd * d * 0.8 + 24 * d * d - 1.5, 3, 3);
    }
    ctx.restore();
  },

  // Extra impact layers drawn on top of the base spell effect: shockwave, sparks, lingering element marks
  drawFxImpact: function(ctx, kind, x, y, p, seed, onEnemy) {
    var self = this;
    var i;
    ctx.save();
    var wave = Math.min(1, p / 0.35);
    if (p < 0.35 && (kind === 'fire' || kind === 'ice' || kind === 'thunder' || kind === 'holy' || kind === 'light')) {
      var col = { fire: '255,170,60', ice: '190,235,255', thunder: '230,236,255', holy: '255,245,190', light: '255,250,205' }[kind];
      ctx.globalAlpha = (1 - wave) * 0.85;
      ctx.strokeStyle = 'rgb(' + col + ')';
      ctx.lineWidth = 5 * (1 - wave) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 20, 10 + wave * 70, 4 + wave * 22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = (1 - wave) * 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 6 + wave * 20, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind === 'fire' || kind === 'thunder' || kind === 'ice') {
      // flying sparks
      var sc = kind === 'fire' ? '#ffd060' : (kind === 'ice' ? '#e4f6ff' : '#fff');
      for (i = 0; i < 12; i++) {
        var ang = self.fxRnd(i + seed + 90) * Math.PI * 2;
        var sp = 20 + self.fxRnd(i + seed + 120) * 60;
        var d = Math.min(1, p * 1.5);
        ctx.globalAlpha = Math.max(0, 1 - d);
        ctx.fillStyle = sc;
        ctx.fillRect(x + Math.cos(ang) * sp * d - 1.5, y + Math.sin(ang) * sp * d * 0.8 + 28 * d * d - 1.5, 3, 3);
      }
    }
    if (onEnemy && kind === 'ice') {
      // frost crystals clinging to the target
      for (i = 0; i < 6; i++) {
        var fa = i / 6 * Math.PI * 2;
        var fh = 14 + self.fxRnd(i + seed) * 12;
        ctx.globalAlpha = Math.min(1, p * 4) * (1 - Math.max(0, p - 0.7) / 0.3) * 0.85;
        ctx.fillStyle = '#d8f2ff';
        ctx.beginPath();
        var fx0 = x + Math.cos(fa) * 28, fy0 = y + 8 + Math.sin(fa) * 22;
        ctx.moveTo(fx0, fy0 - fh);
        ctx.lineTo(fx0 - 4, fy0);
        ctx.lineTo(fx0 + 4, fy0);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (onEnemy && kind === 'fire') {
      // scorch glow lingering after the flames
      ctx.globalAlpha = Math.max(0, 0.35 - p * 0.35);
      ctx.fillStyle = '#ff6a10';
      ctx.beginPath();
      ctx.ellipse(x, y + 22, 36, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind === 'heal' || kind === 'holy' || kind === 'light') {
      // twinkling stars drifting up
      for (i = 0; i < 7; i++) {
        var sx = x + (self.fxRnd(i + seed + 200) - 0.5) * 70;
        var sy = y + 24 - p * (50 + self.fxRnd(i + seed + 210) * 50);
        var tw = 2 + Math.abs(Math.sin(p * 14 + i)) * 4;
        ctx.globalAlpha = Math.sin(Math.PI * Math.min(1, p)) * 0.9;
        ctx.fillStyle = kind === 'heal' ? '#eafff0' : '#fffbd0';
        ctx.fillRect(sx - tw, sy - 0.75, tw * 2, 1.5);
        ctx.fillRect(sx - 0.75, sy - tw, 1.5, tw * 2);
      }
    }
    ctx.restore();
  },

  drawFx: function(ctx, kind, x, y, p, seed) {
    var self = this;
    var r = function(i) { return self.fxRnd(i + seed); };
    var fade = Math.sin(Math.PI * Math.min(1, p));
    ctx.save();
    var i, a, px, py;

    if (kind === 'fire') {
      var g = ctx.createRadialGradient(x, y, 2, x, y, 55);
      g.addColorStop(0, 'rgba(255,200,60,' + 0.7 * fade + ')');
      g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 60, y - 60, 120, 120);
      for (i = 0; i < 18; i++) {
        px = x + (r(i) - 0.5) * 56 + Math.sin(p * 9 + i) * 4;
        py = y + 28 - p * (50 + r(i + 40) * 60);
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
        ctx.fillStyle = i % 3 === 0 ? '#ffe066' : (i % 3 === 1 ? '#ff8a1f' : '#e8341c');
        ctx.beginPath();
        ctx.arc(px, py, 7 * (1 - p) + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'ice') {
      for (i = 0; i < 14; i++) {
        px = x + (r(i) - 0.5) * 70;
        py = y - 110 + Math.min(1, p * 1.6 + r(i + 9) * 0.2) * 120;
        ctx.globalAlpha = 0.9 * (1 - Math.max(0, p - 0.6) / 0.4);
        ctx.fillStyle = i % 2 ? '#bfe9ff' : '#7cc4ff';
        ctx.beginPath();
        ctx.moveTo(px, py - 14);
        ctx.lineTo(px - 4, py);
        ctx.lineTo(px, py + 14);
        ctx.lineTo(px + 4, py);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = fade * 0.5;
      ctx.strokeStyle = '#d8f2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 20, 20 + p * 40, 6 + p * 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'thunder') {
      if (p < 0.55) {
        ctx.globalAlpha = 1 - p / 0.55;
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = '#8ab8ff';
        ctx.shadowBlur = 18;
        ctx.lineWidth = 4;
        ctx.beginPath();
        var bx = x + (r(1) - 0.5) * 20, by = y - 170;
        ctx.moveTo(bx, by);
        for (i = 1; i <= 7; i++) {
          bx = x + (r(i + 3) - 0.5) * 44 * (1 - i / 8);
          by = y - 170 + i * (170 / 7);
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = fade * 0.6;
      ctx.fillStyle = '#cfe0ff';
      ctx.beginPath();
      ctx.arc(x, y, 10 + p * 30, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'heal') {
      var hg = ctx.createRadialGradient(x, y, 2, x, y, 45);
      hg.addColorStop(0, 'rgba(140,255,170,' + 0.55 * fade + ')');
      hg.addColorStop(1, 'rgba(60,220,120,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(x - 50, y - 50, 100, 100);
      for (i = 0; i < 10; i++) {
        px = x + (r(i) - 0.5) * 60;
        py = y + 20 - p * (40 + r(i + 7) * 40);
        ctx.globalAlpha = Math.max(0, 1 - p);
        ctx.fillStyle = '#c8ffd8';
        ctx.fillRect(px - 1, py - 5, 3, 11);
        ctx.fillRect(px - 5, py - 1, 11, 3);
      }
    } else if (kind === 'sleep') {
      // a violet ring spreads and drowsy Z's rise
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = 'rgb(160,140,255)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 20, 14 + p * 52, 5 + p * 17, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#d8d4ff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      for (i = 0; i < 3; i++) {
        var zq = Math.max(0, Math.min(1, p * 1.3 - i * 0.2));
        ctx.globalAlpha = Math.sin(Math.PI * zq);
        ctx.fillText('Z', x - 18 + i * 18, y - 10 - zq * 44);
      }
    } else if (kind === 'buffAtk' || kind === 'buffDef' || kind === 'buffInt') {
      var col = kind === 'buffAtk' ? '255,120,60' : (kind === 'buffInt' ? '120,230,255' : '90,170,255');
      for (i = 0; i < 3; i++) {
        var q = Math.max(0, Math.min(1, p * 1.4 - i * 0.18));
        ctx.globalAlpha = Math.sin(Math.PI * q) * 0.8;
        ctx.strokeStyle = 'rgb(' + col + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y + 20 - q * 40, 24 + q * 10, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgb(' + col + ')';
      for (i = 0; i < 4; i++) {
        px = x - 30 + i * 20;
        py = y + 10 - p * 30 - (i % 2) * 8;
        ctx.beginPath();
        ctx.moveTo(px, py - 8);
        ctx.lineTo(px - 5, py);
        ctx.lineTo(px + 5, py);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'holy') {
      var bw = 26 * fade + 4;
      var lg = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
      lg.addColorStop(0, 'rgba(255,240,160,0)');
      lg.addColorStop(0.5, 'rgba(255,255,230,' + 0.9 * fade + ')');
      lg.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(x - bw, 0, bw * 2, y + 30);
      for (i = 0; i < 8; i++) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#fff6b0';
        ctx.beginPath();
        ctx.arc(x + (r(i) - 0.5) * 60, y + 20 - p * 70 * (0.5 + r(i + 5)), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'dark') {
      for (i = 0; i < 4; i++) {
        var rad = (1 - p) * (70 - i * 12) + 6;
        ctx.globalAlpha = fade * 0.8;
        ctx.strokeStyle = i % 2 ? '#a040e0' : '#4a1070';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, rad, p * 6 + i, p * 6 + i + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.globalAlpha = fade * 0.7;
      ctx.fillStyle = '#1a0630';
      ctx.beginPath();
      ctx.arc(x, y, 14 * fade, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'debuffAtk' || kind === 'debuffDef') {
      var dc = kind === 'debuffAtk' ? '255,70,130' : '130,100,255';
      // dark mist closing in, then heavy arrows pressing the target down
      var mg = ctx.createRadialGradient(x, y, 4, x, y, 58);
      mg.addColorStop(0, 'rgba(' + dc + ',' + (0.45 * fade) + ')');
      mg.addColorStop(1, 'rgba(30,0,50,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(x - 60, y - 60, 120, 120);
      for (i = 0; i < 3; i++) {
        var cp = Math.min(1, Math.max(0, p * 1.5 - i * 0.12));
        ctx.globalAlpha = Math.sin(Math.PI * cp) * 0.85;
        ctx.strokeStyle = 'rgb(' + dc + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y + 4, (1 - cp) * 60 + 14, ((1 - cp) * 60 + 14) * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (i = 0; i < 3; i++) {
        var ap = Math.min(1, Math.max(0, (p - 0.15 - i * 0.12) / 0.6));
        if (ap <= 0) continue;
        var axp = x + (i - 1) * 22, ayp = y - 50 + ap * 62;
        ctx.globalAlpha = Math.sin(Math.PI * ap);
        ctx.fillStyle = 'rgb(' + dc + ')';
        ctx.beginPath();
        ctx.moveTo(axp - 9, ayp - 10); ctx.lineTo(axp + 9, ayp - 10); ctx.lineTo(axp + 9, ayp); ctx.lineTo(axp + 14, ayp);
        ctx.lineTo(axp, ayp + 14); ctx.lineTo(axp - 14, ayp); ctx.lineTo(axp - 9, ayp);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'slash') {
      ctx.lineCap = 'round';
      for (i = 0; i < 2; i++) {
        var sp = Math.max(0, Math.min(1, p * 2.2 - i * 0.45));
        if (sp <= 0) continue;
        var dir = i ? -1 : 1;
        ctx.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4;
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = '#9cf';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 5 - sp * 2;
        ctx.beginPath();
        ctx.moveTo(x - 38 * dir, y - 42);
        ctx.lineTo(x - 38 * dir + 76 * dir * sp, y - 42 + 84 * sp);
        ctx.stroke();
      }
    } else if (kind === 'sweep') {
      // a wide crescent sweeping left to right through the target, with a fading trail and sparks
      ctx.lineCap = 'round';
      var swp = Math.max(0, Math.min(1, p * 1.8));
      var a0 = Math.PI * 1.08, a1 = a0 + Math.PI * 0.84 * swp;
      for (i = 0; i < 3; i++) {
        var ta = Math.max(a0, a1 - i * 0.22);
        ctx.globalAlpha = (1 - Math.max(0, p - 0.55) / 0.45) * (1 - i * 0.32);
        ctx.strokeStyle = i ? 'rgba(170,215,255,0.9)' : '#fff';
        ctx.shadowColor = '#8cf';
        ctx.shadowBlur = i ? 4 : 12;
        ctx.lineWidth = 7 - i * 2 - swp * 2;
        ctx.beginPath();
        ctx.ellipse(x, y + 22, 56 - i * 5, 40 - i * 4, 0, a0, ta);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      for (i = 0; i < 7; i++) {
        var sa = a1 - 0.1 - r(i) * 0.5, sd = 6 + p * 24 * r(i + 9);
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.9;
        ctx.fillRect(x + Math.cos(sa) * (56 + sd) - 1.5, y + 22 + Math.sin(sa) * (40 + sd * 0.7) - 1.5, 3, 3);
      }
    } else if (kind === 'light') {
      // a slender column of light drops onto the target and rings out at its feet
      var lp = Math.min(1, p * 1.6), la = Math.sin(Math.PI * Math.min(1, p)) ;
      var lg = ctx.createLinearGradient(0, y - 130, 0, y + 26);
      lg.addColorStop(0, 'rgba(255,250,205,0)'); lg.addColorStop(0.6, 'rgba(255,252,225,' + (0.85 * la) + ')'); lg.addColorStop(1, 'rgba(255,255,255,' + la + ')');
      ctx.fillStyle = lg;
      var lw = 8 + 12 * Math.sin(Math.PI * lp);
      ctx.fillRect(x - lw / 2, y - 130, lw, 156);
      ctx.globalAlpha = la * 0.9;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 2, y - 130, 4, 156);
      ctx.globalAlpha = la * 0.8;
      ctx.strokeStyle = '#fff6c0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 24, 8 + lp * 34, 3 + lp * 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 'bash') {
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 8 + p * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (i = 0; i < 8; i++) {
        a = i * Math.PI / 4;
        ctx.fillRect(x + Math.cos(a) * (14 + p * 40) - 2, y + Math.sin(a) * (14 + p * 40) - 2, 4, 4);
      }
    }
    ctx.restore();
  },
});
