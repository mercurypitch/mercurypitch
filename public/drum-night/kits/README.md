# Drum Night kit assets

These are optional, gesture-loaded one-shot banks. They are not precached by
the service worker and are safe to move behind a configured media origin while
their content-hashed object keys remain unchanged.

`catalog.json` is the machine-readable byte, hash, articulation, provenance,
and license companion. `publish-plan.json` is inert metadata for a later,
reviewed Cloudflare R2 upload; it does not contain credentials or execute a
deployment.

Rebuild and verify from the repository root:

```sh
node scripts/curate-drum-night-kits.mjs
node scripts/curate-drum-night-kits.mjs --check
node scripts/curate-drum-night-kits.mjs --publish-plan
```

The Mercury Synth flavor has no downloadable assets. Its recipes live in
`src/lib/drum-voices.ts` and remain the per-hit fallback for every sampled
flavor.
