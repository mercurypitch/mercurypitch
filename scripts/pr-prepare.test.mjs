import assert from 'node:assert/strict'
import test from 'node:test'
import { chunkPaths, isEslintCandidate, isPrettierCandidate, parseArguments, parseNulList, } from './pr-prepare.mjs'

test('parseArguments accepts both base syntaxes', () => {
  assert.deepEqual(parseArguments(['--base', 'upstream/main']), {
    base: 'upstream/main',
    check: false,
    help: false,
  })
  assert.deepEqual(parseArguments(['--base=release']), {
    base: 'release',
    check: false,
    help: false,
  })
  assert.deepEqual(parseArguments(['--check', '--base=release']), {
    base: 'release',
    check: true,
    help: false,
  })
})

test('parseArguments rejects incomplete and unknown options', () => {
  assert.throws(() => parseArguments(['--base']), /requires a Git ref/u)
  assert.throws(() => parseArguments(['--other']), /Unknown argument/u)
})

test('parseNulList preserves paths containing spaces', () => {
  assert.deepEqual(parseNulList('src/one.ts\0src/a file.tsx\0'), [
    'src/one.ts',
    'src/a file.tsx',
  ])
})

test('isEslintCandidate follows the repository lint scopes', () => {
  assert.equal(isEslintCandidate('src/App.tsx'), true)
  assert.equal(isEslintCandidate('apps/beside-cue/src/App.tsx'), true)
  assert.equal(isEslintCandidate('packages/mobile-runtime/src/web.ts'), true)
  assert.equal(isEslintCandidate('eslint.config.js'), true)
  assert.equal(isEslintCandidate('vite.config.ts'), true)
  assert.equal(isEslintCandidate('scripts/pr-prepare.mjs'), true)
  assert.equal(isEslintCandidate('scripts/pr-prepare.test.mjs'), true)
  assert.equal(isEslintCandidate('scripts/seed-dev-league.mjs'), false)
  assert.equal(isEslintCandidate('docs/example.ts'), false)
  assert.equal(isEslintCandidate('src/styles.css'), false)
})

test('isPrettierCandidate leaves the generated index to its generator', () => {
  assert.equal(isPrettierCandidate('docs/agent/INDEX.md'), false)
  assert.equal(isPrettierCandidate('docs/agent/CONVENTIONS.md'), true)
  assert.equal(isPrettierCandidate('src/App.tsx'), true)
})

test('chunkPaths keeps every path and respects the limit', () => {
  assert.deepEqual(chunkPaths(['a', 'b', 'c', 'd', 'e'], 2), [
    ['a', 'b'],
    ['c', 'd'],
    ['e'],
  ])
})
