// ============================================================
// LibraryModal — Manage saved melodies and playlists
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { appStore } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyData, NoteName } from '@/types'

interface LibraryModalProps {
  isOpen: () => boolean
  close: () => void
}

type Tab = 'melodies' | 'playlists'

export const LibraryModal: Component<LibraryModalProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<Tab>('melodies')
  const [searchQuery, setSearchQuery] = createSignal('')
  const [selectedMelodyKey, setSelectedMelodyKey] = createSignal<string | null>(null)
  const [editingMelodyKey, setEditingMelodyKey] = createSignal<string | null>(null)

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

  const library = createMemo(() => melodyStore.getMelodyLibrary())

  const keyNames: NoteName[] = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
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
    const entries: [string, MelodyData][] = Object.entries(melodies) as [string, MelodyData][]
    return entries
      .filter(([, m]) => m.name.toLowerCase().includes(query))
      .sort((a, b): number => (b[1].playCount ?? 0) - (a[1].playCount ?? 0))
  })

  const selectedMelody = createMemo(() => {
    const key = selectedMelodyKey()
    if (key === null || key === undefined) return null
    return library().melodies[key] ?? null
  })

  const handlePlay = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
    appStore.setCurrentPresetName(melody.name)
    appStore.setTempo(melody.bpm)
    appStore.setKeyName(melody.key)
    appStore.setScaleType(melody.scaleType)
    appStore.setOctave(melody.octave ?? 4)
    props.close()
  }

  const handleLoad = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
    appStore.setCurrentPresetName(melody.name)
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
    setEditName(melody.name)
    setEditBpm(melody.bpm)
    setEditKey(melody.key)
    setEditScale(melody.scaleType)
    setEditTags(melody.tags ? melody.tags.join(', ') : '')
    setEditNotes(melody.notes ?? '')
    setEditingMelodyKey(melody.id)
  }

  const handleSaveMelody = () => {
    const editingKey = editingMelodyKey()
    if (editingKey === null) return

    const tagsArray = editTags().split(',').map(t => t.trim()).filter(t => t)
    const melody = melodyStore.getMelody(editingKey)
    if (melody) {
      melodyStore.updateMelody(editingKey, {
        name: editName(),
        bpm: editBpm(),
        key: editKey(),
        scaleType: editScale(),
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        notes: editNotes().trim() || undefined,
      })
      setEditName('')
      setEditBpm(80)
      setEditKey('C')
      setEditScale('major')
      setEditTags('')
      setEditNotes('')
      setEditingMelodyKey(null)
      setSelectedMelodyKey(editingKey)
      appStore.showNotification('Melody saved', 'success')
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
      appStore.showNotification('Please enter a name', 'warning')
      return
    }
    const tagsArray = createTags().split(',').map(t => t.trim()).filter(t => t)
    const newMelody = melodyStore.createNewMelody(name, 'User')
    melodyStore.updateMelody(newMelody.id, {
      bpm: createBpm(),
      key: createKey(),
      scaleType: createScale(),
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      notes: createNotes().trim() || undefined,
    })
    setCreateName('')
    setCreateBpm(80)
    setCreateKey('C')
    setCreateScale('major')
    setCreateTags('')
    setCreateNotes('')
    setSelectedMelodyKey(newMelody.id)
    appStore.showNotification(`Melody "${name}" created`, 'success')
  }

  const getNoteCount = (itemCount: number) => {
    return itemCount > 0 ? `${itemCount} notes` : 'Empty'
  }

  const handlePlaylistEdit = (_playlistId: string) => {
    // Note: Full playlist editing not yet implemented
    // This is just a placeholder
  }

  return (
    <Show when={props.isOpen()}>
      <div class="modal-overlay" onClick={props.close}>
        <div class="library-modal" onClick={(e) => e.stopPropagation()}>
          <div class="library-header">
            <h2>Library</h2>
            <button class="close-btn" onClick={props.close}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>

          <div class="library-tabs">
            <button
              class={`library-tab ${activeTab() === 'melodies' ? 'active' : ''}`}
              onClick={() => setActiveTab('melodies')}
            >
              Melodies
              <span class="tab-count">
                {filteredMelodies().length}
              </span>
            </button>
            <button
              class={`library-tab ${activeTab() === 'playlists' ? 'active' : ''}`}
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
                  <h3>Create New Melody</h3>

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
                        onInput={(e) => setCreateBpm(parseInt(e.currentTarget.value) || 80)}
                        min="40"
                        max="280"
                      />
                    </div>

                    <div class="form-group">
                      <label>Key</label>
                      <select
                        value={createKey()}
                        onChange={(e) => setCreateKey(e.currentTarget.value as NoteName)}
                      >
                        {keyNames.map(k => (
                          <option value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Scale</label>
                      <select
                        value={createScale()}
                        onChange={(e) => setCreateScale(e.currentTarget.value)}
                      >
                        {scaleTypes.map(s => (
                          <option value={s.value}>{s.label}</option>
                        ))}
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
                    <button class="cancel-btn" onClick={() => {
                      setCreateName('')
                      setCreateBpm(80)
                      setCreateKey('C')
                      setCreateScale('major')
                      setCreateTags('')
                      setCreateNotes('')
                    }}>Cancel</button>
                    <button class="save-btn" onClick={handleCreateMelody}>Create</button>
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
                        onInput={(e) => setEditBpm(parseInt(e.currentTarget.value) || 80)}
                        min="40"
                        max="280"
                      />
                    </div>

                    <div class="form-group">
                      <label>Key</label>
                      <select
                        value={editKey()}
                        onChange={(e) => setEditKey(e.currentTarget.value as NoteName)}
                      >
                        {keyNames.map(k => (
                          <option value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Scale</label>
                      <select
                        value={editScale()}
                        onChange={(e) => setEditScale(e.currentTarget.value)}
                      >
                        {scaleTypes.map(s => (
                          <option value={s.value}>{s.label}</option>
                        ))}
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
                    <button class="cancel-btn" onClick={cancelEdit}>Cancel</button>
                    <button class="save-btn" onClick={handleSaveMelody}>Save</button>
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
                          <Show when={melody.playCount !== null}>
                            <span>•</span>
                            <span>{melody.playCount} plays</span>
                          </Show>
                        </div>
                      </div>
                      <div class="item-actions">
                        <button class="action-btn play-btn" onClick={(e) => { e.stopPropagation(); handlePlay(melody); }} title="Play">
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M8 5v14l11-7z" />
                          </svg>
                        </button>
                        <button class="action-btn load-btn" onClick={(e) => { e.stopPropagation(); handleLoad(melody); }} title="Load">
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        </button>
                        <button class="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); handleEdit(melody); }} title="Edit">
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                          </svg>
                        </button>
                        <button class="action-btn delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(_); }} title="Delete">
                          <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </For>

                {filteredMelodies().length === 0 && (
                  <div class="empty-state">
                    <p>No melodies found. Create a new melody to get started!</p>
                  </div>
                )}
              </div>

              {/* Selected Melody Details */}
              <Show when={selectedMelody()}>
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
                        <dd>{m().key} {m().scaleType}</dd>
                        <dt>BPM</dt>
                        <dd>{m().bpm}</dd>
                        <dt>Notes</dt>
                        <dd>{m().items.length}</dd>
                        <dt>Created</dt>
                        <dd>{new Date(m().createdAt).toLocaleDateString()}</dd>
                        <dt>Updated</dt>
                        <dd>{new Date(m().updatedAt).toLocaleDateString()}</dd>
                      </dl>
                    )}
                  </Show>
                </div>
              </Show>
            </div>
          ) : (
            <div class="library-content">
              <button class="new-btn" onClick={() => {
                const name = prompt('Enter playlist name:') ?? 'My Playlist'
                if (name) melodyStore.createPlaylist(name)
              }}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
                New Playlist
              </button>

              <div class="playlist-list">
                <For each={Object.entries(library().playlists) as [string, { name: string; melodyKeys: string[]; created: number }][]}>
                  {([_id, playlist]) => (
                    <div class="playlist-item">
                      <div class="playlist-info">
                        <span class="playlist-name">{playlist.name}</span>
                        <span class="playlist-count">{playlist.melodyKeys.length} melodies</span>
                      </div>
                      <button class="action-btn edit-btn" onClick={() => handlePlaylistEdit(_id)} title="Edit">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                          <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </div>
      </div>
    </Show>
  )
}