// ============================================================
// The Karaoke room's stage on a connected TV: what the room sends
// ============================================================
//
// A proof of concept for karaoke on a TV (issue #489, the third proof of
// concept). With a test build's "Stage on a connected TV" on, an iPhone with
// AirPlay screen mirroring gives the TV a page of its own that draws the
// room's stage, the pitch lane, the lyrics and the score, in the TV's own
// landscape, while the phone stays the room and the microphone in whatever
// way it is held (ios/App/App/LyricsWindow/TVStage.swift). The page has no
// way into the room, so the room sends it everything (src/lib/tv-stage/):
//
//   THE SONG, each time the TV starts showing the stage and each time the
//   song changes or more of it arrives: its length, its lyrics as the
//   lyrics window gets them, and its notes, read from the song's stored
//   pitch analysis and moved into the key being heard. Notes edited in Pitch
//   Studio are not on the TV yet. With no song in the room, idle.
//
//   FRAMES, twenty a second while the TV shows the stage and the room has a
//   song: where the song is as the lyrics follow it, moved by the Developer
//   screen's offset (tv-stage-store.ts), the microphone's readings since the
//   last frame (live-mic-store.ts), and every half second the score.
//
// Nothing is sent while the TV shows anything else, and nothing at all on a
// phone that cannot give a TV the stage.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { loadPitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import type { FeedNote } from '@/lib/tv-stage/feed'
import { singerSince, tvStageFrame, tvStageScore, tvStageSong, } from '@/lib/tv-stage/feed'
import type { TvStageScore, TvStageSong } from '@/lib/tv-stage/protocol'
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

/** The song on the room's stage, as the TV stage needs to know it. */
export interface KaraokeTvStageSong {
  readonly title: string
  readonly sessionId: string
}

export interface KaraokeTvStageOptions {
  readonly device: NativeDeviceApi | null
  readonly mixer: Accessor<HostedMixerControls | null>
  /** The song on the stage, or null for none. */
  readonly song: Accessor<KaraokeTvStageSong | null>
  /** The song's notes; by default its stored pitch analysis. */
  readonly loadNotes?: (sessionId: string) => Promise<readonly FeedNote[]>
}

/** The notes a song's stored pitch analysis keeps, or none. */
export async function storedSongNotes(
  sessionId: string,
): Promise<readonly FeedNote[]> {
  const data = await loadPitchAnalysisFromDb(sessionId)
  if (data === null) return []
  return data.segmentedNotes.length > 0 ? data.segmentedNotes : data.mergedNotes
}

/** The song message for what the room has now, or null without a song. */
function songOf(
  controls: HostedMixerControls | null,
  title: string | null,
  notes: readonly FeedNote[],
): TvStageSong | null {
  if (controls === null || title === null) return null
  const shift = controls.key.heard()
  return tvStageSong({
    title,
    duration: controls.duration(),
    notes: notes.map((note) => ({ ...note, midi: note.midi + shift })),
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
  const send = (): void => {
    const position = controls.audibleElapsed() + tvStageOffsetMs() / 1000
    if (sentUpTo > position + SEEK_BACK_SEC) sentUpTo = position - SEEK_BACK_SEC
    const mic = liveMicFeed()
    const singer =
      mic === null
        ? []
        : singerSince(mic.readings(), sentUpTo, mic.readingLagSec())
    const last = singer.at(-1)
    if (last !== undefined) sentUpTo = last[0]
    if (mic !== null && frames % TV_STAGE_SCORE_EVERY === 0) {
      score = tvStageScore(mic.score())
    }
    frames += 1
    stage.send(
      tvStageFrame({
        at: Date.now(),
        position,
        playing: controls.playing(),
        rate: controls.speed(),
        singer,
        score,
      }),
    )
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
  const load = options.loadNotes ?? storedSongNotes
  const [showing, setShowing] = createSignal(false)
  onCleanup(stage.watch(setShowing))

  // The notes, read while the TV shows the stage: for each song, and again
  // once the song gets its notes (an analysis run meanwhile).
  const [notes, setNotes] = createSignal<readonly FeedNote[]>([])
  createEffect(
    on(
      [
        showing,
        () => options.song()?.sessionId ?? null,
        () => options.mixer()?.hasNotes() ?? false,
      ],
      ([shown, sessionId]) => {
        setNotes((previous) => (previous.length === 0 ? previous : []))
        if (!shown || sessionId === null) return
        let current = true
        onCleanup(() => {
          current = false
        })
        void load(sessionId).then(
          (found) => {
            if (current) setNotes(found)
          },
          () => undefined,
        )
      },
    ),
  )

  // Worked out only while the TV shows the stage: the lyrics' part samples
  // the whole song, which a room with no TV should not pay for.
  const song = createMemo(() =>
    showing()
      ? songOf(options.mixer(), options.song()?.title ?? null, notes())
      : null,
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
}
