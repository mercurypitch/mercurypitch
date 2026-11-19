// s12-your-turn's checks (lab/s05-push/probe.mjs, the shared probe): the first frame against S11's last (HANDOFFS § The
// cuts S11 to S12), the voices, the phase row, the stop line, the thinning before the push, the push to F-turn and its
// landing before `listen` (LAB-CHECKS 3), F-turn's pixels (HANDOFFS § The turn, § Framings), the ring as a clock through
// the hold (12e), the feel block, the doctor lines full size and their underlines, the last frame against § The cuts
// S12 to S13, overlaps between visible texts, the caption band and the keep-out.
;(function () {
  const H = window.__H, sid = 's12-your-turn'
  const S = window.__sceneProbe[sid], A = S.A
  const T = {
    f0: 0, mya: A.MYA + 0.3, oct: A.OCT + 0.3, row: A.ROW + 0.3, vol: A.VOL + 0.3, tick: A.TICK + 0.4, sooner: A.SOONER + 0.3, stop: A.STOP + 0.4,
    thin: A.THIN + A.THIN_D + 0.05, pushmid: A.PUSH + A.PUSH_D / 2, landed: A.PUSH + A.PUSH_D, listen: A.LISTEN + 0.3, breathe: A.BREATHE_IN + 0.3,
    breath: (A.BREATH0 + A.TICKIN) / 2, sing: A.TICKIN + 0.3, zero: A.COUNT0 + 0.25, h48: A.HOLD + 4.8, closed: A.HOLD_END + 0.12,
    ringOut: A.RING_OUT + A.RING_OUT_D + 0.01, q: A.Q + 0.4, a4: A.ANS[3] + 0.3, feel: A.FEEL + A.FEEL_D / 2, l1: A.LINE1 + 0.5,
    l2: A.LINE2 + 0.3, l3: A.LINE3 + 0.3, all: A.ALL + 0.3, full: A.DOCX + 0.85, u1: A.U1 + 0.6, u2: A.U2 + 0.8, end: A.END + A.END_D + 0.01, last: A.D - 0.0005,
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const fmt = (r) => `${r.left.toFixed(1)} to ${r.right.toFixed(1)}, ${r.top.toFixed(1)} to ${r.bottom.toFixed(1)}`
  const bandEl = () => S.ch.g.querySelector('.band rect')
  const inkOf = (el) => {
    const cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const ink = H.ink(el.textContent, font, el.getAttribute('text-anchor') || 'start')
    const m = el.getScreenCTM(), x = +el.getAttribute('x'), y = +el.getAttribute('y')
    const p0 = new DOMPoint(x + ink.l, y - ink.up).matrixTransform(m), p1 = new DOMPoint(x + ink.r, y + ink.down).matrixTransform(m)
    return { left: p0.x, top: p0.y, right: p1.x, bottom: p1.y, width: p1.x - p0.x, height: p1.y - p0.y, base: new DOMPoint(x, y).matrixTransform(m).y }
  }
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
  const visTexts = (min = 0.05) => H.texts(root, min).map((x) => x.text)
  const footOf = (min = 0.05) => Math.max(...[...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= min && e.textContent.trim()).map((e) => inkOf(e).bottom))
  const ringBox = () => R(S.ring.g.querySelector('circle'))
  const shown = (els) => els.filter((e) => H.alpha(e) > 0.5).map((e) => e.textContent.trim()).join(', ')
  const common = () => [overlaps(), ...H.keepout(root, S.boxes), { name: 'nothing visible below y 896 (ink)', got: footOf(), want: '<= 896', pass: footOf() <= 896 }]
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.f0) {
        const b = R(bandEl())
        out.push({ name: 'first frame (S11\'s last, F0): the band x 1000 to 1640, y 210 to 280', got: fmt(b), want: '1000 to 1640, 210 to 280', pass: Math.abs(b.left - 1000) < 0.5 && Math.abs(b.right - 1640) < 0.5 && Math.abs(b.top - 210) < 0.5 && Math.abs(b.bottom - 280) < 0.5 },
          { name: 'the care block to the listening line, the doctor lines small, the bracket, "0", "10 s", "Nothing listens"', got: visTexts().length, want: 12 + S.doc.filter((e) => e.textContent).length },
          { name: 'the ring at 35 %, drawn, at rest, no counter', got: `${S.ring.g.getAttribute('opacity')} / ${S.ring.g.querySelector('circle').getAttribute('stroke-opacity')} / ${S.ring.g.querySelector('g').getAttribute('transform') || 'none'} / ${[...S.ring.g.querySelectorAll('text')].filter((e) => H.alpha(e) > 0.01).length}`, want: '1.000 / 0.350 / none / 0' },
          { name: 'hosts at 300 in the corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' }, ...common())
      }
      if (t === T.mya) {
        const r = inkOf(S.voices[0].el), d = R(S.voices[0].g.querySelector('circle'))
        out.push({ name: '12a: "A3 · Merc" from x 1016, baseline 362; its blue dot x 1000 to 1012', got: `${fmt(r)}; dot ${d.left.toFixed(1)} to ${d.right.toFixed(1)}`, want: 'x 1016 to 1139, y 340 to 363', pass: Math.abs(r.left - 1016) < 3 && Math.abs(d.left - 1000) < 0.5 },
          { name: 'under "0" (gap)', got: r.top - inkOf(S.br0.el).bottom, want: '>= 12', pass: r.top - inkOf(S.br0.el).bottom >= 12 },
          { name: 'Merc\'s line glows', got: +S.ch.merc.glowPath.getAttribute('stroke-opacity'), want: '> 0.3', pass: +S.ch.merc.glowPath.getAttribute('stroke-opacity') > 0.3 })
      }
      if (t === T.oct) {
        const a = inkOf(S.voices[0].el), r = inkOf(S.voices[1].el), d = R(S.voices[1].g.querySelector('circle'))
        out.push({ name: '12a: "A4 · Tavi, an octave up" from x 1202; its orange dot from 1186', got: `${fmt(r)}; dot ${d.left.toFixed(1)}`, want: 'x 1202 to 1500', pass: Math.abs(r.left - 1202) < 3 && Math.abs(d.left - 1186) < 0.5 },
          { name: 'its dot right of "A3 · Merc" (gap)', got: d.left - a.right, want: '>= 30', pass: d.left - a.right >= 30 }, ...common())
      }
      if (t === T.row) {
        // the row is tracked mono: its boxes from the text elements themselves (canvas metrics carry no tracking), less
        // the tracking after each word's last glyph
        const tr = 0.18 * 28, bx = (e) => { const r = R(e); return { left: r.left, right: r.right - tr, bottom: r.bottom } }
        const ws = S.rowWords.map(bx), dots = S.rowDots.map(bx)
        const mid = (ws[0].left + ws[2].right) / 2
        out.push({ name: '12b: "LISTEN · BREATHE · SING" centred x 1320, baseline 790 (advance boxes)', got: `${ws[0].left.toFixed(1)} to ${ws[2].right.toFixed(1)} (centre ${mid.toFixed(1)})`, want: 'centre 1320', pass: Math.abs(mid - 1320) < 1.5 },
          { name: 'the middots between the words, a space each side (advance gaps)', got: `${(dots[0].left - ws[0].right).toFixed(1)}, ${(ws[1].left - dots[0].right).toFixed(1)}, ${(dots[1].left - ws[1].right).toFixed(1)}, ${(ws[2].left - dots[1].right).toFixed(1)}`, want: 'all equal', pass: Math.abs((dots[0].left - ws[0].right) - (ws[1].left - dots[0].right)) < 1 && Math.abs((dots[1].left - ws[1].right) - (ws[2].left - dots[1].right)) < 1 },
          { name: '"Listen" lit to ink', got: S.rowWords[0].getAttribute('fill'), want: 'rgb(230,237,243)' },
          { name: 'the row under the ring (gap from the track\'s foot)', got: inkOf(S.rowWords[0]).top - (ringBox().bottom + 5), want: '>= 12', pass: inkOf(S.rowWords[0]).top - (ringBox().bottom + 5) >= 12 })
      }
      if (t === T.vol) out.push({ name: '12b: "Breathe" lit; "at about speaking volume" centred 1320, baseline 828', got: `${S.rowWords[1].getAttribute('fill')}; ${fmt(inkOf(S.rowLines[0].el))}`, want: 'ink; centre 1320', pass: Math.abs((inkOf(S.rowLines[0].el).left + inkOf(S.rowLines[0].el).right) / 2 - 1320) < 3 })
      if (t === T.tick) out.push({ name: '12b: the ring\'s 12 o\'clock tick brightens on "ring closes,"', got: +S.ring.g.querySelector('rect').getAttribute('fill-opacity'), want: '> 0.9', pass: +S.ring.g.querySelector('rect').getAttribute('fill-opacity') > 0.9 })
      if (t === T.sooner) {
        const r = inkOf(S.rowLines[1].el)
        out.push({ name: '12b: "stop sooner if you need to" baseline 864: its ink above 896', got: fmt(r), want: 'foot <= 896', pass: r.bottom <= 896 },
          { name: 'all three phase words lit', got: S.rowWords.map((e) => e.getAttribute('fill')).join(' '), want: 'ink x3', pass: S.rowWords.every((e) => e.getAttribute('fill') === 'rgb(230,237,243)') }, ...common())
      }
      if (t === T.stop) {
        const a = inkOf(S.stop[0].el), b = inkOf(S.stop[1].el)
        out.push({ name: '12c: the stop line x 260, baselines 548 and 590 (ink)', got: `${fmt(a)}; ${fmt(b)}`, want: 'x 260 to 726 / 596, within 960', pass: Math.abs(a.left - 260) < 2 && a.right <= 960 && Math.abs(b.bottom - 591) < 2 },
          { name: 'between the listening line and the doctor lines (gaps)', got: `${(a.top - inkOf(S.listening.el).bottom).toFixed(1)}, ${(inkOf(S.doc[0]).top - b.bottom).toFixed(1)}`, want: '>= 12 each', pass: a.top - inkOf(S.listening.el).bottom >= 12 && inkOf(S.doc[0]).top - b.bottom >= 12 }, ...common())
      }
      if (t === T.thin) {
        const st = S.cam.state(t)
        out.push({ name: '12c: thinned before the push: the icon, comfort line, reasons and listening line at 0', got: shown([...S.comfort.map((l) => l.el), ...S.reasons.map((p) => p.lab.el), S.listening.el]) || 'none', want: 'none', pass: !shown([...S.comfort.map((l) => l.el), ...S.reasons.map((p) => p.lab.el), S.listening.el]) && H.alpha(S.icon) < 0.01 },
          { name: 'the phase row and its two lines gone', got: H.alpha(S.rowG).toFixed(3) + ' / ' + H.alpha(S.rowLines[0].el).toFixed(3), want: '0 / 0', pass: H.alpha(S.rowG) < 0.001 && H.alpha(S.rowLines[1].el) < 0.001 },
          { name: 'kept: "Your turn.", the stop line, the doctor lines', got: [S.title.el, ...S.stop.map((l) => l.el), ...S.doc].filter((e) => H.alpha(e) > 0.5 && e.textContent).length, want: 3 + S.doc.filter((e) => e.textContent).length },
          { name: 'the push not started (s)', got: st.s, want: 1, tol: 0.0005 })
      }
      if (t === T.pushmid) {
        const s = S.cam.scale(t, 'mid'), sf = S.cam.scale(t, 'far'), sn = S.cam.scale(t, 'near')
        out.push({ name: '12c: mid-push the layers part (far, mid, near scale)', got: `${sf.toFixed(3)}, ${s.toFixed(3)}, ${sn.toFixed(3)}`, want: 'far < mid < near', pass: sf < s && s < sn },
          { name: 'the care block holds still through the push ("Your turn." ink left)', got: inkOf(S.title.el).left, want: 266, tol: 1 })
      }
      if (t === T.landed) {
        const b = R(bandEl()), tr = ringBox(), m = R(S.ch.merc.path)
        const lab = (el) => inkOf(el).base
        out.push({ name: '12c: F-turn: the frame x 928 to 1824, band 104 to 202', got: fmt(b), want: '928 to 1824, 104 to 202', pass: Math.abs(b.left - 928) < 0.6 && Math.abs(b.right - 1824) < 0.6 && Math.abs(b.top - 104) < 0.6 && Math.abs(b.bottom - 202) < 0.6 },
          { name: 'Merc\'s line y 153', got: (m.top + m.bottom) / 2, want: 153, tol: 0.6 },
          { name: 'the ring centre (1376, 636), r 224', got: `${((tr.left + tr.right) / 2).toFixed(1)}, ${((tr.top + tr.bottom) / 2).toFixed(1)}, r ${(tr.width / 2).toFixed(1)}`, want: '1376, 636, r 224', pass: Math.abs((tr.left + tr.right) / 2 - 1376) < 1 && Math.abs((tr.top + tr.bottom) / 2 - 636) < 1 && Math.abs(tr.width / 2 - 224) < 1 },
          { name: 'labels at screen baselines 261 ("0", "10 s"), 317 (voices), 373 ("Nothing listens")', got: `${lab(S.br0.el).toFixed(1)}, ${lab(S.voices[0].el).toFixed(1)}, ${lab(S.nothing.el).toFixed(1)}`, want: '261, 317, 373', pass: Math.abs(lab(S.br0.el) - 261) < 1 && Math.abs(lab(S.voices[0].el) - 317) < 1 && Math.abs(lab(S.nothing.el) - 373) < 1 },
          { name: '"Nothing listens" x 928 to 1243', got: `${inkOf(S.nothing.el).left.toFixed(1)} to ${inkOf(S.nothing.el).right.toFixed(1)}`, want: '928 to 1243', pass: Math.abs(inkOf(S.nothing.el).left - 930.8) < 4 },
          { name: 'LAB-CHECKS 15: "Your turn." from the frame and its labels (x 928)', got: 928 - inkOf(S.title.el).right, want: '>= 12', pass: 928 - inkOf(S.title.el).right >= 12 },
          { name: 'LAB-CHECKS 15: "Your turn." from the ring', got: tr.left - 5 - inkOf(S.title.el).right, want: '>= 12', pass: tr.left - 5 - inkOf(S.title.el).right >= 12 },
          { name: 'LAB-CHECKS 3: the push has landed before `listen`', got: `landed ${(A.PUSH + A.PUSH_D).toFixed(3)}, listen ${A.LISTEN.toFixed(3)}`, want: '0.14 s before', pass: Math.abs(A.LISTEN - (A.PUSH + A.PUSH_D) - 0.14) < 0.001 },
          { name: 'LAB-CHECKS 3: the thinning starts after the stop line has landed', got: `thin ${A.THIN.toFixed(3)}, stop in by ${(A.STOP + 0.3).toFixed(3)}`, want: 'thin later', pass: A.THIN > A.STOP + 0.3 },
          { name: 'the ring\'s right edge from Tavi\'s keep-out (1700)', got: 1700 - (tr.right + 5), want: '>= 0', pass: tr.right + 5 <= 1700 }, ...common())
      }
      if (t === T.listen) {
        const w = [...S.ring.g.querySelectorAll('text')].find((e) => e.textContent === 'Listen'), r = inkOf(w)
        out.push({ name: '12d: "Listen" inside the ring, 56 px on screen, centred x 1376, baseline 577', got: `${fmt(r)}, base ${r.base.toFixed(1)}`, want: 'centre 1376, base 577', pass: Math.abs((r.left + r.right) / 2 - 1376) < 3 && Math.abs(r.base - 577) < 1 },
          { name: 'the camera at F-turn (s 1.4) when "Listen" lands', got: S.cam.state(A.LISTEN).s, want: 1.4, tol: 0.0005 },
          { name: 'the voices scale 1.08 (both)', got: S.voices.map((v) => (v.g.getAttribute('transform') || '').match(/scale\(([\d.]+)/)?.[1] || '1').join(', '), want: '> 1.0', pass: S.voices.every((v) => /scale\(1\.0[1-8]/.test(v.g.getAttribute('transform') || '')) })
      }
      if (t === T.breathe) {
        const b = inkOf(S.breatheIn.el), n = inkOf(S.nothing.el)
        out.push({ name: '12d: "Breathe in, low and quiet" right-aligned to 1824, baseline 373 (screen)', got: `${fmt(b)}, base ${b.base.toFixed(1)}`, want: 'right 1824, base 373', pass: Math.abs(b.right - 1824) < 4 && Math.abs(b.base - 373) < 1 },
          { name: 'it shares a baseline with "Nothing listens", 70 px or more apart', got: b.left - n.right, want: '>= 70', pass: b.left - n.right >= 70 },
          { name: '"Breathe" in the ring, "Listen" gone', got: shown([...S.ring.g.querySelectorAll('text')]), want: 'Breathe' }, ...common())
      }
      if (t === T.breath) out.push({ name: '12d: the ring breathes to 1.08 at its middle', got: (S.ring.g.querySelector('g').getAttribute('transform') || '').match(/scale\(([\d.]+)/)?.[1], want: '1.08', pass: /scale\(1\.0[78]/.test(S.ring.g.querySelector('g').getAttribute('transform') || '') })
      if (t === T.sing) out.push({ name: '12e: "Sing" in the ring; "Breathe in, low and quiet" gone; no counter yet', got: `${shown([...S.ring.g.querySelectorAll('text')])}; ${H.alpha(S.breatheIn.el).toFixed(2)}`, want: 'Sing; 0.00' })
      if (t === T.zero) out.push({ name: '12e: the counter at "0" (baseline 706 on screen, 112 px)', got: shown([...S.ring.g.querySelectorAll('text')]), want: 'Sing, 0' })
      if (t === T.h48) {
        const c = [...S.ring.g.querySelectorAll('text')].find((e) => e.textContent === '4' && H.alpha(e) > 0.5), r = c && inkOf(c)
        const arc = +S.ring.g.querySelectorAll('circle')[2].getAttribute('stroke-dasharray').split(' ')[0]
        const ph = R(S.playhead.g)
        out.push({ name: '12e (board 433.00): the counter at "4", 112 px, baseline 706 (screen)', got: r ? `${fmt(r)}, base ${r.base.toFixed(1)}` : 'none', want: 'base 706', pass: !!r && Math.abs(r.base - 706) < 1 },
          { name: 'the arc at an even pace: 0.48 of the ring at 4.8 s', got: arc, want: 0.48, tol: 0.002 },
          { name: 'the playhead at 928 + 89.6 x 4.8 = 1358.1, the band\'s height (104 to 202)', got: `${(ph.left + ph.width / 2).toFixed(1)}, ${ph.top.toFixed(1)} to ${ph.bottom.toFixed(1)}`, want: '1358.1, 104 to 202', pass: Math.abs(ph.left + ph.width / 2 - 1358.1) < 1 && Math.abs(ph.top - 104) < 1 && Math.abs(ph.bottom - 202) < 1 },
          { name: 'nothing listens: no violet line, no word but "Sing"', got: `${S.ch.g.querySelectorAll('.lines g').length} lines; ${shown([...S.ring.g.querySelectorAll('text')])}`, want: '0 lines; Sing, 4' },
          { name: 'LAB-CHECKS 15: "Your turn." on screen through the ten seconds', got: H.alpha(S.title.el).toFixed(2), want: '1.00' }, ...common())
      }
      if (t === T.closed) out.push({ name: '12e: at the second tick the ring is closed and "10" counts', got: `${S.ring.g.querySelectorAll('circle')[2].getAttribute('stroke-dasharray')}; ${shown([...S.ring.g.querySelectorAll('text')])}`, want: '1.00000 1; Sing, 10' },
        { name: 'one chrome echo ring', got: [...S.echo.g.querySelectorAll('circle')].filter((c) => +c.getAttribute('opacity') > 0).length, want: 1 })
      if (t === T.ringOut) out.push({ name: '12f: the ring, its word, the counter, the playhead and "Your turn." gone', got: `${S.ring.g.getAttribute('opacity')} ${S.playhead.g.getAttribute('opacity')} ${H.alpha(S.title.el).toFixed(3)}`, want: '0.000 0.000 0.000' })
      if (t === T.q) {
        const r = inkOf(S.question.el)
        out.push({ name: '12f: "How did that feel?" x 1000, baseline 480 (frame-fixed)', got: fmt(r), want: 'x 997 to 1407, y 431 to 481', pass: Math.abs(r.left - 997) < 3 && Math.abs(r.bottom - 481) < 2 },
          { name: 'it lands where the ring was, under the frame\'s labels ("Nothing listens" foot)', got: r.top - inkOf(S.nothing.el).bottom, want: '>= 12', pass: r.top - inkOf(S.nothing.el).bottom >= 12 }, ...common())
      }
      if (t === T.a4) {
        const bx = S.caps.map((c) => R(c.box)), tx = S.caps.map((c) => inkOf(c.el))
        out.push({ name: '12f: four capsules x 1000 to 1230, 44 high, centred y 540, 596, 652, 708', got: bx.map((b) => `${b.left.toFixed(0)}-${b.right.toFixed(0)} @${((b.top + b.bottom) / 2).toFixed(0)}`).join('; '), want: '1000-1230 @540/596/652/708', pass: bx.every((b, i) => Math.abs(b.left - 999) < 2 && Math.abs(b.right - 1231) < 2 && Math.abs((b.top + b.bottom) / 2 - [540, 596, 652, 708][i]) < 1) },
          { name: 'each word inside its capsule (pads)', got: tx.map((r, i) => `${(r.left - bx[i].left).toFixed(1)}/${(bx[i].right - r.right).toFixed(1)}`).join(', '), want: '>= 10 each side', pass: tx.every((r, i) => r.left - bx[i].left >= 10 && bx[i].right - r.right >= 10) },
          { name: 'the capsules under the question (gap)', got: bx[0].top - inkOf(S.question.el).bottom, want: '>= 12', pass: bx[0].top - inkOf(S.question.el).bottom >= 12 }, ...common())
      }
      if (t === T.feel) { const g = R(S.feelRing.g); out.push({ name: '12f: the small ring timer beside the question at (1660, 458), r 16', got: `${((g.left + g.right) / 2).toFixed(1)}, ${((g.top + g.bottom) / 2).toFixed(1)}`, want: '1660, 458', pass: Math.abs((g.left + g.right) / 2 - 1660) < 2 && Math.abs((g.top + g.bottom) / 2 - 458) < 2 }, { name: 'right of the question (gap)', got: g.left - inkOf(S.question.el).right, want: '>= 40', pass: g.left - inkOf(S.question.el).right >= 40 }) }
      if (t === T.l1) {
        const br = R(S.feelBr.path), ln = inkOf(S.feelLines[0].el)
        out.push({ name: '12g: Easy and Workable lit (stroke 1.0)', got: S.caps.map((c) => c.box.getAttribute('stroke-opacity')).join(' '), want: '1.000 1.000 0.700 0.700' },
          { name: 'the bracket at x 1240, y 540 to 596, its ticks back to the capsules', got: fmt(br), want: '1234 to 1240, 540 to 596', pass: Math.abs(br.right - 1240) < 1.5 && Math.abs(br.top - 540) < 1.5 && Math.abs(br.bottom - 596) < 1.5 && br.left > 1231 },
          { name: '"rest a few easy breaths" x 1260, baseline 579', got: fmt(ln), want: 'from 1260', pass: Math.abs(ln.left - 1261) < 3 })
      }
      if (t === T.l2) out.push({ name: '12g: Effortful lit, the two before dimmed (their labels ink)', got: `${S.caps.map((c) => c.box.getAttribute('stroke-opacity')).join(' ')}; ${S.caps.map((c) => c.el.getAttribute('fill')).join(' ')}`, want: '0.280 0.280 1.000 0.700', pass: S.caps.map((c) => c.box.getAttribute('stroke-opacity')).join(' ') === '0.280 0.280 1.000 0.700' })
      if (t === T.l3) {
        const right = Math.max(...S.feelLines.map((l) => inkOf(l.el).right)), foot = Math.max(...S.caps.map((c) => R(c.box).bottom))
        out.push({ name: '12g: Uncomfortable lit, Effortful dimmed', got: S.caps.map((c) => c.box.getAttribute('stroke-opacity')).join(' '), want: '0.280 0.280 0.280 1.000' },
          { name: 'the feel block left of x 1630 and above y 730', got: `${right.toFixed(1)}, ${foot.toFixed(1)}`, want: '<= 1630, <= 731', pass: right <= 1630 && foot <= 731 }, ...common())
      }
      if (t === T.all) out.push({ name: '12h: all four lit together', got: S.caps.map((c) => c.box.getAttribute('stroke-opacity')).join(' '), want: '1.000 1.000 1.000 1.000' })
      if (t === T.full) {
        const lines = S.docFull.filter((e) => e.textContent), r = lines.map(inkOf)
        out.push({ name: '12h: the doctor lines full size (Inter 40, ink), broken where the font puts them within 700 px', got: lines.length, want: lines.length, pass: lines.length >= 5 && lines.length <= 6 },
          { name: 'within x 260 to 960 (ink), baselines from 430, 50 apart', got: `${Math.min(...r.map((x) => x.left)).toFixed(1)} to ${Math.max(...r.map((x) => x.right)).toFixed(1)}; ${lines.map((e) => e.getAttribute('y')).join(', ')}`, want: '>= 258, <= 960', pass: Math.min(...r.map((x) => x.left)) >= 258 && Math.max(...r.map((x) => x.right)) <= 960 },
          { name: 'word for word', got: lines.map((e) => e.textContent).join(' ') === L.TURN.CARE.doctor ? 'same' : 'differs', want: 'same' },
          { name: 'the small lines and the stop line gone', got: `${H.alpha(S.doc[0]).toFixed(2)} ${H.alpha(S.stop[0].el).toFixed(2)}`, want: '0.00 0.00' },
          { name: 'clear of the frame\'s labels ("Nothing listens" at screen x 928, foot)', got: Math.min(...r.map((x) => x.top)) - inkOf(S.nothing.el).bottom, want: '>= 12 (or left of 928)', pass: Math.min(...r.map((x) => x.top)) - inkOf(S.nothing.el).bottom >= 12 || Math.max(...r.map((x) => x.right)) < 916 },
          { name: 'clear of the answers (x 1000)', got: 1000 - Math.max(...r.map((x) => x.right)), want: '>= 12', pass: 1000 - Math.max(...r.map((x) => x.right)) >= 12 }, ...common())
      }
      if (t === T.u1 || t === T.u2) {
        const U = S.ULS[t === T.u1 ? 0 : 1]
        out.push({ name: `12h: "${t === T.u1 ? 'see a doctor' : 'get help straight away'}" underlined (segments)`, got: U.segs.map((s) => `${s.x0.toFixed(1)}-${s.x1.toFixed(1)} @${s.y}`).join('; '), want: 'under its words', pass: U.segs.length > 0 && U.rects.every((r, i) => Math.abs(+r.getAttribute('width') - (U.segs[i].x1 - U.segs[i].x0)) < 0.5) })
      }
      if (t === T.end) out.push({ name: '12h: every mark of the turn gone but the band and Merc\'s line', got: visTexts(0.01).join(', ') || 'none', want: 'none', pass: !visTexts(0.01).length })
      if (t === T.last) {
        const b = R(bandEl()), m = R(S.ch.merc.path)
        out.push({ name: 'last frame (HANDOFFS § S12 to S13): the band x 928 to 1824, y 104 to 202', got: fmt(b), want: '928 to 1824, 104 to 202', pass: Math.abs(b.left - 928) < 0.6 && Math.abs(b.right - 1824) < 0.6 && Math.abs(b.top - 104) < 0.6 && Math.abs(b.bottom - 202) < 0.6 },
          { name: 'Merc\'s line y 153, 5.6 px on screen (L.RECAP.mercW(0))', got: `${((m.top + m.bottom) / 2).toFixed(2)}, ${(+S.ch.merc.path.getAttribute('stroke-width') * S.cam.scale(t, 'mid')).toFixed(2)}`, want: `153, ${L.RECAP.mercW(0).toFixed(2)}`, pass: Math.abs((m.top + m.bottom) / 2 - 153) < 0.6 && Math.abs(+S.ch.merc.path.getAttribute('stroke-width') * S.cam.scale(t, 'mid') - L.RECAP.mercW(0)) < 0.01 },
          { name: 'no labels', got: visTexts(0.01).join(', ') || 'none', want: 'none', pass: !visTexts(0.01).length })
      }
      return out
    },
  }
})()
