// Register the bounded PCM copier once per borrowed AudioContext, including concurrent recorder/live taps.
import workletUrl from '@/workers/guitar-recorder.worklet.ts?worker&url'

const registered = new WeakMap<AudioContext, Promise<void>>()

export async function prepareGuitarPcmWorklet(context: AudioContext) {
  if (
    typeof context.audioWorklet?.addModule !== 'function' ||
    typeof Worker === 'undefined'
  )
    throw new Error(
      'Audio analysis needs AudioWorklet and Web Workers. Live monitoring is still available.',
    )
  let module = registered.get(context)
  if (module === undefined) {
    module = context.audioWorklet
      .addModule(workletUrl)
      .catch((error: unknown) => {
        registered.delete(context)
        throw error
      })
    registered.set(context, module)
  }
  await module
}

export function createGuitarPcmNode(context: AudioContext) {
  return new AudioWorkletNode(context, 'guitar-recorder', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'discrete',
  })
}
