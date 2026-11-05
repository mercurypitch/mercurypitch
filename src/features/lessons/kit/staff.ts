// ============================================================
// Staff toy — a staff in either clef, or the grand staff, that sounds every place it shows
// ============================================================
//
// Season 2's shared toy (Lesson 15's WEB-SPEC, Toys 1): the stats site's
// engraving as a page toy, mounted on a figure (`[data-staff-svg]` in a
// `.viz`). What a page's step shows is a state, handed in as an option
// (`StaffState`): one staff in a clef or the grand staff, what a tap does
// (play the place, move the one note, or nothing), whether the letters stay
// as each place plays, the key strip under the grand staff, a score written
// before anything plays (Sing it's five notes, the house on do) and the
// line said at the reach's end. Lessons 16 to 28 hand it their own.
//
// A tap on the staff picks the nearest place in reach and plays its note,
// its name beside it ("G4"); places are 13 px apart on a phone, so Step up
// and Step down, 44 px buttons under the drawing (`[data-staff-step]`), and
// the Up and Down arrows on the focused staff are the other ways in. The
// staff is a `role="group"` named for its state, and a polite live region
// (`[data-staff-said]`) says each place with its letter and octave, every
// sign as a word ("F sharp 4, the bottom space"). The one note of a mover
// state also follows a mouse or pen drag; on touch the figure keeps
// `touch-action: pan-y`, so a swipe scrolls the page and a tap moves it.
// On the key strip a tap plays its key and lights its note, a black key's
// on its letter's place with a sharp; Lower keys and Higher keys
// (`[data-staff-pan]`) move its window a white key at a time, and a play
// moves it to keep the sounding key in view.
//
// A page's plays (`play`) are runs of written notes on one clock
// (kit/run.ts `playNotes`): each note sounds and lights in the same task,
// on the pitch line too when it shows, so nothing a play draws comes before
// its sound. A run's notes stay in their columns as they sound; a cursor's
// one note moves to each in turn. A note may light its clef's line gold, or
// sound in Merc's voice with a blue head. Every play and tap is the page's
// one sound (`owner`): a newer sound anywhere stops it, its notes go back
// to rest, and a play cut short resolves false, so it counts as not heard.
//
// "See it on the pitch line" (`[data-staff-lanes]`, a switch, off at first)
// is one choice for the visit, in memory: every staff toy on the page
// follows it (`PitchLine`), and a state can leave it out. The clef switch
// (`[data-staff-clef]`, Treble · Bass) stops what plays and keeps the
// selected place, so the same line names another note, which plays.

import { clamp, q, qa } from './dom'
import { stripHit, whiteRange } from './key-strip'
import type { Spelled } from './notes'
import type { SoundOwner } from './now-playing'
import type { Run, RunNote } from './run'
import { playNotes } from './run'
import { Sound } from './sound'
import type { Layout, Mark, Scene, Tone } from './staff-draw'
import { drawScene, figureSize } from './staff-draw'
import type { Clef, StaffKind } from './staff-places'
import { midiOf, noteAt, placeOf, placeRange, sayPlace, staffName, writtenOf, } from './staff-places'

/** A step's state of the toy: the page's, handed in as an option. */
export interface StaffState {
  /** One staff, in `clef`, or the grand staff. */
  readonly staff: 'single' | 'grand'
  readonly clef?: Clef
  /** What a tap, a step or an arrow does: play the place, move the one note there, or nothing. */
  readonly tap: 'place' | 'mover' | 'none'
  /** The note the state opens on, drawn: the mover's start. */
  readonly start?: Spelled
  /** Each place's letter stays beside the staff once it has played. */
  readonly keep?: boolean
  /** How long a tapped note sounds, s. */
  readonly tapSec?: number
  /** The key strip under the grand staff, its lowest and highest white keys. */
  readonly keys?: { readonly lo: number; readonly hi: number }
  /** Notes written before anything plays, in a run (Sing it's five). */
  readonly score?: readonly {
    readonly note: Spelled
    readonly home?: boolean
  }[]
  /** The places a tap or a step reaches; the toy's range by default (staff-places.ts `placeRange`). */
  readonly reach?: readonly [number, number]
  /** Said when a step or a tap meets the reach's end. */
  readonly endLine?: string
  /** No pitch line beside it, whatever the switch says. */
  readonly noLanes?: boolean
}

/** A note of a play: when it starts and how long it sounds, s, and how it lights. */
export interface PlayNote {
  readonly t: number
  readonly dur: number
  readonly note: Spelled
  /** Its tone: the soft tone unless the play's or the note's says Merc's "ooh". */
  readonly kind?: 'soft' | 'merc'
  /** How it lights while it sounds: ink by default, blue for Merc's own note. */
  readonly tone?: Tone
  /** On the grand staff, the staff middle C is written on. */
  readonly on?: Clef
  /** The clef whose line goes gold as it sounds. */
  readonly gold?: Clef
  /** The staff of the grand staff it names, lit as it sounds. */
  readonly staffLit?: Clef
}

/** A page's play on the toy. */
export interface StaffPlay {
  readonly notes: readonly PlayNote[]
  /** 'run': each note in its own column, staying; 'cursor': the one note moves to each. */
  readonly show: 'run' | 'cursor'
  /** The clef it opens on a single staff. */
  readonly clef?: Clef
  /** Each note's letter stays beside the staff as it sounds. */
  readonly keep?: boolean
  readonly kind?: 'soft' | 'merc'
  readonly gain?: number
  /** Said as it starts. */
  readonly say?: string
}

export interface StaffToy {
  readonly state: StaffState
  readonly clef: Clef
  readonly kind: StaffKind
  /** The note picked or moved, or null. */
  readonly selected: Spelled | null
  /** Shows `s`: stops what plays and opens the state afresh. */
  setState(s: StaffState): void
  /** Switches a single staff's clef: stops what plays, keeps the selected place. */
  setClef(c: Clef): void
  /** Plays `p`; resolves true when heard to its end with nothing cutting it short. */
  play(p: StaffPlay): Promise<boolean>
  /** Taps a place, as a tap on the staff does. */
  tapPlace(place: number): void
  /** Taps a key, as a tap on the strip does. */
  tapKey(midi: number): void
  /** Step up (1) or down (-1) from the selected place. */
  step(dir: 1 | -1): void
  /** Moves the key strip's window a white key lower (-1) or higher (1). */
  panKeys(dir: 1 | -1): void
  /** Lights score note `i` in `tone`, the rest at rest; null for none. */
  light(i: number | null, tone?: Tone): void
  /** The guide's line across the score, 0 to 1, or null for none. */
  sweep(u: number | null): void
  /** Says `text` in the live region. */
  say(text: string): void
  stop(): void
}

export interface StaffOptions {
  readonly state: StaffState
  /** One sound at a time: the page's owner (kit/now-playing.ts). */
  readonly owner: SoundOwner
}

// ---------------------------------------------------------------- the switch

const lanesListeners = new Set<(on: boolean) => void>()
let lanesOn = false

/** "See it on the pitch line": one choice for the visit, in memory, which every staff toy on the page follows. */
export const PitchLine = {
  get on(): boolean {
    return lanesOn
  },
  set(on: boolean): void {
    if (on === lanesOn) return
    lanesOn = on
    lanesListeners.forEach((fn) => fn(on))
  },
  /** Calls `fn` now and after every change. */
  subscribe(fn: (on: boolean) => void): void {
    lanesListeners.add(fn)
    fn(lanesOn)
  },
}

/** How long a tapped note sounds, s, unless the state says (Lesson 15 FACTS 64). */
const TAP_SEC = 0.8
/** A mover's note, at each place it lands on (FACTS 66). */
const MOVE_SEC = 0.6
/** The narrowest a key of the strip is drawn, px (FACTS 71). */
const KEY_MIN = 44

// ---------------------------------------------------------------- the toy

export function mountStaff(root: HTMLElement, o: StaffOptions): StaffToy {
  const el = q<SVGSVGElement>('[data-staff-svg]', root)
  const said = q('[data-staff-said]', root)
  const clefSeg = root.querySelector<HTMLElement>('[data-staff-clef]')
  const panBtns = qa<HTMLButtonElement>('[data-staff-pan]', root)

  let state = o.state
  let clef: Clef = state.clef ?? 'treble'
  const kindOf = (): StaffKind => (state.staff === 'grand' ? 'grand' : clef)
  // the note picked or moved, which a step goes on from at once; the staff
  // draws it only as it sounds (`cursor`)
  let sel: Spelled | null = null
  // what the staff shows: the one note, a run's notes, a score, the letters kept
  let cursor: { note: Spelled; tone: Tone; on?: Clef } | null = null
  let run: Mark[] = []
  let runCols = 1
  let letters = new Set<number>()
  let gold: Clef | null = null
  let staffLit: Clef | null = null
  let keysLit: number[] = []
  let from = 0
  let scoreTones: Tone[] = []
  let sweepAt: number | null = null
  let layout: Layout | null = null
  // what sounds: a play or a tap, and the timers that put its notes back to rest
  let playing: Run | null = null
  let timers: number[] = []
  let plays = 0

  const whites = (): number[] =>
    state.keys === undefined ? [] : whiteRange(state.keys.lo, state.keys.hi)
  const reach = (): readonly [number, number] =>
    state.reach ?? placeRange(kindOf())
  const keyCount = (): number => {
    const w = figureSize(el).w - 24
    return Math.max(1, Math.min(whites().length, Math.floor(w / KEY_MIN)))
  }

  function scene(): Scene {
    const kind = kindOf()
    const room = placeRange(kind)
    const marks: Mark[] =
      state.score !== undefined
        ? state.score.map((n, i) => ({
            note: n.note,
            col: i,
            tone: scoreTones[i] ?? 'rest',
            home: n.home,
          }))
        : run.length > 0
          ? run.filter((m) => m !== undefined)
          : cursor === null
            ? []
            : [
                {
                  note: cursor.note,
                  tone: cursor.tone,
                  on: cursor.on,
                  named: true,
                },
              ]
    const lo = midiOf(noteAt(room[0], kind))
    const hi = midiOf(noteAt(room[1], kind))
    return {
      staff: kind,
      room,
      marks,
      cols: state.score?.length ?? runCols,
      letters: [...letters],
      gold,
      lanes: PitchLine.on && state.noLanes !== true ? { lo, hi } : null,
      keys:
        state.keys === undefined
          ? null
          : { ...state.keys, from, count: keyCount(), lit: keysLit },
      sweep: sweepAt,
      staffLit,
    }
  }

  function draw(): void {
    layout = drawScene(el, scene())
    for (const b of panBtns) {
      const dir = Number(b.dataset.staffPan)
      const end = dir < 0 ? from <= 0 : from >= whites().length - keyCount()
      b.setAttribute('aria-disabled', String(end))
    }
  }

  function say(text: string): void {
    if (said.textContent !== text) said.textContent = text
  }

  /** Puts every lit note back to rest. */
  function rest(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    if (cursor !== null) cursor = { ...cursor, tone: 'rest' }
    run = run.map((m) => ({ ...m, tone: 'rest' }))
    keysLit = []
    staffLit = null
  }

  function stop(): void {
    if (playing === null) return
    plays += 1
    playing.stop()
    playing = null
    rest()
    o.owner.release(stop)
    draw()
  }

  /** Keeps a key of the strip in its window. */
  function showKey(midi: number): void {
    const keys = whites()
    const i = keys.indexOf(writtenWhite(midi))
    const count = keyCount()
    if (i < 0 || (i >= from && i < from + count)) return
    from = clamp(i - Math.floor(count / 2), 0, Math.max(0, keys.length - count))
  }

  /** A black key's white key below, the one its sharp is written on. */
  const writtenWhite = (midi: number): number =>
    midiOf({ ...writtenOf(midi), alter: 0 })

  function start(p: StaffPlay, audible: boolean): Promise<boolean> {
    stop()
    o.owner.claim(stop)
    const mine = ++plays
    rest()
    gold = null
    if (p.show === 'run') {
      run = []
      runCols = p.notes.length
      cursor = null
    } else run = []
    const notes: RunNote[] = p.notes.map((n) => ({
      t: n.t,
      midi: midiOf(n.note),
      dur: n.dur,
      kind: n.kind ?? p.kind ?? 'soft',
    }))
    const r = playNotes(notes, {
      audible,
      kind: p.kind ?? 'soft',
      gain: p.gain,
      onNote: (_n, i) => {
        if (mine !== plays) return
        const n = p.notes[i]
        const tone = n.tone ?? 'lit'
        if (p.show === 'run') {
          const next = run.slice()
          next[i] = { note: n.note, col: i, tone, on: n.on }
          run = next
        } else cursor = { note: n.note, tone, on: n.on }
        if (p.keep === true || state.keep === true)
          letters.add(placeOf(n.note, kindOf()))
        if (n.gold !== undefined) gold = n.gold
        staffLit = n.staffLit ?? null
        if (state.keys !== undefined) {
          keysLit = [midiOf(n.note)]
          showKey(midiOf(n.note))
        }
        if (p.say === undefined && p.notes.length === 1)
          say(sayPlace(n.note, kindOf(), n.on))
        timers.push(
          window.setTimeout(() => {
            if (mine !== plays) return
            if (p.show === 'run') {
              const back = run.slice()
              if (back[i] !== undefined) back[i] = { ...back[i], tone: 'rest' }
              run = back
            } else if (cursor !== null && cursor.note === n.note)
              cursor = { ...cursor, tone: 'rest' }
            keysLit = keysLit.filter((m) => m !== midiOf(n.note))
            draw()
          }, n.dur * 1000),
        )
        draw()
      },
    })
    playing = r
    if (p.say !== undefined) say(p.say)
    return r.done.then((heard) => {
      if (mine !== plays) return false
      playing = null
      rest()
      o.owner.release(stop)
      draw()
      return heard
    })
  }

  /**
   * Picks `note`, plays it for `sec`, and says where it sits; `extra`
   * follows the words and `lead` comes before them.
   */
  function pick(note: Spelled, sec: number, extra = '', lead = ''): void {
    const words = `${lead}${sayPlace(note, kindOf())}`
    sel = note
    run = []
    runCols = 1
    if (state.keep === true) letters.add(placeOf(note, kindOf()))
    void start(
      {
        notes: [{ t: 0, dur: sec, note }],
        show: 'cursor',
        say: extra === '' ? words : `${words}. ${extra}`,
      },
      Sound.canPlay(),
    )
  }

  function tapPlace(place: number): void {
    if (state.tap === 'none') return
    const [lo, hi] = reach()
    const at = clamp(place, lo, hi)
    const extra =
      at !== place && state.endLine !== undefined ? state.endLine : ''
    const note = noteAt(at, kindOf())
    pick(
      note,
      state.tap === 'mover' ? MOVE_SEC : (state.tapSec ?? TAP_SEC),
      extra,
    )
  }

  function tapKey(midi: number): void {
    if (state.tap === 'none') return
    pick(writtenOf(midi), state.tapSec ?? TAP_SEC)
  }

  function step(dir: 1 | -1): void {
    if (state.tap === 'none') return
    const [lo, hi] = reach()
    const now =
      sel === null
        ? dir > 0
          ? lo - 1
          : hi + 1
        : placeOf({ ...sel, alter: 0 }, kindOf())
    const next = now + dir
    if (next < lo || next > hi) {
      if (state.endLine !== undefined) say(state.endLine)
      return
    }
    tapPlace(next)
  }

  function setState(s: StaffState): void {
    stop()
    state = s
    if (s.clef !== undefined) clef = s.clef
    run = []
    runCols = 1
    letters = new Set()
    gold = null
    staffLit = null
    keysLit = []
    scoreTones = []
    sweepAt = null
    sel = s.start ?? null
    cursor = s.start === undefined ? null : { note: s.start, tone: 'rest' }
    from = Math.max(0, Math.floor((whites().length - keyCount()) / 2))
    el.setAttribute('aria-label', staffName(kindOf()))
    showClef()
    draw()
  }

  function showClef(): void {
    if (clefSeg === null) return
    for (const b of qa<HTMLButtonElement>('button[data-clef]', clefSeg))
      b.setAttribute('aria-pressed', String(b.dataset.clef === clef))
  }

  /** The note at the same place on the staff `to` shows. */
  const moved = (note: Spelled, fromKind: StaffKind, to: StaffKind): Spelled =>
    noteAt(placeOf({ ...note, alter: 0 }, fromKind), to)

  function setClef(c: Clef): void {
    if (state.staff === 'grand') return
    stop()
    const was = kindOf()
    if (c === clef) return
    clef = c
    if (sel !== null) sel = moved(sel, was, c)
    if (cursor !== null)
      cursor = { note: moved(cursor.note, was, c), tone: 'rest' }
    run = run.map((m) => ({ ...m, note: moved(m.note, was, c), tone: 'rest' }))
    if (gold !== null) gold = null
    el.setAttribute('aria-label', staffName(c))
    showClef()
    draw()
    const name = c === 'treble' ? 'Treble clef' : 'Bass clef'
    // the selected place keeps its line or space, so the same line names
    // another note, and plays it
    if (sel === null || state.tap === 'none') say(`${name}.`)
    else pick(sel, state.tapSec ?? TAP_SEC, '', `${name}. `)
  }

  // ------------------------------------------------------------ input

  /** The place or key under a pointer, in the figure's pixels. */
  function hit(e: PointerEvent): { key: number } | { place: number } | null {
    if (layout === null) return null
    const box = el.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    if (layout.strip !== null && y >= layout.strip.spec.top) {
      const key = stripHit(layout.strip, x, y)
      return key === null ? null : { key }
    }
    return { place: layout.placeAt(y) }
  }

  let dragging = false
  el.addEventListener('pointerdown', (e) => {
    const h = hit(e)
    if (h === null) return
    if ('key' in h) tapKey(h.key)
    else tapPlace(h.place)
    // a mouse or a pen drags the mover's note; a finger scrolls the page
    if (state.tap === 'mover' && e.pointerType !== 'touch') {
      dragging = true
      el.setPointerCapture?.(e.pointerId)
    }
  })
  el.addEventListener('pointermove', (e) => {
    if (!dragging || layout === null || sel === null) return
    const h = hit(e)
    if (h === null || 'key' in h) return
    const [lo, hi] = reach()
    const at = clamp(h.place, lo, hi)
    if (at !== placeOf({ ...sel, alter: 0 }, kindOf())) tapPlace(h.place)
  })
  const endDrag = (): void => {
    dragging = false
  }
  el.addEventListener('pointerup', endDrag)
  el.addEventListener('pointercancel', endDrag)
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    step(e.key === 'ArrowUp' ? 1 : -1)
  })

  for (const b of qa<HTMLButtonElement>('[data-staff-step]', root))
    b.addEventListener('click', () =>
      step(Number(b.dataset.staffStep) > 0 ? 1 : -1),
    )
  for (const b of panBtns)
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-disabled') === 'true') return
      toy.panKeys(Number(b.dataset.staffPan) > 0 ? 1 : -1)
    })
  if (clefSeg !== null)
    for (const b of qa<HTMLButtonElement>('button[data-clef]', clefSeg))
      b.addEventListener('click', () =>
        setClef(b.dataset.clef === 'bass' ? 'bass' : 'treble'),
      )
  for (const b of qa<HTMLButtonElement>('[data-staff-lanes]', root))
    b.addEventListener('click', () => PitchLine.set(!PitchLine.on))
  PitchLine.subscribe((on) => {
    for (const b of qa<HTMLButtonElement>('[data-staff-lanes]', root))
      b.setAttribute('aria-pressed', String(on))
    if (layout !== null) draw()
  })
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(() => {
      if (layout !== null) draw()
    }).observe(el)

  const toy: StaffToy = {
    get state() {
      return state
    },
    get clef() {
      return clef
    },
    get kind() {
      return kindOf()
    },
    get selected() {
      return sel
    },
    setState,
    setClef,
    play: (p) => {
      if (p.clef !== undefined && state.staff !== 'grand' && p.clef !== clef)
        setClef(p.clef)
      return start(p, Sound.canPlay())
    },
    tapPlace,
    tapKey,
    step,
    panKeys(dir) {
      const max = Math.max(0, whites().length - keyCount())
      from = clamp(from + dir, 0, max)
      draw()
    },
    light(i, tone = 'lit') {
      scoreTones = (state.score ?? []).map((_, j) => (j === i ? tone : 'rest'))
      draw()
    },
    sweep(u) {
      sweepAt = u
      draw()
    },
    say,
    stop,
  }
  setState(state)
  return toy
}
