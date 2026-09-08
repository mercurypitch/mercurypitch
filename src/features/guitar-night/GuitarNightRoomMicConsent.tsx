// Shared room-mic admission explains audible-guide contamination before scoring starts.
// ============================================================
import type { Accessor } from 'solid-js'
import { createUniqueId, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { Headphones } from '@/components/icons'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './GuitarNightApp.module.css'

export function GuitarNightRoomMicConsent(props: {
  open: boolean
  onContinue(): void
  onMute(): void
  onCancel(): void
  returnFocus?: Accessor<HTMLElement | null>
}) {
  let panel: HTMLElement | undefined
  let primary: HTMLButtonElement | undefined
  const id = createUniqueId()
  const close = (action: () => void) => {
    const target = props.returnFocus?.() ?? null
    action()
    queueMicrotask(() => {
      if (target?.isConnected === true) target.focus({ preventScroll: true })
    })
  }
  useFocusTrap(() => panel, {
    isOpen: () => props.open,
    onClose: () => close(props.onCancel),
    initialFocus: () => primary,
  })
  return (
    <Show when={props.open}>
      <Portal>
        <div
          class={styles.roomMicConsentScrim}
          style={{
            '--ivory': '#f4eadb',
            '--faceplate': '#15110d',
            '--touch-target': '44px',
            '--amber-bright': '#f4cb8e',
            'z-index': '1200',
          }}
        >
          <button
            type="button"
            class={styles.roomMicConsentBackdrop}
            aria-label="Cancel Room mic score"
            onClick={() => close(props.onCancel)}
          />
          <section
            ref={panel}
            class={styles.roomMicConsentPanel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-detail`}
          >
            <span class={styles.roomMicConsentIcon} aria-hidden="true">
              <Headphones />
            </span>
            <div class={styles.roomMicConsentCopy}>
              <p class={styles.eyebrow}>Room mic · score check</p>
              <h2 id={`${id}-title`}>Keep this take honest.</h2>
              <p id={`${id}-detail`}>
                Your Target, Backing, or Click is audible. Speakers can enter
                the Room mic and raise the score. Continue with headphones, or
                accept that this take may be inaccurate.
              </p>
            </div>
            <div class={styles.roomMicConsentActions}>
              <button
                ref={primary}
                type="button"
                class={styles.roomMicConsentPrimary}
                onClick={() => close(props.onContinue)}
              >
                Continue with this mix
              </button>
              <button type="button" onClick={() => close(props.onMute)}>
                Mute room audio &amp; score
              </button>
              <button type="button" onClick={() => close(props.onCancel)}>
                Not now
              </button>
            </div>
          </section>
        </div>
      </Portal>
    </Show>
  )
}
