// Guitar Learn activity tests protect tuning truth and deliberate progress.
// ============================================================

import { describe, expect, it } from 'vitest'
import { instrumentTuningFromSource, standardTuning, } from '@/lib/guitar/instrument-tuning'
import { createEchoPhrase, createEchoPhraseState, createHearFindRound, createHearFindState, createShapeWalk, learnNeckPositions, reduceEchoPhrase, reduceHearFind, } from './learn-activities'

describe('Hear & Find', () => {
  it('uses the sounding active tuning and accepts any physical unison', () => {
    const tuning = instrumentTuningFromSource(
      'guitar',
      standardTuning('guitar').openMidi,
      { capo: 2 },
    )!
    const positions = learnNeckPositions(tuning, {
      firstFret: 0,
      lastFret: 5,
    })
    expect(positions[0]?.midi).toBe(66)

    const round = createHearFindRound(tuning, 'first-position', 3)
    const accepted = positions.filter(
      (position) => position.midi === round.targetMidi,
    )
    expect(accepted.length).toBeGreaterThan(0)
    expect(
      accepted.every((position) => round.acceptedPositionIds.has(position.id)),
    ).toBe(true)
  })

  it('requires the explicit reference action before judging an answer', () => {
    const round = createHearFindRound(standardTuning('guitar'))
    const position = round.positions[0]!
    const early = reduceHearFind(createHearFindState(round), {
      type: 'answer',
      heardMidi: position.midi,
      positionId: position.id,
    })
    expect(early.phase).toBe('ready')
    expect(early.lastAttempt?.outcome).toBe('hear-first')

    const answering = reduceHearFind(early, { type: 'reference-played' })
    const correct = reduceHearFind(answering, {
      type: 'answer',
      heardMidi: round.targetMidi,
      positionId: [...round.acceptedPositionIds][0],
    })
    expect(correct.phase).toBe('complete')
  })
})

describe('Echo a Phrase', () => {
  it('builds a bounded three-to-five note phrase on the active neck', () => {
    const tuning = standardTuning('bass', 5)
    const phrase = createEchoPhrase(tuning, {
      rootPitchClass: 2,
      length: 8,
      phraseIndex: 1,
    })

    expect(phrase.length).toBe(5)
    expect(phrase.notes).toHaveLength(5)
    expect(
      phrase.notes.every((note) =>
        phrase.positions.some((position) => position.midi === note.midi),
      ),
    ).toBe(true)
  })

  it('pauses on one wrong note until the player requests its repair', () => {
    const phrase = createEchoPhrase(standardTuning('guitar'))
    const ready = createEchoPhraseState(phrase)
    const answering = reduceEchoPhrase(ready, { type: 'phrase-played' })
    const wrong = reduceEchoPhrase(answering, {
      type: 'answer',
      pitchClass: (phrase.notes[0]!.pitchClass + 1) % 12,
    })

    expect(wrong.phase).toBe('repair')
    expect(wrong.currentIndex).toBe(0)
    const repaired = reduceEchoPhrase(wrong, { type: 'repair-played' })
    expect(repaired.phase).toBe('answering')
    expect(repaired.currentIndex).toBe(0)
  })
})

describe('Shape Walk', () => {
  it('adopts a compatible active tuning and labels chord roles', () => {
    const walk = createShapeWalk(standardTuning('guitar'), 7, 'E')

    expect(walk.compatible).toBe(true)
    expect(walk.rootName).toBe('G')
    expect(walk.notes.some((note) => note.role === 'root')).toBe(true)
    expect(walk.notes.some((note) => note.role === '3rd')).toBe(true)
    expect(walk.notes.some((note) => note.role === '5th')).toBe(true)
  })

  it('is honestly unavailable for bass and changed string intervals', () => {
    const bass = createShapeWalk(standardTuning('bass'), 0, 'C')
    const dropD = instrumentTuningFromSource(
      'guitar',
      [64, 59, 55, 50, 45, 38],
    )!

    expect(bass.compatible).toBe(false)
    expect(createShapeWalk(dropD, 0, 'C').compatible).toBe(false)
  })
})
