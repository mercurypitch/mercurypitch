// First note loads its pitch read only when it reads a song of the
// singer's own: the read (own-song-read.ts), the rules it reads by
// (entry-rules.ts) and the beats (band-beats.ts) are a dynamic import away
// from the room, so a singer of the examples alone never loads them. The
// check walks what the room imports statically, file by file, as the
// bundler resolves it (`@/` is src/, a relative path is relative, packages
// and type-only imports are left out).

import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const SOURCE = ['.ts', '.tsx']
const STATIC =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]/g
const READ = [
  'src/features/first-note/own-song-read.ts',
  'src/features/first-note/entry-rules.ts',
  'src/features/first-note/band-beats.ts',
]

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

function staticClosure(entry: string): string[] {
  const seen = new Set<string>()
  const queue = [resolve(ROOT, entry)]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC)) {
      const next = resolveImport(file, match[1])
      if (next !== null) queue.push(next)
    }
  }
  return [...seen].map((file) => relative(ROOT, file)).sort()
}

describe("First note's room", () => {
  it('loads the pitch read and its rules only when it reads a song', () => {
    const files = staticClosure('src/features/first-note/FirstNoteRoom.tsx')

    expect(files).toEqual(
      expect.arrayContaining([
        'src/features/first-note/first-note-own-songs.ts',
        'src/features/first-note/entry-rules-version.ts',
      ]),
    )
    expect(files.filter((file) => READ.includes(file))).toEqual([])
  })
})
