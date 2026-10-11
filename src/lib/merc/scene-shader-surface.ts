// ============================================================
// Merc shader surfaces — the floor, the face and the resin materials
// ============================================================
//
// Three slices of the scene shader's GLSL, each starting at one of the
// study's section markers: the floor (glow pool, landing rings, contact
// shadow), the face (the mouth and the closed-eye strokes, inked onto the
// resin), and the materials (the glossy eye domes and the resin body).
//
// Byte for byte the pass 4 study's text. fragSource() in scene-shader.ts
// joins the slices in order, and scene-shader.test.ts pins the hash of the
// result for every quality. Edit a slice and that hash changes.

// floorLight(), floorShade(): the glow pool, the landing rings, the contact shadow.
export const FLOOR_GLSL = `
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
  vec3 pool = vec3(0.03, 0.42, 0.52) * 0.5 * k * exp(-r2 * 9.0 * k) * under + vec3(0.03, 0.12, 0.5) * 0.06 * k * exp(-r2 * 3.4);
  vec3 c = pool * uColor.y * (1.0 + uColor.z * 0.7);
  // Under each foot, a short cyan streak on the floor, as painted.
  vec2 fl = mat2(uShape.z, uShape.w, -uShape.w, uShape.z) * rel;
  fl.x = abs(fl.x);
  vec2 fs = (fl - vec2(FOOT_C.x * inversesqrt(uShape.x), FOOT_C.z + 0.55 * FOOT_R.z)) / vec2(0.1, 0.03);
  c += vec3(0.08, 0.5, 0.62) * 0.2 * k * exp(-dot(fs, fs)) * uColor.y;
  float r = length(rel);
  if (uRing.y > 0.001) { float g = (r - uRing.x) / 0.022; c += vec3(0.3, 0.85, 1.0) * 1.1 * uRing.y * exp(-g * g); }
  if (uRing.w > 0.001) { float g = (r - uRing.z) / 0.022; c += vec3(0.3, 0.85, 1.0) * 1.1 * uRing.w * exp(-g * g); }
  if (uStops.w > 0.001) {
    for (int i = 0; i < 3; i++) {
      float sx = i == 0 ? uStops.x : (i == 1 ? uStops.y : uStops.z);
      float d = length(P.xz - vec2(sx, 0.0));
      float g = (d - 0.15) / 0.01;
      c += vec3(0.3, 0.55, 1.0) * uStops.w * (exp(-g * g) * 0.9 + smoothstep(0.16, 0.0, d) * 0.12);
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
`

// applyFace(): the mouth and the closed-eye strokes, in rest space.
export const FACE_GLSL = `
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
  float sm = uMouth.x * (1.0 - oo) * (1.0 - uMouth.z);
  if (sm > 0.01) {
    float ra = mix(0.26, 0.06, clamp(uMouth.x, 0.0, 1.0));
    float hc = mix(0.0512, 0.55 * (0.034 + 0.024 * uMouth.y), smoothstep(0.0, 0.06, uMouth.y));
    float ap = asin(clamp(hc / ra, 0.0, 1.0));
    vec2 p = f - vec2(0.0, MOUTH_Y + ra);
    p.y = -p.y;
    float d = sdArcStroke(p, ap, ra, 0.0135 * sw);
    cov = max(cov, smoothstep(aa, -aa, d) * clamp(sm * 1.5, 0.0, 1.0));
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
`

// shadeEye(), shadeBody(): the eye domes and the resin.
export const MATERIALS_GLSL = `
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
  c += vec3(0.001, 0.006, 0.022) * low * 0.4;
  float rr = length(uv);
  // A thin light crescent just inside the lower edge, fading a third of the
  // way up the sides (painted #122938).
  c += vec3(0.04, 0.5, 0.46) * 0.075 * smoothstep(EYE_VIS - 0.11, EYE_VIS - 0.02, rr) * smoothstep(-0.2, -0.75, uv.y / max(rr, 1e-3));
  // The painted eye is a touch lighter just inside its edge than at its core,
  // which rounds it like a glass bead.
  c += vec3(0.006, 0.008, 0.022) * smoothstep(0.45 * EYE_VIS, 0.92 * EYE_VIS, rr);
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
    base = mix(base, vec3(0.12, 0.72, 0.78) * uColor.y, dr);
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
  col = mix(col, vec3(0.22, 0.55, 1.0) * uColor.y, uLookK.w * key * fr);
  // The hot core: a glow deep in the lower body, seen through the volume, so it
  // shifts against the surface as he turns.
  vec3 oc = uCore.xyz - uCamPos;
  float tc = dot(oc, rd);
  float d2 = max(dot(oc, oc) - tc * tc, 0.0);
  float core = exp(-d2 / (uCore.w * uCore.w));
  col += vec3(0.02, 0.34, 0.28) * core * (0.62 + 1.0 * uColor.z) * uColor.y;
  if (uNub > 0.01) {
    vec3 bc = NUB_A + normalize(vec3(1.0, 0.3, 0.12)) * (0.03 + 0.34 * uNub);
    vec3 db = q - bc;
    col += vec3(0.12, 0.5, 0.62) * uNub * exp(-dot(db, db) * 45.0) * 0.8;
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
    col += vec3(0.45, 0.85, 1.0) * smoothstep(0.72, 0.95, g) * foot * 0.12;
    col = mix(col, vec3(0.37, 0.65, 0.97), smoothstep(0.95, 0.985, g) * foot * 0.85);
  }
  // Debug view 3: feet (r), body height (g, from 0.25), azimuth offset (b).
  col *= 1.0 - 0.6 * crease;
  glow *= 1.0 - 0.6 * crease;
  if (uDebug == 3) gDbg = vec3(foot, 0.25 + 0.75 * h0, s);
  gFoot = foot;
  return applyFace(col, q, t * pixA);
}
`
