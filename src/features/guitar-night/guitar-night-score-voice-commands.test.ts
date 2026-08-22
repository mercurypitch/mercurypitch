// ============================================================
// Guitar Night score voice commands — Rehearse vocabulary tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { matchVoiceCommand } from '@/features/voice-control/command-grammar'
import type { GuitarNightScoreVoiceDeps, GuitarNightScoreVoiceLoop, } from './guitar-night-score-voice-commands'
import { createGuitarNightScoreVoiceCommands } from './guitar-night-score-voice-commands'

interface Fixture {
  deps: GuitarNightScoreVoiceDeps
  calls: string[]
  setPlaying: (value: boolean) => void
  setPaused: (value: boolean) => void
  setCanStop: (value: boolean) => void
  loop: GuitarNightScoreVoiceLoop
  loopEnabled: () => boolean
  clickEnabled: () => boolean
  countInBeats: () => number
  tabSoundEnabled: () => boolean
  listeningActive: () => boolean
  scoreOpen: () => boolean
  setListeningBlocked: (reason: string | null) => void
  setLoopBlocked: (reason: string | null) => void
  setScoreCanShow: (value: boolean) => void
}

function makeFixture(): Fixture {
  const calls: string[] = []
  let playing = false
  let paused = false
  let canStop = true
  let markA = false
  let markB = false
  let loopEnabled = false
  let clickEnabled = true
  let countInBeats = 4
  let tabSoundEnabled = true
  let listeningActive = false
  let listeningBlocked: string | null = null
  let loopBlocked: string | null = null
  let scoreOpen = false
  let scoreCanShow = true

  const loop: GuitarNightScoreVoiceLoop = {
    hasA: () => markA,
    hasB: () => markB,
    blockedReason: () => loopBlocked,
    markA: () => {
      calls.push('loop:a')
      markA = true
    },
    markB: () => {
      calls.push('loop:b')
      markB = true
    },
    clear: () => {
      calls.push('loop:clear')
      markA = false
      markB = false
      loopEnabled = false
    },
    enabled: () => loopEnabled,
    setEnabled: (enabled) => {
      calls.push(`loop:${enabled ? 'on' : 'off'}`)
      loopEnabled = enabled
    },
  }

  const deps: GuitarNightScoreVoiceDeps = {
    playing: () => playing,
    paused: () => paused,
    canStop: () => canStop,
    play: () => {
      calls.push('play')
      playing = true
      paused = false
    },
    pause: () => {
      calls.push('pause')
      playing = false
      paused = true
    },
    stop: () => {
      calls.push('stop')
      playing = false
      paused = false
    },
    goToBeginning: () => calls.push('beginning'),
    loop,
    click: {
      enabled: () => clickEnabled,
      setEnabled: (enabled) => {
        calls.push(`click:${String(enabled)}`)
        clickEnabled = enabled
      },
    },
    countIn: {
      beats: () => countInBeats,
      setBeats: (beats) => {
        calls.push(`count-in:${String(beats)}`)
        countInBeats = beats
      },
    },
    tabSound: {
      enabled: () => tabSoundEnabled,
      setEnabled: (enabled) => {
        calls.push(`tab:${String(enabled)}`)
        tabSoundEnabled = enabled
      },
    },
    listening: {
      active: () => listeningActive,
      blockedReason: () => listeningBlocked,
      requestStart: () => {
        calls.push('listening:start')
        listeningActive = true
      },
      stop: () => {
        calls.push('listening:stop')
        listeningActive = false
      },
    },
    score: {
      open: () => scoreOpen,
      show: () => {
        calls.push('score:show')
        if (!scoreCanShow) return false
        scoreOpen = true
      },
    },
  }

  return {
    deps,
    calls,
    setPlaying: (value) => {
      playing = value
    },
    setPaused: (value) => {
      paused = value
    },
    setCanStop: (value) => {
      canStop = value
    },
    loop,
    loopEnabled: () => loopEnabled,
    clickEnabled: () => clickEnabled,
    countInBeats: () => countInBeats,
    tabSoundEnabled: () => tabSoundEnabled,
    listeningActive: () => listeningActive,
    scoreOpen: () => scoreOpen,
    setListeningBlocked: (reason) => {
      listeningBlocked = reason
    },
    setLoopBlocked: (reason) => {
      loopBlocked = reason
    },
    setScoreCanShow: (value) => {
      scoreCanShow = value
    },
  }
}

/** Runs one utterance; returns the success label or explicit failure message. */
function fire(fixture: Fixture, utterance: string): string | undefined {
  const commands = createGuitarNightScoreVoiceCommands(fixture.deps)
  const match = matchVoiceCommand(utterance, commands)
  if (match === null) return undefined
  const result = match.command.run({ n: match.n, m: match.m })
  if (typeof result === 'string') return result
  if (typeof result === 'object') return result.message
  return match.command.label
}

describe('guitar night score voice commands', () => {
  it('publishes stable ids, labels and the room vocabulary', () => {
    const fixture = makeFixture()
    const commands = createGuitarNightScoreVoiceCommands(fixture.deps)
    const byId = new Map(commands.map((command) => [command.id, command]))

    expect(byId.get('guitarNight.score.play')).toMatchObject({
      label: 'Play or resume',
    })
    expect(byId.get('guitarNight.score.play')?.phrases).toContain('resume')
    expect(byId.get('guitarNight.score.loopSetA')?.phrases).toContain('mark a')
    expect(byId.get('guitarNight.score.loopSetB')?.phrases).toContain('mark b')
    expect(byId.get('guitarNight.score.countInSet')?.phrases).toContain(
      'count in <n> beats',
    )
    expect(byId.get('guitarNight.score.tabSoundOff')?.phrases).toContain(
      'tab silent',
    )
    expect(byId.get('guitarNight.score.showScore')).toMatchObject({
      label: 'Show score',
    })
  })

  it('plays, pauses, resumes, stops and returns to the beginning truthfully', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'play')).toBe('Play')
    expect(fire(fixture, 'play')).toBe('Already playing')
    expect(fire(fixture, 'pause')).toBe('Pause')
    expect(fire(fixture, 'resume')).toBe('Resume')
    expect(fire(fixture, 'go to beginning')).toBe('Go to beginning')
    expect(fixture.calls).toContain('beginning')
    expect(fire(fixture, 'stop')).toBe('Stop')

    fixture.setCanStop(false)
    expect(fire(fixture, 'stop')).toBe('Nothing to stop')
  })

  it('marks, enables and clears A/B loops with useful failures', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'loop on')).toBe('Set A and B first')
    expect(fire(fixture, 'mark a')).toBe('Loop A set')
    expect(fire(fixture, 'mark b')).toBe('Loop B set')
    expect(fire(fixture, 'loop on')).toBe('Loop on')
    expect(fixture.loopEnabled()).toBe(true)
    expect(fire(fixture, 'loop')).toBe('Loop off')
    expect(fire(fixture, 'clear loop')).toBe('Loop cleared')
    expect(fire(fixture, 'clear loop')).toBe('No loop to clear')

    fixture.setLoopBlocked('Finish the scored take before changing its loop')
    expect(fire(fixture, 'mark a')).toBe(
      'Finish the scored take before changing its loop',
    )
    expect(fixture.calls.filter((call) => call === 'loop:a')).toHaveLength(1)
  })

  it('changes the click, count-in and tab sound while preserving state', () => {
    const fixture = makeFixture()

    expect(fire(fixture, 'click off')).toBe('Click off')
    expect(fixture.clickEnabled()).toBe(false)
    expect(fire(fixture, 'click off')).toBe('Click already off')
    expect(fire(fixture, 'click')).toBe('Click on')

    expect(fire(fixture, 'count in')).toBe('Count-in off')
    expect(fire(fixture, 'count in')).toBe('Count-in 1 beat')
    expect(fire(fixture, 'count in two beats')).toBe('Count-in 2 beats')
    expect(fixture.countInBeats()).toBe(2)
    expect(fire(fixture, 'count in three beats')).toBe(
      'Count-in can be off, 1, 2 or 4 beats',
    )

    expect(fire(fixture, 'tab silent')).toBe('Tab silent')
    expect(fixture.tabSoundEnabled()).toBe(false)
    expect(fire(fixture, 'tab sounds')).toBe('Tab sounds')
  })

  it('starts, stops and blocks Listening without claiming a false success', () => {
    const fixture = makeFixture()
    fixture.setListeningBlocked('Finish calibrating first')
    expect(fire(fixture, 'start listening')).toBe('Finish calibrating first')
    expect(fixture.listeningActive()).toBe(false)

    fixture.setListeningBlocked(null)
    expect(fire(fixture, 'start listening')).toBe('Listening starting')
    expect(fixture.listeningActive()).toBe(true)
    expect(fire(fixture, 'listening on')).toBe('Listening already on')
    expect(fire(fixture, 'listening')).toBe('Listening off')
    expect(fire(fixture, 'stop listening')).toBe('Listening already off')
  })

  it('shows the latest score and reports empty or already-open states', () => {
    const fixture = makeFixture()
    fixture.setScoreCanShow(false)
    expect(fire(fixture, 'show my score')).toBe('No score to show yet')
    expect(fixture.scoreOpen()).toBe(false)

    fixture.setScoreCanShow(true)
    expect(fire(fixture, 'show score')).toBe('Score opened')
    expect(fixture.scoreOpen()).toBe(true)
    expect(fire(fixture, 'score')).toBe('Score already open')
  })

  it('omits optional command groups when a host exposes no safe handler', () => {
    const fixture = makeFixture()
    const commands = createGuitarNightScoreVoiceCommands({
      ...fixture.deps,
      loop: undefined,
      click: undefined,
      countIn: undefined,
      tabSound: undefined,
      listening: undefined,
      score: undefined,
    })
    const ids = commands.map((command) => command.id)

    expect(ids).toEqual([
      'guitarNight.score.play',
      'guitarNight.score.pause',
      'guitarNight.score.stop',
      'guitarNight.score.beginning',
    ])
  })
})
