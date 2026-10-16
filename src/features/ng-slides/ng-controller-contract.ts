// ============================================================
// What the Ng slides room's controller gives the room
// ============================================================
//
// The contract of useNgController.ts, apart from its workings, so the
// room, the demo (demo/useNgDemo.ts) and the fixture can name it without
// reading the run.

import type { Accessor } from 'solid-js'
import type { GlidePath } from '@/lib/glide/glide-path'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { BridgeView } from './bridge-view'
import type { NgState } from './ng-machine'
import type { NgSummary } from './ng-run'
import type { NgScript } from './scripted-take'

/** Nobody hummed for this long during a run: it stops, the mic closes. */
export const QUIET_LIMIT_SECONDS = 60

/** What the scene draws its lines from: the path, and the names' root. */
export interface NgSceneLines {
  readonly path: GlidePath
  readonly root: number | null
}

export interface NgController {
  state: Accessor<NgState>
  /** Merc's line in his bubble; '' for none. */
  line: Accessor<string>
  /** "Slide 2 of 5" during a run; null for none. */
  chip: Accessor<string | null>
  /**
   * A slide is being sung (its up, top and down): the singer's turn in a
   * run (ngMicState). False in the count-in, a landing, a breath and the
   * demo.
   */
  sliding: Accessor<boolean>
  /**
   * How loud the singer is, 0..1, from the newest frame the run has read:
   * the mic's ring follows it. Read every frame; deliberately not reactive.
   */
  micLevel: () => number
  summary: Accessor<NgSummary | null>
  mercState: Accessor<MercState>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  lines: Accessor<NgSceneLines>
  /** The pulled-back result is up. */
  showResult: Accessor<boolean>
  /** Start a run: from the intro, a result or a blocked mic. */
  start: () => void
  /** The mic button during a run: the run stops, nothing kept. */
  stop: () => void
  /** The scene the run draws on. */
  attach: (view: BridgeView) => void
  /** The demo's way in: its slides hummed through this room. */
  script: NgScript
}
