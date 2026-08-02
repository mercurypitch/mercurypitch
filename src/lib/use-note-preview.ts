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
 * Returns a function that plays one short tone for a note name.
 *
 * Re-picking cuts the previous preview short instead of stacking voices.
 * The generation counter covers rapid picks that race the async engine
 * init: a superseded preview stops itself as soon as its id resolves.
 */
export function useNotePreview(
  enabled: () => boolean = () => true,
): (note: string) => void {
  let previewNoteId: number | undefined
  let previewGen = 0

  onCleanup(() => {
    if (previewNoteId !== undefined) {
      void initAudioEngine().then((engine) => {
        if (previewNoteId !== undefined) engine.stopNote(previewNoteId)
      })
    }
  })

  return (note: string) => {
    if (!enabled()) return
    const midi = noteToMidi(note)
    if (Number.isNaN(midi)) return
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
}
