// ============================================================
// Walkthrough — Section-based spotlight guide tour (GH #140, #199)
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, createMemo, Index, onCleanup, Show } from 'solid-js'
import { IconArrowLeft, IconArrowRight, } from '@/components/hidden-features-icons'
import { isNarrow } from '@/lib/use-viewport'
import type { WalkthroughStep } from '@/stores/app-store'
import { setWalkthroughStep, walkthroughStep } from '@/stores/app-store'
import { tourSteps, walkthroughActive } from '@/stores/app-store'
import { endWalkthrough, GUIDE_SECTIONS, nextWalkthroughStep, prevWalkthroughStep, skipSection, startWalkthrough, } from '@/stores/app-store'
import { activeTab, setActiveTab, setSidebarOpen } from '@/stores/ui-store'
import styles from './Walkthrough.module.css'

type Placement = 'top' | 'bottom' | 'left' | 'right'

const TOOLTIP_GAP = 12
const getTooltipWidth = () => Math.min(340, window.innerWidth - 24)
const getTooltipHeight = () => Math.min(200, window.innerHeight - 48)
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Compact action-row glyphs (16px). Icon-only buttons keep the spotlight tight
// on small screens; the label lives in title/aria-label.
const IconClose = () => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
const IconSkipForward = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5 5l9 7-9 7z" />
    <rect x="15" y="5" width="3" height="14" rx="1" />
  </svg>
)
const IconCheck = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5L20 7" />
  </svg>
)

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

  // True when this is the final step of its section (the next step belongs to a
  // different section, or there is no next step). In the full walkthrough this
  // is where one section hands off to the next; in a single-section tour it
  // coincides with isLast().
  const isLastInSection = () => {
    const sec = currentSection()
    if (!sec) return false
    const s = steps()
    const i = walkthroughStep()
    return i >= s.length - 1 || s[i + 1]?.section !== sec.id
  }

  // The guide section that follows the current step's, if any. Drives the
  // "continue to the next section" affordance on a section's final step.
  const nextSection = createMemo(() => {
    const sec = currentSection()
    if (!sec) return null
    const i = GUIDE_SECTIONS.findIndex((s) => s.id === sec.id)
    return i >= 0 && i < GUIDE_SECTIONS.length - 1
      ? GUIDE_SECTIONS[i + 1]
      : null
  })

  // Continue into the next section: jump to its first step if it's already in
  // this tour (the full walkthrough), otherwise start it as its own tour.
  const goToNextSection = () => {
    const next = nextSection()
    if (!next) return
    const idx = steps().findIndex((s) => s.section === next.id)
    if (idx >= 0) setWalkthroughStep(idx)
    else startWalkthrough([next.id])
  }

  const advance = () => {
    if (isLast()) endWalkthrough()
    else nextWalkthroughStep()
  }

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

  // Keyboard navigation (desktop): →/Enter next, ← back, Esc closes. Skip when
  // typing in a field, and let a focused tooltip button handle its own Enter.
  createEffect(() => {
    if (!walkthroughActive()) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return
      if (e.key === 'Escape') {
        e.preventDefault()
        endWalkthrough()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevWalkthroughStep()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        advance()
      } else if (e.key === 'Enter') {
        if (t && t.tagName === 'BUTTON') return
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
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
    const needsScrollV =
      r.top < -margin || r.bottom > window.innerHeight + margin
    // Horizontally-scrolling containers (e.g. the overflow-x control bar on
    // mobile/narrow screens) can park a target off to the side while it's still
    // vertically in view. Detect that too so scrollIntoView reels in the right
    // scroll ancestor — otherwise toolbar steps (BPM, Volume, play modes) would
    // highlight an off-screen element.
    const needsScrollH =
      r.left < -margin || r.right > window.innerWidth + margin
    if (!needsScrollV && !needsScrollH) return

    // Targets taller than most of the viewport (e.g. a full card grid) look
    // wrong centered — it scrolls past their top. Align those to the top
    // instead; center everything else. Instant scroll so highlight/tooltip
    // update immediately.
    const tall = r.height > window.innerHeight * 0.8
    el.scrollIntoView({
      behavior: 'auto',
      block: tall ? 'start' : 'center',
      inline: 'center',
    })
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
      const tW = tooltipRect.width > 0 ? tooltipRect.width : getTooltipWidth()
      const tH =
        tooltipRect.height > 0 ? tooltipRect.height : getTooltipHeight()
      updateTooltipCentered(tW, tH, vw, vh)
      return
    }
    tooltipRef.style.opacity = ''

    const targetRect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const tooltipRect = tooltipRef.getBoundingClientRect()
    const tW = tooltipRect.width > 0 ? tooltipRect.width : getTooltipWidth()
    const tH = tooltipRect.height > 0 ? tooltipRect.height : getTooltipHeight()

    let placement: Placement = getPlacement()

    // On narrow viewports, prefer bottom placement to avoid horizontal overflow
    if (vw < 480 && (placement === 'left' || placement === 'right')) {
      placement = 'bottom'
    }

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

  // Single stable handler so add/remove pair up (the previous anonymous-fn
  // versions never detached, leaking a listener per step). Reposition on
  // resize, orientation change (mobile), and scroll while the tour is active.
  const reposition = () => {
    updateHighlight()
    updateTooltip()
  }

  createEffect(() => {
    if (!walkthroughActive()) return
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('orientationchange', reposition)
    window.addEventListener('scroll', reposition, true)
    onCleanup(() => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('orientationchange', reposition)
      window.removeEventListener('scroll', reposition, true)
    })
  })

  // Prepare a step's UI before highlighting: open the mobile sidebar if the
  // target lives there, then click through any `navigate` selectors (sub-tabs,
  // sub-views, dropdowns) to reveal the target. Each click is polled-for and
  // awaited, so a single tour can walk through nested UI to reach any element.
  // A generation token cancels a stale preparation when the step changes mid-run.
  let prepGen = 0
  let tourOpenedSidebar = false
  // Collapse toggles the tour expanded (via step.reveal) so we can restore
  // them when it ends — mirrors tourOpenedSidebar.
  const tourExpandedReveals = new Set<string>()

  const prepareAndPosition = async (): Promise<void> => {
    const gen = ++prepGen
    const step = currentStep()
    if (
      step === undefined ||
      step.targetSelector === undefined ||
      step.targetSelector === ''
    )
      return

    // Narrow: open the off-canvas sidebar only for sidebar-anchored steps.
    if (isNarrow()) {
      const want = step.inSidebar === true
      setSidebarOpen(want)
      if (want) tourOpenedSidebar = true
      // Give the drawer a frame to slide in before measuring.
      await wait(want ? 240 : 0)
    }

    // Click through the navigation path (sub-tabs, sub-views, dropdowns).
    if (step.navigate) {
      for (const sel of step.navigate) {
        if (gen !== prepGen) return
        const ok = await waitForTarget(sel)
        if (gen !== prepGen) return
        const el = ok ? document.querySelector(sel) : null
        if (el instanceof HTMLElement) {
          el.click()
          await wait(140) // let the revealed sub-view render
        }
      }
    }

    // Expand a collapsed control group (e.g. the "more" panel that hides
    // BPM/volume) so the target is visible. Idempotent — only when collapsed.
    if (step.reveal !== undefined && step.reveal !== '') {
      const ok = await waitForTarget(step.reveal)
      if (gen !== prepGen) return
      const toggle = ok ? document.querySelector(step.reveal) : null
      if (
        toggle instanceof HTMLElement &&
        toggle.getAttribute('aria-expanded') === 'false'
      ) {
        toggle.click()
        tourExpandedReveals.add(step.reveal)
        await wait(240) // let the group expand (.moreGroup transition is 0.22s)
      }
    }

    if (gen !== prepGen) return
    const found = await waitForTarget(step.targetSelector)
    if (gen !== prepGen || !found) return
    scrollToTargetIfNeeded()
    // Position immediately (scrollIntoView is synchronous) so the spotlight
    // doesn't wait on a frame — and so it still lands when rAF is throttled,
    // e.g. a backgrounded tab. The rAF below just refines once layout settles.
    updateHighlight()
    updateTooltip()
    requestAnimationFrame(() => {
      updateHighlight()
      updateTooltip()
    })
  }

  // Re-prepare whenever the step OR the step list changes while active. Reading
  // tourSteps() here matters: starting a fresh tour that also begins at step 0
  // wouldn't re-trigger on walkthroughStep alone (same value), so prep would be
  // skipped and the spotlight would keep the previous tour's position.
  createEffect(() => {
    walkthroughStep()
    tourSteps()
    if (!walkthroughActive()) return
    void prepareAndPosition()
  })

  // Restore what the tour changed once it ends: close any sidebar it opened
  // (mobile only) and collapse any control groups it expanded. Guarded by flags
  // so we never fight state the user set themselves.
  createEffect(() => {
    if (walkthroughActive()) return
    if (tourOpenedSidebar) {
      setSidebarOpen(false)
      tourOpenedSidebar = false
    }
    if (tourExpandedReveals.size > 0) {
      for (const sel of tourExpandedReveals) {
        const toggle = document.querySelector(sel)
        if (
          toggle instanceof HTMLElement &&
          toggle.getAttribute('aria-expanded') === 'true'
        ) {
          toggle.click()
        }
      }
      tourExpandedReveals.clear()
    }
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

  // Progress dots: scoped to the current section when sectioned (the full
  // walkthrough), else the whole tour (page tours). `current` is 1-based.
  const dotProgress = createMemo(() => {
    if (currentSection()) return sectionStepCount()
    return { current: walkthroughStep() + 1, total: steps().length }
  })

  // Jump straight to a step by clicking its progress dot. Dots are
  // section-scoped (full walkthrough), so map the dot index back to the step's
  // overall position; the prepare effect re-runs nav/reveal for the new step.
  const goToDot = (dotIndex: number) => {
    const sec = currentSection()
    if (!sec) {
      setWalkthroughStep(dotIndex)
      return
    }
    const overallIdx = steps().findIndex(
      (s, idx) =>
        s.section === sec.id &&
        steps()
          .slice(0, idx)
          .filter((p) => p.section === sec.id).length === dotIndex,
    )
    if (overallIdx >= 0) setWalkthroughStep(overallIdx)
  }

  return (
    <Show when={walkthroughActive()}>
      <div class={styles.walkthroughOverlay} onClick={endWalkthrough}>
        <div ref={highlightRef} class={styles.walkthroughHighlight} />

        <div
          ref={tooltipRef}
          class={styles.walkthroughTooltip}
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          {/* Skip the whole tour (sits like a dialog close). */}
          <button
            class={styles.walkthroughClose}
            onClick={endWalkthrough}
            title="Skip tour"
            aria-label="Skip tour"
          >
            <IconClose />
          </button>

          <Show when={currentSection()}>
            {(sec) => (
              <div class={styles.walkthroughSectionTitle}>{sec().title}</div>
            )}
          </Show>

          <h3 class={styles.walkthroughStepTitle}>{currentStep()?.title}</h3>
          <p class={styles.walkthroughStepDesc}>{currentStep()?.description}</p>

          <div class={styles.walkthroughActions}>
            {/* Progress dots — click to jump to a step. */}
            <div
              class={styles.walkthroughDots}
              role="group"
              aria-label="Tour steps"
            >
              <Index each={Array.from({ length: dotProgress().total })}>
                {(_, i) => (
                  <button
                    type="button"
                    class={styles.walkthroughDot}
                    classList={{
                      [styles.walkthroughDotActive]:
                        i === dotProgress().current - 1,
                      [styles.walkthroughDotDone]:
                        i < dotProgress().current - 1,
                    }}
                    onClick={() => goToDot(i)}
                    title={`Step ${i + 1}`}
                    aria-label={`Go to step ${i + 1}`}
                    aria-current={
                      i === dotProgress().current - 1 ? 'step' : undefined
                    }
                  />
                )}
              </Index>
            </div>

            {/* Icon-only controls: back · skip section · next/finish */}
            <div class={styles.walkthroughActionsCenter}>
              <button
                class={styles.walkthroughIconBtn}
                onClick={prevWalkthroughStep}
                disabled={isFirst()}
                title="Back"
                aria-label="Back"
              >
                <IconArrowLeft />
              </button>
              {/* Mid-section: skip the rest of this section. */}
              <Show when={!isLastInSection() && currentSection()}>
                {(sec) => (
                  <button
                    class={styles.walkthroughIconBtn}
                    onClick={skipSection}
                    title={`Skip ${sec().title} section`}
                    aria-label="Skip section"
                  >
                    <IconSkipForward />
                  </button>
                )}
              </Show>
              {/* Final step of a section: offer to carry on into the next one
                  instead of just finishing. */}
              <Show when={isLastInSection() ? nextSection() : null} keyed>
                {(next) => (
                  <button
                    class={styles.walkthroughNextSection}
                    onClick={goToNextSection}
                    title={`Continue to ${next.title}`}
                    aria-label={`Continue to ${next.title}`}
                  >
                    <span>{next.title}</span>
                    <IconArrowRight />
                  </button>
                )}
              </Show>
              <button
                class={styles.walkthroughNext}
                onClick={advance}
                title={isLast() ? 'Finish' : 'Next'}
                aria-label={isLast() ? 'Finish' : 'Next'}
              >
                <Show when={isLast()} fallback={<IconArrowRight />}>
                  <IconCheck />
                </Show>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
