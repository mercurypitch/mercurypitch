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
//                                 it sits on the tab bar, so it counts it too;
//                                 a phone stage's TransportBar, and Karaoke's
//                                 stage's bar, while they span the foot; and
//                                 the console of Merc's Ear Lab room, as what
//                                 lies under its stage)
//   confirm-email bar           --verify-banner-space  (VerifyEmailBanner)
//   cookie consent banner       --consent-banner-space (ConsentBanner)
//   tab bar                     --tabbar-space         (BottomTabBar)
//
// On a phone on its side the notices stand at the foot's right end, beside
// a stage's left column, and a column wider than their room says how wide
// it is: --page-column-space (Karaoke's stage, whose bar is in its column).
//
// Each layer positions itself in CSS on the spaces of the layers below it and
// publishes its own, so the one above can do the same. The layers live in
// different roots (the consent banner mounts its own), so a variable on
// <html> is the one place all of them can read.

import { createEffect, on, onCleanup } from 'solid-js'

/** What a page's own transport, docked at the window's foot, takes. */
export const PAGE_DOCK_SPACE = '--page-dock-space'

/** What a stage's left column takes of the foot's width, on a phone on its
 *  side: the notices stand beside it. */
export const PAGE_COLUMN_SPACE = '--page-column-space'

/**
 * Publish `el`'s footprint (its height plus its gap to the window's foot) as
 * `name` on <html> for as long as the calling owner lives, and nothing while
 * it is not displayed. Measured without transforms, so a slide-in does not
 * skew it. Call it from a `ref`.
 *
 * With `of` 'below', what is published is what lies under `el`, down to the
 * window's foot: for a dock that is whatever stands under a stage. With
 * 'beside', it is what `el` takes of the foot's width from the window's left
 * edge: a stage's left column, which the notices stand beside.
 *
 * With `when`, it publishes only while `when` says so, and takes its room
 * back as soon as it does not: a bar that stands across the foot upright
 * and in a column beside the notices on its side.
 */
export function publishFootSpace(
  el: HTMLElement,
  name: string,
  of: 'self' | 'below' | 'beside' = 'self',
  when?: () => boolean,
): void {
  const root = document.documentElement
  let last: string | null = null
  const update = (): void => {
    // A pill CSS hides at this width (the confirm bar's desktop pill on a
    // phone) takes no room, and must not lift the layers above it.
    const style = window.getComputedStyle(el)
    let next: string | null = null
    if (style.display !== 'none' && when?.() !== false) {
      const below = (): number =>
        Math.max(0, window.innerHeight - el.getBoundingClientRect().bottom)
      // A bar in the page flow has no `bottom` of its own (a relative one
      // reads 0px); its gap is what lies below it, such as the tab bar under
      // the Studio's phone dock or under a phone stage's transport.
      const inFlow =
        style.position === 'static' || style.position === 'relative'
      const bottom = Number.parseFloat(style.bottom)
      const gap = !inFlow && Number.isFinite(bottom) ? bottom : below()
      const space =
        of === 'below'
          ? below()
          : of === 'beside'
            ? Math.max(0, el.getBoundingClientRect().right)
            : el.offsetHeight + gap
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
  // A turn of the phone changes the answer before it resizes anything here.
  if (when !== undefined) createEffect(on(when, update, { defer: true }))
  onCleanup(() => {
    resized?.disconnect()
    moved?.disconnect()
    window.removeEventListener('resize', update)
    root.style.removeProperty(name)
  })
}
