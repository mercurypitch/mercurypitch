// ============================================================
// The room's rules, as plain functions the room and its tests share:
// whether Close asks first, what the plate's main button does, and
// which pose Merc holds. No signals and no DOM, so each rule is
// tested on its own (room-policy.test.ts).
// ============================================================

import type { RoomBeat } from '@/features/ear-lab/stage-room'
import type { FacultyId } from '@/lib/ear/drills'
import type { MercState } from '@/lib/merc/constants'

/** Where a run was opened from, so Done goes back there. */
export type RoomOrigin =
  | { kind: 'today' }
  | { kind: 'station'; faculty: FacultyId }
  | { kind: 'bench' }

/** Close mid-run asks first; with nothing running it simply leaves. */
export function closeAsksFirst(beat: RoomBeat): boolean {
  return beat === 'listen' || beat === 'answer' || beat === 'reveal'
}

/** One of today's segments, as the plate reads the plan. */
export interface TodaySegment {
  drillId: string
  name: string
}

export type PlateAction =
  | { kind: 'today'; drillId: string; label: string }
  | { kind: 'today-done'; label: string }
  | { kind: 'again'; label: string }

/**
 * The plate's main button. A run that is part of today's three (opened
 * from Today, or one of the three opened anywhere) leads to the next of
 * them, or to the day's close once all three are done. Anything else
 * offers the drill again. `done` already holds the run just finished.
 */
export function plateAction(args: {
  origin: RoomOrigin
  drillId: string
  plan: readonly TodaySegment[]
  done: ReadonlySet<string>
}): PlateAction {
  const inToday =
    args.origin.kind === 'today' ||
    args.plan.some((segment) => segment.drillId === args.drillId)
  if (inToday && args.plan.length > 0) {
    const next = args.plan.find(
      (segment) =>
        !args.done.has(segment.drillId) && segment.drillId !== args.drillId,
    )
    if (next !== undefined) {
      return {
        kind: 'today',
        drillId: next.drillId,
        label: `Next for today: ${next.name}`,
      }
    }
    if (args.plan.every((segment) => args.done.has(segment.drillId))) {
      return { kind: 'today-done', label: 'See the day' }
    }
  }
  return { kind: 'again', label: 'Run again' }
}

/** Where Done goes back to. */
export function doneLabel(origin: RoomOrigin): string {
  switch (origin.kind) {
    case 'today':
      return 'Done, back to Today'
    case 'station':
      return 'Done, back to the station'
    case 'bench':
      return 'Done, back to the bench'
  }
}

/**
 * Merc's pose. He listens while the sound plays and is attentive while
 * the singer answers; a right answer gets a small acknowledgement and a
 * wrong one nothing at all. He celebrates only on a plate worth it and
 * at the day's end, never mid-run.
 */
export function mercPose(args: {
  beat: RoomBeat
  sounding: boolean
  verdict: 'right' | 'wrong' | null
  /** The plate shows a reading better than the last, a first, a seal. */
  plateWorthIt: boolean
}): MercState {
  if (args.sounding) return 'listen'
  switch (args.beat) {
    case 'listen':
      return 'listen'
    case 'answer':
      return 'idle'
    case 'reveal':
      return args.verdict === 'right' ? 'lock' : 'idle'
    case 'done':
      return args.plateWorthIt ? 'celebrate' : 'point'
    case 'idle':
      return 'point'
  }
}

/** What the verdict is felt as. Nothing while a test sound plays: the
 *  room holds it until the sound is done. */
export function verdictHaptic(correct: boolean): 'tap' | 'warning' {
  return correct ? 'tap' : 'warning'
}

/** Merc's bubble during a run: the full task on the first question,
 *  then nothing until the verdict. */
export function bubbleShows(args: {
  beat: RoomBeat
  /** Questions answered so far this run. */
  answered: number
}): 'prompt' | 'verdict' | 'none' {
  if (args.beat === 'reveal') return 'verdict'
  if (args.beat === 'idle') return 'prompt'
  if (args.beat === 'listen' || args.beat === 'answer') {
    return args.answered === 0 ? 'prompt' : 'none'
  }
  return 'none'
}
