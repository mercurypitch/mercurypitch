// ============================================================
// Walkthrough Modal — Display walkthrough content
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { renderMarkdownToHtml } from '@/lib/render-markdown'
import { TAB_SINGING, TAB_COMPOSE, TAB_SETTINGS, WALKTHROUGH_TAB_STUDY, } from '@/features/tabs/constants'
import type { WalkthroughTab } from '@/stores/walkthrough-store'
import { completeWalkthrough, getWalkthrough, getWalkthroughsForTab, isWalkthroughCompleted, viewWalkthrough, } from '@/stores/walkthrough-store'
import type { WalkthroughContent } from '@/types/walkthrough'

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
    if (id !== null && id !== undefined && open && !initialLoaded) {
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
      <div class="walkthrough-backdrop" onClick={closeOnBackdrop}>
        <div class="walkthrough-modal">
          {/* Completed state */}
          <Show when={isCompleted()} keyed>
            <div class="walkthrough-complete">
              <div class="walkthrough-complete-icon">
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
                    class="walkthrough-check-path"
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
              <h2 class="walkthrough-complete-title">Great Job!</h2>
              <p class="walkthrough-complete-desc">
                You've completed this walkthrough.
              </p>
              <button class="walkthrough-complete-btn" onClick={handleContinue}>
                Continue
              </button>
              <button
                class="walkthrough-back-list-btn"
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
            <div class="walkthrough-content">
              <button class="walkthrough-back-btn" onClick={handleBackToList}>
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
              <div class="walkthrough-body">
                <h2 class="walkthrough-main-title">
                  {currentWalkthrough()!.title}
                </h2>
                <p class="walkthrough-main-desc">
                  {currentWalkthrough()!.description}
                </p>

                <div
                  class="walkthrough-text"
                  innerHTML={renderMarkdownToHtml(
                    currentWalkthrough()!.content,
                  )}
                />

                <div class="walkthrough-steps">
                  <h3 class="walkthrough-steps-title">How to Use:</h3>
                  <div class="walkthrough-steps-list">
                    <For each={currentWalkthrough()?.steps ?? []}>
                      {(step, index) => (
                        <Show when={index() === currentStepIndex()}>
                          <div class="walkthrough-step-item active">
                            <span class="walkthrough-step-number">
                              {index() + 1}
                            </span>
                            <div class="walkthrough-step-details">
                              <h4 class="walkthrough-step-title">
                                {step.title}
                              </h4>
                              <p class="walkthrough-step-desc">
                                {step.description}
                              </p>
                              <span class="walkthrough-step-action">
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

              <div class="walkthrough-controls">
                <button
                  class="walkthrough-nav-btn"
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
                    class="walkthrough-nav-btn walkthrough-nav-btn-next"
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
                    class="walkthrough-complete-btn"
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
