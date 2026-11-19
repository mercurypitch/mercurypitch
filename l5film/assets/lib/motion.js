/* Find Your Pitch, Lesson 5 kit: progress, tracks, counted pulses, lights and echo rings. window.L,
   after lesson.js. Lesson 4's calls, rebuilt; every one is a pure function of the time it is given.

     L.prog(t, t0, dur, ease = 'power2.inOut')   0 before t0, 1 after t0 + dur, eased between
     L.track(t, v0, moves)     a value from v0 through moves [{ at, dur, to, ease }] in time order; v0
                               and `to` may be numbers, arrays or objects of numbers (each eased alike)
     L.env(t, t0, up, hold, down, ease = 'sine.inOut')   0..1: up over `up`, held `hold`, down over `down`
     L.PULSE                   the counted pulses' amplitudes (STORYBOARD § Type, Counted pulses):
                               label 0.2 (48 px or more, about its LEFT BASELINE), bead 0.2, chip and pill
                               0.08, tile and key 0.05, bar 0.15
     L.pulse(t, times, kind, { long = false })   the scale, 1 + amp * env: up over 0.15 s, back over
                               0.6 s (long: 0.2 and 0.8); the highest of its times
     L.lit(t, times, { long = false })   0..1, a counted light: up 0.15 s, held 0.1, back 0.45 s (long:
                               0.2, 0.3, 0.8); multiply into a fill's alpha (a strip lit to 40 % violet)
     L.light(t, times, up = 0.3, down = 0.4)   0..1, linear up and back (Lesson 4's 40 % chrome light,
                               which measure.py registers 0.7 s)
     L.glow(t, times, { up = 0.25, hold = 0.2, down = 0.5 })   0..1, an accent (never counted as motion)
     L.run(t, t0, dur = 0.6)   0..1 position of a light running along a path (a bright band 0.18 wide),
                               null outside its run: { u, a }
     L.swap(t, t0, k, from, to)   § Type's label switch: the old label slides up 12 px as it fades, the new
                               one comes in from 12 px below, over 0.25 s, staggered 0.05 s for k > 0.
                               Returns [{ text, a, dy }, { text, a, dy }]
     L.fade(t, tIn, tOut, { dIn = 0.2, dOut = 0.2, rise = 0, up = 0, upFast = false })
                               a label's life: { a, dy }. In over dIn from tIn (rising `rise` px into
                               place), out over dOut from tOut; upFast: STORYBOARD's "up fast" (0.3 s,
                               power3.in, rising 16 px). tOut may be null (stays)
     L.steady(dur, ramp = 0.3)   an ease for a long slow move that never stands still: linear between two
                       smoothstep ramps of ramp seconds (the push to F-gauge: cam.to(at, 10, 'F-gauge', L.steady(10)))
     L.echoRings(parent, { dur = 0.5, grow = 3, width = 2, color = chrome, max = 4, a0 = 0.8 })
                               -> { g, draw(t, rings) }, rings [{ t, x, y, r }]: a 2 px ring grows from
                               the bead's edge to `grow` times its radius as it fades over `dur`
*/
;(function () {
  const L = window.L
  const clamp = L.clamp

  L.prog = (t, t0, dur, ease = 'power2.inOut') => {
    if (dur <= 0) return t >= t0 ? 1 : 0
    return L.ease(ease)(clamp((t - t0) / dur))
  }

  const blend = (a, b, u) => {
    if (typeof a === 'number') return a + (b - a) * u
    if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], u))
    const o = {}
    for (const k of Object.keys(a)) o[k] = k in b ? blend(a[k], b[k], u) : a[k]
    return o
  }
  L.track = (t, v0, moves = []) => {
    let v = v0
    for (const m of moves) {
      if (t <= m.at) break
      v = blend(v, m.to, L.prog(t, m.at, m.dur, m.ease || 'power2.inOut'))
    }
    return v
  }

  L.env = (t, t0, up, hold = 0, down = up, ease = 'sine.inOut') => {
    if (t <= t0) return 0
    const e = L.ease(ease)
    if (t < t0 + up) return e((t - t0) / up)
    if (t <= t0 + up + hold) return 1
    if (t < t0 + up + hold + down) return 1 - e((t - t0 - up - hold) / down)
    return 0
  }

  L.PULSE = { label: 0.2, bead: 0.2, chip: 0.08, pill: 0.08, tile: 0.05, key: 0.05, bar: 0.15, ring: 0.05 }
  L.pulse = (t, times, kind = 'label', { long = false, amp = null } = {}) => {
    const A = amp ?? L.PULSE[kind] ?? 0.1
    const up = long ? 0.2 : 0.15, down = long ? 0.8 : 0.6
    let k = 0
    for (const t0 of [].concat(times)) if (t0 != null) k = Math.max(k, L.env(t, t0, up, 0, down))
    return 1 + A * k
  }
  L.lit = (t, times, { long = false } = {}) => {
    let k = 0
    for (const t0 of [].concat(times)) if (t0 != null) k = Math.max(k, long ? L.env(t, t0, 0.2, 0.3, 0.8) : L.env(t, t0, 0.15, 0.1, 0.45))
    return k
  }
  L.light = (t, times, up = 0.3, down = 0.4) => {
    let k = 0
    for (const t0 of [].concat(times)) if (t0 != null) k = Math.max(k, L.prog(t, t0, up, 'none') * (1 - L.prog(t, t0 + up, down, 'none')))
    return k
  }
  L.glow = (t, times, { up = 0.25, hold = 0.2, down = 0.5 } = {}) => {
    let k = 0
    for (const t0 of [].concat(times)) if (t0 != null) k = Math.max(k, L.env(t, t0, up, hold, down))
    return k
  }
  L.run = (t, t0, dur = 0.6) => {
    if (t < t0 || t > t0 + dur + 0.2) return null
    const u = L.prog(t, t0, dur, 'sine.inOut')
    return { u, a: L.env(t, t0, 0.1, dur - 0.1, 0.2) }
  }

  L.swap = (t, t0, k, from, to) => {
    const u = L.prog(t, t0 + 0.05 * k, 0.25, 'power2.inOut')
    return [{ text: from, a: 1 - u, dy: -12 * u }, { text: to, a: u, dy: 12 * (1 - u) }]
  }

  L.fade = (t, tIn, tOut, { dIn = 0.2, dOut = 0.2, rise = 0, up = 0, upFast = false, easeIn = 'power2.out', easeOut = 'power2.in' } = {}) => {
    const aIn = tIn == null ? 1 : L.prog(t, tIn, dIn, easeIn)
    let aOut = 0, dy = 0
    if (tOut != null) {
      const d = upFast ? 0.3 : dOut
      aOut = L.prog(t, tOut, d, upFast ? 'power3.in' : easeOut)
      dy -= (upFast ? 16 : up) * aOut
    }
    if (rise && tIn != null) dy += rise * (1 - L.prog(t, tIn, Math.max(dIn, 0.4), 'power2.out'))
    return { a: aIn * (1 - aOut), dy }
  }

  // A long, slow move that never stands still (the 10 s push to F-gauge, critic-kit-01 item 7): linear between
  // two ramps of `ramp` seconds whose speed eases in and out by smoothstep, so after `ramp` / 2 the move is
  // already at more than half its speed. Use it as an ease: cam.to(at, 10, 'F-gauge', L.steady(10)).
  L.steady = (dur, ramp = 0.3) => {
    const r = Math.min(0.45, ramp / dur), vmax = 1 / (1 - r)
    const S = (x) => x * x * x - 0.5 * x * x * x * x        // the integral of smoothstep from 0 to x
    return (u) => {
      u = L.clamp(u)
      if (u < r) return vmax * r * S(u / r)
      if (u > 1 - r) return 1 - vmax * r * S((1 - u) / r)
      return vmax * (r / 2 + (u - r))
    }
  }
  L.echoRings = (parent, { dur = 0.5, grow = 3, width = 2, color = L.C.chrome, max = 4, a0 = 0.8 } = {}) => {
    const g = L.svg('g', { class: 'echo' }, parent)
    const pool = []
    for (let i = 0; i < max; i++) pool.push(L.svg('circle', { fill: 'none', stroke: color, 'stroke-width': width, opacity: 0 }, g))
    return {
      g,
      draw(t, rings = []) {
        let n = 0
        for (const r of rings) {
          const tau = t - r.t
          if (tau < 0 || tau > dur || n >= max) continue
          const u = tau / dur
          const el = pool[n++]
          el.setAttribute('cx', L.f2(r.x))
          el.setAttribute('cy', L.f2(r.y))
          el.setAttribute('r', L.f2(r.r * (1 + (grow - 1) * L.ease('power2.out')(u))))
          el.setAttribute('opacity', (a0 * Math.pow(1 - u, 1.4)).toFixed(3))
        }
        for (; n < max; n++) pool[n].setAttribute('opacity', '0')
      },
    }
  }
})()
