// ============================================================
// Drum Night's sign-in sheet keeps its own type and link colour.
//
// The shared AuthModal renders inside the Drum Night shell, so any rule the
// room writes for its own controls reaches the sheet too. A `font: inherit`
// on inputs set the email field to the room's 14px, and iOS zooms into any
// field under 16px on focus; a `color: inherit` on buttons turned the sheet's
// link buttons into plain ink.
// ============================================================

import { expect, test } from '@playwright/test'

test.use({ launchOptions: { args: ['--mute-audio'] } })

test('the sign-in sheet inside Drum Night keeps 16px fields and accent links on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/drum-night', { waitUntil: 'domcontentloaded' })

  const shell = page.getByTestId('drum-night-shell')
  await expect(shell).toBeVisible()

  const signIn = page.getByRole('button', {
    name: 'Sign in to MercuryPitch',
    exact: true,
  })
  await expect(signIn).toBeVisible()
  // The room's own controls still take the room's type.
  const shellFont = await shell.evaluate(
    (el) => getComputedStyle(el).fontFamily,
  )
  expect(await signIn.evaluate((el) => getComputedStyle(el).fontFamily)).toBe(
    shellFont,
  )

  await signIn.click()
  await expect(page.getByTestId('auth-modal-overlay')).toHaveAttribute(
    'data-tone',
    'drum-night',
  )
  const email = page.getByTestId('auth-email')
  await expect(email).toBeVisible()

  const emailFont = await email.evaluate((el) => ({
    size: Number.parseFloat(getComputedStyle(el).fontSize),
    family: getComputedStyle(el).fontFamily,
  }))
  expect(emailFont.size).toBeGreaterThanOrEqual(16)
  // Leaving the room's reset must not drop the field to the browser's font.
  expect(emailFont.family).toBe(shellFont)

  const link = page.getByTestId('auth-switch-register')
  await expect(link).toBeVisible()
  const { linkColor, inkColor } = await link.evaluate((el) => ({
    linkColor: getComputedStyle(el).color,
    inkColor: getComputedStyle(el.parentElement ?? el).color,
  }))
  expect(linkColor).not.toBe(inkColor)
})
