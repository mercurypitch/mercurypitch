// ============================================================
// Score drawing — a song on two staffs, written, lit and marked
// ============================================================
//
// The score's SVG at the figure's size, where kit/score-layout.ts puts
// each system (Lesson 28 WEB-SPEC, Look): every system's staffs with their
// clefs and the key's signs, the 4/4 on the first, a brace and a line
// joining the staffs at its left and its bar lines through all of them,
// and each staff's notes as the rhythm engraving writes them
// (kit/rhythm-engrave.ts), in ink. The marks: each bar's number small over
// the top staff, a tag in its box over a phrase's last bar, the numerals
// in ink under the bottom staff, a word under a note, a breath's comma
// over each staff at its bar's end, the house under each staff's first
// note on do, and a ring round a note. A mark not drawn before fades in.
//
// A staff's notes light in its part's colour while they sound, Tavi's
// orange and Merc's blue, or in Sing it the learner's amber with the other
// part's notes chrome, under the cursor, a thin ink line through the
// system at the beat; a figure written as it sounds shows each note once
// its beat comes. `lightScore` and `writeScore` change classes and the
// cursor's place only, so a frame never redraws the figure.

import { svg } from './dom'
import { HOME_PATH } from './home-glyph'
import { engraveRow } from './rhythm-engrave'
import { r } from './rhythm-glyphs'
import type { RhythmScene, RowLayout } from './rhythm-layout'
import { headInset, placeRow, SIDE, xOf } from './rhythm-layout'
import type { ScoreLayout, ScoreScene, SystemLayout } from './score-layout'
import { BAR, barsOf, layoutScore, rowOf, signSpaces, systemOfBeat, timedNotes, } from './score-layout'
import { FLAT_PATH, NOTO_GLYPHS, SHARP_PATH } from './staff-glyphs'
import type { KeySig } from './staff-key'
import { keyPlaces } from './staff-key'
import type { Clef } from './staff-places'
import { midiOf, placeOf } from './staff-places'

/** A drawn note: its group, its beat from the scene's start, its length in beats, its system and its head's centre. */
export interface DrawnNote {
  readonly el: SVGGElement
  readonly beat: number
  readonly beats: number
  readonly system: number
  readonly x: number
  readonly y: number
}

export interface ScoreDrawing {
  readonly layout: ScoreLayout
  /** Each staff's notes, in order across the systems. */
  readonly notes: readonly (readonly DrawnNote[])[]
  /** Each system's cursor. */
  readonly cursors: readonly SVGLineElement[]
}

export interface ScoreDrawOptions {
  /** Marks drawn before, by their key: one not in it fades in, and joins it. */
  readonly seen?: Set<string>
  /** A box over each staff a tap plays (Step 4). */
  readonly taps?: boolean
}

/** A place's height on a row's staff: the middle line is place 4. */
const yAt = (row: RowLayout, place: number): number =>
  row.y - ((place - 4) * row.space) / 2

/** A note's head across its row: a little into its beat, as the engraving puts it. */
const headX = (row: RowLayout, beat: number, beats: number): number =>
  xOf(row, beat) + headInset(row, Math.min(beats, 1))

/** The key's signs after a staff's clef, each at its own clef's place. */
function keySigns(
  key: KeySig,
  clef: Clef,
  row: RowLayout,
  parent: Element,
): void {
  if (key.count === 0) return
  const k = row.space / NOTO_GLYPHS.space
  const d = key.sign === 'sharp' ? SHARP_PATH : FLAT_PATH
  keyPlaces(key, clef).forEach((place, i) => {
    // the glyph's left bearing, 50 units, sits before the sign's edge
    const x = SIDE + signSpaces(i) * row.space - 50 * k
    const y = yAt(row, place) + NOTO_GLYPHS.head.cy * k
    svg(
      'path',
      {
        d,
        class: 'sc-keysign',
        transform: `translate(${r(x)} ${r(y)}) scale(${k.toFixed(5)})`,
      },
      parent,
    )
  })
}

/** A vertical line from `y1` to `y2` at `x`. */
const vline = (
  x: number,
  y1: number,
  y2: number,
  cls: string,
  parent: Element,
): SVGLineElement =>
  svg('line', { x1: r(x), x2: r(x), y1: r(y1), y2: r(y2), class: cls }, parent)

/** The brace before a system's staffs, from its top line to its bottom one. */
function brace(sys: SystemLayout, space: number, parent: Element): void {
  const yTop = sys.top
  const yBot = sys.bottom
  const xr = SIDE - space * 0.3
  const a = xr - space * 0.4
  const b = xr - space * 0.8
  const yMid = (yTop + yBot) / 2
  const c = (yBot - yTop) * 0.1
  svg(
    'path',
    {
      d: `M${r(xr)} ${r(yTop)}Q${r(a)} ${r(yTop)} ${r(a)} ${r(yTop + c)}L${r(a)} ${r(yMid - c)}Q${r(a)} ${r(yMid)} ${r(b)} ${r(yMid)}Q${r(a)} ${r(yMid)} ${r(a)} ${r(yMid + c)}L${r(a)} ${r(yBot - c)}Q${r(a)} ${r(yBot)} ${r(xr)} ${r(yBot)}`,
      class: 'sc-brace',
    },
    parent,
  )
}

/** The line joining the staffs at the system's left, and a bar line through them at each bar's end. */
function systemLines(sys: SystemLayout, parent: Element): void {
  const row = sys.rows[0]
  if (row === undefined) return
  vline(SIDE, sys.top, sys.bottom, 'sc-sysline', parent)
  for (let b = sys.from + 1; b <= sys.to; b++) {
    const x = b === sys.to ? row.x1 : xOf(row, (b - sys.from) * BAR)
    vline(x, sys.top, sys.bottom, 'sc-barline', parent).dataset.after = String(
      b - 1,
    )
  }
}

/** A text mark: its class, its words and where its baseline sits. */
function text(
  cls: string,
  words: string,
  at: { x: number; y: number; size: number },
  parent: Element,
): SVGTextElement {
  return svg(
    'text',
    {
      x: r(at.x),
      y: r(at.y),
      'font-size': r(at.size),
      'text-anchor': 'middle',
      class: cls,
      text: words,
    },
    parent,
  )
}

/** Marks a mark fresh, so it fades in, unless it has been drawn before. */
function fresh(el: Element, key: string, seen: Set<string> | undefined): void {
  if (seen === undefined) return
  if (!seen.has(key)) el.classList.add('is-fresh')
  seen.add(key)
}

/** Each bar's number, small over the top staff at its first beat. */
function barNumbers(
  sys: SystemLayout,
  first: number,
  mark: number,
  parent: Element,
): void {
  const row = sys.rows[0]
  if (row === undefined) return
  const size = mark * 1.25
  for (let b = sys.from; b < sys.to; b++) {
    const x =
      b === sys.from
        ? SIDE + row.space * 0.9
        : xOf(row, (b - sys.from) * BAR) + row.space * 0.75
    text('sc-number', String(first + b), { x, y: sys.numberY, size }, parent)
  }
}

/** A tag in its box over its bar, kept inside the system. */
function tag(
  sys: SystemLayout,
  t: { bar: number; text: string },
  mark: number,
  parent: Element,
): SVGGElement {
  const row = sys.rows[0] as RowLayout
  const size = mark * 1.35
  const w = t.text.length * size * 0.56 + mark * 1.4
  const mid =
    (xOf(row, (t.bar - sys.from) * BAR) +
      xOf(row, (t.bar + 1 - sys.from) * BAR)) /
    2
  const x = Math.min(row.x1 - w, Math.max(SIDE, mid - w / 2))
  const g = svg('g', { class: 'sc-tag', 'data-bar': t.bar }, parent)
  svg(
    'rect',
    {
      x: r(x),
      y: r(sys.tagTop),
      width: r(w),
      height: r(sys.tagH),
      rx: r(mark * 0.5),
    },
    g,
  )
  text(
    'sc-tag-text',
    t.text,
    { x: x + w / 2, y: sys.tagTop + sys.tagH * 0.7, size },
    g,
  )
  return g
}

/** The notes of each staff, timed, in the systems' order. */
const timedStaffs = (scene: ScoreScene) => scene.staffs.map(timedNotes)

/** Draws one system: its staffs, their notes, its lines and its marks; each staff's drawn notes. */
function drawSystem(
  scene: ScoreScene,
  L: ScoreLayout,
  i: number,
  host: Element,
  o: ScoreDrawOptions,
): { notes: DrawnNote[][]; cursor: SVGLineElement } {
  const sys = L.systems[i] as SystemLayout
  const g = svg(
    'g',
    {
      class: 'sc-system',
      'data-system': i,
      transform: `translate(${r(L.inset)} 0)`,
    },
    host,
  )
  const timed = timedStaffs(scene)
  const notes = scene.staffs.map((staff, k) => {
    const row = sys.rows[k] as RowLayout
    const sg = svg(
      'g',
      { class: 'sc-staff', 'data-staff': k, 'data-tone': staff.tone },
      g,
    )
    const rowScene: RhythmScene = {
      staff: staff.clef,
      rows: [],
      pads: false,
      strip: false,
    }
    const rhythmRow = rowOf(staff, sys.from, sys.to, 60, !sys.metre)
    const notation = engraveRow(
      rowScene,
      rhythmRow,
      row,
      placeRow(rhythmRow),
      sg,
    )
    // the system's own bar lines run through every staff
    for (const b of notation.barlines) b.el.remove()
    for (const b of notation.beams) b.el.classList.remove('is-hidden')
    for (const t of notation.ties) t.el.classList.remove('is-hidden')
    keySigns(scene.key, staff.clef, row, sg)
    const mine = (timed[k] ?? []).filter(
      (n) => n.bar >= sys.from && n.bar < sys.to,
    )
    return mine.map((n, j): DrawnNote => {
      const el = notation.symbols[j] as SVGGElement
      el.dataset.note = String(n.index)
      const beat = n.beat - sys.from * BAR
      return {
        el,
        beat: n.beat,
        beats: n.beats,
        system: i,
        x: headX(row, beat, n.beats),
        y: yAt(row, placeOf(n.note, staff.clef)),
      }
    })
  })
  systemLines(sys, g)
  brace(sys, L.space, g)
  if (o.taps === true) taps(scene, sys, g)
  barNumbers(sys, scene.first ?? 1, L.mark, g)
  const cursor = vline(
    0,
    sys.top - L.space,
    sys.bottom + L.space,
    'sc-cursor is-off',
    g,
  )
  return { notes, cursor }
}

/** A box over each staff of a system that a tap plays: the staffs' own buttons, in the page's text, carry their names. */
function taps(scene: ScoreScene, sys: SystemLayout, parent: Element): void {
  scene.staffs.forEach((_staff, k) => {
    const row = sys.rows[k] as RowLayout
    svg(
      'rect',
      {
        x: r(SIDE),
        y: r(row.top - row.space * 1.2),
        width: r(Math.max(0, row.x1 - SIDE)),
        height: r(row.space * 6.4),
        class: 'sc-hit',
        'data-staff': k,
      },
      parent,
    )
  })
}

/** The marks over and under the staffs, each in its system. */
function drawMarks(
  scene: ScoreScene,
  L: ScoreLayout,
  notes: readonly (readonly DrawnNote[])[],
  host: Element,
  seen: Set<string> | undefined,
): void {
  const marks = scene.marks
  if (marks === undefined) return
  const layer = (i: number): SVGGElement =>
    svg(
      'g',
      {
        class: 'sc-marks',
        'data-system': i,
        transform: `translate(${r(L.inset)} 0)`,
      },
      host,
    )
  const layers = L.systems.map((_s, i) => layer(i))
  const sysOf = (bar: number): number =>
    Math.max(
      0,
      L.systems.findIndex((s) => bar >= s.from && bar < s.to),
    )
  for (const t of marks.tags ?? []) {
    const i = sysOf(t.bar)
    const el = tag(
      L.systems[i] as SystemLayout,
      t,
      L.mark,
      layers[i] as Element,
    )
    fresh(el, `tag:${t.bar}:${t.text}`, seen)
  }
  const bottom = notes[notes.length - 1] ?? []
  for (const n of marks.numerals ?? []) {
    const i = sysOf(n.bar)
    const sys = L.systems[i] as SystemLayout
    const head = bottom.find((d) => Math.floor(d.beat / BAR) === n.bar)
    if (head === undefined) continue
    const el = text(
      'sc-numeral',
      n.text,
      { x: head.x, y: sys.numeralY, size: L.mark * 1.6 },
      layers[i] as Element,
    )
    fresh(el, `numeral:${n.bar}:${n.text}`, seen)
  }
  for (const w of marks.words ?? []) {
    const head = notes[w.staff]?.[w.note]
    if (head === undefined) continue
    const sys = L.systems[head.system] as SystemLayout
    const row = sys.rows[w.staff] as RowLayout
    const el = text(
      'sc-word',
      w.text,
      {
        x: head.x,
        y: row.bottom + L.space * 1.6 + L.mark * 1.4,
        size: L.mark * 1.4,
      },
      layers[head.system] as Element,
    )
    fresh(el, `word:${w.staff}:${w.note}:${w.text}`, seen)
  }
  for (const after of marks.breaths ?? []) breath(L, after, layers)
  marks.home?.forEach((home, k) => {
    if (home === null) return
    const head = notes[k]?.find((d) => {
      const n = timedNotes(scene.staffs[k] as ScoreScene['staffs'][number])
      const at = n.find((t) => t.beat === d.beat)
      return at !== undefined && midiOf(at.note) === midiOf(home)
    })
    if (head === undefined) return
    const row = L.systems[head.system]?.rows[k]
    if (row === undefined) return
    house(head, row, L.space, layers[head.system] as Element)
  })
  for (const ring of marks.rings ?? []) {
    const head = notes[ring.staff]?.[ring.note]
    if (head === undefined) continue
    const el = svg(
      'circle',
      {
        cx: r(head.x),
        cy: r(head.y),
        r: r(L.space * 1.35),
        class: 'sc-ring',
      },
      layers[head.system] as Element,
    )
    fresh(el, `ring:${ring.staff}:${ring.note}`, seen)
  }
}

/** A breath's comma over each staff, at the end of bar `after`. */
function breath(
  L: ScoreLayout,
  after: number,
  layers: readonly SVGGElement[],
): void {
  const i = L.systems.findIndex((s) => after >= s.from && after < s.to)
  const sys = L.systems[i]
  if (sys === undefined) return
  for (const row of sys.rows) {
    const end = (after + 1 - sys.from) * BAR
    const x = (end >= row.beats ? row.x1 : xOf(row, end)) - row.space * 0.55
    text(
      'sc-breath',
      ',',
      { x, y: row.top - row.space * 0.7, size: row.space * 2.4 },
      layers[i] as Element,
    )
  }
}

/** The house under a note on do, below its staff, clear of the lines. */
function house(
  head: DrawnNote,
  row: RowLayout,
  space: number,
  parent: Element,
): void {
  const size = space * 1.2
  svg(
    'path',
    {
      d: HOME_PATH,
      class: 'sc-house',
      transform: `translate(${r(head.x - size / 2)} ${r(row.bottom + space * 0.45)}) scale(${(size / 24).toFixed(4)})`,
    },
    parent,
  )
}

/**
 * Draws the scene into `host` at `w` by `h`, every note hidden until
 * `writeScore` writes it; the drawing, for the frames to light.
 */
export function drawScore(
  host: SVGSVGElement,
  scene: ScoreScene,
  size: { w: number; h: number },
  o: ScoreDrawOptions = {},
): ScoreDrawing {
  host.replaceChildren()
  host.setAttribute('viewBox', `0 0 ${r(size.w)} ${r(size.h)}`)
  const layout = layoutScore(size.w, size.h, scene)
  const notes: DrawnNote[][] = scene.staffs.map(() => [])
  const cursors: SVGLineElement[] = []
  layout.systems.forEach((_s, i) => {
    const drawn = drawSystem(scene, layout, i, host, o)
    drawn.notes.forEach((list, k) => notes[k]?.push(...list))
    cursors.push(drawn.cursor)
  })
  drawMarks(scene, layout, notes, host, o.seen)
  return { layout, notes, cursors }
}

/** Shows the notes that start at or before `beat`; Infinity shows them all. */
export function writeScore(d: ScoreDrawing, beat: number): void {
  for (const staff of d.notes)
    for (const n of staff)
      n.el.classList.toggle('is-hidden', n.beat > beat + 1e-6)
}

/** The cursor at `beat` and the notes sounding there lit, or neither (null). */
export function lightScore(
  d: ScoreDrawing,
  beat: number | null,
  staffs?: readonly number[],
): void {
  d.notes.forEach((staff, k) => {
    const lights = staffs === undefined || staffs.includes(k)
    for (const n of staff)
      n.el.classList.toggle(
        'is-sounding',
        lights && beat !== null && beat >= n.beat && beat < n.beat + n.beats,
      )
  })
  const at = beat === null ? -1 : systemOfBeat(d.layout, beat)
  d.cursors.forEach((c, i) => {
    const sys = d.layout.systems[i]
    const row = sys?.rows[0]
    if (beat === null || i !== at || sys === undefined || row === undefined) {
      c.classList.add('is-off')
      return
    }
    const x = Math.min(
      row.x1,
      xOf(row, beat - sys.from * BAR) + headInset(row, 1),
    )
    c.setAttribute('x1', r(x))
    c.setAttribute('x2', r(x))
    c.classList.remove('is-off')
  })
}

/** The beats a scene runs: its bars'. */
export const sceneBeats = (scene: ScoreScene): number => barsOf(scene) * BAR
