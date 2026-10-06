/* Interaction lab. Loaded after app.js only when the URL carries ?fx=...
   Each experiment is a small function switched on by its id in data-fx. */
(function () {
  var root = document.documentElement;
  var on = (root.getAttribute('data-fx') || '').split(' ').filter(Boolean);
  var has = function (id) { return on.indexOf(id) > -1; };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = matchMedia('(hover: hover)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* One rAF-throttled scroll hook shared by the scroll experiments */
  var scrollFns = [];
  function onScroll(fn) {
    scrollFns.push(fn);
    if (scrollFns.length > 1) return;
    var queued = false;
    function run() { queued = false; scrollFns.forEach(function (f) { f(); }); }
    addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run);
  }

  /* ---------- Badge: which experiment, prev / next, back to the list ---------- */
  function badge() {
    // test builds (index-v1-*.html) switch interactions on without the lab badge
    if (root.hasAttribute('data-fx-quiet')) return;
    var list = window.FX_LIST || [];
    var el = document.createElement('div');
    el.className = 'fx-badge';
    function add(tag, text, href, label) {
      var n = document.createElement(tag);
      n.textContent = text;
      if (href) n.href = href;
      if (label) n.setAttribute('aria-label', label);
      el.appendChild(n);
      return n;
    }
    var i = list.findIndex(function (f) { return f.id === on[0]; });
    if (on.length === 1 && i > -1) {
      var n = list.length;
      var link = function (j) { return 'index.html?fx=' + list[(j + n) % n].id; };
      add('a', '\u2039', link(i - 1), 'Previous');
      var label = add('span', String(i + 1).padStart(2, '0') + '/' + n + ' ');
      var b = document.createElement('b');
      b.textContent = list[i].name;
      label.appendChild(b);
      add('a', '\u203a', link(i + 1), 'Next');
    } else {
      var span = add('span', '');
      var bold = document.createElement('b');
      bold.textContent = on.length + ' combined';
      span.appendChild(bold);
    }
    add('a', 'off', 'index.html');
    add('a', 'all', 'interactions.html');
    document.body.appendChild(el);
  }

  /* ---------- 01/02 Sticky name and condensing header ----------
     Fixed rather than sticky (Safari pins sticky flex items to their flex line).
     A spacer holds the hero's place, and the switch happens exactly where the
     hero would reach 16px from the top, so nothing jumps. */
  function stickyHero() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var spacer = document.createElement('div');
    spacer.className = 'fx-hero-spacer';
    hero.before(spacer);
    var start = 0, stuck = false;

    function measure() {
      var was = stuck;
      unstick();
      var r = hero.getBoundingClientRect();
      start = r.top + scrollY - 16;
      spacer.style.height = (r.height + parseFloat(getComputedStyle(hero).marginTop)) + 'px';
      hero.style.width = r.width + 'px';
      hero.style.left = r.left + 'px';
      if (was) update();
    }
    function stick() { stuck = true; spacer.classList.add('is-on'); hero.classList.add('fx-stuck'); }
    function unstick() { stuck = false; spacer.classList.remove('is-on'); hero.classList.remove('fx-stuck'); }
    function update() {
      if (scrollY >= start && !stuck) stick();
      else if (scrollY < start && stuck) unstick();
    }
    // once pinned, the name is a way back to the top
    hero.querySelector('.name').addEventListener('click', function () {
      if (!stuck) return;
      var from = scrollY, t0 = performance.now(), dur = reduce ? 0 : 600;
      (function step(now) {
        var p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
        scrollTo(0, from * Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
    measure();
    addEventListener('resize', measure);
    document.fonts && document.fonts.ready.then(measure);
    onScroll(update);
  }

  /* ---------- 03 Dots dissolve: rows shrink as they reach the top ---------- */
  function dotsDissolve() {
    var grid = document.getElementById('dots');
    if (!grid) return;
    onScroll(function () {
      var items = grid.children;
      for (var i = 0; i < items.length; i++) {
        var y = items[i].getBoundingClientRect().top;
        var s = clamp((y + 14) / 160, 0, 1);
        items[i].style.transform = s < 1 ? 'scale(' + s.toFixed(3) + ')' : '';
        items[i].style.opacity = s < 1 ? s.toFixed(3) : '';
      }
    });
  }

  /* ---------- 04 Footer tucks away on scroll down ---------- */
  function footerAutohide() {
    var footer = document.querySelector('.home .footer');
    if (!footer) return;
    var last = scrollY;
    onScroll(function () {
      var y = scrollY;
      if (Math.abs(y - last) < 4) return;
      footer.classList.toggle('fx-hidden', y > last && y > 40);
      last = y;
    });
  }

  /* ---------- 05 Dot ripple from the toggle ---------- */
  // returns how long the ripple takes to reach the farthest dot (ms)
  function dotsWave(msPerPx) {
    var grid = document.getElementById('dots');
    if (!grid || reduce) return 0;
    var k = msPerPx || 1.1, longest = 0;
    var items = Array.prototype.slice.call(grid.children);
    var t = grid.querySelector('.toggle').getBoundingClientRect();
    var cx = t.left + t.width / 2, cy = t.top + t.height / 2;
    items.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var d = Math.round(Math.hypot(r.left + 7 - cx, r.top + 7 - cy) * k);
      longest = Math.max(longest, d);
      el.style.setProperty('--d', d + 'ms');
      el.classList.add('fx-wave');
      el.addEventListener('animationend', function () { el.classList.remove('fx-wave'); }, { once: true });
    });
    return longest;
  }

  /* ---------- Intro sequence: dots, then name, then everything else ----------
     Stages are classes on <html>: fx-s1 dots ripple in, fx-s2 the name rises and
     types, fx-s3 links, role, bio and footer fade up one after another (tabs and
     project rows follow via rows-on-scroll, if on). fx-done clears it all.
     Any scroll, click or key press skips straight to the end. */
  function introSequence() {
    var cls = root.classList;
    function done() {
      if (cls.contains('fx-done')) return;
      cls.add('fx-s1', 'fx-s2', 'fx-s3', 'fx-done');
      document.dispatchEvent(new CustomEvent('fx-intro-rest'));
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (t) { removeEventListener(t, done, true); });
    }
    if (reduce) { done(); return; }
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (t) { addEventListener(t, done, { capture: true, passive: true }); });

    cls.add('fx-s1');
    var ripple = dotsWave(0.7);                 // ~0.5s to the far corner
    var name = document.querySelector('.name');
    var t0 = performance.now();

    /* Stage 2 once the ripple has spread. app.js types the name the moment the
       page loads (hidden, here), and ignores a re-type while that is running,
       so wait for it to finish, then reveal and re-type from the first letter. */
    (function stage2() {
      if (cls.contains('fx-done')) return;
      if (performance.now() - t0 < ripple + 100 || (name && name.classList.contains('is-typing'))) {
        return setTimeout(stage2, 40);
      }
      cls.add('fx-s2');
      if (name) name.click();                   // app.js re-types the name on click
      // stage 3 only once the name has finished typing, plus a beat
      (function stage3() {
        if (cls.contains('fx-done')) return;
        if (name && name.classList.contains('is-typing')) return setTimeout(stage3, 40);
        setTimeout(function () {
          if (cls.contains('fx-done')) return;
          cls.add('fx-s3');
          document.dispatchEvent(new CustomEvent('fx-intro-rest'));
          setTimeout(done, 1400);
        }, 150);
      })();
    })();
  }

  /* ---------- 07 Role types after the name ---------- */
  function roleTyping() {
    var role = document.querySelector('.role');
    if (!role || reduce) return;
    var full = role.textContent;
    role.textContent = ' ';
    setTimeout(function () {
      var i = 0;
      role.textContent = '';
      role.classList.add('fx-typing');
      (function step() {
        role.textContent = full.slice(0, ++i);
        if (i < full.length) setTimeout(step, 35);
        else setTimeout(function () { role.classList.remove('fx-typing'); }, 600);
      })();
    }, 1000);
  }

  /* ---------- 10 Title decode ---------- */
  function titleScramble() {
    if (!canHover) return;
    var GLYPHS = '#%&*+=/\\<>_-|{}[]0123456789';
    document.querySelectorAll('.row .title').forEach(function (el) {
      // keep the mobile line break markup intact: only plain-text titles
      if (el.children.length) return;
      var full = el.textContent, timer = null;
      el.closest('.row').addEventListener('pointerenter', function () {
        clearInterval(timer);
        var frame = 0, total = 14;
        timer = setInterval(function () {
          frame++;
          var settled = Math.floor(full.length * frame / total);
          el.textContent = full.split('').map(function (c, i) {
            if (i < settled || c === ' ') return c;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }).join('');
          if (frame >= total) { clearInterval(timer); el.textContent = full; }
        }, 32);
      });
    });
  }

  /* ---------- 11 Number counts up when a summary opens ---------- */
  function statCountup() {
    document.querySelectorAll('#panel-work .row').forEach(function (row) {
      var em = row.querySelector('.row-desc em');
      if (!em) return;
      var m = em.textContent.match(/(\$?)(\d+)(%|M)/);
      if (!m) return;
      var original = em.textContent, target = +m[2], raf = null;
      function run() {
        cancelAnimationFrame(raf);
        if (reduce) return;
        var t0 = performance.now();
        (function tick(now) {
          var p = clamp((now - t0) / 800, 0, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          em.textContent = original.replace(m[0], m[1] + Math.round(target * eased) + m[3]);
          if (p < 1) raf = requestAnimationFrame(tick);
        })(t0);
      }
      row.addEventListener('pointerenter', run);
      row.addEventListener('click', run);
    });
  }

  /* ---------- 12 Sliding tab + cascading list ---------- */
  function tabSlider() {
    var head = document.querySelector('.section-head[role="tablist"]');
    if (!head) return;
    var pill = document.createElement('span');
    pill.className = 'fx-tab-pill';
    pill.setAttribute('aria-hidden', 'true');
    head.prepend(pill);
    function place(animate) {
      var tab = head.querySelector('.tab[aria-selected="true"]');
      if (!tab) return;
      if (!animate) pill.style.transition = 'none';
      pill.style.width = (tab.offsetWidth + 6) + 'px';
      pill.style.transform = 'translateX(' + (tab.offsetLeft - 3) + 'px)';
      if (!animate) { void pill.offsetWidth; pill.style.transition = ''; }
    }
    place(false);
    document.fonts && document.fonts.ready.then(function () { place(false); });
    addEventListener('resize', function () { place(false); });
    head.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        place(true);
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (!panel || reduce) return;
        panel.classList.remove('fx-cascade');
        Array.prototype.forEach.call(panel.children, function (c, i) { c.style.animationDelay = (i * 60) + 'ms'; });
        void panel.offsetWidth;
        panel.classList.add('fx-cascade');
      });
    });
  }

  /* ---------- 15 Image follows the cursor (eased) ---------- */
  function previewFollow() {
    var list = document.getElementById('panel-work');
    var frames = document.querySelectorAll('.row-preview');
    if (!list || !frames.length) return;
    var target = null, current = null, raf = null, inside = false, pointerY = 0;
    // everything in the coordinates of the box the images are positioned in
    function aim() {
      var box = frames[0].offsetParent;
      if (!box) return;
      var base = box.getBoundingClientRect().top;
      var h = frames[0].offsetHeight || 180;
      var lr = list.getBoundingClientRect();
      var top = lr.top - base, bottom = lr.bottom - base;
      // never tuck under a pinned header
      var bar = document.querySelector('.hero.fx-stuck, .fx-bar.fx-pinned');
      if (bar) top = Math.max(top, bar.getBoundingClientRect().bottom + 8 - base);
      target = clamp(pointerY - base - h / 2, top, Math.max(top, bottom - h));
      if (current === null) current = target;
    }
    /* Runs every frame while the pointer is over the list, so the row-change
       code in app.js (which snaps a new image to its row) is overridden on the
       very next frame and the image keeps gliding instead of jumping. */
    function loop() {
      if (inside) aim();
      current += (target - current) * 0.16;
      frames.forEach(function (f) { f.style.top = current.toFixed(1) + 'px'; });
      raf = inside || Math.abs(target - current) > 0.3 ? requestAnimationFrame(loop) : null;
    }
    list.addEventListener('pointerenter', function (e) {
      inside = true; pointerY = e.clientY; current = null; aim();
      if (!raf) raf = requestAnimationFrame(loop);
    });
    list.addEventListener('pointermove', function (e) { pointerY = e.clientY; });
    list.addEventListener('pointerleave', function () { inside = false; });
  }

  /* ---------- 16 Image tilt toward the pointer ---------- */
  function previewTilt() {
    var list = document.getElementById('panel-work');
    if (!list || !canHover) return;
    list.addEventListener('pointermove', function (e) {
      var img = document.querySelector('.row-preview.is-visible');
      if (!img) return;
      var lr = list.getBoundingClientRect();
      var ir = img.getBoundingClientRect();
      var x = clamp((e.clientX - lr.left) / lr.width * 2 - 1, -1, 1);
      var y = clamp((e.clientY - (ir.top + ir.height / 2)) / 120, -1, 1);
      img.style.transform = 'perspective(900px) rotateY(' + (x * 10).toFixed(2) + 'deg) rotateX(' + (-y * 7).toFixed(2) + 'deg)';
    });
    list.addEventListener('pointerleave', function () {
      document.querySelectorAll('.row-preview').forEach(function (f) { f.style.transform = ''; });
    });
  }

  /* ---------- 17 Dot lens: dots near the pointer shrink away ---------- */
  function dotsProximity() {
    var grid = document.getElementById('dots');
    if (!grid || !canHover) return;
    var px = -1e4, py = -1e4, raf = null;
    function draw() {
      raf = null;
      Array.prototype.forEach.call(grid.children, function (el) {
        var r = el.getBoundingClientRect();
        var d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height / 2 - py);
        var s = 0.35 + 0.65 * clamp(d / 90, 0, 1);
        el.style.transform = s < 0.999 ? 'scale(' + s.toFixed(3) + ')' : '';
      });
    }
    grid.style.transition = 'none';
    Array.prototype.forEach.call(grid.children, function (el) {
      el.style.transition = 'background-color 1000ms ease, transform 180ms ease-out';
    });
    addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { px = py = -1e4; draw(); });
  }

  /* ---------- 19 Magnetic contact links ---------- */
  function magneticLinks() {
    if (!canHover) return;
    var links = document.querySelectorAll('.links a');
    addEventListener('pointermove', function (e) {
      links.forEach(function (a) {
        var r = a.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        var d = Math.hypot(dx, dy), reach = 70;
        if (d < reach) {
          var pull = (1 - d / reach) * 0.25;
          a.style.transform = 'translate(' + (dx * pull).toFixed(1) + 'px,' + (dy * pull).toFixed(1) + 'px)';
        } else if (a.style.transform) {
          a.style.transform = '';
        }
      });
    }, { passive: true });
  }

  /* ---------- 20 Theme ripple via the View Transitions API ---------- */
  function themeCircle() {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle || !document.startViewTransition || reduce) return;
    var passing = false;
    toggle.addEventListener('click', function (e) {
      if (passing) return;
      e.stopImmediatePropagation();
      var r = toggle.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var vt = document.startViewTransition(function () { passing = true; toggle.click(); passing = false; });
      vt.ready.then(function () {
        root.animate({ clipPath: ['circle(0 at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 700, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' });
      });
    }, true);
  }

  var POSTITS = [
    [255, 255, 153], [255, 235, 161], [254, 230,  59], [255, 173, 100], [210, 222,  64],
    [ 55, 210, 216], [248,  58, 167], [255, 249, 165], [249, 184, 188], [176, 205, 235]
  ];

  /* ---------- 01 Pinned header, Figma 326:17182 ----------
     Grid and hero share one bar. It scrolls with the page until only the last
     two rows of dots are showing, then pins there (fixed, offset upwards by the
     rows that have gone) and the hero folds into one line. Same as
     position: sticky with a negative top, done in JS for Safari's sake. */
  function pinHeader() {
    var grid = document.getElementById('dots');
    var hero = document.querySelector('.hero');
    if (!grid || !hero) return;
    var bar = document.createElement('div');
    bar.className = 'fx-bar';
    var spacer = document.createElement('div');
    spacer.className = 'fx-bar-spacer';
    grid.before(spacer, bar);
    bar.append(grid, hero);

    var KEEP = 36; // two rows: 14 + 8 + 14
    var start = 0, lift = 0, pinned = false;
    function pin() { pinned = true; spacer.classList.add('is-on'); bar.classList.add('fx-pinned'); bar.style.top = -lift + 'px'; }
    function unpin() { pinned = false; spacer.classList.remove('is-on'); bar.classList.remove('fx-pinned'); bar.style.top = ''; }
    function measure() {
      var was = pinned;
      unpin();
      var r = bar.getBoundingClientRect();
      lift = grid.offsetHeight - KEEP;
      start = r.top + scrollY + lift;
      spacer.style.height = r.height + 'px';
      bar.style.width = r.width + 'px';
      bar.style.left = r.left + 'px';
      if (was) update();
    }
    function update() {
      if (scrollY >= start && !pinned) pin();
      else if (scrollY < start && pinned) unpin();
    }
    // the folded name is a way home
    // Driven by hand: the browser's smooth scroll gave up partway here as the
    // name re-typed itself underneath it.
    hero.querySelector('.name').addEventListener('click', function () {
      if (!pinned) return;
      var from = scrollY, t0 = performance.now(), dur = reduce ? 0 : 600;
      (function step(now) {
        var p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
        scrollTo(0, from * (1 - (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
    measure();
    addEventListener('resize', measure);
    matchMedia('(min-width: 768px)').addEventListener('change', measure);
    document.fonts && document.fonts.ready.then(measure);
    onScroll(update);
  }

  /* ---------- Rows rise into view ---------- */
  function rowsOnScroll() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var items = document.querySelectorAll('.section-head, #panel-work .row');
    var io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = (n++ * 80) + 'ms';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { el.classList.add('fx-reveal'); });
    function start() { items.forEach(function (el) { io.observe(el); }); }
    // with the intro on, the projects wait their turn (stage 3)
    if (has('intro-sequence') && !root.classList.contains('fx-done')) {
      document.addEventListener('fx-intro-rest', function () { setTimeout(start, 350); }, { once: true });
    } else {
      start();
    }
  }

  /* ---------- Scroll paints the grid ---------- */
  function scrollPaint() {
    var grid = document.getElementById('dots');
    if (!grid || reduce) return;
    var last = scrollY;
    function paint(dot) {
      var c = POSTITS[Math.floor(Math.random() * POSTITS.length)];
      var dark = root.getAttribute('data-theme') === 'dark';
      dot.style.transition = 'none';
      dot.style.backgroundColor = dark ? 'rgba(' + c + ',0.6)' : 'rgb(' + c + ')';
      void dot.offsetWidth;
      dot.style.transition = '';
      dot.classList.add('is-fading');
      dot.style.backgroundColor = '';
    }
    onScroll(function () {
      var speed = Math.abs(scrollY - last);
      last = scrollY;
      var dots = grid.querySelectorAll('.dot');
      var count = Math.min(12, Math.floor(speed / 6));
      for (var i = 0; i < count; i++) paint(dots[Math.floor(Math.random() * dots.length)]);
    });
  }

  /* ---------- Keyboard browsing ---------- */
  function keyNav() {
    var rows = Array.prototype.slice.call(document.querySelectorAll('#panel-work .row'));
    if (!rows.length) return;
    var idx = -1;
    function fire(row, type) { row.dispatchEvent(new PointerEvent(type)); }
    function select(i) {
      if (idx > -1) { rows[idx].classList.remove('fx-key'); fire(rows[idx], 'pointerleave'); }
      idx = i;
      if (idx < 0) return;
      var row = rows[idx];
      row.classList.add('fx-key');
      fire(row, 'pointerenter');
      var r = row.getBoundingClientRect();
      if (r.top < 120 || r.bottom > innerHeight - 80) row.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
    document.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      var k = e.key;
      if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); select(Math.min(rows.length - 1, idx + 1)); }
      else if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); select(Math.max(0, idx - 1)); }
      else if (k === 'Escape') select(-1);
      else if (k === 'Enter' && idx > -1) {
        var a = rows[idx].querySelector('a.title');
        if (a) a.click();
      }
    });
    // the pointer takes over again as soon as it moves
    document.getElementById('panel-work').addEventListener('pointermove', function () { if (idx > -1) select(-1); });
  }

  /* ---------- Pixel reveal ---------- */
  function pixelReveal() {
    var frames = document.querySelectorAll('.row-preview');
    if (!frames.length || reduce) return;
    var cover = document.createElement('div');
    cover.className = 'fx-pixels';
    cover.hidden = true;
    var cells = [];
    for (var i = 0; i < 16 * 9; i++) { var c = document.createElement('span'); cover.appendChild(c); cells.push(c); }
    frames[frames.length - 1].after(cover);
    var timer = null;
    var mo = new MutationObserver(function (list) {
      list.forEach(function (m) {
        var f = m.target;
        if (!f.classList.contains('is-visible') || m.oldValue && m.oldValue.indexOf('is-visible') > -1) return;
        clearTimeout(timer);
        cover.style.top = f.style.top;
        cover.style.left = getComputedStyle(f).left;
        cover.hidden = false;
        cells.forEach(function (c) { c.style.transition = 'none'; c.style.opacity = 1; });
        void cover.offsetWidth;
        cells.forEach(function (c) {
          c.style.transition = 'opacity 120ms linear ' + Math.round(Math.random() * 380) + 'ms';
          c.style.opacity = 0;
        });
        timer = setTimeout(function () { cover.hidden = true; }, 600);
      });
    });
    frames.forEach(function (f) {
      f.style.transition = 'none'; // the squares do the revealing
      mo.observe(f, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    });
  }

  /* ---------- Square cursor companion ---------- */
  function cursorSquare() {
    if (!canHover || reduce) return;
    var sq = document.createElement('div');
    sq.className = 'fx-cursor';
    sq.setAttribute('aria-hidden', 'true');
    document.body.appendChild(sq);
    var x = -100, y = -100, cx = -100, cy = -100, raf = null;
    function loop() {
      cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
      sq.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px)';
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.2 ? requestAnimationFrame(loop) : null;
    }
    addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      sq.classList.toggle('is-big', !!e.target.closest('a, button, .row, .tab'));
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerleave', function () { x = y = cx = cy = -100; loop(); });
  }

  /* ---------- Page fades between pages ---------- */
  function pageFade() {
    if (reduce) return;
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
      var href = a.getAttribute('href');
      if (!/^[\w-]+\.html/.test(href) || href.indexOf('index.html') === 0) return;
      e.preventDefault();
      document.body.classList.add('fx-leaving');
      setTimeout(function () { location.href = href; }, 260);
    });
    // coming back through the back button restores the page from cache
    addEventListener('pageshow', function () { document.body.classList.remove('fx-leaving'); });
  }

  ready(function () {
    badge();
    if (has('pin-header')) pinHeader();
    else if (has('sticky-hero') || has('compact-header') || has('compact-inline')) stickyHero();
    if (has('rows-on-scroll')) rowsOnScroll();
    if (has('scroll-paint')) scrollPaint();
    if (has('key-nav')) keyNav();
    if (has('pixel-reveal')) pixelReveal();
    if (has('cursor-square')) cursorSquare();
    if (has('page-fade')) pageFade();
    if (has('dots-dissolve')) dotsDissolve();
    if (has('footer-autohide')) footerAutohide();
    if (has('intro-sequence')) introSequence();
    else if (has('dots-wave')) dotsWave();
    if (has('role-typing')) roleTyping();
    if (has('title-scramble')) titleScramble();
    if (has('stat-countup')) statCountup();
    if (has('tab-slider')) tabSlider();
    if (has('preview-follow')) previewFollow();
    if (has('preview-tilt')) previewTilt();
    if (has('dots-proximity')) dotsProximity();
    if (has('magnetic-links')) magneticLinks();
    if (has('theme-circle')) themeCircle();
  });
})();
