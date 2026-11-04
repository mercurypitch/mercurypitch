// A transcribed stem line leaves Guitar Night as a file and opens again as a tab.
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { enterSong, localStemWav } from './helpers/guitar-night-song'

/**
 * A bass line as a mono 8 kHz WAV: one note per 0.7 s, held 0.6 s, a sine
 * and its octave, so the bass reader finds each note and nothing between.
 */
function bassLineWav(midis: readonly number[], seconds: number): Buffer {
  const rate = 8000
  const samples = Math.floor(rate * seconds)
  const wav = Buffer.alloc(44 + samples * 2)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + samples * 2, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(samples * 2, 40)
  const held = 0.6
  const step = 0.7
  let phase = 0
  for (let index = 0; index < samples; index += 1) {
    const t = index / rate
    const n = Math.floor(t / step)
    const inNote = t - n * step
    let value = 0
    if (inNote < held) {
      const hz = 440 * Math.pow(2, (midis[n % midis.length] - 69) / 12)
      phase += (2 * Math.PI * hz) / rate
      const envelope = Math.min(1, inNote / 0.02, (held - inNote) / 0.02)
      value = (envelope * (Math.sin(phase) + 0.3 * Math.sin(2 * phase))) / 1.3
    }
    wav.writeInt16LE(Math.round(value * 0.5 * 32767), 44 + index * 2)
  }
  return wav
}

test('saves a transcribed bass line as Guitar Pro and opens it again as a tab @smoke', async ({
  page,
}, testInfo) => {
  testInfo.setTimeout(90_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  // Stems in the helper's order: vocal, drums, bass, guitar, piano, other.
  const quiet = localStemWav()
  await enterSong(page, 6, [
    quiet,
    quiet,
    bassLineWav([40, 45, 43, 38], 5.6),
    quiet,
    quiet,
    quiet,
  ])

  // The stems are read beside the song, not inside the room.
  await page
    .getByTestId('guitar-night-room')
    .getByRole('button', { name: 'Back to Songs', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Transcribe the bass line', exact: true })
    .click()
  await expect(
    page.getByText('Bass line transcribed from this recording'),
  ).toBeVisible({ timeout: 30_000 })

  const line = page.getByRole('group', { name: 'Save the bass line as' })
  await expect(line).toBeVisible()
  const noteCount = Number(await line.getAttribute('data-note-count'))
  expect(noteCount).toBeGreaterThanOrEqual(4)
  await expect(
    line.getByRole('button', { name: 'Save the bass line as MIDI' }),
  ).toBeEnabled()

  const saving = page.waitForEvent('download')
  await line
    .getByRole('button', { name: 'Save the bass line as Guitar Pro' })
    .click()
  const download = await saving
  expect(download.suggestedFilename()).toMatch(
    /^melody-song-controls-study-bass-line-\d{8}-\d{6}\.gp$/,
  )
  const bytes = await readFile(await download.path())
  await expect(line.getByRole('alert')).toHaveCount(0)

  // Opened the way any tab is: Choose a file, beside the song.
  const choosing = page.waitForEvent('filechooser')
  await page
    .getByRole('button', { name: 'Choose a file', exact: true })
    .first()
    .click()
  await (
    await choosing
  ).setFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/octet-stream',
    buffer: bytes,
  })
  await expect(
    page.getByText(`${noteCount} notes · 4-string`, { exact: true }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: 'Practice with tab', exact: true })
    .click()
  const room = page.getByTestId('guitar-night-score-room')
  await room.getByRole('button', { name: 'Tab', exact: true }).click()
  await expect(
    room.getByTestId('guitar-night-moving-tab').locator('[data-note-id]'),
  ).not.toHaveCount(0)
})
