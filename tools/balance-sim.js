// Headless balance simulator: drives the real BattleSystem with a simple "sensible player" policy.
// Usage: node tools/balance-sim.js [runs=40] [seed=1]
var fs = require('fs'), vm = require('vm'), path = require('path');
var root = path.join(__dirname, '..');
var stub = new Proxy(function() {}, { get: function(t, k) { return k === 'getContext' ? function() { return stub; } : stub; }, apply: function() { return stub; } });
global.window = global;
global.document = { getElementById: function() { return stub; }, createElement: function() { return stub; } };
global.setTimeout = function() {};
['data', 'ui', 'settings', 'sound', 'music', 'map', 'battle', 'bestiary', 'hints', 'records'].forEach(function(f) {
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f });
});
Object.keys(SoundSystem).forEach(function(k) { if (typeof SoundSystem[k] === 'function') SoundSystem[k] = function() {}; });

var seed = 1;
function seedRng(s) { seed = s >>> 0; }
Math.random = function() { seed = (seed + 0x6D2B79F5) >>> 0; var t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function newParty() {
  return ['sam', 'dario', 'sundar'].map(function(id) {
    var d = CHARACTERS[id], s = d.baseStats;
    return { classId: id, name: d.name, class: d.class, level: 1, hp: s.hp, maxHp: s.hp, mp: s.mp, maxMp: s.mp,
      atk: s.atk, def: s.def, spd: s.spd, int: s.int, exp: 0, weapon: null, armor: null, accessory: null, alive: true, buffs: {}, defending: false, color: d.color };
  });
}
function newGameState() {
  return { party: newParty(), inventory: [{ id: 'herb', count: 5 }], equipInventory: [], gold: 100, flags: {}, state: 'battle' };
}

// ---- shopping: buy the best affordable upgrade per slot per character
function shopIds(shopId, type) { return SHOPS[shopId].items.filter(function(i) { return i.type === type; }).map(function(i) { return i.id; }); }
var SHOP_W = shopIds('weaponShop', 'weapon');
var SHOP_A = shopIds('armorShop', 'armor');
var SHOP_R = shopIds('armorShop', 'accessory');
var FULL = !!process.env.FULL;   // FULL=1: also use chests, rings and the newer items (closer to a real playthrough)
function slotScore(def, cls) { return (cls === 'sam' ? (def.atk || 0) + (def.def || 0) : (def.int || 0) + (def.def || 0) + (def.atk || 0) * 0.3) + (def.hp || 0) * 0.2 + (def.spd || 0) * 0.3; }
function shop(g, reserveHerbs) {
  var herbs = (g.inventory.filter(function(i) { return i.id === 'herb'; })[0] || { count: 0 }).count;
  if (herbs < reserveHerbs && g.gold >= 10) {
    var n = Math.min(reserveHerbs - herbs, Math.floor(g.gold / 10));
    g.gold -= n * 10;
    var e = g.inventory.filter(function(i) { return i.id === 'herb'; })[0];
    if (e) e.count += n; else g.inventory.push({ id: 'herb', count: n });
  }
  g.party.forEach(function(c) {
    [['weapon', WEAPONS, SHOP_W], ['armor', ARMORS, SHOP_A]].concat(FULL ? [['accessory', ACCESSORIES, SHOP_R]] : []).forEach(function(s) {
      var tbl = s[1], cur = c[s[0]] ? slotScore(tbl[c[s[0]]], c.classId) : -1, best = null, bs = cur;
      s[2].forEach(function(id) {
        var d = tbl[id];
        if ((d.equip && d.equip.indexOf(c.classId) < 0) || d.price > g.gold) return;
        var sc = slotScore(d, c.classId);
        if (sc > bs) { bs = sc; best = id; }
      });
      if (best) { g.gold -= tbl[best].price; g.equipInventory = [{ id: best, type: s[0] }]; equip(c, s[0], tbl, best); }
    });
  });
}
// chest contents handed out when entering a stage (FULL mode): [item or equipment, kind, count/for]
var CHESTS = {
  '森':     [['elixir', 'item', 3], ['guardRing', 'ring', 'sundar'], ['herb', 'item', 3], ['ironSword', 'weapon', 'sam']],
  '魔王城': [['highHerb', 'item', 3], ['phoenix', 'item', 2], ['heroRing', 'ring', 'sam'], ['bigBomb', 'item', 2]],
};
function giveItem(g, id, n) { var e = g.inventory.filter(function(i) { return i.id === id; })[0]; if (e) e.count += n; else g.inventory.push({ id: id, count: n }); }
function openChests(g, stage) {
  (CHESTS[stage] || []).forEach(function(ch) {
    if (ch[1] === 'item') giveItem(g, ch[0], ch[2]);
    else if (ch[1] === 'ring') { var c = g.party.filter(function(m) { return m.classId === ch[2]; })[0]; equip(c, 'accessory', ACCESSORIES, ch[0]); }
    else { var c2 = g.party.filter(function(m) { return m.classId === ch[2]; })[0]; if (!c2.weapon || slotScore(WEAPONS[ch[0]], 'sam') > slotScore(WEAPONS[c2.weapon], 'sam')) equip(c2, 'weapon', WEAPONS, ch[0]); }
  });
}
function equip(c, slot, tbl, id) {
  var o = c[slot] ? tbl[c[slot]] : null;
  if (o) { c.atk -= o.atk || 0; c.def -= o.def || 0; c.int -= o.int || 0; c.spd -= o.spd || 0; c.maxHp -= o.hp || 0; }
  var n = tbl[id]; c.atk += n.atk || 0; c.def += n.def || 0; c.int += n.int || 0; c.spd += n.spd || 0; c.maxHp += n.hp || 0; c[slot] = id;
}

// ---- party policy
function aliveEnemies(b) { var r = []; b.enemies.forEach(function(e, i) { if (e.alive) r.push(i); }); return r; }
function weakest(b) { var best = -1; b.enemies.forEach(function(e, i) { if (e.alive && (best < 0 || e.hp < b.enemies[best].hp)) best = i; }); return best; }
function strongest(b) { var best = -1; b.enemies.forEach(function(e, i) { if (e.alive && (best < 0 || e.hp > b.enemies[best].hp)) best = i; }); return best; }
function tgt0(b) { var best = -1; b.enemies.forEach(function(e, i) { if (e.alive && (best < 0 || e.hp > b.enemies[best].hp)) best = i; }); return best; }
function planRound(g) {
  var b = g.battle, cmds = [], ne = aliveEnemies(b).length;
  var storing = b.enemies.some(function(e) { return e.alive && e.charging; });
  g.party.forEach(function(c, i) {
    if (!c.alive) return;
    var P = function(o) { o.actor = i; o.actorType = 'party'; cmds.push(o); };
    if (storing && c.classId !== 'sundar') return P({ action: 'defend' });   // brace for the boss's stored attack
    var hpr = c.hp / c.maxHp;
    var inv = function(id) { return g.inventory.filter(function(x) { return x.id === id && x.count > 0; })[0]; };
    var herb = FULL && inv('highHerb') ? { id: 'highHerb' } : inv('herb');
    var dead = -1; g.party.forEach(function(m, j) { if (!m.alive) dead = j; });
    if (FULL && dead >= 0 && inv('phoenix') && c.classId === 'sam') return P({ action: 'item', itemId: 'phoenix', target: dead, targetType: 'ally' });
    if (FULL && c.classId === 'sam' && inv('bigBomb') && b.enemies.some(function(e) { return e.alive && e.boss; })) return P({ action: 'item', itemId: 'bigBomb', target: tgt0(b), targetType: 'enemy' });
    var avail = BattleSystem.getAvailableSpells(c).map(function(s) { return s.id; }).filter(function(id) { return SPELLS[id].mp <= c.mp; });
    var has = function(id) { return avail.indexOf(id) >= 0; };
    var low = -1, lr = 1; g.party.forEach(function(m, j) { if (m.alive && m.hp / m.maxHp < lr) { lr = m.hp / m.maxHp; low = j; } });
    var tgt = strongest(b);
    if (c.classId === 'sundar') {
      if (low >= 0 && lr < 0.5 && has('heal')) return P({ action: 'spell', spellId: 'heal', target: low, targetType: 'ally' });
      var pz = -1; g.party.forEach(function(m, j) { if (m.alive && m.poisoned && m.hp / m.maxHp < 0.7) pz = j; });
      if (pz >= 0 && has('cure')) return P({ action: 'spell', spellId: 'cure', target: pz, targetType: 'ally' });
      if (ne >= 2 && has('holyLight')) return P({ action: 'spell', spellId: 'holyLight', target: -1, targetType: 'allEnemy' });
      if (has('light') && c.mp >= 8) return P({ action: 'spell', spellId: 'light', target: tgt, targetType: 'enemy' });
      return P({ action: 'attack', target: tgt, targetType: 'enemy' });
    }
    if (low >= 0 && lr < 0.35 && herb && i !== 2) return P({ action: 'item', itemId: herb.id || 'herb', target: low, targetType: 'ally' });
    if (c.classId === 'dario') {
      if (FULL && b.enemies.some(function(e) { return e.alive && e.boss; }) && has('magicBoost') && !(c.buffs && c.buffs.int)) return P({ action: 'spell', spellId: 'magicBoost', target: -1, targetType: 'party' });
      if (FULL && ne >= 2 && has('sleep') && !b.enemies.some(function(e) { return e.alive && e.sleepTurns > 0; }) && c.mp >= 14) return P({ action: 'spell', spellId: 'sleep', target: -1, targetType: 'allEnemy' });
      if (ne >= 2 && has('iceStorm')) return P({ action: 'spell', spellId: 'iceStorm', target: -1, targetType: 'allEnemy' });
      if (has('thunder')) return P({ action: 'spell', spellId: 'thunder', target: tgt, targetType: 'enemy' });
      if (has('fire')) return P({ action: 'spell', spellId: 'fire', target: tgt, targetType: 'enemy' });
      return P({ action: 'attack', target: tgt, targetType: 'enemy' });
    }
    if (ne >= 2 && has('sweep')) return P({ action: 'spell', spellId: 'sweep', target: -1, targetType: 'allEnemy' });
    if (has('powerSlash')) return P({ action: 'spell', spellId: 'powerSlash', target: tgt, targetType: 'enemy' });
    return P({ action: 'attack', target: tgt, targetType: 'enemy' });
  });
  return cmds;
}

var DMG = {};
// Fights one battle. Returns { won, rounds }
function fight(g, ids) {
  BattleSystem.startBattle(g, ids);
  var b = g.battle, rounds = 0;
  g.party.forEach(function(c) { c.defending = false; });
  while (rounds < 60) {
    rounds++;
    b.commands = planRound(g);
    BattleSystem.startExecution(g);
    var guard = 0;
    while (b.phase === 'execute' && guard++ < 200) {
      var cm = b.turnQueue[b.currentAction], hb = b.enemies.reduce(function(x, e) { return x + e.hp; }, 0);
      BattleSystem.executeNextAction(g);
      if (cm && cm.actorType === 'party') {
        var d = hb - b.enemies.reduce(function(x, e) { return x + Math.max(0, e.hp); }, 0);
        if (d > 0) DMG[g.party[cm.actor].classId] = (DMG[g.party[cm.actor].classId] || 0) + d;
      }
    }
    if (b.phase === 'win') { BattleSystem.handleWin(g); g.state = 'battle'; g.battle = null; return { won: true, rounds: rounds }; }
    if (b.phase === 'lose') { g.battle = null; return { won: false, rounds: rounds }; }
    if (b.phase !== 'command') break;
  }
  g.battle = null;
  return { won: false, rounds: rounds };
}

function pick(table) {
  var tot = table.reduce(function(s, e) { return s + e.weight; }, 0), r = Math.random() * tot;
  for (var i = 0; i < table.length; i++) { r -= table[i].weight; if (r <= 0) return table[i].enemies; }
  return table[0].enemies;
}
function inn(g) { g.party.forEach(function(c) { c.hp = c.maxHp; c.mp = c.maxMp; c.alive = true; }); }
function needRest(g) {
  return g.party.some(function(c) { return !c.alive || c.hp / c.maxHp < 0.4; }) ||
    g.party.some(function(c) { return c.classId !== 'sam' && c.mp < 8; });
}
function minLv(g) { return Math.min.apply(null, g.party.map(function(c) { return c.level; })); }

// Route: stay in an area until min party level reaches the target, then move on
var ROUTE = [
  { name: '草原',   table: MAPS.world.encounters.grass,   until: 5 },
  { name: '森',     table: MAPS.forest.encounters.forest, until: 9 },
  { name: '魔王城', table: MAPS.castle.encounters.dark,   until: +process.env.UNTIL || +process.env.BOSSLV || 16 },   // UNTIL=22 gives snapshots at higher levels for the post-game columns
];

function playthrough(s) {
  seedRng(s);
  var g = newGameState(), report = { stages: [], boss: null, byLv: {}, snaps: {} };
  for (var si = 0; si < ROUTE.length; si++) {
    var st = ROUTE[si], rec = { name: st.name, battles: 0, wipes: 0, rests: 0, gold0: g.gold, goldGain: 0, rounds: 0, lvStart: minLv(g), cap: false };
    var goldBefore = g.gold, spent = 0;
    if (FULL) openChests(g, st.name);
    while (minLv(g) < st.until && rec.battles < 600) {
      if (needRest(g)) { inn(g); g.gold = Math.max(0, g.gold - 30); rec.rests++; }
      var hp0 = g.party.reduce(function(a, c) { return a + c.hp; }, 0), mx0 = g.party.reduce(function(a, c) { return a + c.maxHp; }, 0), lv0 = minLv(g);
      var r = fight(g, pick(st.table));
      var lost = r.won ? Math.max(0, hp0 - g.party.reduce(function(a, c) { return a + c.hp; }, 0)) / mx0 : 1;
      rec.hpLoss = (rec.hpLoss || 0) + lost;
      var lb = (report.byLv[lv0] = report.byLv[lv0] || { b: 0, loss: 0, wipes: 0 }); lb.b++; lb.loss += lost; if (!r.won) lb.wipes++;
      rec.battles++; rec.rounds += r.rounds;
      if (!r.won) { rec.wipes++; inn(g); g.gold = Math.floor(g.gold / 2); g.party.forEach(function(c) { c.poisoned = false; }); }
      var before = g.gold; shop(g, 5); spent += before - g.gold;
      for (var sl = 2; sl <= minLv(g); sl++) if (!report.snaps[sl]) report.snaps[sl] = JSON.stringify(g);
    }
    rec.cap = rec.battles >= 600;
    rec.goldGain = g.gold - goldBefore + spent;
    rec.spent = spent;
    rec.lvEnd = g.party.map(function(c) { return c.level; }).join('/');
    report.stages.push(rec);
  }
  // Boss: 1 attempt per fresh restore at the same state
  inn(g);
  var wins = 0, N = 30, rsum = 0;
  var snap = JSON.stringify(g);
  for (var k = 0; k < N; k++) {
    var gg = JSON.parse(snap); gg.battle = null;
    var br = fight(gg, ['demonKing']); if (br.won) wins++; rsum += br.rounds;
  }
  report.boss = { winRate: wins / N, rounds: rsum / N, lv: g.party.map(function(c) { return c.level; }).join('/'), gear: g.party.map(function(c) { return (c.weapon || '-') + '+' + (c.armor || '-'); }).join(' ') };
  return report;
}

if (require.main !== module) { module.exports = { DMG: DMG, playthrough: playthrough, fight: fight, newGameState: newGameState, planRound: planRound, seedRng: seedRng }; return; }
var runs = +process.argv[2] || 40, base = +process.argv[3] || 1;
var agg = ROUTE.map(function(s) { return { name: s.name, battles: 0, wipes: 0, rests: 0, goldGain: 0, rounds: 0, caps: 0 }; });
var byLv = {}, bossWin = 0, bossRounds = 0, last = null, lvs = {};
for (var i = 0; i < runs; i++) {
  var rp = playthrough(base + i);
  rp.stages.forEach(function(s, j) { var a = agg[j]; a.battles += s.battles; a.wipes += s.wipes; a.rests += s.rests; a.goldGain += s.goldGain; a.rounds += s.rounds; a.caps += s.cap ? 1 : 0; });
  Object.keys(rp.byLv).forEach(function(l) { var x = byLv[l] = byLv[l] || { b: 0, loss: 0, wipes: 0 }; x.b += rp.byLv[l].b; x.loss += rp.byLv[l].loss; x.wipes += rp.byLv[l].wipes; });
  bossWin += rp.boss.winRate; bossRounds += rp.boss.rounds; last = rp;
}
if (process.argv[4] === 'matrix') {
  var areas = [['草原', MAPS.world.encounters.grass], ['森', MAPS.forest.encounters.forest], ['魔王城', MAPS.castle.encounters.dark], ['魔王', [{ enemies: ['demonKing'], weight: 1 }]], ['深淵', MAPS.abyss.encounters.dark], ['ゼル', [{ enemies: ['zelgios'], weight: 1 }]]];
  var snapAgg = {};
  for (var mi = 0; mi < Math.min(runs, 12); mi++) {
    var rr = playthrough(base + mi);
    Object.keys(rr.snaps).forEach(function(L) { (snapAgg[L] = snapAgg[L] || []).push(rr.snaps[L]); });
  }
  console.log('Lv   ' + areas.map(function(a) { return (a[0] + '        ').slice(0, 6) + ' wipe%/hpLost%/rounds'; }).join('   |   '));
  Object.keys(snapAgg).sort(function(a, b) { return a - b; }).forEach(function(L) {
    var cols = areas.map(function(a) {
      var n = 0, wipes = 0, loss = 0, rds = 0;
      snapAgg[L].forEach(function(sn, si2) {
        for (var f = 0; f < ((a[0] === '魔王' || a[0] === 'ゼル') ? 8 : 25); f++) {
          seedRng(1000 + si2 * 97 + f);
          var gg = JSON.parse(sn); gg.battle = null; inn(gg);
          var mx = gg.party.reduce(function(x, c) { return x + c.maxHp; }, 0);
          var rs = fight(gg, pick(a[1]));
          n++; rds += rs.rounds; if (!rs.won) { wipes++; loss += 1; } else loss += Math.max(0, mx - gg.party.reduce(function(x, c) { return x + c.hp; }, 0)) / mx;
        }
      });
      return (wipes / n * 100).toFixed(0).padStart(4) + (loss / n * 100).toFixed(0).padStart(7) + (rds / n).toFixed(1).padStart(8) + '          ';
    });
    console.log(String(L).padStart(2) + '   ' + cols.join('   |   '));
  });
  return;
}
console.log('runs=' + runs);
console.log('stage      battles  wipes/100b  rests/100b  gold/battle  rounds/battle');
agg.forEach(function(a) {
  var n = a.battles || 1;
  console.log((a.name + '        ').slice(0, 9) + ' ' + (a.battles / runs).toFixed(0).padStart(7) + (a.wipes / n * 100).toFixed(1).padStart(12) + (a.rests / n * 100).toFixed(1).padStart(12) + (a.goldGain / n).toFixed(1).padStart(13) + (a.rounds / n).toFixed(2).padStart(15) + (a.caps ? '  CAPPED x' + a.caps : ''));
});
console.log('minLv  battles/run  hpLost%/battle  wipe%');
Object.keys(byLv).sort(function(a, b) { return a - b; }).forEach(function(l) { var x = byLv[l]; console.log(String(l).padStart(5) + (x.b / runs).toFixed(1).padStart(13) + (x.loss / x.b * 100).toFixed(1).padStart(16) + (x.wipes / x.b * 100).toFixed(1).padStart(8)); });
console.log('damage share (party attack damage): ' + ['sam', 'dario', 'sundar'].map(function(k) { var t = (DMG.sam || 0) + (DMG.dario || 0) + (DMG.sundar || 0); return k + ' ' + ((DMG[k] || 0) / t * 100).toFixed(0) + '%'; }).join('  '));
console.log('boss win rate: ' + (bossWin / runs * 100).toFixed(0) + '%  avg rounds: ' + (bossRounds / runs).toFixed(1));
console.log('sample end state: Lv ' + last.boss.lv + '  gear ' + last.boss.gear);
