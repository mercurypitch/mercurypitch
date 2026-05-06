// ============================================================
// UVR Processor - Vocal Separation and Isolation
// ============================================================

export type UvrMode = 'separate' | 'instrumental' | 'vocal' | 'duo'

export interface UvrSettings {
  mode: UvrMode
  vocalIntensity: number // 0-100% vocal volume in duo mode
  instrumentalIntensity: number // 0-100% instrumental volume in duo mode
  smoothing: number // 0-1, how smooth the transitions are
}

export interface UvrAnalysis {
  hasVocals: boolean
  isMusic: boolean
  vocalDominance: number // 0-1
  hasInstrumental: boolean
  isVocalHeavy: boolean
}

export interface UvrSegment {
  startBeat: number
  endBeat: number
  type: 'vocal' | 'instrumental' | 'mixed'
  vocalVolume: number
  instrumentalVolume: number
}

export class UvrProcessor {
  private mode: UvrMode = 'separate'
  private vocalIntensity = 0.7
  private instrumentalIntensity = 0.7
  private smoothing = 0.3
  private isInitialized = false

  constructor() {
    // audio init is deferred to initAudio()
  }

  private init(): void {
    // reset state only — does not mark audio as initialized
  }

  setSettings(settings: Partial<UvrSettings>): void {
    this.mode = settings.mode ?? this.mode
    this.vocalIntensity = settings.vocalIntensity ?? this.vocalIntensity
    this.instrumentalIntensity =
      settings.instrumentalIntensity ?? this.instrumentalIntensity
    this.smoothing = settings.smoothing ?? this.smoothing
  }

  getSettings(): UvrSettings {
    return {
      mode: this.mode,
      vocalIntensity: this.vocalIntensity,
      instrumentalIntensity: this.instrumentalIntensity,
      smoothing: this.smoothing,
    }
  }

  setMode(mode: UvrMode): void {
    this.mode = mode
  }

  getMode(): UvrMode {
    return this.mode
  }

  getAnalyserNode(): AnalyserNode | null {
    if (!this.isInitialized) return null
    return this.analyserNode
  }

  private analyserNode: AnalyserNode | null = null

  async initAudio(ctx: AudioContext): Promise<void> {
    if (this.isInitialized) return

    this.analyserNode = ctx.createAnalyser()
    this.analyserNode.fftSize = 2048
    this.analyserNode.smoothingTimeConstant = 0.3

    this.isInitialized = true
  }

  processSegment(
    sourceNode: AudioNode,
    time: number,
    ctx: AudioContext,
  ): AudioNode[] {
    if (!this.isInitialized) return [sourceNode]

    switch (this.mode) {
      case 'separate':
        return this.processSeparate(sourceNode, time, ctx)

      case 'instrumental':
        return this.processInstrumental(sourceNode, time, ctx)

      case 'vocal':
        return this.processVocal(sourceNode, time, ctx)

      case 'duo':
        return this.processDuo(sourceNode, time, ctx)
    }
  }

  private processSeparate(
    sourceNode: AudioNode,
    time: number,
    ctx: AudioContext,
  ): AudioNode[] {
    const separateNode = ctx.createChannelSplitter(2)
    const vocalGain = ctx.createGain()
    const instrumentalGain = ctx.createGain()

    const vocalFilter = ctx.createBiquadFilter()
    vocalFilter.type = 'highpass'
    vocalFilter.frequency.value = 300

    const instrumentalFilter = ctx.createBiquadFilter()
    instrumentalFilter.type = 'lowpass'
    instrumentalFilter.frequency.value = 800

    vocalGain.gain.value = this.vocalIntensity
    instrumentalGain.gain.value = this.instrumentalIntensity

    sourceNode.connect(separateNode)

    separateNode.connect(vocalFilter, 0)
    separateNode.connect(instrumentalFilter, 1)

    vocalFilter.connect(vocalGain)
    instrumentalFilter.connect(instrumentalGain)

    vocalGain.connect(this.analyserNode || ctx.destination)
    instrumentalGain.connect(this.analyserNode || ctx.destination)

    return [vocalGain, instrumentalGain]
  }

  private processInstrumental(
    sourceNode: AudioNode,
    time: number,
    ctx: AudioContext,
  ): AudioNode[] {
    const instrumentalNode = ctx.createGain()
    const vocalFilter = ctx.createBiquadFilter()

    vocalFilter.type = 'highpass'
    vocalFilter.frequency.value = 250

    instrumentalNode.gain.value = 1

    sourceNode.connect(vocalFilter)
    vocalFilter.connect(instrumentalNode)

    instrumentalNode.connect(this.analyserNode || ctx.destination)

    return [instrumentalNode]
  }

  private processVocal(
    sourceNode: AudioNode,
    time: number,
    ctx: AudioContext,
  ): AudioNode[] {
    const vocalNode = ctx.createGain()
    const instrumentalFilter = ctx.createBiquadFilter()

    instrumentalFilter.type = 'lowpass'
    instrumentalFilter.frequency.value = 1200

    vocalNode.gain.value = 1

    sourceNode.connect(instrumentalFilter)
    instrumentalFilter.connect(vocalNode)

    vocalNode.connect(this.analyserNode || ctx.destination)

    return [vocalNode]
  }

  private processDuo(
    sourceNode: AudioNode,
    time: number,
    ctx: AudioContext,
  ): AudioNode[] {
    const vocalNode = ctx.createGain()
    const instrumentalNode = ctx.createGain()

    const vocalFilter = ctx.createBiquadFilter()
    vocalFilter.type = 'highpass'
    vocalFilter.frequency.value = 250

    const instrumentalFilter = ctx.createBiquadFilter()
    instrumentalFilter.type = 'lowpass'
    instrumentalFilter.frequency.value = 1000

    vocalNode.gain.value = this.vocalIntensity
    instrumentalNode.gain.value = this.instrumentalIntensity

    sourceNode.connect(vocalFilter)
    sourceNode.connect(instrumentalFilter)

    vocalFilter.connect(vocalNode)
    instrumentalFilter.connect(instrumentalNode)

    vocalNode.connect(this.analyserNode || ctx.destination)
    instrumentalNode.connect(this.analyserNode || ctx.destination)

    return [vocalNode, instrumentalNode]
  }

  analyzeBuffer(buffer: Float32Array, sampleRate: number): UvrAnalysis {
    if (!this.isInitialized) {
      return {
        hasVocals: false,
        isMusic: false,
        vocalDominance: 0.5,
        hasInstrumental: false,
        isVocalHeavy: false,
      }
    }

    const fftSize = 2048
    const bufferLength = buffer.length
    const halfSize = fftSize / 2

    let sum = 0
    let sumHigh = 0

    for (let i = 0; i < halfSize; i++) {
      const amplitude = Math.abs(buffer[i])
      sum += amplitude

      if (i > sampleRate / 2000) {
        sumHigh += amplitude
      }
    }

    const totalEnergy = sum / (bufferLength / sampleRate)
    const highFreqEnergy =
      sumHigh / (bufferLength / sampleRate - sampleRate / 2000)

    const vocalDominance = Math.max(
      0,
      Math.min(1, (highFreqEnergy / totalEnergy) * 2),
    )
    const hasVocals = vocalDominance > 0.15
    const isVocalHeavy = vocalDominance > 0.5

    return {
      hasVocals,
      isMusic: totalEnergy > 0.01,
      vocalDominance,
      hasInstrumental: true,
      isVocalHeavy,
    }
  }

  applyFade(
    source: AudioNode,
    time: number,
    duration: number,
    ctx: AudioContext,
  ): AudioNode {
    const fadeNode = ctx.createGain()
    const gain = fadeNode.gain as AudioParam

    const rampIn = ctx.currentTime + 0.05
    const rampOut = ctx.currentTime + duration - 0.05

    gain.setValueAtTime(0, rampIn)
    gain.linearRampToValueAtTime(1, rampIn + 0.02)
    gain.linearRampToValueAtTime(1, rampOut)
    gain.linearRampToValueAtTime(0, rampOut + 0.02)

    source.connect(fadeNode)
    fadeNode.connect(ctx.destination)

    return fadeNode
  }

  reset(): void {
    this.mode = 'separate'
    this.vocalIntensity = 0.7
    this.instrumentalIntensity = 0.7
    this.smoothing = 0.3
    this.isInitialized = false
    this.analyserNode = null
  }

  getFrequencyData(dataArray: Uint8Array<ArrayBuffer>): void {
    if (this.analyserNode && this.isInitialized) {
      this.analyserNode.getByteFrequencyData(dataArray)
    }
  }

  getTimeDomainData(dataArray: Float32Array<ArrayBuffer>): void {
    if (this.analyserNode && this.isInitialized) {
      this.analyserNode.getFloatTimeDomainData(dataArray)
    }
  }
}
