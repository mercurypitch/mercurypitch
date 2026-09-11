// ============================================================
// Changelog slot — the release notes, ABSENT from the store binary
// ============================================================
//
// `ChangelogModal` imports `CHANGELOG.md?raw`, so every word of the web
// app's release history is a string literal in whatever bundle reaches the
// modal. Some of those words sell things:
//
//   **Credits**: server processing costs 1 credit per song. Buy credit packs
//   (€5 / €10 / €20 / €40) through Stripe's secure checkout under
//   **Settings → Credits** ...
//
// That is a call to action pointing at a purchasing mechanism other than in
// app purchase, which is exactly what App Store guideline 3.1.1 and Play's
// billing policy reject -- and a store reviewer reads the binary, not only
// the screens. `IS_NATIVE_BUILD` already keeps PricingPanel and DonatePanel
// out; it has to keep the prose out too, because the guard on the panels is
// not a guard on the text describing them.
//
// So the same idiom, for the same reason: the constant folds to a literal,
// the dynamic import sits in a dead branch, and Rollup emits no chunk for
// the modal or for the markdown it inlines. Filtering the changelog instead
// would leave the next release's wording to luck.
//
// The store listing is where a native release says what changed; the version
// still shows in Settings → About either way. On the web nothing is lost --
// the modal becomes a chunk fetched when the surface holding it mounts,
// which takes the whole changelog out of the main bundle.

import type { Component } from 'solid-js'
import { lazy, Show, Suspense } from 'solid-js'
import { IS_NATIVE_BUILD } from '@/lib/native-build'

const LazyChangelogModal = IS_NATIVE_BUILD
  ? null
  : lazy(async () =>
      import('@/components/ChangelogModal').then((m) => ({
        default: m.ChangelogModal,
      })),
    )

/** Whether this build has release notes to open at all. False in the store
 *  binary, so the surfaces that offer them can hide the control rather than
 *  leave a button that does nothing. */
export const HAS_CHANGELOG = !IS_NATIVE_BUILD

export interface ChangelogModalSlotProps {
  open: boolean
  onClose: () => void
}

/** Mounts the changelog modal where there is one, and nothing where there
 *  is not. Drop-in for `<ChangelogModal />`. */
export const ChangelogModalSlot: Component<ChangelogModalSlotProps> = (
  props,
) => (
  <Show when={LazyChangelogModal} keyed>
    {(Modal) => (
      <Suspense>
        <Modal open={props.open} onClose={() => props.onClose()} />
      </Suspense>
    )}
  </Show>
)
