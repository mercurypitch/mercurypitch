// ============================================================
// WebRoomHost: an exercise room, on the web
// ============================================================
//
// The native shell pushes a room as a full-bleed screen: a bar over the
// art with Back and the room's name, and a slot on its right that the room
// fills with its level pill and its "?" (PushedScreen.tsx in the native
// app). This is the web's frame, and it gives a room the same three things:
//
//   - the whole window, over the app's own bars, on a dark stage whatever
//     the app's theme (dark-stage.css), since a room's world is always dark;
//   - the bar, whose right side it registers as the slot the room kit draws
//     into (`registerPushedBarEnd`);
//   - a way out: Back, Escape, and the room's own Done.
//
// One room can open another over itself: the Warm-up's path opens each
// stop's room, as the native shell pushes it over the path. The bar then
// names the room on top, and Back, Escape and that room's own end close it
// alone, back to the path; from the path they leave.
//
// Portalled to the body: a `position: fixed` box inside a transformed
// ancestor is fixed to that ancestor and not to the window, and the app's
// panels are free to animate.

import type { JSX } from 'solid-js'
import { createEffect, createSignal, on, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import { Dynamic, Portal } from 'solid-js/web'
import '@/styles/dark-stage.css'
import { ChevronLeft } from '@/components/icons'
import { registerPushedBarEnd } from '@/stores/native-shell-store'
import type { WebRoomId } from './web-room-ids'
import { webRoomName } from './web-room-list'
import { WEB_ROOM_SCREENS } from './web-room-screens'
import styles from './WebRoomHost.module.css'

export interface WebRoomHostProps {
  /** The room to open. */
  id: WebRoomId
  /** The singer leaves: Back, Escape, or the room's own Done. */
  onBack: () => void
  /** The singer leaves for a song: "Sing a song", at the Warm-up's end. */
  onSong: () => void
}

/** On the page while a room is open, so the page under it does not scroll. */
const OPEN_CLASS = 'web-room-open'

export default function WebRoomHost(props: WebRoomHostProps): JSX.Element {
  let title: HTMLHeadingElement | undefined
  /** A room opened over this one: a Warm-up stop over its path. */
  const [over, setOver] = createSignal<WebRoomId | null>(null)
  /** The room on top, which the bar names. */
  const shown = (): WebRoomId => over() ?? props.id
  /** Back: the room on top closes, back to the one under it, or the singer leaves. */
  const back = (): void => {
    if (over() === null) props.onBack()
    else setOver(null)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    // Escape does what Back does. A field of the room's own (Long note's
    // note picker) takes its Escape first: it stops the key there.
    if (event.key === 'Escape' && !event.defaultPrevented) back()
  }

  onMount(() => {
    document.documentElement.classList.add(OPEN_CLASS)
    document.addEventListener('keydown', onKeyDown)
    // The page's focus was on the card that opened the room, which is now
    // under it. It goes to the room's name, as the native shell hands it to
    // a pushed screen's title: on Back, a Space or an Enter meant for the
    // room would leave it.
    title?.focus({ preventScroll: true })
  })
  onCleanup(() => {
    document.documentElement.classList.remove(OPEN_CLASS)
    document.removeEventListener('keydown', onKeyDown)
  })
  // A room opened over another, or closed back to it: the focus goes to the
  // name of the one now on top, as it did on the way in.
  createEffect(
    on(over, () => title?.focus({ preventScroll: true }), { defer: true }),
  )

  return (
    <Portal>
      <div
        class={`${styles.host} mp-dark-stage`}
        role="group"
        aria-label={webRoomName(shown())}
        data-testid="web-room"
        data-room={shown()}
      >
        <div class={styles.bar}>
          <button
            type="button"
            class={styles.back}
            aria-label="Back"
            data-testid="web-room-back"
            onClick={back}
          >
            <ChevronLeft />
          </button>
          <h2 ref={title} class={styles.title} tabindex="-1">
            {webRoomName(shown())}
          </h2>
          <div
            class={styles.end}
            ref={(el) => onCleanup(registerPushedBarEnd(el))}
            data-testid="web-room-end"
          />
        </div>
        <div class={styles.body}>
          <Show when={WEB_ROOM_SCREENS[shown()]}>
            {(Screen) => (
              <Suspense
                fallback={
                  <p class={styles.loading} role="status">
                    Opening the room
                  </p>
                }
              >
                <Dynamic
                  component={Screen()}
                  onDone={back}
                  onOpenRoom={setOver}
                  onSong={() => props.onSong()}
                />
              </Suspense>
            )}
          </Show>
        </div>
      </div>
    </Portal>
  )
}
