// ============================================================
// useControlDockOffset — keep a container's top-docked
// ControlOverlay clear of its SongStatusBar. The bar's height is
// dynamic (flex-wrap on narrow screens, the collapsible track
// dock), so a static offset overlaps; measure instead and write
// --control-dock-top-offset on the positioning container.
// ============================================================

import { onCleanup, onMount } from 'solid-js'

const GAP_PX = 12

export function useControlDockOffset(
  getBarEl: () => HTMLElement | undefined,
): void {
  onMount(() => {
    const el = getBarEl()
    if (!el || typeof ResizeObserver === 'undefined') return
    const container = el.parentElement
    if (!container) return

    const apply = () => {
      container.style.setProperty(
        '--control-dock-top-offset',
        `${el.offsetTop + el.offsetHeight + GAP_PX}px`,
      )
    }
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    // Belt and braces alongside the observer: viewport changes re-wrap the
    // bar, and the first paint can measure before async content (scrubber,
    // import status) lands.
    window.addEventListener('resize', apply)
    apply()
    const settleTimer = setTimeout(apply, 350)

    onCleanup(() => {
      ro.disconnect()
      window.removeEventListener('resize', apply)
      clearTimeout(settleTimer)
      container.style.removeProperty('--control-dock-top-offset')
    })
  })
}
