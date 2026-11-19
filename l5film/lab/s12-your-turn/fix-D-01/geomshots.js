async function measure({ seek, shot, sid }) {
  // isolated shots on black for the ring's bounds (DECISIONS 207, 208): each element alone, so geom.py measures the
  // pixel gaps between them and from the floor horizon (screen y 840)
  const S = window.__sceneProbe[sid], A = S.A
  const root = document.getElementById(sid + '-scene')
  document.documentElement.style.background = '#000'; document.body.style.background = '#000'
  const only = (els) => {
    root.style.visibility = 'hidden'
    for (const e of root.querySelectorAll('*')) e.style.visibility = ''
    for (const e of els) { e.style.visibility = 'visible'; for (const c of e.querySelectorAll ? e.querySelectorAll('*') : []) c.style.visibility = 'visible' }
  }
  const out = { times: {} }
  const go = async (name, t, sets) => {
    await seek(t)
    out.times[name] = t
    for (const [k, els] of Object.entries(sets)) { only(els); await shot(`geom-${name}-${k}.png`) }
    root.style.visibility = ''
  }
  const ringT = S.ring.g
  const breathMid = (A.BREATH0 + A.TICKIN) / 2
  // the breath's largest scale: sample the breath and find the time of the largest transform scale
  let best = { t: breathMid, s: 0 }
  for (let k = 0; k <= 200; k++) {
    const t = A.BREATH0 + (A.TICKIN - A.BREATH0) * k / 200
    await seek(t)
    const m = /scale\(([\d.]+)/.exec(ringT.querySelector('g').getAttribute('transform') || '')
    const s = m ? +m[1] : 1
    if (s > best.s) best = { t, s }
  }
  out.maxBreath = best
  await go('breath', best.t, { ring: [ringT], breathe: [S.breatheIn.el], nothing: [S.nothing.el] })
  // at rest on F-turn, mid-hold (the arc and its glow half round, the tick), and at the close's echo at its widest
  await go('hold', A.HOLD + 5.0, { ring: [ringT], nothing: [S.nothing.el] })
  await go('echo', A.HOLD_END + 0.3, { echo: [S.echo.g] })
  // at F0 with the phase row and its lines (the stop line landed, before the thinning)
  await go('f0', A.STOP + 0.5, { ring: [ringT], row: [S.rowG], line1: [S.rowLines[0].el], line2: [S.rowLines[1].el], nothing: [S.nothing.el] })
  const rc = ringT.querySelector('circle').getBoundingClientRect()
  out.ringF0 = { cx: (rc.left + rc.right) / 2, cy: (rc.top + rc.bottom) / 2, r: rc.width / 2 }
  await seek(A.HOLD + 5)
  const rh = ringT.querySelector('circle').getBoundingClientRect()
  out.ringFturn = { cx: (rh.left + rh.right) / 2, cy: (rh.top + rh.bottom) / 2, r: rh.width / 2 }
  const base = (el) => new DOMPoint(+el.getAttribute('x'), +el.getAttribute('y')).matrixTransform(el.getScreenCTM()).y
  const words = [...ringT.querySelectorAll('text')].filter((e) => e.textContent === 'Sing' || e.textContent === '5')
  out.inside = words.map((e) => ({ text: e.textContent, base: +base(e).toFixed(1), size: +(parseFloat(getComputedStyle(e).fontSize) * e.getScreenCTM().a).toFixed(1) }))
  return out
}
