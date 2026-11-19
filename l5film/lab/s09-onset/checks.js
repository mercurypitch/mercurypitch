// s09-onset's checks (lab/s05-push/probe.mjs, unchanged): the first frame against S8's last (HANDOFFS § The cuts S8 to
// S9), the dim and the figure's exit, the folds' growth from the throat (provisional, 9b), the folds, the strip, its
// title, chips and tags (HANDOFFS § The folds and the traces), the three starts, the stack and its chips (LAB-CHECKS 13
// at the board's 290.00), the circles and their labels, the last frame (S9 to S10), overlaps, keep-out, the 0.4 s rule.
// Fix round F-01 (DECISIONS 226): the strip (its lane, hairline and chip) not shown before its first trace, drawn on
// from 0.3 s before it, ahead of the trace's head.
;(function () {
  const H = window.__H, sid = 's09-onset'
  const S = window.__sceneProbe[sid], A = S.A
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const T = {
    aim1: A.AIM + 0.3, aim2: A.THIRD + 0.3, under: A.TITLE + 0.5, preStrip: A.STRIP - 0.02, head1: A.S_AIR + 0.1, head2: A.S_AIR + 0.25,
    f0: 0, dim: A.ACT + 0.25, pre: A.FOLD0 - 0.05, ring: A.FOLD0 + 0.02, grown: A.FOLD0 + A.GROW_D, grow: A.SLIDE + 0.3, folds: A.FOLD_L + 0.05, strip: A.STRIP + 0.95, row: A.ONSET + 0.4,
    ghostA: A.CATCH + 1.5, mid1: (A.CATCH + A.S_CATCH) / 2, wipeA: A.S_CATCH + 0.8, ghostC: A.TOG + 1.0, mid2: (A.MEET + A.S_TOG) / 2, wipeC: A.S_TOG + 0.8,
    fsh: A.STACK + A.FSH_D + 0.02, preNames: A.NAMES[0] - 0.02,
    title: A.TITLE + 0.35, chips: A.CHIPS[2] + 0.35, air: A.AIR + 0.7, airS: A.S_AIR + 0.3, airDone: A.AIR_L + 0.3, catchT: A.LISTEN + 0.3,
    pressed: A.PRESSED + 0.4, catchS: A.S_CATCH + 0.4, tog: A.MEET + 0.5, togS: A.S_TOG + 1.0, stackMid: A.STACK + 0.6, stack: A.STACK + A.STACK_D + 0.05,
    names: A.NAMES[2] + 0.4, replay: A.SR[1] + 0.5, circles: A.NEITHER + 0.3, lab13: A.THIRD - 1.26, easy: A.EASY + 0.3, h: A.SOFT + 0.5, hOut: A.ONLY + 1.3, last: A.D - 0.0005,
  }
  const figA = () => +S.fig.g.getAttribute('opacity')
  const overlaps = () => {
    const tx = H.texts(root, 0.5).filter((x) => x.r.width > 0)
    const bad = []
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
      if (/^Singers|^different/.test(tx[i].text) && /^Singers|^different/.test(tx[j].text)) continue
      const a = tx[i].r, b = tx[j].r
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ox > 0 && oy > 8) bad.push(`"${tx[i].text}" / "${tx[j].text}"`)
    }
    return { name: 'no two visible texts overlap', got: bad.length ? bad.join('; ') : 'none', want: 'none', pass: !bad.length }
  }
  const inkOf = (l, font) => {   // a label's ink box from its element (x, y, anchor) and the canvas metrics
    const el = l.el, anchor = el.getAttribute('text-anchor') || 'start', x = +el.getAttribute('x'), y = +el.getAttribute('y')
    const m = H.ink(el.textContent, font, anchor)
    const dy = H.dyOf(el)
    return { left: x + m.l, right: x + m.r, top: y + dy - m.up, bottom: y + dy + m.down }
  }
  // the nearest approach of a box to an ellipse's stroke (its outer edge, stroke 2.5)
  const toEllipse = (b, e) => {
    const cx = +e.getAttribute('cx'), cy = +e.getAttribute('cy'), rx = +e.getAttribute('rx'), ry = +e.getAttribute('ry')
    let d = Infinity
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * 2 * Math.PI, x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a)
      d = Math.min(d, Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom)) - 1.25)
    }
    return d
  }
  const landings = () => {
    const Ls = [['kicker', A.O10], ['vocal folds, from above', A.FOLD_L], ['the strip and its chip', A.STRIP], ['the four words', A.ROW_IN], ['the strip\'s title', A.TITLE],
      ['Air first', A.CHIPS[0]], ['A catch', A.CHIPS[1]], ['Together', A.CHIPS[2]], ['the title: Air first', A.AIR], ['air, no note', A.AIR_L], ['the title: A catch', A.CATCH],
      ['LISTEN ONLY', A.LISTEN], ['the catch', A.CATCH_L], ['the title: Together', A.TOG], ['name 1', A.NAMES[0]], ['name 2', A.NAMES[1]], ['name 3', A.NAMES[2]],
      ['LISTEN ONLY (starts)', A.STARTS], ['the puff', A.CIRC[0]], ['the click', A.CIRC[1]], ['neither', A.NEITHER], ['the easy start', A.EASY], ['h', A.SOFT], ['the h, only in your mind', A.ONLY]].sort((a, b) => a[1] - b[1])
    let worst = Infinity, pair = ''
    for (let i = 1; i < Ls.length; i++) { const g = Ls[i][1] - Ls[i - 1][1]; if (g < worst) { worst = g; pair = `${Ls[i - 1][0]} / ${Ls[i][0]}` } }
    return { name: `0.4 s rule: the closest two landings (${pair})`, got: worst, want: '>= 0.40', pass: worst >= 0.4 - 1e-6 }
  }
  const box = (el) => { const b = R(el); return `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}` }
  const foldBox = () => R(S.fo.g.querySelector('rect'))
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.aim1 || t === T.aim2) {
        // the wave's stroke at 1 - 0.65 dim (L.trace): half way at "aim" + 0.3, at 35 % by "the third" + 0.3
        const so = (i) => +[...S.rowTr[i].g.querySelectorAll('path')].find((p) => p.hasAttribute('stroke-opacity')).getAttribute('stroke-opacity')
        const want = t === T.aim1 ? 0.675 : 0.35
        out.push({ name: `227: rows 1 and 2 dim from "aim" (${A.AIM.toFixed(2)}, 0.6 s linear; on "the third", ${A.THIRD.toFixed(2)}, before): ${t === T.aim1 ? 'half way' : 'done'}`, got: `${so(0).toFixed(3)} ${so(1).toFixed(3)}; row 3 ${so(2).toFixed(3)}`, want: `${want} ${want}; row 3 1`, pass: Math.abs(so(0) - want) < 0.01 && Math.abs(so(1) - want) < 0.01 && so(2) === 1 })
      }
      if (t === T.under || t === T.preStrip) {
        const lane = +S.lane.getAttribute('opacity'), hair = H.alpha(S.baseTr.g.querySelector('rect')), tag = +S.stripTag.g.getAttribute('opacity'), w = +S.clipRect.getAttribute('width')
        out.push({ name: `226: the trace box not shown before its first trace (${t === T.under ? 'under "onset: how a note starts"' : 'just before it draws on'})`, got: `lane ${lane}, hairline ${hair.toFixed(2)}, chip ${tag}, drawn ${w}`, want: 'all 0', pass: lane === 0 && hair === 0 && tag === 0 && w === 0 })
      }
      if (t === T.head1 || t === T.head2) {
        const edge = +S.clipRect.getAttribute('x') + +S.clipRect.getAttribute('width'), head = 700 + (900 * (t - A.S_AIR)) / 1.6
        out.push({ name: `226: the strip draws on ahead of the first trace's head (+${(t - A.S_AIR).toFixed(2)} s; from ${A.STRIP.toFixed(2)}, the start ${A.S_AIR.toFixed(2)})`, got: `edge ${edge.toFixed(1)}, head ${head.toFixed(1)}`, want: 'edge >= head + 12', pass: edge >= head + 12 && +S.lane.getAttribute('opacity') === 1 })
      }
      if (t === T.f0) {
        out.push({ name: 'first frame (S8\'s last): the figure at S8\'s placement, breathed out to rest (breath 0), jaw 4 px', got: `crown ${S.fig.at('crown').map((v) => v.toFixed(1))}, belly ${S.fig.at('belly')[0].toFixed(2)}, chin ${S.fig.at('chin')[1].toFixed(2)}, a ${figA()}`, want: 'crown 991,154, belly 1061.00, chin 242.00, a 1', pass: Math.abs(S.fig.at('belly')[0] - 1061) < 0.05 && Math.abs(S.fig.at('chin')[1] - 242) < 0.05 && figA() === 1 },
          { name: 'every cue label at full', got: Object.values(S.cueL).concat(S.singers).every((l) => H.alpha(l.el) > 0.999), want: true },
          { name: 'nothing of S9 shown yet', got: `${S.fo.g.getAttribute('opacity')} ${S.card.g.getAttribute('opacity')}`, want: '0.000 0.000' }, landings())
      }
      if (t === T.dim) out.push({ name: '9a: the figure at 25 %, its labels hidden', got: `${figA().toFixed(3)} / ${H.alpha(S.cueL.tall.el).toFixed(3)}`, want: '0.250 / 0.000' })
      if (t === T.pre) out.push({ name: '196: just before the card starts to leave: the folds not begun, the figure at 25 %', got: `${S.fo.g.getAttribute('opacity')}, ${figA().toFixed(3)}, card ${S.card.g.getAttribute('opacity')}`, want: '0.000, 0.250', pass: +S.fo.g.getAttribute('opacity') === 0 && Math.abs(figA() - 0.25) < 0.001 })
      if (t === T.grown) {
        const b = foldBox()
        out.push({ name: '196: the ring grown into the folds\' box in 0.5 s (its scale riding the slide)', got: `${b.width.toFixed(1)} across at scale ${(b.width / 340).toFixed(3)}; grow ends ${(A.FOLD0 + A.GROW_D).toFixed(3)}, card out ${A.CARD_OUT.toFixed(3)}`, want: 'grow 0.5 s from the card\'s exit', pass: A.GROW_D === 0.5 && A.FOLD0 === A.CARD_OUT && +S.fo.g.getAttribute('opacity') === 1 })
      }
      if (t === T.ring) {
        const b = foldBox()
        out.push({ name: '9b (provisional): the ring at the throat (1005, 273), r 10 at scale 0.5, at full strength', got: `centre ${((b.left + b.right) / 2).toFixed(1)}, ${((b.top + b.bottom) / 2).toFixed(1)}; ${b.width.toFixed(1)} across; a ${S.fo.g.getAttribute('opacity')}`, want: 'info', pass: Math.abs((b.left + b.right) / 2 - 1005) < 1 && Math.abs((b.top + b.bottom) / 2 - 273) < 1 },
          { name: '9b: the figure fading from 25 %', got: figA(), want: '< 0.25', pass: figA() < 0.25 })
      }
      if (t === T.grow) out.push({ name: '9b: mid-slide (info): the folds\' box', got: box(S.fo.g.querySelector('rect')), want: 'info', pass: true }, { name: '9b: the figure gone', got: figA(), want: 0 })
      if (t === T.folds) {
        const b = foldBox(), lb = R(S.foLabel.el)
        const fl = inkOf(S.foLabel, "500 28px 'Outfit'"), ob = { left: 390 - 170 * A.FS, right: 390 + 170 * A.FS, top: 430 - 170 * A.FS, bottom: 430 + 170 * A.FS }
        out.push({ name: '192: the folds\' box at 1.35 about (390, 430): x 160.5 to 619.5, y 200.5 to 659.5 (stroke centre)', got: box(S.fo.g.querySelector('rect')), want: '160.5 to 619.5, 200.5 to 659.5', pass: Math.abs(b.left - ob.left) < 1 && Math.abs(b.right - ob.right) < 1 && Math.abs(b.top - ob.top) < 1 && Math.abs(b.bottom - ob.bottom) < 1 },
          { name: '192: the folds\' box 60 px or more clear of the lane (x 700)', got: 700 - b.right, want: '>= 60', pass: 700 - b.right >= 60 },
          { name: '"vocal folds, from above" centred 390 under the box, baseline 694: its ink 12 px or more under the outline', got: `${((lb.left + lb.right) / 2).toFixed(1)}, ${(fl.top - b.bottom).toFixed(1)}`, want: '390, >= 12', pass: Math.abs((lb.left + lb.right) / 2 - 390) < 2 && fl.top - b.bottom >= 12 },
          { name: 'the folds\' box clear of Merc\'s body box (20 px or more)', got: S.boxes.merc ? H.gap(b, { left: S.boxes.merc.x0, right: S.boxes.merc.x1, top: S.boxes.merc.y0, bottom: S.boxes.merc.y1 }) : 'none', want: '>= 20', pass: !S.boxes.merc || H.gap(b, { left: S.boxes.merc.x0, right: S.boxes.merc.x1, top: S.boxes.merc.y0, bottom: S.boxes.merc.y1 }) >= 20 })
      }
      if (t === T.strip) {
        const hr = R(S.baseTr.g.querySelector('rect')), tg = R(S.stripTag.box)
        const ln = R(S.lane)
        out.push({ name: '192: the lit lane x 700 to 1600, y 320 to 540, chrome at 6 %', got: `${box(S.lane)}, ${S.lane.getAttribute('fill-opacity')} x ${S.lane.getAttribute('opacity')}`, want: '700 to 1600, 320 to 540, 0.06 x 1.000', pass: Math.abs(ln.left - 700) < 1 && Math.abs(ln.right - 1600) < 1 && Math.abs(ln.top - 320) < 1 && Math.abs(ln.bottom - 540) < 1 && +S.lane.getAttribute('opacity') === 1 })
        out.push({ name: '9b: the strip\'s hairline x 700 to 1600, y 430', got: `${hr.left.toFixed(1)} to ${hr.right.toFixed(1)}, ${(hr.top + hr.height / 2).toFixed(1)}`, want: '700 to 1600, 430', pass: Math.abs(hr.left - 700) < 1 && Math.abs(hr.right - 1600) < 1 },
          { name: '9b: its "ILLUSTRATION" right-aligned 1600, centred y 270', got: box(S.stripTag.box), want: '1329 to 1600, 250 to 290', pass: Math.abs(tg.right - 1600) < 1.5 && Math.abs(tg.top - 250) < 1 })
      }
      if (t === T.row) out.push({ name: '9b: the four words back, "onset" lit', got: S.row.chips[2].el.getAttribute('fill'), want: 'info', pass: true })
      if (t === T.title) {
        const tb = inkOf(S.titles[0], "600 44px 'Outfit'"), tg = R(S.stripTag.box)
        out.push({ name: '9b: the strip\'s title from x 700, baseline 280: its ink right edge 12 px or more left of the chip', got: tg.left - tb.right, want: '>= 12', pass: tg.left - tb.right >= 12 },
          { name: '9b: the title\'s ink over the strip\'s top (320)', got: 320 - tb.bottom, want: '>= 12', pass: 320 - tb.bottom >= 12 })
      }
      if (t === T.chips) out.push({ name: '9b: the chips centred y 680 from x 700, 920, 1140', got: S.chips.map((c) => box(c.box)).join(' | '), want: 'info', pass: S.chips.every((c, i) => Math.abs(R(c.box).left - [700, 920, 1140][i]) < 1) }, overlaps())
      if (t === T.air) out.push({ name: '9c: "Air first" lit, the title switched, the air arrow up between the folds', got: `${S.chips[0].el.getAttribute('fill')}, ${S.titles[1].el.getAttribute('opacity')}`, want: 'info', pass: true })
      if (t === T.airDone) {
        const d = R(S.airTr.g.querySelectorAll('circle')[0]), al = inkOf(S.airLbl, "600 30px 'Outfit'")
        out.push({ name: '9c: "air, no note" under the strip (its envelope to 540)', got: al.top - 540, want: '>= 12', pass: al.top - 540 >= 12 }, { name: '9c: the folds closed into vibration (slit)', got: JSON.stringify(S.foldsAt(t).state), want: 'info', pass: true })
      }
      if (t === T.catchT) {
        const tb = inkOf(S.titles[2], "600 44px 'Outfit'"), lb = R(S.listen1.box), tg = R(S.stripTag.box)
        out.push({ name: '9d: "LISTEN ONLY" 24 px after "A catch" (its advance)', got: lb.left - (700 + S.titles[2].el.getComputedTextLength()), want: 24, tol: 1 },
          { name: '9d: "LISTEN ONLY" clear of the strip\'s chip', got: tg.left - lb.right, want: '>= 12', pass: tg.left - lb.right >= 12 }, overlaps())
      }
      if (t === T.ghostA || t === T.mid1) out.push({ name: `192: trace 1 at 30 % after "A catch" (${t === T.mid1 ? 'mid-wait' : '+1.5 s'}), whole until the catch draws`, got: `${S.airTr.g.getAttribute('opacity')}, wipe from ${S.airWipe.getAttribute('x')}`, want: '0.300, wipe from 690.00', pass: S.airTr.g.getAttribute('opacity') === '0.300' && S.airWipe.getAttribute('x') === '690.00' })
      if (t === T.wipeA) out.push({ name: '192: the catch draws over trace 1: trace 1 hidden left of the catch\'s head', got: `head ${(700 + 562.5 * 0.8).toFixed(1)}, wipe from ${S.airWipe.getAttribute('x')}, trace 1 ${S.airTr.g.getAttribute('opacity')}`, want: 'wipe from 1150.00, 0.300', pass: S.airWipe.getAttribute('x') === '1150.00' && S.airTr.g.getAttribute('opacity') === '0.300' })
      if (t === T.ghostC || t === T.mid2) out.push({ name: `192: trace 2 at 30 % after "Together" (${t === T.mid2 ? 'mid-wait' : '+1.0 s'}), whole until together draws`, got: `${S.catchTr.g.getAttribute('opacity')}, wipe from ${S.catchWipe.getAttribute('x')}`, want: '0.300, wipe from 690.00', pass: S.catchTr.g.getAttribute('opacity') === '0.300' && S.catchWipe.getAttribute('x') === '690.00' })
      if (t === T.wipeC) out.push({ name: '192: together draws over trace 2', got: `wipe from ${S.catchWipe.getAttribute('x')}, trace 2 ${S.catchTr.g.getAttribute('opacity')}`, want: 'wipe from 1150.00, 0.300', pass: S.catchWipe.getAttribute('x') === '1150.00' })
      if (t === T.pressed) out.push({ name: '9d: the folds pressed shut (12 px, no gap)', got: S.fo.g.querySelectorAll('path')[2].getAttribute('stroke-width'), want: '12.00' })
      if (t === T.catchS) out.push({ name: '9d: the catch\'s mark at x 784 (0.15 s), the folds open into vibration', got: `${R(S.catchTr.g.querySelectorAll('rect')[2]).left.toFixed(1)}, ${S.catchTr.g.querySelectorAll('rect')[2].getAttribute('opacity')}`, want: '782.4, 1.000' })
      if (t === T.tog) out.push({ name: '9e: the folds at a slit on "meet"', got: S.fo.g.querySelectorAll('path')[1].getAttribute('d'), want: 'info', pass: true })
      if (t === T.togS) {
        const k = R(S.tick)
        out.push({ name: '9e: the gold tick 4 x 40 at the onset (x 698 to 702, y 410 to 450)', got: box(S.tick), want: '698 to 702, 410 to 450', pass: Math.abs(k.left - 698) < 0.5 && Math.abs(k.top - 410) < 0.5 && +S.tick.getAttribute('opacity') > 0.99 })
      }
      if (t === T.fsh) {
        const b = foldBox()
        out.push({ name: '197: the folds shrink first: small at STACK + 0.5 s while trace 3 is still on its way', got: `folds ${box(S.fo.g.querySelector('rect'))}; strip ${S.movG.getAttribute('transform') || 'not moved'}; names ${S.names.map((l) => H.alpha(l.el).toFixed(2)).join(' ')}`, want: 'folds 160 to 330, 110 to 280; names 0', pass: Math.abs(b.left - 160) < 1 && Math.abs(b.bottom - 280) < 1 && S.names.every((l) => H.alpha(l.el) === 0) })
      }
      if (t === T.preNames) out.push({ name: '197: trace 3 settles before the first name lands (names from about 34.4)', got: `first name at ${A.NAMES[0].toFixed(3)}; trace 3 lands ${(A.TMV + A.TMV_D).toFixed(3)}; names ${S.names.map((l) => H.alpha(l.el).toFixed(2)).join(' ')}`, want: 'names 0 before', pass: S.names.every((l) => H.alpha(l.el) === 0) && A.NAMES[0] >= A.TMV + A.TMV_D - 1e-9 && Math.abs(A.NAMES[0] - 34.4) < 0.1 })
      if (t === T.names) out.push({ name: '197: the three names landed, 0.4 s apart', got: S.names.map((l) => H.alpha(l.el).toFixed(2)).join(' ') + ` at ${A.NAMES.map((v) => v.toFixed(2)).join(', ')}`, want: '1.00 1.00 1.00', pass: S.names.every((l) => H.alpha(l.el) > 0.999) }, overlaps())
      if (t === T.stackMid) out.push({ name: '9f: mid-move (info): trace 3 on its way to row 3, the folds shrinking', got: `${S.movG.getAttribute('transform')}; folds ${box(S.fo.g.querySelector('rect'))}`, want: 'info', pass: true })
      if (t === T.stack) {
        const b = foldBox(), tg = R(S.stripTag.box), k = R(S.tick)
        const w3 = R(S.togTr.g.querySelector('path')), hr3 = R(S.rowTr[2].g.querySelector('rect'))
        out.push({ name: '9f: the folds small, x 160 to 330, y 110 to 280', got: box(S.fo.g.querySelector('rect')), want: '160 to 330, 110 to 280', pass: Math.abs(b.left - 160) < 1 && Math.abs(b.right - 330) < 1 && Math.abs(b.top - 110) < 1 && Math.abs(b.bottom - 280) < 1 },
          { name: '9f: the strip\'s chip at x 1329 to 1600, y 130 to 170', got: box(S.stripTag.box), want: '1329 to 1600, 130 to 170', pass: Math.abs(tg.right - 1600) < 1.5 && Math.abs(tg.top - 130) < 1 },
          { name: '9f: trace 3 in row 3 (its wave y 580 to 720 at full level)', got: `${w3.top.toFixed(1)} to ${w3.bottom.toFixed(1)}`, want: '580 to 720', pass: Math.abs(w3.top - 580) < 1.5 && Math.abs(w3.bottom - 720) < 1.5 },
          { name: '9f: row 3\'s hairline y 650', got: hr3.top + hr3.height / 2, want: 650, tol: 0.6 },
          { name: '9f: the gold tick at row 3 (y 630 to 670)', got: box(S.tick), want: '698 to 702, 630 to 670', pass: Math.abs(k.top - 630) < 0.5 },
          { name: '9f: the names right-aligned 660 (HANDOFFS 670), baselines 262, 462, 662', got: S.names.map((l) => `${R(l.el).right.toFixed(1)}/${l.el.getAttribute('y')}`).join(' '), want: 'info', pass: S.names.every((l) => Math.abs(R(l.el).right - 660) < 1.5) }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.replay) out.push({ name: '9f: the replay: row 1 drawn, row 2 drawing and lit, row 3\'s old drawing gone', got: `${S.rowTr[0].g.querySelector('path').getAttribute('d').length > 100}, ${S.rowTr[1].g.querySelectorAll('rect')[1].getAttribute('fill-opacity')}, ${S.togTr.g.getAttribute('opacity')}`, want: 'true, 0.140, 0.000' })
      if (t === T.circles) {
        const e1 = S.rowTr[0].g.querySelector('ellipse'), e2 = S.rowTr[1].g.querySelector('ellipse')
        const pf = inkOf(S.puff, "600 30px 'Outfit'"), ck = inkOf(S.click, "600 30px 'Outfit'"), ne = inkOf(S.neither, "600 30px 'Outfit'")
        const nm = inkOf(S.names[0], "600 36px 'Outfit'")
        out.push({ name: '9f: "Air first" (right-aligned 660) clear of row 1\'s circle', got: toEllipse(nm, e1), want: '>= 8', pass: toEllipse(nm, e1) >= 8 })
        out.push({ name: '9f: "the puff" (baseline 148) clear of row 1\'s circle', got: toEllipse(pf, e1), want: '>= 8', pass: toEllipse(pf, e1) >= 8 },
          { name: '9f: "the click" (from x 812) clear of row 2\'s circle', got: toEllipse(ck, e2), want: '>= 8', pass: toEllipse(ck, e2) >= 8 },
          { name: '9f: "the click" clear of row 1\'s circle', got: toEllipse(ck, e1), want: '>= 8', pass: toEllipse(ck, e1) >= 8 },
          { name: '9f: "neither" clear of row 2\'s circle', got: toEllipse(ne, e2), want: '>= 8', pass: toEllipse(ne, e2) >= 8 },
          { name: '9f: "the click" between rows 1 and 2 (envelopes to 320, from 380)', got: `${(ck.top - 320).toFixed(1)}, ${(380 - ck.bottom).toFixed(1)}`, want: 'both >= 8', pass: ck.top - 320 >= 8 && 380 - ck.bottom >= 8 }, overlaps())
      }
      if (t === T.lab13) {
        const tg = R(S.stripTag.box), ls = R(S.listen2.box), nm = inkOf(S.names[1], "600 36px 'Outfit'"), n3 = inkOf(S.names[2], "600 36px 'Outfit'")
        const e2 = S.rowTr[1].g.querySelector('ellipse'), ce = R(e2)
        out.push({ name: 'LAB-CHECKS 13 (board 290.00): the strip\'s chip over row 1\'s envelope (180 at full level)', got: 180 - tg.bottom, want: '>= 10', pass: 180 - tg.bottom >= 10 },
          { name: 'LAB-CHECKS 13 [C-01: 195]: "LISTEN ONLY" under "A catch", right-aligned 660, centred y 495', got: box(S.listen2.box), want: 'to 660, 475 to 515', pass: Math.abs(ls.right - 660) < 1.5 && Math.abs((ls.top + ls.bottom) / 2 - 495) < 1 },
          { name: 'LAB-CHECKS 13: "LISTEN ONLY" 12 px or more under the name "A catch" (its ink)', got: ls.top - nm.bottom, want: '>= 12', pass: ls.top - nm.bottom >= 12 },
          { name: 'LAB-CHECKS 13: "LISTEN ONLY" 12 px or more left of row 2 (x 700) and of its circle', got: `${(700 - ls.right).toFixed(1)}, ${(ce.left - ls.right).toFixed(1)}`, want: 'both >= 12', pass: 700 - ls.right >= 12 && ce.left - ls.right >= 12 },
          { name: 'LAB-CHECKS 13: "LISTEN ONLY" clear of "Together" (its ink) and of row 3\'s envelope (580)', got: `${(n3.top - ls.bottom).toFixed(1)}`, want: '>= 12', pass: n3.top - ls.bottom >= 12 }, overlaps())
      }
      if (t === T.easy) {
        const e = inkOf(S.easy, "600 40px 'Outfit'"), n3 = inkOf(S.names[2], "600 36px 'Outfit'"), ne = inkOf(S.neither, "600 30px 'Outfit'")
        const hl = R(S.hLine.el), k = R(S.rowTr[2].g.querySelectorAll('g')[1])
        out.push({ name: '195: "the easy start" under "Together", right-aligned 660, baseline 714 (row 3\'s own name)', got: `${e.right.toFixed(1)}, ${S.easy.el.getAttribute('y')}`, want: '660, 714', pass: Math.abs(e.right - 660) < 2 },
          { name: '195: "the easy start" 12 px or more under "Together" (ink to ink)', got: e.top - n3.bottom, want: '>= 12', pass: e.top - n3.bottom >= 12 },
          { name: '195: "the easy start" 12 px or more from row 3 (x 700), its gold tick and "the h, only in your mind"', got: `${(700 - e.right).toFixed(1)}, ${(k.left - e.right).toFixed(1)}, ${H.gap(e, hl).toFixed(1)}`, want: 'all >= 12', pass: 700 - e.right >= 12 && k.left - e.right >= 12 && H.gap(e, hl) >= 12 },
          { name: '195: "the easy start" off "neither"\'s line (baselines)', got: `${S.easy.el.getAttribute('y')} / ${S.neither.el.getAttribute('y')}`, want: 'differ by 100 or more', pass: Math.abs(+S.easy.el.getAttribute('y') - +S.neither.el.getAttribute('y')) >= 100 },
          ...H.keepout(root, S.boxes),
          { name: '9g: the gold tick scales 1.2 (peak at + 0.15 s)', got: S.rowTr[2].g.querySelectorAll('g')[1].getAttribute('transform'), want: 'info', pass: true })
      }
      if (t === T.h) out.push({ name: '195: the "h" (serif 120, ink-2) at 70 %, centred (760, 690)', got: (() => { const b = R(S.hGlyph.el); return `${((b.left + b.right) / 2).toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}, a ${(+S.hGlyph.el.getAttribute('opacity')).toFixed(3)}` })(), want: 'a 0.700', pass: Math.abs(+S.hGlyph.el.getAttribute('opacity') - 0.7) < 0.002 },
        { name: '195: row 3\'s first 200 px (x 704 to 880, soft to 920) at 25 % while it shows', got: `mask ${S.rowTr[2].g.getAttribute('mask') ? 'on' : 'off'}, ${S.hStops.map((e) => e.getAttribute('stop-opacity')).join(' ')}`, want: 'mask on, 0.250 0.250 1 1', pass: !!S.rowTr[2].g.getAttribute('mask') && S.hStops[0].getAttribute('stop-opacity') === '0.250' })
      if (t === T.hOut) out.push({ name: '195: the "h" gone and row 3 whole again (no mask)', got: `${(+S.hGlyph.el.getAttribute('opacity')).toFixed(3)}, mask ${S.rowTr[2].g.getAttribute('mask') || 'off'}`, want: '0.000, mask off', pass: +S.hGlyph.el.getAttribute('opacity') === 0 && !S.rowTr[2].g.getAttribute('mask') })
      if (t === T.last) {
        out.push({ name: 'last frame (S9 to S10): the stack, its names, circles and labels, both chips, the folds small', got: [S.names[2], S.puff, S.click, S.neither, S.easy, S.hLine].map((l) => H.alpha(l.el).toFixed(2)).join(' ') + ` | chips ${S.stripTag.g.getAttribute('opacity')} ${S.listen2.g.getAttribute('opacity')} | h ${S.hGlyph.el.getAttribute('opacity')}`, want: 'all 1.00 | chips 1 1 | h 0', pass: [S.names[2], S.puff, S.click, S.neither, S.easy, S.hLine].every((l) => H.alpha(l.el) > 0.999) && +S.hGlyph.el.getAttribute('opacity') === 0 },
          { name: 'last frame: the folds small and at rest (apart, no vibration)', got: JSON.stringify(S.foldsAt(t)), want: 'info', pass: S.foldsAt(t).vib < 1e-6 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      return out
    },
  }
})()
