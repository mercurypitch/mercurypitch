// ============================================================
// Glassworks staging tests — copy only declared files and fail closed
// ============================================================

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { stageGlassGameAssets } from './glass-game-assets'

const temporary: string[] = []

function fixture(): string {
  const directory = mkdtempSync(resolve(tmpdir(), 'glass-game-assets-'))
  temporary.push(directory)
  return directory
}

function put(directory: string, path: string, contents: string): void {
  const target = resolve(directory, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

afterEach(() => {
  for (const directory of temporary.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

describe('Glassworks root web asset staging', () => {
  it('accepts the hosting size boundary and rejects oversized source files before copying', () => {
    const root = fixture()
    const source = resolve(root, 'source')
    const output = resolve(root, 'output')
    const path = 'kit/part.bin'
    put(source, path, 'binary')
    truncateSync(resolve(source, path), 25 * 1024 * 1024)

    stageGlassGameAssets(source, output, [path])
    expect(statSync(resolve(output, path)).size).toBe(25 * 1024 * 1024)

    truncateSync(resolve(source, path), 25 * 1024 * 1024 + 1)
    const rejectedOutput = resolve(root, 'rejected')
    expect(() => stageGlassGameAssets(source, rejectedOutput, [path])).toThrow(
      'Glassworks source asset exceeds the 25 MiB hosting limit: kit/part.bin',
    )
    expect(existsSync(resolve(rejectedOutput, path))).toBe(false)
  })

  it('copies only the neutral manifest allowlist from the canonical source', () => {
    const root = fixture()
    const source = resolve(root, 'source')
    const output = resolve(root, 'output')
    put(source, 'adventure/required.glb', 'required')
    put(source, 'drafts/unshipped.glb', 'draft')

    stageGlassGameAssets(source, output, ['adventure/required.glb'])

    expect(
      readFileSync(resolve(output, 'adventure/required.glb'), 'utf8'),
    ).toBe('required')
    expect(existsSync(resolve(output, 'drafts/unshipped.glb'))).toBe(false)
  })

  it('fails the build when a declared source byte is absent', () => {
    const root = fixture()

    expect(() =>
      stageGlassGameAssets(resolve(root, 'source'), resolve(root, 'output'), [
        'adventure/missing.glb',
      ]),
    ).toThrow('Glassworks source asset is missing: adventure/missing.glb')
  })

  it('fails the build when a declared source is an unhydrated Git LFS pointer', () => {
    const root = fixture()
    const source = resolve(root, 'source')
    put(
      source,
      'adventure/required.glb',
      'version https://git-lfs.github.com/spec/v1\n' +
        'oid sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n' +
        'size 123456\n',
    )

    expect(() =>
      stageGlassGameAssets(source, resolve(root, 'output'), [
        'adventure/required.glb',
      ]),
    ).toThrow('Git LFS pointer: adventure/required.glb')
    expect(existsSync(resolve(root, 'output/adventure/required.glb'))).toBe(
      false,
    )
  })
})
