// ============================================================
// MidiTrackMixer — inline per-track score/visibility/mute chips
// Shared by the guitar + piano (falling-notes) song pickers.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { EyeClosedIcon, EyeOpenIcon, SpeakerMutedIcon, SpeakerOpenIcon, } from '@/components/shared/midi-picker-icons'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'

interface MidiTrackMixerProps {
  song: () => SavedMidiSong
  mutedTrackIds: () => Set<string>
  visibleTrackIds: () => Set<string>
  onSelectScore: (trackId: string) => void
  onToggleMute: (trackId: string) => void
  onToggleVisibility: (trackId: string) => void
}

export const MidiTrackMixer: Component<MidiTrackMixerProps> = (props) => {
  return (
    <div class="gp-inline-mixer">
      <span class="gp-mixer-title">Tracks:</span>
      <For each={props.song().tracks}>
        {(t) => {
          const isScored = () => props.song().scoreTrackId === t.id
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
                onClick={() => props.onSelectScore(t.id)}
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
  )
}
