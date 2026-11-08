// ============================================================
// Lesson 21 Step 1 — the staircase on G beside the staff
// ============================================================
//
// Lesson 4's staircase, the kit's (stairs-core.ts), on G in the learner's
// clef's octave, G2 for the lower voice and G4 for the higher, with no
// slider: the step is about G (WEB-SPEC, Toys 1). Play plays the scale at
// 0.4 s a note, each stair and key lighting as it sounds, and the staff
// beside it writes each note as it sounds. With White keys only off it
// plays G major, F sharp written with its own sharp, ringed; as the scale
// ends that sharp travels to the start of the staff, into G major's key
// signature, and the note keeps no sign. With it on, the staircase draws
// the white keys' steps over the major ones and the staff drops the
// signature and writes them plain: under one, that F would need a natural,
// which this page does not teach. Switched off again, the next G major
// play brings the sharp into the signature again, so the sound still comes
// before the symbol.
//
// Every sound is the staff's, the page's one (`NowPlaying`): the staircase
// lights its stairs on the same clock, silently. A stair's button plays its
// note and names it ("Stair 7, ti, F sharp 3"). The clef follows the
// learner's voice and the Clef switch: the staircase moves to the other G
// and the staff opens afresh in that clef, its signature kept.

import { q } from '@/features/lessons/kit/dom'
import { majorScale } from '@/features/lessons/kit/major-scale'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { PlayNote, StaffState, StaffToy, } from '@/features/lessons/kit/staff'
import { mountStaff, scoreAcross } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { StairsCore } from '@/features/lessons/kit/stairs-core'
import { mountStairs } from '@/features/lessons/kit/stairs-core'
import type { StairsLayout } from '@/features/lessons/kit/stairs-geometry'
import { findParts, place } from '@/features/lessons/kit/stairs-parts'
import type { NoteEvent } from '@/features/lessons/kit/stairs-plays'
import { readout, stairLabel, summary, whiteKeysSaid, } from '@/features/lessons/kit/stairs-words'
import { PACE, runOf, STEP1_DO, whiteKeysOf } from './sounds'

/** G major's one sharp. */
const ONE_SHARP = { sign: 'sharp', count: 1 } as const

/** F sharp's column in G major's run: its seventh note, ti. */
const TI = 6

/** A tapped stair's note, s. */
const TAP_SEC = 0.6

/** The staff's state in Step 1, in `clef`: room for G major's one sharp, eight notes across. */
export const stairsStaff = (clef: Clef): StaffState => ({
  staff: 'single',
  clef,
  tap: 'place',
  keyRoom: 1,
  across: scoreAcross(8),
})

export interface StairsStep {
  readonly core: StairsCore
  readonly staff: StaffToy
  /** Plays the scale the switch says. */
  play(): Promise<boolean>
  /** White keys only, on or off. */
  setWhite(on: boolean): void
  /** The learner's clef: the staircase on its G, the staff afresh. */
  setClef(clef: Clef): void
  stop(): void
}

/** A run's notes as the staircase lights them. */
const eventsOf = (notes: readonly PlayNote[]): NoteEvent[] =>
  notes.map((n) => ({ midi: midiOf(n.note), at: n.t, dur: n.dur }))

export function mountStairsStep(
  root: HTMLElement,
  o: {
    /** When it draws: its stage on screen, on Step 1 (the deck's `toyActive`). */
    readonly active: () => boolean
    readonly clef: Clef
    readonly light?: PlayLight
  },
): StairsStep {
  const p = findParts(root)
  const light = o.light ?? playLights()
  const playBtn = q<HTMLButtonElement>('[data-stairs-play]', root)
  const playLabel = q('[data-stairs-play-label]', root)
  const whiteBtn = q<HTMLButtonElement>('[data-white-keys]', root)
  let clef: Clef = o.clef
  let white = false
  // the latest play or tap: an older one cut short leaves the staircase to it
  let plays = 0

  const tonic = (): number => midiOf(STEP1_DO[clef])
  const core = mountStairs({
    canvas: q<HTMLCanvasElement>('canvas', p.viz),
    compact: false,
    active: o.active,
    range: { lo: tonic(), hi: tonic() },
    names: () => 'solfege',
    onLayout: (L: StairsLayout) =>
      L.stairs.forEach((st, i) => place(p.stairBtns[i], st.zone)),
  })
  core.set({ steps: true })

  const staff = mountStaff(root, {
    state: stairsStaff(clef),
    owner: NowPlaying,
    onClef: (c) => setClef(c),
  })

  function relabel(): void {
    const t = core.tonic
    p.stairBtns.forEach((b, i) =>
      b.setAttribute('aria-label', stairLabel(i, t)),
    )
    p.readoutEl.innerHTML = readout(t)
    p.description.textContent = summary(t)
  }

  /** The scale the switch says, as the staff writes it. */
  function notes(): PlayNote[] {
    if (white) return runOf(whiteKeysOf(STEP1_DO[clef]), PACE.step)
    const covered = staff.key !== null
    return runOf(majorScale(tonic()), PACE.step, (_n, i) =>
      i === TI && !covered ? { outline: true } : {},
    )
  }

  /** Sounds `run` on the staff, the staircase lighting it on the same clock; resolves as the staff's play does. */
  function sound(
    run: readonly PlayNote[],
    show: 'run' | 'cursor',
  ): Promise<boolean> {
    const mine = ++plays
    void core.play(eventsOf(run), false, { overlay: white })
    return staff.play({ show, notes: run }).then((heard) => {
      if (!heard && mine === plays) core.stop()
      return heard
    })
  }

  function play(): Promise<boolean> {
    const run = notes()
    const bringSharp = !white && staff.key === null
    return sound(run, 'run').then((heard) => {
      if (!heard) return false
      // the sharp the scale needed travels into G major's signature
      if (bringSharp) staff.setKey(ONE_SHARP, { from: TI })
      return true
    })
  }

  function setWhite(on: boolean): void {
    if (on === white) return
    white = on
    staff.stop()
    core.stop()
    core.set({ white: on })
    whiteBtn.setAttribute('aria-pressed', String(on))
    playLabel.textContent = on ? 'Play the white keys from G' : 'Play G major'
    if (on) {
      // no signature over the white keys: that F would need a natural
      staff.setState(stairsStaff(clef))
      p.said.textContent = whiteKeysSaid(core.tonic) ?? ''
    }
  }

  function setClef(c: Clef): void {
    clef = c
    const kept = staff.key
    core.setRange({ lo: tonic(), hi: tonic() })
    relabel()
    staff.setState({ ...stairsStaff(c), key: kept })
    staff.say(c === 'treble' ? 'Treble clef.' : 'Bass clef.')
  }

  playBtn.addEventListener('click', () => light(playBtn, play()))
  whiteBtn.addEventListener('click', () => setWhite(!white))
  p.stairBtns.forEach((b, i) =>
    b.addEventListener('click', () => {
      const n = (white ? whiteKeysOf(STEP1_DO[clef]) : majorScale(tonic()))[i]
      void sound([{ t: 0, dur: TAP_SEC, note: n }], 'cursor')
    }),
  )
  relabel()

  return {
    core,
    staff,
    play,
    setWhite,
    setClef(c) {
      // the switch's own path: the toy changes its clef and hands it over
      if (c !== staff.clef) staff.setClef(c)
    },
    stop() {
      staff.stop()
      core.stop()
    },
  }
}
