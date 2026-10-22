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
  if (mapId === 'crystalCave') return 'crystal';
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

// ===== BATTLE UPDATE =====
function updateBattle() {
  var input = getInput();
  if (input) BattleSystem.handleInput(game, input);
  BattleSystem.update(game);
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
