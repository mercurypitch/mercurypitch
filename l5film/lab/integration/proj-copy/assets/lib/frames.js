/* Find Your Pitch, Lesson 5 kit: the camera as framings. window.L, after motion.js. Lesson 4's
   frames.js (it survived), with this film's framings (HANDOFFS § Framings) and moves (§ Camera moves).

   HANDOFFS § Shared formulas. A framing is (s, ox, oy) for the mid layer: x' = s x + ox, y' = s y + oy,
   from world coordinates (F0's pixels) to the screen. Layer k (far 0.25, mid 1, near 1.6; the under
   layer, the bokeh, moves as near) draws at scale 1 + k (s - 1) with offset (k (ox - px) + px,
   k (oy - py) + py), where (px, py) is the part of the offset a pan put there: a push, pull, truck or
   crane moves the layers apart, a pan moves them all by the same amount (this film has no pan). A move
   to a named framing eases px and py back to 0 with the rest, so every layer lands on that framing
   exactly. The floor and the hosts are not moved (room.floorLayer and room.top are screen space).

     L.FRAMES                                   the named framings, { s, ox, oy }
     const cam = L.frameRig(room, { from: 'F0' })
     cam.to(at, dur, 'F-gauge' | { s, ox, oy }, ease)   s, ox and oy (and the pan part) on one curve
     cam.pan(at, dur, { x, y }, ease)                 every layer by the same amount (unused here)
     cam.hermite(at, dur, to)                         from the moves so far, at their rates, to rest at `to`
     cam.curve(at, dur, fn)                           fn(u) -> { s, ox, oy } for u in 0..1
     cam.state(t)  cam.matrix(t, layer)  cam.map(x, y, t, layer)  cam.inv(X, Y, t, layer)
     cam.scale(t, layer)  cam.slide(t, layer)  cam.apply(t)  cam.drive(tl, D)
     cam.edgeAlpha(box, t, layer, { margin = 16, ramp = 24 })   a world box's alpha by its distance to the
                                                      frame's edge: give it to every world chip and tag, so
                                                      none shows cropped or within 16 px of an edge
     L.roomCut(room, { from, at = 0, dur = 0.3 }) -> { draw(t, T) }   a matched cut's room: the outgoing
                                                      framing's staves, bokeh and dust over the room at rest,
                                                      crossfaded over 0.3 s (HANDOFFS § The cuts)
     L.frameAbout(s, wx, wy, sx = wx, sy = wy)        the framing of scale s that puts world (wx, wy) at
                                                      screen (sx, sy): { s, ox: sx - s wx, oy: sy - s wy }

   Times are scene times. Add moves in time order. A move that spans a cut is written the same way in
   both scenes, from the same cue, so both evaluate one curve. While the bokeh and the staves slide
   against the diagram the rig lifts them (from 10 px a second, full at 250; the staves by their
   vertical slide, 20 to 200; L.BOKEH_LIFT 5, L.STAVE_LIFT 4), so a push reads as a push, and every
   frame at rest is as before. A move under 1/30 s is a cut written as a move: the frame that spans it
   lifts nothing (the kit-room lab).
*/
;(function () {
  const L = window.L
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))

  // a move shorter than this is a cut written as a move (a to() of a few ms): a frame whose slide spans it
  // lifts nothing, so the cut shows as one change (LAB-CHECKS 2)
  const CUT_DUR = 1 / 30
  const S_HOOK = 800 / 1120
  L.FRAMES = {
    F0: { s: 1, ox: 0, oy: 0 },
    'F-cold': { s: 0.9, ox: 96, oy: 45 },                       // S1 from frame 0, about the screen point (960, 450)
    'F-cold end': { s: 0.92, ox: 76.8, oy: 36 },                // the drift's end, 31.25
    'F-hook': { s: S_HOOK, ox: 560 - 400 * S_HOOK, oy: 520 - 400 * S_HOOK },   // Merc's line x 560 to 1360 at y 520
    'F-bead': { s: 2.2, ox: 80, oy: -340 },                     // the head bead (world (400, 400)) at the frame's centre
    'F-promise-a': { s: 1, ox: 80, oy: 0 },
    'F-promise-b': { s: 1, ox: -80, oy: 0 },
    'F-strip': { s: 1.4, ox: -384, oy: -700 },                  // the strip x 176 to 1744, centre y 266
    'F-gauge': { s: 1.05, ox: -60, oy: -25.25 },                // about world (1200, 505)
    'F-hold': { s: 1.3, ox: -288, oy: 10 },                     // world (960, 400) to screen (960, 530)
    'CU-scoop': { s: 1.8, ox: -360, oy: -200 },                 // world (400, 400) to screen (360, 520) [kit-01: 9]
    'CU-wave': { s: 1.8, ox: -840, oy: -200 },                  // world (1000, 400) to screen (960, 520)
    'F-turn': { s: 1.4, ox: -472, oy: -190 },                   // about world (1180, 475)
    'F-end': { s: 1.03, ox: -28.8, oy: -16.2 },                 // 3 % about (960, 540)
  }
  L.frameAbout = (s, wx, wy, sx = wx, sy = wy) => ({ s, ox: sx - s * wx, oy: sy - s * wy })

  // The room across a matched cut (HANDOFFS § The cuts [kit-01: 6]): the incoming scene draws the room as the
  // outgoing scene left it (its staves, bokeh and dust at the outgoing framing, at rest) over its own room at
  // F0 and crossfades the two over `dur` (0.3 s) from `at`, so the cut never snaps the room while the carried
  // object, drawn by the incoming scene on the same pixels, holds still. Call it after L.room, before any
  // layer is drawn into; draw it every frame with the scene time and the film time (the dust's).
  L.roomCut = (room, { from, at = 0, dur = 0.3, ease = 'power1.inOut', dust = {} } = {}) => {
    const rig = L.frameRig(null, { from })
    const K = { far: 0.25, under: 1.6, near: 1.6 }
    const ghost = {}
    for (const name of ['far', 'under', 'near']) {
      if (!room[name]) continue
      const d = L.el('div', { class: 'layer ghost ghost-' + name, 'data-layout-allow-overflow': '' })
      Object.assign(d.style, { position: 'absolute', left: '0', top: '0', width: '1920px', height: '1080px', pointerEvents: 'none', transformOrigin: '0 0' })
      room[name].after(d)
      const m = rig.matrix(0, name === 'far' ? 'far' : 'near')
      d.style.transform = `matrix(${m.a.toFixed(5)}, 0, 0, ${m.a.toFixed(5)}, ${m.e.toFixed(2)}, ${m.f.toFixed(2)})`
      if (name !== 'near') for (const c of room[name].children) d.appendChild(c.cloneNode(true))
      ghost[name] = d
    }
    const ghostDust = ghost.near ? L.filmDust(ghost.near, dust) : null
    for (const d of Object.values(ghost)) { d.style.opacity = '0'; d.style.display = 'none' }
    const cutObj = {
      ghost,
      draw(t, T) {
        // inside its window the ghost fades out over the room fading in; outside it nothing is shown, and the
        // room is handed back at full (several cuts may share a room: only the one in its window touches it)
        const inWin = t >= at - 1e-6 && t <= at + dur
        const a = inWin ? 1 - L.prog(t, at, dur, ease) : 0
        for (const [name, d] of Object.entries(ghost)) {
          d.style.opacity = a.toFixed(3)
          d.style.display = a <= 0.001 ? 'none' : ''
          if (inWin) room[name].style.opacity = (1 - a).toFixed(3)
          else if (room._cutOwner === cutObj) room[name].style.opacity = '1'
        }
        if (inWin) room._cutOwner = cutObj
        else if (room._cutOwner === cutObj) room._cutOwner = null
        if (ghostDust && a > 0.001) ghostDust(T)
        return a
      },
    }
    return cutObj
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
    const cut = (t) => moves.some((m) => m.dur < CUT_DUR && m.at < t + 1e-9 && m.at + m.dur > t - 1 / 60 - 1e-9)
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
      cutAt(t) { return cut(t) },
      // a world box's alpha against the frame's edge: 1 while the box on screen keeps `margin` + `ramp` px inside
      // every edge, 0 once it comes within `margin` of one (so a chip is never shown cropped, nor closer than
      // 16 px to the edge, at any framing or in any move)
      edgeAlpha(box, t, layer = 'mid', { margin = 16, ramp = 24 } = {}) {
        const [X0, Y0] = cam.map(box.x0, box.y0, t, layer), [X1, Y1] = cam.map(box.x1, box.y1, t, layer)
        const d = Math.min(X0, Y0, 1920 - X1, 1080 - Y1) - margin
        return clamp(d / ramp)
      },
      apply(t) {
        const st = cam.state(t)
        // the under layer (the near bokeh, DECISIONS 100) moves as the near one
        for (const [name, k] of [['far', 'far'], ['under', 'near'], ['mid', 'mid'], ['near', 'near']]) {
          if (!room || !room[name]) continue
          const m = cam.matrix(t, k, st)
          room[name].style.transform = `matrix(${m.a.toFixed(5)}, 0, 0, ${m.a.toFixed(5)}, ${m.e.toFixed(2)}, ${m.f.toFixed(2)})`
        }
        // the near bokeh lifts while it slides against the diagram (from 10 to 250 px a second, so
        // a gentle pull shows its depth too, DECISIONS 106, and a fast push lifts over its ease-in rather
        // than in three frames; set with L.BOKEH_LIFT at integration, DECISIONS 200), and the frames at
        // rest stay clean
        if (room && room.bokeh) {
          const v = cam.slide(t), u = cut(t) ? 0 : clamp((v - 10) / 240), w = u * u * (3 - 2 * u)
          room.bokeh.style.opacity = ((1 + (L.BOKEH_LIFT - 1) * w) / L.BOKEH_LIFT).toFixed(4)
        }
        if (room && room.staves) {
          const v = cam.slide(t, 'far', 'y'), u = cut(t) ? 0 : clamp((v - 20) / 180), w = u * u * (3 - 2 * u)
          room.staves.style.opacity = ((1 + (L.STAVE_LIFT - 1) * w) / L.STAVE_LIFT).toFixed(4)
        }
        return st
      },
      drive(tl, D) { L.clock(tl, D, (t) => cam.apply(t)); return cam },
    }
    return cam
  }
})()
