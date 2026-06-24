// ============================================================
// AdaptiveJamState — drum machine backing that reacts to user's playing
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { CHORD_TYPES } from '@/lib/guitar/chord-utils'
import type { DrumMachine } from '@/lib/guitar/drum-machine'
import { KEY_OFFSETS, MAJOR_SCALE_INTERVALS, NOTE_NAMES, } from '@/lib/scale-data'

// Diatonic chords in a major key: triad quality for each scale degree
const DIATONIC_CHORDS: { degree: number; quality: string; label: string }[] = [
  { degree: 0, quality: 'maj', label: 'I' },
  { degree: 1, quality: 'min', label: 'ii' },
  { degree: 2, quality: 'min', label: 'iii' },
  { degree: 3, quality: 'maj', label: 'IV' },
  { degree: 4, quality: 'maj', label: 'V' },
  { degree: 5, quality: 'min', label: 'vi' },
]

// Possible surprise chord qualities (outside the diatonic set)
const SURPRISE_QUALITIES = [
  'dom7',
  'maj7',
  'min7',
  'sus4',
  'sus2',
  'dim',
  'aug',
]

const SURPRISE_CHANCE = 0.3

export interface AdaptiveJamState {
  currentChord: Accessor<string>
  currentChordRoot: Accessor<string>
  chordHistory: Accessor<string[]>
  userNoteDensity: Accessor<number>
  playing: Accessor<boolean>
  handleFretNotePlayed: (midi: number) => void
  start: () => void
  stop: () => void
}

export function createAdaptiveJam(
  key: () => string,
  drumMachine: DrumMachine,
  setSelectedChord: (chord: string | null) => void,
): AdaptiveJamState {
  const [currentChord, setCurrentChord] = createSignal('maj')
  const [currentChordRoot, setCurrentChordRoot] = createSignal('')
  const [chordHistory, setChordHistory] = createSignal<string[]>([])
  const [userNoteDensity, setUserNoteDensity] = createSignal(0)
  const [playing, setPlaying] = createSignal(false)

  let accumulatedNotes: number[] = []
  let userEmphasis: number[] = new Array(12).fill(0)
  let unsubDrum: (() => void) | null = null
  let lastStep = -1
  let noteTimestamps: number[] = []

  const selectChord = () => {
    const k = key()
    const keyOffset = KEY_OFFSETS[k] ?? 0

    // Score each diatonic chord candidate
    interface Candidate {
      quality: string
      rootName: string
      rootMidi: number
      score: number
    }

    const candidates: Candidate[] = DIATONIC_CHORDS.map((dc) => {
      const rootMidi = keyOffset + MAJOR_SCALE_INTERVALS[dc.degree]
      const rootName = NOTE_NAMES[rootMidi % 12]
      const chordDef = CHORD_TYPES[dc.quality]

      // Score: how well does this chord's tones overlap with user emphasis?
      let overlapScore = 0
      for (const interval of chordDef.degrees) {
        const pc = (rootMidi + interval) % 12
        overlapScore += userEmphasis[pc]
        // Bonus for root matching user emphasis
        if (pc === rootMidi % 12) overlapScore += userEmphasis[pc] * 0.5
      }
      // Slight preference for I, IV, V
      const romanBonus =
        dc.degree === 0 ? 1.2 : dc.degree === 3 || dc.degree === 4 ? 1.1 : 1.0

      return {
        quality: dc.quality,
        rootName,
        rootMidi,
        score: overlapScore * romanBonus,
      }
    })

    // Add randomness
    if (Math.random() < SURPRISE_CHANCE) {
      const surpriseQuality =
        SURPRISE_QUALITIES[
          Math.floor(Math.random() * SURPRISE_QUALITIES.length)
        ]
      // Pick a diatonic root for the surprise chord
      const randomDegree =
        DIATONIC_CHORDS[Math.floor(Math.random() * DIATONIC_CHORDS.length)]
      const surpriseRoot =
        NOTE_NAMES[
          (keyOffset + MAJOR_SCALE_INTERVALS[randomDegree.degree]) % 12
        ]
      candidates.push({
        quality: surpriseQuality,
        rootName: surpriseRoot,
        rootMidi: keyOffset + MAJOR_SCALE_INTERVALS[randomDegree.degree],
        score: 2, // moderate weight for surprises
      })
    }

    // Sort by score descending, pick winner
    candidates.sort((a, b) => b.score - a.score)
    const winner = candidates[0]

    setCurrentChord(winner.quality)
    setCurrentChordRoot(winner.rootName)
    setSelectedChord(winner.quality)

    // Update history
    const label = `${winner.rootName}${winner.quality}`
    setChordHistory((prev) => {
      const next = [...prev, label]
      if (next.length > 8) next.shift()
      return next
    })

    // Decay emphasis slightly
    for (let i = 0; i < 12; i++) {
      userEmphasis[i] *= 0.5
    }
  }

  const onDrumChange = () => {
    const step = drumMachine.currentStep
    // Fire on beat boundaries (every 4 steps = quarter note in 16th-note grid)
    if (step % 4 === 0 && step !== lastStep) {
      lastStep = step
      selectChord()
    }
  }

  const computeDensity = () => {
    const now = performance.now()
    const recentNotes = noteTimestamps.filter((t) => now - t < 3000)
    setUserNoteDensity(recentNotes.length / 3)
  }

  const start = () => {
    if (playing()) return
    setPlaying(true)
    accumulatedNotes = []
    userEmphasis = new Array(12).fill(0)
    noteTimestamps = []
    lastStep = -1
    setChordHistory([])
    unsubDrum = drumMachine.onChange(onDrumChange)
    // Fire initial chord
    selectChord()
  }

  const stop = () => {
    if (!playing()) return
    setPlaying(false)
    if (unsubDrum !== null) {
      unsubDrum()
      unsubDrum = null
    }
    setSelectedChord(null)
    accumulatedNotes = []
    noteTimestamps = []
  }

  const handleFretNotePlayed = (midi: number) => {
    if (!playing()) return
    const pc = midi % 12
    accumulatedNotes.push(pc)
    userEmphasis[pc]++
    noteTimestamps.push(performance.now())

    // Trim old notes
    if (accumulatedNotes.length > 64) accumulatedNotes.shift()
    const now = performance.now()
    noteTimestamps = noteTimestamps.filter((t) => now - t < 5000)

    computeDensity()
  }

  return {
    currentChord,
    currentChordRoot,
    chordHistory,
    userNoteDensity,
    playing,
    handleFretNotePlayed,
    start,
    stop,
  }
}
