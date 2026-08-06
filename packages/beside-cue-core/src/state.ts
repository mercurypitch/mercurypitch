// ============================================================
// Beside Cue initial state — explicit schema and privacy-first defaults
// ============================================================

import type { AppSettings, BesideCueStateV1 } from './types'

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze({
  quietHours: Object.freeze({
    enabled: false,
    start: '22:00',
    end: '08:00',
  }),
  lockScreenDetail: 'discreet',
  scheduledSoundEnabled: false,
  acknowledgementSoundEnabled: false,
  hapticsEnabled: true,
  voiceEnabled: false,
  motion: 'system',
  locale: 'en',
})

export function createInitialState(
  settings: AppSettings = DEFAULT_APP_SETTINGS,
): BesideCueStateV1 {
  return {
    schema: { schemaVersion: 1, completedMigrationVersion: 1 },
    cues: [],
    scheduleRules: [],
    occurrences: [],
    settings: {
      ...settings,
      quietHours: { ...settings.quietHours },
    },
  }
}
