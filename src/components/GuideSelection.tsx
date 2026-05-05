// ============================================================
// GuideSelection — Section picker overlay for Guide Tour (GH #199)
// ============================================================

import type { Component } from 'solid-js'
import { For, onMount, Show } from 'solid-js'
import { getIncompleteGuideSections, GUIDE_SECTIONS, isGuideSectionCompleted, } from '@/stores/app-store'

interface GuideSelectionProps {
  isOpen: boolean
  onClose: () => void
  onStartTour: (sectionIds: string[]) => void
}

export const GuideSelection: Component<GuideSelectionProps> = (props) => {
  const incomplete = () => getIncompleteGuideSections()

  const handleStartFull = () => {
    props.onClose()
    props.onStartTour(GUIDE_SECTIONS.map((s) => s.id))
  }

  const handleStartIncomplete = () => {
    const secs = incomplete()
    if (secs.length === 0) return
    props.onClose()
    props.onStartTour(secs.map((s) => s.id))
  }

  const handleStartSection = (id: string) => {
    props.onClose()
    props.onStartTour([id])
  }

  // Close on Escape
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose()
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  return (
    <Show when={props.isOpen}>
      <div class="guide-overlay" onClick={() => props.onClose()}>
        <div class="guide-selection" onClick={(e) => e.stopPropagation()}>
          <div class="guide-selection-header">
            <h2>Guide Tour</h2>
            <button
              class="guide-close-btn"
              onClick={() => props.onClose()}
              title="Close"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
              </svg>
            </button>
          </div>

          <p class="guide-selection-desc">
            Choose a guided spotlight tour. The tour highlights UI elements and
            explains how they work.
          </p>

          {/* Quick actions */}
          <div class="guide-quick-actions">
            <button class="guide-quick-btn" onClick={handleStartFull}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                />
              </svg>
              Full Tour (All Sections)
            </button>
            <Show when={incomplete().length > 0}>
              <button
                class="guide-quick-btn guide-quick-incomplete"
                onClick={handleStartIncomplete}
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="currentColor"
                    d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"
                  />
                </svg>
                Incomplete Only ({incomplete().length} sections)
              </button>
            </Show>
          </div>

          {/* Section list */}
          <div class="guide-sections-list">
            <h3>Sections</h3>
            <For each={GUIDE_SECTIONS}>
              {(sec) => {
                const done = isGuideSectionCompleted(sec.id)
                return (
                  <button
                    class={`guide-section-item ${done ? 'completed' : ''}`}
                    onClick={() => handleStartSection(sec.id)}
                  >
                    <span class="guide-section-icon">
                      <Show when={done}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path
                            fill="currentColor"
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                          />
                        </svg>
                      </Show>
                      <Show when={!done}>
                        <svg viewBox="0 0 24 24" width="18" height="18">
                          <path
                            fill="currentColor"
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
                          />
                        </svg>
                      </Show>
                    </span>
                    <span class="guide-section-text">
                      <span class="guide-section-name">{sec.title}</span>
                      <span class="guide-section-desc">{sec.description}</span>
                    </span>
                  </button>
                )
              }}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}
