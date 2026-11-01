// ============================================================
// Studio capture node — the recorder worklet on the Studio's clock: its module, its buffer pool, its messages and its teardown
// ============================================================
//
// The worklet runs in the Studio's own context (web-audio-lease.ts), the one
// the song plays on, so a take and the song share one clock and a frame of
// one is a frame of the other. A microphone track at another rate (44.1 kHz
// is common) is resampled by the MediaStreamAudioSourceNode on the way in:
// measured feeding an AudioWorklet in a 48 kHz context in headless Chromium
// 148, Firefox 150 and WebKitGTK 2.54, a 1 kHz tone from a 44.1 kHz track
// came through at 1 kHz with its level.
//
// The node feeds a silent gain into the destination, as the guitar recorder
// does, so every engine keeps pulling it; it adds nothing to what is heard.
// A stereo input is folded to mono ('speakers'), so a microphone on either
// side of an interface is heard.
import workletUrl from '@/workers/studio-recorder.worklet.ts?worker&url'
import type { StudioCaptureMessage, StudioCaptureStop } from './pcm-capture'
import { STUDIO_CAPTURE_CHUNK_FRAMES, STUDIO_CAPTURE_POOL } from './pcm-capture'

const registered = new WeakMap<BaseAudioContext, Promise<void>>()

/** Load the recorder module into this clock once. */
export async function prepareStudioRecorderWorklet(
  context: AudioContext,
): Promise<void> {
  if (typeof context.audioWorklet?.addModule !== 'function')
    throw new Error("This browser can't record in Studio.")
  let module = registered.get(context)
  if (module === undefined) {
    module = context.audioWorklet.addModule(workletUrl).catch((error) => {
      registered.delete(context)
      throw error
    })
    registered.set(context, module)
  }
  await module
}

export interface StudioCaptureEvents {
  level(peak: number, frame: number): void
  started(frame: number): void
  chunk(firstFrame: number, frames: number, buffer: ArrayBuffer): void
  stopped(frames: number, reason: StudioCaptureStop): void
}

export interface StudioCaptureHandle {
  /** Copy from clock frame `atFrame`, at most `maxFrames` frames. */
  start(atFrame: number, maxFrames: number): void
  /** Stop before clock frame `atFrame`, or now for null. */
  stop(atFrame: number | null, reason: StudioCaptureStop): void
  dispose(): void
}

function recorderNode(context: AudioContext): AudioWorkletNode {
  return new AudioWorkletNode(context, 'studio-recorder', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  })
}

/** The worklet listening to `input` on `context`, its pool handed over. */
export function openStudioCapture(
  context: AudioContext,
  input: AudioNode,
  events: StudioCaptureEvents,
  makeNode: (context: AudioContext) => AudioWorkletNode = recorderNode,
): StudioCaptureHandle {
  const node = makeNode(context)
  const silence = context.createGain()
  silence.gain.value = 0
  input.connect(node)
  node.connect(silence)
  silence.connect(context.destination)
  const hand = () => {
    const buffer = new ArrayBuffer(STUDIO_CAPTURE_CHUNK_FRAMES * 4)
    node.port.postMessage({ type: 'buffer', buffer }, [buffer])
  }
  for (let i = 0; i < STUDIO_CAPTURE_POOL; i++) hand()
  let disposed = false
  node.port.onmessage = (event: MessageEvent<StudioCaptureMessage>) => {
    if (disposed) return
    const message = event.data
    switch (message.type) {
      case 'level':
        events.level(message.peak, message.frame)
        return
      case 'started':
        events.started(message.frame)
        return
      case 'pcm':
        // The worklet keeps a full pool: one back for every one it hands over.
        hand()
        events.chunk(message.firstFrame, message.frames, message.buffer)
        return
      case 'stopped':
        events.stopped(message.frames, message.reason)
    }
  }
  return {
    start(atFrame, maxFrames) {
      if (!disposed)
        node.port.postMessage({ type: 'start', atFrame, maxFrames })
    },
    stop(atFrame, reason) {
      if (!disposed) node.port.postMessage({ type: 'stop', atFrame, reason })
    },
    dispose() {
      if (disposed) return
      disposed = true
      node.port.onmessage = null
      try {
        input.disconnect(node)
      } catch {
        // Already apart.
      }
      node.disconnect()
      silence.disconnect()
    },
  }
}
