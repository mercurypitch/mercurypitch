// ============================================================
// useConfirm — drive a single ConfirmDialog from imperative code
// ============================================================
//
// Pairs with <ConfirmDialog>. Lets a component replace a synchronous
// window.confirm() with the app's styled modal: call request({...}) where
// you would have branched on confirm(), and run the follow-up work in
// onConfirm. One controller can serve many call sites (the last request
// wins) so a component needs only one dialog instance.

import type { Accessor, JSX } from 'solid-js'
import { createSignal } from 'solid-js'

export interface ConfirmRequest {
  title: string
  /** Body copy — plain string or rich JSX (e.g. a bolded name). */
  message: JSX.Element
  /** Confirm button label. Defaults to ConfirmDialog's own default. */
  confirmLabel?: string
  /** Confirm button icon. Defaults to ConfirmDialog's trash can. */
  confirmIcon?: JSX.Element
  /** Run when the user confirms. */
  onConfirm: () => void
}

export interface ConfirmController {
  /** The active request, or null when the dialog is closed. */
  pending: Accessor<ConfirmRequest | null>
  /** Open the dialog with a request. */
  request: (req: ConfirmRequest) => void
  /** Confirm: close the dialog and run its onConfirm. */
  accept: () => void
  /** Dismiss the dialog without running onConfirm. */
  cancel: () => void
}

export function useConfirm(): ConfirmController {
  const [pending, setPending] = createSignal<ConfirmRequest | null>(null)
  const request = (req: ConfirmRequest): void => {
    setPending(req)
  }
  const accept = (): void => {
    const req = pending()
    setPending(null)
    req?.onConfirm()
  }
  const cancel = (): void => {
    setPending(null)
  }
  return { pending, request, accept, cancel }
}
