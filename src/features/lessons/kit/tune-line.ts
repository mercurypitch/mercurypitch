// ============================================================
// Tune line — a tune drawn as beads on semitone rows, played, slid and compared
// ============================================================
//
// The object a lesson about tunes transforms is one object on the page
// (Lesson 6 WEB-SPEC, Toys 1): every copy of the tune line (a hero's, a cold
// open's compact one, the steps' stage, free play) is this core on its own
// canvas. It is generic over a tune, a list of lines whose notes are
// semitones above the start with their lengths, so a later lesson can draw
// its own phrase. It keeps the scene, slides the line to a new start (the
// lift, the travel and the gold glow, tune-line-motion.ts), fades a contrast
// case in over the first line, lights a bead while its note sounds, and lays
// a button over every bead, gap and named bracket the page asks for, each on
// its tap zone as the layout changes (tune-line-layout.ts). Under reduced
// motion every move lands at once; a played line still sounds and lights
// its beads in turn. A shape may ask for its buttons as one grid
// (`TuneShape.grid`, WAI-ARIA's layout grid): a row for each line's
// brackets, beads and gaps, top to bottom, and one Tab stop, the button
// last focused or pressed, from which the arrows, Home and End move. It
// draws only when what it shows has changed (a run, a slide, a fade, a new
// shape, start, overlay or names, a new size, pixel ratio or font) and
// while that change moves; idle, it asks the page's frame loop for nothing
// (frame-loop.ts, `wants`). On a page that plays one sound at a time, a run
// claims the page's owner (now-playing.ts), so it stops the sound before
// it, and a newer one elsewhere stops it. Words belong to the page: the
// core asks for each name and label and only draws.

import { addDrawer, surface, wake } from './frame-loop'
import { reducedMotion } from './motion-switch'
import { COLOR, hz } from './notes'
import type { SoundOwner } from './now-playing'
import type { Voice, VoiceOptions } from './sound'
import { Sound } from './sound'
import type { GapWords, TuneBracket, TuneScene } from './tune-line-draw'
import { paintTune } from './tune-line-draw'
import type { Rect, TuneLayout } from './tune-line-layout'
import { tuneLayout } from './tune-line-layout'
import type { Slide } from './tune-line-motion'
import { landsAfter, lightAt, slideAt, travelSec } from './tune-line-motion'

/** One note of a tune: semitones above the tune's start, and its length in crotchets. */
export interface TuneNote {
  readonly at: number
  readonly beats: number
}

/** A timed note: its MIDI number, and its onset and length in seconds. */
export interface TuneEvent {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** What a copy of the line shows: one state of the toy. */
export interface TuneShape {
  /** The tune's lines shown, by index, stacked in order: [0], or [0, 1]. */
  readonly lines: readonly number[]
  /**
   * A fixed window of rows, low and high MIDI, over which the line travels as
   * it slides; or null, for bands that span the tune's own notes and scroll
   * under it (the stacked lines).
   */
  readonly window: readonly [number, number] | null
  /** Spread the rows over the whole height (the compact line). */
  readonly fill: boolean
  /** Each note's name in a strip under its bead. */
  readonly names: boolean
  /** The strip under the names: contour marks, the gaps' sizes, or nothing. */
  readonly below: 'marks' | 'gaps' | null
  /** Which parts are buttons: the beads, the gaps (with `below` 'gaps') and the brackets. */
  readonly beadButtons: boolean
  readonly gapButtons: boolean
  readonly brackets: readonly TuneBracket[]
  /** The first line kept faint at this start for comparison, or null. */
  readonly ghost: number | null
  /**
   * The buttons as one grid, a single Tab stop that lands on the button last
   * focused or pressed (the first, before any), rather than a Tab stop each.
   * Off by default.
   */
  readonly grid?: boolean
}

/** A contrast case drawn dashed over the first line: its notes above the start, and the gaps it changes. */
export interface TuneOverlay {
  readonly at: readonly number[]
  readonly changed: readonly { readonly gap: number; readonly size: string }[]
}

/** How a played run lights the line. */
export interface TuneLook {
  /** Whose light: Merc's or Tavi's, or chrome for the soft tone (default). */
  readonly color?: string
  readonly kind?: VoiceOptions['kind']
  /** The note each event lights, counted across the tune; by default the shown notes in turn. */
  readonly notes?: readonly number[]
  /** Light the contrast case's beads instead of the tune's. */
  readonly overlay?: boolean
  /** Hears each note as it starts. */
  readonly onNote?: (e: TuneEvent, i: number) => void
}

export interface TuneLineOptions {
  readonly canvas: HTMLCanvasElement
  /** The layer laid over the canvas for the buttons; none for a drawing alone. */
  readonly hits?: HTMLElement | null
  readonly tune: readonly (readonly TuneNote[])[]
  readonly start: number
  readonly shape: TuneShape
  /** When it draws: on screen, and on its step. */
  readonly active: () => boolean
  /** Note g's name at a start (letters or do-re-mi, signs allowed: it is drawn). */
  readonly name?: (g: number, start: number) => string
  /** Gap g's size and word, drawn in the strip. */
  readonly gapWords?: (g: number) => GapWords
  /** Accessible names for the buttons, in words. */
  readonly labels?: {
    readonly note: (g: number) => string
    readonly gap: (g: number) => string
    readonly bracket: (g: number) => string
  }
  readonly onNote?: (g: number) => void
  readonly onGap?: (g: number) => void
  readonly onBracket?: (g: number) => void
  /** The page's one-sound owner (now-playing.ts), on a page that plays one sound at a time. */
  readonly owner?: SoundOwner
}

export interface TuneLine {
  readonly start: number
  readonly busy: boolean
  readonly shape: TuneShape
  readonly layout: TuneLayout | null
  /** A slide, silent: returns the seconds until the line lands (0 under reduced motion). */
  setStart(midi: number): number
  setShape(shape: TuneShape): void
  setOverlay(overlay: TuneOverlay | null): void
  /** Renames every button, after a start or the names change. */
  relabel(): void
  /**
   * Plays notes, lighting each bead as it sounds. Resolves true when the
   * last note ends, or false when the run is cut short: stopped, or
   * replaced by a new play.
   */
  play(
    events: readonly TuneEvent[],
    audible: boolean,
    look?: TuneLook,
  ): Promise<boolean>
  /** Stops a run in flight: its notes fall silent and its lights go out. */
  stop(): void
}

/** Seconds the contrast case takes to fade in or out. */
const FADE_SEC = 0.25

interface Lit {
  readonly note: number
  readonly overlay: boolean
  readonly from: number
  readonly to: number
  readonly color: string
}

/** A button over the drawing: its part, and its box, the grid cell it sits in or itself. */
interface Hit {
  readonly el: HTMLButtonElement
  readonly box: HTMLElement
  readonly kind: 'note' | 'gap' | 'bracket'
  readonly g: number
}

/** The global index of each line's first note. */
function firstsOf(tune: readonly (readonly TuneNote[])[]): number[] {
  let n = 0
  return tune.map((line) => {
    const first = n
    n += line.length
    return first
  })
}

/** Calls `fn` whenever the screen's pixel ratio changes: a zoom, or another screen. */
function watchPixelRatio(fn: () => void): void {
  const query = window.matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`,
  )
  query.addEventListener(
    'change',
    () => {
      fn()
      watchPixelRatio(fn)
    },
    { once: true },
  )
}

/** Places a button over a rectangle of the drawing. */
function place(b: HTMLElement, r: Rect): void {
  b.style.left = `${r.x}px`
  b.style.top = `${r.y}px`
  b.style.width = `${r.w}px`
  b.style.height = `${r.h}px`
}

/** A cell of a grid: its row, and its place in that row. */
export interface GridCell {
  readonly row: number
  readonly col: number
}

/**
 * Where a key moves the focus in a grid whose rows are `lengths` long, from
 * `at`, as WAI-ARIA's layout grid has it: an arrow a cell at a time, staying
 * put at an edge, Up and Down to the same place in the next row or to its
 * last cell if it is shorter; Home and End to the row's ends, and with
 * Control to the grid's first and last cells. Null for any other key.
 */
export function gridMove(
  lengths: readonly number[],
  at: GridCell,
  key: string,
  ctrl = false,
): GridCell | null {
  const lastRow = lengths.length - 1
  const end = (row: number): number => lengths[row] - 1
  const inRow = (row: number): GridCell => ({
    row,
    col: Math.min(at.col, end(row)),
  })
  if (ctrl)
    return key === 'Home'
      ? { row: 0, col: 0 }
      : key === 'End'
        ? { row: lastRow, col: end(lastRow) }
        : null
  switch (key) {
    case 'ArrowLeft':
      return { row: at.row, col: Math.max(0, at.col - 1) }
    case 'ArrowRight':
      return { row: at.row, col: Math.min(end(at.row), at.col + 1) }
    case 'ArrowUp':
      return inRow(Math.max(0, at.row - 1))
    case 'ArrowDown':
      return inRow(Math.min(lastRow, at.row + 1))
    case 'Home':
      return { row: at.row, col: 0 }
    case 'End':
      return { row: at.row, col: end(at.row) }
    default:
      return null
  }
}

export function mountTuneLine(opts: TuneLineOptions): TuneLine {
  const cv = surface(opts.canvas)
  const flat = opts.tune.flat()
  const firsts = firstsOf(opts.tune)
  let shape = opts.shape
  let start = opts.start
  let named = start
  let view = start
  let slide: Slide | null = null
  let overlay: TuneOverlay | null = null
  let overlayAmount = 0
  let lits: Lit[] = []
  let voices: Voice[] = []
  let timers: number[] = []
  let finish: ((finished: boolean) => void) | null = null
  let busy = false
  let layout: TuneLayout | null = null
  let lastKey = ''
  // something the drawing shows has changed since its last frame
  let dirty = true
  let buttons: Hit[] = []
  // with `shape.grid`, the buttons by row, and the one Tab stop, kept by
  // its part so that a new shape lands on the same button where it can
  let rows: Hit[][] = []
  let tabStop: { kind: Hit['kind']; g: number } | null = null
  // the layer's own role, a group, which a grid takes over while it shows
  const groupRole = opts.hits?.getAttribute('role') ?? null

  const now = (): number => performance.now() / 1000
  const shownFirsts = (): number[] => shape.lines.map((k) => firsts[k])
  const shownNotes = (): number[] =>
    shape.lines.flatMap((k) => opts.tune[k].map((_, i) => firsts[k] + i))

  /** The rows a band holds: the fixed window's, or the shown notes' span. */
  function span(): [number, number] {
    const ats = shape.lines.flatMap((k) => opts.tune[k].map((n) => n.at))
    return [Math.min(...ats), Math.max(...ats)]
  }

  function rowsOf(): number {
    if (shape.window !== null) return shape.window[1] - shape.window[0] + 1
    const [lo, hi] = span()
    return hi - lo + 1
  }

  function lightOf(g: number, over: boolean, t: number) {
    let best: { amount: number; color: string } | null = null
    for (const l of lits) {
      if (l.note !== g || l.overlay !== over) continue
      const amount = lightAt(l.from, l.to, t)
      if (amount > 0 && (best === null || amount > best.amount))
        best = { amount, color: l.color }
    }
    return best
  }

  function scene(t: number, lift: number, glow: number): TuneScene {
    const [lo, hi] = span()
    const windows = shape.lines.map(
      (): readonly [number, number] => shape.window ?? [view + lo, view + hi],
    )
    const firstLine = opts.tune[shape.lines[0]]
    return {
      lines: shape.lines.map((k) => opts.tune[k].map((n) => view + n.at)),
      first: shownFirsts(),
      windows,
      name:
        shape.names && opts.name !== undefined
          ? (g) => opts.name?.(g, named) ?? ''
          : null,
      below: shape.below,
      gapWords: (g) => opts.gapWords?.(g) ?? { size: '', word: '' },
      move: (g) => {
        const d = flat[g + 1].at - flat[g].at
        return d === 0 ? 'same' : d > 0 ? 'up' : 'down'
      },
      brackets: shape.brackets,
      ghost:
        shape.ghost !== null && shape.window !== null
          ? firstLine.map((n) => (shape.ghost ?? 0) + n.at)
          : null,
      overlay:
        overlay === null
          ? null
          : {
              pitches: overlay.at.map((a) => view + a),
              amount: overlayAmount,
              changed: overlay.changed,
            },
      light: (g, over) => lightOf(g, over, t),
      lift,
      glow: shape.below === 'gaps' ? glow : 0,
    }
  }

  function placeButtons(): void {
    const L = layout
    if (L === null) return
    const f0 = shownFirsts()[0]
    for (const b of buttons) {
      if (b.kind === 'note') {
        const k = shape.lines.findIndex(
          (line) =>
            b.g >= firsts[line] && b.g < firsts[line] + opts.tune[line].length,
        )
        const r = L.lines[k]?.beads[b.g - firsts[shape.lines[k]]]
        if (r !== undefined) place(b.el, r)
      } else {
        const gap = L.gaps[b.g - f0] as (typeof L.gaps)[number] | undefined
        const r = b.kind === 'gap' ? gap?.target : gap?.bracket
        b.el.hidden = r === null || r === undefined
        b.box.hidden = b.el.hidden
        if (r !== null && r !== undefined) place(b.el, r)
      }
    }
    if (shape.grid === true) rove()
  }

  // a shape with no button on its drawing keeps no 44 px floor (tune-line-layout.ts)
  const hasTargets = (): boolean =>
    shape.beadButtons ||
    (shape.gapButtons && shape.below === 'gaps') ||
    shape.brackets.length > 0

  function measure(w: number, h: number): void {
    const key = `${w} ${h} ${shape.lines.join(',')} ${rowsOf()} ${shape.names} ${shape.below} ${shape.brackets.length} ${shape.fill} ${hasTargets()}`
    if (key === lastKey && layout !== null) return
    lastKey = key
    layout = tuneLayout({
      width: w,
      height: h,
      beats: shape.lines.map((k) => opts.tune[k].map((n) => n.beats)),
      rows: rowsOf(),
      names: shape.names,
      below: shape.below !== null,
      above: shape.brackets.length > 0,
      fill: shape.fill,
      targets: hasTargets(),
    })
    placeButtons()
  }

  /** Something the drawing shows has changed: it draws on the next frame. */
  function invalidate(): void {
    dirty = true
    wake()
  }

  /** Whether the line has a frame to draw: a change since its last, or a slide, a fade or a light still moving. */
  function wants(): boolean {
    const target = overlay === null ? 0 : 1
    return (
      dirty || slide !== null || overlayAmount !== target || lits.length > 0
    )
  }

  function draw(_now: number, dt: number): void {
    dirty = false
    const t = now()
    let lift = 0
    let glow = 0
    if (slide !== null) {
      const s = slideAt(slide, t)
      view = s.view
      lift = s.lift
      glow = s.glow
      if (t - slide.t0 >= landsAfter(slide)) named = start
      if (s.done) slide = null
    } else {
      view = start
      named = start
    }
    const target = overlay === null ? 0 : 1
    overlayAmount = reducedMotion()
      ? target
      : target > overlayAmount
        ? Math.min(target, overlayAmount + dt / FADE_SEC)
        : Math.max(target, overlayAmount - dt / FADE_SEC)
    const { ctx, w, h } = cv.fit()
    measure(w, h)
    if (layout !== null) paintTune(ctx, layout, scene(t, lift, glow))
    lits = lits.filter((l) => t < l.to + 0.5)
  }

  addDrawer({ active: opts.active, draw, wants })
  // a new size draws at once, before the page paints, so no frame shows the
  // old drawing stretched; a new pixel ratio or font draws on the next frame
  new ResizeObserver(() => {
    if (opts.active()) draw(performance.now(), 0)
    else invalidate()
  }).observe(opts.canvas)
  watchPixelRatio(invalidate)
  void document.fonts?.ready.then(invalidate)
  document.fonts?.addEventListener('loadingdone', invalidate)

  function label(b: Hit): string {
    const l = opts.labels
    if (l === undefined) return ''
    return b.kind === 'note'
      ? l.note(b.g)
      : b.kind === 'gap'
        ? l.gap(b.g)
        : l.bracket(b.g)
  }

  /**
   * Gives the grid's one Tab stop to `to`; with none, keeps it on the button
   * that had it if that one still shows, or gives it to the first that does.
   */
  function rove(to?: Hit): void {
    const shown = buttons.filter((b) => !b.el.hidden)
    const kept = shown.find(
      (b) => b.kind === tabStop?.kind && b.g === tabStop.g,
    )
    const at = to ?? kept ?? shown.at(0)
    if (at === undefined) return
    tabStop = { kind: at.kind, g: at.g }
    for (const b of buttons) b.el.tabIndex = b === at ? 0 : -1
  }

  function build(): void {
    const hits = opts.hits
    if (hits === undefined || hits === null) return
    hits.replaceChildren()
    buttons = []
    rows = []
    // a button straight on the layer, or in a cell of a grid's row
    const make = (
      kind: Hit['kind'],
      g: number,
      row: HTMLElement | null,
    ): Hit => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `tune-hit tune-hit-${kind}`
      el.dataset[kind] = String(g)
      const box = row === null ? el : document.createElement('div')
      if (row === null) hits.appendChild(el)
      else {
        box.setAttribute('role', 'gridcell')
        box.appendChild(el)
        row.appendChild(box)
      }
      const b = { el, box, kind, g }
      el.setAttribute('aria-label', label(b))
      buttons.push(b)
      return b
    }
    const notes = shownNotes()
    const parts: (readonly [Hit['kind'], number])[] = [
      ...(shape.beadButtons ? notes.map((g) => ['note', g] as const) : []),
      ...(shape.gapButtons && shape.below === 'gaps'
        ? notes.slice(0, -1).map((g) => ['gap', g] as const)
        : []),
      ...shape.brackets.map((b) => ['bracket', b.gap] as const),
    ]
    if (shape.grid === true) {
      // each line's brackets, beads and gaps, top to bottom as drawn; a gap
      // or a bracket belongs to the line of its first note
      const lineOf = (g: number): number =>
        shape.lines.findIndex(
          (k) => g >= firsts[k] && g < firsts[k] + opts.tune[k].length,
        )
      hits.setAttribute('role', 'grid')
      shape.lines.forEach((_, i) => {
        for (const kind of ['bracket', 'note', 'gap'] as const) {
          const mine = parts.filter(([k, g]) => k === kind && lineOf(g) === i)
          if (mine.length === 0) continue
          const row = document.createElement('div')
          row.setAttribute('role', 'row')
          hits.appendChild(row)
          rows.push(mine.map(([k, g]) => make(k, g, row)))
        }
      })
      rove()
    } else {
      if (groupRole === null) hits.removeAttribute('role')
      else hits.setAttribute('role', groupRole)
      parts.forEach(([k, g]) => make(k, g, null))
    }
    hits.hidden = buttons.length === 0
    lastKey = ''
    const rect = opts.canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0)
      measure(Math.round(rect.width), Math.round(rect.height))
  }

  opts.hits?.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('.tune-hit')
    if (el === null) return
    const b = buttons.find((x) => x.el === el)
    if (b === undefined) return
    // Safari, on iOS and the Mac, focuses no button that is clicked or
    // tapped, so no focusin comes: the press itself moves a grid's Tab stop
    if (shape.grid === true) rove(b)
    if (b.kind === 'note') opts.onNote?.(b.g)
    else if (b.kind === 'gap') opts.onGap?.(b.g)
    else opts.onBracket?.(b.g)
  })

  // in a grid, the button that takes the focus, by key, click or script, is
  // its Tab stop, and the arrows, Home and End move the focus between them
  opts.hits?.addEventListener('focusin', (e) => {
    if (shape.grid !== true) return
    const b = buttons.find((x) => x.el === e.target)
    if (b !== undefined) rove(b)
  })
  opts.hits?.addEventListener('keydown', (e) => {
    if (shape.grid !== true || e.altKey || e.metaKey || e.shiftKey) return
    const shown = rows
      .map((r) => r.filter((b) => !b.el.hidden))
      .filter((r) => r.length > 0)
    const row = shown.findIndex((r) => r.some((b) => b.el === e.target))
    if (row < 0) return
    const col = shown[row].findIndex((b) => b.el === e.target)
    const to = gridMove(
      shown.map((r) => r.length),
      { row, col },
      e.key,
      e.ctrlKey,
    )
    if (to === null) return
    e.preventDefault()
    shown[to.row][to.col].el.focus()
  })

  build()

  function clearRun(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    voices.forEach((v) => v.stop(0.08))
    voices = []
    lits = []
    busy = false
    invalidate()
    const done = finish
    finish = null
    done?.(false)
  }

  /** Stops the run in flight, and lets the page's sound go. */
  function stop(): void {
    clearRun()
    opts.owner?.release(stop)
  }

  return {
    get start() {
      return start
    },
    get busy() {
      return busy
    },
    get shape() {
      return shape
    },
    get layout() {
      return layout
    },
    setStart(midi) {
      const next = Math.round(midi)
      if (next === start) return 0
      invalidate()
      if (reducedMotion()) {
        slide = null
        start = next
        view = next
        named = next
        return 0
      }
      // the names under the beads keep the old start until the line lands
      const s = {
        from: view,
        to: next,
        t0: now(),
        travel: travelSec(next - view),
      }
      slide = s
      start = next
      return landsAfter(s)
    },
    setShape(next) {
      shape = next
      build()
      invalidate()
    },
    setOverlay(next) {
      overlay = next
      if (reducedMotion()) overlayAmount = next === null ? 0 : 1
      invalidate()
    },
    relabel() {
      for (const b of buttons) b.el.setAttribute('aria-label', label(b))
      // the names drawn under the beads follow the same words
      invalidate()
    },
    play(events, audible, look = {}) {
      clearRun()
      opts.owner?.claim(stop)
      busy = true
      const t0 = now()
      const color = look.color ?? COLOR.chrome
      const order = look.notes ?? shownNotes()
      return new Promise<boolean>((resolve) => {
        finish = resolve
        events.forEach((e, i) => {
          timers.push(
            window.setTimeout(() => {
              if (audible) {
                const v = Sound.voice(hz(e.midi), {
                  kind: look.kind,
                  dur: e.dur,
                })
                if (v !== null) voices.push(v)
              }
              look.onNote?.(e, i)
            }, e.at * 1000),
          )
          const note = order[i]
          if (note !== undefined)
            lits.push({
              note: look.overlay === true ? i : note,
              overlay: look.overlay === true,
              from: t0 + e.at,
              to: t0 + e.at + e.dur,
              color,
            })
        })
        invalidate()
        const end = events.reduce((m, e) => Math.max(m, e.at + e.dur), 0)
        timers.push(
          window.setTimeout(() => {
            busy = false
            voices = []
            timers = []
            finish = null
            opts.owner?.release(stop)
            resolve(true)
          }, end * 1000),
        )
      })
    },
    stop,
  }
}
