// ============================================================
// Lesson 22 loads at /learn/22 as its own document, and boots
// ============================================================
//
// A Season 2 voice lesson, a draft until the vocal coach's sign-off. Every
// build carries its document, and the e2e bundle shows drafts (`build:e2e`
// sets VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers
// its address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot:
// at a phone's size and a desktop's, no AudioContext before the first tap,
// and nothing plays before a play button, the hero's plays sit under its
// stage, and the page fits a phone's width with no sideways scroll; quick
// check 3's play and free play's slow wave wait for Step 3's choice, and
// the steps' band chart and all of free play for the cold open's; and a
// visitor with the studio installed still gets the lesson, not the shell.
// It carries Season 2, so its masthead and its map are Season 2's, and it
// draws no staff for show (WEB-SPEC, Look).

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'What is vibrato in singing? | MercuryPitch'

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

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the page at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('a hard load of /learn/22 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/22')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        "If a singer's held note swings up and down six times a second, why do we still hear one note?",
      )
      await expect(page.locator('#root')).toHaveCount(0)
      // a written lesson: no film, so no Watch section
      await expect(page.locator('#watch')).toHaveCount(0)
    })

    test("the page boots with no AudioContext until the first tap, the deck and Season 2's map drawn @smoke", async ({
      page,
    }) => {
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      await page.goto('/learn/22')
      await expect(
        page.locator('.ex-seasons [data-season="2"]'),
      ).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: How fast, and how far?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from Season 2
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 23',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/22')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="top"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })

    test("the hero's two plays sit right under the stage, before the predict card", async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/22')
      const box = async (sel: string) =>
        (await page.locator(sel).boundingBox()) ?? { y: 0, height: 0 }
      const stage = await box('#heroStage')
      const plays = await box('.hero-plays')
      const predict = await box('#predict')

      // Assert: under 1080 px the kit orders the hero's parts, and the plays
      // go with the stage, never to the top of the hero
      expect(plays.y).toBeGreaterThanOrEqual(stage.y + stage.height - 1)
      expect(plays.y + plays.height).toBeLessThanOrEqual(predict.y)
    })

    test('fits the screen across: no sideways scroll, the Wrap included', async ({
      page,
    }) => {
      // Arrange
      await page.goto('/learn/22')
      await expect(page.locator('#wrap a.next-card')).toBeVisible()

      // Act: every section met, free play's state switch and the next-lesson still among them
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()
      const widths = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        screen: document.documentElement.clientWidth,
      }))

      // Assert
      expect(widths.page).toBeLessThanOrEqual(widths.screen)
    })

    test('draws no staff for show: no background staff behind the page, and none on a section head (WEB-SPEC, Look)', async ({
      page,
    }) => {
      // Act
      await page.goto('/learn/22')
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundImage,
      )

      // Assert: the three glows stay, the five-line tile goes
      expect(background).not.toContain('repeating-linear-gradient')
      expect(background).toContain('radial-gradient')
      await expect(page.locator('.mv-staff')).toHaveCount(0)
    })
  })
}

test("quick check 3's play waits for Step 3's choice under its lock line, then sounds (WEB-SPEC, Toys 5)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, the cold open's choice made, on Step 3
  await watchSound(page)
  await page.goto('/learn/22#step-3')
  await page.locator('#gateBtn').click()
  await page.locator('#predict [data-choice="middle"]').click()
  const play = page.locator('#qs [data-quiz-play="slow"]')
  const line = page.locator('#qs [data-quiz-held]')
  await expect(play).toBeDisabled()
  await expect(line).toHaveText("Answer Step 3's question first to hear this.")

  // Act: Step 3's choice, then the play
  await page.locator('#predict3 [data-choice="moves"]').click()
  await expect(play).toBeEnabled()
  const before = await heard(page)
  await play.click()

  // Assert
  await expect(line).toBeHidden()
  await expect(play).toHaveClass(/is-on/)
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(before.sources)
})

test("the steps' band chart holds every control under its lock line until the cold open's choice, then plays (WEB-SPEC, Toys 2)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, on Step 1
  await watchSound(page)
  await page.goto('/learn/22')
  await page.locator('#gateBtn').click()
  const toy = page.locator('#toyChart')
  const wave = toy.locator('[data-vib-play="wave"]')
  await expect(toy.locator('[data-vib-lock]')).toBeVisible()
  await expect(wave).toBeDisabled()

  // Act: the cold open's choice, then Step 1's wave, pressed where it
  // stands: a scroll to it could carry the wide page's deck on to Step 2,
  // which hides Step 1's controls
  await page.locator('#predict [data-choice="top"]').click()
  await expect(wave).toBeEnabled()
  const before = await heard(page)
  await wave.dispatchEvent('click')

  // Assert
  await expect(toy.locator('[data-vib-lock]')).toBeHidden()
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(before.sources)
})

test('a held slider looks held, as a held play does, until its choice opens it (WEB-SPEC, Toys 2)', async ({
  page,
}) => {
  // Arrange: on Step 3, before either choice
  await page.goto('/learn/22#step-3')
  const toy = page.locator('#toyChart')
  const rate = toy.locator('#vibRate3')
  const atRate = toy.locator('[data-vib-play="at-rate"]')
  const opacity = (l: Locator): Promise<string> =>
    l.evaluate((e) => getComputedStyle(e).opacity)
  await expect(rate).toBeDisabled()

  // Assert: as dim as the held play beside it
  expect(await opacity(rate)).toBe(await opacity(atRate))
  expect(Number(await opacity(rate))).toBeLessThan(1)

  // Act: the cold open's choice, then Step 3's
  await page.locator('#predict [data-choice="middle"]').click()
  await page.locator('#predict3 [data-choice="moves"]').click()

  // Assert
  await expect(rate).toBeEnabled()
  expect(await opacity(rate)).toBe('1')
})

test("free play holds back as the steps' band chart does: all of it until the cold open's choice, its slow wave until Step 3's (WEB-SPEC, Toys 2)", async ({
  page,
}) => {
  // Arrange: sound on from the gate, on Step 3
  await watchSound(page)
  await page.goto('/learn/22#step-3')
  await page.locator('#gateBtn').click()
  const free = page.locator('#freePlay')
  const middle = free.locator('[data-free-state="3"]')
  const two = free.locator('[data-vib-play="two"]')
  await expect(middle).toBeDisabled()
  await expect(free.locator('[data-vib-lock]')).toBeVisible()

  // Act: the cold open's choice, then free play's middle
  await page.locator('#predict [data-choice="middle"]').click()
  await middle.click()

  // Assert: open, but the slow wave held under its own line
  await expect(free.locator('[data-vib-lock]')).toBeHidden()
  await expect(middle).toHaveAttribute('aria-pressed', 'true')
  await expect(free.locator('[data-vib-play="six"]')).toBeEnabled()
  await expect(two).toBeDisabled()
  await expect(free.locator('[data-vib-lock3]')).toHaveText(
    "Answer Step 3's question first to hear this.",
  )

  // Act: Step 3's choice, then free play's slow wave
  await page.locator('#predict3 [data-choice="moves"]').click()
  await expect(two).toBeEnabled()
  const before = await heard(page)
  await two.click()

  // Assert
  await expect(free.locator('[data-vib-lock3]')).toBeHidden()
  await expect
    .poll(async () => (await heard(page)).sources)
    .toBeGreaterThan(before.sources)
})

test('a visitor with the studio installed still gets the lesson, not the shell @smoke', async ({
  page,
}) => {
  // Arrange: the studio's service worker installed, and in control
  await page.goto('/')
  await page.waitForFunction(
    async () =>
      (await navigator.serviceWorker.getRegistration('/')) !== undefined,
    undefined,
    { timeout: 20_000 },
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  )

  // Act
  await page.goto('/learn/22')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})
