// ============================================================
// Read marks — what a reading staff writes over its rhythm figure
// ============================================================
//
// Lesson 18's reading staff (its WEB-SPEC, Toys 1 to 3) is Lesson 17's
// rhythm on the staff (kit/rhythm-draw.ts) with what a reader's eye and a
// song sheet add to it, drawn here into the figure's own SVG, in its
// pixels, over the notes:
//
// - the house under the first note on do, and each note's syllable under
//   the staff, counted from that do, while Names is on (Lesson 16's);
// - a note's name over it as it is read, and a small tag under it, the
//   note-by-note read's "1 beat late";
// - the cursor, a line that crosses each note's head on its beat and stops
//   at the final bar line;
// - the count-in strip, four small dots before bar 1, one lit a click;
// - a gold bracket over a pattern's notes, with its label, fading in as it
//   is drawn, and the box its button takes (at least 44 px tall);
// - a song sheet's marks, each written as its sound plays: p or f over a
//   note, a hairpin over its beats drawn open or closed as far as the
//   level has moved, a staccato dot on a head, a slur over its notes drawn
//   as far as they have sounded, and a breath mark over a bar line.
//
// The rhythm bar draws its figure afresh on every resize and every view, so
// the marks hold their own state and draw it all again into each new SVG
// (`draw`, the rhythm bar's `onDraw`); `set` changes what shows and draws
// again only the layers it touches, so the cursor moves every frame without
// the rest being touched. A bracket fades in only the first time it is
// drawn, never on a redraw.
//
// Pure drawing: no sound, no timer. The page decides what shows and when,
// from the beats its plays have reached (kit/rhythm-bar.ts `onFrame`).

import { svg } from './dom'
import { HOME_PATH } from './home-glyph'
import type { Spelled } from './notes'
import type { RhythmFigure } from './rhythm-draw'
import { r } from './rhythm-glyphs'
import type { RhythmScene, RowLayout } from './rhythm-layout'
import { headInset, STAFF_A, symbolX, xOf } from './rhythm-layout'
import type { PlacedSymbol } from './rhythm-model'
import { midiOf, placeOf, syllableOf } from './staff-places'

/** A pattern the eye takes in at once: its first and last symbol, and its label. */
export interface Bracket {
  readonly first: number
  readonly last: number
  readonly label: string
}

/** A song sheet's mark, at a symbol or across beats of the row. */
export type SheetMark =
  | { readonly kind: 'p' | 'f'; readonly at: number }
  | {
      readonly kind: 'cresc' | 'dim'
      readonly from: number
      readonly to: number
      /** How much of it is drawn, 0 to 1, as the level moves. */
      readonly drawn: number
    }
  | { readonly kind: 'staccato'; readonly at: number }
  | {
      readonly kind: 'slur'
      readonly first: number
      readonly last: number
      /** How much of its curve is drawn, 0 to 1, as its notes sound. */
      readonly drawn: number
    }
  | { readonly kind: 'breath'; readonly beat: number }

/** What the marks show at a moment. */
export interface ReadMarksState {
  /** Do: the house under the first note on it, and the syllables counted from it; null for neither. */
  readonly home: Spelled | null
  /** Each note's syllable under the staff (Names on). */
  readonly syllables: boolean
  /** A name over each symbol, by index, as it is read. */
  readonly names: readonly (string | null)[]
  /** A tag under each symbol, by index: "1 beat late". */
  readonly tags: readonly (string | null)[]
  /** The cursor at a beat of the row, from 0, or none. */
  readonly cursor: number | null
  /** The count-in strip, its dots and the one lit, or none. */
  readonly countIn: {
    readonly dots: number
    readonly lit: number | null
  } | null
  readonly brackets: readonly Bracket[]
  readonly marks: readonly SheetMark[]
  /**
   * The sounding note's level, 0 to 1, as its light: loudness as
   * brightness, never size or place (Lesson 18 WEB-SPEC, Look). Null for
   * the singer's full colour.
   */
  readonly level: number | null
}

/** A box in the figure's pixels. */
export interface MarkBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface ReadMarks {
  /** Draws every mark shown into a freshly drawn figure: the rhythm bar's `onDraw`. */
  draw(figure: RhythmFigure, el: SVGSVGElement, scene: RhythmScene): void
  /** Changes what shows, and draws the layers that change. */
  set(next: Partial<ReadMarksState>): void
  readonly state: ReadMarksState
  /** Where each bracket shown is, and its button's box: at least 44 px tall. */
  bracketBoxes(): readonly MarkBox[]
  /**
   * Each sound's button box, in order: from midway to the note before to
   * midway to the one after, so no two overlap, over the staff and at
   * least 44 px tall.
   */
  noteBoxes(): readonly MarkBox[]
  /** Each written mark's button box, at least 44 px each way, with its mark. */
  markBoxes(): readonly { readonly box: MarkBox; readonly mark: SheetMark }[]
}

/** The tap target's least size each way, px (WCAG 2.5.5, the kit's 44). */
export const TARGET = 44

export const NO_MARKS: ReadMarksState = {
  home: null,
  syllables: false,
  names: [],
  tags: [],
  cursor: null,
  countIn: null,
  brackets: [],
  marks: [],
  level: null,
}

/** The share of the singer's colour a sounding note takes at no level: the rest is its ink. */
const LIGHT_FLOOR = 0.4

/** Where a figure's row puts its notes: each symbol's head and stem, and the staff. */
interface Geometry {
  readonly row: RowLayout
  readonly placed: readonly PlacedSymbol[]
  /** Per symbol: its head's centre and place, its stem's direction, its note; null for a rest. */
  readonly heads: readonly ({
    readonly x: number
    readonly y: number
    readonly down: boolean
    readonly note: Spelled
  } | null)[]
  /** The staff's top and bottom lines. */
  readonly top: number
  readonly bottom: number
}

/** A place's height: the middle line is place 4. */
const yAt = (row: RowLayout, place: number): number =>
  row.y - ((place - 4) * row.space) / 2

function geometryOf(fig: RhythmFigure, scene: RhythmScene): Geometry | null {
  const row = fig.layout.rows[0] as RowLayout | undefined
  const rowScene = scene.rows[0] as RhythmScene['rows'][number] | undefined
  if (row === undefined || rowScene === undefined || scene.staff === 'line')
    return null
  const staff = scene.staff
  const placed = fig.rows[0].placed
  let sound = -1
  const heads = placed.map((p) => {
    if (p.kind !== 'note') return null
    if (p.onset !== null) sound++
    const note = rowScene.notes?.[Math.max(0, sound)] ?? STAFF_A[staff]
    const place = placeOf(note, staff)
    return { x: symbolX(row, p), y: yAt(row, place), down: place >= 4, note }
  })
  return { row, placed, heads, top: yAt(row, 8), bottom: yAt(row, 0) }
}

/** The highest ink over symbols `first` to `last`: the staff's top line, a head, or an up stem's end. */
function ceilingOf(G: Geometry, first: number, last: number): number {
  const s = G.row.space
  let top = G.top
  for (let i = first; i <= last; i++) {
    const h = G.heads[i]
    if (h !== null && h !== undefined)
      top = Math.min(top, h.down ? h.y - s * 0.6 : h.y - s * 3.6)
  }
  return top
}

/** The cursor's place at `beat`: on the head of a note that starts there, never past the final bar line. */
export function cursorX(row: RowLayout, beat: number): number {
  return Math.min(row.x1, xOf(row, beat) + headInset(row, 1))
}

/** A bracket's line, its label's baseline and its button's box. */
function bracketShape(
  G: Geometry,
  b: Bracket,
): {
  x1: number
  x2: number
  y: number
  labelY: number
  box: MarkBox
} | null {
  const a = G.heads[b.first]
  const z = G.heads[b.last]
  if (a === null || a === undefined || z === null || z === undefined)
    return null
  const s = G.row.space
  const x1 = a.x - s * 0.75
  const x2 = z.x + s * 0.75
  const y = ceilingOf(G, b.first, b.last) - s * 0.9
  const labelY = y - s * 0.45
  const size = labelSize(s)
  const top = labelY - size
  const bottom = y + s * 0.7
  const grow = Math.max(0, TARGET - (bottom - top)) / 2
  return {
    x1,
    x2,
    y,
    labelY,
    box: { x: x1, y: top - grow, w: x2 - x1, h: bottom - top + grow * 2 },
  }
}

/** A box at least the tap target each way, centred on a point. */
function around(cx: number, cy: number, w: number, h: number): MarkBox {
  const bw = Math.max(w, TARGET)
  const bh = Math.max(h, TARGET)
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh }
}

/** A line of the display face's width per character, as a share of its size: a tag's estimate. */
const TEXT_WIDTH = 0.56

const labelSize = (space: number): number => Math.max(11, space * 0.8)
const smallSize = (space: number): number => Math.max(10, space * 0.7)

/** A song sheet's mark of one kind. */
type MarkOf<K extends SheetMark['kind']> = Extract<SheetMark, { kind: K }>

/** p or f over its note, in the display face; its button's box, or null where the note is not drawn. */
function drawDynamic(
  G: Geometry,
  g: SVGGElement,
  m: MarkOf<'p' | 'f'>,
): MarkBox | null {
  const h = G.heads[m.at] ?? null
  if (h === null) return null
  const s = G.row.space
  const size = s * 1.6
  const y = ceilingOf(G, m.at, m.at) - s * 0.6
  svg(
    'text',
    {
      x: r(h.x),
      y: r(y),
      'text-anchor': 'middle',
      'font-size': r(size),
      class: 'rd-dyn',
      'data-mark': m.kind,
      text: m.kind,
    },
    g,
  )
  return around(h.x, y - size * 0.35, size, size)
}

/** A hairpin over its beats, drawn as far as its share; its button's box. */
function drawHairpin(
  G: Geometry,
  g: SVGGElement,
  m: MarkOf<'cresc' | 'dim'>,
): MarkBox {
  const s = G.row.space
  const x1 = xOf(G.row, m.from) + s * 0.3
  const x2 = xOf(G.row, m.to) - s * 0.3
  const first = G.placed.findIndex((p) => p.beat >= m.from - 1e-6)
  const last = G.placed.reduce(
    (at, p, i) => (p.beat < m.to - 1e-6 ? i : at),
    first,
  )
  const yc = ceilingOf(G, Math.max(0, first), Math.max(0, last)) - s * 1.4
  const d = Math.min(1, Math.max(0, m.drawn))
  const half = s * 0.6
  // a crescendo opens from its point; a diminuendo closes to its point
  const open = (t: number): number =>
    m.kind === 'cresc' ? half * t : half * (1 - t)
  const xe = x1 + (x2 - x1) * d
  svg(
    'path',
    {
      d: `M${r(xe)} ${r(yc - open(d))}L${r(x1)} ${r(yc - open(0))}M${r(x1)} ${r(yc + open(0))}L${r(xe)} ${r(yc + open(d))}`,
      class: 'rd-hairpin',
      'data-mark': m.kind,
    },
    g,
  )
  return around((x1 + x2) / 2, yc, x2 - x1, half * 2)
}

/** A staccato dot on the head's side away from its stem; its button's box, or null where the note is not drawn. */
function drawStaccato(
  G: Geometry,
  g: SVGGElement,
  m: MarkOf<'staccato'>,
): MarkBox | null {
  const h = G.heads[m.at] ?? null
  if (h === null) return null
  const s = G.row.space
  const y = h.down ? h.y - s * 0.95 : h.y + s * 0.95
  svg(
    'circle',
    {
      cx: r(h.x),
      cy: r(y),
      r: r(s * 0.18),
      class: 'rd-stacc',
      'data-mark': 'staccato',
    },
    g,
  )
  return around(h.x, y, 0, 0)
}

/** A slur from its first head to its last, drawn as far as its share; its button's box, or null where a head is not drawn. */
function drawSlur(
  G: Geometry,
  g: SVGGElement,
  m: MarkOf<'slur'>,
): MarkBox | null {
  const a = G.heads[m.first] ?? null
  const z = G.heads[m.last] ?? null
  if (a === null || z === null) return null
  const s = G.row.space
  // over the heads when their stems point down, under them otherwise
  const over = a.down
  const sign = over ? -1 : 1
  const ya = a.y + sign * s * 0.75
  const yz = z.y + sign * s * 0.75
  const reach = over ? Math.min(ya, yz) - s * 1.0 : Math.max(ya, yz) + s * 1.0
  svg(
    'path',
    {
      d: `M${r(a.x)} ${r(ya)}Q${r((a.x + z.x) / 2)} ${r(reach)} ${r(z.x)} ${r(yz)}`,
      class: 'rd-slur',
      pathLength: '1',
      'stroke-dasharray': `${Math.min(1, Math.max(0, m.drawn)).toFixed(3)} 1`,
      'data-mark': 'slur',
    },
    g,
  )
  const yTop = Math.min(ya, yz, reach)
  const yBottom = Math.max(ya, yz, reach)
  return around(
    (a.x + z.x) / 2,
    (yTop + yBottom) / 2,
    z.x - a.x,
    yBottom - yTop,
  )
}

/** A breath mark: a comma over the staff, just before its beat; its button's box. */
function drawBreath(G: Geometry, g: SVGGElement, m: MarkOf<'breath'>): MarkBox {
  const s = G.row.space
  const size = s * 2.4
  const x = xOf(G.row, m.beat) - s * 0.45
  const y = G.top - s * 0.5
  svg(
    'text',
    {
      x: r(x),
      y: r(y),
      'text-anchor': 'middle',
      'font-size': r(size),
      class: 'rd-breath',
      'data-mark': 'breath',
      text: ',',
    },
    g,
  )
  return around(x, y - size * 0.3, size * 0.5, size * 0.6)
}

/** Draws one mark into `g`; its button's box, or null where its notes are not drawn. */
function drawMark(G: Geometry, g: SVGGElement, m: SheetMark): MarkBox | null {
  switch (m.kind) {
    case 'p':
    case 'f':
      return drawDynamic(G, g, m)
    case 'cresc':
    case 'dim':
      return drawHairpin(G, g, m)
    case 'staccato':
      return drawStaccato(G, g, m)
    case 'slur':
      return drawSlur(G, g, m)
    case 'breath':
      return drawBreath(G, g, m)
  }
}

export function createReadMarks(): ReadMarks {
  let state: ReadMarksState = NO_MARKS
  let G: Geometry | null = null
  let root: SVGGElement | null = null
  let host: SVGSVGElement | null = null
  const layers = new Map<string, SVGGElement>()
  // brackets already drawn once: a redraw never fades them in again
  const seen = new Set<string>()
  // the marks as last drawn, with their buttons' boxes
  let drawnMarks: { box: MarkBox; mark: SheetMark }[] = []

  const keyOf = (b: Bracket): string => `${b.first}-${b.last}-${b.label}`

  function layer(name: string): SVGGElement | null {
    if (root === null) return null
    let g = layers.get(name)
    if (g === undefined) {
      g = svg('g', { 'data-layer': name, 'aria-hidden': 'true' }, root)
      layers.set(name, g)
    }
    g.replaceChildren()
    return g
  }

  function drawHome(): void {
    const g = layer('home')
    if (g === null || G === null) return
    const home = state.home
    if (home === null) return
    const s = G.row.space
    const at = G.heads.findIndex(
      (h) => h !== null && midiOf(h.note) === midiOf(home),
    )
    const h = G.heads[at]
    if (h !== null && h !== undefined) {
      const size = s * 1.05
      svg(
        'path',
        {
          d: HOME_PATH,
          class: 'rd-house',
          'data-i': at,
          transform: `translate(${r(h.x - size / 2)} ${r(h.y + s * 0.85)}) scale(${(size / 24).toFixed(4)})`,
        },
        g,
      )
    }
  }

  function drawUnder(): void {
    const g = layer('under')
    if (g === null || G === null) return
    const s = G.row.space
    const size = smallSize(s)
    const line = Math.max(G.bottom, ...G.heads.map((h) => h?.y ?? 0))
    const y1 = line + s * 0.6 + size
    const home = state.home
    const heads = G.heads
    // a tag is one line; where tagged heads sit closer than the widest tag
    // needs, as on a phone, the tags alternate between two rows, so none
    // runs into the next
    const tagged = heads.flatMap((h, i) =>
      h !== null && (state.tags[i] ?? null) !== null ? [i] : [],
    )
    const widest =
      Math.max(0, ...tagged.map((i) => (state.tags[i] ?? '').length)) *
      size *
      TEXT_WIDTH
    const nearest = Math.min(
      Infinity,
      ...tagged
        .slice(1)
        .map((i, k) => (heads[i]?.x ?? 0) - (heads[tagged[k]]?.x ?? 0)),
    )
    const stagger = widest + size * 0.5 > nearest
    heads.forEach((h, i) => {
      if (h === null) return
      const tag = state.tags[i] ?? null
      if (tag !== null) {
        const row = stagger ? tagged.indexOf(i) % 2 : 0
        svg(
          'text',
          {
            x: r(h.x),
            y: r(y1 + row * size * 1.15),
            'text-anchor': 'middle',
            'font-size': r(size),
            class: 'rd-tag',
            'data-i': i,
            'data-row': row,
            text: tag,
          },
          g,
        )
      } else if (state.syllables && home !== null)
        svg(
          'text',
          {
            x: r(h.x),
            y: r(y1),
            'text-anchor': 'middle',
            'font-size': r(size),
            class: 'rd-syl',
            'data-i': i,
            text: syllableOf(h.note, home),
          },
          g,
        )
    })
  }

  function drawNames(): void {
    const g = layer('names')
    if (g === null || G === null) return
    const s = G.row.space
    G.heads.forEach((h, i) => {
      const name = state.names[i] ?? null
      if (h === null || name === null) return
      svg(
        'text',
        {
          x: r(h.x),
          y: r(ceilingOf(G as Geometry, i, i) - s * 0.5),
          'text-anchor': 'middle',
          'font-size': r(smallSize(s)),
          class: 'rd-name',
          'data-i': i,
          text: name,
        },
        g,
      )
    })
  }

  function drawCursor(): void {
    const g = layer('cursor')
    if (g === null || G === null || state.cursor === null) return
    const s = G.row.space
    const x = r(cursorX(G.row, state.cursor))
    svg(
      'line',
      {
        x1: x,
        x2: x,
        y1: r(G.top - s * 1.2),
        y2: r(G.bottom + s * 1.2),
        class: 'rd-cursor',
      },
      g,
    )
  }

  function drawCountIn(): void {
    const g = layer('count')
    const c = state.countIn
    if (g === null || G === null || c === null || c.dots < 1) return
    const s = G.row.space
    // before bar 1: across the clef's margin, level with the pads' numbers
    const left = s * 0.9
    const right = G.row.x0 - s * 0.9
    const step = c.dots > 1 ? (right - left) / (c.dots - 1) : 0
    const y = G.row.numberY - s * 0.35
    for (let k = 0; k < c.dots; k++)
      svg(
        'circle',
        {
          cx: r(left + step * k),
          cy: r(y),
          r: r(Math.max(2.5, s * 0.28)),
          class: c.lit === k ? 'rd-dot is-lit' : 'rd-dot',
          'data-dot': k,
        },
        g,
      )
  }

  function drawBrackets(fresh: boolean): void {
    const g = layer('brackets')
    if (g === null || G === null) return
    const s = G.row.space
    for (const b of state.brackets) {
      const shape = bracketShape(G, b)
      if (shape === null) continue
      const key = keyOf(b)
      const isNew = fresh && !seen.has(key)
      seen.add(key)
      const bg = svg(
        'g',
        {
          class: isNew ? 'rd-bracket is-fresh' : 'rd-bracket',
          'data-first': b.first,
          'data-last': b.last,
        },
        g,
      )
      const foot = shape.y + s * 0.6
      svg(
        'path',
        {
          d: `M${r(shape.x1)} ${r(foot)}V${r(shape.y)}H${r(shape.x2)}V${r(foot)}`,
        },
        bg,
      )
      svg(
        'text',
        {
          x: r((shape.x1 + shape.x2) / 2),
          y: r(shape.labelY),
          'text-anchor': 'middle',
          'font-size': r(labelSize(s)),
          text: b.label,
        },
        bg,
      )
    }
  }

  function drawMarks(): void {
    drawnMarks = []
    const g = layer('marks')
    if (g === null || G === null) return
    const Gm = G
    for (const m of state.marks) {
      const box = drawMark(Gm, g, m)
      if (box !== null) drawnMarks.push({ box, mark: m })
    }
  }

  /** The sounding note's light: a share of its singer's colour over its ink, set on the figure's SVG. */
  function drawLevel(): void {
    if (host === null) return
    const level = state.level
    host.classList.toggle('rd-loud', level !== null)
    if (level === null) host.style.removeProperty('--rd-light')
    else {
      const share =
        LIGHT_FLOOR + (1 - LIGHT_FLOOR) * Math.min(1, Math.max(0, level))
      host.style.setProperty('--rd-light', `${Math.round(share * 100)}%`)
    }
  }

  function drawAll(fresh: boolean): void {
    drawHome()
    drawUnder()
    drawNames()
    drawBrackets(fresh)
    drawMarks()
    drawCountIn()
    drawCursor()
  }

  return {
    draw(fig, el, scene) {
      G = geometryOf(fig, scene)
      layers.clear()
      // a figure drawn afresh holds none of the old marks; one drawn over
      // again in place drops them first
      root?.remove()
      root = svg('g', { class: 'rd-marks' }, el)
      host = el
      drawAll(false)
      drawLevel()
    },
    set(next) {
      const was = state
      state = { ...state, ...next }
      if (root === null) return
      const changed = (k: keyof ReadMarksState): boolean =>
        k in next && next[k] !== was[k]
      if (changed('home')) drawHome()
      if (changed('home') || changed('syllables') || changed('tags'))
        drawUnder()
      if (changed('names')) drawNames()
      if (changed('brackets')) drawBrackets(true)
      if (changed('marks')) drawMarks()
      if (changed('countIn')) drawCountIn()
      if (changed('cursor')) drawCursor()
      if (changed('level')) drawLevel()
    },
    get state() {
      return state
    },
    noteBoxes() {
      if (G === null) return []
      const Gn = G
      const s = Gn.row.space
      const sounds = Gn.placed.flatMap((p, i) => {
        const h = Gn.heads[i]
        return p.kind === 'note' && p.onset !== null && h !== null ? [h] : []
      })
      return sounds.map((h, k) => {
        const before = sounds[k - 1] as (typeof sounds)[number] | undefined
        const after = sounds[k + 1] as (typeof sounds)[number] | undefined
        const left = before === undefined ? h.x - s * 1.6 : (before.x + h.x) / 2
        const right = after === undefined ? h.x + s * 1.6 : (h.x + after.x) / 2
        const top = Math.min(Gn.top - s, h.y - TARGET / 2)
        const bottom = Math.max(Gn.bottom + s, h.y + TARGET / 2)
        return { x: left, y: top, w: right - left, h: bottom - top }
      })
    },
    markBoxes() {
      return drawnMarks
    },
    bracketBoxes() {
      if (G === null) return []
      const Gb = G
      return state.brackets.flatMap((b) => {
        const shape = bracketShape(Gb, b)
        return shape === null ? [] : [shape.box]
      })
    },
  }
}
