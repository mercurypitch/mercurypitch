// Typings for signalsmith-stretch 1.3.x (MIT), which ships none.
// Every method on the node is a message to the processor and returns a Promise.
declare module 'signalsmith-stretch' {
  export interface StretchChange {
    output?: number
    active?: boolean
    input?: number
    rate?: number
    semitones?: number
    tonalityHz?: number
    formantSemitones?: number
    formantCompensation?: boolean
    formantBaseHz?: number
    loopStart?: number
    loopEnd?: number
  }

  export interface StretchConfig {
    blockMs?: number | null
    intervalMs?: number
    splitComputation?: boolean
    preset?: 'default' | 'cheaper'
  }

  export interface StretchNode extends AudioWorkletNode {
    inputTime: number
    schedule(change: StretchChange): Promise<unknown>
    start(when?: number): Promise<unknown>
    stop(when?: number): Promise<unknown>
    latency(): Promise<unknown>
    configure(config: StretchConfig): Promise<unknown>
  }

  export interface SignalsmithStretchFactory {
    (
      context: BaseAudioContext,
      options?: AudioWorkletNodeOptions,
    ): Promise<StretchNode>
    moduleUrl?: string
  }

  const SignalsmithStretch: SignalsmithStretchFactory
  export default SignalsmithStretch
}
