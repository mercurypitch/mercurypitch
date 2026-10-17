// ============================================================
// Lip roll's records: the best at each level, the singer's easy note
// ============================================================
//
// The glide rooms' records (glide-room-store.ts) under Lip roll's keys:
// the live table of Lip roll's bests (its shape, its ordering and how a
// settings pull merges another device's copy are in
// src/lib/glide/lip-bests.ts), the easy note the singer settled on when
// there was no voiceprint, so the next run sets its waves there without
// asking for a note again (fitLipRoll puts the first root four semitones
// under it), and whether this device has seen the demo. The room records
// them; the Sing screen's card reads them. Built on first read, not on
// import, so nothing at this module's top level touches storage.

import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import type { LipBest } from '@/lib/glide/lip-bests'
import { isLipBestTable, LIP_BESTS_KEY, lipBeats } from '@/lib/glide/lip-bests'
import type { GlideBestOutcome } from './glide-room-store'
import { createGlideRoomStore } from './glide-room-store'

export type { LipBest } from '@/lib/glide/lip-bests'

/** Where the remembered easy note lives, and the settings row it syncs as. */
export const LIP_NOTE_KEY = 'pitchperfect_lip_roll_note'

/** Where the demo's seen flag lives: on this device only. */
export const LIP_DEMO_SEEN_KEY = 'mp_lip_demo_seen'

const store = createGlideRoomStore<LipBest>({
  bestsKey: LIP_BESTS_KEY,
  isBestTable: isLipBestTable,
  beats: lipBeats,
  noteKey: LIP_NOTE_KEY,
  demoSeenKey: LIP_DEMO_SEEN_KEY,
  levels: LIP_ROLL_LEVELS,
})

export type LipBestOutcome = GlideBestOutcome<LipBest>

export const lipBest = store.best
export const recordLipBest = store.recordBest
export const rememberedLipNote = store.rememberedNote
export const rememberLipNote = store.rememberNote
export const lipDemoSeen = store.demoSeen
export const markLipDemoSeen = store.markDemoSeen
/** The demo's first-visit rule, for the room (demo/useLipDemo.ts) and the Sing screen's picker. */
export const lipDemoAutoPlays = store.demoAutoPlays
export const resetLipStoreForTests = store.resetForTests
