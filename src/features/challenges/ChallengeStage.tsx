// ============================================================
// ChallengeStage — the weekly Legend performed on the zen canvas
// ============================================================
//
// "Sing it" no longer runs the plain sight-singing drill: the challenge's
// melody is laid out in time on the zen pitch stage, the live trace rides
// over it, and notes light up as the singer climbs them. Scoring keeps
// sight-singing parity (per-note proximity, matched floor, unsung = 0) and
// the finished run flows through recordExerciseResult exactly like a drill,
// so the armed weekly attempt, board write and badges are untouched.
//
// One take counts: there is no pause and no in-stage retry. Ending the run
// early scores what was sung (the drill's "Stop & Score" semantic). The
// after-run moment belongs to the Challenges tab: the weekly return path
// presents the result card and navigates there itself (which unmounts this
// stage); the stage keeps only a fallback hand-off for runs the weekly path
// does not consume.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { Play, Trophy, X } from '@/components/icons'
import { PitchStageShell } from '@/components/pitch-stage/PitchStageShell'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import { TAB_CHALLENGES } from '@/features/tabs/constants'
import { midiToNote } from '@/lib/scale-data'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { ChallengeStageLaunch } from '@/stores/ui-store'
import { setActiveTab } from '@/stores/ui-store'
import type { ZenPitchRun } from '../zen/types'
import { useZenPitchSession } from '../zen/useZenPitchSession'
import type { ZenCanvasRenderModel } from '../zen/zen-canvas-renderer'
import { ZenPitchCanvas } from '../zen/ZenPitchCanvas'
import { CHALLENGE_LEAD_IN_BEATS, challengeTargetHighlights, challengeToZenExercise, summarizeChallengeRun, } from './challenge-stage-model'
import styles from './ChallengeStage.module.css'
import { clearWeeklyAttempt } from './weekly-attempt'

interface ChallengeStageProps {
  launch: ChallengeStageLaunch
  subscribeFrames: (listener: PracticeFrameListener) => () => void
  micActive: Accessor<boolean>
  startMic: () => Promise<boolean>
  stopMic: () => void
  onClose: () => void
}

interface ChallengeOutcome {
  /** The recorded pass's trace, frozen for the final lit-line view. */
  points: ZenPitchRun['points']
}

/**
 * Fallback hand-off delay. The weekly return path normally presents the
 * result card and navigates to the Challenges tab itself; this timer only
 * fires when that path did not (attempt disarmed, persistence failure, or
 * the stage was launched over the Challenges tab so no transition occurs).
 */
const DONE_FALLBACK_MS = 1600

export function ChallengeStage(props: ChallengeStageProps) {
  // The launch object is immutable for this mount (keyed <Show>), so the
  // synthetic exercise is built once.
  const launch = untrack(() => props.launch)
  // Fitted to the singer's comfortable range by whole octaves — the
  // drill this replaces always generated notes the singer could reach.
  const definition = challengeToZenExercise(
    {
      id: launch.challengeId,
      title: launch.title,
      targetItems: launch.targetItems,
    },
    getComfortableMidiRange(vocalRangePreset()),
  )

  const [outcome, setOutcome] = createSignal<ChallengeOutcome | null>(null)
  const [startError, setStartError] = createSignal<string | null>(null)
  // First full (or ended-early) pass of this attempt. Plain var: written from
  // the frame callback, read once on completion.
  let finishedRun: ZenPitchRun | null = null
  let completing = false
  let doneTimer: ReturnType<typeof setTimeout> | undefined

  const session = useZenPitchSession({
    ...(definition === null ? {} : { initialExerciseDefinition: definition }),
    subscribeFrames: (listener) => props.subscribeFrames(listener),
    micActive: () => props.micActive(),
    startMic: () => props.startMic(),
    stopMic: () => props.stopMic(),
    onRunFinalized: (run) => {
      finishedRun ??= run
    },
  })

  const leadInSec = (): number =>
    definition === null ? 0 : (CHALLENGE_LEAD_IN_BEATS * 60) / definition.bpm

  const phase = (): 'ready' | 'live' | 'done' => {
    if (outcome() !== null) return 'done'
    return session.status() === 'running' ? 'live' : 'ready'
  }

  const finishToBoard = (): void => {
    clearTimeout(doneTimer)
    setActiveTab(TAB_CHALLENGES)
    props.onClose()
  }

  const completeRun = (): void => {
    if (completing) return
    completing = true
    // finish() may finalize a trailing fragment of the next loop; the
    // onRunFinalized guard keeps the first (real) pass. A run with too few
    // voiced points finalizes to null — summarised as an unsung take.
    session.finish()
    const run = finishedRun
    const targets = untrack(session.targets)
    const summary = summarizeChallengeRun(
      run?.points ?? [],
      targets,
      run?.durationSec ?? 0,
    )

    // The single funnel every exercise uses — the armed weekly attempt
    // consumes this entry, writes the board row, presents the result card
    // and navigates to the Challenges tab. Metrics mirror the drill's
    // result shape exactly.
    recordExerciseResult({
      type: EXERCISE_SIGHT_SINGING,
      score: summary.score,
      metrics: {
        notesAttempted: summary.notesAttempted,
        notesScored: summary.notesScored,
        avgAccuracy: summary.avgAccuracy,
        bestNote: summary.bestNote,
      },
      completedAt: Date.now(),
    })

    setOutcome({ points: run?.points ?? [] })
    doneTimer = setTimeout(finishToBoard, DONE_FALLBACK_MS)
  }

  // A pass ends when the session's loop wraps: elapsed snaps from the loop's
  // end back to ~0 inside one frame. Completion leaves the frame callback via
  // a microtask so finish() never re-enters consumeFrame's stack.
  createEffect(
    on(session.elapsedSec, (elapsed, previous) => {
      if (completing || previous === undefined) return
      const loop = session.loopDurationSec()
      if (previous > loop - 1.5 && elapsed < 1.5 && previous - elapsed > 1) {
        queueMicrotask(completeRun)
      }
    }),
  )

  const begin = async (): Promise<void> => {
    if (definition === null || completing) return
    setStartError(null)
    finishedRun = null
    const started = await session.start()
    if (!started) {
      setStartError(
        'Microphone access is needed to sing the challenge. Check the browser permission and try again.',
      )
    }
  }

  const endAndScore = (): void => {
    if (phase() !== 'live') return
    completeRun()
  }

  const highlights = createMemo(() => {
    const done = outcome()
    const targets = session.targets()
    const points = done?.points ?? session.activePoints()
    // After the run every window has passed — freeze the highlight clock at
    // the full loop so cleared notes keep shining and missed ones recede.
    const clock =
      done !== null ? session.loopDurationSec() : session.elapsedSec()
    return challengeTargetHighlights(points, targets, clock)
  })

  const litCount = createMemo(() => {
    let count = 0
    for (const highlight of highlights().values()) {
      if (highlight.cleared) count += 1
    }
    return count
  })

  const canvasModel = createMemo<ZenCanvasRenderModel>(() => {
    const done = outcome()
    return {
      durationSec: session.loopDurationSec(),
      elapsedSec:
        done !== null ? session.loopDurationSec() : session.elapsedSec(),
      viewport: session.viewport(),
      targets: session.targets(),
      targetVisibility: 'on',
      showPlayhead: done === null && session.status() === 'running',
      points: done?.points ?? session.activePoints(),
      targetHighlights: highlights(),
    }
  })

  const canvasSummary = createMemo(() => {
    const model = canvasModel()
    const voiced = [...model.points]
      .reverse()
      .find((point) => point.midi !== null)
    if (voiced?.midi === null || voiced === undefined) {
      return `${launch.title}; waiting for your voice.`
    }
    const note = midiToNote(Math.round(voiced.midi))
    return `${launch.title}; current pitch ${note.name}${note.octave}.`
  })

  const statusLabel = (): string => {
    switch (phase()) {
      case 'live':
        return 'Listening'
      case 'done':
        return 'Recorded'
      default:
        return 'Ready'
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    // One take counts: while the run is live, Escape neither quits nor
    // scores — only the explicit "End & score" button does. Idle Escape
    // closes without touching the armed attempt.
    if (event.key === 'Escape' && !event.defaultPrevented) {
      if (phase() !== 'ready') return
      event.preventDefault()
      props.onClose()
      return
    }
    if (event.code === 'Space' && !event.repeat && !event.defaultPrevented) {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('input,textarea,select,button,[contenteditable]') !==
          null
      ) {
        return
      }
      if (phase() !== 'ready') return
      event.preventDefault()
      void begin()
    }
  }

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
  })

  onCleanup(() => {
    window.removeEventListener('keydown', onKeyDown)
    clearTimeout(doneTimer)
    // Abandoning mid-run (tab navigation unmounts the stage) records
    // nothing — parity with leaving a drill. The zen session releases a mic
    // it acquired in its own cleanup.
    //
    // Leaving also DISARMS the attempt. The stage is the only way to sing a
    // Legend, but recordWeeklyAttempt matches on exercise type alone — so an
    // attempt left armed here would be silently consumed by the next
    // ordinary sight-singing drill, whose notes are randomly generated
    // inside the singer's own comfortable range. That easier run would post
    // to the Legend board as the attempt. Arming lives exactly as long as
    // the stage does.
    if (!completing) clearWeeklyAttempt()
  })

  const noteRange = (): string => {
    if (definition === null) return ''
    const midis = definition.targets.map(
      (target) => definition.defaultRootMidi + target.semitone,
    )
    const low = midiToNote(Math.min(...midis))
    const high = midiToNote(Math.max(...midis))
    return `${low.name}${low.octave} – ${high.name}${high.octave}`
  }

  return (
    <div class={styles.root}>
      <PitchStageShell
        mode="challenge"
        testId="challenge-stage"
        class={styles.stage}
        ariaLabel="Weekly challenge performance stage"
        eyebrow="This Week's Legend"
        title={launch.title}
        icon={<Trophy />}
        referenceColor={PITCH_VISUAL_COLORS.reference}
        userColor={PITCH_VISUAL_COLORS.singer}
        legend={[
          { label: 'Challenge note', color: PITCH_VISUAL_COLORS.reference },
          { label: 'Your voice', color: PITCH_VISUAL_COLORS.singer },
        ]}
        headerMeta={
          <>
            <span>{statusLabel()}</span>
            <span>Target {launch.targetScore}%</span>
          </>
        }
        primaryAction={
          <Show
            when={phase() === 'live'}
            fallback={
              <Show
                when={phase() === 'done'}
                fallback={
                  <button
                    type="button"
                    class={styles.closeButton}
                    onClick={() => props.onClose()}
                  >
                    <X />
                    Close
                  </button>
                }
              >
                <button
                  type="button"
                  class={styles.closeButton}
                  onClick={finishToBoard}
                >
                  To the board
                </button>
              </Show>
            }
          >
            <button
              type="button"
              class={styles.endButton}
              data-testid="challenge-end"
              onClick={endAndScore}
            >
              End & score
            </button>
          </Show>
        }
        canvas={<ZenPitchCanvas model={canvasModel} summary={canvasSummary} />}
        footer={
          <>
            <div class={styles.notesReadout}>
              <strong>{litCount()}</strong>
              <span>of {definition?.targets.length ?? 0} notes lit</span>
            </div>
            <div class={styles.transportReadout}>
              <Show
                when={phase() === 'live'}
                fallback={
                  <span class={styles.footerHint}>
                    {phase() === 'done'
                      ? 'Take recorded — heading to the board'
                      : 'One take counts'}
                  </span>
                }
              >
                <Show
                  when={session.elapsedSec() >= leadInSec()}
                  fallback={
                    <span class={styles.footerHint}>
                      Sing as the line reaches each note
                    </span>
                  }
                >
                  <span class={styles.timeReadout}>
                    {session.elapsedSec().toFixed(1)} /{' '}
                    {session.loopDurationSec().toFixed(1)} sec
                  </span>
                </Show>
              </Show>
            </div>
            <div class={styles.targetReadout}>
              <span>Range {noteRange()}</span>
            </div>
          </>
        }
      />

      <Show when={phase() === 'ready'}>
        <div class={styles.overlay}>
          <div class={styles.readyCard} data-testid="challenge-ready-card">
            <p class={styles.cardEyebrow}>One take counts</p>
            <h3>{launch.title}</h3>
            <p class={styles.cardMeta}>
              {definition?.targets.length ?? 0} notes · {noteRange()} · target{' '}
              {launch.targetScore}%
            </p>
            <p class={styles.cardHint}>
              The line travels the canvas once. Sing each note as the playhead
              reaches it — held, in-tune notes light up and stay shining.
            </p>
            <Show when={startError()}>
              <p class={styles.error} role="alert">
                {startError()}
              </p>
            </Show>
            <Show
              when={definition !== null}
              fallback={
                <p class={styles.error} role="alert">
                  This challenge has no notes to sing yet. Check back soon.
                </p>
              }
            >
              <button
                type="button"
                class={styles.beginButton}
                data-testid="challenge-begin"
                onClick={() => void begin()}
              >
                <Play />
                Begin the take
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
