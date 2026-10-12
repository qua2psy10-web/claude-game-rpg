// ============================================================
// quests.js — villager requests (いらい): accept by talking, progress, rewards and the menu screen
// game.quests = { id: { state: 'active' | 'done', n } } is saved with the game. Definitions are in QUESTS (data.js).
// ============================================================

var QuestSystem = (function() {
  function ids() { return Object.keys(QUESTS); }
  function get(game, id) { return game.quests && game.quests[id]; }

  function rewardText(r) {
    var parts = [];
    if (r.gold) parts.push(r.gold + 'G');
    if (r.item) parts.push(ITEMS[r.item].name + (r.count > 1 ? ' x' + r.count : ''));
    return parts.join(' と ');
  }

  function itemCount(game, id) {
    for (var i = 0; i < game.inventory.length; i++) if (game.inventory[i].id === id) return game.inventory[i].count;
    return 0;
  }
  function takeItem(game, id, n) {
    for (var i = 0; i < game.inventory.length; i++) {
      if (game.inventory[i].id !== id) continue;
      game.inventory[i].count -= n;
      if (game.inventory[i].count <= 0) game.inventory.splice(i, 1);
      return;
    }
  }

  function progress(game, id) {
    var q = QUESTS[id], st = get(game, id);
    if (!st) return '';
    if (st.state === 'done') return 'かんりょう';
    if (q.kind === 'kill') return Math.min(st.n || 0, q.n) + '/' + q.n;
    if (q.kind === 'fetch') return Math.min(itemCount(game, q.item), q.n) + '/' + q.n;
    return 'とどけもの';
  }

  function complete(game, id) {
    var q = QUESTS[id], r = q.reward;
    game.quests[id].state = 'done';
    if (r.gold) game.gold += r.gold;
    if (r.item) MapSystem.giveItem(game, r.item, r.count);
    HintSystem.notice(game, ['★ いらい かんりょう: ' + q.name, rewardText(r) + ' を てにいれた！']);
    if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
  }

  // Lines for an NPC that has a request to give or receive, applying the state change; null = nothing to say about requests
  function talk(game, npc) {
    if (!game.quests) game.quests = {};
    var id, q, st;
    if (npc.questTarget) {
      id = npc.questTarget; q = QUESTS[id]; st = get(game, id);
      if (st && st.state === 'active') { complete(game, id); return q.lines.done; }
    }
    if (!npc.quest) return null;
    id = npc.quest; q = QUESTS[id]; st = get(game, id);
    if (st && st.state === 'done') return null;
    if (!st) {
      game.quests[id] = { state: 'active', n: 0 };
      HintSystem.notice(game, ['いらいを うけた: ' + q.name, q.desc]);
      return q.lines.offer;
    }
    if (q.kind === 'fetch' && itemCount(game, q.item) >= q.n) {
      takeItem(game, q.item, q.n);
      complete(game, id);
      return q.lines.done;
    }
    if (q.kind === 'kill' && st.n >= q.n) { complete(game, id); return q.lines.done; }
    return q.lines.active.concat(q.kind === 'deliver' ? [] : ['（' + progress(game, id) + '）']);
  }

  // After a win: counts defeated enemies toward active kill requests
  function onDefeated(game, enemyIds) {
    if (!game.quests) return;
    ids().forEach(function(id) {
      var q = QUESTS[id], st = game.quests[id];
      if (q.kind !== 'kill' || !st || st.state !== 'active') return;
      enemyIds.forEach(function(e) { if (e === q.enemy && st.n < q.n) st.n++; });
      if (st.n >= q.n && !st.ready) { st.ready = true; HintSystem.notice(game, ['いらいの もくひょうを たっせい！', 'いらいぬしに はなしかけよう']); }
    });
  }

  function sanitize(raw) {
    var out = {};
    if (raw && typeof raw === 'object') ids().forEach(function(id) {
      var r = raw[id];
      if (r && (r.state === 'active' || r.state === 'done')) out[id] = { state: r.state, n: Math.max(0, Math.floor(r.n) || 0), ready: !!r.ready };
    });
    return out;
  }

  function update(st, game, input) {
    if (input === 'cancel' || input === 'confirm') { SoundSystem.cancel(); return true; }
    return false;
  }

  function render(ctx, game) {
    ctx.save();
    ctx.textAlign = 'left';
    UI.drawWindow(ctx, 20, 20, 600, 440);
    var all = ids(), done = all.filter(function(id) { var s = get(game, id); return s && s.state === 'done'; }).length;
    UI.drawText(ctx, 'いらい  ' + done + '/' + all.length, 38, 34, '#ffd700');
    for (var i = 0; i < all.length; i++) {
      var id = all[i], q = QUESTS[id], st = get(game, id), y = 76 + i * 86;
      if (!st) {
        UI.drawText(ctx, '？？？？？？', 38, y, '#667', UI.FONT_SMALL);
        UI.drawText(ctx, 'むらびとに はなしかけると うけられる', 56, y + 20, '#556', UI.FONT_SMALL);
        continue;
      }
      var fin = st.state === 'done';
      UI.drawText(ctx, (fin ? '★ ' : '◆ ') + q.name, 38, y, fin ? '#ffd700' : '#fff', UI.FONT_SMALL);
      UI.drawText(ctx, q.desc, 56, y + 20, fin ? '#8c8' : '#bbb', UI.FONT_SMALL);
      UI.drawText(ctx, 'ほうしゅう: ' + rewardText(q.reward) + (fin ? '' : '    (' + progress(game, id) + ')'), 56, y + 40, fin ? '#686' : '#9bd', UI.FONT_SMALL);
    }
    ctx.restore();
  }

  return { talk: talk, onDefeated: onDefeated, sanitize: sanitize, update: update, render: render, progress: progress };
})();
