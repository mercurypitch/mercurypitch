// s02-title's checks: the first frame is S1's field; the bead's flight against "A3" and the fading staff (HANDOFFS
// § The cuts S2 to S3, provisional); the last frame's bead (s03's first frame draws it from the same film time).
;(function () {
  const H = window.__H, sid = 's02-title'
  const S = window.__sceneProbe[sid], A = S.A
  const ts = [0]
  for (let k = 0; k <= 16; k++) ts.push(A.BACK + (k * (A.D - A.BACK)) / 16)
  ts.push(A.D - 0.0005)
  const FADE_T = [A.D - 0.87, A.D - 0.6, A.D - 0.3]                 // clip 2.73, 3.0 and 3.3: the last 0.9 s of S2
  ts.push(...FADE_T)
  ts.sort((a, b) => a - b)
  let a3Ink = null
  window.__groupA = {
    times: ts,
    check(t) {
      a3Ink = a3Ink || H.ink('A3', "600 48px 'Outfit'", 'end')   // measured once the fonts are in
      const out = []
      if (t === 0) return [{ name: 'first frame: the field centred (960, 540), r 1500, opaque (S1\'s last frame)', got: `${S.field.disc.getAttribute('cx')}, ${S.field.disc.getAttribute('cy')}, ${S.field.disc.getAttribute('r')}, ${S.field.disc.getAttribute('opacity')}`, want: '960.00, 540.00, 1500.00, 1.000' }]
      const b = H.R(S.bead.core), r = b.width / 2, cx = b.x + r, cy = b.y + r
      // "A3" ink at F-promise-a (world right-aligned 366, baseline 417; screen x + 80)
      const ax = S.cam.map(366, 417, t), a3 = { left: ax[0] + a3Ink.l, right: ax[0] + a3Ink.r, top: ax[1] - a3Ink.up, bottom: ax[1] + a3Ink.down }
      const dx = Math.max(a3.left - cx, 0, cx - a3.right), dy = Math.max(a3.top - cy, 0, cy - a3.bottom)
      const gapA3 = Math.hypot(dx, dy) - r
      const staffA = H.alpha(S.staff.g)
      const topLine = Math.min(...[...S.staff.g.querySelectorAll('path')].map((p) => H.R(p).top))
      out.push({ name: `flight t ${t.toFixed(3)}: bead (${cx.toFixed(1)}, ${cy.toFixed(1)}) r ${r.toFixed(1)}; to "A3" ink (alpha ${H.alpha(S.lab.A3.el).toFixed(2)})`, got: gapA3, want: '>= 12', pass: gapA3 >= 12 },
        { name: `  staff alpha ${staffA.toFixed(2)}, bead foot over the top staff line by`, got: topLine - (cy + r), want: 'info', pass: true })
      if (t > A.D - 0.001) out.push({ name: 'last frame: bead centre and radius (s03 draws the same at its 0)', got: `${cx.toFixed(2)}, ${cy.toFixed(2)}, r ${r.toFixed(2)}`, want: 'see s03 t 0', pass: true },
        { name: 'DECISIONS 176: the chart\'s fade-up on the last frame (the band\'s group; s03\'s first frame draws the same)', got: +S.ch.g.querySelector('.band').getAttribute('opacity'), want: 'info', pass: true })
      if (FADE_T.includes(t)) out.push({ name: `DECISIONS 176: the chart's fade-up at ${t.toFixed(2)} (the critic's near-empty 2.73 to 3.0)`, got: +S.ch.g.querySelector('.band').getAttribute('opacity'), want: 'info', pass: true })
      return out
    },
  }
})()
