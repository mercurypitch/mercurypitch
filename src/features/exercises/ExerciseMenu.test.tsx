// ============================================================
// The exercise cards the Find Your Pitch lessons point at
// ============================================================
//
// Lessons 3, 5 and 6 send singers to these drills, so each card says what
// its drill does and nothing the house rules forbid: no invitation to the
// longest hold (Lesson 3 and 5 WEB-SPECs, App content; REQ-GVC-070), no
// breath-support promise (REQ-GVC-071), and only the direction Interval
// Trainer plays (Lesson 6 FACTS 40 and 48: the second note is always above).
// Dynamic Swell is held to the same rules so that a later lesson can link
// it (Lesson 14 FACTS 58).

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import DynamicSwellExercise from './dynamic-swell/DynamicSwellExercise'
import { EXERCISE_HELP } from './exercise-help'
import ExerciseMenu from './ExerciseMenu'
import { EXERCISE_DYNAMIC_SWELL } from './types'

afterEach(cleanup)

/** A card's words and tags, found by its title. */
function card(title: string): { description: string; tags: string[] } {
  const { container } = render(() => <ExerciseMenu onSelect={() => {}} />)
  const found = [...container.querySelectorAll('.exercise-card')].find(
    (el) => el.querySelector('h3')?.firstChild?.textContent === title,
  )
  const result = {
    description: found?.querySelector('p')?.textContent ?? '',
    tags: [...(found?.querySelectorAll('.exercise-card-tags span') ?? [])].map(
      (tag) => tag.textContent ?? '',
    ),
  }
  cleanup()
  return result
}

/** What Dynamic Swell's idle screen says before a run starts. */
function swellIdleCopy(): string {
  const { container } = render(() => (
    <DynamicSwellExercise
      audioEngine={{ stopTone: () => {} } as never}
      practiceEngine={{ isMicActive: () => false, stopMic: () => {} } as never}
      onBack={() => {}}
    />
  ))
  const copy =
    container.querySelector('.exercise-idle-placeholder p')?.textContent ?? ''
  cleanup()
  return copy
}

describe('the exercise cards', () => {
  it('offers Long Note as one comfortable note, held for a chosen length', () => {
    expect(card('Long Note')).toEqual({
      description:
        'Hold one comfortable note, steady, for a length you choose.',
      tags: ['Stability', 'Steady Note'],
    })
  })

  it('offers Pitch Hold for a chosen length, not the longest one', () => {
    expect(card('Pitch Hold')).toEqual({
      description:
        'Keep your pitch inside a shrinking target zone, for a length you choose.',
      tags: ['Precision'],
    })
  })

  it('says Interval Trainer sings above the reference note, as it plays', () => {
    expect(card('Interval Trainer').description).toBe(
      'Sing specific intervals above a reference note. Train your ear to internalize musical distances.',
    )
  })

  it('says what Dynamic Swell does and what its score measures, and no more', () => {
    const swell = card('Dynamic Swell')
    // Its score is how near the held note stays to the target, in cents,
    // and the swell's width in decibels (swell-dynamics.ts); it measures
    // nothing of the breath.
    expect(swell).toEqual({
      description:
        'Hold a note and swell it soft to loud and back. Scored on staying in tune and how wide the swell is.',
      tags: ['Dynamics', 'Intonation'],
    })
    // Its idle screen and its help say the same.
    const idle = swellIdleCopy()
    expect(idle).toBe(
      'Hold a note and swell your volume from soft to loud and back. Scored on staying in tune and how wide the swell is.',
    )
    const help = EXERCISE_HELP[EXERCISE_DYNAMIC_SWELL]
    const words = [
      swell.description,
      ...swell.tags,
      idle,
      help.summary,
      ...help.body,
    ]
    expect(words.filter((text) => /breath|master/iu.test(text))).toEqual([])
    expect(
      words.flatMap(
        (text) =>
          validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
      ),
    ).toEqual([])
  })

  it('makes no claim on the two hold cards that the claims rules forbid', () => {
    const holds = [card('Long Note'), card('Pitch Hold')]
    const words = holds.flatMap((hold) => [hold.description, ...hold.tags])

    expect(
      words.filter((text) =>
        /as long as|how long|locked in|endurance|breath/iu.test(text),
      ),
    ).toEqual([])
    expect(
      words.flatMap(
        (text) =>
          validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
      ),
    ).toEqual([])
  })
})
