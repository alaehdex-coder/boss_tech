/* =========================================================
   BOSS — boot intro (Three.js), modelled on the BOSS reel:

   1. an armoured cable snakes in from the dark, red data inside
   2. connectors slide in and plug into the back of the reactor
   3. the turbine fins on the back light up
   4. camera swings to the front: hex tiles fly in, LED rings power on
   5. pull back onto the logo — lands exactly on the DOM hero reactor,
      then the overlay fades and the scroll site takes over

   Any wheel / touch / key / "Skip intro" jumps to the end.
   Not played with prefers-reduced-motion, without WebGL, or when
   the page loads already scrolled.
   ========================================================= */
(function () {
  'use strict';

  var PLAY_ONCE_PER_SESSION = false;   // true = only on the first visit in a browser tab

  var api = { done: true, onDone: function (cb) { cb(); } };
  window.BOSSIntro = api;

  var THREE = window.THREE, gsap = window.gsap;
  if (!THREE || !gsap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if ((window.scrollY || 0) > 10 || location.hash) return;
  if (PLAY_ONCE_PER_SESSION) {
    try { if (sessionStorage.getItem('bossIntro')) return; sessionStorage.setItem('bossIntro', '1'); } catch (e) { /* storage blocked: just play */ }
  }

  /* ---------- overlay ---------- */
  var wrap = document.createElement('div');
  wrap.className = 'intro';
  wrap.innerHTML =
    '<canvas class="intro__gl" aria-hidden="true"></canvas>' +
    '<div class="intro__hud" aria-hidden="true"><span>BOSS // System boot</span><b class="intro__pct">00%</b><i class="intro__bar"><em></em></i></div>' +
    '<button type="button" class="intro__skip">Skip intro</button>';
  document.body.appendChild(wrap);
  var canvas = wrap.querySelector('canvas');

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    wrap.remove();
    return;
  }

  var callbacks = [];
  api.done = false;
  api.onDone = function (cb) { if (api.done) cb(); else callbacks.push(cb); };

  var small = Math.min(innerWidth, innerHeight) < 700;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 1);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, .03);
  var camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .05, 120);

  // navy studio backdrop like the reel
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d'), grd = g.createRadialGradient(128, 90, 10, 128, 128, 190);
    grd.addColorStop(0, '#1c160b'); grd.addColorStop(.55, '#0a0805'); grd.addColorStop(1, '#000000');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    scene.background = new THREE.CanvasTexture(c);
  })();

  /* ---------- lights & materials ---------- */
  scene.add(new THREE.AmbientLight(0x2a2214, 1.1));
  var key = new THREE.DirectionalLight(0xfff0d0, 1.2); key.position.set(5, 8, 6); scene.add(key);
  var rim = new THREE.DirectionalLight(0xa8823a, .8); rim.position.set(-6, -2, -8); scene.add(rim);
  var redFront = new THREE.PointLight(0xf2c13e, 0, 14); redFront.position.set(0, 0, 4); scene.add(redFront);
  var redBack = new THREE.PointLight(0xf2c13e, 0, 9); redBack.position.set(0, 0, -1.4); scene.add(redBack);

  var RED = new THREE.Color(0xe0a62a), DIM = new THREE.Color(0x221805);   // "RED" = the lit accent (gold)
  var steel = new THREE.MeshPhongMaterial({ color: 0x5e5446, specular: 0xf3e2b8, shininess: 70 });
  var darkSteel = new THREE.MeshPhongMaterial({ color: 0x1d1912, specular: 0x6b5a3a, shininess: 35 });
  var plateMat = new THREE.MeshPhongMaterial({ color: 0x14110b, specular: 0x30281a, shininess: 12 });
  var redMat = new THREE.MeshBasicMaterial({ color: 0xf2c13e });

  var dot = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,246,214,1)'); grd.addColorStop(.25, 'rgba(242,193,62,.9)'); grd.addColorStop(1, 'rgba(233,182,50,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  var tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  var Z = new THREE.Vector3(0, 0, 1), IDQ = new THREE.Quaternion();
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* =========================================================
     THE REACTOR (front faces +z, matches the DOM hero reactor)
     logo = 4 world units wide, mesh plate r 2.31, segments r 2.38–2.62
     ========================================================= */
  var reactor = new THREE.Group();
  scene.add(reactor);

  var plate = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, .35, 72), plateMat);
  plate.rotation.x = Math.PI / 2;
  reactor.add(plate);
  var rimRing = new THREE.Mesh(new THREE.TorusGeometry(2.95, .09, 10, 120), steel);
  reactor.add(rimRing);

  // steel tunnel rings around it
  [[3.15, .05, -.1], [3.4, .13, -.25], [3.75, .04, -.35], [4.15, .16, -.5], [4.65, .06, -.65], [5.2, .12, -.85], [5.8, .05, -1]].forEach(function (r, i) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r[0], r[1], 10, 160), i % 2 ? darkSteel : plateMat);
    m.position.z = r[2];
    reactor.add(m);
  });

  // back: hub + turbine fins
  var hub = new THREE.Mesh(new THREE.CylinderGeometry(.6, .75, .5, 32), steel);
  hub.rotation.x = Math.PI / 2; hub.position.z = -.42;
  reactor.add(hub);
  var FINS = 56;
  var fins = new THREE.InstancedMesh(new THREE.BoxGeometry(.035, .82, .24), new THREE.MeshBasicMaterial({ color: 0xffffff }), FINS);
  for (var f = 0; f < FINS; f++) {
    var fa = f / FINS * Math.PI * 2;
    tmpQ.setFromEuler(new THREE.Euler(0, .35, fa - Math.PI / 2, 'ZYX'));
    tmpM.compose(tmpV.set(Math.cos(fa) * 1.98, Math.sin(fa) * 1.98, -.34), tmpQ, tmpS.set(1, 1, 1));
    fins.setMatrixAt(f, tmpM);
    fins.setColorAt(f, DIM);
  }
  reactor.add(fins);

  // front: hex mesh plate (tiles fly in)
  var HR = .125, hw = Math.sqrt(3) * HR * 1.1, hh = 1.5 * HR * 1.1;
  var hexGeo = new THREE.CylinderGeometry(HR, HR, .07, 6);
  hexGeo.rotateX(Math.PI / 2);
  var slots = [];
  for (var row = -13; row <= 13; row++) {
    for (var col = -13; col <= 13; col++) {
      var hx = col * hw + (row & 1 ? hw / 2 : 0), hy = row * hh;
      var hd = Math.sqrt(hx * hx + hy * hy);
      if (hd < 2.26) slots.push({ x: hx, y: hy, d: hd });
    }
  }
  // two kinds of tile: steel ones, and "hot" ones that glow red in flight and cool to steel as they lock in
  var cold = [], hot = [];
  slots.forEach(function (s) {
    s.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    if (Math.random() < .55) {
      // the stream: a band of tiles pouring in from the left through the ring (as in the reel)
      s.from = new THREE.Vector3(-7 - Math.random() * 9, s.y * .35 + (Math.random() - .5) * 1.2, 1.5 + Math.random() * 3);
      s.delay = .05 + Math.random() * .5;
    } else {
      var a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 5;
      s.from = new THREE.Vector3(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 3 + Math.random() * 7);
      s.delay = (1 - s.d / 2.26) * .45 + Math.random() * .2;
    }
    (Math.random() < .3 ? hot : cold).push(s);
  });
  var hexMat = new THREE.MeshPhongMaterial({ color: 0x221d14, specular: 0x6b5a3a, shininess: 30 });
  var hexes = new THREE.InstancedMesh(hexGeo, hexMat, cold.length);
  var hotHex = new THREE.InstancedMesh(hexGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), hot.length);
  hexes.position.z = hotHex.position.z = .2;
  reactor.add(hexes);
  reactor.add(hotHex);
  var HOT = new THREE.Color(0xffd56a), COOL = new THREE.Color(0x1f1a12);
  var plateBack = new THREE.Mesh(new THREE.CircleGeometry(2.33, 64), new THREE.MeshBasicMaterial({ color: 0x030405 }));
  plateBack.position.z = .18;
  reactor.add(plateBack);

  // front: LED segment rings
  function segRing(n, r0, r1, gapDeg, z) {
    var list = [], step = Math.PI * 2 / n, gap = gapDeg * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var start = Math.PI / 2 - (i + 1) * step + gap / 2;            // clockwise from 12 o'clock
      var m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 4, 1, start, step - gap), new THREE.MeshBasicMaterial({ color: DIM.clone(), side: THREE.DoubleSide }));
      m.position.z = z;
      reactor.add(m);
      list.push(m);
    }
    return list;
  }
  var segOut = segRing(30, 2.38, 2.62, 3.4, .24);
  var segIn = segRing(64, 2.21, 2.29, 2.2, .24);
  var trim = new THREE.Mesh(new THREE.RingGeometry(2.71, 2.73, 160), new THREE.MeshBasicMaterial({ color: 0xf2c13e, transparent: true, opacity: 0 }));
  trim.position.z = .24; reactor.add(trim);
  var glow = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.95, 128), new THREE.MeshBasicMaterial({ color: 0xf2c13e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.z = .26; reactor.add(glow);
  var TICKS = 120;
  var ticks = new THREE.InstancedMesh(new THREE.PlaneGeometry(.018, .08), new THREE.MeshBasicMaterial({ color: 0x8a7448, transparent: true, opacity: .5 }), TICKS);
  for (var t = 0; t < TICKS; t++) {
    var ta = t / TICKS * Math.PI * 2;
    tmpQ.setFromAxisAngle(Z, ta - Math.PI / 2);
    tmpM.compose(tmpV.set(Math.cos(ta) * 2.86, Math.sin(ta) * 2.86, .24), tmpQ, tmpS.set(1, 1, 1));
    ticks.setMatrixAt(t, tmpM);
  }
  reactor.add(ticks);

  // the logo (black disc vanishes with additive blending)
  var logoMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  var logo = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), logoMat);
  logo.position.z = .3;
  reactor.add(logo);
  new THREE.TextureLoader().load('assets/boss-logo.png', function (tx) { logoMat.map = tx; logoMat.needsUpdate = true; }, undefined, function () {
    new THREE.TextureLoader().load('assets/boss-logo.svg', function (tx) { logoMat.map = tx; logoMat.needsUpdate = true; });
  });

  /* =========================================================
     THE WIRES — armoured conduit + connectors, in "rigs" that slide in
     ========================================================= */
  function connector() {
    var g = new THREE.Group();
    var add = function (geo, mat, z) { var m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.z = z; g.add(m); return m; };
    add(new THREE.CylinderGeometry(.19, .19, .28, 20), steel, -.14);                 // nose
    add(new THREE.CylinderGeometry(.32, .32, 1.05, 24), darkSteel, -.8);            // body
    add(new THREE.CylinderGeometry(.327, .327, .07, 24), redMat, -.5);              // red bands
    add(new THREE.CylinderGeometry(.327, .327, .07, 24), redMat, -.68);
    add(new THREE.CylinderGeometry(.327, .327, .03, 24), redMat, -1.1);
    for (var k = 0; k < 4; k++) {                                                    // grip ribs
      var rib = new THREE.Mesh(new THREE.TorusGeometry(.33, .055, 8, 24), steel);
      rib.position.z = -1.42 - k * .12; g.add(rib);
    }
    add(new THREE.CylinderGeometry(.3, .2, .45, 20), darkSteel, -2.0);             // strain relief
    return g;                                                                       // tip at z=0, tail at z≈-2.2
  }

  function rig(y, curvePts, armoured) {
    var g = new THREE.Group();
    var conn = connector();
    conn.position.set(0, y, -4.6);
    g.add(conn);
    var curve = new THREE.CatmullRomCurve3(curvePts.map(function (p) { return new THREE.Vector3(p[0], p[1] + y, p[2]); }));
    var r = { group: g, curve: curve, wires: [], rings: null, ringU: [] };
    // bundle of inner wires (red ones glow, the rest dark steel)
    [[.13, .1, true], [-.12, .08, false], [.05, -.14, true], [-.08, -.12, false], [.2, -.03, false], [-.19, -.02, true], [0, .2, false], [.02, 0, false]].forEach(function (o, i) {
      if (!armoured && i > 1) return;
      var pts = curvePts.map(function (p) { return new THREE.Vector3(p[0] + o[0], p[1] + y + o[1], p[2]); });
      var geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, armoured ? .05 : .07, 6, false);
      var m = new THREE.Mesh(geo, o[2] ? new THREE.MeshBasicMaterial({ color: 0xb8861b }) : darkSteel);
      g.add(m);
      r.wires.push(m);
    });
    if (armoured) {
      // ribbed conduit: flat, broken steel bands along the curve (square cross-section, open arc)
      var len = curve.getLength(), N = Math.round(len / .25);
      var band = new THREE.Shape();
      band.absarc(0, 0, .5, 0, Math.PI * 1.6, false);
      band.absarc(0, 0, .39, Math.PI * 1.6, 0, true);
      var ribGeo = new THREE.ExtrudeGeometry(band, { depth: .15, bevelEnabled: false, curveSegments: 20 });
      ribGeo.translate(0, 0, -.075);
      var rings = new THREE.InstancedMesh(ribGeo, steel, N);
      for (var i = 0; i < N; i++) r.ringU.push(i / (N - 1));
      g.add(rings);
      r.rings = rings;
      r.samples = curve.getSpacedPoints(400);
      r.tangents = r.samples.map(function (_, j) { return curve.getTangentAt(j / 400); });
    }
    scene.add(g);
    return r;
  }

  // main armoured cable — ends at the centre connector, heading +z into the hub
  var main = rig(0, [[-7, -9, -32], [-3, -7, -25], [3, -4.5, -19.5], [4, -1, -14.5], [1.5, 1, -10.5], [0, .3, -8.4], [0, 0, -6.75]], true);
  var top = rig(1.05, [[3, 6, -22], [1.6, 3.2, -14], [.3, .9, -9.5], [0, 0, -6.75]], false);
  var bot = rig(-1.05, [[-3, -6, -21], [-1.4, -3, -13.5], [-.2, -.8, -9.4], [0, 0, -6.75]], false);

  // red data packets flowing through the main cable
  var DATA = small ? 140 : 240;
  var dPos = new Float32Array(DATA * 3), dSeed = [];
  for (var d = 0; d < DATA; d++) {
    dSeed.push({ u: Math.random(), sp: .06 + Math.random() * .08, ox: (Math.random() - .5) * .5, oy: (Math.random() - .5) * .5, oz: (Math.random() - .5) * .3 });
  }
  var dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  var data = new THREE.Points(dGeo, new THREE.PointsMaterial({ size: .34, map: dot, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  data.frustumCulled = false;
  main.group.add(data);

  function sampleAt(r, u) { return r.samples[Math.round(clamp(u, 0, 1) * 400)]; }

  /* =========================================================
     CHOREOGRAPHY
     ========================================================= */
  var S = { head: 0, follow: 1, plugC: 0, plugT: 0, plugB: 0, fins: 0, flash: 0, hex: 0, front: 0, inner: 0, logo: 0 };
  var cam = { px: 6.2, py: 1, pz: -3.8, tx: 0, ty: 0, tz: -2.2 };

  function finalDistance() {
    // the DOM hero logo is min(62vw, 50vh, 480px) wide; place the camera so 4 world units match it
    var L = Math.min(innerWidth * .62, innerHeight * .5, 480);
    return 4 * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * L);
  }

  var tl = gsap.timeline({ paused: true, onComplete: function () { finish(false); } });
  tl.to(S, { head: 1, duration: 2.6, ease: 'power1.inOut' }, 0)
    .to(S, { follow: 0, duration: .8, ease: 'power2.inOut' }, 2.15)
    .to(cam, { px: 5.2, py: .55, pz: -2.3, tz: -1.5, duration: 1.4, ease: 'sine.inOut' }, 2.4)
    .to(S, { plugC: 1, duration: 1, ease: 'power3.in' }, 2.55)
    .to(S, { plugT: 1, duration: .9, ease: 'power3.in' }, 2.75)
    .to(S, { plugB: 1, duration: .9, ease: 'power3.in' }, 2.9)
    .to(S, { flash: 1, duration: .05 }, 3.55)
    .to(S, { flash: 0, duration: .45 }, 3.6)
    .to(S, { fins: 1, duration: .8 }, 3.5)
    .to(cam, { px: 4.4, py: .9, pz: 4.4, tx: 0, ty: 0, tz: 0, duration: .9, ease: 'power2.in' }, 3.9)
    .to(cam, { px: 0, py: .3, pz: 7.2, duration: .8, ease: 'power2.out' }, 4.8)
    .to(S, { hex: 1, duration: 1.5 }, 4.45)
    .to(S, { front: 1, duration: .9 }, 4.9)
    .to(S, { inner: 1, duration: .6 }, 5.2)
    .to(cam, { px: 0, py: 0, pz: function () { return finalDistance(); }, duration: 1.1, ease: 'power2.inOut' }, 5.6)
    .to(S, { logo: 1, duration: .8 }, 5.7)
    .to({}, { duration: .25 }, 6.7);

  var pct = wrap.querySelector('.intro__pct'), bar = wrap.querySelector('.intro__bar em');

  /* ---------- per-frame update ---------- */
  var time = 0, last = performance.now(), running = true;
  var fpos = new THREE.Vector3(), ftgt = new THREE.Vector3(), lastHex = -1, lastFins = -1;

  function update(dt) {
    time += dt;

    main.group.position.z = S.plugC * 4.6;
    top.group.position.z = S.plugT * 4.6;
    bot.group.position.z = S.plugB * 4.6;

    // conduit grows behind the head
    var head = S.head * 1.04;
    main.ringU.forEach(function (u, i) {
      var s = clamp((head - u) / .03, 0, 1);
      var p = sampleAt(main, u), tg = main.tangents[Math.round(u * 400)];
      tmpQ.setFromUnitVectors(Z, tg);
      tmpQ.multiply(rollQ.setFromAxisAngle(Z, i * 2.1 + time * .6));
      tmpM.compose(p, tmpQ, tmpS.set(s, s, s));
      main.rings.setMatrixAt(i, tmpM);
    });
    main.rings.instanceMatrix.needsUpdate = true;
    [main, top, bot].forEach(function (r) {
      var grow = r === main ? head : 1;
      r.wires.forEach(function (w) { w.geometry.setDrawRange(0, Math.floor(w.geometry.index.count * clamp(grow, 0, 1) / 6) * 6); });
    });

    // data packets ride the cable (only where it already exists)
    for (var k = 0; k < DATA; k++) {
      var sd = dSeed[k];
      sd.u = (sd.u + dt * sd.sp * (1 + S.plugC * 2)) % 1;
      var u = sd.u * Math.min(head, 1), p = sampleAt(main, u);
      dPos[k * 3] = p.x + sd.ox; dPos[k * 3 + 1] = p.y + sd.oy; dPos[k * 3 + 2] = p.z + sd.oz;
    }
    dGeo.attributes.position.needsUpdate = true;

    // turbine fins light up around the ring once the plugs connect
    if (S.fins !== lastFins) {
      for (var fi = 0; fi < FINS; fi++) {
        var lit = clamp(S.fins * 1.5 - fi / FINS * .5, 0, 1);
        fins.setColorAt(fi, tmpCol.copy(DIM).lerp(RED, lit));
      }
      fins.instanceColor.needsUpdate = true;
      lastFins = S.fins;
    }

    // hex tiles fly in and lock to the plate
    if (S.hex !== lastHex) {
      var place = function (mesh, list, isHot) {
        list.forEach(function (s, i) {
          var e = ease(clamp((S.hex - s.delay) / .45, 0, 1));
          tmpV.copy(s.from).lerp(tmpV2.set(s.x, s.y, 0), e);
          tmpQ.copy(s.q).slerp(IDQ, e);
          var sc = e > 0 ? 1 : 0;
          tmpM.compose(tmpV, tmpQ, tmpS.set(sc, sc, sc));
          mesh.setMatrixAt(i, tmpM);
          if (isHot) mesh.setColorAt(i, tmpCol.copy(HOT).lerp(COOL, clamp((e - .75) / .25, 0, 1)));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (isHot && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      };
      place(hexes, cold, false);
      place(hotHex, hot, true);
      lastHex = S.hex;
    }

    // LED segments power on clockwise from 12 o'clock, a few flicker
    segOut.forEach(function (m, i) {
      var lit = clamp(S.front * 1.4 - i / segOut.length * .4, 0, 1);
      if (lit === 1 && i % 7 === 3) lit = .55 + .45 * (Math.sin(time * 9 + i) > -.6 ? 1 : 0);
      m.material.color.copy(DIM).lerp(RED, lit);
    });
    segIn.forEach(function (m, i) {
      m.material.color.copy(DIM).lerp(RED, clamp(S.inner * 1.3 - i / segIn.length * .3, 0, 1) * .8);
    });
    trim.material.opacity = S.front * .45;
    glow.material.opacity = S.front * .06 + S.flash * .2;
    redFront.intensity = S.front * .25 + S.flash * 1.2;
    redBack.intensity = S.fins * .8 + S.flash * 2.4;
    logoMat.opacity = S.logo;

    // camera: follow the cable head, then hand over to the keyed path
    // side-on to the cable so its ribbed body sweeps across the frame behind the head
    var hu = Math.min(S.head, 1), hp = sampleAt(main, hu), ht = main.tangents[Math.round(hu * 400)];
    side.crossVectors(ht, UP).normalize();
    var sway = Math.sin(time * .7) * .6;
    fpos.copy(hp).addScaledVector(ht, -2.2).addScaledVector(side, 3.6 + sway).add(tmpV3.set(0, 1.3, 0)).add(main.group.position);
    ftgt.copy(hp).addScaledVector(ht, -1.4).add(main.group.position);
    var w = S.follow;
    camera.position.set(cam.px + (fpos.x - cam.px) * w, cam.py + (fpos.y - cam.py) * w, cam.pz + (fpos.z - cam.pz) * w);
    camera.lookAt(cam.tx + (ftgt.x - cam.tx) * w, cam.ty + (ftgt.y - cam.ty) * w, cam.tz + (ftgt.z - cam.tz) * w);

    var pr = Math.round(tl.progress() * 100);
    pct.textContent = (pr < 10 ? '0' : '') + pr + '%';
    bar.style.transform = 'scaleX(' + tl.progress().toFixed(3) + ')';

    renderer.render(scene, camera);
  }
  var tmpCol = new THREE.Color(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3(), rollQ = new THREE.Quaternion();
  var side = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  function frame(now) {
    if (!running) return;
    var dt = Math.min(.05, (now - last) / 1000);
    last = now;
    update(dt);
    requestAnimationFrame(frame);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    // portrait phones: widen the lens so shots framed for landscape (cable, connectors) stay in frame
    camera.fov = camera.aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(22.5)) * .85 / camera.aspect)) : 45;
    camera.fov = Math.min(camera.fov, 80);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- skip & finish ---------- */
  var finished = false;
  function finish(skipped) {
    if (finished) return;
    finished = true;
    detach();
    if (skipped) tl.progress(1, true);
    api.done = true;
    callbacks.splice(0).forEach(function (cb) { cb(); });
    gsap.to(wrap, {
      opacity: 0, duration: skipped ? .35 : .8, ease: 'power1.inOut',
      onComplete: function () {
        running = false;
        removeEventListener('resize', resize);
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
        wrap.remove();
      }
    });
  }
  function skip(e) {
    if (e && e.cancelable) e.preventDefault();
    finish(true);
  }
  function onKey(e) {
    if (['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown', 'End'].indexOf(e.key) > -1) skip(e);
  }
  wrap.querySelector('.intro__skip').addEventListener('click', skip);
  addEventListener('wheel', skip, { passive: false });
  addEventListener('touchmove', skip, { passive: false });
  addEventListener('keydown', onKey);
  function detach() {
    removeEventListener('wheel', skip);
    removeEventListener('touchmove', skip);
    removeEventListener('keydown', onKey);
  }

  update(0);
  requestAnimationFrame(frame);
  tl.play();
})();
