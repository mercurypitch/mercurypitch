// ============================================================
// Studio PCM capture — what the recorder worklet does on the audio thread: meter the input, copy a take into pooled buffers
// ============================================================
//
// Pure, so it runs in the worklet (src/workers/studio-recorder.worklet.ts)
// and in a test alike. The audio thread allocates nothing: the main thread
// hands it empty buffers (`buffer`), each full one goes back transferred,
// and the main thread hands a fresh one back for every one it receives.
// Running out means the main thread stalled for the whole pool, and the
// take stops there with everything before it kept.
//
// A take starts and stops on exact frames of the audio clock, not on the
// quantum that happens to be running: the count-in's first frame and the
// round trip past Stop are whole frames the main thread chose (take-timing.ts).
// Sample i of a take is clock frame start + i, always: a quantum with no
// input is written as silence and a skipped stretch of the clock is filled
// with it, so nothing after a hiccup slides early. Input missing for half a
// second, or a clock jump too long to fill, ends the take with what came
// before it kept. The level is metered whether or not a take is running, so
// an armed lane shows the singer's level before Record.

/** Frames in one pooled buffer: about 85 ms at 48 kHz. */
export const STUDIO_CAPTURE_CHUNK_FRAMES = 4096
/** Buffers handed to the worklet up front: about 5.5 s of stall before a take stops. */
export const STUDIO_CAPTURE_POOL = 64
/** Frames between two level readings: 12 quanta, about 32 ms at 48 kHz. */
export const STUDIO_LEVEL_FRAMES = 1536
/** A render quantum: what a quantum with no input stands for. */
export const STUDIO_RENDER_QUANTUM = 128
/** Input missing this long, in frames, means the microphone is gone: half a second. */
export const STUDIO_SILENT_INPUT_FRAMES = 24000
/** The longest clock jump filled with silence, in frames: one second. */
export const STUDIO_MAX_CLOCK_GAP_FRAMES = 48000

/** Why a take stopped. */
export type StudioCaptureStop =
  | 'stopped'
  | 'cancelled'
  | 'input-lost'
  | 'interrupted'
  | 'limit'
  | 'fell-behind'

export type StudioCaptureCommand =
  | { readonly type: 'buffer'; readonly buffer: ArrayBuffer }
  /** Copy from clock frame `atFrame`, at most `maxFrames` frames. */
  | {
      readonly type: 'start'
      readonly atFrame: number
      readonly maxFrames: number
    }
  /** Stop before clock frame `atFrame`, or now for null. */
  | {
      readonly type: 'stop'
      readonly atFrame: number | null
      readonly reason: StudioCaptureStop
    }

export type StudioCaptureMessage =
  /** The loudest sample since the last reading, and the clock frame it ends on. */
  | { readonly type: 'level'; readonly peak: number; readonly frame: number }
  /** The clock frame of the take's first sample. */
  | { readonly type: 'started'; readonly frame: number }
  | {
      readonly type: 'pcm'
      readonly sequence: number
      /** Its first frame, counted from the take's start. */
      readonly firstFrame: number
      readonly frames: number
      readonly buffer: ArrayBuffer
    }
  | {
      readonly type: 'stopped'
      readonly frames: number
      readonly reason: StudioCaptureStop
    }

type Send = (message: StudioCaptureMessage, transfer?: Transferable[]) => void

export type StudioPcmCapture = ReturnType<typeof createStudioPcmCapture>

export function createStudioPcmCapture(send: Send) {
  const pool: Float32Array[] = []
  let buffer: Float32Array | undefined
  let used = 0
  let frames = 0
  let sequence = 0
  let startAt: number | null = null
  let stopAt: number | null = null
  let stopReason: StudioCaptureStop = 'stopped'
  let limit = 0
  let capturing = false
  let finished = false
  let nextFrame = 0
  let silentFrames = 0
  let levelPeak = 0
  let levelFrames = 0

  function flush(): void {
    if (buffer === undefined || used === 0) return
    const bytes = buffer.buffer as ArrayBuffer
    send(
      {
        type: 'pcm',
        sequence: sequence++,
        firstFrame: frames - used,
        frames: used,
        buffer: bytes,
      },
      [bytes],
    )
    buffer = undefined
    used = 0
  }

  function stop(reason: StudioCaptureStop): void {
    if (finished) return
    finished = true
    capturing = false
    startAt = null
    flush()
    send({ type: 'stopped', frames, reason })
  }

  /** The pooled buffer to fill next, or null once the take has stopped. */
  function room(): Float32Array | null {
    if (frames >= limit) {
      stop('limit')
      return null
    }
    buffer ??= pool.pop()
    if (buffer === undefined) {
      stop('fell-behind')
      return null
    }
    return buffer
  }

  /** Copy `n` samples of `input` from `from`, or `n` zeros, into `target`. */
  function copy(
    target: Float32Array,
    input: Float32Array | null,
    from: number,
    n: number,
  ): void {
    // Plain indexing: no typed-array views made on the audio thread.
    if (input === null) for (let at = 0; at < n; at++) target[used + at] = 0
    else for (let at = 0; at < n; at++) target[used + at] = input[from + at]
  }

  /**
   * Write `count` samples of `input` from `from`, or `count` frames of
   * silence for a null input; false once the take has stopped.
   */
  function write(
    input: Float32Array | null,
    from: number,
    count: number,
  ): boolean {
    let index = from
    const end = from + count
    while (index < end) {
      const target = room()
      if (target === null) return false
      const n = Math.min(target.length - used, end - index, limit - frames)
      copy(target, input, index, n)
      used += n
      index += n
      frames += n
      if (used === target.length) flush()
    }
    if (frames < limit) return true
    stop('limit')
    return false
  }

  function meter(input: Float32Array | null, length: number, at: number) {
    if (input !== null)
      for (let i = 0; i < length; i++) {
        const value = Math.abs(input[i])
        if (value > levelPeak) levelPeak = value
      }
    levelFrames += length
    if (levelFrames < STUDIO_LEVEL_FRAMES) return
    send({ type: 'level', peak: levelPeak, frame: at + length })
    levelPeak = 0
    levelFrames = 0
  }

  /** This quantum's frames from `from`, up to a stop frame inside it, if any. */
  function take(
    input: Float32Array | null,
    length: number,
    audioFrame: number,
    from: number,
  ): void {
    const until =
      stopAt === null
        ? length
        : Math.max(from, Math.min(length, stopAt - audioFrame))
    if (!write(input, from, until - from)) return
    if (stopAt !== null && audioFrame + until >= stopAt) stop(stopReason)
  }

  /** Keep sample i on clock frame start + i across a skipped stretch of the clock. */
  function bridge(audioFrame: number): boolean {
    const gap = audioFrame - nextFrame
    if (gap === 0) return true
    if (gap < 0 || gap > STUDIO_MAX_CLOCK_GAP_FRAMES) {
      stop('interrupted')
      return false
    }
    const until = stopAt === null ? gap : Math.min(gap, stopAt - nextFrame)
    if (!write(null, 0, Math.max(0, until))) return false
    if (stopAt !== null && nextFrame + until >= stopAt) {
      stop(stopReason)
      return false
    }
    return true
  }

  function capture(
    input: Float32Array | null,
    length: number,
    audioFrame: number,
  ): void {
    if (capturing) {
      if (!bridge(audioFrame)) return
      take(input, length, audioFrame, 0)
    } else {
      if (startAt === null || audioFrame + length <= startAt) return
      // A start asked for a frame already gone begins now.
      const first = Math.max(startAt, audioFrame)
      capturing = true
      send({ type: 'started', frame: first })
      take(input, length, audioFrame, first - audioFrame)
    }
    nextFrame = audioFrame + length
  }

  return {
    command(command: StudioCaptureCommand): void {
      if (command.type === 'buffer') {
        pool.push(new Float32Array(command.buffer))
        return
      }
      if (command.type === 'start') {
        if (finished || capturing || startAt !== null) return
        startAt = command.atFrame
        limit = Math.max(0, Math.floor(command.maxFrames))
        return
      }
      // A take that never began, or one already over, has nothing to stop.
      if (finished || (!capturing && startAt === null)) return
      // Now, or at a frame before a pending start: nothing more to capture.
      const before = !capturing && (command.atFrame ?? 0) <= (startAt ?? 0)
      if (command.atFrame === null || before) {
        stop(command.reason)
        return
      }
      stopAt = command.atFrame
      stopReason = command.reason
    },
    process(input: Float32Array | undefined, audioFrame: number): void {
      const present = input !== undefined && input.length > 0
      const samples = present ? input : null
      const length = present ? input.length : STUDIO_RENDER_QUANTUM
      meter(samples, length, audioFrame)
      if (finished) return
      silentFrames = present ? 0 : silentFrames + length
      if (capturing && silentFrames >= STUDIO_SILENT_INPUT_FRAMES) {
        stop('input-lost')
        return
      }
      capture(samples, length, audioFrame)
    },
  }
}
