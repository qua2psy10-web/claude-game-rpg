// ============================================================
// battle-render.js — The battle scene: backdrop, enemies, status panel, menus, message window and the layering of the effects.
// Adds its methods to BattleSystem (defined in battle.js), so load it right after battle.js.
// ============================================================

Object.assign(BattleSystem, {
  // Perspective battle backdrop: sky, mountains, fogged horizon, gridded floor
  renderBackdrop: function(ctx, w, h, groundY) {
    var sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#05051a');
    sky.addColorStop(0.7, '#2a1a4a');
    sky.addColorStop(1, '#5a3a62');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);

    // Stars
    ctx.fillStyle = 'rgba(255,255,220,0.7)';
    for (var st = 0; st < 30; st++) {
      ctx.fillRect((st * 97) % w, (st * 53) % (groundY * 0.6), 1, 1);
    }

    // Far mountains (two layers for parallax depth)
    var layers = [{ c: '#2a2044', amp: 34, f: 0.011, base: groundY - 6 },
                  { c: '#1a1530', amp: 22, f: 0.019, base: groundY }];
    for (var l = 0; l < layers.length; l++) {
      ctx.fillStyle = layers[l].c;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (var x = 0; x <= w; x += 8) {
        var y = layers[l].base - layers[l].amp * (0.5 + 0.5 * Math.sin(x * layers[l].f + l * 2) * Math.cos(x * 0.004 + l));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, groundY);
      ctx.closePath();
      ctx.fill();
    }

    // Floor
    var floor = ctx.createLinearGradient(0, groundY, 0, h);
    floor.addColorStop(0, '#3a3450');
    floor.addColorStop(1, '#0c0b16');
    ctx.fillStyle = floor;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Perspective grid: lines converge on the vanishing point
    var vx = w / 2;
    ctx.strokeStyle = 'rgba(160,150,200,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = -12; k <= 12; k++) {
      ctx.moveTo(vx + k * 14, groundY);
      ctx.lineTo(vx + k * 120, h);
    }
    // Horizontal lines spaced by t^2 (nearer = wider apart)
    for (var r = 1; r <= 9; r++) {
      var t = r / 9;
      var yy = groundY + (h - groundY) * t * t;
      ctx.moveTo(0, yy);
      ctx.lineTo(w, yy);
    }
    ctx.stroke();

    // Horizon fog
    var fog = ctx.createLinearGradient(0, groundY - 30, 0, groundY + 50);
    fog.addColorStop(0, 'rgba(120,90,150,0)');
    fog.addColorStop(0.5, 'rgba(120,90,150,0.35)');
    fog.addColorStop(1, 'rgba(120,90,150,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, groundY - 30, w, 80);
  },

  // ===== BATTLE RENDERING =====
  render: function(ctx, game, canvasW, canvasH) {
    var b = game.battle;
    if (!b) return;

    var groundY = Math.floor(canvasH * 0.42);
    var now = Date.now();
    // Screen shake (scene only; UI windows stay steady)
    ctx.save();
    var shakeLeft = (b.shakeUntil || 0) - now;
    if (shakeLeft > 0) {
      var amp = (b.shakeMag || 0) * Math.min(1, shakeLeft / (b.shakeDur || 1));
      ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    }
    // Running: the camera bobs with the party's footsteps and drifts as they sprint off
    if (b.escapeStart) {
      var rt = now - b.escapeStart;
      ctx.translate(-Math.min(1, rt / 800) * 14, Math.sin(rt / 55) * 2.2 * Math.min(1, rt / 150));
    }
    // Camera push-in: the scene starts slightly zoomed and settles as the enemies arrive
    if (b.introStart) {
      var zt = (now - b.introStart) / 800;
      if (zt < 1) {
        var zm = 1 + 0.09 * (1 - zt) * (1 - zt);
        ctx.translate(canvasW / 2, canvasH * 0.45);
        ctx.scale(zm, zm);
        ctx.translate(-canvasW / 2, -canvasH * 0.45);
      }
    }
    // Impact punch: the whole scene lurches toward the player when a melee hit lands
    var punchFx = b.partyHit;
    if (punchFx && punchFx.melee) {
      var pt2 = now - punchFx.t0;
      if (pt2 >= 0 && pt2 < 240) {
        var pz = 1 + (punchFx.heavy ? 0.07 : 0.04) * Math.pow(1 - pt2 / 240, 2);
        ctx.translate(canvasW / 2, canvasH * 0.55);
        ctx.scale(pz, pz);
        ctx.translate(-canvasW / 2, -canvasH * 0.55);
      }
    }
    this.renderBackdrop(ctx, canvasW, canvasH, groundY);
    // Boss casts: the camera pushes in on the caster
    var zfx = b.enemyCast;
    if (zfx && zfx.boss && b.enemies[zfx.idx] && b.enemies[zfx.idx].sx !== undefined) {
      var zct = (now - zfx.t0) / zfx.dur;
      if (zct >= 0 && zct < 1) {
        var zc = 1 + 0.07 * Math.sin(Math.PI * Math.min(1, zct / 0.95));
        var zx = b.enemies[zfx.idx].sx, zy = b.enemies[zfx.idx].sy;
        ctx.translate(zx, zy);
        ctx.scale(zc, zc);
        ctx.translate(-zx, -zy);
      }
    }
    // The scene dims while an enemy gathers magic
    var dimFx = b.enemyCast;
    if (dimFx) {
      var dimT = (now - dimFx.t0) / dimFx.dur;
      if (dimT >= 0 && dimT < 1) {
        ctx.fillStyle = 'rgba(0,0,10,' + (0.4 * Math.sin(Math.PI * Math.min(1, dimT / 0.9))) + ')';
        ctx.fillRect(-20, -20, canvasW + 40, canvasH + 40);
      }
    }

    // Draw enemies in 3D-ish depth (alternating rows, back row smaller & higher)
    var aliveEnemies = [];
    for (var i = 0; i < b.enemies.length; i++) {
      if (b.enemies[i].alive) aliveEnemies.push({ enemy: b.enemies[i], index: i });
    }
    var spacing = canvasW / (aliveEnemies.length + 1);
    var order = aliveEnemies.map(function(e, n) { return n; });
    // Draw back row first so front enemies overlap correctly
    order.sort(function(p, q) { return (q % 2) - (p % 2); });
    for (var oi = 0; oi < order.length; oi++) {
      var j = order[oi];
      var en = aliveEnemies[j].enemy;
      var back = (aliveEnemies.length > 1 && j % 2 === 1);
      var depth = back ? 0.85 : 1.1;
      var scale = (en.boss ? 1.8 : 1) * depth;
      var ex = spacing * (j + 1);
      var footY = groundY + (back ? 46 : 84) + (en.boss ? 10 : 0);
      var bob = Math.sin(now / 420 + j * 1.7) * 3;

      // Each species enters its own way: wolf dashes in, bat swoops, skeleton claws up from the
      // floor, mage warps in; everything else (and the boss) drops from above
      var estyle = en.boss ? 'drop' : ({ wolf: 'dash', bat: 'swoop', skeleton: 'rise', mage: 'warp' }[en.shape] || 'drop');
      var landQ = { drop: 0.364, dash: 0.55, swoop: 0.62, rise: 0.62, warp: 0.6 }[estyle];

      // Entrance: each enemy drops in, bounces and kicks up dust (bosses arrive last, slower)
      var introQ = 1;
      if (b.introStart) {
        var delay = en.boss ? 700 : j * 200;
        introQ = Math.max(0, Math.min(1, (now - b.introStart - delay) / (en.boss ? 1100 : 620)));
        if (introQ <= 0) continue;
        // Each species announces itself with its own sound as it appears
        if (!en.introSfx) {
          en.introSfx = true;
          if (!en.boss) SoundSystem.enemyAppear(en.shape);
        }
        // Regular enemies: a small thud and jolt on touchdown
        if (!en.landAt && introQ >= landQ) {
          en.landAt = now;
          if (!en.boss && estyle !== 'warp' && estyle !== 'swoop') {
            this.shake(game, 3, 140);
            SoundSystem.thud();
          }
        }
        // Boss slam: heavy shake, rumble and a shockwave ring when it lands
        if (en.boss && b.bossIntro && introQ >= 0.364 && !b.bossLandAt) {
          b.bossLandAt = now;
          this.shake(game, 16, 800);
          SoundSystem.bossAppear();
        }
        if (en.boss && b.bossLandAt) {
          var sw = (now - b.bossLandAt) / 700;
          if (sw < 1) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255,90,60,' + (0.8 * (1 - sw)) + ')';
            ctx.lineWidth = 6 * (1 - sw) + 1;
            ctx.beginPath();
            ctx.ellipse(ex, footY + 2, 40 + sw * 260, 8 + sw * 50, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      var drop = 0, introDx = 0, introRot = 0, riseQ = 1, warpQ = 1, dashE = 1;
      var sgn = ex < canvasW / 2 ? -1 : 1;                       // enter from the nearer screen edge
      var edgeDist = (sgn < 0 ? ex : canvasW - ex) + 80;
      if (estyle === 'drop') {
        drop = (1 - this.easeOutBounce(introQ)) * 150;
      } else if (introQ < 1) {
        if (estyle === 'dash') {
          var dq = Math.min(1, introQ / 0.55);
          dashE = 1 - Math.pow(1 - dq, 3);
          introDx = sgn * (1 - dashE) * edgeDist;
          introRot = -sgn * 0.12 * (1 - dashE);               // leans into the run
        } else if (estyle === 'swoop') {
          var swq = Math.min(1, introQ / 0.62);
          introDx = sgn * (1 - swq) * 260;
          drop = (1 - swq) * 190 + Math.sin(swq * Math.PI * 3) * 26 * (1 - swq);
          introRot = Math.sin(swq * 16) * 0.25 * (1 - swq);   // flapping wobble
        } else if (estyle === 'rise') {
          riseQ = Math.min(1, introQ / 0.62);
          drop = -(1 - riseQ) * 46 * scale;                   // starts below the floor line
        } else if (estyle === 'warp') {
          warpQ = Math.min(1, introQ / 0.6);
        }
      }
      var ey = footY - 22 * scale + bob - drop;
      ctx.globalAlpha = Math.min(1, introQ * 3);
      if (estyle === 'warp' && warpQ < 1) ctx.globalAlpha = warpQ * (0.5 + 0.5 * Math.abs(Math.sin(now / 40)));   // flickers into existence

      // Summoning beam while falling, then a flash and ground ripple on touchdown
      if (b.introStart && !en.boss) {
        if (estyle === 'drop' && introQ < 0.364) {
          var bw = 16 * scale, bf = introQ / 0.364;
          var bg = ctx.createLinearGradient(ex - bw, 0, ex + bw, 0);
          bg.addColorStop(0, 'rgba(200,220,255,0)');
          bg.addColorStop(0.5, 'rgba(230,240,255,' + (0.35 * bf) + ')');
          bg.addColorStop(1, 'rgba(200,220,255,0)');
          ctx.fillStyle = bg;
          ctx.fillRect(ex - bw, 0, bw * 2, footY);
        }
        if (en.landAt) {
          var lt = (now - en.landAt) / 320;
          if (lt < 1) {
            var fg = ctx.createRadialGradient(ex, footY - 10, 2, ex, footY - 10, 46 * scale);
            fg.addColorStop(0, 'rgba(255,255,255,' + (0.55 * (1 - lt)) + ')');
            fg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = fg;
            ctx.fillRect(ex - 50 * scale, footY - 56 * scale, 100 * scale, 100 * scale);
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - lt)) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(ex, footY + 2, 10 + lt * 60 * scale, 3 + lt * 12 * scale, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Ground ripple at the attacker's feet at the moment of impact (hop / pounce / heavy)
      if (atkFx && atkFx.idx === aliveEnemies[j].index && atkFx.style !== 'dive' && atkFx.style !== 'slash') {
        var rpt = (now - atkFx.t0) / atkFx.dur;
        if (rpt >= 0.464 && rpt < 0.75) {
          var rpp = (rpt - 0.464) / 0.286;
          ctx.save();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - rpp)) + ')';
          ctx.lineWidth = 3 * (1 - rpp) + 1;
          ctx.beginPath();
          ctx.ellipse(ex, footY + 2, (20 + rpp * (atkFx.style === 'heavy' ? 90 : 60)) * scale, (5 + rpp * 16) * scale, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Species-specific entrance effects
      if (b.introStart && introQ < 1 && !en.boss) {
        var fxi;
        if (estyle === 'dash') {                               // dust kicked up behind the runner
          for (fxi = 0; fxi < 6; fxi++) {
            var dtq = Math.max(0, Math.min(1, introQ / 0.55) - fxi * 0.06);
            var dte = 1 - Math.pow(1 - dtq, 3);
            ctx.fillStyle = 'rgba(205,195,180,' + (0.45 * (1 - fxi / 6)) + ')';
            ctx.beginPath();
            ctx.arc(ex + sgn * (1 - dte) * edgeDist, footY + 4 - fxi, (6 + fxi * 3) * scale * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (estyle === 'rise') {                        // bone chips fly out of the cracked floor
          ctx.fillStyle = '#c9c0a4';
          for (fxi = 0; fxi < 10; fxi++) {
            var cx2 = ex + (this.fxRnd(fxi + 1800) - 0.5) * 60 * scale * (0.4 + riseQ);
            var cy2 = footY - Math.sin(riseQ * Math.PI) * (20 + this.fxRnd(fxi + 1900) * 50) * scale;
            ctx.globalAlpha = 1 - riseQ;
            ctx.fillRect(cx2, cy2, 4, 4);
          }
          ctx.globalAlpha = 1;
          ctx.strokeStyle = 'rgba(30,20,30,' + (0.6 * (1 - riseQ)) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (fxi = 0; fxi < 5; fxi++) {                       // cracks radiating along the floor
            var ca = -0.7 + fxi * 0.35;
            ctx.moveTo(ex, footY + 3);
            ctx.lineTo(ex + Math.cos(ca + Math.PI / 2) * 40 * scale * riseQ * (fxi % 2 ? 1 : -1), footY + 3 + Math.abs(Math.sin(ca)) * 6);
          }
          ctx.stroke();
        } else if (estyle === 'warp') {                        // rune circle and energy converging
          ctx.save();
          ctx.globalAlpha = Math.min(1, warpQ * 2) * (1 - Math.max(0, warpQ - 0.8) / 0.2);
          ctx.strokeStyle = 'rgb(190,130,255)';
          ctx.shadowColor = '#b080ff';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.lineDashOffset = now / 30;
          ctx.beginPath();
          ctx.ellipse(ex, footY + 2, 40 * scale * (0.5 + 0.5 * warpQ), 10 * scale * (0.5 + 0.5 * warpQ), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = '#e0c8ff';
          for (fxi = 0; fxi < 14; fxi++) {
            var wa = fxi / 14 * Math.PI * 2 + warpQ * 3;
            var wr = (1 - warpQ) * 90 * scale;
            ctx.fillRect(ex + Math.cos(wa) * wr - 2, ey + Math.sin(wa) * wr * 0.7 - 2, 4, 4);
          }
        }
      }

      // Boss aura
      if (en.boss) {
        // The aura grows and burns hotter with each form; a stored attack turns it violet and pulsing
        var bph = en.bossPhase || 0, chg = !!en.charging;
        var pulse = 0.5 + 0.5 * Math.sin(now / (chg ? 110 : 320));
        var arad = 120 + bph * 24 + (chg ? 34 * pulse : 0);
        var acol = chg ? '150,40,230' : (bph === 0 ? '200,40,60' : (bph === 1 ? '190,30,120' : '255,110,40'));
        var aal = (chg ? 0.5 + 0.25 * pulse : 0.35 + bph * 0.12);
        var aura = ctx.createRadialGradient(ex, ey, 10, ex, ey, arad);
        aura.addColorStop(0, 'rgba(' + acol + ',' + aal + ')');
        aura.addColorStop(1, 'rgba(' + acol + ',0)');
        ctx.fillStyle = aura;
        ctx.fillRect(ex - arad - 10, ey - arad - 10, arad * 2 + 20, arad * 2 + 20);
        if (chg) {                                    // dark motes are drawn in from all sides
          ctx.fillStyle = 'rgba(190,120,255,0.8)';
          for (var cp = 0; cp < 18; cp++) {
            var cq = (now / 800 + cp / 18) % 1, ca = cp * 2.4 + 0.5;
            var cr = 190 * (1 - cq) + 14;
            ctx.globalAlpha = Math.min(1, cq * 2) * 0.9;
            ctx.fillRect(ex + Math.cos(ca) * cr - 2, ey + Math.sin(ca) * cr * 0.7 - 2, 4, 4);
          }
          ctx.globalAlpha = 1;
        } else if (bph >= 1) {                        // embers rise off an enraged boss
          for (var ep = 0; ep < 6 + bph * 4; ep++) {
            var eq = (now / 1400 + ep * 0.137) % 1;
            ctx.fillStyle = bph === 1 ? 'rgba(220,60,160,' : 'rgba(255,170,60,';
            ctx.fillStyle += (1 - eq) * 0.8 + ')';
            ctx.fillRect(ex + (this.fxRnd(ep + 700) - 0.5) * 120, ey + 40 - eq * 130, 3, 3);
          }
        }
      }

      // Ground shadow (shrinks as the enemy bobs up)
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(ex + introDx, footY + 2, (30 * scale - bob) * (0.4 + 0.6 * introQ), 7 * scale * (0.4 + 0.6 * introQ), 0, 0, Math.PI * 2);
      ctx.fill();

      // Landing dust puff
      var dustT = (introQ - 0.36) / 0.64;
      if (introQ < 1 && dustT > 0) {
        ctx.fillStyle = 'rgba(200,190,220,' + 0.5 * (1 - dustT) + ')';
        for (var dp = 0; dp < 8; dp++) {
          var da = dp / 8 * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(ex + Math.cos(da) * (10 + dustT * 40) * scale, footY + Math.sin(da) * (3 + dustT * 6) * scale - dustT * 8, 4 + dustT * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      en.sx = ex; en.sy = ey; en.sfoot = footY; en.sscale = scale;
      // Attack lunge: wind up, charge toward the player, retreat
      var lungeK = 1, lungeDy = 0, atkRot = 0, atkDx = 0, atkSX = 1, atkSY = 1;
      var atkFx = b.enemyAtk;
      if (atkFx && atkFx.idx === aliveEnemies[j].index) {
        var at = (now - atkFx.t0) / atkFx.dur;
        if (at >= 0 && at < 1) {
          var amt = this.atkCurve(at);
          lungeK = 1 + 0.45 * amt;
          lungeDy = 56 * amt;
          // Species-specific attack motion layered on the base lunge
          var ast = atkFx.style, aq;
          if (ast === 'pounce') {                              // wolf: leaps over in an arc, claws first
            aq = Math.max(0, Math.min(1, (at - 0.22) / 0.244));
            lungeDy -= 80 * Math.sin(aq * Math.PI);
            atkRot = 0.4 * Math.max(0, 1 - Math.abs(at - 0.464) / 0.3);
          } else if (ast === 'hop') {                          // slime: squashes, springs high, slams flat
            if (at < 0.28) {
              atkSY = 1 - 0.28 * (at / 0.28);
              atkSX = 1 + 0.2 * (at / 0.28);
            } else if (at < 0.464) {
              aq = (at - 0.28) / 0.184;
              lungeDy = -100 * Math.sin(aq * Math.PI) + 56 * amt;
              atkSY = 1 + 0.2 * Math.sin(aq * Math.PI);
            } else if (at < 0.65) {
              aq = 1 - (at - 0.464) / 0.186;
              atkSY = 1 - 0.4 * aq;
              atkSX = 1 + 0.4 * aq;
            }
          } else if (ast === 'dive') {                         // bat: climbs, then dives in a swaying arc
            if (at < 0.3) {
              lungeDy -= 50 * (at / 0.3);
              atkDx = Math.sin(at * 14) * 14;
            } else if (at < 0.464) {
              aq = (at - 0.3) / 0.164;
              lungeDy = -50 + 120 * aq;
              lungeK = 1 + 0.6 * aq;
              atkDx = Math.sin(at * 14) * 14 * (1 - aq);
              atkRot = -0.35 * (1 - aq);
            }
          } else if (ast === 'heavy') {                        // knight/boss: raises the weapon, swings down
            lungeK = 1 + 0.6 * amt;
            if (at < 0.3) {
              atkRot = -0.4 * (at / 0.3);
              lungeDy -= 30 * (at / 0.3);
            } else if (at < 0.464) {
              atkRot = -0.4 + 1.0 * ((at - 0.3) / 0.164);
            } else {
              atkRot = 0.6 * (1 - (at - 0.464) / 0.536);
            }
          }
          // Telegraph: a red glow builds while the enemy winds up
          if (at < 0.34) {
            var tg = Math.min(1, at / 0.3);
            var tgr = ctx.createRadialGradient(ex, ey, 4, ex, ey, 52 * scale);
            tgr.addColorStop(0, 'rgba(255,40,40,' + (0.55 * tg) + ')');
            tgr.addColorStop(1, 'rgba(255,40,40,0)');
            ctx.fillStyle = tgr;
            ctx.fillRect(ex - 56 * scale, ey - 56 * scale, 112 * scale, 112 * scale);
          }
        }
      }
      // Getaway: enemies shrink toward the horizon as we run
      if (b.escapeStart) {
        var ek = Math.min(1, (now - b.escapeStart) / 900);
        lungeK *= 1 - 0.3 * ek;
        lungeDy -= 24 * ek;
      }
      // Stunned: the body trembles hard at first, then settles into a slow wobble
      if (en.stunAt) {
        var stT = now - en.stunAt;
        if (stT >= 0 && stT < 2000) {
          var stK = stT < 500 ? 1 : 0.35 * (1 - (stT - 500) / 1500);
          atkDx += Math.sin(stT / 22) * 6 * stK;
          lungeDy += Math.abs(Math.sin(stT / 40)) * -2 * stK;
        }
      }
      // Spell charge-up: hover, glowing aura and orbiting sparks in the spell's colour
      var castFx = b.enemyCast;
      if (castFx && castFx.idx === aliveEnemies[j].index) {
        var ct = (now - castFx.t0) / castFx.dur;
        if (ct >= 0 && ct < 1) {
          var ramp = Math.min(1, ct / 0.7);
          lungeDy -= 14 * Math.sin(Math.min(1, ct / 0.8) * Math.PI);
          var ar = 30 * scale * (0.8 + 0.6 * ramp);
          // Rotating magic circle on the ground
          ctx.save();
          ctx.globalAlpha = ramp;
          ctx.strokeStyle = 'rgb(' + castFx.tint + ')';
          ctx.shadowColor = 'rgb(' + castFx.tint + ')';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          for (var mc = 0; mc < 2; mc++) {
            ctx.setLineDash([6, 5 + mc * 4]);
            ctx.lineDashOffset = (mc ? 1 : -1) * now / 40;
            ctx.beginPath();
            ctx.ellipse(ex, footY + 2, (46 - mc * 14) * scale * ramp, (12 - mc * 4) * scale * ramp, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
          // Energy orb swelling above the caster
          var orbR = (4 + 16 * ramp) * scale;
          var orbG = ctx.createRadialGradient(ex, ey - 46 * scale, 1, ex, ey - 46 * scale, orbR * 1.8);
          orbG.addColorStop(0, 'rgba(255,255,255,' + (0.9 * ramp) + ')');
          orbG.addColorStop(0.4, 'rgba(' + castFx.tint + ',' + (0.8 * ramp) + ')');
          orbG.addColorStop(1, 'rgba(' + castFx.tint + ',0)');
          ctx.fillStyle = orbG;
          ctx.fillRect(ex - orbR * 2, ey - 46 * scale - orbR * 2, orbR * 4, orbR * 4);
          // Spell name flashes up over the caster
          var spName = SPELLS[castFx.spellId] ? SPELLS[castFx.spellId].name : '';
          if (spName && ct < 0.85) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, ct / 0.12) * (ct > 0.7 ? 1 - (ct - 0.7) / 0.15 : 1);
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#000';
            ctx.strokeText(spName, ex, ey - 88 * scale);
            ctx.fillStyle = 'rgb(' + castFx.tint + ')';
            ctx.shadowColor = 'rgb(' + castFx.tint + ')';
            ctx.shadowBlur = 10;
            ctx.fillText(spName, ex, ey - 88 * scale);
            ctx.restore();
          }
          var ag = ctx.createRadialGradient(ex, ey, 4, ex, ey, ar * 1.6);
          ag.addColorStop(0, 'rgba(' + castFx.tint + ',' + (0.55 * ramp) + ')');
          ag.addColorStop(1, 'rgba(' + castFx.tint + ',0)');
          ctx.fillStyle = ag;
          ctx.fillRect(ex - ar * 2, ey - ar * 2, ar * 4, ar * 4);
          ctx.fillStyle = 'rgba(' + castFx.tint + ',' + (0.9 * (1 - ct * 0.4)) + ')';
          // Rune glyphs orbit the caster (fire / dark / heal)
          var runeCh = { enemyFire: '炎', enemyDark: '闇', enemyDoom: '終', enemyCrystal: '晶', enemyHeal: '癒' }[castFx.spellId];
          if (runeCh) {
            ctx.save();
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgb(' + castFx.tint + ')';
            ctx.shadowBlur = 10;
            ctx.fillStyle = 'rgba(255,255,255,' + (0.9 * ramp) + ')';
            for (var rg = 0; rg < 4; rg++) {
              var rang = now / 420 + rg * Math.PI / 2;
              ctx.fillText(runeCh, ex + Math.cos(rang) * 46 * scale, ey - 20 * scale + Math.sin(rang) * 16 * scale - ramp * 10);
            }
            ctx.restore();
          }
          for (var os = 0; os < 7; os++) {
            var oa = now / 180 + os * Math.PI * 2 / 7;
            var orad = ar * (1.4 - ramp * 0.5);
            ctx.fillRect(ex + Math.cos(oa) * orad - 2, ey + Math.sin(oa) * orad * 0.6 - 2, 4, 4);
          }
        }
      }
      // Entrance squash & stretch: elongated while falling, squashed on impact
      var introSX = 1, introSY = 1;
      if (b.introStart && introQ < 1 && estyle === 'drop') {
        if (introQ < 0.364) {
          var sf = introQ / 0.364;
          introSY = 1 + 0.3 * sf;
          introSX = 1 - 0.15 * sf;
        } else if (en.landAt) {
          var sl = (now - en.landAt) / 260;
          if (sl < 1) { introSX = 1 + 0.3 * (1 - sl); introSY = 1 - 0.3 * (1 - sl); }
        }
      }
      if (estyle === 'warp' && warpQ < 1) {                   // warp-ins start larger and settle
        var wk = 1 + 0.3 * (1 - warpQ);
        introSX *= wk;
        introSY *= wk;
      }
      // Hit reaction: white flash, shaking recoil and squash that settle over 0.5s
      var hitDx = 0, hitBright = false, hitT = -1;
      if (en.hitAt) {
        hitT = now - en.hitAt;
        if (hitT >= 0 && hitT < 500) {
          var hp0 = hitT / 500, hk = (1 - hp0) * (1 - hp0), hm = en.hitMag || 0.5;
          hitDx = Math.sin(hitT / 26) * 9 * hm * (1 - hp0);
          lungeDy -= 14 * hm * hk;
          introSX *= 1 + 0.14 * hm * hk;
          introSY *= 1 - 0.14 * hm * hk;
          hitBright = hitT < 130;
        } else {
          hitT = -1;
        }
      }
      var wRatio = en.maxHp ? en.hp / en.maxHp : 1;           // badly hurt enemies tremble
      if (wRatio < 0.25) hitDx += Math.sin(now / 45 + j) * 1.5;
      // Afterimages trail behind the falling enemy
      if (b.introStart && estyle === 'drop' && introQ < 0.364) {
        var baseA = ctx.globalAlpha;
        for (var gh = 1; gh <= 2; gh++) {
          ctx.save();
          ctx.globalAlpha = baseA * 0.22 / gh;
          ctx.translate(ex, footY + lungeDy);
          ctx.scale(lungeK * introSX, lungeK * introSY);
          ctx.translate(-ex, -footY);
          UI.drawEnemy(ctx, en, ex, ey - gh * 28, scale);
          ctx.restore();
        }
      }
      // Charge trail: fading copies at the positions the enemy just left
      if (atkFx && atkFx.idx === aliveEnemies[j].index) {
        var tat = (now - atkFx.t0) / atkFx.dur;
        if (tat >= 0.3 && tat < 0.7 && atkFx.style !== 'hop' && atkFx.style !== 'dive') {
          for (var tg2 = 1; tg2 <= 3; tg2++) {
            var pa = this.atkCurve(tat - tg2 * 0.035);
            ctx.save();
            ctx.globalAlpha = 0.3 / tg2;
            ctx.translate(ex, footY + 56 * pa);
            ctx.scale(1 + 0.45 * pa, 1 + 0.45 * pa);
            ctx.translate(-ex, -footY);
            UI.drawEnemy(ctx, en, ex, ey, scale);
            ctx.restore();
          }
        }
      }
      ctx.save();
      if (hitBright) ctx.filter = 'brightness(5)';
      ctx.translate(ex + hitDx + introDx + atkDx, footY + lungeDy);
      ctx.scale(lungeK * introSX * atkSX, lungeK * introSY * atkSY);
      if (introRot || atkRot) ctx.rotate(introRot + atkRot);
      ctx.translate(-ex, -footY);
      if (estyle === 'rise' && riseQ < 1) {                   // hide the part still below the floor
        ctx.beginPath();
        ctx.rect(ex - 90 * scale, footY - 140 * scale, 180 * scale, 142 * scale);
        ctx.clip();
      }
      UI.drawEnemy(ctx, en, ex, ey, scale);
      ctx.restore();

      // Eyes flare as the enemy takes its stance after landing
      if (en.landAt) {
        var eyT = now - en.landAt;
        var eyes = this.EYE_TABLE[en.shape];
        if (eyes && eyT > 100 && eyT < 900) {
          var eyA = Math.sin(Math.PI * (eyT - 100) / 800);
          var eyRgb = en.shape === 'mage' ? '255,255,120' : (en.shape === 'slime' ? '255,255,255' : '255,70,70');
          for (var eyi = 0; eyi < eyes.length; eyi++) {
            var eyx = ex + eyes[eyi][0] * scale, eyy = ey + eyes[eyi][1] * scale;
            var eyg = ctx.createRadialGradient(eyx, eyy, 0, eyx, eyy, 17 * scale);
            eyg.addColorStop(0, 'rgba(255,255,255,' + eyA + ')');
            eyg.addColorStop(0.3, 'rgba(' + eyRgb + ',' + (0.9 * eyA) + ')');
            eyg.addColorStop(1, 'rgba(' + eyRgb + ',0)');
            ctx.fillStyle = eyg;
            ctx.fillRect(eyx - 18 * scale, eyy - 18 * scale, 36 * scale, 36 * scale);
          }
        }
      }

      // Wounded look: scratches below half HP, rising smoke below a quarter
      if (wRatio < 0.5 && !en.boss) {
        ctx.save();
        ctx.strokeStyle = 'rgba(25,10,25,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - 14 * scale, ey - 18 * scale);
        ctx.lineTo(ex - 6 * scale, ey - 8 * scale);
        ctx.lineTo(ex - 8 * scale, ey - 2 * scale);
        ctx.lineTo(ex + 4 * scale, ey + 6 * scale);
        ctx.moveTo(ex + 10 * scale, ey - 12 * scale);
        ctx.lineTo(ex + 3 * scale, ey);
        ctx.lineTo(ex + 6 * scale, ey + 8 * scale);
        ctx.stroke();
        ctx.restore();
      }
      if (wRatio < 0.25) {
        for (var sm = 0; sm < 4; sm++) {
          var smp = (now / 900 + sm / 4) % 1;
          ctx.fillStyle = 'rgba(90,90,100,' + (0.35 * (1 - smp)) + ')';
          ctx.beginPath();
          ctx.arc(ex + (this.fxRnd(sm + 3000 + j) - 0.5) * 20 * scale + Math.sin(smp * 6 + sm) * 4,
                  ey - 30 * scale - smp * 35 * scale, (4 + smp * 8) * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Debris chips of the enemy's own colour fly off on every hit
      if (hitT >= 0 && hitT < 450) {
        var dq = hitT / 450, dn = 6 + Math.round((en.hitMag || 0.5) * 6);
        ctx.save();
        ctx.fillStyle = en.color;
        ctx.globalAlpha = 1 - dq;
        for (var dc = 0; dc < dn; dc++) {
          var dang = -Math.PI * this.fxRnd(dc + 3100 + Math.floor(en.hitAt / 50));
          var dsp = (50 + this.fxRnd(dc + 3200) * 90) * scale;
          var dsz = 3 + this.fxRnd(dc + 3300) * 3;
          ctx.fillRect(ex + Math.cos(dang) * dsp * dq - dsz / 2, ey + Math.sin(dang) * dsp * dq + 130 * scale * dq * dq - dsz / 2, dsz, dsz);
        }
        ctx.restore();
      }

      // Elemental hit: burning, freezing or electrocution lingers for ~0.9s
      var eT = en.hitAt ? now - en.hitAt : -1;
      if (en.hitKind && eT >= 0 && eT < 900) {
        var efade = 1 - eT / 900;
        ctx.save();
        if (en.hitKind === 'fire') {
          var fgl = ctx.createRadialGradient(ex, ey, 2, ex, ey, 42 * scale);
          fgl.addColorStop(0, 'rgba(255,170,50,' + (0.55 * efade) + ')');
          fgl.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = fgl;
          ctx.fillRect(ex - 44 * scale, ey - 44 * scale, 88 * scale, 88 * scale);
          for (var fk = 0; fk < 10; fk++) {
            var fph = (eT / 500 + this.fxRnd(fk + 3400)) % 1;
            ctx.globalAlpha = efade * (1 - fph);
            ctx.fillStyle = fk % 2 ? '#ffd23a' : '#ff6a1f';
            var fsz = (4 + this.fxRnd(fk + 3500) * 4) * (1 - fph * 0.5);
            ctx.fillRect(ex + (this.fxRnd(fk + 3600) - 0.5) * 40 * scale, ey + 12 * scale - fph * 55 * scale, fsz, fsz);
          }
        } else if (en.hitKind === 'ice') {
          ctx.fillStyle = 'rgba(150,210,255,' + (0.35 * efade) + ')';
          ctx.beginPath();
          ctx.ellipse(ex, ey, 28 * scale, 34 * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(215,242,255,' + (0.85 * efade) + ')';
          for (var ik = 0; ik < 6; ik++) {
            var ia = ik / 6 * Math.PI * 2 + 0.3, ir = 26 * scale;
            var ix = ex + Math.cos(ia) * ir, iy = ey + Math.sin(ia) * ir * 1.1;
            ctx.beginPath();
            ctx.moveTo(ix + Math.cos(ia) * 12 * scale, iy + Math.sin(ia) * 12 * scale);
            ctx.lineTo(ix + Math.cos(ia + 1.9) * 4 * scale, iy + Math.sin(ia + 1.9) * 4 * scale);
            ctx.lineTo(ix + Math.cos(ia - 1.9) * 4 * scale, iy + Math.sin(ia - 1.9) * 4 * scale);
            ctx.closePath();
            ctx.fill();
          }
        } else if (en.hitKind === 'thunder') {
          var tseed = Math.floor(now / 70);
          ctx.strokeStyle = '#fff6a0';
          ctx.shadowColor = '#ffe44a';
          ctx.shadowBlur = 10;
          ctx.lineWidth = 2;
          ctx.globalAlpha = efade;
          for (var tk = 0; tk < 3; tk++) {
            ctx.beginPath();
            var tx0 = ex + (this.fxRnd(tseed * 3 + tk + 3700) - 0.5) * 50 * scale;
            ctx.moveTo(tx0, ey - 40 * scale);
            for (var tz = 1; tz <= 5; tz++) {
              ctx.lineTo(tx0 + (this.fxRnd(tseed * 7 + tk * 5 + tz + 3800) - 0.5) * 26 * scale, ey - 40 * scale + tz * 16 * scale);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Impact sparks radiating from the hit point
      if (hitT >= 0 && hitT < 320) {
        var sp = hitT / 320;
        ctx.save();
        ctx.globalAlpha = 1 - sp;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#fff6b0';
        ctx.shadowColor = '#ffb300';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3 * (1 - sp) + 1;
        var spk = 6 + Math.round((en.hitMag || 0.5) * 6);
        ctx.beginPath();
        for (var si2 = 0; si2 < spk; si2++) {
          var sang = this.fxRnd(si2 * 3 + aliveEnemies[j].index * 17 + Math.floor(en.hitAt / 50)) * Math.PI * 2;
          var r0 = (10 + sp * 26) * scale, r1 = r0 + (14 - sp * 8) * scale;
          ctx.moveTo(ex + Math.cos(sang) * r0, ey + Math.sin(sang) * r0);
          ctx.lineTo(ex + Math.cos(sang) * r1, ey + Math.sin(sang) * r1);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Atmospheric fog on distant enemies
      if (back) {
        ctx.fillStyle = 'rgba(30,30,60,0.18)';
        ctx.fillRect(ex - 45 * scale, ey - 55 * scale, 90 * scale, 90 * scale);
      }

      ctx.globalAlpha = 1;

      // Name plate fades in under each regular enemy after it lands
      if (b.introStart && !en.boss && en.landAt) {
        var nt = now - en.landAt;
        if (nt > 150 && nt < 1700) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, (nt - 150) / 200) * (nt > 1300 ? 1 - (nt - 1300) / 400 : 1);
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineJoin = 'round';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#000';
          ctx.strokeText(en.name, ex, footY + 20);
          ctx.fillStyle = '#fff';
          ctx.fillText(en.name, ex, footY + 20);
          ctx.restore();
        }
      }

      // Enemy HP bar: appears when hit; the pale trail lags behind the real value
      if (en.hpShown === undefined) en.hpShown = en.maxHp;
      en.hpShown += (en.hp - en.hpShown) * 0.1;
      var barUntil = Math.max(en.hitAt ? en.hitAt + 2600 : 0, en.hpBarUntil || 0);
      if (now < barUntil) {
        var bw2 = 56 * scale, bx = ex - bw2 / 2, by = footY + 8;
        var fade2 = barUntil - now < 400 ? (barUntil - now) / 400 : 1;
        var ratio = Math.max(0, en.hp / en.maxHp), trail = Math.max(0, en.hpShown / en.maxHp);
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade2);
        ctx.fillStyle = '#000';
        ctx.fillRect(bx - 1, by - 1, bw2 + 2, 7);
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(bx, by, bw2 * trail, 5);
        ctx.fillStyle = ratio > 0.5 ? '#4ade50' : (ratio > 0.25 ? '#ffd23a' : '#ff4a3a');
        ctx.fillRect(bx, by, bw2 * ratio, 5);
        ctx.restore();
      }

      // Target cursor
      if (b.phase === 'targeting' && j === b.targetIndex) {
        var cy0 = ey - 50 * scale - 20 + Math.sin(now / 150) * 3;
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(ex, cy0);
        ctx.lineTo(ex - 8, cy0 - 12);
        ctx.lineTo(ex + 8, cy0 - 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    this.renderDeaths(ctx, game, now);
    this.renderEffect(ctx, game, canvasW, canvasH, now);

    // Vignette for depth/cinematic feel
    var vg = ctx.createRadialGradient(canvasW / 2, canvasH * 0.45, canvasH * 0.3, canvasW / 2, canvasH * 0.45, canvasW * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);
    ctx.restore();

    // Victory scene (drawn under the message windows)
    if (b.phase === 'win' && b.winStart) {
      this.renderVictory(ctx, canvasW, canvasH, now - b.winStart);
    }

    // Boss entrance cinematic: letterbox bars, gloom, lightning, name banner
    if (b.bossIntro && b.introStart) {
      var bossName = '';
      for (var bi = 0; bi < b.enemies.length; bi++) { if (b.enemies[bi].boss) { bossName = b.enemies[bi].name; break; } }
      this.renderBossIntro(ctx, canvasW, canvasH, now - b.introStart, b.bossLandAt ? now - b.bossLandAt : -1, bossName);
    }

    // Getaway scene: speed lines, dust trail, then the screen irises shut
    if (b.escapeStart) {
      this.renderEscape(ctx, canvasW, canvasH, now - b.escapeStart, game);
    }

    // Encounter warning: the screen edges flash red twice as the fight begins (boss fights have their own)
    if (b.introStart && !b.bossIntro) {
      var wt0 = now - b.introStart;
      if (wt0 < 700) {
        var wa = Math.max(0, Math.sin(wt0 / 350 * Math.PI * 2)) * 0.4;
        var wvg = ctx.createRadialGradient(canvasW / 2, canvasH * 0.45, canvasH * 0.3, canvasW / 2, canvasH * 0.45, canvasW * 0.65);
        wvg.addColorStop(0, 'rgba(255,0,0,0)');
        wvg.addColorStop(1, 'rgba(255,0,0,' + wa + ')');
        ctx.fillStyle = wvg;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }
    }

    // Battle-start iris wipe: black closes in, then opens from the centre
    var wipeT = (now - (b.introStart || 0)) / 500;
    if (b.introStart && wipeT < 1) {
      var maxR = Math.sqrt(canvasW * canvasW + canvasH * canvasH) / 2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.rect(0, 0, canvasW, canvasH);
      ctx.arc(canvasW / 2, canvasH * 0.45, maxR * Math.max(0, wipeT), 0, Math.PI * 2, true);   // (never negative, even if the clock steps back)
      ctx.fill('evenodd');
    }

    // Party battle-ready: rings flare above each hero and a banner sweeps across the screen
    if (b.introStart && !b.bossIntro) {
      var rt0 = now - b.introStart - 500;
      if (rt0 > 0 && rt0 < 1300) {
        if (!b.readySfx) { b.readySfx = true; SoundSystem.battleReady(); }
        var pcol = ['106,176,255', '255,122,192', '109,255,176'];
        for (var ri = 0; ri < game.party.length; ri++) {
          var rq = Math.min(1, Math.max(0, (rt0 - ri * 90) / 600));
          if (rq <= 0 || rq >= 1) continue;
          var rcx = canvasW - 250 + ri * 48, rcy = canvasH - 238;
          ctx.strokeStyle = 'rgba(' + pcol[ri % 3] + ',' + (1 - rq) + ')';
          ctx.lineWidth = 4 * (1 - rq) + 1;
          ctx.beginPath(); ctx.ellipse(rcx, rcy + 22, 8 + rq * 36, 3 + rq * 11, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1 - rq;
          ctx.fillStyle = 'rgb(' + pcol[ri % 3] + ')';
          ctx.fillRect(rcx - 2, rcy + 20 - rq * 60, 4, 14);
          ctx.globalAlpha = 1;
        }
        var bq = rt0 / 1300;
        var bxp = bq < 0.2 ? canvasW + 200 - (bq / 0.2) * (canvasW / 2 + 200) : (bq < 0.75 ? canvasW / 2 - (bq - 0.2) * 40 : canvasW / 2 - 22 - ((bq - 0.75) / 0.25) * (canvasW + 200));
        ctx.save();
        ctx.globalAlpha = Math.min(1, bq * 8) * (1 - Math.max(0, bq - 0.9) / 0.1);
        ctx.fillStyle = 'rgba(10,20,60,0.55)';
        ctx.fillRect(0, canvasH * 0.18, canvasW, 44);
        ctx.font = 'italic bold 30px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#102a5a';
        ctx.fillStyle = '#fff6c0';
        ctx.strokeText('いざ、たたかいだ！', bxp, canvasH * 0.18 + 22);
        ctx.fillText('いざ、たたかいだ！', bxp, canvasH * 0.18 + 22);
        ctx.restore();
      }
    }

    // Party wipe: the colour drains out, a dark red vignette closes in, cracks spread and ash falls
    if (b.phase === 'lose' && b.loseStart) {
      var lt2 = now - b.loseStart;
      var lq = Math.min(1, lt2 / 1200);
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = lq;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(30,0,6,' + (0.5 * lq) + ')';
      ctx.fillRect(0, 0, canvasW, canvasH);
      var lvg = ctx.createRadialGradient(canvasW / 2, canvasH * 0.45, canvasH * (0.55 - 0.3 * lq), canvasW / 2, canvasH * 0.45, canvasW * 0.7);
      lvg.addColorStop(0, 'rgba(0,0,0,0)');
      lvg.addColorStop(1, 'rgba(0,0,0,' + (0.85 * lq) + ')');
      ctx.fillStyle = lvg;
      ctx.fillRect(0, 0, canvasW, canvasH);
      // cracks spreading from the centre
      if (lt2 > 150) {
        var ck = Math.min(1, (lt2 - 150) / 600);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - 0.4 * ck)) + ')';
        ctx.lineWidth = 1.5;
        for (var cki = 0; cki < 6; cki++) {
          var cang = cki / 6 * Math.PI * 2 + 0.3;
          var cx0 = canvasW / 2, cy0 = canvasH * 0.45;
          ctx.beginPath();
          ctx.moveTo(cx0, cy0);
          for (var cj = 1; cj <= 6; cj++) {
            var cr = cj * 55 * ck;
            var jit = (this.fxRnd(cki * 10 + cj) - 0.5) * 0.5;
            ctx.lineTo(cx0 + Math.cos(cang + jit) * cr, cy0 + Math.sin(cang + jit) * cr * 0.8);
          }
          ctx.stroke();
        }
      }
      // falling ash
      for (var ai = 0; ai < 40; ai++) {
        var ap2 = ((lt2 / (3500 + (ai % 5) * 500)) + ai * 0.19) % 1;
        ctx.globalAlpha = lq * 0.6;
        ctx.fillStyle = ai % 6 === 0 ? '#ff7a3a' : '#bdbac8';
        ctx.fillRect((ai * 83) % canvasW + Math.sin(lt2 / 500 + ai) * 10, ap2 * canvasH, 2, 2);
      }
      ctx.globalAlpha = 1;
      // heavy title dropping in
      var ta = Math.min(1, Math.max(0, (lt2 - 400) / 700));
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(40,0,0,' + ta + ')';
      ctx.fillStyle = 'rgba(210,50,50,' + ta + ')';
      var ty2 = canvasH * 0.3 - (1 - ta) * 40 + (lt2 < 1000 ? Math.sin(lt2 / 25) * 2 * (1 - ta) : 0);
      ctx.strokeText('全 滅', canvasW / 2, ty2);
      ctx.fillText('全 滅', canvasW / 2, ty2);
      ctx.restore();
    }

    // Party status panel (right side): slides in from the edge as the battle begins
    ctx.save();
    var slideQ = b.introStart ? Math.min(1, (now - b.introStart) / 500) : 1;
    ctx.translate((1 - slideQ) * (1 - slideQ) * 240, 0);
    UI.drawWindow(ctx, canvasW - 220, canvasH - 200, 215, 120);
    for (var k = 0; k < game.party.length; k++) {
      var py = canvasH - 190 + k * 36;
      var px = canvasW - 206;
      var p = game.party[k];
      // The struck member's row flashes red and jolts sideways
      var ph = b.partyHit;
      if (ph && (ph.idx === k || ph.idx === -1)) {
        var jt = now - ph.t0;
        if (jt >= 0 && jt < 380) {
          px += Math.sin(jt / 22) * 5 * (1 - jt / 380);
          ctx.fillStyle = 'rgba(' + (ph.tint || '255,0,0') + ',' + (0.3 * (1 - jt / 380)) + ')';
          ctx.fillRect(canvasW - 216, py - 6, 207, 34);
        }
      }
      var nameColor = p.alive ? '#fff' : '#888';
      if (p.alive && p.poisoned) nameColor = '#d08aff';
      if (b.flashParty === k) nameColor = '#f44';

      // Animated gauges: the main bar follows the real value quickly, a pale "ghost" bar lags behind
      // on damage, and a green sweep marks healing
      if (p.hpShown === undefined) { p.hpShown = p.hp; p.hpGhost = p.hp; p.mpShown = p.mp; p.hpLast = p.hp; }
      if (p.hp > p.hpLast) p.healAt = now;
      p.hpLast = p.hp;
      var ft = Math.min(0.5, (now - (b.panelT || now)) / 1000);
      p.hpShown += (p.hp - p.hpShown) * Math.min(1, ft * 9);
      if (Math.abs(p.hp - p.hpShown) < 0.3) p.hpShown = p.hp;
      if (p.hpGhost > p.hpShown) p.hpGhost = Math.max(p.hpShown, p.hpGhost - p.maxHp * ft * 0.35);
      else p.hpGhost = p.hpShown;
      p.mpShown += (p.mp - p.mpShown) * Math.min(1, ft * 9);
      if (Math.abs(p.mp - p.mpShown) < 0.3) p.mpShown = p.mp;
      var hpR = p.maxHp ? Math.max(0, Math.min(1, p.hpShown / p.maxHp)) : 0;
      var ghR = p.maxHp ? Math.max(0, Math.min(1, p.hpGhost / p.maxHp)) : 0;
      var mpR = p.maxMp ? Math.max(0, Math.min(1, p.mpShown / p.maxMp)) : 0;
      var low = p.alive && p.hp <= p.maxHp * 0.25;
      var pulse = 0.55 + 0.45 * Math.sin(now / 140);

      // Whose turn it is: gold frame and a bobbing marker
      if (b.phase === 'command' && b.currentChar === k && p.alive) {
        ctx.strokeStyle = 'rgba(255,215,0,' + (0.55 + 0.35 * Math.sin(now / 160)) + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvasW - 216, py - 5, 207, 35);
        ctx.fillStyle = '#ffd700';
        var mx = canvasW - 224 + Math.sin(now / 130) * 2;
        ctx.beginPath(); ctx.moveTo(mx, py + 8); ctx.lineTo(mx - 7, py + 2); ctx.lineTo(mx - 7, py + 14); ctx.closePath(); ctx.fill();
      }
      // Danger: the frame blinks red when HP is critical
      if (low) {
        ctx.strokeStyle = 'rgba(255,40,40,' + (0.25 + 0.5 * pulse) + ')';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(canvasW - 216, py - 5, 207, 35);
      }

      // Limit gauge label: ひっさつ when full, れんけい when this member and a combo partner are both past COMBO_GAUGE
      var comboOk = p.alive && p.limit >= COMBO_GAUGE && game.party.some(function(o) { return o !== p && o.alive && o.limit >= COMBO_GAUGE && COMBOS.some(function(cb) { return cb.pair.indexOf(p.classId) >= 0 && cb.pair.indexOf(o.classId) >= 0; }); });
      var lblShown = p.alive && p.limit !== undefined && (p.limit >= 100 || comboOk);
      var shownHp = Math.round(p.hpShown), shownMp = Math.round(p.mpShown);
      UI.drawText(ctx, p.name, px, py, nameColor, UI.FONT_SMALL);
      UI.drawText(ctx, 'HP ' + shownHp + '/' + p.maxHp, px + 72, py, low ? '#f66' : '#fff', UI.FONT_SMALL);
      if (p.alive) UI.drawText(ctx, 'MP ' + shownMp + '/' + p.maxMp, px + 72, py + 17, '#aaf', UI.FONT_SMALL);
      if (p.alive && p.poisoned) UI.drawText(ctx, '毒', lblShown ? px + 54 : px, py + 17, '#d08aff', UI.FONT_SMALL);   // beside the ひっさつ / れんけい label when one shows

      // HP gauge (track, ghost, main, heal sweep)
      var gx = px + 72, gw = 122, gy = py + 14;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(gx, gy, gw, 4);
      ctx.fillStyle = 'rgba(255,230,230,0.75)';
      ctx.fillRect(gx, gy, gw * ghR, 4);
      ctx.fillStyle = hpR > 0.5 ? '#4ade6a' : (hpR > 0.25 ? '#ffd84a' : 'rgba(255,60,60,' + (0.6 + 0.4 * pulse) + ')');
      ctx.fillRect(gx, gy, gw * hpR, 4);
      var hs = now - (p.healAt || 0);
      if (hs >= 0 && hs < 600) {
        var sx2 = gx + gw * (hs / 600);
        ctx.fillStyle = 'rgba(210,255,225,' + (1 - hs / 600) + ')';
        ctx.fillRect(sx2 - 8, gy - 1, 16, 6);
      }
      // Limit gauge: a thin gold bar below the MP bar; it pulses once full
      if (p.alive && p.limit !== undefined) {
        var lr = Math.max(0, Math.min(1, p.limit / 100)), full = lr >= 1;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(px, py + 30, 62, 3);                                  // under the name, clear of the buff badges
        ctx.fillStyle = full ? 'rgba(255,' + Math.round(200 + 55 * Math.sin(now / 110)) + ',60,1)' : '#c9a020';
        ctx.fillRect(px, py + 30, 62 * lr, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(px + 62 * COMBO_GAUGE / 100, py + 29, 1, 5);                // the mark above which a combo is possible
        if (full) UI.drawText(ctx, 'ひっさつ', px, py + 17, '#ffd700', UI.FONT_SMALL);
        else if (comboOk) UI.drawText(ctx, 'れんけい', px, py + 17, '#8ef', UI.FONT_SMALL);
      }
      // MP gauge
      var gy2 = py + 31;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(gx, gy2, gw, 3);
      ctx.fillStyle = '#5a9cff';
      ctx.fillRect(gx, gy2, gw * (p.alive ? mpR : 0), 3);

      // Active buffs: small badges with the turns left
      if (p.alive && p.buffs) {
        var bxo = px + 122;
        var kinds = [['atk', '攻', '#ff8a3c'], ['def', '防', '#5aa8ff'], ['int', '魔', '#7ae6ff']];
        for (var bk = 0; bk < kinds.length; bk++) {
          var bf = p.buffs[kinds[bk][0]];
          if (!bf) continue;
          var bbx = bxo + bk * 26;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(bbx, py + 17, 26, 12);
          ctx.strokeStyle = kinds[bk][2];
          ctx.lineWidth = 1;
          ctx.strokeRect(bbx + 0.5, py + 17.5, 25, 11);
          ctx.fillStyle = kinds[bk][2];
          ctx.font = 'bold 10px monospace';
          ctx.textBaseline = 'top';
          ctx.fillText(kinds[bk][1] + '↑' + bf.turns, bbx + 2, py + 18);
        }
      }
      // Fallen members: greyed out with a tag
      if (!p.alive) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(canvasW - 216, py - 5, 207, 35);
        UI.drawText(ctx, '戦闘不能', px + 72, py + 17, '#f66', UI.FONT_SMALL);
      }
    }
    b.panelT = now;
    if (b.phase === 'lose' && b.loseStart) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.5 * Math.min(1, (now - b.loseStart) / 1200)) + ')';
      ctx.fillRect(canvasW - 220, canvasH - 200, 215, 120);
    }
    ctx.restore();

    // Command menu (during command phase)
    if (b.phase === 'command' && b.currentChar < game.party.length) {
      var charName = game.party[b.currentChar].name;
      UI.drawWindow(ctx, 10, canvasH - 200, 160, 30);
      UI.drawText(ctx, charName + 'の ばん', 22, canvasH - 192);
      var limReady = (game.party[b.currentChar].limit || 0) >= 100;
      UI.drawMenu(ctx, 10, canvasH - 166, 160,
        ['たたかう', limReady ? '★ じゅもん' : 'じゅもん', 'どうぐ', 'ぼうぎょ', 'にげる'],
        b.commandIndex);
    }

    // Spell selection
    if (b.phase === 'spellSelect' && b.currentChar < game.party.length) {
      var spells = this.getAvailableSpells(game.party[b.currentChar], game);
      var spellNames = spells.map(function(s) {
        var sp = SPELLS[s.id];
        return sp.combo ? '★★ ' + sp.name : sp.limit ? '★ ' + sp.name : sp.name + ' ' + sp.mp + 'MP';
      });
      // The list scrolls (6 rows): Dario's six spells plus the limit skill would run off the screen
      var SPELL_ROWS = 6;
      var spTop = Math.max(0, Math.min(b.spellIndex - SPELL_ROWS + 1, spellNames.length - SPELL_ROWS));
      if (b.spellIndex < spTop) spTop = b.spellIndex;
      UI.drawMenu(ctx, 10, canvasH - 200, 220, spellNames.slice(spTop, spTop + SPELL_ROWS), b.spellIndex - spTop);
      if (spTop > 0) UI.drawText(ctx, '▲', 200, canvasH - 196, '#ffd700', UI.FONT_SMALL);
      if (spTop + SPELL_ROWS < spellNames.length) UI.drawText(ctx, '▼', 200, canvasH - 28, '#ffd700', UI.FONT_SMALL);
    }

    // Ally target selection
    if (b.phase === 'allyTarget') {
      UI.drawWindow(ctx, 10, canvasH - 200, 180, game.party.length * 26 + 20);
      UI.drawText(ctx, 'だれに？', 22, canvasH - 192, '#ffd700');
      for (var at = 0; at < game.party.length; at++) {
        var aty = canvasH - 166 + at * 26;
        if (at === b.targetIndex) UI.drawText(ctx, UI.CURSOR, 22, aty);
        var atColor = game.party[at].alive ? '#fff' : '#888';
        UI.drawText(ctx, game.party[at].name + ' HP' + game.party[at].hp + '/' + game.party[at].maxHp, 44, aty, atColor, UI.FONT_SMALL);
      }
    }

    // Item selection
    if (b.phase === 'itemSelect') {
      // The list scrolls: more than ITEM_ROWS kinds used to run off the bottom of the screen
      var itemNames = game.inventory.map(function(inv) {
        return ITEMS[inv.id].name + ' x' + inv.count;
      });
      var ITEM_ROWS = 6;
      var itemTop = Math.max(0, Math.min(b.itemIndex - ITEM_ROWS + 1, itemNames.length - ITEM_ROWS));
      if (b.itemIndex < itemTop) itemTop = b.itemIndex;
      var shown = itemNames.slice(itemTop, itemTop + ITEM_ROWS);
      UI.drawMenu(ctx, 10, canvasH - 200, 230, shown, b.itemIndex - itemTop);
      if (itemTop > 0) UI.drawText(ctx, '▲', 210, canvasH - 196, '#ffd700', UI.FONT_SMALL);
      if (itemTop + ITEM_ROWS < itemNames.length) UI.drawText(ctx, '▼', 210, canvasH - 28, '#ffd700', UI.FONT_SMALL);
    }

    // Message window. While a command menu is open the window would cover its lower rows (ぼうぎょ / にげる), so
    // there it only shows short-lived feedback (messageTimer > 0), never the previous turn's leftover lines
    var menuPhase = b.phase === 'command' || b.phase === 'spellSelect' || b.phase === 'itemSelect' || b.phase === 'allyTarget';
    if (b.messages.length > 0 && !(menuPhase && b.messageTimer <= 0)) {
      UI.drawMessageWindow(ctx, b.messages, canvasW, canvasH);
    }

    if (b.critFlashAt) {
      var cft = Date.now() - b.critFlashAt;
      if (cft >= 0 && cft < 220) {
        ctx.fillStyle = 'rgba(255,255,255,' + (0.38 * (1 - cft / 220)) + ')';
        ctx.fillRect(0, 0, canvasW, canvasH);
      }
    }
    this.renderEnemyCastLate(ctx, game, canvasW, canvasH, Date.now());
    this.renderPartyHit(ctx, game, canvasW, canvasH, Date.now());
    this.renderPops(ctx, game, canvasW, canvasH, Date.now());

    // Level up display (animated)
    if (b.phase === 'levelup' && b.levelUpIndex < b.levelUps.length) {
      if (b.luShown !== b.levelUpIndex) { b.luShown = b.levelUpIndex; b.luStart = Date.now(); }
      var luChar = null;
      for (var lc = 0; lc < game.party.length; lc++) {
        if (game.party[lc].name === b.levelUps[b.levelUpIndex].name) luChar = game.party[lc];
      }
      this.renderLevelUp(ctx, b.levelUps[b.levelUpIndex], canvasW, canvasH, Date.now() - b.luStart, luChar && luChar.color);
    }
    if (game.arena) {                                                   // which round of the arena run this is
      var ac = ArenaSystem.course(game.arena.id);
      UI.drawWindow(ctx, canvasW / 2 - 130, 6, 260, 30);
      UI.drawText(ctx, '闘技場  ' + ac.name + '  ' + Math.min(game.arena.round + 1, ArenaSystem.ROUNDS) + '/' + ArenaSystem.ROUNDS, canvasW / 2 - 116, 12, '#ffd700', UI.FONT_SMALL);
    }
    if (game.towerRun) {                                                // which floor of the tower this is
      UI.drawWindow(ctx, canvasW / 2 - 90, 6, 180, 30);
      UI.drawText(ctx, '深淵の塔  ' + game.towerRun.floor + 'F / ' + TOWER.floors + 'F', canvasW / 2 - 76, 12, '#ffd700', UI.FONT_SMALL);
    }
    this.renderBossVictory(ctx, game, canvasW, canvasH, Date.now());
  },
});
