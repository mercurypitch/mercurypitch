// ============================================================
// Contact & support links
// ============================================================
//
// Every "reach us" and "support us" destination in one place, so a channel
// can move without hunting through components. Mirrors legal-links.ts.

import { WEBSITE_URL } from '@/lib/legal-links'

/**
 * The contact form on the landing site, which sits behind Turnstile.
 *
 * Deliberately a URL and not an address. The address it replaced was written
 * into this bundle, into every mailto built from it, and into the landing
 * site's static HTML, which is the copy a harvester actually reads. Spam
 * followed the traffic. Mail still reaches the same person: the form posts to
 * the same inbox, it is simply no longer published.
 */
export const CONTACT_FORM_URL = `${WEBSITE_URL}/contact/`

/** The topics the form offers. Anything else is ignored on arrival. */
export type ContactTopic = 'general' | 'support' | 'privacy' | 'copyright'

/**
 * The same form, opened with the topic chosen and the message already written.
 *
 * Nothing is sent by following this link. The visitor still reads what was
 * drafted for them, still passes the bot check and still presses send, exactly
 * as they did when this was a mailto into their own mail client. A message
 * longer than the textarea allows is clamped there rather than refused.
 */
export function contactFormUrl(topic: ContactTopic, message?: string): string {
  const params = new URLSearchParams({ topic })
  if (message !== undefined && message !== '') params.set('message', message)
  return `${CONTACT_FORM_URL}?${params.toString()}`
}

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
