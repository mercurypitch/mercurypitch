// Melody challenge panel — compact setup, listening and core-judged ribbon feedback for an adventure station.

import { createSignal, createUniqueId, For, Show } from 'solid-js'
import type { MelodyChallengeDefinition } from '../contracts'
import type { CompiledMelody } from '../core/melody-contour'
import type { MelodyJudgeSnapshot } from '../melody-contracts'
import type { AdventureVoiceMode } from './adventure-voice-challenge'
import { GameIcon, GameSurface } from './GameUI'
import panelStyles from './MelodyChallengePanel.module.css'
import { melodyNoteName, MelodyRibbon } from './MelodyRibbon'
import chrome from './VoiceChallengePanel.module.css'

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
  const instructionsId = createUniqueId()
  const replayDescriptionId = createUniqueId()
  const paceName = createUniqueId()
  const [instructionsOpen, setInstructionsOpen] = createSignal(false)
  let instructionsButton!: HTMLButtonElement
  const setup = () => props.mode === 'setup'
  const singing = () => props.mode === 'singing'
  const contourChallenge = () => props.challengeKind === 'melody-contour'
  const percent = () => Math.round(Math.max(0, Math.min(1, props.charge)) * 100)
  const retrying = () => (props.judge?.retryCount ?? 0) > 0

  const canHear = () =>
    !props.needsFreshAttempt &&
    (singing() || (setup() && props.comfortableMidi !== null))
  const hear = (): void => {
    if (setup()) props.onHear()
    else props.onReplay()
  }
  const handlePanelKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape' || !instructionsOpen()) return
    event.preventDefault()
    event.stopPropagation()
    setInstructionsOpen(false)
    instructionsButton.focus({ preventScroll: true })
  }

  return (
    <section
      class={`${chrome.panel} ${panelStyles.melodyPanel}`}
      aria-label="Melody challenge"
      data-challenge-panel
      data-voice-mode={props.mode}
      onKeyDown={handlePanelKeyDown}
    >
      <GameSurface class={panelStyles.surface}>
        <div class={`${chrome.heading} ${panelStyles.heading}`}>
          <span>{props.label}</span>
          <h2 aria-live="polite">{props.message}</h2>
        </div>
        <div class={`${chrome.cornerControls} ${panelStyles.cornerControls}`}>
          <button
            ref={instructionsButton}
            class={chrome.iconButton}
            type="button"
            aria-label={
              instructionsOpen()
                ? 'Hide singing instructions'
                : 'Show singing instructions'
            }
            aria-controls={instructionsId}
            aria-expanded={instructionsOpen()}
            onClick={() => setInstructionsOpen((open) => !open)}
          >
            <GameIcon name="help" />
          </button>
          <button
            class={chrome.iconButton}
            type="button"
            aria-label="Cancel"
            title="Close singing challenge"
            onClick={() => props.onCancel()}
          >
            <GameIcon name="close" />
          </button>
        </div>
        <Show
          when={contourChallenge() && props.contour !== null}
          fallback={
            <div class={panelStyles.anchorMeter}>
              <button
                class={chrome.target}
                type="button"
                aria-label="Hear example"
                aria-describedby={replayDescriptionId}
                disabled={!canHear() || props.target === null}
                onClick={hear}
              >
                <span
                  class={chrome.targetNote}
                  role="img"
                  aria-label={
                    props.target === null
                      ? 'Lesson key not selected'
                      : `Target note: ${melodyNoteName(props.target)}`
                  }
                >
                  <Show
                    when={props.target !== null}
                    fallback={<GameIcon name="tuning" />}
                  >
                    {melodyNoteName(props.target!)}
                  </Show>
                </span>
                <span class={chrome.hear}>
                  <GameIcon name="speaker" />
                  Hear
                </span>
              </button>
              <div
                class={chrome.chargeTrack}
                role="progressbar"
                aria-label="Glass resonance"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent()}
              >
                <span style={{ width: `${percent()}%` }} />
              </div>
              <div class={chrome.readout}>
                <span>
                  {props.mode === 'finding'
                    ? 'Finding your key…'
                    : props.mode === 'reference'
                      ? 'Your turn in a moment…'
                      : props.pitch === null
                        ? 'Sing or hum gently.'
                        : `You: ${melodyNoteName(props.pitch)}`}
                </span>
                <span class={chrome.percent}>{percent()}%</span>
              </div>
            </div>
          }
        >
          <div class={panelStyles.ribbon}>
            <MelodyRibbon
              contour={props.contour!}
              judge={singing() ? props.judge : null}
              pitch={singing() ? props.pitch : null}
              timelineSeconds={props.timelineSeconds}
              compact
            />
          </div>
        </Show>
        <div class={panelStyles.actions}>
          <Show
            when={!props.needsFreshAttempt}
            fallback={
              <button
                class={panelStyles.primary}
                type="button"
                onClick={() => props.onStartFresh()}
              >
                <GameIcon name="play" />
                Start fresh
              </button>
            }
          >
            <Show when={setup()}>
              <button
                class={panelStyles.primary}
                type="button"
                onClick={() => props.onBegin()}
              >
                <GameIcon name="play" />
                {props.comfortableMidi === null
                  ? 'Find your key'
                  : 'Start singing'}
              </button>
            </Show>
            <Show when={contourChallenge()}>
              <button
                class={panelStyles.actionButton}
                type="button"
                disabled={!canHear()}
                aria-describedby={replayDescriptionId}
                onClick={hear}
              >
                <GameIcon name="speaker" />
                {singing() && retrying() ? 'Try again' : 'Hear example'}
              </button>
            </Show>
            <Show when={setup() || singing()}>
              <button
                class={panelStyles.actionButton}
                type="button"
                aria-label="Change key"
                onClick={() => props.onChangeKey()}
              >
                <GameIcon name="tuning" />
                Change
              </button>
            </Show>
          </Show>
        </div>
        <Show when={setup()}>
          <details class={panelStyles.setupDetails}>
            <summary>
              Key and pace{' '}
              <span>
                {props.rootMidi === null
                  ? 'Not set'
                  : melodyNoteName(props.rootMidi)}{' '}
                · {paceLabel(props.pace ?? 1.25)}
              </span>
            </summary>
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
                        name={paceName}
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
          </details>
        </Show>
        <p
          id={instructionsId}
          class={panelStyles.instructions}
          hidden={!instructionsOpen()}
        >
          {props.hint}
        </p>
        <span id={replayDescriptionId} class={chrome.srOnly}>
          {setup()
            ? 'Hear an example in your selected key.'
            : 'Hear the target again and restart this attempt.'}
        </span>
      </GameSurface>
    </section>
  )
}
