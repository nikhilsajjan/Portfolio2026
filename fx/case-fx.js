/* Interaction lab for cdc-w-xendit.html. Loaded after app.js only when the
   URL carries ?fx=... Each experiment is switched on by its id in data-fx. */
(function () {
  var root = document.documentElement;
  var on = (root.getAttribute('data-fx') || '').split(' ').filter(Boolean);
  var has = function (id) { return on.indexOf(id) > -1; };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var PAGE = 'cdc-w-xendit.html';

  // the home page picks a post-it colour per visit; this page does the same
  var POSTITS = ['#ffff99', '#ffeba1', '#fee63b', '#ffad64', '#d2de40',
                 '#37d2d8', '#f83aa7', '#fff9a5', '#f9b8bc', '#b0cdeb'];
  var accent = null;
  try { accent = sessionStorage.getItem('accent'); } catch (e) {}
  root.style.setProperty('--accent', accent || POSTITS[Math.floor(Math.random() * POSTITS.length)]);

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var scrollFns = [];
  function onScroll(fn) {
    scrollFns.push(fn);
    if (scrollFns.length > 1) return;
    var queued = false;
    function run() { queued = false; scrollFns.forEach(function (f) { f(); }); }
    addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(run); } }, { passive: true });
    addEventListener('resize', run);
    requestAnimationFrame(run);
  }

  /* ---------- Sections: which one is being read ---------- */
  var sections = [];
  var READ_LINE = 0.35; // a section is current once its top passes 35% down the screen
  function activeIndex() {
    // short last sections can never reach the read line, so the bottom of the
    // page counts as reading the last one
    if (sections.length && scrollY + innerHeight >= document.documentElement.scrollHeight - 2) return sections.length - 1;
    var line = innerHeight * READ_LINE, idx = -1;
    sections.forEach(function (s, i) { if (s.getBoundingClientRect().top <= line) idx = i; });
    return idx;
  }
  function sectionProgress(i) {
    var r = sections[i].getBoundingClientRect(), line = innerHeight * READ_LINE;
    return clamp((line - r.top) / r.height, 0, 1);
  }
  function goTo(i, e) {
    if (e) e.preventDefault();
    var target = sections[i].getBoundingClientRect().top + scrollY - 72;
    var from = scrollY, t0 = performance.now(), dur = reduce ? 0 : 650;
    (function step(now) {
      var p = dur ? clamp((now - t0) / dur, 0, 1) : 1;
      scrollTo(0, from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
    history.replaceState(null, '', location.search + '#' + sections[i].id);
  }
  function label(s) { return s.getAttribute('data-toc'); }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ---------- Badge ---------- */
  function badge() {
    // the default set on the test build runs without the lab badge
    if (root.hasAttribute('data-fx-quiet')) return;
    var list = window.CASE_FX_LIST || [];
    var box = el('div', 'fx-badge');
    function add(tag, text, href, aria) {
      var n = el(tag, '', text);
      if (href) n.href = href;
      if (aria) n.setAttribute('aria-label', aria);
      box.appendChild(n);
      return n;
    }
    var i = list.findIndex(function (f) { return f.id === on[0]; });
    if (on.length === 1 && i > -1) {
      var n = list.length;
      var link = function (j) { return PAGE + '?fx=' + list[(j + n) % n].id; };
      add('a', '‹', link(i - 1), 'Previous');
      var span = add('span', pad(i + 1) + '/' + n + ' ');
      span.appendChild(el('b', '', list[i].name));
      add('a', '›', link(i + 1), 'Next');
    } else {
      add('span', '').appendChild(el('b', '', on.length + ' combined'));
    }
    add('a', 'off', PAGE + '?fx=none');
    add('a', 'all', 'interactions.html#case');
    document.body.appendChild(box);
  }

  /* ---------- Side index / numbered chapters / ticks ---------- */
  function toc(kind) {
    var nav = el('nav', 'fx-toc fx-toc-' + kind);
    nav.setAttribute('aria-label', 'Sections');
    var ol = el('ol');
    var links = sections.map(function (s, i) {
      var li = el('li');
      var a = el('a');
      a.href = '#' + s.id;
      if (kind === 'numbered') {
        a.appendChild(el('span', 'num', pad(i + 1)));
        a.appendChild(document.createTextNode(label(s)));
        var bar = el('span', 'bar');
        bar.appendChild(el('i'));
        a.appendChild(bar);
      } else if (kind === 'ticks') {
        a.appendChild(el('span', 'tick'));
        a.appendChild(el('span', 'label', label(s)));
        a.setAttribute('aria-label', label(s));
      } else {
        a.textContent = label(s);
      }
      a.addEventListener('click', function (e) { goTo(i, e); });
      li.appendChild(a);
      ol.appendChild(li);
      return a;
    });
    nav.appendChild(ol);
    document.body.appendChild(nav);
    onScroll(function () {
      var cur = activeIndex();
      links.forEach(function (a, i) {
        a.setAttribute('aria-current', i === cur ? 'true' : 'false');
        if (kind === 'numbered') {
          var p = i < cur ? 1 : i === cur ? sectionProgress(i) : 0;
          a.querySelector('.bar i').style.transform = 'scaleX(' + p.toFixed(3) + ')';
        }
      });
    });
  }

  /* ---------- Progress rail ---------- */
  function rail() {
    var nav = el('nav', 'fx-rail');
    nav.setAttribute('aria-label', 'Sections');
    nav.appendChild(el('span', 'line'));
    var fill = el('span', 'fill');
    nav.appendChild(fill);
    var marks = sections.map(function (s, i) {
      var a = el('a');
      a.href = '#' + s.id;
      a.appendChild(el('span', '', label(s)));
      a.addEventListener('click', function (e) { goTo(i, e); });
      nav.appendChild(a);
      return a;
    });
    document.body.appendChild(nav);
    function place() {
      var total = document.documentElement.scrollHeight - innerHeight;
      marks.forEach(function (a, i) {
        var at = clamp((sections[i].getBoundingClientRect().top + scrollY - innerHeight * READ_LINE) / total, 0, 1);
        a.style.top = (at * 100) + '%';
        a.dataset.at = at;
      });
    }
    place();
    addEventListener('resize', place);
    addEventListener('load', place);
    onScroll(function () {
      var total = document.documentElement.scrollHeight - innerHeight;
      var p = total > 0 ? clamp(scrollY / total, 0, 1) : 0;
      fill.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      var cur = activeIndex();
      marks.forEach(function (a, i) {
        a.classList.toggle('is-read', +a.dataset.at <= p + 0.001);
        a.setAttribute('aria-current', i === cur ? 'true' : 'false');
      });
    });
  }

  /* ---------- Section in the back bar ---------- */
  function crumb() {
    var box = el('div', 'fx-crumb');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
    var shown = -2;
    onScroll(function () {
      var cur = activeIndex();
      if (cur === shown) return;
      shown = cur;
      box.textContent = '';
      if (cur < 0) return;
      box.appendChild(el('span', 'slash', '/'));
      box.appendChild(el('span', 'fx-sec', label(sections[cur]).toLowerCase()));
    });
  }

  /* ---------- Chapter pill ---------- */
  function pill() {
    var wrap = el('div', 'fx-pill');
    var btn = el('button');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    var n = el('span', 'n'), name = el('span', 'fx-sec'), caret = el('span', 'caret', '▴');
    btn.append(n, name, caret);
    var ol = el('ol');
    var links = sections.map(function (s, i) {
      var li = el('li'), a = el('a', '', pad(i + 1) + '  ' + label(s));
      a.href = '#' + s.id;
      a.addEventListener('click', function (e) { goTo(i, e); toggle(false); });
      li.appendChild(a);
      ol.appendChild(li);
      return a;
    });
    wrap.append(ol, btn);
    document.body.appendChild(wrap);
    function toggle(open) {
      wrap.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () { toggle(!wrap.classList.contains('is-open')); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggle(false); });
    onScroll(function () {
      var cur = Math.max(0, activeIndex());
      n.textContent = pad(cur + 1) + '/' + pad(sections.length);
      name.textContent = label(sections[cur]);
      links.forEach(function (a, i) { a.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    });
  }

  /* ---------- Reading progress ---------- */
  function readProgress() {
    var bar = el('div', 'fx-progress');
    document.body.appendChild(bar);
    onScroll(function () {
      var total = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (total > 0 ? clamp(scrollY / total, 0, 1) : 0).toFixed(4) + ')';
    });
  }

  /* ---------- Reading spotlight ---------- */
  function textFocus() {
    var items = document.querySelectorAll('.v2 .case-section h2, .v2 .case-section p, .v2 .case-section figcaption');
    onScroll(function () {
      var top = innerHeight * 0.25, bottom = innerHeight * 0.7;
      items.forEach(function (n) {
        var r = n.getBoundingClientRect();
        n.classList.toggle('is-focus', r.bottom > top && r.top < bottom);
      });
    });
  }

  /* ---------- Numbers get marked ---------- */
  function statMarker() {
    var RE = /(\d{1,3}(?:,\d{3})+|\d+%|\d+-hour|48 to 72 hours)/g;
    var targets = document.querySelectorAll('.v2 .case-sub, .v2 .case-section .prose p');
    var marks = [];
    targets.forEach(function (p) {
      var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (t) {
        var text = t.nodeValue, last = 0, m, frag = document.createDocumentFragment(), hit = false;
        RE.lastIndex = 0;
        while ((m = RE.exec(text))) {
          hit = true;
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          var mk = el('mark', 'fx-mark', m[0]);
          frag.appendChild(mk);
          marks.push(mk);
          last = m.index + m[0].length;
        }
        if (!hit) return;
        frag.appendChild(document.createTextNode(text.slice(last)));
        t.parentNode.replaceChild(frag, t);
      });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.transitionDelay = '150ms';
        e.target.classList.add('is-on');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -20% 0px' });
    marks.forEach(function (m) { io.observe(m); });
  }

  /* ---------- Hero settles away ---------- */
  function heroParallax() {
    var img = document.querySelector('.v2-hero img');
    if (!img || reduce) return;
    onScroll(function () {
      var r = img.parentNode.getBoundingClientRect();
      var p = clamp((72 - r.top) / r.height, 0, 1);
      img.style.transform = p ? 'scale(' + (1 + p * 0.08).toFixed(4) + ')' : '';
      img.style.opacity = p ? (1 - p * 0.6).toFixed(3) : '';
    });
  }

  /* ---------- Images rise in / dissolve in ---------- */
  function imgReveal() {
    if (reduce) return;
    var shots = document.querySelectorAll('.v2 .case-body .shot');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    shots.forEach(function (s) { s.classList.add('fx-img'); io.observe(s); });
  }

  function imgPixel() {
    if (reduce) return;
    var shots = document.querySelectorAll('.v2 .case-body .shot, .v2 .v2-hero');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var cover = e.target.querySelector('.fx-cover');
        var cells = cover.children;
        Array.prototype.forEach.call(cells, function (c) {
          c.style.transitionDelay = Math.round(Math.random() * 600) + 'ms';
          c.style.opacity = 0;
        });
        setTimeout(function () { cover.remove(); }, 900);
      });
    }, { rootMargin: '0px 0px -15% 0px' });
    shots.forEach(function (s) {
      var r = s.getBoundingClientRect();
      var cols = 16, rows = clamp(Math.round(cols * r.height / r.width), 3, 40);
      var cover = el('div', 'fx-cover');
      cover.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      cover.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
      for (var i = 0; i < cols * rows; i++) cover.appendChild(el('span'));
      s.appendChild(cover);
      io.observe(s);
    });
  }

  /* ---------- Click to enlarge ---------- */
  function lightbox() {
    var box = null;
    function close() {
      if (!box) return;
      var b = box;
      box = null;
      b.classList.remove('is-open');
      setTimeout(function () { b.remove(); }, 260);
      removeEventListener('scroll', close);
    }
    document.querySelectorAll('.v2 .shot').forEach(function (s) {
      s.addEventListener('click', function () {
        var src = s.querySelector('img');
        box = el('div', 'fx-lightbox');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', src.alt);
        var img = el('img');
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        box.appendChild(img);
        box.addEventListener('click', close);
        document.body.appendChild(box);
        requestAnimationFrame(function () { box && box.classList.add('is-open'); });
        setTimeout(function () { addEventListener('scroll', close, { passive: true, once: true }); }, 300);
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  ready(function () {
    sections = Array.prototype.slice.call(document.querySelectorAll('[data-toc]'));
    badge();
    if (has('toc-list')) toc('list');
    if (has('toc-numbered')) toc('numbered');
    if (has('toc-ticks')) toc('ticks');
    if (has('toc-rail')) rail();
    if (has('toc-crumb')) crumb();
    if (has('toc-pill')) pill();
    if (has('read-progress')) readProgress();
    if (has('text-focus')) textFocus();
    if (has('stat-marker')) statMarker();
    if (has('hero-parallax')) heroParallax();
    if (has('img-reveal')) imgReveal();
    if (has('img-pixel')) imgPixel();
    if (has('img-lightbox')) lightbox();
  });
})();
