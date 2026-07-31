// ============================================================
// Contact & support links
// ============================================================
//
// Every "reach us" and "support us" destination in one place, so a channel
// can move without hunting through components. Mirrors legal-links.ts.

/** Where "say hello" mail goes (Cloudflare Email Routing → the founder). */
export const CONTACT_EMAIL = 'hello@mercurypitch.com'

/** Public source repository. */
export const GITHUB_URL = 'https://github.com/mercurypitch/mercurypitch'

/** Bug reports and feature requests — the issue form, pre-opened. */
export const GITHUB_NEW_ISSUE_URL = `${GITHUB_URL}/issues/new`

/**
 * Ko-fi tip jar. Currently the shared chaos-matters page; a MercuryPitch-only
 * account is planned, at which point this constant is the only edit.
 */
export const KOFI_URL = 'https://ko-fi.com/chaosmatters'

/**
 * GitHub Sponsors listing for the mercurypitch org — deliberately NOT the
 * chaos-matters one, whose payouts are shared with that project's co-founder.
 */
export const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/mercurypitch'

/**
 * The Sponsors listing above does not exist until GitHub approves the org
 * application (a few days). Flip this to true then — and uncomment the
 * `github:` line in .github/FUNDING.yml — to surface the link app-wide.
 */
export const SPONSORS_LIVE = false
