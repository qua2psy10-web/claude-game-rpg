// ============================================================
// endings.js — The game-over screen and the ending credits.
// Plain global functions shared with main.js (the state machine); load it before main.js.
// ============================================================

// ===== GAME OVER =====
function updateGameover() {
  var input = getInput();
  if (!game.goStart) {
    game.goStart = Date.now();
    SoundSystem.gameoverToll();
  }
  // Ignore the confirm key for a moment so a mashed Enter can't skip the scene
  if (input === 'confirm' && Date.now() - game.goStart > 1500) {
    game.state = 'title';
    game.titleIndex = 0; game.titleT0 = null; game.titleGo = null; game.slotPick = null;
    game.goStart = 0;
  }
}

// Game over scene: fog-wrapped graves for the three heroes, souls drifting up, falling ash,
// a slow letter-by-letter "GAME OVER" and a flickering candle glow
function renderGameover(ctx) {
  var now = Date.now();
  var t = game.goStart ? now - game.goStart : 0;
  var W = CANVAS_W, H = CANVAS_H, i;
  ctx.save();

  // Night sky fading in from black
  var sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05040a');
  sky.addColorStop(0.65, '#150a18');
  sky.addColorStop(1, '#2a0d14');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // Cold moon
  var mA = Math.min(1, t / 1500);
  var mg = ctx.createRadialGradient(470, 90, 4, 470, 90, 110);
  mg.addColorStop(0, 'rgba(220,225,255,' + (0.9 * mA) + ')');
  mg.addColorStop(0.15, 'rgba(180,190,255,' + (0.35 * mA) + ')');
  mg.addColorStop(1, 'rgba(60,60,120,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(300, 0, 340, 240);

  // Ground (behind the graves)
  var groundY = 360;
  var gg = ctx.createLinearGradient(0, groundY - 6, 0, H);
  gg.addColorStop(0, '#120a10');
  gg.addColorStop(1, '#050305');
  ctx.fillStyle = gg;
  ctx.fillRect(0, groundY - 2, W, H - groundY + 2);

  // Graves
  var names = game.party && game.party.length ? game.party.map(function(p) { return p.name; }) : ['サム', 'ダリオ', 'スンダー'];
  var cols = ['106,176,255', '255,122,192', '109,255,176'];
  for (i = 0; i < 3; i++) {
    var gx = 190 + i * 130;
    var rise = Math.min(1, Math.max(0, (t - 400 - i * 300) / 900));
    var gy = groundY + (1 - rise) * 80;
    ctx.fillStyle = '#3a3a48';
    ctx.beginPath();
    ctx.moveTo(gx - 28, gy);
    ctx.lineTo(gx - 28, gy - 62);
    ctx.arc(gx, gy - 62, 28, Math.PI, 0);
    ctx.lineTo(gx + 28, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#55556a';
    ctx.fillRect(gx - 28, gy - 62, 5, 62);
    ctx.fillStyle = '#26262f';
    ctx.fillRect(gx - 3, gy - 90 + 24, 6, 26);   // cross
    ctx.fillRect(gx - 10, gy - 90 + 32, 20, 6);
    ctx.fillStyle = 'rgba(220,220,235,' + rise + ')';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(names[i], gx, gy - 10);
    // soul wisp drifting up from each grave
    if (rise >= 1) {
      var sp = ((t - 1300 - i * 500) % 4200) / 4200;
      if (sp > 0) {
        var wx = gx + Math.sin(sp * 7 + i) * 16, wy = gy - 90 - sp * 150;
        var wa = Math.sin(Math.PI * sp) * 0.9;
        var wg = ctx.createRadialGradient(wx, wy, 1, wx, wy, 22);
        wg.addColorStop(0, 'rgba(' + cols[i] + ',' + wa + ')');
        wg.addColorStop(1, 'rgba(' + cols[i] + ',0)');
        ctx.fillStyle = wg;
        ctx.fillRect(wx - 24, wy - 24, 48, 48);
        ctx.fillStyle = 'rgba(255,255,255,' + wa + ')';
        ctx.beginPath(); ctx.arc(wx, wy, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Drifting fog in front of the graves
  for (i = 0; i < 3; i++) {
    var fx = ((now / (40 + i * 25)) + i * 200) % (W + 400) - 200;
    var fg = ctx.createRadialGradient(fx + 200, groundY + 6 + i * 6, 10, fx + 200, groundY + 6 + i * 6, 220);
    fg.addColorStop(0, 'rgba(150,140,170,0.22)');
    fg.addColorStop(1, 'rgba(150,140,170,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(fx - 20, groundY + 6 + i * 6 - 220, 440, 440);
  }

  // Falling ash / embers
  for (i = 0; i < 60; i++) {
    var ap = ((now / (5000 + (i % 7) * 600)) + i * 0.137) % 1;
    var ax = (i * 97) % W + Math.sin(now / 900 + i) * 12;
    var ay = ap * (H + 20) - 10;
    ctx.globalAlpha = Math.min(1, t / 800) * (0.25 + (i % 4) * 0.12);
    ctx.fillStyle = i % 5 === 0 ? '#ff7a3a' : '#9a96a8';
    ctx.fillRect(ax, ay, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Title: the subtitle fades in first, then GAME OVER letter by letter
  ctx.textAlign = 'center';
  var sa = Math.min(1, Math.max(0, (t - 300) / 900));
  ctx.fillStyle = 'rgba(204,68,68,' + sa + ')';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('全滅してしまった…', W / 2, 96 + (1 - sa) * -14);
  var word = 'GAME OVER';
  ctx.font = 'bold 48px monospace';
  var lw = 36;
  for (i = 0; i < word.length; i++) {
    var lt = (t - 1400 - i * 140) / 500;
    if (lt <= 0) continue;
    var la = Math.min(1, lt);
    var lx = W / 2 - (word.length - 1) * lw / 2 + i * lw;
    var ly = 156 + (1 - la) * -18 + Math.sin(now / 700 + i) * 1.5;
    ctx.shadowColor = '#c01818';
    ctx.shadowBlur = 16 * la;
    ctx.fillStyle = 'rgba(200,40,40,' + la + ')';
    ctx.fillText(word.charAt(i), lx, ly);
    ctx.shadowBlur = 0;
  }

  // Candle-like flicker over the whole scene, then a heavy vignette
  var fl = 0.04 + 0.03 * Math.sin(now / 90) * Math.sin(now / 230);
  ctx.fillStyle = 'rgba(255,120,60,' + Math.max(0, fl) + ')';
  ctx.fillRect(0, 0, W, H);
  var vg = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.45, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Prompt appears once the scene has settled
  if (t > 2800) {
    ctx.fillStyle = 'rgba(160,160,170,' + (0.45 + 0.35 * Math.sin(now / 350)) + ')';
    ctx.font = '14px monospace';
    ctx.fillText('Enterキーで タイトルに もどる', W / 2, 440);
  }
  // Fade in from black at the very start
  if (t < 700) {
    ctx.fillStyle = 'rgba(0,0,0,' + (1 - t / 700) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

// ===== ENDING =====
function updateEnding() {
  var input = getInput();
  if (input === 'confirm') {
    game.state = 'title';
  }
}

function renderEnding(ctx) {
  ctx.fillStyle = '#0a0a3a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  var starSeed = 99;
  for (var i = 0; i < 100; i++) {
    starSeed = (starSeed * 1103515245 + 12345) & 0x7fffffff;
    var sx = starSeed % CANVAS_W;
    starSeed = (starSeed * 1103515245 + 12345) & 0x7fffffff;
    var sy = starSeed % CANVAS_H;
    var blink = Math.sin(Date.now() / 300 + i) * 0.3 + 0.7;
    ctx.fillStyle = 'rgba(255,255,200,' + blink + ')';
    ctx.fillRect(sx, sy, 2, 2);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('魔王ヴァルザードを 倒した！', CANVAS_W / 2, 100);

  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  var lines = [
    'サム、ダリオ、スンダーの活躍により',
    'エルドラシアに 平和が 戻った。',
    '',
    '人々は 勇者たちの名を 永遠に語り継ぐだろう…',
    '',
    '〜 Fin 〜',
  ];
  for (var j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], CANVAS_W / 2, 170 + j * 32);
  }

  // Score summary
  var ptSec = Math.floor(gameScore.playTime), ptMin = Math.floor(ptSec / 60); ptSec %= 60;
  ctx.fillStyle = '#8ac';
  ctx.font = '14px monospace';
  ctx.fillText('倒した敵: ' + gameScore.enemiesDefeated + '体  勝利: ' + gameScore.battlesWon + '戦  最高所持金: ' + gameScore.highGold + 'G', CANVAS_W / 2, 380);
  ctx.fillText('プレイ時間: ' + ptMin + ':' + (ptSec < 10 ? '0' : '') + ptSec, CANVAS_W / 2, 402);

  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText('ありがとう ございました！', CANVAS_W / 2, 424);
  ctx.fillStyle = '#666';
  ctx.font = '12px monospace';
  ctx.fillText('クリアデータを セーブした。つづきから 冒険を 続けられる', CANVAS_W / 2, 440);
  ctx.fillText('Enterキーで タイトルに もどる', CANVAS_W / 2, 460);
  ctx.textAlign = 'left';
}
