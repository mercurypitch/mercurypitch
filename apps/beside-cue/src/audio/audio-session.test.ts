// ============================================================
// Audio session tests — ownership, cancellation and five-lane policy
// ============================================================

import { describe, expect, it } from 'vitest'
import type { AudioAsset, AudioAssetManifest, AudioLane, AudioPlayback, AudioSourceVariant, } from '../content/audio-manifest'
import type { AudioOutputFinishResult, AudioOutputPlayback, AudioOutputPlayRequest, AudioOutputStartResult, AudioSessionOutput, } from './audio-session'
import { createAudioSession } from './audio-session'

interface TestDeferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

function testDeferred<T>(): TestDeferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

class FakePlayback implements AudioOutputPlayback {
  readonly startedDeferred = testDeferred<AudioOutputStartResult>()
  readonly finishedDeferred = testDeferred<AudioOutputFinishResult>()
  readonly started = this.startedDeferred.promise
  readonly finished = this.finishedDeferred.promise
  readonly gains: number[] = []
  stopCount = 0

  setGain(gain: number): void {
    this.gains.push(gain)
  }

  stop(): void {
    this.stopCount += 1
  }
}

class FakeOutput implements AudioSessionOutput {
  readonly requests: AudioOutputPlayRequest[] = []
  readonly playbacks: FakePlayback[] = []
  readonly supported = new Set(['audio/mp4', 'audio/mpeg'])
  readonly unlockDeferred = testDeferred<boolean>()
  disposeCount = 0

  supportsMimeType(mimeType: string): boolean {
    return this.supported.has(mimeType)
  }

  unlock(): Promise<boolean> {
    return this.unlockDeferred.promise
  }

  play(request: AudioOutputPlayRequest): AudioOutputPlayback {
    this.requests.push(request)
    const playback = new FakePlayback()
    this.playbacks.push(playback)
    return playback
  }

  dispose(): void {
    this.disposeCount += 1
  }
}

let sourceCounter = 0

function source(mimeType = 'audio/mp4'): AudioSourceVariant {
  sourceCounter += 1
  return {
    src: `audio/test/source-${String(sourceCounter)}.m4a`,
    mimeType,
    sha256: sourceCounter.toString(16).padStart(64, '0'),
    byteLength: 64,
    durationMs: 1_000,
    sampleRateHz: 48_000,
    channels: 1,
  }
}

function asset(
  id: string,
  lane: AudioLane,
  playback: AudioPlayback = { kind: 'one-shot' },
  sources: readonly [AudioSourceVariant, ...AudioSourceVariant[]] = [source()],
): AudioAsset {
  if (lane === 'dialogue') {
    return {
      id,
      lane,
      playback: { kind: 'one-shot' },
      sources,
      dialogue: {
        lineId: `${id}.line`,
        captionSha256: 'f'.repeat(64),
      },
    }
  }
  return { id, lane, playback, sources }
}

function manifest(assets: readonly AudioAsset[]): AudioAssetManifest {
  return {
    schemaVersion: 1,
    revision: 'audio-session-test-v1',
    locale: 'en',
    assets,
  }
}

describe('audio session', () => {
  it('resolves a changed language manifest at playback without restarting the shared score', async () => {
    const output = new FakeOutput()
    const scoreAsset = asset('score.loop', 'score', {
      kind: 'loop',
      loopStartMs: 0,
      loopEndMs: 1000,
    })
    const english = asset('dialogue.hello', 'dialogue')
    const spanish = asset('dialogue.hello', 'dialogue')
    let currentManifest = manifest([scoreAsset, english])
    const session = createAudioSession({
      get manifest() {
        return currentManifest
      },
      output,
    })
    const musicScope = session.createScope('ambient')
    const speechScope = session.createScope('onboarding')
    musicScope.play(scoreAsset.id)
    output.playbacks[0]!.startedDeferred.resolve('started')
    const first = speechScope.play(english.id)
    speechScope.stopAll('replaced')
    currentManifest = { ...manifest([scoreAsset, spanish]), locale: 'es' }
    const next = speechScope.play(spanish.id)
    expect(output.requests[1]?.source).toBe(english.sources[0])
    expect(output.requests[2]?.source).toBe(spanish.sources[0])
    expect(output.playbacks[0]?.stopCount).toBe(0)
    output.playbacks[1]!.startedDeferred.resolve('started')
    await expect(first.started).resolves.toEqual({
      kind: 'silent',
      reason: 'cancelled',
    })
    output.playbacks[2]!.startedDeferred.resolve('started')
    await expect(next.started).resolves.toEqual({ kind: 'started' })
    expect(
      output.requests.filter(
        (request) => request.source === scoreAsset.sources[0],
      ),
    ).toHaveLength(1)
    session.dispose()
  })
  it('composes a scope level and dialogue duck while music is still loading', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([
        asset('score.loop', 'score'),
        asset('dialogue.hello', 'dialogue'),
      ]),
      output,
    })
    const music = session.createScope('ambient')
    music.setGain(0.4)
    const score = music.play('score.loop')
    expect(output.requests[0]?.initialGain).toBe(0.4)
    music.setGain(0.16)
    expect(output.playbacks[0]?.gains).toEqual([0.16])

    const voice = session.createScope('onboarding').play('dialogue.hello')
    output.playbacks[1]?.startedDeferred.resolve('started')
    await voice.started
    expect(output.playbacks[0]?.gains.at(-1)).toBe(0.16 * 0.35)
    output.playbacks[0]?.startedDeferred.resolve('started')
    await score.started
    expect(output.playbacks[0]?.gains.at(-1)).toBe(0.16 * 0.35)
    music.setGain(0.2)
    expect(output.playbacks[0]?.gains.at(-1)).toBe(0.2 * 0.35)
    output.playbacks[1]?.finishedDeferred.resolve('ended')
    await voice.finished
    expect(output.playbacks[0]?.gains.at(-1)).toBe(0.2)
    session.dispose()
  })

  it('returns typed silence for missing assets, output, mute and background', async () => {
    const noOutput = createAudioSession({
      manifest: manifest([asset('score.open', 'score')]),
    })
    const scope = noOutput.createScope('test')

    await expect(scope.play('missing').started).resolves.toEqual({
      kind: 'silent',
      reason: 'asset-missing',
    })
    await expect(scope.play('score.open').started).resolves.toEqual({
      kind: 'silent',
      reason: 'output-unavailable',
    })

    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([asset('ui.tap', 'ui')]),
      output,
      muted: true,
    })
    const liveScope = session.createScope('live')
    await expect(liveScope.play('ui.tap').started).resolves.toEqual({
      kind: 'silent',
      reason: 'muted',
    })
    session.setMuted(false)
    session.setForeground(false)
    await expect(liveScope.play('ui.tap').started).resolves.toEqual({
      kind: 'silent',
      reason: 'backgrounded',
    })
    expect(output.requests).toHaveLength(0)
  })

  it('tries supported same-content variants in order and fails silent after all fail', async () => {
    const output = new FakeOutput()
    const fallbackAsset = asset('dialogue.hello', 'dialogue', undefined, [
      source('audio/ogg'),
      source('audio/mp4'),
      source('audio/mpeg'),
    ])
    const session = createAudioSession({
      manifest: manifest([fallbackAsset]),
      output,
    })
    const cue = session.createScope('voice').play(fallbackAsset.id)

    expect(output.requests.map(({ source: item }) => item.mimeType)).toEqual([
      'audio/mp4',
    ])
    output.playbacks[0]?.startedDeferred.resolve('failed')
    await Promise.resolve()
    expect(output.requests.map(({ source: item }) => item.mimeType)).toEqual([
      'audio/mp4',
      'audio/mpeg',
    ])
    output.playbacks[1]?.startedDeferred.resolve('failed')

    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'load-failed',
    })
    await expect(cue.finished).resolves.toEqual({
      kind: 'silent',
      reason: 'load-failed',
    })
  })

  it('replaces a pending same-lane request without allowing its late start to regain ownership', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([
        asset('score.one', 'score'),
        asset('score.two', 'score'),
      ]),
      output,
    })
    const scope = session.createScope('onboarding')
    const first = scope.play('score.one')
    const second = scope.play('score.two')

    await expect(first.started).resolves.toEqual({
      kind: 'silent',
      reason: 'cancelled',
    })
    await expect(first.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'replaced',
    })
    expect(output.playbacks[0]?.stopCount).toBe(1)

    output.playbacks[0]?.startedDeferred.resolve('started')
    await Promise.resolve()
    expect(output.playbacks[0]?.stopCount).toBe(2)

    output.playbacks[1]?.startedDeferred.resolve('started')
    await expect(second.started).resolves.toEqual({ kind: 'started' })
    output.playbacks[1]?.finishedDeferred.resolve('ended')
    await expect(second.finished).resolves.toEqual({ kind: 'ended' })
  })

  it('settles an output-stopped start and releases its lane for the next cue', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([
        asset('score.one', 'score'),
        asset('score.two', 'score'),
      ]),
      output,
    })
    const scope = session.createScope('onboarding')
    const stopped = scope.play('score.one')
    output.playbacks[0]?.startedDeferred.resolve('stopped')

    await expect(stopped.started).resolves.toEqual({
      kind: 'silent',
      reason: 'cancelled',
    })
    await expect(stopped.finished).resolves.toEqual({
      kind: 'silent',
      reason: 'cancelled',
    })

    const next = scope.play('score.two')
    output.playbacks[1]?.startedDeferred.resolve('started')
    await expect(next.started).resolves.toEqual({ kind: 'started' })
  })

  it('keeps dialogue ducking through replacement and ignores the stale finish', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([
        asset('score.main', 'score'),
        asset('dialogue.one', 'dialogue'),
        asset('dialogue.two', 'dialogue'),
      ]),
      output,
      dialogueDuckGain: 0.4,
    })
    const scope = session.createScope('onboarding')
    const scoreCue = scope.play('score.main')
    output.playbacks[0]?.startedDeferred.resolve('started')
    await scoreCue.started

    const firstVoice = scope.play('dialogue.one')
    output.playbacks[1]?.startedDeferred.resolve('started')
    await firstVoice.started
    expect(output.playbacks[0]?.gains).toEqual([0.4])

    const secondVoice = scope.play('dialogue.two')
    await expect(firstVoice.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'replaced',
    })
    expect(output.playbacks[0]?.gains).toEqual([0.4])

    output.playbacks[1]?.finishedDeferred.resolve('ended')
    await Promise.resolve()
    expect(output.playbacks[0]?.gains).toEqual([0.4])

    output.playbacks[2]?.startedDeferred.resolve('started')
    await secondVoice.started
    output.playbacks[2]?.finishedDeferred.resolve('ended')
    await expect(secondVoice.finished).resolves.toEqual({ kind: 'ended' })
    expect(output.playbacks[0]?.gains).toEqual([0.4, 1])
  })

  it('restores ducking when the current replacement cannot load', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([
        asset('score.main', 'score'),
        asset('dialogue.one', 'dialogue'),
        asset('dialogue.two', 'dialogue'),
      ]),
      output,
    })
    const scope = session.createScope('onboarding')
    const score = scope.play('score.main')
    output.playbacks[0]?.startedDeferred.resolve('started')
    await score.started
    const first = scope.play('dialogue.one')
    output.playbacks[1]?.startedDeferred.resolve('started')
    await first.started
    const replacement = scope.play('dialogue.two')
    output.playbacks[2]?.startedDeferred.resolve('failed')

    await expect(replacement.started).resolves.toEqual({
      kind: 'silent',
      reason: 'load-failed',
    })
    expect(output.playbacks[0]?.gains).toEqual([0.35, 1])
  })

  it('forwards bounded hold loops and makes stop exact once', async () => {
    const output = new FakeOutput()
    const loop = { kind: 'loop', loopStartMs: 250, loopEndMs: 8_250 } as const
    const session = createAudioSession({
      manifest: manifest([asset('hold.choice', 'hold-bed', loop)]),
      output,
    })
    const cue = session.createScope('onboarding').play('hold.choice')
    expect(output.requests[0]?.playback).toEqual(loop)
    output.playbacks[0]?.startedDeferred.resolve('started')
    await cue.started

    expect(cue.stop('lane-stopped')).toBe(true)
    expect(cue.stop('user')).toBe(false)
    await expect(cue.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'lane-stopped',
    })
  })

  it('invalidates scopes, mute and foreground transitions without auto-resume', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([asset('score.main', 'score'), asset('ui.tap', 'ui')]),
      output,
    })
    const scope = session.createScope('onboarding')
    const score = scope.play('score.main')
    const ui = scope.play('ui.tap')
    scope.stopAll()

    await expect(score.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'scope-stopped',
    })
    await expect(ui.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'scope-stopped',
    })
    const next = scope.play('score.main')
    session.setForeground(false)
    await expect(next.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'backgrounded',
    })
    expect(output.requests).toHaveLength(3)

    session.setForeground(true)
    expect(output.requests).toHaveLength(3)
    const afterForeground = scope.play('score.main')
    session.setMuted(true)
    await expect(afterForeground.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'muted',
    })
    session.setMuted(false)
    expect(output.requests).toHaveLength(4)

    scope.dispose()
    await expect(scope.play('score.main').started).resolves.toEqual({
      kind: 'silent',
      reason: 'scope-disposed',
    })
  })

  it('correlates pending unlock with mute and disposal', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({ manifest: manifest([]), output })
    const unlocking = session.unlock()
    session.setMuted(true)
    output.unlockDeferred.resolve(true)
    await expect(unlocking).resolves.toBe(false)

    session.setMuted(false)
    const secondOutput = new FakeOutput()
    const secondSession = createAudioSession({
      manifest: manifest([]),
      output: secondOutput,
    })
    const disposing = secondSession.unlock()
    secondSession.dispose()
    secondOutput.unlockDeferred.resolve(true)
    await expect(disposing).resolves.toBe(false)
    expect(secondOutput.disposeCount).toBe(1)
  })

  it('turns a rejecting output completion into a typed failure', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([asset('ui.tap', 'ui')]),
      output,
    })
    const cue = session.createScope('home').play('ui.tap')
    output.playbacks[0]?.startedDeferred.resolve('started')
    await cue.started
    output.playbacks[0]?.finishedDeferred.reject(new Error('device lost'))
    await expect(cue.finished).resolves.toEqual({ kind: 'failed' })
  })

  it('disposes the output once and leaves later calls silent', async () => {
    const output = new FakeOutput()
    const session = createAudioSession({
      manifest: manifest([asset('foley.tap', 'foley')]),
      output,
    })
    const scope = session.createScope('home')
    const cue = scope.play('foley.tap')
    session.dispose()
    session.dispose()

    await expect(cue.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'session-disposed',
    })
    await expect(scope.play('foley.tap').started).resolves.toEqual({
      kind: 'silent',
      reason: 'session-disposed',
    })
    expect(output.disposeCount).toBe(1)
  })
})
