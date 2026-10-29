// Lesson 4's shared helpers for the hosts and the counted events, promoted from the first two
// builder groups, which wrote them alike (s04-recall, s05-steps and s06-groups keep their own copies):
//
//   L.filmDust(layer, { n = 26, seed = 7 })
//       The near layer's dust motes (Lesson 2's filmDust). It returns draw(T), and T is FILM time
//       (L.scene(SID).start + t), so every scene that uses it meets the same motes at a cut.
//   L.light(t, times, up = 0.3, down = 0.4)
//       A counted 40 % chrome light, 0 to 1: linear up over `up` and back over `down`, the highest of
//       its times. Measured on a still F0 staircase (lab/s05-steps/pulse): it registers 0.7 s in
//       measure.py, where L.lit's own shape registers 0.4 to 0.6 s at 40 %. A larger light (up 0.4,
//       back 0.8 to 1.2) registers only on a big area: stair 4 or 8 at F0, any stair in a close-up.
//   L.swap(t, t0, k, from, to)
//       STORYBOARD § Type's label switch: the old label slides up 12 px as it fades, the new one comes
//       in from 12 px below, over 0.25 s, staggered 0.05 s (k = 0 for the first). Returns two layers,
//       [{ text, a, dy }, { text, a, dy }].
//   L.mercGate(layer, { sid, pass, tag, x, feetY = 840, size = 300, feet = 0.8, hop = null,
//                       hopDx = 360, mirror = false, floor = true, fade = 18 })
//       A Merc pass placed in screen space (pass `layer` = room.top) for PRODUCTION-PIPELINE trap 23.
//       A drop comes in through the top of its square, so the box and its reflection stay at 0 until
//       the pass's first whole frame (L.MERC_WHOLE, written by tools/merc-whole.py) plus one, because
//       HyperFrames 0.8.97 can show the frame before the one a tag's times name; then the box fades in
//       over `fade` frames while the scene eases it down its last 60 px (0.4 s, power2.out), so the
//       entrance still reads as a fall. A pass that starts whole (L.MERC_WHOLE 0) shows at once, with
//       no ease. `hop` is the scene time a hop out starts: the renderer's hop lands inside its square,
//       so the box is carried `hopDx` px through the hop's time in the air (from hop + 0.15 over
//       0.42 s, power1.in): +360 out to the right, -360 out to the left. `mirror` flips a pass rendered
//       facing left (DECISIONS 74). `floor` lays a local floor patch under the corner for an F0 scene
//       with no room floor. `tag` is the static video's id (its reflection is tag + '-refl').
//       Returns draw(t): the body box on screen (for rows.keep.boxes), or null while he is unseen.
//   L.MERC_WHOLE
//       { pass: first whole frame of its drop, or 0 for a pass that starts whole }, from
//       assets/merc/whole.js. A pass missing from it gets 30 (m06a's) and a console warning.
;(function () {
  const L = (window.L = window.L || {})
  const f1 = (v) => (Math.round(v * 100) / 100).toString()

  L.filmDust = (layer, { n = 26, seed = 7 } = {}) => {
    const svg = L.stage(layer)
    const r = L.rng(seed)
    const motes = []
    for (let i = 0; i < n; i++) {
      const m = { x: r() * 1920, y: r() * 1080, s: 0.8 + r() * 2.2, vx: (r() - 0.5) * 14, vy: -4 - r() * 10, ph: r() * 6.28 }
      m.el = L.svg('circle', { r: m.s, fill: 'rgba(195,204,214,0.5)', opacity: 0 }, svg)
      motes.push(m)
    }
    return (T) => {
      for (const m of motes) {
        m.el.setAttribute('cx', (((m.x + m.vx * T) % 1960 + 1960) % 1960 - 20).toFixed(1))
        m.el.setAttribute('cy', (((m.y + m.vy * T) % 1120 + 1120) % 1120 - 20).toFixed(1))
        m.el.setAttribute('opacity', (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(m.ph + T * 0.9))).toFixed(3))
      }
    }
  }

  L.light = (t, times, up = 0.3, down = 0.4) => {
    let k = 0
    for (const t0 of [].concat(times)) k = Math.max(k, L.prog(t, t0, up, 'none') * (1 - L.prog(t, t0 + up, down, 'none')))
    return k
  }

  L.swap = (t, t0, k, from, to) => {
    const u = L.prog(t, t0 + 0.05 * k, 0.25, 'power2.inOut')
    return [{ text: from, a: 1 - u, dy: -12 * u }, { text: to, a: u, dy: 12 * (1 - u) }]
  }

  L.MERC_WHOLE = window.MERC_WHOLE || {}

  L.mercGate = (layer, { sid, pass, tag, x, feetY = 840, size = 300, feet = 0.8, hop = null, hopDx = 360, mirror = false, floor = true, fade = 18 } = {}) => {
    const P = L.prog
    const S0 = L.scene(sid).start
    const wrap = L.el('div', { class: 'clip', style: 'pointer-events:none' }, layer)
    // the floor patch fades toward the frame's middle, so it reads as the floor under his corner only
    const toMid = x > 960 ? '90deg' : '270deg'
    const patch = floor
      ? L.el('div', { style: `position:absolute;left:${x - 110}px;width:230px;top:${feetY}px;height:240px;opacity:0;background:linear-gradient(180deg, rgba(120,150,190,0.10), rgba(13,17,23,0) 40%);border-top:1px solid rgba(195,204,214,0.10);-webkit-mask-image:linear-gradient(${toMid}, transparent, #000 45%);mask-image:linear-gradient(${toMid}, transparent, #000 45%)` }, wrap)
      : null
    const vid = document.getElementById(tag)
    if (!vid) { console.error(`[L.mercGate ${sid}] no Merc tag #${tag}`); return () => null }
    const m = L.merc(wrap, { pass, x, feetY, size, feet, id: tag + '-box', video: tag, reflVideo: tag + '-refl' })
    m.box.setAttribute('data-layout-allow-overflow', '')
    m.box.style.opacity = '0'
    // the film frame of pass frame 0, from the static tag (merc-tags.py: the media start is half a frame
    // past the tag's first pass frame, which plays on film frame n0)
    const ds = parseFloat(vid.getAttribute('data-start')), ms = parseFloat(vid.getAttribute('data-media-start'))
    const dd = parseFloat(vid.getAttribute('data-duration'))
    if (!(dd > 0)) return () => null
    const n0 = Math.ceil((S0 + ds) * 60 - 1e-6), P0 = n0 - Math.round(ms * 60 - 0.5)
    let first = L.MERC_WHOLE[pass]
    if (first == null) { console.warn(`[L.mercGate ${sid}] ${pass}: no first whole frame in assets/merc/whole.js; using 30 (run tools/merc-whole.py)`); first = 30 }
    const drops = first > 0
    const whole = drops ? first + 1 : 0
    const tWhole = (P0 + whole) / 60 - S0
    const flip = mirror ? ' scaleX(-1)' : ''
    return (t) => {
      const j = Math.floor((S0 + t) * 60 + 1e-6) - P0          // the pass frame on screen now
      const inSpan = t >= ds && t <= ds + dd
      const shown = !inSpan || j < whole ? 0 : drops ? L.ease('sine.out')(Math.min(1, (j - whole + 1) / fade)) : 1
      const dy = drops ? -60 * (1 - P(t, tWhole, 0.4, 'power2.out')) : 0
      const dx = hop == null ? 0 : hopDx * P(t, hop + 0.15, 0.42, 'power1.in')
      m.box.style.opacity = shown.toFixed(3)
      m.box.style.transform = `translate(${f1(dx)}px, ${f1(dy)}px)${flip}`
      if (patch) patch.style.opacity = (shown * (hop == null ? 1 : 1 - P(t, hop + 0.15, 0.4))).toFixed(3)
      return shown > 0.004 && Math.abs(dx) < 220 ? L.mercBox(x + dx, feetY + dy, size) : null
    }
  }
})()
