// ============================================================
// Merc shader frame — the effects, the tonemap and the per-pixel main
// ============================================================
//
// The last two slices of the scene shader's GLSL: the effects drawn around
// him (sound arcs, sparks, hop dots, the ghost trail, the climb arrow) with
// the tonemap, then renderSample(), which marches one sample, and main(),
// which averages SPP of them and writes the colour and the glow targets.
//
// Byte for byte the pass 4 study's text. fragSource() in scene-shader.ts
// joins the slices in order, and scene-shader.test.ts pins the hash of the
// result for every quality. Edit a slice and that hash changes.

// sdSil2(), effects(), tonemap(): what is drawn around him, and the tone curve.
export const EFFECTS_GLSL = `
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
          acc += vec3(0.62, 0.78, 1.0) * uArcs.z * am * fade * (exp(-dr * dr / 0.00006) * 1.1 + exp(-dr * dr / 0.0015) * 0.1);
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
    acc += vec3(0.55, 0.75, 1.0) * dd.w * (exp(-r2 / 0.00009) * 1.1 + exp(-r2 / 0.0016) * 0.12);
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
        acc += vec3(0.6, 0.75, 1.0) * exp(-gx * gx) * along * uSpeed * 0.9;
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
    acc += (mix(gc, vec3(0.8, 0.95, 1.0), 0.45) * line * 0.95 + gc * fill) * gh.w * low;
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
      acc += vec3(0.62, 0.78, 1.0) * exp(-dr * dr) * on * uArrow.z * 0.9;
      vec2 tip = c + 0.42 * vec2(cos(2.05), sin(2.05));
      vec2 tl = X - tip;
      vec2 dir = normalize(vec2(sin(2.05), -cos(2.05)));
      vec2 nrm = vec2(-dir.y, dir.x);
      for (int s = -1; s <= 1; s += 2) {
        vec2 hd = normalize(-dir + nrm * 0.75 * float(s));
        float tt = clamp(dot(tl, hd), 0.0, 0.07);
        float dd = length(tl - hd * tt) / 0.006;
        acc += vec3(0.62, 0.78, 1.0) * exp(-dd * dd) * uArrow.z * 0.9;
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
`

// renderSample(), main(): march one sample; average SPP of them per pixel.
export const FRAME_GLSL = `
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
    for (int i = 0; i < MAX_STEPS; i++) {
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
  for (int i = 0; i < 4; i++) { acc += renderSample(gl_FragCoord.xy + o4[i], dbg, g); gacc += g; cacc += gCov; }
  acc *= 0.25;
  gacc *= 0.25;
  cacc *= 0.25;
#else
  for (int i = 0; i < SPP; i++) {
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
`
