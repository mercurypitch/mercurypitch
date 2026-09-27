// Melody challenge panel — compact setup, listening and core-judged ribbon feedback for an adventure station.

import { For, Show } from 'solid-js'
import type { MelodyChallengeDefinition } from '../contracts'
import type { CompiledMelody } from '../core/melody-contour'
import type { MelodyJudgeSnapshot } from '../melody-contracts'
import type { AdventureVoiceMode } from './adventure-voice-challenge'
import styles from './GlassAdventure.module.css'
import panelStyles from './MelodyChallengePanel.module.css'
import { MelodyRibbon } from './MelodyRibbon'

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

function noteName(midi: number): string {
  const rounded = Math.round(midi)
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`
}

function paceLabel(pace: number): string {
  if (pace === 0.8) return 'Brisk'
  if (pace === 1) return 'Natural'
  if (pace === 1.25) return 'Spacious'
  return `${pace}×`
}

export function MelodyChallengePanel(props: {
  label: string
  challengeKind: MelodyChallengeDefinition['kind']
  mode: AdventureVoiceMode
  message: string
  hint: string
  target: number | null
  pitch: number | null
  charge: number
  contour: CompiledMelody | null
  judge: MelodyJudgeSnapshot | null
  timelineSeconds: number
  comfortableMidi: number | null
  rootMidi: number | null
  pace: number | null
  allowedPaces: readonly number[]
  frozen: boolean
  needsFreshAttempt: boolean
  onBegin(): void
  onHear(): void
  onReplay(): void
  onChangeKey(): void
  onChangePace(pace: number): void
  onStartFresh(): void
  onCancel(): void
}) {
  const setup = () => props.mode === 'setup'
  const singing = () => props.mode === 'singing'
  const contourChallenge = () => props.challengeKind === 'melody-contour'
  const percent = () => Math.round(Math.max(0, Math.min(1, props.charge)) * 100)
  const retrying = () => (props.judge?.retryCount ?? 0) > 0

  return (
    <section
      class={`${styles.encounter} ${panelStyles.melodyPanel}`}
      aria-label="Melody challenge"
      data-challenge-panel
      data-voice-mode={props.mode}
    >
      <div class={styles.encounterHeading}>
        <span>{props.label}</span>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel
        </button>
      </div>
      <div class={panelStyles.guidance} aria-live="polite" aria-atomic="true">
        <h2>{props.message}</h2>
        <p>{props.hint}</p>
      </div>

      <Show
        when={contourChallenge()}
        fallback={
          <div class={panelStyles.anchorMeter}>
            <div
              class={styles.noteDisc}
              style={{ '--charge': `${percent()}%` }}
              role="img"
              aria-label={
                props.target === null
                  ? 'Lesson key not selected'
                  : `Target note: ${noteName(props.target)}`
              }
            >
              <span aria-hidden="true">
                {props.target === null ? '—' : noteName(props.target)}
              </span>
            </div>
            <div class={styles.voiceReadout}>
              <span>
                {props.mode === 'finding'
                  ? 'Finding your key…'
                  : props.mode === 'reference'
                    ? 'Your turn in a moment…'
                    : props.pitch === null
                      ? 'Sing or hum gently.'
                      : `${noteName(props.pitch)} · ${percent()}%`}
              </span>
              <div
                class={styles.chargeTrack}
                role="progressbar"
                aria-label="Glass resonance"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent()}
              >
                <span style={{ width: `${percent()}%` }} />
              </div>
            </div>
          </div>
        }
      >
        <MelodyRibbon
          contour={props.contour!}
          judge={singing() ? props.judge : null}
          pitch={singing() ? props.pitch : null}
          timelineSeconds={props.timelineSeconds}
          compact
        />
      </Show>

      <Show when={setup()}>
        <div class={panelStyles.setupSummary}>
          <span>
            Key{' '}
            <strong>
              {props.rootMidi === null ? 'Not set' : noteName(props.rootMidi)}
            </strong>
          </span>
          <span>
            Pace <strong>{paceLabel(props.pace ?? 1.25)}</strong>
          </span>
        </div>
        <Show when={!props.needsFreshAttempt}>
          <fieldset class={panelStyles.paceChoices} disabled={props.frozen}>
            <legend>Pace</legend>
            <For each={props.allowedPaces}>
              {(pace) => (
                <label
                  classList={{
                    [panelStyles.selectedPace]: props.pace === pace,
                  }}
                >
                  <input
                    type="radio"
                    name="melody-pace"
                    value={pace}
                    checked={props.pace === pace}
                    onChange={() => props.onChangePace(pace)}
                  />
                  {paceLabel(pace)}
                </label>
              )}
            </For>
          </fieldset>
        </Show>
      </Show>

      <div class={panelStyles.actions}>
        <Show
          when={!props.needsFreshAttempt}
          fallback={
            <button
              class={styles.primary}
              type="button"
              onClick={() => props.onStartFresh()}
            >
              Start fresh
            </button>
          }
        >
          <Show when={setup()}>
            <button
              class={styles.primary}
              type="button"
              onClick={() => props.onBegin()}
            >
              {props.comfortableMidi === null
                ? 'Find your key'
                : 'Start singing'}
            </button>
            <button
              class={styles.textButton}
              type="button"
              disabled={props.comfortableMidi === null}
              onClick={() => props.onHear()}
            >
              Hear example
            </button>
          </Show>
          <Show when={singing()}>
            <button
              class={styles.textButton}
              type="button"
              onClick={() => props.onReplay()}
            >
              {retrying() ? 'Try again' : 'Hear example'}
            </button>
          </Show>
          <Show when={setup() || singing()}>
            <button
              class={styles.textButton}
              type="button"
              onClick={() => props.onChangeKey()}
            >
              Change key
            </button>
          </Show>
        </Show>
      </div>
    </section>
  )
}
