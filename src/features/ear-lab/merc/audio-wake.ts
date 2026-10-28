// ============================================================
// The tap that opens a run is the one iOS lets start audio: every door
// into a run (a station row, Today, the plate's next, a lead pad, a
// sheet's Begin) wakes the audio on it, before the drill's first sound.
// ============================================================

import { useContext } from 'solid-js'
import { EngineContext } from '@/contexts/EngineContext'
import { activateAudioPlayback, unlockAudio } from '@/lib/audio-unlock'

/** Wakes the app's audio inside the press that calls it. */
export function useWakeAudio(): () => void {
  const engines = useContext(EngineContext)
  return () => {
    const engine = engines?.audioEngine
    if (engine) {
      void activateAudioPlayback(engine).catch(() => {
        // Not in a gesture iOS accepted: the next tap retries.
      })
    } else {
      unlockAudio(null)
    }
  }
}
