// GuitarNightFirstWin turns the configurable beginner setlist into the same stage-first room used for rehearsal.
// ============================================================

import type { Accessor } from 'solid-js'
import { For, Show } from 'solid-js'
import { ChevronLeft, Pause, Play } from '@/components/icons'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import type { GuitarFirstWinCompletionAction } from './first-win-config'
import styles from './GuitarNightApp.module.css'
import { GuitarNightDrumSoundControls } from './GuitarNightDrumSoundControls'
import { GuitarNightStage } from './GuitarNightStage'
import type { useGuitarFirstWinController } from './useGuitarFirstWinController'

type GuitarFirstWinController = ReturnType<typeof useGuitarFirstWinController>

interface GuitarNightFirstWinProps {
  controller: GuitarFirstWinController
  stage: GuitarPerformanceStageSource
  tuning: Accessor<InstrumentTuning>
  active: Accessor<boolean>
  completionAction: Accessor<GuitarFirstWinCompletionAction>
  headingRef(element: HTMLHeadingElement): void
  onHit(): void
  onBack(): void
  onSkip(): void
  onAdvance(): void
  onComplete(): void
}

interface LessonSegment {
  id: string
  endHit: number
}

export function GuitarNightFirstWin(props: GuitarNightFirstWinProps) {
  const step = () => props.controller.currentStep()
  const isTabStep = () => step()?.kind === 'one-string-tab'
  const grooveRunning = () =>
    props.controller.status() === 'count-in' ||
    props.controller.status() === 'playing' ||
    props.controller.status() === 'starting'
  const loopedGrooveRunning = () =>
    grooveRunning() && props.controller.loopEnabled()
  const grooveLabel = () => (grooveRunning() ? 'Stop groove' : 'Start count-in')
  const grooveDetail = () => {
    const exercise = step()
    if (exercise?.guide === 'count-in-only') return 'Count-in only'
    return `${props.controller.activeRhythmPreset().label} beat`
  }
  const targetLabel = () => {
    const target = props.controller.currentTarget()
    const stringLabel = step()?.stringLabel ?? 'string'
    if (target === undefined) return stringLabel
    return target.fret === 0
      ? `open ${stringLabel}`
      : `${stringLabel} · fret ${target.fret}`
  }
  const stageGuideLabel = () => targetLabel()
  const tuningLabel = () =>
    props.tuning().name ?? props.tuning().labels.join(' ')
  const lessonSegments = (): LessonSegment[] => {
    const exercise = step()
    if (exercise === undefined) return []
    if (exercise.kind === 'open-string-groove') {
      return Array.from(
        { length: props.controller.targetHits() },
        (_, index) => ({
          id: `${exercise.id}-${index}`,
          endHit: index + 1,
        }),
      )
    }

    let endHit = 0
    return exercise.phraseChunks.map((chunk) => {
      endHit += chunk.frets.length
      return { id: chunk.id, endHit }
    })
  }
  const progressCopy = () => {
    if (props.controller.stepFinished()) {
      return isTabStep()
        ? 'Full phrase marked. You followed your first one-string tab.'
        : `${props.controller.targetHits()} open-string targets marked. The pulse is yours.`
    }
    if (
      props.controller.stepPassed() &&
      props.controller.hits() < props.controller.passHits()
    ) {
      return isTabStep()
        ? 'Phrase complete. This lap is fresh; your win is already saved.'
        : 'Open-string win saved. This lap is fresh; move on whenever you like.'
    }
    if (props.controller.stepPassed()) {
      return props.controller.nextStep()?.kind === 'one-string-tab'
        ? `${props.controller.passHits()} targets down. Add one more, or move on to the phrase.`
        : `${props.controller.passHits()} targets down. Add one more, or move on.`
    }
    return props.controller.lastFeedback()
  }
  const phraseLabel = () => {
    const exercise = step()
    if (exercise === undefined || exercise.kind !== 'one-string-tab') {
      return `${props.controller.hits()} of ${props.controller.targetHits()}`
    }
    return `Phrase ${Math.min(
      props.controller.currentChunkIndex() + 1,
      exercise.phraseChunks.length,
    )} of ${exercise.phraseChunks.length}`
  }
  const markButtonLabel = () => {
    if (props.controller.stepFinished() && loopedGrooveRunning()) {
      return 'Mark next lap'
    }
    if (props.controller.stepFinished() && props.controller.isFinalStep()) {
      return 'Play again'
    }
    if (props.controller.stepFinished()) return 'Open-string groove complete'
    return `Mark ${targetLabel()}`
  }
  const handleMark = () => {
    if (loopedGrooveRunning()) {
      props.onHit()
      return
    }
    if (props.controller.stepFinished() && props.controller.isFinalStep()) {
      props.controller.restartStep()
      return
    }
    props.onHit()
  }
  const completionLabel = () => {
    if (props.completionAction() === 'load-song') return 'Load a song'
    if (props.completionAction() === 'another-riff') return 'Try another riff'
    return 'Keep jamming'
  }

  return (
    <section class={styles.firstWinRoom} data-testid="guitar-night-first-win">
      <div class={styles.firstWinBrief}>
        {/* A beginner who opened the lesson by accident needs the way out to
            be where every way out is: the top-left corner. It used to be a
            plain "Back" further down the panel, past the controls, which is
            not where anyone looks for it. */}
        <button
          type="button"
          class={styles.firstWinBack}
          data-testid="guitar-night-first-win-back"
          aria-label="Back to Guitar Night"
          onClick={() => props.onBack()}
        >
          <span aria-hidden="true">
            <ChevronLeft />
          </span>
          Back
        </button>
        <p class={styles.eyebrow}>
          Learn · {props.controller.currentStepIndex() + 1} of{' '}
          {props.controller.stepCount()}
        </p>
        <h1 ref={props.headingRef} tabindex="-1">
          {isTabStep()
            ? 'Read a one-string phrase.'
            : 'Make one string groove.'}
        </h1>
        <p class={styles.detailCopy}>
          {isTabStep()
            ? 'Each line is a string. A number is the fret; 0 means open.'
            : 'One line is one string. A 0 means play it open.'}
        </p>
      </div>

      <GuitarNightStage
        source={props.stage}
        active={props.active}
        tuning={props.tuning}
        guideLabel={stageGuideLabel}
        flowLabelMode="fret"
      />

      <div
        class={styles.firstWinDeck}
        data-testid="guitar-night-first-win-deck"
      >
        <div class={styles.firstWinProgress}>
          <div class={styles.previewMeta}>
            <span>
              {targetLabel()} · {tuningLabel()}
            </span>
            <span>{phraseLabel()}</span>
          </div>
          <div
            class={styles.beatRow}
            style={{
              'grid-template-columns': `repeat(${Math.max(1, lessonSegments().length)}, minmax(0, 1fr))`,
            }}
            aria-label={`${props.controller.hits()} of ${props.controller.targetHits()} targets marked`}
          >
            <For each={lessonSegments()}>
              {(segment, index) => (
                <span
                  classList={{
                    [styles.beatFilled]:
                      props.controller.hits() >= segment.endHit,
                    [styles.beatActive]:
                      index() === props.controller.currentChunkIndex() &&
                      !props.controller.stepFinished(),
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
              <small>{grooveDetail()}</small>
            </span>
          </button>
          <button
            class={styles.tapAction}
            type="button"
            aria-label={markButtonLabel()}
            onClick={handleMark}
            disabled={
              props.controller.stepFinished() &&
              !props.controller.isFinalStep() &&
              !loopedGrooveRunning()
            }
          >
            <strong>{markButtonLabel()}</strong>
            <small>
              {props.controller.stepFinished()
                ? loopedGrooveRunning()
                  ? 'Stay with the loop'
                  : props.controller.isFinalStep()
                    ? 'Repeat the phrase'
                    : 'Next lesson is ready'
                : 'Tap or press Space'}
            </small>
          </button>
        </div>

        <div class={styles.firstWinUtilities}>
          <div
            class={styles.practiceModes}
            role="group"
            aria-label="Groove repeat options"
          >
            <button
              type="button"
              aria-pressed={props.controller.loopEnabled()}
              title={
                grooveRunning() && props.controller.loopEnabled()
                  ? 'Stop this loop'
                  : 'Loop this practice'
              }
              disabled={grooveRunning() && !props.controller.loopEnabled()}
              onClick={() =>
                props.controller.setLoopEnabled(!props.controller.loopEnabled())
              }
            >
              Loop
            </button>
            <button
              type="button"
              aria-pressed={props.controller.shuffleBeats()}
              title="Shuffle the beat at each loop"
              disabled={!props.controller.loopEnabled()}
              onClick={() =>
                props.controller.setShuffleBeats(
                  !props.controller.shuffleBeats(),
                )
              }
            >
              Shuffle
            </button>
          </div>
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
                  disabled={grooveRunning()}
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
                  disabled={grooveRunning()}
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
              <label>
                <span>Beat</span>
                <select
                  aria-label="Intro beat"
                  value={props.controller.selectedRhythmPreset().id}
                  onChange={(event) =>
                    props.controller.setRhythmPresetId(
                      event.currentTarget.value,
                    )
                  }
                >
                  <For each={props.controller.rhythmPresets()}>
                    {(preset) => (
                      <option value={preset.id}>{preset.label}</option>
                    )}
                  </For>
                </select>
              </label>
              <GuitarNightDrumSoundControls disabled={grooveRunning()} />
            </div>
          </details>
          <Show
            when={props.controller.stepPassed()}
            fallback={
              <button
                class={styles.workspaceEscape}
                type="button"
                onClick={() => props.onSkip()}
              >
                Full studio
              </button>
            }
          >
            <Show
              when={props.controller.isFinalStep()}
              fallback={
                <button
                  class={styles.completionAction}
                  type="button"
                  onClick={() => props.onAdvance()}
                >
                  {props.controller.nextStep()?.kind === 'one-string-tab'
                    ? 'Read tab'
                    : 'Next exercise'}
                </button>
              }
            >
              <button
                class={styles.completionAction}
                type="button"
                onClick={() => props.onComplete()}
              >
                {completionLabel()}
              </button>
            </Show>
          </Show>
        </div>
      </div>
    </section>
  )
}
