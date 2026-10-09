// ============================================================
// First Light names the stores on the Map, and only there
// ============================================================
//
// The Keep beat's account offer, shown over the twin portrait, is where
// nearly every paid sign-up comes from, so no link out of the app may sit
// before it. The Map comes after Keep on every track and is the last
// screen, so the store chips go there: under the rooms, the button and the
// account line, never above them.

import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BeatMap } from '@/features/onboarding/beats/BeatMap'
import type * as NativeBuild from '@/lib/native-build'
import { STORE_PREVIEW_VIDEO_URL } from '@/lib/store-listings'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

const noop = (): void => {}

function renderMap(): HTMLElement {
  const { container } = render(() => (
    <BeatMap
      voiceprint={null}
      onEnter={noop}
      onTour={noop}
      onDone={noop}
      onKeep={noop}
    />
  ))
  const map = container.querySelector<HTMLElement>('[data-beat="map"]')
  if (map === null) throw new Error('no map beat')
  return map
}

/** True when `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

beforeEach(() => {
  build.native = false
})
afterEach(cleanup)

describe('the store chips on the Map', () => {
  it('shows both coming-soon chips, each opening the video', () => {
    const map = renderMap()
    const chips = [...map.querySelectorAll('a[data-store]')]
    expect(chips.map((c) => c.getAttribute('data-store'))).toEqual([
      'app-store',
      'google-play',
    ])
    for (const chip of chips) {
      expect(chip).toHaveAttribute('href', STORE_PREVIEW_VIDEO_URL)
      expect(chip).toHaveTextContent(/coming soon/i)
    }
  })

  it('sits after every room, the button and the account line', () => {
    const map = renderMap()
    const firstChip = map.querySelector('a[data-store]')
    const lastRoom = [...map.querySelectorAll('[data-room]')].at(-1)
    const start = [...map.querySelectorAll('button')].find(
      (b) => b.textContent === 'Start singing',
    )
    const keep = [...map.querySelectorAll('button')].find(
      (b) => b.textContent === 'Save it to a free account',
    )
    if (!firstChip || !lastRoom || !start || !keep) {
      throw new Error('the Map is missing a piece')
    }
    expect(precedes(lastRoom, firstChip)).toBe(true)
    expect(precedes(start, firstChip)).toBe(true)
    expect(precedes(keep, firstChip)).toBe(true)
  })

  it('is not on the Map inside the native app', () => {
    build.native = true
    const map = renderMap()
    expect(map.querySelector('a[data-store]')).toBeNull()
    expect(map).not.toHaveTextContent(/google play/i)
    expect(map).not.toHaveTextContent(/app store/i)
  })
})
