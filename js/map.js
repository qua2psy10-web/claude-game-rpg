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

    // Calculate camera offset to center on player
    var camX = game.playerX - Math.floor(vpW / 2);
    var camY = game.playerY - Math.floor(vpH / 2);
    camX = Math.max(0, Math.min(camX, map.width - vpW));
    camY = Math.max(0, Math.min(camY, map.height - vpH));

    // Draw tiles
    for (var ty = 0; ty < vpH; ty++) {
      for (var tx = 0; tx < vpW; tx++) {
        var mx = camX + tx;
        var my = camY + ty;
        var px = tx * ts;
        var py = ty * ts;
        if (mx >= 0 && mx < map.width && my >= 0 && my < map.height) {
          var ch = map.tiles[my][mx];
          UI.drawTile(ctx, ch, px, py, ts);
          // Draw chest events
          var key = mx + ',' + my;
          var ev = map.events[key];
          if (ev && ev.type === 'chest') {
            var opened = game.flags[ev.flag];
            UI.drawChest(ctx, px, py, ts, opened);
          }
          // Draw map transfer markers (town/dungeon entrances on world map)
          if (ev && ev.type === 'mapTransfer' && game.currentMap === 'world') {
            this.drawMapMarker(ctx, px, py, ts, ev.desc);
          }
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(px, py, ts, ts);
        }
      }
    }

    // Draw NPCs
    if (map.npcs) {
      for (var i = 0; i < map.npcs.length; i++) {
        var npc = map.npcs[i];
        var sx = (npc.x - camX) * ts;
        var sy = (npc.y - camY) * ts;
        if (sx >= -ts && sx < vpW * ts + ts && sy >= -ts && sy < vpH * ts + ts) {
          UI.drawNPC(ctx, npc, sx, sy, ts);
        }
      }
    }

    // Draw player
    var playerScreenX = (game.playerX - camX) * ts;
    var playerScreenY = (game.playerY - camY) * ts;
    UI.drawPlayer(ctx, playerScreenX, playerScreenY, ts, game.facing);
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
        BattleSystem.startBattle(game, encounters[j].enemies);
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
    UI.drawWindow(ctx, 400, 4, 234, 80);
    for (var i = 0; i < game.party.length; i++) {
      UI.drawCharStatus(ctx, game.party[i], 414, 14 + i * 22, true);
    }
    // Gold display
    UI.drawText(ctx, game.gold + 'G', 414, 64, '#ffd700', UI.FONT_SMALL);
    // Location name
    var map = MAPS[game.currentMap];
    if (map) {
      UI.drawWindow(ctx, 4, 4, 180, 28);
      UI.drawText(ctx, map.name, 14, 10, '#fff', UI.FONT_SMALL);
    }
  },
};
