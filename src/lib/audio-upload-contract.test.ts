// ============================================================
// Audio upload contract tests protect cross-surface format and size validation
// ============================================================

import { describe, expect, it } from 'vitest'
import { acceptsAudioUpload, audioUploadValidationError, } from './audio-upload-contract'

describe('audio upload validation', () => {
  it('accepts supported MIME types and extension-only browser files', () => {
    expect(
      acceptsAudioUpload(
        new File(['audio'], 'song.bin', { type: 'audio/mpeg' }),
      ),
    ).toBe(true)
    expect(acceptsAudioUpload(new File(['audio'], 'song.FLAC'))).toBe(true)
  })

  it('rejects empty and unsupported files with concrete recovery copy', () => {
    expect(
      audioUploadValidationError(new File([], 'empty.wav'), 100),
    ).toContain('empty')
    expect(
      audioUploadValidationError(
        new File(['data'], 'notes.txt', { type: 'text/plain' }),
        100,
      ),
    ).toBe('That format is not supported. Choose MP3, WAV, or FLAC audio.')
  })

  it('names the active size limit', () => {
    const file = new File(['12345'], 'song.wav', { type: 'audio/wav' })
    expect(audioUploadValidationError(file, 4, undefined, 'on-device')).toBe(
      'This song is over the 4 Bytes on-device limit. Choose a smaller file.',
    )
  })
})
