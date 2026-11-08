// Studio MIDI lanes — with a fake Web MIDI keyboard in the page, a lane set to it plays the piano's synth (the sampled grand's samples refused, so the run is the same every time), arms with no microphone, records the sound as a take, and keeps the note played, its sound in the take starting at its frame or within one audio callback after; and the Inputs view lists the keyboard with its lane and a light while it plays. Nothing reaches the live site.
import { expect, type Page, test } from '@playwright/test'
import { openArrangement, readStudioProject, studioRegion, } from './helpers/dedicatedstudio-fixture'
import { armLane, recordTake } from './helpers/studio-arming'

test.use({ viewport: { width: 1440, height: 900 } })

/**
 * In the page: a keyboard named Fake Keys in place of the browser's Web
 * MIDI, played with `window.__fakeMidi.send(bytes)`, and a count of every
 * microphone the page asks for.
 */
function installFakeMidi() {
  type Listener = (event: { data: Uint8Array; timeStamp: number }) => void
  const listeners = new Set<Listener>()
  const input = {
    id: 'fake-keys',
    name: 'Fake Keys',
    manufacturer: 'MercuryPitch tests',
    type: 'input',
    state: 'connected',
    connection: 'closed',
    onmidimessage: null as Listener | null,
    addEventListener(type: string, listener: Listener) {
      if (type === 'midimessage') listeners.add(listener)
    },
    removeEventListener(type: string, listener: Listener) {
      if (type === 'midimessage') listeners.delete(listener)
    },
  }
  const access = {
    inputs: new Map([[input.id, input]]),
    outputs: new Map(),
    sysexEnabled: false,
    onstatechange: null,
    addEventListener() {},
    removeEventListener() {},
  }
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: () => Promise.resolve(access),
  })
  const page = window as unknown as {
    __fakeMidi: { send(bytes: number[]): void }
    __microphones: number
  }
  page.__fakeMidi = {
    send(bytes) {
      const event = {
        data: new Uint8Array(bytes),
        timeStamp: performance.now(),
      }
      for (const listener of listeners) listener(event)
      input.onmidimessage?.(event)
    },
  }
  page.__microphones = 0
  const devices = navigator.mediaDevices as MediaDevices | undefined
  const ask = devices?.getUserMedia?.bind(devices)
  if (devices !== undefined && ask !== undefined)
    devices.getUserMedia = (constraints) => {
      page.__microphones += 1
      return ask(constraints)
    }
}

/** Play `bytes` on the fake keyboard. */
const play = (page: Page, bytes: number[]) =>
  page.evaluate((sent) => {
    ;(
      window as unknown as { __fakeMidi: { send(bytes: number[]): void } }
    ).__fakeMidi.send(sent)
  }, bytes)

/** Refuse the sampled grand's samples, and every request to the live site, noting the latter. */
async function routeNetwork(page: Page): Promise<string[]> {
  const live: string[] = []
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort())
  await page.route(/https:\/\/([a-z.]+\.)?mercurypitch\.com\//, (route) => {
    live.push(route.request().url())
    return route.abort()
  })
  return live
}

/** Set `lane`'s input to the fake keyboard in its Track details, MIDI allowed from the press. */
async function playLaneFromKeys(page: Page, lane: string): Promise<void> {
  const studio = studioRegion(page)
  await studio
    .getByRole('button', { name: `${lane} details`, exact: true })
    .click()
  await studio
    .getByRole('button', { name: 'Show MIDI keyboards and pads', exact: true })
    .click()
  const picker = studio.getByRole('combobox', { name: 'Input', exact: true })
  await expect(picker.locator('optgroup[label="MIDI"] option')).toHaveText([
    'Fake Keys',
  ])
  await picker.selectOption({ label: 'Fake Keys' })
  await expect(studio.locator('[data-studio-lane-sound]')).toHaveText(
    'Plays as piano until this instrument has its own sound.',
  )
  await studio
    .getByRole('button', { name: 'Close Track details', exact: true })
    .click()
}

interface StoredTake {
  readonly assetId: string
  /** The take's audio: its loudest sample, and the first frame anything sounds. */
  readonly peak: number
  readonly onset: number
  /** The amplitude of middle C and of 400 Hz while the note sounded. */
  readonly middleC: number
  readonly between: number
  readonly notes: {
    midi: number
    velocity: number
    startFrame: number
    endFrame: number
  }[]
}

/** The take kept as `title`: its audio read back, and its notes. */
async function storedTake(page: Page, title: string): Promise<StoredTake> {
  return page.evaluate(async (wanted) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const read = <T>(store: string, key?: string) =>
      new Promise<T>((resolve, reject) => {
        const objects = database
          .transaction(store, 'readonly')
          .objectStore(store)
        const request = key === undefined ? objects.getAll() : objects.get(key)
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error)
      })
    try {
      const assets = await read<
        {
          asset: {
            id: string
            originalName?: string
            canonicalPcmId: string
            canonicalPcmFormat?: 'int16'
            normalizedFrameCount: number
          }
        }[]
      >('studioAssets')
      const take = assets
        .map((row) => row.asset)
        .find((asset) => asset.originalName?.startsWith(wanted))
      if (take === undefined) throw new Error(`No take named ${wanted}.`)
      const blobs =
        await read<{ id: string; data: ArrayBuffer }[]>('studioAssetBlobs')
      const data = blobs.find((row) => row.id === take.canonicalPcmId)!.data
      const frames = take.normalizedFrameCount
      const samples =
        take.canonicalPcmFormat === 'int16'
          ? Float32Array.from(
              new Int16Array(data, 32, frames),
              (value) => value / 32768,
            )
          : new Float32Array(data, 32, frames)
      const row = await read<{ notes: StoredTake['notes'] } | undefined>(
        'studioTakeNotes',
        take.id,
      )
      let peak = 0
      let onset = -1
      samples.forEach((value, frame) => {
        peak = Math.max(peak, Math.abs(value))
        if (onset < 0 && Math.abs(value) > 0.01) onset = frame
      })
      // Half a second from the onset, where the held note sounds.
      const from = Math.max(0, onset)
      const window = samples.subarray(from, Math.min(frames, from + 24_000))
      const amplitude = (hz: number) => {
        const w = (2 * Math.PI * hz) / 48_000
        const k = 2 * Math.cos(w)
        let s1 = 0
        let s2 = 0
        for (const x of window) {
          const s0 = x + k * s1 - s2
          s2 = s1
          s1 = s0
        }
        const re = s1 - s2 * Math.cos(w)
        const im = s2 * Math.sin(w)
        return (2 * Math.sqrt(re * re + im * im)) / window.length
      }
      return {
        assetId: take.id,
        peak,
        onset,
        middleC: amplitude(261.63),
        between: amplitude(400),
        notes: row?.notes ?? [],
      }
    } finally {
      database.close()
    }
  }, title)
}

test.describe('Studio MIDI lanes', () => {
  test('records a MIDI lane as a take with no microphone, and keeps its note at or just before its sound', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await playLaneFromKeys(page, 'Lane 2')
    await expect(
      studio.getByRole('button', {
        name: 'Lane 2 records from Fake Keys (MIDI)',
        exact: true,
      }),
    ).toHaveText('MIDI')

    await armLane(page, 'Lane 2')
    await expect(
      studio.getByText(
        'Armed on Lane 2 with Fake Keys. Press Record to start.',
        { exact: true },
      ),
    ).toBeVisible()
    await recordTake(page, 'Take 1', async () => {
      await play(page, [0x90, 60, 100])
      await page.evaluate(() => new Promise((done) => setTimeout(done, 600)))
      await play(page, [0x80, 60, 0])
      await page.evaluate(() => new Promise((done) => setTimeout(done, 300)))
    })

    const take = await storedTake(page, 'Take 1')
    const project = await readStudioProject(page)
    const clip = project.clips.find((each) => each.assetId === take.assetId)!
    // Where the take's first sample sits on the song.
    const heardFirst = clip.startFrame - clip.sourceInFrame
    const microphones = await page.evaluate(
      () => (window as unknown as { __microphones: number }).__microphones,
    )
    console.log(
      `[studio-midi-lanes] ${JSON.stringify({ ...take, heardFirst, microphones })}`,
    )

    expect(microphones).toBe(0)
    expect(take.notes).toHaveLength(1)
    const [note] = take.notes
    expect([note.midi, note.velocity]).toEqual([60, 100])
    // The key was held about 0.6 s.
    expect(note.endFrame - note.startFrame).toBeGreaterThan(0.45 * 48_000)
    expect(note.endFrame - note.startFrame).toBeLessThan(0.9 * 48_000)
    // The take holds the piano's middle C, and the note sits where its sound
    // starts, never after it. The sound crosses the onset's level a little
    // later: the synth rises over 8 ms and its limiter looks 6 ms ahead, and
    // a note whose message is already past starts at the audio's next
    // callback, up to one callback after the time it is kept at. Measured in
    // headless Chromium, 12.8 to 24.8 ms.
    expect(take.peak).toBeGreaterThan(0.02)
    expect(take.middleC).toBeGreaterThan(4 * take.between)
    const late = take.onset - (note.startFrame - heardFirst)
    expect(late).toBeGreaterThanOrEqual(0)
    expect(late).toBeLessThan(0.04 * 48_000)
    expect(live).toEqual([])
  })

  test('lists the keyboard in the Inputs view with its lane, lit while it plays', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const live = await routeNetwork(page)
    await page.addInitScript(installFakeMidi)
    await openArrangement(page)
    const studio = studioRegion(page)
    await studio.getByRole('button', { name: 'New lane', exact: true }).click()
    await playLaneFromKeys(page, 'Lane 2')

    await studio.getByRole('button', { name: 'Sound', exact: true }).click()
    await studio
      .getByRole('button', { name: 'Inputs and channels', exact: true })
      .click()
    const midi = studio.getByRole('region', { name: 'MIDI inputs' })
    const row = midi.locator('[data-studio-midi-port="fake-keys"]')
    await expect(row).toContainText('Fake Keys')
    await expect(row).toContainText('Lane 2')
    const light = row.locator('[aria-hidden="true"]')
    await expect(async () => {
      await play(page, [0x90, 64, 90])
      await expect(light).toHaveAttribute('data-active', '', { timeout: 200 })
    }).toPass({ timeout: 10_000 })
    await play(page, [0x80, 64, 0])
    await expect(light).not.toHaveAttribute('data-active', '')
    expect(live).toEqual([])
  })
})
