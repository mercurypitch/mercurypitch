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
import { jamAudioProfile, jamCaptureReport, jamInputDeviceId, jamInputDevices, jamIsMuted, refreshJamInputDevices, setJamAudioProfile, setJamInputDeviceId, } from '@/stores/jam-store'
import styles from './JamSourcePicker.module.css'

const PROFILES: readonly JamAudioProfile[] = ['voice', 'instrument']

export const JamSourcePicker: Component = () => {
  onMount(() => {
    void refreshJamInputDevices()
  })

  /**
   * A change only takes effect on the next capture.
   *
   * Chrome ignores `applyConstraints` for audio processing on a live
   * track, so re-pointing a running room at another device would appear
   * to work and change nothing. Saying so is better than pretending.
   */
  const needsRemute = createMemo(
    () => !jamIsMuted() && jamCaptureReport() !== null,
  )

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
              onClick={() => setJamAudioProfile(profile)}
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
          onChange={(e) =>
            setJamInputDeviceId(
              e.currentTarget.value === '' ? null : e.currentTarget.value,
            )
          }
        >
          <option value="">Default input</option>
          <For each={jamInputDevices()}>
            {(device) => (
              <option value={device.deviceId}>{device.label}</option>
            )}
          </For>
        </select>
      </label>

      <Show when={needsRemute()}>
        <p class={styles.note}>
          Mute and unmute to switch — a running capture cannot be re-pointed.
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
