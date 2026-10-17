// ============================================================
// Ng slides' records: the best at each level, the singer's easy note
// ============================================================
//
// The glide rooms' records (glide-room-store.ts) under Ng slides' keys:
// the live table of Ng slides' bests (its shape, its ordering and how a
// settings pull merges another device's copy are in
// src/lib/glide/ng-bests.ts), the easy note the singer settled on when
// there was no voiceprint, so the next run fits its slides there without
// asking for a note again (fitNgSlides puts the first root four semitones
// under it), and whether this device has seen the demo. The room records
// them; the Sing screen's card reads them. Built on first read, not on
// import, so nothing at this module's top level touches storage.

import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import type { NgBest } from '@/lib/glide/ng-bests'
import { isNgBestTable, NG_BESTS_KEY, ngBeats } from '@/lib/glide/ng-bests'
import type { GlideBestOutcome } from './glide-room-store'
import { createGlideRoomStore } from './glide-room-store'

export type { NgBest } from '@/lib/glide/ng-bests'

/** Where the remembered easy note lives, and the settings row it syncs as. */
export const NG_NOTE_KEY = 'pitchperfect_ng_slides_note'

/** Where the demo's seen flag lives: on this device only. */
export const NG_DEMO_SEEN_KEY = 'mp_ng_demo_seen'

const store = createGlideRoomStore<NgBest>({
  bestsKey: NG_BESTS_KEY,
  isBestTable: isNgBestTable,
  beats: ngBeats,
  noteKey: NG_NOTE_KEY,
  demoSeenKey: NG_DEMO_SEEN_KEY,
  levels: NG_SLIDES_LEVELS,
})

export type NgBestOutcome = GlideBestOutcome<NgBest>

export const ngBest = store.best
export const recordNgBest = store.recordBest
export const rememberedNgNote = store.rememberedNote
export const rememberNgNote = store.rememberNote
export const ngDemoSeen = store.demoSeen
export const markNgDemoSeen = store.markDemoSeen
/** The demo's first-visit rule, for the room (demo/useNgDemo.ts) and the Sing screen's picker. */
export const ngDemoAutoPlays = store.demoAutoPlays
export const resetNgStoreForTests = store.resetForTests
