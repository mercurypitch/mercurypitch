// ============================================================
// Piano Night controller — one replaceable source and one route-owned runtime
// ============================================================
//
// The standalone route stays store-free on first paint. Browser capabilities
// activate only from Play, Connect MIDI, or an on-screen key gesture.

import { batch, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { PianoInputSnapshot, PianoPedalKind, } from '@/features/piano/input/piano-input-state'
import { createPianoInputState } from '@/features/piano/input/piano-input-state'
import { createTouchPianoInputPort } from '@/features/piano/input/touch-piano-input-port'
import type { WebMidiInputPortSnapshot } from '@/features/piano/input/web-midi-input-port'
import { createWebMidiInputPort } from '@/features/piano/input/web-midi-input-port'
import { createPianoAudioClockTransport } from '@/features/piano/runtime/piano-audio-clock-transport'
import { createPianoFallbackSynth } from '@/features/piano/runtime/piano-fallback-synth'
import { createPianoPerformanceScheduler } from '@/features/piano/runtime/piano-performance-scheduler'
import type { PianoPerformanceScoringSource, PianoPerformanceScoringState, PianoPerformanceScoringUpdate, } from '@/features/piano/runtime/piano-performance-scoring'
import { createPianoPerformanceScoringEngine } from '@/features/piano/runtime/piano-performance-scoring'
import { pianoTempoBeatToSeconds } from '@/features/piano/runtime/piano-tempo-map'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { presentationFps, recordAnimationFrame } from '@/lib/device-tier'
import { createAdaptiveFrameRateLimiter } from '@/lib/frame-rate-limiter'
import { createPianoNightActiveMidiIndex } from './piano-night-active-midi-index'
import { createPianoNightArrangement } from './piano-night-arrangement'
import type { PianoNightSource } from './piano-night-source'
import { PIANO_NIGHT_INCLUDED_SOURCE } from './piano-night-source'

const MINIMUM_TEMPO_BPM = 40
const MAXIMUM_TEMPO_BPM = 280

function boundedTempoBpm(tempoBpm: number): number {
  if (!Number.isFinite(tempoBpm)) return 120
  return Math.max(MINIMUM_TEMPO_BPM, Math.min(MAXIMUM_TEMPO_BPM, tempoBpm))
}

function sameMidiSet(
  previous: ReadonlySet<number>,
  next: ReadonlySet<number>,
): boolean {
  if (previous.size !== next.size) return false
  for (const midiNote of previous) {
    if (!next.has(midiNote)) return false
  }
  return true
}

function scoringSourceFor(
  source: PianoNightSource,
): PianoPerformanceScoringSource {
  const tempoMap = source.stage.tempoMap
  return Object.freeze({
    sourceId: source.id,
    notes: source.stage.notes,
    scoreTimeAtBeatMs: (beat: number) =>
      pianoTempoBeatToSeconds(tempoMap, beat) * 1000,
  })
}

export function usePianoNightController() {
  const [source, setSource] = createSignal<PianoNightSource>(
    PIANO_NIGHT_INCLUDED_SOURCE,
  )
  const stage = () => source().stage
  const arrangement = createMemo(() => createPianoNightArrangement(source()))
  const projectActiveMidis = createMemo(() =>
    createPianoNightActiveMidiIndex(stage().notes),
  )
  const transport = createPianoAudioClockTransport({
    totalBeats: () => stage().totalBeats,
    tempoMap: () => stage().tempoMap,
    initialTempoBpm: stage().initialTempoBpm,
  })
  const synth = createPianoFallbackSynth({
    getAudioContext: () => transport.getAudioContext(),
  })
  const scheduler = createPianoPerformanceScheduler({
    transport,
    notes: () => arrangement().audibleNotes,
    synth,
  })
  const input = createPianoInputState()
  const scoring = createPianoPerformanceScoringEngine(
    // eslint-disable-next-line solid/reactivity -- one-time seed; source swaps are explicit below
    scoringSourceFor(source()),
    { playheadBeat: 0, input: input.snapshot() },
  )
  const touch = createTouchPianoInputPort({
    input,
    sourceId: 'piano-night-keys',
    sourceName: 'Piano Night keys',
    defaultVelocity: 0.78,
  })
  const midi = createWebMidiInputPort({
    onInput: (event) => input.apply(event),
  })

  const [playheadBeat, setPlayheadBeat] = createSignal(0)
  const [inputSnapshot, setInputSnapshot] = createSignal<PianoInputSnapshot>(
    input.snapshot(),
  )
  const [midiSnapshot, setMidiSnapshot] =
    createSignal<WebMidiInputPortSnapshot>(midi.snapshot())
  const [observedPedals, setObservedPedals] = createSignal<
    ReadonlySet<PianoPedalKind>
  >(new Set())
  const [audioError, setAudioError] = createSignal<string | null>(null)
  const [audioActive, setAudioActive] = createSignal(false)
  const [reducedMotion, setReducedMotion] = createSignal(false)
  const [scoringState, setScoringState] =
    createSignal<PianoPerformanceScoringState>(scoring.snapshot())
  const [statusMessage, setStatusMessage] = createSignal(
    `${stage().title} is ready. Audio and input are off.`,
  )

  const pendingPointers = new Map<number, number>()
  const keyboardReleaseTimers = new Map<number, number>()
  let frame: number | null = null
  let uninstallAudioUnlock: (() => void) | null = null
  let commandGeneration = 0
  let completionSettled = false
  let disposed = false

  const releaseLiveVoices = (): void => {
    pendingPointers.clear()
    for (const timer of keyboardReleaseTimers.values()) {
      window.clearTimeout(timer)
    }
    keyboardReleaseTimers.clear()
    touch.releaseAll()
    input.apply({ type: 'panic', timestampMs: performance.now() })
    synth.panic()
  }

  const activeMidis = createMemo<ReadonlySet<number>>(
    () => {
      const active = new Set(
        inputSnapshot().soundingNotes.map((voice) => voice.midi),
      )
      if (transport.phase() === 'playing') {
        for (const midiNote of projectActiveMidis().atBeat(playheadBeat())) {
          active.add(midiNote)
        }
      }
      return active
    },
    new Set<number>(),
    { equals: sameMidiSet },
  )

  const scoringPlaybackRate = (beat: number): number => {
    const authoredTempo = transport.authoredTempoBpmAtBeat(beat)
    return transport.effectiveTempoBpmAtBeat(beat) / authoredTempo
  }

  const applyScoringUpdate = (update: PianoPerformanceScoringUpdate): void => {
    if (update.state.revision !== scoringState().revision) {
      setScoringState(update.state)
    }
  }

  const sampleScoring = (
    snapshot: PianoInputSnapshot,
    beat: number,
    phase = transport.phase(),
  ): void => {
    applyScoringUpdate(
      scoring.sample({
        phase,
        playheadBeat: beat,
        sampledAtMs: performance.now(),
        playbackRate: scoringPlaybackRate(beat),
        input: snapshot,
      }),
    )
  }

  const cancelFrame = (): void => {
    if (frame === null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  const settleCompletion = (beat: number): void => {
    if (completionSettled) return
    completionSettled = true
    sampleScoring(input.snapshot(), beat, 'complete')
    scheduler.stop()
    releaseLiveVoices()
    setStatusMessage(`${stage().title} complete. Ready to play again.`)
  }

  // Presentation cap: every setPlayheadBeat write re-renders the falling
  // notes and key glow, and on a low-tier device (a television) capping that
  // hands the saved budget back to the audio thread. Capable devices keep an
  // uncapped clock (presentationFps() is Infinity, so the limiter passes
  // everything). Adaptive on purpose: recordAnimationFrame below is what
  // demotes a struggling device, and the cap must land on THIS session, not
  // the next mount. Scoring still samples EVERY frame — it is cheap next to
  // a render, and capping it would coarsen hit timing.
  const presentationLimiter = createAdaptiveFrameRateLimiter(presentationFps)

  const sampleClock = (timestampMs: number): void => {
    recordAnimationFrame(timestampMs)
    const beat = transport.timeline.playheadBeat()
    const phase = transport.phase()
    if (
      presentationLimiter.shouldRun(timestampMs / 1000) ||
      // The final position must land exactly, cap or no cap.
      phase !== 'playing'
    ) {
      setPlayheadBeat(beat)
    }
    if (phase !== 'playing') {
      frame = null
      if (phase === 'complete') settleCompletion(beat)
      else scheduler.stop()
      return
    }
    sampleScoring(input.snapshot(), beat, phase)
    frame = requestAnimationFrame(sampleClock)
  }

  const startFrame = (): void => {
    if (frame === null) frame = requestAnimationFrame(sampleClock)
  }

  const syncTransport = (): void => {
    const beat = transport.timeline.playheadBeat()
    const phase = transport.phase()
    setPlayheadBeat(beat)
    if (phase === 'playing') {
      completionSettled = false
      startFrame()
      return
    }
    cancelFrame()
    if (phase === 'complete') settleCompletion(beat)
    else scheduler.stop()
  }

  const armAudioRecovery = (): void => {
    if (uninstallAudioUnlock !== null) return
    uninstallAudioUnlock = installAudioUnlock(() => transport.getAudioContext())
  }

  const activateAudio = async (): Promise<boolean> => {
    const activated = await transport.activate()
    if (disposed) return false
    if (activated) {
      armAudioRecovery()
      setAudioActive(true)
      setAudioError(null)
      return true
    }
    const message =
      "Audio could not start. Check this browser's audio permission and try again."
    setAudioError(message)
    setStatusMessage(message)
    return false
  }

  // These route-owned imperative ports invoke callbacks outside Solid's graph.
  // eslint-disable-next-line solid/reactivity -- external transport callback
  const unsubscribeTransport = transport.subscribe(syncTransport)
  const unsubscribeMidi = midi.subscribe(setMidiSnapshot)
  // eslint-disable-next-line solid/reactivity -- external input callback
  const unsubscribeInput = input.subscribe((update) => {
    if (update.event.type === 'pedal') {
      const pedal = update.event.pedal
      setObservedPedals((current) => {
        const next = new Set<PianoPedalKind>(current)
        next.add(pedal)
        return next
      })
    } else if (
      update.event.type === 'source-disconnected' ||
      update.event.type === 'panic'
    ) {
      setObservedPedals(new Set<PianoPedalKind>())
    }
    for (const voice of update.soundingStarted) {
      synth.noteOn({
        id: `live:${voice.id}`,
        midi: voice.midi,
        velocity: voice.velocity,
        softPedalValue: voice.softPedalValue,
      })
    }
    for (const voice of update.soundingStopped) {
      synth.noteOff(`live:${voice.id}`)
    }
    setInputSnapshot(update.snapshot)
    sampleScoring(
      update.snapshot,
      transport.timeline.playheadBeat(),
      transport.phase(),
    )
  })

  const play = async (): Promise<boolean> => {
    const generation = commandGeneration
    const previousPhase = transport.phase()
    const started = await transport.play()
    if (disposed || generation !== commandGeneration) return false
    syncTransport()
    if (!started) {
      setAudioError(transport.error())
      setStatusMessage(
        transport.error() ?? 'The prepared score could not start.',
      )
      return false
    }
    armAudioRecovery()
    setAudioActive(true)
    setAudioError(null)
    const resumedPosition = {
      playheadBeat: transport.timeline.playheadBeat(),
      input: input.snapshot(),
    }
    applyScoringUpdate(
      previousPhase === 'complete'
        ? scoring.reset(resumedPosition)
        : scoring.discontinue({ reason: 'resume', ...resumedPosition }),
    )
    scheduler.start()
    startFrame()
    setStatusMessage(
      `Playing ${stage().title} with the built-in fallback synth.`,
    )
    return true
  }

  const pause = (): void => {
    commandGeneration += 1
    transport.pause()
    scheduler.stop()
    applyScoringUpdate(
      scoring.discontinue({
        reason: 'pause',
        playheadBeat: transport.timeline.playheadBeat(),
        input: input.snapshot(),
      }),
    )
    releaseLiveVoices()
    syncTransport()
    setStatusMessage('Playback paused.')
  }

  const togglePlayback = (): void => {
    if (transport.phase() === 'playing') pause()
    else void play()
  }

  const seekToBeat = (beat: number): void => {
    const targetBeat = Number.isFinite(beat)
      ? Math.min(stage().totalBeats, Math.max(0, beat))
      : 0
    applyScoringUpdate(
      scoring.discontinue({
        reason: 'seek',
        playheadBeat: targetBeat,
        input: input.snapshot(),
      }),
    )
    transport.seekToBeat(targetBeat)
    releaseLiveVoices()
    if (transport.phase() === 'playing') scheduler.refresh()
    else scheduler.stop()
    syncTransport()
  }

  const setTempoBpm = (tempoBpm: number): void => {
    applyScoringUpdate(
      scoring.discontinue({
        reason: 'rate-change',
        playheadBeat: transport.timeline.playheadBeat(),
        input: input.snapshot(),
      }),
    )
    transport.setTempoBpm(boundedTempoBpm(tempoBpm))
    if (transport.phase() === 'playing') scheduler.refresh()
    syncTransport()
    setStatusMessage(
      `Tempo set to ${Math.round(transport.timeline.tempoBpm())} BPM.`,
    )
  }

  const replaceSource = (nextSource: PianoNightSource): boolean => {
    if (
      disposed ||
      nextSource.stage.notes.length === 0 ||
      !(nextSource.stage.totalBeats > 0)
    ) {
      return false
    }

    commandGeneration += 1
    scheduler.stop()
    cancelFrame()
    transport.stop()
    releaseLiveVoices()
    completionSettled = false
    batch(() => {
      setSource(nextSource)
      transport.setTempoBpm(boundedTempoBpm(nextSource.stage.initialTempoBpm))
      setScoringState(
        scoring.replaceSource(scoringSourceFor(nextSource), {
          playheadBeat: 0,
          input: input.snapshot(),
        }).state,
      )
      setPlayheadBeat(0)
      setAudioError(null)
      setStatusMessage(`${nextSource.stage.title} is ready.`)
    })
    return true
  }

  const connectMidi = async (): Promise<boolean> => {
    setStatusMessage('Requesting MIDI access.')
    // Both requests begin inside the same explicit click gesture.
    const audioRequest = activateAudio()
    const midiRequest = midi.connect()
    const [audioReady, midiReady] = await Promise.all([
      audioRequest,
      midiRequest,
    ])
    if (disposed) return false
    const snapshot = midi.snapshot()
    setMidiSnapshot(snapshot)
    if (!audioReady) return false
    if (midiReady) {
      setStatusMessage('MIDI keyboard connected to the fallback synth.')
      return true
    }
    const message =
      snapshot.permission === 'unsupported'
        ? 'Web MIDI is not supported in this browser. Touch keys remain available.'
        : snapshot.permission === 'denied'
          ? 'MIDI access was denied. Allow it in browser settings, then retry.'
          : 'No MIDI input is available. Connect a keyboard, then retry.'
    setStatusMessage(message)
    return false
  }

  const disconnectMidi = (): void => {
    midi.disconnect()
    setMidiSnapshot(midi.snapshot())
    setStatusMessage('MIDI input disconnected. Touch keys remain available.')
  }

  const selectMidiInput = (inputId: string | null): boolean => {
    const selected = midi.selectInput(inputId)
    setMidiSnapshot(midi.snapshot())
    if (selected) {
      const device = midi
        .snapshot()
        .devices.find((candidate) => candidate.id === inputId)
      setStatusMessage(
        device === undefined
          ? 'MIDI input disconnected.'
          : `${device.name} selected for Piano Night.`,
      )
    }
    return selected
  }

  const pressTouchKey = (event: PointerEvent, midiNote: number): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault()
    const target = event.currentTarget as HTMLElement | null
    target?.setPointerCapture?.(event.pointerId)
    pendingPointers.set(event.pointerId, midiNote)
    const pointerId = event.pointerId
    void activateAudio().then((activated) => {
      if (!activated || disposed) {
        pendingPointers.delete(pointerId)
        return
      }
      const pendingMidi = pendingPointers.get(pointerId)
      if (pendingMidi === undefined) return
      touch.press(pointerId, pendingMidi)
      setStatusMessage(`Playing ${pendingMidi} from the touch keyboard.`)
    })
  }

  const moveTouchKey = (event: PointerEvent): void => {
    const active = touch
      .activePointers()
      .some((pointer) => pointer.pointerId === event.pointerId)
    if (!active && !pendingPointers.has(event.pointerId)) return
    const key = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-midi]')
    const midiNote = Number(key?.dataset.midi)
    if (!Number.isFinite(midiNote)) return
    if (pendingPointers.has(event.pointerId)) {
      pendingPointers.set(event.pointerId, midiNote)
    } else {
      touch.move(event.pointerId, midiNote)
    }
  }

  const releaseTouchKey = (event: PointerEvent): void => {
    pendingPointers.delete(event.pointerId)
    touch.release(event.pointerId)
    const target = event.currentTarget as HTMLElement | null
    if (target?.hasPointerCapture?.(event.pointerId) === true) {
      target.releasePointerCapture(event.pointerId)
    }
  }

  const playKeyboardKey = (midiNote: number): void => {
    const pointerId = -1000 - midiNote
    pendingPointers.set(pointerId, midiNote)
    void activateAudio().then((activated) => {
      if (!activated || disposed) {
        pendingPointers.delete(pointerId)
        return
      }
      if (pendingPointers.get(pointerId) !== midiNote) return
      touch.press(pointerId, midiNote)
      const previousTimer = keyboardReleaseTimers.get(pointerId)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      const timer = window.setTimeout(() => {
        pendingPointers.delete(pointerId)
        touch.release(pointerId)
        keyboardReleaseTimers.delete(pointerId)
      }, 420)
      keyboardReleaseTimers.set(pointerId, timer)
      setStatusMessage(`Playing ${midiNote} from the keyboard horizon.`)
    })
  }

  const panic = (message = 'All Piano Night notes released.'): void => {
    releaseLiveVoices()
    setStatusMessage(message)
  }

  onMount(() => {
    const motion =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null
    const syncMotion = (): void => {
      setReducedMotion(motion?.matches ?? false)
    }
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') return
      pause()
      panic(
        'Playback paused and all notes released while Piano Night is hidden.',
      )
    }
    syncMotion()
    motion?.addEventListener?.('change', syncMotion)
    document.addEventListener('visibilitychange', onVisibility)

    onCleanup(() => {
      motion?.removeEventListener?.('change', syncMotion)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  })

  onCleanup(() => {
    disposed = true
    commandGeneration += 1
    pendingPointers.clear()
    for (const timer of keyboardReleaseTimers.values()) {
      window.clearTimeout(timer)
    }
    keyboardReleaseTimers.clear()
    cancelFrame()
    scheduler.dispose()
    transport.pause()
    midi.dispose()
    touch.dispose()
    input.apply({ type: 'panic', timestampMs: performance.now() })
    unsubscribeMidi()
    unsubscribeInput()
    unsubscribeTransport()
    synth.dispose()
    uninstallAudioUnlock?.()
    uninstallAudioUnlock = null
    void transport.dispose()
  })

  return {
    source,
    stage,
    arrangement,
    transport,
    playheadBeat,
    activeMidis,
    inputSnapshot,
    midiSnapshot,
    observedPedals,
    audioError,
    audioActive,
    reducedMotion,
    statusMessage,
    scoringState,
    play,
    pause,
    togglePlayback,
    seekToBeat,
    setTempoBpm,
    replaceSource,
    connectMidi,
    disconnectMidi,
    selectMidiInput,
    pressTouchKey,
    moveTouchKey,
    releaseTouchKey,
    playKeyboardKey,
    panic,
  }
}

export type PianoNightController = ReturnType<typeof usePianoNightController>
