// Headless smoke test: drives the real game in Chromium (Playwright) through the main flows and checks the data.
// Usage: node tools/smoke-test.js        (exit code 0 = all passed)
// Needs Playwright (resolved from node_modules, or from `npm root -g`) and a Chromium (PLAYWRIGHT_BROWSERS_PATH,
// or /opt/pw-browsers/chromium). It serves the repo itself, so nothing else has to run.
var http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
var root = path.join(__dirname, '..');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) {}
  var g = cp.execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}
var MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
function serve() {
  return new Promise(function(resolve) {
    var srv = http.createServer(function(req, res) {
      var p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      var f = path.join(root, p);
      if (f.indexOf(root) !== 0 || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    }).listen(0, function() { resolve(srv); });
  });
}

var passed = 0, failed = [];
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

(async function() {
  var pw = loadPlaywright();
  var srv = await serve(), url = 'http://localhost:' + srv.address().port + '/index.html';
  var exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  var browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  var page = await browser.newPage({ viewport: { width: 660, height: 500 } });
  var errors = [];
  page.on('pageerror', function(e) { errors.push(e.message); });
  page.on('console', function(m) { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('console: ' + m.text()); });   // (the missing favicon is a 404)
  var ev = function(fn, arg) { return page.evaluate(fn, arg); };
  var press = async function(k, wait) { await page.keyboard.press(k); await sleep(wait || 60); };
  var state = function() { return ev(function() { return game.state; }); };
  async function until(pred, ms, step) {
    var t0 = Date.now();
    while (Date.now() - t0 < (ms || 5000)) { if (await ev(pred)) return true; await sleep(step || 50); }
    return false;
  }

  await page.goto(url); await sleep(400);

  console.log('\n[data integrity]');
  var d = await ev(function() {
    var bad = [];
    Object.keys(MAPS).forEach(function(mid) {
      var m = MAPS[mid];
      if (!m.tiles.every(function(r) { return r.length === m.width; }) || m.tiles.length !== m.height) bad.push(mid + ': tiles not ' + m.width + 'x' + m.height);
      Object.keys(m.events).forEach(function(k) {
        var xy = k.split(',').map(Number), e = m.events[k];
        if (xy[0] < 0 || xy[1] < 0 || xy[0] >= m.width || xy[1] >= m.height) { bad.push(mid + ' event out of bounds ' + k); return; }
        var t = TILES[m.tiles[xy[1]][xy[0]]];
        if (!t || !t.passable) bad.push(mid + ' event on a blocked tile ' + k);
        if (e.type === 'mapTransfer' && !MAPS[e.map]) bad.push(mid + ' transfer to unknown map ' + e.map);
        if (e.type === 'boss' && !ENEMIES[e.enemy]) bad.push(mid + ' unknown boss ' + e.enemy);
        if (e.type === 'chest') { var tb = e.itemType === 'weapon' ? WEAPONS : e.itemType === 'armor' ? ARMORS : e.itemType === 'accessory' ? ACCESSORIES : ITEMS; if (!tb[e.item]) bad.push(mid + ' chest item ' + e.item); }
      });
      (m.npcs || []).forEach(function(n) {
        var t = TILES[m.tiles[n.y][n.x]];
        if (!t || !t.passable) bad.push(mid + ' NPC ' + n.name + ' on a blocked tile');
        if (n.shop && !SHOPS[n.shop]) bad.push(mid + ' NPC shop ' + n.shop);
        (n.talk || []).forEach(function(t2) { if (!t2.lines || !t2.lines.length) bad.push(n.name + ' empty talk'); });
      });
      Object.keys(m.encounters || {}).forEach(function(k) { m.encounters[k].forEach(function(g) { g.enemies.forEach(function(id) { if (!ENEMIES[id]) bad.push(mid + ' unknown enemy ' + id); }); }); });
    });
    Object.keys(ENEMIES).forEach(function(id) {
      var e = ENEMIES[id];
      if (!e.desc || e.desc.length < 2 || !e.area) bad.push(id + ' needs desc/area');
      (e.skills || []).forEach(function(s) { if (!SPELLS[s]) bad.push(id + ' unknown skill ' + s); });
      if (e.boss && !BattleSystem.EYE_TABLE[e.shape]) bad.push(id + ' shape ' + e.shape + ' has no EYE_TABLE entry');
    });
    Object.keys(CHARACTERS).forEach(function(c) {
      CHARACTERS[c].spells.forEach(function(s) {
        if (!SPELLS[s.id]) bad.push(c + ' unknown spell ' + s.id);
        else if (!BattleSystem.EFFECT_KINDS[s.id]) bad.push(c + ' spell ' + s.id + ' has no EFFECT_KINDS entry (it would show no effect)');
      });
    });
    Object.keys(SHOPS).forEach(function(sid) {
      SHOPS[sid].items.forEach(function(i) { var tb = i.type === 'weapon' ? WEAPONS : i.type === 'armor' ? ARMORS : i.type === 'accessory' ? ACCESSORIES : ITEMS; if (!tb[i.id]) bad.push(sid + ' sells unknown ' + i.id); });
    });
    ACHIEVEMENTS.forEach(function(a) { var r = a.reward; if (r.item && !ITEMS[r.item]) bad.push(a.id + ' reward item'); if (r.accessory && !ACCESSORIES[r.accessory]) bad.push(a.id + ' reward accessory'); });
    Object.keys(ITEMS).forEach(function(id) { var it = ITEMS[id]; if (it.fx && !ITEMS[it.fx]) bad.push(id + ' fx borrows unknown ' + it.fx); });
    return bad;
  });
  ok(d.length === 0, 'maps, events, NPCs, enemies, spells, shops, achievements are consistent', d.join('; '));

  console.log('\n[boot and new game, with real keys]');
  ok(await state() === 'title', 'starts on the title screen');
  await press('z', 100);      // skip the title intro
  await press('z', 100);      // はじめから (fades out, then starts)
  ok(await until(function() { return game.state === 'opening'; }, 4000), 'opening starts');
  var skipped = false;
  for (var sk = 0; sk < 40 && !skipped; sk++) { await press('z', 120); skipped = (await state()) === 'dialogue'; }   // Z skips the opening (it may ignore the first presses)
  ok(skipped, "the chief's dialogue starts");
  for (var i = 0; i < 8; i++) { if (await state() !== 'dialogue') break; await press('z', 80); }
  ok(await state() === 'map', 'dialogue ends on the map');
  var pos0 = await ev(function() { return game.playerX + ',' + game.playerY; });
  await page.keyboard.down('ArrowLeft'); await sleep(260); await page.keyboard.up('ArrowLeft'); await sleep(200);
  ok(await ev(function() { return game.playerX + ',' + game.playerY; }) !== pos0, 'arrow keys move the party');
  ok(await ev(function() { return !!game.hints.move; }), 'the first-move hint was queued');

  console.log('\n[menu screens]');
  await press('x', 100);
  ok(await state() === 'menu', 'X opens the menu');
  var labels = await ev(function() { return MENU_ITEMS; });
  for (var mi = 0; mi < labels.length; mi++) {
    var lab = labels[mi];
    if (lab === 'セーブ' || lab === 'とじる') continue;
    await ev(function(i) { game.menuState = { index: i, subState: null }; game.settings = null; }, mi);
    await press('z', 120);
    var shown = await ev(function() { return (game.menuState && game.menuState.subState) || (game.settings ? 'settings' : 'none'); });
    ok(shown !== 'none', 'menu item ' + lab + ' opens a screen', shown);
    await press('x', 100);
    if (await ev(function() { return !!game.settings; })) await press('Escape', 100);
  }
  await ev(function() { game.settings = null; game.menuState = null; game.state = 'map'; });

  console.log('\n[shop and inns]');
  var sh = await ev(function() {
    game.gold = 500; var before = game.gold; openShop('itemShop');
    return before;
  });
  await sleep(1000);
  await press('z', 120); await press('z', 120);           // select the first item, confirm the purchase
  var g1 = await ev(function() { return game.gold; });
  ok(g1 < sh, 'buying in the item shop costs gold', sh + ' -> ' + g1);
  await ev(function() { game.shopState = null; game.state = 'map'; });
  for (var town of [['millhaven', '宿屋'], ['haruka', '宿屋']]) {
    var innOk = await ev(function(t) {
      var m = MAPS[t[0]], n = m.npcs.filter(function(x) { return x.name === t[1]; })[0];
      game.currentMap = t[0]; game.state = 'map'; game.gold = 200; game.playerX = n.x; game.playerY = n.y + 1; game.facing = 'up';
      game.party.forEach(function(c) { c.hp = 1; c.mp = 0; });
      MapSystem.interact(game); return game.state === 'dialogue';
    }, town);
    ok(innOk, town[0] + ': talking to the innkeeper starts a dialogue');
    for (var k = 0; k < 6 && await state() === 'dialogue'; k++) await press('z', 80);
    ok(await state() === 'inn', town[0] + ': the inn menu opens');
    await press('z', 100);
    ok(await ev(function() { return game.innState && game.innState.phase === 'sleep'; }), town[0] + ': accepting starts the night scene');
    await sleep(1100); await press('z', 100);
    ok(await until(function() { return game.state === 'dialogue'; }, 6000), town[0] + ': the night ends with the morning dialogue');
    var healed = await ev(function() { return game.party.every(function(c) { return c.hp === c.maxHp && c.mp === c.maxMp; }) && game.gold === 170; });
    ok(healed, town[0] + ': HP/MP are restored and 30G paid');
    await ev(function() { game.state = 'map'; game.dialogue = null; });
  }

  console.log('\n[battle, ずかん, records]');
  await ev(function() { game.currentMap = 'world'; game.state = 'map'; game.party.forEach(function(c) { c.hp = c.maxHp; c.mp = c.maxMp; c.alive = true; }); BattleSystem.startBattle(game, ['slime']); game.battle.enemies[0].hp = 1; });
  ok(await ev(function() { return !!game.hints.battle; }), 'the battle hint was queued');
  var won = false;
  for (var bt = 0; bt < 400 && !won; bt++) { await press('z', 50); won = (await state()) === 'map'; }
  ok(won, 'a battle can be won with the keyboard and returns to the map');
  var bs = await ev(function() { return game.bestiary.slime; });
  ok(bs && bs.seen >= 1 && bs.defeated >= 1, 'the ずかん recorded the slime', JSON.stringify(bs));
  await ev(function() { game.state = 'map'; game.dialogue = null; game.battle = null; });

  console.log('\n[spells and items in battle]');
  var sp = await ev(function() {
    game.party.forEach(function(c) { c.level = 12; c.hp = c.maxHp; c.mp = c.maxMp = 60; c.alive = true; });
    game.inventory = [{ id: 'highHerb', count: 1 }, { id: 'elixir', count: 1 }, { id: 'bigBomb', count: 1 }];
    game.state = 'battle'; BattleSystem.startBattle(game, ['goblin', 'goblin']); var b = game.battle;
    b.bossIntro = false; b.phase = 'command'; b.messages = []; b.messageTimer = 0;
    var cast = function(actor, spellId, target, tt) {
      b.commands = [{ actor: actor, actorType: 'party', action: 'spell', spellId: spellId, target: target, targetType: tt }]; b.phase = 'command';
      BattleSystem.startExecution(game); var g = 0; while (b.phase === 'execute' && g++ < 80) { BattleSystem.executeNextAction(game); b.messageTimer = 0; }
    };
    var out = {}, hp0 = b.enemies.map(function(e) { return e.hp; });
    cast(0, 'sweep', -1, 'allEnemy'); out.sweep = b.enemies.every(function(e, i) { return e.hp < hp0[i]; });
    var m = Math.random; Math.random = function() { return 0.01; };
    cast(1, 'sleep', -1, 'allEnemy'); Math.random = m;
    out.sleep = b.enemies.some(function(e) { return e.sleepTurns > 0; });
    cast(1, 'magicBoost', -1, 'party'); out.boost = game.party.every(function(c) { return c.buffs && c.buffs.int; });
    cast(2, 'light', 0, 'enemy'); out.light = b.enemies[0].hp < hp0[0] || !b.enemies[0].alive;
    BattleSystem.executeItem(game, { actor: 0, actorType: 'party', action: 'item', itemId: 'bigBomb', target: 1 });
    out.bomb = game.inventory.every(function(i) { return i.id !== 'bigBomb'; });
    game.state = 'map'; game.battle = null;
    return out;
  });
  ok(sp.sweep, 'Sweep hits every enemy'); ok(sp.sleep, 'Sleep puts enemies to sleep'); ok(sp.boost, 'Magic Boost buffs the party');
  ok(sp.light, 'Light damages an enemy'); ok(sp.bomb, 'a Mega Bomb is used up');

  console.log('\n[maps, gates and chests]');
  var mp = await ev(function() {
    newGame(); game.state = 'map'; game.currentMap = 'world'; var o = {};
    MapSystem.handleEvent(game, MAPS.world.events['4,13']); o.gateClosed = game.currentMap === 'world';
    game.flags.demonKingDefeated = true; MapSystem.handleEvent(game, MAPS.world.events['4,13']); o.gateOpen = game.currentMap === 'abyss';
    game.currentMap = 'world'; MapSystem.handleEvent(game, MAPS.world.events['18,12']); o.haruka = game.currentMap === 'haruka';
    var n0 = game.inventory.length + game.equipInventory.length;
    MapSystem.handleEvent(game, MAPS.haruka.events['12,1']); o.chest = game.flags.haruka_chest1 === true;
    MapSystem.handleEvent(game, MAPS.haruka.events['12,1']); o.chestOnce = game.inventory.filter(function(i) { return i.id === 'highHerb'; })[0].count === 2;
    o.visited = game.flags.visited_haruka === true && game.flags.visited_abyss === true;
    return o;
  });
  ok(mp.gateClosed, 'the abyss gate is inert before the Demon King falls');
  ok(mp.gateOpen, 'the abyss gate works after it'); ok(mp.haruka, 'Haruka Waystation can be entered');
  ok(mp.chest && mp.chestOnce, 'a chest gives its item exactly once'); ok(mp.visited, 'visiting a map is recorded for the villagers');

  console.log('\n[save, load, old saves]');
  var sv = await ev(function() {
    newGame(); game.state = 'map'; game.gold = 1234; game.flags.foo = true; game.currentMap = 'haruka'; game.playerX = 5; game.playerY = 5;
    game.bestiary.slime = { seen: 2, defeated: 2 }; game.hints.battle = true; game.achieved.seen5 = true;
    saveGame(); var raw = JSON.parse(localStorage.getItem('eldrasia_save'));
    newGame(); var loaded = loadGame();
    var o = { loaded: loaded, gold: game.gold, flag: game.flags.foo, map: game.currentMap + ' ' + game.playerX + ',' + game.playerY, slime: game.bestiary.slime && game.bestiary.slime.defeated, hint: game.hints.battle, ach: game.achieved.seen5 };
    delete raw.hints; delete raw.achieved; delete raw.bestiary; localStorage.setItem('eldrasia_save', JSON.stringify(raw));
    newGame(); o.oldLoaded = loadGame(); o.oldHints = Object.keys(game.hints).length === HintSystem.IDS.length; o.oldBestiary = JSON.stringify(game.bestiary) === '{}';
    localStorage.setItem('eldrasia_save', '{"broken":'); o.corrupt = readSave().status === 'corrupt';
    return o;
  });
  ok(sv.loaded && sv.gold === 1234 && sv.flag === true && sv.map === 'haruka 5,5', 'a saved game loads back (gold, flags, position)', JSON.stringify(sv));
  ok(sv.slime === 2 && sv.hint === true && sv.ach === true, 'ずかん, hints and achievements round-trip');
  ok(sv.oldLoaded && sv.oldHints && sv.oldBestiary, 'a save from before hints / ずかん / achievements loads');
  ok(sv.corrupt, 'a corrupt save is reported as corrupt, not loaded');

  console.log('\n[achievements and the post-game flow]');
  var pg = await ev(function() {
    newGame(); game.state = 'map'; var o = {};
    Object.keys(ENEMIES).slice(0, 5).forEach(function(id) { game.bestiary[id] = { seen: 1, defeated: 1 }; });
    RecordsSystem.check(game); o.seen5 = game.achieved.seen5 === true && game.inventory.some(function(i) { return i.id === 'highHerb'; });
    var c = game.inventory.length; RecordsSystem.check(game); o.once = game.inventory.length === c;
    // the Demon King's defeat: flag, save outside the castle, then the ending
    game.currentMap = 'castle'; game.pendingBoss = MAPS.castle.events['8,1']; game.state = 'battle';
    BattleSystem.startBattle(game, ['demonKing']); game.battle.enemies[0].hp = 0; game.battle.enemies[0].alive = false;
    BattleSystem.checkWin && BattleSystem.checkWin(game); BattleSystem.handleWin(game);
    return o;
  });
  ok(pg.seen5 && pg.once, 'an achievement grants its reward once');
  for (var w = 0; w < 80 && (await state()) === 'battle'; w++) { await press('z', 60); }
  ok(await state() === 'ending', 'defeating the Demon King starts the ending');
  var af = await ev(function() { var d = JSON.parse(localStorage.getItem('eldrasia_save')); return { map: d.currentMap, flag: d.flags.demonKingDefeated, x: d.playerX, y: d.playerY }; });
  ok(af.map === 'world' && af.flag === true && af.x === 12 && af.y === 5, 'the clear is saved outside the castle', JSON.stringify(af));
  await press('z', 100);
  ok(await state() === 'title', 'the ending returns to the title');
  var zel = await ev(function() {
    newGame(); game.state = 'map'; game.currentMap = 'abyss'; game.party.forEach(function(c) { c.level = 20; });
    game.pendingBoss = MAPS.abyss.events['8,1']; game.state = 'battle'; BattleSystem.startBattle(game, ['zelgios']);
    game.battle.enemies[0].hp = 0; game.battle.enemies[0].alive = false; BattleSystem.handleWin(game);
    return { st: game.state, flag: game.flags.abyssBossDefeated };
  });
  for (var w2 = 0; w2 < 80 && (await state()) === 'battle'; w2++) { await press('z', 60); }
  ok(await ev(function() { return game.flags.abyssBossDefeated === true && game.state !== 'ending'; }), 'the secret boss ends without the ending screen');

  console.log('\n[touch mode]');
  var tp = await browser.newPage({ viewport: { width: 420, height: 800 }, hasTouch: true, isMobile: true });
  tp.on('pageerror', function(e) { errors.push('touch: ' + e.message); });
  await tp.goto(url + '?touch=1'); await sleep(400);
  ok(await tp.evaluate(function() { return document.body.classList.contains('touch') && !!document.getElementById('dpad'); }), 'touch controls appear with ?touch=1');
  await tp.close();

  console.log('\n[balance simulator]');
  var sim = cp.spawnSync('node', [path.join(__dirname, 'balance-sim.js'), '3', '1'], { encoding: 'utf8' });
  ok(sim.status === 0 && /boss win rate/.test(sim.stdout), 'balance-sim runs through the real battle code', (sim.stderr || '').split('\n')[0]);

  ok(errors.length === 0, 'no page errors during the whole run', errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log('\n' + passed + ' passed, ' + failed.length + ' failed');
  if (failed.length) { console.log('failed: ' + failed.join('; ')); process.exit(1); }
})().catch(function(e) { console.error('smoke test crashed:', e); process.exit(2); });
