import { onCleanup, onMount, type Accessor, type Setter } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { PlaybackRuntime } from '@/lib/playback-runtime'
import { appStore } from '@/stores'
import { melodyStore } from '@/stores/melody-store'

interface PianoRollEventsDeps {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  setCurrentBeat: Setter<number>
}

export function usePianoRollEvents(deps: PianoRollEventsDeps): void {
  const { audioEngine, playbackRuntime, isPlaying, isPaused, setCurrentBeat } =
    deps

  const handlePresetSaved = (e: Event) => {
    const detail = (e as CustomEvent).detail
    appStore.showNotification(`Preset "${detail.name}" saved`, 'success')
  }

  const handlePresetLoaded = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail.bpm !== undefined && detail.bpm !== '') {
      appStore.setBpm(detail.bpm)
      audioEngine.setBPM(detail.bpm)
    }
    if (detail.melody !== undefined) {
      melodyStore.setMelody(detail.melody)
    }
    appStore.showNotification(`Preset "${detail.name}" loaded`, 'info')
  }

  const handleOctaveChange = (e: Event) => {
    const detail = (e as CustomEvent).detail
    melodyStore.setOctave(detail.octave)
    melodyStore.setNumOctaves(detail.numOctaves)
  }

  const handleModeChange = (e: Event) => {
    const detail = (e as CustomEvent).detail
    appStore.setScaleType(detail.mode)
  }

  const handleSeek = (e: Event) => {
    if (!isPlaying() && !isPaused()) return
    const detail = (e as CustomEvent).detail
    const targetBeat = detail.beat as number
    playbackRuntime.seekTo(targetBeat)
    setCurrentBeat(targetBeat)
  }

  onMount(() => {
    window.addEventListener('pitchperfect:presetSaved', handlePresetSaved)
    window.addEventListener('pitchperfect:presetLoaded', handlePresetLoaded)
    window.addEventListener('pitchperfect:octaveChange', handleOctaveChange)
    window.addEventListener('pitchperfect:modeChange', handleModeChange)
    window.addEventListener('pitchperfect:seekToBeat', handleSeek)
  })

  onCleanup(() => {
    window.removeEventListener('pitchperfect:presetSaved', handlePresetSaved)
    window.removeEventListener('pitchperfect:presetLoaded', handlePresetLoaded)
    window.removeEventListener('pitchperfect:octaveChange', handleOctaveChange)
    window.removeEventListener('pitchperfect:modeChange', handleModeChange)
    window.removeEventListener('pitchperfect:seekToBeat', handleSeek)
  })
}
