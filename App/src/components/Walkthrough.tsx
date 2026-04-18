// ============================================================
// Walkthrough — Step-by-step tutorial overlay (GH #140)
// ============================================================

import { Component, createEffect, onCleanup, Show } from 'solid-js';
import {
  appStore,
  WALKTHROUGH_STEPS,
  endWalkthrough,
  nextWalkthroughStep,
  prevWalkthroughStep,
} from '@/stores/app-store';

export const Walkthrough: Component = () => {
  const currentStep = () =>
    WALKTHROUGH_STEPS[appStore.walkthroughStep()] ?? WALKTHROUGH_STEPS[0];
  const isLast = () =>
    appStore.walkthroughStep() === WALKTHROUGH_STEPS.length - 1;
  const isFirst = () => appStore.walkthroughStep() === 0;

  let highlightRef: HTMLDivElement | undefined;
  const placement = () => currentStep().placement ?? 'bottom';

  const updateHighlight = () => {
    if (!highlightRef) return;
    const el = document.querySelector(currentStep().targetSelector);
    if (!el) {
      highlightRef.style.display = 'none';
      return;
    }
    highlightRef.style.display = '';
    const rect = el.getBoundingClientRect();
    const padding = 6;
    highlightRef.style.top = `${rect.top - padding}px`;
    highlightRef.style.left = `${rect.left - padding}px`;
    highlightRef.style.width = `${rect.width + padding * 2}px`;
    highlightRef.style.height = `${rect.height + padding * 2}px`;
  };

  createEffect(() => {
    if (appStore.walkthroughActive()) {
      updateHighlight();
      window.addEventListener('resize', updateHighlight);
      window.addEventListener('scroll', updateHighlight, true);
    }
  });

  onCleanup(() => {
    window.removeEventListener('resize', updateHighlight);
    window.removeEventListener('scroll', updateHighlight, true);
  });

  // Update highlight whenever step changes
  createEffect(() => {
    appStore.walkthroughStep(); // dependency
    updateHighlight();
  });

  return (
    <Show when={appStore.walkthroughActive()}>
      <div class="walkthrough-overlay" onClick={endWalkthrough}>
        {/* Highlight ring around target */}
        <div ref={highlightRef!} class="walkthrough-highlight" />

        {/* Tooltip card */}
        <div
          class={`walkthrough-tooltip walkthrough-tooltip-${placement()}`}
          onClick={(e) => e.stopPropagation()}
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
  );
};
