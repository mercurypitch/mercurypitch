// ============================================================
// The native bundle's three families, under the names the app asks for
// ============================================================
//
// The web links Inter, Outfit and Plus Jakarta Sans from Google Fonts
// (index.html), which registers each under its plain name, and every stack
// the two apps share asks for exactly those names: Appearance's `--app-font`
// (src/App.tsx), app.css, some ninety CSS-module stacks and the canvases'
// `ctx.font`. A native app cannot reach Google, so main.tsx bundles the same
// families from @fontsource-variable, which registers them as
// 'Inter Variable', 'Outfit Variable' and 'Plus Jakarta Sans Variable'. No
// stack named those: a phone drew San Francisco everywhere, and choosing a
// font in Appearance changed nothing in the app.
//
// So this PostCSS plugin doubles each of those @font-face rules under the
// plain name — the same files, weights, styles and unicode ranges — and
// every stack that asks for 'Inter' gets the bundled face. An alias rather
// than the Variable names prepended to every stack: that would be ninety
// edits to files the web ships, and every stack written after them would
// have to remember. Only this app's Vite config runs the plugin, and the web
// never imports these packages, so the web cannot change.
//
// A plain .mjs with no dependencies, as api-base.mjs is: the Vite config and
// the suite (src/native-font-aliases.test.ts) both import it.

/** fontsource's family name, and the plain one the stacks ask for. */
export const FONT_ALIASES = Object.freeze({
  'Inter Variable': 'Inter',
  'Outfit Variable': 'Outfit',
  'Plus Jakarta Sans Variable': 'Plus Jakarta Sans',
})

const isFamily = (node) =>
  node.type === 'decl' && node.prop.toLowerCase() === 'font-family'

/** The rule's family, unquoted, or null. */
function familyOf(rule) {
  let family = null
  rule.each((node) => {
    if (isFamily(node)) {
      family = node.value.trim().replace(/^(['"])(.*)\1$/u, '$2')
    }
  })
  return family
}

/** The PostCSS plugin, for `css.postcss.plugins` in vite.config.ts. */
export function nativeFontAliases() {
  return {
    postcssPlugin: 'mercurypitch-native-font-aliases',
    Once(root) {
      const faces = []
      root.walkAtRules('font-face', (rule) => {
        faces.push(rule)
      })
      for (const rule of faces) {
        const alias = FONT_ALIASES[familyOf(rule)]
        if (alias === undefined) continue
        const copy = rule.clone()
        copy.each((node) => {
          if (isFamily(node)) node.value = `'${alias}'`
        })
        rule.after(copy)
      }
    },
  }
}
nativeFontAliases.postcss = true
