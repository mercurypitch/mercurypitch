// s10-steady's checks (lab/s05-push/probe.mjs, unchanged): the first frame against S9's last, the stack's dim and exit,
// the push to F-hold and the hold chart's places (HANDOFFS § The hold chart, § Framings), the guess, the window
// widening, the lit edge and the settled flag (provisional: its time by the page's rule), the wave rule at F-hold,
// CU-scoop, CU-wave and in 10h's frame, LAB-CHECKS 14 (SLOWED through the truck), the returns, 10f to 10h's places, the
// frame on L.CHART.FRAME's screen pixels at the last frame (LAB-CHECKS 2, S10 to S11), overlaps, keep-out, 0.4 s.
;(function () {
  const H = window.__H, sid = 's10-steady'
  const S = window.__sceneProbe[sid], A = S.A
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const T = {
    f0: 0, dim: A.ACT + 0.25, gone: A.STACK_OUT + 0.3, fadein: A.PUSH + 0.25, hold4: A.PUSH + A.PUSH_D + 0.05, guess: A.GUESS_END + 0.3, widened: A.WIDEN + 0.85,
    lit: A.LIT + 0.45, flag: A.FLAG + 0.35, back: A.GUESS_OUT + 0.55, whole: A.DEMO + 10.1, scoop: A.PUSH2 + A.PUSH2_D + 0.05, slowed: A.SLOW0 + 0.3, scoopL: A.SCOOP_L + 0.3,
    truck1: A.TRUCK + 0.5, truck2: A.TRUCK + 1.0, truck3: A.TRUCK + 1.5, truck4: A.TRUCK + 1.95, wave: A.TRUCK + A.TRUCK_D + 0.05, vib: A.SMALL + 0.5, inside: A.INSIDE + 0.15,
    pulled: A.PULL + A.PULL_D + 0.02, returned: A.SET_BACK + 0.45, stays: A.STAYS + 0.7, comf: A.COMF + 0.7, airq: A.AIRQ + 0.4, slid: A.SLIDE + A.SLIDE_D + 0.05,
    box: A.VB_L + 0.3, needs: A.NEEDS + 0.3, line1: A.ILL10 + 0.3, line2: A.MOVES + 0.3, lastLeg: A.END_FADE - 0.02, last: A.D - 0.0005,
  }
  const box = (b) => `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`
  const bandR = () => R(S.ch.g.querySelector('.band rect'))
  const mercR = () => R(S.ch.merc.path)
  const overlaps = () => {
    const tx = H.texts(root, 0.5).filter((x) => x.r.width > 0)
    const bad = []
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
      const a = tx[i].r, b = tx[j].r
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ox > 0 && oy > 8) bad.push(`"${tx[i].text}" / "${tx[j].text}"`)
    }
    return { name: 'no two visible texts overlap', got: bad.length ? bad.join('; ') : 'none', want: 'none', pass: !bad.length }
  }
  // the wave of a line's last drawn points, on screen: mean cycle (peak to peak in x) and peak to peak (in y)
  const waveOf = (ch, id, x0w, x1w) => {
    const ctm = ch.g.getScreenCTM()
    const q = ch.lastLine(id).filter((p) => p[0] >= x0w && p[0] <= x1w).map((p) => [ctm.a * p[0] + ctm.e, ctm.d * p[1] + ctm.f])
    const ys = q.map((p) => p[1]), peaks = []
    for (let i = 1; i < q.length - 1; i++) if (q[i][1] < q[i - 1][1] && q[i][1] <= q[i + 1][1]) peaks.push(q[i][0])
    const gaps = peaks.slice(1).map((x, i) => x - peaks[i])
    return { pp: Math.max(...ys) - Math.min(...ys), cyc: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length) }
  }
  const waveChecks = (tag, cyc, pp) => {
    const w = waveOf(S.ch, 'held', 400 + 112 * 3, 400 + 112 * 6)
    return [{ name: `wave rule ${tag}: one cycle ${cyc} px (within 10 %)`, got: w.cyc, want: cyc, tol: cyc * 0.1 }, { name: `wave rule ${tag}: peak to peak ${pp} px`, got: w.pp, want: pp, tol: pp * 0.1 },
      { name: `wave rule ${tag}: ratio 1.30 to 1.45`, got: w.pp / w.cyc, want: '1.30 to 1.45', pass: w.pp / w.cyc >= 1.3 && w.pp / w.cyc <= 1.45 }]
  }
  // LAB-CHECKS 14: what passes near the frame-fixed SLOWED chip: every visible text, the band, the lines' points
  const underSlowed = () => {
    const sb = R(S.slowed.box)
    let worst = Infinity, what = ''
    for (const tx of H.texts(root, 0.05)) { if (/SLOWED/.test(tx.text)) continue; const g = H.gap(tx.r, sb); if (g < worst) { worst = g; what = tx.text } }
    const b = bandR(); if (b.top - sb.bottom < worst) { worst = b.top - sb.bottom; what = 'the band\'s top' }
    const ctm = S.ch.g.getScreenCTM()
    for (const id of ['first', 'held', 'slow']) for (const p of S.ch.lastLine(id)) {
      const x = ctm.a * p[0] + ctm.e, y = ctm.d * p[1] + ctm.f
      const g = Math.hypot(Math.max(sb.left - x, 0, x - sb.right), Math.max(sb.top - y, 0, y - sb.bottom)) - 2
      if (g < worst) { worst = g; what = 'her line' }
    }
    const fl = R(S.flag.g); if (+S.flag.g.getAttribute('opacity') > 0.05 && fl.width > 0) { const g = H.gap(fl, sb); if (g < worst) { worst = g; what = 'the settled flag' } }
    return { worst, what, sb }
  }
  const slowedChecks = (tag) => {
    const u = underSlowed()
    return [{ name: `LAB-CHECKS 14 ${tag}: SLOWED · ILLUSTRATION frame-fixed at x 1110 to 1563, y 380 to 420`, got: box(u.sb), want: '1110 to 1563, 380 to 420', pass: Math.abs(u.sb.left - 1110) < 1 && Math.abs(u.sb.right - 1563) < 2 && Math.abs(u.sb.top - 380) < 1 },
      { name: `LAB-CHECKS 14 ${tag}: nothing passes under it (nearest: ${u.what})`, got: u.worst, want: '>= 12', pass: u.worst >= 12 }]
  }
  const landings = () => {
    const Ls = [['the chart with its labels', A.PUSH], ['kicker', A.KICK], ['the guess\'s "?"', A.GUESS_END], ['"4 s" to "10 s"', A.WIDEN], ['in the band', A.LIT], ['settled', A.FLAG],
      ['SLOWED · ILLUSTRATION', A.SLOW0], ['scoop', A.SCOOP_L], ['small vibrato', A.SMALL], ['steady: ...', A.STAYS], ['a comfortable, fixed length', A.COMF], ['steady air keeps it there?', A.AIRQ],
      ['voice box', A.VB_L], ['muscles here set the note', A.SET], ['a steady note needs steady air too', A.NEEDS], ['the slider', A.BECAUSE], ['ILLUSTRATION (10h)', A.ILL10], ['a change in the air moves it', A.MOVES]].sort((a, b) => a[1] - b[1])
    let worst = Infinity, pair = ''
    for (let i = 1; i < Ls.length; i++) { const g = Ls[i][1] - Ls[i - 1][1]; if (g < worst) { worst = g; pair = `${Ls[i - 1][0]} / ${Ls[i][0]}` } }
    return [{ name: `0.4 s rule: the closest two landings (${pair})`, got: worst, want: '>= 0.40', pass: worst >= 0.4 - 1e-6 },
      { name: 'returns after the pull: the axis, "A, any octave", "settled", 0.2 to 0.3 s apart', got: `${(A.ANY_BACK - A.AXIS_BACK).toFixed(2)}, ${(A.SET_BACK - A.ANY_BACK).toFixed(2)}`, want: '0.20 to 0.30', pass: A.ANY_BACK - A.AXIS_BACK >= 0.2 && A.ANY_BACK - A.AXIS_BACK <= 0.3 && A.SET_BACK - A.ANY_BACK >= 0.2 && A.SET_BACK - A.ANY_BACK <= 0.3 + 1e-6 }]
  }
  const vis = (el) => H.alpha(el)
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.f0) out.push({ name: 'first frame (S9\'s last): the stack at full, its labels and both chips', got: `${S.stackWrap.getAttribute('opacity')} / ${S.stackLabels.map((l) => vis(l.el).toFixed(0)).join('')} / ${S.stackTags.map((g) => g.g.getAttribute('opacity')).join(' ')}`, want: '1.000 / 11111111 / 1.000 1.000' },
        { name: 'the settled flag\'s time by the page\'s rule (16 ms readings, 0.5 s within 35 c): entry and flag, the take\'s own time', got: `${A.ENTRY.toFixed(3)} / ${A.SETTLED.toFixed(3)} (world x ${(400 + 112 * A.ENTRY).toFixed(1)})`, want: 'about 0.69 / 1.19 (x 477)', pass: Math.abs(A.ENTRY - 0.69) < 0.03 }, ...landings())
      if (t === T.dim) out.push({ name: '10a: the stack at 25 %, its labels and chips hidden, its circles undrawn', got: `${S.stackWrap.getAttribute('opacity')} / ${vis(S.stackLabels[0].el).toFixed(2)} / ${S.rowTr[0].g.querySelector('ellipse').getAttribute('opacity')}`, want: '0.250 / 0.00 / 0' })
      if (t === T.gone) out.push({ name: '10a: the stack gone, up fast, before the chart fades in', got: `${S.stackWrap.getAttribute('opacity')}, ${S.ch.g.getAttribute('opacity')}`, want: '0.000, 0.000' })
      if (t === T.fadein) out.push({ name: '10b: the chart about 40 % as the push moves onto it (board 303.65)', got: +S.ch.g.getAttribute('opacity'), want: 0.42, tol: 0.05 })
      if (t === T.hold4) {
        const b = bandR(), m = mercR(), ao = R(S.anyOct.el), cw = R(S.chipW.box), z = R(S.ax.g.querySelector('text'))
        out.push({ name: '10b: F-hold, W 4: the plot x 232 to 1688, band y 416 to 644', got: box(b), want: '232 to 1688, 416 to 644', pass: Math.abs(b.left - 232) < 1 && Math.abs(b.right - 1688) < 1 && Math.abs(b.top - 416) < 1 && Math.abs(b.bottom - 644) < 1 },
          { name: '10b: Merc\'s line y 530', got: (m.top + m.bottom) / 2, want: 530, tol: 0.6 },
          { name: '10b: "A, any octave" from x 232, baseline 387', got: `${ao.left.toFixed(1)}, ${(S.cam.map(400, 290, t)[1]).toFixed(1)}`, want: '232, 387', pass: Math.abs(ao.left - 232) < 2 },
          { name: '10b: "ILLUSTRATION" right-aligned 1688', got: cw.right, want: 1688, tol: 2 },
          { name: '10b: the axis\'s "0" from x 232 (left-aligned 400), its baseline 690', got: `${z.left.toFixed(1)}, ${S.cam.map(400, 523, t)[1].toFixed(1)}`, want: '232, 690', pass: Math.abs(z.left - 232) < 3 },
          { name: '10b: the hosts back at 300 in the corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' },
          ...H.keepout(root, S.boxes))
      }
      if (t === T.guess) {
        const gp = R(S.guess.path), q = R(S.guess.qEl)
        out.push({ name: '10b: the dashed guess along y 530, x 232 to 1688', got: box(gp), want: '232 to 1688, about 530', pass: Math.abs(gp.left - 232) < 2 && Math.abs(gp.right - 1688) < 2 },
          { name: '10b: its "?" right of the plot (x 1709 on, y 514 to 560)', got: box(q), want: 'info', pass: q.left > 1700 && q.bottom < 600 },
          { name: '10b: Merc\'s line at 0 under the guess (DECISIONS 170)', got: S.ch.merc.g.getAttribute('opacity'), want: '0.000' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.widened) {
        const b = bandR(), tk = [...S.ax.g.querySelectorAll('rect')].filter((r) => +r.getAttribute('opacity') > 0.5).map((r) => R(r).left)
        const gaps = tk.slice(1).map((x, i) => x - tk[i])
        out.push({ name: '10b: W 10: the band y 484.5 to 575.5', got: box(b), want: '232 to 1688, 484.5 to 575.5', pass: Math.abs(b.top - 484.5) < 1 && Math.abs(b.bottom - 575.5) < 1 },
          { name: '10b: the ticks 146 px apart (1 to 9 s; "0" and "10 s" stand for the end ticks)', got: `${tk.length}: ${Math.min(...gaps).toFixed(1)} to ${Math.max(...gaps).toFixed(1)}`, want: '9: 145.6', pass: tk.length === 9 && Math.abs(Math.min(...gaps) - 145.6) < 1 && Math.abs(Math.max(...gaps) - 145.6) < 1 },
          { name: '10b: "10 s" shown, "4 s" gone', got: [...S.ax.g.querySelectorAll('text')].map((e) => `${e.textContent}:${(+e.getAttribute('opacity')).toFixed(1)}`).join(' '), want: 'info', pass: true })
      }
      if (t === T.lit) out.push({ name: '10c: the mint edge and "in the band" (x 544, baseline 387) lit once', got: `${R(S.inBand.el).left.toFixed(1)}, a ${vis(S.inBand.el).toFixed(2)}`, want: '544, 1', pass: Math.abs(R(S.inBand.el).left - 544) < 2 && vis(S.inBand.el) > 0.99 })
      if (t === T.flag) {
        const fl = R(S.flag.g.querySelector('rect')), lb = R(S.flag.label)
        out.push({ name: '10c (provisional, settled): the flag on the band\'s top edge at the entry (screen x 334.5 for world 478.8; y 464 to 484.5)', got: `${((fl.left + fl.right) / 2).toFixed(1)}, ${fl.top.toFixed(1)} to ${fl.bottom.toFixed(1)}`, want: 'about 332, 464 to 484.5', pass: Math.abs(fl.bottom - 484.5) < 1 && Math.abs((fl.left + fl.right) / 2 - (1.3 * (400 + 112 * A.ENTRY) - 288)) < 1 },
          { name: '10c: "settled" over it, baseline 455 (screen)', got: S.cam.map(0, 342, t)[1], want: 455, tol: 1 }, { name: '"settled" box', got: box(lb), want: 'info', pass: true })
      }
      if (t === T.back) out.push({ name: '10c: the guess and its "?" gone, Merc\'s line back to full', got: `${S.guess.g.getAttribute('opacity')}, ${S.ch.merc.g.getAttribute('opacity')}`, want: '0.000, 1.000' })
      if (t === T.whole) out.push(...waveChecks('at F-hold (1.3)', 26.5, 36.4), overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.scoop) {
        const b = bandR(), lp = (() => { const p = S.ch.lastLine('first')[0]; return S.cam.map(p[0], p[1], t) })()
        out.push({ name: '10d: CU-scoop: the band y 457 to 583', got: box(b), want: 'y 457 to 583', pass: Math.abs(b.top - 457) < 1 && Math.abs(b.bottom - 583) < 1 },
          { name: '10d: the scoop\'s low point (the take\'s start, -60 c) at (360, 628)', got: `${lp[0].toFixed(1)}, ${lp[1].toFixed(1)}`, want: '360, 628', pass: Math.abs(lp[0] - 360) < 1 && Math.abs(lp[1] - 628) < 1 },
          { name: '10d: the axis faded, the chart\'s chip out (faded over the first 0.5 s of the push)', got: `${S.ax.g.getAttribute('opacity')}, ${S.chipW.g.getAttribute('opacity')}`, want: '0.000, 0.000' }, ...waveChecks('at CU-scoop (1.8)', 36.7, 50.4), ...H.keepout(root, S.boxes))
      }
      if (t === T.slowed) out.push(...slowedChecks('at 326.20 + 0.3'), (() => { const sb = R(S.slowed.box), lb = R(S.flag.label); return { name: 'LAB-CHECKS 14: SLOWED clears "settled" (real width)', got: sb.left - lb.right, want: '>= 12', pass: sb.left - lb.right >= 12 } })())
      if (t === T.scoopL) { const sc = R(S.scoop.el); out.push({ name: '10d: "scoop" centred (360, 700 baseline), 54 px on screen', got: `${((sc.left + sc.right) / 2).toFixed(1)}, ${S.cam.map(400, 500, t)[1].toFixed(1)}`, want: '360, 700', pass: Math.abs((sc.left + sc.right) / 2 - 360) < 2 }, overlaps(), ...H.keepout(root, S.boxes)) }
      if (t === T.truck1 || t === T.truck2 || t === T.truck3 || t === T.truck4) out.push(...slowedChecks(`mid-truck (+${(t - A.TRUCK).toFixed(2)} s)`), overlaps())
      if (t === T.wave) {
        const cw = R(S.chipW.box), b = bandR()
        out.push({ name: '10e: CU-wave: the chart\'s chip at x 1408 to 1896, centred y 304, at full', got: `${box(cw)}, a ${S.chipW.g.getAttribute('opacity')}`, want: '1408 to 1896, 284 to 324, a 1', pass: Math.abs(cw.right - 1896) < 2 && +S.chipW.g.getAttribute('opacity') > 0.99 },
          { name: '10e: SLOWED left as the truck lands', got: S.slowed.g.getAttribute('opacity'), want: '< 0.1 by +0.2 s (info)', pass: true },
          { name: '10e: the band y 457 to 583', got: box(b), want: 'y 457 to 583', pass: Math.abs(b.top - 457) < 1 }, ...waveChecks('at CU-wave (1.8)', 36.7, 50.4), ...H.keepout(root, S.boxes))
      }
      if (t === T.vib) {
        const vb = R(S.vibBr.path), vl = R(S.vibrato.el)
        out.push({ name: '10e: the vibrato\'s bracket at screen x 1500, y 495 to 545', got: box(vb), want: 'x 1486 to 1500, y 495 to 545', pass: Math.abs(vb.right - 1500) < 1.5 && Math.abs(vb.top - 495) < 1.5 && Math.abs(vb.bottom - 545) < 1.5 },
          { name: '10e: "small vibrato: inside the band" from (888, 416)', got: `${vl.left.toFixed(1)}, ${S.cam.map(960, 342, t)[1].toFixed(1)}`, want: '888, 416', pass: Math.abs(vl.left - 888) < 3 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.inside) out.push({ name: '10e: the mint edge glows, "in the band" scales 1.08 (rising)', got: S.inBand.el.getAttribute('transform') || 'none', want: 'info', pass: !!S.inBand.el.getAttribute('transform') })
      if (t === T.pulled) { const b = bandR(); out.push({ name: '10f: back at F-hold, band 484.5 to 575.5', got: box(b), want: '232 to 1688, 484.5 to 575.5', pass: Math.abs(b.left - 232) < 1 && Math.abs(b.top - 484.5) < 1 }) }
      if (t === T.returned) out.push({ name: '10f: the axis, "A, any octave" and "settled" back', got: `${S.ax.g.getAttribute('opacity')} ${vis(S.anyOct.el).toFixed(2)} ${(+S.flag.label.getAttribute('opacity')).toFixed(2)}`, want: '1.000 1.00 1.00' }, overlaps())
      if (t === T.stays) { const st = R(S.steady.el); out.push({ name: '10f: "steady: settles into the band and stays" at (232, 322)', got: `${st.left.toFixed(1)}, ${S.cam.map(400, 240, t)[1].toFixed(1)}`, want: '232, 322', pass: Math.abs(st.left - 232) < 2 }, { name: '10f: the top bracket from the flag to the plot\'s end', got: box(R(S.topBr)), want: 'info', pass: true }, overlaps()) }
      if (t === T.comf) {
        const lb = R(S.lenBr.path), fl = R(S.fixedLen.el)
        out.push({ name: '10f: the bracket under the plot, 0 to 10 s, y 712', got: box(lb), want: '232 to 1688, 699 to 712', pass: Math.abs(lb.left - 232) < 1 && Math.abs(lb.right - 1688) < 1 && Math.abs(lb.bottom - 712) < 1 },
          { name: '10f: "a comfortable, fixed length" centred 960, baseline 760', got: `${((fl.left + fl.right) / 2).toFixed(1)}, ${S.cam.map(960, 577, t)[1].toFixed(1)}`, want: '960, 760', pass: Math.abs((fl.left + fl.right) / 2 - 960) < 2 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.airq) { const g = R(S.g10.el), q = R(S.g10Q.el), ln = R(S.g10Line); out.push({ name: '10g: her guess at (232, 257), its dashed underline and "?"', got: `${g.left.toFixed(1)}, ${S.cam.map(400, 190, t)[1].toFixed(1)}; line ${box(ln)}; ? ${box(q)}`, want: '232, 257', pass: Math.abs(g.left - 232) < 2 }, overlaps(), ...H.keepout(root, S.boxes)) }
      if (t === T.slid) {
        const b = bandR(), m = mercR()
        out.push({ name: '10h: the frame at x 1000 to 1640, band y 210 to 280 (screen)', got: box(b), want: '1000 to 1640, 210 to 280', pass: Math.abs(b.left - 1000) < 0.5 && Math.abs(b.right - 1640) < 0.5 && Math.abs(b.top - 210) < 0.5 && Math.abs(b.bottom - 280) < 0.5 },
          { name: '10h: Merc\'s line y 245, 4 px on screen', got: `${((m.top + m.bottom) / 2).toFixed(2)}, ${(+S.ch.merc.path.getAttribute('stroke-width') * S.cam.scale(t)).toFixed(2)}`, want: '245.00, 4.00' },
          { name: '10h: her line, the flag, the brackets and the labels gone', got: H.texts(root, 0.01).map((x) => x.text).join(' | ') || 'none', want: 'none' })
      }
      if (t === T.box) { const v = R(S.vb.g.querySelector('rect')); out.push({ name: '10h: the voice box x 300 to 640, y 190 to 510', got: box(v), want: '300 to 640, 190 to 510', pass: Math.abs(v.left - 300) < 2 && Math.abs(v.top - 190) < 2 }, overlaps(), ...H.keepout(root, S.boxes)) }
      if (t === T.needs) out.push(overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.line1 || t === T.line2) {
        const pts = S.lineCh.lastLine('silent'), hp = pts[pts.length - 1]
        const th = R(S.slider.thumb)
        out.push({ name: `10h: the silent line's head at x ${(1000 + (640 * (t - A.LINE0)) / 6).toFixed(1)} (106.7 px a second); the thumb`, got: `${hp[0].toFixed(1)}; thumb ${((th.left + th.right) / 2).toFixed(1)}, p ${S.slider.val.textContent}`, want: 'info', pass: Math.abs(hp[0] - (1000 + (640 * (t - A.LINE0)) / 6)) < 1.5 },
          { name: '10h: "ILLUSTRATION" on the frame at x 1369 to 1640, y 156 to 196', got: box(R(S.ill10.box)), want: '1369 to 1640, 156 to 196', pass: Math.abs(R(S.ill10.box).right - 1640) < 1.5 && Math.abs(R(S.ill10.box).top - 156) < 1 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.lastLeg) {
        const pts = S.lineCh.lastLine('silent').filter((p) => p[0] > 1000 + 0.6 * 106.7)
        const peaks = []
        for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) peaks.push(pts[i][0])
        const gaps = peaks.slice(1).map((x, i) => x - peaks[i]), cyc = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)
        out.push({ name: '10h: the silent line\'s cycle 19.4 px (W 6 on the 640 px frame, 1.0 px a cent)', got: cyc, want: 19.4, tol: 1.94 },
          { name: '10h: its rise with the thumb at 75: 30 px over Merc\'s line (y 215, less the wave)', got: Math.min(...S.lineCh.lastLine('silent').map((p) => p[1])), want: 'about 245 - 30 - 14 = 201', pass: Math.abs(Math.min(...S.lineCh.lastLine('silent').map((p) => p[1])) - 201) < 3 })
      }
      if (t === T.last) {
        const b = bandR(), m = mercR()
        out.push({ name: 'last frame (S10 to S11, LAB-CHECKS 2): the empty frame at x 1000 to 1640, band y 210 to 280', got: box(b), want: '1000 to 1640, 210 to 280', pass: Math.abs(b.left - 1000) < 0.5 && Math.abs(b.right - 1640) < 0.5 && Math.abs(b.top - 210) < 0.5 && Math.abs(b.bottom - 280) < 0.5 },
          { name: 'last frame: Merc\'s line y 245, 4 px', got: `${((m.top + m.bottom) / 2).toFixed(2)}, ${(+S.ch.merc.path.getAttribute('stroke-width') * S.cam.scale(t)).toFixed(2)}`, want: '245.00, 4.00' },
          { name: 'last frame: no label, no slider, no line, no box', got: `${H.texts(root, 0.01).map((x) => x.text).join(' | ') || 'none'}; slider ${S.slider.g.getAttribute('opacity')}; line ${S.lineCh.g.getAttribute('opacity')}/${S.lineCh.g.querySelector('.lines g') && S.lineCh.g.querySelector('.lines g').getAttribute('opacity')}; box ${S.vb.g.getAttribute('opacity')}`, want: 'none; slider 0.000; line ...0.000; box 0.000', pass: H.texts(root, 0.01).length === 0 && +S.slider.g.getAttribute('opacity') === 0 && +S.vb.g.getAttribute('opacity') === 0 },
          { name: 'last frame: the camera at F-hold', got: JSON.stringify(S.cam.state(t)), want: 's 1.3, ox -288, oy 10', pass: Math.abs(S.cam.state(t).s - 1.3) < 1e-6 },
          { name: 'last frame: hosts at 300 in the corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' })
      }
      return out
    },
  }
})()
