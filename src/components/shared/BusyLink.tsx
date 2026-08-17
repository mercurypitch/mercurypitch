// A link to another document that admits it heard you.
// ============================================================
//
// Guitar Night, Karaoke Night, Piano Night, the Mirror and Glass are separate
// entry points, so opening one is a full document load — on a slow connection
// several seconds of a page that looks exactly as it did before the tap. The
// anchor stays an anchor (middle-click, open-in-new-tab and copy-link all
// still work); it just shows a spinner once the click it is actually
// responsible for has happened.

import type { JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import styles from './BusyLink.module.css'
import { clickNavigatesThisPage, createPendingAction } from './pending-action'
import { Spinner } from './Spinner'

export interface BusyLinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Announced while the next page loads. Defaults to "Opening…". */
  busyLabel?: string
  /** Diameter of the spinner; matches the surrounding text by default. */
  spinnerSize?: number | string
}

export function BusyLink(props: BusyLinkProps): JSX.Element {
  const [local, anchorProps] = splitProps(props, [
    'busyLabel',
    'spinnerSize',
    'children',
    'class',
    'onClick',
  ])
  const navigation = createPendingAction()

  const handleClick: JSX.EventHandler<HTMLAnchorElement, MouseEvent> = (
    event,
  ) => {
    const handler = local.onClick
    if (typeof handler === 'function') handler(event)
    else if (Array.isArray(handler)) handler[0](handler[1], event)
    if (clickNavigatesThisPage(event, props.target)) navigation.begin()
  }

  return (
    <a
      {...anchorProps}
      class={[styles.busyLink, local.class].filter(Boolean).join(' ')}
      data-busy={navigation.pending() ? 'true' : undefined}
      aria-busy={navigation.pending() ? 'true' : undefined}
      onClick={handleClick}
    >
      {local.children}
      <Show when={navigation.pending()}>
        <Spinner
          size={local.spinnerSize}
          label={local.busyLabel ?? 'Opening…'}
          class={styles.spinner}
        />
      </Show>
    </a>
  )
}
