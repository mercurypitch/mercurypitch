// Practice input recovery makes capture an explicit choice before scored playback.
import { For, Show } from 'solid-js'
import { AudioWave, Mic, MidiDin } from '@/components/icons'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { guitarInputProfileLabel } from '@/lib/guitar/guitar-input-profile'
import { GuitarNightMixerDialog } from './GuitarNightMixControls'
import styles from './GuitarPracticeInputPrompt.module.css'

export interface GuitarPracticeInputPromptProps {
  open: boolean
  pending: boolean
  profile: GuitarInputProfileKind
  error: string | null
  onEnable(kind: GuitarInputProfileKind): void
  onReplay(): void
  onSettings(): void
  onClose(): void
}

const INPUTS = [
  {
    kind: 'interface',
    icon: AudioWave,
    detail: 'Guitar plugged into an audio interface',
  },
  {
    kind: 'microphone',
    icon: Mic,
    detail: 'Guitar heard through a microphone',
  },
  {
    kind: 'midi',
    icon: MidiDin,
    detail: 'Notes from a connected MIDI instrument',
  },
] as const

export function GuitarPracticeInputPrompt(
  props: GuitarPracticeInputPromptProps,
) {
  let inputs: HTMLDivElement | undefined
  return (
    <GuitarNightMixerDialog
      isOpen={props.open}
      label="Enable Listening to practice"
      kicker="Practice"
      title="Enable Listening to practice"
      closeLabel="Close practice input"
      onClose={() => props.onClose()}
      panelClass={styles.panel}
      initialFocus={() =>
        inputs?.querySelector<HTMLButtonElement>(
          `[data-profile="${props.profile}"]:not(:disabled)`,
        ) ?? undefined
      }
    >
      <p class={styles.explanation}>
        Your melody is ready. Practice listens to your notes and scores them
        against the melody. Choose an input, then press Play to begin.
      </p>
      <div
        ref={inputs}
        class={styles.inputs}
        aria-label="Practice input"
        role="group"
        aria-busy={props.pending}
      >
        <For each={INPUTS}>
          {(input) => (
            <button
              type="button"
              class={styles.input}
              classList={{ [styles.selected]: props.profile === input.kind }}
              data-profile={input.kind}
              aria-label={guitarInputProfileLabel(input.kind)}
              disabled={props.pending}
              onClick={() => props.onEnable(input.kind)}
            >
              <input.icon />
              <span>
                <strong>{guitarInputProfileLabel(input.kind)}</strong>
                <small>{input.detail}</small>
              </span>
            </button>
          )}
        </For>
      </div>
      <Show when={props.pending}>
        <p class={styles.explanation} role="status">
          Opening {guitarInputProfileLabel(props.profile)}. Allow access if your
          browser asks. You can close this prompt to cancel.
        </p>
      </Show>
      <Show when={props.error}>
        <p class={styles.error} role="alert">
          {props.error}
        </p>
      </Show>
      <div class={styles.alternatives}>
        <button
          type="button"
          disabled={props.pending}
          onClick={() => props.onReplay()}
        >
          Replay without scoring
        </button>
        <button
          type="button"
          disabled={props.pending}
          onClick={() => props.onSettings()}
        >
          Input settings
        </button>
      </div>
    </GuitarNightMixerDialog>
  )
}
