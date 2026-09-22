// ── Jam SDP shaping ──────────────────────────────────────────────────
// Asking the browser for an Opus configuration a musician can play over.
//
// Left alone, a browser peer connection negotiates Opus at 20 ms frames in
// hybrid mode. That is 20 ms of frame plus 5 ms of SILK lookahead plus
// 1.5 ms of resampling -- 26.5 ms of delay before a packet exists, and the
// single largest term in the room's latency that the app itself controls.
// service.ts has claimed to do "Opus codec configuration" since it was
// written; until this module there was no SDP handling in it at all.
//
// WHICH SDP CARRIES WHICH REQUEST. This trips everyone up once.
// `ptime`/`maxptime` and the fmtp parameters describe what the LOCAL side
// wants to RECEIVE. They reach the peer in the description we send, and it
// is the peer's encoder that honours them. So shaping our own local
// description is what makes the OTHER side send us short frames -- and
// both peers run this, so both get it.
//
// WHY THIS IS DEFENSIVE. SDP munging is a supported-but-grudging practice
// and Chrome has been tightening it: `setLocalDescription` rejects
// modifications it considers structural with InvalidModificationError.
// Adding fmtp parameters to an existing Opus line is the conservative end
// of what is allowed, and every caller here is written to fall back to the
// untouched SDP rather than fail a connection. A room that connects at
// 20 ms frames is enormously better than one that does not connect.
//
// Tests: src/tests/jam-sdp.test.ts.

/**
 * Packet time to ask the peer's encoder for, in ms.
 *
 * 10 is the floor the built-in WebRTC encoder supports -- it offers 10, 20,
 * 40 and 60, and anything shorter needs WebCodecs and our own transport.
 * At 10 ms Opus is CELT-or-hybrid rather than necessarily hybrid, so the
 * delay drops from 26.5 ms to 16.5 ms at worst and 12.5 ms at best.
 *
 * The cost is packet rate: 100 pps instead of 50, and at 64 kbps the header
 * goes from 16% of each packet to 28%. Roughly +28% on the wire to buy
 * ~10 ms, which at audio bitrates is not a real cost.
 */
export const JAM_PTIME_MS = 10

/**
 * The ceiling, and it must EQUAL the request or nothing changes.
 *
 * This cost a measurement to learn. With `ptime=10` and `maxptime=20`,
 * Chrome accepted the SDP and went on sending 20 ms frames -- because
 * `ptime` is advisory and `maxptime=20` makes 20 legal, so the encoder
 * takes the cheaper option. The panel read `frameMs: 20` from the packet
 * rate and the budget did not move.
 *
 * Setting the ceiling to the request is what actually binds it. The cost
 * is that a peer under pressure can no longer grow its packets to save
 * bandwidth -- which for a latency-first room is the trade we want, and is
 * why this is a named constant rather than an inline 10.
 */
export const JAM_MAXPTIME_MS = 10

/** Mono music at 64 kbps is transparent enough; see the Xiph guidance. */
export const JAM_MAX_BITRATE = 64000

export interface JamOpusParams {
  ptimeMs: number
  maxptimeMs: number
  maxBitrate: number
}

export const JAM_OPUS_DEFAULTS: JamOpusParams = {
  ptimeMs: JAM_PTIME_MS,
  maxptimeMs: JAM_MAXPTIME_MS,
  maxBitrate: JAM_MAX_BITRATE,
}

/**
 * The fmtp parameters we set, and why each one is there.
 *
 * `stereo=0` / `sprop-stereo=0` are not cosmetic. The capture asks for
 * `channelCount: { ideal: 1 }`, and "ideal" is a preference rather than a
 * constraint -- a two-peer room measured as `opus 48000 Hz 2ch`, doubling
 * the bitrate for a mono microphone. These say it in the one place that
 * is binding.
 *
 * `usedtx=0` because discontinuous transmission gates quiet passages, and
 * a held note decaying into a reverb tail is exactly what it mistakes for
 * silence.
 *
 * `useinbandfec=1` is nearly free at this frame size and is the cheapest
 * loss resilience available inside the built-in encoder. Note it is a SILK
 * mechanism, so it does nothing if a negotiation lands in pure CELT --
 * which is a reason to keep it, not to drop it: at 10 ms we may be in
 * hybrid, and where we are not it costs nothing.
 */
function fmtpParams(params: JamOpusParams): Record<string, string> {
  return {
    minptime: String(params.ptimeMs),
    useinbandfec: '1',
    usedtx: '0',
    stereo: '0',
    'sprop-stereo': '0',
    maxaveragebitrate: String(params.maxBitrate),
  }
}

/** Payload types for Opus in the first audio m-section, in order. */
export function opusPayloadTypes(sdp: string): string[] {
  const types: string[] = []
  for (const line of sdp.split(/\r?\n/)) {
    const m = /^a=rtpmap:(\d+)\s+opus\/\d+(?:\/\d+)?/i.exec(line)
    if (m?.[1] !== undefined) types.push(m[1])
  }
  return types
}

/**
 * Shape an offer or answer for low-latency music.
 *
 * Returns the SDP unchanged when there is nothing to shape -- no audio
 * section, or no Opus in it -- so a caller never has to decide whether it
 * is safe to apply.
 */
export function shapeOpusSdp(
  sdp: string,
  params: JamOpusParams = JAM_OPUS_DEFAULTS,
): string {
  const payloads = opusPayloadTypes(sdp)
  if (payloads.length === 0) return sdp

  // Preserve the original line endings. SDP is CRLF by spec and some
  // parsers are strict about it; splitting on /\r?\n/ and rejoining with
  // '\n' has broken interop before.
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n'

  // An SDP ENDS with a line terminator, so splitting leaves a trailing
  // empty element -- and that element is not harmless. Anything appended
  // after it lands below a BLANK LINE, and libwebrtc's line reader stops
  // at the first empty line, so the ptime and maxptime written at the end
  // of the last media section were being parsed as though they were never
  // sent. That is why a request that verified fine in isolation never
  // moved the frame size in the app. Rejoining also has to put the
  // terminator back, or the description arrives without its final CRLF.
  const terminated = /\r?\n$/.test(sdp)
  const lines = sdp.split(/\r?\n/)
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  const out: string[] = []

  let inAudio = false
  let audioDone = false

  for (const line of lines) {
    if (line.startsWith('m=')) {
      // Leaving an audio section without having written ptime: add it now,
      // before the next m-line, or it lands in the wrong media section.
      if (inAudio && !audioDone) {
        out.push(...timingLines(params))
        audioDone = true
      }
      inAudio = line.startsWith('m=audio')
    }

    // Drop any ptime the browser already wrote; ours replaces it rather
    // than appearing twice, which is undefined and parser-dependent.
    if (inAudio && /^a=(ptime|maxptime):/i.test(line)) continue

    const fmtp = /^a=fmtp:(\d+)\s+(.*)$/.exec(line)
    if (fmtp !== null && payloads.includes(fmtp[1]!)) {
      out.push(`a=fmtp:${fmtp[1]} ${mergeFmtp(fmtp[2]!, params)}`)
      continue
    }

    out.push(line)

    // An Opus rtpmap with no fmtp of its own still needs our parameters.
    const rtpmap = /^a=rtpmap:(\d+)\s+opus\//i.exec(line)
    if (rtpmap !== null && !hasFmtpFor(lines, rtpmap[1]!)) {
      out.push(`a=fmtp:${rtpmap[1]} ${renderFmtp({}, params)}`)
    }
  }

  if (inAudio && !audioDone) out.push(...timingLines(params))

  return out.join(eol) + (terminated ? eol : '')
}

function timingLines(params: JamOpusParams): string[] {
  return [`a=ptime:${params.ptimeMs}`, `a=maxptime:${params.maxptimeMs}`]
}

function hasFmtpFor(lines: readonly string[], payload: string): boolean {
  return lines.some((l) => l.startsWith(`a=fmtp:${payload} `))
}

/**
 * Merge our parameters into whatever the browser already wrote.
 *
 * Merge rather than replace: the browser sets things we have no opinion
 * about (`maxplaybackrate`, `sprop-maxcapturerate`, and occasionally
 * vendor keys), and discarding them to assert six of our own is how a
 * negotiation starts failing on one browser and not another.
 */
function mergeFmtp(existing: string, params: JamOpusParams): string {
  const current: Record<string, string> = {}
  for (const pair of existing.split(';')) {
    const [k, v] = pair.split('=')
    const key = k?.trim()
    if (key !== undefined && key !== '') current[key] = v?.trim() ?? ''
  }
  return renderFmtp(current, params)
}

function renderFmtp(
  current: Record<string, string>,
  params: JamOpusParams,
): string {
  const merged = { ...current, ...fmtpParams(params) }
  return Object.entries(merged)
    .map(([k, v]) => (v === '' ? k : `${k}=${v}`))
    .join(';')
}

// ── Receiver-side playout ────────────────────────────────────────────

/**
 * How much buffer to ask NetEq to aim for, in ms.
 *
 * NOT zero, deliberately. Chrome treats this as a hint that biases the
 * target rather than as a setting, and a request of 0 is reported to cause
 * persistent stutter as NetEq thrashes between Accelerate and Expand. It
 * also cannot go below what the path genuinely needs -- read back
 * `jitterBufferMinimumDelay` to see what it thinks that is.
 *
 * 20 ms is two of our packets: small enough to be worth asking for,
 * large enough to be a target the buffer can actually hold. A loopback
 * pair measured 30 ms with nothing at all to absorb.
 */
export const JAM_JITTER_TARGET_MS = 20

interface TargetableReceiver {
  jitterBufferTarget?: number | null
  playoutDelayHint?: number | null
}

/**
 * Ask a receiver for a shorter playout buffer, by both spellings.
 *
 * `jitterBufferTarget` (ms) is the rename of `playoutDelayHint` (seconds).
 * Firefox implements the new name, Chrome shipped the old one and is
 * moving, Safari has neither. Setting both is how one code path covers
 * three browsers, and each write is guarded because assigning an
 * unsupported property is harmless but assigning to a getter-only one
 * throws in strict mode.
 */
export function requestLowPlayout(
  receiver: TargetableReceiver | null | undefined,
  targetMs: number = JAM_JITTER_TARGET_MS,
): void {
  if (receiver === null || receiver === undefined) return
  try {
    if ('jitterBufferTarget' in receiver) receiver.jitterBufferTarget = targetMs
  } catch {
    // Not supported here; the legacy name below may still be.
  }
  try {
    if ('playoutDelayHint' in receiver) {
      receiver.playoutDelayHint = targetMs / 1000
    }
  } catch {
    // Neither spelling took. NetEq keeps its own target, which is the
    // behaviour we had before this existed.
  }
}

// ── Sender-side bitrate ──────────────────────────────────────────────

interface BitrateSender {
  getParameters(): { encodings?: Array<{ maxBitrate?: number }> }
  setParameters(p: unknown): Promise<void>
}

/**
 * Cap the send bitrate through the API rather than through `fmtp`.
 *
 * `maxaveragebitrate` in the SDP is honoured inconsistently in Chrome --
 * sometimes it moves the rate, sometimes the encoder sits near 50 kbps
 * regardless. `setParameters` is a supported API and does work, so the
 * fmtp value stays as the declaration of intent and this is the one that
 * bites.
 */
export async function capSendBitrate(
  sender: BitrateSender | null | undefined,
  maxBitrate: number = JAM_MAX_BITRATE,
): Promise<void> {
  if (sender === null || sender === undefined) return
  try {
    const params = sender.getParameters()
    // An empty encodings array means the sender is not negotiated yet.
    // Creating one here is not allowed and throws on some browsers.
    if (params.encodings === undefined || params.encodings.length === 0) return
    for (const e of params.encodings) e.maxBitrate = maxBitrate
    await sender.setParameters(params)
  } catch {
    // Not fatal: the encoder keeps whatever it chose. Never let a bitrate
    // preference break a working connection.
  }
}
