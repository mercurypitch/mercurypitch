/* ==========================================================================================
   STRINGS AND WAVES: two motifs from the stats site, both already pure functions of time, so they
   drop straight into a seekable HyperFrames timeline (call with the timeline's time, never with
   performance.now()).

   1. The programme string (picker, bundle names Ot/Bt/at): a 1000 x 24 SVG line under each
      project name that is plucked on hover. The shape is the fundamental plus a quieter second
      harmonic, both decaying with exp(-3.2 t), for 1.5 s:
        y(l, t) = 12 + A e^(-3.2 t) [ sin(pi l) cos(2 pi 7.5 t) + 0.35 sin(2 pi l) cos(2 pi 15 t + 0.6) ]
      which is a textbook standing wave: mode 1 and mode 2 of a string pinned at both ends.
   2. The living staff (report hero, canvas#strings): five staff lines behind the wordmark that
      vibrate with an envelope taken from weekly commit volume, pinned at both ends by sin(pi x).
   ========================================================================================== */

/* ---------------------------------------------------------------- 1. the plucked string */
export const STRING = {
  width: 1000,
  mid: 12,
  points: 48,
  amp: 9,
  seconds: 1.5,
  decay: 3.2,
  f1: 7.5,
  f2: 15,
  mix2: 0.35,
  phase2: 0.6,
}
export const restPath = (o = STRING) => `M0 ${o.mid} L${o.width} ${o.mid}`
// the picker's exact path at t seconds after the pluck
export function pluckPath(t, o = STRING) {
  if (t >= o.seconds || t < 0) return restPath(o)
  const env = Math.exp(-t * o.decay),
    a = Math.cos(t * 2 * Math.PI * o.f1),
    b = Math.cos(t * 2 * Math.PI * o.f2 + o.phase2) * o.mix2
  let d = `M0 ${o.mid}`
  for (let i = 1; i <= o.points; i++) {
    const l = i / o.points,
      y =
        o.mid +
        o.amp *
          env *
          (Math.sin(Math.PI * l) * a + Math.sin(2 * Math.PI * l) * b)
    d += ` L${(l * o.width).toFixed(1)} ${y.toFixed(2)}`
  }
  return d
}
// For lessons: any mix of harmonics on a string pinned at both ends. harmonics: [{ n, amp, phase }]
// with frequency n * f1 (the real physics: mode n vibrates n times as fast and has n - 1 nodes).
export function standingWavePath(
  t,
  {
    width = 1000,
    mid = 12,
    points = 96,
    f1 = 1,
    decay = 0,
    harmonics = [{ n: 1, amp: 9 }],
  } = {},
) {
  const env = decay ? Math.exp(-t * decay) : 1
  let d = `M0 ${mid}`
  for (let i = 1; i <= points; i++) {
    const l = i / points
    let y = 0
    for (const h of harmonics)
      y +=
        (h.amp || 0) *
        Math.sin(h.n * Math.PI * l) *
        Math.cos(2 * Math.PI * h.n * f1 * t + (h.phase || 0))
    d += ` L${(l * width).toFixed(1)} ${(mid + env * y).toFixed(2)}`
  }
  return d
}
// the nodes of mode n, as fractions of the string's length (where Merc could stand still)
export const nodesOf = (n) => Array.from({ length: n + 1 }, (_, k) => k / n)

// SVG and CSS that go with the string (picker.css):
//   <svg class="string" viewBox="0 0 1000 24" preserveAspectRatio="none"><path d="M0 12 L1000 12"/></svg>
//   .string path { fill: none; stroke: rgba(238,242,246,.14); stroke-width: 1; vector-effect: non-scaling-stroke; transition: stroke .4s ease }
//   .piece[data-selected] .string path { stroke: color-mix(in oklab, var(--accent) 85%, white) }
// vector-effect: non-scaling-stroke keeps the line a hairline although the viewBox is stretched.

/* ---------------------------------------------------------------- 2. the living staff */
// envelope(x) in 0..1 across the width: here the weekly commit counts, cosine-interpolated
export const envelopeFrom = (values) => {
  const mx = Math.max(1, ...values)
  return (x) => {
    const p = x * (values.length - 1),
      i = Math.floor(p),
      f = p - i,
      a = values[i] || 0,
      b = values[Math.min(values.length - 1, i + 1)] || 0
    return (a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * f))) / mx
  }
}
// Five lines; line k has width 1 + .36k, spatial frequency 1.5 + .5k, phase 1.7k. t in ms like the hero.
export function drawLivingStaff(
  ctx,
  {
    t,
    width: W,
    height: H,
    top,
    spacing,
    envelope,
    colors = ['#58a6ff', '#2dd4bf', '#bc8cff'],
  },
) {
  ctx.clearRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, W, 0)
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c))
  for (let k = 0; k < 5; k++) {
    const s = { w: 1 + k * 0.36, f: 1.5 + k * 0.5, ph: k * 1.7 },
      y0 = top + k * spacing
    ctx.beginPath()
    for (let px = 0; px <= W; px += 3) {
      const x = px / W,
        pin = Math.sin(Math.PI * x),
        a = spacing * (0.1 + 0.62 * envelope(x)) * pin
      const y =
        y0 +
        a *
          Math.sin(2 * Math.PI * s.f * x + t * 0.0011 * (1 + k * 0.17) + s.ph) *
          (0.55 + 0.45 * Math.sin(t * 0.0006 + k * 1.3))
      if (px) ctx.lineTo(px, y)
      else ctx.moveTo(px, y)
    }
    // two passes: a wide 8% glow, then the 55% line itself
    ctx.strokeStyle = g
    ctx.globalAlpha = 0.08
    ctx.lineWidth = s.w * 6
    ctx.stroke()
    ctx.globalAlpha = 0.55
    ctx.lineWidth = s.w
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
// CSS for the hero canvas: masked at both ends so the staff fades into the page.
//   .hero canvas { position: absolute; inset: 0 0 auto 0; height: 520px; width: 100%; pointer-events: none;
//     mask-image: linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%) }
// The staff is fitted to the wordmark: top = 20% and bottom = 86% of the h1's height, spacing = (b - t) / 4.

/* ---------------------------------------------------------------- 3. the waveform bars */
// figWaveform / the share card: one rounded bar per sample, mirrored below the axis at 30-35%.
export function waveformRects(
  values,
  { x0, x1, mid, up = 138, down = 54, minH = 1.6 },
) {
  const n = values.length,
    bw = (x1 - x0) / n,
    mx = Math.max(1, ...values),
    out = []
  values.forEach((v, i) => {
    if (!v) return
    const hh = Math.max(minH, (v / mx) * up),
      x = x0 + i * bw + bw * 0.14,
      w = Math.max(0.8, bw * 0.72),
      rx = Math.min(1.6, w / 2)
    out.push(
      { x, y: mid - hh, width: w, height: hh, rx },
      {
        x,
        y: mid + 3,
        width: w,
        height: Math.max(1, (v / mx) * down),
        rx,
        mirror: true,
      },
    )
  })
  return out // fill the bars with a userSpaceOnUse linear gradient blue -> aqua -> violet across x0..x1
}
