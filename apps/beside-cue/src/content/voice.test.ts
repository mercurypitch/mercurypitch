// ============================================================
// Character voice tests — captions survive every playback outcome
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { AudioAssetManifest, AudioSourceVariant, DialogueAudioAsset, } from './audio-manifest'
import { DEFAULT_AUDIO_ASSET_MANIFEST } from './audio-manifest'
import type { ContentPack, Line } from './pack'
import { DEFAULT_CONTENT_PACK, findLine } from './pack'
import type { VoiceAudioFinish, VoiceAudioHandle, VoiceAudioPort, VoicePlaybackStatus, } from './voice'
import { createVoicePlayer } from './voice'

const FIRST_LINE_ID = 'pull.scrolling.meet'
const SECOND_LINE_ID = 'corky.cue-open.01'
const MP4_MIME_TYPE = 'audio/mp4; codecs="mp4a.40.2"'
const WEBM_MIME_TYPE = 'audio/webm; codecs="opus"'

interface Deferred<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (reason: unknown) => void
}

interface ControlledHandle extends VoiceAudioHandle {
  readonly settleStart: Deferred<undefined>
  readonly settleFinish: Deferred<VoiceAudioFinish>
}

type StartPlan = 'resolved' | 'rejected' | 'pending'

interface ControlledAudioPort extends VoiceAudioPort {
  readonly handles: ControlledHandle[]
  readonly playedSources: AudioSourceVariant[]
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function requireLine(id: string): Line & { readonly captionSha256: string } {
  const line = findLine(DEFAULT_CONTENT_PACK, id)
  if (line?.captionSha256 === undefined) {
    throw new Error(`Expected canonical line "${id}" with a caption hash.`)
  }
  return line as Line & { readonly captionSha256: string }
}

function audioSource(src: string, mimeType: string): AudioSourceVariant {
  return {
    src,
    mimeType,
    sha256: 'a'.repeat(64),
    byteLength: 12_345,
    durationMs: 2_400,
    sampleRateHz: 48_000,
    channels: 1,
  }
}

function dialogueAsset(
  line: Line & { readonly captionSha256: string },
  sources: readonly [AudioSourceVariant, ...AudioSourceVariant[]],
): DialogueAudioAsset {
  return {
    id: `dialogue.${line.id}`,
    lane: 'dialogue',
    playback: { kind: 'one-shot' },
    dialogue: {
      lineId: line.id,
      captionSha256: line.captionSha256,
    },
    sources,
  }
}

const firstLine = requireLine(FIRST_LINE_ID)
const secondLine = requireLine(SECOND_LINE_ID)
const firstMp4 = audioSource(
  '/audio/voice/en/the-scroll/meet.m4a',
  MP4_MIME_TYPE,
)
const firstWebm = audioSource(
  '/audio/voice/en/the-scroll/meet.webm',
  WEBM_MIME_TYPE,
)
const secondMp4 = audioSource(
  '/audio/voice/en/corky/cue-open-01.m4a',
  MP4_MIME_TYPE,
)

const recordedManifest: AudioAssetManifest = {
  schemaVersion: 1,
  revision: 'voice-test-recordings-v1',
  locale: 'en',
  assets: [
    dialogueAsset(firstLine, [firstMp4, firstWebm]),
    dialogueAsset(secondLine, [secondMp4]),
  ],
}

const recordedPack: ContentPack = {
  ...DEFAULT_CONTENT_PACK,
  audio: recordedManifest,
}

function controlledHandle(plan: StartPlan): ControlledHandle {
  const settleStart = deferred<undefined>()
  const settleFinish = deferred<VoiceAudioFinish>()
  const handle: ControlledHandle = {
    settleStart,
    settleFinish,
    started: settleStart.promise,
    finished: settleFinish.promise,
    stop: vi.fn(),
  }

  if (plan === 'resolved') settleStart.resolve(undefined)
  if (plan === 'rejected') {
    settleStart.reject(new Error('Playback start was refused.'))
  }
  return handle
}

function controlledAudio(options?: {
  readonly supportedMimeTypes?: readonly string[]
  readonly startPlans?: readonly StartPlan[]
}): ControlledAudioPort {
  const supported = new Set(
    options?.supportedMimeTypes ?? [MP4_MIME_TYPE, WEBM_MIME_TYPE],
  )
  const plans = [...(options?.startPlans ?? [])]
  const handles: ControlledHandle[] = []
  const playedSources: AudioSourceVariant[] = []

  return {
    handles,
    playedSources,
    supportsMimeType: vi.fn((mimeType) => supported.has(mimeType)),
    play: vi.fn((source) => {
      playedSources.push(source)
      const handle = controlledHandle(plans.shift() ?? 'resolved')
      handles.push(handle)
      return handle
    }),
    dispose: vi.fn(),
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('caption-first voice player', () => {
  it('returns the exact caption when no recording has shipped', async () => {
    const audio = controlledAudio()
    const player = createVoicePlayer({
      pack: { ...DEFAULT_CONTENT_PACK, audio: DEFAULT_AUDIO_ASSET_MANIFEST },
      audio,
    })

    const cue = player.playLine(FIRST_LINE_ID)

    expect(cue.caption).toBe(firstLine.text)
    expect(cue.line).toBe(firstLine)
    expect(cue.recordingAvailable).toBe(false)
    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'not-recorded',
    })
    await expect(cue.finished).resolves.toEqual({
      kind: 'silent',
      reason: 'not-recorded',
    })
    expect(player.hasRecording(FIRST_LINE_ID)).toBe(false)
    expect(player.canPlayLine(FIRST_LINE_ID)).toBe(false)
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('keeps a delivered recording silent while muted', async () => {
    const audio = controlledAudio()
    const player = createVoicePlayer({
      pack: recordedPack,
      audio,
      muted: () => true,
    })

    const cue = player.playLine(FIRST_LINE_ID)

    expect(cue.caption).toBe(firstLine.text)
    expect(cue.recordingAvailable).toBe(true)
    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'muted',
    })
    await expect(cue.finished).resolves.toEqual({
      kind: 'silent',
      reason: 'muted',
    })
    expect(player.hasRecording(FIRST_LINE_ID)).toBe(true)
    expect(audio.supportsMimeType).not.toHaveBeenCalled()
    expect(player.canPlayLine(FIRST_LINE_ID)).toBe(true)
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('keeps the caption available when no audio port exists', async () => {
    const player = createVoicePlayer({ pack: recordedPack })

    const cue = player.playLine(FIRST_LINE_ID)

    expect(cue.caption).toBe(firstLine.text)
    expect(cue.recordingAvailable).toBe(true)
    expect(player.hasRecording(FIRST_LINE_ID)).toBe(true)
    expect(player.canPlayLine(FIRST_LINE_ID)).toBe(false)
    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'unavailable',
    })
    await expect(cue.finished).resolves.toEqual({
      kind: 'silent',
      reason: 'unavailable',
    })
  })

  it('does not attempt an unsupported recording', async () => {
    const audio = controlledAudio({ supportedMimeTypes: [] })
    const player = createVoicePlayer({ pack: recordedPack, audio })

    const cue = player.playLine(FIRST_LINE_ID)

    expect(cue.caption).toBe(firstLine.text)
    expect(cue.recordingAvailable).toBe(true)
    expect(player.hasRecording(FIRST_LINE_ID)).toBe(true)
    expect(player.canPlayLine(FIRST_LINE_ID)).toBe(false)
    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'unavailable',
    })
    expect(audio.supportsMimeType).toHaveBeenNthCalledWith(1, MP4_MIME_TYPE)
    expect(audio.supportsMimeType).toHaveBeenNthCalledWith(2, WEBM_MIME_TYPE)
    expect(audio.play).not.toHaveBeenCalled()
  })

  it('falls back through supported sources in manifest order', async () => {
    const audio = controlledAudio({ startPlans: ['rejected', 'resolved'] })
    const player = createVoicePlayer({ pack: recordedPack, audio })

    const cue = player.playLine(FIRST_LINE_ID)

    await expect(cue.started).resolves.toEqual({ kind: 'started' })
    expect(audio.playedSources.map((source) => source.src)).toEqual([
      firstMp4.src,
      firstWebm.src,
    ])
    expect(audio.handles[0]?.stop).toHaveBeenCalledOnce()

    audio.handles[1]?.settleFinish.resolve('ended')
    await expect(cue.finished).resolves.toEqual({ kind: 'ended' })
  })

  it('reports playback failure only after every supported source fails', async () => {
    const statuses: VoicePlaybackStatus[] = []
    const audio = controlledAudio({ startPlans: ['rejected', 'rejected'] })
    const player = createVoicePlayer({
      pack: recordedPack,
      audio,
      onStatusChange: (status) => statuses.push(status),
    })

    const cue = player.playLine(FIRST_LINE_ID)

    expect(cue.caption).toBe(firstLine.text)
    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'playback-failed',
    })
    await expect(cue.finished).resolves.toEqual({
      kind: 'silent',
      reason: 'playback-failed',
    })
    expect(audio.playedSources.map((source) => source.src)).toEqual([
      firstMp4.src,
      firstWebm.src,
    ])
    expect(
      audio.handles.every(
        (handle) => vi.mocked(handle.stop).mock.calls.length === 1,
      ),
    ).toBe(true)
    expect(statuses.map((status) => status.phase)).toEqual([
      'idle',
      'starting',
      'failed',
    ])
  })

  it('publishes starting, playing and played without changing the caption', async () => {
    const statuses: VoicePlaybackStatus[] = []
    const audio = controlledAudio({ startPlans: ['pending'] })
    const player = createVoicePlayer({
      pack: recordedPack,
      audio,
      onStatusChange: (status) => statuses.push(status),
    })

    const cue = player.playLine(FIRST_LINE_ID)
    expect(cue.caption).toBe(firstLine.text)
    expect(statuses.map((status) => status.phase)).toEqual(['idle', 'starting'])

    audio.handles[0]?.settleStart.resolve(undefined)
    await expect(cue.started).resolves.toEqual({ kind: 'started' })
    expect(cue.caption).toBe(firstLine.text)
    expect(statuses.map((status) => status.phase)).toEqual([
      'idle',
      'starting',
      'playing',
    ])

    audio.handles[0]?.settleFinish.resolve('ended')
    await expect(cue.finished).resolves.toEqual({ kind: 'ended' })
    expect(cue.caption).toBe(firstLine.text)
    expect(statuses.map((status) => status.phase)).toEqual([
      'idle',
      'starting',
      'playing',
      'played',
    ])
    expect(
      statuses
        .slice(1)
        .every(
          (status) =>
            status.phase === 'idle' || status.lineId === FIRST_LINE_ID,
        ),
    ).toBe(true)
  })

  it('cancels a pending start when a newer line replaces it', async () => {
    const statuses: VoicePlaybackStatus[] = []
    const audio = controlledAudio({ startPlans: ['pending', 'resolved'] })
    const player = createVoicePlayer({
      pack: recordedPack,
      audio,
      onStatusChange: (status) => statuses.push(status),
    })

    const firstCue = player.playLine(FIRST_LINE_ID)
    const secondCue = player.playLine(SECOND_LINE_ID)

    await expect(firstCue.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'replaced',
    })
    await expect(secondCue.started).resolves.toEqual({ kind: 'started' })
    expect(audio.handles[0]?.stop).toHaveBeenCalledOnce()

    audio.handles[0]?.settleStart.resolve(undefined)
    await expect(firstCue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'cancelled',
    })
    await flushPromises()

    const playingStatuses = statuses.filter(
      (status) => status.phase === 'playing',
    )
    expect(playingStatuses).toEqual([
      {
        phase: 'playing',
        lineId: SECOND_LINE_ID,
        requestId: secondCue.requestId,
      },
    ])

    audio.handles[1]?.settleFinish.resolve('ended')
    await expect(secondCue.finished).resolves.toEqual({ kind: 'ended' })
  })

  it('ignores a replaced handle finishing after the new line starts', async () => {
    const statuses: VoicePlaybackStatus[] = []
    const audio = controlledAudio()
    const player = createVoicePlayer({
      pack: recordedPack,
      audio,
      onStatusChange: (status) => statuses.push(status),
    })

    const firstCue = player.playLine(FIRST_LINE_ID)
    await expect(firstCue.started).resolves.toEqual({ kind: 'started' })
    const secondCue = player.playLine(SECOND_LINE_ID)
    await expect(secondCue.started).resolves.toEqual({ kind: 'started' })

    audio.handles[0]?.settleFinish.resolve('ended')
    await flushPromises()

    expect(statuses.at(-1)).toEqual({
      phase: 'playing',
      lineId: SECOND_LINE_ID,
      requestId: secondCue.requestId,
    })
    expect(
      statuses.some(
        (status) =>
          status.phase === 'played' && status.lineId === FIRST_LINE_ID,
      ),
    ).toBe(false)
    await expect(firstCue.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'replaced',
    })

    audio.handles[1]?.settleFinish.resolve('ended')
    await expect(secondCue.finished).resolves.toEqual({ kind: 'ended' })
  })

  it('stops an active handle once even when stop is repeated', async () => {
    const audio = controlledAudio()
    const player = createVoicePlayer({ pack: recordedPack, audio })
    const cue = player.playLine(FIRST_LINE_ID)
    await expect(cue.started).resolves.toEqual({ kind: 'started' })

    player.stop('hidden')
    player.stop('hidden')

    await expect(cue.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'hidden',
    })
    expect(audio.handles[0]?.stop).toHaveBeenCalledOnce()
  })

  it('disposes once and makes a late pending start harmless', async () => {
    const audio = controlledAudio({ startPlans: ['pending'] })
    const player = createVoicePlayer({ pack: recordedPack, audio })
    const cue = player.playLine(FIRST_LINE_ID)

    player.dispose()
    player.dispose()

    await expect(cue.finished).resolves.toEqual({
      kind: 'stopped',
      reason: 'disposed',
    })
    expect(audio.dispose).toHaveBeenCalledOnce()

    audio.handles[0]?.settleStart.resolve(undefined)
    await expect(cue.started).resolves.toEqual({
      kind: 'silent',
      reason: 'disposed',
    })
    await flushPromises()

    const afterDispose = player.playLine(SECOND_LINE_ID)
    expect(afterDispose.caption).toBe(secondLine.text)
    await expect(afterDispose.started).resolves.toEqual({
      kind: 'silent',
      reason: 'disposed',
    })
    expect(audio.play).toHaveBeenCalledOnce()
  })

  it('throws synchronously for a line the pack does not define', () => {
    const player = createVoicePlayer({ pack: recordedPack })

    expect(() => player.playLine('missing.line')).toThrow(
      /No line "missing\.line" in content pack "beside-cue-default"/u,
    )
    expect(player.hasRecording('missing.line')).toBe(false)
  })
})
