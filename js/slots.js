// ============================================================
// slots.js — the three save slots and the slot picker on the title screen
// Slot 1 is the original `eldrasia_save` key (so existing saves just become slot 1); slots 2 and 3 are
// `eldrasia_save_2` / `eldrasia_save_3`. game.slot is the slot the running game saves into.
// ============================================================

var SlotSystem = (function() {
  var COUNT = 3;
  var KEYS = ['eldrasia_save', 'eldrasia_save_2', 'eldrasia_save_3'];
  var TITLES = { 'new': 'どこに はじめますか？', load: 'どれを つづけますか？', ngSrc: 'どの せいせきを ひきつぎますか？', ngDst: 'どこに セーブしますか？' };

  function key(slot) { return KEYS[Math.max(1, Math.min(COUNT, slot || 1)) - 1]; }
  function info(slot) { var r = readSave(slot); return r.status === 'ok' ? r.data : null; }
  function status(slot) { return readSave(slot).status; }
  function anySave() { for (var s = 1; s <= COUNT; s++) if (info(s)) return true; return false; }
  function anyCleared() { for (var s = 1; s <= COUNT; s++) { var d = info(s); if (d && d.flags && d.flags.demonKingDefeated) return true; } return false; }

  // Can this slot be chosen in this picker mode?
  function selectable(mode, slot) {
    var st = status(slot), d = info(slot);
    if (mode === 'load') return st === 'ok';
    if (mode === 'ngSrc') return !!(d && d.flags && d.flags.demonKingDefeated);
    return true;   // 'new' and 'ngDst' may use any slot (an occupied one asks for a second confirm)
  }
  function firstSelectable(mode) { for (var s = 1; s <= COUNT; s++) if (selectable(mode, s)) return s; return 1; }

  function open(mode, src) { return { mode: mode, src: src || 0, index: firstSelectable(mode) - 1, warn: 0 }; }

  // Returns null while the picker stays open, { close: true } to go back, or { slot, src? } when a slot is chosen
  function update(p, input) {
    if (input === 'up') { p.index = (p.index + COUNT - 1) % COUNT; p.warn = 0; SoundSystem.cursor(); }
    else if (input === 'down') { p.index = (p.index + 1) % COUNT; p.warn = 0; SoundSystem.cursor(); }
    else if (input === 'cancel') { SoundSystem.cancel(); return { close: true }; }
    else if (input === 'confirm') {
      var slot = p.index + 1;
      if (!selectable(p.mode, slot)) { SoundSystem.denied(); return null; }
      var occupied = status(slot) !== 'none';
      if ((p.mode === 'new' || p.mode === 'ngDst') && occupied && p.warn !== slot) {   // overwriting asks once more
        p.warn = slot; SoundSystem.denied(); return null;
      }
      return { slot: slot, src: p.src };
    }
    return null;
  }

  function fmtTime(sec) { sec = Math.floor(sec || 0); var m = Math.floor(sec / 60); return Math.floor(m / 60) + ':' + ((m % 60) < 10 ? '0' : '') + (m % 60); }

  function render(ctx, p) {
    var x = 70, y = 214, w = 500, h = 232;
    ctx.fillStyle = '#04041c'; ctx.fillRect(x, y, w, h);   // solid, so the title menu behind does not show through
    UI.drawWindow(ctx, x, y, w, h);
    ctx.save();
    ctx.textAlign = 'left';
    UI.drawText(ctx, TITLES[p.mode], x + 20, y + 12, '#ffd700');
    for (var s = 1; s <= COUNT; s++) {
      var ry = y + 46 + (s - 1) * 56, d = info(s), st = status(s), ok = selectable(p.mode, s);
      var col = ok ? '#fff' : '#555';
      if (p.index === s - 1 && Math.floor(Date.now() / 500) % 2 === 0) UI.drawText(ctx, UI.CURSOR, x + 14, ry);
      if (d) {
        var mapName = MAPS[d.currentMap] ? MAPS[d.currentMap].name : '？';
        UI.drawText(ctx, 'スロット' + s + '  ' + mapName + '  Lv.' + d.party.map(function(m) { return m.level; }).join('/') + ((d.cycle || 1) > 1 ? '  ' + d.cycle + '周目' : ''), x + 40, ry, col, UI.FONT_SMALL);
        var dt = d.savedAt ? new Date(d.savedAt) : null;
        UI.drawText(ctx, (d.gold || 0) + 'G  ' + fmtTime(d.playTime) + (d.flags && d.flags.demonKingDefeated ? '  ★クリア' : '') + (dt ? '   ' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + dt.getHours() + ':' + (dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes() : ''), x + 40, ry + 20, ok ? '#9ab' : '#444', UI.FONT_SMALL);
      } else {
        UI.drawText(ctx, 'スロット' + s + '  ' + (st === 'corrupt' ? 'よみこめません' : '— からっぽ —'), x + 40, ry, st === 'corrupt' ? '#f88' : (ok ? '#9ab' : '#555'), UI.FONT_SMALL);
      }
    }
    var warn = p.warn ? 'スロット' + p.warn + 'は うわがきされます。もういちど けってい' + (p.mode === 'ngDst' && p.warn === p.src ? ' (1しゅうめの データが きえます)' : '') : 'X: もどる';
    UI.drawText(ctx, warn, x + 20, y + h - 26, p.warn ? '#f88' : '#778', UI.FONT_SMALL);
    ctx.restore();
  }

  return { COUNT: COUNT, key: key, info: info, status: status, anySave: anySave, anyCleared: anyCleared, open: open, update: update, render: render, selectable: selectable };
})();
