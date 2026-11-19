/* Find Your Pitch, Lesson 5 kit: the tease and the end card (HANDOFFS § The tease and the end card; § The
   cuts, S13 to S14 and S14 to S15). window.L, after recap.js. World px at F0.

     L.TEASE            ROWS (semitone row k, C4 = 0 to D#5 = 15, centred y = 745 - 30 k, 30 px bands, x 340 to
                        1500; black-key rows ink 6 %, the others ink 2.5 %, lines ink 6 %), BEADS (r 20 at x = 420 +
                        160 i: C4 C4 G4 G4 A4 A4 G4; .onset(i) its onset in `twinkle`'s own time, 0.5 s apart, the
                        last held 1.0 s), COPY (six rows up: y - 180), Q ("?" Outfit 600 64 ink-2, x 1430, baseline
                        375), LINE (the tease line, Outfit 600 44, centred, baseline 150), HOOK (serif italic 60,
                        centred, baselines 130 and 200), END (the end card: the tease figure's place
                        { s 0.45, dx 1030, dy 35.25 }: x' = 1210 + 0.45 (x - 400), y' = 150 + 0.45 (y - 255); the
                        lockup at x 120, y 80 to 180; the address Outfit 600 72 x 120 baseline 320; "Voice Mirror
                        is free, with no account" Outfit 500 44 baseline 395; CLEAR, the zone kept empty, x 80 to
                        1100, y 460 to 880), MASK (clear within 20 px of a host's body, full 60 px further)
     L.TEASE.carry(T, t0)   S13 to S14 (one curve both scenes draw from film time T; t0 the film time it starts,
                        by default L.cue('next', 'start', -0.92)): from the "five notes" glyph's first dot (272,
                        434, after the cards' drift) growing from r 4 to r 20, to the C4 place (420, 745) 1.6 s
                        later (power2.inOut), a cubic through (300, 560) and (380, 680); its whole path left of
                        x 450. Returns { x, y, r, u } or null before t0
     L.TEASE.shrink(T, t0)  S14 to S15: 0..1 the tease figure's shrink to the end card's box over 1.2 s
                        (power2.inOut) from t0, by default L.cue('end', 'start', -0.31); place(u) is its
                        { s, dx, dy } for the figure's group
     const te = L.tease(svg, { keepMask = true })
     te.draw({ rowsA = 1, keep = [] (the hosts' body boxes on screen, L.mercBox), beads = (i) => ({ a, lit,
               scale }), copy = 0 (0..1 the dashed copy drawn, bead by bead), copyA = 1, qA = 0, qScale = 1,
               arrows = (i) => progress 0..1 (the rising arrows, 0.08 s apart), place = null })
                        unlit beads are 2 px chrome outlines, lit ones blue (#58a6ff), Merc's notes (the series
                        code); the copy is L.GUESS outlines
     L.lockup(parent, { x = 120, y0 = 80, h = 100 }) -> { g, w, draw({ wipe = 1, a = 1 }) }   the MercuryPitch
                        lockup (assets/brand/lockup-horizontal.svg, inlined, its 1180 x 260 at h 100 is 454 px
                        wide), revealed left to right by a mask feathered over 60 px
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp

  const NOTES = ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4']
  const SEMI = { C4: 0, G4: 7, A4: 9 }
  const BLACK = [1, 3, 6, 8, 10, 13, 15]
  L.TEASE = {
    ROWS: { x0: 340, x1: 1500, k0: 0, k1: 15, y: (k) => 745 - 30 * k, h: 30, black: (k) => BLACK.includes(k) },
    BEADS: NOTES.map((n, i) => ({ note: n, x: 420 + 160 * i, y: 745 - 30 * SEMI[n], r: 20 })),
    onset: (i) => 0.5 * i,
    COPY: { dy: -180 },
    Q: { text: '?', x: 1430, y: 375, size: 64 },
    LINE: { text: 'Merc moves every single note of ‘Twinkle, Twinkle’ up.', x: 960, y: 150, size: 44 },
    HOOK: [{ text: 'Why can you start “Twinkle, Twinkle” on any note', y: 130 }, { text: 'and it is still the same tune?', y: 200 }], hookSize: 60,
    END: {
      place: { s: 0.45, dx: 1210 - 0.45 * 400, dy: 150 - 0.45 * 255 },
      lockup: { x: 120, y0: 80, h: 100 },
      address: { text: 'mercurypitch.com/mirror', x: 120, y: 320, size: 72 },
      free: { text: 'Voice Mirror is free, with no account', x: 120, y: 395, size: 44, weight: 500 },
      clear: { x0: 80, x1: 1100, y0: 460, y1: 880 },
    },
    MASK: { clear: 20, ramp: 60 },
  }
  const cubic = (p, u) => {
    const v = 1 - u
    return [0, 1].map((i) => v * v * v * p[0][i] + 3 * v * v * u * p[1][i] + 3 * v * u * u * p[2][i] + u * u * u * p[3][i])
  }
  L.TEASE.carry = (T, t0 = L.cue('next', 'start', -0.92)) => {
    if (T < t0) return null
    const u = L.ease('power2.inOut')(clamp((T - t0) / 1.6))
    const [x, y] = cubic([[272, 434], [300, 560], [380, 680], [420, 745]], u)
    return { x, y, r: L.lerp(4, 20, u), u }
  }
  L.TEASE.shrink = (T, t0 = L.cue('end', 'start', -0.31)) => L.ease('power2.inOut')(clamp((T - t0) / 1.2))
  L.TEASE.place = (u) => {
    const P = L.TEASE.END.place
    return { s: L.lerp(1, P.s, u), dx: L.lerp(0, P.dx, u), dy: L.lerp(0, P.dy, u) }
  }

  L.tease = (svg, { keepMask = true } = {}) => {
    const id = L.uid('tease')
    const root = L.svg('g', { class: 'tease' }, svg)
    const defs = L.svg('defs', {}, root)
    // the rows' keep-out mask (screen space at F0): white, with a blurred black box round each host
    const mask = L.svg('mask', { id: id + '-keep', maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 10000, height: 10000 }, defs)
    L.svg('rect', { x: -4000, y: -4000, width: 10000, height: 10000, fill: '#fff' }, mask)
    const blur = L.svg('filter', { id: id + '-blur', filterUnits: 'userSpaceOnUse', x: -400, y: -400, width: 2720, height: 1880 }, defs)
    L.svg('feGaussianBlur', { stdDeviation: 17.6 }, blur)
    const holes = L.svg('g', { filter: `url(#${id}-blur)` }, mask)
    const holeRects = [0, 1, 2].map(() => L.svg('rect', { fill: '#000', display: 'none' }, holes))
    const fig = L.svg('g', {}, root)
    const gRows = L.svg('g', { mask: keepMask ? `url(#${id}-keep)` : null }, fig)
    const R = L.TEASE.ROWS
    for (let k = R.k0; k <= R.k1; k++) {
      L.svg('rect', { x: R.x0, width: R.x1 - R.x0, y: R.y(k) - R.h / 2, height: R.h, fill: C.ink, 'fill-opacity': R.black(k) ? 0.06 : 0.025 }, gRows)
      L.svg('rect', { x: R.x0, width: R.x1 - R.x0, y: R.y(k) + R.h / 2 - 0.5, height: 1, fill: C.ink, 'fill-opacity': 0.06 }, gRows)
    }
    const gArrows = L.svg('g', {}, fig)
    const gCopy = L.svg('g', {}, fig)
    const gBeads = L.svg('g', {}, fig)
    const beads = L.TEASE.BEADS.map((b, i) => {
      const g = L.svg('g', {}, gBeads)
      const halo = L.svg('circle', { cx: b.x, cy: b.y, r: b.r * 1.8, fill: C.blue, 'fill-opacity': 0.18, opacity: 0 }, g)
      const outline = L.svg('circle', { cx: b.x, cy: b.y, r: b.r - 1, fill: 'none', stroke: C.chrome, 'stroke-width': 2 }, g)
      const fill = L.svg('circle', { cx: b.x, cy: b.y, r: b.r, fill: C.blue, opacity: 0 }, g)
      const arrow = L.arrow(gArrows, { x1: b.x, y1: b.y - b.r - 4, x2: b.x, y2: b.y + L.TEASE.COPY.dy + b.r + 6, color: C.chrome, width: 1.5, head: 8, opacity: 0.4 })
      const copy = L.svg('circle', { cx: b.x, cy: b.y + L.TEASE.COPY.dy, r: b.r - 1, fill: 'none', stroke: L.GUESS.stroke, 'stroke-width': L.GUESS.width, 'stroke-dasharray': '7 6', opacity: 0 }, gCopy)
      return { g, halo, outline, fill, arrow, copy, b }
    })
    const q = L.text(fig, '?', { x: L.TEASE.Q.x, y: L.TEASE.Q.y, size: 64, fill: L.GUESS.stroke })
    return {
      g: root, beads,
      draw({ rowsA = 1, keep = [], beads: bf = () => ({ a: 1 }), copy = 0, copyA = 1, qA = 0, qScale = 1, arrows = () => 0, place = null, a = 1 } = {}) {
        root.setAttribute('opacity', clamp(a).toFixed(3))
        fig.setAttribute('transform', place ? `matrix(${place.s.toFixed(5)} 0 0 ${place.s.toFixed(5)} ${f2(place.dx)} ${f2(place.dy)})` : '')
        gRows.setAttribute('opacity', clamp(rowsA).toFixed(3))
        holeRects.forEach((r, i) => {
          const b = keep[i]
          if (!b) { r.setAttribute('display', 'none'); return }
          const m = L.TEASE.MASK.clear + L.TEASE.MASK.ramp / 2
          r.removeAttribute('display')
          r.setAttribute('x', f2(b.x0 - m)); r.setAttribute('y', f2(b.y0 - m))
          r.setAttribute('width', f2(b.x1 - b.x0 + 2 * m)); r.setAttribute('height', f2(b.y1 - b.y0 + 2 * m))
        })
        beads.forEach((B, i) => {
          const s = bf(i) || {}
          const ba = clamp(s.a ?? 1), lit = clamp(s.lit ?? 0), sc = s.scale ?? 1
          B.g.setAttribute('opacity', ba.toFixed(3))
          B.g.setAttribute('transform', sc !== 1 ? `translate(${B.b.x} ${B.b.y}) scale(${sc.toFixed(4)}) translate(${-B.b.x} ${-B.b.y})` : '')
          B.fill.setAttribute('opacity', lit.toFixed(3))
          B.halo.setAttribute('opacity', lit.toFixed(3))
          B.outline.setAttribute('stroke-opacity', (1 - 0.6 * lit).toFixed(3))
          B.arrow.draw(arrows(i), 1)
          const cu = clamp(copy * beads.length - i)
          B.copy.setAttribute('opacity', (cu * clamp(copyA)).toFixed(3))
        })
        L.place(q, { a: qA, scale: qScale, ox: L.TEASE.Q.x, oy: L.TEASE.Q.y })
      },
    }
  }

  /* ---------------------------------------------------------------- the lockup, inlined, with a feathered wipe */
  L.lockup = (parent, { x = 120, y0 = 80, h = 100 } = {}) => {
    const id = L.uid('lockup')
    const k = h / 260
    const g = L.svg('g', { opacity: 0, class: 'lockup' }, parent)
    const defs = L.svg('defs', {}, g)
    defs.innerHTML = `<clipPath id="${id}-orb"><circle cx="130" cy="130" r="118"/></clipPath>
      <radialGradient id="${id}-chrome" cx="0.38" cy="0.28" r="1.05"><stop offset="0" stop-color="#f4f8fd"/><stop offset="0.32" stop-color="#c3ccd6"/><stop offset="0.62" stop-color="#8a97a6"/><stop offset="1" stop-color="#3d4b5c"/></radialGradient>
      <linearGradient id="${id}-liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3050"/><stop offset="1" stop-color="#0b1220"/></linearGradient>
      <linearGradient id="${id}-spectrum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#58a6ff"/><stop offset="0.5" stop-color="#2dd4bf"/><stop offset="1" stop-color="#bc8cff"/></linearGradient>
      <linearGradient id="${id}-wipe" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="60" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`
    const mask = L.svg('mask', { id: id + '-m', maskUnits: 'userSpaceOnUse', x: -400, y: -400, width: 3000, height: 1200 }, defs)
    const wipe = L.svg('rect', { x: -400, y: -400, width: 3000, height: 1200, fill: `url(#${id}-wipe)` }, mask)
    const grad = defs.querySelector(`#${id}-wipe`)
    const inner = L.svg('g', { mask: `url(#${id}-m)` }, g)
    const art = L.svg('g', { transform: `translate(${x} ${y0}) scale(${k.toFixed(5)})` }, inner)
    art.innerHTML = `<g clip-path="url(#${id}-orb)"><circle cx="130" cy="130" r="118" fill="url(#${id}-chrome)"/>
      <path d="M12,130 C54,86 86,86 130,130 S206,174 248,130 A118,118 0 0 1 12,130 Z" fill="url(#${id}-liquid)"/>
      <path d="M12,130 C54,86 86,86 130,130 S206,174 248,130" fill="none" stroke="url(#${id}-spectrum)" stroke-width="11" stroke-linecap="round"/>
      <ellipse cx="94" cy="69" rx="25" ry="12.5" fill="#ffffff" opacity="0.85" transform="rotate(-20 94 69)"/></g>
      <circle cx="130" cy="130" r="118" fill="none" stroke="#c3ccd6" stroke-opacity="0.35" stroke-width="2"/>
      <text x="292" y="172" style="font-family: 'Outfit'; font-size: 118px; font-weight: 600; letter-spacing: -2px;"><tspan fill="#e6edf3">Mercury</tspan><tspan fill="url(#${id}-spectrum)">Pitch</tspan></text>`
    const W = 1180 * k
    return {
      g, w: W,
      draw({ wipe: u = 1, a = 1 } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        const edge = x - 60 + (W + 120) * clamp(u)
        grad.setAttribute('x1', f2(edge - 60)); grad.setAttribute('x2', f2(edge))
      },
    }
  }
})()
