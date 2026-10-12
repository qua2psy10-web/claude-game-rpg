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
    RecordsSystem.check(game);
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
    // An NPC may hold several requests (npc.quest is an id or a list): the first one that is not finished and whose `needs` flag is set
    var list = [].concat(npc.quest);
    id = null;
    for (var i = 0; i < list.length; i++) {
      var cq = QUESTS[list[i]], cs = get(game, list[i]);
      if (cs && cs.state === 'done') continue;
      if (!cs && cq.needs && !game.flags[cq.needs]) continue;
      id = list[i]; break;
    }
    if (!id) return null;
    q = QUESTS[id]; st = get(game, id);
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

  var PER_PAGE = 4;
  function pages() { return Math.ceil(ids().length / PER_PAGE); }

  // Left/Right turns the page; confirm / cancel closes
  function update(st, game, input) {
    var p = st.qPage || 0;
    if (input === 'left' && p > 0) { st.qPage = p - 1; SoundSystem.cursor(); return false; }
    if (input === 'right' && p < pages() - 1) { st.qPage = p + 1; SoundSystem.cursor(); return false; }
    if (input === 'cancel' || input === 'confirm') { st.qPage = 0; SoundSystem.cancel(); return true; }
    return false;
  }

  function render(ctx, game, st) {
    ctx.save();
    ctx.textAlign = 'left';
    UI.drawWindow(ctx, 20, 20, 600, 440);
    var all = ids(), done = all.filter(function(id) { var s = get(game, id); return s && s.state === 'done'; }).length;
    var page = (st && st.qPage) || 0;
    UI.drawText(ctx, 'いらい  ' + done + '/' + all.length, 38, 34, '#ffd700');
    if (pages() > 1) UI.drawText(ctx, (page > 0 ? '◀ ' : '   ') + (page + 1) + '/' + pages() + (page < pages() - 1 ? ' ▶' : ''), 520, 34, '#9bd', UI.FONT_SMALL);
    for (var i = page * PER_PAGE; i < Math.min(all.length, (page + 1) * PER_PAGE); i++) {
      var id = all[i], q = QUESTS[id], qs = get(game, id), y = 76 + (i - page * PER_PAGE) * 86;
      if (!qs) {
        UI.drawText(ctx, '？？？？？？', 38, y, '#667', UI.FONT_SMALL);
        UI.drawText(ctx, 'むらびとに はなしかけると うけられる', 56, y + 20, '#556', UI.FONT_SMALL);
        continue;
      }
      var fin = qs.state === 'done';
      UI.drawText(ctx, (fin ? '★ ' : '◆ ') + q.name, 38, y, fin ? '#ffd700' : '#fff', UI.FONT_SMALL);
      UI.drawText(ctx, q.desc, 56, y + 20, fin ? '#8c8' : '#bbb', UI.FONT_SMALL);
      UI.drawText(ctx, 'ほうしゅう: ' + rewardText(q.reward) + (fin ? '' : '    (' + progress(game, id) + ')'), 56, y + 40, fin ? '#686' : '#9bd', UI.FONT_SMALL);
    }
    ctx.restore();
  }

  return { talk: talk, onDefeated: onDefeated, sanitize: sanitize, update: update, render: render, progress: progress };
})();
