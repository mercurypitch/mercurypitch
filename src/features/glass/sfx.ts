// ============================================================
// Glass — product SFX (the shatter). All synthesized on the
// session AudioContext, zero assets: a filtered noise burst, a
// handful of crystalline pings and a low thud. Scaled by the
// burst's epicness (a cinematic first-try rings longer).
// ============================================================

export function playGlassShatter(ctx: AudioContext, epicness: number): void {
  const t = ctx.currentTime
  const e = Math.max(0, Math.min(1, epicness))

  // The body of the break: a decaying noise burst through a falling bandpass.
  const noiseSeconds = 0.5 + e * 0.25
  const noise = ctx.createBufferSource()
  const buffer = ctx.createBuffer(
    1,
    Math.round(ctx.sampleRate * noiseSeconds),
    ctx.sampleRate,
  )
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.6)
  }
  noise.buffer = buffer
  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.Q.value = 0.8
  bandpass.frequency.setValueAtTime(2600, t)
  bandpass.frequency.exponentialRampToValueAtTime(700, t + noiseSeconds)
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.4, t)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseSeconds + 0.05)
  noise.connect(bandpass).connect(noiseGain).connect(ctx.destination)
  noise.start(t)

  // Crystalline pings — shard voices ringing out.
  const pingCount = 5 + Math.round(e * 3)
  for (let i = 0; i < pingCount; i++) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1600 + Math.random() * 3800
    const gain = ctx.createGain()
    const start = t + Math.random() * (0.1 + e * 0.15)
    const duration = 0.5 + Math.random() * (0.9 + e * 0.5)
    gain.gain.setValueAtTime(0.05, start)
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  // The thud underneath.
  const thud = ctx.createOscillator()
  thud.type = 'sine'
  thud.frequency.setValueAtTime(110, t)
  thud.frequency.exponentialRampToValueAtTime(50, t + 0.25)
  const thudGain = ctx.createGain()
  thudGain.gain.setValueAtTime(0.16, t)
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
  thud.connect(thudGain).connect(ctx.destination)
  thud.start(t)
  thud.stop(t + 0.35)
}
