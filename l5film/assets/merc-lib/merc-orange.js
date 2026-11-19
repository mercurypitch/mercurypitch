// Merc renderer (orange) for tools/merc-pass.mjs, built by tools/build-merc.mjs from b5ddaf2d7 (src/lib/merc last changed in 124c04f52). Generated: do not edit.
"use strict";
(() => {
  // src/lib/merc/constants.ts
  var STATES = [
    "drop",
    "idle",
    "listen",
    "sing",
    "lock",
    "climb",
    "celebrate",
    "point",
    "sleep",
    "hop",
    // The glide rooms (Ng slides, Lip roll): humming, and riding the voice.
    "hum",
    "ride",
    // The onboarding's range: climbing with the voice's height (S7b §3.3).
    "reach"
  ];
  function isMercState(name) {
    return STATES.includes(name);
  }
  var REACH_CENTS = 700;
  var SHAPE = {
    // Heights are from the floor. bodyY0 is where the colour and the squash
    // count from (h = 0); restH is the crown tip. Pass 4 seated the body 0.07
    // lower on its feet, as painted, so every body height moved down by that.
    bodyY0: -0.015,
    restH: 1.225,
    // One oval belly and a round-cone crown, blended. Fitted to the concept's
    // front outline (three figures, 0.2 px rms at 183 px tall): the belly is a
    // plain ellipse, so the bottom is a single smooth curve with no flat disc.
    bulbY: 0.4105,
    bulbR: [0.4955, 0.3751, 0.4756],
    coneY: 0.5912,
    coneR1: 0.3972,
    coneR2: 0.1589,
    coneH: 0.4747,
    tipPinch: 0.065,
    bodyK: 0.2327,
    // The painted base is flatter than the oval: the underside is cut level,
    // smoothly, a little above the oval's pole (base widths match the three
    // figures down to the feet).
    flatY: 0.0644,
    flatK: 0.05,
    // Feet: jelly beans tucked under the body, each 0.22 of the width across,
    // longer front to back, toes out a little and fuller at the outer end; the
    // body's edge passes in front of their tops.
    footC: [0.225, 0.05, 0.2],
    footR: [0.102, 0.05, 0.12],
    footK: 0.016,
    footToe: 10,
    nub: [0.3, 0.545, 0.05],
    // Eyes: size and place measured on the painted front figures (each eye
    // 0.17 of the width across and 0.32 of the height tall, centres 0.19 out
    // and 0.6 down).
    eyeX: 0.176,
    eyeY: 0.588,
    // The domes stand proud of the body by about 0.03 with steep sides, so a
    // turned view shows their edge, as in the three-quarter paintings.
    eyeR: [0.0901, 0.1909, 0.039],
    // How far each eye's top leans in toward the middle, in degrees.
    eyeTilt: 3,
    eyeEmbed: 8e-3,
    // The eye's top is drawn this much narrower (its bottom fuller): the
    // painted eye is an ellipse a touch fuller at the bottom (top quarter about
    // 0.9 the width of the bottom quarter).
    eyeEgg: -0.06,
    mouthY: 0.407,
    coreY: 0.285
  };
  var PALETTE = {
    stops: [
      [0, "#04ecd8"],
      [0.136, "#04ecd8"],
      [0.232, "#129e9b"],
      [0.328, "#1a73b1"],
      [0.424, "#0062d0"],
      [0.52, "#016be5"],
      [0.616, "#105eec"],
      [0.712, "#2747f0"],
      [0.808, "#5133f3"],
      [0.904, "#8841f5"],
      [1, "#be6cf5"]
    ],
    bead: ["#0566aa", "#16b2e4"]
  };
  var GRAD_N = 12;
  var LOOK = {
    edge: [0.6, 1, 1.6, 0.225],
    edge2: [-0.2525, 0.35, 0.4, 0.4],
    crown: [0.85, 0.67, 0.0575, 0.07],
    shoulder: [0.62, 0.77, 0.0725, 0.06],
    k: [1.25, 1.45, 0.55, 0.8],
    tint: "#f6f2ff",
    tint2: "#64cbfa"
  };
  var QUALITY = {
    low: { scale: 0.5, spp: 1, steps: 48, edgeAA: 1 },
    medium: { scale: 0.75, spp: 1, steps: 64, edgeAA: 1 },
    high: { scale: 1, spp: 4, steps: 96, edgeAA: 0 },
    ultra: { scale: 1, spp: 9, steps: 128, edgeAA: 0 }
  };
  function isMercQuality(name) {
    return Object.hasOwn(QUALITY, name);
  }
  var VIEWS = {
    front: { yaw: 0, pitch: 0.13, dist: 4.2, target: [0, 0.67, 0], fov: 30 },
    // The hero: a slight orbit with Merc turned to face it, so the face sits
    // in the middle of the frame like the art's front-facing hero.
    hero: { yaw: 0.34, pitch: 0.15, dist: 4.1, target: [0, 0.63, 0], fov: 30 },
    // Study views, for comparing with the turnaround sheets.
    threequarter: {
      yaw: 0.79,
      pitch: 0.13,
      dist: 4.2,
      target: [0, 0.67, 0],
      fov: 30
    },
    side: { yaw: 1.5708, pitch: 0.13, dist: 4.2, target: [0, 0.67, 0], fov: 30 }
  };
  var BG = [13 / 255, 17 / 255, 23 / 255];
  var BLOOM = { tight: 0.7, wide: 1.1, overBody: 0.92 };
  var RIM = { width: 0.013, strength: 0.5 };
  var LIGHT_SLOTS = [
    // the floor: the pool under him, its wide wash, foot streaks, landing
    // rings, the stop marks
    "pool",
    "wash",
    "footStreak",
    "ring",
    "stops",
    // the eyes: the glow low in them, the crescent, the lighter edge
    "eyeGlow",
    "eyeCrescent",
    "eyeEdge",
    // droplets, the left key, the hot core, the nub, the feet's sheen and glint
    "drops",
    "key",
    "core",
    "nub",
    "glintSheen",
    "glint",
    // sound arcs and the climb arrow, motion dots, speed lines, the echo trail
    "arcs",
    "dots",
    "speed",
    "trail"
  ];
  var LIGHT = {
    pool: [0.03, 0.42, 0.52],
    wash: [0.03, 0.12, 0.5],
    footStreak: [0.08, 0.5, 0.62],
    ring: [0.3, 0.85, 1],
    stops: [0.3, 0.55, 1],
    eyeGlow: [1e-3, 6e-3, 0.022],
    eyeCrescent: [0.04, 0.5, 0.46],
    eyeEdge: [6e-3, 8e-3, 0.022],
    drops: [0.12, 0.72, 0.78],
    key: [0.22, 0.55, 1],
    core: [0.02, 0.34, 0.28],
    nub: [0.12, 0.5, 0.62],
    glintSheen: [0.45, 0.85, 1],
    glint: [0.37, 0.65, 0.97],
    arcs: [0.62, 0.78, 1],
    dots: [0.55, 0.75, 1],
    speed: [0.6, 0.75, 1],
    trail: [0.8, 0.95, 1]
  };

  // src/lib/merc/rest-space.ts
  var norm3 = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  var cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  var smoothJ = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  function sminJ(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  function ellipsoidJ(x, y, z, r) {
    const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
    const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
    return k0 * (k0 - 1) / Math.max(k1, 1e-6);
  }
  function restBody(x, y, z) {
    const S = SHAPE;
    const e = ellipsoidJ(x, y - S.bulbY, z, S.bulbR);
    const r1 = S.coneR1;
    const r2 = S.coneR2;
    const h = S.coneH;
    const b = (r1 - r2) / h;
    const a = Math.sqrt(1 - b * b);
    const dt = S.restH - y;
    const pn = S.tipPinch * smoothJ(0.01, 0.045, dt) * (1 - smoothJ(0.05, 0.14, dt));
    const qx = Math.hypot(x, z) / (1 - pn);
    const qy = y - S.coneY;
    const kk = -b * qx + a * qy;
    let c;
    if (kk < 0) c = Math.hypot(qx, qy) - r1;
    else if (kk > a * h) c = Math.hypot(qx, qy - h) - r2;
    else c = qx * a + qy * b - r1;
    c *= 1 - pn;
    return -sminJ(-sminJ(e, c, S.bodyK), y - S.flatY, S.flatK);
  }
  function placeEyes(lookX, lookY) {
    const out = [];
    for (const side of [-1, 1]) {
      const x0 = side * SHAPE.eyeX + lookX * 0.035;
      const y0 = SHAPE.eyeY + lookY * 0.03;
      let lo = 0;
      let hi = 0.8;
      for (let i = 0; i < 28; i++) {
        const m = (lo + hi) / 2;
        if (restBody(x0, y0, m) < 0) lo = m;
        else hi = m;
      }
      const z = (lo + hi) / 2;
      const e = 1e-3;
      const n = norm3([
        restBody(x0 + e, y0, z) - restBody(x0 - e, y0, z),
        restBody(x0, y0 + e, z) - restBody(x0, y0 - e, z),
        restBody(x0, y0, z + e) - restBody(x0, y0, z - e)
      ]);
      const em = SHAPE.eyeEmbed;
      const t = -side * Math.tan(SHAPE.eyeTilt * Math.PI / 180);
      const up = norm3([t, 1, -(t * n[0] + n[1]) / n[2]]);
      out.push({
        c: [x0 - n[0] * em, y0 - n[1] * em, z - n[2] * em],
        x: norm3(cross3(up, n)),
        z: n
      });
    }
    return [out[0], out[1]];
  }
  function toRestJS(p, P) {
    let x = p[0] - P.root[0];
    let y = p[1] - P.root[1];
    let z = p[2] - P.root[2];
    const [s, melt, cy, sy] = P.shape;
    [x, z] = [cy * x - sy * z, sy * x + cy * z];
    const hy = Math.min(
      1.4,
      Math.max(
        0,
        (y - SHAPE.bodyY0 + 0.055) / (SHAPE.restH - SHAPE.bodyY0 + 0.055)
      )
    );
    let a = P.lean[0] * hy;
    [x, y] = [
      Math.cos(a) * x - Math.sin(a) * y,
      Math.sin(a) * x + Math.cos(a) * y
    ];
    a = P.lean[1] * hy;
    [z, y] = [
      Math.cos(a) * z - Math.sin(a) * y,
      Math.sin(a) * z + Math.cos(a) * y
    ];
    const sw = smoothJ(0.25 + SHAPE.bodyY0, 1.2 + SHAPE.bodyY0, y) ** 2;
    x -= P.lean[2] * sw;
    z -= P.lean[3] * sw;
    const yw = y;
    y = yw / s;
    if (s < 0.999) {
      const st = s + (1 - s) * 0.65;
      const y1 = (0.72 + SHAPE.bodyY0) * s;
      y -= (1 / s - 1 / st) * 0.07 * Math.log(1 + Math.exp((yw - y1) / 0.07));
    }
    x *= Math.sqrt(s);
    z *= Math.sqrt(s);
    const m = 1 + melt * 0.75 * (1 - smoothJ(SHAPE.bodyY0, 0.8 + SHAPE.bodyY0, y));
    return [x / m, y, z / m];
  }
  function jacobian(p, P) {
    const e = 1e-4;
    const J = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let j = 0; j < 3; j++) {
      const a = p.slice();
      const b = p.slice();
      a[j] += e;
      b[j] -= e;
      const fa = toRestJS(a, P);
      const fb = toRestJS(b, P);
      for (let i = 0; i < 3; i++) J[i][j] = (fa[i] - fb[i]) / (2 * e);
    }
    return J;
  }
  function solve3(J, r) {
    const [[a, b, c], [d, e, f2], [g, h, i]] = J;
    const A = e * i - f2 * h;
    const B = -(d * i - f2 * g);
    const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    if (Math.abs(det) < 1e-12) return [0, 0, 0];
    const inv = [
      [A, -(b * i - c * h), b * f2 - c * e],
      [B, a * i - c * g, -(a * f2 - c * d)],
      [C, -(a * h - b * g), a * e - b * d]
    ];
    const row = (k) => (inv[k][0] * r[0] + inv[k][1] * r[1] + inv[k][2] * r[2]) / det;
    return [row(0), row(1), row(2)];
  }
  function restToWorldExact(r, P, guess) {
    let p = guess.slice();
    for (let it = 0; it < 8; it++) {
      const f2 = toRestJS(p, P);
      const e = [r[0] - f2[0], r[1] - f2[1], r[2] - f2[2]];
      if (Math.hypot(e[0], e[1], e[2]) < 1e-7) break;
      const dp = solve3(jacobian(p, P), e);
      p = [p[0] + dp[0], p[1] + dp[1], p[2] + dp[2]];
    }
    return p;
  }
  function bendAt(p, P) {
    let x = p[0] - P.root[0];
    let y = p[1] - P.root[1];
    let z = p[2] - P.root[2];
    const [, , cy, sy] = P.shape;
    [x, z] = [cy * x - sy * z, sy * x + cy * z];
    const hy = Math.min(
      1.4,
      Math.max(
        0,
        (y - SHAPE.bodyY0 + 0.055) / (SHAPE.restH - SHAPE.bodyY0 + 0.055)
      )
    );
    let a = P.lean[0] * hy;
    [x, y] = [
      Math.cos(a) * x - Math.sin(a) * y,
      Math.sin(a) * x + Math.cos(a) * y
    ];
    a = P.lean[1] * hy;
    [z, y] = [
      Math.cos(a) * z - Math.sin(a) * y,
      Math.sin(a) * z + Math.cos(a) * y
    ];
    return [hy, smoothJ(0.25 + SHAPE.bodyY0, 1.2 + SHAPE.bodyY0, y) ** 2];
  }

  // src/lib/merc/gl.ts
  var srgbToLin = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  var hexLin = (h) => [
    srgbToLin(parseInt(h.slice(1, 3), 16) / 255),
    srgbToLin(parseInt(h.slice(3, 5), 16) / 255),
    srgbToLin(parseInt(h.slice(5, 7), 16) / 255)
  ];
  function paletteUniforms(P) {
    const h = new Float32Array(GRAD_N);
    const c = new Float32Array(GRAD_N * 3);
    for (let i = 0; i < GRAD_N; i++) {
      const st = P.stops[Math.min(i, P.stops.length - 1)];
      h[i] = i < P.stops.length ? st[0] : 1 + 0.1 * (i - P.stops.length + 1);
      c.set(hexLin(st[1]), i * 3);
    }
    return {
      h,
      c,
      bead: new Float32Array([...hexLin(P.bead[0]), ...hexLin(P.bead[1])])
    };
  }
  function lookUniforms(look) {
    return {
      edge: new Float32Array(look.edge),
      edge2: new Float32Array(look.edge2),
      crown: new Float32Array(look.crown),
      shoulder: new Float32Array(look.shoulder),
      k: new Float32Array(look.k),
      tint: new Float32Array(hexLin(look.tint)),
      tint2: new Float32Array(hexLin(look.tint2))
    };
  }
  function lightUniforms(light) {
    return new Float32Array(LIGHT_SLOTS.flatMap((slot) => light[slot]));
  }
  function cameraFor(view) {
    const { yaw, pitch, dist, target, fov } = view;
    const cp = Math.cos(pitch);
    const pos = [
      target[0] + dist * cp * Math.sin(yaw),
      target[1] + dist * Math.sin(pitch),
      target[2] + dist * cp * Math.cos(yaw)
    ];
    const fw = norm3([target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]);
    const right = norm3(cross3(fw, [0, 1, 0]));
    const up = cross3(right, fw);
    return { pos, fw, right, up, focal: 1 / Math.tan(fov * Math.PI / 180 / 2) };
  }
  var flat = (arr, n, width) => {
    const out = new Float32Array(n * width);
    arr.slice(0, n).forEach((v, i) => out.set(v.slice(0, width), i * width));
    return out;
  };
  function deleteRenderTargets(gl, targets) {
    for (const t of targets.texs) gl.deleteTexture(t);
    for (const f2 of targets.fbs) gl.deleteFramebuffer(f2);
  }
  function createRenderTargets(gl, w, h) {
    const texs = [];
    const fbs = [];
    const tex = (tw, th) => {
      const t = gl.createTexture();
      if (t === null) throw new Error("Texture allocation failed");
      texs.push(t);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, tw, th);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const fbo = (...attach) => {
      const fb = gl.createFramebuffer();
      if (fb === null) throw new Error("Framebuffer allocation failed");
      fbs.push(fb);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      attach.forEach(
        (t, i) => gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + i,
          gl.TEXTURE_2D,
          t,
          0
        )
      );
      gl.drawBuffers(attach.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Framebuffer incomplete");
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return fb;
    };
    try {
      const aw = Math.max(1, Math.round(w / 4));
      const ah = Math.max(1, Math.round(h / 4));
      const bw = Math.max(1, Math.round(w / 8));
      const bh = Math.max(1, Math.round(h / 8));
      const scene = tex(w, h);
      const glow = tex(w, h);
      const a0 = tex(aw, ah);
      const a1 = tex(aw, ah);
      const b0 = tex(bw, bh);
      const b1 = tex(bw, bh);
      const main = fbo(scene, glow);
      const fa0 = fbo(a0);
      const fa1 = fbo(a1);
      const fb0 = fbo(b0);
      const fb1 = fbo(b1);
      return {
        w,
        h,
        aw,
        ah,
        bw,
        bh,
        scene,
        glow,
        a0,
        a1,
        b0,
        b1,
        main,
        fa0,
        fa1,
        fb0,
        fb1,
        texs,
        fbs
      };
    } catch (err) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      deleteRenderTargets(gl, { texs, fbs });
      throw err;
    }
  }

  // src/lib/merc/post-shaders.ts
  var POST_DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uSrcTexel;
uniform vec2 uDstRes;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec3 c = texture(uSrc, uv + uSrcTexel * vec2(-1.0, -1.0)).rgb + texture(uSrc, uv + uSrcTexel * vec2(1.0, -1.0)).rgb +
           texture(uSrc, uv + uSrcTexel * vec2(-1.0, 1.0)).rgb + texture(uSrc, uv + uSrcTexel * vec2(1.0, 1.0)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;
  var POST_BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir;
uniform vec2 uDstRes;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uDstRes;
  vec3 c = texture(uSrc, uv).rgb * 0.19648255;
  c += (texture(uSrc, uv + uDir * 1.41176471).rgb + texture(uSrc, uv - uDir * 1.41176471).rgb) * 0.29690696;
  c += (texture(uSrc, uv + uDir * 3.29411765).rgb + texture(uSrc, uv - uDir * 3.29411765).rgb) * 0.09447040;
  c += (texture(uSrc, uv + uDir * 5.17647059).rgb + texture(uSrc, uv - uDir * 5.17647059).rgb) * 0.01038136;
  o = vec4(c, 1.0);
}`;
  var POST_COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uRes;
uniform vec3 uBg;
uniform float uOpaque;
uniform vec4 uBloomK; // tight level, wide level, damping over the body, -
uniform sampler2D uCov; // the glow target: object coverage in alpha
uniform vec2 uRim;      // rim width in pixels, strength
uniform vec2 uRimY;     // the body's base and crown tip on the screen, in pixels
out vec4 o;
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 l) { return mix(l * 12.92, 1.055 * pow(max(l, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, l)); }
void main() {
  vec4 s = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 a = texture(uA, uv).rgb;
  vec3 b = texture(uB, uv).rgb;
  vec3 bloom = a * a * uBloomK.x + b * b * uBloomK.y;
  float ink = smoothstep(0.03, 0.25, dot(toLin(s.rgb), vec3(0.2126, 0.7152, 0.0722)));
  bloom *= mix(1.0, (1.0 - uBloomK.z) * ink, s.a);
  vec3 c = toLin(s.rgb) + bloom;
  // Rim: a pale line just inside the outline in the body's own tint, as
  // painted: crisp across the outer uRim.x pixels (about 1 % of his width),
  // fading out by about 3 %. It holds a steady screen width as he squashes
  // and turns. Coverage eroded at two widths finds the band. The feet carry
  // coverage 0.75: enough to hide the seam where the body meets them, and
  // they get no line themselves. As measured on the paintings the line is
  // strongest at eye level, weaker low down, faint over the crown (where the
  // edge light already carries it), and it thins where the outline faces
  // down.
  float c0 = texelFetch(uCov, ivec2(gl_FragCoord.xy), 0).a;
  if (c0 > 0.002 && uRim.y > 0.0) {
    float m1 = 1.0;
    float m2 = 1.0;
    vec2 ov = vec2(0.0);
    for (int i = 0; i < 12; i++) {
      float an = float(i) * 0.5235988;
      vec2 d = vec2(cos(an), sin(an));
      float a2 = texture(uCov, (gl_FragCoord.xy + d * uRim.x * 2.2) / uRes).a;
      m1 = min(m1, texture(uCov, (gl_FragCoord.xy + d * uRim.x) / uRes).a);
      m2 = min(m2, a2);
      ov += d * (1.0 - smoothstep(0.8, 0.95, a2));  // feet count as open here, so the line fades above them
    }
    float down = dot(ov, ov) > 1e-6 ? normalize(ov).y : 0.0;
    float hs = (gl_FragCoord.y - uRimY.x) / max(uRimY.y - uRimY.x, 1.0);
    float wh = mix(1.0, 0.25, smoothstep(0.6, 0.85, hs)) * mix(0.3, 1.0, smoothstep(0.15, 0.4, hs));
    float w = 0.7 * smoothstep(0.3, 0.9, 1.0 - m1) + 0.3 * smoothstep(0.3, 0.9, 1.0 - m2);
    w *= smoothstep(0.8, 0.95, c0) * wh * smoothstep(-0.85, -0.35, down);
    c = mix(c, vec3(s.a), w * uRim.y);
  }
  float alpha = s.a;
  if (uOpaque > 0.5) {
    c += uBg * (1.0 - s.a);
    alpha = 1.0;
  }
  vec3 e = toSrgb(min(c, vec3(1.0)));
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  e += (n - 0.5) / 255.0;
  o = vec4(e, alpha);
}`;

  // src/lib/merc/scene-shader-frame.ts
  var EFFECTS_GLSL = `
// ---------------------------------------------------------------- effects

// The body's front silhouette in 2D (for the ghost trail): the same ellipse,
// round cone and blend as the 3D body, squashed like it.
float sdSil2(vec2 p, float s) {
  p.y /= s;
  p.x *= sqrt(s);
  float pn = tipPinch(p.y);
  vec2 pe = p - vec2(0.0, BULB_Y);
  float k0 = length(pe / BULB_R.xy);
  float de = k0 * (k0 - 1.0) / max(length(pe / (BULB_R.xy * BULB_R.xy)), 1e-6);
  vec2 c = p - vec2(0.0, CONE_Y);
  c.x /= 1.0 - pn;
  float b = (CONE_R1 - CONE_R2) / CONE_H;
  float a = sqrt(1.0 - b * b);
  vec2 qq = vec2(abs(c.x), c.y);
  float k = dot(qq, vec2(-b, a));
  float dc;
  if (k < 0.0) dc = length(qq) - CONE_R1;
  else if (k > a * CONE_H) dc = length(qq - vec2(0.0, CONE_H)) - CONE_R2;
  else dc = dot(qq, vec2(a, b)) - CONE_R1;
  dc *= 1.0 - pn;
  return -smin(-smin(de, dc, BODY_K), p.y - FLAT_Y, FLAT_K);
}

vec3 effects(vec3 ro, vec3 rd, float tLim, float pw) {
  vec3 acc = vec3(0.0);
  // Sound arcs.
  if (uArcs.z > 0.001) {
    float tp = (uRoot.z - ro.z) / rd.z;
    if (tp > 0.0 && tp < tLim) {
      vec2 X = (ro + rd * tp).xy;
      for (int side = 0; side < 2; side++) {
        if (side == 1 && uArcs2.z < 0.5) break;
        vec2 c = uArcs.xy;
        float ang = uArcs2.x;
        if (side == 1) { c.x = 2.0 * uRoot.x - c.x; ang = PI - ang; }
        vec2 l = X - c;
        float r = length(l);
        float a = atan(l.y, l.x) - ang;
        a = mod(a + PI, 2.0 * PI) - PI;
        float am = smoothstep(uArcs2.y, uArcs2.y * 0.5, abs(a));
        for (int i = 0; i < 3; i++) {
          float fi = float(i) + fract(uArcs.w);
          float ri = uArcs2.w + fi * 0.075;
          float fade = smoothstep(0.0, 0.7, fi) * smoothstep(3.0, 1.7, fi);
          float dr = r - ri;
          acc += uLight[14] * uArcs.z * am * fade * (exp(-dr * dr / 0.00006) * 1.1 + exp(-dr * dr / 0.0015) * 0.1);
        }
      }
    }
  }
  // Sparkles: four-point stars, gold and white.
  for (int i = 0; i < 8; i++) {
    if (i >= uSparkN) break;
    vec4 s = uSparks[i];
    if (s.w <= 0.001) continue;
    float tp = (s.z - ro.z) / rd.z;
    if (tp < 0.0 || tp > tLim) continue;
    vec2 l = ((ro + rd * tp).xy - s.xy) / s.w;
    float d = pow(abs(l.x), 0.5) + pow(abs(l.y), 0.5);
    float star = smoothstep(1.0, 0.42, d);
    float glow = exp(-length(l) * 3.0) * 0.42;
    vec3 sc = (i % 3 == 1) ? vec3(0.78, 0.9, 1.0) : vec3(1.0, 0.78, 0.38);
    acc += sc * (star * 2.4 + glow);
  }
  // Motion-arc dots.
  for (int i = 0; i < 12; i++) {
    if (i >= uDotN) break;
    vec4 dd = uDots[i];
    float tp = (dd.z - ro.z) / rd.z;
    if (tp < 0.0 || tp > tLim) continue;
    vec2 l = (ro + rd * tp).xy - dd.xy;
    float r2 = dot(l, l);
    acc += uLight[15] * dd.w * (exp(-r2 / 0.00009) * 1.1 + exp(-r2 / 0.0016) * 0.12);
  }
  // Speed lines above a falling drop.
  if (uSpeed > 0.001) {
    float tp = (uRoot.z - ro.z) / rd.z;
    if (tp > 0.0 && tp < tLim) {
      vec2 X = (ro + rd * tp).xy - uRoot.xy;
      float top = REST_H * uShape.x;
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float lx = (fi - 1.5) * 0.17 + 0.03 * sin(fi * 7.1);
        float y0 = top * (0.62 + 0.1 * sin(fi * 3.7));
        float y1 = y0 + 0.4 + 0.25 * fract(fi * 0.37 + 0.2);
        float gx = (X.x - lx) / 0.005;
        float along = smoothstep(y0, y0 + 0.1, X.y) * smoothstep(y1, y0 + 0.12, X.y);
        acc += uLight[16] * exp(-gx * gx) * along * uSpeed * 0.9;
      }
    }
  }
  // Echo trail: copies of the body's contour behind him (x, y, scale,
  // strength), each one smaller and fainter, so the trail tapers away.
  for (int i = 0; i < 3; i++) {
    vec4 gh = uGhost[i];
    if (gh.w <= 0.001) continue;
    float tp = (uRoot.z - 0.05 - ro.z) / rd.z;
    if (tp < 0.0 || tp > tLim) continue;
    vec2 X = (ro + rd * tp).xy - gh.xy;
    float sc = max(gh.z, 0.3);
    float d = sdSil2(X / sc, uGhostSq) * sc;
    float lw = max(0.0055 * sc, pw * tp * 0.6);
    float line = exp(-d * d / (lw * lw));
    float fill = smoothstep(0.02, -0.07, d) * 0.1;
    float hh = clamp((X.y / sc - BODY_Y0) / ((REST_H - BODY_Y0) * uGhostSq), 0.0, 1.0);
    vec3 gc = gradAt(hh);
    // Only the lower curve of each echo: the trail is a run of arcs, no sides.
    float low = 1.0 - smoothstep(0.2, 0.46, hh);
    acc += (mix(gc, uLight[17], 0.45) * line * 0.95 + gc * fill) * gh.w * low;
  }
  // Climb arrow: a thin arc curving up beside him, with a head.
  if (uArrow.z > 0.001) {
    float tp = (uRoot.z - ro.z) / rd.z;
    if (tp > 0.0 && tp < tLim) {
      vec2 X = (ro + rd * tp).xy - uArrow.xy;
      vec2 c = vec2(0.42, 0.0);
      vec2 l = X - c;
      float r = length(l);
      float a = atan(l.y, l.x);
      float on = smoothstep(2.0, 2.15, a) * smoothstep(3.75, 3.6, a);
      float dr = (r - 0.42) / 0.006;
      acc += uLight[14] * exp(-dr * dr) * on * uArrow.z * 0.9;
      vec2 tip = c + 0.42 * vec2(cos(2.05), sin(2.05));
      vec2 tl = X - tip;
      vec2 dir = normalize(vec2(sin(2.05), -cos(2.05)));
      vec2 nrm = vec2(-dir.y, dir.x);
      for (int s = -1; s <= 1; s += 2) {
        vec2 hd = normalize(-dir + nrm * 0.75 * float(s));
        float tt = clamp(dot(tl, hd), 0.0, 0.07);
        float dd = length(tl - hd * tt) / 0.006;
        acc += uLight[14] * exp(-dd * dd) * uArrow.z * 0.9;
      }
    }
  }
  return acc;
}

// Display-referred tone curve on the brightest channel: identity up to 0.8,
// then a soft shoulder, so the authored colours land as authored and only
// real highlights roll off toward white.
vec3 tonemap(vec3 x) {
  float m = max(x.r, max(x.g, x.b));
  if (m <= 0.8) return x;
  float tm = 0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2));
  vec3 c = x * (tm / m);
  return mix(c, vec3(tm), smoothstep(1.2, 3.0, m) * 0.8);
}
`;
  var FRAME_GLSL = `
// ---------------------------------------------------------------- frame

vec4 renderSample(vec2 fc, out vec3 dbg, out vec3 glow) {
  gFoot = 0.0;
  vec2 uv = (fc - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamR * uv.x + uCamU * uv.y + uCamF * uFocal);
  float pixA = 2.0 / (uRes.y * uFocal);
  float tFloor = rd.y < -1e-4 ? -ro.y / rd.y : 1e9;
  vec2 tb = sphereHit(ro, rd, uBound);
  float tHit = -1.0;
  float mat = 0.0;
  float minD = 1e9;
  vec3 minP = vec3(0.0);
  float minT = 0.0;
  int steps = 0;
  if (tb.y > 0.0) {
    float t = max(tb.x, 0.0);
    float tEnd = min(tb.y, tFloor);
    for (int i = uZero; i < MAX_STEPS; i++) {
      vec3 p = ro + rd * t;
      vec3 h = map3(p);
      steps = i + 1;
      if (h.x < minD) { minD = h.x; minP = p; minT = t; }
      if (h.x < 0.0004 * t) { tHit = t; mat = h.y; break; }
      t += h.x;
      if (t > tEnd) break;
    }
  }
  vec3 col = vec3(0.0);
  glow = vec3(0.0);
  float alpha = 0.0;
  float tLim = 1e9;
  if (tHit > 0.0) {
    vec3 P = ro + rd * tHit;
    float pw = tHit * pixA;
    vec3 q = toRest(P);
    if (mat > 1.5) {
      col = shadeEye(P, pw);
      // Where the eye dome meets the body, blend across one pixel.
      float dB = mapBody(P);
      float cov = 0.5 + 0.5 * smoothstep(0.0, pw * 1.2, dB);
      if (cov < 0.999) {
        vec3 g2;
        vec3 bc = shadeBody(P, calcNormalBody(P), rd, tHit, pixA, g2);
        col = mix(bc, col, cov);
        glow = g2 * (1.0 - cov);
      }
      if (uDebug == 2) gDbg = vec3(1.0, 0.0, 0.0);
      if (uDebug == 3) gDbg = vec3(0.0, 0.1, 0.0);
    } else {
      vec3 N = calcNormal(P);
      col = shadeBody(P, N, rd, tHit, pixA, glow);
      float dE = sdEyesW(P, q);
      if (dE < pw * 1.2) {
        float cov = 0.5 * smoothstep(pw * 1.2, 0.0, dE);
        col = mix(col, shadeEye(P, pw), cov);
        glow *= 1.0 - cov;
      }
      if (uDebug == 2) gDbg = N * 0.5 + 0.5;
    }
    alpha = 1.0;
    gCov = 1.0 - 0.25 * gFoot;
    tLim = tHit;
  } else {
    gCov = 0.0;
    if (tFloor < 1e8) {
      vec3 P = ro + rd * tFloor;
      float sh;
      col = floorShade(P, sh);
      alpha = sh;
      tLim = tFloor;
    }
#if EDGE_AA
    float pw = pixA * minT;
    if (minD < pw * 0.5 && tb.y > 0.0) {
      vec3 N = calcNormal(minP);
      vec3 P = minP - N * minD;
      vec2 hm = map(P);
      vec3 g2 = vec3(0.0);
      vec3 ec = hm.y > 1.5 ? shadeEye(P, minT * pixA) : shadeBody(P, N, rd, minT, pixA, g2);
      float cv = clamp(0.5 - minD / pw, 0.0, 0.5);
      col = mix(col, ec, cv);
      glow = mix(glow, g2, cv);
      alpha = mix(alpha, 1.0, cv);
      gCov = cv * 2.0 * (1.0 - 0.25 * gFoot);
    }
#endif
  }
  col += effects(ro, rd, tLim, pixA);
  dbg = vec3(float(steps), 0.0, 0.0);
  return vec4(tonemap(col), alpha);
}

void main() {
  vec4 acc = vec4(0.0);
  vec3 gacc = vec3(0.0);
  vec3 dbg = vec3(0.0);
  vec3 g = vec3(0.0);
  if (uDebug == 1) {
    renderSample(gl_FragCoord.xy, dbg, g);
    fragColor = vec4(dbg / 255.0, 1.0);
    glowColor = vec4(0.0);
    return;
  }
  if (uDebug >= 2) {
    renderSample(gl_FragCoord.xy, dbg, g);
    fragColor = vec4(gDbg, 1.0);
    glowColor = vec4(0.0);
    return;
  }
  float cacc = 0.0;
#if SPP == 1
  acc = renderSample(gl_FragCoord.xy, dbg, g);
  gacc = g;
  cacc = gCov;
#elif SPP == 4
  const vec2 o4[4] = vec2[4](vec2(0.125, 0.375), vec2(0.375, -0.125), vec2(-0.125, -0.375), vec2(-0.375, 0.125));
  for (int i = uZero; i < 4; i++) { acc += renderSample(gl_FragCoord.xy + o4[i], dbg, g); gacc += g; cacc += gCov; }
  acc *= 0.25;
  gacc *= 0.25;
  cacc *= 0.25;
#else
  for (int i = uZero; i < SPP; i++) {
    vec2 o = (vec2(float(i % 3), float(i / 3)) - 1.0) / 3.0;
    acc += renderSample(gl_FragCoord.xy + o, dbg, g);
    gacc += g;
    cacc += gCov;
  }
  acc /= float(SPP);
  gacc /= float(SPP);
  cacc /= float(SPP);
#endif
  // Premultiplied linear colour, stored sRGB-encoded; the composite pass adds
  // the bloom and the background, then dithers.
  vec3 lin = max(acc.rgb, vec3(0.0));
  vec3 srgb = mix(lin * 12.92, 1.055 * pow(lin, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, lin));
  fragColor = vec4(srgb, clamp(acc.a, 0.0, 1.0));
  glowColor = vec4(sqrt(max(gacc, vec3(0.0))), clamp(cacc, 0.0, 1.0));
}
`;

  // src/lib/merc/scene-shader-sdf.ts
  var SDF_GLSL = `
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-6);
}

float sdRoundCone(vec3 p, float r1, float r2, float h) {
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  vec2 q = vec2(length(p.xz), p.y);
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}

vec2 sphereHit(vec3 ro, vec3 rd, vec4 s) {
  vec3 oc = ro - s.xyz;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - s.w * s.w;
  float h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

// The palette as a Catmull-Rom curve through its stops: no slope breaks at
// the stops, so a deep, saturated gradient shows no bands.
vec3 gradAt(float h) {
  int i = 1;
  for (int k = 1; k < GRAD_N - 1; k++) {
    if (h > uGradH[k]) i = k + 1;
  }
  float t = clamp((h - uGradH[i - 1]) / (uGradH[i] - uGradH[i - 1]), 0.0, 1.0);
  vec3 p0 = uGradC[max(i - 2, 0)];
  vec3 p1 = uGradC[i - 1];
  vec3 p2 = uGradC[i];
  vec3 p3 = uGradC[min(i + 1, GRAD_N - 1)];
  vec3 c = 0.5 * (2.0 * p1 + (p2 - p0) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t + (3.0 * p1 - p0 - 3.0 * p2 + p3) * t * t * t);
  return max(c, vec3(0.0));
}

// World point to the body's rest space: undo root, yaw, bend, sway, squash, melt.
vec3 toRest(vec3 p) {
  vec3 q = p - uRoot;
  q.xz = mat2(uShape.z, uShape.w, -uShape.w, uShape.z) * q.xz;
  // From the pass 3 floor line, so the lean weights did not move when the
  // body sat lower.
  float hy = clamp((q.y - BODY_Y0 + 0.055) / (REST_H - BODY_Y0 + 0.055), 0.0, 1.4);
  q.xy = rot2(uLean.x * hy) * q.xy;
  q.zy = rot2(uLean.y * hy) * q.zy;
  float sw = smoothstep(0.25 + BODY_Y0, 1.2 + BODY_Y0, q.y);
  q.xz -= uLean.zw * (sw * sw);
  float s = uShape.x;
  float yw = q.y;
  q.y = yw / s;
  // Squash compresses the body, but the crown keeps most of its shape, so a
  // splat never flattens the tip into a lens. Softplus keeps it smooth and monotonic.
  if (s < 0.999) {
    float st = mix(s, 1.0, 0.65);
    float y1 = (0.72 + BODY_Y0) * s;
    q.y -= (1.0 / s - 1.0 / st) * 0.07 * log(1.0 + exp((yw - y1) / 0.07));
  }
  q.xz *= sqrt(s);
  float m = 1.0 + uShape.y * 0.75 * (1.0 - smoothstep(BODY_Y0, 0.8 + BODY_Y0, q.y));
  q.xz /= m;
  return q;
}

float sdNub(vec3 q) {
  float e = uNub;
  vec3 a = NUB_A;
  vec3 b = a + normalize(vec3(1.0, 0.3, 0.12)) * (0.03 + 0.34 * e);
  vec3 pa = q - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h) - mix(0.12, 0.062, h);
  float bulb = length(q - b) - (0.03 + 0.072 * e);
  return smin(d, bulb, 0.04);
}

float ripple(vec3 q) {
  float d1 = length(q - vec3(0.0, uRipple.w, 0.42));
  float d2 = length(q - vec3(0.15, uRipple.w + 0.1, -0.4));
  float w = sin(d1 * uRipple.y - uRipple.z) * exp(-d1 * 3.2) + 0.4 * sin(d2 * uRipple.y * 0.8 - uRipple.z * 0.9) * exp(-d2 * 2.5);
  return uRipple.x * w * smoothstep(0.06 + BODY_Y0, 0.25 + BODY_Y0, q.y);
}

float displace(vec3 q) {
  float d = 0.0;
  if (uRipple.x > 0.0) d += ripple(q);
  if (uWave.x > 0.0) { float g = (q.y - uWave.y) / 0.07; d += uWave.x * exp(-g * g); }
  return d;
}

// The crown, drawn in a little just under the tip (up to TIP_PINCH of its
// width about 0.05 below the tip, none at the tip or lower down), so the top
// comes to the rounder point of the paintings.
float tipPinch(float y) {
  float dt = REST_H - y;
  return TIP_PINCH * smoothstep(0.01, 0.045, dt) * (1.0 - smoothstep(0.05, 0.14, dt));
}
float sdCrown(vec3 q) {
  float pn = tipPinch(q.y);
  vec3 qc = q - vec3(0.0, CONE_Y, 0.0);
  qc.xz /= 1.0 - pn;
  return sdRoundCone(qc, CONE_R1, CONE_R2, CONE_H) * (1.0 - pn);
}
float sdBodyQ(vec3 q) {
  // A lip roll (uMouth.w) fills his cheeks: a little wider about the mouth.
  if (uMouth.w > 0.0) {
    float cy = (q.y - 0.36) / 0.11;
    q.x /= 1.0 + 0.03 * uMouth.w * exp(-cy * cy);
  }
  float e = sdEllipsoid(q - vec3(0.0, BULB_Y, 0.0), BULB_R);
  float c = sdCrown(q);
  float d = -smin(-smin(e, c, BODY_K), q.y - FLAT_Y, FLAT_K);
  if (uNub > 0.004) d = smin(d, sdNub(q), 0.08);
  return d - displace(q);
}

// Bead feet in a yawed root frame. Returns the distance; foot centre in fc.
float sdFeet(vec3 p, out vec3 fq) {
  vec3 q = p - uRoot;
  q.xz = mat2(uShape.z, uShape.w, -uShape.w, uShape.z) * q.xz;
  // Squash and melt press the feet outward a little faster than the body's
  // base widens, so they still show under a squashed body, as in the
  // painted Sleep.
  float press = max(1.0 - uShape.x, 0.0);
  float spread = inversesqrt(uShape.x) * (1.0 + uShape.y * 0.8) * (1.0 + 0.6 * press);
  q.x = abs(q.x);
  float dg = uFeet.y;
  // In the air the feet ride up with a stretch, so they stay under the body;
  // on the floor they stay put. Hanging feet never sink into the floor while
  // he lands.
  float sy = mix(1.0, max(uShape.x, 1.0), smoothstep(0.0, 0.06, uRoot.y));
  vec3 c = vec3(FOOT_C.x * spread, max(FOOT_C.y * sy - dg, FOOT_R.y - uRoot.y), FOOT_C.z);
  // Toes out: the foot's own frame turns outward about the vertical.
  vec3 l = q - c;
  l.xz = vec2(l.x * FOOT_TOE.y - l.z * FOOT_TOE.x, l.x * FOOT_TOE.x + l.z * FOOT_TOE.y);
  // A jelly bean: a little fuller toward the outer end.
  vec3 r = FOOT_R * vec3(1.0, vec2(1.0 + 0.12 * clamp(l.x / FOOT_R.x, -1.0, 1.0)));
  // Pressed feet spread and flatten.
  r *= vec3(1.0 + 0.35 * press, 1.0 - 0.25 * press, 1.0 + 0.35 * press);
  fq = l / r;
  return sdEllipsoid(l, r) * 0.92;
}
float sdFeet(vec3 p) { vec3 fq; return sdFeet(p, fq); }

// The eyes' own rest space: the body's warp, except that the bend and the
// sway are frozen at the eyes' height. A lean then turns the eyes as one
// piece instead of shearing them, while squash and melt still carry them
// with the body.
vec3 toRestEye(vec3 p) {
  vec3 q = p - uRoot;
  q.xz = mat2(uShape.z, uShape.w, -uShape.w, uShape.z) * q.xz;
  q.xy = rot2(uLean.x * uEyeFrz.x) * q.xy;
  q.zy = rot2(uLean.y * uEyeFrz.x) * q.zy;
  q.xz -= uLean.zw * uEyeFrz.y;
  float s = uShape.x;
  float yw = q.y;
  q.y = yw / s;
  if (s < 0.999) {
    float st = mix(s, 1.0, 0.65);
    float y1 = (0.72 + BODY_Y0) * s;
    q.y -= (1.0 / s - 1.0 / st) * 0.07 * log(1.0 + exp((yw - y1) / 0.07));
  }
  q.xz *= sqrt(s);
  float m = 1.0 + uShape.y * 0.75 * (1.0 - smoothstep(BODY_Y0, 0.8 + BODY_Y0, q.y));
  q.xz /= m;
  return q;
}

// Eye dome in the eye rest space, curved to sit on the body.
float sdEyeI(vec3 qe, int i, float open, float squint) {
  vec3 d = qe - uEyeC[i];
  vec3 ex = uEyeX[i];
  vec3 ez = uEyeZ[i];
  vec3 ey = cross(ez, ex);
  vec3 e = vec3(dot(d, ex), dot(d, ey), dot(d, ez));
  // Bend the dome to the body. The cubic term follows the oval belly, which is
  // fuller just above the eye than below it, so the whole dome still shows.
  e.z += 1.05 * e.x * e.x + (1.125 - 1.4 * e.y) * e.y * e.y;
  vec3 r = vec3(EYE_R.x * (1.0 + EYE_EGG * clamp(e.y / (EYE_R.y * open), -1.0, 1.0)), EYE_R.y * open, EYE_R.z);
  float de = sdEllipsoid(e, r);
  // The squint's lid is arched (lower at the corners), like a smiling eye.
  float c = squint * 0.9 * r.y / (r.x * r.x);
  float lid = r.y * (1.0 - 1.5 * squint) - c * e.x * e.x;
  return max(de, (e.y - lid) * 0.9 / sqrt(1.0 + 4.0 * c * c * e.x * e.x));
}

// World distance to the eyes. q is the body's rest point, used to skip the
// eye warp far from the eyes (a safe lower bound there).
float sdEyesW(vec3 p, vec3 q) {
  float far = min(length(q - uEyeC[0]), length(q - uEyeC[1])) - 0.3;
  if (far > 0.12) return far * uLip;
  vec3 qe = toRestEye(p);
  float d = 1e3;
  if (uEyeA.x > 0.03) d = sdEyeI(qe, 0, uEyeA.x, uEyeA.z);
  if (uEyeA.y > 0.03) d = min(d, sdEyeI(qe, 1, uEyeA.y, uEyeA.w));
  return (d < 0.3 ? d - displace(qe) : d) * uLip;
}

float sdDrops(vec3 p) {
  float d = 1e3;
  for (int i = 0; i < 6; i++) {
    if (i >= uDropN) break;
    d = min(d, length(p - uDrops[i].xyz) - uDrops[i].w);
  }
  return d;
}

// The feet's blend widens as they hang in a jump, and as a stretch lifts the
// body's underside off them, so they stay joined to the body by a short liquid
// neck instead of floating free.
float footK() {
  float ground = 1.0 - smoothstep(0.0, 0.06, uRoot.y);
  return FOOT_K + 2.0 * uFeet.y + 0.3 * max(uShape.x - 1.0, 0.0) * ground;
}

// Body and feet only (no eyes, no droplets).
float mapBody(vec3 p) {
  return smin(sdBodyQ(toRest(p)) * uLip, sdFeet(p), footK());
}

// Full scene: x = distance, y = material (1 resin, 2 eye), z = body only.
vec3 map3(vec3 p) {
  vec3 q = toRest(p);
  float d = sdBodyQ(q) * uLip;
  d = smin(d, sdFeet(p), footK());
  float b = d;
  if (uDropN > 0) d = min(d, sdDrops(p));
  float e = sdEyesW(p, q);
  return e < d ? vec3(e, 2.0, b) : vec3(d, 1.0, b);
}
vec2 map(vec3 p) { return map3(p).xy; }

vec3 calcNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0012;
  return normalize(k.xyy * map(p + k.xyy * e).x + k.yyx * map(p + k.yyx * e).x +
                   k.yxy * map(p + k.yxy * e).x + k.xxx * map(p + k.xxx * e).x);
}

vec3 calcNormalBody(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0012;
  return normalize(k.xyy * mapBody(p + k.xyy * e) + k.yyx * mapBody(p + k.yyx * e) +
                   k.yxy * mapBody(p + k.yxy * e) + k.xxx * mapBody(p + k.xxx * e));
}
`;

  // src/lib/merc/scene-shader-surface.ts
  var FLOOR_GLSL = `
// ---------------------------------------------------------------- floor

vec3 floorLight(vec3 P) {
  vec2 rel = P.xz - uRoot.xz;
  float r2 = dot(rel, rel);
  float lift = max(uRoot.y, 0.0);
  float k = 1.0 / (1.0 + lift * 2.5);
  // A faint pool of the body's light: aqua close in, a wider blue wash. The
  // floor right under him stays dark while he stands, as painted, so the feet
  // stand out; as he rises his light reaches under him and the pool fills in.
  float under = mix(smoothstep(0.16, 0.46, sqrt(r2)), 1.0, smoothstep(0.0, 0.12, lift));
  vec3 pool = uLight[0] * 0.5 * k * exp(-r2 * 9.0 * k) * under + uLight[1] * 0.06 * k * exp(-r2 * 3.4);
  vec3 c = pool * uColor.y * (1.0 + uColor.z * 0.7);
  // Under each foot, a short cyan streak on the floor, as painted.
  vec2 fl = mat2(uShape.z, uShape.w, -uShape.w, uShape.z) * rel;
  fl.x = abs(fl.x);
  vec2 fs = (fl - vec2(FOOT_C.x * inversesqrt(uShape.x), FOOT_C.z + 0.55 * FOOT_R.z)) / vec2(0.1, 0.03);
  c += uLight[2] * 0.2 * k * exp(-dot(fs, fs)) * uColor.y;
  float r = length(rel);
  if (uRing.y > 0.001) { float g = (r - uRing.x) / 0.022; c += uLight[3] * 1.1 * uRing.y * exp(-g * g); }
  if (uRing.w > 0.001) { float g = (r - uRing.z) / 0.022; c += uLight[3] * 1.1 * uRing.w * exp(-g * g); }
  if (uStops.w > 0.001) {
    for (int i = 0; i < 3; i++) {
      float sx = i == 0 ? uStops.x : (i == 1 ? uStops.y : uStops.z);
      float d = length(P.xz - vec2(sx, 0.0));
      float g = (d - 0.15) / 0.01;
      c += uLight[4] * uStops.w * (exp(-g * g) * 0.9 + smoothstep(0.16, 0.0, d) * 0.12);
    }
  }
  return c;
}

// Floor colour plus a soft contact shadow (returned as extra opacity).
vec3 floorShade(vec3 P, out float shadow) {
  vec3 c = floorLight(P);
  float occ = 0.0;
  occ += (0.03 - mapBody(P + vec3(0.0, 0.03, 0.0))) * 1.0;
  occ += (0.09 - mapBody(P + vec3(0.0, 0.09, 0.0))) * 0.6;
  occ += (0.2 - mapBody(P + vec3(0.0, 0.2, 0.0))) * 0.3;
  float ao = clamp(1.0 - occ * 3.0, 0.0, 1.0);
  shadow = (1.0 - ao) * 0.6;
  c *= mix(0.3, 1.0, ao);
  return c;
}
`;
  var FACE_GLSL = `
// ---------------------------------------------------------------- face

float sdArcStroke(vec2 p, float ap, float ra, float rb) {
  vec2 sc = vec2(sin(ap), cos(ap));
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

float sdEllipse2(vec2 p, vec2 r) {
  return (length(p / r) - 1.0) * min(r.x, r.y);
}

// Mouth and closed-eye strokes, drawn on the resin in rest space. Flat ink:
// nothing reflects in it.
vec3 applyFace(vec3 col, vec3 q, float pw) {
  float front = smoothstep(0.02, 0.16, q.z);
  if (front <= 0.0) return col;
  vec2 f = q.xy;
  float aa = pw * 0.8;
  vec3 ink = vec3(0.001, 0.0015, 0.002);
  float cov = 0.0;
  // Strokes are drawn in rest space, so a squash would thin them: thicken
  // them back so a landing face stays readable.
  float sw = pow(clamp(uShape.x, 0.3, 1.0), -0.6);
  // Smile: lower arc of a circle, curvature from uMouth.x. While the O is
  // open the smile fades and its ends draw in to sit inside the O, so no
  // smile corners show beside an open mouth.
  float oo = smoothstep(0.0, 0.2, uMouth.y);
  float bz = uMouth.w;
  float sm = uMouth.x * (1.0 - oo) * (1.0 - uMouth.z) * (1.0 - bz);
  if (sm > 0.01) {
    float ra = mix(0.26, 0.06, clamp(uMouth.x, 0.0, 1.0));
    float hc = mix(0.0512, 0.55 * (0.034 + 0.024 * uMouth.y), smoothstep(0.0, 0.06, uMouth.y));
    float ap = asin(clamp(hc / ra, 0.0, 1.0));
    vec2 p = f - vec2(0.0, MOUTH_Y + ra);
    p.y = -p.y;
    float d = sdArcStroke(p, ap, ra, 0.0135 * sw);
    cov = max(cov, smoothstep(aa, -aa, d) * clamp(sm * 1.5, 0.0, 1.0));
  }
  // A lip roll (uMouth.w): the lips together, buzzing. The smile gives way
  // to closed lips, rose against the resin under a darker rim, a little
  // wider than the smile so they never read as a pucker. On the resin's
  // buzz phase (uRipple.z) they flap fuller and thinner and a ripple runs
  // along their seam. The cheeks either side round out (sdBodyQ) and catch
  // a soft light.
  if (bz > 0.01) {
    float on = clamp(bz * 1.5, 0.0, 1.0);
    vec2 cp = vec2(abs(f.x) - 0.175, f.y - 0.34) / vec2(0.075, 0.06);
    float ck = (1.0 - smoothstep(0.45, 1.0, length(cp))) * bz * front;
    col = mix(col, col * 1.3 + vec3(0.07, 0.11, 0.15), ck * 0.4);
    vec2 p = f - vec2(0.0, MOUTH_Y + 0.008);
    float flap = 1.0 + 0.28 * bz * sin(uRipple.z);
    float dl = sdEllipse2(p, vec2(0.066, 0.024 * flap));
    vec3 lipCol = mix(vec3(0.34, 0.09, 0.3), ink, smoothstep(-0.008, 0.0, dl) * 0.55);
    col = mix(col, lipCol, smoothstep(aa, -aa, dl) * on * front);
    // The seam: a fine ink line, two waves of ripple along it, eased to
    // nothing at the corners.
    float hw = 0.05;
    float x = clamp(p.x, -hw, hw);
    float u = x / hw;
    float env = 1.0 - u * u;
    float k = 6.2832 / 0.05;
    float ph = k * x - uRipple.z;
    float amp = 0.005 * bz;
    float yl = amp * env * sin(ph);
    float slope = amp * (env * k * cos(ph) - 2.0 * u / hw * sin(ph));
    float d = length(vec2(p.x - x, (p.y - yl) * inversesqrt(1.0 + slope * slope))) - 0.0075 * sw;
    cov = max(cov, smoothstep(aa, -aa, d) * on);
  }
  vec3 inside = vec3(0.022, 0.005, 0.03);
  float hole = 0.0;
  vec3 holeCol = inside;
  // Singing O.
  if (uMouth.y > 0.01) {
    float o = uMouth.y;
    vec2 r = vec2(0.034 + 0.024 * o, 0.026 + 0.064 * o);
    vec2 p = f - vec2(0.0, MOUTH_Y + 0.004 - 0.02 * o);
    float d = sdEllipse2(p, r);
    float c = smoothstep(aa, -aa, d) * smoothstep(0.01, 0.12, o);
    float tongue = smoothstep(aa, -aa, length(p - vec2(0.0, -r.y)) - r.x * 0.75);
    holeCol = mix(inside, vec3(0.35, 0.06, 0.16), tongue * 0.8);
    hole = max(hole, c);
  }
  // Open grin: a half disc with a tongue.
  if (uMouth.z > 0.01) {
    vec2 c0 = vec2(0.0, MOUTH_Y + 0.05);
    vec2 p = f - c0;
    float R = 0.072;
    float d = max(length(p) - R, p.y + 0.004 * (1.0 - (p.x * p.x) / (R * R)));
    float c = smoothstep(aa, -aa, d) * uMouth.z;
    float tongue = smoothstep(aa, -aa, length(p - vec2(0.0, -R)) - 0.045);
    holeCol = mix(holeCol, mix(inside, vec3(0.42, 0.08, 0.2), tongue), uMouth.z);
    hole = max(hole, c);
  }
  // Closed eyes: a happy arc (bent up) and a sleepy arc (bent down).
  for (int i = 0; i < 2; i++) {
    vec2 ec = uEyeC[i].xy;
    float up = i == 0 ? uEyeB.x : uEyeB.y;
    float dn = i == 0 ? uEyeB.z : uEyeB.w;
    if (up > 0.01) {
      float d = sdArcStroke(f - ec + vec2(0.0, 0.038), 0.95, 0.063, 0.0118 * sw);
      cov = max(cov, smoothstep(aa, -aa, d) * up);
    }
    if (dn > 0.01) {
      vec2 p = f - ec - vec2(0.0, 0.047);
      p.y = -p.y;
      float d = sdArcStroke(p, 0.9, 0.066, 0.0128 * sw);
      cov = max(cov, smoothstep(aa, -aa, d) * dn);
    }
  }
  col = mix(col, ink, cov * front);
  col = mix(col, holeCol, hole * front);
  return col;
}
`;
  var MATERIALS_GLSL = `
// ---------------------------------------------------------------- materials

// Glossy black eye: a deep blue glow low in the dome, a faint cyan lower
// edge, and two cartoon catchlights placed in the eye's own frame.
vec3 shadeEye(vec3 P, float pw) {
  vec3 qe = toRestEye(P);
  int i = length(qe - uEyeC[0]) < length(qe - uEyeC[1]) ? 0 : 1;
  vec3 d = qe - uEyeC[i];
  float open = max(i == 0 ? uEyeA.x : uEyeA.y, 0.05);
  float ry = EYE_R.y * open;
  vec3 ex = uEyeX[i];
  vec3 ey = cross(uEyeZ[i], ex);
  float rx = EYE_R.x * (1.0 + EYE_EGG * clamp(dot(d, ey) / ry, -1.0, 1.0));
  vec2 uv = vec2(dot(d, ex) / rx, dot(d, ey) / ry);
  float ew = pw / rx;
  vec3 c = vec3(0.0007, 0.0009, 0.0014);
  float low = smoothstep(0.1, -0.95, uv.y) * smoothstep(1.05, 0.55, length(uv * vec2(1.0, 0.85)));
  c += uLight[5] * low * 0.4;
  float rr = length(uv);
  // A thin light crescent just inside the lower edge, fading a third of the
  // way up the sides (painted #122938).
  c += uLight[6] * 0.075 * smoothstep(EYE_VIS - 0.11, EYE_VIS - 0.02, rr) * smoothstep(-0.2, -0.75, uv.y / max(rr, 1e-3));
  // The painted eye is a touch lighter just inside its edge than at its core,
  // which rounds it like a glass bead.
  c += uLight[7] * smoothstep(0.45 * EYE_VIS, 0.92 * EYE_VIS, rr);
  float lit = smoothstep(0.25, 0.6, open);
  // One catchlight, up and to the viewer's right in both eyes, as painted.
  float k1 = length((uv - vec2(0.255, 0.59)) / vec2(0.284, 0.196));
  c += vec3(1.0) * smoothstep(1.0 + ew * 4.0, 1.0 - ew * 4.0, k1) * 2.4 * lit;
  return c;
}

// The resin. glow returns the body's own light for the bloom chain (no
// highlights, so the glow is tinted by the colour beneath).
vec3 shadeBody(vec3 P, vec3 N, vec3 rd, float t, float pixA, out vec3 glow) {
  vec3 q = toRest(P);
  float h0 = clamp((q.y - BODY_Y0) / (REST_H - BODY_Y0), 0.0, 1.0);
  float h = clamp(h0 + uColor.x * 0.16, 0.0, 1.0);
  vec3 base = gradAt(h) * uColor.y;
  vec3 nv = vec3(dot(N, uCamR), dot(N, uCamU), dot(N, -rd));
  float cosT = clamp(nv.z, 0.0, 1.0);

  // Bead feet and droplets: brighter aqua glass.
  vec3 fq;
  float dF = sdFeet(P, fq);
  float dB = sdBodyQ(q) * uLip;
  float foot = smoothstep(0.01, -0.012, dF - dB);
  // The crease where the body meets each foot: both surfaces are close
  // there. It reads dark, as painted.
  float crease = smoothstep(0.025, 0.0, max(dB, dF));
  if (foot > 0.0) {
    vec3 bead = mix(uBead[0], uBead[1], smoothstep(-0.9, 0.7, fq.y));
    base = mix(base, bead * uColor.y, foot);
  }
  if (uDropN > 0) {
    float dd = sdDrops(P);
    float dr = smoothstep(0.004, -0.004, dd - min(dB, dF));
    base = mix(base, uLight[8] * uColor.y, dr);
  }

  // The painted light, measured on the concept's three front figures: the
  // middle keeps the gradient's own deep colour; toward the outline the gel
  // lightens and reads further down the gradient (bluer up top, cyan low
  // down). s runs from 0 facing the camera to 1 at the outline, by the
  // camera's azimuth, so the light holds to the silhouette as he turns.
  float az = atan(q.x, q.z);
  float da = mod(az - uCamAz + PI, 2.0 * PI) - PI;
  float s = abs(sin(da));
  float fr = 1.0 - foot;
  float up = smoothstep(0.3, 0.7, h0);
  float eK = mix(uLookE.y, uLookE.x, up) * pow(s, uLookE.z);
  float shift = mix(uLookE.w, uLookE2.x, up);
  float whiten = mix(uLookE2.y, uLookK.z, up);
  vec3 ec = mix(gradAt(clamp(h - shift * s, 0.0, 1.0)), mix(uLookT2, vec3(1.0), up), whiten) * uColor.y;
  vec3 col = mix(base, ec, clamp(eK, 0.0, 1.0) * fr);
  // A mild key from the camera's left, as in all three paintings: the outer
  // left of the body at eye level reads a lighter sky blue. Only there: at
  // the upper flank the paintings' left is the darker side.
  float key = smoothstep(0.0, 0.35, -sin(da)) * smoothstep(0.68, 0.84, s) * (1.0 - 0.5 * smoothstep(0.88, 0.98, s)) * exp(-pow((h0 - 0.44) / 0.12, 2.0));
  col = mix(col, uLight[9] * uColor.y, uLookK.w * key * fr);
  // The hot core: a glow deep in the lower body, seen through the volume, so it
  // shifts against the surface as he turns.
  vec3 oc = uCore.xyz - uCamPos;
  float tc = dot(oc, rd);
  float d2 = max(dot(oc, oc) - tc * tc, 0.0);
  float core = exp(-d2 / (uCore.w * uCore.w));
  col += uLight[10] * core * (0.62 + 1.0 * uColor.z) * uColor.y;
  if (uNub > 0.01) {
    vec3 bc = NUB_A + normalize(vec3(1.0, 0.3, 0.12)) * (0.03 + 0.34 * uNub);
    vec3 db = q - bc;
    col += uLight[11] * uNub * exp(-dot(db, db) * 45.0) * 0.8;
  }
  glow = col;

  // Two near-white streaks inside each flank, one along the crown and one
  // along the shoulder, as painted.
  vec2 g1 = vec2(h0 - uLookS1.x, 0.0);
  g1 = vec2(g1.x / uLookS1.z, (s - uLookS1.y + uLookE2.z * g1.x) / uLookS1.w);
  vec2 g2 = vec2(h0 - uLookS2.x, 0.0);
  g2 = vec2(g2.x / uLookS2.z, (s - uLookS2.y + uLookE2.w * g2.x) / uLookS2.w);
  float sk = uLookK.x * exp(-dot(g1, g1)) + uLookK.y * exp(-dot(g2, g2));
  col = mix(col, uLookT, min(sk, 1.0) * fr);
  // The silver rim is drawn in the composite, at a constant screen width.
  // Feet: a small pale-blue glint on each foot's outer upper shoulder,
  // mirrored left and right as painted, placed in view space so it stays on
  // the visible part, with a soft sheen around it.
  if (foot > 0.0) {
    float side = dot(P - uRoot, uCamR) < 0.0 ? -1.0 : 1.0;
    float g = dot(nv, normalize(vec3(0.5 * side, 0.42, 0.76)));
    col += uLight[12] * smoothstep(0.72, 0.95, g) * foot * 0.12;
    col = mix(col, uLight[13], smoothstep(0.95, 0.985, g) * foot * 0.85);
  }
  // Debug view 3: feet (r), body height (g, from 0.25), azimuth offset (b).
  col *= 1.0 - 0.6 * crease;
  glow *= 1.0 - 0.6 * crease;
  if (uDebug == 3) gDbg = vec3(foot, 0.25 + 0.75 * h0, s);
  gFoot = foot;
  return applyFace(col, q, t * pixA);
}
`;

  // src/lib/merc/scene-shader.ts
  var VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
  var f = (x) => {
    const s = Number(x).toFixed(5);
    return s.includes(".") ? s : `${s}.0`;
  };
  var v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
  function fragSource(q) {
    const S = SHAPE;
    const defs = `
#define SPP ${q.spp}
#define MAX_STEPS ${q.steps}
#define EDGE_AA ${q.edgeAA}
#define REST_H ${f(S.restH)}
#define BODY_Y0 ${f(S.bodyY0)}
#define BULB_Y ${f(S.bulbY)}
#define BULB_R ${v3(S.bulbR)}
#define CONE_Y ${f(S.coneY)}
#define CONE_R1 ${f(S.coneR1)}
#define CONE_R2 ${f(S.coneR2)}
#define CONE_H ${f(S.coneH)}
#define BODY_K ${f(S.bodyK)}
#define FLAT_Y ${f(S.flatY)}
#define TIP_PINCH ${f(S.tipPinch)}
#define FLAT_K ${f(S.flatK)}
#define FOOT_TOE vec2(${f(Math.sin(S.footToe * Math.PI / 180))}, ${f(Math.cos(S.footToe * Math.PI / 180))})
#define FOOT_C ${v3(S.footC)}
#define FOOT_R ${v3(S.footR)}
#define FOOT_K ${f(S.footK)}
#define NUB_A ${v3(S.nub)}
#define EYE_R ${v3(S.eyeR)}
#define EYE_VIS ${f(Math.sqrt(1 - (S.eyeEmbed / S.eyeR[2]) ** 2))}
#define EYE_EGG ${f(S.eyeEgg)}
#define MOUTH_Y ${f(S.mouthY)}
#define GRAD_N ${GRAD_N}
`;
    return `#version 300 es
precision highp float;
precision highp int;
${defs}
layout(location = 0) out vec4 fragColor;
layout(location = 1) out vec4 glowColor;

uniform vec2 uRes;
uniform vec3 uCamPos;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform vec3 uCamF;
uniform float uFocal;
uniform vec4 uBound;
uniform float uTime;
uniform vec3 uRoot;
uniform vec4 uShape;   // squash, melt, cos(yaw), sin(yaw)
uniform float uLip;    // distance correction for the domain deformation
uniform vec4 uLean;    // leanX, leanZ, swayX, swayZ
uniform vec4 uFeet;    // spread, dangle
uniform vec4 uRipple;  // amp, freq, phase, source height
uniform vec4 uWave;    // amp, height
uniform float uNub;
uniform vec3 uEyeC[2];
uniform vec3 uEyeX[2];
uniform vec3 uEyeZ[2];
uniform vec2 uEyeFrz;  // bend height and sway weight at the eyes, frozen
uniform vec4 uEyeA;    // open L, open R, squint L, squint R
uniform vec4 uEyeB;    // happy arc L, R, sleepy arc L, R
uniform vec4 uMouth;   // smile, O, grin, lip buzz
uniform vec4 uColor;   // hue shift, emission, glow build, -
uniform float uGradH[GRAD_N]; // palette: stop heights (padded past 1)
uniform vec3 uGradC[GRAD_N];  // palette: stop colours, linear
uniform vec3 uBead[2];        // palette: feet, deep and light, linear
uniform vec4 uCore;    // hot core: world centre, radius
uniform vec4 uRing;    // floor ring radius 1, intensity 1, radius 2, intensity 2
uniform vec4 uArcs;    // centre x, centre y, intensity, phase
uniform vec4 uArcs2;   // angle, spread, both sides, base radius
uniform int uDropN;
uniform vec4 uDrops[6];
uniform int uSparkN;
uniform vec4 uSparks[8];
uniform int uDotN;
uniform vec4 uDots[12];
uniform vec4 uStops;   // three stop x positions, alpha
uniform vec4 uGhost[3];
uniform float uGhostSq;
uniform float uSpeed;
uniform vec4 uArrow;   // climb arrow: x, y, alpha, -
uniform float uCamAz;  // the camera's azimuth around the body, in rest space
uniform vec4 uLookE;   // edge light: strength up top, low down, falloff power, gradient shift
uniform vec4 uLookS1;  // crown streak: height, offset across, spread in height, spread across
uniform vec4 uLookS2;  // shoulder streak: the same
uniform vec4 uLookE2;  // gradient shift up top, edge whitening low down, crown and shoulder streak tilt
uniform vec4 uLookK;   // crown streak, shoulder streak, edge whitening up top, left key
uniform vec3 uLookT;   // streak colour, linear
uniform vec3 uLookT2;  // the edge's tint low down, linear (white up top)
uniform int uDebug;
uniform int uZero;     // always 0: a loop start the compiler cannot fold
uniform vec3 uLight[18]; // the light he casts, linear (constants.ts LIGHT_SLOTS)

const float PI = 3.14159265;
// Light directions (world space, fixed): the form light, the soft crown
// highlight and the sharp catchlight all come from the upper left.
const vec3 SPEC_DIR = vec3(-0.42, 0.74, 0.53);

vec3 gDbg = vec3(0.0);
float gCov = 0.0; // this sample's object coverage for the rim: body, eyes and droplets 1, feet 0.75
float gFoot = 0.0; // the last shaded body point's foot weight
${SDF_GLSL}${FLOOR_GLSL}${FACE_GLSL}${MATERIALS_GLSL}${EFFECTS_GLSL}${FRAME_GLSL}`;
  }

  // src/lib/merc/programs.ts
  var SCENE_UNIFORMS = [
    "uRes",
    "uCamPos",
    "uCamR",
    "uCamU",
    "uCamF",
    "uFocal",
    "uBound",
    "uTime",
    "uRoot",
    "uShape",
    "uLip",
    "uLean",
    "uFeet",
    "uRipple",
    "uWave",
    "uNub",
    "uEyeC[0]",
    "uEyeX[0]",
    "uEyeZ[0]",
    "uEyeFrz",
    "uEyeA",
    "uEyeB",
    "uMouth",
    "uColor",
    "uCore",
    "uRing",
    "uArcs",
    "uArcs2",
    "uDropN",
    "uDrops[0]",
    "uSparkN",
    "uSparks[0]",
    "uDotN",
    "uDots[0]",
    "uStops",
    "uGhost[0]",
    "uGhostSq",
    "uSpeed",
    "uArrow",
    "uCamAz",
    "uDebug",
    "uZero",
    "uLight[0]",
    "uGradH[0]",
    "uGradC[0]",
    "uBead[0]",
    "uLookE",
    "uLookE2",
    "uLookS1",
    "uLookS2",
    "uLookK",
    "uLookT",
    "uLookT2"
  ];
  var POST_UNIFORMS = [
    "uSrc",
    "uSrcTexel",
    "uDstRes",
    "uDir",
    "uScene",
    "uA",
    "uB",
    "uRes",
    "uBg",
    "uOpaque",
    "uBloomK",
    "uCov",
    "uRim",
    "uRimY"
  ];
  function drop(gl, x) {
    gl.deleteProgram(x.p);
    for (const sh of x.shaders) gl.deleteShader(sh);
  }
  function start(gl, frag, names) {
    const p = gl.createProgram();
    if (p === null) throw new Error("Program link failed: no program object");
    const shaders = [];
    try {
      for (const [type, src] of [
        [gl.VERTEX_SHADER, VERT],
        [gl.FRAGMENT_SHADER, frag]
      ]) {
        const sh = gl.createShader(type);
        if (!sh) throw new Error("Shader compile failed: no shader object");
        shaders.push(sh);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p);
    } catch (err) {
      drop(gl, { p, shaders, names });
      throw err;
    }
    return { p, shaders, names };
  }
  function whyNot(gl, x) {
    for (const sh of x.shaders) {
      if (gl.getShaderParameter(sh, gl.COMPILE_STATUS) !== true) {
        return new Error(`Shader compile failed: ${gl.getShaderInfoLog(sh)}`);
      }
    }
    return new Error(`Program link failed: ${gl.getProgramInfoLog(x.p)}`);
  }
  function finish(gl, x) {
    const linked = gl.getProgramParameter(x.p, gl.LINK_STATUS) === true;
    const err = linked ? null : whyNot(gl, x);
    for (const sh of x.shaders) gl.deleteShader(sh);
    if (err) {
      gl.deleteProgram(x.p);
      throw err;
    }
    const loc = {};
    for (const n of x.names)
      loc[n.replace("[0]", "")] = gl.getUniformLocation(x.p, n);
    return { p: x.p, loc };
  }
  function startBuild(gl, quality, withPost) {
    const scene = start(gl, fragSource(QUALITY[quality]), SCENE_UNIFORMS);
    const post = [];
    try {
      if (withPost) {
        for (const frag of [POST_DOWN, POST_BLUR, POST_COMPOSITE]) {
          post.push(start(gl, frag, POST_UNIFORMS));
        }
      }
    } catch (err) {
      for (const x of [scene, ...post]) drop(gl, x);
      throw err;
    }
    return { quality, scene, post };
  }
  function buildDone(gl, parallel, b) {
    if (parallel === null) return true;
    return [b.scene, ...b.post].every(
      (x) => gl.getProgramParameter(x.p, parallel.COMPLETION_STATUS_KHR) === true
    );
  }
  function finishBuild(gl, b) {
    const made = [];
    try {
      const scene = finish(gl, b.scene);
      made.push(scene.p);
      const post = b.post.map((x) => {
        const prg = finish(gl, x);
        made.push(prg.p);
        return prg;
      });
      return {
        quality: b.quality,
        scene: { ...scene, q: QUALITY[b.quality] },
        post: post.length === 3 ? { down: post[0], blur: post[1], comp: post[2] } : null
      };
    } catch (err) {
      for (const p of made) gl.deleteProgram(p);
      for (const x of [b.scene, ...b.post].slice(made.length + 1)) drop(gl, x);
      throw err;
    }
  }
  function dropBuild(gl, b) {
    for (const x of [b.scene, ...b.post]) drop(gl, x);
  }
  function createPoller(poll) {
    let frame = 0;
    let timer = 0;
    const cancel = () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = 0;
      timer = 0;
    };
    const run = () => {
      cancel();
      poll();
    };
    return {
      ask() {
        if (frame || timer) return;
        frame = requestAnimationFrame(run);
        timer = window.setTimeout(run, 100);
      },
      cancel
    };
  }
  function deleteBuilt(gl, b) {
    gl.deleteProgram(b.scene.p);
    if (b.post) deletePostPrograms(gl, b.post);
  }
  function deletePostPrograms(gl, post) {
    gl.deleteProgram(post.down.p);
    gl.deleteProgram(post.blur.p);
    gl.deleteProgram(post.comp.p);
  }

  // src/lib/merc/sim-math.ts
  var TAU = Math.PI * 2;
  var clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  var lerp = (a, b, k) => a + (b - a) * k;
  var smooth = (a, b, x) => {
    const k = clamp((x - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };

  // src/lib/merc/sim-glide.ts
  var RIDE = {
    /** Up to this slope (semitones/s) he stands upright: vibrato, drift. */
    dead: 0.8,
    /** How long the slope is eased over, s. */
    slopeTau: 0.2,
    /**
     * The same on a lip roll (GlideMouth `buzz`), s: the trill's pitch
     * flutters with the lips, and at 0.2 s he rocked on it. Eased over half a
     * second, a flutter of a semitone either way, 3 to 8 times a second,
     * hardly leans him, while a wave of half an octave in 2.4 s still does.
     */
    buzzSlopeTau: 0.5,
    /** From this slope on he leans all the way. */
    full: 6,
    /** His full lean on the lean spring; `listen` leans 0.24. */
    lean: 0.17,
    /**
     * A reading this far (semitones) from the eased pitch is a jump, not a
     * slide. The fastest slide the rooms ask for, an octave in half a second
     * (24 semitones/s), runs under 2 semitones ahead of the eased pitch.
     */
    jump: 2.5
  };
  var freshGlide = () => ({
    pitch: 0,
    heard: false,
    slope: 0,
    env: 0
  });
  function stepGlide(g, voiced, midi, dt, slopeTau = RIDE.slopeTau) {
    const was = g.heard;
    const before = g.pitch;
    g.heard = voiced && Number.isFinite(midi);
    const follows = was && g.heard && Math.abs(midi - g.pitch) <= RIDE.jump;
    if (follows) g.pitch += (midi - g.pitch) * (1 - Math.exp(-dt / 0.06));
    else if (g.heard) g.pitch = midi;
    const rate = follows ? (g.pitch - before) / dt : 0;
    g.slope += (rate - g.slope) * (1 - Math.exp(-dt / slopeTau));
    g.env += ((voiced ? 1 : 0) - g.env) * (1 - Math.exp(-dt / 0.12));
  }
  function rideLean(slope) {
    const k = smooth(RIDE.dead, RIDE.full, Math.abs(slope));
    return k === 0 ? 0 : Math.sign(slope) * RIDE.lean * k;
  }

  // src/lib/merc/sim-choreo.ts
  var HOP_X = 0.38;
  var HOPS = [
    [0, HOP_X],
    [HOP_X, 0],
    [0, -HOP_X],
    [-HOP_X, 0]
  ];
  var DROP_T = 0.55;
  var DROP_Y0 = 1.75;
  var GRAV = 9.6;
  var CEL = { crouch: 0.15, air: 0.43, period: 0.8 };
  var HOP = { crouch: 0.12, air: 0.41, slot: 0.75 };
  var SPLAT = { sq: 0.58, hold: 0.24 };
  function crossed(prev, now, x, period = 0) {
    if (!period) return prev < x && now >= x;
    const k = Math.floor((now - x) / period);
    return k >= 0 && k * period + x > prev;
  }
  function blinkMul(tau, times, period = 0) {
    const t = period ? tau % period : tau;
    let m = 1;
    for (const b of times) {
      const d = t - b;
      if (d >= 0 && d < 0.22) {
        const k = d < 0.07 ? d / 0.07 : d < 0.1 ? 1 : 1 - (d - 0.1) / 0.12;
        m = Math.min(m, 1 - 0.93 * k);
      }
    }
    return m;
  }
  var hit = (c, x, period = 0) => crossed(c.prev, c.tau, x, period);
  var breathe = (c, amp = 0.02, per = 2.8) => amp * Math.sin(TAU * c.tau / per);
  function idle(c) {
    const { tau, T, X } = c;
    T.sq = 1 + breathe(c);
    T.lx = 0.025 * Math.sin(TAU * tau / 5.6);
    X.blink = blinkMul(tau, [1.1, 3.9, 4.18, 6.6], 8);
    const lt = tau % 8;
    if (lt > 2.2 && lt < 3.1) {
      T.lookX = -0.7;
      T.lookY = 0.1;
    } else if (lt > 5 && lt < 5.9) {
      T.lookX = 0.6;
      T.lookY = 0.25;
    }
  }
  function drop2(c) {
    const { tau, T, X, sim } = c;
    const s = sim.s;
    const g = 2 * DROP_Y0 / (DROP_T * DROP_T);
    if (tau < DROP_T) {
      const vy = g * tau;
      const y = DROP_Y0 - 0.5 * g * tau * tau;
      X.rootY = y;
      s.sq.x = 1.05 + Math.min(0.27, vy * 0.042);
      s.sq.v = 0;
      X.speed = clamp(vy / 3, 0, 1);
      const gk = smooth(0.05, 0.25, tau);
      X.ghosts = [
        [0, y + 0.22 + vy * 0.03, 0.92, 0.42 * gk],
        [0, y + 0.45 + vy * 0.06, 0.82, 0.2 * gk]
      ];
      T.lookY = -0.35;
      T.smile = 0.7;
      T.dangle = 0.015;
    } else {
      X.rootY = 0;
      if (hit(c, DROP_T)) {
        s.spl.v = 2.5;
        sim.splash(0.86, 1, 4, 0.5);
        sim.ring(0.8, 1.8);
      }
      const a = tau - DROP_T;
      X.speed = clamp(1 - a / 0.12, 0, 1);
      if (a < SPLAT.hold) {
        const sq0 = 1.05 + Math.min(0.27, g * DROP_T * 0.042);
        s.sq.x = lerp(sq0, SPLAT.sq, 1 - (1 - smooth(0, 0.06, a)) ** 2);
        s.sq.v = 0;
        T.sq = s.sq.x;
      }
      if (a < 0.4) {
        T.openL = 0;
        T.openR = 0;
        T.upL = 1;
        T.upR = 1;
        T.grin = 0.75;
      }
      X.blink = blinkMul(tau, [2.2, 4.4], 0);
      if (a > 1.2) T.sq = 1 + breathe(c);
    }
  }
  function listen(c) {
    const { tau, T, X, sim } = c;
    const v = sim.vs;
    const k = smooth(0, 0.5, tau);
    T.lx = 0.24 * k;
    T.lz = 0.06 * k;
    T.yaw = -0.2 * k;
    T.sq = 1 + breathe(c, 0.015);
    T.openR = tau > 0.25 ? 0 : 1;
    T.upR = tau > 0.25 ? 1 : 0;
    T.openL = 1.06;
    T.lookX = 0.45;
    T.lookY = 0.05;
    T.smile = 0.75;
    X.blink = blinkMul(tau, [3.3], 6);
    X.arcs = {
      c: [sim.rootX + 0.6, sim.rootY + 0.84 + SHAPE.bodyY0],
      intensity: (0.75 + 0.8 * v.level) * smooth(0.15, 0.55, tau),
      angle: 0,
      spread: 0.72,
      both: 0,
      base: 0.1
    };
    X.arcSpeed = -1.1;
  }
  function sing(c) {
    const { tau, T, X, sim } = c;
    const v = sim.vs;
    const vo = v.voiced;
    const pn = clamp(v.cents / 700, -0.35, 1.25);
    const near = v.cents > 350 ? 700 : 0;
    const dev = clamp((v.cents - near) / 60, -1, 1);
    T.mouthO = vo * clamp(0.2 + v.level * 1, 0, 1);
    T.smile = 1 - 0.7 * vo;
    T.sq = 1 + vo * (0.12 * pn - 0.08 * v.level) + breathe(c, 0.012);
    T.ry = vo * 0.05 * Math.max(0, pn);
    T.lz = -0.06 * pn * vo;
    T.lx = 0.11 * dev * vo;
    T.hue = vo * clamp(pn * 1.5 - 0.2, -1, 1);
    T.ripple = vo * (12e-4 + 2e-3 * v.level + 2e-3 * (1 - v.steady));
    T.lookY = 0.35 * pn * vo;
    T.glow = 0.25 * v.level;
    T.sqL = 0.12 * v.level;
    T.sqR = 0.12 * v.level;
    const gu = vo * clamp((v.rate - 220) / 230, 0, 1);
    if (gu > 0) {
      T.openL = 1 - gu;
      T.openR = 1 - gu;
      T.upL = gu;
      T.upR = gu;
    }
    X.rippleSpeed = 8 + 5 * Math.max(0, pn);
    X.blink = blinkMul(tau, [2.7, 6.9], 9);
    X.arcs = {
      c: [sim.rootX + 0.5, sim.rootY + 0.62 + SHAPE.bodyY0],
      intensity: clamp(v.level * 1.2, 0, 1),
      angle: 0,
      spread: 0.7,
      both: 1,
      base: 0.1
    };
    X.arcSpeed = 1 + 0.9 * Math.max(0, pn);
  }
  function lock(c) {
    const { tau, T, X, sim } = c;
    const v = sim.vs;
    const L = sim.lock;
    const lockedFor = L.on ? sim.t - L.t0 : 0;
    const vo = v.voiced;
    const near = v.cents > 350 ? 700 : 0;
    const dev = clamp((v.cents - near) / 60, -1, 1);
    const build = L.on ? 1 - Math.exp(-lockedFor / 1.4) : 0;
    T.mouthO = vo * clamp(0.15 + v.level * 0.7, 0, 1);
    T.smile = 1 - 0.6 * vo;
    T.lx = 0.08 * dev * vo * (L.on ? 0.3 : 1);
    T.sq = 1 + breathe(c, 0.012) - 0.04 * v.level;
    T.glow = 1.15 * build;
    T.emis = 1 + 0.3 * build;
    if (L.on && lockedFor > 0.45) {
      T.openL = 0;
      T.openR = 0;
      T.upL = 1;
      T.upR = 1;
    }
    T.ripple = vo * 8e-4;
    T.hue = 0.1 * build;
    X.blink = blinkMul(tau, [0.6], 0);
  }
  function climb(c) {
    const { tau, T, X, sim } = c;
    const s = sim.s;
    const P = 3.2;
    const t = tau % P;
    let y = 0;
    if (t < 0.25) {
      T.sq = 0.84;
      T.lookY = 0.3;
    } else if (t < 2.4) {
      const k = smooth(0.25, 1.05, t);
      y = 0.2 * k + (t > 1.05 ? 0.012 * Math.sin(TAU * (t - 1.05) / 1.3) : 0);
      T.sq = 1.1 + breathe(c, 0.012);
      T.lookY = 0.85;
      T.hue = 0.6 * k;
      T.mouthO = t < 1.1 ? 0.3 : 0;
      T.smile = t < 1.1 ? 0.4 : 1;
      T.dangle = 0.015 * k;
      const gk = smooth(0.3, 0.6, t) * (1 - smooth(1.9, 2.4, t));
      X.ghosts = [0, 1, 2].map((i) => {
        const sc = 0.88 - 0.13 * i;
        return [
          sim.rootX,
          y + 0.4 * (1 - sc) - 0.1 * (i + 1) * k,
          sc,
          [0.8, 0.52, 0.28][i] * gk
        ];
      });
      X.arrow = [
        sim.rootX - 0.74,
        y + 0.42 + SHAPE.bodyY0,
        0.85 * smooth(0.35, 0.7, t) * (1 - smooth(1.9, 2.4, t))
      ];
    } else {
      const k = smooth(2.4, 3, t);
      y = 0.2 * (1 - k);
      T.sq = 1.1 - 0.1 * k;
    }
    if (hit(c, 0.25, P)) s.sq.v += 3;
    if (hit(c, 2.4, P)) s.sq.v -= 1.5;
    X.rootY = y;
    X.blink = blinkMul(t, [1.8], 0);
  }
  function celebrate(c) {
    const { tau, T, X, sim } = c;
    const s = sim.s;
    const P = CEL.period;
    const t = tau % P;
    const v0 = GRAV * CEL.air / 2;
    T.openL = 0;
    T.openR = 0;
    T.upL = 1;
    T.upR = 1;
    T.grin = 1;
    T.smile = 0;
    T.glow = 0.35;
    T.emis = 1.1;
    let y = 0;
    if (t < CEL.crouch) T.sq = 0.84;
    else if (t < CEL.crouch + CEL.air) {
      const ta = t - CEL.crouch;
      y = v0 * ta - 0.5 * GRAV * ta * ta;
      T.sq = 1;
      T.dangle = 0.025;
    }
    if (hit(c, CEL.crouch + CEL.air, P)) {
      s.sq.v -= 3.9;
      sim.splash(0.62, 0.55, 4);
    }
    if (hit(c, CEL.crouch + 0.02, 2 * P)) sim.sparkle();
    T.lx = 0.05 * Math.sin(TAU * tau / 1.4);
    X.rootY = y;
  }
  function point(c) {
    const { tau, T, X, sim } = c;
    const s = sim.s;
    const on = tau > 0.28;
    T.lx = on ? 0.06 : -0.05;
    T.sq = on ? 1 + breathe(c, 0.012) : 0.95;
    T.nub = on ? tau % 2.4 > 1.9 && tau % 2.4 < 2.1 ? 1.1 : 1 : 0;
    T.lookX = on ? 0.75 : 0;
    T.lookY = on ? 0.12 : 0;
    T.yaw = on ? 0.16 : 0;
    T.smile = 1;
    X.blink = blinkMul(tau, [1.6, 3.9], 5);
    if (on) {
      const tip = sim.restToWorld([
        SHAPE.nub[0] + 0.34 * 0.957 + 0.1,
        SHAPE.nub[1] + 0.34 * 0.287,
        0
      ]);
      X.arcs = {
        c: [tip[0], tip[1]],
        intensity: smooth(0.55, 0.85, tau) * 0.8 * clamp(s.nub.x, 0, 1),
        angle: 0.15,
        spread: 0.6,
        both: 0,
        base: 0.04
      };
      X.arcSpeed = 0.9;
    }
  }
  function sleep(c) {
    const { tau, T, X } = c;
    const dz = smooth(0, 1.3, tau);
    T.melt = 0.14 * dz;
    T.sq = 1 - 0.34 * dz + breathe(c, 0.02, 3.6) * dz;
    T.openL = 1 - smooth(0.05, 0.6, tau);
    T.openR = T.openL;
    T.dnL = smooth(0.3, 0.7, tau);
    T.dnR = T.dnL;
    T.smile = 0.5;
    T.emis = 0.92;
    T.ripple = 12e-4;
    X.rippleSpeed = 2;
    X.rippleFreq = 30;
    X.rippleSrc = 1.05;
  }
  function hop(c) {
    const { tau, T, X, sim } = c;
    const s = sim.s;
    const S = HOP.slot;
    const P = 4 * S;
    const t = tau % P;
    const slot = Math.min(3, Math.floor(t / S));
    const u = t - slot * S;
    const [xa, xb] = HOPS[slot];
    const dir = Math.sign(xb - xa);
    const v0 = GRAV * HOP.air / 2;
    const apex = v0 * v0 / (2 * GRAV);
    const u0 = HOP.crouch;
    const u1 = HOP.crouch + HOP.air;
    const arc = { u, xa, xb, dir, v0, apex, u0, u1 };
    const [x, y] = hopFlight(T, arc);
    if (hit(c, u1, S)) s.sq.v -= 3.5;
    T.lookX = 0.6 * dir;
    X.rootX = x;
    X.rootY = y;
    X.dots = hopDots(arc);
    X.stops = [-HOP_X, 0, HOP_X, 1];
    if (u > u0 + 0.06 && u < u1) X.ghosts = hopGhosts(arc);
  }
  function hopFlight(T, a) {
    const { u, xa, xb, dir, v0, u0, u1 } = a;
    let x = xa;
    let y = 0;
    if (u < u0) {
      T.sq = 0.84;
      T.lx = -0.06 * dir;
    } else if (u < u1) {
      const ta = u - u0;
      const vy = v0 - GRAV * ta;
      x = lerp(xa, xb, ta / HOP.air);
      y = v0 * ta - 0.5 * GRAV * ta * ta;
      T.sq = vy < -0.67 ? 1.03 : 1;
      T.lx = 0.14 * dir;
      T.dangle = 0.025;
    } else {
      x = xb;
    }
    return [x, y];
  }
  function hopDots(a) {
    const { u, xa, xb, apex, u0, u1 } = a;
    const S = HOP.slot;
    const da = u < u0 ? smooth(0, u0, u) : u < u1 ? 1 : 1 - smooth(u1, S, u);
    const dots = [];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      dots.push([
        lerp(xa, xb, k),
        0.03 + 4 * apex * k * (1 - k),
        0.25,
        0.7 * da * (0.45 + 0.55 * Math.sin(Math.PI * k))
      ]);
    }
    return dots;
  }
  function hopGhosts(a) {
    const { u, xa, xb, apex, u0, u1 } = a;
    const gk = smooth(u0 + 0.06, u0 + 0.16, u) * (1 - smooth(u1 - 0.11, u1, u));
    const k1 = (u - u0 - 0.06) / HOP.air;
    const k2 = (u - u0 - 0.12) / HOP.air;
    return [
      [
        lerp(xa, xb, k1),
        4 * apex * k1 * (1 - k1),
        0.94,
        0.4 * gk * (k1 > 0 ? 1 : 0)
      ],
      [
        lerp(xa, xb, k2),
        4 * apex * k2 * (1 - k2),
        0.86,
        0.2 * gk * (k2 > 0 ? 1 : 0)
      ]
    ];
  }
  function hum(c) {
    const { tau, T, X, sim } = c;
    const e = sim.vs.env;
    const level = sim.vs.level;
    T.smile = 0.55;
    T.sq = 1 + breathe(c, 0.012);
    T.sqL = 0.1 * e;
    T.sqR = 0.1 * e;
    T.glow = 0.18 * level;
    T.yaw = -0.14;
    T.lookX = 0.35;
    T.lookY = 0.08;
    X.blink = blinkMul(tau, [1.9, 5.3], 7);
    if (!sim.still) {
      T.lx = 0.015 * Math.sin(TAU * tau / 5.6);
      T.ripple = e * (5e-4 + 8e-4 * level);
      X.rippleSpeed = 6;
    }
    X.arcs = sim.soundRings ? humRings(sim, e, level) : null;
    if (sim.still) {
      X.arcSpeed = 0;
      X.arcPhase = 0.5;
    } else X.arcSpeed = 0.55 + 0.85 * level;
    humMouth(c);
  }
  var LIP_FLUTTER = TAU * 8;
  function humMouth(c) {
    const { T, X, sim } = c;
    const v = sim.vs;
    if (sim.glideMouth === "open") {
      T.mouthO = v.voiced * clamp(0.2 + v.level * 1, 0, 1);
      T.smile = 1 - 0.7 * v.voiced;
    } else if (sim.glideMouth === "buzz") {
      T.buzz = v.env;
      X.rippleSpeed = sim.still ? 0 : LIP_FLUTTER;
    }
  }
  function humRings(sim, e, level) {
    const at = sim.restToWorld([0.46, 0.6, 0]);
    return {
      c: [at[0], at[1]],
      intensity: e * Math.min(0.75, 0.3 + 0.5 * level),
      angle: 0.1 + sim.s.lx.x,
      spread: 0.7,
      both: 0,
      base: 0.1 + 0.07 * level
    };
  }
  function ride(c) {
    hum(c);
    const { T, sim } = c;
    if (sim.still) return;
    const lean = rideLean(sim.vs.slope);
    T.lx = lean;
    T.lookY = 0.08 + 1.6 * lean;
  }
  var REACH_STRETCH = 0.16;
  function reach(c) {
    ride(c);
    const { T, sim } = c;
    const v = sim.vs;
    const h = v.voiced * clamp(v.cents / REACH_CENTS, -1, 1);
    T.hue = h;
    if (sim.still) return;
    T.sq = 1 + REACH_STRETCH * h + breathe(c, 0.012);
    T.lookY = 0.08 + 1.6 * rideLean(v.slope) + 0.45 * h;
  }
  var MOVES = {
    drop: drop2,
    idle,
    listen,
    sing,
    lock,
    climb,
    celebrate,
    point,
    sleep,
    hop,
    hum,
    ride,
    reach
  };
  function choreo(sim, tau, prev) {
    const T = {};
    const X = {
      speed: 0,
      ghosts: null,
      arcs: null,
      dots: null,
      stops: null,
      arrow: null,
      blink: 1,
      rootX: null,
      rootY: null
    };
    MOVES[sim.state]({ tau, prev, T, X, sim });
    return [T, X];
  }

  // src/lib/merc/sim-springs.ts
  var SPRINGS = {
    sq: [1, 3, 0.24],
    lx: [0, 1.7, 0.5],
    lz: [0, 1.7, 0.5],
    swx: [0, 2.3, 0.2],
    swz: [0, 2.3, 0.2],
    melt: [0, 0.7, 0.95],
    spl: [0, 1.7, 0.32],
    yaw: [0, 1.4, 0.75],
    nub: [0, 2.4, 0.32],
    openL: [1, 7, 0.85],
    openR: [1, 7, 0.85],
    sqL: [0, 5, 0.85],
    sqR: [0, 5, 0.85],
    upL: [0, 6, 0.9],
    upR: [0, 6, 0.9],
    dnL: [0, 3, 0.95],
    dnR: [0, 3, 0.95],
    lookX: [0, 3.2, 0.8],
    lookY: [0, 3.2, 0.8],
    smile: [1, 5, 0.9],
    mouthO: [0, 11, 0.72],
    grin: [0, 5, 0.85],
    hue: [0, 1.3, 0.95],
    emis: [1, 1.1, 0.95],
    glow: [0, 0.8, 1],
    ripple: [0, 3, 1],
    dangle: [0, 3.5, 0.55],
    rx: [0, 2.2, 0.8],
    ry: [0, 3.5, 0.6],
    // A lip roll's buzzing lips (GlideMouth `buzz`). Last, so every spring
    // before it steps exactly as it did.
    buzz: [0, 9, 0.85]
  };
  var SPRING_NAMES = Object.keys(SPRINGS);
  function makeSprings() {
    const s = {};
    for (const k of SPRING_NAMES) {
      const [x, fq, z] = SPRINGS[k];
      s[k] = { x, v: 0, f: fq, z };
    }
    return s;
  }
  function stepSprings(s, T, dt) {
    for (const k of SPRING_NAMES) {
      if (k === "rx" || k === "ry") continue;
      const sp = s[k];
      const target = T[k] ?? SPRINGS[k][0];
      const w = TAU * sp.f;
      sp.v += (w * w * (target - sp.x) - 2 * sp.z * w * sp.v) * dt;
      sp.x += sp.v * dt;
    }
  }
  function stepRoot(sp, scripted, target, dt) {
    if (scripted != null) {
      sp.v = (scripted - sp.x) / dt;
      sp.x = scripted;
    } else {
      const tg = target ?? 0;
      const w = TAU * sp.f;
      sp.v += (w * w * (tg - sp.x) - 2 * sp.z * w * sp.v) * dt;
      sp.x += sp.v * dt;
    }
    return sp.x;
  }

  // src/lib/merc/sim.ts
  var STEP = 1 / 240;
  var freshLock = () => ({
    acc: 0,
    on: false,
    t0: 0,
    off: 0,
    lastPulse: 0
  });
  var SPARKLES = [
    [158, 0.86, 0.075, 0],
    [122, 0.92, 0.055, 0.12],
    [52, 0.9, 0.085, 0.05],
    [18, 0.84, 0.06, 0.2],
    [-22, 0.88, 0.07, 0.1],
    [-150, 0.84, 0.065, 0.16],
    [92, 1, 0.05, 0.24]
  ];
  var SPARKLES_RIGHT = [
    [22, 0.86, 0.075, 0],
    [68, 0.92, 0.055, 0.12],
    [45, 0.9, 0.085, 0.05],
    [0, 0.84, 0.06, 0.2],
    [-22, 0.88, 0.07, 0.1],
    [-44, 0.84, 0.065, 0.16],
    [88, 1, 0.05, 0.24]
  ];
  var Sim = class {
    voiceAt = null;
    bias = { yaw: 0, lookX: 0, lookY: 0 };
    /**
     * Where a celebration's sparkles land: all around him, or on one side
     * only, so a host can keep them off whatever stands on his other side.
     */
    sparkleSide = "around";
    /**
     * Reduced motion, for the states that read it: `ride` stands upright and
     * `hum`'s rings hold still and only fade.
     */
    still = false;
    /**
     * `hum` (and so `ride`) sends a fan of sound rings from the front of his
     * face while the voice sounds. A room that draws its own sound there
     * turns them off (Lip roll's buzz); everything else about the state stays.
     */
    soundRings = true;
    /**
     * His mouth while he hums or rides (GlideMouth): the closed smile by
     * default; Lip roll gives him a lip roll's buzzing lips, or `sing`'s O.
     */
    glideMouth = "closed";
    // Set by reset().
    state;
    stateT0;
    prevTau;
    t;
    n;
    s;
    rootX;
    rootY;
    vx;
    vy;
    drops;
    sparks;
    rings;
    wave;
    ripplePhase;
    arcPhase;
    voice;
    vs;
    lock;
    fx;
    // Sound arcs fade out when a state stops drawing them.
    lastArcs;
    arcsK;
    // Continuous capture: the voice clock restarts at each setState.
    voiceT0;
    constructor(state = "idle") {
      this.reset(state);
    }
    reset(state) {
      this.t = 0;
      this.n = 0;
      this.s = makeSprings();
      this.rootX = 0;
      this.rootY = 0;
      this.vx = 0;
      this.vy = 0;
      this.drops = [];
      this.sparks = [];
      this.rings = [];
      this.wave = null;
      this.ripplePhase = 0;
      this.arcPhase = 0;
      this.voice = { voiced: false, cents: 0, level: 0, steady: 0, midi: 57 };
      this.vs = {
        voiced: 0,
        level: 0,
        cents: 0,
        steady: 0,
        rate: 0,
        ...freshGlide()
      };
      this.lock = freshLock();
      this.fx = {
        speed: 0,
        ghosts: null,
        arcs: null,
        dots: null,
        stops: null,
        arrow: null,
        blink: 1,
        rootX: null,
        rootY: null
      };
      this.lastArcs = null;
      this.arcsK = 0;
      this.voiceT0 = 0;
      this.setState(state, true);
    }
    setState(name, fresh = false) {
      if (!isMercState(name)) return;
      this.state = name;
      this.stateT0 = this.t;
      this.prevTau = -1e-6;
      if (name === "drop") {
        this.rootX = 0;
        this.rootY = DROP_Y0;
        this.s.rx.x = 0;
        this.s.ry.x = 0;
        this.s.sq.x = 1.05;
        this.s.sq.v = 0;
      }
      if (fresh) this.lock = freshLock();
    }
    snapshot() {
      return structuredClone({
        state: this.state,
        stateT0: this.stateT0,
        prevTau: this.prevTau,
        t: this.t,
        n: this.n,
        s: this.s,
        rootX: this.rootX,
        rootY: this.rootY,
        vx: this.vx,
        vy: this.vy,
        drops: this.drops,
        sparks: this.sparks,
        rings: this.rings,
        wave: this.wave,
        ripplePhase: this.ripplePhase,
        arcPhase: this.arcPhase,
        voice: this.voice,
        vs: this.vs,
        lock: this.lock,
        fx: this.fx,
        lastArcs: this.lastArcs,
        arcsK: this.arcsK,
        voiceT0: this.voiceT0
      });
    }
    // The snapshot stays untouched, so it can be restored again.
    restore(snap) {
      Object.assign(this, structuredClone(snap));
    }
    // Droplets thrown up from the floor just outside the body's edge, so they
    // read as separate beads from the first frame instead of knobs on the flanks.
    // edge: distance from his centre; k scales the throw, kx its sideways part.
    splash(edge = 0.8, k = 1, n = 6, kx = 1) {
      const R = [
        [-1, 0.25, 2, 0.042],
        [1, 0.22, 2.2, 0.038],
        [-1, 0.35, 1.5, 0.03],
        [1, 0.32, 1.6, 0.032],
        [-1, 0.12, 2.6, 0.025],
        [1, 0.14, 2.5, 0.027]
      ];
      for (const [sd, vx, vy, r] of R.slice(0, n)) {
        this.drops.push({
          p: [this.rootX + sd * edge, 0.05, 0.16],
          v: [sd * vx * k * kx, vy * k, 0.12],
          r: r * Math.sqrt(k),
          age: 0
        });
      }
      this.drops = this.drops.slice(-6);
    }
    sparkle() {
      if (this.sparkleSide === "none" || globalThis.__mercSparkles === false) {
        this.sparks = [];
        return;
      }
      const A = this.sparkleSide === "around" ? SPARKLES : SPARKLES_RIGHT;
      const side = this.sparkleSide === "left" ? -1 : 1;
      this.sparks = A.map(([deg, r, s, delay], i) => {
        const a = deg * Math.PI / 180;
        return {
          p: [
            this.rootX + side * Math.cos(a) * r,
            this.rootY + 0.6 + SHAPE.bodyY0 + Math.sin(a) * r * 0.85,
            0.15
          ],
          size: s * 3,
          t0: this.t + delay,
          life: 1.2 + 0.06 * (i % 3),
          ph: i * 1.7
        };
      });
    }
    ring(strength, speed) {
      this.rings.push({ t0: this.t, s: strength, sp: speed });
      this.rings = this.rings.slice(-2);
    }
    step(dt) {
      const raw = this.voiceAt ? this.voiceAt(this.t - this.voiceT0) : this.voice;
      smoothVoice(this.vs, raw, dt);
      stepGlide(
        this.vs,
        raw.voiced,
        raw.midi,
        dt,
        this.glideMouth === "buzz" ? RIDE.buzzSlopeTau : RIDE.slopeTau
      );
      this.trackLock(raw, dt);
      const tau = this.t - this.stateT0;
      const [T, X] = choreo(this, tau, this.prevTau);
      this.prevTau = tau;
      stepSprings(this.s, T, dt);
      this.moveRoot(T, X, dt);
      this.ageParticles(dt);
      this.advancePhases(X, dt);
      this.fx = X;
      this.t += dt;
      this.n += 1;
    }
    // Lock detection on the raw voice.
    trackLock(raw, dt) {
      const L = this.lock;
      const inWin = raw.voiced && Math.abs(raw.cents) < 30 && raw.steady > 0.72;
      L.acc = inWin ? Math.min(0.3, L.acc + dt) : Math.max(0, L.acc - dt * 2);
      if (!L.on && L.acc > 0.12) this.engageLock();
      if (L.on) this.holdLock(raw, dt);
    }
    // In the window long enough: lock on. In the lock state he also squashes,
    // and a floor ring and a ripple wave go out.
    engageLock() {
      const L = this.lock;
      L.on = true;
      L.off = 0;
      L.t0 = this.t;
      L.lastPulse = this.t;
      if (this.state === "lock") {
        this.s.sq.v -= 3.4;
        this.ring(1, 1.9);
        this.wave = { t0: this.t, amp: 0.03 };
      }
    }
    // Let go after 0.15 s out of the window. In the lock state a floor ring
    // pulses every 1.15 s while the lock holds.
    holdLock(raw, dt) {
      const L = this.lock;
      if (!raw.voiced || Math.abs(raw.cents) > 50) {
        L.off += dt;
        if (L.off > 0.15) {
          L.on = false;
          L.off = 0;
          L.acc = 0;
        }
      } else L.off = 0;
      if (L.on && this.state === "lock" && this.t - L.lastPulse > 1.15) {
        L.lastPulse = this.t;
        this.ring(0.5, 1.5);
      }
    }
    // Root: kinematic when the state scripts it, sprung back home otherwise.
    moveRoot(T, X, dt) {
      const ox = this.rootX;
      const oy = this.rootY;
      this.rootX = stepRoot(this.s.rx, X.rootX, T.rx, dt);
      this.rootY = stepRoot(this.s.ry, X.rootY, T.ry, dt);
      const nvx = (this.rootX - ox) / dt;
      const nvy = (this.rootY - oy) / dt;
      this.s.swx.v -= (nvx - this.vx) * 0.75;
      this.vx = nvx;
      this.vy = nvy;
    }
    // Particles: droplets fly and land, sparks and floor rings run out.
    ageParticles(dt) {
      for (const d of this.drops) {
        d.v[1] -= 9 * dt;
        for (let i = 0; i < 3; i++) d.p[i] += d.v[i] * dt;
        d.age += dt;
      }
      this.drops = this.drops.filter((d) => d.p[1] > d.r * 0.6 && d.age < 2.5);
      this.sparks = this.sparks.filter((s) => this.t < s.t0 + s.life);
      this.rings = this.rings.filter((r) => this.t - r.t0 < 2.2);
      if (this.wave && this.t - this.wave.t0 > 0.9) this.wave = null;
    }
    // The ripple and sound-arc phases, and the arcs' fade once a state stops
    // drawing them.
    advancePhases(X, dt) {
      this.ripplePhase += dt * (X.rippleSpeed ?? 9);
      if (X.arcPhase === void 0) this.arcPhase += dt * (X.arcSpeed ?? 1.2);
      else this.arcPhase = X.arcPhase;
      if (X.arcs) {
        this.lastArcs = X.arcs;
        this.arcsK = 1;
      } else if (this.lastArcs) {
        this.arcsK = Math.max(0, this.arcsK - dt / 0.35);
        if (this.arcsK <= 0) this.lastArcs = null;
      }
    }
    // Rest-space point to world, approximately (used to place effects).
    restToWorld(q) {
      const s = this.s;
      let [x, y, z] = q;
      const m = 1 + Math.max(0, s.melt.x + s.spl.x) * 0.75 * (1 - smooth(SHAPE.bodyY0, 0.8 + SHAPE.bodyY0, y));
      x *= m;
      z *= m;
      const sq = s.sq.x;
      y *= sq;
      x /= Math.sqrt(sq);
      z /= Math.sqrt(sq);
      const sw = smooth(0.25 + SHAPE.bodyY0, 1.2 + SHAPE.bodyY0, y) ** 2;
      x += s.swx.x * sw;
      z += s.swz.x * sw;
      const hy = clamp(
        (y - SHAPE.bodyY0 + 0.055) / (SHAPE.restH - SHAPE.bodyY0 + 0.055),
        0,
        1.4
      );
      const ax = -s.lx.x * hy;
      [x, y] = [
        Math.cos(ax) * x - Math.sin(ax) * y,
        Math.sin(ax) * x + Math.cos(ax) * y
      ];
      const yw = -s.yaw.x;
      [x, z] = [
        Math.cos(yw) * x - Math.sin(yw) * z,
        Math.sin(yw) * x + Math.cos(yw) * z
      ];
      return [x + this.rootX, y + this.rootY, z];
    }
    // Everything the shader needs for this instant.
    pose() {
      const s = this.s;
      const X = this.fx;
      const sq = Math.max(0.3, s.sq.x);
      const melt = Math.max(0, s.melt.x + s.spl.x);
      const blink = X.blink ?? 1;
      const eyes = placeEyes(
        s.lookX.x + this.bias.lookX,
        s.lookY.x + this.bias.lookY
      );
      const yaw = s.yaw.x + this.bias.yaw;
      const W = {
        root: [this.rootX, this.rootY, 0],
        shape: [sq, melt, Math.cos(yaw), Math.sin(yaw)],
        lean: [s.lx.x, s.lz.x, s.swx.x, s.swz.x]
      };
      const guessOf = (r) => this.restToWorld(r);
      const eyeFrz = [0, 0];
      for (const e of eyes) {
        const c = restToWorldExact(e.c, W, guessOf(e.c));
        const f2 = bendAt(c, W);
        eyeFrz[0] += f2[0] / 2;
        eyeFrz[1] += f2[1] / 2;
      }
      const coreR = [0, SHAPE.coreY, -0.04];
      const core = restToWorldExact(coreR, W, guessOf(coreR));
      const RING0 = 0.35;
      const RING1 = 0.66;
      const rings = this.rings.map((r) => {
        const age = this.t - r.t0;
        const u = 1 - Math.exp(-age * r.sp / (RING1 - RING0));
        return [
          RING0 + (RING1 - RING0) * u,
          r.s * Math.exp(-age * 1.6) * smooth(0, 0.04, age) * (1 - smooth(0.7, 0.97, u))
        ];
      });
      const arcsSrc = X.arcs ?? this.lastArcs;
      const arcsI = X.arcs ? 1 : this.arcsK;
      while (rings.length < 2) rings.unshift([0, 0]);
      const wave = this.wave ? [
        this.wave.amp * Math.exp(-(this.t - this.wave.t0) * 2.5),
        0.02 + 1.6 * (this.t - this.wave.t0)
      ] : [0, 0];
      const drops = this.drops.map(
        (d) => [
          d.p[0],
          d.p[1],
          d.p[2],
          d.r * (1 - smooth(1.6, 2.4, d.age)) * (d.v[1] < 0 ? smooth(d.r * 0.6, d.r * 0.6 + 0.07, d.p[1]) : 1)
        ]
      );
      const sparks = this.sparks.filter((p) => this.t >= p.t0).map((p) => {
        const age = this.t - p.t0;
        const life = Math.sin(Math.PI * age / p.life) ** 0.4;
        const tw = 0.78 + 0.22 * Math.sin(age * 17 + p.ph);
        return [p.p[0], p.p[1] + age * 0.06, p.p[2], p.size * life * tw];
      });
      const cy = this.rootY + (0.58 + SHAPE.bodyY0) * sq;
      let br = 0.72 * Math.max(sq, 1 / Math.sqrt(sq)) * (1 + melt * 0.6) + 0.12 + 0.36 * Math.max(0, s.nub.x) + 0.12;
      for (const d of drops) {
        br = Math.max(
          br,
          Math.hypot(d[0] - this.rootX, d[1] - cy, d[2]) + d[3] + 0.12
        );
      }
      return {
        t: this.t,
        root: [this.rootX, this.rootY, 0],
        shape: [sq, melt, Math.cos(yaw), Math.sin(yaw)],
        lip: Math.min(sq, 1 / Math.sqrt(sq)) / (1 + melt * 0.75) * 0.85,
        lean: [s.lx.x, s.lz.x, s.swx.x, s.swz.x],
        feet: [1, Math.max(0, s.dangle.x), 0, 0],
        ripple: [
          Math.max(0, s.ripple.x),
          X.rippleFreq ?? 60,
          this.ripplePhase,
          X.rippleSrc ?? SHAPE.mouthY
        ],
        wave: [wave[0], wave[1], 0, 0],
        nub: Math.max(0, s.nub.x),
        eyeC: [...eyes[0].c, ...eyes[1].c],
        eyeX: [...eyes[0].x, ...eyes[1].x],
        eyeZ: [...eyes[0].z, ...eyes[1].z],
        eyeFrz,
        core: [core[0], core[1], core[2], 0.24 * Math.sqrt(Math.max(sq, 0.6))],
        // Once a closed-eye arc is mostly drawn, the last sliver of the eye
        // goes, so a squeeze never shows a flat dash under the curved lid.
        eyeA: [
          clamp(s.openL.x, 0, 1.15) * blink * (1 - smooth(0.4, 0.85, s.upL.x)),
          clamp(s.openR.x, 0, 1.15) * blink * (1 - smooth(0.4, 0.85, s.upR.x)),
          clamp(s.sqL.x, 0, 0.6),
          clamp(s.sqR.x, 0, 0.6)
        ],
        eyeB: [
          clamp(s.upL.x, 0, 1),
          clamp(s.upR.x, 0, 1),
          clamp(s.dnL.x, 0, 1),
          clamp(s.dnR.x, 0, 1)
        ],
        mouth: [
          clamp(s.smile.x, 0, 1),
          clamp(s.mouthO.x, 0, 1),
          clamp(s.grin.x, 0, 1),
          clamp(s.buzz.x, 0, 1)
        ],
        color: [
          clamp(s.hue.x, -1, 1),
          Math.max(0, s.emis.x),
          Math.max(0, s.glow.x),
          0
        ],
        ring: [rings[0][0], rings[0][1], rings[1][0], rings[1][1]],
        arcs: arcsSrc ? [arcsSrc.c[0], arcsSrc.c[1], arcsSrc.intensity * arcsI * (globalThis.__mercArcs ?? 1), this.arcPhase] : [0, 0, 0, 0],
        arcs2: arcsSrc ? [arcsSrc.angle, arcsSrc.spread, arcsSrc.both, arcsSrc.base] : [0, 1, 0, 0.1],
        drops,
        sparks,
        dots: X.dots ?? [],
        stops: X.stops ?? [0, 0, 0, 0],
        ghosts: X.ghosts ?? [],
        arrow: X.arrow ? [...X.arrow, 0] : [0, 0, 0, 0],
        speed: X.speed || 0,
        bound: [this.rootX, cy, 0, br]
      };
    }
  };
  function smoothVoice(vs, raw, dt) {
    const a1 = 1 - Math.exp(-dt / 0.045);
    vs.level += ((raw.voiced ? raw.level : 0) - vs.level) * a1;
    vs.voiced += ((raw.voiced ? 1 : 0) - vs.voiced) * (1 - Math.exp(-dt / 0.045));
    const pc = vs.cents;
    if (raw.voiced) {
      vs.cents += (raw.cents - vs.cents) * (1 - Math.exp(-dt / 0.06));
    }
    vs.rate += ((vs.cents - pc) / dt - vs.rate) * (1 - Math.exp(-dt / 0.1));
    vs.steady += ((raw.voiced ? raw.steady : 0) - vs.steady) * a1;
  }

  // src/lib/merc/renderer.ts
  var resolveView = (v) => typeof v === "string" ? VIEWS[v] : v;
  function mount(container, opts = {}) {
    const capture = opts.capture ?? false;
    const continuous = capture && (opts.continuous ?? false);
    const transparent = opts.transparent ?? false;
    const size = opts.size ?? 0;
    const pixelRatio = opts.pixelRatio ?? Math.min(2, window.devicePixelRatio || 1);
    const live = !capture;
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = size ? `${size}px` : "100%";
    canvas.style.height = size ? `${size}px` : "100%";
    container.appendChild(canvas);
    const context = canvas.getContext("webgl2", {
      alpha: transparent,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: capture,
      powerPreference: "high-performance"
    });
    if (!context) {
      canvas.remove();
      throw new Error("WebGL2 is not available in this browser");
    }
    const gl = context;
    let quality = opts.quality ?? "high";
    let view = resolveView(opts.view ?? "front");
    let cam = cameraFor(view);
    let look = LOOK;
    let lookU = lookUniforms(look);
    let palette = PALETTE;
    let pal = paletteUniforms(palette);
    let rimStrength = RIM.strength;
    let lightU = lightUniforms(LIGHT);
    const bgLin = new Float32Array(BG.map(srgbToLin));
    const sim = new Sim(opts.state ?? "idle");
    sim.voiceAt = opts.voiceAt ?? null;
    sim.sparkleSide = opts.sparkles ?? "around";
    sim.still = opts.still ?? false;
    sim.soundRings = opts.rings ?? true;
    sim.glideMouth = opts.glideMouth ?? "closed";
    let parallel = live ? gl.getExtension("KHR_parallel_shader_compile") : null;
    let res = null;
    let building = null;
    let switching = null;
    let wanted = quality;
    function releaseResources(r) {
      for (const prg of r.programs.values()) gl.deleteProgram(prg.p);
      deletePostPrograms(gl, r.post);
      if (r.targets) deleteRenderTargets(gl, r.targets);
      gl.deleteVertexArray(r.vao);
    }
    function releaseAll() {
      if (res) releaseResources(res);
      if (building) dropBuild(gl, building);
      if (switching) dropBuild(gl, switching);
    }
    function startResources() {
      building = startBuild(gl, quality, true);
      if (!parallel) takeBuild();
    }
    function takeBuild() {
      const pending = building;
      building = null;
      const b = finishBuild(gl, pending);
      const vao = gl.createVertexArray();
      if (vao === null) {
        deleteBuilt(gl, b);
        throw new Error("Vertex array allocation failed");
      }
      const r = { vao, programs: /* @__PURE__ */ new Map([[b.quality, b.scene]]), post: b.post };
      res = { ...r, targets: null };
      needsDraw = true;
      resize(res);
      seekQuality(res);
    }
    function seekQuality(r) {
      if (wanted === quality || switching) return;
      if (r.programs.has(wanted)) {
        quality = wanted;
        invalidate();
        return;
      }
      switching = startBuild(gl, wanted, false);
      if (parallel) poller.ask();
      else takeSwitch(r);
    }
    function takeSwitch(r) {
      const b = switching;
      switching = null;
      try {
        r.programs.set(b.quality, finishBuild(gl, b).scene);
      } catch (err) {
        wanted = quality;
        throw err;
      }
      seekQuality(r);
    }
    let width = 0;
    let height = 0;
    let needsDraw = true;
    function resize(r) {
      const scale = QUALITY[quality].scale;
      let w;
      let h;
      if (size) {
        w = Math.round(size * scale);
        h = w;
      } else {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if ((cw <= 0 || ch <= 0) && r.targets) return;
        w = Math.max(16, Math.round(cw * pixelRatio * scale));
        h = Math.max(16, Math.round(ch * pixelRatio * scale));
      }
      if (w === width && h === height && r.targets) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      width = w;
      height = h;
      const old = r.targets;
      r.targets = null;
      if (old) deleteRenderTargets(gl, old);
      r.targets = createRenderTargets(gl, w, h);
      needsDraw = true;
    }
    function pass(prg, fb, w, h, set) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.useProgram(prg.p);
      set(prg.loc);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function bindTex(unit, t, loc) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(loc, unit);
    }
    function drawScene(prg, P, fb) {
      const { loc } = prg;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, width, height);
      gl.useProgram(prg.p);
      gl.uniform2f(loc.uRes, width, height);
      gl.uniform3fv(loc.uCamPos, cam.pos);
      gl.uniform3fv(loc.uCamR, cam.right);
      gl.uniform3fv(loc.uCamU, cam.up);
      gl.uniform3fv(loc.uCamF, cam.fw);
      gl.uniform1f(loc.uFocal, cam.focal);
      gl.uniform4fv(loc.uBound, P.bound);
      gl.uniform1f(loc.uTime, P.t);
      gl.uniform3fv(loc.uRoot, P.root);
      gl.uniform4fv(loc.uShape, P.shape);
      gl.uniform1f(loc.uLip, P.lip);
      gl.uniform4fv(loc.uLean, P.lean);
      gl.uniform4fv(loc.uFeet, P.feet);
      gl.uniform4fv(loc.uRipple, P.ripple);
      gl.uniform4fv(loc.uWave, P.wave);
      gl.uniform1f(loc.uNub, P.nub);
      gl.uniform3fv(loc.uEyeC, P.eyeC);
      gl.uniform3fv(loc.uEyeX, P.eyeX);
      gl.uniform3fv(loc.uEyeZ, P.eyeZ);
      gl.uniform2fv(loc.uEyeFrz, P.eyeFrz);
      gl.uniform4fv(loc.uEyeA, P.eyeA);
      gl.uniform4fv(loc.uEyeB, P.eyeB);
      gl.uniform4fv(loc.uMouth, P.mouth);
      gl.uniform4fv(loc.uColor, P.color);
      gl.uniform1fv(loc.uGradH, pal.h);
      gl.uniform3fv(loc.uGradC, pal.c);
      gl.uniform3fv(loc.uBead, pal.bead);
      gl.uniform4fv(loc.uCore, P.core);
      gl.uniform4fv(loc.uRing, P.ring);
      gl.uniform4fv(loc.uArcs, P.arcs);
      gl.uniform4fv(loc.uArcs2, P.arcs2);
      gl.uniform1i(loc.uDropN, Math.min(6, P.drops.length));
      if (P.drops.length) {
        gl.uniform4fv(loc.uDrops, flat(P.drops, Math.min(6, P.drops.length), 4));
      }
      gl.uniform1i(loc.uSparkN, Math.min(8, P.sparks.length));
      if (P.sparks.length) {
        gl.uniform4fv(
          loc.uSparks,
          flat(P.sparks, Math.min(8, P.sparks.length), 4)
        );
      }
      gl.uniform1i(loc.uDotN, Math.min(12, P.dots.length));
      if (P.dots.length) {
        gl.uniform4fv(loc.uDots, flat(P.dots, Math.min(12, P.dots.length), 4));
      }
      gl.uniform4fv(loc.uStops, P.stops);
      const gh = [...P.ghosts];
      while (gh.length < 3) gh.push([0, 0, 0, 0]);
      gl.uniform4fv(loc.uGhost, flat(gh, 3, 4));
      gl.uniform1f(loc.uGhostSq, P.shape[0]);
      gl.uniform1f(loc.uSpeed, P.speed);
      gl.uniform4fv(loc.uArrow, P.arrow);
      const vx = cam.pos[0] - P.root[0];
      const vz = cam.pos[2] - P.root[2];
      gl.uniform1f(
        loc.uCamAz,
        Math.atan2(
          P.shape[2] * vx - P.shape[3] * vz,
          P.shape[3] * vx + P.shape[2] * vz
        )
      );
      gl.uniform4fv(loc.uLookE, lookU.edge);
      gl.uniform4fv(loc.uLookE2, lookU.edge2);
      gl.uniform4fv(loc.uLookS1, lookU.crown);
      gl.uniform4fv(loc.uLookS2, lookU.shoulder);
      gl.uniform4fv(loc.uLookK, lookU.k);
      gl.uniform3fv(loc.uLookT, lookU.tint);
      gl.uniform3fv(loc.uLookT2, lookU.tint2);
      gl.uniform1i(loc.uDebug, 0);
      gl.uniform1i(loc.uZero, 0);
      gl.uniform3fv(loc.uLight, lightU);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function draw(r, T) {
      const prg = r.programs.get(quality);
      if (!prg) throw new Error(`Merc has no ${quality} program`);
      const P = sim.pose();
      gl.bindVertexArray(r.vao);
      const { post } = r;
      drawScene(prg, P, T.main);
      const ppu = 0.5 * T.h * cam.focal / view.dist;
      const bs = Math.min(2.5, Math.max(0.05, ppu / 455));
      pass(post.down, T.fa0, T.aw, T.ah, (l) => {
        bindTex(0, T.glow, l.uSrc);
        gl.uniform2f(l.uSrcTexel, 1 / T.w, 1 / T.h);
        gl.uniform2f(l.uDstRes, T.aw, T.ah);
      });
      pass(post.blur, T.fa1, T.aw, T.ah, (l) => {
        bindTex(0, T.a0, l.uSrc);
        gl.uniform2f(l.uDir, bs / T.aw, 0);
        gl.uniform2f(l.uDstRes, T.aw, T.ah);
      });
      pass(post.blur, T.fa0, T.aw, T.ah, (l) => {
        bindTex(0, T.a1, l.uSrc);
        gl.uniform2f(l.uDir, 0, bs / T.ah);
        gl.uniform2f(l.uDstRes, T.aw, T.ah);
      });
      pass(post.down, T.fb0, T.bw, T.bh, (l) => {
        bindTex(0, T.a0, l.uSrc);
        gl.uniform2f(l.uSrcTexel, 0.5 / T.aw, 0.5 / T.ah);
        gl.uniform2f(l.uDstRes, T.bw, T.bh);
      });
      for (const k of [1, 1.6]) {
        pass(post.blur, T.fb1, T.bw, T.bh, (l) => {
          bindTex(0, T.b0, l.uSrc);
          gl.uniform2f(l.uDir, k * bs / T.bw, 0);
          gl.uniform2f(l.uDstRes, T.bw, T.bh);
        });
        pass(post.blur, T.fb0, T.bw, T.bh, (l) => {
          bindTex(0, T.b1, l.uSrc);
          gl.uniform2f(l.uDir, 0, k * bs / T.bh);
          gl.uniform2f(l.uDstRes, T.bw, T.bh);
        });
      }
      const lift = 1 + 0.6 * P.color[2];
      pass(post.comp, null, width, height, (l) => {
        bindTex(0, T.scene, l.uScene);
        bindTex(1, T.a0, l.uA);
        bindTex(2, T.b0, l.uB);
        gl.uniform2f(l.uRes, width, height);
        gl.uniform3fv(l.uBg, bgLin);
        gl.uniform1f(l.uOpaque, transparent ? 0 : 1);
        gl.uniform4f(
          l.uBloomK,
          BLOOM.tight * lift,
          BLOOM.wide * lift,
          BLOOM.overBody,
          0
        );
        bindTex(3, T.glow, l.uCov);
        gl.uniform2f(
          l.uRim,
          Math.min(8, Math.max(0.9, RIM.width * ppu)),
          rimStrength
        );
        const yOf = (p) => {
          const d = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
          const z = d[0] * cam.fw[0] + d[1] * cam.fw[1] + d[2] * cam.fw[2];
          const y = (d[0] * cam.up[0] + d[1] * cam.up[1] + d[2] * cam.up[2]) * cam.focal / Math.max(z, 1e-3);
          return 0.5 * height * (1 + y);
        };
        const r0 = P.root;
        gl.uniform2f(
          l.uRimY,
          yOf([r0[0], r0[1] + SHAPE.flatY * P.shape[0], r0[2]]),
          yOf([r0[0], r0[1] + SHAPE.restH * P.shape[0], r0[2]])
        );
      });
    }
    let raf = 0;
    let last = 0;
    let acc = 0;
    let paused = false;
    let destroyed = false;
    let failed = null;
    const hidden = () => document.visibilityState === "hidden";
    function render() {
      const r = res;
      if (!r || gl.isContextLost()) return;
      try {
        resize(r);
        if (r.targets) draw(r, r.targets);
        needsDraw = false;
        announce();
      } catch (err) {
        if (!gl.isContextLost()) fail(err);
      }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      const dt = Math.min(0.1, (now - last) / 1e3);
      last = now;
      acc += dt;
      try {
        while (acc >= STEP) {
          sim.step(STEP);
          acc -= STEP;
        }
      } catch (err) {
        fail(err);
        return;
      }
      render();
    }
    function stopLoop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    function syncLoop() {
      if (!live || destroyed || failed) return;
      if (!paused && res && !hidden()) {
        if (!raf) {
          last = 0;
          raf = requestAnimationFrame(frame);
        }
        return;
      }
      stopLoop();
      if (needsDraw && !hidden()) render();
    }
    function fail(err) {
      if (failed || destroyed) return;
      failed = err instanceof Error ? err : new Error(String(err));
      stopLoop();
      poller.cancel();
      if (!gl.isContextLost()) releaseAll();
      res = null;
      building = null;
      switching = null;
      console.warn("[merc] stopped drawing:", failed.message);
      opts.onFailure?.(failed);
    }
    function onLost(e) {
      e.preventDefault();
      stopLoop();
      poller.cancel();
      res = null;
      building = null;
      switching = null;
      needsDraw = true;
    }
    function onRestored() {
      if (destroyed || failed) return;
      if (live) parallel = gl.getExtension("KHR_parallel_shader_compile");
      try {
        startResources();
      } catch (err) {
        if (!gl.isContextLost()) fail(err);
        return;
      }
      if (building) poller.ask();
      else syncLoop();
    }
    function onVisibility() {
      syncLoop();
    }
    const poller = createPoller(poll);
    let announced = false;
    function poll() {
      if (destroyed || failed || gl.isContextLost()) return;
      try {
        if (building) {
          if (!buildDone(gl, parallel, building)) {
            poller.ask();
            return;
          }
          takeBuild();
          if (!hidden()) render();
          syncLoop();
        }
      } catch (err) {
        if (!gl.isContextLost()) fail(err);
        return;
      }
      if (res) pollSwitch(res);
    }
    function pollSwitch(r) {
      if (!switching) return;
      if (!buildDone(gl, parallel, switching)) return poller.ask();
      try {
        takeSwitch(r);
      } catch (err) {
        if (!gl.isContextLost()) console.warn("[merc] quality not changed:", err);
      }
    }
    function announce() {
      if (announced || failed || destroyed) return;
      announced = true;
      opts.onReady?.();
    }
    try {
      startResources();
    } catch (err) {
      releaseAll();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
      throw err;
    }
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    if (live) document.addEventListener("visibilitychange", onVisibility);
    const ro = size ? null : new ResizeObserver(() => {
      if (!res || gl.isContextLost() || destroyed || failed) return;
      try {
        resize(res);
      } catch (err) {
        if (!gl.isContextLost()) fail(err);
        return;
      }
      syncLoop();
    });
    ro?.observe(container);
    syncLoop();
    if (parallel) poller.ask();
    function stepTo(t) {
      const target = Math.round(t / STEP);
      if (target < sim.n) sim.reset(sim.state);
      while (sim.n < target) sim.step(STEP);
    }
    let seg = continuous ? { n0: 0, snap: sim.snapshot() } : null;
    function stepSeg(s, t) {
      const target = s.n0 + Math.round(t / STEP);
      if (target < sim.n) sim.restore(s.snap);
      while (sim.n < target) sim.step(STEP);
    }
    function invalidate() {
      needsDraw = true;
      syncLoop();
    }
    return {
      canvas,
      get state() {
        return sim.state;
      },
      get time() {
        return sim.t;
      },
      get ok() {
        return failed === null && !destroyed;
      },
      get look() {
        return structuredClone(look);
      },
      setState(name) {
        if (!isMercState(name)) return;
        if (continuous) {
          sim.setState(name);
          sim.voiceT0 = sim.t;
          seg = { n0: sim.n, snap: sim.snapshot() };
        } else if (capture) sim.reset(name);
        else sim.setState(name);
      },
      reset(name) {
        if (!isMercState(name)) return;
        sim.reset(name);
        if (continuous) seg = { n0: 0, snap: sim.snapshot() };
      },
      setVoice(voice) {
        sim.voice = { ...voice };
      },
      setVoiceSource(source) {
        sim.voiceAt = source;
      },
      setPoseBias(bias) {
        Object.assign(sim.bias, bias);
      },
      setLook(patch) {
        look = {
          edge: patch.edge ?? look.edge,
          edge2: patch.edge2 ?? look.edge2,
          crown: patch.crown ?? look.crown,
          shoulder: patch.shoulder ?? look.shoulder,
          k: patch.k ?? look.k,
          tint: patch.tint ?? look.tint,
          tint2: patch.tint2 ?? look.tint2
        };
        lookU = lookUniforms(look);
        if (patch.stops || patch.bead) {
          palette = {
            stops: patch.stops ?? palette.stops,
            bead: patch.bead ?? palette.bead
          };
          pal = paletteUniforms(palette);
        }
        if (patch.rim !== void 0) rimStrength = patch.rim;
        if (patch.light) lightU = lightUniforms(patch.light);
        invalidate();
      },
      setQuality(name) {
        if (!isMercQuality(name)) return;
        wanted = name;
        if (res) seekQuality(res);
      },
      setView(v) {
        view = resolveView(v);
        cam = cameraFor(view);
        invalidate();
      },
      setPaused(p) {
        paused = p;
        syncLoop();
      },
      setStill(still) {
        sim.still = still;
      },
      renderAt(t) {
        if (seg) stepSeg(seg, t);
        else stepTo(t);
        const r = res;
        if (destroyed || failed || !r || gl.isContextLost()) {
          throw new Error("Merc cannot draw: the renderer has no GL context");
        }
        resize(r);
        if (r.targets) draw(r, r.targets);
        gl.finish();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        stopLoop();
        poller.cancel();
        ro?.disconnect();
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        document.removeEventListener("visibilitychange", onVisibility);
        if (!gl.isContextLost()) releaseAll();
        res = null;
        building = null;
        switching = null;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.width = 0;
        canvas.height = 0;
        canvas.remove();
      }
    };
  }

  // src/features/lessons/kit/merc-warm.ts
  var WARM_LIGHT = {
    pool: [0.55, 0.26, 0.05],
    wash: [0.45, 0.1, 0.08],
    footStreak: [0.62, 0.36, 0.08],
    ring: [1, 0.7, 0.32],
    stops: [1, 0.55, 0.3],
    eyeGlow: [0.022, 6e-3, 2e-3],
    eyeCrescent: [0.5, 0.28, 0.06],
    eyeEdge: [0.022, 0.01, 6e-3],
    drops: [0.95, 0.6, 0.18],
    key: [1, 0.62, 0.32],
    core: [0.36, 0.19, 0.02],
    nub: [0.62, 0.38, 0.12],
    glintSheen: [1, 0.84, 0.55],
    glint: [1, 0.7, 0.45],
    arcs: [1, 0.8, 0.6],
    dots: [1, 0.78, 0.55],
    speed: [1, 0.78, 0.58],
    trail: [1, 0.93, 0.8]
  };
  var WARM_LOOK = {
    stops: [
      [0, "#ffd84d"],
      [0.136, "#ffd84d"],
      [0.232, "#f6ad2a"],
      [0.328, "#f3901f"],
      [0.424, "#ff7448"],
      [0.52, "#f45f2e"],
      [0.616, "#ea4a2b"],
      [0.712, "#e0363e"],
      [0.808, "#d42a5c"],
      [0.904, "#e24c8c"],
      [1, "#ff86b8"]
    ],
    bead: ["#b8401a", "#ffb36b"],
    tint: "#fff3ea",
    tint2: "#ffcf8a",
    light: WARM_LIGHT
  };

  // src/lib/merc/merc-orange-entry.ts
  window.MercLib = { variant: "orange", mount, VIEWS, STATES, QUALITY, LOOK, PALETTE, LIGHT, BG, WARM: WARM_LOOK, WARM_LIGHT };
})();
