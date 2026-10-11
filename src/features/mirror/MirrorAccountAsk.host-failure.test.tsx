// ============================================================
// Voice Mirror: the account dialog's chunk fails to load
// ============================================================
//
// Offline, or a deploy that replaced the chunk under an open tab. The tap
// must not take the results down with it: the ask stands down, says what
// happened, and the voiceprint stays where it was. A file of its own because
// the failing chunk is a module mock, and those are per file.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, expect, it, vi } from 'vitest'
import { hostWanted, resetAccountAskForTests } from './account-ask'
import { MirrorAccountAsk, MirrorAccountHostSlot } from './MirrorAccountAsk'

vi.mock('./funnel', () => ({ trackFunnel: vi.fn() }))
vi.mock('@/stores/promo-store', () => ({
  loadFeaturedPromo: async () => undefined,
  offeredPromo: () => null,
}))
vi.mock('./MirrorAccountHost', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

afterEach(() => {
  cleanup()
  resetAccountAskForTests()
})

it('stands the ask down and says so when the dialog cannot load', async () => {
  localStorage.clear()
  render(() => (
    <>
      <section class="mirror-results">
        <MirrorAccountAsk />
      </section>
      <MirrorAccountHostSlot />
    </>
  ))

  fireEvent.click(
    screen.getByRole('button', { name: 'Create my free account' }),
  )

  expect(await screen.findByRole('status')).toHaveTextContent(
    "The sign-up form didn't load. Check your connection and reload the page; your voiceprint stays saved here.",
  )
  expect(hostWanted()).toBe(false)
  expect(
    screen.getByRole('button', { name: 'Create my free account' }),
  ).toHaveProperty('disabled', false)
})
