// ============================================================
// What the Ng slides room's controller gives the room
// ============================================================
//
// The contract of useNgController.ts, apart from its workings, so the
// room, the demo (demo/useNgDemo.ts) and the fixture can name it without
// reading the run: the glide rooms' controller (room-kit
// glide/glide-room-contract.ts) under Ng slides' types.

import type { GlideRoomController, GlideRoomTypes, } from '@/components/room-kit/glide/glide-room-contract'
import type { BridgeScroll } from './bridge-scroll'
import type { BridgeFrame } from './bridge-view'
import type { NgMoment } from './merc-lines'
import type { NgPlan, NgSummary, SlideHeard } from './ng-run'
import type { ScriptedNgTake } from './scripted-take'

/** Ng slides' own types, as the glide rooms' core names them. */
export interface NgTypes extends GlideRoomTypes {
  readonly plan: NgPlan
  readonly heard: SlideHeard
  readonly summary: NgSummary
  readonly line: NgMoment
  readonly frame: BridgeFrame
  readonly scroll: BridgeScroll
  readonly scripted: ScriptedNgTake
}

export type NgController = GlideRoomController<NgTypes>
