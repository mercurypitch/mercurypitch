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
      if (t === A.TRUCK_END || t > A.D - 0.001) {
        const p = plot()
        out.push({ name: 'F-promise-b: plot x 320 to 1440, line y 400', got: `${p.x0} to ${p.x1}, ${p.y}`, want: '320 to 1440, 400' })
      }
      if (t > A.D - 0.001) {
        const vis = (e) => H.alpha(e).toFixed(2)
        out.push({ name: 'last frame: "A3", "level" at full; the promise labels gone', got: `${vis(S.lab.A3.el)} ${vis(S.lab.level.el)} / ${vis(S.diaphragm.el)} ${vis(S.breathe.el)} ${vis(S.comfortable.el)}`, want: '1.00 1.00 / 0.00 0.00 0.00' },
          { name: 'Tavi landed at (1800, 840), 300: body box', got: S.boxes.tavi && `${S.boxes.tavi.x0}-${S.boxes.tavi.x1}, ${S.boxes.tavi.y0}-${S.boxes.tavi.y1}`, want: '1720.5-1879.5, 648-840' })
      }
      return out.concat(H.keepout(root, S.boxes))
    },
  }
})()
