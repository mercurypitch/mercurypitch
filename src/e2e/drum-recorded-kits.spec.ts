// Recorded banks reach real decoded Web Audio playback in both rooms, only after intent.
import { expect, test, type Page } from '@playwright/test'
import { Buffer } from 'node:buffer'

interface AudioEvidence {
  __recordedKitStarts: number
}

test.use({ launchOptions: { args: ['--mute-audio'] } })

async function trackRealSamples(page: Page): Promise<string[]> {
  const requests: string[] = []
  page.on('request', (request) => {
    if (/\/drum-night\/kits\/[^/]+\/v\d+\/.+\.(mp3|opus)$/.test(request.url()))
      requests.push(request.url())
  })
  await page.addInitScript(() => {
    const observed = window as unknown as AudioEvidence
    observed.__recordedKitStarts = 0
    const decoded = new WeakSet<AudioBuffer>()
    const nativeDecode = AudioContext.prototype.decodeAudioData
    AudioContext.prototype.decodeAudioData = function (...args) {
      const result = nativeDecode.apply(this, args)
      void result.then(
        (buffer) => decoded.add(buffer),
        () => undefined,
      )
      return result
    }
    const nativeStart = AudioBufferSourceNode.prototype.start
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (
        this.buffer !== null &&
        decoded.has(this.buffer) &&
        this.buffer.duration > 0.2
      ) {
        const samples = this.buffer.getChannelData(0)
        let peak = 0
        for (let index = 0; index < samples.length; index += 32)
          peak = Math.max(peak, Math.abs(samples[index]))
        if (peak > 0.001) observed.__recordedKitStarts += 1
      }
      return nativeStart.apply(this, args)
    }
  })
  return requests
}

async function sampleStarts(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as AudioEvidence).__recordedKitStarts,
  )
}

/** Channel-10 fixture starts with formerly missing bells/hats/toms, then covers the full acoustic map. */
function coreDrumMidi(): Buffer {
  const name = [...Buffer.from('Recorded Kit Check')]
  const events = [
    0,
    0xff,
    3,
    name.length,
    ...name,
    0,
    0xff,
    0x51,
    3,
    7,
    0xa1,
    0x20,
  ]
  for (const velocity of [45, 75, 100, 120]) {
    for (const key of [
      53, 44, 45, 47, 59, 35, 36, 37, 38, 40, 41, 42, 43, 46, 48, 49, 50, 51,
      52, 55, 57,
    ]) {
      events.push(0, 0x99, key, velocity, 0x60, 0x89, key, 0)
    }
  }
  events.push(0, 0xff, 0x2f, 0)
  const track = Buffer.alloc(8)
  track.write('MTrk')
  track.writeUInt32BE(events.length, 4)
  return Buffer.concat([
    Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0x60]),
    track,
    Buffer.from(events),
  ])
}

for (const kit of [
  { id: 'muldjord', name: 'Muldjord' },
  { id: 'crocell', name: 'Crocell' },
]) {
  test(`Drum Night plays real ${kit.name} strikes and exposes credits @smoke`, async ({
    page,
  }, testInfo) => {
    const requests = await trackRealSamples(page)
    const errors: Error[] = []
    page.on('pageerror', (error) => errors.push(error))
    await page.goto('/drum-night')
    await page
      .getByRole('button', { name: 'Kit Mercury Synth', exact: true })
      .click()
    const drawer = page.getByRole('region', { name: 'Choose the kit' })
    await drawer
      .getByRole('radio', { name: new RegExp(`^${kit.name} `) })
      .click()
    const credits = drawer.getByRole('link', {
      name: 'Credits and sample licence',
      exact: true,
    })
    await expect(credits).toHaveAttribute(
      'href',
      `/drum-night/kits/${kit.id}/LICENSE.md`,
    )
    expect(requests).toEqual([])
    expect(await sampleStarts(page)).toBe(0)
    await page.screenshot({
      path: testInfo.outputPath(`${kit.id}-credits.png`),
      fullPage: true,
    })
    await drawer.getByRole('button', { name: 'Close rack drawer' }).click()
    const crash = page.getByRole('button', {
      name: 'Crash cymbal, key 6',
      exact: true,
    })
    await expect
      .poll(
        async () => {
          await crash.click()
          return sampleStarts(page)
        },
        { timeout: 15_000, intervals: [300, 600, 1_000] },
      )
      .toBeGreaterThan(0)
    expect(requests.length).toBeGreaterThan(0)
    expect(requests.every((url) => url.includes(`/kits/${kit.id}/`))).toBe(true)
    await page.reload()
    await expect(
      page.getByRole('button', { name: `Kit ${kit.name}`, exact: true }),
    ).toBeVisible()
    expect(await sampleStarts(page)).toBe(0)
    expect(errors).toEqual([])
  })

  test(`Guitar Night routes authored MIDI through ${kit.name} @smoke`, async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000)
    const requests = await trackRealSamples(page)
    const errors: Error[] = []
    page.on('pageerror', (error) => errors.push(error))
    await page.goto('/guitar-night')
    await page.getByRole('button', { name: 'Load a song', exact: true }).click()
    await page.getByTestId('guitar-night-file-input').setInputFiles({
      name: 'recorded-kit.mid',
      mimeType: 'audio/midi',
      buffer: coreDrumMidi(),
    })
    await page
      .getByRole('button', { name: 'Play the drum backing', exact: true })
      .click()
    const room = page.getByTestId('guitar-night-percussion-room')
    await expect(room).toBeVisible()
    await room.getByTestId('guitar-night-session-trigger').click()
    const mixer = page.getByRole('dialog', { name: /^Track mixer for / })
    await mixer
      .getByRole('combobox', { name: 'Guitar Night drum kit', exact: true })
      .selectOption(kit.id)
    await expect(
      mixer.getByRole('link', {
        name: 'Credits and sample licence (CC BY 4.0)',
        exact: true,
      }),
    ).toHaveAttribute('href', `/drum-night/kits/${kit.id}/LICENSE.md`)
    expect(requests).toEqual([])
    await page.screenshot({
      path: testInfo.outputPath(`${kit.id}-guitar-mixer.png`),
      fullPage: true,
    })
    await mixer.getByRole('button', { name: 'Close the track mixer' }).click()
    await room
      .getByRole('button', { name: 'Start drum backing', exact: true })
      .click()
    await expect
      .poll(() => sampleStarts(page), { timeout: 20_000 })
      .toBeGreaterThan(0)
    expect(requests.length).toBeGreaterThan(0)
    expect(requests.every((url) => url.includes(`/kits/${kit.id}/`))).toBe(true)
    expect(errors).toEqual([])
    expect(requests.some((url) => url.includes('ride-gm53'))).toBe(true)
    await room.getByTestId('guitar-night-session-trigger').click()
    const status = mixer.getByTestId('guitar-night-drum-sound-controls')
    await expect(status).not.toContainText('Synth kit ready.')
    await expect(status).toContainText(/\d+ sampled/)
  })
}
