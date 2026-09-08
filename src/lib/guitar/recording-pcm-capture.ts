// Bounded PCM copying for the render thread; no detection, encoding, or storage runs here.
import type { GuitarCaptureCommand, GuitarCaptureMessage, } from './recording-types'

export function createGuitarPcmCapture(
  send: (message: GuitarCaptureMessage, transfer?: Transferable[]) => void,
) {
  const pool: Float32Array[] = []
  let buffer: Float32Array | undefined
  let used = 0
  let frames = 0
  let sequence = 0
  let active = false
  let started = false
  let limit = 0
  let expectedFrame: number | null = null
  let anomalies = 0
  let stopOnClockGap = false
  const flush = (): void => {
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
  const stop = (reason: string | null): void => {
    if (!active) return
    active = false
    flush()
    send({ type: 'stopped', frames, clockAnomalies: anomalies, reason })
  }
  return {
    command(command: GuitarCaptureCommand) {
      if (command.type === 'buffer') pool.push(new Float32Array(command.buffer))
      else if (command.type === 'start' && !started && !active) {
        active = true
        limit = command.maxFrames
        stopOnClockGap = command.stopOnClockGap === true
      } else if (command.type === 'stop') stop(command.reason)
    },
    process(input: Float32Array | undefined, audioFrame: number) {
      if (!active) return
      if (input === undefined || input.length === 0) {
        if (started) stop('Audio input was disconnected.')
        return
      }
      if (!started) {
        started = true
        send({ type: 'started', audioStartFrame: audioFrame })
      }
      if (expectedFrame !== null && expectedFrame !== audioFrame) {
        anomalies++
        if (stopOnClockGap) {
          stop('The live audio clock was interrupted.')
          return
        }
      }
      expectedFrame = audioFrame + input.length
      let index = 0
      while (index < input.length && active) {
        buffer ??= pool.pop()
        if (buffer === undefined) {
          stop('Recording processing fell behind. The captured part is safe.')
          break
        }
        const count = Math.min(
          buffer.length - used,
          input.length - index,
          limit - frames,
        )
        // Avoid per-quantum typed-array views or new buffers on the audio thread.
        for (let at = 0; at < count; at++) buffer[used + at] = input[index + at]
        used += count
        index += count
        frames += count
        if (used === buffer.length) flush()
        if (frames >= limit)
          stop('The five-minute recording limit was reached.')
      }
    },
  }
}
