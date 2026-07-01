import { batch, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PracticeEngine } from '@/lib/practice-engine'
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
  let lastMicState = false
  let disposeFns: Array<() => void> = []

  // Re-entrancy guards. If a reactive cycle causes these functions to be
  // called recursively, we log and bail instead of cascading.
  let completeDepth = 0
  let resetDepth = 0
  let startDepth = 0

  // Wire mic state callback
  practiceEngine.setCallbacks({
    onMicStateChange: (active) => {
      if (active !== lastMicState && !active && running) {
        // Mic dropped unexpectedly — keep running but mark
      }
      lastMicState = active
    },
  })

  async function start(): Promise<void> {
    // Guard against concurrent starts — reset() fires the autoStart effect
    // which races with explicit handleStart() calls from click handlers.
    if (state().status !== 'idle') return

    if (startDepth > 0) {
      console.warn('[useBaseExercise] re-entrant start() call — bailing')
      return
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

    if (!practiceEngine.isMicActive()) {
      const ok = await practiceEngine.startMic()
      if (!ok) {
        setError(
          'Microphone access denied. Please allow mic access and try again.',
        )
        batch(() => {
          setState((s) => ({ ...s, status: 'idle' }))
        })
        startDepth--
        return
      }
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
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(animId)
    // Clear controller timers registered via _registerDispose — mirrors
    // reset()/_setRunning(false) so a caller using stop() doesn't leak
    // pending setInterval/setTimeout chains from the exercise controller.
    for (const fn of disposeFns) {
      try {
        fn()
      } catch {
        /* ignore */
      }
    }
    disposeFns = []
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
    for (const fn of disposeFns) {
      try {
        fn()
      } catch {
        /* ignore */
      }
    }
    disposeFns = []

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
    setState((s) => ({ ...s, metrics: { ...s.metrics, ...metrics } }))
  }

  onCleanup(() => {
    running = false
    cancelAnimationFrame(animId)
    // Dispose controller timers (setInterval, rAF loops) to prevent leaks
    for (const fn of disposeFns) {
      try {
        fn()
      } catch {
        /* ignore */
      }
    }
    disposeFns = []
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
    _setTargetPitch: setTargetPitch,
    _getElapsed: () => performance.now() - startTime,
    _isRunning: () => running,
    _setRunning: (v: boolean) => {
      running = v
      if (!v) {
        // When external caller sets running=false, clear controller timers
        for (const fn of disposeFns) {
          try {
            fn()
          } catch {
            /* ignore */
          }
        }
        disposeFns = []
        audioEngine.stopTone()
      }
    },
    _registerDispose: (fn: () => void) => {
      disposeFns.push(fn)
    },
    _getDepths: () => ({ completeDepth, resetDepth, startDepth }),
  }
}

export type BaseExerciseController = ReturnType<typeof useBaseExercise>
