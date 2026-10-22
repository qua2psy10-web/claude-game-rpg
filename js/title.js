// ============================================================
// title.js — The title screen, New Game+ and the opening cinematic glue.
// Plain global functions shared with main.js (the state machine); load it before main.js.
// ============================================================

// ===== TITLE SCREEN =====
var TITLE_MENU_AT = 2600;   // ms after the title starts at which the menu has faded in

function updateTitle() {
  var input = getInput();
  var now = Date.now();
  if (!game.titleT0) game.titleT0 = now;
  var tt = now - game.titleT0;

  // Fading out into a new / loaded game
  if (game.titleGo) {
    if (now - game.titleGo.t0 > 650) {
      var go = game.titleGo, next = go.next;
      game.titleGo = null;
      var gs = go.slot || 1;
      if (next === 'new') newGame(gs); else if (next === 'ng') newGamePlus(go.src || 1, gs); else loadGame(gs);
    }
    return;
  }
  // Any confirm during the intro animation just skips to the finished title
  if (tt < TITLE_MENU_AT) {
    if (input === 'confirm') game.titleT0 = now - TITLE_MENU_AT;
    return;
  }

  // The slot picker (はじめから / つづきから / つよくてニューゲーム) takes over the input
  if (game.slotPick) {
    var pk = game.slotPick, res = SlotSystem.update(pk, input);
    if (res && res.close) { game.slotPick = null; if (pk.mode === 'ngDst') game.slotPick = SlotSystem.open('ngSrc'); }
    else if (res && pk.mode === 'ngSrc') { SoundSystem.confirm(); game.slotPick = SlotSystem.open('ngDst', res.slot); }
    else if (res) {
      SoundSystem.gameStart();
      game.titleGo = { t0: now, next: pk.mode === 'ngDst' ? 'ng' : pk.mode, slot: res.slot, src: res.src };
      game.slotPick = null;
    }
    return;
  }

  var hasSave = SlotSystem.anySave();
  var items = titleItems(), n = items.length;
  if (game.titleIndex >= n) game.titleIndex = 0;
  if (input === 'up') { game.titleIndex = (game.titleIndex - 1 + n) % n; SoundSystem.cursor(); }
  if (input === 'down') { game.titleIndex = (game.titleIndex + 1) % n; SoundSystem.cursor(); }
  if (input === 'confirm') {
    var sel = items[game.titleIndex];
    if (sel === 'はじめから') {
      SoundSystem.confirm();
      game.slotPick = SlotSystem.open('new');
    } else if (sel === 'つづきから' && hasSave) {
      SoundSystem.confirm();
      game.slotPick = SlotSystem.open('load');
    } else if (sel === 'つよくてニューゲーム') {
      SoundSystem.confirm();
      game.slotPick = SlotSystem.open('ngSrc');
    } else if (sel === 'せってい') {
      SoundSystem.confirm();
      game.settings = { index: 0 };
    } else if (sel === 'つづきから') {
      SoundSystem.cancel();   // no readable save in any slot
    }
  }
}

// The title menu: 「つよくてニューゲーム」 appears once the saved game has beaten the Demon King
function titleItems() {
  var items = ['はじめから', 'つづきから'];
  if (SlotSystem.anyCleared()) items.push('つよくてニューゲーム');
  items.push('せってい');
  return items;
}

// New Game+: restart from the village with the saved game's levels, gear, items, ずかん and achievements.
// Flags (bosses, chests, story) and gold reset, and every enemy is tougher (cycleScale). No opening cinematic.
function newGamePlus(src, dst) {
  if (!loadGame(src || 1)) { newGame(dst || 1); return; }
  var carry = { party: game.party, items: game.inventory, equip: game.equipInventory, bestiary: game.bestiary,
                achieved: game.achieved, hints: game.hints, cycle: (game.cycle || 1) + 1 };
  newGame(dst || src || 1);
  game.party = carry.party;
  game.party.forEach(function(c) { c.hp = c.maxHp; c.mp = c.maxMp; c.alive = true; c.buffs = {}; c.defending = false; c.poisoned = false; });
  game.inventory = carry.items; game.equipInventory = carry.equip;
  game.bestiary = carry.bestiary; game.achieved = carry.achieved; game.hints = carry.hints;
  game.cycle = carry.cycle;
  game.dialogue = [
    'ふたたび ミルヘイブン村。',
    '魔王を 倒したはずの 世界に また',
    '闇の気配が 広がっている…',
    '(' + game.cycle + 'しゅうめ: てきが つよくなっている！)',
  ];
  game.dialogueIndex = 0;
  game.opening = null;
  game.state = 'dialogue';
  saveGame();
}

// ===== OPENING CINEMATIC (new game) =====
function updateOpening() {
  var op = game.opening;
  if (!op) { game.state = 'dialogue'; return; }
  var now = Date.now(), t = now - op.t0;
  if (!op.skipAt) {
    while (op.cue < OpeningSystem.CUES.length && t >= OpeningSystem.CUES[op.cue].t) {
      SoundSystem[OpeningSystem.CUES[op.cue].fn]();
      op.cue++;
    }
    var input = getInput();
    if (t > 300 && (input === 'confirm' || input === 'cancel')) op.skipAt = now;
  }
  if ((op.skipAt && now - op.skipAt > 450) || t >= OpeningSystem.DURATION) {
    game.opening = null;
    game.state = 'dialogue';
    game.dialogueIndex = 0;
  }
}

function renderOpening(ctx) {
  var op = game.opening;
  if (!op) return;
  var now = Date.now();
  OpeningSystem.render(ctx, now - op.t0, op.skipAt ? Math.min(1, (now - op.skipAt) / 450) : 0);
}

function renderTitle(ctx) {
  var now = Date.now();
  if (!game.titleT0) game.titleT0 = now;
  var tt = now - game.titleT0;

  // Night landscape: calm sky, the far castle smoulders, lightning now and then
  var lc = tt % 11000, flash = 0;
  if (lc > 10200 && lc < 10650) flash = (1 - (lc - 10200) / 450) * (lc < 10290 ? 1 : 0.7);
  OpeningSystem.drawScene(ctx, { t: now, storm: 0.22, castle: Math.min(1, tt / 900), glow: 0.3 + 0.1 * Math.sin(now / 900), flash: flash, dawn: 0, heroes: 0 });
  ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, 1 - tt / 700) + ')'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);   // fade in

  // Logo, then the subtitles and the menu fade in
  var landed = OpeningSystem.drawLogo(ctx, tt);
  ctx.textAlign = 'center';
  ctx.globalAlpha = Math.max(0, Math.min(1, (tt - landed) / 500));
  ctx.fillStyle = '#c8c8d8';
  ctx.font = '14px monospace';
  ctx.fillText('~ The Chronicles of Eldrasia ~', CANVAS_W / 2, 158);
  ctx.globalAlpha = Math.max(0, Math.min(1, (tt - landed - 350) / 500));
  ctx.fillStyle = '#9bd';
  ctx.font = '16px monospace';
  ctx.fillText('勇者サム、魔法使いダリオ、僧侶スンダーの冒険', CANVAS_W / 2, 200);
  ctx.globalAlpha = 1;
  var menuA = Math.max(0, Math.min(1, (tt - TITLE_MENU_AT + 400) / 400));
  ctx.save();
  ctx.globalAlpha = menuA;

  // Menu
  ctx.textAlign = 'left';
  var anySave = SlotSystem.anySave();
  var menuItems = titleItems();
  var menuH = 24 + menuItems.length * 28;
  UI.drawWindow(ctx, 220, 280, 200 + (menuItems.length > 3 ? 40 : 0), menuH);
  for (var j = 0; j < menuItems.length; j++) {
    var ty = 296 + j * 28;
    if (j === game.titleIndex && !game.slotPick) {
      var blink2 = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink2) UI.drawText(ctx, UI.CURSOR, 234, ty);
    }
    var itemColor = (menuItems[j] === 'つづきから' && !anySave) ? '#555' : '#fff';
    UI.drawText(ctx, menuItems[j], 258, ty, itemColor);
  }

  // Score records (right of menu, shown once any battle has been won)
  if (gameScore.battlesWon > 0 && !game.slotPick) {
    var rx = menuItems.length > 3 ? 470 : 430;   // clear of the wider menu
    UI.drawWindow(ctx, rx, 280, 640 - rx - 14, 130);
    UI.drawText(ctx, '【記録】', rx + 16, 292, '#ffd700', UI.FONT_SMALL);
    UI.drawText(ctx, '戦闘勝利: ' + gameScore.battlesWon + '回', rx + 16, 310, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, '倒した敵: ' + gameScore.enemiesDefeated + '体', rx + 16, 328, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, '最高所持金: ' + gameScore.highGold + 'G', rx + 16, 346, '#ffd700', UI.FONT_SMALL);
    UI.drawText(ctx, 'ボス討伐: ' + gameScore.bossesDefeated + '体', rx + 16, 364, gameScore.bossesDefeated > 0 ? '#f88' : '#555', UI.FONT_SMALL);
    var ptSec = Math.floor(gameScore.playTime), ptMin = Math.floor(ptSec / 60); ptSec %= 60;
    UI.drawText(ctx, 'プレイ: ' + ptMin + ':' + (ptSec < 10 ? '0' : '') + ptSec, rx + 16, 382, '#aaa', UI.FONT_SMALL);
  }

  if (game.slotPick) SlotSystem.render(ctx, game.slotPick);
  ctx.restore();

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#778';
  ctx.font = '12px monospace';
  ctx.fillText(tt < TITLE_MENU_AT ? 'Z: スキップ' : 'Arrow Keys: 移動   Z/Enter: 決定   X/Esc: キャンセル', CANVAS_W / 2, CANVAS_H - 20);
  ctx.textAlign = 'left';

  // Starting: a white flash, then the screen fades to black
  if (game.titleGo) {
    var gt = (now - game.titleGo.t0) / 650;
    ctx.fillStyle = 'rgba(255,248,220,' + Math.max(0, 0.8 * (1 - gt * 3)) + ')'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, Math.min(1, (gt - 0.2) / 0.8)) + ')'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}
