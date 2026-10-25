// The coach never brings the app shell in. Karaoke Night and the lessons
// start Merc tours too, and they are standalone documents: one import of
// src/stores/app-store.ts, or of the @/stores barrel that re-exports it,
// anywhere under the coach would pull the whole app into their tour chunk.
// So the check walks what the coach imports, statically or not, file by
// file, as the bundler resolves it (`@/` is src/, a relative path is
// relative, packages are left out), and not only the coach's own folder.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../..')
const COACH = 'src/features/tours/coach'
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

const coachFiles = (): string[] =>
  readdirSync(join(ROOT, COACH))
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name))
    .map((name) => `${COACH}/${name}`)

describe('the coach', () => {
  it('never imports the app store, however far down', () => {
    const files = closure([...coachFiles(), 'src/lib/coach-events.ts'])

    expect(files).toEqual(
      expect.arrayContaining([
        `${COACH}/start.ts`,
        `${COACH}/runner.ts`,
        `${COACH}/CoachLayer.tsx`,
        'src/components/room-kit/MercPresence.tsx',
      ]),
    )
    expect(files.filter((file) => APP_SHELL.includes(file))).toEqual([])
  })

  it('names neither the app store nor the stores barrel in its own files', () => {
    const named = [...coachFiles(), 'src/lib/coach-events.ts'].filter((file) =>
      /stores\/app-store|from\s+['"]@\/stores['"]/.test(
        readFileSync(join(ROOT, file), 'utf8'),
      ),
    )

    expect(named).toEqual([])
  })
})
