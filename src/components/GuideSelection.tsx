// ============================================================
// GuideSelection — Section picker overlay for Guide Tour (GH #199)
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, For, onCleanup, Show } from 'solid-js'
import { startMixerTourIfReady } from '@/features/tours/startMixerTour'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import { startVoiceTour } from '@/stores/app-store'
import { getIncompleteGuideSections, GUIDE_SECTIONS, hasPageTour, isGuideSectionCompleted, PAGE_TOUR_CATALOG, startPageTour, } from '@/stores/app-store'
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

/**
 * The line above the rows. Where the plan's row is drawn it comes first in the
 * line; where it is not, the line is the Guide's own, as it was before the plan.
 */
const PLAN_LINE =
  'Start with your plan, or pick a tour. Each tour lights up part of the app and explains what it does.'
const TOUR_LINE =
  'Choose a guided spotlight tour. The tour highlights UI elements and explains how they work.'

interface GuideSelectionProps {
  isOpen: boolean
  onClose: () => void
  onStartTour: (sectionIds: string[]) => void
  /**
   * Opens the plan: the first row, drawn only where the host gives this, and
   * never in the native build, which has no plan. The plan is a feature and
   * this component may not import one, so the host hands it over, and gives
   * none where there is no plan.
   */
  onOpenPlan?: () => void
  /** Has the person answered the plan's four questions? It names the row. */
  planAnswered?: () => boolean
}

export const GuideSelection: Component<GuideSelectionProps> = (props) => {
  const incomplete = () => getIncompleteGuideSections()
  const availablePageTours = () =>
    PAGE_TOUR_CATALOG.filter((item) => hasPageTour(item.tab))

  // Always start the tour BEFORE closing this dialog: the deferred onboarding
  // survey fires the moment no tour surface is open, and Solid effects run
  // synchronously on writes — close-then-start would open a one-tick gap.
  const handleStartFull = () => {
    props.onStartTour(GUIDE_SECTIONS.map((s) => s.id))
    props.onClose()
  }

  const handleStartIncomplete = () => {
    const secs = incomplete()
    if (secs.length === 0) return
    props.onStartTour(secs.map((s) => s.id))
    props.onClose()
  }

  const handleStartSection = (id: string) => {
    props.onStartTour([id])
    props.onClose()
  }

  // Hands the choice to the host, then closes itself. App's handler closes the
  // Guide before it sets the address (the address sync would otherwise rewrite
  // #/plan), so this close finds it shut; it keeps the row right for a host
  // whose handler leaves the Guide open.
  const handleOpenPlan = () => {
    props.onOpenPlan?.()
    props.onClose()
  }

  const handleStartPageTour = (tab: ActiveTab) => {
    startPageTour(tab)
    props.onClose()
  }

  const handleStartMixerTour = () => {
    startMixerTourIfReady()
    props.onClose()
  }

  const handleStartVoiceTour = () => {
    startVoiceTour()
    props.onClose()
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

          {/* The constant folds to a literal, so the native bundle keeps
              the Guide's own line and not the plan's. */}
          <p class={styles.guideSelectionDesc}>
            {IS_NATIVE_BUILD || props.onOpenPlan === undefined
              ? TOUR_LINE
              : PLAN_LINE}
          </p>

          {/* Quick actions */}
          <div class={styles.guideQuickActions}>
            {/* A ternary rather than a <Show when={!IS_NATIVE_BUILD && ...}>:
                only a ternary folds, so the row's words stay out of the
                native bundle (a <Show> chooses what to render and removes
                neither branch). */}
            {IS_NATIVE_BUILD ? null : (
              <Show when={props.onOpenPlan !== undefined}>
                <button class={styles.guideQuickBtn} onClick={handleOpenPlan}>
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"
                    />
                  </svg>
                  {props.planAnswered?.() === true
                    ? 'Your plan'
                    : 'Your plan, in four taps'}
                </button>
              </Show>
            )}
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
            <For each={availablePageTours()}>
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
            {/* Voice belongs to no tab — the pill is in every view — so it
                cannot be in the tab catalogue above, which is why it had no
                tour at all until now. */}
            <button
              class={styles.guideSectionItem}
              onClick={handleStartVoiceTour}
            >
              <span class={styles.guideSectionIcon}>
                <TourIcon />
              </span>
              <span class={styles.guideSectionText}>
                <span class={styles.guideSectionName}>Voice control</span>
                <span class={styles.guideSectionDesc}>
                  The mic pill, the commands worth knowing, and singing a song
                  you cannot name
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  )
}
