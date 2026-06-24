import type { Accessor, Setter } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { generateGuitarPhrase, SequenceTimer } from '@/lib/guitar/phrase-utils'
import { midiToFreq } from '@/lib/scale-data'

export type TranscriptionPhase = 'idle' | 'playing' | 'listening' | 'feedback'

export interface MelodyTranscriptionState {
  targetNotes: Accessor<number[]>
  userNotes: Accessor<number[]>
  phase: Accessor<TranscriptionPhase>
  currentNoteIndex: Accessor<number>
  noteResults: Accessor<Array<'correct' | 'wrong' | 'pending'>>
  score: Accessor<number>
  phraseLength: Accessor<number>
  setPhraseLength: Setter<number>
  handleNotePlayed: (midi: number) => boolean
  startNewPhrase: () => void
  skipPhrase: () => void
}

export function createMelodyTranscription(
  audioEngine: AudioEngine,
  key: () => string,
  scale: () => string,
): MelodyTranscriptionState {
  const [targetNotes, setTargetNotes] = createSignal<number[]>([])
  const [userNotes, setUserNotes] = createSignal<number[]>([])
  const [phase, setPhase] = createSignal<TranscriptionPhase>('idle')
  const [currentNoteIndex, setCurrentNoteIndex] = createSignal(0)
  const [noteResults, setNoteResults] = createSignal<
    Array<'correct' | 'wrong' | 'pending'>
  >([])
  const [score, setScore] = createSignal(0)
  const [phraseLength, setPhraseLength] = createSignal(3)

  const timers = new SequenceTimer()

  const playPhrase = () => {
    const notes = targetNotes()
    if (notes.length === 0) return

    setPhase('playing')
    setCurrentNoteIndex(0)

    for (let i = 0; i < notes.length; i++) {
      timers.schedule(() => {
        setCurrentNoteIndex(i)
        audioEngine.playTone(midiToFreq(notes[i]), 400)
      }, i * 500)
    }

    timers.schedule(
      () => {
        setPhase('listening')
        setUserNotes([])
        setCurrentNoteIndex(0)
      },
      notes.length * 500 + 200,
    )
  }

  const startNewPhrase = () => {
    timers.clear()
    const count = phraseLength()
    const melody = generateGuitarPhrase(key(), scale(), count)
    setTargetNotes(melody)
    setUserNotes([])
    setNoteResults(new Array(melody.length).fill('pending'))
    setCurrentNoteIndex(0)
    playPhrase()
  }

  const skipPhrase = () => {
    timers.clear()
    const targets = targetNotes()
    setNoteResults(new Array(targets.length).fill('wrong'))
    showFeedback()
  }

  const showFeedback = () => {
    setPhase('feedback')
    // eslint-disable-next-line solid/reactivity -- external setTimeout callback
    timers.scheduleFeedback(() => {
      startNewPhrase()
    }, 2000)
  }

  const handleNotePlayed = (midi: number): boolean => {
    if (phase() !== 'listening') return false

    const targets = targetNotes()
    const idx = userNotes().length
    if (idx >= targets.length) return false

    const isCorrect = midi % 12 === targets[idx] % 12
    const updated = [...userNotes(), midi]
    setUserNotes(updated)

    const results = [...noteResults()]
    results[idx] = isCorrect ? 'correct' : 'wrong'
    setNoteResults(results)

    if (isCorrect) {
      audioEngine.playTone(midiToFreq(midi), 300)
      setScore((s) => s + 20)
    } else {
      audioEngine.playTone(220, 150)
    }

    if (updated.length >= targets.length) {
      const allCorrect = results.every((r) => r === 'correct')
      if (allCorrect) setScore((s) => s + 50)
      showFeedback()
    }

    return isCorrect
  }

  onCleanup(() => {
    timers.clear()
  })

  return {
    targetNotes,
    userNotes,
    phase,
    currentNoteIndex,
    noteResults,
    score,
    phraseLength,
    setPhraseLength,
    handleNotePlayed,
    startNewPhrase,
    skipPhrase,
  }
}
