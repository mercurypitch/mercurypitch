// ============================================================
// AppSidebar — the one rail, shell only
// ============================================================
//
// The shell owns the mechanics (collapse, mobile close, the universal
// Learn/Guide/Tour header) and nothing else. WHAT the rail shows is the
// per-tab decision of src/features/sidebar/sidebar-registry.ts — this
// component just renders that tab's panel list in order. On phones the
// same component is the off-canvas drawer, so the registry decides
// drawer content too.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { SidebarHostProvider } from '@/features/sidebar/sidebar-host'
import { SIDEBAR_PANELS, sidebarPanelIdsFor, } from '@/features/sidebar/sidebar-registry'
import { activeTab as appActiveTab, hasPageTour, startPageTour } from '@/stores'
import type { MelodyItem, NoteResult } from '@/types'
import styles from './AppSidebar.module.css'

interface AppSidebarProps {
  /** For octave shift handler from parent */
  onOctaveShift?: (delta: number) => void
  /** Open scale builder modal */
  onOpenScaleBuilder?: () => void
  /** Open Learn walkthroughs */
  /** Open Guide tours */
  onOpenGuide?: () => void
  /** Note list feed (Singing tab) */
  melody: () => MelodyItem[]
  currentNoteIndex: () => number
  noteResults: () => NoteResult[]
  isPlaying: () => boolean
  /** Additional CSS class (e.g. 'open' for mobile toggle) */
  class?: string
  /** Called when the mobile close button is clicked */
  onClose?: () => void
  /** Whether the sidebar is collapsed (desktop) */
  collapsed?: boolean
  /** Called when the collapse toggle is clicked */
  onToggleCollapse?: () => void
  /** Sample the room and auto-pick a mic sensitivity preset. */
  onAutoCalibrate?: () => void | Promise<void>
}

export const AppSidebar: Component<AppSidebarProps> = (props) => {
  // Local alias for reactive tracking
  const activeTab = () => appActiveTab()

  return (
    <aside
      class={`app-sidebar${props.class !== undefined && props.class !== '' ? ` ${props.class}` : ''}${(props.collapsed ?? false) ? ' collapsed' : ''}`}
    >
      {/* Desktop collapse toggle */}
      <button
        class={styles.sidebarCollapseBtn}
        onClick={() => props.onToggleCollapse?.()}
        title={
          (props.collapsed ?? false) ? 'Expand sidebar' : 'Collapse sidebar'
        }
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          style={{
            transform: (props.collapsed ?? false) ? 'rotate(180deg)' : '',
          }}
        >
          <path
            fill="currentColor"
            d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
          />
        </svg>
      </button>

      {/* Mobile close button */}
      <button
        class={styles.sidebarCloseBtn}
        onClick={() => props.onClose?.()}
        title="Close menu"
        aria-label="Close menu"
      >
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path
            fill="currentColor"
            d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
          />
        </svg>
      </button>

      {/* Guide + this page's tour. Learn and What's new used to sit here
          too; four controls did not fit a phone's sidebar, and neither is
          about the page you are on — they live in the Home header now. */}
      <div class={styles.walkthroughControlGroup} data-tour="singing.guides">
        <button
          class={[
            styles.walkthroughControlBtn,
            styles.walkthroughControlBtnGuide,
          ].join(' ')}
          onClick={() => props.onOpenGuide?.()}
          title="Interactive guide tours"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
            />
          </svg>
          <span class={styles.walkthroughControlText}>Guide</span>
        </button>
        <Show when={hasPageTour(activeTab())}>
          <button
            class={styles.walkthroughControlBtn}
            onClick={() => startPageTour(activeTab())}
            title="Take a guided tour of this page"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l5 2.5L12 11 7 8.5 12 6zm-5 4l5 2.5V18l-5-2.5V10zm10 0v5.5L12 18v-5.5L17 10z"
              />
            </svg>
            <span class={styles.walkthroughControlText}>Tour</span>
          </button>
        </Show>
      </div>

      {/* The tab's panels, in registry order. */}
      <SidebarHostProvider
        host={{
          onOctaveShift: (delta) => props.onOctaveShift?.(delta),
          onOpenScaleBuilder: () => props.onOpenScaleBuilder?.(),
          onAutoCalibrate: props.onAutoCalibrate,
          noteList: {
            melody: props.melody,
            currentNoteIndex: props.currentNoteIndex,
            noteResults: props.noteResults,
            isPlaying: props.isPlaying,
          },
        }}
      >
        <For each={[...sidebarPanelIdsFor(activeTab())]}>
          {(id) => {
            const Panel = SIDEBAR_PANELS[id]
            return <Panel />
          }}
        </For>
      </SidebarHostProvider>
    </aside>
  )
}
