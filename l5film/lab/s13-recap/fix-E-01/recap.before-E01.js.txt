/* Find Your Pitch, Lesson 5 kit: the recap and the practise cards (HANDOFFS § Recap and practise (S13);
   § The cuts, S12 to S13 and S13 to S14). window.L, after chart.js. F0 from the matched cut; the panel and
   the cards are frame-fixed (hud), the frame and its objects are the world's (at F0 the same pixels).

     L.RECAP            FROM (the frame on F-turn's pixels at the cut: x 928 to 1824, line 153, k 1.4, band 104 to
                        202), TO (the recap frame: x 232 to 1688, line 600, k 1.3, band 554.5 to 645.5, W 10: 145.6
                        px a second), frameAt(u) the slide's geometry for the band chart (13a: u eased by the
                        scene, power2.inOut), mercW(u) Merc's line's world weight through it (5.6 to 4, so the
                        cut holds F-turn's pixels), voiceOK(u) (no voice line until the slide lands: the
                        wave rule holds only at the recap frame), LABELS ("A, any octave" x 232, "in the band" x 520, baseline 510;
                        "ILLUSTRATION" right-aligned 1688, centred y 500), FLAG (x 332, y 538.5 to 554.5), PANEL
                        (x 120 to 960, y 140 to 330, radius 16; its question Outfit 600 40 from x 150, baselines
                        220 and 280; its ring timer at (910, 250); answers serif italic from x 150: one line 64 px
                        at 400, two lines 56 px at 392 and 452), TRACES (card 2: L.TRACE.RECAP), FIGURE
                        (card 1: L.FIGURE.S13), VM (the Voice Mirror card: its panel's foot for each row, every
                        line's text, font, x and baseline, the glyphs), REST (the rest card), DRIFT (14 px)
     const pn = L.panel(svg, { x0, y0, x1, y1, r = 16 })
     pn.draw({ a = 1, y1 = null (its foot, eased by the scene as rows land), dy = 0 })
                        chrome 25 % stroke, obsidian fill 85 %
     L.glyph(svg, kind, { x = 270, y }) -> { g, draw({ a, dy }) }   the card's 40 px chrome glyphs: 'glide' (up
                        and down arrows), 'hold' (a held line), 'dots' (five dots r 4 at x 272 to 308; .dot(i)
                        is the dot's centre, the first carried as the tease's first bead)
*/
;(function () {
  const L = window.L
  const C = L.C
  const f2 = L.f2
  const clamp = L.clamp

  const FROM = { x0: 928, x1: 1824, y0: 153, k: 1.4, W: 10 }
  const TO = { x0: 232, x1: 1688, y0: 600, k: 1.3, W: 10 }
  L.RECAP = {
    FROM, TO,
    frameAt(u) {
      const m = (k) => L.lerp(FROM[k], TO[k], clamp(u))
      return { x0: m('x0'), x1: m('x1'), y0: m('y0'), k: m('k'), W: 10 }
    },
    // Merc's line's weight through the slide: F-turn's 4 x 1.4 = 5.6 px at the cut (the carried line holds its
    // pixels), easing to the chart's own 4 at the recap frame
    mercW: (u) => L.lerp(5.6, 4, clamp(u)),
    // a voice's line is drawn only where the frame keeps the wave rule (ch.waveRule().ok): at the cut only
    // Merc's line shows (as 12h), and Tavi's hold comes in once the slide has landed (critic-kit-01 item 10)
    voiceOK: (u) => clamp(u) >= 1,
    LABELS: { anyOctave: { text: 'A, any octave', x: 232, y: 510, size: 30 }, inBand: { text: 'in the band', x: 520, y: 510, size: 30 }, tag: { x: 1688, y: 500, anchor: 'end' } },
    FLAG: { x: 332, y: 554.5 },
    PANEL: { x0: 120, y0: 140, x1: 960, y1: 330, r: 16, question: { x: 150, y: [220, 280], size: 40 }, ring: { x: 910, y: 250 }, answer1: { x: 150, y: 400, size: 64 }, answer2: { x: 150, y: [392, 452], size: 56 } },
    FIGURE: null,
    TRACES: null,
    VM: {
      panel: { x0: 230, x1: 1110, y0: 90, feet: [300, 360, 420, 480, 625, 685, 730, 790] },
      practise: { text: 'Practise it.', x: 270, y: 150, size: 40 },
      title: { text: 'Voice Mirror', x: 270, y: 250, size: 96, family: 'serif' }, rule: { x0: 270, x1: 1070, y: 272 },
      rows: [
        { text: 'Voice Mirror has you glide up and down,', x: 326, y: 340, glyph: 'glide', gy: 328 },
        { text: 'hold any comfortable note for six seconds,', x: 326, y: 400, glyph: 'hold', gy: 388 },
        { text: 'then sing back five notes it plays.', x: 326, y: 460, glyph: 'dots', gy: 448 },
      ],
      rowSize: 34,
      readout: { text: 'For the hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn’t counted against you.', x: 270, y: [525, 565, 605], size: 32, family: 'inter', width: 800 },
      keep: { text: 'Keep the glides comfortable.', x: 270, y: 665, size: 34, weight: 500 },
      sore: { text: 'Sore, hoarse or unwell today? Just listen along.', x: 270, y: 710, size: 34, weight: 500 },
      free: { text: 'Free, no account: mercurypitch.com/mirror', x: 270, y: 765, size: 40, underlineY: 777 },
      ten: [{ text: 'Ten minutes, gently, most days.', y: 822 }, { text: 'Missed a day? Just come back.', y: 862 }], tenX: 270, tenSize: 34,
    },
    REST: {
      panel: { x0: 1130, x1: 1690, y0: 250, y1: 600 },
      question: [{ text: 'Felt uncomfortable, or listened', y: 296 }, { text: 'along today?', y: 332 }], x: 1160, qSize: 28,
      title: { text: 'Rest today', y: 416, size: 72 },
      body: [{ text: 'Voice Mirror will be here when', y: 470 }, { text: 'your voice feels comfortable:', y: 508 }], bodySize: 30,
      address: { text: 'mercurypitch.com/mirror', y: 566, size: 36, underlineY: 576 },
    },
    DRIFT: 14,
  }
  // filled in once the modules that own them have loaded (scripts.txt order: figure.js and folds.js first)
  L.RECAP.FIGURE = L.FIGURE ? L.FIGURE.S13 : null
  L.RECAP.TRACES = L.TRACE ? L.TRACE.RECAP : null

  L.panel = (svg, { x0 = 120, y0 = 140, x1 = 960, y1 = 330, r = 16 } = {}) => {
    const rect = L.svg('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: r, fill: C.ground, 'fill-opacity': 0.85, stroke: C.chrome, 'stroke-opacity': 0.25, 'stroke-width': 2, opacity: 0 }, svg)
    return {
      g: rect,
      draw({ a = 1, y1: foot = null, dy = 0 } = {}) {
        rect.setAttribute('opacity', clamp(a).toFixed(3))
        rect.setAttribute('y', f2(y0 + dy))
        rect.setAttribute('height', f2((foot ?? y1) - y0))
      },
    }
  }

  L.glyph = (svg, kind, { x = 270, y = 0 } = {}) => {
    const g = L.svg('g', { opacity: 0, class: 'glyph' }, svg)
    const sk = { fill: 'none', stroke: C.chrome, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
    const dots = []
    if (kind === 'glide') {
      L.svg('path', { ...sk, d: `M${x + 8} ${y + 14} L${x + 8} ${y - 14} M${x + 1} ${y - 7} L${x + 8} ${y - 14} L${x + 15} ${y - 7}` }, g)
      L.svg('path', { ...sk, d: `M${x + 26} ${y - 14} L${x + 26} ${y + 14} M${x + 19} ${y + 7} L${x + 26} ${y + 14} L${x + 33} ${y + 7}` }, g)
    } else if (kind === 'hold') {
      L.svg('path', { ...sk, d: `M${x + 2} ${y + 8} Q${x + 8} ${y - 6} ${x + 14} ${y} L${x + 38} ${y}` }, g)
      L.svg('rect', { x: x + 36, y: y - 8, width: 3, height: 16, rx: 1.5, fill: C.chrome }, g)
    } else {
      for (let i = 0; i < 5; i++) dots.push(L.svg('circle', { cx: x + 2 + 9 * i, cy: y, r: 4, fill: C.chrome }, g))
    }
    return {
      g,
      dot: (i) => [x + 2 + 9 * i, y],
      dots,
      draw({ a = 1, dy = 0 } = {}) {
        g.setAttribute('opacity', clamp(a).toFixed(3))
        g.setAttribute('transform', dy ? `translate(0 ${f2(dy)})` : '')
      },
    }
  }
})()
