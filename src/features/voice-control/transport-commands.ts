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
import { PLAYBACK_MODE_ONCE, PLAYBACK_MODE_REPEAT, PLAYBACK_MODE_SESSION, TAB_COMPOSE, TAB_GUITAR, TAB_KARAOKE, TAB_PIANO, TAB_SINGING, } from '@/features/tabs/constants'
import * as transportStore from '@/stores/transport-store'
import type { VoiceCommand } from './types'

export interface TransportVoiceLoopDeps {
  enabled: Accessor<boolean>
  a: Accessor<number>
  b: Accessor<number>
  setA: () => void
  setB: () => void
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

  const doPlay = (): string => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      const gs = deps.handlers.piano.gameState()
      if (gs === 'playing') return 'Already playing'
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
      if (editor.isPlaying()) return 'Already playing'
      if (editor.isPaused()) {
        editor.resume()
        return 'Resume'
      }
      void editor.play()
      return 'Play'
    }
    if (deps.handlers.isPlaying()) return 'Already playing'
    if (deps.handlers.isPaused()) {
      deps.handlers.resume()
      return 'Resume'
    }
    deps.handlers.play()
    return 'Play'
  }

  const doPause = (): string => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      if (deps.handlers.piano.gameState() === 'playing') {
        deps.handlers.piano.pauseGame()
        return 'Pause'
      }
      return 'Nothing playing'
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
      return 'Nothing playing'
    }
    if (deps.handlers.isPlaying()) {
      deps.handlers.pause()
      return 'Pause'
    }
    return 'Nothing playing'
  }

  const doStop = (): string => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      const gs = deps.handlers.piano.gameState()
      if (gs === 'idle') return 'Nothing playing'
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
      return 'Nothing playing'
    }
    deps.handlers.stop()
    return 'Stop'
  }

  const doRestart = (): string => {
    const t = tab()
    if (t === TAB_PIANO && deps.handlers.piano) {
      deps.handlers.piano.resetGame()
      deps.handlers.piano.startGame()
      return 'From the top'
    }
    if (t === TAB_GUITAR) {
      // The guitar transports (drum loop / tab playback) have no seek —
      // phase 3 gives Guitar its own command set.
      return 'Not on this tab yet'
    }
    deps.transport().seekTo(0)
    if (deps.handlers.isPaused()) {
      deps.handlers.resume()
    } else if (!deps.handlers.isPlaying()) {
      if (t === TAB_COMPOSE && deps.handlers.editor) {
        void deps.handlers.editor.play()
      } else {
        deps.handlers.play()
      }
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

  const setSpokenSpeed = (raw: number | undefined): string => {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) {
      return 'Speed unchanged'
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

  // ── The set ────────────────────────────────────────────────

  return [
    {
      id: 'transport.play',
      label: 'Play',
      phrases: [
        'play',
        'start',
        'go',
        'begin',
        'resume',
        'continue',
        'keep going',
      ],
      available: transportTab,
      run: () => doPlay(),
    },
    {
      id: 'transport.pause',
      label: 'Pause',
      phrases: ['pause', 'hold', 'hold on', 'wait'],
      available: transportTab,
      run: () => doPause(),
    },
    {
      id: 'transport.stop',
      label: 'Stop',
      phrases: ['stop', 'finish', 'stop playback', 'stop playing'],
      available: transportTab,
      run: () => doStop(),
    },
    {
      id: 'transport.restart',
      label: 'From the top',
      phrases: [
        'again',
        'restart',
        'from the top',
        'from the beginning',
        'start over',
        'start again',
        'one more time',
        'once more',
        'take it from the top',
      ],
      available: transportTab,
      run: () => doRestart(),
    },
    {
      id: 'transport.seekStart',
      label: 'Go to start',
      phrases: [
        'go to start',
        'go to the start',
        'go to beginning',
        'go to the beginning',
        'beginning',
        'rewind',
      ],
      available: seekableTab,
      run: () => {
        deps.transport().seekTo(0)
        return 'Go to start'
      },
    },
    {
      id: 'seek.forwardSeconds',
      label: 'Skip forward',
      phrases: [
        'forward <n> seconds',
        'forward <n> second',
        'skip <n> seconds',
        'skip ahead <n> seconds',
        'skip forward <n> seconds',
        'ahead <n> seconds',
        'jump forward <n> seconds',
        'jump ahead <n> seconds',
        'forward <n>',
        'skip <n>',
      ],
      available: seekableTab,
      run: (args) => seekSeconds(args.n ?? 10),
    },
    {
      id: 'seek.backSeconds',
      label: 'Skip back',
      phrases: [
        'back <n> seconds',
        'back <n> second',
        'go back <n> seconds',
        'rewind <n> seconds',
        'backwards <n> seconds',
        'jump back <n> seconds',
        'back <n>',
      ],
      available: seekableTab,
      run: (args) => seekSeconds(-(args.n ?? 10)),
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
      phrases: ['faster', 'speed up', 'a bit faster', 'little faster'],
      available: seekableTab,
      run: () => stepSpeed(1),
    },
    {
      id: 'speed.slower',
      label: 'Slower',
      phrases: ['slower', 'slow down', 'a bit slower', 'little slower'],
      available: seekableTab,
      run: () => stepSpeed(-1),
    },
    speedPreset('speed.normal', 1.0, [
      'normal speed',
      'full speed',
      'regular speed',
    ]),
    speedPreset('speed.half', 0.5, ['half speed']),
    speedPreset('speed.quarter', 0.25, ['quarter speed']),
    speedPreset('speed.threeQuarter', 0.75, [
      'three quarter speed',
      'three quarters speed',
    ]),
    speedPreset('speed.double', 2.0, ['double speed']),
    {
      id: 'speed.spoken',
      label: 'Set speed',
      phrases: ['speed <n> percent', '<n> percent speed', 'speed <n>'],
      available: seekableTab,
      run: (args) => setSpokenSpeed(args.n),
    },
    {
      id: 'loop.setA',
      label: 'Loop A set',
      // "b" is often transcribed as "be"/"bee"; "a" has no such problem,
      // but keep the phrasing families symmetrical where it is.
      phrases: [
        'set a',
        'set point a',
        'mark a',
        'loop start',
        'set loop start',
        'loop from here',
      ],
      available: seekableTab,
      run: () => {
        deps.loop.setA()
        return 'Loop A set'
      },
    },
    {
      id: 'loop.setB',
      label: 'Loop B set',
      phrases: [
        'set b',
        'set be',
        'set bee',
        'set point b',
        'mark b',
        'mark be',
        'loop end',
        'set loop end',
        'loop to here',
      ],
      available: seekableTab,
      run: () => {
        deps.loop.setB()
        return deps.loop.b() > 0 ? 'Loop B set' : 'Loop B must come after A'
      },
    },
    {
      id: 'loop.toggle',
      label: 'Toggle loop',
      phrases: ['loop', 'toggle loop'],
      available: seekableTab,
      run: () => {
        deps.loop.toggle()
        return deps.loop.enabled() ? 'Loop on' : 'Loop off'
      },
    },
    {
      id: 'loop.on',
      label: 'Loop on',
      phrases: [
        'loop on',
        'enable loop',
        'start loop',
        'start looping',
        'loop this',
      ],
      available: seekableTab,
      run: () => {
        if (deps.loop.a() <= 0 || deps.loop.b() <= 0) {
          return 'Set A and B first'
        }
        if (!deps.loop.enabled()) deps.loop.toggle()
        return 'Loop on'
      },
    },
    {
      id: 'loop.off',
      label: 'Loop off',
      phrases: [
        'loop off',
        'disable loop',
        'stop looping',
        'stop loop',
        'no loop',
      ],
      available: seekableTab,
      run: () => {
        if (deps.loop.enabled()) deps.loop.toggle()
        return 'Loop off'
      },
    },
    {
      id: 'loop.clear',
      label: 'Loop cleared',
      phrases: [
        'clear loop',
        'clear the loop',
        'remove loop',
        'delete loop',
        'reset loop',
        'clear a b',
      ],
      available: seekableTab,
      run: () => {
        deps.loop.clear()
        return 'Loop cleared'
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
