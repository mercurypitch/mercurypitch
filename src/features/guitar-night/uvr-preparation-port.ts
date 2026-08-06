// ============================================================
// UVR preparation port gives Guitar Night a lazy, on-device preparation adapter
// ============================================================

import { prepareUvrSong } from '@/lib/uvr-song-preparation'
import type { GuitarNightPreparationPort } from './preparation-port'

export function createUvrGuitarNightPreparationPort(): GuitarNightPreparationPort {
  return {
    prepare: async (file, options) => {
      const result = await prepareUvrSong(file, {
        mode: 'local',
        focus: false,
        signal: options.signal,
        onUpdate: options.onUpdate,
        onWarning: (warning) => options.onWarning(warning.message),
      })
      if (result.status === 'in-flight') {
        if (result.requiresHydration === true) {
          const { refreshUvrSessionFromDb } = await import('@/stores/uvr-store')
          if (!(await refreshUvrSessionFromDb(result.sessionId))) {
            return {
              status: 'error',
              sessionId: result.sessionId,
              message:
                'The existing preparation could not be reconnected. Reload and try again.',
            }
          }
        }
        const { autoResumeServerSessions } =
          await import('@/lib/uvr-auto-resume')
        await autoResumeServerSessions()
      }
      return result
    },
  }
}
