// The Walnut picker is operated with real mouse/keyboard input, not synthetic change events.
import { expect, test } from '@playwright/test'
import { dismissOverlays } from './helpers/ui'
import { seedAuthoredGuitarScore } from './helpers/guitar-night-score'
import { installSongAudioProbe, readSongAudio, } from './helpers/guitar-night-audio-probe'
import { enterRecording } from './helpers/guitar-recording'

test('score playback owns drummer tempo and pause without opening Listening @smoke', async ({
  page,
}) => {
  await installSongAudioProbe(page)
  await seedAuthoredGuitarScore(page, 'drummer-clock-test')
  await page.addInitScript(() =>
    localStorage.setItem('mercurypitch.guitar-night.score-count-in.v1', '0'),
  )
  await page.goto('/guitar-night?song=drummer-clock-test')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()
  const room = page.getByTestId('guitar-night-score-room')
  await room
    .getByRole('button', { name: 'Session drummer', exact: true })
    .click()
  const tempo = page.getByRole('spinbutton', { name: 'Drummer tempo' })
  await expect(tempo).toBeDisabled()
  await expect(tempo).toHaveValue('120')
  await page
    .getByRole('button', { name: 'Start with score', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Session drummer' }),
  ).toBeHidden()
  await room
    .getByRole('button', { name: /^Session drummer · playing$/ })
    .click()
  await expect(
    page.getByText('Straight Backbeat · playing', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close drummer', exact: true }).click()
  const play = room
    .getByTestId('guitar-night-score-transport-core')
    .getByRole('button')
    .first()
  await expect(play).toHaveAttribute('aria-label', /Pause/)
  await play.click()
  await expect
    .poll(async () =>
      Math.max(
        0,
        ...(await readSongAudio(page)).frames
          .slice(-12)
          .map((frame) => frame.rms),
      ),
    )
    .toBeLessThan(0.00001)
  await room
    .getByRole('button', { name: 'Session drummer · ready', exact: true })
    .click()
  await expect(
    page.getByText('Ready — joins when the score plays', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close drummer', exact: true }).click()
  await play.click()
  await expect
    .poll(async () =>
      Math.max(
        0,
        ...(await readSongAudio(page)).frames
          .slice(-12)
          .map((frame) => frame.rms),
      ),
    )
    .toBeGreaterThan(0.005)
  expect((await readSongAudio(page)).micCalls).toBe(0)
})

test('renders real drum audio without input, then fades to silence on Stop @smoke', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await installSongAudioProbe(page)
  await page.goto('/guitar-night')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  await page
    .getByRole('button', { name: 'Session drummer', exact: true })
    .click()
  expect((await readSongAudio(page)).micCalls).toBe(0)
  expect((await readSongAudio(page)).frames).toHaveLength(0)
  await page.getByRole('button', { name: 'Start drummer', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Stop drummer', exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      Math.max(
        0,
        ...(await readSongAudio(page)).frames.map((frame) => frame.rms),
      ),
    )
    .toBeGreaterThan(0.005)
  expect((await readSongAudio(page)).micCalls).toBe(0)
  const genre = page.getByRole('listbox', { name: 'Genre', exact: true })
  await genre.press('ArrowDown')
  const selectedBeat = await page
    .getByRole('listbox', { name: 'Beat', exact: true })
    .getByRole('option', { selected: true })
    .innerText()
  await expect(page.getByRole('button', { name: /Apply.*bar/ })).toHaveCount(0)
  await expect(
    page.getByText(`${selectedBeat} · playing`, { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close drummer', exact: true }).click()
  await page.screenshot({ path: 'test-results/session-drummer-host.png' })
  await page.getByRole('button', { name: /^Session drummer/ }).click()
  await page.screenshot({ path: 'test-results/session-drummer-desktop.png' })
  await page.getByRole('button', { name: 'Stop drummer', exact: true }).click()
  await expect
    .poll(async () =>
      Math.max(
        0,
        ...(await readSongAudio(page)).frames
          .slice(-12)
          .map((frame) => frame.rms),
      ),
    )
    .toBeLessThan(0.00001)
  await page.getByRole('button', { name: 'Surprise me', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Stop drummer', exact: true }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      Math.max(
        0,
        ...(await readSongAudio(page)).frames
          .slice(-12)
          .map((frame) => frame.rms),
      ),
    )
    .toBeGreaterThan(0.005)
  expect(errors).toEqual([])
})

test('joint Practice start yields to the visible input choice without starting capture @smoke', async ({
  page,
}) => {
  await enterRecording(page)
  await page
    .getByRole('group', { name: 'Free-form mode' })
    .getByRole('button', { name: 'Practice', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Session drummer', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Start with score', exact: true })
    .click()
  const prompt = page.getByRole('dialog', {
    name: 'Enable Listening to practice',
    exact: true,
  })
  await expect(prompt).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Session drummer', exact: true }),
  ).toBeHidden()
  expect((await readSongAudio(page)).micCalls).toBe(0)
  await prompt
    .getByRole('button', { name: 'Close practice input', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Stop session drummer', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'Session drummer', exact: true }),
  ).toBeVisible()
})

test('opens a silent drummer, scrolls its wheels and keeps choices across reload @smoke', async ({
  page,
}) => {
  await page.goto('/guitar-night')
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  await page
    .getByRole('button', { name: 'Session drummer', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Session drummer' })
  await expect(dialog).toBeVisible()
  const genre = dialog.getByRole('listbox', { name: 'Genre' })
  await expect(genre.getByRole('option', { selected: true })).toHaveText('Rock')
  await genre.hover()
  await page.mouse.wheel(0, 110)
  await expect(genre.getByRole('option', { selected: true })).toHaveText(
    'Blues',
  )
  await genre.focus()
  await page.keyboard.press('ArrowDown')
  await expect(genre.getByRole('option', { selected: true })).toHaveText('Funk')
  const wheelBox = (await genre.boundingBox())!
  await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + 65)
  await page.mouse.down()
  await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + 109, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(genre.getByRole('option', { selected: true })).toHaveText(
    'Blues',
  )
  await genre.press('ArrowDown')
  await expect(genre.getByRole('option', { selected: true })).toHaveText('Funk')
  await genre.press('ArrowDown')
  await expect(genre.getByRole('option', { selected: true })).toHaveText('Jazz')
  await expect(
    dialog.getByRole('button', { name: 'Start drummer', exact: true }),
  ).toBeEnabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(dialog).toBeInViewport()
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/session-drummer-phone.png',
    animations: 'disabled',
  })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await dismissOverlays(page)
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page.getByRole('button', { name: 'Free play', exact: true }).click()
  await page
    .getByRole('button', { name: 'Session drummer', exact: true })
    .click()
  await expect(
    page
      .getByRole('listbox', { name: 'Genre' })
      .getByRole('option', { selected: true }),
  ).toHaveText('Jazz')
  await expect(
    page.getByRole('button', { name: 'Start drummer', exact: true }),
  ).toBeVisible()
})
