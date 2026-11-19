/* Find Your Pitch, Lesson 5 kit: the band chart, the film's persistent actor (HANDOFFS § World, The band
   chart; § The wave rule; § The hold chart; § The hold frame; § Recap). window.L, after marks.js.
   World px (F0's pixels); a builder who passes nothing gets S1's chart.

   The sounds' contours (FACTS 80, the page's own code: kit/push-take.ts, lesson-05/toy-push.ts and
   lines.ts), cents from Merc's note and dB from the start, as functions of the take's own time:
     L.CONTOUR.easy, .pushed (4.0 s), .push (5.6 s), .demo (10.0 s): { len, cents(t), db(t), vib0, c(t),
       level(t) }; c(t) is the drawn line: cents plus the voice's wave, 5.5 Hz, +-14 cents, grown in over
       0.35 s, phase 0 at vib0 (the takes after their glide, 0.5 s; the Push note from its start; the demo
       carries its own wave from 0.9 s, the page's demoCents); level(t) is the strip's half-height,
       28 x 10^(dB / 20) world px (0 dB 28, +6 dB 55.9)
     L.CONTOUR.vib(t, t0)       the wave alone
     L.CONTOUR.pushCents(p), .pushDb(p)   1.2 cents and 0.12 dB a step from 50 (FACTS 73)
     L.CONTOUR.pushAt(t)        the Push note's slider value: 50 to 0.6 s, to 100 by 2.1, held to 3.6, back
                                to 50 by 4.8, held to 5.6
     L.CONTOUR.from(cents, db, vib0)   a contour of the scene's own (10h's silent line: from its slider)
     L.settled(contour, { step = 0.016, band = 35, hold = 0.5 }) -> { entry, settled }   the page's rule: read every
                                16 ms, settled from the first reading from which the line stays within 35 cents for
                                0.5 s (the demo: entry 0.704 s, settled 1.204 s; S10's flag and S13's card 3)
   The wave rule: L.waveK(W, L = 1120) = 10 L / (1120 W) px a cent, so a cycle is 203.6 / W world px and
   the wave 280 / W tall on the 1120 px plot, ratio 1.375 in every framing.

     L.CHART            the places: S1 (and S3, S4, S10 to 309.46: x 400 to 1520, y0 400, W 4, strip 690),
                        S5 (W 6), S7 (y0 470, strip 700), S10 (W 10, no strip), FRAME (the right half:
                        x 1000 to 1640, y0 245, k 1.0, W 10), RECAP (x 232 to 1688, y0 600, k 1.3, W 10);
                        AT078 { s: 0.78, dx: 154, dy: 99 } (5f), MINI1 { s: 0.41, dx: 1016, dy: 117.3 } (7b),
                        and LABELS, every label HANDOFFS places, by name (below)
     const ch = L.bandChart(svg, { x0 = 400, x1 = 1520, y0 = 400, W = 4, k = null, strip = 690 | null })
     ch.geo({ x0, x1, y0, W, k, strip })   change the geometry (k follows W by the wave rule unless given)
     ch.x(t)  ch.y(c)  ch.band() -> { top, bot }  ch.place({ s, dx, dy })   an object move of the whole
                        chart group (its labels and chips ride it): x' = s x + dx
     ch.draw({
       a = 1,                                    the whole chart (a chapter card dims it to 0.25: hide
                                                 its labels while it is dim, trap 12)
       band: { a = 1, fill = 0.12, lit = 0 },    lit 0..1: the mint edge (3 px, 6 px glow at 40 %), only
                                                 ever beside the words "in the band"
       merc: { a = 1, draw = 1, dim = 0, glow = 0, w = 4 }   Merc's amber line (w world px), drawn on left to right; dim 0.5
                                                 under Tavi's guess
       lines: [{ id, contour, t, t0 = 0, a = 1, ghost = false, head = 1, glow = 0, glowFrom, glowTo }]
                                                 a voice's violet line, its take drawn from t0 to t (take
                                                 time); ghost: 35 % violet; head: the dot's alpha (r 7,
                                                 a 14 px glow); glow 0..1 lights the part from glowFrom to
                                                 glowTo seconds
       strip: { a = 1, hair = 1, envs: [{ id, contour, t, t0 = 0, a = 1, ghost = false, lit = 0, edge = 0 }] }
                                                 the level strip: violet 28 % fill (lit: to 40 %), 2 px
                                                 edges at 70 % (edge 0..1 brightens them, an accent);
                                                 ghost: outline only at 35 %; hair: the empty strip's ink
                                                 10 % hairline
     })
     ch.label(name, text?) -> an L.label at its HANDOFFS place in the chart group (made once)
     ch.tag(kind) -> an L.tag ('illustration', right-aligned to the plot's end, or 'listen', left-aligned
                        x 1536), centred y 140 (S1, S5)
     ch.bead(r = 30.8) -> an L.bead in the chart group (the long note's head bead, S1g)
     ch.lastLine(id) -> the world points the line was last drawn through (for the wave-rule check)
     ch.waveRule() -> { k, kRule, ratio, ok }   whether a voice's wave may be drawn at this geometry
     L.CHART.LABELS     name -> { text, x, y (baseline), size, anchor, weight, fill, family }: A3, inBand,
                        level, row, def, q, sungEasily, aboveBand, aboveBand5, louderHigher, alsoHigher,
                        mainlyLouder, smallType, anyOctave, inBand10, steady, guess10, scoop, vibrato,
                        fixedLength, the axis's "0", "4 s", "10 s"
     L.pushSlider(parent, { x0 = 400, x1 = 1520, y = 800, r = 16, value = { y: 776, size: 30 },
                  label = { x: 366, y: 811, size: 32 } }) -> { g, x(p), draw({ a, p, draw, thumbScale,
                  plan: { up, hold, back, a } }) }   S5's Push slider (x(p) = x0 + (x1 - x0) p / 100, its
                  value riding over the thumb); 10h's: L.CHART.SLIDER10H
     L.timeAxis(parent, { x0 = 400, x1 = 1520, y = 497, tick = 8, labelY = 523, zeroX = x0 - 12 }) -> { g, draw({ a, W,
                  x0, x1, swap }) }   a tick each second, "0" and "<W> s" right-aligned to the plot's end;
                  ticks beyond the window are hidden, so widening it brings ticks in at the right end
     L.settledFlag(parent) -> { g, label, draw({ x, y, a, scale, labelA = 1 }) }   the chrome "settled" flag (16 tall, on the
                  band's top edge) and its label (Outfit 600 26, centred over it, baseline y - 23)
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp

  /* ---------------------------------------------------------------- contours (FACTS 80) */
  const VIB = { hz: 5.5, cents: 14, grow: 0.35 }
  const vib = (t, t0) => (t0 == null || t < t0 ? 0 : VIB.cents * Math.min(1, (t - t0) / VIB.grow) * Math.sin(2 * Math.PI * VIB.hz * (t - t0)))
  const smooth = (u) => u * u * (3 - 2 * u)
  const RISE = [[0, -60], [0.18, -38], [0.34, -52], [0.5, -22], [0.66, -38], [0.8, -10], [0.9, 0]]
  const demoRise = (t) => {
    if (t >= 0.9) return 0
    for (let i = 1; i < RISE.length; i++) {
      const [t1, c1] = RISE[i]
      if (t > t1) continue
      const [t0, c0] = RISE[i - 1]
      return c0 + (c1 - c0) * smooth((Math.max(t, t0) - t0) / (t1 - t0))
    }
    return 0
  }
  const make = (len, cents, db, vib0) => ({
    len, cents, db, vib0,
    c: (t) => cents(t) + vib(t, vib0),
    level: (t) => 28 * Math.pow(10, db(t) / 20),
  })
  const takeCents = (pushed) => (t) => {
    if (t < 0.5) return -40 * (1 - Math.max(0, t) / 0.5)
    if (!pushed || t <= 1) return 0
    return 60 * Math.min(1, (t - 1) / 3)
  }
  const takeDb = (pushed) => (t) => (!pushed || t <= 1 ? 0 : 6 * Math.min(1, (t - 1) / 3))
  const pushAt = (t) => {
    if (t <= 0.6) return 50
    if (t <= 2.1) return 50 + 50 * (t - 0.6) / 1.5
    if (t <= 3.6) return 100
    if (t <= 4.8) return 100 - 50 * (t - 3.6) / 1.2
    return 50
  }
  L.CONTOUR = {
    VIB, vib, pushAt,
    pushCents: (p) => (p - 50) * 1.2,
    pushDb: (p) => (p - 50) * 0.12,
    easy: make(4, takeCents(false), takeDb(false), 0.5),
    pushed: make(4, takeCents(true), takeDb(true), 0.5),
    push: make(5.6, (t) => (pushAt(t) - 50) * 1.2, (t) => (pushAt(t) - 50) * 0.12, 0),
    demo: (() => {
      const c = (t) => (t < 0.9 ? demoRise(t) : vib(t, 0.9))
      return { len: 10, cents: (t) => (t < 0.9 ? demoRise(t) : 0), db: () => 0, vib0: null, c, level: () => 28 }
    })(),
    from: (cents, db = () => 0, vib0 = 0) => make(Infinity, cents, db, vib0),
  }
  const contourOf = (c) => (typeof c === 'string' ? L.CONTOUR[c] : c)
  // The page's "settled" rule (FACTS 80; DECISIONS 191, 214): read the drawn line every 16 ms; it has settled from the
  // first reading from which it stays within 35 cents for 0.5 s. Returns the entry (the take's own time of that reading)
  // and the moment it has settled (entry + 0.5), or nulls if it never does.
  L.settled = (contour, { step = 0.016, band = 35, hold = 0.5 } = {}) => {
    const c = contourOf(contour)
    const inBand = (tt) => Math.abs(c.c(tt)) <= band
    for (let i = 0; i * step <= c.len - hold; i++) {
      let ok = true
      for (let j = 0; j * step <= hold; j++) if (!inBand(i * step + j * step)) { ok = false; break }
      if (ok) return { entry: i * step, settled: i * step + hold }
    }
    return { entry: null, settled: null }
  }
  L.waveK = (W, Lpx = 1120) => (10 * Lpx) / (1120 * W)

  /* ---------------------------------------------------------------- places and labels */
  L.CHART = {
    S1: { x0: 400, x1: 1520, y0: 400, W: 4, strip: 690 },
    S5: { x0: 400, x1: 1520, y0: 400, W: 6, strip: 690 },
    S7: { x0: 400, x1: 1520, y0: 470, W: 4, strip: 700 },
    S10: { x0: 400, x1: 1520, y0: 400, W: 10, strip: null },
    FRAME: { x0: 1000, x1: 1640, y0: 245, W: 10, k: 1.0, strip: null },
    RECAP: { x0: 232, x1: 1688, y0: 600, W: 10, k: 1.3, strip: null },
    AT078: { s: 0.78, dx: 154, dy: 99 },
    MINI1: { s: 0.41, dx: 1180 - 0.41 * 400, dy: 310 - 0.41 * 470 },
    SLIDER10H: { x0: 1000, x1: 1640, y: 380, r: 14, value: { y: 358, size: 26 }, label: { x: 985, y: 390, size: 30 } },
    LABELS: {
      A3: { text: 'A3', x: 366, y: 417, size: 48, anchor: 'end' },
      inBand: { text: 'in the band', x: 366, y: 470, size: 30, anchor: 'end' },
      level: { text: 'level', x: 400, y: 778, size: 32, fill: C.ink2 },
      row: { text: 'in the band: within 35 cents (Lesson 3)', x: 400, y: 150, size: 34, weight: 500 },
      def: { text: 'pressure: how hard your breath pushes on your vocal folds', x: 400, y: 200, size: 34 },
      q: { text: '?', x: 1536, y: 423, size: 64, fill: C.ink2 },
      sungEasily: { text: 'sung easily', x: 1536, y: 470, size: 36 },
      aboveBand: { text: 'above the band', x: 1536, y: 262, size: 36 },
      aboveBand5: { text: 'above the band', x: 1536, y: 300, size: 36 },
      louderHigher: { text: 'louder · higher', x: 420, y: 268, size: 56 },
      alsoHigher: { text: 'also: a little higher', x: 420, y: 310, size: 36 },
      mainlyLouder: { text: 'mainly: louder', x: 420, y: 600, size: 36 },
      smallType: { text: 'Both lines are drawings of that rule, not recordings.', x: 1520, y: 812, size: 34, family: 'inter', weight: 400, fill: C.ink2, anchor: 'end' },
      anyOctave: { text: 'A, any octave', x: 400, y: 290, size: 30 },
      inBand10: { text: 'in the band', x: 640, y: 290, size: 30 },
      steady: { text: 'steady: settles into the band and stays', x: 400, y: 240, size: 30 },
      guess10: { text: 'steady air keeps it there?', x: 400, y: 190, size: 40, fill: C.ink2 },
      scoop: { text: 'scoop', x: 400, y: 500, size: 30, anchor: 'middle' },
      vibrato: { text: 'small vibrato: inside the band', x: 960, y: 342, size: 30 },
      fixedLength: { text: 'a comfortable, fixed length', x: 960, y: 577, size: 30, anchor: 'middle' },
    },
  }

  /* ---------------------------------------------------------------- the chart */
  L.bandChart = (svg, opts = {}) => {
    const G = { x0: 400, x1: 1520, y0: 400, W: 4, k: null, strip: 690, ...opts }
    if (G.k == null) G.k = L.waveK(G.W, G.x1 - G.x0)
    const id = L.uid('chart')
    const root = L.svg('g', { class: 'band-chart' }, svg)
    const g = L.svg('g', {}, root)
    const defs = L.svg('defs', {}, g)
    const dotGrad = L.svg('radialGradient', { id: id + '-dot' }, defs)
    L.svg('stop', { offset: 0, 'stop-color': C.violet, 'stop-opacity': 0.6 }, dotGrad)
    L.svg('stop', { offset: 1, 'stop-color': C.violet, 'stop-opacity': 0 }, dotGrad)
    const blur = L.svg('filter', { id: id + '-blur', x: '-20%', y: '-200%', width: '140%', height: '500%' }, defs)
    L.svg('feGaussianBlur', { stdDeviation: 3 }, blur)

    const gStrip = L.svg('g', { class: 'strip' }, g)
    const hair = L.svg('rect', { height: 1, fill: C.ink, 'fill-opacity': 0.1 }, gStrip)
    const gBand = L.svg('g', { class: 'band' }, g)
    const bandFill = L.svg('rect', { fill: C.amber, 'fill-opacity': 0.12 }, gBand)
    const edgeT = L.svg('rect', { height: 2, fill: C.amber, 'fill-opacity': 0.45 }, gBand)
    const edgeB = L.svg('rect', { height: 2, fill: C.amber, 'fill-opacity': 0.45 }, gBand)
    const litG = L.svg('g', { opacity: 0 }, gBand)
    const litGlowT = L.svg('rect', { height: 6, fill: C.mint, 'fill-opacity': 0.4, filter: `url(#${id}-blur)` }, litG)
    const litGlowB = L.svg('rect', { height: 6, fill: C.mint, 'fill-opacity': 0.4, filter: `url(#${id}-blur)` }, litG)
    const litT = L.svg('rect', { height: 3, fill: C.mint }, litG)
    const litB = L.svg('rect', { height: 3, fill: C.mint }, litG)
    const merc = L.glowPath(g, { color: C.amber, width: 4, glow: 10, glowA: 0.2, cap: 'butt' })
    const gLines = L.svg('g', { class: 'lines' }, g)
    const gLabels = L.svg('g', { class: 'labels' }, g)
    const lines = new Map(), envs = new Map(), labels = new Map(), last = new Map()

    const ch = {
      root, g, gLabels, G, merc,
      geo(o) {
        Object.assign(G, o)
        if (o.k == null && (o.W != null || o.x0 != null || o.x1 != null)) G.k = L.waveK(G.W, G.x1 - G.x0)
        return ch
      },
      x: (t) => G.x0 + ((G.x1 - G.x0) * t) / G.W,
      y: (c) => G.y0 - G.k * c,
      band: () => ({ top: G.y0 - 35 * G.k, bot: G.y0 + 35 * G.k }),
      place({ s = 1, dx = 0, dy = 0 } = {}) {
        if (s === 1 && !dx && !dy) root.removeAttribute('transform')
        else root.setAttribute('transform', `matrix(${s.toFixed(5)} 0 0 ${s.toFixed(5)} ${f2(dx)} ${f2(dy)})`)
      },
      label(name, text = null, extra = {}) {
        if (!labels.has(name)) {
          const d = { ...(L.CHART.LABELS[name] || {}), ...extra }
          labels.set(name, L.label(gLabels, text ?? d.text ?? name, d))
        }
        return labels.get(name)
      },
      tag(kind = 'illustration') {
        const key = 'tag-' + kind
        if (!labels.has(key)) {
          labels.set(key, kind === 'listen'
            ? L.tag(gLabels, L.TAGS.listen, { x: 1536, y: 140, anchor: 'start' })
            : L.tag(gLabels, L.TAGS.illustration, { x: G.x1, y: 140, anchor: 'end' }))
        }
        return labels.get(key)
      },
      bead(r = 30.8) {
        if (!labels.has('bead')) labels.set('bead', L.bead(gLabels, { r, color: C.chrome }))
        return labels.get('bead')
      },
      lastLine: (lid) => last.get(lid) || [],
      // the wave rule at this geometry (HANDOFFS § The wave rule): a voice's wave keeps its 1.375 ratio only
      // where k is the rule's k; where ok is false, draw no voice line (the recap's slide starts at F-turn's
      // pixels, k 1.4 against the rule's 0.8: only Merc's line shows there, critic-kit-01 item 10)
      waveRule() { const kRule = L.waveK(G.W, G.x1 - G.x0); return { k: G.k, kRule, ratio: G.k / kRule, ok: Math.abs(G.k / kRule - 1) <= 0.05 } },
    }

    const linePath = (con, t0, t1) => {
      const pts = []
      const span = (G.x1 - G.x0) / G.W           // px a second
      const dt = 1 / Math.max(1, span)           // about 1 px a sample
      for (let tt = t0; tt < t1; tt += dt) pts.push([ch.x(tt), ch.y(con.c(tt))])
      pts.push([ch.x(t1), ch.y(con.c(t1))])
      return pts
    }
    const dOf = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('')

    const getLine = (lid) => {
      if (!lines.has(lid)) {
        const lg = L.svg('g', {}, gLines)
        const glowP = L.svg('path', { fill: 'none', stroke: C.violet, 'stroke-width': 12, 'stroke-opacity': 0, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: `url(#${id}-blur)` }, lg)
        const path = L.svg('path', { fill: 'none', stroke: C.violet, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, lg)
        const halo = L.svg('circle', { r: 14, fill: `url(#${id}-dot)` }, lg)
        const dot = L.svg('circle', { r: 7, fill: C.violet }, lg)
        lines.set(lid, { lg, path, glowP, halo, dot })
      }
      return lines.get(lid)
    }
    const getEnv = (eid) => {
      if (!envs.has(eid)) {
        const eg = L.svg('g', {}, gStrip)
        const fill = L.svg('path', { fill: C.violet, 'fill-opacity': 0.28, stroke: 'none' }, eg)
        const edge = L.svg('path', { fill: 'none', stroke: C.violet, 'stroke-width': 2, 'stroke-opacity': 0.7, 'stroke-linejoin': 'round' }, eg)
        envs.set(eid, { eg, fill, edge })
      }
      return envs.get(eid)
    }

    ch.draw = ({ a = 1, band = {}, merc: mm = {}, lines: ls = [], strip = {} } = {}) => {
      g.setAttribute('opacity', clamp(a).toFixed(3))
      const { top, bot } = ch.band()
      const W = G.x1 - G.x0
      // the band
      const ba = band.a ?? 1
      gBand.setAttribute('opacity', ba.toFixed(3))
      bandFill.setAttribute('x', f2(G.x0)); bandFill.setAttribute('width', f2(W))
      bandFill.setAttribute('y', f2(top)); bandFill.setAttribute('height', f2(bot - top))
      bandFill.setAttribute('fill-opacity', (band.fill ?? 0.12).toFixed(3))
      for (const [el, y] of [[edgeT, top - 1], [edgeB, bot - 1], [litT, top - 1.5], [litB, bot - 1.5], [litGlowT, top - 3], [litGlowB, bot - 3]]) {
        el.setAttribute('x', f2(G.x0)); el.setAttribute('width', f2(W)); el.setAttribute('y', f2(y))
      }
      litG.setAttribute('opacity', clamp(band.lit ?? 0).toFixed(3))
      // Merc's line
      const md = clamp(mm.draw ?? 1)
      merc.set(`M${f2(G.x0)} ${f2(G.y0)}L${f2(G.x0 + W * md)} ${f2(G.y0)}`)
      merc.g.setAttribute('opacity', (md > 0.001 ? (mm.a ?? 1) * (1 - (mm.dim ?? 0)) : 0).toFixed(3))
      merc.glowPath.setAttribute('stroke-opacity', (0.2 + 0.3 * (mm.glow ?? 0)).toFixed(3))
      // its weight in world px (4); the hook gives 4 / s so the line keeps Lesson 4's 4 px on screen at F-hook
      const mw = mm.w ?? 4
      merc.path.setAttribute('stroke-width', f2(mw)); merc.glowPath.setAttribute('stroke-width', f2(2.5 * mw))
      // the strip
      const sa = G.strip == null ? 0 : strip.a ?? 1
      gStrip.setAttribute('opacity', sa.toFixed(3))
      if (G.strip != null) {
        hair.setAttribute('x', f2(G.x0)); hair.setAttribute('width', f2(W)); hair.setAttribute('y', f2(G.strip - 0.5))
        hair.setAttribute('opacity', (strip.hair ?? 1).toFixed(3))
        const seen = new Set()
        for (const e of strip.envs || []) {
          const con = contourOf(e.contour)
          const E = getEnv(e.id || e.contour)
          seen.add(e.id || e.contour)
          const t0 = e.t0 ?? 0, t1 = Math.min(e.t ?? con.len, con.len)
          if (t1 <= t0 || (e.a ?? 1) <= 0.004) { E.eg.setAttribute('opacity', '0'); continue }
          const n = Math.max(2, Math.ceil(((t1 - t0) * W) / G.W / 2))
          const up = [], dn = []
          for (let i = 0; i <= n; i++) {
            const tt = t0 + ((t1 - t0) * i) / n, h = con.level(tt)
            up.push([ch.x(tt), G.strip - h]); dn.push([ch.x(tt), G.strip + h])
          }
          const outline = dOf(up) + dOf(dn.slice().reverse()).replace(/^M/, 'L') + 'Z'
          E.fill.setAttribute('d', outline)
          E.edge.setAttribute('d', outline)
          E.eg.setAttribute('opacity', (e.a ?? 1).toFixed(3))
          const ghost = e.ghost ? 1 : 0
          E.fill.setAttribute('fill-opacity', ghost ? '0' : (0.28 + 0.12 * clamp(e.lit ?? 0)).toFixed(3))
          E.edge.setAttribute('stroke-opacity', ghost ? '0.35' : Math.min(1, 0.7 + 0.3 * (e.edge ?? 0)).toFixed(3))
          E.edge.setAttribute('stroke-width', (2 + 1.5 * (e.edge ?? 0)).toFixed(2))
        }
        for (const [k, E] of envs) if (!seen.has(k)) E.eg.setAttribute('opacity', '0')
      }
      // the voices' lines
      const seen = new Set()
      for (const l of ls) {
        const con = contourOf(l.contour)
        const lid = l.id || l.contour
        const Ln = getLine(lid)
        seen.add(lid)
        const t0 = l.t0 ?? 0, t1 = Math.min(l.t ?? con.len, con.len)
        if (t1 <= t0 || (l.a ?? 1) <= 0.004) { Ln.lg.setAttribute('opacity', '0'); continue }
        const pts = linePath(con, t0, t1)
        last.set(lid, pts)
        Ln.path.setAttribute('d', dOf(pts))
        Ln.path.setAttribute('stroke-opacity', l.ghost ? '0.35' : '1')
        Ln.lg.setAttribute('opacity', (l.a ?? 1).toFixed(3))
        const gl = clamp(l.glow ?? 0)
        if (gl > 0.004) {
          const gp = linePath(con, Math.max(t0, l.glowFrom ?? t0), Math.min(t1, l.glowTo ?? t1))
          Ln.glowP.setAttribute('d', dOf(gp))
          Ln.glowP.setAttribute('stroke-opacity', (0.55 * gl).toFixed(3))
        } else Ln.glowP.setAttribute('stroke-opacity', '0')
        const hp = pts[pts.length - 1]
        for (const el of [Ln.halo, Ln.dot]) { el.setAttribute('cx', f2(hp[0])); el.setAttribute('cy', f2(hp[1])) }
        const ha = clamp(l.head ?? 1)
        Ln.halo.setAttribute('opacity', ha.toFixed(3)); Ln.dot.setAttribute('opacity', ha.toFixed(3))
      }
      for (const [k, Ln] of lines) if (!seen.has(k)) Ln.lg.setAttribute('opacity', '0')
    }
    return ch
  }

  /* ---------------------------------------------------------------- the Push slider */
  L.pushSlider = (parent, { x0 = 400, x1 = 1520, y = 800, r = 16, value = { y: 776, size: 30 }, label = { x: 366, y: 811, size: 32 } } = {}) => {
    const g = L.svg('g', { class: 'push-slider', opacity: 0 }, parent)
    const track = L.svg('rect', { x: x0, y: y - 2, height: 4, width: x1 - x0, rx: 2, fill: C.chrome, 'fill-opacity': 0.5 }, g)
    const plan = L.svg('g', { opacity: 0 }, g)
    const pUp = L.arrow(plan, { x1: x0 + (x1 - x0) / 2, y1: y - 30, x2: x1, y2: y - 30, color: C.chrome, width: 3, head: 10, opacity: 0.4 })
    const pHold = L.svg('rect', { x: x1 - 2, y: y - 40, width: 4, height: 20, fill: C.chrome, 'fill-opacity': 0.4, opacity: 0 }, plan)
    const pBack = L.arrow(plan, { x1: x1, y1: y - 22, x2: x0 + (x1 - x0) / 2, y2: y - 22, color: C.chrome, width: 3, head: 10, opacity: 0.4 })
    const thumbG = L.svg('g', {}, g)
    const thumb = L.svg('circle', { r, fill: C.chrome }, thumbG)
    const val = L.text(g, '50', { x: 0, y: value.y, size: value.size, anchor: 'middle', tabular: true, opacity: 1 })
    const lab = L.text(g, 'Push', { x: label.x, y: label.y, size: label.size, anchor: 'end', opacity: 1 })
    const X = (p) => x0 + ((x1 - x0) * p) / 100
    return {
      g, track, thumb, val, lab, x: X,
      draw({ a = 1, p = 50, draw = 1, thumbScale = 1, plan: pl = null } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        const d = clamp(draw)
        track.setAttribute('width', f2((x1 - x0) * d))
        const tx = X(p)
        thumbG.setAttribute('transform', `translate(${f2(tx)} ${y}) scale(${thumbScale.toFixed(4)})`)
        thumbG.setAttribute('opacity', d >= 1 ? '1' : L.smooth(0.85, 1, d).toFixed(3))
        val.setAttribute('x', f2(tx))
        val.textContent = String(Math.round(p))
        val.setAttribute('opacity', d >= 1 ? '1' : L.smooth(0.85, 1, d).toFixed(3))
        lab.setAttribute('opacity', d > 0 ? '1' : '0')
        if (pl) {
          plan.setAttribute('opacity', clamp(pl.a ?? 1).toFixed(3))
          pUp.draw(pl.up ?? 0, 1)
          pHold.setAttribute('opacity', clamp(pl.hold ?? 0).toFixed(3))
          pBack.draw(pl.back ?? 0, 1)
        } else plan.setAttribute('opacity', '0')
      },
    }
  }

  /* ---------------------------------------------------------------- the time axis and the settled flag */
  L.timeAxis = (parent, { x0 = 400, x1 = 1520, y = 497, tick = 8, labelY = 523, size = 30, max = 10, zeroX = null } = {}) => {
    const g = L.svg('g', { class: 'time-axis', opacity: 0 }, parent)
    const ticks = []
    for (let i = 0; i <= max; i++) ticks.push(L.svg('rect', { y, width: 2, height: tick, fill: C.chrome, 'fill-opacity': 0.6 }, g))
    // "0" right-aligned 12 px left of the plot's start, on the row's baseline: a take starting under the band
    // (S1's easy and pushed takes at -40 cents, y 500) leaves from just over x 400, where the board's "0" (x 400,
    // left-aligned) sat 2 px under its tail (critic-kit-01 item 11); here it clears it by 12 px
    const zero = L.text(g, '0', { x: zeroX ?? x0 - 12, y: labelY, size, fill: C.ink2, anchor: 'end', opacity: 1 })
    const ends = new Map()
    const end = (W) => {
      const key = `${Math.round(W)} s`
      if (!ends.has(key)) ends.set(key, L.text(g, key, { x: x1, y: labelY, size, fill: C.ink2, anchor: 'end', opacity: 0 }))
      return ends.get(key)
    }
    return {
      g, end,
      draw({ a = 1, W = 4, X0 = x0, X1 = x1, swap = null } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        ticks.forEach((tk, i) => {
          const x = X0 + ((X1 - X0) * i) / W
          const inside = x <= X1 + 0.5
          tk.setAttribute('x', f2(x - 1))
          tk.setAttribute('opacity', inside ? L.smooth(X1 + 0.5, X1 - 12, x).toFixed(3) : '0')
        })
        zero.setAttribute('x', f2(zeroX != null ? zeroX + (X0 - x0) : X0 - 12))
        // the end label: "<from> s" switching to "<to> s" (swap: [{ text, a, dy }, ...] from L.swap)
        for (const [, el] of ends) el.setAttribute('opacity', '0')
        const list = swap || [{ text: `${Math.round(W)} s`, a: 1, dy: 0 }]
        for (const s of list) {
          const el = end(parseFloat(s.text))
          el.setAttribute('x', f2(X1))
          L.place(el, { a: s.a, dy: s.dy })
        }
      },
    }
  }
  L.settledFlag = (parent) => {
    const g = L.svg('g', { opacity: 0, class: 'settled' }, parent)
    const pole = L.svg('rect', { width: 2, height: 16, fill: C.chrome }, g)
    const flag = L.svg('path', { fill: C.chrome, 'fill-opacity': 0.85 }, g)
    const lab = L.text(g, 'settled', { size: 26, anchor: 'middle', opacity: 1 })
    return {
      g, label: lab,
      draw({ x = 477, y = 365, a = 1, scale = 1, labelA = 1 } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        pole.setAttribute('x', f2(x - 1)); pole.setAttribute('y', f2(y - 16))
        flag.setAttribute('d', `M${f2(x + 1)} ${f2(y - 16)} L${f2(x + 11)} ${f2(y - 12)} L${f2(x + 1)} ${f2(y - 8)} Z`)
        lab.setAttribute('x', f2(x)); lab.setAttribute('y', f2(y - 23))
        lab.setAttribute('opacity', clamp(labelA).toFixed(3))
        g.setAttribute('transform', scale !== 1 ? `translate(${f2(x)} ${f2(y)}) scale(${scale.toFixed(4)}) translate(${f2(-x)} ${f2(-y)})` : '')
      },
    }
  }
})()
