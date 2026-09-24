// Camera tuning panel — compact development controls that work with mouse or touch.

import { createSignal, For, onCleanup, Show } from 'solid-js'
import { CAMERA_FOLLOW_SMOOTHNESS } from '../render/camera'
import type { GlassRenderQualityPreference, GlassRenderQualityProfile, } from '../render/render-quality'
import type { CameraComfortSettings } from './camera-comfort'
import { CAMERA_COMFORT_PRESETS, DEFAULT_CAMERA_COMFORT, LOOK_SENSITIVITY, normalizeCameraComfort, } from './camera-comfort'
import styles from './CameraTuningPanel.module.css'

interface CameraTuningPanelProps {
  settings: CameraComfortSettings
  onChange(settings: CameraComfortSettings): void
  renderQualityPreference: GlassRenderQualityPreference
  renderQualityProfile: GlassRenderQualityProfile
  onRenderQualityChange(preference: GlassRenderQualityPreference): void
}

type CopyState = 'idle' | 'copied' | 'failed'

function fallbackCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

export function CameraTuningPanel(props: CameraTuningPanelProps) {
  const [open, setOpen] = createSignal(false)
  const [copyState, setCopyState] = createSignal<CopyState>('idle')
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(copyTimer))

  const change = (patch: Partial<CameraComfortSettings>): void => {
    props.onChange(normalizeCameraComfort({ ...props.settings, ...patch }))
  }
  const selectedPreset = (settings: CameraComfortSettings): boolean =>
    Math.abs(props.settings.lookSensitivity - settings.lookSensitivity) <
      1e-6 &&
    Math.abs(
      props.settings.followSmoothnessSeconds - settings.followSmoothnessSeconds,
    ) < 1e-6
  const copy = (): void => {
    const text = JSON.stringify(
      {
        cameraComfort: normalizeCameraComfort(props.settings),
        renderQuality: props.renderQualityPreference,
      },
      null,
      2,
    )
    void (async () => {
      let copied = false
      try {
        if (navigator.clipboard?.writeText !== undefined) {
          await navigator.clipboard.writeText(text)
          copied = true
        }
      } catch {
        // The LAN device preview may not grant Clipboard permission.
      }
      if (!copied) copied = fallbackCopy(text)
      setCopyState(copied ? 'copied' : 'failed')
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => setCopyState('idle'), 1600)
    })()
  }

  return (
    <div class={styles.tools} data-testid="camera-tuning-tools">
      <button
        class={styles.trigger}
        type="button"
        aria-label="Camera tuning"
        aria-expanded={open()}
        aria-controls="glass-camera-tuning"
        onClick={() => setOpen((value) => !value)}
      >
        Tune
      </button>
      <Show when={open()}>
        <section
          id="glass-camera-tuning"
          class={styles.panel}
          role="dialog"
          aria-label="Camera comfort tuning"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            setOpen(false)
          }}
        >
          <header class={styles.header}>
            <div>
              <strong>Camera comfort</strong>
              <span>Development tuning</span>
            </div>
            <button
              class={styles.close}
              type="button"
              aria-label="Close camera tuning"
              onClick={() => setOpen(false)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div class={styles.presets} aria-label="Camera presets">
            <For each={CAMERA_COMFORT_PRESETS}>
              {(preset) => (
                <button
                  type="button"
                  aria-pressed={selectedPreset(preset.settings)}
                  onClick={() => props.onChange({ ...preset.settings })}
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>
          <fieldset class={styles.quality}>
            <legend>Graphics</legend>
            <div class={styles.qualityStatus}>
              Current output: {props.renderQualityProfile}
            </div>
            <div
              class={styles.presets}
              role="group"
              aria-label="Graphics quality"
            >
              <For
                each={
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'high', label: 'High' },
                    { id: 'balanced', label: 'Balanced' },
                  ] as const
                }
              >
                {(quality) => (
                  <button
                    type="button"
                    aria-pressed={props.renderQualityPreference === quality.id}
                    onClick={() => props.onRenderQualityChange(quality.id)}
                  >
                    {quality.label}
                  </button>
                )}
              </For>
            </div>
            <small>
              Balanced helps smooth play. High keeps the sharpest detail. Auto
              chooses for your screen.
            </small>
          </fieldset>
          <label class={styles.row} for="glass-look-sensitivity">
            <span>
              Look sensitivity
              <output for="glass-look-sensitivity">
                {props.settings.lookSensitivity.toFixed(2)}x
              </output>
            </span>
            <input
              id="glass-look-sensitivity"
              type="range"
              min={LOOK_SENSITIVITY.minimum}
              max={LOOK_SENSITIVITY.maximum}
              step="0.05"
              value={props.settings.lookSensitivity}
              onInput={(event) =>
                change({
                  lookSensitivity: event.currentTarget.valueAsNumber,
                })
              }
            />
            <small>Mouse and touch orbit gain.</small>
          </label>
          <label class={styles.row} for="glass-follow-smoothness">
            <span>
              Follow smoothness
              <output for="glass-follow-smoothness">
                {props.settings.followSmoothnessSeconds.toFixed(2)}s
              </output>
            </span>
            <input
              id="glass-follow-smoothness"
              type="range"
              min={CAMERA_FOLLOW_SMOOTHNESS.minimum}
              max={CAMERA_FOLLOW_SMOOTHNESS.maximum}
              step="0.01"
              value={props.settings.followSmoothnessSeconds}
              onInput={(event) =>
                change({
                  followSmoothnessSeconds: event.currentTarget.valueAsNumber,
                })
              }
            />
            <small>Time to reach the automatic chase turn rate.</small>
          </label>
          <p class={styles.note}>
            Keyboard steering stays digital; this changes the view response.
          </p>
          <footer class={styles.actions}>
            <button
              type="button"
              onClick={() => {
                props.onChange({ ...DEFAULT_CAMERA_COMFORT })
                props.onRenderQualityChange('auto')
              }}
            >
              Reset defaults
            </button>
            <button type="button" onClick={copy}>
              {copyState() === 'copied'
                ? 'Copied'
                : copyState() === 'failed'
                  ? 'Copy failed'
                  : 'Copy preset'}
            </button>
          </footer>
        </section>
      </Show>
    </div>
  )
}
