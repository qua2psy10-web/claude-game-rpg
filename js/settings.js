// ============================================================
// settings.js — player options (volumes, screen shake) and their panel
// Stored under its own localStorage key, independent of the game save.
// ============================================================

var SettingsSystem = (function() {
  var KEY = 'eldrasia_settings';
  var MAX = 10, DEFAULT_LEVEL = 7;          // level DEFAULT_LEVEL = the original volume, MAX = ~1.43x
  var values = { bgm: DEFAULT_LEVEL, se: DEFAULT_LEVEL, amb: DEFAULT_LEVEL, shake: true };
  var ITEMS = [
    { key: 'bgm',   label: 'BGM',        type: 'level' },
    { key: 'se',    label: '効果音',      type: 'level' },
    { key: 'amb',   label: '環境音',      type: 'level' },
    { key: 'shake', label: '画面のゆれ',  type: 'toggle' },
    { key: null,    label: 'もどる',      type: 'back' }
  ];

  function clampLevel(v) { v = Math.round(Number(v)); return isNaN(v) ? DEFAULT_LEVEL : Math.max(0, Math.min(MAX, v)); }
  function factor(key) { return values[key] / DEFAULT_LEVEL; }

  // Push the current values into the audio systems
  function apply() {
    if (typeof MusicSystem !== 'undefined') MusicSystem.setVolume(0.18 * factor('bgm'));
    if (typeof SoundSystem !== 'undefined') { SoundSystem.setSeVolume(factor('se')); SoundSystem.setAmbVolume(factor('amb')); }
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === 'object') {
        values.bgm = clampLevel(d.bgm === undefined ? DEFAULT_LEVEL : d.bgm);
        values.se = clampLevel(d.se === undefined ? DEFAULT_LEVEL : d.se);
        values.amb = clampLevel(d.amb === undefined ? DEFAULT_LEVEL : d.amb);
        values.shake = d.shake !== false;
      }
    } catch (e) {}
    apply();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) {} }

  // Handle one input; returns true when the panel should close
  function update(st, input) {
    var it = ITEMS[st.index];
    if (input === 'up') { st.index = (st.index - 1 + ITEMS.length) % ITEMS.length; SoundSystem.cursor(); }
    else if (input === 'down') { st.index = (st.index + 1) % ITEMS.length; SoundSystem.cursor(); }
    else if (input === 'cancel' || (input === 'confirm' && it.type === 'back')) { SoundSystem.cancel(); save(); return true; }
    else if ((input === 'left' || input === 'right') && it.type === 'level') {
      var nv = clampLevel(values[it.key] + (input === 'right' ? 1 : -1));
      if (nv === values[it.key]) { SoundSystem.denied(); return false; }
      values[it.key] = nv; apply(); save();
      if (it.key === 'se') SoundSystem.confirm();          // samples so the change can be heard
      else if (it.key === 'amb') SoundSystem.birdsFar(false);
    } else if ((input === 'left' || input === 'right' || input === 'confirm') && it.type === 'toggle') {
      values[it.key] = !values[it.key]; save(); SoundSystem.cursor();
    }
    return false;
  }

  function render(ctx, st) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    UI.drawWindow(ctx, 90, 70, 460, 310);
    ctx.textAlign = 'left';
    UI.drawText(ctx, 'せってい', 120, 88, '#ffd700');
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i], y = 134 + i * 40, sel = i === st.index;
      if (sel && Math.floor(Date.now() / 500) % 2 === 0) UI.drawText(ctx, UI.CURSOR, 110, y);
      UI.drawText(ctx, it.label, 140, y, sel ? '#fff' : '#bbb');
      if (it.type === 'level') {
        for (var b = 0; b < MAX; b++) {
          ctx.fillStyle = b < values[it.key] ? (sel ? '#7cf' : '#58a') : '#234';
          ctx.fillRect(280 + b * 22, y + 2, 17, 14);
        }
        UI.drawText(ctx, String(values[it.key]), 510, y, '#aaa', UI.FONT_SMALL);
      } else if (it.type === 'toggle') {
        UI.drawText(ctx, values[it.key] ? 'ON' : 'OFF', 280, y, values[it.key] ? '#8f8' : '#f88');
      }
    }
    UI.drawText(ctx, '←→: ちょうせい   X: もどる', 120, 346, '#889', UI.FONT_SMALL);
    ctx.restore();
  }

  return {
    load: load, update: update, render: render, apply: apply,
    get: function(key) { return values[key]; },
    set: function(key, v) { values[key] = key === 'shake' ? !!v : clampLevel(v); apply(); },
    KEY: KEY, MAX: MAX
  };
})();
