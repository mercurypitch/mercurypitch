// Native file drags and real-pointer room controls exercise the shared in-session import boundary.
import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { dismissOverlays } from './helpers/ui'

const MIDI = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72,
  0x6b, 0, 0, 0, 13, 0, 0x90, 64, 100, 0x83, 0x60, 0x80, 64, 32, 0, 0xff, 0x2f,
  0,
])

async function nativeFileDrop(page: Page, path: string) {
  const cdp = await page.context().newCDPSession(page)
  const viewport = page.viewportSize()!
  const point = {
    x: Math.round(viewport.width / 2),
    y: Math.round(viewport.height / 2),
  }
  await page.mouse.move(point.x, point.y)
  const data = { items: [], files: [path], dragOperationsMask: 1 }
  await cdp.send('Input.dispatchDragEvent', {
    type: 'dragEnter',
    ...point,
    data,
  })
  await cdp.send('Input.dispatchDragEvent', {
    type: 'dragOver',
    ...point,
    data,
  })
  await expect(page.getByTestId('night-music-drop-veil')).toBeVisible()
  await cdp.send('Input.dispatchDragEvent', { type: 'drop', ...point, data })
  await cdp.detach()
}

for (const room of ['guitar', 'drum', 'piano', 'karaoke']) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`${room} Add music is usable at ${viewport.width}px and rejects a native invalid drop @smoke`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.route('https://**/*', (route) => route.abort())
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`/${room}-night`)
      await dismissOverlays(page)
      const button = page
        .getByTestId('night-add-music')
        .filter({ visible: true })
        .first()
      await button.click()
      const dialog = page.getByTestId('night-music-import')
      await expect(dialog).toBeVisible()
      await expect(dialog).toHaveAccessibleName('Add music')
      await expect(dialog.locator('..')).toHaveCSS('position', 'fixed')
      await expect(dialog.locator('..')).toHaveCSS('z-index', '18000')
      await expect(dialog).toHaveCSS('background-color', 'rgb(23, 21, 18)')
      await expect(
        dialog.getByRole('button', { name: /Choose a file/ }),
      ).toBeVisible()
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
      expect(box!.width).toBeLessThanOrEqual(610)
      await expect
        .poll(() =>
          dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        )
        .toBe(true)
      await page.screenshot({ path: testInfo.outputPath('add-music.png') })
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      const file = testInfo.outputPath('not-music.txt')
      await writeFile(file, 'A text file, not a song.')
      await nativeFileDrop(page, file)
      await expect(dialog.getByRole('alert')).toContainText('Choose')
      await expect(page).toHaveURL(new RegExp(`/${room}-night`))
      await expect(page.getByTestId('night-music-drop-veil')).not.toBeVisible()
      await expect(
        dialog.getByRole('button', { name: 'Back to session' }),
      ).toBeInViewport()
      expect(errors).toEqual([])
    })
  }
}

test('guitar free form accepts a native MIDI drop only after a rehearsal choice @smoke', async ({
  page,
}, testInfo) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  const freeForm = page.getByRole('heading', { name: 'Free form', exact: true })
  await expect(freeForm).toBeVisible()
  const file = testInfo.outputPath('night-import.mid')
  await writeFile(file, MIDI)
  await nativeFileDrop(page, file)
  await expect(freeForm).toBeVisible()
  const dialog = page.getByTestId('night-music-import')
  await expect(
    dialog.getByRole('button', { name: /Attach to the current song/ }),
  ).toHaveCount(0)
  await dialog.getByRole('button', { name: /Rehearse this score/ }).click()
  await expect(page.getByTestId('guitar-night-score-room')).toBeVisible()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByTestId('guitar-night-score-room')).not.toHaveAttribute(
    'data-playing',
    'true',
  )
})

test('piano reuses its MIDI project import and a real seek drag never opens the file overlay @smoke', async ({
  page,
}) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/piano-night')
  await dismissOverlays(page)
  const slider = page.getByRole('slider', { name: 'Seek piano project' })
  const box = await slider.boundingBox()
  if (!box) throw new Error('Piano seek control has no pointer target')
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await expect(page.getByTestId('night-music-import')).not.toBeVisible()
  await expect(page.getByTestId('night-music-drop-veil')).not.toBeVisible()
  await page
    .getByTestId('night-add-music')
    .filter({ visible: true })
    .first()
    .click()
  await page.getByTestId('night-music-file').setInputFiles({
    name: 'night-piano.mid',
    mimeType: 'audio/midi',
    buffer: MIDI,
  })
  await page
    .getByRole('button', { name: /Import MIDI and choose tracks/ })
    .click()
  await expect(page.getByTestId('piano-night-stage')).toContainText(
    'night-piano',
  )
})

test('drum score import uses the existing GM mapper without leaving the room @smoke', async ({
  page,
}) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/drum-night')
  await dismissOverlays(page)
  const drums = Buffer.from(MIDI)
  drums[23] = 0x99
  drums[24] = 38
  drums[28] = 0x89
  drums[29] = 38
  await page.getByTestId('night-add-music').click()
  await page.getByTestId('night-music-file').setInputFiles({
    name: 'night-drums.mid',
    mimeType: 'audio/midi',
    buffer: drums,
  })
  await page.getByRole('button', { name: /Load this score/ }).click()
  await expect(page.getByTestId('drum-night-shell')).toHaveAttribute(
    'data-import-status',
    'ready',
  )
  await expect(page.getByTestId('night-music-import')).not.toBeVisible()
})
