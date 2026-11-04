// Studio lane headers — one press of Record arms the selected lane and records it on a computer or tablet, an armed phone lane records on one press too, and the lane stays armed until its own arm button disarms it; the arm moves between lanes; role pictures turn into line icons and stay that way on this device; every header fits its controls, with readable text, in both themes.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

// A tablet's lines toggle stays 32 px wide, as it was; under a phone lane's
// name it shares the row with the arm, 44 px each.
const LAYOUTS = [
  {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    touch: false,
    linesWidth: 26,
  },
  {
    name: 'tablet',
    viewport: { width: 1024, height: 768 },
    touch: true,
    linesWidth: 32,
  },
  {
    name: 'phone',
    viewport: { width: 390, height: 844 },
    touch: true,
    linesWidth: 44,
  },
] as const

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]:visible')
}

function armButton(page: Page, lane: string): Locator {
  return studioRegion(page).getByRole('button', {
    name: `Arm ${lane} for recording`,
    exact: true,
  })
}

function laneRow(page: Page, lane: string): Locator {
  return studioRegion(page).locator('[data-studio-track]', {
    has: page.getByRole('button', { name: `${lane} details`, exact: true }),
  })
}

/** Switch the theme and wait out the header's background ease, so its colours are read as they land. */
async function setTheme(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.evaluate(async (value) => {
    document.documentElement.setAttribute('data-theme', value)
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => undefined)),
    )
  }, theme)
}

interface HeaderReading {
  readonly lane: string
  readonly outside: readonly string[]
  readonly small: readonly string[]
  readonly nameContrast: number
  readonly sourceContrast: number | null
  readonly picture: boolean
}

/**
 * Each lane header: what pokes out of it, touch targets under 44 px (the
 * lines toggle under `linesWidth` wide), and its text's contrast.
 */
async function readHeaders(
  page: Page,
  touch: boolean,
  linesWidth = 44,
): Promise<HeaderReading[]> {
  return page.evaluate(
    ([touchLayout, linesWide]) => {
      const channels = (color: string): number[] => {
        const srgb = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(color)
        if (srgb) return [srgb[1], srgb[2], srgb[3]].map((v) => Number(v) * 255)
        const rgb = /rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)/.exec(color)
        return rgb ? [rgb[1], rgb[2], rgb[3]].map(Number) : [Number.NaN]
      }
      const luminance = (color: string) => {
        const [r, g, b] = channels(color).map((v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const contrast = (a: string, b: string) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
        return (hi + 0.05) / (lo + 0.05)
      }
      return [
        ...document.querySelectorAll<HTMLElement>('[data-studio-track]'),
      ].map((lane) => {
        const header = lane.firstElementChild as HTMLElement
        const box = header.getBoundingClientRect()
        const ground = getComputedStyle(header).backgroundColor
        const name = header.querySelector<HTMLElement>(
          '[data-studio-track-header]',
        )!
        const [text, source] = [...name.children] as HTMLElement[]
        const outside = [...header.querySelectorAll<HTMLElement>('*')]
          .filter((element) => {
            const at = element.getBoundingClientRect()
            return (
              at.width > 0 &&
              (at.left < box.left - 0.5 ||
                at.right > box.right + 0.5 ||
                at.top < box.top - 0.5 ||
                at.bottom > box.bottom + 0.5)
            )
          })
          .map(
            (element) => element.getAttribute('aria-label') ?? element.tagName,
          )
        const small = touchLayout
          ? [...header.querySelectorAll<HTMLElement>('button')]
              .filter((button) => {
                const at = button.getBoundingClientRect()
                const wide = button.hasAttribute('data-studio-lines-toggle')
                  ? linesWide
                  : 44
                return at.height < 44 || at.width < wide
              })
              .map((button) => button.getAttribute('aria-label') ?? '')
          : []
        const picture = header.querySelector<HTMLImageElement>(
          '[data-studio-role-plate] img',
        )
        return {
          lane: text.textContent ?? '',
          outside,
          small,
          nameContrast: contrast(getComputedStyle(text).color, ground),
          sourceContrast: source
            ? contrast(getComputedStyle(source).color, ground)
            : null,
          picture:
            picture !== null &&
            picture.complete &&
            picture.naturalWidth === 128,
        }
      })
    },
    [touch, linesWidth] as const,
  )
}

for (const layout of LAYOUTS) {
  test.describe(`Studio lane headers on ${layout.name}`, () => {
    test.use({
      viewport: layout.viewport,
      hasTouch: layout.touch,
      isMobile: layout.touch,
    })

    // A phone has no New lane button and no room to select an empty lane:
    // its second lane is a file, armed from its header before Record.
    const phone = layout.name === 'phone'
    const lane = phone ? 'Bass' : 'Lane 2'

    test('fit their controls in both themes, and one press of Record records on the selected or armed lane until the lane’s arm button disarms it', async ({
      page,
    }) => {
      test.setTimeout(150_000)
      await captureStudioOutput(page)
      await openArrangement(page)
      const studio = studioRegion(page)
      if (phone) await importStudioAudio(page, 'Bass', 2)
      else
        await studio
          .getByRole('button', { name: 'New lane', exact: true })
          .click()

      for (const theme of ['dark', 'light'] as const) {
        await setTheme(page, theme)
        const headers = await readHeaders(page, layout.touch, layout.linesWidth)
        expect(headers.map((header) => header.lane)).toEqual(['Phrase', lane])
        for (const header of headers) {
          expect(header.outside, `${theme} ${header.lane}`).toEqual([])
          expect(header.small, `${theme} ${header.lane}`).toEqual([])
          expect(
            header.nameContrast,
            `${theme} ${header.lane} name`,
          ).toBeGreaterThanOrEqual(4.5)
          if (header.sourceContrast !== null)
            expect(
              header.sourceContrast,
              `${theme} ${header.lane} source`,
            ).toBeGreaterThanOrEqual(4.5)
        }
        // The phone's header has no room for the plate; its Mix sheet has.
        if (layout.name !== 'phone')
          await expect
            .poll(async () =>
              (await readHeaders(page, layout.touch)).every(
                (header) => header.picture,
              ),
            )
            .toBe(true)
      }

      const record = recordButton(page)
      await expect(record).toHaveAttribute('data-phase', 'idle')
      if (phone) {
        await armButton(page, lane).click()
        await expect(record).toHaveAttribute('data-phase', 'armed', {
          timeout: 15_000,
        })
      }
      // One press: on a computer it arms the selected lane first; then it
      // counts in and records.
      await record.click()
      await expect(record).toHaveAttribute('data-phase', 'recording', {
        timeout: 15_000,
      })
      await expect(laneRow(page, lane)).toHaveAttribute('data-armed', '')
      await expect(armButton(page, lane)).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await untilAudioClock(page, (await audioClock(page)) + 1)
      await record.click()

      // The take is kept, and the lane stays armed for the next.
      await expect(record).toHaveAttribute('data-phase', 'armed', {
        timeout: 30_000,
      })
      await expect(
        studio.getByText('Saved in this browser', { exact: true }),
      ).toBeVisible({ timeout: 30_000 })
      const song = await readStudioProject(page)
      // On the phone the Bass clip is under the playhead, so the take gets a
      // lane of its own (imports.ts) and Bass stays armed.
      expect(song.clips).toHaveLength(phone ? 3 : 2)
      if (!phone) {
        const armed = song.tracks.find((track) => track.name === lane)!
        expect(
          song.clips.filter((clip) => clip.trackId === armed.id),
        ).toHaveLength(1)
      }
      await expect(laneRow(page, lane)).toHaveAttribute('data-armed', '')

      await armButton(page, lane).click()
      await expect(record).toHaveAttribute('data-phase', 'idle')
      await expect(laneRow(page, lane)).not.toHaveAttribute('data-armed', '')
    })
  })
}

test.describe('Studio lane arming', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('moves the arm to the lane pressed, starts on the armed lane with R whatever is selected, and Escape disarms', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    const record = recordButton(page)

    await armButton(page, 'Phrase').click()
    await expect(
      studio.getByText('Armed on Phrase. Press Record to start.'),
    ).toBeVisible({ timeout: 15_000 })
    await armButton(page, 'Lane 2').click()
    await expect(
      studio.getByText('Armed on Lane 2. Press Record to start.'),
    ).toBeVisible()
    await expect(armButton(page, 'Phrase')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(laneRow(page, 'Phrase')).not.toHaveAttribute('data-armed', '')
    await expect(laneRow(page, 'Lane 2')).toHaveAttribute('data-armed', '')

    // Selecting another lane leaves the arm where it is; R starts there.
    await studio
      .getByRole('button', { name: 'Phrase details', exact: true })
      .click()
    await page.keyboard.press('Escape')
    await expect(armButton(page, 'Lane 2')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.keyboard.press('r')
    await expect(
      studio.locator('[data-studio-record-status="recording"]'),
    ).toContainText('Recording on Lane 2', { timeout: 15_000 })
    // A take holds every arm button.
    await expect(armButton(page, 'Phrase')).toBeDisabled()
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await page.keyboard.press('r')
    await expect(record).toHaveAttribute('data-phase', 'armed', {
      timeout: 30_000,
    })

    await page.keyboard.press('Escape')
    await expect(record).toHaveAttribute('data-phase', 'idle')
    await expect(armButton(page, 'Lane 2')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('role pictures turn into line icons from Track details and stay off after a reload', async ({
    page,
  }) => {
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio
      .getByRole('button', { name: 'Phrase details', exact: true })
      .click()
    await studio
      .getByRole('combobox', { name: 'Sound role' })
      .selectOption('acoustic-guitar')
    const plate = studio.getByRole('img', {
      name: 'Acoustic guitar',
      exact: true,
    })
    await expect(plate.locator('img')).toHaveAttribute(
      'src',
      '/studio/roles/acoustic-guitar.webp',
    )

    const pictures = studio.getByRole('checkbox', { name: 'Role pictures' })
    await expect(pictures).toBeChecked()
    await pictures.uncheck()
    await expect(plate.locator('img')).toHaveCount(0)
    await expect(plate.locator('svg')).toHaveCount(1)

    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
    await page.reload()
    await studio.getByRole('button', { name: /^Untitled song/ }).click()
    const reloaded = studio.getByRole('img', {
      name: 'Acoustic guitar',
      exact: true,
    })
    await expect(reloaded.locator('svg')).toHaveCount(1)
    await expect(reloaded.locator('img')).toHaveCount(0)
  })
})

test.describe('Studio lane lines on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('open while a lane is armed, in the record card’s place, and Record closes them and starts the take', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await importStudioAudio(page, 'Bass', 2)
    const record = recordButton(page)
    await armButton(page, 'Bass').click()
    await expect(record).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const card = studio.locator('[data-studio-record-status]')
    await expect(card).toHaveAttribute('data-studio-record-status', 'armed')

    const lines = studio.getByRole('button', {
      name: 'Bass volume and pan lines',
      exact: true,
    })
    const bar = studio.getByRole('toolbar', { name: 'Bass lines' })
    await expect(lines).toBeEnabled()
    await lines.click()
    await expect(bar).toBeVisible()
    await expect(card).toHaveCount(0)

    await record.click()
    await expect(record).toHaveAttribute('data-phase', 'recording', {
      timeout: 15_000,
    })
    await expect(bar).toHaveCount(0)
    await expect(card).toHaveAttribute('data-studio-record-status', 'recording')
    await expect(lines).toBeDisabled()
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await record.click()

    // The take is kept and the lane stays armed; its lines stay closed.
    await expect(record).toHaveAttribute('data-phase', 'armed', {
      timeout: 30_000,
    })
    await expect(card).toHaveAttribute('data-studio-record-status', 'armed')
    await expect(lines).toHaveAttribute('aria-pressed', 'false')
    await expect(lines).toBeEnabled()
  })
})
