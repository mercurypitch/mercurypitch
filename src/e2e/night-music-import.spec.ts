// Native file drags and real-pointer room controls exercise the shared in-session import boundary.
// This file exceeds 600 lines to keep native replacement/audio fixtures and
// the room/viewport admission matrix together at this shared browser boundary.
import { expect, test, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { dismissOverlays } from './helpers/ui'

const MIDI = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0, 0x4d, 0x54, 0x72,
  0x6b, 0, 0, 0, 13, 0, 0x90, 64, 100, 0x83, 0x60, 0x80, 64, 32, 0, 0xff, 0x2f,
  0,
])

function sustainedMidi(midi: number, beats: number): Buffer {
  const buffer = Buffer.from(MIDI)
  const ticks = beats * 480
  buffer[24] = midi
  buffer[26] = 0x80 | (ticks >> 7)
  buffer[27] = ticks & 0x7f
  buffer[29] = midi
  return buffer
}

async function startedScoreBuffers(page: Page): Promise<number[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __nightScoreBuffers: number[] })
        .__nightScoreBuffers,
  )
}

async function silenceScoreClick(page: Page): Promise<void> {
  // Use the visible transport, not the duplicates inside Session controls.
  const transport = page.getByRole('group', { name: 'Rehearsal transport' })
  const click = transport.getByRole('button', {
    name: 'Turn playback click off',
    exact: true,
  })
  if (await click.isVisible()) await click.click()
  const countIn = transport.getByRole('button', {
    name: /^Count-in .* before playback\. Change count-in$/,
  })
  for (let changes = 0; changes < 4; changes += 1) {
    if ((await countIn.getAttribute('aria-label'))?.includes('Off')) break
    await countIn.click()
  }
  await expect(countIn).toHaveAccessibleName(
    'Count-in Off before playback. Change count-in',
  )
}

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
    { width: 320, height: 568 },
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
      await expect(button).toHaveAccessibleName('Add music')
      const triggerBox = await button.boundingBox()
      expect(triggerBox).not.toBeNull()
      expect(triggerBox!.width).toBeGreaterThanOrEqual(44)
      expect(triggerBox!.height).toBeGreaterThanOrEqual(44)
      expect(triggerBox!.x).toBeGreaterThanOrEqual(0)
      expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(
        viewport.width,
      )
      await page.screenshot({ path: testInfo.outputPath('session.png') })
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

for (const previousState of ['playing', 'paused']) {
  test(`guitar rehearses the dropped score instead of the ${previousState} score's pinned take @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route('https://**/*', (route) => route.abort())
    await page.addInitScript(() => {
      const observedWindow = window as unknown as {
        __nightScoreBuffers: number[]
      }
      observedWindow.__nightScoreBuffers = []
      const buffers = new WeakMap<AudioBuffer, number>()
      let nextBuffer = 1
      const start = AudioBufferSourceNode.prototype.start
      // Observe the actual Web Audio sources without faking the clock or
      // synthesis. The pluck cache reuses a buffer for the same note, so
      // replaying A under B's title still produces A's recorded buffer ID.
      AudioBufferSourceNode.prototype.start = function (...args) {
        if (this.buffer !== null) {
          if (!buffers.has(this.buffer)) buffers.set(this.buffer, nextBuffer++)
          observedWindow.__nightScoreBuffers.push(buffers.get(this.buffer)!)
        }
        return start.apply(this, args)
      }
    })
    await page.goto('/guitar-night')
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page.getByRole('button', { name: 'Free play', exact: true }).click()
    await page.getByTestId('night-add-music').filter({ visible: true }).click()
    await page.getByTestId('night-music-file').setInputFiles({
      name: 'first-score.mid',
      mimeType: 'audio/midi',
      buffer: sustainedMidi(64, 32),
    })
    const dialog = page.getByTestId('night-music-import')
    await dialog.getByRole('button', { name: /Rehearse this score/ }).click()
    const title = page.getByRole('heading', { level: 1, name: 'first-score' })
    await expect(title).toBeVisible()
    await expect(page.getByLabel('Score duration', { exact: true })).toHaveText(
      '0:16',
    )
    await silenceScoreClick(page)
    const play = page.getByRole('button', {
      name: 'Start the count-in',
      exact: true,
    })
    const position = page.getByRole('slider', {
      name: 'Score position',
      exact: true,
    })
    await play.click()
    await expect.poll(() => startedScoreBuffers(page)).toHaveLength(1)
    await expect
      .poll(async () => Number(await position.inputValue()))
      .toBeGreaterThan(0.1)
    const firstBuffers = await startedScoreBuffers(page)
    if (previousState === 'paused')
      await page
        .getByRole('button', { name: 'Pause score', exact: true })
        .click()

    const replacement = testInfo.outputPath('replacement-score.mid')
    await writeFile(replacement, sustainedMidi(76, 16))
    await nativeFileDrop(page, replacement)
    // Merely dropping the file stages it; Rehearse owns the session change.
    await expect(title).toBeVisible()
    await dialog.getByRole('button', { name: /Rehearse this score/ }).click()

    await expect(dialog).not.toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'replacement-score' }),
    ).toBeVisible()
    await expect(title).not.toBeVisible()
    await expect(
      page.getByLabel('Elapsed score time', { exact: true }),
    ).toHaveText('0:00')
    await expect(page.getByLabel('Score duration', { exact: true })).toHaveText(
      '0:08',
    )
    await expect(position).toHaveValue('0')
    await expect(play).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'End the take', exact: true }),
    ).not.toBeVisible()
    await silenceScoreClick(page)
    await play.click()
    await expect
      .poll(async () => Number(await position.inputValue()))
      .toBeGreaterThan(0.1)
    await expect.poll(() => startedScoreBuffers(page)).toHaveLength(2)
    const replacementBuffers = (await startedScoreBuffers(page)).slice(1)
    expect(replacementBuffers).not.toEqual(firstBuffers)
    await page.getByRole('button', { name: 'Pause score', exact: true }).click()
  })
}

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

function silentWav(): Buffer {
  const buffer = Buffer.alloc(44 + 48000 * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(48000, 24)
  buffer.writeUInt32LE(96000, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(buffer.length - 44, 40)
  return buffer
}

test('guitar entry audio picker queues the file instead of starting separation @smoke', async ({
  page,
}) => {
  await page.route('https://**/*', (route) => route.abort())
  const work: string[] = []
  page.on('request', (request) => {
    if (
      (request.method() === 'POST' &&
        /process|split|upload/.test(request.url())) ||
      /\.onnx(?:\?|$)/.test(request.url())
    )
      work.push(request.url())
  })
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByTestId('guitar-night-file-input').setInputFiles({
    name: 'entry-song.wav',
    mimeType: 'audio/wav',
    buffer: silentWav(),
  })
  const dialog = page.getByTestId('night-music-import')
  await expect(dialog).toContainText('entry-song.wav')
  await expect(
    dialog.getByRole('button', { name: /^Prepare vocals/ }),
  ).toBeEnabled()
  await expect(
    dialog.getByRole('checkbox', { name: 'Automatically separate new songs' }),
  ).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Back to session' }).click()
  await expect(dialog).not.toBeVisible()
  expect(work).toEqual([])
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1440, height: 1000 },
]) {
  test(`guitar populated audio import stays compact and reachable at ${viewport.width}px @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport)
    const work: string[] = []
    await page.route('**/*', (route) => {
      const request = route.request()
      if (
        (request.method() === 'POST' &&
          /process|split|upload/.test(request.url())) ||
        /\.onnx(?:\?|$)/.test(request.url())
      ) {
        work.push(request.url())
        return route.abort()
      }
      return request.url().startsWith('https:')
        ? route.abort()
        : route.continue()
    })
    await page.goto('/guitar-night')
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page.getByRole('button', { name: 'Free play', exact: true }).click()
    await page.getByTestId('night-add-music').filter({ visible: true }).click()
    const filename =
      'Live-rehearsal-recording-with-original-full-band-take-and-a-long-export-identifier-20260914T203000Z.wav'
    await page.getByTestId('night-music-file').setInputFiles({
      name: filename,
      mimeType: 'audio/wav',
      buffer: silentWav(),
    })
    const dialog = page.getByRole('dialog', { name: 'Add music', exact: true })
    const file = dialog.getByRole('button').filter({ hasText: filename })
    const local = dialog.getByRole('button', { name: /^Local/ })
    const cloud = dialog.getByRole('button', { name: /^Cloud/ })
    const vocals = dialog.getByRole('button', { name: /^Prepare vocals/ })
    const band = dialog.getByRole('button', { name: /^Separate .*band/ })
    const automatic = dialog.getByRole('checkbox', {
      name: /Automatically separate/,
    })
    await expect(vocals).toBeEnabled()
    await expect(automatic).not.toBeChecked()

    for (const mode of ['local', 'cloud']) {
      await (mode === 'local' ? local : cloud).click()
      await expect(mode === 'local' ? local : cloud).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      if (mode === 'local') await expect(vocals).toBeEnabled()
      else {
        await expect(vocals).toBeDisabled()
        await expect(
          dialog.getByRole('button', { name: 'Sign in', exact: true }).first(),
        ).toBeVisible()
        await expect(dialog).toContainText(/Sign.in.*cloud|cloud.*Sign.in/i)
      }
      await expect(band).toBeDisabled()
      await file.scrollIntoViewIfNeeded()
      await expect(file).toBeInViewport({ ratio: 1 })
      await expect
        .poll(() =>
          dialog.evaluate(
            (element) => element.scrollWidth <= element.clientWidth,
          ),
        )
        .toBe(true)
      const panel = await dialog.boundingBox()
      expect(panel).not.toBeNull()
      expect(panel!.x).toBeGreaterThanOrEqual(0)
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(viewport.width)
      expect(panel!.height).toBeLessThanOrEqual(
        viewport.width > 720 ? 760 : viewport.height - 16,
      )
      await page.screenshot({
        path: testInfo.outputPath(`audio-${mode}-${viewport.width}.png`),
      })

      // The checkbox's native input is visually hidden; its enclosing label
      // owns the real pointer target. Check every button, including disabled
      // choices and their recoveries, inside the body's clipped scrollport.
      for (const control of await dialog
        .locator('button, label:has(input[type="checkbox"])')
        .all()) {
        await control.scrollIntoViewIfNeeded()
        // Nearest-edge scrolling rounds scrollTop to pixels: at 320px it left
        // 0.234px clipped despite 105px of available scroll. One real wheel
        // gesture centers that control; full visibility stays a strict gate.
        const scroll = await control.evaluate((element) => {
          let parent = element.parentElement
          while (
            parent &&
            !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)
          )
            parent = parent.parentElement
          if (!parent) return null
          const clip = parent.getBoundingClientRect()
          const target = element.getBoundingClientRect()
          if (target.top >= clip.top && target.bottom <= clip.bottom)
            return null
          return {
            x: clip.left + clip.width / 2,
            y: clip.top + clip.height / 2,
            delta:
              target.top + target.height / 2 - (clip.top + clip.height / 2),
          }
        })
        if (scroll) {
          await page.mouse.move(scroll.x, scroll.y)
          await page.mouse.wheel(0, scroll.delta)
        }
        await expect(control).toBeInViewport({ ratio: 1 })
        const bounds = await control.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.width).toBeGreaterThanOrEqual(44)
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
        expect(bounds!.x).toBeGreaterThanOrEqual(panel!.x)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
          panel!.x + panel!.width,
        )
      }
      if (viewport.width < 720)
        await page.screenshot({
          path: testInfo.outputPath(
            `audio-${mode}-${viewport.width}-scroll-end.png`,
          ),
        })
    }
    // Opting in is only a saved preference, never consent to process this file.
    const autoTarget = automatic.locator('..')
    await autoTarget.click()
    await expect(automatic).toBeChecked()
    await autoTarget.click()
    await expect(automatic).not.toBeChecked()
    await local.click()
    await expect(vocals).toBeEnabled()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    expect(work).toEqual([])
  })
}

for (const room of ['guitar', 'drum', 'karaoke']) {
  test(`${room} queues audio and explains unavailable cloud actions before processing @smoke`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('https://**/*', (route) => route.abort())
    const uploads: string[] = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /process|split|upload/.test(request.url())
      )
        uploads.push(request.url())
    })
    await page.goto(`/${room}-night`)
    await dismissOverlays(page)
    const path = testInfo.outputPath('queued-song.wav')
    await writeFile(path, silentWav())
    await nativeFileDrop(page, path)
    const dialog = page.getByTestId('night-music-import')
    const local = dialog.getByRole('button', { name: /^Local/ })
    await expect(local).toHaveAttribute('aria-pressed', 'true')
    const prepare = dialog.getByRole('button', {
      name: room === 'karaoke' ? /^Prepare this song/ : /^Prepare vocals/,
    })
    await expect(prepare).toBeEnabled()
    expect((await local.boundingBox())!.y).toBeLessThan(
      (await prepare.boundingBox())!.y,
    )
    await expect(
      dialog.getByRole('checkbox', {
        name: 'Automatically separate new songs',
      }),
    ).not.toBeChecked()
    await dialog.getByRole('button', { name: /^Cloud/ }).click()
    await expect(prepare).toBeDisabled()
    await expect(
      dialog.getByRole('button', { name: 'Sign in', exact: true }).first(),
    ).toBeVisible()
    if (room !== 'karaoke')
      await expect(
        dialog.getByRole('button', { name: /^Separate .*band/ }),
      ).toBeDisabled()
    await page.screenshot({
      path: testInfo.outputPath('cloud-account-required.png'),
    })
    await dialog.getByRole('button', { name: /^Local/ }).click()
    await expect(prepare).toBeEnabled()
    await page.setViewportSize({ width: 320, height: 568 })
    await expect
      .poll(() =>
        dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true)
    await expect(
      dialog.getByRole('button', { name: 'Back to session' }),
    ).toBeInViewport()
    await page.screenshot({
      path: testInfo.outputPath('queued-local-phone.png'),
    })
    expect(uploads).toEqual([])
  })
}

test('piano clears stale file errors and can stop paused practice from the import dialog @smoke', async ({
  page,
}, testInfo) => {
  await page.route('https://**/*', (route) => route.abort())
  await page.goto('/piano-night')
  await dismissOverlays(page)
  const play = page.getByTestId('piano-night-play')
  await play.click()
  await expect(play).toHaveAccessibleName('Pause Piano Night')
  await play.click()
  await expect(play).toHaveAccessibleName('Play Piano Night')
  const invalid = testInfo.outputPath('unsupported.gp')
  await writeFile(invalid, 'not MIDI')
  await nativeFileDrop(page, invalid)
  const dialog = page.getByTestId('night-music-import')
  await expect(dialog.getByRole('alert')).toContainText('Choose MIDI')
  await dialog.getByRole('button', { name: 'Back to session' }).click()
  await page
    .getByTestId('night-add-music')
    .filter({ visible: true })
    .first()
    .click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await page.getByTestId('night-music-file').setInputFiles({
    name: 'paused-import.mid',
    mimeType: 'audio/midi',
    buffer: MIDI,
  })
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  const replace = dialog.getByRole('button', {
    name: /^Stop practice and import MIDI/,
  })
  await expect(replace).toBeEnabled()
  await expect(replace).toContainText('dismiss the unfinished take')
  await replace.click()
  await expect(page.getByTestId('piano-night-stage')).toContainText(
    'paused-import',
  )
  await expect(play).toHaveAccessibleName('Play Piano Night')
  await expect(dialog).not.toBeVisible()
})
