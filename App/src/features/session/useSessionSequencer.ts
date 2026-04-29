import { createSignal, type Accessor, type Setter } from 'solid-js'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { melodyStore } from '@/stores/melody-store'
import { melodyTotalBeats } from '@/lib/scale-data'
import {
  appStore,
  advanceSessionItem,
  practiceSession,
  recordSessionItemResult,
  sessionItemIndex,
} from '@/stores'
import type {
  MelodyItem,
  NoteResult,
  PracticeResult,
  SessionResult,
} from '@/types'

export interface SessionSequencer {
  sessionMelodyIds: Accessor<string[]>
  setSessionMelodyIds: Setter<string[]>
  sessionCurrentMelodyIndex: Accessor<number>
  setSessionCurrentMelodyIndex: Setter<number>
  sessionSummary: Accessor<{
    score: number
    items: number
    name: string
  } | null>
  setSessionSummary: Setter<{
    score: number
    items: number
    name: string
  } | null>

  /** v3 rename: was handleSessionModeComplete */
  handleSessionItemComplete: () => void
  handleRepeatModeComplete: () => void
  handleSessionSkip: () => void
  handleSessionEnd: () => void
  loadAndPlayMelodyForSession: (melodyId: string) => void
  playSessionSequence: (melodyIds: string[]) => void
  playNextInSessionSequence: () => void
  loadNextSessionItem: () => void
}

interface Deps {
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
  liveScore: Accessor<number | null>
  practiceResult: Accessor<PracticeResult | null>
  setPitchHistory: Setter<unknown[]>
  setNoteResults: Setter<NoteResult[]>
  setLiveScore: Setter<number | null>
  setPlaybackDisplayMelody: (m: MelodyItem[] | null) => void
  setPlaybackDisplayBeats: (b: number | null) => void
  handleStop: () => SessionResult | null | undefined
  handlePlay: () => void
  setPlayMode: Setter<'once' | 'repeat' | 'practice'>
  closeSidebar: () => void
  /** Repeat mode tracking */
  currentRepeat: Accessor<number>
  setCurrentRepeat: Setter<number>
  repeatCycles: Accessor<number>
  /** Build scale items into the melody store. */
  buildScaleMelody: (
    scaleType: string,
    beats: number,
    label?: string,
  ) => void
  setCurrentBeat: Setter<number>
  setCurrentNoteIndex: Setter<number>
}

export function useSessionSequencer(deps: Deps): SessionSequencer {
  const {
    playbackRuntime,
    practiceEngine,
    liveScore,
    practiceResult,
    setPitchHistory,
    setNoteResults,
    setLiveScore,
    setPlaybackDisplayMelody,
    setPlaybackDisplayBeats,
    handleStop,
    handlePlay,
    setPlayMode,
    closeSidebar,
    currentRepeat,
    setCurrentRepeat,
    repeatCycles,
    buildScaleMelody,
    setCurrentBeat,
    setCurrentNoteIndex,
  } = deps

  const [sessionMelodyIds, setSessionMelodyIds] = createSignal<string[]>([])
  const [sessionCurrentMelodyIndex, setSessionCurrentMelodyIndex] =
    createSignal(-1)
  const [sessionSummary, setSessionSummary] = createSignal<{
    score: number
    items: number
    name: string
  } | null>(null)

  /**
   * v3 decision (documented):
   *   - Pitch history resets per item (current behavior, see FIXME).
   *   - Count-in fires per item via playbackRuntime.start(appStore.countIn()).
   *   - Skipped items DO record a partial PracticeResult if available.
   *   - Score aggregation lives in practice-session-store.recordSessionItemResult.
   */
  const handleSessionItemComplete = (): void => {
    const currentScore = liveScore()
    const practiceRes = practiceResult()
    if (currentScore !== null && practiceRes !== null) {
      recordSessionItemResult(practiceRes)
    }

    const current = appStore.getCurrentSessionItem()
    if (!current) {
      handleStop()
      return
    }

    const session = practiceSession()
    const idx = sessionItemIndex()

    if (idx < (session?.items.length ?? 0) - 1) {
      advanceSessionItem()
      setNoteResults([])
      setLiveScore(null)
      setCurrentBeat(0)
      setCurrentNoteIndex(-1)
      melodyStore.setCurrentNoteIndex(-1)
      setPitchHistory([])
      practiceEngine.resetSession()
      loadNextSessionItem()
    } else {
      const summary = handleStop()
      if (summary) {
        setSessionSummary({
          score: summary.score,
          items: summary.itemsCompleted,
          name: summary.sessionName,
        })
        appStore.showNotification(
          `Session complete! Score: ${summary.score}%`,
          summary.score >= 80 ? 'success' : 'info',
        )
      }
    }
  }

  const handleRepeatModeComplete = (): void => {
    const current = currentRepeat()
    const total = repeatCycles()

    if (current < total) {
      setCurrentRepeat(current + 1)
      setNoteResults([])
      setLiveScore(null)
      setPitchHistory([])
      practiceEngine.resetSession()
      playbackRuntime.start(appStore.countIn())
    } else {
      handleStop()
    }
  }

  const loadNextSessionItem = (): void => {
    const nextItem = appStore.getCurrentSessionItem()
    if (!nextItem) return

    if (nextItem.type === 'rest') {
      const restDuration = nextItem.restMs ?? 2000
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      playbackRuntime.start(appStore.countIn())
      // FIXME: Replace setTimeout chain with awaitable transition
      setTimeout(() => {
        const afterRest = appStore.getCurrentSessionItem()
        if (afterRest && afterRest.type === 'scale') {
          buildScaleMelody(
            afterRest.scaleType ?? 'major',
            afterRest.beats ?? 8,
            afterRest.label,
          )
          playbackRuntime.stop()
          playbackRuntime.setMelody(melodyStore.items())
          playbackRuntime.start(appStore.countIn())
        }
      }, restDuration)
    } else if (nextItem.type === 'scale') {
      buildScaleMelody(
        nextItem.scaleType ?? 'major',
        nextItem.beats ?? 8,
        nextItem.label,
      )
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      playbackRuntime.start(appStore.countIn())
    } else if (nextItem.type === 'melody' || nextItem.type === 'preset') {
      const melodyItems = appStore.buildSessionItemMelody(nextItem)
      melodyStore.setMelody(melodyItems)
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      // FIXME: countIn behavior decision pending — currently fires per item
      playbackRuntime.start(appStore.countIn())
    }
  }

  const handleSessionSkip = (): void => {
    // Skipped items still record any partial PracticeResult
    const practiceRes = practiceResult()
    if (practiceRes !== null) {
      recordSessionItemResult(practiceRes)
    }
    handleSessionItemComplete()
  }

  const handleSessionEnd = (): void => {
    const summary = handleStop()
    if (summary) {
      setSessionSummary({
        score: summary.score,
        items: summary.itemsCompleted,
        name: summary.sessionName,
      })
    }
  }

  const loadAndPlayMelodyForSession = (melodyId: string): void => {
    const melody = melodyStore.getMelody(melodyId)
    if (!melody) return

    closeSidebar()
    appStore.setBpm(melody.bpm)
    appStore.setKeyName(melody.key)
    appStore.setScaleType(melody.scaleType)
    melodyStore.loadMelody(melodyId)

    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    setPlaybackDisplayMelody(melody.items ?? [])
    setPlaybackDisplayBeats(melodyTotalBeats(melody.items ?? []))
    playbackRuntime.setMelody(melody.items ?? [])
    appStore.setSessionActive(true)
  }

  const playSessionSequence = (_melodyIds: string[]): void => {
    const session = appStore.userSession()
    if (!session || session.items.length === 0) return

    closeSidebar()
    setSessionMelodyIds([])
    setSessionCurrentMelodyIndex(-1)
    setPlayMode('practice')
    appStore.setActiveTab('practice')
    handlePlay()
  }

  const playNextInSessionSequence = (): void => {
    const ids = sessionMelodyIds()
    const currentIdx = sessionCurrentMelodyIndex()

    if (currentIdx < ids.length - 1) {
      const nextIdx = currentIdx + 1
      setSessionCurrentMelodyIndex(nextIdx)
      loadAndPlayMelodyForSession(ids[nextIdx])
    } else {
      setSessionMelodyIds([])
      setSessionCurrentMelodyIndex(-1)
    }
  }

  return {
    sessionMelodyIds,
    setSessionMelodyIds,
    sessionCurrentMelodyIndex,
    setSessionCurrentMelodyIndex,
    sessionSummary,
    setSessionSummary,
    handleSessionItemComplete,
    handleRepeatModeComplete,
    handleSessionSkip,
    handleSessionEnd,
    loadAndPlayMelodyForSession,
    playSessionSequence,
    playNextInSessionSequence,
    loadNextSessionItem,
  }
}
