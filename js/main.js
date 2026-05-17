// ============================================================
// main.js — Game loop, state machine, input handling
// ============================================================

var canvas, ctx;
var CANVAS_W = 640, CANVAS_H = 480;
var game = null;
var keysDown = {};
var keysPressed = {};
var lastTime = 0;
var moveTimer = 0;
var MOVE_DELAY = 8;

// ===== INITIALIZATION =====
function initGame() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  game = {
    state: 'title',
    titleIndex: 0,
    party: [],
    inventory: [],
    equipInventory: [],
    gold: 100,
    currentMap: 'millhaven',
    playerX: 8,
    playerY: 12,
    facing: 'down',
    steps: 0,
    flags: {},
    battle: null,
    dialogue: null,
    dialogueIndex: 0,
    currentNPC: null,
    pendingBoss: null,
    transitionTimer: 0,
    menuState: null,
    shopState: null,
    innState: null,
  };

  SoundSystem.init();
  MusicSystem.init(SoundSystem.getCtx());
  loadScore();

  document.addEventListener('keydown', function(e) {
    if (!keysDown[e.key]) keysPressed[e.key] = true;
    keysDown[e.key] = true;
    SoundSystem.resume(); // ブラウザのAutoplay制限対応
    e.preventDefault();
  });
  document.addEventListener('keyup', function(e) {
    keysDown[e.key] = false;
  });

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ===== CREATE NEW GAME =====
function newGame() {
  // Full reset of all game state
  game.party = [];
  game.inventory = [{ id: 'herb', count: 5 }];
  game.equipInventory = [];
  game.gold = 100;
  game.currentMap = 'millhaven';
  game.playerX = 8;
  game.playerY = 12;
  game.facing = 'down';
  game.steps = 0;
  game.flags = {};
  game.battle = null;
  game.currentNPC = null;
  game.pendingBoss = null;
  game.menuState = null;
  game.shopState = null;
  game.innState = null;
  game.transitionTimer = 0;
  moveTimer = 0;

  var charIds = ['sam', 'dario', 'sundar'];
  for (var i = 0; i < charIds.length; i++) {
    var def = CHARACTERS[charIds[i]];
    game.party.push({
      classId: charIds[i],
      name: def.name,
      class: def.class,
      level: 1,
      hp: def.baseStats.hp,
      maxHp: def.baseStats.hp,
      mp: def.baseStats.mp,
      maxMp: def.baseStats.mp,
      atk: def.baseStats.atk,
      def: def.baseStats.def,
      spd: def.baseStats.spd,
      int: def.baseStats.int,
      exp: 0,
      weapon: null,
      armor: null,
      accessory: null,
      alive: true,
      buffs: {},
      defending: false,
      color: def.color,
    });
  }

  game.dialogue = [
    'ここは ミルヘイブン村。',
    '北の果てに 魔王ヴァルザードが 復活した…',
    'サム、ダリオ、スンダーよ、',
    '世界を救う旅に 出発せよ！',
  ];
  game.dialogueIndex = 0;
  game.state = 'dialogue';
}

// ===== SAVE/LOAD SYSTEM =====
var SAVE_KEY = 'eldrasia_save';

// ===== SCORE SYSTEM (persists across new games and browser closes) =====
var SCORE_KEY = 'eldrasia_score';
var gameScore = { enemiesDefeated: 0, battlesWon: 0, bossesDefeated: 0, totalExp: 0, highGold: 0, playTime: 0 };

function loadScore() {
  try {
    var raw = localStorage.getItem(SCORE_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      gameScore.enemiesDefeated = s.enemiesDefeated || 0;
      gameScore.battlesWon     = s.battlesWon     || 0;
      gameScore.bossesDefeated = s.bossesDefeated || 0;
      gameScore.totalExp       = s.totalExp       || 0;
      gameScore.highGold       = s.highGold       || 0;
      gameScore.playTime       = s.playTime       || 0;
    }
  } catch(e) {}
}

function saveScore() {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(gameScore)); } catch(e) {}
}

function updateScoreAfterBattle(b) {
  var enemyCount = 0, bossCount = 0;
  for (var i = 0; i < b.enemies.length; i++) {
    if (!b.enemies[i].alive) {
      enemyCount++;
      if (b.enemies[i].boss) bossCount++;
    }
  }
  gameScore.enemiesDefeated += enemyCount;
  gameScore.bossesDefeated  += bossCount;
  gameScore.battlesWon++;
  gameScore.totalExp += b.totalExp;
  if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
  saveScore();
}

function saveGame() {
  try {
    var data = {
      party: game.party,
      inventory: game.inventory,
      equipInventory: game.equipInventory,
      gold: game.gold,
      currentMap: game.currentMap,
      playerX: game.playerX,
      playerY: game.playerY,
      facing: game.facing,
      steps: game.steps,
      flags: game.flags,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
    saveScore();
  } catch(e) {}
}

function loadGame() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    game.party = data.party;
    game.inventory = data.inventory || [];
    game.equipInventory = data.equipInventory || [];
    game.gold = data.gold || 0;
    game.currentMap = data.currentMap || 'millhaven';
    game.playerX = data.playerX || 8;
    game.playerY = data.playerY || 12;
    game.facing = data.facing || 'down';
    game.steps = data.steps || 0;
    game.flags = data.flags || {};
    game.battle = null;
    game.currentNPC = null;
    game.pendingBoss = null;
    game.menuState = null;
    game.shopState = null;
    game.innState = null;
    game.transitionTimer = 0;
    moveTimer = 0;
    game.state = 'map';
    return true;
  } catch(e) {
    return false;
  }
}

function getSaveInfo() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch(e) {
    return null;
  }
}


function getInput() {
  var input = null;
  if (keysPressed['ArrowUp'] || keysPressed['w']) input = 'up';
  else if (keysPressed['ArrowDown'] || keysPressed['s']) input = 'down';
  else if (keysPressed['ArrowLeft'] || keysPressed['a']) input = 'left';
  else if (keysPressed['ArrowRight'] || keysPressed['d']) input = 'right';
  else if (keysPressed['z'] || keysPressed['Z'] || keysPressed['Enter'] || keysPressed[' ']) input = 'confirm';
  else if (keysPressed['x'] || keysPressed['X'] || keysPressed['Escape']) input = 'cancel';
  return input;
}

function isMoving() {
  return keysDown['ArrowUp'] || keysDown['ArrowDown'] || keysDown['ArrowLeft'] || keysDown['ArrowRight'] ||
         keysDown['w'] || keysDown['s'] || keysDown['a'] || keysDown['d'];
}

function getMoveDir() {
  if (keysDown['ArrowUp'] || keysDown['w']) return { dx: 0, dy: -1 };
  if (keysDown['ArrowDown'] || keysDown['s']) return { dx: 0, dy: 1 };
  if (keysDown['ArrowLeft'] || keysDown['a']) return { dx: -1, dy: 0 };
  if (keysDown['ArrowRight'] || keysDown['d']) return { dx: 1, dy: 0 };
  return null;
}

// ===== BGM MANAGEMENT =====
var _currentBgm = null;

function getMapBgm(mapId) {
  // 村・ショップ系 → タウン曲、それ以外 → フィールド曲
  var townMaps = ['millhaven', 'itemShop', 'weaponShop', 'armorShop'];
  return (townMaps.indexOf(mapId) >= 0) ? 'town' : 'field';
}

function setBgm(name) {
  if (_currentBgm === name) return;
  _currentBgm = name;
  if (name === null) { MusicSystem.stop(); return; }
  MusicSystem.changeTo(name);
}

function updateBgm() {
  var s = game.state;
  if (s === 'title')                                          return setBgm('title');
  if (s === 'battle')                                         return setBgm('battle');
  if (s === 'gameover' || s === 'ending')                     return setBgm(null);
  if (s === 'map' || s === 'menu'     || s === 'dialogue' ||
      s === 'shop' || s === 'inn'     || s === 'mapTransition') {
    return setBgm(getMapBgm(game.currentMap));
  }
}

// ===== MAIN GAME LOOP =====
function gameLoop(timestamp) {
  var dt = timestamp - lastTime;
  lastTime = timestamp;

  if (game.state !== 'title') gameScore.playTime += dt / 1000;

  update(dt);
  render();

  keysPressed = {};
  requestAnimationFrame(gameLoop);
}

// ===== UPDATE =====
function update(dt) {
  updateBgm();
  switch (game.state) {
    case 'title':
      updateTitle();
      break;
    case 'map':
      updateMap(dt);
      break;
    case 'mapTransition':
      updateTransition();
      break;
    case 'battle':
      updateBattle();
      break;
    case 'dialogue':
      updateDialogue();
      break;
    case 'menu':
      updateMenu();
      break;
    case 'shop':
      updateShop();
      break;
    case 'inn':
      updateInn();
      break;
    case 'gameover':
      updateGameover();
      break;
    case 'ending':
      updateEnding();
      break;
  }
}

// ===== TITLE SCREEN =====
function updateTitle() {
  var input = getInput();
  var hasSave = !!getSaveInfo();
  if (input === 'up') { game.titleIndex = (game.titleIndex - 1 + 2) % 2; SoundSystem.cursor(); }
  if (input === 'down') { game.titleIndex = (game.titleIndex + 1) % 2; SoundSystem.cursor(); }
  if (input === 'confirm') {
    if (game.titleIndex === 0) {
      SoundSystem.confirm();
      newGame();
    } else if (game.titleIndex === 1 && hasSave) {
      SoundSystem.confirm();
      loadGame();
    }
  }
}

function renderTitle(ctx) {
  // Background
  ctx.fillStyle = '#0a0a2a';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  var starSeed = 42;
  for (var i = 0; i < 80; i++) {
    starSeed = (starSeed * 1103515245 + 12345) & 0x7fffffff;
    var sx = starSeed % CANVAS_W;
    starSeed = (starSeed * 1103515245 + 12345) & 0x7fffffff;
    var sy = starSeed % (CANVAS_H - 100);
    var blink = Math.sin(Date.now() / 500 + i) * 0.3 + 0.7;
    ctx.fillStyle = 'rgba(255,255,200,' + blink + ')';
    ctx.fillRect(sx, sy, 2, 2);
  }

  // Title text
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('エルドラシア戦記', CANVAS_W / 2, 120);

  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('~ The Chronicles of Eldrasia ~', CANVAS_W / 2, 158);

  // Subtitle
  ctx.fillStyle = '#8ac';
  ctx.font = '16px monospace';
  ctx.fillText('勇者サム、魔法使いダリオ、僧侶スンダーの冒険', CANVAS_W / 2, 200);

  // Menu
  ctx.textAlign = 'left';
  var saveInfo = getSaveInfo();
  var menuH = saveInfo ? 108 : 80;
  UI.drawWindow(ctx, 220, 280, 200, menuH);
  var menuItems = ['はじめから', 'つづきから'];
  for (var j = 0; j < menuItems.length; j++) {
    var ty = 296 + j * 28;
    if (j === game.titleIndex) {
      var blink2 = Math.floor(Date.now() / 500) % 2 === 0;
      if (blink2) UI.drawText(ctx, UI.CURSOR, 234, ty);
    }
    var itemColor = (j === 1 && !saveInfo) ? '#555' : '#fff';
    UI.drawText(ctx, menuItems[j], 258, ty, itemColor);
  }
  if (saveInfo) {
    var mapName = MAPS[saveInfo.currentMap] ? MAPS[saveInfo.currentMap].name : '？';
    var leadLv = saveInfo.party && saveInfo.party[0] ? 'Lv.' + saveInfo.party[0].level : '';
    var goldStr = (saveInfo.gold || 0) + 'G';
    UI.drawText(ctx, mapName + '  ' + leadLv + '  ' + goldStr, 238, 356, '#aaa', UI.FONT_SMALL);
  }

  // Score records (right of menu, shown once any battle has been won)
  if (gameScore.battlesWon > 0) {
    UI.drawWindow(ctx, 430, 280, 196, 130);
    UI.drawText(ctx, '【記録】', 446, 292, '#ffd700', UI.FONT_SMALL);
    UI.drawText(ctx, '戦闘勝利: ' + gameScore.battlesWon + '回', 446, 310, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, '倒した敵: ' + gameScore.enemiesDefeated + '体', 446, 328, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, '最高所持金: ' + gameScore.highGold + 'G', 446, 346, '#ffd700', UI.FONT_SMALL);
    UI.drawText(ctx, 'ボス討伐: ' + gameScore.bossesDefeated + '体', 446, 364, gameScore.bossesDefeated > 0 ? '#f88' : '#555', UI.FONT_SMALL);
    var ptSec = Math.floor(gameScore.playTime), ptMin = Math.floor(ptSec / 60); ptSec %= 60;
    UI.drawText(ctx, 'プレイ: ' + ptMin + ':' + (ptSec < 10 ? '0' : '') + ptSec, 446, 382, '#aaa', UI.FONT_SMALL);
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#555';
  ctx.font = '12px monospace';
  ctx.fillText('Arrow Keys: 移動   Z/Enter: 決定   X/Esc: キャンセル', CANVAS_W / 2, CANVAS_H - 20);
  ctx.textAlign = 'left';
}

// ===== MAP UPDATES =====
function updateMap(dt) {
  var input = getInput();

  // Menu open
  if (input === 'cancel') {
    game.menuState = { index: 0, subState: null, subIndex: 0, charIndex: 0, equipIndex: 0 };
    game.state = 'menu';
    return;
  }

  // Interact with NPC
  if (input === 'confirm') {
    MapSystem.interact(game);
    return;
  }

  // Movement: first press via keysPressed, hold-repeat via moveTimer
  if (input === 'up' || input === 'down' || input === 'left' || input === 'right') {
    var dirs = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };
    var d = dirs[input];
    if (d) {
      MapSystem.movePlayer(game, d.dx, d.dy);
      moveTimer = 0;
    }
  } else if (isMoving()) {
    moveTimer++;
    if (moveTimer >= MOVE_DELAY) {
      var dir = getMoveDir();
      if (dir) {
        MapSystem.movePlayer(game, dir.dx, dir.dy);
        moveTimer = 0;
      }
    }
  } else {
    moveTimer = 0;
  }
}

function updateTransition() {
  game.transitionTimer--;
  if (game.transitionTimer <= 0) game.state = 'map';
}

// ===== DIALOGUE =====
function updateDialogue() {
  var input = getInput();
  if (input === 'confirm') {
    game.dialogueIndex++;
    if (game.dialogueIndex >= game.dialogue.length) {
      // Check for pending actions
      if (game.currentNPC) {
        if (game.currentNPC.shop) {
          openShop(game.currentNPC.shop);
          game.currentNPC = null;
          return;
        }
        if (game.currentNPC.inn) {
          game.innState = { cost: game.currentNPC.inn, index: 0 };
          game.state = 'inn';
          game.currentNPC = null;
          return;
        }
        game.currentNPC = null;
      }
      if (game.pendingBoss && game.dialogue === game.pendingBoss.preBattle) {
        BattleSystem.startBattle(game, [game.pendingBoss.enemy]);
        return;
      }
      game.state = 'map';
      game.dialogue = null;
    }
  }
}

function renderDialogue(ctx) {
  if (!game.dialogue || game.dialogueIndex >= game.dialogue.length) return;
  // Show up to 3 lines
  var startLine = Math.max(0, game.dialogueIndex - 2);
  var lines = [];
  for (var i = startLine; i <= game.dialogueIndex; i++) {
    if (i < game.dialogue.length) lines.push(game.dialogue[i]);
  }
  UI.drawMessageWindow(ctx, lines, CANVAS_W, CANVAS_H);
  // Blinking arrow
  if (Math.floor(Date.now() / 400) % 2 === 0) {
    UI.drawText(ctx, '▼', CANVAS_W - 30, CANVAS_H - 20, '#fff');
  }
}

// ===== PARTY MENU =====
function updateMenu() {
  var input = getInput();
  var ms = game.menuState;

  if (!ms.subState) {
    // Main menu
    var menuItems = ['どうぐ', 'そうび', 'つよさ', 'とじる'];
    if (input === 'up') { ms.index = (ms.index - 1 + menuItems.length) % menuItems.length; SoundSystem.cursor(); }
    if (input === 'down') { ms.index = (ms.index + 1) % menuItems.length; SoundSystem.cursor(); }
    if (input === 'cancel') { SoundSystem.cancel(); saveGame(); game.state = 'map'; game.menuState = null; return; }
    if (input === 'confirm') {
      if (ms.index === 3) { SoundSystem.cancel(); saveGame(); game.state = 'map'; game.menuState = null; return; }
      if (ms.index === 0) ms.subState = 'items';
      if (ms.index === 1) { ms.subState = 'equipChar'; ms.charIndex = 0; }
      if (ms.index === 2) { ms.subState = 'stats'; ms.charIndex = 0; }
    }
  } else if (ms.subState === 'items') {
    if (input === 'cancel') { ms.subState = null; return; }
    if (game.inventory.length === 0) { ms.subState = null; return; }
    if (input === 'up') ms.subIndex = (ms.subIndex - 1 + game.inventory.length) % game.inventory.length;
    if (input === 'down') ms.subIndex = (ms.subIndex + 1) % game.inventory.length;
    if (input === 'confirm') {
      var inv = game.inventory[ms.subIndex];
      var item = ITEMS[inv.id];
      if (item && item.type === 'heal') {
        // Use on party member with lowest HP ratio
        var target = BattleSystem.findHealTarget(game);
        var p = game.party[target];
        if (p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + item.power);
          inv.count--;
          if (inv.count <= 0) game.inventory.splice(ms.subIndex, 1);
        }
      } else if (item && item.type === 'healMp') {
        for (var i = 0; i < game.party.length; i++) {
          if (game.party[i].mp < game.party[i].maxMp) {
            game.party[i].mp = Math.min(game.party[i].maxMp, game.party[i].mp + item.power);
            inv.count--;
            if (inv.count <= 0) game.inventory.splice(ms.subIndex, 1);
            break;
          }
        }
      }
    }
  } else if (ms.subState === 'equipChar') {
    if (input === 'cancel') { ms.subState = null; return; }
    if (input === 'up') ms.charIndex = (ms.charIndex - 1 + game.party.length) % game.party.length;
    if (input === 'down') ms.charIndex = (ms.charIndex + 1) % game.party.length;
    if (input === 'confirm') { ms.subState = 'equipSlot'; ms.equipIndex = 0; }
  } else if (ms.subState === 'equipSlot') {
    if (input === 'cancel') { ms.subState = 'equipChar'; return; }
    var slots = ['weapon', 'armor', 'accessory'];
    if (input === 'up') ms.equipIndex = (ms.equipIndex - 1 + slots.length) % slots.length;
    if (input === 'down') ms.equipIndex = (ms.equipIndex + 1) % slots.length;
    if (input === 'confirm') {
      ms.subState = 'equipSelect';
      ms.subIndex = 0;
    }
  } else if (ms.subState === 'equipSelect') {
    var slotType = ['weapon', 'armor', 'accessory'][ms.equipIndex];
    var available = getEquipableItems(game, ms.charIndex, slotType);
    if (available.length === 0) { ms.subState = 'equipSlot'; return; }
    if (input === 'cancel') { ms.subState = 'equipSlot'; return; }
    if (input === 'up') ms.subIndex = (ms.subIndex - 1 + available.length) % available.length;
    if (input === 'down') ms.subIndex = (ms.subIndex + 1) % available.length;
    if (input === 'confirm') {
      equipItem(game, ms.charIndex, slotType, available[ms.subIndex]);
      ms.subState = 'equipSlot';
    }
  } else if (ms.subState === 'stats') {
    if (input === 'cancel') { ms.subState = null; return; }
    if (input === 'left') ms.charIndex = (ms.charIndex - 1 + game.party.length) % game.party.length;
    if (input === 'right') ms.charIndex = (ms.charIndex + 1) % game.party.length;
  }
}

function getEquipableItems(game, charIdx, slotType) {
  var charId = game.party[charIdx].classId;
  var items = [];
  for (var i = 0; i < game.equipInventory.length; i++) {
    var ei = game.equipInventory[i];
    var table = slotType === 'weapon' ? WEAPONS : slotType === 'armor' ? ARMORS : ACCESSORIES;
    var def = table[ei.id];
    if (def && ei.type === slotType) {
      if (!def.equip || def.equip.indexOf(charId) >= 0) {
        items.push(ei);
      }
    }
  }
  return items;
}

function equipItem(game, charIdx, slotType, equipEntry) {
  var char = game.party[charIdx];
  var table = slotType === 'weapon' ? WEAPONS : slotType === 'armor' ? ARMORS : ACCESSORIES;

  // Unequip current
  if (char[slotType]) {
    var oldDef = table[char[slotType]];
    if (oldDef) {
      if (oldDef.atk) char.atk -= oldDef.atk;
      if (oldDef.def) char.def -= oldDef.def;
      if (oldDef.int) char.int -= oldDef.int;
      if (oldDef.spd) char.spd -= oldDef.spd;
      if (oldDef.hp) { char.maxHp -= oldDef.hp; char.hp = Math.min(char.hp, char.maxHp); }
      game.equipInventory.push({ id: char[slotType], type: slotType });
    }
  }

  // Equip new
  var newDef = table[equipEntry.id];
  if (newDef.atk) char.atk += newDef.atk;
  if (newDef.def) char.def += newDef.def;
  if (newDef.int) char.int += newDef.int;
  if (newDef.spd) char.spd += newDef.spd;
  if (newDef.hp) { char.maxHp += newDef.hp; }
  char[slotType] = equipEntry.id;

  // Remove from inventory
  var idx = game.equipInventory.indexOf(equipEntry);
  if (idx >= 0) game.equipInventory.splice(idx, 1);
}

function renderMenu(ctx) {
  var ms = game.menuState;
  if (!ms) return;

  // Darken background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Main menu
  UI.drawMenu(ctx, 20, 20, 140, ['どうぐ', 'そうび', 'つよさ', 'とじる'], ms.index);

  // Gold
  UI.drawWindow(ctx, 20, 160, 140, 32);
  UI.drawText(ctx, game.gold + ' G', 34, 168, '#ffd700');

  // Party overview
  UI.drawWindow(ctx, 180, 20, 440, 160);
  for (var i = 0; i < game.party.length; i++) {
    var p = game.party[i];
    var py = 35 + i * 48;
    UI.drawText(ctx, p.name + ' Lv.' + p.level + ' (' + p.class + ')', 196, py, p.alive ? '#fff' : '#888');
    UI.drawText(ctx, 'HP ' + p.hp + '/' + p.maxHp + '  MP ' + p.mp + '/' + p.maxMp, 196, py + 20, '#aaa', UI.FONT_SMALL);
  }

  // Sub-menus
  if (ms.subState === 'items') {
    UI.drawWindow(ctx, 180, 200, 440, 260);
    UI.drawText(ctx, '【もちもの】', 196, 210, '#ffd700');
    if (game.inventory.length === 0) {
      UI.drawText(ctx, 'なにも もっていない', 220, 240);
    } else {
      for (var j = 0; j < game.inventory.length; j++) {
        var ty = 240 + j * 24;
        if (j === ms.subIndex) {
          UI.drawText(ctx, UI.CURSOR, 196, ty);
        }
        var item = ITEMS[game.inventory[j].id];
        UI.drawText(ctx, item.name + ' x' + game.inventory[j].count, 220, ty);
        UI.drawText(ctx, item.desc, 400, ty, '#aaa', UI.FONT_SMALL);
      }
    }
  }

  if (ms.subState === 'stats') {
    var ch = game.party[ms.charIndex];
    UI.drawWindow(ctx, 180, 200, 440, 260);
    UI.drawText(ctx, '【' + ch.name + 'の つよさ】 ◀ ▶ で切替', 196, 210, '#ffd700');
    var labels = ['レベル', 'HP', 'MP', 'こうげき力', 'しゅび力', 'すばやさ', 'かしこさ', 'けいけんち'];
    var values = [ch.level, ch.hp + '/' + ch.maxHp, ch.mp + '/' + ch.maxMp, ch.atk, ch.def, ch.spd, ch.int, ch.exp + '/' + expForLevel(ch.level + 1)];
    for (var k = 0; k < labels.length; k++) {
      UI.drawText(ctx, labels[k], 210, 240 + k * 24, '#ccc', UI.FONT_SMALL);
      UI.drawText(ctx, String(values[k]), 350, 240 + k * 24);
    }
    // Equipment
    var weaponName = ch.weapon ? WEAPONS[ch.weapon].name : 'なし';
    var armorName = ch.armor ? ARMORS[ch.armor].name : 'なし';
    var accName = ch.accessory ? ACCESSORIES[ch.accessory].name : 'なし';
    UI.drawText(ctx, 'ぶき: ' + weaponName, 450, 240, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, 'よろい: ' + armorName, 450, 264, '#aaa', UI.FONT_SMALL);
    UI.drawText(ctx, 'アクセ: ' + accName, 450, 288, '#aaa', UI.FONT_SMALL);
  }

  if (ms.subState === 'equipChar') {
    UI.drawWindow(ctx, 180, 200, 440, 120);
    UI.drawText(ctx, '【だれの装備？】', 196, 210, '#ffd700');
    for (var m = 0; m < game.party.length; m++) {
      var ey = 238 + m * 26;
      if (m === ms.charIndex) UI.drawText(ctx, UI.CURSOR, 196, ey);
      UI.drawText(ctx, game.party[m].name + ' (' + game.party[m].class + ')', 220, ey);
    }
  }

  if (ms.subState === 'equipSlot') {
    var ch2 = game.party[ms.charIndex];
    UI.drawWindow(ctx, 180, 200, 440, 160);
    UI.drawText(ctx, '【' + ch2.name + 'の装備】', 196, 210, '#ffd700');
    var slotNames = ['ぶき', 'よろい', 'アクセサリー'];
    var slotIds = ['weapon', 'armor', 'accessory'];
    for (var n = 0; n < 3; n++) {
      var sy = 240 + n * 28;
      if (n === ms.equipIndex) UI.drawText(ctx, UI.CURSOR, 196, sy);
      var tables = [WEAPONS, ARMORS, ACCESSORIES];
      var equipped = ch2[slotIds[n]] ? tables[n][ch2[slotIds[n]]].name : 'なし';
      UI.drawText(ctx, slotNames[n] + ': ' + equipped, 220, sy);
    }
  }

  if (ms.subState === 'equipSelect') {
    var slotType = ['weapon', 'armor', 'accessory'][ms.equipIndex];
    var available = getEquipableItems(game, ms.charIndex, slotType);
    UI.drawWindow(ctx, 180, 360, 440, 100);
    if (available.length === 0) {
      UI.drawText(ctx, '装備できるものがない', 200, 375);
    } else {
      for (var q = 0; q < available.length; q++) {
        var table = slotType === 'weapon' ? WEAPONS : slotType === 'armor' ? ARMORS : ACCESSORIES;
        var qy = 375 + q * 24;
        if (q === ms.subIndex) UI.drawText(ctx, UI.CURSOR, 196, qy);
        UI.drawText(ctx, table[available[q].id].name, 220, qy);
      }
    }
  }
}

// ===== SHOP SYSTEM =====
function openShop(shopId) {
  var shop = SHOPS[shopId];
  game.shopState = {
    shopId: shopId,
    index: 0,
    phase: 'list', // list, confirm
    confirmIndex: 0,
  };
  game.state = 'shop';
}

function updateShop() {
  var input = getInput();
  var ss = game.shopState;
  var shop = SHOPS[ss.shopId];

  if (ss.phase === 'list') {
    if (input === 'cancel') { game.state = 'map'; game.shopState = null; return; }
    if (input === 'up') ss.index = (ss.index - 1 + shop.items.length) % shop.items.length;
    if (input === 'down') ss.index = (ss.index + 1) % shop.items.length;
    if (input === 'confirm') {
      ss.phase = 'confirm';
      ss.confirmIndex = 0;
    }
  } else if (ss.phase === 'confirm') {
    if (input === 'cancel') { ss.phase = 'list'; return; }
    if (input === 'up' || input === 'down') ss.confirmIndex = 1 - ss.confirmIndex;
    if (input === 'confirm') {
      if (ss.confirmIndex === 0) {
        // Buy
        var si = shop.items[ss.index];
        var table = si.type === 'weapon' ? WEAPONS : si.type === 'armor' ? ARMORS : si.type === 'accessory' ? ACCESSORIES : ITEMS;
        var def = table[si.id];
        if (def && game.gold >= def.price) {
          game.gold -= def.price;
          if (si.type === 'item') {
            MapSystem.giveItem(game, si.id, 1);
          } else {
            game.equipInventory.push({ id: si.id, type: si.type });
          }
        }
      }
      ss.phase = 'list';
    }
  }
}

function renderShop(ctx) {
  var ss = game.shopState;
  if (!ss) return;
  var shop = SHOPS[ss.shopId];

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  UI.drawWindow(ctx, 20, 20, 600, 36);
  UI.drawText(ctx, shop.name + '  所持金: ' + game.gold + 'G', 36, 30, '#ffd700');

  UI.drawWindow(ctx, 20, 66, 600, shop.items.length * 28 + 30);
  for (var i = 0; i < shop.items.length; i++) {
    var si = shop.items[i];
    var table = si.type === 'weapon' ? WEAPONS : si.type === 'armor' ? ARMORS : si.type === 'accessory' ? ACCESSORIES : ITEMS;
    var def = table[si.id];
    var iy = 80 + i * 28;
    if (i === ss.index) UI.drawText(ctx, UI.CURSOR, 34, iy);
    var nameColor = game.gold >= def.price ? '#fff' : '#888';
    UI.drawText(ctx, def.name, 58, iy, nameColor);
    UI.drawText(ctx, def.price + 'G', 280, iy, '#ffd700');
    // Show stat bonus
    var bonus = '';
    if (def.atk) bonus += 'ATK+' + def.atk + ' ';
    if (def.def) bonus += 'DEF+' + def.def + ' ';
    if (def.int) bonus += 'INT+' + def.int + ' ';
    if (def.desc) bonus = def.desc;
    UI.drawText(ctx, bonus, 360, iy, '#aaa', UI.FONT_SMALL);
  }

  if (ss.phase === 'confirm') {
    UI.drawWindow(ctx, 200, 300, 200, 80);
    UI.drawText(ctx, 'かいますか？', 220, 312);
    var opts = ['はい', 'いいえ'];
    for (var j = 0; j < 2; j++) {
      if (j === ss.confirmIndex) UI.drawText(ctx, UI.CURSOR, 220, 340 + j * 24);
      UI.drawText(ctx, opts[j], 244, 340 + j * 24);
    }
  }

  UI.drawText(ctx, 'X: もどる', 500, CANVAS_H - 24, '#666', UI.FONT_SMALL);
}

// ===== INN =====
function updateInn() {
  var input = getInput();
  if (!game.innState) return;
  if (input === 'up' || input === 'down') game.innState.index = 1 - game.innState.index;
  if (input === 'cancel') { game.state = 'map'; game.innState = null; return; }
  if (input === 'confirm') {
    if (game.innState.index === 0 && game.gold >= game.innState.cost) {
      game.gold -= game.innState.cost;
      for (var i = 0; i < game.party.length; i++) {
        game.party[i].hp = game.party[i].maxHp;
        game.party[i].mp = game.party[i].maxMp;
        game.party[i].alive = true;
      }
      SoundSystem.inn();
      saveGame();
      game.dialogue = ['おやすみなさい…', '…………', 'HP と MP が 全回復した！'];
      game.dialogueIndex = 0;
      game.state = 'dialogue';
      game.innState = null;
    } else if (game.innState.index === 1) {
      game.state = 'map';
      game.innState = null;
    }
  }
}

function renderInn(ctx) {
  if (!game.innState) return;
  UI.drawWindow(ctx, 150, 160, 340, 120);
  UI.drawText(ctx, '一泊 ' + game.innState.cost + 'ゴールドです。', 170, 176);
  UI.drawText(ctx, 'おとまりになりますか？', 170, 200);
  var opts = ['はい', 'いいえ'];
  for (var i = 0; i < 2; i++) {
    if (i === game.innState.index) UI.drawText(ctx, UI.CURSOR, 190, 236 + i * 26);
    UI.drawText(ctx, opts[i], 214, 236 + i * 26);
  }
}

// ===== BATTLE UPDATE =====
function updateBattle() {
  var input = getInput();
  if (input) BattleSystem.handleInput(game, input);
  BattleSystem.update(game);
}

// ===== GAME OVER =====
function updateGameover() {
  var input = getInput();
  if (input === 'confirm') {
    game.state = 'title';
    game.titleIndex = 0;
  }
}

function renderGameover(ctx) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#c44';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('全滅してしまった…', CANVAS_W / 2, 180);
  ctx.fillStyle = '#888';
  ctx.font = '18px monospace';
  ctx.fillText('GAME OVER', CANVAS_W / 2, 240);
  ctx.fillStyle = '#666';
  ctx.font = '14px monospace';
  ctx.fillText('Enterキーで タイトルに もどる', CANVAS_W / 2, 320);
  ctx.textAlign = 'left';
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
  ctx.fillText('Enterキーで タイトルに もどる', CANVAS_W / 2, 456);
  ctx.textAlign = 'left';
}

// ===== RENDER =====
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  switch (game.state) {
    case 'title':
      renderTitle(ctx);
      break;
    case 'map':
      MapSystem.render(ctx, game);
      MapSystem.renderHUD(ctx, game);
      break;
    case 'mapTransition':
      // Fade effect
      MapSystem.render(ctx, game);
      var alpha = game.transitionTimer / 30;
      ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      var mapObj = MAPS[game.currentMap];
      if (mapObj) {
        UI.drawText(ctx, mapObj.name, CANVAS_W / 2 - 60, CANVAS_H / 2 - 10, '#fff');
      }
      break;
    case 'battle':
      BattleSystem.render(ctx, game, CANVAS_W, CANVAS_H);
      break;
    case 'dialogue':
      MapSystem.render(ctx, game);
      MapSystem.renderHUD(ctx, game);
      renderDialogue(ctx);
      break;
    case 'menu':
      MapSystem.render(ctx, game);
      renderMenu(ctx);
      break;
    case 'shop':
      renderShop(ctx);
      break;
    case 'inn':
      MapSystem.render(ctx, game);
      MapSystem.renderHUD(ctx, game);
      renderInn(ctx);
      break;
    case 'gameover':
      renderGameover(ctx);
      break;
    case 'ending':
      renderEnding(ctx);
      break;
  }
}

// ===== START =====
window.onload = initGame;
