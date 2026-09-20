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

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { activateAudioPlayback, installAudioUnlock } from '@/lib/audio-unlock'
import { createJamGuidePlayer } from '@/lib/jam/jam-guide-player'
import { advanceJamLineScoreTracker, EMPTY_JAM_LINE_SCORE_TRACKER, } from '@/lib/jam/jam-line-score-tracker'
import { scoreLiveLine } from '@/lib/jam/jam-line-scoring'
import { createJamSongTransport } from '@/lib/jam/jam-song-transport'
import { jamSplitBounds, jamSplitShare, resetJamSplitShare, setJamSplitShare, } from '@/lib/jam/jam-view-prefs'
import { followMediaClock } from '@/lib/jam/media-clock'
import { initAudioEngine } from '@/stores/app-store'
import { jamError, jamExercisePaused, jamExercisePlaying, jamGuideVolume, jamIsHost, jamLineIsMine, jamPeerId, jamPitchHistory, jamShowPitch, jamSong, jamSongHostTarget, jamSongLineScores, jamSongPause, jamSongPositionSec, jamSongSeek, jamSongSeekRequest, jamSongStop, recordJamLineScore, setJamError, setJamExercisePaused, setJamGuideVolume, setJamSongMediaDurationSec, setJamSongPositionSec, songIsPlayableHere, } from '@/stores/jam-store'
import { JamGuideVocal } from './JamGuideVocal'
import { JamPeerLanes } from './JamPeerLanes'
import { JamSongLyrics } from './JamSongLyrics'
import styles from './JamSongStage.module.css'
import { JamSplitHandle } from './JamSplitHandle'
import { JamTransferDialog } from './JamTransferDialog'

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

/** Its own constant so the notice can be taken back without guessing. */
const BUFFERING = 'Buffering — the backing track is not arriving smoothly.'

/**
 * Below this the stage is one column with the lanes underneath.
 *
 * The breakpoint lives here rather than in the stylesheet because the
 * layout is no longer a pure CSS decision: the split handle has to know
 * which axis it is trading, and which of the two remembered shares it is
 * writing. One source of truth beats a media query and a JS copy of it
 * that can disagree in the fifty pixels either side.
 */
const STACKED_QUERY = '(max-width: 900px)'

export const JamSongStage: Component = () => {
  let audioRef: HTMLAudioElement | undefined
  let splitRef: HTMLDivElement | undefined

  /** One column, lanes underneath -- a phone, or a narrow window. */
  const [stacked, setStacked] = createSignal(false)

  onMount(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(STACKED_QUERY)
    setStacked(mql.matches)
    const onChange = (): void => {
      setStacked(mql.matches)
    }
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange)
      onCleanup(() => mql.removeEventListener('change', onChange))
      return
    }
    // Older WebKit has only the deprecated pair.
    const legacy = mql as MediaQueryList & {
      addListener: (cb: () => void) => void
      removeListener: (cb: () => void) => void
    }
    legacy.addListener(onChange)
    onCleanup(() => legacy.removeListener(onChange))
  })

  /** The share of the stage the words get, for whichever layout is on. */
  const lyricShare = (): number => jamSplitShare(stacked())
  const splitBounds = () => jamSplitBounds(stacked())

  // Only a song with a vocal stem has a guide to turn up or down. A memo and
  // one builder, not an expression in the JSX: the song object is replaced
  // whenever its words, notes or parts change, and an inline builder would be
  // a new function each time -- a new control, in the middle of a drag.
  const hasGuideVocal = createMemo(() => jamSong()?.stems.vocal !== undefined)
  const guideVocal = (): JSX.Element => (
    <JamGuideVocal
      overWords
      volume={jamGuideVolume}
      onVolume={setJamGuideVolume}
    />
  )

  /**
   * Guide-vocal level, per person and not room state -- see JamGuideVocal.
   *
   * Read here, set elsewhere: the control lives in JamPanel now, in the
   * transport row on a desktop and docked above the tab bar on a phone.
   * This component only needs the number, to drive the guide player.
   */
  const guideVolume = jamGuideVolume

  /**
   * The guide vocal plays through Web Audio, NOT a second <audio> element.
   *
   * TV browsers run one hardware media pipeline, so a second element's
   * play() pauses the backing track — heard as the guide "soloing" the
   * moment it is unmuted. A decoded buffer through a GainNode leaves the
   * backing track's element alone. See jam-guide-player.ts.
   */
  let engineContext: AudioContext | null = null
  const guidePlayer = createJamGuidePlayer({
    context: () => engineContext,
  })
  onCleanup(() => guidePlayer.dispose())

  /**
   * Every audible edge of the backing track goes through here.
   *
   * The element used to be driven bare -- play(), pause(), currentTime --
   * and each of those is a full-scale step in one sample. In a room that
   * is a loud pop on every stop and every start, which is most of what a
   * practice consists of. See jam-song-transport.ts for why it attaches
   * to the graph lazily rather than on mount.
   */
  const transport = createJamSongTransport({
    element: () => audioRef,
    context: () => engineContext,
  })
  onCleanup(() => transport.dispose())

  // The timeline outside this stage reads the element's length from the
  // store. It belongs to ONE song: a new source has not reported yet, and
  // the last song's length under this one's timeline would put the
  // playhead in the wrong place until it does.
  //
  // Keyed on a MEMO of the source. The song object is replaced whenever the
  // pitch guide lands or the words are edited, with the same file under
  // it; forgetting the length then would be for good, because an element
  // whose source has not changed never reports it again.
  const instrumentalSrc = createMemo(() => jamSong()?.stems.instrumental)
  createEffect(
    on(instrumentalSrc, () => setJamSongMediaDurationSec(null), {
      defer: true,
    }),
  )
  onCleanup(() => setJamSongMediaDurationSec(null))

  /**
   * Have a context ready before anyone presses Play.
   *
   * Otherwise one exists only once the guide vocal has been unmuted, and
   * a singer who never touches the guide would get the un-enveloped path
   * for the whole session -- which is to say, the pop. Constructing the
   * engine does not start it; the unlock listeners below resume it on the
   * first tap in the room.
   */
  onMount(() => {
    void initAudioEngine().then((engine) => {
      engineContext ??= engine.getAudioContext()
    })
  })

  /**
   * Recovery for a context that went to sleep. The guide can be started
   * by a NETWORK event (the host presses Play, this device only receives
   * a message), which is not a gesture, so resume() can be refused and
   * the context sit suspended. These document-level listeners resume it
   * on the next tap anywhere and after a background/foreground cycle.
   */
  onCleanup(installAudioUnlock(() => engineContext))

  /** The guide is wanted audible: stem present, level up, room playing. */
  const guideWanted = (): boolean =>
    guidePlayer.loadedUrl() !== null &&
    untrack(guideVolume) > 0 &&
    untrack(jamExercisePlaying) &&
    !untrack(jamExercisePaused)

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
  let lineScoreTracker = EMPTY_JAM_LINE_SCORE_TRACKER

  createEffect(() => {
    const song = jamSong()
    const pos = jamSongPositionSec()
    const step = advanceJamLineScoreTracker(lineScoreTracker, {
      songId: song?.id ?? null,
      lines: song?.lines ?? [],
      positionSec: pos,
      nowMs: Date.now(),
      isPlaying: jamExercisePlaying(),
      isPaused: jamExercisePaused(),
      navigation: jamSongSeekRequest(),
    })
    lineScoreTracker = step.state
    const completed = step.completedLine
    if (song === null || completed === null) return

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
      if (!jamLineIsMine(completed.index)) return
      recordJamLineScore(
        scoreLiveLine(
          song.lines,
          completed.index,
          song.notes,
          jamPitchHistory()[mine],
          { atMs: completed.atMs, positionSec: completed.positionSec },
        ),
      )
    })
  })

  /**
   * Why the audio stopped, when it stops by itself.
   *
   * Every one of these used to be silent. The element could fail to decode,
   * lose its source, stall, or have playback refused outright, and the room
   * carried on believing it was playing -- the song simply went quiet and
   * nobody could say why. A room that stops without a reason is
   * indistinguishable from a room that is broken.
   */
  const explainMediaError = (err: MediaError | null): string => {
    switch (err?.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return 'Playback was cancelled.'
      case MediaError.MEDIA_ERR_NETWORK:
        return 'The song stopped: the backing track could not be fetched. If somebody shared it with you, ask them to send it again.'
      case MediaError.MEDIA_ERR_DECODE:
        return 'The song stopped: the audio would not decode. The file may have arrived damaged.'
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return 'The song stopped: this device cannot play that audio, or the track is no longer available on it.'
      default:
        return 'The song stopped and the browser did not say why.'
    }
  }

  /**
   * Why Play did nothing -- and what to do about it.
   *
   * The common case by far is a guest the file has not reached yet: the
   * host presses Play, the room starts, and this device is holding a
   * manifest pointing at a blob that only exists on the host's machine.
   * "The song could not start on this device" was true and useless. Every
   * branch here names the one action that fixes it.
   */
  const explainPlayFailure = (err: unknown): string => {
    if (!songIsPlayableHere(jamSong())) {
      return jamIsHost()
        ? 'This device does not have the backing track — reload the song and try again.'
        : 'You do not have this song yet — ask the host to send it, then press Play again.'
    }
    if (err instanceof Error && err.name === 'NotAllowedError') {
      return 'Your browser blocked playback until you interact with the page — press Play again.'
    }
    return 'The song could not start on this device — ask the host to send it again, or reload the page.'
  }

  onMount(() => {
    const el = audioRef
    if (el === undefined) return

    const onError = () => {
      // A guest holding the host's own blob URL is EXPECTED to fail here:
      // the room is working as designed and the share strip already says
      // so. Shouting "the song stopped" at them would be a false alarm
      // about the one case that is not a fault.
      if (!songIsPlayableHere(jamSong())) return
      setJamError(explainMediaError(el.error))
      // Stop claiming to play. The host owns the room's transport, so it
      // pauses the room; a guest only stops itself, because one person's
      // broken file is not everybody's.
      if (jamIsHost()) jamSongPause(el.currentTime)
      else setJamExercisePaused(true)
    }

    // A stall is not necessarily fatal -- it is the network catching up --
    // so it says so without stopping anything.
    const onStalled = () => {
      if (jamExercisePlaying() && !jamExercisePaused()) setJamError(BUFFERING)
    }

    // ...and takes it back when the audio resumes. A transient condition
    // that leaves a permanent banner is worse than saying nothing: the
    // next real problem arrives to a message nobody trusts. Only its own
    // notice is cleared, so a genuine error is never wiped by playback
    // happening to recover elsewhere.
    const onPlaying = () => {
      if (jamError() === BUFFERING) setJamError(null)
    }

    // Reaching the end is a normal stop, but the room should still land in
    // a state that matches: playing stays true otherwise, and the next
    // press of Play does nothing visible.
    const onEnded = () => {
      if (jamIsHost()) jamSongStop()
    }

    el.addEventListener('error', onError)
    el.addEventListener('stalled', onStalled)
    el.addEventListener('playing', onPlaying)
    el.addEventListener('ended', onEnded)
    onCleanup(() => {
      el.removeEventListener('error', onError)
      el.removeEventListener('stalled', onStalled)
      el.removeEventListener('playing', onPlaying)
      el.removeEventListener('ended', onEnded)
    })
  })

  /**
   * Every device's own element is its own clock.
   *
   * This used to be host-only, which left a guest's position frozen at
   * whatever the last transport message said: their audio played on while
   * the lyric column sat still, the lanes stopped scrolling and no line
   * ever scored. Everything downstream reads this position, so on a guest
   * it only moved when somebody pressed play.
   *
   * The host's broadcast is still authoritative -- it just arrives as a
   * correction (jamSongHostTarget) rather than as the only source.
   *
   * Read per frame while it plays, not only on `timeupdate`: that event
   * fires about four times a second, and everything drawn from this position
   * -- the lanes above all -- stepped in quarter-second jumps past a live
   * pitch trail running off its own per-frame clock.
   */
  onMount(() => {
    const el = audioRef
    if (el === undefined) return
    onCleanup(followMediaClock(el, setJamSongPositionSec))
  })

  // Space is play/pause here as it is for a drill, and it is the room's
  // transport bar (JamTransport) that listens for it: one key, one owner,
  // whichever engine is loaded.

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
    // jamSongSeek raises a seek request, which the effect below answers by
    // moving both elements. Going through the store rather than touching
    // the element here is what lets the transport bar live outside this
    // component: anything can ask for the playhead to move.
    jamSongSeek(toSec)
  }

  /**
   * Move the clock when the room asks.
   *
   * The element IS the clock -- its timeupdate writes the store -- so a
   * seek has to move the element or the next tick overwrites the store
   * with the unchanged position, which is what made an early scrub snap
   * straight back to where it started.
   *
   * The guide vocal moves with it. The follow effect would catch up on the
   * next position tick anyway, but "anyway" is up to a quarter of a second
   * of the wrong words in your ear, and a scrub is precisely when you are
   * listening for where you landed.
   */
  createEffect(() => {
    const req = jamSongSeekRequest()
    // Token 0 is "nobody has asked yet" -- without this the effect would
    // rewind a freshly opened song to zero on mount.
    if (req.token === 0) return
    transport.seek(req.toSec)
    // A buffer source cannot be seeked; restarting at the offset IS the
    // seek. Gated on wanted, not on playing(): a guide that ran off the
    // end of a short vocal stem is stopped, and a seek back into the song
    // is exactly when the singer expects it to come back.
    if (guideWanted()) guidePlayer.start(req.toSec)
  })

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
    if (audioRef === undefined) return
    if (jamExercisePlaying() && !jamExercisePaused()) {
      // A refused play() used to be swallowed by an empty catch, which is
      // how a room could sit there "playing" in total silence. Autoplay
      // policy is the usual reason and the user can fix it in one tap, but
      // only if somebody tells them.
      void transport.play().catch((err: unknown) => {
        const why = explainPlayFailure(err)
        setJamError(why)
        if (!jamIsHost()) setJamExercisePaused(true)
      })
    } else {
      transport.pause()
    }
  })

  /**
   * The guide vocal runs on the backing track's clock.
   *
   * The effect captures the desired state synchronously (Solid signals
   * must not be read after an await) and hands it to an async applier:
   * the first unmute has to initialise the engine and decode the stem,
   * and both are awaits. The epoch guard drops a decode that finishes
   * after the user has already muted again or the song changed.
   */
  let guideEpoch = 0

  const applyGuideState = async (
    desired: { url: string | null; volume: number; shouldPlay: boolean },
    epoch: number,
  ): Promise<void> => {
    if (!desired.shouldPlay || desired.url === null) {
      guidePlayer.stop()
      return
    }
    // Already sounding the right stem: only the level moved.
    if (guidePlayer.playing() && guidePlayer.loadedUrl() === desired.url) {
      guidePlayer.setVolume(desired.volume)
      return
    }
    const engine = await initAudioEngine()
    try {
      await activateAudioPlayback(engine)
    } catch {
      // Not in a gesture yet -- the unmute tap that follows will unlock.
    }
    engineContext = engine.getAudioContext()
    const ok = await guidePlayer.load(desired.url)
    if (epoch !== guideEpoch) return
    if (!ok) {
      setJamError(
        'The guide vocal could not be loaded on this device — the backing track keeps playing without it.',
      )
      return
    }
    // Snap to wherever the song is NOW, after the decode -- not where it
    // was when the tap landed. A DOM read, not a signal, so it is safe
    // on this side of the awaits.
    guidePlayer.start(audioRef?.currentTime ?? 0, desired.volume)
  }

  createEffect(() => {
    const url = jamSong()?.stems.vocal ?? null
    const volume = guideVolume()
    const desired = {
      url,
      volume,
      shouldPlay:
        jamExercisePlaying() &&
        !jamExercisePaused() &&
        volume > 0 &&
        url !== null,
    }
    void applyGuideState(desired, ++guideEpoch)
  })

  /**
   * ...and follows the playhead once it is running.
   *
   * Separate from the effect above, for the same reason the room's own
   * transport is split in two: this one has to re-run on every position
   * change, and an effect that restarts playback on every tick races
   * itself.
   *
   * The dependency is the ROOM's position, not `main.currentTime`. A DOM
   * property is not reactive, so an effect reading only the element would
   * never re-run on a seek at all.
   */
  createEffect(() => {
    jamSongPositionSec()
    const main = audioRef
    if (main === undefined || !guideWanted()) return
    // A suspended context freezes positionSec, so restarting into it
    // would churn a fresh silent source on every tick. The unlock
    // listeners resume the context; the next tick lands here again and
    // the drift check below snaps the guide to wherever the song got to.
    if (engineContext !== null && engineContext.state !== 'running') return
    const pos = guidePlayer.positionSec()
    // null is "wanted but not sounding" -- the stem ran out and the
    // playhead came back, or a start was refused -- so it restarts too.
    if (pos === null || Math.abs(pos - main.currentTime) > GUIDE_DRIFT_SEC) {
      guidePlayer.start(main.currentTime)
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
    // The HOST's number, not the local one. Comparing the element against
    // a position the element itself writes is a loop that can only ever
    // agree with itself.
    const target = jamSongHostTarget()
    if (el === undefined || jamIsHost()) return
    if (Math.abs(el.currentTime - target) > RESYNC_THRESHOLD_SEC) {
      transport.seek(target)
    }
  })

  return (
    <Show when={jamSong()}>
      {(song) => (
        <div class={styles.stage} data-tour="jam.stage">
          <JamTransferDialog />
          {/* The ONLY media element on the stage, deliberately: the guide
              vocal goes through Web Audio (jam-guide-player.ts) because a
              second element's play() pauses this one on TV browsers. */}
          <audio
            ref={audioRef}
            src={song().stems.instrumental}
            preload="auto"
            crossorigin="anonymous"
            // The timeline lives outside this stage and cannot ask the
            // element, so the element tells the room. `durationchange`
            // covers the metadata arriving AND a stream whose length grows.
            onDurationChange={(event) => {
              const seconds = event.currentTarget.duration
              setJamSongMediaDurationSec(
                Number.isFinite(seconds) && seconds > 0 ? seconds : null,
              )
            }}
          />

          {/* There is no bar here any more. The song's name is in the room
              header (JamNowSinging) and its timeline is on the row of
              playback controls (JamSongTimeline) -- a row of its own
              between the controls and the words was a third row of chrome,
              and the words are what the room is for. Nothing in either
              needs this element: a seek is a request this stage answers
              (jamSongSeekRequest), and the duration is reported below. */}

          {/* The share is a CSS custom property rather than a full
              template, so the stylesheet keeps owning which axis is
              being split and the component owns only the number. */}
          <div
            class={styles.split}
            ref={splitRef}
            data-layout={
              !jamShowPitch() ? 'solo' : stacked() ? 'stacked' : 'wide'
            }
            style={{ '--jam-lyrics-share': `${lyricShare()}%` }}
          >
            <JamSongLyrics
              scores={jamSongLineScores}
              onSeek={jamIsHost() ? (to) => seekTo(to) : undefined}
              lines={song().lines}
              positionSec={jamSongPositionSec}
              playing={() => jamExercisePlaying() && !jamExercisePaused()}
              showNotes={false}
              // Everybody gets it, guests included: the transport is the
              // host's, but how loud the original singer is in your own
              // ears is yours.
              corner={hasGuideVocal() ? guideVocal : undefined}
            />
            {/* The PITCH toggle's consumer in a song room. Before this
                gate the button was rendered here but its only consumer
                (the drill monitor strip) never mounted — pressing it
                changed nothing on screen in either direction.
                With the lanes off there is nothing to trade space with,
                so the handle goes too and the words take the stage. */}
            <Show when={jamShowPitch()}>
              <JamSplitHandle
                stacked={stacked}
                share={lyricShare}
                min={() => splitBounds().min}
                max={() => splitBounds().max}
                container={() => splitRef}
                onShare={(next) => setJamSplitShare(stacked(), next)}
                onReset={() => resetJamSplitShare(stacked())}
              />
              <JamPeerLanes
                myPeerId={jamPeerId}
                notes={() => song().notes}
                positionSec={jamSongPositionSec}
              />
            </Show>
          </div>
        </div>
      )}
    </Show>
  )
}
