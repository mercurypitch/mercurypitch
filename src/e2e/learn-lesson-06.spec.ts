// ============================================================
// Lesson 6 loads at /learn/06 as its own document, and boots
// ============================================================
//
// A draft until the owner has reviewed it. Every build carries its
// document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot.
// Then the checks of WEB-SPEC's end-to-end list (Tests) that run on the
// page as it loads: no AudioContext before a tap; the cold open's predict
// locks, and its reveal waits for Play from F sharp to be heard, with sound
// off as well; the recall, which marks nothing done, and the quick check,
// which marks Lesson 6 done; and the Wrap's practice links and its card for
// Lesson 7, coming later. The tune line, the games and the layouts are
// learn-lesson-06-qa.spec.ts's; Sing it is learn-lesson-06-sing.spec.ts's.

import { expect, test } from '@playwright/test'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'

// 60 characters at most (src/tests/lesson-pages.test.ts): the lesson's number is in its kicker
const TITLE = 'Intervals: the distance between notes | MercuryPitch'

test('a hard load of /learn/06 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/06')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'still the same tune?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
  // a written lesson: no film, so no Watch section
  await expect(page.locator('#watch')).toHaveCount(0)
})

test('the lesson boots: no sound before a tap, the predict locks, and the reveal waits for F sharp @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    const w = window as unknown as { audioContexts: number }
    w.audioContexts = 0
    const Real = window.AudioContext
    window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options)
        w.audioContexts += 1
      }
    }
  })
  const contexts = (): Promise<number> =>
    page.evaluate(
      () => (window as unknown as { audioContexts: number }).audioContexts,
    )
  await page.goto('/learn/06')
  await expect(page.locator('#exList .ex-row')).toHaveCount(15)
  expect(await contexts()).toBe(0)

  // Play from C works before a guess, makes the page's one AudioContext, and reveals nothing
  const fromC = page.locator('#heroPlay')
  const fromFs = page.locator('#predict [data-play="fs"]')
  const reveal = page.locator('#predict .reveal')
  await expect(fromFs).toBeDisabled()
  await fromC.click()
  await expect(page.locator('#heroTune [data-hero-said]')).toHaveText(
    'Twinkle from C',
  )
  await expect(fromC).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
  await expect(reveal).toBeHidden()
  expect(await contexts()).toBe(1)

  // the guess locks and unlocks Play from F sharp, whose sound brings the reveal
  await page.locator('#predict [data-choice="gaps"]').click()
  await expect(page.locator('#predict [data-choice="gaps"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('#predict [data-choice="notes"]')).toBeDisabled()
  await expect(fromFs).toBeEnabled()
  await fromFs.click()
  await expect(page.locator('#heroTune [data-hero-said]')).toHaveText(
    'Twinkle from F sharp',
  )
  await expect(reveal).toBeVisible({ timeout: 10_000 })
  await expect(reveal).toContainText('The gaps. Not one note matches')
  await expect(reveal.locator('.mono')).toHaveText(
    'You said: the gaps between the notes',
  )
  expect(await contexts()).toBe(1)

  // the explorer opens on this page's own lesson, with no film
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await expect(page.locator('#exCardHost h3')).toHaveText(
    'Intervals: the distance between notes',
  )
  await expect(
    page
      .locator('#exCardHost')
      .getByRole('link', { name: 'Watch the episode' }),
  ).toHaveCount(0)

  expect(errors).toEqual([])
})

test('with sound off, Play from F sharp says nothing played, and the reveal waits', async ({
  page,
}) => {
  await page.goto('/learn/06')
  // the switch turns sound on from unset, then off
  await page.locator('#soundSwitch').click()
  await page.locator('#soundSwitch').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.locator('#predict [data-choice="notes"]').click()
  await page.locator('#predict [data-play="fs"]').click()

  await expect(page.locator('#predict .lock-hint')).toContainText(
    'Sound is off, so nothing played.',
    { timeout: 10_000 },
  )
  await expect(page.locator('#predict .reveal')).toBeHidden()
})

test('a visitor with the studio installed still gets the lesson, not the shell @smoke', async ({
  page,
}) => {
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

  await page.goto('/learn/06')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test("the recall asks Lesson 4's questions, marks nothing done and links Lesson 4's page in a new tab", async ({
  page,
}) => {
  await page.goto('/learn/06')
  const done = (): Promise<string | null> =>
    page.evaluate(() => localStorage.getItem('fyp-done'))
  // a first visit: nothing done yet
  const before = await done()
  expect([null, '[]']).toContain(before)

  const qs = page.locator('#recall-qs .q')
  await expect(qs).toHaveCount(2)
  await qs
    .nth(0)
    .getByRole('button', { name: 'Seven equal steps', exact: true })
    .click()
  await qs.nth(1).getByRole('button', { name: 'E', exact: true }).click()

  const link = page.locator('#recall-qs a', {
    hasText: 'Try Lesson 4, Step 1 again',
  })
  await expect(link).toHaveAttribute('href', '/learn/04')
  await expect(link).toHaveAttribute('target', '_blank')
  expect(await done()).toBe(before)
})

test('the quick check links its steps, starts each line Right. or Not quite., and marks Lesson 6 done', async ({
  page,
}) => {
  await page.goto('/learn/06')
  const check = page.locator('#qs .q')

  // a wrong answer links to the step whose toy answers it, on this page
  await check
    .nth(0)
    .getByRole('button', { name: 'The notes', exact: true })
    .click()
  await page.locator('#qs a', { hasText: 'Try Step 3 again' }).click()
  await expect(page.locator('#stepNow')).toHaveText('3')

  await check
    .nth(1)
    .getByRole('button', { name: '7 semitones: a perfect fifth', exact: true })
    .click()
  await check
    .nth(2)
    .getByRole('button', { name: 'A leap', exact: true })
    .click()
  await check
    .nth(3)
    .getByRole('button', { name: 'No: two intervals changed', exact: true })
    .click()

  await expect(page.locator('#scoreN')).toHaveText('3')
  const lines = await page
    .locator('#qs .fb')
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))
  expect(lines).toHaveLength(4)
  for (const line of lines) expect(line).toMatch(/^(Right\.|Not quite\.)/)
  await expect(page.locator('#exCardHost')).toContainText('Done')
})

test("the Wrap's links carry lesson=06, and its card leads to Lesson 7 on the map", async ({
  page,
}) => {
  await page.goto('/learn/06')

  const hrefs = await page
    .locator('#practiseCard a')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')))
  expect(hrefs.length).toBeGreaterThan(0)
  for (const href of hrefs) expect(href).toMatch(/[?&]lesson=06$/)

  const card = page.locator('#wrap a.next-card')
  await expect(card).toHaveAttribute('href', '#explorer')
  await expect(card).toHaveAttribute('data-select-lesson', '7')
  await expect(card.locator('.tempo')).toHaveText('Coming later')
  await expect(card.locator('.chip')).toHaveText('See it on the map')
  await expect(card.locator('.next-tease')).toHaveText(
    LESSON_COPY[7]?.tease ?? 'Lesson 7 has a tease',
  )
  await card.click()
  await expect(page.locator('#exCardHost h3')).toHaveText(
    'Slides, sirens and your range',
  )
})
