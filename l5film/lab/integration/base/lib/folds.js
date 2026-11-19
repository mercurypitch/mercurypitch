/* Find Your Pitch, Lesson 5 kit: the vocal folds, the trace strip and the voice box (HANDOFFS § World,
   The folds and the traces (S9); § The hold frame, The voice box (10h); § Recap, card 2's traces).
   window.L, after marks.js. World px at F0.

     L.FOLDS            the folds from above: centred (390, 430) in a 340 px box (x 220 to 560, y 260 to 600);
                        apex (390, 300); back ends apart (330, 560) (450, 560), slit (378, 560) (402, 560),
                        pressed (388, 560) (392, 560); 8 px chrome strokes (12 pressed); the rounded outline
                        chrome 30 %; LABEL "vocal folds, from above" (Outfit 500 28, ink-2, x 220, baseline
                        650); THROAT (1005, 273), where they grow from the breath figure (9b); SMALL, their
                        place in the stack (x 160 to 330, y 110 to 280: centre (245, 195), scale 0.5)
     const fo = L.folds(svg)
     fo.draw({ a = 1, state = 'apart' | 'slit' | 'pressed' | { from, to, u }, vib = 0, T = 0, cx = 390,
               cy = 430, s = 1, grow = 1, outlineA = 1, airA = 0, airU = 0 })
                        vib 0..1: the gap narrows and shimmers +-3 px at 18 Hz of drawn time (T, film time),
                        not the voice's; grow 0..1: a small chrome ring (the outline as a circle, r 20) grows
                        into the folds (9b: scale and place are the scene's, from THROAT to (390, 430));
                        airA, airU: a chrome arrow of air rising between them (9c), drawn on to airU
     L.TRACE            the strip (x 700 to 1600, x(t) = 700 + 562.5 t over 1.6 s, centre y 430, half-height
                        up to 110), its title (Outfit 600 44, x 700, baseline 280), its tag (right-aligned
                        1600, centred y 270), the chips (centred y 680 from x 700, 920, 1140), the mark labels
                        (Outfit 600 30, baseline 580); STACK (rows centred y 250, 450, 650, half-height 70; names
                        Outfit 600 36 right-aligned 670, baselines 262, 462, 662; the circles' labels; the
                        two tags); RECAP (card 2: x 1180 to 1640, x(t) = 1180 + 287.5 t, centres 200, 320,
                        440, half-height 45, names Outfit 600 30 right-aligned 1160, baselines 210, 330, 450);
                        ONSET (each start's onset in its own time: air's tone from 0.25 s, the catch's click
                        at 0.15 s, together's tone at 0, provisional until the sound round)
     L.TRACE.level(kind, t)   0..1 the tone's level (air: rising 0.25 to 0.5 s; catch: full from 0.15 s;
                        together: rising over its first 0.06 s)
     const tr = L.trace(svg, { x0 = 700, x1 = 1600, y = 430, h = 110, len = 1.6, seed = 75 })
     tr.draw({ kind = 'air' | 'catch' | 'together', t = 1.6 (drawn up to, in the start's own time), a = 1,
               dim = 0 (strokes to 35 %), lit = 0 (a counted 40 % light: L.lit), circle = 0 (0..1 the
               chrome circle round the dots or the mark drawing on), tick = 1 (the gold tick's alpha),
               tickScale = 1, place = null ({ s, dx, dy }) })
                        a stylised wave of 22 px a cycle whose half-height is the level (never the pitch);
                        air: fine chrome dots (r 1.5, 70 %, seeded) for 0.35 s; catch: 0.15 s of nothing, a
                        short ink mark (4 px, the strip's height), then the wave at full at once; together:
                        the wave grows from the onset with a gold tick (4 x 40) on the centre line there
     const vb = L.voiceBox(svg)   10h's: a rounded outline x 300 to 640, y 190 to 510 (radius 60), the folds
                        at 0.8 centred (470, 350), two muscle bands (chrome 6 px at x 380 and 560, y 280 to
                        420): vb.draw({ a = 1, draw = 1, glow = 0, T })
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp
  const lerp = L.lerp

  const ENDS = { apart: [[330, 560], [450, 560]], slit: [[378, 560], [402, 560]], pressed: [[388, 560], [392, 560]] }
  L.FOLDS = {
    CX: 390, CY: 430, BOX: 340, APEX: [390, 300], ENDS,
    LABEL: { text: 'vocal folds, from above', x: 220, y: 650, size: 28, weight: 500, fill: C.ink2 },
    THROAT: [1005, 273],
    SMALL: { cx: 245, cy: 195, s: 0.5 },
  }

  const foldShape = (parent) => {
    const g = L.svg('g', {}, parent)
    const outline = L.svg('rect', { fill: 'none', stroke: C.chrome, 'stroke-opacity': 0.3, 'stroke-width': 2 }, g)
    const air = L.arrow(g, { x1: 390, y1: 590, x2: 390, y2: 330, color: C.chrome, width: 3, head: 12 })
    const left = L.svg('path', { fill: 'none', stroke: C.chrome, 'stroke-width': 8, 'stroke-linecap': 'round' }, g)
    const right = L.svg('path', { fill: 'none', stroke: C.chrome, 'stroke-width': 8, 'stroke-linecap': 'round' }, g)
    const ends = (state) => {
      if (typeof state === 'string') return { e: ENDS[state], w: state === 'pressed' ? 12 : 8 }
      const A = ENDS[state.from], B = ENDS[state.to], u = clamp(state.u)
      const wa = state.from === 'pressed' ? 12 : 8, wb = state.to === 'pressed' ? 12 : 8
      return { e: [0, 1].map((i) => [lerp(A[i][0], B[i][0], u), lerp(A[i][1], B[i][1], u)]), w: lerp(wa, wb, u) }
    }
    return {
      g,
      draw({ state = 'apart', vib = 0, T = 0, grow = 1, outlineA = 1, airA = 0, airU = 0 } = {}) {
        const { e, w } = ends(state)
        const sh = 3 * clamp(vib) * Math.sin(2 * Math.PI * 18 * T)
        const [ax, ay] = L.FOLDS.APEX
        left.setAttribute('d', `M${ax} ${ay} L${f2(e[0][0] + sh)} ${e[0][1]}`)
        right.setAttribute('d', `M${ax} ${ay} L${f2(e[1][0] - sh)} ${e[1][1]}`)
        for (const p of [left, right]) { p.setAttribute('stroke-width', f2(w)); p.setAttribute('opacity', L.smooth(0.35, 0.9, grow).toFixed(3)) }
        // the outline: a ring (r 20) growing into the rounded box
        const gu = L.ease('power2.inOut')(clamp(grow))
        const half = lerp(20, L.FOLDS.BOX / 2, gu), rx = lerp(20, 40, gu)
        outline.setAttribute('x', f2(L.FOLDS.CX - half)); outline.setAttribute('y', f2(L.FOLDS.CY - half))
        outline.setAttribute('width', f2(2 * half)); outline.setAttribute('height', f2(2 * half)); outline.setAttribute('rx', f2(rx))
        outline.setAttribute('stroke-opacity', (lerp(1, 0.3, gu) * clamp(outlineA)).toFixed(3))
        air.draw(airU, airA)
      },
    }
  }
  L.folds = (svg) => {
    const outer = L.svg('g', { class: 'folds', opacity: 0 }, svg)
    const sh = foldShape(outer)
    return {
      g: outer,
      draw({ a = 1, cx = L.FOLDS.CX, cy = L.FOLDS.CY, s = 1, ...rest } = {}) {
        outer.setAttribute('opacity', clamp(a).toFixed(3))
        outer.setAttribute('transform', `translate(${f2(cx)} ${f2(cy)}) scale(${s.toFixed(5)}) translate(${-L.FOLDS.CX} ${-L.FOLDS.CY})`)
        sh.draw(rest)
      },
    }
  }

  /* ---------------------------------------------------------------- the trace strip */
  L.TRACE = {
    x0: 700, x1: 1600, y: 430, h: 110, len: 1.6,
    title: { x: 700, y: 280, size: 44 },
    tag: { x: 1600, y: 270, anchor: 'end' },
    chips: [{ text: 'Air first', x: 700 }, { text: 'A catch', x: 920 }, { text: 'Together', x: 1140 }], chipY: 680,
    marks: { air: { text: 'air, no note', x: 700, y: 580, size: 30 }, catch: { text: 'the catch', x: 786, y: 580, size: 30 } },
    STACK: {
      rows: [250, 450, 650], h: 70, names: { x: 670, y: [262, 462, 662], size: 36, texts: ['Air first', 'A catch', 'Together'] },
      puff: { text: 'the puff', x: 720, y: 165, size: 30 }, click: { text: 'the click', x: 800, y: 368, size: 30 }, neither: { text: 'neither', x: 720, y: 568, size: 30 },
      easy: { text: 'the easy start', x: 1000, y: 568, size: 40 },
      h: { text: 'h', x: 760, y: 690, size: 120 }, hLine: { text: 'the h, only in your mind', x: 720, y: 770, size: 30, weight: 500 },
      tag: { x: 1600, y: 150, anchor: 'end' }, listen: { x: 1600, y: 350, anchor: 'end' },
    },
    RECAP: { x0: 1180, x1: 1640, rows: [200, 320, 440], h: 45, names: { x: 1160, y: [210, 330, 450], size: 30 } },
    ONSET: { air: 0.25, catch: 0.15, together: 0 },
    level(kind, t) {
      if (kind === 'air') return L.smooth(0.25, 0.5, t)
      if (kind === 'catch') return t >= 0.15 ? 1 : 0
      return L.smooth(0, 0.06, t)
    },
  }

  L.trace = (svg, { x0 = 700, x1 = 1600, y = 430, h = 110, len = 1.6, seed = 75 } = {}) => {
    const root = L.svg('g', { class: 'trace', opacity: 0 }, svg)
    const hair = L.svg('rect', { x: x0, width: x1 - x0, y: y - 0.5, height: 1, fill: C.chrome, 'fill-opacity': 0.25 }, root)
    const litBand = L.svg('rect', { x: x0, width: x1 - x0, y: y - h, height: 2 * h, rx: 6, fill: C.chrome, 'fill-opacity': 0 }, root)
    const wave = L.svg('path', { fill: 'none', stroke: C.chrome, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, root)
    const dotsG = L.svg('g', {}, root)
    const X = (t) => x0 + ((x1 - x0) * t) / len
    const r = L.rng(seed)
    const dots = []
    for (let i = 0; i < 140; i++) {
      const t = 0.35 * r()
      dots.push({ t, el: L.svg('circle', { cx: f2(X(t)), cy: f2(y + (r() - 0.5) * 1.3 * h), r: 1.5, fill: C.chrome, 'fill-opacity': 0.7 }, dotsG) })
    }
    const mark = L.svg('rect', { x: X(0.15) - 2, y: y - h, width: 4, height: 2 * h, fill: C.ink }, root)
    const tickG = L.svg('g', {}, root)
    const tick = L.svg('rect', { x: X(0) - 2, y: y - 20, width: 4, height: 40, fill: C.gold }, tickG)
    const circle = L.svg('ellipse', { fill: 'none', stroke: C.chrome, 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, root)
    return {
      g: root, x: X,
      draw({ kind = 'air', t = len, a = 1, dim = 0, lit = 0, circle: cu = 0, tick: ta = 1, tickScale = 1, place = null } = {}) {
        root.setAttribute('opacity', clamp(a).toFixed(3))
        root.setAttribute('transform', place ? `matrix(${place.s.toFixed(5)} 0 0 ${place.s.toFixed(5)} ${f2(place.dx)} ${f2(place.dy)})` : '')
        const sa = 1 - 0.65 * clamp(dim)
        litBand.setAttribute('fill-opacity', (0.4 * 0.35 * clamp(lit)).toFixed(3))
        const tt = clamp(t, 0, len)
        let d = ''
        const n = Math.max(1, Math.ceil(X(tt) - x0))
        for (let i = 0; i <= n; i++) {
          const x = x0 + ((X(tt) - x0) * i) / n, tau = ((x - x0) / (x1 - x0)) * len
          const lv = L.TRACE.level(kind, tau)
          d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y - h * lv * Math.sin((2 * Math.PI * (x - x0)) / 22))
        }
        wave.setAttribute('d', d)
        wave.setAttribute('stroke-opacity', sa.toFixed(3))
        for (const dt of dots) dt.el.setAttribute('opacity', kind === 'air' && dt.t <= tt ? sa.toFixed(3) : '0')
        mark.setAttribute('opacity', kind === 'catch' && tt >= 0.15 ? sa.toFixed(3) : '0')
        tick.setAttribute('opacity', kind === 'together' && tt > 0 ? (clamp(ta) * sa).toFixed(3) : '0')
        tickG.setAttribute('transform', tickScale !== 1 ? `translate(${f2(X(0))} ${y}) scale(${tickScale.toFixed(4)}) translate(${f2(-X(0))} ${-y})` : '')
        // the circle round the feature (the dots, or the mark)
        const c = kind === 'air' ? { cx: (X(0) + X(0.35)) / 2, rx: (X(0.35) - X(0)) / 2 + 24 } : { cx: X(0.15), rx: 34 }
        circle.setAttribute('cx', f2(c.cx)); circle.setAttribute('cy', y); circle.setAttribute('rx', f2(c.rx)); circle.setAttribute('ry', f2(h + 14))
        circle.setAttribute('stroke-dashoffset', (1 - clamp(cu)).toFixed(4))
        circle.setAttribute('opacity', cu > 0 && kind !== 'together' ? '1' : '0')
      },
    }
  }

  /* ---------------------------------------------------------------- the voice box (10h) */
  L.voiceBox = (svg) => {
    const g = L.svg('g', { class: 'voice-box', opacity: 0 }, svg)
    const outline = L.svg('rect', { x: 300, y: 190, width: 340, height: 320, rx: 60, fill: 'none', stroke: C.chrome, 'stroke-opacity': 0.6, 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '1 1' }, g)
    const inner = L.svg('g', { transform: `translate(470 350) scale(0.8) translate(${-L.FOLDS.CX} ${-L.FOLDS.CY})` }, g)
    const sh = foldShape(inner)
    const bandGlow = L.svg('g', { opacity: 0 }, g)
    const bands = [380, 560].map((x) => L.svg('rect', { x: x - 3, y: 280, width: 6, height: 140, rx: 3, fill: C.chrome }, g))
    ;[380, 560].forEach((x) => L.svg('rect', { x: x - 8, y: 272, width: 16, height: 156, rx: 8, fill: C.chrome, 'fill-opacity': 0.35 }, bandGlow))
    return {
      g,
      draw({ a = 1, draw = 1, glow = 0, T = 0 } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        outline.setAttribute('stroke-dashoffset', (1 - clamp(draw / 0.7)).toFixed(4))
        sh.draw({ state: 'slit', grow: L.smooth(0.3, 1, draw), outlineA: 0, T })
        bands.forEach((b) => b.setAttribute('opacity', L.smooth(0.5, 1, draw).toFixed(3)))
        bandGlow.setAttribute('opacity', clamp(glow).toFixed(3))
      },
    }
  }
})()
