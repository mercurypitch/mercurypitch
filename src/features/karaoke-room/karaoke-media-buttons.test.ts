// ============================================================
// The room's media buttons: each press, and who the song's line says it was
// ============================================================

import { createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { playbackCause } from '@/lib/playback-cause'
import { createMediaButtons, mediaCause } from './karaoke-media-buttons'

/** A room with a song loaded, and who each of its transport calls was by. */
function room(playingAtFirst: boolean) {
  const [playing, setPlaying] = createSignal(playingAtFirst)
  const said: string[] = []
  const seek = vi.fn()
  const mixer = {
    loading: () => false,
    duration: () => 246,
    positionNow: () => 30,
    seek,
  } as unknown as HostedMixerControls
  const host = {
    mixer: () => mixer,
    runOn: () => true,
    isPlaying: playing,
    resume: () => {
      said.push(`play by=${playbackCause()}`)
      setPlaying(true)
    },
    pause: () => {
      said.push(`pause by=${playbackCause()}`)
      setPlaying(false)
    },
    stop: () => {
      said.push(`stop by=${playbackCause()}`)
      setPlaying(false)
    },
  }
  return { press: createMediaButtons(host), said, seek }
}

describe('mediaCause', () => {
  it('names a press by its source and its button', () => {
    expect(mediaCause('pause', 'media-session')).toBe('media-session(pause)')
    expect(mediaCause('play', 'lyrics-window')).toBe('lyrics-window(play)')
    expect(mediaCause({ seekTo: 12 }, 'media-session')).toBe(
      'media-session(seek)',
    )
    expect(mediaCause({ skipBy: -10 }, 'media-session')).toBe(
      'media-session(skip)',
    )
  })

  it('takes a press nobody placed for a system media control', () => {
    expect(mediaCause('stop')).toBe('media-session(stop)')
  })

  it('names iOS taking the sound or giving it back as the system, either way', () => {
    expect(mediaCause('pause', 'system')).toBe('system')
    expect(mediaCause('play', 'system')).toBe('system')
  })
})

describe('createMediaButtons', () => {
  it('pauses a playing song as the system media control’s doing', () => {
    const r = room(true)

    r.press('pause', 'media-session')

    expect(r.said).toEqual(['pause by=media-session(pause)'])
  })

  it('says the system paused the song when iOS took the sound', () => {
    const r = room(true)

    r.press('pause', 'system')

    expect(r.said).toEqual(['pause by=system'])
  })

  it('plays a paused song from the lyrics window, as the window’s doing', () => {
    const r = room(false)

    r.press('play', 'lyrics-window')

    expect(r.said).toEqual(['play by=lyrics-window(play)'])
  })

  it('leaves a playing song alone on play, and a paused one on pause', () => {
    const playingSong = room(true)
    const pausedSong = room(false)

    playingSong.press('play', 'media-session')
    pausedSong.press('pause', 'media-session')

    expect(playingSong.said).toEqual([])
    expect(pausedSong.said).toEqual([])
  })

  it('stops the run on stop, as the stop’s doing', () => {
    const r = room(true)

    r.press('stop', 'media-session')

    expect(r.said).toEqual(['stop by=media-session(stop)'])
  })

  it('moves the song for the bar and the skips, inside its length', () => {
    const r = room(true)

    r.press({ seekTo: 400 }, 'media-session')
    r.press({ skipBy: -10 }, 'media-session')

    expect(r.seek.mock.calls).toEqual([[246], [20]])
    expect(r.said).toEqual([])
  })
})
