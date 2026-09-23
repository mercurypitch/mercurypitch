// ============================================================
// JamRoomKey — the room's key, beside the playback capsule
// ============================================================
//
// The host moves it and every peer's own audio follows (see
// lib/jam/jam-key-shift.ts).
//
// In the row it is one small chip, "Key +2", because the row belongs to the
// timeline: a tablet on its side has none to spare, and the full stepper
// took 110px of it. The host taps the chip to open the stepper out where it
// stands, the way the song's name opens in the header (JamNowSinging) -- no
// popover, because on a phone the row scrolls sideways and would clip one.
// A tap anywhere else, or Escape, folds it away again.
//
// A guest sees the chip only once the key has moved, with nothing to press:
// a "0" nobody can change is noise in a row that is already full on a phone.

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { KeyShiftControl } from '@/components/key-shift/KeyShiftControl'
import { formatKeyShift } from '@/lib/key-shift/key-shift'
import { jamIsHost, jamIsSongRoom, jamKeyShiftAvailable, jamRoomKeyShift, setJamRoomKeyShift, } from '@/stores/jam-store'
import styles from './JamRoomKey.module.css'

const UNAVAILABLE = 'Changing the key is not available on this device'

export const JamRoomKey: Component = () => {
  const [open, setOpen] = createSignal(false)
  let root: HTMLDivElement | undefined

  // Open, it folds away on a tap anywhere but itself, and on Escape.
  createEffect(() => {
    if (!open()) return
    const onPointerDown = (event: Event) => {
      const target = event.target
      if (!(target instanceof Node) || root?.contains(target) !== true)
        setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    })
  })

  const reason = () => (jamKeyShiftAvailable() ? undefined : UNAVAILABLE)
  const face = (): JSX.Element => (
    <>
      <span class={styles.caption}>Key</span>
      <span class={styles.value}>{formatKeyShift(jamRoomKeyShift())}</span>
    </>
  )

  return (
    <Show when={jamIsSongRoom() && (jamIsHost() || jamRoomKeyShift() !== 0)}>
      <div class={styles.roomKey} ref={root} data-testid="jam-room-key">
        <Show
          when={jamIsHost()}
          fallback={
            <span
              class={styles.chip}
              classList={{ [styles.moved]: jamRoomKeyShift() !== 0 }}
              title={reason()}
            >
              {face()}
            </span>
          }
        >
          <button
            type="button"
            class={styles.chip}
            classList={{ [styles.moved]: jamRoomKeyShift() !== 0 }}
            aria-label={`Room key ${formatKeyShift(jamRoomKeyShift())}`}
            aria-expanded={open()}
            title={reason() ?? 'Change the key the room sings in'}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            {face()}
          </button>
          <Show when={open()}>
            <KeyShiftControl
              value={jamRoomKeyShift()}
              onChange={setJamRoomKeyShift}
              disabledReason={reason()}
            />
          </Show>
        </Show>
      </div>
    </Show>
  )
}
