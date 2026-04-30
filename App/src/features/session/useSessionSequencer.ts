import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { melodyTotalBeats } from '@/lib/scale-data'
import { buildSessionItemMelody } from '@/lib/session-builder'
import { advanceSessionItem, countIn, getCurrentSessionItem, practiceSession, recordSessionItemResult, sessionItemIndex, setActiveTab, setBpm, setKeyName, setScaleType, setSessionActive, showNotification, startPracticeSession, userSession, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyItem, NoteResult, PracticeResult, SessionResult, } from '@/types'

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
  handleStop: () => Promise<SessionResult | null | undefined>
  handlePlay: () => void
  setPlayMode: Setter<'once' | 'repeat' | 'practice'>
  closeSidebar: () => void
  /** Repeat mode tracking */
  currentRepeat: Accessor<number>
  setCurrentRepeat: Setter<number>
  repeatCycles: Accessor<number>
  /** Build scale items into the melody store. */
  buildScaleMelody: (scaleType: string, beats: number, label?: string) => void
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
   *   - Count-in fires per item via playbackRuntime.start(countIn()).
   *   - Skipped items DO record a partial PracticeResult if available.
   *   - Score aggregation lives in practice-session-store.recordSessionItemResult.
   */
  const handleSessionItemComplete = (): void => {
    const currentScore = liveScore()
    const practiceRes = practiceResult()
    if (currentScore !== null && practiceRes !== null) {
      recordSessionItemResult(practiceRes)
    }

    const current = getCurrentSessionItem()
    if (!current) {
      void handleStop()
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
      // handleStop is async (waits for audio teardown); resolve and apply
      void handleStop().then((summary) => {
        if (summary) {
          setSessionSummary({
            score: summary.score,
            items: summary.itemsCompleted,
            name: summary.sessionName,
          })
          showNotification(
            `Session complete! Score: ${summary.score}%`,
            summary.score >= 80 ? 'success' : 'info',
          )
        }
      })
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
      // Also reset the per-cycle visual state so the playhead snaps back
      // to bar 1 and the active note highlight tracks the new cycle.
      setCurrentBeat(0)
      setCurrentNoteIndex(-1)
      melodyStore.setCurrentNoteIndex(-1)
      // IMPORTANT: PlaybackRuntime's completion flow is currently:
      //   if (beat >= totalBeats) {
      //     emit('complete')
      //     this.stop()
      //   }
      //
      // So we must NOT restart synchronously inside the `complete`
      // subscriber. If we do:
      //   emit complete -> handleRepeatModeComplete -> start cycle N+1
      //   -> returns to runtime -> runtime.stop() kills cycle N+1
      //
      // That exact race produced the console sequence:
      //   start cycle 1 -> runtime.stop -> start cycle 2 -> runtime.stop
      // and left the playhead stuck at the end.
      //
      // Defer the restart one macrotask so the runtime's own post-complete
      // stop has already finished. Then re-arm the runtime melody and
      // start a genuinely fresh cycle.
      setTimeout(() => {
        practiceEngine.resetSession()
        practiceEngine.startSession()
        playbackRuntime.setMelody(melodyStore.items())
        playbackRuntime.start(countIn())
      }, 0)
    } else {
      // Completed the final requested cycle. Reset to 1 so the next
      // fresh Repeat run starts from cycle 1/N instead of being stuck
      // at N/N and immediately stopping after a single playback.
      setCurrentRepeat(1)
      void handleStop()
    }
  }

  const loadNextSessionItem = (): void => {
    const nextItem = getCurrentSessionItem()
    if (!nextItem) return

    const startAfterCompleteCleanup = (): void => {
      // loadNextSessionItem is called from the runtime `complete` handler.
      // PlaybackRuntime emits `complete` and only then calls its own stop(),
      // so a synchronous start here would be killed by that post-complete
      // stop. Defer one macrotask so runtime cleanup completes first.
      setTimeout(() => playbackRuntime.start(countIn()), 0)
    }

    if (nextItem.type === 'rest') {
      // ── REST item ────────────────────────────────────────────────
      // Previously we *replayed the just-finished melody* during the
      // rest because `playbackRuntime.setMelody(melodyStore.items())`
      // was followed by `playbackRuntime.start(...)`. The user-visible
      // bug was: hitting "Play All in sequence" from the library, the
      // rest gap between melodies would loop the previous melody
      // instead of being a silent pause.
      //
      // Fix: during a rest we
      //   1) stop the runtime (no audio),
      //   2) clear the visible melody so the practice canvas shows a
      //      "rest" state (empty melody + visible item label still set
      //      via the session store), and
      //   3) advance to the next session item after `restMs` has
      //      elapsed by calling the same completion path the runtime
      //      would have used.
      //
      // We deliberately do NOT call playbackRuntime.start() here.
      const restDuration = nextItem.restMs ?? 2000
      playbackRuntime.stop()
      // Empty melody → canvas renders the rest state instead of the
      // previous melody's notes.
      melodyStore.setMelody([])
      playbackRuntime.setMelody([])
      setPlaybackDisplayMelody([])
      setPlaybackDisplayBeats(0)
      // Advance after rest. handleSessionItemComplete is the same hook
      // PlaybackRuntime would have called via its 'complete' event; it
      // takes care of advanceSessionItem + loadNextSessionItem (which
      // will then start the *next* melody).
      setTimeout(() => {
        // Guard: if the user has stopped/changed sessions in the
        // meantime, skip the auto-advance.
        const stillRest = getCurrentSessionItem()
        if (stillRest && stillRest.type === 'rest') {
          handleSessionItemComplete()
        }
      }, restDuration)
    } else if ((nextItem.type as string) === 'scale') {

      buildScaleMelody(
        nextItem.scaleType ?? 'major',
        nextItem.beats ?? 8,
        nextItem.label,
      )
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      startAfterCompleteCleanup()
    } else if (nextItem.type === 'melody' || nextItem.type === 'preset') {
      const melodyItems = buildSessionItemMelody(nextItem)
      melodyStore.setMelody(melodyItems)
      playbackRuntime.stop()
      playbackRuntime.setMelody(melodyStore.items())
      // FIXME: countIn behavior decision pending — currently fires per item
      startAfterCompleteCleanup()
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
    void handleStop().then((summary) => {
      if (summary) {
        setSessionSummary({
          score: summary.score,
          items: summary.itemsCompleted,
          name: summary.sessionName,
        })
      }
    })
  }

  const loadAndPlayMelodyForSession = (melodyId: string): void => {
    const melody = melodyStore.getMelody(melodyId)
    if (!melody) return

    closeSidebar()
    setBpm(melody.bpm)
    setKeyName(melody.key)
    setScaleType(melody.scaleType)
    melodyStore.loadMelody(melodyId)

    setCurrentBeat(0)
    setCurrentNoteIndex(-1)
    melodyStore.setCurrentNoteIndex(-1)
    setPitchHistory([])
    setPlaybackDisplayMelody(melody.items ?? [])
    setPlaybackDisplayBeats(melodyTotalBeats(melody.items ?? []))
    playbackRuntime.setMelody(melody.items ?? [])
    setSessionActive(true)
  }

  const playSessionSequence = (_melodyIds: string[]): void => {
    const session = userSession()
    if (!session || session.items.length === 0) return

    // Play All should use the PracticeSession API, NOT concatenate all
    // notes into one giant melody. This preserves the session semantics:
    // melody item -> complete -> advanceSessionItem() -> next melody/rest.
    closeSidebar()
    setSessionMelodyIds([])
    setSessionCurrentMelodyIndex(-1)
    setPlayMode('practice')
    setActiveTab('practice')

    startPracticeSession(session)
    const firstItem = session.items[0]
    if (firstItem !== undefined && firstItem.type !== 'rest') {
      melodyStore.setMelody(buildSessionItemMelody(firstItem))
    }
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
