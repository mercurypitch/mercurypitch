// Runner rewards remain visible from saved progress and never count a portrait as a route pickup.
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { runnerRewardSummary } from './runner-rewards'

describe('runner reward presentation', () => {
  it('keeps a saved portrait on replay while counting distinct recognized pickups', () => {
    const initial = createSongRunnerGame(SINGING_CURRENT, {
      comfortableMidi: 60,
    })
    const pickup = SINGING_CURRENT.rewards.pickups[0]!.id
    const replay = createSongRunnerGame(SINGING_CURRENT, {
      comfortableMidi: 60,
      progress: {
        ...initial.saveProgress(),
        completed: true,
        collectedRewardIds: [
          pickup,
          pickup,
          'portrait-first-song-run',
          'retired-pickup',
        ],
      },
    })
    expect(replay.beginEpoch('replay')).toMatchObject({ ok: true })
    expect(replay.snapshot().resolvedTargets).toEqual([])
    const rewards = runnerRewardSummary(
      SINGING_CURRENT,
      replay.snapshot().collectedRewardIds,
    )
    expect(rewards).toMatchObject({
      collectedPickups: 1,
      availablePickups: 4,
      portrait: {
        imageAsset: 'painting-portrait-v5',
        title: 'She who woke the glass',
      },
    })
  })

  it('does not infer a portrait from completion, singing grades, or all route pickups', () => {
    const rewards = runnerRewardSummary(
      SINGING_CURRENT,
      SINGING_CURRENT.rewards.pickups.map((pickup) => pickup.id),
    )
    expect(rewards).toEqual({
      collectedPickups: 4,
      availablePickups: 4,
      portrait: null,
    })
  })
})
