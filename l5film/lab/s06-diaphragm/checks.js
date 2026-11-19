// s06-diaphragm's checks (lab/s05-push/probe.mjs): the first frame against S5's last, the card's width, the chip's glide
// (LAB-CHECKS 11), the split's curves against the chip and the figure as it draws (the provisional curves, settled
// here), the small band and the figure's places, the opening (the frame's top behind the chip), the gauge's labels in
// stages, F-gauge, LAB-CHECKS 5 (6i), 8 (6k, Quiet and Loud), the last frame against HANDOFFS § The cuts S6 to S7, and
// the keep-out.
;(function () {
  const H = window.__H, sid = 's06-diaphragm'
  const S = window.__sceneProbe[sid], A = S.A
  const su = (u) => A.SPLIT + u * A.SPLIT_D
  const T = {
    f0: 0, card: A.ACT + 1.2, glided: A.GLIDE + A.GLIDE_D + 0.1,
    s10: su(0.1), s20: su(0.2), s25: su(0.25), s30: su(0.3), s35: su(0.35), s40: su(0.4), s45: su(0.45), s50: su(0.5), s55: su(0.55), s60: su(0.6), s65: su(0.65), s70: su(0.7), s80: su(0.8), s90: su(0.9),
    split: A.SPLIT + A.SPLIT_D + 0.05, guess: A.GUESS + 0.5, dia: A.DIA + 0.6, bin: A.BIN + 0.4, pills: A.PILL2 + 0.5,
    open1: A.OPEN + 1.02 * A.OPEN_D / 1.4, open2: A.OPEN + 1.23 * A.OPEN_D / 1.4, opened: A.OPEN + A.OPEN_D + 0.05,
    stage: A.CHECK + 0.4, preAdd: A.CROSS1 + 0.3, midSwap: A.CROSS1 + 0.12, cross: A.ADDED + 0.35, plates45: A.WALK + 2.33, fgauge: A.GAUGE + A.GAUGE_D + 0.05, bm: A.NEVER + 0.5, cant: A.STRIKE + 0.5,
    quiet: A.YES + 0.6, loud: A.MORE + 0.6, last: A.D - 0.0005,
  }
  // [B-01: 183] every frame of every swap (30 fps from the switch, 0.3 s): the cursor behind the readout's plate or
  // clear of the words still drawn
  const SWT = new Set()
  ;(S.SWITCHES || []).forEach((s, i) => { for (let k = 0; k <= 9; k++) { const tt = s.t + k / 30; T[`sw${i}_${k}`] = tt; SWT.add(tt) } })
  // DECISIONS 203 (the rule of 188): the type under the figure keeps 12 px or more from the floor horizon on every frame
  // it shows; sampled every 0.25 s from "with your breathing muscles," to "belly and rib muscles"'s exit
  const HZ = new Set()
  for (let tt = A.BM; tt <= A.O7 + 0.35; tt += 0.25) { T['hz' + tt.toFixed(2)] = tt; HZ.add(tt) }
  const UNDER = [['muscles', 766, 'with your breathing muscles,'], ['throat', 804, 'never your throat'], ['bellyRib', 800, 'belly and rib muscles']]
  const hzSeen = {}
  // [F-01: 228, 227] the named labels' settles: at each peak (0.15 s after its word) the label's scale, no plate on a
  // stroke, and the line under the figure clear of the legs and of "one 10-second note"
  const PK = new Map()
  for (const [n, ts] of Object.entries(S.NAMED || {})) for (const t0 of ts) { const tt = t0 + 0.15; T['pk_' + n + '_' + tt.toFixed(2)] = tt; PK.set(tt, n) }
  const scaleOf = (el) => { const g = el.parentNode && el.parentNode.getAttribute('class') === 'label-back' ? el.parentNode : el; const m = /scale\(([\d.]+)\)/.exec(g.getAttribute('transform') || ''); return m ? +m[1] : 1 }
  // a label's fade offset from its transform, the settle's scale translates left out
  const dyFade = (el) => {
    const tr = el.getAttribute('transform') || '', ts = [...tr.matchAll(/translate\(\s*([-\d.]+)[ ,]+([-\d.]+)\)/g)]
    return !ts.length || (/scale\(/.test(tr) && ts.length < 3) ? 0 : +ts[0][2]
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const vis = (e) => H.alpha(e).toFixed(2)
  // the drawn part of the figure's outline, sampled on screen (the legs' masked part left out); with the fill up
  // (draw over 0.55) the whole outline counts
  const drawnOutline = () => {
    const paths = [...S.fig.g.querySelectorAll('path[pathLength="1"][stroke-dasharray="1 1"]')].slice(-2)
    const pts = []
    for (const p of paths) {
      const off = +p.getAttribute('stroke-dashoffset'), dr = 1 - off
      if (dr <= 0.001) continue
      const whole = dr > 0.55 ? 1 : dr
      const L0 = p.getTotalLength(), M = p.getScreenCTM()
      for (let i = 0; i <= 400; i++) {
        const q = p.getPointAtLength((L0 * whole * i) / 400)
        const X = M.a * q.x + M.c * q.y + M.e, Y = M.b * q.x + M.d * q.y + M.f
        if (Y < 745) pts.push([X, Y])
      }
    }
    return pts
  }
  const distTo = (pts, r) => {
    let d = Infinity
    for (const [x, y] of pts) d = Math.min(d, Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom)))
    return d
  }
  const gaugeKids = () => S.ga.g.children
  const bandRect = () => R(gaugeKids()[1].querySelector('rect'))
  const frameRect = () => R(gaugeKids()[3].querySelector(':scope > rect:not([fill^="url"])'))
  const frameEl = () => [...gaugeKids()[3].querySelectorAll(':scope > rect')].find((r) => r.getAttribute('fill') === 'none')
  const inkBox = (lb, font, txt) => {
    const b = R(lb.el), m = H.ink(txt || lb.el.textContent, font)
    const s = b.height / (m.up + m.down + 0.0001) > 0 ? 1 : 1
    void s
    return b
  }
  void inkBox
  // [B-01: 182] each shown label's plate against the strokes it could cover, in world px (the plate mapped back
  // through the camera): the band's lower edge, the frame's strokes, the gold line, the lungs' line, the up arrow
  const plates = (t) => {
    const out = []
    const sh = S.ga.g.children[3], gold = sh.children[6]
    const gy = +gold.getAttribute('y') + 1.5, gw = +gold.getAttribute('width') || 0, ga = +gold.getAttribute('opacity')
    const drawnT = 10
    const strokes = [
      { n: 'band edge', x0: 760, x1: 1640, y0: 239, y1: 241 },
      { n: 'frame top', x0: 760, x1: 1640, y0: 289, y1: 291 },
      { n: 'frame right', x0: 1639, x1: 1641, y0: 290, y1: 720 },
      { n: 'frame left', x0: 759, x1: 761, y0: 290, y1: 720 },
      { n: 'up arrow', x0: 763, x1: 773, y0: 252, y1: 277 },
    ]
    if (ga > 0 && gw > 0) strokes.push({ n: 'gold line', x0: 760, x1: 760 + gw, y0: gy - 1.5, y1: gy + 1.5 })
    const items = ['pushOfAir', 'lungsPush', 'needs', 'heldBack', 'added', 'readout', 'readoutAdding'].map((n) => ({ n, el: S.gl[n].el, back: S.gl[n].back }))
    items.push({ n: 'the readout\'s own plate', el: S.roPlate, back: S.roPlate })
    for (const { n, el, back } of items) {
      if (!back || H.alpha(el) < 0.5) continue
      const r = R(back), [ax, ay] = S.cam.inv(r.left, r.top, t), [bx, by] = S.cam.inv(r.right, r.bottom, t)
      const cov = []
      for (const k of strokes) {
        const ox = Math.min(bx, k.x1) - Math.max(ax, k.x0), oy = Math.min(by, k.y1) - Math.max(ay, k.y0)
        if (ox > 0 && oy > 0) cov.push(`${k.n} ${ox.toFixed(0)} px`)
      }
      // the lungs' line (3 px) under the plate
      let lc = 0
      for (let x = Math.max(ax, 760); x <= Math.min(bx, 760 + 88 * drawnT); x += 1) { const y = L.GAUGE.lungs((x - 760) / 88); if (y + 1.5 > ay && y - 1.5 < by) lc++ }
      if (lc) cov.push(`lungs' line ${lc} px`)
      const gc = ga > 0 && gw > 0 ? Math.min(ay - (gy + 1.5), (gy - 1.5) - by) : null
      out.push({ name: `[B-01: 182] the plate of ${n} (world ${ax.toFixed(1)} to ${bx.toFixed(1)}, ${ay.toFixed(1)} to ${by.toFixed(1)}) covers no stroke`, got: cov.length ? cov.join('; ') : 'none', want: 'none', pass: !cov.length })
      if (n === 'needs' && gc != null) out.push({ name: '[B-01: 182] "what the note needs": its plate under the gold line', got: +(ay - (gy + 1.5)).toFixed(1), want: '>= 4', pass: ay - (gy + 1.5) >= 4 })
    }
    return out
  }
  // [B-01: 183] the readout's swaps: frames (30 fps, the clip's grid) where both wordings show
  const swaps = () => {
    const out = []
    let both = 0
    const list = []
    for (let f = Math.floor(A.READOUT * 30); f <= Math.ceil(A.CUR_OUT * 30); f++) {
      const r = S.readoutAt(f / 30)
      if (r.hold.a > 0.02 && r.add.a > 0.02) { both++; list.push((f / 30).toFixed(3)) }
    }
    out.push({ name: '[B-01: 183] the readout: frames with both wordings shown (every switch)', got: both ? list.join(' ') : 0, want: 0, pass: both === 0 })
    return out
  }
  // the lowest visible point of the figure's outline on screen (the legs' fade applied) against a label's ink top
  const legsLow = (t) => {
    const paths = [...S.fig.g.querySelectorAll('path[pathLength="1"][stroke-dasharray="1 1"]')].slice(-2)
    const [f0, fe] = S.F6.fade
    const yEnd = S.cam.map(0, fe, t)[1], yStart = S.cam.map(0, f0, t)[1]
    let low = -1
    for (const p of paths) {
      const L0 = p.getTotalLength(), M = p.getScreenCTM()
      for (let i = 0; i <= 600; i++) {
        const q = p.getPointAtLength((L0 * i) / 600), Y = M.b * q.x + M.d * q.y + M.f
        const a = Y <= yStart ? 1 : 1 - (Y - yStart) / (yEnd - yStart)
        if (a >= 0.1) low = Math.max(low, Y)
      }
    }
    return low
  }
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      const m = (x, y) => S.cam.map(x, y, t)
      if (t === T.f0) {
        const b = R(S.ch.g.querySelector('.band rect')), th = R(S.slider.thumb), a = R(S.tag.box)
        out.push({ name: 'first frame (S5\'s last): the bare chart at 0.78: plot x 466 to 1340, band 365.5 to 456.5', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '466.0 to 1339.6, 365.5 to 456.5', pass: Math.abs(b.left - 466) < 1 && Math.abs(b.right - 1339.6) < 1 && Math.abs(b.top - 365.5) < 1 && Math.abs(b.bottom - 456.5) < 1 },
          { name: 'the thumb at 50: (902.8, 723.0)', got: `(${(th.left + th.width / 2).toFixed(1)}, ${(th.top + th.height / 2).toFixed(1)})`, want: '(902.8, 723.0)' },
          { name: '"ILLUSTRATION" x 1128.5 to 1339.6, centred y 208.2 (S5\'s last frame)', got: `${a.left.toFixed(1)} to ${a.right.toFixed(1)}, ${((a.top + a.bottom) / 2).toFixed(1)}`, want: '1128.5 to 1339.6, 208.2', pass: Math.abs(a.left - 1128.5) < 1.5 && Math.abs(a.right - 1339.6) < 1.5 && Math.abs((a.top + a.bottom) / 2 - 208.2) < 1 },
          { name: '"A3", "level", the row\'s text, "50" and "Push" at full', got: `${vis(S.lab.A3.el)} ${vis(S.lab.level.el)} ${vis(S.lab.row.el)} ${vis(S.slider.val)} ${vis(S.slider.lab)}`, want: '1.00 1.00 1.00 1.00 1.00' },
          { name: 'hosts at 300 in their corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' })
      }
      if (t === T.card) {
        const cg = S.ga && document.querySelector('#' + sid + '-scene .chapter-card')
        const cb = R(cg)
        out.push({ name: '6a: the card within 1680 px wide', got: cb.width, want: '<= 1680', pass: cb.width <= 1680 },
          { name: '6a: the chart\'s labels and chip hidden while dim', got: `${vis(S.lab.A3.el)} ${vis(S.lab.row.el)} ${vis(S.tag.g)} ${vis(S.slider.val)}`, want: '0.00 0.00 0.00 0.00' })
      }
      if (t === T.glided) {
        const a = R(S.tag.box), b = R(S.ch.g.querySelector('.band rect'))
        out.push({ name: '6b: the chip at the gauge\'s place: x 1359 to 1630, y 300 to 340', got: `${a.left.toFixed(1)} to ${a.right.toFixed(1)}, ${a.top.toFixed(1)} to ${a.bottom.toFixed(1)}`, want: '1359 to 1630, 300 to 340', pass: Math.abs(a.left - 1359) < 3 && Math.abs(a.right - 1630) < 1 && Math.abs(a.top - 300) < 1 && Math.abs(a.bottom - 340) < 1 },
          { name: '6b: the chip right of the plot\'s end (1340)', got: a.left - 1339.6, want: 'board 19', pass: a.left - 1339.6 >= 12 },
          { name: '6b: the chip over the band\'s top at 0.78 (365.5)', got: b.top - a.bottom, want: 'board 25', pass: b.top - a.bottom >= 12 },
          { name: 'hosts shrunk to 240 at (100, 840) and (1820, 840)', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '36.4-163.6; 1756.4-1883.6' }, ...H.keepout(root, S.boxes))
      }
      const splitTimes = [T.s10, T.s20, T.s25, T.s30, T.s35, T.s40, T.s45, T.s50, T.s55, T.s60, T.s65, T.s70, T.s80, T.s90]
      if (splitTimes.includes(t)) {
        const u = (t - A.SPLIT) / A.SPLIT_D
        const b = bandRect(), chip = R(S.tag.box), a3 = R(S.a3), pts = drawnOutline()
        const past = b.right > 1347
        out.push({ name: `split u ${u.toFixed(2)}: band x ${b.left.toFixed(0)} to ${b.right.toFixed(0)}, y ${b.top.toFixed(0)} to ${b.bottom.toFixed(0)}; the figure drawn ${(1 - +[...S.fig.g.querySelectorAll('path[pathLength="1"][stroke-dasharray="1 1"]')].slice(-1)[0].getAttribute('stroke-dashoffset')).toFixed(2)}`, got: 'info', pass: true },
          { name: `split u ${u.toFixed(2)}: the band\'s foot over the chip once its right end passes 1347`, got: past ? chip.top - b.bottom : 'not past', want: '>= 12', pass: !past || chip.top - b.bottom >= 12 },
          { name: `split u ${u.toFixed(2)}: the band clear of the drawn figure`, got: pts.length ? distTo(pts, b) : 'not drawn', want: '>= 12', pass: !pts.length || distTo(pts, b) >= 12 },
          { name: `split u ${u.toFixed(2)}: "A3" clear of the drawn figure`, got: pts.length ? distTo(pts, a3) : 'not drawn', want: '>= 12', pass: !pts.length || distTo(pts, a3) >= 12 })
      }
      if (t === T.split) {
        const b = bandRect(), a3 = R(S.a3), k = R(S.kicker.el)
        const strip = R(gaugeKids()[2].querySelector('rect'))
        out.push({ name: 'the small band x 760 to 1640, y 160 to 240', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '760 to 1640, 160 to 240', pass: Math.abs(b.left - 760) < 1 && Math.abs(b.right - 1640) < 1 && Math.abs(b.top - 160) < 1 && Math.abs(b.bottom - 240) < 1 },
          { name: '"A3" right-aligned 740, baseline 212', got: `${a3.right.toFixed(1)}, ${S.a3.getAttribute('transform')}`, want: '740', pass: Math.abs(a3.right - 740) < 2 },
          { name: 'the strip at the gauge\'s floor: x 760 to 1640, y 690', got: `${strip.left.toFixed(1)} to ${strip.right.toFixed(1)}, ${(strip.top + strip.height / 2).toFixed(1)}`, want: '760 to 1640, 690', pass: Math.abs(strip.left - 760) < 1 && Math.abs(strip.right - 1640) < 1 && Math.abs(strip.top + strip.height / 2 - 690) < 1 },
          { name: 'the figure\'s head y 143 to 293 (crown, chin)', got: S.fig.at('crown')[1], want: 143, tol: 1 },
          { name: 'the head 33 px under the kicker\'s baseline (110)', got: S.fig.at('crown')[1] - 110, want: 33, tol: 1 },
          { name: 'the kicker spans (board to about x 730)', got: `${k.left.toFixed(0)} to ${k.right.toFixed(0)}`, want: 'info', pass: true }, ...H.keepout(root, S.boxes))
      }
      if (t === T.guess) {
        const q = R(S.guess.qEl)
        out.push({ name: '6b: the guess\'s "?" right of the chest (x 600, baseline 470)', got: q.left, want: 600, tol: 3 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.dia) {
        const rs = S.row.chips.map((c) => R(c.box)), d = R(S.fl.dia.el)
        out.push({ name: '6c: the four words back, "air pressure" and "diaphragm" lit', got: S.row.chips.map((c) => c.el.getAttribute('fill') === 'rgb(230,237,243)' ? 'lit' : 'dim').join(' '), want: 'lit lit dim dim' },
          { name: '6c: the row\'s right edge 1800, outlines 68 to 106', got: `${rs[3].right.toFixed(1)}, ${rs[0].top.toFixed(1)} to ${rs[0].bottom.toFixed(1)}`, want: '1800, 68 to 106', pass: Math.abs(rs[3].right - 1800) < 1 },
          { name: '6c: "diaphragm" right-aligned 350, baseline 640', got: d.right, want: 350, tol: 2 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.bin) {
        const bi = R(S.fl.breathingIn.el), be = R(S.fl.belly.el), di = R(S.fl.dia.el)
        out.push({ name: '6c: "breathing in" over "diaphragm"', got: di.top - bi.bottom, want: '>= 4 (font boxes)', pass: di.top - bi.bottom >= 4 },
          { name: '6c: "belly" right of the belly wall at full breath', got: be.left - S.fig.at('belly')[0], want: '>= 12', pass: be.left - S.fig.at('belly')[0] >= 12 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.pills) {
        const p0 = R(S.pills[0].box), p1 = R(S.pills[1].box), pk = R(S.predict)
        out.push({ name: '6d: "PREDICT" from x 760, the pills x 920 to 1150 and 1180 to 1420, y 81 to 129', got: `${pk.left.toFixed(0)}; ${p0.left.toFixed(0)}-${p0.right.toFixed(0)}, ${p1.left.toFixed(0)}-${p1.right.toFixed(0)}, ${p0.top.toFixed(0)}-${p0.bottom.toFixed(0)}`, want: '760; 920-1150, 1180-1420, 81-129', pass: Math.abs(p0.left - 920) < 2 && Math.abs(p1.right - 1420) < 2 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.open1 || t === T.open2) {
        const f = frameEl(), chip = R(S.tag.box)
        const above = !!(f.compareDocumentPosition(S.tag.g) & Node.DOCUMENT_POSITION_FOLLOWING)
        out.push({ name: `6e (${t === T.open1 ? 'board 128.97' : 'board 129.18'}): the frame's top edge`, got: R(f).top, want: t === T.open1 ? 'about 340 (the chip\'s foot)' : 'about 300 (the chip\'s top)', pass: true },
          { name: '6e: the chip drawn above the frame\'s stroke', got: above, want: true })
        void chip
      }
      if (t === T.opened) {
        const f = R(frameEl()), chip = R(S.tag.box)
        out.push({ name: '6e: the frame x 760 to 1640, y 290 to 720', got: `${f.left.toFixed(0)} to ${f.right.toFixed(0)}, ${f.top.toFixed(0)} to ${f.bottom.toFixed(0)}`, want: '759 to 1641, 289 to 721', pass: Math.abs(f.top - 289) < 1.5 && Math.abs(f.bottom - 721) < 1.5 },
          { name: '6e: the chip 9 px in from the frame\'s right stroke and 9 px under its top one', got: `${(1640 - 1 - chip.right).toFixed(1)}, ${(chip.top - 291).toFixed(1)}`, want: '9, 9', pass: Math.abs(1639 - chip.right - 9) < 1.5 && Math.abs(chip.top - 291 - 9) < 1.5 },
          { name: '6e: "one 10-second note" and "push of air (not pitch)" shown', got: `${vis(S.gl.oneNote.el)} ${vis(S.gl.pushOfAir.el)}`, want: '1.00 1.00' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.stage) {
        out.push({ name: '6f: "Hold it back" checked, "Push it out" dimmed', got: `${vis(S.check.g)}`, want: '1.00' },
          { name: '6f: the readout says "Now: holding back"', got: `${vis(S.gl.readout.el)} ${vis(S.gl.readoutAdding.el)}`, want: '1.00 0.00' }, ...H.keepout(root, S.boxes))
      }
      if (t === T.cross) {
        const cv = document.createElement('canvas').getContext('2d'); cv.font = "600 30px 'Outfit'"
        const mm = cv.measureText('added'), bx = R(S.gl.added.el), s = S.cam.scale(t)
        // in world px: the label's box mapped back through the camera
        const [wl] = S.cam.inv(bx.left, 0, t), top = 645 - mm.actualBoundingBoxAscent, bot = 645 + mm.actualBoundingBoxDescent
        const lungsAt = (x) => L.GAUGE.lungs((x - 760) / 88)
        out.push({ name: '6f: after the crossing the readout says "Now: adding"', got: `${vis(S.gl.readout.el)} ${vis(S.gl.readoutAdding.el)}`, want: '0.00 1.00' },
          { name: '[B-01: 183] "added" landed 0.45 s after the switch', got: `${vis(S.gl.added.el)}; ${(A.ADDED - A.CROSS1).toFixed(2)} s`, want: '1.00; 0.45 s' },
          { name: '6f: "added" glyphs under the gold line (607.5)', got: top - 607.5, want: '>= 12', pass: top - 607.5 >= 12 },
          { name: '6f: "added" over the lungs\' line at its left end', got: lungsAt(wl) - bot, want: '>= 12', pass: lungsAt(wl) - bot >= 12 },
          { name: 'the push under way: scale', got: s, want: 'info', pass: true }, ...H.keepout(root, S.boxes))
      }
      if (t === T.midSwap) {
        const cur = S.ga.g.children[4], cr = R(cur), pr = R(S.roPlate)
        // the cursor is behind the plate, or clear of every wording still drawn (the plate goes from the old wording's
        // box to the new's, so the cursor at the crossing leaves it as the old words go)
        const cx = (cr.left + cr.right) / 2, inPlate = cx > pr.left && cx < pr.right
        const onWords = [S.gl.readout.el, S.gl.readoutAdding.el].filter((e) => H.alpha(e) > 0.01).some((e) => { const b = R(e); return cx > b.left && cx < b.right })
        out.push({ name: '[B-01: 183] mid-swap (both wordings faint): the readout\'s plate stays, the cursor behind it or clear of the words', got: `plate ${(+S.roPlate.getAttribute('opacity')).toFixed(2)}; wordings ${vis(S.gl.readout.el)} ${vis(S.gl.readoutAdding.el)}; cursor x ${cx.toFixed(0)}, plate ${pr.left.toFixed(0)} to ${pr.right.toFixed(0)}: ${inPlate ? 'behind it' : onWords ? 'ON THE WORDS' : 'clear of the words'}; plate after cursor in the document ${!!(cur.compareDocumentPosition(S.roPlate) & Node.DOCUMENT_POSITION_FOLLOWING)}`, want: 'plate 1.00, behind or clear', pass: +S.roPlate.getAttribute('opacity') > 0.99 && (inPlate || !onWords) && !!(cur.compareDocumentPosition(S.roPlate) & Node.DOCUMENT_POSITION_FOLLOWING) })
      }
      if (SWT.has(t)) {
        const cur = S.ga.g.children[4], cr = R(cur), pr = R(S.roPlate), ca = +cur.getAttribute('opacity')
        const cx = (cr.left + cr.right) / 2, inPlate = cx > pr.left && cx < pr.right && cr.top < pr.bottom && cr.bottom > pr.top
        const drawn = [S.gl.readout.el, S.gl.readoutAdding.el].filter((e) => H.alpha(e) > 0.01)
        const onWords = drawn.some((e) => { const b = R(e); return cx > b.left && cx < b.right })
        const both = drawn.length > 1
        const offPlate = drawn.filter((e) => { const b = R(e); return b.left < pr.left - 0.5 || b.right > pr.right + 0.5 }).map((e) => e.textContent)
        out.push({ name: '[B-01: 183] a swap\'s frame: one wording at a time, on its plate; the cursor behind the plate or clear of the words', got: `${vis(S.gl.readout.el)} ${vis(S.gl.readoutAdding.el)}${offPlate.length ? ' OFF THE PLATE: ' + offPlate.join(', ') : ''}; cursor ${ca.toFixed(2)} x ${cx.toFixed(0)}, plate ${pr.left.toFixed(0)} to ${pr.right.toFixed(0)}: ${ca < 0.01 ? 'no cursor' : inPlate ? 'behind it' : onWords ? 'ON THE WORDS' : 'clear of the words'}`, want: 'one wording, on its plate; behind or clear', pass: !both && !offPlate.length && (ca < 0.01 || inPlate || !onWords) })
      }
      if (t === T.preAdd) out.push({ name: '[B-01: 183] "added" not yet shown 0.3 s after the switch', got: vis(S.gl.added.el), want: '0.00' }, ...swaps())
      if (t === T.stage || t === T.cross || t === T.fgauge || t === T.plates45 || t === T.cant) out.push(...plates(t))
      if (t === T.cross || t === T.plates45) {
        // [B-01: 182] outside a swap the readout's plate is the shown wording's box + 4 px, no wider
        const shown = vis(S.gl.readoutAdding.el) === '1.00' ? S.gl.readoutAdding.el : S.gl.readout.el, wb = R(shown), pb = R(S.roPlate), k = S.cam.scale(t)
        const dl = (wb.left - pb.left) / k, dr = (pb.right - wb.right) / k
        out.push({ name: `[B-01: 182] the readout's plate fits "${shown.textContent}" (world px each side of its box)`, got: `${dl.toFixed(1)} ${dr.toFixed(1)}`, want: '4 4 (+-1)', pass: Math.abs(dl - 4) < 1 && Math.abs(dr - 4) < 1 })
      }
      if (t === T.fgauge) {
        const f = R(frameEl())
        out.push({ name: 'F-gauge: the frame on screen x 738 to 1662, y 279 to 731 (outer stroke edges +-1)', got: `${f.left.toFixed(1)} to ${f.right.toFixed(1)}, ${f.top.toFixed(1)} to ${f.bottom.toFixed(1)}`, want: '737 to 1663, 278 to 732', pass: Math.abs(f.left - 737) < 2 && Math.abs(f.right - 1663) < 2 && Math.abs(f.top - 278) < 2 && Math.abs(f.bottom - 732) < 2 },
          { name: 'F-gauge: the figure\'s head y 125 to 282 (crown)', got: S.cam.map(...S.fig.at('crown'), t)[1], want: 125.4, tol: 1 },
          { name: 'F-gauge: scale 1.05', got: S.cam.scale(t), want: 1.05, tol: 0.001 }, ...H.keepout(root, S.boxes))
      }
      if (PK.has(t)) {
        const n = PK.get(t), lab = S.gl[n] || S.fl[n], sc = scaleOf(lab.el), want = 1 + (n === 'heldBack' ? 0.2 : S.AMP[n])
        out.push({ name: `[F-01: 228, 227] "${lab.el.textContent}" settles on its word: its scale at the peak`, got: +sc.toFixed(3), want: +want.toFixed(3), tol: 0.002 })
        if (n === 'muscles') {
          const k = S.cam.scale(t), im = H.ink('with your breathing muscles,', "600 32px 'Outfit'"), top = m(0, 766)[1] - k * sc * im.up
          const gapR = R(S.gl.oneNote.el).left - R(lab.el).right
          out.push({ name: '[F-01: 227] at the settle\'s peak: the legs\' end over the line\'s ink (188: 12 or more)', got: +(top - legsLow(t)).toFixed(1), want: '>= 12', pass: top - legsLow(t) >= 12 },
            { name: '[F-01: 227] at the settle\'s peak: the line\'s right end to "one 10-second note" (font boxes)', got: +gapR.toFixed(1), want: '>= 12', pass: H.alpha(S.gl.oneNote.el) < 0.01 || gapR >= 12 })
        } else out.push(...plates(t))
      }
      if (HZ.has(t)) {
        const floorTop = R(S.room.floor).top, k = S.cam.scale(t)
        for (const [n, y, text] of UNDER) {
          const el = S.fl[n].el
          if (H.alpha(el) < 0.01) continue
          const ink = H.ink(text, "600 32px 'Outfit'"), base = m(0, y + dyFade(el))[1]
          const gap = floorTop - (base + k * scaleOf(el) * ink.down)
          const h = hzSeen[n] || (hzSeen[n] = { n: 0, min: 1e9, minAt: 0, k0: 1e9, k1: 0, floor: new Set() })
          h.n++; h.k0 = Math.min(h.k0, k); h.k1 = Math.max(h.k1, k); h.floor.add(floorTop.toFixed(1))
          if (gap < h.min) { h.min = gap; h.minAt = t }
          if (gap < 12) out.push({ name: `[DECISIONS 203] "${text}" 12 px or more over the floor horizon`, got: +gap.toFixed(1), want: '>= 12', pass: false })
        }
        if (t === [...HZ].pop()) for (const [n, , text] of UNDER) {
          const h = hzSeen[n]
          out.push({ name: `[DECISIONS 203] "${text}": its ink foot over the floor horizon at every sample it shows (count, least gap and when, camera scale, the floor's top)`, got: h ? `${h.n}, ${h.min.toFixed(1)} px at ${h.minAt.toFixed(2)}, scale ${h.k0.toFixed(3)} to ${h.k1.toFixed(3)}, floor ${[...h.floor].join(' ')}` : 'never shown', want: '>= 12 px', pass: !!h && h.min >= 12 })
        }
      }
      if (t === T.bm) {
        const a = R(S.fl.muscles.el), b = R(S.fl.throat.el), k = S.cam.scale(t), floorTop = R(S.room.floor).top
        const im = H.ink('with your breathing muscles,', "600 32px 'Outfit'"), it = H.ink('never your throat', "600 32px 'Outfit'")
        out.push({ name: '6g: "with your breathing muscles," on screen from x 213', got: a.left, want: 213, tol: 2 },
          { name: '[DECISIONS 203] their world baselines 766 and 804: on screen', got: `${m(0, 766)[1].toFixed(1)}, ${m(0, 804)[1].toFixed(1)}`, want: '779.1, 819.0' },
          { name: '[DECISIONS 203] their ink on screen (top of the first, foot of the second) and the floor horizon', got: `${(m(0, 766)[1] - k * im.up).toFixed(1)} to ${(m(0, 804)[1] + k * it.down).toFixed(1)}; floor ${floorTop.toFixed(1)}`, want: 'info', pass: true },
          { name: '"never your throat" font box foot on screen', got: b.bottom, want: 'info', pass: true },
          { name: '[B-01: 188; DECISIONS 203] the legs\' lowest visible point (alpha 0.1) 20 px or more above "with your breathing muscles," (ink top)', got: +(m(0, 766)[1] - k * im.up - legsLow(t)).toFixed(1), want: '>= 20', pass: m(0, 766)[1] - k * im.up - legsLow(t) >= 20 }, ...H.keepout(root, S.boxes))
      }
      if (t === T.cant) {
        const c = R(S.fl.cant.el), d = R(S.fl.dia.el)
        const mc = H.ink('can’t push air out', "600 30px 'Outfit'", 'end'), md = H.ink('diaphragm', "600 34px 'Outfit'", 'end'), s = S.cam.scale(t)
        const cBot = m(0, 580)[1] + s * mc.down, dTop = m(0, 640)[1] - s * md.up
        out.push({ name: 'LAB-CHECKS 5: "can\'t push air out" starts at or right of screen x 0', got: c.left, want: '>= 0 (board 24)', pass: c.left >= 0 },
          { name: 'LAB-CHECKS 5: 12 px or more over "diaphragm" (ink)', got: dTop - cBot, want: '>= 12', pass: dTop - cBot >= 12 },
          { name: 'the struck arrow and its strike shown', got: `${vis(S.struck.g)} ${vis(S.strike.g)}`, want: '1.00 1.00' }, ...H.keepout(root, S.boxes))
        void d
      }
      if (t === T.quiet || t === T.loud) {
        const q = R(S.quietChip.box), l = R(S.loudChip.box), f = R(frameEl())
        out.push({ name: `LAB-CHECKS 8 (${t === T.quiet ? 'Quiet' : 'Loud'}): "Quiet" and "Loud" from the frame's stroke (screen)`, got: `${(q.left - f.right).toFixed(1)}, ${(l.left - f.right).toFixed(1)}`, want: '>= 12', pass: q.left - f.right >= 12 && l.left - f.right >= 12 },
          { name: 'LAB-CHECKS 8: "Quiet" and "Loud" apart', got: l.top - q.bottom, want: '>= 12', pass: l.top - q.bottom >= 12 },
          { name: 'LAB-CHECKS 8: the chips on screen (board x 1675 to 1783, y 290 to 386)', got: `${q.left.toFixed(0)} to ${Math.max(q.right, l.right).toFixed(0)}, ${q.top.toFixed(0)} to ${l.bottom.toFixed(0)}`, want: 'info', pass: true },
          { name: 'LAB-CHECKS 8: the chips from the "ILLUSTRATION" chip across the stroke', got: q.left - R(S.tag.box).right, want: 'board 22', pass: q.left - R(S.tag.box).right >= 12 },
          { name: `${t === T.quiet ? 'Quiet lit' : 'Loud lit'}`, got: `${S.quietChip.el.getAttribute('fill')} ${S.loudChip.el.getAttribute('fill')}`, want: t === T.quiet ? 'rgb(230,237,243) rgb(168,179,191)' : 'rgb(168,179,191) rgb(230,237,243)' }, ...H.keepout(root, S.boxes))
        if (t === T.loud) {
          const a = R(S.gl.lessHolding.el), b = R(S.gl.moreAdding.el), s = S.cam.scale(t)
          const ia = H.ink(S.gl.lessHolding.el.textContent, "600 30px 'Outfit'"), ib = H.ink(S.gl.moreAdding.el.textContent, "600 30px 'Outfit'", 'end')
          const aR = m(760 + ia.r, 0, t)[0], bL = m(1640 + ib.l, 0, t)[0], aBot = m(0, 765)[1] + s * ia.down, bTop = m(0, 805)[1] - s * ib.up
          const gold = m(0, 454)[1], nl = H.ink('what the note needs', "600 30px 'Outfit'", 'end'), nBot = m(0, 440)[1] + s * nl.down
          out.push({ name: 'LAB-CHECKS 8: "less holding back at first" and "more adding as the air runs low" apart (across, ink)', got: bL - aR, want: '>= 12 (board 25)', pass: bL - aR >= 12 },
            { name: 'LAB-CHECKS 8: ... and in height (the one\'s cap top under the other\'s descenders)', got: bTop - aBot, want: 'board 12', pass: true },
            { name: 'LAB-CHECKS 8: "what the note needs" (Loud) over the gold line (its stroke\'s top, ink)', got: gold - 1.5 * s - nBot, want: '>= 12', pass: gold - 1.5 * s - nBot >= 12 },
            { name: 'LAB-CHECKS 8: the leader at x 900 runs (900, 740) to (900, 430): world', got: `${S.lessLeader.at(0)} to ${S.lessLeader.at(1)}`, want: '900,740 to 900,430' },
            { name: '"less holding back at first" on screen from x 738, baseline 778', got: `${a.left.toFixed(1)}, ${m(0, 765)[1].toFixed(1)}`, want: '738, 778', pass: Math.abs(a.left - 738) < 2 && Math.abs(m(0, 765)[1] - 778) < 1 })
          void b
        }
      }
      if (t === T.last) {
        out.push({ name: '[DECISIONS 203] the legs\' lowest visible point on screen (alpha 0.1), carried by S7\'s first frame', got: +legsLow(t).toFixed(1), want: 'info', pass: true })
        const f = R(frameEl()), chip = R(S.tag.box), q = R(S.quietChip.box), l = R(S.loudChip.box), b = bandRect()
        const nl = R(S.gl.needsLoud.el)
        out.push({ name: 'last frame (F-gauge): the frame x 738 to 1662, y 279 to 731', got: `${f.left.toFixed(1)} to ${f.right.toFixed(1)}, ${f.top.toFixed(1)} to ${f.bottom.toFixed(1)}`, want: '737 to 1663, 278 to 732', pass: Math.abs(f.left - 737) < 2 && Math.abs(f.bottom - 732) < 2 },
          { name: 'the gold line at world 454 (screen 451.45)', got: m(0, 454)[1], want: 451.45, tol: 0.5 },
          { name: 'the chip screen x 1367 to 1652, y 290 to 332', got: `${chip.left.toFixed(1)} to ${chip.right.toFixed(1)}, ${chip.top.toFixed(1)} to ${chip.bottom.toFixed(1)}`, want: '1367 to 1652, 290 to 332', pass: Math.abs(chip.right - 1651.5) < 2 && Math.abs(chip.top - 289.75) < 2 },
          { name: '"Quiet" and "Loud" (Loud lit) screen y 290 to 332 and 344 to 386', got: `${q.left.toFixed(1)}: ${q.top.toFixed(1)} to ${q.bottom.toFixed(1)}, ${l.top.toFixed(1)} to ${l.bottom.toFixed(1)}`, want: 'info (HANDOFFS 290-332, 344-386 for 40 px outlines)', pass: true },
          { name: '"what the note needs" (Loud) screen right edge 1652, baseline 437', got: `${nl.right.toFixed(1)}, ${m(0, 440)[1].toFixed(1)}`, want: '1651.5, 436.75', pass: Math.abs(nl.right - 1651.5) < 2 },
          { name: 'the small band x 738 to 1662, y 143 to 227, Merc\'s line whole', got: `${b.left.toFixed(1)} to ${b.right.toFixed(1)}, ${b.top.toFixed(1)} to ${b.bottom.toFixed(1)}`, want: '738 to 1662, 142.75 to 226.75', pass: Math.abs(b.left - 738) < 1 && Math.abs(b.bottom - 226.75) < 1 },
          { name: 'the figure at rest at F-gauge: k 1.2075, x0 150, y0 100.75 on screen (its crown and back)', got: `${S.cam.map(...S.fig.at('crown'), t).map((v) => v.toFixed(2)).join(', ')}; breath ${S.fig.shape().b.toFixed(3)}`, want: `${(150 + 1.2075 * 230).toFixed(2)}, ${(100.75 + 1.2075 * 20).toFixed(2)}; breath 0.000` },
          { name: 'no cursor, no readout', got: `${vis(S.gl.readout.el)} ${vis(S.gl.readoutAdding.el)} ${(+S.ga.g.children[4].getAttribute('opacity')).toFixed(2)}`, want: '0.00 0.00 0.00' },
          { name: 'hosts at 240', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '36.4-163.6; 1756.4-1883.6' }, ...H.keepout(root, S.boxes))
      }
      return out
    },
  }
})()
