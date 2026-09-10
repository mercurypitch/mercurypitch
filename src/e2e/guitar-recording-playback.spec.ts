// Recorder audition exercises real media, synthesis and cabinet PCM from a local deterministic take.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

interface AuditionProbeFrame {
  serial: number
  rate: number
  left: number[]
  right: number[]
}

interface AuditionProbe {
  frames: AuditionProbeFrame[]
  serial: number
  micCalls: number
  mediaPlayCalls: number
}

declare global {
  interface Window {
    __recordingAuditionProbe: AuditionProbe
  }
}

const RECORDING_ID = 'e2e-recording-audition'
const AMP_KEY = 'guitar-night-amp-settings-v2'

async function installAuditionProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: AuditionProbe = {
      frames: [],
      serial: 0,
      micCalls: 0,
      mediaPlayCalls: 0,
    }
    window.__recordingAuditionProbe = probe
    const connectNode: (
      this: AudioNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ) => AudioNode = AudioNode.prototype.connect
    const connectParam: (
      this: AudioNode,
      destination: AudioParam,
      output?: number,
    ) => void = AudioNode.prototype.connect
    const taps = new WeakMap<AudioDestinationNode, GainNode>()
    function connect(
      this: AudioNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ): AudioNode
    function connect(
      this: AudioNode,
      destination: AudioParam,
      output?: number,
    ): void
    function connect(
      this: AudioNode,
      destination: AudioNode | AudioParam,
      output?: number,
      input?: number,
    ): AudioNode | void {
      if (destination instanceof AudioParam)
        return connectParam.call(this, destination, output)
      if (!(destination instanceof AudioDestinationNode))
        return connectNode.call(this, destination, output, input)
      let tap = taps.get(destination)
      if (tap === undefined) {
        const context = this.context as AudioContext
        tap = context.createGain()
        tap.channelCount = 2
        tap.channelCountMode = 'explicit'
        tap.channelInterpretation = 'speakers'
        const silent = context.createGain()
        silent.gain.value = 0
        connectNode.call(tap, silent)
        connectNode.call(silent, destination)
        taps.set(destination, tap)
        const processor = `
          class RecordingAuditionProbe extends AudioWorkletProcessor {
            constructor() { super(); this.left = []; this.right = []; }
            process(inputs) {
              const left = inputs[0]?.[0];
              const right = inputs[0]?.[1];
              if (left) for (let i = 0; i < left.length; i++) {
                this.left.push(left[i]); this.right.push(right?.[i] ?? 0);
              }
              if (this.left.length >= 1024) {
                this.port.postMessage({ rate: sampleRate, left: this.left, right: this.right });
                this.left = []; this.right = [];
              }
              return true;
            }
          }
          registerProcessor('recording-audition-probe', RecordingAuditionProbe);
        `
        const url = URL.createObjectURL(
          new Blob([processor], { type: 'text/javascript' }),
        )
        const tappedInput = tap
        void context.audioWorklet.addModule(url).then(() => {
          URL.revokeObjectURL(url)
          const recorder = new AudioWorkletNode(
            context,
            'recording-audition-probe',
            {
              channelCount: 2,
              channelCountMode: 'explicit',
              channelInterpretation: 'speakers',
            },
          )
          recorder.port.onmessage = ({ data }) => {
            probe.frames.push({ ...data, serial: ++probe.serial })
            if (probe.frames.length > 1000) probe.frames.shift()
          }
          connectNode.call(tappedInput, recorder)
          connectNode.call(recorder, silent)
        })
      }
      connectNode.call(this, tap, output, input)
      return destination
    }
    AudioNode.prototype.connect = connect
    const playMedia = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function () {
      probe.mediaPlayCalls++
      return playMedia.call(this)
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        probe.micCalls++
        throw new Error('Take replay must not request input hardware')
      },
    })
    if (localStorage.getItem('guitar-night-amp-settings-v2') === null) {
      localStorage.setItem(
        'guitar-night-amp-settings-v2',
        JSON.stringify({
          version: 2,
          presetId: 'custom',
          enabled: true,
          engine: 'studio',
          head: 'lead',
          character: 1,
          drive: 0.95,
          bass: 0,
          mid: 0,
          treble: 0,
          presence: 0,
          output: 0.6,
          cabinet: 'balanced',
          asymmetry: 0,
        }),
      )
    }
  })
}

async function seedRecording(page: Page): Promise<void> {
  await page.goto('/guitar-night')
  await page.getByRole('button', { name: 'Load a song', exact: true }).click()
  await page
    .getByRole('button', { name: 'Free play', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Free form', exact: true }),
  ).toBeVisible()
  // The real free-form controller initializes this schema. Only its browser
  // persistence edge is seeded; the app still validates/loads and plays the take.
  await page.evaluate(async (id) => {
    const open = indexedDB.open('MercuryPitchDB')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const sampleRate = 48000
    const frames = sampleRate * 6
    const chunkSize = 8192
    const chunkCount = Math.ceil(frames / chunkSize)
    const now = '2026-09-07T12:00:00.000Z'
    const notes = [
      {
        id: 'a3-note',
        midi: 57,
        startFrame: 0,
        endFrame: frames,
        clarity: 0.96,
        onset: 'attack',
      },
    ]
    const transaction = db.transaction(
      ['guitarRecordings', 'guitarRecordingChunks'],
      'readwrite',
    )
    transaction.objectStore('guitarRecordings').put({
      id,
      version: 1,
      detectorVersion: 'guitar-melody-1.1',
      title: 'Audition source proof',
      createdAt: now,
      updatedAt: now,
      state: 'draft',
      sampleRate,
      inputChannel: 0,
      inputKind: 'interface',
      tuning: {
        instrument: 'guitar',
        stringCount: 6,
        openMidi: [64, 59, 55, 50, 45, 40],
        labels: ['E', 'B', 'G', 'D', 'A', 'E'],
        capo: 0,
      },
      frames,
      chunks: chunkCount,
      audioStartFrame: 0,
      clockAnomalies: 0,
      interruption: null,
      amp: {
        enabled: true,
        engine: 'studio',
        head: 'lead',
        character: 1,
        drive: 0.95,
        bass: 0,
        mid: 0,
        treble: 0,
        presence: 0,
        output: 0.42,
        cabinet: 'balanced',
        asymmetry: 0,
      },
      backing: null,
      takeId: null,
      scoreId: null,
    })
    for (let sequence = 0; sequence < chunkCount; sequence++) {
      const firstFrame = sequence * chunkSize
      const count = Math.min(chunkSize, frames - firstFrame)
      const pcm = new ArrayBuffer(count * 2)
      const view = new DataView(pcm)
      for (let index = 0; index < count; index++) {
        // Original audio is A2, notes are A3: the test can distinguish which
        // source actually reaches the speakers, not just which button is active.
        const phase = (2 * Math.PI * 110 * (firstFrame + index)) / sampleRate
        const sample = 0.08 * Math.sin(phase) + 0.002 * Math.sin(phase * 2)
        view.setInt16(index * 2, Math.round(sample * 32767), true)
      }
      transaction.objectStore('guitarRecordingChunks').put({
        id: `${id}:${sequence}`,
        createdAt: now,
        updatedAt: now,
        kind: 'audio',
        recordingId: id,
        sequence,
        firstFrame,
        frames: count,
        pcm,
        pitches: [],
        attacks: [],
        notes: [],
        peak: 0.082,
      })
    }
    transaction.objectStore('guitarRecordingChunks').put({
      id: `${id}:ending`,
      createdAt: now,
      updatedAt: now,
      kind: 'ending',
      recordingId: id,
      sequence: chunkCount,
      firstFrame: frames,
      frames: 0,
      pcm: null,
      pitches: [],
      attacks: [],
      notes,
      peak: 0,
    })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    db.close()
  }, RECORDING_ID)
  await page.goto(`/guitar-night?recording=${RECORDING_ID}`)
}

async function measurePlayback(
  page: Page,
  surface: Locator,
  source: 'Recording' | 'Notes',
  tone: 'clean' | 'current-amp' | 'saved-amp',
  review: boolean,
  bypassed = false,
  whilePlaying?: () => Promise<void>,
) {
  const pauseName = review
    ? 'Pause take playback'
    : source === 'Recording'
      ? 'Pause recording replay'
      : 'Pause note playback'
  const playName = review
    ? 'Play take playback'
    : source === 'Recording'
      ? 'Play recording'
      : 'Play recorded notes'
  const running = surface.getByRole('button', {
    name: review
      ? 'Pause take playback'
      : /^Pause (recording replay|note playback)$/,
    exact: true,
  })
  if (await running.count()) await running.click()
  const pause = surface.getByRole('button', { name: pauseName, exact: true })
  const rewind = surface.getByRole('button', {
    name: 'Stop take playback',
    exact: true,
  })
  if (await rewind.isEnabled()) await rewind.click()
  const sourceTrigger = surface.getByRole('button', {
    name: 'Playback source',
    exact: true,
  })
  await (
    (await sourceTrigger.isVisible())
      ? sourceTrigger
      : surface.getByRole('button', { name: 'Playback tone', exact: true })
  ).click()
  await page
    .getByTestId(
      source === 'Recording'
        ? 'overflow-recording-source'
        : 'overflow-notes-source',
    )
    .click()
  await surface
    .getByRole('button', { name: 'Playback tone', exact: true })
    .click()
  await page.getByTestId('overflow-' + tone).click()
  await surface.getByRole('button', { name: playName, exact: true }).click()
  await expect(pause).toBeVisible()
  await expect(pause).toHaveAttribute('aria-busy', 'false')
  await whilePlaying?.()
  await expect(
    surface.getByRole('button', { name: 'Playback tone', exact: true }),
  ).toHaveAttribute(
    'title',
    tone === 'clean' || bypassed
      ? 'App amp bypassed · clean playback'
      : 'Studio Lead · amp + cabinet',
  )
  await expect
    .poll(() => page.evaluate(() => window.__recordingAuditionProbe.serial))
    .toBeGreaterThan(0)
  const capture = await page.evaluate(() => {
    const probe = window.__recordingAuditionProbe
    const rate = probe.frames.at(-1)!.rate
    return {
      marker: probe.serial,
      settleBlocks: Math.ceil((rate * 0.25) / 1024),
      windowBlocks: Math.ceil((rate * 0.5) / 1024),
    }
  })
  // Consume the real cabinet transition on the device clock, then collect a
  // half-second frequency-resolving window. No assumption about device rate.
  await expect
    .poll(() => page.evaluate(() => window.__recordingAuditionProbe.serial))
    .toBeGreaterThanOrEqual(
      capture.marker + capture.settleBlocks + capture.windowBlocks,
    )
  const result = await page.evaluate((windowBlocks) => {
    const frames = window.__recordingAuditionProbe.frames.slice(-windowBlocks)
    const left = frames.flatMap((frame) => frame.left)
    const right = frames.flatMap((frame) => frame.right)
    const rate = frames[0].rate
    const rms = (samples: number[]) =>
      Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0) /
          samples.length,
      )
    const amplitude = (frequency: number) => {
      let real = 0,
        imaginary = 0,
        weights = 0
      for (let index = 0; index < left.length; index++) {
        const weight =
          0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (left.length - 1))
        const phase = (2 * Math.PI * frequency * index) / rate
        real += left[index] * weight * Math.cos(phase)
        imaginary += left[index] * weight * Math.sin(phase)
        weights += weight
      }
      return (2 * Math.hypot(real, imaginary)) / weights
    }
    return {
      leftRms: rms(left),
      rightRms: rms(right),
      stereoError: rms(left.map((sample, index) => sample - right[index])),
      spectrum: [
        110, 220, 330, 440, 550, 660, 770, 880, 990, 1100, 1320, 1540, 1760,
      ].map(amplitude),
      micCalls: window.__recordingAuditionProbe.micCalls,
    }
  }, capture.windowBlocks)
  expect(result.leftRms).toBeGreaterThan(0.0005)
  expect(result.rightRms / result.leftRms).toBeGreaterThan(0.98)
  expect(result.rightRms / result.leftRms).toBeLessThan(1.02)
  expect(result.stereoError).toBeLessThan(0.00001)
  expect(result.micCalls).toBe(0)
  await pause.click()
  return result
}

test('auditions original input and transcribed notes with clean/current/saved amps on both channels @smoke', async ({
  page,
}) => {
  test.setTimeout(60000)
  const errors: string[] = []
  const cabinetResponses: number[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (
      response.url().includes('cookie-monster') &&
      response.url().endsWith('.wav')
    )
      cabinetResponses.push(response.status())
  })
  await installAuditionProbe(page)
  await page.route('https://**/*', (route) => route.abort())
  await seedRecording(page)
  const review = page.getByRole('dialog').filter({ hasText: 'Recorded melody' })
  await expect(review).toBeVisible()
  const originalSettings = await page.evaluate(
    (key) => localStorage.getItem(key),
    AMP_KEY,
  )
  const cleanAudio = await measurePlayback(
    page,
    review,
    'Recording',
    'clean',
    true,
  )
  const wetAudio = await measurePlayback(
    page,
    review,
    'Recording',
    'current-amp',
    true,
  )
  const savedAudio = await measurePlayback(
    page,
    review,
    'Recording',
    'saved-amp',
    true,
  )
  expect(cleanAudio.spectrum[0]).toBeGreaterThan(cleanAudio.spectrum[1] * 10)
  const harmonicRatio = (spectrum: number[]) =>
    spectrum.slice(1, 8).reduce((sum, value) => sum + value, 0) / spectrum[0]
  expect(harmonicRatio(wetAudio.spectrum)).toBeGreaterThan(
    harmonicRatio(cleanAudio.spectrum) + 0.02,
  )
  expect(savedAudio.leftRms / wetAudio.leftRms).toBeLessThan(0.9)
  expect(savedAudio.leftRms / wetAudio.leftRms).toBeGreaterThan(0.2)
  expect(await page.evaluate((key) => localStorage.getItem(key), AMP_KEY)).toBe(
    originalSettings,
  )

  await review
    .getByRole('button', { name: 'Close Jam Doctor', exact: true })
    .click()
  // The compound deck has no native landmark role; its scoped test id keeps
  // source controls behind an open review from masquerading as deck controls.
  const deck = page.getByTestId('guitar-recorder-deck')
  await expect(
    deck.getByRole('button', { name: 'Playback tone', exact: true }),
  ).toHaveText('Saved')
  const cleanNotes = await measurePlayback(page, deck, 'Notes', 'clean', false)
  const wetNotes = await measurePlayback(
    page,
    deck,
    'Notes',
    'current-amp',
    false,
  )
  const savedNotes = await measurePlayback(
    page,
    deck,
    'Notes',
    'saved-amp',
    false,
  )
  expect(cleanNotes.spectrum[1]).toBeGreaterThan(cleanNotes.spectrum[0] * 10)
  const normalized = (spectrum: number[]) => {
    const total = spectrum.reduce((sum, value) => sum + value, 0)
    return spectrum.map((value) => value / total)
  }
  const cleanShape = normalized(cleanNotes.spectrum)
  const wetShape = normalized(wetNotes.spectrum)
  expect(
    cleanShape.reduce(
      (sum, value, index) => sum + Math.abs(value - wetShape[index]),
      0,
    ),
  ).toBeGreaterThan(0.05)
  expect(savedNotes.leftRms / wetNotes.leftRms).toBeLessThan(0.9)
  expect(savedNotes.leftRms / wetNotes.leftRms).toBeGreaterThan(0.2)
  expect(await page.evaluate((key) => localStorage.getItem(key), AMP_KEY)).toBe(
    originalSettings,
  )

  const liveBypassAudio = await measurePlayback(
    page,
    deck,
    'Recording',
    'current-amp',
    false,
    true,
    async () => {
      const starts = await page.evaluate(
        () => window.__recordingAuditionProbe.mediaPlayCalls,
      )
      await page
        .getByRole('button', { name: 'Session controls', exact: true })
        .click()
      const session = page.getByRole('dialog', { name: 'Session', exact: true })
      await session
        .getByRole('button', { name: 'Bypass guitar amp', exact: true })
        .click()
      await session
        .getByRole('button', { name: 'Close Session', exact: true })
        .click()
      await expect(
        deck.getByRole('button', {
          name: 'Pause recording replay',
          exact: true,
        }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => window.__recordingAuditionProbe.mediaPlayCalls,
        ),
      ).toBe(starts)
    },
  )
  expect(liveBypassAudio.leftRms / cleanAudio.leftRms).toBeGreaterThan(0.9)
  expect(liveBypassAudio.leftRms / cleanAudio.leftRms).toBeLessThan(1.1)
  expect(harmonicRatio(liveBypassAudio.spectrum)).toBeLessThan(0.06)
  const bypassSettings = await page.evaluate(
    (key) => localStorage.getItem(key),
    AMP_KEY,
  )
  const bypassAudio = await measurePlayback(
    page,
    deck,
    'Recording',
    'current-amp',
    false,
    true,
  )
  const bypassNotes = await measurePlayback(
    page,
    deck,
    'Notes',
    'current-amp',
    false,
    true,
  )
  expect(bypassAudio.leftRms / cleanAudio.leftRms).toBeGreaterThan(0.9)
  expect(bypassAudio.leftRms / cleanAudio.leftRms).toBeLessThan(1.1)
  expect(harmonicRatio(bypassAudio.spectrum)).toBeLessThan(0.06)
  expect(bypassNotes.spectrum[1]).toBeGreaterThan(bypassNotes.spectrum[0] * 10)
  const pcmReport = test
    .info()
    .outputPath('recording-and-notes-rendered-pcm.json')
  await writeFile(
    pcmReport,
    JSON.stringify(
      {
        cleanAudio,
        wetAudio,
        savedAudio,
        cleanNotes,
        wetNotes,
        savedNotes,
        liveBypassAudio,
        bypassAudio,
        bypassNotes,
      },
      null,
      2,
    ),
  )
  await test.info().attach('recording-and-notes-rendered-pcm', {
    contentType: 'application/json',
    path: pcmReport,
  })
  await deck.getByRole('button', { name: 'Playback tone', exact: true }).click()
  await page.getByTestId('overflow-saved-amp').click()
  await expect(
    deck.getByRole('button', { name: 'Playback tone', exact: true }),
  ).toHaveAttribute('title', 'Studio Lead · amp + cabinet')
  expect(await page.evaluate((key) => localStorage.getItem(key), AMP_KEY)).toBe(
    bypassSettings,
  )
  expect(JSON.parse(bypassSettings!).enabled).toBe(false)
  expect(cabinetResponses).toContain(200)
  expect(errors).toEqual([])
})
