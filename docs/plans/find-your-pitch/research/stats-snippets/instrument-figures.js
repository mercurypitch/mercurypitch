/* ==========================================================================================
   INSTRUMENT FIGURES from the stats kit renderer (kit/template/app.js in
   https://dev.stats.maff.app/kit/app.ffcf540f.js), with the repository data stripped out so
   each one is a reusable drawing: metronome, vinyl record, orchestra hemicycle, piano-roll
   keyboard, fretboard, mixing-desk channel strip, LED spectrum column, step-sequencer pad and
   the crescendo hairpin. Line refs are to that bundle. All hand-built SVG, no chart library.
   ========================================================================================== */
const SVGNS = 'http://www.w3.org/2000/svg'
export function S(tag, attrs, parent) {
  const e = document.createElementNS(SVGNS, tag)
  for (const k in attrs || {})
    if (attrs[k] != null)
      k === 'text' ? (e.textContent = attrs[k]) : e.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(e)
  return e
}
const hex = (h) => {
  const v = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16))
}
export const mix = (a, b, t) =>
  '#' +
  hex(a)
    .map((v, i) =>
      Math.round(v + (hex(b)[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
export const alpha = (h, a) => {
  const [r, g, b] = hex(h)
  return `rgba(${r},${g},${b},${a})`
}
const defsOf = (svg) => svg.querySelector('defs') || S('defs', null, svg)
export const linGrad = (svg, id, stops, attrs) => {
  const g = S('linearGradient', Object.assign({ id }, attrs || {}), defsOf(svg))
  stops.forEach(([o, c, a]) =>
    S(
      'stop',
      { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a },
      g,
    ),
  )
  return `url(#${id})`
}
export const radGrad = (svg, id, stops, attrs) => {
  const g = S('radialGradient', Object.assign({ id }, attrs || {}), defsOf(svg))
  stops.forEach(([o, c, a]) =>
    S(
      'stop',
      { offset: o, 'stop-color': c, 'stop-opacity': a == null ? 1 : a },
      g,
    ),
  )
  return `url(#${id})`
}
// the kit's one glow: blur the shape and merge it under itself (lines 1063-1070)
export const glow = (svg, id, std = 2.4) => {
  if (!svg.querySelector('#' + id)) {
    const f = S(
      'filter',
      { id, x: '-60%', y: '-60%', width: '220%', height: '220%' },
      defsOf(svg),
    )
    S('feGaussianBlur', { stdDeviation: std, result: 'b' }, f)
    const m = S('feMerge', null, f)
    S('feMergeNode', { in: 'b' }, m)
    S('feMergeNode', { in: 'SourceGraphic' }, m)
  }
  return `url(#${id})`
}
export const COL = {
  bg: '#0d1117',
  panel: '#161b22',
  card: '#12171e',
  blue: '#58a6ff',
  aqua: '#2dd4bf',
  violet: '#bc8cff',
  brass: '#e3b341',
  rose: '#ff7b72',
  c100: '#f4f8fd',
  c300: '#c3ccd6',
  c500: '#8a97a6',
  c700: '#5b6b7b',
  c900: '#1b2430',
  ink: '#e6edf3',
}

/* ---------------------------------------------------------------- metronome (figMetronome, 1628-1653) */
// A 170 x 220 metronome whose arm swings +/-24deg; `seconds` is one swing (60 / bpm). In the kit the
// swing is a CSS animation; for a seekable video set the arm's rotation from time instead:
//   angle(t) = -24 cos(pi t / seconds)  (degrees, pivot 85 186), a sine swing like ease-in-out alternate.
export function metronomeSVG({ seconds = 1, C = COL } = {}) {
  return `<svg viewBox="0 0 170 220" aria-hidden="true"><defs>
  <linearGradient id="mt-body" x1="0" x2="1"><stop offset="0" stop-color="${C.c900}"/><stop offset=".45" stop-color="${C.c700}"/><stop offset=".55" stop-color="${mix(C.c700, C.bg, 0.3)}"/><stop offset="1" stop-color="${mix(C.c900, C.bg, 0.4)}"/></linearGradient></defs>
  <path d="M30 212 L140 212 L112 22 Q85 10 58 22 Z" fill="url(#mt-body)" stroke="${alpha(C.c300, 0.35)}"/>
  <path d="M52 186 L118 186 L101 44 Q85 36 69 44 Z" fill="${mix(C.bg, '#000000', 0.25)}" stroke="${alpha(C.c300, 0.18)}"/>
  ${Array.from({ length: 9 }, (_, i) => `<line x1="${78 - i * 0.9}" x2="${92 + i * 0.9}" y1="${60 + i * 14}" y2="${60 + i * 14}" stroke="${alpha(C.c300, 0.25)}"/>`).join('')}
  <g class="arm" style="transform-origin:85px 186px;animation:tick ${seconds}s ease-in-out infinite alternate"><line x1="85" y1="186" x2="85" y2="34" stroke="${C.c100}" stroke-width="3" stroke-linecap="round"/>
  <path d="M77 70 h16 l-3 14 h-10 z" fill="${C.blue}" stroke="${mix(C.blue, '#ffffff', 0.45)}"/></g>
  <circle cx="85" cy="186" r="5" fill="${C.c300}"/><rect x="24" y="210" width="122" height="7" rx="3" fill="${mix(C.bg, '#000000', 0.25)}" stroke="${alpha(C.c300, 0.25)}"/></svg>`
}
export const metronomeAngle = (t, seconds) =>
  -24 * Math.cos((Math.PI * t) / seconds)
// the kit's tempo names, for a lesson on tempo markings
export const tempoName = (b) =>
  b < 24
    ? 'Larghissimo'
    : b < 40
      ? 'Grave'
      : b < 60
        ? 'Largo'
        : b < 76
          ? 'Adagio'
          : b < 108
            ? 'Andante'
            : b < 120
              ? 'Moderato'
              : b < 168
                ? 'Allegro'
                : b < 200
                  ? 'Presto'
                  : 'Prestissimo'

/* ---------------------------------------------------------------- vinyl (figVinyl 2118-2161, figCover 2400-2420) */
// arc band from angle a0 to a1 (radians, clockwise from 12 o'clock) between radii r0 and r1, centre c
export function arcBand(c, a0, a1, r0, r1) {
  a1 = Math.min(a1, a0 + Math.PI * 2 - 1e-4)
  const p = (a, r) =>
      `${(c.x + r * Math.sin(a)).toFixed(2)} ${(c.y - r * Math.cos(a)).toFixed(2)}`,
    lg = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(a0, r1)}A${r1} ${r1} 0 ${lg} 1 ${p(a1, r1)}L${p(a1, r0)}A${r0} ${r0} 0 ${lg} 0 ${p(a0, r0)}Z`
}
// A record: black disc, hairline grooves every 2.3 px (every 9th one brighter), a spectrum label, a
// spindle hole and two fixed sheen wedges that do not rotate (so the disc reads as spinning).
// bands: [{ share, color }] become coloured rings of grooves (the share card's folders); omit for plain vinyl.
export function vinyl(
  svg,
  {
    cx = 320,
    cy = 320,
    rLabel = 94,
    rOut = 304,
    bands = null,
    labelColors = [COL.blue, COL.aqua, COL.violet],
  } = {},
) {
  const spin = S(
    'g',
    { class: 'spin', style: `transform-origin:${cx}px ${cy}px` },
    svg,
  )
  S(
    'circle',
    { cx, cy, r: rOut + 10, fill: '#050608', stroke: alpha(COL.c300, 0.15) },
    spin,
  )
  if (!bands)
    for (let r = rLabel + 4; r < rOut + 8; r += 2.3)
      S(
        'circle',
        {
          cx,
          cy,
          r: r.toFixed(1),
          fill: 'none',
          stroke: `rgba(255,255,255,${Math.round(r) % 9 === 0 ? 0.06 : 0.025})`,
          'stroke-width': 0.7,
        },
        spin,
      )
  else {
    let r = rLabel + 8
    const span = rOut - rLabel - 8 - bands.length * 1.4
    bands.forEach((b) => {
      const band = Math.max(1.6, b.share * span)
      for (let rr = r; rr < r + band; rr += 2.2)
        S(
          'circle',
          {
            cx,
            cy,
            r: rr.toFixed(1),
            fill: 'none',
            stroke: alpha(b.color, 0.2 + (rr % 6.6 < 2.2 ? 0.1 : 0)),
            'stroke-width': 0.9,
          },
          spin,
        )
      r += band + 1.4
      S(
        'circle',
        {
          cx,
          cy,
          r: (r - 0.7).toFixed(1),
          fill: 'none',
          stroke: 'rgba(0,0,0,.95)',
          'stroke-width': 1.8,
        },
        spin,
      )
    })
  }
  S(
    'circle',
    {
      cx,
      cy,
      r: rLabel,
      fill: linGrad(
        svg,
        'vin-label',
        labelColors.map((c, i) => [i / (labelColors.length - 1), c]),
        { x1: 0, y1: 0, x2: 1, y2: 1 },
      ),
    },
    spin,
  )
  S(
    'circle',
    { cx, cy, r: rLabel - 6, fill: 'none', stroke: 'rgba(13,17,23,.35)' },
    spin,
  )
  S('circle', { cx, cy, r: 5.5, fill: '#050608' }, spin)
  const sheen = linGrad(
    svg,
    'vin-sheen',
    [
      [0, '#ffffff', 0],
      [0.5, '#ffffff', 0.1],
      [1, '#ffffff', 0],
    ],
    { x1: 0, y1: 0, x2: 1, y2: 1 },
  )
  S(
    'path',
    {
      d: arcBand({ x: cx, y: cy }, -0.55, 0.25, rLabel + 4, rOut + 8),
      fill: sheen,
      'pointer-events': 'none',
    },
    svg,
  )
  S(
    'path',
    {
      d: arcBand(
        { x: cx, y: cy },
        Math.PI - 0.55,
        Math.PI + 0.25,
        rLabel + 4,
        rOut + 8,
      ),
      fill: sheen,
      'pointer-events': 'none',
    },
    svg,
  )
  return spin // CSS: .spin { animation: spin 140s linear infinite }  (33 1/3 rpm would be 1.8 s per turn)
}
// the share card's tonearm (pivot top right, cartridge resting on the outer grooves)
export function tonearm(svg, { px = 1142, py = 64, nx = 1055, ny = 134 } = {}) {
  S(
    'path',
    {
      d: `M${px} ${py}L${px - 10} ${py + 150}Q${px - 16} ${py + 214} ${nx + 18} ${ny + 26}`,
      fill: 'none',
      stroke: COL.c300,
      'stroke-width': 5,
      'stroke-linecap': 'round',
    },
    svg,
  )
  S(
    'rect',
    {
      x: nx + 2,
      y: ny + 12,
      width: 26,
      height: 14,
      rx: 3,
      fill: COL.c500,
      transform: `rotate(-38 ${nx + 15} ${ny + 19})`,
    },
    svg,
  )
  S(
    'circle',
    {
      cx: px,
      cy: py,
      r: 17,
      fill: radGrad(
        svg,
        'cv-piv',
        [
          [0, COL.c100],
          [0.6, COL.c500],
          [1, mix(COL.c700, COL.bg, 0.4)],
        ],
        { cx: 0.35, cy: 0.3, r: 0.9 },
      ),
    },
    svg,
  )
}

/* ---------------------------------------------------------------- orchestra hemicycle (figOrchestra 1241-1259) */
// N seats on `rows` concentric half rings from r0 to r1, outer rings holding more seats (in proportion
// to radius), ordered from the left of the stage to the right then outwards, as an orchestra is seated.
export function hemicycle(
  N,
  {
    cx = 550,
    cy = 478,
    r0 = 172,
    r1 = 448,
    rows = Math.max(1, Math.min(12, Math.ceil(N / 10))),
  } = {},
) {
  const radii =
    rows === 1
      ? [r0 + (r1 - r0) * 0.45]
      : Array.from(
          { length: rows },
          (_, i) => r0 + (i * (r1 - r0)) / (rows - 1),
        )
  const tot = radii.reduce((a, b) => a + b, 0),
    fr = radii.map((r) => (N * r) / tot),
    per = fr.map(Math.floor)
  let rem = N - per.reduce((a, b) => a + b, 0)
  fr.map((v, i) => [v - per[i], i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (rem > 0) {
        per[i]++
        rem--
      }
    })
  const seats = []
  radii.forEach((r, i) => {
    const n = per[i]
    for (let k = 0; k < n; k++) {
      const th = n === 1 ? Math.PI / 2 : Math.PI * (1 - k / (n - 1))
      seats.push({ r, th, x: cx + r * Math.cos(th), y: cy - r * Math.sin(th) })
    }
  })
  return seats.sort((a, b) => b.th - a.th || b.r - a.r) // left to right, outer first within a column
}
// a seat is a sphere: radial gradient from 60% white at (.36,.3) through the colour to 40% black, r 8.3
export const seatFill = (svg, id, color) =>
  radGrad(
    svg,
    id,
    [
      [0, mix(color, '#ffffff', 0.6)],
      [0.5, color],
      [1, mix(color, '#000000', 0.4)],
    ],
    { cx: 0.36, cy: 0.3, r: 0.8 },
  )
// the conductor's podium: a chrome half disc with a G clef cut into it (t-music 30 px in the bg colour)

/* ---------------------------------------------------------------- piano-roll keyboard (figPianoRoll 1543-1561) */
// 24 rows = two octaves from C3 (row 0, bottom) to B4 (row 23, top). White keys are full width with a
// cool-to-white gradient; black keys are 60% width with a near-black gradient. Rows behind black keys
// are darker, and a thin line marks each octave. rowH 12, keyboard 66 wide in the kit.
export const isBlack = (semitone) =>
  [1, 3, 6, 8, 10].includes(((semitone % 12) + 12) % 12)
export function pianoKeys(
  svg,
  {
    x = 4,
    top = 30,
    rowH = 12,
    KB = 66,
    rows = 24,
    lowMidi = 48,
    gridX = 74,
    gridW = 900,
    label = true,
  } = {},
) {
  const wk = linGrad(svg, 'pr-white', [
      [0, '#cfd7e0'],
      [0.85, '#f4f8fd'],
      [1, '#ffffff'],
    ]),
    bk = linGrad(svg, 'pr-black', [
      [0, '#0b0f14'],
      [0.8, '#2a323c'],
      [1, '#3b4552'],
    ])
  const yOf = (i) => top + (rows - 1 - i) * rowH,
    NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
  for (let i = 0; i < rows; i++)
    S(
      'rect',
      {
        x: gridX,
        y: yOf(i),
        width: gridW,
        height: rowH,
        fill: isBlack(lowMidi + i)
          ? mix(COL.bg, '#000000', 0.25)
          : mix(COL.bg, COL.panel, 0.4),
      },
      svg,
    )
  for (let i = 0; i < rows; i++) {
    if ((lowMidi + i) % 12 === 0 && i)
      S(
        'line',
        {
          x1: gridX,
          x2: gridX + gridW,
          y1: yOf(i) + rowH,
          y2: yOf(i) + rowH,
          stroke: alpha(COL.c300, 0.16),
        },
        svg,
      )
  }
  const kb = S('g', null, svg)
  for (let i = 0; i < rows; i++) {
    const y = yOf(i),
      m = lowMidi + i
    S(
      'rect',
      { x, y: y + 0.5, width: KB - 4, height: rowH - 1, rx: 1.5, fill: wk },
      kb,
    )
    if (isBlack(m))
      S(
        'rect',
        {
          x,
          y: y + 1,
          width: (KB - 4) * 0.6,
          height: rowH - 2,
          rx: 2,
          fill: bk,
        },
        kb,
      )
    else if (label && m % 12 === 0)
      S(
        'text',
        {
          x: KB - 4,
          y: y + 9,
          'text-anchor': 'end',
          style: 'font:600 8px "JetBrains Mono",monospace;fill:#2b3542',
          text: NAMES[m % 12] + (Math.floor(m / 12) - 1),
        },
        kb,
      )
  }
  return { yOf, rowH }
}
// a note on the roll: rounded bar inset 2 px top and bottom, coloured by a heat ramp of velocity
export const rollNote = (svg, { x, w, row, yOf, rowH, fill }) =>
  S(
    'rect',
    {
      x,
      y: yOf(row) + 2,
      width: Math.max(1, w),
      height: rowH - 4,
      rx: 1.4,
      fill,
    },
    svg,
  )
// the heat ramp: deep blue (72% toward the ground) -> dark blue -> blue -> aqua -> violet -> white
export const HEAT = [
  mix(COL.blue, COL.bg, 0.72),
  mix(COL.blue, '#000000', 0.3),
  COL.blue,
  COL.aqua,
  COL.violet,
  COL.c100,
]

/* ---------------------------------------------------------------- fretboard (figFretboard 1750-1787) */
// nS strings (thickest at the bottom), nF frets. Ebony gradient board, faint grain lines, a bone nut,
// pearl inlays at 3 5 7 9 15 17 19 21 and double dots at 12 and 24, gradient fret wires, wound
// strings (dash 1 1.4 over the heavier ones), and a ghost headstock with tuning pegs.
export function fretboard(
  svg,
  {
    L = 168,
    W = 1100,
    RM = 16,
    top = 40,
    sp = 34,
    nS = 6,
    nF = 24,
    weights = null,
  } = {},
) {
  const boardT = top - 20,
    boardB = top + (nS - 1) * sp + 20,
    fw = (W - L - RM) / nF,
    yOf = (i) => top + i * sp
  const ebony = linGrad(
    svg,
    'fb-ebony',
    [
      [0, mix(COL.bg, COL.panel, 0.5)],
      [0.5, mix(COL.bg, '#000000', 0.1)],
      [1, mix(COL.bg, '#000000', 0.3)],
    ],
    { x1: 0, x2: 0, y1: 0, y2: 1 },
  )
  const wire = linGrad(
    svg,
    'fb-wire',
    [
      [0, COL.c700],
      [0.5, COL.c100],
      [1, COL.c700],
    ],
    { x1: 0, x2: 1, y1: 0, y2: 0 },
  )
  S(
    'path',
    {
      d: `M${L - 6} ${boardT - 4}L${L - 150} ${boardT - 16}Q${L - 168} ${(boardT + boardB) / 2} ${L - 150} ${boardB + 16}L${L - 6} ${boardB + 4}Z`,
      fill: alpha(COL.c300, 0.035),
      stroke: alpha(COL.c300, 0.08),
    },
    svg,
  )
  S(
    'rect',
    {
      x: L,
      y: boardT,
      width: W - L - RM,
      height: boardB - boardT,
      rx: 3,
      fill: ebony,
    },
    svg,
  )
  for (let k = 0; k < 14; k++) {
    const y = boardT + 4 + (k * (boardB - boardT - 8)) / 13
    S(
      'line',
      {
        x1: L,
        x2: W - RM,
        y1: y,
        y2: y + (k % 2 ? 1.5 : -1.5),
        stroke: 'rgba(255,255,255,.018)',
      },
      svg,
    )
  }
  ;[boardT, boardB].forEach((y) =>
    S(
      'line',
      {
        x1: L,
        x2: W - RM,
        y1: y,
        y2: y,
        stroke: alpha(COL.c300, 0.4),
        'stroke-width': 1.2,
      },
      svg,
    ),
  )
  S(
    'rect',
    {
      x: L - 7,
      y: boardT - 2,
      width: 7,
      height: boardB - boardT + 4,
      rx: 1.5,
      fill: '#e9e4d6',
    },
    svg,
  ) // nut
  const inlayY = top + ((nS - 1) * sp) / 2,
    pearl = alpha(COL.c100, 0.16)
  ;[3, 5, 7, 9, 15, 17, 19, 21].forEach((f) => {
    if (f <= nF)
      S(
        'circle',
        { cx: L + (f - 0.5) * fw, cy: inlayY, r: 3.4, fill: pearl },
        svg,
      )
  })
  ;[12, 24].forEach((f) => {
    if (f <= nF && nS > 2)
      [-1, 1].forEach((s) =>
        S(
          'circle',
          { cx: L + (f - 0.5) * fw, cy: inlayY + s * sp, r: 3.4, fill: pearl },
          svg,
        ),
      )
  })
  for (let i = 1; i <= nF; i++)
    S(
      'rect',
      {
        x: L + i * fw - Math.min(1.2, fw / 6),
        y: boardT,
        width: Math.min(2.4, fw / 3),
        height: boardB - boardT,
        fill: wire,
        opacity: 0.75,
      },
      svg,
    )
  for (let i = 0; i < nS; i++) {
    const y = yOf(i),
      t = weights ? weights[i] : (i + 1) / nS,
      sw = 0.9 + 2.6 * t
    S(
      'line',
      {
        x1: L - 150,
        x2: L - 7,
        y1: (y - top) * 0.78 + top + 6,
        y2: y,
        stroke: alpha(COL.c300, 0.12),
        'stroke-width': sw * 0.8,
      },
      svg,
    )
    const str = S(
      'line',
      {
        class: 'gstring',
        x1: L - 7,
        x2: W - RM,
        y1: y,
        y2: y,
        stroke: COL.c300,
        'stroke-width': sw,
        opacity: 0.85,
      },
      svg,
    )
    if (sw > 2)
      S(
        'line',
        {
          x1: L - 7,
          x2: W - RM,
          y1: y,
          y2: y,
          stroke: mix(COL.c700, COL.bg, 0.4),
          'stroke-width': sw,
          'stroke-dasharray': '1 1.4',
          opacity: 0.9,
        },
        svg,
      )
    S(
      'circle',
      {
        cx: L - 140,
        cy: (y - top) * 0.78 + top + 6,
        r: 4.5,
        fill: radGrad(
          svg,
          'fb-peg' + i,
          [
            [0, COL.c100],
            [1, COL.c700],
          ],
          { cx: 0.35, cy: 0.3, r: 0.8 },
        ),
      },
      svg,
    )
  }
  // finger dot at fret f (1-based) on string i: circle in the string's colour, rgba(5,6,8,.65) rim, glow on the loudest
  return { yOf, fretX: (f) => L + (f - 0.5) * fw, fw }
}
// Guitar maths for a lesson: fret n of an open string at f0 sounds f0 * 2^(n/12); the fret's distance
// from the nut on a scale of length Ls is Ls (1 - 2^(-n/12)). (The kit spaces frets evenly; a lesson
// about frets should use the real spacing.)
export const fretPosition = (n, scaleLength) =>
  scaleLength * (1 - Math.pow(2, -n / 12))

/* ---------------------------------------------------------------- mixing-desk channel strip (figMixer 1355-1372) */
// One strip: a dark panel, a black readout, a 22-segment LED meter (top two segments whitened),
// a fader slot with ticks, a chrome fader cap, a cream tape label tilted by -1.6/0/1.6 deg and a
// glowing status LED. level in 0..1 (the kit uses log10(lines) / MAXLOG).
export function channelStrip(
  svg,
  {
    x,
    cw = 46,
    top = 64,
    fTop = 96,
    fBot = 340,
    stripY = 360,
    level = 0.5,
    color = COL.blue,
    label = 'Ch',
    readout = '',
    tilt = 0,
  },
) {
  const g = S('g', null, svg)
  S(
    'rect',
    {
      x: x + 2,
      y: top - 4,
      width: cw - 4,
      height: stripY + 44 - top,
      rx: 7,
      fill: mix(COL.bg, COL.card, 0.5),
      stroke: alpha(COL.c300, 0.07),
    },
    g,
  )
  S(
    'rect',
    {
      x: x + 5,
      y: top + 2,
      width: cw - 10,
      height: 19,
      rx: 4,
      fill: mix(COL.bg, '#000000', 0.55),
      stroke: alpha(COL.c300, 0.08),
    },
    g,
  )
  S(
    'text',
    {
      x: x + cw / 2,
      y: top + 15.5,
      'text-anchor': 'middle',
      style: `font:600 10.5px "JetBrains Mono",monospace;fill:${color}`,
      text: readout,
    },
    g,
  )
  const segs = 22,
    segH = (fBot - fTop) / segs,
    lit = Math.max(1, Math.round(level * segs)),
    mx = x + cw * 0.3 - 4,
    leds = []
  for (let k = 0; k < segs; k++) {
    const yy = fBot - (k + 1) * segH + 1,
      on = k < lit
    leds.push(
      S(
        'rect',
        {
          x: mx,
          y: yy.toFixed(1),
          width: 8,
          height: (segH - 2).toFixed(1),
          rx: 1.2,
          fill: on
            ? k >= lit - 2
              ? mix(color, '#ffffff', 0.5)
              : color
            : alpha(COL.c300, 0.05),
          opacity: on ? (0.5 + (0.5 * k) / segs).toFixed(2) : 1,
        },
        g,
      ),
    )
  }
  const fx = x + cw * 0.68,
    capG = linGrad(
      svg,
      'mx-cap',
      [
        [0, COL.c100],
        [0.45, mix(COL.c300, COL.c500, 0.4)],
        [0.55, COL.c700],
        [1, COL.c300],
      ],
      { x1: 0, x2: 0, y1: 0, y2: 1 },
    )
  S(
    'rect',
    {
      x: fx - 1.5,
      y: fTop,
      width: 3,
      height: fBot - fTop,
      rx: 1.5,
      fill: mix(COL.bg, '#000000', 0.7),
      stroke: alpha(COL.c300, 0.1),
    },
    g,
  )
  const fy = fBot - level * (fBot - fTop),
    cap = S('g', { class: 'fader' }, g)
  S(
    'rect',
    {
      x: fx - 11,
      y: fy - 7,
      width: 22,
      height: 14,
      rx: 2.5,
      fill: capG,
      stroke: 'rgba(0,0,0,.7)',
    },
    cap,
  )
  S(
    'line',
    {
      x1: fx - 9,
      x2: fx + 9,
      y1: fy,
      y2: fy,
      stroke: COL.bg,
      'stroke-width': 1.5,
    },
    cap,
  )
  const sg = S(
    'g',
    { transform: `rotate(${tilt} ${x + cw / 2} ${stripY + 12})` },
    g,
  )
  S(
    'rect',
    {
      x: x + 4,
      y: stripY,
      width: cw - 8,
      height: 25,
      rx: 2,
      fill: '#ece5d2',
      opacity: 0.94,
    },
    sg,
  ) // masking-tape label
  S(
    'text',
    {
      x: x + cw / 2,
      y: stripY + 17.5,
      'text-anchor': 'middle',
      style: 'font:italic 400 14px "Instrument Serif",serif;fill:#1b2430',
      text: label,
    },
    sg,
  )
  S(
    'circle',
    {
      cx: x + cw / 2,
      cy: stripY + 37,
      r: 2.8,
      fill: color,
      filter: glow(svg, 'mx-led', 1.6),
    },
    g,
  )
  return { g, leds, cap } // animate a live meter by toggling leds[k] fills and translating cap
}
// decibels for a lesson on loudness: 20 log10(amplitude ratio); the desk maps 10^e lines to e / MAXLOG

/* ---------------------------------------------------------------- LED spectrum column (figCadence 2035-2039) */
// segs stacked rounded LEDs, lit ones coloured by a ramp along the column; a white 3 px peak-hold cap.
export function ledColumn(
  svg,
  { x, w, bot, segH, segs, lit, ramp, peak = null },
) {
  for (let k = 0; k < segs; k++) {
    const y = bot - (k + 1) * segH + 1,
      on = k < lit
    S(
      'rect',
      {
        x,
        y,
        width: w,
        height: Math.max(0.6, segH - 2),
        rx: 1.5,
        fill: on ? ramp(k / Math.max(1, segs - 1)) : alpha(COL.c300, 0.045),
      },
      svg,
    )
  }
  if (peak != null)
    S(
      'rect',
      {
        x: x - 2,
        y: bot - peak * segH - 3,
        width: w + 4,
        height: 3,
        rx: 1.5,
        fill: COL.c100,
        opacity: 0.92,
      },
      svg,
    )
}

/* ---------------------------------------------------------------- step-sequencer pad (figSequencer 1608-1612) */
// A drum-machine pad: dark rounded square, a heat-coloured inset at opacity .2 + .8 t, and a white LED
// with a glow on the busiest fifth. Hour groups of four carry coloured bars (rose, rose-brass, brass,
// ink, aqua, blue), like the step buttons of a TR-style machine.
export function pad(svg, { x, y, size, t, fill, led = false, ledFilter }) {
  const g = S('g', null, svg)
  S(
    'rect',
    {
      x,
      y,
      width: size,
      height: size,
      rx: 4,
      fill: mix(COL.bg, COL.panel, 0.6),
      stroke: alpha(COL.c300, 0.07),
    },
    g,
  )
  if (t > 0)
    S(
      'rect',
      {
        x: x + 1,
        y: y + 1,
        width: size - 2,
        height: size - 2,
        rx: 3.5,
        fill,
        opacity: (0.2 + 0.8 * t).toFixed(2),
      },
      g,
    )
  if (led)
    S(
      'circle',
      {
        cx: x + size / 2,
        cy: y + 4.2,
        r: 1.7,
        fill: '#ffffff',
        filter: ledFilter,
      },
      g,
    )
  return g
}

/* ---------------------------------------------------------------- crescendo hairpin (figCrescendo 1680-1683) */
export function hairpin(svg, { x0, x1, y, open = 7, cresc = true }) {
  const d = cresc
    ? `M${x1} ${y - open}L${x0} ${y}L${x1} ${y + open}`
    : `M${x0} ${y - open}L${x1} ${y}L${x0} ${y + open}`
  S(
    'path',
    { d, fill: 'none', stroke: alpha(COL.c300, 0.55), 'stroke-width': 1.3 },
    svg,
  )
  S(
    'text',
    {
      x: x0 - 8,
      y: y + 6,
      'text-anchor': 'end',
      style: 'font:italic 700 19px "Instrument Serif",serif;fill:#c3ccd6',
      text: cresc ? 'pp' : 'ff',
    },
    svg,
  )
  S(
    'text',
    {
      x: x1 + 8,
      y: y + 6,
      style: 'font:italic 700 19px "Instrument Serif",serif;fill:#c3ccd6',
      text: cresc ? 'ff' : 'pp',
    },
    svg,
  )
}

/* ---------------------------------------------------------------- notes as a scale (figDepth 2251-2256) */
// "How deep the tree goes": each value is a notehead (rx 10 ry 7 rotate -22) on top of a soft 30%
// stem bar, on a five-line staff 36 apart; a zero draws a quarter rest glyph (U+1D13D) instead.
