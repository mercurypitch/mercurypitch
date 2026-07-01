// ============================================================
// Voice Mirror — reference tone playback for the match task.
//
// Tiny oscillator player on the mirror's own AudioContext. The
// main app's AudioEngine has richer tone playback, but pulling it
// in would drag the whole engine into the mirror bundle; the
// match task only needs a clean 1 s reference tone
// (reference-then-record, never simultaneous — §2 Task C).
// ============================================================

import { midiToFrequency } from '@/lib/frequency-to-note'

/** Play a soft reference tone and resolve when it has fully decayed. */
export function playReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
): Promise<void> {
  // iOS can auto-suspend the context between tasks; a suspended context
  // would never fire osc.onended and the guided flow would hang on it.
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined)
  }
  return new Promise((resolve) => {
    let settled = false
    const settle = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    // Safety net for the same reason: resolve even if playback never runs.
    const fallback = setTimeout(settle, (durationSec + 0.5) * 1000)

    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime

    // Triangle reads more "voice-like" than a bare sine and is easier to
    // match by ear; short attack/release avoids clicks.
    osc.type = 'triangle'
    osc.frequency.value = midiToFrequency(midi)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.03)
    gain.gain.setValueAtTime(0.28, now + durationSec - 0.12)
    gain.gain.linearRampToValueAtTime(0.0001, now + durationSec)

    osc.connect(gain)
    gain.connect(audioContext.destination)
    osc.onended = () => {
      clearTimeout(fallback)
      osc.disconnect()
      gain.disconnect()
      settle()
    }
    osc.start(now)
    osc.stop(now + durationSec)
  })
}
