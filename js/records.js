// ============================================================
// records.js — achievements (rewards) and the 「きろく」 screen
// Claimed achievements live in game.achieved = { id: true } and are saved with the game. Everything is
// derived from per-save data (bestiary, chest flags), so a save from before this feature simply earns what
// it already qualifies for the first time check() runs.
// ============================================================

var RecordsSystem = (function() {
  function chestEvents() {
    var out = [];
    Object.keys(MAPS).forEach(function(mid) {
      var ev = MAPS[mid].events || {};
      Object.keys(ev).forEach(function(k) { if (ev[k].type === 'chest') out.push(ev[k]); });
    });
    return out;
  }
  function stats(game) {
    var bs = game.bestiary || {}, ids = Object.keys(ENEMIES);
    var seen = 0, kills = 0, normal = 0, mastered = 0;
    ids.forEach(function(id) {
      var r = bs[id] || { seen: 0, defeated: 0 };
      if (r.seen > 0) seen++;
      kills += r.defeated;
      if (!ENEMIES[id].boss) { normal++; if (r.defeated >= 3) mastered++; }
    });
    var chests = chestEvents(), opened = chests.filter(function(c) { return game.flags && game.flags[c.flag]; }).length;
    return { seen: seen, total: ids.length, kills: kills, normal: normal, mastered: mastered, chests: chests.length, opened: opened };
  }
  function met(a, s) {
    switch (a.kind) {
      case 'seen':    return s.seen >= a.n;
      case 'seenAll': return s.seen >= s.total;
      case 'master':  return s.mastered >= s.normal;
      case 'chests':  return s.opened >= s.chests;
      case 'kills':   return s.kills >= a.n;
    }
    return false;
  }
  function progress(a, s) {
    switch (a.kind) {
      case 'seen':    return Math.min(s.seen, a.n) + '/' + a.n;
      case 'seenAll': return s.seen + '/' + s.total;
      case 'master':  return s.mastered + '/' + s.normal;
      case 'chests':  return s.opened + '/' + s.chests;
      case 'kills':   return Math.min(s.kills, a.n) + '/' + a.n;
    }
    return '';
  }
  function rewardText(r) {
    if (r.item) return ITEMS[r.item].name + ' x' + r.count;
    if (r.accessory) return ACCESSORIES[r.accessory].name;
    return '';
  }

  // Grants every newly met achievement and announces it with a toast
  function check(game) {
    if (!game.achieved) game.achieved = {};
    var s = stats(game), granted = false;
    ACHIEVEMENTS.forEach(function(a) {
      if (game.achieved[a.id] || !met(a, s)) return;
      game.achieved[a.id] = true;
      granted = true;
      if (a.reward.item) MapSystem.giveItem(game, a.reward.item, a.reward.count);
      else if (a.reward.accessory) MapSystem.giveEquipment(game, a.reward.accessory, 'accessory');
      HintSystem.notice(game, ['★ たっせい: ' + a.name, rewardText(a.reward) + ' を てにいれた！']);
    });
    return granted;
  }

  function sanitize(raw) {
    var out = {};
    if (raw && typeof raw === 'object') ACHIEVEMENTS.forEach(function(a) { if (raw[a.id]) out[a.id] = true; });
    return out;
  }

  function fmtTime(sec) {
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function update(st, game, input) {
    if (input === 'cancel' || input === 'confirm') { SoundSystem.cancel(); return true; }
    return false;
  }

  function render(ctx, game) {
    var s = stats(game);
    ctx.save();
    ctx.textAlign = 'left';
    UI.drawWindow(ctx, 20, 20, 250, 440);
    UI.drawText(ctx, 'きろく', 38, 34, '#ffd700');
    var rows = [
      ['プレイじかん', fmtTime(gameScore.playTime) + '  スロット' + (game.slot || 1) + (game.cycle > 1 ? '  (' + game.cycle + 'しゅうめ)' : '')],
      ['あるいた ほすう', game.steps + '歩'],
      ['たおした てき', s.kills + 'たい'],
      ['ずかん', s.seen + '/' + s.total + ' しゅるい'],
      ['たからばこ', s.opened + '/' + s.chests],
      ['さいだい おかね', gameScore.highGold + ' G'],
      ['まおう', game.flags.demonKingDefeated ? 'たおした' : '—'],
      ['ゼルギオス', game.flags.abyssBossDefeated ? 'たおした' : '—'],
    ];
    for (var i = 0; i < rows.length; i++) {
      UI.drawText(ctx, rows[i][0], 38, 74 + i * 42, '#9bd', UI.FONT_SMALL);
      UI.drawText(ctx, rows[i][1], 50, 74 + i * 42 + 18, '#fff', UI.FONT_SMALL);
    }
    UI.drawWindow(ctx, 286, 20, 334, 440);
    var done = ACHIEVEMENTS.filter(function(a) { return game.achieved && game.achieved[a.id]; }).length;
    UI.drawText(ctx, 'たっせい  ' + done + '/' + ACHIEVEMENTS.length, 304, 34, '#ffd700');
    for (var j = 0; j < ACHIEVEMENTS.length; j++) {
      var a = ACHIEVEMENTS[j], ok = game.achieved && game.achieved[a.id], y = 74 + j * 62;
      UI.drawText(ctx, (ok ? '★ ' : '☆ ') + a.name, 304, y, ok ? '#ffd700' : '#bbb', UI.FONT_SMALL);
      UI.drawText(ctx, a.desc + (ok ? '' : '  (' + progress(a, s) + ')'), 322, y + 18, ok ? '#8c8' : '#889', UI.FONT_SMALL);
      UI.drawText(ctx, 'ほうしゅう: ' + rewardText(a.reward), 322, y + 36, ok ? '#686' : '#889', UI.FONT_SMALL);
    }
    ctx.restore();
  }

  return { check: check, sanitize: sanitize, update: update, render: render, stats: stats };
})();
