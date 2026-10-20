// ============================================================
// Mount the Warm-up path's fixture in place of the app (dev server only)
// ============================================================
//
// The native entry calls this behind `import.meta.env.DEV` when the page
// is opened with `?warmFixture=<name>` (WarmUpFixture.tsx), so it exists
// only on the dev server and no build carries it. `&warmLive=1` plays the
// state's arrival (the end's sequence, the card and countdown) instead of
// settling it; with `&warmLand=1` as well, `start` opens as the native
// onboarding's landing (path-landing.ts): the path draws in and Merc hops
// from the floor beside the first stop.

import { render } from 'solid-js/web'
import { askPathLanding } from '../path-landing'
import { isWarmFixtureName } from './fixture-runs'
import { WarmUpFixture } from './WarmUpFixture'

/**
 * Mount the named fixture in `root`; false when there is no such fixture.
 * The root is marked loaded as the app marks it on mount: unmarked, the
 * root stays hidden and the boot watchdog reports a start that never came.
 * `&warmUnlocks=<n>` gives the run n stand-in unlocks (fixture-runs.ts).
 */
export function mountWarmFixture(root: HTMLElement, name: string): boolean {
  if (!isWarmFixtureName(name)) return false
  const query = new URLSearchParams(window.location.search)
  const unlocks = Number(query.get('warmUnlocks') ?? 0)
  if (query.get('warmLand') === '1') askPathLanding()
  render(
    () => (
      <WarmUpFixture
        name={name}
        unlocks={Number.isInteger(unlocks) ? unlocks : 0}
        live={query.get('warmLive') === '1'}
      />
    ),
    root,
  )
  root.classList.add('loaded')
  return true
}
