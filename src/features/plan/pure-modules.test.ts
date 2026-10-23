// ============================================================
// Plan — the modules that import no store
// ============================================================
//
// The plan's content, rules, record and events are read by lesson pages,
// by the funnel and by the screens, so none of them may pull the app's
// stores in with it: a store import drags the whole app state into every
// reader. plan-keys.ts goes further and imports nothing at all, because a
// lesson page reads it and a lesson bundle must not grow for knowing where
// the plan lives.

import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Later tasks add plan-record.ts and plan-events.ts to this list.
const PURE_MODULES: [file: string, mayImport: 'nothing' | 'no store'][] = [
  ['plan-keys.ts', 'nothing'],
  ['questions.ts', 'no store'],
  ['plan-copy.ts', 'no store'],
  ['build-plan.ts', 'no store'],
]

/** Every module a source file imports, as it is written there. */
function importedModules(source: string): string[] {
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map((file) => file.fileName)
}

describe('the pure plan modules', () => {
  it('finds a static import, a type import, a re-export and a dynamic import', () => {
    const source = [
      "import { a } from '@/stores/app-store'",
      "import type { B } from './b'",
      "export * from './c'",
      "const d = () => import('./d')",
      '// import { e } from "./e"',
    ].join('\n')

    expect(importedModules(source)).toEqual([
      '@/stores/app-store',
      './b',
      './c',
      './d',
    ])
  })

  it('keeps each of them to the imports it is allowed', () => {
    const found = PURE_MODULES.flatMap(([file, mayImport]) =>
      importedModules(readFileSync(`src/features/plan/${file}`, 'utf8'))
        .filter((module) => mayImport === 'nothing' || /stores/u.test(module))
        .map((module) => `${file} imports ${module}`),
    )

    expect(found).toEqual([])
  })
})
