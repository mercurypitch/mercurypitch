// ============================================================
// Lesson 10 cold open — C major on the ring, and the note that makes it minor
// ============================================================
//
// The hero is the cold open, in Lesson 2's order (CURIOSITY-MOMENTS § 3.1):
// Merc and Tavi either side of the hero's own spiral, the three plays under
// it, then the predict (WEB-SPEC, Toys 2 and 3). The spiral is the kit's,
// seen from above from its first frame, so one turn is a ring of twelve
// and do, mi and so, C4, E4 and G4, sit on it, held still; the ring's five
// black keys are lit, so each is named by its flat (the page sets the
// names to flats before this mounts) and each move lands on a named note.
// The page's marks are drawn over it (hero-marks.ts): a halo round each of
// the three, alike, and the triangle joining them.
//
// Play the chord works from the start: C, E and G together, which answers
// nothing. Once a choice locks, Move mi down and Move so down each hold
// the chord while the moving note glides a semitone down, its halo and bead
// sliding along the ring as it sounds, and home once the sound ends. The
// reveal waits until both moves have been heard to their end with sound
// on, since it compares them; a move cut short, by a bead tap, another
// sound, a stop or a hidden page, does not count. Until the reveal nothing
// is gold and the ring names no chord; from it mi's halo is gold, glowing
// once, a move names what it made as it lands, and Tavi celebrates once.
//
// Each play is the page's one sound (kit/now-playing.ts), in the soft tone,
// and the three halos light alike while it sounds. Both Mercs listen while
// it plays; neither sings. The drawing is a slider for the notes, as the
// kit's spiral is, and a polite live region speaks for the plays.

import { q, qa } from '@/features/lessons/kit/dom'
import { wake, watch } from '@/features/lessons/kit/frame-loop'
import { mercCelebrate, mercListen, mercsReady, } from '@/features/lessons/kit/merc-duo'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { Run } from '@/features/lessons/kit/run'
import { allOf, playLine, playNotes } from '@/features/lessons/kit/run'
import type { Spiral } from '@/features/lessons/kit/spiral'
import { mountSpiral } from '@/features/lessons/kit/spiral'
import { stillSky } from '@/features/lessons/kit/still-sky'
import { AFTERGLOW_SEC, GLOW_RISE_SEC, GLOW_SEC, } from '@/features/lessons/kit/tune-line-motion'
import type { MarksState } from './hero-marks'
import { drawMarks, SLIDE_END_SEC } from './hero-marks'
import { COLD_PREDICT, heroChordLine, heroMoveLine } from './lines'
import type { MoveId } from './sounds'
import { CHORD_C, lengthOf, MOVE, MOVE_IDS, moveLength, moveSound, } from './sounds'

/** The turn lit from above starts on C4, so do, mi and so sit on it (WEB-SPEC, Toys 2). */
const RING = 60
/** The ring's five black keys, D♭4 to B♭4, lit so each carries its name. */
const RING_BLACK: readonly number[] = [61, 63, 66, 68, 70]
/** The predict's plays that answer it, one for each move. */
export const REVEAL_ON: readonly string[] = MOVE_IDS.map((id) => `move-${id}`)
/** How long mi's gold glows once the reveal shows, ms: the kit's glow, as hero-marks.ts draws it. */
const GLOW_MS = (GLOW_RISE_SEC + GLOW_SEC) * 1000
/** When a move lands, seconds from its start: the glide's end, as the moving note reaches the note below (FACTS 73). */
export const LANDS_SEC = MOVE.hold + MOVE.glide

/** The move a play's `data-play` names, or null for Play the chord. */
const moveOf = (what: string): MoveId | null =>
  MOVE_IDS.find((id) => what === `move-${id}`) ?? null

const isChoice = (choice: string): choice is MoveId =>
  (MOVE_IDS as readonly string[]).includes(choice)

/** A play's sound: the chord, or a move's two held notes and its moving line, as one run, in the soft tone. */
function soundOf(move: MoveId | null, audible: boolean): Run {
  if (move === null) return playNotes(CHORD_C, { audible, kind: 'soft' })
  const m = moveSound(move)
  return allOf([
    playNotes(m.held, { audible, kind: 'soft' }),
    playLine(m.line, { audible, kind: 'soft', gain: m.gain }),
  ])
}

const lengthMs = (move: MoveId | null): number =>
  (move === null ? lengthOf(CHORD_C) : moveLength(moveSound(move))) * 1000

export interface ColdOpen {
  readonly spiral: Spiral
  readonly predict: Predict
  /** What the marks over the spiral show now. */
  marks(): MarksState
}

export function initColdOpen(): ColdOpen {
  const stage = q('#heroStage')
  stillSky(stage)
  // the stills wait while a live Merc may still mount, then step in
  void mercsReady.then(() => q('#duo').classList.remove('pending'))
  const fig = q('#heroSpiral')
  const said = q('[data-hero-said]', fig)

  // what the marks show, on the frame loop's clock, ms
  let revealedAt: number | null = null
  let move: MarksState['move'] = null
  let sounding: { readonly from: number; readonly to: number } | null = null
  // a change the marks have still to draw
  let changed = true
  const marks = (): MarksState => ({
    revealedAt,
    move,
    reduced: reducedMotion(),
    sounding,
  })

  /** Whether the marks change in a frame at `now`: a slide, the gold's glow or a halo's light. */
  function marksMove(now: number): boolean {
    const sliding = move !== null && now < move.at + SLIDE_END_SEC * 1000
    const glowing = revealedAt !== null && now < revealedAt + GLOW_MS
    const lit = sounding !== null && now < sounding.to + AFTERGLOW_SEC * 1000
    return sliding || glowing || lit
  }

  /** The marks have changed with no input behind it: they draw in the next frame. */
  function redraw(): void {
    changed = true
    wake()
  }

  const spiral = mountSpiral(fig, {
    active: watch(stage),
    ring: RING,
    view: 'top',
    // a tapped black key is named from then on, as on Lesson 2's hero spiral
    lightOnPlay: true,
    owner: NowPlaying,
    overlay: (f) => {
      changed = false
      drawMarks(f.ctx, f, marks())
    },
    overlayWants: () => changed || marksMove(performance.now()),
  })
  spiral.setTurning(false)
  RING_BLACK.forEach((m) => spiral.light(m))

  let run: Run | null = null
  let lands = 0

  function say(line: string): void {
    if (said.textContent !== line) said.textContent = line
  }

  /** The play is over, heard or not: the Mercs turn back, and the owner is let go. */
  function finish(): void {
    run = null
    window.clearTimeout(lands)
    mercListen('blue', false)
    mercListen('orange', false)
    NowPlaying.release(stop)
  }

  /** A play cut short: its lights fade from now and the moving bead is home at once. */
  function cut(): void {
    const now = performance.now()
    if (sounding !== null && sounding.to > now)
      sounding = { from: sounding.from, to: now }
    move = null
    redraw()
  }

  /** Stops the hero's play where it stands: its sound, its slide, its lights, its Mercs. */
  function stop(): void {
    if (run === null) return
    run.stop()
    cut()
    finish()
  }

  /** Plays the chord or a move; resolves false if another sound, a stop or a hidden page cut it short. */
  async function play(what: string, audible: boolean): Promise<boolean> {
    stop()
    NowPlaying.claim(stop)
    const m = moveOf(what)
    const r = soundOf(m, audible)
    run = r
    const now = performance.now()
    sounding = { from: now, to: now + lengthMs(m) }
    move = m === null ? null : { id: m, at: now }
    redraw()
    if (m === null) say(heroChordLine())
    else lands = window.setTimeout(() => say(heroMoveLine(m)), LANDS_SEC * 1000)
    mercListen('blue', true)
    mercListen('orange', true)
    const heard = await r.done
    // stopped here, or a newer play has taken over
    if (run !== r) return false
    if (!heard) cut()
    finish()
    return heard
  }

  const predict = mountPredict(q('#predict'), {
    play,
    // the three plays sit under the spiral, outside the predict card
    plays: qa<HTMLButtonElement>('.hero-plays [data-play]'),
    revealOn: REVEAL_ON,
    revealAfter: 'all',
    hints: COLD_PREDICT.hints,
    guess: (choice) =>
      isChoice(choice) ? COLD_PREDICT.guess[choice] : 'You said',
    onReveal: () => {
      revealedAt = performance.now()
      redraw()
      mercCelebrate('orange', 1600)
    },
  })

  return { spiral, predict, marks }
}
