// ============================================================
// Beside Cue app config — immutable product and onboarding contract
// ============================================================

import type { PullOption } from './content'
import { bSideAcknowledgements, cuePhrases, notNowAcknowledgements, pullOptions, } from './content'
import type { CinematicOnboardingMediaManifest, LegacyCinematicOnboardingMediaManifestV03, LegacyCinematicOnboardingMediaManifestV04, } from './onboarding'

export interface DailyCuePreset {
  readonly id: string
  readonly label: string
  readonly localTime: string
  readonly note: string
}

export interface DailyCueConfig {
  readonly presets: readonly DailyCuePreset[]
  readonly channel: {
    readonly id: string
    readonly name: string
    readonly description: string
  }
  readonly notification: {
    readonly title: string
    readonly body: string
  }
}

export type BesideCueOnboardingConfig =
  | {
      /** Architecture is present, but Welcome remains the first-run surface. */
      readonly delivery: 'welcome-only'
      readonly revision: string
      readonly contractVersion: '0.2.0'
    }
  | {
      /** Deprecated contract shape retained for test/integration migration. */
      readonly delivery: 'cinematic-first-run'
      readonly revision: string
      readonly contractVersion: '0.3.0'
      readonly media: LegacyCinematicOnboardingMediaManifestV03
    }
  | {
      /** Deprecated pre-breath delivery retained for fail-closed migration. */
      readonly delivery: 'cinematic-first-run'
      readonly revision: string
      readonly contractVersion: '0.4.0'
      readonly media: LegacyCinematicOnboardingMediaManifestV04
    }
  | {
      /** Approved cinematic delivery requires the complete v0.5 media clock. */
      readonly delivery: 'cinematic-first-run'
      readonly revision: string
      readonly contractVersion: '0.5.0'
      readonly media: CinematicOnboardingMediaManifest
    }
  | {
      /** Caption-first V2 is the shipped first-run experience. */
      readonly delivery: 'v2-first-run'
      readonly revision: string
      readonly contractVersion: '1.0'
    }

export interface BesideCueAppConfig {
  readonly mascotSetId: string
  readonly onboarding: BesideCueOnboardingConfig
  readonly pullOptions: readonly PullOption[]
  readonly cuePhrases: readonly string[]
  readonly bSideAcknowledgements: readonly string[]
  readonly notNowAcknowledgements: readonly string[]
  readonly dailyCue: DailyCueConfig
}

/**
 * Product copy and starter choices live behind one immutable boundary. A future
 * experiment can replace this object without changing the cue domain or device
 * adapters.
 */
export const DEFAULT_BESIDE_CUE_CONFIG: BesideCueAppConfig = Object.freeze({
  mascotSetId: 'corktop-v1',
  onboarding: Object.freeze({
    delivery: 'v2-first-run',
    revision: 'beside-cue-v2.5-main-v1',
    contractVersion: '1.0',
  }),
  pullOptions,
  cuePhrases,
  bSideAcknowledgements,
  notNowAcknowledgements,
  dailyCue: Object.freeze({
    presets: Object.freeze([
      Object.freeze({
        id: 'morning',
        label: 'Morning',
        localTime: '09:00',
        note: 'A small beginning',
      }),
      Object.freeze({
        id: 'midday',
        label: 'Midday',
        localTime: '13:00',
        note: 'A quiet reset',
      }),
      Object.freeze({
        id: 'evening',
        label: 'Evening',
        localTime: '18:30',
        note: 'Before the day slips away',
      }),
    ]),
    channel: Object.freeze({
      id: 'beside-cue-gentle',
      name: 'Gentle cues',
      description: 'Discreet reminders for the cue you chose.',
    }),
    notification: Object.freeze({
      title: 'A small cue is ready',
      body: 'Open Beside Cue when you choose.',
    }),
  }),
})
