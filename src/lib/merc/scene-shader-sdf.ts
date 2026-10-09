// ============================================================
// Merc shader distance field — his body, feet, nub, eyes and droplets as SDFs
// ============================================================
//
// A slice of the scene shader's GLSL: everything from the first helper to
// the normals, which is the whole of Merc's shape. map() is the scene,
// calcNormal() and calcNormalBody() differentiate it, and toRest() undoes
// the pose so the body can be measured in rest space.
//
// Byte for byte the pass 4 study's text. fragSource() in scene-shader.ts
// joins the slices in order, and scene-shader.test.ts pins the hash of the
// result for every quality. Edit a slice and that hash changes.

export const SDF_GLSL = `
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
`
