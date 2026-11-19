// s13-recap's checks (lab/s05-push/probe.mjs, the shared probe; lab/s05-push/helpers.js): the first frame against S12's
// last (HANDOFFS § The cuts S12 to S13), the frame's slide to the recap frame and its dimming, the panel and its three
// questions with the ring timer beside each, card 1's figure, card 2's traces, card 3's line (the wave rule, the mint
// edge at the entry, the flag by the page's rule), the clean break and the floor empty for the hops, the Voice Mirror
// card's rows and foot, the rest card, the drift, the carry's start on the glyph's dot, the last frame; overlaps between
// visible texts, the caption band and the keep-out at every time.
;(function () {
  const H = window.__H, sid = 's13-recap'
  const S = window.__sceneProbe[sid], A = S.A
  const T = {
    f0: 0, slideMid: A.SLIDE + A.SLIDE_D / 2, landed: A.SLIDE + A.SLIDE_D + 0.01, dim: A.DIM + A.DIM_D + 0.05, q1: A.Q1 + 0.4,
    fig: A.FIG + A.FIG_D + 0.1, ans1: A.ANS1 + A.BREATH_D + 0.1, q3: A.Q3 + 0.45, traces: A.TRACES + 0.75, tog: A.TOG + 0.3,
    q4: A.Q4 + 0.45, back: A.BACK + A.BACK_D + 0.05, lit: A.LIT + 0.25, flag: A.FLAG + 0.3, wave: A.SETTLES + 2.05, ans4: A.ANS4 + 0.3,
    gone: A.BREAK + 0.57, hop1: A.HOP1 + 0.12 + 0.2, hop2: A.HOP2 + 0.12 + 0.2, landed2: A.HOP2 + 0.12 + 0.41 + 0.05,
    pract: A.PRACT + 0.35, title: A.VMT + 0.45, rows: A.ROWS[2] + 0.35, read: A.READ + 0.4, sore: A.SORE + 0.35, ul: A.UL + 0.6, ten: A.TEN + 0.3,
    rest: A.RADDR + 0.8, drift: A.CARRY0, leave: A.LEAVE + 0.5, last: A.D - 0.0005,
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const fmt = (r) => `${r.left.toFixed(1)} to ${r.right.toFixed(1)}, ${r.top.toFixed(1)} to ${r.bottom.toFixed(1)}`
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol
  const bandEl = () => S.ch.g.querySelector('.band > rect')
  const inkOf = (el) => {
    const cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const ink = H.ink(el.textContent, font, el.getAttribute('text-anchor') || 'start')
    const m = el.getScreenCTM(), x = +el.getAttribute('x'), y = +el.getAttribute('y')
    const p0 = new DOMPoint(x + ink.l, y - ink.up).matrixTransform(m), p1 = new DOMPoint(x + ink.r, y + ink.down).matrixTransform(m)
    return { left: p0.x, top: p0.y, right: p1.x, bottom: p1.y, width: p1.x - p0.x, height: p1.y - p0.y, base: new DOMPoint(x, y).matrixTransform(m).y }
  }
  // overlaps between the visible texts' ink (the font boxes of two serif lines 60 px apart overlap by design)
  const overlaps = () => {
    const tx = [...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= 0.5 && e.textContent.trim()).map((e) => ({ text: e.textContent.trim().slice(0, 40), r: inkOf(e) })).filter((x) => x.r.width > 0)
    const bad = []
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
      const a = tx[i].r, b = tx[j].r
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ox > 0 && oy > 0) bad.push(`"${tx[i].text}" / "${tx[j].text}"`)
    }
    return { name: 'no two visible texts overlap (ink)', got: bad.length ? bad.join('; ') : 'none', want: 'none', pass: !bad.length }
  }
  // Merc's body on screen: mercGate's box less the root it cancels (the renderer draws him that far right in the frame)
  const mercSeen = (t) => {
    // the frame the renderer shows: the tag's data-media-start plus the scene time past its data-start
    const b = S.boxes.merc, rt = window.MERC_ROOTS && window.MERC_ROOTS['m-blue-s13'], v = document.getElementById('s13-recap-m-blue')
    if (!b || !rt) return b
    const i = Math.floor((t - parseFloat(v.getAttribute('data-start')) + parseFloat(v.getAttribute('data-media-start'))) * rt.fps + 1e-6), fr = rt.frames[Math.max(0, Math.min(rt.frames.length - 1, i))]
    const dx = fr[0] * L.ROOT_PX * (b.x1 - b.x0) / 0.53
    return { x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0, y1: b.y1 }
  }
  const visTexts = (min = 0.05) => H.texts(root, min).map((x) => x.text)
  const footOf = (min = 0.05) => { const v = [...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= min && e.textContent.trim()).map((e) => inkOf(e).bottom); return v.length ? Math.max(...v) : 0 }
  const common = () => [overlaps(), ...H.keepout(root, S.boxes), { name: 'nothing visible below y 896 (ink)', got: footOf(), want: '<= 896', pass: footOf() <= 896 }]
  const band = () => R(bandEl())
  const line = () => { const m = R(S.ch.merc.path); return { y: (m.top + m.bottom) / 2, x0: m.left, x1: m.right, px: +S.ch.merc.path.getAttribute('stroke-width') } }
  // the chart group's own opacity attribute (H.alpha multiplies an SVG element's opacity attribute and its computed
  // CSS opacity, which reflects the same attribute, so it squares a partial value)
  const chartA = () => +S.ch.g.getAttribute('opacity')
  const panelBox = (p) => R(p.g)
  const ringBox = () => { const c = S.ring.g.querySelector('circle'); return R(c) }
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.f0) {
        const b = band(), l = line(), e = S.bandRects
        out.push({ name: 'first frame: the band on F-turn\'s pixels, x 928 to 1824, y 104 to 202', got: fmt(b), want: '928 to 1824, 104 to 202', pass: near(b.left, 928, 0.5) && near(b.right, 1824, 0.5) && near(b.top, 104, 0.5) && near(b.bottom, 202, 0.5) },
          { name: 'Merc\'s line y 153, x 928 to 1824, 5.6 px (F-turn\'s 4 x 1.4)', got: `${l.y.toFixed(2)}, ${l.x0.toFixed(1)} to ${l.x1.toFixed(1)}, ${l.px}`, want: '153, 928 to 1824, 5.6', pass: near(l.y, 153, 0.5) && near(l.x0, 928, 0.5) && near(l.x1, 1824, 0.5) && near(l.px, 5.6, 0.01) },
          { name: 'the band\'s edges 2.8 px, centred on its top and foot (DECISIONS 202)', got: `${e[1].getAttribute('height')} at ${e[1].getAttribute('y')}; ${e[2].getAttribute('height')} at ${e[2].getAttribute('y')}`, want: '2.80 at 102.60; 2.80 at 200.60' },
          { name: 'no labels, no voice line, the chart at full', got: `${visTexts().length} texts, ${S.ch.lastLine('hold').length} line points, a ${chartA().toFixed(2)}`, want: '0 texts, 0 line points, a 1.00' },
          { name: 'the room crossfading from F-turn (the ghost layers at full on the cut frame)', got: [...root.querySelectorAll('.ghost')].map((g) => g.style.opacity).join(' '), want: '1 1 1' },
          { name: 'hosts at 300 in the corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' }, ...common())
      }
      if (t === T.slideMid) {
        const b = band(), m = S.cam.matrix(t, 'mid')
        out.push({ name: 'mid-slide: the frame between its places (an object move)', got: fmt(b), want: 'between', pass: b.left < 928 && b.left > 232 && b.top > 104 && b.top < 554.5 },
          { name: 'the camera still at F0 (the room does not part)', got: `${m.a} ${m.e} ${m.f}`, want: '1 0 0' },
          { name: 'no voice line during the slide (L.RECAP.voiceOK)', got: S.ch.lastLine('hold').length, want: 0 }, ...common())
      }
      if (t === T.landed) {
        const b = band(), l = line(), e = S.bandRects
        out.push({ name: 'landed: the recap frame x 232 to 1688, band 554.5 to 645.5', got: fmt(b), want: '232 to 1688, 554.5 to 645.5', pass: near(b.left, 232, 0.5) && near(b.right, 1688, 0.5) && near(b.top, 554.5, 0.5) && near(b.bottom, 645.5, 0.5) },
          { name: 'Merc\'s line y 600 at 4 px; the edges 2 px', got: `${l.y.toFixed(2)}, ${l.px}; ${e[1].getAttribute('height')}`, want: '600.00, 4; 2.00', pass: near(l.y, 600, 0.5) && near(l.px, 4, 0.01) && e[1].getAttribute('height') === '2.00' },
          { name: 'the wave rule holds here (k / rule k)', got: S.ch.waveRule().ratio, want: 1, tol: 0.01 }, ...common())
      }
      if (t === T.dim) out.push({ name: '13a: the frame dimmed to 35 % (its labels hidden)', got: chartA(), want: 0.35, tol: 0.01 }, { name: 'the kicker "QUICK CHECK" at (120, 110)', got: `${inkOf(S.kicker.el).left.toFixed(1)}, ${inkOf(S.kicker.el).base.toFixed(1)}`, want: '122, 110', pass: near(inkOf(S.kicker.el).base, 110, 0.5) && inkOf(S.kicker.el).left < 125 }, ...common())
      if (t === T.q1) {
        const p = panelBox(S.panel), q = inkOf(S.Qs[0][0].el), r = ringBox()
        out.push({ name: 'the panel x 120 to 960, y 140 to 330', got: fmt(p), want: '120 to 960, 140 to 330', pass: near(p.left, 120, 0.5) && near(p.right, 960, 0.5) && near(p.top, 140, 0.5) && near(p.bottom, 330, 0.5) },
          { name: 'question 1 from x 150, one line on the ring timer\'s height (baseline 264)', got: `${fmt(q)}; base ${q.base.toFixed(1)}`, want: 'x 150, base 264', pass: near(q.left, 150, 3) && near(q.base, 264, 0.5) },
          { name: 'the ring timer beside it, in the panel, at (910, 250): its ring 12 px or more right of the question', got: `${fmt(r)}; gap ${(r.left - q.right).toFixed(1)}`, want: '>= 12', pass: r.left - q.right >= 12 && r.right <= 960 }, ...common())
      }
      if (t === T.fig) {
        // the figure's own anchors (its bounding box would count the masked legs): the crown, the back, the belly's front
        const crown = S.fig.at('crown'), back = S.fig.at('back'), belly = S.fig.at('belly'), b = band()
        out.push({ name: 'card 1\'s figure at L.FIGURE.S13: crown y 105, back x 1262.5, belly front about 1397.5 (x 1262 to 1420 with the head)', got: `crown ${crown[1].toFixed(1)}, back ${back[0].toFixed(1)}, belly ${belly[0].toFixed(1)}`, want: 'crown 105, back 1262.5', pass: near(crown[1], 105, 0.5) && near(back[0], 1262.5, 0.5) },
          { name: 'masked from y 480 (gone by 495): 54 px or more over the dimmed band', got: (b.top - L.FIGURE.S13.fade[1]).toFixed(1), want: '>= 50', pass: b.top - L.FIGURE.S13.fade[1] >= 50 },
          { name: 'drawn whole', got: H.alpha(S.fig.g), want: 1, tol: 0.01 }, ...common())
      }
      if (t === T.ans1) {
        const a = inkOf(S.ans1[0].el)
        out.push({ name: '13b: "Breathing in." serif italic 64, x 150, baseline 400', got: `${fmt(a)}; base ${a.base.toFixed(1)}`, want: 'x 150, base 400', pass: near(a.left, 150, 4) && near(a.base, 400, 0.5) },
          { name: 'under the panel (gap)', got: a.top - 330, want: '>= 12', pass: a.top - 330 >= 12 }, ...common())
      }
      if (t === T.q3) {
        const l0 = inkOf(S.Qs[1][0].el), l1 = inkOf(S.Qs[1][1].el), r = ringBox()
        out.push({ name: '13c: question 3 in two lines, baselines 220 and 280, from x 150', got: `${l0.base.toFixed(1)}, ${l1.base.toFixed(1)}; ${l0.left.toFixed(1)}`, want: '220, 280; 150', pass: near(l0.base, 220, 0.5) && near(l1.base, 280, 0.5) && near(l0.left, 150, 4) },
          { name: 'both lines 12 px or more left of the ring timer', got: (r.left - Math.max(l0.right, l1.right)).toFixed(1), want: '>= 12', pass: r.left - Math.max(l0.right, l1.right) >= 12 },
          { name: 'question 1 and "Breathing in." gone; the figure gone', got: `${H.alpha(S.Qs[0][0].el).toFixed(2)} ${H.alpha(S.ans1[0].el).toFixed(2)} ${H.alpha(S.fig.g).toFixed(2)}`, want: '0.00 0.00 0.00' }, ...common())
      }
      if (t === T.traces) {
        // the traces' own geometry (their bounding boxes count the hidden circles and lit lanes)
        const TRr = L.TRACE.RECAP, names = S.traceNames.map((n) => inkOf(n.el)), b = band()
        const rows = S.traces.map((tr, i) => { const p = tr.g.querySelector('path').getBBox(), m = tr.g.getScreenCTM(); return { left: p.x * m.a + m.e, right: (p.x + p.width) * m.a + m.e, top: p.y * m.d + m.f, bottom: (p.y + p.height) * m.d + m.f } })
        out.push({ name: 'card 2: three traces x 1180 to 1640, centred y 200, 320, 440 (half-height 45; the waves\' own extent)', got: rows.map((r) => `${r.left.toFixed(0)}-${r.right.toFixed(0)} @${((r.top + r.bottom) / 2).toFixed(0)} h${((r.bottom - r.top) / 2).toFixed(0)}`).join('; '), want: '1180-1640 @200; @320; @440, h <= 45', pass: rows.every((r, i) => r.left >= 1179 && near(r.right, 1640, 2) && near((r.top + r.bottom) / 2, TRr.rows[i], 4) && (r.bottom - r.top) / 2 <= 45.5) },
          { name: 'their names right-aligned 1160, baselines 210, 330, 450', got: names.map((n) => `${n.right.toFixed(1)}/${n.base.toFixed(1)}`).join(' '), want: '1160 / 210 330 450', pass: names.every((n, i) => near(n.right, 1160, 3) && near(n.base, [210, 330, 450][i], 0.5)) },
          { name: 'the traces\' foot (y 440 + 45) clear of the dimmed band (554.5)', got: (b.top - (TRr.rows[2] + TRr.h)).toFixed(1), want: '>= 60', pass: b.top - (TRr.rows[2] + TRr.h) >= 60 },
          { name: 'names clear of the panel (x 960)', got: Math.min(...names.map((n) => n.left)).toFixed(1), want: '> 972', pass: Math.min(...names.map((n) => n.left)) > 972 }, ...common())
      }
      if (t === T.tog) {
        const a0 = inkOf(S.ans3[0].el), a1 = inkOf(S.ans3[1].el)
        out.push({ name: '13c: the answer in two lines, serif italic 56, baselines 392 and 452', got: `${a0.base.toFixed(1)}, ${a1.base.toFixed(1)}; to x ${Math.max(a0.right, a1.right).toFixed(1)}`, want: '392, 452', pass: near(a0.base, 392, 0.5) && near(a1.base, 452, 0.5) },
          { name: 'its foot over the frame\'s labels (baseline 510, cap top about 488)', got: (488 - a1.bottom).toFixed(1), want: '>= 12', pass: 488 - a1.bottom >= 12 },
          { name: 'rows 1 and 2 dimming, row 3 lit', got: S.traces.map((tr) => tr.g.querySelector('path').getAttribute('stroke-opacity')).join(' '), want: 'dim, dim, 1', pass: true }, ...common())
      }
      if (t === T.q4) {
        const l0 = inkOf(S.Qs[2][0].el), l1 = inkOf(S.Qs[2][1].el), r = ringBox()
        out.push({ name: '13d: question 4 (o14a, word for word) in two lines at 220 and 280', got: `${S.Qs[2][0].el.textContent} / ${S.Qs[2][1].el.textContent}`, want: 'What does a steady long note look like / on the pitch line?' },
          { name: 'left of the ring timer by 12 px or more', got: (r.left - Math.max(l0.right, l1.right)).toFixed(1), want: '>= 12', pass: r.left - Math.max(l0.right, l1.right) >= 12 }, ...common())
      }
      if (t === T.back) {
        const ao = inkOf(S.anyOct.el), tg = R(S.tag.g)
        out.push({ name: '13d: the frame back to full', got: chartA(), want: 1, tol: 0.01 },
          { name: '"A, any octave" x 232, baseline 510', got: `${ao.left.toFixed(1)}, ${ao.base.toFixed(1)}`, want: '232, 510', pass: near(ao.left, 232, 3) && near(ao.base, 510, 0.5) },
          { name: '"ILLUSTRATION" right-aligned 1688, centred y 500', got: `${tg.right.toFixed(1)}, ${((tg.top + tg.bottom) / 2).toFixed(1)}`, want: '1688, 500', pass: near(tg.right, 1688.75, 1.5) && near((tg.top + tg.bottom) / 2, 500, 1) },
          { name: 'the traces gone', got: S.traces.map((tr) => H.alpha(tr.g).toFixed(2)).join(' '), want: '0.00 0.00 0.00' }, ...common())
      }
      if (t === T.lit) {
        const ib = inkOf(S.inBand.el)
        out.push({ name: '13d: the mint edge and "in the band" lit at the entry (the page\'s 16 ms rule: entry 0.704 s)', got: `entry ${A.ENTRY.toFixed(3)}; lit ${H.alpha(S.ch.g.querySelector('.band g')).toFixed(2)}; "in the band" ${H.alpha(S.inBand.el).toFixed(2)}`, want: 'entry 0.704; lit 1.00; "in the band" 1.00' },
          { name: '"in the band" x 520, baseline 510', got: `${ib.left.toFixed(1)}, ${ib.base.toFixed(1)}`, want: '520, 510', pass: near(ib.left, 520, 3) && near(ib.base, 510, 0.5) }, ...common())
      }
      if (t === T.flag) {
        const f = R(S.flag.g.querySelector('rect'))
        out.push({ name: '13d: the "settled" flag (no label) at the entry\'s x: 232 + 145.6 x 0.704 = 334.5, y 538.5 to 554.5', got: `x ${((f.left + f.right) / 2).toFixed(2)}, y ${f.top.toFixed(1)} to ${f.bottom.toFixed(1)}; label ${H.alpha(S.flag.label).toFixed(2)}`, want: 'x 334.50, y 538.5 to 554.5; label 0.00', pass: near((f.left + f.right) / 2, 334.5, 0.5) && near(f.top, 538.5, 0.5) && near(f.bottom, 554.5, 0.5) && H.alpha(S.flag.label) === 0 },
          { name: 'it stands at the line\'s 1.204 s (scene time)', got: (A.FLAG).toFixed(3), want: (A.SETTLES + 1.204 / A.LINE_K).toFixed(3) }, ...common())
      }
      if (t === T.wave) {
        // the wave rule (HANDOFFS § The wave rule, 13d): one cycle 26.5 px, 36.4 px peak to peak, ratio 1.375
        const pts = S.ch.lastLine('hold').filter((p) => p[0] > 232 + 145.6 * 2 && p[0] < 232 + 145.6 * 7)
        const ys = pts.map((p) => p[1]), pk = []
        for (let i = 1; i < pts.length - 1; i++) if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1]) pk.push(pts[i][0])
        const cyc = (pk[pk.length - 1] - pk[0]) / (pk.length - 1), pp = Math.max(...ys) - Math.min(...ys)
        out.push({ name: '13d: the wave in the recap frame: one cycle (px)', got: cyc, want: 26.47, tol: 26.47 * 0.1 }, { name: 'peak to peak (px)', got: pp, want: 36.4, tol: 3.64 }, { name: 'ratio', got: pp / cyc, want: 1.375, tol: 0.075 }, ...common())
      }
      if (t === T.ans4) {
        const a0 = inkOf(S.ans4[0].el), a1 = inkOf(S.ans4[1].el)
        out.push({ name: '13d: "It settles into the band / and stays there." baselines 392 and 452', got: `${a0.base.toFixed(1)}, ${a1.base.toFixed(1)}`, want: '392, 452', pass: near(a0.base, 392, 0.5) && near(a1.base, 452, 0.5) }, ...common())
      }
      if (t === T.gone) {
        out.push({ name: '13e: the clean break, the recap gone by the beat\'s start + 0.56', got: `${visTexts(0.01).length} texts; chart ${chartA().toFixed(2)}; panel ${H.alpha(S.panel.g).toFixed(2)}`, want: '0 texts; chart 0.00; panel 0.00' }, ...common())
      }
      if (t === T.hop1 || t === T.hop2) {
        const drawn = [...root.querySelectorAll('.layer.mid *, .layer.hud *')].filter((e) => e.getBBox && !['g', 'svg', 'defs', 'stop', 'linearGradient', 'radialGradient', 'mask', 'filter', 'feGaussianBlur', 'clipPath'].includes(e.tagName) && H.alpha(e) > 0.01)
          .map((e) => R(e)).filter((r) => r.width > 0 && r.bottom > 300 && r.left < 1400)
        const m = S.boxes.merc
        out.push({ name: `13e: Merc in the air (${t === T.hop1 ? 'hop 1' : 'hop 2'}): nothing drawn below y 300 from x 0 to 1400`, got: drawn.length, want: 0 },
          { name: 'his box carried through the air', got: m ? ((m.x0 + m.x1) / 2).toFixed(1) : 'none', want: t === T.hop1 ? '110 to 700' : '700 to 1290', pass: !!m && (m.x0 + m.x1) / 2 > (t === T.hop1 ? 110 : 700) && (m.x0 + m.x1) / 2 < (t === T.hop1 ? 700 : 1290) }, ...common())
      }
      if (t === T.landed2) {
        const m = mercSeen(t)
        out.push({ name: 'Merc landed at (1290, 840): the box less the root it cancels (0.38 units at the landing)', got: m ? `${((m.x0 + m.x1) / 2).toFixed(2)}, ${m.y1}` : 'none', want: '1290.00, 840', pass: !!m && near((m.x0 + m.x1) / 2, 1290, 0.5) }, ...common())
      }
      if (t === T.pract) {
        const p = panelBox(S.vmPanel), pr = inkOf(S.practise.el)
        out.push({ name: '13e: the Voice Mirror card\'s panel x 230 to 1110, top 90, its foot at 300', got: fmt(p), want: '230 to 1110, 90 to 300', pass: near(p.left, 230, 0.5) && near(p.right, 1110, 0.5) && near(p.top, 90, 0.5) && near(p.bottom, 300, 0.5) },
          { name: '"Practise it." Outfit 600 40 from x 270, baseline 150', got: `${pr.left.toFixed(1)}, ${pr.base.toFixed(1)}`, want: '270, 150', pass: near(pr.left, 270, 3) && near(pr.base, 150, 0.5) }, ...common())
      }
      if (t === T.title) {
        const ti = inkOf(S.vmTitle.el), ru = R(S.vmRule.g)
        out.push({ name: '"Voice Mirror" serif italic 96, baseline 250; the rule y 272, x 270 to 1070', got: `${ti.base.toFixed(1)}; ${fmt(ru)}`, want: '250; 270 to 1070, 271 to 273', pass: near(ti.base, 250, 0.5) && near(ru.left, 270, 0.5) && near(ru.right, 1070, 1) && near(ru.top, 271, 0.5) },
          { name: '"Practise it." and "Voice Mirror" apart (gap)', got: (ti.top - inkOf(S.practise.el).bottom).toFixed(1), want: '>= 12', pass: ti.top - inkOf(S.practise.el).bottom >= 12 }, ...common())
      }
      if (t === T.rows) {
        const r = S.rows.map((x) => inkOf(x.lab.el)), g = S.rows.map((x) => R(x.glyph.g)), p = panelBox(S.vmPanel)
        out.push({ name: 'b55\'s three rows, word for word, from x 326 at baselines 340, 400, 460', got: S.rows.map((x) => x.lab.el.textContent).join(' / '), want: 'Voice Mirror has you glide up and down, / hold any comfortable note for six seconds, / then sing back five notes it plays.' },
          { name: 'their places', got: r.map((x) => `${x.left.toFixed(0)}/${x.base.toFixed(0)}`).join(' '), want: '326/340 326/400 326/460', pass: r.every((x, i) => near(x.left, 326, 3) && near(x.base, [340, 400, 460][i], 0.5)) },
          { name: 'each glyph at x 270, left of its row\'s words', got: g.map((x, i) => `${x.left.toFixed(0)}-${x.right.toFixed(0)} (gap ${(r[i].left - x.right).toFixed(0)})`).join(' '), want: 'from 270, gap >= 8', pass: g.every((x, i) => x.left >= 268 && r[i].left - x.right >= 8) },
          { name: 'the foot at 480', got: p.bottom, want: 480, tol: 0.5 },
          { name: 'every row inside the card (right edge)', got: Math.max(...r.map((x) => x.right)).toFixed(1), want: '<= 1090', pass: Math.max(...r.map((x) => x.right)) <= 1090 }, ...common())
      }
      if (t === T.read) {
        const l = S.readout.map((x) => inkOf(x.el)), p = panelBox(S.vmPanel)
        out.push({ name: 'the readout, word for word, Inter 32 in three lines within 800 px (baselines 525, 565, 605)', got: S.readout.map((x) => x.el.textContent).join(' | '), want: 'the brief\'s sentence', pass: S.readout.map((x) => x.el.textContent).join(' ') === L.RECAP.VM.readout.text && l.every((x, i) => near(x.base, [525, 565, 605][i], 0.5) && x.right <= 1071) },
          { name: 'the foot at 625', got: p.bottom, want: 625, tol: 0.5 }, ...common())
      }
      if (t === T.sore) out.push({ name: '"Keep the glides comfortable." (665) and "Sore, hoarse or unwell today? Just listen along." (710)', got: `${inkOf(S.keep.el).base.toFixed(1)}, ${inkOf(S.sore.el).base.toFixed(1)}; to x ${inkOf(S.sore.el).right.toFixed(1)}`, want: '665, 710', pass: near(inkOf(S.keep.el).base, 665, 0.5) && near(inkOf(S.sore.el).base, 710, 0.5) }, ...common())
      if (t === T.ul) {
        const u = R(S.freeUl), f = inkOf(S.free.el)
        out.push({ name: '"Free, no account: mercurypitch.com/mirror" (baseline 765), the address underlined at y 777', got: `${f.base.toFixed(1)}; underline ${fmt(u)}`, want: '765; under the address, y 776 to 778', pass: near(f.base, 765, 0.5) && near(u.top, 776, 0.6) && u.left > 580 && near(u.right, f.right, 3) },
          { name: 'the foot at 790', got: panelBox(S.vmPanel).bottom, want: 790, tol: 0.5 }, ...common())
      }
      if (t === T.ten) {
        const l = inkOf(S.ten.el), m = S.boxes.merc
        out.push({ name: '"Ten minutes, gently, most days. Missed a day? Just come back." under the card, Inter 32, ink-2', got: `${S.ten.el.textContent}; ${fmt(l)}`, want: 'one line from x 270, the brief\'s words', pass: S.ten.el.textContent === 'Ten minutes, gently, most days. Missed a day? Just come back.' && near(l.left, 270, 3) },
          { name: 'its ink clear of the card\'s foot (790)', got: (l.top - 790).toFixed(1), want: '>= 4', pass: l.top - 790 >= 4 },
          { name: 'its ink 12 px or more over the floor horizon (840; DECISIONS 203)', got: (840 - l.bottom).toFixed(1), want: '>= 12', pass: 840 - l.bottom >= 12 },
          { name: 'from Merc\'s body at (1290, 840)', got: m ? (m.x0 - l.right).toFixed(1) : 'none', want: '>= 20', pass: !!m && m.x0 - l.right >= 20 }, ...common())
      }
      if (t === T.rest) {
        const p = panelBox(S.restPanel), all = [...S.restQ, S.restTitle, ...S.restBody, S.restAddr].map((x) => inkOf(x.el)), u = R(S.restUl)
        out.push({ name: '13g: the rest card x 1130 to 1690, y 250 to 600', got: fmt(p), want: '1130 to 1690, 250 to 600', pass: near(p.left, 1130, 0.5) && near(p.right, 1690, 0.5) && near(p.top, 250, 0.5) && near(p.bottom, 600, 0.5) },
          { name: 'its lines, word for word (b58)', got: [...S.restQ, S.restTitle, ...S.restBody, S.restAddr].map((x) => x.el.textContent).join(' / '), want: 'Felt uncomfortable, or listened / along today? / Rest today / Voice Mirror will be here when / your voice feels comfortable: / mercurypitch.com/mirror' },
          { name: 'every line inside the card (x 1160 to 1670), baselines 296, 332, 416, 470, 508, 566', got: all.map((x) => `${x.base.toFixed(0)}`).join(' ') + `; right ${Math.max(...all.map((x) => x.right)).toFixed(1)}`, want: '296 332 416 470 508 566', pass: all.every((x, i) => near(x.base, [296, 332, 416, 470, 508, 566][i], 0.5) && x.right <= 1670 && x.left >= 1150) },
          { name: 'the address underlined at y 576', got: fmt(u), want: '1160 to the address\'s end, 575 to 577', pass: near(u.top, 575, 0.6) && near(u.left, 1160, 0.5) },
          { name: 'its foot 28 px or more over Merc\'s keep-out (box top 648, keep-out 628)', got: S.boxes.merc ? (S.boxes.merc.y0 - 20 - p.bottom).toFixed(1) : 'none', want: '>= 28', pass: !!S.boxes.merc && S.boxes.merc.y0 - 20 - p.bottom >= 27.5 }, ...common())
      }
      if (t === T.drift) {
        const d = S.rows[2].glyph.dot(0), m = S.cardsLayer.style.transform
        const dy = +(/translate3d\(0px, ([-\d.]+)px/.exec(m) || [0, 0])[1]
        out.push({ name: 'the carry starts on the "five notes" glyph\'s first dot: its place now (272, 434 after the drift)', got: `${d[0]}, ${(d[1] + dy).toFixed(2)}`, want: '272, 434', pass: d[0] === 272 && near(d[1] + dy, 434, 1) },
          { name: 'the bead\'s carry from there (L.TEASE.carry at its start)', got: (() => { const c = L.TEASE.carry(A.T0 + t + 1e-6, A.T0 + A.CARRY0); return c ? `${c.x.toFixed(1)}, ${c.y.toFixed(1)}, r ${c.r.toFixed(2)}` : 'none' })(), want: '272.0, 434.0, r 4.00' }, ...common())
      }
      if (t === T.leave) out.push({ name: 'the cards\' lines leaving in turn (some gone, some not)', got: visTexts(0.5).length, want: 'between', pass: true }, ...common())
      if (t === T.last) {
        const c = L.TEASE.carry(A.T0 + t, A.T0 + A.CARRY0), b = R(S.bead.core)
        out.push({ name: 'last frame: no texts or panels left (HANDOFFS § S13 to S14: the lines gone)', got: `${visTexts(0.01).length} texts; panels ${H.alpha(S.vmPanel.g).toFixed(2)} ${H.alpha(S.restPanel.g).toFixed(2)}`, want: '0 texts; panels 0.00 0.00' },
          { name: 'the bead in flight on L.TEASE.carry (its centre)', got: `${((b.left + b.right) / 2).toFixed(2)}, ${((b.top + b.bottom) / 2).toFixed(2)}, r ${(b.width / 2).toFixed(2)}`, want: `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, r ${c.r.toFixed(2)}`, pass: near((b.left + b.right) / 2, c.x, 0.5) && near((b.top + b.bottom) / 2, c.y, 0.5) && near(b.width / 2, c.r, 0.5) },
          { name: 'Merc at (1290, 840), Tavi at (1800, 840), both 300', got: `${S.boxes.merc && (S.boxes.merc.x0 + S.boxes.merc.x1) / 2}, ${S.boxes.tavi && (S.boxes.tavi.x0 + S.boxes.tavi.x1) / 2}`, want: '1290, 1800' }, ...common())
      }
      return out
    },
  }
})()
