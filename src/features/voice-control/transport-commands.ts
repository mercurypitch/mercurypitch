// ============================================================
// Transport voice commands — the phase-1 spoken command set
// ============================================================
//
// Built from the SAME handler surface the keyboard shortcuts use
// (KeyboardShortcutHandlers), so a spoken "play" can only ever do what
// pressing Space already does — one transport path, no drift. Tab routing
// mirrors useKeyboardShortcuts: Piano routes to the falling-notes game,
// Guitar to its toggle, Compose to the editor, and Karaoke is excluded
// until it contributes its own command set (it owns a separate audio
// graph). Seek and loop go through App's active-tab transport accessor —
// the same one the A-B loop buttons use — so beats always track the
// playhead the user is watching.

import type { Accessor } from 'solid-js'
import type { KeyboardShortcutHandlers } from '@/features/keyboard/useKeyboardShortcuts'
import { tryDismissModal } from '@/features/keyboard/useKeyboardShortcuts'
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, TAB_COMPOSE, TAB_GUITAR, TAB_KARAOKE, TAB_PIANO, TAB_SINGING, } from '@/features/tabs/constants'
import * as transportStore from '@/stores/transport-store'
import { ABSOLUTE_MINUTES_PHRASES, ABSOLUTE_SECONDS_PHRASES, BACK_MINUTES_PHRASES, BACK_SECONDS_PHRASES, END_PHRASES, FORWARD_MINUTES_PHRASES, FORWARD_SECONDS_PHRASES, LOOP_CLEAR_PHRASES, LOOP_OFF_PHRASES, LOOP_ON_PHRASES, LOOP_RANGE_PHRASES, LOOP_SET_A_PHRASES, LOOP_SET_B_PHRASES, LOOP_TOGGLE_PHRASES, MIDDLE_PHRASES, PAUSE_PHRASES, PLAY_PHRASES, RESTART_PHRASES, SEEK_START_PHRASES, SPEED_FASTER_PHRASES, SPEED_MULTIPLIER_PHRASES, SPEED_PRESETS, SPEED_SLOWER_PHRASES, SPEED_SPOKEN_PHRASES, STOP_PHRASES, } from './shared-phrases'
import type { VoiceCommand, VoiceCommandResult } from './types'
import { voiceFailure } from './types'

export interface TransportVoiceLoopDeps {
  enabled: Accessor<boolean>
  a: Accessor<number>
  b: Accessor<number>
  setA: () => void
  setB: () => void
  /** Place a marker at an absolute beat (the marker-drag handlers). */
  moveA: (beat: number) => void
  moveB: (beat: number) => void
  toggle: () => void
  clear: () => void
}

export interface TransportVoiceDeps {
  handlers: KeyboardShortcutHandlers
  /** Active-tab transport (App's loopTransport): beats in, beats out. */
  transport: () => {
    beat: () => number
    total: () => number
    seekTo: (beat: number) => void
  }
  bpm: Accessor<number>
  loop: TransportVoiceLoopDeps
}

/** Same ladder the ArrowUp/ArrowDown speed shortcuts climb. */
const SPEED_STEPS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0]

function formatSpeed(multiplier: number): string {
  return `Speed ${String(multiplier)}x`
}

export function createTransportVoiceCommands(
  deps: TransportVoiceDeps,
): VoiceCommand[] {
  const tab = () => deps.handlers.activeTab?.()
  const suspended = () => deps.handlers.isSuspended?.() === true

  // Mirrors the keyboard hook's Karaoke exclusion: the StemMixer drives its
  // own audio graph, so global transport commands must not reach it.
  const transportTab = () => !suspended() && tab() !== TAB_KARAOKE
  // Tabs whose playhead the shared beat transport actually drives.
  const seekableTab = () => {
    if (suspended()) return false
    const t = tab()
    return (
      t === undefined ||
      t === TAB_SINGING ||
      t === TAB_COMPOSE ||
      t === TAB_PIANO
    )
  }

  // ── Play / pause / stop, routed per tab like the Space key ──

  const doPlay = (): VoiceCommandResult => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      const gs = deps.handlers.piano.gameState()
      if (gs === 'playing') return voiceFailure('Already playing')
      if (gs === 'paused') {
        deps.handlers.piano.resumeGame()
        return 'Resume'
      }
      deps.handlers.piano.startGame()
      return 'Play'
    }
    if (t === TAB_GUITAR && deps.handlers.guitar?.togglePlayback) {
      deps.handlers.guitar.togglePlayback()
      return 'Toggle playback'
    }
    if (t === TAB_COMPOSE && deps.handlers.editor) {
      const editor = deps.handlers.editor
      if (editor.isPlaying()) return voiceFailure('Already playing')
      if (editor.isPaused()) {
        editor.resume()
        return 'Resume'
      }
      void editor.play()
      return 'Play'
    }
    if (deps.handlers.isPlaying()) return voiceFailure('Already playing')
    if (deps.handlers.isPaused()) {
      deps.handlers.resume()
      return 'Resume'
    }
    deps.handlers.play()
    return 'Play'
  }

  const doPause = (): VoiceCommandResult => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      if (deps.handlers.piano.gameState() === 'playing') {
        deps.handlers.piano.pauseGame()
        return 'Pause'
      }
      return voiceFailure('Nothing playing')
    }
    if (t === TAB_GUITAR && deps.handlers.guitar?.togglePlayback) {
      deps.handlers.guitar.togglePlayback()
      return 'Toggle playback'
    }
    if (t === TAB_COMPOSE && deps.handlers.editor) {
      if (deps.handlers.editor.isPlaying()) {
        deps.handlers.editor.pause()
        return 'Pause'
      }
      return voiceFailure('Nothing playing')
    }
    if (deps.handlers.isPlaying()) {
      deps.handlers.pause()
      return 'Pause'
    }
    return voiceFailure('Nothing playing')
  }

  const doStop = (): VoiceCommandResult => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      const gs = deps.handlers.piano.gameState()
      if (gs === 'idle') return voiceFailure('Nothing playing')
      deps.handlers.piano.resetGame()
      return 'Stop'
    }
    if (t === TAB_GUITAR && deps.handlers.guitar?.togglePlayback) {
      deps.handlers.guitar.togglePlayback()
      return 'Toggle playback'
    }
    if (t === TAB_COMPOSE && deps.handlers.editor) {
      if (deps.handlers.editor.isPlaying()) {
        deps.handlers.editor.pause()
        return 'Pause'
      }
      return voiceFailure('Nothing playing')
    }
    deps.handlers.stop()
    return 'Stop'
  }

  const doRestart = (): VoiceCommandResult => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      deps.handlers.piano.resetGame()
      deps.handlers.piano.startGame()
      return 'From the top'
    }
    if (t === TAB_GUITAR) {
      // The guitar transports (drum loop / tab playback) have no seek —
      // phase 3 gives Guitar its own command set.
      return voiceFailure('Not on this tab yet')
    }
    deps.transport().seekTo(0)
    if (t === TAB_COMPOSE && deps.handlers.editor) {
      // The editor has its own pause state — the singing accessors do not
      // see it.
      const editor = deps.handlers.editor
      if (editor.isPaused()) editor.resume()
      else if (!editor.isPlaying()) void editor.play()
      return 'From the top'
    }
    if (deps.handlers.isPaused()) {
      deps.handlers.resume()
    } else if (!deps.handlers.isPlaying()) {
      deps.handlers.play()
    }
    return 'From the top'
  }

  // ── Seeking ────────────────────────────────────────────────

  const seekRelativeBeats = (deltaBeats: number): void => {
    const t = deps.transport()
    const total = t.total()
    const cap = total > 0 ? total : Number.POSITIVE_INFINITY
    t.seekTo(Math.min(Math.max(t.beat() + deltaBeats, 0), cap))
  }

  const seekSeconds = (deltaSeconds: number): string => {
    seekRelativeBeats((deltaSeconds * deps.bpm()) / 60)
    const magnitude = Math.abs(deltaSeconds)
    return `${deltaSeconds >= 0 ? 'Forward' : 'Back'} ${String(magnitude)}s`
  }

  const seekBeats = (deltaBeats: number): string => {
    seekRelativeBeats(deltaBeats)
    const magnitude = Math.abs(deltaBeats)
    const unit = magnitude === 1 ? 'beat' : 'beats'
    return `${deltaBeats >= 0 ? 'Forward' : 'Back'} ${String(magnitude)} ${unit}`
  }

  const seekMinutes = (deltaMinutes: number): string => {
    seekRelativeBeats(deltaMinutes * deps.bpm())
    const magnitude = Math.abs(deltaMinutes)
    return `${deltaMinutes >= 0 ? 'Forward' : 'Back'} ${String(magnitude)} min`
  }

  const secondsToBeats = (seconds: number): number =>
    (seconds * deps.bpm()) / 60

  const seekAbsoluteSeconds = (seconds: number): VoiceCommandResult => {
    const t = deps.transport()
    const total = t.total()
    if (total <= 0) return voiceFailure('Nothing loaded')
    t.seekTo(Math.min(Math.max(secondsToBeats(seconds), 0), total))
    const minutes = Math.floor(seconds / 60)
    const rest = Math.round(seconds % 60)
    const shown =
      minutes > 0
        ? `${String(minutes)}:${String(rest).padStart(2, '0')}`
        : `${String(rest)}s`
    return `Go to ${shown}`
  }

  const seekFraction = (
    fraction: number,
    label: string,
  ): VoiceCommandResult => {
    const t = deps.transport()
    const total = t.total()
    if (total <= 0) return voiceFailure('Nothing loaded')
    // "The end" lands a couple of seconds short so the runtime's natural
    // end-of-track handling is not raced by the seek itself.
    const margin = fraction >= 1 ? secondsToBeats(2) : 0
    t.seekTo(Math.min(Math.max(total * fraction - margin, 0), total))
    return label
  }

  // ── Speed ──────────────────────────────────────────────────

  const stepSpeed = (direction: 1 | -1): string => {
    const current = transportStore.playbackSpeed()
    let nearest = 0
    let bestDistance = Number.POSITIVE_INFINITY
    for (let i = 0; i < SPEED_STEPS.length; i++) {
      const distance = Math.abs(SPEED_STEPS[i] - current)
      if (distance < bestDistance) {
        bestDistance = distance
        nearest = i
      }
    }
    const next =
      SPEED_STEPS[
        Math.min(Math.max(nearest + direction, 0), SPEED_STEPS.length - 1)
      ]
    transportStore.setPlaybackSpeed(next)
    return formatSpeed(next)
  }

  const setSpeed = (multiplier: number): string => {
    transportStore.setPlaybackSpeed(multiplier)
    return formatSpeed(transportStore.playbackSpeed())
  }

  const setSpokenSpeed = (raw: number | undefined): VoiceCommandResult => {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
      return voiceFailure('Speed unchanged')
    }
    // "speed 75" and "speed 150 percent" both mean percent; a small number
    // ("speed 1.5") reads as a multiplier.
    return setSpeed(raw > 2.5 ? raw / 100 : raw)
  }

  const speedPreset = (
    id: string,
    multiplier: number,
    phrases: string[],
  ): VoiceCommand => ({
    id,
    label: formatSpeed(multiplier),
    phrases,
    available: seekableTab,
    run: () => setSpeed(multiplier),
  })

  // ── Tempo (bpm) and count-in ───────────────────────────────

  const formatTempo = (): string => `Tempo ${String(transportStore.bpm())} bpm`

  const setTempo = (raw: number | undefined): VoiceCommandResult => {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
      return voiceFailure('Tempo unchanged')
    }
    transportStore.setBpm(raw)
    return formatTempo()
  }

  /** Distinct from playback-speed steps: bpm moves in 10-beat nudges. */
  const TEMPO_NUDGE_BPM = 10

  const nudgeTempo = (delta: number): string => {
    transportStore.setBpm(transportStore.bpm() + delta)
    return formatTempo()
  }

  const setCountInBars = (raw: number | undefined): VoiceCommandResult => {
    if (raw === 0) {
      transportStore.setCountIn(0)
      return 'Count-in off'
    }
    if (raw === 1 || raw === 2 || raw === 4) {
      transportStore.setCountIn(raw)
      return `Count-in ${String(raw)} ${raw === 1 ? 'bar' : 'bars'}`
    }
    return voiceFailure('Count-in can be 1, 2 or 4 bars')
  }

  // ── The set ────────────────────────────────────────────────

  return [
    {
      id: 'transport.play',
      label: 'Play',
      phrases: PLAY_PHRASES,
      available: transportTab,
      run: () => doPlay(),
    },
    {
      id: 'transport.pause',
      label: 'Pause',
      phrases: PAUSE_PHRASES,
      available: transportTab,
      run: () => doPause(),
    },
    {
      id: 'transport.stop',
      label: 'Stop',
      phrases: STOP_PHRASES,
      available: transportTab,
      run: () => doStop(),
    },
    {
      id: 'transport.restart',
      label: 'From the top',
      phrases: RESTART_PHRASES,
      available: transportTab,
      run: () => doRestart(),
    },
    {
      id: 'transport.seekStart',
      label: 'Go to start',
      phrases: SEEK_START_PHRASES,
      available: seekableTab,
      run: () => {
        deps.transport().seekTo(0)
        return 'Go to start'
      },
    },
    {
      id: 'seek.absoluteSeconds',
      label: 'Go to time',
      phrases: ABSOLUTE_SECONDS_PHRASES,
      available: seekableTab,
      run: (args) => seekAbsoluteSeconds(args.n ?? 0),
    },
    {
      id: 'seek.absoluteMinutes',
      label: 'Go to time',
      phrases: ABSOLUTE_MINUTES_PHRASES,
      available: seekableTab,
      run: (args) => seekAbsoluteSeconds((args.n ?? 0) * 60),
    },
    {
      id: 'seek.middle',
      label: 'Go to the middle',
      phrases: MIDDLE_PHRASES,
      available: seekableTab,
      run: () => seekFraction(0.5, 'Go to the middle'),
    },
    {
      id: 'seek.end',
      label: 'Go to the end',
      phrases: END_PHRASES,
      available: seekableTab,
      run: () => seekFraction(1, 'Go to the end'),
    },
    {
      id: 'seek.forwardSeconds',
      label: 'Skip forward',
      phrases: FORWARD_SECONDS_PHRASES,
      available: seekableTab,
      run: (args) => seekSeconds(args.n ?? 10),
    },
    {
      id: 'seek.backSeconds',
      label: 'Skip back',
      phrases: BACK_SECONDS_PHRASES,
      available: seekableTab,
      run: (args) => seekSeconds(-(args.n ?? 10)),
    },
    {
      id: 'seek.forwardMinutes',
      label: 'Skip forward',
      phrases: FORWARD_MINUTES_PHRASES,
      available: seekableTab,
      run: (args) => seekMinutes(args.n ?? 1),
    },
    {
      id: 'seek.backMinutes',
      label: 'Skip back',
      phrases: BACK_MINUTES_PHRASES,
      available: seekableTab,
      run: (args) => seekMinutes(-(args.n ?? 1)),
    },
    {
      id: 'seek.forwardBeats',
      label: 'Skip forward',
      phrases: [
        'forward <n> beats',
        'forward <n> beat',
        'skip <n> beats',
        'ahead <n> beats',
      ],
      available: seekableTab,
      run: (args) => seekBeats(args.n ?? 4),
    },
    {
      id: 'seek.backBeats',
      label: 'Skip back',
      phrases: ['back <n> beats', 'back <n> beat', 'go back <n> beats'],
      available: seekableTab,
      run: (args) => seekBeats(-(args.n ?? 4)),
    },
    {
      id: 'speed.faster',
      label: 'Faster',
      phrases: SPEED_FASTER_PHRASES,
      available: seekableTab,
      run: () => stepSpeed(1),
    },
    {
      id: 'speed.slower',
      label: 'Slower',
      phrases: SPEED_SLOWER_PHRASES,
      available: seekableTab,
      run: () => stepSpeed(-1),
    },
    ...SPEED_PRESETS.map(([multiplier, phrases]) =>
      speedPreset(`speed.preset${String(multiplier)}`, multiplier, phrases),
    ),
    {
      id: 'speed.multiplier',
      label: 'Set speed',
      // Explicit "x"/"times" phrasing is ALWAYS a multiplier — "10 x" must
      // clamp to 2x, never be reinterpreted as 10 percent.
      phrases: SPEED_MULTIPLIER_PHRASES,
      available: seekableTab,
      run: (args) =>
        args.n !== undefined && Number.isFinite(args.n) && args.n > 0
          ? setSpeed(args.n)
          : voiceFailure('Speed unchanged'),
    },
    {
      id: 'speed.spoken',
      label: 'Set speed',
      phrases: SPEED_SPOKEN_PHRASES,
      available: seekableTab,
      run: (args) => setSpokenSpeed(args.n),
    },
    {
      id: 'tempo.set',
      label: 'Set tempo',
      phrases: [
        'set tempo to <n>',
        'set tempo <n>',
        'tempo to <n>',
        'tempo <n>',
        '<n> bpm',
        'set tempo to <n> bpm',
        'tempo <n> bpm',
        'set the tempo to <n>',
      ],
      available: seekableTab,
      run: (args) => setTempo(args.n),
    },
    {
      id: 'tempo.up',
      label: 'Tempo up',
      phrases: [
        'increase tempo',
        'tempo up',
        'faster tempo',
        'raise the tempo',
        'tempo up <n>',
        'increase tempo by <n>',
      ],
      available: seekableTab,
      run: (args) => nudgeTempo(args.n ?? TEMPO_NUDGE_BPM),
    },
    {
      id: 'tempo.down',
      label: 'Tempo down',
      phrases: [
        'reduce tempo',
        'decrease tempo',
        'tempo down',
        'slower tempo',
        'lower the tempo',
        'tempo down <n>',
        'reduce tempo by <n>',
        'decrease tempo by <n>',
      ],
      available: seekableTab,
      run: (args) => nudgeTempo(-(args.n ?? TEMPO_NUDGE_BPM)),
    },
    {
      id: 'countIn.on',
      label: 'Count-in on',
      phrases: ['count in on', 'count in', 'count me in', 'enable count in'],
      available: seekableTab,
      run: () => setCountInBars(2),
    },
    {
      id: 'countIn.off',
      label: 'Count-in off',
      phrases: ['count in off', 'no count in', 'disable count in'],
      available: seekableTab,
      run: () => setCountInBars(0),
    },
    {
      id: 'countIn.bars',
      label: 'Count-in',
      phrases: [
        'count in <n>',
        'count in <n> bars',
        'count in <n> bar',
        '<n> bar count in',
      ],
      available: seekableTab,
      run: (args) => setCountInBars(args.n),
    },
    {
      id: 'loop.setA',
      label: 'Loop A set',
      // "b" is often transcribed as "be"/"bee"; "a" has no such problem,
      // but keep the phrasing families symmetrical where it is.
      phrases: LOOP_SET_A_PHRASES,
      available: seekableTab,
      run: () => {
        deps.loop.setA()
        return 'Loop A set'
      },
    },
    {
      id: 'loop.setB',
      label: 'Loop B set',
      phrases: LOOP_SET_B_PHRASES,
      available: seekableTab,
      run: () => {
        deps.loop.setB()
        if (deps.loop.b() <= 0) {
          return voiceFailure('Loop B must come after A')
        }
        return 'Loop B set'
      },
    },
    {
      id: 'loop.toggle',
      label: 'Toggle loop',
      phrases: LOOP_TOGGLE_PHRASES,
      available: seekableTab,
      run: () => {
        deps.loop.toggle()
        return deps.loop.enabled() ? 'Loop on' : 'Loop off'
      },
    },
    {
      id: 'loop.on',
      label: 'Loop on',
      phrases: LOOP_ON_PHRASES,
      available: seekableTab,
      run: () => {
        if (deps.loop.a() <= 0 || deps.loop.b() <= 0) {
          return voiceFailure('Set A and B first')
        }
        if (!deps.loop.enabled()) deps.loop.toggle()
        return 'Loop on'
      },
    },
    {
      id: 'loop.off',
      label: 'Loop off',
      phrases: LOOP_OFF_PHRASES,
      available: seekableTab,
      run: () => {
        if (deps.loop.enabled()) deps.loop.toggle()
        return 'Loop off'
      },
    },
    {
      id: 'loop.range',
      label: 'Loop range',
      phrases: LOOP_RANGE_PHRASES,
      available: seekableTab,
      run: (args) => {
        const from = args.n
        const to = args.m
        if (
          from === undefined ||
          to === undefined ||
          !Number.isFinite(from) ||
          !Number.isFinite(to)
        ) {
          return voiceFailure('Say loop from A to B seconds')
        }
        if (to <= from) {
          return voiceFailure('Loop end must be after its start')
        }
        deps.loop.moveA(secondsToBeats(from))
        deps.loop.moveB(secondsToBeats(to))
        if (!deps.loop.enabled()) deps.loop.toggle()
        deps.transport().seekTo(deps.loop.a())
        // Piano owns its own start flow (starting the game resets the
        // playhead); on the shared runtime the loop starts sounding now.
        if (tab() !== TAB_PIANO) {
          if (deps.handlers.isPaused()) deps.handlers.resume()
          else if (!deps.handlers.isPlaying()) deps.handlers.play()
        }
        return `Loop ${String(from)}s to ${String(to)}s`
      },
    },
    {
      id: 'loop.clear',
      label: 'Loop cleared',
      phrases: [...LOOP_CLEAR_PHRASES, 'clear a b'],
      available: seekableTab,
      run: () => {
        deps.loop.clear()
        return 'Loop cleared'
      },
    },
    {
      id: 'ui.closeThis',
      label: 'Close',
      // The Escape key's modal-dismiss chain, spoken. Available on every
      // tab (modals float above them all), suspension aside.
      phrases: ['close this', 'close that', 'close it', 'close', 'dismiss'],
      available: () => !suspended(),
      run: () =>
        tryDismissModal(deps.handlers)
          ? 'Closed'
          : voiceFailure('Nothing to close'),
    },
    {
      id: 'mic.toggle',
      label: 'Microphone',
      // Only a toggle exists (the M key); on/off phrasings land on it too.
      phrases: [
        'toggle microphone',
        'toggle mic',
        'microphone on',
        'microphone off',
        'mic on',
        'mic off',
        'mute my mic',
        'unmute my mic',
      ],
      available: transportTab,
      run: () => {
        if (deps.handlers.onMicToggle === undefined) {
          return voiceFailure('No microphone control here')
        }
        deps.handlers.onMicToggle()
        return 'Microphone toggled'
      },
    },
    {
      id: 'mode.repeat',
      label: 'Repeat mode',
      phrases: ['repeat mode', 'repeat on', 'mode repeat'],
      available: transportTab,
      run: () => {
        deps.handlers.setPlayMode(PLAYBACK_MODE_REPEAT)
        return 'Repeat mode'
      },
    },
    {
      id: 'mode.practice',
      label: 'Practice mode',
      phrases: ['practice mode', 'session mode'],
      available: transportTab,
      run: () => {
        deps.handlers.setPlayMode(PLAYBACK_MODE_SESSION)
        return 'Practice mode'
      },
    },
    {
      id: 'mode.once',
      label: 'Play-once mode',
      phrases: ['normal mode', 'once mode', 'play once', 'single mode'],
      available: transportTab,
      run: () => {
        deps.handlers.setPlayMode(PLAYBACK_MODE_ONCE)
        return 'Play-once mode'
      },
    },
  ]
}
