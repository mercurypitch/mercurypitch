/* Find Your Pitch, Lesson 5 kit: the viewer's turn (HANDOFFS § The turn (S11, S12); § The hold frame at the
   right half). window.L, after chart.js. The frame and the ring are world drawings (F0 from 364.73, pushed
   to F-turn, 1.4x, from 422.80); the care block and the feel block are frame-fixed (hud).

     L.TURN             FRAME (the band chart's place: x 1000 to 1640, band y 210 to 280, line y 245, 64 px a
                        second, W 10, k 1.0: L.CHART.FRAME), BRACKET (y 292, x 1000 to 1640, end ticks; "0" x 1000
                        and "10 s" right-aligned 1640, Outfit 600 30 ink-2, baseline 322), VOICES ("A3 · Merc",
                        a blue dot r 6 at x 1000, text from 1016; "A4 · Tavi, an octave up", an orange dot at
                        1186, text from 1202; Outfit 600 30 ink, baseline 362), NOTHING ("Nothing listens" x 1000,
                        baseline 402), BREATHE_IN ("Breathe in, low and quiet" Outfit 600 28, right-aligned 1640,
                        baseline 402), RING ({ cx 1320, cy 590, r 160, stroke 10 }), PHASE (the word inside,
                        Outfit 600 40, baseline 548), COUNTER (Outfit 600 80 tabular, baseline 640), ROW ("Listen ·
                        Breathe · Sing" mono 28 ink-2, then Outfit 500 30 ink lines, centred x 1320, baselines
                        790, 828, 864), playhead(t) = 1000 + 64 t, CARE (the care block: every line's text, font,
                        x and baseline; the icon's top-left (260, 236), 36 px), FEEL (the question, the capsules,
                        the lines and the bracket), FTURN (L.FRAMES['F-turn'])
     const rg = L.ring(svg, { cx, cy, r })   the page's breathing ring as a clock
     rg.draw({ a = 1, draw = 1 (the track drawing on, 11e), trackA = 0.35, arc = 0 (0..1, clockwise from 12
               o'clock: angle = 36 t over the hold), tick = 0 (0..1 the 12 o'clock tick brightening),
               scale = 1 (the breath, 1 to 1.08 and back), words = [] ([{ text, a, dy }], L.swap's),
               counts = [] (the same for the counter) })
                        track chrome 35 %, stroke 10; the arc chrome at full with a soft glow; the tick 4 x 24;
                        it never pulses with sound (Nothing listens, FACTS 87)
     L.playhead(svg) -> { draw({ x, y0, y1, a }) }   a 3 px chrome playhead the band's height
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp

  L.TURN = {
    FRAME: L.CHART.FRAME,
    BRACKET: { y: 292, x0: 1000, x1: 1640, tick: 8, labels: { y: 322, size: 30 } },
    VOICES: [{ text: 'A3 · Merc', dot: 1000, x: 1016, color: C.blue }, { text: 'A4 · Tavi, an octave up', dot: 1186, x: 1202, color: C.orange }], voicesY: 362,
    NOTHING: { text: 'Nothing listens', x: 1000, y: 402, size: 30 },
    BREATHE_IN: { text: 'Breathe in, low and quiet', x: 1640, y: 402, size: 28, anchor: 'end' },
    RING: { cx: 1320, cy: 590, r: 160, stroke: 10 },
    PHASE: { y: 548, size: 40 },
    COUNTER: { y: 640, size: 80 },
    ROW: { x: 1320, y: [790, 828, 864], texts: ['Listen · Breathe · Sing', 'at about speaking volume', 'stop sooner if you need to'] },
    playhead: (t) => 1000 + 64 * t,
    FTURN: L.FRAMES['F-turn'],
    CARE: {
      x: 260, right: 960, foot: 864,
      title: { text: 'Your turn.', x: 260, y: 200, size: 110, family: 'serif' },
      icon: { name: 'leaf', x: 260, y: 236, size: 36 },
      comfort: [{ text: 'Sore, hoarse or unwell today?', x: 310, y: 262, size: 36, weight: 700 }, { text: 'Just listen along.', x: 310, y: 306, size: 36, weight: 700 }],
      reasons: [
        { text: 'hurts or uncomfortable · unusually hoarse or tired', y: 352 },
        { text: 'usual notes suddenly gone · ill', y: 390 },
        { text: 'talking or singing is hard work', y: 428 },
      ],
      reasonSize: 30, reasonWeight: 500,
      listening: { text: 'listening along: rest your voice and watch the ring', x: 260, y: 486, size: 30, weight: 500 },
      stop: [{ text: 'Stop immediately if anything', y: 548 }, { text: 'feels uncomfortable.', y: 590 }], stopSize: 36,
      doctorSmall: { size: 30, family: 'inter', fill: C.ink2, y: [650, 688, 726, 764, 802], width: 700 },
      doctorFull: { size: 40, family: 'inter', fill: C.ink, y: [430, 480, 530, 580, 630, 680], width: 700 },
      doctor: 'If hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it’s very painful, or breathing or swallowing is hard, get help straight away.',
    },
    FEEL: {
      question: { text: 'How did that feel?', x: 1000, y: 480, size: 64, family: 'serif' },
      ring: { x: 1660, y: 458, r: 16 },
      capsules: { x0: 1000, x1: 1230, h: 44, y: [540, 596, 652, 708], texts: ['Easy', 'Workable', 'Effortful', 'Uncomfortable'], size: 30 },
      lines: [{ text: 'rest a few easy breaths', y: 579 }, { text: 'rest before you sing again', y: 663 }, { text: 'enough singing for today', y: 719 }], linesX: 1260, linesSize: 30,
      bracket: { x: 1240, y0: 540, y1: 596 },
    },
  }
  // the doctor lines broken where the font puts them within `width` px (measured once the font is in)
  L.TURN.breakLines = (svg, text, { size = 30, family = 'inter', width = 700, weight = 400 } = {}) => {
    const probe = L.text(svg, '', { size, family, weight, opacity: 0 })
    const words = text.split(' ')
    const out = []
    let line = ''
    for (const w of words) {
      const next = line ? line + ' ' + w : w
      probe.textContent = next
      if (line && probe.getComputedTextLength() > width) { out.push(line); line = w } else line = next
    }
    if (line) out.push(line)
    probe.remove()
    return out
  }

  L.ring = (svg, { cx = 1320, cy = 590, r = 160 } = {}) => {
    const id = L.uid('ring')
    const g = L.svg('g', { class: 'turn-ring', opacity: 0 }, svg)
    const defs = L.svg('defs', {}, g)
    const blur = L.svg('filter', { id: id + '-glow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs)
    L.svg('feGaussianBlur', { stdDeviation: 5 }, blur)
    const inner = L.svg('g', {}, g)
    const track = L.svg('circle', { cx, cy, r, fill: 'none', stroke: C.chrome, 'stroke-opacity': 0.35, 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': '1 1', transform: `rotate(-90 ${cx} ${cy})` }, inner)
    const arcGlow = L.svg('circle', { cx, cy, r, fill: 'none', stroke: C.chrome, 'stroke-opacity': 0.5, 'stroke-width': 14, pathLength: 1, 'stroke-dasharray': '0 1', transform: `rotate(-90 ${cx} ${cy})`, filter: `url(#${id}-glow)` }, inner)
    const arc = L.svg('circle', { cx, cy, r, fill: 'none', stroke: C.chrome, 'stroke-width': 10, pathLength: 1, 'stroke-dasharray': '0 1', transform: `rotate(-90 ${cx} ${cy})` }, inner)
    const tick = L.svg('rect', { x: cx - 2, y: cy - r - 12, width: 4, height: 24, rx: 2, fill: C.chrome }, inner)
    const pool = (y, size, tabular) => {
      const m = new Map()
      return (list) => {
        const seen = new Set()
        for (const it of list || []) {
          if (!m.has(it.text)) m.set(it.text, L.text(inner, it.text, { x: cx, y, size, anchor: 'middle', tabular }))
          L.place(m.get(it.text), { a: it.a, dy: it.dy || 0 })
          seen.add(it.text)
        }
        for (const [k, el] of m) if (!seen.has(k)) el.setAttribute('opacity', '0')
      }
    }
    const words = pool(cy - 42, 40, false), counts = pool(cy + 50, 80, true)
    return {
      g,
      draw({ a = 1, draw = 1, trackA = 0.35, arc: u = 0, tick: tk = 0, scale = 1, words: w = [], counts: c = [] } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        inner.setAttribute('transform', scale !== 1 ? `translate(${cx} ${cy}) scale(${scale.toFixed(4)}) translate(${-cx} ${-cy})` : '')
        track.setAttribute('stroke-dashoffset', (1 - clamp(draw)).toFixed(4))
        track.setAttribute('stroke-opacity', trackA.toFixed(3))
        arc.setAttribute('stroke-dasharray', `${clamp(u).toFixed(5)} 1`)
        arcGlow.setAttribute('stroke-dasharray', `${clamp(u).toFixed(5)} 1`)
        arc.setAttribute('opacity', u > 0 ? '1' : '0'); arcGlow.setAttribute('opacity', u > 0 ? '1' : '0')
        tick.setAttribute('fill-opacity', (0.55 + 0.45 * clamp(tk)).toFixed(3))
        tick.setAttribute('opacity', L.smooth(0.6, 1, draw).toFixed(3))
        words(w); counts(c)
      },
    }
  }
  L.playhead = (svg) => {
    const r = L.svg('rect', { width: 3, fill: C.chrome, opacity: 0 }, svg)
    return {
      g: r,
      draw({ x = 1000, y0 = 210, y1 = 280, a = 1 } = {}) {
        r.setAttribute('x', f2(x - 1.5)); r.setAttribute('y', f2(y0)); r.setAttribute('height', f2(y1 - y0))
        r.setAttribute('opacity', clamp(a).toFixed(3))
      },
    }
  }
})()
