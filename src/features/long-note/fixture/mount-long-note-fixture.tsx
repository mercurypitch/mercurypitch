// ============================================================
// Mount Long note's fixture page in place of the app (dev server only)
// ============================================================
//
// The native entry calls this behind `import.meta.env.DEV` when the page
// is opened with `?longNoteFixture=<name>` (LongNoteFixture.tsx), so it
// exists only on the dev server and no build carries it.

import { render } from 'solid-js/web'
import { isFixtureName, LongNoteFixture } from './LongNoteFixture'

/**
 * Mount the named fixture in `root`; false when there is no such fixture.
 * The root is marked loaded as the app marks it on mount: unmarked, the
 * root stays hidden and the boot watchdog reports a start that never came.
 */
export function mountLongNoteFixture(root: HTMLElement, name: string): boolean {
  if (!isFixtureName(name)) return false
  render(() => <LongNoteFixture name={name} />, root)
  root.classList.add('loaded')
  return true
}
