// ============================================================
// Echo's scene: the sky at one moment of a run, built from the run itself
// ============================================================
//
// Pure. The controller hands in the run as it stands (the phrase being
// sung and how far it got, the phrases done) and gets back the scene
// EchoSky draws (sky-scene.ts). The picture always agrees with the
// numbers: a star for every landed note and for nothing else, a
// constellation line only between two neighbours that both landed (a miss
// breaks the chain there), and at the result a small dark ring for every
// miss (DESIGN-echo.md 1 and 6).
//
// Where each phrase goes (sky-layout.ts):
//
//   the phrase being sung   its notes across the sky by order and pitch
//                           (phrasePlaces): rings until they land, the
//                           ring listened for drawn larger
//   the phrases done        shrunk into the top band (FINISHED_SLOTS): the
//                           lit stars and their lines, nothing for a miss
//   the result              all five at screen 4's places (RESULT_BOXES)
//
// A note keeps its tint from the phrase to the top band to the result: the
// tint is keyed by the run and the note, not by where it is drawn.

import type { NoteOutcome, Phrase } from '@/lib/sequence/sequence-engine'
import type { PlatePoint, StarSize } from './echo-geometry'
import { STAR_WIDTH_W, STROKES } from './echo-geometry'
import type { SlotBox } from './sky-layout'
import { FINISHED_SLOTS, fitToSlot, phrasePlaces, phraseStarW, RESULT_BOXES, } from './sky-layout'
import type { LineStyle, RingStyle, SceneLine, SceneRing, SceneStar, SkyScene, } from './sky-scene'
import { liveTint } from './sky-scene'

/** Each ring's radius at k = 1, W: the storyboard's, per look. */
export const RING_W: Readonly<Record<RingStyle, number>> = {
  waiting: STROKES.ringWaiting.radiusW,
  active: STROKES.ringActive.radiusW,
  missed: STROKES.ringMissed.radiusW,
}

export type LiveStage = 'call' | 'response' | 'done'

/** The phrase being sung, and how far it got. */
export interface LivePhrase {
  /** Its place in the run, from 0. */
  readonly index: number
  readonly phrase: Phrase
  /**
   * `call`: Merc sings it and its rings appear; `response`: the singer
   * sings it back; `done`: it is over, and a missed note's ring dims.
   */
  readonly stage: LiveStage
  /** The engine's outcomes so far, in note order. */
  readonly outcomes: readonly NoteOutcome[]
  /** The note listened for (its ring drawn larger), in the response. */
  readonly listening: number | null
  /** In the call: each ring's fade-in, ms after the scene is shown. */
  readonly appearMs?: readonly number[]
}

/** A phrase sung back: the phrase, and what became of each note. */
export interface DonePhrase {
  readonly phrase: Phrase
  readonly outcomes: readonly NoteOutcome[]
}

export interface EchoSceneInput {
  /** Names this run's tints: a new run lights new colours. */
  readonly run: number
  readonly live: LivePhrase | null
  /** The phrases done, in order: the top band, or the result. */
  readonly done: readonly DonePhrase[]
  /** The run's result: every phrase done at its result place. */
  readonly result: boolean
  /** The result's celebration star over the town. */
  readonly celebration: boolean
}

interface Pieces {
  rings: SceneRing[]
  stars: SceneStar[]
  lines: SceneLine[]
}

const landedAt = (outcomes: readonly NoteOutcome[], i: number): boolean =>
  outcomes[i]?.landed === true

/** A note's star: its sprite size and width, and its tint for the run. */
function star(
  key: string,
  tintKey: string,
  at: PlatePoint,
  size: StarSize,
  widthW: number,
  pop: boolean,
): SceneStar {
  return { key, u: at.u, v: at.v, widthW, size, ...liveTint(tintKey), pop }
}

/** A line between each two neighbours that both landed. */
function chain(
  places: readonly PlatePoint[],
  outcomes: readonly NoteOutcome[],
  style: LineStyle,
  prefix: string,
): SceneLine[] {
  const lines: SceneLine[] = []
  for (let i = 0; i + 1 < places.length; i++) {
    if (!landedAt(outcomes, i) || !landedAt(outcomes, i + 1)) continue
    const a = places[i]
    const b = places[i + 1]
    lines.push({ key: `${prefix}-l${i}`, a: [a.u, a.v], b: [b.u, b.v], style })
  }
  return lines
}

/** The ring a note not lit shows in the phrase being sung. */
function liveRingStyle(live: LivePhrase, i: number): RingStyle {
  if (live.outcomes[i] !== undefined && live.stage === 'done') return 'missed'
  return live.stage === 'response' && i === live.listening
    ? 'active'
    : 'waiting'
}

function livePieces(live: LivePhrase, run: number): Pieces {
  const notes = live.phrase.notes
  const places = phrasePlaces(notes.map((note) => note.midi))
  const starW = phraseStarW(notes.length, STAR_WIDTH_W.phrase)
  const prefix = `p${live.index}`
  const pieces: Pieces = { rings: [], stars: [], lines: [] }
  places.forEach((at, i) => {
    const tintKey = `${run}-${live.index}-${i}`
    if (landedAt(live.outcomes, i)) {
      pieces.stars.push(
        star(`${prefix}-${i}`, tintKey, at, 'phrase', starW, true),
      )
      return
    }
    const style = liveRingStyle(live, i)
    const appearMs = live.stage === 'call' ? live.appearMs?.[i] : undefined
    pieces.rings.push({
      key: `${prefix}-r${i}`,
      u: at.u,
      v: at.v,
      rW: RING_W[style],
      style,
      ...(appearMs === undefined ? {} : { appearMs }),
    })
  })
  pieces.lines = chain(places, live.outcomes, 'phrase', prefix)
  return pieces
}

/**
 * A phrase done, fitted into `slot`: its stars at `size`, and at the
 * result a dark ring for each miss.
 */
function slotPieces(
  done: DonePhrase,
  index: number,
  slot: SlotBox,
  run: number,
  result: boolean,
): Pieces {
  const places = fitToSlot(
    phrasePlaces(done.phrase.notes.map((note) => note.midi)),
    slot,
  )
  const size: StarSize = result ? 'result' : 'finished'
  const prefix = `${result ? 'r' : 'f'}${index}`
  const pieces: Pieces = { rings: [], stars: [], lines: [] }
  places.forEach((at, i) => {
    if (landedAt(done.outcomes, i)) {
      pieces.stars.push(
        star(
          `${prefix}-${i}`,
          `${run}-${index}-${i}`,
          at,
          size,
          STAR_WIDTH_W[size],
          false,
        ),
      )
    } else if (result) {
      pieces.rings.push({
        key: `${prefix}-r${i}`,
        u: at.u,
        v: at.v,
        rW: RING_W.missed,
        style: 'missed',
      })
    }
  })
  pieces.lines = chain(
    places,
    done.outcomes,
    result ? 'result' : 'finished',
    prefix,
  )
  return pieces
}

/** The sky for a moment of the run. */
export function echoScene(input: EchoSceneInput): SkyScene {
  const slots = input.result ? RESULT_BOXES : FINISHED_SLOTS
  const all: Pieces[] = input.done
    .slice(0, slots.length)
    .map((done, i) => slotPieces(done, i, slots[i], input.run, input.result))
  if (input.live !== null && !input.result) {
    all.push(livePieces(input.live, input.run))
  }
  return {
    rings: all.flatMap((pieces) => pieces.rings),
    stars: all.flatMap((pieces) => pieces.stars),
    lines: all.flatMap((pieces) => pieces.lines),
    result: input.result,
    celebration: input.result && input.celebration,
  }
}

/** Two scene items alike in every field. */
function alike<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[]
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => {
    const x = a[key]
    const y = b[key]
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.length === y.length && x.every((value, i) => value === y[i])
    }
    return x === y
  })
}

/** `next`'s items, each one that did not change replaced by its old self. */
function kept<T extends { readonly key: string }>(
  previous: readonly T[],
  next: readonly T[],
): readonly T[] {
  const old = new Map(previous.map((item) => [item.key, item]))
  return next.map((item) => {
    const before = old.get(item.key)
    return before !== undefined && alike(before, item) ? before : item
  })
}

/**
 * The next scene, keeping every item that did not change as the very
 * object it was: the sky draws each item once (its list is keyed by the
 * object), so a star that has popped never pops again and a ring that has
 * appeared never appears again when something else in the sky changes.
 */
export function keepSame(previous: SkyScene, next: SkyScene): SkyScene {
  return {
    ...next,
    rings: kept(previous.rings, next.rings),
    stars: kept(previous.stars, next.stars),
    lines: kept(previous.lines, next.lines),
  }
}
