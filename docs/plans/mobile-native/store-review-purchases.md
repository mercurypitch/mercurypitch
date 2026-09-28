# Store review: sandbox purchases on production

**Status:** in the Worker, off until switched on for a review
(`workers/db-worker/src/revenuecat-sandbox.ts`).

App Review buys the Karaoke subscription with a store sandbox account, so
every purchase a reviewer makes reaches RevenueCat as a `SANDBOX` event. The
build under review talks to the production API, and production grants songs
only for `PRODUCTION` events (`REVENUECAT_ENVIRONMENT`). Without this switch
a reviewer who subscribes gets no songs.

## What it does while on

The production Worker applies `SANDBOX` events too, for users that exist on
production. An event naming anyone else is acknowledged and changes nothing,
as before. It is bounded:

- one sandbox period grant per account per UTC day;
- a budget of sandbox songs per UTC day across the deployment
  (`REVENUECAT_SANDBOX_DAILY_SONGS`, default 200). Once it is spent, a grant
  gives no songs and the Worker logs a warning starting
  `[billing] revenuecat sandbox:`;
- the rollover cap of 50 songs, as for every period.

Sandbox grants are marked so reports can tell them apart:

| Where           | Paid                       | Sandbox                             |
| --------------- | -------------------------- | ----------------------------------- |
| Ledger reason   | `subscription`             | `subscription-sandbox`              |
| Moved in        | `subscription-transfer-in` | `subscription-sandbox-transfer-in`  |
| Moved out       | `transfer-out`             | `subscription-sandbox-transfer-out` |
| Entitlement     | `revenuecat:<product>`     | `revenuecat-sandbox:<product>`      |
| `billingEvents` | `revenuecat:<TYPE>`        | `revenuecat-sandbox:<TYPE>`         |

Refunds, reversed refunds, expiration and transfer work as they do for paid
periods. A sandbox event only ever takes or moves the songs of sandbox
periods, and only ever ends or moves a sandbox entitlement. A paid event
never takes a sandbox period's songs.

## Variables

Both are Worker secrets on production, never vars in `wrangler.jsonc`, so a
deploy never turns the switch on or off.

| Name                               | Value                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| `REVENUECAT_SANDBOX_ON_PRODUCTION` | `bounded` turns it on. Unset, or anything else, is off.     |
| `REVENUECAT_SANDBOX_DAILY_SONGS`   | Optional. A whole number of songs, 0 included. Default 200. |

Neither changes anything on the dev deployment, which takes sandbox events
as its own.

## Switching it on, before a build goes to review

In this order:

1. Production runs a release that includes this change and migration 0052
   (`revenuecatSandboxGrants`). The tag deploy applies migrations before it
   deploys.
2. `pnpm exec wrangler secret put REVENUECAT_SANDBOX_ON_PRODUCTION --config workers/db-worker/wrangler.jsonc --env prod`,
   and enter `bounded` when asked.
3. In RevenueCat, set the production webhook to send "Production and
   Sandbox" events.
4. Submit the build for review.

The switch goes on before the webhook changes because the Worker records an
event it ignores as handled, and a redelivery of it changes nothing.

While it is on, builds that talk to the production API go to App Review and
internal testers only.

What the sandbox has granted, per day:

```sql
SELECT day, SUM(songs) AS songs, COUNT(*) AS grants
  FROM revenuecatSandboxGrants GROUP BY day ORDER BY day;
```

## Switching it off, once the review is decided

1. In RevenueCat, set the production webhook back to "Production" events
   only.
2. `pnpm exec wrangler secret delete REVENUECAT_SANDBOX_ON_PRODUCTION --config workers/db-worker/wrangler.jsonc --env prod`,
   and the same for `REVENUECAT_SANDBOX_DAILY_SONGS` if it was set.

Sandbox songs already granted stay on their accounts, marked as above. A
sandbox subscription ends at the end of its last period.
