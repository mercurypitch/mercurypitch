// ============================================================
// Falling Notes Store — Game state for Synthesia-style
// piano practice
// ============================================================

import { createSignal } from 'solid-js'

export type GameState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished'

export interface NoteJudgment {
  itemIndex: number
  midiNote: number
  noteName: string
  timing: 'perfect' | 'great' | 'good' | 'miss'
  pitchAccuracy: 'perfect' | 'excellent' | 'good' | 'okay' | 'off'
  score: number
  timestamp: number
}

export interface FallingNote {
  id: number
  midi: number
  name: string
  startBeat: number
  duration: number
  targetFreq: number
}

// ── Signals ─────────────────────────────────────────────────

export const [selectedSongId, setSelectedSongId] = createSignal<string | null>(null)
export const [gameState, setGameState] = createSignal<GameState>('idle')
export const [score, setScore] = createSignal(0)
export const [combo, setCombo] = createSignal(0)
export const [maxCombo, setMaxCombo] = createSignal(0)
export const [hitResults, setHitResults] = createSignal<NoteJudgment[]>([])
export const [totalNotes, setTotalNotes] = createSignal(0)
export const [notesMissed, setNotesMissed] = createSignal(0)
export const [currentSongBpm, setCurrentSongBpm] = createSignal(120)
export const [playheadBeat, setPlayheadBeat] = createSignal(0)
export const [songNotes, setSongNotes] = createSignal<FallingNote[]>([])
export const [selectedSongName, setSelectedSongName] = createSignal('')
export const [visibleBeatWindow, setVisibleBeatWindow] = createSignal(8)

// ── Actions ─────────────────────────────────────────────────

export function resetGame(): void {
  setGameState('idle')
  setScore(0)
  setCombo(0)
  setMaxCombo(0)
  setHitResults([])
  setTotalNotes(0)
  setNotesMissed(0)
  setPlayheadBeat(0)
  setSongNotes([])
  setSelectedSongName('')
}

export function startGame(): void {
  setGameState('countdown')
  setScore(0)
  setCombo(0)
  setMaxCombo(0)
  setHitResults([])
  setNotesMissed(0)
  setPlayheadBeat(-2) // 2-beat count-in
}

export function beginPlayback(): void {
  setGameState('playing')
  setPlayheadBeat(0)
}

export function pauseGame(): void {
  if (gameState() === 'playing') {
    setGameState('paused')
  }
}

export function resumeGame(): void {
  if (gameState() === 'paused') {
    setGameState('playing')
  }
}

export function finishGame(): void {
  setGameState('finished')
}

export function recordHit(judgment: NoteJudgment): void {
  setHitResults((prev) => [...prev, judgment])
  if (judgment.timing !== 'miss') {
    const newCombo = combo() + 1
    setCombo(newCombo)
    if (newCombo > maxCombo()) setMaxCombo(newCombo)
  } else {
    setCombo(0)
    setNotesMissed((n) => n + 1)
  }
  setScore((s) => s + judgment.score)
}

export function recordMiss(itemIndex: number, midiNote: number, noteName: string): void {
  const judgment: NoteJudgment = {
    itemIndex,
    midiNote,
    noteName,
    timing: 'miss',
    pitchAccuracy: 'off',
    score: 0,
    timestamp: Date.now(),
  }
  setHitResults((prev) => [...prev, judgment])
  setCombo(0)
  setNotesMissed((n) => n + 1)
}

export function advancePlayhead(delta: number): void {
  setPlayheadBeat((b) => b + delta)
}

export function loadSong(notes: FallingNote[], name: string, bpm: number): void {
  setSongNotes(notes)
  setSelectedSongName(name)
  setCurrentSongBpm(bpm)
  setTotalNotes(notes.length)
  resetGame()
}

export function beatsPerSecond(): number {
  return currentSongBpm() / 60
}
