// ============================================================
// What the Echo room's controller gives the room, and its timings
// ============================================================
//
// The contract of useEchoController.ts, apart from its workings, so the
// room, the demo (scripted-take.ts, demo/) and the tests can name it
// without reading the run. useEchoController re-exports all of it.

import type { Accessor } from 'solid-js'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { EchoState } from './echo-machine'
import type { EchoSummary } from './echo-run'
import type { CallVoice } from './merc-call'
import type { EchoScript } from './scripted-take'
import type { SkyScene } from './sky-scene'
import type { VoicePoint } from './voice-path'

export type { EchoSummary } from './echo-run'

/** The constellation a phrase made shows this long before the next call. */
export const PHRASE_SHOW_MS = 1200
/**
 * The demo's take 2 shows its constellation this long before its result:
 * longer than a run's, so the tooltip on it can be read before the result
 * moves its stars (demo/demo-cues.ts).
 */
export const DEMO_PHRASE_SHOW_MS = 2000
/** Merc's call starts this far ahead of now on the audio clock, s. */
export const CALL_LEAD_SECONDS = 0.35
/** After the singer's settled note, a breath before the first call, s. */
export const SETTLED_LEAD_SECONDS = 0.9
/** Nobody sang for this long during a run: the run stops, the mic closes. */
export const QUIET_LIMIT_SECONDS = 60

/** The chip while the singer sings the phrase back. */
export const YOUR_TURN = 'Your turn'

export interface EchoController {
  state: Accessor<EchoState>
  scene: Accessor<SkyScene>
  /** Merc's line in his bubble; '' for none. */
  line: Accessor<string>
  /** The chip at the top while the phrase is sung; null for none. */
  chip: Accessor<string | null>
  summary: Accessor<EchoSummary | null>
  mercState: Accessor<MercState>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  /**
   * How loud the singer is, 0..1, from the newest frame the run has read:
   * the mic's ring follows it on the singer's turn. Merc's call through
   * the speaker is not the singer: the response's gate (the call plus
   * RESPONSE_GATE_SECONDS) reads as silence. Read every frame;
   * deliberately not reactive.
   */
  micLevel: () => number
  /** "Hear it again" is on offer now. */
  canReplay: Accessor<boolean>
  /** Start a run: from the intro, a result or a blocked mic. */
  start: () => void
  /** The mic button during a run: the run stops, nothing kept. */
  stop: () => void
  /** Merc sings the phrase again, from its call. */
  replay: () => void
  /** Where the voice's path goes: the room draws each one it is handed. */
  drawVoice: (sink: (points: readonly VoicePoint[] | null) => void) => void
  /** The demo's way in (scripted-take.ts). */
  script: EchoScript
}

export interface EchoControllerOptions {
  /** The voice that sings Merc's calls (merc-call.ts). */
  voice?: CallVoice
  /** Picks each run's phrases. */
  random?: () => number
}
