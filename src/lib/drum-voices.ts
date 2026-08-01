// ============================================================
// Drum Voices — shared synthesized percussion recipes
// ============================================================
//
// One-shot Web Audio node graphs shared by the guitar drum machine, the
// compose drum kit, and offline WAV rendering. Each voice connects its
// terminal gain to the provided `destination` (never ctx.destination), so
// the caller decides which bus the hit plays into.

export type DrumVoiceId =
  | 'kick'
  | 'snare'
  | 'sidestick'
  | 'clap'
  | 'hh-closed'
  | 'hh-pedal'
  | 'hh-open'
  | 'tom-low'
  | 'tom-mid'
  | 'tom-high'
  | 'crash'
  | 'ride'

export type DrumVoiceFn = (
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
) => void

function createKick(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, now)
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.08)
  gain.gain.setValueAtTime(volume * 0.9, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(now)
  osc.stop(now + 0.35)
}

function createSnare(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  // Noise burst
  const noiseLen = Math.floor(ctx.sampleRate * 0.12)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(volume * 0.5, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
  noise.connect(noiseGain)
  noiseGain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.15)

  // Tonal body
  const tone = ctx.createOscillator()
  const toneGain = ctx.createGain()
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(200, now)
  tone.frequency.exponentialRampToValueAtTime(120, now + 0.05)
  toneGain.gain.setValueAtTime(volume * 0.35, now)
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  tone.connect(toneGain)
  toneGain.connect(destination)
  tone.start(now)
  tone.stop(now + 0.12)
}

function createSidestick(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  // Bandpassed noise tick
  const noiseLen = Math.floor(ctx.sampleRate * 0.055)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2000
  bp.Q.value = 1.5
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(volume * 0.45, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055)
  noise.connect(bp)
  bp.connect(noiseGain)
  noiseGain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.07)

  // Woody click
  const tone = ctx.createOscillator()
  const toneGain = ctx.createGain()
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(800, now)
  toneGain.gain.setValueAtTime(volume * 0.3, now)
  toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  tone.connect(toneGain)
  toneGain.connect(destination)
  tone.start(now)
  tone.stop(now + 0.05)
}

function createClap(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.16)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1200
  bp.Q.value = 1.2
  const gain = ctx.createGain()
  // Three staggered bursts ~10 ms apart; the last one rings out
  gain.gain.setValueAtTime(volume * 0.5, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.01)
  gain.gain.setValueAtTime(volume * 0.5, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)
  gain.gain.setValueAtTime(volume * 0.55, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
  noise.connect(bp)
  bp.connect(gain)
  gain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.16)
}

function createHihatClosed(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.04)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 8000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
  noise.connect(hp)
  hp.connect(gain)
  gain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.05)
}

function createHihatPedal(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  // Closed-hat variant: darker filter, slightly longer, noticeably quieter
  const noiseLen = Math.floor(ctx.sampleRate * 0.06)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 6000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.12, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
  noise.connect(hp)
  hp.connect(gain)
  gain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.07)
}

function createHihatOpen(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.25)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 7000
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.25, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
  noise.connect(hp)
  hp.connect(gain)
  gain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.2)
}

function createTom(
  ctx: BaseAudioContext,
  now: number,
  startFreq: number,
  volume: number,
  destination: AudioNode,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(startFreq * 0.5, now + 0.06)
  gain.gain.setValueAtTime(volume * 0.5, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(now)
  osc.stop(now + 0.22)
}

function createCrash(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  const noiseLen = Math.floor(ctx.sampleRate * 0.9)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 4000
  bp.Q.value = 1.2
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.4, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
  noise.connect(bp)
  bp.connect(gain)
  gain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.8)
}

function createRide(
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  // Sustained wash
  const noiseLen = Math.floor(ctx.sampleRate * 0.55)
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen)
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 5500
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume * 0.22, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  noise.connect(hp)
  hp.connect(gain)
  gain.connect(destination)
  noise.start(now)
  noise.stop(now + 0.55)

  // Stick ping for definition
  const ping = ctx.createOscillator()
  const pingGain = ctx.createGain()
  ping.type = 'triangle'
  ping.frequency.setValueAtTime(1000, now)
  pingGain.gain.setValueAtTime(volume * 0.12, now)
  pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
  ping.connect(pingGain)
  pingGain.connect(destination)
  ping.start(now)
  ping.stop(now + 0.11)
}

export const DRUM_VOICES: Record<DrumVoiceId, DrumVoiceFn> = {
  kick: createKick,
  snare: createSnare,
  sidestick: createSidestick,
  clap: createClap,
  'hh-closed': createHihatClosed,
  'hh-pedal': createHihatPedal,
  'hh-open': createHihatOpen,
  'tom-low': (ctx, now, volume, destination) =>
    createTom(ctx, now, 150, volume, destination),
  'tom-mid': (ctx, now, volume, destination) =>
    createTom(ctx, now, 240, volume, destination),
  'tom-high': (ctx, now, volume, destination) =>
    createTom(ctx, now, 350, volume, destination),
  crash: createCrash,
  ride: createRide,
}

export function triggerDrumVoice(
  id: DrumVoiceId,
  ctx: BaseAudioContext,
  now: number,
  volume: number,
  destination: AudioNode,
): void {
  DRUM_VOICES[id](ctx, now, volume, destination)
}
