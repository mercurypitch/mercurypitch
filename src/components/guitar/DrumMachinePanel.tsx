// ============================================================
// DrumMachinePanel — interactive drum pattern editor
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, untrack } from 'solid-js'
import type { DrumMachine } from '@/lib/guitar/drum-machine'
import type { DrumPattern, DrumSound, PresetName, } from '@/lib/guitar/drum-machine'
import { DRUM_SOUNDS } from '@/lib/guitar/drum-machine'

interface DrumMachinePanelProps {
  drumMachine: DrumMachine
}

const SOUND_LABELS: Record<DrumSound, string> = {
  kick: 'Kick',
  snare: 'Snare',
  'hh-closed': 'HH C',
  'hh-open': 'HH O',
  'tom-high': 'Tom H',
  'tom-mid': 'Tom M',
  'tom-low': 'Tom L',
  crash: 'Crash',
}

const PRESET_LABELS: { value: PresetName; label: string }[] = [
  { value: 'basic-rock', label: 'Basic Rock' },
  { value: 'funk', label: 'Funk' },
  { value: 'hip-hop', label: 'Hip Hop' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'latin', label: 'Latin' },
  { value: 'empty', label: 'Empty' },
]

export const DrumMachinePanel: Component<DrumMachinePanelProps> = (props) => {
  const dm = untrack(() => props.drumMachine)
  const [pattern, setPattern] = createSignal<DrumPattern>(dm.pattern)
  const [bpm, setBpm] = createSignal(dm.bpm)
  const [playing, setPlaying] = createSignal(dm.playing)
  const [currentStep, setCurrentStep] = createSignal(dm.currentStep)
  const [volumes, setVolumes] = createSignal(dm.volumes)

  // Subscribe to drum machine state changes
  createEffect(() => {
    const unsub = props.drumMachine.onChange(() => {
      const dm = untrack(() => props.drumMachine)
      setPattern({ ...dm.pattern })
      setPlaying(dm.playing)
      setCurrentStep(dm.currentStep)
      setBpm(dm.bpm)
      setVolumes({ ...dm.volumes })
    })
    // `createEffect`'s return value is passed as the `prev` arg to its
    // next run, not treated as a cleanup — the subscription needs an
    // explicit onCleanup or it leaks on every re-run/unmount.
    onCleanup(unsub)
  })

  const handleToggleStep = (sound: DrumSound, step: number) => {
    props.drumMachine.toggleStep(sound, step)
    setPattern({ ...props.drumMachine.pattern })
  }

  const handlePresetChange = (preset: PresetName) => {
    props.drumMachine.loadPreset(preset)
    setPattern({ ...props.drumMachine.pattern })
    setBpm(props.drumMachine.bpm)
  }

  const handleBpmChange = (value: number) => {
    props.drumMachine.setBpm(value)
    setBpm(value)
  }

  const handleVolumeChange = (sound: DrumSound, value: number) => {
    props.drumMachine.setVolume(sound, value)
    setVolumes({ ...props.drumMachine.volumes })
  }

  const handleClear = () => {
    props.drumMachine.clearPattern()
    setPattern({ ...props.drumMachine.pattern })
  }

  const handleTrigger = (sound: DrumSound) => {
    props.drumMachine.trigger(sound)
  }

  const handleTogglePlay = () => {
    if (props.drumMachine.playing) {
      props.drumMachine.stop()
    } else {
      props.drumMachine.start()
    }
  }

  return (
    <div class="drum-machine-panel">
      <div class="dm-header">
        <h3 class="dm-title">Drum Machine</h3>
        <button class="dm-btn dm-btn-play" onClick={handleTogglePlay}>
          {playing() ? 'Stop' : 'Play'}
        </button>
        <div class="dm-status">{playing() ? 'Playing' : 'Stopped'}</div>
      </div>

      {/* Preset selector */}
      <div class="dm-control-row">
        <label class="dm-label">Preset</label>
        <select
          class="dm-select"
          onChange={(e) =>
            handlePresetChange(e.currentTarget.value as PresetName)
          }
        >
          <For each={PRESET_LABELS}>
            {(p) => <option value={p.value}>{p.label}</option>}
          </For>
        </select>
        <button class="dm-btn dm-btn-clear" onClick={handleClear}>
          Clear
        </button>
      </div>

      {/* BPM control */}
      <div class="dm-control-row">
        <label class="dm-label">BPM</label>
        <input
          type="range"
          class="dm-slider"
          min="40"
          max="300"
          step="1"
          value={bpm()}
          onInput={(e) => handleBpmChange(Number(e.currentTarget.value))}
        />
        <span class="dm-bpm-value">{bpm()}</span>
      </div>

      {/* Pattern grid */}
      <div class="dm-grid">
        <div class="dm-grid-header">
          <div class="dm-sound-col" />
          <For each={Array.from({ length: 16 }, (_, i) => i)}>
            {(step) => (
              <div
                class="dm-step-header"
                classList={{
                  'dm-beat-accent': step % 4 === 0,
                  'dm-step-current': step === currentStep(),
                }}
              >
                {step + 1}
              </div>
            )}
          </For>
        </div>
        <For each={DRUM_SOUNDS}>
          {(sound) => (
            <div class="dm-row">
              <div class="dm-sound-col">
                <button
                  class="dm-sound-trigger"
                  onClick={() => handleTrigger(sound)}
                  title={`Test ${SOUND_LABELS[sound]}`}
                >
                  {SOUND_LABELS[sound]}
                </button>
              </div>
              <For each={Array.from({ length: 16 }, (_, i) => i)}>
                {(step) => (
                  <button
                    class="dm-step"
                    classList={{
                      'dm-step-on': pattern()[sound]?.[step] ?? false,
                      'dm-beat-accent': step % 4 === 0,
                      'dm-step-current': step === currentStep(),
                    }}
                    onClick={() => handleToggleStep(sound, step)}
                    title={`${SOUND_LABELS[sound]} step ${step + 1}`}
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </div>

      {/* Volume controls */}
      <div class="dm-volume-section">
        <For each={DRUM_SOUNDS}>
          {(sound) => (
            <div class="dm-volume-row">
              <label class="dm-volume-label">{SOUND_LABELS[sound]}</label>
              <input
                type="range"
                class="dm-volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={volumes()[sound]}
                onInput={(e) =>
                  handleVolumeChange(sound, Number(e.currentTarget.value))
                }
              />
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
