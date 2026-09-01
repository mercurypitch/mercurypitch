// ============================================================
// Who pays for the Whisper model before anyone asks to transcribe
// ============================================================
//
// Opening a song in the studio mixer used to start downloading
// `Xenova/whisper-tiny` on mount, so that pressing Transcribe felt instant.
// That is ~40 MB of ONNX weights fetched in a worker and then copied into a
// WASM heap, landing on top of the song's stems.
//
// On a phone that is what killed the tab. iOS does not report a content
// process it has jetsammed: no error, no `beforeunload`, no heartbeat drift —
// the page is simply replaced by a fresh load of the same URL, which reads as
// a reload. The tell was that the karaoke stage never died, and the stage is
// the one surface that already skipped this download.
//
// Nothing is lost by deferring but the head start: `startTranscription`
// initialises on demand and queues the request, so a phone that asks to
// transcribe still transcribes — it waits for the model the first time.

import type { DeviceClass } from '@/lib/device-tier'

/** The mixer surfaces, as `StemMixer`'s `preset` prop names them. */
export type StemMixerPreset = 'studio' | 'performance'

/**
 * Whether this surface may download the Whisper model on mount, rather than
 * on the first explicit transcription request.
 *
 * A function so the rule can be tested; `StemMixer` is the wiring.
 */
export function shouldPreloadWhisper(input: {
  /** `undefined` is the studio mixer, which is the prop's default. */
  preset: StemMixerPreset | undefined
  deviceClass: DeviceClass
}): boolean {
  // The karaoke stage has no transcription tooling to make instant.
  if (input.preset === 'performance') return false
  // A phone cannot hold the model and the song at once.
  if (input.deviceClass === 'mobile') return false
  return true
}
