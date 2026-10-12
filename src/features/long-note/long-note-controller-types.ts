// ============================================================
// The Long note controller's face: what the room reads and calls
// ============================================================
//
// useLongNoteController builds one of these per room; the room, the demo
// and its layer read it. Kept apart from the controller's body, which is
// long enough on its own.

import type { Accessor } from 'solid-js'
import type { MercPlace } from '@/components/room-kit/merc-moves'
import type { HoldState } from '@/lib/hold/hold-engine'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { LongNoteState } from './long-note-machine'
import type { LongNoteScript } from './scripted-take'
import type { VoiceTraceBuffer } from './voice-trace-buffer'

export interface LongNoteRunSummary {
  /** The big number: seconds the light filled. */
  readonly inBandSeconds: number
  /** Out of 100, or null when the run never found the note. */
  readonly steadiness: number | null
  readonly locked: boolean
  /** Beat a previous best on this note. */
  readonly improved: boolean
  /** The lantern filled to the goal, halfway. */
  readonly full: boolean
  /** Past the goal the top filled too: the brim. */
  readonly brim: boolean
}

export interface LongNoteController {
  state: Accessor<LongNoteState>
  /** The note to hold ("A3"), or '' while the singer picks their own. */
  noteName: Accessor<string>
  hold: Accessor<HoldState>
  summary: Accessor<LongNoteRunSummary | null>
  line: Accessor<string>
  chip: Accessor<string | null>
  mercState: Accessor<MercState>
  mercPlace: Accessor<MercPlace>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  lanternLevel: Accessor<number>
  lanternGlow: Accessor<number>
  /** The lantern's shine: 0, GOAL_SHINE from the goal, 1 at the brim. */
  shine: Accessor<number>
  trace: VoiceTraceBuffer
  /** The trace's clock: seconds since the take started. */
  now: () => number
  /** The band either side of the line: the take's level, or the demo's. */
  toleranceCents: Accessor<number>
  start: () => void
  /** Stop listening before a note and go back to the intro. */
  cancel: () => void
  /** The mic button while the room listens: ends the hold, or cancels. */
  stop: () => void
  again: () => void
  changeNote: () => void
  nudge: (step: 1 | -1) => void
  /** The note plays on a tap: not while the take listens, nor in the demo. */
  canHear: Accessor<boolean>
  hearNote: () => void
  script: LongNoteScript
}
