// ============================================================
// What the Lip roll room's controller gives the room
// ============================================================
//
// The contract of useLipController.ts, apart from its workings, so the
// room, the demo (demo/useLipDemo.ts) and the fixture can name it without
// reading the run: the glide rooms' controller (room-kit
// glide/glide-room-contract.ts) under Lip roll's types, and Merc's place
// ahead in the demo's take.

import type { GlideRoomController, GlideRoomTypes, } from '@/components/room-kit/glide/glide-room-contract'
import type { BayScroll } from './bay-scroll'
import type { BayFrame } from './bay-view'
import type { LipPlan, LipSummary, WaveHeard } from './lip-run'
import type { MercSpot } from './merc-ahead'
import type { LipMoment } from './merc-lines'
import type { ScriptedLipTake } from './scripted-take'

/** Lip roll's own types, as the glide rooms' core names them. */
export interface LipTypes extends GlideRoomTypes {
  readonly plan: LipPlan
  readonly heard: WaveHeard
  readonly summary: LipSummary
  readonly line: LipMoment
  readonly frame: BayFrame
  readonly scroll: BayScroll
  readonly scripted: ScriptedLipTake
}

export interface LipController extends GlideRoomController<LipTypes> {
  /**
   * Where Merc will ride over the next `seconds` of the demo's take,
   * sampled; empty outside a take (the demo's tooltips stay clear of it).
   */
  mercAhead: (seconds: number) => readonly MercSpot[]
}
