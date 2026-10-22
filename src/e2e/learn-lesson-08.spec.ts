// ============================================================
// Lesson 8 loads at /learn/08 as its own document, and boots
// ============================================================
//
// A draft until the vocal coach's sign-off. Every build carries its
// document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot.
// Then the checks of WEB-SPEC's end-to-end list (Tests) that run on the
// page as it loads: no AudioContext before a tap; the cold open's predict
// locks, and its reveal waits for a play of the claps on 2 and 4 that runs
// to its end, with sound off as well; the recall, which marks nothing done,
// and the quick check, which marks Lesson 8 done; and the Wrap's practice
// links and its card for Lesson 9, coming later. The beat machine, Step 5
// and the take are learn-lesson-08-qa.spec.ts's; the sung line is
// learn-lesson-08-sing.spec.ts's.

import { expect, test } from '@playwright/test'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'

// 60 characters at most (src/tests/lesson-pages.test.ts): the lesson's number is in its kicker
const TITLE = 'Beat, tempo and the backbeat, explained | MercuryPitch'

test('a hard load of /learn/08 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/08')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'clap on 2 and 4 instead of 1 and 3?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
  // a written lesson: no film, so no Watch section
  await expect(page.locator('#watch')).toHaveCount(0)
})

test('the lesson boots: no sound before a tap, the predict locks, and the reveal waits for a whole play on 2 and 4 @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
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
  await page.goto('/learn/08')
  await expect(page.locator('#exList .ex-row')).toHaveCount(15)
  expect(await contexts()).toBe(0)

  const on13 = page.locator('#heroPlay')
  const on24 = page.locator('#heroPlay24')
  const reveal = page.locator('#predict .reveal')
  const strip = page.locator('#heroStrip')
  const said = page.locator('[data-hero-said]')
  /** Until the reveal, the beat numbers are one size and no clap is gold. */
  const unanswered = async (): Promise<void> => {
    await expect(strip).not.toHaveClass(/\b(accented|backbeat)\b/)
    await expect(strip.locator('i.clap.gold')).toHaveCount(0)
  }

  // the claps on 1 and 3 play before a guess, make the page's one AudioContext, and reveal nothing
  await expect(on24).toBeDisabled()
  await on13.click()
  await expect(said).toHaveText('Claps on 1 and 3')
  await expect(on13).not.toHaveClass(/\bis-on\b/, { timeout: 20_000 })
  await expect(reveal).toBeHidden()
  await unanswered()
  expect(await contexts()).toBe(1)

  // the guess locks and unlocks the claps on 2 and 4
  await page.locator('#predict [data-choice="weak"]').click()
  await expect(page.locator('#predict [data-choice="weak"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('#predict [data-choice="strong"]')).toBeDisabled()
  await expect(on24).toBeEnabled()

  // a play on 2 and 4 cut short by another sound on the page, the quick
  // check's bars of 3, reveals nothing
  await on24.click()
  await expect(said).toHaveText('Claps moved to 2 and 4')
  await expect(on24).toHaveClass(/\bis-on\b/)
  await page.locator('#qs [data-quiz-play="bars"]').click()
  await expect(on24).not.toHaveClass(/\bis-on\b/)
  await expect(reveal).toBeHidden()
  await unanswered()

  // one that runs to its end brings the reveal, and the backbeat's marks with it
  await on24.click()
  await expect(reveal).toBeHidden()
  await expect(reveal).toBeVisible({ timeout: 20_000 })
  await expect(reveal).toContainText('Weak beats. Count 1 2 3 4')
  await expect(reveal.locator('.mono')).toHaveText('You said: weak beats')
  await expect(strip).toHaveClass(/\baccented\b/)
  await expect(strip).toHaveClass(/\bbackbeat\b/)
  await expect(strip.locator('i.clap.gold').first()).toBeVisible()
  expect(await contexts()).toBe(1)

  // the explorer opens on this page's own lesson, with no film
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await expect(page.locator('#exCardHost h3')).toHaveText(
    'Beat, tempo and the backbeat',
  )
  await expect(
    page
      .locator('#exCardHost')
      .getByRole('link', { name: 'Watch the episode' }),
  ).toHaveCount(0)

  expect(errors).toEqual([])
})

test('with sound off, the claps on 2 and 4 say nothing played, and the reveal waits', async ({
  page,
}) => {
  await page.goto('/learn/08')
  // the switch turns sound on from unset, then off
  await page.locator('#soundSwitch').click()
  await page.locator('#soundSwitch').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.locator('#predict [data-choice="strong"]').click()
  await page.locator('#heroPlay24').click()

  await expect(page.locator('#predict .lock-hint')).toHaveText(
    'Sound is off, so nothing played. Turn sound on to hear it, then press Play with claps on 2 and 4.',
    { timeout: 20_000 },
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

  await page.goto('/learn/08')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test("the recall opens once Lesson 6 is done, asks Lesson 6's questions, marks nothing done, and links Lesson 6's steps in a new tab", async ({
  page,
}) => {
  await page.goto('/learn/08')
  const recall = page.locator('#recallBox')
  await expect(recall).not.toHaveAttribute('open', '')
  await expect(recall.locator('summary')).toHaveText(
    'Done Lesson 6? Two questions from it',
  )

  await page.evaluate(() => localStorage.setItem('fyp-done', '[6]'))
  await page.reload()
  await expect(recall).toHaveAttribute('open', '')
  const before = await page.evaluate(() => localStorage.getItem('fyp-done'))

  const qs = page.locator('#rc-qs .q')
  await expect(qs).toHaveCount(2)
  // question 1's Play is Lesson 6's own
  await expect(qs.nth(0).locator('[data-quiz-play]')).toBeVisible()
  await qs
    .nth(0)
    .getByRole('button', { name: 'The notes', exact: true })
    .click()
  await qs
    .nth(1)
    .getByRole('button', {
      name: 'Yes: most of the notes are the same',
      exact: true,
    })
    .click()

  const step3 = page.locator('#rc-qs a', {
    hasText: 'Try Lesson 6, Step 3 again',
  })
  await expect(step3).toHaveAttribute('href', '/learn/06#step-3')
  await expect(step3).toHaveAttribute('target', '_blank')
  const step4 = page.locator('#rc-qs a', {
    hasText: 'Try Lesson 6, Step 4 again',
  })
  await expect(step4).toHaveAttribute('href', '/learn/06#step-4')
  await expect(step4).toHaveAttribute('target', '_blank')
  expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
    before,
  )
})

test('the quick check links its steps, starts each line Right. or Not quite., and marks Lesson 8 done', async ({
  page,
}) => {
  await page.goto('/learn/08')
  const check = page.locator('#qs .q')

  // a wrong answer links to the step whose toy answers it, on this page
  await check
    .nth(0)
    .getByRole('button', { name: '120 beats in every bar', exact: true })
    .click()
  await page.locator('#qs a', { hasText: 'Try Step 2 again' }).click()
  await expect(page.locator('#stepNow')).toHaveText('2')

  await check.nth(1).getByRole('button', { name: '3', exact: true }).click()
  await check
    .nth(2)
    .getByRole('button', { name: 'On 2 and 4', exact: true })
    .click()
  await check
    .nth(3)
    .getByRole('button', {
      name: 'The rhythm: which beats are stressed',
      exact: true,
    })
    .click()

  await expect(page.locator('#scoreN')).toHaveText('3')
  const lines = await page
    .locator('#qs .fb')
    .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))
  expect(lines).toHaveLength(4)
  for (const line of lines) expect(line).toMatch(/^(Right\.|Not quite\.)/)
  await expect(page.locator('#exCardHost')).toContainText('Done')
})

test("the Wrap's links carry lesson=08, and its card leads to Lesson 9 on the map", async ({
  page,
}) => {
  await page.goto('/learn/08')

  const hrefs = await page
    .locator('#practiseCard a')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')))
  expect(hrefs).toEqual([
    '/drum-night?drawer=learn&lesson=08',
    '/ear-lab?lesson=08',
  ])

  const card = page.locator('#wrap a.next-card')
  await expect(card).toHaveAttribute('href', '#explorer')
  await expect(card).toHaveAttribute('data-select-lesson', '9')
  await expect(card.locator('.tempo')).toHaveText('Coming later')
  await expect(card.locator('.chip')).toHaveText('See it on the map')
  await expect(card.locator('.next-tease')).toHaveText(
    LESSON_COPY[9]?.tease ?? 'Lesson 9 has a tease',
  )
  await card.click()
  await expect(page.locator('#exCardHost h3')).toHaveText('Landing a leap')
})
