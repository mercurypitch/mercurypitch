// @vitest-environment node
//
// ── `pnpm typecheck:db` reaches every DB Worker file ─────────────────
//
// Vitest strips types, so a .ts file that no tsc program includes can carry
// type errors indefinitely without anything going red. These node-tests sat
// in no tsconfig until node-tests/tsconfig.json, and eight errors had piled
// up by then. This holds the arrangement in place:
//
// - every file under node-tests/ is a root of a program typecheck:db runs;
// - every file under src/ is a root of one that leaves Node's types out, so
//   process, Buffer and node:* imports stay errors in code bound for Workers.
//
// The programs are read from the script itself, so the configs can change
// shape freely as long as no file falls outside them.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WORKER = resolve(import.meta.dirname, '..')
const REPO = resolve(WORKER, '../..')

interface Program {
  config: string
  parsed: ts.ParsedCommandLine
  errors: ts.Diagnostic[]
}

/** The tsc programs `pnpm typecheck:db` runs, read from package.json. */
function typecheckPrograms(): Program[] {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
  const script = pkg.scripts['typecheck:db']
  // Each `tsc -p <dir>` names a directory that holds a tsconfig.json.
  return [...script.matchAll(/\btsc\b[^&]*?(?:-p|--project)\s+(\S+)/g)].map(
    ([, project]) => {
      const config = join(REPO, project, 'tsconfig.json')
      const read = ts.readConfigFile(config, ts.sys.readFile)
      const parsed = ts.parseJsonConfigFileContent(
        read.config,
        ts.sys,
        dirname(config),
        undefined,
        config,
      )
      const errors = [read.error, ...parsed.errors].filter(
        (error) => error !== undefined,
      )
      return { config, parsed, errors }
    },
  )
}

/** Repo-relative paths of the .ts files under `dir`. */
function tsFilesUnder(dir: string): string[] {
  return readdirSync(dir, { encoding: 'utf8', recursive: true })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => relative(REPO, join(dir, file)))
}

/** The files under `dir` that no program in `programs` has as a root. */
function missedUnder(dir: string, programs: Program[]): string[] {
  const rooted = new Set(
    programs.flatMap(({ parsed }) =>
      parsed.fileNames.map((file) => relative(REPO, file)),
    ),
  )
  return tsFilesUnder(dir).filter((file) => !rooted.has(file))
}

const programs = typecheckPrograms()

describe('pnpm typecheck:db', () => {
  it('runs at least one program, and every config it names parses cleanly', () => {
    expect(programs.length).toBeGreaterThan(0)
    for (const { config, errors } of programs) {
      expect(errors, relative(REPO, config)).toEqual([])
    }
  })

  it('type-checks every file under node-tests/', () => {
    expect(missedUnder(join(WORKER, 'node-tests'), programs)).toEqual([])
  })

  it('type-checks every file under src/ in a program without Node types', () => {
    // An unset `types` loads every @types package, @types/node among them.
    const nodeFree = programs.filter(({ parsed }) => {
      const types = parsed.options.types
      return Array.isArray(types) && !types.includes('node')
    })
    expect(missedUnder(join(WORKER, 'src'), nodeFree)).toEqual([])
  })
})
