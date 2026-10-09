import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import { EMAIL_PREVIEW_PATH, handleEmailPreview } from './email-preview'

const env = (vars: Partial<Env> = {}): Env =>
  ({ EMAIL_PREVIEW: '1', ...vars }) as Env

function get(query: string, vars?: Partial<Env>): Response | null {
  return handleEmailPreview(
    new Request(`https://api.test${EMAIL_PREVIEW_PATH}${query}`),
    env(vars),
    EMAIL_PREVIEW_PATH,
  )
}

describe('the mail preview route', () => {
  it('is an unknown path unless the environment switches it on', () => {
    expect(get('', { EMAIL_PREVIEW: undefined })).toBeNull()
    expect(get('?mail=welcome', { EMAIL_PREVIEW: 'true' })).toBeNull()
  })

  it('answers GET only', () => {
    const post = handleEmailPreview(
      new Request(`https://api.test${EMAIL_PREVIEW_PATH}`, { method: 'POST' }),
      env(),
      EMAIL_PREVIEW_PATH,
    )
    expect(post).toBeNull()
  })

  it('leaves every other path alone', () => {
    expect(
      handleEmailPreview(
        new Request('https://api.test/api/auth/me'),
        env(),
        '/api/auth/me',
      ),
    ).toBeNull()
  })

  it('lists every variant', async () => {
    const response = get('')
    expect(response?.status).toBe(200)
    expect(response?.headers.get('Content-Type')).toBe(
      'text/html; charset=utf-8',
    )
    expect(response?.headers.get('Cache-Control')).toBe('no-store')
    const html = (await response?.text()) ?? ''
    for (const id of [
      'welcome',
      'welcome-karaoke',
      'welcome-twin',
      'confirm',
      'confirm-twin',
      'fresh-link',
      'fresh-link-twin',
      'purchase',
      'purchase-waiver',
      'purchase-offer',
      'withdrawal',
      'withdrawal-by-hand',
    ]) {
      expect(html).toContain(`?mail=${id}&amp;app=`)
    }
  })

  it("shows this environment's seller in the credit mails, or what is unset", async () => {
    const set =
      (await get('?mail=purchase&part=text', {
        TRADER_NAME: 'Sample Trader',
        TRADER_ADDRESS: '1 Sample Street, 00000 Sampletown',
        TRADER_EMAIL: 'sales@example.test',
        TRADER_VAT_ID: 'XX000000000',
      })?.text()) ?? ''
    expect(set).toContain(
      'Sold by Sample Trader, 1 Sample Street, 00000 Sampletown. Email sales@example.test. VAT ID XX000000000.',
    )
    const unset = (await get('?mail=withdrawal&part=text')?.text()) ?? ''
    expect(unset).toContain("Subject: We've received your cancellation")
    // A VAT ID is optional: a sole trader outside the VAT system has none.
    expect(unset).toContain(
      'Sold by [TRADER_NAME], [TRADER_ADDRESS]. Email [TRADER_EMAIL].\n',
    )
    expect(unset).not.toContain('VAT ID')
  })

  it('renders a mail with the sample twin, links and pictures on this environment', async () => {
    const response = get('?mail=welcome-twin', {
      APP_FALLBACK_ORIGIN: 'https://dev.mercurypitch.com',
    })
    const html = (await response?.text()) ?? ''
    expect(html).toContain('You share a range with Frank Sinatra.')
    expect(html).toContain(
      'src="https://dev.mercurypitch.com/email/legends/frank-sinatra-v1.jpg"',
    )
    expect(html).toContain('href="https://dev.mercurypitch.com/#/home"')
  })

  it('points at a local app only when that app is allowed', async () => {
    const local =
      (await get('?mail=confirm&app=http://localhost:3000')?.text()) ?? ''
    expect(local).toContain(
      'src="http://localhost:3000/email/banner-07-letter-v1.jpg"',
    )
    const foreign =
      (await get('?mail=confirm&app=https://evil.test')?.text()) ?? ''
    expect(foreign).not.toContain('evil.test')
    expect(foreign).toContain(
      'src="https://mercurypitch.com/email/banner-07-letter-v1.jpg"',
    )
  })

  it('shows the plain-text part', async () => {
    const response = get('?mail=confirm&part=text')
    expect(response?.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8',
    )
    const text = (await response?.text()) ?? ''
    expect(
      text.startsWith('Subject: Confirm your email for Mercury Pitch\n\n'),
    ).toBe(true)
    expect(text).toContain(
      'Confirm my email: https://mercurypitch.com/api/auth/verify-email?token=sample-token',
    )
  })

  it('says so when the mail does not exist', () => {
    expect(get('?mail=newsletter')?.status).toBe(404)
  })
})
