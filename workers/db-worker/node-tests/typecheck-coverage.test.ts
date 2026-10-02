// @vitest-environment node
//
// ── `pnpm typecheck:db` reaches every DB Worker file ─────────────────
//
// Vitest strips types, so a .ts file that no tsc program includes can carry
// type errors indefinitely without anything going red. These node-tests sat
// in no tsconfig until node-tests/tsconfig.json, and eight errors had piled
// up by then. This holds the arrangement in place:
//
// - every .ts file under workers/db-worker is a root of a program
//   typecheck:db runs;
// - every file under src/ is also a root of one that never loads Node's
//   types, so process, Buffer and node:* imports stay errors in code bound
//   for Workers.
//
// The programs are read from the script itself, flags included, so the
// configs can change shape freely as long as no file falls outside them.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const WORKER = resolve(import.meta.dirname, '..')
const REPO = resolve(WORKER, '../..')

interface Program {
  config: string
  parsed: ts.ParsedCommandLine
  errors: ts.Diagnostic[]
}

/**
 * The config tsc reads for `-p <project>`: a directory's tsconfig.json or the
 * file named, and with no -p at all, the tsconfig.json where the script runs.
 */
function configFor(project: string | undefined): string {
  if (project === undefined) return join(REPO, 'tsconfig.json')
  const path = resolve(REPO, project)
  return ts.sys.directoryExists(path) ? join(path, 'tsconfig.json') : path
}

/**
 * The tsc programs `pnpm typecheck:db` runs, read from package.json. Flags on
 * a command line override its config, as they do for tsc.
 */
function typecheckPrograms(): Program[] {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
  }
  return pkg.scripts['typecheck:db']
    .split('&&')
    .map((command) => command.trim().split(/\s+/))
    .filter((words) => words.includes('tsc'))
    .map((words) => {
      const cli = ts.parseCommandLine(words.slice(words.indexOf('tsc') + 1))
      const config = configFor(cli.options.project)
      const read = ts.readConfigFile(config, ts.sys.readFile)
      const parsed = ts.parseJsonConfigFileContent(
        read.config,
        ts.sys,
        dirname(config),
        cli.options,
        config,
      )
      const errors = [read.error, ...cli.errors, ...parsed.errors].filter(
        (error) => error !== undefined,
      )
      return { config, parsed, errors }
    })
}

/**
 * Repo-relative paths of the .ts sources under `dir`. Declaration files are
 * left out, since nothing in them runs, and so is everything tsc's globs skip
 * anyway: dot-files and dot-directories (an editor's lock file, .wrangler)
 * and node_modules.
 */
function tsSourcesUnder(dir: string): string[] {
  return readdirSync(dir, { encoding: 'utf8', recursive: true })
    .filter(
      (file) =>
        file.endsWith('.ts') &&
        !file.endsWith('.d.ts') &&
        !file
          .split(sep)
          .some((part) => part.startsWith('.') || part === 'node_modules'),
    )
    .map((file) => relative(REPO, join(dir, file)))
}

/** The files under `dir` that no program in `programs` has as a root. */
function missedUnder(dir: string, programs: Program[]): string[] {
  const rooted = new Set(
    programs.flatMap(({ parsed }) =>
      parsed.fileNames.map((file) => relative(REPO, file)),
    ),
  )
  return tsSourcesUnder(dir).filter((file) => !rooted.has(file))
}

/**
 * Whether a program loads @types/node by any route: a `types` entry, an unset
 * `types` (which loads every @types package), a triple-slash reference, or a
 * dependency's declarations that carry one.
 */
function loadsNodeTypes({ parsed }: Program): boolean {
  return ts
    .createProgram(parsed.fileNames, parsed.options)
    .getSourceFiles()
    .some((file) => file.fileName.includes('/node_modules/@types/node/'))
}

const programs = typecheckPrograms()

describe('pnpm typecheck:db', () => {
  it('finds the config tsc would, for every form of -p', () => {
    const config = join(WORKER, 'tsconfig.json')
    expect(configFor('workers/db-worker')).toBe(config)
    expect(configFor('workers/db-worker/tsconfig.json')).toBe(config)
    expect(configFor(undefined)).toBe(join(REPO, 'tsconfig.json'))
  })

  it('parses every program cleanly, with type checking left on', () => {
    for (const { config, parsed, errors } of programs) {
      expect(errors, relative(REPO, config)).toEqual([])
      expect(parsed.options.noCheck, relative(REPO, config)).not.toBe(true)
    }
  })

  it('type-checks every .ts file in the DB Worker', () => {
    expect(missedUnder(WORKER, programs)).toEqual([])
  })

  it(
    'type-checks every file under src/ in a program that never loads Node types',
    // Building a program reads every file it reaches: about half a second on
    // its own, a few seconds beside the rest of the suite.
    { timeout: 30_000 },
    () => {
      const src = new Set(tsSourcesUnder(join(WORKER, 'src')))
      const nodeFree = programs.filter(
        (program) =>
          program.parsed.fileNames.some((file) =>
            src.has(relative(REPO, file)),
          ) && !loadsNodeTypes(program),
      )
      expect(missedUnder(join(WORKER, 'src'), nodeFree)).toEqual([])
    },
  )
})
