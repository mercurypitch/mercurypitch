import { describe, expect, it } from 'vitest'
import type { VoiceTakeRecord } from '@/db/entities'
import { GUIDED_VOICE_TAKE_CONTEXT_VERSION, GUIDED_VOICE_TAKE_TITLE, } from '@/features/voice-history/guided-voice-take'
import { buildVoiceThreads, createPlaybackRequestGate, createTakeMutationQueue, findSavedGuidedFocus, } from '@/features/voice-history/VoiceHistoryPage'
import { assessPitchCentrePilot, createPitchCentrePilotProtocol, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from '@/lib/guided-voice/pitch-centre-assessment'

const GUIDED_PROTOCOL = createPitchCentrePilotProtocol({
  comfortableRangeMidiCents: [5_700, 7_300],
  preferredMidiCents: 6_900,
})

function midiCentsToHz(midiCents: number): number {
  return 440 * 2 ** ((midiCents - 6_900) / 1_200)
}

function validGuidedTake(id: string, capturedAt: string): VoiceTakeRecord {
  const landingSeconds =
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds / 1000
  const result = assessPitchCentrePilot({
    runId: `pitch-centre.${id}`,
    protocol: GUIDED_PROTOCOL,
    captureDurationMilliseconds: GUIDED_PROTOCOL.task.durationMilliseconds,
    landingWindows: GUIDED_PROTOCOL.task.targetMidiCents.map(
      (targetMidiCents, index) => {
        const startSeconds = index * landingSeconds
        return {
          startSeconds,
          endSeconds: startSeconds + landingSeconds,
          frames: Array.from({ length: 90 }, (_, frameIndex) => ({
            t: startSeconds + frameIndex * 0.02,
            f0: midiCentsToHz(targetMidiCents),
            conf: 0.95,
          })),
        }
      },
    ),
    quality: {
      microphoneContinuous: true,
      clippingDetected: false,
      noiseSeparation: 'sufficient',
      taskCompleted: true,
      analysisAvailable: true,
    },
    safety: { preCapture: 'proceed', singerEffort: 'workable' },
    captureContext: {
      inputContextKey: null,
      detectorId: 'yin',
      detectorVersion: '1.0.0',
      sampleRateHz: 48_000,
    },
  })
  if (result.persistedContext === null || result.reading === null) {
    throw new Error('Canonical guided take fixture did not produce a reading')
  }

  return {
    id,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    source: 'guided',
    comparisonKey: GUIDED_PROTOCOL.comparisonFingerprint,
    contextVersion: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
    capturedAt,
    durationMs: GUIDED_PROTOCOL.task.durationMilliseconds,
    mimeType: 'audio/webm',
    sizeBytes: 100,
    peaks: [0.2],
    title: GUIDED_VOICE_TAKE_TITLE,
    favorite: false,
    contextJson: JSON.stringify({
      kind: 'guided-focus-take',
      version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
      assessment: result.persistedContext,
      reading: result.reading,
    }),
  }
}

function corruptGuidedTake(id: string): VoiceTakeRecord {
  return {
    id,
    createdAt: '2026-08-12T12:00:00.000Z',
    updatedAt: '2026-08-12T12:00:00.000Z',
    source: 'guided',
    comparisonKey: 'guided:corrupt-pitch-centre',
    contextVersion: 1,
    capturedAt: '2026-08-12T12:00:00.000Z',
    durationMs: 6_000,
    mimeType: 'audio/webm',
    sizeBytes: 100,
    peaks: [0.2],
    title: 'Pitch Centre',
    favorite: false,
    contextJson: '{',
  }
}

describe('voice history playback requests', () => {
  it('lets only the latest asynchronous playback request commit', async () => {
    let resolveEarlier: (() => void) | undefined
    let resolveLater: (() => void) | undefined
    const earlierLoaded = new Promise<void>((resolve) => {
      resolveEarlier = resolve
    })
    const laterLoaded = new Promise<void>((resolve) => {
      resolveLater = resolve
    })
    const committed: string[] = []
    const gate = createPlaybackRequestGate()

    const earlierIsCurrent = gate.begin()
    const earlierRequest = earlierLoaded.then(() => {
      if (earlierIsCurrent()) committed.push('earlier')
    })
    const laterIsCurrent = gate.begin()
    const laterRequest = laterLoaded.then(() => {
      if (laterIsCurrent()) committed.push('later')
    })

    resolveLater?.()
    await laterRequest
    resolveEarlier?.()
    await earlierRequest

    expect(committed).toEqual(['later'])
  })

  it('invalidates a pending request when playback is disposed', () => {
    const gate = createPlaybackRequestGate()
    const requestIsCurrent = gate.begin()

    gate.cancel()

    expect(requestIsCurrent()).toBe(false)
  })
})

describe('voice history take mutations', () => {
  it('serializes rapid writes for the same take without blocking other takes', async () => {
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const queue = createTakeMutationQueue()
    const order: string[] = []

    const first = queue.enqueue('take-a', async () => {
      order.push('a1:start')
      await firstGate
      order.push('a1:end')
    })
    const second = queue.enqueue('take-a', async () => {
      order.push('a2')
    })
    const otherTake = queue.enqueue('take-b', async () => {
      order.push('b1')
    })

    await otherTake
    expect(order).toEqual(['a1:start', 'b1'])

    releaseFirst?.()
    await Promise.all([first, second])
    expect(order).toEqual(['a1:start', 'b1', 'a1:end', 'a2'])
  })

  it('continues a take queue after an earlier write fails', async () => {
    const queue = createTakeMutationQueue()
    const order: string[] = []

    const failed = queue.enqueue('take-a', async () => {
      throw new Error('storage unavailable')
    })
    const recovered = queue.enqueue('take-a', async () => {
      order.push('recovered')
    })

    await expect(failed).rejects.toThrow('storage unavailable')
    await recovered
    expect(order).toEqual(['recovered'])
  })
})

describe('voice history guided comparison groups', () => {
  it('keeps corrupt guided rows available without unlocking comparison', () => {
    const records = [corruptGuidedTake('take-a'), corruptGuidedTake('take-b')]

    const [thread] = buildVoiceThreads(records)

    expect(thread?.takes).toEqual(records)
    expect(thread?.comparisonTakes).toEqual([])
  })

  it('shows the persisted Focus reading for the selected Atlas take', () => {
    const earlier = validGuidedTake('take-earlier', '2026-08-12T12:00:00.000Z')
    const later = validGuidedTake('take-later', '2026-08-13T12:00:00.000Z')
    const [thread] = buildVoiceThreads([earlier, later])

    expect(findSavedGuidedFocus(thread!, earlier.id)?.take.id).toBe(earlier.id)
    expect(findSavedGuidedFocus(thread!, later.id)?.take.id).toBe(later.id)
  })

  it('fails closed for a corrupt selected take and uses only valid persisted Focus data', () => {
    const valid = validGuidedTake('take-valid', '2026-08-12T12:00:00.000Z')
    const corrupt = {
      ...corruptGuidedTake('take-corrupt'),
      comparisonKey: GUIDED_PROTOCOL.comparisonFingerprint,
      capturedAt: '2026-08-13T12:00:00.000Z',
    }
    const [thread] = buildVoiceThreads([valid, corrupt])

    expect(findSavedGuidedFocus(thread!, corrupt.id)?.take.id).toBe(valid.id)
    expect(
      findSavedGuidedFocus(buildVoiceThreads([corrupt])[0]!, corrupt.id),
    ).toBeNull()
  })
})
