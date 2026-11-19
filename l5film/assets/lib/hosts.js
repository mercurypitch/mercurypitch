/* Find Your Pitch, Lesson 5 kit: the hosts. window.L, after motion.js. Lesson 4's hosts.js adapted to
   this film's three performances (merc/PASSES.md; HANDOFFS § Shared formulas, Hosts, Entrances and
   moves): one continuous pass a host, cut into one chunk a scene, placed in screen space (room.top),
   so no camera move shifts or scales them. No host drops in this film, so Lesson 4's trap-23 gate and
   its intros are gone; the passes start whole.

     L.HOSTS            the places (HANDOFFS § Shared formulas): cold, corners, small, mercRight, end,
                        each { merc: { x, feetY, size }, tavi: { ... } }; FEET 0.836 (PASSES.md, measured: the
                        nearer sole's row, the same for both hosts); BODY { w: 0.53, h: 0.64 }
     L.mercBox(x, feetY, size)   a host's body box { x0, x1, y0, y1 } (0.53 of the size wide, 0.64 tall,
                        on its feet point): the keep-out is this box grown by 20 px
     L.merc(parent, { pass, x, feetY = 840, size, base = size, feet = 0.836, video, reflVideo, id,
                      mirror = by pass, refl = 0.16 }) -> { box, inner, reflBox, place(o) }
                        adopts the static tags (trap 4: `video` and `reflVideo` are their ids) into a
                        square box of side `base` whose feet point is (x, feetY): left x - base/2,
                        top feetY - feet base, scaled about the feet (transform-origin 50% 82.9%), so a
                        size change in place keeps the feet on the floor. The reflection is the same
                        frame flipped about the sole line, at 16 %, blurred 3 px and fading away from
                        the floor. `mirror` (by default: true for Tavi's orange passes, false for Merc's
                        blue ones, L.mercMirror(pass)) shows the pass with scaleX(-1) about the box's centre line
                        (Tavi, DECISIONS 130). A missing tag is reported in the console (trap 24).
                        place({ x, feetY, size, dy, lift, a }) moves it: the box's feet to (x, feetY + dy),
                        drawn at `size`, the reflection held on the floor while `lift` raises the body
     L.mercGate(layer, opts) -> draw(t) -> the body box on screen, or null while unseen
        sid | start     the scene id (its film start, for a pass's time) or a film start (a kit lab)
        pass, tag       the pass id ('m-blue') and its static tag's id; the reflection is tag + '-refl'
        x, feetY = 840, size = 300, feet = 0.836, mirror = by pass, refl = 0.16
        base            the box's own size: the largest size the scene shows the host at (a chunk is
                        rendered at that size: never scaled up), by default the largest in `moves`
        moves           [{ at, dur, x, size, ease = 'power2.inOut' }] in scene time, in time order; x and
                        size tween from the values before (a size change in place: 0.6 to 0.8 s,
                        power2.inOut; a hop's carry through the air: power1.in; S1h's slide out:
                        x +-360 over 0.6 s, power2.in)
        leap            { at, from: 'left' | 'right', dx = 300, lift = 70 }: the renderer's celebrate
                        leap in (crouch 0.15 s, 0.43 s in the air) from `at`, the celebrate's start in
                        scene time; the box holds `dx` px beyond the frame's edge through the crouch
                        and is carried straight in while the host is in the air, with `lift` px of arc
                        on top of the renderer's own; the reflection stays on the floor
        root            by default window.MERC_ROOTS['<pass>-sNN'] (assets/merc/roots.js, from sid) when it
                        exists; else { frames: [[x, y], ...], t0, fps = 30 }: the chunk's renderer root (its sidecar's
                        `root`, `t0` the film time of frames[0]); its x is cancelled (0.4353 x size px
                        a world unit, PASSES.md), so a carried hop lands exactly where the scene puts it
        glow            { rgb: '88,166,255', a = 1 } a soft key glow behind the host (S1)
        floor           ignored: the floor is the room's, full width (room.setFloor); no local patch
     L.HOP              { crouch: 0.12, air: 0.41 } Merc's hop (PASSES.md: air from 0.12 s after the hop's
                        start, for 0.41 s) and L.LEAP { crouch: 0.15, air: 0.43 }
*/
;(function () {
  const L = window.L
  const f2 = L.f2
  // the passes' feet line, measured (merc/PASSES.md: the median nearer sole over 150 frames, 0.831 to 0.837);
  // 0.829, the first estimate, put the soles 2 to 3 px under y 840
  const FEET = 0.836
  // Tavi's passes (orange) are mirrored in the scenes, Merc's (blue) never: his hops go right (PASSES.md)
  const mirrorOf = (pass) => /orange/.test(String(pass))
  // the chunk's renderer root from assets/merc/roots.js (window.MERC_ROOTS, keyed <pass>-sNN), when it exists
  const rootOf = (pass, sid) => (sid && window.MERC_ROOTS ? window.MERC_ROOTS[`${pass}-${String(sid).slice(0, 3)}`] || null : null)
  L.mercMirror = mirrorOf
  L.HOSTS = {
    FEET,
    BODY: { w: 0.53, h: 0.64 },
    cold: { merc: { x: 230, feetY: 840, size: 420 }, tavi: { x: 1690, feetY: 840, size: 420 } },
    corners: { merc: { x: 110, feetY: 840, size: 300 }, tavi: { x: 1800, feetY: 840, size: 300 } },
    small: { merc: { x: 100, feetY: 840, size: 240 }, tavi: { x: 1820, feetY: 840, size: 240 } },
    mercRight: { merc: { x: 1290, feetY: 840, size: 300 }, tavi: { x: 1800, feetY: 840, size: 300 } },
    end: { merc: { x: 1290, feetY: 840, size: 400 }, tavi: { x: 1610, feetY: 840, size: 400 } },
    GLOW: { merc: '88,166,255', tavi: '255,116,72' },
  }
  L.HOP = { crouch: 0.12, air: 0.41 }
  L.LEAP = { crouch: 0.15, air: 0.43 }
  L.ROOT_PX = 0.4353          // screen px a renderer world unit, per px of shown size (PASSES.md)

  L.mercBox = (x, feetY, size) => ({ x0: x - 0.265 * size, x1: x + 0.265 * size, y0: feetY - 0.64 * size, y1: feetY })

  L.merc = (parent, { pass = '', x = 0, feetY = 840, size = 300, base = null, feet = FEET, video = null, reflVideo = null, id = null, mirror = mirrorOf(pass), refl = 0.16 } = {}) => {
    const B = base || size
    const box = L.el('div', { class: 'merc', id: id || undefined, 'data-layout-allow-overflow': '', 'data-merc-box': pass }, parent)
    Object.assign(box.style, { position: 'absolute', left: f2(x - B / 2) + 'px', top: f2(feetY - feet * B) + 'px', width: B + 'px', height: B + 'px', transformOrigin: `50% ${(feet * 100).toFixed(2)}%`, overflow: 'visible' })
    const inner = L.el('div', { 'data-layout-allow-overflow': '' }, box)
    Object.assign(inner.style, { position: 'absolute', left: '0', top: '0', width: B + 'px', height: B + 'px', overflow: 'visible', transform: mirror ? 'scaleX(-1)' : 'none' })
    const fit = (v) => {
      v.muted = true
      Object.assign(v.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', display: 'block' })
    }
    // the reflection first, under the body
    const reflBox = L.el('div', { class: 'refl-box', 'data-layout-allow-overflow': '' }, inner)
    Object.assign(reflBox.style, {
      position: 'absolute', left: '0', top: f2((2 * feet - 1) * B) + 'px', width: B + 'px', height: B + 'px', overflow: 'hidden',
      transform: 'scaleY(-1)', opacity: String(refl), filter: 'blur(3px)',
      webkitMaskImage: 'linear-gradient(0deg, #000 30%, transparent 62%)', maskImage: 'linear-gradient(0deg, #000 30%, transparent 62%)',
    })
    const body = L.el('div', { class: 'merc-body', 'data-layout-allow-overflow': '' }, inner)
    Object.assign(body.style, { position: 'absolute', left: '0', top: '0', width: B + 'px', height: B + 'px' })
    const v = video ? document.getElementById(video) : null
    const rv = reflVideo ? document.getElementById(reflVideo) : null
    if (video && !v) console.error(`[L.merc] no Merc tag #${video} (pass ${pass})`)
    if (reflVideo && !rv) console.error(`[L.merc] no reflection tag #${reflVideo} (pass ${pass})`)
    if (v) { fit(v); body.appendChild(v) }
    if (rv) { fit(rv); reflBox.appendChild(rv) }
    const M = {
      box, inner, body, reflBox, base: B, feet, x0: x, feetY0: feetY,
      place({ x: X = x, feetY: FY = feetY, size: S = B, dy = 0, lift = 0, a = 1 } = {}) {
        const k = S / B
        box.style.transform = `translate(${f2(X - x)}px, ${f2(FY - feetY + dy - lift)}px) scale(${k.toFixed(5)})`
        box.style.opacity = L.clamp(a).toFixed(3)
        // the reflection stays a mirror image about the floor: lowered twice the lift, in box pixels
        reflBox.style.transform = lift ? `translate(0px, ${f2((2 * lift) / k)}px) scaleY(-1)` : 'scaleY(-1)'
      },
    }
    return M
  }

  L.mercGate = (layer, { sid = null, start = null, pass = '', tag = '', x = 0, feetY = 840, size = 300, base = null, feet = FEET, mirror = mirrorOf(pass), refl = 0.16, moves = [], leap = null, root = rootOf(pass, sid), glow = null, floor = false } = {}) => {
    const S0 = start != null ? start : L.scene(sid).start
    if (floor) console.warn(`[L.mercGate ${sid || start}] floor patches are gone: the floor is the room's (room.setFloor)`)
    const wrap = L.el('div', { class: 'clip host', 'data-layout-allow-overflow': '', style: 'pointer-events:none' }, layer)
    Object.assign(wrap.style, { position: 'absolute', left: '0', top: '0', width: '1920px', height: '1080px' })
    const vid = document.getElementById(tag)
    if (!vid) { console.error(`[L.mercGate ${sid || start}] no Merc tag #${tag}`); return () => null }
    const B = base || Math.max(size, ...moves.filter((m) => m.size != null).map((m) => m.size))
    let glowEl = null
    if (glow) {
      glowEl = L.el('div', { 'data-layout-allow-overflow': '' }, wrap)
      const R = 0.731 * B
      Object.assign(glowEl.style, { position: 'absolute', left: f2(x - R) + 'px', top: f2(feetY - 0.269 * B - R) + 'px', width: f2(2 * R) + 'px', height: f2(2 * R) + 'px', borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${glow.rgb},0.22), rgba(${glow.rgb},0.07) 55%, rgba(${glow.rgb},0) 100%)`, transformOrigin: `50% ${f2(((0.269 * B + R) / (2 * R)) * 100)}%`, opacity: '0' })
    }
    const m = L.merc(wrap, { pass, x, feetY, size, base: B, feet, mirror, refl, id: tag + '-box', video: tag, reflVideo: tag + '-refl' })
    m.box.style.opacity = '0'
    const ds = parseFloat(vid.getAttribute('data-start')), dd = parseFloat(vid.getAttribute('data-duration'))
    const timed = ds >= 0 && dd > 0
    if (!timed) console.warn(`[L.mercGate ${sid || start}] #${tag} has no timing yet (run tools/merc-tags.py)`)
    const sizeMoves = moves.filter((mv) => mv.size != null).map((mv) => ({ at: mv.at, dur: mv.dur, to: mv.size, ease: mv.ease || 'power2.inOut' }))
    const xMoves = moves.filter((mv) => mv.x != null).map((mv) => ({ at: mv.at, dur: mv.dur, to: mv.x, ease: mv.ease || 'power2.inOut' }))
    return (t) => {
      const inSpan = timed && t >= ds - 1e-6 && t <= ds + dd + 1e-6
      const S = L.track(t, size, sizeMoves)
      let X = L.track(t, x, xMoves)
      let lift = 0
      if (leap) {
        const u = L.clamp((t - leap.at - L.LEAP.crouch) / L.LEAP.air)
        const dx = (leap.dx ?? 300) * (leap.from === 'left' ? -1 : 1)
        X += dx * (1 - u)
        lift = (leap.lift ?? 70) * 4 * u * (1 - u)
      }
      if (root && root.frames && root.frames.length) {
        const i = Math.floor((S0 + t - root.t0) * (root.fps || 30) + 1e-6)
        const fr = root.frames[Math.max(0, Math.min(root.frames.length - 1, i))]
        if (i >= 0 && fr) X -= (mirror ? -1 : 1) * fr[0] * L.ROOT_PX * S
      }
      const a = inSpan ? 1 : 0
      m.place({ x: X, feetY, size: S, lift, a })
      if (glowEl) {
        glowEl.style.opacity = (a * (glow.a ?? 1)).toFixed(3)
        glowEl.style.transform = `translate(${f2(X - x)}px, 0px) scale(${(S / B).toFixed(5)})`
      }
      return a > 0 ? L.mercBox(X, feetY - lift, S) : null
    }
  }
})()
