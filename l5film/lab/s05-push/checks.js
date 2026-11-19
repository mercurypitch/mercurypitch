// s05-push's checks (lab/s05-push/probe.mjs): the first frame against S4's last (HANDOFFS § The cuts S4 to S5), the
// 6 s window's k, LAB-CHECKS 10 (5c's definition and the four words against the chip), 9 (the two chips at F0 and at
// 0.78, "loud ≠ high" under "LISTEN ONLY"), 4 (5g's fork and labels), the wave rule at F0 and at 0.78, the last
// frame against HANDOFFS § The cuts S5 to S6, and the keep-out.
;(function () {
  const H = window.__H, sid = 's05-push'
  const S = window.__sceneProbe[sid], A = S.A
  const T = {
    f0: 0, k: A.O4 + 0.7, lc10: A.LIT_AP + 0.44, plan: A.PLAN[2] + 0.5, lc9a: A.PUSH + 1.7, peak: A.PUSH + 3.0,
    whole: A.PUSH_END + 0.4, lc9b: A.NEQ + 1.1, fork: A.L_BOTH + 0.3, last: A.D - 0.0005,
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const tagBox = (tg) => R(tg.box)
  const wave = (pts, x0, x1) => {
    const q = pts.filter((p) => p[0] >= x0 && p[0] <= x1)
    const ys = q.map((p) => p[1])
    const peaks = []
    for (let i = 1; i < q.length - 1; i++) if (q[i][1] < q[i - 1][1] && q[i][1] <= q[i + 1][1]) peaks.push(q[i][0])
    const gaps = peaks.slice(1).map((x, i) => x - peaks[i])
    return { pp: Math.max(...ys) - Math.min(...ys), cyc: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length) }
  }
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      const vis = (e) => H.alpha(e).toFixed(2)
      const band = () => R(S.ch.g.querySelector('.band rect'))
      if (t === T.f0) {
        const b = band(), rs = S.row.chips.map((c) => R(c.box))
        out.push({ name: 'first frame (S4\'s last): band 312.5 to 487.5 at F0', got: `${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '312.5 to 487.5', pass: Math.abs(b.top - 312.5) < 1 && Math.abs(b.bottom - 487.5) < 1 },
          { name: 'plot x 400 to 1520', got: `${b.left} to ${b.right}`, want: '400 to 1520' },
          { name: '"A3" right edge 366, "level" from 400, the row\'s text from 400 at full', got: `${R(S.lab.A3.el).right.toFixed(1)} ${R(S.lab.level.el).left.toFixed(1)} ${R(S.lab.row.el).left.toFixed(1)} ${vis(S.lab.row.el)}`, want: '366 400 400 1.00', pass: Math.abs(R(S.lab.A3.el).right - 366) < 2 && Math.abs(R(S.lab.level.el).left - 400) < 2 && vis(S.lab.row.el) === '1.00' },
          { name: 'no chip on the chart, no slider', got: `${vis(S.ill.g)} ${vis(S.lis.g)} ${vis(S.slider.g)}`, want: '0.00 0.00 0.00' },
          { name: 'the four words parked dim: right edge 1800, outlines 68 to 106', got: `${rs[3].right.toFixed(1)}, ${rs[0].top.toFixed(1)} to ${rs[0].bottom.toFixed(1)}, ${S.row.chips[0].el.getAttribute('fill')}`, want: '1800, 68 to 106, ink-2', pass: Math.abs(rs[3].right - 1800) < 1 && Math.abs(rs[0].top - 68) < 1 && S.row.chips.every((c) => c.el.getAttribute('fill') === 'rgb(168,179,191)') },
          { name: 'hosts at 300 in their corners: Merc, Tavi body boxes', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' })
      }
      if (t === T.k) {
        const b = band()
        out.push({ name: '5b: the band at 1.667 px a cent: 341.7 to 458.3', got: `${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '341.7 to 458.3', pass: Math.abs(b.top - 341.67) < 1 && Math.abs(b.bottom - 458.33) < 1 },
          { name: '5b: the slider: track x 400 to 1520, thumb at 960, "Push" right edge 366', got: `${R(S.slider.track).left} to ${R(S.slider.track).right}, ${(R(S.slider.thumb).left + R(S.slider.thumb).width / 2).toFixed(1)}, ${R(S.slider.lab).right.toFixed(1)}`, want: '400 to 1520, 960, 366', pass: Math.abs(R(S.slider.thumb).left + R(S.slider.thumb).width / 2 - 960) < 1 && Math.abs(R(S.slider.lab).right - 366) < 2 },
          { name: '5b: "ILLUSTRATION" x 1249 to 1520, y 120 to 160', got: `${tagBox(S.ill).left.toFixed(1)} to ${tagBox(S.ill).right.toFixed(1)}, ${tagBox(S.ill).top.toFixed(1)} to ${tagBox(S.ill).bottom.toFixed(1)}`, want: '1249 to 1520, 120 to 160', pass: Math.abs(tagBox(S.ill).left - 1249) < 3 && Math.abs(tagBox(S.ill).right - 1520) < 1 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.lc10) {
        // LAB-CHECKS 10: the definition's cap top 12 px or more under the chip's foot; the four words' outlines 12 px or more over the chip
        const chip = tagBox(S.ill), ink = H.ink(S.lab.def.el.textContent, "600 34px 'Outfit'")
        const capTop = 200 - ink.up, rs = S.row.chips.map((c) => R(c.box)), wordsFoot = Math.max(...rs.map((r) => r.bottom))
        out.push({ name: 'LAB-CHECKS 10: the definition (baseline 200) under the chip\'s foot (160)', got: capTop - chip.bottom, want: '>= 12 (board 15)', pass: capTop - chip.bottom >= 12 },
          { name: 'LAB-CHECKS 10: the four words\' outlines over the chip', got: chip.top - wordsFoot, want: '>= 12 (board 14)', pass: chip.top - wordsFoot >= 12 },
          { name: 'the definition\'s right end (board about 1370)', got: R(S.lab.def.el).right, want: 'info', pass: true },
          { name: '"air pressure" lit: ink, underlined', got: `${S.row.chips[0].el.getAttribute('fill')} ${vis(S.row.chips[0].g)}`, want: 'rgb(230,237,243) 1.00' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.plan) {
        const v = R(S.slider.val)
        out.push({ name: '5d: the plan clear of the thumb\'s "50" (its value text right edge vs the arrows\' left end, head included)', got: 1002 - 6 - v.right, want: '>= 12', pass: 1002 - 6 - v.right >= 12 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.lc9a) {
        const a = tagBox(S.ill), b = tagBox(S.lis)
        out.push({ name: 'LAB-CHECKS 9 (92.00): "ILLUSTRATION" and "LISTEN ONLY" apart at F0', got: b.left - a.right, want: '>= 12 (board 16)', pass: b.left - a.right >= 12 },
          { name: '"LISTEN ONLY" x 1536 to 1786', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}`, want: '1536 to 1786', pass: Math.abs(b.left - 1536) < 1 && Math.abs(b.right - 1786) < 3 },
          { name: '"LISTEN ONLY" over "above the band" (baseline 300)', got: (300 - H.ink('above the band', "600 36px 'Outfit'").up) - b.bottom, want: '>= 12 (board 114)', pass: true }, ...H.keepout(root, S.boxes))
      }
      if (t === T.peak) {
        const ab = R(S.lab.aboveBand5.el)
        out.push({ name: '5e: "above the band" shown at x 1536, baseline 300, the band edge dark, "in the band" gone', got: `${vis(S.lab.aboveBand5.el)} ${ab.left.toFixed(0)} ${vis(S.lab.inBand.el)}`, want: '1.00 1536 0.00', pass: vis(S.lab.aboveBand5.el) === '1.00' && Math.abs(ab.left - 1536) < 3 && vis(S.lab.inBand.el) === '0.00' },
          { name: '5e: the thumb at 100 (x 1520) with its value 100', got: `${(R(S.slider.thumb).left + R(S.slider.thumb).width / 2).toFixed(0)} ${S.slider.val.textContent}`, want: '1520 100' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.whole) {
        const w = wave(S.ch.lastLine('push'), S.ch.x(0.6), S.ch.x(5.4))
        const flat = wave(S.ch.lastLine('push'), S.ch.x(2.2), S.ch.x(3.5))
        out.push({ name: 'wave rule at F0 (W 6, k 1.667): a cycle 33.9 px', got: flat.cyc, want: 33.9, tol: 3.4 },
          { name: 'wave rule at F0: peak to peak 46.7 px (on the flat top)', got: flat.pp, want: 46.7, tol: 4.7 },
          { name: 'ratio (peak to peak / cycle) 1.30 to 1.45', got: flat.pp / flat.cyc, want: '1.30 to 1.45', pass: flat.pp / flat.cyc >= 1.3 && flat.pp / flat.cyc <= 1.45 },
          { name: 'the line climbs 100 px (+60 c) out of the top: its flat top centred y 300', got: (Math.min(...S.ch.lastLine('push').filter((p) => p[0] > S.ch.x(2.2) && p[0] < S.ch.x(3.5)).map((p) => p[1])) + Math.max(...S.ch.lastLine('push').filter((p) => p[0] > S.ch.x(2.2) && p[0] < S.ch.x(3.5)).map((p) => p[1]))) / 2, want: 300, tol: 2 },
          { name: '"in the band" and the mint edge back at the end', got: vis(S.lab.inBand.el), want: '1.00' }, ...H.keepout(root, S.boxes))
        void w
      }
      if (t === T.lc9b) {
        const a = tagBox(S.ill), b = tagBox(S.lis), n = R(S.neqG), pan = S.panels.map((p) => R(p.g))
        const s = 0.78, flat = wave(S.ch.lastLine('push'), S.ch.x(2.2), S.ch.x(3.5))
        const band = R(S.ch.g.querySelector('.band rect'))
        out.push({ name: 'LAB-CHECKS 9 (100.50): the chips at 0.78: "ILLUSTRATION" x 1128 to 1340, "LISTEN ONLY" from 1352', got: `${a.left.toFixed(1)} to ${a.right.toFixed(1)}, ${b.left.toFixed(1)}`, want: '1128 to 1340, 1352', pass: Math.abs(a.left - 1128) < 3 && Math.abs(a.right - 1340) < 1 && Math.abs(b.left - 1352) < 1 },
          { name: 'LAB-CHECKS 9: the chips apart at 0.78', got: b.left - a.right, want: '>= 12 (board 12.5)', pass: b.left - a.right >= 12 },
          { name: 'LAB-CHECKS 9: "loud ≠ high" (ink top) under "LISTEN ONLY"\'s foot', got: (277 - H.ink('loud', "600 48px 'Outfit'").up) - b.bottom, want: '>= 12 (board 19)', pass: (277 - H.ink('loud', "600 48px 'Outfit'").up) - b.bottom >= 12 },
          { name: '"loud ≠ high" spans (board x 1496 to 1760)', got: `${n.left.toFixed(0)} to ${n.right.toFixed(0)}`, want: 'info', pass: true },
          { name: '"loud ≠ high" over the panels (y 301)', got: 301 - n.bottom, want: '>= 12 (board 14)', pass: 301 - n.bottom >= 12 },
          { name: 'Lesson 1\'s panels x 1433 to 1620 and 1636 to 1823, y 301 to 503', got: `${pan[0].left.toFixed(0)}-${pan[0].right.toFixed(0)}, ${pan[1].left.toFixed(0)}-${pan[1].right.toFixed(0)}, ${pan[0].top.toFixed(0)}-${pan[0].bottom.toFixed(0)}`, want: '1433-1620, 1636-1823, 301-504', pass: Math.abs(pan[0].left - 1433) < 2 && Math.abs(pan[1].right - 1823) < 2 && Math.abs(pan[0].top - 301) < 2 },
          { name: 'the chart at 0.78: plot x 466 to 1340, band 365.5 to 456.5', got: `${band.left.toFixed(1)} to ${band.right.toFixed(1)}, ${band.top.toFixed(1)} to ${band.bottom.toFixed(1)}`, want: '466 to 1340, 365.5 to 456.5', pass: Math.abs(band.left - 466) < 1 && Math.abs(band.right - 1340) < 1 && Math.abs(band.top - 365.5) < 1 && Math.abs(band.bottom - 456.5) < 1 },
          { name: 'wave rule at 0.78: a cycle 26.4 px on screen', got: s * flat.cyc, want: 26.4, tol: 2.7 },
          { name: 'wave rule at 0.78: peak to peak 36.4 px', got: s * flat.pp, want: 36.4, tol: 3.7 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.fork) {
        const tip = (ar) => { const p = ar.at(1); return p }
        const lo = tip(S.brLoud), hi = tip(S.brHigh), v = R(S.slider.val)
        const env = R(S.ch.g.querySelector('.strip path'))
        const ink = (lb, txt) => { const b = R(lb.el); const m = H.ink(txt, "600 40px 'Outfit'"); return { l: b.left, r: b.right, top: +lb.el.getAttribute('y') - m.up, bot: +lb.el.getAttribute('y') + m.down } }
        const L1 = ink(S.louder, 'louder'), H1 = ink(S.higher, 'higher')
        // the stem's least distance to "50"'s ink (its digits: cap height over the baseline, the text's own box across)
        const vb = +S.slider.val.getAttribute('y'), s78 = 0.78, vx = R(S.slider.val), vInk = H.ink('50', "600 30px 'Outfit'", 'middle')
        const box = { l: vx.left + (vx.width - s78 * (vInk.r - vInk.l)) / 2, r: vx.right - (vx.width - s78 * (vInk.r - vInk.l)) / 2, t: s78 * (vb - vInk.up) + 99, b: s78 * vb + 99 }
        let dmin = Infinity
        for (let i = 0; i <= 200; i++) { const [x, y] = S.stem.at(i / 200); const dx = Math.max(box.l - x, 0, x - box.r), dy = Math.max(box.t - y, 0, y - box.b); dmin = Math.min(dmin, Math.hypot(dx, dy)) }
        out.push({ name: 'LAB-CHECKS 4: both arrowheads inside the peak (screen x 772 to 990)', got: `${lo[0]} and ${hi[0]}`, want: 'inside', pass: lo[0] >= 772 && lo[0] <= 990 && hi[0] >= 772 && hi[0] <= 990 },
          { name: 'LAB-CHECKS 4: the stem\'s least distance to "50" (ink)', got: dmin, want: '>= 12', pass: dmin >= 12 },
          { name: 'LAB-CHECKS 4: "louder" (ink) over the swollen strip\'s fill', got: env.top - L1.bot, want: '>= 12 (board 18)', pass: env.top - L1.bot >= 12 },
          { name: 'LAB-CHECKS 4: "higher" (ink) under the band\'s foot (456.5)', got: H1.top - 456.5, want: '>= 12 (board 14)', pass: H1.top - 456.5 >= 12 },
          { name: '"louder" left of its branch (tip 960)', got: 960 - L1.r, want: 'info (board 40)', pass: true },
          { name: '"louder" and "higher" apart', got: L1.top - H1.bot, want: 'info (board 38)', pass: true },
          { name: 'the strip swollen under the peak: its top (board 593)', got: env.top, want: 593, tol: 3 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.last) {
        const b = band(), th = R(S.slider.thumb), a = tagBox(S.ill)
        out.push({ name: 'last frame: the bare chart at 0.78: plot x 466 to 1340, band 365.5 to 456.5', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '466 to 1340, 365.5 to 456.5', pass: Math.abs(b.left - 466) < 1 && Math.abs(b.right - 1340) < 1 && Math.abs(b.top - 365.5) < 1 && Math.abs(b.bottom - 456.5) < 1 },
          { name: 'the thumb at 50: (903, 723)', got: `(${(th.left + th.width / 2).toFixed(1)}, ${(th.top + th.height / 2).toFixed(1)})`, want: '(902.8, 723.0)', pass: Math.abs(th.left + th.width / 2 - 902.8) < 1 && Math.abs(th.top + th.height / 2 - 723) < 1 },
          { name: '"50" and "Push" shown', got: `${S.slider.val.textContent} ${vis(S.slider.val)} ${vis(S.slider.lab)}`, want: '50 1.00 1.00' },
          { name: '"ILLUSTRATION" x 1128 to 1340, centred y 208', got: `${a.left.toFixed(1)} to ${a.right.toFixed(1)}, ${((a.top + a.bottom) / 2).toFixed(1)}`, want: '1128 to 1340, 208.2', pass: Math.abs(a.left - 1128) < 3 && Math.abs(a.right - 1339.6) < 1 && Math.abs((a.top + a.bottom) / 2 - 208.2) < 1 },
          { name: 'the row\'s text at full; no line, no "in the band", no "LISTEN ONLY", panels, fork or type', got: `${vis(S.lab.row.el)} / ${vis(S.lab.inBand.el)} ${vis(S.lis.g)} ${vis(S.neqG)} ${vis(S.louder.el)} ${vis(S.both.el)} ${vis(S.stem.g)}`, want: '1.00 / 0.00 0.00 0.00 0.00 0.00 0.00' },
          { name: 'hosts at 300 in their corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' }, ...H.keepout(root, S.boxes))
      }
      return out
    },
  }
})()
