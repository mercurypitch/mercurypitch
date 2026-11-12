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
// before anything plays (Sing it's five notes, the house on do), which
// keeps a column of its own for each note however narrow the figure, and
// the line said at the reach's end. Lessons 16 to 28 hand it their own.
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
// A state may hold a key signature (`key`, staff-key.ts), drawn just past
// the clef; a tap then plays its place as the signature has it, and a page
// changes it with `setKey`, which says it in words ("Key signature: two
// sharps, F sharp and C sharp") and lets a sign that joins fade in, or travel
// from the note that carried it (Lesson 21's WEB-SPEC, Toys 2). A state that
// keeps room for a signature's signs (`keyRoom`) keeps its notes still as the
// signature grows. A page whose taps judge a place hears each one
// (`onPick`), and a page that follows the clef switch itself takes over
// what a clef change says and shows (`onClef`).
//
// Lesson 16 reads along a written line. A state may name do (`solfa`), and
// each note then shows its syllable in a row under the staff, counted up
// from do, while Names is on (`[data-staff-names]`, Names on · off, or
// `setNames`); off hides the syllables and keeps the house. A state that
// writes a score lights its notes as they play (`show: 'score'`) and as a
// tap sounds one; a state with a `lead` plays it before each tapped place,
// do and then the note. A play's note may light a moment before it sounds
// (`ahead`): Hear it inside, a beat to imagine it in.
//
// A play may be silent (`silent`): its notes are written and lit on time
// and nothing sounds, while another voice sings them (Lesson 20's run toy,
// Merc's run sung as one line). Such a play is not the page's sound: it
// claims no owner, and the page that sings the run stops it with its own.
//
// "See it on the pitch line" (`[data-staff-lanes]`, a switch, off at first)
// is one choice for the visit, in memory: every staff toy on the page
// follows it (`PitchLine`), and a state can leave it out. The clef switch
// (`[data-staff-clef]`, Treble · Bass) stops what plays and keeps the
// selected place, so the same line names another note, which plays.

import { clamp, q, qa, svg } from './dom'
import { stripHit, whiteRange } from './key-strip'
import type { Spelled } from './notes'
import type { SoundOwner } from './now-playing'
import type { Run, RunNote } from './run'
import { playNotes } from './run'
import { Sound } from './sound'
import type { Layout, Mark, Scene, Tone } from './staff-draw'
import { drawScene, figureSize } from './staff-draw'
import type { KeySig } from './staff-key'
import { keyAlter, keyWords, NO_KEY } from './staff-key'
import type { Clef, StaffKind } from './staff-places'
import { midiOf, noteAt, placeOf, placeRange, sayPlace, staffName, syllableOf, writtenOf, } from './staff-places'
import type { StaffPlay, StaffState } from './staff-state'

export type { PlayNote, StaffPlay, StaffState } from './staff-state'

export interface StaffToy {
  readonly state: StaffState
  readonly clef: Clef
  readonly kind: StaffKind
  /** The key signature showing, or null for none. */
  readonly key: KeySig | null
  /** The note picked or moved, or null. */
  readonly selected: Spelled | null
  /** Whether the syllables show under the notes (a state with `solfa`). */
  readonly names: boolean
  /** Shows `s`: stops what plays and opens the state afresh. */
  setState(s: StaffState): void
  /** Switches a single staff's clef: stops what plays, keeps the selected place. */
  setClef(c: Clef): void
  /** Shows the syllables under the notes, or hides them and keeps the house. */
  setNames(on: boolean): void
  /**
   * Changes the key signature and keeps what the staff shows, saying it in
   * words unless `quiet`; a sign that joins fades in, or travels from beside
   * the note in run column `from` that carried it.
   */
  setKey(
    key: KeySig | null,
    how?: { readonly from?: number; readonly quiet?: boolean },
  ): void
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
  /** Lights score note `i`, or each of a list, in `tone`, the rest at rest; null for none. */
  light(i: number | readonly number[] | null, tone?: Tone): void
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
  /** Hears each place a tap, a step or an arrow picks, with its note as the signature has it. */
  readonly onPick?: (note: Spelled, place: number) => void
  /**
   * A page that follows the clef itself: once the clef has changed, by the
   * switch, a play or `setClef`, the toy hands it over, and says and plays
   * nothing of its own.
   */
  readonly onClef?: (clef: Clef) => void
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
/** The quiet between a state's lead and the tapped note, s (Lesson 16 FACTS 68). */
const LEAD_GAP = 0.2
/** The narrowest a key of the strip is drawn, px (FACTS 71). */
const KEY_MIN = 44

/**
 * The staff spaces a score asks across (staff-draw.ts `across`): the clef
 * and the margins, and two and a quarter for each note, so its noteheads,
 * their signs and the house under do never touch on a narrow screen; on a
 * narrow figure the staff draws smaller instead. Never fewer than the
 * drawing's own 9.
 */
export const scoreAcross = (notes: number): number =>
  Math.max(9, 5 + 2.25 * notes)

// ---------------------------------------------------------------- the toy

export function mountStaff(root: HTMLElement, o: StaffOptions): StaffToy {
  const el = q<SVGSVGElement>('[data-staff-svg]', root)
  const said = q('[data-staff-said]', root)
  const clefSeg = root.querySelector<HTMLElement>('[data-staff-clef]')
  const panBtns = qa<HTMLButtonElement>('[data-staff-pan]', root)
  const namesSeg = root.querySelector<HTMLElement>('[data-staff-names]')

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
  // the score's notes a play has lit, back to rest as it ends
  let playLit = new Set<number>()
  // the syllables under the notes, while Names is on
  let namesOn = state.names ?? true
  let sweepAt: number | null = null
  let layout: Layout | null = null
  // the key signature, and the sign that has just joined it, drawn once
  let key: KeySig | null = state.key ?? null
  let keyFresh: number | null = null
  let keyFrom: number | null = null
  // what sounds: a play or a tap, and the timers that put its notes back to rest
  let playing: Run | null = null
  let timers: number[] = []
  let plays = 0

  const whites = (): number[] =>
    state.keys === undefined ? [] : whiteRange(state.keys.lo, state.keys.hi)
  const reach = (): readonly [number, number] =>
    state.reach ?? placeRange(kindOf())
  /** A place's note as the key signature has it: F sharp on the F line under one sharp. */
  const keyed = (note: Spelled): Spelled =>
    key === null ? note : { ...note, alter: keyAlter(key, note.letter) }
  /** The staff's name, with its key signature. */
  const labelOf = (): string =>
    key === null || state.staff === 'grand'
      ? staffName(kindOf())
      : `${staffName(kindOf())}. ${keyWords(key)}`
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
                  home: state.house,
                },
              ]
    const lo = midiOf(noteAt(room[0], kind))
    const hi = midiOf(noteAt(room[1], kind))
    return {
      staff: kind,
      room,
      marks,
      cols: state.score?.length ?? runCols,
      across:
        state.score === undefined
          ? state.across
          : scoreAcross(state.score.length),
      letters: [...letters],
      gold,
      lanes: PitchLine.on && state.noLanes !== true ? { lo, hi } : null,
      keys:
        state.keys === undefined
          ? null
          : { ...state.keys, from, count: keyCount(), lit: keysLit },
      sweep: sweepAt,
      staffLit,
      key,
      keyFresh,
      keyFrom,
      keyRoom: state.keyRoom,
    }
  }

  function draw(): void {
    const s = scene()
    layout = drawScene(el, s)
    syllables(s, layout)
    for (const b of panBtns) {
      const dir = Number(b.dataset.staffPan)
      const end = dir < 0 ? from <= 0 : from >= whites().length - keyCount()
      b.setAttribute('aria-disabled', String(end))
    }
  }

  /** Each note's syllable, in a row under the staff, while Names is on. */
  function syllables(s: Scene, L: Layout): void {
    const home = state.solfa
    if (home === undefined || !namesOn || s.staff === 'grand') return
    const size = Math.min(18, Math.max(11, L.space * 0.75))
    const g = svg('g', { class: 'st-syls', 'aria-hidden': 'true' }, el)
    for (const m of s.marks)
      svg(
        'text',
        {
          x: L.colX(m.col).toFixed(1),
          y: (L.yOf(s.room[0]) + size * 0.36).toFixed(1),
          'text-anchor': 'middle',
          'font-size': size.toFixed(1),
          class: m.tone === 'rest' ? 'st-syl' : 'st-syl is-lit',
          text: syllableOf(m.note, home),
        },
        g,
      )
  }

  function say(text: string): void {
    if (said.textContent !== text) said.textContent = text
  }

  /** Lights score note `i` in `tone`, keeping the others as they are. */
  function scoreTone(i: number, tone: Tone): void {
    const next = (state.score ?? []).map((_, j) => scoreTones[j] ?? 'rest')
    next[i] = tone
    scoreTones = next
  }

  /** Puts every lit note back to rest. */
  function rest(): void {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    if (cursor !== null) cursor = { ...cursor, tone: 'rest' }
    run = run.map((m) => ({ ...m, tone: 'rest' }))
    keysLit = []
    staffLit = null
    for (const i of playLit) scoreTone(i, 'rest')
    playLit = new Set()
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
    // a silent play is another voice's sound, not the page's: it claims nothing
    if (p.silent !== true) o.owner.claim(stop)
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
    // the score's note each sounds, or none
    const cols = p.notes.map((n) =>
      p.show !== 'score'
        ? -1
        : (state.score ?? []).findIndex(
            (m) => midiOf(m.note) === midiOf(n.note),
          ),
    )
    /** Shows note `i` of the play in `tone`: in its column, as the one note, or on the score. */
    const show = (i: number, tone: Tone): void => {
      const n = p.notes[i]
      if (p.show === 'score') {
        if (cols[i] < 0) return
        scoreTone(cols[i], tone)
        playLit.add(cols[i])
      } else if (p.show === 'run') {
        const next = run.slice()
        next[i] = {
          note: n.note,
          col: i,
          tone,
          on: n.on,
          outline: n.outline,
          home: n.home,
        }
        run = next
      } else cursor = { note: n.note, tone, on: n.on }
    }
    const r = playNotes(notes, {
      audible,
      kind: p.kind ?? 'soft',
      gain: p.gain,
      onNote: (_n, i) => {
        if (mine !== plays) return
        const n = p.notes[i]
        show(i, n.tone ?? 'lit')
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
            if (p.show === 'score') {
              if (cols[i] >= 0) scoreTone(cols[i], 'rest')
            } else if (p.show === 'run') {
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
    // Hear it inside: a note lit, and silent, its beat before it sounds
    p.notes.forEach((n, i) => {
      if (n.ahead === undefined || n.ahead <= 0) return
      timers.push(
        window.setTimeout(
          () => {
            if (mine !== plays) return
            show(i, n.tone ?? 'lit')
            draw()
          },
          Math.max(0, n.t - n.ahead) * 1000,
        ),
      )
    })
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
    // do first, then the note, unless the note is do
    const first = state.lead
    const both = first !== undefined && midiOf(first) !== midiOf(note)
    void start(
      {
        notes: both
          ? [
              { t: 0, dur: sec, note: first },
              { t: sec + LEAD_GAP, dur: sec, note },
            ]
          : [{ t: 0, dur: sec, note }],
        show: state.score === undefined ? 'cursor' : 'score',
        say: extra === '' ? words : `${words}. ${extra}`,
      },
      Sound.canPlay(),
    )
    o.onPick?.(note, placeOf({ ...note, alter: 0 }, kindOf()))
  }

  function tapPlace(place: number): void {
    if (state.tap === 'none') return
    const [lo, hi] = reach()
    const at = clamp(place, lo, hi)
    const extra =
      at !== place && state.endLine !== undefined ? state.endLine : ''
    const note = keyed(noteAt(at, kindOf()))
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
    key = s.key == null || s.key.count === 0 ? null : s.key
    keyFresh = null
    keyFrom = null
    playLit = new Set()
    if (s.names !== undefined) namesOn = s.names
    from = Math.max(0, Math.floor((whites().length - keyCount()) / 2))
    el.setAttribute('aria-label', labelOf())
    showClef()
    showNames()
    draw()
  }

  function showNames(): void {
    if (namesSeg === null) return
    for (const b of qa<HTMLButtonElement>('button[data-names]', namesSeg))
      b.setAttribute(
        'aria-pressed',
        String((b.dataset.names === 'on') === namesOn),
      )
  }

  function setNames(on: boolean): void {
    namesOn = on
    showNames()
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
    el.setAttribute('aria-label', labelOf())
    showClef()
    draw()
    if (o.onClef !== undefined) {
      o.onClef(c)
      return
    }
    const name = c === 'treble' ? 'Treble clef' : 'Bass clef'
    // the selected place keeps its line or space, so the same line names
    // another note, and plays it
    if (sel === null || state.tap === 'none') say(`${name}.`)
    else pick(sel, state.tapSec ?? TAP_SEC, '', `${name}. `)
  }

  /**
   * The first sign of `now` that `was` lacks, by its place in the order: all
   * of them for a signature of the other kind, none for one no longer.
   */
  function joining(was: KeySig | null, now: KeySig | null): number | null {
    if (now === null) return null
    if (was === null || was.sign !== now.sign) return 0
    return now.count > was.count ? was.count : null
  }

  function setKey(
    next: KeySig | null,
    how: { readonly from?: number; readonly quiet?: boolean } = {},
  ): void {
    const was = key
    key =
      next === null || next.count === 0 || state.staff === 'grand' ? null : next
    const same =
      was?.sign === key?.sign && (was?.count ?? 0) === (key?.count ?? 0)
    keyFresh = joining(was, key)
    keyFrom = keyFresh === null ? null : (how.from ?? null)
    el.setAttribute('aria-label', labelOf())
    draw()
    // drawn once: a later redraw shows the signature as it stands
    keyFresh = null
    keyFrom = null
    if (how.quiet !== true && !same) say(keyWords(key ?? NO_KEY))
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
  if (namesSeg !== null)
    for (const b of qa<HTMLButtonElement>('button[data-names]', namesSeg))
      b.addEventListener('click', () => setNames(b.dataset.names === 'on'))
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
    get key() {
      return key
    },
    get selected() {
      return sel
    },
    get names() {
      return namesOn
    },
    setState,
    setClef,
    setNames,
    setKey,
    play: (p) => {
      if (p.clef !== undefined && state.staff !== 'grand' && p.clef !== clef)
        setClef(p.clef)
      return start(p, p.silent !== true && Sound.canPlay())
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
      const on = i === null ? [] : typeof i === 'number' ? [i] : i
      scoreTones = (state.score ?? []).map((_, j) =>
        on.includes(j) ? tone : 'rest',
      )
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
