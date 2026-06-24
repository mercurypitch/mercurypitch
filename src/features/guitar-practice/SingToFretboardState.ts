// ============================================================
// SingToFretboardState — sing/hum a note, find it on the fretboard
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName } from '@/lib/note-utils'
import { PitchDetector } from '@/lib/pitch-detector'

export interface SingToFretboardState {
  targetMidi: Accessor<number | null>
  targetNoteName: Accessor<string>
  clarity: Accessor<number>
  phase: Accessor<'listening' | 'locked' | 'found'>
  matched: Accessor<boolean>
  streak: Accessor<number>
  totalFound: Accessor<number>
  running: Accessor<boolean>
  handleFretNotePlayed: (midi: number) => boolean
  start: () => void
  stop: () => void
}

export function createSingToFretboard(
  audioEngine: AudioEngine,
): SingToFretboardState {
  const [targetMidi, setTargetMidi] = createSignal<number | null>(null)
  const [targetNoteName, setTargetNoteName] = createSignal('')
  const [clarity, setClarity] = createSignal(0)
  const [phase, setPhase] = createSignal<'listening' | 'locked' | 'found'>(
    'listening',
  )
  const [matched, setMatched] = createSignal(false)
  const [streak, setStreak] = createSignal(0)
  const [totalFound, setTotalFound] = createSignal(0)
  const [running, setRunning] = createSignal(false)

  const pitchDetector = new PitchDetector()
  let rafId: number | null = null
  let lockFrames = 0
  let silenceFrames = 0
  let foundTimer: ReturnType<typeof setTimeout> | null = null
  const LOCK_THRESHOLD = 8
  const SILENCE_THRESHOLD = 90 // ~3s at 30fps

  const detectLoop = () => {
    const buffer = audioEngine.getTimeData()
    if (buffer.length === 0) {
      rafId = requestAnimationFrame(detectLoop)
      return
    }

    const result = pitchDetector.detect(buffer)

    if (result.clarity > 0.5 && result.midi !== undefined && result.midi > 0) {
      lockFrames++
      silenceFrames = 0

      if (lockFrames >= LOCK_THRESHOLD) {
        const midi = Math.round(result.midi)
        setTargetMidi(midi)
        setTargetNoteName(midiToNoteName(midi))
        setClarity(result.clarity)
        setPhase('locked')
      }
    } else {
      if (phase() === 'locked') {
        silenceFrames++
        if (silenceFrames >= SILENCE_THRESHOLD) {
          setTargetMidi(null)
          setTargetNoteName('')
          setClarity(0)
          setPhase('listening')
          setMatched(false)
          lockFrames = 0
          silenceFrames = 0
        }
      } else {
        lockFrames = 0
      }
    }

    // Keep updating clarity during locked phase
    if (phase() === 'locked' && result.clarity > 0.5) {
      setClarity(result.clarity)
    }

    rafId = requestAnimationFrame(detectLoop)
  }

  const start = () => {
    if (running()) return
    setRunning(true)
    lockFrames = 0
    silenceFrames = 0
    setTargetMidi(null)
    setTargetNoteName('')
    setClarity(0)
    setPhase('listening')
    setMatched(false)
    rafId = requestAnimationFrame(detectLoop)
  }

  const stop = () => {
    setRunning(false)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (foundTimer !== null) {
      clearTimeout(foundTimer)
      foundTimer = null
    }
    lockFrames = 0
    silenceFrames = 0
    setTargetMidi(null)
    setTargetNoteName('')
    setClarity(0)
    setPhase('listening')
    setMatched(false)
  }

  const handleFretNotePlayed = (midi: number): boolean => {
    if (phase() !== 'locked') return false
    const target = targetMidi()
    if (target === null) return false

    if (midi % 12 === target % 12) {
      setPhase('found')
      setMatched(true)
      setStreak((s) => s + 1)
      setTotalFound((t) => t + 1)

      // Auto-restart after 1.5s
      foundTimer = setTimeout(() => {
        lockFrames = 0
        silenceFrames = 0
        setTargetMidi(null)
        setTargetNoteName('')
        setClarity(0)
        setPhase('listening')
        setMatched(false)
      }, 1500)

      return true
    }

    // Wrong note — reset streak
    setStreak(0)
    return false
  }

  onCleanup(() => {
    stop()
  })

  return {
    targetMidi,
    targetNoteName,
    clarity,
    phase,
    matched,
    streak,
    totalFound,
    running,
    handleFretNotePlayed,
    start,
    stop,
  }
}
