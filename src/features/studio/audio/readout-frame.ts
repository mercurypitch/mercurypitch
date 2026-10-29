// Studio readout frame — the playhead the clock text, the ruler and edits read: ten times a second while the song plays, at once when it jumps or stops.
//
// The transport ticks every 33 ms. Each tick used to rewrite the clock, the
// ruler's value and the spoken position, and rerun everything that read
// the playhead. The line itself follows the clock every display frame on
// the compositor (timeline/playhead-motion.ts), so the words can move less
// often without the song looking slow.
import { createSignal } from 'solid-js'

/** How often the readouts follow a playing song: every third 33 ms tick, ten times a second. */
export const STUDIO_READOUT_MS = 80
/** A move this far from where the clock should be is a seek or a loop, shown at once. */
export const STUDIO_READOUT_JUMP_SECONDS = 0.25

interface Reading {
  playing: boolean
  pending: boolean
  playheadFrame: number
}

export function createStudioReadoutFrame(sampleRate: number) {
  const [frame, setFrame] = createSignal(0)
  let shown = { frame: 0, at: 0, moving: false }
  return {
    frame,
    /** Take a transport reading made at `now` (performance time, ms). */
    follow(reading: Reading, now: number = performance.now()): void {
      const moving = reading.playing && !reading.pending
      const expected = shown.frame + ((now - shown.at) / 1000) * sampleRate
      if (
        moving &&
        shown.moving &&
        now - shown.at < STUDIO_READOUT_MS &&
        Math.abs(reading.playheadFrame - expected) <
          STUDIO_READOUT_JUMP_SECONDS * sampleRate
      )
        return
      shown = { frame: reading.playheadFrame, at: now, moving }
      setFrame(reading.playheadFrame)
    },
  }
}
