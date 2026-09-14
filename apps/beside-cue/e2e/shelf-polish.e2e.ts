// Top Shelf's landing feedback and reduced motion, through the real stage.

import { expect, test } from '@playwright/test'
import { enter, read, shoot, sing } from './shelf-hook'

for (const reduced of [false, true]) {
  test(`Top Shelf landing: one tap, settled shape, reduced motion ${reduced}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000)
    await page.emulateMedia({
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    })
    await page.addInitScript(() => {
      const felt: unknown[] = []
      ;(window as unknown as { __felt: unknown[] }).__felt = felt
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: (pattern: number | number[]) => {
          felt.push(pattern)
          return true
        },
      })
    })
    await page.clock.install()
    await enter(page)
    // A software-rendered frame can outlast the sample-to-pause round trip.
    // Aim beyond this test's bounded lifetime; pauseAt skips elapsed callbacks
    // before any notes are held, so the leap still starts on a held clock.
    await page.clock.pauseAt(
      (await page.evaluate(() => Date.now())) + 3_600_000,
    )
    await page.clock.runFor(32)
    const idle = await page.evaluate(() => window.__w3s!().presentation)
    expect(idle.pose).toBe(reduced ? 'listen:still' : 'listen')

    // Room one's aimed fifth lands from the start line. These held notes
    // take the ordinary slide tracker and locomotion path on a 16 ms clock.
    await sing(page, 57)
    await page.clock.runFor(320)
    expect((await read(page)).reference).toBe(57)
    await sing(page, 64)
    let landed = false
    for (let i = 0; i < 90; i++) {
      await page.clock.runFor(16)
      const s = await read(page)
      if (s.leaps === 1 && s.grounded) {
        landed = true
        break
      }
    }
    expect(landed).toBe(true)
    expect((await read(page)).shelf).toBe(1)
    const impact = await page.evaluate(() => window.__w3s!().presentation)
    expect(impact.landing).toBeGreaterThan(0.9)
    expect(impact.reduced).toBe(reduced)
    if (reduced) expect(impact.height).toBeCloseTo(0.55, 3)
    else expect(impact.height).toBeLessThan(0.535)
    await shoot(page, info, `shelf-landing-${reduced ? 'reduced' : 'motion'}`)

    await page.clock.runFor(1_000)
    const settled = await page.evaluate(() => window.__w3s!().presentation)
    expect(settled.landing).toBe(0)
    expect(settled.height).toBeCloseTo(0.55, 3)
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __felt: unknown[] }).__felt,
        ),
      )
      .toEqual([10])

    // The same live component responds when the OS preference changes.
    await sing(page, null)
    await page.emulateMedia({
      reducedMotion: reduced ? 'no-preference' : 'reduce',
    })
    await page.clock.runFor(500)
    expect(await page.evaluate(() => window.__w3s!().presentation.pose)).toBe(
      reduced ? 'listen' : 'listen:still',
    )
  })
}
