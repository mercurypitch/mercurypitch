// ============================================================
// Room script: how a premium room lets its demo in and out
// ============================================================
//
// The "how it works" demo (demo-kit useExerciseDemo.ts) sings Merc's takes
// through the room itself, by the room's DemoScript: enter, a take, a rest
// between the takes, the second take, and leave. Echo, Long note and the
// glide rooms (Lip roll, Ng slides) let it in and out on the same terms,
// and this is those terms:
//
//   enter    only at the room's intro or on a result, or while the demo
//            is already on (Watch again): never mid-take, nor while the mic
//            opens. Refused, the room is left as it is, and the demo hears
//            false.
//   play, rest, leave
//            only while the demo is on: a move that comes once it has left
//            does nothing.
//
// What each move does stays in the room, because the rooms differ in it:
// what clearing the room means (Long note keeps the light's level and
// eases it down; Echo's own timers fall silent with the take), whether a
// take clears the room first (Long note's does not: it closes an open
// take's window and keeps the light), the machine's phase for each move,
// Merc's moves, and the order of the writes in each batch. The room turns
// its own switch (`active`) on and off inside those batches, where its
// other writes are.

import type { Accessor } from 'solid-js'
import { untrack } from 'solid-js'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'

/** A room's demo moves, and what the demo reads of the room. */
export interface RoomScriptMoves<Take> {
  /** On from the demo's enter to its leave: the room's switch, tracked. */
  readonly active: Accessor<boolean>
  /** The room's phase, read untracked: the demo comes in at 'intro' or 'result'. */
  readonly phase: () => string
  /** The room's audio clock, running (asked inside a tap), or null. */
  readonly audio: () => Promise<AudioContext | null>
  /** What the demo's sound needs loaded first, if anything (DemoScript). */
  readonly ready?: () => Promise<unknown>
  /** The note the demo sings. */
  readonly note: () => number
  /**
   * The demo comes in, with `line` in Merc's bubble: the room clears,
   * turns its switch on and shows the demo's start.
   */
  readonly enter: (line: string) => void
  /** One of the demo's takes, sung through the room. */
  readonly play: (take: Take) => void
  /** Between the takes: the room empties. */
  readonly rest: () => void
  /** Back to the room's start: its switch off, the demo not playing. */
  readonly leave: () => void
  /** Whether the demo is playing: its own say (not on its cards). */
  readonly playing: (on: boolean) => void
}

/** The room's way in for its demo (the demo kit's DemoScript). */
export function createRoomScript<Take>(
  room: RoomScriptMoves<Take>,
): DemoScript<Take> {
  const on = (): boolean => untrack(room.active)
  return {
    active: room.active,
    audio: room.audio,
    ready: room.ready,
    note: room.note,
    enter: (line) => {
      const from = room.phase()
      if (!on() && from !== 'intro' && from !== 'result') return false
      room.enter(line)
      return true
    },
    play: (take) => {
      if (on()) room.play(take)
    },
    rest: () => {
      if (on()) room.rest()
    },
    leave: () => {
      if (on()) room.leave()
    },
    playing: room.playing,
  }
}
