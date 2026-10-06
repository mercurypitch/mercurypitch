// Game appearance preferences — bounded presentation values independent of scene and audio state.
export const GAME_APPEARANCE_KEY = 'glass-ui-appearance:v1'
export const GAME_MATERIAL_KEY = 'glass-ui-material:v1'
export type GameTheme = 'light' | 'dark'
export type GameAppearanceChoice = GameTheme | 'app'
export interface GameAppearancePreference {
  theme: GameAppearanceChoice
  reducedTransparency: boolean
}
export interface GameMaterialValues {
  opacity: number
  gloss: number
  rim: number
  gold: number
  corner: number
  padding: number
  target: number
}
export const DEFAULT_GAME_MATERIAL: Readonly<GameMaterialValues> = {
  opacity: 0.88,
  gloss: 0.65,
  rim: 0.85,
  gold: 0.65,
  corner: 24,
  padding: 24,
  target: 80,
}
export const GAME_MATERIAL_RANGES = {
  opacity: [0.72, 1, 0.01],
  gloss: [0, 1, 0.05],
  rim: [0.35, 1, 0.05],
  gold: [0, 1, 0.05],
  corner: [16, 32, 1],
  padding: [16, 32, 1],
  target: [72, 96, 2],
} as const satisfies Record<
  keyof GameMaterialValues,
  readonly [number, number, number]
>

function objectFromJson(raw: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw)
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
export function readGameAppearance(
  raw: string | null,
): GameAppearancePreference {
  const value = objectFromJson(raw)
  return {
    theme:
      value.theme === 'dark' || value.theme === 'app' ? value.theme : 'light',
    reducedTransparency: value.reducedTransparency === true,
  }
}
export function normalizeGameMaterial(
  value: Partial<GameMaterialValues>,
): GameMaterialValues {
  const result = { ...DEFAULT_GAME_MATERIAL }
  for (const key of Object.keys(result) as (keyof GameMaterialValues)[]) {
    const [minimum, maximum] = GAME_MATERIAL_RANGES[key]
    const candidate = value[key]
    if (typeof candidate === 'number' && Number.isFinite(candidate))
      result[key] = Math.max(minimum, Math.min(maximum, candidate))
  }
  return result
}
export function readGameMaterial(raw: string | null): GameMaterialValues {
  return normalizeGameMaterial(objectFromJson(raw))
}
/** MercuryPitch uses nine presets: light is the sole light preset; Beside Cue defaults to light. */
export function gameThemeFromApp(preset: string | null): GameTheme {
  return preset !== null &&
    [
      'dark',
      'midnight',
      'forest',
      'ocean',
      'cyberpunk',
      'rose',
      'amber',
      'slate',
    ].includes(preset)
    ? 'dark'
    : 'light'
}
