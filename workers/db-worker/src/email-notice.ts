// ============================================================
// Account notice — mail we owe every account holder
// ============================================================
//
// The opposite of the newsletter in the one way that matters. That mail goes
// to people who said yes and carries the way back out; this one goes to every
// account holder because we owe it to them (a breach, a change to the terms,
// an account about to be deleted for inactivity) and there is no way out of
// it, so it carries none. No unsubscribe link, and no List-Unsubscribe
// header: offering a switch that does nothing would be the lie.
//
// What it carries instead is the reason it arrived. Somebody who unticked the
// box and still got mail from us is owed that sentence.
//
// Nothing here sells anything, on purpose. The day this template carries a
// product update is the day it needs consent it does not have. For the same
// reason it shows no picture but the wordmark, like the withdrawal mail: the
// notice that follows a breach is no place for Merc. Its words come from the
// operator through account-notices.ts; this file is the frame around them,
// in the layout of email-layout.ts.

import type { RenderedEmail, ResendConfig, ResendResult } from './email'
import { escapeHtml, maskEmail, resendPost } from './email'
import type { MailOrigins } from './email-layout'
import { bodyParagraph, closingRow, DISPLAY, documentHtml, footerText, introRow, panelRow, SANS, W, } from './email-layout'
import type { NewsletterItem } from './email-newsletter'

export type AccountNoticeKind = 'security' | 'legal' | 'account'

export interface AccountNoticeVars extends MailOrigins {
  displayName?: string | null
  kind: AccountNoticeKind
  /** Subject line, and the headline, so the inbox and the page agree. */
  subject: string
  /** The grey preview line inbox lists show beside the subject. */
  preheader: string
  /** The notice itself. A blank line starts a new paragraph. */
  intro: string
  /** Optional titled parts: "What happened", "What you can do". */
  items: NewsletterItem[]
  /** The operator's rehearsal copy. Marked in the subject and the body, so a
   *  forwarded test can never be read as the notice having gone out. */
  test?: boolean
}

const NOTICE_LABEL: Record<AccountNoticeKind, string> = {
  security: 'Security notice',
  legal: 'Legal notice',
  account: 'About your account',
}

const NOTICE_REASON =
  "You're getting this because you have a MercuryPitch account. It's a service message about that account, not a product update, so it goes to every account holder whatever their newsletter setting."

/** Said on every security notice, because the mail that follows a breach is
 *  the one a phisher most wants to imitate. */
const NOTICE_NEVER_ASKS =
  'We will never ask for your password by email. A message that does is not from us, whatever it looks like.'

const TEST_BANNER =
  'This is a test copy. The notice has not been sent to anyone else.'

const QUESTIONS = 'Questions? Reply to this email and a person will read it.'
const REASON = 'You have an account at'

/** Blank lines separate paragraphs; a single newline is a line break. */
function noticeParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '')
}

/** Each paragraph escaped, its single newlines kept as line breaks. */
function paragraphsHtml(text: string, wrap: (html: string) => string): string {
  return noticeParagraphs(text)
    .map((paragraph) => wrap(escapeHtml(paragraph).replace(/\n/g, '<br>')))
    .join('')
}

const itemParagraph = (html: string): string =>
  `<p style="margin:8px 0 0;font:15px/1.6 ${SANS};color:${W.soft};">${html}</p>`

function itemPanel(item: NewsletterItem, index: number): string {
  // Underlined: in the mail a phisher imitates, a link should look like one.
  const link =
    item.href === undefined || item.href === ''
      ? ''
      : `<a href="${escapeHtml(item.href)}" style="display:inline-block;margin-top:12px;font:600 15px/1.4 ${SANS};color:${W.blue};text-decoration:underline;">${escapeHtml(item.cta ?? 'Read more')}</a>`
  return panelRow(
    `<div style="font:700 17px/1.35 ${DISPLAY};color:${W.text};">${escapeHtml(item.title)}</div>${paragraphsHtml(item.body, itemParagraph)}${link}`,
    index === 0 ? 22 : 14,
  )
}

/** The test copy's mark, first thing in the card. */
const testRow = (): string =>
  `<tr><td style="padding:24px 24px 0;"><div style="padding:12px 16px;border:1px solid ${W.amber};border-radius:12px;font:600 14px/1.5 ${SANS};color:${W.text};">${escapeHtml(TEST_BANNER)}</div></td></tr>`

/** Pure renderer for one account notice. No I/O, so a dry run can show it. */
export function renderAccountNotice(v: AccountNoticeVars): RenderedEmail {
  const name = v.displayName?.trim()
  const greeting = name ? `Hi ${name},` : 'Hi there,'
  const subject = v.test === true ? `[TEST] ${v.subject}` : v.subject
  const label = NOTICE_LABEL[v.kind]
  const security = v.kind === 'security'

  const neverAsks = security
    ? `<p style="margin:0 0 10px;color:${W.text};">${escapeHtml(NOTICE_NEVER_ASKS)}</p>`
    : ''
  const html = documentHtml(
    subject,
    v.preheader,
    v,
    [
      v.test === true ? testRow() : '',
      introRow(
        { eyebrow: label, headline: v.subject, body: greeting },
        paragraphsHtml(v.intro, bodyParagraph),
      ),
      ...v.items.map(itemPanel),
      closingRow(
        escapeHtml(QUESTIONS),
        `${neverAsks}<p style="margin:0;">${escapeHtml(NOTICE_REASON)}</p>`,
      ),
    ],
    REASON,
  )

  const itemsText = v.items
    .map((item) => {
      const link =
        item.href === undefined || item.href === '' ? '' : `\n\n  ${item.href}`
      const body = noticeParagraphs(item.body)
        .map((paragraph) => `  ${paragraph.replace(/\n/g, '\n  ')}`)
        .join('\n\n')
      return `* ${item.title}\n${body}${link}`
    })
    .join('\n\n')

  // The plain-text part is not HTML, so the name goes in as typed.
  const text = [
    ...(v.test === true ? [TEST_BANNER, ''] : []),
    `${label.toUpperCase()}: ${v.subject}`,
    '',
    greeting,
    '',
    noticeParagraphs(v.intro).join('\n\n'),
    ...(itemsText === '' ? [] : ['', itemsText]),
    '',
    QUESTIONS,
    '',
    ...(security ? [NOTICE_NEVER_ASKS] : []),
    NOTICE_REASON,
    '',
    ...footerText(REASON),
  ].join('\n')

  return { subject, html, text }
}

/**
 * Send one account notice to one recipient. Returns the provider's message id
 * so the caller can log the send; `ok:false` means nothing was sent.
 *
 * Deliberately WITHOUT the List-Unsubscribe headers the newsletter sets. They
 * are for mail somebody can opt out of, and this is not: a header promising
 * an unsubscribe that the worker would then have to ignore is worse than no
 * header. Service mail is exempt from the bulk-sender rule that requires it.
 */
export async function sendAccountNotice(
  cfg: ResendConfig,
  to: string,
  vars: AccountNoticeVars,
): Promise<ResendResult> {
  const result = await resendPost(cfg, to, renderAccountNotice(vars))
  if (result.ok) {
    console.log(`[email] account notice sent to ${maskEmail(to)}`)
  }
  return result
}
