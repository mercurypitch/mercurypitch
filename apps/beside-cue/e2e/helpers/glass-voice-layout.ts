// Singing layout regression helpers preserve target geometry, touch controls and real replay.
import { expect, test, type Page } from '@playwright/test'
import { expectGameHudVisibility, expectGameMaterialFramesFit, openGameSettings, } from './glass-ui-settings'

interface SingingLayoutFixtures {
  openMuseum(page: Page): Promise<void>
  omitMuseumRasterOutput(page: Page): Promise<void>
  expectMicrophoneOff(page: Page): Promise<void>
}

export async function expectVoicePanelFits(page: Page): Promise<void> {
  const bounds = await page
    .getByLabel('Voice challenge')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })
  expect(bounds.left).toBeGreaterThanOrEqual(0)
  expect(bounds.top).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight)
  const panel = page.getByLabel('Voice challenge')
  await expectGameMaterialFramesFit(panel)
  // The material stays outside scrolling content, including classic gutters.
  // Its fixed-width artwork must not create horizontal scrolling in either box.
  const scrollWidths = await panel.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>('[data-game-surface], div, p')]
      .filter((child) => /auto|scroll/.test(getComputedStyle(child).overflowY))
      .map((child) => ({
        client: child.clientWidth,
        scroll: child.scrollWidth,
      })),
  )
  for (const width of scrollWidths)
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1)
  const target = panel.getByRole('img')
  await expect(target).toBeVisible()
  const targetLayout = await target.evaluate((element) => {
    const disc = element.closest('button')!.getBoundingClientRect()
    const panel = element
      .closest('[data-challenge-panel]')!
      .getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(element)
    const ink = range.getBoundingClientRect()
    return {
      centerOffset: Math.abs(
        (disc.left + disc.right - panel.left - panel.right) / 2,
      ),
      inkFits:
        ink.left >= disc.left &&
        ink.right <= disc.right &&
        ink.top >= disc.top &&
        ink.bottom <= disc.bottom,
    }
  })
  expect(targetLayout.centerOffset).toBeLessThanOrEqual(0.5)
  expect(targetLayout.inkFits).toBe(true)
}

export async function expectVoiceActionsFit(
  page: Page,
  names: readonly string[],
): Promise<void> {
  for (const name of names) {
    const action = page.getByRole('button', { name, exact: true })
    await expect(action).toBeVisible()
    const layout = await action.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(element)
      return {
        height: rect.height,
        width: rect.width,
        contentFits: [...range.getClientRects()].every(
          (ink) =>
            ink.left >= rect.left &&
            ink.right <= rect.right &&
            ink.top >= rect.top &&
            ink.bottom <= rect.bottom,
        ),
      }
    })
    expect(layout.height).toBeGreaterThanOrEqual(44)
    expect(layout.width).toBeGreaterThanOrEqual(44)
    expect(layout.contentFits).toBe(true)
  }
}

export async function expectVoiceGoalFits(
  page: Page,
  name: string,
): Promise<void> {
  const layout = await page
    .getByRole('heading', { name, exact: true })
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(element)
      const ink = range.getBoundingClientRect()
      return {
        lines: new Set(
          [...range.getClientRects()].map((rect) => Math.round(rect.top)),
        ).size,
        box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        ink: { x: ink.x, y: ink.y, width: ink.width, height: ink.height },
        contentFits:
          ink.left >= rect.left &&
          ink.right <= rect.right &&
          ink.top >= rect.top &&
          ink.bottom <= rect.bottom,
      }
    })
  // The separate information column may wrap once, without pushing the note off center.
  expect(layout.lines).toBeLessThanOrEqual(2)
  expect(layout.contentFits, JSON.stringify(layout)).toBe(true)
}

export async function expectCompactVoiceState(
  page: Page,
  heading: string,
  actions: readonly string[],
): Promise<void> {
  expect(await page.evaluate(() => window.innerWidth)).toBe(320)
  await expectVoiceGoalFits(page, heading)
  await expectVoiceActionsFit(page, actions)
  await expectVoicePanelFits(page)
}

export function registerSingingLayoutTests({
  openMuseum,
  omitMuseumRasterOutput,
  expectMicrophoneOff,
}: SingingLayoutFixtures): void {
  for (const theme of ['light', 'dark'] as const) {
    test(`shared singing target stays centered with separate touch controls and real replay (${theme}) @smoke`, async ({
      page,
    }, testInfo) => {
      // This matrix proves DOM geometry and real audio. World raster proof is
      // captured separately so SwiftShader does not consume the action deadline.
      await omitMuseumRasterOutput(page)
      await page.addInitScript((theme) => {
        localStorage.setItem(
          'beside-cue:glass-adventure:comfortable-note',
          '61',
        )
        localStorage.setItem(
          'beside-cue:glass-adventure:glass-ui-appearance:v1',
          JSON.stringify({ theme, reducedTransparency: false }),
        )
      }, theme)
      await openMuseum(page)
      await expect(page.locator('[data-game-theme]')).toHaveAttribute(
        'data-game-theme',
        theme,
      )
      await page.getByRole('button', { name: 'Sing to the glass' }).click()
      const panel = page.getByRole('region', {
        name: 'Voice challenge',
        exact: true,
      })
      await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
        timeout: 12_000,
      })
      const replay = panel.getByRole('button', {
        name: 'Hear example',
        exact: true,
      })
      const help = panel.getByRole('button', {
        name: /singing instructions/,
        exact: false,
      })
      const close = panel.getByRole('button', { name: 'Cancel', exact: true })
      for (const viewport of [
        { width: 320, height: 640 },
        { width: 393, height: 852 },
        { width: 852, height: 393 },
        { width: 740, height: 320 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport)
        await expect(page.getByTestId('glass-adventure')).toHaveAttribute(
          'data-ready',
          'true',
        )
        await expectVoicePanelFits(page)
        await expectVoiceGoalFits(page, 'Hold it gently.')
        await expectVoiceActionsFit(page, [
          'Hear example',
          'Change note',
          'Show singing instructions',
          'Cancel',
        ])
        const layout = await panel.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const track = element
            .querySelector('[role="progressbar"]')!
            .getBoundingClientRect()
          const buttons = [...element.querySelectorAll('button')].map(
            (button) => {
              const r = button.getBoundingClientRect()
              return {
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
              }
            },
          )
          return {
            height: rect.height,
            track: {
              left: track.left,
              right: track.right,
              top: track.top,
              bottom: track.bottom,
            },
            buttons,
            scrolls: element.scrollWidth > element.clientWidth,
          }
        })
        expect(layout.scrolls).toBe(false)
        if (viewport.height < 500)
          expect(layout.height).toBeLessThanOrEqual(152)
        const surfaceBox = (await panel
          .locator('[data-game-surface]')
          .boundingBox())!
        const targetBox = (await replay.boundingBox())!
        // The accepted singing boards place the lens through the upper rim,
        // with its full hit target still inside the camera's measured panel.
        expect(surfaceBox.y - targetBox.y).toBeGreaterThanOrEqual(12)
        expect(targetBox.y).toBeGreaterThanOrEqual(
          (await panel.boundingBox())!.y,
        )
        expect(layout.height).toBeLessThanOrEqual(
          viewport.width < 360 ? 195 : 170,
        )
        const changeBox = (await panel
          .getByRole('button', { name: 'Change note', exact: true })
          .boundingBox())!
        expect(changeBox.x + changeBox.width).toBeLessThanOrEqual(
          targetBox.x - 8,
        )
        expect(
          Math.max(
            changeBox.x - targetBox.x - targetBox.width,
            targetBox.x - changeBox.x - changeBox.width,
            changeBox.y - targetBox.y - targetBox.height,
            targetBox.y - changeBox.y - changeBox.height,
          ),
        ).toBeGreaterThanOrEqual(8)
        expect(layout.track.right - layout.track.left).toBeGreaterThanOrEqual(
          targetBox.width * 1.7,
        )
        expect(layout.track.bottom - layout.track.top).toBeGreaterThanOrEqual(7)
        expect(
          Math.abs(
            (layout.track.left + layout.track.right) / 2 -
              targetBox.x -
              targetBox.width / 2,
          ),
        ).toBeLessThanOrEqual(0.5)
        for (const button of layout.buttons) {
          expect(
            Math.max(
              button.left - layout.track.right,
              layout.track.left - button.right,
              button.top - layout.track.bottom,
              layout.track.top - button.bottom,
            ),
          ).toBeGreaterThanOrEqual(8)
        }
        for (let a = 0; a < layout.buttons.length; a++) {
          for (let b = a + 1; b < layout.buttons.length; b++) {
            const first = layout.buttons[a],
              second = layout.buttons[b]
            expect(
              first.right <= second.left ||
                second.right <= first.left ||
                first.bottom <= second.top ||
                second.bottom <= first.top,
            ).toBe(true)
          }
        }
        const helpBox = (await help.boundingBox())!
        const closeBox = (await close.boundingBox())!
        expect(closeBox.x - helpBox.x - helpBox.width).toBeGreaterThanOrEqual(8)
        const references = await page.evaluate(
          () => window.glassVoiceFixture.referenceStarts,
        )
        await page.screenshot({
          path: testInfo.outputPath(
            `singing-${viewport.width}x${viewport.height}.png`,
          ),
        })
        await help.click()
        await expect(help).toHaveAttribute('aria-expanded', 'true')
        await expect(
          panel.locator(`#${await help.getAttribute('aria-controls')}`),
        ).toBeVisible()
        await expectVoicePanelFits(page)
        const instructionsBox = (await panel
          .locator(`#${await help.getAttribute('aria-controls')}`)
          .boundingBox())!
        const expandedBox = (await panel.boundingBox())!
        expect(instructionsBox.y + instructionsBox.height).toBeLessThanOrEqual(
          expandedBox.y + expandedBox.height,
        )
        expect(
          await page.evaluate(() => window.glassVoiceFixture.referenceStarts),
        ).toBe(references)
        await page.keyboard.press('Escape')
        await expect(help).toBeFocused()
        // The tight landscape proves the real central hit target; the other sizes
        // share this replay path and independently verify its geometry and help.
        if (viewport.width === 740) {
          const box = (await replay.boundingBox())!
          // Hit the exposed cap above the frame, not only its enclosed center.
          await page.mouse.click(box.x + box.width / 2, box.y + 4)
          await expect(panel).toHaveAttribute('data-voice-mode', 'reference')
          await expect(replay).toBeDisabled()
          await expect
            .poll(() =>
              page.evaluate(() => window.glassVoiceFixture.referenceStarts),
            )
            .toBeGreaterThan(references)
          await expect(panel).toHaveAttribute('data-voice-mode', 'singing', {
            timeout: 12_000,
          })
        }
        await expectVoicePanelFits(page)
      }
      await panel
        .getByRole('button', { name: 'Change note', exact: true })
        .click()
      await expect(panel).toHaveAttribute('data-voice-mode', 'finding')
      expect(
        await page.evaluate(() =>
          localStorage.getItem('beside-cue:glass-adventure:comfortable-note'),
        ),
      ).toBe('')
      await expect(replay).toBeDisabled()
      await expectVoicePanelFits(page)
      await close.click()
      await expect(panel).toBeHidden()
      await expectMicrophoneOff(page)
      await page.setViewportSize({ width: 740, height: 320 })
      await openGameSettings(page, 'Sound')
      const settings = page.getByRole('dialog', {
        name: 'Settings',
        exact: true,
      })
      await expectGameHudVisibility(page, false)
      const mute = settings.getByRole('checkbox', {
        name: 'Mute music and ambience',
      })
      const firstControl = await mute.evaluate((element) => {
        const label = element.closest('label')!
        const rect = label.getBoundingClientRect()
        const body = element.closest('[role="tabpanel"]')!.parentElement!
        const viewport = body.getBoundingClientRect()
        const hit = document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        )
        return {
          rect: rect.toJSON(),
          viewport: viewport.toJSON(),
          scrollTop: body.scrollTop,
          hit: hit === label || label.contains(hit),
        }
      })
      expect(firstControl.scrollTop).toBe(0)
      expect(firstControl.rect.height).toBeGreaterThanOrEqual(44)
      expect(firstControl.rect.top).toBeGreaterThanOrEqual(
        firstControl.viewport.top,
      )
      expect(firstControl.rect.bottom).toBeLessThanOrEqual(
        firstControl.viewport.bottom,
      )
      expect(firstControl.hit).toBe(true)
      const checked = await mute.isChecked()
      await page.mouse.click(
        firstControl.rect.x + firstControl.rect.width / 2,
        firstControl.rect.y + firstControl.rect.height / 2,
      )
      await expect(mute).toBeChecked({ checked: !checked })
      await settings
        .getByRole('button', { name: 'Resume', exact: true })
        .click()
      await expect(settings).toBeHidden()
      await expectGameHudVisibility(page, true)
      await expectMicrophoneOff(page)
    })
  }
}
