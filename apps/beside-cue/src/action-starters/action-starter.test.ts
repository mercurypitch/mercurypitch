// ============================================================
// Local action starter tests — durable lookup and safe fallback behavior
// ============================================================

import { describe, expect, it } from 'vitest'
import { findActionDefinition } from '@/content/actions'
import { resolveLocalActionStarter } from './action-starter'

describe('resolveLocalActionStarter', () => {
  it.each([
    ['bside.open-window-pause', 2],
    ['bside.quiet-work', 2],
    ['bside.step-outside', 3],
    ['bside.checkout-pause', 5],
  ] as const)(
    'resolves %s to its authored %i-minute timer while preserving saved copy',
    (actionId, durationMinutes) => {
      const instruction = `Saved copy for ${actionId}`

      expect(
        resolveLocalActionStarter({
          bSideSuggestionId: actionId,
          bSideText: instruction,
        }),
      ).toEqual({
        kind: 'quiet-timer',
        instruction,
        actionId,
        durationMs: durationMinutes * 60_000,
      })
    },
  )

  it('uses known legacy copy only when no stable action id was saved', () => {
    const bSideText = '  STAND BY AN OPEN WINDOW FOR TWO MINUTES  '

    expect(resolveLocalActionStarter({ bSideText })).toEqual({
      kind: 'quiet-timer',
      instruction: bSideText,
      actionId: 'bside.open-window-pause',
      durationMs: 120_000,
    })
  })

  it('lets a known stable id override legacy-looking display copy', () => {
    const bSideText = 'Step outside for three minutes.'

    expect(
      resolveLocalActionStarter({
        bSideSuggestionId: 'bside.phone-away',
        bSideText,
      }),
    ).toEqual({
      kind: 'instruction',
      instruction: bSideText,
      actionId: 'bside.phone-away',
    })
  })

  it.each([
    ['unknown stable id', 'bside.not-in-this-version'],
    ['malformed stable id', 'not an action id'],
    ['empty stable id', ''],
    ['reserved guided-audio id', 'bside.guided-audio'],
    ['reserved external-activity id', 'bside.external-activity'],
  ] as const)(
    'fails closed to the saved instruction for an %s',
    (_caseName, bSideSuggestionId) => {
      const bSideText = 'Step outside for three minutes.'

      expect(
        resolveLocalActionStarter({ bSideSuggestionId, bSideText }),
      ).toEqual({
        kind: 'instruction',
        instruction: bSideText,
      })
    },
  )

  it('keeps custom text as an instruction without inventing an action id', () => {
    expect(
      resolveLocalActionStarter({ bSideText: 'Put one clean plate away.' }),
    ).toEqual({
      kind: 'instruction',
      instruction: 'Put one clean plate away.',
    })
  })

  it('does not mutate the saved cue fields or shared action definition', () => {
    const cue = Object.freeze({
      bSideSuggestionId: 'bside.step-outside',
      bSideText: 'My saved instruction.',
    })
    const action = findActionDefinition(cue.bSideSuggestionId)
    const actionBefore =
      action === undefined ? undefined : structuredClone(action)

    resolveLocalActionStarter(cue)

    expect(cue).toEqual({
      bSideSuggestionId: 'bside.step-outside',
      bSideText: 'My saved instruction.',
    })
    expect(action).toEqual(actionBefore)
  })
})
