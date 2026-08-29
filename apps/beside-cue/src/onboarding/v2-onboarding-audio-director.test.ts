// ============================================================
// V2 onboarding audio director tests — hold and exit ownership
// ============================================================

import { describe, expect, it } from 'vitest'
import type { AudioSessionCue, AudioSessionFinishResult, AudioSessionStartResult, AudioSessionStopReason, } from '../audio/audio-session'
import { createV2OnboardingAudioDirector } from './v2-onboarding-audio-director'

interface TestDeferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
}

function deferred<T>(): TestDeferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

interface PlayedCue {
  readonly assetId: string
  readonly started: TestDeferred<AudioSessionStartResult>
}

function createScopeProbe() {
  let nextRequestId = 0
  const played: PlayedCue[] = []
  const stoppedLanes: Array<readonly [string, string | undefined]> = []
  const stopAllReasons: Array<string | undefined> = []
  let disposeCount = 0

  return {
    scope: {
      play(assetId: string): AudioSessionCue {
        const started = deferred<AudioSessionStartResult>()
        const finished = deferred<AudioSessionFinishResult>()
        played.push({ assetId, started })
        return {
          requestId: (nextRequestId += 1),
          assetId,
          started: started.promise,
          finished: finished.promise,
          stop: () => false,
        }
      },
      stopLane(lane: string, reason?: AudioSessionStopReason) {
        stoppedLanes.push([lane, reason])
      },
      stopAll(reason?: AudioSessionStopReason) {
        stopAllReasons.push(reason)
      },
      dispose() {
        disposeCount += 1
      },
    },
    played,
    stoppedLanes,
    stopAllReasons,
    disposeCount: () => disposeCount,
  }
}

describe('V2 onboarding audio director', () => {
  it('crosses from score into a hold only after the bed start settles', async () => {
    const probe = createScopeProbe()
    const director = createV2OnboardingAudioDirector(probe.scope)

    const token = director.enterHold({
      holdId: 'pull-choice',
      holdBedAssetId: 'hold.pull-choice',
      dialogueAssetId: 'dialogue.pull-choice',
    })

    expect(token).toEqual({ holdId: 'pull-choice', generation: 1 })
    expect(probe.played.map(({ assetId }) => assetId)).toEqual([
      'hold.pull-choice',
      'dialogue.pull-choice',
    ])
    expect(probe.stoppedLanes).toEqual([])

    probe.played[0]?.started.resolve({ kind: 'started' })
    await Promise.resolve()
    expect(probe.stoppedLanes).toEqual([['score', 'lane-stopped']])
  })

  it('leaves a hold exactly once and retires its bed after the next score settles', async () => {
    const probe = createScopeProbe()
    const director = createV2OnboardingAudioDirector(probe.scope)
    const token = director.enterHold({
      holdId: 'side-b',
      holdBedAssetId: 'hold.side-b',
    })
    probe.played[0]?.started.resolve({ kind: 'started' })
    await Promise.resolve()
    probe.stoppedLanes.length = 0

    expect(
      director.exitHold(token, {
        scoreAssetId: 'score.after-side-b',
        foleyAssetId: 'foley.choice-confirmed',
      }),
    ).toBe(true)
    expect(director.exitHold(token, {})).toBe(false)
    expect(probe.played.map(({ assetId }) => assetId)).toEqual([
      'hold.side-b',
      'score.after-side-b',
      'foley.choice-confirmed',
    ])
    expect(probe.stoppedLanes).toEqual([])

    probe.played[1]?.started.resolve({ kind: 'started' })
    await Promise.resolve()
    expect(probe.stoppedLanes).toEqual([['hold-bed', 'lane-stopped']])
  })

  it('ignores stale exits and callbacks from holds that no longer own audio', async () => {
    const probe = createScopeProbe()
    const director = createV2OnboardingAudioDirector(probe.scope)
    const first = director.enterHold({
      holdId: 'first',
      holdBedAssetId: 'hold.first',
    })
    const second = director.enterHold({
      holdId: 'second',
      holdBedAssetId: 'hold.second',
    })

    probe.played[0]?.started.resolve({ kind: 'started' })
    await Promise.resolve()
    expect(probe.stoppedLanes).toEqual([])
    expect(director.exitHold(first, { scoreAssetId: 'score.stale' })).toBe(
      false,
    )
    expect(director.exitHold(second, {})).toBe(true)
    expect(probe.stoppedLanes).toEqual([
      ['score', 'lane-stopped'],
      ['hold-bed', 'lane-stopped'],
    ])
  })

  it('falls back to silence without blocking hold entry or exit', () => {
    const probe = createScopeProbe()
    const director = createV2OnboardingAudioDirector(probe.scope)
    const token = director.enterHold({ holdId: 'reminder' })

    expect(probe.played).toEqual([])
    expect(probe.stoppedLanes).toEqual([
      ['hold-bed', 'lane-stopped'],
      ['score', 'lane-stopped'],
    ])
    expect(director.exitHold(token, {})).toBe(true)
    expect(probe.stoppedLanes).toEqual([
      ['hold-bed', 'lane-stopped'],
      ['score', 'lane-stopped'],
      ['score', 'lane-stopped'],
      ['hold-bed', 'lane-stopped'],
    ])
  })

  it('retires stale lane audio when configured successor assets are missing', async () => {
    const probe = createScopeProbe()
    const director = createV2OnboardingAudioDirector(probe.scope)

    director.enterBeat({ scoreAssetId: 'score.not-in-manifest' })
    probe.played[0]?.started.resolve({
      kind: 'silent',
      reason: 'asset-missing',
    })
    await Promise.resolve()
    expect(probe.stoppedLanes).toEqual([
      ['score', 'lane-stopped'],
      ['hold-bed', 'lane-stopped'],
    ])

    probe.stoppedLanes.length = 0
    director.enterHold({
      holdId: 'next-choice',
      holdBedAssetId: 'hold.not-in-manifest',
    })
    probe.played[1]?.started.resolve({
      kind: 'silent',
      reason: 'asset-missing',
    })
    await Promise.resolve()
    expect(probe.stoppedLanes).toEqual([
      ['hold-bed', 'lane-stopped'],
      ['score', 'lane-stopped'],
    ])
  })

  it('cancels pending transitions on stop and disposes its scope once', async () => {
    const probe = createScopeProbe()
    const director = createV2OnboardingAudioDirector(probe.scope)
    director.enterHold({
      holdId: 'stop-save',
      holdBedAssetId: 'hold.stop-save',
    })
    director.stop()
    probe.played[0]?.started.resolve({ kind: 'started' })
    await Promise.resolve()

    expect(probe.stoppedLanes).toEqual([])
    expect(probe.stopAllReasons).toEqual(['scope-stopped'])

    director.dispose()
    director.dispose()
    expect(probe.disposeCount()).toBe(1)
  })
})
