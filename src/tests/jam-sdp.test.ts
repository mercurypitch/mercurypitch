// ── Jam SDP shaping tests ────────────────────────────────────────────
// This module rewrites the one string a connection is built from, so the
// cases that matter are the ones where a wrong rewrite does not fail
// loudly: a parameter landing in the wrong media section, a duplicated
// attribute, a line ending changed, or an existing value silently
// discarded. Every one of those produces a connection that works on one
// browser and not another, which is the worst failure shape there is.

import { describe, expect, it, vi } from 'vitest'
import { capSendBitrate, JAM_JITTER_TARGET_MS, JAM_MAX_BITRATE, JAM_MAXPTIME_MS, JAM_PTIME_MS, opusPayloadTypes, requestLowPlayout, shapeOpusSdp, } from '@/lib/jam/jam-sdp'

/** An offer shaped like the one Chrome actually produces. */
const OFFER = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 63 103 9 0 8 110 126',
  'c=IN IP4 0.0.0.0',
  'a=rtcp-mux',
  'a=mid:0',
  'a=sendrecv',
  'a=rtpmap:111 opus/48000/2',
  'a=rtcp-fb:111 transport-cc',
  'a=fmtp:111 minptime=10;useinbandfec=1',
  'a=rtpmap:63 red/48000/2',
  'a=fmtp:63 111/111',
  'a=rtpmap:0 PCMU/8000',
].join('\r\n')

const fmtpFor = (sdp: string, pt: string): string =>
  sdp.split(/\r?\n/).find((l) => l.startsWith(`a=fmtp:${pt} `)) ?? ''

const params = (sdp: string, pt: string): Record<string, string> => {
  const line = fmtpFor(sdp, pt).replace(`a=fmtp:${pt} `, '')
  const out: Record<string, string> = {}
  for (const pair of line.split(';')) {
    const [k, v] = pair.split('=')
    if (k !== undefined && k !== '') out[k] = v ?? ''
  }
  return out
}

describe('opusPayloadTypes', () => {
  it('finds Opus by its rtpmap, not by a hardcoded 111', () => {
    // 111 is conventional, not guaranteed. A build that assumes it will
    // one day shape somebody else's codec instead.
    expect(opusPayloadTypes(OFFER)).toEqual(['111'])
    expect(opusPayloadTypes('a=rtpmap:96 opus/48000/2')).toEqual(['96'])
  })

  it('does not mistake another codec for Opus', () => {
    expect(opusPayloadTypes('a=rtpmap:0 PCMU/8000')).toEqual([])
    // red carries Opus but is not Opus; shaping its fmtp would corrupt
    // the redundancy payload mapping.
    expect(opusPayloadTypes('a=rtpmap:63 red/48000/2')).toEqual([])
  })
})

describe('shapeOpusSdp', () => {
  const shaped = shapeOpusSdp(OFFER)

  it('asks for 10 ms packets, which is the floor the built-in encoder allows', () => {
    expect(shaped).toContain(`a=ptime:${JAM_PTIME_MS}`)
    expect(shaped).toContain(`a=maxptime:${JAM_MAXPTIME_MS}`)
    expect(params(shaped, '111').minptime).toBe(String(JAM_PTIME_MS))
  })

  it('caps maxptime AT the request, because a looser ceiling is ignored', () => {
    // Measured: with ptime=10 and maxptime=20, Chrome accepted the SDP and
    // kept sending 20 ms frames -- ptime is advisory and 20 was still
    // legal, so the encoder took the cheaper option. The ceiling is what
    // binds.
    expect(JAM_MAXPTIME_MS).toBe(JAM_PTIME_MS)
  })

  it('pins mono in the one place that is binding', () => {
    // channelCount: { ideal: 1 } is a preference, and a real two-peer room
    // measured as `opus 48000 Hz 2ch` despite it -- double the bitrate for
    // a mono microphone.
    expect(params(shaped, '111').stereo).toBe('0')
    expect(params(shaped, '111')['sprop-stereo']).toBe('0')
  })

  it('turns DTX off, because a reverb tail is not silence', () => {
    expect(params(shaped, '111').usedtx).toBe('0')
  })

  it('keeps parameters the browser set that we have no opinion about', () => {
    // Discarding these to assert our own is how a negotiation starts
    // failing on one browser and not another.
    const withExtras = shapeOpusSdp(
      OFFER.replace(
        'a=fmtp:111 minptime=10;useinbandfec=1',
        'a=fmtp:111 minptime=10;useinbandfec=1;maxplaybackrate=48000;sprop-maxcapturerate=48000',
      ),
    )
    expect(params(withExtras, '111').maxplaybackrate).toBe('48000')
    expect(params(withExtras, '111')['sprop-maxcapturerate']).toBe('48000')
    expect(params(withExtras, '111').usedtx).toBe('0')
  })

  it('never leaves two ptime lines behind', () => {
    // Duplicated attributes are undefined and parser-dependent, so a
    // browser that already wrote one must have it replaced, not joined.
    const withPtime = shapeOpusSdp(
      OFFER.replace('a=rtcp-mux', 'a=rtcp-mux\r\na=ptime:20'),
    )
    expect(withPtime.match(/a=ptime:/g)).toHaveLength(1)
    expect(withPtime).toContain('a=ptime:10')
    expect(withPtime).not.toContain('a=ptime:20')
  })

  it('leaves the red payload alone', () => {
    // a=fmtp:63 111/111 is a payload-type map, not a parameter list.
    // Merging Opus parameters into it corrupts the redundancy mapping.
    expect(fmtpFor(shaped, '63')).toBe('a=fmtp:63 111/111')
  })

  it('writes an fmtp for an Opus line that has none', () => {
    const bare = [
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=rtpmap:111 opus/48000/2',
    ].join('\r\n')
    expect(params(shapeOpusSdp(bare), '111').usedtx).toBe('0')
  })

  it('keeps the timing lines inside the audio section', () => {
    // Landing ptime in the video m-section is the kind of thing that
    // negotiates fine and then behaves strangely.
    const withVideo = shapeOpusSdp(
      `${OFFER}\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000`,
    )
    const lines = withVideo.split('\r\n')
    const ptimeAt = lines.findIndex((l) => l.startsWith('a=ptime:'))
    const videoAt = lines.findIndex((l) => l.startsWith('m=video'))
    expect(ptimeAt).toBeGreaterThan(-1)
    expect(ptimeAt).toBeLessThan(videoAt)
  })

  it('preserves CRLF, which some parsers are strict about', () => {
    expect(shaped).toContain('\r\n')
    expect(shaped.split('\r\n').some((l) => l.includes('\n'))).toBe(false)
  })

  it('preserves bare LF when that is what it was given', () => {
    const lf = shapeOpusSdp(OFFER.replace(/\r\n/g, '\n'))
    expect(lf).not.toContain('\r')
    expect(lf).toContain('a=ptime:10')
  })

  it('returns an SDP with no Opus in it completely untouched', () => {
    // The caller must never have to decide whether applying this is safe.
    const noOpus =
      'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 0\r\na=rtpmap:0 PCMU/8000'
    expect(shapeOpusSdp(noOpus)).toBe(noOpus)
    expect(shapeOpusSdp('')).toBe('')
  })

  it('is idempotent, because renegotiation runs it again', () => {
    expect(shapeOpusSdp(shaped)).toBe(shaped)
  })

  // ── The trailing CRLF ──────────────────────────────────────────────
  // A real description ends with a line terminator. This fixture did not,
  // which is how a bug that made the whole module a no-op in the app sat
  // under a green suite: splitting a terminated SDP leaves an empty last
  // element, the timing lines were appended AFTER it, and libwebrtc stops
  // reading a message at the first blank line. The panel went on saying
  // 20 ms frames and nothing explained why.

  const TERMINATED = `${OFFER}\r\n`

  it('never writes a blank line into the middle of a description', () => {
    const out = shapeOpusSdp(TERMINATED)
    const body = out.replace(/\r\n$/, '')
    expect(body.split('\r\n').includes('')).toBe(false)
  })

  it('puts the timing lines above the terminator, not below it', () => {
    const lines = shapeOpusSdp(TERMINATED).split('\r\n')
    const ptimeAt = lines.findIndex((l) => l.startsWith('a=ptime:'))
    const blankAt = lines.findIndex((l) => l === '')
    expect(ptimeAt).toBeGreaterThan(-1)
    // The only empty element is the one the final CRLF produces, and it
    // is last -- so nothing we wrote is below it.
    expect(blankAt).toBe(lines.length - 1)
    expect(ptimeAt).toBeLessThan(blankAt)
  })

  it('gives back a terminated SDP when it was given one', () => {
    // Every SDP line ends with CRLF by spec, the last one included.
    expect(shapeOpusSdp(TERMINATED).endsWith('\r\n')).toBe(true)
    expect(shapeOpusSdp(TERMINATED).endsWith('\r\n\r\n')).toBe(false)
  })

  it('does not invent a terminator that was not there', () => {
    expect(shapeOpusSdp(OFFER).endsWith('\r\n')).toBe(false)
  })

  it('is idempotent on a terminated SDP too', () => {
    const once = shapeOpusSdp(TERMINATED)
    expect(shapeOpusSdp(once)).toBe(once)
  })

  it('handles a terminated bare-LF description', () => {
    const lf = shapeOpusSdp(`${OFFER.replace(/\r\n/g, '\n')}\n`)
    expect(lf).not.toContain('\r')
    expect(lf.endsWith('\n')).toBe(true)
    expect(lf.replace(/\n$/, '').split('\n').includes('')).toBe(false)
  })
})

describe('requestLowPlayout', () => {
  it('sets both spellings, because no browser has both', () => {
    // jitterBufferTarget (ms) is the rename of playoutDelayHint (seconds).
    // Firefox has the new name, Chrome shipped the old one.
    const r = { jitterBufferTarget: null, playoutDelayHint: null }
    requestLowPlayout(r)
    expect(r.jitterBufferTarget).toBe(JAM_JITTER_TARGET_MS)
    expect(r.playoutDelayHint).toBeCloseTo(JAM_JITTER_TARGET_MS / 1000, 5)
  })

  it('sets what it can when only one spelling exists', () => {
    const onlyNew: { jitterBufferTarget: number | null } = {
      jitterBufferTarget: null,
    }
    requestLowPlayout(onlyNew)
    expect(onlyNew.jitterBufferTarget).toBe(JAM_JITTER_TARGET_MS)

    const onlyOld: { playoutDelayHint: number | null } = {
      playoutDelayHint: null,
    }
    requestLowPlayout(onlyOld)
    expect(onlyOld.playoutDelayHint).toBeCloseTo(0.02, 5)
  })

  it('survives a receiver that throws on assignment', () => {
    // Safari has neither property; a getter-only one throws in strict mode
    // and must not take the connection down with it.
    const hostile = {
      get jitterBufferTarget(): number {
        return 0
      },
      set jitterBufferTarget(_v: number) {
        throw new Error('read only')
      },
      playoutDelayHint: null as number | null,
    }
    expect(() => requestLowPlayout(hostile)).not.toThrow()
    // The other spelling still gets through.
    expect(hostile.playoutDelayHint).toBeCloseTo(0.02, 5)
  })

  it('does nothing at all for a receiver that is not there yet', () => {
    expect(() => requestLowPlayout(null)).not.toThrow()
    expect(() => requestLowPlayout(undefined)).not.toThrow()
    expect(() => requestLowPlayout({})).not.toThrow()
  })

  it('does not ask for zero', () => {
    // Chrome treats this as a hint, and a request of 0 is reported to
    // cause persistent stutter as NetEq thrashes between Accelerate and
    // Expand. The constant existing is the guard.
    expect(JAM_JITTER_TARGET_MS).toBeGreaterThan(0)
  })
})

describe('capSendBitrate', () => {
  it('caps every encoding through setParameters', async () => {
    // maxaveragebitrate in the SDP is honoured inconsistently in Chrome;
    // this API is the one that bites.
    const encodings = [{ maxBitrate: undefined as number | undefined }]
    const setParameters = vi.fn().mockResolvedValue(undefined)
    await capSendBitrate({
      getParameters: () => ({ encodings }),
      setParameters,
    })
    expect(encodings[0]!.maxBitrate).toBe(JAM_MAX_BITRATE)
    expect(setParameters).toHaveBeenCalledOnce()
  })

  it('leaves an un-negotiated sender alone', async () => {
    // Creating an encodings entry where there is none is not allowed and
    // throws on some browsers.
    const setParameters = vi.fn()
    await capSendBitrate({
      getParameters: () => ({ encodings: [] }),
      setParameters,
    })
    await capSendBitrate({ getParameters: () => ({}), setParameters })
    expect(setParameters).not.toHaveBeenCalled()
  })

  it('never lets a bitrate preference break a working connection', async () => {
    const thrower = {
      getParameters: () => {
        throw new Error('invalid state')
      },
      setParameters: vi.fn(),
    }
    await expect(capSendBitrate(thrower)).resolves.toBeUndefined()

    const rejecter = {
      getParameters: () => ({ encodings: [{}] }),
      setParameters: vi.fn().mockRejectedValue(new Error('nope')),
    }
    await expect(capSendBitrate(rejecter)).resolves.toBeUndefined()
  })

  it('does nothing for a sender that is not there', async () => {
    await expect(capSendBitrate(null)).resolves.toBeUndefined()
    await expect(capSendBitrate(undefined)).resolves.toBeUndefined()
  })
})
