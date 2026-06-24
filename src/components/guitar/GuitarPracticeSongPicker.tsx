// ============================================================
// GuitarPracticeSongPicker — melody picker for guitar practice
// Thin shell over the shared useMidiSongPicker hook + shared picker UI.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronDownIcon } from '@/components/shared/midi-picker-icons'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackMixer } from '@/components/shared/MidiTrackMixer'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import { useMidiSongPicker } from '@/lib/use-midi-song-picker'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import type { MelodyItem } from '@/types'

export interface GuitarSongLoadData {
  midi: number
  noteName?: string
  startBeat: number
  duration: number
  targetFreq?: number
  trackId?: string
}

interface GuitarPracticeSongPickerProps {
  onSongLoaded: (
    items: GuitarSongLoadData[],
    name: string,
    bpm: number,
    backingItems?: GuitarSongLoadData[],
    mutedIds?: string[],
    songObj?: SavedMidiSong | null,
  ) => void
  currentSong: () => SavedMidiSong | null
  mutedTrackIds: () => Set<string>
  onToggleMute: (trackId: string) => void
  visibleTrackIds: () => Set<string>
  onToggleVisibility: (trackId: string) => void
  playheadBeat: () => number
  totalBeats: () => number
  songBpm: () => number
  onSeek: (beat: number) => void
}

function melodyToGuitarItems(items: MelodyItem[]): GuitarSongLoadData[] {
  return items.map((item) => ({
    midi: item.note.midi,
    noteName: item.note.name,
    startBeat: item.startBeat,
    duration: item.duration,
    targetFreq: item.note.freq,
  }))
}

export const GuitarPracticeSongPicker: Component<
  GuitarPracticeSongPickerProps
> = (props) => {
  const picker = useMidiSongPicker<GuitarSongLoadData>({
    currentSong: () => props.currentSong(),
    fromMelodyItems: melodyToGuitarItems,
    fromScoreNotes: (notes) => notes,
    fromBackingNotes: (notes, trackId) => notes.map((n) => ({ ...n, trackId })),
    onSongLoaded: (items, name, bpm, backing, muted, song) =>
      props.onSongLoaded(items, name, bpm, backing, muted, song),
  })

  const formatTime = (t: number): string => {
    const mins = Math.floor(t / 60)
    const secs = Math.floor(t % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressClick = (e: MouseEvent) => {
    const bar = e.currentTarget as HTMLDivElement
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    props.onSeek(ratio * props.totalBeats())
  }

  return (
    <div id="guitar-song-picker">
      <div class="gp-picker-row">
        <button
          class="gp-song-select-btn"
          onClick={() => picker.setIsModalOpen(true)}
        >
          <span class="gp-song-name">{picker.currentMelodyName()}</span>
          <span class="gp-song-arrow">
            <ChevronDownIcon />
          </span>
        </button>

        <button class="gp-btn" onClick={picker.importMidi}>
          Import MIDI
        </button>
      </div>

      {picker.importStatus() && (
        <div class="gp-import-status">{picker.importStatus()}</div>
      )}

      <Show when={props.currentSong()}>
        {(song) => (
          <>
            <MidiTrackMixer
              song={song}
              mutedTrackIds={props.mutedTrackIds}
              visibleTrackIds={props.visibleTrackIds}
              onSelectScore={picker.selectScoreTrack}
              onToggleMute={props.onToggleMute}
              onToggleVisibility={props.onToggleVisibility}
            />
            <Show when={props.totalBeats() > 0}>
              <div class="gp-progress-area">
                <span class="gp-time">
                  {formatTime(
                    Math.max(0, props.playheadBeat()) / (props.songBpm() / 60),
                  )}
                </span>
                <div class="gp-progress-bar" onClick={handleProgressClick}>
                  <div
                    class="gp-progress-fill"
                    style={{
                      width: `${
                        props.totalBeats() > 0
                          ? (Math.max(0, props.playheadBeat()) /
                              props.totalBeats()) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span class="gp-time">
                  {formatTime(props.totalBeats() / (props.songBpm() / 60))}
                </span>
              </div>
            </Show>
          </>
        )}
      </Show>

      <Show when={picker.isModalOpen()}>
        <MidiSongSelectModal
          prefix="gp"
          melodies={picker.melodies}
          savedSongs={savedMidiSongs}
          selectedId={picker.selectedId}
          onClose={() => picker.setIsModalOpen(false)}
          onPickMelody={(id) => {
            picker.setSelectedId(id)
            picker.loadMelody(id)
            picker.setIsModalOpen(false)
          }}
          onPickSaved={(s) => {
            picker.loadSavedSong(s)
            picker.setIsModalOpen(false)
          }}
          onOpenTracks={(s) => picker.openTrackModal(s)}
          onDeleteSaved={(id) => picker.deleteSong(id)}
        />
      </Show>

      <Show when={picker.trackModalSong()}>
        {(song) => (
          <MidiTrackPickerModal
            song={song}
            prefix="gp"
            radioName="gp-score-track"
            pendingScoreId={picker.pendingScoreId}
            setPendingScoreId={picker.setPendingScoreId}
            pendingBackingIds={picker.pendingBackingIds}
            setPendingBackingIds={picker.setPendingBackingIds}
            onApply={picker.applyTrackSelection}
            onClose={() => picker.setTrackModalSong(null)}
          />
        )}
      </Show>
    </div>
  )
}
