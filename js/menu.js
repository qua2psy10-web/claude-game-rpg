// ============================================================
// menu.js — The in-game party menu (items, equipment, status, ずかん, きろく, いらい, help, save, settings) and equipping.
// Plain global functions shared with main.js (the state machine); load it before main.js.
// ============================================================

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
