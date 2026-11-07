// ============================================================
// First note's Web Audio song player — a round's band and voice, no element
// ============================================================
//
// Over AirPlay alone (the TV chosen under AirPlay in Control Center, not
// Screen Mirroring) WebKit plays nothing while a media element plays, the
// element's own sound included, routed through Web Audio or not: the
// AirPlay sound check's button 6, an element kept local and routed through
// `createMediaElementSource` as the element player plays its stems
// (song-player.ts), was silent on the TV and the phone, while Web Audio
// alone (button 3) played on the TV (owner, 7 Nov 2026, mp-v0.8.57, an
// LG C2). So in the app, wherever the phone can stream a stem, a round plays
// through Web Audio alone: each stem opened with Karaoke's stream source and
// played by Karaoke's streaming voice, a few seconds decoded at a time, on
// the room's clock (the microphone's). Which player a run takes, and why
// on every route, is `songPlayerFor`'s.
//
// Karaoke's streaming lives in another feature (stem-mixer), so it is handed
// in (`SongStreams`): the app's screen gives it to the room
// (FirstNoteScreen.tsx in the app), as it gives Merc's sampled voice.
//
// MEMORY. A stem is never decoded whole: a song's two stems decoded were the
// 180 MB iOS killed Karaoke for (stem-mixer/streaming-stem-voice.ts). What
// is held is the song's two compressed files, and each voice's few windows;
// and only for the song the rounds play: a round of another song lets the
// last one's go.
//
// TIME. A sound starts START_LEAD_SECONDS ahead on the clock once its stems
// are open, so its first window has a moment to be decoded in; a window
// decoded later still plays on time, part way in (streaming-stem-voice.ts).
// Its place in the song is read off that same clock (`position`), where the
// element player read the band element's: `from` until its first frame,
// then on with the clock. Both are the place being played, not yet heard:
// the speaker's latency is the room's to add (useFirstNoteController.ts,
// toTurn).
//
// The rest is the element player's, so a round reads the same off either:
// the lead-in is the band alone from the entry's `from`, faded out to end
// where the singer comes in (`at`); the line is both stems from `at` to
// `until`, faded over LINE_RELEASE_SECONDS. The fade starts on the frame
// the band reaches its place less the fade, and `done` settles true once
// the fade and RELEASE_SLACK_MS are over. A stop fades over
// STOP_RELEASE_SECONDS and settles false, and so does a band that stops
// short (the song ran out, its decode kept failing, iOS stopped the clock),
// so a round never waits on a place that will not come. Each stem's gain
// rises on the house attack where its first frame plays and falls on the
// house release (preview-player.ts), into the room's output
// (room-output.ts).

import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import { roomOutput } from '@/components/room-kit/room-output'
import { closeEnvelope, ENVELOPE_DEFAULTS, openEnvelope, } from '@/lib/preview-player'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import { BAND_RELEASE_SECONDS, LINE_RELEASE_SECONDS, RELEASE_SLACK_MS, STOP_RELEASE_SECONDS, } from './first-note-rules'
import type { FirstNoteSong } from './first-note-songs'
import type { SongPlayerFactory, SongSound } from './song-player'
import { createSongPlayer } from './song-player'

/** A decoded run of a stem, placed on the song's clock (Karaoke's StemStreamChunk). */
export interface StemChunk {
  readonly buffer: AudioBuffer
  /** Song time of its first sample, s. */
  readonly timestamp: number
}

/** A stem opened to decode a window at a time (Karaoke's StemStream). */
export interface OpenStem {
  /** Decoded chunks in the song's order, from `fromSeconds` on. */
  chunks(fromSeconds: number): AsyncIterable<StemChunk>
  dispose(): void
}

/** What a stem's voice is told: the part of Karaoke's options used here. */
export interface StemVoiceOptions {
  readonly context: BaseAudioContext
  readonly destination: AudioNode
  readonly open: (fromSeconds: number) => AsyncIterable<StemChunk>
  /** The clock time its first frame plays at, s. */
  readonly atContextTime: number
  /** The song time of its first frame, s. */
  readonly sourceOffsetSeconds: number
  readonly playbackRate: number
  /** The stem ran out and its last window played, or the voice was stopped. */
  readonly onEnded?: () => void
  /** A decode that kept failing: the voice pulls no more. */
  readonly onError?: (error: unknown) => void
}

/** A stem playing in windows on the clock (Karaoke's StreamingStemVoice). */
export interface StemVoice {
  /** Every window off at that clock time, and nothing more pulled. */
  stop(atContextTime: number): void
  dispose(): void
}

/**
 * How Karaoke streams a stem: stem-mixer's `canStreamStems`,
 * `openStemStream` and `createStreamingStemVoice`, handed in by the app's
 * screen.
 */
export interface SongStreams {
  /** Whether this phone decodes a stem a window at a time: AudioDecoder. */
  readonly canStream: () => boolean
  /** The stem, opened to stream; null where it cannot be. */
  readonly open: (blob: Blob) => Promise<OpenStem | null>
  /** The stem, played in windows on the context's clock. */
  readonly voice: (options: StemVoiceOptions) => StemVoice
}

/**
 * Clock time from a sound's stems being open to its first frame, s: its
 * first window is decoded in it. Karaoke's voice picks a reopened stream up
 * as far ahead (PICK_UP_LEAD_SECONDS), for the same reason.
 */
export const START_LEAD_SECONDS = 0.25

/** Where a stem's gain waits for its attack: the house silence floor. */
const SILENCE_FLOOR = 0.0001

/**
 * Whether a run here plays its songs through Web Audio alone: in the app,
 * wherever the phone can stream a stem.
 *
 * On every route, not only over AirPlay: Web Audio alone plays on the
 * speaker, headphones, Bluetooth and AirPlay alike, so the room never
 * depends on telling AirPlay apart, which the app can only guess
 * (airplay-suspicion.ts). The app is told from the web by its device: the
 * app registers it before its first render (main.tsx in the app) and the
 * web never does (native-shell-store.ts, `nativeDeviceApi`), the same test
 * by which a room takes the app's shared clock rather than making its own
 * (useExerciseCapture.ts). The web keeps the element player, as before.
 * Where the phone cannot stream (iOS before Safari 26's AudioDecoder, or the
 * Developer screen's "Force the no-streaming path") the stems stay
 * elements, and over AirPlay alone the room says it plays nothing
 * (FirstNoteAirPlayNotice.tsx).
 */
export function playsThroughWebAudio(
  streams: SongStreams | undefined,
): boolean {
  return (
    streams !== undefined && nativeDeviceApi() !== null && streams.canStream()
  )
}

/** The player a run's songs play on (`playsThroughWebAudio`). */
export function songPlayerFor(
  streams: SongStreams | undefined,
): SongPlayerFactory {
  if (streams === undefined || !playsThroughWebAudio(streams)) {
    return createSongPlayer
  }
  return createWebAudioSongPlayer(streams)
}

type Part = 'band' | 'voice'

/** The song the rounds play: its stems, opened as its first sound asked. */
interface HeldSong {
  readonly key: string
  readonly stems: Readonly<Record<Part, Promise<OpenStem | null>>>
}

/** One sound: which stems, from and to on the song's clock, and its fade. */
interface SoundPlan {
  readonly stems: HeldSong['stems']
  readonly parts: readonly Part[]
  readonly from: number
  readonly to: number
  /** The fade that ends at `to`, s. */
  readonly release: number
}

/** One stem of a sound: its voice, and its gain into the room. */
interface Playing {
  readonly voice: StemVoice
  readonly gain: GainNode
}

/** A stem's file, from where the song keeps it, opened to stream; null if not. */
async function openStem(
  streams: SongStreams,
  url: string,
): Promise<OpenStem | null> {
  try {
    // A stem the app ships answers status 0 on iOS (asset-fetch.ts); one of
    // the singer's own is a URL minted from the phone's store.
    const bytes = await fetchAssetBytes(url)
    return await streams.open(new Blob([bytes]))
  } catch (error) {
    console.warn('[first-note] a stem would not open to stream:', error)
    return null
  }
}

/** All of a sound's stems, open: a sound plays all of them or nothing. */
async function allOpen(
  stems: readonly Promise<OpenStem | null>[],
): Promise<OpenStem[]> {
  const opened = await Promise.all(stems)
  const ready = opened.filter((stem): stem is OpenStem => stem !== null)
  if (ready.length !== opened.length) {
    throw new Error('A stem would not open to stream.')
  }
  return ready
}

/**
 * `stem` from `from` at `at` on the clock, through a gain of its own into
 * the room that rises on the house attack where the first frame plays.
 */
function playStem(
  ctx: AudioContext,
  streams: SongStreams,
  stem: OpenStem,
  plan: { readonly from: number; readonly at: number },
  ended: (() => void) | undefined,
): Playing {
  const gain = ctx.createGain()
  gain.gain.value = SILENCE_FLOOR
  gain.connect(roomOutput(ctx))
  const voice = streams.voice({
    context: ctx,
    destination: gain,
    open: (seconds) => stem.chunks(seconds),
    atContextTime: plan.at,
    sourceOffsetSeconds: plan.from,
    playbackRate: 1,
    onEnded: ended,
    onError: (error) => {
      console.warn('[first-note] a stem stopped decoding:', error)
    },
  })
  openEnvelope(gain, ctx, ENVELOPE_DEFAULTS.attackMs / 1000, plan.at)
  return { voice, gain }
}

/** One sound of `plan`: opened, started a moment ahead, watched on the clock. */
function playSound(
  ctx: AudioContext,
  streams: SongStreams,
  plan: SoundPlan,
): SongSound {
  const { from, to, release } = plan
  let settle: (played: boolean) => void = () => undefined
  const done = new Promise<boolean>((resolve) => {
    settle = resolve
  })
  const playing: Playing[] = []
  let over = false
  let frame = 0
  /** The clock time of its first frame; null until its stems are open. */
  let startAt: number | null = null
  /** The clock time it was let go at: its place stays where it ended. */
  let letGoAt: number | null = null

  const position = (): number =>
    startAt === null
      ? from
      : from + Math.max(0, (letGoAt ?? ctx.currentTime) - startAt)

  const finish = (played: boolean, fade: number): void => {
    if (over) return
    over = true
    cancelAnimationFrame(frame)
    ctx.removeEventListener('statechange', halted)
    // The house release: the gain decays, and the windows stop only once
    // its tail is inaudible.
    const silentAt = ctx.currentTime + fade + RELEASE_SLACK_MS / 1000
    for (const { voice, gain } of playing) {
      closeEnvelope(gain, ctx, fade)
      voice.stop(silentAt)
    }
    setTimeout(
      () => {
        letGoAt = ctx.currentTime
        for (const { voice, gain } of playing) {
          voice.dispose()
          gain.disconnect()
        }
        settle(played)
      },
      fade * 1000 + RELEASE_SLACK_MS,
    )
  }
  const stop = (): void => finish(false, STOP_RELEASE_SECONDS)

  // iOS stopped the clock short of the place (a call, another app's sound),
  // as the system pausing the element did: the place never comes.
  function halted(): void {
    if (ctx.state !== 'running') stop()
  }
  const watch = (): void => {
    if (over) return
    if (position() >= to - release) finish(true, release)
    else frame = requestAnimationFrame(watch)
  }
  const start = async (): Promise<void> => {
    const stems = await allOpen(plan.parts.map((part) => plan.stems[part]))
    if (over) return
    if (ctx.state !== 'running') throw new Error('The clock is not running.')
    const at = ctx.currentTime + START_LEAD_SECONDS
    startAt = at
    plan.parts.forEach((part, i) => {
      // The band running out short of its place (the song ended, or its
      // decode kept failing) ends the sound, as the element's end did.
      const ended = part === 'band' ? stop : undefined
      playing.push(playStem(ctx, streams, stems[i], { from, at }, ended))
    })
    ctx.addEventListener('statechange', halted)
    watch()
  }
  start().catch(stop)
  return { done, position, stop }
}

/** A song player for the room's clock, its stems streamed (see the header). */
export function createWebAudioSongPlayer(
  streams: SongStreams,
): SongPlayerFactory {
  return (ctx) => {
    let held: HeldSong | null = null
    let current: SongSound | null = null

    /** The last song's stems let go, once each has opened. */
    const letGoOfSong = (): void => {
      if (held === null) return
      for (const stem of Object.values(held.stems)) {
        void stem.then((open) => open?.dispose())
      }
      held = null
    }

    /** The song's stems, opened once while its rounds play. */
    const stemsOf = (song: FirstNoteSong): HeldSong['stems'] => {
      const key = `${song.stems.instrumental}\n${song.stems.vocal}`
      if (held !== null && held.key === key) return held.stems
      letGoOfSong()
      const stems = {
        band: openStem(streams, song.stems.instrumental),
        voice: openStem(streams, song.stems.vocal),
      }
      held = { key, stems }
      return stems
    }

    const play = (
      song: FirstNoteSong,
      parts: readonly Part[],
      from: number,
      to: number,
      release: number,
    ): SongSound => {
      current?.stop()
      const stems = stemsOf(song)
      const sound = playSound(ctx, streams, { stems, parts, from, to, release })
      current = sound
      return sound
    }

    return {
      leadIn: (song, entry) =>
        play(song, ['band'], entry.from, entry.at, BAND_RELEASE_SECONDS),
      line: (song, entry) =>
        play(
          song,
          ['band', 'voice'],
          entry.at,
          entry.until,
          LINE_RELEASE_SECONDS,
        ),
      dispose: () => {
        current?.stop()
        current = null
        letGoOfSong()
      },
    }
  }
}
