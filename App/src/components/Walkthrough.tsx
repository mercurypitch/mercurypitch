// ============================================================
// Walkthrough — Section-based spotlight guide tour (GH #140, #199)
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, onCleanup, Show } from 'solid-js'
import type { WalkthroughStep } from '@/stores/app-store'
import {
  appStore,
  endWalkthrough,
  GUIDE_SECTIONS,
  nextWalkthroughStep,
  prevWalkthroughStep,
  setActiveTab,
  skipSection,
} from '@/stores/app-store'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const TOOLTIP_GAP = 12
const TOOLTIP_WIDTH = 340
const TOOLTIP_HEIGHT = 200

export const Walkthrough: Component = () => {
  let highlightRef: HTMLDivElement | undefined
  let tooltipRef: HTMLDivElement | undefined

  // Derived signals
  const steps = () => appStore.tourSteps()
  const currentStep = (): WalkthroughStep | undefined => {
    const s = steps()
    return s[appStore.walkthroughStep()]
  }
  const isLast = () => {
    const s = steps()
    return appStore.walkthroughStep() === s.length - 1
  }
  const isFirst = () => appStore.walkthroughStep() === 0

  // Current section info
  const currentSection = () => {
    const step = currentStep()
    if (!step || step.section === undefined || step.section === null || step.section === '') return null
    return GUIDE_SECTIONS.find(s => s.id === step.section) ?? null
  }

  const getPlacement = (): Placement => currentStep()?.placement ?? 'bottom'

  // Auto-switch tab when step has requiredTab
  createEffect(() => {
    const step = currentStep()
    if (step?.requiredTab) {
      setActiveTab(step.requiredTab)
    }
  })

  const updateHighlight = () => {
    if (!highlightRef) return
    const step = currentStep()
    if (!step) return
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
    if (!tooltipRef) return
    const step = currentStep()
    if (!step) return
    const el = document.querySelector(step.targetSelector)
    if (!el) {
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
    if (appStore.walkthroughActive()) {
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

  createEffect(() => {
    appStore.walkthroughStep()
    updateHighlight()
    updateTooltip()
  })

  // Count steps in current section
  const sectionStepCount = createMemo(() => {
    const sec = currentSection()
    if (!sec) return { current: 0, total: 0 }
    const allSteps = steps()
    const secSteps = allSteps.filter(s => s.section === sec.id)
    const currentSecStep = secSteps.indexOf(
      allSteps[appStore.walkthroughStep()]
    )
    return {
      current: currentSecStep >= 0 ? currentSecStep + 1 : 1,
      total: secSteps.length,
    }
  })

  return (
    <Show when={appStore.walkthroughActive()}>
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

          <h3 class="walkthrough-step-title">
            {currentStep()?.title}
          </h3>
          <p class="walkthrough-step-desc">
            {currentStep()?.description}
          </p>
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
                ← Back
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
                {isLast() ? 'Finish' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
