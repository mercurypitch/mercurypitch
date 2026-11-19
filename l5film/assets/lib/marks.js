/* Find Your Pitch, Lesson 5 kit: type and marks. window.L, after motion.js. Lesson 4's calls, rebuilt
   (its marks.js was lost), plus this film's tags, chips and guesses. Every maker builds its elements
   once and draws per frame; nothing shows until it is drawn (opacity 0 at build).

   Type (STORYBOARD § Type): kickers JetBrains Mono 500 30 px, uppercase, tracking .18em, ink-2, at
   (120, 110); big ideas Instrument Serif italic; numbers Outfit 600 tabular; diagram labels Outfit 600.

     L.text(parent, str, { x, y, size = 36, family = 'outfit' | 'inter' | 'mono' | 'serif', weight = 600,
                           italic, anchor = 'start', fill = ink, tracking (em), upper, tabular, opacity = 0 })
                       an SVG text; family names L.FONT's keys (serif is italic unless italic: false)
     L.place(el, { a, dx = 0, dy = 0, scale = 1, ox, oy })   opacity, then translate and a scale about
                       (ox, oy); a counted pulse scales about the label's LEFT BASELINE (STORYBOARD § Type)
     L.label(parent, str, opts) -> { el, w(), left(), back, draw({ a, dx, dy, scale }), life(t, tIn, tOut,
                       fadeOpts, pulses, kind) }   a text that knows its left baseline: life() fades it
                       in and out with L.fade and pulses it (L.pulse) about its left baseline; opts.back
                       puts an opaque ground box behind it (8 x 6 px round the font box) so a cursor
                       drawn under it never shows through (the gauge's labels)
     L.kicker(hud, text, { x = 120, y = 110 }) -> { g, el, draw(t, tIn, tOut, { outDur = 0.2, upFast }) }
                       in: fades over 0.2 s while it glides 18 px in from the left (0.45 s, power2.out)
     L.chapterCard(hud, { num, title, baseline = 480, tIn, tOut }) -> { g, draw(t) }
                       Lesson 1's act card, never wider than 1680 px (a long title scales down to fit,
                       breathing included: card.fit()): the numeral ("01"; none for null) in aqua, Instrument Serif
                       italic 300 px, beside the title in chrome serif italic 170 px, centred on x 960;
                       in from tIn (0.85 s, expo.out, rising 40 px), breathing 1 to 1.03 until tOut,
                       out up fast from tOut (0.38 s, power3.in)
     L.ringTimer(hud, { x, y, r = 18 }) -> { g, draw(t, t0, dur) }   a dot whose ring draws round,
                       clockwise from 12 o'clock, over dur; fades in 0.2 s at t0, out 0.25 s after
     L.pill(layer, text, { x, y, size = 34, anchor = 'start', h = 52, pad = 24, x1 = null, check = 'outside' })
                       -> { g, x0, x1, w, draw({ alpha, scale, check, dx, dy, dim }) }
                       a chrome-stroked capsule, y its centre; x1 fixes its right end (HANDOFFS' widths);
                       check 0..1 draws the ink check at its left (centred 20 px outside, or inside
                       the pad with check: 'inside'); dim 0..1 dims its stroke, never its text
     L.chipRow(parent, words, { right = 1800 | left, y = 87, gap = 12 }) -> { chips, layout, draw(opts | (i) => opts) }
                       a row of chips laid out again once the fonts are in, exactly `gap` px apart (the four words)
     L.chip(parent, text, { x, y, size = 30, h = 38, pad = 14, anchor = 'start', x1 = null })
                       -> { g, x0, x1, w, draw({ alpha, lit, underline, scale, dx, dy }) }
                       the four words and Quiet / Loud: dim, ink-2 in a chrome 25 % outline; lit (1),
                       ink in a chrome 60 % outline; underline 0..1 draws a 2 px chrome rule under it
     L.tag(parent, text, { x, y, anchor = 'end', size = 26, opaque = false }) -> { g, x0, x1, w, draw({ alpha, dx, dy, scale }) }
                       the board's chip, one maker for "ILLUSTRATION", "LISTEN ONLY" and "SLOWED ·
                       ILLUSTRATION": JetBrains Mono 500 26 px, tracking .18em, ink-2, in a 40 px pill
                       (chrome 25 % outline over the ground at 85 %), 16 px each side, y its centre;
                       set in the units of the layer it is in (world px on a drawing, screen px in hud)
     L.TAGS            the three texts
     L.spell(parent, text, { x, y, size, family, weight, fill, anchor }) -> { g, text, draw({ px, py,
                       alpha, scale }) }   a label whose ♯ and ♭ are set in Noto Music
     L.bracket(parent, { x1, x2, y, dir = 'up', tick = 10, color = chrome, width = 2, vertical = false })
                       -> { g, draw(progress, alpha), color(c), set({ x1, x2, y }) }   grows from its middle
     L.arrow(parent, { x1, y1, x2, y2, via = null, color = ink, width = 3, head = 12 })
                       -> { g, draw(progress, alpha), set({ x1, y1, x2, y2, via }) }   drawn on from (x1,
                       y1); `via` makes it a quadratic curve; head 0 is a plain leader
     L.leader(parent, { x1, y1, x2, y2, color = chrome, width = 1.5 })   an L.arrow with no head
     L.check(parent, { x, y, size = 22, color = ink, width = 4 }) -> { g, draw(progress, alpha, scale) }
     L.GUESS           Tavi's guesses: { stroke: ink-2, width: 3, dash: '10 8', q: 64 }
     L.guess(parent, { d | points, q: { x, y, size = 64, anchor } | null, head = 0 })
                       -> { g, path, qEl, draw(progress, alpha, qAlpha = alpha, qScale = 1) }
                       a dashed ink-2 line drawn on from its start, with its "?" (Outfit 600, ink-2)
     L.underline(parent, { x1, x2, y, color = chrome, width = 2 }) -> { g, draw(progress, alpha) }
     L.icon(parent, name, { x, y, size = 36, color = ink, width = 1.8 })   the app's own SVG icons
                       (learn/05.html's set): 'leaf' (the comfort line's), 'halt'
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2

  const familyCss = (family, italic) => {
    const f = L.FONT[family] || family
    return `font-family: ${f};${italic ? ' font-style: italic;' : ''}`
  }
  L.text = (parent, str, { x = 0, y = 0, size = 36, family = 'outfit', weight = 600, italic = null, anchor = 'start', fill = C.ink, tracking = 0, upper = false, tabular = false, opacity = 0 } = {}) => {
    const it = italic == null ? family === 'serif' : italic
    const style = `${familyCss(family, it)} font-weight: ${family === 'serif' ? 400 : weight}; font-size: ${size}px;` +
      (tracking ? ` letter-spacing: ${tracking}em;` : '') + (tabular ? ' font-variant-numeric: tabular-nums;' : '') + ' white-space: pre;'
    return L.svg('text', { x, y, 'text-anchor': anchor, fill, opacity, text: upper ? String(str).toUpperCase() : str, style }, parent)
  }
  L.place = (el, { a = 1, dx = 0, dy = 0, scale = 1, ox = 0, oy = 0 } = {}) => {
    el.setAttribute('opacity', L.clamp(a).toFixed(3))
    let tr = dx || dy ? `translate(${f2(dx)} ${f2(dy)})` : ''
    if (Math.abs(scale - 1) > 1e-4) tr += ` translate(${f2(ox)} ${f2(oy)}) scale(${scale.toFixed(4)}) translate(${f2(-ox)} ${f2(-oy)})`
    if (tr) el.setAttribute('transform', tr)
    else el.removeAttribute('transform')
  }
  L.label = (parent, str, opts = {}) => {
    // opts.back: an opaque ground-coloured box behind the glyphs (padX 8, padY 6 round the font's box), so a
    // cursor or line drawn under the label never shows through it (the gauge's labels, critic-kit-01 item 2)
    let host = parent, backG = null, backR = null
    if (opts.back) {
      backG = L.svg('g', { opacity: 0, class: 'label-back' }, parent)
      backR = L.svg('rect', { fill: C.ground, rx: 6 }, backG)
      host = backG
    }
    const el = L.text(host, str, opts.back ? { ...opts, opacity: 1 } : opts)
    const x = opts.x || 0, y = opts.y || 0, anchor = opts.anchor || 'start'
    if (backR) L.afterFonts(() => {
      try {
        const b = el.getBBox(), px = opts.backPadX ?? 8, py = opts.backPadY ?? 6
        backR.setAttribute('x', f2(b.x - px)); backR.setAttribute('y', f2(b.y - py))
        backR.setAttribute('width', f2(b.width + 2 * px)); backR.setAttribute('height', f2(b.height + 2 * py))
      } catch (e) { /* measured again once the fonts are in */ }
    })
    let w = null
    const width = () => {
      if (w == null || w === 0) { try { w = el.getComputedTextLength() } catch (e) { w = 0 } }
      return w
    }
    L.afterFonts(() => { w = null; width() })
    const left = () => (anchor === 'start' ? x : anchor === 'end' ? x - width() : x - width() / 2)
    const lab = {
      el, w: width, left,
      back: backR,
      setText(s) {
        el.textContent = s; w = null
        if (backR) { const b = el.getBBox(), px = opts.backPadX ?? 8, py = opts.backPadY ?? 6; backR.setAttribute('x', f2(b.x - px)); backR.setAttribute('width', f2(b.width + 2 * px)); backR.setAttribute('y', f2(b.y - py)); backR.setAttribute('height', f2(b.height + 2 * py)) }
      },
      draw({ a = 1, dx = 0, dy = 0, scale = 1 } = {}) { L.place(backG || el, { a, dx, dy, scale, ox: left(), oy: y }) },
      life(t, tIn, tOut, fadeOpts = {}, pulses = null, kind = 'label') {
        const f = L.fade(t, tIn, tOut, fadeOpts)
        lab.draw({ a: f.a, dy: f.dy, scale: pulses == null ? 1 : L.pulse(t, pulses, kind) })
        return f.a
      },
    }
    return lab
  }

  /* ---------------------------------------------------------------- kicker and chapter card */
  L.kicker = (hud, text, { x = 120, y = 110 } = {}) => {
    const svg = L.stageOf(hud)
    const g = L.svg('g', { opacity: 0 }, svg)
    const el = L.text(g, text, { x, y, size: 30, family: 'mono', weight: 500, fill: C.ink2, tracking: 0.18, upper: true, opacity: 1 })
    return {
      g, el,
      draw(t, tIn, tOut, { outDur = 0.2, upFast = false } = {}) {
        const a = L.prog(t, tIn, 0.2, 'power2.out') * (tOut == null ? 1 : 1 - L.prog(t, tOut, upFast ? 0.3 : outDur, upFast ? 'power3.in' : 'power2.in'))
        const dx = -18 * (1 - L.prog(t, tIn, 0.45, 'power2.out'))
        const dy = upFast && tOut != null ? -16 * L.prog(t, tOut, 0.3, 'power3.in') : 0
        g.setAttribute('opacity', a.toFixed(3))
        g.setAttribute('transform', `translate(${f2(dx)} ${f2(dy)})`)
      },
    }
  }

  L.chapterCard = (hud, { num = null, title = '', baseline = 480, tIn = 0, tOut = 1 } = {}) => {
    const svg = L.stageOf(hud)
    const id = L.uid('card')
    const g = L.svg('g', { opacity: 0, class: 'chapter-card' }, svg)
    const defs = L.svg('defs', {}, g)
    const grad = L.svg('linearGradient', { id: id + '-chrome', gradientUnits: 'userSpaceOnUse', x1: 0, x2: 0, y1: baseline - 130, y2: baseline + 10 }, defs)
    ;[[0, '#ffffff'], [0.3, '#dce3eb'], [0.58, '#a6b1bd'], [0.78, '#e6edf3'], [1, '#b6c0cb']].forEach(([o, c]) => L.svg('stop', { offset: o, 'stop-color': c }, grad))
    const inner = L.svg('g', {}, g)
    const numEl = num == null ? null : L.text(inner, String(num).padStart(2, '0'), { x: 0, y: baseline, size: 300, family: 'serif', fill: C.aqua, opacity: 1 })
    const titleEl = L.text(inner, title, { x: 0, y: baseline, size: 170, family: 'serif', fill: `url(#${id}-chrome)`, opacity: 1 })
    titleEl.setAttribute('data-layout-allow-overlap', '')
    const GAP = 44, MAXW = 1680, BREATH = 1.03
    let fit = 1                                   // a long title is scaled down so the card, breathing to 1.03, stays within 1680 px
    const layout = () => {
      const nw = numEl ? numEl.getComputedTextLength() : 0
      const tw = titleEl.getComputedTextLength()
      const total = nw + (numEl ? GAP : 0) + tw
      const x0 = 960 - total / 2
      if (numEl) numEl.setAttribute('x', f2(x0))
      titleEl.setAttribute('x', f2(x0 + nw + (numEl ? GAP : 0)))
      // the cap measures the glyphs' own box (the italic overhangs its advance), breathing included
      let bw = total
      try { bw = Math.max(total, inner.getBBox().width) } catch (e) { /* measured again once the fonts are in */ }
      fit = Math.min(1, (MAXW - 2) / (BREATH * bw))     // 2 px kept for the glyphs' antialiased edge
    }
    L.afterFonts(layout)
    return {
      g, numEl, titleEl, fit: () => fit,
      draw(t) {
        const inU = L.prog(t, tIn, 0.85, 'expo.out')
        const a = L.prog(t, tIn, 0.35, 'power2.out') * (1 - L.prog(t, tOut, 0.38, 'power3.in'))
        const dy = 40 * (1 - inU) - 90 * L.prog(t, tOut, 0.38, 'power3.in')
        const s = fit * (1 + (BREATH - 1) * L.prog(t, tIn, Math.max(0.01, tOut - tIn), 'sine.inOut'))
        g.setAttribute('opacity', a.toFixed(3))
        inner.setAttribute('transform', `translate(0 ${f2(dy)}) translate(960 ${baseline - 60}) scale(${s.toFixed(4)}) translate(-960 ${-(baseline - 60)})`)
      },
    }
  }

  /* ---------------------------------------------------------------- ring timer */
  L.ringTimer = (hud, { x, y, r = 18 } = {}) => {
    const svg = hud.tagName && hud.tagName.toLowerCase() === 'svg' ? hud : hud.ownerSVGElement ? hud : L.stageOf(hud)
    const g = L.svg('g', { opacity: 0, transform: `translate(${x} ${y})` }, svg)
    L.svg('circle', { r, fill: 'none', stroke: C.chrome, 'stroke-opacity': 0.25, 'stroke-width': 3 }, g)
    const arc = L.svg('circle', { r, fill: 'none', stroke: C.chrome, 'stroke-width': 3, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '0 1', transform: 'rotate(-90)' }, g)
    L.svg('circle', { r: 3.5, fill: C.ink2 }, g)
    return {
      g, x, y, r,
      draw(t, t0, dur) {
        const a = L.prog(t, t0 - 0.2, 0.2, 'power2.out') * (1 - L.prog(t, t0 + dur, 0.25, 'power2.in'))
        const u = L.prog(t, t0, dur, 'none')
        g.setAttribute('opacity', a.toFixed(3))
        arc.setAttribute('stroke-dasharray', `${u.toFixed(4)} 1`)
      },
    }
  }

  /* ---------------------------------------------------------------- pills, chips and tags */
  const measureLater = (el, fn) => L.afterFonts(() => fn(el.getComputedTextLength()))
  L.pill = (layer, text, { x = 0, y = 0, size = 34, anchor = 'start', h = 52, pad = 24, x1 = null, check = 'outside', family = 'outfit', weight = 600 } = {}) => {
    const svg = layer.tagName && layer.tagName.toLowerCase() === 'svg' ? layer : layer.ownerSVGElement ? layer : L.stageOf(layer)
    const g = L.svg('g', { opacity: 0, class: 'pill' }, svg)
    const box = L.svg('rect', { y: y - h / 2, height: h, rx: h / 2, fill: C.ground, 'fill-opacity': 0.7, stroke: C.chrome, 'stroke-width': 2, 'stroke-opacity': 0.7 }, g)
    const el = L.text(g, text, { x: 0, y: y + 0.35 * size, size, family, weight, opacity: 1 })
    const chk = L.check(g, { x: 0, y, size: 22, color: C.ink, width: 4 })
    const P = { g, el, box, x0: x, x1: x, w: 0 }
    const layout = (tw) => {
      const w = x1 != null ? x1 - x : tw + 2 * pad
      const x0 = x1 != null ? x : anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
      P.x0 = x0; P.x1 = x0 + w; P.w = w
      box.setAttribute('x', f2(x0)); box.setAttribute('width', f2(w))
      el.setAttribute('x', f2(x1 != null ? x0 + (w - tw) / 2 : x0 + pad))
      chk.g.setAttribute('data-x', f2(check === 'inside' ? x0 + pad * 0.9 : x0 - 20))
    }
    layout(text.length * size * 0.5)
    measureLater(el, layout)
    P.draw = ({ alpha = 1, scale = 1, check: ck = 0, dx = 0, dy = 0, dim = 0 } = {}) => {
      g.setAttribute('opacity', L.clamp(alpha).toFixed(3))
      const cx = P.x0 + P.w / 2
      g.setAttribute('transform', `translate(${f2(dx)} ${f2(dy)}) translate(${f2(cx)} ${y}) scale(${scale.toFixed(4)}) translate(${f2(-cx)} ${-y})`)
      box.setAttribute('stroke-opacity', (0.7 * (1 - 0.6 * dim)).toFixed(3))
      const cxk = Number(chk.g.getAttribute('data-x'))
      chk.g.setAttribute('transform', `translate(${f2(cxk)} ${y})`)
      chk.draw(ck, ck > 0 ? 1 : 0)
    }
    return P
  }

  L.chip = (parent, text, { x = 0, y = 0, size = 30, h = 38, pad = 14, anchor = 'start', x1 = null, family = 'outfit', weight = 600 } = {}) => {
    const svg = parent.tagName && parent.tagName.toLowerCase() === 'svg' ? parent : parent.ownerSVGElement ? parent : L.stageOf(parent)
    const g = L.svg('g', { opacity: 0, class: 'chip' }, svg)
    const box = L.svg('rect', { y: y - h / 2, height: h, rx: 8, fill: C.ground, 'fill-opacity': 0.6, stroke: C.chrome, 'stroke-width': 1.5, 'stroke-opacity': 0.25 }, g)
    const el = L.text(g, text, { x: 0, y: y + 0.35 * size, size, family, weight, fill: C.ink2, opacity: 1 })
    const ul = L.svg('rect', { y: y + h / 2 + 4, height: 2, width: 0, fill: C.chrome }, g)
    const P = { g, el, box, x0: x, x1: x, w: 0 }
    const layout = (tw) => {
      const w = x1 != null ? x1 - x : tw + 2 * pad
      const x0 = x1 != null ? x : anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
      P.x0 = x0; P.x1 = x0 + w; P.w = w; P.tw = tw
      box.setAttribute('x', f2(x0)); box.setAttribute('width', f2(w))
      el.setAttribute('x', f2(x1 != null ? x0 + pad : x0 + pad))
      ul.setAttribute('x', f2(x0 + pad))
    }
    layout(text.length * size * 0.5)
    measureLater(el, layout)
    P.place = (nx) => { x = nx; anchor = 'start'; x1 = null; layout(el.getComputedTextLength()) }   // its left edge (L.chipRow)
    P.draw = ({ alpha = 1, lit = 0, underline = 0, scale = 1, dx = 0, dy = 0 } = {}) => {
      g.setAttribute('opacity', L.clamp(alpha).toFixed(3))
      const ox = P.x0
      g.setAttribute('transform', `translate(${f2(dx)} ${f2(dy)}) translate(${f2(ox)} ${y}) scale(${scale.toFixed(4)}) translate(${f2(-ox)} ${-y})`)
      el.setAttribute('fill', L.mixHex(C.ink2, C.ink, lit))
      box.setAttribute('stroke-opacity', (0.25 + 0.35 * L.clamp(lit)).toFixed(3))
      ul.setAttribute('width', f2((P.tw || 0) * L.clamp(underline)))
    }
    return P
  }

  L.TAGS = { illustration: 'ILLUSTRATION', listen: 'LISTEN ONLY', slowed: 'SLOWED · ILLUSTRATION' }
  L.tag = (parent, text, { x = 0, y = 0, anchor = 'end', size = 26, opaque = false } = {}) => {
    const svg = parent.tagName && parent.tagName.toLowerCase() === 'svg' ? parent : parent.ownerSVGElement ? parent : L.stageOf(parent)
    const g = L.svg('g', { opacity: 0, class: 'tag' }, svg)
    const H = 40, PAD = 16, TR = 0.18
    const box = L.svg('rect', { y: y - H / 2, height: H, rx: H / 2, fill: C.ground, 'fill-opacity': opaque ? 1 : 0.85, stroke: C.chrome, 'stroke-width': 1.5, 'stroke-opacity': 0.25 }, g)
    const el = L.text(g, text, { x: 0, y: y + 0.36 * size, size, family: 'mono', weight: 500, fill: C.ink2, tracking: TR, upper: true, opacity: 1 })
    const P = { g, el, box, x0: x, x1: x, w: 0 }
    // the ink's width: JetBrains Mono's advance (0.6 em) a character, plus the tracking between them,
    // never after the last (the board's 271, 250 and 453 px); measured once the font is in
    const layout = (tl) => {
      const n = [...text].length
      const tw = tl - TR * size              // getComputedTextLength counts the tracking after the last glyph
      const w = tw + 2 * PAD
      const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
      P.x0 = x0; P.x1 = x0 + w; P.w = w; P.tw = tw; P.n = n
      box.setAttribute('x', f2(x0)); box.setAttribute('width', f2(w))
      el.setAttribute('x', f2(x0 + PAD))
    }
    layout([...text].length * 0.78 * size)
    measureLater(el, layout)
    P.draw = ({ alpha = 1, dx = 0, dy = 0, scale = 1 } = {}) => {
      g.setAttribute('opacity', L.clamp(alpha).toFixed(3))
      const cx = P.x0 + P.w / 2
      g.setAttribute('transform', `translate(${f2(dx)} ${f2(dy)})` + (scale !== 1 ? ` translate(${f2(cx)} ${y}) scale(${scale.toFixed(4)}) translate(${f2(-cx)} ${-y})` : ''))
    }
    return P
  }

  // a row of chips, right-aligned to `right` (or left-aligned from `left`), `gap` px apart, laid out again
  // once the fonts are in (each chip's own width is measured late; a row placed from estimates drifts)
  L.chipRow = (parent, words, { right = 1800, left = null, y = 87, gap = 12, size = 30, h = 38, pad = 14 } = {}) => {
    const chips = words.map((w) => L.chip(parent, w, { x: 0, y, size, h, pad, anchor: 'start' }))
    const layout = () => {
      const ws = chips.map((c) => c.el.getComputedTextLength() + 2 * pad)
      const total = ws.reduce((a, b) => a + b, 0) + gap * (chips.length - 1)
      let x = left != null ? left : right - total
      chips.forEach((c, i) => { c.place(x); x += ws[i] + gap })
    }
    layout()
    L.afterFonts(layout)
    return { chips, layout, draw: (f) => chips.forEach((c, i) => c.draw(typeof f === 'function' ? f(i) : f)) }
  }

  /* ---------------------------------------------------------------- spelled labels */
  L.spell = (parent, text, { x = 0, y = 0, size = 36, family = 'Outfit', weight = 600, fill = C.ink, anchor = 'start' } = {}) => {
    const g = L.svg('g', { opacity: 0 }, parent)
    const el = L.svg('text', { x: 0, y: 0, 'text-anchor': anchor, fill, style: `font-family: '${family.replace(/'/g, '')}'; font-weight: ${weight}; font-size: ${size}px; white-space: pre;` }, g)
    // Noto Music sets its accidentals for a staff, low on the baseline: raised 0.3 em (the lab's still of
    // "A♯ is B♭" puts their tops near the cap height), and the text after them set back down
    let up = false
    for (const part of String(text).split(/([♯♭])/)) {
      if (!part) continue
      const acc = part === '♯' || part === '♭'
      const dy = acc && !up ? -0.3 * size : !acc && up ? 0.3 * size : 0
      L.svg('tspan', { text: part, dy: dy ? f2(dy) : null, style: acc ? `font-family: ${L.FONT.music}; font-size: ${(size * 0.92).toFixed(1)}px;` : null }, el)
      up = acc
    }
    const S = {
      g, text: el,
      draw({ px = x, py = y, alpha = 1, scale = 1 } = {}) {
        g.setAttribute('opacity', L.clamp(alpha).toFixed(3))
        g.setAttribute('transform', `translate(${f2(px)} ${f2(py)}) scale(${scale.toFixed(4)})`)
      },
    }
    return S
  }

  /* ---------------------------------------------------------------- brackets, arrows, checks, guesses */
  L.bracket = (parent, { x1, x2, y, dir = 'up', tick = 10, color = C.chrome, width = 2, vertical = false } = {}) => {
    const g = L.svg('g', { opacity: 0 }, parent)
    const path = L.svg('path', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
    const geo = { x1, x2, y }
    const B = {
      g, path,
      set(o) { Object.assign(geo, o) },
      color(c) { path.setAttribute('stroke', c) },
      draw(progress = 1, alpha = 1) {
        const u = L.clamp(progress)
        g.setAttribute('opacity', (u > 0 ? L.clamp(alpha) : 0).toFixed(3))
        const m = (geo.x1 + geo.x2) / 2, h = ((geo.x2 - geo.x1) / 2) * u
        const a = m - h, b = m + h, s = dir === 'up' ? -1 : 1
        const tk = tick * L.smooth(0.85, 1, u)
        const d = vertical
          ? `M${f2(geo.y - s * tk)} ${f2(a)} L${f2(geo.y)} ${f2(a)} L${f2(geo.y)} ${f2(b)} L${f2(geo.y - s * tk)} ${f2(b)}`
          : `M${f2(a)} ${f2(geo.y + s * tk)} L${f2(a)} ${f2(geo.y)} L${f2(b)} ${f2(geo.y)} L${f2(b)} ${f2(geo.y + s * tk)}`
        path.setAttribute('d', d)
      },
    }
    return B
  }

  L.arrow = (parent, { x1 = 0, y1 = 0, x2 = 0, y2 = 0, via = null, color = C.ink, width = 3, head = 12, opacity = 1 } = {}) => {
    const g = L.svg('g', { opacity: 0 }, parent)
    const shaft = L.svg('path', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-opacity': opacity }, g)
    const tip = L.svg('path', { fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': opacity }, g)
    const geo = { x1, y1, x2, y2, via }
    const at = (u) => {
      if (!geo.via) return [L.lerp(geo.x1, geo.x2, u), L.lerp(geo.y1, geo.y2, u)]
      const v = 1 - u, q = geo.via
      return [v * v * geo.x1 + 2 * u * v * q[0] + u * u * geo.x2, v * v * geo.y1 + 2 * u * v * q[1] + u * u * geo.y2]
    }
    const A = {
      g, shaft, tip, at,
      set(o) { Object.assign(geo, o) },
      draw(progress = 1, alpha = 1) {
        const u = L.clamp(progress)
        if (u <= 0.001 || alpha <= 0.004) { g.setAttribute('opacity', '0'); return }
        g.setAttribute('opacity', L.clamp(alpha).toFixed(3))
        const n = geo.via ? 24 : 1
        let d = ''
        for (let i = 0; i <= n; i++) { const p = at((u * i) / n); d += (i ? 'L' : 'M') + f2(p[0]) + ' ' + f2(p[1]) }
        shaft.setAttribute('d', d)
        if (head > 0) {
          const e = at(u), e0 = at(Math.max(0, u - 0.02))
          const ang = Math.atan2(e[1] - e0[1], e[0] - e0[0])
          const hx = (k) => e[0] - head * Math.cos(ang + k), hy = (k) => e[1] - head * Math.sin(ang + k)
          tip.setAttribute('d', `M${f2(hx(0.5))} ${f2(hy(0.5))} L${f2(e[0])} ${f2(e[1])} L${f2(hx(-0.5))} ${f2(hy(-0.5))}`)
        } else tip.removeAttribute('d')
      },
    }
    return A
  }
  L.leader = (parent, o = {}) => L.arrow(parent, { color: C.chrome, width: 1.5, head: 0, ...o })

  L.check = (parent, { x = 0, y = 0, size = 22, color = C.ink, width = 4 } = {}) => {
    const g = L.svg('g', { opacity: 0, transform: `translate(${x} ${y})` }, parent)
    const k = size / 22
    const p = L.svg('path', { d: `M${-11 * k} ${1 * k} L${-3 * k} ${9 * k} L${12 * k} ${-9 * k}`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, g)
    return {
      g, path: p,
      draw(progress = 1, alpha = 1, scale = 1) {
        g.setAttribute('opacity', (progress > 0 ? L.clamp(alpha) : 0).toFixed(3))
        p.setAttribute('stroke-dashoffset', (1 - L.clamp(progress)).toFixed(4))
        if (scale !== 1) p.setAttribute('transform', `scale(${scale.toFixed(4)})`)
        else p.removeAttribute('transform')
      },
    }
  }

  L.GUESS = { stroke: C.ink2, width: 3, dash: '10 8', q: 64 }
  L.guess = (parent, { d = null, points = null, q = null, head = 0 } = {}) => {
    const id = L.uid('guess')
    const g = L.svg('g', { opacity: 0, class: 'guess' }, parent)
    const path = d || (points || []).map((p, i) => (i ? 'L' : 'M') + f2(p[0]) + ' ' + f2(p[1])).join(' ')
    const defs = L.svg('defs', {}, g)
    const mask = L.svg('mask', { id, maskUnits: 'userSpaceOnUse', x: -4000, y: -4000, width: 10000, height: 10000 }, defs)
    const reveal = L.svg('path', { d: path, fill: 'none', stroke: '#fff', 'stroke-width': 14, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, mask)
    const line = L.svg('path', { d: path, fill: 'none', stroke: L.GUESS.stroke, 'stroke-width': L.GUESS.width, 'stroke-dasharray': L.GUESS.dash, mask: `url(#${id})` }, g)
    let tip = null
    if (head > 0 && points && points.length > 1) {
      const a = points[points.length - 2], b = points[points.length - 1]
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
      const hx = (k) => b[0] - head * Math.cos(ang + k), hy = (k) => b[1] - head * Math.sin(ang + k)
      tip = L.svg('path', { d: `M${f2(hx(0.5))} ${f2(hy(0.5))} L${f2(b[0])} ${f2(b[1])} L${f2(hx(-0.5))} ${f2(hy(-0.5))}`, fill: 'none', stroke: L.GUESS.stroke, 'stroke-width': L.GUESS.width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, g)
    }
    const qEl = q ? L.text(g, '?', { x: q.x, y: q.y, size: q.size || L.GUESS.q, fill: L.GUESS.stroke, anchor: q.anchor || 'start', opacity: 0 }) : null
    return {
      g, path: line, qEl,
      draw(progress = 1, alpha = 1, qAlpha = null, qScale = 1) {
        const u = L.clamp(progress)
        g.setAttribute('opacity', L.clamp(alpha).toFixed(3))
        reveal.setAttribute('stroke-dashoffset', (1 - u).toFixed(4))
        if (tip) tip.setAttribute('opacity', u >= 0.98 ? '1' : '0')
        if (qEl) L.place(qEl, { a: qAlpha == null ? (u >= 1 ? 1 : 0) : qAlpha, scale: qScale, ox: q.x, oy: q.y })
      },
    }
  }

  L.underline = (parent, { x1 = 0, x2 = 0, y = 0, color = C.chrome, width = 2 } = {}) => {
    const r = L.svg('rect', { x: x1, y: y - width / 2, height: width, width: 0, fill: color, opacity: 0 }, parent)
    return {
      g: r,
      draw(progress = 1, alpha = 1) {
        r.setAttribute('width', f2((x2 - x1) * L.clamp(progress)))
        r.setAttribute('opacity', (progress > 0 ? L.clamp(alpha) : 0).toFixed(3))
      },
    }
  }

  // The app's icons (learn/05.html's inline symbol set; 24 x 24, stroked)
  const ICONS = {
    leaf: ['M12 21c-4.4-2.2-7-5.6-7-9.6C5 7 8.5 4 12 3c3.5 1 7 4 7 8.4 0 4-2.6 7.4-7 9.6z', 'M12 8v13'],
    halt: ['M8.6 3.5h6.8l5.1 5.1v6.8l-5.1 5.1H8.6l-5.1-5.1V8.6z', 'M8.5 12h7'],
  }
  L.icon = (parent, name, { x = 0, y = 0, size = 36, color = C.ink, width = 1.8 } = {}) => {
    const k = size / 24
    const g = L.svg('g', { opacity: 0, transform: `translate(${x} ${y}) scale(${k.toFixed(4)})` }, parent)
    for (const d of ICONS[name] || []) L.svg('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
    return g
  }
})()
