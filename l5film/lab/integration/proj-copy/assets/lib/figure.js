/* Find Your Pitch, Lesson 5 kit: the breath figure (HANDOFFS § World, The breath figure). window.L,
   after marks.js. A standing body in side profile, facing right: one continuous outline (the head with a
   face in profile, the neck front and back, the back, chest, belly and hips, the near leg), the far leg as
   its own outline behind it, chrome strokes 3 px at k 1 (they scale with k), joins round, a faint opaque
   fill (the ground with 7 % ink) so it reads as a body and the far leg sits behind. Inside: the lungs, the
   ribs and the dome, the dome's ends joined to the inner side of the back and of the belly wall at every
   breath (redrawn for critic-kit-01 item 1; the old drawing is lab/kit-src/figure-v1.js.txt). Drawn in
   figure units (u, v): u 0 to 400 back to front, v 0 (crown) to 1000 (soles), placed by x = x0 + k u,
   y = y0 + k v; every anchor the board names keeps its figure units.

     L.FIGURE           the placements: S6 { k 1.15, x0 200, y0 120, fade [750, 780] } (the torso), CUT
                        (F-gauge's pixels at the S6 to S7 cut: k 1.2075, x0 150, y0 100.75), S7 (parked:
                        k 0.5, x0 140, y0 180, fade [450, 465], dimmed to 35 % by the scene), S8 (whole:
                        k 0.7, x0 830, y0 140), S13 (recap card 1: k 0.75, x0 1150, y0 90, fade [480, 495]);
                        PARTS, every part's figure units (HANDOFFS' table: head centre (230, 85) r 65,
                        chin (285, 140), neck u 200 and 250 v 150 to 215, throat (250, 190), shoulder
                        (175, 235), back u 150 v 230 to 560, chest front u 320 v 230 to 400, belly wall
                        u 330 v 420 to 560, hips v 560, ribs v 290, 340, 390, lungs (240, 335) 75 x 105,
                        dome apex v 435 with ends (155, 470) and (325, 470) on its curve, knee (235, 780),
                        ankle (220, 980), toe (300, 1000), heel (205, 1000))
     const fig = L.figure(svg)
     fig.draw({
       k, x0, y0,          the placement (tween them for an object move: 7a, 8b)
       a = 1,              the whole figure's opacity (dimmed: 0.35 parked, 0.25 under a card; its labels
                           are the scene's and hide while it is dim)
       draw = 1,           0..1 its outline draws on from the spine outward, up over the head and down
                           the legs, then the fill and the inside come up (6b)
       legs = 1,           0..1 the legs reveal down from the hips, v 560 to 1000 (8b; 0 in S6, S7, S13)
       fade = null,        [y0, y1] world y: everything below y1 hidden, fading from y0 (the masked legs)
       breath = 0,         -1..1: 1 breathing in (the dome flattens and lowers, apex v 477.5, ends v 485;
                           the belly wall bows to u 360 at v 490 and the dome's front end goes with it;
                           the lungs to ry 118, centre v 345); -1 breathing out (the belly wall in to
                           u 315 at v 490 as the belly and rib muscles push; the lungs to ry 95, centre
                           v 330; the dome at rest, rising: it never pushes). The bow eases in from the
                           chest's foot (v 380) and tucks back to the hips (v 560), upright at both ends,
                           so no corner opens under the ribs at either extreme
       lungFill = 0,       0..1 the lungs' outline fills (chrome 14 %)
       glow = {},          { ribs, dome, lungs, belly, neck, back } 0..1, a soft chrome glow on the part
       run = null,         { part: 'dome' | 'neck' | 'back', u, a } a light running along a part (L.run)
       knee = 0,           degrees the knee softens (8c: 2, and back): the knee goes forward, the feet stay
       jaw = 0,            world px the jaw drops (8c: 4): the lower lip and the chin go down, the head stays
     })
     fig.pt(u, v) -> [x, y]     a figure point at the last placement
     fig.at(name) -> [x, y]     a named anchor at the last placement and breath: head (centre), crown, chin,
                                throat, shoulder, lungs, domeApex, domeL, domeR, belly (its front at v 490),
                                back (u 150, v 400), hips (the belly wall's foot, u 330 v 560), knee, ankle,
                                toe, heel
     fig.shape()  -> the last drawn geometry in figure units (the probe's: the dome's ends and the walls)
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp
  const lerp = L.lerp

  L.FIGURE = {
    S6: { k: 1.15, x0: 200, y0: 120, fade: [750, 780] },
    CUT: { k: 1.2075, x0: 150, y0: 100.75, fade: [759.25, 790.75] },
    S7: { k: 0.5, x0: 140, y0: 180, fade: [450, 465] },
    S8: { k: 0.7, x0: 830, y0: 140, fade: null },
    S13: { k: 0.75, x0: 1150, y0: 90, fade: [480, 495] },
    PARTS: {
      head: [230, 85], headR: 65, chin: [285, 140], neckBack: 200, neckFront: 250, neckV: [150, 215],
      throat: [250, 190], shoulder: [175, 235], back: 150, backV: [230, 560], chest: 320, chestV: [230, 400],
      belly: 330, bellyV: [420, 560], hips: 560, ribs: [290, 340, 390], ribU: [160, 320], lungs: [240, 335, 75, 105],
      dome: { apex: 435, ends: [155, 325], endV: 470 }, knee: [235, 780], ankle: [220, 980], toe: [300, 1000], heel: [205, 1000],
    },
  }
  const P = L.FIGURE.PARTS
  const SW = 3                       // the stroke, figure units (3 px at k 1)
  const FILL = L.mixHex(C.ground, C.ink, 0.07), FILL_FAR = L.mixHex(C.ground, C.ink, 0.045)

  // a smooth path through points (uniform Catmull-Rom as cubic Beziers); a point [u, v, true] is a corner
  const spline = (pts, move = true) => {
    const q = (p) => `${f2(p[0])} ${f2(p[1])}`
    let d = move ? `M${q(pts[0])}` : `L${q(pts[0])}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1], p0 = pts[i - 1] || p1, p3 = pts[i + 2] || p2
      const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
      const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
      d += `C${q(c1)} ${q(c2)} ${q(p2)}`
    }
    return d
  }

  // the front from the chest's foot to the hips: at rest the chest (u 321 at v 340) eases out to the belly
  // wall (u 330 from v 420 to 560); breathing, the wall bows to bu at v 490, the bow easing in from v 380
  // (sin^2, upright at its top, so the chest's foot goes with it and no corner opens under the ribs) and
  // tucking back to the hips at v 560 (sin^2, upright at its foot)
  const restFront = (v) => (v >= 420 ? 330 : 321 + 9 * L.smooth(340, 420, v))
  const bow = (v) => (v <= 380 || v >= 560 ? 0 : v <= 490 ? Math.sin((Math.PI / 2) * ((v - 380) / 110)) ** 2 : Math.sin((Math.PI / 2) * ((560 - v) / 70)) ** 2)
  const bellyU = (bu, v) => restFront(v) + (bu - 330) * bow(v)
  const BELLY_V = [360, 380, 400, 420, 437.5, 455, 472.5, 490, 507.5, 525, 542.5, 560]

  const shapeOf = (b, kneeDeg, jawU) => {
    const bi = Math.max(0, b), bo = Math.max(0, -b)
    const bu = 330 + 30 * bi - 15 * bo                         // the belly's front at v 490
    const lungs = [240, 335 + 10 * bi - 5 * bo, 75, 105 + 13 * bi - 10 * bo]
    const apex = 435 + 42.5 * bi, endV = 470 + 15 * bi          // the dome (the board's quadratic, as a parabola)
    const a = (endV - apex) / (85 * 85)
    const domeV = (u) => apex + a * (u - 240) * (u - 240)
    // its ends on the walls' inner sides: the back at 150 + 1.5; the belly wall where the parabola meets it
    const uBack = P.back + SW / 2
    let uFront = 328
    for (let i = 0; i < 4; i++) uFront = bellyU(bu, domeV(uFront)) - SW / 2
    const kneeU = 110 * Math.sin((kneeDeg * Math.PI) / 180)
    const legDu = (v) => (v <= 560 ? 0 : v <= 780 ? (kneeU * (v - 560)) / 220 : (kneeU * (1000 - v)) / 220)
    return { b, bu, lungs, apex, endV, domeV, uBack, uFront, kneeU, legDu, jawU }
  }

  // the outline in two halves from the spine (u 150, v 400): up over the head and down the front to the
  // groin, and down the back of the near leg, round the foot and up its front to the groin
  const outlineOf = (s) => {
    const j = s.jawU
    const bellyPts = BELLY_V.map((v) => [bellyU(s.bu, v), v])
    const up = [
      [150, 400], [150, 330], [151, 272], [157, 249], [175, 235], [191, 223], [200, 206], [199, 172], [195, 151],
      [178, 130], [167, 102], [167, 70], [180, 42], [204, 25], [230, 20], [257, 25], [279, 41], [290, 58], [293, 68],
      [298, 79], [307, 89], [314, 98, true], [301, 106], [304, 113], [298, 119 + 0.5 * j], [302, 126 + j],
      [297, 135 + j], [285, 141 + j], [265, 148 + 0.5 * j], [253, 160], [250, 190], [251, 215], [264, 228],
      [292, 240], [314, 257], [320, 285], [321, 340], ...bellyPts,
      [327, 573], [318, 590],
    ]
    const down = [
      [150, 400], [150, 470], [151, 530], [150, 560], [146, 588], [147, 624], [160, 662], [181, 704], [201, 752],
      [212, 790], [205, 822], [197, 862], [200, 910], [208, 954], [203, 979], [196, 993], [205, 1000, true],
      [300, 1000, true], [306, 994], [297, 985], [264, 972], [245, 958], [246, 902], [252, 832], [258, 792],
      [262, 770], [275, 720], [296, 662], [312, 615], [318, 590],
    ].map(([u, v, c]) => [u + s.legDu(v), v, c])
    const far = [
      [147, 624], [160, 662], [181, 704], [201, 752], [212, 790], [205, 822], [197, 862], [200, 910], [208, 954],
      [203, 979], [196, 993], [205, 1000, true], [300, 1000, true], [306, 994], [297, 985], [264, 972], [245, 958],
      [246, 902], [252, 832], [258, 792], [262, 770], [275, 720], [296, 662], [312, 615], [318, 590],
    ].map(([u, v, c]) => [u - (44 * (v - 590)) / 410 + s.legDu(v), v, c])
    return { up, down, far }
  }

  L.figure = (svg) => {
    const id = L.uid('fig')
    const outer = L.svg('g', { class: 'breath-figure', opacity: 0 }, svg)
    const defs = L.svg('defs', {}, outer)
    const blur = L.svg('filter', { id: id + '-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs)
    L.svg('feGaussianBlur', { stdDeviation: 6 }, blur)
    // the world-y fade (masked legs) and the legs' reveal, both in figure units inside the placement
    const fadeMask = L.svg('mask', { id: id + '-fade', maskUnits: 'userSpaceOnUse', x: -1000, y: -1000, width: 3000, height: 3200 }, defs)
    const fadeGrad = L.svg('linearGradient', { id: id + '-fg', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: 2000, y2: 2001 }, defs)
    L.svg('stop', { offset: 0, 'stop-color': '#fff' }, fadeGrad)
    L.svg('stop', { offset: 1, 'stop-color': '#000' }, fadeGrad)
    L.svg('rect', { x: -1000, y: -1000, width: 3000, height: 3200, fill: `url(#${id}-fg)` }, fadeMask)
    const legMask = L.svg('mask', { id: id + '-legs', maskUnits: 'userSpaceOnUse', x: -1000, y: -1000, width: 3000, height: 3200 }, defs)
    const legRect = L.svg('rect', { x: -1000, y: -1000, width: 3000, height: 1560, fill: '#fff' }, legMask)
    const clip = L.svg('clipPath', { id: id + '-body' }, defs)
    const clipPath = L.svg('path', {}, clip)

    const place = L.svg('g', {}, outer)
    const faded = L.svg('g', { mask: `url(#${id}-fade)` }, place)
    const body = L.svg('g', { mask: `url(#${id}-legs)` }, faded)
    const sk = (w = SW) => ({ fill: 'none', stroke: C.chrome, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    // the far leg, behind
    const farFill = L.svg('path', { fill: FILL_FAR }, body)
    const farLine = L.svg('path', { ...sk(), 'stroke-opacity': 0.55, pathLength: 1, 'stroke-dasharray': '1 1' }, body)
    // the body: its fill, then the inside (clipped to it), then the outline on top
    const fill = L.svg('path', { fill: FILL }, body)
    const inside = L.svg('g', { 'clip-path': `url(#${id}-body)` }, body)
    const lungFill = L.svg('ellipse', { fill: C.chrome, 'fill-opacity': 0 }, inside)
    const lungs = L.svg('ellipse', { ...sk(), 'stroke-opacity': 0.75 }, inside)
    const ribs = P.ribs.map(() => L.svg('path', { ...sk(2.2), 'stroke-opacity': 0.4 }, inside))
    const dome = L.svg('path', sk(), inside)
    const eye = L.svg('path', { ...sk(2.6), 'stroke-opacity': 0.9 }, body)
    const lineUp = L.svg('path', { ...sk(), pathLength: 1, 'stroke-dasharray': '1 1' }, body)
    const lineDown = L.svg('path', { ...sk(), pathLength: 1, 'stroke-dasharray': '1 1' }, body)
    // glows (accents over their parts) and the running light
    const glowG = L.svg('g', { filter: `url(#${id}-glow)` }, body)
    const glows = {}
    for (const part of ['ribs', 'dome', 'lungs', 'belly', 'neck', 'back']) glows[part] = L.svg('path', { ...sk(8), 'stroke-opacity': 0.6, opacity: 0 }, glowG)
    const runP = L.svg('path', { ...sk(6), stroke: '#ffffff', pathLength: 1, 'stroke-dasharray': '0.14 1', opacity: 0 }, body)

    const last = { k: 1, x0: 0, y0: 0, b: 0, knee: 0, jaw: 0, shape: null }
    const ribD = (v) => `M${161.5} ${v - 4} Q 240 ${v - 22} ${316} ${v + 10}`
    const domeD = (s) => {
      const u1 = s.uBack, u2 = s.uFront, v1 = s.domeV(u1), v2 = s.domeV(u2)
      const uc = (u1 + u2) / 2, vc = v1 + 2 * ((s.endV - s.apex) / (85 * 85)) * (u1 - 240) * (uc - u1)
      return `M${f2(u1)} ${f2(v1)} Q ${f2(uc)} ${f2(vc)} ${f2(u2)} ${f2(v2)}`
    }
    const partD = (part, s) => {
      if (part === 'dome') return domeD(s)
      if (part === 'neck') return `M200 150 L200 215 M250 150 L250 215`
      if (part === 'back') return `M150 230 L150 560`
      if (part === 'belly') return spline(BELLY_V.map((v) => [bellyU(s.bu, v), v]))
      if (part === 'ribs') return P.ribs.map(ribD).join(' ')
      const [cx, cy, rx, ry] = s.lungs
      return `M${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`
    }

    const F = {
      g: outer,
      pt: (u, v) => [last.x0 + last.k * u, last.y0 + last.k * v],
      shape: () => last.shape,
      at(name) {
        const s = last.shape || shapeOf(0, 0, 0)
        const pts = {
          head: P.head, crown: [P.head[0], P.head[1] - P.headR], chin: [285, 140 + s.jawU], throat: P.throat, shoulder: P.shoulder,
          lungs: [s.lungs[0], s.lungs[1]], domeApex: [240, s.apex], domeL: [155, s.endV], domeR: [325, s.endV],
          belly: [s.bu, 490], back: [150, 400], hips: [330, 560], knee: [235 + s.kneeU, 780], ankle: P.ankle, toe: P.toe, heel: P.heel,
        }
        const p = pts[name]
        if (!p) throw new Error('L.figure: no anchor ' + name)
        return F.pt(p[0], p[1])
      },
      draw({ k = 1, x0 = 0, y0 = 0, a = 1, draw = 1, legs = 1, fade = null, breath = 0, lungFill: lf = 0, glow = {}, run = null, knee = 0, jaw = 0 } = {}) {
        const s = shapeOf(clamp(breath, -1, 1), knee, jaw / k)
        Object.assign(last, { k, x0, y0, b: breath, knee, jaw, shape: s })
        outer.setAttribute('opacity', clamp(a).toFixed(3))
        place.setAttribute('transform', `translate(${f2(x0)} ${f2(y0)}) scale(${k.toFixed(5)})`)
        // the masks, in figure units
        if (fade) { fadeGrad.setAttribute('y1', f2((fade[0] - y0) / k)); fadeGrad.setAttribute('y2', f2((fade[1] - y0) / k)) }
        else { fadeGrad.setAttribute('y1', '3000'); fadeGrad.setAttribute('y2', '3001') }
        legRect.setAttribute('height', f2(1000 + 560 + 440 * clamp(legs) + 8))
        // the outline
        const o = outlineOf(s)
        const dUp = spline(o.up), dDown = spline(o.down)
        const closed = dUp + spline(o.down.slice().reverse(), false).replace(/^L[^C]*/, '') + 'Z'
        fill.setAttribute('d', closed); clipPath.setAttribute('d', closed)
        lineUp.setAttribute('d', dUp); lineDown.setAttribute('d', dDown)
        const dFar = spline(o.far) + 'Z'
        farFill.setAttribute('d', dFar); farLine.setAttribute('d', spline(o.far))
        const dr = clamp(draw)
        for (const p of [lineUp, lineDown, farLine]) p.setAttribute('stroke-dashoffset', (1 - dr).toFixed(4))
        const inA = L.smooth(0.55, 1, dr)
        for (const p of [fill, farFill]) p.setAttribute('opacity', inA.toFixed(3))
        inside.setAttribute('opacity', inA.toFixed(3)); eye.setAttribute('opacity', inA.toFixed(3))
        eye.setAttribute('d', `M268 73 Q 274 70 279 74`)
        // the inside
        const [cx, cy, rx, ry] = s.lungs
        for (const e of [lungs, lungFill]) { e.setAttribute('cx', cx); e.setAttribute('cy', f2(cy)); e.setAttribute('rx', rx); e.setAttribute('ry', f2(ry)) }
        lungFill.setAttribute('fill-opacity', (0.14 * clamp(lf)).toFixed(3))
        ribs.forEach((r, i) => r.setAttribute('d', ribD(P.ribs[i])))
        dome.setAttribute('d', domeD(s))
        for (const [part, el] of Object.entries(glows)) {
          const gv = clamp(glow[part] || 0)
          el.setAttribute('opacity', gv.toFixed(3))
          if (gv > 0) el.setAttribute('d', partD(part, s))
        }
        if (run && (run.a ?? 1) > 0.004) {
          runP.setAttribute('d', partD(run.part, s))
          runP.setAttribute('stroke-dashoffset', f2(-(run.u ?? 0)))
          runP.setAttribute('opacity', clamp(run.a ?? 1).toFixed(3))
        } else runP.setAttribute('opacity', '0')
      },
    }
    return F
  }
})()
