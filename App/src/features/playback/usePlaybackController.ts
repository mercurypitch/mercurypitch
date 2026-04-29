import { createSignal, createMemo, type Accessor, type Setter } from 'solid-js'
import { AudioEngine } from '@/lib/audio-engine'
import { PlaybackRuntime, type PlaybackState } from '@/lib/playback-runtime'
import { PracticeEngine } from '@/lib/practice-engine'
import { melodyStore } from '@/stores/melody-store'
import { appStore } from '@/stores'
import { playback } from '@/stores/playback-store'
import { melodyTotalBeats, keyTonicFreq } from '@/lib/scale-data'
import { type MelodyItem, type PlaybackMode, type SessionResult } from '@/types'

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
  handleStop: () => SessionResult | null | undefined
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
  buildSessionPlaybackMelody: (s: any) => { items: MelodyItem[]; durationBeats: number }
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
    buildSessionPlaybackMelody,
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

  const resetPlaybackState = async () => {
    console.log('[resetPlaybackState] Called, resetting all playback state')
    audioEngine.stopTone()
    audioEngine.stopAllNotes()

    // Stop piano roll's internal audio engine as well
    const pianoRollEngine = (
      window as unknown as {
        pianoRollAudioEngine?: {
          stopTone: () => void
          stopAllNotes: () => void
          isTonePlaying: () => boolean
          getActiveVoices: () => Set<number>
        }
      }
    ).pianoRollAudioEngine
    if (pianoRollEngine) {
      void pianoRollEngine.stopTone()
      void pianoRollEngine.stopAllNotes()
      console.log('[resetPlaybackState] Piano roll audio engine stopped', {
        tonePlaying: pianoRollEngine.isTonePlaying(),
        activeVoices: pianoRollEngine.getActiveVoices().size,
      })
    }

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
    playbackRuntime.stop() // Reset via playback stop

    console.log('[resetPlaybackState] Playback state reset complete')
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

    if (playMode() === 'practice') {
      const activeSession = appStore.userSession()
      if (
        activeSession &&
        activeSession.items.length > 0 &&
        !appStore.sessionMode()
      ) {
        const sessionPlayback = buildSessionPlaybackMelody(activeSession)
        setPlaybackDisplayMelody(sessionPlayback.items)
        setPlaybackDisplayBeats(sessionPlayback.durationBeats)
        appStore.setSessionMode(false)
        appStore.setSessionActive(true)
        forcedDurationBeats = sessionPlayback.durationBeats
      }
    }

    if (forcedDurationBeats === undefined) {
      setPlaybackDisplayMelody(null)
      setPlaybackDisplayBeats(null)
    }

    let baseMelody =
      forcedDurationBeats !== undefined
        ? playbackDisplayMelody() ?? []
        : melodyStore.items()

    if (baseMelody.length === 0) {
      buildScaleMelody(appStore.scaleType(), 8)
      baseMelody = melodyStore.items()
    }

    const subMode =
      forcedDurationBeats !== undefined
        ? 'all'
        : playMode() === 'practice'
          ? practiceSubMode()
          : 'all'

    const filteredMelody = filterMelodyForPractice(baseMelody, subMode)
    playbackRuntime.setMelody(filteredMelody)
    playbackRuntime.setDurationBeats(
      forcedDurationBeats ?? melodyTotalBeats(filteredMelody),
    )

    practiceEngine.startSession()
    appStore.setSessionActive(true)
    setShouldAutoStartPlayback(true)
    setIsPlaying(true)
    setIsPaused(false)
    playback.startPlayback()

    if (appStore.settings().tonicAnchor) {
      const tonicFreq = keyTonicFreq(
        appStore.keyName(),
        melodyStore.getCurrentOctave(),
      )
      const tonicDuration = Math.round(60000 / appStore.bpm())
      audioEngine.playTone(tonicFreq, tonicDuration)
    }

    playbackRuntime.start(appStore.countIn())
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
    setEditorPlaybackState('playing')
  }

  const handleStop = () => {
    playbackRuntime.stop()
    practiceEngine.endSession()
    audioEngine.stopTone()
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    playback.resetPlayback()
    appStore.setSessionActive(false)
    setPlaybackDisplayMelody(null)
    setPlaybackDisplayBeats(null)
    setEditorPlaybackState('stopped')
    return endPracticeSession()
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
        buildScaleMelody(appStore.scaleType(), 8)
        editorMelody = melodyStore.items()
      }
      playbackRuntime.setMelody(editorMelody)
      playbackRuntime.setDurationBeats(melodyTotalBeats(editorMelody))
    }

    setEditorPlaybackState('playing')
    playbackRuntime.start(appStore.countIn())
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
    appStore.setBpm(melody.bpm)
    appStore.setKeyName(melody.key)
    appStore.setScaleType(melody.scaleType)
    melodyStore.loadMelody(melodyId)

    setPitchHistory([])
    setPlaybackDisplayMelody(melody.items ?? [])
    setPlaybackDisplayBeats(melodyTotalBeats(melody.items ?? []))
    playbackRuntime.setMelody(melody.items ?? [])
    appStore.setSessionActive(true)
  }

  const playSessionSequence = (_melodyIds: string[]) => {
    const session = appStore.userSession()
    if (!session || session.items.length === 0) return

    closeSidebar()
    setPlayMode('practice')
    appStore.setActiveTab('practice')

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
