// ============================================================
// Song runner view — Solid HUD, notation, setup, and edge-filtered controls.
// ============================================================

import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { GlassMicrophoneInput } from '../host'
import type { CompiledRunnerCourse, RunnerEvent } from '../runner/contracts'
import { runnerMovementCue } from '../runner/movement-cues'
import type { RunnerNotationNote } from '../runner/notation'
import { runnerMidiName, runnerNotationNotes } from '../runner/notation'
import type { RunnerSessionFrame, RunnerSessionPhase, SongRunnerSession, } from '../runner/session-contracts'
import type { DevelopmentRenderControls } from './DevelopmentRenderTuning'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import { createRunnerContinuousInput } from './runner-continuous-input'
import { runnerDisplayNotationNotes, runnerEventAnnouncement, runnerMicrophoneStatus, runnerMovementCueCopy, runnerPauseMessage, runnerRecoveryCopy, runnerTargetResultNotice, runnerVoiceCue, } from './runner-hud'
import { createRunnerInputEdges } from './runner-input'
import { runnerUpcomingCue } from './runner-upcoming-cue'
import { RunnerControls } from './RunnerControls'
import { RunnerFinishRewards } from './RunnerFinishRewards'
import { RunnerNotation } from './RunnerNotation'
import type { RunnerCameraControls } from './RunnerSoundTune'
import { RunnerSetup, RunnerSoundTune } from './RunnerSoundTune'
import { RunnerUpcomingCue } from './RunnerUpcomingCue'
import styles from './SongRunnerView.module.css'

interface SongRunnerViewProps {
  developmentControls?: DevelopmentRenderControls
  cameraControls?: RunnerCameraControls
  course: CompiledRunnerCourse
  session: SongRunnerSession
  assetUrl(id: string): string
  microphoneInput?: GlassMicrophoneInput
  comfortableMidi: number
  comfortableMidiRange: {
    readonly minimumMidi: number
    readonly maximumMidi: number
  }
  onComfortableMidiChange(midi: number): void
  onExit(): void
  presentationLoading?: boolean
  presentationError?: string
  onRetryPresentation?(): void
  mountScene(container: HTMLDivElement): () => void
}

function phaseAnnouncement(phase: RunnerSessionPhase): string | null {
  switch (phase) {
    case 'readiness':
      return 'Sing the note shown and hold until the note fills.'
    case 'count-in':
      return 'Get ready. Count-in started.'
    case 'running':
      return 'Course running.'
    case 'paused':
      return 'Course paused.'
    case 'recovering':
      return 'Returning to the last checkpoint.'
    case 'finished':
      return 'Course complete.'
    case 'error':
      return 'The run needs your attention.'
    default:
      return null
  }
}

function clampedPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.min(1, Math.max(0, value)) * 100)
}

function setupNote(midi: number, fillProgress = 0): RunnerNotationNote {
  return {
    index: 0,
    startBeat: 0,
    endBeat: 4,
    startMidi: midi,
    endMidi: midi,
    connection: 'separate',
    fillProgress,
    state:
      fillProgress >= 1 ? 'filled' : fillProgress > 0 ? 'filling' : 'hollow',
  }
}

export function SongRunnerView(props: SongRunnerViewProps) {
  const [frame, setFrame] = createSignal<RunnerSessionFrame>({
    state: untrack(() => props.session.state()),
    events: [],
  })
  const [announcement, setAnnouncement] = createSignal('')
  const [soundRequest, setSoundRequest] = createSignal(0)
  const [lastRecoveryReason, setLastRecoveryReason] = createSignal<
    Extract<RunnerEvent, { type: 'recovery-required' }>['reason'] | ''
  >('')
  const [lastTargetResult, setLastTargetResult] = createSignal<{
    readonly id: string
    readonly epoch: string
    readonly outcome: 'hit' | 'miss'
    readonly resolvedAtCourseSeconds: number
  } | null>(null)
  let sceneContainer!: HTMLDivElement
  let runnerElement!: HTMLElement
  let dialogElement: HTMLElement | undefined
  let soundReturnTarget: HTMLButtonElement | undefined

  const state = createMemo(() => frame().state)
  const phase = createMemo(() => state().phase)
  const game = createMemo(() => state().game)
  const steering = untrack(() => props.course.movement.kind === 'continuous')
    ? createRunnerContinuousInput(
        () => props.session.input('jump'),
        (axis) => props.session.steer(axis),
      )
    : undefined
  const input =
    steering ?? createRunnerInputEdges((action) => props.session.input(action))
  const progress = createMemo(() =>
    clampedPercent(game().courseBeat / props.course.lengthBeats),
  )
  // The frozen game can still describe the previous wall while restarting.
  // Readiness always listens for the comfortable note, not that wall's pitch.
  const activeTarget = createMemo(() =>
    state().phase === 'running' ? game().activeTarget : null,
  )
  const pitchTarget = createMemo(() => {
    const readiness = state().readiness
    if (state().phase === 'readiness' && readiness !== null)
      return {
        currentTargetMidi: readiness.targetMidi,
        pitchFeedback: readiness.pitchFeedback,
      }
    return activeTarget()
  })
  const compiledTarget = createMemo(() => {
    const target = activeTarget()
    return target === null
      ? null
      : (props.course.targets.find((candidate) => candidate.id === target.id) ??
          null)
  })
  const notationNotes = createMemo<readonly RunnerNotationNote[]>(() => {
    const target = activeTarget()
    const compiled = compiledTarget()
    if (target !== null && compiled !== null)
      return runnerDisplayNotationNotes(
        compiled,
        runnerNotationNotes(compiled.notes, target.notes),
      )
    const readiness = state().readiness
    return [
      setupNote(
        readiness?.targetMidi ?? props.comfortableMidi,
        readiness?.fillProgress ?? 0,
      ),
    ]
  })
  const voiceCue = createMemo(() => {
    const target = activeTarget()
    return target === null ? null : runnerVoiceCue(target)
  })
  const movementHint = createMemo(() =>
    state().phase === 'running'
      ? runnerMovementCue(props.course, game())
      : null,
  )
  const movementCopy = createMemo(() => {
    const hint = movementHint()
    return hint === null ? null : runnerMovementCueCopy(hint)
  })
  const recentResult = createMemo(() => {
    if (state().phase !== 'running') return null
    return runnerTargetResultNotice(
      props.course,
      props.comfortableMidi,
      lastTargetResult(),
      game().epoch,
      game().courseSeconds,
    )
  })
  const showNotation = createMemo(
    () =>
      ['readiness', 'count-in'].includes(state().phase) ||
      (state().phase === 'running' &&
        activeTarget() !== null &&
        movementHint() === null &&
        recentResult() === null),
  )
  const notationPhaseLabel = createMemo(() => {
    if (state().phase === 'readiness') return 'Sing to start'
    if (state().phase === 'count-in') return 'Get ready'
    return voiceCue()?.label ?? 'Your note'
  })
  const notationInstruction = createMemo(() => {
    if (state().phase === 'readiness')
      return `Sing ${runnerMidiName(state().readiness?.targetMidi ?? props.comfortableMidi).text} to start`
    if (state().phase === 'count-in')
      return runnerMidiName(props.comfortableMidi).text
    return voiceCue()?.instruction ?? 'Your note'
  })
  const notationScoreStatus = createMemo(() => {
    if (state().phase === 'readiness') return 'Start note'
    if (state().phase === 'count-in') return 'Scoring opens after count-in'
    return voiceCue()?.scoreStatus ?? 'Scoring closed'
  })
  const showPitchReadout = createMemo(
    () => state().phase === 'readiness' || voiceCue()?.scoringOpen === true,
  )
  const upcomingCue = createMemo(() =>
    state().phase === 'running'
      ? runnerUpcomingCue(props.course, game(), props.comfortableMidi)
      : null,
  )
  const maximumStars = createMemo(
    () =>
      props.course.targets.filter((target) => target.requiredForGrade).length *
      3,
  )
  const gradedTargetIds = createMemo(
    () =>
      new Set(
        props.course.targets
          .filter((target) => target.requiredForGrade)
          .map((target) => target.id),
      ),
  )
  const runStars = createMemo(() => {
    const graded = gradedTargetIds()
    return game().resolvedTargets.reduce(
      (total, result) =>
        total + (graded.has(result.targetId) ? (result.grade ?? 0) : 0),
      0,
    )
  })
  const bestStars = createMemo(() => {
    const graded = gradedTargetIds()
    return game().bestTargetQualities.reduce(
      (total, quality) =>
        total + (graded.has(quality.targetId) ? quality.grade : 0),
      0,
    )
  })
  const recovery = createMemo(() => runnerRecoveryCopy(lastRecoveryReason()))
  const closedSetup = createMemo(
    () =>
      state().microphone === 'closed' &&
      ['idle', 'paused', 'error'].includes(state().phase),
  )
  const presentationReady = createMemo(
    () =>
      props.presentationLoading !== true &&
      (props.presentationError === undefined ||
        props.presentationError.length === 0),
  )

  createEffect(() => {
    const session = props.session
    let previousPhase = session.state().phase
    setLastRecoveryReason('')
    setLastTargetResult(null)
    setFrame({ state: session.state(), events: [] })
    const unsubscribe = session.subscribe((nextFrame) => {
      setFrame(nextFrame)
      const previousResult = untrack(lastTargetResult)
      if (
        previousResult !== null &&
        previousResult.epoch !== nextFrame.state.game.epoch
      )
        setLastTargetResult(null)
      if (
        previousPhase === 'recovering' &&
        nextFrame.state.phase !== 'recovering'
      )
        setLastRecoveryReason('')
      for (const event of nextFrame.events) {
        if (event.type === 'recovery-required') {
          setLastRecoveryReason(event.reason)
          setLastTargetResult(null)
        }
        if (event.type === 'target-hit' || event.type === 'target-miss')
          setLastTargetResult({
            id: event.result.targetId,
            epoch: event.epoch,
            outcome: event.result.outcome,
            resolvedAtCourseSeconds: event.result.resolvedAtCourseSeconds,
          })
      }
      const newestEvent = nextFrame.events.at(-1)
      if (newestEvent !== undefined)
        setAnnouncement(runnerEventAnnouncement(newestEvent))
      else if (nextFrame.state.phase !== previousPhase) {
        const message = phaseAnnouncement(nextFrame.state.phase)
        if (message !== null) setAnnouncement(message)
      }
      previousPhase = nextFrame.state.phase
    })
    onCleanup(unsubscribe)
  })

  createEffect(() => {
    input.setEnabled(state().phase === 'running')
  })

  createEffect(() => {
    const nextPhase = phase()
    presentationReady()
    if (
      !['idle', 'paused', 'recovering', 'error', 'finished'].includes(nextPhase)
    )
      return
    queueMicrotask(() => {
      if (dialogElement !== undefined) focusDialog(dialogElement)
    })
  })

  onMount(() => {
    const disposeScene = props.mountScene(sceneContainer)
    const handleKeyDown = (event: KeyboardEvent) => input.key(event, true)
    const handleKeyUp = (event: KeyboardEvent) => input.key(event, false)
    const handleBlur = () => input.clear()
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    onCleanup(() => {
      input.clear()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      disposeScene()
    })
  })

  const hearReference = (): void => {
    void props.session.hearReference()
  }
  const pauseForSetup = (): void => props.session.pause('manual')
  const openSound = (returnTarget?: HTMLButtonElement): void => {
    soundReturnTarget = returnTarget
    input.clear()
    if (
      ['preparing', 'readiness', 'count-in', 'running'].includes(state().phase)
    )
      props.session.pause('manual')
    setSoundRequest((request) => request + 1)
  }
  const SoundEntry = () => (
    <button
      type="button"
      class={styles.secondaryButton}
      onClick={(event) => openSound(event.currentTarget)}
    >
      Sound / tune
    </button>
  )
  const focusNoteSetup = (): void => {
    props.session.pause('manual')
    queueMicrotask(() =>
      queueMicrotask(() => {
        runnerElement
          .querySelector<HTMLInputElement>(
            'input[aria-label="Comfortable note"]',
          )
          ?.focus({ preventScroll: true })
      }),
    )
  }

  return (
    <main
      ref={runnerElement}
      class={styles.runner}
      data-testid="song-runner"
      data-phase={state().phase}
      data-microphone={state().microphone}
      data-course-seconds={game().courseSeconds.toFixed(3)}
      data-course-beat={game().courseBeat.toFixed(3)}
      data-course-status={game().status}
      data-resolved-targets={game().resolvedTargets.length}
      data-hit-targets={
        game().resolvedTargets.filter((target) => target.outcome === 'hit')
          .length
      }
      data-run-stars={runStars()}
      data-recovery-reason={lastRecoveryReason()}
      data-voice-phase={voiceCue()?.stage ?? ''}
      data-movement-cue={movementHint()?.stage ?? ''}
      data-target-lane={game().player.targetLane}
      data-movement-mode={game().movementMode}
      data-lateral-x={game().player.lateralX.toFixed(3)}
      data-player-x={game().player.lateralX.toFixed(3)}
      data-lateral-velocity={game().player.lateralVelocityMetersPerSecond.toFixed(
        3,
      )}
      data-camera-profile={
        props.cameraControls?.profile ?? props.course.presentation.cameraProfile
      }
      data-player-feet-y={game().player.feetY.toFixed(3)}
      data-player-grounded={String(game().player.grounded)}
    >
      <div
        ref={sceneContainer}
        class={styles.scene}
        aria-hidden="true"
        data-testid="song-runner-scene"
      />

      <header class={styles.topbar}>
        <button
          type="button"
          class={styles.iconButton}
          aria-label="Leave course"
          onClick={() => props.onExit()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 8 12l7 7M9 12h11" />
          </svg>
        </button>
        <div class={styles.courseMeta}>
          <strong>{props.course.title}</strong>
          <span>{progress()}% complete</span>
        </div>
        <div class={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${progress()}%` }} />
        </div>
        <Show when={game().combo > 1}>
          <span class={styles.combo}>{game().combo} in a row</span>
        </Show>
        <RunnerSoundTune
          developmentControls={props.developmentControls}
          cameraControls={props.cameraControls}
          openRequest={soundRequest()}
          canChangeNote={state().phase !== 'finished'}
          restoreFocus={() => {
            if (soundReturnTarget?.isConnected === true) {
              soundReturnTarget.focus({ preventScroll: true })
              return true
            }
            if (dialogElement?.isConnected === true) {
              focusDialog(dialogElement)
              return true
            }
            return false
          }}
          preferences={state().audioPreferences}
          backing={state().backing}
          comfortableMidi={props.comfortableMidi}
          onPreferencesChange={(patch) =>
            props.session.setAudioPreferences(patch)
          }
          onOpen={() => openSound()}
          onSetup={focusNoteSetup}
        />
        <Show
          when={['readiness', 'count-in', 'running'].includes(state().phase)}
        >
          <button
            type="button"
            class={styles.iconButton}
            aria-label="Pause course"
            onClick={() => props.session.pause('manual')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 6v12m8-12v12" />
            </svg>
          </button>
        </Show>
      </header>

      <Show when={showNotation()}>
        <div
          classList={{ [styles.readinessPanel]: phase() === 'readiness' }}
          role={phase() === 'readiness' ? 'region' : undefined}
          aria-label={phase() === 'readiness' ? 'Start note' : undefined}
        >
          <RunnerNotation
            embedded={phase() === 'readiness'}
            notes={notationNotes()}
            activeNoteIndex={activeTarget()?.noteIndex ?? 0}
            phaseLabel={notationPhaseLabel()}
            instruction={notationInstruction()}
            target={pitchTarget()}
            showPitchReadout={showPitchReadout()}
            microphoneStatus={runnerMicrophoneStatus(state().microphone)}
            scoreStatus={notationScoreStatus()}
            meterName={phase() === 'readiness' ? 'Ready note' : undefined}
            upcomingCue={upcomingCue()}
          />
          <Show when={phase() === 'readiness'}>
            <p>Hold until the note fills.</p>
            <p
              class={styles.readinessInput}
              data-testid="runner-readiness-input"
              data-receiving={String(
                state().readiness?.receivingInput ?? false,
              )}
            >
              {state().readiness?.receivingInput === true
                ? 'Microphone responding'
                : 'Waiting for microphone input'}
            </p>
            <div class={styles.inlineActions}>
              <button
                type="button"
                class={styles.secondaryButton}
                onClick={pauseForSetup}
              >
                Change note
              </button>
              <Show when={props.microphoneInput !== undefined}>
                <button
                  type="button"
                  class={styles.secondaryButton}
                  onClick={pauseForSetup}
                >
                  Change microphone
                </button>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={movementHint()}>
        {(hint) => (
          <section
            class={styles.movementHint}
            role="status"
            aria-live="polite"
            data-testid="runner-movement-hint"
            data-obstacle-id={hint().obstacleId}
            data-cue-stage={hint().stage}
          >
            <span>{movementCopy()!.instruction}</span>
            <strong>{movementCopy()!.label}</strong>
            <Show when={upcomingCue()}>
              {(cue) => <RunnerUpcomingCue cue={cue()} />}
            </Show>
          </section>
        )}
      </Show>

      <Show when={movementHint() === null ? recentResult() : null}>
        {(result) => (
          <section
            class={styles.releaseHint}
            classList={{ [styles.missHint]: result().outcome === 'miss' }}
            data-testid={
              result().outcome === 'hit'
                ? 'runner-release-hint'
                : 'runner-miss-hint'
            }
            data-target-id={result().id}
            data-target-outcome={result().outcome}
          >
            <span>{result().label}</span>
            <strong>{result().instruction}</strong>
            <Show when={upcomingCue()}>
              {(cue) => <RunnerUpcomingCue cue={cue()} />}
            </Show>
          </section>
        )}
      </Show>

      <Show
        when={
          !showNotation() && movementHint() === null && recentResult() === null
            ? upcomingCue()
            : null
        }
      >
        {(cue) => (
          <section class={styles.movementHint}>
            <RunnerUpcomingCue cue={cue()} />
          </section>
        )}
      </Show>

      <Show when={state().phase === 'running'}>
        <RunnerControls
          input={input}
          steering={steering}
          disabled={state().phase !== 'running'}
        />
      </Show>

      <Show when={state().phase === 'preparing'}>
        <section class={styles.statusPanel} role="status" aria-live="polite">
          <span class={styles.spinner} aria-hidden="true" />
          <h1>
            {state().microphone === 'opening'
              ? 'Preparing sound and microphone'
              : 'Playing your note'}
          </h1>
          <p>
            {state().microphone === 'opening'
              ? 'The course starts after your note is ready.'
              : 'Match this note when you start.'}
          </p>
        </section>
      </Show>

      <Show when={state().phase === 'count-in'}>
        <section class={styles.countIn} aria-label="Count-in">
          <span>
            {Math.max(1, Math.ceil(state().countIn?.beatsRemaining ?? 1))}
          </span>
          <p>Get ready</p>
        </section>
      </Show>

      <Show when={state().phase === 'recovering'}>
        <section
          ref={(element) => (dialogElement = element)}
          class={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="runner-recovery-title"
          onKeyDown={trapDialogKeys}
        >
          <p class={styles.eyebrow}>{recovery().eyebrow}</p>
          <h1 id="runner-recovery-title">{recovery().title}</h1>
          <p>{recovery().detail}</p>
          <div class={styles.primaryActions}>
            <SoundEntry />
            <button
              type="button"
              class={styles.primaryButton}
              data-dialog-initial-focus
              disabled={!presentationReady()}
              onClick={() => void props.session.resume()}
            >
              Resume from checkpoint
            </button>
            <button
              type="button"
              class={styles.textButton}
              onClick={() => props.onExit()}
            >
              Leave course
            </button>
          </div>
        </section>
      </Show>

      <Show when={state().phase === 'idle'}>
        <section
          ref={(element) => (dialogElement = element)}
          class={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="runner-start-title"
          onKeyDown={trapDialogKeys}
        >
          <p class={styles.eyebrow}>Song runner</p>
          <h1 id="runner-start-title">Ready when you are</h1>
          <p>
            Set a comfortable note, then sing and steer through the glassway.
            Pitch is checked live. No recording is saved.
          </p>
          <Show when={props.presentationLoading === true}>
            <div class={styles.presentationStatus} role="status">
              <span class={styles.spinner} aria-hidden="true" />
              <span>Preparing the course view</span>
            </div>
          </Show>
          <Show when={props.presentationError}>
            {(message) => (
              <div class={styles.presentationError} role="alert">
                <p>{message()}</p>
                <Show when={props.onRetryPresentation !== undefined}>
                  <button
                    type="button"
                    class={styles.secondaryButton}
                    onClick={props.onRetryPresentation}
                  >
                    Retry course view
                  </button>
                </Show>
              </div>
            )}
          </Show>
          <div class={styles.primaryActions}>
            <SoundEntry />
            <button
              type="button"
              class={styles.primaryButton}
              data-dialog-initial-focus
              disabled={!presentationReady()}
              onClick={() => void props.session.start()}
            >
              Start course
            </button>
            <button
              type="button"
              class={styles.textButton}
              onClick={() => props.onExit()}
            >
              Leave course
            </button>
          </div>
          <Show when={closedSetup()}>
            <RunnerSetup
              microphoneInput={props.microphoneInput}
              comfortableMidi={props.comfortableMidi}
              minimumMidi={props.comfortableMidiRange.minimumMidi}
              maximumMidi={props.comfortableMidiRange.maximumMidi}
              referencePlayback={state().referencePlayback}
              onComfortableMidiChange={props.onComfortableMidiChange}
              onHearReference={hearReference}
            />
          </Show>
        </section>
      </Show>

      <Show when={state().phase === 'paused'}>
        <section
          ref={(element) => (dialogElement = element)}
          class={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="runner-paused-title"
          onKeyDown={trapDialogKeys}
        >
          <p class={styles.eyebrow}>Checkpoint saved</p>
          <h1 id="runner-paused-title">Course paused</h1>
          <p>{runnerPauseMessage(state().pauseReason)}</p>
          <Show when={props.presentationLoading === true}>
            <div class={styles.presentationStatus} role="status">
              <span class={styles.spinner} aria-hidden="true" />
              <span>Restoring the course view</span>
            </div>
          </Show>
          <Show when={props.presentationError}>
            {(message) => (
              <div class={styles.presentationError} role="alert">
                <p>{message()}</p>
                <Show when={props.onRetryPresentation !== undefined}>
                  <button
                    type="button"
                    class={styles.secondaryButton}
                    onClick={props.onRetryPresentation}
                  >
                    Retry course view
                  </button>
                </Show>
              </div>
            )}
          </Show>
          <div class={styles.primaryActions}>
            <SoundEntry />
            <button
              type="button"
              class={styles.primaryButton}
              data-dialog-initial-focus
              disabled={!presentationReady()}
              onClick={() => void props.session.resume()}
            >
              Resume
            </button>
            <button
              type="button"
              class={styles.secondaryButton}
              onClick={() => void props.session.restart()}
            >
              Restart
            </button>
            <button
              type="button"
              class={styles.textButton}
              onClick={() => props.onExit()}
            >
              Leave course
            </button>
          </div>
          <Show when={closedSetup()}>
            <RunnerSetup
              microphoneInput={props.microphoneInput}
              microphoneIssue={
                state().pauseReason === 'microphone-interrupted'
                  ? state().error?.microphoneIssue
                  : undefined
              }
              comfortableMidi={props.comfortableMidi}
              minimumMidi={props.comfortableMidiRange.minimumMidi}
              maximumMidi={props.comfortableMidiRange.maximumMidi}
              referencePlayback={state().referencePlayback}
              onComfortableMidiChange={props.onComfortableMidiChange}
              onHearReference={hearReference}
            />
          </Show>
        </section>
      </Show>

      <Show when={state().phase === 'error'}>
        <section
          ref={(element) => (dialogElement = element)}
          class={styles.dialog}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="runner-error-title"
          onKeyDown={trapDialogKeys}
        >
          <p class={styles.eyebrow}>Run paused</p>
          <h1 id="runner-error-title">Check your setup</h1>
          <p>{state().error?.message ?? 'The course could not start.'}</p>
          <div class={styles.primaryActions}>
            <SoundEntry />
            <Show
              when={
                state().error?.microphoneIssue?.action === 'take-over' &&
                props.session.takeOverMicrophone !== undefined
              }
            >
              <button
                type="button"
                class={styles.primaryButton}
                data-dialog-initial-focus
                onClick={() => void props.session.takeOverMicrophone?.()}
              >
                Use microphone here
              </button>
            </Show>
            <Show when={state().error?.canRetry === true}>
              <button
                type="button"
                class={styles.primaryButton}
                data-dialog-initial-focus
                onClick={() => void props.session.start()}
              >
                Try again
              </button>
            </Show>
            <button
              type="button"
              class={styles.textButton}
              onClick={() => props.onExit()}
            >
              Leave course
            </button>
          </div>
          <Show when={closedSetup()}>
            <RunnerSetup
              microphoneInput={props.microphoneInput}
              microphoneIssue={state().error?.microphoneIssue}
              comfortableMidi={props.comfortableMidi}
              minimumMidi={props.comfortableMidiRange.minimumMidi}
              maximumMidi={props.comfortableMidiRange.maximumMidi}
              referencePlayback={state().referencePlayback}
              onComfortableMidiChange={props.onComfortableMidiChange}
              onHearReference={hearReference}
            />
          </Show>
        </section>
      </Show>

      <Show when={state().phase === 'finished'}>
        <section
          ref={(element) => (dialogElement = element)}
          class={`${styles.dialog} ${styles.finishDialog}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="runner-finished-title"
          onKeyDown={trapDialogKeys}
        >
          <p class={styles.eyebrow}>Course complete</p>
          <h1 id="runner-finished-title">The current carried you through</h1>
          <RunnerFinishRewards
            course={props.course}
            collectedRewardIds={game().collectedRewardIds}
            runStars={runStars()}
            bestStars={bestStars()}
            maximumStars={maximumStars()}
            assetUrl={props.assetUrl}
          />
          <div class={styles.primaryActions}>
            <SoundEntry />
            <button
              type="button"
              class={styles.primaryButton}
              data-dialog-initial-focus
              onClick={() => void props.session.restart()}
            >
              Run again
            </button>
            <button
              type="button"
              class={styles.secondaryButton}
              onClick={() => props.onExit()}
            >
              Return to Glassworks
            </button>
          </div>
        </section>
      </Show>

      <p class={styles.announcer} aria-live="polite" aria-atomic="true">
        {announcement()}
      </p>
    </main>
  )
}
