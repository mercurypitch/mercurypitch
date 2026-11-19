// Find Your Pitch, Lesson 5 kit: the clock, the room and the small shared drawings. window.L.
// Load order: assets/lib/scripts.txt (GSAP, the cues and the scenes first).
//
// The clock part is step 1's, unchanged: cue and word times from assets/cues.js (window.CUES,
// written by tools/cues.py) and the scene table from assets/scenes.js (window.SCENES,
// tools/gen-root.py).
//
//   L.scene(sid)                         { start, end, title } on the film clock
//   L.dur(sid)                           the scene's length (its root data-duration)
//   L.at(sid, cue, edge, off)            scene time of a cue's 'start' (default) or 'end', plus off
//                                        seconds: at('b9'), at('b9', 'end', -0.2)
//   L.word(sid, line, which, edge, off)  scene time of a word in a line: which is an index (word 14),
//                                        a phrase from the line ('black key', its first word; 'end'
//                                        gives the phrase's last word's end), or a phrase with '#n'
//                                        for its n-th occurrence ('tone#2'). Case and punctuation
//                                        are ignored.
//   L.cue(cue, edge, off)                the same as L.at in FILM time (no scene): for a curve that
//                                        crosses a cut and is drawn from film time on both sides
//   L.clock(tl, D, draw)                 runs draw(t) on every seek of the scene's paused timeline,
//                                        t in scene seconds, 0 to D
//
// In a scene, every time is one of these, or 0 (the cut) or D (the scene's end): never a typed
// second (tools/clock-lint.py). A cue or phrase that does not exist throws, so a re-voice that
// drops a word fails loudly instead of drawing at the wrong time.
//
// The rest, rebuilt for Lesson 5 from Lesson 4's calls (its kit was lost with its project; what
// could not be known is chosen and recorded in DECISIONS 132 onward):
//
//   L.C                  the palette (STORYBOARD § Codes): ground ink ink2 chrome blue orange aqua gold
//                        amber violet mint, and brandViolet (the room's glow only)
//   L.FONT               the families: serif, outfit, inter, mono, music
//   L.clamp(x, a=0, b=1) L.lerp(a, b, u) L.smooth(e0, e1, x) (smoothstep)
//   L.ease(name)         GSAP's own curve as a function of 0..1 ('none' is linear)
//   L.easeOut(u)         power2.out          L.easeInOut(u)  power2.inOut
//   L.rng(seed)          a seeded generator (mulberry32): r() in [0, 1). Never Math.random.
//   L.afterFonts(fn)     runs fn now and again once the document's fonts are loaded (measure type)
//   L.el(tag, attrs, parent)    an HTML element; attrs.style may be a string or an object
//   L.svg(tag, attrs, parent)   an SVG element; attrs.text sets its text, attrs.href its href
//   L.stage(layer)       a new full-frame SVG (1920 x 1080, overflow visible) in a layer
//   L.stageOf(layer)     the layer's first SVG, made if it has none
//   L.f2(v)              a number with two decimals, for attributes
//
//   L.room(root, { floor = false, glows = true, staves = true, bokeh = true, vignette = true })
//       Lessons 1, 2 and 4's room in the scene's root div. Layers, back to front:
//         back     the ground and its three soft glows (blue top left, violet top right, aqua low
//                  left); screen space, never moved
//         far      the faint five-line staves (`room.staves`), the camera's far layer (k 0.25)
//         under    the soft chrome bokeh (`room.bokeh`), moved as the near layer (k 1.6) but under
//                  the diagram, so every mark covers it (Lesson 4 DECISIONS 100)
//         floorLayer the floor, y 840, full width (`room.floor`): screen space, with the hosts, never
//                  on a parting layer (HANDOFFS § Shared formulas, board v3 item 6)
//         mid      the world (k 1): drawings and world labels
//         near     the dust (k 1.6): draw it with L.filmDust from film time
//         top      screen space: the hosts (L.mercGate) and anything that must not move with the camera
//         vignette a soft darkening of the corners
//         hud      frame-fixed type: kickers, cards, pills, the care block (never scaled)
//       `floor` true shows the floor (whenever a host is on screen); room.setFloor(a) fades it.
//       L.frameRig moves far, under, mid and near and lifts the bokeh and staves while they slide.
//       Do not set the opacity of room.bokeh or room.staves (the rig does), nor hide room.near.
//   L.BOKEH_LIFT, L.STAVE_LIFT   how much brighter than at rest the bokeh (3) and staves (2.5) are
//                                drawn; at rest they show at 1 / LIFT (Lesson 4 DECISIONS 93)
//   L.filmDust(layer, { n = 200, seed = 7 }) -> draw(T)
//       the near layer's dust motes, T in FILM time (L.scene(SID).start + t), so every scene meets
//       the same motes at a cut; spread over x -900 to 2800, y -700 to 1400, so no framing from
//       F-hook (0.71) to F-bead (2.2) leaves an edge bare (26 motes a frame's area, Lesson 2's)
//   L.field(svg, id) -> { disc, draw({ x, y, r, a, T, soft, dither = 1 }) }
//       the full-frame chrome field of the cut into the title (HANDOFFS § The cuts, S1 to S2): chrome
//       over the ground at 75 % at the centre falling to 35 % at the corners (mean luma 113 to 122 with the
//       room's vignette hidden under it: fade room.vignette out as it fills the frame and back as it
//       shrinks, as Lesson 4's s02 did), breathing 2 % from film time T on two periods (1.3 s and
//       0.29 s, so no 0.2 s of it is still), with a fine grain stepped every frame (3.5 %, no banding); a smaller
//       r is the same field as a soft-edged disc (Lesson 4's fieldDisc). Draw it in a screen-space
//       layer (room.top), x, y and r in screen px (cam.map and cam.scale for a world bead)
//
//   L.bead(parent, { r = 22, color = chrome }) -> { g, body, core, halo, r, setColor(c) }
//       a glossy bead centred at (0, 0) in g: place it with g's transform (L.bead4.place); its
//       squash scales `body` about its foot
//   L.bead4.place(bead, { x, y, a, scale, sx, sy })   null hides it
//   L.bead4.squash(t, t0)   [sx, sy] of a landing squash from t0 (0.25 s)
//   L.glowPath(parent, { color, width = 4, glow = 10, glowA = 0.2 }) -> { g, path, glowPath, set(d) }
//       a stroke over a soft wider copy of itself (Merc's amber line: width 4, glow 10 at 20 %)
//
//   The title's staff (S2, Lesson 4's s02 adapted):
//   L.step(name)         a note's staff step above E4 (the treble staff's bottom line): A3 -4, E4 0,
//                        A4 3, C#5 5, E5 7
//   L.staff(parent, { yb = 696, s = 28, x0 = -120, x1 = 2040, id }) -> { g, lines, draw(disp, a) }
//                        five living lines (the spectrum gradient, a soft glow), y = yb - i s plus
//                        disp(x, i): the scene's own displacement (L.TITLE.disp is the title's)
//   L.note(parent, { x, yb, k, s, color, ink }) -> { g, body, head, stem }   a quarter note at step k
//   L.clef(parent, { x, yb, s, fill })       a treble clef (Noto Music)
//   L.sharp(parent, { x, y, s, fill })       a sharp (Noto Music)
//   L.TITLE              the title's numbers and its curves, from film time (HANDOFFS § Carried, § The
//                        cuts S2 to S3): .YB 696, .S 28, .REST [1060, 640], .NOTE_X, .CHIME(k) (film time
//                        of chime k from the 'title' cue), .zoom(T), .zmap(x, y, T), .disp(x, T),
//                        .flight(T) -> { x, y, r, amber } the bead's flight to A3 (null before it lifts)
;(function () {
  const L = (window.L = window.L || {})
  const cues = () => {
    if (!window.CUES) throw new Error('lesson.js: window.CUES is missing (load assets/cues.js first)')
    return window.CUES.cues
  }
  L.scene = (sid) => {
    const s = window.SCENES && window.SCENES[sid]
    if (!s) throw new Error(`lesson.js: no scene ${sid} in assets/scenes.js`)
    return s
  }
  L.dur = (sid) => {
    const s = L.scene(sid)
    return Math.round((s.end - s.start) * 1000) / 1000
  }
  const cue = (id) => {
    const c = cues()[id]
    if (!c) throw new Error(`lesson.js: no cue ${id} in cues.json`)
    return c
  }
  L.at = (sid, id, edge = 'start', off = 0) => {
    const c = cue(id)
    if (edge !== 'start' && edge !== 'end') throw new Error(`lesson.js: at(${id}): edge is 'start' or 'end'`)
    return c[edge] + off - L.scene(sid).start
  }
  L.cue = (id, edge = 'start', off = 0) => {
    const c = cue(id)
    if (edge !== 'start' && edge !== 'end') throw new Error(`lesson.js: cue(${id}): edge is 'start' or 'end'`)
    return c[edge] + off
  }
  const norm = (w) => w.toLowerCase().replace(/[^a-z0-9'’]/g, '').replace(/’/g, "'")
  // [first index, last index] of a word or phrase in a line
  L.wordIndex = (line, which) => {
    const c = cue(line)
    if (!c.words) throw new Error(`lesson.js: ${line} is not a line`)
    if (typeof which === 'number') {
      if (which < 0 || which >= c.words.length) throw new Error(`lesson.js: ${line} has no word ${which}`)
      return [which, which]
    }
    let n = 1
    let phrase = String(which)
    const m = phrase.match(/^(.*)#(\d+)$/)
    if (m) {
      phrase = m[1]
      n = Number(m[2])
    }
    const want = phrase.split(/\s+/).map(norm).filter(Boolean)
    const have = c.words.map((w) => norm(w[0]))
    for (let i = 0, seen = 0; i + want.length <= have.length; i++) {
      if (want.every((w, k) => have[i + k] === w) && ++seen === n) return [i, i + want.length - 1]
    }
    throw new Error(`lesson.js: ${line} does not say "${which}"`)
  }
  L.word = (sid, line, which, edge = 'start', off = 0) => {
    const [a, b] = L.wordIndex(line, which)
    const w = cue(line).words
    if (edge !== 'start' && edge !== 'end') throw new Error(`lesson.js: word(${line}): edge is 'start' or 'end'`)
    return (edge === 'start' ? w[a][1] : w[b][2]) + off - L.scene(sid).start
  }
  L.clock = (tl, D, draw) => {
    const st = { t: 0 }
    tl.to(st, { t: D, duration: D, ease: 'none', onUpdate: () => draw(st.t) }, 0)
    draw(0)
    return tl
  }

  /* ================================================================ the rest of the kit */

  L.C = {
    ground: '#0d1117', ink: '#e6edf3', ink2: '#a8b3bf', chrome: '#c3ccd6', blue: '#58a6ff', orange: '#ff7448',
    aqua: '#2dd4bf', gold: '#ffd84d', amber: '#f59e0b', violet: '#a78bfa', mint: '#80ffca', brandViolet: '#bc8cff',
  }
  L.FONT = { serif: "'Instrument Serif'", outfit: "'Outfit'", inter: "'Inter'", mono: "'JetBrains Mono'", music: "'Noto Music'" }

  L.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  L.lerp = (a, b, u) => a + (b - a) * u
  L.smooth = (e0, e1, x) => {
    const u = L.clamp((x - e0) / (e1 - e0))
    return u * u * (3 - 2 * u)
  }
  L.f2 = (v) => (Math.round(v * 100) / 100).toFixed(2)
  const EASES = {}
  L.ease = (name = 'none') => {
    if (typeof name === 'function') return name
    if (!name || name === 'none' || name === 'linear') return (u) => u
    if (!EASES[name]) EASES[name] = gsap.parseEase(name)
    return EASES[name]
  }
  L.easeOut = (u) => L.ease('power2.out')(L.clamp(u))
  L.easeInOut = (u) => L.ease('power2.inOut')(L.clamp(u))

  // mulberry32: deterministic, so every frame renders the same every time
  L.rng = (seed = 1) => {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  L.afterFonts = (fn) => {
    try { fn() } catch (e) { /* measured again once the fonts are in */ }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fn())
  }

  const SVGNS = 'http://www.w3.org/2000/svg'
  L.svg = (tag, attrs = {}, parent = null) => {
    const el = document.createElementNS(SVGNS, tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue
      if (k === 'text') el.textContent = v
      else el.setAttribute(k, v)
    }
    if (parent) parent.appendChild(el)
    return el
  }
  L.el = (tag, attrs = {}, parent = null) => {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
      else if (k === 'text') el.textContent = v
      else el.setAttribute(k, v)
    }
    if (parent) parent.appendChild(el)
    return el
  }
  L.stage = (layer) => {
    const svg = L.svg('svg', { width: 1920, height: 1080, viewBox: '0 0 1920 1080', 'data-layout-allow-overflow': '' }, layer)
    Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible' })
    return svg
  }
  L.stageOf = (layer) => {
    for (const c of layer.children) if (c.tagName && c.tagName.toLowerCase() === 'svg') return c
    return L.stage(layer)
  }
  let uid = 0
  L.uid = (p = 'k') => `kit-${p}-${++uid}`

  /* ---------------------------------------------------------------- the room */
  L.BOKEH_LIFT = 3
  L.STAVE_LIFT = 2.5
  // The three glows (DECISIONS 132): soft radial gradients over the ground, screen space.
  const GLOWS = [
    { x: 260, y: 150, r: 900, rgb: '88,166,255', a: 0.085 },     // blue, top left
    { x: 1680, y: 130, r: 820, rgb: '188,140,255', a: 0.07 },    // violet (the brand's), top right
    { x: 300, y: 1000, r: 760, rgb: '45,212,191', a: 0.055 },    // aqua, low left
  ]
  // The staves (DECISIONS 133): five lines 22 px apart, 2 px, chrome at 3.5 % at rest; centres in the far
  // layer's own pixels; a mask fades them out from y 780 to 830, so they never run under the floor
  const STAVES = { centres: [-250, -10, 230, 470, 710], gap: 22, x0: -1400, x1: 3300, a: 0.035, fade: [780, 830] }
  // The bokeh (DECISIONS 134, Lesson 4 DECISIONS 89 and 100): 21 soft chrome discs, 12 large on F0's outer
  // ring, 9 small over the middle the close framings look at, seeded
  const BOKEH = (() => {
    const r = L.rng(89)
    const out = []
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + 0.35 * (r() - 0.5)
      const rr = 0.92 + 0.16 * r()
      out.push({ x: 960 + 1000 * rr * Math.cos(ang), y: 540 + 590 * rr * Math.sin(ang), r: 50 + 70 * r(), a: 0.035 + 0.023 * r() })
    }
    for (let i = 0; i < 9; i++) out.push({ x: 400 + 1120 * r(), y: 360 + 420 * r(), r: 16 + 12 * r(), a: 0.04 + 0.02 * r() })
    return out
  })()
  L.ROOM = { GLOWS, STAVES, BOKEH, FLOOR_Y: 840 }

  L.room = (root, { floor = false, glows = true, staves = true, bokeh = true, vignette = true } = {}) => {
    root.style.background = L.C.ground
    const layer = (name) => {
      const d = L.el('div', { class: 'layer ' + name, 'data-layout-allow-overflow': '' }, root)
      Object.assign(d.style, { position: 'absolute', left: '0', top: '0', width: '1920px', height: '1080px', pointerEvents: 'none' })
      return d
    }
    const back = layer('back')
    if (glows) {
      for (const g of GLOWS) {
        L.el('div', { 'data-layout-allow-overflow': '', style: { position: 'absolute', left: g.x - g.r + 'px', top: g.y - g.r + 'px', width: 2 * g.r + 'px', height: 2 * g.r + 'px', borderRadius: '50%', background: `radial-gradient(closest-side, rgba(${g.rgb},${g.a}), rgba(${g.rgb},${(g.a * 0.35).toFixed(4)}) 55%, rgba(${g.rgb},0) 100%)` } }, back)
      }
    }
    const far = layer('far')
    const under = layer('under')
    const floorLayer = layer('floor-layer')
    const mid = layer('mid')
    const near = layer('near')
    const top = layer('top')
    const vig = layer('vignette')
    const hud = layer('hud')
    if (vignette) vig.style.background = 'radial-gradient(ellipse 78% 74% at 50% 46%, rgba(13,17,23,0) 62%, rgba(4,6,9,0.34) 100%)'

    // the staves, drawn at STAVE_LIFT times their alpha and shown at 1 / LIFT at rest
    let stavesEl = null
    if (staves) {
      const svg = L.stage(far)
      stavesEl = L.svg('g', { class: 'staves' }, svg)
      const id = L.uid('staves')
      const defs = L.svg('defs', {}, svg)
      const grad = L.svg('linearGradient', { id: id + '-g', gradientUnits: 'userSpaceOnUse', x1: 0, y1: STAVES.fade[0], x2: 0, y2: STAVES.fade[1] }, defs)
      L.svg('stop', { offset: 0, 'stop-color': '#fff' }, grad)
      L.svg('stop', { offset: 1, 'stop-color': '#000' }, grad)
      const mask = L.svg('mask', { id: id + '-m', maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 10000, height: 10000 }, defs)
      L.svg('rect', { x: -4000, y: -4000, width: 10000, height: 10000, fill: `url(#${id}-g)` }, mask)
      const g = L.svg('g', { mask: `url(#${id}-m)` }, stavesEl)
      for (const c of STAVES.centres) {
        for (let i = -2; i <= 2; i++) {
          L.svg('rect', { x: STAVES.x0, y: c + i * STAVES.gap - 1, width: STAVES.x1 - STAVES.x0, height: 2, fill: L.C.chrome, 'fill-opacity': (STAVES.a * L.STAVE_LIFT).toFixed(4) }, g)
        }
      }
      stavesEl.style.opacity = (1 / L.STAVE_LIFT).toFixed(4)
    }
    // the bokeh, drawn at BOKEH_LIFT times its alpha and shown at 1 / LIFT at rest
    let bokehEl = null
    if (bokeh) {
      const svg = L.stage(under)
      bokehEl = L.svg('g', { class: 'bokeh' }, svg)
      const defs = L.svg('defs', {}, svg)
      BOKEH.forEach((b) => {
        const id = L.uid('bokeh')
        const gr = L.svg('radialGradient', { id }, defs)
        const a = Math.min(1, b.a * L.BOKEH_LIFT)
        L.svg('stop', { offset: 0, 'stop-color': L.C.chrome, 'stop-opacity': a.toFixed(4) }, gr)
        L.svg('stop', { offset: 0.62, 'stop-color': L.C.chrome, 'stop-opacity': (a * 0.8).toFixed(4) }, gr)
        L.svg('stop', { offset: 1, 'stop-color': L.C.chrome, 'stop-opacity': 0 }, gr)
        L.svg('circle', { cx: b.x.toFixed(1), cy: b.y.toFixed(1), r: b.r.toFixed(1), fill: `url(#${id})` }, bokehEl)
      })
      bokehEl.style.opacity = (1 / L.BOKEH_LIFT).toFixed(4)
    }
    // the floor: a faint horizon at y 840, full width, and a cool sheen under it (DECISIONS 135)
    const floorEl = L.el('div', { class: 'floor', 'data-layout-allow-overflow': '' }, floorLayer)
    Object.assign(floorEl.style, {
      position: 'absolute', left: '0', top: L.ROOM.FLOOR_Y + 'px', width: '1920px', height: '240px',
      background: 'linear-gradient(180deg, rgba(120,150,190,0.085) 0px, rgba(120,150,190,0.03) 70px, rgba(13,17,23,0) 170px)',
      borderTop: '1px solid rgba(195,204,214,0.14)',
      webkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%)',
      maskImage: 'linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%)',
      opacity: floor ? '1' : '0',
    })
    const room = { root, back, far, under, floorLayer, mid, near, top, vignette: vig, hud, staves: stavesEl, bokeh: bokehEl, floor: floorEl }
    room.setFloor = (a) => { floorEl.style.opacity = L.clamp(a).toFixed(3) }
    return room
  }

  L.filmDust = (layer, { n = 200, seed = 7, x0 = -900, y0 = -700, w = 3700, h = 2100 } = {}) => {
    const svg = L.stage(layer)
    const r = L.rng(seed)
    const motes = []
    for (let i = 0; i < n; i++) {
      const m = { x: r() * w, y: r() * h, s: 0.8 + r() * 2.2, vx: (r() - 0.5) * 14, vy: -4 - r() * 10, ph: r() * 6.28 }
      m.el = L.svg('circle', { r: m.s.toFixed(2), fill: 'rgba(195,204,214,0.5)', opacity: 0 }, svg)
      motes.push(m)
    }
    return (T) => {
      for (const m of motes) {
        m.el.setAttribute('cx', (((m.x + m.vx * T) % w + w) % w + x0).toFixed(1))
        m.el.setAttribute('cy', (((m.y + m.vy * T) % h + h) % h + y0).toFixed(1))
        m.el.setAttribute('opacity', (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(m.ph + T * 0.9))).toFixed(3))
      }
    }
  }
  L.dust = L.filmDust

  /* ---------------------------------------------------------------- the field (S1h, S2) */
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  L.hexRgb = hexRgb
  L.mixHex = (a, b, u) => {
    const A = hexRgb(a), B = hexRgb(b)
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * L.clamp(u))).join(',')})`
  }
  // the board's 75 % and 35 %, on screen at its own radius (1500 px, so the corners are at 35 %) with the room's
  // vignette hidden under it: the frame's mean luma is Lesson 2's 113 to 122 (critic-kit-01 item 5 measured
  // 132 where the old lab drew it in the world at 2.2 times its radius); breathing 2 % and a dither
  const FIELD = { R: 1500, corner: Math.hypot(960, 540), inner: 0.75, outer: 0.35, breathe: 0.02, grain: 0.035, ground: hexRgb('#0d1117'), chrome: hexRgb('#c3ccd6') }
  FIELD.mixAt = (r) => FIELD.inner - ((FIELD.inner - FIELD.outer) * r) / FIELD.corner
  L.FIELD = FIELD
  L.field = (svg, id = L.uid('field')) => {
    const defs = L.svg('defs', {}, svg)
    const grad = L.svg('radialGradient', { id, gradientUnits: 'userSpaceOnUse', cx: 960, cy: 540, r: FIELD.R }, defs)
    const offs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, FIELD.corner / FIELD.R, 0.8, 0.85, 0.9, 0.95, 1]
    const stops = offs.map((o) => L.svg('stop', { offset: o.toFixed(4) }, grad))
    const disc = L.svg('circle', { cx: 960, cy: 540, r: FIELD.R, fill: `url(#${id})`, opacity: 0 }, svg)
    // the dither: a fine grey grain, its seed stepped every frame from film time, clipped to the disc, so the
    // gradient never bands when the contrast is stretched and no frame of the field repeats the one before
    const clip = L.svg('clipPath', { id: id + '-clip' }, defs)
    const clipC = L.svg('circle', { cx: 960, cy: 540, r: FIELD.R }, clip)
    const filt = L.svg('filter', { id: id + '-grain', filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1920, height: 1080, 'color-interpolation-filters': 'sRGB' }, defs)
    const turb = L.svg('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.85, numOctaves: 2, seed: 1, result: 'n' }, filt)
    L.svg('feColorMatrix', { in: 'n', type: 'matrix', values: '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1' }, filt)
    const grain = L.svg('rect', { x: 0, y: 0, width: 1920, height: 1080, filter: `url(#${id}-grain)`, 'clip-path': `url(#${id}-clip)`, opacity: 0 }, svg)
    const rgbStr = (c) => `rgb(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')})`
    return {
      disc,
      draw({ x = 960, y = 540, r = FIELD.R, a = 1, T = 0, soft = 0.8, breathe0 = 0, dither = 1 }) {
        if (a <= 0.004 || r <= 0.5) { disc.setAttribute('opacity', '0'); grain.setAttribute('opacity', '0'); return }
        turb.setAttribute('seed', String(1 + (Math.round(T * 120) % 997)))      // two steps a 60 fps frame: no frame repeats one
        clipC.setAttribute('cx', L.f2(x)); clipC.setAttribute('cy', L.f2(y)); clipC.setAttribute('r', L.f2(r * soft))
        grain.setAttribute('opacity', (FIELD.grain * a * L.clamp(dither) * L.smooth(200, 600, r)).toFixed(4))
        // breathing 2 % in brightness from film time, on two incommensurate periods so it never rests
        const k = 1 + FIELD.breathe * (0.6 * Math.sin(2 * Math.PI * (T - breathe0) / 1.3) + 0.4 * Math.sin(2 * Math.PI * (T - breathe0) / 0.29))
        offs.forEach((o, i) => {
          const m = FIELD.mixAt(o * FIELD.R) * k
          stops[i].setAttribute('stop-color', rgbStr(FIELD.ground.map((v, j) => v + (FIELD.chrome[j] - v) * m)))
          stops[i].setAttribute('stop-opacity', (1 - L.smooth(soft, 1, o)).toFixed(4))
        })
        for (const el of [grad, disc]) { el.setAttribute('cx', L.f2(x)); el.setAttribute('cy', L.f2(y)); el.setAttribute('r', L.f2(r)) }
        disc.setAttribute('opacity', a.toFixed(3))
      },
    }
  }

  /* ---------------------------------------------------------------- beads and glowing strokes */
  L.bead = (parent, { r = 22, color = L.C.chrome } = {}) => {
    const id = L.uid('bead')
    const g = L.svg('g', { class: 'bead' }, parent)
    const defs = L.svg('defs', {}, g)
    const hg = L.svg('radialGradient', { id: id + '-h' }, defs)
    const hs0 = L.svg('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0.45 }, hg)
    const hs1 = L.svg('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }, hg)
    const bg = L.svg('radialGradient', { id: id + '-b', cx: 0.36, cy: 0.32, r: 0.75 }, defs)
    const bs0 = L.svg('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.9 }, bg)
    const bs1 = L.svg('stop', { offset: 0.38, 'stop-color': color }, bg)
    const bs2 = L.svg('stop', { offset: 1, 'stop-color': color }, bg)
    const halo = L.svg('circle', { r: (r * 1.75).toFixed(2), fill: `url(#${id}-h)` }, g)
    const body = L.svg('g', {}, g)
    const core = L.svg('circle', { r, fill: `url(#${id}-b)` }, body)
    L.svg('circle', { r: r - 0.75, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.22, 'stroke-width': 1.5 }, body)
    return {
      g, body, core, halo, r,
      setColor(c) { for (const s of [hs0, hs1, bs1, bs2]) s.setAttribute('stop-color', c) },
    }
  }
  L.bead4 = {
    squash(t, t0) {
      const tau = t - t0
      if (tau < 0 || tau > 0.6) return [1, 1]
      const q = 0.22 * Math.exp(-9 * tau) * Math.cos(26 * tau)
      return [1 + q, 1 - q]
    },
    place(b, s) {
      if (!s || (s.a ?? 1) <= 0.004 || (s.scale ?? 1) <= 0.002) { b.g.setAttribute('display', 'none'); return }
      b.g.removeAttribute('display')
      b.g.setAttribute('transform', `translate(${L.f2(s.x)} ${L.f2(s.y)}) scale(${(s.scale ?? 1).toFixed(4)})`)
      b.g.setAttribute('opacity', (s.a ?? 1).toFixed(3))
      const sx = s.sx ?? 1, sy = s.sy ?? 1
      if (sx !== 1 || sy !== 1) b.body.setAttribute('transform', `translate(0 ${b.r}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 ${-b.r})`)
      else b.body.removeAttribute('transform')
    },
  }
  L.glowPath = (parent, { color = L.C.chrome, width = 4, glow = 10, glowA = 0.2, cap = 'round' } = {}) => {
    const g = L.svg('g', {}, parent)
    const glowPath = L.svg('path', { fill: 'none', stroke: color, 'stroke-width': glow, 'stroke-opacity': glowA, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, g)
    const path = L.svg('path', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': cap, 'stroke-linejoin': 'round' }, g)
    return {
      g, path, glowPath,
      set(d) { path.setAttribute('d', d); glowPath.setAttribute('d', d) },
      color(c) { path.setAttribute('stroke', c); glowPath.setAttribute('stroke', c) },
    }
  }

  /* ---------------------------------------------------------------- the title's staff and notes */
  const LETTER = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
  L.step = (name) => {
    const m = String(name).match(/^([A-G])([#b♯♭]?)(-?\d)$/)
    if (!m) throw new Error('L.step: ' + name)
    return LETTER[m[1]] + 7 * Number(m[3]) - (LETTER.E + 7 * 4)
  }
  L.staff = (parent, { yb = 696, s = 28, x0 = -120, x1 = 2040, id = L.uid('staff') } = {}) => {
    const defs = L.svg('defs', {}, parent)
    const spec = L.svg('linearGradient', { id: id + '-spec', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 1920, y1: 0, y2: 0 }, defs)
    ;[[0, L.C.blue], [0.5, L.C.aqua], [1, L.C.brandViolet]].forEach(([o, c]) => L.svg('stop', { offset: o, 'stop-color': c }, spec))
    const fade = L.svg('linearGradient', { id: id + '-fade', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 1920, y1: 0, y2: 0 }, defs)
    ;[[0, 0], [0.07, 1], [0.93, 1], [1, 0]].forEach(([o, a]) => L.svg('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, fade))
    const mask = L.svg('mask', { id: id + '-mask', maskUnits: 'userSpaceOnUse', x: -200, y: 0, width: 2320, height: 1080 }, defs)
    L.svg('rect', { x: -200, y: 0, width: 2320, height: 1080, fill: `url(#${id}-fade)` }, mask)
    const g = L.svg('g', { mask: `url(#${id}-mask)` }, parent)
    const lines = []
    for (let i = 0; i < 5; i++) {
      const lg = L.svg('g', {}, g)
      const glow = L.svg('path', { fill: 'none', stroke: `url(#${id}-spec)`, 'stroke-width': 10 + 2 * i, 'stroke-opacity': 0.09, 'stroke-linecap': 'round' }, lg)
      const line = L.svg('path', { fill: 'none', stroke: `url(#${id}-spec)`, 'stroke-width': 2 + 0.3 * i, 'stroke-opacity': 0.62, 'stroke-linecap': 'round' }, lg)
      lines.push({ g: lg, glow, line })
    }
    return {
      g, lines, yb, s,
      draw(disp = () => 0, a = 1) {
        for (let i = 0; i < 5; i++) {
          const y0 = yb - i * s
          let d = ''
          for (let x = x0; x <= x1; x += 12) d += (x === x0 ? 'M' : 'L') + x + ' ' + (y0 + disp(x, i)).toFixed(2)
          lines[i].glow.setAttribute('d', d)
          lines[i].line.setAttribute('d', d)
        }
        g.setAttribute('opacity', a.toFixed(3))
      },
    }
  }
  L.note = (parent, { x, yb = 696, k = 0, s = 28, color = L.C.chrome, ink = 'rgba(214,221,229,0.9)' } = {}) => {
    const g = L.svg('g', {}, parent)
    const y = yb - (k * s) / 2
    const body = L.svg('g', {}, g)
    const rx = 0.62 * s, ry = 0.44 * s
    const head = L.svg('ellipse', { cx: x, cy: y, rx, ry, fill: color, transform: `rotate(-22 ${x} ${y})` }, body)
    const up = k < 4
    const sx = up ? x + rx * 0.93 : x - rx * 0.93
    const stem = L.svg('line', { x1: sx, x2: sx, y1: y + (up ? -0.15 * s : 0.15 * s), y2: y + (up ? -3.4 * s : 3.4 * s), stroke: ink, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, body)
    return { g, body, head, stem, y }
  }
  L.clef = (parent, { x = 150, yb = 696, s = 28, fill = 'rgba(195,204,214,0.9)' } = {}) =>
    L.svg('text', { x, y: yb - s, fill, text: '\u{1D11E}', style: `font-family: ${L.FONT.music}; font-size: ${(4 * s).toFixed(1)}px;` }, parent)
  L.sharp = (parent, { x, y, s = 28, fill = 'rgba(214,221,229,0.92)' } = {}) =>
    L.svg('text', { x, y: y + 0.5 * s, 'text-anchor': 'end', fill, text: '♯', style: `font-family: ${L.FONT.music}; font-size: ${(1.9 * s).toFixed(1)}px;` }, parent)

  // The title (S2) and its bead's flight to A3 (S2 to S3), from film time, so s02 and s03 draw the same
  // pixels on either side of the cut (HANDOFFS § Carried, § The cuts S2 to S3, provisional until the lab)
  L.TITLE = {
    YB: 696, S: 28, REST: [1060, 640], NOTE_X: [560, 760, 960, 1160, 1360], NOTES: ['A3', 'E4', 'A4', 'C#5', 'E5'],
    title: () => L.cue('title'),
    CHIME: (k) => L.cue('title', 'start', 0.05 + 0.09 * k),
    zoom(T) {
      const s = L.scene('s02-title')
      return 1.04 - 0.04 * L.ease('power1.out')(L.clamp((T - s.start) / (s.end - s.start)))
    },
    zmap(x, y, T) { const z = L.TITLE.zoom(T); return [960 + z * (x - 960), 540 + z * (y - 540)] },
    // the staff lines' living displacement at x, with a ripple from each note as it lands (Lesson 2's)
    disp(x, T) {
      const u = x / 1920, pin = Math.sin(Math.PI * L.clamp(u))
      let y = pin * 2.2 * Math.sin(2 * Math.PI * 1.3 * u + 0.9 * T) * (0.65 + 0.35 * Math.sin(0.6 * T))
      L.TITLE.NOTE_X.forEach((nx, k) => {
        const tau = T - L.TITLE.CHIME(k)
        if (tau <= 0) return
        const dist = Math.abs(x - nx), front = 1100 * tau
        y += 5.5 * Math.exp(-2.4 * tau) * Math.exp(-Math.pow((dist - front) / 150, 2)) * Math.sin((2 * Math.PI * (dist - front)) / 170)
        y += 6 * Math.exp(-Math.pow(dist / 70, 2)) * Math.exp(-7 * tau) * Math.cos(18 * tau)
      })
      return y
    },
    // the bead lifts off its rest at title + 2.72 and lands on A3 at the plot's left end, (480, 400) at
    // F-promise-a, 1.0 s later (sine.out), a cubic through (1060, 300) and (620, 320); it shrinks from r 22
    // to the line's 4 px head (r 2) over its last 0.3 s, turning amber as it lands
    LIFT: 2.72, FLY: 1.0, LAND: [480, 400],
    flight(T) {
      const T0 = L.cue('title', 'start', L.TITLE.LIFT)
      if (T < T0) return null
      const P0 = L.TITLE.zmap(L.TITLE.REST[0], L.TITLE.REST[1] + L.TITLE.disp(L.TITLE.REST[0], T0), T0)
      const P1 = [1060, 300], P2 = [620, 320], P3 = L.TITLE.LAND
      const u = L.ease('sine.out')(L.clamp((T - T0) / L.TITLE.FLY)), v = 1 - u
      const k0 = v * v * v, k1 = 3 * v * v * u, k2 = 3 * v * u * u, k3 = u * u * u
      const shrink = L.ease('power2.in')(L.clamp((T - (T0 + L.TITLE.FLY - 0.3)) / 0.3))
      return {
        x: k0 * P0[0] + k1 * P1[0] + k2 * P2[0] + k3 * P3[0],
        y: k0 * P0[1] + k1 * P1[1] + k2 * P2[1] + k3 * P3[1],
        r: L.lerp(22 * L.TITLE.zoom(T0), 2, shrink),
        amber: shrink,
        landed: T >= T0 + L.TITLE.FLY,
      }
    },
  }
})()
