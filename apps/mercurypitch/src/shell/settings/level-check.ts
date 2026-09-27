// ============================================================
// Level check — the Microphone screen's live peak meter
// ============================================================
//
// S6 7a. Opens the shared microphone through micManager, so a room that
// already holds it shares the one device, reads the level every frame, and
// keeps the loudest peak of the last moment on show, the way a mixer's meter
// holds one. It also reads what the phone says about the input: its name,
// its rate and how many channels. Nothing is recorded: each frame is read
// and dropped.
//
// A refused microphone is named as refused, so the screen can send the
// singer to the one place that changes it (7c). Anything else that stops it
// opening is named as unavailable.
//
// Everything Web Audio sits behind `LevelCheckDeps`, so the tests drive it
// with a fake stream and a fake analyser.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import { micLevelFraction, rmsOfTimeData } from '@/lib/mic-level'
import { micManager } from '@/lib/mic-manager'

export type LevelCheckState =
  | 'idle'
  | 'opening'
  | 'live'
  | 'denied'
  | 'unavailable'

/** What the phone says about the input in use. */
export interface InputFacts {
  label: string
  sampleRate: number | null
  channels: number | null
}

/** The floor of the meter and of the peak readout, in dB below full scale. */
export const FLOOR_DB = -60
/** How long a peak stays on show before a quieter one may replace it. */
export const PEAK_HOLD_MS = 1500

const OWNER = 'settings-level-check'
const FFT_SIZE = 2048

interface AnalyserLike {
  fftSize: number
  getFloatTimeDomainData: (buffer: Float32Array<ArrayBuffer>) => void
}

interface SourceLike {
  connect: (node: AnalyserLike) => unknown
  disconnect: () => void
}

interface ContextLike {
  sampleRate: number
  resume?: () => Promise<void>
  close: () => Promise<void>
  createMediaStreamSource: (stream: MediaStream) => SourceLike
  createAnalyser: () => AnalyserLike
}

export interface LevelCheckDeps {
  acquire: (owner: string) => Promise<MediaStream>
  release: (owner: string) => void
  createContext: () => ContextLike
  frame: (callback: () => void) => number
  cancelFrame: (id: number) => void
  now: () => number
}

export interface LevelCheck {
  state: Accessor<LevelCheckState>
  input: Accessor<InputFacts | null>
  /** The held peak, in whole dB below full scale. */
  peak: Accessor<number>
  /** How full the meter is, 0 to 1. */
  level: Accessor<number>
  /** The last frame's level as linear RMS, for auto-calibrate. */
  rms: () => number
  start: () => Promise<void>
  stop: () => void
}

// The last input this phone heard, for the Settings row: its name once one
// opened, 'denied' once one was refused, null before either this session.
const [known, setKnown] = createSignal<InputFacts | 'denied' | null>(null)

export const knownInput = known

/** Tests: nothing heard yet. */
export function resetKnownInput(): void {
  setKnown(null)
}

/** The loudest sample of a frame, in dB below full scale, floored. */
export function peakDb(samples: Float32Array): number {
  let peak = 0
  for (const sample of samples) {
    const size = Math.abs(sample)
    if (size > peak) peak = size
  }
  return peak <= 0 ? FLOOR_DB : Math.max(FLOOR_DB, 20 * Math.log10(peak))
}

function signed(value: number): string {
  return value < 0 ? `−${-value}` : `${value}`
}

/** "Peak −9 dB", with a true minus sign, as 7a writes it. */
export function peakText(db: number): string {
  const whole = Math.round(db)
  if (whole <= FLOOR_DB) return `Peak below ${signed(FLOOR_DB)} dB`
  return `Peak ${signed(whole)} dB`
}

/** The meter's name for a screen reader. */
export function peakLabel(db: number): string {
  const whole = Math.round(db)
  if (whole <= FLOOR_DB) return `Input level, below minus ${-FLOOR_DB} decibels`
  const said = whole < 0 ? `minus ${-whole}` : `${whole}`
  return `Input level, peaking at ${said} decibels`
}

/** "48 kHz · mono · access allowed": what is known, in 7a's order. */
export function inputLine(facts: InputFacts): string {
  const parts: string[] = []
  if (facts.sampleRate !== null) {
    parts.push(`${Number((facts.sampleRate / 1000).toFixed(1))} kHz`)
  }
  if (facts.channels === 1) parts.push('mono')
  else if (facts.channels !== null && facts.channels > 1) parts.push('stereo')
  parts.push('access allowed')
  return parts.join(' · ')
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && value > 0 ? value : null
}

function factsOf(stream: MediaStream, contextRate: number): InputFacts {
  const track = stream.getAudioTracks()[0]
  const settings = track?.getSettings() ?? {}
  const label = track?.label.trim() ?? ''
  return {
    label: label === '' ? 'Microphone' : label,
    sampleRate: positive(settings.sampleRate) ?? positive(contextRate),
    channels: positive(settings.channelCount),
  }
}

/** The real AudioContext, narrowed to the four things the check uses. */
function browserContext(): ContextLike {
  const audio = new AudioContext()
  return {
    sampleRate: audio.sampleRate,
    resume: () => audio.resume(),
    close: () => audio.close(),
    createMediaStreamSource: (stream) => {
      const node = audio.createMediaStreamSource(stream)
      return {
        connect: (analyser) => node.connect(analyser as AnalyserNode),
        disconnect: () => {
          node.disconnect()
        },
      }
    },
    createAnalyser: () => audio.createAnalyser(),
  }
}

function browserDeps(): LevelCheckDeps {
  return {
    acquire: (owner) => micManager.acquire(owner),
    release: (owner) => {
      micManager.release(owner)
    },
    createContext: browserContext,
    frame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => {
      cancelAnimationFrame(id)
    },
    now: () => performance.now(),
  }
}

export function createLevelCheck(
  deps: LevelCheckDeps = browserDeps(),
): LevelCheck {
  const [state, setState] = createSignal<LevelCheckState>('idle')
  const [input, setInput] = createSignal<InputFacts | null>(null)
  const [peak, setPeak] = createSignal(FLOOR_DB)
  const [level, setLevel] = createSignal(0)

  let context: ContextLike | null = null
  let source: SourceLike | null = null
  let analyser: AnalyserLike | null = null
  let buffer: Float32Array<ArrayBuffer> | null = null
  let frameId: number | null = null
  let holdsMic = false
  let held = FLOOR_DB
  let heldAt = Number.NEGATIVE_INFINITY
  let lastRms = 0
  // Bumped by every stop, so an open that lands after one hands back what
  // it opened instead of starting a meter nobody is looking at.
  let generation = 0

  function tick(): void {
    frameId = null
    if (analyser === null || buffer === null) return
    analyser.getFloatTimeDomainData(buffer)
    lastRms = rmsOfTimeData(buffer)
    const now = deps.now()
    const framePeak = peakDb(buffer)
    if (framePeak >= held || now - heldAt > PEAK_HOLD_MS) {
      held = framePeak
      heldAt = now
    }
    setPeak(Math.round(held))
    setLevel(Math.round(micLevelFraction(lastRms, FLOOR_DB) * 100) / 100)
    frameId = deps.frame(tick)
  }

  function teardown(): void {
    if (frameId !== null) {
      deps.cancelFrame(frameId)
      frameId = null
    }
    source?.disconnect()
    source = null
    analyser = null
    buffer = null
    if (context !== null) {
      void context.close().catch(() => undefined)
      context = null
    }
    if (holdsMic) {
      holdsMic = false
      deps.release(OWNER)
    }
  }

  async function start(): Promise<void> {
    if (state() === 'opening' || state() === 'live') return
    generation += 1
    const mine = generation
    setState('opening')
    // Made before the wait for the device, while the tap that asked for it
    // still counts: a context made after an await can start suspended.
    const audio = deps.createContext()
    context = audio
    void audio.resume?.().catch(() => undefined)

    let stream: MediaStream
    try {
      stream = await deps.acquire(OWNER)
    } catch (err) {
      if (mine !== generation) return
      teardown()
      const kind = (err as { kind?: string } | null)?.kind
      if (kind === 'permission-denied') {
        setState('denied')
        setKnown('denied')
      } else {
        setState('unavailable')
      }
      return
    }
    if (mine !== generation) {
      deps.release(OWNER)
      return
    }
    holdsMic = true

    source = audio.createMediaStreamSource(stream)
    analyser = audio.createAnalyser()
    analyser.fftSize = FFT_SIZE
    source.connect(analyser)
    buffer = new Float32Array(analyser.fftSize)
    held = FLOOR_DB
    heldAt = Number.NEGATIVE_INFINITY

    const facts = factsOf(stream, audio.sampleRate)
    setInput(facts)
    setKnown(facts)
    setState('live')
    frameId = deps.frame(tick)
  }

  function stop(): void {
    generation += 1
    teardown()
    if (state() === 'opening' || state() === 'live') setState('idle')
    lastRms = 0
    setPeak(FLOOR_DB)
    setLevel(0)
  }

  return { state, input, peak, level, rms: () => lastRms, start, stop }
}
