// ============================================================
// Experimental features, build side — this build's default, and the pages it keeps out of discovery
// ============================================================
//
// One switch for every experimental feature (src/lib/experimental-features.ts
// names them): `VITE_EXPERIMENTAL_FEATURES`, set per Vite mode the way the
// Glassworks listing is. `1` in `.env.development` (`pnpm dev`, and
// `build:dev`, which feeds dev.mercurypitch.com and every PR preview), `0` in
// `.env.production` (the `v*` tag build of mercurypitch.com). `build:e2e` sets
// 1, so the specs see what the dev deploy shows, and the native app pins 0 in
// apps/mercurypitch/vite.config.ts. Only "1" or "true" turns features on: a
// build that loses the variable keeps them off rather than shipping them.
//
// A feature on in production (src/lib/experimental-feature-defaults.ts:
// Studio) does not wait for the switch. Every web build has it on and lists
// it, the production one included, so mercurypitch.com lists Studio as the
// dev deploy does. Any other feature, a new one included, is off in
// production until it joins that list.
//
// A feature's entry page is written and served either way, because the owner
// can switch the feature on for an environment from his console without a
// release, and its address has to boot when he does. What a build with the
// feature off by default does is keep that page out of discovery: no nav link
// in index.html, the other entry pages or the 404, no sitemap or llms.txt
// entry, and the page itself says `noindex`. A switch set at runtime changes
// what the app shows, not these files, either way: Studio switched off in
// production stays listed, its address sending the visitor Home. Putting a
// feature on in production, or graduating it, lists it.
//
// The client reads the same value through
// src/stores/experimental-features-store.ts, pinned by a `define` in
// vite.config.ts so both sides cannot disagree.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
// With its extension: plain Node loads this file for the dist check and
// IndexNow, and resolves no other spelling.
import { onInProduction } from '../src/lib/experimental-feature-defaults.ts'
import type { ExperimentalFeature } from '../src/lib/experimental-features'

export const EXPERIMENTAL_FEATURES_ENV = 'VITE_EXPERIMENTAL_FEATURES'

/**
 * The entry pages (src/seo/entry-pages.ts slugs) each feature owns. Keyed by
 * the feature list, so adding a feature without saying which pages it owns,
 * or graduating one and leaving its pages here, does not compile. The one
 * list: scripts/assert-experimental-features.mjs and scripts/indexnow.mjs
 * import it, which Node can do for this file because its runtime imports are
 * Node's own and one module, named with its extension, that imports types
 * alone.
 */
export const EXPERIMENTAL_ENTRY_SLUGS: Record<
  ExperimentalFeature,
  readonly string[]
> = {
  studio: ['studio-night'],
}

/** "1" or "true" turns experimental features on; anything else, unset included, keeps them off. */
export function isExperimentalFeaturesOn(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true'
}

/**
 * The slugs of `pages` (each feature's entry pages) a build keeps out of
 * every cross-link: none with the switch on, and with it off the pages of
 * every feature that is not on in production.
 */
export function unlistedSlugsOf(
  pages: Readonly<Record<string, readonly string[]>>,
  on: boolean,
): string[] {
  if (on) return []
  return Object.entries(pages)
    .filter(([feature]) => !onInProduction(feature))
    .flatMap(([, slugs]) => slugs)
}

/** Entry-page slugs this build serves but keeps out of every cross-link. */
export function unlistedExperimentSlugs(on: boolean): readonly string[] {
  return unlistedSlugsOf(EXPERIMENTAL_ENTRY_SLUGS, on)
}

interface Stripped {
  text: string
  removed: boolean
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The nav link to `/<slug>` in index.html, one `<a>` per line as index.html
 * writes its nav. The line goes with it, so no blank line is left behind.
 */
export function stripNavLink(html: string, slug: string): Stripped {
  const link = new RegExp(
    `^[ \\t]*<a href="/${escapeRegExp(slug)}">[^<]*</a>[ \\t]*\\r?\\n`,
    'gm',
  )
  const text = html.replace(link, '')
  return { text, removed: text !== html }
}

/**
 * The `<url>` block for `/<slug>` in public/sitemap.xml, with the comment
 * written directly above it. A comment body cannot contain `-->`, so it can
 * only ever be the one comment that immediately precedes this block.
 */
export function stripSitemapEntry(xml: string, slug: string): Stripped {
  const entry = new RegExp(
    `(?:[ \\t]*<!--(?:(?!-->)[\\s\\S])*-->[ \\t]*\\r?\\n)?[ \\t]*<url>\\s*<loc>https://mercurypitch\\.com/${escapeRegExp(slug)}</loc>[\\s\\S]*?</url>[ \\t]*\\r?\\n`,
  )
  const text = xml.replace(entry, '')
  return { text, removed: text !== xml }
}

/** The bullet for `/<slug>` in public/llms.txt, with its two-space continuation lines. */
export function stripLlmsEntry(text: string, slug: string): Stripped {
  const entry = new RegExp(
    `^- \\[[^\\]]*\\]\\(https://mercurypitch\\.com/${escapeRegExp(slug)}\\)[^\\n]*\\n(?: {2}[^\\n]*\\n)*`,
    'm',
  )
  const next = text.replace(entry, '')
  return { text: next, removed: next !== text }
}

/** Whether `text` still points at `/<slug>`: a link, or the site's own URL for it. */
export function pointsAt(text: string, slug: string): boolean {
  return new RegExp(
    `(?:href="|mercurypitch\\.com)/${escapeRegExp(slug)}(?![\\w-])`,
  ).test(text)
}

/**
 * Keeps the pages of every feature off by default in this build out of its
 * discovery surfaces, and fails the build if any of them still points at
 * one afterwards: with `on` false, every feature not on in production, none
 * today. The entry and error pages are rendered unlisted upstream, by
 * `writeEntryPages` and `writeErrorPages` with `{ unlisted }`; this covers
 * what they do not: the hand-written index.html and the copied public/
 * files.
 */
export function experimentalFeaturesPlugin(on: boolean): Plugin {
  const slugs = unlistedExperimentSlugs(on)
  let config: ResolvedConfig
  return {
    name: 'mercurypitch:experimental-features',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return slugs.reduce((text, slug) => stripNavLink(text, slug).text, html)
      },
    },
    // After writeBundle, so the public/ copies are already on disk (the same
    // reason the Glassworks listing runs here).
    closeBundle() {
      if (slugs.length === 0) return
      const outDir = resolve(config.root, config.build.outDir)

      const rewrite = (
        file: string,
        slug: string,
        strip: (text: string, slug: string) => Stripped,
      ): void => {
        const path = resolve(outDir, file)
        const result = strip(readFileSync(path, 'utf8'), slug)
        if (!result.removed)
          throw new Error(
            `/${slug} is an experimental feature this build keeps unlisted, but ${file} no longer has the entry it removes. Update tools/experimental-features.ts to match its format.`,
          )
        writeFileSync(path, result.text, 'utf8')
      }

      const documents = readdirSync(outDir).filter((file) =>
        file.endsWith('.html'),
      )
      const leaks: string[] = []
      for (const slug of slugs) {
        rewrite('sitemap.xml', slug, stripSitemapEntry)
        rewrite('llms.txt', slug, stripLlmsEntry)
        for (const file of [
          'sitemap.xml',
          'llms.txt',
          ...documents.filter((file) => file !== `${slug}.html`),
        ]) {
          if (pointsAt(readFileSync(resolve(outDir, file), 'utf8'), slug))
            leaks.push(`${file} -> /${slug}`)
        }
      }
      if (leaks.length > 0)
        throw new Error(
          `These experimental features are off by default in this build, but these files still point at their pages: ${leaks.join(', ')}`,
        )
    },
  }
}
