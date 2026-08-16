// ============================================================
// Note preview — hear the target, don't just read it
// ============================================================
//
// Lifted out of NotePillSelector so the dial and the pill row cannot
// drift apart on it. Two copies of "play a short reference tone" is
// exactly the shape of bug that cost us the zen note glyphs: one surface
// gets a fix, the other keeps the old behaviour, and only its users
// notice.

import { onCleanup } from 'solid-js'
import { midiToFrequency, noteToMidi } from '@/lib/frequency-to-note'
import { initAudioEngine } from '@/stores/app-store'

const PREVIEW_MS = 550
/**
 * Minimum spacing between retriggers. A dial spin fires ~30 changes/s;
 * even with correct envelopes that many 75 ms releases layered over new
 * attacks is mush, not a glissando. 80 ms keeps a fast spin sounding like
 * discrete notes; the LAST pick always sounds (trailing timer), so the
 * note the finger settles on is never swallowed.
 */
const RETRIGGER_MS = 80

/**
 * Returns a function that plays one short tone for a note name.
 *
 * Re-picking cuts the previous preview short instead of stacking voices.
 * The generation counter covers rapid picks that race the async engine
 * init: a superseded preview stops itself as soon as its id resolves.
 */
export function useNotePreview(
  enabled: () => boolean = () => true,
  onPlay?: (note: string) => void,
): (note: string) => void {
  let previewNoteId: number | undefined
  let previewGen = 0
  let lastTriggerAt = 0
  let trailingTimer: ReturnType<typeof setTimeout> | null = null

  onCleanup(() => {
    if (trailingTimer !== null) clearTimeout(trailingTimer)
    if (previewNoteId !== undefined) {
      void initAudioEngine().then((engine) => {
        if (previewNoteId !== undefined) engine.stopNote(previewNoteId)
      })
    }
  })

  const trigger = (note: string): void => {
    const midi = noteToMidi(note)
    if (Number.isNaN(midi)) return
    // Fires when a tone actually sounds — after the throttle, not on every
    // pick — so a visual keyed to it (the dial's seat pulse) stays in step
    // with what the singer hears.
    onPlay?.(note)
    lastTriggerAt = performance.now()
    const gen = ++previewGen
    void initAudioEngine().then(async (engine) => {
      if (previewNoteId !== undefined) engine.stopNote(previewNoteId)
      // previewNote plays at reduced per-voice gain — a sudden full-volume
      // tone on a tap was jarring next to regular playback.
      const id = await engine.previewNote(midiToFrequency(midi), PREVIEW_MS)
      if (gen !== previewGen) {
        if (id !== undefined) engine.stopNote(id)
        return
      }
      previewNoteId = id
    })
  }

  return (note: string) => {
    if (!enabled()) return
    if (trailingTimer !== null) {
      clearTimeout(trailingTimer)
      trailingTimer = null
    }
    const since = performance.now() - lastTriggerAt
    if (since >= RETRIGGER_MS) {
      trigger(note)
      return
    }
    // Too soon: hold this note and play it when the window opens, unless a
    // newer pick replaces it first.
    trailingTimer = setTimeout(() => {
      trailingTimer = null
      trigger(note)
    }, RETRIGGER_MS - since)
  }
}
