// ============================================================
// smith.js — the blacksmith: enhance equipped weapons / armor from +0 to +5 for gold
// The level lives on the character (char.weaponPlus / char.armorPlus) and on bag entries ({ id, type, plus }),
// and its stat bonus is applied to the character directly, like the gear's own stats.
// ============================================================

var SmithSystem = (function() {
  var MAX = 5, SLOTS = ['weapon', 'armor'], STATS = ['atk', 'def', 'int', 'spd', 'hp'];
  var SLOT_NAME = { weapon: 'ぶき', armor: 'よろい' };

  function table(slot) { return slot === 'weapon' ? WEAPONS : ARMORS; }
  function plusOf(c, slot) { return c[slot + 'Plus'] || 0; }

  // Extra stats an item gives at a level: 10% of each of its own stats per +1, at least +1
  function bonus(def, plus) {
    var out = {};
    STATS.forEach(function(k) { out[k] = def && def[k] && plus > 0 ? Math.max(1, Math.round(def[k] * 0.1 * plus)) : 0; });
    return out;
  }
  // Gold to go from +plus to +plus+1
  function cost(def, plus) { return Math.round(def.price * (0.25 + 0.15 * plus) / 10) * 10; }

  function addStats(c, b, sign) {
    c.atk += sign * b.atk; c.def += sign * b.def; c.int += sign * b.int; c.spd += sign * b.spd;
    c.maxHp += sign * b.hp;
    if (c.hp > c.maxHp) c.hp = c.maxHp;
  }
  // Sets the equipped item's level, moving the stats by the difference
  function set(c, slot, plus) {
    var def = c[slot] && table(slot)[c[slot]];
    if (!def) return;
    var old = plusOf(c, slot);
    addStats(c, bonus(def, old), -1);
    addStats(c, bonus(def, plus), 1);
    c[slot + 'Plus'] = plus;
  }
  // Takes the item off for unequipping: removes its bonus and returns its level
  function strip(c, slot) {
    var p = plusOf(c, slot);
    if (p > 0) set(c, slot, 0);
    c[slot + 'Plus'] = 0;
    return p;
  }
  // Putting an item on: gives its level back
  function grant(c, slot, plus) { c[slot + 'Plus'] = 0; if (plus > 0) set(c, slot, Math.min(MAX, plus)); }
  function label(c, slot) {
    var def = c[slot] && table(slot)[c[slot]];
    if (!def) return 'なし';
    return def.name + (plusOf(c, slot) > 0 ? ' +' + plusOf(c, slot) : '');
  }
  function bagLabel(entry) {
    var def = table(entry.type)[entry.id];
    return def.name + (entry.plus > 0 ? ' +' + entry.plus : '');
  }

  function rows(game) {
    var out = [];
    game.party.forEach(function(c, ci) { SLOTS.forEach(function(s) { out.push({ ci: ci, slot: s }); }); });
    return out;
  }

  function open(game) {
    game.smithState = { index: 0, msg: ['いらっしゃい！', 'どの 装備を きたえる？'], msgColor: null, denyAt: 0, doneAt: 0 };
    game.state = 'smith';
    SoundSystem.doorBell();
  }
  function close(game) { game.state = 'map'; game.smithState = null; }

  function update(game, input) {
    var ss = game.smithState, list = rows(game);
    if (input === 'cancel') { SoundSystem.cancel(); close(game); return; }
    if (input === 'up') { ss.index = (ss.index - 1 + list.length) % list.length; SoundSystem.cursor(); ss.msg = null; }
    if (input === 'down') { ss.index = (ss.index + 1) % list.length; SoundSystem.cursor(); ss.msg = null; }
    if (input !== 'confirm') return;
    var r = list[ss.index], c = game.party[r.ci], def = c[r.slot] && table(r.slot)[c[r.slot]], p = plusOf(c, r.slot);
    if (!def) { SoundSystem.denied(); ss.msg = ['そうびが ないぞ。']; ss.msgColor = '#f88'; return; }
    if (p >= MAX) { SoundSystem.denied(); ss.msg = ['これ以上は きたえられん。', 'もう 最高の 仕上がりじゃ！']; ss.msgColor = '#f88'; return; }
    var price = cost(def, p);
    if (game.gold < price) { SoundSystem.denied(); ss.denyAt = Date.now(); ss.msg = ['おかねが たりないようだ…']; ss.msgColor = '#f88'; return; }
    game.gold -= price;
    set(c, r.slot, p + 1);
    if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
    ss.doneAt = Date.now();
    SoundSystem.coin();
    ss.msg = ['カン！ カン！ カーン！', def.name + 'は +' + (p + 1) + ' に なった！'];
    ss.msgColor = '#ffd700';
  }

  function render(ctx, game) {
    var ss = game.smithState;
    if (!ss) return;
    var now = Date.now(), list = rows(game);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    var denyT = now - ss.denyAt, shake = denyT < 450 ? Math.sin(denyT / 25) * (1 - denyT / 450) * 5 : 0;
    UI.drawWindow(ctx, 20, 20, 600, 36);
    UI.drawText(ctx, '鍛冶屋  所持金:', 36, 30, '#ffd700');
    UI.drawText(ctx, game.gold + 'G', 176 + shake, 30, denyT < 450 ? '#f66' : '#ffd700');

    UI.drawWindow(ctx, 20, 66, 600, 6 * 30 + 24);
    for (var i = 0; i < list.length; i++) {
      var r = list[i], c = game.party[r.ci], def = c[r.slot] && table(r.slot)[c[r.slot]], p = plusOf(c, r.slot), y = 80 + i * 30;
      if (i === ss.index) UI.drawText(ctx, UI.CURSOR, 34, y);
      UI.drawText(ctx, c.name + ' ' + SLOT_NAME[r.slot], 58, y, '#9bd', UI.FONT_SMALL);
      UI.drawText(ctx, label(c, r.slot), 190, y, def ? '#fff' : '#667');
      var stars = ''; for (var s = 0; s < MAX; s++) stars += s < p ? '★' : '☆';
      if (def) UI.drawText(ctx, stars, 400, y, p > 0 ? '#ffd700' : '#667', UI.FONT_SMALL);
      if (def) UI.drawText(ctx, p >= MAX ? 'MAX' : cost(def, p) + 'G', 520, y, p >= MAX ? '#8c8' : (game.gold >= cost(def, p) ? '#ffe9a0' : '#a66'), UI.FONT_SMALL);
    }

    // Before -> after of the highlighted piece
    var cur = list[ss.index], cc = game.party[cur.ci], cdef = cc[cur.slot] && table(cur.slot)[cc[cur.slot]], cp = plusOf(cc, cur.slot);
    UI.drawWindow(ctx, 20, 282, 600, 70);
    if (cdef && cp < MAX) {
      var b0 = bonus(cdef, cp), b1 = bonus(cdef, cp + 1), parts = [], names = { atk: 'こうげき', def: 'しゅび', int: 'かしこさ', spd: 'すばやさ', hp: 'HP' };
      STATS.forEach(function(k) {
        if (!cdef[k]) return;
        var base = cdef[k] + b0[k], next = cdef[k] + b1[k];
        parts.push(names[k] + ' ' + base + ' → ' + next);
      });
      UI.drawText(ctx, cdef.name + ' +' + cp + ' → +' + (cp + 1), 36, 292, '#ffd700', UI.FONT_SMALL);
      UI.drawText(ctx, parts.join('   '), 36, 318, '#8f8', UI.FONT_SMALL);
    } else if (cdef) {
      UI.drawText(ctx, cdef.name + ' +' + cp + '  これ以上 きょうかできない', 36, 300, '#8c8', UI.FONT_SMALL);
    } else {
      UI.drawText(ctx, 'そうびが ない', 36, 300, '#667', UI.FONT_SMALL);
    }

    UI.drawWindow(ctx, 20, 362, 600, 100);
    if (ss.msg) for (var m = 0; m < ss.msg.length; m++) UI.drawText(ctx, ss.msg[m], 40, 380 + m * 26, ss.msgColor || '#fff');
    ctx.restore();
  }

  return { MAX: MAX, bonus: bonus, cost: cost, set: set, strip: strip, grant: grant, label: label, bagLabel: bagLabel,
           plusOf: plusOf, open: open, update: update, render: render };
})();
