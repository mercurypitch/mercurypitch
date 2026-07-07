// ============================================================
// SingingStatusBar — the singing page's slim glass strip above
// the canvas: scale + melody + tempo + bar.beat on the left, the
// live session/playback state in the middle (absorbing the old
// green SessionPlayer banner: elapsed time, session item
// progress, skip/end), and song actions on the right (browse
// library/imported songs, pick the scored MIDI track, import).
// Shares the visual language (and stylesheet) of the Piano and
// Guitar song status bars.
// ============================================================

import type { Accessor, Component } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import barStyles from '@/components/shared/status-bar/SongStatusBar.module.css'
import { loopRegionPct } from '@/lib/ab-loop'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import { getCurrentSessionItem, practiceSession, sessionActive, sessionItemIndex, sessionMode, } from '@/stores'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'

interface SingingStatusBarProps {
  keyName: () => string
  scaleType: () => string
  melodyName: () => string | null
  bpm: () => number
  currentBeat: () => number
  /** Live singing-playback signal (the controller's, not the dead store one). */
  isPlaying: () => boolean
  /** Song/melody picker (library melodies + imported MIDI songs). */
  picker: MidiSongPicker
  /** The imported MIDI song the current melody was extracted from, if any. */
  currentSong: () => SavedMidiSong | null
  /** Playback position/length in beats, for the seek scrubber. */
  playheadBeat: () => number
  totalBeats: () => number
  onSeek: (beat: number) => void
  onSessionSkip: () => void
  onSessionEnd: () => void
  // A-B Loop region (0 = not set)
  loopA: Accessor<number>
  loopB: Accessor<number>
  loopEnabled: Accessor<boolean>
  /** Drag the A / B markers along the seek rail (in beats). */
  onMoveLoopA?: (beat: number) => void
  onMoveLoopB?: (beat: number) => void
}

const titleCase = (s: string): string =>
  s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// 0-based float beat → 1-based "bar.beat" (4/4), like Guitar 3D's Tab3DHud.
const barBeat = (b: number): string => {
  const beat = Math.max(0, b)
  return `${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`
}

const formatTime = (t: number): string => {
  const mins = Math.floor(t / 60)
  const secs = Math.floor(t % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatElapsed = (s: number): string => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <path
      fill="currentColor"
      d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
    />
  </svg>
)

export const SingingStatusBar: Component<SingingStatusBarProps> = (props) => {
  const scaleLabel = () => `${props.keyName()} ${titleCase(props.scaleType())}`
  const session = () => practiceSession()
  const isSequence = () => sessionMode()
  const currentItem = () => getCurrentSessionItem()
  const trackCount = () => props.currentSong()?.tracks.length ?? 0

  // Set for one tick after a marker drag so the click synthesized by the
  // drag's pointer-up doesn't also seek the rail.
  let suppressSeek = false

  const handleSeek = (e: MouseEvent) => {
    if (suppressSeek) {
      suppressSeek = false
      return
    }
    const rail = e.currentTarget as HTMLDivElement
    const rect = rail.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    props.onSeek(ratio * props.totalBeats())
  }

  const progressPct = () =>
    props.totalBeats() > 0
      ? (Math.max(0, props.playheadBeat()) / props.totalBeats()) * 100
      : 0

  // Reactive loop-region geometry — recomputes whenever A, B or the timeline
  // length changes (the old inline IIFE captured them once, leaving the
  // overlay stale when a point moved).
  const region = () =>
    loopRegionPct(props.loopA(), props.loopB(), props.totalBeats())

  // ── Draggable A/B loop markers on the seek rail ──────────────
  let railEl: HTMLDivElement | undefined
  const [dragTarget, setDragTarget] = createSignal<'A' | 'B' | null>(null)

  const pctOf = (beat: number): number =>
    props.totalBeats() > 0 ? (beat / props.totalBeats()) * 100 : 0

  const beatFromClientX = (clientX: number): number => {
    if (!railEl) return 0
    const rect = railEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * props.totalBeats()
  }

  const startMarkerDrag = (which: 'A' | 'B') => (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation() // don't let the rail read this as a seek-click
    setDragTarget(which)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMarkerDrag = (e: PointerEvent) => {
    const which = dragTarget()
    if (which === null) return
    e.preventDefault()
    const beat = beatFromClientX(e.clientX)
    if (which === 'A') props.onMoveLoopA?.(beat)
    else props.onMoveLoopB?.(beat)
  }
  const endMarkerDrag = (e: PointerEvent) => {
    if (dragTarget() === null) return
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture?.(e.pointerId))
      el.releasePointerCapture(e.pointerId)
    setDragTarget(null)
    // Swallow the click the browser fires right after this pointer-up so the
    // rail's seek handler ignores it; clear the flag on the next macrotask.
    suppressSeek = true
    setTimeout(() => {
      suppressSeek = false
    }, 0)
  }

  // Wall-clock elapsed while a session/playback run is live (the old
  // SessionPlayer banner's timer, folded into the bar).
  const [elapsed, setElapsed] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | undefined
  createEffect(
    on(sessionActive, (active) => {
      if (timer !== undefined) clearInterval(timer)
      timer = undefined
      setElapsed(0)
      if (active) {
        const startTime = Date.now()
        timer = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startTime) / 1000))
        }, 1000)
      }
    }),
  )
  onCleanup(() => {
    if (timer !== undefined) clearInterval(timer)
  })

  return (
    <>
      <div
        class={barStyles.bar}
        classList={{
          [barStyles.dimmed]: props.isPlaying() && !sessionActive(),
        }}
        data-testid="singing-status-bar"
      >
        <div class={barStyles.info} title={scaleLabel()}>
          <span>{scaleLabel()}</span>
          <Show when={props.melodyName()}>
            {(name) => (
              <>
                <span class={barStyles.infoDot}>·</span>
                <span class={barStyles.infoSecondary} title={name()}>
                  {name()}
                </span>
              </>
            )}
          </Show>
        </div>
        <div class={barStyles.infoMeta}>
          <span>{props.bpm()} BPM</span>
          <span class={barStyles.infoDot}>·</span>
          <span class={barStyles.infoPos}>{barBeat(props.currentBeat())}</span>
        </div>

        {/* Song timeline — click to jump (works stopped, playing or paused). */}
        <Show when={props.totalBeats() > 0}>
          <div class={barStyles.scrub}>
            <span class={barStyles.time}>
              {formatTime(
                Math.max(0, props.playheadBeat()) / (props.bpm() / 60),
              )}
            </span>
            <div
              ref={railEl}
              class={barStyles.rail}
              onClick={handleSeek}
              title="Seek"
              data-testid="singing-seek-rail"
            >
              <div
                class={barStyles.fill}
                style={{ width: `${progressPct()}%` }}
              />
              <Show when={region()}>
                {(r) => (
                  <div
                    class={barStyles.loopRegion}
                    classList={{
                      [barStyles.loopRegionActive]: props.loopEnabled(),
                    }}
                    style={{
                      left: `${r().left}%`,
                      width: `${r().width}%`,
                    }}
                    data-testid="loop-region"
                  />
                )}
              </Show>
              {/* Draggable A / B markers — the "start point render" on A, and a
                  movable end on B (mirrors the stem-mixer waveform markers). */}
              <Show when={props.loopA() > 0}>
                <div
                  class={`${barStyles.loopMarker} ${barStyles.loopMarkerA}`}
                  classList={{
                    [barStyles.loopMarkerDragging]: dragTarget() === 'A',
                  }}
                  style={{ left: `${pctOf(props.loopA())}%` }}
                  title="Drag to move loop start (A)"
                  data-testid="loop-marker-a"
                  onPointerDown={startMarkerDrag('A')}
                  onPointerMove={onMarkerDrag}
                  onPointerUp={endMarkerDrag}
                  onPointerCancel={endMarkerDrag}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span class={barStyles.loopMarkerFlag}>A</span>
                </div>
              </Show>
              <Show when={props.loopB() > 0}>
                <div
                  class={`${barStyles.loopMarker} ${barStyles.loopMarkerB}`}
                  classList={{
                    [barStyles.loopMarkerDragging]: dragTarget() === 'B',
                  }}
                  style={{ left: `${pctOf(props.loopB())}%` }}
                  title="Drag to move loop end (B)"
                  data-testid="loop-marker-b"
                  onPointerDown={startMarkerDrag('B')}
                  onPointerMove={onMarkerDrag}
                  onPointerUp={endMarkerDrag}
                  onPointerCancel={endMarkerDrag}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span class={barStyles.loopMarkerFlag}>B</span>
                </div>
              </Show>
            </div>
            <span class={barStyles.time}>
              {formatTime(props.totalBeats() / (props.bpm() / 60))}
            </span>
          </div>
        </Show>

        {/* Live session / playback cluster (the old green banner). */}
        <Show when={sessionActive()}>
          <div class={barStyles.sessionCluster} data-testid="session-player">
            <span
              class={barStyles.sessionTitle}
              data-testid="session-player-title"
            >
              <ClockIcon />
              {isSequence()
                ? (session()?.name ?? 'Session')
                : (props.melodyName() ?? 'Melody')}
            </span>
            <Show when={isSequence() && session()}>
              <span
                class={barStyles.sessionMeta}
                data-testid="session-player-progress"
              >
                Item {sessionItemIndex() + 1} of {session()!.items.length}
              </span>
            </Show>
            <Show when={isSequence()}>
              <span
                class={barStyles.sessionItem}
                classList={{
                  [barStyles.sessionItemRest]: currentItem()?.type === 'rest',
                }}
                data-testid="session-player-item"
              >
                {currentItem()?.type === 'rest'
                  ? `Rest — ${currentItem()?.label ?? 'pause'}`
                  : (currentItem()?.label ?? 'Loading...')}
              </span>
            </Show>
            <span
              class={barStyles.sessionElapsed}
              data-testid="session-elapsed"
            >
              {formatElapsed(elapsed())}
            </span>
            <Show when={isSequence()}>
              <button
                class={barStyles.chipBtn}
                data-testid="session-skip-btn"
                onClick={() => props.onSessionSkip()}
                title="Skip this item"
              >
                Skip
              </button>
              <button
                class={barStyles.chipBtn}
                data-testid="session-end-btn"
                onClick={() => props.onSessionEnd()}
                title="End the session"
              >
                End
              </button>
            </Show>
          </div>
        </Show>

        <div class={barStyles.actions}>
          <button
            class={barStyles.chipBtn}
            onClick={() => props.picker.setIsModalOpen(true)}
            title="Browse library melodies and imported MIDI songs"
            data-testid="singing-songs-btn"
          >
            Songs
          </button>
          <Show when={trackCount() > 1}>
            <button
              class={barStyles.chipBtn}
              onClick={() => {
                const song = props.currentSong()
                if (song) props.picker.openTrackModal(song)
              }}
              title="Choose which MIDI track to sing against"
              data-testid="singing-tracks-btn"
            >
              Track
              <span class={barStyles.chipCount}>{trackCount()}</span>
            </button>
          </Show>
          <button
            class={barStyles.chipBtn}
            onClick={() => props.picker.importMidi()}
            title="Import a MIDI file (or drop one on the canvas)"
          >
            Import MIDI
          </button>
        </div>

        <Show when={props.picker.importStatus() !== ''}>
          <div class={barStyles.statusLine}>{props.picker.importStatus()}</div>
        </Show>
      </div>

      <Show when={props.picker.isModalOpen()}>
        <MidiSongSelectModal
          prefix="fn"
          melodies={props.picker.melodies}
          savedSongs={savedMidiSongs}
          selectedId={props.picker.selectedId}
          onClose={() => props.picker.setIsModalOpen(false)}
          onPickMelody={(id) => {
            props.picker.setSelectedId(id)
            props.picker.loadMelody(id)
            props.picker.setIsModalOpen(false)
          }}
          onPickSaved={(s) => {
            props.picker.loadSavedSong(s)
            props.picker.setIsModalOpen(false)
          }}
          onOpenTracks={(s) => props.picker.openTrackModal(s)}
          onDeleteSaved={(id) => props.picker.deleteSong(id)}
        />
      </Show>

      <Show when={props.picker.trackModalSong()}>
        {(song) => (
          <MidiTrackPickerModal
            song={song}
            prefix="fn"
            radioName="singing-score-track"
            pendingScoreId={props.picker.pendingScoreId}
            setPendingScoreId={props.picker.setPendingScoreId}
            pendingBackingIds={props.picker.pendingBackingIds}
            setPendingBackingIds={props.picker.setPendingBackingIds}
            onApply={props.picker.applyTrackSelection}
            onClose={() => props.picker.setTrackModalSong(null)}
            scoreHint="the track you sing against"
          />
        )}
      </Show>
    </>
  )
}
