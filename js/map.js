// ============================================================
// map.js — Map rendering and player movement
// ============================================================

var MapSystem = {
  VIEWPORT_W: 20,
  VIEWPORT_H: 15,

  // Render the current map with viewport scrolling
  render: function(ctx, game) {
    var map = MAPS[game.currentMap];
    if (!map) return;
    var ts = UI.TILE_SIZE;
    var vpW = this.VIEWPORT_W;
    var vpH = this.VIEWPORT_H;

    // Encounter transition: the whole scene shakes and zooms toward the party
    var efx = game.encounterFx;
    var et = efx ? Math.min(1, (Date.now() - efx.t0) / efx.dur) : -1;
    if (efx) {
      ctx.save();
      var ez = 1 + 0.22 * et * et;
      var ecx = vpW * ts / 2, ecy = vpH * ts / 2;
      var sk = SettingsSystem.get('shake') ? 1 : 0;
      ctx.translate(ecx + (Math.random() - 0.5) * 6 * et * sk, ecy + (Math.random() - 0.5) * 6 * et * sk);
      ctx.rotate(Math.sin(et * 9) * 0.015 * et * sk);
      ctx.scale(ez, ez);
      ctx.translate(-ecx, -ecy);
    }

    // Smooth movement: the player (and the followers behind) glide from the previous tile
    var now = Date.now();
    // A trail or glide recorded on another map must not leak into this one
    if (game.trailMap !== game.currentMap) { game.trail = []; game.moveAnim = null; game.stepFx = []; game.trailMap = game.currentMap; }
    var ma = game.moveAnim;
    var mp = ma ? Math.min(1, (now - ma.t0) / (ma.dur || 110)) : 1;   // dashing glides faster
    var mpe = 1 - Math.pow(1 - mp, 2);              // ease-out
    var drawPX = ma ? ma.fx + (game.playerX - ma.fx) * mpe : game.playerX;
    var drawPY = ma ? ma.fy + (game.playerY - ma.fy) * mpe : game.playerY;

    // Camera follows the interpolated position (fractional scroll)
    var camXf = drawPX - Math.floor(vpW / 2);
    var camYf = drawPY - Math.floor(vpH / 2);
    camXf = Math.max(0, Math.min(camXf, map.width - vpW));
    camYf = Math.max(0, Math.min(camYf, map.height - vpH));
    var camX = camXf, camY = camYf;
    var ix = Math.floor(camXf), iy = Math.floor(camYf);
    var offX = (camXf - ix) * ts, offY = (camYf - iy) * ts;

    // Draw tiles (one extra row/column so the fractional scroll never shows a gap)
    for (var ty = 0; ty <= vpH; ty++) {
      for (var tx = 0; tx <= vpW; tx++) {
        var mx = ix + tx;
        var my = iy + ty;
        var px = tx * ts - offX;
        var py = ty * ts - offY;
        if (mx >= 0 && mx < map.width && my >= 0 && my < map.height) {
          var ch = map.tiles[my][mx];
          UI.drawTile(ctx, ch, px, py, ts);
          AmbienceSystem.tileAnim(ctx, ch, px, py, ts, now, mx, my);
          // Draw chest events
          var key = mx + ',' + my;
          var ev = map.events[key];
          if (ev && ev.type === 'chest') {
            var opened = game.flags[ev.flag];
            UI.drawChest(ctx, px, py, ts, opened);
          }
          // Draw map transfer markers (town/dungeon entrances on world map)
          if (ev && ev.type === 'mapTransfer' && game.currentMap === 'world' && !(ev.requires && !game.flags[ev.requires])) {
            this.drawMapMarker(ctx, px, py, ts, ev.desc);
          }
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(px, py, ts, ts);
        }
      }
    }

    // Footsteps: little kicked-up puffs and a fading footprint on the tile just left
    this.renderSteps(ctx, game, camX, camY, ts, now);

    // Draw NPCs
    if (map.npcs) {
      for (var i = 0; i < map.npcs.length; i++) {
        var npc = map.npcs[i];
        var np = AmbienceSystem.npcPos(npc, now, i);      // wandering NPCs glide between tiles
        var sx = (np.x - camX) * ts;
        var sy = (np.y - camY) * ts;
        if (sx >= -ts && sx < vpW * ts + ts && sy >= -ts && sy < vpH * ts + ts) {
          if (npc.wander) {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts - 6, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
          }
          UI.drawNPC(ctx, npc, sx, sy + np.bob, ts);
        }
      }
    }

    // Party train: Dario and Sundar follow in Sam's footsteps along his path
    var path = [{ x: game.playerX, y: game.playerY }].concat(game.trail || []);
    var lastKnown = path[path.length - 1];
    while (path.length < 4) path.push(lastKnown);
    var walking = mp < 1;
    var followers = [{ k: 2, body: '#44cc88', hair: '#22995e' }, { k: 1, body: '#cc4488', hair: '#992266' }];
    var drawn = [];
    for (var fi = 0; fi < followers.length; fi++) {
      var fk = followers[fi].k;
      var from = path[fk + 1], to = path[fk];
      var fxp = walking ? from.x + (to.x - from.x) * mpe : to.x;
      var fyp = walking ? from.y + (to.y - from.y) * mpe : to.y;
      if (Math.abs(fxp - drawPX) + Math.abs(fyp - drawPY) < 0.35) continue;   // still tucked in behind the leader
      drawn.push({ x: fxp, y: fyp, c: followers[fi], ph: fk * 0.9 });
    }
    var bobAt = function(ph) { return walking ? -Math.abs(Math.sin((mp + ph) * Math.PI)) * 3 : Math.sin(now / 520 + ph) * 0.8; };
    for (var di = 0; di < drawn.length; di++) {
      var dx0 = (drawn[di].x - camX) * ts, dy0 = (drawn[di].y - camY) * ts;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(dx0 + ts / 2, dy0 + ts - 6, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      UI.drawPlayer(ctx, dx0, dy0 + bobAt(drawn[di].ph), ts, game.facing, drawn[di].c);
    }

    // Draw player (leader): shadow, walking bob and a small squash on landing
    var playerScreenX = (drawPX - camX) * ts;
    var playerScreenY = (drawPY - camY) * ts;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(playerScreenX + ts / 2, playerScreenY + ts - 6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    UI.drawPlayer(ctx, playerScreenX, playerScreenY + bobAt(0), ts, game.facing);

    // Area atmosphere: light, weather, drifting life
    AmbienceSystem.renderOverlay(ctx, game, now, vpW * ts, vpH * ts);

    if (efx) {
      ctx.restore();
      this.renderEncounterFx(ctx, playerScreenX, playerScreenY, ts, et, vpW * ts, vpH * ts);
    }
  },

  // Encounter transition overlay: "!" popping over the leader, red flashes, a radial blur and the closing wipe
  renderEncounterFx: function(ctx, px, py, ts, t, w, h) {
    var i;
    ctx.save();
    // two red/white flashes
    var fl = Math.max(0, Math.sin(t * Math.PI * 4)) * 0.38 * (1 - t * 0.4);
    ctx.fillStyle = (Math.floor(t * 4) % 2 ? 'rgba(255,255,255,' : 'rgba(255,40,40,') + fl + ')';
    ctx.fillRect(0, 0, w, h);
    // radial speed lines rushing toward the camera
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 * t) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (i = 0; i < 24; i++) {
      var a = i / 24 * Math.PI * 2 + 0.2;
      var r0 = 60 + (1 - t) * 160, r1 = r0 + 40 + t * 180;
      ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0 * 0.75);
      ctx.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1 * 0.75);
    }
    ctx.stroke();
    // "!" over the leader
    if (t < 0.55) {
      var q = t / 0.55;
      var pop = q < 0.25 ? q / 0.25 * 1.4 : 1.4 - Math.min(0.4, (q - 0.25) * 0.8);
      ctx.save();
      ctx.translate(px + ts / 2, py - 14 - Math.sin(Math.min(1, q * 2) * Math.PI) * 8);
      ctx.scale(pop, pop);
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#4a0000';
      ctx.fillStyle = '#ff4040';
      ctx.strokeText('!', 0, 0);
      ctx.fillText('!', 0, 0);
      ctx.restore();
    }
    // closing wipe: horizontal blinds slide shut over the last stretch
    if (t > 0.62) {
      var wq = Math.min(1, (t - 0.62) / 0.38);
      var bh = h / 10;
      ctx.fillStyle = '#000';
      for (i = 0; i < 10; i++) {
        var lw = Math.min(1, wq * 1.6 - i * 0.06) * (w / 2 + 2);
        if (lw <= 0) continue;
        if (i % 2) { ctx.fillRect(0, i * bh, lw, bh + 1); ctx.fillRect(w - lw, i * bh, lw, bh + 1); }
        else { ctx.fillRect(0, i * bh, lw, bh + 1); ctx.fillRect(w - lw, i * bh, lw, bh + 1); }
      }
    }
    ctx.restore();
  },

  // Dust / grass / sand puffs and fading footprints behind the party
  renderSteps: function(ctx, game, camX, camY, ts, now) {
    var list = game.stepFx;
    if (!list || !list.length) return;
    var live = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      var t = (now - f.t0) / 520;
      if (t >= 1) continue;
      live.push(f);
      if (t < 0) continue;
      var sx = (f.x - camX) * ts + ts / 2, sy = (f.y - camY) * ts + ts - 6;
      var col = { G: '#8fd05a', F: '#4f8a38', S: '#ead9a0', R: '#d8c294', D: '#7a6ab0' }[f.tile] || '#c8c0b0';
      // footprint
      ctx.fillStyle = 'rgba(0,0,0,' + (0.18 * (1 - t)) + ')';
      ctx.beginPath(); ctx.ellipse(sx, sy + 1, 6 * (1 - t * 0.3), 2.5, 0, 0, Math.PI * 2); ctx.fill();
      // puffs
      for (var k = 0; k < 4; k++) {
        var a = (k - 1.5) * 0.7;
        var d = t * (7 + k * 2);
        ctx.globalAlpha = Math.max(0, 0.75 * (1 - t));
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sx + Math.sin(a) * d * 1.3, sy - t * 7 - Math.cos(a) * d * 0.4, 2.4 * (1 - t * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    game.stepFx = live;
  },

  // Draw marker for town/dungeon entrances on world map
  drawMapMarker: function(ctx, px, py, ts, desc) {
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(px + ts / 2, py + 2);
    ctx.lineTo(px + ts - 4, py + ts - 4);
    ctx.lineTo(px + 4, py + ts - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(px + ts / 2, py + 8);
    ctx.lineTo(px + ts - 8, py + ts - 6);
    ctx.lineTo(px + 8, py + ts - 6);
    ctx.closePath();
    ctx.fill();
  },

  // Move player and handle events
  movePlayer: function(game, dx, dy) {
    var map = MAPS[game.currentMap];
    var nx = game.playerX + dx;
    var ny = game.playerY + dy;

    // Update facing direction
    if (dx < 0) game.facing = 'left';
    else if (dx > 0) game.facing = 'right';
    else if (dy < 0) game.facing = 'up';
    else if (dy > 0) game.facing = 'down';

    // Bounds check
    if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) return false;

    // Tile collision check
    var tileChar = map.tiles[ny][nx];
    var tile = TILES[tileChar];
    if (!tile || !tile.passable) return false;

    // NPC collision check
    if (map.npcs) {
      for (var i = 0; i < map.npcs.length; i++) {
        if (map.npcs[i].x === nx && map.npcs[i].y === ny) return false;
      }
    }

    // Record the glide, the follower trail and a footstep before moving
    var oldX = game.playerX, oldY = game.playerY;
    if (game.trailMap !== game.currentMap) { game.trail = []; game.trailMap = game.currentMap; }
    game.trail = [{ x: oldX, y: oldY }].concat(game.trail || []).slice(0, 4);
    game.moveAnim = { fx: oldX, fy: oldY, t0: Date.now(), dur: game.dashing ? 70 : 110 };
    if (!game.stepFx) game.stepFx = [];
    game.stepFx.push({ x: oldX, y: oldY, tile: map.tiles[oldY][oldX], t0: Date.now() });
    if (game.stepFx.length > 8) game.stepFx.shift();
    if (typeof SoundSystem !== 'undefined' && SoundSystem.step) SoundSystem.step(tileChar);

    // Move
    game.playerX = nx;
    game.playerY = ny;
    game.steps++;

    // Check events at new position
    var eventKey = nx + ',' + ny;
    var ev = map.events[eventKey];
    if (ev) {
      this.handleEvent(game, ev);
      return true;
    }

    // Random encounter check
    if (tile.encounter && map.encounterRate > 0) {
      if (Math.random() < map.encounterRate) {
        this.triggerEncounter(game, map, tileChar);
      }
    }

    return true;
  },

  // Handle a map event
  handleEvent: function(game, ev) {
    switch (ev.type) {
      case 'mapTransfer':
        if (ev.requires && !game.flags[ev.requires]) break;   // a gate that only exists once its flag is set
        game.currentMap = ev.map;
        var targetMap = MAPS[ev.map];
        if (ev.targetX !== undefined) {
          game.playerX = ev.targetX;
          game.playerY = ev.targetY;
        } else {
          game.playerX = targetMap.playerStart.x;
          game.playerY = targetMap.playerStart.y;
        }
        game.state = 'mapTransition';
        game.transitionTimer = 30;
        break;
      case 'chest':
        if (!game.flags[ev.flag]) {
          game.flags[ev.flag] = true;
          SoundSystem.chest();
          if (ev.itemType === 'weapon') {
            this.giveEquipment(game, ev.item, 'weapon');
          } else if (ev.itemType === 'armor') {
            this.giveEquipment(game, ev.item, 'armor');
          } else {
            this.giveItem(game, ev.item, ev.count || 1);
          }
          game.dialogue = [ev.msg];
          game.dialogueIndex = 0;
          game.state = 'dialogue';
        }
        break;
      case 'boss':
        if (!game.flags[ev.flag]) {
          if (ev.preBattle) {
            game.dialogue = ev.preBattle;
            game.dialogueIndex = 0;
            game.state = 'dialogue';
            game.pendingBoss = ev;
          }
        }
        break;
    }
  },

  // Give item to inventory
  giveItem: function(game, itemId, count) {
    for (var i = 0; i < game.inventory.length; i++) {
      if (game.inventory[i].id === itemId) {
        game.inventory[i].count += count;
        return;
      }
    }
    game.inventory.push({ id: itemId, count: count });
  },

  // Give equipment to inventory
  giveEquipment: function(game, equipId, type) {
    game.equipInventory.push({ id: equipId, type: type });
  },

  // Trigger a random encounter
  triggerEncounter: function(game, map, tileChar) {
    var encounterType = 'grass';
    if (tileChar === 'F') encounterType = 'forest';
    else if (tileChar === 'D') encounterType = 'dark';

    var encounters = map.encounters[encounterType];
    if (!encounters || encounters.length === 0) return;

    // Weighted random selection
    var totalWeight = 0;
    for (var i = 0; i < encounters.length; i++) totalWeight += encounters[i].weight;
    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < encounters.length; j++) {
      cumulative += encounters[j].weight;
      if (roll <= cumulative) {
        // Encounter transition: "!" over the leader, a red flash, zoom-in and a closing wipe, then the battle starts
        game.encounterFx = { t0: Date.now(), dur: 750, enemies: encounters[j].enemies };
        if (typeof SoundSystem !== 'undefined' && SoundSystem.encounter) SoundSystem.encounter();
        return;
      }
    }
  },

  // Interact with NPC in front of player
  interact: function(game) {
    var map = MAPS[game.currentMap];
    if (!map || !map.npcs) return false;

    // Get tile in front of player
    var dx = 0, dy = 0;
    if (game.facing === 'left') dx = -1;
    else if (game.facing === 'right') dx = 1;
    else if (game.facing === 'up') dy = -1;
    else if (game.facing === 'down') dy = 1;
    var fx = game.playerX + dx;
    var fy = game.playerY + dy;

    // Check for NPC at that position
    for (var i = 0; i < map.npcs.length; i++) {
      var npc = map.npcs[i];
      if (npc.x === fx && npc.y === fy) {
        npc.dir = { left: 'right', right: 'left', up: 'down', down: 'up' }[game.facing] || npc.dir;   // turns to face the party
        npc.anim = null;
        game.currentNPC = npc;
        game.dialogue = npc.dialogue;
        game.dialogueIndex = 0;
        game.state = 'dialogue';
        return true;
      }
    }

    // Check for event tile in front (like door)
    var eventKey = fx + ',' + fy;
    var ev = map.events[eventKey];
    if (ev && ev.type === 'chest' && !game.flags[ev.flag]) {
      this.handleEvent(game, ev);
      return true;
    }

    return false;
  },

  // Render HUD overlay on map
  renderHUD: function(ctx, game) {
    // Party status window (top-right)
    UI.drawWindow(ctx, 400, 4, 234, 96);
    for (var i = 0; i < game.party.length; i++) {
      UI.drawCharStatus(ctx, game.party[i], 414, 14 + i * 22, true);
    }
    // Gold display
    UI.drawText(ctx, game.gold + 'G', 414, 82, '#ffd700', UI.FONT_SMALL);
    // Location name
    var map = MAPS[game.currentMap];
    if (map) {
      UI.drawWindow(ctx, 4, 4, 180, 28);
      UI.drawText(ctx, map.name, 14, 10, '#fff', UI.FONT_SMALL);
    }
  },
};
