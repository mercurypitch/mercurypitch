// ============================================================
// useFallingNotesController — Game logic for Synthesia-style
// piano practice
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { FallingNotesEngine } from '@/lib/falling-notes-engine'
import { freqToMidi } from '@/lib/scale-data'
import { centsToRating, ratingToScore } from '@/lib/practice-engine'
import type { AccuracyRating } from '@/types'
import type { FallingNote, NoteJudgment } from '@/stores/falling-notes-store'
import { setMicActive } from '@/stores'
import {
  gameState,
  setGameState,
  score,
  setScore,
  combo,
  setCombo,
  maxCombo,
  setMaxCombo,
  hitResults,
  setHitResults,
  totalNotes,
  setTotalNotes,
  notesMissed,
  setNotesMissed,
  playheadBeat,
  setPlayheadBeat,
  songNotes,
  setSongNotes,
  setSelectedSongName,
  currentSongBpm,
  setCurrentSongBpm,
  beatsPerSecond,
} from '@/stores/falling-notes-store'

const PERFECT_MS = 30
const GREAT_MS = 75
const GOOD_MS = 150

export function useFallingNotesController(audioEngine: AudioEngine) {
  const engine = new FallingNotesEngine(audioEngine)
  const [currentPitch, setCurrentPitch] = createSignal<{
    frequency: number
    noteName: string
    octave: number
    cents: number
  } | null>(null)
  const [speed, setSpeed] = createSignal(1)
  const [micOn, setMicOn] = createSignal(false)

  let animFrameId: number | null = null
  let gameStartTime = 0
  let judgedNotes = new Set<number>()
  let playedNotes = new Set<number>()

  engine.callbacks.onMicStateChange = (active, _error) => {
    // Mic state changes are handled by the caller via isMicActive()
    void active
  }

  // ── RAF Game Loop ────────────────────────────────────────────

  const startLoop = () => {
    const loop = () => {
      // Detect pitch
      const pitch = engine.detectPitch()
      if (pitch) {
        const midi = freqToMidi(pitch.frequency)
        setCurrentPitch({
          frequency: pitch.frequency,
          noteName: pitch.noteName,
          octave: pitch.octave,
          cents: pitch.cents,
        })
      } else {
        setCurrentPitch(null)
      }

      // Advance playhead if playing
      if (gameState() === 'playing') {
        const now = performance.now()
        const elapsedMs = now - gameStartTime
        const bps = beatsPerSecond() * speed()
        const elapsedBeats = elapsedMs / 1000 * bps
        const newBeat = elapsedBeats
        setPlayheadBeat(newBeat)

        // Check hits/misses
        checkHits(newBeat)
      }

      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  const stopLoop = () => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  }

  // Start the loop immediately
  startLoop()
  onCleanup(stopLoop)

  // ── Hit Detection ────────────────────────────────────────────

  const checkHits = (currentBeat: number) => {
    const notes = songNotes()
    const bps = beatsPerSecond() * speed()
    const pitch = currentPitch()
    const detectedMidi = pitch ? freqToMidi(pitch.frequency) : null
    const detectedCents = pitch?.cents ?? null

    for (const note of notes) {
      if (judgedNotes.has(note.id)) continue

      const deltaBeats = note.startBeat - currentBeat
      const deltaMs = (deltaBeats / bps) * 1000

      // Play audio when note reaches the judgment line
      if (!playedNotes.has(note.id) && deltaMs <= 0) {
        playedNotes.add(note.id)
        audioEngine.playTone(note.targetFreq, note.duration > 0 ? note.duration / bps : 0.3)
      }

      // Note has passed the max timing window — miss
      if (deltaMs < -GOOD_MS) {
        recordMiss(note)
        continue
      }

      // Note is within timing window — check pitch
      if (Math.abs(deltaMs) <= GOOD_MS) {
        if (detectedMidi === note.midi) {
          recordHit(note, Math.abs(deltaMs), detectedCents)
        }
        // If wrong pitch or no pitch, don't miss yet — wait until window closes
      }
    }

    // Check if all notes are done
    if (judgedNotes.size >= notes.length && notes.length > 0) {
      finishGame()
    }
  }

  const recordHit = (
    note: FallingNote,
    deltaMs: number,
    cents: number | null,
  ) => {
    // Timing rating
    let timing: NoteJudgment['timing']
    if (deltaMs <= PERFECT_MS) timing = 'perfect'
    else if (deltaMs <= GREAT_MS) timing = 'great'
    else timing = 'good'

    // Pitch accuracy rating
    const pitchRating: AccuracyRating = cents !== null
      ? centsToRating(Math.abs(cents))
      : 'perfect'

    const timingScore = timing === 'perfect' ? 100 : timing === 'great' ? 75 : 50
    const pitchScore = ratingToScore(pitchRating)
    const finalScore = Math.round(timingScore * 0.6 + pitchScore * 0.4)

    const judgment: NoteJudgment = {
      itemIndex: note.id,
      midiNote: note.midi,
      noteName: note.name,
      timing,
      pitchAccuracy: pitchRating,
      score: finalScore,
      timestamp: Date.now(),
    }

    judgedNotes.add(note.id)
    setHitResults((prev) => [...prev, judgment])
    setScore((s) => s + finalScore)
    const newCombo = combo() + 1
    setCombo(newCombo)
    if (newCombo > maxCombo()) setMaxCombo(newCombo)
  }

  const recordMiss = (note: FallingNote) => {
    judgedNotes.add(note.id)
    const judgment: NoteJudgment = {
      itemIndex: note.id,
      midiNote: note.midi,
      noteName: note.name,
      timing: 'miss',
      pitchAccuracy: 'off',
      score: 0,
      timestamp: Date.now(),
    }
    setHitResults((prev) => [...prev, judgment])
    setCombo(0)
    setNotesMissed((n) => n + 1)
  }

  // ── Actions ──────────────────────────────────────────────────

  const startMic = async (): Promise<boolean> => {
    const ok = await engine.startMic()
    if (ok) {
      setMicOn(true)
      setMicActive(true)
    }
    return ok
  }

  const stopMic = () => {
    engine.stopMic()
    setMicOn(false)
    setMicActive(false)
  }

  const startGame = () => {
    judgedNotes = new Set<number>()
    playedNotes = new Set<number>()
    setGameState('countdown')
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setHitResults([])
    setNotesMissed(0)
    setPlayheadBeat(-2)

    // After 2-beat count-in, begin
    const bps = beatsPerSecond() * speed()
    const countdownMs = (2 / bps) * 1000
    setTimeout(() => {
      setGameState('playing')
      setPlayheadBeat(0)
      gameStartTime = performance.now()
    }, countdownMs)
  }

  const pauseGame = () => {
    if (gameState() === 'playing') {
      setGameState('paused')
      // Store current beat so we can resume from here
      const pausedBeat = playheadBeat()
      setPlayheadBeat(pausedBeat)
    }
  }

  const resumeGame = () => {
    if (gameState() === 'paused') {
      setGameState('playing')
      // Rebase gameStartTime so playhead continues from where we paused
      const currentBeat = playheadBeat()
      const bps = beatsPerSecond() * speed()
      gameStartTime = performance.now() - (currentBeat / bps) * 1000
    }
  }

  const finishGame = () => {
    setGameState('finished')
  }

  const resetGame = () => {
    stopLoop()
    judgedNotes = new Set<number>()
    playedNotes = new Set<number>()
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
    startLoop()
  }

  const loadSong = (notes: FallingNote[], name: string, bpm: number) => {
    judgedNotes = new Set<number>()
    playedNotes = new Set<number>()
    setSongNotes(notes)
    setSelectedSongName(name)
    setCurrentSongBpm(bpm)
    setTotalNotes(notes.length)
    setGameState('idle')
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setHitResults([])
    setNotesMissed(0)
    setPlayheadBeat(0)
  }

  return {
    // Signals
    gameState,
    score,
    combo,
    maxCombo,
    hitResults,
    totalNotes,
    notesMissed,
    currentPitch,
    songNotes,
    playheadBeat,

    // Actions
    startMic,
    stopMic,
    isMicActive: micOn,
    startGame,
    pauseGame,
    resumeGame,
    finishGame,
    resetGame,
    loadSong,
    speed,
    setSpeed,
    setBpm: setCurrentSongBpm,

    // Engine (for waveform display)
    engine,
  }
}
