// Studio control states — the Sound role list draws the app's chevron, a pressed Repeat stays pressed under the pointer and differs from an unpressed one at 3:1 in both themes, the range's start grip is whole at 0:00, and a take's Stop stays in reach under a tablet's Export drawer.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { fakeMicArgs, writeToneWav } from './helpers/tone-wav'

test.use({
  launchOptions: { args: fakeMicArgs(writeToneWav(220, 30)) },
  permissions: ['microphone'],
})

const THEMES = ['light', 'dark'] as const

async function openInTheme(
  page: Page,
  theme: (typeof THEMES)[number],
): Promise<void> {
  await page.addInitScript((name) => {
    localStorage.setItem('pitchperfect_theme', name)
    localStorage.setItem('pitchperfect_theme_source', 'manual')
  }, theme)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
}

/** WCAG contrast between two painted colours, any CSS syntax, composited over white. */
async function contrast(page: Page, a: string, b: string): Promise<number> {
  return page.evaluate(
    ([first, second]) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      const luminance = (css: string) => {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, 1, 1)
        context.fillStyle = css
        context.fillRect(0, 0, 1, 1)
        const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map(
          (value) => {
            const v = value / 255
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
          },
        )
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const [light, dark] = [luminance(first), luminance(second)].sort(
        (x, y) => y - x,
      )
      return (light + 0.05) / (dark + 0.05)
    },
    [a, b],
  )
}

/** The button's own fill over its host's, as painted: an opaque `rgb()`. */
async function paintedFill(button: Locator): Promise<string> {
  return button.evaluate((element) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 1, 1)
    const layers: string[] = []
    for (let node: Element | null = element; node; node = node.parentElement) {
      const fill = getComputedStyle(node).backgroundColor
      layers.unshift(fill)
      if (/^rgb\(/.test(fill)) break
    }
    for (const fill of layers) {
      context.fillStyle = fill
      context.fillRect(0, 0, 1, 1)
    }
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${g}, ${b})`
  })
}

for (const theme of THEMES) {
  test(`Studio Sound role list draws the app's chevron in the ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openInTheme(page, theme)
    const studio = studioRegion(page)
    await studio
      .getByRole('button', { name: 'Phrase details', exact: true })
      .click()
    const role = studio.getByRole('combobox', { name: 'Sound role' })
    await expect(role).toBeVisible()
    const style = await role.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        image: computed.backgroundImage,
        paddingRight: parseFloat(computed.paddingRight),
        fill: computed.backgroundColor,
        text: computed.color,
      }
    })
    expect(style.image).toContain('linear-gradient')
    // The chevron sits 9-19 px from the right: the text keeps clear of it.
    expect(style.paddingRight).toBeGreaterThanOrEqual(24)
    expect(await contrast(page, style.text, style.fill)).toBeGreaterThan(7)
  })

  test(`Studio Repeat stays pressed under the pointer and reads as pressed in the ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openInTheme(page, theme)
    const repeat = studioRegion(page).getByRole('button', {
      name: 'Repeat song',
      exact: true,
    })
    await page.mouse.move(2, 2)
    const offFill = await paintedFill(repeat)
    await repeat.click()
    await expect(repeat).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(2, 2)
    await expect.poll(() => paintedFill(repeat)).not.toBe(offFill)
    // The fill fades over 0.12 s (StudioPage.module.css), toward the pressed
    // and hovered tint as the click lands and then toward the pressed one as
    // the pointer leaves: read it once the button's own fades are over, not
    // as soon as it first differs from the unpressed look.
    await repeat.evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    )
    const onFill = await paintedFill(repeat)
    // The fill is the state's mark: 3:1 from the unpressed look (WCAG 1.4.11).
    expect(await contrast(page, onFill, offFill)).toBeGreaterThanOrEqual(3)

    // Hover may tint a pressed button; it never makes it look unpressed.
    await repeat.hover()
    await expect
      .poll(async () => contrast(page, await paintedFill(repeat), offFill))
      .toBeGreaterThanOrEqual(3)
    const hoverOff = await repeat.evaluate(
      (element) => getComputedStyle(element).color,
    )
    await repeat.click()
    await expect(repeat).toHaveAttribute('aria-pressed', 'false')
    await expect
      .poll(async () =>
        repeat.evaluate((element) => getComputedStyle(element).color),
      )
      .not.toBe(hoverOff)
  })
}

test('Studio range keeps its start grip whole and grabbable at 0:00 @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await openArrangement(page)
  const studio = studioRegion(page)
  await studioClip(page, 'Phrase').click()
  await studio
    .getByRole('toolbar', { name: 'Selected clip' })
    .getByRole('button', { name: 'Range', exact: true })
    .click()
  const start = studio.getByRole('slider', { name: 'Range start' })
  await expect(start).toHaveAttribute('aria-valuenow', '0')
  // Every column of the grip takes a press: none lies under the lane names.
  const hits = await start.evaluate((handle) => {
    const box = handle.getBoundingClientRect()
    const y = box.top + box.height / 2
    let taken = 0
    let columns = 0
    for (let x = Math.ceil(box.left); x < box.right; x++) {
      columns++
      if (document.elementFromPoint(x, y) === handle) taken++
    }
    return { taken, columns }
  })
  expect(hits.columns).toBeGreaterThanOrEqual(24)
  expect(hits.taken).toBe(hits.columns)

  // A real drag from the grip moves the start: it is grabbable, not just drawn.
  const box = (await start.boundingBox())!
  await page.mouse.move(box.x + 4, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect
    .poll(async () => Number(await start.getAttribute('aria-valuenow')))
    .toBeGreaterThan(0)
})

test.describe('on a tablet', () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  })

  test('Studio keeps a take’s Stop in reach while the Export drawer is open', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await openArrangement(page)
    const studio = studioRegion(page)
    const record = studio.locator('[data-studio-record]')
    // One press arms the lane and starts the take.
    await record.click()
    await expect(record).toHaveAccessibleName('Stop recording', {
      timeout: 15_000,
    })
    await studio.locator('[data-tour="studio.export"]').click()
    await expect(studio.getByRole('dialog', { name: 'Export' })).toBeVisible()
    const stop = studio
      .locator('[data-studio-record-status]')
      .getByRole('button', { name: 'Stop', exact: true })
    await expect(stop).toBeVisible()
    // The tap lands on Stop, not on the drawer or its shade.
    const onTop = await stop.evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      )
      return hit !== null && element.contains(hit)
    })
    expect(onTop).toBe(true)
    // And clear of the drawer, so it hides none of Export.
    const drawer = (await studio
      .getByRole('dialog', { name: 'Export' })
      .boundingBox())!
    const card = (await studio
      .locator('[data-studio-record-status]')
      .boundingBox())!
    expect(card.x + card.width).toBeLessThanOrEqual(drawer.x)
    await stop.tap()
    await expect(record).toHaveAccessibleName('Record', { timeout: 15_000 })
    await expect(studio.getByRole('dialog', { name: 'Export' })).toBeVisible()
  })
})
