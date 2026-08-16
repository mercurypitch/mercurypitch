// Theme CSS contract — prevents invalid legacy variables and global selector leakage from returning.

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_DIR = resolve(process.cwd(), 'src')
const SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx'])
const RETIRED_UNDEFINED_TOKENS = [
  '--text',
  '--border-light',
  '--border-mid',
  '--blue',
  '--ob-ink-1',
  '--accent-success',
  '--accent-warning',
  '--accent-danger',
  '--accent-info',
] as const

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'e2e' || entry.name === '__tests__') return []
      return productionSourceFiles(path)
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) return []
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) return []
    return [path]
  })
}

function unscopedClassRules(source: string, className: string): string[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`^\\.${escaped}(?=[\\s:{.#])`, 'gm')
  return source.match(rule) ?? []
}

function referencesToken(source: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`var\\(\\s*${escaped}(?=[\\s,)])`).test(source)
}

describe('theme CSS contract', () => {
  it('never references the retired variables whose declarations resolved invalid', () => {
    const offenders = productionSourceFiles(SRC_DIR).flatMap((path) => {
      const source = readFileSync(path, 'utf8')
      return RETIRED_UNDEFINED_TOKENS.flatMap((token) =>
        referencesToken(source, token)
          ? [`${relative(SRC_DIR, path)}: ${token}`]
          : [],
      )
    })

    expect(offenders).toEqual([])
  })

  it('keeps Community share buttons out of UVR global selector scope', () => {
    const communityCss = readFileSync(
      resolve(SRC_DIR, 'styles/vocal-analysis.css'),
      'utf8',
    )
    const uvrCss = readFileSync(resolve(SRC_DIR, 'styles/uvr.css'), 'utf8')

    expect(communityCss).toContain('.community-share-tab .share-btn {')
    expect(unscopedClassRules(communityCss, 'share-btn')).toEqual([])
    expect(unscopedClassRules(uvrCss, 'share-btn')).toEqual([])
  })
})
