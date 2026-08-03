// ── JamTransferDialog ─────────────────────────────────────────────────
// What is happening to the song, said loudly enough to notice.
//
// The progress used to be a thin strip wedged under the transport, which
// is the one place nobody looks while waiting for something: it reads as
// part of the player rather than as a thing in flight. Sending a song is
// the longest operation in the room and the only one that can fail for
// reasons the other person needs explaining, so it gets a real surface.
//
// Not blocking, though. It floats, it can be pushed to the background, and
// the header keeps a live chip so dismissing it never means losing track.

import type { Component } from 'solid-js'
import { createEffect, For, Match, Show, Switch } from 'solid-js'
import { cancelJamSongShare, dismissJamShareNotice, jamIsHost, jamPeersMissingSong, jamShareState, jamTransferMinimised, setJamTransferMinimised, shareJamSongWithRoom, } from '@/stores/jam-store'
import styles from './JamTransferDialog.module.css'

/** A ring that spins. Not an emoji, and not a GIF: one element, one rule. */
const Spinner: Component = () => (
  <svg class={styles.spinner} viewBox="0 0 24 24" aria-hidden="true">
    <circle class={styles.spinnerTrack} cx="12" cy="12" r="9" />
    <circle class={styles.spinnerHead} cx="12" cy="12" r="9" />
  </svg>
)

const TickIcon: Component = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M3 8.5l3.2 3.2L13 5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
)

export const JamTransferDialog: Component = () => {
  const state = () => jamShareState()
  const busy = () =>
    state().phase === 'encoding' ||
    state().phase === 'sending' ||
    state().phase === 'receiving'

  /**
   * A NEW transfer shows itself. A running one never does again.
   *
   * This used to open on any encoding/receiving phase, and the phase does
   * not change while a transfer runs -- it just reports progress. So the
   * effect re-ran on every chunk and undid "Continue in background"
   * immediately, then again for the guide vocal, then again at the end.
   * Pushing something away has to mean something, so the trigger is the
   * EDGE into a transfer, and the header chip carries the rest.
   */
  let wasBusy = false
  createEffect(() => {
    const nowBusy = busy()
    if (nowBusy && !wasBusy) setJamTransferMinimised(false)
    wasBusy = nowBusy
  })

  const open = () => state().phase !== 'idle' && !jamTransferMinimised()

  /** What the room is doing, in the order it does it. */
  const steps = () => {
    const p = state().phase
    return [
      {
        label: 'Packing the song',
        done: p === 'sending' || p === 'done',
        active: p === 'encoding',
      },
      {
        label: jamIsHost() ? 'Sending to the room' : 'Receiving',
        done: p === 'done',
        active: p === 'sending' || p === 'receiving',
      },
    ]
  }

  return (
    <Show when={open()}>
      <div class={styles.wrap} role="dialog" aria-live="polite">
        <div class={styles.card}>
          <div class={styles.head}>
            <Switch>
              <Match when={busy()}>
                <Spinner />
              </Match>
              <Match when={state().phase === 'done'}>
                <span class={styles.tick}>
                  <TickIcon />
                </span>
              </Match>
            </Switch>
            <span class={styles.title}>
              <Switch fallback="Song transfer">
                <Match when={state().phase === 'encoding'}>
                  Preparing the song
                </Match>
                <Match when={state().phase === 'sending'}>
                  Sending to the room
                </Match>
                <Match when={state().phase === 'receiving'}>
                  Getting the song
                </Match>
                <Match when={state().phase === 'done'}>Ready</Match>
                <Match when={state().phase === 'error'}>
                  That did not work
                </Match>
              </Switch>
            </span>
          </div>

          <Show when={busy()}>
            <div class={styles.bar}>
              <div
                class={styles.fill}
                style={{ width: `${Math.round(state().ratio * 100)}%` }}
              />
            </div>
            {/* The steps, so a long encode does not look like a stall --
                "packing" and "sending" take very different times and only
                one of them is network-bound. */}
            <ul class={styles.steps}>
              <For each={steps()}>
                {(s) => (
                  <li
                    class={styles.step}
                    classList={{
                      [styles.stepDone]: s.done,
                      [styles.stepActive]: s.active,
                    }}
                  >
                    <span class={styles.stepDot} />
                    {s.label}
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <p
            class={styles.message}
            classList={{ [styles.messageError]: state().phase === 'error' }}
          >
            {state().message}
          </p>

          <div class={styles.actions}>
            <Show when={busy()}>
              <button
                type="button"
                class={styles.ghost}
                onClick={() => setJamTransferMinimised(true)}
              >
                Continue in background
              </button>
              <Show when={jamIsHost() && state().phase !== 'receiving'}>
                <button
                  type="button"
                  class={styles.ghost}
                  onClick={cancelJamSongShare}
                >
                  Stop
                </button>
              </Show>
            </Show>
            <Show when={!busy()}>
              {/* Reachable where the outcome is read. A send that finished
                  is not proof anybody received one -- a phone asleep
                  through the transfer says nothing -- so the host gets the
                  retry in the same place they are told it is done, rather
                  than having to find the header chip. */}
              <Show when={jamIsHost() && jamPeersMissingSong().length > 0}>
                <button
                  type="button"
                  class={styles.ghost}
                  onClick={() => void shareJamSongWithRoom(true)}
                >
                  Send again to {jamPeersMissingSong().length}
                </button>
              </Show>
              {/* Closing a finished transfer puts it away for good --
                  minimising it would leave a "Song ready" chip in the
                  header with nothing left to say. */}
              <button
                type="button"
                class={styles.primary}
                onClick={dismissJamShareNotice}
              >
                Close
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}

/**
 * The header chip, for when the dialog has been pushed away.
 *
 * Lives beside Copy link because that is where the room's own controls
 * are, and a transfer is a room-level thing rather than part of the
 * player. Tapping it brings the dialog back.
 */
export const JamTransferChip: Component = () => {
  const state = () => jamShareState()
  const busy = () =>
    state().phase === 'encoding' ||
    state().phase === 'sending' ||
    state().phase === 'receiving'

  return (
    <Show when={state().phase !== 'idle' && jamTransferMinimised()}>
      <button
        type="button"
        class={styles.chip}
        classList={{ [styles.chipError]: state().phase === 'error' }}
        title={state().message}
        onClick={() => setJamTransferMinimised(false)}
      >
        <Show when={busy()} fallback={<TickIcon />}>
          <Spinner />
        </Show>
        <span class={styles.chipText}>
          <Show when={busy()} fallback="Song ready">
            {Math.round(state().ratio * 100)}%
          </Show>
        </span>
      </button>
    </Show>
  )
}
