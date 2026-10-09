// ============================================================
// Merc post shaders — bloom chain and the composite that draws the rim
// ============================================================
//
// Glow textures hold sqrt-encoded colour in RGBA8, so the faint tail of the
// glow does not band. The composite adds the bloom, draws the rim from the
// coverage in the glow target's alpha, lays the background under an opaque
// stage (or leaves premultiplied alpha for a transparent one) and dithers.
// The GLSL is the approved pass 4 study text, byte for byte.

export const POST_DOWN = `#version 300 es
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
}`

export const POST_BLUR = `#version 300 es
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
}`

export const POST_COMPOSITE = `#version 300 es
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
}`
