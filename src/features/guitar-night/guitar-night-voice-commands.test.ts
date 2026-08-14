import { describe, expect, it } from 'vitest'
import { matchVoiceCommand } from '@/features/voice-control/command-grammar'
import type { GuitarNightVoiceDeps, GuitarNightVoiceTrack, } from './guitar-night-voice-commands'
import { createGuitarNightVoiceCommands } from './guitar-night-voice-commands'

interface Fixture {
  deps: GuitarNightVoiceDeps
  calls: string[]
  seekedTo: () => number | null
  track: (id: string) => GuitarNightVoiceTrack
}

function makeFixture(): Fixture {
  const calls: string[] = []
  let playing = false
  let rate = 1
  let seekedTo: number | null = null
  const tracks: GuitarNightVoiceTrack[] = [
    { id: 'vocal', muted: true, available: true },
    { id: 'drums', muted: false, available: true },
    { id: 'guitar', muted: false, available: true },
    { id: 'piano', muted: false, available: false },
  ]
  const find = (id: string): GuitarNightVoiceTrack => {
    const track = tracks.find((t) => t.id === id)
    if (track === undefined) throw new Error(`no fixture track ${id}`)
    return track
  }

  const deps: GuitarNightVoiceDeps = {
    playing: () => playing,
    positionSeconds: () => 30,
    durationSeconds: () => 200,
    play: () => {
      calls.push('play')
      playing = true
    },
    pause: () => {
      calls.push('pause')
      playing = false
    },
    stop: () => {
      calls.push('stop')
      playing = false
    },
    seek: (seconds) => {
      seekedTo = seconds
      calls.push('seek')
    },
    playbackRate: () => rate,
    setPlaybackRate: (next) => {
      calls.push(`rate:${String(next)}`)
      rate = next
    },
    tracks: () => tracks,
    setTrackMuted: (id, muted) => {
      calls.push(`mute:${id}:${String(muted)}`)
      find(id).muted = muted
    },
  }

  return { deps, calls, seekedTo: () => seekedTo, track: find }
}

/** Runs one utterance; returns the success label or the failure message. */
function fire(fixture: Fixture, utterance: string): string | undefined {
  const commands = createGuitarNightVoiceCommands(fixture.deps)
  const match = matchVoiceCommand(utterance, commands)
  if (match === null) return undefined
  const result = match.command.run({ n: match.n, m: match.m })
  if (typeof result === 'string') return result
  if (typeof result === 'object') return result.message
  return match.command.label
}

describe('guitar night voice commands', () => {
  it('drives the room transport in seconds', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'play')).toBe('Play')
    expect(fire(fixture, 'play')).toBe('Already playing')
    expect(fire(fixture, 'backwards 20')).toBe('Back 20s')
    expect(fixture.seekedTo()).toBe(10)
    expect(fire(fixture, 'from the top')).toBe('From the top')
    expect(fixture.seekedTo()).toBe(0)
    expect(fire(fixture, 'pause')).toBe('Pause')
  })

  it('mutes and unmutes stems by kind, respecting availability', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'mute the drums')).toBe('Drums muted')
    expect(fixture.track('drums').muted).toBe(true)
    expect(fire(fixture, 'unmute vocals')).toBe('Vocal on')
    expect(fixture.track('vocal').muted).toBe(false)
    // Present but unavailable stems answer like missing ones.
    expect(fire(fixture, 'mute keys')).toBe('No piano stem in this session')
    expect(fire(fixture, 'mute bass')).toBe('No bass stem in this session')
  })

  it('controls the playback rate with the shared speed rules', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'faster')).toBe('Speed 1.5x')
    expect(fixture.deps.playbackRate()).toBe(1.5)
    expect(fire(fixture, 'half speed')).toBe('Speed 0.5x')
    expect(fire(fixture, '10 x')).toBe('Speed 2x')
    expect(fire(fixture, 'speed 75 percent')).toBe('Speed 0.75x')
  })
})
