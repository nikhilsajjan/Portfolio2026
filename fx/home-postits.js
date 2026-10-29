/* Home (index.html): post-its. Loaded after fx/home-play.js.
   When no game is running, clicking (or tapping) a dot opens a small picker:
   choose a post-it colour and drop it there. The post-it stays on the grid for
   everyone, with the city and country it came from (Cloudflare's own idea of
   where the visitor is: no IP is stored). Hovering or tapping a post-it says
   where it's from. The service is worker/postits (a Cloudflare Worker).
   Post-its sit on a grid of any size: they're kept as 0..1 across and down
   and land on the nearest dot. */
(function () {
  var root = document.documentElement;
  var grid = document.getElementById('dots');
  if (!grid) return;
  // the live worker (worker/postits, deployed 2026-10-28). Add ?postits=local
  // to use `wrangler dev` on this machine instead
  var LIVE = 'https://nikhil-postits.nikhil-sajjan-design.workers.dev';
  var API = /[?&]postits=local\b/.test(location.search) ? 'http://' + location.hostname + ':8787' : LIVE;

  var POSTITS = [[255, 255, 153], [255, 235, 161], [254, 230, 59], [255, 173, 100], [210, 222, 64],
                 [55, 210, 216], [248, 58, 167], [255, 249, 165], [249, 184, 188], [176, 205, 235]];
  function postit(i) {
    var c = POSTITS[i];
    return root.getAttribute('data-theme') === 'dark' ? 'rgba(' + c + ',0.6)' : 'rgb(' + c + ')';
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function L() {
    var all = Array.prototype.slice.call(grid.children).filter(function (n) { return n.classList.contains('dot') || n.tagName === 'BUTTON'; });
    var c = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    return { c: c, r: Math.ceil(all.length / c), all: all };
  }
  function playing() { return grid.classList.contains('hm-game'); }
  function place(p) { return [p.city, p.country].filter(Boolean).join(', ') || 'somewhere'; }
  function ago(t) {
    var d = Math.floor((Date.now() - t) / 86400000);
    return d < 1 ? 'today' : d < 2 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(t).toLocaleDateString('en', { month: 'short', year: 'numeric' });
  }

  /* ---------- The post-its on the grid ---------- */
  var pins = [], here = null;
  function cellFor(l, p) {
    var r = Math.round(p.y * (l.r - 1)), c = Math.round(p.x * (l.c - 1));
    // the controls end the last row: step left past them
    for (; c >= 0; c--) { var n = l.all[r * l.c + c]; if (n && n.classList.contains('dot')) return n; }
    return null;
  }
  function draw() {
    var l = L();
    grid.querySelectorAll('.dot.hm-pin').forEach(function (d) {
      d.classList.remove('hm-pin'); d.style.removeProperty('--pin'); delete d.dataset.pin;
    });
    // oldest first, so the newest wins a shared dot
    pins.slice().reverse().forEach(function (p, i) {
      var d = cellFor(l, p);
      if (!d) return;
      d.classList.add('hm-pin');
      d.style.setProperty('--pin', postit(p.hue));
      d.dataset.pin = pins.length - 1 - i;
    });
  }
  function load() {
    fetch(API + '/pins').then(function (r) { return r.json(); }).then(function (list) {
      if (Array.isArray(list)) { pins = list; draw(); }
    }).catch(function () {});
  }
  load();
  // the grid is rebuilt on resize, and the colours change with the theme
  new MutationObserver(function () { if (!grid.querySelector('.hm-pin') && pins.length) draw(); }).observe(grid, { childList: true });
  new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Where a post-it is from: a big post-it of its own ---------- */
  var tip = el('div', 'hm-tip');
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  var tipSays = el('p', 'hm-tip-says'), tipWhen = el('p', 'hm-tip-when');
  tip.append(tipSays, tipWhen);
  function showTip(d) {
    var p = pins[+d.dataset.pin];
    if (!p) return;
    tipSays.textContent = p.city || p.country ? 'Someone from ' + (p.city || p.country) + ' visited' : 'Someone visited';
    tipWhen.textContent = (p.city && p.country ? p.country + ' · ' : '') + ago(p.at);
    // the post-it's own colour, solid (it's paper in both themes)
    tip.style.background = 'rgb(' + POSTITS[p.hue] + ')';
    grid.querySelectorAll('.hm-pin-on').forEach(function (n) { n.classList.remove('hm-pin-on'); });
    d.classList.add('hm-pin-on');
    grid.appendChild(tip);
    tip.hidden = false;
    var left = d.offsetLeft + d.offsetWidth / 2 - tip.offsetWidth / 2;
    tip.style.left = Math.max(0, Math.min(grid.clientWidth - tip.offsetWidth, left)) + 'px';
    var above = d.offsetTop - tip.offsetHeight - 12;
    tip.style.top = (above >= 0 ? above : d.offsetTop + d.offsetHeight + 12) + 'px';
  }
  function hideTip() { tip.hidden = true; grid.querySelectorAll('.hm-pin-on').forEach(function (n) { n.classList.remove('hm-pin-on'); }); }
  grid.addEventListener('pointerover', function (e) {
    var d = e.target.closest && e.target.closest('.dot.hm-pin');
    if (d && !playing() && e.pointerType === 'mouse') showTip(d); else if (e.pointerType === 'mouse') hideTip();
  });
  grid.addEventListener('pointerleave', hideTip);

  /* ---------- Dropping one ---------- */
  var box = null, at = null, hue = 2;
  function close() { if (box) { box.remove(); box = null; } if (at) at.classList.remove('hm-pick'); at = null; }
  function open(d) {
    close();
    hideTip();
    at = d;
    at.classList.add('hm-pick');
    box = el('div', 'hm-drop');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Drop a post-it');
    box.appendChild(el('b', '', 'Drop a post-it here'));
    var row = el('div', 'hm-swatches');
    POSTITS.forEach(function (_, i) {
      var s = el('button', 'hm-swatch');
      s.type = 'button';
      s.style.background = postit(i);
      s.setAttribute('aria-label', 'colour ' + (i + 1));
      s.setAttribute('aria-pressed', i === hue ? 'true' : 'false');
      s.addEventListener('click', function (e) {
        e.stopPropagation();
        hue = i;
        row.querySelectorAll('.hm-swatch').forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        at.style.setProperty('--pick', postit(i));
      });
      row.appendChild(s);
    });
    box.appendChild(row);
    var from = el('p', 'hm-from', here ? 'It will say someone from ' + place(here) + ' visited.' : 'It will say where you visited from.');
    box.appendChild(from);
    if (!here) fetch(API + '/where').then(function (r) { return r.json(); }).then(function (w) { here = w; if (box) from.textContent = 'It will say someone from ' + place(w) + ' visited.'; }).catch(function () {});
    var acts = el('div', 'hm-acts');
    var go = el('button', '', 'drop it');
    go.type = 'button';
    go.addEventListener('click', function (e) { e.stopPropagation(); drop(go, from); });
    var no = el('button', '', 'cancel');
    no.type = 'button';
    no.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    acts.append(go, no);
    box.appendChild(acts);
    at.style.setProperty('--pick', postit(hue));
    grid.appendChild(box);
    // beside the dot, kept inside the grid; above it in the lower half
    var left = d.offsetLeft + d.offsetWidth / 2 - box.offsetWidth / 2;
    box.style.left = Math.max(0, Math.min(grid.clientWidth - box.offsetWidth, left)) + 'px';
    var below = d.offsetTop + d.offsetHeight + 8, above = d.offsetTop - box.offsetHeight - 8;
    box.style.top = (above >= 0 && d.offsetTop > grid.clientHeight / 2 ? above : below) + 'px';
    go.focus({ preventScroll: true });
  }
  function drop(go, from) {
    var l = L(), i = l.all.indexOf(at);
    if (i < 0) return close();
    var r = Math.floor(i / l.c), c = i % l.c;
    var p = { x: l.c > 1 ? c / (l.c - 1) : 0, y: l.r > 1 ? r / (l.r - 1) : 0, hue: hue };
    go.disabled = true;
    go.textContent = 'dropping…';
    fetch(API + '/pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      .then(function (res) { return res.json().then(function (b) { return { ok: res.ok, b: b }; }); })
      .then(function (res) {
        if (!res.ok) { go.textContent = 'drop it'; go.disabled = false; from.textContent = res.b.error || 'That didn\'t work. Try again?'; return; }
        pins.unshift(res.b);
        var d = at;
        close();
        draw();
        if (d) showTip(d);
        setTimeout(hideTip, 2500);
      })
      .catch(function () { go.textContent = 'drop it'; go.disabled = false; from.textContent = 'That didn\'t work. Try again?'; });
  }

  // a click or a tap on a dot (not a drag across the grid, which paints)
  var down = null;
  grid.addEventListener('pointerdown', function (e) { down = [e.clientX, e.clientY]; });
  grid.addEventListener('click', function (e) {
    if (playing()) return;
    if (box && box.contains(e.target)) return;
    var d = e.target.closest && e.target.closest('.dot');
    if (!d) { close(); return; }
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 10) return;
    e.stopPropagation();
    // on a phone the first tap on a post-it says where it's from
    if (d.classList.contains('hm-pin') && tip.hidden) { showTip(d); return; }
    hideTip();
    open(d);
  });
  document.addEventListener('click', function (e) { if (box && !grid.contains(e.target)) close(); });

  // a mouse resting on one dot for 3.5s counts as a click there. Not on a
  // post-it (that shows where it's from), and only once per dot: after a
  // cancel, the mouse has to move to another dot first
  var DWELL = 3500, dwell = 0, rest = null, spent = null;
  function still() { clearTimeout(dwell); dwell = 0; rest = null; }
  grid.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var d = e.target.closest && e.target.closest('.dot');
    if (d === rest) return;
    still();
    if (!d || d === spent || playing() || box || d.classList.contains('hm-pin')) return;
    rest = d;
    dwell = setTimeout(function () {
      dwell = 0;
      if (rest !== d || playing() || box || document.hidden || !d.isConnected) return;
      spent = d;
      hideTip();
      open(d);
    }, DWELL);
  });
  grid.addEventListener('pointerleave', function () { still(); spent = null; });
  grid.addEventListener('pointerdown', still);
  addEventListener('scroll', still, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box) { close(); } });
  // a game takes the grid: no picker, no labels, and the post-its step aside
  new MutationObserver(function () { if (playing()) { close(); hideTip(); } }).observe(grid, { attributes: true, attributeFilter: ['class'] });
})();
