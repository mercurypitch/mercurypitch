// ============================================================
// First note's song player — a song's band and voice, from the phone
// ============================================================
//
// The example songs ship as two stems each, the band and the voice, a few
// megabytes of compressed audio a song. Decoded whole they are tens of
// megabytes a stem, which a phone should not pay for eight seconds of a
// song. So the room streams them: one <audio> element a stem, routed into
// the room's audio context (a MediaElementAudioSourceNode) so their level
// follows the house envelopes (preview-player.ts, .claude/memory/
// audio-pop-free-playback.md) and their sound leaves with the room
// (room-output.ts).
//
// Two sounds a round:
//   lead-in   the band alone from the entry's `from`, faded out to end
//             where the singer comes in (`at`); the voice stays paused
//   line      both stems from `at` to `until`: the song carries on with
//             its singer back in, and fades out
//
// A media element keeps time on its own clock, so the player watches the
// band's position each animation frame (`position()`) rather than
// scheduling on the audio clock: the fade starts BAND_RELEASE_SECONDS
// ahead of `at`, and a sound's `done` settles once it has ended. A band
// that stops short of its place (the system paused it, or the song ended)
// settles it unplayed, so a round never waits on a place that will not come.
//
// A MediaElementAudioSourceNode takes its element's output for good, and
// into a suspended context that is silence (lib/jam/jam-song-transport.ts).
// The room makes its player only once the microphone has opened its
// running context, and makes a new one each run.

import { roomOutput } from '@/components/room-kit/room-output'
import { closeEnvelope, ENVELOPE_DEFAULTS, openEnvelope, } from '@/lib/preview-player'
import { BAND_RELEASE_SECONDS } from './first-note-rules'
import type { FirstNoteEntry, FirstNoteSong } from './first-note-songs'

/** One of the player's sounds. */
export interface SongSound {
  /** Settles true once it has played to its end, false if stopped or failed. */
  readonly done: Promise<boolean>
  /** The band's place in the song now, s. */
  position(): number
  /** Off now, pop-free. Safe more than once. */
  stop(): void
}

export interface SongPlayer {
  /** The band from the entry's `from`, ending where the singer comes in. */
  leadIn(song: FirstNoteSong, entry: FirstNoteEntry): SongSound
  /** The song from the entry on, its singer back in, to the line's end. */
  line(song: FirstNoteSong, entry: FirstNoteEntry): SongSound
  /** Everything off and let go. */
  dispose(): void
}

export type SongPlayerFactory = (ctx: AudioContext) => SongPlayer

/** The line's fade at its end, s. */
const LINE_RELEASE_SECONDS = 0.4
/** A quick fade for a stop, s. */
const STOP_RELEASE_SECONDS = 0.06
/** Wall-clock headroom after a fade before the element pauses, ms. */
const PAUSE_SLACK_MS = 60
/** A stem that has not loaded by now has failed, ms. */
const LOAD_TIMEOUT_MS = 10_000

interface Track {
  readonly el: HTMLAudioElement
  gain: GainNode | null
}

function makeTrack(): Track {
  const el = new Audio()
  el.preload = 'auto'
  return { el, gain: null }
}

/** The track's gain into the room, routed on first use. */
function routed(ctx: AudioContext, track: Track): GainNode {
  if (track.gain !== null) return track.gain
  const source = ctx.createMediaElementSource(track.el)
  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  source.connect(gain)
  gain.connect(roomOutput(ctx))
  track.gain = gain
  return gain
}

/** Resolves once `event` fires on `el`, rejects on its error or a timeout. */
function once(el: HTMLAudioElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      done()
      reject(new Error(`${event} timed out`))
    }, LOAD_TIMEOUT_MS)
    const ok = (): void => {
      done()
      resolve()
    }
    const fail = (): void => {
      done()
      reject(new Error(`${event} failed`))
    }
    const done = (): void => {
      clearTimeout(timer)
      el.removeEventListener(event, ok)
      el.removeEventListener('error', fail)
    }
    el.addEventListener(event, ok)
    el.addEventListener('error', fail)
  })
}

/** The track on `url`, its length known, at `seconds`. */
async function cue(track: Track, url: string, seconds: number): Promise<void> {
  const { el } = track
  if (el.getAttribute('src') !== url) {
    const loaded = once(el, 'loadedmetadata')
    el.src = url
    el.load()
    await loaded
  } else if (el.readyState < 1) {
    await once(el, 'loadedmetadata')
  }
  if (Math.abs(el.currentTime - seconds) < 0.005) return
  const seeked = once(el, 'seeked')
  el.currentTime = seconds
  await seeked
}

export const createSongPlayer: SongPlayerFactory = (ctx) => {
  const band = makeTrack()
  const voice = makeTrack()
  let current: SongSound | null = null

  /**
   * One sound over `tracks`, from `from` to `to`, fading out over
   * `release` before it: cued, started together, watched on the band.
   */
  const play = (
    song: FirstNoteSong,
    tracks: readonly Track[],
    from: number,
    to: number,
    release: number,
  ): SongSound => {
    current?.stop()
    let settle: (played: boolean) => void = () => undefined
    const done = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    let over = false
    let frame = 0
    const finish = (played: boolean, fade: number): void => {
      if (over) return
      over = true
      cancelAnimationFrame(frame)
      band.el.removeEventListener('pause', halted)
      band.el.removeEventListener('ended', halted)
      for (const track of tracks) {
        if (track.gain !== null) closeEnvelope(track.gain, ctx, fade)
      }
      setTimeout(
        () => {
          // A newer sound on the same elements keeps them playing.
          if (current === sound) {
            for (const track of tracks) track.el.pause()
          }
          settle(played)
        },
        fade * 1000 + PAUSE_SLACK_MS,
      )
    }
    // The system can stop the band short of its place (headphones pulled
    // out, another app's sound), or the song can end before it. That place
    // never comes, so the sound ends here, unplayed.
    const halted = (): void => finish(false, STOP_RELEASE_SECONDS)
    const watch = (): void => {
      if (over) return
      if (band.el.currentTime >= to - release) finish(true, release)
      else frame = requestAnimationFrame(watch)
    }
    const urls = new Map<Track, string>([
      [band, song.stems.instrumental],
      [voice, song.stems.vocal],
    ])
    const start = async (): Promise<void> => {
      await Promise.all(
        tracks.map((track) => cue(track, urls.get(track) ?? '', from)),
      )
      if (over) return
      const gains = tracks.map((track) => routed(ctx, track))
      await Promise.all(tracks.map((track) => track.el.play()))
      if (over) return
      band.el.addEventListener('pause', halted)
      band.el.addEventListener('ended', halted)
      for (const gain of gains) {
        openEnvelope(gain, ctx, ENVELOPE_DEFAULTS.attackMs / 1000)
      }
      watch()
    }
    start().catch(() => finish(false, STOP_RELEASE_SECONDS))
    const sound: SongSound = {
      done,
      position: () => band.el.currentTime,
      stop: () => finish(false, STOP_RELEASE_SECONDS),
    }
    current = sound
    return sound
  }

  return {
    leadIn: (song, entry) => {
      voice.el.pause()
      return play(song, [band], entry.from, entry.at, BAND_RELEASE_SECONDS)
    },
    line: (song, entry) =>
      play(song, [band, voice], entry.at, entry.until, LINE_RELEASE_SECONDS),
    dispose: () => {
      current?.stop()
      current = null
      for (const track of [band, voice]) {
        track.el.pause()
        track.el.removeAttribute('src')
        track.el.load()
        track.gain?.disconnect()
      }
    },
  }
}
