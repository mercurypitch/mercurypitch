// ============================================================
// Store shots — eight raw app screens, reached the way a person reaches them
// ============================================================
//
// Each test seeds a device (fixtures.ts), walks to its screen with real
// clicks, proves the screen is the right one and clean, then writes one
// full-viewport PNG flattened to RGB. How to run it: the header of
// ../playwright.shots.config.ts.

import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test as base } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ShotOptions } from '../playwright.shots.config'
import { readPngFacts } from './contact-sheet'
import { LIVED_IN_PLAN, livedInWeek, livedInWeekTotals, onboardingSeenNoPlan, seedDevice, SHOT_NOW, } from './fixtures'

/** Every face main.tsx ships; each must be loaded before a capture. */
const FONT_FACES = [
  '400 1em Coiny',
  '400 1em "Gabarito Variable"',
  '600 1em "Saira Condensed"',
  '700 1em "Saira Condensed"',
]

const test = base.extend<ShotOptions>({
  shotDir: ['', { option: true }],
  page: async ({ page }, use) => {
    // The fictional calendar is fixed; browser/media clocks otherwise run normally.
    await page.clock.setFixedTime(new Date(SHOT_NOW))
    await use(page)
  },
})

/** Fonts loaded and every on-screen image decoded. */
async function settle(page: Page): Promise<void> {
  const missingFonts = await page.evaluate(async (faces) => {
    const loaded = await Promise.all(
      faces.map((face) => document.fonts.load(face)),
    )
    await document.fonts.ready
    return faces.filter((_, index) => loaded[index].length === 0)
  }, FONT_FACES)
  expect(missingFonts, 'app fonts that never loaded').toEqual([])

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.images]
            .filter((image) => {
              const box = image.getBoundingClientRect()
              const onScreen =
                box.width > 0 &&
                box.height > 0 &&
                box.bottom > 0 &&
                box.right > 0 &&
                box.top < window.innerHeight &&
                box.left < window.innerWidth
              return onScreen && (!image.complete || image.naturalWidth === 0)
            })
            .map((image) => image.currentSrc || image.src),
        ),
      { message: 'every on-screen image has decoded', timeout: 20_000 },
    )
    .toEqual([])
  await page.evaluate(() =>
    Promise.all(
      [...document.images]
        .filter((image) => image.complete && image.naturalWidth > 0)
        .map((image) => image.decode().catch(() => undefined)),
    ),
  )
}

/** No build identity, no error or unsupported banner, no mock-store copy. */
async function expectCleanFrame(page: Page): Promise<void> {
  await expect(page.locator('.build-stamp')).toBeHidden()
  await expect(page.locator('.storage-alert')).toHaveCount(0)
  await expect(page.locator('[role="alert"]:visible')).toHaveCount(0)
  const visibleText = await page.evaluate(() => {
    const text: string[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    )
    while (walker.nextNode()) {
      const node = walker.currentNode
      const range = document.createRange()
      range.selectNodeContents(node)
      const box = range.getBoundingClientRect()
      if (
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.top < innerHeight &&
        box.right > 0 &&
        box.left < innerWidth
      )
        text.push(node.textContent ?? '')
    }
    return text.join(' ')
  })
  for (const forbidden of [
    // "Daily reminders are not available on this device." never shows on
    // these screens: restoring a saved reminder on the web platform skips the
    // permission check (src/scheduling/daily-cue-coordinator.ts), so there is
    // nothing to hide. The guard keeps it that way.
    /not available on this device/iu,
    /unsupported/iu,
    /need the Android or iOS app/iu,
    /Beta purchase testing/iu,
    /\b(?:dev|ci) · \d+\.\d+\.\d+/u,
  ]) {
    expect(visibleText, `visible text must not match ${forbidden}`).not.toMatch(
      forbidden,
    )
  }
}

async function capture(
  page: Page,
  info: TestInfo,
  shotDir: string,
  name: string,
  landmark: Locator,
  reducedMotion = true,
): Promise<void> {
  expect(
    await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    'the documented motion preference is active',
  ).toBe(reducedMotion)
  await expect(landmark).toBeVisible()
  await settle(page)
  await expectCleanFrame(page)
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide' })
  await expect(landmark, 'the screen held still for the capture').toBeVisible()

  const folder = join(shotDir, info.project.name)
  mkdirSync(folder, { recursive: true })
  const file = join(folder, `${name}.png`)
  // Chromium writes RGBA; the stores want no alpha. PNG24 is 8-bit RGB, and
  // without ImageMagick's date chunks the same pixels give the same bytes.
  execFileSync(
    'magick',
    [
      'png:-',
      '-background',
      'white',
      '-alpha',
      'remove',
      '-alpha',
      'off',
      '-strip',
      '-define',
      'png:exclude-chunks=date,time',
      `PNG24:${file}`,
    ],
    { input: png },
  )

  const viewport = page.viewportSize()
  if (viewport === null) throw new Error('The shot projects set a viewport.')
  const scale = info.project.use.deviceScaleFactor ?? 1
  expect(readPngFacts(file), file).toEqual({
    width: viewport.width * scale,
    height: viewport.height * scale,
    bitDepth: 8,
    colorType: 2,
    hasTransparency: false,
  })
  console.log(
    `ok  ${info.project.name}/${name}.png  ${viewport.width * scale}x${viewport.height * scale}`,
  )
}

async function openHome(page: Page, path = '/'): Promise<void> {
  await seedDevice(page, livedInWeek(), path)
  await expect(page.getByRole('button', { name: /^Cue me now/u })).toBeVisible()
  await expect(
    page.getByText(LIVED_IN_PLAN.pullText, { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /B-side games/u })).toHaveCount(
    0,
  )
}

async function openPullPicker(page: Page): Promise<Locator> {
  await seedDevice(page, onboardingSeenNoPlan())
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Keep your better choice beside the moment.',
    }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Set up my first plan' }).click()
  const heading = page.getByRole('heading', {
    level: 1,
    name: 'Choose your Pull',
  })
  await expect(heading).toBeVisible()
  return heading
}

async function openSettings(page: Page): Promise<void> {
  await openHome(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Keep only what helps.' }),
  ).toBeVisible()
}

test('01-home', async ({ page, shotDir }, info) => {
  await openHome(page)
  await capture(
    page,
    info,
    shotDir,
    '01-home',
    page.getByRole('button', { name: /^Cue me now/u }),
  )
})

test('02-cue-moment', async ({ page, shotDir }, info) => {
  await openHome(page)
  await page.getByRole('button', { name: /^Cue me now/u }).click()
  await expect(page.locator('main.cue-moment')).toBeVisible()
  await capture(
    page,
    info,
    shotDir,
    '02-cue-moment',
    page.getByRole('heading', { level: 1, name: LIVED_IN_PLAN.bSideText }),
  )
})

test('03-choose-pull', async ({ page, shotDir }, info) => {
  const heading = await openPullPicker(page)
  await capture(page, info, shotDir, '03-choose-pull', heading)
})

test('04-choose-b-side', async ({ page, shotDir }, info) => {
  await openPullPicker(page)
  await page.getByText(LIVED_IN_PLAN.pullLabel, { exact: true }).click()
  await page
    .getByRole('button', { name: `Confirm ${LIVED_IN_PLAN.pullLabel}` })
    .click()
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'When does this Pull usually show up?',
    }),
  ).toBeVisible()
  await page.getByText(LIVED_IN_PLAN.cueContextText, { exact: true }).click()
  await page.getByRole('button', { name: 'Choose Side B' }).click()
  const heading = page.getByRole('heading', {
    level: 1,
    name: 'What small action would you rather begin?',
  })
  await expect(heading).toBeVisible()
  const choice = page.getByRole('radio', { name: LIVED_IN_PLAN.bSideText })
  await choice.click()
  await expect(choice).toHaveAttribute('aria-checked', 'true')
  await page.evaluate(() => window.scrollTo(0, 0))
  await capture(page, info, shotDir, '04-choose-b-side', heading)
})

test('05-reflection', async ({ page, shotDir }, info) => {
  await openHome(page)
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Reflection' })
    .click()
  const heading = page.getByRole('heading', {
    level: 1,
    name: 'Small turns leave a trace.',
  })
  await expect(heading).toBeVisible()
  const totals = livedInWeekTotals()
  await expect(
    page
      .getByRole('region', { name: 'Side B choice totals' })
      .locator('strong'),
  ).toHaveText([String(totals.today), String(totals.week)])
  await capture(page, info, shotDir, '05-reflection', heading)
})

test('06-onboarding-corky', async ({ page, shotDir }, info) => {
  // Capture the current J2 movie, not the reduced-motion poster fallback.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const director = page.locator('main[data-phase]')
  await expect(director).toHaveAttribute('data-phase', 'B00_BEGIN_HOLD')
  await page.getByRole('button', { name: 'Tap to begin' }).click()
  const video = page.locator(
    'video[src*="b01-corky-greeting-j2-direct-to-p02"]',
  )
  await expect(video).toBeVisible()
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(1.1)
  // A real decoded frame at 1.25 s, held for capture. No pixel replacement.
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.pause()
    element.currentTime = 1.25
    await new Promise<void>((resolve) =>
      element.addEventListener('seeked', () => resolve(), { once: true }),
    )
  })
  await expect(director).toHaveAttribute('data-phase', 'B01_CORKY_GREETING')
  await capture(page, info, shotDir, '06-onboarding-corky', video, false)
  await expect(video).toHaveJSProperty('currentTime', 1.25)
})

test('07-settings', async ({ page, shotDir }, info) => {
  await openSettings(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await capture(
    page,
    info,
    shotDir,
    '07-settings',
    page.getByRole('heading', { level: 1, name: 'Keep only what helps.' }),
  )
})

test('08-daily-reminder', async ({ page, shotDir }, info) => {
  await openSettings(page)
  const reminder = page.getByRole('region', {
    name: 'Daily reminder',
    exact: true,
  })
  await reminder.evaluate((section) => {
    const top = section.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, Math.max(0, top - 16))
  })
  await expect(reminder).toContainText(LIVED_IN_PLAN.reminderTime)
  await capture(
    page,
    info,
    shotDir,
    '08-daily-reminder',
    reminder.getByRole('heading', { name: 'Daily reminder', exact: true }),
  )
})
