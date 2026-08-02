import type { Accessor, Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { MusicNote, Pause, Play, Volume2, VolumeX, X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { PitchStageShell } from '@/components/pitch-stage/PitchStageShell'
import { SafeSelect } from '@/components/shared/SafeSelect'
import { deleteZenTake, listZenTakes, saveZenTake, } from '@/db/services/zen-take-service'
import { playReferenceTone } from '@/features/mirror/tone-player'
import type { PracticeFrame, PracticeFrameListener, } from '@/features/practice/usePracticeController'
import { PITCH_VISUAL_COLORS } from '@/features/stem-mixer/pitch-canvas-visuals'
import { midiToNote } from '@/lib/scale-data'
import { isNarrow } from '@/lib/use-viewport'
import { getZenExercise, zenExerciseCatalog } from './exercise-catalog'
import { refreshGuidedContent } from './guided-content-store'
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

export const ZenPitchStage: Component<ZenPitchStageProps> = (props) => {
  const [guideOpen, setGuideOpen] = createSignal(
    props.initialExerciseId !== undefined ||
      props.initialExerciseDefinition !== undefined,
  )
  const [examplePlaying, setExamplePlaying] = createSignal(false)
  const [startError, setStartError] = createSignal<string | null>(null)
  let audio: HTMLAudioElement | undefined
  let resumeAfterExample = false
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
  const [notesMuted, setNotesMuted] = createSignal(false)
  let toneCtx: AudioContext | null = null
  let playedTargetKeys = new Set<string>()
  const notePlaybackActive = (): boolean =>
    !notesMuted() &&
    session.targetVisibility() === 'on' &&
    session.exercise() !== null

  createEffect(() => {
    // Re-arm the played set on every loop restart / exercise change.
    session.exerciseId()
    session.status()
    playedTargetKeys = new Set()
  })

  createEffect(() => {
    // Unmuting must be audible NOW, not at the next loop: clear the
    // played keys so a target currently inside its window fires
    // immediately (passed windows stay silent — the window check gates
    // them). Without this, pause+resume was the only thing that re-armed
    // playback mid-run (owner testing). Muting mid-note lets the current
    // tone's short tail (<=1.2s) ring out — cutting it would pop.
    if (!notesMuted()) playedTargetKeys = new Set()
  })

  createEffect(() => {
    if (!notePlaybackActive()) return
    if (session.status() !== 'running') return
    const elapsed = session.elapsedSec()
    const loop = Math.floor(elapsed / Math.max(1e-6, session.loopDurationSec()))
    const inLoop = elapsed - loop * session.loopDurationSec()
    for (const target of session.targets()) {
      const key = `${loop}:${target.startSec}:${target.startMidi}`
      if (playedTargetKeys.has(key)) continue
      if (inLoop >= target.startSec && inLoop < target.endSec) {
        playedTargetKeys.add(key)
        toneCtx ??= new AudioContext()
        // A context created outside a click can start suspended
        // (autoplay policy) — resume before scheduling or nothing sounds.
        if (toneCtx.state === 'suspended') void toneCtx.resume()
        void playReferenceTone(
          toneCtx,
          target.startMidi,
          Math.min(1.2, Math.max(0.3, target.endSec - target.startSec)),
        )
      }
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

  const canGoBack = (): boolean =>
    session.selectedRunId() === null
      ? session.runs().length > 0
      : currentRunIndex() > 0

  const canGoForward = (): boolean => session.selectedRunId() !== null

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

  const stopExample = (): void => {
    resumeAfterExample = false
    setExamplePlaying(false)
    if (audio === undefined) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  const onExampleEnded = (): void => {
    setExamplePlaying(false)
    if (resumeAfterExample) session.resume()
    resumeAfterExample = false
  }

  const playExample = async (): Promise<void> => {
    const example = session.exercise()?.exampleAudio
    if (example === undefined || audio === undefined) return
    const wasRunning = session.status() === 'running'
    resumeAfterExample = wasRunning
    if (wasRunning) session.pause()
    setExamplePlaying(true)
    audio.src = example.src
    audio.load()
    try {
      await audio.play()
    } catch {
      setExamplePlaying(false)
      if (resumeAfterExample) session.resume()
      resumeAfterExample = false
    }
  }

  const begin = async (): Promise<void> => {
    setStartError(null)
    const started = await session.start()
    if (!started) {
      setStartError(
        'Microphone access is needed to draw your pitch. Check the browser permission and try again.',
      )
      return
    }
    guideOpenPlain = false
    setGuideOpen(false)
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

              <Show when={current().exampleAudio !== undefined}>
                <button
                  type="button"
                  class={styles.exampleButton}
                  classList={{ [styles.examplePlaying]: examplePlaying() }}
                  onClick={() => void playExample()}
                  disabled={examplePlaying()}
                >
                  <Volume2 />
                  <span>
                    {examplePlaying()
                      ? 'Playing example'
                      : 'Hear pronunciation and tone'}
                  </span>
                  <small>
                    {Math.round(
                      (current().exampleAudio?.durationMs ?? 0) / 1000,
                    )}
                    sec
                  </small>
                </button>
              </Show>
            </>
          )}
        </Show>

        <Show when={session.exercise() !== null}>
          <div class={styles.visibilityControl}>
            <span>Target notes</span>
            <button
              type="button"
              class={styles.iconButton}
              onClick={() => setNotesMuted((m) => !m)}
              disabled={session.targetVisibility() !== 'on'}
              aria-pressed={!notesMuted()}
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
          disabled={examplePlaying() || session.status() === 'running'}
        >
          <Play />
          {session.status() === 'paused'
            ? 'Restart exercise'
            : session.runs().length > 0
              ? 'Start another take'
              : 'Begin practice'}
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
        >
          ‹
        </button>
        <button
          type="button"
          class={styles.takeLabel}
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
        >
          ›
        </button>
        <button
          type="button"
          class={styles.iconButton}
          onClick={() => deleteSelectedRun()}
          disabled={session.selectedRun() === null}
          aria-label="Delete this take (permanent)"
          title="Delete this take (permanent)"
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

      <audio
        ref={audio}
        preload="none"
        onEnded={onExampleEnded}
        onError={onExampleEnded}
      />

      <Sheet
        isOpen={isNarrow() && guideOpen()}
        close={() => {
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
