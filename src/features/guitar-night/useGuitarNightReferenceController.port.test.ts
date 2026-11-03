// ============================================================
// Guitar Night's note reader — the range it reads a stem in
// ============================================================
//
// The room names a profile by id (transcription-profile-id.ts) and the
// default port turns the id into the profile the transcriber runs. A guitar
// stem read with the bass profile lost everything above middle C.

import { describe, expect, it, vi } from 'vitest'
import { BASS_TRANSCRIPTION_PROFILE, GUITAR_TRANSCRIPTION_PROFILE, } from '@/lib/transcription/stem-transcription'
import type * as Client from '@/lib/transcription/stem-transcription-client'

const fakes = vi.hoisted(() => ({
  transcribe: vi.fn(async () => ({
    notes: [],
    coverage: 0,
    analysedSeconds: 0,
  })),
}))

vi.mock(
  '@/lib/transcription/stem-transcription-client',
  async (importOriginal) => ({
    ...(await importOriginal<typeof Client>()),
    transcribeStem: fakes.transcribe,
  }),
)

const { loadDefaultGuitarNightTranscriptionPort } =
  await import('./useGuitarNightReferenceController')

describe('the default note reader', () => {
  it('reads a stem in the profile its id names, and as bass without one', async () => {
    const port = await loadDefaultGuitarNightTranscriptionPort()
    const signal = new AbortController().signal
    const onProgress = (): void => undefined

    await port.transcribeStem('blob:guitar', {
      signal,
      onProgress,
      profile: 'guitar',
    })
    await port.transcribeStem('blob:bass', { signal, onProgress })

    expect(fakes.transcribe.mock.calls).toEqual([
      [
        'blob:guitar',
        expect.objectContaining({ profile: GUITAR_TRANSCRIPTION_PROFILE }),
      ],
      [
        'blob:bass',
        expect.objectContaining({ profile: BASS_TRANSCRIPTION_PROFILE }),
      ],
    ])
  })
})
