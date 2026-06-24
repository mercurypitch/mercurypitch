import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { MAX_FRET, OPEN_MIDI } from '@/lib/guitar/constants'

export interface NoteLocatorQuizState {
  targetMidiClass: Accessor<number>
  foundMidis: Accessor<Set<number>>
  handleNotePlayed: (midi: number) => boolean
  startRound: () => void
  score: Accessor<number>
  timeLeft: Accessor<number>
  roundActive: Accessor<boolean>
}

/** Create quiz state signals for wiring into canvas + inline HUD. */
export function createNoteLocatorQuiz(): NoteLocatorQuizState {
  const ROUND_TIME = 30
  const [targetMidiClass, setTargetMidiClass] = createSignal(0)
  const [foundMidis, setFoundMidis] = createSignal<Set<number>>(new Set())
  const [score, setScore] = createSignal(0)
  const [timeLeft, setTimeLeft] = createSignal(ROUND_TIME)
  const [roundActive, setRoundActive] = createSignal(false)

  let timerInterval: ReturnType<typeof setInterval> | null = null

  const totalPositions = () => {
    const target = targetMidiClass()

    const seen = new Set<number>()
    for (let s = 0; s < 6; s++)
      for (let f = 0; f <= MAX_FRET; f++) {
        const midi = OPEN_MIDI[s] + f
        if (midi % 12 === target) seen.add(midi)
      }
    return seen.size
  }

  const endRound = () => {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    setRoundActive(false)
    const found = foundMidis().size
    const total = totalPositions()
    const s = found === total ? score() + 100 : score()
    setScore(s)
  }

  const startRound = () => {
    const target = Math.floor(Math.random() * 12)
    setTargetMidiClass(target)
    setFoundMidis(new Set<number>())
    setTimeLeft(ROUND_TIME)
    setRoundActive(true)

    if (timerInterval !== null) clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endRound()
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  const handleNotePlayed = (midi: number): boolean => {
    if (!roundActive()) return false
    const target = targetMidiClass()
    if (midi % 12 !== target) return false

    const found = new Set(foundMidis())
    if (found.has(midi)) return false
    found.add(midi)
    setFoundMidis(found)
    setScore((s) => s + 10)

    if (found.size >= totalPositions()) {
      endRound()
    }
    return true
  }

  onCleanup(() => {
    if (timerInterval !== null) clearInterval(timerInterval)
  })

  return {
    targetMidiClass,
    foundMidis,
    handleNotePlayed,
    startRound,
    score,
    timeLeft,
    roundActive,
  }
}
