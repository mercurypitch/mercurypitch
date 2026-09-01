// Guitar Night's backing-only room plays authored drums without inventing guitar score authority.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ChevronLeft, Metronome, Pause, Play, SlidersHorizontal, Square, } from '@/components/icons'
import { LoopRangeRail } from '@/components/shared/LoopRangeRail'
import type { GuitarRoomBandPercussionHit } from '@/features/guitar/backing/guitar-room-band'
import { guitarTrackAudibleAfterMuteToggle } from '@/features/guitar/backing/guitar-track-mix'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import styles from './GuitarNightApp.module.css'
import { GuitarNightDrumSoundControls } from './GuitarNightDrumSoundControls'
import { GuitarNightLoopControls } from './GuitarNightLoopControls'
import { GuitarNightSessionPanel } from './GuitarNightSessionPanel'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightReference } from './reference-port'
import type { SheetLane } from './sheet/sheet-model'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'
import { percussionDurationBeats, SCORE_ROOM_MAX_TEMPO, SCORE_ROOM_MIN_TEMPO, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'

interface GuitarNightPercussionRoomProps {
  reference: Accessor<GuitarNightReference>
  suspended?: Accessor<boolean>
  onSongs(): void
  sheetLanes: Accessor<readonly SheetLane[]>
  sheetTimeSignatures?: Accessor<readonly MidiTimeSignature[] | undefined>
  sheetVisibleTrackIds: Accessor<readonly string[]>
  onToggleSheetTrack(trackId: string): void
  backingPercussion: Accessor<readonly GuitarRoomBandPercussionHit[]>
  audibleBackingTrackIds: Accessor<readonly string[]>
  /** Explicit M state stays distinct while Solo temporarily masks other lanes. */
  mutedBackingTrackIds: Accessor<readonly string[]>
  onToggleBackingTrack(trackId: string): void
  soloedBackingTrackId: Accessor<string | null>
  onToggleSoloBackingTrack(trackId: string): void
  /** Native reference lane shown beside Neck; it never becomes score authority. */
  secondaryLane?: Accessor<SheetLane | null>
  followedStageTrackId?: Accessor<string | null>
  onFollowStageTrack?(trackId: string | null): void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

/** Beats are counted from one on screen, the way a player counts them. */
function formatBeat(beat: number): string {
  const countedBeat = Math.max(0, beat) + 1
  const label = Number.isInteger(countedBeat)
    ? String(countedBeat)
    : countedBeat.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `beat ${label}`
}

export function GuitarNightPercussionRoom(
  props: GuitarNightPercussionRoomProps,
) {
  let roomHeading!: HTMLHeadingElement
  const [sessionPanelOpen, setSessionPanelOpen] = createSignal(false)
  const loopLimitBeats = createMemo(() =>
    Math.max(1, Math.ceil(percussionDurationBeats(props.backingPercussion()))),
  )
  const loop = useGuitarNightLoopController({ limit: loopLimitBeats })
  const room = useGuitarNightScoreRoomController({
    reference: () => props.reference(),
    loop: loop.span,
    backingPercussion: () => props.backingPercussion(),
    audiblePercussionTrackIds: () => props.audibleBackingTrackIds(),
    defaultHearScore: () => false,
  })
  const displayedReference = createMemo(
    () => room.displayReference() ?? props.reference(),
  )
  const hitCount = createMemo(() =>
    displayedReference().tracks.reduce(
      (total, track) =>
        total + (track.kind === 'percussion' ? track.hitCount : 0),
      0,
    ),
  )
  const isRunning = createMemo(
    () => room.status() === 'count-in' || room.status() === 'playing',
  )
  const playbackLabel = createMemo(() => {
    if (room.status() === 'starting') return 'Opening the room clock'
    if (isRunning()) return 'Pause drum backing'
    if (room.status() === 'paused') return 'Resume drum backing'
    if (room.status() === 'complete') return 'Replay drum backing'
    return 'Start drum backing'
  })
  const stage: GuitarPerformanceStageSource = {
    title: () => displayedReference().title,
    notes: () => [],
    timeline: {
      positionSeconds: room.displayPositionSeconds,
      durationSeconds: room.durationSeconds,
      playheadBeat: room.playheadBeat,
      tempoBpm: room.tempoBpm,
    },
  }
  let scrubbing = false
  let resumeAfterScrub = false
  let ownedSongId = untrack(() => props.reference().songId)

  /** Whole-beat marks keep every scheduler lap on the same downbeat. */
  const snapLoopBeat = (beat: number, mark: 'A' | 'B'): number => {
    if (
      mark === 'B' &&
      room.durationBeats() > 0 &&
      beat >= room.durationBeats() - 0.01
    ) {
      return loopLimitBeats()
    }
    return Math.round(beat)
  }

  const markLoopAtPlayhead = (mark: 'A' | 'B'): void => {
    const fallback = mark === 'A' ? 0 : loopLimitBeats()
    const visibleBeat = room.playheadBeat()
    const beat = snapLoopBeat(visibleBeat ?? fallback, mark)
    if (mark === 'A') loop.markStart(beat)
    else loop.markEnd(beat)
    void room.applyLoopSpan(loop.span())
  }

  const moveLoopBoundary = (mark: 'A' | 'B', beat: number): void => {
    loop.moveMark(mark, snapLoopBeat(beat, mark))
  }

  const commitLoopBoundary = (): void => {
    void room.applyLoopSpan(loop.span())
  }

  const clearLoop = (): void => {
    loop.clear()
    void room.applyLoopSpan(null)
  }

  const beginScrub = (): void => {
    if (scrubbing) return
    scrubbing = true
    const currentStatus = room.status()
    resumeAfterScrub =
      currentStatus === 'starting' ||
      currentStatus === 'count-in' ||
      currentStatus === 'playing'
    room.pause()
  }

  const finishScrub = (): void => {
    if (!scrubbing) return
    const shouldResume = resumeAfterScrub
    scrubbing = false
    resumeAfterScrub = false
    if (
      shouldResume &&
      room.status() === 'paused' &&
      props.suspended?.() !== true
    ) {
      void room.start()
    }
  }

  const leaveRoom = (): void => {
    room.stop()
    props.onSongs()
  }

  createEffect(() => {
    if (props.suspended?.() === true) room.pause()
  })

  createEffect(() => {
    const songId = props.reference().songId
    if (songId === ownedSongId) return
    ownedSongId = songId
    scrubbing = false
    resumeAfterScrub = false
    loop.clear()
    room.stop()
  })

  onMount(() => {
    roomHeading.focus({ preventScroll: true })
    onCleanup(
      installSpacePlaybackToggle({
        toggle: room.toggle,
        ownsSpace: () => props.suspended?.() !== true && !sessionPanelOpen(),
        enabled: () => room.status() !== 'starting',
      }),
    )
  })

  return (
    <section
      class={styles.roomPanel}
      data-testid="guitar-night-percussion-room"
      data-stage-scope="true"
      data-room-kind="backing-only"
      data-score-authority="none"
    >
      <div class={styles.panelEdge} aria-hidden="true" />
      <div class={styles.roomHeadingRow}>
        <div class={styles.roomIdentity}>
          <button
            type="button"
            class={styles.roomBack}
            aria-label="Back to Songs"
            onClick={leaveRoom}
          >
            <span aria-hidden="true">
              <ChevronLeft />
            </span>
          </button>
          <button
            type="button"
            class={styles.roomIdentityTrigger}
            aria-haspopup="dialog"
            aria-expanded={sessionPanelOpen()}
            aria-label={`Open track mixer for ${displayedReference().title}`}
            data-testid="guitar-night-session-trigger"
            onClick={() => setSessionPanelOpen(true)}
          >
            <p class={styles.eyebrow}>
              <span class={styles.roomIdentityMixCue} aria-hidden="true">
                <SlidersHorizontal />
                Mix
              </span>
              Backing-only rehearsal · free play
            </p>
            <h1
              ref={roomHeading}
              tabindex="-1"
              title={displayedReference().title}
            >
              {displayedReference().title}
            </h1>
          </button>
        </div>
        <div class={styles.roomHeadingMeta}>
          <span class={styles.trackCount}>
            {hitCount()} authored {hitCount() === 1 ? 'hit' : 'hits'} ·{' '}
            {Math.max(1, Math.ceil(room.durationBeats()))} beats
          </span>
          <div class={styles.roomTools} aria-label="Room tools">
            <button
              type="button"
              aria-pressed={room.hearClick()}
              aria-label={room.hearClick() ? 'Mute click' : 'Hear click'}
              onClick={() => room.setHearClick((hearing) => !hearing)}
            >
              <span aria-hidden="true">
                <Metronome />
              </span>
              <strong>{room.hearClick() ? 'Click on' : 'Click off'}</strong>
            </button>
          </div>
        </div>
      </div>

      <GuitarNightStage
        source={stage}
        tuning={() => displayedReference().tuning}
        active={() => true}
        initialMode="sheet"
        availableViews={() => ['sheet', 'neck']}
        sheetLanes={props.sheetLanes}
        {...(props.secondaryLane === undefined
          ? {}
          : { secondaryLane: props.secondaryLane })}
        {...(props.sheetTimeSignatures === undefined
          ? {}
          : { sheetTimeSignatures: props.sheetTimeSignatures })}
        scoredTrackId={() => undefined}
        sheetEmptyNote="All drum reference lanes are hidden. Open the arrangement to show one."
        guideLabel={() => `${displayedReference().title} · drum reference`}
        idleStatus={() => ({
          label: 'Free play',
          detail:
            'The authored drums are backing only. Your guitar is not scored.',
        })}
        showStatus={() => false}
        focusSingleSheetSystem={() => true}
        invitationNote={() =>
          'Follow the drum sheet or switch to Neck for free play. No guitar score is attached.'
        }
      />

      <Show when={room.error()}>
        {(message) => (
          <p class={styles.playbackError} role="alert">
            {message()}
          </p>
        )}
      </Show>

      <Show when={sessionPanelOpen()}>
        <GuitarNightSessionPanel
          reference={displayedReference}
          visibleTrackIds={props.sheetVisibleTrackIds}
          onToggleTrackVisible={props.onToggleSheetTrack}
          audibleTrackIds={props.audibleBackingTrackIds}
          mutedTrackIds={props.mutedBackingTrackIds}
          onToggleTrackAudible={(trackId) => {
            if (room.setupLocked() && !room.percussionBackingLive()) return
            room.setPercussionTrackAudible(
              trackId,
              guitarTrackAudibleAfterMuteToggle(
                trackId,
                props.mutedBackingTrackIds(),
                props.soloedBackingTrackId(),
              ),
            )
            props.onToggleBackingTrack(trackId)
          }}
          soloedTrackId={props.soloedBackingTrackId}
          onToggleTrackSolo={props.onToggleSoloBackingTrack}
          takeActive={room.setupLocked}
          percussionControlsLive={room.percussionBackingLive}
          masterLevel={room.masterVolume}
          onMasterLevel={room.setMasterVolume}
          trackLevelDb={room.trackLevelDb}
          onTrackLevelDb={room.setTrackLevelDb}
          onResetTrackLevels={room.resetTrackLevels}
          {...(props.followedStageTrackId === undefined
            ? {}
            : { followedTrackId: props.followedStageTrackId })}
          onFollowTrack={(trackId) => {
            props.onFollowStageTrack?.(trackId)
            setSessionPanelOpen(false)
          }}
          drumSoundControls={
            <GuitarNightDrumSoundControls
              liveKit
              onKitChange={room.setDrumKit}
            />
          }
          scoredPartSounds={() => false}
          onSelectTrack={() => undefined}
          onClose={() => {
            setSessionPanelOpen(false)
            queueMicrotask(() =>
              document
                .querySelector<HTMLButtonElement>(
                  '[data-testid="guitar-night-session-trigger"]',
                )
                ?.focus(),
            )
          }}
        />
      </Show>

      <div
        class={`${styles.transportDeck} ${styles.percussionTransportDeck}`}
        data-testid="guitar-night-score-deck"
      >
        <div class={styles.percussionTransportIdentity}>
          <span>Authored drum clock · no guitar score or neck grading</span>
        </div>
        <div class={styles.timeRail}>
          <output aria-label="Elapsed backing time">
            {formatTime(room.displayPositionSeconds())}
          </output>
          <LoopRangeRail
            axisDomain={() => ({
              start: 0,
              end: room.durationSeconds() > 0 ? room.durationSeconds() : 1,
            })}
            axisValue={room.displayPositionSeconds}
            markDomain={() => ({ start: 0, end: loopLimitBeats() })}
            markA={loop.markA}
            markB={loop.markB}
            toAxis={room.secondsForBeat}
            fromAxis={room.beatForSeconds}
            active={loop.isLooping}
            axisStep={() => Math.max(0.05, 15 / room.tempoBpm())}
            markStep={() => 1}
            minimumMarkGap={() => 1}
            formatAxisValue={(seconds) =>
              `${formatTime(seconds)} of ${formatTime(room.durationSeconds())} · ${formatBeat(room.beatForSeconds(seconds))}`
            }
            formatMarkValue={formatBeat}
            seekLabel="Drum backing position"
            onSeek={room.seekSeconds}
            onScrubStart={beginScrub}
            onScrubEnd={finishScrub}
            snapMarkValue={snapLoopBeat}
            onMoveMarkA={(beat) => moveLoopBoundary('A', beat)}
            onMoveMarkB={(beat) => moveLoopBoundary('B', beat)}
            onCommitMark={commitLoopBoundary}
            testIdPrefix="guitar-night-percussion"
          />
          <output aria-label="Backing duration">
            {formatTime(room.durationSeconds())}
          </output>
        </div>

        <div class={styles.percussionRailLoop}>
          <GuitarNightLoopControls
            span={loop.span()}
            pending={loop.isPending()}
            hasStart={loop.markA() !== null}
            hasEnd={loop.markB() !== null}
            format={formatBeat}
            onMarkStart={() => markLoopAtPlayhead('A')}
            onMarkEnd={() => markLoopAtPlayhead('B')}
            onClear={clearLoop}
          />
        </div>

        <div
          class={`${styles.transportControls} ${styles.percussionTransportControls}`}
        >
          <button
            class={styles.playControl}
            type="button"
            aria-label={playbackLabel()}
            title={playbackLabel()}
            disabled={room.status() === 'starting'}
            onClick={room.toggle}
          >
            <span aria-hidden="true">{isRunning() ? <Pause /> : <Play />}</span>
          </button>
          <Show when={room.setupLocked()}>
            <button
              class={styles.stopControl}
              type="button"
              aria-label="End the take"
              title="End the take"
              onClick={room.stop}
            >
              <span aria-hidden="true">
                <Square />
              </span>
            </button>
          </Show>
          <div class={styles.playbackSpeed} role="group" aria-label="Tempo">
            <button
              type="button"
              aria-label={`Slow down from ${room.tempoBpm()} BPM`}
              disabled={
                room.setupLocked() || room.tempoBpm() <= SCORE_ROOM_MIN_TEMPO
              }
              onClick={() => room.setTempoBpm(room.tempoBpm() - 4)}
            >
              <span aria-hidden="true">−</span>
            </button>
            <output aria-label={`Tempo ${room.tempoBpm()} BPM`}>
              <strong>{room.tempoBpm()}</strong>
              <small>BPM</small>
            </output>
            <button
              type="button"
              aria-label={`Speed up from ${room.tempoBpm()} BPM`}
              disabled={
                room.setupLocked() || room.tempoBpm() >= SCORE_ROOM_MAX_TEMPO
              }
              onClick={() => room.setTempoBpm(room.tempoBpm() + 4)}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      </div>

      <div class={styles.roomFooter}>
        <div class={styles.roomFooterActions} />
        <p>
          <span aria-hidden="true" />
          <strong role="status" aria-live="polite" aria-atomic="true">
            {room.status() === 'count-in'
              ? `Counting in · ${room.countInRemaining()}`
              : room.status() === 'playing'
                ? 'Drum backing is playing'
                : room.status() === 'paused'
                  ? 'Backing paused'
                  : room.status() === 'complete'
                    ? 'Backing complete'
                    : room.status() === 'starting'
                      ? 'Opening the room clock'
                      : 'Ready for free play'}
          </strong>
          <small>
            {room.status() === 'quiet'
              ? 'Press Play or Space to start the authored drums'
              : `${formatTime(room.displayPositionSeconds())} of ${formatTime(room.durationSeconds())}`}
          </small>
        </p>
      </div>
    </section>
  )
}
