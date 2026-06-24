// ============================================================
// FallingNotesSongPicker — song picker for Synthesia-style piano practice
// Thin shell over the shared useMidiSongPicker hook + shared picker UI.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronDownIcon } from '@/components/shared/midi-picker-icons'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackMixer } from '@/components/shared/MidiTrackMixer'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import type { MidiSongNote } from '@/lib/midi-song'
import { midiToNoteName } from '@/lib/note-utils'
import { midiToFreq } from '@/lib/scale-data'
import { useMidiSongPicker } from '@/lib/use-midi-song-picker'
import type { FallingNote } from '@/stores/falling-notes-store'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { savedMidiSongs } from '@/stores/saved-midi-songs-store'
import type { MelodyItem } from '@/types'

export interface FallingNotesSongPickerProps {
  onSongLoaded: (
    notes: FallingNote[],
    name: string,
    bpm: number,
    backingItems?: FallingNote[],
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

function melodyToFallingNotes(items: MelodyItem[]): FallingNote[] {
  return items.map((item, i) => ({
    id: item.id ?? i,
    midi: item.note.midi,
    name: item.note.name,
    startBeat: item.startBeat,
    duration: item.duration,
    targetFreq: item.note.freq,
  }))
}

function midiNotesToFallingNotes(notes: MidiSongNote[]): FallingNote[] {
  return notes.map((n, i) => ({
    id: i,
    midi: n.midi,
    name: midiToNoteName(n.midi),
    startBeat: n.startBeat,
    duration: n.duration,
    targetFreq: midiToFreq(n.midi),
  }))
}

export const FallingNotesSongPicker: Component<FallingNotesSongPickerProps> = (
  props,
) => {
  const picker = useMidiSongPicker<FallingNote>({
    currentSong: () => props.currentSong(),
    fromMelodyItems: melodyToFallingNotes,
    fromScoreNotes: midiNotesToFallingNotes,
    fromBackingNotes: (notes, trackId) =>
      midiNotesToFallingNotes(notes).map((n) => ({ ...n, trackId })),
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
    <div id="falling-notes-song-picker">
      <div class="fn-picker-row">
        <button
          class="fn-song-select-btn"
          onClick={() => picker.setIsModalOpen(true)}
        >
          <span class="fn-song-name">{picker.currentMelodyName()}</span>
          <span class="fn-song-arrow">
            <ChevronDownIcon />
          </span>
        </button>

        <button class="fn-btn fn-btn-import" onClick={picker.importMidi}>
          Import MIDI
        </button>
      </div>

      {picker.importStatus() && (
        <div class="fn-import-status">{picker.importStatus()}</div>
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
              <div class="fn-progress-area">
                <span class="fn-time">
                  {formatTime(
                    Math.max(0, props.playheadBeat()) / (props.songBpm() / 60),
                  )}
                </span>
                <div class="fn-progress-bar" onClick={handleProgressClick}>
                  <div
                    class="fn-progress-fill"
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
                <span class="fn-time">
                  {formatTime(props.totalBeats() / (props.songBpm() / 60))}
                </span>
              </div>
            </Show>
          </>
        )}
      </Show>

      <Show when={picker.isModalOpen()}>
        <MidiSongSelectModal
          prefix="fn"
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
            prefix="fn"
            radioName="fn-score-track"
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
