// ============================================================
// First Light counts its own share
// ============================================================
//
// The twin beat's Share button reported nothing at all: a card shared from
// onboarding was invisible in the funnel, so the only shares anyone could
// see came from the standalone Voice Mirror. It cannot borrow the Mirror's
// `card_shared` either — that name is a live Google Ads conversion and has
// to go on meaning a share from the Mirror, and mirrorEvents stores an event
// name and a client id and nothing else, so a surface needs its own name.
//
// What the share carries is pinned here too: a range read the twin beat
// called unclean never leaves in the record.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import type { MirrorResult, RangeResult } from '@/lib/mirror/metrics'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'

const mocks = vi.hoisted(() => ({
  shareVoiceprintRecord: vi.fn(),
  trackOnboarding: vi.fn(),
}))

vi.mock('@/lib/jam/media-errors', () => ({
  micPermissionState: (): Promise<string> => Promise.resolve('granted'),
}))

vi.mock('@/lib/voice-session', () => ({
  createVoiceSession: (): VoiceSession =>
    ({
      open: (): Promise<OpenResult> =>
        Promise.resolve({ ok: true } as OpenResult),
      probe: (): Promise<ProbeResult> => Promise.resolve('ok' as ProbeResult),
      arm: (): void => {},
      record: () => Promise.resolve([]),
      latest: () => null,
      latestSmoothed: () => null,
      level: (): number => 0,
      context: () => null,
      isOpen: (): boolean => false,
      devices: (): Promise<MediaDeviceInfo[]> => Promise.resolve([]),
      useDevice: (): Promise<ProbeResult> =>
        Promise.resolve('ok' as ProbeResult),
      close: (): void => {},
    }) as unknown as VoiceSession,
}))

vi.mock('@/features/mirror/voiceprint-share', () => ({
  shareVoiceprintRecord: mocks.shareVoiceprintRecord,
}))

// Only the counter is replaced: BEAT_EVENT is the beat-to-name table the
// flow itself walks on, and a stub of it would break every other beat.
vi.mock('@/features/onboarding/funnel', async (importOriginal) => {
  const actual = await importOriginal<typeof OnboardingFunnelModule>()
  return { ...actual, trackOnboarding: mocks.trackOnboarding }
})

import { FirstLight } from '@/features/onboarding/FirstLight'
import { openBeat, recordVoiceprint, resetOnboarding, } from '@/stores/onboarding-store'

/** A baritone-ish span, enough for the twin beat to name a legend. */
const RANGE: RangeResult = {
  lowMidi: 45,
  highMidi: 69,
  lowNote: 'A2',
  highNote: 'A4',
  semitones: 24,
  qualifyingMidis: [45, 50, 57, 62, 69],
  voiceHint: 'baritone',
}
const RESULT: MirrorResult = {
  range: RANGE,
  accuracy: null,
  steadiness: null,
}

/** Render First Light and stand on the twin beat with a voiceprint in hand. */
async function atTwinBeat(result: MirrorResult = RESULT): Promise<void> {
  render(() => <FirstLight />)
  recordVoiceprint(result)
  openBeat('twin')
  await screen.findByRole('button', { name: 'Share now' })
}

describe('First Light share metric', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetOnboarding()
    // jsdom ships no matchMedia; the star field asks for reduced-motion.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    resetOnboarding()
  })

  it.each(['shared', 'downloaded', 'downloaded-link-copied'] as const)(
    'counts a share that left as %s',
    async (outcome) => {
      mocks.shareVoiceprintRecord.mockResolvedValue(outcome)
      await atTwinBeat()

      fireEvent.click(screen.getByRole('button', { name: 'Share now' }))

      await waitFor(() => {
        expect(mocks.trackOnboarding).toHaveBeenCalledWith('onboarding_share')
      })
    },
  )

  it.each(['dismissed', 'unavailable'] as const)(
    'counts nothing when the share ended as %s',
    async (outcome) => {
      mocks.shareVoiceprintRecord.mockResolvedValue(outcome)
      await atTwinBeat()

      fireEvent.click(screen.getByRole('button', { name: 'Share now' }))

      await waitFor(() => {
        expect(mocks.shareVoiceprintRecord).toHaveBeenCalled()
      })
      expect(mocks.trackOnboarding).not.toHaveBeenCalledWith('onboarding_share')
    },
  )

  it('shares no range the twin could not read', async () => {
    // Arrange: a steady tone reads A3 to A3, 0 semitones, no voice type.
    mocks.shareVoiceprintRecord.mockResolvedValue('unavailable')
    await atTwinBeat({
      range: {
        lowMidi: 57,
        highMidi: 57,
        lowNote: 'A3',
        highNote: 'A3',
        semitones: 0,
        qualifyingMidis: [57],
        voiceHint: null,
      },
      accuracy: { score: 100, takes: [], scoopMedianMs: null },
      steadiness: null,
    })

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Share now' }))

    // Assert: the record that would leave carries the score and no range.
    await waitFor(() => {
      expect(mocks.shareVoiceprintRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: {
            lowMidi: null,
            highMidi: null,
            semitones: null,
            accuracy: 100,
            steadiness: null,
          },
        }),
        'face',
      )
    })
  })
})
