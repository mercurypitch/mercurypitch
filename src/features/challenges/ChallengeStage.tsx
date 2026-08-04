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
// One armed take counts. Ending early scores what was sung (the drill's
// "Stop & Score" semantic), then the canvas freezes under the app-level
// result card. The singer can review that contour, practise the same line
// without posting another attempt, or explicitly arm a scored retake.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { Loop, Pause, Play, Trophy, Volume2, VolumeX, X, } from '@/components/icons'
import { MicInsightHint } from '@/components/MicInsightHint'
import { MicTroubleshooting } from '@/components/MicTroubleshooting'
import { PitchStageShell } from '@/components/pitch-stage/PitchStageShell'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { micManager } from '@/lib/mic-manager'
import { midiToNote } from '@/lib/scale-data'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { vocalRangePreset } from '@/stores/settings-store'
import type { ChallengeStageLaunch } from '@/stores/ui-store'
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
  micError: Accessor<string | null>
  getMicLevel: () => number
  isDetecting: () => boolean
  startMic: () => Promise<boolean>
  stopMic: () => void
  playTone: (frequency: number, durationMs: number) => Promise<void>
  stopTone: () => void
  onClose: () => void
}

interface ChallengeOutcome {
  /** The finished pass's trace, frozen for the final lit-line view. */
  points: ZenPitchRun['points']
  kind: ChallengeRunKind
}

type ChallengeRunKind = 'attempt' | 'practice'

export function ChallengeStage(props: ChallengeStageProps) {
  // The launch object is immutable for this mount (keyed <Show>), so the
  // synthetic exercise is built once.
  const launch = untrack(() => props.launch)
  const definition = challengeToZenExercise({
    id: launch.challengeId,
    title: launch.title,
    targetItems: launch.targetItems,
  })

  // The challenge is sung at its authored pitch (the feat is the pitch).
  // When it sits outside the singer's configured range we SAY so before
  // they start — inclusivity here is honesty plus a per-voice-type
  // split of the weekly slate, never a silent transposition.
  const outOfRange = (): string | null => {
    const range = getComfortableMidiRange(vocalRangePreset())
    const midis = launch.targetItems.map((item) => item.note.midi)
    if (midis.length === 0) return null
    const high = Math.max(...midis)
    const low = Math.min(...midis)
    if (high > range.max) return 'above'
    if (low < range.min) return 'below'
    return null
  }

  const [outcome, setOutcome] = createSignal<ChallengeOutcome | null>(null)
  const launchRunKind: ChallengeRunKind =
    launch.mode === 'practice' ? 'practice' : 'attempt'
  const [runKind, setRunKind] = createSignal<ChallengeRunKind>(launchRunKind)
  const [startError, setStartError] = createSignal<string | null>(null)
  const [previewError, setPreviewError] = createSignal<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = createSignal(false)
  const [melodyGuideOn, setMelodyGuideOn] = createSignal(false)
  const [practiceLoopOn, setPracticeLoopOn] = createSignal(false)
  // First full (or ended-early) pass of this attempt. Plain var: written from
  // the frame callback, read once on completion.
  let finishedRun: ZenPitchRun | null = null
  let completing = false
  let previewToken = 0
  let previewTimers: ReturnType<typeof setTimeout>[] = []
  let liveRunKind: ChallengeRunKind = launchRunKind
  let loopPracticePlain = false
  let playedGuideTargets = new Set<string>()

  const session = useZenPitchSession({
    ...(definition === null ? {} : { initialExerciseDefinition: definition }),
    subscribeFrames: (listener) => props.subscribeFrames(listener),
    micActive: () => props.micActive(),
    startMic: () => props.startMic(),
    stopMic: () => props.stopMic(),
    onRunFinalized: (run) => {
      if (liveRunKind === 'practice' && loopPracticePlain) {
        finishedRun = run
      } else {
        finishedRun ??= run
      }
    },
  })

  const leadInSec = (): number =>
    definition === null ? 0 : (CHALLENGE_LEAD_IN_BEATS * 60) / definition.bpm

  const phase = (): 'ready' | 'live' | 'done' => {
    if (outcome() !== null) return 'done'
    return session.status() === 'running' ? 'live' : 'ready'
  }

  // A live attempt owns the mic. This is the one run where an interruption
  // costs the singer a graded result, so it outranks every release policy.
  onCleanup(
    micManager.registerRunGuard(
      'challenge-attempt',
      // Deliberately untracked: MicManager polls this from its own timers, so
      // there is no reactive scope to belong to.
      // eslint-disable-next-line solid/reactivity
      () => phase() === 'live',
    ),
  )

  const micInsights = useMicInsights({
    enabled: () => phase() === 'live',
    micActive: () => props.micActive(),
    isPlaying: () => phase() === 'live',
    getLevel: () => props.getMicLevel(),
    isDetecting: () => props.isDetecting(),
  })

  const stopPreview = (): void => {
    previewToken += 1
    for (const timer of previewTimers) clearTimeout(timer)
    previewTimers = []
    if (previewPlaying()) props.stopTone()
    setPreviewPlaying(false)
  }

  const playPreview = (): void => {
    if (definition === null || definition.targets.length === 0) return
    if (previewPlaying()) {
      stopPreview()
      return
    }

    stopPreview()
    setPreviewError(null)
    setPreviewPlaying(true)
    const token = previewToken
    const beatMs = 60_000 / definition.bpm
    const targets = definition.targets
    const firstStartBeat = targets[0]!.startBeat

    const playTarget = (index: number): void => {
      if (token !== previewToken) return
      const target = targets[index]!
      const durationMs = Math.max(120, target.durationBeats * beatMs)
      void props
        .playTone(
          midiToFrequency(definition.defaultRootMidi + target.semitone),
          durationMs,
        )
        .catch(() => {
          setTimeout(() => {
            if (token !== previewToken) return
            stopPreview()
            setPreviewError(
              'The melody could not play. Check your audio output and try again.',
            )
          }, 0)
        })
    }

    // The first tone starts inside the click handler so mobile browsers can
    // unlock audio. Remaining notes retain the authored rhythm from there.
    playTarget(0)
    for (let index = 1; index < targets.length; index += 1) {
      const target = targets[index]!
      previewTimers.push(
        setTimeout(
          () => playTarget(index),
          (target.startBeat - firstStartBeat) * beatMs,
        ),
      )
    }
    const last = targets[targets.length - 1]!
    const totalMs =
      (last.startBeat - firstStartBeat + last.durationBeats) * beatMs
    previewTimers.push(
      setTimeout(() => {
        if (token !== previewToken) return
        previewTimers = []
        setPreviewPlaying(false)
      }, totalMs),
    )
  }

  const toggleMelodyGuide = (): void => {
    const next = !melodyGuideOn()
    playedGuideTargets = new Set()
    setMelodyGuideOn(next)
    if (!next) props.stopTone()
  }

  const togglePracticeLoop = (): void => {
    const next = !practiceLoopOn()
    loopPracticePlain = next
    setPracticeLoopOn(next)
  }

  // Optional guide-note playback for unscored practice. It follows the same
  // target windows as the canvas and re-arms at every loop seam.
  createEffect(() => {
    const enabled = melodyGuideOn()
    const kind = runKind()
    const status = session.status()
    const elapsed = session.elapsedSec()
    if (!enabled || kind !== 'practice' || status !== 'running') return

    for (const target of session.targets()) {
      if (
        playedGuideTargets.has(target.id) ||
        elapsed < target.startSec ||
        elapsed >= target.endSec
      ) {
        continue
      }
      playedGuideTargets.add(target.id)
      void props
        .playTone(
          midiToFrequency(target.startMidi),
          Math.min(1200, Math.max(300, (target.endSec - elapsed) * 1000)),
        )
        .catch(() => {
          setTimeout(() => {
            setMelodyGuideOn(false)
            props.stopTone()
          }, 0)
        })
    }
  })

  const completeRun = (): void => {
    if (completing) return
    completing = true
    if (melodyGuideOn()) props.stopTone()
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

    const kind = untrack(runKind)
    if (kind === 'attempt') {
      // The single funnel every scored exercise uses — the armed weekly
      // attempt consumes this entry, writes the board row, and presents the
      // app-level result card. Practice replays deliberately skip the funnel.
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
    }

    setOutcome({ points: run?.points ?? [], kind })
  }

  // A pass ends when the session's loop wraps: elapsed snaps from the loop's
  // end back to ~0 inside one frame. Completion leaves the frame callback via
  // a microtask so finish() never re-enters consumeFrame's stack.
  createEffect(
    on(session.elapsedSec, (elapsed, previous) => {
      if (completing || previous === undefined) return
      const loop = session.loopDurationSec()
      if (previous > loop - 1.5 && elapsed < 1.5 && previous - elapsed > 1) {
        playedGuideTargets = new Set()
        if (runKind() === 'practice' && practiceLoopOn()) return
        queueMicrotask(completeRun)
      }
    }),
  )

  const begin = async (
    kind: ChallengeRunKind = launchRunKind,
  ): Promise<void> => {
    if (definition === null || session.status() === 'running') return
    const previousOutcome = outcome()
    stopPreview()
    setStartError(null)
    finishedRun = null
    playedGuideTargets = new Set()
    liveRunKind = kind
    setRunKind(kind)
    completing = false
    const started = await session.start()
    if (!started) {
      completing = previousOutcome !== null
      if (previousOutcome !== null) setRunKind(previousOutcome.kind)
      setStartError(
        props.micError() ??
          'The microphone could not start. Check browser permission and the selected input device.',
      )
      return
    }
    setOutcome(null)
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
      ...(definition === null
        ? {}
        : { timeGridIntervalSec: 60 / definition.bpm }),
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
        return runKind() === 'practice' && practiceLoopOn()
          ? 'Looping practice'
          : 'Listening'
      case 'done':
        return outcome()?.kind === 'practice' ? 'Practice complete' : 'Recorded'
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
    stopPreview()
    if (melodyGuideOn()) props.stopTone()
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
        ariaLabel={
          launch.mode === 'practice'
            ? 'Past challenge practice stage'
            : 'Weekly challenge performance stage'
        }
        eyebrow={
          launch.mode === 'practice'
            ? 'Past Legend · practice'
            : "This Week's Legend"
        }
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
            <span>
              {launch.mode === 'practice' ? 'Benchmark' : 'Target'}{' '}
              {launch.targetScore}%
            </span>
          </>
        }
        primaryAction={
          <Show
            when={phase() === 'done' || runKind() === 'practice'}
            fallback={
              <Show when={phase() === 'ready'}>
                <button
                  type="button"
                  class={styles.closeButton}
                  onClick={() => props.onClose()}
                >
                  <X />
                  <span class={styles.controlLabel}>Close</span>
                </button>
              </Show>
            }
          >
            <div class={styles.headerControls}>
              <button
                type="button"
                class={styles.toggleButton}
                classList={{ [styles.toggleActive]: melodyGuideOn() }}
                data-testid="challenge-melody-toggle"
                aria-pressed={melodyGuideOn()}
                aria-label={
                  melodyGuideOn()
                    ? 'Turn melody guide off'
                    : 'Turn melody guide on'
                }
                title={melodyGuideOn() ? 'Melody guide on' : 'Melody guide off'}
                onClick={toggleMelodyGuide}
              >
                {melodyGuideOn() ? <Volume2 /> : <VolumeX />}
                <span class={styles.controlLabel}>Melody</span>
              </button>
              <button
                type="button"
                class={styles.toggleButton}
                classList={{ [styles.toggleActive]: practiceLoopOn() }}
                data-testid="challenge-loop-toggle"
                aria-pressed={practiceLoopOn()}
                aria-label={
                  practiceLoopOn()
                    ? 'Turn continuous practice off'
                    : 'Loop practice continuously'
                }
                title={practiceLoopOn() ? 'Continuous loop on' : 'Loop off'}
                onClick={togglePracticeLoop}
              >
                <Loop />
                <span class={styles.controlLabel}>Loop</span>
              </button>
              <button
                type="button"
                class={styles.closeButton}
                onClick={() => props.onClose()}
              >
                <X />
                <span class={styles.controlLabel}>Close</span>
              </button>
            </div>
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
                  <Show
                    when={phase() === 'done'}
                    fallback={
                      <span class={styles.footerHint}>
                        {launch.mode === 'practice'
                          ? 'Practice only — not added to the board'
                          : 'One take counts'}
                      </span>
                    }
                  >
                    <div class={styles.transportStack}>
                      <button
                        type="button"
                        class={styles.practiceButton}
                        data-testid="challenge-practice"
                        onClick={() => void begin('practice')}
                      >
                        <Play />
                        {practiceLoopOn()
                          ? 'Start looping'
                          : 'Practise the line'}
                      </button>
                      <span class={styles.footerHint}>
                        {outcome()?.kind === 'practice'
                          ? 'Practice run — not added to the board'
                          : 'Take recorded — review or practise the line'}
                      </span>
                    </div>
                  </Show>
                }
              >
                <div class={styles.transportStack}>
                  <button
                    type="button"
                    class={styles.endButton}
                    data-testid="challenge-end"
                    onClick={endAndScore}
                  >
                    {runKind() === 'attempt' ? 'End & score' : 'End practice'}
                  </button>
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
                      {runKind() === 'practice' && practiceLoopOn()
                        ? ' · looping'
                        : ''}
                    </span>
                  </Show>
                </div>
              </Show>
            </div>
            <div class={styles.targetReadout}>
              <span>Range {noteRange()}</span>
            </div>
          </>
        }
      />

      <MicInsightHint
        message={micInsights.message}
        insight={micInsights.insight}
        class={styles.micInsight}
        style={{
          position: 'fixed',
          top: '96px',
          left: '50%',
          transform: 'translateX(-50%)',
          'z-index': 'calc(var(--z-focus, 500) + 2)',
          width: 'max-content',
          'max-width': 'min(680px, calc(100vw - 32px))',
          'white-space': 'normal',
        }}
      />

      <Show when={phase() === 'ready'}>
        <div class={styles.overlay}>
          <div class={styles.readyCard} data-testid="challenge-ready-card">
            <p class={styles.cardEyebrow}>
              {launch.mode === 'practice'
                ? 'Unranked practice'
                : 'One take counts'}
            </p>
            <h3>{launch.title}</h3>
            <p class={styles.cardMeta}>
              {definition?.targets.length ?? 0} notes · {noteRange()} ·{' '}
              {launch.mode === 'practice' ? 'benchmark' : 'target'}{' '}
              {launch.targetScore}%
            </p>
            <button
              type="button"
              class={styles.previewButton}
              aria-pressed={previewPlaying()}
              onClick={playPreview}
            >
              <Show when={previewPlaying()} fallback={<Play />}>
                <Pause />
              </Show>
              {previewPlaying() ? 'Stop melody' : 'Hear the melody'}
            </button>
            <p class={styles.cardHint}>
              The line travels the canvas once. Sing each note as the playhead
              reaches it — held, in-tune notes light up and stay shining.
            </p>
            <Show when={launch.mode === 'practice'}>
              <p class={styles.practiceNotice}>
                This week has ended. Practise as often as you like — these runs
                stay off the weekly board.
              </p>
            </Show>
            <Show when={outOfRange() !== null}>
              <p class={styles.cardRange}>
                This Legend is written{' '}
                {outOfRange() === 'above' ? 'above' : 'below'} your{' '}
                {vocalRangePreset()} range — it is a feat for another voice
                type. Sing it anyway if you like; the pitch is the challenge, so
                it is scored as written.
              </p>
            </Show>
            <Show when={startError()}>
              <p class={styles.error} role="alert">
                {startError()}
              </p>
            </Show>
            <Show when={previewError()}>
              <p class={styles.error} role="alert">
                {previewError()}
              </p>
            </Show>
            <MicTroubleshooting />
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
                {launch.mode === 'practice'
                  ? 'Begin practice'
                  : 'Begin the take'}
              </button>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
