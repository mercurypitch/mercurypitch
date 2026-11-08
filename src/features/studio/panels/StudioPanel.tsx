// Studio panel — one contextual surface, with modal focus behavior on smaller screens.
import type { JSX } from 'solid-js'
import { createEffect, on, onCleanup, onMount } from 'solid-js'
import { X } from '@/components/icons'
import styles from '@/features/studio/StudioPage.module.css'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { createReactiveMatch } from '@/lib/use-viewport'

interface StudioPanelProps {
  title: string
  children: JSX.Element
  footer?: JSX.Element
  onClose(): void
}

export function StudioPanel(props: StudioPanelProps) {
  const overlay = createReactiveMatch(
    '(max-width: 1100px), (pointer: coarse) and (max-height: 500px)',
  )
  let panel: HTMLDivElement | undefined
  let body: HTMLDivElement | undefined
  // What last had the focus in the panel, to tell focus lost with it.
  let focusedInside: Element | null = null
  useFocusTrap(() => panel, { isOpen: overlay, initialFocus: () => panel })
  // The shell stays open while one panel gives way to another (Inputs from
  // the Sound panel's Recording section, say). The new one starts at its
  // top, not at the old one's scroll; and focus lost with the button that
  // opened it comes to the panel. Focus anywhere else stays where it is.
  createEffect(
    on(
      () => props.title,
      () => {
        if (body !== undefined) body.scrollTop = 0
        const lost =
          document.activeElement === null ||
          document.activeElement === document.body
        if (lost && focusedInside?.isConnected === false)
          panel?.focus({ preventScroll: true })
      },
      { defer: true },
    ),
  )
  onMount(() => {
    const opener = document.activeElement
    queueMicrotask(() => {
      if (panel?.isConnected === true) panel.focus({ preventScroll: true })
    })
    onCleanup(() => {
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        panel?.contains(document.activeElement) === true
      )
        opener.focus({ preventScroll: true })
    })
  })

  function keyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    const modal =
      event.target instanceof Element
        ? event.target.closest('[aria-modal="true"]')
        : null
    if (modal !== null && modal !== panel) return
    event.preventDefault()
    event.stopPropagation()
    props.onClose()
  }
  return (
    <div class={styles.panelShade}>
      <div
        ref={panel}
        data-studio-panel
        class={styles.panel}
        role={overlay() ? 'dialog' : 'region'}
        aria-modal={overlay() || undefined}
        aria-label={props.title}
        tabindex="-1"
        on:keydown={keyDown}
        on:focusin={(event) => {
          focusedInside = event.target as Element
        }}
      >
        <div class={styles.panelHeading}>
          <h2>{props.title}</h2>
          <button
            type="button"
            class={styles.iconButton}
            aria-label={`Close ${props.title}`}
            title="Close panel"
            onClick={() => props.onClose()}
          >
            <X />
          </button>
        </div>
        <div ref={body} class={styles.panelBody}>
          {props.children}
        </div>
        {props.footer}
      </div>
    </div>
  )
}
