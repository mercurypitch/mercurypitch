# Telling the room who just walked in

Right now somebody joins your jam and the only sign is a new pitch lane
appearing. The room should say so, in a voice that sounds like the app.

## Use the app's own toasts

`src/stores/notifications-store.ts` already exists and is the right home —
one notification system, one visual language. It gives us `type`,
`durationMs`, an optional action button, and a `channel`.

**What it does not yet do is group.** The `channel` mechanism *replaces*:

```ts
const base = notif.channel != null
  ? list.filter((n) => n.channel !== notif.channel)
  : list
```

So with a shared channel, "Bo slid in" would wipe "Ada slid in" and Ada's
arrival is simply lost. That is right for a tour offer, where only the
latest matters, and wrong for arrivals, where each one is a fact.

### The addition: coalescing

A third behaviour alongside "stack" and "replace" — **merge**. A short
window (~1.5 s) during which further notices on the same key fold into the
one toast rather than adding to it or replacing it.

```
Ada joins                 → "Ada slid into the jam"
Ada, then Bo within 1.5s  → "Ada and Bo slid into the jam"
five at once              → "Ada, Bo and 3 others joined the jam"
```

This lives in the store, not in the Jam tab, because "several of these
arrived at once" is a general problem and the next feature to hit it
should not reinvent it. The Jam tab supplies the words.

## The words

Randomised so the room does not read like a log file, and never the same
phrase twice running.

**Arriving** — "{name} slid into the jam", "{name} plugged in", "{name}
took the stage", "{name} stepped up to the mic", "{name} joined the
harmony", "{name} counted themselves in".

**Leaving** — "{name} unplugged", "{name} slipped out", "{name} left the
stage", "{name} packed up".

**The host** is worth its own line, because losing them changes what the
room can do: "{name} is back at the desk" on rejoin, "{name} stepped away
— the room is holding" on leave.

No emojis, per the house rule; the tone carries it.

## The part that matters more than the words

**A reconnect is not an arrival.** WebRTC drops and re-establishes
constantly on a phone changing networks, and your own log from testing
shows exactly this:

```
peer left db47e7d0-…
peer joined 0e8270c1-…   (same person, seconds later)
```

Announcing both would be worse than announcing neither. So:

- Hold a leave for a few seconds before saying anything. If the same
  display name reappears within the window, say nothing at all — they
  never really went.
- Only then emit the leave notice.

This is the rule that decides whether the feature feels alive or naggy,
and it is worth building before the vocabulary.

## Order of work

1. **Coalescing in the notifications store** — a `group` option with a key
   and a summariser, plus tests for one / two / many and for the window
   expiring.
2. **The reconnect grace period** in the jam store, around `onPeerLeft` /
   `onPeerJoined`.
3. **The phrase book** — a small pure module, no-repeat picker, tested for
   "never the same twice in a row".
4. **Wire it up** at the four moments: peer joins, peer leaves, host
   leaves, host returns.

Steps 1 and 2 are the engineering; 3 and 4 are the fun part and are
trivial once those hold.

## Open questions

| # | Question | My lean |
|---|---|---|
| N1 | Does the arriving person see a notice about themselves? | No — they can see they arrived. Everyone else gets it. |
| N2 | Do we announce arrivals to a room of two, or only from three upwards? | Announce always; with two people it is the clearest signal there is. |
| N3 | Should the leave notice wait the full grace period even when the connection closed cleanly (they pressed Leave)? | No — a clean leave is deliberate and can be immediate. Only a dropped connection needs the grace. |
| N4 | Should these be `info` toasts, or a quieter dedicated style? | `info`, at a shorter duration than the 6 s default — an arrival is not something to read twice. |
