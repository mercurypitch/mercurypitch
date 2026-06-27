// ============================================================
// GuitarPracticeSongPicker — melody picker for guitar practice
// Thin shell over the shared useMidiSongPicker hook + shared picker UI.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { ChevronDownIcon } from '@/components/shared/midi-picker-icons'
import { MidiSongSelectModal } from '@/components/shared/MidiSongSelectModal'
import { MidiTrackMixer } from '@/components/shared/MidiTrackMixer'
import { MidiTrackPickerModal } from '@/components/shared/MidiTrackPickerModal'
import { defaultScoreTrack } from '@/lib/midi-song'
import { GP_FILE_EXTENSIONS, parseGuitarProFile } from '@/lib/tab/gp-import'
import { useMidiSongPicker } from '@/lib/use-midi-song-picker'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { savedMidiSongs, saveMidiSong } from '@/stores/saved-midi-songs-store'
import type { MelodyItem } from '@/types'

export interface GuitarSongLoadData {
  midi: number
  noteName?: string
  startBeat: number
  duration: number
  targetFreq?: number
  trackId?: string
  /** Original tab fingering (Guitar Pro imports), preserved through load. */
  stringIndex?: number
  fret?: number
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

  const [gpStatus, setGpStatus] = createSignal('')
  let gpFileInput: HTMLInputElement | undefined

  const handleGpFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file === undefined) return
    setGpStatus(`Loading ${file.name}…`)
    try {
      const { song, name } = await parseGuitarProFile(file)
      const score = defaultScoreTrack(song)
      const backing = song.tracks
        .filter((t) => t.id !== score.id)
        .map((t) => t.id)
      const saved = saveMidiSong(name, song, score.id, backing)
      picker.loadSavedSong(saved)
      const count = song.tracks.length
      setGpStatus(`Loaded ${name} (${count} track${count === 1 ? '' : 's'})`)
    } catch (err) {
      setGpStatus(err instanceof Error ? err.message : 'Failed to load tab')
    }
  }

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

        <button class="gp-btn" onClick={() => gpFileInput?.click()}>
          Import Guitar Pro
        </button>
        <input
          ref={gpFileInput}
          type="file"
          accept={GP_FILE_EXTENSIONS}
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleGpFile(e)
          }}
        />
      </div>

      {picker.importStatus() && (
        <div class="gp-import-status">{picker.importStatus()}</div>
      )}

      {gpStatus() !== '' && <div class="gp-import-status">{gpStatus()}</div>}

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
