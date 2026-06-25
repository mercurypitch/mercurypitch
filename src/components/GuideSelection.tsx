// ============================================================
// GuideSelection — Section picker overlay for Guide Tour (GH #199)
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, For, onCleanup, Show } from 'solid-js'
import { startMixerTourIfReady } from '@/features/tours/startMixerTour'
import { getIncompleteGuideSections, GUIDE_SECTIONS, isGuideSectionCompleted, PAGE_TOUR_CATALOG, startPageTour, } from '@/stores/app-store'
import type { ActiveTab } from '@/types'
import styles from './GuideSelection.module.css'

/** Compass icon for the interactive spotlight-tour entries. */
const TourIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path
      fill="currentColor"
      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l5 2.5L12 11 7 8.5 12 6zm-5 4l5 2.5V18l-5-2.5V10zm10 0v5.5L12 18v-5.5L17 10z"
    />
  </svg>
)

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

  const handleStartPageTour = (tab: ActiveTab) => {
    props.onClose()
    startPageTour(tab)
  }

  const handleStartMixerTour = () => {
    props.onClose()
    startMixerTourIfReady()
  }

  // Close on Escape — only while open, and detach when closed.
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose()
  }
  createEffect(() => {
    if (!props.isOpen) return
    window.addEventListener('keydown', handleKeydown)
    onCleanup(() => window.removeEventListener('keydown', handleKeydown))
  })

  return (
    <Show when={props.isOpen}>
      <div class={styles.guideOverlay} onClick={() => props.onClose()}>
        <div class={styles.guideSelection} onClick={(e) => e.stopPropagation()}>
          <div class={styles.guideSelectionHeader}>
            <h2>Guide Tour</h2>
            <button
              class={styles.guideCloseBtn}
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

          <p class={styles.guideSelectionDesc}>
            Choose a guided spotlight tour. The tour highlights UI elements and
            explains how they work.
          </p>

          {/* Quick actions */}
          <div class={styles.guideQuickActions}>
            <button class={styles.guideQuickBtn} onClick={handleStartFull}>
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
                class={`${styles.guideQuickBtn} ${styles.guideQuickIncomplete}`}
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

          {/* App basics — legacy section spotlight tours */}
          <div class={styles.guideSectionsList}>
            <h3>App basics</h3>
            <For each={GUIDE_SECTIONS}>
              {(sec) => {
                const done = isGuideSectionCompleted(sec.id)
                return (
                  <button
                    class={
                      done
                        ? `${styles.guideSectionItem} ${styles.guideSectionItemCompleted}`
                        : styles.guideSectionItem
                    }
                    onClick={() => handleStartSection(sec.id)}
                  >
                    <span class={styles.guideSectionIcon}>
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
                    <span class={styles.guideSectionText}>
                      <span class={styles.guideSectionName}>{sec.title}</span>
                      <span class={styles.guideSectionDesc}>
                        {sec.description}
                      </span>
                    </span>
                  </button>
                )
              }}
            </For>
          </div>

          {/* Per-page interactive tours */}
          <div class={styles.guideSectionsList}>
            <h3>Per-page tours</h3>
            <For each={PAGE_TOUR_CATALOG}>
              {(item) => (
                <button
                  class={styles.guideSectionItem}
                  onClick={() => handleStartPageTour(item.tab)}
                >
                  <span class={styles.guideSectionIcon}>
                    <TourIcon />
                  </span>
                  <span class={styles.guideSectionText}>
                    <span class={styles.guideSectionName}>{item.title}</span>
                    <span class={styles.guideSectionDesc}>
                      {item.description}
                    </span>
                  </span>
                </button>
              )}
            </For>
            <button
              class={styles.guideSectionItem}
              onClick={handleStartMixerTour}
            >
              <span class={styles.guideSectionIcon}>
                <TourIcon />
              </span>
              <span class={styles.guideSectionText}>
                <span class={styles.guideSectionName}>Karaoke mixer</span>
                <span class={styles.guideSectionDesc}>
                  Stems, lyrics & LRC tools, pitch scoring, playlists — shown
                  once a song is loaded
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
