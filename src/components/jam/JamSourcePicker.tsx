// ── JamSourcePicker ──────────────────────────────────────────────────
// What this person is sending, and from which input.
//
// The room has always sent "the microphone" -- the default device, with
// echo cancellation applied to what the peers hear. That is right for a
// singer and wrong for a guitarist, whose signal comes from an interface
// and wants nothing done to it at all. This is the two-line control that
// makes the difference sayable.
//
// Deliberately NOT a diagnostics surface: this ships to everyone. It is
// the diagnostics PANEL that is dev-only; choosing your own input is an
// ordinary thing a musician needs to be able to do.
//
// Device labels are empty until a capture has been permitted once, so
// before the first unmute the list reads "Input 1, Input 2". The store
// refreshes it the moment a capture succeeds, which is when the names
// arrive.

import type { Component } from 'solid-js'
import { createMemo, For, onMount, Show } from 'solid-js'
import type { JamAudioProfile } from '@/lib/jam/jam-audio-source'
import { PROFILE_COPY } from '@/lib/jam/jam-audio-source'
import { jamAudioProfile, jamCaptureReport, jamInputDeviceId, jamInputDevices, refreshJamInputDevices, setJamAudioProfile, setJamInputDeviceId, setJamInputDeviceLabel, switchJamAudioSource, } from '@/stores/jam-store'
import styles from './JamSourcePicker.module.css'

const PROFILES: readonly JamAudioProfile[] = ['voice', 'instrument']

export const JamSourcePicker: Component = () => {
  onMount(() => {
    void refreshJamInputDevices()
  })

  /**
   * A change cannot be applied in place, so it re-captures.
   *
   * Chrome ignores `applyConstraints` for audio processing on a live
   * track, and mute only sets `track.enabled` false -- the device stays
   * held either way. So the old capture is stopped and a new one opened,
   * and the peers get it through `replaceTrack` without renegotiating. A
   * no-op while the mic has never been captured: the choice is remembered
   * and used at the first unmute.
   */
  const applyChange = () => {
    void switchJamAudioSource()
  }

  /**
   * PipeWire and PulseAudio list one capture device per OUTPUT, so a Linux
   * user picking by name can land on their own speakers. Worth saying out
   * loud rather than leaving them to work out why the room is howling.
   */
  const loopbackChosen = createMemo(() => {
    const id = jamInputDeviceId()
    if (id === null) return false
    const chosen = jamInputDevices().find((d) => d.deviceId === id)
    return chosen !== undefined && chosen.isLoopback
  })

  return (
    <div class={styles.picker}>
      <div
        class={styles.profiles}
        role="radiogroup"
        aria-label="What you are sending"
      >
        <For each={PROFILES}>
          {(profile) => (
            <button
              type="button"
              role="radio"
              aria-checked={jamAudioProfile() === profile}
              class={styles.profile}
              classList={{
                [styles.profileOn!]: jamAudioProfile() === profile,
              }}
              onClick={() => {
                // Re-picking what is already selected must not re-capture:
                // a switch tears the capture down and opens a new one, so
                // a no-op click would cost an audible gap for nothing.
                if (jamAudioProfile() === profile) return
                setJamAudioProfile(profile)
                applyChange()
              }}
            >
              {PROFILE_COPY[profile].label}
            </button>
          )}
        </For>
      </div>

      <p class={styles.hint}>{PROFILE_COPY[jamAudioProfile()].hint}</p>

      <label class={styles.deviceRow}>
        <span class={styles.deviceLabel}>Input</span>
        <select
          class={styles.select}
          value={jamInputDeviceId() ?? ''}
          onChange={(e) => {
            const id =
              e.currentTarget.value === '' ? null : e.currentTarget.value
            setJamInputDeviceId(id)
            // Remembered as the fallback key; see resolveDeviceId.
            setJamInputDeviceLabel(
              id === null
                ? null
                : (jamInputDevices().find((d) => d.deviceId === id)?.label ??
                    null),
            )
            applyChange()
          }}
        >
          <option value="">Default input</option>
          <For each={jamInputDevices()}>
            {(device) => (
              <option value={device.deviceId}>
                {device.isLoopback
                  ? `${device.label} (playback)`
                  : device.label}
              </option>
            )}
          </For>
        </select>
      </label>

      <Show when={loopbackChosen()}>
        <p class={styles.warning} role="status">
          That input is a loopback of what this machine is playing, not what it
          is hearing. Sending it puts the room's own sound back into the room.
        </p>
      </Show>

      <Show when={jamCaptureReport()}>
        {(report) => (
          <div class={styles.report}>
            <p class={styles.reportLine}>
              Sending{' '}
              <strong>
                {PROFILE_COPY[report().profile].label.toLowerCase()}
              </strong>
              {report().deviceLabel === ''
                ? ''
                : ` from ${report().deviceLabel}`}
              {report().sampleRate === null
                ? ''
                : ` at ${(report().sampleRate ?? 0) / 1000} kHz`}
              .
            </p>
            <For each={report().warnings}>
              {(warning) => (
                <p class={styles.warning} role="status">
                  {warning}
                </p>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  )
}
