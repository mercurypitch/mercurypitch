// ============================================================
// Guitar electric amp — the shared drive, presence, and asset-free cabinet stage
// ============================================================
//
// Guitar Night mounts one stage after electric voices meet. Legacy callers may
// still mount the same stage inside one self-contained voice until they gain a
// route-owned bus of their own.

const ELECTRIC_DRIVE_AMOUNT = 2.5

/** The memoryless transfer used by the electric drive stage. */
export function shapeGuitarElectricDrive(input: number): number {
  const finite = Number.isFinite(input) ? input : 0
  const bounded = Math.min(1, Math.max(-1, finite))
  return (
    Math.tanh(bounded * ELECTRIC_DRIVE_AMOUNT) /
    Math.tanh(ELECTRIC_DRIVE_AMOUNT)
  )
}

function createElectricDriveCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index / (curve.length - 1)) * 2 - 1
    curve[index] = shapeGuitarElectricDrive(input)
  }
  return curve
}

const ELECTRIC_DRIVE_CURVE = createElectricDriveCurve()

export interface GuitarElectricAmpStage {
  readonly input: WaveShaperNode
  readonly output: BiquadFilterNode
  readonly nodes: readonly AudioNode[]
}

/** Build the established electric voicing without choosing its destination. */
export function createGuitarElectricAmpStage(
  context: BaseAudioContext,
): GuitarElectricAmpStage {
  const drive = context.createWaveShaper()
  drive.curve = ELECTRIC_DRIVE_CURVE
  drive.oversample = '2x'

  const presence = context.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 2800
  presence.Q.value = 0.9
  presence.gain.value = 4

  const cabinet = context.createBiquadFilter()
  cabinet.type = 'lowpass'
  cabinet.frequency.value = 5000
  cabinet.Q.value = 0.7

  drive.connect(presence)
  presence.connect(cabinet)

  return {
    input: drive,
    output: cabinet,
    nodes: [drive, presence, cabinet],
  }
}
