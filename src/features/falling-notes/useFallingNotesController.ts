// ============================================================
// useFallingNotesController — Game logic for Synthesia-style
// piano practice
// ============================================================

import { createEffect, createSignal, onCleanup } from 'solid-js'
import { rmsOfTimeData } from '@/features/mic-feedback/mic-level'
import type { AudioEngine } from '@/lib/audio-engine'
import { FallingNotesEngine } from '@/lib/falling-notes-engine'
import type { MidiNoteEvent } from '@/lib/midi-engine'
import { MidiEngine } from '@/lib/midi-engine'
import { midiToNoteName } from '@/lib/note-utils'
import { centsToRating, ratingToScore } from '@/lib/practice-engine'
import { freqToMidi, midiToFreq, midiToNote } from '@/lib/scale-data'
import { setMicActive } from '@/stores'
import { countIn } from '@/stores'
import type { FallingNote, NoteJudgment } from '@/stores/falling-notes-store'
import { beatsPerSecond, clickPianoEnabled, combo, currentSongBpm, gameState, hitResults, inputMode, maxCombo, midiConnected, notesMissed, playheadBeat, score, setClickPianoEnabled, setCombo, setCurrentSongBpm, setGameState, setHitResults, setInputMode, setMaxCombo, setMidiConnected, setNotesMissed, setPlayheadBeat, setScore, setSelectedSongName, setShowNoteLabels, setSongNotes, setTotalNotes, setVisibleBeatWindow, showNoteLabels, songNotes, totalNotes, visibleBeatWindow, } from '@/stores/falling-notes-store'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { updateMidiSongSelection } from '@/stores/saved-midi-songs-store'
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

  const [currentSong, setCurrentSong] = createSignal<SavedMidiSong | null>(null)
  const [mutedTrackIds, setMutedTrackIds] = createSignal<Set<string>>(new Set())
  const [visibleTrackIds, setVisibleTrackIds] = createSignal<Set<string>>(
    new Set(),
  )
  const [totalBeats, setTotalBeats] = createSignal(0)

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

    const newBackingTrackIds = song.tracks
      .filter((t) => t.id !== song.scoreTrackId && !nextMuted.has(t.id))
      .map((t) => t.id)

    const updatedSong = {
      ...song,
      backingTrackIds: newBackingTrackIds,
    }
    setCurrentSong(updatedSong)

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
    const activeScoreNotes: FallingNote[] =
      scoreTrack !== undefined
        ? scoreTrack.notes.map((n, i) => ({
            id: i,
            midi: n.midi,
            name: midiToNoteName(n.midi),
            startBeat: n.startBeat,
            duration: n.duration,
            targetFreq: midiToFreq(n.midi),
          }))
        : []

    const otherVisibleNotes: FallingNote[] = []
    const visibleIds = visibleTrackIds()
    let idCounter = activeScoreNotes.length
    for (const t of song.tracks) {
      if (t.id === song.scoreTrackId) continue
      if (!visibleIds.has(t.id)) continue

      const mapped = t.notes.map((n) => ({
        id: idCounter++,
        midi: n.midi,
        name: midiToNoteName(n.midi),
        startBeat: n.startBeat,
        duration: n.duration,
        targetFreq: midiToFreq(n.midi),
        isBacking: true,
        trackId: t.id,
      }))
      otherVisibleNotes.push(...mapped)
    }

    const combined = [...activeScoreNotes, ...otherVisibleNotes]
    combined.sort((a, b) => a.startBeat - b.startBeat)

    setSongNotes(combined)
    setTotalNotes(activeScoreNotes.length)
  })

  // Backing tracks
  let backingNotes: Array<{
    freq: number
    startBeat: number
    duration: number
    trackId?: string
  }> = []
  let playedBackingIndices = new Set<number>()

  let animFrameId: number | null = null
  let gameStartTime = 0
  let judgedNotes = new Set<number>()
  let playedNotes = new Set<number>()
  // A seek made while stopped/finished is a start position, not stale state:
  // the next startGame() begins there instead of snapping back to beat 0.
  let pendingStartBeat: number | null = null

  // A-B loop (beats; 0 = unset), pushed from App via setLoop(). The wrap is
  // handled INSIDE the RAF loop (see startLoop) rather than by an external
  // seek, so it stays atomic with the note scheduler — an outside seek fired
  // mid-frame would leave checkHits() replaying the whole [A, B] span at once.
  let loopA = 0
  let loopB = 0
  let loopEnabled = false

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

      // Advance playhead if playing or counting in
      if (gameState() === 'playing' || gameState() === 'countdown') {
        const now = performance.now()
        const elapsedMs = now - gameStartTime
        const bps = beatsPerSecond() * speed()
        const elapsedBeats = (elapsedMs / 1000) * bps

        // During countdown, the playhead starts at -countIn() and moves towards 0
        let newBeat =
          gameState() === 'countdown' ? elapsedBeats - countIn() : elapsedBeats

        // A-B loop: the instant the playhead reaches B, wrap back to A —
        // atomically, BEFORE setPlayheadBeat + checkHits, re-anchoring the
        // clock and re-arming the [A, B] notes. Doing this inline (rather than
        // via an external seek that lands mid-frame) is what keeps the next
        // checkHits from seeing the stale past-B beat and firing every note in
        // the span at once. Only while actually playing, not during count-in.
        const effectiveB = Math.min(loopB, totalBeats())
        if (
          gameState() === 'playing' &&
          loopEnabled &&
          effectiveB > 0 &&
          loopA < effectiveB &&
          newBeat >= effectiveB
        ) {
          audioEngine.stopAllNotes()
          gameStartTime = now - (loopA / bps) * 1000
          markProgressBefore(loopA)
          newBeat = loopA
        }

        setPlayheadBeat(newBeat)

        // Check hits/misses (only while playing)
        if (gameState() === 'playing') {
          checkHits(newBeat)
        }
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
      if (note.isBacking === true) continue
      if (judgedNotes.has(note.id)) continue

      const deltaBeats = note.startBeat - currentBeat
      const deltaMs = (deltaBeats / bps) * 1000

      // Audio plays when the note reaches the piano keyboard (85% h),
      // not the judgment line (82% h). The delay depends on zoom level.
      const keyboardDelayBeats = visibleBeatWindow() * KEYBOARD_DELAY_FACTOR
      if (!playedNotes.has(note.id) && deltaBeats <= -keyboardDelayBeats) {
        playedNotes.add(note.id)
        // Polyphonic (own voice per note, like the guitar game) — the mono
        // playTone slot cut every sustained note ~80ms after the next note
        // on ANY track started.
        void audioEngine.playNote(
          note.targetFreq,
          note.duration > 0 ? (note.duration / bps) * 1000 : 300,
        )
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

    // Backing tracks: trigger audio as each note crosses the playhead
    for (let i = 0; i < backingNotes.length; i++) {
      if (playedBackingIndices.has(i)) continue
      const b = backingNotes[i]
      const delta = b.startBeat - currentBeat
      if (delta <= 0) {
        playedBackingIndices.add(i)
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

    // Check if all notes are done AND playhead has passed the last note
    const scoredNotes = notes.filter((n) => n.isBacking !== true)
    const maxEndBeat =
      scoredNotes.length > 0
        ? Math.max(...scoredNotes.map((n) => n.startBeat + n.duration))
        : 0
    // While an A-B loop is active the loop owns the end behavior (the RAF loop
    // wraps B→A), so don't let the natural finish/repeat fire and fight it.
    const loopActive =
      loopEnabled && loopB > 0 && loopA < Math.min(loopB, totalBeats())
    if (
      !loopActive &&
      judgedNotes.size >= scoredNotes.length &&
      currentBeat >= maxEndBeat &&
      scoredNotes.length > 0
    ) {
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
    const pitchRating: AccuracyRating =
      cents !== null ? centsToRating(Math.abs(cents)) : 'perfect'

    const timingScore =
      timing === 'perfect' ? 100 : timing === 'great' ? 75 : 50
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

    // Respect a seek made while stopped: start from there instead of 0.
    const startBeat = pendingStartBeat ?? 0
    pendingStartBeat = null
    if (startBeat > 0) markProgressBefore(startBeat)

    const countInBeats = countIn()
    const bps = beatsPerSecond() * speed()
    if (countInBeats > 0) {
      setGameState('countdown')
      setPlayheadBeat(startBeat - countInBeats)
      setIsCountingIn(true)
      // Rebased so the loop's (elapsed - countIn) sweep runs from
      // startBeat - countIn up to startBeat instead of -countIn → 0.
      gameStartTime = performance.now() - (startBeat / bps) * 1000

      const beatMs = (1 / bps) * 1000
      let currentBeat = countInBeats

      const tick = () => {
        // Only tick if the game hasn't been paused/stopped during count-in
        if (gameState() !== 'countdown') return

        if (currentBeat > 0) {
          // First beat of count-in is the downbeat (higher pitch)
          audioEngine.playMetronomeClick(currentBeat === countInBeats)
          setCountInBeatTracker(currentBeat)
          // Playhead is handled smoothly by startLoop
        }
        if (currentBeat <= 0) {
          setIsCountingIn(false)
          setCountInBeatTracker(0)
          setGameState('playing')
          setPlayheadBeat(startBeat)
          gameStartTime = performance.now() - (startBeat / bps) * 1000
          return
        }
        currentBeat--
        setTimeout(tick, beatMs)
      }
      tick() // Start first tick immediately
    } else {
      setGameState('playing')
      setPlayheadBeat(startBeat)
      gameStartTime = performance.now() - (startBeat / bps) * 1000
    }
  }

  const pauseGame = () => {
    if (gameState() === 'playing') {
      setGameState('paused')
      // Store current beat so we can resume from here
      const pausedBeat = playheadBeat()
      setPlayheadBeat(pausedBeat)
      // Sounding voices would otherwise ring on through the pause.
      audioEngine.stopAllNotes()
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
    audioEngine.stopAllNotes()
    pendingStartBeat = null
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

  const loadSong = (
    notes: FallingNote[],
    name: string,
    bpm: number,
    backingItems?: FallingNote[],
    mutedIds?: string[],
    songObj?: SavedMidiSong | null,
  ) => {
    // Loading over a running song: silence its voices (the game state flips
    // to idle below, but already-started notes would ring out otherwise).
    audioEngine.stopAllNotes()
    pendingStartBeat = null
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

    backingNotes = (backingItems ?? []).map((b) => ({
      freq: b.targetFreq,
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

  // Pre-mark everything before `target` as already played/judged so a seek
  // (or a start from a seeked position) doesn't count skipped notes as misses.
  const markProgressBefore = (target: number) => {
    const notes = songNotes()
    judgedNotes.clear()
    playedNotes.clear()
    playedBackingIndices.clear()

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i]
      if (note.startBeat < target) {
        playedNotes.add(note.id)
      }
      const endBeats = note.startBeat + note.duration
      if (endBeats < target) {
        judgedNotes.add(note.id)
      }
    }

    for (let i = 0; i < backingNotes.length; i++) {
      if (backingNotes[i].startBeat < target) {
        playedBackingIndices.add(i)
      }
    }
  }

  const seekToBeat = (targetBeat: number) => {
    const bps = beatsPerSecond() * speed()

    const target = Math.max(0, Math.min(targetBeat, totalBeats()))
    setPlayheadBeat(target)
    // Voices started before the jump belong to the old position.
    audioEngine.stopAllNotes()

    const state = gameState()
    if (state === 'playing') {
      gameStartTime = performance.now() - (target / bps) * 1000
    } else if (state === 'countdown') {
      gameStartTime = performance.now() - ((target + countIn()) / bps) * 1000
    } else if (state === 'idle' || state === 'finished') {
      // Stopped: remember the position so the next start begins there
      // (startGame() would otherwise snap the playhead back to 0).
      pendingStartBeat = target
    }

    markProgressBefore(target)
  }

  /** Set the A-B loop region (beats; 0 = unset). The RAF loop wraps B→A while
   *  playing; nothing to redraw here (the canvas reads loop state separately). */
  const setLoop = (a: number, b: number, enabled: boolean) => {
    loopA = a
    loopB = b
    loopEnabled = enabled
  }

  // Switch the scored track WITHOUT rewinding — mirrors the guitar controller.
  // Rebuilds the notes for the new track and resets the score, but keeps the
  // playhead + transport: seekToBeat re-anchors the running loop (or arms the
  // next Play) and marks passed notes. loadSong is for a fresh song (rewinds 0).
  const changeScoreTrack = (
    notes: FallingNote[],
    name: string,
    bpm: number,
    backingItems?: FallingNote[],
    mutedIds?: string[],
    songObj?: SavedMidiSong | null,
  ) => {
    const beat = Math.max(0, playheadBeat())

    audioEngine.stopAllNotes()
    setSongNotes(notes)
    setSelectedSongName(name)
    setCurrentSongBpm(bpm)
    setTotalNotes(notes.length)
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setHitResults([])
    setNotesMissed(0)
    backingNotes = (backingItems ?? []).map((b) => ({
      freq: b.targetFreq,
      startBeat: b.startBeat,
      duration: b.duration,
      trackId: b.trackId,
    }))
    setCurrentSong(songObj ?? null)
    setMutedTrackIds(new Set(mutedIds ?? []))
    if (songObj) {
      setVisibleTrackIds(new Set<string>([songObj.scoreTrackId]))
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

    // Keep the timeline + transport where they were.
    seekToBeat(Math.min(beat, totalBeats()))
  }

  const setSpeedSafe = (newSpeed: number) => {
    // When speed changes during playback or countdown, rebase gameStartTime
    // to maintain beat continuity
    if (gameState() === 'playing' || gameState() === 'countdown') {
      const currentBeatValue = playheadBeat()
      const offset = gameState() === 'countdown' ? -countIn() : 0
      const newBps = beatsPerSecond() * newSpeed
      gameStartTime =
        performance.now() - ((currentBeatValue - offset) * 1000) / newBps
    }
    setSpeed(newSpeed)
  }

  const setBpmSafe = (newBpm: number) => {
    setCurrentSongBpm(newBpm)
    // Rebase gameStartTime so playhead doesn't jump
    if (gameState() === 'playing' || gameState() === 'countdown') {
      const currentBeatValue = playheadBeat()
      const offset = gameState() === 'countdown' ? -countIn() : 0
      const newBps = (newBpm / 60) * speed()
      gameStartTime =
        performance.now() - ((currentBeatValue - offset) * 1000) / newBps
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
    /** RMS mic input level (0–1) for mic-feedback insights; 0 when mic off. */
    getInputLevel: () =>
      micOn() ? rmsOfTimeData(audioEngine.getTimeData()) : 0,
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
    changeScoreTrack,
    speed,
    setSpeed: setSpeedSafe,
    zoomIn,
    zoomOut,
    zoomPercent,
    showNoteLabels,
    toggleNoteLabels,
    setBpm: setBpmSafe,
    currentSong,
    mutedTrackIds,
    toggleTrackMute,
    visibleTrackIds,
    toggleTrackVisibility,
    totalBeats,
    seekToBeat,
    setLoop,

    // Engine (for waveform display)
    engine,
  }
}
