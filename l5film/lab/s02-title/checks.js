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
  // fix round F-01 (DECISIONS 229): every frame from the title's exit to the end, the title (and its kicker and
  // lockup) against the chart's fade-up; (233) the type layer composited
  const FLIGHT = new Set(ts)
  const EXITW = []
  for (let k = Math.ceil(A.EXIT * 30); k / 30 <= A.D; k++) EXITW.push(k / 30)
  ts.push(...EXITW, A.EXIT - 0.5)
  const ex = { both: 0, lastType: null, firstChart: null }
  ts.sort((a, b) => a - b)
  let a3Ink = null
  window.__groupA = {
    times: [...new Set(ts)].sort((a, b) => a - b),
    check(t) {
      a3Ink = a3Ink || H.ink('A3', "600 48px 'Outfit'", 'end')   // measured once the fonts are in
      const out = []
      if (t === A.EXIT - 0.5) {
        const cs = (e) => getComputedStyle(e).willChange
        out.push({ name: `DECISIONS 233: the type layer and its three boxes composited (will-change), the zoom a CSS matrix`, got: [S.typeLayer, S.titleBox, S.kickBox, S.lockBox].map(cs).join(' '), want: 'transform x 4', pass: [S.typeLayer, S.titleBox, S.kickBox, S.lockBox].every((e) => cs(e) === 'transform') })
      }
      if (EXITW.includes(t)) {
        const typeA = Math.max(...[S.titleBox, S.kickBox, S.lockBox].map((e) => +e.style.opacity))
        const chartA = Math.max(+S.ch.g.querySelector('.band').getAttribute('opacity'), H.alpha(S.lab.A3.el), H.alpha(S.lab.level.el))
        if (typeA > 0.002) ex.lastType = t
        if (chartA > 0.002 && ex.firstChart == null) ex.firstChart = t
        if (typeA > 0.002 && chartA > 0.002) ex.both++
        if (t === EXITW[EXITW.length - 1]) out.push({ name: `DECISIONS 229: the title, its kicker and lockup against the band, "A3" and "level", every frame from the exit (${A.EXIT.toFixed(2)}) to the cut: frames with both / the type's last frame / the chart's first`,
          got: `${ex.both} / ${ex.lastType == null ? '-' : ex.lastType.toFixed(3)} / ${ex.firstChart == null ? '-' : ex.firstChart.toFixed(3)}`, want: '0, the type gone first', pass: ex.both === 0 && ex.lastType != null && ex.firstChart != null && ex.lastType < ex.firstChart })
      }
      if (!FLIGHT.has(t)) return out
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
      if (t > A.D - 0.001) out.push({ name: 'F-01: the strip at 720 and "level" at 820 (s03 draws the same)', got: `${S.ch.G.strip} / ${S.lab.level.el.getAttribute('y')}`, want: '720 / 820' })
      if (t > A.D - 0.001) out.push({ name: 'last frame: bead centre and radius (s03 draws the same at its 0)', got: `${cx.toFixed(2)}, ${cy.toFixed(2)}, r ${r.toFixed(2)}`, want: 'see s03 t 0', pass: true },
        { name: 'DECISIONS 176: the chart\'s fade-up on the last frame (the band\'s group; s03\'s first frame draws the same)', got: +S.ch.g.querySelector('.band').getAttribute('opacity'), want: 'info', pass: true })
      if (FADE_T.includes(t)) out.push({ name: `DECISIONS 176: the chart's fade-up at ${t.toFixed(2)} (the critic's near-empty 2.73 to 3.0)`, got: +S.ch.g.querySelector('.band').getAttribute('opacity'), want: 'info', pass: true })
      return out
    },
  }
})()
