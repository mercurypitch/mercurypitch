// ============================================================
// What the Lip roll room's controller gives the room
// ============================================================
//
// The contract of useLipController.ts, apart from its workings, so the
// room, the demo (demo/useLipDemo.ts) and the fixture can name it without
// reading the run.

import type { Accessor } from 'solid-js'
import type { GlidePath } from '@/lib/glide/glide-path'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { BayView } from './bay-view'
import type { LipState } from './lip-machine'
import type { LipSummary } from './lip-run'
import type { MercSpot } from './merc-ahead'
import type { LipScript } from './scripted-take'

/** Nobody sang for this long during a run: it stops, the mic closes. */
export const QUIET_LIMIT_SECONDS = 60

export interface LipController {
  state: Accessor<LipState>
  /** Merc's line in his bubble; '' for none. */
  line: Accessor<string>
  /** "Wave 2 of 3" during a run; null for none. */
  chip: Accessor<string | null>
  /**
   * A wave is being ridden (its up, top and down): the singer's turn in a
   * run (lipMicState). False in the count-in, a landing, a breath and the
   * demo.
   */
  riding: Accessor<boolean>
  /**
   * How loud the singer is, 0..1, from the newest frame the run has read:
   * the mic's ring follows it. Read every frame; deliberately not reactive.
   */
  micLevel: () => number
  summary: Accessor<LipSummary | null>
  mercState: Accessor<MercState>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  /** The path the scene draws its dots from. */
  path: Accessor<GlidePath>
  /** The waves are not the room's guess: their tops are named. */
  named: Accessor<boolean>
  /** The pulled-back result is up. */
  showResult: Accessor<boolean>
  /** Start a run: from the intro, a result or a blocked mic. */
  start: () => void
  /** The mic button during a run: the run stops, nothing kept. */
  stop: () => void
  /** The scene the run draws on. */
  attach: (view: BayView) => void
  /** The demo's way in: its waves buzzed through this room. */
  script: LipScript
  /**
   * Where Merc will ride over the next `seconds` of the demo's take,
   * sampled; empty outside a take (the demo's tooltips stay clear of it).
   */
  mercAhead: (seconds: number) => readonly MercSpot[]
}
