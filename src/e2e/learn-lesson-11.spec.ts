// ============================================================
// Lesson 11 loads at /learn/11 as its own document, and boots
// ============================================================
//
// A draft until the vocal coach has signed it off. Every build carries its document, and the e2e bundle
// shows drafts (`build:e2e` sets VITE_DRAFT_LESSONS=1); on mercurypitch.com
// the site worker answers its address with the 404 page until the admin
// console publishes it (src/lesson-gate.ts). Like every lesson it must load
// as itself, never as the 404 page or the studio's cached app shell, and
// its module must boot. Then WEB-SPEC's first end-to-end check (Tests, End
// to end 1), at a phone's size and a desktop's: no AudioContext before the
// first tap, and nothing plays before a play button; and a
// visitor with the studio installed still gets the lesson, not the shell,
// as Lesson 3's spec checks its own.
// Then the cold open's predict, played with sound on and off (End to end 2);
// the steps' chart by keyboard and its targets at a phone's widths (End to
// end 3 and 5); the recall and the quick check; the Wrap's links; and
// reduced motion. Sing it on the fake microphone is
// learn-lesson-11-sing.spec.ts's.

import type { Page } from '@playwright/test'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'
import { expect, test } from './helpers/lesson-page'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Registers and the break: chest and head voice | MercuryPitch'

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

// WEB-SPEC, End to end 1, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the page at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('a hard load of /learn/11 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/11')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Why does your voice sometimes flip as you slide up?',
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
      await page.goto('/learn/11')
      await expect(page.locator('#exList .ex-row')).toHaveCount(15)
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Why does a slide flip?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap's card names the lesson after this one, from the season
      await expect(page.locator('#wrap a.next-card .eyebrow')).toContainText(
        'Next lesson 12',
      )
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/11')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="every"]').click()
      await page.getByRole('button', { name: 'Next step', exact: true }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      for (const id of ['#words', '#sing', '#wrap', '#explorer'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(after.contexts).toBe(1)
      expect(await heard(page)).toEqual(after)
    })
  })
}

// as Lesson 3's spec checks its own
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
  await page.goto('/learn/11')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test("Tavi's siren plays before a choice, the choice locks, and the reveal waits for Merc's siren heard", async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/learn/11')
  await page.locator('#gateBtn').click()
  const tavi = page.locator('.hero-plays [data-play="orange"]')
  const merc = page.locator('.hero-plays [data-play="blue"]')
  const reveal = page.locator('#predict .reveal')
  const said = page.locator('[data-hero-said]')
  await expect(merc).toBeDisabled()

  // Tavi's siren, heard to its end: it says what it drew, and reveals nothing
  await tavi.click()
  await expect(said).toHaveText(/^Tavi's siren, from D 4 up to B 4 and back/, {
    timeout: 20_000,
  })
  await expect(reveal).toBeHidden()

  // the choice locks and opens Merc's siren, whose end brings the reveal
  await page.locator('#predict [data-choice="every"]').click()
  await expect(page.locator('#predict [data-choice="every"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('#predict [data-choice="mistake"]')).toBeDisabled()
  await expect(page.locator('#predict .lock-hint')).toHaveText(
    "Locked in. Now play Merc's siren.",
  )
  await merc.click()
  await expect(reveal).toBeVisible({ timeout: 20_000 })
  await expect(reveal.locator('.mono')).toHaveText('You said: every voice can')
  await expect(said).toHaveText('Each seam is now labelled the switch.')
  await expect(page.locator('[data-hero-key]')).toBeVisible()
  await expect(page.locator('#predict .lock-hint')).toHaveText(
    'Play either siren again.',
  )
  expect(errors).toEqual([])
})

test("with sound off, Tavi's siren says nothing played, and puts the lock hint back once heard", async ({
  page,
}) => {
  await page.goto('/learn/11')
  // the switch turns sound on from unset, then off
  await page.locator('#soundSwitch').click()
  await page.locator('#soundSwitch').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.locator('.hero-plays [data-play="orange"]').click()

  await expect(page.locator('#predict .lock-hint')).toContainText(
    'Sound is off, so nothing played.',
    { timeout: 20_000 },
  )
  await expect(page.locator('#predict .reveal')).toBeHidden()
})

test('the slide is scrubbed by keyboard, a tenth of a second a press, and named in words', async ({
  page,
}) => {
  await page.goto('/learn/11#step-2')
  await expect(page.locator('#stepNow')).toHaveText('2')
  const scrub = page.locator('#toyRange [data-slide-scrub]')

  await scrub.focus()
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowRight')

  await expect(scrub).toHaveAttribute(
    'aria-valuetext',
    '0.9 seconds of 4: lower gear, near F sharp 3',
  )
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight')
  await expect(scrub).toHaveAttribute(
    'aria-valuetext',
    '1.7 seconds of 4: the switch, from G 3 to A 3',
  )
  await page.keyboard.press('End')
  await expect(scrub).toHaveAttribute('aria-valuenow', '4.0')
  await page.keyboard.press('Home')
  await expect(scrub).toHaveAttribute('aria-valuenow', '0.0')
})

// WEB-SPEC, Toys 1 "Layout and targets": every target at least 44 px square,
// to the whole pixel as drum-night.spec.ts measures its targets, since a row
// laid out at 44 px can measure a hundred-thousandth under it
for (const width of [344, 390]) {
  test(`every control on the stage is at least 44 px square at ${width} px, in every step`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    for (let n = 1; n <= 5; n++) {
      await page.goto(`/learn/11#step-${n}`)
      await expect(page.locator('#stepNow')).toHaveText(String(n))
      const small = await page
        .locator('#toyRange button, #toyRange [role="slider"]')
        .evaluateAll((els) =>
          els
            .map((e) => {
              const r = e.getBoundingClientRect()
              return {
                name: e.getAttribute('aria-label') ?? e.textContent?.trim(),
                w: r.width,
                h: r.height,
              }
            })
            .filter(
              (r) => r.w > 0 && (Math.round(r.w) < 44 || Math.round(r.h) < 44),
            ),
        )
      expect(small, `step ${n}`).toEqual([])
    }
  })
}

test("the recall asks Lesson 7's questions, marks nothing done and links Lesson 7's steps in a new tab", async ({
  page,
}) => {
  await page.goto('/learn/11')
  const done = (): Promise<string | null> =>
    page.evaluate(() => localStorage.getItem('fyp-done'))
  const before = await done()
  expect([null, '[]']).toContain(before)

  const qs = page.locator('#recall-qs .q')
  await expect(qs).toHaveCount(2)
  await qs
    .nth(0)
    .getByRole('button', {
      name: 'A staircase, one step for each note',
      exact: true,
    })
    .click()
  await qs
    .nth(1)
    .getByRole('button', {
      name: 'Always: the range decides the type',
      exact: true,
    })
    .click()

  for (const [words, href] of [
    ['Try Lesson 7, Step 1 again', '/learn/07#step-1'],
    ['Try Lesson 7, Step 5 again', '/learn/07#step-5'],
  ]) {
    const link = page.locator('#recall-qs a', { hasText: words })
    await expect(link).toHaveAttribute('href', href)
    await expect(link).toHaveAttribute('target', '_blank')
  }
  expect(await done()).toBe(before)
})

test('the quick check links its steps, starts each line Right. or Not quite., and marks Lesson 11 done', async ({
  page,
}) => {
  await page.goto('/learn/11')
  const check = page.locator('#qs .q')

  // a wrong answer links to the step whose chart answers it, on this page
  await check
    .nth(2)
    .getByRole('button', { name: 'Yes, with enough sirens', exact: true })
    .click()
  await page.locator('#qs a', { hasText: 'Try Step 4 again' }).click()
  await expect(page.locator('#stepNow')).toHaveText('4')

  for (const [i, name] of [
    [0, 'Your voice changed gear: every voice has gears'],
    [1, 'Around the middle, either gear can sing the same notes'],
    [3, 'Yodelling'],
  ] as const)
    await check.nth(i).getByRole('button', { name, exact: true }).click()

  await expect(page.locator('#scoreN')).toHaveText('3')
  const lines = await page
    .locator('#qs .fb')
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))
  expect(lines).toHaveLength(4)
  for (const line of lines) expect(line).toMatch(/^(Right\.|Not quite\.)/)
  await expect(page.locator('#exCardHost')).toContainText('Done')
})

test("the Wrap's links carry lesson=11, and its card leads to Lesson 12's page", async ({
  page,
}) => {
  await page.goto('/learn/11')

  const hrefs = await page
    .locator('a[href*="lesson="]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')))
  expect(hrefs.length).toBeGreaterThan(1)
  for (const href of hrefs) expect(href).toBe('/pitch-training?lesson=11')

  const card = page.locator('#wrap a.next-card')
  await expect(card).toHaveAttribute('href', '/learn/12')
  await expect(card.locator('.chip')).toHaveText('Start lesson')
  await expect(card.locator('.next-tease')).toHaveText(
    LESSON_COPY[12]?.tease ?? 'Lesson 12 has a tease',
  )
})

test('with reduced motion the slide draws at once, and nothing moves on its own', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/11#step-2')
  await expect(page.locator('#stepNow')).toHaveText('2')
  const scrub = page.locator('#toyRange [data-slide-scrub]')
  await expect(scrub).toHaveAttribute('aria-valuenow', '0.0')

  await page.locator('#toyRange [data-slide-play]').click()

  // the whole line at once: the scrub bar and the gauge at the slide's end
  await expect(scrub).toHaveAttribute('aria-valuenow', '4.0', { timeout: 500 })
  await expect(page.locator('#toyRange [data-stretch-fill]')).toHaveAttribute(
    'style',
    /width: 100%/,
  )
  const animations = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect !== null)
        .map((a) => (a.effect as KeyframeEffect).target?.className ?? '')
        .filter((c) => typeof c === 'string' && c.length > 0).length,
  )
  expect(animations).toBe(0)
})
