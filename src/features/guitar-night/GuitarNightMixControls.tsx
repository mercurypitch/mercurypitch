// ============================================================
// Guitar Night mix controls — shared faders, M/S switches and dialog chrome
// ============================================================
// Playback policy stays with the song or score controller. These controls
// display its actual state without deriving mute from a Solo/master mask.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { X } from '@/components/icons'
import { useFocusTrap } from '@/lib/use-focus-trap'
import roomStyles from './GuitarNightApp.module.css'
import styles from './GuitarNightMixControls.module.css'

interface GuitarNightLevelFaderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  valueText: string
  /** A retained value can be outside the slider range without being silent. */
  ariaValueText?: string
  onInput(value: number): void
  caption?: string
  disabled?: boolean
  masked?: boolean
  testId?: string
  trackId?: string
}

/** Native units belong to the owner: score dB and song gain need no conversion here. */
export function GuitarNightLevelFader(props: GuitarNightLevelFaderProps) {
  return (
    <label
      class={styles.levelFader}
      classList={{ [styles.maskedFader]: props.masked }}
    >
      <span>{props.caption ?? 'Level'}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={Number.isFinite(props.value) ? props.value : props.min}
        disabled={props.disabled}
        data-testid={props.testId}
        data-track-id={props.trackId}
        aria-label={props.label}
        aria-valuetext={props.ariaValueText ?? props.valueText}
        onInput={(event) => props.onInput(event.currentTarget.valueAsNumber)}
      />
      <output>{props.valueText}</output>
    </label>
  )
}

interface GuitarNightMixToggleProps {
  kind: 'mute' | 'solo'
  pressed: boolean
  label: string
  title?: string
  disabled?: boolean
  masked?: boolean
  onToggle(): void
}

export function GuitarNightMixToggle(props: GuitarNightMixToggleProps) {
  return (
    <button
      type="button"
      class={styles.toggle}
      classList={{
        [styles.muted]: props.kind === 'mute' && props.pressed,
        [styles.soloed]: props.kind === 'solo' && props.pressed,
        [styles.maskedToggle]: props.masked,
      }}
      aria-pressed={props.pressed}
      aria-label={props.label}
      title={props.title}
      disabled={props.disabled}
      onClick={() => props.onToggle()}
    >
      <span aria-hidden="true">{props.kind === 'mute' ? 'M' : 'S'}</span>
    </button>
  )
}

interface GuitarNightMixerDialogProps {
  isOpen: boolean
  label: string
  kicker: string
  title: string
  detail?: JSX.Element
  closeLabel: string
  onClose(): void
  children: JSX.Element
  testId?: string
  scrimTestId?: string
  initialFocus?: () => HTMLElement | undefined
  panelClass?: string
  scrimClass?: string
  headingArt?: JSX.Element
}

export function GuitarNightMixerDialog(props: GuitarNightMixerDialogProps) {
  let dialog: HTMLDivElement | undefined
  let closeButton: HTMLButtonElement | undefined

  useFocusTrap(() => dialog, {
    isOpen: () => props.isOpen,
    onClose: () => props.onClose(),
    initialFocus: () => props.initialFocus?.() ?? closeButton,
    isolateKeyboard: true,
  })

  return (
    <Show when={props.isOpen}>
      <div
        class={`${roomStyles.sessionScrim} ${props.scrimClass ?? ''}`}
        data-testid={props.testId}
      >
        <button
          type="button"
          class={roomStyles.sessionScrimButton}
          aria-hidden="true"
          tabIndex={-1}
          data-testid={props.scrimTestId}
          onClick={() => props.onClose()}
        />
        <div
          ref={dialog}
          class={`${roomStyles.sessionPanel} ${props.panelClass ?? ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={props.label}
          tabIndex={-1}
        >
          <div class={roomStyles.sessionHeader}>
            {props.headingArt}
            <div>
              <p class={roomStyles.eyebrow}>{props.kicker}</p>
              <strong>{props.title}</strong>
              <Show when={props.detail !== undefined}>
                <small>{props.detail}</small>
              </Show>
            </div>
            <button
              ref={closeButton}
              type="button"
              class={roomStyles.sessionClose}
              aria-label={props.closeLabel}
              onClick={() => props.onClose()}
            >
              <X />
            </button>
          </div>
          {props.children}
        </div>
      </div>
    </Show>
  )
}
