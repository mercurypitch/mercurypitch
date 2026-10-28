// ============================================================
// The Karaoke room's options: the gear's sheet (plan S8 §5, D4 A)
// ============================================================
//
// Zen's header carried its own toggles (notes, text size, autoplay) over the
// lyrics. In the room they are rows with words, behind the gear, as Sing's
// options are; the stage keeps only what is used mid-song. Opening the sheet
// does not stop the song.
//
//   Lyrics   text size; the notes over the lyrics, for a song that has them
//            or can have them read from its vocal: turning them on for a
//            song without them reads them, as turning the mic on does
//            (owner, 28 Oct 2026). Absent only where no read can run (K1:
//            absent, never dead).
//   Playing  the next song by itself; the key, a step either way, back to
//            the song's own and Find my key (the stage's landscape column
//            has no room for it); the music level and its way back to
//            100% (the pill on the stage stays the everyday control).
//   More     the one option pinned beside the gear (owner, 27 Sep); the
//            songs left, where songs can be imported (Stage 2), which push
//            Settings, Karaoke; Manage songs, which pushes the studio (D8
//            A); and All settings, which pushes Settings as Sing's does.

import type { Component, JSX } from 'solid-js'
import { createEffect, For, onCleanup, Show, untrack } from 'solid-js'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import { KeyShiftControl } from '@/components/key-shift/KeyShiftControl'
import { OptionSection, OptionsSheet } from '@/components/mobile/OptionsSheet'
import { ZEN_LYRICS_SIZES } from '@/features/stem-mixer/zen-navigation'
import styles from './karaoke-room.module.css'
import type { KaraokePinned } from './karaoke-room-store'
import { KARAOKE_LYRICS_SIZE_LABELS, karaokeLyricsSize, karaokePinned, karaokePlayNext, setKaraokeLyricsSize, setKaraokePinned, setKaraokePlayNext, } from './karaoke-room-store'

/** What each choice is called in the "Beside the gear" list. */
const PINNED_CHOICES: ReadonlyArray<{ value: KaraokePinned; label: string }> = [
  { value: 'none', label: 'Nothing' },
  { value: 'lyrics-size', label: 'Text size' },
  { value: 'notes', label: 'Notes over the lyrics' },
  { value: 'play-next', label: 'The next song by itself' },
]

const isPinnedChoice = (value: string): value is KaraokePinned =>
  PINNED_CHOICES.some((choice) => choice.value === value)

const Switch: Component<{
  on: boolean
  label: string
  onToggle: () => void
}> = (props) => (
  <button
    type="button"
    classList={{ [styles.switch]: true, [styles.switchOn]: props.on }}
    role="switch"
    aria-checked={props.on}
    aria-label={props.label}
    onClick={() => props.onToggle()}
  >
    <i />
  </button>
)

const Row: Component<{
  label: string
  sub?: string
  children: JSX.Element
}> = (props) => (
  <div class={styles.optionRow}>
    <span class={styles.optionText}>
      <span class={styles.optionLabel}>{props.label}</span>
      <Show when={props.sub}>
        {(sub) => <span class={styles.optionSub}>{sub()}</span>}
      </Show>
    </span>
    <span class={styles.optionControl}>{props.children}</span>
  </div>
)

/** The notes over the lyrics, as the room has them for the song on stage. */
export interface KaraokeNotesOption {
  /** The song has its notes, or a read can give it them. */
  offered: () => boolean
  /** The notes are on screen, or on their way. */
  on: () => boolean
  /** The song has its notes already. */
  has: () => boolean
  /** The notes are being read from the vocal. */
  finding: () => boolean
  /** How far the read has got, 0 to 100. */
  progress: () => number
  toggle: () => void
}

/** What the notes row says under its name. */
export function notesRowSub(notes: KaraokeNotesOption): string {
  if (notes.finding()) {
    return `Reading the vocal to find the notes: ${Math.round(notes.progress())}%`
  }
  if (notes.has()) return 'This song has its notes'
  return 'Turning this on reads them from the vocal'
}

interface KaraokeRoomOptionsProps {
  isOpen: boolean
  close: () => void
  /** The notes over the lyrics for the song on the stage. */
  notes: KaraokeNotesOption
  /** The music level as a share of the shipped level, or null for none yet. */
  musicPercent: () => number | null
  onResetMusicLevel: () => void
  onAllSettings: () => void
  /** "Songs this month: 18 of 20 left", or null for no row (Stage 2 only). */
  songsRow?: () => { label: string; value: string } | null
  /** The songs row's tap: Settings, Karaoke. */
  onSongs?: () => void
  /** Open the studio. Absent where nothing can: the row is then not drawn. */
  onManageSongs?: () => void
  /** The singer's key, once the mixer has handed it over (else no row). */
  keyControl?: () => KeyShiftBinding | null
}

export const KaraokeRoomOptions: Component<KaraokeRoomOptionsProps> = (
  props,
) => {
  // Open, the sheet holds Find my key's notices and says them in the key
  // row: a toast would sit over the sheet. The hold follows the key that is
  // there now, since songs change under an open sheet and each song's mixer
  // brings its own: the old one lets go, the new one holds. Let go as the
  // sheet shuts, and as the room goes with it open.
  createEffect(() => {
    const key = props.keyControl?.() ?? null
    if (key === null || !props.isOpen) return
    untrack(() => key.holdNotices?.(true))
    onCleanup(() => key.holdNotices?.(false))
  })

  return (
    <OptionsSheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="Karaoke options"
    >
      <div class={styles.options} data-testid="karaoke-options">
        <div class={styles.sheetHead}>
          <h2 class={styles.sheetTitle}>Karaoke options</h2>
        </div>

        <OptionSection label="Lyrics">
          <Row label="Text size">
            <span class={styles.segments} role="group" aria-label="Text size">
              <For each={ZEN_LYRICS_SIZES}>
                {(size) => (
                  <button
                    type="button"
                    classList={{
                      [styles.segment]: true,
                      [styles.segmentOn]: karaokeLyricsSize() === size,
                    }}
                    aria-pressed={karaokeLyricsSize() === size}
                    onClick={() => setKaraokeLyricsSize(size)}
                  >
                    {KARAOKE_LYRICS_SIZE_LABELS[size]}
                  </button>
                )}
              </For>
            </span>
          </Row>
          <Show when={props.notes.offered()}>
            <Row
              label="Show notes over the lyrics"
              sub={notesRowSub(props.notes)}
            >
              <Switch
                on={props.notes.on()}
                label="Show notes over the lyrics"
                onToggle={() => props.notes.toggle()}
              />
            </Row>
          </Show>
        </OptionSection>

        <OptionSection label="Playing">
          <Row label="Play the next song automatically">
            <Switch
              on={karaokePlayNext()}
              label="Play the next song automatically"
              onToggle={() => setKaraokePlayNext(!karaokePlayNext())}
            />
          </Row>
          <Show when={props.keyControl?.()}>
            {(key) => (
              <div class={styles.keyRow}>
                <span class={styles.optionText}>
                  <span class={styles.optionLabel}>Key</span>
                  <span class={styles.optionSub}>
                    Moves the song to suit your voice. Tap the number for the
                    song's own key.
                  </span>
                </span>
                <KeyShiftControl
                  value={key().value()}
                  onChange={key().onChange}
                  keyLabel={key().keyLabel()}
                  suggestion={key().suggestion()}
                  onFindKey={key().onFindKey}
                  disabledReason={key().disabledReason()}
                  size="touch"
                />
                <p
                  class={styles.keyStatus}
                  role="status"
                  data-testid="karaoke-options-key-status"
                >
                  {key().notice?.()?.message ?? ''}
                </p>
              </div>
            )}
          </Show>
          <Show when={props.musicPercent()}>
            {(percent) => (
              <Row
                label="Music level"
                sub="The pill on the stage sets it while you sing"
              >
                <span class={styles.optionValue}>{`${percent()}%`}</span>
                <button
                  type="button"
                  class={styles.optionButton}
                  aria-label="Reset the music level to 100%"
                  disabled={percent() === 100}
                  onClick={() => props.onResetMusicLevel()}
                >
                  Reset
                </button>
              </Row>
            )}
          </Show>
        </OptionSection>

        <OptionSection label="More">
          <Row label="Beside the gear" sub="One option, a tap away">
            <select
              class={`dropdown-select-style ${styles.optionSelect}`}
              aria-label="Beside the gear"
              value={karaokePinned()}
              onChange={(event) => {
                const value = event.currentTarget.value
                if (isPinnedChoice(value)) setKaraokePinned(value)
              }}
            >
              <For each={PINNED_CHOICES}>
                {(choice) => (
                  <option value={choice.value}>{choice.label}</option>
                )}
              </For>
            </select>
          </Row>
          <Show when={props.songsRow?.()}>
            {(songs) => (
              <Row label={songs().label}>
                <button
                  type="button"
                  class={styles.optionButton}
                  aria-label={`${songs().label}: ${songs().value}`}
                  onClick={() => {
                    props.close()
                    props.onSongs?.()
                  }}
                >
                  {songs().value}
                </button>
              </Row>
            )}
          </Show>
          <Show when={props.onManageSongs !== undefined}>
            <Row
              label="Manage songs"
              sub="The studio: your groups, playlists and lyrics"
            >
              <button
                type="button"
                class={styles.optionButton}
                aria-label="Manage songs"
                onClick={() => {
                  props.close()
                  props.onManageSongs?.()
                }}
              >
                Open
              </button>
            </Row>
          </Show>
          <Row label="All settings">
            <button
              type="button"
              class={styles.optionButton}
              aria-label="Open all settings"
              onClick={() => {
                props.close()
                props.onAllSettings()
              }}
            >
              Open
            </button>
          </Row>
        </OptionSection>
      </div>
    </OptionsSheet>
  )
}
