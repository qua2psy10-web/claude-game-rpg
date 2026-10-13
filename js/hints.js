// ============================================================
// hints.js — first-time hints (small toasts) and the menu's help screen
// Seen hints live in game.hints = { id: true } and are saved with the game. A save from before
// this system has none: sanitize() then marks every hint as seen so veterans are not nagged.
// ============================================================

var HintSystem = (function() {
  var TOAST_MS = 6500;
  var queue = [], cur = null;
  var IDS = ['move', 'dash', 'rest', 'battle', 'poison', 'bestiary', 'enter_forest', 'enter_castle', 'enter_abyss'];

  function touch() { return typeof document !== 'undefined' && document.body && document.body.classList.contains('touch'); }
  function K(action) { return touch() ? (action === 'confirm' ? 'Aボタン' : action === 'cancel' ? 'Bボタン' : 'ダッシュ') : SettingsSystem.keyName(SettingsSystem.key(action)); }

  // Hint texts (two short lines each); functions so rebound keys and touch mode show up correctly
  var TEXT = {
    move:         function() { return touch() ? ['十字ボタンで いどう、Aで はなす・しらべる', 'Bで メニュー(ヘルプも ここから)'] : ['やじるしで いどう、' + K('confirm') + 'で はなす・しらべる', K('cancel') + 'で メニュー(ヘルプも ここから)']; },
    dash:         function() { return touch() ? ['十字ボタンを そとがわまで ずらすと ダッシュ'] : [K('dash') + 'を おしながら あるくと ダッシュ', '(せっていで オン・オフと キーを かえられる)']; },
    rest:         function() { return ['HPが へってきた。むらや ハルカ宿場の', '宿屋で とまると HP・MPが ぜんかいふく']; },
    battle:       function() { return ['たたかう・じゅもん・どうぐ・ぼうぎょ・にげる', 'ぼうぎょは ダメージが はんぶんに なる']; },
    poison:       function() { return ['どく: どくけしそう か キュアで なおせる', 'うごくたびに HPが へっていく']; },
    bestiary:     function() { return ['あたらしい てきを ずかんに とうろくした', 'メニューの「ずかん」で みられる']; },
    enter_forest: function() { return ['もりの てきは そうげんより つよい', 'きずついたら むりせず もどろう']; },
    enter_castle: function() { return ['まおうのしろの てきは かなり つよい', 'Lv11〜13と そうび・どうぐを ととのえよう']; },
    enter_abyss:  function() { return ['しんえんの めいきゅう。てきは さらに つよい', 'たからばこと うらボスが まっている']; }
  };

  function sanitize(raw) {
    var out = {};
    var veteran = !raw || typeof raw !== 'object';
    IDS.forEach(function(id) { if (veteran || raw[id]) out[id] = true; });
    return out;
  }

  // Queue a hint the first time its situation comes up
  // A one-off toast with its own lines (achievements): no id, no memory of having been seen
  function notice(game, lines) { queue.push({ lines: lines }); }

  function show(game, id) {
    if (!game || !TEXT[id]) return;
    if (!game.hints) game.hints = {};
    if (game.hints[id]) return;
    game.hints[id] = true;
    queue.push(id);
  }

  function reset() { queue = []; cur = null; }

  // Toast in the top-left under the area name; a new one starts only while the map / a battle is showing
  function renderToast(ctx, game) {
    var st = game.state, now = Date.now();
    var okState = st === 'map' || st === 'battle' || st === 'dialogue';
    if (!cur) {
      if (!okState || !queue.length) return;
      var nx = queue.shift();
      cur = { id: nx.lines ? null : nx, lines: nx.lines || null, t: 0, last: now };
    }
    var dt = Math.min(100, now - cur.last);   // time only runs while the toast is visible (menus, shops ... pause it)
    cur.last = now;
    if (!okState) return;
    cur.t += dt;
    var t = cur.t;
    if (t > TOAST_MS) { cur = null; return; }
    var lines = cur.lines || TEXT[cur.id]();
    var a = Math.min(1, t / 250, (TOAST_MS - t) / 400);
    var w = 400, h = 22 + lines.length * 20;
    ctx.save();
    ctx.globalAlpha = a;
    UI.drawWindow(ctx, 4, 38, w, h);
    UI.drawText(ctx, '💡', 14, 44, '#ffd700', UI.FONT_SMALL);
    for (var i = 0; i < lines.length; i++) UI.drawText(ctx, lines[i], 38, 44 + i * 20, '#fff', UI.FONT_SMALL);
    ctx.restore();
  }

  // ---- help screen (menu) ----
  function pages() {
    var tm = touch();
    return [
      { title: 'そうさ', lines: tm ? [
        '・十字ボタン: いどう(そとがわまで ずらすと ダッシュ)',
        '・Aボタン: けってい・はなす・しらべる',
        '・Bボタン: キャンセル・メニューを ひらく',
        '・ゲーム画面を タップしても けってい',
        '',
        'メニュー: どうぐ・そうび・つよさ・ずかん・きろく・',
        '　　　　　いらい・ヘルプ・セーブ・せってい',
      ] : [
        '・やじるし / WASD: いどう',
        '・' + K('confirm') + ' / Enter: けってい・はなす・しらべる',
        '・' + K('cancel') + ' / Esc: キャンセル・メニューを ひらく',
        '・' + K('dash') + ' を おしながら: ダッシュ',
        '',
        'キーは「せってい」で かえられます',
        'メニュー: どうぐ・そうび・つよさ・ずかん・きろく・',
        '　　　　　いらい・ヘルプ・セーブ・せってい',
      ] },
      { title: 'たたかい', lines: [
        '・たたかう / じゅもん(MPを つかう) / どうぐ / ぼうぎょ / にげる',
        '・ぼうぎょ: うけるダメージが はんぶん',
        '・ボスの「よちょう」が でたら ぼうぎょで そなえよう',
        '',
        'サム: パワースラッシュ・なぎはらい(てき全体)・',
        '　　　シールドバッシュ(きぜつ)・ウォークライ',
        'ダリオ: ファイア・スリープ(てき全体を ねむらせる)・',
        '　　　　アイスストーム・マジックブースト・サンダー',
        'スンダー: ヒール・ライト・キュア(どく)・プロテクト・',
        '　　　　　ブレイク(てきの ぼうぎょダウン)・ホーリーライト',
      ] },
      { title: 'ヒント', lines: [
        '・宿屋(ミルヘイブン村・ハルカ宿場)で HP・MPが ぜんかいふく',
        '・たからばこは うえに のると ひらく',
        '　もり・まおうのしろ・大陸の きたなどに ある',
        '・ずかんは たおすほど くわしく なる',
        '・村の人の はなしは たびの すすみぐあいで かわる',
        '・村の人の たのみごとは「いらい」で かくにん',
        '・ミルヘイブン村の 鍛冶屋で ぶきと ぼうぐを きょうか',
        '・オートセーブ: メニューを とじたとき・たたかいの あと',
        '　メニューの「セーブ」で しゅどうでも セーブできる',
        '・まおうを たおした あとも「つづきから」あそべる',
      ] }
    ];
  }

  function helpUpdate(st, input) {
    var n = pages().length;
    if (input === 'left') { st.page = (st.page + n - 1) % n; SoundSystem.cursor(); }
    else if (input === 'right' || input === 'confirm') { st.page = (st.page + 1) % n; SoundSystem.cursor(); }
    else if (input === 'cancel') { SoundSystem.cancel(); return true; }
    return false;
  }

  function helpRender(ctx, st) {
    var ps = pages(), p = ps[st.page || 0];
    ctx.save();
    ctx.textAlign = 'left';
    UI.drawWindow(ctx, 20, 20, 600, 440);
    UI.drawText(ctx, 'ヘルプ  ' + p.title + '  (' + ((st.page || 0) + 1) + '/' + ps.length + ')', 40, 36, '#ffd700');
    for (var i = 0; i < p.lines.length; i++) UI.drawText(ctx, p.lines[i], 44, 82 + i * 28, '#fff', UI.FONT_SMALL);
    UI.drawText(ctx, '← →: ページ    ' + K('cancel') + ': もどる', 40, 428, '#9bd', UI.FONT_SMALL);
    ctx.restore();
  }

  return { sanitize: sanitize, show: show, notice: notice, reset: reset, renderToast: renderToast, helpUpdate: helpUpdate, helpRender: helpRender, IDS: IDS };
})();
