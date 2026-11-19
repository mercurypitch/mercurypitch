// s10-steady's checks (lab/s05-push/probe.mjs, unchanged): the first frame against S9's last, the stack's dim and exit,
// the push to F-hold and the hold chart's places (HANDOFFS § The hold chart, § Framings), the guess, the window
// widening, the lit edge and the settled flag (provisional: its time by the page's rule), the wave rule at F-hold,
// CU-scoop, CU-wave and in 10h's frame, LAB-CHECKS 14 (SLOWED through the truck), the returns, 10f to 10h's places, the
// frame on L.CHART.FRAME's screen pixels at the last frame (LAB-CHECKS 2, S10 to S11), overlaps, keep-out, 0.4 s.
// Fix round F-01 (DECISIONS 226, 233): the hold chart as the lead subject (k 2.5 world px a cent through the widening,
// Merc's line at world y 358), the band 220 px or more and the plot 1150 or more at F-hold from the push in to "No.",
// the band's edges in frame at the close-ups, every label's ink 12 px or more from every stroke, the strokes clear of
// the hosts' keep-outs, the settled flag's pulse on the flag only (its label never scales).
;(function () {
  const H = window.__H, sid = 's10-steady'
  const S = window.__sceneProbe[sid], A = S.A
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const T = {
    f0: 0, dim: A.ACT + 0.25, stackGo: A.STACK_OUT + 0.001, gone: A.STACK_OUT + 0.3, chFull: A.PUSH - 0.001, hold4: A.PUSH + A.PUSH_D + 0.05, guess: A.GUESS_END + 0.3, widened: A.WIDEN + 0.85,
    lit: A.LIT + 0.45, flag: A.FLAG + 0.35, back: A.GUESS_OUT + 0.55, whole: A.DEMO + 10.1, scoop: A.PUSH2 + A.PUSH2_D + 0.05, slowed: A.SLOW0 + 0.3, scoopL: A.SCOOP_L + 0.3,
    truck1: A.TRUCK + 0.5, truck2: A.TRUCK + 1.0, truck3: A.TRUCK + 1.5, truck4: A.TRUCK + 1.95, wave: A.TRUCK + A.TRUCK_D + 0.05, vib: A.SMALL + 0.5, inside: A.INSIDE + 0.15,
    pulled: A.PULL + A.PULL_D + 0.02, returned: A.SET_BACK + 0.45, stays: A.STAYS + 0.7, comf: A.COMF + 0.7, airq: A.AIRQ + 0.4,
    setPulse: A.SET_BACK + 0.1, push1: A.PUSH + 0.75, push2a: A.PUSH2 + 0.75, pull1: A.PULL + 0.73, slide1: A.BOX + 0.2, slide2: A.BOX + 0.45,
    struck: A.CLR0 - 0.05, clr1: A.CLR0 + 0.15, clrLast: A.CLR.line + 0.001, cleared: A.SLIDE - 0.001, slid: A.SLIDE + A.SLIDE_D + 0.05,
    box: A.VB_L + 0.3, needs: A.NEEDS + 0.3, slider: A.SLID0 + 0.45, line1: A.ILL10 + 0.3, movesFull: A.BECAUSE + 0.3, peak: A.BECAUSE + A.PUSH_LEG + 0.02, line2: A.BECAUSE + 2 * A.PUSH_LEG + 0.1,
    lastLeg: A.END_FADE - 0.02, rule: A.D - 0.13 + 0.001, last: A.D - 0.0005,
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
  // F-01: the ink box of a label (canvas metrics in its own font through its screen CTM)
  const inkBox = (el) => {
    const cs = getComputedStyle(el)
    const ink = H.ink(el.textContent, `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, el.getAttribute('text-anchor') || 'start')
    const x = +(el.getAttribute('x') || 0), y = +(el.getAttribute('y') || 0), m = el.getScreenCTM()
    const Q = (px, py) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]
    const a = Q(x + ink.l, y - ink.up), b = Q(x + ink.r, y + ink.down)
    return { left: Math.min(a[0], b[0]), right: Math.max(a[0], b[0]), top: Math.min(a[1], b[1]), bottom: Math.max(a[1], b[1]) }
  }
  const grow = (r, d) => ({ left: r.left - d, right: r.right + d, top: r.top - d, bottom: r.bottom + d })
  const on = (el, min = 0.05) => H.alpha(el) >= min
  // every visible label (ink) and tag (its box), with the marks it is drawn with (never measured against them)
  const labelsNow = () => {
    const L = []
    const add = (name, el, own = []) => { if (el && on(el, 0.3)) L.push({ name, r: inkBox(el), own }) }
    add('A, any octave', S.anyOct.el); add('in the band', S.inBand.el); add('settled', S.flag.label, ['flag']); add('scoop', S.scoop.el)
    add('small vibrato', S.vibrato.el); add('steady: ...', S.steady.el); add('a comfortable, fixed length', S.fixedLen.el)
    add('steady air keeps it there?', S.g10.el, ['g10Line', 'strike']); add('its "?"', S.g10Q.el, ['g10Line', 'strike']); add('the guess\'s "?"', S.guess.qEl, ['guess'])
    for (const e of S.ax.g.querySelectorAll('text')) add(`axis "${e.textContent}"`, e)
    for (const [n, tg] of [['ILLUSTRATION chip', S.chipW], ['SLOWED', S.slowed]]) if (on(tg.g, 0.3)) L.push({ name: n, r: H.R(tg.box), own: [] })
    return L
  }
  // every visible stroke: { name, r (screen rect, its stroke included) } or { name, pts, half } for her lines
  const strokesNow = (t) => {
    const s = S.cam.scale(t), out = []
    if (on(S.ch.g)) {
      const br = [...S.ch.g.querySelectorAll('.band > rect')].slice(1)
      for (const r of br) out.push({ name: 'the band\'s edge', r: H.R(r) })
      const lit = [...S.ch.g.querySelectorAll('.band g rect')].slice(2)
      if (+S.ch.g.querySelector('.band g').getAttribute('opacity') > 0.05) for (const r of lit) out.push({ name: 'the mint edge', r: H.R(r) })
      if (on(S.ch.merc.path)) out.push({ name: 'Merc\'s line', r: grow(H.R(S.ch.merc.path), (+S.ch.merc.path.getAttribute('stroke-width') * s) / 2) })
      const groups = [...S.ch.g.querySelectorAll('.lines > g')], ids = ['first', 'held', 'slowDeep', 'slow'], ctm = S.ch.g.getScreenCTM()
      groups.forEach((g, i) => {
        if (+g.getAttribute('opacity') < 0.05) return
        out.push({ name: 'her line', pts: S.ch.lastLine(ids[i]).map((p) => [ctm.a * p[0] + ctm.e, ctm.d * p[1] + ctm.f]), half: 2 * s })
        const dot = g.querySelectorAll('circle')[1]
        if (+dot.getAttribute('opacity') > 0.05) out.push({ name: 'her line\'s head', r: H.R(dot) })
      })
      if (on(S.guess.path)) out.push({ name: 'guess', r: grow(H.R(S.guess.path), 1.5 * s) })
      if (on(S.guessHead)) out.push({ name: 'the guess\'s head', r: H.R(S.guessHead.querySelectorAll('circle')[1]) })
      if (on(S.flag.g)) for (const el of S.flagMarks) out.push({ name: 'flag', r: H.R(el) })
      if (on(S.topBr)) out.push({ name: 'the "stays" bracket', r: grow(H.R(S.topBr), s) })
      if (on(S.lenBr.path)) out.push({ name: 'the length bracket', r: grow(H.R(S.lenBr.path), s) })
      if (on(S.ax.g)) for (const r of S.ax.g.querySelectorAll('rect')) if (+r.getAttribute('opacity') > 0.05) out.push({ name: 'a tick', r: H.R(r) })
      if (on(S.vibG)) for (const el of [S.vibHi, S.vibLo]) out.push({ name: 'the vibrato\'s hairlines', r: grow(H.R(el), 0.75) })
      if (on(S.g10Line)) out.push({ name: 'g10Line', r: grow(H.R(S.g10Line), 1.5 * s) })
      if (on(S.strike)) out.push({ name: 'strike', r: grow(H.R(S.strike), 1.5 * s) })
    }
    return out
  }
  const ptGap = (r, p, half) => Math.hypot(Math.max(r.left - p[0], 0, p[0] - r.right), Math.max(r.top - p[1], 0, p[1] - r.bottom)) - half
  const clearance = (t, tag) => {
    let worst = Infinity, pair = ''
    for (const l of labelsNow()) for (const st of strokesNow(t)) {
      if (l.own.includes(st.name)) continue
      const g = st.pts ? Math.min(...st.pts.map((p) => ptGap(l.r, p, st.half))) : H.gap(l.r, st.r)
      if (g < worst) { worst = g; pair = `${l.name} / ${st.name}` }
    }
    return { name: `226: every label 12 px or more from every stroke, ${tag} (nearest: ${pair || 'none'})`, got: worst === Infinity ? 'none' : worst, want: '>= 12', pass: worst === Infinity || worst >= 12 - 0.3 }
  }
  // the hosts' keep-outs (body box + 20) against the strokes: the band's edges, her line, the brackets, the ticks
  const strokeKeepout = (t) => {
    let worst = Infinity, what = ''
    for (const [who, b] of Object.entries(S.boxes || {})) {
      if (!b) continue
      const hb = { left: b.x0, right: b.x1, top: b.y0, bottom: b.y1 }
      for (const st of strokesNow(t)) {
        const vis = (r) => r.right > 0 && r.left < 1920 && r.bottom > 0 && r.top < 1080
        const g = st.pts ? Math.min(...st.pts.filter((p) => p[0] >= -10 && p[0] <= 1930).map((p) => ptGap(hb, p, st.half)), Infinity) : vis(st.r) ? H.gap(hb, st.r) : Infinity
        if (g < worst) { worst = g; what = `${st.name} / ${who}` }
      }
    }
    return { name: `keep-out: every stroke 20 px or more from the hosts' body boxes (nearest: ${what || 'none'})`, got: worst === Infinity ? 'none' : worst, want: '>= 20', pass: worst === Infinity || worst >= 20 - 0.3 }
  }
  const fill226 = (t, tag) => {
    const b = bandR()
    return [{ name: `226: the lead subject at F-hold ${tag}: the band 220 px or more, the plot 1150 or more`, got: `band ${b.height.toFixed(1)}, plot ${b.width.toFixed(1)} (${box(b)})`, want: '>= 220, >= 1150', pass: b.height >= 220 && b.width >= 1150 && Math.abs(S.cam.state(t).s - 1.3) < 1e-6 },
      clearance(t, tag), strokeKeepout(t)]
  }
  const cu226 = (t, tag) => {
    const b = bandR(), eT = H.R(S.ch.g.querySelectorAll('.band > rect')[1]), eB = H.R(S.ch.g.querySelectorAll('.band > rect')[2])
    return [{ name: `226: the band's edges in frame ${tag}`, got: `${eT.top.toFixed(1)} to ${eB.bottom.toFixed(1)} (band ${b.height.toFixed(1)} px)`, want: 'within 0 to 1080', pass: eT.top >= 0 && eB.bottom <= 1080 },
      clearance(t, tag), strokeKeepout(t)]
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
  // 226: the cents scale stays 2.5 world px a cent at W 10, so the wave grows with the band (the wave rule's 1.375 gives
  // way here): a cycle 112 / 5.5 world px and 70 world px peak to peak, ratio 3.44 in every framing
  const waveChecks = (tag, cyc, pp) => {
    const w = waveOf(S.ch, 'held', 400 + 112 * 3, 400 + 112 * 6)
    return [{ name: `the wave ${tag}: one cycle ${cyc} px (within 10 %)`, got: w.cyc, want: cyc, tol: cyc * 0.1 }, { name: `the wave ${tag}: peak to peak ${pp} px (226: 2.5 world px a cent)`, got: w.pp, want: pp, tol: pp * 0.1 },
      { name: `the wave ${tag}: ratio 3.44 (226)`, got: w.pp / w.cyc, want: 3.44, tol: 0.2 }]
  }
  // LAB-CHECKS 14: what passes near the frame-fixed SLOWED chip: every visible text, the band, the lines' points
  const underSlowed = () => {
    const sb = R(S.slowed.box)
    let worst = Infinity, what = ''
    for (const tx of H.texts(root, 0.05)) { if (/SLOWED/.test(tx.text)) continue; const g = H.gap(tx.r, sb); if (g < worst) { worst = g; what = tx.text } }
    const b = bandR(); if (b.top - sb.bottom < worst) { worst = b.top - sb.bottom; what = 'the band\'s top' }
    const ctm = S.ch.g.getScreenCTM()
    for (const id of ['first', 'held', 'slowDeep', 'slow']) for (const p of S.ch.lastLine(id)) {
      const x = ctm.a * p[0] + ctm.e, y = ctm.d * p[1] + ctm.f
      const g = Math.hypot(Math.max(sb.left - x, 0, x - sb.right), Math.max(sb.top - y, 0, y - sb.bottom)) - 2
      if (g < worst) { worst = g; what = 'her line' }
    }
    const fl = R(S.flag.g); if (+S.flag.g.getAttribute('opacity') > 0.05 && fl.width > 0) { const g = H.gap(fl, sb); if (g < worst) { worst = g; what = 'the settled flag' } }
    return { worst, what, sb }
  }
  const slowedChecks = (tag) => {
    const u = underSlowed()
    return [{ name: `LAB-CHECKS 14 ${tag}: SLOWED · ILLUSTRATION frame-fixed at x 1110 to 1563, y 212 to 252 (226; y 380 to 420 before)`, got: box(u.sb), want: '1110 to 1563, 212 to 252', pass: Math.abs(u.sb.left - 1110) < 1 && Math.abs(u.sb.right - 1563) < 2 && Math.abs(u.sb.top - 212) < 1 },
      { name: `LAB-CHECKS 14 ${tag}: nothing passes under it (nearest: ${u.what})`, got: u.worst, want: '>= 12', pass: u.worst >= 12 }]
  }
  const landings = () => {
    const Ls = [['the chart with its labels', A.CH_IN], ['kicker', A.KICK], ['the guess\'s "?"', A.GUESS_END], ['"4 s" to "10 s"', A.WIDEN], ['in the band', A.LIT], ['settled', A.FLAG],
      ['SLOWED · ILLUSTRATION', A.SLOW0], ['scoop', A.SCOOP_L], ['small vibrato', A.SMALL], ['steady: ...', A.STAYS], ['a comfortable, fixed length', A.COMF], ['steady air keeps it there?', A.AIRQ],
      ['voice box', A.VB_L], ['muscles here set the note', A.SET], ['a steady note needs steady air too', A.NEEDS], ['the slider', A.SLID0], ['ILLUSTRATION (10h)', A.ILL10], ['a change in the air moves it', A.BECAUSE]].sort((a, b) => a[1] - b[1])
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
      if (t === T.stackGo) out.push({ name: '196: the stack leaves (up fast, from dim) as the card starts to leave', got: `stack out ${A.STACK_OUT.toFixed(3)}, card out ${A.CARD_OUT.toFixed(3)}; stack ${S.stackWrap.getAttribute('opacity')}`, want: 'equal; 0.250', pass: A.STACK_OUT === A.CARD_OUT && Math.abs(+S.stackWrap.getAttribute('opacity') - 0.25) < 0.002 })
      if (t === T.gone) out.push({ name: '10a: the stack gone up fast before the chart comes in (linear 0.25 s from here)', got: `${S.stackWrap.getAttribute('opacity')}, ${S.ch.g.getAttribute('opacity')}`, want: '0.000, 0.000', pass: +S.stackWrap.getAttribute('opacity') === 0 && +S.ch.g.getAttribute('opacity') === 0 })
      if (t === T.chFull) out.push({ name: '200: the hold chart at full strength before the push starts (its labels and chip too)', got: `chart ${S.ch.g.getAttribute('opacity')}, "A, any octave" ${vis(S.anyOct.el).toFixed(3)}, chip ${S.chipW.g.getAttribute('opacity')}; full at ${(A.CH_IN + A.CH_IN_D).toFixed(3)}, push ${A.PUSH.toFixed(3)}; camera s ${S.cam.state(t).s.toFixed(4)}`, want: '1.000 at the push\'s start, F0', pass: +S.ch.g.getAttribute('opacity') === 1 && vis(S.anyOct.el) > 0.999 && A.CH_IN + A.CH_IN_D < A.PUSH && Math.abs(S.cam.state(t).s - 1) < 1e-6 })
      if (t === T.hold4) {
        const b = bandR(), m = mercR(), ao = R(S.anyOct.el), cw = R(S.chipW.box), z0 = S.ax.g.querySelector('text'), z = R(z0)
        out.push({ name: '10b: F-hold, W 4: the plot x 232 to 1688, band y 361.65 to 589.15 (226: world 270.5 to 445.5, Merc\'s line 358)', got: box(b), want: '232 to 1688, 361.65 to 589.15', pass: Math.abs(b.left - 232) < 1 && Math.abs(b.right - 1688) < 1 && Math.abs(b.top - 361.65) < 1 && Math.abs(b.bottom - 589.15) < 1 },
          { name: '10b: Merc\'s line y 475.4', got: (m.top + m.bottom) / 2, want: 475.4, tol: 0.6 },
          { name: '10b: "A, any octave" from x 232, baseline 277.8 (world 206)', got: `${ao.left.toFixed(1)}, ${(S.cam.map(400, +S.anyOct.el.getAttribute('y'), t)[1]).toFixed(1)}`, want: '232, 277.8', pass: Math.abs(ao.left - 232) < 2 && Math.abs(S.cam.map(400, +S.anyOct.el.getAttribute('y'), t)[1] - 277.8) < 0.5 },
          { name: '10b: "ILLUSTRATION" right-aligned 1688, centred y 263.5 (world 195)', got: `${cw.right.toFixed(1)}, ${((cw.top + cw.bottom) / 2).toFixed(1)}`, want: '1688, 263.5', pass: Math.abs(cw.right - 1688) < 2 && Math.abs((cw.top + cw.bottom) / 2 - 263.5) < 1 },
          { name: '10b: the axis\'s "0" from x 232 (left-aligned 400), its baseline 725 (world 550)', got: `${z.left.toFixed(1)}, ${S.cam.map(400, +z0.getAttribute('y'), t)[1].toFixed(1)}`, want: '232, 725', pass: Math.abs(z.left - 232) < 3 && Math.abs(S.cam.map(400, +z0.getAttribute('y'), t)[1] - 725) < 0.5 },
          { name: '10b: the hosts back at 300 in the corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' },
          ...H.keepout(root, S.boxes), ...fill226(t, 'at W 4 (10b)'))
      }
      if (t === T.push1) out.push(clearance(t, 'mid-push to F-hold'), strokeKeepout(t))
      if (t === T.guess) {
        const gp = R(S.guess.path), q = R(S.guess.qEl)
        out.push({ name: '10b: the dashed guess along y 475.4, x 232 to 1688', got: box(gp), want: '232 to 1688, about 475.4', pass: Math.abs(gp.left - 232) < 2 && Math.abs(gp.right - 1688) < 2 && Math.abs((gp.top + gp.bottom) / 2 - 475.4) < 1 },
          { name: '10b: its "?" right of the plot (x 1709 on), clear of Tavi\'s keep-out (from y 628)', got: box(q), want: 'info', pass: q.left > 1700 && q.bottom < 600 },
          { name: '10b: Merc\'s line at 0 under the guess (DECISIONS 170)', got: S.ch.merc.g.getAttribute('opacity'), want: '0.000' }, ...H.keepout(root, S.boxes), ...fill226(t, 'under the guess (10b)'))
      }
      if (t === T.widened) {
        const b = bandR(), tk = [...S.ax.g.querySelectorAll('rect')].filter((r) => +r.getAttribute('opacity') > 0.5).map((r) => R(r).left)
        const gaps = tk.slice(1).map((x, i) => x - tk[i])
        out.push({ name: '226: W 10: the band unchanged as the window widens (k 2.5), y 361.65 to 589.15', got: box(b), want: '232 to 1688, 361.65 to 589.15', pass: Math.abs(b.top - 361.65) < 1 && Math.abs(b.bottom - 589.15) < 1 },
          { name: '10b: the ticks 146 px apart (1 to 9 s; "0" and "10 s" stand for the end ticks)', got: `${tk.length}: ${Math.min(...gaps).toFixed(1)} to ${Math.max(...gaps).toFixed(1)}`, want: '9: 145.6', pass: tk.length === 9 && Math.abs(Math.min(...gaps) - 145.6) < 1 && Math.abs(Math.max(...gaps) - 145.6) < 1 },
          { name: '10b: "10 s" shown, "4 s" gone', got: [...S.ax.g.querySelectorAll('text')].map((e) => `${e.textContent}:${(+e.getAttribute('opacity')).toFixed(1)}`).join(' '), want: 'info', pass: true }, ...fill226(t, 'at W 10'))
      }
      if (t === T.lit) out.push({ name: '10c: the mint edge and "in the band" (x 544, baseline 277.8) lit once', got: `${R(S.inBand.el).left.toFixed(1)}, a ${vis(S.inBand.el).toFixed(2)}`, want: '544, 1', pass: Math.abs(R(S.inBand.el).left - 544) < 2 && vis(S.inBand.el) > 0.99 }, ...fill226(t, 'as she enters the band (10c)'))
      if (t === T.flag) {
        const fl = R(S.flag.g.querySelector('rect')), lb = R(S.flag.label)
        out.push({ name: '10c (settled): the flag on the band\'s top edge at the entry (screen x 334.5 for world 478.8; y 340.85 to 361.65)', got: `${((fl.left + fl.right) / 2).toFixed(1)}, ${fl.top.toFixed(1)} to ${fl.bottom.toFixed(1)}`, want: 'about 334.5, 340.85 to 361.65', pass: Math.abs(fl.bottom - 361.65) < 1 && Math.abs((fl.left + fl.right) / 2 - (1.3 * (400 + 112 * A.ENTRY) - 288)) < 1 },
          { name: '10c: "settled" over it, baseline 331.75 (screen; world 247.5)', got: S.cam.map(0, +S.flag.label.getAttribute('y'), t)[1], want: 331.75, tol: 1 }, { name: '"settled" box', got: box(lb), want: 'info', pass: true }, ...fill226(t, 'at the flag (10c)'))
      }
      if (t === T.back) out.push({ name: '10c: the guess and its "?" gone, Merc\'s line back to full', got: `${S.guess.g.getAttribute('opacity')}, ${S.ch.merc.g.getAttribute('opacity')}`, want: '0.000, 1.000' })
      if (t === T.whole) out.push(...waveChecks('at F-hold (1.3)', 26.5, 91), overlaps(), ...H.keepout(root, S.boxes), ...fill226(t, 'her whole take'))
      if (t === T.scoop) {
        const b = bandR(), lp = (() => { const p = S.ch.lastLine('first')[0]; return S.cam.map(p[0], p[1], t) })()
        out.push({ name: '10d: CU-scoop: the band y 286.9 to 601.9', got: box(b), want: 'y 286.9 to 601.9', pass: Math.abs(b.top - 286.9) < 1 && Math.abs(b.bottom - 601.9) < 1 },
          { name: '10d: the scoop\'s low point (the take\'s start, -60 c) at (360, 714.4)', got: `${lp[0].toFixed(1)}, ${lp[1].toFixed(1)}`, want: '360, 714.4', pass: Math.abs(lp[0] - 360) < 1 && Math.abs(lp[1] - 714.4) < 1 },
          { name: '10d: the axis faded, the chart\'s chip out (faded over the first 0.5 s of the push)', got: `${S.ax.g.getAttribute('opacity')}, ${S.chipW.g.getAttribute('opacity')}`, want: '0.000, 0.000' }, ...waveChecks('at CU-scoop (1.8)', 36.7, 126), ...H.keepout(root, S.boxes), ...cu226(t, 'at CU-scoop'))
      }
      if (t === T.push2a) out.push(clearance(t, 'mid-push to CU-scoop'), strokeKeepout(t))
      if (t === T.pull1) out.push(clearance(t, 'mid-pull to F-hold'), strokeKeepout(t))
      if (t === T.setPulse) {
        const fl = S.flagMarks[0]
        out.push({ name: '233: on "settles" the flag scales 1.2 (pole and pennant) while "settled" never scales (its type step at 326.93)', got: `flag ${fl.getAttribute('transform') ? 'scaled' : 'none'}, label ${S.flag.label.getAttribute('transform') || 'none'}, group ${S.flag.g.getAttribute('transform') || 'none'}`, want: 'flag scaled, label none, group none', pass: !!fl.getAttribute('transform') && !S.flag.label.getAttribute('transform') && !S.flag.g.getAttribute('transform') })
      }
      if (t === T.slowed) out.push(...slowedChecks('at 326.20 + 0.3'), ...cu226(t, 'under SLOWED'), (() => { const sb = R(S.slowed.box), lb = R(S.flag.label); return { name: 'LAB-CHECKS 14: SLOWED clears "settled" (real width)', got: sb.left - lb.right, want: '>= 12', pass: sb.left - lb.right >= 12 } })())
      if (t === T.scoopL) { const sc = R(S.scoop.el); out.push({ name: '10d: "scoop" centred (360, 772 baseline; world (400, 540)), 54 px on screen, under the low point', got: `${((sc.left + sc.right) / 2).toFixed(1)}, ${S.cam.map(400, +S.scoop.el.getAttribute('y'), t)[1].toFixed(1)}`, want: '360, 772', pass: Math.abs((sc.left + sc.right) / 2 - 360) < 2 && Math.abs(S.cam.map(400, +S.scoop.el.getAttribute('y'), t)[1] - 772) < 0.5 }, overlaps(), ...H.keepout(root, S.boxes), ...cu226(t, 'with "scoop"')) }
      if (t === T.truck1 || t === T.truck2 || t === T.truck3 || t === T.truck4) out.push(...slowedChecks(`mid-truck (+${(t - A.TRUCK).toFixed(2)} s)`), overlaps(), ...cu226(t, `mid-truck (+${(t - A.TRUCK).toFixed(2)} s)`))
      if (t === T.wave) {
        const cw = R(S.chipW.box), b = bandR()
        out.push({ name: '10e: CU-wave: the chart\'s chip at x 1408 to 1896, centred y 151, at full', got: `${box(cw)}, a ${S.chipW.g.getAttribute('opacity')}`, want: '1408 to 1896, 131 to 171, a 1', pass: Math.abs(cw.right - 1896) < 2 && Math.abs((cw.top + cw.bottom) / 2 - 151) < 1 && +S.chipW.g.getAttribute('opacity') > 0.99 },
          { name: '10e: SLOWED left as the truck lands', got: S.slowed.g.getAttribute('opacity'), want: '< 0.1 by +0.2 s (info)', pass: true },
          { name: '10e: the band y 286.9 to 601.9', got: box(b), want: 'y 286.9 to 601.9', pass: Math.abs(b.top - 286.9) < 1 }, ...waveChecks('at CU-wave (1.8)', 36.7, 126), ...H.keepout(root, S.boxes), ...cu226(t, 'at CU-wave'))
      }
      if (t === T.vib) {
        const hi = R(S.vibHi), lo = R(S.vibLo), vl = R(S.vibrato.el), b = bandR()
        const w = waveOf(S.ch, 'held', (hi.left + 840) / 1.8, (hi.right + 840) / 1.8)
        const ctm = S.ch.g.getScreenCTM(), pts = S.ch.lastLine('held').filter((p) => { const x = ctm.a * p[0] + ctm.e; return x >= hi.left && x <= hi.right }).map((p) => ctm.d * p[1] + ctm.f)
        const crest = Math.min(...pts) - 3.6, trough = Math.max(...pts) + 3.6   // the line's outer edges (stroke 4 world, 7.2 px)
        out.push({ name: '199: the vibrato\'s height as two ink hairlines, 240 px long, under the label\'s middle', got: `${box(hi)} / ${box(lo)}; label middle ${((vl.left + vl.right) / 2).toFixed(1)}`, want: '240 px each, centred on the label', pass: Math.abs(hi.width - 240) < 3 && Math.abs(lo.width - 240) < 3 && Math.abs((hi.left + hi.right) / 2 - (vl.left + vl.right) / 2) < 3 },
          { name: '199: at the crest and trough heights (the line\'s outer edges), ticks 10 px across the ends', got: `top line y ${((hi.top + hi.bottom) / 2).toFixed(1)} (crest edge ${crest.toFixed(1)}), bottom line y ${((lo.top + lo.bottom) / 2).toFixed(1)} (trough edge ${trough.toFixed(1)}); ticks ${(hi.height).toFixed(1)}, ${(lo.height).toFixed(1)}`, want: 'within 1.5 px; ticks 10 across', pass: Math.abs((hi.top + hi.bottom) / 2 - crest) < 1.5 && Math.abs((lo.top + lo.bottom) / 2 - trough) < 1.5 && Math.abs(hi.height - 10) < 1.5 },
          { name: '199: ink, 1.5 px on screen, clear of the band\'s edges', got: `${S.vibHi.getAttribute('stroke')}, ${S.vibHi.getAttribute('stroke-width')} (non-scaling); ${(hi.top - b.top).toFixed(1)} and ${(b.bottom - lo.bottom).toFixed(1)} px from the edges`, want: '>= 12 from the edges', pass: hi.top - b.top >= 12 && b.bottom - lo.bottom >= 12 }, { name: '199: vs the crop the critic took (C-01 item 10): before, a 2 px chrome bracket on the 4 px wave', got: 'two ink hairlines, see fix-C-01/crop-vibrato-33.95.png', want: 'info', pass: true },
          { name: '10e: "small vibrato: inside the band" from (888, 255.4) (world (960, 253)), over the band\'s top edge', got: `${vl.left.toFixed(1)}, ${S.cam.map(960, +S.vibrato.el.getAttribute('y'), t)[1].toFixed(1)}`, want: '888, 255.4', pass: Math.abs(vl.left - 888) < 3 && Math.abs(S.cam.map(960, +S.vibrato.el.getAttribute('y'), t)[1] - 255.4) < 0.5 }, overlaps(), ...H.keepout(root, S.boxes), ...cu226(t, 'with the vibrato\'s marks'))
      }
      if (t === T.inside) out.push({ name: '10e: the mint edge glows, "in the band" scales 1.08 (rising)', got: S.inBand.el.getAttribute('transform') || 'none', want: 'info', pass: !!S.inBand.el.getAttribute('transform') }, ...cu226(t, 'as the edge glows'))
      if (t === T.pulled) { const b = bandR(); out.push({ name: '10f: back at F-hold, band 361.65 to 589.15', got: box(b), want: '232 to 1688, 361.65 to 589.15', pass: Math.abs(b.left - 232) < 1 && Math.abs(b.top - 361.65) < 1 }, ...fill226(t, 'after the pull (10f)')) }
      if (t === T.returned) out.push({ name: '10f: the axis, "A, any octave" and "settled" back', got: `${S.ax.g.getAttribute('opacity')} ${vis(S.anyOct.el).toFixed(2)} ${(+S.flag.label.getAttribute('opacity')).toFixed(2)}`, want: '1.000 1.00 1.00' }, overlaps(), ...fill226(t, 'as they return'))
      if (t === T.stays) {
        const st = R(S.steady.el), tb = R(S.topBr), b = bandR(), lb = R(S.flag.label)
        const edgeTop = b.top - 1.5 * 1.3   // the mint edge, 3 world px about the band's top
        out.push({ name: '10f: "steady: settles into the band and stays" at (232, 221.9) (world baseline 163)', got: `${st.left.toFixed(1)}, ${S.cam.map(400, +S.steady.el.getAttribute('y'), t)[1].toFixed(1)}`, want: '232, 221.9', pass: Math.abs(st.left - 232) < 2 && Math.abs(S.cam.map(400, +S.steady.el.getAttribute('y'), t)[1] - 221.9) < 0.5 },
          { name: '199: the "stays" bracket 16 px or more above the mint edge (its ticks\' ends to the edge\'s top)', got: `${box(tb)}; ${(edgeTop - (tb.bottom + 1.3)).toFixed(1)} px ink to ink`, want: '>= 16', pass: edgeTop - (tb.bottom + 1.3) >= 16 - 0.05 },
          { name: '199: the bracket from 12 px right of "settled" (its ink; F-01: the tick\'s half stroke beyond) to the plot\'s end (1688)', got: `${(tb.left - 1.3 - inkBox(S.flag.label).right).toFixed(1)} px ink to ink after "settled"; to ${tb.right.toFixed(1)}`, want: '>= 12; 1688', pass: tb.left - 1.3 - inkBox(S.flag.label).right >= 12 && Math.abs(tb.right - 1688) < 1.5 }, overlaps(), ...fill226(t, 'with the "stays" bracket'))
      }
      if (t === T.struck) {
        const k = R(S.strike), g = R(S.g10.el), q = R(S.g10Q.el)
        out.push({ name: '198: "No.": the ink strike through her guess and its "?" (drawn 0.3 s), held 0.4 s, nothing else gone yet', got: `strike ${box(k)} a ${S.strike.getAttribute('opacity')}; guess ${box(g)}; ? to ${q.right.toFixed(1)}; "steady" ${vis(S.steady.el).toFixed(2)}, her line ${S.ch.g.querySelector('.lines') ? 'drawn' : '?'}`, want: 'strike across both at full', pass: +S.strike.getAttribute('opacity') > 0.999 && k.left <= g.left && k.right >= q.right - 2 && k.top > g.top && k.bottom < g.bottom && vis(S.steady.el) > 0.999 }, ...fill226(t, 'at "No." (10g)'))
      }
      if (t === T.clr1 || t === T.clrLast) {
        const order = ['guess', 'steady', 'any', 'inBand', 'settled', 'fixed', 'chip', 'marks', 'line']
        const starts = order.map((k) => A.CLR[k]), gaps = starts.slice(1).map((v, i) => v - starts[i])
        const op = (el) => +el.getAttribute('opacity'), lineOp = () => Math.max(...[...S.ch.g.querySelectorAll('.lines > g')].map(op))
        const al = [op(S.g10.el), op(S.steady.el), op(S.anyOct.el), op(S.inBand.el), op(S.flag.g), op(S.fixedLen.el), op(S.chipW.g), op(S.topBr), lineOp()]
        out.push({ name: `198: the rest clears in turn (${t === T.clr1 ? 'CLR0 + 0.15' : 'as her line starts to go'}): alphas in the order guess, labels, chip and axis, marks, her line`, got: al.map((v) => v.toFixed(2)).join(' '), want: 'rising along the order', pass: al.every((v, i) => i === 0 || v >= al[i - 1] - 1e-6) && al[0] < al[al.length - 1] },
          { name: '198: 0.05 s apart, never all within 0.2 s; her line last', got: `${gaps.map((v) => v.toFixed(2)).join(' ')}; spread ${(starts[starts.length - 1] - starts[0]).toFixed(2)}`, want: '0.05 each; > 0.20', pass: gaps.every((g) => Math.abs(g - 0.05) < 1e-6) && starts[starts.length - 1] - starts[0] > 0.2 })
      }
      if (t === T.cleared) out.push({ name: '198: all of it gone before the frame slides (her wave never squeezed)', got: H.texts(S.ch.g, 0.01).map((x) => x.text).join(' | ') || 'none', want: 'none', pass: H.texts(S.ch.g, 0.01).length === 0 && Math.max(...[...S.ch.g.querySelectorAll('.lines > g')].map((e) => +e.getAttribute('opacity'))) === 0 })
      if (t === T.comf) {
        const lb = R(S.lenBr.path), fl = R(S.fixedLen.el)
        out.push({ name: '10f: the bracket under the plot, 0 to 10 s, y 753.6 (world 572)', got: box(lb), want: '232 to 1688, 740.6 to 753.6', pass: Math.abs(lb.left - 232) < 1 && Math.abs(lb.right - 1688) < 1 && Math.abs(lb.bottom - 753.6) < 1 },
          { name: '10f: "a comfortable, fixed length" centred 960, baseline 796.5 (world 605), its ink above the caption band (896)', got: `${((fl.left + fl.right) / 2).toFixed(1)}, ${S.cam.map(960, +S.fixedLen.el.getAttribute('y'), t)[1].toFixed(1)}; ink to ${inkBox(S.fixedLen.el).bottom.toFixed(1)}`, want: '960, 796.5; < 896', pass: Math.abs((fl.left + fl.right) / 2 - 960) < 2 && Math.abs(S.cam.map(960, +S.fixedLen.el.getAttribute('y'), t)[1] - 796.5) < 0.5 && inkBox(S.fixedLen.el).bottom < 896 }, overlaps(), ...H.keepout(root, S.boxes), ...fill226(t, 'with the length bracket'))
      }
      if (t === T.airq) { const g = R(S.g10.el), q = R(S.g10Q.el), ln = R(S.g10Line); out.push({ name: '10g: her guess at (232, 158.2) (world baseline 114), its dashed underline and "?"', got: `${g.left.toFixed(1)}, ${S.cam.map(400, +S.g10.el.getAttribute('y'), t)[1].toFixed(1)}; line ${box(ln)}; ? ${box(q)}`, want: '232, 158.2', pass: Math.abs(g.left - 232) < 2 && Math.abs(S.cam.map(400, +S.g10.el.getAttribute('y'), t)[1] - 158.2) < 0.5 }, overlaps(), ...H.keepout(root, S.boxes), ...fill226(t, 'with her second guess (10g)')) }
      if (t === T.slide1 || t === T.slide2) {
        // 10h: the voice box draws on as the frame slides away: its drawn outline 12 px or more from the band
        // the outline (pathLength 1) is drawn from its start for 1 - dashoffset of its length; the folds and bands inside
        // count once they show
        const vr = S.vb.g.querySelector('rect'), b = bandR(), vbA = +S.vb.g.getAttribute('opacity')
        let worst = Infinity
        const len = vr.getTotalLength(), frac = 1 - +(vr.getAttribute('stroke-dashoffset') || 0), ctm = vr.getScreenCTM()
        for (let i = 0; i <= 400; i++) {
          if (i / 400 > frac) break
          const p = vr.getPointAtLength((i / 400) * len), x = ctm.a * p.x + ctm.e, y = ctm.d * p.y + ctm.f
          worst = Math.min(worst, ptGap(b, [x, y], 1.6))
        }
        for (const el of S.vb.g.querySelectorAll(':scope > rect:not(:first-child), :scope > g')) if (on(el) && H.R(el).width > 0) worst = Math.min(worst, H.gap(H.R(el), b))
        out.push({ name: `10h: the voice box (drawing on) clear of the sliding band (+${(t - A.BOX).toFixed(2)} s after it starts)`, got: vbA > 0 ? worst : 'not drawn', want: '>= 12', pass: !(vbA > 0) || worst >= 12 })
      }
      if (t === T.slid) {
        const b = bandR(), m = mercR()
        out.push({ name: '10h: the frame at x 1000 to 1640, band y 210 to 280 (screen)', got: box(b), want: '1000 to 1640, 210 to 280', pass: Math.abs(b.left - 1000) < 0.5 && Math.abs(b.right - 1640) < 0.5 && Math.abs(b.top - 210) < 0.5 && Math.abs(b.bottom - 280) < 0.5 },
          { name: '10h: Merc\'s line y 245, 4 px on screen', got: `${((m.top + m.bottom) / 2).toFixed(2)}, ${(+S.ch.merc.path.getAttribute('stroke-width') * S.cam.scale(t)).toFixed(2)}`, want: '245.00, 4.00' },
          { name: '10h: her line, the flag, the brackets and the chart\'s labels gone', got: H.texts(S.ch.g, 0.01).map((x) => x.text).join(' | ') || 'none', want: 'none' })
      }
      if (t === T.box) { const v = R(S.vb.g.querySelector('rect')); out.push({ name: '10h: the voice box x 300 to 640, y 190 to 510', got: box(v), want: '300 to 640, 190 to 510', pass: Math.abs(v.left - 300) < 2 && Math.abs(v.top - 190) < 2 }, overlaps(), ...H.keepout(root, S.boxes)) }
      if (t === T.needs) out.push({ name: '193: the slider not yet (it starts 0.4 s after "a steady note needs steady air too")', got: S.slider.g.getAttribute('opacity'), want: '0.000' }, overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.slider) out.push({ name: '193: the slider drawn from "needs" + 0.4 s, its thumb at 50; the line\'s head drawing', got: `${S.slider.g.getAttribute('opacity')}, p ${S.slider.val.textContent}, slider from ${A.SLID0.toFixed(2)} ("needs" ${A.NEEDS.toFixed(2)}), line from ${A.LINE0.toFixed(2)}`, want: '1.000, p 50', pass: +S.slider.g.getAttribute('opacity') === 1 && S.slider.val.textContent.trim() === '50' })
      if (t === T.movesFull) out.push({ name: '193: "a change in the air moves it" lands on "because", at full 2 s or more, then a 0.4 s linear fade gone by the cut\'s 364.60 rule', got: `lands ${A.BECAUSE.toFixed(2)}, full from ${(A.BECAUSE + 0.3).toFixed(2)} to ${A.END_FADE.toFixed(2)} (${(A.END_FADE - A.BECAUSE - 0.3).toFixed(2)} s), gone ${(A.END_FADE + A.END_D).toFixed(2)} = D - ${(A.D - A.END_FADE - A.END_D).toFixed(2)}; a ${vis(S.vbl.moves.el).toFixed(3)}`, want: '>= 2.00 s; D - 0.13', pass: A.END_FADE - A.BECAUSE - 0.3 >= 2 && Math.abs(A.D - A.END_FADE - A.END_D - 0.13) < 1e-6 && vis(S.vbl.moves.el) > 0.999 })
      if (t === T.peak) {
        const pts = S.lineCh.lastLine('silent'), ys = pts.map((p) => p[1])
        const flat = pts.filter((p) => p[0] < 1000 + 106.7 * (A.BECAUSE - A.LINE0) - 5 && p[0] > 1000 + 106.7 * 0.5).map((p) => p[1])
        const pp = Math.max(...flat) - Math.min(...flat), bump = (245 - pp / 2) - Math.min(...ys)
        out.push({ name: '193: one push, 50 to 100 and back (two legs of 0.9 s); at the top: the thumb, the bump in the line against the wave\'s peak to peak', got: `p ${S.slider.val.textContent}; bump ${bump.toFixed(1)} px, wave ${pp.toFixed(1)} px, ratio ${(bump / pp).toFixed(2)}`, want: 'p 100; ratio >= 2', pass: S.slider.val.textContent.trim() === '100' && bump / pp >= 2 && A.PUSH_LEG >= 0.8 })
      }
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
          { name: '10h: its rise with the thumb at 100: 60 px over Merc\'s line (FACTS 73: +60 c at 1.0 px a cent; crest y 245 - 60 - 14 = 171)', got: Math.min(...S.lineCh.lastLine('silent').map((p) => p[1])), want: 'about 171', pass: Math.abs(Math.min(...S.lineCh.lastLine('silent').map((p) => p[1])) - 171) < 3 },
          { name: '193: still drawing (never a still slider over a still line), the label at full', got: `head ${S.lineCh.lastLine('silent').slice(-1)[0][0].toFixed(1)}, "a change..." ${vis(S.vbl.moves.el).toFixed(3)}`, want: 'a 1', pass: vis(S.vbl.moves.el) > 0.999 })
      }
      if (t === T.rule) {
        out.push({ name: '193: nothing but the empty frame from 364.60 (D - 0.13)', got: `${H.texts(root, 0.001).map((x) => x.text).join(' | ') || 'none'}; slider ${S.slider.g.getAttribute('opacity')}; box ${S.vb.g.getAttribute('opacity')}`, want: 'none; 0.000; 0.000', pass: H.texts(root, 0.001).length === 0 && +S.slider.g.getAttribute('opacity') === 0 && +S.vb.g.getAttribute('opacity') === 0 })
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
