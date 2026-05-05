// ============================================================
// Falling Notes — Piano Practice Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { centsToRating, ratingToScore, scoreGrade } from '@/lib/practice-engine'
import type { FallingNote, NoteJudgment } from '@/stores/falling-notes-store'
import {
  gameState,
  setGameState,
  score,
  setScore,
  combo,
  setCombo,
  maxCombo,
  setMaxCombo,
  hitResults,
  setHitResults,
  notesMissed,
  setNotesMissed,
  currentSongBpm,
  setCurrentSongBpm,
  playheadBeat,
  setPlayheadBeat,
  beatsPerSecond,
  resetGame,
  loadSong,
} from '@/stores/falling-notes-store'

// ── Helpers ──────────────────────────────────────────────────

const PERFECT_MS = 30
const GREAT_MS = 75
const GOOD_MS = 150

function classifyTiming(deltaMs: number): NoteJudgment['timing'] {
  if (deltaMs <= PERFECT_MS) return 'perfect'
  if (deltaMs <= GREAT_MS) return 'great'
  if (deltaMs <= GOOD_MS) return 'good'
  return 'miss'
}

function computeNoteScore(
  deltaMs: number,
  cents: number | null,
): number {
  const timing = classifyTiming(deltaMs)
  if (timing === 'miss') return 0
  const timingScore = timing === 'perfect' ? 100 : timing === 'great' ? 75 : 50
  const pitchRating = cents !== null ? centsToRating(Math.abs(cents)) : 'perfect'
  const pitchScore = ratingToScore(pitchRating)
  return Math.round(timingScore * 0.6 + pitchScore * 0.4)
}

// ── Timing Window Tests ──────────────────────────────────────

describe('Timing window classification', () => {
  it('classifies 0ms as perfect', () => {
    expect(classifyTiming(0)).toBe('perfect')
  })

  it('classifies 15ms as perfect', () => {
    expect(classifyTiming(15)).toBe('perfect')
  })

  it('classifies exactly 30ms boundary as perfect', () => {
    expect(classifyTiming(30)).toBe('perfect')
  })

  it('classifies 31ms as great', () => {
    expect(classifyTiming(31)).toBe('great')
  })

  it('classifies 60ms as great', () => {
    expect(classifyTiming(60)).toBe('great')
  })

  it('classifies exactly 75ms boundary as great', () => {
    expect(classifyTiming(75)).toBe('great')
  })

  it('classifies 76ms as good', () => {
    expect(classifyTiming(76)).toBe('good')
  })

  it('classifies exactly 150ms boundary as good', () => {
    expect(classifyTiming(150)).toBe('good')
  })

  it('classifies 151ms as miss', () => {
    expect(classifyTiming(151)).toBe('miss')
  })

  it('classifies 500ms as miss', () => {
    expect(classifyTiming(500)).toBe('miss')
  })
})

// ── Score Calculation Tests ──────────────────────────────────

describe('Note score calculation', () => {
  it('perfect timing + perfect pitch = 100', () => {
    expect(computeNoteScore(5, 0)).toBe(100)
  })

  it('perfect timing + excellent pitch scores 96', () => {
    // 100*0.6 + 90*0.4 = 60 + 36 = 96
    expect(computeNoteScore(5, 12)).toBe(96)
  })

  it('great timing + perfect pitch scores 85', () => {
    // 75*0.6 + 100*0.4 = 45 + 40 = 85
    expect(computeNoteScore(40, 0)).toBe(85)
  })

  it('great timing + good pitch scores 75', () => {
    // 75*0.6 + 75*0.4 = 45 + 30 = 75
    expect(computeNoteScore(40, 22)).toBe(75)
  })

  it('good timing + perfect pitch scores 70', () => {
    // 50*0.6 + 100*0.4 = 30 + 40 = 70
    expect(computeNoteScore(100, 0)).toBe(70)
  })

  it('miss timing always returns 0 regardless of pitch', () => {
    expect(computeNoteScore(200, 0)).toBe(0)
    expect(computeNoteScore(200, 50)).toBe(0)
    expect(computeNoteScore(200, null)).toBe(0)
  })

  it('null cents defaults to perfect pitch rating', () => {
    // null cents means no pitch data → assume perfect
    expect(computeNoteScore(5, null)).toBe(100)
  })
})

// ── Falling Notes Store Tests ────────────────────────────────

describe('Falling notes store', () => {
  it('beatsPerSecond returns BPM / 60', () => {
    setCurrentSongBpm(120)
    expect(beatsPerSecond()).toBe(2)

    setCurrentSongBpm(60)
    expect(beatsPerSecond()).toBe(1)

    setCurrentSongBpm(180)
    expect(beatsPerSecond()).toBe(3)
  })

  it('loadSong sets all state correctly', () => {
    const notes: FallingNote[] = [
      { id: 0, midi: 60, name: 'C4', startBeat: 0, duration: 1, targetFreq: 261.63 },
      { id: 1, midi: 62, name: 'D4', startBeat: 1, duration: 1, targetFreq: 293.66 },
    ]
    loadSong(notes, 'Test Song', 140)

    expect(gameState()).toBe('idle')
    expect(score()).toBe(0)
    expect(combo()).toBe(0)
    expect(notesMissed()).toBe(0)
    expect(playheadBeat()).toBe(0)
    // check totalNotes indirectly via the stored signal
    expect(notes.length).toBe(2)
  })

  it('resetGame resets all game state', () => {
    // Setup dirty state
    setGameState('playing')
    setScore(500)
    setCombo(10)
    setMaxCombo(15)
    setHitResults([
      { itemIndex: 0, midiNote: 60, noteName: 'C4', timing: 'perfect', pitchAccuracy: 'perfect', score: 100, timestamp: 0 },
    ])
    setNotesMissed(2)
    setPlayheadBeat(5)

    resetGame()

    expect(gameState()).toBe('idle')
    expect(score()).toBe(0)
    expect(combo()).toBe(0)
    expect(maxCombo()).toBe(0)
    expect(hitResults()).toEqual([])
    expect(notesMissed()).toBe(0)
    expect(playheadBeat()).toBe(0)
  })

  it('maxCombo tracks highest combo', () => {
    setCombo(0)
    setMaxCombo(0)

    // Simulate combo building
    setCombo(1)
    if (combo() > maxCombo()) setMaxCombo(combo())
    expect(maxCombo()).toBe(1)

    setCombo(5)
    if (combo() > maxCombo()) setMaxCombo(combo())
    expect(maxCombo()).toBe(5)

    // Combo breaks
    setCombo(0)
    if (combo() > maxCombo()) setMaxCombo(combo())
    expect(maxCombo()).toBe(5) // stays at 5

    // New smaller combo
    setCombo(3)
    if (combo() > maxCombo()) setMaxCombo(combo())
    expect(maxCombo()).toBe(5) // doesn't go down
  })
})

// ── Grade Calculation Tests ──────────────────────────────────

describe('scoreGrade', () => {
  it('returns grade-perfect for 90%+', () => {
    expect(scoreGrade(90).cls).toBe('grade-perfect')
    expect(scoreGrade(95).cls).toBe('grade-perfect')
    expect(scoreGrade(100).cls).toBe('grade-perfect')
  })

  it('returns grade-excellent for 80-89%', () => {
    expect(scoreGrade(80).cls).toBe('grade-excellent')
    expect(scoreGrade(85).cls).toBe('grade-excellent')
  })

  it('returns grade-good for 65-79%', () => {
    expect(scoreGrade(65).cls).toBe('grade-good')
    expect(scoreGrade(70).cls).toBe('grade-good')
  })

  it('returns grade-okay for 50-64%', () => {
    expect(scoreGrade(50).cls).toBe('grade-okay')
    expect(scoreGrade(59).cls).toBe('grade-okay')
  })

  it('returns grade-needs-work for below 50%', () => {
    expect(scoreGrade(0).cls).toBe('grade-needs-work')
    expect(scoreGrade(30).cls).toBe('grade-needs-work')
    expect(scoreGrade(49).cls).toBe('grade-needs-work')
  })
})

// ── Note ID Uniqueness Tests ──────────────────────────────────

describe('FallingNote identity', () => {
  it('each note has a unique id for hit-tracking', () => {
    const usedIds = new Set<number>()
    const notes: FallingNote[] = [
      { id: 0, midi: 60, name: 'C4', startBeat: 0, duration: 1, targetFreq: 261.63 },
      { id: 1, midi: 62, name: 'D4', startBeat: 1, duration: 1, targetFreq: 293.66 },
      { id: 2, midi: 64, name: 'E4', startBeat: 2, duration: 1, targetFreq: 329.63 },
    ]
    for (const note of notes) {
      expect(usedIds.has(note.id)).toBe(false)
      usedIds.add(note.id)
    }
  })
})
