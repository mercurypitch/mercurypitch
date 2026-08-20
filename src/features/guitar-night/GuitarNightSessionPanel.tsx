// ============================================================
// The session panel — what is loaded, and which part is being read
// ============================================================
//
// Reported 2026-08-19: "the guitar night room, doesn't seem to have a easy way
// to change what is being scored against? what track?" It was changeable, but
// only from the lobby — `GuitarNightApp` renders a "Visible part" group beside
// the attached score and nothing in the room offers it. So a player who picked
// the wrong part had to leave the room to fix it.
//
// This is the first phase of `docs/plans/guitar-night-multi-track-reading.md`,
// and it is deliberately the panel that later phases fill in: the main and
// secondary view assignment, and the scoring override, both land here.

import type { Accessor } from 'solid-js'
import { For, onCleanup, onMount, Show } from 'solid-js'
import { Eye, EyeOff, Volume2, VolumeX, X } from '@/components/icons'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightReference } from './reference-port'

interface GuitarNightSessionPanelProps {
  reference: Accessor<GuitarNightReference>
  onSelectTrack(trackId: string): void
  onClose(): void
  /**
   * Parts the sheet draws. Omitted when the room has no sheet to draw them on,
   * which is what keeps this panel usable before a score is attached.
   */
  visibleTrackIds?: Accessor<readonly string[]>
  onToggleTrackVisible?(trackId: string): void
  /**
   * Parts playing under the player. Reported 2026-08-20: a loaded tab muted
   * every part but the scored one, with nothing anywhere to change it.
   */
  audibleTrackIds?: Accessor<readonly string[]>
  onToggleTrackAudible?(trackId: string): void
  /** Whether the scored part sounds — owned by the room's Tab sounds control. */
  scoredPartSounds?: Accessor<boolean>
}

export function GuitarNightSessionPanel(props: GuitarNightSessionPanelProps) {
  let dialog!: HTMLDivElement
  let closeButton!: HTMLButtonElement

  onMount(() => {
    closeButton.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() =>
      document.removeEventListener('keydown', handleKeyDown, true),
    )
  })

  const tracks = () => props.reference().tracks

  return (
    <div class={styles.sessionScrim} data-testid="guitar-night-session-panel">
      <button
        type="button"
        class={styles.sessionScrimButton}
        aria-label="Close the session details"
        onClick={() => props.onClose()}
      />
      <div
        ref={dialog}
        class={styles.sessionPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Loaded score"
      >
        <div class={styles.sessionHeader}>
          <div>
            <p class={styles.eyebrow}>Loaded score</p>
            <strong>{props.reference().title}</strong>
            <small>
              {props.reference().tempoBpm} BPM ·{' '}
              {tracks().length === 1 ? '1 part' : `${tracks().length} parts`}
            </small>
          </div>
          <button
            ref={closeButton}
            type="button"
            class={styles.sessionClose}
            aria-label="Close the session details"
            onClick={() => props.onClose()}
          >
            <X />
          </button>
        </div>

        <div
          class={styles.sessionTracks}
          role="group"
          aria-label="Part to read and score"
        >
          <For each={tracks()}>
            {(track) => {
              const isScored = () => track.id === props.reference().trackId
              // A part you are graded on is a part you can see. The toggle for
              // the scored row is shown but held, rather than hidden, so the
              // rule is visible instead of just enforced.
              const isVisible = () =>
                isScored() ||
                (props.visibleTrackIds?.().includes(track.id) ?? false)
              // The scored part's sound belongs to the room's Tab sounds
              // control, so this row reports it rather than owning it.
              const isAudible = () =>
                isScored()
                  ? (props.scoredPartSounds?.() ?? false)
                  : (props.audibleTrackIds?.().includes(track.id) ?? false)
              return (
                <div class={styles.sessionTrackRow}>
                  <button
                    type="button"
                    data-testid="guitar-night-session-track"
                    classList={{ [styles.sessionTrackActive]: isScored() }}
                    aria-pressed={isScored()}
                    onClick={() => props.onSelectTrack(track.id)}
                  >
                    <span>{track.name}</span>
                    <small>
                      {track.noteCount === 1
                        ? '1 note'
                        : `${track.noteCount} notes`}
                      {/* Said outright rather than implied by the highlight:
                          this is the part your playing is graded against. */}
                      <Show when={isScored()}> · scored</Show>
                    </small>
                  </button>
                  <Show when={props.onToggleTrackAudible !== undefined}>
                    <button
                      type="button"
                      class={styles.sessionTrackVisibility}
                      aria-pressed={isAudible()}
                      disabled={isScored()}
                      title={
                        isScored()
                          ? `Use Tab sounds to hear or mute ${track.name}`
                          : isAudible()
                            ? `Mute ${track.name}`
                            : `Hear ${track.name}`
                      }
                      aria-label={
                        isAudible()
                          ? `Mute ${track.name}`
                          : `Hear ${track.name}`
                      }
                      onClick={() => props.onToggleTrackAudible?.(track.id)}
                    >
                      <Show when={isAudible()} fallback={<VolumeX />}>
                        <Volume2 />
                      </Show>
                    </button>
                  </Show>
                  <Show when={props.onToggleTrackVisible !== undefined}>
                    <button
                      type="button"
                      class={styles.sessionTrackVisibility}
                      aria-pressed={isVisible()}
                      disabled={isScored()}
                      title={
                        isScored()
                          ? `${track.name} is scored, so it always shows on the sheet`
                          : isVisible()
                            ? `Hide ${track.name} on the sheet`
                            : `Show ${track.name} on the sheet`
                      }
                      aria-label={
                        isVisible()
                          ? `Hide ${track.name} on the sheet`
                          : `Show ${track.name} on the sheet`
                      }
                      onClick={() => props.onToggleTrackVisible?.(track.id)}
                    >
                      <Show when={isVisible()} fallback={<EyeOff />}>
                        <Eye />
                      </Show>
                    </button>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>

        <Show
          when={tracks().length === 1}
          fallback={
            <Show when={props.onToggleTrackAudible !== undefined}>
              <p class={styles.sessionNote}>
                Every part but the one you are scored on plays underneath, so
                yours is the one to play. Mute any of them here.
              </p>
            </Show>
          }
        >
          <p class={styles.sessionNote}>
            This file carries one part. A Guitar Pro file with several will list
            them all here.
          </p>
        </Show>
      </div>
    </div>
  )
}
