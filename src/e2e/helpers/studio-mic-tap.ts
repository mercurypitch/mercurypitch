// Studio microphone tap for browser tests — every frame of each microphone source the page makes, recorded beside the take's own capture, and a kept take's original WAV read back, so a test can show a take is its input bit for bit.
import { Buffer } from 'node:buffer'
import type { Page } from '@playwright/test'

const RATE = 48_000

declare global {
  interface Window {
    __micTap?: {
      source: number
      frame: number
      channels: Float32Array[]
    }[]
  }
}

/**
 * Record, beside the take's own capture, every frame of each microphone
 * source the page makes: folded to mono as the capture folds a whole input
 * (capture-input.ts), or, with `sides`, each of a stereo input's channels
 * as it arrives, for a test that works out a lane's pick itself.
 */
export async function tapMicrophone(page: Page, sides = false): Promise<void> {
  await page.addInitScript((discrete: boolean) => {
    // Each process() call is the next quantum, and currentFrame only
    // corrects the count forward: it lags behind, five quanta at a time,
    // while the page holds the graph (pcm-capture.ts), and a tap stamped
    // with it lays those quanta over the ones before.
    const processor = `
      class E2eMicTap extends AudioWorkletProcessor {
        constructor() {
          super()
          this.frame = -1
        }
        process(inputs) {
          this.frame =
            this.frame < 0 ? currentFrame : Math.max(this.frame + 128, currentFrame)
          const channels = inputs[0]
          if (channels.length > 0)
            this.port.postMessage({
              frame: this.frame,
              channels: channels.map((channel) => channel.slice()),
            })
          return true
        }
      }
      registerProcessor('e2e-mic-tap', E2eMicTap)`
    const url = URL.createObjectURL(
      new Blob([processor], { type: 'application/javascript' }),
    )
    const chunks: NonNullable<Window['__micTap']> = []
    window.__micTap = chunks
    let sources = 0
    const create = AudioContext.prototype.createMediaStreamSource
    AudioContext.prototype.createMediaStreamSource = function (
      this: AudioContext,
      stream: MediaStream,
    ) {
      const source = create.call(this, stream)
      const index = ++sources
      void this.audioWorklet.addModule(url).then(() => {
        const tap = new AudioWorkletNode(this, 'e2e-mic-tap', {
          channelCount: discrete ? 2 : 1,
          channelCountMode: 'explicit',
          channelInterpretation: discrete ? 'discrete' : 'speakers',
        })
        const silent = this.createGain()
        silent.gain.value = 0
        tap.port.onmessage = (event) =>
          chunks.push({ source: index, ...event.data })
        source.connect(tap)
        tap.connect(silent).connect(this.destination)
      })
      return source
    }
  }, sides)
}

/** What the tap heard of each source the page made, in the order they were made: each channel from the source's first frame tapped. */
export async function tappedSources(page: Page): Promise<Float32Array[][]> {
  const encoded = await page.evaluate(() => {
    const chunks = window.__micTap ?? []
    if (chunks.length === 0)
      throw new Error('The microphone tap heard nothing.')
    const indices = [...new Set(chunks.map(({ source }) => source))].sort(
      (a, b) => a - b,
    )
    return indices.map((index) => {
      const own = chunks.filter(({ source }) => source === index)
      const first = own[0].frame
      const last = own[own.length - 1]
      const length = last.frame + last.channels[0].length - first
      return own[0].channels.map((_, channel) => {
        const out = new Float32Array(length)
        for (const { frame, channels } of own)
          out.set(channels[channel], frame - first)
        const bytes = new Uint8Array(out.buffer)
        let text = ''
        for (let i = 0; i < bytes.length; i += 0x8000)
          text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return btoa(text)
      })
    })
  })
  return encoded.map((channels) =>
    channels.map((base64) => {
      const bytes = Buffer.from(base64, 'base64')
      return new Float32Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      )
    }),
  )
}

/** Samples as a take keeps them (take-audio.ts `floatToPcm16`). */
export function pcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    out[i] = value < 0 ? Math.round(value * 0x8000) : Math.round(value * 0x7fff)
  }
  return out
}

/** The 16-bit samples of a WAV's data chunk. */
function wavSamples(bytes: Buffer): Int16Array {
  let at = 12
  while (at + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(at + 4)
    if (bytes.toString('ascii', at, at + 4) === 'data') {
      const data = bytes.subarray(at + 8, at + 8 + size)
      return new Int16Array(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
      )
    }
    at += 8 + size + (size % 2)
  }
  throw new Error('No data chunk in the WAV.')
}

/** The original WAV a recorded take was kept as, from the browser's storage. */
export async function takeSamples(
  page: Page,
  title: string,
): Promise<Int16Array> {
  const base64 = await page.evaluate(async (name) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('MercuryPitchDB')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const all = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = database
          .transaction(store, 'readonly')
          .objectStore(store)
          .getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error)
      })
    try {
      const assets = await all<{
        asset: {
          id: string
          originalName?: string
          provenance: { kind: string }
        }
      }>('studioAssets')
      const take = assets.find(
        ({ asset }) =>
          asset.provenance.kind === 'recording' &&
          asset.originalName?.startsWith(name) === true,
      )
      if (!take) throw new Error(`No take named ${name}.`)
      const blobs = await all<{ id: string; data: Blob | ArrayBuffer }>(
        'studioAssetBlobs',
      )
      const original = blobs.find(
        (row) => row.id === `${take.asset.id}-original`,
      )
      if (!original) throw new Error(`No original WAV for ${name}.`)
      const data =
        original.data instanceof Blob
          ? await original.data.arrayBuffer()
          : original.data
      const bytes = new Uint8Array(data)
      let text = ''
      for (let i = 0; i < bytes.length; i += 0x8000)
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(text)
    } finally {
      database.close()
    }
  }, title)
  return wavSamples(Buffer.from(base64, 'base64'))
}

/**
 * Where `take` sits in `heard`: the shift that puts 64 of its samples, from
 * its loudest moment in its second second, exactly on the tap's, or null.
 */
export function shiftBetween(
  heard: Int16Array,
  take: Int16Array,
): number | null {
  let at = RATE
  for (let i = RATE; i < 2 * RATE; i++)
    if (Math.abs(take[i]) > Math.abs(take[at])) at = i
  const needle = 64
  for (let i = 0; i + needle <= heard.length; i++) {
    let k = 0
    while (k < needle && heard[i + k] === take[at + k]) k++
    if (k === needle) return i - at
  }
  return null
}

/** How many of the take's samples the tap holds under `shift`, and how many of those differ. */
export function differing(heard: Int16Array, take: Int16Array, shift: number) {
  let compared = 0
  let differ = 0
  for (let j = 0; j < take.length; j++) {
    const i = j + shift
    if (i < 0 || i >= heard.length) continue
    compared++
    if (heard[i] !== take[j]) differ++
  }
  return { compared, differ }
}

/** Where `take` sits in what any tapped source heard of one pick, and how many of its samples differ there; null where none holds it. */
export function takeAgainstTap(
  heard: readonly Int16Array[],
  take: Int16Array,
): { source: number; shift: number; compared: number; differ: number } | null {
  for (const [source, samples] of heard.entries()) {
    const shift = shiftBetween(samples, take)
    if (shift !== null)
      return { source, shift, ...differing(samples, take, shift) }
  }
  return null
}
