// ============================================================
// Lesson 12 ring of rooms — the kit's spiral from above, with the chords' rooms and the chord strip
// ============================================================
//
// The steps' one object (WEB-SPEC, Toys 1). It is the kit's spiral, taken
// further without forking it: seen from above from its first frame, so one
// turn is a ring of twelve and C4 to B4 sit on it, held still, its slider
// kept on that turn, its five black keys lit at mount so each carries its
// sharp, and a tap on a bead the page's one sound in the soft tone. The
// rooms are drawn in its overlay by rooms-draw.ts, and the page's own
// marks after them (rooms-marks.ts): the syllables beside the beads under
// Do-re-mi, and Step 4's roots.
//
// It draws in the states the steps use, each opening in C major, silent:
// build (Step 1), no room until a chip is played, and each one played
// left faint once another lights, the centre naming the lit room;
// numerals (Step 2), the seven rooms faint, the chips and the centre
// giving numerals; slide (Step 3), no room; loop (Step 4) and tunes (Step
// 5), the loop's four rooms faint. A chip plays its chord, 1.4 s from the
// key's own octave (FACTS 69), and lights its room, which stays lit until
// another plays; the chip is lit while it sounds. The key switch is
// silent: a play still sounding stops first, then every room turns seven
// semitones round the ring in 0.6 s on the kit's expo-out curve, and the
// chips take the new key's notes; a press while a turn still runs does
// nothing, so a second press never makes the rooms jump. Play I, then vi
// lights I, slides its corner on G to A as vi comes in (D to E in G) and
// leaves vi lit; Play the loop lights each room and its chip while its
// chord sounds; Play the roots joins each root to the one before and
// names each move in the figure's readout. Slow doubles every length.
//
// Every play is the page's one sound (kit/now-playing.ts): it stops the
// sound before it, a newer one stops it, and one cut short leaves what it
// drew where it stood. With sound off a play's visuals still run, in
// silence (`Sound.canPlay`). Below 240 px of height (strip-layout.ts) the
// figure draws its compact layout: the centre's label in its top-left
// corner, Step 4's moves readout in its top-right, letters only on the
// beads, and the syllables on the chips alone.
// Every word is lines.ts's; the toy only places them. The figure asks the
// frame loop for frames only while something moves (rooms-draw.ts,
// `roomsAnimating`; rooms-marks.ts, `marksAnimating`).

import { q } from '@/features/lessons/kit/dom'
import { wake } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { MAJOR_SOLFEGE } from '@/features/lessons/kit/names-modes'
import { signName } from '@/features/lessons/kit/notes'
import type { SoundOwner } from '@/features/lessons/kit/now-playing'
import { easeOutExpo } from '@/features/lessons/kit/reveal'
import type { Run, RunNote } from '@/features/lessons/kit/run'
import { playNotes } from '@/features/lessons/kit/run'
import { Sound } from '@/features/lessons/kit/sound'
import type { Spiral } from '@/features/lessons/kit/spiral'
import { mountSpiral } from '@/features/lessons/kit/spiral'
import type { Naming } from './lines'
import { chipName, figureSummary, keyTurnedLine, rootMoves, slideLine, } from './lines'
import type { KeyName } from './music'
import { BAR_SEC, chordsOf, LOOP_DEGREES } from './music'
import type { KeyTurn, LabelMode, Play, RoomsState } from './rooms-draw'
import { drawRooms, roomsAnimating, TURN_SEC } from './rooms-draw'
import type { RingMarks, RootMark } from './rooms-marks'
import { drawMarks, marksAnimating, syllablesOf } from './rooms-marks'
import type { SoundNote } from './sounds'
import { chip, iThenVi, loop, roots, slow } from './sounds'
import { compactFor } from './strip-layout'

/** The ring's states, one for each step (WEB-SPEC, Toys 1). */
export type RoomsMode = 'build' | 'numerals' | 'slide' | 'loop' | 'tunes'

/** The turn lit from above starts on C4, so C4 to B4 sit on it (Toys 1, `ring: 60`). */
export const RING = 60
/** The notes the slider reaches: the lit turn, C4 to B4. */
export const RANGE: readonly [number, number] = [60, 71]
/** The lit turn's five black keys, C♯4 to A♯4, lit so each carries its name. */
export const RING_BLACK: readonly number[] = [61, 63, 66, 68, 70]

/** The rooms each state opens on, faint, by degree. */
export const OPENING_ROOMS: Readonly<Record<RoomsMode, readonly number[]>> = {
  build: [],
  numerals: [0, 1, 2, 3, 4, 5, 6],
  slide: [],
  loop: LOOP_DEGREES,
  tunes: LOOP_DEGREES,
}

/** What each state's centre label reads: the name in Step 1, the numeral first from Step 2. */
const LABEL: Readonly<Record<RoomsMode, LabelMode>> = {
  build: 'name',
  numerals: 'numeral',
  slide: 'numeral',
  loop: 'numeral',
  tunes: 'numeral',
}

/** Play I, then vi's vi: the degree its slide lands on. */
const VI = 5

/** What the toy shows that its controls set. */
export interface RoomsSettings {
  readonly mode: RoomsMode
  readonly key: KeyName
  /** The names on the chips and beside the beads: the page's names switch. */
  readonly names: LettersSolfegeMode
  /** Slow: every play at twice its lengths. */
  readonly slow: boolean
}

export interface RoomsOptions {
  /** When it draws: on screen and on its step (a deck's `toyActive`). */
  readonly active: () => boolean
  readonly mode?: RoomsMode
  /** The page's one-sound owner. */
  readonly owner?: SoundOwner
}

export interface Rooms {
  readonly spiral: Spiral
  readonly settings: RoomsSettings
  /** The rooms drawn, by degree, faint unless lit. */
  readonly drawn: readonly number[]
  /** The lit room's degree, or null; a slide decides it while it runs. */
  readonly lit: number | null
  /** The chip lit while its chord sounds, by degree, or null. */
  readonly sounding: number | null
  /** Whether the figure draws its compact layout: under 240 px tall. */
  readonly compact: boolean
  /** A state's opening: in C, its own rooms, none lit, at once and silent; what sounds stops. */
  setMode(mode: RoomsMode): void
  /**
   * The key switch: a play still sounding stops, then every room turns.
   * False, and nothing changes, for the key already showing or while a
   * turn still runs.
   */
  setKey(key: KeyName): boolean
  /** The names on the chips and beside the beads; what sounds stops first. */
  setNames(names: LettersSolfegeMode): void
  /** Slow, from the next play. */
  setSlow(on: boolean): void
  /** A chip's chord, lighting its room; false when cut short. */
  playChip(degree: number): Promise<boolean>
  /** Play I, then vi, and the corner's slide. */
  playSlide(): Promise<boolean>
  /** Play the loop, each room lit while its chord sounds. */
  playLoop(): Promise<boolean>
  /** Play the roots alone, each joined to the one before and its move named. */
  playRoots(): Promise<boolean>
  /**
   * Plays a sound the page builds of the kit's runs itself, as the toy's
   * own plays sound: the page's one sound, stopped by the next; false when
   * cut short.
   */
  playRun(
    start: (onNote: (n: RunNote, i: number) => void) => Run,
  ): Promise<boolean>
  /** Stops what the toy plays where it stands. */
  stop(): void
  /** What the painter draws now: its times are on the frame's clock, ms. */
  state(): RoomsState
  /** What the page draws over the rooms now. */
  marks(): RingMarks
  /** Whether the overlay has a frame to draw (frame-loop.ts). */
  wants(): boolean
}

/** A play's own handling of its notes and its end. */
interface Hooks {
  readonly onNote?: (n: RunNote, i: number) => void
  /** The play is over, heard to its end or cut short; it no longer sounds. */
  readonly ended?: (heard: boolean) => void
}

const now = (): number => performance.now()

/** The syllable on a degree, 0 do to 6 ti: the major scale's, do on the key's tonic. */
const syllable = (degree: number): string => MAJOR_SOLFEGE[degree]

export function mountRooms(root: HTMLElement, opts: RoomsOptions): Rooms {
  const viz = q('[data-rooms-viz]', root)
  const canvas = q<HTMLCanvasElement>('canvas', viz)
  const strip = root.querySelector<HTMLElement>('[data-chord-strip]')
  const chips = Array.from(
    strip?.querySelectorAll<HTMLButtonElement>('button[data-chip]') ?? [],
  )
  const summary = root.querySelector('[data-rooms-summary]')
  const said = root.querySelector('[data-rooms-said]')
  const moves = root.querySelector('[data-rooms-moves]')
  const readout = moves?.closest('.readout') ?? null
  const movesAtRest = moves?.textContent ?? ''

  let settings: RoomsSettings = {
    mode: opts.mode ?? 'build',
    key: 'C',
    names: 'letters',
    slow: false,
  }
  let drawn: number[] = [...OPENING_ROOMS[settings.mode]]
  let lit: number | null = null
  let turn: KeyTurn | null = null
  let slide: Play | null = null
  let sounding: number | null = null
  let rootMarks: RootMark[] = []
  let rootsPlaying = false
  let run: Run | null = null
  let ending: Hooks['ended'] | null = null
  // the figure's last height, px; 0 before it has one
  let figureH = 0
  // a change the overlay has still to draw
  let dirty = true

  /** Something the figure shows has changed with no input behind it: it draws in the next frame. */
  function changed(): void {
    dirty = true
    wake()
  }

  const naming = (): Naming => ({
    syllable,
    solfege: settings.names === 'solfege',
  })

  const compact = (): boolean => figureH > 0 && compactFor(figureH)

  /** A length as a play takes it: twice as long under Slow. */
  const scaled = (seconds: number): number => seconds * (settings.slow ? 2 : 1)

  function state(): RoomsState {
    return {
      key: settings.key,
      turn,
      rooms: drawn,
      lit,
      label: LABEL[settings.mode],
      compact: compact(),
      slide,
      walk: null,
      reduced: reducedMotion(),
    }
  }

  function marks(): RingMarks {
    const sung = settings.names === 'solfege' && !compact()
    return {
      syllables: sung ? syllablesOf(settings.key) : [],
      roots: rootMarks,
      rootsPlaying,
      reduced: reducedMotion(),
    }
  }

  // ------------------------------------------------------------ the words

  function say(line: string): void {
    if (said !== null) said.textContent = line
  }

  /** The chips' two lines and names, in the key and names that show. */
  function syncChips(): void {
    const chords = chordsOf(settings.key)
    const step = settings.mode === 'build' ? 'build' : 'numerals'
    const sung = settings.names === 'solfege'
    chips.forEach((b, i) => {
      const chord = chords[i]
      const top = b.querySelector('[data-chip-top]')
      const notes = b.querySelector('[data-chip-notes]')
      if (top !== null)
        top.textContent =
          step === 'build' ? `on ${syllable(chord.degree)}` : chord.numeral
      if (notes !== null)
        notes.textContent = sung
          ? [0, 2, 4].map((up) => syllable((chord.degree + up) % 7)).join(' ')
          : chord.spelled.map((s) => signName(s, { octave: false })).join(' ')
      b.setAttribute('aria-label', chipName(chord, step, naming()))
      b.classList.toggle('is-on', sounding === i)
    })
  }

  /** The figure's summary, for the slider's description: the key and the rooms drawn. */
  function syncSummary(): void {
    if (summary !== null)
      summary.textContent = figureSummary(settings.key, drawn)
  }

  function clearRoots(): void {
    if (rootMarks.length > 0) changed()
    rootMarks = []
    rootsPlaying = false
    if (moves !== null) moves.textContent = movesAtRest
  }

  // ------------------------------------------------------------ sound

  /** Stops the toy's play where it stands, and lets the page's sound go. */
  function stop(): void {
    const r = run
    if (r === null) return
    const end = ending
    run = null
    ending = null
    r.stop()
    end?.(false)
    opts.owner?.release(stop)
    changed()
  }

  /** Starts a play: the page's one sound, its notes heard by `hooks` as they start. */
  function start(
    begin: (onNote: (n: RunNote, i: number) => void) => Run,
    hooks: Hooks = {},
  ): Promise<boolean> {
    stop()
    clearRoots()
    opts.owner?.claim(stop)
    const r = begin((n, i) => {
      if (run === r) hooks.onNote?.(n, i)
    })
    run = r
    ending = hooks.ended ?? null
    changed()
    return r.done.then((heard) => {
      if (run === r) {
        run = null
        ending = null
        hooks.ended?.(heard)
        opts.owner?.release(stop)
        changed()
      }
      return heard
    })
  }

  /** A fixed sound in the soft tone, at twice its lengths under Slow. */
  function sound(notes: readonly SoundNote[], hooks: Hooks): Promise<boolean> {
    const audible = Sound.canPlay()
    const played = settings.slow ? slow(notes) : [...notes]
    return start(
      (onNote) => playNotes(played, { audible, kind: 'soft', onNote }),
      hooks,
    )
  }

  function light(chipAt: number | null): void {
    sounding = chipAt
    chips.forEach((b, i) => b.classList.toggle('is-on', sounding === i))
  }

  function playChip(degree: number): Promise<boolean> {
    const done = sound(chip(degree, settings.key), {
      ended: () => {
        if (sounding === degree) light(null)
      },
    })
    if (settings.mode === 'build' && !drawn.includes(degree)) {
      drawn = [...drawn, degree]
      syncSummary()
    }
    lit = degree
    light(degree)
    changed()
    return done
  }

  function playSlide(): Promise<boolean> {
    // vi has sounded once its chord starts, so the slide has landed
    let landed = false
    const done = sound(iThenVi(settings.key), {
      onNote: (n) => {
        if (n.t === 0 || landed) return
        landed = true
        say(slideLine(settings.key, naming()))
      },
      ended: () => {
        slide = null
        lit = landed ? VI : 0
      },
    })
    slide = { at: now(), by: settings.slow ? 2 : 1 }
    lit = 0
    changed()
    return done
  }

  function playLoop(): Promise<boolean> {
    const bar = scaled(BAR_SEC)
    return sound(loop(settings.key), {
      onNote: (n) => {
        const degree = LOOP_DEGREES[Math.floor(n.t / bar + 1e-6)] ?? null
        if (degree === lit && sounding === degree) return
        lit = degree
        light(degree)
        changed()
      },
      ended: () => {
        lit = null
        light(null)
      },
    })
  }

  function playRoots(): Promise<boolean> {
    const words = rootMoves(syllable)
    const done = sound(roots(settings.key), {
      onNote: (n, i) => {
        const t = now()
        rootMarks = [
          ...rootMarks,
          { midi: n.midi, from: t, to: t + n.dur * 1000 },
        ]
        if (moves !== null) moves.textContent = words[i] ?? ''
        changed()
      },
      ended: () => {
        // a root cut short stops sounding now
        const t = now()
        rootMarks = rootMarks.map((r) => (r.to > t ? { ...r, to: t } : r))
        rootsPlaying = false
      },
    })
    rootsPlaying = true
    return done
  }

  // a chip plays its chord in the key that shows
  strip?.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-chip]')
    if (b === null) return
    void playChip(Number(b.dataset.chip))
  })

  // ------------------------------------------------------------ the figure

  const spiral = mountSpiral(viz, {
    active: opts.active,
    ring: RING,
    view: 'top',
    range: () => RANGE,
    owner: opts.owner,
    overlay: (f) => {
      dirty = false
      figureH = f.H
      drawRooms(f.ctx, f, state(), easeOutExpo)
      drawMarks(f.ctx, f, marks())
    },
    overlayWants: () => {
      const t = now()
      return dirty || roomsAnimating(state(), t) || marksAnimating(marks(), t)
    },
  })
  spiral.setTurning(false)
  // the compact layout's letters only, which the full layout shares: its
  // syllables are the page's marks, drawn beside the beads
  spiral.setLabels('letter')
  RING_BLACK.forEach((m) => spiral.light(m))

  /**
   * The figure's height now, if it has one. In the compact layout the
   * centre's label takes the figure's top-left corner, so Step 4's moves
   * readout goes to its top-right, clear of it.
   */
  function measure(): void {
    const h = canvas.getBoundingClientRect().height
    if (h > 0) figureH = h
    readout?.classList.toggle('right', compact())
  }
  new ResizeObserver(() => {
    measure()
    changed()
  }).observe(canvas)
  measure()
  syncChips()
  syncSummary()

  const toy: Rooms = {
    spiral,
    get settings() {
      return settings
    },
    get drawn() {
      return drawn
    },
    get lit() {
      return lit
    },
    get sounding() {
      return sounding
    },
    get compact() {
      return compact()
    },
    setMode(mode) {
      stop()
      clearRoots()
      settings = { ...settings, mode, key: 'C' }
      drawn = [...OPENING_ROOMS[mode]]
      lit = null
      turn = null
      slide = null
      light(null)
      say('')
      syncChips()
      syncSummary()
      changed()
    },
    setKey(key) {
      const t = now()
      const turning =
        turn !== null && !reducedMotion() && t - turn.at < TURN_SEC * 1000
      if (key === settings.key || turning) return false
      stop()
      clearRoots()
      turn = { from: settings.key, at: t }
      settings = { ...settings, key }
      syncChips()
      syncSummary()
      say(keyTurnedLine(key))
      changed()
      return true
    },
    setNames(names) {
      if (names === settings.names) return
      stop()
      settings = { ...settings, names }
      syncChips()
      changed()
    },
    setSlow(on) {
      settings = { ...settings, slow: on }
    },
    playChip,
    playSlide,
    playLoop,
    playRoots,
    playRun: (begin) => start(begin),
    stop,
    state,
    marks,
    wants: () => {
      const t = now()
      return dirty || roomsAnimating(state(), t) || marksAnimating(marks(), t)
    },
  }
  return toy
}
