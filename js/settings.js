// ============================================================
// settings.js — player options (volumes, screen shake) and their panel
// Stored under its own localStorage key, independent of the game save.
// ============================================================

var SettingsSystem = (function() {
  var KEY = 'eldrasia_settings';
  var MAX = 10, DEFAULT_LEVEL = 7;          // level DEFAULT_LEVEL = the original volume, MAX = ~1.43x
  var DEFAULT_KEYS = { confirm: 'z', cancel: 'x', dash: 'Shift' };
  var RESERVED = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Enter', 'Escape'];   // fixed: movement, Enter = confirm, Esc = cancel
  var values = { bgm: DEFAULT_LEVEL, se: DEFAULT_LEVEL, amb: DEFAULT_LEVEL, shake: true, dash: true, autoDash: false,
                 keys: { confirm: DEFAULT_KEYS.confirm, cancel: DEFAULT_KEYS.cancel, dash: DEFAULT_KEYS.dash } };
  var ACTION_LABEL = { confirm: 'けってい', cancel: 'キャンセル', dash: 'ダッシュ' };
  var ITEMS = [
    { key: 'bgm',   label: 'BGM',        type: 'level' },
    { key: 'se',    label: '効果音',      type: 'level' },
    { key: 'amb',   label: '環境音',      type: 'level' },
    { key: 'shake', label: '画面のゆれ',  type: 'toggle' },
    { key: 'dash',  label: 'ダッシュ',    type: 'toggle' },
    { key: 'autoDash', label: '常時ダッシュ', type: 'toggle' },
    { key: 'confirm', label: 'キー: けってい',   type: 'key' },
    { key: 'cancel',  label: 'キー: キャンセル', type: 'key' },
    { key: 'dash',    label: 'キー: ダッシュ',   type: 'key' },
    { key: null,    label: 'もどる',      type: 'back' }
  ];

  function clampLevel(v) { v = Math.round(Number(v)); return isNaN(v) ? DEFAULT_LEVEL : Math.max(0, Math.min(MAX, v)); }
  // Letters are stored lower-case so Shift/CapsLock never changes a binding
  function normKey(k) { return typeof k === 'string' && k.length === 1 ? k.toLowerCase() : k; }
  function keyName(k) {
    if (k === ' ') return 'Space';
    return k && k.length === 1 ? k.toUpperCase() : (k || '');
  }
  function validKey(k) { return typeof k === 'string' && k.length >= 1 && k.length <= 12 && k !== 'Unidentified' && k !== 'Dead' && RESERVED.indexOf(normKey(k)) < 0; }
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
        values.dash = d.dash !== false;
        values.autoDash = d.autoDash === true;
        var ks = d.keys || {}, seen = {};
        ['confirm', 'cancel', 'dash'].forEach(function(a) {   // a damaged / duplicated binding falls back to its default
          var k = normKey(ks[a]);
          if (!validKey(k) || seen[k]) k = DEFAULT_KEYS[a];
          values.keys[a] = k; seen[k] = true;
        });
      }
    } catch (e) {}
    apply();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (e) {} }

  // Handle one input; returns true when the panel should close
  function update(st, input) {
    var it = ITEMS[st.index];
    if (st.capture) {                         // waiting for the new key
      var ks = Object.keys(keysPressed);
      if (!ks.length) return false;
      var k = normKey(ks[0]), act = st.capture;
      if (k === 'Escape') { st.capture = null; st.msg = null; SoundSystem.cancel(); return false; }
      var clash = ['confirm', 'cancel', 'dash'].filter(function(a) { return a !== act && values.keys[a] === k; })[0];
      if (!validKey(k)) { st.msg = keyName(k) + ' は つかえません'; SoundSystem.denied(); return false; }
      if (clash) { st.msg = keyName(k) + ' は ' + ACTION_LABEL[clash] + 'で つかっています'; SoundSystem.denied(); return false; }
      values.keys[act] = k; st.capture = null; st.msg = null; save(); SoundSystem.confirm();
      return false;
    }
    st.msg = null;
    if (input === 'up') { st.index = (st.index - 1 + ITEMS.length) % ITEMS.length; SoundSystem.cursor(); }
    else if (input === 'down') { st.index = (st.index + 1) % ITEMS.length; SoundSystem.cursor(); }
    else if (input === 'cancel' || (input === 'confirm' && it.type === 'back')) { SoundSystem.cancel(); save(); return true; }
    else if ((input === 'left' || input === 'right') && it.type === 'level') {
      var nv = clampLevel(values[it.key] + (input === 'right' ? 1 : -1));
      if (nv === values[it.key]) { SoundSystem.denied(); return false; }
      values[it.key] = nv; apply(); save();
      if (it.key === 'se') SoundSystem.confirm();          // samples so the change can be heard
      else if (it.key === 'amb') SoundSystem.birdsFar(false);
    } else if (input === 'confirm' && it.type === 'key') {
      st.capture = it.key; SoundSystem.confirm();
    } else if ((input === 'left' || input === 'right' || input === 'confirm') && it.type === 'toggle') {
      values[it.key] = !values[it.key]; save(); SoundSystem.cursor();
    }
    return false;
  }

  function render(ctx, st) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    UI.drawWindow(ctx, 90, 24, 460, 432);
    ctx.textAlign = 'left';
    UI.drawText(ctx, 'せってい', 120, 40, '#ffd700');
    for (var i = 0; i < ITEMS.length; i++) {
      var it = ITEMS[i], y = 78 + i * 31, sel = i === st.index;
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
      } else if (it.type === 'key') {
        var cap = st.capture === it.key;
        UI.drawText(ctx, cap ? '▶ キーを おしてください (Esc: やめる)' : '[ ' + keyName(values.keys[it.key]) + ' ]', 300, y + (cap ? 2 : 0), cap ? '#ffd700' : '#9bd', cap ? UI.FONT_SMALL : undefined);
      }
    }
    if (st.msg) UI.drawText(ctx, st.msg, 120, 384, '#f88', UI.FONT_SMALL);
    UI.drawText(ctx, '←→: ちょうせい   けってい: へんこう   キャンセル: もどる', 120, 408, '#889', UI.FONT_SMALL);
    UI.drawText(ctx, '常時ダッシュ ON: ダッシュキーで ふつうに あるく', 120, 430, '#667', UI.FONT_SMALL);
    ctx.restore();
  }

  return {
    load: load, update: update, render: render, apply: apply,
    get: function(key) { return values[key]; },
    key: function(action) { return values.keys[action]; },        // current key for 'confirm' / 'cancel' / 'dash'
    keyName: keyName, normKey: normKey,
    set: function(key, v) { values[key] = key === 'shake' ? !!v : clampLevel(v); apply(); },
    KEY: KEY, MAX: MAX
  };
})();
