/* eslint-disable @typescript-eslint/no-explicit-any -- compat shim deps; remove with future redesign */
import type { Accessor, Setter } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import { audioRegistry } from '@/lib/audio-registry'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PlaybackState } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { keyTonicFreq, melodyTotalBeats } from '@/lib/scale-data'
import { buildSessionItemMelody } from '@/lib/session-builder'
import { bpm, countIn, keyName, scaleType, sessionMode, setActiveTab, setBpm, setKeyName, setScaleType, setSessionActive, setSessionMode, settings, startPracticeSession, userSession, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { playback } from '@/stores/playback-store'
import type { MelodyItem, PlaybackMode, SessionResult } from '@/types'

export interface PlaybackController {
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  currentBeat: Accessor<number>
  currentNoteIndex: Accessor<number>
  playbackDisplayMelody: Accessor<MelodyItem[] | null>
  playbackDisplayBeats: Accessor<number | null>

  activePlaybackItems: Accessor<MelodyItem[]>
  totalBeats: Accessor<number>
  playheadPosition: Accessor<number>

  handlePlay: () => void
  handlePause: () => void
  handleResume: () => void
  handleStop: () => Promise<SessionResult | null | undefined>
  resetPlaybackState: () => Promise<void>

  editorPlaybackState: Accessor<PlaybackState>
  editorIsPlaying: Accessor<boolean>
  editorIsPaused: Accessor<boolean>
  handleEditorPlay: () => Promise<void>
  handleEditorPause: () => void
  handleEditorResume: () => void
  handleEditorStop: () => void

  loadAndPlayMelodyForSession: (melodyId: string) => void
  playSessionSequence: (melodyIds: string[]) => void
}

interface PlaybackControllerDeps {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
  playMode: Accessor<PlaybackMode>
  setPlayMode: Setter<PlaybackMode>
  practiceSubMode: Accessor<any>
  setPitchHistory: Setter<any[]>
  setNoteResults: Setter<any[]>
  setPracticeResult: Setter<any>
  setLiveScore: Setter<number | null>
  closeSidebar: () => void
  filterMelodyForPractice: (m: MelodyItem[], sub: any) => MelodyItem[]
  buildSessionPlaybackMelody: (s: any) => {
    items: MelodyItem[]
    durationBeats: number
  }
  buildScaleMelody: (type: string, beats: number) => void
  isRecording: Accessor<boolean>
  finalizeRecording: (beat: number) => void
  totalBeats: Accessor<number>
  endPracticeSession: () => SessionResult | null | undefined
  setShouldAutoStartPlayback: Setter<boolean>
}

export function usePlaybackController(
  deps: PlaybackControllerDeps,
): PlaybackController {
  const {
    audioEngine,
    playbackRuntime,
    practiceEngine,
    playMode,
    setPlayMode,
    practiceSubMode,
    setPitchHistory,
    setNoteResults,
    setPracticeResult,
    setLiveScore,
    closeSidebar,
    filterMelodyForPractice,
    // Retained on the deps interface for now (callers still pass it),
    // but the per-item PracticeSession flow in handlePlay no longer
    // builds the concatenated session melody. Underscore prefix keeps
    // the dep wired without tripping no-unused-vars.
    buildSessionPlaybackMelody: _buildSessionPlaybackMelody,
    buildScaleMelody,

    isRecording,
    finalizeRecording,
    totalBeats,
    endPracticeSession,
    setShouldAutoStartPlayback,
  } = deps

  const [isPlaying, setIsPlaying] = createSignal(false)
  const [isPaused, setIsPaused] = createSignal(false)
  const [currentBeat, setCurrentBeat] = createSignal(0)
  const [currentNoteIndex, setCurrentNoteIndex] = createSignal(-1)
  const [playbackDisplayMelody, setPlaybackDisplayMelody] = createSignal<
    MelodyItem[] | null
  >(null)
  const [playbackDisplayBeats, setPlaybackDisplayBeats] = createSignal<
    number | null
  >(null)

  const activePlaybackItems = createMemo(
    () => playbackDisplayMelody() ?? melodyStore.items(),
  )
  const totalBeatsMemo = createMemo(
    () => playbackDisplayBeats() ?? melodyTotalBeats(activePlaybackItems()),
  )
  const playheadPosition = createMemo(() => {
    const beats = currentBeat()
    const total = totalBeatsMemo()
    return total > 0 ? (beats / total) * 100 : 0
  })

  const [editorPlaybackState, setEditorPlaybackState] =
    createSignal<PlaybackState>('stopped')
  const editorIsPlaying = createMemo(() => editorPlaybackState() === 'playing')
  const editorIsPaused = createMemo(() => editorPlaybackState() === 'paused')

  // Subscribe to PlaybackRuntime beat events so currentBeat (and the
  // playhead position) actually advance during playback. Without this,
  // the playhead stays at 0% the entire time.
  playbackRuntime.on('beat', (e: { beat: number }) => {
    setCurrentBeat(e.beat)
  })

  playbackRuntime.on('noteStart', (e: { note: unknown; index: number }) => {
    setCurrentNoteIndex(e.index)
  })

  const resetPlaybackState = async () => {
    audioEngine.stopTone()
    audioEngine.stopAllNotes()

    // Stop all secondary engines (e.g. piano roll's internal engine)
    // via the typed registry — replaces window.pianoRollAudioEngine reads.
    audioRegistry.stopAll()

    playbackRuntime.stop()
    practiceEngine.endSession()
    playback.resetPlayback()
    setIsPlaying(false)
    setIsPaused(false)
    setEditorPlaybackState('stopped')
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    setNoteResults([])

    // Reset session playback state
    setPlaybackDisplayMelody(null)
    setPlaybackDisplayBeats(null)

    // Force reset PlaybackRuntime animation loop and state
    playbackRuntime.stop()
  }

  const handlePlay = () => {
    if (isPlaying()) return
    if (isPaused()) {
      handleResume()
      return
    }

    closeSidebar()
    setPitchHistory([])
    setNoteResults([])
    setPracticeResult(null)
    setLiveScore(null)
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)

    audioEngine.resume()

    let forcedDurationBeats: number | undefined

    // ── Practice mode + active user session ──────────────────────
    // Old behavior built ONE giant melody (`buildSessionPlaybackMelody`)
    // by concatenating every item's notes plus rests. Two problems:
    //   1) the practice canvas saw a single mega-melody and lost the
    //      per-item context (no per-melody score, no per-item visual);
    //   2) the "Play All in sequence" button from the Library used a
    //      different code path (per-item via PracticeSession), so
    //      Practice+Play and Play-All behaved differently.
    //
    // New behavior unifies both routes on the per-item PracticeSession
    // API: startPracticeSession() seeds the queue, we load the first
    // non-rest item's melody into the runtime, and the playback
    // runtime's `complete` event advances to the next item via
    // handleSessionItemComplete (wired in App.tsx). Rest items are
    // handled inside loadNextSessionItem (silent pause, see
    // useSessionSequencer.ts).
    if (playMode() === 'practice') {
      const activeSession = userSession()
      // Note: previously this branch was guarded by `!sessionMode()` so
      // it only ran on the first Play. But handleStop never reset
      // `sessionMode` back to false, so a Stop → Play sequence skipped
      // initialization entirely and the runtime ran with whatever was
      // left in melodyStore (often a stale single-note fallback). We
      // unconditionally re-prime the per-item PracticeSession here —
      // it's the same idempotent setup Play-All-In-Sequence performs,
      // so both routes now produce identical results.
      if (activeSession && activeSession.items.length > 0) {
        setSessionMode(true)
        setSessionActive(true)
        startPracticeSession(activeSession)


        // Find the first item that actually produces audio. A session
        // may legitimately start with a rest (e.g. "warm up silence");
        // we still skip it on initial Play because the runtime can't
        // start from a rest — handleSessionItemComplete will then walk
        // to the next item naturally on completion.
        // Session items are typed as 'melody' | 'rest' (see SessionItemType).
        // Anything that isn't an explicit rest gets played by the runtime.
        const firstPlayable = activeSession.items.find(
          (it) => it.type !== 'rest',
        )

        if (firstPlayable) {
          const itemMelody = buildSessionItemMelody(firstPlayable)
          melodyStore.setMelody(itemMelody)
          setPlaybackDisplayMelody(itemMelody)
          setPlaybackDisplayBeats(melodyTotalBeats(itemMelody))
          forcedDurationBeats = melodyTotalBeats(itemMelody)
        }
      }
    }

    if (forcedDurationBeats === undefined) {
      setPlaybackDisplayMelody(null)
      setPlaybackDisplayBeats(null)
    }

    let baseMelody =
      forcedDurationBeats !== undefined
        ? (playbackDisplayMelody() ?? [])
        : melodyStore.items()


    if (baseMelody.length === 0) {
      buildScaleMelody(scaleType(), 8)
      baseMelody = melodyStore.items()
    }

    const subMode =
      forcedDurationBeats !== undefined
        ? 'all'
        : playMode() === 'practice'
          ? practiceSubMode()
          : 'all'

    const filteredMelody = filterMelodyForPractice(baseMelody, subMode)
    // MVC-style split: `filteredMelody` is the transient view/playback
    // model. It may contain synthetic rest blocks for Spaced mode. Never
    // write it to melodyStore; just expose it to the practice canvas via
    // playbackDisplayMelody and feed it to PlaybackRuntime.
    setPlaybackDisplayMelody(filteredMelody)
    setPlaybackDisplayBeats(
      forcedDurationBeats ?? melodyTotalBeats(filteredMelody),
    )
    playbackRuntime.setMelody(filteredMelody)
    playbackRuntime.setDurationBeats(
      forcedDurationBeats ?? melodyTotalBeats(filteredMelody),
    )

    practiceEngine.startSession()
    setSessionActive(true)
    setShouldAutoStartPlayback(true)
    setIsPlaying(true)
    setIsPaused(false)
    playback.startPlayback()

    if (settings().tonicAnchor === true) {
      const tonicFreq = keyTonicFreq(keyName(), melodyStore.getCurrentOctave())
      const tonicDuration = Math.round(60000 / bpm())
      audioEngine.playTone(tonicFreq, tonicDuration)
    }

    playbackRuntime.start(countIn())
  }

  const handlePause = () => {
    if (!isPlaying()) return
    playbackRuntime.pause()
    audioEngine.stopTone()
    setIsPlaying(false)
    setIsPaused(true)
    playback.pausePlayback()
  }

  const handleResume = () => {
    if (!isPaused()) return
    playbackRuntime.resume()
    setIsPlaying(true)
    setIsPaused(false)
    playback.continuePlayback()
  }

  const handleStop = async (): Promise<SessionResult | null | undefined> => {
    // ── Soft Stop ──
    // v3 decision: Stop tears down audio + transport but PRESERVES the
    // visual state of the just-finished run so the user can review it.
    // Specifically we KEEP:
    //   - noteResults (drives the per-note color coding of played bars)
    //   - pitchHistory (the green pitch trace on the canvas)
    //   - currentBeat / currentNoteIndex (so colored notes keep their
    //     "played" state instead of snapping back to default-blue)
    //   - playbackDisplayMelody / playbackDisplayBeats (so the canvas
    //     still shows the practiced session, not the underlying melody)
    //   - practiceResult / liveScore (score overlay can still appear)
    //
    // handlePlay is the SOLE place that clears the above — it does so
    // at the very start of every fresh Play, so transitioning Stop →
    // Play feels clean. resetPlaybackState (called on tab switch) does
    // a hard reset of everything, which is intentional for tab switches.
    playbackRuntime.stop()
    practiceEngine.endSession()
    audioEngine.stopTone()
    audioEngine.stopAllNotes()
    audioRegistry.stopAll()
    setIsPlaying(false)
    setIsPaused(false)
    playback.resetPlayback()
    setSessionActive(false)
    // Reset sessionMode so the next Play in Practice mode re-enters
    // the per-item PracticeSession setup branch in handlePlay. Without
    // this, a Stop → Play cycle leaves sessionMode=true and handlePlay
    // skips the seed step, leaving the runtime with stale melody data.
    setSessionMode(false)
    setEditorPlaybackState('stopped')
    const result = endPracticeSession()

    // Yield one microtask + one rAF so the browser actually processes
    // pending audio teardown (oscillator stop, gain ramp, AudioContext
    // bookkeeping) before the next Play() builds new voices. Without
    // this, Play -> Pause -> Resume -> Stop -> Play could "stick" for
    // several hundred ms while overlapping audio nodes were being torn
    // down on the main thread.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return result
  }

  const handleEditorPlay = async () => {
    if (editorIsPlaying()) return
    if (editorIsPaused()) {
      handleEditorResume()
      return
    }

    setPitchHistory([])
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)

    if (!audioEngine.getIsInitialized()) await audioEngine.init()
    await audioEngine.resume()

    if (isRecording()) {
      playbackRuntime.setMelody([])
      playbackRuntime.setDurationBeats(Math.max(totalBeats(), 16))
    } else {
      let editorMelody = melodyStore.items()
      if (editorMelody.length === 0) {
        buildScaleMelody(scaleType(), 8)
        editorMelody = melodyStore.items()
      }
      playbackRuntime.setMelody(editorMelody)
      playbackRuntime.setDurationBeats(melodyTotalBeats(editorMelody))
    }

    setEditorPlaybackState('playing')
    playbackRuntime.start(countIn())
  }

  const handleEditorPause = () => {
    playbackRuntime.pause()
    audioEngine.stopTone()
    setEditorPlaybackState('paused')
  }

  const handleEditorResume = () => {
    playbackRuntime.resume()
    setEditorPlaybackState('playing')
  }

  const handleEditorStop = () => {
    if (isRecording()) {
      finalizeRecording(playbackRuntime.getCurrentBeat())
    }
    playbackRuntime.stop()
    audioEngine.stopTone()
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    setEditorPlaybackState('stopped')
    setPlaybackDisplayMelody(null)
    setPlaybackDisplayBeats(null)
  }

  const loadAndPlayMelodyForSession = (melodyId: string) => {
    const melody = melodyStore.getMelody(melodyId)
    if (!melody) return

    closeSidebar()
    setBpm(melody.bpm)
    setKeyName(melody.key)
    setScaleType(melody.scaleType)
    melodyStore.loadMelody(melodyId)

    setPitchHistory([])
    setPlaybackDisplayMelody(melody.items ?? [])
    setPlaybackDisplayBeats(melodyTotalBeats(melody.items ?? []))
    playbackRuntime.setMelody(melody.items ?? [])
    setSessionActive(true)
  }

  const playSessionSequence = (_melodyIds: string[]) => {
    const session = userSession()
    if (!session || session.items.length === 0) return

    closeSidebar()
    setPlayMode('practice')
    setActiveTab('practice')

    resetPlaybackState().then(() => {
      handlePlay()
    })
  }

  return {
    isPlaying,
    isPaused,
    currentBeat,
    currentNoteIndex,
    playbackDisplayMelody,
    playbackDisplayBeats,
    activePlaybackItems,
    totalBeats: totalBeatsMemo,
    playheadPosition,
    handlePlay,
    handlePause,
    handleResume,
    handleStop,
    resetPlaybackState,
    editorPlaybackState,
    editorIsPlaying,
    editorIsPaused,
    handleEditorPlay,
    handleEditorPause,
    handleEditorResume,
    handleEditorStop,
    loadAndPlayMelodyForSession,
    playSessionSequence,
  }
}
