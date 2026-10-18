/* ==========================================================================================
   STAFF ENGRAVING, lifted from the stats kit (kit/template/app.js, figScore -> engrave/stem/beam,
   tacet, noteKey) and generalised so it scales with one number: the staff space `s`.

   Source geometry (stats kit, s = 6 user units):
     staff lines   y = yb - ln * 6         (ln 0..4, yb = bottom line)
     staff step    y = yb - k * 3          (k = diatonic steps above the bottom line)
     notehead      ellipse rx 3.7 ry 2.6 rotate(-22)   hollow (half/whole): fill bg, stroke 1.35
     stem          x +/- 3.4, length 21, up when k < 4 (below the middle line), on the right;
                   down on the left otherwise
     flag          M x y0 c .4 (-dir*3.6) 6.4 (-dir*4.8) 5.4 (-dir*10.5), 5 apart
     ledger        x +/- 5.6, every even k >= 10 and every even k <= -2
     beam          slab 2.8 thick, 16ths add a slab 4.6 further in, slope clamped to +/-0.16,
                   every stem at least 15 long, default 20
   All numbers below are those values divided by 6, so `s` scales the whole engraving.

   Deterministic: no randomness, no clocks. Every function returns or appends plain SVG, so a
   HyperFrames timeline (GSAP) can animate the returned groups directly.
   Clefs and accidentals use Noto Music outlines (SIL OFL 1.1) from noto-music-glyph-paths.json,
   so the video never depends on a web font having loaded.
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

/* ---------------------------------------------------------------- pitch -> staff step */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// 'C4', 'F#5', 'Bb3', 'Ebb4', 'Fx4' -> { letter, acc (-2..2), octave, diatonic }
export function parsePitch(p) {
  const m = /^([A-Ga-g])(bb|b|#|x|##|n)?(-?\d)$/.exec(String(p).trim())
  if (!m) throw new Error(`not a pitch: ${p}`)
  const letter = m[1].toUpperCase(),
    a = m[2] || '',
    octave = +m[3]
  const acc = { '': 0, n: 0, b: -1, bb: -2, '#': 1, x: 2, '##': 2 }[a]
  return {
    letter,
    acc,
    octave,
    natural: a === 'n',
    diatonic: octave * 7 + LETTERS.indexOf(letter),
  }
}
// the bottom line of each clef, as a diatonic index (octave * 7 + letter)
export const CLEF_BOTTOM = {
  treble: 4 * 7 + 2 /* E4 */,
  bass: 2 * 7 + 4 /* G2 */,
  alto: 3 * 7 + 3 /* F3 */,
}
export const stepOf = (pitch, clef = 'treble') =>
  parsePitch(pitch).diatonic - CLEF_BOTTOM[clef]
export const midiOf = (pitch) => {
  const p = parsePitch(pitch)
  return (
    12 * (p.octave + 1) +
    [0, 2, 4, 5, 7, 9, 11][LETTERS.indexOf(p.letter)] +
    p.acc
  )
}
export const hzOf = (pitch) => 440 * Math.pow(2, (midiOf(pitch) - 69) / 12)

/* ---------------------------------------------------------------- the staff */
// a five-line staff from x0 to x1, bottom line at yb. Returns the group.
export function staff(
  parent,
  { x0, x1, yb, s = 6, color = 'rgba(195,204,214,.26)', width = 1 },
) {
  const g = S('g', { class: 'staff' }, parent)
  for (let ln = 0; ln < 5; ln++)
    S(
      'line',
      {
        x1: x0,
        x2: x1,
        y1: yb - ln * s,
        y2: yb - ln * s,
        stroke: color,
        'stroke-width': width,
      },
      g,
    )
  return g
}
export function barline(
  parent,
  { x, yb, s = 6, color = 'rgba(195,204,214,.42)', final = false },
) {
  const g = S('g', { class: 'barline' }, parent)
  S(
    'line',
    { x1: x, x2: x, y1: yb - 4 * s, y2: yb, stroke: color, 'stroke-width': 1 },
    g,
  )
  if (final)
    S(
      'rect',
      {
        x: x + s * 0.5,
        y: yb - 4 * s,
        width: s * 0.58,
        height: 4 * s,
        fill: color,
      },
      g,
    )
  return g
}

/* ---------------------------------------------------------------- Noto Music glyphs */
// GLYPHS is the JSON in noto-music-glyph-paths.json (paths in font units, y already flipped to SVG).
// Noto Music's own staff: lines at font y 12, 256, 500, 744, 988, so one staff space = 244 units and
// the glyph baseline sits 12 units below the bottom line.
export const NOTO_SPACE = 244,
  NOTO_BASE = 12,
  NOTO_NOTE_CENTRE = 134 // noteheadBlack centre, font units
// A clef engraved at true size: G clef curls round the G line, F clef dots straddle the F line,
// C clef centres on the middle line. Calibrated by rendering (tests/clef-test.png): Noto Music's
// G and C clefs sit on its own staff (bottom line at font y 12), but its F clef dots centre at
// font y 644, so the F clef needs its bottom line at font y -88 (100 units, 0.41 space, higher).
const CLEF_BASE = { gClef: 12, cClef: 12, fClef: -88 }
export function clef(
  parent,
  GLYPHS,
  { kind = 'treble', x, yb, s = 6, fill = '#c3ccd6' },
) {
  const name = kind === 'bass' ? 'fClef' : kind === 'alto' ? 'cClef' : 'gClef',
    k = s / NOTO_SPACE
  return S(
    'path',
    {
      d: GLYPHS.glyphs[name].d,
      fill,
      class: 'clef',
      transform: `translate(${x} ${yb + CLEF_BASE[name] * k}) scale(${k})`,
    },
    parent,
  )
}
// An accidental whose optical centre sits on the note's line or space; x is its right edge.
export function accidental(
  parent,
  GLYPHS,
  { acc, natural, x, y, s = 6, fill = '#c3ccd6' },
) {
  const name = natural
    ? 'natural'
    : { 1: 'sharp', '-1': 'flat', 2: 'doubleSharp', '-2': 'doubleFlat' }[acc]
  if (!name) return null
  const g = GLYPHS.glyphs[name],
    k = s / NOTO_SPACE,
    w = g.bbox_font_units[2] * k
  return S(
    'path',
    {
      d: g.d,
      fill,
      class: 'acc',
      transform: `translate(${x - w} ${y + NOTO_NOTE_CENTRE * k}) scale(${k})`,
    },
    parent,
  )
}
// Decorative clef the way the stats kit sets it: a text glyph at font-size 6.5 s, baseline yb + 1.08 s.
// It is about 1.6 times true size; use clef() when the lesson is about reading the clef itself.
export const decorativeClefText = (
  parent,
  { x, yb, s = 6, fill = 'rgba(195,204,214,.88)' },
) =>
  S(
    'text',
    {
      x,
      y: yb + 1.08 * s,
      'font-family': '"Noto Music"',
      'font-size': 6.5 * s,
      fill,
      text: '\u{1D11E}',
    },
    parent,
  )

/* ---------------------------------------------------------------- one note */
// value: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth. k: staff step (stepOf()).
// Structure: <g.ledgers> (stays on the staff) + <g.note> (translates) > <g.note-body> (squashes).
// Returns { g, body, ledgers, head, stem, x, y, y0, k, s } so a timeline can move the whole note or
// just the head.
export function ledgerGroup(
  parent,
  { x, yb, k, s = 6, color = 'rgba(195,204,214,.45)' },
) {
  const lg = S('g', { class: 'ledgers' }, parent)
  for (let ll = 10; ll <= k; ll += 2)
    S(
      'line',
      {
        x1: x - 0.933 * s,
        x2: x + 0.933 * s,
        y1: yb - (ll * s) / 2,
        y2: yb - (ll * s) / 2,
        stroke: color,
        'stroke-width': 1,
      },
      lg,
    )
  for (let ll = -2; ll >= k; ll -= 2)
    S(
      'line',
      {
        x1: x - 0.933 * s,
        x2: x + 0.933 * s,
        y1: yb - (ll * s) / 2,
        y2: yb - (ll * s) / 2,
        stroke: color,
        'stroke-width': 1,
      },
      lg,
    )
  return lg
}
export function note(
  parent,
  {
    x,
    yb,
    k,
    value = 4,
    s = 6,
    color = '#58a6ff',
    ink = 'rgba(195,204,214,.78)',
    bg = '#12171e',
    stemDir = null,
    ledgers = true,
    GLYPHS = null,
    acc = 0,
    natural = false,
  },
) {
  const y = yb - (k * s) / 2
  const lg = ledgers ? ledgerGroup(parent, { x, yb, k, s }) : null
  const g = S('g', { class: 'note' }, parent),
    body = S('g', { class: 'note-body' }, g)
  const hollow = value <= 2
  const head = S(
    'ellipse',
    {
      class: 'head',
      cx: x,
      cy: y,
      rx: 0.617 * s,
      ry: 0.433 * s,
      transform: `rotate(-22 ${x} ${y})`,
      fill: hollow ? bg : color,
      stroke: color,
      'stroke-width': hollow ? 0.225 * s : 0.083 * s,
    },
    body,
  )
  let stemEl = null
  if (value > 1) {
    const up = stemDir ? stemDir === 'up' : k < 4,
      dir = up ? -1 : 1,
      sx = x + (up ? 0.567 : -0.567) * s,
      tip = y + dir * 3.5 * s
    stemEl = S(
      'line',
      {
        class: 'stem',
        x1: sx,
        x2: sx,
        y1: y + (dir * s) / 6,
        y2: tip,
        stroke: ink,
        'stroke-width': 0.183 * s,
        'stroke-linecap': 'butt',
      },
      body,
    )
    const flags = value === 16 ? 2 : value === 8 ? 1 : 0
    for (let f = 0; f < flags; f++) {
      const y0 = tip - dir * f * 0.833 * s,
        q = s / 6
      S(
        'path',
        {
          class: 'flag',
          d: `M${sx} ${y0}c${0.4 * q} ${-dir * 3.6 * q} ${6.4 * q} ${-dir * 4.8 * q} ${5.4 * q} ${-dir * 10.5 * q}`,
          fill: 'none',
          stroke: ink,
          'stroke-width': 0.183 * s,
        },
        body,
      )
    }
  }
  if (GLYPHS && (acc || natural))
    accidental(body, GLYPHS, { acc, natural, x: x - 0.95 * s, y, s, fill: ink })
  return {
    g,
    body,
    ledgers: lg,
    head,
    stem: stemEl,
    x,
    y,
    y0: y,
    k,
    s,
    parent,
    yb,
  }
}

/* ---------------------------------------------------------------- beams (the stats kit's rule) */
// notes: [{ x, y, k, value }] already placed (use note(..., { value: 4 }) for the heads, then beam them).
export function beam(
  parent,
  notes,
  { s = 6, ink = 'rgba(195,204,214,.78)', fill = 'rgba(195,204,214,.82)' } = {},
) {
  const up = notes.reduce((a, p) => a + p.k, 0) / notes.length < 4,
    dir = up ? -1 : 1,
    sx = (p) => p.x + (up ? 0.567 : -0.567) * s
  const f = notes[0],
    l = notes[notes.length - 1]
  const slope = Math.max(
    -0.16,
    Math.min(0.16, (l.y - f.y) / Math.max(1, sx(l) - sx(f))),
  )
  let b0 = f.y + dir * 3.33 * s
  const at = (x) => b0 + slope * (x - sx(f))
  notes.forEach((p) => {
    const need = p.y + dir * 2.5 * s,
      cur = at(sx(p))
    if (up ? cur > need : cur < need) b0 += need - cur
  })
  const g = S('g', { class: 'beam-group' }, parent)
  notes.forEach((p) =>
    S(
      'line',
      {
        x1: sx(p),
        x2: sx(p),
        y1: p.y + (dir * s) / 6,
        y2: at(sx(p)),
        stroke: ink,
        'stroke-width': 0.183 * s,
      },
      g,
    ),
  )
  const th = 0.467 * s,
    off2 = 0.767 * s
  const slab = (xa, xb, off) =>
    S(
      'path',
      {
        class: 'beam',
        fill,
        d: `M${xa} ${at(xa) - dir * off}L${xb} ${at(xb) - dir * off}L${xb} ${at(xb) - dir * (off + th)}L${xa} ${at(xa) - dir * (off + th)}Z`,
      },
      g,
    )
  slab(sx(f), sx(l), 0)
  notes.forEach((p, i) => {
    if (p.value !== 16) return
    const nx = notes[i + 1],
      pv = notes[i - 1]
    if (nx && nx.value === 16) slab(sx(p), sx(nx), off2)
    else if (!(pv && pv.value === 16)) {
      const xb = nx ? sx(p) + 0.833 * s : sx(p) - 0.833 * s
      slab(Math.min(sx(p), xb), Math.max(sx(p), xb), off2)
    }
  })
  return g
}

/* ---------------------------------------------------------------- rests and the tacet bar */
// Engraved rests: the whole rest hangs from the 4th line, the half rest sits on the middle line,
// each a block 1.25 s wide and 0.5 s tall. (The stats kit's tacet bar draws a wider, decorative
// block: x 104, y 19, 22 x 5.5 on a staff whose lines are 9 apart, so 2.4 s by 0.6 s.)
export const wholeRest = (parent, { x, yb, s = 6, fill = '#c3ccd6' }) =>
  S(
    'rect',
    { x: x - 0.625 * s, y: yb - 3 * s, width: 1.25 * s, height: 0.5 * s, fill },
    parent,
  )
export const halfRest = (parent, { x, yb, s = 6, fill = '#c3ccd6' }) =>
  S(
    'rect',
    {
      x: x - 0.625 * s,
      y: yb - 2.5 * s,
      width: 1.25 * s,
      height: 0.5 * s,
      fill,
    },
    parent,
  )

/* ---------------------------------------------------------------- legend glyph (HTML string) */
// noteKey from the stats kit: a note value as a tiny inline SVG whose viewBox hugs the ink.
export function noteKey(v, px = 0.68) {
  const hollow = v <= 2,
    flags = v === 16 ? 2 : v === 8 ? 1 : 0
  const head = `<ellipse cx="0" cy="0" rx="3.7" ry="2.6" transform="rotate(-22)" fill="${hollow ? 'none' : 'currentColor'}" stroke="currentColor" stroke-width="${hollow ? 1.35 : 0.5}"/>`
  const stem =
    v === 1
      ? ''
      : '<path d="M3.4 -1V-21" stroke="currentColor" stroke-width="1.1"/>'
  let flag = ''
  for (let f = 0; f < flags; f++)
    flag += `<path d="M3.4 ${-21 + f * 5}c.4 3.6 6.4 4.8 5.4 10.5" fill="none" stroke="currentColor" stroke-width="1.1"/>`
  const [x, y, w, h] =
    v === 1 ? [-4.3, -3.5, 8.6, 7] : [-4.3, -21, flags ? 13.7 : 8.6, 24.5]
  return `<svg viewBox="${x} ${y} ${w} ${h}" width="${(w * px).toFixed(1)}" height="${(h * px).toFixed(1)}" aria-hidden="true">${head}${stem}${flag}</svg>`
}

/* ---------------------------------------------------------------- jumping notes (GSAP) */
// A note hops to a new pitch: anticipation squash, stretch on take-off, arc, landing squash, a small
// overshoot settle. The ledgers it leaves fade out as it takes off and the ledgers it needs fade in as
// it lands, all as tweens (no callbacks), so the timeline stays seekable in HyperFrames. The stem
// keeps its side; if the landing crosses the middle line and the stem should flip, cross-fade to a
// second note drawn with note() at the landing pitch instead.
// Usage: const n = note(svg, { x, yb, k: stepOf('E4'), s }); tl.add(jump(n, 'C5'), 1.2).add(jump(n, 'G4'), 2.4)
export function jump(
  n,
  toPitch,
  { clef = 'treble', hop = 2.2, dur = 0.62, gsap = window.gsap } = {},
) {
  const s = n.s,
    yb = n.yb,
    k1 = stepOf(toPitch, clef),
    y1 = yb - (k1 * s) / 2
  const from = n.y,
    peak = Math.min(from, y1) - hop * s
  const foot = `${n.x} ${n.y0 + 0.45 * s}` // the head's lowest point in the note's own (untranslated) space
  const newLedgers = ledgerGroup(n.parent, { x: n.x, yb, k: k1, s })
  newLedgers.setAttribute('opacity', 0)
  const oldLedgers = n.ledgers
  const tl = gsap.timeline()
  tl.to(n.body, {
    duration: dur * 0.14,
    scaleY: 0.8,
    scaleX: 1.12,
    svgOrigin: foot,
    ease: 'power2.out',
  }) // anticipation
    .to(n.body, {
      duration: dur * 0.2,
      scaleY: 1.1,
      scaleX: 0.93,
      svgOrigin: foot,
      ease: 'power2.out',
    }) // stretch on take-off
    .to(n.g, { duration: dur * 0.43, y: peak - n.y0, ease: 'power2.out' }, '<') // rise
    .to(
      oldLedgers || {},
      { duration: dur * 0.2, opacity: 0, ease: 'none' },
      '<',
    )
    .to(
      n.body,
      {
        duration: dur * 0.23,
        scaleY: 1,
        scaleX: 1,
        svgOrigin: foot,
        ease: 'sine.inOut',
      },
      '<.1',
    )
    .to(n.g, { duration: dur * 0.3, y: y1 - n.y0, ease: 'power2.in' }, '>') // fall
    .to(newLedgers, { duration: dur * 0.12, opacity: 1, ease: 'none' }, '<.16')
    .to(n.body, {
      duration: dur * 0.08,
      scaleY: 0.84,
      scaleX: 1.1,
      svgOrigin: foot,
      ease: 'power1.out',
    }) // landing squash
    .to(n.body, {
      duration: dur * 0.18,
      scaleY: 1,
      scaleX: 1,
      svgOrigin: foot,
      ease: 'back.out(3)',
    }) // settle
  n.y = y1
  n.k = k1
  n.ledgers = newLedgers // the next jump starts here
  return tl
}
