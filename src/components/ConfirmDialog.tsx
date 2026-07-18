// ============================================================
// ConfirmDialog — small reusable "are you sure?" modal for destructive
// actions. Focus, Tab-cycling, Escape and focus-restore are
// handled by the shared useFocusTrap, matching the app's other modals.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createUniqueId, Show } from 'solid-js'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './ConfirmDialog.module.css'
import { Trash2 } from './icons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** Body copy — plain string or rich JSX (e.g. a bolded name). */
  message: JSX.Element
  /** Confirm button label. Defaults to "Delete". */
  confirmLabel?: string
  /** Icon on the confirm button. Defaults to a trash can (delete actions).
   *  Pass a different icon for non-delete confirms (e.g. replace/overwrite). */
  confirmIcon?: JSX.Element
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
      <div
        class={styles.overlay}
        data-testid="confirm-overlay"
        onClick={() => props.onCancel()}
      >
        <div
          ref={dialogRef}
          class={styles.dialog}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 id={titleId}>{props.title}</h4>
          <p id={bodyId}>{props.message}</p>
          <div class={styles.actions}>
            <button
              class={styles.cancel}
              data-testid="confirm-cancel"
              onClick={() => props.onCancel()}
            >
              Cancel
            </button>
            <button
              class={styles.delete}
              data-testid="confirm-delete"
              onClick={() => props.onConfirm()}
            >
              {props.confirmIcon ?? <Trash2 />} {props.confirmLabel ?? 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
