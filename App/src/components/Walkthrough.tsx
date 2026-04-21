// ============================================================
// Walkthrough — Step-by-step tutorial overlay (GH #140, GH #145)
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, Show } from 'solid-js'
import { appStore, endWalkthrough, nextWalkthroughStep, prevWalkthroughStep, WALKTHROUGH_STEPS, } from '@/stores/app-store'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const TOOLTIP_GAP = 12
const TOOLTIP_WIDTH = 340
const TOOLTIP_HEIGHT = 200

export const Walkthrough: Component = () => {
  const currentStep = () =>
    WALKTHROUGH_STEPS[appStore.walkthroughStep()] ?? WALKTHROUGH_STEPS[0]
  const isLast = () =>
    appStore.walkthroughStep() === WALKTHROUGH_STEPS.length - 1
  const isFirst = () =>
    appStore.walkthroughStep() === 0

  let highlightRef: HTMLDivElement | undefined
  let tooltipRef: HTMLDivElement | undefined

  const getPlacement = (): Placement => currentStep().placement ?? 'bottom'

  const updateHighlight = () => {
    if (!highlightRef) return
    const el = document.querySelector(currentStep().targetSelector)
    if (!el) {
      // If target doesn't exist, don't show highlight ring
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
    // Fallback when target element is not available - show tooltip in center of screen
    if (!tooltipRef) return
    const left = (vw - tW) / 2
    const top = (vh - tH) / 2
    tooltipRef.style.left = `${left}px`
    tooltipRef.style.top = `${top}px`
    tooltipRef.dataset.placement = 'bottom'
  }

  const updateTooltip = () => {
    if (!tooltipRef) return
    const el = document.querySelector(currentStep().targetSelector)
    if (!el) {
      // Target element doesn't exist - show tooltip centered
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

    // Use measured dimensions if available, otherwise fall back to constants
    const tooltipRect = tooltipRef.getBoundingClientRect()
    const tW = tooltipRect.width > 0 ? tooltipRect.width : TOOLTIP_WIDTH
    const tH = tooltipRect.height > 0 ? tooltipRect.height : TOOLTIP_HEIGHT

    // Get desired placement, then check for overflow and flip if needed
    let placement: Placement = getPlacement()

    const targetCenterX = targetRect.left + targetRect.width / 2
    const targetCenterY = targetRect.top + targetRect.height / 2

    // Flip horizontal placements if tooltip would overflow
    if (placement === 'right') {
      const wouldOverflowRight = targetRect.right + TOOLTIP_GAP + tW > vw
      if (wouldOverflowRight) {
        placement = 'left'
      }
    } else if (placement === 'left') {
      const wouldOverflowLeft = targetRect.left - TOOLTIP_GAP - tW < 0
      if (wouldOverflowLeft) {
        placement = 'right'
      }
    }

    // Flip vertical placements if tooltip would overflow
    if (placement === 'bottom') {
      const wouldOverflowBottom = targetRect.bottom + TOOLTIP_GAP + tH > vh
      if (wouldOverflowBottom) {
        placement = 'top'
      }
    } else if (placement === 'top') {
      const wouldOverflowTop = targetRect.top - TOOLTIP_GAP - tH < 0
      if (wouldOverflowTop) {
        placement = 'bottom'
      }
    }

    // If target is too close to a horizontal edge and we're trying horizontal
    // placement, fall back to vertical
    if (placement === 'right' && targetRect.right > vw - tW * 0.5) {
      placement = 'bottom'
    } else if (placement === 'left' && targetRect.left < tW * 0.5) {
      placement = 'bottom'
    }

    // Also check if all placements overflow — in that case clamp to nearest edge
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

    // Clamp so tooltip stays within viewport
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

  // Update both when step changes
  createEffect(() => {
    appStore.walkthroughStep() // dependency
    updateHighlight()
    updateTooltip()
  })

  return (
    <Show when={appStore.walkthroughActive()}>
      <div class="walkthrough-overlay" onClick={endWalkthrough}>
        {/* Highlight ring around target */}
        <div ref={highlightRef} class="walkthrough-highlight" />

        {/* Tooltip card */}
        <div
          ref={tooltipRef}
          class="walkthrough-tooltip"
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <div class="walkthrough-step-counter">
            Step {appStore.walkthroughStep() + 1} of {WALKTHROUGH_STEPS.length}
          </div>
          <h3 class="walkthrough-step-title">{currentStep().title}</h3>
          <p class="walkthrough-step-desc">{currentStep().description}</p>
          <div class="walkthrough-actions">
            <button class="walkthrough-skip" onClick={endWalkthrough}>
              Skip tour
            </button>
            <button
              class="walkthrough-prev"
              onClick={prevWalkthroughStep}
              disabled={isFirst()}
            >
              ← Back
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
    </Show>
  )
}