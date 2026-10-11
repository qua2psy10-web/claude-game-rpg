// ============================================================
// bestiary.js — monster encyclopedia (records + the ずかん screen)
// Records live in game.bestiary = { enemyId: { seen, defeated } } and are saved with the game.
// ============================================================

var BestiarySystem = (function() {
  var STATS_AT = 1;        // defeats needed to reveal HP / EXP / gold
  var DETAIL_AT = 3;       // defeats needed to reveal ATK / DEF / SPD / abilities
  var ROWS = 9;

  function ids() { return Object.keys(ENEMIES); }
  function rec(game, id) { return (game.bestiary && game.bestiary[id]) || { seen: 0, defeated: 0 }; }

  // Called when a battle starts; returns the names of enemies met for the first time
  function recordSeen(game, enemyIds) {
    if (!game.bestiary) game.bestiary = {};
    var fresh = [];
    for (var i = 0; i < enemyIds.length; i++) {
      var id = enemyIds[i];
      if (!ENEMIES[id] || enemyIds.indexOf(id) !== i) continue;   // one meeting per battle, however many of them
      if (!game.bestiary[id]) game.bestiary[id] = { seen: 0, defeated: 0 };
      if (game.bestiary[id].seen === 0) fresh.push(ENEMIES[id].name);
      game.bestiary[id].seen++;
    }
    return fresh.filter(function(n, i) { return fresh.indexOf(n) === i; });
  }
  function recordDefeated(game, enemyIds) {
    if (!game.bestiary) game.bestiary = {};
    for (var i = 0; i < enemyIds.length; i++) {
      var id = enemyIds[i];
      if (!ENEMIES[id]) continue;
      if (!game.bestiary[id]) game.bestiary[id] = { seen: 1, defeated: 0 };
      game.bestiary[id].defeated++;
    }
  }
  // Keep only well-formed entries of known enemies (old saves have none)
  function sanitize(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    ids().forEach(function(id) {
      var r = raw[id];
      if (r && typeof r === 'object') {
        var s = Math.max(0, Math.floor(Number(r.seen)) || 0), df = Math.max(0, Math.floor(Number(r.defeated)) || 0);
        if (s || df) out[id] = { seen: Math.max(s, df), defeated: df };
      }
    });
    return out;
  }
  function counts(game) {
    var all = ids(), n = 0;
    all.forEach(function(id) { if (rec(game, id).seen > 0) n++; });
    return { seen: n, total: all.length };
  }

  function update(st, game, input) {
    var n = ids().length;
    if (input === 'up') { st.bIndex = (st.bIndex - 1 + n) % n; SoundSystem.cursor(); }
    else if (input === 'down') { st.bIndex = (st.bIndex + 1) % n; SoundSystem.cursor(); }
    else if (input === 'cancel') { SoundSystem.cancel(); return true; }
    return false;
  }

  function render(ctx, st, game) {
    var all = ids(), c = counts(game);
    var idx = st.bIndex || 0;
    ctx.save();
    ctx.textAlign = 'left';
    // List
    UI.drawWindow(ctx, 20, 20, 230, 440);
    UI.drawText(ctx, 'ずかん  ' + c.seen + '/' + c.total, 38, 34, '#ffd700');
    var top = Math.max(0, Math.min(all.length - ROWS, idx - Math.floor(ROWS / 2)));
    for (var r = 0; r < ROWS && top + r < all.length; r++) {
      var i = top + r, id = all[i], rc = rec(game, id), y = 74 + r * 40;
      if (i === idx && Math.floor(Date.now() / 500) % 2 === 0) UI.drawText(ctx, UI.CURSOR, 34, y);
      UI.drawText(ctx, (i < 9 ? '0' : '') + (i + 1) + ' ' + (rc.seen ? ENEMIES[id].name : '？？？？'), 62, y, rc.seen ? (rc.defeated ? '#fff' : '#bbb') : '#555',
        ENEMIES[id].name.length > 8 ? UI.FONT_SMALL : undefined);
    }
    // Detail
    var id2 = all[idx], e = ENEMIES[id2], rc2 = rec(game, id2);
    UI.drawWindow(ctx, 266, 20, 354, 440);
    if (!rc2.seen) {
      UI.drawText(ctx, '？？？？', 290, 40, '#777');
      UI.drawText(ctx, 'まだ であっていない…', 290, 90, '#666');
      ctx.restore();
      return;
    }
    // Portrait panel
    ctx.fillStyle = e.boss ? '#1a0a14' : '#0b1228'; ctx.fillRect(282, 66, 322, 150);
    ctx.save();
    ctx.beginPath(); ctx.rect(282, 66, 322, 150); ctx.clip();
    UI.drawEnemy(ctx, { color: e.color, shape: e.shape, boss: e.boss, name: e.name, hp: e.hp, maxHp: e.hp, alive: true, buffs: {} }, 443, e.boss ? 150 : 148, e.boss ? 0.7 : 1.1);
    ctx.restore();
    UI.drawText(ctx, e.name, 290, 36, e.boss ? '#f88' : '#fff');
    UI.drawText(ctx, 'であった: ' + rc2.seen + '回   たおした: ' + rc2.defeated + '体', 290, 226, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, e.desc[0], 290, 250, '#ddd');
    UI.drawText(ctx, e.desc[1], 290, 274, '#ddd');
    UI.drawText(ctx, 'せいそく: ' + e.area, 290, 304, '#9bd', UI.FONT_SMALL);
    // Stats unlock with defeats
    if (rc2.defeated >= STATS_AT) {
      UI.drawText(ctx, 'HP ' + e.hp, 290, 334, '#fff');
      UI.drawText(ctx, (e.boss ? '' : '経験値 ' + e.exp + '   ゴールド ' + e.gold + 'G'), 380, 334, '#ffd700', UI.FONT_SMALL);
    } else {
      UI.drawText(ctx, 'HP ???   １回 たおすと わかる', 290, 334, '#666', UI.FONT_SMALL);
    }
    if (rc2.defeated >= DETAIL_AT) {
      UI.drawText(ctx, 'こうげき ' + e.atk + '   ぼうぎょ ' + e.def + '   すばやさ ' + e.spd, 290, 366, '#fff', UI.FONT_SMALL);
      var traits = [];
      if (e.poison) traits.push('毒 ' + Math.round(e.poison * 100) + '%');
      if (e.skills && e.skills.length) traits.push('じゅもん/とくぎ: ' + e.skills.map(function(s) { return SPELLS[s] ? SPELLS[s].name : s; }).join('・'));
      UI.drawText(ctx, traits.length ? traits.join('   ') : 'とくべつな わざは ない', 290, 392, '#f9a', UI.FONT_SMALL);
    } else {
      UI.drawText(ctx, 'くわしい ようす ???   ' + DETAIL_AT + '体 たおすと わかる', 290, 366, '#666', UI.FONT_SMALL);
    }
    UI.drawText(ctx, '↑↓: えらぶ   X: もどる', 290, 430, '#889', UI.FONT_SMALL);
    ctx.restore();
  }

  return { update: update, render: render, recordSeen: recordSeen, recordDefeated: recordDefeated, sanitize: sanitize, counts: counts };
})();
