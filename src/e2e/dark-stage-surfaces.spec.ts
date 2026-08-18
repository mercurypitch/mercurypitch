// ============================================================
// Dark stage surfaces — standalone worlds own native dark controls
// ============================================================

import { expect, test } from '@playwright/test'
import { dismissOverlays } from '@/e2e/helpers/ui'

test.use({ viewport: { width: 1024, height: 700 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as Window & { E2E_TEST_MODE?: boolean }).E2E_TEST_MODE = true
  })
})

async function expectDarkSurface(
  target: import('@playwright/test').Locator,
): Promise<void> {
  await expect(target).toBeVisible()
  await expect(target).toHaveClass(/mp-dark-stage/)
  await expect(target).toHaveCSS('color-scheme', 'dark')

  const tokens = await target.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      background: style.getPropertyValue('--bg-primary').trim(),
      card: style.getPropertyValue('--bg-card').trim(),
      foreground: style.getPropertyValue('--text-primary').trim(),
      border: style.getPropertyValue('--border').trim(),
      accent: style.getPropertyValue('--accent').trim(),
      onAccent: style.getPropertyValue('--on-accent').trim(),
      success: style.getPropertyValue('--success').trim(),
      warning: style.getPropertyValue('--warning').trim(),
      danger: style.getPropertyValue('--danger').trim(),
    }
  })

  for (const [name, value] of Object.entries(tokens)) {
    expect(value, `${name} token is unresolved`).not.toBe('')
  }
}

const colorLuminance = (value: string): number => {
  const channels = value
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number)
  if (channels === undefined || channels.length !== 3) {
    throw new Error(`Expected an RGB color, received ${value}`)
  }
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrast = (foreground: string, background: string): number => {
  const foregroundLuminance = colorLuminance(foreground)
  const backgroundLuminance = colorLuminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

test('Karaoke Night owns a complete dark native palette @smoke', async ({
  page,
}) => {
  await page.goto('/karaoke-night', { waitUntil: 'domcontentloaded' })
  await expectDarkSurface(page.locator('.kn-app'))
})

test('Guitar Night owns a complete dark native palette @smoke', async ({
  page,
}) => {
  await page.goto('/guitar-night', { waitUntil: 'domcontentloaded' })
  await expectDarkSurface(page.getByTestId('guitar-night-shell'))
})

test('Piano Night owns a complete dark native palette @smoke', async ({
  page,
}) => {
  await page.goto('/piano-night', { waitUntil: 'domcontentloaded' })
  await expectDarkSurface(page.getByTestId('piano-night-shell'))
})

test('performance confirmations keep their stage skin outside the stage @smoke', async ({
  page,
}) => {
  await page.route('**/demo/goodbye-to-spring/lyrics.lrc', (route) =>
    route.fulfill({
      body: '[00:00.00]Portal theme contract',
      contentType: 'text/plain',
    }),
  )
  await page.goto('/karaoke-night?session=karaoke-night-demo', {
    waitUntil: 'domcontentloaded',
  })

  const mixer = page.locator('.stem-mixer--performance')
  await expectDarkSurface(mixer)

  const removeLyrics = page.locator(
    '.sm-lyrics-edit-btn[aria-label="Remove lyrics"]:visible',
  )
  await expect(removeLyrics).toBeVisible({ timeout: 15_000 })
  await removeLyrics.click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove lyrics?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS('color-scheme', 'dark')
  const stagePrimary = await mixer.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--bg-primary').trim(),
  )
  const dialogPalette = await dialog.evaluate((element) => {
    const style = getComputedStyle(element)
    const body = element.querySelector('p')
    const destructive = element.querySelector<HTMLButtonElement>(
      '[data-testid="confirm-delete"]',
    )
    if (body === null) throw new Error('Confirm dialog body is missing')
    if (destructive === null) {
      throw new Error('Confirm dialog destructive action is missing')
    }
    const destructiveStyle = getComputedStyle(destructive)
    return {
      background: style.backgroundColor,
      bodyColor: getComputedStyle(body).color,
      destructiveBackground: destructiveStyle.backgroundColor,
      destructiveColor: destructiveStyle.color,
      outsideStage: !document.querySelector('.stem-mixer')?.contains(element),
      primary: style.getPropertyValue('--bg-primary').trim(),
    }
  })
  expect(dialogPalette.outsideStage).toBe(true)
  expect(dialogPalette.primary).toBe(stagePrimary)
  expect(
    contrast(dialogPalette.bodyColor, dialogPalette.background),
  ).toBeGreaterThanOrEqual(4.5)
  expect(
    contrast(
      dialogPalette.destructiveColor,
      dialogPalette.destructiveBackground,
    ),
  ).toBeGreaterThanOrEqual(4.5)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('Path keeps its immersive palette under the light app theme @smoke', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('pitchperfect_theme', 'light')
    localStorage.setItem('mp_path_view', 'ascent')
  })
  await page.goto('/#/path')
  await dismissOverlays(page)

  const path = page.locator('.path-trail')
  await expectDarkSurface(path)
  const palette = await path.evaluate((element) => ({
    pathColor: getComputedStyle(element).color,
    pathScheme: getComputedStyle(element).colorScheme,
    rootPrimary: getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-primary')
      .trim(),
    rootScheme: getComputedStyle(document.documentElement).colorScheme,
    titleColor: getComputedStyle(element.querySelector('h1')!).color,
  }))
  expect(palette).toEqual({
    pathColor: 'rgb(234, 236, 255)',
    pathScheme: 'dark',
    rootPrimary: '#f3f4f6',
    rootScheme: 'light',
    titleColor: 'rgb(246, 248, 255)',
  })
})
