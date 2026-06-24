// ============================================================
// MidiSongSelectModal — pick an imported MIDI song or a library melody
// Shared by the guitar + piano (falling-notes) song pickers.
// Shell + list items use the caller's class prefix ('gp' | 'fn').
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { CloseIcon } from '@/components/shared/midi-picker-icons'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import type { MelodyData } from '@/types'

interface MidiSongSelectModalProps {
  /** Class prefix for the modal shell + items, e.g. 'gp' or 'fn'. */
  prefix: string
  melodies: () => MelodyData[]
  savedSongs: () => SavedMidiSong[]
  selectedId: () => string | null
  onClose: () => void
  onPickMelody: (id: string) => void
  onPickSaved: (song: SavedMidiSong) => void
  onOpenTracks: (song: SavedMidiSong) => void
  onDeleteSaved: (id: string) => void
}

export const MidiSongSelectModal: Component<MidiSongSelectModalProps> = (
  props,
) => {
  return (
    <div
      class={`${props.prefix}-modal-overlay`}
      onClick={() => props.onClose()}
    >
      <div
        class={`${props.prefix}-modal-content`}
        onClick={(e) => e.stopPropagation()}
      >
        <div class={`${props.prefix}-modal-header`}>
          <h3>Select a Song</h3>
          <button
            class={`${props.prefix}-modal-close`}
            onClick={() => props.onClose()}
          >
            <CloseIcon />
          </button>
        </div>
        <div class={`${props.prefix}-modal-list`}>
          <Show when={props.savedSongs().length > 0}>
            <div class={`${props.prefix}-modal-section`}>Imported MIDI</div>
            <For each={props.savedSongs()}>
              {(s) => (
                <div
                  class={`${props.prefix}-modal-item ${props.prefix}-modal-item-row`}
                  classList={{
                    [`${props.prefix}-modal-active`]:
                      props.selectedId() === s.id,
                  }}
                >
                  <button
                    class={`${props.prefix}-modal-item-main`}
                    onClick={() => props.onPickSaved(s)}
                  >
                    <div class={`${props.prefix}-item-name`}>{s.name}</div>
                    <div class={`${props.prefix}-item-meta`}>
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
                      onClick={() => props.onOpenTracks(s)}
                    >
                      Tracks
                    </button>
                  </Show>
                  <button
                    class={`${props.prefix}-modal-close ${props.prefix}-song-delete`}
                    title="Remove imported song"
                    onClick={() => props.onDeleteSaved(s.id)}
                  >
                    <CloseIcon />
                  </button>
                </div>
              )}
            </For>
            <div class={`${props.prefix}-modal-section`}>Library</div>
          </Show>
          <For each={props.melodies()}>
            {(m: MelodyData) => (
              <button
                class={`${props.prefix}-modal-item`}
                classList={{
                  [`${props.prefix}-modal-active`]: props.selectedId() === m.id,
                }}
                onClick={() => props.onPickMelody(m.id)}
              >
                <div class={`${props.prefix}-item-name`}>{m.name}</div>
                <div class={`${props.prefix}-item-meta`}>
                  {m.items.length} notes &middot; {m.bpm} BPM &middot; {m.key}
                </div>
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
