/* Find Your Pitch, Lesson 5 kit: the mix-up card's rows and miniatures (HANDOFFS § World, The mix-up card
   (S7); F0 from the matched cut; frame-fixed). window.L, after chart.js and gauge.js.

     L.MIXUP            ROWS (every row's words, size and baseline from x 360, as HANDOFFS' table);
                        CHART (the reassembled chart: plot x 400 to 1520, y0 470, W 4, strip 700; its
                        "ILLUSTRATION" right-aligned 1520, centred y 790 while large); ROW1 (the pushed chart
                        into row 1: x' = 1180 + 0.41 (x - 400), y' = 310 + 0.41 (y - 470), as a place
                        { s, dx, dy }; its chip to x 360, centred y 345); PAIR (the two strips, large) and
                        ROW2 (into row 2: x' = 1180 + 0.5 (x - 860), y' = 520 + 0.5 (y - 680)); WORD (the large
                        '"support"' and its phrases, and their row-3 places); REASSEMBLE(u) (7a: the gauge
                        folds back and the small band and strip glide into the chart, one move: returns the
                        small band's box and line and the strip's y in the gauge's own units under CUT, the
                        place { s 1.05, dx -60, dy -25.25 } that keeps F-gauge's pixels at F0: ga.place(L.MIXUP.CUT);
                        at u 1 they sit on the chart's own pixels)
     const b0 = L.beliefRow(svg) -> { label, line, q, end(), draw({ a, line, qA, qScale }) }   row 0: its words, the
                        dashed underline (y 194, drawn on by `line` 0..1) and its "?" after the last word
     Row 1's "ILLUSTRATION" chip: L.tag(svg, L.TAGS.illustration, L.MIXUP.ROW1.tag) (x 360, centred y 345)
     const pr = L.pressPair(svg)
     pr.draw({ a = 1, draw = 1, place = null (L.MIXUP.ROW2 interpolated by the scene), pressed = 1 (a pulse
               scale on "pressed": L.pulse(..., 'chip')), pushA = 1 ("one push of air"), namesA = 1 (the 30 px
               names, large), smallA = 0 (the 26 px names, in the row; a swap with namesA, never both above 0) })
                        "easy" x 860 to 1200 (half-height 110) and "pressed" x 1260 to 1600 (half-height 28),
                        centred y 680, violet 28 % with 2 px edges at 70 %; a chrome bar 3 px at y 545 from x 860
                        to 1600 with a drop to each strip's top; draw 0..1 draws the bar, then the strips grow
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp

  L.MIXUP = {
    ROWS: {
      kicker: { text: 'COMMON MIX-UP', x: 120, y: 110 },
      row0: { text: '‘support’ means pushing hard, or squeezing', x: 360, y: 180, size: 44, underlineY: 194 },
      row1: { text: 'push harder: louder, and higher', x: 360, y: 300, size: 40 },
      row2a: { text: 'squeeze: a pressed sound,', x: 360, y: 490, size: 40 },
      row2b: { text: 'more pressure, not less', x: 360, y: 535, size: 40 },
      row2c: { text: 'same push: much quieter', x: 360, y: 580, size: 30 },
      row3a: { text: '“support”: how singers manage the breath', x: 360, y: 655, size: 40 },
      row3b: { text: 'no one agreed meaning', x: 360, y: 700, size: 36 },
      row4: { text: 'The better idea:', x: 360, y: 760, size: 30, fill: C.ink2 },
      row4a: { text: 'steady air, not more of it · breathe in low', x: 360, y: 810, size: 40 },
      row4b: { text: 'start easily · let it flow out unforced', x: 360, y: 855, size: 40 },
    },
    CHART: { x0: 400, x1: 1520, y0: 470, W: 4, strip: 700, tag: { x: 1520, y: 790, anchor: 'end' } },
    ROW1: { s: 0.41, dx: 1180 - 0.41 * 400, dy: 310 - 0.41 * 470, tag: { x: 360, y: 345, anchor: 'start' } },
    PAIR: { easy: { x0: 860, x1: 1200, h: 110 }, pressed: { x0: 1260, x1: 1600, h: 28 }, y: 680, bar: 545, push: { x: 1230, y: 530 }, names: { y: 830 } },
    ROW2: { s: 0.5, dx: 1180 - 0.5 * 860, dy: 520 - 0.5 * 680, names: { y: 605, size: 26 } },
    WORD: {
      large: { text: '“support”', x: 360, y: 800, size: 160 },
      how: { text: 'how singers manage the breath', x: 980, y: 800, size: 44 },
      noOne: { text: 'no one agreed meaning', x: 980, y: 850, size: 36 },
    },
  }
  // 7a: the gauge drawn at F-gauge's pixels (ga.place(L.MIXUP.CUT): it keeps its pixels across the matched
  // cut, now at F0) folds back, and its small band and strip glide to the chart reassembled at the frame's
  // middle. REASSEMBLE(u) returns them in the gauge's own units (under that place), u 0..1 eased inside
  L.MIXUP.CUT = { s: 1.05, dx: -60, dy: -25.25 }
  L.MIXUP.REASSEMBLE = (u) => {
    const e = L.ease('power2.inOut')(clamp(u))
    const { s, dx, dy } = L.MIXUP.CUT
    const A = { x0: 760, x1: 1640, y0: 160, y1: 240, line: 200, strip: 690, lw: 3 }
    const loc = (X, Y) => [(X - dx) / s, (Y - dy) / s]
    const [bx0, by0] = loc(400, 470 - 87.5), [bx1, by1] = loc(1520, 470 + 87.5)
    const B = { x0: bx0, x1: bx1, y0: by0, y1: by1, line: loc(0, 470)[1], strip: loc(0, 700)[1], lw: 4 / s }
    const m = (k) => L.lerp(A[k], B[k], e)
    return { band: { x0: m('x0'), x1: m('x1'), y0: m('y0'), y1: m('y1'), line: m('line'), lw: m('lw') }, strip: { x0: m('x0'), x1: m('x1'), y: m('strip') } }
  }

  // row 0, the belief (HANDOFFS § The mix-up card): its words, a dashed ink-2 underline at y 194 under their
  // whole width (Tavi's guess: 3 px, dash 10, gap 8), drawn on left to right, and its "?" (Outfit 600 64,
  // ink-2) 14 px after the last word, both laid out once the font is in
  L.beliefRow = (svg) => {
    const R0 = L.MIXUP.ROWS.row0
    const id = L.uid('belief')
    const label = L.label(svg, R0.text, R0)
    const defs = L.svg('defs', {}, svg)
    const clip = L.svg('clipPath', { id: id + '-c' }, defs)
    const clipR = L.svg('rect', { x: R0.x - 4, y: R0.underlineY - 10, height: 20, width: 0 }, clip)
    const line = L.svg('path', { fill: 'none', stroke: L.GUESS.stroke, 'stroke-width': L.GUESS.width, 'stroke-dasharray': L.GUESS.dash, 'clip-path': `url(#${id}-c)`, opacity: 0 }, svg)
    const q = L.text(svg, '?', { x: R0.x, y: R0.y, size: L.GUESS.q, fill: L.GUESS.stroke })
    let w = 0
    const layout = () => {
      w = label.w()
      line.setAttribute('d', `M${R0.x} ${R0.underlineY} L${f2(R0.x + w)} ${R0.underlineY}`)
      q.setAttribute('x', f2(R0.x + w + 14))
    }
    layout()
    L.afterFonts(layout)
    return {
      label, line, q, end: () => R0.x + w,
      draw({ a = 1, line: u = 1, qA = 1, qScale = 1 } = {}) {
        if (!w) layout()
        label.draw({ a })
        line.setAttribute('opacity', clamp(a).toFixed(3))
        clipR.setAttribute('width', f2((w + 8) * clamp(u)))
        L.place(q, { a: a * clamp(qA), scale: qScale, ox: R0.x + w + 14, oy: R0.y })
      },
    }
  }

  L.pressPair = (svg) => {
    const P = L.MIXUP.PAIR
    const root = L.svg('g', { class: 'press-pair', opacity: 0 }, svg)
    const bar = L.svg('path', { fill: 'none', stroke: C.chrome, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, root)
    const strip = (s) => L.svg('rect', { x: s.x0, width: s.x1 - s.x0, fill: C.violet, 'fill-opacity': 0.28, stroke: C.violet, 'stroke-opacity': 0.7, 'stroke-width': 2 }, root)
    const easyR = strip(P.easy), pressedG = L.svg('g', {}, root), pressedR = strip(P.pressed)
    pressedG.appendChild(pressedR)
    const pushT = L.text(root, 'one push of air', { x: P.push.x, y: P.push.y, size: 28, weight: 500, fill: C.ink2, anchor: 'middle' })
    const big = ['easy', 'pressed'].map((n, i) => L.text(root, n, { x: [1030, 1430][i], y: P.names.y, size: 30, anchor: 'middle' }))
    const small = ['easy', 'pressed'].map((n, i) => L.text(root, n, { x: [1030, 1430][i], y: 850, size: 52, anchor: 'middle' }))
    const midx = (s) => (s.x0 + s.x1) / 2
    bar.setAttribute('d', `M${midx(P.easy)} ${P.y - P.easy.h} L${midx(P.easy)} ${P.bar} L${midx(P.pressed)} ${P.bar} L${midx(P.pressed)} ${P.y - P.pressed.h} M${P.easy.x0} ${P.bar} L${P.pressed.x1} ${P.bar}`)
    return {
      g: root,
      draw({ a = 1, draw = 1, place = null, pressed = 1, pushA = 1, namesA = 1, smallA = 0 } = {}) {
        root.setAttribute('opacity', clamp(a).toFixed(3))
        root.setAttribute('transform', place ? `matrix(${place.s.toFixed(5)} 0 0 ${place.s.toFixed(5)} ${f2(place.dx)} ${f2(place.dy)})` : '')
        bar.setAttribute('stroke-dashoffset', (1 - clamp(draw / 0.5)).toFixed(4))
        const g = L.ease('power2.out')(clamp((draw - 0.3) / 0.7))
        for (const [el, s] of [[easyR, P.easy], [pressedR, P.pressed]]) {
          const h = s.h * g
          el.setAttribute('y', f2(P.y - h)); el.setAttribute('height', f2(2 * h))
          el.setAttribute('opacity', g > 0.01 ? '1' : '0')
        }
        const cx = midx(P.pressed)
        pressedG.setAttribute('transform', pressed !== 1 ? `translate(${cx} ${P.y}) scale(${pressed.toFixed(4)}) translate(${-cx} ${-P.y})` : '')
        pushT.setAttribute('opacity', (clamp(pushA) * g).toFixed(3))
        big.forEach((el) => el.setAttribute('opacity', (clamp(namesA) * g).toFixed(3)))
        // in the row the names are 26 px on screen: 52 in the pair's own units at 0.5
        small.forEach((el) => el.setAttribute('opacity', clamp(smallA).toFixed(3)))
      },
    }
  }
})()
