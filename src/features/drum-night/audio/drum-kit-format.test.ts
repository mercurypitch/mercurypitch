import { describe, expect, it, vi } from 'vitest'
import type { DrumKitAudioDecoder, DrumKitMultiFormatResource, DrumKitResourceEncoding, } from './drum-kit-format'
import { createDrumKitFormatSession, loadDrumKitOpusFormats, parseDrumKitOpusCatalog, probeDrumKitOpusSupport, resolveDrumKitEncodingAssetUrl, selectCompleteDrumKitFormat, } from './drum-kit-format'

function audioBuffer(): AudioBuffer {
  return {
    duration: 0.04,
    numberOfChannels: 1,
    sampleRate: 48_000,
  } as AudioBuffer
}

function encoding(
  name: string,
  mimeType: DrumKitResourceEncoding['mimeType'],
): DrumKitResourceEncoding {
  return Object.freeze({
    path: `studio/v1/${name}`,
    mimeType,
    encodedBytes: 1_024,
    sha256: 'a'.repeat(64),
  })
}

const MP3 = encoding('sample.mp3', 'audio/mpeg')
const OPUS = encoding('sample.opus', 'audio/ogg; codecs=opus')
const FLAC = encoding('sample.flac', 'audio/flac')

function resource(
  id: string,
  formats: DrumKitMultiFormatResource['formats'],
): DrumKitMultiFormatResource {
  return Object.freeze({ id, formats: Object.freeze(formats) })
}

describe('probeDrumKitOpusSupport', () => {
  it('decodes one bounded Ogg Opus fixture and caches concurrent checks', async () => {
    // Arrange
    const decodeAudioData = vi.fn(
      async (_encoded: ArrayBuffer): Promise<AudioBuffer> => audioBuffer(),
    )
    const decoder = { decodeAudioData }

    // Act
    const [first, second] = await Promise.all([
      probeDrumKitOpusSupport(decoder),
      probeDrumKitOpusSupport(decoder),
    ])

    // Assert
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(decodeAudioData).toHaveBeenCalledTimes(1)
    const encoded = decodeAudioData.mock.calls[0]?.[0]
    expect(encoded).toBeInstanceOf(ArrayBuffer)
    expect(encoded?.byteLength).toBe(241)
    expect(new TextDecoder().decode(encoded?.slice(0, 4))).toBe('OggS')
  })

  it('treats a decode rejection as unsupported and caches that result', async () => {
    // Arrange
    const decodeAudioData = vi.fn(async () => {
      throw new DOMException('Unsupported', 'EncodingError')
    })
    const decoder = { decodeAudioData }

    // Act
    const first = await probeDrumKitOpusSupport(decoder)
    const second = await probeDrumKitOpusSupport(decoder)

    // Assert
    expect(first).toBe(false)
    expect(second).toBe(false)
    expect(decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('probes a replacement audio context independently', async () => {
    // Arrange
    const first = { decodeAudioData: vi.fn(async () => audioBuffer()) }
    const second = { decodeAudioData: vi.fn(async () => audioBuffer()) }

    // Act
    await probeDrumKitOpusSupport(first)
    await probeDrumKitOpusSupport(second)

    // Assert
    expect(first.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(second.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('rejects a decoder that resolves unusable audio', async () => {
    // Arrange
    const decoder: DrumKitAudioDecoder = {
      decodeAudioData: async () =>
        ({
          duration: 0,
          numberOfChannels: 1,
          sampleRate: 48_000,
        }) as AudioBuffer,
    }

    // Act
    const supported = await probeDrumKitOpusSupport(decoder)

    // Assert
    expect(supported).toBe(false)
  })
})

describe('whole-kit format selection', () => {
  it('chooses Opus only when every planned resource has it', () => {
    // Arrange
    const resources = [
      resource('kick', { mp3: MP3, opus: OPUS }),
      resource('snare', { mp3: MP3, opus: OPUS }),
    ]

    // Act
    const plan = selectCompleteDrumKitFormat(resources, true)

    // Assert
    expect(plan.format).toBe('opus')
    expect(plan.resources.map(({ resource: item }) => item.id)).toEqual([
      'kick',
      'snare',
    ])
    expect(plan.resources.every(({ encoding: item }) => item === OPUS)).toBe(
      true,
    )
  })

  it('chooses MP3 for the entire plan when one Opus variant is absent', () => {
    // Arrange
    const resources = [
      resource('kick', { mp3: MP3, opus: OPUS }),
      resource('snare', { mp3: MP3 }),
    ]

    // Act
    const plan = selectCompleteDrumKitFormat(resources, true)

    // Assert
    expect(plan.format).toBe('mp3')
    expect(plan.resources.every(({ encoding: item }) => item === MP3)).toBe(
      true,
    )
  })

  it('keeps MP3 as the floor when Opus decoding is unavailable', () => {
    // Arrange
    const resources = [resource('kick', { mp3: MP3, opus: OPUS })]

    // Act
    const plan = selectCompleteDrumKitFormat(resources, false)

    // Assert
    expect(plan).toMatchObject({ format: 'mp3' })
    expect(plan.resources[0]?.encoding).toBe(MP3)
  })

  it('keeps a zero-resource synth plan on the compatibility floor', () => {
    // Arrange / Act
    const plan = selectCompleteDrumKitFormat([], true)

    // Assert
    expect(plan).toEqual({ format: 'mp3', resources: [] })
  })

  it('does not select FLAC merely because a catalog lists it', () => {
    // Arrange
    const resources = [resource('kick', { mp3: MP3, flac: FLAC })]

    // Act
    const plan = selectCompleteDrumKitFormat(resources, true)

    // Assert
    expect(plan.format).toBe('mp3')
    expect(plan.resources[0]?.encoding).toBe(MP3)
  })

  it('fails loudly when a sampled resource has no MP3 floor', () => {
    // Arrange
    const resources = [resource('kick', { opus: OPUS })]

    // Act / Assert
    expect(() => selectCompleteDrumKitFormat(resources, false)).toThrow(
      'missing its MP3 fallback',
    )
  })
})

describe('resolveDrumKitEncodingAssetUrl', () => {
  it('resolves the chosen Opus path instead of a resource MP3 alias', () => {
    // Arrange
    const chosen = encoding('chosen.opus', 'audio/ogg; codecs=opus')

    // Act
    const url = resolveDrumKitEncodingAssetUrl(
      chosen,
      'https://media.example.test/drums',
    )

    // Assert
    expect(url).toBe('https://media.example.test/drums/studio/v1/chosen.opus')
  })

  it('rejects an unsafe media base before resolving an encoding', () => {
    // Arrange
    const chosen = encoding('chosen.opus', 'audio/ogg; codecs=opus')

    // Act / Assert
    expect(() =>
      resolveDrumKitEncodingAssetUrl(chosen, '//media.example.test/drums/'),
    ).toThrow('protocol-relative')
    expect(() =>
      resolveDrumKitEncodingAssetUrl(chosen, 'data:audio/ogg;base64,'),
    ).toThrow('HTTP or HTTPS')
  })
})

describe('createDrumKitFormatSession', () => {
  it('does not decode the capability probe until a format plan is requested', () => {
    // Arrange
    const decodeAudioData = vi.fn(async () => audioBuffer())

    // Act
    createDrumKitFormatSession({ decodeAudioData })

    // Assert
    expect(decodeAudioData).not.toHaveBeenCalled()
  })

  it('reads an injected capability once across repeated kit plans', async () => {
    // Arrange
    const probeOpus = vi.fn(async () => true)
    const session = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      { probeOpus },
    )
    const resources = [resource('kick', { mp3: MP3, opus: OPUS })]

    // Act
    const first = await session.select(resources)
    const second = await session.select(resources)

    // Assert
    expect(first.format).toBe('opus')
    expect(second.format).toBe('opus')
    expect(probeOpus).toHaveBeenCalledTimes(1)
  })

  it('does not load Opus metadata when the decode probe fails', async () => {
    // Arrange
    const loadOpusFormats = vi.fn(async () => new Map([['kick', OPUS]]))
    const session = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      { probeOpus: async () => false, loadOpusFormats },
    )
    const resources = [resource('kick', { mp3: MP3 })]

    // Act
    const plan = await session.select(resources)

    // Assert
    expect(plan.format).toBe('mp3')
    expect(loadOpusFormats).not.toHaveBeenCalled()
  })

  it('loads one complete Opus projection after support is proven', async () => {
    // Arrange
    const loadOpusFormats = vi.fn(
      async () =>
        new Map([
          ['kick', OPUS],
          ['snare', OPUS],
        ]),
    )
    const session = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      {
        probeOpus: async () => true,
        loadOpusFormats,
        knownResourceIds: ['kick', 'snare'],
      },
    )
    const resources = [
      resource('kick', { mp3: MP3 }),
      resource('snare', { mp3: MP3 }),
    ]

    // Act
    const first = await session.select(resources)
    const second = await session.select(resources)

    // Assert
    expect(first.format).toBe('opus')
    expect(second.format).toBe('opus')
    expect(loadOpusFormats).toHaveBeenCalledTimes(1)
  })

  it('falls back to all MP3 when lazy Opus metadata fails or drifts', async () => {
    // Arrange
    const resources = [resource('kick', { mp3: MP3 })]
    const failed = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      {
        probeOpus: async () => true,
        loadOpusFormats: async () => {
          throw new Error('chunk unavailable')
        },
      },
    )
    const missing = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      {
        probeOpus: async () => true,
        loadOpusFormats: async () => new Map(),
        knownResourceIds: ['kick'],
      },
    )
    const extra = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      {
        probeOpus: async () => true,
        loadOpusFormats: async () =>
          new Map([
            ['kick', OPUS],
            ['unexpected', OPUS],
          ]),
        knownResourceIds: ['kick'],
      },
    )

    // Act / Assert
    await expect(failed.select(resources)).resolves.toMatchObject({
      format: 'mp3',
    })
    await expect(missing.select(resources)).resolves.toMatchObject({
      format: 'mp3',
    })
    await expect(extra.select(resources)).resolves.toMatchObject({
      format: 'mp3',
    })
  })

  it('replans every resource onto MP3 after an Opus load failure', async () => {
    // Arrange
    const session = createDrumKitFormatSession(
      { decodeAudioData: vi.fn(async () => audioBuffer()) },
      { probeOpus: async () => true },
    )
    const resources = [
      resource('kick', { mp3: MP3, opus: OPUS }),
      resource('snare', { mp3: MP3, opus: OPUS }),
    ]
    const selected = await session.select(resources)

    // Act
    const fallback = session.fallback(resources)

    // Assert
    expect(selected.format).toBe('opus')
    expect(fallback.format).toBe('mp3')
    expect(fallback.resources.every(({ encoding: item }) => item === MP3)).toBe(
      true,
    )
  })
})

describe('parseDrumKitOpusCatalog', () => {
  it('loads every committed generated Opus encoding', async () => {
    await expect(loadDrumKitOpusFormats()).resolves.toHaveProperty('size', 98)
  })

  it('accepts a bounded generated encoding and rejects unsafe metadata', () => {
    // Arrange
    const hash = 'a'.repeat(64)
    const catalog = {
      schemaVersion: 1,
      catalogSchemaVersion: 2,
      mimeType: 'audio/ogg; codecs=opus',
      encodings: {
        'studio:kick-l1-rr1': {
          path: `studio/v1/${hash.slice(0, 16)}-kick-l1-rr1.opus`,
          encodedBytes: 1_024,
          sha256: hash,
        },
      },
    }

    // Act
    const parsed = parseDrumKitOpusCatalog(catalog)

    // Assert
    expect(parsed.get('studio:kick-l1-rr1')).toEqual({
      path: `studio/v1/${hash.slice(0, 16)}-kick-l1-rr1.opus`,
      mimeType: 'audio/ogg; codecs=opus',
      encodedBytes: 1_024,
      sha256: hash,
    })
    expect(() =>
      parseDrumKitOpusCatalog({
        ...catalog,
        encodings: {
          'studio:kick-l1-rr1': {
            ...catalog.encodings['studio:kick-l1-rr1'],
            path: '../escape.opus',
          },
        },
      }),
    ).toThrow('Invalid Drum Night Opus encoding')
  })
})
