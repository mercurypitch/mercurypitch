// ============================================================
// ConfirmDialog — small reusable "are you sure?" modal for destructive
// actions. Mirrors the session-delete prompt (it reuses the global
// .delete-confirm-* styles in uvr.css), so every confirm in the app
// reads the same. Focus, Tab-cycling, Escape and focus-restore are
// handled by the shared useFocusTrap, matching the app's other modals.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createUniqueId, Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { Trash2 } from './icons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Body copy — plain string or rich JSX (e.g. a bolded name). */
  message: JSX.Element
  /** Confirm button label. Defaults to "Delete". */
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const bodyId = createUniqueId()

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: () => props.onCancel(),
  })

  return (
    <Show when={props.open}>
      <div class="delete-confirm-overlay" onClick={() => props.onCancel()}>
        <div
          ref={dialogRef}
          class="delete-confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 id={titleId}>{props.title}</h4>
          <p id={bodyId}>{props.message}</p>
          <div class="delete-confirm-actions">
            <button
              class="delete-confirm-cancel"
              onClick={() => props.onCancel()}
            >
              Cancel
            </button>
            <button
              class="delete-confirm-delete"
              onClick={() => props.onConfirm()}
            >
              <Trash2 /> {props.confirmLabel ?? 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
