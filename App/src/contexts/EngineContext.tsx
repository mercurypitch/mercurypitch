import type { JSX } from 'solid-js'
import { createContext, createEffect, createSignal, onCleanup, useContext, } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import { PracticeEngine } from '@/lib/practice-engine'
import * as appStoreCore from '@/stores/app-store'
import * as settingsStore from '@/stores/settings-store'
import * as transportStore from '@/stores/transport-store'

interface EngineContextValue {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
  ready: () => boolean
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider(props: { children: JSX.Element }) {
  const [ready, setReady] = createSignal(false)

  const audioEngine = new AudioEngine()

  // Initialize from storage/stores
  const savedVol = parseInt(localStorage.getItem('pp_volume') ?? '80', 10)
  audioEngine.setVolume((isNaN(savedVol) ? 80 : savedVol) / 100)
  audioEngine.setBpm(transportStore.bpm())
  audioEngine.syncFromAppStore(settingsStore.adsr())
  audioEngine.setReverbType(settingsStore.reverbConfig().type)
  audioEngine.setReverbWetness(settingsStore.reverbConfig().wetness)

  const playbackRuntime = new PlaybackRuntime({
    audioEngine,
    instrumentType: appStoreCore.instrument(),
  })

  const practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 })

  // Sync BPM
  createEffect(() => {
    audioEngine.setBpm(transportStore.bpm())
  })

  // Sync Instrument
  createEffect(() => {
    const inst = appStoreCore.instrument()
    audioEngine.setInstrument(inst)
  })

  // Sync ADSR
  createEffect(() => {
    audioEngine.syncFromAppStore(settingsStore.adsr())
  })

  // Sync Reverb
  createEffect(() => {
    audioEngine.setReverbWetness(settingsStore.reverbConfig().wetness)
  })

  let lastReverbType = settingsStore.reverbConfig().type
  createEffect(() => {
    const type = settingsStore.reverbConfig().type
    if (type !== lastReverbType) {
      lastReverbType = type
      audioEngine.setReverbType(type)
    }
  })

  // Sync Practice Engine settings
  createEffect(() => {
    const s = settingsStore.settings()
    practiceEngine.syncSettings({
      sensitivity: s.sensitivity,
      minConfidence: s.minConfidence,
      minAmplitude: s.minAmplitude,
      bands: s.bands.map((b) => ({ threshold: b.threshold, band: b.band })),
    })
  })

  setReady(true)

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
        ready,
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
