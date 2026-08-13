import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONTENT_PACK } from './pack'
import type { VoiceAudioPort } from './voice'
import { createVoicePlayer } from './voice'

function fakeAudio(): VoiceAudioPort & { played: string[] } {
  const played: string[] = []
  return {
    played,
    play: async (url) => {
      played.push(url)
    },
    stop: vi.fn(),
  }
}

const recorded = {
  ...DEFAULT_CONTENT_PACK,
  lines: [
    { id: 'silent', text: 'No recording yet.' },
    { id: 'spoken', text: 'This one is recorded.', audio: '/voice/spoken.mp3' },
  ],
}

describe('voice player', () => {
  it('returns a caption for a line with no recording', async () => {
    // Every line ships as text first. An unrecorded line is quieter, not
    // missing.
    const player = createVoicePlayer({ pack: recorded, audio: fakeAudio() })
    const cue = await player.playLine('silent')

    expect(cue.caption).toBe('No recording yet.')
    expect(cue.spoken).toBe(false)
  })

  it('plays a line that has one', async () => {
    const audio = fakeAudio()
    const player = createVoicePlayer({ pack: recorded, audio })
    const cue = await player.playLine('spoken')

    expect(cue.spoken).toBe(true)
    expect(audio.played).toEqual(['/voice/spoken.mp3'])
  })

  it('still captions when muted', async () => {
    const audio = fakeAudio()
    const player = createVoicePlayer({
      pack: recorded,
      audio,
      muted: () => true,
    })
    const cue = await player.playLine('spoken')

    expect(cue.caption).toBe('This one is recorded.')
    expect(cue.spoken).toBe(false)
    expect(audio.played).toEqual([])
  })

  it('captions when there is no audio port at all', async () => {
    const player = createVoicePlayer({ pack: recorded })
    const cue = await player.playLine('spoken')

    expect(cue.caption).toBe('This one is recorded.')
    expect(cue.spoken).toBe(false)
  })

  it('treats a refused playback as silence, not an error', async () => {
    // A browser that blocks autoplay must not break the screen: the person
    // reads the line instead.
    const player = createVoicePlayer({
      pack: recorded,
      audio: {
        play: async () => {
          throw new Error('NotAllowedError')
        },
        stop: vi.fn(),
      },
    })
    const cue = await player.playLine('spoken')

    expect(cue.spoken).toBe(false)
    expect(cue.caption).toBe('This one is recorded.')
  })

  it('stops the previous line before starting another', async () => {
    // Two Corky lines over each other would be worse than silence.
    const audio = fakeAudio()
    const player = createVoicePlayer({ pack: recorded, audio })
    await player.playLine('spoken')
    await player.playLine('spoken')

    expect(audio.stop).toHaveBeenCalledTimes(1)
  })

  it('rejects a line the pack does not define', async () => {
    const player = createVoicePlayer({ pack: recorded })

    await expect(player.playLine('nope')).rejects.toThrow(/nope/u)
  })
})
