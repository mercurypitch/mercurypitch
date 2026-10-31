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
//                       hopDx = 360, mirror = false, floor = true, floorEdge = false, fade = 18, leap = false,
//                       leapDx = 300 })
//       A Merc pass placed in screen space (pass `layer` = room.top) for PRODUCTION-PIPELINE trap 23.
//       A drop comes in through the top of its square, so the box and its reflection stay at 0 until
//       the pass's first whole frame (L.MERC_WHOLE, written by tools/merc-whole.py) plus one, because
//       HyperFrames 0.8.97 can show the frame before the one a tag's times name; then the box fades in
//       over `fade` frames while the scene eases it down its last 60 px (0.4 s, power2.out), so the
//       entrance still reads as a fall. A pass that starts whole (L.MERC_WHOLE 0) shows at once, with
//       no ease. `leap` (DECISIONS 123) is for a pass that opens on the renderer's celebrate jump in
//       place (tools/merc-shots.py LEAP: crouch 0.15 s, then 0.43 s in the air): the box holds `leapDx`
//       px off its corner (+300 puts the whole box beyond the right edge) through the crouch and carries her in while she
//       is in the air, straight across, as a ballistic leap is, with LEAP_LIFT px of arc on top of the
//       renderer's own (about 28 px at size 300), so it reads as a leap and not a skim; the reflection
//       stays on the floor under her and the floor patch comes up as she lands. Every other pass
//       ignores it. `hop` is the scene time a hop out starts: the renderer's hop lands inside its square,
//       so the box is carried `hopDx` px through the hop's time in the air (from hop + 0.15 over
//       0.42 s, power1.in): +360 out to the right, -360 out to the left. `mirror` flips a pass rendered
//       facing left (DECISIONS 74). `floor` lays a local floor patch under the corner for an F0 scene
//       with no room floor; `floorEdge` runs its outer side on to the frame's edge, for a host standing
//       in from his corner (S12 and S13, DECISIONS 134). `tag` is the static video's id (its reflection
//       is tag + '-refl').
//       A pass with an intro (L.MERC_INTRO) enters differently (DECISIONS 81): its drop is seen whole.
//       Each intro segment is its own box: a tall render of the drop, whose middle square lands on
//       the pass's own pixels and whose column above shows the fall, and for a pass under a head the
//       head itself. Each plays from its `from` film frame to its `until`, the first fading in over
//       its first 6 frames; the pass then shows at once from the last `until`, with no fade and no
//       ease. The first segment falls from above the frame (DECISIONS 86): its box is lifted at the
//       fall's first frame until the body's foot is above the frame's top, and the lift runs out as
//       D (1 - (j / 33)^2) at the renderer's contact, frame 33, so the fall stays one parabola; the
//       landing light the renderer draws under the corner from frame 0 is masked off below the
//       body's glow while the box is lifted, so it lights only as he lands, and the segment's
//       reflection is lowered by the same lift. merc-tags.py writes the segments' tags,
//       tag + '-seg1', tag + '-seg1-refl' and so on, into every scene they meet.
//       Returns draw(t): the body box on screen (for rows.keep.boxes), or null while he is unseen.
//   L.MERC_WHOLE
//       { pass: first whole frame of its drop, or 0 for a pass that starts whole }, from
//       assets/merc/whole.js. A pass missing from it gets 30 (m06a's) and a console warning.
//   L.MERC_INTRO
//       { pass: [{ shot, tall, from, until, frames, drawn, pad }] }, from assets/merc/intro.js
//       (tools/merc-shots.py): the videos that play before each drop pass, in film frames.
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
  L.MERC_INTRO = window.MERC_INTRO || {}
  const INTRO_FADE = 6   // frames: the first segment's fade in, where the fall starts
  // the leap in (DECISIONS 123): the renderer's celebrate jump (CEL in src/lib/merc/sim-choreo.ts)
  const LEAP_CROUCH = 0.15, LEAP_AIR = 0.43, LEAP_LIFT = 70
  const FALL_N = 33      // frames: the renderer's fall (DROP_T, 0.55 s at 60 fps), contact on the 33rd
  // Per drawn size, measured on every tall render (each size's talls agree to 2 rows): the body's
  // lowest drawn row at frame 0 and at frame 33, between which it follows the fall's parabola to a
  // row up to frame 31; its lowest row at frame 32, where it stretches 8 to 10 rows past the
  // parabola; the first row of the landing light under the corner; and the glow under the body
  const FALL = { 225: { b0: 201, b33: 391, b32: 388, pool: 350, halo: 16 }, 390: { b0: 352, b33: 671, b32: 664, pool: 605, halo: 20 } }

  // One intro segment's two boxes in `parent`, placed so the render's own square sits on the pass's
  // square (left x - size / 2, top feetY - size * feet): a tall render's padding goes above and below
  // it, and the box shows the column from the padding's top to the square's foot. Its reflection is
  // L.merc's, from the same square only.
  const segBoxes = (parent, { x, feetY, size, feet, seg, video, refl }) => {
    const top = feetY - size * feet
    const k = size / (seg.drawn || size)                   // screen px per drawn px
    const pad = seg.tall ? seg.pad * k : 0
    // each video sits in its own layer, which the long fall lifts and masks
    const fit = (v, box, y) => {
      v.muted = true
      const layer = L.el('div', {}, box)
      layer.setAttribute('data-layout-allow-overflow', '')
      Object.assign(layer.style, { position: 'absolute', left: '0', top: y + 'px', width: size + 'px', height: size + 2 * pad + 'px' })
      Object.assign(v.style, { position: 'absolute', left: '0', top: '0', width: size + 'px', height: size + 2 * pad + 'px' })
      layer.appendChild(v)
      return layer
    }
    const box = L.el('div', { class: 'merc' }, parent)
    Object.assign(box.style, { position: 'absolute', left: x - size / 2 + 'px', top: top - pad + 'px', width: size + 'px', height: pad + size + 'px', overflow: 'hidden', opacity: '0' })
    box.setAttribute('data-layout-allow-overflow', '')
    // the video's top sits at the box's top: no padding to skip above
    const layer = fit(video, box, 0)
    let rbox = null, rlayer = null
    if (refl) {
      rbox = L.el('div', { class: 'refl-box' }, parent)
      Object.assign(rbox.style, {
        position: 'absolute', left: x - size / 2 + 'px', top: feetY + size * feet - size + 'px', width: size + 'px', height: size + 'px',
        overflow: 'hidden', transform: 'scaleY(-1)', opacity: '0', filter: 'blur(3px)',
        webkitMaskImage: 'linear-gradient(0deg, #000 28%, transparent 60%)', maskImage: 'linear-gradient(0deg, #000 28%, transparent 60%)',
      })
      rbox.setAttribute('data-layout-allow-overflow', '')
      rlayer = fit(refl, rbox, -pad)
    }
    return { box, rbox, layer, rlayer, k, lift0: top - pad }
  }

  // The first tall segment's long fall (DECISIONS 86): fall(j, flip) places it for the tall's frame j.
  // While the box is lifted, its layers keep everything above the landing light's first row, and
  // below it only a window over the body (its glow and the light right under it, which ride with
  // him), so the light lands with him rather than riding in the air beside his feet.
  const longFall = (seg, b) => {
    const G = FALL[seg.drawn]
    if (!seg.tall || !G) return null
    const { k } = b, d = seg.drawn
    const D = b.lift0 + (G.b0 + G.halo) * k + 8   // puts his foot and its glow 8 px above the frame at frame 0
    const x0 = (0.5 - 0.31) * d * k, x1 = (0.5 + 0.31) * d * k, top = G.pool * k
    const set = (l, image, comp) => {
      if (!l) return
      l.style.webkitMaskImage = image
      l.style.maskImage = image
      l.style.maskComposite = comp
    }
    return (j, flip) => {
      const u = j >= 0 && j < FALL_N ? j / FALL_N : 1
      const lift = D * (1 - u * u)
      b.box.style.transform = `translate(0px, ${f1(-lift)}px)${flip}`
      if (b.rlayer) b.rlayer.style.transform = `translate(0px, ${f1(-lift)}px)`
      if (u >= 1) { for (const l of [b.layer, b.rlayer]) set(l, 'none', 'add'); return }
      const foot = (j === FALL_N - 1 ? G.b32 : G.b0 + (G.b33 - G.b0) * u * u) + G.halo
      const image = [
        `linear-gradient(180deg, #000 ${f1(top - 3)}px, transparent ${f1(top + 3)}px)`,
        `linear-gradient(90deg, transparent ${f1(x0)}px, #000 ${f1(x0 + 8)}px, #000 ${f1(x1 - 8)}px, transparent ${f1(x1)}px)`,
        `linear-gradient(180deg, #000 ${f1(foot * k - 3)}px, transparent ${f1(foot * k + 3)}px)`,
      ].join(', ')
      for (const l of [b.layer, b.rlayer]) set(l, image, 'add, intersect, add')
    }
  }

  L.mercGate = (layer, { sid, pass, tag, x, feetY = 840, size = 300, feet = 0.8, hop = null, hopDx = 360, mirror = false, floor = true, floorEdge = false, fade = 18, leap = false, leapDx = 300 } = {}) => {
    const P = L.prog
    const S0 = L.scene(sid).start
    const wrap = L.el('div', { class: 'clip', style: 'pointer-events:none' }, layer)
    // the floor patch fades toward the frame's middle, so it reads as the floor under his corner only
    const toMid = x > 960 ? '90deg' : '270deg'
    // `floorEdge` (film round 3): a host standing in from his corner (S12 and S13 put them at 240 and 1700)
    // left the patch's outer edge inside the frame, a hard step of 4 to 11 levels. It runs on to the frame's
    // edge instead, its fade toward the middle the same 103.5 px (45 % of 230); off, the patch is as it was.
    const pl = floorEdge && x <= 960 ? 0 : x - 110
    const pw = floorEdge ? (x > 960 ? 2030 - x : x + 120) : 230
    const fadeTo = floorEdge ? '103.5px' : '45%'
    const patch = floor
      ? L.el('div', { style: `position:absolute;left:${pl}px;width:${pw}px;top:${feetY}px;height:240px;opacity:0;background:linear-gradient(180deg, rgba(120,150,190,0.10), rgba(13,17,23,0) 40%);border-top:1px solid rgba(195,204,214,0.10);-webkit-mask-image:linear-gradient(${toMid}, transparent, #000 ${fadeTo});mask-image:linear-gradient(${toMid}, transparent, #000 ${fadeTo})` }, wrap)
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
    // a drop seen whole (DECISIONS 81): the intro's segments, those whose tags this scene holds
    const intro = L.MERC_INTRO[pass] || []
    const segs = intro.map((seg, i) => {
      const v = document.getElementById(`${tag}-seg${i + 1}`)
      if (!v) return null
      const b = segBoxes(wrap, { x, feetY, size, feet, seg, video: v, refl: document.getElementById(`${tag}-seg${i + 1}-refl`) })
      if (mirror) { b.box.style.transform = 'scaleX(-1)'; if (b.rbox) b.rbox.style.transform = 'scaleY(-1) scaleX(-1)' }
      return { ...seg, ...b, fall: i === 0 ? longFall(seg, b) : null }
    })
    if (intro.length) {
      const from = intro[0].from, until = intro[intro.length - 1].until
      return (t) => {
        const n = Math.floor((S0 + t) * 60 + 1e-6)              // the film frame on screen now
        let any = 0
        segs.forEach((sg, i) => {
          if (!sg) return
          const a = n >= sg.from && n < sg.until ? (i === 0 ? L.ease('power1.out')(Math.min(1, (n - sg.from + 1) / INTRO_FADE)) : 1) : 0
          sg.box.style.opacity = a.toFixed(3)
          if (sg.rbox) sg.rbox.style.opacity = (0.16 * a).toFixed(3)
          if (sg.fall) sg.fall(n - sg.from, flip)
          any = Math.max(any, a)
        })
        const inSpan = t >= ds && t <= ds + dd
        const shown = inSpan && n >= until ? 1 : 0
        const dx = hop == null ? 0 : hopDx * P(t, hop + 0.15, 0.42, 'power1.in')
        m.box.style.opacity = shown.toFixed(3)
        m.box.style.transform = `translate(${f1(dx)}px, 0px)${flip}`
        const seen = Math.max(any, shown)
        // `floorEdge` (film round 4): the patch runs on to the frame's edge, where no host covers it, so
        // it comes up with the long fall, by how far down he has come (u squared), full on the landing frame
        const s0 = segs[0]
        const land = floorEdge && s0 && s0.fall ? Math.min(1, Math.max(0, (n - s0.from) / FALL_N)) ** 2 : 1
        if (patch) patch.style.opacity = (n >= from ? seen * land * (hop == null ? 1 : 1 - P(t, hop + 0.15, 0.4)) : 0).toFixed(3)
        return seen > 0.004 && Math.abs(dx) < 220 ? L.mercBox(x + dx, feetY, size) : null
      }
    }
    return (t) => {
      const j = Math.floor((S0 + t) * 60 + 1e-6) - P0          // the pass frame on screen now
      const inSpan = t >= ds && t <= ds + dd
      const shown = !inSpan || j < whole ? 0 : drops ? L.ease('sine.out')(Math.min(1, (j - whole + 1) / fade)) : 1
      // the leap in: how far through her time in the air she is (0 until the crouch ends)
      const u = leap ? Math.min(1, Math.max(0, (j / 60 - LEAP_CROUCH) / LEAP_AIR)) : 1
      const lift = leap ? LEAP_LIFT * 4 * u * (1 - u) : 0
      const dy = (drops ? -60 * (1 - P(t, tWhole, 0.4, 'power2.out')) : 0) - lift
      const dx = (hop == null ? 0 : hopDx * P(t, hop + 0.15, 0.42, 'power1.in')) + (leap ? leapDx * (1 - u) : 0)
      m.box.style.opacity = shown.toFixed(3)
      m.box.style.transform = `translate(${f1(dx)}px, ${f1(dy)}px)${flip}`
      // the reflection rides inside the box: while she is lifted it is lowered twice the lift, so it
      // stays a mirror image about the floor line
      if (leap && m.refl) m.refl.style.transform = `translate(0px, ${f1(2 * lift)}px) scaleY(-1)`
      if (patch) patch.style.opacity = (shown * u * (hop == null ? 1 : 1 - P(t, hop + 0.15, 0.4))).toFixed(3)
      return shown > 0.004 && Math.abs(dx) < 220 ? L.mercBox(x + dx, feetY + dy, size) : null
    }
  }
})()
