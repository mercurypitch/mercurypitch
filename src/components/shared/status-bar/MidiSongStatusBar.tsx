// ============================================================
// MidiSongStatusBar — the sleek glass strip along the top of the
// Piano / Guitar practice canvases: song picker, seek scrubber,
// compact multi-column track dock, and import actions. Replaces
// the old full-width FallingNotes/GuitarPractice song-picker rows.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { ChevronDownIcon, EyeClosedIcon, EyeOpenIcon, SpeakerMutedIcon, SpeakerOpenIcon, } from '@/components/shared/midi-picker-icons'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import type { MidiSongPicker } from '@/lib/use-midi-song-picker'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import styles from './SongStatusBar.module.css'

interface MidiSongStatusBarProps {
  picker: MidiSongPicker
  /** CSS-prefix + radio-name namespace for the shared modals ('fn' | 'gp'). */
  prefix: string
  dataTour?: string
  currentSong: () => SavedMidiSong | null
  mutedTrackIds: () => Set<string>
  onToggleMute: (trackId: string) => void
  visibleTrackIds: () => Set<string>
  onToggleVisibility: (trackId: string) => void
  playheadBeat: () => number
  totalBeats: () => number
  songBpm: () => number
  onSeek: (beat: number) => void
  /**
   * Loaded song/melody name from the controller (store-backed, so it
   * survives page remounts; the picker's own selection state does not).
   */
  songName: () => string
  /** Dim the bar while the game/playback runs (hover restores it). */
  isPlaying: () => boolean
  /** Extra action chips appended to the right cluster (guitar pills etc.). */
  extraActions?: JSX.Element
  /** Extra status line below the bar content (guitar GP import). */
  extraStatus?: () => string
}

const formatTime = (t: number): string => {
  const mins = Math.floor(t / 60)
  const secs = Math.floor(t % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const MidiSongStatusBar: Component<MidiSongStatusBarProps> = (props) => {
  const [tracksOpen, setTracksOpen] = createSignal(false)

  // A freshly loaded multi-track song opens the dock so the mixer is
  // discoverable; single-track songs keep the bar minimal. Deferred so a
  // page remount with a song already loaded (every tab revisit) doesn't
  // re-open a dock the user collapsed.
  createEffect(
    on(
      () => props.currentSong()?.id,
      (id, prevId) => {
        if (id !== undefined && id !== prevId) {
          setTracksOpen((props.currentSong()?.tracks.length ?? 0) > 1)
        }
        if (id === undefined) setTracksOpen(false)
      },
      { defer: true },
    ),
  )

  const trackCount = () => props.currentSong()?.tracks.length ?? 0

  const handleSeek = (e: MouseEvent) => {
    const rail = e.currentTarget as HTMLDivElement
    const rect = rail.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    props.onSeek(ratio * props.totalBeats())
  }

  const progressPct = () =>
    props.totalBeats() > 0
      ? (Math.max(0, props.playheadBeat()) / props.totalBeats()) * 100
      : 0

  return (
    <>
      <div
        class={styles.bar}
        classList={{ [styles.dimmed]: props.isPlaying() }}
        data-tour={props.dataTour}
        data-testid={`${props.prefix}-song-status-bar`}
      >
        <button
          class={styles.songBtn}
          onClick={() => props.picker.setIsModalOpen(true)}
          title="Choose a song or melody"
        >
          <span class={styles.songName}>
            {props.songName() !== ''
              ? props.songName()
              : props.picker.currentMelodyName()}
          </span>
          <span class={styles.songChevron}>
            <ChevronDownIcon />
          </span>
        </button>

        <Show when={props.totalBeats() > 0}>
          <div class={styles.scrub}>
            <span class={styles.time}>
              {formatTime(
                Math.max(0, props.playheadBeat()) / (props.songBpm() / 60),
              )}
            </span>
            <div
              class={styles.rail}
              onClick={handleSeek}
              title="Seek"
              data-testid={`${props.prefix}-seek-rail`}
            >
              <div class={styles.fill} style={{ width: `${progressPct()}%` }} />
            </div>
            <span class={styles.time}>
              {formatTime(props.totalBeats() / (props.songBpm() / 60))}
            </span>
          </div>
        </Show>

        <div class={styles.actions}>
          <Show when={trackCount() > 0}>
            <button
              class={styles.chipBtn}
              aria-expanded={tracksOpen()}
              onClick={() => setTracksOpen((v) => !v)}
              title="Show or hide the track mixer"
              data-testid={`${props.prefix}-tracks-toggle`}
            >
              Tracks
              <span class={styles.chipCount}>{trackCount()}</span>
            </button>
          </Show>
          <button
            class={styles.chipBtn}
            onClick={() => props.picker.importMidi()}
            title="Import a MIDI file (or drop one on the canvas)"
          >
            Import MIDI
          </button>
          {props.extraActions}
        </div>

        <Show when={tracksOpen() && props.currentSong()}>
          {(song) => (
            <div
              class={styles.trackDock}
              data-testid={`${props.prefix}-track-dock`}
            >
              <For each={song().tracks}>
                {(t) => {
                  const isScored = () => song().scoreTrackId === t.id
                  const isMuted = () => props.mutedTrackIds().has(t.id)
                  const isVisible = () => props.visibleTrackIds().has(t.id)
                  return (
                    <div
                      class={styles.trackRow}
                      classList={{
                        [styles.trackScored]: isScored(),
                        [styles.trackMuted]: isMuted() && !isScored(),
                        [styles.trackHidden]: !isVisible() && !isScored(),
                      }}
                    >
                      <button
                        class={styles.trackName}
                        title={
                          isScored()
                            ? 'Currently playing/scored'
                            : `Set "${t.name}" as scored track`
                        }
                        onClick={() => props.picker.selectScoreTrack(t.id)}
                        disabled={isScored()}
                      >
                        {t.name}
                      </button>
                      <button
                        class={styles.trackIconBtn}
                        classList={{
                          [styles.trackIconOff]: !isVisible() && !isScored(),
                        }}
                        title={
                          isScored()
                            ? 'Scored track is always visible'
                            : isVisible()
                              ? 'Hide track notes'
                              : 'Show track notes'
                        }
                        onClick={() => props.onToggleVisibility(t.id)}
                        disabled={isScored()}
                      >
                        <Show
                          when={isVisible() || isScored()}
                          fallback={<EyeClosedIcon />}
                        >
                          <EyeOpenIcon />
                        </Show>
                      </button>
                      <button
                        class={styles.trackIconBtn}
                        classList={{
                          [styles.trackIconOff]: isMuted() && !isScored(),
                        }}
                        title={
                          isScored()
                            ? 'Scored track audio cannot be muted'
                            : isMuted()
                              ? 'Unmute track audio'
                              : 'Mute track audio'
                        }
                        onClick={() => props.onToggleMute(t.id)}
                        disabled={isScored()}
                      >
                        <Show
                          when={isMuted() && !isScored()}
                          fallback={<SpeakerOpenIcon />}
                        >
                          <SpeakerMutedIcon />
                        </Show>
                      </button>
                    </div>
                  )
                }}
              </For>
            </div>
          )}
        </Show>

        <Show when={props.picker.importStatus() !== ''}>
          <div class={styles.statusLine}>{props.picker.importStatus()}</div>
        </Show>
        <Show when={(props.extraStatus?.() ?? '') !== ''}>
          <div class={styles.statusLine}>{props.extraStatus?.()}</div>
        </Show>
      </div>

      <Show when={props.picker.isModalOpen()}>
        <MidiSongSelectModal
          prefix={props.prefix}
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
            prefix={props.prefix}
            radioName={`${props.prefix}-score-track`}
            pendingScoreId={props.picker.pendingScoreId}
            setPendingScoreId={props.picker.setPendingScoreId}
            pendingBackingIds={props.picker.pendingBackingIds}
            setPendingBackingIds={props.picker.setPendingBackingIds}
            onApply={props.picker.applyTrackSelection}
            onClose={() => props.picker.setTrackModalSong(null)}
          />
        )}
      </Show>
    </>
  )
}
