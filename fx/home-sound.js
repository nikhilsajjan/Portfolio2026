/* Home (index.html): a real split-flap board, quietly, while the grid falls
   in on load: the end of one of its runs (assets/sound/split-flap.mp3, cut
   from "Split Flap Display" by ngruber on Freesound, CC0 / public domain).
   It plays from the point where what's left of the run is as long as the
   fall, so the board stops as the last dot lands (fx/home-play.js), and it
   fades in so it never starts with a jolt. Browsers hold sound back until
   the visitor has touched the page: if it's held back, the first tap, click
   or key during the fall lets the rest play (fading in again). */
(function () {
  var root = document.documentElement;
  var grid = document.getElementById('dots');
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!grid || !AC || !root.classList.contains('hm-loading')) return;

  var CLIP = 'assets/sound/split-flap.mp3';
  var STOP = 3.8; // s: the board's last flip in the clip
  var LAND = 0.17; // s: the first of the two steps in hm-cell (340ms)
  var VOLUME = 0.3;
  var FADE = 0.6; // s

  var ctx, buffer, start, end, played = false;
  try { ctx = new AC(); } catch (e) { return; }

  // fetched straight away, so it's ready by the time the grid falls
  var ready = fetch(CLIP)
    .then(function (r) { return r.arrayBuffer(); })
    .then(function (data) {
      return new Promise(function (ok, no) { ctx.decodeAudioData(data, ok, no); });
    })
    .then(function (b) { buffer = b; });

  // from wherever the fall has got to: the clip's stop lands on the last dot
  function play() {
    if (played || !buffer || start == null || ctx.state !== 'running') return;
    var now = (performance.now() - start) / 1000;
    var from = STOP - (end - now); // where in the clip "now" is
    if (end - now < 0.2) return; // too late to be worth it
    played = true;
    var wait = Math.max(0, -from);
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var g = ctx.createGain();
    var at = ctx.currentTime + 0.02 + wait;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(VOLUME, at + FADE);
    src.connect(g).connect(ctx.destination);
    src.start(at, Math.max(0, from));
  }

  function unlock() {
    removeEventListener('pointerdown', unlock, true);
    removeEventListener('keydown', unlock, true);
    if (ctx.state !== 'running') ctx.resume().then(play, function () {});
  }

  // fx/home-play.js swaps hm-loading for hm-loaded when the fall starts
  new MutationObserver(function (m, obs) {
    if (!root.classList.contains('hm-loaded')) return;
    obs.disconnect();
    start = performance.now();
    var last = 0;
    [].forEach.call(grid.children, function (n) {
      var l = parseFloat(n.style.getPropertyValue('--hm-l'));
      if (!isNaN(l)) last = Math.max(last, l);
    });
    end = last / 1000 + LAND;
    ready.then(play, function () {});
    if (ctx.state !== 'running') {
      ctx.resume().then(play, function () {});
      addEventListener('pointerdown', unlock, true);
      addEventListener('keydown', unlock, true);
      // the fall is over: nothing left to unlock for
      setTimeout(unlock, end * 1000 + 300);
    }
  }).observe(root, { attributes: true, attributeFilter: ['class'] });
})();
