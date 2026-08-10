// ============================================================
// Piano Night controller — one project, audio clock, input owner, and synth lifetime
// ============================================================
//
// The standalone route stays store-free on first paint. Browser capabilities
// activate only from Play, Connect MIDI, or an on-screen key gesture.

import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import type { PianoInputSnapshot, PianoPedalKind, } from '@/features/piano/input/piano-input-state'
import { createPianoInputState } from '@/features/piano/input/piano-input-state'
import { createTouchPianoInputPort } from '@/features/piano/input/touch-piano-input-port'
import type { WebMidiInputPortSnapshot } from '@/features/piano/input/web-midi-input-port'
import { createWebMidiInputPort } from '@/features/piano/input/web-midi-input-port'
import { createPianoAudioClockTransport } from '@/features/piano/runtime/piano-audio-clock-transport'
import { createPianoFallbackSynth } from '@/features/piano/runtime/piano-fallback-synth'
import { createPianoPerformanceScheduler } from '@/features/piano/runtime/piano-performance-scheduler'
import { pianoProjectToStage } from '@/features/piano/runtime/piano-project-stage'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { PIANO_NIGHT_DEMO_PROJECT } from './piano-night-demo-project'

const stage = pianoProjectToStage(PIANO_NIGHT_DEMO_PROJECT)

export function usePianoNightController() {
  const transport = createPianoAudioClockTransport({
    totalBeats: () => stage.totalBeats,
    initialTempoBpm: stage.initialTempoBpm,
  })
  const synth = createPianoFallbackSynth({
    getAudioContext: () => transport.getAudioContext(),
  })
  const scheduler = createPianoPerformanceScheduler({
    transport,
    notes: stage.notes,
    synth,
  })
  const input = createPianoInputState()
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
  const [statusMessage, setStatusMessage] = createSignal(
    'Afterglow Study is ready. Audio and input are off.',
  )

  const pendingPointers = new Map<number, number>()
  const keyboardReleaseTimers = new Map<number, number>()
  let frame: number | null = null
  let uninstallAudioUnlock: (() => void) | null = null
  let disposed = false

  const activeMidis = createMemo<ReadonlySet<number>>(() => {
    const active = new Set(
      inputSnapshot().soundingNotes.map((voice) => voice.midi),
    )
    if (transport.phase() === 'playing') {
      const beat = playheadBeat()
      for (const note of stage.notes) {
        if (note.startBeat <= beat && note.startBeat + note.duration > beat) {
          active.add(note.midi)
        }
      }
    }
    return active
  })

  const cancelFrame = (): void => {
    if (frame === null) return
    cancelAnimationFrame(frame)
    frame = null
  }

  const sampleClock = (): void => {
    setPlayheadBeat(transport.timeline.playheadBeat())
    if (transport.phase() !== 'playing') {
      frame = null
      scheduler.stop()
      if (transport.phase() === 'complete') {
        setStatusMessage('Afterglow Study complete. Ready to play again.')
      }
      return
    }
    frame = requestAnimationFrame(sampleClock)
  }

  const startFrame = (): void => {
    if (frame === null) frame = requestAnimationFrame(sampleClock)
  }

  const syncTransport = (): void => {
    setPlayheadBeat(transport.timeline.playheadBeat())
    if (transport.phase() === 'playing') startFrame()
    else cancelFrame()
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

  const unsubscribeTransport = transport.subscribe(syncTransport)
  const unsubscribeMidi = midi.subscribe(setMidiSnapshot)
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
  })

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

  const play = async (): Promise<boolean> => {
    const started = await transport.play()
    if (disposed) return false
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
    scheduler.start()
    startFrame()
    setStatusMessage(
      'Playing Afterglow Study with the built-in fallback synth.',
    )
    return true
  }

  const pause = (): void => {
    transport.pause()
    scheduler.stop()
    releaseLiveVoices()
    syncTransport()
    setStatusMessage('Playback paused.')
  }

  const togglePlayback = (): void => {
    if (transport.phase() === 'playing') pause()
    else void play()
  }

  const seekToBeat = (beat: number): void => {
    transport.seekToBeat(beat)
    releaseLiveVoices()
    if (transport.phase() === 'playing') scheduler.refresh()
    else scheduler.stop()
    syncTransport()
  }

  const setTempoBpm = (tempoBpm: number): void => {
    transport.setTempoBpm(Math.max(40, Math.min(160, tempoBpm)))
    if (transport.phase() === 'playing') scheduler.refresh()
    syncTransport()
    setStatusMessage(
      `Tempo set to ${Math.round(transport.timeline.tempoBpm())} BPM.`,
    )
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
    stage,
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
    play,
    pause,
    togglePlayback,
    seekToBeat,
    setTempoBpm,
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
