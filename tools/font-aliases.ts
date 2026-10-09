// ============================================================
// The self-hosted families, under the names the stylesheets ask for
// ============================================================
//
// The web loads Inter, Outfit and Plus Jakarta Sans from its own origin
// (src/lib/self-hosted-fonts.ts), from the @fontsource-variable packages.
// Those register each face as 'Inter Variable', 'Outfit Variable' and
// 'Plus Jakarta Sans Variable', while every stack the app ships asks for the
// plain names that Google Fonts used: app.css, Appearance's `--app-font`,
// some ninety CSS-module stacks and the canvases' `ctx.font`.
//
// So this doubles each of those @font-face rules under the plain name: the
// same files, weights, styles and unicode ranges. The native shell does the
// same with a PostCSS plugin (apps/mercurypitch/native-font-aliases.mjs);
// this build runs Lightning CSS, so here it is a plain-text `enforce: 'pre'`
// transform on the three package stylesheets, ahead of Vite's CSS pipeline.

/** fontsource's family name, and the plain one the stacks ask for. */
export const FONT_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'Inter Variable': 'Inter',
  'Outfit Variable': 'Outfit',
  'Plus Jakarta Sans Variable': 'Plus Jakarta Sans',
})

/** A stylesheet from one of the three packages, by its resolved path. */
const PACKAGE_CSS =
  /[\\/]@fontsource-variable[\\/](?:inter|outfit|plus-jakarta-sans)[\\/][^?]*\.css(?:$|\?)/u

const FONT_FACE = /@font-face\s*\{[^}]*\}/gu
const FAMILY = /font-family\s*:\s*(['"]?)([^;'"]+)\1\s*;?/u

/** Every aliased @font-face, followed by its twin under the plain name. */
export function addFontAliases(css: string): string {
  return css.replace(FONT_FACE, (rule) => {
    const family = FAMILY.exec(rule)?.[2]?.trim()
    const alias = family === undefined ? undefined : FONT_ALIASES[family]
    if (alias === undefined) return rule
    return `${rule}\n${rule.replace(FAMILY, `font-family: '${alias}';`)}`
  })
}

export interface FontAliasesPlugin {
  name: string
  enforce: 'pre'
  transform: (code: string, id: string) => { code: string; map: null } | null
}

export function fontAliasesPlugin(): FontAliasesPlugin {
  return {
    name: 'mercurypitch:font-aliases',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!PACKAGE_CSS.test(id)) return null
      const aliased = addFontAliases(code)
      return aliased === code ? null : { code: aliased, map: null }
    },
  }
}
