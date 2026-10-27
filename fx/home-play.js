/* Home (index.html): the grid's play layer. Loaded after app.js.
   From the lab (fx/x2.js): snake (it wraps round the edges) and the dot
   sequencer behind the ▶ chip (arrow keys move through its menu), the pet
   (the theme toggle: only its eyes follow the pointer), the ASCII cursor
   trail and the cell-by-cell loader (set up in fx/home.js). */
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
  }
  function startGame(g) {
    stopGame(true);
    unlock();
    busy = true;
    game = g;
    grid.classList.add('hm-game');
    clearAll();
    if (chip) chip.classList.add('is-on');
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
    if (chip) chip.classList.remove('is-on');
  }
  // while a game runs it owns the grid: app.js never sees these events
  ['pointerover', 'pointerdown', 'touchstart', 'touchmove', 'touchend', 'click', 'dblclick'].forEach(function (type) {
    grid.addEventListener(type, function (e) {
      if (!busy || (e.target.closest && e.target.closest('button, .hm-status, .hm-menu'))) return;
      e.stopImmediatePropagation();
      if (game && game.input) game.input(e);
    }, true);
  });
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

  /* ---------- The ▶ menu ---------- */
  var GAMES = [snakeGame, sequencerGame];
  if (chip) {
    var menu = null;
    var close = function () { if (menu) { menu.remove(); menu = null; chip.setAttribute('aria-expanded', 'false'); } };
    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      if (game) { stopGame(); return; }
      if (menu) { close(); return; }
      menu = el('div', 'hm-menu');
      menu.setAttribute('role', 'menu');
      GAMES.forEach(function (make) {
        var b = el('button', '', make().label);
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.addEventListener('click', function (ev) { ev.stopPropagation(); close(); startGame(make()); });
        menu.appendChild(b);
      });
      grid.appendChild(menu);
      menu.style.left = Math.max(0, chip.offsetLeft + chip.offsetWidth - 120) + 'px';
      // open upwards: below the grid is the name
      menu.style.top = chip.offsetTop - menu.offsetHeight - 6 + 'px';
      chip.setAttribute('aria-expanded', 'true');
      menu.firstChild.focus();
    });
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

  /* ---------- ASCII cursor trail ---------- */
  if (canHover && !reduce) {
    var CH = '+·×*', lx = 0, ly = 0;
    addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      if (Math.hypot(e.clientX - lx, e.clientY - ly) < 26) return;
      lx = e.clientX; ly = e.clientY;
      var s = el('span', 'hm-trail', CH[rnd(CH.length)]);
      s.setAttribute('aria-hidden', 'true');
      s.style.left = e.clientX + 6 + 'px';
      s.style.top = e.clientY + 6 + 'px';
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 700);
    }, { passive: true });
  }

  /* ---------- Loader: the grid arrives cell by cell, under a second ---------- */
  if (root.classList.contains('hm-loading')) {
    var l = L(), max = 0;
    var perRow = Math.min(50, 600 / Math.max(1, l.r)), perCol = Math.min(6, 300 / Math.max(1, l.c));
    l.all.forEach(function (n, i) {
      var d = Math.round(Math.floor(i / l.c) * perRow + (i % l.c) * perCol);
      max = Math.max(max, d);
      n.style.setProperty('--hm-l', d + 'ms');
    });
    requestAnimationFrame(function () {
      root.classList.remove('hm-loading');
      root.classList.add('hm-loaded');
      setTimeout(function () { root.classList.remove('hm-loaded'); }, max + 400);
    });
  }
})();
