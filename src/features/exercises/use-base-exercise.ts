import { batch, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
import type { TracePoint } from './last-run-trace'
import { downsampleTrace, publishRunTrace } from './last-run-trace'
import type { ExerciseConfig, ExerciseResult, ExerciseState } from './types'

const MAX_PITCH_HISTORY = 2000

interface BaseExerciseDeps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  config: ExerciseConfig
}

/**
 * Shared exercise infrastructure. Wraps the practice engine's pitch detection
 * and mic lifecycle so individual exercise controllers only define scoring.
 */
export function useBaseExercise(deps: BaseExerciseDeps) {
  const { audioEngine, practiceEngine } = deps

  const [state, setState] = createSignal<ExerciseState>({
    status: 'idle',
    currentScore: 0,
    elapsedMs: 0,
    metrics: {},
  })

  const [getPitchHistory, setPitchHistory] = createSignal<
    Array<{
      freq: number
      time: number
      cents: number
      clarity?: number
      noteName?: string
    }>
  >([])
  const [getCurrentPitch, setCurrentPitch] = createSignal<{
    freq: number
    clarity: number
    noteName: string
  } | null>(null)
  const [getFrequencyData, setFrequencyData] =
    createSignal<Float32Array | null>(null)
  const [getTargetPitch, setTargetPitch] = createSignal<number | null>(null)
  const [getResult, setResult] = createSignal<ExerciseResult | null>(null)
  const [getError, setError] = createSignal<string | null>(null)

  let animId = 0
  let startTime = 0
  let running = false
  // Target-pitch timeline of the current run: one point per reference-tone
  // change, on the same elapsed-seconds epoch as pitchHistory `.time`. Feeds
  // the published run trace (pitch-race share / duet-with-past-self).
  let targetTimeline: TracePoint[] = []
  // Controller cleanup callbacks. Registrations are PERSISTENT for the
  // component's lifetime: controllers register once at creation (closing
  // over their mutable timer handles / cancellation flags), and the base
  // re-runs the callbacks at every teardown point. They used to be emptied
  // after the first run, which left every later run of the same mounted
  // exercise without cleanup — zombie timers and tones after a second
  // stop/reset. Callbacks must therefore be idempotent (all are: they
  // clear timers and set flags).
  const disposeFns: Array<() => void> = []
  const runDisposers = (): void => {
    for (const fn of disposeFns) {
      try {
        fn()
      } catch {
        /* ignore */
      }
    }
  }

  // Re-entrancy guards. If a reactive cycle causes these functions to be
  // called recursively, we log and bail instead of cascading.
  let completeDepth = 0
  let resetDepth = 0
  let startDepth = 0

  // NOTE: exercises deliberately do NOT subscribe to practice-engine
  // callbacks — they poll practiceEngine.update() in their own rAF loop.
  // A previous version registered a no-op onMicStateChange here via the
  // replace-wholesale setCallbacks(), which disconnected the app-level
  // listener that keeps the shared mic-state signal in sync: after visiting
  // any exercise, mic toggles on other tabs stopped updating the UI.

  /**
   * Acquire the mic and enter the active state. Returns true only when the
   * exercise actually started — callers must gate their controller's step
   * logic on it, or a denied mic / concurrent start would kick off timer
   * chains on an exercise that is still idle.
   */
  async function start(): Promise<boolean> {
    // Guard against concurrent starts — reset() fires the autoStart effect
    // which races with explicit handleStart() calls from click handlers.
    if (state().status !== 'idle') return false

    if (startDepth > 0) {
      console.warn('[useBaseExercise] re-entrant start() call — bailing')
      return false
    }
    startDepth++

    batch(() => {
      setState({
        status: 'count-in',
        currentScore: 0,
        elapsedMs: 0,
        metrics: {},
      })
      setPitchHistory([])
      setCurrentPitch(null)
      setResult(null)
    })
    targetTimeline = []

    const micWasActive = practiceEngine.isMicActive()
    if (!micWasActive) {
      const ok = await practiceEngine.startMic()
      if (!ok) {
        setError(
          'Microphone access denied. Please allow mic access and try again.',
        )
        batch(() => {
          setState((s) => ({ ...s, status: 'idle' }))
        })
        startDepth--
        return false
      }
    }

    // If a reset()/dispose ran while we awaited the mic (e.g. the singer hit
    // Back or switched exercise during the permission prompt), abort: the loop
    // below would otherwise run forever with nothing left to stop it, and we
    // would leave the mic on that reset() just released.
    if (state().status !== 'count-in') {
      if (!micWasActive) practiceEngine.stopMic()
      startDepth--
      return false
    }

    setError(null)

    startTime = performance.now()
    running = true
    setState((s) => ({ ...s, status: 'active' }))

    const loop = () => {
      if (!running) return

      const pitch = practiceEngine.update()
      const now = performance.now()
      const elapsed = now - startTime

      batch(() => {
        if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
          setCurrentPitch({
            freq: pitch.frequency,
            clarity: pitch.clarity,
            noteName: pitch.noteName,
          })
          setFrequencyData(audioEngine.getFrequencyData())

          setPitchHistory((prev) => {
            const next = [
              ...prev,
              {
                freq: pitch.frequency,
                time: elapsed / 1000,
                cents: pitch.cents,
                clarity: pitch.clarity,
              },
            ]
            return next.length > MAX_PITCH_HISTORY
              ? next.slice(-MAX_PITCH_HISTORY)
              : next
          })
        }

        setState((s) => ({ ...s, elapsedMs: elapsed }))
      })
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    startDepth--
    return true
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(animId)
    // Clear controller timers registered via _registerDispose — mirrors
    // reset()/_setRunning(false) so a caller using stop() doesn't leak
    // pending setInterval/setTimeout chains from the exercise controller.
    runDisposers()
    const finalElapsed = performance.now() - startTime
    setState((s) => ({ ...s, status: 'complete', elapsedMs: finalElapsed }))
  }

  function completeWithResult(exerciseResult: ExerciseResult): void {
    if (completeDepth > 0) {
      console.warn(
        '[useBaseExercise] re-entrant completeWithResult() call — bailing',
      )
      return
    }
    completeDepth++
    running = false
    cancelAnimationFrame(animId)
    const finalElapsed = performance.now() - startTime
    // Publish the run's contour BEFORE the result signal fires: the
    // component's result effect calls recordExerciseResult, whose challenge
    // return path reads the trace synchronously.
    publishRunTrace({
      type: exerciseResult.type,
      completedAt: exerciseResult.completedAt,
      durationMs: Math.round(finalElapsed),
      samples: downsampleTrace(
        getPitchHistory().map((p) => ({ t: p.time, f: p.freq })),
      ),
      targets: targetTimeline,
    })
    batch(() => {
      setResult(exerciseResult)
      setState({
        status: 'complete',
        currentScore: exerciseResult.score,
        elapsedMs: finalElapsed,
        metrics: exerciseResult.metrics,
      })
    })
    completeDepth--
  }

  function reset(): void {
    if (resetDepth > 0) {
      console.warn('[useBaseExercise] re-entrant reset() call — bailing')
      return
    }
    resetDepth++
    running = false
    cancelAnimationFrame(animId)

    // Stop any currently-playing tone immediately
    audioEngine.stopTone()

    // Clear all controller timers registered via _registerDispose
    runDisposers()

    practiceEngine.stopMic()
    batch(() => {
      setState({ status: 'idle', currentScore: 0, elapsedMs: 0, metrics: {} })
      setPitchHistory([])
      setCurrentPitch(null)
      setResult(null)
      setTargetPitch(null)
    })
    resetDepth--
  }

  function commitResult(exerciseResult: ExerciseResult): void {
    setResult(exerciseResult)
  }

  function updateScore(score: number): void {
    setState((s) => ({ ...s, currentScore: score }))
  }

  function updateMetrics(metrics: Record<string, number>): void {
    setState((s) => {
      const next = { ...s.metrics, ...metrics }
      // Stamp phase transitions on the run clock so UI can animate the
      // response window (remaining = matchWindowMs − (elapsedMs −
      // phaseStartedMs)) without every controller threading timing through.
      if ('phase' in metrics && metrics.phase !== s.metrics.phase) {
        next.phaseStartedMs = performance.now() - startTime
      }
      return { ...s, metrics: next }
    })
  }

  onCleanup(() => {
    running = false
    cancelAnimationFrame(animId)
    // Dispose controller timers (setInterval, rAF loops) to prevent leaks
    runDisposers()
    practiceEngine.stopMic()
  })

  return {
    state,
    start,
    stop,
    reset,
    result: getResult,
    pitchHistory: getPitchHistory,
    currentPitch: getCurrentPitch,
    frequencyData: getFrequencyData,
    targetPitch: getTargetPitch,
    error: getError,
    // Expose internals for exercise controllers
    _commitResult: commitResult,
    _updateScore: updateScore,
    _updateMetrics: updateMetrics,
    _completeWithResult: completeWithResult,
    _setTargetPitch: (freq: number | null) => {
      setTargetPitch(freq)
      // Record reference-tone changes on the run's elapsed epoch (running
      // only — controllers may pre-set a target before start()).
      if (running && freq !== null && freq > 0) {
        targetTimeline.push({
          t: (performance.now() - startTime) / 1000,
          f: freq,
        })
      }
    },
    _getElapsed: () => performance.now() - startTime,
    _isRunning: () => running,
    _setRunning: (v: boolean) => {
      running = v
      if (!v) {
        // When external caller sets running=false, clear controller timers
        runDisposers()
        audioEngine.stopTone()
      }
    },
    /**
     * Register a cleanup callback for controller timers/flags. Call ONCE at
     * controller creation — the registration is permanent and re-runs at
     * every stop/reset/unmount, so the callback must be idempotent.
     */
    _registerDispose: (fn: () => void) => {
      disposeFns.push(fn)
    },
    _getDepths: () => ({ completeDepth, resetDepth, startDepth }),
  }
}

export type BaseExerciseController = ReturnType<typeof useBaseExercise>
