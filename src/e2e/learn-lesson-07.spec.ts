// ============================================================
// Lesson 7 loads at /learn/07 as its own document, and boots
// ============================================================
//
// A draft until the owner's review and the vocal coach's sign-off. Every
// build carries its document, and the e2e bundle shows drafts (`build:e2e`
// sets VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers
// its address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot.
// Then the checks of WEB-SPEC's end-to-end list (Tests) that run on the
// page as it loads: no AudioContext before a tap; the cold open's predict
// locks, Play "Twinkle" sounds before a guess and names no note, and the
// reveal waits for Play "Twinkle" on the column to be heard, with sound
// off as well; the recall, which marks nothing done and links Lesson 3's
// step in a new tab, and the quick check, which marks Lesson 7 done; the
// Wrap's practice links and its card for Lesson 8, a draft the e2e bundle
// shows; and with reduced motion, a siren drawn at once. The chart by
// keyboard and the layouts are learn-lesson-07-qa.spec.ts's; Sing it is
// learn-lesson-07-sing.spec.ts's.

import { expect, test } from './helpers/lesson-page'
import { LESSON_COPY } from '../features/lessons/kit/lesson-copy'

// 60 characters at most (src/tests/lesson-pages.test.ts): the lesson's number is in its kicker
const TITLE = 'Your vocal range: slides, sirens and comfort | MercuryPitch'

test('a hard load of /learn/07 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/07')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'comfortable middle worth more than your highest note?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
  // a written lesson: no film, so no Watch section
  await expect(page.locator('#watch')).toHaveCount(0)
})

test('the lesson boots: no sound before a tap, the predict locks, and the reveal waits for the column @smoke', async ({
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
  await page.goto('/learn/07')
  await expect(page.locator('#exList .ex-row')).toHaveCount(15)
  expect(await contexts()).toBe(0)

  // Play "Twinkle" works before a guess, makes the page's one AudioContext, and names no note
  const tune = page.locator('#heroPlay')
  const onColumn = page.locator('#predict [data-play="column"]')
  const reveal = page.locator('#predict .reveal')
  const said = page.locator('#heroRange [data-hero-said]')
  await expect(onColumn).toBeDisabled()
  await tune.click()
  await expect(said).toHaveText('Twinkle, Twinkle, its first two lines')
  await expect(tune).not.toHaveClass(/\bis-on\b/, { timeout: 20_000 })
  await expect(said).not.toHaveText(/\b[A-G](?: sharp| flat)? ?\d\b/)
  await expect(reveal).toBeHidden()
  expect(await contexts()).toBe(1)

  // the guess locks and unlocks the column's play, whose sound brings the reveal
  await page.locator('#predict [data-choice="less"]').click()
  await expect(page.locator('#predict [data-choice="less"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('#predict [data-choice="most"]')).toBeDisabled()
  await expect(onColumn).toBeEnabled()
  await expect(reveal).toBeHidden()
  await onColumn.click()
  await expect(reveal).toBeVisible({ timeout: 20_000 })
  await expect(reveal).toContainText(
    'Less than half. The whole tune spans 9 semitones',
  )
  await expect(reveal.locator('.mono')).toHaveText('You said: less than half')
  await expect(said).toContainText("9 of the column's 24 semitones")
  await expect(said).not.toHaveText(/[♯♭]/)
  expect(await contexts()).toBe(1)

  // the explorer opens on this page's own lesson, with no film
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await expect(page.locator('#exCardHost h3')).toHaveText(
    'Slides, sirens and your range',
  )
  await expect(
    page
      .locator('#exCardHost')
      .getByRole('link', { name: 'Watch the episode' }),
  ).toHaveCount(0)

  expect(errors).toEqual([])
})

test('with sound off, the column’s play says nothing played, and the reveal waits', async ({
  page,
}) => {
  await page.goto('/learn/07')
  // the switch turns sound on from unset, then off
  await page.locator('#soundSwitch').click()
  await page.locator('#soundSwitch').click()
  await expect(page.locator('#soundSwitch')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.locator('#predict [data-choice="most"]').click()
  await page.locator('#predict [data-play="column"]').click()

  await expect(page.locator('#predict .lock-hint')).toContainText(
    'Sound is off, so nothing played.',
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

  await page.goto('/learn/07')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

test("the recall asks Lesson 3's questions, marks nothing done and links Lesson 3's step in a new tab", async ({
  page,
}) => {
  await page.goto('/learn/07')
  const done = (): Promise<string | null> =>
    page.evaluate(() => localStorage.getItem('fyp-done'))
  // a first visit: nothing done yet
  const before = await done()
  expect([null, '[]']).toContain(before)

  const qs = page.locator('#recall-qs .q')
  await expect(qs).toHaveCount(2)
  await qs
    .nth(0)
    .getByRole('button', {
      name: 'Staying still while your mouth makes the note',
      exact: true,
    })
    .click()
  await qs
    .nth(1)
    .getByRole('button', {
      name: 'At about the volume you talk at',
      exact: true,
    })
    .click()

  const link = page.locator('#recall-qs a', {
    hasText: 'Try Lesson 3, Step 1 again',
  })
  await expect(link).toHaveAttribute('href', '/learn/03#step-1')
  await expect(link).toHaveAttribute('target', '_blank')
  expect(await done()).toBe(before)
})

test('the quick check links its steps, starts each line Right. or Not quite., and marks Lesson 7 done', async ({
  page,
}) => {
  await page.goto('/learn/07')
  const check = page.locator('#qs .q')

  // a wrong answer links to the step whose chart answers it, on this page
  await check
    .nth(2)
    .getByRole('button', {
      name: "They're right: more notes make a better singer",
      exact: true,
    })
    .click()
  await page.locator('#qs a', { hasText: 'Try Step 4 again' }).click()
  await expect(page.locator('#stepNow')).toHaveText('4')

  await check
    .nth(0)
    .getByRole('button', {
      name: 'A smooth hill, up and back down, with no steps',
      exact: true,
    })
    .click()
  await check
    .nth(1)
    .getByRole('button', {
      name: 'Few of them test singers, and many look mainly at what changes straight away',
      exact: true,
    })
    .click()
  await check
    .nth(3)
    .getByRole('button', {
      name: 'Not always: where each voice is comfortable, and how it sounds, count too',
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

test("the Wrap's links carry lesson=07, and its card leads to Lesson 8's page", async ({
  page,
}) => {
  await page.goto('/learn/07')

  const hrefs = await page
    .locator('a[href*="lesson="]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')))
  expect(hrefs.length).toBeGreaterThan(1)
  for (const href of hrefs) expect(href).toBe('/vocal-range-test?lesson=07')

  const card = page.locator('#wrap a.next-card')
  await expect(card).toHaveAttribute('href', '/learn/08')
  await expect(card.locator('.tempo')).toHaveText('Ready · 16 min')
  await expect(card.locator('.chip')).toHaveText('Start lesson')
  await expect(card.locator('.next-tease')).toHaveText(
    LESSON_COPY[8]?.tease ?? 'Lesson 8 has a tease',
  )
})

test('with reduced motion a siren draws at once, and nothing moves on its own', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/learn/07#step-1')
  await expect(page.locator('#stepNow')).toHaveText('1')
  const scrub = page.locator('#toyRange [data-siren-scrub]')
  await expect(scrub).toHaveAttribute('aria-valuenow', '0.0')

  await page.locator('#toyRange [data-siren-play]').click()

  // the whole line at once: the scrub bar stands at the siren's end
  await expect(scrub).toHaveAttribute('aria-valuenow', '6.0', { timeout: 500 })
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
