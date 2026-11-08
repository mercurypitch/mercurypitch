// ============================================================
// Lesson 21 circle and staff — the house round the circle, each key's scale on the staff
// ============================================================
//
// The circle of fifths beside the learner's staff (WEB-SPEC, Toys 2 and 3):
// Steps 2 and 3 on the stage, and free play in the Wrap. The house moves
// within the part the circle has (kit/circle.ts), and each move plays the
// new key's scale on the staff, written as it sounds, under the signature
// the two keys share; a note whose sign the key adds is ringed, and as the
// scale ends the staff takes the key's own signature, the new sign fading
// in, so the sound comes before the symbol (SEASON-2 § 1.4 item 1).
//
// Step 3 adds Spell it: A♯ · B♭, on F major's fourth note. Either side
// takes the house to F, if it is not there already, and plays F major
// spelled that way: with A♯, two notes on A's space, both ringed, none on
// B's line, and no signature; with B♭, one note on every letter, under F
// major's one flat. A house that leaves F sets Spell it back to B♭. Play
// the white keys from F drops the signature and writes them plain, as Step
// 1's white keys do, and F major spelled both ways plays the two spellings
// one after the other, 0.5 s apart. Every sound is the staff's, the page's
// one (`NowPlaying`).

import type { CircleToy } from '@/features/lessons/kit/circle'
import { mountCircle } from '@/features/lessons/kit/circle'
import type { CircleKey, CirclePart, Threading, } from '@/features/lessons/kit/circle-geometry'
import { qa, wait } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { PlayLight } from '@/features/lessons/kit/play-lights'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { StaffState, StaffToy } from '@/features/lessons/kit/staff'
import { mountStaff, scoreAcross } from '@/features/lessons/kit/staff'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import type { Clef } from '@/features/lessons/kit/staff-places'
import type { Pace } from './sounds'
import { BOTH_WAYS_GAP, doOf, keyRun, runOf, scaleOf, SPELL_SAID, whiteKeysOf, withASharp, } from './sounds'

/** F major's seat on the circle. */
const F_SEAT = 11
/** F major's one flat. */
const ONE_FLAT: KeySig = { sign: 'flat', count: 1 }

/** The staff beside the circle, in `clef`: room for three signs, eight notes across. */
export const circleStaff = (clef: Clef, key: KeySig | null): StaffState => ({
  staff: 'single',
  clef,
  tap: 'place',
  key,
  keyRoom: 3,
  across: scoreAcross(8),
})

export type Spelling = 'sharp' | 'flat'

export interface CircleStep {
  readonly circle: CircleToy
  readonly staff: StaffToy
  /** A new part and pace (Step 2's sharp side at 0.3 s, Step 3's flat side at 0.4 s). */
  setPart(part: CirclePart, pace: Pace): void
  /** The learner's clef: the staff afresh in it, with the house's key. */
  setClef(clef: Clef): void
  /** Spell it: the house to F, and F major spelled that way. */
  spell(s: Spelling): Promise<boolean>
  /** F major spelled with A sharp, then with B flat. */
  bothWays(): Promise<boolean>
  /** The white keys from F, with no signature. */
  whiteKeys(): Promise<boolean>
  stop(): void
}

export function mountCircleStep(
  root: HTMLElement,
  o: {
    /** When the circle draws: its figure on screen, on its steps (the deck's `toyActive`, or free play's `watch`). */
    readonly active: () => boolean
    readonly part: CirclePart
    readonly pace: Pace
    readonly clef: Clef
    /** How the beads sit as it opens: Steps 2 and 3's ring re-threads by fifths as it first shows. */
    readonly threading?: Threading
    readonly light?: PlayLight
  },
): CircleStep {
  const light = o.light ?? playLights()
  let clef = o.clef
  let pace = o.pace
  let spelling: Spelling = 'flat'
  // the latest sequence of plays: an older one stops at its next step
  let token = 0

  const staff = mountStaff(root, {
    state: circleStaff(clef, null),
    owner: NowPlaying,
    onClef: (c) => setClef(c),
  })
  const circle = mountCircle(root, {
    active: o.active,
    part: o.part,
    threading: o.threading,
    owner: NowPlaying,
    onMove: (key) => {
      if (key.seat !== F_SEAT) showSpelling('flat')
      void moved(key)
    },
  })

  function showSpelling(s: Spelling): void {
    spelling = s
    for (const b of qa<HTMLButtonElement>('[data-spelling]', root))
      b.setAttribute('aria-pressed', String(b.dataset.spelling === s))
  }

  /**
   * The house reached `key`: its scale under the signature the staff and the
   * key share, then the key's own.
   */
  function moved(key: CircleKey): Promise<boolean> {
    const mine = ++token
    if (key.seat === F_SEAT && spelling === 'sharp') return playSharp()
    const run = keyRun(scaleOf(doOf(key.seat, clef)), staff.key, key.key, pace)
    staff.setKey(run.under, { quiet: true })
    return staff.play({ show: 'run', notes: run.notes }).then((heard) => {
      if (heard && mine === token) staff.setKey(run.after)
      return heard
    })
  }

  /** F major with A sharp: no signature, two notes on A, both ringed. */
  function playSharp(): Promise<boolean> {
    staff.setKey(null, { quiet: true })
    const notes = runOf(withASharp(scaleOf(doOf(F_SEAT, clef))), pace, (n) =>
      n.letter === 'A' ? { outline: true } : {},
    )
    return staff.play({ show: 'run', notes, say: SPELL_SAID.sharp })
  }

  /** F major with B flat, under its one flat. */
  function playFlat(): Promise<boolean> {
    staff.setKey(ONE_FLAT, { quiet: true })
    const notes = runOf(scaleOf(doOf(F_SEAT, clef)), pace)
    return staff.play({ show: 'run', notes, say: SPELL_SAID.flat })
  }

  /** The house to F without its own scale, for a play that brings its own. */
  function toF(): void {
    if (circle.key.seat !== F_SEAT) circle.moveTo(F_SEAT, false)
  }

  function spell(s: Spelling): Promise<boolean> {
    ++token
    showSpelling(s)
    toF()
    return s === 'sharp' ? playSharp() : playFlat()
  }

  async function bothWays(): Promise<boolean> {
    const mine = ++token
    toF()
    showSpelling('sharp')
    if (!(await playSharp()) || mine !== token) return false
    await wait(BOTH_WAYS_GAP)
    if (mine !== token) return false
    showSpelling('flat')
    return playFlat()
  }

  function whiteKeys(): Promise<boolean> {
    ++token
    toF()
    staff.setKey(null)
    return staff.play({
      show: 'run',
      notes: runOf(whiteKeysOf(doOf(F_SEAT, clef)), pace),
    })
  }

  function setClef(c: Clef): void {
    clef = c
    ++token
    staff.setState(
      circleStaff(c, circle.key.key.count === 0 ? null : circle.key.key),
    )
    staff.say(c === 'treble' ? 'Treble clef.' : 'Bass clef.')
  }

  for (const b of qa<HTMLButtonElement>('[data-spelling]', root))
    b.addEventListener('click', () =>
      light(b, spell(b.dataset.spelling === 'sharp' ? 'sharp' : 'flat')),
    )
  for (const b of qa<HTMLButtonElement>('[data-staff-play="white-f"]', root))
    b.addEventListener('click', () => light(b, whiteKeys()))

  return {
    circle,
    staff,
    setPart(part, p) {
      pace = p
      ++token
      circle.setPart(part)
      showSpelling('flat')
      const key = circle.key.key
      staff.setState(circleStaff(clef, key.count === 0 ? null : key))
    },
    setClef(c) {
      // the switch's own path: the toy changes its clef and hands it over
      if (c !== staff.clef) staff.setClef(c)
    },
    spell,
    bothWays,
    whiteKeys,
    stop() {
      ++token
      staff.stop()
      circle.stop()
    },
  }
}
