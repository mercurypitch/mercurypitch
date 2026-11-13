// ============================================================
// Lesson 25's steps' toy — the minor staircase with its chord column, over the learner's staff
// ============================================================
//
// One toy in five places, Steps 1 to 4 and free play (WEB-SPEC, Toys 1).
// Lesson 10's minor staircase on A is the kit's (stairs-core.ts), compact,
// a syllable a stair and each riser's size in semitones, on rows from A2
// to C4 for the bass clef or A3 to C5 for the treble, and in Step 1 and
// free play the chord on so stands beside it as a column of Lesson 10's
// beads (kit/chord-column.ts). Under it the learner's staff, the kit's
// staff toy, writes each figure as it plays, a bar per figure, and sounds
// it: the staircase lights its stairs on the same clock, silently, as
// Lesson 21's does, the notes and the stairs in the clef's singer's colour,
// blue on the bass staff and orange on the treble, and the column lights
// its beads while its chord sounds. Every sound is the page's one
// (`NowPlaying`): the staff claims it with the toy's own stop, so a sound
// anywhere stops a play here, between its figures too, and a tap on the
// staff ends a play where it stands, the tapped note sounding on as the
// toy's.
//
// Raise te (Step 1, free play) lifts te a semitone to ti, harmonic minor,
// and slides the column's middle bead a row, G to G♯, its gaps and its
// name changing as it lands. Raise le (Step 3, free play) lifts le to la as
// well, on the way up only, melodic minor; in free play the two keep to
// its rule, so le never rises without te (WEB-SPEC, Edge cases). Step 2
// outlines the le-to-ti stair with its "3". A play shows its own stairs
// while it sounds, Play so, ti, do lifting te for as long as it does, and
// then the stairs go back to the switches. Step 4's stay where its play
// leaves them: C major redrawn as A minor, do gliding from C down to A, or
// C minor, whose flats then travel from their notes into the signature,
// on the learner's staff and on the small staff in the other clef, which
// shows the signature alone. A play cut short there lands where it was
// going, C minor's flats in the signature.
//
// Until the cold open's choice (`unlock`) the toy holds back what would
// answer it, Raise te (in free play Raise le and the chord's play too) and
// the chord column, under the steps' lock line (FACTS 36). The clef
// follows the learner's voice and the Clef switch: the whole toy moves an
// octave and what plays stops. "See it on the pitch line" swaps the
// staircase for the staff's pitch line, the same notes lit (FACTS 8).

import type { ChordColumn } from '@/features/lessons/kit/chord-column'
import { chordColumn, COLUMN_W } from '@/features/lessons/kit/chord-column'
import type { Raises } from '@/features/lessons/kit/chords'
import { HARMONIC_MINOR_DEGREES, minorDegrees, } from '@/features/lessons/kit/chords'
import { q, qa } from '@/features/lessons/kit/dom'
import { COLOR } from '@/features/lessons/kit/notes'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import { Sound } from '@/features/lessons/kit/sound'
import type { StaffState, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff, PitchLine, scoreAcross, } from '@/features/lessons/kit/staff'
import type { Tone } from '@/features/lessons/kit/staff-draw'
import { drawScene, emptyScene, figureSize, } from '@/features/lessons/kit/staff-draw'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import type { StairsRoom } from '@/features/lessons/kit/stairs-geometry'
import type { NoteEvent } from '@/features/lessons/kit/stairs-plays'
import { sameDegrees } from '@/features/lessons/kit/stairs-scales'
import { chordHomeSaid, chordSaid, columnChord, FIGURE_SAID, lookSaid, NATURAL_SCALE_SAID, raiseSaid, } from './minor-words'
import type { Figure, Look, PlayId } from './sounds'
import { C_MINOR_KEY, cDo, FLAT_COLUMNS, GLIDE_SEC, minorDo, playOf, rowsOf, } from './sounds'

/** What the toy offers in one place on the page. */
export interface MinorState {
  /** The stairs as the step opens: te raised (harmonic minor), and le too (melodic). */
  readonly te: boolean
  readonly le: boolean
  /** Raise te and Raise le, where the step offers them. */
  readonly raiseTe: boolean
  readonly raiseLe: boolean
  /** The chord on so's column beside the stairs. */
  readonly column: boolean
  /** Le to ti outlined, with its "3", while the stairs are harmonic minor's. */
  readonly outline: boolean
  /** Room for three flats on the learner's staff, and the small staff in the other clef. */
  readonly signature: boolean
  /** The staircase stays where a play leaves it, C's or A's (Step 4). */
  readonly stays: boolean
}

/** Steps 1 to 4 and free play (WEB-SPEC, Toys 1). */
export const MINOR_STATES = {
  1: {
    te: false,
    le: false,
    raiseTe: true,
    raiseLe: false,
    column: true,
    outline: false,
    signature: false,
    stays: false,
  },
  2: {
    te: true,
    le: false,
    raiseTe: false,
    raiseLe: false,
    column: false,
    outline: true,
    signature: false,
    stays: false,
  },
  3: {
    te: true,
    le: false,
    raiseTe: false,
    raiseLe: true,
    column: false,
    outline: false,
    signature: false,
    stays: false,
  },
  4: {
    te: false,
    le: false,
    raiseTe: false,
    raiseLe: false,
    column: false,
    outline: false,
    signature: true,
    stays: true,
  },
  free: {
    te: false,
    le: false,
    raiseTe: true,
    raiseLe: true,
    column: true,
    outline: true,
    signature: true,
    stays: false,
  },
} as const satisfies Readonly<Record<string | number, MinorState>>

/** The le-to-ti riser in harmonic minor, outlined with its size (WEB-SPEC, Look). */
const WIDE = { riser: 5, label: '3' } as const

/** The staircase's starts: A and C, three semitones apart (kit/stairs-geometry.ts `floorOf`). */
const rangeOf = (clef: Clef) => ({ lo: minorDo(clef), hi: cDo(clef) })

/** A figure's notes as the staircase lights them. */
const eventsOf = (f: Figure): NoteEvent[] =>
  f.notes.map((n) => ({ midi: midiOf(n.note), at: n.t, dur: n.dur }))

export interface MinorToy {
  readonly core: StairsCore
  readonly staff: StaffToy
  readonly column: ChordColumn
  /** The switches as they stand. */
  readonly raises: Raises
  readonly clef: Clef
  /** Opens one place's state: stops what plays, the switches as it sets them. */
  setState(state: MinorState): void
  /** The learner's clef: through the staff's own switch, which hands it back. */
  setClef(clef: Clef): void
  /** The cold open's choice: the column draws in and the held controls open. */
  unlock(): void
  /** Plays `id`; true when heard to its end with nothing cutting it short. */
  play(id: PlayId): Promise<boolean>
  stop(): void
}

export function mountMinorToy(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on its step. */
    readonly active: () => boolean
    readonly clef: Clef
    readonly state: MinorState
    readonly light?: PlayLight
  },
): MinorToy {
  const light = o.light ?? playLights()
  const canvas = q<HTMLCanvasElement>('[data-beads-canvas]', root)
  const stairsViz = q('[data-beads-viz]', root)
  const said = q('[data-beads-said]', root)
  const small = q<SVGSVGElement>('[data-staff-small]', root)
  const lockLine = q('[data-lock-line]', root)
  const teBtn = q<HTMLButtonElement>('[data-raise="te"]', root)
  const leBtn = q<HTMLButtonElement>('[data-raise="le"]', root)
  const playBtns = qa<HTMLButtonElement>('[data-minor-play]', root)

  let state: MinorState = o.state
  let clef: Clef = o.clef
  let held = true
  let raises: Raises = { te: state.te, le: state.le }
  /** Step 4's staircase, where its last play left it. */
  let kept: Look | null = null
  /** Where Step 4's play in flight is going, landed at once if it is cut short. */
  let landing: { look: Look; flats: boolean } | null = null
  let token = 0
  let timers: number[] = []
  let wakes: (() => void)[] = []

  const switched = (): Look => ({
    degrees: minorDegrees(raises),
    tonic: minorDo(clef),
  })
  const rest = (): Look => (state.stays && kept !== null ? kept : switched())
  const holds = (): boolean => held && state.column
  const tone = (): Tone => (clef === 'bass' ? 'blue' : 'orange')

  // the column asks the staircase for frames once both exist
  let redraw = (): void => undefined
  const column = chordColumn(() => redraw())
  // the room the staircase keeps, read at every frame: the column's at its
  // right, and its own rows, which stand still as do glides
  const room: StairsRoom = {
    get right() {
      return state.column ? COLUMN_W : 0
    },
    get rows() {
      return rowsOf(clef)
    },
  }
  const core = mountStairs({
    canvas,
    compact: true,
    active: o.active,
    range: rangeOf(clef),
    degrees: rest().degrees,
    numbers: true,
    room,
    overlay: column,
  })
  redraw = () => core.redraw()
  core.set({ steps: true })

  // the staff's sound is the toy's: a staff play claims the page's owner
  // with the toy's own stop, which ends a play between figures too
  const owner: SoundOwner = {
    claim: () => NowPlaying.claim(halt),
    release: () => undefined,
  }
  const staffState = (key: KeySig | null = null): StaffState => ({
    staff: 'single',
    clef,
    tap: 'place',
    // the scales' F sharp and G sharp, and C minor's flats, each before
    // its note
    across: scoreAcross(8, true),
    keyRoom: state.signature ? 3 : undefined,
    key,
  })
  const staff = mountStaff(root, {
    state: staffState(),
    owner,
    onClef: (c) => clefChanged(c),
  })

  function say(line: string): void {
    said.textContent = line
  }

  /** The small staff in the other clef: its signature alone, `fresh` the sign that has just joined it. */
  function drawSmall(fresh: number | null = null): void {
    small.toggleAttribute('hidden', !state.signature)
    if (!state.signature) return
    const other: Clef = clef === 'bass' ? 'treble' : 'bass'
    drawScene(
      small,
      {
        ...emptyScene(other, [0, 8]),
        small: true,
        key: staff.key,
        keyFresh: fresh,
      },
      figureSize(small),
    )
  }

  // the look the staircase was last told to show, for the figure's name
  let named: Look | null = null

  /** The staircase shows `look`: its changed stairs slide, do glides to a new do (0.6 s), at once when `now`. */
  function show(look: Look, now = false): void {
    const glide = look.tonic !== core.tonic
    if (now) core.setDegrees(look.degrees)
    else core.slideDegrees(look.degrees, glide ? GLIDE_SEC : undefined)
    core.setTonic(look.tonic, now ? 0 : GLIDE_SEC)
    core.setOutline(
      state.outline && sameDegrees(look.degrees, HARMONIC_MINOR_DEGREES)
        ? WIDE
        : null,
    )
    named = look
    nameFigure()
  }

  /** The figure's name: its staircase, and once drawn the chord column beside it. */
  function nameFigure(): void {
    if (named === null) return
    const beside =
      state.column && !held
        ? ` Beside it, the chord on so: ${chordSaid(minorDo(clef), raises.te)}`
        : ''
    canvas.setAttribute('aria-label', `${lookSaid(named)}${beside}`)
  }

  function syncColumn(): void {
    column.set(columnChord(minorDo(clef), raises.te))
    column.show(state.column && !held)
    nameFigure()
  }

  function syncControls(): void {
    const hold = holds()
    teBtn.disabled = hold
    leBtn.disabled = hold
    teBtn.setAttribute('aria-pressed', String(raises.te))
    leBtn.setAttribute('aria-pressed', String(raises.le))
    for (const b of playBtns)
      if (b.dataset.minorPlay === 'chord-home') b.disabled = hold
    // the steps show it on Step 1 alone (kit/step-parts.ts); the choice puts it away
    lockLine.hidden = lockLine.hidden || !hold
    if (!lockLine.hasAttribute('data-part')) lockLine.hidden = !hold
  }

  // ---------------------------------------------------------------- the plays

  /** Stops what plays, a wait between figures too, and lands a Step 4 play where it was going. */
  function halt(): void {
    end(true)
    NowPlaying.release(halt)
  }

  /**
   * Ends a play where it stands: its later figures and waits never come,
   * the staircase and the column stop, and a Step 4 play lands where it was
   * going. `quiet` stops the staff's sound too, which a tap keeps.
   */
  function end(quiet: boolean): void {
    token += 1
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    const waiting = wakes
    wakes = []
    waiting.forEach((wake) => wake())
    if (quiet) staff.stop()
    core.stop()
    column.clear()
    const going = landing
    landing = null
    if (going !== null) land(going)
  }

  /** Step 4's play cut short: the staircase and the house where it was going, and C minor's flats in the signature. */
  function land(going: { look: Look; flats: boolean }): void {
    kept = going.look
    show(going.look, true)
    if (going.flats) {
      staff.setKey(C_MINOR_KEY, { quiet: true })
      drawSmall()
    }
  }

  /** Waits until `at` on the page's clock, ms; false when a stop came first. */
  function waitUntil(at: number, mine: number): Promise<boolean> {
    const wait = at - performance.now()
    if (wait <= 0) return Promise.resolve(mine === token)
    return new Promise((resolve) => {
      const wake = (): void => {
        wakes = wakes.filter((w) => w !== wake)
        resolve(mine === token)
      }
      wakes.push(wake)
      timers.push(window.setTimeout(wake, wait))
    })
  }

  /** Shows a figure's stairs and plays it on the staff, the stairs and the column's beads lit as it sounds; true when heard. */
  async function sound(f: Figure, mine: number): Promise<boolean> {
    show(f.look)
    const audible = Sound.canPlay()
    const lit = tone()
    void core.play(eventsOf(f), false, {
      color: lit === 'blue' ? COLOR.blue : COLOR.orange,
    })
    if (f.chord !== undefined) {
      const t = performance.now() / 1000
      for (let i = 0; i < 3; i++) column.light(i, t, t + f.chord)
    }
    const heard = await staff.play({
      show: 'run',
      notes: f.notes.map((n) => ({ ...n, tone: lit })),
      gain: f.gain,
    })
    // a tap on the staff cuts a sounding figure short: the play ends there,
    // and the tapped note, sounding now, is the toy's, which keeps the
    // page's owner
    if (audible && !heard && mine === token) end(false)
    return heard
  }

  /** C minor's flats travel from their notes into the signature, B♭, E♭, A♭, on both staves (FACTS 27, 64). */
  async function flatsIn(mine: number): Promise<boolean> {
    for (let i = 0; i < FLAT_COLUMNS.length; i++) {
      staff.setKey(
        { sign: 'flat', count: i + 1 },
        {
          from: FLAT_COLUMNS[i],
          sec: GLIDE_SEC,
          quiet: i < FLAT_COLUMNS.length - 1,
        },
      )
      drawSmall(i)
      const at = performance.now() + GLIDE_SEC * 1000
      if (!(await waitUntil(at, mine))) return false
    }
    return true
  }

  /** Before a play: Step 3's melodic minor turns Raise le on, and Step 4's plays start from empty signatures. */
  /**
   * Sets the toy up for play `id` and hands back the raises it sounds with:
   * melodic minor switches Raise le on as it starts (Toys 1, Step 3), but
   * while the switches wait for the cold open's choice it borrows both for
   * its own figures and leaves them as they were, since a held switch
   * moved by a play could not be moved back until the choice.
   */
  function prepare(id: PlayId): Raises {
    if ((id === 'relative' || id === 'c-minor') && staff.key !== null) {
      staff.setKey(null, { quiet: true })
      drawSmall()
    }
    if (id !== 'melodic' || raises.le) return raises
    if (holds()) return { te: true, le: true }
    raises = { te: true, le: true }
    syncColumn()
    syncControls()
    return raises
  }

  /** The line a figure says as it starts: what it sounds, and what it changes on the staircase. */
  function figureLine(id: PlayId, i: number, sounding: Raises): string | null {
    if (id === 'chord-home') return chordHomeSaid(minorDo(clef), sounding.te)
    if (id === 'scale' && !sounding.te)
      return i === 0 ? NATURAL_SCALE_SAID : null
    const form = sounding.le ? 'melodic' : 'harmonic'
    const lines = FIGURE_SAID[id === 'scale' ? form : id]
    return lines?.[i] ?? null
  }

  async function play(id: PlayId): Promise<boolean> {
    halt()
    NowPlaying.claim(halt)
    const mine = token
    const sounding = prepare(id)
    const figures = playOf(id, clef, sounding)
    const last = figures[figures.length - 1].look
    if (state.stays) landing = { look: last, flats: id === 'c-minor' }
    const t0 = performance.now()
    let heard = true
    for (const [i, f] of figures.entries()) {
      // the first figure starts with the press; each later one at its time
      if (i > 0 && !(await waitUntil(t0 + f.at * 1000, mine))) return false
      const line = figureLine(id, i, sounding)
      if (line !== null) say(line)
      heard = (await sound(f, mine)) && heard
      if (mine !== token) return false
    }
    if (id === 'c-minor' && !(await flatsIn(mine))) return false
    landing = null
    if (state.stays) kept = last
    show(rest())
    NowPlaying.release(halt)
    return heard
  }

  // ---------------------------------------------------------------- the switches and the clef

  function setRaises(next: Raises): void {
    halt()
    const before = raises
    raises = next
    show(rest())
    syncColumn()
    syncControls()
    const tonic = minorDo(clef)
    // each switch that moved, te first: Raise le brings te up with it, and
    // Raise te down takes le down
    const moved = (['te', 'le'] as const)
      .filter((r) => before[r] !== next[r])
      .map((r) => raiseSaid(r, next[r], tonic))
    const chord = state.column && !held ? ` ${chordSaid(tonic, raises.te)}` : ''
    say(`${moved.join(' ')}${chord}`)
  }

  /** The staff's clef changed, by its switch or by the learner's voice: the whole toy moves an octave. */
  function clefChanged(c: Clef): void {
    halt()
    const shift = c === clef ? 0 : c === 'treble' ? 12 : -12
    clef = c
    if (kept !== null) kept = { ...kept, tonic: kept.tonic + shift }
    core.setRange(rangeOf(c), rest().tonic)
    staff.setState(staffState(staff.key))
    show(rest(), true)
    syncColumn()
    drawSmall()
  }

  function setState(next: MinorState): void {
    halt()
    state = next
    raises = { te: next.te, le: next.le }
    kept = null
    staff.setState(staffState())
    show(rest(), true)
    syncColumn()
    syncControls()
    drawSmall()
    core.redraw()
  }

  teBtn.addEventListener('click', () => {
    const on = !raises.te
    // melodic minor never raises le without te
    setRaises({ te: on, le: on && raises.le })
  })
  leBtn.addEventListener('click', () => {
    const on = !raises.le
    setRaises({ te: on || raises.te, le: on })
  })
  for (const b of playBtns) {
    const id = b.dataset.minorPlay as PlayId
    b.addEventListener('click', () => light(b, play(id)))
  }
  // "See it on the pitch line": the staff's pitch line in the staircase's place
  PitchLine.subscribe((on) => {
    stairsViz.hidden = on
  })

  show(rest(), true)
  syncColumn()
  syncControls()
  drawSmall()

  return {
    core,
    staff,
    column,
    get raises() {
      return raises
    },
    get clef() {
      return clef
    },
    setState,
    setClef(c) {
      // the switch's own path: the staff changes its clef and hands it back
      if (c !== staff.clef) staff.setClef(c)
    },
    unlock() {
      if (!held) return
      held = false
      syncColumn()
      syncControls()
    },
    play,
    stop: halt,
  }
}
