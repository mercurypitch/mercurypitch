// ============================================================
// Walkthrough Modal — Display walkthrough content
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { TAB_COMPOSE, TAB_KARAOKE, TAB_SETTINGS, TAB_SINGING, WALKTHROUGH_TAB_STUDY, } from '@/features/tabs/constants'
import { startMixerTourIfReady } from '@/features/tours/startMixerTour'
import { renderMarkdownToHtml } from '@/lib/render-markdown'
import { hasPageTour, PRACTICE_MODES_TOUR_STEPS, startPageTour, startTour, startWalkthrough as startSectionTour, } from '@/stores'
import type { WalkthroughTab } from '@/stores/walkthrough-store'
import { completeWalkthrough, getWalkthrough, getWalkthroughsForTab, isWalkthroughCompleted, viewWalkthrough, } from '@/stores/walkthrough-store'
import type { ActiveTab } from '@/types'
import type { WalkthroughContent } from '@/types/walkthrough'
import styles from './WalkthroughModal.module.css'

interface WalkthroughModalProps {
  isOpen: boolean
  onClose: () => void
  onBackToList?: () => void
  initialWalkthroughId?: string | null
}

export const WalkthroughModal: Component<WalkthroughModalProps> = (props) => {
  const [currentWalkthrough, setCurrentWalkthrough] = createSignal<
    WalkthroughContent | undefined
  >(undefined)
  const [currentStepIndex, setCurrentStepIndex] = createSignal(0)

  // Load walkthrough when provided
  let initialLoaded = false
  createEffect(() => {
    const id = props.initialWalkthroughId
    const open = props.isOpen
    if (id != null && open && !initialLoaded) {
      const walkthrough = getWalkthrough(id)
      if (walkthrough) {
        setCurrentWalkthrough(walkthrough)
        setCurrentStepIndex(0)
        viewWalkthrough(id)
      }
      initialLoaded = true
    }
    if (!open) {
      initialLoaded = false
      setCurrentWalkthrough(undefined)
      setCurrentStepIndex(0)
    }
  })

  // Sync completion state
  const isCompleted = createMemo(() => {
    const w = currentWalkthrough()
    if (!w) return false
    return isWalkthroughCompleted(w.id)
  })

  // Navigate steps
  const nextStep = () => {
    const steps = currentWalkthrough()?.steps ?? []
    if (currentStepIndex() < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex() + 1)
    }
  }

  const prevStep = () => {
    if (currentStepIndex() > 0) {
      setCurrentStepIndex(currentStepIndex() - 1)
    }
  }

  const startWalkthrough = (walkthroughId: string) => {
    const walkthrough = getWalkthrough(walkthroughId)
    if (walkthrough) {
      setCurrentWalkthrough(walkthrough)
      setCurrentStepIndex(0)
      viewWalkthrough(walkthroughId)
    }
  }

  const completeCurrentWalkthrough = () => {
    if (currentWalkthrough()) {
      completeWalkthrough(currentWalkthrough()!.id)
    }
  }

  const handleContinue = () => {
    // Find next unfinished walkthrough across all tabs
    for (const tab of [
      TAB_SINGING,
      TAB_COMPOSE,
      TAB_SETTINGS,
      WALKTHROUGH_TAB_STUDY,
    ] as WalkthroughTab[]) {
      const walkthroughs = getWalkthroughsForTab(tab)
      const next = walkthroughs.find((w) => !isWalkthroughCompleted(w.id))
      if (next) {
        startWalkthrough(next.id)
        return
      }
    }
    props.onClose()
  }

  const closeOnBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      props.onClose()
    }
  }

  const handleBackToList = () => {
    props.onBackToList?.()
  }

  // Bridge: a tutorial -> its matching spotlight tour. Tab-level mapping is the
  // default; specific tutorials override it so e.g. "Understanding Practice
  // Modes" opens the focused practice-modes tour rather than the generic
  // Singing tour.
  const SECTION_FOR_TAB: Partial<Record<WalkthroughTab, string>> = {
    [TAB_SINGING]: 'practice',
    [TAB_COMPOSE]: 'editor',
    [TAB_SETTINGS]: 'settings',
  }

  // Per-tutorial-id overrides (more specific than the tab default).
  const TOUR_BY_ID: Record<string, () => void> = {
    'practice-toolbar': () => startSectionTour(['toolbar']),
    'practice-modes': () => startTour(PRACTICE_MODES_TOUR_STEPS),
  }

  const tourAvailable = () => {
    const w = currentWalkthrough()
    if (!w) return false
    if (w.id in TOUR_BY_ID) return true
    if (w.tab === TAB_KARAOKE) return true
    if (hasPageTour(w.tab as ActiveTab)) return true
    return w.tab in SECTION_FOR_TAB
  }

  const handleTakeTour = () => {
    const w = currentWalkthrough()
    if (!w) return
    props.onClose() // hand off cleanly to the spotlight overlay
    if (w.id in TOUR_BY_ID) {
      TOUR_BY_ID[w.id]()
      return
    }
    if (w.tab === TAB_KARAOKE) {
      startMixerTourIfReady()
    } else if (hasPageTour(w.tab as ActiveTab)) {
      startPageTour(w.tab as ActiveTab)
    } else {
      const section = SECTION_FOR_TAB[w.tab]
      if (section !== undefined) startSectionTour([section])
    }
  }

  // Lifecycle
  createEffect(() => {
    if (props.isOpen) {
      const doc = typeof document !== 'undefined' ? document : undefined
      if (doc) {
        doc.addEventListener('keydown', handleKeyDown)
        // eslint-disable-next-line solid/reactivity
        return () => doc.removeEventListener('keydown', handleKeyDown)
      }
    }
  })

  return (
    <Show when={props.isOpen && currentWalkthrough()}>
      <div class={styles.walkthroughBackdrop} onClick={closeOnBackdrop}>
        <div class={styles.walkthroughModal}>
          {/* Completed state */}
          <Show when={isCompleted()} keyed>
            <div class={styles.walkthroughComplete}>
              <div class={styles.walkthroughCompleteIcon}>
                <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
                  {/* Outer glow ring */}
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="url(#completionGrad)"
                    stroke-width="3"
                    opacity="0.6"
                  />
                  {/* Filled circle background */}
                  <circle
                    cx="40"
                    cy="40"
                    r="30"
                    fill="url(#completionGrad)"
                    opacity="0.12"
                  />
                  {/* Checkmark */}
                  <path
                    d="M26 40.5 L35 49.5 L54 30.5"
                    stroke="url(#completionGrad)"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class={styles.walkthroughCheckPath}
                  />
                  {/* Star accent top-right */}
                  <path
                    d="M58 18 L59.5 22 L63 20 L61 23.5 L65 25 L61 26 L63 30 L59.5 28 L58 32 L56.5 28 L53 30 L55 26 L51 25 L55 23.5 L53 20 L56.5 22Z"
                    fill="var(--accent)"
                    opacity="0.5"
                  />
                  <defs>
                    <linearGradient
                      id="completionGrad"
                      x1="0"
                      y1="0"
                      x2="80"
                      y2="80"
                    >
                      <stop offset="0%" stop-color="var(--green)" />
                      <stop offset="100%" stop-color="var(--accent)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2 class={styles.walkthroughCompleteTitle}>Great Job!</h2>
              <p class={styles.walkthroughCompleteDesc}>
                You've completed this walkthrough.
              </p>
              <button
                class={styles.walkthroughCompleteBtn}
                onClick={handleContinue}
              >
                Continue
              </button>
              <button
                class={styles.walkthroughBackListBtn}
                onClick={handleBackToList}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  style={{ 'margin-right': '4px' }}
                >
                  <path
                    fill="currentColor"
                    d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                  />
                </svg>
                Back to list
              </button>
            </div>
          </Show>

          {/* Reading state */}
          <Show when={!isCompleted()} keyed>
            <div class={styles.walkthroughContent}>
              <button
                class={styles.walkthroughBackBtn}
                onClick={handleBackToList}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  style={{ 'margin-right': '4px' }}
                >
                  <path
                    fill="currentColor"
                    d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                  />
                </svg>
                Back to list
              </button>
              <div class={styles.walkthroughBody}>
                <h2 class={styles.walkthroughMainTitle}>
                  {currentWalkthrough()!.title}
                </h2>
                <p class={styles.walkthroughMainDesc}>
                  {currentWalkthrough()!.description}
                </p>

                <Show when={tourAvailable()}>
                  <button
                    class={styles.walkthroughTourBtn}
                    onClick={handleTakeTour}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l5 2.5L12 11 7 8.5 12 6zm-5 4l5 2.5V18l-5-2.5V10zm10 0v5.5L12 18v-5.5L17 10z"
                      />
                    </svg>
                    Take the interactive tour
                  </button>
                </Show>

                <div
                  class={styles.walkthroughText}
                  innerHTML={renderMarkdownToHtml(
                    currentWalkthrough()!.content,
                  )}
                />

                <div class={styles.walkthroughSteps}>
                  <h3 class={styles.walkthroughStepsTitle}>How to Use:</h3>
                  <div class={styles.walkthroughStepsList}>
                    <For each={currentWalkthrough()?.steps ?? []}>
                      {(step, index) => (
                        <Show when={index() === currentStepIndex()}>
                          <div
                            class={[
                              styles.walkthroughStepItem,
                              styles.walkthroughStepItemActive,
                            ].join(' ')}
                          >
                            <span class={styles.walkthroughStepNumber}>
                              {index() + 1}
                            </span>
                            <div class={styles.walkthroughStepDetails}>
                              <h4 class={styles.walkthroughStepTitle}>
                                {step.title}
                              </h4>
                              <p class={styles.walkthroughStepDesc}>
                                {step.description}
                              </p>
                              <span class={styles.walkthroughStepAction}>
                                Action: {step.action}
                              </span>
                            </div>
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                </div>
              </div>

              <div class={styles.walkthroughControls}>
                <button
                  class={styles.walkthroughNavBtn}
                  onClick={prevStep}
                  disabled={currentStepIndex() === 0}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    style={{ 'margin-right': '4px' }}
                  >
                    <path
                      fill="currentColor"
                      d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                    />
                  </svg>
                  Previous
                </button>

                {currentStepIndex() < currentWalkthrough()!.steps.length - 1 ? (
                  <button
                    class={[
                      styles.walkthroughNavBtn,
                      styles.walkthroughNavBtnNext,
                    ].join(' ')}
                    onClick={nextStep}
                  >
                    Next
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      style={{ 'margin-left': '4px' }}
                    >
                      <path
                        fill="currentColor"
                        d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
                      />
                    </svg>
                  </button>
                ) : (
                  <button
                    class={styles.walkthroughCompleteBtn}
                    onClick={completeCurrentWalkthrough}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      style={{ 'margin-right': '4px' }}
                    >
                      <path
                        fill="currentColor"
                        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                      />
                    </svg>
                    Mark as Complete
                  </button>
                )}
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
