// ============================================================
// Plan back — shows a lesson's way back to the plan to someone who answered it
// ============================================================
//
// A lesson page is its own document and cannot ask the app whether the plan
// was answered. So its "Back to your plan" link sits in the markup, hidden,
// and the page's boot calls bootPlanBackLink, which reads the stored plan
// record: the text under PLAN_RECORD_KEY, which syncs to the account, so a
// plan answered on another device counts here once the app has pulled it.
//
// Three choices keep this safe to call from a lesson's boot:
//
// - The only import is the key, from a file with no imports of its own
//   (features/plan/plan-keys.ts), and a lesson loads this file by a dynamic
//   import: its chunk holds this file and the key, and the lesson's first
//   paint grows by nothing.
// - The check is the app's, minus the questions. The app opens its review only
//   for a record isPlanRecordV1 accepts, and that checks the whole record: its
//   version, status, way in and date, and every choice id. The ids would pull
//   the questions into every lesson, so a record counts here when it is an
//   object with `v` 1 and `status` 'answered'. Anything else is no plan: a
//   newer client's record (v 2), broken text, half a write. The one gap is a
//   version 1 record the app cannot read for another reason, an id it does not
//   know, say. The link then opens the four questions, because the app reads
//   that record as no plan; #/plan opens either way, never to an error.
// - The read is guarded, here and only here. A browser that blocks site data
//   throws when a page reaches for localStorage, and a throw in a lesson's boot
//   would stop everything after it, so a blocked read leaves the link hidden.
//   The read runs again when the page comes back from the back/forward cache
//   (pageshow with persisted), so a lesson restored after the singer answered
//   in the app shows the link.

import { PLAN_RECORD_KEY } from '@/features/plan/plan-keys'

/** Is this stored text a version 1 plan record whose four questions were answered? */
function isAnsweredPlan(raw: string | null): boolean {
  if (raw === null) return false
  try {
    const record: unknown = JSON.parse(raw)
    if (typeof record !== 'object' || record === null) return false
    const { v, status } = record as { v?: unknown; status?: unknown }
    return v === 1 && status === 'answered'
  } catch {
    return false
  }
}

/**
 * Shows every `a[data-plan-back]` on the page when `raw`, the stored plan
 * record, says the plan was answered. Leaves them hidden otherwise.
 */
export function revealPlanBackLink(doc: Document, raw: string | null): void {
  if (!isAnsweredPlan(raw)) return
  doc
    .querySelectorAll<HTMLAnchorElement>('a[data-plan-back]')
    .forEach((link) => {
      link.hidden = false
    })
}

/** The stored plan record's text, or null when there is none or storage is blocked. */
function readStoredPlan(): string | null {
  try {
    return window.localStorage.getItem(PLAN_RECORD_KEY)
  } catch {
    return null
  }
}

/**
 * A lesson's one call for its way back to the plan: shows the link when the
 * stored plan was answered, and looks again when the page is restored from the
 * back/forward cache. Never throws, so blocked storage cannot stop the boot.
 */
export function bootPlanBackLink(doc: Document): void {
  const reveal = (): void => revealPlanBackLink(doc, readStoredPlan())
  reveal()
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) reveal()
  })
}
