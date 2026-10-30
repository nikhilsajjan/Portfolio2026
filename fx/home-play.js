/* Home (index.html): the grid's play layer. Loaded after app.js.
   From the lab (fx/x2.js): snake (it wraps round the edges) and the dot
   sequencer behind the ▶ chip (arrow keys move through its menu), the pet
   (the theme toggle: only its eyes follow the pointer), the ASCII cursor
   trail and the cell-by-cell loader (set up in fx/home.js). Eleven more games
   in the ▶ menu (two columns): falling blocks, brick breaker, paddle tennis,
   eat the grid, invaders, road crossing, jumper, memory, lights out, mine
   field, pairs. Each says in one line how to play. */
(function () {
  var root = document.documentElement;
  var grid = document.getElementById('dots');
  if (!grid) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function rnd(n) { return Math.floor(Math.random() * n); }
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  // the dot grid's post-it palette (Figma 112:44), as in app.js
  var POSTITS = [[255, 255, 153], [255, 235, 161], [254, 230, 59], [255, 173, 100], [210, 222, 64],
                 [55, 210, 216], [248, 58, 167], [255, 249, 165], [249, 184, 188], [176, 205, 235]];
  function postit(i) {
    var c = POSTITS[((i % 10) + 10) % 10];
    return root.getAttribute('data-theme') === 'dark' ? 'rgba(' + c + ',0.6)' : 'rgb(' + c + ')';
  }

  /* ---------- Grid helpers (the grid is rebuilt on resize: read it fresh) ---------- */
  function L() {
    var all = Array.prototype.slice.call(grid.children).filter(function (n) { return n.classList.contains('dot') || n.tagName === 'BUTTON'; });
    var c = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    return { c: c, r: Math.ceil(all.length / c), all: all };
  }
  function at(l, r, c) {
    if (r < 0 || c < 0 || r >= l.r || c >= l.c) return null;
    var n = l.all[r * l.c + c];
    return n && n.classList.contains('dot') ? n : null;
  }
  function rc(l, node) { var i = l.all.indexOf(node); return i < 0 ? null : [Math.floor(i / l.c), i % l.c]; }
  function clearAll() {
    $$('.dot', grid).forEach(function (d) {
      clearTimeout(d.fadeTimer);
      d.classList.remove('is-fading');
      d.style.transition = '';
      d.style.backgroundColor = '';
      d.style.opacity = '';
      d.textContent = '';
      d.classList.remove('hm-cur');
      delete d.dataset.shape;
      d.style.removeProperty('--rot');
    });
  }

  /* ---------- Sound (on by default; the sequencer always plays) ---------- */
  var ac = null;
  // on unless the visitor switched it off
  function soundOn() { return store('hm-sound') !== 'off'; }
  function tone(freq, ms, type, gain, force) {
    if (!force && !soundOn()) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + ms / 1000 + 0.03);
    } catch (e) {}
  }
  // iPhones only let a page make sound that starts inside a tap, and keep the
  // ringer switch for web audio unless the page asks for playback. So the tap
  // that starts a game opens the sound (a silent blip) and asks for playback.
  function unlock() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      var b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource();
      src.buffer = b;
      src.connect(ac.destination);
      src.start(0);
    } catch (e) {}
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  }
  function relock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) {}
  }
  var SCALE = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136, 3520];

  /* ---------- Games: state, status line, keyboard ---------- */
  var busy = false, game = null, status = null;
  var chip = grid.querySelector('.hm-play');
  // while a game runs the chip is a pause sign, and pressing it leaves the game
  var PLAY = chip && chip.innerHTML, PLAY_LABEL = chip && chip.getAttribute('aria-label');
  var PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.4 3h2.8v8H3.4zM7.8 3h2.8v8H7.8z" fill="currentColor"/></svg>';
  function chipFor(on) {
    if (!chip) return;
    chip.classList.toggle('is-on', on);
    chip.innerHTML = on ? PAUSE : PLAY;
    chip.setAttribute('aria-label', on ? 'Leave the game' : PLAY_LABEL);
  }
  function say(parts) {
    if (!status) { status = el('div', 'hm-status'); status.setAttribute('role', 'status'); }
    if (!grid.contains(status)) grid.appendChild(status);
    status.textContent = '';
    parts.forEach(function (p) {
      if (typeof p === 'string') status.appendChild(el('span', '', p));
      else if (p.b) status.appendChild(el('b', '', p.b));
      else if (p.btn) { var b = el('button', '', p.btn); b.type = 'button'; b.addEventListener('click', p.fn); status.appendChild(b); }
    });
    if (game) {
      if (game.how) status.appendChild(el('div', 'hm-how', game.how));
      var snd = el('button', '', soundOn() ? 'sound on' : 'sound off');
      snd.type = 'button';
      snd.setAttribute('aria-pressed', soundOn() ? 'true' : 'false');
      snd.addEventListener('click', function (e) {
        e.stopPropagation();
        store('hm-sound', soundOn() ? 'off' : 'on');
        snd.textContent = soundOn() ? 'sound on' : 'sound off';
        snd.setAttribute('aria-pressed', soundOn() ? 'true' : 'false');
        tone(880, 60, 'sine', 0.04);
      });
      status.appendChild(snd);
    }
    status.hidden = false;
    // the name below makes room for the whole line, however many rows it wraps to
    grid.parentNode.style.setProperty('--hm-status-h', status.offsetHeight + 'px');
  }
  function startGame(g) {
    stopGame(true);
    unlock();
    busy = true;
    game = g;
    grid.classList.add('hm-game');
    clearAll();
    chipFor(true);
    // the game lives in the grid: bring the whole grid into view
    if (scrollY > 0) scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    g.start();
  }
  function stopGame(quiet) {
    if (!game) return;
    if (game.stop) game.stop();
    game = null;
    busy = false;
    grid.classList.remove('hm-game');
    clearAll();
    if (!quiet && status) status.hidden = true;
    if (!quiet) relock();
    chipFor(false);
  }
  // while a game runs it owns the grid: app.js never sees these events
  ['pointerover', 'pointerdown', 'pointerup', 'pointercancel', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'click', 'dblclick'].forEach(function (type) {
    grid.addEventListener(type, function (e) {
      if (!busy || (e.target.closest && e.target.closest('button, .hm-status, .hm-menu'))) return;
      e.stopImmediatePropagation();
      if (game && game.input) game.input(e);
    }, true);
  });
  // paddles follow the pointer anywhere on the page
  addEventListener('pointermove', function (e) { if (game && game.move) game.move(e); }, { passive: true });
  // the grid is rebuilt when the window changes size: the game can't carry on
  new MutationObserver(function (ms) {
    if (game && ms.some(function (m) { return Array.prototype.some.call(m.removedNodes, function (n) { return n.classList && n.classList.contains('dot'); }); })) stopGame();
  }).observe(grid, { childList: true });
  addEventListener('keydown', function (e) {
    if (!game) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stopGame(); return; }
    if (game.key && game.key(e) !== false) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  function snakeGame() {
    var l, body, dir, next, food, timer, score, speed, best = +(store('hm-snake') || 0), sx = 0, sy = 0;
    function place() {
      var freeCells = [];
      for (var r = 0; r < l.r; r++) for (var c = 0; c < l.c; c++) {
        if (at(l, r, c) && !body.some(function (b) { return b[0] === r && b[1] === c; })) freeCells.push([r, c]);
      }
      food = freeCells[rnd(freeCells.length)];
      food[2] = rnd(10);
    }
    function draw() {
      $$('.dot', grid).forEach(function (d) { d.style.transition = 'none'; d.style.backgroundColor = ''; });
      var ink = cssVar('--name');
      body.forEach(function (b) { var d = at(l, b[0], b[1]); if (d) d.style.backgroundColor = ink; });
      var f = at(l, food[0], food[1]);
      if (f) f.style.backgroundColor = postit(food[2]);
    }
    // the next dot ahead: off one edge comes back in at the other, and the
    // controls at the end of the last row are stepped over
    function ahead(h, d) {
      var r = h[0], c = h[1];
      for (var n = 0; n < l.r + l.c; n++) {
        r = (r + d[0] + l.r) % l.r;
        c = (c + d[1] + l.c) % l.c;
        if (at(l, r, c)) return [r, c];
      }
      return null;
    }
    function tick() {
      dir = next;
      var nh = ahead(body[0], dir);
      var hit = !nh || body.some(function (b) { return b[0] === nh[0] && b[1] === nh[1]; });
      if (hit) {
        clearInterval(timer);
        if (score > best) { best = score; store('hm-snake', best); }
        tone(150, 300, 'sawtooth', 0.04);
        say(['snake', { b: 'game over · ' + score }, 'best ' + best, { btn: 'again', fn: function () { startGame(snakeGame()); } }, { btn: 'close', fn: function () { stopGame(); } }]);
        return;
      }
      body.unshift(nh);
      if (nh[0] === food[0] && nh[1] === food[1]) {
        score++;
        tone(SCALE[6 + (score % 8)], 80, 'square', 0.03);
        place();
        clearInterval(timer);
        speed = Math.max(70, speed - 4);
        timer = setInterval(tick, speed);
        say(['snake', { b: String(score) }, 'best ' + best, 'arrows / swipe · esc']);
      } else body.pop();
      draw();
    }
    return {
      label: 'snake',
      how: "Eat the post-its to grow. Don't run into yourself.",
      start: function () {
        l = L();
        var r = Math.floor(l.r / 2), c = Math.floor(l.c / 3);
        body = [[r, c + 2], [r, c + 1], [r, c]];
        dir = next = [0, 1];
        score = 0;
        speed = 150;
        place();
        draw();
        timer = setInterval(tick, speed);
        say(['snake', { b: '0' }, 'best ' + best, 'arrows / swipe · esc']);
      },
      stop: function () { clearInterval(timer); },
      key: function (e) {
        var m = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] }[e.key.toLowerCase()];
        if (!m) return false;
        if (m[0] !== -dir[0] || m[1] !== -dir[1]) next = m;
      },
      input: function (e) {
        var t = (e.changedTouches || e.touches || [])[0];
        if (e.type === 'touchstart' && t) { sx = t.clientX; sy = t.clientY; }
        if (e.type === 'touchend' && t) {
          var dx = t.clientX - sx, dy = t.clientY - sy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
          var m = Math.abs(dx) > Math.abs(dy) ? [0, dx > 0 ? 1 : -1] : [dy > 0 ? 1 : -1, 0];
          if (m[0] !== -dir[0] || m[1] !== -dir[1]) next = m;
        }
      }
    };
  }

  function sequencerGame() {
    var l, notes = {}, col = 0, timer;
    // bottom row lowest; the 19 rows of the full grid fit the scale
    function pitch(r) { return SCALE[Math.max(0, Math.min(SCALE.length - 1, l.r - 1 - r))]; }
    function draw() {
      var ink = cssVar('--hm-ink');
      l.all.forEach(function (d, i) {
        if (!d.classList.contains('dot')) return;
        var r = Math.floor(i / l.c), c = i % l.c, k = r + ',' + c;
        d.style.transition = 'none';
        if (notes[k]) d.style.backgroundColor = c === col ? cssVar('--name') : postit(r);
        else d.style.backgroundColor = c === col ? ink : '';
      });
    }
    return {
      label: 'music',
      how: 'Each dot is a note. The line plays left to right; higher rows play higher notes.',
      start: function () {
        l = L();
        notes = {};
        // a starting phrase: a rising and falling line
        var shape = [6, 5, 4, 3, 4, 5, 6, 7];
        for (var c = 0; c < l.c; c += 2) {
          var r = shape[(c / 2) % shape.length] % l.r;
          if (at(l, r, c)) notes[r + ',' + c] = 1;
        }
        col = 0;
        timer = setInterval(function () {
          col = (col + 1) % l.c;
          var n = 0;
          for (var r = 0; r < l.r && n < 4; r++) if (notes[r + ',' + col]) { tone(pitch(r), 160, 'triangle', 0.045, true); n++; }
          draw();
        }, 150);
        draw();
        say(['music', { b: 'click dots to add notes' }, { btn: 'clear', fn: function () { notes = {}; draw(); } }, { btn: 'stop', fn: function () { stopGame(); } }]);
      },
      stop: function () { clearInterval(timer); },
      input: function (e) {
        if (e.type !== 'pointerdown') return;
        var d = e.target.closest && e.target.closest('.dot');
        var p = d && rc(l, d);
        if (!p) return;
        var k = p[0] + ',' + p[1];
        if (notes[k]) delete notes[k]; else { notes[k] = 1; tone(pitch(p[0]), 120, 'triangle', 0.04, true); }
        draw();
      }
    };
  }

  /* ---------- More games (2026-10-28 v1): each one plays on the dots ----------
     paint() colours every dot from one function: a colour, or
     { c: colour, o: opacity, t: text, cur: keyboard cursor }. Most games keep
     off the last row when the controls sit in it (field()). */
  function field(l) {
    for (var c = 0; c < l.c; c++) if (!at(l, l.r - 1, c)) return l.r - 1;
    return l.r;
  }
  function paint(l, fn) {
    for (var r = 0; r < l.r; r++) for (var c = 0; c < l.c; c++) {
      var d = at(l, r, c);
      if (!d) continue;
      var v = fn(r, c), o = v && typeof v === 'object' ? v : { c: v };
      d.style.transition = 'none';
      d.style.backgroundColor = o.c || '';
      d.style.opacity = o.o == null ? '' : o.o;
      var t = o.t == null ? '' : String(o.t);
      if (d.textContent !== t) d.textContent = t;
      d.classList.toggle('hm-cur', !!o.cur);
      if (o.s) d.dataset.shape = o.s; else if (d.dataset.shape) delete d.dataset.shape;
      d.style.setProperty('--rot', o.rot || '0deg');
    }
  }
  var KEYS = { arrowup: [-1, 0], w: [-1, 0], arrowdown: [1, 0], s: [1, 0], arrowleft: [0, -1], a: [0, -1], arrowright: [0, 1], d: [0, 1] };
  function dirOf(e) { return KEYS[e.key.toLowerCase()]; }
  function isAct(e) { return e.key === ' ' || e.key === 'Enter'; }
  // touch: a swipe gives its direction (and distance), a tap gives null
  function swiper(cb) {
    var sx = 0, sy = 0;
    return function (e) {
      var t = (e.changedTouches || e.touches || [])[0];
      if (!t) return;
      if (e.type === 'touchstart') { sx = t.clientX; sy = t.clientY; }
      if (e.type === 'touchend') {
        var dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) cb(null, t, 0);
        else if (Math.abs(dx) > Math.abs(dy)) cb([0, dx > 0 ? 1 : -1], t, Math.abs(dx));
        else cb([dy > 0 ? 1 : -1, 0], t, Math.abs(dy));
      }
    };
  }
  function cellOf(l, e) {
    var t = (e.changedTouches || e.touches || [])[0] || e;
    var n = document.elementFromPoint(t.clientX, t.clientY);
    var d = n && n.closest && n.closest('.dot');
    return d && grid.contains(d) ? rc(l, d) : null;
  }
  // the column / row under a point, also off the grid's edges
  function pitch(l) {
    var a = at(l, 0, 0), b = at(l, 0, 1);
    var ra = a.getBoundingClientRect();
    return { x: ra.left, y: ra.top, w: ra.width, p: b ? b.getBoundingClientRect().left - ra.left : ra.width };
  }
  function colAt(l, x) { var g = pitch(l); return Math.max(0, Math.min(l.c - 1, Math.floor((x - g.x + (g.p - g.w) / 2) / g.p))); }
  function rowAt(l, y) { var g = pitch(l); return Math.max(0, Math.min(l.r - 1, Math.floor((y - g.y + (g.p - g.w) / 2) / g.p))); }
  function point(e) { return (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e; }
  var touch = matchMedia('(hover: none)').matches;
  function hint(keys, taps) { return touch ? taps : keys; }
  function over(label, text, key, score, make, lower) {
    var best = +(store(key) || 0);
    if (score && (!best || (lower ? score < best : score > best))) { best = score; store(key, best); }
    say([label, { b: text }, best ? 'best ' + best : '', { btn: 'again', fn: function () { startGame(make()); } }, { btn: 'close', fn: function () { stopGame(); } }]);
  }
  function clampN(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* Falling blocks: a 10-wide well; full rows clear. Once a piece lands,
     any block with a gap under it drops on down, a row at a time, until it
     rests (which can fill and clear more rows) */
  function blocksGame() {
    var SHAPES = [[[1, 1, 1, 1]], [[1, 1], [1, 1]], [[0, 1, 0], [1, 1, 1]], [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]]];
    var TINT = [5, 2, 6, 9, 3, 4, 8];
    var l, H, W, c0, board, p, timer, settling, lines, speed, dead;
    function rot(m) { return m[0].map(function (_, i) { return m.map(function (row) { return row[i]; }).reverse(); }); }
    function fits(m, r, c) {
      for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].length; j++) {
        if (!m[i][j]) continue;
        var rr = r + i, cc = c + j;
        if (cc < 0 || cc >= W || rr >= H) return false;
        if (rr >= 0 && board[rr][cc] >= 0) return false;
      }
      return true;
    }
    function spawn() {
      var k = rnd(7), m = SHAPES[k];
      p = { m: m, k: k, r: 0, c: Math.floor((W - m[0].length) / 2) };
      if (!fits(p.m, p.r, p.c)) {
        dead = true;
        clearInterval(timer);
        tone(150, 300, 'sawtooth', 0.04);
        over('falling blocks', 'game over · ' + lines + ' rows', 'hm-blocks', lines, blocksGame);
      }
    }
    function lock() {
      p.m.forEach(function (row, i) { row.forEach(function (v, j) { if (v && p.r + i >= 0) board[p.r + i][p.c + j] = TINT[p.k]; }); });
      // no piece while the blocks settle: the timer and the keys wait
      p = null;
      tone(196, 40, 'triangle', 0.03);
      settle();
    }
    // one step: every block with a gap under it drops a row (from the bottom
    // up, so each moves once a step); then full rows clear; then the next piece
    function settle() {
      if (dead) return;
      var moved = false;
      for (var r = H - 2; r >= 0; r--) for (var c = 0; c < W; c++) {
        if (board[r][c] >= 0 && board[r + 1][c] < 0) { board[r + 1][c] = board[r][c]; board[r][c] = -1; moved = true; }
      }
      if (moved) { draw(); settling = setTimeout(settle, 45); return; }
      var cleared = 0;
      for (r = H - 1; r >= 0; r--) {
        if (board[r].every(function (v) { return v >= 0; })) {
          board.splice(r, 1);
          board.unshift(new Array(W).fill(-1));
          cleared++;
          r++;
        }
      }
      if (cleared) {
        lines += cleared;
        tone(SCALE[8 + Math.min(cleared, 4)], 140, 'square', 0.035);
        speed = Math.max(110, 560 - Math.floor(lines / 4) * 45);
        clearInterval(timer);
        timer = setInterval(fall, speed);
        status();
        draw();
        settling = setTimeout(settle, 120);
        return;
      }
      settling = 0;
      spawn();
      status();
      draw();
    }
    function fall() { if (dead || !p) return; if (fits(p.m, p.r + 1, p.c)) p.r++; else lock(); draw(); }
    function move(dc) { if (p && fits(p.m, p.r, p.c + dc)) { p.c += dc; draw(); } }
    function turn() {
      if (!p) return;
      var m = rot(p.m);
      [0, -1, 1, -2, 2].some(function (k) { if (fits(m, p.r, p.c + k)) { p.m = m; p.c += k; return true; } return false; });
      draw();
    }
    function slam() { if (!p) return; while (fits(p.m, p.r + 1, p.c)) p.r++; lock(); draw(); }
    function draw() {
      if (dead) return;
      var ink = cssVar('--name');
      paint(l, function (r, c) {
        var x = c - c0;
        if (x < 0 || x >= W || r >= H) return { o: 0.25 };
        var i = p ? r - p.r : -1, j = p ? x - p.c : -1;
        if (i >= 0 && j >= 0 && i < p.m.length && j < p.m[0].length && p.m[i][j]) return ink;
        return board[r][x] >= 0 ? postit(board[r][x]) : '';
      });
    }
    function status() { say(['falling blocks', { b: lines + ' rows' }, hint('←→ move · ↑ turn · ↓ faster · space drop', 'swipe to move · tap turns · swipe down drops')]); }
    var sw = swiper(function (d, t, dist) {
      if (!d) turn();
      else if (d[0] > 0) slam();
      else if (d[1]) for (var n = Math.max(1, Math.round(dist / 36)); n > 0; n--) move(d[1]);
    });
    return {
      label: 'falling blocks',
      how: "Fill a row edge to edge to clear it. Don't let the stack reach the top.",
      start: function () {
        l = L(); H = field(l); W = Math.min(10, l.c); c0 = Math.floor((l.c - W) / 2);
        board = []; for (var r = 0; r < H; r++) board.push(new Array(W).fill(-1));
        lines = 0; speed = 560; dead = false;
        spawn(); draw(); status();
        timer = setInterval(fall, speed);
      },
      stop: function () { clearInterval(timer); clearTimeout(settling); dead = true; },
      key: function (e) {
        if (dead) return false;
        var k = e.key.toLowerCase();
        if (k === 'arrowleft' || k === 'a') move(-1);
        else if (k === 'arrowright' || k === 'd') move(1);
        else if (k === 'arrowup' || k === 'w' || k === 'x') turn();
        else if (k === 'arrowdown' || k === 's') fall();
        else if (k === ' ') slam();
        else return false;
      },
      input: function (e) {
        if (dead) return;
        if (e.type.indexOf('touch') === 0) sw(e);
        else if (e.type === 'pointerdown' && e.pointerType === 'mouse') turn();
      }
    };
  }

  /* Brick breaker: post-it bricks up top, a paddle on the bottom row */
  function bricksGame() {
    var l, H, bricks, b, pad, PW, lives, score, level, timer, dead;
    function fill() {
      bricks = {};
      var rows = Math.max(2, Math.min(5, Math.floor(H / 3)));
      for (var r = 1; r <= rows; r++) for (var c = 0; c < l.c; c++) bricks[r + ',' + c] = r;
    }
    function serve() { b = { r: H - 2, c: pad + Math.floor(PW / 2), dr: -1, dc: Math.random() < 0.5 ? -1 : 1 }; }
    function hit(r, c) {
      var k = r + ',' + c;
      if (!bricks[k]) return false;
      delete bricks[k];
      score++;
      tone(SCALE[4 + (r % 8)], 60, 'square', 0.03);
      return true;
    }
    function step() {
      if (b.c + b.dc < 0 || b.c + b.dc >= l.c) b.dc = -b.dc;
      if (b.r + b.dr < 0) b.dr = 1;
      var nr = b.r + b.dr, nc = b.c + b.dc;
      if (hit(nr, b.c)) b.dr = -b.dr;
      else if (hit(b.r, nc)) b.dc = -b.dc;
      else if (hit(nr, nc)) { b.dr = -b.dr; b.dc = -b.dc; }
      else if (nr === H - 1 && nc >= pad - 1 && nc <= pad + PW) {
        b.dr = -1;
        b.dc = nc < pad + PW / 2 ? -1 : 1;
        tone(330, 40, 'triangle', 0.035);
      } else if (nr >= H) {
        lives--;
        tone(150, 260, 'sawtooth', 0.04);
        if (!lives) { dead = true; clearInterval(timer); over('brick breaker', 'game over · ' + score, 'hm-bricks', score, bricksGame); return; }
        serve(); status();
      } else { b.r = nr; b.c = nc; }
      if (!Object.keys(bricks).length) {
        level++; fill(); serve();
        clearInterval(timer); timer = setInterval(step, Math.max(45, 85 - level * 8));
      }
      draw();
    }
    function draw() {
      if (dead) return;
      var ink = cssVar('--name');
      paint(l, function (r, c) {
        if (r === b.r && c === b.c) return ink;
        if (r === H - 1 && c >= pad && c < pad + PW) return ink;
        var k = bricks[r + ',' + c];
        return k ? postit(k + 1) : (r >= H ? { o: 0.25 } : '');
      });
    }
    function status() { say(['brick breaker', { b: String(score) }, '♥ ' + lives, hint('mouse or ←→', 'drag to move')]); }
    function to(col) { pad = clampN(col - Math.floor(PW / 2), 0, l.c - PW); if (!dead) draw(); }
    return {
      label: 'brick breaker',
      how: 'Bounce the dot off your paddle and knock out every post-it brick.',
      start: function () {
        l = L(); H = field(l); PW = Math.max(3, Math.round(l.c / 7));
        pad = Math.floor((l.c - PW) / 2); lives = 3; score = 0; level = 0; dead = false;
        fill(); serve(); draw(); status();
        timer = setInterval(step, 85);
      },
      stop: function () { clearInterval(timer); dead = true; },
      key: function (e) {
        var d = dirOf(e);
        if (!d || !d[1]) return false;
        to(pad + Math.floor(PW / 2) + d[1] * 2);
      },
      move: function (e) { to(colAt(l, e.clientX)); },
      input: function (e) { if (e.type === 'touchmove' || e.type === 'touchstart') to(colAt(l, point(e).clientX)); }
    };
  }

  /* Paddle tennis: you on the left, the computer on the right; first to 5 */
  function tennisGame() {
    var l, H, P, py, cy, b, me, cpu, timer, speed, dead, wait;
    function serve(toward) {
      b = { r: Math.floor(H / 2), c: Math.floor(l.c / 2), dr: Math.random() < 0.5 ? -1 : 1, dc: toward };
      speed = 80;
      wait = 8;
    }
    function bounce(top) {
      var rel = b.r - top;
      b.dr = rel < P / 3 ? -1 : rel >= P * 2 / 3 ? 1 : (b.dr || 1) * (Math.random() < 0.5 ? 0 : 1);
      tone(b.dc > 0 ? 440 : 523, 40, 'square', 0.03);
      speed = Math.max(40, speed - 3);
      clearInterval(timer); timer = setInterval(step, speed);
    }
    function scored(win) {
      if (win) me++; else cpu++;
      tone(win ? 784 : 196, 160, 'triangle', 0.04);
      if (me === 5 || cpu === 5) {
        dead = true; clearInterval(timer);
        over('paddle tennis', (me === 5 ? 'you win ' : 'you lose ') + me + '–' + cpu, 'hm-tennis', me === 5 ? me - cpu : 0, tennisGame);
        return;
      }
      serve(win ? 1 : -1); status();
    }
    function step() {
      // the computer follows the ball when it's coming, and drifts home when not
      var aim = b.dc > 0 ? b.r - Math.floor(P / 2) : Math.floor((H - P) / 2);
      if (Math.random() < 0.72 && cy !== aim) cy = clampN(cy + (aim > cy ? 1 : -1), 0, H - P);
      if (wait > 0) { wait--; draw(); return; }
      if (b.r + b.dr < 0 || b.r + b.dr >= H) b.dr = -b.dr;
      var nc = b.c + b.dc, nr = b.r + b.dr;
      if (nc === 0 && b.r >= py && b.r < py + P) { b.dc = 1; bounce(py); }
      else if (nc === l.c - 1 && b.r >= cy && b.r < cy + P) { b.dc = -1; bounce(cy); }
      else if (nc < 0) { scored(false); if (dead) return; }
      else if (nc >= l.c) { scored(true); if (dead) return; }
      else { b.c = nc; b.r = nr; }
      draw();
    }
    function draw() {
      if (dead) return;
      var ink = cssVar('--name'), mid = Math.floor(l.c / 2);
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        if (r === b.r && c === b.c) return ink;
        if (c === 0 && r >= py && r < py + P) return ink;
        if (c === l.c - 1 && r >= cy && r < cy + P) return postit(6);
        if (c === mid && r % 2 === 0) return cssVar('--hm-ink');
        return '';
      });
    }
    function status() { say(['paddle tennis', { b: 'you ' + me + ' · ' + cpu + ' computer' }, hint('mouse or ↑↓', 'drag to move')]); }
    function to(row) { py = clampN(row - Math.floor(P / 2), 0, H - P); if (!dead) draw(); }
    return {
      label: 'paddle tennis',
      how: "You're the black paddle on the left. Get the dot past the computer. First to 5.",
      start: function () {
        l = L(); H = field(l); P = Math.max(3, Math.round(H / 4));
        py = cy = Math.floor((H - P) / 2); me = cpu = 0; dead = false;
        serve(Math.random() < 0.5 ? -1 : 1); draw(); status();
        timer = setInterval(step, speed);
      },
      stop: function () { clearInterval(timer); dead = true; },
      key: function (e) {
        var d = dirOf(e);
        if (!d || !d[0]) return false;
        to(py + Math.floor(P / 2) + d[0]);
      },
      move: function (e) { to(rowAt(l, e.clientY)); },
      input: function (e) { if (e.type === 'touchmove' || e.type === 'touchstart') to(rowAt(l, point(e).clientY)); }
    };
  }

  /* Eat the grid: every dot is a pellet; two chasers hunt you between the pillars */
  function eatGame() {
    var l, H, eaten, me, dir, next, foes, lives, score, level, timer, tick, dead, face = 0;
    function wall(r, c) { return r % 2 === 1 && c % 2 === 1; }
    function open(r, c) { return r >= 0 && c >= 0 && r < H && c < l.c && !wall(r, c); }
    function reset() {
      me = [H - 1 - ((H - 1) % 2), 0];
      dir = next = [0, 0];
      foes = [{ p: [0, l.c - 1 - ((l.c - 1) % 2)], d: [0, -1], k: 6 }, { p: [0, Math.floor(l.c / 4) * 2], d: [0, 1], k: 5 }];
    }
    function pellets() { var n = 0; for (var r = 0; r < H; r++) for (var c = 0; c < l.c; c++) if (open(r, c) && !eaten[r + ',' + c]) n++; return n; }
    function caught() {
      if (!foes.some(function (f) { return f.p[0] === me[0] && f.p[1] === me[1]; })) return false;
      lives--;
      tone(150, 300, 'sawtooth', 0.04);
      if (!lives) { dead = true; clearInterval(timer); over('eat the grid', 'game over · ' + score, 'hm-eat', score, eatGame); return true; }
      reset(); status();
      return true;
    }
    function chase(f, i) {
      var target = i ? [me[0] + dir[0] * 3, me[1] + dir[1] * 3] : me;
      var opts = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(function (d) {
        return open(f.p[0] + d[0], f.p[1] + d[1]) && !(d[0] === -f.d[0] && d[1] === -f.d[1]);
      });
      if (!opts.length) opts = [[-f.d[0], -f.d[1]]];
      var pick = Math.random() < 0.2 ? opts[rnd(opts.length)] : opts.sort(function (a, b) {
        return (Math.abs(f.p[0] + a[0] - target[0]) + Math.abs(f.p[1] + a[1] - target[1])) - (Math.abs(f.p[0] + b[0] - target[0]) + Math.abs(f.p[1] + b[1] - target[1]));
      })[0];
      f.d = pick;
      f.p = [f.p[0] + pick[0], f.p[1] + pick[1]];
    }
    function step() {
      tick++;
      if (open(me[0] + next[0], me[1] + next[1])) dir = next;
      if (dir[0] || dir[1]) face = dir[1] > 0 ? 0 : dir[1] < 0 ? 180 : dir[0] > 0 ? 90 : 270;
      if ((dir[0] || dir[1]) && open(me[0] + dir[0], me[1] + dir[1])) {
        me = [me[0] + dir[0], me[1] + dir[1]];
        var k = me[0] + ',' + me[1];
        if (!eaten[k]) { eaten[k] = 1; score++; if (score % 2) tone(SCALE[5 + (score % 4)], 30, 'square', 0.02); }
      }
      if (caught()) { if (!dead) draw(); return; }
      // the chasers sit out every few ticks, less often each level
      if (tick % Math.max(3, 6 - level) !== 0) foes.forEach(chase);
      if (caught()) { if (!dead) draw(); return; }
      if (!pellets()) {
        level++; eaten = {}; reset(); tone(1047, 200, 'triangle', 0.04); status();
      }
      draw();
    }
    function draw() {
      if (dead) return;
      var ink = cssVar('--name'), wallC = cssVar('--hm-ink');
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        if (r === me[0] && c === me[1]) return { c: ink, s: 'chomp', rot: face + 'deg' };
        for (var i = 0; i < foes.length; i++) if (foes[i].p[0] === r && foes[i].p[1] === c) return { c: postit(foes[i].k), s: 'ghost' };
        if (wall(r, c)) return wallC;
        return eaten[r + ',' + c] ? { o: 0.12 } : '';
      });
    }
    function status() { say(['eat the grid', { b: String(score) }, '♥ ' + lives, hint('arrows · esc', 'swipe to steer')]); }
    var sw = swiper(function (d) { if (d) next = d; });
    return {
      label: 'eat the grid',
      how: "You're the round chomper. Eat every dot and keep away from the two ghosts.",
      start: function () {
        l = L(); H = field(l); eaten = {}; lives = 3; score = 0; level = 0; tick = 0; dead = false;
        reset(); eaten[me[0] + ',' + me[1]] = 1;
        draw(); status();
        timer = setInterval(step, 140);
      },
      stop: function () { clearInterval(timer); dead = true; },
      key: function (e) { var d = dirOf(e); if (!d) return false; next = d; },
      input: function (e) { if (e.type.indexOf('touch') === 0) sw(e); }
    };
  }

  /* Invaders: rows of dots creep down; shoot up from the bottom row */
  function invadersGame() {
    var l, H, foes, adir, shots, bombs, me, lives, score, wave, tick, timer, dead, total;
    function line() {
      foes = [];
      var rows = Math.max(2, Math.min(4, Math.floor(H / 4)));
      var from = Math.floor(l.c * 0.12), to = Math.ceil(l.c * 0.7);
      for (var r = 0; r < rows; r++) for (var c = from; c <= to; c += 2) foes.push([r, c, r]);
      total = foes.length;
      adir = 1;
    }
    function fire() {
      if (dead || shots.length >= 2) return;
      shots.push([H - 2, me]);
      tone(880, 30, 'square', 0.025);
    }
    function step() {
      tick++;
      shots = shots.filter(function (s) {
        s[0]--;
        for (var i = 0; i < foes.length; i++) if (foes[i][0] === s[0] && foes[i][1] === s[1]) {
          foes.splice(i, 1); score++; tone(SCALE[3 + (score % 6)], 60, 'triangle', 0.035); return false;
        }
        return s[0] >= 0;
      });
      if (tick % 3 === 0) bombs = bombs.filter(function (s) {
        s[0]++;
        if (s[0] === H - 1 && s[1] === me) {
          lives--; tone(150, 260, 'sawtooth', 0.04);
          if (!lives) { dead = true; clearInterval(timer); over('invaders', 'game over · ' + score, 'hm-invaders', score, invadersGame); }
          else status();
          return false;
        }
        return s[0] < H;
      });
      if (dead) return;
      if (!foes.length) { wave++; line(); bombs = []; tone(1047, 200, 'triangle', 0.04); }
      // the fewer left, the faster they go
      var period = Math.max(2, Math.round((14 - wave * 2) * foes.length / total) + 2);
      if (tick % period === 0) {
        var edge = foes.some(function (f) { return f[1] + adir < 0 || f[1] + adir >= l.c; });
        if (edge) { adir = -adir; foes.forEach(function (f) { f[0]++; }); }
        else foes.forEach(function (f) { f[1] += adir; });
        if (foes.some(function (f) { return f[0] >= H - 1; })) {
          dead = true; clearInterval(timer); tone(150, 300, 'sawtooth', 0.04);
          over('invaders', 'game over · ' + score, 'hm-invaders', score, invadersGame); return;
        }
        if (foes.length && Math.random() < 0.35) { var f = foes[rnd(foes.length)]; bombs.push([f[0] + 1, f[1]]); }
      }
      draw();
    }
    function draw() {
      if (dead) return;
      var ink = cssVar('--name');
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        if (r === H - 1 && c === me) return ink;
        for (var i = 0; i < foes.length; i++) if (foes[i][0] === r && foes[i][1] === c) return postit([4, 5, 9, 3][foes[i][2] % 4]);
        for (i = 0; i < shots.length; i++) if (shots[i][0] === r && shots[i][1] === c) return ink;
        for (i = 0; i < bombs.length; i++) if (bombs[i][0] === r && bombs[i][1] === c) return postit(6);
        return '';
      });
    }
    function status() { say(['invaders', { b: String(score) }, '♥ ' + lives, hint('mouse or ←→ · click / space fires', 'drag to move · tap fires')]); }
    function to(c) { me = clampN(c, 0, l.c - 1); if (!dead) draw(); }
    return {
      label: 'invaders',
      how: 'Shoot the rows before they reach the bottom, and dodge the pink drops.',
      start: function () {
        l = L(); H = field(l); me = Math.floor(l.c / 2); shots = []; bombs = []; lives = 3; score = 0; wave = 0; tick = 0; dead = false;
        line(); draw(); status();
        timer = setInterval(step, 50);
      },
      stop: function () { clearInterval(timer); dead = true; },
      key: function (e) {
        var d = dirOf(e);
        if (isAct(e) || (d && d[0] < 0)) fire();
        else if (d && d[1]) to(me + d[1]);
        else return false;
      },
      move: function (e) { if (e.pointerType === 'mouse') to(colAt(l, e.clientX)); },
      input: function (e) {
        if (e.type === 'touchmove') to(colAt(l, point(e).clientX));
        else if (e.type === 'touchstart') fire();
        else if (e.type === 'pointerdown' && e.pointerType === 'mouse') fire();
      }
    };
  }

  /* Road crossing: the rows are lanes of moving cars; hop to the top */
  function crossingGame() {
    var l, H, lanes, me, lives, score, tick, timer, dead;
    function build() {
      lanes = [];
      for (var r = 0; r < H; r++) {
        // the top and bottom rows are safe, and every fourth row is a verge
        if (r === 0 || r === H - 1 || r % 3 === 0) { lanes.push(null); continue; }
        var cars = new Array(l.c).fill(0), c = rnd(5);
        while (c < l.c) {
          var len = 1 + rnd(2);
          for (var i = 0; i < len && c + i < l.c; i++) cars[c + i] = 1;
          c += len + 7 + rnd(8);
        }
        lanes.push({ cars: cars, dir: r % 2 ? 1 : -1, every: 3 + rnd(4), tint: [2, 3, 5, 6, 9, 4][r % 6] });
      }
    }
    function home() { me = [H - 1, Math.floor(l.c / 2)]; }
    function hitCheck() {
      var lane = lanes[me[0]];
      if (!lane || !lane.cars[me[1]]) return;
      lives--;
      tone(150, 300, 'sawtooth', 0.04);
      if (!lives) { dead = true; clearInterval(timer); over('road crossing', 'game over · ' + score, 'hm-crossing', score, crossingGame); return; }
      home(); status();
    }
    function hop(d) {
      if (dead) return;
      me = [clampN(me[0] + d[0], 0, H - 1), clampN(me[1] + d[1], 0, l.c - 1)];
      tone(523, 25, 'square', 0.02);
      if (me[0] === 0) {
        score++; tone(1047, 160, 'triangle', 0.04); home(); status();
        clearInterval(timer); timer = setInterval(step, Math.max(35, 80 - score * 5));
      }
      hitCheck();
      if (!dead) draw();
    }
    function step() {
      tick++;
      lanes.forEach(function (lane) {
        if (!lane || tick % lane.every) return;
        if (lane.dir > 0) lane.cars.unshift(lane.cars.pop()); else lane.cars.push(lane.cars.shift());
      });
      hitCheck();
      if (!dead) draw();
    }
    function draw() {
      var ink = cssVar('--name');
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        if (r === me[0] && c === me[1]) return ink;
        if (r === 0) return { c: postit(4), o: 0.5 };
        var lane = lanes[r];
        return lane && lane.cars[c] ? postit(lane.tint) : '';
      });
    }
    function status() { say(['road crossing', { b: String(score) }, '♥ ' + lives, hint('arrows · esc', 'swipe or tap to hop')]); }
    var sw = swiper(function (d, t) {
      if (d) { hop(d); return; }
      // a tap: hop towards it
      var r = rowAt(l, t.clientY), c = colAt(l, t.clientX);
      var dr = r - me[0], dc = c - me[1];
      if (dr || dc) hop(Math.abs(dr) >= Math.abs(dc) ? [dr > 0 ? 1 : -1, 0] : [0, dc > 0 ? 1 : -1]);
    });
    return {
      label: 'road crossing',
      how: 'Hop up to the green row at the top without getting hit by a car.',
      start: function () {
        l = L(); H = field(l); lives = 3; score = 0; tick = 0; dead = false;
        build(); home(); draw(); status();
        timer = setInterval(step, 80);
      },
      stop: function () { clearInterval(timer); dead = true; },
      key: function (e) { var d = dirOf(e); if (!d) return false; hop(d); },
      input: function (e) { if (e.type.indexOf('touch') === 0) sw(e); }
    };
  }

  /* One-button jumper: a pixel dinosaur runs along the bottom; jump the post-its */
  function jumperGame() {
    // the dinosaur is finer than the grid: a 19 x 20 pixel drawing laid over a
    // 4 x 4 block of dots (the dots under it step aside). Each row lists its
    // runs of pixels as [from, to); the eye is the gap in row 2. The legs come
    // in three poses: standing (and in the air), and two running steps
    var BODY = [[[10, 18]], [[9, 19]], [[9, 11], [12, 19]], [[9, 19]], [[9, 19]], [[9, 14]], [[9, 17]],
                [[0, 1], [8, 13]], [[0, 1], [7, 13]], [[0, 2], [5, 15]], [[0, 3], [4, 13], [14, 15]],
                [[0, 13]], [[0, 13]], [[1, 12]], [[2, 12]], [[3, 11]]];
    var LEGS = [
      [[[4, 7], [8, 10]], [[4, 6], [9, 10]], [[4, 5], [9, 10]], [[4, 6], [9, 11]]],
      [[[4, 7], [8, 10]], [[4, 6], [9, 11]], [[4, 5]], [[4, 6]]],
      [[[4, 7], [8, 10]], [[4, 6], [9, 10]], [[9, 10]], [[9, 11]]]
    ];
    var PW = 19, PH = 20;
    var JUMP = [1, 2, 3, 4, 4, 4, 4, 3, 2, 1, 0];
    var l, H, G, X, y, air, rocks, gap, score, timer, speed, dead, legs, art;
    function pose() { return BODY.concat(air >= 0 ? LEGS[0] : LEGS[1 + legs]); }
    // which of the 4 x 4 dots the drawing really covers: those are what a
    // post-it can hit
    var SOLID = (function () {
      var n = {}, out = [];
      [0, 1, 2].forEach(function (k) {
        BODY.concat(LEGS[k]).forEach(function (runs, py) {
          runs.forEach(function (run) {
            for (var px = run[0]; px < run[1]; px++) {
              var key = Math.floor(py * 4 / PH) + ',' + Math.floor(px * 4 / PW);
              n[key] = (n[key] || 0) + 1;
            }
          });
        });
      });
      for (var key in n) if (n[key] >= 9) out.push(key.split(',').map(Number));
      return out;
    })();
    function jump() {
      if (dead) return;
      if (air < 0) { air = 0; tone(659, 50, 'square', 0.025); }
    }
    // the dots the dinosaur covers as [row, col]; its feet stand y rows up
    function cells() {
      return SOLID.map(function (p) { return [G - 4 - y + p[0], X + p[1]]; });
    }
    function sprite() {
      var a = at(l, G - 4 - y, X), b = at(l, G - 1 - y, X + 3);
      if (!a || !b) return;
      if (!art) {
        art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        art.setAttribute('class', 'hm-dino');
        art.setAttribute('viewBox', '0 0 ' + PW + ' ' + PH);
        art.setAttribute('shape-rendering', 'crispEdges');
        art.setAttribute('aria-hidden', 'true');
        grid.appendChild(art);
      }
      art.style.left = a.offsetLeft + 'px';
      art.style.top = a.offsetTop + 'px';
      art.style.width = b.offsetLeft + b.offsetWidth - a.offsetLeft + 'px';
      art.style.height = b.offsetTop + b.offsetHeight - a.offsetTop + 'px';
      var d = '';
      pose().forEach(function (runs, py) {
        runs.forEach(function (run) { d += 'M' + run[0] + ' ' + py + 'h' + (run[1] - run[0]) + 'v1h' + (run[0] - run[1]) + 'z'; });
      });
      art.innerHTML = '<path fill="currentColor" d="' + d + '"/>';
    }
    function step() {
      if (air >= 0) { y = Math.min(JUMP[air], H - 5); air++; if (air >= JUMP.length) { air = -1; y = 0; } }
      legs = 1 - legs;
      rocks.forEach(function (o) { o.c--; });
      rocks = rocks.filter(function (o) { return o.c >= 0; });
      gap--;
      if (gap <= 0) { rocks.push({ c: l.c - 1, h: 1 + (Math.random() < 0.35 ? 1 : 0) }); gap = 12 + rnd(12); }
      var hit = cells().some(function (p) {
        return rocks.some(function (o) { return o.c === p[1] && p[0] >= G - o.h && p[0] < G; });
      });
      if (hit) {
        dead = true; clearInterval(timer); tone(150, 300, 'sawtooth', 0.04);
        over('jumper', 'game over · ' + Math.floor(score / 4), 'hm-jumper', Math.floor(score / 4), jumperGame);
        return;
      }
      score++;
      if (score % 40 === 0) {
        tone(SCALE[10], 50, 'triangle', 0.03);
        speed = Math.max(45, speed - 5);
        clearInterval(timer); timer = setInterval(step, speed);
        status();
      }
      draw();
    }
    function draw() {
      if (dead) return;
      var ground = cssVar('--hm-ink'), top = G - 4 - y;
      sprite();
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        if (r === G) return ground;
        if (r >= top && r < top + 4 && c >= X && c < X + 4) return { o: 0 };
        for (var i = 0; i < rocks.length; i++) if (rocks[i].c === c && r < G && r >= G - rocks[i].h) return postit(3);
        return '';
      });
    }
    function status() { say(['jumper', { b: String(Math.floor(score / 4)) }, hint('space or ↑ jumps', 'tap to jump')]); }
    return {
      label: 'jumper',
      how: "You're the dinosaur. Jump the post-its as they run at you; it speeds up.",
      start: function () {
        l = L(); H = field(l); G = H - 1; X = Math.min(3, Math.floor(l.c / 6));
        y = 0; air = -1; legs = 0; rocks = []; gap = 14; score = 0; speed = 85; dead = false; art = null;
        draw(); status();
        timer = setInterval(step, speed);
      },
      stop: function () { clearInterval(timer); dead = true; if (art) art.remove(); art = null; },
      key: function (e) { var d = dirOf(e); if (isAct(e) || (d && d[0] < 0)) jump(); else return false; },
      input: function (e) { if (e.type === 'pointerdown') jump(); }
    };
  }

  /* Memory sequence: four post-it corners light up with notes; repeat them */
  function memoryGame() {
    var TINT = [2, 5, 6, 4], NOTE = [330, 392, 523, 659];
    var l, H, seq, i, lit, busyPlay, timers, dead;
    function zone(r, c) { return (r < H / 2 ? 0 : 2) + (c < l.c / 2 ? 0 : 1); }
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function flash(z, ms) {
      lit = z; draw(); tone(NOTE[z], ms, 'triangle', 0.05);
      later(function () { lit = -1; draw(); }, ms);
    }
    function play() {
      busyPlay = true; i = 0;
      say(['memory', { b: 'round ' + seq.length }, 'watch']);
      var gap = Math.max(260, 620 - seq.length * 25);
      seq.forEach(function (z, n) { later(function () { flash(z, gap * 0.7); }, 500 + n * gap); });
      later(function () {
        busyPlay = false;
        say(['memory', { b: 'round ' + seq.length }, hint('your turn · click or 1–4', 'your turn · tap the colours')]);
      }, 500 + seq.length * gap);
    }
    function press(z) {
      if (busyPlay || dead) return;
      flash(z, 220);
      if (z !== seq[i]) {
        dead = true; tone(150, 400, 'sawtooth', 0.04);
        later(function () { over('memory', 'game over · ' + (seq.length - 1), 'hm-memory', seq.length - 1, memoryGame); }, 300);
        return;
      }
      i++;
      if (i === seq.length) { busyPlay = true; seq.push(rnd(4)); later(play, 700); }
    }
    function draw() {
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        var z = zone(r, c);
        return { c: postit(TINT[z]), o: z === lit ? 1 : 0.3 };
      });
    }
    return {
      label: 'memory',
      how: 'Watch the corners light up, then play them back in the same order.',
      start: function () {
        l = L(); H = field(l); seq = [rnd(4)]; lit = -1; timers = []; dead = false;
        draw(); play();
      },
      stop: function () { timers.forEach(clearTimeout); dead = true; },
      key: function (e) { var n = '1234'.indexOf(e.key); if (n < 0) return false; press(n); },
      input: function (e) {
        if (e.type !== 'pointerdown') return;
        var p = cellOf(l, e);
        if (p && p[0] < H) press(zone(p[0], p[1]));
      }
    };
  }

  /* Lights out: a tap flips a dot and its neighbours; clear the board */
  function lightsGame() {
    var l, H, N, r0, c0, on, cur, moves, level, dead;
    function flip(r, c) {
      [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
        var rr = r + d[0], cc = c + d[1];
        if (rr >= 0 && cc >= 0 && rr < N && cc < N) on[rr][cc] = !on[rr][cc];
      });
    }
    function deal() {
      on = []; for (var r = 0; r < N; r++) on.push(new Array(N).fill(false));
      // pressing at random from a dark board keeps every deal solvable
      for (var n = 0; n < 3 + level * 2; n++) flip(rnd(N), rnd(N));
      if (on.every(function (row) { return row.every(function (v) { return !v; }); })) flip(rnd(N), rnd(N));
      moves = 0;
    }
    function press(r, c) {
      if (dead) return;
      flip(r, c); moves++;
      tone(on[r][c] ? 523 : 392, 50, 'triangle', 0.03);
      if (on.every(function (row) { return row.every(function (v) { return !v; }); })) {
        tone(1047, 240, 'triangle', 0.04);
        level++;
        say(['lights out', { b: 'cleared in ' + moves }, { btn: 'next board', fn: function () { deal(); draw(); status(); } }, { btn: 'close', fn: function () { stopGame(); } }]);
        draw();
        return;
      }
      draw(); status();
    }
    function draw() {
      paint(l, function (r, c) {
        var i = r - r0, j = c - c0;
        if (i < 0 || j < 0 || i >= N || j >= N) return { o: 0.25 };
        return { c: on[i][j] ? postit(2) : '', cur: cur && cur[0] === i && cur[1] === j };
      });
    }
    function status() { say(['lights out', { b: 'board ' + (level + 1) }, moves + ' moves', hint('click · or arrows + space', 'tap a dot')]); }
    return {
      label: 'lights out',
      how: 'A tap flips a dot and its neighbours. Turn every yellow dot off.',
      start: function () {
        l = L(); H = field(l); N = Math.min(5, H, l.c);
        r0 = Math.floor((H - N) / 2); c0 = Math.floor((l.c - N) / 2);
        level = 0; cur = null; dead = false;
        deal(); draw(); status();
      },
      stop: function () { dead = true; },
      key: function (e) {
        var d = dirOf(e);
        if (d) { cur = cur ? [clampN(cur[0] + d[0], 0, N - 1), clampN(cur[1] + d[1], 0, N - 1)] : [2, 2]; draw(); }
        else if (isAct(e) && cur) press(cur[0], cur[1]);
        else return false;
      },
      input: function (e) {
        if (e.type !== 'pointerdown') return;
        var p = cellOf(l, e);
        if (!p) return;
        var i = p[0] - r0, j = p[1] - c0;
        if (i >= 0 && j >= 0 && i < N && j < N) { cur = null; press(i, j); }
      }
    };
  }

  /* Mine field: tap dots to dig; the numbers count the mines around them */
  function minesGame() {
    var l, H, mines, opened, flags, count, laid, t0, cur, dead, holdT, held;
    function k(r, c) { return r + ',' + c; }
    function near(r, c, fn) {
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
        var rr = r + dr, cc = c + dc;
        if ((dr || dc) && rr >= 0 && cc >= 0 && rr < H && cc < l.c) fn(rr, cc);
      }
    }
    function num(r, c) { var n = 0; near(r, c, function (a, b) { if (mines[k(a, b)]) n++; }); return n; }
    function lay(r, c) {
      // the first dig is always safe, and so are the dots around it
      var cells = [];
      for (var a = 0; a < H; a++) for (var b = 0; b < l.c; b++) if (Math.abs(a - r) > 1 || Math.abs(b - c) > 1) cells.push([a, b]);
      for (var n = 0; n < count && cells.length; n++) { var p = cells.splice(rnd(cells.length), 1)[0]; mines[k(p[0], p[1])] = 1; }
      laid = true; t0 = Date.now();
    }
    function dig(r, c) {
      if (dead || flags[k(r, c)] || opened[k(r, c)]) return;
      if (!laid) lay(r, c);
      if (mines[k(r, c)]) {
        dead = true; tone(110, 500, 'sawtooth', 0.05);
        draw(true);
        say(['mine field', { b: 'boom' }, { btn: 'again', fn: function () { startGame(minesGame()); } }, { btn: 'close', fn: function () { stopGame(); } }]);
        return;
      }
      var stack = [[r, c]];
      while (stack.length) {
        var p = stack.pop(), key = k(p[0], p[1]);
        if (opened[key] || flags[key]) continue;
        opened[key] = 1;
        if (!num(p[0], p[1])) near(p[0], p[1], function (a, b) { if (!opened[k(a, b)]) stack.push([a, b]); });
      }
      tone(SCALE[2 + rnd(5)], 30, 'triangle', 0.025);
      if (Object.keys(opened).length === H * l.c - count) {
        dead = true; draw(true);
        tone(1047, 300, 'triangle', 0.04);
        var s = Math.round((Date.now() - t0) / 1000);
        over('mine field', 'cleared in ' + s + 's', 'hm-mines', s, minesGame, true);
        return;
      }
      draw(); status();
    }
    function flag(r, c) {
      if (dead || opened[k(r, c)]) return;
      if (flags[k(r, c)]) delete flags[k(r, c)]; else flags[k(r, c)] = 1;
      tone(784, 40, 'square', 0.025);
      draw(); status();
    }
    function draw(all) {
      var ink = cssVar('--name');
      paint(l, function (r, c) {
        if (r >= H) return { o: 0.25 };
        var key = k(r, c), isCur = !!(cur && cur[0] === r && cur[1] === c);
        if (all && mines[key]) return { c: postit(6), cur: isCur };
        if (flags[key]) return { c: ink, cur: isCur };
        if (opened[key]) { var n = num(r, c); return { c: postit(1), o: n ? 1 : 0.45, t: n || '', cur: isCur }; }
        return { cur: isCur };
      });
    }
    function status() {
      say(['mine field', { b: (count - Object.keys(flags).length) + ' mines left' }, hint('click digs · right-click flags · or arrows + space / f', 'tap digs · hold to flag')]);
    }
    return {
      label: 'mine field',
      how: 'A number counts the mines touching it. Dig every safe dot and flag the mines.',
      start: function () {
        l = L(); H = field(l); mines = {}; opened = {}; flags = {}; laid = false; cur = null; dead = false;
        count = Math.max(4, Math.round(H * l.c * 0.13));
        draw(); status();
      },
      stop: function () { clearTimeout(holdT); dead = true; },
      key: function (e) {
        var d = dirOf(e);
        if (d) { cur = cur ? [clampN(cur[0] + d[0], 0, H - 1), clampN(cur[1] + d[1], 0, l.c - 1)] : [Math.floor(H / 2), Math.floor(l.c / 2)]; draw(); }
        else if (isAct(e) && cur) dig(cur[0], cur[1]);
        else if (e.key.toLowerCase() === 'f' && cur) flag(cur[0], cur[1]);
        else return false;
      },
      input: function (e) {
        if (e.type === 'contextmenu') { e.preventDefault(); return; }
        var p;
        if (e.type === 'pointerdown') {
          p = cellOf(l, e);
          if (!p || p[0] >= H) return;
          cur = null;
          if (e.button === 2) { held = true; flag(p[0], p[1]); return; }
          held = false;
          clearTimeout(holdT);
          holdT = setTimeout(function () { held = true; flag(p[0], p[1]); }, 420);
        } else if (e.type === 'pointerup') {
          clearTimeout(holdT);
          if (held) return;
          p = cellOf(l, e);
          if (p && p[0] < H) dig(p[0], p[1]);
        } else if (e.type === 'pointercancel') clearTimeout(holdT);
      }
    };
  }

  /* Pairs: flip two dots at a time to match the post-it colours */
  function pairsGame() {
    var l, H, R, C, step, r0, c0, cards, up, done, moves, cur, lock, dead, timers;
    function deal() {
      var tints = [2, 3, 4, 5, 6, 8, 9, 'ink'], deck = [];
      tints.slice(0, R * C / 2).forEach(function (t) { deck.push(t, t); });
      for (var i = deck.length - 1; i > 0; i--) { var j = rnd(i + 1), x = deck[i]; deck[i] = deck[j]; deck[j] = x; }
      cards = deck; up = []; done = {}; moves = 0; lock = false;
    }
    function idx(r, c) {
      var i = (r - r0) / step, j = (c - c0) / step;
      if (i % 1 || j % 1 || i < 0 || j < 0 || i >= R || j >= C) return -1;
      return i * C + j;
    }
    function face(n) { return cards[n] === 'ink' ? cssVar('--name') : postit(cards[n]); }
    function turn(n) {
      if (dead || lock || n < 0 || done[n] || up.indexOf(n) >= 0) return;
      up.push(n);
      tone(SCALE[4 + (n % 6)], 50, 'triangle', 0.03);
      if (up.length === 2) {
        moves++;
        if (cards[up[0]] === cards[up[1]]) {
          done[up[0]] = done[up[1]] = 1; up = [];
          tone(880, 120, 'triangle', 0.04);
          if (Object.keys(done).length === cards.length) {
            dead = true; draw();
            over('pairs', 'done in ' + moves + ' moves', 'hm-pairs', moves, pairsGame, true);
            return;
          }
        } else {
          lock = true;
          timers.push(setTimeout(function () { up = []; lock = false; draw(); }, 750));
        }
      }
      draw(); status();
    }
    function draw() {
      var back = cssVar('--hm-ink');
      paint(l, function (r, c) {
        var n = idx(r, c);
        if (n < 0) return { o: r >= H ? 0.25 : 0.3 };
        var isCur = !!(cur && cur === n);
        if (done[n]) return { c: face(n), o: 0.55, cur: isCur };
        if (up.indexOf(n) >= 0) return { c: face(n), cur: isCur };
        return { c: back, cur: isCur };
      });
    }
    function status() { say(['pairs', { b: moves + ' moves' }, hint('click two · or arrows + space', 'tap two dots')]); }
    return {
      label: 'pairs',
      how: 'Flip two at a time to find the matching colours.',
      start: function () {
        l = L(); H = field(l); timers = []; dead = false; cur = null;
        R = 4; C = 4;
        // a gap between the cards when there's room for one
        step = H >= 7 && l.c >= 7 ? 2 : 1;
        if (H < R * step - step + 1) { R = Math.max(2, Math.min(4, H)); }
        r0 = Math.floor((H - (R - 1) * step - 1) / 2); c0 = Math.floor((l.c - (C - 1) * step - 1) / 2);
        deal(); draw(); status();
      },
      stop: function () { timers.forEach(clearTimeout); dead = true; },
      key: function (e) {
        var d = dirOf(e);
        if (d) {
          var i = cur == null ? 0 : Math.floor(cur / C), j = cur == null ? 0 : cur % C;
          if (cur != null) { i = clampN(i + d[0], 0, R - 1); j = clampN(j + d[1], 0, C - 1); }
          cur = i * C + j; draw();
        } else if (isAct(e) && cur != null) turn(cur);
        else return false;
      },
      input: function (e) {
        if (e.type !== 'pointerdown') return;
        var p = cellOf(l, e);
        if (p) { cur = null; turn(idx(p[0], p[1])); }
      }
    };
  }

  /* ---------- The ▶ menu ---------- */
  var GAMES = [snakeGame, sequencerGame, blocksGame, bricksGame, tennisGame, eatGame, invadersGame,
               crossingGame, jumperGame, memoryGame, lightsGame, minesGame, pairsGame];
  if (chip) {
    var menu = null;
    var close = function () { if (menu) { menu.remove(); menu = null; chip.setAttribute('aria-expanded', 'false'); } };
    // scrolled down, the grid is folded up under the name: go back to the top
    // first, and open the menu once the page is there
    var toTop = function (then) {
      if (scrollY <= 0) { then(); return; }
      scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      var t0 = Date.now();
      (function wait() {
        if (scrollY <= 0 || Date.now() - t0 > 1500) then(); else requestAnimationFrame(wait);
      })();
    };
    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      if (game) { stopGame(); return; }
      if (menu) { close(); return; }
      toTop(open);
    });
    var open = function () {
      if (menu) return;
      menu = el('div', 'hm-menu hm-menu-2');
      menu.setAttribute('role', 'menu');
      GAMES.forEach(function (make) {
        var b = el('button', '', make().label);
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.addEventListener('click', function (ev) { ev.stopPropagation(); close(); startGame(make()); });
        menu.appendChild(b);
      });
      grid.appendChild(menu);
      menu.style.left = Math.max(0, chip.offsetLeft + chip.offsetWidth - menu.offsetWidth) + 'px';
      // open upwards: below the grid is the name. A short grid keeps it on the grid
      menu.style.top = Math.max(0, chip.offsetTop - menu.offsetHeight - 6) + 'px';
      chip.setAttribute('aria-expanded', 'true');
      // without preventScroll the browser scrolls the first item into view
      menu.firstChild.focus({ preventScroll: true });
    };
    document.addEventListener('click', function (e) { if (menu && !menu.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      if (!menu) return;
      if (e.key === 'Escape') { close(); chip.focus(); return; }
      // up / down move through the menu, not the page (key-nav listens too)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        var items = Array.prototype.slice.call(menu.querySelectorAll('button'));
        var i = items.indexOf(document.activeElement);
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      }
    }, true);
  }

  /* ---------- Pet: the theme toggle. Stays put; only its eyes follow ---------- */
  var pet = document.getElementById('theme-toggle');
  if (pet && pet.classList.contains('hm-pet')) {
    var look = function (x, y) {
      var r = pet.getBoundingClientRect();
      var dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1;
      // reach: a sixth of the pet, so the eyes never leave its face
      var reach = Math.min(1, d / 120) * r.width / 6;
      pet.style.setProperty('--ex', (dx / d * reach).toFixed(1) + 'px');
      pet.style.setProperty('--ey', (dy / d * reach).toFixed(1) + 'px');
    };
    addEventListener('pointermove', function (e) { look(e.clientX, e.clientY); }, { passive: true });
    if (!reduce) {
      (function blink() {
        setTimeout(function () {
          pet.classList.add('is-blink');
          setTimeout(function () { pet.classList.remove('is-blink'); blink(); }, 140);
        }, 2500 + rnd(4000));
      })();
    }
  }

  /* ---------- ASCII cursor trail ----------
     Each mark starts as a heavy symbol and, as it fades over two seconds,
     steps down an ASCII shading ramp to a dot. Not over the dot grid: the
     post-its and games live there */
  if (canHover && !reduce) {
    var HEAVY = '+*#%@&$=~^<>/\\|!?x', RAMP = ['*', '+', '=', '-', ':', '.'];
    var LIFE = 2000, HOLD = 500, lx = 0, ly = 0, marks = [], ticking = 0;
    var tick = function () {
      var now = Date.now();
      marks = marks.filter(function (m) {
        var age = now - m.t;
        if (age > LIFE + 100) { m.s.remove(); return false; }
        if (age > HOLD) {
          var ch = RAMP[Math.min(RAMP.length - 1, Math.floor((age - HOLD) / ((LIFE - HOLD) / RAMP.length)))];
          if (m.s.textContent !== ch) m.s.textContent = ch;
        }
        return true;
      });
      ticking = marks.length ? setTimeout(tick, 80) : 0;
    };
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest && e.target.closest('#dots')) return;
      if (Math.hypot(e.clientX - lx, e.clientY - ly) < 26) return;
      lx = e.clientX; ly = e.clientY;
      var s = el('span', 'hm-trail', HEAVY[rnd(HEAVY.length)]);
      s.setAttribute('aria-hidden', 'true');
      s.style.left = e.clientX + 6 + 'px';
      s.style.top = e.clientY + 6 + 'px';
      document.body.appendChild(s);
      // it fades for the same two seconds (fx/home.css)
      marks.push({ s: s, t: Date.now() });
      if (!ticking) ticking = setTimeout(tick, 80);
    }, { passive: true });
  }

  /* ---------- Loader: the grid arrives cell by cell, in about a second and a
     half (SLOW: 30% slower than before; each cell's fade is in fx/home.css) ---------- */
  if (root.classList.contains('hm-loading')) {
    var l = L(), max = 0, SLOW = 1.3;
    var perRow = SLOW * Math.min(50, 600 / Math.max(1, l.r)), perCol = SLOW * Math.min(6, 300 / Math.max(1, l.c));
    l.all.forEach(function (n, i) {
      var d = Math.round(Math.floor(i / l.c) * perRow + (i % l.c) * perCol);
      max = Math.max(max, d);
      n.style.setProperty('--hm-l', d + 'ms');
    });
    requestAnimationFrame(function () {
      root.classList.remove('hm-loading');
      root.classList.add('hm-loaded');
      setTimeout(function () { root.classList.remove('hm-loaded'); }, max + 500);
      // the last cell has landed: the name types next (app.js)
      setTimeout(function () { document.dispatchEvent(new Event('hm:grid-in')); }, max + 340);
    });
  }
})();
