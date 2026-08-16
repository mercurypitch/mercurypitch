// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// JSDOM does not resolve CSS custom properties. These source-contract checks
// keep the audited semantic roles attached to the real selectors, then verify
// the opaque badge pairs with the same WCAG luminance calculation a browser
// audit uses.

const css = {
  analysis: read('../../features/analysis/AnalysisDashboard.module.css'),
  app: read('../../styles/app.css'),
  exercises: read('../../styles/exercises.css'),
  home: read('../../pages/HomePage.module.css'),
  settings: read('../../components/SettingsPanel.module.css'),
  singing: read('../../components/SingingCanvasHud.module.css'),
  themePicker: read('../../components/ThemePicker.module.css'),
  weeklyLegend: read('../../features/challenges/WeeklyLegendHero.module.css'),
  mobilePolish: read('../../styles/mobile-polish.css'),
}

function read(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf-8')
}

function ruleBlock(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's').exec(source)?.[1] ?? ''
}

function tokenValue(source: string, selector: string, token: string): string {
  const block = ruleBlock(source, selector)
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const value = new RegExp(`${escaped}:\\s*(#[0-9a-f]{6})`, 'i').exec(
    block,
  )?.[1]
  if (value === undefined) {
    throw new Error(`Missing ${token} in ${selector}`)
  }
  return value
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => Number.parseInt(part, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )

  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

function contrastRatio(foreground: string, background: string): number {
  const values = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a)
  return (values[0]! + 0.05) / (values[1]! + 0.05)
}

describe('adaptive theme surface contracts', () => {
  it('keeps primary accent actions on the theme-owned foreground', () => {
    const cases: Array<[string, string, string]> = [
      ['Home', css.home, '.primaryBtn'],
      ['Home routine', css.home, '.segStart'],
      ['Home account', css.home, '.accountNudgeCta'],
      ['Weekly Legend', css.weeklyLegend, '.singBtn'],
      ['Exercise card', css.exercises, '.exercise-card-start-btn'],
      ['Exercise runner', css.exercises, '.exercise-btn-primary'],
      ['Theme source', css.themePicker, '.sourceBtnActive:hover'],
      ['Theme check', css.themePicker, '.check'],
      ['Settings link', css.settings, '.aboutLink:hover'],
      ['Settings action', css.settings, '.settingsBtn:hover:not(:disabled)'],
      ['Analysis', css.analysis, '.primaryBtn'],
      ['Analysis stop', css.analysis, '.stopBtn'],
    ]

    for (const [label, source, selector] of cases) {
      const expected =
        label === 'Analysis stop'
          ? 'color: var(--status-danger-on-fill, var(--bg-primary));'
          : 'color: var(--on-accent, var(--bg-primary));'
      expect(ruleBlock(source, selector), label).toContain(expected)
    }
  })

  it('keeps audited instructional labels on the readable secondary tier', () => {
    const cases: Array<[string, string, string[]]> = [
      [
        'Home',
        css.home,
        [
          '.date',
          '.streakLabel',
          '.freezeCount',
          '.goalText',
          '.sessionTime',
          '.segExercise',
          '.segDur',
          '.segSkip',
          '.segStep',
          '.linkBtn',
          '.statLabel',
        ],
      ],
      [
        'Weekly Legend',
        css.weeklyLegend,
        ['.countdown', '.boardStat', '.rankNum', '.allLink', '.attemptHint'],
      ],
      [
        'Singing HUD',
        css.singing,
        [
          '.railKicker',
          '.cardTitle',
          '.scoreLabel',
          '.emptyRail',
          '.railFooter',
        ],
      ],
      [
        'Settings',
        css.settings,
        [
          '.settingsDesc',
          '.keymapRow.keymapHeader',
          '.settingsRow small',
          '.dangerConfirmText',
          '.aboutVersion',
          '.aboutCredits',
        ],
      ],
      [
        'Theme picker',
        css.themePicker,
        ['.sourceBtn', '.autoLabel', '.autoHint'],
      ],
      [
        'Analysis',
        css.analysis,
        [
          '.subtitle',
          '.pickerLabel',
          '.takeMeta',
          '.badgeSummary',
          '.cardNote',
          '.statLabel',
          '.statDetail',
          '.ratingCount',
          '.traceAxis',
          '.trendFoot',
          '.noteCents',
          '.empty',
          '.unavailable',
        ],
      ],
    ]

    for (const [surface, source, selectors] of cases) {
      for (const selector of selectors) {
        expect(ruleBlock(source, selector), `${surface} ${selector}`).toMatch(
          /color:\s*var\(--text-secondary(?:,|\))/,
        )
      }
    }
  })

  it('keeps small exercise badges above the 4.5:1 AA floor in both themes', () => {
    const pairs = [
      ['--exercise-tag-fg', '--exercise-tag-bg'],
      ['--exercise-easy-fg', '--exercise-easy-bg'],
      ['--exercise-medium-fg', '--exercise-medium-bg'],
      ['--exercise-hard-fg', '--exercise-hard-bg'],
      ['--exercise-elite-fg', '--exercise-elite-bg'],
      ['--exercise-great-fg', '--exercise-great-bg'],
      ['--exercise-good-fg', '--exercise-good-bg'],
      ['--exercise-novice-fg', '--exercise-novice-bg'],
    ] as const
    const themes = [
      ['dark', '.exercises-panel'],
      ['light', "[data-theme='light'] .exercises-panel"],
    ] as const

    for (const [theme, selector] of themes) {
      for (const [foregroundToken, backgroundToken] of pairs) {
        const foreground = tokenValue(css.exercises, selector, foregroundToken)
        const background = tokenValue(css.exercises, selector, backgroundToken)

        expect(
          contrastRatio(foreground, background),
          `${theme} ${foregroundToken}/${backgroundToken}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps recent-score colors theme-owned and protects the stop hover', () => {
    const exerciseMenu = read('../../features/exercises/ExerciseMenu.tsx')

    for (const token of [
      '--exercise-score-high',
      '--exercise-score-mid',
      '--exercise-score-low',
    ]) {
      expect(exerciseMenu).toContain(`var(${token})`)
    }

    expect(ruleBlock(css.analysis, '.stopBtn:hover:not(:disabled)')).toContain(
      'background: var(--danger);',
    )
    expect(ruleBlock(css.settings, '.pitchBufferPills')).toMatch(
      /background:\s*var\(--bg-secondary\)[\s\S]*border:\s*1px solid var\(--border\)/,
    )
    expect(ruleBlock(css.settings, '.pitchBufferPill')).toContain(
      'color: var(--text-secondary);',
    )
    expect(ruleBlock(css.settings, '.pitchBufferPillActive')).toMatch(
      /background:\s*var\(--pitch-buffer-active-bg\)[\s\S]*color:\s*var\(--pitch-buffer-active-fg\)/,
    )
    expect(ruleBlock(css.settings, '.pitchBufferPillActive:hover')).toMatch(
      /background:\s*var\(--pitch-buffer-active-bg\)[\s\S]*color:\s*var\(--pitch-buffer-active-fg\)/,
    )
  })

  it('keeps Settings and exercise history readable on their actual surfaces', () => {
    const lightPillForeground = tokenValue(
      css.settings,
      "[data-theme='light'] .pitchBufferPills",
      '--pitch-buffer-active-fg',
    )
    const lightPillBackground = tokenValue(
      css.settings,
      "[data-theme='light'] .pitchBufferPills",
      '--pitch-buffer-active-bg',
    )
    expect(
      contrastRatio(lightPillForeground, lightPillBackground),
      'light active buffer pill',
    ).toBeGreaterThanOrEqual(4.5)

    const desktopHistoryPairs = [
      ['--exercise-history-muted', '#363a3f'],
      ['--exercise-history-good', '#363a3f'],
      ['--exercise-history-ok', '#363a3f'],
      ['--exercise-history-poor', '#363a3f'],
    ] as const
    for (const [foregroundToken, worstCaseGlass] of desktopHistoryPairs) {
      expect(
        contrastRatio(
          tokenValue(css.exercises, '.exercise-score-history', foregroundToken),
          worstCaseGlass,
        ),
        `desktop history ${foregroundToken}`,
      ).toBeGreaterThanOrEqual(4.5)
    }

    const mobileHistory = ruleBlock(css.mobilePolish, '.exercise-score-history')
    expect(mobileHistory).toContain('background: var(--bg-tertiary);')
    expect(mobileHistory).toContain(
      '--exercise-history-muted: var(--text-secondary);',
    )
    for (const token of [
      '--exercise-score-high',
      '--exercise-score-mid',
      '--exercise-score-low',
    ]) {
      expect(mobileHistory).toContain(`var(${token})`)
    }

    const mobileThemes = [
      {
        name: 'dark',
        scoreSelector: '#exercises-panel',
        appSelector: ':root',
      },
      {
        name: 'light',
        scoreSelector: "[data-theme='light'] #exercises-panel",
        appSelector: "[data-theme='light']",
      },
    ] as const
    for (const theme of mobileThemes) {
      const surface = tokenValue(css.app, theme.appSelector, '--bg-tertiary')
      const foregrounds = [
        tokenValue(css.app, theme.appSelector, '--text-secondary'),
        ...[
          '--exercise-score-high',
          '--exercise-score-mid',
          '--exercise-score-low',
        ].map((token) => tokenValue(css.exercises, theme.scoreSelector, token)),
      ]
      for (const foreground of foregrounds) {
        expect(
          contrastRatio(foreground, surface),
          `${theme.name} mobile history ${foreground}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('retains keyboard focus and a distinct disabled treatment for actions', () => {
    const stateContracts: Array<[string, string, string, string]> = [
      [
        'Home',
        css.home,
        '.accountNudgeCta:focus-visible',
        '.accountNudgeCta:disabled',
      ],
      [
        'Weekly Legend',
        css.weeklyLegend,
        '.singBtn:focus-visible',
        '.singBtn:disabled',
      ],
      [
        'Exercises',
        css.exercises,
        '.exercise-btn-primary:focus-visible',
        '.exercise-btn-primary:disabled',
      ],
      [
        'Theme picker',
        css.themePicker,
        '.sourceBtn:focus-visible',
        '.sourceBtn:disabled',
      ],
      [
        'Settings',
        css.settings,
        '.settingsBtn:focus-visible',
        '.settingsBtn:disabled',
      ],
      [
        'Analysis',
        css.analysis,
        '.ghostBtn:focus-visible',
        '.ghostBtn:disabled',
      ],
    ]

    for (const [
      surface,
      source,
      focusSelector,
      disabledSelector,
    ] of stateContracts) {
      expect(ruleBlock(source, focusSelector), `${surface} focus`).toMatch(
        /(?:outline:\s*2px solid var\(--accent\)|box-shadow:)/,
      )
      expect(
        ruleBlock(source, disabledSelector),
        `${surface} disabled`,
      ).toMatch(/cursor:\s*not-allowed[\s\S]*opacity:\s*0\.55/)
    }
  })
})
