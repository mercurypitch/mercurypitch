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
  /** Explicit M state, so Solo does not make every other lane look muted. */
  mutedTrackIds?: Accessor<readonly string[]>
  onToggleTrackAudible?(trackId: string): void
  /** Coarse backing-bus state. Per-part mute and Solo choices stay intact. */
  backingMasterEnabled?: Accessor<boolean>
  onToggleBackingMaster?(): void
  soloedTrackId?: Accessor<string | null>
  onToggleTrackSolo?(trackId: string): void
  /** Whether the scored part sounds — owned by the room's Tab sounds control. */
  scoredPartSounds?: Accessor<boolean>
  /** The current take pins pitched backing; drum rows remain live-gated. */
  takeActive?: Accessor<boolean>
  /** True only while the one-clock rehearsal has live per-drum-track gates. */
  percussionControlsLive?: Accessor<boolean>
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
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown, true)
    })
  })

  const tracks = () => props.reference().tracks
  const backingTracks = () =>
    tracks().filter((track) => track.id !== props.reference().trackId)
  const playableBackingTracks = () =>
    backingTracks().filter(
      (track) => track.kind !== 'percussion' || track.supportedHitCount > 0,
    )
  const unavailableDrumCount = () =>
    backingTracks().filter(
      (track) => track.kind === 'percussion' && track.supportedHitCount === 0,
    ).length
  const soloedTrack = () =>
    tracks().find((track) => track.id === props.soloedTrackId?.()) ?? null
  const mutedBackingCount = () =>
    playableBackingTracks().filter((track) =>
      props.mutedTrackIds !== undefined
        ? props.mutedTrackIds().includes(track.id)
        : !(props.audibleTrackIds?.().includes(track.id) ?? false),
    ).length
  const drumReferenceNote = () => {
    const hasDrums = backingTracks().some(
      (track) => track.kind === 'percussion',
    )
    if (!hasDrums) return ''
    const authority =
      props.reference().scoreMode === 'backing-only'
        ? ' Their lanes are authored reference, never guitar scoring targets'
        : ' Drum lanes are readable authored reference, never guitar scoring targets'
    return unavailableDrumCount() > 0
      ? `${authority}; unmapped sounds stay listed but silent.`
      : `${authority}.`
  }
  const withDrumReference = (status: string) =>
    `${status}${drumReferenceNote()}`
  const bandStatus = () => {
    if (props.backingMasterEnabled?.() === false) {
      return withDrumReference(
        'Backing is silent. Your M and Solo choices stay ready for when Backing returns.',
      )
    }
    const soloed = soloedTrack()
    if (soloed !== null) {
      return withDrumReference(
        `Only ${soloed.name} is playing. Turn Solo off to restore the backing mix.`,
      )
    }
    const muted = mutedBackingCount()
    if (muted > 0) {
      return withDrumReference(
        `${muted === 1 ? '1 backing part is' : `${muted} backing parts are`} muted. Mute and Solo changes work while playback runs.`,
      )
    }
    if (props.reference().scoreMode === 'backing-only') {
      return withDrumReference(
        'Supported drum parts play as backing for free play. Use M to mute or S to solo them.',
      )
    }
    return withDrumReference(
      'Backing parts play underneath while you perform the scored part. Use M to mute or S to solo them.',
    )
  }

  return (
    <div class={styles.sessionScrim} data-testid="guitar-night-session-panel">
      <button
        type="button"
        class={styles.sessionScrimButton}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="guitar-night-session-scrim"
        onClick={() => props.onClose()}
      />
      <div
        ref={dialog}
        class={styles.sessionPanel}
        role="dialog"
        aria-modal="true"
        aria-label={
          props.reference().scoreMode === 'backing-only'
            ? 'Loaded arrangement'
            : 'Loaded score'
        }
      >
        <div class={styles.sessionHeader}>
          <div>
            <p class={styles.eyebrow}>
              {props.reference().scoreMode === 'backing-only'
                ? 'Loaded arrangement · free play'
                : 'Loaded score'}
            </p>
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
          aria-label={
            props.reference().scoreMode === 'backing-only'
              ? 'Arrangement parts'
              : 'Score and backing parts'
          }
        >
          <Show
            when={
              playableBackingTracks().length > 0 &&
              props.onToggleBackingMaster !== undefined
            }
          >
            <button
              type="button"
              class={styles.sessionBackingMaster}
              classList={{
                [styles.sessionBackingMasterActive]:
                  props.backingMasterEnabled?.() !== false,
              }}
              aria-pressed={props.backingMasterEnabled?.() !== false}
              aria-label={
                props.backingMasterEnabled?.() === false
                  ? 'Hear selected backing parts'
                  : 'Mute all backing parts'
              }
              onClick={() => props.onToggleBackingMaster?.()}
            >
              <span aria-hidden="true">
                <Show
                  when={props.backingMasterEnabled?.() !== false}
                  fallback={<VolumeX />}
                >
                  <Volume2 />
                </Show>
              </span>
              <span>
                <strong>Backing</strong>
                <small>
                  {props.backingMasterEnabled?.() === false
                    ? 'Silent · part choices kept'
                    : 'Playing · live mix'}
                </small>
              </span>
            </button>
          </Show>
          <For each={tracks()}>
            {(track) => {
              const isPercussion = () => track.kind === 'percussion'
              const isScored = () =>
                !isPercussion() && track.id === props.reference().trackId
              const drumSoundUnavailable = () =>
                track.kind === 'percussion' && track.supportedHitCount === 0
              const drumSheetUnavailable = () =>
                track.kind === 'percussion' && track.hitCount === 0
              // A part you are graded on is a part you can see. The toggle for
              // the scored row is shown but held, rather than hidden, so the
              // rule is visible instead of just enforced.
              const isVisible = () =>
                isScored() ||
                (props.visibleTrackIds?.().includes(track.id) ?? false)
              // The scored part's sound belongs to the room's Tab sounds
              // control, so this row reports it rather than owning it.
              const isAudible = () =>
                drumSoundUnavailable()
                  ? false
                  : isScored()
                    ? (props.scoredPartSounds?.() ?? false)
                    : (props.audibleTrackIds?.().includes(track.id) ?? false)
              const isMuted = () =>
                isScored()
                  ? !isAudible()
                  : (props.mutedTrackIds?.().includes(track.id) ?? !isAudible())
              const isSoloed = () => props.soloedTrackId?.() === track.id
              const anotherTrackIsSoloed = () => {
                const soloed = props.soloedTrackId?.() ?? null
                return soloed !== null && soloed !== track.id
              }
              const isMaskedBySolo = () =>
                !isScored() && !isMuted() && anotherTrackIsSoloed()
              const isMaskedByMaster = () =>
                !isScored() && props.backingMasterEnabled?.() === false
              const soundChangeWaitsForNextTake = () =>
                isPercussion() &&
                (props.takeActive?.() ?? false) &&
                !(props.percussionControlsLive?.() ?? false)
              const partDetail = () => {
                if (track.kind !== 'percussion') {
                  return track.noteCount === 1
                    ? '1 note'
                    : `${track.noteCount} notes`
                }
                const hits =
                  track.hitCount === 1 ? '1 hit' : `${track.hitCount} hits`
                if (track.hitCount === 0) {
                  const dropped =
                    track.droppedHitCount === 1
                      ? '1 unmapped source hit'
                      : `${track.droppedHitCount} unmapped source hits`
                  return `0 hits · drums · ${dropped}`
                }
                if (track.supportedHitCount === 0) {
                  const dropped =
                    track.droppedHitCount > 0
                      ? ` · ${track.droppedHitCount} unmapped`
                      : ''
                  return `${hits} · drums · no available sound${dropped}`
                }
                const partial =
                  track.supportedHitCount < track.hitCount
                    ? ` · ${track.supportedHitCount} currently sound`
                    : ''
                const dropped =
                  track.droppedHitCount > 0
                    ? ` · ${track.droppedHitCount} unmapped`
                    : ''
                return `${hits} · drums · backing only${partial}${dropped}`
              }
              return (
                <div
                  class={styles.sessionTrackRow}
                  classList={{
                    [styles.sessionTrackRowMasked]:
                      isMaskedBySolo() || isMaskedByMaster(),
                  }}
                >
                  <button
                    type="button"
                    data-testid="guitar-night-session-track"
                    data-track-kind={isPercussion() ? 'percussion' : 'pitched'}
                    classList={{ [styles.sessionTrackActive]: isScored() }}
                    aria-pressed={isScored()}
                    disabled={isPercussion()}
                    title={
                      isPercussion()
                        ? `${track.name} is a drum backing part and cannot be scored on the guitar neck`
                        : undefined
                    }
                    onClick={() => {
                      if (!isPercussion()) props.onSelectTrack(track.id)
                    }}
                  >
                    <span>{track.name}</span>
                    <small>
                      {partDetail()}
                      {/* Said outright rather than implied by the highlight:
                          this is the part your playing is graded against. */}
                      <Show when={isScored()}> · scored</Show>
                    </small>
                  </button>
                  <Show when={props.onToggleTrackAudible !== undefined}>
                    <button
                      type="button"
                      class={styles.sessionTrackVisibility}
                      classList={{
                        [styles.sessionTrackMute]: isMuted(),
                        [styles.sessionTrackMasked]:
                          isMaskedBySolo() || isMaskedByMaster(),
                      }}
                      aria-pressed={isMuted()}
                      disabled={
                        isScored() ||
                        drumSoundUnavailable() ||
                        soundChangeWaitsForNextTake()
                      }
                      title={
                        isScored()
                          ? `Use Tab sounds to hear or mute ${track.name}`
                          : drumSoundUnavailable()
                            ? `${track.name} has no drum sounds available yet`
                            : soundChangeWaitsForNextTake()
                              ? `Stop this take to change whether ${track.name} is heard`
                              : isMuted()
                                ? isMaskedByMaster()
                                  ? `Unmute ${track.name}; it will return when Backing is on`
                                  : anotherTrackIsSoloed()
                                    ? `Unmute ${track.name}; it will return when Solo ends`
                                    : `Unmute ${track.name}`
                                : isMaskedByMaster()
                                  ? `${track.name} is quiet while Backing is off`
                                  : isMaskedBySolo()
                                    ? `${track.name} is quiet while ${soloedTrack()?.name ?? 'another part'} is soloed`
                                    : isSoloed()
                                      ? `Mute ${track.name} and end Solo`
                                      : `Mute ${track.name}`
                      }
                      aria-label={
                        drumSoundUnavailable()
                          ? `${track.name} has no drum sounds available yet`
                          : soundChangeWaitsForNextTake()
                            ? `Stop this take to ${isMuted() ? 'unmute' : 'mute'} ${track.name}`
                            : isMuted()
                              ? `Unmute ${track.name}`
                              : `Mute ${track.name}`
                      }
                      onClick={() => props.onToggleTrackAudible?.(track.id)}
                    >
                      <span aria-hidden="true">M</span>
                    </button>
                  </Show>
                  <Show when={props.onToggleTrackSolo !== undefined}>
                    <button
                      type="button"
                      class={styles.sessionTrackVisibility}
                      classList={{ [styles.sessionTrackSolo]: isSoloed() }}
                      aria-pressed={isSoloed()}
                      disabled={
                        isScored() ||
                        drumSoundUnavailable() ||
                        soundChangeWaitsForNextTake()
                      }
                      title={
                        isScored()
                          ? `${track.name} is the scored part`
                          : drumSoundUnavailable()
                            ? `${track.name} has no drum sounds available yet`
                            : soundChangeWaitsForNextTake()
                              ? `Stop this take to change Solo for ${track.name}`
                              : isSoloed()
                                ? props.backingMasterEnabled?.() === false
                                  ? `Turn off Solo for ${track.name}; Backing is currently off`
                                  : `Hear every backing part`
                                : props.backingMasterEnabled?.() === false
                                  ? `Solo ${track.name}; it will sound when Backing is on`
                                  : `Solo ${track.name}`
                      }
                      aria-label={
                        drumSoundUnavailable()
                          ? `${track.name} cannot be soloed because no drum sounds are available`
                          : soundChangeWaitsForNextTake()
                            ? `Stop this take to change solo for ${track.name}`
                            : isSoloed()
                              ? `Turn off solo for ${track.name}`
                              : `Solo ${track.name}`
                      }
                      onClick={() => props.onToggleTrackSolo?.(track.id)}
                    >
                      <span aria-hidden="true">S</span>
                    </button>
                  </Show>
                  <Show when={props.onToggleTrackVisible !== undefined}>
                    <button
                      type="button"
                      class={styles.sessionTrackVisibility}
                      aria-pressed={isVisible()}
                      disabled={isScored() || drumSheetUnavailable()}
                      title={
                        isScored()
                          ? `${track.name} is scored, so it always shows on the sheet`
                          : drumSheetUnavailable()
                            ? `${track.name} has no mapped hits to draw on the sheet`
                            : isVisible()
                              ? `Hide ${track.name} on the sheet`
                              : `Show ${track.name} on the sheet`
                      }
                      aria-label={
                        drumSheetUnavailable()
                          ? `${track.name} has no mapped hits to draw on the sheet`
                          : isVisible()
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
              <p class={styles.sessionNote}>{bandStatus()}</p>
            </Show>
          }
        >
          <p class={styles.sessionNote}>
            {props.reference().scoreMode === 'backing-only'
              ? 'This file carries one authored drum part. Its sheet is reference only; no guitar notes are scored.'
              : 'This file carries one part. A Guitar Pro file with several will list them all here.'}
          </p>
        </Show>
      </div>
    </div>
  )
}
