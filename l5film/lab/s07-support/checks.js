// s07-support's checks (lab/s05-push/probe.mjs): the first frame against S6's last (HANDOFFS § The cuts S6 to S7: the
// carried gauge, small band and figure on F-gauge's pixels; the room's crossfade), the reassembled chart and the parked
// figure, the rows and the evidence (HANDOFFS § The mix-up card), the wave rule large and small, the last frame against
// § The cuts S7 to S8, overlaps between visible texts, and the keep-out.
;(function () {
  const H = window.__H, sid = 's07-support'
  const S = window.__sceneProbe[sid], A = S.A
  const T = {
    f0: 0, ghost: 0.15, gone: 0.34, chart: A.FOLD_END + 0.35, kick: A.KICK + 0.3, row0: A.SQZ + 0.45, lit: A.LIT_ON + 0.45,
    whole: A.REDRAW + A.REDRAW_D + 0.02, hold: A.SHRINK1 - 0.05, row1: A.ROW1 + 0.3, pair: A.PAIR + 1.0, more: A.MORE_P + 0.3, row2: A.NAMES + 0.3,
    howPk: A.HOW_W + 0.15, sup: A.SUP + 0.6, noone: A.NOONE + 0.5, row3: A.SHRINK3 + 0.65, breathe: A.BREATHE + 1.0, row4: A.PH[3] + 0.4, last: A.D - 0.0005,
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const vis = (e) => H.alpha(e).toFixed(2)
  const figA = () => (+S.fig.g.getAttribute('opacity')).toFixed(2)
  const frameEl = () => S.ga.g.querySelector('rect[fill="none"]')
  const wave = (pts, x0, x1) => {
    const q = pts.filter((p) => p[0] >= x0 && p[0] <= x1)
    const ys = q.map((p) => p[1]), peaks = []
    for (let i = 1; i < q.length - 1; i++) if (q[i][1] < q[i - 1][1] && q[i][1] <= q[i + 1][1]) peaks.push(q[i][0])
    const gaps = peaks.slice(1).map((x, i) => x - peaks[i])
    return { pp: Math.max(...ys) - Math.min(...ys), cyc: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length) }
  }
  // every pair of visible texts in the frame-fixed layer that overlap (font boxes, less 4 px of leading)
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
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.f0) {
        const f = R(frameEl()), chip = R(S.tag.box), q = R(S.quietChip.box), l = R(S.loudChip.box), b = R(S.ga.g.children[1].querySelector('rect'))
        const nl = R(S.gl.needsLoud.el), lh = R(S.gl.lessHolding.el)
        const gold = R(S.ga.g.querySelector('rect[fill="#ffd84d"]'))
        const crown = S.fig.at('crown')
        out.push({ name: 'first frame (S6\'s last, F-gauge\'s pixels at F0): the frame x 738 to 1662, y 279 to 731 (stroke +-1)', got: `${f.left.toFixed(1)} to ${f.right.toFixed(1)}, ${f.top.toFixed(1)} to ${f.bottom.toFixed(1)}`, want: '737 to 1663, 278 to 732', pass: Math.abs(f.left - 737) < 2 && Math.abs(f.right - 1663) < 2 && Math.abs(f.top - 278) < 2 && Math.abs(f.bottom - 732) < 2 },
          { name: 'the gold line centred y 451.45', got: gold.top + gold.height / 2, want: 451.45, tol: 0.6 },
          { name: 'the chip x 1367 to 1652, y 290 to 332', got: `${chip.left.toFixed(1)} to ${chip.right.toFixed(1)}, ${chip.top.toFixed(1)} to ${chip.bottom.toFixed(1)}`, want: '1367 to 1652, 290 to 332', pass: Math.abs(chip.right - 1651.5) < 2 && Math.abs(chip.top - 289.75) < 2 },
          { name: '"Quiet" and "Loud" from x 1675', got: `${q.left.toFixed(1)}, ${q.top.toFixed(1)}-${q.bottom.toFixed(1)}, ${l.top.toFixed(1)}-${l.bottom.toFixed(1)}`, want: 'info', pass: Math.abs(q.left - 1675.3) < 2 },
          { name: '"what the note needs" (Loud) right edge 1652', got: nl.right, want: 1651.5, tol: 2 },
          { name: '"less holding back at first" from x 738', got: lh.left, want: 738, tol: 2 },
          { name: 'the small band x 738 to 1662, y 143 to 227', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '738 to 1662, 142.75 to 226.75', pass: Math.abs(b.left - 738) < 1 && Math.abs(b.right - 1662) < 1 && Math.abs(b.top - 142.75) < 1 && Math.abs(b.bottom - 226.75) < 1 },
          { name: 'the figure at k 1.2075, x0 150, y0 100.75 (its crown)', got: `${crown[0].toFixed(2)}, ${crown[1].toFixed(2)}`, want: `${(150 + 1.2075 * 230).toFixed(2)}, ${(100.75 + 1.2075 * 20).toFixed(2)}` },
          { name: 'the room: the outgoing framing\'s layers shown, the room at rest hidden', got: `${(+S.cut.ghost.near.style.opacity).toFixed(2)} / ${(+root.querySelector('.layer.near').style.opacity).toFixed(2)}`, want: '1.00 / 0.00' },
          { name: 'hosts at 240', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '36.4-163.6; 1756.4-1883.6' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.ghost) out.push({ name: 'the room\'s crossfade halfway at 0.15 s', got: +S.cut.ghost.far.style.opacity, want: 0.5, tol: 0.06 })
      if (t === T.gone) out.push({ name: 'the outgoing room gone by 0.33 s', got: +S.cut.ghost.under.style.opacity, want: 0, tol: 0.001 })
      if (t === T.chart) {
        const b = R(S.ch.g.querySelector('.band rect')), hr = R(S.ch.g.querySelector('.strip rect')), fr = R(S.fig.g)
        out.push({ name: '7a: the chart reassembled: plot x 400 to 1520, band 382.5 to 557.5', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '400 to 1520, 382.5 to 557.5', pass: Math.abs(b.left - 400) < 1 && Math.abs(b.right - 1520) < 1 && Math.abs(b.top - 382.5) < 1 && Math.abs(b.bottom - 557.5) < 1 },
          { name: '7a: the strip\'s hairline centred y 700', got: hr.top + hr.height / 2, want: 700, tol: 1 },
          { name: '7a: the gauge gone', got: vis(S.ga.g.children[1]), want: '0.00' },
          { name: '[B-01: 184] the strip\'s resting envelope in ghost violet from the reassembly: outline y 672 to 728, x 400 to 1520, stroke 0.35', got: ((g) => g ? `${R(g).left.toFixed(0)} to ${R(g).right.toFixed(0)}, ${R(g).top.toFixed(1)} to ${R(g).bottom.toFixed(1)}, stroke ${g.getAttribute('stroke-opacity')}` : 'none')([...S.ch.g.querySelectorAll('.strip path')].find((p) => p.getAttribute('stroke-opacity') === '0.35' && R(p).width > 1000)), want: '400 to 1520, 672 to 728, stroke 0.35', pass: !![...S.ch.g.querySelectorAll('.strip path')].find((p) => p.getAttribute('stroke-opacity') === '0.35' && Math.abs(R(p).top - 672) < 1.5 && Math.abs(R(p).bottom - 728) < 1.5) },
          { name: '7a: the figure parked: crown y 190, back x 215 (k 0.5, x0 140, y0 180), at 35 %', got: `${S.fig.at('crown')[1].toFixed(1)}, ${S.fig.at('back')[0].toFixed(1)}, ${figA()}`, want: '190.0, 215.0, 0.35' },
          { name: '7a: the parked figure\'s box (board x 215 to 320, y 190 to 460)', got: `${fr.left.toFixed(0)} to ${fr.right.toFixed(0)}, ${fr.top.toFixed(0)} to ${fr.bottom.toFixed(0)}`, want: 'info', pass: true }, ...H.keepout(root, S.boxes))
      }
      if (t === T.kick) out.push({ name: '7a: "COMMON MIX-UP" at (120, 110)', got: `${R(S.kicker.el).left.toFixed(0)}`, want: '120', pass: Math.abs(R(S.kicker.el).left - 120) < 2 }, overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.row0) {
        const ul = R(S.belief.line), q = R(S.belief.q)
        out.push({ name: 'row 0: its dashed underline at y 194 under the whole row', got: `${ul.left.toFixed(1)} to ${ul.right.toFixed(1)}`, want: `358.5 to ${(S.belief.end() + 1.5).toFixed(1)}`, pass: Math.abs(ul.right - S.belief.end() - 1.5) < 3 },
          { name: 'row 0: its "?" 14 px after the last word', got: q.left - S.belief.end(), want: 14, tol: 6 },
          { name: 'row 0: the last word shown (its mask open)', got: S.belief.label.el.getAttribute('mask') ? 'masked' : 'none', want: 'masked' }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.lit) {
        const ib = R(S.inBand.el), fr = R(S.fig.g)
        out.push({ name: '7b: the band lit with "in the band" beside it (right-aligned 366, baseline 540)', got: `${vis(S.inBand.el)} ${ib.right.toFixed(0)}`, want: '1.00 366', pass: vis(S.inBand.el) === '1.00' && Math.abs(ib.right - 366) < 2 },
          { name: '7b: "in the band" under the parked figure (its masked foot, y 465)', got: ib.top - 465, want: '>= 12', pass: ib.top - 465 >= 12 },
          { name: '7b: "ILLUSTRATION" under the strip\'s right end (right 1520, centred y 790)', got: `${R(S.chTag.box).right.toFixed(1)}, ${((R(S.chTag.box).top + R(S.chTag.box).bottom) / 2).toFixed(1)}`, want: '1520, 790', pass: Math.abs(R(S.chTag.box).right - 1520) < 1 && Math.abs((R(S.chTag.box).top + R(S.chTag.box).bottom) / 2 - 790) < 1 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.whole) {
        const pts = S.ch.lastLine('pushed'), w = wave(pts, S.ch.x(0.6), S.ch.x(1.0)), hi = Math.min(...pts.map((p) => p[1]))
        const env = [...S.ch.g.querySelectorAll('.strip path')].map(R).sort((a, b) => b.bottom - a.bottom)[0], tg = R(S.chTag.box)
        out.push({ name: 'wave rule, the pushed take large (W 4, k 2.5): a cycle 50.9 px', got: w.cyc, want: 50.9, tol: 5.1 },
          { name: 'wave rule large: peak to peak 70 px (its held start)', got: w.pp, want: 70, tol: 7 },
          { name: 'the line\'s highest point under row 0\'s underline (194)', got: hi - 194, want: 'board 56', pass: hi - 194 >= 12 },
          { name: 'the swollen strip over "ILLUSTRATION"', got: tg.top - env.bottom, want: '>= 12', pass: tg.top - env.bottom >= 12 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.hold) {
        const b = R(S.ch.g.querySelector('.band rect'))
        out.push({ name: '[B-01: 180] evidence 1 held whole: the take drawn to its end, the chart still full size, at the hold\'s end', got: `${b.left.toFixed(0)} to ${b.right.toFixed(0)}`, want: '400 to 1520', pass: Math.abs(b.left - 400) < 1 && Math.abs(b.right - 1520) < 1 },
          { name: '[B-01: 180] the hold (s), the redraw\'s speed, the shrink (s)', got: `${A.HOLD_D.toFixed(2)}, ${A.SPEED.toFixed(2)}x, ${A.SHRINK1_D.toFixed(2)} (${(A.REDRAW + A.REDRAW_D).toFixed(2)} to ${A.SHRINK1.toFixed(2)}, shrink to ${(A.SHRINK1 + A.SHRINK1_D).toFixed(2)})`, want: '0.50, >= 2.5x, 0.4 to 0.6', pass: Math.abs(A.HOLD_D - 0.5) < 1e-6 && A.SPEED >= 2.5 && A.SHRINK1_D >= 0.4 - 1e-6 },
          { name: '[B-01: 180] row 1 lands 0.4 s or more before row 2\'s first line', got: +(A.ROW2A - A.ROW1).toFixed(3), want: '>= 0.4', pass: A.ROW2A - A.ROW1 >= 0.4 - 1e-6 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.row1) {
        const b = R(S.ch.g.querySelector('.band rect')), tg = R(S.row1Tag.box), r1 = R(S.rows.row1.el)
        const pts = S.ch.lastLine('pushed'), w = wave(pts, S.ch.x(0.6), S.ch.x(1.0))
        out.push({ name: '7b: the chart at 0.41 in row 1: band x 1180 to 1639.2, y 274.1 to 345.9', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '1180 to 1639.2, 274.1 to 345.9', pass: Math.abs(b.left - 1180) < 1 && Math.abs(b.right - 1639.2) < 1 && Math.abs(b.top - 274.1) < 1 && Math.abs(b.bottom - 345.9) < 1 },
          { name: '7b: row 1 at x 360, baseline 300; its chip from x 360, centred y 345', got: `${r1.left.toFixed(0)}; ${tg.left.toFixed(0)}, ${((tg.top + tg.bottom) / 2).toFixed(0)}`, want: '360; 360, 345' },
          { name: '7b: row 1\'s words left of the miniature', got: R(S.ch.g.querySelector('.band rect')).left - r1.right, want: '>= 12', pass: b.left - r1.right >= 12 },
          { name: 'wave rule, row 1\'s miniature: a cycle 20.9 px', got: 0.41 * w.cyc, want: 20.9, tol: 2.1 },
          { name: 'wave rule, row 1\'s miniature: peak to peak 28.7 px', got: 0.41 * w.pp, want: 28.7, tol: 2.9 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.pair) {
        const [e, p] = S.pr.g.querySelectorAll('rect')
        out.push({ name: '7c: "easy" x 860 to 1200, y 570 to 790', got: `${R(e).left.toFixed(0)} to ${R(e).right.toFixed(0)}, ${R(e).top.toFixed(0)} to ${R(e).bottom.toFixed(0)}`, want: '859 to 1201, 569 to 791', pass: Math.abs(R(e).top - 569) < 2 },
          { name: '7c: "pressed" x 1260 to 1600, y 652 to 708', got: `${R(p).left.toFixed(0)} to ${R(p).right.toFixed(0)}, ${R(p).top.toFixed(0)} to ${R(p).bottom.toFixed(0)}`, want: '1259 to 1601, 651 to 709', pass: Math.abs(R(p).top - 651) < 2 },
          { name: '7c: row 2\'s first line and "same push: much quieter" shown', got: `${vis(S.rows.row2a.el)} ${vis(S.rows.row2c.el)}`, want: '1.00 1.00' },
          ...((tg) => {
            const push = [...S.pr.g.querySelectorAll('text')].find((x) => x.textContent === 'one push of air'), pb = push ? R(push) : null, mini = R(S.ch.g.querySelector('.band rect'))
            const ink = H.ink('one push of air', "500 28px 'Outfit'", 'middle'), pushTop = 530 - ink.up, pushRight = 1230 + ink.r
            return [{ name: '[B-01: 187] evidence 2 carries "ILLUSTRATION" while large: right 1600, centred y 470', got: `${vis(S.pairTag.g)}, ${tg.left.toFixed(0)} to ${tg.right.toFixed(0)}, ${tg.top.toFixed(0)} to ${tg.bottom.toFixed(0)}`, want: '1.00, to 1600, 450 to 490', pass: vis(S.pairTag.g) === '1.00' && Math.abs(tg.right - 1600) < 1 },
              { name: '[B-01: 187] ... clear of "one push of air" (ink, vertical gap where they share x) and of row 1\'s miniature', got: `${(pushTop - tg.bottom).toFixed(1)} (x overlap ${(pushRight - tg.left).toFixed(1)}), ${(tg.top - mini.bottom).toFixed(1)}`, want: '>= 12, >= 12', pass: (pushRight < tg.left - 12 || pushTop - tg.bottom >= 12) && tg.top - mini.bottom >= 12 }]
            void pb
          })(R(S.pairTag.box)), overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.more) out.push({ name: '7c: "more pressure, not less" landed (baseline 535)', got: vis(S.rows.row2b.el), want: '1.00' }, overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.row2) {
        const [e, p] = S.pr.g.querySelectorAll('rect')
        out.push({ name: '7c: the pair in row 2 (0.5): "easy" from x 1180, top 465', got: `${R(e).left.toFixed(1)}, ${R(e).top.toFixed(1)}`, want: '1179.5, 464.5', pass: Math.abs(R(e).left - 1179.5) < 1.5 && Math.abs(R(e).top - 464.5) < 1.5 },
          { name: '7c: "pressed" right 1550', got: R(p).right, want: 1550.5, tol: 1.5 },
          ...((tg) => [{ name: '[B-01: 187] row 2\'s own "ILLUSTRATION": right of its first line (gap), centred on its words, left of the pair (gap)', got: `${vis(S.row2Tag.g)}; ${(tg.left - R(S.rows.row2a.el).right).toFixed(1)}, ${((tg.top + tg.bottom) / 2).toFixed(1)}, ${(R(e).left - tg.right).toFixed(1)}`, want: '1.00; >= 12, 476, >= 12', pass: vis(S.row2Tag.g) === '1.00' && tg.left - R(S.rows.row2a.el).right >= 12 && R(e).left - tg.right >= 12 },
            { name: '[B-01: 187] ... over row 2\'s second line (gap, where they share x)', got: +(R(S.rows.row2b.el).top - tg.bottom).toFixed(1), want: 'info (x apart)', pass: R(S.rows.row2b.el).right < tg.left - 12 || R(S.rows.row2b.el).top - tg.bottom >= 4 }])(R(S.row2Tag.box)),
          { name: '7c: the row\'s words left of the pair', got: R(e).left - Math.max(R(S.rows.row2a.el).right, R(S.rows.row2b.el).right), want: '>= 12', pass: R(e).left - Math.max(R(S.rows.row2a.el).right, R(S.rows.row2b.el).right) >= 12 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.sup) {
        out.push({ name: '7d: the four words back, "support" lit with the two before', got: S.row.chips.map((c) => c.el.getAttribute('fill') === 'rgb(230,237,243)' ? 'lit' : 'dim').join(' '), want: 'lit lit dim lit' },
          { name: '7d: the large word at x 360, baseline 800', got: `${R(S.large.el).left.toFixed(0)}`, want: '360', pass: Math.abs(R(S.large.el).left - 360) < 6 }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.howPk) {
        const m = /scale\(([\d.]+)\)/.exec(S.how.el.getAttribute('transform') || ''), sc = m ? +m[1] : 1
        out.push({ name: '[F-01: 227] "how singers manage the breath" settles on "how": its scale at the peak (44 px: 1.1 x 1.08)', got: +sc.toFixed(4), want: +(1.1 * 1.08).toFixed(4), tol: 0.002 },
          { name: '[F-01: 227] ... its left baseline stays at (980, 800)', got: `${R(S.how.el).left.toFixed(0)}`, want: '980', pass: Math.abs(R(S.how.el).left - 980) < 3 })
      }
      if (t === T.noone) out.push({ name: '7d: "how singers manage the breath" at x 980, baseline 800; "no one agreed meaning" at 980, 850', got: `${R(S.how.el).left.toFixed(0)}, ${R(S.noOne.el).left.toFixed(0)}`, want: '980, 980', pass: Math.abs(R(S.how.el).left - 980) < 2 && Math.abs(R(S.noOne.el).left - 980) < 2 }, overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.row3) {
        const sr = R(S.supRow.el), hw = R(S.how.el)
        out.push({ name: '7d: row 3 from x 360, baseline 655; its phrase follows on the baseline', got: `${sr.left.toFixed(0)}; ${(hw.left - sr.right).toFixed(1)} px after the colon`, want: '360; a space', pass: Math.abs(sr.left - 360) < 2 && hw.left - sr.right > 4 && hw.left - sr.right < 16 },
          { name: '7d: the large word gone', got: vis(S.large.el), want: '0.00' }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.breathe) out.push({ name: '7e: the parked figure at full, breathing in', got: `${figA()} ${S.fig.shape().b.toFixed(2)}`, want: 'info', pass: +figA() > 0.95 }, overlaps(), ...H.keepout(root, S.boxes))
      if (t === T.row4) {
        const ps = S.phrases.map((p) => R(p.el)), hd = R(S.rows.row4.el)
        const lastInk = S.R4.lines[3] + H.ink('let it flow out unforced', "600 40px 'Outfit'").down
        const names = [...S.pr.g.querySelectorAll('text')].filter((x) => H.alpha(x) > 0.5).map(R)
        const namesBot = names.length ? Math.max(...names.map((r) => r.bottom)) : 0
        const headTop = S.R4.head - H.ink('The better idea:', "600 30px 'Outfit'").up
        const lum = (c) => { const v = c.match(/\d+/g).map((x) => { x = +x / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] }
        const fills = S.dimEls().map((e) => e.getAttribute('fill')), cr = (lum(fills[0]) + 0.05) / (lum('rgb(13,17,23)') + 0.05)
        out.push({ name: '[B-01: 185] row 4 in the lower right: "The better idea:" and one phrase to a line from x 1180, all within x 1700', got: `${hd.left.toFixed(0)}-${hd.right.toFixed(0)}; ${ps.map((r) => `${r.left.toFixed(0)}-${r.right.toFixed(0)}`).join(', ')}`, want: 'from 1180, to 1700 at most', pass: [hd, ...ps].every((r) => Math.abs(r.left - 1180) < 3 && r.right <= 1700) },
          { name: '[B-01: 185, 188] its last line\'s glyphs over the floor horizon (840)', got: +(840 - lastInk).toFixed(1), want: '>= 12', pass: 840 - lastInk >= 12 },
          { name: '[B-01: 185] its heading (ink) under row 2\'s miniature names (font boxes)', got: +(headTop - namesBot).toFixed(1), want: '>= 12', pass: headTop - namesBot >= 12 },
          { name: '[B-01: 185] rows 0 to 3 dimmed to ink-2; contrast on the ground', got: `${[...new Set(fills)].join(' ')}; ${cr.toFixed(2)}:1`, want: 'rgb(168,179,191); >= 4.5:1', pass: fills.every((f) => f === 'rgb(168,179,191)') && cr >= 4.5 },
          { name: '[B-01: 188] "let it flow out unforced" lands on "let" (s after the word)', got: +(A.PH[3] - L.word('s07-support', 'b20', 'let')).toFixed(3), want: '<= 0.2', pass: A.PH[3] - L.word('s07-support', 'b20', 'let') <= 0.2 },
          { name: '7e: the figure dimmed again', got: figA(), want: '0.35' }, overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.last) {
        const vt = H.texts(root, 0.02)
        out.push({ name: 'last frame (S7 to S8): every row and miniature gone', got: vt.length ? vt.map((x) => x.text).join(' | ') : 'none', want: 'none', pass: !vt.length },
          { name: 'the miniatures gone', got: `${vis(S.ch.g)} ${vis(S.pr.g)}`, want: '0.00 0.00' },
          { name: 'the dimmed figure parked: k 0.5, x0 140, y0 180, at 35 %', got: `${S.fig.at('crown')[1].toFixed(1)}, ${S.fig.at('back')[0].toFixed(1)}, ${figA()}, breath ${S.fig.shape().b.toFixed(2)}`, want: '190.0, 215.0, 0.35, breath 0.00' },
          { name: 'hosts at 240', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '36.4-163.6; 1756.4-1883.6' })
      }
      return out
    },
  }
})()
