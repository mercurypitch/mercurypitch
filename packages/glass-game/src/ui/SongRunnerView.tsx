// ============================================================
// Song runner view — Solid HUD, notation, setup, and edge-filtered controls.
// ============================================================

import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import type { GlassMicrophoneInput } from '../host'
import type { CompiledRunnerCourse, RunnerEvent } from '../runner/contracts'
import type { RunnerNotationNote } from '../runner/notation'
import { runnerMidiName, runnerNotationNotes } from '../runner/notation'
import type { RunnerSessionFrame, RunnerSessionPhase, SongRunnerSession, } from '../runner/session-contracts'
import { focusDialog, trapDialogKeys } from './dialog-focus'
import type { MicrophoneIssue } from './mic-error'
import { MicrophoneInputRecovery } from './MicrophoneInputRecovery'
import { createRunnerInputEdges } from './runner-input'
import { RunnerControls } from './RunnerControls'
import { RunnerFinishRewards } from './RunnerFinishRewards'
import { RunnerNotation } from './RunnerNotation'
import styles from './SongRunnerView.module.css'

interface SongRunnerViewProps {
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

interface RunnerSetupProps {
  microphoneInput?: GlassMicrophoneInput
  microphoneIssue?: MicrophoneIssue
  comfortableMidi: number
  minimumMidi: number
  maximumMidi: number
  onComfortableMidiChange(midi: number): void
  onHearReference(): void
}

function RunnerSetup(props: RunnerSetupProps) {
  const [draftMidi, setDraftMidi] = createSignal(
    untrack(() => props.comfortableMidi),
  )
  createEffect(() => setDraftMidi(props.comfortableMidi))
  const label = createMemo(() => runnerMidiName(draftMidi()).text)

  return (
    <div class={styles.setup}>
      <div class={styles.noteChoice}>
        <div class={styles.setupLabel}>
          <span>Comfortable note</span>
          <strong>{label()}</strong>
        </div>
        <input
          class={styles.noteRange}
          type="range"
          min={props.minimumMidi}
          max={props.maximumMidi}
          step="1"
          value={draftMidi()}
          aria-label="Comfortable note"
          aria-valuetext={label()}
          onInput={(event) => setDraftMidi(Number(event.currentTarget.value))}
          onChange={(event) => {
            const midi = Number(event.currentTarget.value)
            setDraftMidi(midi)
            props.onComfortableMidiChange(midi)
          }}
        />
        <div class={styles.rangeLabels} aria-hidden="true">
          <span>{runnerMidiName(props.minimumMidi).text}</span>
          <span>{runnerMidiName(props.maximumMidi).text}</span>
        </div>
        <button
          type="button"
          class={styles.secondaryButton}
          onClick={() => props.onHearReference()}
        >
          Hear note
        </button>
      </div>
      <Show when={props.microphoneInput !== undefined}>
        <MicrophoneInputRecovery
          microphoneInput={props.microphoneInput}
          issue={props.microphoneIssue}
        />
      </Show>
    </div>
  )
}

function phaseAnnouncement(phase: RunnerSessionPhase): string | null {
  switch (phase) {
    case 'readiness':
      return 'Hold the note shown to begin.'
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

function eventAnnouncement(event: RunnerEvent): string {
  switch (event.type) {
    case 'target-hit':
      return `Phrase complete: ${event.result.grade} ${event.result.grade === 1 ? 'star' : 'stars'}.`
    case 'target-miss':
      return 'That glass passed. Keep moving.'
    case 'reward-collected':
      return 'Discovery collected.'
    case 'recovery-required':
      return 'Returning to the last checkpoint.'
    case 'course-finished':
      return 'Course complete.'
  }
}

function pauseMessage(
  reason: ReturnType<SongRunnerSession['state']>['pauseReason'],
) {
  switch (reason) {
    case 'background':
      return 'The run paused when the app moved to the background.'
    case 'audio-interrupted':
      return 'Audio was interrupted. Resume when your sound is ready.'
    case 'microphone-interrupted':
      return 'The microphone stopped. Check your input before resuming.'
    case 'renderer-unavailable':
      return 'The scene paused while the display recovers.'
    default:
      return 'Resume from your last checkpoint when you are ready.'
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
  let sceneContainer!: HTMLDivElement
  let dialogElement: HTMLElement | undefined

  const state = createMemo(() => frame().state)
  const game = createMemo(() => state().game)
  const input = createRunnerInputEdges((action) => props.session.input(action))
  const progress = createMemo(() =>
    clampedPercent(game().courseBeat / props.course.lengthBeats),
  )
  const activeTarget = createMemo(() => game().activeTarget)
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
      return runnerNotationNotes(compiled.notes, target.notes)
    const readiness = state().readiness
    return [
      setupNote(
        readiness?.targetMidi ?? props.comfortableMidi,
        readiness?.fillProgress ?? 0,
      ),
    ]
  })
  const notationInstruction = createMemo(() => {
    const current = activeTarget()
    if (current !== null) {
      const note = current.notes.find(
        (candidate) => candidate.index === current.noteIndex,
      )
      if (note !== undefined)
        return `Sing ${runnerMidiName(note.targetMidi).text}`
    }
    if (state().phase === 'readiness')
      return `Hold ${runnerMidiName(state().readiness?.targetMidi ?? props.comfortableMidi).text}`
    return 'Your note'
  })
  const showNotation = createMemo(
    () =>
      ['readiness', 'count-in'].includes(state().phase) ||
      (state().phase === 'running' && activeTarget() !== null),
  )
  const movementHint = createMemo(() => {
    if (state().phase !== 'running' || activeTarget() !== null) return null
    const current = game()
    for (const obstacle of props.course.obstacles) {
      const action = obstacle.certifiedActions[0]
      if (
        action === undefined ||
        current.courseSeconds < obstacle.telegraphFromCourseSeconds ||
        current.courseSeconds > action.launchCloseCourseSeconds
      )
        continue
      if (
        action.kind === 'lane-transition' &&
        action.reachableLanes.includes(current.player.targetLane)
      )
        continue
      if (action.kind === 'jump' && !current.player.grounded) continue
      return {
        obstacleId: obstacle.id,
        text: action.kind === 'jump' ? 'Jump the gap' : 'Change lane',
      }
    }
    return null
  })
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
  const recoveryReason = createMemo(() => {
    const events = frame().events
    for (let index = events.length - 1; index >= 0; index--) {
      const event = events[index]!
      if (event.type === 'recovery-required') return event.reason
    }
    return ''
  })
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
    setFrame({ state: session.state(), events: [] })
    const unsubscribe = session.subscribe((nextFrame) => {
      setFrame(nextFrame)
      const newestEvent = nextFrame.events.at(-1)
      if (newestEvent !== undefined)
        setAnnouncement(eventAnnouncement(newestEvent))
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
    const phase = state().phase
    presentationReady()
    if (!['idle', 'paused', 'recovering', 'error', 'finished'].includes(phase))
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

  return (
    <main
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
      data-recovery-reason={recoveryReason()}
      data-target-lane={game().player.targetLane}
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
        <button
          type="button"
          class={styles.iconButton}
          aria-label={state().musicMuted ? 'Turn music on' : 'Mute music'}
          aria-pressed={state().musicMuted}
          onClick={() => props.session.setMusicMuted(!state().musicMuted)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 10v4h4l5 4V6l-5 4H5m12-1c1.3 1.7 1.3 4.3 0 6m2.5-8.5c2.7 3.1 2.7 7.9 0 11" />
          </svg>
        </button>
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
        <RunnerNotation
          notes={notationNotes()}
          activeNoteIndex={activeTarget()?.noteIndex ?? 0}
          instruction={notationInstruction()}
          target={activeTarget()}
        />
      </Show>

      <Show when={movementHint()} keyed>
        {(hint) => (
          <section
            class={styles.movementHint}
            role="status"
            aria-live="polite"
            data-testid="runner-movement-hint"
            data-obstacle-id={hint.obstacleId}
          >
            <span>Path ahead</span>
            <strong>{hint.text}</strong>
          </section>
        )}
      </Show>

      <Show when={state().phase === 'running'}>
        <RunnerControls input={input} disabled={state().phase !== 'running'} />
      </Show>

      <Show when={state().phase === 'preparing'}>
        <section class={styles.statusPanel} role="status" aria-live="polite">
          <span class={styles.spinner} aria-hidden="true" />
          <h1>Opening your microphone</h1>
          <p>The course starts after your note is ready.</p>
        </section>
      </Show>

      <Show when={state().phase === 'readiness'}>
        <section class={styles.readinessPanel}>
          <p>Hold the note until it fills.</p>
          <div
            class={styles.readinessTrack}
            role="progressbar"
            aria-label="Ready note"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={clampedPercent(state().readiness?.fillProgress ?? 0)}
          >
            <span
              style={{
                width: `${clampedPercent(state().readiness?.fillProgress ?? 0)}%`,
              }}
            />
          </div>
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
          <p class={styles.eyebrow}>Checkpoint ready</p>
          <h1 id="runner-recovery-title">Try that stretch again</h1>
          <p>Your settled notes and discoveries stay with you.</p>
          <div class={styles.primaryActions}>
            <button
              type="button"
              class={styles.primaryButton}
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
            <button
              type="button"
              class={styles.primaryButton}
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
          <p>{pauseMessage(state().pauseReason)}</p>
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
            <button
              type="button"
              class={styles.primaryButton}
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
            <Show
              when={
                state().error?.microphoneIssue?.action === 'take-over' &&
                props.session.takeOverMicrophone !== undefined
              }
            >
              <button
                type="button"
                class={styles.primaryButton}
                onClick={() => void props.session.takeOverMicrophone?.()}
              >
                Use microphone here
              </button>
            </Show>
            <Show when={state().error?.canRetry === true}>
              <button
                type="button"
                class={styles.primaryButton}
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
            <button
              type="button"
              class={styles.primaryButton}
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
