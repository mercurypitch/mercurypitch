import { describe, expect, it } from 'vitest'
import { matchVoiceCommand } from '@/features/voice-control/command-grammar'
import type { StemMixerVoiceDeps, StemMixerVoiceTrack, } from './stem-mixer-voice-commands'
import { createStemMixerVoiceCommands } from './stem-mixer-voice-commands'

interface Fixture {
  deps: StemMixerVoiceDeps
  calls: string[]
  seekedTo: () => number | null
  track: (label: string) => StemMixerVoiceTrack
  setPlaying: (v: boolean) => void
  setPlaylistActive: (v: boolean) => void
}

function makeFixture(): Fixture {
  const calls: string[] = []
  let playing = false
  let playlistActive = false
  let seekedTo: number | null = null
  const tracks: StemMixerVoiceTrack[] = [
    { label: 'Vocal', muted: false, soloed: false, volume: 0.8 },
    { label: 'Instrumental', muted: true, soloed: false, volume: 0.8 },
    { label: 'MIDI', muted: false, soloed: false, volume: 0.6 },
    { label: 'Guitar', muted: false, soloed: true, volume: 0.5 },
  ]
  const find = (label: string): StemMixerVoiceTrack => {
    const track = tracks.find((t) => t.label === label)
    if (track === undefined) throw new Error(`no fixture track ${label}`)
    return track
  }

  const deps: StemMixerVoiceDeps = {
    playing: () => playing,
    elapsed: () => 30,
    duration: () => 200,
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
    seekToTime: (seconds) => {
      seekedTo = seconds
      calls.push('seek')
    },
    tracks: () => tracks,
    toggleMute: (label) => {
      calls.push(`mute:${label}`)
      find(label).muted = !find(label).muted
    },
    toggleSolo: (label) => {
      calls.push(`solo:${label}`)
      find(label).soloed = !find(label).soloed
    },
    setTrackVolume: (label, volume) => {
      calls.push(`volume:${label}:${String(volume)}`)
      find(label).volume = volume
    },
    playlist: {
      active: () => playlistActive,
      next: () => calls.push('playlist:next'),
      prev: () => calls.push('playlist:prev'),
      random: () => {
        if (!playlistActive) return false
        calls.push('playlist:random')
        return true
      },
    },
  }

  return {
    deps,
    calls,
    seekedTo: () => seekedTo,
    track: find,
    setPlaying: (v) => {
      playing = v
    },
    setPlaylistActive: (v) => {
      playlistActive = v
    },
  }
}

/** Runs one utterance; returns the success label or the failure message. */
function fire(fixture: Fixture, utterance: string): string | undefined {
  const commands = createStemMixerVoiceCommands(fixture.deps)
  const match = matchVoiceCommand(utterance, commands)
  if (match === null) return undefined
  const result = match.command.run({ n: match.n })
  if (typeof result === 'string') return result
  if (typeof result === 'object') return result.message
  return match.command.label
}

describe('stem mixer voice commands — transport', () => {
  it('drives play, pause and seconds-domain seeking', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'play')).toBe('Play')
    expect(fire(fixture, 'play')).toBe('Already playing')
    expect(fire(fixture, 'pause')).toBe('Pause')
    expect(fire(fixture, 'forward ten seconds')).toBe('Forward 10s')
    expect(fixture.seekedTo()).toBe(40)
    expect(fire(fixture, 'go to one minute')).toBe('Go to 1:00')
    expect(fixture.seekedTo()).toBe(60)
    expect(fire(fixture, 'go to the middle')).toBe('Go to the middle')
    expect(fixture.seekedTo()).toBe(100)
  })

  it('restarts from the top and resumes playback', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'from the top')).toBe('From the top')
    expect(fixture.seekedTo()).toBe(0)
    expect(fixture.calls).toContain('play')
  })
})

describe('stem mixer voice commands — stems', () => {
  it('mutes and unmutes stems by their spoken names', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'mute vocals')).toBe('Vocal muted')
    expect(fixture.track('Vocal').muted).toBe(true)
    expect(fire(fixture, 'mute vocals')).toBe('Vocal already muted')
    expect(fire(fixture, 'vocals on')).toBe('Vocal on')
    expect(fixture.track('Vocal').muted).toBe(false)
    expect(fire(fixture, 'unmute the backing track')).toBe('Instrumental on')
  })

  it('reports stems the mix does not have', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'mute drums')).toBe('No drums stem in this mix')
    expect(fire(fixture, 'solo the bass')).toBe('No bass stem in this mix')
  })

  it('solos and unsolos', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'solo vocals')).toBe('Solo Vocal')
    expect(fixture.track('Vocal').soloed).toBe(true)
    expect(fire(fixture, 'unsolo guitar')).toBe('Guitar solo off')
    expect(fire(fixture, 'solo off')).toBe('Solo off')
    expect(fixture.track('Vocal').soloed).toBe(false)
  })

  it('nudges and sets stem volume', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'vocals down')).toBe('Vocal 70%')
    expect(fixture.track('Vocal').volume).toBeCloseTo(0.7)
    expect(fire(fixture, 'guitar volume 25 percent')).toBe('Guitar 25%')
    expect(fixture.track('Guitar').volume).toBeCloseTo(0.25)
    expect(fire(fixture, 'turn keys up')).toBe('No piano stem in this mix')
  })
})

describe('stem mixer voice commands — roles and playlist', () => {
  it('applies "i sing": vocals muted, the rest on, solos cleared', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'i sing')).toBe('Vocal muted, everything else on')
    expect(fixture.track('Vocal').muted).toBe(true)
    expect(fixture.track('Instrumental').muted).toBe(false)
    expect(fixture.track('Guitar').muted).toBe(false)
    expect(fixture.track('Guitar').soloed).toBe(false)
    // The MIDI guide is not part of role presets.
    expect(fixture.track('MIDI').muted).toBe(false)
  })

  it('applies instrument roles and reports missing stems', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'i play guitar')).toBe(
      'Guitar muted, everything else on',
    )
    expect(fixture.track('Guitar').muted).toBe(true)
    expect(fire(fixture, 'i play drums')).toBe('No drums stem in this mix')
    expect(fire(fixture, 'full mix')).toBe('Full mix')
    expect(fixture.track('Guitar').muted).toBe(false)
    expect(fixture.track('Instrumental').muted).toBe(false)
  })

  it('gates playlist commands on an active playlist', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'next song')).toBe('No playlist running')
    expect(fire(fixture, 'play random song from my list')).toBe(
      'No playlist running',
    )
    fixture.setPlaylistActive(true)
    expect(fire(fixture, 'next song')).toBe('Next song')
    expect(fire(fixture, 'previous song')).toBe('Previous song')
    expect(fire(fixture, 'play random song from my list')).toBe('Random song')
    expect(fixture.calls).toContain('playlist:random')
  })

  it('honours the availability gate for the whole set', () => {
    const fixture = makeFixture()
    fixture.deps.available = () => false
    const commands = createStemMixerVoiceCommands(fixture.deps)
    expect(matchVoiceCommand('play', commands)).toBeNull()
    expect(matchVoiceCommand('mute vocals', commands)).toBeNull()
  })
})
