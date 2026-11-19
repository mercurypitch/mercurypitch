// s15-end's checks (lab/s05-push/probe.mjs, the shared probe): the first frame against S14's last (the tease figure on
// L.TEASE.shrink from film time; HANDOFFS § The cuts S14 to S15), the figure settled in the end card's box, the lockup, the
// address and the free line at their places and at rest by end + 1.14, the hosts at 400 on the right, the clear zone (x 80
// to 1100, y 460 to 880: nothing of the scene's drawn there), the 3 % push to the last frame with the type frame-fixed.
;(function () {
  const H = window.__H, sid = 's15-end'
  const S = window.__sceneProbe[sid], A = S.A, TE = L.TEASE, E = TE.END
  const T = { f0: 0, wipe: A.WIPE + A.WIPE_D / 2, settled: A.SHRINK0 + 1.2 + 0.01, rest: A.FREE + A.LAND_D + 0.005, hosts: A.GROW + A.GROW_D + 0.05, last: A.D - 0.0005 }
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
  const cen = (el) => { const r = R(el); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2, r.width / 2] }
  const visTexts = (min = 0.05) => H.texts(root, min).map((x) => x.text)
  const footOf = (min = 0.05) => { const v = [...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= min && e.textContent.trim()).map((e) => inkOf(e).bottom); return v.length ? Math.max(...v) : 0 }
  const figMarks = () => S.te.beads.flatMap((B) => [B.outline, B.copy, B.halo]).filter((e) => H.alpha(e) > 0.05).map((e) => R(e)).concat([inkOf(S.te.g.querySelector('text'))])
  const keepFig = () => Object.entries(S.boxes).filter(([, b]) => b).map(([who, b]) => {
    const hb = { left: b.x0, right: b.x1, top: b.y0, bottom: b.y1 }
    const w = Math.min(...figMarks().map((r) => H.gap(r, hb)))
    return { name: `keep-out: the tease figure from ${who}'s body box`, got: w, want: '>= 20', pass: w >= 20 }
  })
  const common = () => [...H.keepout(root, S.boxes), ...keepFig(), { name: 'nothing visible below y 896 (ink)', got: footOf(), want: '<= 896', pass: footOf() <= 896 }]
  window.__groupB = {
    times: Object.values(T),
    check(t) {
      const out = []
      const Tf = A.T0 + t
      if (t === T.f0) {
        const u = L.TEASE.shrink(Tf, A.T0 + A.SHRINK0), p = TE.place(u), c0 = cen(S.te.beads[0].outline), c6 = cen(S.te.beads[6].outline)
        out.push({ name: 'first frame: the figure on L.TEASE.shrink from film time (S14\'s last computes the same): bead 1 and bead 7', got: `u ${u.toFixed(4)}; ${c0[0].toFixed(2)}, ${c0[1].toFixed(2)}; ${c6[0].toFixed(2)}, ${c6[1].toFixed(2)}`, want: `${(p.s * 420 + p.dx).toFixed(2)}, ${(p.s * 745 + p.dy).toFixed(2)}; ${(p.s * 1380 + p.dx).toFixed(2)}, ${(p.s * 535 + p.dy).toFixed(2)}`, pass: near(c0[0], p.s * 420 + p.dx, 0.5) && near(c0[1], p.s * 745 + p.dy, 0.5) && near(c6[0], p.s * 1380 + p.dx, 0.5) },
          { name: 'the camera at F0 on the cut frame (the push starts from rest)', got: S.cam.scale(t).toFixed(5), want: '1.00000' },
          { name: 'no type yet; the beads lit, the copy and "?" drawn', got: `${visTexts(0.01).filter((s) => s !== '?').length} texts; lit ${S.te.beads.map((B) => (+B.fill.getAttribute('opacity')).toFixed(0)).join('')}`, want: '0 texts; lit 1111111' },
          { name: 'Merc at (1290, 840), Tavi at (1800, 840), 300', got: `${S.boxes.merc && (S.boxes.merc.x0 + S.boxes.merc.x1) / 2} ${S.boxes.merc && (S.boxes.merc.x1 - S.boxes.merc.x0).toFixed(1)}; ${S.boxes.tavi && (S.boxes.tavi.x0 + S.boxes.tavi.x1) / 2}`, want: '1290 159.0; 1800' }, ...common())
      }
      if (t === T.wipe) out.push({ name: 'the lockup mid-wipe (feathered, left to right)', got: S.lockup.g.getAttribute('opacity'), want: '1.000' }, ...common())
      if (t === T.settled) {
        const marks = figMarks(), x0 = Math.min(...marks.map((r) => r.left)), x1 = Math.max(...marks.map((r) => r.right)), y0 = Math.min(...marks.map((r) => r.top)), y1 = Math.max(...marks.map((r) => r.bottom))
        const p = S.cam.map(1210, 150, t), q = S.cam.map(1660, 380, t)
        out.push({ name: 'the tease figure settled in the end card\'s box (x 1210 to 1660, y 150 to 380 at F0, riding the push)', got: `${x0.toFixed(1)} to ${x1.toFixed(1)}, ${y0.toFixed(1)} to ${y1.toFixed(1)}`, want: `about ${p[0].toFixed(1)} to ${q[0].toFixed(1)}, ${p[1].toFixed(1)} to ${q[1].toFixed(1)} (the "?" and the beads' halos past it)`, pass: x0 >= p[0] - 12 && y0 >= p[1] - 12 && y1 <= q[1] + 12 },
          { name: 'the rows and the arrows gone', got: `${S.te.g.querySelector('g[mask]').getAttribute('opacity')} ${S.arrowsG.getAttribute('opacity')}`, want: '0.000 0.000' }, ...common())
      }
      if (t === T.rest) {
        const lk = R(S.lockup.g), ad = inkOf(S.addr.el), fr = inkOf(S.free.el)
        out.push({ name: 'the lockup at x 120, y 80 to 180 (its ink from 124.6, its orb\'s margin)', got: fmt(lk), want: '124.6 to 574, 80 to 180', pass: near(lk.left, 124.6, 2) && lk.top >= 79 && lk.bottom <= 181 },
          { name: 'the address Outfit 600 72, x 120, baseline 320', got: `${S.addr.el.textContent}; ${fmt(ad)}; base ${ad.base.toFixed(1)}`, want: 'mercurypitch.com/mirror; x 120; 320', pass: S.addr.el.textContent === 'mercurypitch.com/mirror' && near(ad.left, 124, 4) && near(ad.base, 320, 0.5) },
          { name: '"Voice Mirror is free, with no account" Outfit 500 44, baseline 395', got: `${S.free.el.textContent}; ${fmt(fr)}`, want: 'baseline 395', pass: near(fr.base, 395, 0.5) },
          { name: 'all at rest (full) by end + 1.14', got: `${H.alpha(S.addr.el).toFixed(2)} ${H.alpha(S.free.el).toFixed(2)} wipe done ${R(S.lockup.g).right > 570}`, want: '1.00 1.00 wipe done true' },
          { name: 'the address and the free line over the clear zone (y 460)', got: (460 - fr.bottom).toFixed(1), want: '>= 12', pass: 460 - fr.bottom >= 12 }, ...common())
      }
      if (t === T.hosts) {
        const m = S.boxes.merc, v = S.boxes.tavi
        out.push({ name: 'Merc grown to 400 in place at (1290, 840): body x 1184 to 1396, y 584 to 840', got: m ? `${m.x0.toFixed(1)} to ${m.x1.toFixed(1)}, ${m.y0.toFixed(1)} to ${m.y1}` : 'none', want: '1184 to 1396, 584 to 840', pass: !!m && near(m.x0, 1184, 0.5) && near(m.x1, 1396, 0.5) && near(m.y0, 584, 0.5) },
          { name: 'Tavi hopped 190 px left to (1610, 840) at 400: body x 1504 to 1716', got: v ? `${v.x0.toFixed(1)} to ${v.x1.toFixed(1)}, ${v.y0.toFixed(1)}` : 'none', want: '1504 to 1716, 584', pass: !!v && near(v.x0, 1504, 0.5) && near(v.x1, 1716, 0.5) }, ...common())
      }
      if (t === T.last) {
        // the clear zone: nothing of the scene's (type, the figure, the lockup) in x 80 to 1100, y 460 to 880
        const Z = { left: 80, right: 1100, top: 460, bottom: 880 }
        const items = [...root.querySelectorAll('.layer.mid svg *, .layer.hud svg *')].filter((e) => e.getBBox && ['text', 'circle', 'rect', 'path', 'ellipse', 'line'].includes(e.tagName) && H.alpha(e) > 0.01 && !e.closest('mask, clipPath, defs'))
          .filter((e) => { const r = R(e); return r.width > 0 && r.right > Z.left && r.left < Z.right && r.bottom > Z.top && r.top < Z.bottom })
        out.push({ name: 'the clear zone x 80 to 1100, y 460 to 880: nothing of the scene\'s drawn (the room\'s ground, glow, floor and dust only)', got: items.length ? items.map((e) => e.tagName + ':' + (e.textContent || '').slice(0, 20)).join(', ') : 'none', want: 'none', pass: !items.length },
          { name: 'the push landed: F-end, s 1.03 (the room and the figure)', got: S.cam.scale(t).toFixed(4), want: '1.0300' },
          { name: 'the type frame-fixed (the address still at baseline 320)', got: inkOf(S.addr.el).base.toFixed(2), want: '320.00' },
          { name: 'the hosts past the last frame: their passes run to it', got: `${!!S.boxes.merc} ${!!S.boxes.tavi}`, want: 'true true' }, ...common())
      }
      return out
    },
  }
})()
