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
//
// It owns NO audio and no layout beyond "flex column": engines stay above
// the responsive branch (convention #1), children bring their own chrome.
// Skinning is custom-property-based (convention #8): stages set
// --stage-bg / --stage-color (and any kit-primitive --pill-*/--sheet-*
// overrides) in the class they pass via `class`.

import type { Component, JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { useScrollLock } from '@/lib/use-scroll-lock'
import styles from './StageShell.module.css'

interface StageShellProps {
  class?: string
  testId?: string
  children: JSX.Element
}

export const StageShell: Component<StageShellProps> = (props) => {
  useScrollLock()

  return (
    <Portal>
      <div
        class={`${styles.shell} ${props.class ?? ''}`}
        data-testid={props.testId}
      >
        {props.children}
      </div>
    </Portal>
  )
}
