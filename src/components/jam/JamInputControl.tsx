// ── JamInputControl ──────────────────────────────────────────────────
// One control for "am I sending" and "what am I sending".
//
// It replaced a bare microphone toggle, and the icon was the smaller half
// of the problem. The room has always had exactly one transmit switch,
// labelled "Unmute microphone" whatever it was actually carrying -- so a
// guitarist with a DI'd instrument through an interface was told to turn
// their microphone on, and reasonably asked why. Nothing was being
// captured from a microphone.
//
// FEEDBACK IS THE REASON THIS IS NOT JUST A RENAME. The two profiles
// differ in one way that matters more than tone: `voice` sends a PROCESSED
// CLONE with echo cancellation on, and `instrument` sends the raw capture
// with none. Pick instrument while a microphone is the input and a speaker
// is the output and the room hears itself, immediately and loudly -- and
// the moment that is most likely is exactly when somebody is testing with
// a second device sitting next to them. So the choice is never more than
// one press away, the current one is legible without opening anything, and
// the consequence is stated where the choice is made rather than in a
// panel somebody has to go looking for.
//
// Modelled on Guitar Night's free-form mode picker: each option carries a
// label AND the sentence that makes it choosable, because "Voice" and
// "Instrument" alone do not tell you which one feeds back.
//
// Tests: src/tests/jam-input-control.test.tsx.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { ChevronDown, Guitar, Mic } from '@/components/icons'
import type { JamAudioProfile } from '@/lib/jam/jam-audio-source'
import { PROFILE_COPY } from '@/lib/jam/jam-audio-source'
import { jamAudioProfile, jamInputDeviceId, jamInputDevices, jamIsMuted, refreshJamInputDevices, setJamAudioProfile, setJamInputDeviceId, setJamInputDeviceLabel, switchJamAudioSource, toggleJamMute, } from '@/stores/jam-store'
import styles from './JamInputControl.module.css'

const PROFILES: readonly JamAudioProfile[] = ['voice', 'instrument']

/**
 * What each choice does to the room, not what it does to the signal.
 *
 * PROFILE_COPY already says the tonal half. This is the half somebody
 * needs before they press it with speakers on.
 */
const CONSEQUENCE: Record<JamAudioProfile, string> = {
  voice: 'Echo cancellation on. Safe with speakers.',
  instrument: 'No echo cancellation. Headphones, or the room hears itself.',
}

export const JamInputControl: Component = () => {
  const [open, setOpen] = createSignal(false)
  let root: HTMLDivElement | undefined

  /**
   * Close on anything that is not this control.
   *
   * Listening on the document rather than a backdrop element: the control
   * lives in a crowded toolbar and a full-screen backdrop would swallow
   * the first click on every other button in it.
   */
  const onDocumentPointer = (e: PointerEvent): void => {
    if (root === undefined) return
    if (!root.contains(e.target as Node)) setOpen(false)
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') setOpen(false)
  }
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onKey)
  onCleanup(() => {
    document.removeEventListener('pointerdown', onDocumentPointer)
    document.removeEventListener('keydown', onKey)
  })

  const profile = () => jamAudioProfile()
  const sending = () => !jamIsMuted()

  /**
   * The input is the system default, which on a laptop is the built-in
   * microphone.
   *
   * Worth calling out only on `instrument`, where it is the combination
   * that howls: a microphone, no echo cancellation, and speakers.
   */
  const defaultInput = () => jamInputDeviceId() === null

  const risky = createMemo(
    () => profile() === 'instrument' && sending() && defaultInput(),
  )

  const choose = (next: JamAudioProfile): void => {
    setOpen(false)
    if (next === profile()) return
    setJamAudioProfile(next)
    void switchJamAudioSource()
  }

  return (
    <div class={styles.control} ref={root}>
      <button
        type="button"
        class={styles.send}
        classList={{ [styles.sendOn!]: sending(), [styles.risky!]: risky() }}
        aria-pressed={sending()}
        // Stable across profile changes, unlike the title -- which now
        // names the source and so moves when the source does.
        data-testid="jam-send"
        data-sending={sending() ? '' : undefined}
        // Named for what it does, not for the hardware it used to assume.
        title={
          sending()
            ? `Stop sending ${PROFILE_COPY[profile()].label.toLowerCase()}`
            : `Send ${PROFILE_COPY[profile()].label.toLowerCase()}`
        }
        aria-label={
          sending()
            ? `Stop sending. Currently sending ${PROFILE_COPY[profile()].label.toLowerCase()}.`
            : `Start sending ${PROFILE_COPY[profile()].label.toLowerCase()}.`
        }
        onClick={() => void toggleJamMute()}
        // "Right or left click" -- the source menu is reachable from the
        // main button too, because that is the one people aim at.
        onContextMenu={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
      >
        <Show when={profile() === 'instrument'} fallback={<Mic />}>
          <Guitar />
        </Show>
        <Show when={!sending()}>
          <span class={styles.offBar} aria-hidden="true" />
        </Show>
      </button>

      <button
        type="button"
        class={styles.caret}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-label="Choose what you are sending"
        title="Choose what you are sending"
        onClick={() => {
          if (!open()) void refreshJamInputDevices()
          setOpen((v) => !v)
        }}
      >
        <ChevronDown />
      </button>

      <Show when={open()}>
        <div class={styles.menu} role="menu" aria-label="What you are sending">
          <p class={styles.menuTitle}>What you are sending</p>
          <For each={PROFILES}>
            {(item) => (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={profile() === item}
                class={styles.option}
                classList={{ [styles.optionOn!]: profile() === item }}
                onClick={() => choose(item)}
              >
                <span class={styles.optionHead}>
                  <Show when={item === 'instrument'} fallback={<Mic />}>
                    <Guitar />
                  </Show>
                  <span class={styles.optionLabel}>
                    {PROFILE_COPY[item].label}
                  </span>
                </span>
                <span class={styles.optionDetail}>{CONSEQUENCE[item]}</span>
              </button>
            )}
          </For>

          <label class={styles.deviceRow}>
            <span class={styles.deviceLabel}>Input</span>
            <select
              class={styles.select}
              value={jamInputDeviceId() ?? ''}
              onChange={(e) => {
                const id =
                  e.currentTarget.value === '' ? null : e.currentTarget.value
                setJamInputDeviceId(id)
                setJamInputDeviceLabel(
                  id === null
                    ? null
                    : (jamInputDevices().find((d) => d.deviceId === id)
                        ?.label ?? null),
                )
                void switchJamAudioSource()
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

          <Show when={risky()}>
            <p class={styles.warn} role="status">
              You are sending the default input with no echo cancellation. That
              is usually a built-in microphone — on speakers it will feed back.
            </p>
          </Show>
        </div>
      </Show>
    </div>
  )
}
