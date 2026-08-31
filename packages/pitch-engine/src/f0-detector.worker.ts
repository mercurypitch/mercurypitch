// YIN, off the main thread.
// ============================================================
//
// The detector used to run inside the same requestAnimationFrame callback
// as everything else the game drew, which meant a full 2048-sample pass
// competing with the renderer for one 16 ms budget. Here it competes with
// nothing. The window arrives already cut by the capture worklet and
// already stamped on the audio clock, so this file has exactly one job
// and no notion of time at all.
//
// Still YIN, deliberately: the package ships no model weights, so the
// standalone entries stay small. Same detector, same options, same
// numbers — only the thread changed.

import type { F0WorkerRequest, F0WorkerResult } from './f0-worklet-contract'
import { F0_WINDOW } from './f0-worklet-contract'
import { PitchDetector } from './pitch-detector'

let detector: PitchDetector | null = null

self.onmessage = (event: MessageEvent<F0WorkerRequest>) => {
  const request = event.data

  if (request.kind === 'configure') {
    detector = new PitchDetector({
      sampleRate: request.sampleRate,
      bufferSize: F0_WINDOW,
      algorithm: 'yin',
      minFrequency: request.minFrequency,
      maxFrequency: request.maxFrequency,
      minAmplitude: request.minAmplitude,
    })
    return
  }

  if (request.kind === 'reset') {
    detector?.resetHistory()
    return
  }

  // A window that arrives before the configure message would be analysed
  // at the wrong sample rate, which is worse than being dropped.
  if (detector === null) return

  const detected = detector.detect(request.samples)
  const result: F0WorkerResult = {
    atFrame: request.atFrame,
    rms: request.rms,
    f0: detected.frequency > 0 ? detected.frequency : 0,
    conf: detected.frequency > 0 ? detected.clarity : 0,
  }
  self.postMessage(result)
}
