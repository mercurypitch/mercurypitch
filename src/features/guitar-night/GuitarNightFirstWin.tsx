// GuitarNightFirstWin turns the configurable beginner exercise into the same stage-first room used for rehearsal.
// ============================================================

import type { Accessor } from 'solid-js'
import { For, Show } from 'solid-js'
import { Pause, Play } from '@/components/icons'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarFirstWinConfigV1 } from './first-win-config'
import styles from './GuitarNightApp.module.css'
import { GuitarNightStage } from './GuitarNightStage'
import type { useGuitarFirstWinController } from './useGuitarFirstWinController'

type GuitarFirstWinController = ReturnType<typeof useGuitarFirstWinController>

interface GuitarNightFirstWinProps {
  config: Accessor<GuitarFirstWinConfigV1>
  controller: GuitarFirstWinController
  stage: GuitarPerformanceStageSource
  active: Accessor<boolean>
  completionAction: Accessor<'keep-jamming' | 'load-song'>
  headingRef(element: HTMLHeadingElement): void
  onHit(): void
  onBack(): void
  onSkip(): void
  onComplete(): void
}

export function GuitarNightFirstWin(props: GuitarNightFirstWinProps) {
  const step = () => props.config().exerciseSteps[0]
  const previewPassed = () => props.controller.hits() >= props.config().passHits
  const previewFinished = () =>
    props.controller.hits() >= props.config().freshHitsRequested
  const grooveRunning = () =>
    props.controller.status() === 'count-in' ||
    props.controller.status() === 'playing' ||
    props.controller.status() === 'starting'
  const grooveLabel = () => (grooveRunning() ? 'Stop groove' : 'Start count-in')
  const stageGuideLabel = () => {
    const exercise = step()
    const fret = exercise?.frets[0]
    return `${exercise?.stringLabel ?? 'low E'} · ${fret === 0 ? 'open string' : `fret ${fret ?? 0}`}`
  }
  const progressCopy = () => {
    if (previewFinished()) {
      return `${props.config().freshHitsRequested} open notes. You just read your first bar of tab.`
    }
    if (previewPassed()) {
      return `${props.config().passHits} notes down. Add the last note or keep going.`
    }
    return props.controller.lastFeedback()
  }

  return (
    <section class={styles.firstWinRoom} data-testid="guitar-night-first-win">
      <div class={styles.firstWinBrief}>
        <p class={styles.eyebrow}>First win · one string</p>
        <h1 ref={props.headingRef} tabindex="-1">
          Start with one string.
        </h1>
        <p class={styles.detailCopy}>
          Six lines are the strings. A 0 means play this string open.
        </p>
      </div>

      <GuitarNightStage
        source={props.stage}
        active={props.active}
        guideLabel={stageGuideLabel}
        flowLabelMode="fret"
      />

      <div
        class={styles.firstWinDeck}
        data-testid="guitar-night-first-win-deck"
      >
        <div class={styles.firstWinProgress}>
          <div class={styles.previewMeta}>
            <span>{step()?.stringLabel ?? 'low E'} · standard tuning</span>
            <span>{props.controller.tempoBpm()} BPM</span>
          </div>
          <div
            class={styles.beatRow}
            aria-label={`${props.controller.hits()} of ${props.config().freshHitsRequested} notes marked`}
          >
            <For
              each={Array.from(
                { length: props.config().freshHitsRequested },
                (_, index) => index,
              )}
            >
              {(index) => (
                <span
                  classList={{
                    [styles.beatFilled]: index < props.controller.hits(),
                  }}
                  aria-hidden="true"
                />
              )}
            </For>
          </div>
          <p class={styles.lessonFeedback} role="status" aria-live="polite">
            {progressCopy()}
          </p>
        </div>

        <div class={styles.lessonControls}>
          <button
            class={styles.grooveAction}
            type="button"
            aria-label={grooveLabel()}
            title={grooveLabel()}
            onClick={() =>
              grooveRunning()
                ? props.controller.stopGroove()
                : void props.controller.startGroove()
            }
          >
            <span aria-hidden="true">
              {grooveRunning() ? <Pause /> : <Play />}
            </span>
            <span>
              <strong>{grooveLabel()}</strong>
              <small>Percussion only</small>
            </span>
          </button>
          <button
            class={styles.tapAction}
            type="button"
            aria-label={`Tap each ${step()?.stringLabel ?? 'low E'} note`}
            onClick={() => props.onHit()}
            disabled={previewFinished()}
          >
            <strong>
              {previewFinished()
                ? 'First bar complete'
                : `Play ${step()?.stringLabel ?? 'low E'}`}
            </strong>
            <small>
              {previewFinished() ? 'Small win unlocked' : 'Tap or press Space'}
            </small>
          </button>
        </div>

        <div class={styles.firstWinUtilities}>
          <button type="button" onClick={() => props.onBack()}>
            Back
          </button>
          <Show when={props.controller.hits() > 0}>
            <details class={styles.lessonOptions}>
              <summary>Adjust intro</summary>
              <div>
                <label>
                  <span>Tempo</span>
                  <input
                    type="range"
                    min="40"
                    max="160"
                    step="1"
                    value={props.controller.tempoBpm()}
                    aria-label="Intro tempo"
                    onInput={(event) =>
                      props.controller.setTempoBpm(
                        Number(event.currentTarget.value),
                      )
                    }
                  />
                  <strong>{props.controller.tempoBpm()} BPM</strong>
                </label>
                <label>
                  <span>Count-in</span>
                  <select
                    aria-label="Count-in beats"
                    value={props.controller.countInBeats()}
                    onChange={(event) =>
                      props.controller.setCountInBeats(
                        Number(event.currentTarget.value),
                      )
                    }
                  >
                    <For each={[0, 2, 4, 8]}>
                      {(beats) => (
                        <option value={beats}>
                          {beats === 0 ? 'Off' : `${beats} beats`}
                        </option>
                      )}
                    </For>
                  </select>
                </label>
              </div>
            </details>
          </Show>
          <Show
            when={previewPassed()}
            fallback={
              <button
                class={styles.workspaceEscape}
                type="button"
                onClick={() => props.onSkip()}
              >
                Open Guitar workspace
              </button>
            }
          >
            <button
              class={styles.completionAction}
              type="button"
              onClick={() => props.onComplete()}
            >
              {props.completionAction() === 'load-song'
                ? 'Load a song'
                : 'Keep jamming'}
            </button>
          </Show>
        </div>
      </div>
    </section>
  )
}
