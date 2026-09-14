// Night audio preferences remember explicit per-room automation without storing pending files.
import type { NightMusicRoom } from './night-music-import'

export interface NightAudioPreferences {
  auto: boolean
  output: 'vocals' | 'band'
}
const key = (room: NightMusicRoom) => `pitchperfect_night_audio_${room}`

export function readNightAudioPreferences(
  room: NightMusicRoom,
): NightAudioPreferences {
  try {
    const saved = JSON.parse(
      localStorage.getItem(key(room)) ?? 'null',
    ) as Partial<NightAudioPreferences> | null
    return {
      auto: saved?.auto === true,
      output: saved?.output === 'band' ? 'band' : 'vocals',
    }
  } catch {
    return { auto: false, output: 'vocals' }
  }
}

export function saveNightAudioPreferences(
  room: NightMusicRoom,
  value: NightAudioPreferences,
): boolean {
  try {
    localStorage.setItem(key(room), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
