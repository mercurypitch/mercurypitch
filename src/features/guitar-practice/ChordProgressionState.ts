// ============================================================
// ChordProgressionState — chord progression sequencer
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { chordFromDegree, PROGRESSIONS } from '@/lib/guitar/chord-progression'

export interface ChordProgressionState {
  progressionIndex: Accessor<number>
  progressionName: Accessor<string>
  currentChordName: Accessor<string>
  currentChordQuality: Accessor<string>
  currentStep: Accessor<number>
  bpm: Accessor<number>
  playing: Accessor<boolean>
  setProgression: (index: number) => void
  nextProgression: () => void
  prevProgression: () => void
  setBpm: (bpm: number) => void
  start: () => void
  stop: () => void
  toggle: () => void
}

export function createChordProgression(
  key: () => string,
  setSelectedChord: Setter<string | null>,
): ChordProgressionState {
  const [progressionIndex, setProgressionIndex] = createSignal(0)
  const [currentChordName, setCurrentChordName] = createSignal('')
  const [currentChordQuality, setCurrentChordQuality] = createSignal('maj')
  const [currentStep, setCurrentStep] = createSignal(0)
  const [bpm, setBpm] = createSignal(100)
  const [playing, setPlaying] = createSignal(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let stepStartTime = 0
  let expectedStep = 0

  const progressionName = () => PROGRESSIONS[progressionIndex()].name

  const setProgression = (index: number) => {
    stop()
    setProgressionIndex(index)
    setCurrentStep(0)
  }

  const nextProgression = () => {
    stop()
    setProgressionIndex((i) => (i + 1) % PROGRESSIONS.length)
    setCurrentStep(0)
  }

  const prevProgression = () => {
    stop()
    setProgressionIndex(
      (i) => (i - 1 + PROGRESSIONS.length) % PROGRESSIONS.length,
    )
    setCurrentStep(0)
  }

  const advanceStep = () => {
    const progression = PROGRESSIONS[progressionIndex()]
    setCurrentStep((step) => {
      const next = (step + 1) % progression.degrees.length
      const degree = progression.degrees[next]
      const chord = chordFromDegree(key(), degree)
      setCurrentChordName(chord.chordName)
      setCurrentChordQuality(chord.quality)
      setSelectedChord(chord.quality)
      return next
    })
  }

  const scheduleNext = () => {
    if (!playing()) return
    const msPerBeat = (60 / bpm()) * 1000
    expectedStep++
    const nextTime = stepStartTime + expectedStep * msPerBeat
    const delay = Math.max(0, nextTime - performance.now())
    timer = setTimeout(() => {
      advanceStep()
      scheduleNext()
    }, delay)
  }

  const start = () => {
    if (playing()) return
    // Set the first chord immediately (step 0)
    const progression = PROGRESSIONS[progressionIndex()]
    const degree = progression.degrees[0]
    const chord = chordFromDegree(key(), degree)
    setCurrentStep(0)
    setCurrentChordName(chord.chordName)
    setCurrentChordQuality(chord.quality)
    setSelectedChord(chord.quality)
    setPlaying(true)
    // Schedule subsequent steps with drift-compensated setTimeout
    stepStartTime = performance.now()
    expectedStep = 0
    scheduleNext()
  }

  const stop = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    setPlaying(false)
    setSelectedChord(null)
  }

  const toggle = () => {
    if (playing()) stop()
    else start()
  }

  onCleanup(() => {
    if (timer !== null) clearTimeout(timer)
  })

  return {
    progressionIndex,
    progressionName,
    currentChordName,
    currentChordQuality,
    currentStep,
    bpm,
    playing,
    setProgression,
    nextProgression,
    prevProgression,
    setBpm,
    start,
    stop,
    toggle,
  }
}
