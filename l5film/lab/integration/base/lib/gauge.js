/* Find Your Pitch, Lesson 5 kit: the gauge and Merc's small band (HANDOFFS § World, The gauge and Merc's
   small band (S6); § The cuts, S6 to S7). window.L, after chart.js. World px at F0; the push to F-gauge
   moves the mid layer, not these numbers.

     L.GAUGE            the geometry: SMALL { x0 760, x1 1640, y0 160, y1 240, line 200 }, FRAME { x0 760,
                        x1 1640, y0 290, y1 720, r 8 }, x(t) = 760 + 88 t (t 0 to 10 s), lungs(t) = 340 + 38 t,
                        GOLD { quiet: 606, loud: 454 }, cross(gold) (7 s and 3 s), STRIP { y 690, box y 630 to
                        750 }, FROM078 (the chart at 0.78: band x 466 to 1340, y 365.5 to 456.5, line 411,
                        strip 637), LABELS (every label HANDOFFS places, by name, with its time role), CHIPS
                        (Quiet and Loud, from x 1653), TAG (the gauge's "ILLUSTRATION", right-aligned 1630, centred y 320, opaque), BACKS,
                        PREDICT (the frame-fixed "PREDICT" and its two pills, the ring timer)
     L.GAUGE.split(u)   the split (6b, provisional: the lab decides the curves) as one move, u 0..1 over
                        110.90 to 112.40 (the scene eases nothing: the curves are inside): the band rises
                        (power2.out over u 0 to 0.6) before it slides right (power2.inOut over u 0.35 to 1),
                        so its foot is above y 288 before its right end passes x 1347 and it clears the
                        chip by 12 px or more; the strip slides down and right (power2.inOut). Returns
                        { band: { x0, x1, y0, y1, line, lw }, strip: { x0, x1, y } }
     const ga = L.gauge(svg)
     ga.place({ s, dx, dy })   an object move of the whole gauge (7a: L.MIXUP.CUT keeps F-gauge's pixels at F0)
     ga.draw({
       band: { x0, x1, y0, y1, line, lw = 3, a = 1, lineA = 1, lineTo = null, fade = 0 },
                        Merc's band (amber 12 %, its 2 px edges at 45 %) and his line; lineTo: x the line is
                        drawn to (behind the cursor), null for the whole band
       strip: { x0, x1, y, h = 0, draw = 1, a = 1 },
                        the level strip on its own (the chart's, carried through the split): an even envelope
                        of half-height h drawn on to `draw`, and its hairline
       open = 0,        0..1 the strip's box (y 630 to 750) opening to the frame's (290 to 720), the frame's
                        chrome outline and its axis drawing as it opens (6e); 1 is the gauge
       frameA = 1,      the frame's own alpha (it folds back in 7a with open going 1 to 0)
       cursor = null,   the cursor's time, 0..10 s, or null (hidden); `cursorA` its alpha
       drawn = 0,       how far, in seconds, the lungs' line and the hatches have drawn behind it
       gold = 606,      the gold line's y (606 Quiet, 454 Loud; tween it for 172.06 to 172.86)
       goldDraw = 0,    0..1 the gold line drawn across the whole frame (131.25 to 131.85)
       hatch = 0,       0..1 the hatches' alpha; heldLit, addedLit 0..1: a region lit (the hatch to 60 %
                        and a 16 % chrome fill under it: a counted light)
       lungsA = 1, lungsGlow = 0 (0..1 a light running down the falling line: { u, a } from L.run)
     })
     The labels, chips, readout and tag are the scene's (L.label, L.chip, L.swap, L.tag) at L.GAUGE's places.
     The cursor passes behind the labels in L.GAUGE.BACKS and the tag: draw those after the gauge, with
     L.label's `back: true` and the tag `opaque` (TAG has it), so the cursor never shows through them. The
     readout switches from "Now: holding back" to "Now: adding" (readoutAdding) with L.swap as the cursor
     crosses the gold line (G.cross(gold) seconds), and "added" lands inside its hatch at that moment.
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp
  const lerp = L.lerp

  const G = {
    SMALL: { x0: 760, x1: 1640, y0: 160, y1: 240, line: 200 },
    FRAME: { x0: 760, x1: 1640, y0: 290, y1: 720, r: 8 },
    x: (t) => 760 + 88 * t,
    lungs: (t) => 340 + 38 * t,
    GOLD: { quiet: 606, loud: 454 },
    cross: (gold) => (gold - 340) / 38,
    STRIP: { y: 690, box: [630, 750] },
    FROM078: { band: { x0: 466, x1: 1340, y0: 365.5, y1: 456.5, line: 411, lw: 3.12 }, strip: { x0: 466, x1: 1340, y: 637.2 } },
    LABELS: {
      A3: { text: 'A3', x: 740, y: 212, size: 36, anchor: 'end' },
      unchanged: { text: 'the note: unchanged', x: 760, y: 140, size: 30 },
      pushOfAir: { text: 'push of air (not pitch)', x: 790, y: 275, size: 30 },
      oneNote: { text: 'one 10-second note', x: 760, y: 760, size: 30, weight: 500, fill: C.ink2 },
      lungsPush: { text: "the lungs' own push", x: 776, y: 325, size: 30 },
      needs: { text: 'what the note needs', x: 776, y: 640, size: 30 },
      needsLoud: { text: 'what the note needs', x: 1630, y: 440, size: 30, anchor: 'end' },
      heldBack: { text: 'held back', x: 860, y: 540, size: 34, anchor: 'middle' },
      // inside the added hatch, landing at the crossing (critic-kit-01 item 2; the lead's call): centred x 1560,
      // baseline 645, its glyphs 15 px under the gold line and 20 px over the lungs' line at their left end
      added: { text: 'added', x: 1560, y: 645, size: 30, anchor: 'middle' },
      readout: { text: 'Now: holding back', x: 1640, y: 275, size: 34, anchor: 'end' },
      readoutAdding: { text: 'Now: adding', x: 1640, y: 275, size: 34, anchor: 'end' },
      lessHolding: { text: 'less holding back at first', x: 760, y: 765, size: 30 },
      moreAdding: { text: 'more adding as the air runs low', x: 1640, y: 805, size: 30, anchor: 'end' },
    },
    LEADERS: {
      needs: null,
      added: null,
      lessHolding: { x1: 900, y1: 740, x2: 900, y2: 430 },
      moreAdding: { x1: 1500, y1: 780, x2: 1500, y2: 600 },
      upArrow: { x: 768, y: 275 },
    },
    // 12 screen px clear of the frame stroke's outer edge (1641) at F-gauge: 1641 + 12 / 1.05 (the lead's answer 5)
    CHIPS: { quiet: { text: 'Quiet', x: 1653, y: 320 }, loud: { text: 'Loud', x: 1653, y: 372 } },
    TAG: { x: 1630, y: 320, anchor: 'end', opaque: true },
    // the labels the cursor passes behind: give them L.label's opaque back ({ ...LABELS[n], back: true })
    BACKS: ['pushOfAir', 'lungsPush', 'needs', 'heldBack', 'added', 'readout', 'readoutAdding'],
    PREDICT: { kicker: { text: 'PREDICT', x: 760, y: 115 }, pills: [{ text: 'Push it out', x: 920, x1: 1150 }, { text: 'Hold it back', x: 1180, x1: 1420 }], y: 105, h: 48, ring: { x: 1470, y: 105 } },
  }
  L.GAUGE = G

  G.split = (u) => {
    const A = G.FROM078, B = G.SMALL
    const uy = L.ease('power2.out')(clamp(u / 0.6))
    const ux = L.ease('power2.inOut')(clamp((u - 0.35) / 0.65))
    const us = L.ease('power2.inOut')(clamp(u))
    return {
      band: { x0: lerp(A.band.x0, B.x0, ux), x1: lerp(A.band.x1, B.x1, ux), y0: lerp(A.band.y0, B.y0, uy), y1: lerp(A.band.y1, B.y1, uy), line: lerp(A.band.line, B.line, uy), lw: lerp(A.band.lw, 3, us) },
      strip: { x0: lerp(A.strip.x0, B.x0, us), x1: lerp(A.strip.x1, B.x1, us), y: lerp(A.strip.y, G.STRIP.y, us) },
    }
  }

  L.gauge = (svg) => {
    const id = L.uid('gauge')
    const g = L.svg('g', { class: 'gauge' }, svg)
    const defs = L.svg('defs', {}, g)
    const pat = (name, angle) => {
      const p = L.svg('pattern', { id: id + name, patternUnits: 'userSpaceOnUse', width: 10, height: 10, patternTransform: `rotate(${angle})` }, defs)
      return L.svg('rect', { x: 0, y: 0, width: 1.5, height: 10, fill: C.chrome, 'fill-opacity': 0.25 }, p)
    }
    const heldStroke = pat('-held', 45), addedStroke = pat('-added', 135)
    const blur = L.svg('filter', { id: id + '-blur', x: '-200%', y: '-10%', width: '500%', height: '120%' }, defs)
    L.svg('feGaussianBlur', { stdDeviation: 3 }, blur)

    // the small band
    const gBand = L.svg('g', {}, g)
    const bandFill = L.svg('rect', { fill: C.amber, 'fill-opacity': 0.12 }, gBand)
    const bandT = L.svg('rect', { height: 2, fill: C.amber, 'fill-opacity': 0.45 }, gBand)
    const bandB = L.svg('rect', { height: 2, fill: C.amber, 'fill-opacity': 0.45 }, gBand)
    const mline = L.glowPath(gBand, { color: C.amber, width: 3, glow: 8, glowA: 0.2, cap: 'butt' })
    // the strip
    const gStrip = L.svg('g', {}, g)
    const hair = L.svg('rect', { height: 1, fill: C.ink, 'fill-opacity': 0.1 }, gStrip)
    const env = L.svg('rect', { fill: C.violet, 'fill-opacity': 0.28, stroke: C.violet, 'stroke-opacity': 0.7, 'stroke-width': 2 }, gStrip)
    // the frame
    const gFrame = L.svg('g', {}, g)
    const held = L.svg('path', { fill: `url(#${id}-held)` }, gFrame)
    const heldLit = L.svg('path', { fill: C.chrome, 'fill-opacity': 0 }, gFrame)
    const added = L.svg('path', { fill: `url(#${id}-added)` }, gFrame)
    const addedLit = L.svg('path', { fill: C.chrome, 'fill-opacity': 0 }, gFrame)
    const frame = L.svg('rect', { fill: 'none', stroke: C.chrome, 'stroke-opacity': 0.3, 'stroke-width': 2, rx: G.FRAME.r }, gFrame)
    const axis = L.svg('g', {}, gFrame)
    const ticks = []
    for (let i = 0; i <= 10; i++) ticks.push(L.svg('rect', { x: G.x(i) - 1, y: G.FRAME.y1, width: 2, height: 8, fill: C.chrome, 'fill-opacity': 0.5 }, axis))
    const gold = L.svg('rect', { height: 3, fill: C.gold }, gFrame)
    const lungsG = L.svg('g', {}, gFrame)
    const lungs = L.svg('path', { fill: 'none', stroke: C.chrome, 'stroke-width': 3, 'stroke-linecap': 'round' }, lungsG)
    const lungsRun = L.svg('path', { fill: 'none', stroke: '#ffffff', 'stroke-width': 6, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '0.14 1', opacity: 0, filter: `url(#${id}-blur)` }, lungsG)
    const cursorG = L.svg('g', { opacity: 0 }, g)
    const cursorGlow = L.svg('rect', { y: 160, height: 560, width: 9, fill: C.chrome, 'fill-opacity': 0.25, filter: `url(#${id}-blur)` }, cursorG)
    const cursor = L.svg('rect', { y: 160, height: 560, width: 3, fill: C.chrome }, cursorG)

    const regionPath = (t0, t1, goldY, above) => {
      // the band between the lungs' line and the gold one, from t0 to t1, where the lungs' line is above
      // gold (held back, t < cross) or under it (added)
      if (t1 <= t0) return ''
      const n = Math.max(2, Math.ceil((t1 - t0) * 8))
      const top = [], bot = []
      for (let i = 0; i <= n; i++) {
        const t = t0 + ((t1 - t0) * i) / n, yl = G.lungs(t)
        if (above) { top.push([G.x(t), yl]); bot.push([G.x(t), goldY]) } else { top.push([G.x(t), goldY]); bot.push([G.x(t), yl]) }
      }
      return 'M' + top.map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'L' + bot.reverse().map((p) => f2(p[0]) + ' ' + f2(p[1])).join('L') + 'Z'
    }

    return {
      g,
      // an object move of the whole gauge (7a draws it at F-gauge's pixels at F0: L.MIXUP.CUT)
      place({ s = 1, dx = 0, dy = 0 } = {}) {
        if (s === 1 && !dx && !dy) g.removeAttribute('transform')
        else g.setAttribute('transform', `matrix(${s.toFixed(5)} 0 0 ${s.toFixed(5)} ${f2(dx)} ${f2(dy)})`)
      },
      draw({ band = null, strip = null, open = 0, frameA = 1, cursor: cur = null, cursorA = 1, drawn = 0, gold: gy = G.GOLD.quiet, goldDraw = 0, hatch = 0, heldLit: hl = 0, addedLit: al = 0, lungsA = 1, lungsRun: run = null } = {}) {
        // the small band
        if (band) {
          gBand.setAttribute('opacity', clamp(band.a ?? 1).toFixed(3))
          const w = band.x1 - band.x0
          bandFill.setAttribute('x', f2(band.x0)); bandFill.setAttribute('width', f2(w)); bandFill.setAttribute('y', f2(band.y0)); bandFill.setAttribute('height', f2(band.y1 - band.y0))
          for (const [el, y] of [[bandT, band.y0 - 1], [bandB, band.y1 - 1]]) { el.setAttribute('x', f2(band.x0)); el.setAttribute('width', f2(w)); el.setAttribute('y', f2(y)) }
          const xe = band.lineTo == null ? band.x1 : Math.max(band.x0, Math.min(band.x1, band.lineTo))
          mline.set(`M${f2(band.x0)} ${f2(band.line)}L${f2(xe)} ${f2(band.line)}`)
          mline.path.setAttribute('stroke-width', f2(band.lw ?? 3))
          mline.g.setAttribute('opacity', (xe > band.x0 + 0.5 ? clamp(band.lineA ?? 1) : 0).toFixed(3))
        } else gBand.setAttribute('opacity', '0')
        // the strip, and the frame opening out of its box
        const box = { y0: lerp(G.STRIP.box[0], G.FRAME.y0, L.ease('power2.inOut')(clamp(open))), y1: lerp(G.STRIP.box[1], G.FRAME.y1, L.ease('power2.inOut')(clamp(open))) }
        if (strip) {
          gStrip.setAttribute('opacity', clamp((strip.a ?? 1) * (1 - L.smooth(0, 0.6, open))).toFixed(3))
          const w = strip.x1 - strip.x0
          hair.setAttribute('x', f2(strip.x0)); hair.setAttribute('width', f2(w)); hair.setAttribute('y', f2(strip.y - 0.5))
          const h = strip.h || 0, d = clamp(strip.draw ?? 1)
          env.setAttribute('x', f2(strip.x0)); env.setAttribute('width', f2(w * d)); env.setAttribute('y', f2(strip.y - h)); env.setAttribute('height', f2(2 * h))
          env.setAttribute('opacity', h > 0.5 && d > 0 ? '1' : '0')
        } else gStrip.setAttribute('opacity', '0')
        const oa = clamp(L.smooth(0.05, 0.5, open) * frameA)
        gFrame.setAttribute('opacity', oa.toFixed(3))
        frame.setAttribute('x', G.FRAME.x0); frame.setAttribute('width', G.FRAME.x1 - G.FRAME.x0)
        frame.setAttribute('y', f2(box.y0)); frame.setAttribute('height', f2(box.y1 - box.y0))
        ticks.forEach((tk, i) => { tk.setAttribute('y', f2(box.y1)); tk.setAttribute('opacity', L.smooth(i / 12, i / 12 + 0.25, open).toFixed(3)) })
        // the gold line, the lungs' falling line and the two regions behind the cursor
        const gd = clamp(goldDraw)
        gold.setAttribute('x', G.FRAME.x0); gold.setAttribute('width', f2((G.FRAME.x1 - G.FRAME.x0) * gd)); gold.setAttribute('y', f2(gy - 1.5))
        gold.setAttribute('opacity', gd > 0 ? '1' : '0')
        const tc = G.cross(gy), dt = clamp(drawn, 0, 10)
        lungs.setAttribute('d', dt > 0.001 ? `M${G.x(0)} ${G.lungs(0)}L${f2(G.x(dt))} ${f2(G.lungs(dt))}` : '')
        lungsG.setAttribute('opacity', clamp(lungsA).toFixed(3))
        if (run && run.a > 0) {
          lungsRun.setAttribute('d', `M${G.x(0)} ${G.lungs(0)}L${G.x(10)} ${G.lungs(10)}`)
          lungsRun.setAttribute('stroke-dashoffset', f2(-(run.u * 1.14 - 0.14)))
          lungsRun.setAttribute('opacity', (0.8 * clamp(run.a)).toFixed(3))
        } else lungsRun.setAttribute('opacity', '0')
        const hd = regionPath(0, Math.min(dt, tc), gy, true), ad = regionPath(tc, dt, gy, false)
        held.setAttribute('d', hd); heldLit.setAttribute('d', hd)
        added.setAttribute('d', ad); addedLit.setAttribute('d', ad)
        for (const el of [held, added]) el.setAttribute('opacity', clamp(hatch).toFixed(3))
        heldStroke.setAttribute('fill-opacity', (0.25 + 0.35 * clamp(hl)).toFixed(3))
        addedStroke.setAttribute('fill-opacity', (0.25 + 0.35 * clamp(al)).toFixed(3))
        heldLit.setAttribute('fill-opacity', (0.16 * clamp(hl) * clamp(hatch)).toFixed(3))
        addedLit.setAttribute('fill-opacity', (0.16 * clamp(al) * clamp(hatch)).toFixed(3))
        // the cursor
        if (cur == null) cursorG.setAttribute('opacity', '0')
        else {
          const x = G.x(clamp(cur, 0, 10))
          cursor.setAttribute('x', f2(x - 1.5)); cursorGlow.setAttribute('x', f2(x - 4.5))
          cursorG.setAttribute('opacity', clamp(cursorA).toFixed(3))
        }
      },
    }
  }
})()
