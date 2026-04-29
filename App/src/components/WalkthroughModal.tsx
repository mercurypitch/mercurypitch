// ============================================================
// Walkthrough Modal — Display walkthrough content
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { renderMarkdownToHtml } from '@/lib/render-markdown'
import type { WalkthroughTab } from '@/stores/walkthrough-store'
import {
  completeWalkthrough,
  getWalkthrough,
  getWalkthroughsForTab,
  isWalkthroughCompleted,
  viewWalkthrough
} from '@/stores/walkthrough-store'
import type { WalkthroughContent } from '@/types/walkthrough'

interface WalkthroughModalProps {
  isOpen: boolean
  onClose: () => void
  onBackToList?: () => void
  initialWalkthroughId?: string | null
}

export const WalkthroughModal: Component<WalkthroughModalProps> = (props) => {
  const [currentWalkthrough, setCurrentWalkthrough] = createSignal<WalkthroughContent | undefined>(
    undefined,
  )
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
    for (const tab of ['practice', 'editor', 'settings', 'study'] as WalkthroughTab[]) {
      const walkthroughs = getWalkthroughsForTab(tab)
      const next = walkthroughs.find(w => !isWalkthroughCompleted(w.id))
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
        return () => doc.removeEventListener('keydown', handleKeyDown)
      }
    }
  })

  return (
    <Show when={props.isOpen && currentWalkthrough()}>
      <div
        class="walkthrough-backdrop"
        onClick={closeOnBackdrop}
      >
        <div class="walkthrough-modal">
          {/* Completed state */}
          <Show when={isCompleted()} keyed>
            <div class="walkthrough-complete">
              <div class="walkthrough-complete-icon">🎉</div>
              <h2 class="walkthrough-complete-title">Great Job!</h2>
              <p class="walkthrough-complete-desc">
                You've completed this walkthrough.
              </p>
              <button class="walkthrough-complete-btn" onClick={handleContinue}>
                Continue
              </button>
              <button class="walkthrough-back-list-btn" onClick={handleBackToList}>
                ← Back to list
              </button>
            </div>
          </Show>

          {/* Reading state */}
          <Show when={!isCompleted()} keyed>
            <div class="walkthrough-content">
              <button class="walkthrough-back-btn" onClick={handleBackToList}>
                ← Back to list
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
                  innerHTML={renderMarkdownToHtml(currentWalkthrough()!.content)}
                />

                <div class="walkthrough-steps">
                  <h3 class="walkthrough-steps-title">How to Use:</h3>
                  <div class="walkthrough-steps-list">
                    <For each={currentWalkthrough()?.steps ?? []}>
                      {(step, index) => (
                        <Show when={index() === currentStepIndex()}>
                          <div class="walkthrough-step-item active">
                            <span class="walkthrough-step-number">{index() + 1}</span>
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
                  ← Previous
                </button>

                {currentStepIndex() < (currentWalkthrough()!.steps.length - 1) ? (
                  <button
                    class="walkthrough-nav-btn walkthrough-nav-btn-next"
                    onClick={nextStep}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    class="walkthrough-complete-btn"
                    onClick={completeCurrentWalkthrough}
                  >
                    ✓ Mark as Complete
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
