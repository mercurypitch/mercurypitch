// Production worker integration exercises real self-hosted WASM/model inference without mic permission.
import { expect, test } from '@playwright/test'
import { readdir } from 'node:fs/promises'
import { encodeMonoPcmSamplesToWav } from '../lib/audio-buffer-wav'
import { createGuitarChordFixtures } from '../lib/guitar/recording-chord-fixtures'
import { BASIC_PITCH } from '../lib/transcription/basic-pitch-inference'
import type { GuitarRefinementMessage } from '../lib/transcription/guitar-recording-refinement'

async function workerAsset() {
  const files = await readdir('dist/assets')
  const workers = files.filter((name) =>
    /^guitar-refinement\.worker-[\w-]+\.js$/.test(name),
  )
  expect(workers).toHaveLength(1)
  return `/assets/${workers[0]}`
}

const fixture = createGuitarChordFixtures().find(
  (item) => item.id === 'power-chord',
)!
const audioBase64 = Buffer.from(
  encodeMonoPcmSamplesToWav(fixture.samples, fixture.sampleRate),
).toString('base64')

test('self-hosted lazy worker returns simultaneous chord pitches without starting any audio device @smoke', async ({
  page,
  context,
}) => {
  const requested: string[] = []
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    requested.push(url.pathname)
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort()
    if (url.pathname === '/refinement-worker-smoke')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Worker integration</title>',
      })
    return route.continue()
  })
  await page.goto('/refinement-worker-smoke')
  expect(
    requested.some(
      (path) => path.includes('basic-pitch') || path.endsWith('.wasm'),
    ),
  ).toBe(false)
  const result = await page.evaluate(
    async ({ workerUrl, audioBase64 }) => {
      let audioDeviceCalls = 0
      Object.defineProperty(window, 'AudioContext', {
        value: class {
          constructor() {
            audioDeviceCalls++
            throw new Error('Unexpected live context')
          }
        },
      })
      navigator.mediaDevices.getUserMedia = async () => {
        audioDeviceCalls++
        throw new Error('Unexpected microphone request')
      }
      const blob = new Blob([
        Uint8Array.from(atob(audioBase64), (value) => value.charCodeAt(0)),
      ])
      const messages: GuitarRefinementMessage[] = []
      let mainThreadTicks = 0
      const interval = setInterval(() => mainThreadTicks++, 10)
      const worker = new Worker(workerUrl, { type: 'module' })
      try {
        const final = await new Promise<GuitarRefinementMessage>(
          (resolve, reject) => {
            worker.onerror = (event) => reject(new Error(event.message))
            worker.onmessage = (
              event: MessageEvent<GuitarRefinementMessage>,
            ) => {
              messages.push(event.data)
              if (event.data.type !== 'progress') resolve(event.data)
            }
            worker.postMessage({ blob })
          },
        )
        return { final, messages, audioDeviceCalls, mainThreadTicks }
      } finally {
        clearInterval(interval)
        worker.terminate()
      }
    },
    { workerUrl: await workerAsset(), audioBase64 },
  )
  expect(result.final.type, JSON.stringify(result.final)).toBe('result')
  if (result.final.type !== 'result')
    throw new Error(JSON.stringify(result.final))
  const notes = result.final.result.notes.filter(
    (note) => note.startSeconds < 0.5 && note.endSeconds > 0.9,
  )
  expect(notes.map((note) => note.midi).sort((a, b) => a - b)).toEqual([
    40, 47, 52,
  ])
  expect(result.final.result).toMatchObject({
    duration: 1.5,
    modelSha256: BASIC_PITCH.modelSha256,
    decoderVersion: BASIC_PITCH.decoderVersion,
  })
  expect(
    notes.every(
      (note) =>
        Number.isFinite(note.confidence) &&
        note.confidence > 0 &&
        note.confidence <= 1,
    ),
  ).toBe(true)
  expect(result.audioDeviceCalls).toBe(0)
  expect(result.mainThreadTicks).toBeGreaterThan(0)
  expect(requested.filter((path) => path.endsWith('/nmp.onnx'))).toEqual([
    '/models/basic-pitch/nmp.onnx',
  ])
  expect(requested.filter((path) => path.endsWith('.wasm'))).toHaveLength(1)
  expect(
    result.messages
      .filter((message) => message.type === 'progress')
      .map((message) => message.progress),
  ).toEqual([
    { stage: 'decoding', fraction: 0 },
    { stage: 'decoding', fraction: 2 / 3 },
    { stage: 'decoding', fraction: 1 },
    { stage: 'loading', fraction: 0 },
    { stage: 'loading', fraction: 1 },
    { stage: 'analysing', fraction: 0 },
    { stage: 'analysing', fraction: 1 },
  ])
})

test('rejects a corrupt self-hosted model before WASM inference can return partial notes', async ({
  page,
  context,
}) => {
  const wasm: string[] = []
  await context.route('**/models/basic-pitch/nmp.onnx', (route) =>
    route.fulfill({
      body: Buffer.alloc(BASIC_PITCH.modelBytes),
      contentType: 'application/octet-stream',
    }),
  )
  context.on('request', (request) => {
    if (request.url().endsWith('.wasm')) wasm.push(request.url())
  })
  await page.route('**/refinement-worker-smoke', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Worker failure</title>',
    }),
  )
  await page.goto('/refinement-worker-smoke')
  const message = await page.evaluate(
    async ({ workerUrl, audioBase64 }) => {
      const worker = new Worker(workerUrl, { type: 'module' })
      try {
        return await new Promise<GuitarRefinementMessage>((resolve, reject) => {
          worker.onerror = (event) => reject(new Error(event.message))
          worker.onmessage = ({
            data,
          }: MessageEvent<GuitarRefinementMessage>) => {
            if (data.type !== 'progress') resolve(data)
          }
          worker.postMessage({
            blob: new Blob([
              Uint8Array.from(atob(audioBase64), (value) =>
                value.charCodeAt(0),
              ),
            ]),
          })
        })
      } finally {
        worker.terminate()
      }
    },
    { workerUrl: await workerAsset(), audioBase64 },
  )
  expect(message).toEqual({
    type: 'error',
    message: 'Chord model checksum differs from the audited artifact.',
  })
  expect(wasm).toEqual([])
})

test('terminates a worker while its model download is still pending', async ({
  page,
  context,
}) => {
  const requested = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  await context.route('**/models/basic-pitch/nmp.onnx', async (route) => {
    requested.resolve()
    await release.promise
    await route.abort()
  })
  await page.route('**/refinement-worker-smoke', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Worker cancellation</title>',
    }),
  )
  await page.goto('/refinement-worker-smoke')
  const created = page.waitForEvent('worker')
  await page.evaluate(
    ({ workerUrl, audioBase64 }) => {
      const worker = new Worker(workerUrl, { type: 'module' })
      Object.assign(window, {
        refinementWorker: worker,
        refinementResults: [] as GuitarRefinementMessage[],
      })
      worker.onmessage = ({ data }: MessageEvent<GuitarRefinementMessage>) => {
        if (data.type !== 'progress')
          (
            window as unknown as {
              refinementResults: GuitarRefinementMessage[]
            }
          ).refinementResults.push(data)
      }
      worker.postMessage({
        blob: new Blob([
          Uint8Array.from(atob(audioBase64), (value) => value.charCodeAt(0)),
        ]),
      })
    },
    { workerUrl: await workerAsset(), audioBase64 },
  )
  const worker = await created
  try {
    await requested.promise
    const closed = worker.waitForEvent('close')
    await page.evaluate(() =>
      (
        window as unknown as { refinementWorker: Worker }
      ).refinementWorker.terminate(),
    )
    await closed
    expect(
      await page.evaluate(
        () =>
          (
            window as unknown as {
              refinementResults: GuitarRefinementMessage[]
            }
          ).refinementResults,
      ),
    ).toEqual([])
  } finally {
    release.resolve()
  }
})
