// ============================================================
// TV stage store — how far ahead a connected TV draws the stage
// ============================================================
//
// A TV that draws the Karaoke room's stage (src/lib/tv-stage/) shows the
// song where the room says it is, and the TV plays the song's sound with a
// delay of its own: AirPlay's, and whatever the set adds. How far the two
// end up apart is a device test's answer, so for the proof of concept a
// test build's Developer screen can move the picture earlier or later in
// small steps and keep the setting (apps/mercurypitch/src/shell/
// TvLyricsPanel.tsx). Positive draws the stage ahead of the room's clock,
// for a picture that runs behind the sound.
//
// Tests: src/stores/tv-stage-store.test.ts.

import { createPersistedSignal } from '@/lib/storage'

/** One press of Earlier or Later, in ms. */
export const TV_STAGE_OFFSET_STEP_MS = 50

/** The furthest either way the picture moves, in ms. */
export const TV_STAGE_OFFSET_LIMIT_MS = 1500

const isOffset = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= TV_STAGE_OFFSET_LIMIT_MS

export const [tvStageOffsetMs, setTvStageOffsetMs] =
  createPersistedSignal<number>('pitchperfect_tv_stage_offset_ms', 0, {
    validator: isOffset,
  })

/** Move the picture by `deltaMs`, within the limit either way. */
export function nudgeTvStageOffset(deltaMs: number): void {
  setTvStageOffsetMs((current) =>
    Math.max(
      -TV_STAGE_OFFSET_LIMIT_MS,
      Math.min(TV_STAGE_OFFSET_LIMIT_MS, current + deltaMs),
    ),
  )
}

/** The setting in words: in step, or how far earlier or later. */
export function describeTvStageOffset(offsetMs: number): string {
  if (offsetMs === 0) return 'in step with the phone'
  const amount = `${String(Math.abs(offsetMs))} ms`
  return offsetMs > 0 ? `${amount} earlier` : `${amount} later`
}
