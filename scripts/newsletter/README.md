# Newsletter issues

One JSON file per issue. The fields map to what the worker renders:

| field       | what it is                                                     |
| ----------- | -------------------------------------------------------------- |
| `issue`     | slug, lowercase letters/digits/dashes. **The idempotency key** |
| `subject`   | the subject line, and the headline inside the mail             |
| `preheader` | the grey preview line inbox lists show beside the subject      |
| `intro`     | a sentence or two before the items                             |
| `items`     | `{ title, body, href?, cta? }` — one card each                 |

Anything else in the file is ignored, so notes can live alongside the copy.

## Sending one

```sh
export MP_API_BASE=https://api-dev.mercurypitch.com
export MP_ADMIN_KEY=…          # plus CF_ACCESS_CLIENT_ID/SECRET where Access is in front

# rehearse: renders the mail, mails nothing
node scripts/send-newsletter.mjs scripts/newsletter/v0-9-10.json --preview /tmp/issue.html

# one test address, for real
node scripts/send-newsletter.mjs scripts/newsletter/v0-9-10.json --only you@example.com --send

# everybody who has not had this issue yet
node scripts/send-newsletter.mjs scripts/newsletter/v0-9-10.json --send
```

Dev first, always. `api.mercurypitch.com` refuses without `MP_ALLOW_PROD=1`.

## The slug is not a label

Every accepted send is logged against `(issue, userId)`, and the recipient
query skips anyone already logged. That is what makes an interrupted run safe
to repeat: the same command finishes it.

It also means changing the slug to "send it again" mails everyone a second
copy. If a send genuinely needs repeating to one person, delete their row:

```sh
npx wrangler d1 execute mercurypitch-db --env dev --remote \
  --command "DELETE FROM newsletterSends WHERE issue = 'v0-9-10' AND userId = '…'"
```

## Before the first send on an environment

`NEWSLETTER_LINK_SECRET` and `RESEND_API_KEY` must both be set on that
worker; `--list` prints whether they are. Without the link secret the send is
refused rather than sent without an unsubscribe link.
