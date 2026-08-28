// ============================================================
// Voice Take Export tests — names, formats, conversion, and cleanup
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { canSharePreparedVoiceTake, deliverPreparedVoiceTake, downloadPreparedVoiceTake, prepareVoiceTakeExport, voiceTakeExportFilename, voiceTakeExtensionForMime, } from './voice-take-export'

const identity = {
  threadTitle: 'Heaven Can Wait',
  ordinal: 2,
  mimeType: 'audio/webm;codecs=opus',
}

function decodedAudioBuffer(): AudioBuffer {
  const samples = new Float32Array([0.5, -0.5])
  return {
    duration: 2 / 8_000,
    sampleRate: 8_000,
    length: samples.length,
    numberOfChannels: 1,
    getChannelData: () => samples,
  } as unknown as AudioBuffer
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('voice take export names', () => {
  it('preserves Unicode while removing invalid filename characters', () => {
    expect(
      voiceTakeExportFilename({
        threadTitle: 'Čekaj / još: glas?',
        ordinal: 3,
        mimeType: 'audio/mp4;codecs=mp4a.40.2',
      }),
    ).toBe('MercuryPitch_Čekaj_još_glas_Take_3.m4a')
  })

  it('uses safe fallbacks for an empty title and invalid ordinal', () => {
    expect(
      voiceTakeExportFilename({
        threadTitle: ' ..<> ',
        ordinal: Number.NaN,
        mimeType: 'audio/webm',
      }),
    ).toBe('MercuryPitch_Untitled_Take_1.webm')
  })

  it('keeps the complete filename below a safe UTF-8 byte limit', () => {
    const filename = voiceTakeExportFilename({
      threadTitle: '声'.repeat(120),
      ordinal: 1234567,
      mimeType: 'audio/mp4',
    })

    expect(new TextEncoder().encode(filename).byteLength).toBeLessThanOrEqual(
      240,
    )
    expect(filename).toMatch(/^MercuryPitch_声+_Take_999999\.m4a$/)
  })

  it.each([
    ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
    ['video/mp4', 'mp4'],
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/x-wav', 'wav'],
    ['audio/mpeg', 'mp3'],
    ['audio/ogg', 'ogg'],
    ['application/octet-stream', 'bin'],
  ])('maps %s bytes to .%s', (mimeType, extension) => {
    expect(voiceTakeExtensionForMime(mimeType)).toBe(extension)
  })
})

describe('prepareVoiceTakeExport', () => {
  it('decodes a legacy WebM take and exports real WAV bytes', async () => {
    const source = new Blob(['webm'], { type: 'audio/webm;codecs=opus' })
    const decodeAudio = vi.fn(async () => decodedAudioBuffer())

    const prepared = await prepareVoiceTakeExport(source, identity, decodeAudio)
    const bytes = await readBytes(prepared.file)

    expect(decodeAudio).toHaveBeenCalledWith(source)
    expect(prepared.convertedToWav).toBe(true)
    expect(prepared.usedOriginalWebmFallback).toBe(false)
    expect(prepared.file.name).toBe('MercuryPitch_Heaven_Can_Wait_Take_2.wav')
    expect(prepared.file.type).toBe('audio/wav')
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE')
  })

  it('keeps honest WebM bytes and extension when decoding fails', async () => {
    const sourceBytes = new TextEncoder().encode('original-webm')
    const source = new Blob([sourceBytes], { type: 'audio/webm' })
    const decodeAudio = vi.fn(async () => {
      throw new Error('Safari cannot decode this WebM take')
    })

    const prepared = await prepareVoiceTakeExport(source, identity, decodeAudio)

    expect(prepared.convertedToWav).toBe(false)
    expect(prepared.usedOriginalWebmFallback).toBe(true)
    expect(prepared.file.name).toBe('MercuryPitch_Heaven_Can_Wait_Take_2.webm')
    expect(prepared.file.type).toBe('audio/webm')
    expect(Array.from(await readBytes(prepared.file))).toEqual(
      Array.from(sourceBytes),
    )
  })

  it('keeps MP4 bytes in M4A without invoking the WebM decoder', async () => {
    const source = new Blob(['mp4'], { type: 'audio/mp4' })
    const decodeAudio = vi.fn(async () => decodedAudioBuffer())

    const prepared = await prepareVoiceTakeExport(
      source,
      { ...identity, mimeType: 'audio/mp4' },
      decodeAudio,
    )

    expect(decodeAudio).not.toHaveBeenCalled()
    expect(prepared.convertedToWav).toBe(false)
    expect(prepared.usedOriginalWebmFallback).toBe(false)
    expect(prepared.file.name).toBe('MercuryPitch_Heaven_Can_Wait_Take_2.m4a')
    expect(prepared.file.type).toBe('audio/mp4')
  })
})

describe('downloadPreparedVoiceTake', () => {
  it('clicks an attached anchor, removes it, and revokes later', () => {
    vi.useFakeTimers()
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:voice-export')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined)
    let clickedDownload = ''
    let attachedAtClick = false
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download
        attachedAtClick = document.body.contains(this)
      })
    const file = new File(['voice'], 'MercuryPitch_Song_Take_1.m4a', {
      type: 'audio/mp4',
    })

    downloadPreparedVoiceTake(file)

    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(click).toHaveBeenCalledTimes(1)
    expect(clickedDownload).toBe(file.name)
    expect(attachedAtClick).toBe(true)
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:voice-export')
  })
})

describe('prepared voice take delivery', () => {
  const file = new File(['voice'], 'MercuryPitch_Pitch_Hold_C4_Take_1.m4a', {
    type: 'audio/mp4',
  })

  it('checks file-share capability with the exact prepared File', () => {
    const canShare = vi.fn(() => true)
    const share = vi.fn(async () => undefined)

    expect(canSharePreparedVoiceTake(file, { canShare, share })).toBe(true)
    expect(canShare).toHaveBeenCalledWith({ files: [file] })
  })

  it('treats missing, rejected, or throwing capability checks as unsupported', () => {
    expect(canSharePreparedVoiceTake(file, null)).toBe(false)
    expect(
      canSharePreparedVoiceTake(file, {
        canShare: () => false,
        share: async () => undefined,
      }),
    ).toBe(false)
    expect(
      canSharePreparedVoiceTake(file, {
        canShare: () => {
          throw new Error('blocked')
        },
        share: async () => undefined,
      }),
    ).toBe(false)
  })

  it('invokes native file share synchronously with the branded audio File', async () => {
    let resolveShare: (() => void) | undefined
    const sharePromise = new Promise<void>((resolve) => {
      resolveShare = resolve
    })
    const share = vi.fn<(data?: ShareData) => Promise<void>>(() => sharePromise)
    const download = vi.fn()

    const delivery = deliverPreparedVoiceTake(file, {
      shareTarget: { canShare: () => true, share },
      download,
    })

    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith({ files: [file] })
    expect(share.mock.calls[0]?.[0]?.files?.[0]?.name).toBe(
      'MercuryPitch_Pitch_Hold_C4_Take_1.m4a',
    )
    expect(share.mock.calls[0]?.[0]?.files?.[0]?.type).toBe('audio/mp4')
    expect(download).not.toHaveBeenCalled()

    resolveShare!()
    await expect(delivery).resolves.toBe('shared')
    expect(download).not.toHaveBeenCalled()
  })

  it('treats closing the native share sheet as dismissal without downloading', async () => {
    const download = vi.fn()
    const delivery = deliverPreparedVoiceTake(file, {
      shareTarget: {
        canShare: () => true,
        share: () =>
          Promise.reject(new DOMException('User cancelled', 'AbortError')),
      },
      download,
    })

    await expect(delivery).resolves.toBe('dismissed')
    expect(download).not.toHaveBeenCalled()
  })

  it('retains the existing download for browsers without file sharing', async () => {
    const share = vi.fn(async () => undefined)
    const download = vi.fn()

    const delivery = deliverPreparedVoiceTake(file, {
      shareTarget: { canShare: () => false, share },
      download,
    })

    expect(download).toHaveBeenCalledTimes(1)
    expect(download).toHaveBeenCalledWith(file)
    expect(share).not.toHaveBeenCalled()
    await expect(delivery).resolves.toBe('downloaded')
  })

  it('falls back to download when native sharing fails unexpectedly', async () => {
    const download = vi.fn()
    const delivery = deliverPreparedVoiceTake(file, {
      shareTarget: {
        canShare: () => true,
        share: () =>
          Promise.reject(new DOMException('Blocked', 'NotAllowedError')),
      },
      download,
    })

    await expect(delivery).resolves.toBe('downloaded')
    expect(download).toHaveBeenCalledWith(file)
  })
})
