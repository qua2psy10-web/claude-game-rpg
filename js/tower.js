// ============================================================
// tower.js — the Tower of the Abyss (深淵の塔), a post-game thirty-floor challenge
// One battle per floor (TOWER in data.js), the enemies growing with every floor; checkpoints every fifth floor
// heal the party and pay rewards. Progress (best floor, rewards taken) is saved in game.tower.
// ============================================================

var TowerSystem = (function() {
  var RECOVER = 0.2;      // HP / MP a living member regains after an ordinary floor (fraction of the max)
  var CHECK_EVERY = 5;

  function fresh() { return { best: 0, claimed: {} }; }
  function sanitize(raw) {
    var out = fresh();
    if (!raw || typeof raw !== 'object') return out;
    out.best = Math.max(0, Math.min(TOWER.floors, Math.floor(raw.best) || 0));
    if (raw.claimed && typeof raw.claimed === 'object') Object.keys(TOWER.rewards).forEach(function(f) { if (raw.claimed[f]) out.claimed[f] = true; });
    return out;
  }

  // Strength of floor f (1-based): enemy stats and rewards grow with it
  function scale(f) {
    var n = Math.max(0, f - 1);
    return { stat: 1 + 0.025 * n, def: 1 + 0.012 * n, reward: 1 + 0.03 * n };
  }
  function groupFor(f) {
    var fixed = TOWER.special[f];
    if (fixed) return fixed.slice();
    var pool = f < 11 ? TOWER.pools[0] : f < 21 ? TOWER.pools[1] : TOWER.pools[2];
    return pool[Math.floor(Math.random() * pool.length)].slice();
  }
  function recover(party) {
    party.forEach(function(p) {
      if (!p.alive) return;
      p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * RECOVER));
      p.mp = Math.min(p.maxMp, p.mp + Math.ceil(p.maxMp * RECOVER));
    });
  }
  function healAll(party) {
    party.forEach(function(p) { p.alive = true; p.hp = p.maxHp; p.mp = p.maxMp; p.poisoned = false; p.buffs = {}; p.defending = false; });
  }
  // The floors a run may start from: 1 and every checkpoint + 1 that has been reached
  function starts(game) {
    var out = [1], b = (game.tower && game.tower.best) || 0;
    for (var c = CHECK_EVERY; c <= b && c < TOWER.floors; c += CHECK_EVERY) out.push(c + 1);
    return out;
  }
  function rewardText(r) {
    var parts = [];
    if (r.gold) parts.push(r.gold + 'G');
    if (r.item) parts.push(ITEMS[r.item].name + ' x' + r.count);
    if (r.accessory) parts.push(ACCESSORIES[r.accessory].name);
    return parts.join(' と ');
  }
  function pay(game, f) {
    var r = TOWER.rewards[f];
    if (!r || game.tower.claimed[f]) return null;
    game.tower.claimed[f] = true;
    if (r.gold) { game.gold += r.gold; if (game.gold > gameScore.highGold) gameScore.highGold = game.gold; }
    if (r.item) MapSystem.giveItem(game, r.item, r.count);
    if (r.accessory) MapSystem.giveEquipment(game, r.accessory, 'accessory');
    return rewardText(r);
  }

  function open(game) {
    if (!game.tower) game.tower = fresh();
    var st = starts(game);
    game.towerState = { phase: 'menu', index: 0, starts: st, msg: ['塔に 挑むか？', 'ふもとから でも、とっぱした 節目からでも いい。'], msgColor: null };
    game.state = 'tower';
    SoundSystem.doorBell();
  }
  function close(game) { game.state = 'map'; game.towerState = null; }

  function floorBattle(game) {
    var f = game.towerRun.floor;
    game.towerFloorScale = f;
    BattleSystem.startBattle(game, groupFor(f));
    game.state = 'battle';
  }
  function begin(game, floor) {
    game.towerRun = { floor: floor, start: floor };
    game.towerState = null;
    game.party.forEach(function(p) { p.poisoned = false; });
    floorBattle(game);
  }

  function endRun(game, lines) {
    game.towerRun = null; game.towerFloorScale = 0; game.battle = null; game.currentNPC = null;
    game.dialogue = lines; game.dialogueIndex = 0; game.state = 'dialogue';
    if (typeof saveGame === 'function') saveGame();
  }

  // After a won floor: the next floor, a checkpoint, or the top
  function afterFloor(game) {
    var run = game.towerRun, f = run.floor;
    if (f > game.tower.best) game.tower.best = f;
    var reward = pay(game, f);
    if (f >= TOWER.floors) {
      healAll(game.party);
      endRun(game, ['塔の番人「…頂上を 極めたか！ 見事だ！', 'この塔に もう 挑む者は いない。」', '全フロア とっぱ！'].concat(reward ? ['ほうしゅう: ' + reward] : []));
      return;
    }
    if (f % CHECK_EVERY === 0) {                                  // a checkpoint: full heal, the reward, and the choice
      healAll(game.party);
      game.battle = null;
      game.towerFloorScale = 0;
      game.towerState = { phase: 'checkpoint', index: 0, floor: f, msg: [f + 'F を とっぱ！ HPと MPが ぜんかいふくした。'].concat(reward ? ['ほうしゅう: ' + reward] : []), msgColor: '#ffd700' };
      game.state = 'tower';
      SoundSystem.coin();
      if (typeof saveGame === 'function') saveGame();
      return;
    }
    recover(game.party);
    run.floor = f + 1;
    floorBattle(game);
  }
  function afterLose(game) {
    var f = game.towerRun ? game.towerRun.floor : 0;
    healAll(game.party);
    endRun(game, ['塔の番人「' + f + 'F で 力尽きたか…', '手当ては しておいた。', '最高記録は ' + game.tower.best + 'F だ。また 挑戦しに 来い。」']);
  }

  function update(game, input) {
    var ts = game.towerState;
    if (ts.phase === 'menu') {
      if (input === 'cancel') { SoundSystem.cancel(); close(game); return; }
      var n = ts.starts.length;
      if (input === 'up') { ts.index = (ts.index - 1 + n) % n; SoundSystem.cursor(); }
      if (input === 'down') { ts.index = (ts.index + 1) % n; SoundSystem.cursor(); }
      if (input === 'confirm') { SoundSystem.confirm(); begin(game, ts.starts[ts.index]); }
    } else if (ts.phase === 'checkpoint') {
      if (input === 'up' || input === 'down') { ts.index = 1 - ts.index; SoundSystem.cursor(); }
      if (input === 'confirm') {
        SoundSystem.confirm();
        if (ts.index === 0) { game.towerRun.floor = ts.floor + 1; game.towerState = null; floorBattle(game); }
        else { endRun(game, ['塔の番人「' + ts.floor + 'F まで とっぱか。', 'ここで 休むのも 勇気だ。また 来い。」']); }
      }
    }
  }

  function render(ctx, game) {
    var ts = game.towerState;
    if (!ts) return;
    var best = game.tower.best;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    UI.drawWindow(ctx, 20, 20, 600, 36);
    UI.drawText(ctx, '深淵の塔  さいこう記録: ' + best + 'F / ' + TOWER.floors + 'F', 36, 30, '#ffd700');
    if (ts.phase === 'menu') {
      UI.drawWindow(ctx, 20, 66, 290, 270);
      UI.drawText(ctx, 'どこから 挑む？', 36, 78, '#9bd', UI.FONT_SMALL);
      for (var i = 0; i < ts.starts.length; i++) {
        var y = 104 + i * 30;
        if (i === ts.index) UI.drawText(ctx, UI.CURSOR, 34, y, '#ffd700');
        UI.drawText(ctx, ts.starts[i] + 'F から' + (ts.starts[i] === 1 ? '' : '  (節目)'), 62, y);
      }
      UI.drawWindow(ctx, 326, 66, 294, 270);
      UI.drawText(ctx, 'ほうしゅう', 342, 78, '#9bd', UI.FONT_SMALL);
      Object.keys(TOWER.rewards).sort(function(a, b2) { return a - b2; }).forEach(function(f, k) {
        var got = game.tower.claimed[f];
        UI.drawText(ctx, (got ? '★ ' : '☆ ') + f + 'F: ' + rewardText(TOWER.rewards[f]), 342, 102 + k * 34, got ? '#8c8' : '#ccd', UI.FONT_SMALL);
      });
    } else {
      UI.drawWindow(ctx, 20, 66, 600, 150);
      for (var j = 0; j < ts.msg.length; j++) UI.drawText(ctx, ts.msg[j], 40, 84 + j * 28, j === 0 ? '#fff' : ts.msgColor || '#fff');
      UI.drawWindow(ctx, 20, 228, 300, 90);
      [ (ts.floor + 1) + 'F へ すすむ', 'ここで やめる' ].forEach(function(s, k) {
        if (k === ts.index) UI.drawText(ctx, UI.CURSOR, 34, 244 + k * 30, '#ffd700');
        UI.drawText(ctx, s, 62, 244 + k * 30);
      });
    }
    UI.drawWindow(ctx, 20, 346, 600, 114);
    if (ts.phase === 'menu' && ts.msg) for (var m = 0; m < ts.msg.length; m++) UI.drawText(ctx, ts.msg[m], 40, 362 + m * 28, ts.msgColor || '#fff');
    UI.drawText(ctx, '1フロアごとに てきが つよくなる。にげられない。5Fごとに 全回復。', 36, 424, '#9bd', UI.FONT_SMALL);
    ctx.restore();
  }

  return { RECOVER: RECOVER, CHECK_EVERY: CHECK_EVERY, fresh: fresh, sanitize: sanitize, scale: scale, groupFor: groupFor, recover: recover, healAll: healAll,
           starts: starts, pay: pay, open: open, update: update, begin: begin, afterFloor: afterFloor, afterLose: afterLose, render: render };
})();
