// ============================================================
// Newsletter issue — the one marketing mail
// ============================================================
//
// The one message here that is MARKETING rather than transactional, and the
// difference is the whole design. A transactional mail is sent because
// somebody just did something; this one is sent because somebody said yes
// once, possibly months ago, so every copy has to carry the way back out.
//
// The issue's own words (subject, preheader, intro, items) come from the
// operator's issue file in scripts/newsletter/, through newsletter.ts; this
// file is the frame around them. It opens with the first-note stage, which
// opens Home, as the welcome does, and shares the layout in email-layout.ts.
//
// The unsubscribe URL is per recipient and is minted by the worker, never by
// the operator's machine: the signing key stays a worker secret. See
// newsletter.ts.

import type { RenderedEmail, ResendConfig, ResendResult } from './email'
import { escapeHtml, maskEmail, resendPost } from './email'
import type { HeroLink, MailOrigins } from './email-layout'
import { arrowLink, bodyParagraph, button, closingRow, DISPLAY, documentHtml, footerText, heroRow, introRow, MAIL_ART, panelRow, SANS, W, } from './email-layout'

/** One part of an issue or a notice: a panel with a title, a body and
 *  maybe a link. */
export interface NewsletterItem {
  title: string
  body: string
  href?: string
  cta?: string
}

export interface NewsletterIssueVars extends MailOrigins {
  displayName?: string | null
  /** Subject line, and the headline, so the inbox and the page agree. */
  subject: string
  /** The grey preview line inbox lists show beside the subject. */
  preheader: string
  /** A sentence or two before the items. */
  intro: string
  items: NewsletterItem[]
  /** This recipient's one-click way out. Required: no link, no send. */
  unsubscribeUrl: string
}

const HOME_LINK: HeroLink = { path: '/#/home', label: 'Open MercuryPitch' }
const REASON_HTML =
  'You can change this any time in Settings &rsaquo; Account at'
const REASON_TEXT = 'You can change this any time in Settings > Account at'

function itemPanel(item: NewsletterItem, index: number): string {
  const link =
    item.href === undefined || item.href === ''
      ? ''
      : arrowLink(escapeHtml(item.cta ?? 'Take a look'), escapeHtml(item.href))
  return panelRow(
    `<div style="font:700 17px/1.35 ${DISPLAY};color:${W.text};">${escapeHtml(item.title)}</div><p style="margin:8px 0 0;font:15px/1.6 ${SANS};color:${W.soft};">${escapeHtml(item.body)}</p>${link}`,
    index === 0 ? 22 : 14,
  )
}

/** Pure renderer for one newsletter issue. No I/O, so a script can preview it. */
export function renderNewsletterIssue(v: NewsletterIssueVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${name},` : 'Hi there,'
  const unsubscribe = `<a href="${escapeHtml(v.unsubscribeUrl)}" style="color:${W.blue};text-decoration:underline;">Unsubscribe</a>`
  const html = documentHtml(
    v.subject,
    v.preheader,
    v,
    [
      heroRow(MAIL_ART.firstNote, v, HOME_LINK),
      introRow(
        { eyebrow: "What's new", headline: v.subject, body: greeting },
        bodyParagraph(escapeHtml(v.intro)),
      ),
      ...v.items.map(itemPanel),
      `<tr><td style="padding:8px 36px 4px;">${button('Open MercuryPitch', escapeHtml(v.appOrigin))}</td></tr>`,
      closingRow(
        null,
        `You&#39;re getting this because you asked for product updates. ${unsubscribe} with one click: no sign-in, and it takes effect right away.`,
      ),
    ],
    REASON_HTML,
  )

  const itemsText = v.items
    .map((item) => {
      const link =
        item.href === undefined || item.href === '' ? '' : `\n  ${item.href}`
      return `* ${item.title}\n  ${item.body}${link}`
    })
    .join('\n\n')

  const text = [
    v.subject,
    '',
    greeting,
    '',
    v.intro,
    '',
    itemsText,
    '',
    `Open MercuryPitch: ${v.appOrigin}`,
    '',
    "You're getting this because you asked for product updates at mercurypitch.com.",
    `Unsubscribe: ${v.unsubscribeUrl}`,
    '',
    ...footerText(REASON_TEXT),
  ].join('\n')

  return { subject: v.subject, html, text }
}

/**
 * Send one newsletter issue to one recipient. Returns the provider's message
 * id so the caller can log the send; `ok:false` means nothing was sent.
 *
 * Unlike the transactional senders this sets List-Unsubscribe and
 * List-Unsubscribe-Post, which Gmail and Yahoo require of anyone sending bulk
 * mail. The POST variant is what makes the inbox's own "unsubscribe" button
 * appear, and the worker's unsubscribe route accepts POST for exactly that.
 * It is also why `unsubscribeUrl` is not optional: without a working link this
 * mail must not go out at all.
 */
export async function sendNewsletterIssue(
  cfg: ResendConfig,
  to: string,
  vars: NewsletterIssueVars,
): Promise<ResendResult> {
  const result = await resendPost(cfg, to, renderNewsletterIssue(vars), {
    headers: {
      'List-Unsubscribe': `<${vars.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  if (result.ok) console.log(`[email] newsletter sent to ${maskEmail(to)}`)
  return result
}
