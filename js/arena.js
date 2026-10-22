// ============================================================
// arena.js — the arena (闘技場) in Haruka Waystation
// Pay an entry fee, fight three battles in a row (courses in ARENA, data.js) and collect the prize.
// The battles are ordinary ones, but pay no EXP / gold, cannot be fled and are only saved when the run ends.
// ============================================================

var ArenaSystem = (function() {
  var ROUNDS = 3;
  var RECOVER = 0.3;      // HP / MP a living member regains between rounds (fraction of the max)

  function course(id) { return ARENA.courses.filter(function(c) { return c.id === id; })[0]; }
  function unlocked(game, c) { return !c.needs || !!game.flags[c.needs]; }
  function cleared(game, c) { return !!game.flags['arena_clear_' + c.id]; }
  function enemyNames(ids) { return ids.map(function(id) { return ENEMIES[id].name; }).join('・'); }

  // Between rounds: the living members catch their breath
  function recover(party) {
    party.forEach(function(p) {
      if (!p.alive) return;
      p.hp = Math.min(p.maxHp, p.hp + Math.ceil(p.maxHp * RECOVER));
      p.mp = Math.min(p.maxMp, p.mp + Math.ceil(p.maxMp * RECOVER));
    });
  }

  function open(game) {
    game.arenaState = { index: 0, msg: ['どの 試合に 出る？', '3れんせん。ぜんぶ かてば しょうきんが 出るぞ！'], msgColor: null, denyAt: 0 };
    game.state = 'arena';
    SoundSystem.doorBell();
  }
  function close(game) { game.state = 'map'; game.arenaState = null; }

  function begin(game, id) {
    var c = course(id);
    game.gold -= c.fee;
    game.arena = { id: id, round: 0 };
    game.arenaState = null;
    game.party.forEach(function(p) { p.poisoned = false; });
    BattleSystem.startBattle(game, c.rounds[0]);
    game.state = 'battle';
  }

  function update(game, input) {
    var st = game.arenaState, n = ARENA.courses.length;
    if (input === 'cancel') { SoundSystem.cancel(); close(game); return; }
    if (input === 'up') { st.index = (st.index - 1 + n) % n; SoundSystem.cursor(); }
    if (input === 'down') { st.index = (st.index + 1) % n; SoundSystem.cursor(); }
    if (input === 'confirm') {
      var c = ARENA.courses[st.index];
      if (!unlocked(game, c)) { SoundSystem.denied(); st.msg = ['まだ この 試合には 出られない。', c.lockHint]; st.msgColor = '#f88'; return; }
      if (game.gold < c.fee) { SoundSystem.denied(); st.denyAt = Date.now(); st.msg = ['おかねが たりないようだ…']; st.msgColor = '#f88'; return; }
      SoundSystem.confirm();
      begin(game, c.id);
    }
  }

  // The banner at the top of a battle that belongs to a run
  function roundMessage(game) { return 'ラウンド ' + (game.arena.round + 1) + ' とっぱ！'; }

  // After a won round: next round, or the prize
  function afterRound(game) {
    var a = game.arena, c = course(a.id);
    a.round++;
    if (a.round < ROUNDS) {
      recover(game.party);
      BattleSystem.startBattle(game, c.rounds[a.round]);
      game.state = 'battle';
      return;
    }
    game.gold += c.prize;
    if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
    var lines = ['受付「見事だ！ ぜんぶ 勝ち抜いたな！', c.prize + 'G の しょうきんだ。」'];
    var flag = 'arena_clear_' + c.id;
    if (!game.flags[flag]) {
      game.flags[flag] = true;
      MapSystem.giveItem(game, c.first.item, c.first.count);
      lines.push('はじめての 優勝の ほうびに', ITEMS[c.first.item].name + ' x' + c.first.count + ' を 受け取った！');
    }
    SoundSystem.coin();
    game.arena = null; game.battle = null; game.currentNPC = null;
    game.dialogue = lines; game.dialogueIndex = 0; game.state = 'dialogue';
    if (typeof saveGame === 'function') saveGame();
  }

  // The party was wiped out: no game over, the arena patches everyone up and the fee is gone
  function afterLose(game) {
    game.party.forEach(function(p) { p.alive = true; p.hp = p.maxHp; p.mp = p.maxMp; p.poisoned = false; p.buffs = {}; p.defending = false; });
    game.arena = null; game.battle = null; game.currentNPC = null;
    game.dialogue = ['受付「やられたか… 今日は ここまでだ。', '手当ては しておいたぞ。', 'また 挑戦しに 来い！」'];
    game.dialogueIndex = 0; game.state = 'dialogue';
    if (typeof saveGame === 'function') saveGame();
  }

  function render(ctx, game) {
    var st = game.arenaState;
    if (!st) return;
    var now = Date.now();
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    var denyT = now - st.denyAt, shake = denyT < 450 ? Math.sin(denyT / 25) * (1 - denyT / 450) * 5 : 0;
    UI.drawWindow(ctx, 20, 20, 600, 36);
    UI.drawText(ctx, 'ハルカ闘技場  所持金:', 36, 30, '#ffd700');
    UI.drawText(ctx, game.gold + 'G', 246 + shake, 30, denyT < 450 ? '#f66' : '#ffd700');

    // Courses
    UI.drawWindow(ctx, 20, 66, 600, 170);
    for (var i = 0; i < ARENA.courses.length; i++) {
      var c = ARENA.courses[i], y = 82 + i * 50, open = unlocked(game, c);
      if (i === st.index) UI.drawText(ctx, UI.CURSOR, 34, y, '#ffd700');
      UI.drawText(ctx, (cleared(game, c) ? '★ ' : '') + (open ? c.name : '？？？？？'), 62, y, open ? '#fff' : '#667');
      if (open) UI.drawText(ctx, 'さんかひ ' + c.fee + 'G   しょうきん ' + c.prize + 'G', 62, y + 24, game.gold >= c.fee ? '#ffd700' : '#a88', UI.FONT_SMALL);
      else UI.drawText(ctx, c.lockHint, 62, y + 24, '#667', UI.FONT_SMALL);
    }

    // The selected course's three opponents
    UI.drawWindow(ctx, 20, 250, 600, 100);
    var sc = ARENA.courses[st.index];
    if (unlocked(game, sc)) {
      for (var r = 0; r < ROUNDS; r++) UI.drawText(ctx, (r + 1) + 'せん目: ' + enemyNames(sc.rounds[r]), 36, 262 + r * 26, '#cde', UI.FONT_SMALL);
    } else {
      UI.drawText(ctx, 'あいては ひみつだ…', 36, 262, '#667', UI.FONT_SMALL);
    }

    UI.drawWindow(ctx, 20, 362, 600, 100);
    if (st.msg) for (var m = 0; m < st.msg.length; m++) UI.drawText(ctx, st.msg[m], 40, 378 + m * 28, st.msgColor || '#fff');
    UI.drawText(ctx, '3れんせんの あいだ HP・MPが すこしずつ かいふくする。にげられない。', 36, 440, '#9bd', UI.FONT_SMALL);
    ctx.restore();
  }

  return { ROUNDS: ROUNDS, RECOVER: RECOVER, course: course, unlocked: unlocked, cleared: cleared, recover: recover,
           open: open, update: update, begin: begin, roundMessage: roundMessage, afterRound: afterRound, afterLose: afterLose, render: render };
})();
