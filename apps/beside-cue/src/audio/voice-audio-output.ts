// Character voice output — cancellable one-shots with the shared audio envelope.
import type { VoiceAudioPort } from '../content/voice'
import type { WebAudioOutputDependencies } from './web-audio-output'
import { createWebAudioOutput } from './web-audio-output'

/** Owns its output independently of the cinematic onboarding mix. */
export function createVoiceAudioOutput(
  dependencies: WebAudioOutputDependencies = {},
): VoiceAudioPort {
  const output = createWebAudioOutput(dependencies)
  let disposed = false

  return {
    supportsMimeType: (mimeType) => output.supportsMimeType(mimeType),
    play(source) {
      if (disposed) throw new Error('Voice audio output is disposed.')
      let stopped = false
      // Dispatch synchronously so context resume remains in the user gesture.
      const playback = output.play({
        source,
        playback: { kind: 'one-shot' },
        initialGain: 1,
      })
      return {
        started: playback.started.then((result) => {
          if (disposed || stopped || result !== 'started') {
            throw new Error('Voice playback did not start.')
          }
        }),
        finished: playback.finished,
        stop() {
          stopped = true
          // Logical cancellation is immediate; the output owns the fade tail.
          playback.stop()
        },
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      output.dispose()
    },
  }
}
