// Audio import actions share local preparation and explicit cloud-band choices without owning room state.
import type { NightMusicAction, NightMusicTask } from './night-music-import'
import type { NightAudioPreparationPort } from './prepare-night-music'

export interface NightSongReplacementPort {
  refreshLibrary(): Promise<boolean>
  replaceSession(
    id: string,
    task: NightMusicTask & { beforeCommit?: () => void },
  ): Promise<void>
}

export function nightAudioActions(
  file: File,
  options: {
    target: 'guitar' | 'drums'
    loadPreparationPort?: () => Promise<NightAudioPreparationPort>
    openSong(id: string, task: NightMusicTask): Promise<void>
    separateBand(id: string, task: NightMusicTask): Promise<void>
  },
): NightMusicAction[] {
  const prepare = async (task: NightMusicTask) => {
    const { prepareNightMusicAudio } = await import('./prepare-night-music')
    return prepareNightMusicAudio(file, task, options.loadPreparationPort)
  }
  return [
    {
      id: 'prepare-song',
      label: 'Prepare vocals + backing',
      detail:
        'On this device, with no cloud credits. Reuse a prepared copy when available. The backing still contains its original instruments.',
      run: async (task) => options.openSong(await prepare(task), task),
    },
    {
      id: 'prepare-band',
      label: `Separate ${options.target} + band`,
      detail:
        'Isolate guitar, bass, drums and keys for the mixer. A new cloud split uses credits; saved parts are reused first.',
      run: async (task) => options.separateBand(await prepare(task), task),
    },
  ]
}
