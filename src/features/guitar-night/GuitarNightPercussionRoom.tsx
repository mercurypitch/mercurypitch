// Guitar Night's backing-only room plays authored drums without inventing guitar score authority.
// ============================================================

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, } from 'solid-js'
import { ChevronLeft, Metronome, Pause, Play, Square } from '@/components/icons'
import type { GuitarRoomBandPercussionHit } from '@/features/guitar/backing/guitar-room-band'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { installSpacePlaybackToggle } from '@/lib/space-playback'
import styles from './GuitarNightApp.module.css'
import { GuitarNightSessionPanel } from './GuitarNightSessionPanel'
import { GuitarNightStage } from './GuitarNightStage'
import type { GuitarNightReference } from './reference-port'
import type { SheetLane } from './sheet/sheet-model'
import { SCORE_ROOM_MAX_TEMPO, SCORE_ROOM_MIN_TEMPO, useGuitarNightScoreRoomController, } from './useGuitarNightScoreRoomController'

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
  onToggleBackingTrack(trackId: string): void
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

export function GuitarNightPercussionRoom(
  props: GuitarNightPercussionRoomProps,
) {
  let roomHeading!: HTMLHeadingElement
  const [sessionPanelOpen, setSessionPanelOpen] = createSignal(false)
  const room = useGuitarNightScoreRoomController({
    reference: () => props.reference(),
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

  const leaveRoom = (): void => {
    room.stop()
    props.onSongs()
  }

  createEffect(() => {
    if (props.suspended?.() === true) room.pause()
  })

  onMount(() => {
    roomHeading.focus({ preventScroll: true })
    onCleanup(
      installSpacePlaybackToggle({
        toggle: room.toggle,
        ownsSpace: () => props.suspended?.() !== true,
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
            data-testid="guitar-night-session-trigger"
            onClick={() => setSessionPanelOpen(true)}
          >
            <p class={styles.eyebrow}>Backing-only rehearsal · free play</p>
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
          onToggleTrackAudible={(trackId) => {
            const audible = props.audibleBackingTrackIds().includes(trackId)
            if (room.setupLocked() && !room.percussionBackingLive()) return
            room.setPercussionTrackAudible(trackId, !audible)
            props.onToggleBackingTrack(trackId)
          }}
          takeActive={room.setupLocked}
          percussionControlsLive={room.percussionBackingLive}
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

      <div class={styles.transportDeck} data-testid="guitar-night-score-deck">
        <div class={styles.transportIdentity}>
          <span>Authored drum clock · no guitar score or neck grading</span>
        </div>
        <div class={styles.timeRail}>
          <output aria-label="Elapsed backing time">
            {formatTime(room.displayPositionSeconds())}
          </output>
          <input
            type="range"
            min="0"
            max={room.durationSeconds() > 0 ? room.durationSeconds() : 1}
            step={Math.max(0.05, 15 / room.tempoBpm())}
            value={room.displayPositionSeconds()}
            aria-label="Backing position"
            aria-valuetext={`${formatTime(room.displayPositionSeconds())} of ${formatTime(room.durationSeconds())}`}
            onInput={(event) =>
              room.seekSeconds(Number(event.currentTarget.value))
            }
          />
          <output aria-label="Backing duration">
            {formatTime(room.durationSeconds())}
          </output>
        </div>

        <div class={styles.transportControls}>
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
