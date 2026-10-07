// Shared game settings navigation — exercise the actual modal and live camera preview paths.
import { expect, type Locator, type Page } from '@playwright/test'

/** The clear modal retains the scene while suppressing the extra layer of HUD ink. */
export async function expectGameHudVisibility(
  page: Page,
  visible: boolean,
): Promise<void> {
  const children = page.locator(
    '[data-game-hud] > :not(dialog):not(:has(dialog))',
  )
  expect(await children.count()).toBeGreaterThan(0)
  for (const child of await children.all())
    await expect(child).toHaveCSS('visibility', visible ? 'visible' : 'hidden')
  for (const layer of await page.locator('[data-game-hud-layer]').all()) {
    if (visible)
      await expect
        .poll(() =>
          layer.evaluate((element) =>
            Number(getComputedStyle(element).opacity),
          ),
        )
        .toBeGreaterThan(0)
    else await expect(layer).toHaveCSS('opacity', '0')
  }
}

/** Inspect rendered SVG viewports, because host icon CSS can override SVG dimensions. */
export async function expectGameMaterialFramesFit(
  host: Locator,
): Promise<void> {
  const frames = host.locator('[data-game-frame]:visible')
  expect(await frames.count()).toBeGreaterThan(0)
  await expect
    .poll(async () =>
      frames.evaluateAll((elements) => {
        const problems: string[] = []
        for (const element of elements) {
          const frame = element as SVGSVGElement
          const name = frame.getAttribute('data-material-art') ?? 'material'
          const owner = frame.parentElement!.getBoundingClientRect()
          const rect = frame.getBoundingClientRect()
          const view = frame.viewBox.baseVal
          const same = (a: number, b: number): boolean => Math.abs(a - b) <= 0.5
          if (
            ![rect.width, rect.height, view.width, view.height].every(
              (value) => value > 0,
            )
          )
            problems.push(`${name}: empty frame`)
          if (
            !same(rect.x, owner.x) ||
            !same(rect.y, owner.y) ||
            !same(rect.width, owner.width) ||
            !same(rect.height, owner.height)
          )
            problems.push(
              `${name}: frame ${rect.width}×${rect.height} differs from owner ${owner.width}×${owner.height}`,
            )
          if (!same(view.width, rect.width) || !same(view.height, rect.height))
            problems.push(`${name}: viewBox does not match rendered frame`)
          if (getComputedStyle(frame).pointerEvents !== 'none')
            problems.push(`${name}: decoration can intercept input`)
          const slices = [
            ...frame.querySelectorAll<SVGSVGElement>(':scope > svg'),
          ]
          let area = 0
          for (const [index, slice] of slices.entries()) {
            const x = slice.x.baseVal.value
            const y = slice.y.baseVal.value
            const width = slice.width.baseVal.value
            const height = slice.height.baseVal.value
            const css = getComputedStyle(slice)
            if (
              !same(Number.parseFloat(css.width), width) ||
              !same(Number.parseFloat(css.height), height)
            )
              problems.push(
                `${name} slice ${index}: CSS ${css.width}×${css.height} overrides ${width}×${height}`,
              )
            if (
              !(width > 0 && height > 0) ||
              x < -0.01 ||
              y < -0.01 ||
              x + width > view.width + 0.01 ||
              y + height > view.height + 0.01
            )
              problems.push(`${name} slice ${index}: outside its frame`)
            if (css.overflow !== 'hidden')
              problems.push(
                `${name} slice ${index}: source pixels can escape their viewport`,
              )
            const source = slice.viewBox.baseVal
            if (!(source.width > 0 && source.height > 0))
              problems.push(`${name} slice ${index}: empty source region`)
            const corner =
              (same(x, 0) || same(x + width, view.width)) &&
              (same(y, 0) || same(y + height, view.height))
            if (
              slices.length > 1 &&
              corner &&
              Math.abs(width / source.width - height / source.height) > 0.0001
            )
              problems.push(
                `${name} slice ${index}: corner facets are stretched unequally`,
              )
            const clip = slice
              .querySelector('g')
              ?.getAttribute('clip-path')
              ?.match(/^url\(#(.+)\)$/)?.[1]
            if (
              !clip ||
              !frame
                .querySelector('defs')
                ?.contains(document.getElementById(clip))
            )
              problems.push(
                `${name} slice ${index}: missing source silhouette clip`,
              )
            area += width * height
          }
          if (Math.abs(area - view.width * view.height) > 0.1)
            problems.push(`${name}: slices do not cover the frame`)
        }
        return problems
      }),
    )
    .toEqual([])
}

export async function openGameSettings(
  page: Page,
  section?: 'Sound' | 'Play' | 'Display' | 'Advanced',
): Promise<void> {
  await page.getByRole('button', { name: 'Open settings', exact: true }).click()
  if (section !== undefined)
    await page.getByRole('tab', { name: section, exact: true }).click()
}

export async function openCameraPreview(page: Page): Promise<void> {
  await openGameSettings(page, 'Advanced')
  await page
    .getByRole('button', { name: 'Preview camera', exact: true })
    .click()
}
