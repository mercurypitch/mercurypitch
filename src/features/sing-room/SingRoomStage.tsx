// ============================================================
// Retro Analog Studio — the Sing tab, as a room (Phase 3)
// ============================================================
//
// Under `IS_NATIVE_BUILD` this replaces `SingingMobileStage` at the Sing
// tab's swap point. It is a full-bleed cover photograph under the kit's
// scrims, a row of glass chips on the top scrim, the pitch trace drawn on a
// TRANSPARENT canvas as the whole middle, and nothing else: the room header
// and the transport are the shell's, and the options sheet and the end card
// are one gesture away. No web chrome, no second transport, no score.
//
// WHAT LIVES WHERE. The maths, the store and the machine are headless
// modules beside this file, each with its own suite; this component is a
// presentation of them and a wiring harness for four things it cannot avoid
// owning — the frame subscription, the microphone effect, the shell
// registration, and the free run's own time axis.
//
// THE FREE RUN'S TIME AXIS. `PitchCanvas` positions a trail by BEAT, which
// is right for a melody and meaningless for a free tracker with no transport
// running. So a free run feeds it a second-based axis: one "beat" is one
// second, `currentBeat` is the elapsed seconds, and the canvas's existing
// sliding-window maths gives an oscilloscope 16 seconds wide for nothing. A
// melody run hands back the app's real beats and the app's own history.
//
// THE TRAIL IS A MUTATED ARRAY, not a signal. `PitchCanvas` repaints from
// its own rAF loop whenever the history has anything in it, and rebuilding a
// 1500-entry array sixty times a second to tell it something it is about to
// read anyway is work nobody sees.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, Match, on, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { Portal } from 'solid-js/web'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import type { PracticeFrameListener } from '@/features/practice/usePracticeController'
import { roomName } from '@/features/rooms/room-names'
import { TAB_HOME, TAB_SINGING } from '@/features/tabs/constants'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { haptics } from '@/lib/haptics'
import { micManager } from '@/lib/mic-manager'
import { buildMultiOctaveScale, scaleDegreeSet } from '@/lib/scale-data'
import { exposeForE2E } from '@/lib/test-utils'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import { keyName, scaleType, setActiveTab, setKeyName, setScaleType, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { nativeShellApi, registerRunControls, } from '@/stores/native-shell-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import { keepSingTake, lastSingTake, removeSingTake, singTakes, } from '@/stores/sing-takes-store'
import type { MelodyItem, PitchResult, PitchSample, ScaleDegree } from '@/types'
import { centsToNearestScaleNote, keyChipLabel, noteChipSignal, } from './hud-signals'
import type { SingRoomState } from './room-machine'
import { hasUnsavedTake as takeUndecided, melodyRanOut, micChipAction, micChipState, micIntent, runIsLive, runIsPaused, startsNewTake, transportPhase, } from './room-machine'
import { loadSingGlass, persistSingGlass, SING_GLASS_VAR } from './sing-glass'
import styles from './sing-room.module.css'
import { setSingCoachMarkSeen, setSingMicGranted, setSingMicOnArrival, setSingPerNoteBurn, SING_COACH_MARK, singCoachMarkSeen, singMicOnArrival, singPerNoteBurn, } from './sing-room-settings'
import { beginTake, clearSingTakeResult, dispatchSingRoom, enterSingRoom, setSingTakeResult, singRoomContext, singTakeClock, singTakePrevious, singTakeSummary, takesThisSession, } from './sing-room-store'
import { SingRoomHud } from './SingRoomHud'
import { SingRoomOptions } from './SingRoomOptions'
import { SingRoomPicker } from './SingRoomPicker'
import { SingSongSheet } from './SingSongSheet'
import { SingTakeSheet } from './SingTakeSheet'
import { SingTakesSheet } from './SingTakesSheet'
import { SingPrimingArt, SingTrace } from './SingTrace'
import { singStageView } from './stage-view'
import { recordTakeFrame, startTakeRecording, takeElapsedSeconds, takeRecording, } from './take-recorder'

/** What the room hands the host so the host can build its `PitchCanvas`. */
export interface SingRoomCanvasOptions {
  pitchHistory: () => PitchSample[]
  /** The rows the trace is read against: the melody's, or the voice's own. */
  scale: () => ScaleDegree[]
  /** EMPTY in a free run: there is no melody, and a leftover one would both
   *  draw a target nobody asked for and pull the whole view to its own
   *  octave, dropping the sung line off the top of the canvas as an
   *  out-of-view artifact. */
  melody: () => MelodyItem[]
  currentBeat: () => number
  totalBeats: () => number
  isPlaying: () => boolean
  isPaused: () => boolean
  perNoteBurn: () => boolean
  /** Nothing is moving: draw once and stop. */
  frozen: () => boolean
}

export interface SingRoomStageProps {
  picker: MidiSongPicker
  /** The melody on the stage. A free run draws none of it. */
  melody: () => MelodyItem[]
  /** The app's own transport position, for a melody run. */
  currentBeat: () => number
  totalBeats: () => number
  /** The app's trail, for a melody run. A free run keeps its own. */
  pitchHistory: () => PitchSample[]
  currentPitch: () => PitchResult | null
  targetPitch: () => number | null
  subscribeFrames: (listener: PracticeFrameListener) => () => void
  /** The canvas, built by the host so the room never imports PitchCanvas. */
  renderCanvas: (options: SingRoomCanvasOptions) => JSX.Element

  micActive: () => boolean
  /** Resolves false on a refusal; `micManager` says why. Must be awaited
   *  inside the gesture that asked, so the audio context resumes with it. */
  startMic: () => Promise<boolean>
  stopMic: () => void
  /**
   * Build and un-suspend the audio context, INSIDE the gesture that called.
   *
   * iOS resumes a context only from a gesture and routes WebAudio through the
   * silent-switch session until a media element has played, so this has to
   * run before the first `await` of the tap that asks for the microphone.
   */
  primeAudio: () => void
  /** Is the audio clock actually running? A capture over a suspended context
   *  is a live device feeding a dead line. */
  audioRunning: () => boolean

  isPlaying: () => boolean
  isPaused: () => boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  isCountingIn: () => boolean
  countInBeat: () => number

  onSessionSkip: () => void
  onSessionEnd: () => void

  speed: () => number
  onSpeedChange: (value: number) => void
  volume: () => number
  onVolumeChange: (value: number) => void
  metronomeEnabled: () => boolean
  onMetronomeToggle: () => void
  onOctaveShift: (delta: number) => void
  onAutoCalibrate: () => void
}

/** The free run's window, in the seconds it uses for beats. */
const FREE_WINDOW_SECONDS = 17

/** One shared empty array: a new one per frame is a new prop every frame. */
const EMPTY_MELODY: MelodyItem[] = []
const EMPTY_HISTORY: PitchSample[] = []

export const SingRoomStage: Component<SingRoomStageProps> = (props) => {
  const [optionsOpen, setOptionsOpen] = createSignal(false)
  /** "Your takes", from the pitch pill (R4). */
  const [takesOpen, setTakesOpen] = createSignal(false)
  /** Play again · Change song · Remove, from the song chip (R1). */
  const [songOpen, setSongOpen] = createSignal(false)
  /** The room sheet — which photograph, and the veil over it (R5). */
  const [pickerOpen, setPickerOpen] = createSignal(false)
  const [glass, setGlass] = createSignal(loadSingGlass())

  // The premium catalogue is retained only while the picker is open: the room
  // itself is three free public covers and has no business asking a server
  // about supporter art to draw one of them. That is the silent-first
  // contract `useBackgroundSurfaceController` takes this flag for.
  const background = useBackgroundSurfaceController('sing', pickerOpen)

  // The take on the card is the STORE's, not this component's. Both halves of
  // it — the state that says a card is open and the summary the card draws —
  // have to survive a remount or neither may: see `sing-room-store.ts`.
  const summary = singTakeSummary

  const ctx = singRoomContext
  const state = (): SingRoomState => ctx().state

  /** What the middle of the room is showing. One answer, in `stage-view.ts`. */
  const view = createMemo(() => singStageView(ctx()))

  /** A melody run: the app's transport is the thing that is running. */
  const melodyRun = (): boolean => props.isPlaying() || props.isPaused()

  const scalePitchClasses = createMemo(() =>
    scaleDegreeSet(keyName(), scaleType()),
  )

  // ── The take ───────────────────────────────────────────────

  const startTake = (): void => {
    startTakeRecording()
    beginTake()
  }

  const endTake = (): boolean => {
    const computed = takeRecording.summary.summarize(takesThisSession())
    if (computed === null) {
      clearSingTakeResult()
      return false
    }
    // The previous take is captured BEFORE Keep writes, so the line the
    // singer is reading cannot change into a comparison with the take they
    // are deciding about.
    setSingTakeResult(computed, lastSingTake(), {
      startedAt: takeRecording.startedAtEpoch,
      endedAt: Date.now(),
    })
    return true
  }

  /**
   * Store the take on the card and close it.
   *
   * EVERY way out of the card that is not Discard lands here — Keep, Back,
   * the backdrop, leaving the room. Four numbers and two timestamps that stay
   * on this phone are not worth losing to a mis-tap, and a card that silently
   * threw a take away on a Back is the opposite of what its footer promises.
   */
  const keepTake = (): void => {
    const computed = summary()
    if (computed !== null) {
      const clock = singTakeClock()
      keepSingTake({
        id: `${clock.endedAt}-${computed.takeNumber}`,
        startedAt: clock.startedAt,
        endedAt: clock.endedAt,
        durationMs: computed.durationMs,
        takeNumber: computed.takeNumber,
        lowNote: computed.range?.lowLabel ?? null,
        highNote: computed.range?.highLabel ?? null,
        heldWithinCents: computed.heldWithinCents,
      })
    }
    clearSingTakeResult()
    dispatchSingRoom({ type: 'take-decided' })
  }

  // `startsNewTake` is the whole rule, and it lives in the machine because
  // the effect below re-runs on EVERY dispatch: the context is a new object
  // each time, so `on(state)` fires even when the state did not move.
  createEffect(
    on(state, (next, previous) => {
      if (startsNewTake(previous, next)) startTake()
    }),
  )

  // ── The microphone, which nothing else in the room touches ──

  /** One answer for "the device did not open", wherever it was asked from. */
  const micFailed = (): void => {
    const kind = micManager.getError()?.kind
    if (kind === 'permission-denied' || kind === 'no-device') {
      // The remembered grant is how the room skips the priming screen; a
      // refusal makes it a lie, and a room that trusts it keeps reaching for
      // a device it has been told it may not have.
      setSingMicGranted(false)
      dispatchSingRoom({ type: 'mic-denied' })
      return
    }
    dispatchSingRoom({ type: 'mic-unavailable' })
  }

  /**
   * Did the device open onto a clock that is actually running?
   *
   * A capture over a suspended context is the worst of both: the chip says
   * "Listening", the trace never moves, and nothing says why. The room rests
   * instead and the chip becomes the way back in — a tap on it is a gesture,
   * which is the one thing iOS will resume a context from.
   */
  const claimLive = (): boolean => {
    if (props.audioRunning()) return true
    // Dispatch BEFORE the stop. The intent effect watches `micIntent`, and
    // while the state still says live a release looks like a device that
    // dropped out — so it opened the microphone again, once, before
    // `mic-suspended` landed and took the intent away.
    dispatchSingRoom({ type: 'mic-suspended' })
    props.stopMic()
    return false
  }

  const requestMic = async (): Promise<void> => {
    const granted = await props.startMic()
    if (!granted) {
      micFailed()
      return
    }
    setSingMicGranted(true)
    if (!claimLive()) return
    dispatchSingRoom({ type: 'mic-granted' })
  }

  createEffect(() => {
    const want = micIntent(ctx())
    const have = props.micActive()
    if (want === have) return
    if (want) {
      // The continuation reads `audioRunning` once, when the device has
      // actually opened. Deliberately not a tracked scope: it is the answer
      // at that instant that decides, and re-running it later would dispatch
      // again over a room that has moved on.
      // eslint-disable-next-line solid/reactivity
      void props.startMic().then((granted) => {
        if (!granted) {
          micFailed()
          return
        }
        claimLive()
      })
    } else {
      props.stopMic()
    }
  })

  // ── The frame stream ───────────────────────────────────────

  const onFrame: PracticeFrameListener = (frame) => {
    if (!micIntent(ctx())) return
    const pitch = frame.pitch
    const freq = pitch !== null && pitch.frequency > 0 ? pitch.frequency : 0
    const melody = melodyRun()

    // The reference the end card measures against: the target in a melody
    // run, the nearest note OF THE KEY in a free one (brief §5).
    const target = props.targetPitch()
    const against =
      freq === 0
        ? null
        : melody && target !== null && target > 0
          ? {
              cents: 1200 * Math.log2(freq / target),
              midi: Math.round(69 + 12 * Math.log2(freq / 440)),
            }
          : centsToNearestScaleNote(freq, scalePitchClasses())

    recordTakeFrame({
      atMs: frame.atMs,
      freq,
      cents: against?.cents ?? 0,
      midi: against?.midi ?? 0,
      // A melody run draws from the app's own history, which the app fills
      // only while its transport is running. A free run has none.
      trail: !melody,
    })
  }

  // ── The run, and the shell that drives it ──────────────────

  const handlePause = (): void => {
    dispatchSingRoom({ type: 'pause' })
    if (melodyRun() && props.isPlaying()) props.onPause()
  }

  const handleResume = (): void => {
    dispatchSingRoom({ type: 'resume' })
    if (props.isPaused()) props.onResume()
  }

  const handleStop = (): void => {
    if (melodyRun()) props.onStop()
    dispatchSingRoom({ type: 'stop', hasTake: endTake() })
  }

  /**
   * The melody reached its own end (R1).
   *
   * The same ending as Stop, minus the transport: it has already stopped
   * itself, which is what this is about. The take ends, and the card opens if
   * there was one — the failure it replaces is a run that just vanished,
   * leaving the room in `live` over a transport that had finished.
   *
   * `transportRan` is what keeps the FIRST frames of a melody run from
   * reading as the last: `melody-play` puts the room in `live` before the
   * app's transport reports anything, so the pair says "stopped" until it
   * starts. Only a transport that was seen running can run out.
   */
  let transportRan = false
  let endWatch = 0

  const handleMelodyRanOut = (): void => {
    transportRan = false
    dispatchSingRoom({ type: 'stop', hasTake: endTake() })
  }

  createEffect(() => {
    const phase = transportPhase(props.isPlaying(), props.isPaused())
    const context = ctx()
    if (phase === 'running') {
      transportRan = true
      return
    }
    if (phase === 'held' || !transportRan) return
    if (!melodyRanOut(context, phase)) return
    // A pause writes `isPlaying(false)` before it writes `isPaused(true)`, so
    // for one moment the pair reads exactly like a transport that ended. The
    // decision waits a microtask and asks again — the same shape the shell's
    // own run store uses for the same two signals.
    const token = ++endWatch
    queueMicrotask(() => {
      if (token !== endWatch) return
      const settled = transportPhase(
        untrack(() => props.isPlaying()),
        untrack(() => props.isPaused()),
      )
      if (!melodyRanOut(untrack(ctx), settled)) return
      handleMelodyRanOut()
    })
  })

  const handlePark = (): void => {
    if (props.isPlaying()) props.onPause()
    // A sheet or a picker left open outlives the park otherwise: the room
    // unmounts with it open and comes back with a modal over a paused run.
    closeRoomSheets()
    if (state() === 'priming') dispatchSingRoom({ type: 'priming-cancel' })
    if (takeUndecided(ctx())) keepTake()
    dispatchSingRoom({ type: 'leave' })
    if (props.micActive()) props.stopMic()
  }

  /**
   * Back, once the shell's own layers have declined it.
   *
   * The room's overlays in the order they are stacked. The end card is last
   * and closes by KEEPING: a summary is four numbers that never leave the
   * phone, and losing one to a Back is worse than storing one nobody wanted.
   */
  /** Shut every sheet and modal the room is holding, topmost first. */
  const closeRoomSheets = (): boolean => {
    if (props.picker.trackModalSong() !== null) {
      props.picker.setTrackModalSong(null)
      return true
    }
    if (props.picker.isModalOpen()) {
      props.picker.setIsModalOpen(false)
      return true
    }
    if (takesOpen()) {
      setTakesOpen(false)
      return true
    }
    if (songOpen()) {
      setSongOpen(false)
      return true
    }
    if (pickerOpen()) {
      setPickerOpen(false)
      return true
    }
    if (optionsOpen()) {
      setOptionsOpen(false)
      return true
    }
    return false
  }

  const closeRoomOverlay = (): boolean => {
    if (closeRoomSheets()) return true
    // The priming door, above the card and below the sheets. It is a portal
    // with one button on it, so a press that is not Continue has to be able
    // to close it — otherwise `priming` sticks and the room comes back with
    // a door over it and no way past.
    if (state() === 'priming') {
      dispatchSingRoom({ type: 'priming-cancel' })
      return true
    }
    if (takeUndecided(ctx())) {
      keepTake()
      return true
    }
    return false
  }

  onMount(() => {
    enterSingRoom()
    onCleanup(props.subscribeFrames(onFrame))

    // What the room thinks is happening, for the walk that drives it.
    // A trace that is not drawing has four possible reasons and a
    // screenshot distinguishes none of them; this says which one it is.
    // Written only under `window.E2E_TEST_MODE`, as everything here is.
    //
    // Deliberately NOT a tracked scope: it is polled by a walk, one call at a
    // time, and reading these signals is the whole job. Nothing subscribes.
    // eslint-disable-next-line solid/reactivity
    exposeForE2E('mpSingRoom', () => ({
      state: ctx().state,
      micIntent: micIntent(ctx()),
      melodyRun: melodyRun(),
      melodyLoaded: ctx().melodyLoaded,
      view: singStageView(ctx()),
      trail: takeRecording.trail.length,
      frames: takeRecording.summary.frameCount,
      elapsedSeconds: takeElapsedSeconds(),
      audioRunning: props.audioRunning(),
      chip: micChipState(ctx(), props.micActive()),
      cardOpen: summary() !== null && ctx().state === 'ended',
    }))
    onCleanup(
      registerRunControls({
        tab: TAB_SINGING,
        roomLabel: roomName('sing'),
        isPlaying: () => runIsLive(ctx()),
        isPaused: () => runIsPaused(ctx()),
        isCountingIn: () => props.isCountingIn(),
        countInBeat: () => props.countInBeat(),
        pause: handlePause,
        resume: handleResume,
        stop: handleStop,
        park: handlePark,
        openOptions: () => {
          dismissCoachMark()
          setOptionsOpen(true)
        },
        // The room name chip in the shell's header. The shell owns no picker,
        // so the chip is a button only because this is here (R5).
        openRoomPicker: () => {
          setPickerOpen(true)
        },
        closeRoomOverlay,
        // The end card IS the decision, so the shell's Keep alert only has
        // something to ask about while that card is open and undecided.
        hasUnsavedTake: () => takeUndecided(ctx()),
      }),
    )
    // Any unmount is a leave: the shell parks a run on its way out, and
    // every other way of leaving the tab still has to release the room.
    // A card still open at that point is kept, never dropped.
    onCleanup(() => {
      if (takeUndecided(ctx())) keepTake()
      dispatchSingRoom({ type: 'leave' })
    })
  })

  // The sheet's switch and the machine's copy of it, kept in step.
  createEffect(() => {
    dispatchSingRoom({ type: 'set-mic-on-arrival', value: singMicOnArrival() })
  })

  // ── Chips, copy and the coach mark ─────────────────────────

  const dismissCoachMark = (): void => {
    if (!singCoachMarkSeen()) setSingCoachMarkSeen(true)
  }

  /**
   * The melody, but only once one was chosen HERE.
   *
   * `melodyStore` always has one: the app loads a default at boot, so asking
   * it directly drew a song chip on a fresh arrival for a melody nobody
   * picked — a melody run announced to somebody the brief opens as a free
   * tracker with no melody at all (§5).
   */
  const songName = (): string | null =>
    ctx().melodyLoaded ? (melodyStore.currentMelody()?.name ?? null) : null

  const changeKey = (next: string): void => {
    setKeyName(next)
    melodyStore.refreshScale(next, melodyStore.getCurrentOctave(), scaleType())
  }

  const changeScale = (next: string): void => {
    setScaleType(next)
    melodyStore.refreshScale(keyName(), melodyStore.getCurrentOctave(), next)
  }

  /**
   * Loading a melody IS starting the melody run (brief §3): there is no
   * second control for it, and a loaded melody sitting silently behind a
   * free tracker is a room that ignored what it was just asked for.
   */
  const startMelodyRun = (): void => {
    dispatchSingRoom({ type: 'melody-play' })
    props.onPlay()
  }

  const openSongPicker = (): void => {
    setOptionsOpen(false)
    setSongOpen(false)
    props.picker.setIsModalOpen(true)
  }

  /**
   * "Remove" on the song sheet: put the melody down (R1).
   *
   * A melody run that is still going ends first, exactly as Stop would end
   * it — the alternative is a trace measured against a target the room has
   * just taken off the screen. The unload follows, so the free tracker is
   * what the room rests into.
   */
  const removeMelody = (): void => {
    setSongOpen(false)
    if (melodyRun() || ctx().melody) handleStop()
    dispatchSingRoom({ type: 'melody-unload' })
  }

  /**
   * The rows the free tracker is read against.
   *
   * NOT the melody's scale. With no melody loaded that scale is one octave
   * somewhere around middle C, and the canvas fits its view to it — so a
   * voice an octave above sat off the top of the canvas and its line was
   * dropped as an out-of-view artifact. The singer's own declared range is
   * the right window for a tracker with nothing to track against, and it is
   * the same answer Zen uses.
   */
  const freeScale = createMemo(() => {
    const range = VOCAL_RANGES[vocalRangePreset()]
    return buildMultiOctaveScale(
      keyName(),
      range.minOctave,
      Math.max(1, range.maxOctave - range.minOctave + 1),
      scaleType(),
    )
  })

  const canvasOptions: SingRoomCanvasOptions = {
    pitchHistory: () =>
      melodyRun() ? props.pitchHistory() : takeRecording.trail,
    melody: () => (melodyRun() ? props.melody() : EMPTY_MELODY),
    scale: () => (melodyRun() ? melodyStore.currentScale() : freeScale()),
    currentBeat: () =>
      melodyRun() ? props.currentBeat() : takeElapsedSeconds(),
    totalBeats: () =>
      melodyRun()
        ? props.totalBeats()
        : Math.max(FREE_WINDOW_SECONDS, takeElapsedSeconds() + 1),
    // A free run has no transport at all, and telling the canvas it is
    // "playing" would start its arc physics over an empty melody. The head
    // dot rides `traceStyle: 'spectrum'` instead.
    isPlaying: () => melodyRun() && props.isPlaying(),
    isPaused: () => melodyRun() && props.isPaused(),
    perNoteBurn: () => singPerNoteBurn(),
    // Nothing arrives while the mic is not capturing and no transport is
    // running, so the picture cannot change. Without this the canvas cleared
    // and repainted a still trace behind the end card fifty-six times a
    // second, on a phone, for nothing.
    frozen: () => !melodyRun() && !micIntent(ctx()),
  }

  /**
   * The same canvas, resting: the loaded melody's target line and nothing
   * else (R1). No trail — a run's leftover line under a target it was never
   * measured against is a picture of something that did not happen — and
   * frozen, because nothing here moves until the capsule is pressed.
   */
  const previewOptions: SingRoomCanvasOptions = {
    pitchHistory: () => EMPTY_HISTORY,
    melody: () => props.melody(),
    scale: () => melodyStore.currentScale(),
    currentBeat: () => 0,
    totalBeats: () => props.totalBeats(),
    isPlaying: () => false,
    isPaused: () => false,
    perNoteBurn: () => false,
    frozen: () => true,
  }

  const onCapsule = (): void => {
    haptics.tapLight()
    // Still inside the tap: iOS un-suspends a context, and promotes the page
    // to the audible session, only from a gesture. Before any await.
    props.primeAudio()
    // One acquisition, and it is the effect's: dispatching moves the state,
    // the effect sees the intent change and opens the device inside this same
    // task. A second `startMic()` here asked the engine twice for one tap.
    dispatchSingRoom({ type: 'sing-a-note' })
  }

  return (
    <div
      class={styles.room}
      data-testid="sing-room"
      style={{
        ...background.resolvedStyle(),
        [SING_GLASS_VAR]: String(glass()),
      }}
    >
      <div class={styles.cover} />
      <div class={styles.scrimDim} />
      <div class={styles.scrimTop} />
      <div class={styles.scrimBottom} />

      <div class={styles.ui}>
        <SingRoomHud
          note={() => noteChipSignal(props.currentPitch())}
          keyLabel={() => keyChipLabel(keyName(), scaleType())}
          micState={() => micChipState(ctx(), props.micActive())}
          micAction={() => micChipAction(ctx())}
          songName={songName}
          onOpenKey={() => {
            dismissCoachMark()
            setOptionsOpen(true)
          }}
          onToggleMic={() => {
            dismissCoachMark()
            // Resting: the chip IS the capsule, gesture and all.
            if (micChipAction(ctx()) === 'start') {
              onCapsule()
              return
            }
            haptics.tapLight()
            dispatchSingRoom({ type: 'toggle-mute' })
          }}
          onOpenSong={() => {
            haptics.tapLight()
            setSongOpen(true)
          }}
          onOpenTakes={() => {
            dismissCoachMark()
            haptics.tapLight()
            setTakesOpen(true)
          }}
        />

        {/* THE ROOM'S OWN VISUALLY-HIDDEN CLASS, not `sr-only`: that class is
            defined in no stylesheet this repository ships, so this live
            region rendered as ordinary text right under the HUD — the second
            "No voice" the owner reported under native (R3). */}
        <span class={styles.srOnly} aria-live="polite">
          {noteChipSignal(props.currentPitch()).announce}
        </span>

        {/* Four pictures, one answer, and the answer is `stage-view.ts` —
            the nest of fallbacks this replaces had the melody preview (R1)
            nowhere to go that could be read in one pass. */}
        <div
          classList={{
            [styles.canvasWrap]: true,
            [styles.canvasResting]: view() === 'melody-preview',
          }}
          data-view={view()}
          data-testid="sing-stage"
        >
          <Switch fallback={<SingTrace variant="silent" />}>
            <Match when={view() === 'run'}>
              {props.renderCanvas(canvasOptions)}
            </Match>
            {/* The same canvas, dimmed and still: the chip says a melody is
                loaded, so the staff shows the line it will be sung against
                rather than an empty dashed one. */}
            <Match when={view() === 'melody-preview'}>
              {props.renderCanvas(previewOptions)}
            </Match>
            <Match when={view() === 'demo'}>
              <div class={styles.traceWrap}>
                <span class={styles.demoChip}>This is what you would see</span>
                <SingTrace variant="demo" labelled />
              </div>
            </Match>
          </Switch>
        </div>

        {/* R0/R1 — the silent trace asks for nothing, and one capsule is the
            moment of intent the permission is asked inside. */}
        <Show when={state() === 'resting'}>
          <div class={styles.foot}>
            <Show when={ctx().permission === 'unknown'}>
              <p classList={{ [styles.display]: true, [styles.onCover]: true }}>
                Hum. The line is you.
              </p>
              <p classList={{ [styles.body]: true, [styles.onCover]: true }}>
                The microphone stays off until you tap.
              </p>
            </Show>
            <button
              type="button"
              class={styles.capsule}
              onClick={onCapsule}
              data-testid="sing-capsule"
            >
              {ctx().melodyLoaded ? 'Continue' : 'Sing a note'}
            </button>
          </div>
        </Show>

        {/* D — usable and honest: a labelled demo line, Settings one tap
            away, and the rooms still open. */}
        <Show when={state() === 'denied'}>
          <div class={styles.foot} data-testid="sing-denied">
            <p classList={{ [styles.head]: true, [styles.onCover]: true }}>
              The microphone is off, so this is a demo line, not yours.
            </p>
            <p classList={{ [styles.body]: true, [styles.onCover]: true }}>
              Turn on the microphone in Settings and the line becomes yours.
              Every room still opens without it.
            </p>
            <button
              type="button"
              class={styles.capsule}
              onClick={() => {
                void nativeShellApi()?.openAppSettings?.()
              }}
              data-testid="sing-open-settings"
            >
              Open Settings
            </button>
            <div class={styles.center}>
              <button
                type="button"
                class={styles.linkQuiet}
                onClick={() => {
                  dispatchSingRoom({ type: 'explore' })
                  setActiveTab(TAB_HOME)
                }}
              >
                Explore the rooms
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* One coach mark, dismissed by use. */}
      <Show when={!singCoachMarkSeen() && state() === 'live'}>
        <div class={styles.coach} data-testid="sing-coach-mark">
          <b class={styles.coachTitle}>{SING_COACH_MARK.title}</b>
          {SING_COACH_MARK.body}
        </div>
      </Show>

      {/* 3b — one screen, then the system alert. Full-screen rather than a
          sheet: it is a door, and a door with a stage behind it invites a tap
          on the stage instead of on Continue. */}
      <Show when={state() === 'priming'}>
        <Portal>
          <div class={styles.priming} data-testid="sing-priming">
            <SingPrimingArt />
            <p class={styles.display}>Hear your voice as a line</p>
            <p class={styles.body}>
              MercuryPitch listens while you sing and draws your pitch on
              screen. Only you can hear you.
            </p>
            <div class={styles.grow} />
            <button
              type="button"
              class={styles.capsule}
              onClick={() => {
                dispatchSingRoom({ type: 'priming-continue' })
                void requestMic()
              }}
              data-testid="sing-priming-continue"
            >
              Continue
            </button>
          </div>
        </Portal>
      </Show>

      <SingTakeSheet
        isOpen={state() === 'ended' && summary() !== null}
        summary={summary()}
        previous={singTakePrevious()}
        startedAt={singTakeClock().startedAt}
        endedAt={singTakeClock().endedAt}
        roomLabel={roomName('sing')}
        onKeep={keepTake}
        onDismiss={keepTake}
        onDiscard={() => {
          clearSingTakeResult()
          dispatchSingRoom({ type: 'take-decided' })
        }}
      />

      <SingRoomPicker
        isOpen={pickerOpen()}
        close={() => setPickerOpen(false)}
        background={background}
        glass={glass}
        onGlassChange={(value) => {
          setGlass(persistSingGlass(value))
        }}
      />

      <SingSongSheet
        isOpen={songOpen()}
        close={() => setSongOpen(false)}
        songName={() => songName() ?? 'The melody'}
        onPlayAgain={() => {
          setSongOpen(false)
          startMelodyRun()
        }}
        onChangeSong={openSongPicker}
        onRemove={removeMelody}
      />

      <SingTakesSheet
        isOpen={takesOpen()}
        close={() => setTakesOpen(false)}
        takes={singTakes}
        onRemove={(id) => {
          haptics.tapLight()
          removeSingTake(id)
        }}
      />

      <SingRoomOptions
        isOpen={optionsOpen()}
        close={() => setOptionsOpen(false)}
        songName={() => songName() ?? 'Pick a song'}
        onOpenSong={openSongPicker}
        onChangeKey={changeKey}
        onChangeScale={changeScale}
        onOctaveShift={(delta) => props.onOctaveShift(delta)}
        speed={props.speed}
        onSpeedChange={props.onSpeedChange}
        volume={props.volume}
        onVolumeChange={props.onVolumeChange}
        metronomeEnabled={props.metronomeEnabled}
        onMetronomeToggle={props.onMetronomeToggle}
        onAutoCalibrate={props.onAutoCalibrate}
        micOnArrival={singMicOnArrival}
        onMicOnArrivalChange={setSingMicOnArrival}
        perNoteBurn={singPerNoteBurn}
        onPerNoteBurnChange={setSingPerNoteBurn}
        onSessionSkip={props.onSessionSkip}
        onSessionEnd={props.onSessionEnd}
      />

      {/* The picker modals: the room hosts them, as the mobile stage did —
          but PORTALLED, like the priming screen and for the same reason. The
          room is `position: fixed` with a z-index, which makes it a stacking
          context, so a modal rendered inside it is trapped below the rail
          whatever z-index it asks for. Measured: a tap on the rail behind the
          open picker changed tab, through the backdrop. */}
      <Portal>
        <Show when={props.picker.isModalOpen()}>
          <MidiSongSelectModal
            prefix="fn"
            melodies={props.picker.melodies}
            savedSongs={savedMidiSongs}
            selectedId={props.picker.selectedId}
            onClose={() => props.picker.setIsModalOpen(false)}
            onPickMelody={(id) => {
              props.picker.setSelectedId(id)
              props.picker.loadMelody(id)
              props.picker.setIsModalOpen(false)
              startMelodyRun()
            }}
            onPickSaved={(song) => {
              props.picker.loadSavedSong(song)
              props.picker.setIsModalOpen(false)
              startMelodyRun()
            }}
            onOpenTracks={(song) => props.picker.openTrackModal(song)}
            onDeleteSaved={(id) => props.picker.deleteSong(id)}
          />
        </Show>

        <Show when={props.picker.trackModalSong()}>
          {(song) => (
            <MidiTrackPickerModal
              song={song}
              prefix="fn"
              radioName="sing-room-score-track"
              pendingScoreId={props.picker.pendingScoreId}
              setPendingScoreId={props.picker.setPendingScoreId}
              pendingBackingIds={props.picker.pendingBackingIds}
              setPendingBackingIds={props.picker.setPendingBackingIds}
              onApply={() => {
                props.picker.applyTrackSelection()
                startMelodyRun()
              }}
              onClose={() => props.picker.setTrackModalSong(null)}
              scoreHint="the track you sing against"
            />
          )}
        </Show>
      </Portal>
    </div>
  )
}
