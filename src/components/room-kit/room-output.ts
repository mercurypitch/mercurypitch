// ============================================================
// The rooms' output: one bus between a room's sound and the speakers
// ============================================================
//
// Every sound the premium rooms make reaches the speakers through this one
// gain: the glide rooms' tones (room-tones.ts), the Hear tone
// (useExerciseCapture), Merc's call (echo/merc-call.ts and merc-sampler.ts)
// and every demo (demo-kit/demo-sound.ts, and the count-in notes of Lip
// roll's and Ng slides' demos). It is held at 1 and nothing
// automates it, so no room can leave another room's sound turned down. A
// test build reads what the rooms send to the speakers off it
// (`roomOutputReadings`, the Developer screen's Audio rows): a room that
// sends a full note to a phone that plays it quietly is then told apart
// from a room that sends a quiet one.
//
// One bus per AudioContext, made on first use and kept for the context's
// life. On a phone that is the app's one shared context, which is never
// closed (packages/audio-io); a browser's room closes its own context, and
// its bus goes with it.
//
// In front of the bus, each room has a stage of its own (`openRoomStage`,
// opened by useExerciseCapture with the room's clock). While a room's stage
// is open, `roomOutput` hands it out, so everything the room starts goes
// through it. Cutting the stage takes whatever of the room is still behind
// it off the speakers at once. That is for sound the clock parked: a note
// frozen on a parked clock plays its release when the clock next starts,
// and that start belongs to the next tap, often in another room. A stage
// is held at 1 like the bus, and it is cut by disconnecting it, never by
// turning it down.

/**
 * The bus's gain, and every room stage's. Never automated, and pinned after
 * every room switch.
 */
export const ROOM_OUTPUT_GAIN = 1

/** Samples the meter reads at a time: 43 ms at 48 kHz. */
const METER_SIZE = 2048

/** Below this the meter reads silence, dBFS. */
const SILENCE_DB = -120

interface Output {
  readonly bus: GainNode
  meter: AnalyserNode | null
  /** The rooms' stages in front of the bus, newest last. */
  readonly stages: GainNode[]
}

const outputs = new Map<BaseAudioContext, Output>()

/** Contexts that have closed take their buses with them. */
function forgetClosed(): void {
  for (const ctx of [...outputs.keys()]) {
    if (ctx.state === 'closed') outputs.delete(ctx)
  }
}

/** The room output on `ctx`, made on first use. */
function outputOn(ctx: BaseAudioContext): Output {
  const known = outputs.get(ctx)
  if (known !== undefined) return known
  forgetClosed()
  const bus = ctx.createGain()
  bus.gain.value = ROOM_OUTPUT_GAIN
  bus.connect(ctx.destination)
  const output: Output = { bus, meter: null, stages: [] }
  outputs.set(ctx, output)
  return output
}

/**
 * Where a room's sound goes on `ctx`: the newest room stage open there,
 * else the room output itself.
 */
export function roomOutput(ctx: BaseAudioContext): AudioNode {
  const { bus, stages } = outputOn(ctx)
  return stages.length === 0 ? bus : stages[stages.length - 1]
}

/** A room's stage in front of the room output. */
export interface RoomStage {
  /**
   * Off the speakers, with everything still behind it, at once. The room's
   * next sound goes to the stage open before it, or to the bus. Safe to
   * call more than once.
   */
  cut: () => void
}

/**
 * Open a room's stage on `ctx`: until it is cut, `roomOutput(ctx)` hands it
 * out, so the room's sound goes through it to the bus.
 */
export function openRoomStage(ctx: BaseAudioContext): RoomStage {
  const output = outputOn(ctx)
  const stage = ctx.createGain()
  stage.gain.value = ROOM_OUTPUT_GAIN
  stage.connect(output.bus)
  output.stages.push(stage)
  let cut = false
  return {
    cut: () => {
      if (cut) return
      cut = true
      stage.disconnect()
      const at = output.stages.indexOf(stage)
      if (at !== -1) output.stages.splice(at, 1)
    },
  }
}

/** The room output on `ctx` if a room has made one there; null if not. */
export function roomOutputIfMade(ctx: BaseAudioContext): AudioNode | null {
  return outputs.get(ctx)?.bus ?? null
}

/** The room stages open on `ctx`, oldest first; none if no room has one. */
export function roomStagesOn(ctx: BaseAudioContext): readonly AudioNode[] {
  return [...(outputs.get(ctx)?.stages ?? [])]
}

/** What one room output sends to the speakers, as a test build reads it. */
export interface RoomOutputReading {
  readonly context: BaseAudioContext
  /** The bus's gain now: ROOM_OUTPUT_GAIN unless something moved it. */
  readonly gain: number
  /** The loudest sample in the meter's window, dBFS; null for silence. */
  readonly peakDb: number | null
  /** The window's RMS, dBFS; null for silence. */
  readonly rmsDb: number | null
}

const decibels = (value: number): number | null => {
  const db = 20 * Math.log10(value)
  return Number.isFinite(db) && db > SILENCE_DB ? db : null
}

/**
 * Every room output there is, with what it sends to the speakers right now.
 * The first reading puts a meter on each bus: only a test build's Developer
 * screen asks, so a store build never meters anything.
 */
export function roomOutputReadings(): RoomOutputReading[] {
  forgetClosed()
  const readings: RoomOutputReading[] = []
  for (const [context, output] of outputs) {
    if (output.meter === null) {
      const meter = context.createAnalyser()
      meter.fftSize = METER_SIZE
      output.bus.connect(meter)
      output.meter = meter
    }
    const samples = new Float32Array(output.meter.fftSize)
    output.meter.getFloatTimeDomainData(samples)
    let peak = 0
    let energy = 0
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample))
      energy += sample * sample
    }
    readings.push({
      context,
      gain: output.bus.gain.value,
      peakDb: decibels(peak),
      rmsDb: decibels(Math.sqrt(energy / samples.length)),
    })
  }
  return readings
}

/** Tests only: forget every bus. */
export function resetRoomOutputsForTests(): void {
  outputs.clear()
}
