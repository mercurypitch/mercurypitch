// Piano Night library regressions cover long MIDI titles and explicit take recovery at desktop and phone sizes.
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'

const MIDI = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72,
  0x6b, 0, 0, 0, 13, 0, 0x90, 64, 100, 0x83, 0x60, 0x80, 64, 32, 0, 0xff, 0x2f,
  0,
])
const LONG_TITLE =
  'Dans_l_antre_du_roi_de_la_montagne_Edvard_Grieg_Peer_Gynt_original_piano_arrangement'

for (const width of [1440, 390]) {
  test(`long MIDI titles wrap without horizontal scrolling at ${width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('https://**/*', (route) => route.abort())
    await page.goto('/piano-night')
    await dismissOverlays(page)
    await page
      .getByTestId('night-add-music')
      .filter({ visible: true })
      .first()
      .click()
    await page.getByTestId('night-music-file').setInputFiles({
      name: `${LONG_TITLE}.mid`,
      mimeType: 'audio/midi',
      buffer: MIDI,
    })
    await page
      .getByTestId('night-music-import')
      .getByRole('button', { name: /^Import MIDI/ })
      .click()
    await expect(page.getByLabel('Piano Night session status')).toContainText(
      LONG_TITLE,
    )
    if (width <= 1180) {
      await page.getByRole('button', { name: 'Coach', exact: true }).click()
    }
    const coach = page.locator('#piano-night-coach')
    const guidance = coach.getByText(
      `No authored coaching prompt exists for ${LONG_TITLE}.`,
    )
    await expect(guidance).toBeVisible()
    const geometry = await guidance.evaluate((element) => {
      const body = element.parentElement!
      const style = getComputedStyle(element)
      return {
        horizontalOverflow: body.scrollWidth - body.clientWidth,
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight),
        clamp: style.webkitLineClamp,
      }
    })
    expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1)
    expect(geometry.height).toBeLessThanOrEqual(geometry.lineHeight * 3 + 1)
    expect(geometry.clamp).toBe('3')
    await expect(guidance).toHaveAttribute('title', LONG_TITLE)
    await page.screenshot({
      path: testInfo.outputPath('long-title-coach.png'),
      animations: 'disabled',
    })
    if (width <= 1180) await page.keyboard.press('Escape')

    await page
      .getByRole('button', { name: 'Choose music for Piano Night' })
      .filter({ visible: true })
      .click()
    const music = page.getByRole('tabpanel', { name: 'Music' })
    const rows = music.locator('button[aria-pressed]')
    await expect(rows.first()).toContainText(LONG_TITLE)
    await expect(music.getByText(LONG_TITLE, { exact: true })).toHaveAttribute(
      'title',
      LONG_TITLE,
    )
    expect(
      await music.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
    await page.screenshot({
      path: testInfo.outputPath('imported-music-first.png'),
      animations: 'disabled',
    })
  })

  test(`paused practice has a styled explicit stop action at ${width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('https://**/*', (route) => route.abort())
    await page.goto('/piano-night')
    await dismissOverlays(page)
    const play = page.getByTestId('piano-night-play')
    await play.click()
    await expect(play).toHaveAccessibleName('Pause Piano Night')
    await play.click()
    await expect(play).toHaveAccessibleName('Play Piano Night')
    await page
      .getByRole('button', { name: 'Choose music for Piano Night' })
      .filter({ visible: true })
      .click()
    const music = page.getByRole('tabpanel', { name: 'Music' })
    await expect(
      music.getByText('Changing music during practice'),
    ).toBeVisible()
    const stop = music.getByRole('button', {
      name: 'Stop practice to change music',
    })
    await expect(stop).toBeInViewport()
    const appearance = await stop.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        height: element.getBoundingClientRect().height,
        border: Number.parseFloat(style.borderTopWidth),
        background: style.backgroundColor,
      }
    })
    expect(appearance.height).toBeGreaterThanOrEqual(44)
    expect(appearance.border).toBeGreaterThanOrEqual(1)
    expect(appearance.background).not.toBe('rgba(0, 0, 0, 0)')
    await stop.focus()
    await expect(stop).toBeFocused()
    await page.screenshot({
      path: testInfo.outputPath('stop-practice-action.png'),
      animations: 'disabled',
    })
    await page.keyboard.press('Enter')
    await expect(music.getByText('Changing music during practice')).toHaveCount(
      0,
    )
    await expect(music).toBeVisible()
    await expect(page.getByLabel('Piano Night session status')).toContainText(
      'Afterglow Study in E-flat',
    )
  })
}
