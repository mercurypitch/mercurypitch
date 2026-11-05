// Studio touch targets — on a phone, the header's menu and heart, each sheet's close, and Track details' buttons and switch all take a 44 px press.
import { expect, type Locator, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { bringToMiddle, hitArea } from './helpers/hit-area'

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
})

async function press(control: Locator): Promise<[number, number]> {
  await bringToMiddle(control)
  return (await hitArea(control)).hit
}

test('a phone’s Studio takes a 44 px press on the menu, the heart, every sheet’s close and Track details’ controls', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await openArrangement(page)
  const studio = studioRegion(page)
  await importStudioAudio(page, 'Bass', 2)
  const presses: Record<string, [number, number]> = {}

  presses.Menu = await press(
    page.getByRole('button', { name: 'Menu', exact: true }),
  )
  const heart = page.getByTestId('support-heart')
  if ((await heart.count()) > 0) presses.Heart = await press(heart)

  await studio
    .getByRole('button', { name: 'Phrase details', exact: true })
    .click()
  const details = studio.getByRole('dialog', { name: 'Track details' })
  presses['Close Track details'] = await press(
    details.getByRole('button', { name: 'Close Track details', exact: true }),
  )
  presses['Remove track'] = await press(
    details.getByRole('button', { name: 'Remove track', exact: true }),
  )
  // The switch is a 16 px box inside a label that takes the press: a tap
  // on its words toggles it too, so the label is the target.
  presses['Role pictures'] = await press(
    details.locator('label', {
      has: page.getByRole('checkbox', { name: 'Role pictures' }),
    }),
  )
  await details
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()

  for (const sheet of ['Sound', 'Export'] as const) {
    await studio.getByRole('button', { name: sheet, exact: true }).click()
    const close = studio.getByRole('button', {
      name: `Close ${sheet}`,
      exact: true,
    })
    presses[`Close ${sheet}`] = await press(close)
    await close.click()
  }

  for (const [name, [width, height]] of Object.entries(presses)) {
    expect(width, `${name} width`).toBeGreaterThanOrEqual(44)
    expect(height, `${name} height`).toBeGreaterThanOrEqual(44)
  }
})
