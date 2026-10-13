// ============================================================
// dice.js — the dice stall (サイコロ屋) in Haruka Waystation
// Two dice; bet on 大 (8+), 小 (6 or less) or 7. Nothing is saved: each bet resolves on the spot.
// ============================================================

var DiceSystem = (function() {
  var BETS = [50, 100, 200, 500];
  var PICKS = [
    { id: 'hi',    name: '大 (8 いじょう)', odds: 2.2 },
    { id: 'seven', name: '7',               odds: 5.5 },
    { id: 'lo',    name: '小 (6 いか)',     odds: 2.2 },
  ];

  // Gold paid back for a winning bet (the bet itself is taken when the dice roll)
  function payout(bet, odds) { return Math.floor(bet * odds); }
  function wins(pickId, total) {
    return pickId === 'hi' ? total >= 8 : pickId === 'lo' ? total <= 6 : total === 7;
  }
  function die() { return 1 + Math.floor(Math.random() * 6); }
  // Plays one round: returns { d1, d2, total, win, back } and the caller adjusts the gold
  function resolve(bet, pickId) {
    var d1 = die(), d2 = die(), total = d1 + d2, win = wins(pickId, total);
    var pick = PICKS.filter(function(p) { return p.id === pickId; })[0];
    return { d1: d1, d2: d2, total: total, win: win, back: win ? payout(bet, pick.odds) : 0 };
  }

  function open(game) {
    game.diceState = { phase: 'bet', betIndex: 0, pickIndex: 0, msg: ['いらっしゃい！ 一勝負 どうだい？', 'かけるのは 50G から 500G まで だ。'], msgColor: null, result: null, rollAt: 0, denyAt: 0 };
    game.state = 'dice';
    SoundSystem.doorBell();
  }
  function close(game) { game.state = 'map'; game.diceState = null; }

  function update(game, input) {
    var ds = game.diceState, now = Date.now();
    if (ds.phase === 'bet') {
      if (input === 'cancel') { SoundSystem.cancel(); close(game); return; }
      if (input === 'up') { ds.betIndex = (ds.betIndex - 1 + BETS.length) % BETS.length; SoundSystem.cursor(); }
      if (input === 'down') { ds.betIndex = (ds.betIndex + 1) % BETS.length; SoundSystem.cursor(); }
      if (input === 'confirm') {
        if (game.gold < BETS[ds.betIndex]) { SoundSystem.denied(); ds.denyAt = now; ds.msg = ['おかねが たりないようだ…']; ds.msgColor = '#f88'; return; }
        SoundSystem.confirm(); ds.phase = 'pick'; ds.msg = ['なにに かける？', '大・小は 2.2ばい、7は 5.5ばい だ！']; ds.msgColor = null;
      }
    } else if (ds.phase === 'pick') {
      if (input === 'cancel') { SoundSystem.cancel(); ds.phase = 'bet'; ds.msg = null; return; }
      if (input === 'up') { ds.pickIndex = (ds.pickIndex - 1 + PICKS.length) % PICKS.length; SoundSystem.cursor(); }
      if (input === 'down') { ds.pickIndex = (ds.pickIndex + 1) % PICKS.length; SoundSystem.cursor(); }
      if (input === 'confirm') {
        var bet = BETS[ds.betIndex];
        game.gold -= bet;
        ds.result = resolve(bet, PICKS[ds.pickIndex].id);
        ds.bet = bet; ds.phase = 'roll'; ds.rollAt = now; ds.msg = ['それっ！']; ds.msgColor = null; ds.tick = 0;
        SoundSystem.confirm();
      }
    } else if (ds.phase === 'roll') {
      var t = now - ds.rollAt;
      if (t / 120 > ds.tick) { ds.tick++; SoundSystem.cursor(); }   // rattling ticks
      if (t >= 1300) {
        var r = ds.result;
        ds.phase = 'result';
        if (r.win) {
          game.gold += r.back;
          if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
          SoundSystem.coin();
          ds.msg = ['出目は ' + r.d1 + ' と ' + r.d2 + '、合計 ' + r.total + '！', '当たり！ ' + r.back + 'G を てにいれた！（+' + (r.back - ds.bet) + 'G）'];
          ds.msgColor = '#ffd700';
        } else {
          SoundSystem.denied();
          ds.msg = ['出目は ' + r.d1 + ' と ' + r.d2 + '、合計 ' + r.total + '…', 'はずれ！ ' + ds.bet + 'G を うしなった。'];
          ds.msgColor = '#f88';
        }
      }
    } else if (ds.phase === 'result') {
      if (input === 'confirm' || input === 'cancel') {
        if (game.gold < BETS[0]) { SoundSystem.cancel(); close(game); return; }   // not even the smallest bet is left
        while (ds.betIndex > 0 && game.gold < BETS[ds.betIndex]) ds.betIndex--;
        ds.phase = 'bet'; ds.msg = ['もういっぺん どうだい？']; ds.msgColor = null; SoundSystem.confirm();
      }
    }
  }

  // One die face: a rounded square with pips
  var PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  function drawDie(ctx, x, y, n, jitter) {
    ctx.save();
    ctx.translate(x + 28, y + 28);
    ctx.rotate(jitter || 0);
    ctx.fillStyle = '#f4f0e0'; ctx.fillRect(-28, -28, 56, 56);
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 3; ctx.strokeRect(-28, -28, 56, 56);
    ctx.fillStyle = n === 1 ? '#c33' : '#222';
    PIPS[n].forEach(function(p) { ctx.beginPath(); ctx.arc(-16 + p[0] * 16, -16 + p[1] * 16, 5, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  function render(ctx, game) {
    var ds = game.diceState;
    if (!ds) return;
    var now = Date.now();
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    var denyT = now - ds.denyAt, shake = denyT < 450 ? Math.sin(denyT / 25) * (1 - denyT / 450) * 5 : 0;
    UI.drawWindow(ctx, 20, 20, 600, 36);
    UI.drawText(ctx, 'サイコロ屋  所持金:', 36, 30, '#ffd700');
    UI.drawText(ctx, game.gold + 'G', 216 + shake, 30, denyT < 450 ? '#f66' : '#ffd700');

    // The dice
    UI.drawWindow(ctx, 20, 66, 330, 150);
    var rolling = ds.phase === 'roll' && now - ds.rollAt < 1300;
    var f1 = 1, f2 = 1, j1 = 0, j2 = 0;
    if (rolling) { var k = Math.floor(now / 70); f1 = 1 + (k * 7) % 6; f2 = 1 + (k * 11 + 3) % 6; j1 = Math.sin(now / 40) * 0.3; j2 = Math.cos(now / 35) * 0.3; }
    else if (ds.result && (ds.phase === 'roll' || ds.phase === 'result')) { f1 = ds.result.d1; f2 = ds.result.d2; }
    drawDie(ctx, 70, 100, f1, j1);
    drawDie(ctx, 200, 100, f2, j2);

    // Bets and picks
    UI.drawWindow(ctx, 366, 66, 254, 150);
    UI.drawText(ctx, 'かけきん', 384, 76, '#9bd', UI.FONT_SMALL);
    for (var i = 0; i < BETS.length; i++) {
      var by = 100 + i * 26, ok = game.gold >= BETS[i];
      if (i === ds.betIndex) UI.drawText(ctx, ds.phase === 'bet' ? UI.CURSOR : '◆', 380, by, '#ffd700', UI.FONT_SMALL);
      UI.drawText(ctx, BETS[i] + 'G', 408, by, ok ? '#fff' : '#667', UI.FONT_SMALL);
    }
    if (ds.phase !== 'bet') {
      UI.drawText(ctx, 'なにに？', 500, 76, '#9bd', UI.FONT_SMALL);
      for (var j = 0; j < PICKS.length; j++) {
        var py = 110 + j * 30;
        if (j === ds.pickIndex) UI.drawText(ctx, ds.phase === 'pick' ? UI.CURSOR : '◆', 480, py, '#ffd700', UI.FONT_SMALL);
        UI.drawText(ctx, PICKS[j].id === 'seven' ? '7' : PICKS[j].id === 'hi' ? '大' : '小', 504, py, '#fff', UI.FONT_SMALL);
      }
    }

    UI.drawWindow(ctx, 20, 232, 600, 100);
    if (ds.msg) for (var m = 0; m < ds.msg.length; m++) UI.drawText(ctx, ds.msg[m], 40, 250 + m * 28, ds.msgColor || '#fff');
    UI.drawText(ctx, '大・小: 2.2ばい   7: 5.5ばい', 36, 350, '#9bd', UI.FONT_SMALL);
    ctx.restore();
  }

  return { BETS: BETS, PICKS: PICKS, payout: payout, wins: wins, resolve: resolve, open: open, update: update, render: render };
})();
