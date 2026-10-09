// ============================================================
// The web's self-hosted fonts answer to the names the stacks ask for,
// and nothing on the page fetches a font from Google
// ============================================================

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- a plain .mjs with no types: the native shell's copy.
import { FONT_ALIASES as NATIVE_FONT_ALIASES } from '../apps/mercurypitch/native-font-aliases.mjs'
import { addFontAliases, FONT_ALIASES, fontAliasesPlugin } from './font-aliases'

const require = createRequire(import.meta.url)

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

const read = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), 'utf8')

describe('the web font aliases', () => {
  it('map the same names as the native shell', () => {
    expect(FONT_ALIASES).toEqual(NATIVE_FONT_ALIASES)
  })

  it.each(Object.entries(PACKAGES))(
    'give every %s face a twin under the plain name, identical but for it',
    (variable, file) => {
      const source = readFileSync(require.resolve(file), 'utf8')
      const before = faces(source)
      expect(before.length).toBeGreaterThan(0)
      expect(before.every((f) => f.family === variable)).toBe(true)

      const after = faces(addFontAliases(source))
      const plain = FONT_ALIASES[variable]
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
    expect(faces(addFontAliases(css))).toEqual(faces(css))
  })

  it('runs on the three package stylesheets and nothing else', () => {
    const { transform } = fontAliasesPlugin()
    const css =
      "@font-face { font-family: 'Inter Variable'; src: url(a.woff2); }"
    const pkg =
      '/repo/node_modules/.pnpm/@fontsource-variable+inter@5.3.0/node_modules/@fontsource-variable/inter/index.css'
    expect(transform(css, pkg)?.code).toContain("font-family: 'Inter';")
    expect(transform(css, '/repo/src/styles/app.css')).toBeNull()
    expect(
      transform(
        css,
        '/repo/node_modules/@fontsource-variable/gabarito/index.css',
      ),
    ).toBeNull()
  })
})

describe('the web loads no font from Google', () => {
  // Linking fonts.googleapis.com sends every visitor's IP address to Google
  // before any consent choice (LG München I, 20 Jan 2022, 3 O 17493/20).
  it('index.html links no Google font host and loads the self-hosted faces', () => {
    const html = read('../index.html')
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/u)
    expect(html).toContain('src="/src/lib/self-hosted-fonts.ts"')
  })

  it('the CSP no longer allows the Google font hosts', () => {
    const headers = read('../public/_headers')
    expect(headers).not.toMatch(/fonts\.(googleapis|gstatic)\.com/u)
    expect(headers).toMatch(/font-src 'self' data:;/u)
  })
})
