// ============================================================
// The 3D stages: they open, they measure, they calm down
// ============================================================
//
// Slice 5a put the same frame loop around every 3D world: the chip that
// measures (runtime/perf.ts) and calm mode, which draws at half rate once
// nothing has happened for three seconds (runtime/calm.ts). The pure
// halves are unit-tested; this is the whole of it in a browser -- each
// stage opens from the games list with no console errors, draws its
// first frame, and reads its numbers onto the chip, and a stage left
// alone draws fewer frames than it runs, until a key wakes it.
//
// Headless has no microphone, so nothing here taps "Walk in": the render
// loop starts with the renderer, not with the mic. The stages hang their
// state on DEV hooks (`__w3`, `__w3h`, `__w3c`, `__w3l`), which is what
// these read.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

interface Perf {
  ticks: number
  drawn: number
  calm: boolean
  load: Record<string, number>
  window: { fps: number; cpuMs: number; busy: number } | null
}

const PHONE = { width: 390, height: 844 }

const WORLDS = [
  { card: /The Cabinet/, hook: '__w3' },
  { card: /The Hallway/, hook: '__w3h' },
  { card: /The Standing Wave/, hook: '__w3c' },
  { card: /The Sorting Line/, hook: '__w3l' },
] as const

const perfOf = (page: Page, hook: string): Promise<Perf | null> =>
  page.evaluate((name) => {
    const fn = (window as unknown as Record<string, unknown>)[name] as
      | (() => { perf: Perf })
      | undefined
    return fn === undefined ? null : fn().perf
  }, hook)

/** Home, then the games list, then a card. */
const openWorld = async (page: Page, card: RegExp): Promise<void> => {
  await page.setViewportSize(PHONE)
  await page.goto('/?devSeed')
  await page.getByRole('button', { name: /B-side games/ }).click()
  await page.getByRole('button', { name: card }).click()
}

for (const world of WORLDS) {
  test(`${world.hook}: opens, draws and fills the chip`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await openWorld(page, world.card)
    await expect
      .poll(async () => (await perfOf(page, world.hook))?.load.first, {
        timeout: 25_000,
      })
      .toBeGreaterThan(0)

    const chip = page.locator('.stage3d__chip')
    await expect(chip).toBeVisible()
    // The frame line lands once the first one-second window closes; the
    // load line as soon as the first frame is drawn.
    await expect(chip).toContainText(/\d+ fps/, { timeout: 5_000 })
    await expect(chip).toContainText(/gpu \d+/)
    await expect(chip).toContainText(/first \d+ ms/)

    expect(errors).toEqual([])
  })
}

test('a stage left alone calms, and a key wakes it on the next frame', async ({
  page,
}) => {
  test.setTimeout(120_000)
  // The page runs on Playwright's clock, held still once the stage is up.
  // Calm is a rate by the clock, and CI's software renderer draws the
  // Hallway at about 7 fps -- below the calm rate itself, so there every
  // frame is already due and nothing is skipped. That is right, and it
  // proves nothing: the first version of this test measured the machine.
  // A held clock hands the stage a frame every 16 ms of page time however
  // long each takes to draw, so what is measured is the rule at 62.5 Hz,
  // the same on any machine.
  await page.clock.install()
  await openWorld(page, /The Hallway/)
  await expect
    .poll(async () => (await perfOf(page, '__w3h'))?.load.first, {
      timeout: 25_000,
    })
    .toBeGreaterThan(0)

  // Calm after one second rather than three, set the way maff would on
  // the phone: through the dev dials, whose stored values load when the
  // panel opens. The rate stays the shipped 30 fps.
  await page.evaluate(() =>
    window.localStorage.setItem(
      'beside-cue:games:dev-dials',
      JSON.stringify({ calm: { afterSeconds: 1 } }),
    ),
  )
  await page.getByRole('button', { name: 'dials', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Developer dials' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  // From here the page's time moves only when the test moves it.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100)
  await page.clock.runFor(1_500)
  const a = (await perfOf(page, '__w3h'))!
  expect(a.calm).toBe(true)

  await page.clock.runFor(1_000)
  const b = (await perfOf(page, '__w3h'))!
  const ticks = b.ticks - a.ticks
  // Every frame runs; at 62.5 Hz the shipped 30 fps draws every second one.
  expect(ticks).toBeGreaterThanOrEqual(62)
  expect(Math.abs((b.drawn - a.drawn) / ticks - 0.5)).toBeLessThan(0.05)
  // The chip says so once a window has closed inside the calm.
  await expect(page.locator('.stage3d__chip')).toContainText('calm')

  // Not a key he walks with: any key is a poke, and one that moved him
  // would be woken by his walking rather than by the key. The next frame
  // draws, and so does every one for less than the second it takes to
  // calm again.
  await page.keyboard.press('Shift')
  await page.clock.runFor(16)
  const c = (await perfOf(page, '__w3h'))!
  expect(c.calm).toBe(false)
  expect(c.ticks - b.ticks).toBeGreaterThanOrEqual(1)
  expect(c.drawn - b.drawn).toBe(c.ticks - b.ticks)
  await page.clock.runFor(500)
  const d = (await perfOf(page, '__w3h'))!
  expect(d.ticks - c.ticks).toBeGreaterThanOrEqual(30)
  expect(d.drawn - c.drawn).toBe(d.ticks - c.ticks)
})
