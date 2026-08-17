// ============================================================
// Point at a sidebar panel instead of navigating away from it
// ============================================================
//
// Asked for after the noisy-room toast worked as intended: the advice was
// right, but taking it meant leaving the screen. "Not sure if we could link it
// to sidebar setting given user is on a page where that settings would be seen
// in sidebar, that way he doesn't have to go out of the view, especially on
// mobile."
//
// The mic panel is a universal sidebar panel — `sidebarPanelIdsFor` appends it
// to any tab whose layout omits it — so the control the toast is talking about
// is almost always a few pixels away rather than a tab change away. When it is
// reachable, reveal it; only fall back to the Settings page when it is not.

import type { SidebarPanelId } from '@/features/sidebar/sidebar-registry'

/** How long the highlight sits on the revealed panel. */
export const PANEL_FLASH_MS = 1600

export const PANEL_FLASH_CLASS = 'sidebar-panel-flash'

export interface RevealPanelEnv {
  /** Defaults to the live document. */
  root?: Pick<Document, 'querySelector'>
  /** Opens the mobile drawer. Defaults to the ui-store setter. */
  openSidebar?: (open: boolean) => void
  /** Test seam for the flash timer. */
  schedule?: (fn: () => void, ms: number) => void
  /** Test seam for the post-open frame. */
  nextFrame?: (fn: () => void) => void
  /** Reports whether an element is actually laid out. */
  isDisplayed?: (el: Element) => boolean
}

const defaultIsDisplayed = (el: Element): boolean =>
  el.getBoundingClientRect().width > 0 || el.getBoundingClientRect().height > 0

/**
 * Scroll a sidebar panel into view and flash it. Returns false when the panel
 * is not in the DOM at all, which is the caller's signal to fall back to the
 * full Settings page.
 *
 * On a phone the sidebar is a drawer, so a panel that exists but is not laid
 * out means "closed", not "absent" — opening it is exactly the shortcut being
 * asked for, and still beats a tab change.
 */
export function revealSidebarPanel(
  id: SidebarPanelId,
  env: RevealPanelEnv = {},
): boolean {
  const root =
    env.root ?? (typeof document === 'undefined' ? undefined : document)
  if (root === undefined) return false

  const panel = root.querySelector(`[data-sidebar-panel="${id}"]`)
  if (panel === null) return false

  const isDisplayed = env.isDisplayed ?? defaultIsDisplayed
  const schedule = env.schedule ?? ((fn, ms) => setTimeout(fn, ms))
  const nextFrame =
    env.nextFrame ??
    ((fn) => {
      if (typeof requestAnimationFrame === 'undefined') fn()
      else requestAnimationFrame(fn)
    })

  const highlight = (): void => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' })
    panel.classList.add(PANEL_FLASH_CLASS)
    schedule(() => {
      panel.classList.remove(PANEL_FLASH_CLASS)
    }, PANEL_FLASH_MS)
  }

  if (isDisplayed(panel)) {
    highlight()
    return true
  }

  env.openSidebar?.(true)
  nextFrame(highlight)
  return true
}
