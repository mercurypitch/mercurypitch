import type { Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import { beforeEach, describe, expect, it } from 'vitest'
import type { KeyboardShortcutHandlers } from '@/features/keyboard/useKeyboardShortcuts'
import type { ActiveTab } from '@/features/tabs/constants'
import { TAB_KARAOKE, TAB_PIANO, TAB_SINGING } from '@/features/tabs/constants'
import { playbackSpeed, setPlaybackSpeed } from '@/stores/transport-store'
import type { PlaybackMode } from '@/types'
import { matchVoiceCommand } from './command-grammar'
import type { TransportVoiceDeps } from './transport-commands'
import { createTransportVoiceCommands } from './transport-commands'

interface Fixture {
  deps: TransportVoiceDeps
  calls: string[]
  seekedTo: () => number | null
  setPlaying: (v: boolean) => void
  setPaused: (v: boolean) => void
  setLoopOn: (v: boolean) => void
  setLoopPoints: (a: number, b: number) => void
  mode: () => PlaybackMode
}

function makeFixture(tab: ActiveTab, currentBeat = 40): Fixture {
  const calls: string[] = []
  const [playing, setPlaying] = createSignal(false)
  const [paused, setPaused] = createSignal(false)
  const [mode, setMode] = createSignal<PlaybackMode>('once')
  const [loopOn, setLoopOn] = createSignal(false)
  const [loopA, setLoopA] = createSignal(0)
  const [loopB, setLoopB] = createSignal(0)
  let seekedTo: number | null = null

  const handlers: KeyboardShortcutHandlers = {
    isPlaying: playing,
    isPaused: paused,
    play: () => {
      calls.push('play')
      setPlaying(true)
      setPaused(false)
    },
    pause: () => {
      calls.push('pause')
      setPlaying(false)
      setPaused(true)
    },
    resume: () => {
      calls.push('resume')
      setPlaying(true)
      setPaused(false)
    },
    stop: () => {
      calls.push('stop')
      setPlaying(false)
      setPaused(false)
    },
    seekToStart: () => {
      calls.push('seekToStart')
    },
    playMode: mode,
    setPlayMode: setMode as Setter<PlaybackMode>,
    activeTab: () => tab,
  }

  const deps: TransportVoiceDeps = {
    handlers,
    transport: () => ({
      beat: () => currentBeat,
      total: () => 200,
      seekTo: (beat) => {
        seekedTo = beat
        calls.push('seekTo')
      },
    }),
    bpm: () => 120,
    loop: {
      enabled: loopOn,
      a: loopA,
      b: loopB,
      setA: () => {
        calls.push('setA')
        setLoopA(40)
      },
      setB: () => {
        calls.push('setB')
        setLoopB(80)
      },
      toggle: () => {
        calls.push('toggleLoop')
        setLoopOn((v) => !v)
      },
      clear: () => {
        calls.push('clearLoop')
        setLoopOn(false)
        setLoopA(0)
        setLoopB(0)
      },
    },
  }

  return {
    deps,
    calls,
    seekedTo: () => seekedTo,
    setPlaying,
    setPaused,
    setLoopOn,
    setLoopPoints: (a, b) => {
      setLoopA(a)
      setLoopB(b)
    },
    mode,
  }
}

/** Runs one utterance; returns the success label or the failure message. */
function fire(fixture: Fixture, utterance: string): string | undefined {
  const commands = createTransportVoiceCommands(fixture.deps)
  const match = matchVoiceCommand(utterance, commands)
  if (match === null) return undefined
  const result = match.command.run({ n: match.n })
  if (typeof result === 'string') return result
  if (typeof result === 'object') return result.message
  return match.command.label
}

beforeEach(() => {
  setPlaybackSpeed(1.0)
})

describe('transport voice commands — singing tab', () => {
  it('plays when stopped and resumes when paused', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'play')).toBe('Play')
    expect(fixture.calls).toEqual(['play'])

    fixture.setPlaying(false)
    fixture.setPaused(true)
    expect(fire(fixture, 'play')).toBe('Resume')
    expect(fixture.calls).toEqual(['play', 'resume'])
  })

  it('pauses only while playing', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'pause')).toBe('Nothing playing')
    fixture.setPlaying(true)
    expect(fire(fixture, 'pause')).toBe('Pause')
    expect(fixture.calls).toEqual(['pause'])
  })

  it('restarts from the top and starts playback', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'from the top')).toBe('From the top')
    expect(fixture.seekedTo()).toBe(0)
    expect(fixture.calls).toContain('play')
  })

  it('seeks forward by spoken seconds, bpm-converted', () => {
    const fixture = makeFixture(TAB_SINGING, 40)
    // 10 s at 120 bpm = 20 beats; 40 + 20 = 60.
    expect(fire(fixture, 'forward ten seconds')).toBe('Forward 10s')
    expect(fixture.seekedTo()).toBe(60)
  })

  it('seeks back and clamps at zero', () => {
    const fixture = makeFixture(TAB_SINGING, 10)
    expect(fire(fixture, 'go back thirty seconds')).toBe('Back 30s')
    expect(fixture.seekedTo()).toBe(0)
  })

  it('seeks to absolute times, the middle and the end', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'go to thirty seconds')).toBe('Go to 30s')
    expect(fixture.seekedTo()).toBe(60)
    expect(fire(fixture, 'go to one minute')).toBe('Go to 1:00')
    expect(fixture.seekedTo()).toBe(120)
    expect(fire(fixture, 'skip the first ten seconds')).toBe('Go to 10s')
    expect(fixture.seekedTo()).toBe(20)
    expect(fire(fixture, 'go to the middle')).toBe('Go to the middle')
    expect(fixture.seekedTo()).toBe(100)
    // Lands 2 s (4 beats at 120 bpm) short so track-end handling wins.
    expect(fire(fixture, 'go to the end')).toBe('Go to the end')
    expect(fixture.seekedTo()).toBe(196)
    expect(fire(fixture, 'forward one minute')).toBe('Forward 1 min')
    expect(fixture.seekedTo()).toBe(160)
  })

  it('reports absolute seeks with nothing loaded as failures', () => {
    const fixture = makeFixture(TAB_SINGING)
    fixture.deps.transport = () => ({
      beat: () => 0,
      total: () => 0,
      seekTo: () => {
        fixture.calls.push('seekTo')
      },
    })
    expect(fire(fixture, 'go to the middle')).toBe('Nothing loaded')
    expect(fire(fixture, 'go to thirty seconds')).toBe('Nothing loaded')
    expect(fixture.calls).toEqual([])
  })

  it('sets loop points and arms the loop through the shared handlers', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'set a')).toBe('Loop A set')
    expect(fire(fixture, 'set b')).toBe('Loop B set')
    expect(fixture.calls).toEqual(['setA', 'setB'])
  })

  it('understands the "set be" mistranscription of "set b"', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'set be')).toBe('Loop B set')
    expect(fixture.calls).toEqual(['setB'])
  })

  it('turns the loop off only when it is on', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'loop off')).toBe('Loop off')
    expect(fixture.calls).toEqual([])

    fixture.setLoopOn(true)
    expect(fire(fixture, 'stop looping')).toBe('Loop off')
    expect(fixture.calls).toEqual(['toggleLoop'])
  })

  it('refuses to arm a loop without both points', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'loop on')).toBe('Set A and B first')
    expect(fixture.calls).toEqual([])

    fixture.setLoopPoints(40, 80)
    expect(fire(fixture, 'loop on')).toBe('Loop on')
    expect(fixture.calls).toEqual(['toggleLoop'])
  })

  it('steps and sets playback speed', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'faster')).toBe('Speed 1.5x')
    expect(playbackSpeed()).toBe(1.5)
    expect(fire(fixture, 'half speed')).toBe('Speed 0.5x')
    expect(playbackSpeed()).toBe(0.5)
    expect(fire(fixture, 'speed seventy five percent')).toBe('Speed 0.75x')
    expect(playbackSpeed()).toBe(0.75)
    // Clamped by the transport store.
    expect(fire(fixture, 'speed 300 percent')).toBe('Speed 2x')
    expect(playbackSpeed()).toBe(2)
  })

  it('switches play modes', () => {
    const fixture = makeFixture(TAB_SINGING)
    expect(fire(fixture, 'repeat mode')).toBe('Repeat mode')
    expect(fixture.mode()).toBe('repeat')
    expect(fire(fixture, 'practice mode')).toBe('Practice mode')
    expect(fixture.mode()).toBe('session')
  })
})

describe('transport voice commands — tab routing', () => {
  it('ignores every transport command on the karaoke tab', () => {
    const fixture = makeFixture(TAB_KARAOKE)
    const commands = createTransportVoiceCommands(fixture.deps)
    for (const utterance of ['play', 'stop', 'set a', 'faster', 'loop']) {
      expect(matchVoiceCommand(utterance, commands)).toBeNull()
    }
  })

  it('ignores everything while an immersive surface holds the shortcuts', () => {
    const fixture = makeFixture(TAB_SINGING)
    fixture.deps.handlers.isSuspended = () => true
    const commands = createTransportVoiceCommands(fixture.deps)
    expect(matchVoiceCommand('play', commands)).toBeNull()
  })

  it('routes play/pause/stop to the falling-notes game on the piano tab', () => {
    const fixture = makeFixture(TAB_PIANO)
    const pianoCalls: string[] = []
    const [gameState, setGameState] = createSignal('idle')
    fixture.deps.handlers.piano = {
      isPlaying: () => gameState() === 'playing',
      isPaused: () => gameState() === 'paused',
      gameState,
      startGame: () => {
        pianoCalls.push('start')
        setGameState('playing')
      },
      pauseGame: () => {
        pianoCalls.push('pause')
        setGameState('paused')
      },
      resumeGame: () => {
        pianoCalls.push('resume')
        setGameState('playing')
      },
      resetGame: () => {
        pianoCalls.push('reset')
        setGameState('idle')
      },
    }

    expect(fire(fixture, 'play')).toBe('Play')
    expect(fire(fixture, 'pause')).toBe('Pause')
    expect(fire(fixture, 'play')).toBe('Resume')
    expect(fire(fixture, 'stop')).toBe('Stop')
    expect(pianoCalls).toEqual(['start', 'pause', 'resume', 'reset'])
  })
})
