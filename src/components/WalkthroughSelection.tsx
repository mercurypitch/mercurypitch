// ============================================================
// WalkthroughSelection — Learn modal for reading chapters
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { WalkthroughTab } from '@/stores/walkthrough-store'
import { getCompletedWalkthroughs, getRemainingWalkthroughs, getTotalWalkthroughCount, viewWalkthrough, } from '@/stores/walkthrough-store'

interface WalkthroughSelectionProps {
  isOpen: boolean
  onClose: () => void
  onStartWalkthrough: (walkthroughId: string, tab: WalkthroughTab) => void
}

export const WalkthroughSelection: Component<WalkthroughSelectionProps> = (
  props,
) => {
  const remaining = createMemo(() => getRemainingWalkthroughs())
  const completed = createMemo(() => getCompletedWalkthroughs())
  const total = createMemo(() => getTotalWalkthroughCount())

  const handleView = (walkthrough: { id: string; tab: string }) => {
    viewWalkthrough(walkthrough.id)
    props.onStartWalkthrough(walkthrough.id, walkthrough.tab as WalkthroughTab)
  }

  // Close on Escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose()
  }

  return (
    <Show when={props.isOpen}>
      <div
        class="walkthrough-selection-overlay"
        onClick={() => props.onClose()}
      >
        <div
          class="walkthrough-selection-card"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeydown}
          tabIndex={0}
        >
          {/* Header */}
          <div class="ws-header">
            <div class="ws-header-left">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                class="ws-header-icon"
              >
                <path
                  fill="currentColor"
                  d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.43.3 4.5 1.5.15.15.35.05.5 0 .1-.1.1-.25 0-.35C21.25 20 21 19.75 21 19.5V5z"
                />
              </svg>
              <h2 class="ws-title">Learn</h2>
            </div>
            <button
              class="ws-close-btn"
              onClick={() => props.onClose()}
              title="Close"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div class="ws-progress">
            <div class="ws-progress-bar">
              <div
                class="ws-progress-fill"
                style={{
                  width: `${(completed().length / (total() || 1)) * 100}%`,
                }}
              />
            </div>
            <span class="ws-progress-text">
              {completed().length} / {total()} chapters read
            </span>
          </div>

          {/* Chapter list */}
          <div class="ws-chapters">
            <For each={remaining()}>
              {(w) => (
                <button class="ws-chapter-item" onClick={() => handleView(w)}>
                  <span class="ws-chapter-icon">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path
                        fill="currentColor"
                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
                      />
                    </svg>
                  </span>
                  <span class="ws-chapter-title">{w.title}</span>
                  <span class="ws-chapter-tab">{w.tab}</span>
                </button>
              )}
            </For>

            {/* Completed */}
            <Show when={completed().length > 0}>
              <div class="ws-completed">
                <For each={completed()}>
                  {(w) => (
                    <button
                      class="ws-chapter-item ws-chapter-done"
                      onClick={() => handleView(w)}
                    >
                      <span class="ws-chapter-icon ws-chapter-icon-done">
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path
                            fill="currentColor"
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                          />
                        </svg>
                      </span>
                      <span class="ws-chapter-title">{w.title}</span>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="ws-footer">
            <button class="ws-close-footer" onClick={() => props.onClose()}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
