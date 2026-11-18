/* Find Your Pitch, Lesson 4 kit: the camera as framings. window.L, after motion.js.

   HANDOFFS § Shared formulas, § Framings and § Camera moves. A framing is (s, ox, oy)
   for the mid layer: x' = s x + ox, y' = s y + oy, from world coordinates (F0's pixels)
   to the screen. Layer k (far 0.25, mid 1, near 1.6) draws at scale 1 + k (s - 1) with
   offset (k (ox - px) + px, k (oy - py) + py), where (px, py) is the part of the offset a
   pan put there: a push, pull, truck or crane moves the layers apart, a pan moves them
   all by the same amount. A move to a named framing eases px and py back to 0 with the
   rest, so every layer lands on that framing exactly.

     L.FRAMES                                   the named framings, { s, ox, oy }
     const cam = L.frameRig(room, { from: 'F0' })
     cam.to(at, dur, 'CU-A' | { s, ox, oy }, ease)   s, ox and oy (and the pan part) on one curve
     cam.pan(at, dur, { x, y }, ease)                 every layer by the same amount
     cam.hermite(at, dur, to)                         from the moves so far, at their rates, to rest
                                                      at `to` (the S9 push's second leg)
     cam.curve(at, dur, fn)                           fn(u) -> { s, ox, oy } for u in 0..1
     cam.state(t)  cam.matrix(t, layer)  cam.map(x, y, t, layer)  cam.inv(X, Y, t, layer)
     cam.scale(t, layer)  cam.apply(t)  cam.drive(tl, D)

   Times are scene times. Add moves in time order. A move that spans a cut is written the
   same way in both scenes, from the same cue, so both evaluate one curve.
*/
;(function () {
  const L = window.L
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))

  L.FRAMES = {
    'F-cold': { s: 1.2, ox: 98.4, oy: -97.2 },
    'F-cold end': { s: 1.22, ox: 84.04, oy: -106.92 },
    'F-house': { s: 2.2, ox: -1543.6, oy: -32 },
    F0: { s: 1, ox: 0, oy: 0 },
    'CU-A': { s: 2, ox: -280, oy: -880 },
    'CU-B': { s: 2, ox: -760, oy: -880 },
    'F-low': { s: 1.8, ox: 99.6, oy: -704 },
    'F-high': { s: 1.8, ox: -764.4, oy: -450 },
    'F-white': { s: 1.25, ox: -75, oy: -211.5 },
    'CU-D': { s: 2, ox: -836, oy: -464 },
    'F-keys-D': { s: 1.6, ox: -380.8, oy: -528 },
    'F-near': { s: 1.2, ox: -84, oy: -147.2 },
    'F-names-1': { s: 2.4, ox: -235, oy: -1232 },
    'F-names-2': { s: 2.4, ox: -1431, oy: -1232 },
    'CU-C': { s: 1.8, ox: -980, oy: -432 },
    'F-chart': { s: 1.45, ox: -432, oy: -47 },
    'F-recap-1': { s: 1.25, ox: -75, oy: -75 },
    'F-recap-3': { s: 1.4, ox: -120, oy: -160 },
  }
  const frameOf = (f) => {
    const v = typeof f === 'string' ? L.FRAMES[f] : f
    if (!v) throw new Error('no framing ' + f)
    return { s: v.s, ox: v.ox, oy: v.oy, px: v.px || 0, py: v.py || 0 }
  }
  L.frameOf = frameOf

  // Hermite basis on u in 0..1, ending at rest (no h11 term)
  const h00 = (u) => 2 * u * u * u - 3 * u * u + 1
  const h10 = (u) => u * u * u - 2 * u * u + u
  const h01 = (u) => 3 * u * u - 2 * u * u * u

  L.frameRig = (room, { from = 'F0', far = 0.25, near = 1.6 } = {}) => {
    const K = { far, mid: 1, near }
    const v0 = frameOf(from)
    const moves = []
    for (const name of ['far', 'under', 'mid', 'near']) {
      if (room && room[name]) {
        room[name].style.transformOrigin = '0 0'
        room[name].setAttribute('data-layout-allow-overflow', '')
      }
    }
    const cam = {
      moves,
      to(at, dur, to, ease = 'power2.inOut') {
        moves.push({ kind: 'to', at, dur, to: frameOf(to), ease })
        return cam
      },
      pan(at, dur, { x = 0, y = 0 } = {}, ease = 'sine.inOut') {
        moves.push({ kind: 'pan', at, dur, dx: x, dy: y, ease })
        return cam
      },
      curve(at, dur, fn) {
        moves.push({ kind: 'curve', at, dur, fn })
        return cam
      },
      // A leg that starts where and as fast as the moves so far leave the camera at `at`, and
      // comes to rest on `to` at at + dur: s, ox and oy each a cubic Hermite in u.
      hermite(at, dur, to) {
        const T = frameOf(to)
        const eps = 1e-3
        const a = cam.state(at), b = cam.state(at - eps)
        const P = { s: a.s, ox: a.ox, oy: a.oy }
        const R = { s: (a.s - b.s) / eps * dur, ox: (a.ox - b.ox) / eps * dur, oy: (a.oy - b.oy) / eps * dur }
        const fn = (u) => ({
          s: P.s * h00(u) + R.s * h10(u) + T.s * h01(u),
          ox: P.ox * h00(u) + R.ox * h10(u) + T.ox * h01(u),
          oy: P.oy * h00(u) + R.oy * h10(u) + T.oy * h01(u),
          px: a.px * (1 - h01(u)), py: a.py * (1 - h01(u)),
        })
        moves.push({ kind: 'curve', at, dur, fn, rates: R })
        return cam
      },
      state(t) {
        let { s, ox, oy, px, py } = v0
        for (const m of moves) {
          if (t <= m.at) continue
          if (m.kind === 'curve') {
            const v = m.fn(clamp((t - m.at) / m.dur))
            s = v.s; ox = v.ox; oy = v.oy; px = v.px || 0; py = v.py || 0
            continue
          }
          const u = L.prog(t, m.at, m.dur, m.ease)
          if (m.kind === 'to') {
            s += (m.to.s - s) * u; ox += (m.to.ox - ox) * u; oy += (m.to.oy - oy) * u
            px += (m.to.px - px) * u; py += (m.to.py - py) * u
          } else {
            ox += m.dx * u; oy += m.dy * u; px += m.dx * u; py += m.dy * u
          }
        }
        return { s, ox, oy, px, py }
      },
      matrix(t, layer = 'mid', st = cam.state(t)) {
        const k = K[layer] ?? 1
        const a = 1 + (st.s - 1) * k
        return { a, e: k * (st.ox - st.px) + st.px, f: k * (st.oy - st.py) + st.py }
      },
      map(x, y, t, layer = 'mid') {
        const m = cam.matrix(t, layer)
        return [m.a * x + m.e, m.a * y + m.f]
      },
      inv(X, Y, t, layer = 'mid') {
        const m = cam.matrix(t, layer)
        return [(X - m.e) / m.a, (Y - m.f) / m.a]
      },
      scale(t, layer = 'mid') { return cam.matrix(t, layer).a },
      // How fast a layer (the near one unless named) slides against the diagram, in px a second, at
      // the worst of the frame's corners and centre (axis 'y': its vertical part only): 0 at rest
      // and through a pan, hundreds through a push, pull or truck.
      slide(t, layer = 'near', axis = 'xy') {
        const d = 1 / 60
        const A = cam.matrix(t, layer), A0 = cam.matrix(t - d, layer)
        const M = cam.matrix(t, 'mid'), M0 = cam.matrix(t - d, 'mid')
        let worst = 0
        for (const [X, Y] of [[0, 0], [1920, 0], [0, 1080], [1920, 1080], [960, 540]]) {
          const nx = (X - A.e) / A.a, ny = (Y - A.f) / A.a, mx = (X - M.e) / M.a, my = (Y - M.f) / M.a
          const dx = A0.a * nx + A0.e - (M0.a * mx + M0.e), dy = A0.a * ny + A0.f - (M0.a * my + M0.f)
          worst = Math.max(worst, axis === 'y' ? Math.abs(dy) : Math.hypot(dx, dy))
        }
        return worst / d
      },
      apply(t) {
        const st = cam.state(t)
        // the under layer (the near bokeh, DECISIONS 100) moves as the near one
        for (const [name, k] of [['far', 'far'], ['under', 'near'], ['mid', 'mid'], ['near', 'near']]) {
          if (!room || !room[name]) continue
          const m = cam.matrix(t, k, st)
          room[name].style.transform = `matrix(${m.a.toFixed(5)}, 0, 0, ${m.a.toFixed(5)}, ${m.e.toFixed(2)}, ${m.f.toFixed(2)})`
        }
        // the near bokeh lifts while it slides against the diagram (from 10 to 160 px a second, so
        // a gentle pull shows its depth too; DECISIONS 106), and the frames at rest stay clean
        if (room && room.bokeh) {
          const u = clamp((cam.slide(t) - 10) / 150), w = u * u * (3 - 2 * u)
          room.bokeh.style.opacity = ((1 + (L.BOKEH_LIFT - 1) * w) / L.BOKEH_LIFT).toFixed(4)
        }
        if (room && room.staves) {
          const u = clamp((cam.slide(t, 'far', 'y') - 20) / 180), w = u * u * (3 - 2 * u)
          room.staves.style.opacity = ((1 + (L.STAVE_LIFT - 1) * w) / L.STAVE_LIFT).toFixed(4)
        }
        return st
      },
      drive(tl, D) { L.clock(tl, D, (t) => cam.apply(t)); return cam },
    }
    return cam
  }
})()
