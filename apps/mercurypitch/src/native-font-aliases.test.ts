// ============================================================
// The bundled families answer to the names the stacks ask for
// ============================================================
//
// fontsource registers 'Inter Variable'; the stacks the native app shares
// with the web ask for 'Inter' (native-font-aliases.mjs says why). The alias
// has to be the same face in every respect but its name, or a weight, a
// script or a style would render differently under one name than the other.

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- a plain .mjs with no types, on purpose: the Vite
// config imports the same file.
import { FONT_ALIASES, nativeFontAliases } from '../native-font-aliases.mjs'
// The same config, read as text: no Vite run needed.
import viteConfig from '../vite.config.ts?raw'

const require = createRequire(import.meta.url)
// PostCSS is Vite's, not this app's: the same copy the build runs it with.
const postcss = createRequire(require.resolve('vite'))('postcss') as (
  plugins: unknown[],
) => { process: (css: string, opts: object) => { css: string } }

const PACKAGES: Record<string, string> = {
  'Inter Variable': '@fontsource-variable/inter/index.css',
  'Outfit Variable': '@fontsource-variable/outfit/index.css',
  'Plus Jakarta Sans Variable':
    '@fontsource-variable/plus-jakarta-sans/index.css',
}

interface Face {
  family: string
  rest: string
}

/** Every @font-face in `css`, as its family and everything else it says. */
function faces(css: string): Face[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/gu)].map((m) => {
    const decls = m[1]
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d !== '')
    const family =
      decls
        .find((d) => d.startsWith('font-family'))
        ?.replace(/^font-family\s*:\s*/u, '')
        .replace(/^(['"])(.*)\1$/u, '$2') ?? ''
    const rest = decls.filter((d) => !d.startsWith('font-family')).join('; ')
    return { family, rest }
  })
}

const run = (css: string): string =>
  postcss([nativeFontAliases()]).process(css, { from: undefined }).css

describe('the native font aliases', () => {
  it.each(Object.entries(PACKAGES))(
    'give every %s face a twin under the plain name, identical but for it',
    (variable, file) => {
      const source = readFileSync(require.resolve(file), 'utf8')
      const before = faces(source)
      expect(before.length).toBeGreaterThan(0)
      expect(before.every((f) => f.family === variable)).toBe(true)

      const after = faces(run(source))
      const plain = FONT_ALIASES[variable] as string
      expect(after.filter((f) => f.family === variable)).toEqual(before)
      expect(after.filter((f) => f.family === plain)).toEqual(
        before.map((f) => ({ ...f, family: plain })),
      )
      expect(after).toHaveLength(before.length * 2)
    },
  )

  it('leaves every other face alone', () => {
    const css =
      "@font-face { font-family: 'Gabarito Variable'; src: url(a.woff2); }" +
      '@font-face { font-family: Inter; src: url(b.woff2); }'
    expect(faces(run(css))).toEqual(faces(css))
  })

  it('run in the native build, and only there', () => {
    // The web's config never names it: Google Fonts registers the plain
    // names there, and the web must render as it did.
    expect(viteConfig).toMatch(/plugins:\s*\[\s*nativeFontAliases\(\)\s*\]/u)
    const web = readFileSync(
      new URL('../../../vite.config.ts', import.meta.url),
      'utf8',
    )
    expect(web).not.toContain('nativeFontAliases')
  })
})
