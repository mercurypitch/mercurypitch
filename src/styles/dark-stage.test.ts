// ============================================================
// Dark stage contract tests — immersive roots receive one complete palette
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

const contractCss = source('src/styles/dark-stage.css')
const contractBody =
  contractCss.match(/\.mp-dark-stage\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

const REQUIRED_TOKENS = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--bg-card',
  '--bg-input',
  '--surface',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--fg-primary',
  '--fg-secondary',
  '--fg-tertiary',
  '--border',
  '--border-secondary',
  '--border-subtle',
  '--accent',
  '--accent-hover',
  '--accent-dim',
  '--on-accent',
  '--success',
  '--success-dim',
  '--on-success',
  '--warning',
  '--warning-dim',
  '--on-warning',
  '--danger',
  '--danger-dim',
  '--on-danger',
  '--info',
  '--info-dim',
  '--on-info',
] as const

const hexToRgb = (hex: string): [number, number, number] => {
  const channels = hex
    .match(/[a-f\d]{2}/gi)
    ?.map((channel) => Number.parseInt(channel, 16))
  if (channels === undefined || channels.length !== 3) {
    throw new Error(`Expected a six-digit hex color, received ${hex}`)
  }
  return [channels[0], channels[1], channels[2]]
}

const luminance = ([red, green, blue]: [number, number, number]): number => {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (first: string, second: string): number => {
  const firstLuminance = luminance(hexToRgb(first))
  const secondLuminance = luminance(hexToRgb(second))
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  )
}

const contractToken = (name: string): string => {
  const value = contractBody.match(
    new RegExp(`${name}\\s*:\\s*(#[a-f\\d]{6})`, 'i'),
  )?.[1]
  if (value === undefined) throw new Error(`Missing literal value for ${name}`)
  return value
}

const scoreGradePalette = (
  grade: 's' | 'a' | 'b' | 'c' | 'd',
): { endpoints: [string, string]; foreground: string } => {
  const body = source('src/components/StemMixer.tsx').match(
    new RegExp(`\\.sm-mic-grade--${grade}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )?.[1]
  if (body === undefined) throw new Error(`Missing score grade ${grade}`)

  const gradient = body.match(
    /linear-gradient\(135deg,\s*(#[a-f\d]{6}),\s*(#[a-f\d]{6})\)/i,
  )
  const foreground = body.match(/color:\s*(#[a-f\d]{6});/i)?.[1]
  if (gradient === null || foreground === undefined) {
    throw new Error(`Incomplete score grade ${grade} palette`)
  }
  return { endpoints: [gradient[1], gradient[2]], foreground }
}

const DARK_SURFACE_ROOTS = [
  ['Stem Mixer', 'src/components/StemMixer.tsx'],
  ['Karaoke mobile Zen stage', 'src/components/KaraokeMobileStage.tsx'],
  ['Karaoke Night', 'src/features/karaoke-night/KaraokeNightApp.tsx'],
  ['Singing Zen', 'src/features/zen/ZenPitchStage.tsx'],
  ['Guitar Night', 'src/features/guitar-night/GuitarNightApp.tsx'],
  ['Piano Night', 'src/features/piano-night/PianoNightApp.tsx'],
  ['Progress', 'src/features/progress/ProgressPage.tsx'],
  ['Progress share studio', 'src/features/progress/ProgressShareStudio.tsx'],
  ['Path', 'src/pages/PathPage.tsx'],
] as const

describe('dark stage theme contract', () => {
  it('owns native scheme and every shared semantic token', () => {
    expect(contractBody.length).toBeGreaterThan(1_000)
    expect(contractBody).toMatch(/color-scheme:\s*dark;/)

    const declaredTokens = new Set(
      [...contractBody.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(
        (match) => match[1],
      ),
    )
    for (const token of REQUIRED_TOKENS) {
      expect(declaredTokens, `missing ${token}`).toContain(token)
    }
  })

  it.each(DARK_SURFACE_ROOTS)('%s opts in at its own root', (_, path) => {
    expect(source(path)).toContain('mp-dark-stage')
  })

  it('makes the Stem Mixer a stage in every app theme without double-fading', () => {
    const mixer = source('src/components/StemMixer.tsx')
    // The mixer always sits on a photographic backdrop and its panels are
    // glass over that photo. Inheriting a light app palette and fading it to
    // 57% over a dark photograph composites to mid grey and takes the
    // panel's own ink to 2.9:1, so the stage owns the palette instead.
    expect(mixer).toContain('class="stem-mixer mp-dark-stage"')
    expect(mixer).toContain(
      "'stem-mixer--performance': props.preset === 'performance'",
    )
    // The base block derives the glass from that palette. Re-declaring the
    // surfaces there would ask a custom property to read the value it
    // shadows, which is a cycle -- the handoff happens on `.stem-mixer > *`.
    expect(mixer).not.toMatch(/\.stem-mixer\s*\{[^}]*--bg-primary:/s)
  })

  it('gives controls distinct boundaries while keeping separators quiet', () => {
    const controlSurface = '#161b22'
    const borderContrast = contrast(contractToken('--border'), controlSurface)
    const secondaryContrast = contrast(
      contractToken('--border-secondary'),
      controlSurface,
    )
    const subtleContrast = contrast(
      contractToken('--border-subtle'),
      controlSurface,
    )

    expect(borderContrast).toBeGreaterThanOrEqual(3)
    expect(secondaryContrast).toBeGreaterThanOrEqual(3)
    expect(subtleContrast).toBeLessThan(3)
    expect(subtleContrast).toBeLessThan(borderContrast)
  })

  it('gives the fixed-dark score card a complete local dark scope', () => {
    expect(source('src/components/StemMixerScoreModal.tsx')).toContain(
      'sm-mic-score-card mp-dark-stage',
    )
  })

  it.each(['s', 'a', 'b', 'c', 'd'] as const)(
    'keeps grade %s readable across both gradient endpoints',
    (grade) => {
      const palette = scoreGradePalette(grade)
      for (const endpoint of palette.endpoints) {
        expect(
          contrast(palette.foreground, endpoint),
          `${grade.toUpperCase()} on ${endpoint}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('keeps bridged destructive actions readable on the stage danger fill', () => {
    expect(source('src/components/ConfirmDialog.module.css')).toMatch(
      /\.delete\s*\{[\s\S]*?color:\s*var\(--on-danger,\s*var\(--bg-primary,\s*#0d1117\)\);/,
    )
    expect(
      contrast(contractToken('--on-danger'), contractToken('--red')),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
