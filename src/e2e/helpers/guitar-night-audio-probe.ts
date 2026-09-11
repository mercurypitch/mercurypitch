// Browser-only probes capture rendered room PCM while keeping hardware output silent.
import type { Page } from '@playwright/test'

interface ProbeFrame {
  context: number
  time: number
  rate: number
  samples: number[]
}

export interface SongAudioProbe {
  frames: ProbeFrame[]
  sources: Array<{ source: AudioBufferSourceNode; when: number }>
  media: HTMLMediaElement[]
  seeks: Array<{ time: number; target: number }>
  micCalls: number
  micTracks: MediaStreamTrack[]
  blockAnimationFrames: boolean
}

declare global {
  interface Window {
    __songAudioProbe: SongAudioProbe
  }
}

/** Only hardware/browser edges are intercepted; app transports and DSP stay real. */
export async function installSongAudioProbe(
  page: Page,
  options: { autoRefineAfterStop?: boolean; audioBase64?: string } = {},
): Promise<void> {
  await page.addInitScript(({ autoRefineAfterStop, audioBase64 }) => {
    // Transport/recorder specs exercise the explicit manual path. Dedicated chord
    // specs opt into automatic proposals with the real model, never a model mock.
    localStorage.setItem(
      'guitar-chords-after-stop-v1',
      JSON.stringify(autoRefineAfterStop ?? false),
    )
    const probe: SongAudioProbe = {
      frames: [],
      sources: [],
      media: [],
      seeks: [],
      micCalls: 0,
      micTracks: [],
      blockAnimationFrames: false,
    }
    window.__songAudioProbe = probe
    const requestFrame = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) =>
      requestFrame((timestamp) => {
        if (!probe.blockAnimationFrames) callback(timestamp)
      })

    const connectNode: (
      this: AudioNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ) => AudioNode = AudioNode.prototype.connect
    const connectParam: (
      this: AudioNode,
      destination: AudioParam,
      output?: number,
    ) => void = AudioNode.prototype.connect
    const taps = new WeakMap<AudioDestinationNode, GainNode>()
    let contextId = 0
    function connectWithProbe(
      this: AudioNode,
      destination: AudioNode,
      output?: number,
      input?: number,
    ): AudioNode
    function connectWithProbe(
      this: AudioNode,
      destination: AudioParam,
      output?: number,
    ): void
    function connectWithProbe(
      this: AudioNode,
      destination: AudioNode | AudioParam,
      output?: number,
      inputPort?: number,
    ): AudioNode | void {
      if (destination instanceof AudioParam) {
        return connectParam.call(this, destination, output)
      }
      if (!(destination instanceof AudioDestinationNode)) {
        return connectNode.call(this, destination, output, inputPort)
      }
      let tap = taps.get(destination)
      if (tap === undefined) {
        const context = this.context as AudioContext
        const id = contextId++
        tap = context.createGain()
        const silent = context.createGain()
        silent.gain.value = 0
        connectNode.call(tap, silent)
        connectNode.call(silent, destination)
        taps.set(destination, tap)
        const source = `
          class SongProbe extends AudioWorkletProcessor {
            constructor() { super(); this.samples = []; }
            process(inputs) {
              const channel = inputs[0]?.[0];
              if (channel) for (const sample of channel) this.samples.push(sample);
              if (this.samples.length >= 1024) {
                this.port.postMessage({ time: currentTime, rate: sampleRate, samples: this.samples });
                this.samples = [];
              }
              return true;
            }
          }
          registerProcessor('song-output-probe', SongProbe);
        `
        const url = URL.createObjectURL(
          new Blob([source], { type: 'text/javascript' }),
        )
        const input = tap
        void context.audioWorklet.addModule(url).then(() => {
          URL.revokeObjectURL(url)
          const recorder = new AudioWorkletNode(context, 'song-output-probe')
          recorder.port.onmessage = ({ data }) => {
            probe.frames.push({ ...data, context: id })
            if (probe.frames.length > 3_000) probe.frames.shift()
          }
          connectNode.call(input, recorder)
          connectNode.call(recorder, silent)
        })
      }
      connectNode.call(this, tap, output, inputPort)
      return destination
    }
    AudioNode.prototype.connect = connectWithProbe

    const createBufferSource = AudioContext.prototype.createBufferSource
    AudioContext.prototype.createBufferSource = function () {
      const source = createBufferSource.call(this)
      const start = source.start.bind(source)
      source.start = (...args: Parameters<AudioBufferSourceNode['start']>) => {
        probe.sources.push({ source, when: args[0] ?? 0 })
        start(...args)
      }
      return source
    }
    const createMediaSource = AudioContext.prototype.createMediaElementSource
    AudioContext.prototype.createMediaElementSource = function (element) {
      probe.media.push(element)
      return createMediaSource.call(this, element)
    }
    const currentTime = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      'currentTime',
    )
    if (currentTime?.set !== undefined) {
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        ...currentTime,
        set(value: number) {
          probe.seeks.push({ time: performance.now(), target: value })
          currentTime.set?.call(this, value)
        },
      })
    }

    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
      configurable: true,
      value: async () => [
        {
          deviceId: 'synthetic-guitar',
          groupId: 'local-test',
          kind: 'audioinput',
          label: 'Synthetic guitar input',
          toJSON: () => ({}),
        },
      ],
    })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        probe.micCalls += 1
        const context = new AudioContext()
        const oscillator =
          audioBase64 === undefined
            ? context.createOscillator()
            : context.createBufferSource()
        const level = context.createGain()
        const destination = context.createMediaStreamDestination()
        if (oscillator instanceof OscillatorNode)
          oscillator.frequency.value = 110
        else {
          const bytes = Uint8Array.from(atob(audioBase64!), (value) =>
            value.charCodeAt(0),
          )
          oscillator.buffer = await context.decodeAudioData(bytes.buffer)
          oscillator.loop = true
        }
        level.gain.value = audioBase64 === undefined ? 0.06 : 0.7
        oscillator.connect(level)
        level.connect(destination)
        oscillator.start()
        await context.resume()
        for (const track of destination.stream.getTracks()) {
          probe.micTracks.push(track)
          const stop = track.stop.bind(track)
          track.stop = () => {
            stop()
            oscillator.stop()
            void context.close()
          }
        }
        return destination.stream
      },
    })
  }, options)
}

/** Analyse the actual post-limiter PCM, not requested gain values or callbacks. */
export async function readSongAudio(page: Page, windowBlocks = 1) {
  return page.evaluate((blocks) => {
    const amplitude = (samples: number[], rate: number, frequency: number) => {
      let real = 0
      let imaginary = 0
      let weights = 0
      for (let index = 0; index < samples.length; index += 1) {
        const weight =
          0.5 - 0.5 * Math.cos((Math.PI * 2 * index) / (samples.length - 1))
        const phase = (Math.PI * 2 * frequency * index) / rate
        real += samples[index] * weight * Math.cos(phase)
        imaginary += samples[index] * weight * Math.sin(phase)
        weights += weight
      }
      return (2 * Math.hypot(real, imaginary)) / weights
    }
    const raw = window.__songAudioProbe.frames.filter(
      (frame) => frame.context === 0,
    )
    // The quick mix compares 110 Hz DI against 165 Hz backing. A 1024-sample
    // Hann window at 48 kHz cannot separate those main lobes, so callers can
    // join four contiguous probe blocks without changing the audio render.
    const frames = raw
      .map((frame, index) => ({
        ...frame,
        samples: raw
          .slice(Math.max(0, index - blocks + 1), index + 1)
          .flatMap((block) => block.samples),
      }))
      .slice(blocks - 1)
      .map((frame) => ({
        time: frame.time,
        rms: Math.sqrt(
          frame.samples.reduce((sum, sample) => sum + sample * sample, 0) /
            frame.samples.length,
        ),
        mic: amplitude(frame.samples, frame.rate, 110),
        backing: amplitude(frame.samples, frame.rate, 165),
        first: amplitude(frame.samples, frame.rate, 256),
        second: amplitude(frame.samples, frame.rate, 512),
        outside:
          amplitude(frame.samples, frame.rate, 1024) +
          amplitude(frame.samples, frame.rate, 2048),
      }))
    return { frames, micCalls: window.__songAudioProbe.micCalls }
  }, windowBlocks)
}
