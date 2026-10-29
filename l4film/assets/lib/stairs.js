/* Find Your Pitch, Lesson 4 kit: the staircase world. window.L, after marks.js.

   HANDOFFS § World and § Shared formulas, in world units (F0's pixels). Draw it in an SVG in
   the room's mid layer and frame it with L.frameRig.

     L.ST                          geometry: .H (heights above do), .rowTop(k), .rowBot(k),
                                   .blackRow(k), .colX(n, w), .tread(n, s0), .foot(s0),
                                   .rest(n, w, s0), .houseBox(n, w, s0), .keyX(m), .scale(s0),
                                   .START { C, D, E, G }, .LIT (fills), .riserX(n, w)
     const st = L.stairs(svg, opts)   the semitone rows, the eight stairs, the seven risers,
                                   the stair names, the riser labels and the two houses
     st.draw(f)                    one frame:
       f.w, f.s0                   the start (fractional during a slide; HANDOFFS: interpolate
                                   both on one curve, power2.inOut unless a row says otherwise)
       f.a                         the staircase's own opacity (0.25 under a card, 0.2 in S11)
       f.rows { a, x0, x1, k0, k1, kA(k), keep: { boxes, cam, t } }
                                   the faint rows; keep: the Mercs' screen boxes (body boxes,
                                   L.mercBox), masked clear 20 px round each, full 60 px further
       f.stair(n) -> { a, fill: 'unlit'|'outline'|'none', filled, lit, color, scale, dx, dy,
                       names: [{ text, a, dy, scale }] }
                                   lit 0..1 mixes the fill to 40 % chrome or 45 % blue/orange
                                   (color 'chrome' | 'blue' | 'orange'); filled 0..1 takes an
                                   outline stair to a full block; names cross-fade by list
       f.riser(n) -> { a, state: 'unmeasured'|'measuring'|'tone'|'semi'|'none', grow, scale,
                       labels: [{ text, a, dy, scale }] }
                                   riser n stands between stairs n and n + 1
       f.houses { top: { a, lit, glow, scale, w, s0 }, bottom: { ... } }
                                   w, s0 default to the staircase's (the cold open's top house
                                   keeps C's columns: pass w 0)
     const kb = L.strip(svg, opts)    the keyboard strip C4 to G5 and the hairlines
     kb.draw(f):
       f.a, f.dy                   the strip's opacity and its sink (y 760 + dy)
       f.key(m) -> { full, lit, scale, a, names: [{ text, a }] }
                                   m is semitones above C4 (0 to 19); full 0..1 takes a key's
                                   fill from 45 % to its full fill; lit 0..1 lights a black key
                                   to 40 % chrome
       f.hair { a, w, s0, hA(n) }  the eight hairlines from each stair's foot to its key
     L.house(parent)               the house glyph: .draw({ x, y, a, lit, glow, scale })
     L.bead4                       bead paths (HANDOFFS § Beads): .hopAt, .squash, .dropAt, .riseAt,
                                   .runAt, and .place(bead, state) to set an L.bead from one
     Label pools build a label the first frame it is asked for; .prepare([texts]) on a stair's,
     riser's or key's pool (st.stairs[i].names, st.risers[i].labels, kb.keys[m].names) builds
     them up front.
     L.mercBox(x, feetY, size)     a Merc's body box (HANDOFFS: 0.53 of its size wide, 0.64 tall)
*/
;(function () {
  const L = window.L
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  const lerp = (a, b, u) => a + (b - a) * u
  const f1 = (v) => (Math.round(v * 100) / 100).toString()
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]
  const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`

  /* ---------------------------------------------------------------- geometry */
  const H = [0, 2, 4, 5, 7, 9, 11, 12]
  const BLACK = [1, 3, 6, 8, 10]
  // key centres by semitone above C4 (HANDOFFS § World, Strip)
  const KX = [298, 358, 418, 478, 538, 658, 718, 778, 838, 898, 958, 1018, 1138, 1198, 1258, 1318, 1378, 1498, 1558, 1618]
  const ST = {
    H,
    rowTop: (k) => 690 - 26 * (k + 1),
    rowBot: (k) => 690 - 26 * k,
    blackRow: (k) => BLACK.includes(((k % 12) + 12) % 12),
    colX: (n, w) => 298 + 120 * (w + n - 1),
    tread: (n, s0) => 690 - 26 * (s0 + H[n - 1] + 1),
    foot: (s0) => 736 - 26 * s0,
    riserX: (n, w) => 298 + 120 * (w + n - 1) + 60,
    rest: (n, w, s0) => [ST.colX(n, w), ST.tread(n, s0) - 22],
    houseBox: (n, w, s0) => {
      const cx = ST.colX(n, w), tr = ST.tread(n, s0)
      return { x: cx - 28, y: tr - 66, w: 56, h: 52, cx, cy: tr - 40 }
    },
    // a key's centre for a (possibly fractional) semitone, so a hairline follows a slide
    keyX: (m) => {
      const a = clamp(Math.floor(m), 0, 19), b = clamp(Math.ceil(m), 0, 19)
      return a === b ? KX[a] : lerp(KX[a], KX[b], m - a)
    },
    isBlack: (m) => BLACK.includes(((m % 12) + 12) % 12),
    // the scale's eight keys, as semitones above C4
    scale: (s0) => H.map((h) => s0 + h),
    START: { C: { w: 0, s0: 0 }, D: { w: 1, s0: 2 }, E: { w: 2, s0: 4 }, G: { w: 4, s0: 7 } },
    LIT: { unlit: '#1b232d', chrome: 0.4, color: 0.45 },
  }
  L.ST = ST

  const UNLIT = hex('#1b232d'), CHROME = hex('#c3ccd6'), GOLD = '#ffd84d'
  const COLOR = { chrome: CHROME, blue: hex('#58a6ff'), orange: hex('#ff7448') }

  L.mercBox = (x, feetY, size) => ({ x0: x - 0.265 * size, x1: x + 0.265 * size, y0: feetY - 0.64 * size, y1: feetY })

  /* ---------------------------------------------------------------- labels */
  // A pool of L.spell labels keyed by text, so names cross-fade (letters, numbers, solfège)
  // without rebuilding anything per frame. Each frame shows the listed ones and hides the rest.
  const labelPool = (parent, opts) => {
    const host = L.svg('g', {}, parent)
    const pool = new Map()
    const make = (text, x, y) => {
      const lab = L.spell(host, text, { ...opts, x, y })
      lab.g.setAttribute('opacity', '0')
      pool.set(text, lab)
      // which frame first asks for a label depends on the seek order: keep the paint order fixed
      for (const k of [...pool.keys()].sort()) host.appendChild(pool.get(k).g)
      return lab
    }
    return {
      host,
      prepare(texts) { for (const s of texts) if (!pool.has(s)) make(s, 0, 0) },
      show(list, x, y, groupA = 1) {
        const seen = new Set()
        for (const it of list || []) {
          if (!it || it.text == null || it.a <= 0.004) continue
          const lab = pool.get(it.text) || make(it.text, x, y)
          lab.draw({ px: x + (it.dx || 0), py: y + (it.dy || 0), alpha: it.a * groupA, scale: it.scale || 1 })
          seen.add(it.text)
        }
        for (const [text, lab] of pool) if (!seen.has(text)) lab.g.setAttribute('opacity', '0')
      },
    }
  }

  /* ---------------------------------------------------------------- the house */
  let hid = 0
  // 56 x 52: a roof with eaves over a body with a door. Unlit: a 3 px chrome outline at 55 %.
  // Lit: an ink fill with a soft chrome glow (16 px). (x, y) is the box's top-left corner.
  L.house = (parent) => {
    const id = 'kit-house' + hid++
    const g = L.svg('g', { class: 'house' }, parent)
    const defs = L.svg('defs', {}, g)
    const f = L.svg('filter', { id: id + '-glow', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs)
    L.svg('feGaussianBlur', { stdDeviation: 8 }, f)
    const shape = 'M1 25 L28 2 L55 25 L48 25 L48 50 L8 50 L8 25 Z'
    const glow = L.svg('path', { d: shape, fill: '#c3ccd6', filter: `url(#${id}-glow)`, opacity: 0 }, g)
    const fill = L.svg('path', { d: shape, fill: '#e6edf3', opacity: 0 }, g)
    const door = L.svg('path', { d: 'M23.5 50 V36 H32.5 V50 Z', fill: '#0d1117', opacity: 0 }, g)
    const line = L.svg('path', { d: 'M1 25 L28 2 L55 25 M8 21 V50 H48 V21 M23.5 50 V36 H32.5 V50', fill: 'none', stroke: '#c3ccd6', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-opacity': 0.55 }, g)
    return {
      g,
      draw({ x = 0, y = 0, a = 1, lit = 0, glow: gl = 0, scale = 1 } = {}) {
        if (a <= 0.004) { g.setAttribute('display', 'none'); return }
        g.removeAttribute('display')
        g.setAttribute('transform', `translate(${f1(x + 28)} ${f1(y + 26)}) scale(${scale.toFixed(4)}) translate(-28 -26)`)
        g.setAttribute('opacity', a.toFixed(3))
        const l = clamp(lit)
        fill.setAttribute('opacity', l.toFixed(3))
        door.setAttribute('opacity', l.toFixed(3))
        line.setAttribute('stroke-opacity', (0.55 * (1 - l)).toFixed(3))
        glow.setAttribute('opacity', clamp(0.55 * l + 0.45 * gl).toFixed(3))
      },
    }
  }

  /* ---------------------------------------------------------------- the staircase */
  let sid = 0
  L.stairs = (svg, { x0 = 220, x1 = 1680, k0 = 0, k1 = 19 } = {}) => {
    const id = 'kit-st' + sid++
    const defs = L.svg('defs', {}, svg)
    // the rows' keep-out mask: white everywhere, a blurred black box round each Merc
    const mask = L.svg('mask', { id: id + '-keep', maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 10000, height: 10000 }, defs)
    L.svg('rect', { x: -4000, y: -4000, width: 10000, height: 10000, fill: '#fff' }, mask)
    const blur = L.svg('filter', { id: id + '-blur', filterUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1, height: 1 }, defs)
    const blurOp = L.svg('feGaussianBlur', { stdDeviation: 17.6 }, blur)
    const holes = L.svg('g', { filter: `url(#${id}-blur)` }, mask)
    const holeRects = [0, 1, 2].map(() => L.svg('rect', { fill: '#000', display: 'none' }, holes))

    const gRows = L.svg('g', { class: 'st-rows', mask: `url(#${id}-keep)` }, svg)
    const rows = []
    for (let k = k0; k <= k1; k++) {
      const band = L.svg('rect', { x: x0, width: x1 - x0, y: ST.rowTop(k), height: 26, fill: '#e6edf3', 'fill-opacity': ST.blackRow(k) ? 0.06 : 0.025 }, gRows)
      const line = L.svg('rect', { x: x0, width: x1 - x0, y: ST.rowBot(k) - 0.5, height: 1, fill: '#e6edf3', 'fill-opacity': 0.06 }, gRows)
      rows.push({ k, band, line })
    }
    const top = L.svg('rect', { x: x0, width: x1 - x0, y: ST.rowTop(k1) - 0.5, height: 1, fill: '#e6edf3', 'fill-opacity': 0.06 }, gRows)

    const gAll = L.svg('g', { class: 'st-stairs' }, svg)
    const gBlocks = L.svg('g', {}, gAll)
    const gRisers = L.svg('g', {}, gAll)
    const gNames = L.svg('g', {}, gAll)
    const gHouses = L.svg('g', {}, gAll)

    const stairs = []
    for (let n = 1; n <= 8; n++) {
      const g = L.svg('g', {}, gBlocks)
      const block = L.svg('path', { fill: rgb(UNLIT), stroke: '#c3ccd6', 'stroke-opacity': 0.4, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g)
      const treadLine = L.svg('path', { fill: 'none', stroke: '#c3ccd6', 'stroke-opacity': 0.7, 'stroke-width': 3, 'stroke-linecap': 'round' }, g)
      stairs.push({ n, g, block, treadLine, names: labelPool(gNames, { size: 36, family: 'Outfit', weight: 600, fill: L.C.ink, anchor: 'middle' }) })
    }
    const risers = []
    for (let n = 1; n <= 7; n++) {
      const g = L.svg('g', {}, gRisers)
      const bar = L.svg('rect', { fill: '#c3ccd6' }, g)
      const outline = L.svg('rect', { fill: 'none', stroke: '#c3ccd6', 'stroke-width': 2, 'stroke-opacity': 0.55 }, g)
      const tick = L.svg('rect', { fill: '#c3ccd6', height: 2 }, g)
      risers.push({ n, g, bar, outline, tick, labels: labelPool(gRisers, { size: 40, family: 'Outfit', weight: 600, fill: L.C.ink, anchor: 'end' }) })
    }
    const houses = { bottom: L.house(gHouses), top: L.house(gHouses) }

    const blockPath = (xa, xb, tr, ft) => {
      const r = Math.min(6, (ft - tr) / 2)
      return `M${f1(xa)} ${f1(ft)} L${f1(xa)} ${f1(tr + r)} Q${f1(xa)} ${f1(tr)} ${f1(xa + r)} ${f1(tr)} L${f1(xb - r)} ${f1(tr)} Q${f1(xb)} ${f1(tr)} ${f1(xb)} ${f1(tr + r)} L${f1(xb)} ${f1(ft)} Z`
    }

    const st = {
      svg, rows, stairs, risers, houses, gRows, gAll,
      draw(f = {}) {
        const w = f.w ?? 0, s0 = f.s0 ?? 0, A = f.a ?? 1
        // rows
        const R = f.rows || {}
        const ra = R.a ?? 1
        gRows.setAttribute('opacity', ra.toFixed(3))
        gRows.setAttribute('display', ra <= 0.004 ? 'none' : 'inline')
        const rx0 = R.x0 ?? x0, rx1 = R.x1 ?? x1
        for (const r of rows) {
          const on = r.k >= (R.k0 ?? k0) && r.k <= (R.k1 ?? k1)
          const ka = on ? (R.kA ? R.kA(r.k) : 1) : 0
          for (const el of [r.band, r.line]) {
            el.setAttribute('x', f1(rx0)); el.setAttribute('width', f1(rx1 - rx0))
            el.setAttribute('opacity', ka.toFixed(3))
          }
        }
        const kTop = Math.min(R.k1 ?? k1, k1)
        top.setAttribute('x', f1(rx0)); top.setAttribute('width', f1(rx1 - rx0)); top.setAttribute('y', f1(ST.rowTop(kTop) - 0.5))
        top.setAttribute('opacity', (R.kA ? R.kA(kTop) : 1).toFixed(3))
        // the Mercs' keep-out, from screen boxes to world units at this frame
        const keep = R.keep
        const boxes = keep && keep.boxes ? keep.boxes : []
        // a blurred box 50 px out from each body box: clear 20 px out, full 80 px out (screen px)
        const sc = keep && keep.cam ? keep.cam.scale(keep.t) : 1
        const sig = 17.6 / sc
        blurOp.setAttribute('stdDeviation', sig.toFixed(2))
        const u = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
        holeRects.forEach((el, i) => {
          const b = boxes[i]
          if (!b) { el.setAttribute('display', 'none'); return }
          let [ax, ay] = [b.x0 - 50, b.y0 - 50], [bx, by] = [b.x1 + 50, b.y1 + 50]
          if (keep.cam) { [ax, ay] = keep.cam.inv(ax, ay, keep.t); [bx, by] = keep.cam.inv(bx, by, keep.t) }
          el.removeAttribute('display')
          el.setAttribute('x', f1(ax)); el.setAttribute('y', f1(ay))
          el.setAttribute('width', f1(bx - ax)); el.setAttribute('height', f1(by - ay))
          u.x0 = Math.min(u.x0, ax); u.y0 = Math.min(u.y0, ay); u.x1 = Math.max(u.x1, bx); u.y1 = Math.max(u.y1, by)
        })
        holes.setAttribute('display', boxes.length ? 'inline' : 'none')
        if (boxes.length) {
          const m = 4 * sig
          blur.setAttribute('x', f1(u.x0 - m)); blur.setAttribute('y', f1(u.y0 - m))
          blur.setAttribute('width', f1(u.x1 - u.x0 + 2 * m)); blur.setAttribute('height', f1(u.y1 - u.y0 + 2 * m))
        }
        // stairs
        gAll.setAttribute('opacity', A.toFixed(3))
        gAll.setAttribute('display', A <= 0.004 ? 'none' : 'inline')
        const ft = ST.foot(s0)
        for (const S of stairs) {
          const o = f.stair ? f.stair(S.n) || {} : {}
          const a = o.a ?? 1
          if (a <= 0.004) { S.g.setAttribute('display', 'none'); S.names.show([], 0, 0); continue }
          S.g.removeAttribute('display')
          const cx = ST.colX(S.n, w) + (o.dx || 0), tr = ST.tread(S.n, s0) + (o.dy || 0), fy = ft + (o.dy || 0)
          const xa = cx - 56, xb = cx + 56
          S.block.setAttribute('d', blockPath(xa, xb, tr, fy))
          S.treadLine.setAttribute('d', `M${f1(xa + 5)} ${f1(tr + 1.5)} L${f1(xb - 5)} ${f1(tr + 1.5)}`)
          const fill = o.fill || 'unlit'
          const filled = fill === 'outline' ? clamp(o.filled ?? 0) : fill === 'none' ? 0 : 1
          const lit = clamp(o.lit ?? 0), col = o.color || 'chrome'
          const amt = col === 'chrome' ? ST.LIT.chrome : ST.LIT.color
          S.block.setAttribute('fill', rgb(mix(UNLIT, COLOR[col], amt * lit)))
          S.block.setAttribute('fill-opacity', filled.toFixed(3))
          // rim: chrome 40 % on a block, 55 % on an outline; in the colour when lit blue or orange
          const rimCol = col === 'chrome' ? CHROME : mix(CHROME, COLOR[col], lit)
          S.block.setAttribute('stroke', rgb(rimCol))
          S.block.setAttribute('stroke-opacity', lerp(0.55, 0.4 + (col === 'chrome' ? 0 : 0.5 * lit), filled).toFixed(3))
          S.treadLine.setAttribute('stroke-opacity', (0.7 * filled).toFixed(3))
          const sc2 = o.scale || 1
          const my = (tr + fy) / 2
          if (sc2 !== 1) S.g.setAttribute('transform', `translate(${f1(cx)} ${f1(my)}) scale(${sc2.toFixed(4)}) translate(${f1(-cx)} ${f1(-my)})`)
          else S.g.removeAttribute('transform')
          S.g.setAttribute('opacity', a.toFixed(3))
          S.names.show(o.names || [], cx, fy - 12, a)
        }
        // risers
        for (const Rz of risers) {
          const o = f.riser ? f.riser(Rz.n) || {} : {}
          const a = o.a ?? 1, state = o.state || 'unmeasured'
          if (a <= 0.004 || state === 'none') { Rz.g.setAttribute('display', 'none'); Rz.labels.show([], 0, 0); continue }
          Rz.g.removeAttribute('display')
          const x = ST.riserX(Rz.n, w), yLo = ST.tread(Rz.n, s0), yHi = ST.tread(Rz.n + 1, s0)
          const semi = (H[Rz.n] - H[Rz.n - 1]) === 1
          const hgt = yLo - yHi, sc2 = o.scale || 1
          const cy = (yLo + yHi) / 2, h2 = hgt * sc2
          const measured = state === 'tone' || state === 'semi'
          const bw = measured || state === 'measuring' ? 6 : 4
          const grow = measured ? clamp(o.grow ?? 1) : 1
          // the bar grows from the lower tread up
          const top2 = cy + h2 / 2 - h2 * grow
          Rz.bar.setAttribute('x', f1(x - bw / 2)); Rz.bar.setAttribute('width', bw)
          Rz.bar.setAttribute('y', f1(top2)); Rz.bar.setAttribute('height', f1(Math.max(0, h2 * grow)))
          Rz.bar.setAttribute('fill', state === 'semi' ? GOLD : '#c3ccd6')
          Rz.bar.setAttribute('fill-opacity', state === 'unmeasured' ? 0.4 : state === 'measuring' ? 0 : 1)
          Rz.outline.setAttribute('display', state === 'measuring' ? 'inline' : 'none')
          Rz.outline.setAttribute('x', f1(x - 3)); Rz.outline.setAttribute('width', 6)
          Rz.outline.setAttribute('y', f1(cy - h2 / 2)); Rz.outline.setAttribute('height', f1(h2))
          // a tone's tick at its middle row line: chrome 55 % while measured, dark once filled
          const showTick = !semi && (state === 'measuring' || (state === 'tone' && grow >= 0.5))
          Rz.tick.setAttribute('display', showTick ? 'inline' : 'none')
          Rz.tick.setAttribute('x', f1(x - 6)); Rz.tick.setAttribute('width', 12)
          Rz.tick.setAttribute('y', f1(cy - 1))
          Rz.tick.setAttribute('fill', state === 'measuring' ? '#c3ccd6' : '#2a323c')
          Rz.tick.setAttribute('fill-opacity', state === 'measuring' ? 0.55 : 1)
          Rz.g.setAttribute('opacity', a.toFixed(3))
          // label: right-aligned 2 px left of the measured bar (column centre + 55), baseline 8 px
          // above stair n's tread
          Rz.labels.show(o.labels || [], ST.colX(Rz.n, w) + 55, yLo - 8, a)
        }
        // houses
        const HS = f.houses || {}
        for (const [which, n] of [['bottom', 1], ['top', 8]]) {
          const o = HS[which]
          if (!o || (o.a ?? 0) <= 0.004) { houses[which].draw({ a: 0 }); continue }
          const b = ST.houseBox(n, o.w ?? w, o.s0 ?? s0)
          houses[which].draw({ x: b.x + (o.dx || 0), y: b.y + (o.dy || 0), a: o.a, lit: o.lit || 0, glow: o.glow || 0, scale: o.scale || 1 })
        }
      },
    }
    return st
  }

  /* ---------------------------------------------------------------- the keyboard strip */
  L.strip = (svg, { y0 = 760 } = {}) => {
    const gHair = L.svg('g', { class: 'strip-hair' }, svg)
    const g = L.svg('g', { class: 'strip' }, svg)
    const gW = L.svg('g', {}, g), gB = L.svg('g', {}, g), gN = L.svg('g', {}, g)
    const keys = []
    for (let m = 0; m <= 19; m++) {
      const black = ST.isBlack(m)
      const cx = KX[m]
      const k = { m, black, cx }
      if (!black) {
        const xa = cx - 58, xb = cx + 58, ya = y0, yb = y0 + 120, r = 6
        k.g = L.svg('g', {}, gW)
        k.el = L.svg('path', { d: `M${xa} ${ya} L${xb} ${ya} L${xb} ${yb - r} Q${xb} ${yb} ${xb - r} ${yb} L${xa + r} ${yb} Q${xa} ${yb} ${xa} ${yb - r} Z`, fill: '#e6edf3' }, k.g)
        k.names = labelPool(gN, { size: 34, family: 'JetBrains Mono', weight: 500, fill: '#2a323c', anchor: 'middle' })
        k.nameY = 862
      } else {
        k.g = L.svg('g', {}, gB)
        // an opaque backing, so a black key at 45 % darkens instead of showing the white keys through
        L.svg('rect', { x: cx - 32, y: y0, width: 64, height: 76, rx: 3, fill: L.C.obsidian }, k.g)
        k.el = L.svg('rect', { x: cx - 32, y: y0, width: 64, height: 76, rx: 3, fill: '#161b22', stroke: '#30363d', 'stroke-width': 2 }, k.g)
        k.names = labelPool(gN, { size: 28, family: 'JetBrains Mono', weight: 500, fill: L.C.ink, anchor: 'middle' })
        k.nameY = 822
      }
      keys.push(k)
    }
    const hairs = []
    for (let n = 1; n <= 8; n++) hairs.push(L.svg('line', { stroke: '#c3ccd6', 'stroke-opacity': 0.5, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, gHair))
    const WHITE_F = hex('#e6edf3'), BLACK_F = hex('#161b22')
    return {
      keys, key: (m) => keys[m],
      draw(f = {}) {
        const A = f.a ?? 1, dy = f.dy || 0
        g.setAttribute('opacity', A.toFixed(3))
        g.setAttribute('display', A <= 0.004 ? 'none' : 'inline')
        g.setAttribute('transform', `translate(0 ${f1(dy)})`)
        for (const k of keys) {
          const o = f.key ? f.key(k.m) || {} : {}
          const full = clamp(o.full ?? 0), lit = clamp(o.lit ?? 0), a = o.a ?? 1, sc = o.scale || 1
          // a key outside the scale has its fill (and rim) at 45 %
          const f45 = lerp(0.45, 1, Math.max(full, lit))
          if (k.black) {
            k.el.setAttribute('fill', rgb(mix(BLACK_F, CHROME, 0.4 * lit)))
            k.el.setAttribute('fill-opacity', f45.toFixed(3))
            k.el.setAttribute('stroke-opacity', f45.toFixed(3))
          } else {
            k.el.setAttribute('fill', rgb(WHITE_F))
            k.el.setAttribute('fill-opacity', (0.92 * f45).toFixed(3))
          }
          const cy = k.black ? y0 + 38 : y0 + 60
          if (sc !== 1) k.g.setAttribute('transform', `translate(${k.cx} ${cy}) scale(${sc.toFixed(4)}) translate(${-k.cx} ${-cy})`)
          else k.g.removeAttribute('transform')
          k.g.setAttribute('opacity', a.toFixed(3))
          k.names.show((o.names || []).map((it) => ({ ...it, scale: (it.scale || 1) * sc })), k.cx, k.nameY + dy, a * A)
        }
        const h = f.hair || {}
        const ha = (h.a ?? 0) * A
        gHair.setAttribute('display', ha <= 0.004 ? 'none' : 'inline')
        gHair.setAttribute('opacity', ha.toFixed(3))
        if (ha > 0.004) {
          const w = h.w ?? 0, s0 = h.s0 ?? 0, ft = ST.foot(s0)
          hairs.forEach((el, i) => {
            const n = i + 1
            el.setAttribute('x1', f1(ST.colX(n, w))); el.setAttribute('y1', f1(ft))
            el.setAttribute('x2', f1(ST.keyX(s0 + H[i]))); el.setAttribute('y2', f1(y0 + dy))
            el.setAttribute('opacity', (h.hA ? h.hA(n) : 1).toFixed(3))
          })
        }
      },
    }
  }

  /* ---------------------------------------------------------------- bead paths */
  // HANDOFFS § Beads. Positions in world units; times in scene seconds.
  const B = {
    // a hop of `dur` landing at t1, its centre peaking 40 px above the higher resting point: its
    // height a parabola in linear time, its x on sine.inOut, so it rises before it travels and
    // clears the riser labels (HANDOFFS § Shared formulas)
    hopAt(t, t1, p0, p1, { dur = 0.3, lift = 40, ease = 'sine.inOut' } = {}) {
      const u = clamp((t - (t1 - dur)) / dur), ux = L.ease(ease)(u)
      const [x0, y0] = p0, [x1, y1] = p1
      const d = y1 - y0, P = y0 - (Math.min(y0, y1) - lift)
      const A = (d + 2 * P) + 2 * Math.sqrt(Math.max(0, P * (d + P)))
      return [lerp(x0, x1, ux), y0 + d * u - A * u * (1 - u)]
    },
    // a landing squash at t1 (Lesson 2's L.hop shape): [scaleX, scaleY]
    squash(t, t1) {
      const dt = t - t1
      if (dt < 0 || dt > 0.26) return [1, 1]
      if (dt < 0.06) { const u = L.ease('power1.out')(dt / 0.06); return [1 + 0.12 * u, 1 - 0.18 * u] }
      const u = L.ease('back.out(3)')((dt - 0.06) / 0.2)
      return [1.12 - 0.12 * u, 0.82 + 0.18 * u]
    },
    // a drop onto its resting point at t1: 60 px over 0.2 s (power2.in), fading in over 0.08 s
    dropAt(t, t1, p, { dur = 0.2, h = 60 } = {}) {
      const u = L.prog(t, t1 - dur, dur, 'power2.in')
      const [sx, sy] = B.squash(t, t1)
      return { x: p[0], y: p[1] - h * (1 - u), a: clamp((t - (t1 - dur)) / 0.08), sx, sy }
    },
    // a rise from its resting point into a house's centre over 0.3 s (power2.out), shrinking
    riseAt(t, t0, p, house, { dur = 0.3 } = {}) {
      const u = L.prog(t, t0, dur, 'power2.out')
      return { x: lerp(p[0], house[0], u), y: lerp(p[1], house[1], u), scale: 1 - u }
    },
    // a run: steps [{ t, p }] (each landing time and resting point); before the first step's
    // landing it is not placed; between steps it rests, then hops to land on the next onset
    runAt(t, steps, opts = {}) {
      if (!steps.length || t < steps[0].t) return null
      for (let i = steps.length - 1; i >= 0; i--) {
        if (t >= steps[i].t) {
          const nx = steps[i + 1]
          const dur = opts.dur || 0.3
          if (nx && t >= nx.t - dur) {
            const [x, y] = B.hopAt(t, nx.t, steps[i].p, nx.p, opts)
            return { x, y, sx: 1, sy: 1, on: i, hopping: true }
          }
          const [sx, sy] = B.squash(t, steps[i].t)
          return { x: steps[i].p[0], y: steps[i].p[1], sx, sy, on: i, hopping: false }
        }
      }
      return null
    },
  }
  // set an L.bead from a state { x, y, a, scale, sx, sy } (null hides it); the squash is
  // about the bead's foot
  B.place = (b, s) => {
    if (!s || (s.a ?? 1) <= 0.004 || (s.scale ?? 1) <= 0.002) { b.g.setAttribute('display', 'none'); return }
    b.g.removeAttribute('display')
    b.g.setAttribute('transform', `translate(${f1(s.x)} ${f1(s.y)}) scale(${(s.scale ?? 1).toFixed(4)})`)
    b.g.setAttribute('opacity', (s.a ?? 1).toFixed(3))
    const sx = s.sx ?? 1, sy = s.sy ?? 1
    if (sx !== 1 || sy !== 1) b.body.setAttribute('transform', `translate(0 ${b.r}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(0 ${-b.r})`)
    else b.body.removeAttribute('transform')
  }
  L.bead4 = B
})()
