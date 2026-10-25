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
// button; and its second, the cold open (End to end 2), at a phone's size
// and a desktop's: Merc's leap plays before a choice, the paths wait for
// one, and the reveal waits until all three have been heard to their end
// with sound on, a path cut short by the four words' Leap or by the Sound
// switch never counting; and its eighth, the quizzes (End to end 8), at
// both sizes: the recall shows to everyone, marks nothing done and links
// Lesson 6's steps in a new tab, and the quick check marks Lesson 9 done.
// Then the chart by keyboard alone (End to end 3), at both sizes, for
// Steps 1 to 4: Tab reaches each control in reading order, Slow toggles
// `aria-pressed`, each play says its move in spoken names, the folds strip
// fills the figure's bottom 64 px, Step 3's climb clears the line a leap
// left, and Step 4 names its five leaps in order. Each other toy's checks
// join it as that toy is wired.

import type { Locator, Page } from '@playwright/test'
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

// WEB-SPEC, End to end 2, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the cold open at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test("Merc's leap plays before a choice, the paths wait for one, and the reveal waits for all three heard to their end with sound on", async ({
      page,
    }) => {
      test.setTimeout(90_000)
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await watchSound(page)
      await page.goto('/learn/09')
      const leap = page.locator('#heroPlay')
      const [re, mi, fa] = ['re', 'mi', 'fa'].map((p) =>
        page.locator(`#predict [data-play="${p}"]`),
      )
      const reveal = page.locator('#predict .reveal')
      const hint = page.locator('#predict .lock-hint')
      const said = page.locator('[data-hero-said]')
      const sound = page.locator('#soundSwitch')
      /** Plays `b` and waits for it to finish. */
      const playThrough = async (b: Locator): Promise<void> => {
        await b.click()
        await expect(b).toHaveClass(/\bis-on\b/)
        await expect(b).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
      }

      // Act, Assert: Merc's leap before a choice plays and reveals nothing
      for (const b of [re, mi, fa]) await expect(b).toBeDisabled()
      await playThrough(leap)
      await expect(said).toHaveText(
        "Merc's leap: do, D3, up to so, A3, a perfect fifth",
      )
      await expect(reveal).toBeHidden()
      expect((await heard(page)).sources).toBeGreaterThan(0)

      // the choice unlocks the three paths
      await page.locator('#predict [data-choice="mi"]').click()
      for (const b of [re, mi, fa]) await expect(b).toBeEnabled()

      // re and mi heard to their end leave it hidden
      await playThrough(re)
      await expect(hint).toHaveText(
        "Now play the others, so you've heard all three.",
      )
      await playThrough(mi)
      await expect(reveal).toBeHidden()

      // fa cut short by the four words' Leap, played over it, brings nothing
      const word = page.locator('[data-word-play="leap"]')
      await fa.click()
      await expect(fa).toHaveClass(/\bis-on\b/)
      await word.click()
      await expect(word).toHaveClass(/\bis-on\b/)
      await expect(fa).not.toHaveClass(/\bis-on\b/)
      await expect(word).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
      await expect(reveal).toBeHidden()

      // and so does fa cut short as the Sound switch silences it
      await fa.click()
      await expect(fa).toHaveClass(/\bis-on\b/)
      await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', 'false')
      await expect(fa).not.toHaveClass(/\bis-on\b/)
      await expect(reveal).toBeHidden()

      // with sound off, fa says nothing played, and still no reveal
      await playThrough(fa)
      await expect(hint).toHaveText(
        'Sound is off, so nothing played. Turn sound on to hear them, then play all three.',
      )
      await expect(reveal).toBeHidden()

      // sound on, fa heard to its end brings the reveal
      await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', 'true')
      await fa.click()
      await expect(reveal).toBeVisible({ timeout: 10_000 })
      await expect(reveal.locator('.mono')).toHaveText('You said: mi')
      expect(errors).toEqual([])
    })
  })
}

// WEB-SPEC, End to end 8, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the quizzes at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test("the recall shows to everyone, marks nothing done and links Lesson 6's steps in a new tab; the quick check marks Lesson 9 done", async ({
      page,
    }) => {
      // Arrange: no lesson done
      await page.goto('/learn/09')
      expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
        null,
      )
      const recall = page.locator('#rc-qs')
      const check = page.locator('#qs')
      /** Answers `option`, in `quiz`. */
      const answer = (quiz: Locator, option: string): Promise<void> =>
        quiz.getByRole('button', { name: option, exact: true }).click()

      // Act: the recall, both answered with the misconception
      await expect(recall.locator('.q')).toHaveCount(2)
      await answer(recall, '5 semitones: a perfect fourth')
      await answer(recall, 'A step')

      // Assert: nothing marked done, and each step link opens Lesson 6 in a new tab
      expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
        null,
      )
      const links = await recall
        .locator('.fb a')
        .evaluateAll((as) =>
          as.map((a) => [
            a.getAttribute('href'),
            a.getAttribute('target'),
            a.textContent,
          ]),
        )
      expect(links).toEqual([
        ['/learn/06#step-5', '_blank', 'Try Lesson 6, Step 5 again'],
        ['/learn/06#step-2', '_blank', 'Try Lesson 6, Step 2 again'],
      ])

      // Act: the quick check, a wrong answer's step link first
      await answer(check, "They're right: a leap is too quick to aim")
      await check.locator('a', { hasText: 'Try Step 2 again' }).click()
      await expect(page.locator('#stepNow')).toHaveText('2')
      await answer(check, 'A major third, then a minor third: 4 and 3')
      await answer(check, 'The minor and major thirds')
      await answer(check, "Listen, then slide up into so's band")

      // Assert: every line starts the kit's way, and Lesson 9 is done
      await expect(page.locator('#scoreN')).toHaveText('3')
      const lines = await page
        .locator('#rc-qs .fb, #qs .fb')
        .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? ''))
      expect(lines).toHaveLength(6)
      for (const line of lines) expect(line).toMatch(/^(Right\.|Not quite\.)/)
      expect(await page.evaluate(() => localStorage.getItem('fyp-done'))).toBe(
        '[9]',
      )
      // the map's card on a desktop, the list's open row on a phone
      await page.locator('#explorer').scrollIntoViewIfNeeded()
      await expect(page.locator('#explorer .ex-card')).toContainText('Done')
    })
  })
}

/** The status line under the ladder chart. */
const ladderStatus = (page: Page): Locator =>
  page.locator('#toyLadder [data-ladder-status]')

/** `b` pressed by keyboard, from where the focus stands, sounds and then ends. */
async function playsThrough(page: Page, b: Locator): Promise<void> {
  await expect(b).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(b).toHaveClass(/\bis-on\b/)
  await expect(b).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
}

// WEB-SPEC, End to end 3: Steps 1 and 2, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Steps 1 and 2 by keyboard at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Tab reaches each control in reading order, Slow toggles aria-pressed, and each play says its move in spoken names', async ({
      page,
    }) => {
      test.setTimeout(60_000)
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto('/learn/09')
      const toy = page.locator('#toyLadder')
      const play = (id: string): Locator =>
        toy.locator(`[data-ladder-play="${id}"]`)
      const [step, hear, leap] = [play('step'), play('hear'), play('leap')]
      const slow = toy.locator('[data-ladder-slow]')
      const next = page.getByRole('button', { name: 'Next step', exact: true })
      const strip = toy.locator('[data-folds-strip]')
      await step.scrollIntoViewIfNeeded()
      await step.focus()
      await expect(page.locator('#stepNow')).toHaveText('1')

      // Act, Assert: Step 1's row in reading order, then Slow by Space
      await page.keyboard.press('Tab')
      await expect(leap).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(slow).toBeFocused()
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'false')

      // Step and Leap, each saying its move and the folds' ratio in words
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')
      await playsThrough(page, step)
      await expect(ladderStatus(page)).toHaveText(
        'The step: D3 to E3, a tone. The folds go about an eighth faster: 1.12 times.',
      )
      await page.keyboard.press('Tab')
      await playsThrough(page, leap)
      await expect(ladderStatus(page)).toHaveText(
        'The leap: D3 to A3, a perfect fifth. The folds go one and a half times as fast: 1.50 times.',
      )

      // the folds strip fills the figure's bottom 64 px, inside its border
      const box = await strip.boundingBox()
      const viz = await toy.locator('[data-ladder-viz]').boundingBox()
      expect(box?.height).toBe(64)
      expect(
        Math.abs((box?.y ?? 0) + 64 - ((viz?.y ?? 0) + (viz?.height ?? 0))),
      ).toBeLessThanOrEqual(1)

      // Step 2 by the stage's Next, its row in reading order
      await step.focus()
      await page.keyboard.press('Shift+Tab')
      await expect(next).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.locator('#stepNow')).toHaveText('2')
      await expect(ladderStatus(page)).toHaveText('')
      await expect(strip).toBeHidden()
      await page.keyboard.press('Tab')
      await playsThrough(page, hear)
      await expect(ladderStatus(page)).toHaveText(
        'So: hear where the leap lands.',
      )
      await page.keyboard.press('Tab')
      await playsThrough(page, leap)
      await expect(ladderStatus(page)).toHaveText(
        'The leap: D3 to A3, a perfect fifth.',
      )
      await page.keyboard.press('Tab')
      await expect(slow).toBeFocused()
      expect(errors).toEqual([])
    })
  })
}

// WEB-SPEC, End to end 3: Steps 3 and 4, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Steps 3 and 4 by keyboard at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Tab reaches each control in reading order, each leap says what it skips, the climb clears the line, and Step 4 names its leaps in order', async ({
      page,
    }) => {
      test.setTimeout(90_000)
      // Arrange
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto('/learn/09#step-3')
      const toy = page.locator('#toyLadder')
      const play = (id: string): Locator =>
        toy.locator(`[data-ladder-play="${id}"]`)
      const slow = toy.locator('[data-ladder-slow]')
      const next = page.getByRole('button', { name: 'Next step', exact: true })
      await expect(page.locator('#stepNow')).toHaveText('3')
      await play('climb').scrollIntoViewIfNeeded()
      await play('climb').focus()

      // Act, Assert: Step 3's row in reading order
      await page.keyboard.press('Tab')
      await playsThrough(page, play('to-so'))
      await expect(ladderStatus(page)).toHaveText(
        'Do to so: a perfect fifth, 7 semitones, over mi.',
      )
      await page.keyboard.press('Tab')
      await playsThrough(page, play('to-top'))
      await expect(ladderStatus(page)).toHaveText(
        'Do to the top do: an octave, 12 semitones, over mi and so.',
      )
      await page.keyboard.press('Tab')
      await expect(slow).toBeFocused()

      // the climb names no leap, so the line the last one left goes
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')
      await playsThrough(page, play('climb'))
      await expect(ladderStatus(page)).toHaveText('')

      // Step 4 by the stage's Next: its play, then Slow
      await play('climb').focus()
      await page.keyboard.press('Shift+Tab')
      await expect(next).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.locator('#stepNow')).toHaveText('4')
      await page.keyboard.press('Tab')
      const five = play('five')
      await expect(five).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(five).toHaveClass(/\bis-on\b/)
      await expect(ladderStatus(page)).toHaveText(
        '1 of 5: mi to so, a minor third, 3 semitones',
      )
      await expect(ladderStatus(page)).toHaveText(
        '5 of 5: do to the top do, an octave, 12 semitones',
        { timeout: 15_000 },
      )
      await expect(five).not.toHaveClass(/\bis-on\b/, { timeout: 5_000 })
      await page.keyboard.press('Tab')
      await expect(slow).toBeFocused()
      expect(errors).toEqual([])
    })
  })
}
