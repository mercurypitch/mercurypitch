// ============================================================
// useFallingNotesController — Game logic for Synthesia-style
// piano practice
// ============================================================

import { createSignal, onCleanup } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { FallingNotesEngine } from '@/lib/falling-notes-engine'
import type { MidiNoteEvent } from '@/lib/midi-engine'
import { MidiEngine } from '@/lib/midi-engine'
import { centsToRating, ratingToScore } from '@/lib/practice-engine'
import { freqToMidi, midiToFreq, midiToNote } from '@/lib/scale-data'
import { setMicActive } from '@/stores'
import { countIn } from '@/stores'
import type { FallingNote, NoteJudgment } from '@/stores/falling-notes-store'
import {
  beatsPerSecond,
  clickPianoEnabled,
  combo,
  currentSongBpm,
  gameState,
  hitResults,
  inputMode,
  maxCombo,
  midiConnected,
  notesMissed,
  playheadBeat,
  score,
  setClickPianoEnabled,
  setCombo,
  setCurrentSongBpm,
  setGameState,
  setHitResults,
  setInputMode,
  setMaxCombo,
  setMidiConnected,
  setNotesMissed,
  setPlayheadBeat,
  setScore,
  setSelectedSongName,
  setShowNoteLabels,
  setSongNotes,
  setTotalNotes,
  setVisibleBeatWindow,
  showNoteLabels,
  songNotes,
  totalNotes,
  visibleBeatWindow,
} from '@/stores/falling-notes-store'
import type { AccuracyRating } from '@/types'

export type PianoPlayMode = 'once' | 'repeat'

const PERFECT_MS = 30
const GREAT_MS = 75
const GOOD_MS = 150

export function useFallingNotesController(audioEngine: AudioEngine) {
  const engine = new FallingNotesEngine(audioEngine)
  const midiEngine = new MidiEngine()

  const [currentPitch, setCurrentPitch] = createSignal<{
    frequency: number
    noteName: string
    octave: number
    cents: number
  } | null>(null)
  
  // Track if the user is actively holding a virtual key via mouse/touch
  let clickedMidi: number | null = null
  const [speed, setSpeed] = createSignal(1)
  const [micOn, setMicOn] = createSignal(false)
  const [isCountingIn, setIsCountingIn] = createSignal(false)
  const [countInBeatTracker, setCountInBeatTracker] = createSignal(0)

  // ── Practice repeat mode (mirrors Singing tab's Repeat mode) ──
  const [pianoPlayMode, setPianoPlayMode] = createSignal<PianoPlayMode>('once')
  const [pianoRepeatCycles, setPianoRepeatCycles] = createSignal(5)
  const [pianoCurrentCycle, setPianoCurrentCycle] = createSignal(1)

  let animFrameId: number | null = null
  let gameStartTime = 0
  let judgedNotes = new Set<number>()
  let playedNotes = new Set<number>()

  engine.callbacks.onMicStateChange = (active, _error) => {
    // Mic state changes are handled by the caller via isMicActive()
    void active
  }

  // MIDI callbacks — inject pitch data via the same currentPitch signal
  // AND play an audible tone so the user hears what they press.
  midiEngine.callbacks.onNoteOn = (e) => {
    const { name, octave } = midiToNote(e.midi)
    const freq = midiToFreq(e.midi)
    setCurrentPitch({
      frequency: freq,
      noteName: name,
      octave,
      cents: 0, // MIDI notes are exact — no cents deviation
    })
    // Play MIDI input tone directly (bypasses volume slider — always audible)
    // Uses a short default duration; the note will be cut by the next
    // noteOff or replaced by the next noteOn.
    void audioEngine.playTone(freq, 800)
  }

  midiEngine.callbacks.onNoteOff = () => {
    // If no more notes are held, clear pitch and stop the tone
    if (midiEngine.getHeldNotes().size === 0) {
      setCurrentPitch(null)
      audioEngine.stopTone(50) // short release to avoid clicks
    }
  }

  // ── RAF Game Loop ────────────────────────────────────────────

  const startLoop = () => {
    const loop = () => {
      // Detect pitch from mic (only in mic mode)
      if (inputMode() === 'mic') {
        // If the user is actively clicking a piano key, do not overwrite it with mic silence
        if (clickedMidi === null) {
          const pitch = engine.detectPitch()
          if (pitch) {
            setCurrentPitch({
              frequency: pitch.frequency,
              noteName: pitch.noteName,
              octave: pitch.octave,
              cents: pitch.cents,
            })
          } else {
            setCurrentPitch(null)
          }
        }
      }
      // MIDI mode: pitch is set synchronously by midiEngine callbacks

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
  onCleanup(() => {
    stopLoop()
    midiEngine.disconnect()
  })

  // ── Hit Detection ────────────────────────────────────────────
  // Visual layout: JUDGMENT_LINE_RATIO = KEYBOARD_START_RATIO = 0.85
  // Judgment and audio playback now happen at the same position (keyboard top).
  // No offset needed.
  const KEYBOARD_DELAY_FACTOR = 0

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

      // Audio plays when the note reaches the piano keyboard (85% h),
      // not the judgment line (82% h). The delay depends on zoom level.
      const keyboardDelayBeats = visibleBeatWindow() * KEYBOARD_DELAY_FACTOR
      if (!playedNotes.has(note.id) && deltaBeats <= -keyboardDelayBeats) {
        playedNotes.add(note.id)
        audioEngine.playTone(note.targetFreq, note.duration > 0 ? (note.duration / bps) * 1000 : 300)
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

    // Check if all notes are done AND playhead has passed the last note
    const maxEndBeat = Math.max(...notes.map((n) => n.startBeat + n.duration))
    if (judgedNotes.size >= notes.length && currentBeat >= maxEndBeat && notes.length > 0) {
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
      // Disconnect MIDI if it's connected — only one input mode at a time
      if (midiConnected()) midiDisconnect()
      setMicOn(true)
      setMicActive(true)
      setInputMode('mic')
    }
    return ok
  }

  const stopMic = () => {
    engine.stopMic()
    setMicOn(false)
    setMicActive(false)
  }

  const midiConnect = async (): Promise<boolean> => {
    const ok = await midiEngine.connect()
    if (ok) {
      // Stop mic if it's running — only one input mode at a time
      if (micOn()) stopMic()
      setInputMode('midi')
      setMidiConnected(true)
      setClickPianoEnabled(false)
    }
    return ok
  }

  const midiDisconnect = () => {
    midiEngine.disconnect()
    setCurrentPitch(null)
    setInputMode('mic')
    setMidiConnected(false)
    setClickPianoEnabled(true)
  }

  const clickPianoNoteOn = (midi: number) => {
    if (!clickPianoEnabled()) return
    clickedMidi = midi
    const { name, octave } = midiToNote(midi)
    const freq = midiToFreq(midi)
    setCurrentPitch({
      frequency: freq,
      noteName: name,
      octave,
      cents: 0,
    })
    // Play the clicked note so the user hears it
    void audioEngine.playTone(freq, 800)
  }

  const clickPianoNoteOff = () => {
    clickedMidi = null
    setCurrentPitch(null)
    audioEngine.stopTone(50)
  }

  const toggleClickPiano = () => {
    setClickPianoEnabled((v) => !v)
  }

  const startGame = async () => {
    // Eagerly initialize and resume AudioContext on game start.
    // This prevents the issue where audio is silent until the user
    // interacts with BPM/play/stop controls (which internally call
    // init/resume). User gesture (clicking Play) satisfies the
    // browser autoplay policy requirement.
    await audioEngine.init()
    await audioEngine.resume()

    judgedNotes = new Set<number>()
    playedNotes = new Set<number>()
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setHitResults([])
    setNotesMissed(0)

    const countInBeats = countIn()
    if (countInBeats > 0) {
      setGameState('countdown')
      setPlayheadBeat(-countInBeats)
      setIsCountingIn(true)

      const bps = beatsPerSecond() * speed()
      const beatMs = (1 / bps) * 1000
      let currentBeat = countInBeats

      const tick = () => {
        if (currentBeat > 0) {
          setCountInBeatTracker(currentBeat)
          setPlayheadBeat(-currentBeat)
        }
        if (currentBeat <= 0) {
          setIsCountingIn(false)
          setCountInBeatTracker(0)
          setGameState('playing')
          setPlayheadBeat(0)
          gameStartTime = performance.now()
          return
        }
        currentBeat--
        setTimeout(tick, beatMs)
      }
      setTimeout(tick, beatMs)
    } else {
      setGameState('playing')
      setPlayheadBeat(0)
      gameStartTime = performance.now()
    }
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
    // In repeat mode, check if we should auto-restart for the next cycle
    if (pianoPlayMode() === 'repeat') {
      const current = pianoCurrentCycle()
      const total = pianoRepeatCycles()
      if (current < total) {
        // Advance to next cycle and restart
        setPianoCurrentCycle(current + 1)
        judgedNotes = new Set<number>()
        playedNotes = new Set<number>()
        setScore(0)
        setCombo(0)
        setMaxCombo(0)
        setHitResults([])
        setNotesMissed(0)
        setPlayheadBeat(0)
        setGameState('playing')
        gameStartTime = performance.now()
        return
      }
      // Final cycle completed — reset cycle counter for next run
      setPianoCurrentCycle(1)
    }
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
    setNotesMissed(0)
    setPlayheadBeat(0)
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

  const setSpeedSafe = (newSpeed: number) => {
    // When speed changes during playback, rebase gameStartTime
    // to maintain beat continuity
    if (gameState() === 'playing') {
      const currentBeat = playheadBeat()
      const newBps = beatsPerSecond() * newSpeed
      gameStartTime = performance.now() - (currentBeat / newBps) * 1000
    }
    setSpeed(newSpeed)
  }

  const setBpmSafe = (newBpm: number) => {
    setCurrentSongBpm(newBpm)
    // Rebase gameStartTime so playhead doesn't jump
    if (gameState() === 'playing') {
      const currentBeat = playheadBeat()
      const newBps = (newBpm / 60) * speed()
      gameStartTime = performance.now() - (currentBeat / newBps) * 1000
    }
  }

  const ZOOM_MIN = 2
  const ZOOM_MAX = 24
  const ZOOM_STEP = 1

  const zoomIn = () => {
    setVisibleBeatWindow(Math.max(ZOOM_MIN, visibleBeatWindow() - ZOOM_STEP))
  }

  const zoomOut = () => {
    setVisibleBeatWindow(Math.min(ZOOM_MAX, visibleBeatWindow() + ZOOM_STEP))
  }

  const zoomPercent = () => {
    return Math.round((8 / visibleBeatWindow()) * 100)
  }

  const toggleNoteLabels = () => {
    setShowNoteLabels((v) => !v)
  }

  const midiHeldNotes = (): MidiNoteEvent[] => {
    return Array.from(midiEngine.getHeldNotes().values())
  }

  return {
    // Signals
    gameState,
    score,
    combo,
    currentSongBpm,
    maxCombo,
    hitResults,
    totalNotes,
    notesMissed,
    currentPitch,
    songNotes,
    playheadBeat,
    visibleBeatWindow,

    // Count-in signals
    isCountingIn,
    countInBeat: countInBeatTracker,

    // Practice repeat mode
    pianoPlayMode,
    setPianoPlayMode,
    pianoRepeatCycles,
    setPianoRepeatCycles,
    pianoCurrentCycle,
    setPianoCurrentCycle,

    // Actions
    startMic,
    stopMic,
    isMicActive: micOn,
    midiConnect,
    midiDisconnect,
    midiHeldNotes,
    clickPianoEnabled,
    clickPianoNoteOn,
    clickPianoNoteOff,
    toggleClickPiano,
    inputMode,
    midiConnected,
    startGame,
    pauseGame,
    resumeGame,
    finishGame,
    resetGame,
    loadSong,
    speed,
    setSpeed: setSpeedSafe,
    zoomIn,
    zoomOut,
    zoomPercent,
    showNoteLabels,
    toggleNoteLabels,
    setBpm: setBpmSafe,

    // Engine (for waveform display)
    engine,
  }
}
