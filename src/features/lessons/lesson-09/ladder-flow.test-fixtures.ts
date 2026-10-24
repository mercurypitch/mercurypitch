// ============================================================
// Lesson 9 ladder flow test builders — visits and events by name
// ============================================================
//
// The unit tests (ladder-flow.test.ts) and the walk over every route a
// visit can take (ladder-flow-walk.test.ts) build their visits from these:
// a visit as Sing it opens it, the events the page sends, and a take as its
// button and its end.

import type { Feeling } from '@/features/lessons/kit/comfort'
import type { LadderId } from './ladder-data'
import type { LadderEvent, LadderVisit, TakeKind, VisitStart, } from './ladder-flow'
import { next, openVisit } from './ladder-flow'

export const run = (
  events: readonly LadderEvent[],
  from: LadderVisit,
): LadderVisit => events.reduce(next, from)

/** A visit as Sing it opens it: by default a voice stored, the sound on and Web Audio. */
export const visit = (o: Partial<VisitStart> = {}): LadderVisit =>
  openVisit({ voice: 'lower', sound: true, webAudio: true, ...o })

export const SING: LadderEvent = { type: 'comfort', sing: true }
export const LISTEN: LadderEvent = { type: 'comfort', sing: false }
export const DONE: LadderEvent = { type: 'done' }
export const NOMIC: LadderEvent = { type: 'nomic' }
export const SILENCED: LadderEvent = { type: 'silenced' }
export const SOUND_OFF: LadderEvent = { type: 'sound', on: false }
export const SOUND_ON: LadderEvent = { type: 'sound', on: true }
export const HIGHER: LadderEvent = { type: 'voice', voice: 'higher' }
export const begin = (ladder: LadderId): LadderEvent => ({
  type: 'begin',
  ladder,
})
export const took = (kind: TakeKind): LadderEvent => ({ type: 'took', kind })
export const feel = (feeling: Feeling): LadderEvent => ({
  type: 'feel',
  feeling,
})

/** A take on `ladder` that came to `kind`. */
export const take = (ladder: LadderId, kind: TakeKind): LadderEvent[] => [
  begin(ladder),
  took(kind),
]

/** Singing in the lower voice, at the briefing. */
export const briefed = (): LadderVisit => run([SING], visit())

/** Every way a take can end. */
export const KINDS: readonly TakeKind[] = [
  'none',
  'unsteady',
  'some',
  'all',
  'leftSilent',
  'leftVoiced',
]
