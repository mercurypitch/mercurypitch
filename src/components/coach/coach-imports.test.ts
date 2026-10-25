// The coach never brings the app shell in. Karaoke Night and the lessons
// start Merc tours too, and they are standalone documents: one import of
// src/stores/app-store.ts, or of the @/stores barrel that re-exports it,
// anywhere under the coach would pull the whole app into their tour chunk.
// So the check walks what the coach imports, statically or not, file by
// file, as the bundler resolves it (`@/` is src/, a relative path is
// relative, packages are left out), and not only the coach's own folders:
// its engine here, the showcase in src/features/tours/coach, and its state,
// types and event bus in src/lib.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const COACH = 'src/components/coach'
const SHOWCASE = 'src/features/tours/coach'
const COACH_LIB = [
  'src/lib/coach-events.ts',
  'src/lib/coach-state.ts',
  'src/lib/coach-types.ts',
]
const SOURCE = ['.ts', '.tsx']
const SPECIFIER =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
const APP_SHELL = ['src/stores/app-store.ts', 'src/stores/index.ts']

function resolveImport(from: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = join(ROOT, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier)
  else return null
  const candidates = [
    base,
    ...SOURCE.map((ext) => base + ext),
    ...SOURCE.map((ext) => join(base, `index${ext}`)),
  ]
  return (
    candidates.find(
      (file) =>
        SOURCE.includes(extname(file)) &&
        existsSync(file) &&
        statSync(file).isFile(),
    ) ?? null
  )
}

function closure(entries: string[]): string[] {
  const seen = new Set<string>()
  const queue = entries.map((entry) => resolve(ROOT, entry))
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const next = resolveImport(file, (match[1] ?? match[2]) as string)
      if (next !== null) queue.push(next)
    }
  }
  return [...seen].map((file) => relative(ROOT, file)).sort()
}

const sourcesIn = (folder: string): string[] =>
  readdirSync(join(ROOT, folder))
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name))
    .map((name) => `${folder}/${name}`)

const coachFiles = (): string[] => [
  ...sourcesIn(COACH),
  ...sourcesIn(SHOWCASE),
  ...COACH_LIB,
]

describe('the coach', () => {
  it('never imports the app store, however far down', () => {
    const files = closure(coachFiles())

    expect(files).toEqual(
      expect.arrayContaining([
        `${COACH}/start.ts`,
        `${COACH}/runner.ts`,
        `${COACH}/CoachLayer.tsx`,
        `${SHOWCASE}/start-showcase.ts`,
        'src/components/room-kit/MercPresence.tsx',
      ]),
    )
    expect(files.filter((file) => APP_SHELL.includes(file))).toEqual([])
  })

  it('names neither the app store nor the stores barrel in its own files', () => {
    const named = coachFiles().filter((file) =>
      /stores\/app-store|from\s+['"]@\/stores['"]/.test(
        readFileSync(join(ROOT, file), 'utf8'),
      ),
    )

    expect(named).toEqual([])
  })
})

// A room's tour lives beside its room and loads with the coach, so it is held
// to the coach's rule: Karaoke Night starts its tour from a document that
// must never carry the app (src/features/karaoke-night/main.tsx).
describe("the tours' own modules", () => {
  it('never import the app store, however far down', () => {
    const files = closure([
      'src/features/practice/sing-tour.ts',
      'src/features/karaoke-night/karaoke-tour.ts',
      'src/features/karaoke-night/karaoke-tour-offer.ts',
      'src/features/karaoke-night/start-karaoke-tour.ts',
      'src/features/karaoke-night/KaraokeTourChip.tsx',
    ])

    expect(files).toEqual(
      expect.arrayContaining([
        `${COACH}/start.ts`,
        `${COACH}/TourChip.tsx`,
        'src/components/billing/plan-credits.ts',
        'src/lib/credit-facts.ts',
        'src/lib/standalone-account.ts',
      ]),
    )
    expect(files.filter((file) => APP_SHELL.includes(file))).toEqual([])
  })
})
