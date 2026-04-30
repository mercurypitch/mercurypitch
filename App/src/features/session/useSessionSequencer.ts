import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { melodyTotalBeats } from '@/lib/scale-data'
import { buildSessionItemMelody } from '@/lib/session-builder'
import { advanceSessionItem, countIn, getCurrentSessionItem, recordSessionItemResult, sessionItemIndex, setActiveTab, setBpm, setKeyName, setScaleType, setSessionActive, showNotification, userSession, } from '@/stores'
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

    // v3 fix: use advanceSessionItem() return value to check for session end.
    // This correctly handles internal repeats AND the last item's repeats.
    const nextItem = advanceSessionItem()

    if (nextItem) {
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
      // Build a synthetic rest "melody" item so the practice canvas
      // renders a visible rest block, mirroring how Spaced-rest mode
      // surfaces silent gaps. Without this the canvas just goes empty
      // for the rest duration and the user can't tell whether playback
      // hung or is intentionally pausing. We pick a 1-beat duration
      // scaled by restDuration / (60_000 / bpm()) so the block width
      // roughly matches the actual silent time at the current BPM.
      // The `isRest: true` flag tells PitchCanvas to use the muted/
      // gray rest styling instead of the colored note rendering.
      const beatMs = 60000 / Math.max(1, playbackRuntime.getBPM?.() ?? 120)

      const restBeats = Math.max(1, Math.round(restDuration / beatMs))
      // Reuse a placeholder pitch so canvas can lay out the bar; the
      // isRest flag prevents any audible playback or scoring.
      const placeholderNote = melodyStore.items()[0]?.note ?? {
        name: 'C',
        octave: 4,
        midi: 60,
        freq: 261.63,
      }
      const restMelody: MelodyItem[] = [
        {
          id: -200000 - sessionItemIndex(),
          note: placeholderNote,
          startBeat: 0,
          duration: restBeats,
          isRest: true,
        },
      ]
      melodyStore.setMelody(restMelody)
      setPlaybackDisplayMelody(restMelody)
      setPlaybackDisplayBeats(restBeats)
      // Feed the synthetic rest item to the runtime so the playhead
      // advances visibly during the silent gap. The actual audio is
      // suppressed by the isRest guard in App.tsx's noteStart handler,
      // so the user sees the vertical playhead line crossing the rest
      // bar but hears nothing — matching how Spaced rests behave.
      // Runtime's natural 'complete' event will then trigger
      // handleSessionItemComplete via the global subscription in
      // App.tsx, advancing to the next item — no manual setTimeout
      // needed, which also means a user Stop interrupts the rest
      // immediately instead of letting it auto-advance.
      playbackRuntime.setMelody(restMelody)
      playbackRuntime.setDurationBeats(restBeats)
      // Defer the start one macrotask: loadNextSessionItem can be
      // invoked from inside the runtime's own 'complete' handler, and
      // a synchronous start there would be killed by the runtime's
      // post-complete stop().
      setTimeout(() => playbackRuntime.start(0), 0)
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

    // handlePlay() will take care of startPracticeSession(session)
    // and loading the first item.
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
