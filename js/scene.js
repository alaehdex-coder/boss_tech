/* =========================================================
   BOSS — WebGL backdrop (Three.js)
   Gold halo rings, a particle field that morphs between
   "ring formation" and "deep field", light streaks and a
   tunnel of rings the camera flies through.

   It owns no scroll logic: main.js hands it keyframes
   ({ y: scrollPx, s: state }) and the render loop eases
   toward the state sampled at the current scroll position.
   ========================================================= */
(function () {
  'use strict';

  var KEYS = ['camZ', 'ringOp', 'ringScale', 'ringSize', 'ringY', 'morph', 'partOp', 'streak', 'tunnel', 'wires'];
  var DEFAULT = { camZ: 12, ringOp: .25, ringScale: .95, ringSize: 1, ringY: 0, morph: 0, partOp: .55, streak: 0, tunnel: 0, wires: 0 };

  var api = { init: init, setKeyframes: setKeyframes, setVelocity: function (v) { velocity = v; }, ready: false };
  var velocity = 0;   // scroll velocity (px/s, signed) — drives the data flow in the wires
  window.BOSSScene = api;

  var keyframes = [];
  var sampled = {};

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function smoothstep(a, b, v) { return smooth(clamp((v - a) / (b - a), 0, 1)); }

  function setKeyframes(list) {
    // carry each key forward so a keyframe only needs to name what changes
    var prev = Object.assign({}, DEFAULT);
    keyframes = list.slice().sort(function (a, b) { return a.y - b.y; }).map(function (k) {
      prev = Object.assign({}, prev, k.s);
      return { y: k.y, s: prev };
    });
    if (api.ready && api.renderOnce) api.renderOnce();
  }

  function sample(y) {
    var k = keyframes, i, a, b, t;
    if (!k.length) return DEFAULT;
    if (y <= k[0].y) return k[0].s;
    if (y >= k[k.length - 1].y) return k[k.length - 1].s;
    for (i = 0; i < k.length - 1; i++) {
      a = k[i]; b = k[i + 1];
      if (y >= a.y && y <= b.y) {
        t = b.y === a.y ? 1 : smooth((y - a.y) / (b.y - a.y));
        for (var j = 0; j < KEYS.length; j++) sampled[KEYS[j]] = a.s[KEYS[j]] + (b.s[KEYS[j]] - a.s[KEYS[j]]) * t;
        return sampled;
      }
    }
    return k[k.length - 1].s;
  }

  function init(canvas, opts) {
    opts = opts || {};
    if (!canvas || !window.THREE) { if (canvas) canvas.style.display = 'none'; return; }
    var THREE = window.THREE;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
      canvas.style.display = 'none';
      return;
    }

    var small = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5));
    renderer.setClearColor(0x000000, 1);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, .1, 200);
    camera.position.set(0, 0, DEFAULT.camZ);

    var GOLD = new THREE.Color('#e9b632');
    var GOLD_HI = new THREE.Color('#ffe58a');
    var additive = { transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false };

    /* ---- halo rings (echo the logo's outer rings) ---- */
    var ringGroup = new THREE.Group();
    scene.add(ringGroup);
    var ringDefs = [{ r: 2.95, t: .010 }, { r: 3.18, t: .026 }, { r: 3.42, t: .008 }];
    var rings = ringDefs.map(function (d, i) {
      var m = new THREE.Mesh(
        new THREE.TorusGeometry(d.r, d.t, 8, 240),
        new THREE.MeshBasicMaterial(Object.assign({ color: i === 1 ? GOLD : GOLD_HI }, additive))
      );
      ringGroup.add(m);
      return m;
    });

    /* ---- tunnel rings along -z ---- */
    var tunnel = [];
    for (var ti = 0; ti < 18; ti++) {
      var tm = new THREE.Mesh(
        new THREE.TorusGeometry(4.6 + (ti % 3) * .3, .012, 6, 180),
        new THREE.MeshBasicMaterial(Object.assign({ color: ti % 2 ? GOLD : GOLD_HI }, additive))
      );
      tm.position.z = -6 - ti * 5.2;
      tm.rotation.z = ti * .7;
      scene.add(tm);
      tunnel.push(tm);
    }

    /* ---- particles: ring formation <-> deep field ---- */
    var N = small ? 1800 : 4200;
    var field = new Float32Array(N * 3), ringPos = new Float32Array(N * 3), seed = new Float32Array(N);
    var TAU = Math.PI * 2;
    for (var i = 0; i < N; i++) {
      var a = Math.random() * TAU, rad = 1.6 + Math.pow(Math.random(), .65) * 13;
      field[i * 3] = Math.cos(a) * rad;
      field[i * 3 + 1] = Math.sin(a) * rad;
      field[i * 3 + 2] = 14 - Math.random() * 110;

      var pick = Math.random(), base = pick < .4 ? 2.95 : pick < .8 ? 3.18 : 3.42;
      var a2 = Math.random() * TAU, jit = (Math.random() - .5) * .16 * (1 + Math.random() * 2);
      ringPos[i * 3] = Math.cos(a2) * (base + jit);
      ringPos[i * 3 + 1] = Math.sin(a2) * (base + jit);
      ringPos[i * 3 + 2] = (Math.random() - .5) * .3;
      seed[i] = Math.random();
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(field, 3));
    pGeo.setAttribute('aRing', new THREE.BufferAttribute(ringPos, 3));
    pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    var pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 }, uMorph: { value: 0 }, uOpacity: { value: 0 },
        uSize: { value: small ? 30 : 34 }, uPR: { value: renderer.getPixelRatio() }, uFit: { value: 1 }, uRingY: { value: 0 }
      },
      vertexShader: [
        'uniform float uTime, uMorph, uSize, uPR, uOpacity, uFit, uRingY;',
        'attribute vec3 aRing; attribute float aSeed;',
        'varying float vA; varying float vS;',
        'void main(){',
        '  float m = smoothstep(0., 1., clamp(uMorph * 1.3 - aSeed * .3, 0., 1.));',
        '  vec3 p = mix(aRing * uFit + vec3(0., uRingY, 0.), position, m);',
        '  p.x += sin(uTime * .3 + aSeed * 40.) * .06;',
        '  p.y += cos(uTime * .25 + aSeed * 31.) * .06;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
        '  gl_Position = projectionMatrix * mv;',
        '  float tw = .55 + .45 * sin(uTime * 1.7 + aSeed * 60.);',
        '  gl_PointSize = uSize * uPR * (.4 + aSeed * .9) * (.8 + .4 * tw) / -mv.z;',
        '  vA = uOpacity * tw * smoothstep(.3, 1.6, -mv.z) * (1. - smoothstep(40., 75., -mv.z));',
        '  vS = aSeed;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying float vA; varying float vS;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5);',
        '  float a = smoothstep(.5, 0., d); a *= a;',
        '  vec3 col = mix(vec3(.91, .66, .16), vec3(1., .93, .65), vS);',
        '  gl_FragColor = vec4(col, a * vA);',
        '}'
      ].join('\n')
    });
    var points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    scene.add(points);

    /* ---- light streaks that rush past the camera ---- */
    var S = small ? 140 : 300, depth = 60;
    var sPos = new Float32Array(S * 2 * 3), sEnd = new Float32Array(S * 2);
    for (var si = 0; si < S; si++) {
      var sa = Math.random() * TAU, sr = 1.2 + Math.random() * 9, sz = Math.random() * depth;
      for (var e = 0; e < 2; e++) {
        var o = (si * 2 + e);
        sPos[o * 3] = Math.cos(sa) * sr; sPos[o * 3 + 1] = Math.sin(sa) * sr; sPos[o * 3 + 2] = sz;
        sEnd[o] = e;
      }
    }
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('aEnd', new THREE.BufferAttribute(sEnd, 1));
    var sMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTravel: { value: 0 }, uLen: { value: .2 }, uCamZ: { value: 12 }, uOpacity: { value: 0 } },
      vertexShader: [
        'uniform float uTravel, uLen, uCamZ, uOpacity;',
        'attribute float aEnd; varying float vA;',
        'void main(){',
        '  float depth = ' + depth.toFixed(1) + ';',
        '  float z = mod(position.z + uTravel, depth);',
        '  float f = z / depth;',
        '  vec3 p = vec3(position.xy, uCamZ - depth + z - 1. - aEnd * uLen);',
        '  vA = uOpacity * smoothstep(0., .35, f) * (1. - smoothstep(.9, 1., f)) * (1. - aEnd * .9);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);',
        '}'
      ].join('\n'),
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(1., .86, .5, vA); }'
    });
    var streaks = new THREE.LineSegments(sGeo, sMat);
    streaks.frustumCulled = false;
    scene.add(streaks);

    /* ---- data cables running the length of the tunnel ----
       Steel tubes that spiral along -z; bright packets travel along them.
       Packet speed follows scroll velocity (scrolling up runs them backwards). */
    var shared = { uTime: { value: 0 }, uFlow: { value: 0 }, uOpacity: { value: 0 }, uCamZ: { value: 12 } };
    var wireDefs = [];
    var CABLES = small ? 7 : 12;
    for (var wi = 0; wi < CABLES; wi++) {
      var gold = wi % 4 === 0;
      wireDefs.push({
        a0: wi / CABLES * TAU + (Math.random() - .5) * .3,
        rad: 3.1 + (wi % 3) * 1.05 + Math.random() * .4,
        twist: (wi % 2 ? 1 : -1) * (.018 + Math.random() * .02),
        thick: gold ? .09 : .035 + Math.random() * .03,
        col: gold ? new THREE.Color('#fff0b0') : new THREE.Color('#d99a1e'),
        seed: Math.random()
      });
    }
    wireDefs.forEach(function (w) {
      var pts = [];
      for (var z = 16; z >= -104; z -= 4) {
        var ang = w.a0 + z * w.twist + Math.sin(z * .09 + w.seed * 9) * .18;
        var rr = w.rad + Math.sin(z * .07 + w.seed * 20) * .5;
        pts.push(new THREE.Vector3(Math.cos(ang) * rr, Math.sin(ang) * rr, z));
      }
      var curve = new THREE.CatmullRomCurve3(pts);
      var mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: {
          uTime: shared.uTime, uFlow: shared.uFlow, uOpacity: shared.uOpacity, uCamZ: shared.uCamZ,
          uCol: { value: w.col }, uSeed: { value: w.seed }, uLen: { value: curve.getLength() }
        },
        vertexShader: [
          'varying vec2 vUv; varying float vZ; varying vec3 vN;',
          'void main(){',
          '  vUv = uv; vN = normalize(normalMatrix * normal);',
          '  vec4 wp = modelMatrix * vec4(position, 1.); vZ = wp.z;',
          '  gl_Position = projectionMatrix * viewMatrix * wp;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform float uTime, uFlow, uOpacity, uCamZ, uSeed, uLen; uniform vec3 uCol;',
          'varying vec2 vUv; varying float vZ; varying vec3 vN;',
          'void main(){',
          '  float diff = max(dot(vN, normalize(vec3(.3, .8, .5))), 0.);',
          '  float spec = pow(max(dot(vN, normalize(vec3(-.2, .5, .85))), 0.), 14.);',
          '  vec3 col = vec3(.09, .075, .05) * (.45 + .9 * diff) + vec3(.55, .44, .26) * spec;',
          '  float s = vUv.x * uLen;',
          '  float q = fract(s / (7. + uSeed * 6.) - uFlow * (.8 + uSeed * .6) + uSeed);',
          '  float packet = pow(q, 22.) * 2.4 + pow(q, 3.) * .25;',              // bright head, soft tail
          '  float idle = .12 + .08 * sin(s * .8 - uTime * 2. + uSeed * 30.);',
          '  col += uCol * (packet + idle);',
          '  float fade = smoothstep(uCamZ - 75., uCamZ - 35., vZ);',
          '  gl_FragColor = vec4(col, uOpacity * fade);',
          '}'
        ].join('\n')
      });
      var mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, small ? 220 : 420, w.thick, 6, false), mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
    });
    var flow = 0;

    /* ---- sizing: keep the halo rings just outside the DOM logo ---- */
    var fit = 1;
    var halfH0 = DEFAULT.camZ * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); // half-height of the view at the ring plane
    function resize() {
      var w = innerWidth, h = innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      var logoPx = Math.min(w * .62, h * .50, 480);      // matches .logo3d width in CSS
      var halfH = DEFAULT.camZ * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      fit = (1.08 * (logoPx / h) * halfH) / 2.95;
    }
    resize();
    addEventListener('resize', resize);

    /* ---- pointer parallax ---- */
    var px = 0, py = 0, tx = 0, ty = 0;
    if (!opts.reduced) {
      addEventListener('pointermove', function (ev) {
        tx = ev.clientX / innerWidth - .5;
        ty = ev.clientY / innerHeight - .5;
      }, { passive: true });
    }

    /* ---- render ---- */
    var state = Object.assign({}, DEFAULT);
    var time = 0, travel = 0, last = performance.now();

    function apply(dt) {
      var tgt = sample(window.scrollY || window.pageYOffset || 0);
      var k = dt ? 1 - Math.exp(-dt * 5) : 1;
      for (var j = 0; j < KEYS.length; j++) state[KEYS[j]] += (tgt[KEYS[j]] - state[KEYS[j]]) * k;

      px += (tx - px) * (dt ? 1 - Math.exp(-dt * 3) : 1);
      py += (ty - py) * (dt ? 1 - Math.exp(-dt * 3) : 1);

      camera.position.set(px * .8, -py * .6, state.camZ);
      camera.lookAt(px * .15, -py * .1, state.camZ - 20);
      camera.rotation.z += Math.sin(time * .15) * .02;

      ringGroup.scale.setScalar(fit * state.ringSize);
      pMat.uniforms.uFit.value = fit * state.ringSize;
      ringGroup.position.y = state.ringY * halfH0;
      pMat.uniforms.uRingY.value = state.ringY * halfH0;
      rings.forEach(function (r, i) {
        var spread = state.ringScale - 1;
        r.scale.setScalar(1 + spread * (1 + i * .35));
        r.rotation.z += dt * .05 * (i + 1) * (i % 2 ? -1 : 1);
        r.rotation.x = spread * .35 * (i - 1) + Math.sin(time * .3 + i) * .04;
        r.rotation.y = spread * .25 * (1 - i);
        r.material.opacity = state.ringOp * (i === 1 ? .9 : .6);
      });

      tunnel.forEach(function (m, i) {
        var dist = state.camZ - m.position.z;
        var fade = dist > 0 ? smoothstep(0, 3, dist) * (1 - smoothstep(18, 42, dist)) : 0;
        m.material.opacity = state.tunnel * fade * .6;
        m.rotation.z += dt * .04 * (i % 2 ? 1 : -1);
      });

      points.rotation.z += dt * .015;
      pMat.uniforms.uTime.value = time;
      pMat.uniforms.uMorph.value = state.morph;
      pMat.uniforms.uOpacity.value = state.partOp;

      travel += dt * (6 + state.streak * 70);
      sMat.uniforms.uTravel.value = travel;
      sMat.uniforms.uLen.value = .15 + state.streak * 7;
      sMat.uniforms.uCamZ.value = state.camZ;
      sMat.uniforms.uOpacity.value = state.streak * .85;

      velocity *= dt ? Math.exp(-dt * 2.5) : 1;
      flow += dt * (.25 + clamp(velocity / 1800, -3, 3));
      shared.uTime.value = time;
      shared.uFlow.value = flow;
      shared.uOpacity.value = state.wires;
      shared.uCamZ.value = state.camZ;

      renderer.render(scene, camera);
    }

    function frame(now) {
      var dt = Math.min(.05, (now - last) / 1000);
      last = now;
      time += dt;
      // while the boot intro covers the page, skip rendering this scene (no double GPU work)
      if (!(window.BOSSIntro && !window.BOSSIntro.done)) apply(dt);
      requestAnimationFrame(frame);
    }

    api.renderOnce = function () { apply(0); };
    api.ready = true;

    if (opts.reduced) {
      apply(0);
      addEventListener('resize', function () { apply(0); });
    } else {
      requestAnimationFrame(frame);
    }
  }
})();
