// ============================================================
// Walkthrough — Section-based spotlight guide tour (GH #140, #199)
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, onCleanup, Show } from 'solid-js'
import { IconArrowLeft, IconArrowRight, } from '@/components/hidden-features-icons'
import type { WalkthroughStep } from '@/stores/app-store'
import { walkthroughStep } from '@/stores/app-store'
import { tourSteps, walkthroughActive } from '@/stores/app-store'
import { endWalkthrough, GUIDE_SECTIONS, nextWalkthroughStep, prevWalkthroughStep, skipSection, } from '@/stores/app-store'
import { activeTab, setActiveTab } from '@/stores/ui-store'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const TOOLTIP_GAP = 12
const TOOLTIP_WIDTH = 340
const TOOLTIP_HEIGHT = 200

export const Walkthrough: Component = () => {
  let highlightRef: HTMLDivElement | undefined
  let tooltipRef: HTMLDivElement | undefined

  // Derived signals
  const steps = () => tourSteps()
  const currentStep = (): WalkthroughStep | undefined => {
    const s = steps()
    return s[walkthroughStep()]
  }
  const isLast = () => {
    const s = steps()
    return walkthroughStep() === s.length - 1
  }
  const isFirst = () => walkthroughStep() === 0

  // Current section info
  const currentSection = () => {
    const step = currentStep()
    if (
      !step ||
      step.section === undefined ||
      step.section === null ||
      step.section === ''
    )
      return null
    return GUIDE_SECTIONS.find((s) => s.id === step.section) ?? null
  }

  const getPlacement = (): Placement => currentStep()?.placement ?? 'bottom'

  // Auto-switch tab when step has requiredTab
  // Only runs while tour is active — stops immediately when tour ends
  createEffect(() => {
    if (!walkthroughActive()) return
    const step = currentStep()
    if (step?.requiredTab) {
      const tab = step.requiredTab
      if (activeTab() !== tab) {
        setActiveTab(tab)
      }
    }
  })

  // Poll until a target element exists in the DOM
  // Checks immediately first (0 delay) to resolve instantly if already rendered
  // Retries up to `maxAttempts` times with `intervalMs` between attempts
  const waitForTarget = (
    selector: string,
    maxAttempts = 10,
    intervalMs = 50,
  ): Promise<boolean> =>
    new Promise((resolve) => {
      let attempts = 0
      const tryOnce = () => {
        if (document.querySelector(selector)) {
          resolve(true)
          return
        }
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(tryOnce, intervalMs)
        } else {
          resolve(false)
        }
      }
      tryOnce()
    })

  const updateHighlight = () => {
    if (highlightRef === undefined) return
    const step = currentStep()
    if (
      step === undefined ||
      step.targetSelector === undefined ||
      step.targetSelector === ''
    ) {
      highlightRef.style.display = 'none'
      return
    }
    const el = document.querySelector(step.targetSelector)
    if (!el) {
      highlightRef.style.display = 'none'
      return
    }
    highlightRef.style.display = ''
    const rect = el.getBoundingClientRect()
    const padding = 6
    highlightRef.style.top = `${rect.top - padding}px`
    highlightRef.style.left = `${rect.left - padding}px`
    highlightRef.style.width = `${rect.width + padding * 2}px`
    highlightRef.style.height = `${rect.height + padding * 2}px`
  }

  // Scroll target element into view if partially out of viewport,
  // then re-position highlight + tooltip after scroll settles
  const scrollToTargetIfNeeded = () => {
    const step = currentStep()
    if (
      step === undefined ||
      step.targetSelector === undefined ||
      step.targetSelector === ''
    )
      return
    const el = document.querySelector(step.targetSelector)
    if (!el) return

    const margin = 80
    const r = el.getBoundingClientRect()
    const needsScroll =
      r.top < -margin || r.bottom > window.innerHeight + margin
    if (!needsScroll) return

    // Use instant scroll so highlight/tooltip update immediately
    el.scrollIntoView({ behavior: 'auto', block: 'center' })
    // Re-position after scroll (needs one frame for layout)
    requestAnimationFrame(() => {
      updateHighlight()
      updateTooltip()
    })
  }

  const updateTooltipCentered = (
    tW: number,
    tH: number,
    vw: number,
    vh: number,
  ) => {
    if (!tooltipRef) return
    const left = (vw - tW) / 2
    const top = (vh - tH) / 2
    tooltipRef.style.left = `${left}px`
    tooltipRef.style.top = `${top}px`
    tooltipRef.dataset.placement = 'bottom'
  }

  const updateTooltip = () => {
    if (tooltipRef === undefined) return
    const step = currentStep()
    const targetSelector = step?.targetSelector
    const el =
      targetSelector !== undefined && targetSelector !== ''
        ? document.querySelector(targetSelector)
        : null

    if (el === null) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const tooltipRect = tooltipRef.getBoundingClientRect()
      const tW = tooltipRect.width > 0 ? tooltipRect.width : TOOLTIP_WIDTH
      const tH = tooltipRect.height > 0 ? tooltipRect.height : TOOLTIP_HEIGHT
      updateTooltipCentered(tW, tH, vw, vh)
      return
    }
    tooltipRef.style.opacity = ''

    const targetRect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const tooltipRect = tooltipRef.getBoundingClientRect()
    const tW = tooltipRect.width > 0 ? tooltipRect.width : TOOLTIP_WIDTH
    const tH = tooltipRect.height > 0 ? tooltipRect.height : TOOLTIP_HEIGHT

    let placement: Placement = getPlacement()

    const targetCenterX = targetRect.left + targetRect.width / 2
    const targetCenterY = targetRect.top + targetRect.height / 2

    if (placement === 'right') {
      if (targetRect.right + TOOLTIP_GAP + tW > vw) placement = 'left'
    } else if (placement === 'left') {
      if (targetRect.left - TOOLTIP_GAP - tW < 0) placement = 'right'
    }

    if (placement === 'bottom') {
      if (targetRect.bottom + TOOLTIP_GAP + tH > vh) placement = 'top'
    } else if (placement === 'top') {
      if (targetRect.top - TOOLTIP_GAP - tH < 0) placement = 'bottom'
    }

    if (placement === 'right' && targetRect.right > vw - tW * 0.5) {
      placement = 'bottom'
    } else if (placement === 'left' && targetRect.left < tW * 0.5) {
      placement = 'bottom'
    }

    let left: number
    let top: number

    switch (placement) {
      case 'bottom':
        left = targetCenterX - tW / 2
        top = targetRect.bottom + TOOLTIP_GAP
        break
      case 'top':
        left = targetCenterX - tW / 2
        top = targetRect.top - tH - TOOLTIP_GAP
        break
      case 'right':
        left = targetRect.right + TOOLTIP_GAP
        top = targetCenterY - tH / 2
        break
      case 'left':
        left = targetRect.left - tW - TOOLTIP_GAP
        top = targetCenterY - tH / 2
        break
    }

    left = Math.max(12, Math.min(left, vw - tW - 12))
    top = Math.max(12, Math.min(top, vh - tH - 12))

    tooltipRef.style.left = `${left}px`
    tooltipRef.style.top = `${top}px`
    tooltipRef.dataset.placement = placement
  }

  createEffect(() => {
    if (walkthroughActive()) {
      updateHighlight()
      updateTooltip()
      window.addEventListener('resize', () => {
        updateHighlight()
        updateTooltip()
      })
      window.addEventListener(
        'scroll',
        () => {
          updateHighlight()
          updateTooltip()
        },
        true,
      )
    }
  })

  onCleanup(() => {
    window.removeEventListener('resize', () => {
      updateHighlight()
      updateTooltip()
    })
    window.removeEventListener(
      'scroll',
      () => {
        updateHighlight()
        updateTooltip()
      },
      true,
    )
  })

  // Wait for target element to be in the DOM before positioning highlight/tooltip
  // This is critical when a tab switch occurs — the new tab's DOM takes
  // at least one frame to render, so we poll until the element appears.
  createEffect(() => {
    walkthroughStep()
    const step = currentStep()
    if (
      step === undefined ||
      step.targetSelector === undefined ||
      step.targetSelector === ''
    )
      return

    waitForTarget(step.targetSelector).then((found) => {
      if (found) {
        // Scroll element into view if needed (Settings often has overflow)
        scrollToTargetIfNeeded()
        // Position highlight/tooltip after any scroll settles
        requestAnimationFrame(() => {
          updateHighlight()
          updateTooltip()
        })
      }
    })
  })

  // Count steps in current section
  const sectionStepCount = createMemo(() => {
    const sec = currentSection()
    if (!sec) return { current: 0, total: 0 }
    const allSteps = steps()
    const secSteps = allSteps.filter((s) => s.section === sec.id)
    const currentSecStep = secSteps.indexOf(allSteps[walkthroughStep()])
    return {
      current: currentSecStep >= 0 ? currentSecStep + 1 : 1,
      total: secSteps.length,
    }
  })

  return (
    <Show when={walkthroughActive()}>
      <div class="walkthrough-overlay" onClick={endWalkthrough}>
        <div ref={highlightRef} class="walkthrough-highlight" />

        <div
          ref={tooltipRef}
          class="walkthrough-tooltip"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {/* Section header */}
          <Show when={currentSection()}>
            {(sec) => (
              <div class="walkthrough-section-header">
                <span class="walkthrough-section-title">{sec().title}</span>
                <span class="walkthrough-section-steps">
                  {sectionStepCount().current} / {sectionStepCount().total}
                </span>
              </div>
            )}
          </Show>

          <h3 class="walkthrough-step-title">{currentStep()?.title}</h3>
          <p class="walkthrough-step-desc">{currentStep()?.description}</p>
          <div class="walkthrough-actions">
            <button class="walkthrough-skip" onClick={endWalkthrough}>
              Skip Tour
            </button>
            <div class="walkthrough-actions-center">
              <button
                class="walkthrough-prev"
                onClick={prevWalkthroughStep}
                disabled={isFirst()}
              >
                <IconArrowLeft /> Back
              </button>
              <button
                class="walkthrough-skip-section"
                onClick={skipSection}
                title={`Skip ${currentSection()?.title} section`}
              >
                Skip Section
              </button>
              <button
                class="walkthrough-next"
                onClick={isLast() ? endWalkthrough : nextWalkthroughStep}
              >
                {isLast() ? (
                  'Finish'
                ) : (
                  <>
                    Next <IconArrowRight />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
