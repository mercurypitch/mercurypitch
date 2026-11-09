// Studio MIDI render key — a stable 64-bit name for what a MIDI clip's audio is rendered from: its sequence's notes and time, the lane's sound and the renderer's version.
//
// A clip keeps the key of the content its audio came from (clip.midi.
// renderKey); one that no longer matches its sequence's key is due a render.
// Audio recorded live counts as the first render, so a take is keyed as it
// is kept and nothing renders until an edit. The key covers what changes the
// sound: each note's pitch, start, length, velocities and channel, in a
// canonical order (start, pitch, then id for ties), with the defaults of
// fields left out filled in. Note ids name notes for editing and order only
// ties, so they are not hashed. Synchronous and deterministic, in any
// browser, so a key is the same wherever the song is opened.
import type { StudioNote, StudioSequence } from '../model/types'

/** Raised when the renderer would make different audio from the same notes. */
export const MIDI_RENDER_VERSION = 1

/** What a MIDI lane sounds as: the drum kit for drums and percussion, the piano for the rest. */
export type StudioMidiSoundKind = 'piano' | 'drums'

/** The notes in the order the key reads them. */
function canonicalNotes(notes: readonly StudioNote[]): StudioNote[] {
  return [...notes].sort(
    (a, b) => a.startTick - b.startTick || a.pitch - b.pitch || a.id - b.id,
  )
}

function noteText(note: StudioNote): string {
  return [
    note.startTick,
    note.pitch,
    note.lengthTicks,
    note.velocity,
    note.releaseVelocity ?? 0.5,
    note.channel ?? 0,
  ].join(',')
}

/** Two 32-bit lanes of multiply-xorshift over `text`'s code units, mixed into each other at the end: 16 hex digits. */
function hash64(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ unit, 2654435761)
    h2 = Math.imul(h2 ^ unit, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const half = (value: number) => (value >>> 0).toString(16).padStart(8, '0')
  return half(h2) + half(h1)
}

/** The key of what `sequence` renders as on a lane that sounds as `sound`. */
export function studioMidiRenderKey(
  sequence: Pick<StudioSequence, 'ppq' | 'tempoBpm' | 'lengthTicks' | 'notes'>,
  sound: StudioMidiSoundKind,
): string {
  const head = [
    `v${MIDI_RENDER_VERSION}`,
    sound,
    sequence.ppq,
    sequence.tempoBpm,
    sequence.lengthTicks,
  ].join('|')
  return hash64(
    `${head}|${canonicalNotes(sequence.notes).map(noteText).join(';')}`,
  )
}
