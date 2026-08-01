// ============================================================
// usePianoRollEvents — bridges eventBus messages into app state
// ============================================================
//
// The canvas piano roll is not a Solid component, so it cannot call stores
// directly. It emits on @/lib/event-bus instead, and this hook subscribes and
// translates those into store writes (tempo, scale, melody edits). Mount once,
// alongside the editor.

import type { Accessor, Setter } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { eventBus } from '@/lib/event-bus'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import { keyName, setScaleType } from '@/stores'
import { melodyStore } from '@/stores/melody-store'

interface PianoRollEventsDeps {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  setCurrentBeat: Setter<number>
}

export function usePianoRollEvents(deps: PianoRollEventsDeps): void {
  const { playbackRuntime, setCurrentBeat } = deps

  const handleOctaveChange = (detail: {
    octave: number
    numOctaves: number
  }) => {
    melodyStore.setOctave(detail.octave)
    melodyStore.setNumOctaves(detail.numOctaves)
  }

  const handleModeChange = (detail: { mode: string }) => {
    setScaleType(detail.mode)
    // refreshScale is the store's canonical scale write — it records
    // _scaleKey/_scaleType so later setOctave/setNumOctaves rebuild with
    // the SAME type. Setting only the app-store signal here left the
    // store tracking 'major': the toolbar's Rows +/- then rebuilt the
    // grid in C major while the Scale select still showed the user's
    // choice, and every note outside C major turned hatched "off-scale".
    melodyStore.refreshScale(
      keyName(),
      melodyStore.getCurrentOctave(),
      detail.mode,
    )
  }

  const handleSeek = (detail: { beat: number }) => {
    const targetBeat = detail.beat as number
    playbackRuntime.seekTo(targetBeat)
    setCurrentBeat(targetBeat)
  }

  let unsubs: Array<() => void> = []

  onMount(() => {
    unsubs = [
      eventBus.on('pitchperfect:octaveChange', handleOctaveChange),
      eventBus.on('pitchperfect:modeChange', handleModeChange),
      eventBus.on('pitchperfect:seekToBeat', handleSeek),
    ]
  })

  onCleanup(() => {
    unsubs.forEach((fn) => fn())
  })
}
