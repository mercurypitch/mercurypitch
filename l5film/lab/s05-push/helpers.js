// Shared by group A's checks files (lab/s0N-*/checks.js), loaded by lab/s01-cold-open/probe.mjs before them.
;(function () {
  const H = (window.__H = {})
  H.R = (el) => el.getBoundingClientRect()
  // an element's opacity through its ancestors (SVG attribute and CSS), 0 when any is display: none
  H.alpha = (el) => {
    let a = 1
    for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || e.getAttribute('display') === 'none') return 0
      a *= parseFloat(cs.opacity || '1')
      if (e.hasAttribute && e.hasAttribute('opacity')) a *= parseFloat(e.getAttribute('opacity'))
    }
    return a
  }
  // the gap between two rects (0 when they overlap)
  H.gap = (a, b) => {
    const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right))
    const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom))
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy)
  }
  // every visible text (or tag) in a root, as { text, r }
  H.texts = (root, min = 0.3) => [...root.querySelectorAll('text')].filter((e) => H.alpha(e) >= min && e.textContent.trim()).map((e) => ({ text: e.textContent.trim().slice(0, 40), r: H.R(e) }))
  // the keep-out (HANDOFFS § Shared formulas): every visible text in the scene 20 px or more from each host's body box
  H.keepout = (root, boxes) => {
    const out = []
    for (const [who, b] of Object.entries(boxes || {})) {
      if (!b) continue
      const hb = { left: b.x0, right: b.x1, top: b.y0, bottom: b.y1 }
      let worst = Infinity, what = ''
      for (const tx of H.texts(root)) { const g = H.gap(tx.r, hb); if (g < worst) { worst = g; what = tx.text } }
      out.push({ name: `keep-out: nearest visible text to ${who}'s body box ("${what}")`, got: worst, want: '>= 20', pass: worst >= 20 })
    }
    return out
  }
  // ink extents of a string in a font (canvas metrics), relative to its baseline and anchor x
  const cv = document.createElement('canvas').getContext('2d')
  H.ink = (text, font, anchor = 'start') => {
    cv.font = font
    const m = cv.measureText(text)
    const x0 = anchor === 'middle' ? -m.width / 2 : anchor === 'end' ? -m.width : 0
    return { l: x0 - m.actualBoundingBoxLeft, r: x0 + m.actualBoundingBoxRight, up: m.actualBoundingBoxAscent, down: m.actualBoundingBoxDescent, w: m.width }
  }
  H.dyOf = (el) => { const m = /translate\(\s*[-\d.]+[ ,]+([-\d.]+)/.exec(el.getAttribute('transform') || ''); return m ? +m[1] : 0 }
})()
