import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import { COLOR_SCHEME_META, renderAccountNotice, renderLoginCode, renderNewsletterIssue, renderPasswordReset, } from './email'
import { EMAIL_PREVIEW_PATH, handleEmailPreview } from './email-preview'
import { renderSignUpCode } from './email-sign-up-code'

// Every mail is drawn dark and declares "light only" (see COLOR_SCHEME_META),
// so nothing in it may lean on the client's default text color.

function preview(query: string): Promise<string> {
  const res = handleEmailPreview(
    new Request(`https://api.test${EMAIL_PREVIEW_PATH}${query}`),
    { EMAIL_PREVIEW: '1' } as Env,
    EMAIL_PREVIEW_PATH,
  )
  if (res === null || res.status !== 200)
    throw new Error(`no preview at ${query}`)
  return res.text()
}

async function everyMail(): Promise<[string, string][]> {
  const index = await preview('')
  const ids = [
    ...new Set([...index.matchAll(/[?&]mail=([a-z0-9-]+)/g)].map((m) => m[1])),
  ]
  const item = {
    title: 'What happened',
    body: 'A paragraph.',
    href: 'https://mercurypitch.com/',
    cta: 'Open it',
  }
  const mails: [string, string][] = await Promise.all(
    ids.map(
      async (id): Promise<[string, string]> => [
        id,
        await preview(`?mail=${id}`),
      ],
    ),
  )
  mails.push(
    [
      'password reset',
      renderPasswordReset({
        resetUrl: 'https://mercurypitch.com/#/reset-password?token=t',
        ttlHours: 1,
      }).html,
    ],
    ['login code', renderLoginCode({ code: '123456', ttlMinutes: 10 }).html],
    ['sign-up code', renderSignUpCode({ code: '123456', ttlMinutes: 10 }).html],
    [
      'newsletter',
      renderNewsletterIssue({
        subject: 'Issue',
        preheader: 'Pre',
        intro: 'Intro.',
        items: [item],
        unsubscribeUrl: 'https://mercurypitch.com/u',
      }).html,
    ],
    [
      'account notice',
      renderAccountNotice({
        kind: 'security',
        subject: 'Notice',
        preheader: 'Pre',
        intro: 'First.\n\nSecond.',
        items: [item],
      }).html,
    ],
  )
  return mails
}

describe('the color scheme every mail declares', () => {
  it('covers all twelve previews and the five other mails', async () => {
    expect((await everyMail()).length).toBeGreaterThanOrEqual(17)
  })

  it('is "light only", once, and never "dark"', async () => {
    for (const [name, html] of await everyMail()) {
      expect(html.split(COLOR_SCHEME_META).length - 1, name).toBe(1)
      expect(html, name).toContain(
        '<meta name="color-scheme" content="light only">',
      )
      expect(html, name).not.toMatch(/content="[^"]*dark[^"]*"/)
    }
  })

  it('gives every picture a text color, for the alt text shown when pictures are off', async () => {
    for (const [name, html] of await everyMail()) {
      for (const [img] of html.matchAll(/<img\b[^>]*>/g)) {
        expect(img, name).toMatch(/style="(?:[^"]*;)?\s*color:/)
      }
    }
  })
})
