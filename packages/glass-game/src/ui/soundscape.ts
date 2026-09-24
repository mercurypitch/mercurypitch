// Adventure soundscape lifecycle — gestures authorize playback; voice and pause own silence.
import type { GlassMuseumAudio, MuseumAudioScene } from '../host'

export function createAdventureSoundscape(
  audio: GlassMuseumAudio | undefined,
  scene: (previous: MuseumAudioScene) => MuseumAudioScene,
  canPlay: () => boolean,
) {
  let armed = false
  let voiceHeld = false
  let disposed = false
  let failed = false
  let previous: MuseumAudioScene = 'museum'
  let requested: MuseumAudioScene | null = null
  let generation = 0

  function update(): void {
    if (!audio || !armed || voiceHeld || disposed || failed || !canPlay())
      return
    const next = scene(previous)
    previous = next
    if (requested === next) return
    requested = next
    const current = ++generation
    void audio.start(next).then(
      (playing) => {
        if (current === generation && !playing) failed = true
      },
      () => {
        if (current === generation) failed = true
      },
    )
  }

  function activate(): void {
    if (disposed || voiceHeld || !canPlay()) return
    armed = true
    // A route interruption may have retired the output since its successful
    // start. Only a fresh gesture may ask the audio service to recover; it
    // coalesces already playing and pending requests for the same scene.
    requested = null
    failed = false
    update()
  }

  function pause(): void {
    armed = false
    requested = null
    generation++
    audio?.pause()
  }

  return {
    activate,
    update,
    pause,
    silenceForVoice(): Promise<void> {
      voiceHeld = true
      armed = true
      requested = null
      generation++
      return audio?.silenceForVoice() ?? Promise.resolve()
    },
    releaseVoice(): void {
      voiceHeld = false
      update()
    },
    dispose(): void {
      disposed = true
      armed = false
      generation++
      audio?.dispose()
    },
  }
}
