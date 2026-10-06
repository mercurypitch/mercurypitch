// Native-style Games navigation opens the complete crystal runner without URL overrides.
import { expect, test, type Locator } from '@playwright/test'

for (const viewport of [
  { name: 'phone', width: 360, height: 740, touch: true },
  { name: 'tablet', width: 1024, height: 768, touch: true },
  { name: 'desktop', width: 1440, height: 900, touch: false },
]) {
  test.describe(viewport.name, () => {
    test.use({ viewport, hasTouch: viewport.touch })

    test('opens the latest art from the real Games list and retains the original runner @smoke', async ({
      page,
    }, info) => {
      test.setTimeout(90_000)
      const obstacleLoads = new Map<string, number>()
      page.on('response', (response) => {
        const path = new URL(response.url()).pathname
        if (path.includes('/games/runner-obstacles-v1/'))
          obstacleLoads.set(path.split('/').at(-1)!, response.status())
      })
      await page.goto('/?devSeed&cold')
      const press = async (button: Locator) => {
        if (viewport.touch) await button.tap()
        else await button.click()
      }
      const activate = (name: RegExp) =>
        press(page.getByRole('button', { name }))
      await activate(/B-side games/u)
      const card = page.getByRole('button', { name: /Crystal Current/u })
      await card.scrollIntoViewIfNeeded()
      const layout = await card.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const text = node.querySelector('.game-card__body')!
        return {
          left: rect.left,
          right: rect.right,
          viewport: innerWidth,
          height: rect.height,
          textOverflow: text.scrollWidth - text.clientWidth,
          background: style.backgroundColor,
          border: style.borderTopWidth,
        }
      })
      expect(layout.left).toBeGreaterThanOrEqual(0)
      expect(layout.right).toBeLessThanOrEqual(layout.viewport)
      expect(layout.height).toBeGreaterThanOrEqual(44)
      expect(layout.textOverflow).toBeLessThanOrEqual(1)
      expect(layout.background).not.toBe('rgba(0, 0, 0, 0)')
      expect(layout.border).toBe('2px')
      await page.screenshot({ path: info.outputPath('games-list.png') })
      await activate(/Crystal Current/u)
      const runner = page.getByTestId('song-runner')
      await expect(runner).toHaveAttribute('data-movement-mode', 'continuous')
      await expect(runner).toHaveAttribute(
        'data-camera-profile',
        'steering-angled',
      )
      const ready = page.getByRole('dialog', {
        name: 'Ready when you are',
        exact: true,
      })
      await expect(
        ready.getByRole('button', { name: 'Start course' }),
      ).toBeEnabled({ timeout: 60_000 })
      expect(obstacleLoads).toEqual(
        new Map([
          ['glacial-bulwark.glb', 200],
          ['rose-wave-hurdle.glb', 200],
        ]),
      )
      await expect(
        page.getByTestId('song-runner-scene').locator('canvas'),
      ).toBeVisible()
      await page.screenshot({
        path: info.outputPath('crystal-current-ready.png'),
      })
      await press(
        ready.getByRole('button', { name: 'Leave course', exact: true }),
      )
      await expect(
        page.getByRole('heading', { name: 'A small game, sung.' }),
      ).toBeVisible()
      const savedCourses = () =>
        page.evaluate(() =>
          Object.keys(localStorage)
            .filter((key) => key.includes('runner-progress:'))
            .sort(),
        )
      expect(await savedCourses()).toEqual([
        'beside-cue:glass-adventure:runner-progress:v1:the-singing-current-trial-crystal-continuous-v1',
      ])
      await activate(/The Singing Current/u)
      await expect(page.getByTestId('song-runner')).toHaveAttribute(
        'data-movement-mode',
        'lanes',
      )
      await expect(
        page.getByRole('dialog', { name: 'Ready when you are', exact: true }),
      ).toBeVisible()
      await press(
        ready.getByRole('button', { name: 'Leave course', exact: true }),
      )
      expect(await savedCourses()).toEqual([
        'beside-cue:glass-adventure:runner-progress:v1:the-singing-current-trial-crystal-continuous-v1',
        'beside-cue:glass-adventure:runner-progress:v1:the-singing-current-v1',
      ])
    })
  })
}
