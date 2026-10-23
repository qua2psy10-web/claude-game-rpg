// ============================================================
// save.js — Save / load (three slots), the score record and the "saved" overlay.
// Plain global functions shared with main.js (the state machine); load it before main.js.
// ============================================================

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
                      'hpShown', 'hpGhost', 'mpShown', 'hpLast', 'healAt', 'hpBarUntil', 'limit', 'hpMark', 'limitFullAt'];
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
      tower: game.tower,
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
    game.tower = TowerSystem.sanitize(data.tower);   // saves from before the tower have no progress
    game.towerRun = null; game.towerFloorScale = 0;
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
