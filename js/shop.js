// ============================================================
// shop.js — The shop and inn screens (state handling and drawing).
// Plain global functions shared with main.js (the state machine); load it before main.js.
// ============================================================

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
