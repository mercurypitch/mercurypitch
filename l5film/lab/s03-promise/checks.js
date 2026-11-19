// s03-promise's checks: the first frame's bead (s02's last), its landing on A3 at (480, 400), F-promise-a and -b, the
// last frame against HANDOFFS § S3 to S4, Tavi landed, the keep-out.
;(function () {
  const H = window.__H, sid = 's03-promise'
  const S = window.__sceneProbe[sid], A = S.A
  const ts = [0]
  for (let k = 1; k <= 6; k++) ts.push((A.LAND * k) / 6 - (k === 6 ? 0.0005 : 0))
  ts.push(A.LAND + 0.7, (A.TRUCK + A.TRUCK_END) / 2, A.TRUCK_END, A.D - 0.0005)
  // DECISIONS 174: "what your diaphragm does" left-aligned with "level", settled, early and late in the truck
  const DIA_T = [A.DIA + 0.5, A.LEAVE - 0.3]
  ts.push(...DIA_T)
  // fix round F-01 (DECISIONS 226): the lower half, with the outline drawn and the label under "level"
  const LOW_T = [A.DIA + 0.8, A.LEAVE - 0.3]
  ts.push(A.DIA + 0.8)
  ts.sort((a, b) => a - b)
  let a3Ink = null
  const root = document.getElementById(sid + '-scene')
  window.__groupA = {
    times: ts,
    check(t) {
      a3Ink = a3Ink || H.ink('A3', "600 48px 'Outfit'", 'end')   // measured once the fonts are in
      const out = []
      const plot = () => { const a = S.cam.map(400, 400, t), b = S.cam.map(1520, 400, t); return { x0: a[0], x1: b[0], y: a[1] } }
      if (t <= A.LAND) {
        const b = H.R(S.bead.core), r = b.width / 2, cx = b.x + r, cy = b.y + r
        const ax = S.cam.map(366, 417, t), a3 = { left: ax[0] + a3Ink.l, right: ax[0] + a3Ink.r, top: ax[1] - a3Ink.up, bottom: ax[1] + a3Ink.down }
        const dx = Math.max(a3.left - cx, 0, cx - a3.right), dy = Math.max(a3.top - cy, 0, cy - a3.bottom)
        out.push({ name: `t ${t.toFixed(4)} bead (${cx.toFixed(2)}, ${cy.toFixed(2)}) r ${r.toFixed(2)}; to "A3" ink`, got: Math.hypot(dx, dy) - r, want: '>= 12', pass: Math.hypot(dx, dy) - r >= 12 })
        if (t === 0) { const p = plot(); out.push({ name: 'F-promise-a: plot x 480 to 1600', got: `${p.x0} to ${p.x1}`, want: '480 to 1600' }) }
        if (t > A.LAND - 0.001) out.push({ name: 'the bead lands on A3 at the plot\'s left end, (480, 400)', got: `${cx.toFixed(1)}, ${cy.toFixed(1)}`, want: '480.0, 400.0', pass: Math.abs(cx - 480) < 1 && Math.abs(cy - 400) < 1 })
      }
      if (t === 0) out.push({ name: 'DECISIONS 176: the chart\'s fade-up on the first frame (the band\'s group; s02\'s last frame draws the same)', got: +S.ch.g.querySelector('.band').getAttribute('opacity'), want: 'info', pass: true })
      if (DIA_T.includes(t)) {
        const d = H.R(S.diaphragm.el), lv = H.R(S.lab.level.el)
        out.push({ name: `DECISIONS 174 (t ${t.toFixed(2)}): "what your diaphragm does" left-aligned with "level": their x (advance origins, screen)`, got: `${S.cam.map(+S.diaphragm.el.getAttribute('x'), 0, t)[0].toFixed(1)} / ${S.cam.map(+S.lab.level.el.getAttribute('x'), 0, t)[0].toFixed(1)}`, want: 'equal', pass: +S.diaphragm.el.getAttribute('x') === +S.lab.level.el.getAttribute('x') && S.diaphragm.el.getAttribute('text-anchor') === S.lab.level.el.getAttribute('text-anchor') },
          { name: '  their ink\'s left edges (glyph boxes)', got: `${d.left.toFixed(1)} / ${lv.left.toFixed(1)}`, want: 'within 2 px', pass: Math.abs(d.left - lv.left) <= 2 },
          { name: '  "what your diaphragm does" box (x, y) and its gap under "level"', got: `${d.left.toFixed(1)} to ${d.right.toFixed(1)}, ${d.top.toFixed(1)} to ${d.bottom.toFixed(1)}; ${(d.top - lv.bottom).toFixed(1)} px`, want: 'info', pass: d.top - lv.bottom > 0 }, ...H.keepout(root, S.boxes))
      }
      if (LOW_T.includes(t)) {
        const ink = (el, font, anchor) => { const k = H.ink(el.textContent, font, anchor), x = +el.getAttribute('x'), y = +el.getAttribute('y'), a = S.cam.map(x, y, t); return { left: a[0] + k.l, right: a[0] + k.r, top: a[1] - k.up, bottom: a[1] + k.down } }
        const lv = ink(S.lab.level.el, "600 32px 'Outfit'", 'start'), dg = ink(S.diaphragm.el, "600 40px 'Outfit'", 'start')
        const o = H.R(S.stripOutline), hair = S.cam.map(0, S.ch.G.strip, t)[1]
        const oBot = o.bottom, oTop = o.top                         // the 2 px stroke's outer edge (the rect's box is its geometry, +1 each side)
        out.push({ name: `F-01, DECISIONS 226 (t ${t.toFixed(2)}): the strip's hairline on screen y / its outline y (stroke centres) / "level" baseline / "what your diaphragm does" baseline`,
          got: `${hair.toFixed(1)} / ${(oTop).toFixed(1)} to ${(oBot).toFixed(1)} / ${S.cam.map(0, +S.lab.level.el.getAttribute('y'), t)[1].toFixed(1)} / ${S.cam.map(0, +S.diaphragm.el.getAttribute('y'), t)[1].toFixed(1)}`,
          want: '720.0 / 660.0 to 780.0 / 820.0 / 874.0', pass: Math.abs(hair - 720) < 0.01 && Math.abs(oTop - 660) < 0.01 && Math.abs(oBot - 780) < 0.01 },
          { name: '  the outline\'s stroke (outer edge) to "level"\'s ink', got: lv.top - (oBot + 1), want: '>= 12', pass: lv.top - (oBot + 1) >= 12 },
          { name: '  "level"\'s ink to "what your diaphragm does"\'s ink', got: dg.top - lv.bottom, want: '>= 12', pass: dg.top - lv.bottom >= 12 },
          { name: '  the lowest ink (its descenders) above the captions\' 896', got: dg.bottom, want: '<= 896', pass: dg.bottom <= 896 },
          { name: '  the outline 1.5 times its old 80 px (stroke centres)', got: (oBot - oTop) / 80, want: 1.5, tol: 0.001 })
      }
      if (t === A.TRUCK_END || t > A.D - 0.001) {
        const p = plot()
        out.push({ name: 'F-promise-b: plot x 320 to 1440, line y 400', got: `${p.x0} to ${p.x1}, ${p.y}`, want: '320 to 1440, 400' })
      }
      if (t > A.D - 0.001) {
        const vis = (e) => H.alpha(e).toFixed(2)
        out.push({ name: 'F-01: the last frame\'s strip at 720 and "level" at 820 (s04\'s first frame draws the same)', got: `${S.ch.G.strip} / ${S.lab.level.el.getAttribute('y')}`, want: '720 / 820' })
        out.push({ name: 'last frame: "A3", "level" at full; the promise labels gone', got: `${vis(S.lab.A3.el)} ${vis(S.lab.level.el)} / ${vis(S.diaphragm.el)} ${vis(S.breathe.el)} ${vis(S.comfortable.el)}`, want: '1.00 1.00 / 0.00 0.00 0.00' },
          { name: 'Tavi landed at (1800, 840), 300: body box', got: S.boxes.tavi && `${S.boxes.tavi.x0}-${S.boxes.tavi.x1}, ${S.boxes.tavi.y0}-${S.boxes.tavi.y1}`, want: '1720.5-1879.5, 648-840' })
      }
      return out.concat(H.keepout(root, S.boxes))
    },
  }
})()
