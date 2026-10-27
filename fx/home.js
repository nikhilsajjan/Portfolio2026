/* Home (index.html): layout for both sizes. Runs before app.js.
   - Head: the dot grid and the hero share a sticky box whose top is pulled up
     by everything above the grid's last row, so that row pins with the name.
   - While the head rises the name shrinks from the full width; it is fully
     small exactly when the head pins.
   - From 1024px the rows follow the columns in the Figma grid's proportions
     (51 x 19); below it they fill the first screen above the name, and once
     pinned the name goes onto one line with the role beside it.
   - Ribbon: the bio's first line, tilted and running round (CSS); a tap
     pauses it.
   app.js builds a fixed 14 x 11 grid on phones, so index.html calls
   window.homeGrid() right after app.js to size it. The play layer is
   fx/home-play.js. */
(function () {
  var root = document.documentElement;
  var home = document.querySelector('.home');
  var dots = document.getElementById('dots');
  var hero = document.querySelector('.hero');
  var bio = document.querySelector('.bio');
  if (!home || !dots || !hero || !bio) return;
  var name = hero.querySelector('.name');
  var role = hero.querySelector('.role');
  var links = hero.querySelector('.links');
  var footer = home.querySelector('.footer');
  var wide = matchMedia('(min-width: 1024px)');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // Figma 580:26314: 24px dots on a 36px pitch, 51 columns by 19 rows
  var DOT = 24, GAP = 12, ROWS_PER_COL = 19 / 51;
  // head's top padding, pinned name and role px for each size
  function sizes() {
    return wide.matches
      ? { pad: 24, small: 44, roleSmall: 16 }
      : { pad: 16, small: 20, roleSmall: 12, rolePinned: 11 };
  }

  // loader: the grid starts hidden and arrives cell by cell (play script)
  if (!reduce.matches) root.classList.add('hm-loading');
  // the ▶ chip joins the controls before anyone counts them
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    var play = document.createElement('button');
    play.className = 'hm-play';
    play.type = 'button';
    play.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M4.5 3.2v7.6l6-3.8z" fill="currentColor"/></svg>';
    play.setAttribute('aria-label', 'Play a game in the grid');
    play.setAttribute('aria-haspopup', 'true');
    toggle.before(play);
    // the pet: the toggle's icons give way to two eyes
    toggle.classList.add('hm-pet');
    toggle.append(el('i', 'hm-eye'), el('i', 'hm-eye'));
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, p) { return a + (b - a) * p; }

  /* ---------- Structure ---------- */
  var snap = el('div', 'hm-snap');
  var head = el('div', 'hm-head');
  dots.before(snap, head);
  head.append(dots, hero);
  // role and links share the line under the name
  var line = el('div', 'hm-line');
  role.before(line);
  line.append(role, links);

  var ribbon = el('div', 'hm-ribbon');
  ribbon.setAttribute('aria-hidden', 'true');
  var track = el('div', 'hm-ribbon-track');
  var first = bio.querySelector('p');
  // the sentence without its full stop: the star (CSS) ends each one
  var line1 = first ? first.textContent.trim().replace(/\.$/, '') : '';
  // two identical halves: the track slides by half and starts over
  for (var i = 0; i < 8; i++) track.appendChild(el('span', '', line1));
  ribbon.appendChild(track);
  head.after(ribbon);
  ribbon.addEventListener('click', function () { ribbon.classList.toggle('is-paused'); });

  // key-nav's first stop is the bio's first line, which the ribbon shows (the
  // line itself is only there for screen readers): light the ribbon instead
  // and bring it back into view
  if (first && 'MutationObserver' in window) {
    new MutationObserver(function () {
      var on = first.classList.contains('fx-key');
      ribbon.classList.toggle('is-key', on);
      if (on) scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
    }).observe(first, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Sizes ---------- */
  var tools = Array.prototype.slice.call(dots.children);
  var big = 0, roleBig = 0, lift = 0, lastKey = '', lastSize = '';

  // the whole name on one line, as wide as the column. Measured at 100px
  function fitName() {
    name.style.fontSize = '100px';
    // measure the whole name, not the text on screen: app.js types it in
    var probe = el('span', '', name.getAttribute('aria-label') || 'nikhil sajjan');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    name.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    probe.remove();
    // the letter-spacing after the last letter takes no visible room
    w -= parseFloat(getComputedStyle(name).letterSpacing) || 0;
    big = w > 0 ? Math.floor(100 * head.clientWidth / w * 0.99) : 60;
  }

  // unpinned: measure the head as it is just before the phone switch
  function apply(p, unpinned) {
    var s = sizes();
    var pinned = !wide.matches && p >= 1 && !unpinned;
    head.classList.toggle('is-pinned', pinned);
    name.style.fontSize = lerp(big, s.small, p) + 'px';
    role.style.fontSize = (pinned ? s.rolePinned : lerp(roleBig, s.roleSmall, p)) + 'px';
  }

  function build(cols, rows) {
    home.style.setProperty('--dot-cols', cols);
    home.style.setProperty('--dot-rows', rows);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < cols * rows - tools.length; i++) frag.appendChild(el('span', 'dot'));
    tools.forEach(function (t) { frag.appendChild(t); });
    dots.replaceChildren(frag);
  }

  // phones: the screen height is read once per width, since the toolbars
  // change innerHeight while scrolling and the grid shouldn't jump with them
  function layout(force) {
    var w = head.clientWidth, key = (wide.matches ? 'd' : 'p') + w;
    if (!force && key === lastKey) return;
    lastKey = key;
    var s = sizes();
    roleBig = wide.matches ? clamp(innerWidth * 0.01875, 18, 36) : 16; // Figma: 36px at 1920
    fitName();
    apply(0, true);
    var cols = Math.max(6, Math.floor((w + GAP) / (DOT + GAP)));
    var rows;
    if (wide.matches) rows = Math.max(3, Math.round(cols * ROWS_PER_COL));
    else {
      // the grid takes the first screen above the name, role, links and
      // ribbon. app.js may still be typing the name, so count its full line
      var hs = getComputedStyle(hero), rs = getComputedStyle(ribbon);
      var heroH = hero.offsetHeight - name.offsetHeight + parseFloat(getComputedStyle(name).lineHeight);
      var below = parseFloat(hs.marginTop) + heroH + parseFloat(rs.marginTop) + ribbon.offsetHeight
        + 24 /* the tilt */ + (footer ? footer.offsetHeight : 0) + 12;
      rows = Math.max(4, Math.floor((Math.min(innerHeight, 1000) - s.pad - below + GAP) / (DOT + GAP)));
    }
    if (cols + 'x' + rows !== lastSize) { lastSize = cols + 'x' + rows; build(cols, rows); }
    var gridH = rows * (DOT + GAP) - GAP;
    // pin with the last row showing and one gap above it
    lift = s.pad + gridH - DOT - GAP;
    head.style.top = -lift + 'px';
    // phones: the one-line pinned head is shorter than the head just before
    // it; the difference becomes its margin, so the page below stays put
    apply(1, true);
    var beforeH = head.offsetHeight;
    root.style.setProperty('--hm-pin-gap', '0px');
    apply(1);
    var pinnedH = head.offsetHeight;
    root.style.setProperty('--hm-pin-gap', Math.max(0, beforeH - pinnedH) + 'px');
    root.style.setProperty('--hm-head', (pinnedH - lift) + 'px');
    update();
  }
  // after app.js has built its own grid
  window.homeGrid = function () { lastSize = ''; layout(true); };

  var raf = 0;
  function update() {
    raf = 0;
    if (!lift) return;
    apply(clamp(scrollY / lift, 0, 1));
  }
  addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });

  // re-fit once the name's own face has arrived (fonts.ready can settle first)
  if (document.fonts) {
    document.fonts.ready.then(function () { layout(true); });
    document.fonts.load('700 100px "Redaction 100"').then(function () { layout(true); }, function () {});
  }
  var rt;
  addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(false); }, 150); });
  wide.addEventListener('change', function () { layout(true); });

  // once pinned, the name is a way back to the top. Driven by hand: smooth
  // scrolling gives up partway as the name re-types itself underneath it.
  name.addEventListener('click', function () {
    if (scrollY < 1) return;
    var from = scrollY, t0 = performance.now(), dur = reduce.matches ? 0 : 700;
    (function step(now) {
      var p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      scrollTo(0, from * Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  });

  /* ---------- From 1024px: the project image follows the pointer ---------- */
  if (matchMedia('(hover: hover)').matches) {
    var fl = el('img', 'hm-follow');
    fl.alt = '';
    document.body.appendChild(fl);
    var tx = 0, ty = 0, x = 0, y = 0, fraf = 0, on = false;
    var step = function () {
      x += (tx - x) * (reduce.matches ? 1 : 0.18);
      y += (ty - y) * (reduce.matches ? 1 : 0.18);
      fl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      fraf = (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) ? requestAnimationFrame(step) : 0;
    };
    // key-nav selects rows with a made-up pointerenter: no pointer to follow,
    // so the image waits beside the row's title (and keeps to it while
    // key-nav scrolls the row into view)
    var keyRow = null;
    var beside = function () {
      var r = keyRow.getBoundingClientRect(), t = keyRow.querySelector('.row-title');
      var tr = t ? t.getBoundingClientRect() : r;
      tx = x = Math.min(tr.right + 32, innerWidth - fl.offsetWidth - 48);
      ty = y = Math.max(r.top + r.height / 2 - fl.offsetHeight / 2, 0);
      fl.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    };
    addEventListener('scroll', function () { if (keyRow && on) beside(); }, { passive: true });
    addEventListener('pointermove', function (e) {
      if (e.movementX || e.movementY) keyRow = null;
      tx = e.clientX + 24;
      ty = e.clientY - fl.offsetHeight / 2;
      if (!on) { x = tx; y = ty; }
      if (!fraf) fraf = requestAnimationFrame(step);
    });
    document.querySelectorAll('.work .row[data-preview]').forEach(function (row) {
      row.addEventListener('pointerenter', function (e) {
        if (!wide.matches) return;
        keyRow = e.isTrusted ? null : row;
        if (keyRow) beside();
        var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        fl.src = 'assets/previews/' + row.dataset.preview + '-' + theme + '.webp';
        fl.classList.add('is-on');
        on = true;
      });
      row.addEventListener('pointerleave', function () { fl.classList.remove('is-on'); on = false; });
    });
  }
})();
