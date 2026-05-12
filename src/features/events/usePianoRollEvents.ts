import type { Accessor, Setter } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { eventBus } from '@/lib/event-bus'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import { setBpm, setScaleType, showNotification } from '@/stores'
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

  const handlePresetSaved = (detail: { name: string }) => {
    showNotification(`Preset "${detail.name}" saved`, 'success')
  }

  const handlePresetLoaded = (detail: {
    name: string
    bpm?: number
    melody?: unknown
  }) => {
    if (detail.bpm !== undefined) {
      setBpm(detail.bpm)
      audioEngine.setBPM(detail.bpm)
    }
    if (detail.melody !== undefined) {
      melodyStore.setMelody(detail.melody as never)
    }
    showNotification(`Preset "${detail.name}" loaded`, 'info')
  }

  const handleOctaveChange = (detail: {
    octave: number
    numOctaves: number
  }) => {
    melodyStore.setOctave(detail.octave)
    melodyStore.setNumOctaves(detail.numOctaves)
  }

  const handleModeChange = (detail: { mode: string }) => {
    setScaleType(detail.mode)
  }

  const handleSeek = (detail: { beat: number }) => {
    if (!isPlaying() && !isPaused()) return
    const targetBeat = detail.beat as number
    playbackRuntime.seekTo(targetBeat)
    setCurrentBeat(targetBeat)
  }

  let unsubs: Array<() => void> = []

  onMount(() => {
    unsubs = [
      eventBus.on('pitchperfect:presetSaved', handlePresetSaved),
      eventBus.on('pitchperfect:presetLoaded', handlePresetLoaded),
      eventBus.on('pitchperfect:octaveChange', handleOctaveChange),
      eventBus.on('pitchperfect:modeChange', handleModeChange),
      eventBus.on('pitchperfect:seekToBeat', handleSeek),
    ]
  })

  onCleanup(() => {
    unsubs.forEach((fn) => fn())
  })
}
