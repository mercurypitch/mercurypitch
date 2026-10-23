// ============================================================
// First Light fixture: what its test files share
// ============================================================
//
// FirstLight.test.tsx, FirstLight.plan.test.tsx and FirstLight.keys.test.tsx
// mount the real flow and fake only its edges: the microphone, the canvases
// jsdom cannot draw, the funnel, the promo and gift stores, the GPU gate and
// the page tours. This holds what each fake hands back, the things the fakes
// record, and the voiceprints the flow is shown. src/tests/onboarding-focus
// .test.tsx borrows the first three fakes.
//
// A fixture cannot register a file's mocks for it (vi.mock is hoisted within
// the file that writes it), so each test file keeps its own vi.mock calls and
// hands each one a factory from `fake`, loaded from inside it:
//
//   vi.mock('@/lib/voice-session', async () =>
//     (await import('./FirstLight.fixture')).fake.voiceSession(),
//   )
//
// Nothing here imports the app, only its types. The factories run while the
// flow's own imports are still loading, and a fixture that imported a store
// or the funnel would wait on the very mock that is waiting for it.

import { createEffect, createSignal } from 'solid-js'
import { vi } from 'vitest'
import type * as OnboardingFunnelModule from '@/features/onboarding/funnel'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import type { MirrorResult } from '@/lib/mirror/metrics'
import type { OpenResult, ProbeResult, VoiceSession } from '@/lib/voice-session'
import type * as AppStoreModule from '@/stores/app-store'

/** What the fakes record, for a case to read. */
export const mocks = {
  /** The funnel's events, as the flow reports them. */
  trackOnboarding: vi.fn(),
  /** The page tours the flow asked for. */
  startPageTour: vi.fn(),
  /** What the star field (when it is `fake.watchedStarField`) was last told about being paused. */
  starFieldPaused: null as boolean | null,
}

/** The helper vitest hands a factory, which loads the module as it really is. */
type ImportOriginal = <T>() => Promise<T>

/** One factory per module the flow's tests fake; each is the body of a `vi.mock`. */
export const fake = {
  /** The microphone is allowed. */
  micPermission: () => ({
    micPermissionState: (): Promise<string> => Promise.resolve('granted'),
  }),

  /** A voice session that opens and probes fine and hears nothing. */
  voiceSession: () => ({
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
  }),

  /** jsdom cannot draw: the star field's canvas is left out. */
  starField: () => ({ StarField: () => null }),

  /** The star field is left out too, but what it is told about stepping aside is kept, since that is the one thing it is asked. */
  watchedStarField: () => ({
    StarField: (props: { paused?: boolean }) => {
      createEffect(() => {
        mocks.starFieldPaused = props.paused ?? false
      })
      return null
    },
  }),

  /** The voiceprint's demo is a canvas. */
  taskDemo: () => ({ TaskDemo: () => null }),

  /** So is its live trace. */
  liveViz: () => ({ LiveViz: () => null }),

  /** And the prints' cards. */
  voiceprintCard: () => ({
    renderVoiceprintCard: async () => null,
  }),

  /** The funnel as it is, except that its events are recorded in `mocks.trackOnboarding` and sent nowhere. */
  funnel: async (importOriginal: ImportOriginal) => ({
    ...(await importOriginal<typeof OnboardingFunnelModule>()),
    trackOnboarding: mocks.trackOnboarding,
  }),

  /** The server's promo is never asked, and none is on offer. */
  promoStore: () => {
    const [offer] = createSignal(null)
    return { offeredPromo: offer, loadFeaturedPromo: async () => {} }
  },

  /** No gift is waiting. */
  giftStore: () => ({
    giftWaiting: () => null,
    rememberGiftOffered: () => {},
    claimGiftNow: async () => {},
  }),

  /** The questions' Merc asks the browser for WebGL, which jsdom cannot give: he is his still. */
  gpuGate: async (importOriginal: ImportOriginal) => ({
    ...(await importOriginal<typeof GpuGateModule>()),
    canRunLiveMerc: (): boolean => false,
  }),

  /** Starting a page tour opens a real walkthrough; the flow only has to ask, in `mocks.startPageTour`. */
  appStore: async (importOriginal: ImportOriginal) => ({
    ...(await importOriginal<typeof AppStoreModule>()),
    startPageTour: mocks.startPageTour,
  }),
}

/** A voiceprint with a range and nothing else measured: a baritone, E2 to G4. */
export const VOICEPRINT: MirrorResult = {
  range: {
    lowMidi: 40,
    highMidi: 67,
    lowNote: 'E2',
    highNote: 'G4',
    semitones: 27,
    qualifyingMidis: [40, 52, 67],
    voiceHint: 'baritone',
  },
  accuracy: null,
  steadiness: null,
}

/** One voiceprint already on this device: what a returning singer has, and what the Prints beat lists. */
export const SAVED_PRINT = {
  id: 'saved-1',
  takenAt: '2026-10-10T10:00:00.000Z',
  twin: null,
  source: 'mirror',
  summary: { lowMidi: 43, highMidi: 72, semitones: 29 },
}
