// Studio control states — the Sound role list draws the app's chevron in both themes.
import { expect, type Page, test } from '@playwright/test'
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
}
