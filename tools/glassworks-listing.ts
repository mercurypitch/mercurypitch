// ============================================================
// Glassworks listing — the build switch that keeps the museum out of discovery
// ============================================================
//
// Glassworks belongs to Beside Cue for now (owner decision, 2026-09-28). The
// production web build still SERVES /glass-game — the entry document, the
// service-worker rule and every staged asset stay in dist, so a link somebody
// already holds keeps working — but nothing on mercurypitch.com points at it:
// no Home card, no Home tour step, no sitemap, llms.txt or prelude link, and
// the entry document says `noindex`. dev.mercurypitch.com, PR previews and
// `pnpm dev` keep it listed.
//
// The switch is `VITE_GLASSWORKS_LISTED`, set per Vite mode: `1` in
// `.env.development`, `0` in `.env.production`. That is the split build.yml
// already makes — a push to main builds `build:dev` for the dev deploy, a `v*`
// tag builds `build` for production — so no workflow step carries it. Only
// "1" or "true" lists the museum: a build that loses the variable hides it
// rather than advertising it.
//
// The client reads the same value through `src/lib/glassworks-listing.ts`,
// which vite.config.ts pins with a `define` so both sides cannot disagree.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

export const GLASSWORKS_LISTED_ENV = 'VITE_GLASSWORKS_LISTED'
export const GLASSWORKS_SLUG = 'glass-game'
export const GLASSWORKS_PATH = `/${GLASSWORKS_SLUG}`

/** "1" or "true" lists the museum; anything else, unset included, hides it. */
export function isGlassworksListed(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

/** Entry-page slugs that are served but kept out of every cross-link. */
export function unlistedEntrySlugs(listed: boolean): readonly string[] {
  return listed ? [] : [GLASSWORKS_SLUG]
}

interface Stripped {
  text: string
  removed: boolean
}

// One `<a href="/glass-game">Glassworks</a>` per line, as index.html and
// 404.html write their prelude navs. The line goes with it so no blank line
// is left where it stood.
const NAV_LINK = /^[ \t]*<a href="\/glass-game">[^<]*<\/a>[ \t]*\r?\n/gm

/** The prelude nav link in a hand-written document (index.html, 404.html). */
export function stripGlassworksNavLink(html: string): Stripped {
  const text = html.replace(NAV_LINK, '')
  return { text, removed: text !== html }
}

// The `<url>` block for the museum, with the comment written directly above
// it. The comment body cannot contain `-->`, so it can only ever be the one
// comment that immediately precedes this block.
const SITEMAP_ENTRY =
  /(?:[ \t]*<!--(?:(?!-->)[\s\S])*-->[ \t]*\r?\n)?[ \t]*<url>\s*<loc>https:\/\/mercurypitch\.com\/glass-game<\/loc>[\s\S]*?<\/url>[ \t]*\r?\n/

/** The museum's `<url>` entry in public/sitemap.xml. */
export function stripGlassworksFromSitemap(xml: string): Stripped {
  const text = xml.replace(SITEMAP_ENTRY, '')
  return { text, removed: text !== xml }
}

// A bullet and its two-space continuation lines.
const LLMS_ENTRY =
  /^- \[[^\]]*\]\(https:\/\/mercurypitch\.com\/glass-game\)[^\n]*\n(?: {2}[^\n]*\n)*/m

/** The museum's bullet in public/llms.txt. */
export function stripGlassworksFromLlms(text: string): Stripped {
  const next = text.replace(LLMS_ENTRY, '')
  return { text: next, removed: next !== text }
}

/**
 * Hides Glassworks from a build's discovery surfaces when `listed` is false,
 * and fails the build if any of them still points at /glass-game afterwards.
 * The entry pages themselves are rendered unlisted upstream, by
 * `writeEntryPages(root, { unlisted })`; this covers what they do not: the
 * hand-written index.html and 404.html, and the copied public/ files.
 */
export function glassworksListingPlugin(listed: boolean): Plugin {
  let config: ResolvedConfig
  return {
    name: 'mercurypitch:glassworks-listing',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return listed ? html : stripGlassworksNavLink(html).text
      },
    },
    // After writeBundle, so the public/ copies are already on disk (the same
    // reason non-production-noindex runs here).
    closeBundle() {
      if (listed) return
      const outDir = resolve(config.root, config.build.outDir)

      const rewrite = (
        file: string,
        strip: (text: string) => Stripped,
      ): void => {
        const path = resolve(outDir, file)
        const result = strip(readFileSync(path, 'utf8'))
        if (!result.removed)
          throw new Error(
            `Glassworks is unlisted, but ${file} no longer has the entry this build removes. Update tools/glassworks-listing.ts to match its format.`,
          )
        writeFileSync(path, result.text, 'utf8')
      }
      rewrite('sitemap.xml', stripGlassworksFromSitemap)
      rewrite('llms.txt', stripGlassworksFromLlms)

      const leaks = [
        'sitemap.xml',
        'llms.txt',
        ...readdirSync(outDir).filter(
          (file) =>
            file.endsWith('.html') && file !== `${GLASSWORKS_SLUG}.html`,
        ),
      ].filter((file) =>
        /(?:href="|mercurypitch\.com)\/glass-game(?![\w-])/.test(
          readFileSync(resolve(outDir, file), 'utf8'),
        ),
      )
      if (leaks.length > 0)
        throw new Error(
          `Glassworks is unlisted, but these files still point at ${GLASSWORKS_PATH}: ${leaks.join(', ')}`,
        )
    },
  }
}
