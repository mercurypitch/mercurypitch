// ============================================================
// useGuitarPracticeController — Guitar Hero-style game logic
// ============================================================

import { createEffect, createSignal, onCleanup } from 'solid-js'
import type { AudioEngine, InstrumentType } from '@/lib/audio-engine'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { melodyToGuitarNotes } from '@/lib/guitar/guitar-synth'
import { MidiEngine } from '@/lib/midi-engine'
import { NOTE_NAMES } from '@/lib/note-utils'
import { PitchDetector } from '@/lib/pitch-detector'
import { midiToFreq } from '@/lib/scale-data'
import { countIn, setMicActive } from '@/stores'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { updateMidiSongSelection } from '@/stores/saved-midi-songs-store'

export interface GuitarGameState {
  idle: 'idle'
  countdown: 'countdown'
  playing: 'playing'
  paused: 'paused'
  finished: 'finished'
}

const PERFECT_MS = 30
const GREAT_MS = 75
const GOOD_MS = 150

export interface GuitarHitResult {
  itemIndex: string
  midiNote: number
  noteName: string
  stringIndex: number
  timing: 'perfect' | 'great' | 'good' | 'miss'
  score: number
  timestamp: number
}

export function useGuitarPracticeController(audioEngine: AudioEngine) {
  const [fallingNotes, setFallingNotes] = createSignal<GuitarNote[]>([])
  const [gameState, setGameState] = createSignal<keyof GuitarGameState>('idle')
  const [playheadBeat, setPlayheadBeat] = createSignal(0)
  const [hitResults, setHitResults] = createSignal<GuitarHitResult[]>([])
  const [combo, setCombo] = createSignal(0)
  const [maxCombo, setMaxCombo] = createSignal(0)
  const [score, setScore] = createSignal(0)
  const [totalNotes, setTotalNotes] = createSignal(0)
  const [notesMissed, setNotesMissed] = createSignal(0)
  const [visibleBeatWindow, setVisibleBeatWindow] = createSignal(8)
  const [showNoteLabels, setShowNoteLabels] = createSignal(true)
  const [songBpm, setSongBpm] = createSignal(120)
  const [selectedSongName, setSelectedSongName] = createSignal('')
  const [instrumentType, setInstrumentType] =
    createSignal<InstrumentType>('guitar-acoustic')
  const [detectedMidi, setDetectedMidi] = createSignal<number | null>(null)
  const [detectedClarity, setDetectedClarity] = createSignal(0)
  const [showUserNotes, setShowUserNotes] = createSignal(true)
  const [inputMode, setInputMode] = createSignal<'keyboard' | 'mic' | 'midi'>(
    'keyboard',
  )
  const [micOn, setMicOn] = createSignal(false)
  const [midiConnected, setMidiConnected] = createSignal(false)
  const [currentSong, setCurrentSong] = createSignal<SavedMidiSong | null>(null)
  const [mutedTrackIds, setMutedTrackIds] = createSignal<Set<string>>(new Set())
  const [visibleTrackIds, setVisibleTrackIds] = createSignal<Set<string>>(
    new Set(),
  )
  const [totalBeats, setTotalBeats] = createSignal(0)

  const midiEngine = new MidiEngine()

  midiEngine.callbacks.onNoteOn = (e) => {
    articulationId++
    setDetectedMidi(e.midi)
    setDetectedClarity(1.0)
    void audioEngine.playTone(midiToFreq(e.midi), 500)
  }

  midiEngine.callbacks.onNoteOff = () => {
    if (midiEngine.getHeldNotes().size === 0) {
      setDetectedMidi(null)
      setDetectedClarity(0)
    }
  }

  const startMic = async (): Promise<boolean> => {
    const ok = await audioEngine.startMic()
    if (ok) {
      // The audio context is now guaranteed to be created and running, so we can reliably get the hardware sample rate
      pitchDetector = new PitchDetector({
        sampleRate: audioEngine.audioCtx?.sampleRate ?? 44100,
      })
      if (midiConnected()) midiDisconnect()
      setMicOn(true)
      setMicActive(true)
      setInputMode('mic')
    }
    return ok
  }

  const stopMic = () => {
    audioEngine.stopMic()
    setMicOn(false)
    setMicActive(false)
    if (inputMode() === 'mic') setInputMode('keyboard')
  }

  const midiConnect = async (): Promise<boolean> => {
    const ok = await midiEngine.connect()
    if (ok) {
      if (micOn()) stopMic()
      setInputMode('midi')
      setMidiConnected(true)
    }
    return ok
  }

  const midiDisconnect = () => {
    midiEngine.disconnect()
    if (inputMode() === 'midi') setInputMode('keyboard')
    setMidiConnected(false)
  }

  // Keep audio engine in sync with selected instrument
  createEffect(() => {
    audioEngine.setInstrument(instrumentType())
  })

  let pitchDetector = new PitchDetector({
    sampleRate: audioEngine.audioCtx?.sampleRate ?? 44100,
  })
  let animFrameId: number | null = null
  let gameStartTime = 0
  let judgedIndices = new Set<string>()
  let audioJudgedIndices = new Set<string>()
  let playedIndices = new Set<string>()
  let countInTicks = 0

  // ── Articulation tracking ────────────────────────────────────
  // Each distinct "note event" from the player (new pitch, MIDI note-on,
  // or a fresh pick attack detected as an amplitude onset) bumps this
  // counter. A single articulation can score at most one hit, so a
  // sustained note can't eat a run of consecutive same-pitch targets.
  let articulationId = 0
  let lastHitArticulationId = -1
  let heldMidi: number | null = null
  let silentFrames = 0
  let smoothedRms = 0

  const toggleTrackMute = (trackId: string) => {
    const song = currentSong()
    if (!song) return

    const nextMuted = new Set(mutedTrackIds())
    if (nextMuted.has(trackId)) {
      nextMuted.delete(trackId)
    } else {
      nextMuted.add(trackId)
    }
    setMutedTrackIds(nextMuted)

    // Update backingTrackIds (unmuted tracks) and persist
    const newBackingTrackIds = song.tracks
      .filter((t) => t.id !== song.scoreTrackId && !nextMuted.has(t.id))
      .map((t) => t.id)

    // Update current song object reactively
    const updatedSong = {
      ...song,
      backingTrackIds: newBackingTrackIds,
    }
    setCurrentSong(updatedSong)

    // Persist to store
    updateMidiSongSelection(song.id, song.scoreTrackId, newBackingTrackIds)
  }

  const toggleTrackVisibility = (trackId: string) => {
    const song = currentSong()
    if (!song) return

    const nextVisible = new Set(visibleTrackIds())
    if (nextVisible.has(trackId)) {
      if (trackId === song.scoreTrackId) return
      nextVisible.delete(trackId)
    } else {
      nextVisible.add(trackId)
    }
    setVisibleTrackIds(nextVisible)
  }

  // Combine scored track notes and other visible backing track notes
  createEffect(() => {
    const song = currentSong()
    if (!song) return

    const scoreTrack =
      song.tracks.find((t) => t.id === song.scoreTrackId) ?? song.tracks[0]
    const activeScoreNotes =
      scoreTrack !== undefined ? melodyToGuitarNotes(scoreTrack.notes) : []

    const otherVisibleNotes: GuitarNote[] = []
    const visibleIds = visibleTrackIds()
    for (const t of song.tracks) {
      if (t.id === song.scoreTrackId) continue
      if (!visibleIds.has(t.id)) continue

      const mapped = melodyToGuitarNotes(t.notes)
      for (const n of mapped) {
        n.isBacking = true
        n.trackId = t.id
        otherVisibleNotes.push(n)
      }
    }

    const combined = [...activeScoreNotes, ...otherVisibleNotes]
    combined.sort((a, b) => a.startBeat - b.startBeat)

    setFallingNotes(combined)
    setTotalNotes(activeScoreNotes.length)
  })

  // Backing tracks (from multi-track MIDI imports): played as audio when
  // they cross the playhead, but never displayed or scored.
  let backingNotes: Array<{
    freq: number
    startBeat: number
    duration: number
    trackId?: string
  }> = []
  let playedBackingIndices = new Set<number>()

  // ── RAF Game Loop ────────────────────────────────────────────
  // Only runs while gameState is 'playing' or 'countdown'.
  // Stops itself when the game transitions to idle / finished so
  // we don't waste a requestAnimationFrame callback every frame.

  const startLoop = () => {
    if (animFrameId !== null) return // already running
    const loop = () => {
      const state = gameState()

      if (state === 'playing' || state === 'countdown') {
        const now = performance.now()
        const elapsedMs = now - gameStartTime
        const bps = songBpm() / 60
        const elapsedBeats = (elapsedMs / 1000) * bps

        const countInBeats = countIn()
        const newBeat =
          state === 'countdown' ? elapsedBeats - countInBeats : elapsedBeats

        setPlayheadBeat(newBeat)

        if (state === 'playing') {
          checkHits(newBeat)
        }

        // Countdown tick sounds
        if (state === 'countdown') {
          const currentTick = Math.floor(elapsedBeats)
          if (currentTick > countInTicks && currentTick <= countInBeats) {
            countInTicks = currentTick
            // Route through the engine's metronome bus so the precount
            // click respects the metronome volume (a raw ctx.destination
            // click at low gain was nearly inaudible).
            audioEngine.playClick()
          }
          if (elapsedBeats >= countInBeats) {
            setGameState('playing')
            gameStartTime = performance.now()
            setPlayheadBeat(0)
          }
        }

        animFrameId = requestAnimationFrame(loop)
      } else {
        // Game is idle / finished / paused without resume —
        // stop looping until startGame() restarts us.
        animFrameId = null
      }
    }
    animFrameId = requestAnimationFrame(loop)
  }

  const stopLoop = () => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
  }

  onCleanup(() => {
    stopLoop()
    midiEngine.disconnect()
  })

  // ── Pitch detection helper ────────────────────────────────────

  const computeMidi = (freq: number): number | null => {
    if (freq <= 0) return null
    return Math.round(69 + 12 * Math.log2(freq / 440))
  }

  // ── Hit Detection ────────────────────────────────────────────

  const checkHits = (currentBeat: number) => {
    const notes = fallingNotes()
    const bps = songBpm() / 60

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      if (note.isBacking === true) continue
      if (judgedIndices.has(note.id)) continue

      const deltaBeats = note.startBeat - currentBeat

      // Audio plays when the note reaches the strum zone
      if (!playedIndices.has(note.id) && deltaBeats <= 0) {
        playedIndices.add(note.id)
        audioEngine.playNote(
          note.targetFreq,
          Math.max(50, (note.duration / bps) * 1000),
        )
      }

      // Miss: note passed the timing window AND its duration
      const endBeats = note.startBeat + note.duration - currentBeat
      const endMs = (endBeats / bps) * 1000

      if (endMs < -GOOD_MS) {
        recordMiss(note)
        continue
      }
    }

    // Backing tracks: trigger audio as each note crosses the playhead
    for (let i = 0; i < backingNotes.length; i++) {
      if (playedBackingIndices.has(i)) continue
      const b = backingNotes[i]
      const delta = b.startBeat - currentBeat
      if (delta <= 0) {
        playedBackingIndices.add(i)
        // Skip notes far in the past (e.g. after resume) instead of
        // blasting them all at once.
        if (delta > -1) {
          if (b.trackId !== undefined && mutedTrackIds().has(b.trackId)) {
            continue
          }
          void audioEngine.playNote(
            b.freq,
            Math.max(50, (b.duration / bps) * 1000),
          )
        }
      }
    }

    // ── Input pitch detection has been moved to a continuous effect loop ──

    const currentDetectedMidi = detectedMidi()
    const mode = inputMode()
    if (
      currentDetectedMidi !== null &&
      (mode === 'mic' || mode === 'midi') &&
      // One hit per articulation — the player must re-pick (or play a new
      // pitch) before the next note can be scored.
      articulationId !== lastHitArticulationId
    ) {
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i]
        if (note.isBacking === true) continue
        if (audioJudgedIndices.has(note.id) || judgedIndices.has(note.id))
          continue
        const deltaBeats = note.startBeat - currentBeat
        const deltaMs = (deltaBeats / bps) * 1000

        const endBeats = note.startBeat + note.duration - currentBeat
        const endMs = (endBeats / bps) * 1000

        // MIDI input reports exact pitches; mic detection is octave-tolerant
        // because string harmonics often confuse the detected octave.
        const pitchMatches =
          mode === 'midi'
            ? currentDetectedMidi === note.midi
            : currentDetectedMidi % 12 === note.midi % 12

        // Allow hitting the note if we are anywhere between (start - GOOD_MS) and (end + GOOD_MS)
        if (deltaMs <= GOOD_MS && endMs >= -GOOD_MS && pitchMatches) {
          audioJudgedIndices.add(note.id)
          lastHitArticulationId = articulationId
          // Score based on how close they were to the start, but capped at GOOD_MS so they at least get 'good' if they sustain
          recordHit(note, Math.min(Math.max(0, Math.abs(deltaMs)), GOOD_MS))
          break
        }
      }
    }

    // Check if all notes are done
    const scoredNotesCount = notes.filter((n) => n.isBacking !== true).length
    if (judgedIndices.size >= scoredNotesCount && scoredNotesCount > 0) {
      const maxEnd = Math.max(
        ...notes
          .filter((n) => n.isBacking !== true)
          .map((n) => n.startBeat + n.duration),
      )
      if (currentBeat >= maxEnd) {
        finishGame()
      }
    }
  }

  // ── Input handlers ───────────────────────────────────────────

  const strumString = (stringIndex: number) => {
    const state = gameState()
    if (state !== 'playing') return

    const notes = fallingNotes()
    const currentBeat = playheadBeat()
    const bps = songBpm() / 60

    // Find the closest unjudged note on this string within the timing window
    let bestIndex = -1
    let bestDelta = Infinity

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      if (note.isBacking === true) continue
      if (judgedIndices.has(note.id)) continue
      if (note.stringIndex !== stringIndex) continue

      const deltaBeats = note.startBeat - currentBeat
      const deltaMs = (deltaBeats / bps) * 1000

      if (Math.abs(deltaMs) <= GOOD_MS && Math.abs(deltaMs) < bestDelta) {
        bestDelta = Math.abs(deltaMs)
        bestIndex = i
      }
    }

    if (bestIndex >= 0) {
      recordHit(notes[bestIndex], bestDelta)
    }
  }

  const strumKeyboard = (e: KeyboardEvent) => {
    const keyMap: Record<string, number> = {
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
      '5': 4,
      '6': 5,
      a: 0,
      s: 1,
      d: 2,
      f: 3,
      g: 4,
      h: 5,
    }
    const idx = keyMap[e.key.toLowerCase()]
    if (idx !== undefined) {
      e.preventDefault()
      strumString(idx)
    }
  }

  const recordHit = (note: GuitarNote, deltaMs: number) => {
    let timing: GuitarHitResult['timing']
    if (deltaMs <= PERFECT_MS) timing = 'perfect'
    else if (deltaMs <= GREAT_MS) timing = 'great'
    else timing = 'good'

    const timingScore =
      timing === 'perfect' ? 100 : timing === 'great' ? 75 : 50

    console.log(
      `[GuitarPractice] Hit: note=${note.noteName} string=${note.stringIndex} timing=${timing} score=${timingScore} (deltaMs: ${deltaMs.toFixed(1)})`,
    )

    const judgment: GuitarHitResult = {
      itemIndex: note.id,
      midiNote: note.midi,
      noteName: note.noteName,
      stringIndex: note.stringIndex,
      timing,
      score: timingScore,
      timestamp: Date.now(),
    }

    judgedIndices.add(note.id)
    setHitResults((prev) => [...prev, judgment])
    setScore((s) => s + timingScore)
    const newCombo = combo() + 1
    setCombo(newCombo)
    if (newCombo > maxCombo()) setMaxCombo(newCombo)
  }

  const recordMiss = (note: GuitarNote) => {
    console.log(
      `[GuitarPractice] Missed: note=${note.noteName} string=${note.stringIndex}`,
    )
    judgedIndices.add(note.id)
    const judgment: GuitarHitResult = {
      itemIndex: note.id,
      midiNote: note.midi,
      noteName: note.noteName,
      stringIndex: note.stringIndex,
      timing: 'miss',
      score: 0,
      timestamp: Date.now(),
    }
    setHitResults((prev) => [...prev, judgment])
    setNotesMissed((n) => n + 1)
    setCombo(0)
  }

  const finishGame = () => {
    setGameState('finished')
    stopLoop()
  }

  // ── Continuous Mic Pitch Detection Loop ──────────────────────

  createEffect(() => {
    if (inputMode() === 'mic') {
      let frameId: number
      const detectLoop = () => {
        const timeData = audioEngine.getTimeData()
        if (timeData.length > 0) {
          // Amplitude onset detection: a fresh pick attack produces an RMS
          // spike well above the smoothed level of the ringing string.
          let sumSq = 0
          for (let i = 0; i < timeData.length; i++) {
            sumSq += timeData[i] * timeData[i]
          }
          const rms = Math.sqrt(sumSq / timeData.length)
          const isOnset = rms > smoothedRms * 1.8 && rms > 0.03
          smoothedRms = smoothedRms * 0.9 + rms * 0.1

          const detected = pitchDetector.detect(timeData)
          if (detected.clarity > 0.4) {
            const m = computeMidi(detected.frequency)
            // A new pitch or a re-pick of the same pitch is a new articulation
            if (m !== null && (m !== heldMidi || isOnset)) {
              articulationId++
              heldMidi = m
              if (import.meta.env.DEV && m !== detectedMidi()) {
                const name = `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`
                console.log(
                  `[GuitarPractice] Mic Pitch Detected: freq=${detected.frequency.toFixed(2)}Hz, clarity=${detected.clarity.toFixed(2)}, midi=${m} (${name})`,
                )
              }
            }
            silentFrames = 0
            setDetectedMidi(m)
            setDetectedClarity(detected.clarity)
          } else {
            // Tolerate brief detection dropouts before treating the note as
            // released — avoids clarity flicker counting as re-articulation.
            silentFrames++
            if (silentFrames >= 3) heldMidi = null
            setDetectedMidi(null)
            setDetectedClarity(0)
          }
        }
        frameId = requestAnimationFrame(detectLoop)
      }
      frameId = requestAnimationFrame(detectLoop)

      onCleanup(() => {
        cancelAnimationFrame(frameId)
      })
    }
  })

  // ── Public API ────────────────────────────────────────────────

  const loadSong = (
    items: Array<{
      midi: number
      noteName?: string
      startBeat: number
      duration: number
      targetFreq?: number
      trackId?: string
    }>,
    name: string,
    bpm: number,
    backingItems?: Array<{
      midi: number
      startBeat: number
      duration: number
      trackId?: string
    }>,
    mutedIds?: string[],
    songObj?: SavedMidiSong | null,
  ) => {
    stopGame()
    const notes = melodyToGuitarNotes(items)
    setFallingNotes(notes)
    setTotalNotes(notes.length)
    setSelectedSongName(name)
    setSongBpm(bpm)
    backingNotes = (backingItems ?? []).map((b) => ({
      freq: midiToFreq(b.midi),
      startBeat: b.startBeat,
      duration: b.duration,
      trackId: b.trackId,
    }))
    playedBackingIndices = new Set()
    setCurrentSong(songObj ?? null)
    setMutedTrackIds(new Set(mutedIds ?? []))
    if (songObj) {
      setVisibleTrackIds(new Set<string>([songObj.scoreTrackId]))
    } else {
      setVisibleTrackIds(new Set<string>())
    }

    const maxNoteBeat =
      notes.length > 0
        ? Math.max(...notes.map((n) => n.startBeat + n.duration))
        : 0
    const maxBackingBeat =
      backingNotes.length > 0
        ? Math.max(...backingNotes.map((n) => n.startBeat + n.duration))
        : 0
    setTotalBeats(Math.max(maxNoteBeat, maxBackingBeat))
  }

  const seekToBeat = (targetBeat: number) => {
    const notes = fallingNotes()
    const bps = songBpm() / 60

    const target = Math.max(0, Math.min(targetBeat, totalBeats()))
    setPlayheadBeat(target)

    if (gameState() === 'playing') {
      gameStartTime = performance.now() - (target / bps) * 1000
    } else if (gameState() === 'countdown') {
      gameStartTime = performance.now() - ((target + countIn()) / bps) * 1000
    }

    judgedIndices.clear()
    audioJudgedIndices.clear()
    playedIndices.clear()
    playedBackingIndices.clear()

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      if (note.startBeat < target) {
        playedIndices.add(note.id)
      }
      const endBeats = note.startBeat + note.duration
      if (endBeats < target) {
        judgedIndices.add(note.id)
        audioJudgedIndices.add(note.id)
      }
    }

    for (let i = 0; i < backingNotes.length; i++) {
      if (backingNotes[i].startBeat < target) {
        playedBackingIndices.add(i)
      }
    }
  }

  // ── Game controls ────────────────────────────────────────────

  const startGame = () => {
    const notes = fallingNotes()
    if (notes.length === 0) return

    judgedIndices = new Set()
    audioJudgedIndices = new Set()
    playedIndices = new Set()
    countInTicks = 0
    lastHitArticulationId = -1
    heldMidi = null
    playedBackingIndices = new Set()
    setHitResults([])
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setNotesMissed(0)

    const beats = countIn()
    if (beats > 0) {
      setGameState('countdown')
      gameStartTime = performance.now()
      setPlayheadBeat(-beats)
    } else {
      setGameState('playing')
      gameStartTime = performance.now()
      setPlayheadBeat(0)
    }
    startLoop()
  }

  const stopGame = () => {
    setGameState('idle')
    setPlayheadBeat(0)
    stopLoop()
  }

  const pauseGame = () => {
    const state = gameState()
    if (state === 'playing') {
      setGameState('paused')
      stopLoop()
    } else if (state === 'countdown') {
      setGameState('idle')
      setPlayheadBeat(0)
      stopLoop()
    }
  }

  const resumeGame = () => {
    if (gameState() === 'paused') {
      setGameState('playing')
      gameStartTime =
        performance.now() - (playheadBeat() / (songBpm() / 60)) * 1000
      startLoop()
    }
  }

  const togglePlay = () => {
    const state = gameState()
    if (state === 'idle' || state === 'finished') startGame()
    else if (state === 'playing') pauseGame()
    else if (state === 'paused') resumeGame()
    else if (state === 'countdown') stopGame()
  }

  return {
    fallingNotes,
    gameState,
    playheadBeat,
    hitResults,
    combo,
    maxCombo,
    score,
    totalNotes,
    notesMissed,
    visibleBeatWindow,
    showNoteLabels,
    showUserNotes,
    setShowUserNotes,
    setShowNoteLabels,
    songBpm,
    selectedSongName,
    instrumentType,
    setInstrumentType,
    setVisibleBeatWindow,
    detectedMidi,
    detectedClarity,
    startMic,
    stopMic,
    isMicActive: micOn,
    midiConnect,
    midiDisconnect,
    midiConnected,
    inputMode,
    strumString,
    strumKeyboard,
    loadSong,
    startGame,
    stopGame,
    pauseGame,
    resumeGame,
    togglePlay,
    currentSong,
    mutedTrackIds,
    toggleTrackMute,
    visibleTrackIds,
    toggleTrackVisibility,
    totalBeats,
    seekToBeat,
  }
}
