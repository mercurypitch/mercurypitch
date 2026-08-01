// ============================================================
// ConfirmDialog — small reusable "are you sure?" modal for destructive
// actions. Focus, Tab-cycling, Escape and focus-restore are
// handled by the shared useFocusTrap, matching the app's other modals.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
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
  /** Prevent dismissal and duplicate submissions while work is in progress. */
  busy?: boolean
  /** Icon on the confirm button. Defaults to a trash can (delete actions).
   *  Pass a different icon for non-delete confirms (e.g. replace/overwrite). */
  confirmIcon?: JSX.Element
  /**
   * Require the exact word to be typed before Confirm enables. For the
   * unrecoverable actions where a reflex click is the real risk — an
   * ordinary confirm button is one keystroke away from an accident.
   * Matching ignores case and surrounding whitespace, nothing else.
   */
  confirmPhrase?: string
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const bodyId = createUniqueId()
  const phraseId = createUniqueId()
  const [typed, setTyped] = createSignal('')

  // Reopening must not inherit the previous attempt's typed text, or the
  // second delete would be a single click.
  createEffect(() => {
    if (props.open) setTyped('')
  })

  const phraseSatisfied = (): boolean =>
    props.confirmPhrase == null ||
    typed().trim().toLowerCase() === props.confirmPhrase.toLowerCase()

  const cancel = (): void => {
    if (props.busy !== true) props.onCancel()
  }

  const confirm = (): void => {
    if (props.busy === true || !phraseSatisfied()) return
    props.onConfirm()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: cancel,
  })

  return (
    <Show when={props.open}>
      {/* Portal to <body>: the overlay is position:fixed, and any transformed
          ancestor (the settings panel slides in with translate) would turn
          "fixed" into ancestor-relative and displace the whole dialog. */}
      <Portal>
        <div
          class={styles.overlay}
          data-testid="confirm-overlay"
          onClick={cancel}
        >
          <div
            ref={dialogRef}
            class={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            aria-busy={props.busy === true ? true : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 id={titleId}>{props.title}</h4>
            <p id={bodyId}>{props.message}</p>
            <Show when={props.confirmPhrase != null}>
              <label class={styles.phraseLabel} for={phraseId}>
                Type <strong>{props.confirmPhrase}</strong> to confirm
              </label>
              <input
                id={phraseId}
                class={styles.phraseInput}
                type="text"
                autocomplete="off"
                autocapitalize="none"
                spellcheck={false}
                value={typed()}
                disabled={props.busy}
                data-testid="confirm-phrase"
                onInput={(e) => setTyped(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirm()
                }}
              />
            </Show>
            <div class={styles.actions}>
              <button
                type="button"
                class={styles.cancel}
                data-testid="confirm-cancel"
                disabled={props.busy}
                onClick={cancel}
              >
                Cancel
              </button>
              <button
                type="button"
                class={styles.delete}
                data-testid="confirm-delete"
                disabled={props.busy === true || !phraseSatisfied()}
                onClick={confirm}
              >
                {props.confirmIcon ?? <Trash2 />}{' '}
                {props.confirmLabel ?? 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
