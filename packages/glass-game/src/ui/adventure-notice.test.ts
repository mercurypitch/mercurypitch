// Adventure notice tests — restored checkpoints never replay fresh-spawn copy.

import { describe, expect, it } from 'vitest'
import { CLOUDWAY_GLASS_RIBBON } from '../content/cloudway-trial'
import type { GameSnapshot } from '../contracts'
import { createGlassGame } from '../core/game'
import { initialAdventureNotice } from './adventure-notice'

function snapshot(
  checkpointId: string,
  completedBreakableIds: readonly string[] = [],
): GameSnapshot {
  const game = createGlassGame(CLOUDWAY_GLASS_RIBBON, {
    version: 2,
    levelId: CLOUDWAY_GLASS_RIBBON.id,
    checkpointId,
    completedBreakableIds: [...completedBreakableIds],
    finished: false,
  })
  return game.snapshot()
}

describe('initialAdventureNotice', () => {
  it('shows the authored instruction on a fresh arrival', () => {
    const state = snapshot('cloudway-checkpoint-arrival')

    expect(initialAdventureNotice(CLOUDWAY_GLASS_RIBBON, state)).toBe(
      'Sing to the goblet to begin.',
    )
  })

  it('suppresses fresh-arrival copy for a zero-break finale checkpoint', () => {
    const state = snapshot('cloudway-checkpoint-finale')

    expect(initialAdventureNotice(CLOUDWAY_GLASS_RIBBON, state)).toBe('')
    expect(state.nextRequiredBreakableId).toBe('cloudway-arrival-goblet')
  })

  it('suppresses fresh-arrival copy after restored exhibit progress', () => {
    const state = snapshot('cloudway-checkpoint-finale', [
      'cloudway-arrival-goblet',
      'cloudway-crossing-vase',
    ])

    expect(initialAdventureNotice(CLOUDWAY_GLASS_RIBBON, state)).toBe('')
    expect(state.nextRequiredBreakableId).toBe('cloudway-finale-portrait')
  })
})
