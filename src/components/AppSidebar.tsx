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
import { navigateTo } from '@/lib/hash-router'
import { activeTab as appActiveTab, hasPageTour, startPageTour } from '@/stores'
import type { MelodyItem, NoteResult } from '@/types'
import styles from './AppSidebar.module.css'

interface AppSidebarProps {
  /** For octave shift handler from parent */
  onOctaveShift?: (delta: number) => void
  /** Open scale builder modal */
  onOpenScaleBuilder?: () => void
  /** Open Learn walkthroughs */
  onOpenLearn?: () => void
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
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>

      {/* Learn + Guide buttons — universal, above every panel */}
      <div class={styles.walkthroughControlGroup} data-tour="singing.guides">
        <button
          class={styles.walkthroughControlBtn}
          onClick={() => props.onOpenLearn?.()}
          title="View MercuryPitch walkthroughs"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.43.3 4.5 1.5.15.15.35.05.5 0 .1-.1.1-.25 0-.35C21.25 20 21 19.75 21 19.5V5z"
            />
          </svg>
          <span class={styles.walkthroughControlText}>Learn</span>
        </button>
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
        {/* The release page. It announces itself once per release and is
            otherwise only findable if something points at it — this is the
            pointer, beside the other two "explain the app" doors. */}
        <button
          class={styles.walkthroughControlBtn}
          onClick={() => navigateTo({ type: 'whats-new' })}
          title="What's new in this release"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M12 2l2.2 5.6L20 9.2l-4.4 3.6L17 19l-5-3-5 3 1.4-6.2L4 9.2l5.8-1.6L12 2z"
            />
          </svg>
          <span class={styles.walkthroughControlText}>New</span>
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
