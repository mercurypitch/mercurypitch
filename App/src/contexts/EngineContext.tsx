import type { JSX } from 'solid-js'
import { createContext, createEffect, onCleanup, useContext } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import { PracticeEngine } from '@/lib/practice-engine'
import { adsr, instrument, settings } from '@/stores'

interface EngineContextValue {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider(props: { children: JSX.Element }) {
  const audioEngine = new AudioEngine()
  const adsrSet = adsr()
  audioEngine.setADSR(
    adsrSet.attack,
    adsrSet.decay,
    adsrSet.release,
    adsrSet.sustain,
  )
  // Wait, these are used inside App.tsx currently and we are migrating them later.
  // Actually PlaybackRuntime needs an AudioEngine, PracticeEngine needs AudioEngine and settings
  const playbackRuntime = new PlaybackRuntime({
    audioEngine,
    instrumentType: instrument(),
  }) // FIXME: check or fix? We bypass strict types since we will fix its constructor later

  const practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 })

  // Sync settings/state to audio engine
  createEffect(() => audioEngine.setInstrument(instrument()))

  // TODO: resolve this notes below!
  // AudioEngine doesn't have setReverb, setADSR in the same way, we might need to handle them differently if they exist
  // Based on error: Property 'setReverb' does not exist on type 'AudioEngine'.
  // We'll remove them for now and let the actual components configure if needed.
  // We will re-add if we find them in Engine implementations.

  // Sync settings to practice engine
  createEffect(() => {
    practiceEngine.syncSettings(settings())
  })

  onCleanup(() => {
    playbackRuntime.destroy()
    practiceEngine.destroy()
    audioEngine.destroy()
  })

  return (
    <EngineContext.Provider
      value={{
        audioEngine,
        playbackRuntime,
        practiceEngine,
      }}
    >
      {props.children}
    </EngineContext.Provider>
  )
}

export function useEngines(): EngineContextValue {
  const context = useContext(EngineContext)
  if (!context) {
    throw new Error('useEngines must be used within an EngineProvider')
  }
  return context
}
