// ============================================================
// wild-player — play an excerpt of the song's stems.
//
// The Field Book's stimuli are slices of the user's own stems, not
// synthesised: each layer is a buffer source started at the same
// clock time with its own gain, under one master gain that fades in
// and out so a slice never clicks. The promise resolves when the
// slice is over; cancel() fades it out early.
// ============================================================

export interface ExcerptLayer {
  buffer: AudioBuffer
  gain: number
}

export interface ExcerptHandle {
  done: Promise<void>
  cancel: () => void
}

const FADE_IN_S = 0.012
const FADE_OUT_S = 0.06
const LEAD_S = 0.04

export function playExcerpt(
  ctx: BaseAudioContext,
  layers: readonly ExcerptLayer[],
  startS: number,
  endS: number,
  level: number,
  destination: AudioNode = ctx.destination,
): ExcerptHandle {
  const lengthS = Math.max(0.05, endS - startS)
  const at = ctx.currentTime + LEAD_S
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, at)
  master.gain.linearRampToValueAtTime(level, at + FADE_IN_S)
  master.gain.setValueAtTime(level, at + lengthS - FADE_OUT_S)
  master.gain.linearRampToValueAtTime(0, at + lengthS)
  master.connect(destination)

  const sources = layers.map((layer) => {
    const source = ctx.createBufferSource()
    source.buffer = layer.buffer
    const gain = ctx.createGain()
    gain.gain.value = layer.gain
    source.connect(gain)
    gain.connect(master)
    source.start(at, Math.max(0, startS), lengthS)
    return { source, gain }
  })

  let settled = false
  let resolveDone: () => void = () => undefined
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve
  })
  const finish = () => {
    if (settled) return
    settled = true
    for (const { source, gain } of sources) {
      try {
        source.stop()
      } catch {
        // already stopped
      }
      source.disconnect()
      gain.disconnect()
    }
    master.disconnect()
    resolveDone()
  }
  const timer = setTimeout(finish, (LEAD_S + lengthS) * 1000 + 30)

  return {
    done,
    cancel: () => {
      clearTimeout(timer)
      if (settled) return
      const now = ctx.currentTime
      master.gain.cancelScheduledValues(now)
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + 0.04)
      setTimeout(finish, 50)
    },
  }
}
