// Test harness only (never in the film): wraps L.mercGate so the blue host's draw(t) also paints, at the
// frame's top left, four 32-bit rows of 12 px cells (white = 1): n = round((t - ds) F), the rest
// ((t - ds) F - n) in 1e-9 frames, the pass frame the old reading took, floor((t - ds + ms) x 30 + 1e-6),
// the kit's L.passFrame (-1 when the kit has none), and the centre x of the box the gate returns (the box
// placed less the root it cancels), x 100. F is the render's fps.
;(function () {
  const L = window.L, orig = L.mercGate
  const box = document.createElement('div')
  Object.assign(box.style, { position: 'absolute', left: '0', top: '0', width: '384px', height: '60px', background: '#000', zIndex: '99999' })
  const cells = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 32; c++) {
    const d = document.createElement('div')
    Object.assign(d.style, { position: 'absolute', left: c * 12 + 'px', top: r * 12 + 'px', width: '12px', height: '12px', background: '#000' })
    box.appendChild(d); cells.push(d)
  }
  const put = (row, v) => { for (let c = 0; c < 32; c++) cells[row * 32 + c].style.background = (v >>> (31 - c)) & 1 ? '#fff' : '#000' }
  L.mercGate = (layer, opts) => {
    const draw = orig(layer, opts)
    if (!/blue/.test(opts.pass)) return draw
    const vid = document.getElementById(opts.tag)
    const ds = parseFloat(vid.getAttribute('data-start')), ms = parseFloat(vid.getAttribute('data-media-start'))
    return (t) => {
      const cfg = window.__HF_EXPORT_RENDER_SEEK_CONFIG, F = cfg ? Number(cfg.fps) : 30
      const x = (t - ds) * F, n = Math.round(x)
      put(0, n); put(1, Math.round((x - n) * 1e9) | 0)
      put(2, Math.floor((t - ds + ms) * 30 + 1e-6)); put(3, L.passFrame ? L.passFrame(t, ds, ms, 30) : -1)
      const b = draw(t)
      put(4, b ? Math.round(((b.x0 + b.x1) / 2) * 100) : -1)
      return b
    }
  }
  document.addEventListener('DOMContentLoaded', () => document.getElementById('root').appendChild(box))
})()
