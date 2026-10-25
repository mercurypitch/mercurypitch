// ============================================================
// Every lesson's sound gate keeps its height as sound comes on and goes off
// ============================================================
//
// The gate in each lesson's hero (kit/page-chrome.ts, `initSoundSwitch`)
// says the page's own line while sound is off, often three lines long, and
// a shorter one once it is on. Both lines share one cell, the one not
// current hidden (kit/lesson-stage.css), so the gate keeps the taller
// line's height in both states. Before, it shrank the first time sound came
// on, 42 px on Lesson 7, and moved the page below it. Lessons 1 to 9, at a
// phone's size and a desktop's; the e2e build shows the drafts.

import { expect, test } from './helpers/lesson-page'

const LESSONS = ['01', '02', '03', '04', '05', '06', '07', '08', '09'] as const
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const

for (const viewport of VIEWPORTS) {
  test.describe(`at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    for (const n of LESSONS) {
      test(`Lesson ${n}'s gate is as tall with sound on as with it off, and shows one line`, async ({
        page,
      }) => {
        // reduced motion: Lessons 1 and 2 bring the gate in with an entrance
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(`/learn/${n}`)
        const gate = page.locator('#gate')
        const off = page.locator('#gateText [data-gate-line="off"]')
        const on = page.locator('#gateText [data-gate-line="on"]')
        // the kit has the gate, and the fonts its lines wrap in are in
        await expect(on).toBeAttached()
        await page.evaluate(() => document.fonts.ready)
        const height = (): Promise<number> =>
          gate.evaluate((el) => el.getBoundingClientRect().height)

        const before = await height()
        await expect(off).toBeVisible()
        await expect(on).toBeHidden()

        await page.locator('#gateBtn').click()
        await expect(gate).toHaveClass(/\bis-on\b/)
        const soundOn = await height()
        await expect(on).toBeVisible()
        await expect(off).toBeHidden()

        await page.locator('#gateBtn').click()
        await expect(gate).not.toHaveClass(/\bis-on\b/)
        const soundOff = await height()

        expect({ soundOn, soundOff }).toEqual({
          soundOn: before,
          soundOff: before,
        })
        await expect(off).toBeVisible()
      })
    }
  })
}
