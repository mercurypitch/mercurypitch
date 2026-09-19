#!/usr/bin/env node
// =====================================================================
// send-newsletter.mjs — mail one newsletter issue to the people who
// asked for it
// =====================================================================
//
//   node scripts/send-newsletter.mjs scripts/newsletter/v0-9-10.json
//   node scripts/send-newsletter.mjs <issue.json> --only you@example.com --send
//
//   MP_API_BASE   the db-worker, e.g. https://api-dev.mercurypitch.com
//   MP_ADMIN_KEY  the shared admin key
//   CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET  where Access is in front
//
// This script holds no secrets of its own and renders nothing. It posts the
// issue CONTENT to the worker, which owns the consent column, the unsubscribe
// signing key and the Resend key. That split is the point: a laptop that can
// draft a newsletter should not also be able to forge an unsubscribe link.
//
// ── It does not send unless told twice ──────────────────────────────
// Without `--send` this is a rehearsal: the worker resolves the recipients,
// renders the mail and returns it, and posts nothing. A newsletter cannot be
// unsent, so the safe run is the one you get by default and by accident.
//
// ── Re-running is safe ──────────────────────────────────────────────
// Every accepted send is logged per (issue, user), and the recipient query
// skips anyone already logged. A run that stopped half way — a rate limit, a
// dropped connection, a Ctrl-C — is finished by running the same command
// again. Change the `issue` slug only when it is genuinely a new issue.
// =====================================================================

import { readFile, writeFile } from 'node:fs/promises'
import { accessHint, adminHeaders } from './admin-headers.mjs'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : undefined
}

const issuePath = args.find((a) => !a.startsWith('--') && a.endsWith('.json'))
if (!issuePath || flag('help')) {
  console.error(
    [
      'Usage: node scripts/send-newsletter.mjs <issue.json> [options]',
      '',
      '  --only <email>    just this one address (a test send to yourself)',
      '  --send            actually send. Without it, nothing is mailed.',
      '  --list            print the recipients and stop',
      '  --preview <file>  write the rendered HTML here to open in a browser',
      '  --api <base>      override MP_API_BASE',
      '  --limit <n>       cap this run (the worker pages at 100 anyway)',
    ].join('\n'),
  )
  process.exit(1)
}

const apiBase = (
  value('api') ??
  process.env.MP_API_BASE ??
  'http://localhost:8788'
).replace(/\/$/, '')
const adminKey = process.env.MP_ADMIN_KEY ?? ''
if (!adminKey) {
  console.error('MP_ADMIN_KEY is required.')
  process.exit(1)
}

// Prod is a deliberate act, never the default a stale shell variable picks.
const isProd = /(^|\/\/)api\.mercurypitch\.com/i.test(apiBase)
if (isProd && process.env.MP_ALLOW_PROD !== '1') {
  console.error(
    `Refusing to touch production (${apiBase}). Set MP_ALLOW_PROD=1 if you truly mean it.`,
  )
  process.exit(1)
}

const issue = JSON.parse(await readFile(issuePath, 'utf8'))
for (const field of ['issue', 'subject', 'preheader', 'intro', 'items']) {
  if (issue[field] === undefined) {
    console.error(`${issuePath} is missing "${field}".`)
    process.exit(1)
  }
}

const only = value('only')
const limit = Number(value('limit')) || undefined
const headers = adminHeaders(adminKey)

async function call(path, init) {
  const res = await fetch(`${apiBase}${path}`, { ...init, headers })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = { error: text.slice(0, 400) }
  }
  if (!res.ok) {
    console.error(`${res.status} ${body.error ?? text}${accessHint(apiBase)}`)
    process.exit(1)
  }
  return body
}

// ── Who would get it ────────────────────────────────────────────────
const query = new URLSearchParams({ issue: issue.issue })
if (only) query.set('only', only)
if (limit) query.set('limit', String(limit))
const { recipients, canSend } = await call(
  `/api/newsletter/recipients?${query}`,
)

console.log(`${apiBase} — issue "${issue.issue}"`)
console.log(
  `link secret: ${canSend.link ? 'set' : 'MISSING'}   resend key: ${canSend.resend ? 'set' : 'MISSING'}`,
)
console.log(`${recipients.length} recipient(s) not yet sent this issue:`)
for (const r of recipients) {
  console.log(`  ${r.email}${r.displayName ? ` (${r.displayName})` : ''}`)
}
if (recipients.length === 0) {
  console.log('Nobody to send to. Done.')
  process.exit(0)
}
if (flag('list')) process.exit(0)

// ── Rehearse, then send ─────────────────────────────────────────────
const send = flag('send')
const previewPath = value('preview')

const post = () =>
  call('/api/newsletter/send', {
    method: 'POST',
    body: JSON.stringify({
      ...issue,
      ...(only ? { only } : {}),
      ...(limit ? { limit } : {}),
      dryRun: !send,
    }),
  })

let result = await post()

if (result.preview && previewPath) {
  await writeFile(previewPath, result.preview.html, 'utf8')
  console.log(`\nPreview written to ${previewPath}`)
}
if (result.preview && !previewPath) {
  console.log(`\nSubject: ${result.preview.subject}`)
  console.log('---')
  console.log(result.preview.text)
  console.log('---')
}

if (!send) {
  console.log(
    `\nDry run — nothing was sent. Add --send to mail ${recipients.length} recipient(s).`,
  )
  process.exit(0)
}

// The worker mails one page per call. Looping here rather than making the
// operator re-run is safe for exactly one reason: every accepted send is
// already logged, so the next page never includes anybody from this one.
let sent = 0
let failed = 0
for (;;) {
  sent += result.sent
  failed += result.failed
  for (const r of result.recipients) {
    if (r.status !== 'sent') console.log(`  ${r.status}: ${r.email}`)
  }
  if (!result.morePossible) break
  console.log(`  …${sent} sent, fetching the next page`)
  result = await post()
  if (result.sent === 0 && result.failed === 0) break
}

console.log(`\nSent ${sent}, failed ${failed}.`)
process.exit(failed > 0 ? 1 : 0)
