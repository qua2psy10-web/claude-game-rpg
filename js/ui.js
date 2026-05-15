// ============================================================
// ui.js — DQ-style UI rendering utilities
// ============================================================

var UI = {
  TILE_SIZE: 32,
  FONT: '16px monospace',
  FONT_SMALL: '13px monospace',
  WINDOW_BG: 'rgba(0, 0, 80, 0.92)',
  WINDOW_BORDER: '#ffffff',
  TEXT_COLOR: '#ffffff',
  CURSOR: '▶',
  CURSOR_BLINK_RATE: 500,

  // Draw a DQ-style blue window
  drawWindow: function(ctx, x, y, w, h) {
    ctx.fillStyle = this.WINDOW_BG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.WINDOW_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
  },

  // Draw text
  drawText: function(ctx, text, x, y, color, font) {
    ctx.fillStyle = color || this.TEXT_COLOR;
    ctx.font = font || this.FONT;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  },

  // Draw a menu with selectable options
  drawMenu: function(ctx, x, y, w, items, selectedIndex, timer) {
    var lineH = 26;
    var h = items.length * lineH + 20;
    this.drawWindow(ctx, x, y, w, h);
    for (var i = 0; i < items.length; i++) {
      var tx = x + 30;
      var ty = y + 12 + i * lineH;
      if (i === selectedIndex) {
        var blink = Math.floor((timer || Date.now()) / this.CURSOR_BLINK_RATE) % 2 === 0;
        if (blink) {
          this.drawText(ctx, this.CURSOR, x + 12, ty);
        }
      }
      this.drawText(ctx, items[i], tx, ty);
    }
    return h;
  },

  // Draw message window at bottom of screen
  drawMessageWindow: function(ctx, lines, canvasW, canvasH) {
    var h = 80;
    var y = canvasH - h;
    this.drawWindow(ctx, 0, y, canvasW, h);
    for (var i = 0; i < lines.length && i < 3; i++) {
      this.drawText(ctx, lines[i], 18, y + 14 + i * 22);
    }
  },

  // Draw HP/MP bar
  drawBar: function(ctx, x, y, w, h, current, max, color) {
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, h);
    var ratio = Math.max(0, current / max);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.floor(w * ratio), h);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  },

  // Draw character status (name, HP, MP)
  drawCharStatus: function(ctx, char, x, y, compact) {
    if (compact) {
      var nameW = 80;
      this.drawText(ctx, char.name, x, y, char.alive ? '#fff' : '#888', this.FONT_SMALL);
      this.drawText(ctx, 'HP', x + nameW, y, '#ff8', this.FONT_SMALL);
      this.drawText(ctx, char.hp + '/' + char.maxHp, x + nameW + 22, y, char.hp <= char.maxHp * 0.25 ? '#f44' : '#fff', this.FONT_SMALL);
      this.drawText(ctx, 'MP', x + nameW + 100, y, '#8cf', this.FONT_SMALL);
      this.drawText(ctx, char.mp + '/' + char.maxMp, x + nameW + 122, y, '#fff', this.FONT_SMALL);
    } else {
      this.drawText(ctx, char.name + ' Lv.' + char.level, x, y);
      this.drawText(ctx, 'HP', x, y + 22, '#ff8');
      this.drawBar(ctx, x + 28, y + 24, 100, 14, char.hp, char.maxHp, char.hp <= char.maxHp * 0.25 ? '#f44' : '#4c4');
      this.drawText(ctx, char.hp + '/' + char.maxHp, x + 132, y + 22, '#fff', this.FONT_SMALL);
      this.drawText(ctx, 'MP', x, y + 40, '#8cf');
      this.drawBar(ctx, x + 28, y + 42, 100, 14, char.mp, char.maxMp, '#48c');
      this.drawText(ctx, char.mp + '/' + char.maxMp, x + 132, y + 40, '#fff', this.FONT_SMALL);
    }
  },

  // Draw a tile on canvas
  drawTile: function(ctx, tileChar, px, py, size) {
    var tile = TILES[tileChar];
    if (!tile) return;
    ctx.fillStyle = tile.color;
    ctx.fillRect(px, py, size, size);
    // Add detail patterns
    if (tileChar === 'G' || tileChar === '.') {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(px + 8, py + 6, 2, 4);
      ctx.fillRect(px + 20, py + 18, 2, 4);
    } else if (tileChar === 'F') {
      ctx.fillStyle = 'rgba(0,50,0,0.5)';
      ctx.beginPath();
      ctx.arc(px + 16, py + 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(px + 14, py + 20, 4, 12);
    } else if (tileChar === 'W') {
      ctx.fillStyle = 'rgba(100,180,255,0.3)';
      ctx.fillRect(px + 4, py + 10, 12, 2);
      ctx.fillRect(px + 14, py + 20, 14, 2);
    } else if (tileChar === 'M') {
      ctx.fillStyle = 'rgba(60,50,40,0.4)';
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 2);
      ctx.lineTo(px + 28, py + 28);
      ctx.lineTo(px + 4, py + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 2);
      ctx.lineTo(px + 20, py + 10);
      ctx.lineTo(px + 12, py + 10);
      ctx.closePath();
      ctx.fill();
    } else if (tileChar === 'd') {
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(px + 8, py + 4, 16, 28);
      ctx.fillStyle = '#ca8';
      ctx.fillRect(px + 20, py + 14, 3, 3);
    } else if (tileChar === 'c') {
      ctx.fillStyle = '#4a2a0a';
      ctx.fillRect(px + 2, py + 8, 28, 20);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(px + 2, py + 8, 28, 4);
    } else if (tileChar === 'E' || tileChar === 'e') {
      ctx.fillStyle = '#8b7355';
      ctx.fillRect(px + 4, py + 0, 4, 32);
      ctx.fillRect(px + 24, py + 0, 4, 32);
      ctx.fillStyle = '#c4a265';
      ctx.fillRect(px + 8, py + 24, 16, 8);
    } else if (tileChar === 'I') {
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(px + 12, py + 8, 8, 20);
      ctx.fillRect(px + 6, py + 4, 20, 8);
    } else if (tileChar === 'r') {
      ctx.fillStyle = 'rgba(100,20,20,0.3)';
      ctx.fillRect(px + 2, py + 2, 28, 28);
    } else if (tileChar === 'T') {
      ctx.fillStyle = '#6a4a8a';
      ctx.fillRect(px + 6, py + 16, 20, 16);
      ctx.fillRect(px + 2, py + 4, 28, 14);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(px + 12, py + 6, 8, 4);
    } else if (tileChar === 'L') {
      ctx.fillStyle = 'rgba(255,100,0,0.5)';
      ctx.fillRect(px + 4, py + 8, 10, 6);
      ctx.fillRect(px + 18, py + 18, 8, 6);
    }
  },

  // Draw player sprite
  drawPlayer: function(ctx, px, py, size, facing) {
    var cx = px + size / 2;
    var cy = py + size / 2;
    // Body
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(cx - 6, cy - 4, 12, 14);
    // Head
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(cx - 5, cy - 12, 10, 10);
    // Hair/hat
    ctx.fillStyle = '#2266aa';
    ctx.fillRect(cx - 6, cy - 14, 12, 5);
    // Eyes
    ctx.fillStyle = '#222';
    if (facing === 'up') {
      // show back
    } else {
      ctx.fillRect(cx - 3, cy - 8, 2, 2);
      ctx.fillRect(cx + 2, cy - 8, 2, 2);
    }
    // Legs
    ctx.fillStyle = '#885533';
    ctx.fillRect(cx - 5, cy + 10, 4, 5);
    ctx.fillRect(cx + 1, cy + 10, 4, 5);
  },

  // Draw NPC sprite
  drawNPC: function(ctx, npc, px, py, size) {
    var cx = px + size / 2;
    var cy = py + size / 2;
    ctx.fillStyle = npc.color || '#aa8844';
    ctx.fillRect(cx - 6, cy - 4, 12, 14);
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(cx - 5, cy - 12, 10, 10);
    ctx.fillStyle = npc.color || '#aa8844';
    ctx.fillRect(cx - 6, cy - 14, 12, 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(cx - 3, cy - 8, 2, 2);
    ctx.fillRect(cx + 2, cy - 8, 2, 2);
    ctx.fillStyle = '#555';
    ctx.fillRect(cx - 5, cy + 10, 4, 5);
    ctx.fillRect(cx + 1, cy + 10, 4, 5);
  },

  // Draw enemy sprite in battle
  drawEnemy: function(ctx, enemy, cx, cy, scale) {
    scale = scale || 1;
    var s = function(v) { return v * scale; };
    ctx.save();
    ctx.translate(cx, cy);
    var c = enemy.color;

    switch (enemy.shape) {
      case 'slime':
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, s(10), s(22), s(18), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(s(-8), s(2), s(6), s(8));
        ctx.fillRect(s(3), s(2), s(6), s(8));
        ctx.fillStyle = '#222';
        ctx.fillRect(s(-5), s(4), s(3), s(4));
        ctx.fillRect(s(5), s(4), s(3), s(4));
        ctx.fillStyle = '#e44';
        ctx.fillRect(s(-4), s(12), s(8), s(3));
        break;
      case 'goblin':
        ctx.fillStyle = c;
        ctx.fillRect(s(-14), s(-10), s(28), s(32));
        ctx.fillRect(s(-10), s(-20), s(20), s(14));
        ctx.fillStyle = '#fff';
        ctx.fillRect(s(-6), s(-16), s(5), s(5));
        ctx.fillRect(s(2), s(-16), s(5), s(5));
        ctx.fillStyle = '#222';
        ctx.fillRect(s(-4), s(-14), s(3), s(3));
        ctx.fillRect(s(4), s(-14), s(3), s(3));
        ctx.fillStyle = '#3a6a2a';
        ctx.fillRect(s(-16), s(-18), s(6), s(10));
        ctx.fillRect(s(10), s(-18), s(6), s(10));
        break;
      case 'wolf':
        ctx.fillStyle = c;
        ctx.fillRect(s(-24), s(-6), s(40), s(18));
        ctx.fillRect(s(-30), s(-14), s(14), s(14));
        ctx.fillStyle = '#fff';
        ctx.fillRect(s(-28), s(-12), s(4), s(4));
        ctx.fillStyle = '#e44';
        ctx.fillRect(s(-26), s(-2), s(8), s(3));
        // Tail
        ctx.fillStyle = c;
        ctx.fillRect(s(14), s(-12), s(6), s(10));
        // Legs
        ctx.fillRect(s(-20), s(12), s(5), s(10));
        ctx.fillRect(s(-8), s(12), s(5), s(10));
        ctx.fillRect(s(4), s(12), s(5), s(10));
        break;
      case 'bat':
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(0, 0, s(10), s(12), 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.beginPath();
        ctx.moveTo(s(-10), s(-4));
        ctx.lineTo(s(-35), s(-18));
        ctx.lineTo(s(-30), s(4));
        ctx.lineTo(s(-10), s(6));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s(10), s(-4));
        ctx.lineTo(s(35), s(-18));
        ctx.lineTo(s(30), s(4));
        ctx.lineTo(s(10), s(6));
        ctx.fill();
        ctx.fillStyle = '#ff4';
        ctx.fillRect(s(-5), s(-4), s(3), s(3));
        ctx.fillRect(s(3), s(-4), s(3), s(3));
        break;
      case 'skeleton':
        ctx.fillStyle = c;
        ctx.fillRect(s(-8), s(-24), s(16), s(16));
        ctx.fillRect(s(-10), s(-8), s(20), s(24));
        ctx.fillStyle = '#222';
        ctx.fillRect(s(-5), s(-20), s(4), s(5));
        ctx.fillRect(s(1), s(-20), s(4), s(5));
        ctx.fillRect(s(-3), s(-12), s(6), s(3));
        ctx.fillStyle = c;
        ctx.fillRect(s(-14), s(-6), s(6), s(4));
        ctx.fillRect(s(8), s(-6), s(6), s(4));
        ctx.fillRect(s(-6), s(16), s(4), s(12));
        ctx.fillRect(s(2), s(16), s(4), s(12));
        break;
      case 'knight':
        ctx.fillStyle = c;
        ctx.fillRect(s(-12), s(-28), s(24), s(20));
        ctx.fillRect(s(-16), s(-8), s(32), s(30));
        ctx.fillStyle = '#aaa';
        ctx.fillRect(s(-10), s(-24), s(20), s(4));
        ctx.fillRect(s(-4), s(-24), s(8), s(14));
        ctx.fillStyle = '#e44';
        ctx.fillRect(s(-4), s(-22), s(3), s(3));
        ctx.fillRect(s(2), s(-22), s(3), s(3));
        // Sword
        ctx.fillStyle = '#ccc';
        ctx.fillRect(s(16), s(-20), s(4), s(30));
        ctx.fillStyle = '#aa8';
        ctx.fillRect(s(12), s(-4), s(12), s(4));
        ctx.fillStyle = c;
        ctx.fillRect(s(-8), s(22), s(6), s(10));
        ctx.fillRect(s(2), s(22), s(6), s(10));
        break;
      case 'mage':
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, s(-34));
        ctx.lineTo(s(-14), s(-14));
        ctx.lineTo(s(14), s(-14));
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(s(-12), s(-16), s(24), s(32));
        ctx.fillStyle = '#ff8';
        ctx.fillRect(s(-4), s(-22), s(3), s(3));
        ctx.fillRect(s(2), s(-22), s(3), s(3));
        // Staff
        ctx.fillStyle = '#8a6';
        ctx.fillRect(s(-20), s(-30), s(4), s(50));
        ctx.fillStyle = '#8ff';
        ctx.beginPath();
        ctx.arc(s(-18), s(-32), s(6), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'demonKing':
        // Large imposing figure
        ctx.fillStyle = c;
        ctx.fillRect(s(-20), s(-36), s(40), s(28));
        ctx.fillRect(s(-26), s(-8), s(52), s(40));
        // Horns
        ctx.fillStyle = '#440011';
        ctx.beginPath();
        ctx.moveTo(s(-18), s(-34));
        ctx.lineTo(s(-26), s(-52));
        ctx.lineTo(s(-10), s(-34));
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s(18), s(-34));
        ctx.lineTo(s(26), s(-52));
        ctx.lineTo(s(10), s(-34));
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(s(-12), s(-28), s(8), s(6));
        ctx.fillRect(s(4), s(-28), s(8), s(6));
        // Mouth
        ctx.fillStyle = '#220000';
        ctx.fillRect(s(-8), s(-18), s(16), s(4));
        // Cape
        ctx.fillStyle = '#330011';
        ctx.fillRect(s(-30), s(-4), s(8), s(36));
        ctx.fillRect(s(22), s(-4), s(8), s(36));
        // Aura
        ctx.strokeStyle = 'rgba(255,0,50,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, s(4), s(38), s(44), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        ctx.fillStyle = c;
        ctx.fillRect(s(-12), s(-12), s(24), s(24));
    }
    ctx.restore();
  },

  // Draw chest tile
  drawChest: function(ctx, px, py, size, opened) {
    ctx.fillStyle = opened ? '#665544' : '#cc8833';
    ctx.fillRect(px + 6, py + 10, 20, 16);
    ctx.fillStyle = opened ? '#554433' : '#aa6622';
    ctx.fillRect(px + 6, py + 6, 20, 8);
    if (!opened) {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(px + 13, py + 14, 6, 4);
    }
  },
};
