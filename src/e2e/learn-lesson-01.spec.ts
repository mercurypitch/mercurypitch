// ============================================================
// Lesson 1 loads at /learn/01 as its own document, and boots
// ============================================================
//
// The lesson is a plain document with the whole lesson in its markup. Two
// things could hand a visitor something else, as with /delete-account: the
// asset layer could answer the 404 page, and a visitor who has used the
// studio has a service worker that answers every navigation it does not know
// with the cached app shell. Once it loads, the module must boot too: a page
// that reads but never plays is a failure nobody would think to report.

import { expect, test } from './helpers/lesson-page'
import { filmSources } from '../features/lessons/kit/films'
import { dismissOverlays } from './helpers/ui'

const TITLE = 'What is a note? Pitch, hertz and the octave | MercuryPitch'

test('a hard load of /learn/01 answers 200 with the lesson @smoke', async ({
  page,
}) => {
  const response = await page.goto('/learn/01')

  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(TITLE)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'why do musicians call them the same note?',
  )
  await expect(page.locator('#root')).toHaveCount(0)
})

test('the lesson boots: a guess unlocks the sounds, the explorer lights a path @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/learn/01')

  // the play buttons wait for a committed guess
  const play220 = page.locator('#predict [data-play="220"]')
  await expect(play220).toBeDisabled()
  await page.locator('#predict [data-choice="same"]').click()
  await expect(play220).toBeEnabled()

  // picking Lesson 14 lights every lesson it builds on, Lesson 1 among them
  await page.locator('#explorer').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: /^Lesson 14:/ }).click()
  await expect(page.getByRole('button', { name: /^Lesson 1:/ })).toHaveClass(
    /\banc\b/,
  )
  await expect(page.locator('#graph .edge.path').first()).toBeAttached()
  await expect(page.locator('#exCardHost h3')).toHaveText(
    'Phrasing: sing a whole song',
  )

  expect(errors).toEqual([])
})

// The Series blueprint is the team's plan, not part of the lesson: it lives
// in the Content Studio's Lessons page now. Every masthead anchor must still
// land on a section of this page.
test('the page has no blueprint and no link to one, and every masthead anchor lands @smoke', async ({
  page,
}) => {
  await page.goto('/learn/01')
  // the module has run: the explorer opened on this lesson's card
  await expect(page.locator('#exCardHost h3')).toHaveText('What is a note?')

  await expect(page.locator('#blueprint')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /blueprint/i })).toHaveCount(0)
  const anchors = await page
    .locator('#mastNav a')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''))
  expect(anchors.length).toBeGreaterThan(0)
  for (const href of anchors) {
    expect(href).toMatch(/^#[a-z]/)
    await expect(page.locator(href)).toHaveCount(1)
  }
})

test("Home's Lessons link, beside Learn and What's new, opens the lesson @smoke", async ({
  page,
}) => {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10_000 })
  await dismissOverlays(page)

  const lessons = page.getByTestId('home-lessons')
  await expect(lessons).toHaveAttribute('href', '/learn/01')
  await lessons.click()

  await expect(page).toHaveURL(/\/learn\/01$/)
  await expect(page).toHaveTitle(TITLE)
})

test("Home's Lessons link opens the visitor's next lesson, never a draft", async ({
  page,
}) => {
  // Lesson 1 marked done on its page, as its quiz and explorer card do.
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE: boolean }).E2E_TEST_MODE = true
    window.localStorage.setItem('fyp-done', '[1]')
  })
  await page.goto('/')
  await page.waitForSelector('#app-tabs', { timeout: 10_000 })
  await dismissOverlays(page)

  await expect(page.getByTestId('home-lessons')).toHaveAttribute(
    'href',
    '/learn/02',
  )

  // Lessons 1 and 2 done: this bundle serves Lesson 3, a draft, and Home
  // still offers the hub, as every environment serves it.
  // Init scripts run in the order they were added, so this one wins.
  await page.addInitScript(() => {
    window.localStorage.setItem('fyp-done', '[1,2]')
  })
  await page.reload()
  await page.waitForSelector('#app-tabs', { timeout: 10_000 })
  await dismissOverlays(page)

  await expect(page.getByTestId('home-lessons')).toHaveAttribute(
    'href',
    '/learn/',
  )
})

test('a visitor with the studio installed still gets the lesson, not the shell @smoke', async ({
  page,
}) => {
  await page.goto('/')
  // Registration is deferred to `load` (src/lib/pwa-service-worker.ts), and
  // the worker does not claim the page that registered it: one reload hands
  // it control, as in delete-account.spec.ts.
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

  await page.goto('/learn/01')

  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

// Until the film's MP4s are uploaded (kit/films.ts) there is nothing to
// watch, so the page offers nothing to watch: no section, no masthead link
// and no button on the card, the masthead numbered without a gap.
test('offers nothing to watch while the film has no sources @smoke', async ({
  page,
}) => {
  test.skip(
    filmSources(1) !== null,
    "Lesson 1's film has its sources in kit/films.ts: the page shows it",
  )
  await page.goto('/learn/01')
  // the module has run: the explorer opened on this lesson's card
  await expect(page.locator('#exCardHost h3')).toHaveText('What is a note?')

  await expect(page.locator('#watch')).toBeHidden()
  await expect(page.getByRole('link', { name: /watch/i })).toHaveCount(0)
  await expect(
    page.locator('#mastNav a:visible b').filter({ hasText: /^[IVX]+$/ }),
  ).toHaveText(['I', 'II'])
})

// Tavi mounts once Merc is live, so the stage can wait on her with Merc
// already drawn. The stills' four-second fallback (lesson-stage.css) must
// then bring back only hers, never his over him. Headless Chromium keeps
// both on their stills, so the test sets the classes that state has.
test('a live Merc keeps his still hidden while the stage waits on Tavi', async ({
  page,
}) => {
  await page.goto('/learn/01')
  const duo = page.locator('#duo')
  await expect(duo).not.toHaveClass(/\bpending\b/)
  const stillAnimations = (id: string): Promise<string[]> =>
    page.locator(`#${id} img`).evaluate((img) =>
      img
        .getAnimations()
        .filter((a) => a instanceof CSSAnimation)
        .map((a) => (a as CSSAnimation).animationName),
    )

  await duo.evaluate((el) => el.classList.add('pending'))
  await page.locator('#mercBlue').evaluate((el) => el.classList.add('is-live'))

  expect(await stillAnimations('mercBlue')).toEqual([])
  expect(await stillAnimations('mercOrange')).toEqual(['still-in'])
  await expect(page.locator('#mercBlue img')).toHaveCSS('opacity', '0')
})
