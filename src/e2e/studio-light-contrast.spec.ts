// Studio light contrast — in the light theme every piece of Studio text holds 4.5:1 (3:1 when large) and every icon 3:1 over its painted ground: lane headers selected and not, the transport, the clip and line bars, Track details, Sound and Export, on a computer and a phone.
import { expect, type Locator, type Page, test } from '@playwright/test'
import { importStudioAudio, openArrangement, studioClip, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { followDeviceTheme, switchTheme } from './helpers/theme'

interface Shortfall {
  readonly text: string
  readonly ratio: number
  readonly need: number
}

/**
 * Every visible text run and button icon under `scope` whose contrast over
 * its composited ground falls short: 4.5:1 for text, 3:1 for large text and
 * icons. Colours are read through a canvas, so `color-mix()` results count;
 * opacity on the way up is applied to the ink. Disabled controls are exempt,
 * as WCAG exempts them.
 */
async function shortfalls(scope: Locator): Promise<Shortfall[]> {
  return scope.evaluate((root) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const rgba = (css: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = '#000'
      context.fillStyle = css
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
    type Rgba = ReturnType<typeof rgba>
    const over = (top: Rgba, under: Rgba): Rgba => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    })
    const luminance = ({ r, g, b }: Rgba) => {
      const f = (v: number) => {
        const c = v / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratioOf = (element: Element, ink: Element) => {
      const layers: Rgba[] = []
      let opacity = 1
      for (let n: Element | null = element; n; n = n.parentElement) {
        const style = getComputedStyle(n)
        opacity *= Number(style.opacity)
        const ground = rgba(style.backgroundColor)
        if (ground.a > 0 && layers.at(-1)?.a !== 1) layers.push(ground)
      }
      let ground: Rgba = { r: 255, g: 255, b: 255, a: 1 }
      for (let i = layers.length - 1; i >= 0; i--)
        if (layers[i]) ground = over(layers[i]!, ground)
      const color = rgba(getComputedStyle(ink).color)
      const fg = over({ ...color, a: color.a * opacity }, ground)
      const [light, dark] = [luminance(fg), luminance(ground)].sort(
        (a, b) => b - a,
      )
      return (light! + 0.05) / (dark! + 0.05)
    }
    const out: { text: string; ratio: number; need: number }[] = []
    for (const element of [root, ...root.querySelectorAll('*')]) {
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const box = element.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) continue
      if (box.bottom < 0 || box.top > innerHeight) continue
      if (box.right < 0 || box.left > innerWidth) continue
      if (element.closest(':disabled, [aria-disabled="true"]')) continue
      const host = element.closest('button, a')
      const icon =
        element.tagName.toLowerCase() === 'svg' &&
        host !== null &&
        element.parentElement?.closest('svg') === null
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .join(' ')
        .trim()
      if (!icon && text === '') continue
      const size = Number.parseFloat(style.fontSize)
      const bold = Number(style.fontWeight) >= 700
      const large = size >= 24 || (size >= 18.66 && bold)
      const need = icon || large ? 3 : 4.5
      // An icon draws in its button's colour, over the button's ground.
      const ratio = icon
        ? ratioOf(element.parentElement!, element)
        : ratioOf(element, element)
      if (ratio < need)
        out.push({
          text: icon ? `icon: ${host?.getAttribute('aria-label')}` : text,
          ratio: Math.round(ratio * 100) / 100,
          need,
        })
    }
    return out
  })
}

/** Wait out every running animation and transition: a panel fades in. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation.effect?.getTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

async function sweepOpenPanel(page: Page, name: string): Promise<Shortfall[]> {
  const studio = studioRegion(page)
  await studio.getByRole('button', { name, exact: true }).click()
  const close = studio.getByRole('button', {
    name: `Close ${name}`,
    exact: true,
  })
  await expect(close).toBeVisible()
  await settled(page)
  const panel = page.locator('[data-studio-panel]').last()
  const found = await shortfalls(panel)
  await close.click()
  return found
}

const LAYOUTS = [
  { name: 'a computer', viewport: { width: 1440, height: 900 }, touch: false },
  { name: 'a phone', viewport: { width: 390, height: 844 }, touch: true },
] as const

for (const layout of LAYOUTS) {
  test.describe(`Studio in light on ${layout.name}`, () => {
    test.use({
      viewport: layout.viewport,
      hasTouch: layout.touch,
      isMobile: layout.touch,
    })

    test('keeps every text and icon at its WCAG contrast, the selected lane’s header included', async ({
      page,
    }) => {
      test.setTimeout(90_000)
      await followDeviceTheme(page)
      await openArrangement(page)
      await importStudioAudio(page, 'Bass', 2)
      const studio = studioRegion(page)
      await switchTheme(page, 'light')

      // The first lane selected, through its clip: the clip bar opens too.
      await studioClip(page).click()
      await expect(
        studio.locator('[data-studio-track][data-selected]'),
      ).toHaveCount(1)
      await settled(page)
      const found: Record<string, Shortfall[]> = {
        'arrangement, a clip selected': await shortfalls(studio),
      }

      if (!layout.touch) {
        await studio
          .getByRole('button', {
            name: 'Phrase volume and pan lines',
            exact: true,
          })
          .click()
        await settled(page)
        found['line bar'] = await shortfalls(
          studio.getByRole('toolbar', { name: 'Phrase lines' }),
        )
        await studio
          .getByRole('button', {
            name: 'Phrase volume and pan lines',
            exact: true,
          })
          .click()
      }

      await studio
        .getByRole('button', { name: 'Bass details', exact: true })
        .click()
      await settled(page)
      found['Track details'] = await shortfalls(
        page.locator('[data-studio-panel]').last(),
      )
      await studio
        .getByRole('button', { name: 'Close Track details', exact: true })
        .click()
      found.Sound = await sweepOpenPanel(page, 'Sound')
      found.Export = await sweepOpenPanel(page, 'Export')

      expect(found).toEqual(
        Object.fromEntries(Object.keys(found).map((key) => [key, []])),
      )
    })
  })
}
