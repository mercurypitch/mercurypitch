// Studio playback test doubles record source lifetimes and audio-clock scheduling without claiming DSP proof.
import { FakeAudioContext, FakeGain, FakeNode, FakeParam, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'

export class PlaybackParam extends FakeParam {
  ramps: { value: number; time: number }[] = []
  linearRamps: { value: number; time: number }[] = []
  linearRampToValueAtTime(value: number, time: number) {
    this.linearRamps.push({ value, time })
    return this
  }
  curves: { values: Float32Array; time: number; duration: number }[] = []
  exponentialRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ value, time })
    return this
  }
  setValueCurveAtTime(values: Float32Array, time: number, duration: number) {
    this.curves.push({ values, time, duration })
    return this
  }
}
class PlaybackGain extends FakeGain {
  override readonly gain = new PlaybackParam(1)
}
export class PlaybackSource extends FakeNode {
  buffer: AudioBuffer | null = null
  onended: (() => void) | null = null
  starts: number[][] = []
  stops = 0
  constructor() {
    super('source')
  }
  start(...values: number[]) {
    this.starts.push(values)
  }
  stop() {
    this.stops++
  }
}
export class PlaybackContext extends FakeAudioContext {
  closeCount = 0
  listeners = new Set<() => void>()
  override createGain() {
    const gain = new PlaybackGain()
    this.created.push(gain)
    return gain
  }
  createBufferSource() {
    const source = new PlaybackSource()
    this.created.push(source)
    return source
  }
  createAnalyser() {
    return Object.assign(new FakeNode('analyser'), {
      fftSize: 4096,
      smoothingTimeConstant: 0,
      getFloatTimeDomainData: (samples: Float32Array) => samples.fill(0.25),
    })
  }
  addEventListener(_event: string, callback: () => void) {
    this.listeners.add(callback)
  }
  removeEventListener(_event: string, callback: () => void) {
    this.listeners.delete(callback)
  }
  changeState(state: AudioContextState) {
    this.state = state
    for (const listener of this.listeners) listener()
  }
  close() {
    this.closeCount++
    return Promise.resolve()
  }
  get liveContext() {
    return this as unknown as AudioContext
  }
}
