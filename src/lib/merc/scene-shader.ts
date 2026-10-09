// ============================================================
// Merc scene shader — the raymarched character as one WebGL2 fragment shader
// ============================================================
//
// One fragment shader draws the whole character from signed distance
// functions: a pear body (ellipsoid smooth-unioned with a round cone), two
// glossy bead feet, a pointing nub, two glossy eye domes, splash droplets.
//
// The resin is authored, not mirrored. The body is the palette gradient
// (violet crown, indigo and azure middle, teal base) with light that gathers
// along the inside of the outline and a hot core deep inside, seen through the
// real 3D volume. On top sit the highlights the concept art draws. Nothing
// reflects an environment, and the floor has no mirror image: a soft contact
// shadow and a faint glow pool.
//
// The GLSL is the owner-approved pass 4 study text, byte for byte
// (scene-shader.test.ts pins its hash). Only the quality defines and the
// shape constants are interpolated, exactly as the study interpolated them.
// Change the text and Merc changes; do that on purpose or not at all.
//
// The text is split across four files at blank lines between sections: the
// header and the uniforms here, the distance field in scene-shader-sdf.ts,
// the floor, face and materials in scene-shader-surface.ts, and the
// effects and the frame in scene-shader-frame.ts. Every slice starts and
// ends on a line break, so fragSource() joins them back with the study's
// blank lines where they were.

import type { MercQualitySpec } from './constants'
import { GRAD_N, SHAPE } from './constants'
import { EFFECTS_GLSL, FRAME_GLSL } from './scene-shader-frame'
import { SDF_GLSL } from './scene-shader-sdf'
import { FACE_GLSL, FLOOR_GLSL, MATERIALS_GLSL } from './scene-shader-surface'

export const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// GLSL float literals: always five decimals, as the study wrote them, so the
// shader text (and every constant baked into it) stays byte-identical.
const f = (x: number): string => {
  const s = Number(x).toFixed(5)
  return s.includes('.') ? s : `${s}.0`
}
const v3 = (a: readonly number[]): string =>
  `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`

export function fragSource(q: MercQualitySpec): string {
  const S = SHAPE
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
#define FOOT_TOE vec2(${f(Math.sin((S.footToe * Math.PI) / 180))}, ${f(Math.cos((S.footToe * Math.PI) / 180))})
#define FOOT_C ${v3(S.footC)}
#define FOOT_R ${v3(S.footR)}
#define FOOT_K ${f(S.footK)}
#define NUB_A ${v3(S.nub)}
#define EYE_R ${v3(S.eyeR)}
#define EYE_VIS ${f(Math.sqrt(1 - (S.eyeEmbed / S.eyeR[2]) ** 2))}
#define EYE_EGG ${f(S.eyeEgg)}
#define MOUTH_Y ${f(S.mouthY)}
#define GRAD_N ${GRAD_N}
`
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
uniform vec4 uMouth;   // smile, O, grin
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

const float PI = 3.14159265;
// Light directions (world space, fixed): the form light, the soft crown
// highlight and the sharp catchlight all come from the upper left.
const vec3 SPEC_DIR = vec3(-0.42, 0.74, 0.53);

vec3 gDbg = vec3(0.0);
float gCov = 0.0; // this sample's object coverage for the rim: body, eyes and droplets 1, feet 0.75
float gFoot = 0.0; // the last shaded body point's foot weight
${SDF_GLSL}${FLOOR_GLSL}${FACE_GLSL}${MATERIALS_GLSL}${EFFECTS_GLSL}${FRAME_GLSL}`
}
