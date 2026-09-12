// Night music preparation adapts the existing durable UVR pipeline without owning a player.
import type { UvrSongPreparationResult, UvrSongPreparationUpdate, } from '@/lib/uvr-song-preparation'
import type { NightMusicTask } from './night-music-import'

export interface NightAudioPreparationPort {
  prepare(
    file: File,
    options: {
      signal: AbortSignal
      onUpdate: (update: UvrSongPreparationUpdate) => void
      onWarning: (message: string) => void
    },
  ): Promise<UvrSongPreparationResult>
}

export async function prepareNightMusicAudio(
  file: File,
  task: NightMusicTask,
  loadPort?: () => Promise<NightAudioPreparationPort>,
): Promise<string> {
  task.assertCurrent()
  const options = {
    signal: task.signal,
    onUpdate: (update: UvrSongPreparationUpdate) =>
      task.report(
        {
          'checking-library': 'Checking for an already prepared song…',
          'saving-original': 'Saving your original on this device…',
          preparing: 'Preparing on this device…',
          separating: 'Separating vocals and backing on this device…',
          finalizing: 'Saving the prepared song…',
        }[update.phase],
        update.progress === null ? undefined : update.progress / 100,
      ),
    onWarning: (message: string) => (task.warn ?? task.report)(message),
  }
  const prepare = loadPort
    ? (await loadPort()).prepare
    : async (source: File, preparation: typeof options) =>
        (await import('@/lib/uvr-song-preparation')).prepareUvrSong(source, {
          ...preparation,
          mode: 'local',
          focus: false,
          onWarning: (warning) => preparation.onWarning(warning.message),
        })
  task.assertCurrent()
  const result = await prepare(file, options)
  task.assertCurrent()
  if (result.status === 'cancelled')
    throw new DOMException('Cancelled', 'AbortError')
  if (result.status === 'error') throw new Error(result.message)
  if (result.status === 'in-flight')
    throw new Error(
      'This song is already being prepared. Your current music is unchanged. Open it from the song library when preparation finishes, or retry this file then.',
    )
  return result.sessionId
}
