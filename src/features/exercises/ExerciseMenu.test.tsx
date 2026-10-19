// ============================================================
// The exercise cards the Find Your Pitch lessons point at
// ============================================================
//
// Lessons 3, 5 and 6 send singers to these drills, so each card says what
// its drill does and nothing the house rules forbid: no invitation to the
// longest hold (Lesson 3 and 5 WEB-SPECs, App content; REQ-GVC-070), no
// breath-support promise (REQ-GVC-071), and only the direction Interval
// Trainer plays (Lesson 6 FACTS 40 and 48: the second note is always above).

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import ExerciseMenu from './ExerciseMenu'

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
