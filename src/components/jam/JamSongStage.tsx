// ── JamSongStage ──────────────────────────────────────────────────────
// A song room: lyrics left, one pitch lane per singer right.
//
// The audio element is the clock. Its currentTime is the truth, and the
// store's position follows it rather than the other way round -- an
// independent timer would drift against the audio within a verse, and
// then the lyrics would be wrong in a way that looks like bad timings.
//
// Only the host's transport commands move the playhead. A peer's element
// is seeked TO the broadcast position rather than driving it, which is
// what keeps a room together across the join.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { scoreLiveLine } from '@/lib/jam/jam-line-scoring'
import { lineIndexAt } from '@/lib/jam/jam-song'
import { jamConnectedPeers, jamExercisePaused, jamExercisePlaying, jamIsHost, jamLineIsMine, jamPeerId, jamPitchHistory, jamSong, jamSongLineScores, jamSongPause, jamSongPlay, jamSongPositionSec, jamSongRunScore, jamSongSeek, jamSongStop, recordJamLineScore, setJamSongPositionSec, } from '@/stores/jam-store'
import { JamGuideVocal } from './JamGuideVocal'
import { JamLyricVersionPicker } from './JamLyricVersionPicker'
import { JamPeerLanes } from './JamPeerLanes'
import { JamSongLyrics } from './JamSongLyrics'
import { JamSongScrubber } from './JamSongScrubber'
import styles from './JamSongStage.module.css'

/**
 * How far out of step a peer tolerates before correcting.
 *
 * Small enough that nobody is audibly behind, large enough that a peer is
 * not re-seeking on every message -- a seek is audible, so correcting a
 * 50ms drift would be worse than the drift.
 */
const RESYNC_THRESHOLD_SEC = 0.35

/**
 * How far the guide vocal may drift from the backing track.
 *
 * Tighter than the peer threshold because these two elements are on ONE
 * device with no network between them: any gap here is a bug, not latency.
 */
const GUIDE_DRIFT_SEC = 0.12

export const JamSongStage: Component = () => {
  let audioRef: HTMLAudioElement | undefined
  let vocalRef: HTMLAudioElement | undefined

  /**
   * Guide-vocal level, per person and not room state -- see JamGuideVocal.
   * Off by default: the room is karaoke, and someone who knows the song
   * does not want the original singer in their ear.
   */
  const [guideVolume, setGuideVolume] = createSignal(0)

  /**
   * Score each line as the playhead leaves it.
   *
   * Live rather than at the end of the song, for two reasons. A singer who
   * stops halfway still gets the lines they sang, instead of losing the
   * take for not finishing. And the anchor stays honest: a line scored the
   * moment it ends carries the wall-clock instant it STARTED, so mapping
   * samples onto the song clock survives a seek, a pause, or a peer
   * arriving mid-verse -- none of which a single run-wide anchor would.
   */
  let openLine: { index: number; atMs: number; positionSec: number } | null =
    null

  createEffect(() => {
    const song = jamSong()
    const pos = jamSongPositionSec()
    if (song === null) {
      openLine = null
      return
    }
    const index = lineIndexAt(song.lines, pos)
    const open = openLine
    if (open !== null && open.index === index) return

    if (open !== null) {
      // Untracked: this effect fires on the PLAYHEAD, and the sample buffer
      // updates twenty times a second. Reading it as a dependency would
      // re-run the whole thing on every frame of singing, for a check that
      // can only change when the line does.
      untrack(() => {
        const mine = jamPeerId()
        // Nothing to score without an identity to look my samples up under.
        // Peers' trails are never scored here -- see the store's note on
        // why a score built from what somebody else reports is not evidence.
        if (mine === null || mine === '') return
        // Not my line, not my score. Being marked down for staying quiet
        // through somebody else's verse is the opposite of what assigning
        // parts is for.
        if (!jamLineIsMine(open.index)) return
        recordJamLineScore(
          scoreLiveLine(
            song.lines,
            open.index,
            song.notes,
            jamPitchHistory()[mine],
            { atMs: open.atMs, positionSec: open.positionSec },
          ),
        )
      })
    }
    openLine = index < 0 ? null : { index, atMs: Date.now(), positionSec: pos }
  })

  // The host's element drives the store; everyone else's follows it.
  onMount(() => {
    const el = audioRef
    if (el === undefined) return
    const onTime = () => {
      if (jamIsHost()) setJamSongPositionSec(el.currentTime)
    }
    el.addEventListener('timeupdate', onTime)
    onCleanup(() => el.removeEventListener('timeupdate', onTime))
  })

  /**
   * Space toggles playback, so a practice run starts without hunting for
   * a button. Host only -- it is the host's transport, and a guest hitting
   * space would either do nothing or (worse) fight the room.
   *
   * Ignored while typing: the chat box is right there, and swallowing a
   * space in a message is a much more annoying bug than a missing
   * shortcut.
   */
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !jamIsHost()) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'BUTTON' ||
        t?.isContentEditable === true
      ) {
        return
      }
      e.preventDefault()
      const at = audioRef?.currentTime ?? 0
      if (jamExercisePlaying() && !jamExercisePaused()) jamSongPause(at)
      else jamSongPlay(at)
    }
    document.addEventListener('keydown', onKey)
    onCleanup(() => document.removeEventListener('keydown', onKey))
  })

  /**
   * Move the playhead.
   *
   * The host's element has to be seeked FIRST. Its timeupdate is what
   * writes the store, so setting the store alone is overwritten by the
   * next tick with the element's unchanged position -- which is exactly
   * what made a scrub snap straight back to where it started. The element
   * is the clock; a seek has to move the clock, not the readout.
   *
   * A guest broadcasts nothing and moves nothing: it is not their
   * transport, and the drift effect will bring them to wherever the host
   * ends up anyway.
   */
  const seekTo = (toSec: number): void => {
    if (!jamIsHost()) return
    const el = audioRef
    if (el !== undefined) el.currentTime = toSec
    // The guide moves with it. The follow effect would catch this on the
    // next position tick anyway, but "anyway" is up to a quarter of a
    // second of the wrong words in your ear, and a scrub is precisely
    // when you are listening for where you landed.
    if (vocalRef !== undefined) vocalRef.currentTime = toSec
    jamSongSeek(toSec)
  }

  /**
   * Follow the room's transport.
   *
   * Split into two effects on purpose. The play/pause one must NOT depend
   * on the position, or it re-runs on every timeupdate -- four times a
   * second -- and each run calls play() or pause() again. That is what was
   * stopping the audio mid-song: a pause() racing the play() that had not
   * resolved yet, which the browser resolves by staying paused.
   */
  createEffect(() => {
    const el = audioRef
    if (el === undefined) return
    if (jamExercisePlaying() && !jamExercisePaused()) {
      // Autoplay can still be refused; the room stays paused rather than
      // pretending it is playing.
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  })

  /**
   * The guide vocal is a second element on the same clock.
   *
   * Kept in step with the backing track rather than driven independently:
   * two elements playing the same song a beat apart is worse than no
   * guide at all. It follows a tighter threshold than the peer resync
   * because these two are on ONE device with no network between them --
   * any gap here is a bug, not latency.
   */
  createEffect(() => {
    const guide = vocalRef
    const main = audioRef
    if (guide === undefined || main === undefined) return
    guide.volume = guideVolume()
    if (jamExercisePlaying() && !jamExercisePaused() && guideVolume() > 0) {
      // Snap on the way in rather than trusting where it stopped. Muting
      // pauses this element, so the playhead can travel a long way -- a
      // whole scrub -- while it sits still, and resuming from there is
      // exactly the "vocal is out of step" people hear.
      guide.currentTime = main.currentTime
      void guide.play().catch(() => {})
    } else {
      guide.pause()
    }
  })

  /**
   * ...and follows the playhead once it is running.
   *
   * Separate from the effect above, for the same reason the room's own
   * transport is split in two: this one has to re-run on every position
   * change, and an effect that calls play() or pause() on every tick
   * races itself.
   *
   * The dependency is the ROOM's position, not `main.currentTime`. A DOM
   * property is not reactive, so the old single effect never re-ran on a
   * seek at all -- the guide vocal simply carried on from wherever it was,
   * permanently out of step until you happened to toggle the volume.
   */
  createEffect(() => {
    jamSongPositionSec()
    const guide = vocalRef
    const main = audioRef
    if (guide === undefined || main === undefined || guide.paused) return
    if (Math.abs(guide.currentTime - main.currentTime) > GUIDE_DRIFT_SEC) {
      guide.currentTime = main.currentTime
    }
  })

  /**
   * Correct drift, guests only, and only past the threshold -- a seek is
   * audible, so chasing 50ms of jitter is worse than the jitter.
   *
   * The host is excluded because its element IS the clock: seeking it to
   * the position it just reported is a feedback loop.
   */
  createEffect(() => {
    const el = audioRef
    const target = jamSongPositionSec()
    if (el === undefined || jamIsHost()) return
    if (Math.abs(el.currentTime - target) > RESYNC_THRESHOLD_SEC) {
      el.currentTime = target
    }
  })

  return (
    <Show when={jamSong()}>
      {(song) => (
        <div class={styles.stage}>
          <audio
            ref={audioRef}
            src={song().stems.instrumental}
            preload="auto"
            crossorigin="anonymous"
          />
          <Show when={song().stems.vocal}>
            {(url) => (
              <audio
                ref={vocalRef}
                src={url()}
                preload="auto"
                crossorigin="anonymous"
              />
            )}
          </Show>

          <Show
            when={song().origin === 'local' && jamConnectedPeers().length > 0}
          >
            <div class={styles.localWarning} role="note">
              Only you can hear this — it is on your device, not shared with the
              room yet. Everyone else sees the words and the pitch lanes.
            </div>
          </Show>

          <div class={styles.transport}>
            <span class={styles.title}>
              {song().title}
              <Show when={song().artist}>
                <span class={styles.artist}> · {song().artist}</span>
              </Show>
            </span>
            {/* Your take so far. Only yours: everyone scores themselves
                from their own microphone, so this is not a scoreboard and
                is deliberately not presented as one. */}
            <Show when={jamSongRunScore()}>
              {(run) => (
                <span
                  class={styles.runScore}
                  aria-label={`Your score: ${run().score} out of 100, across ${run().sungLines} of ${run().totalLines} lines`}
                >
                  <strong>{run().score}</strong>
                  <span class={styles.runLines}>
                    {run().sungLines}/{run().totalLines} lines
                  </span>
                </span>
              )}
            </Show>
            {/* Everyone sees the position; only the host can move it.
                Knowing where you are in the song is not a privilege, but a
                room with two people dragging the playhead is a room nobody
                can sing in. */}
            <JamSongScrubber
              positionSec={jamSongPositionSec}
              durationSec={() =>
                audioRef?.duration !== undefined &&
                Number.isFinite(audioRef.duration)
                  ? audioRef.duration
                  : song().durationSec
              }
              canSeek={jamIsHost()}
              onSeek={(to) => seekTo(to)}
            />

            <JamLyricVersionPicker />

            <Show when={song().stems.vocal}>
              <JamGuideVocal volume={guideVolume} onVolume={setGuideVolume} />
            </Show>

            <Show when={jamIsHost()}>
              <div class={styles.buttons}>
                <button
                  class={styles.btn}
                  onClick={() =>
                    jamExercisePlaying() && !jamExercisePaused()
                      ? jamSongPause(audioRef?.currentTime ?? 0)
                      : jamSongPlay(audioRef?.currentTime ?? 0)
                  }
                >
                  {jamExercisePlaying() && !jamExercisePaused()
                    ? 'Pause'
                    : 'Play'}
                </button>
                <button
                  class={styles.btn}
                  onClick={() => {
                    // Same reason as seekTo: stop rewinds the clock, and
                    // the element IS the clock. Both elements, or the
                    // guide resumes mid-song against a backing track that
                    // restarted from the top.
                    if (audioRef !== undefined) audioRef.currentTime = 0
                    if (vocalRef !== undefined) vocalRef.currentTime = 0
                    jamSongStop()
                  }}
                >
                  Stop
                </button>
              </div>
            </Show>
          </div>

          <div class={styles.split}>
            <JamSongLyrics
              scores={jamSongLineScores}
              onSeek={jamIsHost() ? (to) => seekTo(to) : undefined}
              lines={song().lines}
              positionSec={jamSongPositionSec}
              showNotes={false}
            />
            <JamPeerLanes
              myPeerId={jamPeerId}
              notes={() => song().notes}
              positionSec={jamSongPositionSec}
            />
          </div>
        </div>
      )}
    </Show>
  )
}
