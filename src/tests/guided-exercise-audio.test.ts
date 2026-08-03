import { describe, expect, it } from 'vitest'
import { audioDurationLabel, createGuidedExerciseAudioClip, isSupportedGuidedExerciseAudio, } from '@/features/zen/guided-exercise-audio'

function audioBuffer(durationSeconds: number, sampleRate = 100): AudioBuffer {
  const length = durationSeconds * sampleRate
  const left = Float32Array.from({ length }, (_, index) =>
    index < sampleRate ? 0.5 : 0.25,
  )
  const right = Float32Array.from({ length }, () => -0.25)
  return {
    duration: durationSeconds,
    sampleRate,
    length,
    numberOfChannels: 2,
    getChannelData: (channel: number) => (channel === 0 ? left : right),
  } as AudioBuffer
}

describe('guided exercise audio preparation', () => {
  it('accepts WAV sources and rejects unrelated files', () => {
    expect(
      isSupportedGuidedExerciseAudio(
        new File(['wav'], 'coach.wav', { type: 'audio/wav' }),
      ),
    ).toBeTruthy()
    expect(
      isSupportedGuidedExerciseAudio(
        new File(['text'], 'notes.txt', { type: 'text/plain' }),
      ),
    ).toBeFalsy()
  })

  it('cuts a bounded five-second mono WAV from the selected start', async () => {
    const source = new File(['source'], 'long-song.mp3', {
      type: 'audio/mpeg',
    })
    const clip = createGuidedExerciseAudioClip(source, audioBuffer(12), 3_000)

    expect(clip.file.name).toBe('long-song-5s-clip.wav')
    expect(clip.file.type).toBe('audio/wav')
    expect(clip.startMs).toBe(3_000)
    expect(clip.durationMs).toBe(5_000)
    expect(clip.file.size).toBe(44 + 5 * 100 * 2)

    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(clip.file)
    })
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 12))
    expect(header).toContain('RIFF')
    expect(header).toContain('WAVE')
  })

  it('clamps the start point and describes long source durations', () => {
    const clip = createGuidedExerciseAudioClip(
      new File(['source'], 'coach.ogg', { type: 'audio/ogg' }),
      audioBuffer(7),
      60_000,
    )

    expect(clip.startMs).toBe(2_000)
    expect(clip.durationMs).toBe(5_000)
    expect(audioDurationLabel(132_000)).toBe('2:12')
  })
})
