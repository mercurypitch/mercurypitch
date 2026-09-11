// ============================================================
// Store shots — eight App Store screens, reached the way a person reaches them
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

/** src/purchases/revenuecat-config.ts, PRO_DISPLAY_NAME */
const PRO_NAME = 'BeSideCue Pro'

/** Every face main.tsx ships; each must be loaded before a capture. */
const FONT_FACES = [
  '400 1em Coiny',
  '400 1em "Gabarito Variable"',
  '600 1em "Saira Condensed"',
  '700 1em "Saira Condensed"',
]

const test = base.extend<ShotOptions>({
  shotDir: ['', { option: true }],
  shotCss: ['', { option: true }],
  page: async ({ page, shotCss }, use) => {
    // A fixed calendar keeps Reflection's weekdays and counts the same on
    // every run. install() lets page time flow from SHOT_NOW; 06 pauses it.
    await page.clock.install({ time: new Date(SHOT_NOW) })
    await page.addInitScript((css: string) => {
      const inject = (): void => {
        const style = document.createElement('style')
        style.dataset.storeShots = ''
        style.textContent = css
        document.head.append(style)
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject, { once: true })
      } else {
        inject()
      }
    }, shotCss)
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
  const visibleText = await page.locator('body').innerText()
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
): Promise<void> {
  expect(
    await page.evaluate(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    'reduced motion is emulated',
  ).toBe(true)
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
  await expect(
    page.getByRole('heading', { level: 1, name: 'Your current pressing' }),
  ).toBeVisible()
  // The pressing shows Side A until the record is turned over.
  const plan = page.getByRole('region', { name: 'Your current plan' })
  await expect(plan).toContainText(LIVED_IN_PLAN.pullText)
  await expect(page.getByRole('region', { name: 'Your cue' })).toContainText(
    LIVED_IN_PLAN.cueContextText,
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

// Without a fake store the browser's Pro section says only "Purchases need
// the Android or iOS app." ?mockPurchases gives it the section a phone shows,
// plus two things a store build never shows: the beta-testing note and the
// "Test an offer" row, where iOS has "Redeem App Store code". Hide exactly
// those two; if either text changes, this fails instead of letting it through.
async function hideMockStoreChrome(pro: Locator): Promise<void> {
  for (const mockOnly of [
    pro.getByText(/^Beta purchase testing\./u),
    pro.getByRole('button', { name: /^Test an offer/u }),
  ]) {
    await expect(mockOnly).toHaveCount(1)
    await mockOnly.evaluate((element) =>
      element.style.setProperty('display', 'none', 'important'),
    )
    await expect(mockOnly).toBeHidden()
  }
}

async function openSettings(page: Page): Promise<Locator> {
  await openHome(page, '/?mockPurchases')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Keep only what helps.' }),
  ).toBeVisible()
  const pro = page.getByRole('region', { name: PRO_NAME })
  // Settled on "not Pro": the section has to read as optional support.
  await expect(
    pro.getByRole('button', { name: `Unlock ${PRO_NAME}` }),
  ).toBeVisible()
  await expect(pro.getByText('Active', { exact: true })).toHaveCount(0)
  await hideMockStoreChrome(pro)
  return pro
}

test('01-home', async ({ page, shotDir }, info) => {
  await openHome(page)
  await capture(
    page,
    info,
    shotDir,
    '01-home',
    page.getByRole('heading', { level: 1, name: 'Your current pressing' }),
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
  // No seed: a first launch without an onboarding preference opens V2.
  await page.goto('/')
  const director = page.locator('main[data-phase]')
  await expect(director).toHaveAttribute('data-phase', 'B00_BEGIN_HOLD', {
    timeout: 30_000,
  })
  // The greeting is an automatic beat. Under reduced motion it dwells 650 ms
  // on a setTimeout (REDUCED_AUTOMATIC_DURATION_MS in V2OnboardingDirector),
  // so pause the page clock before starting it: the beat then holds however
  // long the capture takes. Page time is advanced by hand below, well inside
  // that dwell, only so its still (Corky beside the record player) can take
  // over the stage.
  const pageNow = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(pageNow + 1_000)
  await page.getByRole('button', { name: 'Tap to begin' }).click()
  await expect(director).toHaveAttribute('data-phase', 'B01_CORKY_GREETING')

  let advancedMs = 0
  await expect
    .poll(
      async () => {
        if (advancedMs < 400) {
          await page.clock.runFor(50)
          advancedMs += 50
        }
        return page.locator('[data-v2-media-token]').evaluateAll((layers) =>
          layers.map((layer) => {
            const element = layer as HTMLElement
            const image = element.querySelector('img')
            const decoded =
              image !== null && image.complete && image.naturalWidth > 0
            return `${element.dataset.v2MediaKind}:${element.dataset.v2MediaPhase}:${decoded ? 'decoded' : 'pending'}`
          }),
        )
      },
      { message: 'the greeting still owns the stage', timeout: 20_000 },
    )
    .toEqual(['still:current:decoded'])

  await capture(
    page,
    info,
    shotDir,
    '06-onboarding-corky',
    page.getByRole('heading', { level: 1, name: 'Meet Corky.' }),
  )
  await expect(director).toHaveAttribute('data-phase', 'B01_CORKY_GREETING')
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

test('08-settings-support', async ({ page, shotDir }, info) => {
  const pro = await openSettings(page)
  await expect(pro).toContainText('stay free')
  await pro.evaluate((section) => {
    const top = section.getBoundingClientRect().top + window.scrollY
    window.scrollTo(0, Math.max(0, top - 32))
  })
  const onScreen = await pro.evaluate((section) => {
    const box = section.getBoundingClientRect()
    return box.top >= 0 && box.bottom <= window.innerHeight
  })
  expect(onScreen, 'the whole Pro section is on screen').toBe(true)
  await capture(
    page,
    info,
    shotDir,
    '08-settings-support',
    pro.getByRole('heading', { level: 2, name: PRO_NAME }),
  )
})
