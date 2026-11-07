// ============================================================
// Studio recorder test harness — the recorder on fake clocks, captures, monitors and a graph that records its wiring
// ============================================================
//
// One harness for the recorder's suites (studio-recorder.test.ts and its
// channel suite), so each case says only what it changes. The fake context
// can split a source into channels (input-channels.ts) and records every
// edge, and the harness keeps the node each capture and the monitor were
// given, so a case can say what a take hears.
import { vi } from 'vitest'
import type { StudioCaptureEvents } from './capture-node'
import type { StudioRecordSettings } from './record-settings'
import { DEFAULT_STUDIO_RECORD_SETTINGS } from './record-settings'
import type { StudioCapturedTake, StudioRecorderDeps, StudioRecorderView, } from './studio-recorder'
import { createStudioRecorder } from './studio-recorder'

export const RATE = 48000

/** A node of the fake graph: its edges as `[to, output, input]`, and whether it was let go. */
export interface FakeGraphNode {
  readonly name: string
  readonly edges: [FakeGraphNode, number | undefined, number | undefined][]
  channelCount: number
  channelCountMode: ChannelCountMode
  channelInterpretation: ChannelInterpretation
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

export function fakeGraphNode(name: string): FakeGraphNode {
  const node: FakeGraphNode = {
    name,
    edges: [],
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
    connect: vi.fn((to: FakeGraphNode, output?: number, input?: number) => {
      node.edges.push([to, output, input])
      return to
    }),
    disconnect: vi.fn(),
  }
  return node
}

export function harness(
  over: Partial<StudioRecorderDeps> = {},
  settings: Partial<StudioRecordSettings> = {},
) {
  const splitters: FakeGraphNode[] = []
  const gains: FakeGraphNode[] = []
  const ctx = {
    currentTime: 1,
    sampleRate: RATE,
    state: 'running',
    baseLatency: 0.01,
    outputLatency: 0.02,
    destination: fakeGraphNode('destination'),
    createChannelSplitter: vi.fn((count: number) => {
      const splitter = fakeGraphNode(`splitter:${count}`)
      splitters.push(splitter)
      return splitter
    }),
    createGain: vi.fn(() => {
      const gain = fakeGraphNode('gain')
      gains.push(gain)
      return gain
    }),
  }
  const events: StudioCaptureEvents[] = []
  const captures: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[] = []
  /** The node each capture listened to, in order. */
  const captureInputs: AudioNode[] = []
  /** The node each monitor listened to, in order. */
  const monitorInputs: AudioNode[] = []
  const clicks = { schedule: vi.fn(), stop: vi.fn() }
  const monitor = { set: vi.fn(), dispose: vi.fn() }
  const transport = {
    playing: vi.fn(() => false),
    playheadFrame: vi.fn(() => 96000),
    canPlay: vi.fn(() => true),
    play: vi.fn(async () => true),
    pause: vi.fn(),
    anchor: vi.fn((): { frame: number; time: number } | null => null),
  }
  const journal = {
    begin: vi.fn(async () => undefined),
    place: vi.fn(async () => undefined),
    append: vi.fn(
      async (
        _id: string,
        _sequence: number,
        _firstFrame: number,
        _pcm: Int16Array,
      ) => undefined,
    ),
    discard: vi.fn(async () => undefined),
  }
  const views: StudioRecorderView[] = []
  const kept: StudioCapturedTake[] = []
  const releaseMemory = vi.fn()
  const source = fakeGraphNode('source')
  /** The hold's own release: the one way the recorder gives the microphone back. */
  const releaseMic = vi.fn()
  const deps: StudioRecorderDeps = {
    unlock: vi.fn(async () => true),
    clock: () => ctx as unknown as AudioContext,
    acquireMic: vi.fn(async () => ({
      stream: {} as MediaStream,
      release: releaseMic,
    })),
    prepareWorklet: vi.fn(async () => undefined),
    openCapture: vi.fn((_context, input, handlers) => {
      events.push(handlers)
      captureInputs.push(input)
      const capture = { start: vi.fn(), stop: vi.fn(), dispose: vi.fn() }
      captures.push(capture)
      return capture
    }),
    createSource: () => source as unknown as AudioNode,
    createClicks: () => clicks,
    createMonitor: (_context, input) => {
      monitorInputs.push(input)
      return monitor
    },
    monitorLevel: () => ({ on: false, gain: 1, pan: 0 }),
    transport,
    settings: () => ({
      ...DEFAULT_STUDIO_RECORD_SETTINGS,
      countInBars: 1,
      click: false,
      monitor: false,
      offsetMs: 0,
      ...settings,
    }),
    tempoBpm: () => 120,
    roundTrip: () => 0.05,
    reserveMemory: vi.fn(() => releaseMemory),
    journal,
    keep: vi.fn(async (take: StudioCapturedTake) => {
      kept.push(take)
      return true
    }),
    title: () => 'Take 1',
    createId: () => 'take-1',
    describeError: (error) =>
      `described ${(error as { kind?: string }).kind ?? String(error)}`,
    onChange: (view) => views.push(view),
    ...over,
  }
  const recorder = createStudioRecorder(deps)
  return {
    ctx,
    deps,
    recorder,
    transport,
    clicks,
    monitor,
    journal,
    kept,
    releaseMemory,
    releaseMic,
    captures,
    source,
    splitters,
    gains,
    captureInputs,
    monitorInputs,
    /** The newest capture's worklet messages. */
    get worklet() {
      return events[events.length - 1]
    },
    get capture() {
      return captures[captures.length - 1]
    },
    view: () => recorder.view(),
    /** A pooled buffer holding `frames` samples of `value`. */
    chunk(firstFrame: number, frames: number, value = 0.25) {
      const buffer = new ArrayBuffer(4096 * 4)
      new Float32Array(buffer, 0, frames).fill(value)
      this.worklet.chunk(firstFrame, frames, buffer)
    },
  }
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
