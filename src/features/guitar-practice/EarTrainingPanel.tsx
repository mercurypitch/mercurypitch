import type { Accessor, Setter } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { OPEN_MIDI } from '@/lib/guitar/constants'
import { midiToFreq } from '@/lib/scale-data'

export type EarDifficulty = 'easy' | 'medium' | 'hard'

const DIFFICULTY_RANGES: Record<
  EarDifficulty,
  { minFret: number; maxFret: number }
> = {
  easy: { minFret: 0, maxFret: 3 },
  medium: { minFret: 0, maxFret: 7 },
  hard: { minFret: 0, maxFret: 15 },
}

export interface EarTrainingState {
  targetMidi: Accessor<number | null>
  feedback: Accessor<'correct' | 'wrong' | null>
  streak: Accessor<number>
  accuracy: Accessor<number>
  difficulty: Accessor<EarDifficulty>
  setDifficulty: Setter<EarDifficulty>
  handleNotePlayed: (midi: number) => boolean
  playNewNote: () => void
}

/** Create ear training state signals for wiring into canvas + inline HUD. */
export function createEarTraining(audioEngine: AudioEngine): EarTrainingState {
  const [targetMidi, setTargetMidi] = createSignal<number | null>(null)
  const [feedback, setFeedback] = createSignal<'correct' | 'wrong' | null>(null)
  const [streak, setStreak] = createSignal(0)
  const [correctCount, setCorrectCount] = createSignal(0)
  const [totalCount, setTotalCount] = createSignal(0)
  const [difficulty, setDifficulty] = createSignal<EarDifficulty>('easy')

  let flashTimer: ReturnType<typeof setTimeout> | null = null

  const playNewNote = () => {
    const range = DIFFICULTY_RANGES[difficulty()]

    const options: number[] = []
    for (let s = 0; s < 6; s++)
      for (let f = range.minFret; f <= range.maxFret; f++) {
        options.push(OPEN_MIDI[s] + f)
      }
    const midi = options[Math.floor(Math.random() * options.length)]
    setTargetMidi(midi)
    setFeedback(null)
    const freq = midiToFreq(midi)
    audioEngine.playTone(freq, 800)
  }

  const handleNotePlayed = (midi: number): boolean => {
    const target = targetMidi()
    if (target === null) return false

    const isCorrect = midi === target
    setTotalCount((c) => c + 1)

    if (isCorrect) {
      setCorrectCount((c) => c + 1)
      setStreak((s) => s + 1)
      setFeedback('correct')
    } else {
      setStreak(0)
      setFeedback('wrong')
      audioEngine.playTone(midiToFreq(target), 600)
    }

    if (flashTimer !== null) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      playNewNote()
    }, 1200)

    return isCorrect
  }

  const accuracy = () => (totalCount() > 0 ? correctCount() / totalCount() : 0)

  onCleanup(() => {
    if (flashTimer !== null) clearTimeout(flashTimer)
  })

  return {
    targetMidi,
    feedback,
    streak,
    accuracy,
    difficulty,
    setDifficulty,
    handleNotePlayed,
    playNewNote,
  }
}
