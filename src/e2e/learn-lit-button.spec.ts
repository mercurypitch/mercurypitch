// ============================================================
// A lit primary button reads: light words on its dark lit ground
// ============================================================
//
// A play button is lit (`is-on`) while it sounds. `.btn.is-on` gives it the
// dark lit ground in place of a primary button's light gradient
// (kit/lesson-base.css), so a lit primary must take light words as every
// other lit button has; with the primary's own dark words it read dark on
// dark teal. Measured as painted: the ground is the button's own pixels with
// its words and icon made clear, the words its computed colour, and the two
// must reach WCAG's 4.5:1. Lesson 2's "Play a step" (published), and the kit
// ear game's Play on Lesson 6. A silent run lights its button too, so sound
// stays off.

import type { Locator, Page } from '@playwright/test'
import { contrast } from './helpers/color'
import { expect, test } from './helpers/lesson-page'

/** The median colour of the shot's inner pixels, as `rgb(r, g, b)`. */
async function groundOf(page: Page, png: Buffer): Promise<string> {
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error('no 2d context')
    ctx.drawImage(img, 0, 0)
    // inside the border and its rounding, where only the ground shows
    const inset = 8
    const data = ctx.getImageData(
      inset,
      inset,
      Math.max(1, img.width - inset * 2),
      Math.max(1, img.height - inset * 2),
    ).data
    const channels: number[][] = [[], [], []]
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) channels[c].push(data[i + c])
    }
    const median = (values: number[]): number => {
      values.sort((a, b) => a - b)
      return values[Math.floor(values.length / 2)]
    }
    return `rgb(${channels.map(median).join(', ')})`
  }, png.toString('base64'))
}

/** The lit button's words against its painted ground: WCAG's ratio. */
async function litContrast(page: Page, button: Locator): Promise<number> {
  await expect(button).toHaveClass(/\bis-on\b/)
  const ink = await button.evaluate((el) => getComputedStyle(el).color)
  await button.evaluate((el) =>
    el.style.setProperty('color', 'transparent', 'important'),
  )
  const shot = await button.screenshot({ animations: 'disabled' })
  // still lit when the shot was taken: the ground is the lit one
  await expect(button).toHaveClass(/\bis-on\b/)
  await button.evaluate((el) => el.style.removeProperty('color'))
  return contrast(ink, await groundOf(page, shot))
}

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  // no transition between the rest and lit looks to catch mid-way
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test("Lesson 2's Play a step reads at 4.5:1 or better while it is lit", async ({
  page,
}) => {
  await page.goto('/learn/02')
  const play = page.locator('#earGame [data-eg-play]')

  await play.click()

  expect(await litContrast(page, play)).toBeGreaterThanOrEqual(4.5)
})

test("the kit ear game's Play reads at 4.5:1 or better while it is lit, on Lesson 6", async ({
  page,
}) => {
  await page.goto('/learn/06#step-2')
  await expect(page.locator('#stepNow')).toHaveText('2')
  const play = page.locator('#stepLeapGame [data-eg-play]')

  await play.click()

  expect(await litContrast(page, play)).toBeGreaterThanOrEqual(4.5)
})
