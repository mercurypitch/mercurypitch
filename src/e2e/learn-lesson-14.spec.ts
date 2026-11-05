// ============================================================
// Lesson 14 loads at /learn/14 as its own document, and boots
// ============================================================
//
// A draft until the vocal coach signs it off. Every build carries its
// document, and the e2e bundle shows drafts (`build:e2e` sets
// VITE_DRAFT_LESSONS=1); on mercurypitch.com the site worker answers its
// address with the 404 page until the admin console publishes it
// (src/lesson-gate.ts). Like every lesson it must load as itself, never as
// the 404 page or the studio's cached app shell, and its module must boot.
// Then WEB-SPEC's first end-to-end check (Tests, End to end 1), at a
// phone's size and a desktop's: no AudioContext before the first tap, and
// nothing plays before a play button; and a visitor with the studio
// installed still gets the lesson, not the shell. Then the cold open's
// predict, the stage's targets and Step 1 by keyboard, the season's close
// after a rest, and what the page keeps and sends: nothing asks for the
// microphone before Sing it's Start, nothing leaves the page, and only the
// lesson's own keys are stored.

import type { Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'
import { expectTargets, openStep, tabsWithin } from './helpers/lesson-qa'

// 60 characters at most (src/tests/lesson-pages.test.ts)
const TITLE = 'Phrasing in singing: breath, swell and shape | MercuryPitch'

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

    test('a hard load of /learn/14 answers 200 with the lesson @smoke', async ({
      page,
    }) => {
      // Act
      const response = await page.goto('/learn/14')

      // Assert
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(TITLE)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'If every note of a song is in tune, what is left to shape?',
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
      await page.goto('/learn/14')
      await expect(page.locator('#exList .ex-row')).toHaveCount(15)
      await expect(page.locator('#stepNow')).toHaveText('1')
      await expect(page.locator('#deckNextLabel')).toHaveText(
        'Next: Where do I breathe?',
      )

      // Act: the whole page read, top to bottom, with no tap
      for (const id of ['#predict', '#words', '#lesson', '#sing', '#wrap'])
        await page.locator(id).scrollIntoViewIfNeeded()

      // Assert
      expect(await heard(page)).toEqual({ contexts: 0, sources: 0 })
      await expect(page.locator('.lm-btn')).toBeVisible()
      // the Wrap closes the season: the season's last lesson names none after it
      await expect(
        page.locator('#wrap [data-next-card="end"] .eyebrow'),
      ).toHaveText('End of Season 1')
      await expect(page.locator('#wrap a.next-card')).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test("nothing plays but the sound switch's own chime until a play button is pressed", async ({
      page,
    }) => {
      // Arrange: sound on from the gate, which confirms it with its two soft notes
      await watchSound(page)
      await page.goto('/learn/14')
      await page.locator('#gateBtn').click()
      await expect(page.locator('#soundSwitch')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      const after = await heard(page)

      // Act: a choice, the steps and the sections, none of them a play button
      await page.locator('#predict [data-choice="level"]').click()
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

// WEB-SPEC, End to end 14, as Lesson 3's spec checks its own
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
  await page.goto('/learn/14')

  // Assert
  await expect(page).toHaveTitle(TITLE)
  await expect(page.locator('#root')).toHaveCount(0)
})

const TOY = '#toySong'

test('the cold open: take 1 plays before a choice, take 2 waits for one, and the reveal comes once take 2 has played @smoke', async ({
  page,
}) => {
  // Arrange: sound on from the gate
  await page.goto('/learn/14')
  await page.locator('#gateBtn').click()
  const take2 = page.locator('.hero [data-play="take2"]')
  const reveal = page.locator('#predict .reveal')

  // Act: take 1 before a choice
  await expect(take2).toBeDisabled()
  await page.locator('#heroPlay').click()
  await expect(page.locator('#heroSong [data-hero-said]')).toHaveText(
    'Take 1: phrase 1 on “ooh”, with a breath between “little” and “star”',
    { timeout: 10_000 },
  )

  // Assert: nothing revealed; a choice opens take 2, which reveals once heard
  await expect(reveal).toBeHidden()
  await page.locator('#predict [data-choice="level"]').click()
  await expect(take2).toBeEnabled()
  await take2.click()
  await expect(reveal).toBeVisible({ timeout: 12_000 })
  await expect(reveal).toContainText('You said: it stays level')
  await expect(page.locator('#heroSong [data-hero-said]')).toContainText(
    'Take 2: the same seven notes, with the breath after “star”.',
  )
})

test('Step 1 by keyboard: Tab meets Play the song, then the six phrases, and a phrase plays by Enter, its button a Stop', async ({
  page,
}) => {
  // Arrange
  await openStep(page, '/learn/14', 1)

  // Act
  const met = await tabsWithin(page, `${TOY} [data-fig-label]`, TOY)
  const phrase = page.locator(`${TOY} [data-phrase="3"]`)
  await phrase.focus()
  await page.keyboard.press('Enter')

  // Assert
  expect(met).toEqual([
    'Play the song',
    'Play phrase 1: Twinkle, twinkle, little star',
    'Play phrase 2: How I wonder what you are',
    'Play phrase 3: Up above the world so high',
    'Play phrase 4: Like a diamond in the sky',
    'Play phrase 5: Twinkle, twinkle, little star',
    'Play phrase 6: How I wonder what you are',
  ])
  await expect(phrase).toHaveAccessibleName(
    'Stop phrase 3: Up above the world so high',
  )
  await expect(page.locator(`${TOY} [data-song-caption]`)).toHaveText(
    'Up above the world so high,',
  )
})

for (const width of [390, 344]) {
  test.describe(`the song line's targets at ${width} px wide`, () => {
    test.use({ viewport: { width, height: 844 } })

    test('every target of Steps 1 to 5 is at least 44 px square, and none overlaps another', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, '/learn/14', 1)
      const counts: number[] = []

      // Act, Assert
      for (let n = 1; n <= 5; n++) {
        if (n > 1) {
          await page
            .getByRole('button', { name: 'Next step', exact: true })
            .click()
          await expect(page.locator('#stepNow')).toHaveText(String(n))
        }
        counts.push(await expectTargets(page, TOY, `Step ${n}`))
      }
      expect(counts).toEqual([7, 2, 2, 2, 2])
    })
  })
}

test('the page asks for no microphone, sends nothing away and keeps only its own keys, through the cold open, the steps, the words and the quizzes', async ({
  page,
}) => {
  // Arrange: every microphone request counted, every request off this site kept
  await page.addInitScript(() => {
    const w = window as unknown as { micAsks: number }
    w.micAsks = 0
    const media = navigator.mediaDevices
    if (media !== undefined) {
      const real = media.getUserMedia.bind(media)
      media.getUserMedia = (c?: MediaStreamConstraints) => {
        w.micAsks += 1
        return real(c)
      }
    }
  })
  const away: string[] = []
  const origin = new URL(page.url() === 'about:blank' ? 'http://x' : page.url())
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (
      u.protocol.startsWith('http') &&
      u.hostname !== 'localhost' &&
      u.hostname !== '127.0.0.1' &&
      u.hostname !== origin.hostname
    )
      away.push(u.href)
  })
  await page.goto('/learn/14')
  await page.locator('#gateBtn').click()

  // Act: a take, a word, Step 1's song played and stopped, and an answer in
  // each quiz. The song's Play is Step 1's, so Step 1 opens first: a click
  // that scrolled to it from the words could stop the page on Step 2, which
  // hides it.
  await page.locator('#heroPlay').click()
  await page.locator('[data-word-play="swell"]').click()
  await openStep(page, '/learn/14', 1)
  await page.locator(`${TOY} [data-song-play="song"]`).click()
  await page.locator(`${TOY} [data-song-play="song"]`).click()
  await page.locator('#rc-qs .q .opt').first().click()
  await page.locator('#qs .q .opt').first().click()
  for (const id of ['#words', '#lesson', '#sing', '#wrap', '#explorer'])
    await page.locator(id).scrollIntoViewIfNeeded()

  // Assert
  expect(
    await page.evaluate(
      () => (window as unknown as { micAsks: number }).micAsks,
    ),
  ).toBe(0)
  expect(away).toEqual([])
  const keys = await page.evaluate(() => Object.keys(localStorage).sort())
  expect(
    keys.filter(
      (k) =>
        !/^fyp-l14-(seed|quiz-v1|recall-seed|recall-v1|warmup)$/.test(k) &&
        !/^fyp-(voice|done|pos|sound|motion|tour|tour-seen)$/.test(k),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(async () =>
      'indexedDB' in window && 'databases' in indexedDB
        ? (await indexedDB.databases()).map((d) => d.name)
        : [],
    ),
  ).toEqual([])
})
