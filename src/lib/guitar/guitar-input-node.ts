// Getting the input worklet into a live graph, or admitting it could not be.
// ============================================================
//
// Two things here are less obvious than they look.
//
// The worklet is loaded from a bundled URL rather than written inline, so the
// detector the tests cover is literally the code that ships. If that load
// fails — an old browser, a blocked asset — this returns null rather than
// throwing, because the room has a working coarser path to fall back to and
// losing the fine timestamps is much better than losing the microphone.
//
// The silent gain is not decoration. A node with no path to a destination is
// not pulled by the audio graph at all, so a worklet wired only to the
// microphone would simply never run.

import workletUrl from '@/workers/guitar-input.worklet.ts?worker&url'
import type { GuitarInputWorkletMessage } from './input-events'

const GUITAR_INPUT_PROCESSOR = 'guitar-input-processor'

/** Contexts whose module registry already has the processor in it. */
const registered = new WeakSet<BaseAudioContext>()

export interface GuitarInputTap {
  dispose(): void
}

export async function connectGuitarInputWorklet(
  context: AudioContext,
  source: AudioNode,
  onMessage: (message: GuitarInputWorkletMessage) => void,
): Promise<GuitarInputTap | null> {
  if (typeof context.audioWorklet?.addModule !== 'function') return null

  try {
    if (!registered.has(context)) {
      await context.audioWorklet.addModule(workletUrl)
      registered.add(context)
    }

    const node = new AudioWorkletNode(context, GUITAR_INPUT_PROCESSOR, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    node.port.onmessage = (event: MessageEvent<GuitarInputWorkletMessage>) => {
      onMessage(event.data)
    }

    const silence = context.createGain()
    silence.gain.value = 0
    source.connect(node)
    node.connect(silence)
    silence.connect(context.destination)

    return {
      dispose() {
        node.port.onmessage = null
        try {
          source.disconnect(node)
        } catch {
          // Already torn down by whoever owned the source.
        }
        node.disconnect()
        silence.disconnect()
      },
    }
  } catch {
    return null
  }
}
