// ============================================================
// UVR Settings Component - Vocal Separation Controls
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { createEffect, createSignal, onMount, Show } from 'solid-js'
import { getUvrInstrumentalIntensity, getUvrMode, getUvrSmoothing, getUvrVocalIntensity, setUvrInstrumentalIntensity, setUvrMode, setUvrSmoothing, setUvrVocalIntensity, } from '@/stores/app-store'

// ============================================================
// SVG Icons
// ============================================================

const IconVocal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2a5 5 0 0 0-5 5v7a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z" />
    <path d="M8 11a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0z" />
    <path d="M6 15a1 1 0 0 1 1 1v1a3 3 0 0 0 6 0v-1a1 1 0 0 1 1-1" />
  </svg>
)

const IconMusic = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

const IconDuo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="8" cy="6" r="3" />
    <path d="M6 9v3a3 3 0 0 0 6 0V9" />
    <circle cx="18" cy="9" r="3" />
    <path d="M16 12v3a3 3 0 0 0 6 0v-3" />
    <line x1="11" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="17" y2="12" />
  </svg>
)

const IconWaveform = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M2 12h3l2-4 3 8 3-6 3 6 3-8 3 4h3" />
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
)

// ============================================================
// Component
// ============================================================

type UvrMode = 'separate' | 'instrumental' | 'vocal' | 'duo'

export const UvrSettings: Component = () => {
  const [mode, setMode] = createSignal<UvrMode>('separate')
  const [vocalIntensity, setVocalIntensity] = createSignal(70)
  const [instrumentalIntensity, setInstrumentalIntensity] = createSignal(70)
  const [smoothing, setSmoothing] = createSignal(30)

  // Load from app store on mount
  onMount(() => {
    setMode(getUvrMode())
    setVocalIntensity(getUvrVocalIntensity())
    setInstrumentalIntensity(getUvrInstrumentalIntensity())
    setSmoothing(getUvrSmoothing())
  })

  // Save to app store when settings change
  createEffect(() => {
    setUvrMode(mode())
    setUvrVocalIntensity(vocalIntensity())
    setUvrInstrumentalIntensity(instrumentalIntensity())
    setUvrSmoothing(smoothing())
  })

  // Mode options
  const modeOptions = [
    {
      value: 'separate' as UvrMode,
      label: 'Separate',
      description: 'Vocals and instrumental separated',
      icon: <IconDuo />,
    },
    {
      value: 'instrumental' as UvrMode,
      label: 'Instrumental',
      description: 'Remove vocals, play only music',
      icon: <IconMusic />,
    },
    {
      value: 'vocal' as UvrMode,
      label: 'Vocal Only',
      description: 'Isolate vocals only',
      icon: <IconVocal />,
    },
  ]

  const handleModeChange = (newMode: UvrMode) => {
    setMode(newMode)
  }

  const handleIntensityChange = (
    type: 'vocal' | 'instrumental',
    value: number,
  ) => {
    if (type === 'vocal') {
      setVocalIntensity(value)
    } else {
      setInstrumentalIntensity(value)
    }
  }

  const handleSmoothingChange = (value: number) => {
    setSmoothing(value)
  }

  const saveSettings = () => {
    const settings = {
      mode: mode(),
      vocalIntensity: vocalIntensity(),
      instrumentalIntensity: instrumentalIntensity(),
      smoothing: smoothing(),
    }
    localStorage.setItem('pitchperfect_uvr-settings', JSON.stringify(settings))
  }

  return (
    <div class="uvr-settings">
      <div class="uvr-header">
        <h3>Vocal Separation (UVR)</h3>
        <p class="uvr-description">
          Control how vocals and instrumental tracks are processed during
          playback
        </p>
      </div>

      {/* Mode Selection */}
      <div class="uvr-mode-selection">
        <label>Separation Mode</label>
        <div class="mode-grid">
          <For each={modeOptions}>
            {(option) => (
              <button
                class={`mode-card ${mode() === option.value ? 'active' : ''}`}
                onClick={() => handleModeChange(option.value)}
                title={option.description}
              >
                <span class="mode-icon">{option.icon}</span>
                <span class="mode-label">{option.label}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Intensity Controls */}
      <Show when={mode() !== 'instrumental'}>
        <div class="uvr-intensity-controls">
          <div class="intensity-group">
            <div class="intensity-header">
              <span class="intensity-label">
                <IconVocal />
                Vocal
              </span>
              <span class="intensity-value">{vocalIntensity()}%</span>
            </div>
            <input
              type="range"
              class="intensity-slider"
              min="0"
              max="100"
              value={vocalIntensity()}
              onInput={(e) =>
                handleIntensityChange('vocal', parseInt(e.currentTarget.value))
              }
            />
          </div>

          <Show when={mode() === 'separate'}>
            <div class="intensity-divider" />

            <div class="intensity-group">
              <div class="intensity-header">
                <span class="intensity-label">
                  <IconMusic />
                  Instrumental
                </span>
                <span class="intensity-value">{instrumentalIntensity()}%</span>
              </div>
              <input
                type="range"
                class="intensity-slider"
                min="0"
                max="100"
                value={instrumentalIntensity()}
                onInput={(e) =>
                  handleIntensityChange(
                    'instrumental',
                    parseInt(e.currentTarget.value),
                  )
                }
              />
            </div>
          </Show>
        </div>
      </Show>

      {/* Smoothing Control */}
      <div class="uvr-smoothing">
        <div class="smoothing-header">
          <span class="smoothing-label">
            <IconWaveform />
            Transition Smoothness
          </span>
          <span class="smoothing-value">{smoothing()}%</span>
        </div>
        <input
          type="range"
          class="smoothing-slider"
          min="0"
          max="100"
          value={smoothing()}
          onInput={(e) =>
            handleSmoothingChange(parseInt(e.currentTarget.value))
          }
        />
      </div>

      {/* Info Box */}
      <div class="uvr-info">
        <div class="info-header">
          <span class="info-icon"><IconInfo /></span>
          <span>Pro Tips</span>
        </div>
        <ul class="info-list">
          <li>
            <strong>Separate Mode:</strong> Best for practice - hear both vocals
            and instrumental
          </li>
          <li>
            <strong>Instrumental Mode:</strong> Learn the melody without
            distracting vocals
          </li>
          <li>
            <strong>Vocal Only:</strong> Practice singing along to isolated
            vocals
          </li>
          <li>
            <strong>Smoothing:</strong> Higher values create smoother
            transitions between modes
          </li>
        </ul>
      </div>
    </div>
  )
}
