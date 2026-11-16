// ============================================================
// Hear it first: Merc plays a drill's example before the singer tries
// ============================================================
//
// The shell's part (the button, Merc's line, giving way to a run) and each
// drill's example are unit-tested. A browser shows the rest: the button sits
// under Start where a thumb finds it, the example runs its length on the
// real clock and hands the bubble back to the brief, and a drill left
// while it plays is left cleanly.

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { dismissOverlays, openNavTab, waitForNav } from './helpers/ui'

async function openDrill(page: Page, title: string): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_advanced_features', 'true')
  })
  await page.goto('/')
  await waitForNav(page)
  await dismissOverlays(page)
  await openNavTab(page, 'tab-exercises')
  await page.locator('.exercise-card', { hasText: title }).first().click()
  await expect(page.locator('.exercise-idle-start')).toBeVisible({
    timeout: 10000,
  })
}

const NOTE = '[A-G]#?\\d'

/** The other drills with an example: the card's title, and what Merc says. */
const EXAMPLES: readonly { title: string; says: RegExp }[] = [
  {
    title: 'Arpeggio Jumper',
    says: new RegExp(`^Listen: the Major arpeggio, up from ${NOTE}\\.$`),
  },
  {
    title: 'Chord Stacker',
    says: new RegExp(`^Listen: a major seventh chord, up from ${NOTE}\\.$`),
  },
  {
    title: 'Staccato Precision',
    says: new RegExp(`^Listen: three short notes, up from ${NOTE}\\.$`),
  },
  {
    title: 'Drone Intonation',
    says: new RegExp(
      `^Listen: the drone, ${NOTE}, then ${NOTE} above it \\(Perfect 5th\\)\\.$`,
    ),
  },
  {
    title: 'Siren / Range Explorer',
    says: new RegExp(
      `^Listen: ${NOTE}, then ${NOTE}\\. Your voice glides between them\\.$`,
    ),
  },
  {
    title: 'Slide In/Out',
    says: new RegExp(
      `^Listen: ${NOTE}, then ${NOTE}\\. You slide from one to the other\\.$`,
    ),
  },
  {
    title: 'Dynamic Swell',
    says: new RegExp(
      `^Listen: ${NOTE}, the note to hold\\. The swell is yours\\.$`,
    ),
  },
  {
    title: 'Name the Cadence',
    says: /^Listen: home, then V to I\. A perfect cadence: it comes home\.$/,
  },
  {
    title: 'Call & Response',
    says: /^Listen: a short phrase\. In a run you sing one back\.$/,
  },
  {
    // The line itself is never played: do, and the key's triad from it.
    title: 'Sight-Singing',
    says: /^Listen: do, then do, mi, so, mi, do, in C major\.$/,
  },
]

test.describe('Hear it first', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("plays Interval Trainer's example under its name, then gives the bubble back", async ({
    page,
  }) => {
    await openDrill(page, 'Interval Trainer')
    const button = page.getByRole('button', { name: 'Hear it first' })
    await expect(button).toBeVisible()

    // Under Start, a thumb wide and tall, inside the sheet.
    const [start, demo] = await Promise.all(
      [page.locator('.exercise-idle-start'), button].map((el) =>
        el.evaluate((node) => {
          const r = node.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, height: r.height }
        }),
      ),
    )
    expect(demo.top).toBeGreaterThanOrEqual(start.bottom)
    expect(demo.height).toBeGreaterThanOrEqual(44)

    const sheetTop = () =>
      page
        .locator('.exercise-canvas-area')
        .evaluate((sheet) => sheet.getBoundingClientRect().top)
    const before = await sheetTop()

    await button.click()
    const line = page.locator('.exercise-stage-demo-line')
    await expect(line).toHaveText(
      /^Listen: [A-G]#?\d, then [A-G]#?\d\. That is a Perfect 5th\.$/,
    )
    // The brief keeps its place under the line, unseen, so the bubble keeps
    // its size and the sheet (and the button just pressed) stay where they
    // were.
    await expect(page.locator('.idle-hint')).toBeHidden()
    expect(await sheetTop()).toBeCloseTo(before, 0)

    // Two notes and the gap between them: under three seconds.
    await expect(line).toHaveCount(0, { timeout: 6000 })
    await expect(page.locator('.idle-hint')).toHaveText(
      '6 rounds · Major 2nd through Octave',
    )
    expect(await sheetTop()).toBeCloseTo(before, 0)
    await expect(button).toBeEnabled()
  })

  // A run needs a microphone, which this suite's browser does not have, so
  // "the example gives way to a run" is the shell's unit test
  // (ExerciseShell.stage.test.tsx). What a browser can show is the other way
  // out: leaving the drill while the example plays.
  test("plays Scale Runner's scale under its name, and leaving the drill cuts it short", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openDrill(page, 'Scale Runner')
    await page.getByRole('button', { name: 'Hear it first' }).click()
    await expect(page.locator('.exercise-stage-demo-line')).toHaveText(
      /^Listen: the Major scale, up from [A-G]#?\d\.$/,
    )

    // Eight notes take about four seconds; Back does not wait for them.
    await page.locator('.back-btn').click()
    await expect(page.locator('.exercise-card').first()).toBeVisible({
      timeout: 10000,
    })

    // Back in, the drill opens on its brief with the example ready again.
    await page
      .locator('.exercise-card', { hasText: 'Scale Runner' })
      .first()
      .click()
    await expect(page.locator('.idle-hint')).toHaveText('8 notes · Major · up')
    await expect(page.locator('.exercise-stage-demo-line')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Hear it first' }),
    ).toBeEnabled()
    expect(errors).toEqual([])
  })

  // Name the Cadence's brief is four lines on a phone and its example's
  // line two: the bubble used to shrink by 59px, and the sheet came up with
  // it, for as long as the example played.
  test("holds the sheet still under Name the Cadence's example", async ({
    page,
  }) => {
    await openDrill(page, 'Name the Cadence')
    const button = page.getByRole('button', { name: 'Hear it first' })
    const places = () =>
      page.evaluate(() => {
        const top = (selector: string) =>
          document.querySelector(selector)?.getBoundingClientRect().top ?? -1
        return {
          sheet: top('.exercise-canvas-area'),
          button: top('.exercise-demo-btn'),
        }
      })
    const before = await places()

    await button.click()
    const line = page.locator('.exercise-stage-demo-line')
    await expect(line).toHaveText(
      'Listen: home, then V to I. A perfect cadence: it comes home.',
    )
    const during = await places()
    expect(during.sheet).toBeCloseTo(before.sheet, 0)
    expect(during.button).toBeCloseTo(before.button, 0)

    await expect(line).toHaveCount(0, { timeout: 8000 })
    const after = await places()
    expect(after.sheet).toBeCloseTo(before.sheet, 0)
    expect(after.button).toBeCloseTo(before.button, 0)
  })

  test('has each of the other drills say what its example is', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openDrill(page, EXAMPLES[0]!.title)

    for (const [index, example] of EXAMPLES.entries()) {
      if (index > 0) {
        await page
          .locator('.exercise-card', { hasText: example.title })
          .first()
          .click()
      }
      const button = page.getByRole('button', { name: 'Hear it first' })
      await expect(button, example.title).toBeVisible({ timeout: 10000 })
      await button.click()
      await expect(
        page.locator('.exercise-stage-demo-line'),
        example.title,
      ).toHaveText(example.says)

      // Back cuts the example short; the next drill starts from silence.
      await page.locator('.back-btn').click()
      await expect(page.locator('.exercise-card').first()).toBeVisible({
        timeout: 10000,
      })
    }
    expect(errors).toEqual([])
  })
})
