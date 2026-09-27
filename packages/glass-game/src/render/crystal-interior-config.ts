// Crystal interior configuration — validate bounded audition settings and map scroll retraction without touching gameplay state.

export const CRYSTAL_INTERIOR_PRESETS = [
  'resonance-veins',
  'frost-roots',
  'aurora-heart',
] as const

export type CrystalInteriorPreset = (typeof CRYSTAL_INTERIOR_PRESETS)[number]

export interface CrystalInteriorEnvelope {
  readonly width: number
  readonly height: number
  readonly depth: number
  readonly center?: readonly [number, number, number]
  readonly inset?: number
}

export interface CrystalInteriorPalette {
  readonly primary: number
  readonly secondary: number
  readonly accent: number
}

export interface CrystalInteriorSettings {
  readonly preset: CrystalInteriorPreset
  readonly seed: number
  readonly envelope: CrystalInteriorEnvelope
  readonly palette?: Partial<CrystalInteriorPalette>
  readonly intensity?: number
  readonly speed?: number
  readonly reducedMotion?: boolean
  readonly retractionAxis?: 'x' | 'z'
  readonly quality?: 'high' | 'mobile'
}

export interface NormalizedCrystalInteriorSettings {
  readonly preset: CrystalInteriorPreset
  readonly seed: number
  readonly envelope: {
    readonly width: number
    readonly height: number
    readonly depth: number
    readonly center: readonly [number, number, number]
    readonly inset: number
  }
  readonly palette: CrystalInteriorPalette
  readonly intensity: number
  readonly speed: number
  readonly reducedMotion: boolean
  readonly retractionAxis: 'x' | 'z'
  readonly quality: 'high' | 'mobile'
}

export interface CrystalInteriorRetractionMapping {
  readonly visibleFraction: number
  readonly scale: number
  readonly visibility: number
  readonly visible: boolean
}

interface PresetDefaults {
  readonly palette: CrystalInteriorPalette
  readonly intensity: number
  readonly speed: number
}

const PRESET_DEFAULTS: Readonly<Record<CrystalInteriorPreset, PresetDefaults>> =
  {
    'resonance-veins': {
      palette: { primary: 0xffa31a, secondary: 0xff3d12, accent: 0xffdf70 },
      intensity: 1.18,
      speed: 0.72,
    },
    'frost-roots': {
      palette: { primary: 0x00b7f5, secondary: 0x172bbf, accent: 0x34f5d0 },
      intensity: 1.22,
      speed: 0.4,
    },
    'aurora-heart': {
      palette: { primary: 0xff3cb9, secondary: 0x713cff, accent: 0x18dfff },
      intensity: 1,
      speed: 0.24,
    },
  }

const MIN_ENVELOPE_DIMENSION = 0.08
const MAX_ENVELOPE_DIMENSION = 12
const MIN_VISIBLE_FRACTION = 0.015

function finite(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new Error(`Crystal interior ${label} must be finite.`)
  return value
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function boundedDimension(value: number, label: string): number {
  const result = finite(value, label)
  if (result < MIN_ENVELOPE_DIMENSION || result > MAX_ENVELOPE_DIMENSION)
    throw new Error(
      `Crystal interior ${label} must be between ${MIN_ENVELOPE_DIMENSION} and ${MAX_ENVELOPE_DIMENSION} metres.`,
    )
  return result
}

function color(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff)
    throw new Error(`Crystal interior ${label} must be a 24-bit RGB integer.`)
  return value
}

export function normalizeCrystalInteriorSettings(
  settings: CrystalInteriorSettings,
): NormalizedCrystalInteriorSettings {
  if (!CRYSTAL_INTERIOR_PRESETS.includes(settings.preset))
    throw new Error(
      `Unknown crystal interior preset "${String(settings.preset)}".`,
    )
  const width = boundedDimension(settings.envelope.width, 'envelope.width')
  const height = boundedDimension(settings.envelope.height, 'envelope.height')
  const depth = boundedDimension(settings.envelope.depth, 'envelope.depth')
  const center = settings.envelope.center ?? [0, -height / 2, 0]
  if (center.length !== 3 || !center.every(Number.isFinite))
    throw new Error(
      'Crystal interior envelope.center must contain three finite numbers.',
    )
  const inset = finite(
    settings.envelope.inset ?? Math.min(width, height, depth) * 0.09,
    'envelope.inset',
  )
  if (inset < 0 || inset * 2 >= Math.min(width, height, depth))
    throw new Error(
      'Crystal interior envelope.inset must leave a positive volume on every axis.',
    )
  const defaults = PRESET_DEFAULTS[settings.preset]
  const intensity = clamp(
    finite(settings.intensity ?? defaults.intensity, 'intensity'),
    0,
    4,
  )
  const speed = clamp(finite(settings.speed ?? defaults.speed, 'speed'), 0, 4)
  const seed = finite(settings.seed, 'seed') >>> 0
  const palette = settings.palette ?? {}
  if (
    settings.quality !== undefined &&
    settings.quality !== 'high' &&
    settings.quality !== 'mobile'
  )
    throw new Error('Crystal interior quality must be "high" or "mobile".')
  return {
    preset: settings.preset,
    seed,
    envelope: {
      width,
      height,
      depth,
      center: [center[0], center[1], center[2]],
      inset,
    },
    palette: {
      primary: color(
        palette.primary,
        defaults.palette.primary,
        'palette.primary',
      ),
      secondary: color(
        palette.secondary,
        defaults.palette.secondary,
        'palette.secondary',
      ),
      accent: color(palette.accent, defaults.palette.accent, 'palette.accent'),
    },
    intensity,
    speed,
    reducedMotion: settings.reducedMotion ?? false,
    retractionAxis: settings.retractionAxis ?? 'x',
    quality: settings.quality ?? 'high',
  }
}

export function crystalInteriorRetractionMapping(
  visibleFraction: number,
): CrystalInteriorRetractionMapping {
  const fraction = clamp(finite(visibleFraction, 'visibleFraction'), 0, 1)
  const visible = fraction >= MIN_VISIBLE_FRACTION
  const visibility = visible
    ? clamp((fraction - MIN_VISIBLE_FRACTION) / 0.12, 0, 1)
    : 0
  return {
    visibleFraction: fraction,
    scale: visible ? fraction : MIN_VISIBLE_FRACTION,
    visibility,
    visible,
  }
}

export function crystalInteriorBounds(
  settings: NormalizedCrystalInteriorSettings,
): {
  readonly minimum: readonly [number, number, number]
  readonly maximum: readonly [number, number, number]
} {
  const { width, height, depth, center, inset } = settings.envelope
  return {
    minimum: [
      center[0] - width / 2 + inset,
      center[1] - height / 2 + inset,
      center[2] - depth / 2 + inset,
    ],
    maximum: [
      center[0] + width / 2 - inset,
      center[1] + height / 2 - inset,
      center[2] + depth / 2 - inset,
    ],
  }
}
