// ============================================================
// Checked on the phone, before anything is sent (plan S8 §6.1)
// ============================================================
//
// The type, the size (the server's 50 MB), the length (the handler's twelve
// minutes) and the room the stems will need. A song that fails one is
// refused with its reason, and every refusal ends "Nothing was used."

import { describe, expect, it, vi } from 'vitest'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
import { checkImport, IMPORT_ACCEPT, songTitleOf, } from './karaoke-import-checks'

const MB = 1024 * 1024

function song(name: string, bytes = 4 * MB, type = 'audio/mpeg'): File {
  const file = new File([new Uint8Array(1)], name, { type })
  Object.defineProperty(file, 'size', { value: bytes })
  return file
}

const fine = {
  duration: vi.fn(async () => Promise.resolve(200)),
  hasRoom: vi.fn(async () => Promise.resolve(true)),
}

describe('a song that can be separated', () => {
  for (const [name, type] of [
    ['Harbour Lights.mp3', 'audio/mpeg'],
    ['Long Road North.m4a', 'audio/x-m4a'],
    ['Long Road North.m4a', ''],
    ['Salt and Honey.flac', 'audio/flac'],
    ['Midnight Tram.wav', 'audio/wav'],
    ['voice memo', 'audio/mp4'],
  ] as const) {
    it(`passes: ${name} (${type === '' ? 'no type' : type})`, async () => {
      await expect(
        checkImport(song(name, 4 * MB, type), fine),
      ).resolves.toBeNull()
    })
  }

  it('is offered by the picker, each type by name', () => {
    // iOS narrows a bare audio/* to a set that greys out plain MP3 files
    // (audio-upload-contract.ts), so the picker names them.
    for (const kind of ['.mp3', '.m4a', '.wav', '.flac', 'audio/mp4']) {
      expect(IMPORT_ACCEPT.split(',')).toContain(kind)
    }
  })

  it('is named by its file, less the extension', () => {
    expect(songTitleOf(song('Harbour Lights.mp3'))).toBe('Harbour Lights')
    expect(songTitleOf(song('.m4a'))).toBe('Untitled song')
  })
})

describe('a song refused before it is sent', () => {
  it('is not a type the server reads', async () => {
    const refusal = await checkImport(
      song('Setlist.pdf', 84 * 1024, 'application/pdf'),
      fine,
    )

    expect(refusal).toEqual({
      title: 'This file cannot be separated',
      body: 'Songs can be MP3, M4A, WAV or FLAC. Setlist is not one of them. Nothing was used.',
    })
  })

  it('is empty', async () => {
    const refusal = await checkImport(song('Harbour Lights.mp3', 0), fine)

    expect(refusal?.title).toBe('This file is empty')
    expect(refusal?.body).toMatch(/Nothing was used\.$/u)
  })

  it('is over 50 MB', async () => {
    const refusal = await checkImport(
      song('Midnight Tram (live).wav', 61 * MB, 'audio/wav'),
      fine,
    )

    expect(refusal).toEqual({
      title: 'This song is too big',
      body: 'Songs up to 50 MB can be separated. Midnight Tram (live) is 61 MB. Nothing was used.',
    })
  })

  it('takes 50 MB exactly', async () => {
    await expect(
      checkImport(song('Harbour Lights.mp3', 50 * MB), fine),
    ).resolves.toBeNull()
  })

  it('is over 12 minutes', async () => {
    const refusal = await checkImport(song('Midnight Tram (live).wav'), {
      ...fine,
      duration: async () => Promise.resolve(845),
    })

    expect(refusal).toEqual({
      title: 'This song is too long',
      body: 'Songs up to 12 minutes can be separated. Midnight Tram (live) is 14:05. Nothing was used.',
    })
  })

  it('takes 12 minutes exactly, and a length it cannot read', async () => {
    await expect(
      checkImport(song('Harbour Lights.mp3'), {
        ...fine,
        duration: async () => Promise.resolve(720),
      }),
    ).resolves.toBeNull()
    // A length the phone cannot read is the server's to judge: it verifies
    // every declared length and refuses past its cap before anything runs.
    await expect(
      checkImport(song('Harbour Lights.mp3'), {
        ...fine,
        duration: async () => Promise.resolve(null),
      }),
    ).resolves.toBeNull()
  })

  it('does not fit on the phone with its stems', async () => {
    const hasRoom = vi.fn(async () => Promise.resolve(false))
    const refusal = await checkImport(song('Harbour Lights.mp3', 8 * MB), {
      ...fine,
      hasRoom,
    })

    // The copy the app keeps, and about 20 MB of stems.
    expect(hasRoom).toHaveBeenCalledWith(28 * MB)
    expect(refusal).toEqual({
      title: 'Not enough space on this phone',
      body: 'Free up about 28 MB and try again. Nothing was used.',
    })
  })

  it('is refused by the first check it fails, and checks no further', async () => {
    const duration = vi.fn(async () => Promise.resolve(900))
    const refusal = await checkImport(
      song('Midnight Tram (live).wav', 61 * MB, 'audio/wav'),
      { ...fine, duration },
    )

    expect(refusal?.title).toBe('This song is too big')
    expect(duration).not.toHaveBeenCalled()
  })
})

describe('a song, on an iPad', () => {
  it('does not fit on this iPad, and says so', async () => {
    const restore = actAsIpad()
    try {
      const refusal = await checkImport(song('Harbour Lights.mp3', 8 * MB), {
        ...fine,
        hasRoom: vi.fn(async () => Promise.resolve(false)),
      })

      expect(refusal?.title).toBe('Not enough space on this iPad')
    } finally {
      restore()
    }
  })
})
