// ============================================================
// Mount Echo's fixture page in place of the app (dev server only)
// ============================================================
//
// The native entry calls this behind `import.meta.env.DEV` when the page
// is opened with `?echoFixture=<name>` (EchoFixture.tsx, the art's frames;
// EchoRoomFixture.tsx, the room as a stop of the Warm-up), so it exists
// only on the dev server and no build carries it.

import { render } from 'solid-js/web'
import { fixtureStop } from '@/components/room-kit/routine-fixture'
import { EchoFixture, isFixtureName } from './EchoFixture'
import { EchoRoomFixture, isRoomFixtureName } from './EchoRoomFixture'

/**
 * Mount the named fixture in `root`; false when there is no such fixture.
 * The root is marked loaded as the app marks it on mount: unmarked, the
 * root stays hidden and the boot watchdog reports a start that never came.
 */
export function mountEchoFixture(root: HTMLElement, name: string): boolean {
  if (isRoomFixtureName(name)) {
    render(() => <EchoRoomFixture name={name} stop={fixtureStop()} />, root)
    root.classList.add('loaded')
    return true
  }
  if (!isFixtureName(name)) return false
  render(() => <EchoFixture name={name} />, root)
  root.classList.add('loaded')
  return true
}
