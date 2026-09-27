// Echo Curator session checks — only current, judged contours may advance the friendly audition.

import { describe, expect, it, vi } from 'vitest'
import { ECHO_CURATOR_AUDITION } from '../content/echo-curator'
import { glassMelody } from '../content/melodies'
import { compileMelody } from '../core/melody-contour'
import { createEchoCuratorSession } from './echo-curator-session'
import type { MelodyPracticeSnapshot } from './melody-practice'

function practice(
  melodyId: 'first-arc' | 'sunlit-steps' | 'gallery-arch',
  complete = true,
): MelodyPracticeSnapshot {
  return {
    mode: complete ? 'complete' : 'singing',
    contour: compileMelody(glassMelody(melodyId), { rootMidi: 58 }),
    rootMidi: 58,
    pace: 1,
    transposeSemitones: 0,
    pitch: null,
    referenceTimeSeconds: 0,
    judge: complete
      ? {
          phase: 'complete',
          feedback: 'complete',
          progress: 1,
          targetMidi: 58,
          currentPhraseId: `${melodyId}-phrase`,
          pitchErrorCents: null,
          coveredAnchorIds: [],
          completedPhraseIds: [],
          phraseIndex: 0,
          phraseCount: 1,
          retryCount: 0,
          complete: true,
        }
      : null,
    message: '',
    hint: '',
    error: null,
    microphoneIssue: null,
    microphoneRecoveryPending: false,
  }
}

describe('Echo Curator session', () => {
  it('rejects configurable sets that drift from unique 3→5→7 rounds', () => {
    expect(() =>
      createEchoCuratorSession(
        {
          ...ECHO_CURATOR_AUDITION,
          rounds: [
            ECHO_CURATOR_AUDITION.rounds[0],
            ECHO_CURATOR_AUDITION.rounds[1],
            {
              ...ECHO_CURATOR_AUDITION.rounds[2],
              melodyId: 'two-windows',
            },
          ],
        },
        () => undefined,
      ),
    ).toThrow('3, 5, then 7')
    expect(() =>
      createEchoCuratorSession(
        {
          ...ECHO_CURATOR_AUDITION,
          rounds: [
            ECHO_CURATOR_AUDITION.rounds[0],
            ECHO_CURATOR_AUDITION.rounds[1],
            {
              ...ECHO_CURATOR_AUDITION.rounds[2],
              id: ECHO_CURATOR_AUDITION.rounds[1].id,
            },
          ],
        },
        () => undefined,
      ),
    ).toThrow('unique')
  })

  it('requires an explicit start and accepts the authored 3→5→7 sequence', () => {
    const changed = vi.fn()
    const session = createEchoCuratorSession(ECHO_CURATOR_AUDITION, changed)

    expect(session.snapshot()).toMatchObject({
      phase: 'intro',
      completedRoundIds: [],
    })
    session.begin()

    for (const [index, melodyId] of (
      ['first-arc', 'sunlit-steps', 'gallery-arch'] as const
    ).entries()) {
      const token = session.snapshot().roundToken!
      expect(session.acceptCompletion(token, practice(melodyId))).toBe(true)
      expect(session.snapshot().completedRoundIds).toHaveLength(index + 1)
      session.advance()
    }

    expect(session.snapshot()).toMatchObject({
      phase: 'complete',
      completedRoundIds: [
        'echo-curator-small-arc',
        'echo-curator-sunlit-steps',
        'echo-curator-gallery-arch',
      ],
    })
  })

  it('ignores setup, reference, incomplete, wrong-shape and stale results', () => {
    const session = createEchoCuratorSession(
      ECHO_CURATOR_AUDITION,
      () => undefined,
    )
    session.begin()
    const stale = session.snapshot().roundToken!

    for (const mode of [
      'permission',
      'calibrating',
      'reference',
      'paused',
    ] as const)
      expect(
        session.acceptCompletion(stale, {
          ...practice('first-arc'),
          mode,
        }),
      ).toBe(false)
    expect(session.acceptCompletion(stale, practice('first-arc', false))).toBe(
      false,
    )
    expect(session.acceptCompletion(stale, practice('sunlit-steps'))).toBe(
      false,
    )

    session.retryRound()
    expect(session.snapshot().roundToken).not.toBe(stale)
    expect(session.acceptCompletion(stale, practice('first-arc'))).toBe(false)
    expect(
      session.acceptCompletion(
        session.snapshot().roundToken!,
        practice('first-arc'),
      ),
    ).toBe(true)
  })

  it('resets locally without campaign progress or reward inputs', () => {
    const session = createEchoCuratorSession(
      ECHO_CURATOR_AUDITION,
      () => undefined,
    )
    session.begin()
    session.acceptCompletion(
      session.snapshot().roundToken!,
      practice('first-arc'),
    )
    session.reset()

    expect(session.snapshot()).toMatchObject({
      phase: 'intro',
      roundIndex: 0,
      roundToken: null,
      completedRoundIds: [],
    })
  })
})
