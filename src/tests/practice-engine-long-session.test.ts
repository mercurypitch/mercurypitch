// ============================================================
// PracticeEngine over a long session — a headless smoke test
// ============================================================
//
// Drives the engine the way a singer does, minus the microphone: a synthetic
// AudioEngine hands back a clean sine at the target pitch, performance.now()
// is a virtual clock, and the engine scores fifty notes in a row and then
// thirty start/stop cycles. It asserts what a session must keep true — every
// note is attributed and scored, and a cycle's callbacks do not bleed into
// the next — not memory or timing, which a unit test cannot measure.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import { PracticeEngine, scoreGrade } from '@/lib/practice-engine'
import type { MelodyNote, NoteResult } from '@/types'

const syntheticAudioEngine = (): {
  audio: AudioEngine
  setTone: (freq: number) => void
} => {
  let currentToneHz = 440
  const buffer = new Float32Array(2048)
  const fillTimeData = (): Float32Array => {
    if (currentToneHz === 0) {
      buffer.fill(0)
      return buffer
    }
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = 0.5 * Math.sin((2 * Math.PI * currentToneHz * i) / 44100)
    }
    return buffer
  }
  return {
    audio: {
      init: () => Promise.resolve(),
      resume: () => Promise.resolve(),
      getSampleRate: () => 44100,
      getBufferSize: () => 2048,
      startMic: () => Promise.resolve(true),
      stopMic: () => {},
      isMicActive: () => true,
      onMicLost: () => () => {},
      getTimeData: fillTimeData,
    } as unknown as AudioEngine,
    setTone: (freq: number) => {
      currentToneHz = freq
    },
  }
}

const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BASE_FREQS = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88]

function melodyNote(index: number): MelodyNote {
  const noteIdx = index % 7
  return {
    name: NOTE_NAMES[noteIdx],
    octave: 4,
    midi: 60 + noteIdx,
    freq: BASE_FREQS[noteIdx],
    duration: 0.5,
  } as MelodyNote
}

describe('PracticeEngine over a long session', () => {
  let virtualClock = 0

  beforeEach(() => {
    virtualClock = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => virtualClock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('attributes and scores fifty consecutive notes sung on pitch', async () => {
    const { audio, setTone } = syntheticAudioEngine()
    const engine = new PracticeEngine(audio)
    await engine.startMic()

    const completedNotes: string[] = []
    engine.addCallbacks({
      onNoteComplete: (result) => {
        completedNotes.push(result.item?.note?.name ?? '')
      },
    })
    engine.startSession()

    const TOTAL_NOTES = 50
    for (let i = 0; i < TOTAL_NOTES; i++) {
      const note = melodyNote(i)
      engine.onNoteStart(note, i)
      setTone(note.freq) // The singer lands the target exactly.
      for (let f = 0; f < 2; f++) {
        virtualClock += 50
        engine.update()
      }
    }
    virtualClock += 100
    engine.update()

    const noteResults: NoteResult[] = engine.endSession()
    const practiceResult = engine.calculatePracticeResult(noteResults)

    // The last note may still be open when the session ends; every other one
    // must have been completed and attributed to its own name.
    expect(completedNotes.length).toBeGreaterThanOrEqual(TOTAL_NOTES - 1)
    expect(noteResults.length).toBeGreaterThanOrEqual(TOTAL_NOTES - 1)
    completedNotes.forEach((name, i) => {
      expect(name).toBe(NOTE_NAMES[i % 7])
    })
    expect(practiceResult.score).toBeGreaterThanOrEqual(80)
    expect(scoreGrade(practiceResult.score).cls).toMatch(
      /^grade-(perfect|excellent)$/,
    )
    engine.destroy()
  }, 15000)

  it('keeps thirty start/stop cycles apart — a cycle hears only its own notes', async () => {
    const { audio, setTone } = syntheticAudioEngine()
    const engine = new PracticeEngine(audio)
    await engine.startMic()

    const CYCLES = 30
    const collectors: Array<{ notes: string[]; lengthAtEnd: number }> = []
    for (let c = 0; c < CYCLES; c++) {
      const cycleNotes: string[] = []
      const unsubscribe = engine.addCallbacks({
        onNoteComplete: (res) => cycleNotes.push(res.item?.note?.name ?? ''),
      })
      engine.startSession()
      engine.onNoteStart(melodyNote(5), 0) // A4
      setTone(440)
      virtualClock += 50
      engine.update()
      virtualClock += 50
      engine.update()

      const results = engine.endSession()
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(engine.calculateScore(results)).toBeGreaterThanOrEqual(80)
      unsubscribe()
      collectors.push({ notes: cycleNotes, lengthAtEnd: cycleNotes.length })
    }
    engine.destroy()

    // No collector heard anything after its cycle unsubscribed.
    for (const { notes, lengthAtEnd } of collectors) {
      expect(notes.length).toBe(lengthAtEnd)
    }
  })
})
