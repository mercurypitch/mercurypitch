// Live melody judge — capture-clock fairness and forward-only contour coverage.

import { describe, expect, it } from 'vitest'
import { MERC_ENCORE_JUDGE_POLICY } from '../content/encore-examples'
import { glassMelody } from '../content/melodies'
import type { PitchObservation } from '../contracts'
import type { MelodyDefinition } from './melody-contour'
import { compileMelody, sampleMelodyAtTime } from './melody-contour'
import type { MelodyJudge, MelodyJudgeEvent } from './melody-judge'
import { createMelodyJudge } from './melody-judge'

interface CaptureState {
  sequence: number
  captureSeconds: number
}

const HOP_SECONDS = 0.025

const LYRIC_EVIDENCE_POLICY = MERC_ENCORE_JUDGE_POLICY

function compiled(id: 'first-arc' | 'sunlit-steps' | 'two-windows') {
  return compileMelody(glassMelody(id), { rootMidi: 60 })
}

function shortThreeAnchorMelody() {
  const definition: MelodyDefinition = {
    id: 'short-three-anchor',
    version: 1,
    title: 'Short three anchor',
    description: 'A compact contour for anchor evidence regressions.',
    feel: {
      landingSeconds: 0.2,
      finalLandingSeconds: 0.2,
      transitionSeconds: 0.1,
      breathSeconds: 0.1,
      connection: 'glide',
    },
    phrases: [
      {
        id: 'short-phrase',
        allowBreathAfter: false,
        anchors: [
          { id: 'short-home', offsetSemitones: 0 },
          { id: 'short-middle', offsetSemitones: 2 },
          { id: 'short-final', offsetSemitones: 4 },
        ],
      },
    ],
  }
  return compileMelody(definition, { rootMidi: 60 })
}

function shortLandingMelody() {
  const definition: MelodyDefinition = {
    id: 'short-landing',
    version: 1,
    title: 'Short landing',
    description: 'A minimum-duration landing for acquisition regressions.',
    feel: {
      landingSeconds: 0.05,
      finalLandingSeconds: 0.05,
      transitionSeconds: 0.1,
      breathSeconds: 0.1,
      connection: 'glide',
    },
    phrases: [
      {
        id: 'short-landing-phrase',
        allowBreathAfter: false,
        anchors: [
          { id: 'short-landing-anchor', offsetSemitones: 0 },
          { id: 'short-landing-next', offsetSemitones: 2 },
        ],
      },
    ],
  }
  return compileMelody(definition, { rootMidi: 60 })
}

function emit(
  judge: MelodyJudge,
  state: CaptureState,
  midi: number | null,
  overrides: Partial<PitchObservation> = {},
): readonly MelodyJudgeEvent[] {
  const frame: PitchObservation = {
    sequence: state.sequence,
    captureSeconds: state.captureSeconds,
    capturedAtMs: state.captureSeconds * 1000,
    midi,
    confidence: midi === null ? 0 : 0.95,
    ...overrides,
  }
  const events = judge.feed(frame, state.captureSeconds * 1000)
  state.sequence++
  state.captureSeconds += HOP_SECONDS
  return events
}

function singPhrase(
  judge: MelodyJudge,
  melody: ReturnType<typeof compiled>,
  phraseIndex: number,
  state: CaptureState,
  pace: number,
  transform: (midi: number, elapsed: number) => number | null = (midi) => midi,
): MelodyJudgeEvent[] {
  const phrase = melody.phrases[phraseIndex]
  const events: MelodyJudgeEvent[] = []
  const maximumRealSeconds =
    (phrase.endSeconds - phrase.startSeconds) / pace + 1
  for (let elapsed = 0; elapsed <= maximumRealSeconds; elapsed += HOP_SECONDS) {
    const referenceTime = Math.min(
      phrase.endSeconds - 1e-8,
      phrase.startSeconds + elapsed * pace,
    )
    const target = sampleMelodyAtTime(melody, referenceTime).midi!
    events.push(...emit(judge, state, transform(target, elapsed)))
    const snapshot = judge.snapshot()
    if (
      snapshot.complete ||
      snapshot.phraseIndex > phraseIndex ||
      snapshot.phase === 'breath'
    )
      break
  }
  return events
}

describe('live melody judge', () => {
  it.each([0.7, 1, 1.5])(
    'accepts the full ascending and descending contour at %sx reference pace',
    (pace) => {
      const melody = compiled('first-arc')
      const judge = createMelodyJudge(melody)
      const events = singPhrase(
        judge,
        melody,
        0,
        { sequence: 0, captureSeconds: 0 },
        pace,
      )

      expect(
        events.filter((event) => event.type === 'anchor-complete'),
      ).toHaveLength(3)
      expect(events.at(-1)).toEqual({ type: 'complete' })
      expect(judge.snapshot()).toMatchObject({
        phase: 'complete',
        progress: 1,
        complete: true,
      })
    },
  )

  it('accepts pitch on the tolerance boundary across landings and glides', () => {
    const melody = compiled('first-arc')
    const judge = createMelodyJudge(melody)
    const events = singPhrase(
      judge,
      melody,
      0,
      { sequence: 0, captureSeconds: 0 },
      1,
      (midi) => midi + 0.6,
    )
    expect(events.at(-1)).toEqual({ type: 'complete' })
  })

  it('does not let a repeated tonic, a constant tone or a destination jump skip the contour', () => {
    const firstArc = compiled('first-arc')
    const constantJudge = createMelodyJudge(firstArc)
    const constantState = { sequence: 0, captureSeconds: 0 }
    const constantEvents: MelodyJudgeEvent[] = []
    for (let index = 0; index < 240; index++)
      constantEvents.push(...emit(constantJudge, constantState, 60))
    expect(constantEvents.some((event) => event.type === 'complete')).toBe(
      false,
    )
    expect(constantJudge.snapshot().complete).toBe(false)

    const steps = compiled('sunlit-steps')
    const jumpJudge = createMelodyJudge(steps)
    const jumpState = { sequence: 0, captureSeconds: 0 }
    for (let index = 0; index < 28; index++) emit(jumpJudge, jumpState, 60)
    for (let index = 0; index < 120; index++) emit(jumpJudge, jumpState, 64)
    expect(jumpJudge.snapshot().complete).toBe(false)
    expect(jumpJudge.snapshot().coveredAnchorIds).not.toContain(
      'sunlit-steps-two',
    )
  })

  it('rejects octave aliases and missing-confidence input without a loudness gate', () => {
    const melody = compiled('first-arc')
    const judge = createMelodyJudge(melody)
    const state = { sequence: 0, captureSeconds: 0 }
    for (let index = 0; index < 80; index++) emit(judge, state, 72)
    for (let index = 0; index < 80; index++)
      emit(judge, state, 60, { confidence: 0.2 })
    expect(judge.snapshot()).toMatchObject({
      progress: 0,
      complete: false,
    })
  })

  it('bridges only a bounded detector dropout and retries after a long gap', () => {
    const melody = compiled('first-arc')
    const briefJudge = createMelodyJudge(melody)
    const briefEvents = singPhrase(
      briefJudge,
      melody,
      0,
      { sequence: 0, captureSeconds: 0 },
      1,
      (midi, elapsed) => (elapsed >= 1 && elapsed < 1.125 ? null : midi),
    )
    expect(briefEvents.at(-1)).toEqual({ type: 'complete' })

    const longJudge = createMelodyJudge(melody)
    singPhrase(
      longJudge,
      melody,
      0,
      { sequence: 0, captureSeconds: 0 },
      1,
      (midi, elapsed) => (elapsed >= 1 && elapsed < 1.35 ? null : midi),
    )
    expect(longJudge.snapshot().complete).toBe(false)
    expect(longJudge.snapshot().retryCount).toBeGreaterThan(0)
  })

  it('rejects duplicate, out-of-order and stale capture evidence', () => {
    const melody = compiled('first-arc')
    const judge = createMelodyJudge(melody)
    const repeated: PitchObservation = {
      sequence: 1,
      captureSeconds: 0.025,
      capturedAtMs: 25,
      midi: 60,
      confidence: 0.95,
    }
    for (let index = 0; index < 100; index++) judge.feed(repeated, 25)
    expect(judge.snapshot().progress).toBe(0)

    expect(
      judge.feed({ ...repeated, sequence: 0, captureSeconds: 0 }, 25),
    ).toEqual([])
    const staleState = { sequence: 2, captureSeconds: 0.05 }
    for (let index = 0; index < 100; index++) {
      emit(judge, staleState, 60, {
        capturedAtMs: staleState.captureSeconds * 1000 - 500,
      })
    }
    expect(judge.snapshot().complete).toBe(false)
    expect(judge.snapshot().feedback).toBe('stale')
  })

  it('treats a phrase boundary as an optional breath and completes once', () => {
    const melody = compiled('two-windows')
    const judge = createMelodyJudge(melody)
    const state = { sequence: 0, captureSeconds: 0 }
    const firstEvents = singPhrase(judge, melody, 0, state, 1)
    expect(firstEvents).toContainEqual({
      type: 'breath',
      afterPhraseId: 'two-windows-first',
      nextPhraseId: 'two-windows-second',
    })
    expect(judge.snapshot()).toMatchObject({
      phase: 'breath',
      phraseIndex: 1,
      complete: false,
    })

    // The next phrase may begin immediately; the authored visual gap is not a
    // forced breath-duration requirement.
    const secondEvents = singPhrase(judge, melody, 1, state, 1)
    expect(
      secondEvents.filter((event) => event.type === 'complete'),
    ).toHaveLength(1)
    expect(judge.snapshot().complete).toBe(true)

    const silence = emit(judge, state, null)
    expect(silence).toEqual([])
    expect(judge.snapshot()).toMatchObject({
      phase: 'complete',
      complete: true,
    })
  })

  it('reacquires each anchor after an authored separate-note gap', () => {
    const source = glassMelody('first-arc')
    const melody = compileMelody(
      {
        ...source,
        id: 'separate-first-arc',
        feel: { ...source.feel, connection: 'separate-note' },
      },
      { rootMidi: 60 },
    )
    const judge = createMelodyJudge(melody)
    const events = singPhrase(
      judge,
      melody,
      0,
      { sequence: 0, captureSeconds: 0 },
      1,
    )

    expect(
      events.filter((event) => event.type === 'anchor-complete'),
    ).toHaveLength(3)
    expect(events.at(-1)).toEqual({ type: 'complete' })
  })

  describe('opt-in lyrical anchor evidence', () => {
    it('rejects a negative evidence requirement', () => {
      expect(() =>
        createMelodyJudge(compiled('first-arc'), {
          minimumAnchorEvidenceSeconds: -0.01,
        }),
      ).toThrow(/minimumAnchorEvidenceSeconds/)
    })

    it('bridges a consonant dropout within Encore grace after hearing every landing', () => {
      const melody = compiled('first-arc')
      const judge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const events = singPhrase(
        judge,
        melody,
        0,
        { sequence: 0, captureSeconds: 0 },
        1,
        (midi, elapsed) => (elapsed >= 0.95 && elapsed < 1.3 ? null : midi),
      )

      expect(
        events
          .filter((event) => event.type === 'anchor-complete')
          .map((event) => event.anchorId),
      ).toEqual(['first-arc-home', 'first-arc-rise', 'first-arc-return'])
      expect(events.at(-1)).toEqual({ type: 'complete' })
    })

    it('freezes contour progress while a bounded consonant is unvoiced', () => {
      const melody = compiled('first-arc')
      const judge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const state = { sequence: 0, captureSeconds: 0 }
      while (state.captureSeconds < 0.75) {
        const target = sampleMelodyAtTime(melody, state.captureSeconds).midi!
        emit(judge, state, target)
      }
      const beforeDropout = judge.snapshot()

      for (let index = 0; index < 15; index++) emit(judge, state, null)

      expect(judge.snapshot()).toMatchObject({
        progress: beforeDropout.progress,
        coveredAnchorIds: beforeDropout.coveredAnchorIds,
        retryCount: 0,
        complete: false,
      })

      emit(judge, state, beforeDropout.targetMidi)
      expect(judge.snapshot().retryCount).toBe(0)
    })

    it('keeps an interrupted acquisition inside a shorter authored landing', () => {
      const melody = shortLandingMelody()
      const judge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const state = { sequence: 0, captureSeconds: 0 }

      emit(judge, state, 60)
      emit(judge, state, 60)
      emit(judge, state, null)
      for (let index = 0; index < 4; index++) emit(judge, state, 60)

      expect(judge.snapshot()).toMatchObject({
        phase: 'following',
        retryCount: 0,
        complete: false,
      })
    })

    it('does not credit an anchor from the first voiced frame after a dropout', () => {
      const melody = shortThreeAnchorMelody()
      const judge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const state = { sequence: 0, captureSeconds: 0 }

      while (state.captureSeconds <= 0.475 + 1e-9) {
        const elapsed = state.captureSeconds
        const target = sampleMelodyAtTime(
          melody,
          Math.min(melody.phrases[0].endSeconds - 1e-8, elapsed),
        ).midi!
        emit(judge, state, elapsed >= 0.275 && elapsed < 0.475 ? null : target)
      }

      expect(judge.snapshot().coveredAnchorIds).toEqual(['short-home'])
      expect(judge.snapshot().complete).toBe(false)
    })

    it('cannot skip a wholly unheard middle or final landing', () => {
      const middleMelody = shortThreeAnchorMelody()
      const middleJudge = createMelodyJudge(middleMelody, LYRIC_EVIDENCE_POLICY)
      singPhrase(
        middleJudge,
        middleMelody,
        0,
        { sequence: 0, captureSeconds: 0 },
        1,
        (midi, elapsed) => (elapsed >= 0.275 && elapsed < 0.65 ? null : midi),
      )
      expect(middleJudge.snapshot().coveredAnchorIds).not.toContain(
        'short-middle',
      )
      expect(middleJudge.snapshot().coveredAnchorIds).not.toContain(
        'short-final',
      )
      expect(middleJudge.snapshot().complete).toBe(false)

      const finalMelody = shortThreeAnchorMelody()
      const finalJudge = createMelodyJudge(finalMelody, LYRIC_EVIDENCE_POLICY)
      const finalState = { sequence: 0, captureSeconds: 0 }
      while (finalState.captureSeconds <= 0.8 + 1e-9) {
        const elapsed = finalState.captureSeconds
        const target = sampleMelodyAtTime(
          finalMelody,
          Math.min(finalMelody.phrases[0].endSeconds - 1e-8, elapsed),
        ).midi!
        emit(
          finalJudge,
          finalState,
          elapsed >= 0.55 && elapsed < 0.775 ? null : target,
        )
      }
      expect(finalJudge.snapshot().coveredAnchorIds).toEqual([
        'short-home',
        'short-middle',
      ])
      expect(finalJudge.snapshot().complete).toBe(false)
    })

    it('keeps wrong-key and constant-note negatives incomplete', () => {
      const melody = compiled('first-arc')
      const wrongKeyJudge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const wrongKeyState = { sequence: 0, captureSeconds: 0 }
      for (let index = 0; index < 100; index++)
        emit(wrongKeyJudge, wrongKeyState, 61)
      expect(wrongKeyJudge.snapshot()).toMatchObject({
        progress: 0,
        complete: false,
      })

      const constantJudge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const constantState = { sequence: 0, captureSeconds: 0 }
      for (let index = 0; index < 240; index++)
        emit(constantJudge, constantState, 60)
      expect(constantJudge.snapshot().coveredAnchorIds).not.toContain(
        'first-arc-rise',
      )
      expect(constantJudge.snapshot().complete).toBe(false)
    })

    it('retries after silence beyond the Encore lyrical grace', () => {
      const melody = compiled('first-arc')
      const judge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const state = { sequence: 0, captureSeconds: 0 }
      while (state.captureSeconds < 0.7) {
        const target = sampleMelodyAtTime(melody, state.captureSeconds).midi!
        emit(judge, state, target)
      }
      for (let index = 0; index < 18; index++) emit(judge, state, null)

      expect(judge.snapshot().retryCount).toBeGreaterThan(0)
      expect(judge.snapshot().coveredAnchorIds).toEqual([])
      expect(judge.snapshot().complete).toBe(false)
    })

    it('gets no anchor evidence from weak, stale or duplicate frames', () => {
      const melody = shortThreeAnchorMelody()
      const judge = createMelodyJudge(melody, LYRIC_EVIDENCE_POLICY)
      const first: PitchObservation = {
        sequence: 0,
        captureSeconds: 0,
        capturedAtMs: 0,
        midi: 60,
        confidence: 0.95,
      }
      judge.feed(first, 0)
      for (let index = 0; index < 20; index++) judge.feed(first, 0)

      const state = { sequence: 1, captureSeconds: HOP_SECONDS }
      for (let index = 0; index < 8; index++)
        emit(judge, state, 60, { confidence: 0.2 })
      for (let index = 0; index < 8; index++)
        emit(judge, state, 60, {
          capturedAtMs: state.captureSeconds * 1000 - 500,
        })
      emit(judge, state, 60)

      expect(judge.snapshot()).toMatchObject({
        progress: 0,
        coveredAnchorIds: [],
        complete: false,
      })
    })
  })
})
