/* Learn case study (learn.html), alongside the lab set the page loads (side
   rail, ↑/↓ sections, hero parallax, image reveal, lightbox): snap to beats,
   text that fills as you read, numbered headings with number keys, a ⌘K
   palette and the heading relay in the top bar.

   Keys stay as the site has them: ↑/↓ (and j/k) step sections, space is the
   lab's smart space, ← goes home. This adds 1–6 / 0 and ⌘K or /. Snapping is
   scroll-only: keys of its own would fight those. */
(function () {
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOP = 52; // fixed top bar
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // the same post-it colour as the lab's (case-fx.js), when it picked one first
  var POSTITS = ['#ffff99', '#ffeba1', '#fee63b', '#ffad64', '#d2de40',
                 '#37d2d8', '#f83aa7', '#fff9a5', '#f9b8bc', '#b0cdeb'];
  if (!root.style.getPropertyValue('--accent')) {
    var accent = null;
    try { accent = sessionStorage.getItem('accent'); } catch (e) {}
    root.style.setProperty('--accent', accent || POSTITS[Math.floor(Math.random() * POSTITS.length)]);
  }

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
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function typing(e) { return e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'); }
  function plain(e) { return !(e.metaKey || e.ctrlKey || e.altKey); }

  var sections = [];
  function label(s) { return s.dataset.toc || ''; }
  // a section's heading as text, without the 01–06 numbers added below
  function heading(s) {
    var c = s.querySelector('h2').cloneNode(true);
    c.querySelectorAll('.learn-num').forEach(function (n) { n.remove(); });
    return c.textContent.trim();
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

  /* ---------- Snapping, paused while the page scrolls itself ----------
     The lab's ↑/↓ and the rail scroll frame by frame; a snap point under one
     of those frames would grab the page mid-glide. So snapping steps aside for
     any key or click that moves the page, and comes back once it has settled. */
  var snapTimer = null;
  function pauseSnap() {
    root.classList.add('learn-snap-off');
    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () { root.classList.remove('learn-snap-off'); }, 900);
  }
  function scrollToY(y) {
    pauseSnap();
    scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
  }
  function goTo(n, block) {
    var r = n.getBoundingClientRect();
    scrollToY(block === 'center' ? r.top + scrollY - (innerHeight - n.offsetHeight) / 2 : r.top + scrollY - TOP - 20);
  }
  function flash(n) {
    n.classList.remove('learn-flash');
    void n.offsetWidth;
    n.classList.add('learn-flash');
    setTimeout(function () { n.classList.remove('learn-flash'); }, 1400);
  }

  function snapBeats() {
    root.classList.add('learn-snap');
    document.querySelector('.case-head').classList.add('learn-snap-start');
    sections.forEach(function (s) {
      s.querySelector('h2').classList.add('learn-snap-start');
      var pr = s.querySelector('.prose');
      if (pr) pr.classList.add('learn-snap-start');
      s.querySelectorAll('figure').forEach(function (f) { f.classList.add('learn-snap-center'); });
    });
    addEventListener('keydown', function (e) {
      if (/^(Arrow|Page|Home|End| |[0-9jk/]$)/.test(e.key)) pauseSnap();
    }, true);
    document.addEventListener('click', function (e) {
      if (e.target.closest('.fx-rail a, .learn-relay button, .learn-cmdk-item')) pauseSnap();
    }, true);
  }

  /* ---------- Text fills as you read ---------- */
  function textFill() {
    var paras = [];
    document.querySelectorAll('.case-section .prose > p').forEach(function (p) {
      var words = [];
      var walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      var texts = [];
      while (walk.nextNode()) texts.push(walk.currentNode);
      texts.forEach(function (t) {
        var frag = document.createDocumentFragment();
        t.textContent.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          var s = el('span', 'learn-word', w);
          words.push(s);
          frag.appendChild(s);
        });
        t.parentNode.replaceChild(frag, t);
      });
      paras.push({ p: p, words: words, state: null });
    });
    root.classList.add('learn-fill');
    onScroll(function () {
      var line = innerHeight * 0.72;
      paras.forEach(function (o) {
        var r = o.p.getBoundingClientRect();
        // off screen: all lit above, all faint below; only touch them once
        if (r.top > innerHeight || r.bottom < 0) {
          var all = r.bottom < 0;
          if (o.state === all) return;
          o.state = all;
          o.words.forEach(function (w) { w.classList.toggle('is-lit', all); });
          return;
        }
        o.state = null;
        var n = Math.round(clamp((line - r.top) / Math.max(1, r.height), 0, 1) * o.words.length);
        o.words.forEach(function (w, k) { w.classList.toggle('is-lit', k < n); });
      });
    });
  }

  /* ---------- Numbered headings, number keys ---------- */
  function numberKeys() {
    sections.forEach(function (s, i) {
      var h = s.querySelector('h2');
      h.classList.add('learn-numbered');
      h.insertBefore(el('span', 'learn-num', pad(i + 1)), h.firstChild);
    });
    addEventListener('keydown', function (e) {
      if (e.defaultPrevented || typing(e) || !plain(e)) return;
      if (document.querySelector('.fx-lightbox')) return;
      if (e.key === '0') { e.preventDefault(); scrollToY(0); return; }
      var n = /^[1-9]$/.test(e.key) ? +e.key : 0;
      if (!n || n > sections.length) return;
      e.preventDefault();
      goTo(sections[n - 1]);
      flash(sections[n - 1].querySelector('h2'));
    });
  }

  /* ---------- Command palette ---------- */
  function cmdk() {
    var dlg = el('dialog', 'learn-cmdk');
    var input = el('input', 'learn-cmdk-input');
    input.type = 'search';
    input.placeholder = 'Jump to a section or search the text';
    input.setAttribute('aria-label', 'Search the case study');
    var list = el('ul', 'learn-cmdk-list');
    list.setAttribute('role', 'listbox');
    dlg.append(input, list);
    document.body.appendChild(dlg);
    var paras = [].slice.call(document.querySelectorAll('.case-head .case-sub, .case-section .prose > p, .case-section figcaption'));
    var results = [], sel = 0, MAX = 12;
    function render() {
      var q = input.value.trim().toLowerCase();
      results = [];
      sections.forEach(function (s, i) {
        if (!q || heading(s).toLowerCase().indexOf(q) > -1)
          results.push({ kind: 'section', n: s, title: pad(i + 1) + '  ' + heading(s) });
      });
      if (q.length > 1) paras.forEach(function (p) {
        var t = p.textContent, k = t.toLowerCase().indexOf(q);
        if (k < 0) return;
        var a = Math.max(0, k - 28), b = Math.min(t.length, k + q.length + 40);
        var sec = p.closest('.case-section');
        results.push({ kind: 'text', n: p, where: sec ? label(sec) : 'Intro',
          pre: (a ? '…' : '') + t.slice(a, k), hit: t.slice(k, k + q.length), post: t.slice(k + q.length, b) + (b < t.length ? '…' : '') });
      });
      list.replaceChildren();
      results.slice(0, MAX).forEach(function (r, i) {
        var li = el('li', 'learn-cmdk-item');
        li.setAttribute('role', 'option');
        if (r.kind === 'section') li.textContent = r.title;
        else {
          li.appendChild(el('span', 'learn-cmdk-where', r.where.toLowerCase()));
          var tx = el('span', 'learn-cmdk-text');
          tx.append(document.createTextNode(r.pre), el('mark', null, r.hit), document.createTextNode(r.post));
          li.appendChild(tx);
        }
        li.addEventListener('click', function () { go(i); });
        li.addEventListener('mousemove', function () { if (sel !== i) { sel = i; mark(); } });
        list.appendChild(li);
      });
      if (!results.length) list.appendChild(el('li', 'learn-cmdk-empty', 'Nothing here says that.'));
      sel = 0;
      mark();
    }
    function mark() {
      [].slice.call(list.children).forEach(function (li, i) { li.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
      var li = list.children[sel];
      if (li) li.scrollIntoView({ block: 'nearest' });
    }
    function go(i) {
      var r = results[i];
      if (!r) return;
      dlg.close();
      if (r.kind === 'section') { goTo(r.n); flash(r.n.querySelector('h2')); }
      else { goTo(r.n, 'center'); flash(r.n); }
    }
    function open() { input.value = ''; render(); dlg.showModal(); input.focus(); }
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, Math.min(results.length, MAX) - 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') { go(sel); e.preventDefault(); }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    // capture, so the lab's keys (j/k, ←) never see a key meant for the palette
    addEventListener('keydown', function (e) {
      if (dlg.open || typing(e)) return;
      var hit = ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) || (e.key === '/' && plain(e));
      if (!hit) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      open();
    }, true);
    var chip = el('button', 'learn-cmdk-chip');
    chip.type = 'button';
    // phones and tablets have no ⌘ or ctrl to press: just "search" there
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var kbd = el('kbd', null, (/Mac/.test(navigator.platform) ? '⌘' : 'ctrl ') + 'K');
      chip.append(kbd, document.createTextNode(' search'));
    } else chip.textContent = 'search';
    chip.addEventListener('click', open);
    document.body.appendChild(chip);
  }

  /* ---------- Heading relay, in the top bar ----------
     Between back and the text size buttons: a chip per section passed and the
     current heading. A heading counts once it reaches the bar, so a jump that
     lands just below the bar already names the section you landed on. */
  function relay() {
    var bar = document.querySelector('.topbar');
    if (!bar) return;
    var strip = el('div', 'learn-relay');
    var chips = el('div', 'learn-relay-chips');
    var now = el('button', 'learn-relay-now');
    now.type = 'button';
    now.title = 'Back to the start of this section';
    strip.append(chips, now);
    bar.insertBefore(strip, bar.querySelector('.topbar-tools'));
    var cur = -2;
    var bs = sections.map(function (s, i) {
      var b = el('button', 'learn-relay-chip', pad(i + 1));
      b.type = 'button';
      b.title = heading(s);
      b.addEventListener('click', function () { goTo(s); });
      chips.appendChild(b);
      return b;
    });
    now.addEventListener('click', function () { if (cur >= 0) goTo(sections[cur]); });
    onScroll(function () {
      var i = -1;
      sections.forEach(function (s, k) { if (s.querySelector('h2').getBoundingClientRect().top < TOP + 48) i = k; });
      if (i === cur) return;
      var down = i > cur;
      cur = i;
      strip.classList.toggle('is-on', i >= 0);
      bs.forEach(function (b, k) { b.hidden = k > i; b.classList.toggle('is-cur', k === i); });
      if (i < 0) return;
      now.textContent = heading(sections[i]);
      now.classList.remove('is-in-down', 'is-in-up');
      void now.offsetWidth;
      now.classList.add(down ? 'is-in-down' : 'is-in-up');
    });
  }

  ready(function () {
    sections = [].slice.call(document.querySelectorAll('.case-body > .case-section'));
    if (!sections.length) return;
    numberKeys();   // first: the others read headings without its numbers
    snapBeats();
    textFill();
    cmdk();
    relay();
  });
})();
