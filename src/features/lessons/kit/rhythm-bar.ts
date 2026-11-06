// ============================================================
// Rhythm bar — written bars that sound as they are written, on the beat clock
// ============================================================
//
// The kit's rhythm toy (Lesson 17 WEB-SPEC, Toys 1), generic over its bars
// so Lessons 18 and 19 can play theirs with it. A view is what the figure
// shows: rows of bars on one line or a staff, or the pitch-line view, with
// their pads, counts and stopwatch strip (kit/rhythm-draw.ts). A play is
// parts in turn, each a row of a view at its tempo, after a silence or a
// count-in on the click if it asks for one: Play the halvings' five bars
// each written in place of the one before, Play both's two rows a second
// apart, the checkpoint's Hear the bars after a bar counted in. Outside a
// play, a page can light a pad or a note (`light`), as the checkpoint's
// take does under its own click, and draw taps as ticks across the strip
// (`ticks`), kept through every redraw.
//
// Every sound goes through the beat clock (kit/beat-clock.ts), booked ahead
// on the audio clock into the run's own bus, so stopping cancels what was
// booked: a woodblock knock on each beat, beat 1's higher, or only the
// first in a bare figure, which has no bars (kit/woodblock.ts, FACTS 62),
// and each sound a voice at the learner's note, held for its
// length less the gap (kit/sound-ahead.ts `bookNote`, FACTS 63), a tied run
// as one voice. What is drawn follows the sound as heard: each symbol is
// written at its start, a sounding note lit in its singer's colour, the 4/4
// with the first note, its beat's pad lit, its strip cell filling over its
// length and reading as it ends, its count lit in turn. With sound off the
// drawing runs silently (`Sound.canPlay` says so). The page's one owner
// (kit/now-playing.ts) stops any other sound as a play starts.
//
// Past 4/4 (Lesson 19 WEB-SPEC, Toys 1 and 2): a part's bars are its row's
// metre's, a bar of 6/8 or 3/4 three quarters long; the click knocks on the
// metre's beats, two a bar of 6/8, or not at all (`click: false`); and a
// count-in counts the metre's beats. A part may strike drums in place of
// its notes, one a sound (`drums`), each struck by the page's `drum`
// (kit/drum-hits.ts), so only a page with drums carries their voices.
// Each pad lights as its beat or its eighth is heard; a grouped figure's
// arcs appear as each group starts and stay until the next play; and a cue
// runs a set time ahead of the sounds it picks, as the hero's hops land on
// its kicks and snares (`cue`, with the play's `lead`). A row that gives
// its notes, as a tune on the staff does, sounds each at its own pitch.
//
// The pads' buttons sit on a layer over the figure that comes after the
// controls in reading order, each the width of its beat (FACTS 70), named
// by what its beat holds; a figure whose beats only light has none. Arrow
// keys move between them.

import type { Bar as ClockBar, Hit, Run, Spot } from './beat-clock'
import { BeatClock } from './beat-clock'
import type { DrumHit } from './drum-hits'
import type { Spelled } from './notes'
import { hz } from './notes'
import type { SoundOwner } from './now-playing'
import type { RhythmFigure, RhythmTick, RowState } from './rhythm-draw'
import { drawRhythm, figureSize } from './rhythm-draw'
import type { RhythmScene } from './rhythm-layout'
import { beatsOf, metreOf, placeRow } from './rhythm-layout'
import { barQuarters, beatQuarters, countsOf, heldSeconds, soundsOf, stripCells, } from './rhythm-model'
import { padWords } from './rhythm-words'
import { Sound } from './sound'
import type { Bus } from './sound-ahead'
import { bookNote } from './sound-ahead'
import { midiOf } from './staff-places'
import { bookWood } from './woodblock'

/** The woodblock's level under the notes: a token for the check on a real phone (WEB-SPEC, Audio). */
export const WOOD_LEVEL = 0.1

/** What the figure shows, and how its pads answer. */
export interface RhythmView {
  readonly scene: RhythmScene
  /** The figure's name, for a screen reader. */
  readonly label: string
  /** Its name when the bar is seen on the pitch line; the label by default. */
  readonly laneLabel?: string
  /**
   * Its pads' buttons: 'choose' marks one beat pressed (Halve and Join's
   * choice), 'press' only answers a press (Note · Rest); null for a figure
   * whose beats only light, as every figure of six pads to a bar is.
   */
  readonly pads?: 'choose' | 'press' | null
}

/** One stretch of a play: a row of a view, at a tempo read beat by beat. */
export interface PlayPart {
  readonly view: RhythmView
  /** The row it plays, from 0. */
  readonly row?: number
  readonly bpm: () => number
  /** Seconds of silence before it. */
  readonly pause?: number
  /** The metre's beats of the click alone before it, beat 1 higher: a count-in, a whole number of quarters long (6/8's two, 3/4's three). */
  readonly countIn?: number
  /** Unwritten as it starts, so it is written as it sounds in place of what was there. */
  readonly fresh?: boolean
  /** The click on each of the metre's beats, each bar's first higher; true by default. */
  readonly click?: boolean
  /** Drums struck in place of its notes, one a sound of its row in order (a tied run is one sound), null for one that strikes nothing. */
  readonly drums?: readonly (DrumHit | null)[]
}

/** What runs ahead of chosen sounds, as heard: Merc's hop, landing on a kick or a snare. */
export interface PlayCue {
  /** Seconds ahead of its sound: HOP_MS for a hop. */
  readonly early: number
  /** Whether a sound takes it, by the drum it strikes: null for a note. */
  readonly on: (drum: DrumHit | null) => boolean
  readonly fire: () => void
}

export interface PlayOptions {
  /** The counts faint and unlit, for a learner counting alone. */
  readonly faint?: boolean
  /** Said once the play has been heard to its end. */
  readonly line?: string
  /** The note's voice: the soft one in the steps, Merc's in the sung part. */
  readonly kind?: 'soft' | 'merc'
  /** Whether it sounds, for a caller that asked the Sound switch already: `Sound.canPlay()` by default. */
  readonly audible?: boolean
  /** Seconds from the press to the first beat: the clock's 0.1 by default; at least the cue's `early`, for the first sound's to be heard. */
  readonly lead?: number
  /** Runs ahead of the sounds it picks (Lesson 19 WEB-SPEC, Toys 2). */
  readonly cue?: PlayCue
}

export interface RhythmBarOptions {
  /** The figure: the .rb box, a group named for what it shows; its SVG is made here. */
  readonly figure: HTMLElement
  /** The layer the pads' buttons go on, over the figure. */
  readonly pads: HTMLElement | null
  /** The figure's polite region. */
  readonly said: HTMLElement
  /** The note every sound plays, Hz, read as a play starts, unless its row gives its own notes. */
  readonly freq: () => number
  /** Whose colour a sounding note takes. */
  readonly voice: () => 'merc' | 'tavi'
  readonly owner: SoundOwner
  /** A pad pressed, or chosen by the arrow keys. */
  readonly onPad?: (beat: number) => void
  /** Every frame while a play runs, the beats since its first as heard; null once it ends or stops (a metronome's swing). */
  readonly onFrame?: (beats: number | null) => void
  /** Strikes a part's drum into its run's bus: kit/drum-hits.ts `bookDrum`, passed by a page whose plays have drums, so no other page carries the voices. */
  readonly drum?: (hit: DrumHit, when: number, bus: Bus) => void
}

/** How the bar is seen, whatever its view: on the pitch line, and with each note's count under it. */
export interface RhythmSeen {
  readonly lanes: boolean
  readonly counts: boolean
}

export interface ShowOptions {
  /** The heard symbols' strip cells read, as by default; false once the tempo has changed since they were heard. */
  readonly readings?: boolean
}

export interface RhythmBar {
  /** Draws a view; `written` says which symbols show as already heard, row by row (none by default). */
  show(
    view: RhythmView,
    written?: (row: number, i: number) => boolean,
    so?: ShowOptions,
  ): void
  /** Draws the view on the pitch line or with its counts, or not, keeping what was heard and anything playing. */
  see(next: Partial<RhythmSeen>): void
  readonly seen: RhythmSeen
  /**
   * Redraws the view's rows at a new tempo, keeping what is written and
   * anything playing; the strip's readings go, to read again at the new
   * tempo as each note ends (WEB-SPEC, Toys 6).
   */
  retempo(bpm: number): void
  /** The view shown. */
  readonly view: RhythmView | null
  /** Plays parts in turn; true once heard to its end, false when stopped. */
  play(parts: readonly PlayPart[], o?: PlayOptions): Promise<boolean>
  stop(): void
  readonly playing: boolean
  /** Marks a beat's pad pressed, or none. */
  choose(beat: number | null): void
  /** Says a line in the figure's polite region, once. */
  say(text: string): void
  /** Which of a row's symbols are written, as heard so far. */
  written(row?: number): readonly boolean[]
  /** Lights a beat's pad, or a symbol as sounding, outside a play: the checkpoint's take, which plays only the click. */
  light(next: {
    readonly pad: number | null
    readonly sounding: number | null
  }): void
  /** Draws taps as ticks across the first row's strip, kept across redraws, or clears them with null. */
  ticks(at: readonly RhythmTick[] | null): void
  /** The drawn figure, for the toy's own checks. */
  readonly figure: RhythmFigure | null
}

/** What a clock hit does. */
type RbHit =
  | { readonly k: 'start'; readonly part: number }
  | { readonly k: 'click'; readonly high: boolean }
  | {
      readonly k: 'sym'
      readonly part: number
      readonly i: number
      /** Beats it sounds for, when it starts a sound. */
      readonly held: number | null
      /** The drum it strikes in place of its note, in a part with drums: null for none. */
      readonly drum?: DrumHit | null
      /** Its own note, where its row gives one. */
      readonly note?: Spelled
    }
  | { readonly k: 'end'; readonly part: number; readonly cell: number }
  | { readonly k: 'count'; readonly part: number; readonly c: number }
  | { readonly k: 'pad'; readonly part: number; readonly pad: number }
  | { readonly k: 'arc'; readonly part: number; readonly group: number }
  | { readonly k: 'cue' }

/** A clock bar, the part it belongs to and the tempo its beats take. */
interface PlanBar {
  readonly bar: ClockBar<RbHit>
  readonly part: number
  readonly bpm: () => number
  /** Its first beat's place in its part's row. */
  readonly from: number
}

const isWhole = (x: number): boolean => Math.abs(x - Math.round(x)) < 1e-6

/** The hits of one part's row, at their beats from the row's start; a cue may fall before it. */
function partHits(
  part: PlayPart,
  index: number,
  cue?: Pick<PlayCue, 'early' | 'on'>,
): Hit<RbHit>[] {
  const scene = part.view.scene
  const row = scene.rows[part.row ?? 0]
  const placed = placeRow(row)
  const beats = beatsOf(row)
  const bar = barQuarters(metreOf(row))
  const unit = beatQuarters(metreOf(row))
  const padEvery = scene.padEvery ?? 1
  const sounds = soundsOf(placed)
  const drumOf = (n: number): DrumHit | null =>
    part.drums === undefined ? null : (part.drums[n] ?? null)
  const hits: Hit<RbHit>[] = [{ beat: 0, data: { k: 'start', part: index } }]
  // each pad lights as its beat or its eighth is heard
  for (let k = 0; k < Math.round(beats / padEvery); k++)
    hits.push({ beat: k * padEvery, data: { k: 'pad', part: index, pad: k } })
  // a grouped figure's arc under each of the metre's beats, as it starts
  if (scene.arcs === true && Math.round(unit / padEvery) >= 2)
    for (let g = 0; g < Math.round(beats / unit); g++)
      hits.push({ beat: g * unit, data: { k: 'arc', part: index, group: g } })
  // the metre's beats knock, each bar's first higher; a bare figure has no
  // bars, only its start
  const bare = scene.bare === true
  if (part.click !== false)
    for (let k = 0; k * unit < beats - 1e-6; k++)
      hits.push({
        beat: k * unit,
        data: { k: 'click', high: bare ? k === 0 : isWhole((k * unit) / bar) },
      })
  placed.forEach((p, i) => {
    const n = sounds.findIndex((sd) => sd.first === i)
    hits.push({
      beat: p.beat,
      data: {
        k: 'sym',
        part: index,
        i,
        held: n === -1 ? null : sounds[n].beats,
        ...(part.drums === undefined ? {} : { drum: drumOf(n) }),
        ...(n === -1 || row.notes?.[n] === undefined
          ? {}
          : { note: row.notes[n] }),
      },
    })
  })
  // a cue its seconds ahead of each sound it picks, before the row if need be
  if (cue !== undefined) {
    const ahead = (cue.early * part.bpm()) / 60
    sounds.forEach((sd, n) => {
      if (cue.on(drumOf(n)))
        hits.push({ beat: sd.at - ahead, data: { k: 'cue' } })
    })
  }
  stripCells(placed).forEach((c, cell) =>
    hits.push({ beat: c.at + c.beats, data: { k: 'end', part: index, cell } }),
  )
  // booked whether or not the counts show, so Count switched on mid-play lights them
  countsOf(placed, metreOf(row)).forEach((count, c) =>
    hits.push({ beat: count.at, data: { k: 'count', part: index, c } }),
  )
  return hits
}

/**
 * A play as the clock's bars: each part's row cut into its metre's bars,
 * four beats of 4/4 or three quarters of 6/8 or 3/4 (its last may be
 * shorter), a silent bar before a part that pauses, a bar of the metre's
 * clicks before one counted in, and a short last bar that holds what falls
 * on the end of the play. A part's first bar also takes what falls before
 * it, a cue ahead of its first sound.
 */
export function planPlay(
  parts: readonly PlayPart[],
  cue?: Pick<PlayCue, 'early' | 'on'>,
): PlanBar[] {
  const plan: PlanBar[] = []
  let carry: Hit<RbHit>[] = []
  const push = (
    beats: number,
    hits: Hit<RbHit>[],
    part: number,
    bpm: () => number,
    from: number,
  ) => {
    plan.push({
      bar: { beats, hits: [...carry, ...hits] },
      part,
      bpm,
      from,
    })
    carry = []
  }
  parts.forEach((part, index) => {
    if (part.pause !== undefined && part.pause > 0) {
      const seconds = part.pause
      push(1, [], index, () => 60 / seconds, -1)
    }
    const row = part.view.scene.rows[part.row ?? 0]
    const unit = beatQuarters(metreOf(row))
    if (part.countIn !== undefined && part.countIn > 0) {
      const clicks = Array.from(
        { length: part.countIn },
        (_, b): Hit<RbHit> => ({
          beat: b * unit,
          data: { k: 'click', high: b === 0 },
        }),
      )
      push(part.countIn * unit, clicks, index, part.bpm, -1)
    }
    const beats = beatsOf(row)
    const bar = barQuarters(metreOf(row))
    const hits = partHits(part, index, cue)
    for (let from = 0; from < beats; from += bar) {
      const len = Math.min(bar, beats - from)
      const inBar = hits
        .filter(
          (h) =>
            (from === 0 || h.beat >= from - 1e-6) && h.beat < from + len - 1e-6,
        )
        .map((h) => ({ beat: h.beat - from, data: h.data }))
      push(len, inBar, index, part.bpm, from)
    }
    carry = hits
      .filter((h) => h.beat >= beats - 1e-6)
      .map((h) => ({ beat: 0, data: h.data }))
  })
  // what falls on the play's end: its last readings
  if (carry.length > 0) push(1, [], parts.length - 1, () => 600, -1)
  return plan
}

/** Every row's state: what `written` says was heard, its cells read unless the readings are off. */
function blank(
  view: RhythmView,
  written?: (row: number, i: number) => boolean,
  readings = true,
): RowState[] {
  return view.scene.rows.map((row, r) => {
    const placed = placeRow(row)
    const shown = placed.map((_, i) => written?.(r, i) ?? false)
    return {
      written: shown,
      metre: view.scene.metreFirst === true || shown.some(Boolean),
      read: stripCells(placed).map(
        (c) => readings && shown.slice(c.first, c.last + 1).every(Boolean),
      ),
    }
  })
}

export function mountRhythmBar(o: RhythmBarOptions): RhythmBar {
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svgEl.setAttribute('aria-hidden', 'true')
  svgEl.setAttribute('focusable', 'false')
  o.figure.prepend(svgEl)
  let view: RhythmView | null = null
  let figure: RhythmFigure | null = null
  let states: RowState[] = []
  let chosen: number | null = null
  let run: Run | null = null
  let buttons: HTMLButtonElement[] = []
  // the counts faint, from a play that asked for it until the next play
  let faint = false
  let seen: RhythmSeen = { lanes: false, counts: false }
  // the taps' ticks, drawn again with every redraw until cleared
  let tickMarks: readonly RhythmTick[] | null = null
  const labelOf = (v: RhythmView): string =>
    seen.lanes ? (v.laneLabel ?? v.label) : v.label

  const paint = (): void => figure?.set(states)
  const patch = (row: number, next: Partial<RowState>): void => {
    states = states.map((s, i) => (i === row ? { ...s, ...next } : s))
  }

  function say(text: string): void {
    if (o.said.textContent === text) o.said.textContent = ''
    o.said.textContent = text
  }

  function placePads(): void {
    const layer = o.pads
    if (layer === null) return
    layer.replaceChildren()
    buttons = []
    if (view === null || figure === null || (view.pads ?? null) === null) {
      layer.hidden = true
      return
    }
    layer.hidden = false
    const placed = figure.rows[0].placed
    const beats = figure.layout.rows[0].beats
    for (let b = 0; b < beats; b++) {
      const box = figure.padBox(0, b)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'rb-padbtn'
      btn.dataset.beat = String(b)
      btn.style.left = `${box.x}px`
      btn.style.top = `${box.y}px`
      btn.style.width = `${box.w}px`
      btn.style.height = `${box.h}px`
      btn.setAttribute('aria-label', padWords(placed, b))
      if (view.pads === 'choose')
        btn.setAttribute('aria-pressed', String(chosen === b))
      btn.addEventListener('click', () => o.onPad?.(b))
      btn.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (step === 0) return
        e.preventDefault()
        const next = buttons[(b + step + beats) % beats]
        next.focus()
        if (view?.pads === 'choose') o.onPad?.(Number(next.dataset.beat))
      })
      layer.append(btn)
      buttons.push(btn)
    }
  }

  function draw(): void {
    if (view === null) return
    o.figure.dataset.voice = o.voice()
    const scene: RhythmScene = {
      ...view.scene,
      lanes: seen.lanes || view.scene.lanes === true,
      counts: seen.counts || view.scene.counts === true,
    }
    figure = drawRhythm(svgEl, scene, figureSize(o.figure))
    paint()
    if (tickMarks !== null) figure.ticks(0, tickMarks)
    placePads()
  }

  function show(
    next: RhythmView,
    written?: (row: number, i: number) => boolean,
    so: ShowOptions = {},
  ): void {
    view = next
    o.figure.setAttribute('aria-label', labelOf(next))
    states = blank(next, written, so.readings !== false).map((s, i) => ({
      ...s,
      faint,
      chosen: i === 0 ? chosen : null,
    }))
    draw()
  }

  function see(next: Partial<RhythmSeen>): void {
    seen = { ...seen, ...next }
    if (view === null) return
    o.figure.setAttribute('aria-label', labelOf(view))
    draw()
  }

  function retempo(bpm: number): void {
    if (view === null) return
    const rows = view.scene.rows.map((row) => ({ ...row, bpm }))
    view = { ...view, scene: { ...view.scene, rows } }
    // a cell filling at the old tempo stops; it reads at its end
    states = states.map((s) => ({
      ...s,
      read: s.read?.map(() => false),
      filling: null,
    }))
    draw()
  }

  function choose(beat: number | null): void {
    chosen = beat
    states = states.map((s, i) => (i === 0 ? { ...s, chosen: beat } : s))
    paint()
    for (const btn of buttons)
      if (btn.hasAttribute('aria-pressed'))
        btn.setAttribute(
          'aria-pressed',
          String(Number(btn.dataset.beat) === beat),
        )
  }

  function settle(): void {
    o.onFrame?.(null)
    states = states.map((s) => ({
      ...s,
      sounding: null,
      lit: null,
      filling: null,
      countLit: null,
    }))
    paint()
  }

  function stop(): void {
    const r = run
    run = null
    r?.stop()
    o.owner.release(stop)
    settle()
  }

  function play(
    parts: readonly PlayPart[],
    po: PlayOptions = {},
  ): Promise<boolean> {
    stop()
    if (parts.length === 0) return Promise.resolve(false)
    o.owner.claim(stop)
    faint = po.faint === true
    // a play draws its arcs afresh, each as its group starts
    states = states.map((s) => ({ ...s, faint, arcs: undefined }))
    paint()
    const plan = planPlay(parts, po.cue)
    const freq = o.freq()
    const audible = po.audible ?? Sound.canPlay()
    let at = 0
    const rowOf = (part: number): number => parts[part].row ?? 0
    const placedAll = parts.map((part) =>
      placeRow(part.view.scene.rows[part.row ?? 0]),
    )
    const cellsAll = placedAll.map((placed) => stripCells(placed))
    const placedOf = (part: number) => placedAll[part]
    const cellsOf = (part: number) => cellsAll[part]

    // a note is held, and its cell fills, at its own part's tempo as it is booked
    // a part with drums strikes them in place of its notes
    const book = (h: RbHit, when: number, bus: Bus): void => {
      if (h.k === 'click') bookWood(bus, when, h.high, WOOD_LEVEL)
      if (h.k !== 'sym' || h.held === null) return
      if (h.drum === undefined)
        bookNote(h.note === undefined ? freq : hz(midiOf(h.note)), {
          when,
          dur: heldSeconds(h.held, parts[h.part].bpm()),
          kind: po.kind ?? 'soft',
          to: bus.node,
        })
      else if (h.drum !== null) o.drum?.(h.drum, when, bus)
    }

    const heard = (h: RbHit): void => {
      if (h.k === 'click') return
      if (h.k === 'cue') {
        po.cue?.fire()
        return
      }
      const part = parts[h.part]
      const row = rowOf(h.part)
      if (h.k === 'start') {
        if (view !== part.view) show(part.view)
        if (part.fresh === true) {
          const n = placedOf(h.part).length
          patch(row, { written: Array<boolean>(n).fill(false) })
        }
      } else if (h.k === 'pad')
        states = states.map((s, i) => ({ ...s, lit: i === row ? h.pad : null }))
      else if (h.k === 'arc') {
        const was = states[row].arcs ?? []
        const arcs = Array.from(
          { length: Math.max(was.length, h.group + 1) },
          (_, g) => g === h.group || was[g] === true,
        )
        patch(row, { arcs })
      } else if (h.k === 'sym') onSymbol(h.part, row, h.i, h.held !== null)
      else if (h.k === 'end') onEnd(row, h.cell, h.part)
      else if (po.faint !== true) patch(row, { countLit: h.c })
      paint()
    }

    const onSymbol = (
      part: number,
      row: number,
      i: number,
      starts: boolean,
    ) => {
      const st = states[row]
      const written = st.written.map((w, k) => w || k === i)
      const cells = cellsOf(part)
      const cell = cells.findIndex((c) => c.first === i)
      const read = [...(st.read ?? cells.map(() => false))]
      const next: { -readonly [K in keyof RowState]?: RowState[K] } = {
        written,
        metre: st.metre || placedOf(part)[i].kind === 'note',
      }
      if (starts) next.sounding = i
      else if (placedOf(part)[i].kind === 'rest') next.sounding = null
      if (cell !== -1) {
        read[cell] = false
        next.read = read
        next.filling = {
          cell,
          seconds: (cells[cell].beats * 60) / parts[part].bpm(),
        }
      }
      patch(row, next)
    }

    const onEnd = (row: number, cell: number, part: number) => {
      const st = states[row]
      const cells = cellsOf(part)
      const read = [...(st.read ?? cells.map(() => false))]
      read[cell] = true
      const c = cells[cell]
      const at = st.sounding ?? null
      const ended = at !== null && at >= c.first && at <= c.last
      patch(row, {
        read,
        sounding: ended ? null : at,
        filling: st.filling?.cell === cell ? null : st.filling,
      })
    }

    // a bar of the click alone, or of silence, lights no pad
    const onBeat = (spot: Spot): void => {
      const p = plan[spot.bar] as PlanBar | undefined
      if (p === undefined || p.from >= 0) return
      states = states.map((s) => ({ ...s, lit: null }))
      paint()
    }

    const r = BeatClock.start<RbHit>({
      bar: (i) => {
        at = i
        return plan[i]?.bar ?? null
      },
      bpm: () => plan[at]?.bpm() ?? 60,
      audible,
      lead: po.lead,
      early: po.cue?.early,
      book,
      onHit: heard,
      onBeat,
      onFrame:
        o.onFrame === undefined ? undefined : (spot) => o.onFrame?.(spot.beats),
    })
    run = r
    return r.done.then((finished) => {
      if (run === r) {
        run = null
        o.owner.release(stop)
        settle()
      }
      if (finished && po.line !== undefined) say(po.line)
      return finished
    })
  }

  if (typeof ResizeObserver !== 'undefined') {
    let last = ''
    new ResizeObserver(() => {
      const { w, h } = figureSize(o.figure)
      const key = `${Math.round(w)}x${Math.round(h)}`
      if (key === last) return
      last = key
      draw()
    }).observe(o.figure)
  }

  return {
    show,
    see,
    get seen() {
      return seen
    },
    retempo,
    get view() {
      return view
    },
    play,
    stop,
    get playing() {
      return run !== null
    },
    choose,
    say,
    written: (row = 0) => [...(states[row]?.written ?? [])],
    light(next) {
      patch(0, { lit: next.pad, sounding: next.sounding })
      paint()
    },
    ticks(at) {
      tickMarks = at
      figure?.ticks(0, at ?? [])
    },
    get figure() {
      return figure
    },
  }
}
