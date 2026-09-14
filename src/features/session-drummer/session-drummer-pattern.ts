// Session drummer arrangements repeat the existing original grooves with bounded, replace-not-stack fills.
import { drumPatternHits } from '@/features/drum-night/patterns/drum-pattern'
import { DRUM_PATTERNS } from '@/features/drum-night/patterns/drum-pattern-library'
import type { GuitarNightDrumKitId } from '@/features/guitar-night/guitar-night-drum-sound'
import { GUITAR_NIGHT_DRUM_KIT_IDS } from '@/features/guitar-night/guitar-night-drum-sound'

export const DRUMMER_BARS = [2, 4, 8, 16] as const
export const DRUMMER_STORAGE_KEY = 'mercurypitch.session-drummer.v1'
export interface SessionDrummerSettings {
  patternId: string
  bars: number
  fillEvery: number
  fillStyle: 'snare' | 'toms'
  tempoBpm: number
  kitId: GuitarNightDrumKitId
  level: number
}
export interface SessionDrummerHit {
  beat: number
  gmKey: number
  velocity: number
}
export const DEFAULT_DRUMMER_SETTINGS: SessionDrummerSettings = {
  patternId: 'rock-straight-backbeat',
  bars: 8,
  fillEvery: 4,
  fillStyle: 'toms',
  tempoBpm: 104,
  kitId: 'mercury-synth',
  level: 0.8,
}

export function drummerPattern(id: string) {
  return DRUM_PATTERNS.find((pattern) => pattern.id === id) ?? DRUM_PATTERNS[0]
}

/** The shipped grooves are 4/4; do not quietly lay them over another meter. */
export function drummerMeterReason(
  meters: readonly { numerator: number; denominator: number }[] = [],
): string | null {
  const unsupported = meters.find(
    (meter) => meter.numerator !== 4 || meter.denominator !== 4,
  )
  return unsupported
    ? `This score includes ${unsupported.numerator}/${unsupported.denominator}. The current drummer grooves need a 4/4 score, or a free-form session.`
    : null
}

export function normalizeDrummerSettings(
  value: unknown,
  kitId = DEFAULT_DRUMMER_SETTINGS.kitId,
): SessionDrummerSettings {
  const raw =
    value !== null && typeof value === 'object'
      ? (value as Partial<SessionDrummerSettings>)
      : {}
  const bars = DRUMMER_BARS.includes(raw.bars as 2 | 4 | 8 | 16) ? raw.bars! : 8
  const bounded = (
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback
  return {
    patternId: drummerPattern(raw.patternId ?? '').id,
    bars,
    fillEvery:
      [0, 2, 4, 8, 16].includes(raw.fillEvery ?? -1) && raw.fillEvery! <= bars
        ? raw.fillEvery!
        : Math.min(4, bars),
    fillStyle: raw.fillStyle === 'snare' ? 'snare' : 'toms',
    tempoBpm: Math.round(bounded(raw.tempoBpm, 104, 40, 300)),
    kitId: GUITAR_NIGHT_DRUM_KIT_IDS.includes(raw.kitId!) ? raw.kitId! : kitId,
    level: bounded(raw.level, 0.8, 0, 2),
  }
}

export function isDrummerFillBar(
  bar: number,
  settings: SessionDrummerSettings,
): boolean {
  return settings.fillEvery > 0 && (bar + 1) % settings.fillEvery === 0
}

export function arrangeDrummerPhrase(
  settings: SessionDrummerSettings,
): readonly SessionDrummerHit[] {
  const pattern = drummerPattern(settings.patternId)
  const source = drumPatternHits(pattern)
  const hits: SessionDrummerHit[] = []
  for (let bar = 0; bar < settings.bars; bar++) {
    const sourceBar = bar % pattern.bars
    const fill = isDrummerFillBar(bar, settings)
    for (const hit of source) {
      if (Math.floor(hit.startBeat / 4) !== sourceBar) continue
      const offset = hit.startBeat % 4
      // Keep the kick anchor; replace the last beat's hands, never stack a roll over them.
      if (fill && offset >= 3 && hit.gmKey !== 36) continue
      hits.push({
        beat: bar * 4 + offset,
        gmKey: hit.gmKey,
        velocity: hit.velocity,
      })
    }
    if (fill) {
      const keys =
        settings.fillStyle === 'snare' ? [38, 38, 38, 38] : [38, 48, 47, 45]
      keys.forEach((gmKey, index) =>
        hits.push({
          beat: bar * 4 + 3 + index / 4,
          gmKey,
          velocity: 80 + index * 8,
        }),
      )
    }
    const previousBar = (bar + settings.bars - 1) % settings.bars
    if (
      isDrummerFillBar(previousBar, settings) &&
      !hits.some((hit) => hit.beat === bar * 4 && hit.gmKey === 49)
    )
      hits.push({ beat: bar * 4, gmKey: 49, velocity: 96 })
  }
  return hits.sort((a, b) => a.beat - b.beat || a.gmKey - b.gmKey)
}

/** Surprise chooses another shipped groove, never starts input or invents a genre. */
export function surpriseDrummer(
  settings: SessionDrummerSettings,
  random = Math.random,
): SessionDrummerSettings {
  const choices = DRUM_PATTERNS.filter(
    (pattern) => pattern.id !== settings.patternId,
  )
  const pick =
    choices[
      Math.min(
        choices.length - 1,
        Math.max(0, Math.floor(random() * choices.length)),
      )
    ]
  return { ...settings, patternId: pick.id, tempoBpm: pick.tempoBpm }
}
