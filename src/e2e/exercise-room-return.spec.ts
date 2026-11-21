// ============================================================
// Back to a room by its tab: the same room, and Merc's demo not again
// ============================================================
//
// The Exercises tab keeps its place, as a tab bar does: a room left open
// by a switch to another tab is open again when the tab comes back. The
// room's screen is made anew on that return, and a first visit's demo
// used to start again by itself, in all eight rooms, as if the singer had
// never seen it (0.9.31's review). These walk what a person does: open a
// room, watch the demo begin, go to another tab, come back. The same room
// is there, waiting for the mic, with no demo, and leaving it stopped its
// sound. A fresh way in, by the room's card, still plays the demo, since
// the one left halfway was never seen to its end. The rule is unit-tested
// in src/stores/room-return-store.test.ts.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

// Written at module load: Chromium needs the file before it launches.
const TONE_WAV = writeToneWav()

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
  viewport: { width: 390, height: 844 },
})

/** The rooms that open on Merc's demo, and the test id each room draws. */
const DEMO_ROOMS = [
  ['long-note-lantern', 'Long note', 'long-note-room'],
  ['echo-stars', 'Echo', 'echo-room'],
  ['lip-roll-bay', 'Lip roll', 'lip-roll-room'],
  ['ng-slides-bridge', 'Ng slides', 'ng-slides-room'],
  ['home-note-lighthouse', 'Home note', 'home-note-room'],
  ['leap-cliffs', 'Leap', 'leap-room'],
  ['harmony-lake', 'Harmony', 'harmony-room'],
] as const

/** Every audio context and microphone track the page makes, kept to count. */
function watchAudio(): void {
  const made: { contexts: AudioContext[]; tracks: MediaStreamTrack[] } = {
    contexts: [],
    tracks: [],
  }
  ;(window as unknown as { __audio: typeof made }).__audio = made
  const Base = window.AudioContext
  window.AudioContext = class extends Base {
    constructor(options?: AudioContextOptions) {
      super(options)
      made.contexts.push(this)
    }
  }
  const media = navigator.mediaDevices
  const open = media.getUserMedia.bind(media)
  media.getUserMedia = async (constraints) => {
    const stream = await open(constraints)
    made.tracks.push(...stream.getTracks())
    return stream
  }
}

/** What still sounds or listens: running contexts and live mic tracks. */
async function stillLive(
  page: Page,
): Promise<{ running: number; live: number }> {
  return page.evaluate(() => {
    const made = (
      window as unknown as {
        __audio: { contexts: AudioContext[]; tracks: MediaStreamTrack[] }
      }
    ).__audio
    return {
      running: made.contexts.filter((c) => c.state === 'running').length,
      live: made.tracks.filter((t) => t.readyState === 'live').length,
    }
  })
}

async function openExercises(page: Page): Promise<void> {
  await page.addInitScript(watchAudio)
  await page.goto('/')
  await dismissOverlays(page)
  await waitForNav(page)
  await openNavTab(page, 'tab-exercises')
  await expect(page.getByTestId('exercise-rooms')).toBeVisible()
}

const card = (page: Page, id: string) =>
  page.locator(`[data-testid="exercise-room-card"][data-room="${id}"]`)

/** Another tab and back, as the browser's address does it. */
async function toTab(page: Page, hash: string): Promise<void> {
  await page.evaluate((to) => {
    location.hash = to
  }, hash)
}

for (const [id, name, roomTestId] of DEMO_ROOMS) {
  test(`${name}: back by its tab, the same room waits with no second demo; its card plays it again`, async ({
    page,
  }) => {
    test.slow()
    await openExercises(page)
    const host = page.getByTestId('web-room')
    const room = host.getByTestId(roomTestId)

    // A first visit: the demo starts by itself.
    await card(page, id).click()
    await expect(host).toHaveAttribute('data-room', id)
    await expect(room).toHaveAttribute('data-demo', 'playing', {
      timeout: 15000,
    })

    // Another tab: the room goes, and its sound with it.
    await toTab(page, '#/progress')
    await expect(page.getByTestId('web-room')).toHaveCount(0)
    await expect.poll(() => stillLive(page)).toEqual({ running: 0, live: 0 })

    // Back: the same room, at rest, the mic's hint over the mic. A demo
    // about to start by itself holds that hint back until it is over.
    await toTab(page, '#/exercises')
    await expect(host).toHaveAttribute('data-room', id)
    await expect(host.getByRole('heading', { name })).toBeVisible()
    await expect(
      host.locator('[data-testid$="-demo-tip"][data-tip="mic"]'),
    ).toBeVisible({ timeout: 10000 })
    await expect(room).toHaveAttribute('data-demo', 'idle')
    // "How it works" still plays it on demand: the room's "?" is there.
    await expect(
      host.getByRole('button', { name: /how it works/i }),
    ).toBeVisible()

    // Its card again is a fresh way in: the demo, unseen to its end, plays.
    await page.getByTestId('web-room-back').click()
    await expect(page.getByTestId('web-room')).toHaveCount(0)
    await card(page, id).click()
    await expect(room).toHaveAttribute('data-demo', 'playing', {
      timeout: 15000,
    })
  })
}

test('the Warm-up is open again on its path, by its tab', async ({ page }) => {
  await openExercises(page)
  const host = page.getByTestId('web-room')
  await card(page, 'warm-up-path').click()
  await expect(host.getByTestId('warm-up-path')).toBeVisible()

  await toTab(page, '#/progress')
  await expect(page.getByTestId('web-room')).toHaveCount(0)
  await toTab(page, '#/exercises')

  await expect(host).toHaveAttribute('data-room', 'warm-up-path')
  await expect(host.getByTestId('warm-up-path')).toBeVisible()
})

test('a room left listening by its tab shuts the mic, and is back at rest', async ({
  page,
}) => {
  test.slow()
  await openExercises(page)
  const host = page.getByTestId('web-room')
  const room = host.getByTestId('long-note-room')
  await card(page, 'long-note-lantern').click()
  await expect(room).toHaveAttribute('data-demo', 'playing', {
    timeout: 15000,
  })
  await host.getByRole('button', { name: 'Skip' }).click()
  await host.getByRole('button', { name: 'Try it' }).click()
  await expect(room).toHaveAttribute('data-demo', 'idle')

  // The mic opens for a take.
  await host.getByRole('button', { name: /^Start/ }).click()
  await expect.poll(async () => (await stillLive(page)).live).toBeGreaterThan(0)

  await toTab(page, '#/progress')
  await expect(page.getByTestId('web-room')).toHaveCount(0)
  await expect.poll(() => stillLive(page)).toEqual({ running: 0, live: 0 })

  await toTab(page, '#/exercises')
  await expect(host).toHaveAttribute('data-room', 'long-note-lantern')
  await expect(room).toHaveAttribute('data-phase', 'intro')
  await expect(room).toHaveAttribute('data-demo', 'idle')
  expect((await stillLive(page)).live).toBe(0)
})
