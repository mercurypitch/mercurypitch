import type { PullOption } from './content'
import { bSideAcknowledgements, cuePhrases, notNowAcknowledgements, pullOptions, } from './content'

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

export interface BesideCueAppConfig {
  readonly mascotSetId: string
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
