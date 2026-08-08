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
  let speed = 1
  let loopEnabled = false
  let loopStart = 0
  let loopEnd = 0
  let songsOpen = false
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
    speed: () => speed,
    setSpeed: (multiplier) => {
      calls.push(`speed:${String(multiplier)}`)
      speed = multiplier
    },
    loop: {
      enabled: () => loopEnabled,
      setEnabled: (on) => {
        loopEnabled = on
      },
      start: () => loopStart,
      setStart: (seconds) => {
        loopStart = seconds
      },
      end: () => loopEnd,
      setEnd: (seconds) => {
        loopEnd = seconds
      },
      clear: () => {
        calls.push('loop:clear')
        loopEnabled = false
        loopStart = 0
        loopEnd = 0
      },
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
    songsSidebar: {
      isOpen: () => songsOpen,
      open: () => {
        calls.push('songs:open')
        songsOpen = true
      },
      close: () => {
        calls.push('songs:close')
        songsOpen = false
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
  const result = match.command.run({ n: match.n, m: match.m })
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

describe('stem mixer voice commands — loop and speed', () => {
  it('sets a loop by spoken range in the seconds domain and plays it', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'play a loop from 20 to 60 seconds')).toBe(
      'Loop 20s to 60s',
    )
    expect(fixture.deps.loop.start()).toBe(20)
    expect(fixture.deps.loop.end()).toBe(60)
    expect(fixture.deps.loop.enabled()).toBe(true)
    expect(fixture.seekedTo()).toBe(20)
    expect(fixture.calls).toContain('play')
    expect(fire(fixture, 'loop from 60 to 20')).toBe(
      'Loop end must be after its start',
    )
  })

  it('sets loop points at the playhead and toggles', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'set a')).toBe('Loop A set')
    expect(fixture.deps.loop.start()).toBe(30)
    expect(fire(fixture, 'set b')).toBe('Loop B must come after A')
    expect(fire(fixture, 'loop on')).toBe('Set A and B first')
    expect(fire(fixture, 'clear loop')).toBe('Loop cleared')
  })

  it('steps and sets the mixer speed with the multiplier rule', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'faster')).toBe('Speed 1.5x')
    expect(fixture.deps.speed()).toBe(1.5)
    expect(fire(fixture, 'half speed')).toBe('Speed 0.5x')
    expect(fire(fixture, '10 x')).toBe('Speed 2x')
    expect(fire(fixture, 'speed 75 percent')).toBe('Speed 0.75x')
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
    // Past tense and homophones land on the same intent.
    expect(fire(fixture, 'i played guitar')).toBe(
      'Guitar muted, everything else on',
    )
    expect(fire(fixture, 'i play base guitar')).toBe('No bass stem in this mix')
    expect(fixture.track('Guitar').muted).toBe(true)
    expect(fire(fixture, 'i play drums')).toBe('No drums stem in this mix')
    expect(fire(fixture, 'full mix')).toBe('Full mix')
    expect(fixture.track('Guitar').muted).toBe(false)
    expect(fixture.track('Instrumental').muted).toBe(false)
  })

  it('opens and closes the songs sidebar', () => {
    const fixture = makeFixture()
    expect(fire(fixture, 'close songs')).toBe('Songs are not open')
    expect(fire(fixture, 'open playlist')).toBe('Songs open')
    expect(fixture.calls).toContain('songs:open')
    expect(fire(fixture, 'open songs')).toBe('Songs already open')
    expect(fire(fixture, 'close playlists')).toBe('Songs closed')
    expect(fixture.calls).toContain('songs:close')
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
