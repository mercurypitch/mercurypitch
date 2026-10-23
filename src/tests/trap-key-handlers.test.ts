// ============================================================
// Inside a focus trap that isolates the keyboard, key handlers are native
// ============================================================
//
// useFocusTrap({ isolateKeyboard: true }) stops every keydown at the trap's
// root, so none reaches the document. Solid binds `onKeyDown` and `onKeyUp`
// (in any letter case) through one listener on the document, which a stopped
// key never reaches: a handler written that way inside such a trap goes
// silent, and nothing says so. A native `on:keydown` binds on its element and
// is heard. Only keydown is stopped today, and `onKeyPress` is not delegated at
// all (babel-preset-solid 1.9.12 compiles it to a listener on its element), so
// no stop above the element silences it. All three are held to the same rule
// anyway: the rule is one, and it does not wait for the day a trap stops more.
//
// "Inside the trap" is everything the host renders: its import closure, not a
// folder. First Light draws components from room-kit, billing, shared and the
// mirror feature, and the plan layer shares its screens with First Light; the
// Home plan card sits in the plan folder and is under no trap, so a folder
// scan would be wrong both ways. The walk resolves a specifier as the bundler
// does (`@/` is src/, a relative path is relative; npm packages are left out)
// and follows type-only and dynamic imports as well, which only makes it
// stricter. It reads the files from the repo this file sits in, so a copy of
// the file in <tree>/src/tests/ scans <tree>.
//
// HOSTS is every file in src that passes `isolateKeyboard: true` (ruling R72).
// One case fails when a file passes the option and is missing from HOSTS, and
// when an entry no longer passes it, so a new host cannot be forgotten.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The repo this file sits in: src/tests/ is two levels down. */
const ROOT = resolve(__dirname, '../..')

/**
 * Every host: a file that passes `isolateKeyboard: true` to its focus trap,
 * each with files the walk from it must reach, so that a resolver which stops
 * following imports fails here and does not pass on nothing.
 */
const HOSTS = [
  {
    name: 'First Light',
    entry: 'src/features/onboarding/FirstLight.tsx',
    reaches: [
      'src/features/onboarding/beats/BeatMap.tsx',
      'src/features/plan/PlanQuestions.tsx',
      'src/components/room-kit/MercPresence.tsx',
      'src/lib/use-focus-trap.ts',
    ],
  },
  {
    name: 'the plan layer',
    entry: 'src/features/plan/PlanLayer.tsx',
    reaches: [
      'src/features/plan/PlanQuestions.tsx',
      'src/features/plan/PlanScreen.tsx',
      'src/components/room-kit/MercPresence.tsx',
      'src/lib/use-focus-trap.ts',
    ],
  },
  {
    name: 'the Guitar Night mix controls',
    entry: 'src/features/guitar-night/GuitarNightMixControls.tsx',
    reaches: ['src/components/icons.tsx', 'src/lib/use-focus-trap.ts'],
  },
  {
    name: 'the Night music import',
    entry: 'src/features/play-along/NightMusicImport.tsx',
    reaches: [
      'src/features/play-along/night-music-import.ts',
      'src/lib/file-picker.ts',
      'src/lib/use-focus-trap.ts',
    ],
  },
  {
    name: 'the stem mixer score modal',
    entry: 'src/components/StemMixerScoreModal.tsx',
    reaches: ['src/lib/mic-scoring.ts', 'src/lib/use-focus-trap.ts'],
  },
  {
    name: 'the voice type picker',
    entry: 'src/components/key-shift/VoiceTypePicker.tsx',
    reaches: [
      'src/lib/key-shift/key-shift.ts',
      'src/stores/settings-store.ts',
      'src/lib/use-focus-trap.ts',
    ],
  },
]

/**
 * A key prop on a JSX element in any letter case: ` onKeyDown={`, ` onkeyup={`,
 * ` onKeypress={`. The native `on:keydown` has a colon and is not one, and
 * neither is a typed prop (`onKeyDown?: ...`) or a function that is named
 * onKeyDown (`const onKeyDown = (e) => ...`).
 */
const KEY_PROP = /\son(?:keydown|keyup|keypress)\s*=\s*\{/gi

/** A host's call to the focus trap: `isolateKeyboard: true`. A comment that says so is a host to the finder too. */
const PASSES_ISOLATE_KEYBOARD = /\bisolateKeyboard\s*:\s*true\b/

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

/** `import x from 'a'`, `export * from 'a'`, `import 'a'`, `import type ... from 'a'` and `import('a')`. */
const IMPORT_SPECIFIER =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

const read = (file: string): string => readFileSync(resolve(ROOT, file), 'utf8')

/** The source file a specifier names from `from`, or null for a package or a file that is not source. */
function resolveImport(from: string, specifier: string): string | null {
  let base: string
  if (specifier.startsWith('@/')) base = join(ROOT, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier)
  else return null
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => base + extension),
    ...SOURCE_EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ]
  return (
    candidates.find(
      (candidate) =>
        SOURCE_EXTENSIONS.includes(extname(candidate)) &&
        existsSync(candidate) &&
        statSync(candidate).isFile(),
    ) ?? null
  )
}

/** `entry` and every file it imports, directly or not, as paths from the repo root, sorted. */
function importClosure(entry: string): string[] {
  const seen = new Set<string>()
  const queue = [resolve(ROOT, entry)]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_SPECIFIER)) {
      const next = resolveImport(file, (match[1] ?? match[2]) as string)
      if (next !== null) queue.push(next)
    }
  }
  return [...seen].map((file) => relative(ROOT, file)).sort()
}

/** Each key prop in `source`, as `file:line the line`. Only a .tsx or .jsx file has JSX, so only one has a prop. */
function keyProps(file: string, source: string): string[] {
  if (!/\.[jt]sx$/.test(file)) return []
  const lines = source.split('\n')
  return [...source.matchAll(KEY_PROP)].map((match) => {
    // The match opens with one whitespace character, then the prop's name.
    const line = source.slice(0, (match.index ?? 0) + 1).split('\n').length
    return `${file}:${line} ${lines[line - 1]?.trim()}`
  })
}

/** Every .ts and .tsx file under `dir` that is not a test, as paths from the repo root, sorted. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(path)
      const isSource =
        /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)
      return isSource ? [relative(ROOT, path)] : []
    })
    .sort()
}

describe('inside a focus trap that isolates the keyboard', () => {
  it.each(HOSTS)(
    '$name and every file it imports have no onKeyDown, onKeyUp or onKeyPress prop',
    ({ entry }) => {
      const found = importClosure(entry).flatMap((file) =>
        keyProps(file, read(file)),
      )

      expect(found).toEqual([])
    },
  )

  it.each(HOSTS)(
    'the walk from $name reaches the files that bring keys in',
    ({ entry, reaches }) => {
      expect(importClosure(entry)).toEqual(
        expect.arrayContaining([entry, ...reaches]),
      )
    },
  )

  it('has as its hosts exactly the files in src that pass isolateKeyboard: true', () => {
    const passing = sourceFiles(join(ROOT, 'src')).filter((file) =>
      PASSES_ISOLATE_KEYBOARD.test(read(file)),
    )

    expect(
      passing,
      'HOSTS and the files in src that pass isolateKeyboard: true differ',
    ).toEqual(HOSTS.map((host) => host.entry).sort())
  })

  it('rejects onKeyDown, onkeydown, onKeydown, onKeyUp and onKeyPress as a prop, also when the prop starts its own line', () => {
    const rejected = [
      '<span onKeyDown={go}>',
      '<span onkeydown={go}>',
      '<span onKeydown={go}>',
      '<span onKeyUp={go}>',
      '<span onKeyPress={go}>',
      '<span\n  id="x"\n  onKeyDown={go}\n>',
    ]

    expect(
      rejected.filter((source) => keyProps('a.tsx', source).length === 0),
    ).toEqual([])
  })

  it('accepts on:keydown, onClick, a typed onKeyDown prop, a function named onKeyDown, and the same text in a .ts file', () => {
    const accepted = [
      '<span on:keydown={go}>',
      '<span onClick={go}>',
      'onKeyDown?: (e: KeyboardEvent) => void',
      'const onKeyDown = (e: KeyboardEvent) => go(e)',
    ]

    expect(
      accepted.filter((source) => keyProps('a.tsx', source).length > 0),
    ).toEqual([])
    expect(keyProps('a.ts', '<span onKeyDown={go}>')).toEqual([])
  })

  it('names the file and line of a prop it rejects', () => {
    expect(keyProps('a.tsx', '<span\n  id="x"\n  onKeyDown={go}\n>')).toEqual([
      'a.tsx:3 onKeyDown={go}',
    ])
  })
})
