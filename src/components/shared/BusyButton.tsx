// A button that stays honest while its work is still running.
// ============================================================
//
// Same contract as BusyLink, for the actions that stay on this page: the
// press is acknowledged immediately and the control refuses a second press
// until the first one has finished. `onClick` may return a promise, in which
// case the wait is exactly that promise's lifetime.

import type { JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import styles from './BusyLink.module.css'
import { createPendingAction } from './pending-action'
import { Spinner } from './Spinner'

export interface BusyButtonProps extends Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  /**
   * Returning a promise is what arms the spinner: the wait is that promise's
   * lifetime, no more and no less. A handler with nothing to wait for returns
   * nothing, and the button behaves like any other — which is why this is
   * `unknown` rather than a promise union.
   */
  onClick?: (event: MouseEvent) => unknown
  /** Announced while the work runs. Defaults to "Working…". */
  busyLabel?: string
  spinnerSize?: number | string
  /**
   * Force the busy state from outside, for work this button starts but does
   * not own — a lazily loaded overlay, say, that reports its own readiness.
   */
  busy?: boolean
}

export function BusyButton(props: BusyButtonProps): JSX.Element {
  const [local, buttonProps] = splitProps(props, [
    'onClick',
    'busyLabel',
    'spinnerSize',
    'busy',
    'children',
    'class',
    'type',
    'disabled',
  ])
  const action = createPendingAction()
  const busy = (): boolean => local.busy === true || action.pending()

  const handleClick = (event: MouseEvent): void => {
    if (busy()) return
    const result = local.onClick?.(event)
    if (!(result instanceof Promise)) return
    void action
      .run(() => result)
      .catch(() => {
        // Reporting the failure belongs to whoever started the work; this
        // button owns only the wait, and the wait is over either way. Without
        // this the rejection escapes as an unhandled promise.
      })
  }

  return (
    <button
      {...buttonProps}
      type={local.type ?? 'button'}
      class={[styles.busyLink, local.class].filter(Boolean).join(' ')}
      data-busy={busy() ? 'true' : undefined}
      aria-busy={busy() ? 'true' : undefined}
      disabled={local.disabled === true || busy()}
      onClick={handleClick}
    >
      {local.children}
      <Show when={busy()}>
        <Spinner
          size={local.spinnerSize}
          label={local.busyLabel ?? 'Working…'}
          class={styles.spinner}
        />
      </Show>
    </button>
  )
}
