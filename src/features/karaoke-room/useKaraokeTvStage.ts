// ============================================================
// The Karaoke room's stage on a connected TV: what the room sends
// ============================================================
//
// Karaoke on a TV (issue #489, from the third proof of concept). Once the
// singer picks the stage for a TV (the native app's TV chooser, in every
// build), an iPhone with AirPlay screen mirroring gives the TV a page of its
// own that draws the room's stage, the pitch lane, the lyrics and the
// score, in the TV's own landscape, while the phone stays the room and the
// microphone in whatever way it is held (ios/App/App/LyricsWindow/
// TVStage.swift). The page has no way into the room, so the room sends it
// everything (src/lib/tv-stage/):
//
//   THE SONG, each time the TV starts showing the stage and each time the
//   song changes or more of it arrives: its length, its lyrics as the
//   lyrics window gets them, and the notes the phone's lane draws, as the
//   mixer hands them over (`laneNotes`): the notes edited in Pitch Studio,
//   in the key being heard. So the TV draws what the phone draws, and a
//   change to them on the phone (the notes read from the vocal, the key)
//   goes to the TV as it happens. With no song in the room, idle, and idle
//   again as the room closes, so the TV does not run the song on after it.
//
//   FRAMES, twenty a second while the TV shows the stage and the room has a
//   song: where the song is as the lyrics follow it, moved by the Developer
//   screen's offset (tv-stage-store.ts), the microphone's readings since the
//   last frame (live-mic-store.ts), and every half second the score. Each
//   frame is built on the one before it, whose clock it carries again if
//   its own reading is not a number (feed.ts).
//
// Nothing is sent while the TV shows anything else, but for the idle as the
// room closes, and nothing at all on a phone that cannot give a TV the stage.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { singerSince, tvStageFrame, tvStageScore, tvStageSong, } from '@/lib/tv-stage/feed'
import type { TvStageFrame, TvStageReading, TvStageScore, TvStageSong, } from '@/lib/tv-stage/protocol'
import { TV_STAGE_IDLE } from '@/lib/tv-stage/protocol'
import { liveMicFeed } from '@/stores/live-mic-store'
import type { NativeDeviceApi, NativeTvStage, } from '@/stores/native-shell-store'
import { tvStageOffsetMs } from '@/stores/tv-stage-store'

/** How often a frame goes, in ms: twenty a second. */
export const TV_STAGE_FRAME_MS = 50

/** How often the score is worked out again, in frames: every half second. */
export const TV_STAGE_SCORE_EVERY = 10

/** A jump back further than this, in seconds, starts the readings afresh. */
const SEEK_BACK_SEC = 0.5

export interface KaraokeTvStageOptions {
  readonly device: NativeDeviceApi | null
  readonly mixer: Accessor<HostedMixerControls | null>
  /** The title of the song on the stage, or null for none. */
  readonly title: Accessor<string | null>
}

/** The song message for what the room has now, or null without a song. */
function songOf(
  controls: HostedMixerControls | null,
  title: string | null,
): TvStageSong | null {
  if (controls === null || title === null) return null
  return tvStageSong({
    title,
    duration: controls.duration(),
    notes: controls.laneNotes().map((note) => ({
      midi: note.midi,
      startSec: note.startBeat,
      endSec: note.endBeat,
    })),
    lyrics: controls.lyricWindowScript(title).segments,
  })
}

/**
 * Frames for one song while the TV shows it: started by the caller, which
 * stops them with the returned function.
 */
function startFrames(
  stage: NativeTvStage,
  controls: HostedMixerControls,
): () => void {
  let sentUpTo = Number.NEGATIVE_INFINITY
  let frames = 0
  let score: TvStageScore | null = null
  let last: TvStageFrame | null = null
  let micFailed = false
  /**
   * The singer's readings since the last frame, and the score when it is
   * due. A microphone that throws gives none, and the frame still goes: the
   * clock is what keeps the TV with the song. Said once in the console, so a
   * TV with no trail can be told from a singer who has not sung.
   */
  const fromMic = (): readonly TvStageReading[] => {
    try {
      const mic = liveMicFeed()
      if (mic === null) return []
      const singer = singerSince(mic.readings(), sentUpTo, mic.readingLagSec())
      if (frames % TV_STAGE_SCORE_EVERY === 0) score = tvStageScore(mic.score())
      return singer
    } catch (error) {
      if (!micFailed) {
        micFailed = true
        console.warn(
          `[tv stage] the microphone could not be read for the TV: ${String(error)}`,
        )
      }
      return []
    }
  }
  const send = (): void => {
    const position = controls.audibleElapsed() + tvStageOffsetMs() / 1000
    if (sentUpTo > position + SEEK_BACK_SEC) sentUpTo = position - SEEK_BACK_SEC
    const singer = fromMic()
    const newest = singer.at(-1)
    if (newest !== undefined) sentUpTo = newest[0]
    frames += 1
    last = tvStageFrame(
      {
        at: Date.now(),
        position,
        playing: controls.playing(),
        rate: controls.speed(),
        singer,
        score,
      },
      last,
    )
    stage.send(last)
  }
  send()
  const timer = setInterval(send, TV_STAGE_FRAME_MS)
  return () => {
    clearInterval(timer)
  }
}

export function useKaraokeTvStage(options: KaraokeTvStageOptions): void {
  const stage = options.device?.tvStage
  if (stage === undefined) return
  const [showing, setShowing] = createSignal(false)
  onCleanup(stage.watch(setShowing))

  // Worked out only while the TV shows the stage: the lyrics' part samples
  // the whole song, which a room with no TV should not pay for.
  const song = createMemo(() =>
    showing() ? songOf(options.mixer(), options.title()) : null,
  )

  // The song, or idle, whenever the TV starts showing the stage or the song
  // changes while it does.
  createEffect(
    on([showing, song], ([shown, current]) => {
      if (shown) stage.send(current ?? TV_STAGE_IDLE)
    }),
  )

  // Frames for as long as both hold: the TV shows the stage, and the room
  // has a mixer for its song.
  createEffect(
    on([showing, options.mixer], ([shown, controls]) => {
      if (!shown || controls === null) return
      onCleanup(startFrames(stage, controls))
    }),
  )

  // The room closing: idle, as for a room with no song, whatever the TV
  // shows now. Its last frame said where the song was, often still playing,
  // and without this the TV ran the song on in silence while the singer was
  // in another room. The app keeps the newest song and frame for a stage
  // page that loads later (TVStage.swift), even while no TV shows the stage,
  // so this also goes when the TV has gone back to the phone: a TV that
  // comes back to the stage after the room closed gets idle, not the old
  // song.
  onCleanup(() => {
    stage.send(TV_STAGE_IDLE)
  })
}
