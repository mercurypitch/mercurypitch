// ============================================================
// KeepAlert — the one question a run ever asks
// ============================================================
//
// Shown by Stop, and only when a room says a take the singer has not kept is
// on screen. No room says so today (`src/stores/native-shell-store.ts`), so
// today Stop simply stops — an alert on every Stop whose two answers do the
// same thing teaches a promise the app does not keep.
//
// Copy from the deck, verbatim; both answers end the run. Escape and system
// back dismiss it and leave the run exactly where it was, which is why this
// is not a ConfirmDialog: there, cancelling would have meant discarding.
//
// Rendered in place inside `ShellRoot` rather than through its own portal, so
// the shell's motion tokens — the reduced-motion set included — reach it.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'

export interface KeepAlertProps {
  open: () => boolean
  onDiscard: () => void
  onKeep: () => void
}

export const KeepAlert: Component<KeepAlertProps> = (props) => {
  let alertRef: HTMLDivElement | undefined
  useFocusTrap(() => alertRef, { isOpen: () => props.open() })

  return (
    <Show when={props.open()}>
      <div class="mp-alert-scrim">
        <div
          class="mp-alert"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="shell-keep-title"
          aria-describedby="shell-keep-text"
          ref={alertRef}
          data-testid="shell-keep-alert"
        >
          <div class="mp-alert__body">
            <div class="mp-alert__title" id="shell-keep-title">
              Keep this take?
            </div>
            <div class="mp-alert__text" id="shell-keep-text">
              Keep stores it on this phone. Nothing uploaded.
            </div>
          </div>
          <div class="mp-alert__actions">
            <button type="button" onClick={() => props.onDiscard()}>
              Discard
            </button>
            <button type="button" onClick={() => props.onKeep()}>
              Keep
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
