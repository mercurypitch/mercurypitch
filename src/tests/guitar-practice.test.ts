// ============================================================
// Guitar Practice Tests — state modules unit tests
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCallResponse } from '@/features/guitar-practice/CallResponseState'
import { createEarTraining } from '@/features/guitar-practice/EarTrainingPanel'
// Force ESM to resolve the TSX module by importing the actual functions
// (Vitest uses vite which handles TSX natively)
import { createNoteLocatorQuiz } from '@/features/guitar-practice/NoteLocatorQuiz'
import type { AudioEngine } from '@/lib/audio-engine'

// ---------------------------------------------------------------------------
// Minimal AudioEngine mock
// ---------------------------------------------------------------------------
function mockAudioEngine(): AudioEngine {
  return {
    playTone: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    stopTone: vi.fn(),
    playGuitarNote: vi.fn(),
    playDrumSound: vi.fn(),
    startDrumLoop: vi.fn(),
    stopDrumLoop: vi.fn(),
    setDrumPattern: vi.fn(),
    setTempo: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    setVolume: vi.fn(),
    suspend: vi.fn(),
    close: vi.fn(),
    getAudioContext: vi.fn(() => null),
    isReady: vi.fn(() => false),
  } as unknown as AudioEngine
}

// ============================================================
// NoteLocatorQuiz
// ============================================================
describe('NoteLocatorQuiz', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with round inactive', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      expect(quiz.roundActive()).toBe(false)
      expect(quiz.targetMidiClass()).toBe(0)
      expect(quiz.foundMidis().size).toBe(0)
      expect(quiz.score()).toBe(0)
      expect(quiz.timeLeft()).toBe(30)
      dispose()
    }))

  it('starts a round with a target between 0 and 11', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      expect(quiz.roundActive()).toBe(true)
      expect(quiz.foundMidis().size).toBe(0)
      expect(quiz.timeLeft()).toBe(30)
      const target = quiz.targetMidiClass()
      expect(target).toBeGreaterThanOrEqual(0)
      expect(target).toBeLessThan(12)
      dispose()
    }))

  it('handles a correct note and increments score by 10', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      // Any MIDI number whose mod-12 equals the target is valid.
      // The target itself (0-11) is a perfectly valid MIDI.
      const validNote = quiz.targetMidiClass()
      const result = quiz.handleNotePlayed(validNote)
      expect(result).toBe(true)
      expect(quiz.score()).toBe(10)
      expect(quiz.foundMidis().has(validNote)).toBe(true)
      dispose()
    }))

  it('rejects a note with a different pitch class', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      const target = quiz.targetMidiClass()
      // A note that's guaranteed a different pitch class
      const wrongNote = (target + 1) % 12
      const result = quiz.handleNotePlayed(wrongNote)
      expect(result).toBe(false)
      expect(quiz.score()).toBe(0)
      dispose()
    }))

  it('rejects a duplicate note (same MIDI)', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      const validNote = quiz.targetMidiClass()

      quiz.handleNotePlayed(validNote) // first time: ok
      const result = quiz.handleNotePlayed(validNote) // duplicate
      expect(result).toBe(false)
      expect(quiz.score()).toBe(10) // score unchanged
      dispose()
    }))

  it('rejects any note when round is not active', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      const result = quiz.handleNotePlayed(45)
      expect(result).toBe(false)
      expect(quiz.roundActive()).toBe(false)
      dispose()
    }))

  it('timer counts down from 30', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      expect(quiz.timeLeft()).toBe(30)

      vi.advanceTimersByTime(5000)
      expect(quiz.timeLeft()).toBe(25)

      vi.advanceTimersByTime(3000)
      expect(quiz.timeLeft()).toBe(22)
      dispose()
    }))

  it('auto-ends round when timer reaches 0', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      expect(quiz.roundActive()).toBe(true)

      vi.advanceTimersByTime(30000)
      expect(quiz.timeLeft()).toBe(0)
      expect(quiz.roundActive()).toBe(false)
      dispose()
    }))

  it('awards 100 bonus when all unique MIDI positions are found', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()
      quiz.startRound()
      const target = quiz.targetMidiClass()

      // Enumerate all unique MIDI values on the guitar that match the target
      const openMidi = [40, 45, 50, 55, 59, 64]
      const seen = new Set<number>()
      for (let s = 0; s < 6; s++)
        for (let f = 0; f <= 15; f++) {
          const midi = openMidi[s] + f
          if (midi % 12 === target) seen.add(midi)
        }
      const uniqueNotes = [...seen]

      // Play all but the last matching note
      for (let i = 0; i < uniqueNotes.length - 1; i++) {
        quiz.handleNotePlayed(uniqueNotes[i])
      }
      expect(quiz.roundActive()).toBe(true)

      // Play the last one — should trigger endRound with bonus
      quiz.handleNotePlayed(uniqueNotes[uniqueNotes.length - 1])
      expect(quiz.roundActive()).toBe(false)
      // Score = 10 per find + 100 bonus
      expect(quiz.score()).toBe(uniqueNotes.length * 10 + 100)
      dispose()
    }))

  it('accumulates score across multiple rounds', () =>
    createRoot((dispose) => {
      const quiz = createNoteLocatorQuiz()

      // Play 3 rounds with 1 correct answer each, letting timer expire
      for (let r = 0; r < 3; r++) {
        quiz.startRound()
        const validNote = quiz.targetMidiClass()
        quiz.handleNotePlayed(validNote)
        vi.advanceTimersByTime(30000) // expire round
      }

      // 3 rounds x 10 points each = 30
      expect(quiz.score()).toBe(30)
      dispose()
    }))
})

// ============================================================
// EarTraining
// ============================================================
describe('EarTraining', () => {
  let audio: AudioEngine

  beforeEach(() => {
    vi.useFakeTimers()
    audio = mockAudioEngine()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with null target and no feedback', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      expect(ear.targetMidi()).toBeNull()
      expect(ear.feedback()).toBeNull()
      expect(ear.streak()).toBe(0)
      expect(ear.accuracy()).toBe(0)
      expect(ear.difficulty()).toBe('easy')
      dispose()
    }))

  it('playNewNote generates a valid target MIDI on the fretboard', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.playNewNote()
      const target = ear.targetMidi()
      expect(target).not.toBeNull()
      expect(target!).toBeGreaterThanOrEqual(40)
      expect(target!).toBeLessThanOrEqual(79) // 64 + 15
      expect(audio.playTone).toHaveBeenCalled()
      dispose()
    }))

  it('easy difficulty restricts to frets 0-3', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.setDifficulty('easy')

      for (let i = 0; i < 50; i++) {
        ear.playNewNote()
        const target = ear.targetMidi()!
        const openMidi = [40, 45, 50, 55, 59, 64]
        const valid = openMidi.some(
          (open) => target >= open && target <= open + 3,
        )
        expect(valid).toBe(true)
      }
      dispose()
    }))

  it('medium difficulty restricts to frets 0-7', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.setDifficulty('medium')

      for (let i = 0; i < 50; i++) {
        ear.playNewNote()
        const target = ear.targetMidi()!
        const openMidi = [40, 45, 50, 55, 59, 64]
        const valid = openMidi.some(
          (open) => target >= open && target <= open + 7,
        )
        expect(valid).toBe(true)
      }
      dispose()
    }))

  it('hard difficulty restricts to frets 0-15', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.setDifficulty('hard')

      for (let i = 0; i < 50; i++) {
        ear.playNewNote()
        const target = ear.targetMidi()!
        const openMidi = [40, 45, 50, 55, 59, 64]
        const valid = openMidi.some(
          (open) => target >= open && target <= open + 15,
        )
        expect(valid).toBe(true)
      }
      dispose()
    }))

  it('handleNotePlayed marks correct match and increases streak', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.playNewNote()
      const target = ear.targetMidi()!
      ;(audio.playTone as ReturnType<typeof vi.fn>).mockClear()

      const result = ear.handleNotePlayed(target)
      expect(result).toBe(true)
      expect(ear.feedback()).toBe('correct')
      expect(ear.streak()).toBe(1)
      expect(ear.accuracy()).toBe(1)
      dispose()
    }))

  it('handleNotePlayed marks wrong match and resets streak', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.playNewNote()
      const target = ear.targetMidi()!

      const wrongMidi = target! + 2
      const result = ear.handleNotePlayed(wrongMidi)
      expect(result).toBe(false)
      expect(ear.feedback()).toBe('wrong')
      expect(ear.streak()).toBe(0)
      expect(ear.accuracy()).toBe(0)
      dispose()
    }))

  it('accuracy tracks multiple attempts', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      // Correct
      ear.playNewNote()
      ear.handleNotePlayed(ear.targetMidi()!)
      // Wrong
      ear.playNewNote()
      ear.handleNotePlayed(ear.targetMidi()! + 1)
      // Correct
      ear.playNewNote()
      ear.handleNotePlayed(ear.targetMidi()!)

      expect(ear.accuracy()).toBeCloseTo(2 / 3)
      dispose()
    }))

  it('streak accumulates on consecutive correct answers', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      for (let i = 0; i < 3; i++) {
        ear.playNewNote()
        ear.handleNotePlayed(ear.targetMidi()!)
      }
      expect(ear.streak()).toBe(3)
      dispose()
    }))

  it('plays new note automatically after feedback delay', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      ear.playNewNote()
      const firstTarget = ear.targetMidi()

      ear.handleNotePlayed(firstTarget!)
      ;(audio.playTone as ReturnType<typeof vi.fn>).mockClear()

      vi.advanceTimersByTime(1300)
      expect(audio.playTone).toHaveBeenCalled()
      expect(ear.targetMidi()).not.toBeNull()
      dispose()
    }))

  it('handleNotePlayed returns false when target is null', () =>
    createRoot((dispose) => {
      const ear = createEarTraining(audio)
      const result = ear.handleNotePlayed(45)
      expect(result).toBe(false)
      expect(ear.accuracy()).toBe(0)
      dispose()
    }))
})

// ============================================================
// CallResponse
// ============================================================
describe('CallResponseState', () => {
  let audio: AudioEngine

  beforeEach(() => {
    vi.useFakeTimers()
    audio = mockAudioEngine()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const key = () => 'C'
  const scale = () => 'major'

  it('starts with idle phase', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      expect(cr.phase()).toBe('idle')
      expect(cr.callNotes()).toEqual([])
      expect(cr.responseNotes()).toEqual([])
      expect(cr.userEchoNotes()).toEqual([])
      expect(cr.totalScore()).toBe(0)
      dispose()
    }))

  it('startRound generates call notes and sets callPlaying phase', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()

      expect(cr.phase()).toBe('callPlaying')
      expect(cr.callNotes().length).toBeGreaterThanOrEqual(3)
      expect(cr.callNotes().length).toBeLessThanOrEqual(5)
      expect(cr.echoResults()).toEqual(
        new Array(cr.callNotes().length).fill('pending'),
      )
      dispose()
    }))

  it('transitions callPlaying → callEcho after playback', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      expect(cr.phase()).toBe('callPlaying')

      vi.advanceTimersByTime(3000)
      expect(cr.phase()).toBe('callEcho')
      dispose()
    }))

  it('echo: correct answer awards 10 points', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      expect(cr.phase()).toBe('callEcho')

      const call = cr.callNotes()
      const result = cr.handleNotePlayed(call[0])
      expect(result).toBe(true)
      expect(cr.totalScore()).toBe(10)
      expect(cr.echoResults()[0]).toBe('correct')
      dispose()
    }))

  it('echo: wrong answer gives 0 points', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)

      const call = cr.callNotes()
      // A note with different pitch class from call[0]
      const wrongNote =
        (call[0] + 1) % 12 === call[0] % 12 ? call[0] + 2 : call[0] + 1
      const scoreBefore = cr.totalScore()
      const result = cr.handleNotePlayed(wrongNote)
      expect(result).toBe(false)
      expect(cr.totalScore()).toBe(scoreBefore)
      expect(cr.echoResults()[0]).toBe('wrong')
      dispose()
    }))

  it('perfect echo (all correct) awards bonus 30', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)

      const call = cr.callNotes()
      for (let i = 0; i < call.length; i++) {
        cr.handleNotePlayed(call[i])
      }

      expect(cr.totalScore()).toBe(call.length * 10 + 30)
      dispose()
    }))

  it('finishEcho → responsePlaying → responseImprov', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      cr.finishEcho()

      expect(cr.phase()).toBe('responsePlaying')
      const respLen = cr.responseNotes().length
      vi.advanceTimersByTime(respLen * 500 + 300)
      expect(cr.phase()).toBe('responseImprov')
      dispose()
    }))

  it('improv: in-scale notes award 5 points', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      cr.finishEcho()
      const respLen = cr.responseNotes().length
      vi.advanceTimersByTime(respLen * 500 + 300)
      expect(cr.phase()).toBe('responseImprov')

      const scoreBefore = cr.totalScore()
      // C4 (MIDI 60) — C major degree 0, always in scale
      cr.handleNotePlayed(60)
      expect(cr.totalScore()).toBe(scoreBefore + 5)
      expect(cr.improvScore()).toBe(5)

      // C#4 (MIDI 61) — degree 1, not in C major
      cr.handleNotePlayed(61)
      expect(cr.totalScore()).toBe(scoreBefore + 5) // unchanged
      expect(cr.improvScore()).toBe(5) // unchanged
      dispose()
    }))

  it('finishImprov adds bonus when enough improv notes played', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      cr.finishEcho()
      const respLen = cr.responseNotes().length
      vi.advanceTimersByTime(respLen * 500 + 300)

      for (let i = 0; i < respLen; i++) {
        cr.handleNotePlayed(60) // C4 — always in C major
      }

      const scoreBefore = cr.totalScore()
      cr.finishImprov()
      expect(cr.totalScore()).toBe(scoreBefore + 20)
      expect(cr.phase()).toBe('feedback')
      dispose()
    }))

  it('finishImprov no bonus when too few improv notes', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      cr.finishEcho()
      const respLen = cr.responseNotes().length
      vi.advanceTimersByTime(respLen * 500 + 300)

      const scoreBefore = cr.totalScore()
      cr.finishImprov()
      expect(cr.totalScore()).toBe(scoreBefore)
      dispose()
    }))

  it('feedback phase transitions to next round after 2.5s', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      cr.finishEcho()
      const respLen = cr.responseNotes().length
      vi.advanceTimersByTime(respLen * 500 + 300)
      cr.finishImprov()

      expect(cr.phase()).toBe('feedback')
      vi.advanceTimersByTime(2600)
      expect(cr.phase()).toBe('callPlaying')
      dispose()
    }))

  it('skipRound sets all echo results to wrong', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      cr.startRound()
      vi.advanceTimersByTime(3000)
      cr.skipRound()

      expect(cr.phase()).toBe('feedback')
      expect(cr.echoResults().every((r) => r === 'wrong')).toBe(true)
      dispose()
    }))

  it('handleNotePlayed is ignored in non-capture phases', () =>
    createRoot((dispose) => {
      const cr = createCallResponse(audio, key, scale)
      // Phase is 'idle' — no round started
      const result = cr.handleNotePlayed(60)
      expect(result).toBe(false)
      expect(cr.totalScore()).toBe(0)
      dispose()
    }))
})
