// ============================================================
// LibraryModal — Manage saved melodies and playlists
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { IconCheckSolid, IconMusicNote, IconSheetMusic, } from '@/components/hidden-features-icons'
import { usePlayback } from '@/contexts/PlaybackContext'
import { TAB_COMPOSE } from '@/features/tabs/constants'
import { setEditorView } from '@/stores'
// Note: setActiveTab is aliased to setAppActiveTab to avoid collision
// with the local LibraryModal-internal tab signal (Tab = 'melodies' | 'playlists').
import { setActiveTab as setAppActiveTab, setActiveUserSession, setBpm, setKeyName, setScaleType, showNotification, } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyData, NoteName } from '@/types'

type DebouncedSetter<T> = (value: T, immediate?: boolean) => void

interface LibraryModalProps {
  isOpen: boolean
  close: () => void
  onPlayMelody?: (melodyName: string) => void
}

type Tab = 'melodies' | 'playlists'

// Playlist editing state
type PlaylistEditingState =
  | null // Not editing any playlist
  | { mode: 'add-melody'; playlistId: string; selectedMelodyKey: string | null }
  | { mode: 'create'; playlistId: string; originalName: string }
  | { mode: 'rename'; playlistId: string; originalName: string }
  | { mode: 'delete'; playlistId: string }

// Drag and drop state
type DragState =
  | null
  | { type: 'melody'; melodyId: string }
  | { type: 'playlist'; playlistId: string }
  | { type: 'session'; sessionId: string }

export const LibraryModal: Component<LibraryModalProps> = (props) => {
  // ===========================================
  // 1. Signals - at the top
  // ===========================================
  const [activeTab, setActiveTab] = createSignal<Tab>('melodies')
  const [searchQuery, setSearchQuery] = createSignal('')
  const [selectedMelodyKey, setSelectedMelodyKey] = createSignal<string | null>(
    null,
  )
  const [editingMelodyKey, setEditingMelodyKey] = createSignal<string | null>(
    null,
  )
  const [playlistEditing, setPlaylistEditing] =
    createSignal<PlaylistEditingState>(null)
  const [dragState, setDragState] = createSignal<DragState>(null)

  const [renameInput, setRenameInput] = createSignal('')
  const [addMelodySearch, setAddMelodySearch] = createSignal('')

  const [editName, setEditName] = createSignal('')
  const [editBpm, setEditBpm] = createSignal(80)
  const [editKey, setEditKey] = createSignal('C')
  const [editScale, setEditScale] = createSignal('major')
  const [editTags, setEditTags] = createSignal('')
  const [editNotes, setEditNotes] = createSignal('')

  const [createName, setCreateName] = createSignal('')
  const [createBpm, setCreateBpm] = createSignal(80)
  const [createKey, setCreateKey] = createSignal('C')
  const [createScale, setCreateScale] = createSignal('major')
  const [createTags, setCreateTags] = createSignal('')
  const [createNotes, setCreateNotes] = createSignal('')

  // ===========================================
  // 2. Memos and helper values
  // ===========================================

  // Debounce helper for BPM inputs to prevent rapid-fire updates
  const createDebouncedSetter = <T extends number>(
    setter: (value: T) => void,
    delay: number = 300,
  ): DebouncedSetter<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    return (value: T, immediate = false) => {
      if (immediate && timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (!timeoutId) {
        setter(value)
        if (!immediate) {
          timeoutId = setTimeout(() => {
            timeoutId = null
          }, delay)
        }
      }
    }
  }

  const debouncedCreateBpm = createDebouncedSetter(createBpm, 300)
  const debouncedEditBpm = createDebouncedSetter(editBpm, 300)

  const library = createMemo(() => melodyStore.getMelodyLibrary())

  const keyNames: NoteName[] = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]

  const scaleTypes = [
    { value: 'major', label: 'Major' },
    { value: 'minor', label: 'Minor' },
    { value: 'harmonic-minor', label: 'Harmonic Minor' },
    { value: 'pentatonic', label: 'Pentatonic' },
    { value: 'blues', label: 'Blues' },
    { value: 'chromatic', label: 'Chromatic' },
  ]

  const filteredMelodies = createMemo(() => {
    const query = searchQuery().toLowerCase()
    const melodies = library().melodies
    const entries: [string, MelodyData][] = Object.entries(melodies) as [
      string,
      MelodyData,
    ][]
    return entries
      .filter(
        ([, m]) => m.name !== null && m.name.toLowerCase().includes(query),
      )
      .sort((a, b): number => (b[1].playCount ?? 0) - (a[1].playCount ?? 0))
  })

  const availableForPlaylist = createMemo(() => {
    const playlistEdit = playlistEditing()
    const playlistId = playlistEdit?.playlistId ?? null
    if (playlistId === null) return []

    const query = addMelodySearch().toLowerCase()
    const allSessions = melodyStore.getSessions()
    const melodyEntries = Object.values(library().melodies) as MelodyData[]

    return [
      ...allSessions
        .filter((s) => s.name.toLowerCase().includes(query))
        .map((s) => ({
          id: s.id,
          type: 'session' as const,
          title: s.name,
          meta: `${s.items.length} item${s.items.length === 1 ? '' : 's'}`,
        })),
      ...melodyEntries
        .filter((m) => m.name.toLowerCase().includes(query))
        .map((m) => ({
          id: m.id,
          type: 'melody' as const,
          title: m.name,
          meta: `${m.key} • ${m.bpm} BPM • ${m.items.length} notes`,
        })),
    ]
  })

  const selectedMelody = createMemo(() => {
    const key = selectedMelodyKey()
    if (key === null) return null
    return library().melodies[key] ?? null
  })

  const isSessionInPlaylist = (playlistId: string, sessionId: string) => {
    const playlist = library().playlists[playlistId]
    return playlist?.sessionKeys?.includes(sessionId) ?? false
  }

  const isMelodyInPlaylist = (playlistId: string, melodyId: string) => {
    const playlist = library().playlists[playlistId]
    return playlist?.melodyKeys?.includes(melodyId) ?? false
  }

  const handleTogglePlaylistItem = (
    playlistId: string,
    item: { id: string; type: 'session' | 'melody' },
  ) => {
    if (item.type === 'session') {
      handleToggleSessionInPlaylist(playlistId, item.id)
    } else if (isMelodyInPlaylist(playlistId, item.id)) {
      melodyStore.removeMelodyFromPlaylist(playlistId, item.id)
    } else {
      melodyStore.addMelodyToPlaylist(playlistId, item.id)
    }
  }

  const handleToggleSessionInPlaylist = (
    playlistId: string,
    sessionId: string,
  ) => {
    if (isSessionInPlaylist(playlistId, sessionId)) {
      melodyStore.removeSessionFromPlaylist(playlistId, sessionId)
    } else {
      melodyStore.addSessionToPlaylist(playlistId, sessionId)
    }
  }

  // ===========================================
  // 4. Regular functions - drag and drop
  // ===========================================

  const { playSessionSequence } = usePlayback()

  const handlePlay = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
    setBpm(melody.bpm)
    setKeyName(melody.key)
    setScaleType(melody.scaleType)
    melodyStore.setOctave(melody.octave ?? 4)
    props.onPlayMelody?.(melody.name)
    props.close()
  }

  const handlePlayPlaylist = (playlistId: string) => {
    const synth = melodyStore.buildPlaylistAsSession(playlistId)
    if (synth !== null) {
      setActiveUserSession(synth)
    }
    const ids = melodyStore.getPlaylistMelodyIds(playlistId)
    if (ids.length > 0) {
      playSessionSequence(ids)
    }
    props.close()
  }

  const handleLoad = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
    props.close()
  }

  const handleDelete = (key: string) => {
    if (confirm('Delete this melody?')) {
      melodyStore.deleteMelody(key)
      setSelectedMelodyKey(null)
      if (editingMelodyKey() === key) {
        cancelEdit()
      }
    }
  }

  const handleEdit = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
    setAppActiveTab(TAB_COMPOSE)
    setEditorView('piano-roll')
    props.close()
  }

  const handleSaveMelody = () => {
    const editingKey = editingMelodyKey()
    if (editingKey === null) return

    const tagsArray = editTags()
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t)
    const melody = melodyStore.getMelody(editingKey)
    if (melody !== null) {
      melodyStore.updateMelody(editingKey, {
        name: editName(),
        bpm: editBpm(),
        key: editKey(),
        scaleType: editScale(),
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        notes: editNotes().trim().length > 0 ? editNotes().trim() : undefined,
      })
      setEditName('')
      setEditBpm(80)
      setEditKey('C')
      setEditScale('major')
      setEditTags('')
      setEditNotes('')
      setEditingMelodyKey(null)
      setSelectedMelodyKey(editingKey)
      showNotification('Melody saved', 'success')
    }
  }

  const cancelEdit = () => {
    setEditingMelodyKey(null)
    setEditName('')
    setEditBpm(80)
    setEditKey('C')
    setEditScale('major')
    setEditTags('')
    setEditNotes('')
  }

  const handleCreateMelody = () => {
    const name = createName().trim()
    if (!name) {
      showNotification('Please enter a name', 'warning')
      return
    }
    const tagsArray = createTags()
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t)
    const newMelody = melodyStore.createNewMelody(name, 'User')
    const updatedMelody =
      melodyStore.updateMelody(newMelody.id, {
        bpm: createBpm(),
        key: createKey(),
        scaleType: createScale(),
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        notes:
          createNotes().trim().length > 0 ? createNotes().trim() : undefined,
      }) ?? newMelody

    // Add newly created melody to currently active session
    const updatedSession = melodyStore.addMelodyToActiveSession(
      newMelody.id,
      name,
    )
    if (updatedSession !== undefined) {
      setActiveUserSession(updatedSession)
    }
    melodyStore.setCurrentMelody(updatedMelody)

    setCreateName('')
    setCreateBpm(80)
    setCreateKey('C')
    setCreateScale('major')
    setCreateTags('')
    setCreateNotes('')
    setSelectedMelodyKey(newMelody.id)
    setAppActiveTab(TAB_COMPOSE)
    setEditorView('piano-roll')
    showNotification(`Melody "${name}" created`, 'success')
  }

  const getNoteCount = (itemCount: number) => {
    return itemCount > 0 ? `${itemCount} notes` : 'Empty'
  }

  const hasNotes = (notes?: string): boolean => {
    return notes !== null && notes !== undefined && notes.trim().length > 0
  }

  const _handleCreatePlaylist = () => {
    const name = renameInput().trim() || 'My Playlist'
    melodyStore.createPlaylist(name)
    setPlaylistEditing(null)
    setRenameInput('')
    showNotification(`Playlist "${name}" created`, 'success')
  }

  const handleRenamePlaylist = () => {
    const playlistEdit = playlistEditing()
    if (!playlistEdit || playlistEdit.mode !== 'rename') return

    const playlistId = playlistEdit.playlistId
    const name = renameInput().trim()
    if (
      playlistId !== null &&
      playlistId !== undefined &&
      name.trim().length > 0
    ) {
      const playlist = melodyStore.getPlaylist(playlistId)
      if (playlist !== null) {
        const newPlaylistId = melodyStore.createPlaylist(name)
        const library = melodyStore.getMelodyLibrary()

        const libraryPlaylist = library.playlists[playlistId]
        const melodyKeys =
          libraryPlaylist !== undefined ? libraryPlaylist.melodyKeys : []
        melodyKeys.forEach((melodyKey: string) => {
          melodyStore.addMelodyToPlaylist(newPlaylistId, melodyKey)
        })

        melodyStore.deletePlaylist(playlistId)

        setPlaylistEditing(null)
        setRenameInput('')
        showNotification(`Playlist renamed`, 'success')
      }
    }
  }

  const cancelRename = () => {
    setPlaylistEditing(null)
    setRenameInput('')
  }

  const _handleDeletePlaylist = () => {
    const playlistEdit = playlistEditing()
    if (!playlistEdit || playlistEdit.mode !== 'delete') return

    if (
      playlistEdit.playlistId !== null &&
      playlistEdit.playlistId !== undefined &&
      confirm('Delete this playlist?')
    ) {
      melodyStore.deletePlaylist(playlistEdit.playlistId)
      setPlaylistEditing(null)
      showNotification('Playlist deleted', 'success')
    }
  }

  const startAddMelodyMode = (playlistId: string) => {
    setPlaylistEditing({
      mode: 'add-melody',
      playlistId,
      selectedMelodyKey: null,
    })
    setAddMelodySearch('')
  }

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent, melodyId: string) => {
    setDragState({ type: 'melody', melodyId })
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', melodyId)
    }
  }

  const handleDragStartPlaylist = (e: DragEvent, playlistId: string) => {
    setDragState({ type: 'playlist', playlistId })
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('playlistId', playlistId)
    }
  }

  const handleDragEnd = () => {
    setDragState(null)
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDropPlaylist = (e: DragEvent, playlistId: string) => {
    e.preventDefault()
    const state = dragState()
    if (state !== null && state.type === 'melody') {
      melodyStore.addMelodyToPlaylist(playlistId, state.melodyId)
      showNotification('Melody added to playlist', 'success')
      setDragState(null)
    } else if (state !== null && state.type === 'session') {
      melodyStore.addSessionToPlaylist(playlistId, state.sessionId)
      showNotification('Session added to playlist', 'success')
      setDragState(null)
    }
  }

  const handleDropSessionToPlaylist = (e: DragEvent, playlistId: string) => {
    e.preventDefault()
    const state = dragState()
    if (state !== null && state.type === 'session') {
      const playlist = melodyStore.getPlaylist(playlistId)
      if (playlist) {
        const sessionKeys = playlist.sessionKeys
        if (
          sessionKeys !== undefined &&
          sessionKeys.includes(state.sessionId)
        ) {
          showNotification('Session already in playlist', 'info')
          setDragState(null)
          return
        }
        melodyStore.addSessionToPlaylist(playlistId, state.sessionId)
        showNotification('Session added to playlist', 'success')
        setDragState(null)
      }
    }
  }

  const handleDropMelodyList = (e: DragEvent, melodyId: string) => {
    e.preventDefault()
    const state = dragState()
    if (state !== null && state.type === 'playlist') {
      const playlist = melodyStore.getPlaylist(state.playlistId)
      if (playlist) {
        const newMelodyKeys = playlist.melodyKeys.filter(
          (id) => id !== melodyId,
        )
        melodyStore.updatePlaylist(state.playlistId, {
          melodyKeys: newMelodyKeys,
        })
        showNotification('Melody removed from playlist', 'success')
      }
      setDragState(null)
    }
  }

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={() => props.close()}>
        <div class="library-modal" onClick={(e) => e.stopPropagation()}>
          <div class="library-header">
            <h2>Library</h2>
            <button
              class="close-btn"
              onClick={() => props.close()}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          <div class="library-tabs">
            <button
              class={`library-modal-tab ${activeTab() === 'melodies' ? 'active' : ''}`}
              onClick={() => setActiveTab('melodies')}
            >
              Melodies
              <span class="tab-count">{filteredMelodies().length}</span>
            </button>
            <button
              class={`library-modal-tab ${activeTab() === 'playlists' ? 'active' : ''}`}
              onClick={() => setActiveTab('playlists')}
            >
              Playlists
              <span class="tab-count">
                {Object.keys(library().playlists).length}
              </span>
            </button>
          </div>

          {activeTab() === 'melodies' ? (
            <div class="library-content">
              {/* Search */}
              <input
                type="text"
                class="search-input"
                placeholder="Search melodies..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />

              {/* Create Melody Form */}
              {editingMelodyKey() === null && (
                <div class="edit-melody-form">
                  <div class="create-header">
                    <h3>Create New Melody</h3>
                    <button
                      class="big-create-btn"
                      onClick={() => {
                        setCreateName('')
                        setCreateBpm(80)
                        setCreateKey('C')
                        setCreateScale('major')
                        setCreateTags('')
                        setCreateNotes('')
                      }}
                      aria-label="Reset form"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path
                          fill="currentColor"
                          d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                        />
                      </svg>
                    </button>
                  </div>

                  <div class="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={createName()}
                      onInput={(e) => setCreateName(e.currentTarget.value)}
                      placeholder="Melody name"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>BPM</label>
                      <input
                        type="number"
                        value={createBpm()}
                        onInput={(e) => {
                          const valStr = e.currentTarget.value
                          if (!valStr) {
                            // Empty string - reset to default
                            setCreateBpm(80)
                            return
                          }
                          const val = parseFloat(valStr)
                          if (isNaN(val)) {
                            // Invalid number - keep current value
                            return
                          }
                          // Clamp between 20 and 280
                          const clamped = Math.max(20, Math.min(280, val))
                          debouncedCreateBpm(clamped)
                        }}
                        min="20"
                        max="280"
                      />
                    </div>

                    <div class="form-group">
                      <label>Key</label>
                      <select
                        value={createKey()}
                        onChange={(e) =>
                          setCreateKey(e.currentTarget.value as NoteName)
                        }
                      >
                        <For each={keyNames}>
                          {(k) => <option value={k}>{k}</option>}
                        </For>
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Scale</label>
                      <select
                        value={createScale()}
                        onChange={(e) => setCreateScale(e.currentTarget.value)}
                      >
                        <For each={scaleTypes}>
                          {(s) => <option value={s.value}>{s.label}</option>}
                        </For>
                      </select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={createTags()}
                      onInput={(e) => setCreateTags(e.currentTarget.value)}
                      placeholder="jazz, blues, etc."
                    />
                  </div>

                  <div class="form-group">
                    <label>Notes</label>
                    <textarea
                      value={createNotes()}
                      onInput={(e) => setCreateNotes(e.currentTarget.value)}
                      placeholder="User notes about this melody..."
                      rows={3}
                    />
                  </div>

                  <div class="form-actions">
                    <button
                      class="cancel-btn"
                      onClick={() => {
                        setCreateName('')
                        setCreateBpm(80)
                        setCreateKey('C')
                        setCreateScale('major')
                        setCreateTags('')
                        setCreateNotes('')
                      }}
                    >
                      Cancel
                    </button>
                    <button class="save-btn" onClick={handleCreateMelody}>
                      Create
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Melody Form */}
              {editingMelodyKey() !== null && (
                <div class="edit-melody-form">
                  <h3>Edit Melody</h3>

                  <div class="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={editName()}
                      onInput={(e) => setEditName(e.currentTarget.value)}
                      placeholder="Melody name"
                    />
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label>BPM</label>
                      <input
                        type="number"
                        value={editBpm()}
                        onInput={(e) => {
                          const valStr = e.currentTarget.value
                          if (!valStr) {
                            setEditBpm(80)
                            return
                          }
                          const val = parseFloat(valStr)
                          if (isNaN(val)) {
                            return
                          }
                          const clamped = Math.max(20, Math.min(280, val))
                          debouncedEditBpm(clamped)
                        }}
                        min="20"
                        max="280"
                      />
                    </div>

                    <div class="form-group">
                      <label>Key</label>
                      <select
                        value={editKey()}
                        onChange={(e) =>
                          setEditKey(e.currentTarget.value as NoteName)
                        }
                      >
                        <For each={keyNames}>
                          {(k) => <option value={k}>{k}</option>}
                        </For>
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Scale</label>
                      <select
                        value={editScale()}
                        onChange={(e) => setEditScale(e.currentTarget.value)}
                      >
                        <For each={scaleTypes}>
                          {(s) => <option value={s.value}>{s.label}</option>}
                        </For>
                      </select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={editTags()}
                      onInput={(e) => setEditTags(e.currentTarget.value)}
                      placeholder="jazz, blues, etc."
                    />
                  </div>

                  <div class="form-group">
                    <label>Notes</label>
                    <textarea
                      value={editNotes()}
                      onInput={(e) => setEditNotes(e.currentTarget.value)}
                      placeholder="User notes about this melody..."
                      rows={3}
                    />
                  </div>

                  <div class="form-actions">
                    <button class="cancel-btn" onClick={cancelEdit}>
                      Cancel
                    </button>
                    <button class="save-btn" onClick={handleSaveMelody}>
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* List */}
              <div class="library-list">
                <For each={filteredMelodies()}>
                  {([_, melody]) => (
                    <div
                      class={`library-item ${selectedMelodyKey() === _ ? 'selected' : ''}`}
                      onClick={() => setSelectedMelodyKey(_)}
                      draggable={dragState()?.type === 'playlist'}
                      onDragStart={(e) => handleDragStart(e, _)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropMelodyList(e, _)}
                    >
                      <div class="item-main">
                        <div class="item-title">
                          {melody.name}
                          <Show when={melody.author}>
                            <span class="item-author">— {melody.author}</span>
                          </Show>
                        </div>
                        <div class="item-meta">
                          <span>{melody.key}</span>
                          <span>•</span>
                          <span>{melody.bpm} BPM</span>
                          <span>•</span>
                          <span>{getNoteCount(melody.items.length)}</span>
                          <Show
                            when={
                              melody.playCount !== null &&
                              melody.playCount !== undefined
                            }
                          >
                            <span>•</span>
                            <span>{melody.playCount} plays</span>
                          </Show>
                        </div>
                        <Show when={melody.tags && melody.tags.length > 0}>
                          <div class="item-tags">
                            <For each={(melody.tags as string[]).slice(0, 3)}>
                              {(tag) => <span class="tag-pill">{tag}</span>}
                            </For>
                            {(melody.tags as string[]).length > 3 && (
                              <span class="tag-pill more">
                                +{(melody.tags as string[]).length - 3}
                              </span>
                            )}
                          </div>
                        </Show>
                      </div>
                      <div class="item-actions">
                        <button
                          class="action-btn play-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePlay(melody)
                          }}
                          title="Play"
                          aria-label="Play"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                        <button
                          class="action-btn load-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLoad(melody)
                          }}
                          title="Load"
                          aria-label="Load"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path
                              fill="currentColor"
                              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                            />
                          </svg>
                        </button>
                        <button
                          class="action-btn edit-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(melody)
                          }}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path
                              fill="currentColor"
                              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                            />
                          </svg>
                        </button>
                        <button
                          class="action-btn delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(_)
                          }}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path
                              fill="currentColor"
                              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </For>

                {filteredMelodies().length === 0 && (
                  <div class="empty-state">
                    <p>
                      No melodies found. Create a new melody to get started!
                    </p>
                  </div>
                )}
              </div>

              {/* Selected Melody Details */}
              <Show when={selectedMelody() !== null}>
                <div class="melody-details">
                  <h3>Selected Melody</h3>
                  <Show when={selectedMelody()}>
                    {(m) => (
                      <dl class="details-list">
                        <dt>Name</dt>
                        <dd>{m().name}</dd>
                        <dt>Author</dt>
                        <dd>{m().author ?? 'Unknown'}</dd>
                        <dt>Key</dt>
                        <dd>
                          {m().key} {m().scaleType}
                        </dd>
                        <dt>BPM</dt>
                        <dd>{m().bpm}</dd>
                        <dt>Tags</dt>
                        <dd>
                          <Show when={(m().tags?.length ?? 0) > 0}>
                            <div class="tag-pills">
                              <Show when={(m().tags as string[]).length <= 50}>
                                <For each={m().tags as string[]}>
                                  {(tag) => <span class="tag-pill">{tag}</span>}
                                </For>
                              </Show>
                              <Show when={(m().tags as string[]).length > 3}>
                                <For each={(m().tags as string[]).slice(0, 50)}>
                                  {(tag) => <span class="tag-pill">{tag}</span>}
                                </For>
                                <Show when={(m().tags as string[]).length > 50}>
                                  <span class="tag-pill more">
                                    +{(m().tags as string[]).length - 50}
                                  </span>
                                </Show>
                              </Show>
                            </div>
                          </Show>
                          <Show
                            when={
                              !m().tags || (m().tags as string[]).length === 0
                            }
                          >
                            -
                          </Show>
                        </dd>
                        <dt>Notes</dt>
                        <dd>
                          <Show when={hasNotes(m().notes)}>{m().notes}</Show>
                          <Show when={!hasNotes(m().notes)}>-</Show>
                        </dd>
                        <dt>Created</dt>
                        <dd>
                          {new Date(
                            m().createdAt ?? Date.now(),
                          ).toLocaleDateString()}
                        </dd>
                        <dt>Updated</dt>
                        <dd>
                          {new Date(
                            m().updatedAt ?? Date.now(),
                          ).toLocaleDateString()}
                        </dd>
                      </dl>
                    )}
                  </Show>
                </div>
              </Show>
            </div>
          ) : (
            <div class="library-content">
              {/* Add melody mode */}
              <Show when={playlistEditing()?.mode === 'add-melody'}>
                <div class="playlist-edit-form">
                  <h3>Add Melody to Playlist</h3>

                  <div class="form-group">
                    <label>Search melodies...</label>
                    <input
                      type="text"
                      class="search-input"
                      placeholder="Type to search melodies..."
                      value={addMelodySearch()}
                      onInput={(e) => setAddMelodySearch(e.currentTarget.value)}
                    />
                  </div>

                  <div class="melody-select-list">
                    <For each={availableForPlaylist()}>
                      {(item) => {
                        const edit = playlistEditing()
                        const playlistId = edit?.playlistId ?? ''
                        const selected =
                          item.type === 'session'
                            ? isSessionInPlaylist(playlistId, item.id)
                            : isMelodyInPlaylist(playlistId, item.id)
                        return (
                          <button
                            type="button"
                            class={`melody-select-item playlist-picker-pill ${selected ? 'selected' : ''}`}
                            onClick={() =>
                              handleTogglePlaylistItem(playlistId, item)
                            }
                          >
                            <span class="playlist-picker-icon">
                              {item.type === 'session' ? (
                                <IconSheetMusic />
                              ) : (
                                <IconMusicNote />
                              )}
                            </span>
                            <span class="playlist-picker-copy">
                              <span class="select-item-title">
                                {item.title}
                              </span>
                              <span class="select-item-meta">{item.meta}</span>
                            </span>
                            <span class="playlist-picker-check">
                              {selected ? <IconCheckSolid /> : '+'}
                            </span>
                          </button>
                        )
                      }}
                    </For>

                    {availableForPlaylist().length === 0 && (
                      <div class="empty-state">
                        <p>No matching sessions or melodies found.</p>
                      </div>
                    )}
                  </div>

                  <div class="form-actions">
                    <button
                      class="cancel-btn"
                      onClick={() => {
                        setPlaylistEditing(null)
                        setAddMelodySearch('')
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      class="save-btn"
                      onClick={() => setPlaylistEditing(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </Show>

              {/* Create mode (for new playlists) */}
              <Show when={playlistEditing()?.mode === 'create'}>
                <div class="playlist-edit-form">
                  <h3>Create New Playlist</h3>

                  <div class="form-group">
                    <label>Playlist Name</label>
                    <input
                      type="text"
                      class="search-input"
                      value={renameInput()}
                      onInput={(e) => setRenameInput(e.currentTarget.value)}
                      placeholder="My Playlist"
                      autofocus
                    />
                  </div>

                  <div class="form-actions">
                    <button class="cancel-btn" onClick={cancelRename}>
                      Cancel
                    </button>
                    <button class="save-btn" onClick={_handleCreatePlaylist}>
                      Create Playlist
                    </button>
                  </div>
                </div>
              </Show>

              {/* Rename mode */}
              <Show
                when={
                  playlistEditing()?.mode === 'rename' &&
                  playlistEditing()?.playlistId
                }
              >
                <div class="playlist-edit-form">
                  <h3>Rename Playlist</h3>

                  <div class="form-group">
                    <label>New Name</label>
                    <input
                      type="text"
                      class="search-input"
                      value={renameInput()}
                      onInput={(e) => setRenameInput(e.currentTarget.value)}
                      placeholder="Playlist name"
                      autofocus
                    />
                  </div>

                  <div class="form-actions">
                    <button class="cancel-btn" onClick={cancelRename}>
                      Cancel
                    </button>
                    <button class="save-btn" onClick={handleRenamePlaylist}>
                      Rename
                    </button>
                  </div>
                </div>
              </Show>

              {/* Delete mode */}
              <Show when={playlistEditing()?.mode === 'delete'}>
                <div class="playlist-edit-form">
                  <h3>Delete Playlist</h3>
                  <p>
                    Are you sure you want to delete this playlist? This action
                    cannot be undone.
                  </p>

                  <div class="form-actions">
                    <button class="cancel-btn" onClick={cancelRename}>
                      Cancel
                    </button>
                    <button class="delete-btn" onClick={_handleDeletePlaylist}>
                      Delete
                    </button>
                  </div>
                </div>
              </Show>

              {/* Normal playlist view */}
              <Show when={playlistEditing() === null}>
                <button
                  class="new-btn"
                  onClick={() => {
                    setPlaylistEditing({
                      mode: 'create',
                      playlistId: '',
                      originalName: '',
                    })
                    setRenameInput('')
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    <path
                      fill="currentColor"
                      d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                    />
                  </svg>
                  New Playlist
                </button>

                {Object.keys(library().playlists).length === 0 && (
                  <div class="empty-state">
                    <p>
                      No playlists yet. Create a playlist to organize your
                      melodies!
                    </p>
                  </div>
                )}

                <div class="playlist-list">
                  <For
                    each={
                      Object.entries(library().playlists) as [
                        string,
                        {
                          name: string
                          melodyKeys: string[]
                          sessionKeys?: string[]
                          created: number
                        },
                      ][]
                    }
                  >
                    {([_id, playlist]) => {
                      return (
                        <div
                          class="playlist-item"
                          draggable={dragState()?.type === 'melody'}
                          onDragStart={(e) => handleDragStartPlaylist(e, _id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => {
                            e.preventDefault()
                            const state = dragState()
                            if (state !== null) {
                              if (state.type === 'melody') {
                                handleDropPlaylist(e, _id)
                              } else if (state.type === 'session') {
                                handleDropSessionToPlaylist(e, _id)
                              }
                            }
                          }}
                        >
                          <div class="playlist-info">
                            <span class="playlist-name">{playlist.name}</span>
                            <span class="playlist-count">
                              {playlist.melodyKeys.length} melodies ·{' '}
                              {playlist.sessionKeys?.length ?? 0} sessions
                            </span>
                          </div>
                          <div class="item-actions">
                            <button
                              class="action-btn play-btn"
                              onClick={() => {
                                handlePlayPlaylist(_id)
                              }}
                              title="Play All"
                              aria-label="Play All"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <path fill="currentColor" d="M8 5v14l11-7z" />
                              </svg>
                            </button>
                            <button
                              class="action-btn edit-btn"
                              onClick={() => startAddMelodyMode(_id)}
                              title="Add Melody"
                              aria-label="Add Melody"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <path
                                  fill="currentColor"
                                  d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                                />
                              </svg>
                            </button>
                            <button
                              class="action-btn delete-btn"
                              onClick={() =>
                                setPlaylistEditing({
                                  mode: 'delete',
                                  playlistId: _id,
                                })
                              }
                              title="Delete"
                              aria-label="Delete"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14">
                                <path
                                  fill="currentColor"
                                  d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    }}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </div>
      </div>
    </Show>
  )
}
