// ============================================================
// Lesson 9 loads at /learn/09 as its own document, and boots
// ============================================================
//
// A draft until the vocal coach's sign-off. Every build carries its
// document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot.
// Then WEB-SPEC's first end-to-end check (Tests, End to end 1): no
// AudioContext before the first tap, and nothing plays before a play
// button. This is the page shell's spec; each toy's own checks join it as
// that toy is wired.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Landing a leap: singing big intervals in tune | MercuryPitch'

/**
 * Counts the page's AudioContexts and every sound source it starts, from
 * before its first script runs.
 */
async function watchSound(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { audioContexts: number; sources: number }
    w.audioContexts = 0
    w.sources = 0
    const Real = window.AudioContext
    window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options)
        w.audioContexts += 1
      }
    }
    const start = AudioScheduledSourceNode.prototype.start
    AudioScheduledSourceNode.prototype.start = function (
      this: AudioScheduledSourceNode,
      ...args: Parameters<typeof start>
    ) {
      w.sources += 1
      start.apply(this, args)
    }
  })
}

/** How many AudioContexts the page has made, and how many sounds it has started. */
const heard = (page: Page): Promise<{ contexts: number; sources: number }> =>
  page.evaluate(() => {
    const w = window as unknown as { audioContexts: number; sources: number }
    return { contexts: w.audioContexts, sources: w.sources }
  })

test('a hard load of /learn/09 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  // Act
  const response = await page.goto('/learn/09')

  // Assert
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'How do you land a note you have to leap to?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
  // a written lesson: no film, so no Watch section
  await expect(page.locator('#watch')).toHaveCount(0)
})

test('the page boots with no AudioContext until the first tap, the deck and the map drawn @smoke', async ({
  page,
}) => {
  // Arrange
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await watchSound(page)
  // the page booted: the map drawn, and the deck on Step 1 (read before the
  // scroll, which the steps follow)
  await page.goto('/learn/09')
  await expect(page.locator('#exList .ex-row')).toHaveCount(15)
  await expect(page.locator('#stepNow')).toHaveText('1')
  await expect(page.locator('#deckNextLabel')).toHaveText(
    'Next: Can I aim a leap, then?',
  )

  // Act: the whole page read, top to bottom, with no tap
  for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
    await page.locator(id).scrollIntoViewIfNeeded()

  // Assert
  expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
  await expect(page.locator('.lm-btn')).toBeVisible()
  await expect(page.locator('#wrap a.next-card')).toHaveAttribute(
    'data-select-lesson',
    '10',
  )
  expect(errors).toEqual([])
})

test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
  page,
}) => {
  // Arrange: sound on from the gate, which confirms it with its two soft notes
  await watchSound(page)
  await page.goto('/learn/09')
  await page.locator('#gateBtn').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const after = await heard(page)

  // Act: a choice, the steps and the sections, none of them a play button
  await page.locator('#predict [data-choice="re"]').click()
  await page.getByRole('button', { name: 'Next step', exact: true }).click()
  await expect(page.locator('#stepNow')).toHaveText('2')
  for (const id of ['#words', '#sing', '#wrap', '#explorer'])
    await page.locator(id).scrollIntoViewIfNeeded()

  // Assert
  expect(after.contexts).toBe(1)
  expect(await heard(page)).toEqual(after)
})
