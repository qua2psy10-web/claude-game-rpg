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
    Object.keys(QUESTS).forEach(function(id) {
      var q = QUESTS[id], giver = 0, target = 0;
      if (q.kind === 'kill' && !ENEMIES[q.enemy]) bad.push(id + ' unknown enemy');
      if (q.kind === 'fetch' && !ITEMS[q.item]) bad.push(id + ' unknown item');
      if (q.reward.item && !ITEMS[q.reward.item]) bad.push(id + ' reward item');
      ['offer', 'active', 'done'].forEach(function(k) { if (!q.lines[k] || !q.lines[k].length) bad.push(id + ' missing ' + k + ' lines'); });
      Object.keys(MAPS).forEach(function(mid) { (MAPS[mid].npcs || []).forEach(function(n) { if ([].concat(n.quest || []).indexOf(id) >= 0) giver++; if (n.questTarget === id) target++; }); });
      if (giver !== 1) bad.push(id + ' needs exactly one giver'); if (q.kind === 'deliver' && target !== 1) bad.push(id + ' needs one target');
    });
    Object.keys(ITEMS).forEach(function(id) { var it = ITEMS[id]; if (it.fx && !ITEMS[it.fx]) bad.push(id + ' fx borrows unknown ' + it.fx); });
    return bad;
  });
  ok(d.length === 0, 'maps, events, NPCs, enemies, spells, shops, achievements are consistent', d.join('; '));

  console.log('\n[boot and new game, with real keys]');
  ok(await state() === 'title', 'starts on the title screen');
  await press('z', 100);      // skip the title intro
  await press('z', 100);      // はじめから -> the slot picker
  ok(await ev(function() { return !!game.slotPick && game.slotPick.mode === 'new'; }), 'はじめから opens the slot picker');
  await press('z', 100);      // an empty slot 1 (fades out, then starts)
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
    game.party.forEach(function(c) { c.level = 12; c.hp = c.maxHp = 999; c.mp = c.maxMp = 60; c.alive = true; });
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

  console.log('\n[requests]');
  var qs = await ev(function() {
    newGame(); game.state = 'map'; var o = {};
    function npc(map, name) { return MAPS[map].npcs.filter(function(n) { return n.name === name; })[0]; }
    var tr = npc('millhaven', '旅人'), ba = npc('millhaven', '老婆'), ge = npc('haruka', '旅芸人'), so = npc('haruka', '兵士');
    o.offer = QuestSystem.talk(game, tr) === QUESTS.wolfHunt.lines.offer && game.quests.wolfHunt.state === 'active';
    QuestSystem.onDefeated(game, ['wolf', 'slime', 'wolf']); o.n2 = game.quests.wolfHunt.n === 2;
    o.active = QuestSystem.talk(game, tr)[0] === QUESTS.wolfHunt.lines.active[0];
    QuestSystem.onDefeated(game, ['wolf']);
    var g0 = game.gold; o.done = QuestSystem.talk(game, tr) === QUESTS.wolfHunt.lines.done && game.gold === g0 + 150 && game.quests.wolfHunt.state === 'done';
    o.after = QuestSystem.talk(game, tr) === null;
    QuestSystem.onDefeated(game, ['wolf']); o.noRecount = game.quests.wolfHunt.n === 3;
    o.before = QuestSystem.talk(game, ge) === null;                    // the target says nothing special before the package is carried
    QuestSystem.talk(game, ba); var g1 = game.gold;
    o.deliver = QuestSystem.talk(game, ge) === QUESTS.herbDelivery.lines.done && game.gold === g1 + 100;
    QuestSystem.talk(game, so); o.fetchWait = QuestSystem.talk(game, so)[0] === QUESTS.antidoteFetch.lines.active[0];
    MapSystem.giveItem(game, 'antidote', 3); o.fetch = QuestSystem.talk(game, so) === QUESTS.antidoteFetch.lines.done && !game.inventory.some(function(i) { return i.id === 'antidote'; });
    saveGame(); var back = QuestSystem.sanitize(JSON.parse(localStorage.getItem('eldrasia_save')).quests);
    o.saved = back.wolfHunt.state === 'done' && back.antidoteFetch.state === 'done';
    o.oldSave = Object.keys(QuestSystem.sanitize(undefined)).length === 0;
    newGame(); o.reset = Object.keys(game.quests).length === 0;
    return o;
  });
  ok(qs.offer && qs.n2 && qs.active && qs.done && qs.after && qs.noRecount, 'a kill request is accepted, counted, rewarded once', JSON.stringify(qs));
  ok(qs.before && qs.deliver, 'a delivery is finished by the target NPC in another town');
  ok(qs.fetchWait && qs.fetch, 'a fetch request takes the items and pays');
  ok(qs.saved && qs.oldSave && qs.reset, 'requests are saved, absent in old saves, reset by a new game');
  var q2 = await ev(function() {
    newGame(); game.state = 'map'; var o = {};
    function npc(map, name) { return MAPS[map].npcs.filter(function(n) { return n.name === name; })[0]; }
    var ch = npc('millhaven', '村長'), tr = npc('millhaven', '旅人');
    o.gated = QuestSystem.talk(game, npc('millhaven', '子ども')) === null && QuestSystem.talk(game, tr) === QUESTS.wolfHunt.lines.offer;   // batHunt needs the forest; the traveller gives the first request only
    game.flags.visited_castle = true; game.flags.demonKingDefeated = true;
    QuestSystem.talk(game, ch); o.first = game.quests.skeletonHunt && !game.quests.castleHunt;
    QuestSystem.onDefeated(game, ['skeleton', 'skeleton', 'skeleton', 'skeleton']); QuestSystem.talk(game, ch);
    o.second = QuestSystem.talk(game, ch) === QUESTS.castleHunt.lines.offer && game.quests.castleHunt.state === 'active';   // the chief moves on to the next request
    Object.keys(QUESTS).forEach(function(id) { game.quests[id] = { state: 'done', n: 0 }; });
    RecordsSystem.check(game); o.helper = game.achieved.helper === true && game.equipInventory.some(function(e) { return e.id === 'kindRing'; });
    return o;
  });
  var q3 = await ev(function() {
    newGame(); game.state = 'map'; var o = {};
    var so = MAPS.haruka.npcs.filter(function(n) { return n.name === '兵士'; })[0];
    game.quests.antidoteFetch = { state: 'done', n: 0 };
    o.closed = QuestSystem.talk(game, so) === null;                                   // nothing to give before the cave is visited
    game.flags.visited_crystalCave = true;
    o.offer = QuestSystem.talk(game, so) === QUESTS.crystalHunt.lines.offer && game.quests.crystalHunt.state === 'active';
    QuestSystem.onDefeated(game, ['crystalGolem', 'crystalSlime', 'crystalGolem']);
    var herbs = (game.inventory.filter(function(i) { return i.id === 'highHerb'; })[0] || { count: 0 }).count, g0 = game.gold;
    o.done = QuestSystem.talk(game, so) === QUESTS.crystalHunt.lines.done && game.gold === g0 + 150 && game.inventory.filter(function(i) { return i.id === 'highHerb'; })[0].count === herbs + 5;
    o.total = Object.keys(QUESTS).length === 9;
    return o;
  });
  ok(q3.closed && q3.offer && q3.done && q3.total, 'the soldier gives the Crystal Caverns request once the cave has been visited', JSON.stringify(q3));
  ok(q2.gated && q2.first && q2.second, 'requests unlock with the story and an NPC hands out the next one after the first', JSON.stringify(q2));
  ok(q2.helper, 'finishing every request grants the みんなの指輪');
  await ev(function() { game.state = 'menu'; game.menuState = { index: MENU_ITEMS.indexOf('いらい'), subState: null }; });
  await press('z', 100);
  ok(await ev(function() { return game.menuState.subState === 'quests'; }), 'the menu opens the requests screen');
  await press('ArrowRight', 100);
  ok(await ev(function() { return game.menuState.qPage === 1; }), 'the requests screen turns pages');
  await press('x', 100);

  console.log('\n[music]');
  var mu = await ev(function() {
    var info = MusicSystem.trackInfo(), bad = [];
    Object.keys(info).forEach(function(k) { if (!info[k].once && info[k].melody !== info[k].bass) bad.push(k + ' ' + info[k].melody + '/' + info[k].bass); });
    var o = { bad: bad, abyss: !!info.abyss, way: !!info.waystation, map: [getMapBgm('abyss'), getMapBgm('haruka'), getMapBgm('millhaven'), getMapBgm('castle')].join() };
    return o;
  });
  ok(mu.bad.length === 0 && mu.abyss && mu.way, 'every looping track has melody and bass of equal length (loops seamlessly)', JSON.stringify(mu.bad));
  ok(mu.map === 'abyss,waystation,town,field', 'the abyss and Haruka have their own BGM, the others keep theirs', mu.map);
  var played = await ev(async function() {
    var ac = new (window.AudioContext || window.webkitAudioContext)(); MusicSystem.init(ac);
    var o = {}, sleepMs = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    for (var t of ['abyss', 'waystation']) { MusicSystem.changeTo(t); await sleepMs(500); o[t] = MusicSystem.current(); }
    MusicSystem.stop(); return o;
  });
  ok(played.abyss === 'abyss' && played.waystation === 'waystation', 'the new tracks start playing (and the scheduler runs without errors)', JSON.stringify(played));

  console.log('\n[battle screen and error guard]');
  var bs = await ev(function() {
    newGame(); game.state = 'map'; game.dialogue = null; var o = {};
    BattleSystem.startBattle(game, ['slime', 'goblin']);
    var calls = 0, orig = UI.drawMessageWindow; UI.drawMessageWindow = function() { calls++; return orig.apply(UI, arguments); };
    var b = game.battle; b.phase = 'command'; b.messageTimer = 0; b.messages = ['むかしの メッセージ'];
    BattleSystem.render(ctx, game, 640, 480); o.hidden = calls === 0;          // leftover lines never cover the menu
    b.messageTimer = 30; b.messages = ['MPが 足りない！']; calls = 0;
    BattleSystem.render(ctx, game, 640, 480); o.feedback = calls === 1;         // short feedback still shows
    b.phase = 'execute'; b.messageTimer = 0; calls = 0;
    BattleSystem.render(ctx, game, 640, 480); o.exec = calls === 1;             // results always show
    UI.drawMessageWindow = orig;
    // an exception in a frame must not stop the loop
    var realRender = window.render, raf = window.requestAnimationFrame, scheduled = 0;
    window.requestAnimationFrame = function() { scheduled++; };
    var quiet = console.error; console.error = function() {};
    window.render = function() { throw new Error('boom'); };
    gameLoop(1000); gameLoop(1016);
    window.render = realRender; window.requestAnimationFrame = raf; console.error = quiet;
    o.loop = scheduled === 2 && lastGameError && lastGameError.msg === 'boom' && lastGameError.count === 2;
    lastGameError = null;
    // the item list scrolls: with many kinds the cursor row and the window stay on screen
    game.inventory = Object.keys(ITEMS).slice(0, 12).map(function(k) { return { id: k, count: 1 }; });
    var rows = [], origMenu = UI.drawMenu; UI.drawMenu = function(c, x, y, w, items, sel) { rows.push({ n: items.length, sel: sel, bottom: y + items.length * 26 + 20 }); return origMenu.apply(UI, arguments); };
    b.phase = 'itemSelect'; b.messageTimer = 0;
    [0, 5, game.inventory.length - 1].forEach(function(i) { b.itemIndex = i; BattleSystem.render(ctx, game, 640, 480); });
    UI.drawMenu = origMenu;
    o.items = rows.length === 3 && rows.every(function(r) { return r.n <= 6 && r.bottom <= 480 && r.sel >= 0 && r.sel < r.n; });
    // message window: nothing is dropped (more than 3 lines) and long lines wrap inside the window
    var drawn = [], origText = UI.drawText; UI.drawText = function(c, s) { drawn.push(s); return origText.apply(UI, arguments); };
    var long = '一二三四五六七八九十'.repeat(4);
    UI.drawMessageWindow(ctx, ['a1', 'a2', 'a3', 'a4', long], 640, 480);
    UI.drawText = origText;
    o.wrap = drawn.length === 6 && drawn[3] === 'a4' && drawn.slice(4).join('') === long;
    // a hint about walking never sits over a battle; a fighting hint still does
    var wins = 0, origWin = UI.drawWindow; UI.drawWindow = function() { wins++; return origWin.apply(UI, arguments); };
    HintSystem.reset(); game.hints = {}; HintSystem.show(game, 'dash'); game.state = 'battle'; game.battle = { phase: 'command' };
    HintSystem.renderToast(ctx, game); o.hintHidden = wins === 0;
    HintSystem.reset(); game.hints = {}; HintSystem.show(game, 'battle'); wins = 0;
    HintSystem.renderToast(ctx, game); o.hintShown = wins === 1;
    game.battle.phase = 'win'; wins = 0; HintSystem.renderToast(ctx, game); o.hintWin = wins === 0;
    UI.drawWindow = origWin; HintSystem.reset();
    game.state = 'map'; game.battle = null;
    return o;
  });
  ok(bs.wrap, 'the message window keeps every line and wraps long ones', JSON.stringify(bs));
  ok(bs.hintHidden && bs.hintShown && bs.hintWin, 'walking hints stay out of battle and no hint covers the victory banner', JSON.stringify(bs));
  ok(bs.items, 'the battle item list scrolls instead of running off the screen', JSON.stringify(bs));
  ok(bs.hidden && bs.feedback && bs.exec, 'the battle message window no longer covers the command menu', JSON.stringify(bs));
  ok(bs.loop, 'an exception in one frame is reported but the game loop keeps running');

  console.log('\n[blacksmith]');
  var sm = await ev(function() {
    newGame(); game.state = 'map'; var o = {}, sam = game.party[0];
    equipItem(game, 0, 'weapon', { id: 'ironSword', type: 'weapon' });
    var atk0 = sam.atk; o.base = atk0;
    game.gold = 10000;
    SmithSystem.open(game); o.opened = game.state === 'smith';
    SmithSystem.update(game, 'confirm');                                   // row 0 = Sam's weapon
    o.plus1 = sam.weaponPlus === 1 && sam.atk === atk0 + SmithSystem.bonus(WEAPONS.ironSword, 1).atk && game.gold === 10000 - SmithSystem.cost(WEAPONS.ironSword, 0);
    for (var i = 0; i < 6; i++) SmithSystem.update(game, 'confirm');
    o.max = sam.weaponPlus === 5 && sam.atk === atk0 + SmithSystem.bonus(WEAPONS.ironSword, 5).atk;
    var g0 = game.gold; SmithSystem.update(game, 'confirm'); o.noMore = game.gold === g0 && sam.weaponPlus === 5;
    // the level travels with the item
    equipItem(game, 0, 'weapon', { id: 'woodenSword', type: 'weapon' });
    var back = game.equipInventory.filter(function(e) { return e.id === 'ironSword'; })[0];
    o.stripped = back && back.plus === 5 && sam.weaponPlus === 0 && sam.atk === atk0 - WEAPONS.ironSword.atk + WEAPONS.woodenSword.atk;
    equipItem(game, 0, 'weapon', back); o.restored = sam.weaponPlus === 5 && sam.atk === atk0 + SmithSystem.bonus(WEAPONS.ironSword, 5).atk;
    // poor party: refused
    game.gold = 0; SmithSystem.update(game, 'down'); SmithSystem.update(game, 'confirm'); o.poor = game.party[0].armorPlus === undefined || game.party[0].armorPlus === 0;
    SmithSystem.update(game, 'cancel'); o.closed = game.state === 'map';
    game.gold = 10000; saveGame(); var d = JSON.parse(localStorage.getItem('eldrasia_save')); o.saved = d.party[0].weaponPlus === 5;
    o.cost = SmithSystem.cost({ price: 1000 }, 0) === 250 && SmithSystem.cost({ price: 1000 }, 4) === 850;
    return o;
  });
  ok(sm.opened && sm.plus1 && sm.max && sm.noMore, 'the forge enhances gear for gold up to +5', JSON.stringify(sm));
  ok(sm.stripped && sm.restored, 'the enhancement level travels with the item when swapping gear');
  ok(sm.poor && sm.closed && sm.saved && sm.cost, 'it refuses without gold, closes, saves the level and prices by the item');
  ok(await ev(function() { var n = MAPS.millhaven.npcs.filter(function(x) { return x.smith; }); return n.length === 1 && TILES[MAPS.millhaven.tiles[n[0].y][n[0].x]].passable; }), 'the blacksmith stands in Millhaven');

  console.log('\n[dice stall]');
  var dc = await ev(function() {
    newGame(); game.state = 'map'; var o = {}, m = Math.random;
    // expected return of each pick over many rolls (should be ~91.7%, never above 100%)
    var ev3 = {};
    DiceSystem.PICKS.forEach(function(p) { var back = 0, N = 60000; for (var i = 0; i < N; i++) back += DiceSystem.resolve(100, p.id).back; ev3[p.id] = back / (N * 100); });
    o.ev = ev3;
    // a scripted round: dice 4 + 5 = 9 beats 大 and loses to 小
    var seq = [3 / 6 + 0.01, 4 / 6 + 0.01];   // -> 4, 5
    var i = 0; Math.random = function() { return seq[i++ % 2]; };
    o.hi = DiceSystem.resolve(100, 'hi'); i = 0; o.lo = DiceSystem.resolve(100, 'lo'); Math.random = m;
    // the screen with real update calls
    game.gold = 1000; DiceSystem.open(game); o.opened = game.state === 'dice';
    DiceSystem.update(game, 'down'); DiceSystem.update(game, 'confirm');   // bet 100
    i = 0; Math.random = function() { return seq[i++ % 2]; };
    DiceSystem.update(game, 'confirm');                                    // pick 大
    Math.random = m;
    o.taken = game.gold === 900 && game.diceState.phase === 'roll';
    game.diceState.rollAt -= 2000; DiceSystem.update(game, 'none');       // the roll ends
    o.won = game.diceState.phase === 'result' && game.gold === 900 + 220;
    DiceSystem.update(game, 'confirm'); o.again = game.diceState.phase === 'bet';
    game.gold = 60; game.diceState.betIndex = 3; DiceSystem.update(game, 'confirm'); o.refused = game.diceState.phase === 'bet' && game.gold === 60;
    DiceSystem.update(game, 'cancel'); o.closed = game.state === 'map';
    o.npc = MAPS.haruka.npcs.filter(function(n) { return n.dice; }).length === 1;
    return o;
  });
  ok(dc.ev.hi > 0.88 && dc.ev.hi < 0.95 && dc.ev.lo > 0.88 && dc.ev.lo < 0.95 && dc.ev.seven > 0.85 && dc.ev.seven < 0.98, 'every bet pays back about 92% on average (a gold sink, never a source)', JSON.stringify(dc.ev));
  ok(dc.hi.total === 9 && dc.hi.win && dc.hi.back === 220 && !dc.lo.win && dc.lo.back === 0, 'a scripted roll pays 大 and loses 小', JSON.stringify([dc.hi, dc.lo]));
  ok(dc.opened && dc.taken && dc.won && dc.again, 'the stall takes the bet, rolls and pays the win');
  ok(dc.refused && dc.closed && dc.npc, 'it refuses a bet beyond the gold, closes, and the NPC stands in Haruka');

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
  console.log('\n[New Game+]');
  ok(await ev(function() { return titleItems().indexOf('つよくてニューゲーム') === 2; }), 'the title offers つよくてニューゲーム after the Demon King has fallen');
  await ev(function() { game.titleT0 = Date.now() - 5000; game.titleIndex = 0; game.titleGo = null; game.state = 'title'; });
  var before = await ev(function() { var d = getSaveInfo(); return { lv: d.party.map(function(c) { return c.level; }).join(','), equip: d.equipInventory.length, ach: Object.keys(d.achieved || {}).length, bestiary: Object.keys(d.bestiary || {}).length }; });
  await press('ArrowDown', 80); await press('ArrowDown', 80); await press('z', 80);
  ok(await ev(function() { return !!game.slotPick && game.slotPick.mode === 'ngSrc'; }), 'it first asks which slot to carry over');
  await press('z', 80);       // slot 1 (the cleared save)
  ok(await ev(function() { return !!game.slotPick && game.slotPick.mode === 'ngDst' && game.slotPick.src === 1; }), 'then which slot to save the new cycle in');
  await press('ArrowDown', 80); await press('z', 80);   // the empty slot 2
  ok(await until(function() { return game.state === 'dialogue' && game.cycle === 2; }, 4000), 'choosing it starts cycle 2 with a dialogue (no opening)');
  var ng = await ev(function() {
    var o = { lv: game.party.map(function(c) { return c.level; }).join(','), gold: game.gold, flags: Object.keys(game.flags).length, map: game.currentMap, hpFull: game.party.every(function(c) { return c.hp === c.maxHp; }),
              equip: game.equipInventory.length, ach: Object.keys(game.achieved).length, bestiary: Object.keys(game.bestiary).length };
    BattleSystem.startBattle(game, ['slime']); var e = game.battle.enemies[0];
    o.hp = e.maxHp; o.exp = e.exp; game.battle = null; game.state = 'map';
    o.slot = game.slot; saveGame(); var d = JSON.parse(localStorage.getItem('eldrasia_save_2')); o.savedCycle = d.cycle;
    var c2 = game.cycle; game.cycle = 1; loadGame(2); o.loadedCycle = game.cycle; o.loadedSlot = game.slot; o.cycleBack = c2;
    var src = JSON.parse(localStorage.getItem('eldrasia_save')); o.srcKept = src.flags.demonKingDefeated === true && (src.cycle || 1) === 1;
    return o;
  });
  ok(ng.lv === before.lv && ng.equip === before.equip && ng.ach === before.ach && ng.bestiary === before.bestiary, 'levels, gear, achievements and ずかん carry over', JSON.stringify([before, ng]));
  ok(ng.gold === 100 && ng.flags === 0 && ng.map === 'millhaven' && ng.hpFull, 'gold, story flags and position reset; the party is healed');
  ok(ng.hp === Math.round(32) && ng.exp === Math.round(4 * 1.5), 'enemies are tougher and pay more in cycle 2', JSON.stringify([ng.hp, ng.exp]));
  ok(ng.savedCycle === 2 && ng.loadedCycle === 2 && ng.slot === 2 && ng.loadedSlot === 2, 'the cycle is saved and loaded in the chosen slot');
  ok(ng.srcKept, 'the cleared save in slot 1 is untouched');

  console.log('\n[save slots]');
  var sl = await ev(function() {
    var o = {};
    o.keys = SlotSystem.key(1) === 'eldrasia_save' && SlotSystem.key(2) === 'eldrasia_save_2' && SlotSystem.key(3) === 'eldrasia_save_3';
    // slot 3 stays empty and unselectable for loading; slot 1 and 2 are valid
    o.sel = [SlotSystem.selectable('load', 1), SlotSystem.selectable('load', 2), SlotSystem.selectable('load', 3)].join(',');
    o.ngSrc = [SlotSystem.selectable('ngSrc', 1), SlotSystem.selectable('ngSrc', 2)].join(',');
    // overwriting an occupied slot needs a second confirm
    var p = SlotSystem.open('new'); p.index = 0;
    var r1 = SlotSystem.update(p, 'confirm'), r2 = SlotSystem.update(p, 'confirm');
    o.overwrite = r1 === null && p.warn === 1 && r2 && r2.slot === 1;
    var p2 = SlotSystem.open('new'); p2.index = 2; var r3 = SlotSystem.update(p2, 'confirm'); o.emptyDirect = !!(r3 && r3.slot === 3);
    var p3 = SlotSystem.open('load'); p3.index = 2; o.loadEmptyDenied = SlotSystem.update(p3, 'confirm') === null;
    // saving goes to the slot the game runs in
    newGame(3); game.state = 'map'; game.gold = 777; saveGame();
    o.slot3 = JSON.parse(localStorage.getItem('eldrasia_save_3')).gold === 777 && JSON.parse(localStorage.getItem('eldrasia_save')).gold !== 777;
    return o;
  });
  ok(sl.keys, 'slot 1 is the original save key, slots 2 and 3 have their own');
  ok(sl.sel === 'true,true,false', 'the load picker only allows slots that hold a save', sl.sel);
  ok(sl.ngSrc === 'true,false', 'the New Game+ source picker only allows cleared saves', sl.ngSrc);
  ok(sl.overwrite && sl.emptyDirect && sl.loadEmptyDenied, 'overwriting asks twice, an empty slot does not, an empty slot cannot be loaded');
  ok(sl.slot3, 'saving writes to the slot the game is running in');


  var zel = await ev(function() {
    newGame(); game.state = 'map'; game.currentMap = 'abyss'; game.party.forEach(function(c) { c.level = 20; });
    game.pendingBoss = MAPS.abyss.events['8,1']; game.state = 'battle'; BattleSystem.startBattle(game, ['zelgios']);
    game.battle.enemies[0].hp = 0; game.battle.enemies[0].alive = false; BattleSystem.handleWin(game);
    return { st: game.state, flag: game.flags.abyssBossDefeated };
  });
  for (var w2 = 0; w2 < 80 && (await state()) === 'battle'; w2++) { await press('z', 60); }
  ok(await ev(function() { return game.flags.abyssBossDefeated === true && game.state !== 'ending'; }), 'the secret boss ends without the ending screen');

  console.log('\n[crystal caverns]');
  var cc = await ev(function() {
    newGame(); game.state = 'map'; game.hints = {}; HintSystem.reset(); var o = {};
    // the world marker leads in, and the exit leads back out
    game.currentMap = 'world'; game.playerX = 21; game.playerY = 12; game.facing = 'down';
    MapSystem.movePlayer(game, 0, 1);
    o.enter = game.currentMap === 'crystalCave' && game.flags.visited_crystalCave === true && game.hints.enter_crystalCave === true;
    // every chest and both boss tiles can be walked to from the entrance
    var m = MAPS.crystalCave, seen = {}, q = [[m.playerStart.x, m.playerStart.y]]; seen[q[0][0] + ',' + q[0][1]] = 1;
    while (q.length) { var c = q.shift(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d) { var x = c[0] + d[0], y = c[1] + d[1], k = x + ',' + y;
      if (y >= 0 && y < m.height && x >= 0 && x < m.width && !seen[k] && TILES[m.tiles[y][x]].passable) { seen[k] = 1; q.push([x, y]); } }); }
    var evs = Object.keys(m.events), chests = evs.filter(function(k) { return m.events[k].type === 'chest'; });
    o.reach = chests.length === 6 && chests.every(function(k) { return seen[k]; }) && seen['8,3'] && seen['9,3'];
    o.rows = m.tiles.every(function(r) { return r.length === m.width; }) && m.tiles.length === m.height;
    // the treasure room is only reachable through the guardian
    var behind = chests.filter(function(k) { return +k.split(',')[1] <= 2; });
    o.guarded = behind.length === 2;
    // encounters on crystal floor use the cave's table
    o.table = !!m.encounters.crystal && TILES.Y.encounter === true;
    // every cave enemy fights and draws (the golem sprite included) without errors
    ['crystalSlime', 'crystalBat', 'crystalGolem', 'crystalGuardian'].forEach(function(id) {
      BattleSystem.startBattle(game, [id]); game.state = 'battle'; game.battle.phase = 'command';
      BattleSystem.render(ctx, game, 640, 480); game.battle = null;
    });
    o.bgm = getMapBgm('crystalCave') === 'crystal';
    // guardian: a win sets its flag, shows its closing lines and does not start the ending
    game.currentMap = 'crystalCave'; game.pendingBoss = m.events['8,3']; game.state = 'battle'; BattleSystem.startBattle(game, ['crystalGuardian']);
    game.battle.enemies[0].hp = 0; game.battle.enemies[0].alive = false; BattleSystem.handleWin(game);
    return o;
  });
  for (var w3 = 0; w3 < 80 && (await state()) === 'battle'; w3++) { await press('z', 60); }
  ok(cc.enter, 'the world marker leads into the caverns (visited flag and hint set)', JSON.stringify(cc));
  ok(cc.reach && cc.rows && cc.guarded, 'every chest and both guardian tiles are reachable; the treasure room lies behind the guardian', JSON.stringify(cc));
  ok(cc.table && cc.bgm, 'the cave has its own encounter table and BGM', JSON.stringify(cc));
  ok(await ev(function() { return game.flags.crystalGuardianDefeated === true && game.state !== 'ending'; }), 'the guardian ends without the ending screen');
  ok(await ev(function() { return Object.keys(ENEMIES).filter(function(k) { return !ENEMIES[k].boss || true; }).length === 17 && RecordsSystem.stats(game).chests === 20; }), 'the ずかん has 17 entries and the きろく counts 20 chests');

  console.log('\n[limit skills]');
  var lm = await ev(function() {
    newGame(); game.state = 'map'; game.hints = {}; HintSystem.reset(); var o = {};
    game.party.forEach(function(c) { c.level = 12; c.hp = c.maxHp = 200; c.mp = c.maxMp = 60; c.atk = 80; c.int = 80; });
    BattleSystem.startBattle(game, ['darkKnight', 'darkKnight']); var b = game.battle;
    o.start = game.party.every(function(c) { return c.limit === 0 && c.hpMark === c.hp; });
    // the gauge fills at the end of a round from HP lost (+ a base amount) and is capped at 100
    game.party[0].hp = 100;                                                    // lost 100 of 200 = 50%
    BattleSystem.chargeLimit(game);
    o.charge = Math.abs(game.party[0].limit - (2 + 0.4 * 50)) < 0.01 && Math.abs(game.party[1].limit - 2) < 0.01 && game.party[0].hpMark === 100;
    game.party[1].limit = 99; BattleSystem.chargeLimit(game);
    o.full = game.party[1].limit === 100 && /ひっさつ/.test(b.messages.join('')) && game.hints.limit === true;
    o.listNo = BattleSystem.getAvailableSpells(game.party[0]).every(function(s) { return !SPELLS[s.id].limit; });
    o.listYes = BattleSystem.getAvailableSpells(game.party[1])[0].id === 'limitDario';   // tops the list once full
    // Sam: one big hit, the gauge empties
    var e0 = b.enemies[0], hp0 = e0.hp, slashHp; game.party[0].limit = 100;
    var d1 = BattleSystem.calcSpellDamage(game.party[0], e0, SPELLS.powerSlash);
    BattleSystem.executeSpell(game, { actor: 0, actorType: 'party', action: 'spell', spellId: 'limitSam', target: 0, targetType: 'enemy' });
    var dSam = hp0 - e0.hp; o.sam = dSam > 2 * Math.floor(game.party[0].atk * 2 / 2 - e0.def * 0.5 / 4) && game.party[0].limit === 0 && b.limitCut && b.limitCut.name === 'ブレイブエッジ';
    // Dario: every enemy is hit
    var hpA = b.enemies.map(function(e) { return e.hp; }); game.party[1].limit = 100;
    BattleSystem.executeSpell(game, { actor: 1, actorType: 'party', action: 'spell', spellId: 'limitDario', target: -1, targetType: 'allEnemy' });
    o.dario = b.enemies.every(function(e, i) { return e.hp < hpA[i]; }) && game.party[1].limit === 0;
    // Sundar: heals everyone, raises the fallen and cures poison
    game.party[0].hp = 10; game.party[1].hp = 0; game.party[1].alive = false; game.party[2].poisoned = true; game.party[2].limit = 100; game.party[2].hp = 50;
    BattleSystem.executeSpell(game, { actor: 2, actorType: 'party', action: 'spell', spellId: 'limitSundar', target: -1, targetType: 'party' });
    o.sundar = game.party[1].alive && game.party[1].hp === Math.ceil(200 * 0.25) && game.party[0].hp === 10 + Math.ceil(200 * 0.3) && !game.party[2].poisoned && game.party[2].limit === 0;
    // the gauge is not saved
    saveGame(); o.noSave = JSON.parse(localStorage.getItem('eldrasia_save')).party.every(function(c) { return c.limit === undefined && c.hpMark === undefined; });
    // the spell list scrolls: seven entries (six spells + the limit skill) never run off the screen
    game.party[1].limit = 100; b.phase = 'spellSelect'; b.currentChar = 1; b.messageTimer = 0;
    var rows = [], origMenu = UI.drawMenu; UI.drawMenu = function(c, x, y, w, items, sel) { rows.push({ n: items.length, sel: sel, bottom: y + items.length * 26 + 20, first: items[0] }); return origMenu.apply(UI, arguments); };
    [0, 6].forEach(function(i) { b.spellIndex = i; BattleSystem.render(ctx, game, 640, 480); });
    UI.drawMenu = origMenu;
    var sp = BattleSystem.getAvailableSpells(game.party[1]); o.seven = sp.length === 7;
    o.scroll = rows.length === 2 && rows.every(function(r) { return r.n <= 6 && r.bottom <= 480 && r.sel >= 0 && r.sel < r.n; }) && /メテオフォール/.test(rows[0].first);
    // the cut-in and the gauge draw without errors
    b.limitCut = { name: 'ブレイブエッジ', who: 'サム', t0: Date.now() - 300, dur: 1200 }; b.phase = 'command'; BattleSystem.render(ctx, game, 640, 480);
    game.battle = null; game.state = 'map';
    return o;
  });
  ok(lm.start && lm.charge && lm.full, 'the limit gauge starts empty, fills from HP lost each round and announces a full gauge', JSON.stringify(lm));
  ok(lm.listNo && lm.listYes && lm.seven && lm.scroll, 'the limit skill tops the spell list only when ready, and the list scrolls', JSON.stringify(lm));
  ok(lm.sam && lm.dario && lm.sundar, 'Sam hits hard, Dario hits every enemy, Sundar heals everyone and raises the fallen; the gauge empties', JSON.stringify(lm));
  ok(lm.noSave, 'the limit gauge is battle-only and never saved', JSON.stringify(lm));

  console.log('\n[combo skills]');
  var cb = await ev(function() {
    newGame(); game.state = 'map'; game.hints = {}; HintSystem.reset(); var o = {};
    game.party.forEach(function(c) { c.level = 12; c.hp = c.maxHp = 200; c.mp = c.maxMp = 60; c.atk = 80; c.int = 80; });
    BattleSystem.startBattle(game, ['darkKnight', 'darkKnight']); var b = game.battle; b.phase = 'command'; b.messageTimer = 0;
    var ids = function(i) { return BattleSystem.getAvailableSpells(game.party[i], game).map(function(s) { return s.id; }); };
    o.none = ids(0).indexOf('comboFlame') < 0;
    game.party[0].limit = 100; game.party[1].limit = 100;
    o.offer = ids(0)[0] === 'comboFlame' && ids(0)[1] === 'limitSam' && ids(1).indexOf('comboFlame') < 0;   // only the first of the pair is offered it, above the single skill
    o.noGuard = ids(0).indexOf('comboGuard') < 0 && ids(1).indexOf('comboHoly') < 0;                       // Sundar's gauge is empty
    // choosing it uses up the partner's turn
    b.currentChar = 0; b.commands = [{ actor: 0, actorType: 'party', action: 'spell', spellId: 'comboFlame', target: 0, targetType: 'enemy' }];
    BattleSystem.nextCharCommand(game);
    o.partner = b.commands.length === 2 && b.commands[1].actor === 1 && b.commands[1].action === 'defend' && b.commands[0].partner === 1 && b.comboSkip[1] === true && b.currentChar === 2;
    // it hits harder than the two single skills together, and spends both gauges
    var e0 = b.enemies[0]; e0.hp = e0.maxHp = 5000; var hp0 = e0.hp;
    BattleSystem.executeSpell(game, b.commands[0]);
    var dmg = hp0 - e0.hp;
    o.flame = dmg > 2 * (Math.floor(80 * 4 / 2 - e0.def * 0.2 / 4)) && game.party[0].limit === 0 && game.party[1].limit === 0 && /＆/.test(b.limitCut.who);
    // holy meteor: every enemy, plus a little healing
    b.enemies.forEach(function(e) { e.hp = e.maxHp; e.alive = true; });
    game.party[1].limit = 100; game.party[2].limit = 100; game.party[0].hp = 100;
    BattleSystem.executeSpell(game, { actor: 1, actorType: 'party', action: 'spell', spellId: 'comboHoly', partner: 2, target: -1, targetType: 'allEnemy' });
    o.holy = b.enemies.every(function(e) { return e.hp < e.maxHp; }) && game.party[0].hp === 100 + Math.ceil(200 * 0.2) && game.party[1].limit === 0 && game.party[2].limit === 0;
    // guard: heal, raise the fallen, cure poison, buffs
    game.party[0].limit = 100; game.party[2].limit = 100; game.party[1].hp = 0; game.party[1].alive = false; game.party[2].poisoned = true; game.party[0].hp = 20;
    BattleSystem.executeSpell(game, { actor: 0, actorType: 'party', action: 'spell', spellId: 'comboGuard', partner: 2, target: -1, targetType: 'party' });
    o.guard = game.party[1].alive && game.party[1].hp === Math.ceil(200 * 0.35) && game.party[0].hp === 20 + Math.ceil(200 * 0.4) && !game.party[2].poisoned && game.party[0].buffs.def.mult === 1.4 && game.party[2].buffs.atk.mult === 1.25;
    // a partner who has fallen makes it fizzle without spending anything
    game.party[0].limit = 100; game.party[1].limit = 100; game.party[1].alive = false;
    var hpF = b.enemies[0].hp;
    BattleSystem.executeSpell(game, { actor: 0, actorType: 'party', action: 'spell', spellId: 'comboFlame', partner: 1, target: 0, targetType: 'enemy' });
    o.fizzle = game.party[0].limit === 100 && game.party[1].limit === 100 && b.enemies[0].hp === hpF && /しっぱい/.test(b.messages.join(''));
    // the list labels and the round banner draw without errors; the skip list resets with the next round
    game.party[1].alive = true; game.party[0].limit = 100; game.party[1].limit = 100; b.comboSkip = {}; b.phase = 'spellSelect'; b.currentChar = 0; b.spellIndex = 0; b.messageTimer = 0;
    var labels = [], origMenu = UI.drawMenu; UI.drawMenu = function(c, x, y, w, items) { labels = items; return origMenu.apply(UI, arguments); };
    BattleSystem.render(ctx, game, 640, 480); UI.drawMenu = origMenu;
    o.label = /^★★ ほのおのつるぎ/.test(labels[0]);
    b.comboSkip = { 1: true }; b.currentAction = b.turnQueue.length; b.phase = 'execute'; b.enemies.forEach(function(e) { e.alive = true; });
    BattleSystem.executeNextAction(game); o.reset = Object.keys(b.comboSkip).length === 0;
    game.battle = null; game.state = 'map';
    return o;
  });
  ok(cb.none && cb.offer && cb.noGuard, 'a combo is offered only with two full gauges, to the first of the pair, above the single skill', JSON.stringify(cb));
  ok(cb.partner && cb.label && cb.reset, 'a combo uses up the partner turn (defend, skipped in the command order) and shows its ★★ label', JSON.stringify(cb));
  ok(cb.flame && cb.holy && cb.guard, 'the three combos hit, heal and buff as designed and spend both gauges', JSON.stringify(cb));
  ok(cb.fizzle, 'a combo fizzles without spending anything when the partner has fallen', JSON.stringify(cb));

  console.log('\n[arena]');
  var ar = await ev(function() {
    newGame(); game.state = 'map'; var o = {};
    var npc = MAPS.haruka.npcs.filter(function(n) { return n.arena; })[0];
    o.npc = !!npc && TILES[MAPS.haruka.tiles[npc.y][npc.x]].passable;
    function win() { game.battle.enemies.forEach(function(e) { e.hp = 0; e.alive = false; }); BattleSystem.checkWin(game); BattleSystem.handleWin(game); }
    ArenaSystem.open(game); o.open = game.state === 'arena';
    game.gold = 500; game.arenaState.index = 1; ArenaSystem.update(game, 'confirm');            // veteran: locked until the castle has been visited
    o.locked = game.state === 'arena' && game.gold === 500 && !game.arena;
    game.arenaState.index = 0; game.gold = 50; ArenaSystem.update(game, 'confirm');             // not enough gold
    o.poor = game.state === 'arena' && game.gold === 50 && !game.arena;
    game.gold = 300; var exp0 = game.party[0].exp; ArenaSystem.update(game, 'confirm');
    o.begin = game.state === 'battle' && game.gold === 200 && game.arena.round === 0 && game.battle.enemies.length === 2;
    // no fleeing
    var b = game.battle; b.phase = 'execute'; b.turnQueue = [{ action: 'run', actor: 0, actorType: 'party' }]; b.currentAction = 0;
    BattleSystem.executeNextAction(game); o.noRun = b.phase !== 'run' && /にげられない|逃げられない/.test((b.messages || []).join(''));
    b.phase = 'command'; b.messages = []; b.messageTimer = 0;
    // round 1 -> 2: nothing is paid out, the living recover a bit
    game.party[0].hp = 1; var maxHp = game.party[0].maxHp; win();
    o.round2 = game.state === 'battle' && game.arena.round === 1 && game.battle.enemies.length === 3 && game.gold === 200 && game.party[0].exp === exp0;
    o.recover = game.party[0].hp === Math.min(maxHp, 1 + Math.ceil(maxHp * ArenaSystem.RECOVER));
    win(); o.round3 = game.arena.round === 2; win();
    o.prize = game.state === 'dialogue' && !game.arena && game.gold === 400 && game.flags.arena_clear_novice === true;
    o.first = game.inventory.some(function(i) { return i.id === 'highHerb' && i.count >= 3; });
    // a second win pays the prize but not the first-time reward again
    game.state = 'map'; game.gold = 100; ArenaSystem.begin(game, 'novice'); win(); win(); win();
    o.again = game.gold === 200 && game.inventory.filter(function(i) { return i.id === 'highHerb'; })[0].count === 3;
    // a wipe: no game over, the arena heals everyone and the fee stays paid
    game.state = 'map'; game.gold = 100; ArenaSystem.begin(game, 'novice');
    game.party.forEach(function(p) { p.hp = 0; p.alive = false; }); BattleSystem.checkLose(game); game.battle.messageTimer = 0; BattleSystem.handleInput(game, 'confirm');
    o.lose = game.state === 'dialogue' && !game.arena && game.gold === 0 && game.party.every(function(p) { return p.alive && p.hp === p.maxHp; });
    // the battle shows its round banner without errors
    game.state = 'map'; game.gold = 100; ArenaSystem.begin(game, 'novice'); game.battle.phase = 'command'; BattleSystem.render(ctx, game, 640, 480);
    game.arena = null; game.battle = null; game.state = 'map';
    return o;
  });
  ok(ar.npc && ar.open && ar.locked && ar.poor, 'the arena opens from its receptionist; locked or unaffordable courses are refused', JSON.stringify(ar));
  ok(ar.begin && ar.round2 && ar.recover && ar.round3, 'a run takes the fee, chains three battles, pays no EXP / gold and lets the living recover between rounds', JSON.stringify(ar));
  ok(ar.prize && ar.first && ar.again, 'winning all three pays the prize, and the first win gives its one-off reward once', JSON.stringify(ar));
  ok(ar.noRun, 'there is no fleeing from the arena', JSON.stringify(ar));
  ok(ar.lose, 'a wipe in the arena patches the party up instead of a game over', JSON.stringify(ar));

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
