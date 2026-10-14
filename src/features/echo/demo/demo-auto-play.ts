// ============================================================
// Whether the Echo demo plays by itself on the way in
// ============================================================
//
// A first visit: the demo unseen and no run sung yet (no best at any
// level, no root kept from a settled note). One rule for the room
// (useEchoDemo opens on it) and for the Sing screen's picker, which says
// so before the singer goes in (premium-exercises/echo-entry.ts).
//
// It reads only the stores, never the room, so the way in can ask it
// without loading the room.

import type { EchoLevelId } from '@/lib/sequence/sequence-engine'
import { ECHO_LEVELS } from '@/lib/sequence/sequence-engine'
import { echoBest, rememberedEchoRoot } from '@/stores/echo-store'
import { echoDemoSeen } from './demo-seen'

const LEVELS = Object.keys(ECHO_LEVELS) as EchoLevelId[]

export function echoDemoAutoPlays(): boolean {
  if (echoDemoSeen()) return false
  if (rememberedEchoRoot() !== null) return false
  return LEVELS.every((level) => echoBest(level) === null)
}
