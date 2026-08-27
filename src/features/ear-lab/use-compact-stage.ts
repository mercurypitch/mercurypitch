// ============================================================
// useCompactStage — true when the stage is phone-narrow.
//
// The instruments crop their viewBox on a phone the way the mock
// did; the CSS container queries cannot reach an SVG's viewBox, so
// the same breakpoint is read here as a media query.
// ============================================================

import { createSignal, onCleanup, onMount } from 'solid-js'

export const COMPACT_STAGE_QUERY = '(max-width: 860px)'

export function useCompactStage(): () => boolean {
  const [compact, setCompact] = createSignal(false)

  onMount(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(COMPACT_STAGE_QUERY)
    const sync = () => setCompact(query.matches)
    sync()
    query.addEventListener('change', sync)
    onCleanup(() => query.removeEventListener('change', sync))
  })

  return compact
}
