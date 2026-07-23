import type { JSX } from 'solid-js'
import { createContext, createEffect, createSignal, onCleanup, useContext, } from 'solid-js'
import { TAB_SINGING } from '@/features/tabs/constants'
import { AudioEngine } from '@/lib/audio-engine'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import { PracticeEngine } from '@/lib/practice-engine'
import { storageGet } from '@/lib/storage'
import * as appStoreCore from '@/stores/app-store'
import * as settingsStore from '@/stores/settings-store'
import * as transportStore from '@/stores/transport-store'
import * as uiStore from '@/stores/ui-store'

interface EngineContextValue {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
  ready: () => boolean
}

export const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider(props: { children: JSX.Element }) {
  const [ready, setReady] = createSignal(false)

  const audioEngine = new AudioEngine()
  const uninstallAudioUnlock = installAudioUnlock(() =>
    audioEngine.getAudioContext(),
  )

  // Initialize from storage/stores
  const savedVol = parseInt(storageGet('pp_volume', '80')!, 10)
  audioEngine.setVolume((isNaN(savedVol) ? 80 : savedVol) / 100)
  audioEngine.setBpm(transportStore.bpm() * transportStore.playbackSpeed())
  audioEngine.syncFromAppStore(settingsStore.adsr())
  audioEngine.setReverbType(settingsStore.reverbConfig().type)
  audioEngine.setReverbWetness(settingsStore.reverbConfig().wetness)

  const playbackRuntime = new PlaybackRuntime({
    audioEngine,
    instrumentType: appStoreCore.instrument(),
  })

  const practiceEngine = new PracticeEngine(audioEngine, { sensitivity: 5 })

  // Sync BPM (effective BPM = melody BPM × user's playback speed multiplier).
  // The runtime's tick loop computes beat duration as `60000 / audioEngine.getBpm()`,
  // so multiplying here is the single source of truth for "play 80 BPM at 2x → 160 BPM"
  // semantics and keeps the metronome in sync with the playhead.
  createEffect(() => {
    audioEngine.setBpm(transportStore.bpm() * transportStore.playbackSpeed())
  })

  // Sync Instrument
  //
  // Two sources can drive the playback timbre:
  //   1) the instrument dropdown in Settings/Editor (`appStoreCore.instrument()`)
  //   2) the selected character (`settingsStore.selectedCharacter()`)
  //      when "Character Sounds" is enabled AND the active tab is Practice.
  // The character mapping wins only in the practice tab so each persona
  // sounds distinct during vocal exercises, while the editor always
  // respects the user's explicit instrument dropdown choice. Flipping
  // the toggle or switching tabs immediately re-evaluates — no reload
  // required, because this whole effect re-runs reactively.
  createEffect(() => {
    const useCharacter = settingsStore.characterSounds()
    const character = settingsStore.selectedCharacter()
    const tab = uiStore.activeTab()

    audioEngine.setCharacterSoundsEnabled(useCharacter && tab === TAB_SINGING)
    audioEngine.setSelectedCharacter(character)
  })

  createEffect(() => {
    const userInstrument = appStoreCore.instrument()
    audioEngine.setInstrument(userInstrument)
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
    const algo = settingsStore.pitchAlgorithm()
    const bufSize = settingsStore.pitchBufferSize()
    // Keep the AudioEngine's AnalyserNode fftSize in sync with the
    // PitchDetector's expected buffer size. Without this the detector
    // receives fewer samples than it expects (e.g. 2048 vs 4096),
    // causing out-of-bounds NaN reads and silent detection failures.
    audioEngine.setBufferSize(bufSize)
    const s = settingsStore.settings()
    practiceEngine.syncSettings({
      sensitivity: s.sensitivity,
      minConfidence: s.minConfidence,
      minAmplitude: s.minAmplitude,
      bands: s.bands.map((b) => ({ threshold: b.threshold, band: b.band })),
      algorithm: algo,
      bufferSize: bufSize,
    })
  })

  setReady(true)

  onCleanup(() => {
    uninstallAudioUnlock()
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
