import { createSignal, onCleanup } from 'solid-js'
import type { PracticeEngine } from '@/lib/practice-engine'
import type { AudioEngine } from '@/lib/audio-engine'
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

  const pitchHistory = createSignal<Array<{ freq: number; time: number; cents: number }>>([])
  const [getPitchHistory, setPitchHistory] = pitchHistory
  const [getCurrentPitch, setCurrentPitch] = createSignal<{ freq: number; clarity: number; noteName: string } | null>(null)
  const [getFrequencyData, setFrequencyData] = createSignal<Float32Array | null>(null)
  const [getTargetPitch, setTargetPitch] = createSignal<number | null>(null)
  const result = createSignal<ExerciseResult | null>(null)
  const [getResult, setResult] = result

  let animId = 0
  let startTime = 0
  let running = false
  let lastMicState = false

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
    setState({
      status: 'count-in',
      currentScore: 0,
      elapsedMs: 0,
      metrics: {},
    })
    setPitchHistory([])
    setCurrentPitch(null)
    setResult(null)

    if (!practiceEngine.isMicActive()) {
      const ok = await practiceEngine.startMic()
      if (!ok) {
        setState((s) => ({ ...s, status: 'idle' }))
        return
      }
    }

    startTime = performance.now()
    running = true
    setState((s) => ({ ...s, status: 'active' }))

    const loop = () => {
      if (!running) return

      const pitch = practiceEngine.update()
      const now = performance.now()
      const elapsed = now - startTime

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
            { freq: pitch.frequency, time: elapsed / 1000, cents: pitch.cents },
          ]
          return next.length > MAX_PITCH_HISTORY ? next.slice(-MAX_PITCH_HISTORY) : next
        })
      }

      setState((s) => ({ ...s, elapsedMs: elapsed }))
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
  }

  function stop(): void {
    running = false
    cancelAnimationFrame(animId)
    const finalElapsed = performance.now() - startTime
    setState((s) => ({ ...s, status: 'complete', elapsedMs: finalElapsed }))
  }

  function reset(): void {
    running = false
    cancelAnimationFrame(animId)
    setState({ status: 'idle', currentScore: 0, elapsedMs: 0, metrics: {} })
    setPitchHistory([])
    setCurrentPitch(null)
    setResult(null)
    setTargetPitch(null)
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
    // Expose internals for exercise controllers
    _commitResult: commitResult,
    _updateScore: updateScore,
    _updateMetrics: updateMetrics,
    _setTargetPitch: setTargetPitch,
    _getElapsed: () => performance.now() - startTime,
    _isRunning: () => running,
    _setRunning: (v: boolean) => { running = v },
  }
}

export type BaseExerciseController = ReturnType<typeof useBaseExercise>
