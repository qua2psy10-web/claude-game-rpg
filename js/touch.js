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

  // Dominant axis of the touch relative to the pad centre; a dead zone in the middle gives no direction
  function dirAt(x, y) {
    var r = pad.getBoundingClientRect();
    var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    if (Math.sqrt(dx * dx + dy * dy) < r.width * 0.12) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dy < 0 ? 'ArrowUp' : 'ArrowDown');
  }
  function setDir(k) {
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
      padId = null; setDir(null);
    };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  function bindButton(el, key) {
    var id = null;
    el.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      if (id !== null) return;
      id = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add('down');
      inputPress(key); buzz();
    });
    var end = function(e) {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove('down'); inputRelease(key);
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
    bindButton(document.getElementById('btnA'), 'z');
    bindButton(document.getElementById('btnB'), 'x');
    // Tapping the game screen itself confirms (dialogue, title, battle messages)
    var cv = document.getElementById('gameCanvas');
    cv.addEventListener('pointerdown', function(e) { e.preventDefault(); inputPress('z'); setTimeout(function() { inputRelease('z'); }, 60); });
    // Stop the page from scrolling / zooming while playing
    document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }

  return { init: init, isTouchDevice: isTouchDevice };
})();
