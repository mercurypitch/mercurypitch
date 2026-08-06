import type { Accessor, Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Loader2, MusicNote, Pause, Play, RotateCcw, Volume2, VolumeX, X, } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { PitchStageShell } from '@/components/pitch-stage/PitchStageShell'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { deleteZenTake, listZenTakes, saveZenTake, } from '@/db/services/zen-take-service'
import { playReferenceTone } from '@/features/mirror/tone-player'
import type { PracticeFrame, PracticeFrameListener, } from '@/features/practice/usePracticeController'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import { createPreviewPlayer } from '@/lib/preview-player'
import { midiToNote } from '@/lib/scale-data'
import { drawStemPeaks, getStemPeaks } from '@/lib/stem-peaks'
import { isNarrow } from '@/lib/use-viewport'
import { getZenExercise, zenExerciseCatalog } from './exercise-catalog'
import { refreshGuidedContent } from './guided-content-store'
import { createZenNoteScheduler } from './note-playback'
import type { ZenExerciseCategory, ZenExerciseDefinition, ZenPitchRun, ZenTargetVisibility, } from './types'
import { useZenPitchSession } from './useZenPitchSession'
import type { ZenCanvasRenderModel } from './zen-canvas-renderer'
import { resolveZenTargets } from './zen-model'
import { ZenPitchCanvas } from './ZenPitchCanvas'
import styles from './ZenPitchStage.module.css'

/**
 * THESIS: a quiet, full-screen pitch room where repetition feels legible.
 * OWN WORLD: the Stem Pitch Studio’s ink-black grid, amber references and
 * violet voice trace, with editing chrome removed.
 * STORY: orient in the header, sing across the canvas, review the completed
 * pass, then begin again at the left seam.
 * FIRST VIEWPORT: identity, complete two-octave canvas, persistent desktop
 * guide and the essential loop controls are all visible without scrolling.
 * FORM: instrument workspace, not a dashboard; depth comes from restrained
 * glass rails and luminous pitch layers.
 *
 * The transport state machine, guide-note playback and take selection are
 * specified in `docs/specs/zen-exercise-playback.ears.md` — read it before
 * changing what a control does in a given state.
 */

interface ZenPitchStageProps {
  initialExerciseId?: string
  initialExerciseVersion?: number
  initialExerciseDefinition?: ZenExerciseDefinition
  subscribeFrames: (listener: PracticeFrameListener) => () => void
  micActive: Accessor<boolean>
  startMic: () => Promise<boolean>
  stopMic: () => void
  initialCenterMidi?: number
  onClose: () => void
}

const CATEGORY_LABELS: Record<ZenExerciseCategory, string> = {
  range: 'Range',
  agility: 'Agility',
  scales: 'Scales',
  tone: 'Tone',
  articulation: 'Articulation',
}

const CATEGORIES = Object.keys(CATEGORY_LABELS) as ZenExerciseCategory[]
const LOOP_OPTIONS = [5, 8, 10, 15, 30] as const

const runLabel = (run: ZenPitchRun | null, liveTake: number): string =>
  run === null ? `Live take ${liveTake}` : `Take ${run.takeNumber}`

type ExamplePlaybackState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error'

const audioClock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The stem-results waveform/fill treatment, sized for the short example
 *  pill. Decoding the guide's immutable URL also warms the browser cache
 *  before the singer presses play. */
const ExampleWaveformProgress: Component<{
  url: string
  color: string
  progress: number
}> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined

  createEffect(() => {
    const url = props.url
    const color = props.color
    const canvas = canvasRef
    if (canvas === undefined) return
    let alive = true
    let peaks: Float32Array | null = null
    const redraw = () => {
      if (alive && peaks !== null && canvas.clientWidth > 0) {
        drawStemPeaks(canvas, peaks, color)
      }
    }
    const observer = new ResizeObserver(redraw)
    observer.observe(canvas)
    getStemPeaks(url)
      .then((nextPeaks) => {
        peaks = nextPeaks
        redraw()
      })
      .catch(() => {
        // The example remains playable if waveform decoding is unsupported.
      })
    onCleanup(() => {
      alive = false
      observer.disconnect()
    })
  })

  return (
    <div class={styles.exampleWaveLayer} aria-hidden="true">
      <div
        class={styles.exampleWaveProgress}
        style={{
          width: `${Math.min(100, Math.max(0, props.progress * 100))}%`,
          background: props.color,
        }}
      />
      <canvas ref={canvasRef} class={styles.exampleWaveCanvas} />
    </div>
  )
}

export const ZenPitchStage: Component<ZenPitchStageProps> = (props) => {
  const [guideOpen, setGuideOpen] = createSignal(
    props.initialExerciseId !== undefined ||
      props.initialExerciseDefinition !== undefined,
  )
  const [exampleState, setExampleState] =
    createSignal<ExamplePlaybackState>('idle')
  const [exampleProgress, setExampleProgress] = createSignal(0)
  const [exampleElapsedSec, setExampleElapsedSec] = createSignal(0)
  const [exampleDurationSec, setExampleDurationSec] = createSignal(0)
  const [startError, setStartError] = createSignal<string | null>(null)
  let examplePreloader: HTMLAudioElement | undefined
  let resumeAfterExample = false
  let exampleRaf = 0
  let examplePlayRequest = 0
  let preparedExampleUrl: string | null = null
  let loadRequest = 0
  let guideOpenPlain =
    props.initialExerciseId !== undefined ||
    props.initialExerciseDefinition !== undefined

  const session = useZenPitchSession({
    initialExerciseId: props.initialExerciseId,
    initialExerciseVersion: props.initialExerciseVersion,
    initialExerciseDefinition: props.initialExerciseDefinition,
    initialCenterMidi: props.initialCenterMidi,
    subscribeFrames: (listener: (frame: PracticeFrame) => void) =>
      props.subscribeFrames(listener),
    micActive: () => props.micActive(),
    startMic: () => props.startMic(),
    stopMic: () => props.stopMic(),
    onRunFinalized: (run) => {
      const { id: sessionRunId, ...draft } = run
      void saveZenTake({
        ...draft,
        exerciseVersion: run.exerciseVersion,
      }).then((saved) => {
        // Session run ids and persisted row ids differ; remember the pair so
        // deleting a take from the strip can also delete its stored row.
        if (saved !== null) persistedIdByRunId.set(sessionRunId, saved.id)
      })
    },
  })

  const persistedIdByRunId = new Map<string, string>()

  const cancelExampleClock = (): void => {
    cancelAnimationFrame(exampleRaf)
    exampleRaf = 0
  }

  const resumePractice = (): void => {
    const shouldResume = resumeAfterExample
    resumeAfterExample = false
    if (shouldResume && session.status() === 'paused') session.resume()
  }

  function onExampleEnded(): void {
    ++examplePlayRequest
    cancelExampleClock()
    setExampleElapsedSec(exampleDurationSec())
    setExampleProgress(1)
    setExampleState('ended')
    resumePractice()
  }

  const examplePlayer = createPreviewPlayer({
    onEnded: onExampleEnded,
    // A short spoken cue should answer the tap quickly while retaining
    // a short pop-free envelope.
    attackMs: 45,
    releaseMs: 100,
    errorMessage:
      "Couldn't play this exercise example. Check your connection and try again.",
  })

  const deleteSelectedRun = (): void => {
    const run = session.selectedRun()
    if (run === null) return
    // Hydrated runs carry their stored id directly; fresh runs go through
    // the map filled when their save resolved.
    const storedId = persistedIdByRunId.get(run.id) ?? run.id
    session.removeRun(run.id)
    persistedIdByRunId.delete(run.id)
    void deleteZenTake(storedId)
  }

  // ── Target note playback ────────────────────────────────────
  // The guide notes can SOUND, like the singing practice page - but only
  // when they are fully shown: hidden or dimmed targets are a deliberate
  // "from memory" mode, and sounding them would defeat it. The mute button
  // is the manual override on top; visibility drives the hard gate.
  //
  // Which targets sound at a given sample lives in `note-playback.ts` — it is
  // pure timing and nothing about it needs an audio device, which is the only
  // way any of it can be tested. This end owns the gate and the tone.
  const [notesMuted, setNotesMuted] = createSignal(false)
  let toneCtx: AudioContext | null = null
  const noteScheduler = createZenNoteScheduler()
  const notePlaybackActive = (): boolean =>
    !notesMuted() &&
    session.targetVisibility() === 'on' &&
    session.exercise() !== null

  createEffect(() => {
    // A different exercise, or any transport edge, is a discontinuity: the
    // next sample must start from the playhead rather than back-fill
    // everything the old position had already passed.
    session.exerciseId()
    session.status()
    noteScheduler.rearm()
  })

  createEffect(() => {
    // Unmuting must be audible NOW, not at the next target: sound whatever
    // window the playhead is already inside. Passed windows stay silent —
    // firing those would replay the lap so far in one burst. Muting mid-note
    // lets the current tone's short tail (<=1.2s) ring out; cutting it pops.
    if (!notesMuted()) noteScheduler.rearm({ soundCurrent: true })
  })

  createEffect(() => {
    if (!notePlaybackActive()) return
    if (session.status() !== 'running') return
    // The lap index comes from the session's own counter. Deriving it from
    // elapsed time cannot work — elapsed is reset at every seam, so the
    // derived index was permanently 0 and every lap after the first found
    // its targets already marked as played (owner testing: "plays the notes
    // only on first pass").
    const cues = noteScheduler.sample({
      elapsedSec: session.elapsedSec(),
      loopIndex: session.loopsCompleted(),
      targets: session.targets(),
    })
    if (cues.length === 0) return
    toneCtx ??= new AudioContext()
    // A context created outside a click can start suspended
    // (autoplay policy) — resume before scheduling or nothing sounds.
    if (toneCtx.state === 'suspended') void toneCtx.resume()
    for (const cue of cues) {
      void playReferenceTone(toneCtx, cue.target.startMidi, cue.durationSec)
    }
  })

  onCleanup(() => {
    void toneCtx?.close().catch(() => undefined)
    toneCtx = null
  })

  const title = (): string => session.exercise()?.title ?? 'Open Pitch Monitor'

  const eyebrow = (): string => {
    const exercise = session.exercise()
    return exercise === null
      ? 'Zen practice'
      : `Guided ${CATEGORY_LABELS[exercise.category]}`
  }

  const latestRun = (): ZenPitchRun | null => {
    const history = session.runs()
    return history.length === 0 ? null : history[history.length - 1]!
  }

  const scoredRun = (): ZenPitchRun | null =>
    session.selectedRun() ?? latestRun()

  const currentRunIndex = (): number => {
    const id = session.selectedRunId()
    return id === null ? -1 : session.runs().findIndex((run) => run.id === id)
  }

  // Reviewing a take while the session captures is what broke the stage:
  // the canvas froze on the selected take, the playhead vanished, and every
  // seam behind it appended a take the singer never saw. Pause or stop first.
  const canChangeTake = (): boolean => session.status() !== 'running'

  const takeLockReason = (): string | undefined =>
    canChangeTake() ? undefined : 'Pause to review your takes'

  const canGoBack = (): boolean =>
    !canChangeTake()
      ? false
      : session.selectedRunId() === null
        ? session.runs().length > 0
        : currentRunIndex() > 0

  const canGoForward = (): boolean =>
    canChangeTake() && session.selectedRunId() !== null

  const canvasModel = createMemo<ZenCanvasRenderModel>(() => {
    const selected = session.selectedRun()
    const exercise = session.exercise()
    const history = session.runs()
    const previous =
      selected !== null
        ? session.activePoints()
        : history.length === 0
          ? undefined
          : history[history.length - 1]!.points
    return {
      durationSec: selected?.durationSec ?? session.loopDurationSec(),
      elapsedSec: selected?.durationSec ?? session.elapsedSec(),
      viewport: selected?.viewport ?? session.viewport(),
      targets:
        selected?.rootMidi !== undefined && exercise !== null
          ? resolveZenTargets(exercise, selected.rootMidi)
          : session.targets(),
      targetVisibility: session.targetVisibility(),
      showPlayhead:
        selected === null &&
        session.exercise() !== null &&
        session.progressCue() === 'playhead',
      points: selected?.points ?? session.activePoints(),
      previousPoints: previous,
    }
  })

  const canvasSummary = createMemo(() => {
    const model = canvasModel()
    const voiced = [...model.points]
      .reverse()
      .find((point) => point.midi !== null)
    if (voiced?.midi === null || voiced === undefined) {
      return `${runLabel(session.selectedRun(), session.takeNumber())}; waiting for your voice.`
    }
    const note = midiToNote(Math.round(voiced.midi))
    return `${runLabel(session.selectedRun(), session.takeNumber())}; current pitch ${note.name}${note.octave}.`
  })

  const loadHistory = async (exerciseId: string | null): Promise<void> => {
    const request = ++loadRequest
    const exerciseVersion =
      exerciseId === session.exerciseId()
        ? session.exercise()?.version
        : getZenExercise(exerciseId)?.version
    const history = await listZenTakes({
      mode: exerciseId === null ? 'monitor' : 'exercise',
      ...(exerciseId === null
        ? {}
        : {
            exerciseId,
            ...(exerciseVersion === undefined ? {} : { exerciseVersion }),
          }),
      limit: 10,
    })
    if (request !== loadRequest) return
    session.hydrateRuns(history)
  }

  const stopExample = (resumeSession = false): void => {
    ++examplePlayRequest
    cancelExampleClock()
    examplePlayer.stop()
    setExampleState('idle')
    setExampleProgress(0)
    setExampleElapsedSec(0)
    if (resumeSession) resumePractice()
    else resumeAfterExample = false
  }

  const tickExample = (): void => {
    const duration = examplePlayer.duration || exampleDurationSec()
    const elapsed = examplePlayer.currentTime
    if (duration > 0) {
      setExampleDurationSec(duration)
      setExampleElapsedSec(elapsed)
      setExampleProgress(Math.min(1, Math.max(0, elapsed / duration)))
    }
    if (examplePlayer.playing) {
      exampleRaf = requestAnimationFrame(tickExample)
    }
  }

  const toggleExample = async (): Promise<void> => {
    const example = session.exercise()?.exampleAudio
    if (example === undefined) return

    if (exampleState() === 'loading') {
      stopExample(true)
      return
    }
    if (exampleState() === 'playing') {
      ++examplePlayRequest
      examplePlayer.pause()
      cancelExampleClock()
      setExampleElapsedSec(examplePlayer.currentTime)
      setExampleState('paused')
      return
    }

    const resuming = exampleState() === 'paused'
    if (!resuming) {
      const wasRunning = session.status() === 'running'
      resumeAfterExample = wasRunning
      if (wasRunning) session.pause()
      if (exampleState() === 'ended') {
        examplePlayer.seekToFraction(0)
        setExampleElapsedSec(0)
        setExampleProgress(0)
      }
    }

    const request = ++examplePlayRequest
    setExampleState('loading')
    const played = await examplePlayer.play(example.src)
    if (request !== examplePlayRequest) return
    if (!played) {
      setExampleState('error')
      resumePractice()
      return
    }
    setExampleState('playing')
    cancelExampleClock()
    tickExample()
  }

  // The welcome guide is the lazy-load boundary. Preparing its tiny example
  // clip while the singer reads the instructions removes the measured
  // 0.4-1.0 second media-route wait from the eventual play tap. The shared
  // waveform decoder uses the same immutable URL and browser cache.
  createEffect(() => {
    const example = session.exercise()?.exampleAudio
    const url = example?.src ?? null
    if (url === null) {
      if (preparedExampleUrl !== null) stopExample()
      preparedExampleUrl = null
      setExampleDurationSec(0)
      if (examplePreloader !== undefined) {
        examplePreloader.removeAttribute('src')
        examplePreloader.load()
      }
      return
    }
    if (isNarrow() && !guideOpen()) return
    if (url === preparedExampleUrl) return
    preparedExampleUrl = url
    stopExample()
    setExampleDurationSec((example?.durationMs ?? 0) / 1000)
    if (examplePreloader !== undefined) examplePreloader.src = url
  })

  const MIC_DENIED =
    'Microphone access is needed to draw your pitch. Check the browser permission and try again.'

  const begin = async (): Promise<void> => {
    setStartError(null)
    const started = await session.start()
    if (!started) {
      setStartError(MIC_DENIED)
      return
    }
    guideOpenPlain = false
    setGuideOpen(false)
  }

  /** Finalize the pass in progress, then open a fresh one from the seam. */
  const restart = async (): Promise<void> => {
    setStartError(null)
    stopExample()
    const started = await session.restart()
    if (!started) setStartError(MIC_DENIED)
  }

  const chooseExercise = (exerciseId: string | null): void => {
    stopExample()
    session.finish()
    session.selectExercise(exerciseId)
    const shouldOpenGuide = exerciseId !== null
    guideOpenPlain = shouldOpenGuide
    setGuideOpen(shouldOpenGuide)
    void loadHistory(exerciseId)
  }

  const cycleTargetVisibility = (): void => {
    const order: ZenTargetVisibility[] = ['on', 'dim', 'off']
    const current = session.targetVisibility()
    const next = order[(order.indexOf(current) + 1) % order.length]!
    session.setTargetVisibility(next)
  }

  const finishAndClose = (): void => {
    ++loadRequest
    stopExample()
    session.finish()
    props.onClose()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target

    // Space toggles the session like the transport button — the global
    // shortcut hook is suspended while the stage is open, so the stage
    // owns its own play/pause key. Text controls keep the key; a focused
    // button doesn't (preventDefault suppresses its native activation,
    // so the toggle fires exactly once).
    if (event.code === 'Space' && !event.repeat && !event.defaultPrevented) {
      if (
        target instanceof Element &&
        (target.closest('input,textarea,select,[contenteditable]') !== null ||
          target.closest('[role="dialog"]') !== null)
      ) {
        return
      }
      event.preventDefault()
      const current = session.status()
      if (current === 'running') session.pause()
      else if (current === 'paused') session.resume()
      else void begin()
      return
    }

    if (
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      (guideOpenPlain && isNarrow()) ||
      (target instanceof Element && target.closest('[role="dialog"]') !== null)
    ) {
      return
    }
    event.preventDefault()
    finishAndClose()
  }

  const GuideContent: Component = () => {
    const exercise = session.exercise
    return (
      <div class={styles.guide} data-testid="zen-guide">
        <div class={styles.guideHeading}>
          <div>
            <p>Practice setup</p>
            <h3>{exercise()?.title ?? 'Free voice canvas'}</h3>
          </div>
          <Show when={isNarrow()}>
            <button
              type="button"
              class={styles.iconButton}
              onClick={() => {
                stopExample(true)
                guideOpenPlain = false
                setGuideOpen(false)
              }}
              aria-label="Close practice guide"
            >
              <X />
            </button>
          </Show>
        </div>

        <label class={styles.fieldLabel} for="zen-exercise-select">
          Exercise
        </label>
        <SafeSelect
          id="zen-exercise-select"
          class={styles.select}
          value={session.exerciseId() ?? ''}
          onChange={(event) =>
            chooseExercise(event.currentTarget.value || null)
          }
        >
          <option value="">Open pitch monitor</option>
          <Show when={props.initialExerciseDefinition}>
            {(custom) => (
              <optgroup label="Challenge melody">
                <option value={custom().id}>{custom().title}</option>
              </optgroup>
            )}
          </Show>
          <For each={CATEGORIES}>
            {(category) => (
              <optgroup label={CATEGORY_LABELS[category]}>
                <For
                  each={zenExerciseCatalog().filter(
                    (candidate) => candidate.category === category,
                  )}
                >
                  {(candidate) => (
                    <option value={candidate.id}>{candidate.title}</option>
                  )}
                </For>
              </optgroup>
            )}
          </For>
        </SafeSelect>

        <Show
          when={exercise()}
          fallback={
            <div class={styles.freeGuide}>
              <p>
                Sing anything comfortable. Your pitch travels across the screen,
                becomes a take at the right edge, then starts again from the
                left.
              </p>
              <p>
                The view stays at two octaves during each take and quietly
                refits between takes if you move beyond it.
              </p>
            </div>
          }
        >
          {(current) => (
            <>
              <p class={styles.summary}>{current().summary}</p>
              <div class={styles.guideSection}>
                <span>Goal</span>
                <p>{current().goal}</p>
              </div>
              <div class={styles.guideSection}>
                <span>How to sing it</span>
                <p>{current().instructions}</p>
              </div>
              <Show when={current().pronunciationHint}>
                <div class={styles.pronunciation}>
                  <span>Pronunciation</span>
                  <p>{current().pronunciationHint}</p>
                </div>
              </Show>
              <Show when={current().safetyNote}>
                <p class={styles.safety}>{current().safetyNote}</p>
              </Show>

              <div class={styles.inlineControl}>
                <div>
                  <span>Starting pitch</span>
                  <strong>
                    {midiToNote(session.rootMidi()).name}
                    {midiToNote(session.rootMidi()).octave}
                  </strong>
                </div>
                <div class={styles.stepper}>
                  <button
                    type="button"
                    onClick={() => session.setRootMidi(session.rootMidi() - 1)}
                    disabled={session.status() !== 'idle'}
                    aria-label="Transpose exercise down one semitone"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => session.setRootMidi(session.rootMidi() + 1)}
                    disabled={session.status() !== 'idle'}
                    aria-label="Transpose exercise up one semitone"
                  >
                    +
                  </button>
                </div>
              </div>

              <Show when={current().exampleAudio}>
                {(exampleAudio) => (
                  <button
                    type="button"
                    class={styles.exampleButton}
                    classList={{
                      [styles.examplePlaying]:
                        exampleState() === 'loading' ||
                        exampleState() === 'playing' ||
                        exampleState() === 'paused',
                    }}
                    data-example-audio-state={exampleState()}
                    data-example-audio-progress={Math.round(
                      exampleProgress() * 1000,
                    )}
                    aria-pressed={exampleState() === 'playing'}
                    aria-label={
                      exampleState() === 'loading'
                        ? 'Cancel pronunciation and tone example'
                        : exampleState() === 'playing'
                          ? 'Pause pronunciation and tone example'
                          : exampleState() === 'paused'
                            ? 'Resume pronunciation and tone example'
                            : 'Play pronunciation and tone example'
                    }
                    onClick={() => void toggleExample()}
                  >
                    <ExampleWaveformProgress
                      url={exampleAudio().src}
                      color={PITCH_VISUAL_COLORS.singer}
                      progress={exampleProgress()}
                    />
                    <span class={styles.exampleIcon} aria-hidden="true">
                      {exampleState() === 'loading' ? (
                        <Loader2 />
                      ) : exampleState() === 'playing' ? (
                        <Pause />
                      ) : (
                        <Play />
                      )}
                    </span>
                    <span class={styles.exampleLabel}>
                      {exampleState() === 'loading'
                        ? 'Preparing example…'
                        : exampleState() === 'playing'
                          ? 'Playing pronunciation and tone'
                          : exampleState() === 'paused'
                            ? 'Example paused'
                            : exampleState() === 'ended'
                              ? 'Play pronunciation again'
                              : exampleState() === 'error'
                                ? 'Try pronunciation example again'
                                : 'Hear pronunciation and tone'}
                    </span>
                    <small>
                      {exampleState() === 'idle' ||
                      exampleState() === 'loading' ||
                      exampleState() === 'error'
                        ? `${Math.round(exampleDurationSec())} sec`
                        : `${audioClock(exampleElapsedSec())} / ${audioClock(exampleDurationSec())}`}
                    </small>
                  </button>
                )}
              </Show>
            </>
          )}
        </Show>

        <Show when={session.exercise() !== null}>
          <div class={styles.visibilityControl}>
            <span>Target notes</span>
            <button
              type="button"
              class={styles.muteButton}
              classList={{ [styles.muteEngaged]: notesMuted() }}
              data-testid="zen-mute-notes"
              onClick={() => setNotesMuted((muted) => !muted)}
              disabled={session.targetVisibility() !== 'on'}
              // Pressed means the mute is engaged. This read inverted, so the
              // control announced "pressed" exactly while notes were audible.
              aria-pressed={notesMuted()}
              aria-label={
                notesMuted() ? 'Unmute guide notes' : 'Mute guide notes'
              }
              title={
                session.targetVisibility() !== 'on'
                  ? 'Guide notes only sound while targets are fully shown'
                  : notesMuted()
                    ? 'Unmute guide notes'
                    : 'Mute guide notes'
              }
            >
              {notesMuted() ? <VolumeX /> : <Volume2 />}
            </button>
            <div role="group" aria-label="Target note visibility">
              <For each={['on', 'dim', 'off'] as const}>
                {(visibility) => (
                  <button
                    type="button"
                    classList={{
                      [styles.activeChoice]:
                        session.targetVisibility() === visibility,
                    }}
                    aria-pressed={session.targetVisibility() === visibility}
                    onClick={() => session.setTargetVisibility(visibility)}
                  >
                    {visibility === 'on'
                      ? 'On'
                      : visibility === 'dim'
                        ? 'Dim'
                        : 'Off'}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={scoredRun()?.score}>
          {(score) => (
            <div class={styles.scoreCard}>
              <div>
                <span>Last take</span>
                <strong>{score().total}</strong>
              </div>
              <dl>
                <div>
                  <dt>Pitch</dt>
                  <dd>{score().pitch}</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{score().coverage}</dd>
                </div>
                <div>
                  <dt>Steady</dt>
                  <dd>{score().steadiness}</dd>
                </div>
              </dl>
            </div>
          )}
        </Show>

        <Show when={startError()}>
          <p class={styles.error} role="alert">
            {startError()}
          </p>
        </Show>

        <button
          type="button"
          class={styles.beginButton}
          onClick={() => void begin()}
          // Only ever a *start*, and only from stopped. It used to read
          // "Restart exercise" while paused and route through start(), which
          // binned the paused take without finalizing it — meanwhile the
          // footer offered "Resume" for the same state. Restart now has its
          // own control in the transport, so the two cannot disagree.
          disabled={
            exampleState() === 'loading' ||
            exampleState() === 'playing' ||
            exampleState() === 'paused' ||
            session.status() !== 'idle'
          }
        >
          <Play />
          {session.runs().length > 0 ? 'Start another take' : 'Begin practice'}
        </button>
      </div>
    )
  }

  const footer = (
    <>
      <div class={styles.historyControls}>
        <button
          type="button"
          class={styles.iconButton}
          onClick={() => session.previousRun()}
          disabled={!canGoBack()}
          aria-label="Previous take"
          title={takeLockReason()}
        >
          ‹
        </button>
        <button
          type="button"
          class={styles.takeLabel}
          // Returning to live is safe in every state — it is where a running
          // session belongs — so this one is not gated on the transport.
          onClick={() => session.followLive()}
          disabled={session.selectedRunId() === null}
        >
          <strong>
            {runLabel(session.selectedRun(), session.takeNumber())}
          </strong>
          <span>{session.runs().length} saved here</span>
        </button>
        <button
          type="button"
          class={styles.iconButton}
          onClick={() => session.nextRun()}
          disabled={!canGoForward()}
          aria-label="Next take"
          title={takeLockReason()}
        >
          ›
        </button>
        <button
          type="button"
          class={styles.iconButton}
          onClick={() => deleteSelectedRun()}
          disabled={!canChangeTake() || session.selectedRun() === null}
          aria-label="Delete this take (permanent)"
          title={takeLockReason() ?? 'Delete this take (permanent)'}
        >
          ×
        </button>
      </div>

      <div class={styles.transportControls}>
        <button
          type="button"
          class={styles.transportButton}
          data-testid="zen-transport"
          onClick={() => {
            const current = session.status()
            if (current === 'running') session.pause()
            else if (current === 'paused') session.resume()
            else void begin()
          }}
        >
          {session.status() === 'running' ? <Pause /> : <Play />}
          <span>
            {session.status() === 'running'
              ? 'Pause'
              : session.status() === 'paused'
                ? 'Resume'
                : 'Start'}
          </span>
        </button>
        {/* Restart is its own verb, available exactly while there is a pass
            to restart. It finalizes first, so pressing it never bins the
            take the way "press start again" used to. */}
        <Show when={session.status() !== 'idle'}>
          <button
            type="button"
            class={styles.iconButton}
            data-testid="zen-restart"
            onClick={() => void restart()}
            aria-label="Restart the exercise from the beginning"
            title="Restart exercise"
          >
            <RotateCcw />
          </button>
        </Show>
        <span class={styles.timeReadout}>
          {session.elapsedSec().toFixed(1)} /{' '}
          {session.loopDurationSec().toFixed(1)} sec
        </span>
      </div>

      <div class={styles.viewControls}>
        <Show
          when={session.exercise() === null}
          fallback={
            <>
              <button
                type="button"
                class={styles.compactButton}
                onClick={cycleTargetVisibility}
              >
                Target {session.targetVisibility()}
              </button>
              <button
                type="button"
                class={styles.compactButton}
                classList={{
                  [styles.compactActive]: session.progressCue() === 'playhead',
                }}
                aria-pressed={session.progressCue() === 'playhead'}
                aria-label={`Playhead ${
                  session.progressCue() === 'playhead' ? 'on' : 'off'
                }`}
                onClick={() =>
                  session.setProgressCue(
                    session.progressCue() === 'playhead' ? 'none' : 'playhead',
                  )
                }
              >
                Playhead
              </button>
            </>
          }
        >
          <SafeSelect
            class={styles.loopSelect}
            aria-label="Loop duration"
            value={String(session.loopDurationSec())}
            disabled={session.status() !== 'idle'}
            onChange={(event) =>
              session.setLoopDurationSec(Number(event.currentTarget.value))
            }
          >
            <For each={LOOP_OPTIONS}>
              {(seconds) => <option value={seconds}>{seconds} sec loop</option>}
            </For>
          </SafeSelect>
        </Show>
        <Show when={isNarrow()}>
          <button
            type="button"
            class={styles.infoButton}
            onClick={() => {
              guideOpenPlain = true
              setGuideOpen(true)
            }}
            aria-label="Open practice guide"
            title="Practice guide"
          >
            ?
          </button>
        </Show>
      </div>
    </>
  )

  onMount(() => {
    window.addEventListener('keydown', onKeyDown)
    void refreshGuidedContent()
    void loadHistory(session.exerciseId())
  })

  onCleanup(() => {
    ++loadRequest
    window.removeEventListener('keydown', onKeyDown)
    stopExample()
    examplePlayer.dispose()
    if (examplePreloader !== undefined) {
      examplePreloader.removeAttribute('src')
      examplePreloader.load()
    }
  })

  return (
    <div class={styles.root}>
      <PitchStageShell
        mode={session.exercise() === null ? 'zen-monitor' : 'zen-exercise'}
        testId="zen-pitch-stage"
        class={styles.stage}
        ariaLabel="Zen singing pitch practice"
        eyebrow={eyebrow()}
        title={title()}
        icon={<MusicNote />}
        referenceColor={PITCH_VISUAL_COLORS.reference}
        userColor={PITCH_VISUAL_COLORS.singer}
        legend={[
          ...(session.exercise() === null
            ? []
            : [
                {
                  label: 'Exercise target',
                  color: PITCH_VISUAL_COLORS.reference,
                },
              ]),
          {
            label: 'Your voice',
            color: PITCH_VISUAL_COLORS.singer,
          },
        ]}
        headerMeta={
          <>
            <span>
              {session.status() === 'running'
                ? 'Listening'
                : session.status() === 'paused'
                  ? 'Paused'
                  : 'Ready'}
            </span>
            <span>{runLabel(session.selectedRun(), session.takeNumber())}</span>
          </>
        }
        primaryAction={
          <button
            type="button"
            class={styles.finishButton}
            onClick={finishAndClose}
          >
            <X />
            {session.status() === 'idle' ? 'Close' : 'Finish'}
          </button>
        }
        canvas={<ZenPitchCanvas model={canvasModel} summary={canvasSummary} />}
        sidecarAriaLabel="Exercise guide"
        sidecar={isNarrow() ? undefined : <GuideContent />}
        footer={footer}
      />

      <audio ref={examplePreloader} preload="auto" aria-hidden="true" />

      <Sheet
        isOpen={isNarrow() && guideOpen()}
        close={() => {
          stopExample(true)
          guideOpenPlain = false
          setGuideOpen(false)
        }}
        ariaLabel="Practice guide"
        snap="tall"
        class={styles.mobileGuideSheet}
      >
        <GuideContent />
      </Sheet>
    </div>
  )
}
