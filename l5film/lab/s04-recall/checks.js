// s04-recall's checks: the first frame (S3's last), F-strip and the swatches, the ring by the strip, the lit swatch,
// the four words big and parked, the last frame against HANDOFFS § S4 to S5, the keep-out.
;(function () {
  const H = window.__H, sid = 's04-recall'
  const S = window.__sceneProbe[sid], A = S.A
  const CH = (k) => A.HEAD + 0.43 + 0.4 * k
  const T = { f0: 0, strip: A.SW + 1.2, lit: A.LIGHT + 0.6, big: CH(3) + 0.3, parked: A.FLY + A.FLY_D, last: A.D - 0.0005,
    ring: A.Q0 + 0.5 * A.Q0_D, crane: A.UP + 0.4 }
  // DECISIONS 172: every frame of the flight, the chips against every mark still on screen; every frame of the crane
  // up, what is on screen besides "level", the hosts and the words
  const frames = (a, b) => { const out = []; for (let k = Math.ceil(a * 30 - 1e-6); k / 30 <= b + 1e-9; k++) out.push(k / 30); return out }
  const FLIGHT = frames(A.FLY, A.FLY + A.FLY_D), CRANE_UP = frames(A.UP, A.UP + A.UP_D)
  // fix round F-01: every frame of the swatches' landing (233: the names' layers), the lower half laid out (226)
  const LANDING = frames(A.SW, A.SW + 0.8 + 0.3)
  const T2 = { layout: CH(3) + 0.3, f0b: 0 }
  const lineGap = { gap: Infinity, what: '', t: null, n: 0 }
  const names = { worst: 0, t: null, frames: 0 }
  const cross = { text: { gap: Infinity, what: '', t: null }, marks: [] }
  let emptiest = { n: Infinity, t: null, what: '' }
  const marksAt = (t) => {
    const m = []
    S.SWATCH.forEach((s) => { m.push(['swatch ' + s.name, s.box, H.alpha(s.box), false]); m.push(['name ' + s.name, s.label, H.alpha(s.label), true]) })
    m.push(['hairline', S.hair, H.alpha(S.hair), false], ['heading', S.heading, H.alpha(S.heading), true])
    const env = S.ch.g.querySelector('.strip g[opacity]') || null
    const a = S.cam.map(400, S.ch.G.strip - A.LEVEL, t), b = S.cam.map(1520, S.ch.G.strip + A.LEVEL, t)
    m.push(['the strip\'s envelope', { left: a[0], top: a[1], right: b[0], bottom: b[1] }, null, false])
    return m
  }
  const root = document.getElementById(sid + '-scene')
  const chipBox = (c) => H.R(c.box)
  window.__groupA = {
    times: [...new Set([...Object.values(T), ...FLIGHT, ...CRANE_UP, ...LANDING, ...Object.values(T2)])].sort((a, b) => a - b),
    check(t) {
      const out = []
      const m = (x, y) => S.cam.map(x, y, t)
      if (t === T.f0) out.push({ name: 'first frame at F-promise-b: plot x 320 to 1440', got: `${m(400, 400)[0]} to ${m(1520, 400)[0]}`, want: '320 to 1440' })
      if (t === T.f0) out.push({ name: 'F-01: the first frame\'s strip at 720 and "level" at 820 (S3\'s last frame)', got: `${S.ch.G.strip.toFixed(2)} / ${(778 + H.dyOf(S.lab.level.el)).toFixed(2)}`, want: '720.00 / 820.00' })
      if (t === T.strip) {
        const sw = S.SWATCH.map((s) => H.R(s.box)).map((r) => `(${((r.left + r.right) / 2).toFixed(1)}, ${((r.top + r.bottom) / 2).toFixed(1)})`).join(' ')
        const G = S.ch.G.strip
        const env = S.ch.g.querySelector('.strip').querySelectorAll('path')
        const sizes = S.SWATCH.map((s) => { const r = H.R(s.box); return `${r.width.toFixed(1)}x${r.height.toFixed(1)}` }).join(' ')
        const nb = S.SWATCH.map((s) => { const k = H.R(s.label); return k }), nm = new DOMMatrix(getComputedStyle(S.SWATCH[0].layer).transform)
        out.push({ name: 'F-strip: the strip x 176 to 1744 (world 720, F-01)', got: `${m(400, G)[0]} to ${m(1520, G)[0]}, y ${m(0, G)[1].toFixed(1)}`, want: '176 to 1744, y 308.0' },
          { name: 'F-01 (DECISIONS 226): its envelope 1.5 times (half-height 42 world): y 249.2 to 366.8', got: `${m(0, G - A.LEVEL)[1].toFixed(1)} to ${m(0, G + A.LEVEL)[1].toFixed(1)}`, want: '249.2 to 366.8' },
          { name: 'the swatches centred (512, 546), (960, 546), (1408, 546)', got: sw, want: '(512.0, 546.0) (960.0, 546.0) (1408.0, 546.0)' },
          { name: 'their boxes on screen (1.5 times: 336 wide; 42, 117.6, 235.2 tall)', got: sizes, want: '336.0x42.0 336.0x117.6 336.0x235.2' },
          { name: 'the middle swatch exactly the strip\'s envelope (half-heights, world)', got: `${S.SWATCH[1].h} / ${A.LEVEL}`, want: '42 / 42' },
          { name: 'their names\' baseline 730.8 at 50.4 px, in composited layers (will-change), translated', got: `${(nm.f + 540).toFixed(1)}, ${S.SWATCH[0].label.style.fontSize}, ${getComputedStyle(S.SWATCH[0].layer).willChange}`, want: '730.8, 50.4px, transform' },
          ...H.keepout(root, S.boxes))
      }
      if (t === T.ring) {
        const rg = H.R(S.ring.g), sw = H.R(S.SWATCH[2].box), outer = sw.right + S.cam.scale(t)   // the outline's outer edge
        // the box is the ring's geometry (r 18); its 3 px stroke reaches 1.5 px past it
        out.push({ name: 'DECISIONS 175: the q0 ring right of the third swatch, its ink 40 px clear of the swatch outline\'s outer edge', got: rg.left - 1.5 - outer, want: 40, tol: 0.5 },
          { name: 'centred on the swatch row (y)', got: (rg.top + rg.bottom) / 2, want: (sw.top + sw.bottom) / 2, tol: 0.5 },
          { name: 'same ring, same size: r 18', got: rg.width / 2, want: 18, tol: 0.3 },
          { name: 'the ring on screen at (x, y)', got: `${((rg.left + rg.right) / 2).toFixed(1)}, ${((rg.top + rg.bottom) / 2).toFixed(1)}`, want: 'info', pass: true }, ...H.keepout(root, S.boxes))
      }
      if (FLIGHT.includes(t)) {
        const chips = S.row.chips.map((c) => H.R(c.box))
        for (const [what, el, a, isText] of marksAt(t)) {
          const r = el.getBoundingClientRect ? H.R(el) : el
          const g = Math.min(...chips.map((c) => H.gap(c, r)))
          const alpha = a == null ? +(S.ch.g.querySelector('.strip').getAttribute('opacity') ?? 1) : a
          if (isText && alpha > 0.01 && g < cross.text.gap) { cross.text = { gap: g, what, t } }
          if (!isText && alpha > 0.01 && g === 0 && !cross.marks.includes(what)) cross.marks.push(what)
        }
        if (t === FLIGHT[FLIGHT.length - 1]) out.push({ name: `DECISIONS 172: the flight (${FLIGHT.length} frames) crosses no type still on screen: the nearest visible type's gap to a chip`, got: cross.text.gap === Infinity ? 'none on screen' : cross.text.gap, want: '> 0', pass: cross.text.gap > 0 },
          { name: 'the marks the chips pass in front of (frame-fixed over a mark, DECISIONS 168)', got: cross.marks.join(', ') || 'none', want: 'info', pass: true })
      }
      if (LANDING.includes(t)) {
        // DECISIONS 233: each name's layer at the name's place on screen (to 1/1000 px), never stepped; its alpha with its swatch
        S.SWATCH.forEach((s, i) => {
          const f = L.fade(t, A.SW + 0.4 * i, A.SW_OUT, { dIn: 0.3, rise: 12, dOut: A.SW_OUT_D }), k = 1
          const want = S.cam.map(s.x, A.SY + k * (A.NAME_Y - A.SY) + f.dy, t), mm = new DOMMatrix(getComputedStyle(s.layer).transform)
          if (getComputedStyle(s.layer).display !== 'none') { names.frames++; names.worst = Math.max(names.worst, Math.abs(mm.e + 960 - want[0]), Math.abs(mm.f + 540 - want[1])) }
        })
        if (t === LANDING[LANDING.length - 1]) out.push({ name: `DECISIONS 233: the names' layers on their anchors over the landing (${LANDING.length} frames, ${names.frames} name-frames): worst offset`, got: names.worst, want: '< 0.001', pass: names.worst < 0.001 })
      }
      if (t === T2.layout) {
        const nameInk = S.SWATCH.map((s) => H.R(s.label)), hd = H.R(S.heading), chips = S.row.chips.map((c) => H.R(c.box)), tall = H.R(S.SWATCH[2].box)
        const lowName = Math.max(...nameInk.map((r) => r.bottom)), topName = Math.min(...nameInk.map((r) => r.top))
        const hdInk = H.ink(S.heading.textContent, "500 26px 'JetBrains Mono'", 'middle')
        out.push({ name: `F-01 (DECISIONS 226, t ${t.toFixed(2)}): the lower half: the tall swatch (outer stroke) to the names' font box / names to the heading / heading's baseline to the row's outlines`,
          got: `${(topName - (tall.bottom + 1.4)).toFixed(1)} / ${(hd.top - lowName).toFixed(1)} / ${(Math.min(...chips.map((c) => c.top)) - 790).toFixed(1)}`, want: '>= 12 each',
          pass: topName - (tall.bottom + 1.4) >= 12 && hd.top - lowName >= 12 && Math.min(...chips.map((c) => c.top)) - 790 >= 12 },
          { name: '  the heading\'s baseline / the row\'s outlines y', got: `${S.heading.getAttribute('y')} / ${chips[0].top.toFixed(1)} to ${chips[0].bottom.toFixed(1)}`, want: '790 / about 819 to 875', pass: S.heading.getAttribute('y') === '790' && Math.abs(chips[0].top - 818.7) < 1 && Math.abs(chips[0].bottom - 874.5) < 1 },
          { name: '  the lowest ink above the captions\' 896 (the row\'s outlines)', got: Math.max(...chips.map((c) => c.bottom)), want: '<= 896', pass: Math.max(...chips.map((c) => c.bottom)) <= 896 }, ...H.keepout(root, S.boxes))
      }
      if (CRANE_UP.includes(t)) {
        // DECISIONS 229: the band's lines against the parked chips, every frame of the crane up, wherever a line shows
        const chips = S.row.chips.map((c) => H.R(c.box)), sc = S.cam.scale(t)
        const glowR = H.R(S.ch.merc.glowPath), mercBox = { left: glowR.left, right: glowR.right, top: glowR.top - 5 * sc, bottom: glowR.bottom + 5 * sc }
        const lines = [['the band\'s top edge', H.R(S.bandEdges[0]), +S.bandEdges[0].getAttribute('fill-opacity')], ["Merc's line (its 10 px glow)", mercBox, H.alpha(S.ch.merc.g)], ['the band\'s bottom edge', H.R(S.bandEdges[1]), +S.bandEdges[1].getAttribute('fill-opacity')]]
        for (const [what, r, a] of lines) {
          if (a <= 0.002 || r.bottom < 0) continue
          lineGap.n++
          const g = Math.min(...chips.map((c) => H.gap(c, r)))
          if (g < lineGap.gap) lineGap.gap = g, lineGap.what = what, lineGap.t = t
        }
        if (t === CRANE_UP[CRANE_UP.length - 1]) out.push({ name: `DECISIONS 229: the band's lines to the parked chips over the crane up (${CRANE_UP.length} frames, ${lineGap.n} line-frames on screen): the nearest`, got: lineGap.gap, want: '>= 12', pass: lineGap.gap >= 12 },
          { name: '  where', got: `${lineGap.what} at ${lineGap.t == null ? '-' : lineGap.t.toFixed(3)}; each line in from ${A.IN.top.toFixed(3)} / ${A.IN.merc.toFixed(3)} / ${A.IN.bot.toFixed(3)} (0.3 s)`, want: 'info', pass: true })
      }
      if (CRANE_UP.includes(t)) {
        // what the crane carries: the swatches, the hairline, the strip's envelope, the band (once its foot is in
        // frame), "A3"
        const env = Math.min(1, Math.max(0, 1 - L.prog(t, A.FOOT_IN, 0.4))) * L.prog(t, A.CRANE, 0.8)
        const foot = S.cam.map(0, S.ch.band().bot + 1, t)[1]
        const seen = [...S.SWATCH.map((s) => [s.name, H.alpha(s.box)]), ['hairline', H.alpha(S.hair)], ['envelope', env], ['band', foot >= 16 ? 1 : 0], ['A3', H.alpha(S.lab.A3.el)]].filter((p) => p[1] > 0.3)
        if (seen.length < emptiest.n) emptiest = { n: seen.length, t, what: seen.map((p) => p[0]).join(', ') }
        if (t === CRANE_UP[CRANE_UP.length - 1]) out.push({ name: `DECISIONS 172: the crane up (${CRANE_UP.length} frames) never runs over an empty frame: the fewest marks of the chart on screen at 30 % or more`, got: `${emptiest.n} at ${emptiest.t.toFixed(3)} (${emptiest.what})`, want: '>= 1', pass: emptiest.n >= 1 },
          { name: 'the strip\'s envelope stays until the band\'s foot is 16 px into the frame', got: `foot in at ${A.FOOT_IN.toFixed(3)}, envelope out ${A.FOOT_IN.toFixed(3)} to ${(A.FOOT_IN + 0.4).toFixed(3)}`, want: 'info', pass: A.FOOT_IN > A.UP && A.FOOT_IN + 0.4 <= A.D })
      }
      if (t === T.crane) {
        out.push({ name: 'DECISIONS 172: 0.4 s into the crane up, the swatches / their names / the hairline / the heading', got: `${S.SWATCH.map((s) => H.alpha(s.box).toFixed(2)).join(' ')} / ${S.SWATCH.map((s) => H.alpha(s.label).toFixed(2)).join(' ')} / ${H.alpha(S.hair).toFixed(2)} / ${H.alpha(S.heading).toFixed(2)}`,
          want: 'still up (leaving on "right") / 0 / up / 0', pass: S.SWATCH.every((s) => H.alpha(s.box) > 0.5 && H.alpha(s.label) < 0.01) && H.alpha(S.heading) < 0.01 })
      }
      if (t === T.lit) {
        const mid = S.SWATCH[1]
        out.push({ name: 'the middle swatch lit: violet 28 % fill, ink outline, its name in ink', got: `${mid.box.getAttribute('fill-opacity')}, ${mid.box.getAttribute('stroke')}, ${mid.label.getAttribute('fill')}`, want: '0.280, rgb(230,237,243), rgb(230,237,243)' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.big) {
        const rs = S.row.chips.map(chipBox), txt = S.row.chips.map((c) => H.R(c.el))
        const gaps = rs.slice(1).map((r, i) => r.left - rs[i].right)
        out.push({ name: 'the four words introduced: row centred on x 960', got: (rs[0].left + rs[3].right) / 2, want: 960, tol: 1 },
          { name: 'their text 44 px (scaled 30 x 44/30)', got: (S.row.chips[0].g.getAttribute('transform').match(/scale\(([\d.]+)\)/) || [])[1], want: '1.4667' },
          { name: 'the gaps between them (12 x 44/30 = 17.6)', got: gaps.map((g) => g.toFixed(1)).join(' '), want: '17.6 x 3', pass: gaps.every((g) => Math.abs(g - 17.6) < 0.6) },
          { name: 'row from x .. to ..', got: `${rs[0].left.toFixed(1)} to ${rs[3].right.toFixed(1)}, y ${rs[0].top.toFixed(1)} to ${rs[0].bottom.toFixed(1)}`, want: 'info', pass: true }, ...H.keepout(root, S.boxes))
      }
      if (t === T.parked || t === T.last) {
        const rs = S.row.chips.map(chipBox)
        const gaps = rs.slice(1).map((r, i) => r.left - rs[i].right)
        out.push({ name: `the four words parked (t ${t.toFixed(2)}): right edge 1800`, got: rs[3].right, want: 1800, tol: 1 },
          { name: 'outlines y 68 to 106', got: `${rs[0].top.toFixed(1)} to ${rs[0].bottom.toFixed(1)}`, want: '68.0 to 106.0', pass: Math.abs(rs[0].top - 68) < 1 && Math.abs(rs[0].bottom - 106) < 1 },
          { name: 'gaps 12', got: gaps.map((g) => g.toFixed(1)).join(' '), want: '12.0 x 3', pass: gaps.every((g) => Math.abs(g - 12) < 0.5) },
          { name: 'dim: ink-2 text', got: S.row.chips.map((c) => c.el.getAttribute('fill')).join(' '), want: 'rgb(168,179,191) x 4', pass: S.row.chips.every((c) => c.el.getAttribute('fill') === 'rgb(168,179,191)') })
      }
      if (t === T.last) {
        const vis = (e) => H.alpha(e).toFixed(2)
        out.push({ name: 'last frame F0: band 312.5 to 487.5, line y 400', got: `${m(0, 312.5)[1]} to ${m(0, 487.5)[1]}, ${m(400, 400)[1]}`, want: '312.5 to 487.5, 400' },
          { name: 'F-01: the strip home at S1\'s 690 and "level" at 778 (S5\'s first frame); the band\'s lines at full', got: `${S.ch.G.strip.toFixed(2)} / ${(778 + H.dyOf(S.lab.level.el)).toFixed(2)} / ${S.bandEdges.map((e) => e.getAttribute('fill-opacity')).join(' ')} ${H.alpha(S.ch.merc.g).toFixed(2)}`, want: '690.00 / 778.00 / 0.450 0.450 1.00' },
          { name: 'the label row\'s text from x 400, baseline 150, at full', got: `${S.lab.row.el.getAttribute('x')}, ${S.lab.row.el.getAttribute('y')}, ${vis(S.lab.row.el)}`, want: '400, 150, 1.00' },
          { name: '"A3", "level" at full; the swatches and heading gone', got: `${vis(S.lab.A3.el)} ${vis(S.lab.level.el)} / ${S.SWATCH.map((s) => vis(s.g)).join(' ')} ${vis(S.heading)}`, want: '1.00 1.00 / 0.00 0.00 0.00 0.00' },
          { name: 'hosts at 300 in their corners: Merc, Tavi body boxes', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' }, ...H.keepout(root, S.boxes))
      }
      return out
    },
  }
})()
