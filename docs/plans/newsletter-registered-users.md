# Newsletter for registered users

**Date**: 2026-09-19 · **Status**: proposed, decisions locked (§9). Phase 1 and
2 are one PR; phase 3 is the sender and can follow.

A singer who makes an account can ask to hear from us when something real
ships. Nothing else: no digests, no re-engagement nags, no "we noticed you
haven't practiced". A checkbox at sign-up, the same checkbox in Settings, and a
list we can actually mail.

The landing site already has a newsletter (`Newsletter.astro` plus
`POST /api/subscribe` in `packages/mercurypitch/src/worker.ts`), and it writes
to a **Resend Audience**. That list is for people who have never signed up for
anything. This plan does not touch it, and deliberately does not reuse its
mechanism. §3 says why.

---

## 1. What the singer sees

**At sign-up.** One unticked checkbox on the register form:

> Send me product updates. Big new features and milestones only, and never
> more than once a month. You can stop any time.

Unticked is not a style choice. Consent under GDPR has to be an affirmative
act, so a pre-ticked box is not consent at all and would make the whole list
unusable.

**In Settings.** The same choice, in the account section, next to the
leaderboard opt-in it is modelled on. Turning it off takes effect on the next
request, not on the next send.

**In every email.** A one-click unsubscribe link that needs no sign-in, plus
the `List-Unsubscribe` headers Gmail and Yahoo have required of bulk senders
since 2024. The link is the same switch as the Settings checkbox.

---

## 2. Where the consent lives

D1, on `users`. Migration `0047_newsletter_consent.sql`:

```sql
ALTER TABLE users ADD COLUMN newsletterOptIn INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN newsletterOptInAt TEXT;
ALTER TABLE users ADD COLUMN newsletterOptOutAt TEXT;
ALTER TABLE users ADD COLUMN newsletterSource TEXT;
```

The boolean is what the sender queries; the two timestamps and the source are
the record of consent, which is the part a regulator asks for. `newsletterSource`
is one of `signup`, `settings`, `email` (the unsubscribe link).

Why a column and not a table: one row per user, one value, read on every
`/api/auth/me`. A table would buy history nobody needs and a join on every
profile read. The precedent is `users.leaderboardExcludedAt` (migration 0022),
which is the same shape of decision.

**Erasure is free.** The columns are on the row that account deletion already
deletes, so nothing has to be added to the erasure contract in `auth.ts`. That
is not an accident; it is the main reason for §3's decision.

---

## 3. The list is D1. Resend is a delivery mechanism

The alternative was mirroring every opt-in into a Resend Audience and sending
broadcasts from their dashboard. Rejected, for four reasons:

1. **Two sources of truth drift.** An unsubscribe clicked in an email would
   land in Resend, and the Settings checkbox would go on saying the opposite
   until something reconciled them. A checkbox that lies about consent is the
   one state this feature must never reach.
2. **Erasure gets a second hop.** Delete an account and the contact has to be
   deleted from Resend too, best-effort, from a request that must not fail if
   Resend is down. Every audit of that path has to consider a partial erasure.
3. **Opt-out has to work when Resend does not.** If the switch is a column, it
   always works.
4. **We already have the query.** `emailVerified` and `suspendedAt` live next
   to the new column. The audience would have to be told about both.

So: the source of truth is `users`, the send reads `users`, and the unsubscribe
link writes `users`. No audience for account holders, nothing to reconcile.

The landing keeps its audience. Someone on both lists gets one email, because
the sender dedupes by address across the two sources (§6).

---

## 4. No confirmation email. The verification we already send is the confirmation

The obvious worry with a single opt-in is someone typing an address that is not
theirs. That cannot happen here, because the send is gated on
`emailVerified = 1`:

- **Password sign-ups** already get a verification email
  (`sendVerificationEmail` in `auth.ts`). Until they click it, they are not
  mailed.
- **Google and Apple sign-ups** arrive verified by the provider.

So the double opt-in exists; it is just the one the account already performs. A
second confirmation email would ask the same person to prove the same address
twice, and every one of those is a place to drop out.

---

## 5. Server

All in `workers/db-worker`.

**`handleRegister`** reads `body.newsletterOptIn === true` and writes the
columns with source `signup`. Anything other than `true` is off: an absent
field, a string, a number. The flag rides the same request as the password, so
there is no window where the account exists without the answer.

`upgradeAnonymousToPassword` takes the same flag, or an anonymous device that
upgrades in place never gets asked.

**`publicUser()`** gains `newsletterOptIn: boolean`, so `/api/auth/me` carries
it and the Settings checkbox has something to render. It is the user's own
answer about themselves; nothing here is admin-only.

**`POST /api/newsletter/preference`** `{ optIn: boolean }`, auth required. Writes the
columns with source `settings` and stamps the matching timestamp. Rate limited
with the existing per-IP bucket (`RATE_LIMITS`), generously: this is a
checkbox, not a credential.

**`GET /api/newsletter/unsubscribe?t=<token>`**, no auth. The token is an HMAC
over the user id and the current `newsletterOptInAt`, signed with
`NEWSLETTER_LINK_SECRET` — its own secret, so rotating the one that mints
sessions cannot break a link already sitting in somebody's inbox. Properties it has to have:

- **Unguessable**, so nobody can unsubscribe a stranger.
- **Idempotent.** Clicking twice, or a mail client prefetching the link, must
  not error and must not resubscribe.
- **Silent about membership.** The same page for a valid token, an expired one
  and a stranger's id. An unsubscribe endpoint that answers differently for a
  real address is an address oracle.
- **Self-invalidating.** Because the token covers `newsletterOptInAt`, opting
  back in mints a new one and the old link stops working.

It answers a small branded HTML page, not JSON: a mail client opens it in a
browser.

`POST /api/newsletter/unsubscribe` answers the same way, for
`List-Unsubscribe-Post`. Neither reads a body: that one arrives form-encoded.

The storage sits in `newsletter-consent.ts`, on its own, because both ends
need it and they must not import each other — `auth.ts` records the answer
from the register form, and `newsletter.ts` records the one from Settings
while importing `auth.ts` for the session and the rate limiter.

---

## 6. Sending

`scripts/send-newsletter.mjs`, run by hand. It is the companyReportViewer shape:
read the list, render, send, report.

```
node scripts/send-newsletter.mjs --env dev --subject "..." --body notes.md --dry-run
node scripts/send-newsletter.mjs --env dev --subject "..." --body notes.md --send
```

- **Recipients** come from `GET /api/admin/newsletter/recipients`, which needs
  `X-Admin-Key` (on prod that header is required; Access alone is admin on dev
  only). The query is
  `newsletterOptIn = 1 AND emailVerified = 1 AND suspendedAt IS NULL AND email IS NOT NULL`.
- **The landing list**, optionally, via `--include-audience`, read from the
  Resend Audience. Deduped against the D1 list by lowercased address, D1
  winning, so a registered user who also signed up on the site is mailed once
  and gets our unsubscribe link rather than Resend's.
- **Rendering** reuses the branded template in
  `workers/db-worker/src/email.ts`, which is where every other MercuryPitch
  email is already styled. Markdown in, HTML and a text part out. Both parts
  carry the unsubscribe link.
- **Sending** is Resend's batch endpoint, 100 addresses per call, one recipient
  per message (never a shared To or Bcc), with `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers.
- **`--dry-run` is the default.** `--send` is required to mail anyone, and it
  prints the count and the first three addresses and waits for a typed
  confirmation. A newsletter script that can send on a typo is a script that
  will.
- **A send is recorded** in `newsletterSends` (id, subject, sentAt,
  recipientCount, sentBy) so "did this already go out?" has an answer.

---

## 7. Client

**`AuthModal.tsx`**, register mode: the checkbox, unticked, above the submit
button, its own row in `AuthModal.module.css`. The value goes into the register
payload.

Known gap, deliberate: Google and Apple sign-ups have no form, so they land
opted out and turn it on in Settings. Carrying a checkbox through an OAuth
round trip means stashing it in `sessionStorage` and replaying it on return,
which is three more failure modes for a checkbox. A later PR can offer the ask
once, in the account section, to anyone who has never answered
(`newsletterOptInAt IS NULL AND newsletterOptOutAt IS NULL`).

**`AccountSection.tsx`**: the same row as the leaderboard opt-in, which is the
Mercury style the feature has to match. It copies that row's behaviour exactly,
including the part that matters most: on a failed write it re-reads the profile
so the checkbox snaps back to the stored value rather than showing a consent
state the server never accepted.

`data-testid="newsletter-optin"`, matching `leaderboard-optin`.

---

## 8. Privacy notice

The landing's `/privacy` needs a line, because this is new processing: what is
stored (whether you asked, and when), who sends it (Resend, as a processor),
and the two ways out (Settings, or the link in any email). That is a change in
`disjoint-colliders`, not here, and it ships before the first send, not before
the first opt-in.

---

## 9. Decisions

| #   | Decision                                                 | Why                                                                                                  |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| D1  | Consent lives in D1 on `users`, not in a Resend Audience | One source of truth, erasure for free, opt-out works when Resend does not                            |
| D2  | Single opt-in, gated on `emailVerified`                  | The verification email already proves the address; a second one only loses people                    |
| D3  | Checkbox unticked by default                             | A pre-ticked box is not consent                                                                      |
| D4  | Password register form only in v1                        | An OAuth round trip is the wrong place to carry a checkbox; Settings covers everyone                 |
| D5  | Unsubscribe is a signed link, no sign-in                 | Required by bulk-sender rules, and the person may no longer have the password                        |
| D6  | The sender is a script, not a scheduled worker           | Nobody should be able to send a newsletter by accident, and a cron that mails people is exactly that |
| D7  | `--dry-run` is the default                               | See D6                                                                                               |

## 10. Phases

1. **Server.** Migration, register flag, `publicUser`, the two routes, tests.
   Inert until something sets the column.
2. **Client.** The two checkboxes, tests.
3. **Sender.** The script, the admin recipients route, `newsletterSends`, and
   the privacy note on the landing. Nothing mails anybody until this lands.

Phases 1 and 2 are one PR. Phase 3 follows, because the first send is a
decision, not a deploy.
