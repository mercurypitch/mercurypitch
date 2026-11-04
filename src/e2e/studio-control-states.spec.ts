// Studio control states — the Sound role list draws the app's chevron, and a pressed Repeat stays pressed under the pointer and differs from an unpressed one at 3:1 in both themes.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { openArrangement, studioRegion, } from './helpers/dedicatedstudio-fixture'

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
