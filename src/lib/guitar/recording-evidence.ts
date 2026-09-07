// Pure guitar evidence segmentation also closes checkpointed notes during crash recovery.
import { createNoteStateMachine } from '../pitch-pipeline/note-state-machine'
import type { CompletedNote } from '../pitch-pipeline/types'
import type { GuitarPitchEvidence, GuitarRecordedNote, GuitarRecordingChunk, } from './recording-types'

export function guitarWavHeader(
  frames: number,
  sampleRate: number,
): ArrayBuffer {
  const bytes = new ArrayBuffer(44)
  const view = new DataView(bytes)
  const word = (at: number, value: string): void => {
    for (let index = 0; index < value.length; index++)
      view.setUint8(at + index, value.charCodeAt(index))
  }
  word(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  word(8, 'WAVE')
  word(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  word(36, 'data')
  view.setUint32(40, frames * 2, true)
  return bytes
}

/** Shared hysteresis core, guitar timing and explicit same-pitch picks. */
export function createGuitarMelodySegmenter(sampleRate: number) {
  const state = createNoteStateMachine({
    enterTolerance: 0.3,
    debounceFrames: 3,
    minHoldSec: 0.045,
    offsetFrames: 3,
    minNoteDurationSec: 0.04,
  })
  const notes: GuitarRecordedNote[] = []
  let attackFrame: number | null = null
  let openAttack: number | null = null
  let claritySum = 0
  let clarityCount = 0
  let lastFrame = 0
  const commit = (note: CompletedNote | null): void => {
    if (note === null) return
    const start = openAttack ?? Math.round(note.startBeat * sampleRate)
    const end = Math.round(note.endBeat * sampleRate)
    if (end - start >= sampleRate * 0.04)
      notes.push({
        id: `note-${notes.length}`,
        midi: note.midi,
        startFrame: Math.max(0, start),
        endFrame: end,
        clarity: clarityCount ? claritySum / clarityCount : 0,
        onset: openAttack === null ? 'pitch-change' : 'attack',
      })
    openAttack = null
    claritySum = 0
    clarityCount = 0
  }
  return {
    attack(frame: number) {
      commit(state.flush(frame / sampleRate))
      state.reset()
      attackFrame = frame
    },
    push(evidence: GuitarPitchEvidence) {
      const time = evidence.frame / sampleRate
      const update = state.update(evidence.midi, time, time)
      commit(update.completed)
      if (update.open !== null) {
        if (
          attackFrame !== null &&
          evidence.frame - attackFrame <= sampleRate * 0.16
        )
          openAttack = attackFrame
        attackFrame = null
        if (evidence.midi !== null) {
          claritySum += evidence.clarity
          clarityCount++
        }
      }
      lastFrame = evidence.frame
    },
    finish(frame: number) {
      commit(state.flush(Math.min(frame, lastFrame + 2048) / sampleRate))
      return [...notes]
    },
    notes: () => notes,
  }
}

export function recoverGuitarMelody(
  chunks: readonly GuitarRecordingChunk[],
  sampleRate: number,
  frames: number,
): GuitarRecordedNote[] {
  const segmenter = createGuitarMelodySegmenter(sampleRate)
  const attacks = chunks.flatMap((chunk) => chunk.attacks)
  let index = 0
  for (const chunk of chunks)
    for (const pitch of chunk.pitches) {
      while (index < attacks.length && attacks[index] <= pitch.frame)
        segmenter.attack(attacks[index++])
      segmenter.push(pitch)
    }
  return segmenter.finish(frames)
}
