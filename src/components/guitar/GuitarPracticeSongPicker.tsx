// ============================================================
// GuitarPracticeSongPicker — melody picker for guitar practice
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import type { MidiSongTrack } from '@/lib/midi-song'
import { defaultScoreTrack, parseMidiSong } from '@/lib/midi-song'
import { getAllMelodies } from '@/stores/melody-store'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import { deleteMidiSong, savedMidiSongs, saveMidiSong, updateMidiSongSelection, } from '@/stores/saved-midi-songs-store'
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

const ChevronDownIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <path d="M5 7L1 3h8L5 7z" />
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M14 1.4L12.6 0 7 5.6 1.4 0 0 1.4 5.6 7 0 12.6 1.4 14 7 8.4l5.6 5.6 1.4-1.4L8.4 7z" />
  </svg>
)

const EyeOpenIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeClosedIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const SpeakerOpenIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
)

const SpeakerMutedIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
)

export const GuitarPracticeSongPicker: Component<
  GuitarPracticeSongPickerProps
> = (props) => {
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [importStatus, setImportStatus] = createSignal<string>('')
  const [isModalOpen, setIsModalOpen] = createSignal(false)
  // Track-selector modal state
  const [trackModalSong, setTrackModalSong] =
    createSignal<SavedMidiSong | null>(null)
  const [pendingScoreId, setPendingScoreId] = createSignal('')
  const [pendingBackingIds, setPendingBackingIds] = createSignal<Set<string>>(
    new Set(),
  )

  const formatTime = (t: number): string => {
    const mins = Math.floor(t / 60)
    const secs = Math.floor(t % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressClick = (e: MouseEvent) => {
    const bar = e.currentTarget as HTMLDivElement
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const targetBeat = ratio * props.totalBeats()
    props.onSeek(targetBeat)
  }

  const melodies = createMemo(() => {
    try {
      return getAllMelodies().filter((m) => m.items.length > 0)
    } catch {
      return []
    }
  })

  const currentMelodyName = createMemo(() => {
    const id = selectedId()
    if (id === null || id === '') return 'Select a song...'
    const m = melodies().find((x) => x.id === id)
    if (m) return m.name
    const s = savedMidiSongs().find((x) => x.id === id)
    return s ? s.name : 'Select a song...'
  })

  const loadMelody = (id: string) => {
    const melody = melodies().find((m) => m.id === id)
    if (!melody) return
    const items = melodyToGuitarItems(melody.items)
    props.onSongLoaded(items, melody.name, melody.bpm, [], [], null)
  }

  const loadSavedSong = (song: SavedMidiSong) => {
    const scoreTrack =
      song.tracks.find((t) => t.id === song.scoreTrackId) ?? song.tracks[0]
    const backing: GuitarSongLoadData[] = []
    for (const t of song.tracks) {
      if (t.id === scoreTrack.id) continue
      backing.push(...t.notes.map((n) => ({ ...n, trackId: t.id })))
    }
    const mutedIds = song.tracks
      .filter(
        (t) => t.id !== scoreTrack.id && !song.backingTrackIds.includes(t.id),
      )
      .map((t) => t.id)
    setSelectedId(song.id)
    props.onSongLoaded(
      scoreTrack.notes,
      song.name,
      song.bpm,
      backing,
      mutedIds,
      song,
    )
    setImportStatus(
      `Loaded: ${song.name} — scoring "${scoreTrack.name}" (${scoreTrack.noteCount} notes)${
        backing.length > 0 ? ` + ${backing.length} backing notes` : ''
      }`,
    )
  }

  const openTrackModal = (song: SavedMidiSong) => {
    setPendingScoreId(song.scoreTrackId)
    setPendingBackingIds(new Set(song.backingTrackIds))
    setTrackModalSong(song)
  }

  const applyTrackSelection = () => {
    const song = trackModalSong()
    if (!song) return
    const scoreId = pendingScoreId()
    const backingIds = [...pendingBackingIds()].filter((id) => id !== scoreId)
    updateMidiSongSelection(song.id, scoreId, backingIds)
    const updated: SavedMidiSong = {
      ...song,
      scoreTrackId: scoreId,
      backingTrackIds: backingIds,
    }
    setTrackModalSong(null)
    setIsModalOpen(false)
    loadSavedSong(updated)
  }

  const handleSelectScoreTrack = (trackId: string) => {
    const song = props.currentSong()
    if (!song || song.scoreTrackId === trackId) return

    const oldScoreId = song.scoreTrackId
    const newBacking = new Set(song.backingTrackIds)
    newBacking.add(oldScoreId)
    newBacking.delete(trackId)

    const backingTrackIds = [...newBacking]
    updateMidiSongSelection(song.id, trackId, backingTrackIds)

    const updated: SavedMidiSong = {
      ...song,
      scoreTrackId: trackId,
      backingTrackIds,
    }
    loadSavedSong(updated)
  }

  onMount(() => {
    const list = melodies()
    if (list.length > 0) {
      setSelectedId(list[0].id)
      loadMelody(list[0].id)
    }
  })

  const handleMidiImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mid,.midi'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        setImportStatus('Parsing...')
        const buffer = await file.arrayBuffer()
        const data = new Uint8Array(buffer)
        const song = parseMidiSong(data)

        if (!song) {
          setImportStatus('No notes found in MIDI file')
          return
        }

        const name = file.name.replace(/\.(mid|midi)$/i, '')
        const score = defaultScoreTrack(song)
        const backingIds = song.tracks
          .filter((t) => t.id !== score.id)
          .map((t) => t.id)
        const saved = saveMidiSong(name, song, score.id, backingIds)

        if (song.tracks.length > 1) {
          // Let the user pick which track to practice before loading
          openTrackModal(saved)
        } else {
          loadSavedSong(saved)
        }
      } catch (err) {
        setImportStatus(`Import failed: ${String(err)}`)
      }
    }
    input.click()
  }

  return (
    <div id="guitar-song-picker">
      <div class="gp-picker-row">
        <button class="gp-song-select-btn" onClick={() => setIsModalOpen(true)}>
          <span class="gp-song-name">{currentMelodyName()}</span>
          <span class="gp-song-arrow">
            <ChevronDownIcon />
          </span>
        </button>

        <button class="gp-btn" onClick={handleMidiImport}>
          Import MIDI
        </button>
      </div>

      {importStatus() && <div class="gp-import-status">{importStatus()}</div>}

      <Show when={props.currentSong()}>
        {(song) => (
          <>
            <div class="gp-inline-mixer">
              <span class="gp-mixer-title">Tracks:</span>
              <For each={song().tracks}>
                {(t) => {
                  const isScored = () => song().scoreTrackId === t.id
                  const isMuted = () => props.mutedTrackIds().has(t.id)
                  const isVisible = () => props.visibleTrackIds().has(t.id)
                  return (
                    <div
                      class="gp-track-chip"
                      classList={{
                        'gp-track-chip-scored': isScored(),
                        'gp-track-chip-muted': isMuted() && !isScored(),
                        'gp-track-chip-invisible': !isVisible() && !isScored(),
                      }}
                    >
                      <button
                        class="gp-track-chip-name"
                        title={
                          isScored()
                            ? 'Currently playing/scored'
                            : `Set "${t.name}" as scored track`
                        }
                        onClick={() => handleSelectScoreTrack(t.id)}
                        disabled={isScored()}
                      >
                        {t.name}
                      </button>
                      {/* Eye toggle (Visibility) */}
                      <button
                        class="gp-track-chip-eye"
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
                      {/* Speaker toggle (Audio Mute/Hear) */}
                      <button
                        class="gp-track-chip-speaker"
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

      <Show when={isModalOpen()}>
        <div class="gp-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div class="gp-modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="gp-modal-header">
              <h3>Select a Song</h3>
              <button
                class="gp-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div class="gp-modal-list">
              <Show when={savedMidiSongs().length > 0}>
                <div class="gp-modal-section">Imported MIDI</div>
                <For each={savedMidiSongs()}>
                  {(s) => (
                    <div
                      class="gp-modal-item gp-modal-item-row"
                      classList={{ 'gp-modal-active': selectedId() === s.id }}
                    >
                      <button
                        class="gp-modal-item-main"
                        onClick={() => {
                          loadSavedSong(s)
                          setIsModalOpen(false)
                        }}
                      >
                        <div class="gp-item-name">{s.name}</div>
                        <div class="gp-item-meta">
                          {s.tracks.length}{' '}
                          {s.tracks.length === 1 ? 'track' : 'tracks'} &middot;{' '}
                          {s.tracks.reduce((n, t) => n + t.noteCount, 0)} notes
                          &middot; {s.bpm} BPM
                        </div>
                      </button>
                      <Show when={s.tracks.length > 1}>
                        <button
                          class="gp-btn gp-track-btn"
                          title="Choose tracks to score / hear"
                          onClick={() => openTrackModal(s)}
                        >
                          Tracks
                        </button>
                      </Show>
                      <button
                        class="gp-modal-close gp-song-delete"
                        title="Remove imported song"
                        onClick={() => {
                          deleteMidiSong(s.id)
                          if (selectedId() === s.id) setSelectedId(null)
                        }}
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  )}
                </For>
                <div class="gp-modal-section">Library</div>
              </Show>
              <For each={melodies()}>
                {(m) => (
                  <button
                    class="gp-modal-item"
                    classList={{ 'gp-modal-active': selectedId() === m.id }}
                    onClick={() => {
                      setSelectedId(m.id)
                      loadMelody(m.id)
                      setIsModalOpen(false)
                    }}
                  >
                    <div class="gp-item-name">{m.name}</div>
                    <div class="gp-item-meta">
                      {m.items.length} notes &middot; {m.bpm} BPM &middot;{' '}
                      {m.key}
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      <Show when={trackModalSong()}>
        {(song) => (
          <div class="gp-modal-overlay" onClick={() => setTrackModalSong(null)}>
            <div class="gp-modal-content" onClick={(e) => e.stopPropagation()}>
              <div class="gp-modal-header">
                <h3>Choose Tracks — {song().name}</h3>
                <button
                  class="gp-modal-close"
                  onClick={() => setTrackModalSong(null)}
                >
                  <CloseIcon />
                </button>
              </div>
              <div class="gp-track-legend">
                <span>
                  <strong>Score</strong>: the track you play against (falling
                  notes)
                </span>
                <span>
                  <strong>Hear</strong>: played as backing audio
                </span>
              </div>
              <div class="gp-modal-list">
                <For each={song().tracks}>
                  {(t: MidiSongTrack) => (
                    <div class="gp-track-row">
                      <label class="gp-track-score">
                        <input
                          type="radio"
                          name="gp-score-track"
                          checked={pendingScoreId() === t.id}
                          onChange={() => setPendingScoreId(t.id)}
                        />
                        Score
                      </label>
                      <label
                        class="gp-track-hear"
                        classList={{
                          'gp-track-hear-disabled': pendingScoreId() === t.id,
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={pendingScoreId() === t.id}
                          checked={
                            pendingScoreId() !== t.id &&
                            pendingBackingIds().has(t.id)
                          }
                          onChange={(e) => {
                            const next = new Set(pendingBackingIds())
                            if (e.currentTarget.checked) next.add(t.id)
                            else next.delete(t.id)
                            setPendingBackingIds(next)
                          }}
                        />
                        Hear
                      </label>
                      <div class="gp-track-info">
                        <div class="gp-item-name">{t.name}</div>
                        <div class="gp-item-meta">
                          {t.instrumentName} &middot; {t.noteCount} notes
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div class="gp-track-actions">
                <button
                  class="gp-btn gp-btn-play"
                  onClick={applyTrackSelection}
                >
                  Load Song
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}
