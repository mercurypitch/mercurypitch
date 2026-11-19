// s14-next's checks (lab/s05-push/probe.mjs, the shared probe): the first frame against S13's last (the bead on
// L.TEASE.carry from film time; HANDOFFS § The cuts S13 to S14), the carry's path left of x 450, the landing on C4, the
// seven beads and the rows, the tune lit, the tease line, the arrows, the dashed copy and its "?", the hook in two lines,
// the shrink's start and the last frame (HANDOFFS § S14 to S15); overlaps, keep-out and the caption band at every time.
;(function () {
  const H = window.__H, sid = 's14-next'
  const S = window.__sceneProbe[sid], A = S.A, TE = L.TEASE
  const T = {
    f0: 0, rowsIn: A.ROWS_IN + A.ROWS_D + 0.01, kick: A.KICK + 0.5, land: A.LAND + 0.005, held: A.TW + TE.onset(0) - 0.05, beads: A.TW + TE.onset(0) + A.LIGHT_D + 0.01, lit: A.TW + TE.onset(6) + 0.3, line: A.LINE + 0.3,
    copy: A.QM + 0.3, hook1: A.HOOK[0] + 0.35, hook2: A.HOOK[1] + 0.35, hookOut: A.HOOK_OUT + 0.31, last: A.D - 0.0005, hookRise: A.HOOK_OUT + 0.12, lineRise: A.LINE_OUT + 0.12,
  }
  const root = document.getElementById(sid + '-scene')
  const R = H.R
  const near = (a, b, tol = 1) => Math.abs(a - b) <= tol
  const fmt = (r) => `${r.left.toFixed(1)} to ${r.right.toFixed(1)}, ${r.top.toFixed(1)} to ${r.bottom.toFixed(1)}`
  const inkOf = (el) => {
    const cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const ink = H.ink(el.textContent, font, el.getAttribute('text-anchor') || 'start')
    const m = el.getScreenCTM(), x = +el.getAttribute('x'), y = +el.getAttribute('y')
    const p0 = new DOMPoint(x + ink.l, y - ink.up).matrixTransform(m), p1 = new DOMPoint(x + ink.r, y + ink.down).matrixTransform(m)
    return { left: p0.x, top: p0.y, right: p1.x, bottom: p1.y, width: p1.x - p0.x, height: p1.y - p0.y, base: new DOMPoint(x, y).matrixTransform(m).y }
  }
  const overlaps = () => {
    const tx = [...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= 0.5 && e.textContent.trim()).map((e) => ({ text: e.textContent.trim().slice(0, 40), r: inkOf(e) })).filter((x) => x.r.width > 0)
    const bad = []
    for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) {
      const a = tx[i].r, b = tx[j].r
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0) bad.push(`"${tx[i].text}" / "${tx[j].text}"`)
    }
    return { name: 'no two visible texts overlap (ink)', got: bad.length ? bad.join('; ') : 'none', want: 'none', pass: !bad.length }
  }
  const visTexts = (min = 0.05) => H.texts(root, min).map((x) => x.text)
  const footOf = (min = 0.05) => { const v = [...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= min && e.textContent.trim()).map((e) => inkOf(e).bottom); return v.length ? Math.max(...v) : 0 }
  // every visible bead, copy and arrow 20 px or more from each host's body box (the rows are masked round them instead)
  const keepMarks = () => {
    const els = S.te.beads.flatMap((B) => [B.outline, B.copy]).filter((e) => H.alpha(e) > 0.05)
    const out = []
    for (const [who, b] of Object.entries(S.boxes)) {
      if (!b) continue
      const hb = { left: b.x0, right: b.x1, top: b.y0, bottom: b.y1 }
      const worst = Math.min(...els.map((e) => H.gap(R(e), hb)), Infinity)
      out.push({ name: `keep-out: the beads and the copy from ${who}'s body box`, got: worst, want: '>= 20', pass: worst >= 20 })
    }
    return out
  }
  const common = () => [overlaps(), ...H.keepout(root, S.boxes), ...keepMarks(), { name: 'nothing visible below y 896 (ink)', got: footOf(), want: '<= 896', pass: footOf() <= 896 }]
  const cen = (el) => { const r = R(el); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2, r.width / 2] }
  const beadSeen = () => cen(S.bead.core)
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      const Tf = A.T0 + t
      if (t === T.f0) {
        const c = L.TEASE.carry(Tf, A.T0 + A.CARRY0), b = beadSeen()
        let maxX = 0
        for (let s = 0; s <= A.CARRY_D; s += 0.005) maxX = Math.max(maxX, L.TEASE.carry(A.T0 + A.CARRY0 + s, A.T0 + A.CARRY0).x + L.TEASE.carry(A.T0 + A.CARRY0 + s, A.T0 + A.CARRY0).r)
        out.push({ name: 'first frame: the bead in flight on L.TEASE.carry (S13\'s last frame computes the same)', got: `${b[0].toFixed(2)}, ${b[1].toFixed(2)}, r ${b[2].toFixed(2)}`, want: `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, r ${c.r.toFixed(2)}`, pass: near(b[0], c.x, 0.5) && near(b[1], c.y, 0.5) && near(b[2], c.r, 0.5) },
          { name: 'the carry\'s whole path (with its radius) left of x 450', got: maxX.toFixed(1), want: '< 450', pass: maxX < 450 },
          { name: 'nothing else: no texts, no beads, no rows yet', got: `${visTexts(0.01).length} texts; beads ${S.te.beads.map((B) => H.alpha(B.outline)).filter((a) => a > 0.01).length}`, want: '0 texts; beads 0' },
          { name: 'Merc at (1290, 840), Tavi at (1800, 840), 300', got: `${S.boxes.merc && (S.boxes.merc.x0 + S.boxes.merc.x1) / 2} ${S.boxes.merc && S.boxes.merc.x1 - S.boxes.merc.x0}; ${S.boxes.tavi && (S.boxes.tavi.x0 + S.boxes.tavi.x1) / 2}`, want: '1290 159; 1800', pass: !!S.boxes.merc && near((S.boxes.merc.x0 + S.boxes.merc.x1) / 2, 1290, 0.5) && near(S.boxes.merc.x1 - S.boxes.merc.x0, 159, 0.5) && near((S.boxes.tavi.x0 + S.boxes.tavi.x1) / 2, 1800, 0.5) }, ...common())
      }
      if (t === T.rowsIn) {
        const rowsA = +S.te.g.querySelector('g[mask]').getAttribute('opacity'), b = beadSeen()
        out.push({ name: '14a: the rows and the six outlines in from S14\'s first frame over 0.6 s (DECISIONS 219)', got: `rows ${rowsA.toFixed(2)}; outlines ${S.te.beads.slice(1).map((B) => (+B.g.getAttribute('opacity')).toFixed(2)).join(' ')}; from ${A.ROWS_IN} over ${A.ROWS_D}`, want: 'rows 1.00; outlines 1.00 x6; from 0 over 0.6', pass: rowsA > 0.99 && S.te.beads.slice(1).every((B) => +B.g.getAttribute('opacity') > 0.99) && A.ROWS_IN === 0 },
          { name: 'the first bead\'s place holds only the carried bead, filled (no outline under it)', got: `bead 0 ${(+S.te.beads[0].g.getAttribute('opacity')).toFixed(2)}; carried ${S.bead.g.getAttribute('display') === 'none' ? 'hidden' : 'a ' + (+S.bead.g.getAttribute('opacity')).toFixed(2)} at ${b[0].toFixed(1)}, ${b[1].toFixed(1)}`, want: 'bead 0 0.00; carried a 1.00', pass: +S.te.beads[0].g.getAttribute('opacity') === 0 && S.bead.g.getAttribute('display') !== 'none' && +S.bead.g.getAttribute('opacity') > 0.99 }, ...common())
      }
      if (t === T.held) {
        const b = beadSeen()
        out.push({ name: '14a: just before its note, the carried bead still filled at C4 (r 20), never an outline', got: `carried ${S.bead.g.getAttribute('display') === 'none' ? 'hidden' : 'a ' + (+S.bead.g.getAttribute('opacity')).toFixed(2)} at ${b[0].toFixed(1)}, ${b[1].toFixed(1)}, r ${b[2].toFixed(1)}; bead 0 ${(+S.te.beads[0].g.getAttribute('opacity')).toFixed(2)}`, want: 'carried a 1.00 at 420, 745, r 20; bead 0 0.00', pass: S.bead.g.getAttribute('display') !== 'none' && +S.bead.g.getAttribute('opacity') > 0.99 && near(b[0], 420, 0.6) && near(b[1], 745, 0.6) && near(b[2], 20, 0.6) && +S.te.beads[0].g.getAttribute('opacity') === 0 }, ...common())
      }
      if (t === T.kick) out.push({ name: '14a: the kicker "NEXT TIME" at (120, 110)', got: `${inkOf(S.kicker.el).left.toFixed(1)}, ${inkOf(S.kicker.el).base.toFixed(1)}`, want: '122, 110', pass: near(inkOf(S.kicker.el).base, 110, 0.5) }, ...common())
      if (t === T.land) {
        // the bead's place (its group's translate) and its squash about its foot (a landing squash moves the centre down)
        const m = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/.exec(S.bead.g.getAttribute('transform')), b = R(S.bead.core)
        out.push({ name: '14a: the bead lands on C4\'s place (420, 745) at r 20', got: `${m[1]}, ${m[2]}, r ${(20 * m[3]).toFixed(2)}`, want: '420.00, 745.00, r 20.00', pass: near(+m[1], 420, 0.5) && near(+m[2], 745, 0.5) && near(20 * m[3], 20, 0.1) },
          { name: 'with a squash about its foot (y 765 held)', got: `foot ${b.bottom.toFixed(2)}, ${b.width.toFixed(1)} x ${b.height.toFixed(1)}`, want: 'foot 765, wider than tall', pass: near(b.bottom, 765, 0.6) && b.width > b.height }, ...common())
      }
      if (t === T.beads) {
        const c = S.te.beads.map((B) => cen(B.outline))
        out.push({ name: '14a: the seven beads at x 420 + 160 i on C4 C4 G4 G4 A4 A4 G4 (y 745 745 535 535 475 475 535)', got: c.map((p) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(' '), want: '420,745 580,745 740,535 900,535 1060,475 1220,475 1380,535', pass: c.every((p, i) => near(p[0], TE.BEADS[i].x, 0.5) && near(p[1], TE.BEADS[i].y, 0.5)) },
          { name: 'on its note the first bead lit blue and the carried bead given way to it (LIGHT_D); the other six outlines', got: `bead 0 fill ${(+S.te.beads[0].fill.getAttribute('opacity')).toFixed(2)}; groups ${S.te.beads.map((B) => (+B.g.getAttribute('opacity')).toFixed(2)).join(' ')}; carried ${S.bead.g.getAttribute('display') === 'none' ? 'hidden' : 'shown'}`, want: 'bead 0 fill 1.00; groups 1.00 x7; carried hidden', pass: +S.te.beads[0].fill.getAttribute('opacity') > 0.99 && S.te.beads.every((B) => +B.g.getAttribute('opacity') > 0.99) && S.bead.g.getAttribute('display') === 'none' },
          { name: 'the rows in, masked round the hosts (two holes)', got: [...S.te.g.querySelectorAll('mask rect[fill="#000"]')].filter((r) => r.getAttribute('display') !== 'none').length, want: 2 }, ...common())
      }
      if (t === T.lit) {
        const m = S.boxes.merc
        out.push({ name: '14a: every bead lit blue on its onset and held (fill alpha)', got: S.te.beads.map((B) => (+B.fill.getAttribute('opacity')).toFixed(2)).join(' '), want: '1.00 x7', pass: S.te.beads.every((B) => +B.fill.getAttribute('opacity') > 0.99) },
          { name: 'Merc under the tune\'s right end: the A4 and G4 beads\' feet over his keep-out (box top - 20)', got: m ? `${(m.y0 - 20 - (TE.BEADS[5].y + 20)).toFixed(1)}, ${(m.y0 - 20 - (TE.BEADS[6].y + 20)).toFixed(1)}` : 'none', want: '>= 70 (board 73)', pass: !!m && m.y0 - 20 - (TE.BEADS[6].y + 20) >= 70 }, ...common())
      }
      if (t === T.line) {
        const l = inkOf(S.line.el), k = inkOf(S.kicker.el)
        const tune = (TE.BEADS[0].x + TE.BEADS[6].x) / 2
        out.push({ name: '14b: the tease line, word for word, centred over the tune (x 960), baseline 170 (DECISIONS 220)', got: `${S.line.el.textContent}; ${fmt(l)}; base ${l.base.toFixed(1)}; tune centre ${tune}`, want: 'Merc moves every single note of ‘Twinkle, Twinkle’ up.; centred 960; base 170', pass: near((l.left + l.right) / 2, 960, 3) && near(l.base, 170, 0.5) },
          { name: 'its ink top (caps and quotes) 24 px or more under "NEXT TIME"\'s foot', got: `kicker foot ${k.bottom.toFixed(1)}, line top ${l.top.toFixed(1)}: ${(l.top - k.bottom).toFixed(1)}`, want: '>= 24', pass: l.top - k.bottom >= 24 },
          { name: 'the kicker at the frame\'s left margin (x 120)', got: k.left.toFixed(1), want: '120 to 124', pass: k.left >= 119 && k.left <= 125 },
          { name: 'over the dashed copy (its top) by 12 px or more', got: (Math.min(...S.te.beads.map((B) => R(B.copy).top)) - l.bottom).toFixed(1), want: '>= 12', pass: Math.min(...S.te.beads.map((B) => R(B.copy).top)) - l.bottom >= 12 }, ...common())
      }
      if (t === T.copy) {
        const cc = S.te.beads.map((B) => cen(B.copy)), q = inkOf(S.te.g.querySelector('text'))
        out.push({ name: '14b: the dashed copy six rows up (y - 180), all seven drawn', got: cc.map((p) => p[1].toFixed(0)).join(' ') + '; ' + S.te.beads.map((B) => (+B.copy.getAttribute('opacity')).toFixed(2)).join(' '), want: '565 565 355 355 295 295 355; 1.00 x7', pass: cc.every((p, i) => near(p[1], TE.BEADS[i].y - 180, 0.5)) && S.te.beads.every((B) => +B.copy.getAttribute('opacity') > 0.99) },
          { name: 'its "?" Outfit 600 64, ink-2, x 1430, baseline 375', got: `${q.left.toFixed(1)}, ${q.base.toFixed(1)}`, want: '1430, 375', pass: near(q.left, 1431, 3) && near(q.base, 375, 0.5) },
          { name: 'the arrows drawn from each bead to its copy', got: S.te.beads.map((B) => H.alpha(B.arrow.g).toFixed(2)).join(' '), want: '1.00 x7', pass: S.te.beads.every((B) => H.alpha(B.arrow.g) > 0.99) }, ...common())
      }
      if (t === T.hook1) {
        const h = inkOf(S.hook[0].el)
        out.push({ name: '14c: the tease line and the kicker gone before the hook', got: `${H.alpha(S.line.el).toFixed(2)} ${H.alpha(S.kicker.el).toFixed(2)}`, want: '0.00 0.00' },
          { name: 'the hook\'s first line, word for word, centred, baseline 130', got: `${S.hook[0].el.textContent}; ${fmt(h)}`, want: 'Why can you start “Twinkle, Twinkle” on any note; centred 960, 130', pass: near((h.left + h.right) / 2, 960, 4) && near(h.base, 130, 0.5) }, ...common())
      }
      if (t === T.hook2) {
        const h = inkOf(S.hook[1].el), cTop = Math.min(...S.te.beads.map((B) => R(B.copy).top))
        out.push({ name: 'the hook\'s second line, baseline 200', got: `${S.hook[1].el.textContent}; ${fmt(h)}`, want: 'and it is still the same tune?; 200', pass: near(h.base, 200, 0.5) },
          { name: 'over the copy (gap)', got: (cTop - h.bottom).toFixed(1), want: '>= 12', pass: cTop - h.bottom >= 12 }, ...common())
      }
      if (t === T.hookOut) out.push({ name: '14c: the hook gone before the shrink', got: S.hook.map((h) => H.alpha(h.el).toFixed(2)).join(' '), want: '0.00 0.00' }, ...common())
      const layerDy = (el) => +((/translate\(0px, ([-\d.]+)px\)/.exec(el.style.transform) || [0, 'NaN'])[1])
      if (t === T.hookRise || t === T.lineRise) {
        const L0 = t === T.hookRise ? S.hookLayer : S.lineLayer, els = t === T.hookRise ? S.hook.map((h) => h.el) : [S.line.el], t0 = t === T.hookRise ? A.HOOK_OUT : A.LINE_OUT
        const want = -16 * L.ease('power3.in')(0.12 / 0.3), d = layerDy(L0.el)
        out.push({ name: `14c: ${t === T.hookRise ? 'the hook' : 'the tease line'} leaves up fast in its own composited layer, at a sub-pixel offset (DECISIONS 233)`, got: `${d.toFixed(3)} px at ${(t - t0).toFixed(2)} s into its leave`, want: want.toFixed(3), pass: Math.abs(d - want) < 0.01 && Math.abs(d - Math.round(d)) > 0.001 },
          { name: 'its own SVG transform carries no rise', got: els.map((e) => e.getAttribute('transform') || 'none').join(' | '), want: 'no translate in y', pass: els.every((e) => !/translate\([-\d.]+[ ,]+-?[1-9]/.test(e.getAttribute('transform') || '')) }, ...common())
      }
      if (t === T.last) {
        const u = L.TEASE.shrink(Tf, A.T0 + A.SHRINK0), p = TE.place(u), c0 = cen(S.te.beads[0].outline)
        out.push({ name: 'last frame: the figure on L.TEASE.shrink from film time (bead 1\'s centre)', got: `u ${u.toFixed(4)}; ${c0[0].toFixed(2)}, ${c0[1].toFixed(2)}`, want: `${(p.s * 420 + p.dx).toFixed(2)}, ${(p.s * 745 + p.dy).toFixed(2)}`, pass: near(c0[0], p.s * 420 + p.dx, 0.5) && near(c0[1], p.s * 745 + p.dy, 0.5) },
          { name: 'no texts (the hook gone at 555.95)', got: visTexts(0.01).filter((s) => s !== '?').length, want: 0 }, ...common())
      }
      return out
    },
  }
})()
