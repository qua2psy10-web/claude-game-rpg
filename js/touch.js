// ============================================================
// touch.js — on-screen controls for phones/tablets
// Feeds the same keysDown/keysPressed tables as the keyboard (via inputPress/inputRelease in main.js),
// so every screen works unchanged.  D-pad = arrows, A = Z (confirm), B = X (cancel / menu).
// ============================================================

var TouchControls = (function() {
  var pad = null, padKey = null, padId = null;

  function isTouchDevice() {
    try {
      if (/[?&]touch=1\b/.test(location.search)) return true;
      if (/[?&]touch=0\b/.test(location.search)) return false;
      return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    } catch (e) { return false; }
  }
  function buzz() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }

  // Dominant axis of the touch relative to the pad centre; a dead zone in the middle gives no direction,
  // and sliding out to the pad's outer ring means dash
  var padDash = null;
  function dirAt(x, y) {
    var r = pad.getBoundingClientRect();
    var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r.width * 0.12) return { key: null, far: false };
    return { key: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dy < 0 ? 'ArrowUp' : 'ArrowDown'), far: dist > r.width * 0.42 };
  }
  function setDir(d) {
    var k = d.key, far = !!(k && d.far);
    if (far && !padDash) { padDash = SettingsSystem.key('dash'); inputPress(padDash); }
    else if (!far && padDash) { inputRelease(padDash); padDash = null; }
    if (k === padKey) return;
    if (padKey) inputRelease(padKey);
    padKey = k;
    if (k) { inputPress(k); buzz(); }
    pad.setAttribute('data-dir', k || '');
  }

  function bindPad() {
    pad.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      if (padId !== null) return;
      padId = e.pointerId;
      try { pad.setPointerCapture(e.pointerId); } catch (err) {}
      setDir(dirAt(e.clientX, e.clientY));
    });
    pad.addEventListener('pointermove', function(e) {
      if (e.pointerId === padId) setDir(dirAt(e.clientX, e.clientY));
    });
    var end = function(e) {
      if (e.pointerId !== padId) return;
      padId = null; setDir({ key: null, far: false });
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  function bindButton(el, action) {     // action = 'confirm' / 'cancel' (the key is looked up per press, so rebinding applies at once)
    var id = null, key = null;
    el.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('down');
      key = SettingsSystem.key(action); inputPress(key); buzz();
    });
    var end = function(e) {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('down'); if (key) inputRelease(key);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function init() {
    var root = document.getElementById('touchControls');
    if (!root || !isTouchDevice()) return;
    document.body.classList.add('touch');
    pad = document.getElementById('dpad');
    bindPad();
    bindButton(document.getElementById('btnA'), 'confirm');
    bindButton(document.getElementById('btnB'), 'cancel');
    // Tapping the game screen itself confirms (dialogue, title, battle messages)
    var cv = document.getElementById('gameCanvas');
    cv.addEventListener('pointerdown', function(e) { e.preventDefault(); var ck = SettingsSystem.key('confirm'); inputPress(ck); setTimeout(function() { inputRelease(ck); }, 60); });
    // Stop the page from scrolling / zooming while playing
    document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }

  return { init: init, isTouchDevice: isTouchDevice };
})();
