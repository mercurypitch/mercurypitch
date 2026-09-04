// Is it the capture, or is it the detector?
// ============================================================
//
// "No input heard" has at least six causes and they look identical from
// the game: a page with no microphone API, a permission never granted, a
// device that opens and delivers silence (a monitor input, a muted
// interface), an ONNX runtime that never loaded, a model that 404s, and
// an AudioContext parked in `suspended`. The game shows the same unlit
// ladder for all six.
//
// This page walks the whole chain and reports each link, and it can do
// most of it WITHOUT A MICROPHONE: an oscillator into a
// MediaStreamDestination is a real MediaStream carrying a note nobody
// has to sing, so the detector can be proved on its own. If the tone
// test reads 220 Hz and the microphone test reads nothing, the detector
// is fine and the problem is the device -- which is the split that
// otherwise takes an afternoon to establish.
//
// Reached at /mic-probe.html on the dev server. Dev-only; nothing
// imports it.

import { applyPreferredInput, listInputs, readPreferredInput, } from '@irchiinnuss/audio-io'
import type { F0Stream } from '@irchiinnuss/pitch-engine'
import { CONF_MIN, createF0Stream, listAudioInputs, micManager, pitchEngineModelPath, } from '@irchiinnuss/pitch-engine'
import '@/games/glass/pitch-assets'
import { acquireSharedAudioContext } from '@/audio/shared-audio-context'

const out = document.getElementById('out') as HTMLTableElement
const actions = document.getElementById('actions') as HTMLElement
const logEl = document.getElementById('log') as HTMLElement

const rows = new Map<string, HTMLTableCellElement>()

const say = (label: string, value: string, cls = ''): void => {
  let cell = rows.get(label)
  if (cell === undefined) {
    const tr = out.insertRow()
    tr.insertCell().textContent = label
    cell = tr.insertCell()
    rows.set(label, cell)
  }
  cell.textContent = value
  cell.className = cls
}

const log = (line: string): void => {
  logEl.textContent = `${logEl.textContent ?? ''}${line}\n`
}

const button = (label: string, run: () => Promise<void> | void): void => {
  const el = document.createElement('button')
  el.type = 'button'
  el.textContent = label
  el.addEventListener('click', () => {
    el.disabled = true
    void Promise.resolve(run())
      .catch((err: unknown) => {
        log(`${label}: ${err instanceof Error ? err.message : String(err)}`)
        say(label, 'threw', 'bad')
      })
      .finally(() => {
        el.disabled = false
      })
  })
  actions.append(el)
}

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (hz: number): string => {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440))
  return `${NOTE[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`
}

// ---------------------------------------------------------------- page

say('page URL', window.location.href)
say(
  'secure context',
  String(window.isSecureContext),
  window.isSecureContext ? 'ok' : 'bad',
)
const hasApi = typeof navigator.mediaDevices?.getUserMedia === 'function'
say('mediaDevices API', hasApi ? 'present' : 'MISSING', hasApi ? 'ok' : 'bad')
say('model path', pitchEngineModelPath())

// The model and the wasm runtime are fetched by the detector, deep in a
// worker, where a 404 becomes a silent failure to ever produce pitch.
// Asking for them here turns that into a line on a page.
const head = async (label: string, url: string): Promise<void> => {
  try {
    const resp = await fetch(url, { method: 'GET' })
    const size = Number(resp.headers.get('content-length') ?? 0)
    say(
      label,
      `${resp.status} ${resp.statusText}${size > 0 ? ` (${Math.round(size / 1024)} kB)` : ''}`,
      resp.ok ? 'ok' : 'bad',
    )
  } catch (err) {
    say(label, err instanceof Error ? err.message : String(err), 'bad')
  }
}
void head('model fetch', pitchEngineModelPath())
void head(
  'ort runtime fetch',
  new URL('ort/ort-wasm-simd-threaded.mjs', window.location.href).toString(),
)

void (async () => {
  try {
    const stored = readPreferredInput()
    say('remembered input', stored ?? 'system default')
    const devices = await listAudioInputs()
    say(
      'inputs Chrome lists',
      devices.length === 0
        ? 'none (labels need permission)'
        : devices.map((d) => `${d.label || '(unlabelled)'}`).join('\n'),
      devices.length === 0 ? 'warn' : '',
    )
    void listInputs
  } catch (err) {
    say('inputs Chrome lists', String(err), 'bad')
  }
})()

// ------------------------------------------------------------- running

let live: {
  stop: () => void
} | null = null

/**
 * Watch a stream two ways at once: the raw RMS straight off an
 * AnalyserNode, and the pitch the real detector makes of it.
 *
 * The raw level is the load-bearing half. It bypasses the pitch engine
 * entirely, so a flat line there means no audio is arriving at all and
 * nothing downstream can be at fault.
 */
const watch = (label: string, stream: MediaStream, ctx: AudioContext): void => {
  live?.stop()

  const track = stream.getAudioTracks()[0]
  say(
    `${label}: track`,
    track === undefined
      ? 'NO AUDIO TRACK'
      : `${track.label || '(unlabelled)'} — enabled=${track.enabled} muted=${track.muted} state=${track.readyState}`,
    track === undefined || track.muted || track.readyState !== 'live'
      ? 'bad'
      : 'ok',
  )
  const settings = track?.getSettings?.()
  if (settings !== undefined) {
    say(`${label}: settings`, JSON.stringify(settings, null, 1))
  }
  say(
    'audio context',
    `${ctx.state} @ ${Math.round(ctx.sampleRate)} Hz`,
    ctx.state === 'running' ? 'ok' : 'bad',
  )

  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)
  const buf = new Float32Array(analyser.fftSize)

  let f0: F0Stream | null = null
  try {
    f0 = createF0Stream(ctx, stream)
    f0.startTask()
    say(`${label}: detector`, 'started', 'ok')
  } catch (err) {
    say(`${label}: detector`, String(err), 'bad')
  }

  let peakRaw = 0
  let frames = 0
  let voiced = 0
  let timer = 0

  const tick = (): void => {
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (const v of buf) sum += v * v
    const rms = Math.sqrt(sum / buf.length)
    peakRaw = Math.max(peakRaw, rms)
    say(
      `${label}: raw level`,
      `now ${rms.toFixed(4)}  peak ${peakRaw.toFixed(4)}`,
      peakRaw > 0.001 ? 'ok' : 'bad',
    )

    const frame = f0?.latest() ?? null
    frames += frame === null ? 0 : 1
    const smoothed = f0?.latestSmoothed() ?? null
    if (smoothed !== null && smoothed.f0 > 0 && smoothed.conf >= CONF_MIN) {
      voiced += 1
      say(
        `${label}: pitch`,
        `${smoothed.f0.toFixed(1)} Hz (${noteName(smoothed.f0)})  conf ${smoothed.conf.toFixed(2)}  voiced frames ${voiced}`,
        'ok',
      )
    } else {
      say(
        `${label}: pitch`,
        `nothing voiced yet — frames seen ${frames}, detector level ${(f0?.latestLevel() ?? 0).toFixed(4)}`,
        frames === 0 ? 'bad' : 'warn',
      )
    }
    timer = window.setTimeout(tick, 120)
  }
  tick()

  live = {
    stop: () => {
      window.clearTimeout(timer)
      f0?.dispose()
      source.disconnect()
      live = null
    },
  }
}

const context = (): AudioContext => {
  const lease = acquireSharedAudioContext('mic-probe')
  const ctx = lease.ensure()
  if (ctx === null) throw new Error('this browser has no Web Audio')
  void lease.unlock()
  return ctx
}

button('Test with a 220 Hz tone (no microphone)', async () => {
  const ctx = context()
  await ctx.resume()
  const dest = ctx.createMediaStreamDestination()
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth' // richer than a sine; the detector wants harmonics
  osc.frequency.value = 220
  const gain = ctx.createGain()
  gain.gain.value = 0.2
  osc.connect(gain).connect(dest)
  osc.start()
  log('tone: 220 Hz (A3) sawtooth into a MediaStream — nothing is played out')
  watch('tone', dest.stream, ctx)
})

// The exact shape a Focusrite Scarlett arrives in when PipeWire offers it
// as "Analog Surround 4.1": two channels, the singer on one of them. This
// button is here because reading channel zero of that stream produced
// digital silence and no error at all.
button('Test with a tone on the RIGHT channel only', async () => {
  const ctx = context()
  await ctx.resume()
  const dest = ctx.createMediaStreamDestination()
  dest.channelCount = 2
  const merger = ctx.createChannelMerger(2)
  const silence = ctx.createConstantSource()
  silence.offset.value = 0
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = 220
  const gain = ctx.createGain()
  gain.gain.value = 0.2
  silence.connect(merger, 0, 0) // left: nothing
  osc.connect(gain)
  gain.connect(merger, 0, 1) // right: the voice
  merger.connect(dest)
  silence.start()
  osc.start()
  log('stereo: 220 Hz on the RIGHT channel, silence on the left')
  watch('stereo', dest.stream, ctx)
})

button('Test with the microphone', async () => {
  const ctx = context()
  await ctx.resume()
  await applyPreferredInput()
  const stream = await micManager.acquire('mic-probe')
  log('microphone: acquired')
  watch('mic', stream, ctx)
})

button('Stop', () => {
  live?.stop()
  micManager.release('mic-probe')
  log('stopped')
})
