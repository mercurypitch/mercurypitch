// ============================================================
// foot-space — what each layer pinned to the window's foot takes
// ============================================================
//
// Publishes the room an element pinned to the bottom of the window takes, as
// a custom property on <html>. The foot of a phone screen holds a stack, and
// no layer of it may cover another:
//
//   toasts                      stand on all of these (Notifications.module.css)
//   a page's docked transport   --page-dock-space      (StudioTransport, phone;
//                                 it sits on the tab bar, so it counts it too)
//   confirm-email bar           --verify-banner-space  (VerifyEmailBanner)
//   cookie consent banner       --consent-banner-space (ConsentBanner)
//   tab bar                     --tabbar-space         (BottomTabBar)
//
// Each layer positions itself in CSS on the spaces of the layers below it and
// publishes its own, so the one above can do the same. The layers live in
// different roots (the consent banner mounts its own), so a variable on
// <html> is the one place all of them can read.

import { onCleanup } from 'solid-js'

/**
 * Publish `el`'s footprint (its height plus its gap to the window's foot) as
 * `name` on <html> for as long as the calling owner lives, and nothing while
 * it is not displayed. Measured without transforms, so a slide-in does not
 * skew it. Call it from a `ref`.
 */
export function publishFootSpace(el: HTMLElement, name: string): void {
  const root = document.documentElement
  let last: string | null = null
  const update = (): void => {
    // A pill CSS hides at this width (the confirm bar's desktop pill on a
    // phone) takes no room, and must not lift the layers above it.
    const style = window.getComputedStyle(el)
    let next: string | null = null
    if (style.display !== 'none') {
      // A bar in the page flow has no `bottom`; its gap is what lies below
      // it, such as the tab bar under the Studio's phone dock.
      const bottom = Number.parseFloat(style.bottom)
      const gap = Number.isFinite(bottom)
        ? bottom
        : Math.max(0, window.innerHeight - el.getBoundingClientRect().bottom)
      const space = el.offsetHeight + gap
      next = `${Math.ceil(space)}px`
    }
    if (next === last) return
    last = next
    if (next === null) root.style.removeProperty(name)
    else root.style.setProperty(name, next)
  }
  update()
  // A ref runs before its element is in the document; measure again once
  // it is, for a pill that is hidden there and never resizes.
  queueMicrotask(update)
  const resized =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
  resized?.observe(el)
  // A layer below can move this one without resizing it: the consent banner
  // rises when the tab bar mounts, and the confirm bar rises with it. Their
  // spaces land on <html>'s style, so a change there is a cue to measure
  // again. Writing an unchanged value is skipped above, so this settles.
  const moved =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(update)
  moved?.observe(root, { attributes: true, attributeFilter: ['style'] })
  window.addEventListener('resize', update)
  onCleanup(() => {
    resized?.disconnect()
    moved?.disconnect()
    window.removeEventListener('resize', update)
    root.style.removeProperty(name)
  })
}
