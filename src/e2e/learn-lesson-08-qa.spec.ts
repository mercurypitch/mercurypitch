// ============================================================
// Lesson 8 page QA — the beat machine by keyboard, Step 5's lock, the take
// ============================================================
//
// WEB-SPEC's end-to-end checks 3, 4, 6, 8 and 14 (Tests), with reduced
// motion emulated so every move lands at once and a key press meets the
// state it changed: Step 5's Play, March, Rock and Tempo stay `disabled`
// until its choice, never `aria-disabled`, while Step 2's Tempo works
// throughout, and its reveal waits for both plays to run to their ends;
// Tab reaches every control and cell of the beat machine, a cell toggles
// `aria-pressed`, Tempo moves by arrows and jumps by Home and End, Bars and
// the pattern switch toggle `aria-pressed`, and each change reaches the
// live region; at 390 x 844 every cell is at least 44 px square with none
// overlapping. The take counts in and walks its two parts' status lines,
// says so when no tap lines up, stops on Stop, and with sound off does not
// start. Under reduced motion the arm holds still and neither Merc nor Tavi hops.
// Nothing asks for the microphone.

import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/** The steps' beat machine, and its live region. */
const TOY = '#toyBeat'
const said = (page: Page): Locator => page.locator(`${TOY} [data-bm-said]`)

async function openStep(page: Page, step: number): Promise<void> {
  await page.goto(`/learn/08#step-${step}`)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

/** Moves the deck on the page already open, as a step link does. */
async function goStep(page: Page, step: number): Promise<void> {
  await page.evaluate((n) => {
    window.location.hash = `#step-${n}`
  }, step)
  await expect(page.locator('#stepNow')).toHaveText(String(step))
}

interface Box {
  readonly name: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

const boxesOf = (loc: Locator): Promise<Box[]> =>
  loc.evaluateAll((els) =>
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

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The focused element's name: its label, else its text. */
const focusedName = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement
    if (el === null || el.closest('#toyBeat') === null) return ''
    return (el.getAttribute('aria-label') ?? el.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
  })

/** Counts every ask for the microphone. */
async function spyOnMicrophone(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const w = window as unknown as { micAsks: number }
    w.micAsks = 0
    const media = navigator.mediaDevices as MediaDevices | undefined
    if (media === undefined) return
    const ask = media.getUserMedia.bind(media)
    media.getUserMedia = (constraints) => {
      w.micAsks += 1
      return ask(constraints)
    }
  })
  return () =>
    page.evaluate(() => (window as unknown as { micAsks: number }).micAsks)
}

test.describe('page QA (WEB-SPEC, Tests)', () => {
  test.describe.configure({ timeout: 90_000 })

  // every move lands at once, so a key press meets the state it changed
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test("Step 5's stage controls wait for its choice, disabled and never aria-disabled, while Step 2's Tempo works throughout", async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 2)
    const metro = page.locator('#tempoMetro')

    // Act: Step 2's Tempo, before Step 5's choice
    await metro.focus()
    await page.keyboard.press('ArrowRight')

    // Assert
    await expect(metro).toBeEnabled()
    await expect(metro).toHaveValue('91')
    await expect(metro).toHaveAttribute('aria-valuetext', '91 beats per minute')

    // Act
    await goStep(page, 5)
    const stage = page.locator(`${TOY} [data-step5], #tempoPattern`)

    // Assert: out of the tab order until the choice
    await expect(stage).toHaveCount(4)
    for (const el of await stage.all()) {
      await expect(el).toBeDisabled()
      await expect(el).not.toHaveAttribute('aria-disabled', /.*/)
    }

    // Act
    await page.locator('#predictPattern [data-choice="same"]').click()

    // Assert
    for (const el of await stage.all()) {
      await expect(el).toBeEnabled()
      await expect(el).not.toHaveAttribute('aria-disabled', /.*/)
    }
  })

  test("Step 5's reveal, and all that answers it, waits until both plays have run to their ends", async ({
    page,
  }) => {
    // Arrange
    await openStep(page, 5)
    const predict = page.locator('#predictPattern')
    const answers = page.locator('#step-5 [data-pattern-reveal]')
    await predict.locator('[data-choice="pattern"]').click()
    await expect(predict.locator('.lock-hint')).toHaveText(
      'Locked in. Play both, and watch the grid.',
    )

    // Act: the march, two bars at 90
    await predict.locator('[data-play="march"]').click()

    // Assert
    await expect(predict.locator('.lock-hint')).toHaveText(
      'Now play the other one.',
      { timeout: 20_000 },
    )
    await expect(predict.locator('.reveal')).toBeHidden()
    for (const a of await answers.all()) await expect(a).toBeHidden()

    // Act: the rock beat
    await predict.locator('[data-play="rock"]').click()

    // Assert
    await expect(predict.locator('.reveal')).toBeVisible({ timeout: 20_000 })
    await expect(predict.locator('.reveal')).toContainText(
      "You said: no, still the march's pattern",
    )
    for (const a of await answers.all()) await expect(a).toBeVisible()
  })

  test('the beat machine by keyboard alone: Tab reaches every control and cell, and each change is said', async ({
    page,
  }) => {
    // Arrange: Step 4, the grid
    await openStep(page, 4)
    const want = await page
      .locator(`${TOY} :is(button, input):visible`)
      .evaluateAll((els) =>
        els
          .filter((el) => !(el as HTMLButtonElement).disabled)
          .map((el) =>
            (el.getAttribute('aria-label') ?? el.textContent ?? '')
              .replace(/\s+/g, ' ')
              .trim(),
          ),
      )
    expect(want).toContain('Clap on beat 2')

    // Act: from the first control, Tab through the machine
    await page.locator(`${TOY} :is(button, input):visible`).first().focus()
    const met = [await focusedName(page)]
    for (let i = 0; i < want.length + 2; i++) {
      await page.keyboard.press('Tab')
      met.push(await focusedName(page))
    }

    // Assert
    expect(met).toEqual(expect.arrayContaining(want))

    // Act: a cell, by Space
    const clap2 = page
      .locator(TOY)
      .getByRole('button', { name: 'Clap on beat 2' })
    await expect(clap2).toHaveAttribute('aria-pressed', 'true')
    await clap2.focus()
    await page.keyboard.press('Space')

    // Assert
    await expect(clap2).toHaveAttribute('aria-pressed', 'false')
    await expect(said(page)).toHaveText('Clap on 4')

    // Act: Bars, on Step 3
    await goStep(page, 3)
    const three = page.locator(`${TOY} [data-bars="3"]`)
    await three.focus()
    await page.keyboard.press('Enter')

    // Assert
    await expect(three).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`${TOY} [data-bars="4"]`)).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(said(page)).toHaveText('Bars of 3')

    // Act: Tempo, on Step 2
    await goStep(page, 2)
    const metro = page.locator('#tempoMetro')
    await metro.focus()
    await page.keyboard.press('Home')
    await expect(metro).toHaveValue('60')
    await page.keyboard.press('End')
    await expect(metro).toHaveValue('140')
    await page.keyboard.press('ArrowLeft')

    // Assert
    await expect(metro).toHaveValue('139')
    await expect(metro).toHaveAttribute(
      'aria-valuetext',
      '139 beats per minute',
    )

    // Act: the pattern switch, on Step 5 after its choice
    await goStep(page, 5)
    await page.locator('#predictPattern [data-choice="same"]').click()
    const rock = page.locator(`${TOY} [data-bm-pattern="rock"]`)
    await rock.focus()
    await page.keyboard.press('Enter')

    // Assert
    await expect(rock).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.locator(`${TOY} [data-bm-pattern="march"]`),
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(said(page)).toContainText('Rock at')
  })

  test.describe('at 390 x 844', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    for (const step of [4, 5]) {
      test(`step ${step}'s cells are each at least 44 px square, none overlapping, with no sideways scroll`, async ({
        page,
      }) => {
        await openStep(page, step)
        const cells = await boxesOf(page.locator(`${TOY} .bm-cell:visible`))
        expect(cells.length).toBeGreaterThanOrEqual(12)
        for (const c of cells) {
          expect(c.w, c.name).toBeGreaterThanOrEqual(44)
          expect(c.h, c.name).toBeGreaterThanOrEqual(44)
        }
        cells.forEach((a, i) =>
          cells.forEach((b, j) => {
            if (i < j)
              expect(overlap(a, b), `${a.name} and ${b.name}`).toBe(false)
          }),
        )
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(390)
      })
    }
  })

  test('the take counts in and walks its two parts, says when no tap lined up, and never asks for the microphone', async ({
    page,
  }) => {
    // Arrange
    const asks = await spyOnMicrophone(page)
    await page.goto('/learn/08#sing')
    const status = page.locator('#takeStatus')
    await expect(status).toHaveText("Press Start when you're ready to tap.")

    // Act: a take of one bar counted in, two of the pulse and four of the backbeat, at 90
    await page.locator('[data-take-start]').click()

    // Assert
    await expect(status).toHaveText('Counting in: one bar.')
    await expect(status).toHaveText('Tap every beat: bar 1 of 2', {
      timeout: 5_000,
    })
    await expect(status).toHaveText('Tap every beat: bar 2 of 2', {
      timeout: 5_000,
    })
    await expect(status).toHaveText('Now 2 and 4: bar 1 of 4', {
      timeout: 5_000,
    })
    await expect(status).toHaveText('Now 2 and 4: bar 4 of 4', {
      timeout: 15_000,
    })
    await expect(status).toHaveText(
      "We couldn't line your taps up with the beat that time. Tap every beat for the first two bars, then 2 and 4.",
      { timeout: 10_000 },
    )
    expect(await asks()).toBe(0)
  })

  test('Stop ends the take, and with sound off Start does not start it and says so', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/learn/08#sing')
    const status = page.locator('#takeStatus')
    const start = page.locator('[data-take-start]')
    await start.click()
    await expect(status).toHaveText('Counting in: one bar.')

    // Act
    await start.click()

    // Assert
    await expect(status).toHaveText('Stopped. Press Start to tap again.')

    // Arrange: the switch turns sound off
    await page.locator('#soundSwitch').click()
    await expect(page.locator('#soundSwitch')).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    // Act
    await start.click()

    // Assert
    await expect(status).toHaveText(
      "Sound is off, so the take didn't start. Turn sound on, then press Start.",
    )
  })

  test('under reduced motion the arm holds still while the metronome runs, and neither Merc nor Tavi hops', async ({
    page,
  }) => {
    /** Watches every frame for `ms`: the arm's transforms seen, and the most animations on either Merc. */
    const watch = (ms: number): Promise<{ arm: number; hops: number }> =>
      page.evaluate(
        (span) =>
          new Promise((done) => {
            const arm = document.querySelector('#toyBeat .metro .arm')
            const seen = new Set<string>()
            let hops = 0
            const end = performance.now() + span
            const frame = (): void => {
              if (arm !== null) seen.add(getComputedStyle(arm).transform)
              for (const s of ['#mercBlue', '#mercOrange'])
                hops = Math.max(
                  hops,
                  document.querySelector(s)?.getAnimations().length ?? 0,
                )
              if (performance.now() < end) requestAnimationFrame(frame)
              else done({ arm: seen.size, hops })
            }
            requestAnimationFrame(frame)
          }),
        ms,
      )

    // Arrange
    await openStep(page, 1)
    await expect(page.locator(`${TOY} .metro .arm`)).toBeVisible()

    // Act
    await page.locator(`${TOY} [data-bm-start]:visible`).first().click()
    const metronome = await watch(1500)

    // Assert: one transform the whole time
    expect(metronome.arm).toBe(1)

    // Act: the cold open, whose claps start each hop
    await page.locator('#heroPlay').click()
    const coldOpen = await watch(2400)

    // Assert
    expect(coldOpen.hops).toBe(0)
  })
})
