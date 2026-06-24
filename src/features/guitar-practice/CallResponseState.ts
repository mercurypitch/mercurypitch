import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { generateGuitarPhrase, SequenceTimer } from '@/lib/guitar/phrase-utils'
import { KEY_OFFSETS, midiToFreq, SCALE_DEFINITIONS } from '@/lib/scale-data'

export type CallResponsePhase =
  | 'idle'
  | 'callPlaying'
  | 'callEcho'
  | 'responsePlaying'
  | 'responseImprov'
  | 'feedback'

export interface CallResponseState {
  phase: Accessor<CallResponsePhase>
  callNotes: Accessor<number[]>
  responseNotes: Accessor<number[]>
  userEchoNotes: Accessor<number[]>
  userImprovNotes: Accessor<number[]>
  echoResults: Accessor<Array<'correct' | 'wrong' | 'pending'>>
  improvScore: Accessor<number>
  totalScore: Accessor<number>
  handleNotePlayed: (midi: number) => boolean
  startRound: () => void
  finishEcho: () => void
  finishImprov: () => void
  skipRound: () => void
}

function generateResponse(
  key: string,
  scale: string,
  callNotes: number[],
): number[] {
  // Generate a variation — same length, same scale, different notes
  const phrase = generateGuitarPhrase(key, scale, callNotes.length)
  // Ensure at least one note is different from the call
  if (phrase.every((n, i) => n % 12 === callNotes[i] % 12)) {
    phrase[phrase.length - 1] = phrase[phrase.length - 1] + 2
  }
  return phrase
}

export function createCallResponse(
  audioEngine: AudioEngine,
  key: () => string,
  scale: () => string,
): CallResponseState {
  const [phase, setPhase] = createSignal<CallResponsePhase>('idle')
  const [callNotes, setCallNotes] = createSignal<number[]>([])
  const [responseNotes, setResponseNotes] = createSignal<number[]>([])
  const [userEchoNotes, setUserEchoNotes] = createSignal<number[]>([])
  const [userImprovNotes, setUserImprovNotes] = createSignal<number[]>([])
  const [echoResults, setEchoResults] = createSignal<
    Array<'correct' | 'wrong' | 'pending'>
  >([])
  const [improvScore, setImprovScore] = createSignal(0)
  const [totalScore, setTotalScore] = createSignal(0)

  const timers = new SequenceTimer()

  const playSequence = (notes: number[], onDone: () => void, gapMs: number) => {
    for (let i = 0; i < notes.length; i++) {
      timers.schedule(() => {
        audioEngine.playTone(midiToFreq(notes[i]), 400)
      }, i * gapMs)
    }
    timers.schedule(onDone, notes.length * gapMs + 200)
  }

  const startRound = () => {
    timers.clear()
    const k = key()
    const s = scale()
    const phraseLen = 3 + Math.floor(Math.random() * 2)
    const call = generateGuitarPhrase(k, s, phraseLen)
    const resp = generateResponse(k, s, call)

    setCallNotes(call)
    setResponseNotes(resp)
    setUserEchoNotes([])
    setUserImprovNotes([])
    setEchoResults(new Array(call.length).fill('pending'))
    setImprovScore(0)

    // Phase 1: Play the call
    setPhase('callPlaying')
    playSequence(
      call,
      () => {
        setPhase('callEcho')
      },
      500,
    )
  }

  const handleNotePlayed = (midi: number): boolean => {
    const p = phase()

    if (p === 'callEcho') {
      const call = callNotes()
      const idx = userEchoNotes().length
      if (idx >= call.length) return false

      const isCorrect = midi % 12 === call[idx] % 12
      setUserEchoNotes((prev) => [...prev, midi])

      const results = [...echoResults()]
      results[idx] = isCorrect ? 'correct' : 'wrong'
      setEchoResults(results)

      if (isCorrect) {
        audioEngine.playTone(midiToFreq(midi), 300)
        setTotalScore((s) => s + 10)
      } else {
        audioEngine.playTone(220, 150)
      }

      if (
        results.length === call.length &&
        results.every((r) => r === 'correct')
      ) {
        setTotalScore((s) => s + 30)
      }
      return isCorrect
    }

    if (p === 'responseImprov') {
      // Free improvisation — any note counts, score based on being in key/scale
      const k = key()
      const sref = SCALE_DEFINITIONS[scale()]
      const rootOffset = KEY_OFFSETS[k] ?? 0
      const degrees = sref.degrees
      const degree = (((midi - rootOffset) % 12) + 12) % 12

      const inScale = degrees.includes(degree) || degrees.includes(degree + 12)
      setUserImprovNotes((prev) => [...prev, midi])

      if (inScale) {
        audioEngine.playTone(midiToFreq(midi), 300)
        setImprovScore((s) => s + 5)
        setTotalScore((s) => s + 5)
      } else {
        audioEngine.playTone(220, 100)
      }
      return inScale
    }

    return false
  }

  const finishEcho = () => {
    // Play the response phrase
    setPhase('responsePlaying')
    const resp = responseNotes()
    playSequence(
      resp,
      () => {
        setPhase('responseImprov')
        setUserImprovNotes([])
      },
      500,
    )
  }

  const finishImprov = () => {
    timers.clear()
    const bonus = userImprovNotes().length >= responseNotes().length ? 20 : 0
    if (bonus > 0) setTotalScore((s) => s + bonus)
    setPhase('feedback')
    timers.scheduleFeedback(() => {
      startRound()
    }, 2500)
  }

  const skipRound = () => {
    timers.clear()
    setEchoResults(callNotes().map(() => 'wrong'))
    setPhase('feedback')
    timers.scheduleFeedback(() => {
      startRound()
    }, 2500)
  }

  onCleanup(() => {
    timers.clear()
  })

  return {
    phase,
    callNotes,
    responseNotes,
    userEchoNotes,
    userImprovNotes,
    echoResults,
    improvScore,
    totalScore,
    handleNotePlayed,
    startRound,
    finishEcho,
    finishImprov,
    skipRound,
  }
}
