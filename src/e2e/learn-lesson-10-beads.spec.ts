// ============================================================
// Lesson 10's chord beads by keyboard, and Step 5's predict
// ============================================================
//
// WEB-SPEC's fourth end-to-end check, step by step, at a phone's size and
// a desktop's: Tab reaches every control, bead and gap button, a control
// that waits for a choice passed by while it is disabled; Major · Minor,
// Slow · Fast, Slow, Chord · Scale and the names switch toggle
// `aria-pressed`; Stack a third hands the focus to Play the triad; each
// change reaches the toy's polite line; and at 390 x 844 every target is
// at least 44 px square with none overlapping, at every root. Its third:
// Step 5's Major · Minor is disabled until the predict's choice and stays
// enabled after the viewer leaves the step and comes back, and the reveal
// waits until both scales have been heard. On the e2e bundle, which shows
// drafts; the page's load, its cold open and its quizzes are
// learn-lesson-10.spec.ts's.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from './helpers/lesson-page'

/** The steps' chord beads. */
const TOY = '#toyChord'

/** What has the focus, by name: its label, or its words. */
const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement
    return (el?.getAttribute('aria-label') ?? el?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  })

/** Whether the page has kept still for 300 ms. */
const still = (page: Page): Promise<boolean> =>
  page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const y = window.scrollY
        window.setTimeout(() => resolve(window.scrollY === y), 300)
      }),
  )

/**
 * Opens step `n` from the address, as a step link does, and waits for the
 * deck's smooth scroll to bring it beside the stage: a focus that lands
 * before then stops the scroll short, and on a desktop the deck follows
 * the page to the step whose text is in view there.
 */
async function openStep(page: Page, n: number): Promise<void> {
  await page.goto(`/learn/10#step-${n}`)
  await expect(page.locator('#stepNow')).toHaveText(String(n))
  await expect.poll(() => still(page)).toBe(true)
}

/** The names Tab meets from `from`, one for each of `count` presses. */
async function tabsFrom(
  page: Page,
  from: Locator,
  count: number,
): Promise<string[]> {
  await from.focus()
  const met: string[] = []
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab')
    met.push(await focusedName(page))
  }
  return met
}

interface Box {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Every button showing on the stage: at least 44 px square, and no two overlapping. */
async function expectTargets(page: Page, what: string): Promise<void> {
  const boxes: Box[] = await page
    .locator(`${TOY} button:visible`)
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          name: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '',
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        }
      }),
    )
  expect(boxes.length, what).toBeGreaterThan(0)
  for (const b of boxes) {
    expect(b.w, `${what}: ${b.name}`).toBeGreaterThanOrEqual(44)
    expect(b.h, `${what}: ${b.name}`).toBeGreaterThanOrEqual(44)
  }
  // a segmented switch's halves meet edge to edge, a fraction of a pixel
  // either way, as Lesson 7's controls do
  const overlap = (a: Box, b: Box): boolean =>
    a.x < b.x + b.w - 0.5 &&
    b.x < a.x + a.w - 0.5 &&
    a.y < b.y + b.h - 0.5 &&
    b.y < a.y + a.h - 0.5
  boxes.forEach((a, i) =>
    boxes.forEach((b, j) => {
      if (i < j)
        expect(overlap(a, b), `${what}: ${a.name} and ${b.name}`).toBe(false)
    }),
  )
}

// WEB-SPEC, End to end 4, step by step, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`the chord beads by keyboard at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Step 1: Tab reaches every control, bead and gap button; Major · Minor and Slow toggle aria-pressed, and the switch is said', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, 1)
      const said = page.locator(`${TOY} [data-chord-said]`)
      const [major, minor] = ['major', 'minor'].map((qy) =>
        page.locator(`${TOY} [data-chord-quality] [data-quality="${qy}"]`),
      )
      const slow = page.locator(`${TOY} [data-chord-slow]`)

      // Act: Tab from Play the third
      const met = await tabsFrom(
        page,
        page.locator(`${TOY} [data-chord-play="third"]`),
        6,
      )

      // Assert: the controls in reading order, then the beads, then the gap
      expect(met).toEqual([
        'Slow',
        'Major',
        'Minor',
        'C 4, the bottom note',
        'E 4, the top note',
        '4, major third: C 4 up to E 4',
      ])

      // Act, Assert: Minor by keyboard, said once, the gap renamed
      await expect(major).toHaveAttribute('aria-pressed', 'true')
      await minor.focus()
      await page.keyboard.press('Enter')
      await expect(minor).toHaveAttribute('aria-pressed', 'true')
      await expect(major).toHaveAttribute('aria-pressed', 'false')
      await expect(said).toHaveText(
        'Minor: the top note moved down a semitone, to E flat 4. A minor third.',
      )
      await expect(page.locator(`${TOY} .chord-hit-gap`)).toHaveAttribute(
        'aria-label',
        '3, minor third: C 4 up to E flat 4',
      )

      // Slow on and off by keyboard
      await slow.focus()
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'true')
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'false')
    })

    test('Step 2: Stack a third hands the focus to Play the triad and says what it stacked, and Tab reaches the three beads and both gaps', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, 2)
      const stack = page.locator(`${TOY} [data-chord-stack]`)
      const triad = page.locator(`${TOY} [data-chord-play="triad"]`)
      await expect(triad).toBeHidden()

      // Act
      await stack.focus()
      await page.keyboard.press('Enter')

      // Assert
      await expect(triad).toBeFocused()
      await expect(stack).toBeHidden()
      await expect(page.locator(`${TOY} [data-chord-said]`)).toHaveText(
        'Stacked: C, E, G. C major.',
      )
      expect(await tabsFrom(page, triad, 6)).toEqual([
        'Slow',
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
        '4, major third: C 4 up to E 4',
        '3, minor third: E 4 up to G 4',
      ])
    })

    test('Step 3: Tab reaches the root buttons, the beads and both gaps; Root lower keeps the focus at C4, and Root higher slides the chord and says where', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, 3)
      const said = page.locator(`${TOY} [data-chord-said]`)
      const [lower, higher] = ['-1', '1'].map((d) =>
        page.locator(`${TOY} [data-chord-root="${d}"]`),
      )

      // Act
      const met = await tabsFrom(
        page,
        page.locator(`${TOY} [data-chord-play="triad"]`),
        10,
      )

      // Assert
      expect(met).toEqual([
        'Slow',
        'Major',
        'Minor',
        'Root lower',
        'Root higher',
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
        '4, major third: C 4 up to E 4',
        '3, minor third: E 4 up to G 4',
      ])

      // Act, Assert: Root lower at its end keeps the focus and does nothing
      await expect(lower).toHaveAttribute('aria-disabled', 'true')
      await lower.focus()
      await page.keyboard.press('Enter')
      await expect(lower).toBeFocused()
      await expect(said).toHaveText('')

      // Root higher by keyboard, said once, and Root lower free again
      await higher.focus()
      await page.keyboard.press('Enter')
      await expect(said).toHaveText('Root higher: D, F sharp, A. D major.')
      await expect(lower).toHaveAttribute('aria-disabled', 'false')
      await expect(page.locator(`${TOY} [data-bead="1"]`)).toHaveAttribute(
        'aria-label',
        'F sharp 4, the third',
      )
    })

    test('Step 4: Slow · Fast toggles aria-pressed by keyboard, and the pattern plays on through a switch to the end', async ({
      page,
    }) => {
      test.setTimeout(60_000)
      // Arrange
      await openStep(page, 4)
      await page.locator('#soundSwitch').click()
      const play = page.locator(`${TOY} [data-chord-play="pattern"]`)
      const [slow, fast] = ['slow', 'fast'].map((t) =>
        page.locator(`${TOY} [data-chord-tempo] [data-tempo="${t}"]`),
      )

      // Act: Tab from Play the pattern, then Fast by keyboard
      const met = await tabsFrom(page, play, 7)
      await fast.focus()
      await page.keyboard.press('Space')

      // Assert
      expect(met).toEqual([
        'Major',
        'Minor',
        'Slow',
        'Fast',
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
      ])
      await expect(fast).toHaveAttribute('aria-pressed', 'true')
      await expect(slow).toHaveAttribute('aria-pressed', 'false')

      // Act, Assert: the pattern played, Minor pressed while it plays on, to its end
      await play.focus()
      await page.keyboard.press('Enter')
      await expect(play).toHaveClass(/\bis-on\b/)
      const minor = page.locator(
        `${TOY} [data-chord-quality] [data-quality="minor"]`,
      )
      await minor.focus()
      await page.keyboard.press('Enter')
      await expect(minor).toHaveAttribute('aria-pressed', 'true')
      await expect(play).toHaveClass(/\bis-on\b/)
      await expect(play).not.toHaveClass(/\bis-on\b/, { timeout: 10_000 })
      await expect(page.locator('#stepNow')).toHaveText('4')
    })

    test('Step 5: Tab reaches Chord · Scale, Slow, the names switch and the beads, Major · Minor waiting for the choice; each switch toggles aria-pressed, and the spread is said', async ({
      page,
    }) => {
      // Arrange
      await openStep(page, 5)
      const said = page.locator(`${TOY} [data-chord-said]`)
      const [chord, scale] = ['chord', 'scale'].map((v) =>
        page.locator(`${TOY} [data-chord-view] [data-view="${v}"]`),
      )
      const slow = page.locator(`${TOY} [data-chord-slow]`)
      const [letters, solfege] = ['letters', 'solfege'].map((m) =>
        page.locator(`${TOY} [data-names="${m}"]`),
      )

      // Act: Tab from Chord, folded
      const folded = await tabsFrom(page, chord, 7)
      await scale.focus()
      await page.keyboard.press('Enter')

      // Assert: Major · Minor is disabled, so Tab passes it by
      expect(folded).toEqual([
        'Scale',
        'Slow',
        'Letters',
        'Do-re-mi',
        'C 4, the root',
        'E 4, the third',
        'G 4, the fifth',
      ])
      for (const b of await page
        .locator(`${TOY} [data-scale-quality] button`)
        .all())
        await expect(b).toBeDisabled()
      await expect(scale).toHaveAttribute('aria-pressed', 'true')
      await expect(chord).toHaveAttribute('aria-pressed', 'false')
      await expect(said).toHaveText(
        'Scale: C, D, E, F, G, A, B, C. C major scale.',
      )

      // Act, Assert: spread, no stair is a target; Do-re-mi and Slow by keyboard
      expect(await tabsFrom(page, letters, 1)).toEqual(['Do-re-mi'])
      await page.keyboard.press('Space')
      await expect(solfege).toHaveAttribute('aria-pressed', 'true')
      await expect(letters).toHaveAttribute('aria-pressed', 'false')
      await slow.focus()
      await page.keyboard.press('Space')
      await expect(slow).toHaveAttribute('aria-pressed', 'true')
      await chord.focus()
      await page.keyboard.press('Enter')
      await expect(chord).toHaveAttribute('aria-pressed', 'true')
      await expect(said).toHaveText('Chord: C, E, G. C major.')
      await expect(page.locator('#stepNow')).toHaveText('5')
    })
  })
}

// WEB-SPEC, End to end 4's targets, at 390 x 844
test.describe('the chord beads’ targets at 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('every target of Steps 1 and 2 is at least 44 px square, and none overlaps another', async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 1)
    await expect(page.locator(`${TOY} .chord-hit`)).toHaveCount(3)

    // Act, Assert: Step 1 in major and in minor, Step 2 before and after its stack
    await expectTargets(page, 'Step 1')
    await page
      .locator(`${TOY} [data-chord-quality] [data-quality="minor"]`)
      .click()
    await expectTargets(page, 'Step 1 in minor')
    await page.getByRole('button', { name: 'Next step', exact: true }).click()
    await expect(page.locator('#stepNow')).toHaveText('2')
    await expectTargets(page, 'Step 2')
    await page.locator(`${TOY} [data-chord-stack]`).click()
    await expect(page.locator(`${TOY} .chord-hit`)).toHaveCount(5)
    await expectTargets(page, 'Step 2 stacked')
  })

  test('every target of Steps 3 and 4 is at least 44 px square, and none overlaps another, at every root', async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 3)
    const higher = page.locator(`${TOY} [data-chord-root="1"]`)

    // Act, Assert: Step 3 in minor on C4 to B4, then Step 4
    await page
      .locator(`${TOY} [data-chord-quality] [data-quality="minor"]`)
      .click()
    for (const root of ['C', 'D', 'E', 'F', 'G', 'A', 'B']) {
      await expect(page.locator(`${TOY} [data-bead="0"]`)).toHaveAttribute(
        'aria-label',
        new RegExp(`^${root} 4, the root$`),
      )
      await expectTargets(page, `Step 3 on ${root}4`)
      if (root !== 'B') await higher.click()
    }
    await page.getByRole('button', { name: 'Next step', exact: true }).click()
    await expect(page.locator('#stepNow')).toHaveText('4')
    await expectTargets(page, 'Step 4')
  })

  test('every target of Step 5 is at least 44 px square, and none overlaps another, folded and spread', async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 5)

    // Act, Assert: the chord, then its scale, once the choice is in
    await expectTargets(page, 'Step 5 folded')
    await page.locator('#predictScale [data-choice="three"]').click()
    await page.locator(`${TOY} [data-chord-view] [data-view="scale"]`).click()
    await expect(page.locator(`${TOY} [data-chord-targets]`)).toBeHidden()
    await expectTargets(page, 'Step 5 spread')
  })
})

// WEB-SPEC, End to end 3, at a phone's size and a desktop's
for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Step 5's predict at ${viewport.width} x ${viewport.height}`, () => {
    test.use({ viewport })

    test('Major · Minor is disabled until the choice and stays enabled after the viewer leaves and comes back; the reveal waits until both scales have been heard', async ({
      page,
    }) => {
      test.setTimeout(90_000)
      // Arrange: sound on at the page's top, then Step 5 from the address
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto('/learn/10')
      const sound = page.locator('#soundSwitch')
      await sound.click()
      await expect(sound).toHaveAttribute('aria-pressed', 'true')
      const go = async (n: number): Promise<void> => {
        await page.evaluate((step) => {
          window.location.hash = `#step-${step}`
        }, n)
        await expect(page.locator('#stepNow')).toHaveText(String(n))
        await expect.poll(() => still(page)).toBe(true)
      }
      await go(5)
      const qualities = page.locator(`${TOY} [data-scale-quality] button`)
      const [major, minor] = ['major', 'minor'].map((qy) =>
        page.locator(`#predictScale [data-play="scale-${qy}"]`),
      )
      const reveal = page.locator('#predictScale .reveal')
      const notice = page.locator('#step-5 .notice[data-scale-reveal]')
      const hint = page.locator('#predictScale .lock-hint')
      /** Plays `b` and waits for it to finish. */
      const playThrough = async (b: Locator): Promise<void> => {
        await b.click()
        await expect(b).toHaveClass(/\bis-on\b/)
        await expect(b).not.toHaveClass(/\bis-on\b/, { timeout: 15_000 })
      }

      // Act, Assert: disabled until the choice, enabled after it
      for (const b of await qualities.all()) await expect(b).toBeDisabled()
      await page.locator('#predictScale [data-choice="three"]').click()
      for (const b of await qualities.all()) await expect(b).toBeEnabled()

      // and still enabled after the viewer leaves the step and comes back
      await go(4)
      await go(5)
      for (const b of await qualities.all()) await expect(b).toBeEnabled()

      // C major heard to its end leaves the reveal hidden
      await playThrough(major)
      await expect(hint).toHaveText('Now play the other one.')
      await expect(reveal).toBeHidden()
      await expect(notice).toBeHidden()

      // C minor heard to its end brings it, with the Notice
      await playThrough(minor)
      await expect(reveal).toBeVisible()
      await expect(reveal.locator('.mono')).toHaveText('You said: three')
      await expect(notice).toBeVisible()
      await expect(hint).toHaveText(
        'Play them again, or switch the names to do-re-mi.',
      )
      expect(errors).toEqual([])
    })
  })
}
