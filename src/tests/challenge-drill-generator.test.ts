import { describe, expect, it } from 'vitest'
import { generateChallengeDrill } from '@/features/challenges/challenge-drill-generator'

describe('generateChallengeDrill', () => {
  it('basics maps to a single-note long-note hold', () => {
    const drill = generateChallengeDrill('basics', 'Hold Your Note', 'beginner')
    expect(drill.exercise).toBe('long-note')
    expect(drill.notes).toEqual(['C4'])
    expect(drill.challengeName).toBe('Hold Your Note')
  })

  it('beginner difficulty gets the gentler note set where defined', () => {
    const beginner = generateChallengeDrill('speed', 'X', 'beginner')
    const advanced = generateChallengeDrill('speed', 'X', 'advanced')
    expect(beginner.notes).toEqual(['C4', 'E4', 'G4'])
    expect(advanced.notes.length).toBeGreaterThan(beginner.notes.length)
    expect(generateChallengeDrill('scales', 'X', 'beginner').notes).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
    ])
  })

  it('difficulty is a no-op for categories without a beginner set', () => {
    const drill = generateChallengeDrill('range', 'X', 'beginner')
    expect(drill.notes).toEqual(generateChallengeDrill('range', 'X').notes)
  })

  it('omitting difficulty keeps the full note set', () => {
    expect(generateChallengeDrill('speed', 'X').notes).toHaveLength(7)
  })
})
