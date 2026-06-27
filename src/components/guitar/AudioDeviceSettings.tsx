// ============================================================
// AudioDeviceSettings — pick the guitar input / output devices
// ============================================================
//
// A small "what's hooked where" panel for the guitar page: choose which audio
// INPUT to capture (e.g. an interface's instrument input feeding your guitar)
// so pitch detection / scoring listens to the right signal, an OUTPUT device
// where supported, and a live input level meter to confirm signal is arriving.
// Device labels only appear after mic permission is granted.

import type { Accessor } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { listAudioInputs, listAudioOutputs } from '@/lib/mic-manager'

export interface AudioDeviceSettingsProps {
  inputDeviceId: Accessor<string>
  setInputDevice: (id: string) => void
  outputDeviceId: Accessor<string>
  setOutputDevice: (id: string) => void
  outputSupported: boolean
  getInputLevel: () => number
  isMicActive: Accessor<boolean>
  startMic: () => void
}

export function AudioDeviceSettings(props: AudioDeviceSettingsProps) {
  const [inputs, setInputs] = createSignal<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = createSignal<MediaDeviceInfo[]>([])
  const [level, setLevel] = createSignal(0)

  const hasLabels = () => inputs().some((d) => d.label !== '')

  const refresh = async () => {
    setInputs(await listAudioInputs())
    setOutputs(await listAudioOutputs())
  }

  onMount(() => {
    void refresh()
    const onChange = () => void refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', onChange)

    let raf = 0
    const tick = () => {
      setLevel(props.getInputLevel())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    onCleanup(() => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onChange)
      cancelAnimationFrame(raf)
    })
  })

  const label = (d: MediaDeviceInfo, i: number, kind: string) =>
    d.label !== '' ? d.label : `${kind} ${i + 1}`

  return (
    <div class="gp-devices">
      <div class="gp-devices-row">
        <span class="gp-devices-label">Input</span>
        <select
          class="gp-devices-select"
          value={props.inputDeviceId()}
          onChange={(e) => props.setInputDevice(e.currentTarget.value)}
        >
          <option value="">System default</option>
          <For each={inputs()}>
            {(d, i) => (
              <option value={d.deviceId}>{label(d, i(), 'Input')}</option>
            )}
          </For>
        </select>
      </div>

      <Show when={props.outputSupported}>
        <div class="gp-devices-row">
          <span class="gp-devices-label">Output</span>
          <select
            class="gp-devices-select"
            value={props.outputDeviceId()}
            onChange={(e) => props.setOutputDevice(e.currentTarget.value)}
          >
            <option value="">System default</option>
            <For each={outputs()}>
              {(d, i) => (
                <option value={d.deviceId}>{label(d, i(), 'Output')}</option>
              )}
            </For>
          </select>
        </div>
      </Show>

      <div class="gp-devices-row">
        <span class="gp-devices-label">Signal</span>
        <div class="gp-devices-meter" title="Live input level">
          <div
            class="gp-devices-meter-fill"
            style={{ width: `${Math.min(100, Math.round(level() * 250))}%` }}
          />
        </div>
      </div>

      <Show when={!hasLabels()}>
        <div class="gp-devices-hint">
          <span>Turn the input on to see device names and signal.</span>
          <button
            class="gp-btn"
            onClick={() => {
              props.startMic()
              window.setTimeout(() => void refresh(), 600)
            }}
          >
            Enable input
          </button>
        </div>
      </Show>
    </div>
  )
}
