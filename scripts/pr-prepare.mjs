// ============================================================
// Pull request preparation — one lightweight local cleanup pass per work item
// ============================================================
//
// CI owns the complete, non-mutating repository gate. Local mode does only
// work that is faster and more useful before the first PR push: refresh the
// generated agent index, fix changed files, and reject whitespace errors in
// the branch diff. Check mode reuses the same scope without changing files.

import { spawnSync } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultBaseRefs = ['origin/main', 'main']
const eslintExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
])
const commandChunkSize = 100

export function parseArguments(argv) {
  let base
  let check = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--base') {
      base = argv[index + 1]
      if (base === undefined || base.startsWith('--')) {
        throw new Error('--base requires a Git ref')
      }
      index += 1
      continue
    }

    if (argument.startsWith('--base=')) {
      base = argument.slice('--base='.length)
      if (base.length === 0) throw new Error('--base requires a Git ref')
      continue
    }

    if (argument === '--check') {
      check = true
      continue
    }

    if (argument === '--help' || argument === '-h') {
      return { check, help: true }
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  return { base, check, help: false }
}

export function parseNulList(output) {
  return output.split('\0').filter((path) => path.length > 0)
}

export function isEslintCandidate(path) {
  if (!eslintExtensions.has(extname(path))) return false

  return (
    path.startsWith('src/') ||
    !path.includes('/') ||
    /^(?:apps|packages)\/[^/]+\/src\//u.test(path) ||
    /^scripts\/pr-prepare(?:\.test)?\.mjs$/u.test(path)
  )
}

export function isPrettierCandidate(path) {
  // The index generator owns this file byte-for-byte. Formatting its generated
  // Markdown tables after regeneration would make docs:index:check stale again.
  return path !== 'docs/agent/INDEX.md'
}

export function chunkPaths(paths, size = commandChunkSize) {
  const chunks = []

  for (let index = 0; index < paths.length; index += size) {
    chunks.push(paths.slice(index, index + size))
  }

  return chunks
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })

  if (result.error !== undefined) throw result.error

  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? result.stderr.trim() : ''
    throw new Error(
      `${command} ${args.join(' ')} failed${detail.length > 0 ? `: ${detail}` : ''}`,
    )
  }

  return result
}

function gitOutput(args) {
  return run('git', args, { capture: true }).stdout
}

function refExists(ref) {
  return (
    run('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
      allowFailure: true,
      capture: true,
    }).status === 0
  )
}

export function resolveBaseRef(requestedBase, environment = process.env) {
  const explicitBase = requestedBase ?? environment.PR_PREPARE_BASE

  if (explicitBase !== undefined) {
    if (explicitBase.startsWith('-')) {
      throw new Error('The base Git ref cannot start with a hyphen.')
    }
    if (!refExists(explicitBase)) {
      throw new Error(
        `Base ref ${explicitBase} is unavailable. Fetch it or pass --base <ref>.`,
      )
    }
    return explicitBase
  }

  const detectedBase = defaultBaseRefs.find(refExists)
  if (detectedBase === undefined) {
    throw new Error(
      'Could not find origin/main or main. Fetch the target branch or pass --base <ref>.',
    )
  }

  return detectedBase
}

function existingRepositoryFiles(paths) {
  const uniquePaths = [...new Set(paths)].sort()

  return uniquePaths.filter((path) => {
    const absolutePath = resolve(repoRoot, path)
    const pathFromRoot = relative(repoRoot, absolutePath)
    if (pathFromRoot.startsWith('..') || pathFromRoot === '') return false

    try {
      return lstatSync(absolutePath).isFile()
    } catch {
      return false
    }
  })
}

function changedFilesSince(mergeBase) {
  return existingRepositoryFiles([
    ...parseNulList(
      gitOutput([
        'diff',
        '--name-only',
        '-z',
        '--diff-filter=ACMR',
        `${mergeBase}...HEAD`,
      ]),
    ),
    ...parseNulList(
      gitOutput([
        'diff',
        '--cached',
        '--name-only',
        '-z',
        '--diff-filter=ACMR',
      ]),
    ),
    ...parseNulList(
      gitOutput(['diff', '--name-only', '-z', '--diff-filter=ACMR']),
    ),
    ...parseNulList(
      gitOutput(['ls-files', '--others', '--exclude-standard', '-z']),
    ),
  ])
}

function runInChunks(command, leadingArgs, paths) {
  for (const chunk of chunkPaths(paths)) {
    run(command, [...leadingArgs, ...chunk])
  }
}

function validateWhitespace(mergeBase, untrackedFiles) {
  run('git', ['diff', '--check', mergeBase])

  for (const path of untrackedFiles) {
    // --no-index returns 1 whenever the files differ, including for a clean
    // new file. With --check, output is emitted only for whitespace errors, so
    // status 0/1 plus empty output is success; status >1 is a Git failure.
    const result = run(
      'git',
      ['diff', '--no-index', '--check', '--', '/dev/null', path],
      { allowFailure: true, capture: true },
    )
    const output = `${result.stdout}${result.stderr}`

    if (result.status > 1 || output.trim().length > 0) {
      if (output.length > 0) process.stderr.write(output)
      throw new Error(`Whitespace validation failed for ${path}`)
    }
  }
}

function printHelp() {
  console.log(`Usage: pnpm pr:prepare [--check] [--base <ref>]

Without --check, refresh generated docs and fix changed files with Prettier and
ESLint. With --check, validate the same files without changing them. Both modes
check the complete branch diff for whitespace errors. The base defaults to
origin/main, then main. PR_PREPARE_BASE can also select the base ref.`)
}

export function preparePullRequest({ base, check = false } = {}) {
  const baseRef = resolveBaseRef(base)
  const mergeBase = gitOutput(['merge-base', 'HEAD', baseRef]).trim()
  const prefix = check ? '[pr:validate]' : '[pr:prepare]'

  console.log(`${prefix} Base: ${baseRef} (${mergeBase.slice(0, 12)})`)
  console.log(
    `${prefix} ${check ? 'Checking' : 'Refreshing'} docs/agent/INDEX.md`,
  )
  run(process.execPath, [
    'scripts/gen-agent-index.mjs',
    ...(check ? ['--check'] : []),
  ])

  const changedFiles = changedFilesSince(mergeBase)
  const untrackedFiles = parseNulList(
    gitOutput(['ls-files', '--others', '--exclude-standard', '-z']),
  ).filter((path) => changedFiles.includes(path))

  if (changedFiles.length === 0) {
    console.log(`${prefix} No changed files to format or lint`)
  } else {
    const prettierFiles = changedFiles.filter(isPrettierCandidate)
    if (prettierFiles.length > 0) {
      console.log(
        `${prefix} ${check ? 'Checking formatting for' : 'Formatting'} ${prettierFiles.length} changed file${prettierFiles.length === 1 ? '' : 's'}`,
      )
      runInChunks(
        'pnpm',
        [
          'exec',
          'prettier',
          check ? '--check' : '--write',
          '--ignore-unknown',
          '--log-level',
          'warn',
          '--',
        ],
        prettierFiles,
      )
    }

    const eslintFiles = changedFiles.filter(isEslintCandidate)
    if (eslintFiles.length > 0) {
      console.log(
        `${prefix} Linting ${eslintFiles.length} changed source file${eslintFiles.length === 1 ? '' : 's'}`,
      )
      runInChunks(
        'pnpm',
        [
          'exec',
          'eslint',
          ...(check ? [] : ['--fix']),
          '--no-warn-ignored',
          '--',
        ],
        eslintFiles,
      )
    } else {
      console.log(`${prefix} No changed source files require ESLint`)
    }
  }

  console.log(`${prefix} Checking the branch diff for whitespace errors`)
  validateWhitespace(mergeBase, untrackedFiles)
  console.log(
    check
      ? '[pr:validate] Changed-file validation complete'
      : '[pr:prepare] Local preparation complete; CI owns the full gate',
  )
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const options = parseArguments(process.argv.slice(2))
    if (options.help) printHelp()
    else preparePullRequest(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[pr:prepare] ${message}`)
    process.exitCode = 1
  }
}
