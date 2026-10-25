// ============================================================
// ConfirmDialog — small reusable "are you sure?" modal for destructive
// actions. Focus, Tab-cycling, Escape and focus-restore are
// handled by the shared useFocusTrap, matching the app's other modals.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, createUniqueId, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { isolateKeys } from '@/lib/keyboard-isolation'
import { useFocusTrap } from '@/lib/use-focus-trap'
import styles from './ConfirmDialog.module.css'
import { Trash2 } from './icons'
import { createPortalSkinBridge } from './portal-skin'

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
  /**
   * `danger` (default) paints the confirm button in the destructive red;
   * `primary` is for a consent or a commitment that destroys nothing, where
   * red would read as a warning against the very thing being offered.
   */
  tone?: 'danger' | 'primary'
  /** A third, labelled way out beside Cancel (e.g. "Sing as practice"). */
  secondaryLabel?: string
  onSecondary?: () => void
  /** Cancel's label. Defaults to "Cancel"; the layout is the variant's. */
  cancelLabel?: string
  /**
   * `stay` is for a confirm that talks someone out of leaving: Cancel takes
   * the focus and is the one primary, full width, and the confirm sits under
   * it as a quiet text button with no icon (`tone` is not read). `confirm`,
   * the default, is the usual Cancel and confirm pair.
   */
  variant?: 'confirm' | 'stay'
  /** Lines listed under the message, outside its paragraph, and read with
   *  it as the dialog's description. None, or an empty list, shows nothing. */
  details?: readonly string[]
  /**
   * Every key stays at the dialog unless this is false, so the app's shortcuts
   * on the window cannot act behind it: a Space would play the tab behind and
   * swallow a button's activation. The type-to-confirm input's Enter is a
   * native listener on the input, so it works with this too. Pass false only
   * for a message whose own controls take keys through Solid's `onKeyDown`,
   * which a stopped key never reaches.
   */
  isolateKeyboard?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: Component<ConfirmDialogProps> = (props) => {
  let dialogRef: HTMLDivElement | undefined
  const titleId = createUniqueId()
  const bodyId = createUniqueId()
  const phraseId = createUniqueId()
  const detailsId = createUniqueId()
  let keepRef: HTMLButtonElement | undefined
  const [typed, setTyped] = createSignal('')
  const portalSkin = createPortalSkinBridge(() => props.open)

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

  const secondary = (): void => {
    if (props.busy !== true) props.onSecondary?.()
  }

  const stay = (): boolean => props.variant === 'stay'
  // The trap is read as `isolateKeyboard: isolateKeys` unless a caller passes false.
  const isolated = (): boolean => props.isolateKeyboard !== false
  const listed = (): boolean => (props.details?.length ?? 0) > 0

  useFocusTrap(() => dialogRef, {
    isOpen: () => props.open,
    onClose: cancel,
    // A getter: the trap reads it as it opens, and again if the prop changes.
    get isolateKeyboard() {
      return isolated() ? isolateKeys : undefined
    },
    initialFocus: () => (stay() ? keepRef : undefined),
  })

  return (
    <>
      <span ref={portalSkin.anchorRef} hidden aria-hidden="true" />
      <Show when={props.open}>
        {/* Portal to <body>: the overlay is position:fixed, and any transformed
            ancestor (the settings panel slides in with translate) would turn
            "fixed" into ancestor-relative and displace the whole dialog. */}
        <Portal>
          <div
            class={styles.overlay}
            style={portalSkin.style()}
            data-testid="confirm-overlay"
            onClick={cancel}
          >
            <div
              ref={dialogRef}
              class={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              // Takes focus from a press on its words, never from Tab, so the
              // keys after it stay inside the trap (keyboard-isolation.ts).
              tabIndex={isolated() ? -1 : undefined}
              aria-labelledby={titleId}
              aria-describedby={listed() ? `${bodyId} ${detailsId}` : bodyId}
              aria-busy={props.busy === true ? true : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 id={titleId}>{props.title}</h4>
              <p id={bodyId}>{props.message}</p>
              <Show when={listed()}>
                <ul id={detailsId} class={styles.details}>
                  <For each={props.details}>{(line) => <li>{line}</li>}</For>
                </ul>
              </Show>
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
                  // Native, on the input: heard inside a trap that keeps every
                  // key at the dialog, where a delegated onKeyDown is not.
                  on:keydown={(e) => {
                    if (e.key === 'Enter') confirm()
                  }}
                />
              </Show>
              <div
                class={styles.actions}
                classList={{ [styles.stacked]: stay() }}
              >
                <button
                  ref={keepRef}
                  type="button"
                  class={stay() ? styles.keep : styles.cancel}
                  data-testid="confirm-cancel"
                  disabled={props.busy}
                  onClick={cancel}
                >
                  {props.cancelLabel ?? 'Cancel'}
                </button>
                <Show when={props.secondaryLabel != null}>
                  <button
                    type="button"
                    class={styles.secondary}
                    data-testid="confirm-secondary"
                    disabled={props.busy}
                    onClick={secondary}
                  >
                    {props.secondaryLabel}
                  </button>
                </Show>
                <button
                  type="button"
                  classList={{
                    [styles.delete]: !stay() && props.tone !== 'primary',
                    [styles.primary]: !stay() && props.tone === 'primary',
                    [styles.quiet]: stay(),
                  }}
                  data-testid="confirm-delete"
                  disabled={props.busy === true || !phraseSatisfied()}
                  onClick={confirm}
                >
                  <Show when={!stay()}>{props.confirmIcon ?? <Trash2 />} </Show>
                  {props.confirmLabel ?? 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}
