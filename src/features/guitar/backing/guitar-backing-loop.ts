// Buffered song loops share a clock and an audio-time seam envelope across all stems.
// ============================================================

import type { LoopSpan } from '@/lib/guitar/loop-span'
import { normalizeLoopSpan } from '@/lib/guitar/loop-span'

export function normalizeGuitarBackingLoop(
  range: LoopSpan | null,
  duration: number,
): LoopSpan | null {
  if (range === null || range.end <= range.start) return null
  return normalizeLoopSpan(range.start, range.end, duration)
}

/** A seek before A plays the introduction; a seek past B starts at A. */
export function guitarBackingLoopSeekPosition(
  position: number,
  range: LoopSpan | null,
): number {
  return range !== null && position >= range.end ? range.start : position
}

/**
 * Native buffer loops continue without either UI frames or timers. This
 * separate gate softens their waveform discontinuity with short linear dips
 * queued on the audio clock. A suspended JS thread can miss later dips, but
 * never interrupts or desynchronizes the underlying native loop.
 */
export function createGuitarBackingLoopEnvelope(
  context: AudioContext,
  destination: AudioNode,
) {
  const input = context.createGain()
  input.connect(destination)
  let timer: ReturnType<typeof setInterval> | null = null
  let nextBoundary = 0
  let length = 0
  const halfDip = 0.002
  const lookahead = 2

  const stop = (): void => {
    if (timer !== null) clearInterval(timer)
    timer = null
    input.gain.cancelScheduledValues(context.currentTime)
    input.gain.setValueAtTime(input.gain.value, context.currentTime)
    input.gain.linearRampToValueAtTime(1, context.currentTime + halfDip)
  }

  const schedule = (): void => {
    const now = context.currentTime
    if (nextBoundary - halfDip <= now) {
      nextBoundary +=
        (Math.floor((now + halfDip - nextBoundary) / length) + 1) * length
    }
    while (nextBoundary < now + lookahead) {
      input.gain.setValueAtTime(1, nextBoundary - halfDip)
      input.gain.linearRampToValueAtTime(0, nextBoundary)
      input.gain.linearRampToValueAtTime(1, nextBoundary + halfDip)
      nextBoundary += length
    }
  }

  return {
    input,
    start(range: LoopSpan | null, epoch: number, offset: number) {
      stop()
      if (range === null) return
      length = range.end - range.start
      nextBoundary = epoch + range.end - offset
      schedule()
      timer = setInterval(schedule, 250)
    },
    stop,
    dispose() {
      stop()
      input.disconnect()
    },
  }
}
