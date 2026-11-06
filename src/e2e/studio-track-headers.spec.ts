// Studio lane headers — one press of Record arms the selected lane and records it on a computer or tablet, a phone lane armed from its details records on one press too, and the lane stays armed until its own arm button disarms it; the arm moves between lanes; a lane's instrument is picked in its details apart from its role and kept; every compact header fits its controls, with readable text and an instrument chip, in both themes.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { audioClock, captureStudioOutput, untilAudioClock, } from './helpers/studio-output-capture'
import { fakeMicArgs, TONE_HZ, writeToneWav } from './helpers/tone-wav'

const TONE_WAV = writeToneWav(TONE_HZ, 20)

test.use({
  launchOptions: { args: fakeMicArgs(TONE_WAV) },
  permissions: ['microphone'],
})

// Compact lanes: a header's instrument chip, its name and its arm, Mute and
// Solo; a phone's, the glyph and the name, its arm and lines in its details.
// A header stands its lane's row less the row's 1 px rule: 64, 96 and at
// least 56 px rows.
const LAYOUTS = [
  {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    touch: false,
    header: { width: 240, height: 63 },
  },
  {
    name: 'tablet',
    viewport: { width: 1024, height: 768 },
    touch: true,
    header: { width: 224, height: 95 },
  },
  {
    name: 'phone',
    viewport: { width: 390, height: 844 },
    touch: true,
    header: { width: 88, height: 55 },
  },
] as const

function recordButton(page: Page): Locator {
  return studioRegion(page).locator('[data-studio-record]:visible')
}

/** A phone lane's arm is in its details: open them first. */
async function openLaneDetails(page: Page, lane: string): Promise<void> {
  await studioRegion(page)
    .getByRole('button', { name: `${lane} details`, exact: true })
    .click()
  await expect(
    studioRegion(page).getByRole('combobox', { name: 'Sound role' }),
  ).toBeVisible()
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

/** The px between the lane name's keyboard focus ring and its arm button. */
async function focusRingClearance(page: Page, lane: string): Promise<number> {
  // Shift+Tab from the arm button: focus arrives by keyboard, so the ring shows.
  await armButton(page, lane).focus()
  await page.keyboard.press('Shift+Tab')
  const name = studioRegion(page).getByRole('button', {
    name: `${lane} details`,
    exact: true,
  })
  await expect(name).toBeFocused()
  const arm = (await armButton(page, lane).boundingBox())!
  return name.evaluate((element, armBox) => {
    const style = getComputedStyle(element)
    const reach =
      Number.parseFloat(style.outlineOffset) +
      Number.parseFloat(style.outlineWidth)
    const box = element.getBoundingClientRect()
    const ring = {
      left: box.left - reach,
      right: box.right + reach,
      top: box.top - reach,
      bottom: box.bottom + reach,
    }
    return Math.max(
      armBox.x - ring.right,
      ring.left - (armBox.x + armBox.width),
      armBox.y - ring.bottom,
      ring.top - (armBox.y + armBox.height),
    )
  }, arm)
}

interface HeaderReading {
  readonly lane: string
  readonly outside: readonly string[]
  readonly small: readonly string[]
  readonly nameContrast: number
  readonly sourceContrast: number | null
  readonly chip: boolean
  readonly clipped: boolean
  readonly size: readonly [number, number]
}

/**
 * Each lane header: what pokes out of it, touch targets under 44 px, its
 * text's contrast, its instrument chip, whether its name runs out sideways,
 * and its size.
 */
async function readHeaders(
  page: Page,
  touch: boolean,
): Promise<HeaderReading[]> {
  return page.evaluate((touchLayout) => {
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
      const text = header.querySelector<HTMLElement>(
        '[data-studio-track-name]',
      )!
      const source = header.querySelector<HTMLElement>(
        '[data-studio-track-source]',
      )
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
        .map((element) => element.getAttribute('aria-label') ?? element.tagName)
      const small = touchLayout
        ? [...header.querySelectorAll<HTMLElement>('button')]
            .filter((button) => {
              const at = button.getBoundingClientRect()
              return at.height < 44 || at.width < 44
            })
            .map((button) => button.getAttribute('aria-label') ?? '')
        : []
      const chip = header.querySelector('[data-instrument-chip] svg')
      return {
        lane: text.textContent ?? '',
        outside,
        small,
        nameContrast: contrast(getComputedStyle(text).color, ground),
        sourceContrast: source
          ? contrast(getComputedStyle(source).color, ground)
          : null,
        chip: chip !== null && chip.getBoundingClientRect().width > 0,
        clipped: text.scrollWidth > text.clientWidth + 1,
        size: [Math.round(box.width), Math.round(box.height)] as const,
      }
    })
  }, touch)
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
        const headers = await readHeaders(page, layout.touch)
        expect(headers.map((header) => header.lane)).toEqual(['Phrase', lane])
        for (const header of headers) {
          expect(header.outside, `${theme} ${header.lane}`).toEqual([])
          expect(header.small, `${theme} ${header.lane}`).toEqual([])
          expect(header.chip, `${theme} ${header.lane} chip`).toBe(true)
          expect(header.clipped, `${theme} ${header.lane} name`).toBe(false)
          expect(header.size[0]).toBe(layout.header.width)
          expect(header.size[1]).toBeGreaterThanOrEqual(layout.header.height)
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
      }

      // A keyboard focus ring on the name stays clear of the arm beside it.
      if (!phone)
        expect(await focusRingClearance(page, 'Phrase')).toBeGreaterThanOrEqual(
          4,
        )

      const record = recordButton(page)
      await expect(record).toHaveAttribute('data-phase', 'idle')
      if (phone) {
        await openLaneDetails(page, lane)
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
      if (!phone)
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

      if (phone && !(await armButton(page, lane).isVisible()))
        await openLaneDetails(page, lane)
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

  test('picks a lane’s instrument in its details, apart from its role, and keeps it after a reload', async ({
    page,
  }) => {
    await openArrangement(page)
    const studio = studioRegion(page)
    // An uploaded file nothing describes is plain audio.
    await expect(
      studio.getByRole('img', { name: 'Audio', exact: true }),
    ).toBeVisible()
    await studio
      .getByRole('button', { name: 'Phrase details', exact: true })
      .click()

    await studio.getByRole('button', { name: /^Instrument/ }).click()
    await studio
      .getByRole('searchbox', { name: 'Find an instrument' })
      .fill('trum')
    await studio.getByRole('button', { name: 'Trumpet', exact: true }).click()

    await expect(
      studio.getByRole('img', { name: 'Trumpet', exact: true }),
    ).toBeVisible()
    await expect(
      studio.getByRole('combobox', { name: 'Sound role' }),
    ).toHaveValue('other')
    await expect(
      studio.getByText('Saved in this browser', { exact: true }),
    ).toBeVisible()
    const song = await readStudioProject(page)
    expect(song.tracks[0]).toMatchObject({
      role: 'other',
      instrument: 'trumpet',
    })

    await page.reload()
    await studio.getByRole('button', { name: /^Untitled song/ }).click()
    await expect(
      studio.getByRole('img', { name: 'Trumpet', exact: true }),
    ).toBeVisible()
  })
})

test.describe('Studio lane lines on a phone', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })

  test('open from an armed lane’s details, in the record card’s place, and Record closes them and starts the take', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await captureStudioOutput(page)
    await openArrangement(page)
    const studio = studioRegion(page)
    await importStudioAudio(page, 'Bass', 2)
    const record = recordButton(page)
    await openLaneDetails(page, 'Bass')
    await armButton(page, 'Bass').click()
    await expect(record).toHaveAttribute('data-phase', 'armed', {
      timeout: 15_000,
    })
    const card = studio.locator('[data-studio-record-status]')
    await expect(card).toHaveAttribute('data-studio-record-status', 'armed')

    // The details sheet steps aside for the lines it opens.
    const lines = studio.getByRole('button', {
      name: 'Volume and pan lines',
      exact: true,
    })
    const bar = studio.getByRole('toolbar', { name: 'Bass lines' })
    await expect(lines).toBeEnabled()
    await lines.click()
    await expect(bar).toBeVisible()
    await expect(lines).toHaveCount(0)
    await expect(card).toHaveCount(0)

    await record.click()
    await expect(record).toHaveAttribute('data-phase', 'recording', {
      timeout: 15_000,
    })
    await expect(bar).toHaveCount(0)
    await expect(card).toHaveAttribute('data-studio-record-status', 'recording')
    await openLaneDetails(page, 'Bass')
    await expect(lines).toBeDisabled()
    await untilAudioClock(page, (await audioClock(page)) + 1)
    await record.click()

    // The take is kept and the lane stays armed; its lines can open again.
    await expect(record).toHaveAttribute('data-phase', 'armed', {
      timeout: 30_000,
    })
    await expect(card).toHaveAttribute('data-studio-record-status', 'armed')
    await expect(bar).toHaveCount(0)
    await expect(lines).toBeEnabled()
  })
})
