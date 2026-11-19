async function measure({ seek, shot, sid }) {
  // the dimmed feel block (DECISIONS 231): each text of it shot on the full frame and again hidden, at times while it is
  // dimmed, so contrast.py reads the glyphs' own colour against the ground behind them
  const S = window.__sceneProbe[sid], A = S.A
  const els = { question: S.question.el, line1: S.feelLines[0].el, line2: S.feelLines[1].el, line3: S.feelLines[2].el, cap1: S.caps[0].el, cap4: S.caps[3].el }
  const out = {}
  for (const t of (window.__TIMES || [64.72, 70.0])) {
    await seek(t)
    await shot(`c-${t.toFixed(2)}-with.png`)
    for (const e of Object.values(els)) e.style.visibility = 'hidden'
    await shot(`c-${t.toFixed(2)}-without.png`)
    for (const e of Object.values(els)) e.style.visibility = ''
    out[t] = Object.fromEntries(Object.entries(els).map(([k, e]) => { const r = e.getBoundingClientRect(); return [k, [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v))] }))
  }
  return out
}
