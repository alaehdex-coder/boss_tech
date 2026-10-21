/* =========================================================
   BOSS — scroll choreography (GSAP + ScrollTrigger)

   Story:  LOGO → RINGS → PARTICLES → SYSTEM → MODULES →
           DASHBOARD → OWNER → ECOSYSTEM → PARTICLES → RINGS → LOGO

   Every section is a pinned, scrubbed timeline whose positions
   run 0 → 1, so the numbers below read as "fraction of the
   section's scroll distance". The same section ScrollTriggers
   feed the WebGL keyframes (see SCENE_KEYS).
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var root = document.documentElement;

  var ORDER = ['hero', 'welcome', 'what', 'modules', 'functions', 'dashboard', 'how', 'owner', 'ecosystem', 'final', 'demo'];
  var sts = {};   // section key -> ScrollTrigger (pin or plain)

  /* WebGL states per section position (missing keys carry forward). */
  var SCENE_KEYS = [
    ['hero', 0,       { camZ: 12, ringOp: 0, ringScale: .95, ringSize: 1.3, morph: 0, partOp: .4, streak: 0, tunnel: 0, wires: 0 }],
    ['hero', .38,     { camZ: 9, ringOp: .6, ringScale: 1.3, morph: .15, partOp: .85, streak: .15, tunnel: .2, wires: .15 }],
    ['hero', .72,     { camZ: 0, ringOp: .55, ringScale: 2.3, morph: .75, partOp: .95, streak: .85, tunnel: .85, wires: .9 }],
    ['hero', 1,       { camZ: -24, ringOp: 0, ringScale: 3, morph: 1, partOp: .9, streak: 1, tunnel: 1, wires: 1 }],
    ['welcome', .25,  { camZ: -34, streak: .2, tunnel: .3, partOp: .65, wires: .8 }],
    ['welcome', 1,    { camZ: -40, streak: .08, tunnel: .12, partOp: .5, wires: .55 }],
    ['what', 1,       { camZ: -48, streak: .04, tunnel: .06, partOp: .4, wires: .35 }],
    ['modules', 1,    { camZ: -56, streak: .02, tunnel: 0, partOp: .32, wires: .3 }],
    ['dashboard', 1,  { camZ: -62, partOp: .26, wires: .2 }],
    ['owner', .05,    { camZ: -64, partOp: .06, streak: 0, wires: 0 }],
    ['owner', .95,    { camZ: -67, partOp: .05 }],
    ['ecosystem', .1, { camZ: -70, partOp: .42, streak: .06, wires: .45 }],
    ['ecosystem', .9, { camZ: -74, partOp: .5, streak: .1, wires: .5 }],
    // the reverse journey: field → particles → rings, back out to the logo
    ['final', 0,      { camZ: -74, morph: 1, ringOp: 0, ringScale: 3, ringSize: .78, streak: .2, tunnel: .3, partOp: .6, wires: .8 }],
    ['final', .4,     { camZ: -12, morph: .65, ringOp: .25, ringScale: 2.1, streak: 1, tunnel: 1, partOp: .9, wires: 1 }],
    ['final', .75,    { camZ: 11, morph: 0, ringOp: .75, ringScale: 1.02, streak: .08, tunnel: 0, partOp: .75, wires: .1 }],
    ['final', 1,      { camZ: 12, morph: 0, ringOp: .4, ringScale: 1, streak: 0, partOp: .5, wires: 0 }],
    // leaving the logo for the demo form: the halo rings dissolve back into the particle field
    ['demo', 0,       { ringOp: 0, morph: 1, partOp: .35, wires: .15 }]
  ];

  function resolveSceneKeys() {
    // the closing logo sits above its tagline and is smaller than the hero logo:
    // measure it so the WebGL rings re-form exactly around it
    var fl = $('#finalLogo'), hl = $('#heroLogo');
    var finalFit = {
      ringY: -((fl.offsetTop + fl.offsetHeight / 2) - innerHeight / 2) / (innerHeight / 2),
      ringSize: 1.25 * fl.offsetWidth / (hl.offsetWidth || fl.offsetWidth)
    };
    return SCENE_KEYS.filter(function (k) { return sts[k[0]]; }).map(function (k) {
      var st = sts[k[0]];
      return { y: st.start + k[1] * (st.end - st.start), s: k[0] === 'final' ? Object.assign({}, k[2], finalFit) : k[2] };
    });
  }

  /* ---------------- text splitting ---------------- */
  function splitChars(el) {
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(/\s+/).forEach(function (word, i, arr) {
      var w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      Array.from(word).forEach(function (c) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        w.appendChild(s);
      });
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  function splitWords(el) {
    var text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(/\s+/).forEach(function (word, i, arr) {
      var m = document.createElement('span');
      m.className = 'wm';
      m.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span');
      inner.className = 'wi';
      inner.textContent = word;
      m.appendChild(inner);
      el.appendChild(m);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }
  $$('[data-split="chars"]').forEach(splitChars);
  $$('[data-split="words"]').forEach(splitWords);

  /* ---------------- counters ---------------- */
  function fmtCount(el, v) {
    var n = Math.round(v);
    var s = el.dataset.pad ? String(n).padStart(+el.dataset.pad, '0') : n.toLocaleString('en-US');
    el.textContent = (el.dataset.prefix || '') + s + (el.dataset.suffix || '');
  }
  function addCounters(tl, els, at, dur) {
    els.forEach(function (el) {
      var o = { v: 0 }, end = parseFloat(el.dataset.count);
      fmtCount(el, 0);
      tl.fromTo(o, { v: 0 }, { v: end, duration: dur, ease: 'power1.out', onUpdate: function () { fmtCount(el, o.v); } }, at);
    });
  }
  function resetCounters() {
    $$('[data-count]').forEach(function (el) { fmtCount(el, parseFloat(el.dataset.count)); });
  }

  /* =========================================================
     DASHBOARD CHARTS (built once; animated later)
     Single gold series per chart → no legend, title names it.
     ========================================================= */
  var tip = $('.dash-tip');
  var dashEl = $('.dash-stage > .dash');   // not just '.dash': the orbit SVG has a circle with that class too

  function showTip(clientX, clientY, html) {
    if (!tip || !dashEl) return;
    var r = dashEl.getBoundingClientRect();
    var s = r.width / dashEl.offsetWidth || 1;           // the dashboard may be scaled
    tip.innerHTML = html;
    tip.style.left = ((clientX - r.left) / s) + 'px';
    tip.style.top = ((clientY - r.top) / s) + 'px';
    tip.classList.add('is-on');
  }
  function hideTip() { if (tip) tip.classList.remove('is-on'); }

  function smoothPath(p) {
    var d = 'M' + p[0][0].toFixed(1) + ',' + p[0][1].toFixed(1);
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ',' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
           ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ',' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
           ' ' + p2[0].toFixed(1) + ',' + p2[1].toFixed(1);
    }
    return d;
  }

  function buildSalesChart() {
    var svg = $('#salesChart');
    if (!svg) return;
    var small = innerWidth < 600;                       // phones get a narrower canvas so text stays readable
    var W = small ? 380 : 720, H = small ? 230 : 240, m = { l: 52, r: small ? 54 : 56, t: 16, b: 28 };
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var data = [720, 760, 690, 810, 845, 900, 880, 960, 1010, 1080, 1140, 1250];   // ₱ thousands (demo)
    var months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    var years = ['2025', '2025', '2026', '2026', '2026', '2026', '2026', '2026', '2026', '2026', '2026', '2026'];
    var yMin = 500, yMax = 1300;
    var step = (W - m.l - m.r) / (data.length - 1);
    var x = function (i) { return m.l + i * step; };
    var y = function (v) { return m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b); };
    var peso = function (v) { return v >= 1000 ? '₱' + (v / 1000).toFixed(2).replace(/0$/, '') + 'M' : '₱' + v + 'K'; };

    var out = '<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#e9b632" stop-opacity=".26"/><stop offset="1" stop-color="#e9b632" stop-opacity="0"/></linearGradient></defs>';
    [600, 800, 1000, 1200].forEach(function (v) {
      out += '<line class="g" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
             '<text class="ax" x="' + (m.l - 10) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + peso(v) + '</text>';
    });
    out += '<line class="base" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '"/>';
    months.forEach(function (mo, i) {
      if (small && i % 2) return;
      out += '<text class="ax" x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + mo + '</text>';
    });
    var pts = data.map(function (v, i) { return [x(i), y(v)]; });
    var line = smoothPath(pts);
    var last = pts[pts.length - 1];
    out += '<path class="area" fill="url(#gArea)" d="' + line + ' L' + last[0] + ',' + (H - m.b) + ' L' + m.l + ',' + (H - m.b) + ' Z"/>';
    out += '<path class="line" pathLength="1" d="' + line + '"/>';
    out += '<circle class="endpt" r="5" cx="' + last[0] + '" cy="' + last[1] + '"/>';
    out += '<text class="endlbl" x="' + (last[0] + 10) + '" y="' + (last[1] + 4) + '">₱1.25M</text>';
    out += '<g class="hover"><line class="xh" y1="' + m.t + '" y2="' + (H - m.b) + '"/><circle class="hdot" r="5"/></g>';
    out += '<rect class="hit" x="' + (m.l - step / 2) + '" y="0" width="' + (W - m.l - m.r + step) + '" height="' + H + '"/>';
    svg.innerHTML = out;

    var xh = $('.xh', svg), hdot = $('.hdot', svg);
    svg.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      var sx = (e.clientX - r.left) / r.width * W;
      var i = clamp(Math.round((sx - m.l) / step), 0, data.length - 1);
      xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i));
      hdot.setAttribute('cx', x(i)); hdot.setAttribute('cy', y(data[i]));
      svg.classList.add('is-hover');
      var dot = hdot.getBoundingClientRect();
      showTip(dot.left + dot.width / 2, dot.top, '<b>₱' + (data[i] * 1000).toLocaleString('en-US') + '</b>' + months[i] + ' ' + years[i]);
    });
    svg.addEventListener('pointerleave', function () { svg.classList.remove('is-hover'); hideTip(); });
  }

  function buildSpark() {
    var svg = $('#sparkSales');
    if (!svg) return;
    var d = [720, 760, 690, 810, 845, 900, 880, 960, 1010, 1080, 1140, 1250];
    var pts = d.map(function (v, i) { return [i * (120 / 11), 32 - (v - 650) / 620 * 30]; });
    svg.innerHTML = '<path pathLength="1" d="' + smoothPath(pts) + '"/>';
  }

  function buildProdChart() {
    var svg = $('#prodChart');
    if (!svg) return;
    var W = 360, H = 190, m = { l: 8, r: 8, t: 22, b: 24 };
    var data = [420, 465, 440, 510, 530, 498, 560, 590];    // units (demo)
    var max = 700, n = data.length;
    var slot = (W - m.l - m.r) / n, bw = slot - 10;            // ≥2px gap between bars
    var y = function (v) { return m.t + (1 - v / max) * (H - m.t - m.b); };
    var out = '';
    [200, 400, 600].forEach(function (v) { out += '<line class="g" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>'; });
    data.forEach(function (v, i) {
      var bx = m.l + i * slot + 5, by = y(v), bh = H - m.b - by, r = 4;
      out += '<path class="bar" data-i="' + i + '" d="M' + bx + ',' + (by + bh) + ' V' + (by + r) + ' Q' + bx + ',' + by + ' ' + (bx + r) + ',' + by +
             ' H' + (bx + bw - r) + ' Q' + (bx + bw) + ',' + by + ' ' + (bx + bw) + ',' + (by + r) + ' V' + (by + bh) + ' Z"/>';
      out += '<text class="ax" x="' + (bx + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">W' + (i + 1) + '</text>';
      out += '<rect class="hit" data-i="' + i + '" x="' + (m.l + i * slot) + '" y="' + m.t + '" width="' + slot + '" height="' + (H - m.t - m.b) + '" fill="transparent"/>';
    });
    var lx = m.l + (n - 1) * slot + 5 + bw / 2;
    out += '<text class="vlbl" x="' + lx + '" y="' + (y(data[n - 1]) - 8) + '" text-anchor="middle">590</text>';
    out += '<line class="base" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '"/>';
    svg.innerHTML = out;

    var bars = $$('.bar', svg);
    $$('.hit', svg).forEach(function (h) {
      var i = +h.dataset.i;
      h.addEventListener('pointerenter', function () {
        bars.forEach(function (b, j) { b.classList.toggle('is-hot', j === i); });
        var r = bars[i].getBoundingClientRect();
        showTip(r.left + r.width / 2, r.top, '<b>' + data[i] + ' units</b>Week ' + (i + 1));
      });
      h.addEventListener('pointerleave', function () { bars[i].classList.remove('is-hot'); hideTip(); });
    });
  }

  buildSalesChart();
  buildSpark();
  buildProdChart();

  /* dashboard is designed at 1280×760 and scaled to fit on desktop */
  var stage = $('.dash-stage');
  function fitDashboard() {
    if (!dashEl || !stage) return;
    if (innerWidth < 900) {
      dashEl.style.removeProperty('--s');
      stage.style.width = stage.style.height = '';
      return;
    }
    // leave room for the circuit rail on the right and the nav on top, so the frame never touches either
    var s = Math.min((innerWidth - 220) / 1280, (innerHeight - 170) / 760, 1.05);
    dashEl.style.setProperty('--s', s.toFixed(4));
    stage.style.width = (1280 * s) + 'px';
    stage.style.height = (760 * s) + 'px';
  }
  fitDashboard();
  addEventListener('resize', fitDashboard);

  /* =========================================================
     ECOSYSTEM NETWORK (SVG, drawn per frame while visible)
     ========================================================= */
  function createEcosystem(svg) {
    var noop = { render: function () {}, setLayout: function () {}, start: function () {}, stop: function () {}, setVelocity: function () {} };
    if (!svg) return noop;
    var NS = 'http://www.w3.org/2000/svg';
    var names = ['SALES', 'REPORTS', 'MANAGEMENT', 'PRODUCTION', 'PURCHASING', 'INVENTORY'];
    var W = 1000, H = 700, mobile = false, p = 1, time = 0, running = false, last = 0, velocity = 0;

    function mk(tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    }

    svg.innerHTML = '';
    var gLinks = mk('g', {}, svg), gRing = mk('g', {}, svg), gParts = mk('g', {}, svg), gHub = mk('g', {}, svg), gNodes = mk('g', {}, svg);

    mk('circle', { r: 128, class: 'hub-bg' }, gHub);
    var hubRings = [mk('circle', { r: 124, class: 'hub-r1' }, gHub), mk('circle', { r: 106, class: 'hub-r2' }, gHub), mk('circle', { r: 92, class: 'hub-r3' }, gHub)];
    var img = mk('image', { href: 'assets/boss-logo.png', x: -84, y: -84, width: 168, height: 168, preserveAspectRatio: 'xMidYMid meet' }, gHub);
    img.style.mixBlendMode = 'screen';
    img.addEventListener('error', function () { img.setAttribute('href', 'assets/boss-logo.svg'); }, { once: true });

    var nodes = names.map(function (n, i) {
      var g = mk('g', { class: 'eco-node' }, gNodes);
      mk('circle', { r: 64, class: 'halo' }, g);
      mk('circle', { r: 40, class: 'ring' }, g);
      mk('text', { class: 'idx', y: 5, 'text-anchor': 'middle' }, g).textContent = String(i + 1).padStart(2, '0');
      mk('text', { class: 'label', y: 70, 'text-anchor': 'middle' }, g).textContent = n;
      return {
        g: g,
        spoke: mk('line', { class: 'spoke' }, gLinks),
        rlink: mk('line', { class: 'rlink' }, gRing),
        angle: -Math.PI / 2 + i * Math.PI / 3,
        x: 0, y: 0
      };
    });

    // data flows from every module into BOSS, and around the ring between modules
    var parts = [];
    nodes.forEach(function (n, i) {
      for (var k = 0; k < 3; k++) parts.push({ ring: false, i: i, t: k / 3 + Math.random() * .1, sp: .22 + Math.random() * .12, el: mk('circle', { r: 7, class: 'pt' }, gParts) });
      parts.push({ ring: true, i: i, t: Math.random(), sp: .1 + Math.random() * .06, el: mk('circle', { r: 5, class: 'pt' }, gParts) });
    });

    function setLine(l, x1, y1, x2, y2) {
      l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1));
      l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
    }
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

    function draw(dt) {
      var cx = W / 2, cy = H / 2;
      var rx = mobile ? W * .36 : W * .33, ry = mobile ? H * .34 : H * .37;
      var spread = ease(clamp(p / .5, 0, 1));
      var ringA = clamp((p - .35) / .25, 0, 1);
      var partA = clamp((p - .25) / .2, 0, 1);
      var hubS = (mobile ? .82 : 1) * (.55 + .45 * ease(clamp(p / .3, 0, 1)));
      var nodeS = mobile ? 1.15 : 1;

      gHub.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + hubS.toFixed(3) + ')');
      hubRings.forEach(function (r, i) {
        r.setAttribute('transform', 'rotate(' + ((i % 2 ? -1 : 1) * (p * 140 + time * 6 * (i + 1))).toFixed(2) + ')');
      });

      nodes.forEach(function (n) {
        var a = n.angle + (1 - spread) * .7;
        n.x = cx + Math.cos(a) * rx * spread;
        n.y = cy + Math.sin(a) * ry * spread + Math.sin(time * .8 + n.angle * 3) * 3 * spread;
        n.g.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + ') scale(' + (nodeS * (.4 + .6 * spread)).toFixed(3) + ')');
        n.g.style.opacity = spread.toFixed(3);
        setLine(n.spoke, cx, cy, n.x, n.y);
        n.spoke.style.opacity = (spread * .6).toFixed(3);
      });
      nodes.forEach(function (n, i) {
        var nx = nodes[(i + 1) % nodes.length];
        setLine(n.rlink, n.x, n.y, nx.x, nx.y);
        n.rlink.style.opacity = ringA.toFixed(3);
      });

      var boost = 1 + Math.min(Math.abs(velocity) / 600, 5);
      parts.forEach(function (pt) {
        if (dt) pt.t = (pt.t + dt * pt.sp * boost) % 1;
        var a = nodes[pt.i], b = pt.ring ? nodes[(pt.i + 1) % nodes.length] : { x: cx, y: cy };
        pt.el.setAttribute('cx', (a.x + (b.x - a.x) * pt.t).toFixed(1));
        pt.el.setAttribute('cy', (a.y + (b.y - a.y) * pt.t).toFixed(1));
        pt.el.style.opacity = (Math.sin(Math.PI * pt.t) * partA * (pt.ring ? ringA : 1)).toFixed(3);
      });
    }

    function loop(now) {
      if (!running) return;
      var dt = Math.min(.05, (now - last) / 1000);
      last = now; time += dt;
      velocity *= .92;
      draw(dt);
      requestAnimationFrame(loop);
    }

    return {
      render: function (v) { p = v; if (!running) draw(0); },
      setLayout: function (isMobile) {
        mobile = isMobile; W = isMobile ? 600 : 1000; H = isMobile ? 760 : 700;
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        draw(0);
      },
      setVelocity: function (v) { velocity = v; },
      start: function () { if (running) return; running = true; last = performance.now(); requestAnimationFrame(loop); },
      stop: function () { running = false; }
    };
  }

  var eco = createEcosystem($('#ecoSvg'));
  eco.setLayout(innerWidth < 900);

  /* =========================================================
     REACTOR HUD — the "wiring" around the logo
     steel tunnel rings, a perforated hex plate the logo sits on,
     and two rings of glowing LED segments.
     ========================================================= */
  var SVGNS = 'http://www.w3.org/2000/svg';

  (function hexPattern() {
    var defs = document.getElementById('sharedDefs');
    if (!defs || document.getElementById('pHex')) return;
    var s = .85, w = Math.sqrt(3) * s, h = 3 * s, r = s * .8;
    var hex = function (cx, cy) {
      var pts = [];
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 180 * (60 * k - 90);
        pts.push((cx + r * Math.cos(a)).toFixed(3) + ',' + (cy + r * Math.sin(a)).toFixed(3));
      }
      return '<polygon points="' + pts.join(' ') + '"/>';
    };
    var p = document.createElementNS(SVGNS, 'pattern');
    p.setAttribute('id', 'pHex');
    p.setAttribute('patternUnits', 'userSpaceOnUse');
    p.setAttribute('width', w.toFixed(3));
    p.setAttribute('height', h.toFixed(3));
    p.innerHTML = '<rect width="' + w.toFixed(3) + '" height="' + h.toFixed(3) + '" fill="#252c35"/>' +
      '<g fill="#06080b">' + hex(w / 2, s) + hex(0, 2.5 * s) + hex(w, 2.5 * s) + hex(0, -.5 * s) + hex(w, -.5 * s) + '</g>';
    defs.appendChild(p);
  })();

  function sector(r0, r1, a0, a1) {
    var P = function (r, a) { a = (a - 90) * Math.PI / 180; return (50 + r * Math.cos(a)).toFixed(3) + ' ' + (50 + r * Math.sin(a)).toFixed(3); };
    return 'M' + P(r1, a0) + ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + P(r1, a1) + ' L' + P(r0, a1) + ' A' + r0 + ' ' + r0 + ' 0 0 0 ' + P(r0, a0) + 'Z';
  }
  function segRing(n, r0, r1, gapDeg, blinkEvery) {
    var out = '', step = 360 / n;
    for (var i = 0; i < n; i++) {
      var blink = blinkEvery && i % blinkEvery === 3 ? ' blink' : '';
      out += '<path class="seg' + blink + '" style="animation-delay:' + (i * .37 % 3).toFixed(2) + 's" d="' + sector(r0, r1, i * step + gapDeg / 2, (i + 1) * step - gapDeg / 2) + '"/>';
    }
    return out;
  }
  function hudSvg(cls, inner) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'hud ' + cls);
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = inner;
    return s;
  }

  function buildHud(logo) {
    if (!logo || $('.hud', logo)) return;
    var steel = '<circle class="disc" cx="50" cy="50" r="50"/>';
    [[49, .5], [46, 1.6], [43.5, .35], [40.5, 2.4], [37, .4], [34.5, 1.3], [31, .6], [28.5, 2]].forEach(function (c) {
      steel += '<circle cx="50" cy="50" r="' + c[0] + '" stroke-width="' + c[1] + '"/>';
    });
    var inner = '<g class="spin spin--rev">' + segRing(64, 36.9, 38.2, 2.2, 0) + '</g>';
    var outer = '<g class="spin">' + segRing(30, 39.6, 43.6, 3.4, 7) + '</g>' +
      '<circle class="trim" cx="50" cy="50" r="45.4"/>' +
      '<circle class="ticks" cx="50" cy="50" r="47.6"/>';

    // power-on animates the inner .pwr group; scroll animates the outer element — they never share a property
    var meshCanvas = document.createElement('canvas');
    meshCanvas.className = 'hud hud-mesh';
    meshCanvas.setAttribute('aria-hidden', 'true');
    var nodes = [hudSvg('hud-steel', '<g class="pwr">' + steel + '</g>'), meshCanvas, hudSvg('hud-segs-in', inner), hudSvg('hud-segs-out', outer)];
    var first = logo.querySelector('.logo3d__layer');
    nodes.forEach(function (n) { logo.insertBefore(n, first); });
    return createHexPlate(meshCanvas, logo.closest('section'));
  }

  /* =========================================================
     HEX PLATE — every hexagon is its own tile (canvas 2D)
       idle   : rotating scan beam, radial pulse waves, data flicker
       pointer: tiles near the cursor lift and glow gold
       click  : shockwave from the click point
       scroll : state.explode peels tiles off (hero) / flies them back (finale)
       power  : state.power charges the plate from the centre outward
     Coordinates are in the hud's 0–100 viewBox (plate radius 38.6).
     ========================================================= */
  function createHexPlate(canvas, section) {
    var R = 38.6, HR = 1.25, ctx = canvas.getContext('2d');
    var state = { power: 1, explode: 0 };
    var hexes = [], w = Math.sqrt(3) * HR * 1.1, h = 1.5 * HR * 1.1;
    for (var row = -30; row <= 30; row++) {
      for (var col = -30; col <= 30; col++) {
        var x = col * w + (row & 1 ? w / 2 : 0), y = row * h, d = Math.sqrt(x * x + y * y);
        if (d < R - HR * .6) {
          hexes.push({
            x: 50 + x, y: 50 + y, d: d / R, a: Math.atan2(y, x),
            seed: Math.random(), spin: (Math.random() - .5) * 6, fly: 30 + Math.random() * 45, lift: 0
          });
        }
      }
    }
    var corners = [];
    for (var k = 0; k < 6; k++) corners.push([Math.cos(Math.PI / 3 * k + Math.PI / 6), Math.sin(Math.PI / 3 * k + Math.PI / 6)]);

    var px = -999, py = -999, waves = [], time = 0, running = false, last = 0, scale = 1, size = 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      var css = canvas.offsetWidth;
      if (!css) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5), next = Math.round(css * dpr);
      if (next === size) return;
      size = next;
      canvas.width = canvas.height = size;
      scale = size / 100;
    }
    if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); if (!running) draw(0); }).observe(canvas);

    function toLocal(e) {
      var r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100];
    }
    if (!reduced) {
      section.addEventListener('pointermove', function (e) { var p = toLocal(e); px = p[0]; py = p[1]; });
      section.addEventListener('pointerleave', function () { px = py = -999; });
      section.addEventListener('pointerdown', function (e) {
        var p = toLocal(e);
        if (Math.hypot(p[0] - 50, p[1] - 50) < R + 8) waves.push({ x: p[0], y: p[1], t: 0 });
      });
    }

    function draw(dt) {
      if (!size) resize();
      if (!size) return;
      time += dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // At rest (fully powered, not exploding) the unlit plate never changes: blit it from a
      // cached image and only redraw the tiles that are lit this frame (~10–20% of them).
      var steady = state.power >= 1 && state.explode <= 0;
      if (steady) {
        if (!cache.base || cache.size !== size) buildCache();
        ctx.drawImage(cache.base, 0, 0);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      if (!steady) {
        // plate background (the gaps between tiles)
        ctx.beginPath(); ctx.arc(50, 50, R, 0, Math.PI * 2);
        ctx.fillStyle = '#030201'; ctx.fill();
      }

      var beam = time * .9 % (Math.PI * 2);
      var pulseR = (time % 3.4) / 3.4 * 1.5;              // auto radial pulse (in plate radii)
      waves.forEach(function (wv) { wv.t += dt; });
      waves = waves.filter(function (wv) { return wv.t < 1.6; });

      for (var i = 0; i < hexes.length; i++) {
        var hx = hexes[i];
        // power: charge from the centre outward
        var on = Math.min(1, Math.max(0, (state.power * 1.35 - hx.d) / .25));
        if (on <= 0) continue;

        // explode: outer tiles leave first
        var ex = Math.min(1, Math.max(0, (state.explode * 1.5 - (1 - hx.d) * .5 - hx.seed * .2) / .7));
        var ox = Math.cos(hx.a) * hx.fly * ex * ex, oy = Math.sin(hx.a) * hx.fly * ex * ex;

        // light sources
        var da = Math.abs(((hx.a - beam + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        var scan = Math.max(0, 1 - da / .32) * (.35 + .65 * hx.d);
        var pulse = Math.exp(-Math.pow((hx.d - pulseR) * 9, 2)) * .55;
        var flick = hx.seed > .985 && Math.sin(time * 7 + hx.seed * 90) > .3 ? .9 : 0;
        var wave = 0;
        for (var j = 0; j < waves.length; j++) {
          var wv = waves[j], dd = Math.hypot(hx.x - wv.x, hx.y - wv.y) - wv.t * 55;
          wave = Math.max(wave, Math.exp(-dd * dd / 10) * (1 - wv.t / 1.6));
        }
        var near = Math.max(0, 1 - Math.hypot(hx.x - px, hx.y - py) / 9);
        hx.lift += (near - hx.lift) * Math.min(1, dt * 10);

        var red = Math.min(1, scan + pulse + flick + wave);
        var gold = hx.lift;
        if (steady && red < .015 && gold < .015) continue;       // unlit: already in the cached plate
        tile(hx, red, gold, wave, on, ex, ox, oy);
      }
      ctx.globalAlpha = 1;
      if (steady) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(cache.top, 0, 0);
      } else {
        vignette(ctx, state.explode);
      }
    }

    // steel tile with a top-left sheen, tinted by gold light
    function tile(hx, red, gold, wave, on, ex, ox, oy, c2) {
      var g = c2 || ctx;
      var s = (1 - ex * .35) * (1 + gold * .18 + wave * .15) * on;
      var shade = .75 + .25 * (1 - (hx.y - 50 + R) / (2 * R)) - hx.d * .3;
      var r = 38 * shade + red * 205 + gold * 215, gg = 32 * shade + red * 140 + gold * 205, b = 22 * shade + red * 25 + gold * 160;
      g.globalAlpha = (1 - ex) * (.55 + .45 * on);
      g.fillStyle = 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')';
      g.beginPath();
      var rot = hx.spin * ex, cr = Math.cos(rot) * HR * s, sr = Math.sin(rot) * HR * s;
      var cx = hx.x + ox, cy = hx.y + oy;
      for (var c = 0; c < 6; c++) {
        var vx = corners[c][0], vy = corners[c][1];
        var X = cx + vx * cr - vy * sr, Y = cy + vx * sr + vy * cr;
        c ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      g.closePath();
      g.fill();
    }
    // edge vignette + rim
    function vignette(g, explode) {
      var g2 = g.createRadialGradient(50, 50, R * .45, 50, 50, R);
      g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,' + (.8 * (1 - explode)) + ')');
      g.beginPath(); g.arc(50, 50, R, 0, Math.PI * 2); g.fillStyle = g2; g.fill();
      g.lineWidth = .5; g.strokeStyle = 'rgba(110,88,40,' + (1 - explode) + ')'; g.stroke();
    }
    var cache = {};
    function buildCache() {
      var mk = function () { var c = document.createElement('canvas'); c.width = c.height = size; var x = c.getContext('2d'); x.setTransform(scale, 0, 0, scale, 0, 0); return [c, x]; };
      var b = mk(), t = mk();
      b[1].beginPath(); b[1].arc(50, 50, R, 0, Math.PI * 2); b[1].fillStyle = '#030201'; b[1].fill();
      for (var i = 0; i < hexes.length; i++) tile(hexes[i], 0, 0, 0, 1, 0, 0, 0, b[1]);
      b[1].globalAlpha = 1;
      vignette(t[1], 0);
      cache = { base: b[0], top: t[0], size: size };
    }

    function loop(now) {
      if (!running) return;
      draw(Math.min(.05, (now - last) / 1000));
      last = now;
      requestAnimationFrame(loop);
    }

    addEventListener('resize', function () { resize(); if (!running) draw(0); });
    // only animate while its section is on screen
    if ('IntersectionObserver' in window && !reduced) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
        else if (!en[0].isIntersecting) running = false;
      }).observe(section);
    } else {
      requestAnimationFrame(function () { draw(0); });
    }
    return { state: state, redraw: function () { draw(0); } };
  }

  var heroHex = buildHud($('#heroLogo'));
  var finalHex = buildHud($('#finalLogo'));

  /* power-on on page load: segments light up one by one around the ring */
  function powerOn() {
    var logo = $('#heroLogo');
    var t = gsap.timeline({ delay: .15 });
    t.fromTo($('.hud-steel .pwr', logo), { opacity: 0, scale: .82, svgOrigin: '50 50' }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power3.out' }, 0)
      .fromTo(heroHex.state, { power: 0 }, { power: 1, duration: 1.4, ease: 'power1.inOut' }, .2)
      .fromTo($$('.hud-segs-out .seg', logo), { opacity: .05 }, { opacity: 1, duration: .06, stagger: .028 }, .35)
      .fromTo($$('.hud-segs-in .seg', logo), { opacity: .04 }, { opacity: .75, duration: .05, stagger: .012 }, .55)
      .fromTo($$('.logo3d__layer', logo), { filter: 'brightness(0)' }, { filter: 'brightness(1)', duration: 1.1, stagger: .1, ease: 'power2.out' }, .9);
  }

  /* =========================================================
     HEX DISSOLVE — a card breaks into honeycomb cells and vanishes
     (or builds back up) by clipping it to a set of hexagons that
     shrink and drift. Works on glass: the backdrop blur stays intact.

     set(v, dir): v 0 = solid card · 1 = fully gone
                  dir  1 = right edge goes first, -1 = left edge first,
                       0 = bottom first (so building up runs top → bottom)
     Only does work while 0 < v < 1.
     ========================================================= */
  var HEX_UNIT = [];
  for (var hk = 0; hk < 6; hk++) HEX_UNIT.push([Math.cos(Math.PI / 3 * hk - Math.PI / 2), Math.sin(Math.PI / 3 * hk - Math.PI / 2)]);

  function hexDissolve(el, cell) {
    var R = cell || 22, cells = null, w = 0, h = 0, state = 0, lastQ = -1, lastDir = 0;
    function layout() {
      w = el.offsetWidth; h = el.offsetHeight; cells = [];
      var hw = Math.sqrt(3) * R, hh = 1.5 * R;
      for (var row = -1; row * hh < h + R; row++) {
        for (var col = -1; col * hw < w + hw; col++) {
          var x = col * hw + (row & 1 ? hw / 2 : 0), y = row * hh;
          cells.push({ x: x, y: y, nx: clamp(x / w, 0, 1), ny: clamp(y / h, 0, 1), rnd: Math.random() });
        }
      }
    }
    addEventListener('resize', function () { cells = null; lastQ = -1; });
    return {
      set: function (v, dir) {
        if (v <= 0.001) {
          if (state !== 0) { el.style.clipPath = ''; el.style.visibility = ''; el.classList.remove('is-shattering'); state = 0; lastQ = -1; }
          return;
        }
        if (v >= .999) {
          if (state !== 1) { el.style.visibility = 'hidden'; state = 1; lastQ = -1; }
          return;
        }
        // 1/120 steps are visually identical; skipping repeats saves a clip-path repaint per frame
        var q = Math.round(v * 120);
        if (q === lastQ && dir === lastDir && state === .5) return;
        lastQ = q; lastDir = dir;
        if (!cells) layout();
        if (state === 1) el.style.visibility = '';
        if (state !== .5) el.classList.add('is-shattering');
        state = .5;
        v = q / 120;
        var d = '', drift = dir || 0;
        for (var i = 0; i < cells.length; i++) {
          var c = cells[i];
          var order = dir > 0 ? 1 - c.nx : dir < 0 ? c.nx : 1 - c.ny;          // 0 = leaves first
          var k = clamp((v - (order * .62 + c.rnd * .38) * .6) / .4, 0, 1);
          var s = (1 - k) * 1.045 * R;                                       // 1.045: no hairline seams when whole
          if (s < .6) continue;
          var cx = c.x + drift * k * R * 1.4, cy = c.y - k * R * .7;
          d += 'M' + (cx + HEX_UNIT[0][0] * s).toFixed(1) + ' ' + (cy + HEX_UNIT[0][1] * s).toFixed(1);
          for (var j = 1; j < 6; j++) d += 'L' + (cx + HEX_UNIT[j][0] * s).toFixed(1) + ' ' + (cy + HEX_UNIT[j][1] * s).toFixed(1);
          d += 'Z';
        }
        el.style.clipPath = d ? "path('" + d + "')" : 'inset(50%)';
      }
    };
  }
  function clearHex(nodes) {
    nodes.forEach(function (n) { n.style.clipPath = ''; n.style.visibility = ''; });
  }

  /* =========================================================
     FUNCTIONS EXPLORER — content per module.
     Edit this list to match exactly what your BOSS build does.
     ========================================================= */
  var FUNCTIONS = [
    {
      key: 'sales', name: 'Sales',
      summary: 'From the first quotation to the final collection — every customer, agent and peso of revenue in one place.',
      items: [
        ['Quotations & sales orders', 'Create quotations, convert them to orders in one click and track what is still open.'],
        ['Invoicing & delivery receipts', 'Generate invoices and DRs straight from the order, with your prices and terms applied.'],
        ['Customer accounts', 'Credit limits, payment terms, contact details and full purchase history per customer.'],
        ['Agent performance', 'Sales, collections and quota attainment per agent, area and period.'],
        ['Collections & receivables', 'Record payments, apply them to invoices and see aging from current to 90+ days.'],
        ['Price lists & discounts', 'Separate price levels for retail, wholesale and key accounts, with approval for special discounts.']
      ],
      reports: ['Sales by product, customer, agent and area', 'Accounts receivable aging', 'Daily sales & collection summary'],
      users: ['Owner', 'Sales manager', 'Agents', 'Billing & collection']
    },
    {
      key: 'inventory', name: 'Inventory',
      summary: 'Know exactly what you have, where it is and what it is worth — across every warehouse and branch.',
      items: [
        ['Real-time stock levels', 'On-hand, reserved and available quantities update with every sale, receipt and issuance.'],
        ['Multi-warehouse & branches', 'Track stock per location and move it with documented stock transfers.'],
        ['Reorder alerts', 'Set minimum and reorder levels per item and get flagged before you run out.'],
        ['Stock movement history', 'A complete in-and-out ledger per item, so every discrepancy can be traced.'],
        ['Physical counts & adjustments', 'Run cycle or full counts and post variances with a reason and approval.'],
        ['Inventory valuation', 'Know the peso value of stock on hand using your chosen costing method.']
      ],
      reports: ['Stock on hand per location', 'Fast- and slow-moving items', 'Inventory valuation & variance'],
      users: ['Owner', 'Warehouse', 'Inventory controller', 'Branch managers']
    },
    {
      key: 'purchasing', name: 'Purchasing',
      summary: 'Buy the right quantity at the right price, from suppliers you can measure.',
      items: [
        ['Purchase requests', 'Departments request items; managers approve before anything is ordered.'],
        ['Purchase orders', 'Issue POs to suppliers with agreed prices, terms and expected delivery dates.'],
        ['Receiving', 'Receive full or partial deliveries against the PO; stock updates automatically.'],
        ['Supplier records', 'Contacts, terms, price history and delivery performance for every supplier.'],
        ['Payables', 'Track supplier bills, due dates and payments so nothing is missed or paid twice.'],
        ['Price comparison', 'See past purchase prices per item and supplier before you commit.']
      ],
      reports: ['Open purchase orders', 'Purchases by supplier & item', 'Accounts payable aging'],
      users: ['Owner', 'Purchasing officer', 'Approvers', 'Accounting']
    },
    {
      key: 'production', name: 'Production',
      summary: 'Turn raw materials into finished goods with costs and output you can actually see.',
      items: [
        ['Bills of materials', 'Define the materials and quantities each finished product needs.'],
        ['Work orders', 'Plan production runs, assign them and track status from planned to done.'],
        ['Material issuance', 'Issue raw materials to production; inventory is deducted as they are used.'],
        ['Output & yield', 'Record finished goods, rejects and waste to see the true yield of every run.'],
        ['Quality checks', 'Log inspections per batch and hold items that do not pass.'],
        ['Production costing', 'Material and conversion cost per batch, so you know the real cost per unit.']
      ],
      reports: ['Production output vs plan', 'Yield & waste per product', 'Cost per unit by batch'],
      users: ['Owner', 'Production manager', 'Plant supervisors', 'QC']
    },
    {
      key: 'reports', name: 'Reports',
      summary: 'Answers instead of spreadsheets — consistent reports built from the same live records.',
      items: [
        ['Executive summary', 'Sales, collections, stock and production on a single page for the owner.'],
        ['Profitability', 'Gross profit by product, customer, agent and branch.'],
        ['Period comparisons', 'This month vs last month, this year vs last year, side by side.'],
        ['Filters & drill-down', 'Slice any report by date, branch, product or person and open the transactions behind it.'],
        ['Export & print', 'Download to Excel or PDF, or print for meetings and audits.'],
        ['Scheduled reports', 'Have key reports prepared on a schedule so they are ready when you need them.']
      ],
      reports: ['Profit & loss overview', 'Top and bottom performers', 'Branch comparison'],
      users: ['Owner', 'Managers', 'Accounting', 'Auditors']
    },
    {
      key: 'management', name: 'Management',
      summary: 'Run the whole business from one seat — with control over who can do what.',
      items: [
        ['Owner dashboard', 'The numbers that matter today: sales, cash, stock alerts and pending approvals.'],
        ['User roles & permissions', 'Give each person access only to the modules and actions their job needs.'],
        ['Approval workflows', 'Require sign-off for discounts, purchases, adjustments and other sensitive actions.'],
        ['Audit trail', 'Every create, edit and delete is logged with the user and the time it happened.'],
        ['Multi-branch view', 'Compare branches side by side or drill into a single one.'],
        ['Alerts & notifications', 'Get flagged on low stock, overdue accounts and items waiting for your approval.']
      ],
      reports: ['Approval history', 'User activity log', 'Branch performance'],
      users: ['Owner', 'General manager', 'System administrator']
    }
  ];

  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function fxMarkup(m) {
    return '<div class="fx__main">' +
        '<p class="fx__kicker">Module</p><h3 class="fx__title">' + m.name + '</h3>' +
        '<p class="fx__summary">' + m.summary + '</p>' +
        '<ul class="fx__list">' + m.items.map(function (it) {
          return '<li class="fx__item">' + CHECK + '<div><b>' + it[0] + '</b><span>' + it[1] + '</span></div></li>';
        }).join('') + '</ul>' +
      '</div>' +
      '<aside class="fx__side">' +
        '<div class="fx__box"><p class="fx__kicker">Key reports</p><ul class="fx__reports">' +
          m.reports.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul></div>' +
        '<div class="fx__box"><p class="fx__kicker">Used by</p><div class="fx__users">' +
          m.users.map(function (u) { return '<span>' + u + '</span>'; }).join('') + '</div></div>' +
        '<a class="fx__cta" href="#demo">See ' + m.name + ' in a demo →</a>' +
      '</aside>';
  }

  /* =========================================================
     GLASS SHATTER — the panel breaks into honeycomb shards.
     One pure function of (v, dir) drives both layers, so it can
     run forwards (shatter) or backwards (re-assemble):
       • the real panel is clip-pathed to the cells still attached
       • a canvas overlay draws the gold cracks that run ahead of
         the break, a light sweep, and the glass shards that fly off
     v: 0 = whole · 1 = gone      dir: 1 = wave travels left → right
     ========================================================= */
  function createShatter(panel, R) {
    var M = 90;                                   // canvas bleed so shards can leave the panel
    var TRAVEL = 30;                              // how far shards fly — independent of shard size
    var stage = document.createElement('div');
    stage.className = 'fx__stage';
    panel.parentNode.insertBefore(stage, panel);
    stage.appendChild(panel);
    var cv = document.createElement('canvas');
    cv.className = 'fx__shards';
    cv.setAttribute('aria-hidden', 'true');
    stage.appendChild(cv);
    var ctx = cv.getContext('2d'), cells = [], w = 0, h = 0, dpr = 1, radius = 0, lastKey = null;
    var SQ3 = Math.sqrt(3);

    function layout() {
      w = panel.offsetWidth; h = panel.offsetHeight; cells = [];
      radius = parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round((w + M * 2) * dpr); cv.height = Math.round((h + M * 2) * dpr);
      cv.style.width = (w + M * 2) + 'px'; cv.style.height = (h + M * 2) + 'px';
      var hw = SQ3 * R, hh = 1.5 * R;
      for (var row = -1; row * hh < h + R; row++) {
        for (var col = -1; col * hw < w + hw; col++) {
          var x = col * hw + (row & 1 ? hw / 2 : 0), y = row * hh;
          cells.push({
            x: x, y: y, nx: clamp(x / w, 0, 1), ny: clamp(y / h, 0, 1), rnd: Math.random(),
            spin: (Math.random() - .5) * 2.4, lift: .4 + Math.random() * .9, fall: (Math.random() - .3) * 1.2
          });
        }
      }
    }

    function hexPath(g, cx, cy, s, rot) {
      g.beginPath();
      for (var j = 0; j < 6; j++) {
        var a = rot + Math.PI / 3 * j - Math.PI / 2;
        var X = cx + Math.cos(a) * s, Y = cy + Math.sin(a) * s;
        j ? g.lineTo(X, Y) : g.moveTo(X, Y);
      }
      g.closePath();
    }

    function draw(v, dir) {
      if (!cells.length || panel.offsetWidth !== w || panel.offsetHeight !== h) layout();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w + M * 2, h + M * 2);
      if (v <= .0005) { panel.style.clipPath = ''; panel.style.visibility = ''; lastKey = null; return; }
      if (v >= .9995) { panel.style.visibility = 'hidden'; lastKey = null; return; }
      panel.style.visibility = '';
      ctx.translate(M, M);

      var span = .62, dur = .38, d = '', cracks = [];
      // only rows on screen are animated — on phones the panel is far taller than the viewport,
      // and the off-screen part is simply hidden for the ~1.6s the switch takes
      var top = panel.getBoundingClientRect().top, minY = -top - R * 4, maxY = innerHeight - top + R * 4;
      // light sweep riding just ahead of the break
      var front = (v * (1 + dur / span) - dur / span * .2) * w;
      var fx = dir > 0 ? front : w - front;
      var sweep = ctx.createLinearGradient(fx - 140, 0, fx + 140, 0);
      sweep.addColorStop(0, 'rgba(255,229,138,0)');
      sweep.addColorStop(.5, 'rgba(255,229,138,' + (.16 * Math.sin(Math.PI * v)).toFixed(3) + ')');
      sweep.addColorStop(1, 'rgba(255,229,138,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(fx - 140, -20, 280, h + 40);

      ctx.lineJoin = 'round';
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.y < minY || c.y > maxY) continue;
        var order = dir > 0 ? c.nx : 1 - c.nx;                       // which side breaks first
        var start = order * span + c.rnd * .14 - .07;
        var t = (v - start) / dur;                                   // <0 attached · 0..1 flying · >1 gone
        if (t < 0) {
          d += 'M' + (c.x).toFixed(1) + ' ' + (c.y - R * 1.05).toFixed(1);
          for (var j = 1; j < 6; j++) {
            var a = Math.PI / 3 * j - Math.PI / 2;
            d += 'L' + (c.x + Math.cos(a) * R * 1.05).toFixed(1) + ' ' + (c.y + Math.sin(a) * R * 1.05).toFixed(1);
          }
          d += 'Z';
          // gold crack lines appear on cells about to break (kept inside the glass)
          if (t > -.5) cracks.push(c, (t + .5) / .5);
          continue;
        }
        if (t >= 1) continue;
        // flying shard: glass tile with a gold rim, drifting with the wave
        var e = 1 - Math.pow(1 - t, 3), s = R * (1 - e * .55);
        var px = c.x + dir * e * TRAVEL * (2.2 + c.lift * 2.4);
        var py = c.y + e * e * TRAVEL * c.fall * 2.2 - e * TRAVEL * c.lift * .6;
        hexPath(ctx, px, py, s, c.spin * e);
        var alpha = 1 - t;
        ctx.fillStyle = 'rgba(255,240,205,' + (.13 * alpha).toFixed(3) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,214,110,' + (.9 * alpha).toFixed(3) + ')';
        ctx.lineWidth = .85;
        ctx.stroke();
        if (t < .25) {                                               // bright flash at the moment of breaking
          ctx.fillStyle = 'rgba(255,236,170,' + ((1 - t / .25) * .35).toFixed(3) + ')';
          ctx.fill();
        }
      }
      // gold cracks on cells about to break, drawn in one pass clipped to the glass
      if (cracks.length) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(0, 0, w, h, radius); else ctx.rect(0, 0, w, h);
        ctx.clip();
        for (var ci = 0; ci < cracks.length; ci += 2) {
          var cc = cracks[ci], ck = cracks[ci + 1];
          hexPath(ctx, cc.x, cc.y, R, 0);
          ctx.strokeStyle = 'rgba(255,214,110,' + (ck * .85).toFixed(3) + ')';
          ctx.lineWidth = .4 + ck * .6;
          ctx.stroke();
        }
        ctx.restore();
      }
      if (d !== lastKey) { panel.style.clipPath = d ? "path('" + d + "')" : 'inset(50%)'; lastKey = d; }
    }
    addEventListener('resize', function () { cells = []; });
    return { stage: stage, draw: draw };
  }

  function initFunctions() {
    var tabsEl = $('.fx__tabs'), panel = $('.fx__panel');
    if (!tabsEl || !panel) return;
    var current = 0, busy = false;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || !window.gsap;
    var shatter = createShatter(panel, innerWidth < 900 ? 12 : 18);   // shard size (px)

    // glass tilt: the panel leans slightly toward the cursor
    if (!reduce && matchMedia('(pointer: fine)').matches) {
      var rx = gsap.quickTo(shatter.stage, 'rotationX', { duration: .9, ease: 'power3' });
      var ry = gsap.quickTo(shatter.stage, 'rotationY', { duration: .9, ease: 'power3' });
      gsap.set(shatter.stage, { transformPerspective: 1600 });
      shatter.stage.addEventListener('pointermove', function (e) {
        var r = shatter.stage.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - .5) * 4);
        rx(-((e.clientY - r.top) / r.height - .5) * 3);
      });
      shatter.stage.addEventListener('pointerleave', function () { rx(0); ry(0); });
    }

    tabsEl.innerHTML = FUNCTIONS.map(function (m, i) {
      return '<button class="fx__tab" role="tab" id="fxtab-' + m.key + '" aria-controls="fxpanel" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + m.name + '</button>';
    }).join('') + '<i class="fx__ink" aria-hidden="true"></i>';
    panel.id = 'fxpanel';
    var tabs = $$('.fx__tab', tabsEl), ink = $('.fx__ink', tabsEl);

    function moveInk(i, instant) {
      var t = tabs[i];
      if (!window.gsap) { ink.style.transform = 'translateX(' + t.offsetLeft + 'px)'; ink.style.width = t.offsetWidth + 'px'; return; }
      // tabs may sit in one row (desktop) or a 3×2 grid (phones), so the pill tracks x, y, width and height
      var to = { x: t.offsetLeft, y: t.offsetTop, width: t.offsetWidth, height: t.offsetHeight };
      if (instant || reduce) { gsap.set(ink, to); return; }
      // liquid pill: stretch to span both tabs, then snap onto the new one
      var x0 = gsap.getProperty(ink, 'x'), y0 = gsap.getProperty(ink, 'y');
      var w0 = parseFloat(ink.style.width) || to.width, h0 = parseFloat(ink.style.height) || to.height;
      var left = Math.min(x0, to.x), right = Math.max(x0 + w0, to.x + to.width);
      var top = Math.min(y0, to.y), bottom = Math.max(y0 + h0, to.y + to.height);
      gsap.timeline()
        .to(ink, { x: left, y: top, width: right - left, height: bottom - top, duration: .22, ease: 'power2.in' })
        .to(ink, Object.assign({ duration: .55, ease: 'elastic.out(1, .75)' }, to));
    }
    function render(i) {
      panel.innerHTML = fxMarkup(FUNCTIONS[i]);
      panel.setAttribute('aria-labelledby', tabs[i].id);
    }
    function select(i, focus) {
      if (i === current || busy) return;
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
      if (focus) tabs[i].focus();
      moveInk(i);
      var dir = i > current ? 1 : -1;
      current = i;
      if (reduce) { render(i); return; }
      // shatter out along the wave → swap content → shards fly back in and lock, then content focuses in
      busy = true;
      var o = { v: 0 };
      gsap.timeline({ onComplete: function () { busy = false; shatter.draw(0, dir); } })
        .to(o, { v: 1, duration: .75, ease: 'power1.in', onUpdate: function () { shatter.draw(o.v, dir); } })
        .add(function () { render(i); })
        .to(o, { v: 0, duration: .85, ease: 'power2.out', onUpdate: function () { shatter.draw(o.v, -dir); } })
        .add(function () {
          gsap.fromTo($$('.fx__title, .fx__summary', panel), { filter: 'blur(10px)', autoAlpha: 0, y: 10 },
            { filter: 'blur(0px)', autoAlpha: 1, y: 0, stagger: .08, duration: .6, ease: 'power3.out', clearProps: 'filter' });
          gsap.fromTo($$('.fx__item, .fx__box, .fx__cta', panel), { filter: 'blur(6px)', autoAlpha: 0, y: 16 },
            { filter: 'blur(0px)', autoAlpha: 1, y: 0, stagger: .04, duration: .55, ease: 'power3.out', clearProps: 'filter' });
        }, '-=.55');
    }
    tabs.forEach(function (t, i) { t.addEventListener('click', function () { select(i); }); });
    tabsEl.addEventListener('keydown', function (e) {
      var k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (e.key === 'Home') k = -current; if (e.key === 'End') k = tabs.length - 1 - current;
      if (k === undefined) return;
      e.preventDefault();
      select((current + k + tabs.length) % tabs.length, true);
    });
    render(0);
    requestAnimationFrame(function () { moveInk(0, true); });
    addEventListener('resize', function () { moveInk(current, true); });
  }
  initFunctions();

  /* =========================================================
     DEMO FORM — posts to api/demo-request.php
     ========================================================= */
  (function demoForm() {
    var form = $('#demoForm');
    if (!form) return;
    var status = $('.demo__status', form), btn = $('.demo__submit', form);
    var params = new URLSearchParams(location.search);       // no-JS fallback redirects back here
    if (params.get('demo') === 'sent') { status.textContent = 'Thank you — we received your request.'; status.className = 'demo__status is-ok'; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'demo__status';
      var bad = $$('[required]', form).filter(function (f) { return !f.checkValidity(); });
      $$('.f', form).forEach(function (f) { f.classList.remove('is-bad'); });
      if (bad.length) {
        bad.forEach(function (f) { f.closest('.f').classList.add('is-bad'); });
        status.textContent = 'Please complete the highlighted fields.';
        status.classList.add('is-err');
        bad[0].focus();
        return;
      }
      btn.disabled = true;
      btn.classList.add('is-busy');
      status.textContent = 'Sending…';
      // FormSubmit (email address) → Formspree (form ID) → the PHP script (XAMPP only)
      var fsMail = (form.dataset.formsubmit || '').trim(), fsId = (form.dataset.formspree || '').trim();
      var endpoint = fsMail ? 'https://formsubmit.co/ajax/' + encodeURIComponent(fsMail)
                   : fsId ? 'https://formspree.io/f/' + encodeURIComponent(fsId) : form.action;
      var who = (form.elements.name.value || '').trim();
      var body = new FormData(form);
      if (fsMail) {
        // one readable "Modules" line instead of repeated modules[] fields, plus a tidy table email
        var mods = body.getAll('modules[]');
        body.delete('modules[]');
        body.set('Modules', mods.length ? mods.join(', ') : '—');
        body.set('_template', 'table');
        body.set('_captcha', 'false');
        body.set('_replyto', form.elements.email.value);
      }
      fetch(endpoint, { method: 'POST', body: body, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false, message: 'Something went wrong. Please try again.' }; }); })
        .then(function (res) {
          if (fsMail) res = { ok: res.success === true || res.success === 'true', message: res.success === true || res.success === 'true' ? '' : (res.message || '') };
          // Formspree answers { ok: true } or { errors: [{ message }] }; the PHP script sends { ok, message }
          if (res.ok && !res.message) res.message = 'Thank you' + (who ? ', ' + who : '') + '. We received your request and will contact you to schedule your demo.';
          if (!res.ok && !res.message) res.message = (res.errors && res.errors.length) ? res.errors.map(function (er) { return er.message; }).join(' ') : 'Something went wrong. Please try again.';
          status.textContent = res.message;
          status.classList.add(res.ok ? 'is-ok' : 'is-err');
          if (res.ok) {
            form.classList.add('is-sent');
            form.reset();
          }
        })
        .catch(function () {
          status.textContent = 'We could not reach the server. Please check your connection and try again.';
          status.classList.add('is-err');
        })
        .then(function () { btn.disabled = false; btn.classList.remove('is-busy'); });
    });
  })();

  /* =========================================================
     MICRO-INTERACTIONS
       • spotlight: a soft gold light follows the cursor across glass
       • decode:    section labels resolve from scrambled characters
       • magnetic:  CTAs lean toward the cursor
     ========================================================= */
  (function microInteractions() {
    var fine = matchMedia('(pointer: fine)').matches;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (fine) {
      document.addEventListener('pointermove', function (e) {
        var el = e.target.closest && e.target.closest('.glass-spot, .mcard, .kpi, .card');
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    }

    if (fine && !reduce && window.gsap) {
      $$('[data-magnetic]').forEach(function (el) {
        var qx = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' }), qy = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          qx((e.clientX - r.left - r.width / 2) * .25);
          qy((e.clientY - r.top - r.height / 2) * .35);
        });
        el.addEventListener('pointerleave', function () { qx(0); qy(0); });
      });
    }

    if (!reduce && 'IntersectionObserver' in window) {
      var GLYPHS = '01<>/#*+=ABCDEFGHJKLMNPRSTUVWXYZ';
      var decode = function (el) {
        var final = el.textContent, frame = 0, total = 26;
        el.setAttribute('aria-label', final);
        (function step() {
          frame++;
          var out = '';
          for (var i = 0; i < final.length; i++) {
            var ch = final[i];
            out += (ch === ' ' || ch === '—' || i < (frame / total) * final.length) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          el.textContent = out;
          if (frame < total) requestAnimationFrame(step); else el.textContent = final;
        })();
      };
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          decode(en.target);
        });
      }, { threshold: .6 });
      $$('.eyebrow, .owner__eyebrow').forEach(function (el) { io.observe(el); });
    }
  })();

  /* =========================================================
     BOOT
     ========================================================= */
  var reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var scene = window.BOSSScene;
  if (scene) scene.init($('#webgl'), { reduced: reducedMQ.matches });

  if (!window.gsap || !window.ScrollTrigger) {      // CDN blocked: show the finished page
    root.classList.add('is-reduced');
    eco.render(1);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* Smooth, inertial scrolling (Lenis) driven by GSAP's ticker, so scroll, ScrollTrigger
     and every animation update on the same frame. Off for reduced motion and touch
     devices, which already have native momentum scrolling. */
  var lenis = null;
  var SCRUB = .6;   // catch-up smoothing for scroll-linked timelines (used when there's no Lenis)
  if (window.Lenis && !reducedMQ.matches && !matchMedia('(pointer: coarse)').matches) {
    lenis = new Lenis({ lerp: .08, wheelMultiplier: .9, smoothWheel: true });
    SCRUB = .25;   // Lenis already eases the scroll; stacking a long scrub on top made motion feel laggy
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    root.classList.add('has-lenis');
    if (window.BOSSIntro && !window.BOSSIntro.done) {
      lenis.stop();
      window.BOSSIntro.onDone(function () { lenis.start(); });
    }
  }
  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.8, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else window.scrollTo({ top: y, behavior: reducedMQ.matches ? 'auto' : 'smooth' });
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && !root.classList.contains('is-reduced')) eco.start(); else eco.stop();
      });
    }).observe($('#ecosystem'));
  }

  /* Section timeline, positions 0 → 1.
     Pinned: the timeline starts while the section is still scrolling in (top at 50%)
     and ends when the pin releases, so there is never an empty screen between chapters.
     sts[key] is the pin itself (used for scene keyframes and the nav).
     pin === false (small screens): plain scrubbed reveal, no pin. */
  function sectionTl(key, el, lenPct, pin) {
    var tl;
    if (pin === false) {
      tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 35%', scrub: .6 } });
      sts[key] = tl.scrollTrigger;
      return tl;
    }
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: el, start: 'top 50%', end: '+=' + (50 + lenPct) + '%', scrub: SCRUB }
    });
    sts[key] = ScrollTrigger.create({ trigger: el, start: 'top top', end: '+=' + lenPct + '%', pin: true, anticipatePin: 1 });
    return tl;
  }

  /* ---------- HERO: enter the logo ---------- */
  function hero() {
    var el = $('#hero'), logo = $('#heroLogo');
    var rings = $('.l-rings', logo), top = $('.l-arcs-top', logo), bottom = $('.l-arcs-bottom', logo), core = $('.l-core', logo);
    var glow = $('.logo3d__glow', logo);
    // the hero is the only chapter that starts pinned at scroll 0; its exit is the fly-through
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: el, start: 'top top', end: '+=260%', pin: true, scrub: SCRUB } });
    sts.hero = tl.scrollTrigger;

    // 1. the logo comes apart in depth: rings fall back, arcs lift away, wordmark comes forward
    tl.to('.hero__cue, .hero__meta', { autoAlpha: 0, y: -12, duration: .12 }, 0)
      .to(logo, { rotationX: 16, rotationY: -10, duration: .42, ease: 'sine.inOut' }, 0)
      .to(rings, { z: -260, scale: 1.16, rotation: 40, duration: .42, ease: 'sine.inOut' }, 0)
      .to(top, { z: -110, yPercent: -12, rotation: -8, duration: .42, ease: 'sine.inOut' }, 0)
      .to(bottom, { z: -110, yPercent: 12, rotation: 8, duration: .42, ease: 'sine.inOut' }, 0)
      .to(core, { z: 140, duration: .42, ease: 'sine.inOut' }, 0)
      .to(glow, { opacity: 1, scale: 1.7, duration: .42 }, 0)
    // the reactor spins up and separates: segments counter-rotate, plate and steel drop back
      .to($('.hud-segs-out', logo), { z: -150, rotation: 200, scale: 1.12, duration: .7, ease: 'sine.inOut' }, 0)
      .to($('.hud-segs-in', logo), { z: -60, rotation: -160, duration: .7, ease: 'sine.inOut' }, 0)
      .to($('.hud-mesh', logo), { z: -90, duration: .42, ease: 'sine.inOut' }, 0)
      // hex tiles peel off the plate, outer ring first, and fly out past the camera
      .fromTo(heroHex.state, { explode: 0 }, { explode: 1, duration: .5, ease: 'power1.in' }, .18)
      .to($('.hud-steel', logo), { z: -520, scale: 1.35, rotation: 25, duration: .6, ease: 'sine.inOut' }, 0)
      // explicit start values: the load-time power-on owns these opacities until the user scrolls
      .fromTo($('.hud-mesh', logo), { autoAlpha: 1 }, { autoAlpha: 0, duration: .14, immediateRender: false }, .7)
      .fromTo($$('.hud-segs-in, .hud-segs-out', logo), { autoAlpha: 1 }, { autoAlpha: 0, duration: .12, immediateRender: false }, .84)
      .fromTo($('.hud-steel', logo), { autoAlpha: 1 }, { autoAlpha: 0, duration: .12, immediateRender: false }, .86)
    // 2. the camera travels through it
      .to(logo, { z: 1100, rotationX: 0, rotationY: 0, duration: .55, ease: 'power2.in' }, .42)
      .to(core, { autoAlpha: 0, duration: .16 }, .72)
      .to([top, bottom], { autoAlpha: 0, duration: .12 }, .8)
      .to(rings, { autoAlpha: 0, duration: .12 }, .86)
      .to(glow, { autoAlpha: 0, duration: .2 }, .78)
      .fromTo('.hero__flash', { opacity: 0 }, { opacity: .45, duration: .05 }, .9)
      .to('.hero__flash', { opacity: 0, duration: .05 }, .95);
  }

  /* ---------- 01 WELCOME: revealed from darkness ---------- */
  function welcome() {
    var el = $('#welcome');
    var tl = sectionTl('welcome', el, 200);
    tl.fromTo($('.fl--t', el), { scaleX: 0 }, { scaleX: 1, duration: .25, ease: 'power2.inOut' }, 0)
      .fromTo($('.spark--t', el), { left: '0%', opacity: 1 }, { left: '100%', duration: .25, ease: 'power2.inOut' }, 0)
      .to($('.spark--t', el), { opacity: 0, duration: .04 }, .25)
      .fromTo($('.fl--b', el), { scaleX: 0 }, { scaleX: 1, duration: .25, ease: 'power2.inOut' }, .06)
      .fromTo($('.spark--b', el), { left: '100%', opacity: 1 }, { left: '0%', duration: .25, ease: 'power2.inOut' }, .06)
      .to($('.spark--b', el), { opacity: 0, duration: .04 }, .31)
      .fromTo($$('.fl--l, .fl--r', el), { scaleY: 0 }, { scaleY: 1, duration: .2, ease: 'power2.inOut' }, .18)
      .fromTo($$('.fc', el), { autoAlpha: 0, scale: .3 }, { autoAlpha: 1, scale: 1, duration: .08, stagger: .02 }, .3)
      .fromTo($('.eyebrow', el), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: .12 }, .12)
      .fromTo($$('.welcome__title .ch', el),
        { autoAlpha: 0, yPercent: 55, rotationX: -75, filter: 'brightness(0)' },
        { autoAlpha: 1, yPercent: 0, rotationX: 0, filter: 'brightness(1)', duration: .22, stagger: .018, ease: 'power3.out' }, .16)
      .fromTo($('.welcome__sub', el), { autoAlpha: 0, letterSpacing: '1.1em' }, { autoAlpha: 1, letterSpacing: '.42em', duration: .2, ease: 'power2.out' }, .42)
      .fromTo($$('.welcome__tag > span', el),
        { autoAlpha: 0, y: 24, filter: 'blur(6px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .12, stagger: .08 }, .55)
      .to($('.welcome__inner', el), { scale: 1.04, duration: .25 }, .75);
  }

  /* ---------- 02 WHAT: modules assemble around the core ---------- */
  function what(desktop) {
    var el = $('#what');
    var tl = sectionTl('what', el, 260, desktop);
    var orbit = $('.orbit', el);
    tl.fromTo($('.eyebrow', el), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .08 }, 0)
      .fromTo($$('.what__title .wi', el), { yPercent: 110 }, { yPercent: 0, stagger: .03, duration: .18, ease: 'power3.out' }, .02)
      .fromTo($('.what__desc', el), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .12 }, .16)
      .fromTo($('.core', el), { autoAlpha: 0, scale: .5, rotationX: 50 }, { autoAlpha: 1, scale: 1, rotationX: 0, duration: .18, ease: 'power2.out' }, .12)
      .fromTo($('.orbit__rings', el), { rotation: -60, scale: .7, autoAlpha: 0 }, { rotation: 0, scale: 1, autoAlpha: 1, duration: .3, ease: 'power2.out' }, .12)
      .to($('.orbit__rings', el), { rotation: 45, duration: .5 }, .42);

    var links = $$('.orbit__links line', el);
    // centre each chip on its line end with GSAP's percent offset, not the CSS `translate` shift —
    // GSAP folded that shift into x, and tweening x back to 0 then un-centred some chips
    gsap.set($$('.chip', el), { translate: 'none', xPercent: -50, yPercent: -50 });
    $$('.chip', el).forEach(function (chip, i) {
      var at = .3 + i * .065;
      var cx = parseFloat(chip.style.getPropertyValue('--x')), cy = parseFloat(chip.style.getPropertyValue('--y'));
      tl.fromTo(links[i], { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .08 }, at)
        .fromTo(chip,
          { autoAlpha: 0, scale: .6, x: function () { return (50 - cx) / 100 * orbit.offsetWidth * .5; }, y: function () { return (50 - cy) / 100 * orbit.offsetWidth * .5; } },
          { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: .1, ease: 'power3.out' }, at + .04);
    });

    tl.fromTo($$('.stat', el), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: .04, duration: .1 }, .5);
    addCounters(tl, $$('.stat__num', el), .52, .26);
    tl.to({}, { duration: .1 }, .9);
  }

  /* ---------- 03 MODULES: horizontal 3D card rail ---------- */
  function modules() {
    var el = $('#modules'), track = $('.hs__track', el), cards = $$('.mcard', el), lineFill = $('.hs__line i', el);
    var dist = function () { return Math.max(0, track.scrollWidth - innerWidth); };
    var hexes = cards.map(function (c) { return hexDissolve(c, innerWidth < 900 ? 16 : 22); });

    // card centres measured once (and on refresh) — reading layout while writing styles
    // every frame forced a reflow per card
    var centres = [], last = [];
    function measure() { centres = cards.map(function (c) { return c.offsetLeft + c.offsetWidth / 2; }); last = []; }
    measure();
    addEventListener('resize', measure);

    function update() {
      var tx = gsap.getProperty(track, 'x'), vw = innerWidth;
      cards.forEach(function (c, i) {
        var cx = centres[i] + tx;
        var d = clamp((cx - vw / 2) / (vw * .55), -1.6, 1.6), ad = Math.abs(d), tilt = vw < 900 ? .5 : 1;   // gentler 3D on phones
        var key = Math.round(d * 400);
        if (last[i] === key) return;                                   // nothing moved for this card
        last[i] = key;
        c.style.transform = 'perspective(1600px) translate3d(0,0,' + (-ad * 240 * tilt).toFixed(1) + 'px) rotateY(' + (-d * 26 * tilt).toFixed(2) + 'deg) scale(' + (1 - Math.min(ad, 1) * .1).toFixed(3) + ')';
        c.style.opacity = clamp(1.2 - ad * .35, .55, 1).toFixed(3);
        c.style.setProperty('--reveal', clamp(1.15 - ad * 1.1, 0, 1).toFixed(3));
        // off-centre cards break into honeycomb from their outer edge; incoming ones build back up
        hexes[i].set(clamp((ad - .45) / .6, 0, 1), d > 0 ? 1 : -1);
      });
      // the gold line is drawn up to the centre of the viewport
      lineFill.style.transform = 'scaleX(' + clamp((vw / 2 - tx) / track.scrollWidth, 0, 1).toFixed(4) + ')';
    }

    var pinLen = function () { return dist() * 1.15 + innerHeight * .4; };
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: el, start: 'top 50%', scrub: SCRUB, invalidateOnRefresh: true,
        end: function () { return '+=' + (innerHeight * .5 + pinLen()); }
      }
    });
    sts.modules = ScrollTrigger.create({
      trigger: el, start: 'top top', pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      end: function () { return '+=' + pinLen(); },
      onRefresh: function () { measure(); requestAnimationFrame(update); }
    });
    tl.fromTo($$('.modules__head > *', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .03, duration: .1 }, 0)
      .fromTo(track, { x: function () { return innerWidth * .45; } }, { x: function () { return -dist(); }, duration: 1, onUpdate: update }, .08)
      .to({}, { duration: .1 }, 1.08);
    update();
  }

  /* ---------- 04 DASHBOARD: the system comes online ---------- */
  function dashboard(desktop) {
    var el = $('#dashboard');
    if (!desktop) return dashboardMobile(el);
    var tl = sectionTl('dashboard', el, 260, desktop);
    tl.fromTo($$('.dash-head > *', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .03, duration: .1 }, 0);
    if (desktop) tl.to($('.dash-head', el), { autoAlpha: 0, y: -40, duration: .08 }, .2);
    tl.fromTo(stage, { rotationX: 58, z: -700, yPercent: 18, autoAlpha: 0 }, { rotationX: 0, z: 0, yPercent: 0, autoAlpha: 1, duration: .3, ease: 'power2.out' }, desktop ? .14 : 0)
      .fromTo($$('.panel', el), { y: 40 }, { y: 0, stagger: .02, duration: .12, ease: 'power2.out' }, .28);
    // each tile assembles hex by hex as the dashboard comes online
    $$('.panel', el).forEach(function (p, i) {
      var hx = hexDissolve(p, 14), o = { v: 1 };
      hx.set(1, 0);
      tl.fromTo(o, { v: 1 }, { v: 0, duration: .16, ease: 'power1.out', onUpdate: function () { hx.set(o.v, 0); } }, .28 + i * .022);
    });
    tl
      .fromTo($$('.kpi-meter i', el), { scaleX: 0 }, { scaleX: 1, duration: .2 }, .45)
      .fromTo($$('#salesChart .line, #sparkSales path', el), { strokeDashoffset: 1, strokeDasharray: 1 }, { strokeDashoffset: 0, duration: .3 }, .42)
      .fromTo($('#salesChart .area', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .2 }, .55)
      .fromTo($$('#salesChart .endpt, #salesChart .endlbl', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .05 }, .72)
      .fromTo($$('#prodChart .bar', el), { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, stagger: .02, duration: .12 }, .5)
      .fromTo($('#prodChart .vlbl', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .05 }, .7)
      .fromTo($$('.inv-fill', el), { scaleX: 0 }, { scaleX: 1, stagger: .03, duration: .15 }, .48)
      .fromTo($$('.tx-row', el), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, stagger: .025, duration: .08 }, .6);
    addCounters(tl, $$('.kpi__val', el), .4, .32);
    if (desktop) tl.to({}, { duration: .2 }, .8);   // hold flat (a late tilt skewed the frame)
    else tl.to({}, { duration: .1 }, .9);
  }

  /* Phones: the dashboard is a tall single column, so each panel animates on its own
     as it scrolls into view (one shared timeline left lower panels empty on screen). */
  function dashboardMobile(el) {
    sts.dashboard = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom top' });
    var reveal = function (target, from, to, trigger, start) {
      gsap.fromTo(target, from, Object.assign({ ease: 'none', scrollTrigger: { trigger: trigger || target, start: start || 'top 92%', end: 'top 55%', scrub: .6 } }, to));
    };
    reveal($$('.dash-head > *', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .1 }, $('.dash-head', el));
    $$('.panel', el).forEach(function (p) {
      var hx = hexDissolve(p, 14), o = { v: 1 };
      hx.set(1, 0);
      gsap.fromTo(o, { v: 1 }, { v: 0, ease: 'none', onUpdate: function () { hx.set(o.v, 0); },
        scrollTrigger: { trigger: p, start: 'top 95%', end: 'top 60%', scrub: .6 } });
    });
    reveal($$('.kpi-meter i', el), { scaleX: 0 }, { scaleX: 1 }, $('.kpi-meter', el));
    reveal($$('#salesChart .line', el), { strokeDashoffset: 1, strokeDasharray: 1 }, { strokeDashoffset: 0 }, $('#salesChart', el), 'top 85%');
    reveal($('#salesChart .area', el), { autoAlpha: 0 }, { autoAlpha: 1 }, $('#salesChart', el), 'top 75%');
    reveal($$('#salesChart .endpt, #salesChart .endlbl', el), { autoAlpha: 0 }, { autoAlpha: 1 }, $('#salesChart', el), 'top 65%');
    reveal($$('#prodChart .bar', el), { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, stagger: .08 }, $('#prodChart', el), 'top 88%');
    reveal($$('.inv-fill', el), { scaleX: 0 }, { scaleX: 1, stagger: .1 }, $('.inv', el), 'top 88%');
    reveal($$('.tx-row', el), { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, stagger: .1 }, $('.tx', el), 'top 90%');
    var kpis = $$('.kpi__val', el);
    var ktl = gsap.timeline({ scrollTrigger: { trigger: $('.dash__main', el), start: 'top 90%', end: 'top 40%', scrub: .6 } });
    addCounters(ktl, kpis, 0, 1);
  }

  /* ---------- 04 FUNCTIONS: normal-height section, scroll-in reveal ---------- */
  function functionsSection() {
    var el = $('#functions');
    sts.functions = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom top' });
    var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 75%', end: 'top 15%', scrub: .6 } });
    tl.fromTo($$('.fx__head > *', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .12, duration: .4 }, 0)
      .fromTo($$('.fx__tab', el), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, stagger: .05, duration: .3 }, .3);
    // the panel builds itself out of honeycomb as it scrolls in
    var panel = $('.fx__panel', el), hx = hexDissolve(panel, innerWidth < 900 ? 16 : 24), o = { v: 1 };
    hx.set(1, 0);
    gsap.fromTo(o, { v: 1 }, { v: 0, ease: 'none', onUpdate: function () { hx.set(o.v, 0); },
      scrollTrigger: { trigger: panel, start: 'top 92%', end: 'top 40%', scrub: .6 } });
  }

  /* ---------- 06 HOW IT WORKS: a packet travels the wire through four steps ---------- */
  function howSection(desktop) {
    var el = $('#how'), steps = $$('.step', el);
    var lit = $('.how__wire-lit', el), packet = $('.how__packet', el), base = $('.how__wire-base', el);
    if (!desktop) {
      sts.how = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom top' });
      gsap.fromTo($$('.how__head > *', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .1,
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 40%', scrub: .6 } });
      steps.forEach(function (s) {
        gsap.fromTo(s, { autoAlpha: 0, x: -30 }, { autoAlpha: 1, x: 0, ease: 'none',
          scrollTrigger: { trigger: s, start: 'top 90%', end: 'top 60%', scrub: .6, onEnter: function () { s.classList.add('is-on'); }, onLeaveBack: function () { s.classList.remove('is-on'); } } });
      });
      return;
    }
    var tl = sectionTl('how', el, 220);
    var len = base.getTotalLength(), prog = { p: 0 };
    tl.fromTo($$('.how__head > *', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .04, duration: .12 }, 0)
      .fromTo(steps, { autoAlpha: 0, y: 40 }, { autoAlpha: .45, y: 0, stagger: .03, duration: .12 }, .08)
      .fromTo(prog, { p: 0 }, {
        p: 1, duration: .7, ease: 'none',
        onUpdate: function () {
          lit.style.strokeDashoffset = 1 - prog.p;
          var pt = base.getPointAtLength(prog.p * len);
          packet.setAttribute('cx', pt.x); packet.setAttribute('cy', pt.y);
          steps.forEach(function (s, i) {
            var on = prog.p >= (i + .5) / steps.length - .08;
            if (on !== s.classList.contains('is-on')) {
              s.classList.toggle('is-on', on);
              gsap.to(s, { autoAlpha: on ? 1 : .45, y: on ? -10 : 0, duration: .5, ease: 'power3.out' });
            }
          });
        }
      }, .22)
      .to({}, { duration: .08 }, .92);
  }

  /* ---------- 10 DEMO: plain reveal ---------- */
  function demoSection() {
    var el = $('#demo');
    sts.demo = ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom bottom' });
    gsap.fromTo($$('.demo__copy > *, .why li', el), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .06, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 20%', scrub: .6 } });
    var form = $('.demo__form', el), hx = hexDissolve(form, 18), o = { v: 1 };
    hx.set(1, 0);
    gsap.fromTo(o, { v: 1 }, { v: 0, ease: 'none', onUpdate: function () { hx.set(o.v, 0); },
      scrollTrigger: { trigger: form, start: 'top 95%', end: 'top 45%', scrub: .6 } });
  }

  /* ---------- 07 OWNER: darkness, one line, three phrases ---------- */
  function owner() {
    var el = $('#owner'), ph = $$('.ph', el);
    var tl = sectionTl('owner', el, 300);
    tl.fromTo($('.owner__dark', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .1 }, 0)
      .fromTo($('.owner__line', el), { scaleX: 0 }, { scaleX: 1, duration: .14, ease: 'power2.inOut' }, .08)
      .fromTo($('.owner__eyebrow', el), { autoAlpha: 0 }, { autoAlpha: 1, duration: .06 }, .16);
    ph.forEach(function (p, i) {
      var at = .24 + i * .2;
      tl.fromTo(p, { clipPath: 'inset(0% 100% 0% 0%)', x: -30 }, { clipPath: 'inset(0% 0% 0% 0%)', x: 0, duration: .14, ease: 'power2.out' }, at)
        .fromTo($('em', p), { filter: 'drop-shadow(0 0 0px rgba(255,229,138,0))' }, { filter: 'drop-shadow(0 0 18px rgba(255,229,138,.55))', duration: .08 }, at + .08);
      if (i < ph.length - 1) tl.to(p, { opacity: .22, duration: .08 }, at + .18);
    });
    tl.to(ph.slice(0, -1), { opacity: 1, duration: .06 }, .86)
      .to({}, { duration: .08 }, .92);
  }

  /* ---------- 06 ECOSYSTEM: network expands with scroll ---------- */
  function ecosystem(desktop) {
    var el = $('#ecosystem'), proxy = { p: 0 };
    eco.setLayout(!desktop);
    var tl = sectionTl('ecosystem', el, 240);
    var st = tl.scrollTrigger;
    tl.fromTo($$('.eco__head > *', el), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: .03, duration: .1 }, 0)
      .fromTo(proxy, { p: 0 }, { p: 1, duration: .8, onUpdate: function () { eco.render(proxy.p); eco.setVelocity(st.getVelocity()); } }, .1)
      .to({}, { duration: .1 }, .9);
  }

  /* ---------- FINAL: rings rebuild, logo emerges ---------- */
  function finale() {
    var el = $('#final'), logo = $('#finalLogo');
    var rings = $('.l-rings', logo), top = $('.l-arcs-top', logo), bottom = $('.l-arcs-bottom', logo), core = $('.l-core', logo);
    var tl = sectionTl('final', el, 200);
    // the reactor rebuilds around the logo and powers back on
    tl.fromTo($('.hud-steel', logo), { autoAlpha: 0, scale: 1.5, z: -500 }, { autoAlpha: 1, scale: 1, z: 0, duration: .4, ease: 'power2.out' }, .02)
      .fromTo($('.hud-mesh', logo), { autoAlpha: 0 }, { autoAlpha: 1, duration: .08 }, .12)
      // tiles fly back in and lock into the plate
      .fromTo(finalHex.state, { explode: 1 }, { explode: 0, duration: .38, ease: 'power2.out' }, .12)
      .fromTo($$('.hud-segs-out, .hud-segs-in', logo), { rotation: -120 }, { rotation: 0, duration: .45, ease: 'power2.out' }, .18)
      .fromTo($$('.hud-segs-out .seg', logo), { opacity: .04 }, { opacity: 1, duration: .03, stagger: .008 }, .3)
      .fromTo($$('.hud-segs-in .seg', logo), { opacity: .03 }, { opacity: .75, duration: .02, stagger: .003 }, .38);
    tl.fromTo(logo, { scale: 1.25, z: -300 }, { scale: 1, z: 0, duration: .6, ease: 'power2.out' }, 0)
      .fromTo(core, { autoAlpha: 0, filter: 'brightness(0)' }, { autoAlpha: 1, filter: 'brightness(.25)', duration: .18 }, .05)
      .fromTo(rings, { '--sweep': '0deg', rotation: -140, z: -420, autoAlpha: 0 }, { '--sweep': '360deg', rotation: 0, z: 0, autoAlpha: 1, duration: .34, ease: 'power3.out' }, .14)
      .fromTo(top, { yPercent: -40, z: -260, autoAlpha: 0 }, { yPercent: 0, z: 0, autoAlpha: 1, duration: .26, ease: 'power3.out' }, .24)
      .fromTo(bottom, { yPercent: 40, z: -260, autoAlpha: 0 }, { yPercent: 0, z: 0, autoAlpha: 1, duration: .26, ease: 'power3.out' }, .28)
      .to(core, { filter: 'brightness(1)', duration: .14 }, .5)
      .fromTo($('.logo3d__glow', logo), { autoAlpha: 0, scale: .6 }, { autoAlpha: 1, scale: 1.1, duration: .2 }, .48)
      .fromTo($$('.final__tag .wi', el), { yPercent: 110 }, { yPercent: 0, stagger: .015, duration: .12, ease: 'power3.out' }, .64)
      .fromTo($('.final__cta', el), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .1 }, .78)
      .to({}, { duration: .06 }, .94);
  }

  /* ---------- nav: progress + current chapter ---------- */
  function nav() {
    var bar = $('.nav__progress span'), num = $('.nav__num'), label = $('.nav__label');
    var cur = -1;
    function sync(self) {
      bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')';
      var y = self.scroll() + innerHeight * .5, idx = 0;
      ORDER.forEach(function (k, i) { if (sts[k] && sts[k].start <= y) idx = i; });
      if (idx !== cur) {
        cur = idx;
        var sec = document.getElementById(ORDER[idx]);
        num.textContent = sec.dataset.chapter;
        label.textContent = sec.dataset.label;
      }
      if (scene && scene.setVelocity) scene.setVelocity(self.getVelocity());
      circuit.update(self, idx);
    }
    var circuit = createCircuit();
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: sync, onRefresh: function (self) { circuit.build(self); sync(self); } });
  }

  /* ---------- circuit wire: a PCB trace down the side of the page ----------
     One node per chapter, placed by where that chapter starts in the scroll.
     The trace jogs at 45° between nodes, lights up as you scroll, and red
     data packets run along the lit part (faster when you scroll faster). */
  function createCircuit() {
    var wrap = $('.circuit'), svg = $('.circuit__svg'), holder = $('.circuit__nodes');
    var noop = { build: function () {}, update: function () {} };
    if (!wrap || getComputedStyle(wrap).display === 'none') return noop;
    var NS = 'http://www.w3.org/2000/svg';
    var base, lit, head, pkts = [], nodes = [], samples = [], total = 0, litLen = 0, flow = 0, vel = 0, raf = 0;

    function build(self) {
      var H = wrap.clientHeight, X = 30, J = 12, max = self.end || 1;
      var ys = ORDER.map(function (k) { return sts[k] ? clamp(sts[k].start / max, 0, 1) * H : 0; });
      var d = 'M' + X + ',0';
      for (var i = 0; i < ys.length - 1; i++) {
        var a = ys[i], b = ys[i + 1], gap = b - a, jx = i % 2 ? X + J : X - J;
        if (gap > 60) {
          d += ' L' + X + ',' + (a + gap * .3) + ' L' + jx + ',' + (a + gap * .3 + J) +
               ' L' + jx + ',' + (b - gap * .3 - J) + ' L' + X + ',' + (b - gap * .3);
        }
        d += ' L' + X + ',' + b;
      }
      d += ' L' + X + ',' + H;
      svg.innerHTML = '';
      base = mk('path', { d: d, class: 'base' });
      lit = mk('path', { d: d, class: 'lit' });
      pkts = [0, 1, 2, 3].map(function () { return mk('circle', { r: 1.8, class: 'pkt' }); });
      head = mk('circle', { r: 2.6, class: 'head' });
      total = lit.getTotalLength();
      lit.style.strokeDasharray = total;
      // y → length lookup (the trace only ever moves downward)
      samples = [];
      for (var s = 0; s <= 300; s++) { var p = lit.getPointAtLength(s / 300 * total); samples.push([p.y, s / 300 * total]); }

      holder.innerHTML = '';
      nodes = ORDER.map(function (k, i) {
        var sec = document.getElementById(k), n = document.createElement('a');
        n.className = 'circuit__node';
        n.href = '#' + k;
        n.style.left = X + 'px';
        n.style.top = ys[i] + 'px';
        n.innerHTML = '<span>' + sec.dataset.chapter + ' · ' + sec.dataset.label + '</span>';
        n.setAttribute('aria-label', 'Go to ' + sec.dataset.label);
        holder.appendChild(n);
        return n;
      });
    }
    function mk(tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      svg.appendChild(e);
      return e;
    }
    function lengthAtY(y) {
      for (var i = 1; i < samples.length; i++) {
        if (samples[i][0] >= y) {
          var a = samples[i - 1], b = samples[i], t = b[0] === a[0] ? 1 : (y - a[0]) / (b[0] - a[0]);
          return a[1] + (b[1] - a[1]) * t;
        }
      }
      return total;
    }
    function tick() {
      raf = 0;
      if (!lit) return;
      vel *= .9;
      flow += .004 + Math.min(Math.abs(vel) / 90000, .03);
      pkts.forEach(function (c, i) {
        var t = (flow + i / pkts.length) % 1, L = litLen * t;
        var p = lit.getPointAtLength(L);
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
        c.style.opacity = litLen > 20 ? Math.sin(Math.PI * t).toFixed(2) : 0;
      });
      if (Math.abs(vel) > 5 || litLen > 20) raf = requestAnimationFrame(tick);
    }
    function update(self, idx) {
      if (!lit) return;
      litLen = lengthAtY(self.progress * wrap.clientHeight);
      lit.style.strokeDashoffset = total - litLen;
      var p = lit.getPointAtLength(litLen);
      head.setAttribute('cx', p.x); head.setAttribute('cy', p.y);
      nodes.forEach(function (n, i) {
        n.classList.toggle('is-passed', i < idx);
        n.classList.toggle('is-active', i === idx);
      });
      vel = self.getVelocity();
      if (!raf) raf = requestAnimationFrame(tick);
    }
    return { build: build, update: update };
  }

  /* in-page links jump to the right point of a pinned section */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var key = a.getAttribute('href').slice(1), st = sts[key];
    if (!st) return;
    e.preventDefault();
    var y = key === 'final' ? st.end : key === 'modules' ? st.start + (st.end - st.start) * .1 : st.start + 1;
    scrollToY(y);
  });

  /* pointer tilt on the hero logo (separate wrapper, so it never fights the scroll timeline) */
  if (!reducedMQ.matches && matchMedia('(pointer: fine)').matches) {
    var tiltY = gsap.quickTo('.hero__tilt', 'rotationY', { duration: .9, ease: 'power3' });
    var tiltX = gsap.quickTo('.hero__tilt', 'rotationX', { duration: .9, ease: 'power3' });
    addEventListener('pointermove', function (e) {
      tiltY((e.clientX / innerWidth - .5) * 12);
      tiltX(-(e.clientY / innerHeight - .5) * 9);
    }, { passive: true });
  }

  function pushSceneKeys() { if (scene) scene.setKeyframes(resolveSceneKeys()); }

  // the 3D boot intro (js/intro.js) already ends on a powered reactor; otherwise power it on here
  var introRunning = window.BOSSIntro && !window.BOSSIntro.done;
  if (!reducedMQ.matches && !introRunning && (window.scrollY || 0) < innerHeight) powerOn();

  var mm = gsap.matchMedia();
  mm.add({
    desktop: '(min-width: 900px)',
    mobile: '(max-width: 899.98px)',
    reduce: '(prefers-reduced-motion: reduce)'
  }, function (ctx) {
    var c = ctx.conditions;
    root.classList.toggle('is-reduced', c.reduce);
    Object.keys(sts).forEach(function (k) { delete sts[k]; });

    if (c.reduce) {
      eco.stop();
      eco.render(1);
      resetCounters();
      if (scene) scene.setKeyframes([{ y: 0, s: { ringOp: 0, partOp: .3, morph: 1 } }]);   // static, quiet backdrop
      return;
    }

    hero();
    welcome();
    what(c.desktop);
    modules();
    functionsSection();
    dashboard(c.desktop);
    howSection(c.desktop);
    owner();
    ecosystem(c.desktop);
    finale();
    demoSection();
    nav();

    ScrollTrigger.addEventListener('refresh', pushSceneKeys);
    pushSceneKeys();
    return function () {
      ScrollTrigger.removeEventListener('refresh', pushSceneKeys);
      resetCounters();
      clearHex($$('.mcard, .panel, .fx__panel, .demo__form'));
      $$('.step').forEach(function (s) { s.classList.remove('is-on'); });   // never leave a card half-dissolved after a breakpoint change
    };
  });

  // fonts and the logo image change layout metrics — re-measure once they land
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
