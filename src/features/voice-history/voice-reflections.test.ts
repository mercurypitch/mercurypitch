import { describe, expect, it } from 'vitest'
import { createVoiceReflection, MAX_VOICE_REFLECTION_NOTE_LENGTH, MAX_VOICE_REFLECTIONS, parseVoiceReflections, serializeVoiceReflections, VOICE_REFLECTIONS_VERSION, voiceReflectionLabel, } from './voice-reflections'

describe('voice reflections', () => {
  it('creates bounded subjective markers without changing their meaning', () => {
    const reflection = createVoiceReflection({
      id: 'r1',
      kind: 'curious',
      position: 0.45678,
      note: `  ${'a'.repeat(MAX_VOICE_REFLECTION_NOTE_LENGTH + 20)}  `,
      createdAt: '2026-08-02T12:00:00.000Z',
    })

    expect(reflection).toMatchObject({
      id: 'r1',
      kind: 'curious',
      position: 0.4568,
      createdAt: '2026-08-02T12:00:00.000Z',
    })
    expect(reflection.note).toHaveLength(MAX_VOICE_REFLECTION_NOTE_LENGTH)
    expect(voiceReflectionLabel(reflection.kind)).toBe('Curious')
  })

  it('round-trips, sorts, and ignores malformed markers', () => {
    const valid = createVoiceReflection({
      id: 'later',
      kind: 'try-next',
      position: 0.8,
      note: 'Let the phrase settle.',
      createdAt: '2026-08-02T12:00:00.000Z',
    })
    const raw = JSON.stringify([
      valid,
      { ...valid, id: 'earlier', kind: 'keep', position: 0.2 },
      { ...valid, id: '', position: 0.4 },
      { ...valid, id: 'outside', position: 1.4 },
    ])

    expect(parseVoiceReflections(raw, VOICE_REFLECTIONS_VERSION)).toEqual([
      expect.objectContaining({ id: 'earlier', kind: 'keep' }),
      expect.objectContaining({ id: 'later', kind: 'try-next' }),
    ])
    expect(
      parseVoiceReflections(
        serializeVoiceReflections(parseVoiceReflections(raw, 1)),
        1,
      ),
    ).toHaveLength(2)
  })

  it('rejects unknown versions and caps stored markers', () => {
    const reflections = Array.from(
      { length: MAX_VOICE_REFLECTIONS + 5 },
      (_, index) =>
        createVoiceReflection({
          id: `r${index}`,
          kind: 'keep',
          position: index / (MAX_VOICE_REFLECTIONS + 5),
          note: '',
          createdAt: new Date(index * 1000).toISOString(),
        }),
    )

    expect(
      parseVoiceReflections(serializeVoiceReflections(reflections), 1),
    ).toHaveLength(MAX_VOICE_REFLECTIONS)
    expect(parseVoiceReflections('[]', 2)).toEqual([])
    expect(parseVoiceReflections('{broken', 1)).toEqual([])
  })
})
