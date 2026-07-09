// ============================================================
// MidiTrackPickerModal — choose which MIDI track to score / hear
// Shared by the guitar + piano (falling-notes) song pickers.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { CloseIcon } from '@/components/shared/midi-picker-icons'
import type { MidiSongTrack } from '@/lib/midi-song'
import type { SavedMidiSong } from '@/stores/saved-midi-songs-store'
import styles from './MidiTrackPickerModal.module.css'

interface MidiTrackPickerModalProps {
  song: () => SavedMidiSong
  /** Class prefix for the modal shell, e.g. 'gp' or 'fn'. */
  prefix: string
  /** Radio group name (must be unique per feature). */
  radioName: string
  pendingScoreId: () => string
  setPendingScoreId: (id: string) => void
  pendingBackingIds: () => Set<string>
  setPendingBackingIds: (ids: Set<string>) => void
  onApply: () => void
  onClose: () => void
  hideBacking?: boolean
  scoreHint?: string
}

export const MidiTrackPickerModal: Component<MidiTrackPickerModalProps> = (
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
          <h3>Choose Tracks — {props.song().name}</h3>
          <button
            class={`${props.prefix}-modal-close`}
            onClick={() => props.onClose()}
          >
            <CloseIcon />
          </button>
        </div>
        <div class={styles.trackLegend}>
          <span>
            <strong>Score</strong>:{' '}
            {props.scoreHint ??
              (props.hideBacking === true
                ? 'the track you sing against'
                : 'the track you play against (falling notes)')}
          </span>
          <Show when={props.hideBacking !== true}>
            <span>
              <strong>Hear</strong>: played as backing audio
            </span>
          </Show>
        </div>
        <div class={`${props.prefix}-modal-list`}>
          <For each={props.song().tracks}>
            {(t: MidiSongTrack) => (
              <div class={styles.trackRow}>
                <label class={styles.trackScore}>
                  <input
                    type="radio"
                    name={props.radioName}
                    checked={props.pendingScoreId() === t.id}
                    onChange={() => props.setPendingScoreId(t.id)}
                  />
                  Score
                </label>
                <Show when={props.hideBacking !== true}>
                  <label
                    class={styles.trackHear}
                    classList={{
                      [styles.trackHearDisabled]:
                        props.pendingScoreId() === t.id,
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={props.pendingScoreId() === t.id}
                      checked={
                        props.pendingScoreId() !== t.id &&
                        props.pendingBackingIds().has(t.id)
                      }
                      onChange={(e) => {
                        const next = new Set(props.pendingBackingIds())
                        if (e.currentTarget.checked) next.add(t.id)
                        else next.delete(t.id)
                        props.setPendingBackingIds(next)
                      }}
                    />
                    Hear
                  </label>
                </Show>
                <div class={styles.trackInfo}>
                  <div class={styles.trackName}>{t.name}</div>
                  <div class={styles.trackMeta}>
                    {t.instrumentName} &middot; {t.noteCount} notes
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
        <div class={styles.trackActions}>
          <button class={styles.trackBtn} onClick={() => props.onApply()}>
            Load Song
          </button>
        </div>
      </div>
    </div>
  )
}
