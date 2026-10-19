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
var MOVE_DELAY = 8;       // frames between steps while a direction is held
var DASH_DELAY = 5;       // ... while dashing (~1.6x faster)


// Key state shared by the keyboard and the on-screen touch controls (js/touch.js)
function inputPress(key) {
  key = SettingsSystem.normKey(key);   // letters are case-insensitive (Shift would otherwise change them)
  if (!keysDown[key]) keysPressed[key] = true;
  keysDown[key] = true;
  SoundSystem.resume(); // ブラウザのAutoplay制限対応
}
function inputRelease(key) {
  keysDown[SettingsSystem.normKey(key)] = false;
}

// ===== INITIALIZATION =====
function initGame() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  game = {
    state: 'title',
    titleIndex: 0,
    titleT0: null,       // when the title screen started animating
    titleGo: null,       // { t0, next } while the title fades out into a new/loaded game
    opening: null,       // { t0, cue, skipAt } during the new-game opening
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
    achieved: {},
    battle: null,
    dialogue: null,
    dialogueIndex: 0,
    currentNPC: null,
    pendingBoss: null,
    transitionTimer: 0,
    menuState: null,
    shopState: null,
    innState: null,
    bestiary: {},
    hints: {},
    quests: {},
    cycle: 1,
    slot: 1,
    slotPick: null,
  };

  SoundSystem.init();
  MusicSystem.init(SoundSystem.getCtx());
  loadScore();
  SettingsSystem.load();

  document.addEventListener('keydown', function(e) {
    inputPress(e.key);
    e.preventDefault();
  });
  document.addEventListener('keyup', function(e) {
    inputRelease(e.key);
  });
  TouchControls.init();

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ===== CREATE NEW GAME =====
function newGame(slot) {
  // Full reset of all game state
  game.slot = slot || 1;
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
  game.bestiary = {};
  game.hints = {};
  game.quests = {};
  game.achieved = {};
  game.cycle = 1;
  HintSystem.reset();
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
  game.titleT0 = null; game.titleGo = null;
  game.opening = { t0: Date.now(), cue: 0, skipAt: 0 };
  game.state = 'opening';   // the opening cinematic, then the village chief's dialogue
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
  var downed = b.enemies.filter(function(e) { return !e.alive; }).map(function(e) { return e.id; });
  BestiarySystem.recordDefeated(game, downed);
  QuestSystem.onDefeated(game, downed);
  gameScore.enemiesDefeated += enemyCount;
  gameScore.bossesDefeated  += bossCount;
  gameScore.battlesWon++;
  gameScore.totalExp += b.totalExp;
  if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
  saveScore();
}

// Battle-only / animation fields that must not leak into the save file
var SAVE_TRANSIENT = ['buffs', 'defending', 'poisoned', 'poisonAt', 'stunAt', 'debuffAt', 'debuffStat',
                      'hpShown', 'hpGhost', 'mpShown', 'hpLast', 'healAt', 'hpBarUntil'];
var SAVE_VERSION = 2;

function saveGame(manual) {
  try {
    var data = {
      version: SAVE_VERSION,
      party: JSON.parse(JSON.stringify(game.party, function(k, v) {
        return SAVE_TRANSIENT.indexOf(k) >= 0 ? undefined : v;
      })),
      inventory: game.inventory,
      equipInventory: game.equipInventory,
      gold: game.gold,
      currentMap: game.currentMap,
      playerX: game.playerX,
      playerY: game.playerY,
      facing: game.facing,
      steps: game.steps,
      flags: game.flags,
      bestiary: game.bestiary,
      hints: game.hints,
      achieved: game.achieved,
      quests: game.quests,
      cycle: game.cycle,
      playTime: gameScore.playTime,
      savedAt: Date.now(),
    };
    localStorage.setItem(SlotSystem.key(game.slot), JSON.stringify(data));
    if (game.gold > gameScore.highGold) gameScore.highGold = game.gold;
    saveScore();
    if (manual) {
      game.saveFx = { t0: Date.now(), ok: true };
      SoundSystem.save();
    }
    return true;
  } catch(e) {
    if (manual) {
      game.saveFx = { t0: Date.now(), ok: false };
      SoundSystem.cancel();
    }
    return false;
  }
}

// Returns the parsed save only if it is structurally sound; null otherwise
function validateSave(data) {
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.party) || data.party.length !== 3) return null;
  for (var i = 0; i < data.party.length; i++) {
    var m = data.party[i];
    if (!m || typeof m.level !== 'number' || typeof m.hp !== 'number' || typeof m.maxHp !== 'number' ||
        typeof m.mp !== 'number' || typeof m.maxMp !== 'number' || !CHARACTERS[m.classId]) return null;
  }
  if (!MAPS[data.currentMap || 'millhaven']) return null;
  return data;
}

function readSave(slot) {
  try {
    var raw = localStorage.getItem(SlotSystem.key(slot || 1));
    if (!raw) return { status: 'none' };
    var data = validateSave(JSON.parse(raw));
    return data ? { status: 'ok', data: data } : { status: 'corrupt' };
  } catch(e) {
    return { status: 'corrupt' };
  }
}

function loadGame(slot) {
  slot = slot || 1;
  var res = readSave(slot);
  if (res.status !== 'ok') return false;
  try {
    var data = res.data;
    game.party = data.party;
    for (var i = 0; i < game.party.length; i++) {
      game.party[i].buffs = {};
      game.party[i].defending = false;
    }
    game.inventory = data.inventory || [];
    game.equipInventory = data.equipInventory || [];
    game.gold = data.gold || 0;
    game.currentMap = data.currentMap || 'millhaven';
    game.playerX = data.playerX || 8;
    game.playerY = data.playerY || 12;
    game.facing = data.facing || 'down';
    game.steps = data.steps || 0;
    game.slot = slot;
    game.flags = data.flags || {};
    game.hints = HintSystem.sanitize(data.hints);   // saves from before the hints count every hint as seen
    HintSystem.reset();
    game.achieved = RecordsSystem.sanitize(data.achieved);
    game.quests = QuestSystem.sanitize(data.quests);
    game.cycle = Math.max(1, Math.min(99, Math.floor(data.cycle) || 1));
    game.bestiary = BestiarySystem.sanitize(data.bestiary);   // saves from before the ずかん have none
    if (typeof data.playTime === 'number') gameScore.playTime = Math.max(gameScore.playTime, data.playTime);
    game.battle = null;
    game.currentNPC = null;
    game.pendingBoss = null;
    game.menuState = null;
    game.shopState = null;
    game.innState = null;
    game.transitionTimer = 0;
    moveTimer = 0;
    game.loadFx = { t0: Date.now() };
    game.titleT0 = null; game.titleGo = null;
    game.state = 'map';
    RecordsSystem.check(game);   // an older save earns whatever it already qualifies for
    return true;
  } catch(e) {
    return false;
  }
}

function getSaveInfo(slot) {
  var res = readSave(slot);
  return res.status === 'ok' ? res.data : null;
}

// "Saved" / "Loaded" overlay: a gold ring and sparkles around a label, or a fade-in from black
function renderSaveFx(ctx) {
  var now = Date.now();
  var sf = game.saveFx;
  if (sf) {
    var t = now - sf.t0;
    if (t > 1600) { game.saveFx = null; }
    else {
      var a = t < 200 ? t / 200 : (t > 1200 ? (1600 - t) / 400 : 1);
      var cx = CANVAS_W / 2, cy = CANVAS_H / 2;
      ctx.save();
      ctx.globalAlpha = a;
      var col = sf.ok ? '#ffd700' : '#f66';
      UI.drawWindow(ctx, cx - 110, cy - 30, 220, 60);
      ctx.textAlign = 'center';
      ctx.fillStyle = col;
      ctx.font = '18px monospace';
      ctx.fillText(sf.ok ? 'セーブしました' : 'セーブに失敗しました', cx, cy + 6);
      if (sf.ok) {
        var rp = Math.min(1, t / 700);
        ctx.globalAlpha = a * (1 - rp);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 110 + rp * 90, 30 + rp * 40, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = a;
        for (var i = 0; i < 10; i++) {
          var ang = i / 10 * Math.PI * 2 + 0.3;
          var rr = 70 + (t / 1000) * 50 * (0.6 + BattleSystem.fxRnd(i + 900) * 0.8);
          var sx = cx + Math.cos(ang) * rr * 1.5, sy = cy + Math.sin(ang) * rr * 0.55;
          var tw = Math.sin(t / 90 + i * 1.7) * 0.5 + 0.5;
          ctx.globalAlpha = a * tw;
          ctx.fillStyle = '#fff6b0';
          ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        }
      }
      ctx.restore();
    }
  }
  var lf = game.loadFx;
  if (lf) {
    var lt = now - lf.t0;
    if (lt > 1400) { game.loadFx = null; }
    else {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,' + Math.max(0, 1 - lt / 900) + ')';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      if (lt < 1400) {
        ctx.globalAlpha = Math.min(1, lt / 250) * Math.min(1, (1400 - lt) / 400);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd700';
        ctx.font = '16px monospace';
        ctx.fillText('冒険の書を ひらいた', CANVAS_W / 2, CANVAS_H / 2);
      }
      ctx.restore();
    }
  }
}

function getInput() {
  var input = null;
  if (keysPressed['ArrowUp'] || keysPressed['w']) input = 'up';
  else if (keysPressed['ArrowDown'] || keysPressed['s']) input = 'down';
  else if (keysPressed['ArrowLeft'] || keysPressed['a']) input = 'left';
  else if (keysPressed['ArrowRight'] || keysPressed['d']) input = 'right';
  else if (keysPressed['Enter'] || keysPressed[SettingsSystem.key('confirm')] || keysPressed[' ']) input = 'confirm';
  else if (keysPressed['Escape'] || keysPressed[SettingsSystem.key('cancel')]) input = 'cancel';
  return input;
}

// Dash = the dash key held (inverted when 常時ダッシュ is on), if dashing is enabled
function isDashing() {
  if (!SettingsSystem.get('dash')) return false;
  return !!keysDown[SettingsSystem.key('dash')] !== SettingsSystem.get('autoDash');
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
  // 村・ショップ系 → タウン曲、ハルカ宿場と深淵は専用曲、それ以外 → フィールド曲
  if (mapId === 'haruka') return 'waystation';
  if (mapId === 'abyss') return 'abyss';
  var townMaps = ['millhaven', 'itemShop', 'weaponShop', 'armorShop'];
  return (townMaps.indexOf(mapId) >= 0) ? 'town' : 'field';
}

function setBgm(name) {
  if (_currentBgm === name) return;
  _currentBgm = name;
  if (name === null) { MusicSystem.fadeOut(0.4); return; }
  MusicSystem.changeTo(name, name === 'victory' || name === 'defeat');   // jingles cut in quickly
}

// Battle music: silence for the victory/defeat/escape scenes, a dedicated track for bosses
// (which slams in when the boss lands rather than during the build-up)
function getBattleBgm() {
  var b = game.battle;
  if (!b) return 'battle';
  var ph = b.phase;
  if (ph === 'win') return 'victory';   // fanfare for the party's win
  if (ph === 'levelup' || ph === 'lose' || ph === 'run') return null;
  if (b.bossIntro) {
    var intro = Date.now() - b.introStart;
    return (b.bossLandAt || intro > 2200) ? 'boss' : null;
  }
  return 'battle';
}

// Danger level for the battle music: 1 when a party member is nearly down or a boss is
// badly hurt, 2 when both; 0 outside of an active fight
function battleIntensity() {
  var b = game.battle;
  if (game.state !== 'battle' || !b) return 0;
  var ph = b.phase;
  if (ph === 'win' || ph === 'levelup' || ph === 'lose' || ph === 'run') return 0;
  var level = 0, i;
  for (i = 0; i < game.party.length; i++) {
    if (game.party[i].alive && game.party[i].hp < game.party[i].maxHp * 0.25) { level++; break; }
  }
  for (i = 0; i < b.enemies.length; i++) {
    if (b.enemies[i].boss && b.enemies[i].alive && (b.enemies[i].bossPhase || 0) >= 1) { level++; break; }
  }
  return level;
}

// True while any living party member has an active buff (War Cry / Protect)
function partyBuffed() {
  if (game.state !== 'battle' || !game.battle) return false;
  for (var i = 0; i < game.party.length; i++) {
    var bf = game.party[i].buffs;
    if (game.party[i].alive && bf && (bf.atk || bf.def || bf.int)) return true;
  }
  return false;
}

function updateBgm() {
  var s = game.state;
  // Area ambience (wind, crickets, castle drone) under the BGM while exploring
  var onMap = s === 'map' || s === 'menu' || s === 'dialogue' || s === 'shop' || s === 'smith' || s === 'dice' || s === 'mapTransition' || (s === 'inn' && !(game.innState && game.innState.phase === 'sleep'));
  SoundSystem.setAmbience(onMap ? (game.currentMap === 'abyss' ? 'castle' : game.currentMap === 'haruka' ? 'millhaven' : game.currentMap) : null);
  if (game.encounterFx) return setBgm(null);   // the field music fades out as the encounter hits
  MusicSystem.setIntensity(battleIntensity());
  MusicSystem.setBoost(partyBuffed());
  if (s === 'title')                                          return setBgm('title');
  if (s === 'opening')                                        return setBgm(game.opening ? OpeningSystem.bgmAt(Date.now() - game.opening.t0) : null);
  if (s === 'battle')                                         return setBgm(getBattleBgm());
  if (s === 'gameover')                                       return setBgm('defeat');
  if (s === 'ending')                                         return setBgm(null);
  if (s === 'inn' && game.innState && game.innState.phase === 'sleep') return setBgm(null);   // the night is quiet except for its own sounds
  if (s === 'map' || s === 'menu'     || s === 'dialogue' ||
      s === 'shop' || s === 'smith' || s === 'dice' || s === 'inn'     || s === 'mapTransition') {
    return setBgm(getMapBgm(game.currentMap));
  }
}

// ===== MAIN GAME LOOP =====
function gameLoop(timestamp) {
  var dt = timestamp - lastTime;
  lastTime = timestamp;

  if (game.state !== 'title' && game.state !== 'opening') gameScore.playTime += dt / 1000;

  try {
    update(dt);
    render();
  } catch (err) {
    reportGameError(err);   // one bad frame must not freeze the whole game
  }

  keysPressed = {};
  requestAnimationFrame(gameLoop);
}

// An exception in update / render used to stop the loop for good (frozen, half-drawn screen). Now the loop keeps running,
// the canvas state is reset (a throw can leave save() / transforms behind) and the message is shown at the bottom so it can be reported.
var lastGameError = null;
function reportGameError(err) {
  var msg = (err && err.message ? err.message : String(err));
  var where = ((err && err.stack ? err.stack : '').split('\n')[1] || '').replace(/^.*\//, '').trim();
  var first = !lastGameError || lastGameError.msg !== msg;
  lastGameError = { msg: msg, where: where, at: Date.now(), count: first ? 1 : lastGameError.count + 1 };
  if (first && typeof console !== 'undefined' && console.error) console.error(err);
  try {
    canvas.width = canvas.width;   // resets every piece of context state (and clears the half-drawn frame)
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, CANVAS_H - 70, CANVAS_W, 70);
    ctx.fillStyle = '#f88';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('エラーが おきました (' + game.state + (game.battle ? '/' + game.battle.phase : '') + ')', 12, CANVAS_H - 50);
    ctx.fillStyle = '#fff';
    ctx.fillText(msg.slice(0, 70), 12, CANVAS_H - 32);
    ctx.fillText(where.slice(0, 70), 12, CANVAS_H - 14);
  } catch (e2) {}
}

// ===== UPDATE =====
function update(dt) {
  updateBgm();
  if (game.settings) {
    if (SettingsSystem.update(game.settings, getInput())) game.settings = null;
    return;
  }
  switch (game.state) {
    case 'title':
      updateTitle();
      break;
    case 'opening':
      updateOpening();
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
    case 'smith':
      SmithSystem.update(game, getInput());
      break;
    case 'dice':
      DiceSystem.update(game, getInput());
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

// ===== MAP UPDATES =====
function updateMap(dt) {
  AmbienceSystem.update(game, Date.now());   // wandering NPCs, birds, distant thunder
  HintSystem.show(game, 'move');
  if (game.steps >= 40 && SettingsSystem.get('dash') && !SettingsSystem.get('autoDash')) HintSystem.show(game, 'dash');
  for (var hi = 0; hi < game.party.length; hi++) { if (game.party[hi].alive && game.party[hi].hp <= game.party[hi].maxHp * 0.5) { HintSystem.show(game, 'rest'); break; } }
  // Encounter transition: input is locked until the flash/zoom/wipe finishes, then the battle begins
  if (game.encounterFx) {
    var efx = game.encounterFx;
    if (Date.now() - efx.t0 >= efx.dur) {
      game.encounterFx = null;
      BattleSystem.startBattle(game, efx.enemies);
    }
    return;
  }
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
      game.dashing = isDashing();
      MapSystem.movePlayer(game, d.dx, d.dy);
      moveTimer = 0;
    }
  } else if (isMoving()) {
    moveTimer++;
    var dashNow = isDashing();
    if (moveTimer >= (dashNow ? DASH_DELAY : MOVE_DELAY)) {
      var dir = getMoveDir();
      if (dir) {
        game.dashing = dashNow;
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
        if (game.currentNPC.dice) {
          DiceSystem.open(game);
          game.currentNPC = null;
          return;
        }
        if (game.currentNPC.smith) {
          SmithSystem.open(game);
          game.currentNPC = null;
          return;
        }
        if (game.currentNPC.inn) {
          game.innState = { cost: game.currentNPC.inn, index: 0, phase: 'ask', msg: null };
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
var MENU_ITEMS = ['どうぐ', 'そうび', 'つよさ', 'ずかん', 'きろく', 'いらい', 'ヘルプ', 'セーブ', 'せってい', 'とじる'];

function updateMenu() {
  var input = getInput();
  var ms = game.menuState;

  if (!ms.subState) {
    // Main menu
    var menuItems = MENU_ITEMS;
    if (input === 'up') { ms.index = (ms.index - 1 + menuItems.length) % menuItems.length; SoundSystem.cursor(); }
    if (input === 'down') { ms.index = (ms.index + 1) % menuItems.length; SoundSystem.cursor(); }
    if (input === 'cancel') { SoundSystem.cancel(); saveGame(); game.state = 'map'; game.menuState = null; return; }
    if (input === 'confirm') {
      var sel = menuItems[ms.index];
      if (sel === 'とじる') { SoundSystem.cancel(); saveGame(); game.state = 'map'; game.menuState = null; return; }
      if (sel === 'セーブ') { saveGame(true); return; }
      if (sel === 'ずかん') { SoundSystem.confirm(); ms.subState = 'bestiary'; ms.bIndex = 0; return; }
      if (sel === 'きろく') { SoundSystem.confirm(); ms.subState = 'records'; return; }
      if (sel === 'いらい') { SoundSystem.confirm(); ms.subState = 'quests'; return; }
      if (sel === 'ヘルプ') { SoundSystem.confirm(); ms.subState = 'help'; ms.page = 0; return; }
      if (sel === 'せってい') { SoundSystem.confirm(); game.settings = { index: 0 }; return; }
      if (sel === 'どうぐ') ms.subState = 'items';
      if (sel === 'そうび') { ms.subState = 'equipChar'; ms.charIndex = 0; }
      if (sel === 'つよさ') { ms.subState = 'stats'; ms.charIndex = 0; }
    }
  } else if (ms.subState === 'bestiary') {
    if (BestiarySystem.update(ms, game, input)) ms.subState = null;
    return;
  } else if (ms.subState === 'records') {
    if (RecordsSystem.update(ms, game, input)) ms.subState = null;
    return;
  } else if (ms.subState === 'quests') {
    if (QuestSystem.update(ms, game, input)) ms.subState = null;
    return;
  } else if (ms.subState === 'help') {
    if (HintSystem.helpUpdate(ms, input)) ms.subState = null;
    return;
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
      var oldPlus = slotType === 'accessory' ? 0 : SmithSystem.strip(char, slotType);   // the enhancement level travels with the item
      game.equipInventory.push({ id: char[slotType], type: slotType, plus: oldPlus });
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
  if (slotType !== 'accessory') SmithSystem.grant(char, slotType, equipEntry.plus || 0);

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
  if (ms.subState === 'bestiary') { BestiarySystem.render(ctx, ms, game); return; }
  if (ms.subState === 'help') { HintSystem.helpRender(ctx, ms); return; }
  if (ms.subState === 'records') { RecordsSystem.render(ctx, game); return; }
  if (ms.subState === 'quests') { QuestSystem.render(ctx, game, ms); return; }

  // Main menu
  UI.drawMenu(ctx, 20, 20, 140, MENU_ITEMS, ms.index);

  // Gold
  UI.drawWindow(ctx, 20, 290, 140, 32);
  UI.drawText(ctx, game.gold + ' G', 34, 298, '#ffd700');

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
    var weaponName = SmithSystem.label(ch, 'weapon');
    var armorName = SmithSystem.label(ch, 'armor');
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
      var equipped = n < 2 ? SmithSystem.label(ch2, slotIds[n]) : (ch2[slotIds[n]] ? tables[n][ch2[slotIds[n]]].name : 'なし');
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
        UI.drawText(ctx, slotType === 'accessory' ? table[available[q].id].name : SmithSystem.bagLabel(available[q]), 220, qy);
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
    openAt: Date.now(),      // the shop fades in from black with a door bell
    goldShown: game.gold,    // the displayed gold counts down after a purchase
    msg: null, msgColor: null,
    buyFx: null, buyRow: 0, denyAt: 0,
  };
  game.state = 'shop';
  SoundSystem.doorBell();
}

var SHOP_ROWS = 9;   // visible rows; longer lists scroll
function adjustShopScroll(ss, shop) {
  var top = ss.top || 0;
  if (ss.index < top) top = ss.index;
  if (ss.index >= top + SHOP_ROWS) top = ss.index - SHOP_ROWS + 1;
  ss.top = Math.max(0, Math.min(top, Math.max(0, shop.items.length - SHOP_ROWS)));
}

function shopDeny(ss) {
  ss.msg = ['おかねが たりないようだ…'];
  ss.msgColor = '#f88';
  ss.denyAt = Date.now();
  SoundSystem.denied();
}

function updateShop() {
  var input = getInput();
  var ss = game.shopState;
  var shop = SHOPS[ss.shopId];

  // The gold counter eases toward the real amount
  if (ss.goldShown !== game.gold) {
    var gd = game.gold - ss.goldShown;
    ss.goldShown += Math.abs(gd) < 2 ? gd : Math.round(gd * 0.2);
  }
  var cur = shop.items[ss.index];
  var curDef = cur && TownSystem.statTable(cur.type)[cur.id];

  if (ss.phase === 'list') {
    if (input === 'cancel') { SoundSystem.cancel(); game.state = 'map'; game.shopState = null; return; }
    if (input === 'up') ss.index = (ss.index - 1 + shop.items.length) % shop.items.length;
    if (input === 'down') ss.index = (ss.index + 1) % shop.items.length;
    if (input === 'up' || input === 'down') { adjustShopScroll(ss, shop); SoundSystem.cursor(); ss.msg = null; ss.msgColor = null; }
    if (input === 'confirm') {
      if (curDef && game.gold < curDef.price) { shopDeny(ss); return; }
      SoundSystem.confirm();
      ss.phase = 'confirm';
      ss.confirmIndex = 0;
      ss.msg = [curDef.name + 'だね。', curDef.price + 'ゴールドだよ。'];
      ss.msgColor = null;
    }
  } else if (ss.phase === 'confirm') {
    if (input === 'cancel') { SoundSystem.cancel(); ss.phase = 'list'; ss.msg = null; return; }
    if (input === 'up' || input === 'down') { ss.confirmIndex = 1 - ss.confirmIndex; SoundSystem.cursor(); }
    if (input === 'confirm') {
      if (ss.confirmIndex === 0) {
        // Buy
        var si = cur;
        var def = curDef;
        if (def && game.gold >= def.price) {
          game.gold -= def.price;
          if (si.type === 'item') {
            MapSystem.giveItem(game, si.id, 1);
          } else {
            game.equipInventory.push({ id: si.id, type: si.type });
          }
          ss.buyFx = { t0: Date.now(), price: def.price };
          ss.buyRow = ss.index;
          ss.msg = ['まいどあり！', def.name + 'を てにいれた！'];
          ss.msgColor = '#ffd700';
          SoundSystem.coin();
        } else {
          shopDeny(ss);
        }
      } else {
        SoundSystem.cancel();
        ss.msg = ['ほかに なにか', 'ごようかな？'];
        ss.msgColor = null;
      }
      ss.phase = 'list';
    }
  }
}

function renderShop(ctx) {
  var ss = game.shopState;
  if (!ss) return;
  var shop = SHOPS[ss.shopId];
  var now = Date.now();

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  UI.drawWindow(ctx, 20, 20, 600, 36);
  var denyT = now - ss.denyAt, shake = denyT < 450 ? Math.sin(denyT / 25) * (1 - denyT / 450) * 5 : 0;
  UI.drawText(ctx, shop.name + '  所持金:', 36, 30, '#ffd700');
  UI.drawText(ctx, ss.goldShown + 'G', 176 + shake, 30, denyT < 450 ? '#f66' : (ss.goldShown !== game.gold ? '#ffe9a0' : '#ffd700'));

  var rows = Math.min(SHOP_ROWS, shop.items.length), top = ss.top || 0;
  UI.drawWindow(ctx, 20, 66, 600, rows * 28 + 30);
  if (top > 0) UI.drawText(ctx, '▲', 590, 72, '#aaa', UI.FONT_SMALL);
  if (top + rows < shop.items.length) UI.drawText(ctx, '▼', 590, 66 + rows * 28 + 12, '#aaa', UI.FONT_SMALL);
  for (var i = top; i < top + rows; i++) {
    var si = shop.items[i];
    var table = si.type === 'weapon' ? WEAPONS : si.type === 'armor' ? ARMORS : si.type === 'accessory' ? ACCESSORIES : ITEMS;
    var def = table[si.id];
    var iy = 80 + (i - top) * 28;
    if (i === ss.index) UI.drawText(ctx, UI.CURSOR, 34, iy);
    var nameColor = game.gold >= def.price ? '#fff' : '#888';
    UI.drawText(ctx, def.name, 58, iy, nameColor);
    UI.drawText(ctx, def.price + 'G', 280, iy, game.gold >= def.price ? '#ffd700' : '#886');
    // Show stat bonus
    var bonus = '';
    if (def.atk) bonus += 'ATK+' + def.atk + ' ';
    if (def.def) bonus += 'DEF+' + def.def + ' ';
    if (def.int) bonus += 'INT+' + def.int + ' ';
    if (def.spd) bonus += 'SPD+' + def.spd + ' ';
    if (def.hp) bonus += 'HP+' + def.hp + ' ';
    if (def.desc) bonus = def.desc;
    UI.drawText(ctx, bonus, 360, iy, '#aaa', UI.FONT_SMALL);
  }
  if (ss.buyFx && ss.buyRow >= top && ss.buyRow < top + rows) TownSystem.drawBuyFx(ctx, ss, 80 + (ss.buyRow - top) * 28, now);

  TownSystem.drawShopInfo(ctx, game, ss, shop, now);

  if (ss.phase === 'confirm') {
    UI.drawWindow(ctx, 200, 280, 200, 80);
    UI.drawText(ctx, 'かいますか？', 220, 292);
    var opts = ['はい', 'いいえ'];
    for (var j = 0; j < 2; j++) {
      if (j === ss.confirmIndex) UI.drawText(ctx, UI.CURSOR, 220, 320 + j * 24);
      UI.drawText(ctx, opts[j], 244, 320 + j * 24);
    }
  }

  UI.drawText(ctx, 'X: もどる', 520, 30, '#889', UI.FONT_SMALL);

  var fade = 1 - (now - ss.openAt) / 320;    // fade in from black on entering
  if (fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + fade + ')'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }
}

// ===== INN =====
function updateInn() {
  var input = getInput();
  var inn = game.innState;
  if (!inn) return;
  var now = Date.now();

  // The night itself: cues on the timeline, Z skips ahead to the morning
  if (inn.phase === 'sleep') {
    var t = now - inn.t0;
    while (inn.cue < TownSystem.INN_CUES.length && t >= TownSystem.INN_CUES[inn.cue].t) {
      SoundSystem[TownSystem.INN_CUES[inn.cue].fn]();
      inn.cue++;
    }
    if (t > 800 && t < TownSystem.INN_HEAL_AT - 300 && (input === 'confirm' || input === 'cancel')) {
      inn.t0 = now - TownSystem.INN_HEAL_AT;
      inn.cue = TownSystem.INN_CUES.length - 1;      // skip to the "heal" cue
    }
    if (t >= TownSystem.INN_DURATION) {
      var lines = ['朝だ！ ぐっすり ねむれた。', 'HP と MP が 全回復した！'];
      if (inn.before.some(function(b) { return !b.alive; })) lines.splice(1, 0, '倒れていた なかまも 目を さました！');
      game.dialogue = lines;
      game.dialogueIndex = 0;
      game.state = 'dialogue';
      game.innState = null;
    }
    return;
  }

  if (input === 'up' || input === 'down') { inn.index = 1 - inn.index; SoundSystem.cursor(); inn.msg = null; }
  if (input === 'cancel') { SoundSystem.cancel(); game.state = 'map'; game.innState = null; return; }
  if (input === 'confirm') {
    if (inn.index === 0 && game.gold >= inn.cost) {
      game.gold -= inn.cost;
      inn.before = game.party.map(function(p) { return { hp: p.hp, mp: p.mp, alive: p.alive }; });
      for (var i = 0; i < game.party.length; i++) {
        game.party[i].hp = game.party[i].maxHp;
        game.party[i].mp = game.party[i].maxMp;
        game.party[i].alive = true;
        game.party[i].poisoned = false;
      }
      saveGame();
      inn.phase = 'sleep';
      inn.t0 = now;
      inn.cue = 0;
    } else if (inn.index === 0) {
      inn.msg = 'ゴールドが たりません…';
      SoundSystem.denied();
    } else {
      SoundSystem.cancel();
      game.state = 'map';
      game.innState = null;
    }
  }
}

function renderInn(ctx) {
  var inn = game.innState;
  if (!inn) return;
  if (inn.phase === 'sleep') { TownSystem.renderNight(ctx, game, inn, Date.now() - inn.t0); return; }
  UI.drawWindow(ctx, 150, 150, 340, 140);
  UI.drawText(ctx, '一泊 ' + inn.cost + 'ゴールドです。', 170, 166);
  UI.drawText(ctx, 'おとまりになりますか？', 170, 190);
  UI.drawText(ctx, '所持金 ' + game.gold + 'G', 170, 214, game.gold >= inn.cost ? '#ffd700' : '#f88', UI.FONT_SMALL);
  var opts = ['はい', 'いいえ'];
  for (var i = 0; i < 2; i++) {
    if (i === inn.index) UI.drawText(ctx, UI.CURSOR, 190, 238 + i * 24);
    UI.drawText(ctx, opts[i], 214, 238 + i * 24);
  }
  if (inn.msg) UI.drawText(ctx, inn.msg, 300, 238, '#f88', UI.FONT_SMALL);
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

// ===== RENDER =====
function render() {
  renderScene();
  if (game.settings) SettingsSystem.render(ctx, game.settings);
}

function renderScene() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  switch (game.state) {
    case 'title':
      renderTitle(ctx);
      break;
    case 'opening':
      renderOpening(ctx);
      break;
    case 'map':
      MapSystem.render(ctx, game);
      MapSystem.renderHUD(ctx, game);
      AmbienceSystem.renderBanner(ctx, game, Date.now());
      break;
    case 'mapTransition':
      // Fade effect
      MapSystem.render(ctx, game);
      var alpha = game.transitionTimer / 30;
      ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // (the area name is announced by the banner once the fade ends)
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
    case 'smith':
      SmithSystem.render(ctx, game);
      break;
    case 'dice':
      DiceSystem.render(ctx, game);
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
  HintSystem.renderToast(ctx, game);
  renderSaveFx(ctx);
}

// ===== END GAME BUTTON =====
function endGameAndSave() {
  // Always update and persist the score
  if (game && game.gold > gameScore.highGold) gameScore.highGold = game.gold;
  saveScore();

  // Save game position when in a safe state (not mid-battle)
  var safeStates = ['map', 'menu', 'dialogue', 'inn', 'shop', 'smith', 'dice', 'mapTransition'];
  if (game && safeStates.indexOf(game.state) >= 0) saveGame();

  // Return to title screen
  MusicSystem.stop();
  _currentBgm = null;
  if (game) {
    game.state = 'title';
    game.titleIndex = 0; game.titleT0 = null; game.titleGo = null; game.slotPick = null;
    game.battle = null;
    game.menuState = null;
  }

  // Brief on-screen toast
  var toast = document.createElement('div');
  toast.textContent = 'セーブしました';
  toast.style.cssText = [
    'position:fixed', 'top:50%', 'left:50%',
    'transform:translate(-50%,-50%)',
    'background:#1a1a3a', 'color:#ffd700',
    'border:2px solid #ffd700', 'border-radius:5px',
    'padding:12px 32px', 'font-family:monospace',
    'font-size:18px', 'z-index:9999',
    'pointer-events:none', 'transition:opacity 0.8s',
  ].join(';');
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 800);
  }, 1000);
}

// ===== START =====
window.onload = initGame;
