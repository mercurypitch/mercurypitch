// ============================================================
// AirPlay sound check: which way of making sound a TV on AirPlay plays
// ============================================================
//
// Over AirPlay to the owner's LG C2 the Karaoke room's sound reached
// neither the TV nor the phone, while the TV showed the song's Now Playing
// card (3 Nov 2026): on an iPhone 13 Pro, whose app session never saw
// AirPlay, and on an iPhone 11, whose did. The room makes its sound one way
// only, Web Audio beside a silent element kept local, often with the mic
// open, so a Karaoke test cannot say which part AirPlay refuses. This plays
// five ways, each with its own number of beeps, so the owner can say which
// ones the TV played:
//
//   1  a plain <audio> of a generated WAV, allowed on AirPlay
//   2  the same element kept local (local-media.ts), as the carrier is
//   3  Web Audio alone: a buffer source in a fresh AudioContext
//   4  Web Audio while a silent element kept local plays, as the Karaoke
//      room plays beside the lock screen's carrier
//   5  Web Audio with the microphone open, as when singing is scored
//
// Each tap writes one info line, which the console keeps with routine logs
// left out:
//
//   [airplay check] 3 Web Audio alone: route=airplay sessionRate=44100 contextRate=44100 pageSession=auto state=running
//
// with the element's word (`element=playing`) and the mic's (`mic=open`)
// where they take part, and no port's name. Each is torn down whole once
// its beeps have had time to reach a TV, which plays AirPlay about two
// seconds late: the context closed, the mic let go, the element emptied and
// its URL revoked. Everything that must start inside the tap (an element's
// play, a context's resume) is called before the first await.
//
// Developer only: AirPlayCheckPanel.tsx is registered behind
// VITE_PORTABLE_CONSOLE through a dynamic import (main.tsx).

import { encodeMonoPcmSamplesToWav } from '@/lib/audio-buffer-wav'
import { keepMediaLocal } from '@/lib/local-media'
import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import { nativeDeviceApi } from '@/stores/native-shell-store'

export type CheckVariant = 1 | 2 | 3 | 4 | 5

/** A variant as the Developer screen offers it. */
export interface CheckVariantInfo {
  readonly n: CheckVariant
  /** What it plays through, for the line and the button. */
  readonly title: string
  /** What the room does that it stands for. */
  readonly sub: string
}

export const CHECK_VARIANTS: readonly CheckVariantInfo[] = [
  {
    n: 1,
    title: 'Media element',
    sub: 'An <audio> element, allowed on AirPlay.',
  },
  {
    n: 2,
    title: 'Media element kept local',
    sub: 'The same, kept off AirPlay, as the lock screen’s carrier is.',
  },
  { n: 3, title: 'Web Audio alone', sub: 'A fresh AudioContext.' },
  {
    n: 4,
    title: 'Web Audio beside a silent element',
    sub: 'As the Karaoke room plays beside its carrier.',
  },
  {
    n: 5,
    title: 'Web Audio with the mic open',
    sub: 'As when singing is scored.',
  },
]

/** The beeps: A5, short, a step apart, after a moment of silence. */
export const BEEP_HZ = 880
export const BEEP_S = 0.16
export const BEEP_STEP_S = 0.36
const BEEP_EDGE_S = 0.012
const BEEP_LEVEL = 0.3
const LEAD_S = 0.3
const TAIL_S = 0.3
/** The rate of the generated WAVs; an element plays it at its own. */
export const WAV_RATE = 44_100
/** How long a check stays up after its beeps: AirPlay plays ~2 s late. */
export const HOLD_MS = 3000
/** The mic's name with the mic manager, and its indicator's. */
export const CHECK_MIC_ID = 'airplay-check'

/** How long a check with `count` beeps sounds, in seconds. */
export function beepSeconds(count: number): number {
  return LEAD_S + count * BEEP_STEP_S + TAIL_S
}

/** `count` beeps, each with soft (raised-cosine) edges, as samples. */
export function beepSamples(
  count: number,
  sampleRate: number,
): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(beepSeconds(count) * sampleRate))
  const frames = Math.round(BEEP_S * sampleRate)
  const edge = Math.max(1, Math.round(BEEP_EDGE_S * sampleRate))
  for (let beep = 0; beep < count; beep += 1) {
    const start = Math.round((LEAD_S + beep * BEEP_STEP_S) * sampleRate)
    for (let i = 0; i < frames; i += 1) {
      const ramp = Math.min(1, i / edge, (frames - 1 - i) / edge)
      const shape = 0.5 - 0.5 * Math.cos(Math.PI * ramp)
      const phase = (2 * Math.PI * BEEP_HZ * i) / sampleRate
      samples[start + i] = BEEP_LEVEL * shape * Math.sin(phase)
    }
  }
  return samples
}

/** What a check reaches: the page and the phone, or a test's stand-ins. */
export interface CheckHost {
  readonly makeContext: () => AudioContext | null
  readonly makeElement: () => HTMLAudioElement
  /** Open the mic as singing does; resolves with the release. */
  readonly openMic: () => Promise<() => void>
  readonly readOutput: () => Promise<NativeAudioOutputReading | null>
  /** `navigator.audioSession.type`, or 'none'. */
  readonly pageSession: () => string
  readonly makeUrl: (blob: Blob) => string
  readonly dropUrl: (url: string) => void
  readonly wait: (ms: number) => Promise<void>
  readonly say: (line: string) => void
}

/** The phone and the page, as a test build has them. */
export function browserHost(): CheckHost {
  return {
    makeContext: () => {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      return Ctor === undefined ? null : new Ctor()
    },
    makeElement: () => document.createElement('audio'),
    openMic: async () => {
      await micManager.acquire(CHECK_MIC_ID)
      const unregister = registerMicIndicator(CHECK_MIC_ID, () => true)
      return () => {
        unregister()
        micManager.release(CHECK_MIC_ID)
      }
    },
    readOutput: async () =>
      (await nativeDeviceApi()
        ?.audioOutput?.read()
        .catch(() => null)) ?? null,
    pageSession: () => {
      const session = (navigator as { audioSession?: { type?: unknown } })
        .audioSession
      return typeof session?.type === 'string' ? session.type : 'none'
    },
    makeUrl: (blob) => URL.createObjectURL(blob),
    dropUrl: (url) => {
      URL.revokeObjectURL(url)
    },
    wait: async (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms)
      }),
    say: (line) => {
      console.info(line)
    },
  }
}

/** Everything one check holds, so that all of it is let go. */
interface Run {
  readonly n: CheckVariant
  element: HTMLAudioElement | null
  url: string | null
  played: Promise<string> | null
  context: AudioContext | null
  resumed: Promise<void> | null
  source: AudioBufferSourceNode | null
  releaseMic: (() => void) | null
}

const nameOf = (error: unknown): string =>
  error instanceof Error || error instanceof DOMException
    ? error.name
    : String(error)

/** A WAV of `samples` at WAV_RATE, as a blob. */
const wavBlob = (samples: Float32Array): Blob =>
  new Blob([encodeMonoPcmSamplesToWav(samples, WAV_RATE)], {
    type: 'audio/wav',
  })

/** Variants 1, 2 and 4: the element, started inside the tap. */
function startElement(run: Run, host: CheckHost): void {
  const beeps = run.n !== 4
  const samples = beeps
    ? beepSamples(run.n, WAV_RATE)
    : new Float32Array(Math.ceil(beepSeconds(run.n) * WAV_RATE))
  const element = host.makeElement()
  if (run.n !== 1) keepMediaLocal(element)
  element.loop = !beeps
  run.url = host.makeUrl(wavBlob(samples))
  element.src = run.url
  run.element = element
  run.played = Promise.resolve(element.play()).then(
    () => 'playing',
    (error: unknown) => `refused:${nameOf(error)}`,
  )
}

/** Variants 3 to 5: the context, made and resumed inside the tap. */
function startContext(run: Run, host: CheckHost): void {
  const context = host.makeContext()
  run.context = context
  run.resumed =
    context === null ? null : Promise.resolve(context.resume()).catch(() => {})
}

/** The beeps on the context, a moment from now. */
function beepOn(run: Run): void {
  const context = run.context
  if (context === null) return
  const samples = beepSamples(run.n, context.sampleRate)
  const buffer = context.createBuffer(1, samples.length, context.sampleRate)
  buffer.copyToChannel(samples, 0)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.start(context.currentTime + 0.05)
  run.source = source
}

/** The mic, for variant 5: its word for the line. */
async function openMic(run: Run, host: CheckHost): Promise<string> {
  try {
    run.releaseMic = await host.openMic()
    return 'open'
  } catch (error) {
    return `refused:${nameOf(error)}`
  }
}

const rateOf = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value))
    : 'unknown'

/** The one line a check writes: the variant, where the sound goes, and how. */
export function checkLine(
  n: CheckVariant,
  reading: NativeAudioOutputReading | null,
  facts: {
    readonly context: AudioContext | null
    readonly pageSession: string
    readonly element: string
    readonly mic: string
  },
): string {
  const title = CHECK_VARIANTS[n - 1]?.title ?? ''
  const words = [
    `route=${reading?.route ?? 'unknown'}`,
    `sessionRate=${rateOf(reading?.detail.sampleRate)}`,
    `contextRate=${facts.context === null ? 'none' : rateOf(facts.context.sampleRate)}`,
    `pageSession=${facts.pageSession}`,
    `state=${facts.context === null ? 'none' : String(facts.context.state)}`,
  ]
  if (facts.element !== '') words.push(`element=${facts.element}`)
  if (facts.mic !== '') words.push(`mic=${facts.mic}`)
  return `[airplay check] ${String(n)} ${title}: ${words.join(' ')}`
}

/** Let go of everything the check holds. Never throws. */
async function tearDown(run: Run, host: CheckHost): Promise<void> {
  try {
    run.source?.stop()
  } catch {
    // Already stopped.
  }
  run.source?.disconnect()
  await run.context?.close().catch(() => undefined)
  run.releaseMic?.()
  if (run.element !== null) {
    run.element.pause()
    run.element.removeAttribute('src')
    run.element.load()
  }
  if (run.url !== null) host.dropUrl(run.url)
}

/** After the starts: the mic, the beeps, the line, the hold, the teardown. */
async function finish(run: Run, host: CheckHost): Promise<void> {
  try {
    const element = (await run.played) ?? ''
    const mic = run.n === 5 ? await openMic(run, host) : ''
    await run.resumed
    beepOn(run)
    const reading = await host.readOutput().catch(() => null)
    host.say(
      checkLine(run.n, reading, {
        context: run.context,
        pageSession: host.pageSession(),
        element,
        mic,
      }),
    )
    await host.wait(beepSeconds(run.n) * 1000 + HOLD_MS)
  } finally {
    await tearDown(run, host)
  }
}

/**
 * Play variant `n`, from inside the tap: its element's play and its
 * context's resume are called before this returns. Settles once it is torn
 * down.
 */
export function runCheck(
  n: CheckVariant,
  host: CheckHost = browserHost(),
): Promise<void> {
  const run: Run = {
    n,
    element: null,
    url: null,
    played: null,
    context: null,
    resumed: null,
    source: null,
    releaseMic: null,
  }
  if (n !== 3 && n !== 5) startElement(run, host)
  if (n >= 3) startContext(run, host)
  return finish(run, host)
}
