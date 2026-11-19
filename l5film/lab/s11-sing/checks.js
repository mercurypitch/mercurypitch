// s11-sing's checks (lab/s05-push/probe.mjs, the shared probe): the first frame against S10's last (HANDOFFS § The cuts
// S10 to S11: the empty hold frame on its pixels, the room crossfading from F-hold), the card over the dimmed frame, the
// care block's places (HANDOFFS § The turn, Frame-fixed) with real widths, the frame's bracket and labels, the ring, the
// last frame against § The cuts S11 to S12, overlaps between visible texts, the caption band and the keep-out.
;(function () {
  const H = window.__H, sid = 's11-sing'
  const S = window.__sceneProbe[sid], A = S.A
  const T = {
    f0: 0, ghost: 0.15, gone: 0.34, dim: A.DIM + A.DIM_D + 0.05, card: A.CARD_IN + 0.9, full: A.UNDIM + A.UNDIM_D + 0.02,
    yt: A.YT + 0.4, br: A.BR + A.BR_D + 0.3, noth: A.NOTH + 0.3, doc: A.DOC + 0.4, sore: A.SORE + 0.3, just: A.JUST + 0.3,
    r1: A.RS[0] + 0.3, r2: A.RS[1] + 0.3, r3: A.RS[2] + 0.3, r4: A.RS[3] + 0.3, r5: A.RS[4] + 0.3,
    ring: A.RING + A.RING_D + 0.1, listening: A.LISTENING + 0.3, pulse: A.RING_P + 0.15, last: A.D - 0.0005,
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const near = (r, x0, y0, x1, y1, tol = 1.5) => Math.abs(r.left - x0) <= tol && Math.abs(r.top - y0) <= tol && Math.abs(r.right - x1) <= tol && Math.abs(r.bottom - y1) <= tol
  const fmt = (r) => `${r.left.toFixed(1)} to ${r.right.toFixed(1)}, ${r.top.toFixed(1)} to ${r.bottom.toFixed(1)}`
  const bandEl = () => S.ch.g.querySelector('.band rect')
  // ink box of a text element from canvas metrics (the glyphs' own extent), in screen px, at its current transform
  const inkOf = (el) => {
    const cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const anchor = el.getAttribute('text-anchor') || 'start'
    const ink = H.ink(el.textContent, font, anchor)
    const m = el.getScreenCTM(), x = +el.getAttribute('x'), y = +el.getAttribute('y')
    const p0 = new DOMPoint(x + ink.l, y - ink.up).matrixTransform(m), p1 = new DOMPoint(x + ink.r, y + ink.down).matrixTransform(m)
    return { left: p0.x, top: p0.y, right: p1.x, bottom: p1.y, width: p1.x - p0.x, height: p1.y - p0.y }
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
  const visTexts = () => H.texts(root, 0.05).map((x) => x.text)
  const careFoot = () => {
    const els = [S.title.el, ...S.comfort.map((l) => l.el), ...S.reasons.map((p) => p.lab.el), S.listening.el, ...S.doc]
    const vis = els.filter((e) => H.alpha(e) > 0.05 && e.textContent)
    const foot = Math.max(...vis.map((e) => inkOf(e).bottom)), right = Math.max(...vis.map((e) => inkOf(e).right)), left = Math.min(...vis.map((e) => inkOf(e).left))
    return [{ name: 'the care block: nothing below y 864 (ink)', got: foot, want: '<= 864', pass: foot <= 864 },
      { name: 'the care block within x 260 to 960 (ink)', got: `${left.toFixed(1)} to ${right.toFixed(1)}`, want: '>= 258, <= 960', pass: left >= 258 && right <= 960 }]
  }
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      if (t === T.f0) {
        const b = R(bandEl()), m = R(S.ch.merc.path)
        out.push({ name: 'first frame (S10\'s last): the band x 1000 to 1640, y 210 to 280', got: fmt(b), want: '1000 to 1640, 210 to 280', pass: near(b, 1000, 210, 1640, 280, 0.5) },
          { name: 'Merc\'s line at y 245, stroke 4 px, x 1000 to 1640', got: `${((m.top + m.bottom) / 2).toFixed(2)}, ${S.ch.merc.path.getAttribute('stroke-width')} px, ${m.left.toFixed(1)} to ${m.right.toFixed(1)}`, want: '245, 4 px', pass: Math.abs((m.top + m.bottom) / 2 - 245) < 0.5 && +S.ch.merc.path.getAttribute('stroke-width') === 4 && Math.abs(m.left - 1000) < 0.5 && Math.abs(m.right - 1640) < 0.5 },
          { name: 'no labels on the first frame', got: visTexts().join(', ') || 'none', want: 'none', pass: !visTexts().length },
          { name: 'the room: the outgoing framing\'s layers shown, the room at rest hidden', got: `${(+S.cut.ghost.near.style.opacity).toFixed(2)} / ${(+root.querySelector('.layer.near').style.opacity).toFixed(2)}`, want: '1.00 / 0.00' },
          { name: 'hosts at 300 in the corners', got: `${S.boxes.merc && S.boxes.merc.x0}-${S.boxes.merc && S.boxes.merc.x1}; ${S.boxes.tavi && S.boxes.tavi.x0}-${S.boxes.tavi && S.boxes.tavi.x1}`, want: '30.5-189.5; 1720.5-1879.5' })
      }
      if (t === T.ghost) out.push({ name: 'the room\'s crossfade halfway at 0.15 s', got: +S.cut.ghost.far.style.opacity, want: 0.5, tol: 0.06 })
      if (t === T.gone) out.push({ name: 'the outgoing room gone by 0.33 s', got: +S.cut.ghost.under.style.opacity, want: 0, tol: 0.001 })
      if (t === T.dim) out.push({ name: '11a: the frame dimmed to 25 %', got: +S.ch.g.getAttribute('opacity'), want: 0.25, tol: 0.01 })
      if (t === T.card) {
        const cb = R(S.card.titleEl)
        out.push({ name: '11a: "Sing it" centred on x 960 (no numeral)', got: (cb.left + cb.right) / 2, want: 960, tol: 6 },
          { name: '11a: the card clears the dimmed frame (card top under the band\'s foot 280)', got: cb.top, want: '> 280', pass: cb.top > 280 })
      }
      if (t === T.full) out.push({ name: '11a: the frame back to full as the card leaves', got: +S.ch.g.getAttribute('opacity'), want: 1, tol: 0.001 })
      if (t === T.yt) {
        const r = inkOf(S.title.el)
        out.push({ name: '11b: "Your turn." at x 260, baseline 200 (ink box)', got: fmt(r), want: 'x 266 to 663, y 120 to 201 (WIDTHS)', pass: Math.abs(r.left - 266) < 3 && r.bottom <= 202 })
      }
      if (t === T.br) {
        const br = R(S.br.path), z = inkOf(S.br0.el), ten = inkOf(S.br10.el)
        out.push({ name: '11b: the bracket x 1000 to 1640 at y 292 (ticks up 8)', got: fmt(br), want: '999 to 1641, 283 to 293', pass: Math.abs(br.left - 999) < 1.5 && Math.abs(br.right - 1641) < 1.5 && Math.abs(br.bottom - 293) < 1.5 },
          { name: '"0" from x 1000, "10 s" to 1640, baseline 322 (ink)', got: `${z.left.toFixed(1)}; ${ten.right.toFixed(1)}; foot ${z.bottom.toFixed(1)}`, want: '~1000; ~1640; 322', pass: Math.abs(z.left - 1000) < 4 && Math.abs(ten.right - 1640) < 4 && Math.abs(z.bottom - 322) < 2 },
          { name: '"0" and "10 s" under the bracket (gap)', got: z.top - br.bottom, want: '>= 4', pass: z.top - br.bottom >= 4 })
      }
      if (t === T.noth) {
        const r = inkOf(S.nothing.el), z = inkOf(S.br0.el)
        out.push({ name: '11b: "Nothing listens" from x 1000, baseline 402 (ink)', got: fmt(r), want: 'x 1002 to 1200, y 380 to 409', pass: Math.abs(r.left - 1002) < 3 && Math.abs(r.bottom - 409) < 2 },
          { name: '"Nothing listens" under "0" (gap)', got: r.top - z.bottom, want: '>= 12', pass: r.top - z.bottom >= 12 })
      }
      if (t === T.doc) {
        const lines = S.doc.filter((e) => e.textContent)
        const ws = lines.map((e) => e.getComputedTextLength())
        out.push({ name: '11c: the doctor lines small, broken where the font puts them within 700 px (HANDOFFS estimated five)', got: lines.length, want: 4 },
          { name: 'each within 700 px (x 260 to 960)', got: ws.map((w) => w.toFixed(1)).join(', '), want: '<= 700', pass: ws.every((w) => w <= 700) },
          { name: 'baselines 650 to 802', got: lines.map((e) => e.getAttribute('y')).join(', '), want: L.TURN.CARE.doctorSmall.y.slice(0, lines.length).join(', ') },
          { name: 'word for word: the lines joined are the page\'s text', got: lines.map((e) => e.textContent).join(' ') === L.TURN.CARE.doctor ? 'same' : 'differs', want: 'same' })
      }
      if (t === T.sore) {
        const ic = R(S.icon), c = inkOf(S.comfort[0].el)
        out.push({ name: '11c: the care icon\'s box at (260, 236), 36 px (its ink)', got: fmt(ic), want: 'inside x 260 to 296, y 236 to 272', pass: ic.left >= 259 && ic.right <= 297 && ic.top >= 235 && ic.bottom <= 273 },
          { name: '"Sore, hoarse or unwell today?" from x 310, baseline 262 (ink)', got: fmt(c), want: 'x 310 to 795, y 235 to 270', pass: Math.abs(c.left - 310) < 3 && Math.abs(c.right - 794.6) < 3 })
      }
      if (t === T.just) { const c = inkOf(S.comfort[1].el); out.push({ name: '"Just listen along." x 310, baseline 306', got: fmt(c), want: 'x 310 to 585, y 279 to 314', pass: Math.abs(c.left - 310) < 3 && Math.abs(c.bottom - 314) < 2 }) }
      ;['r1', 'r2', 'r3', 'r4', 'r5'].forEach((k, i) => {
        if (t !== T[k]) return
        const p = S.reasons[i], r = inkOf(p.lab.el)
        out.push({ name: `11d: reason ${i + 1} "${p.lab.el.textContent}" lands on its word (baseline ${p.line.y})`, got: fmt(r), want: `right <= 960`, pass: r.right <= 960 && Math.abs(+p.lab.el.getAttribute('y') - p.line.y) < 0.01 })
        if (i === 1 || i === 3) {
          const prev = inkOf(S.reasons[i - 1].lab.el)
          out.push({ name: `its middot stands one space after "${S.reasons[i - 1].lab.el.textContent}"`, got: r.left - prev.right, want: '6 to 12', pass: r.left - prev.right >= 6 && r.left - prev.right <= 12 })
        }
        if (i === 4) out.push(...careFoot())
      })
      if (t === T.ring) {
        const tr = R(S.ring.g.querySelector('circle'))
        out.push({ name: '11e: the ring centre (1320, 590), r 160 (track 10 px)', got: `${((tr.left + tr.right) / 2).toFixed(1)}, ${((tr.top + tr.bottom) / 2).toFixed(1)}, r ${(tr.width / 2).toFixed(1)} (the circle's geometry)`, want: '1320, 590, r 160', pass: Math.abs((tr.left + tr.right) / 2 - 1320) < 1 && Math.abs((tr.top + tr.bottom) / 2 - 590) < 1 && Math.abs(tr.width / 2 - 160) < 1 },
          { name: 'no counter, no word inside', got: [...S.ring.g.querySelectorAll('text')].filter((e) => H.alpha(e) > 0.01).length, want: 0 },
          { name: 'the ring under the frame\'s labels (track top 425 against "Nothing listens" foot)', got: tr.top - inkOf(S.nothing.el).bottom, want: '>= 12', pass: tr.top - inkOf(S.nothing.el).bottom >= 12 })
      }
      if (t === T.listening) { const r = inkOf(S.listening.el); out.push({ name: '11e: the listening line x 260, baseline 486, within 960', got: fmt(r), want: 'x 261 to 912', pass: Math.abs(r.left - 261) < 3 && r.right <= 960 }) }
      if (t === T.pulse) out.push({ name: '11e: the ring scales about 1.05 on "the ring."', got: S.ring.g.querySelector('g').getAttribute('transform') || 'none', want: 'scale about (1320, 590)', pass: /scale\(1\.0[2-5]/.test(S.ring.g.querySelector('g').getAttribute('transform') || '') })
      if (t === T.last) {
        const b = R(bandEl())
        out.push({ name: 'last frame (HANDOFFS § S11 to S12): the band on its pixels', got: fmt(b), want: '1000 to 1640, 210 to 280', pass: near(b, 1000, 210, 1640, 280, 0.5) },
          { name: 'the care block "Your turn." to the listening line, the doctor lines small; the bracket, "0", "10 s", "Nothing listens"', got: visTexts().length, want: 12 + S.doc.filter((e) => e.textContent).length, pass: visTexts().length === 12 + S.doc.filter((e) => e.textContent).length },
          { name: 'the ring at 35 %, drawn, at rest (scale 1), no counter', got: `${S.ring.g.getAttribute('opacity')} / ${S.ring.g.querySelector('circle').getAttribute('stroke-opacity')} / ${S.ring.g.querySelector('g').getAttribute('transform') || 'none'}`, want: '1.000 / 0.350 / none' },
          ...careFoot(), overlaps(), ...H.keepout(root, S.boxes))
      }
      if (t === T.doc || t === T.r5 || t === T.listening) out.push(overlaps(), ...H.keepout(root, S.boxes))
      return out
    },
  }
})()
