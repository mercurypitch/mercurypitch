// ============================================================
// StageShell — the mobile full-screen stage container.
// ============================================================
//
// The root every mobile stage renders into (mobile-kit.md §2), extracted
// from KaraokeMobileStage. It owns exactly the viewport mechanics:
//
//  - Portal to <body>: no filtered/transformed ancestor can capture the
//    fixed box (the bug that motivated the karaoke portal).
//  - 100dvh with a 100vh fallback: tracks the collapsing mobile URL bar.
//  - Body scroll lock (counted — safe to stack with sheets/modals).
//  - Safe-area top padding; z-index from the --z-stage token.
//  - The page it covers is inert while it is up, and focus moves into it
//    and back out of it, as for any modal surface (see isolateFromPage).
//
// It owns NO audio and no layout beyond "flex column": engines stay above
// the responsive branch (convention #1), children bring their own chrome.
// Skinning is custom-property-based (convention #8): stages set
// --stage-bg / --stage-color (and any kit-primitive --pill-*/--sheet-*
// overrides) in the class they pass via `class`.

import type { Component, JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useScrollLock } from '@/lib/use-scroll-lock'
import styles from './StageShell.module.css'

interface StageShellProps {
  class?: string
  style?: JSX.CSSProperties
  testId?: string
  /** What the stage is, for assistive technology: the song being sung. */
  label?: string
  children: JSX.Element
}

/**
 * Take the page the stage covers out of the tab order and the accessibility
 * tree, and put focus on the stage. Returns the undo.
 *
 * The stage is a sibling of #app (it portals to <body>), so without this the
 * whole app stayed live behind it: the first Tab went to the hidden voice
 * pill, and after the stage's last control focus walked into the header, the
 * tabs and the sidebar under the stage, where a blind Enter left the song.
 *
 * Not `#app.inert` wholesale: #app also holds the toasts, which are drawn
 * above the stage and are how Zen reports a blocked microphone. So every
 * child of #app goes inert except a fixed layer drawn above the stage, and
 * children that arrive while the stage is up get the same rule.
 */
function isolateFromPage(stage: HTMLElement): () => void {
  const app = document.getElementById('app')
  const previousFocus =
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
      ? document.activeElement
      : null
  const parsedZ = Number.parseInt(window.getComputedStyle(stage).zIndex, 10)
  const stageZ = Number.isFinite(parsedZ) ? parsedZ : 0
  const madeInert: HTMLElement[] = []

  const cover = (node: Node): void => {
    if (!(node instanceof HTMLElement) || node.inert) return
    const style = window.getComputedStyle(node)
    const z = Number.parseInt(style.zIndex, 10)
    if (style.position === 'fixed' && Number.isFinite(z) && z > stageZ) return
    node.inert = true
    madeInert.push(node)
  }

  let observer: MutationObserver | undefined
  if (app !== null) {
    for (const child of Array.from(app.children)) cover(child)
    observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => cover(node))
      }
    })
    observer.observe(app, { childList: true })
  }
  stage.focus({ preventScroll: true })

  return () => {
    observer?.disconnect()
    for (const node of madeInert) node.inert = false
    queueMicrotask(() => {
      if (previousFocus?.isConnected === true) {
        previousFocus.focus({ preventScroll: true })
      }
    })
  }
}

export const StageShell: Component<StageShellProps> = (props) => {
  let shell: HTMLDivElement | undefined
  useScrollLock()

  onMount(() => {
    if (shell === undefined) return
    onCleanup(isolateFromPage(shell))
  })

  return (
    <Portal>
      <div
        ref={shell}
        class={`${styles.shell} ${props.class ?? ''}`}
        style={props.style}
        data-testid={props.testId}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        tabindex="-1"
      >
        {props.children}
      </div>
    </Portal>
  )
}
