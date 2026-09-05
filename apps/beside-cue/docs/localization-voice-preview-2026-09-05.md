# Spanish and German character preview

This phase adds English, Español and Deutsch to the app language control in
Settings and before the first onboarding tap. The choice is stored on this
device. Croatian and Italian remain planned, not selectable unfinished locales.

## Scope

The translated route is V2 onboarding, the main record/Home flow, plan setup,
Cue/Quiet, reflection, Settings and shared controls. Character names stay the
same. Mini-game internals, the legacy cinematic fallback, operating-system
permission wording and store-owned screens are separate localization work;
this preview is not a claim that every release surface has human-approved
translations.

Corky has 25 lines per language. The six original Pulls each have their three
Meet/Present/Recede lines: Scroll, Sugarlump, Usual, Ember, Dinger and Fog.
That is 43 generated audition lines per language, using the selected English character
identities, with no new voice-design audition or voice cloning. Premium Pulls
have translated captions but no Spanish/German speech in this phase. Missing
speech stays silent; it must never fall back to unrelated English audio.

The app includes **42 screened recordings per language**. Spanish
`corky.not-now.02` and German `pull.familiar-ritual.present` remain caption-only
because independent speech checks still suggest a word mismatch. Their original
and comparison takes are preserved privately for listening, not relabeled as
approved. The delivery tests pin these exact two exceptions.

These are generated localization auditions for device testing. Model output
can vary in accent and pronunciation even when its saved voice identity is
unchanged. Exact-byte and caption-hash checks do not establish native-speaker
approval. Human listening, translation review and physical iOS testing remain
release checks.

## Implementation boundaries

- `i18n/locale.ts` owns stable language codes and safe unsupported-locale
  fallback. Each App has its own reactive locale context; there is no shared
  mutable locale singleton.
- Typed UI templates preserve placeholders. Already-visible status/error
  messages translate when the language changes rather than disappearing.
- `content/localized-voice-lines.ts` owns the frozen text and NFC caption hash.
  Delivered recordings register against that language's text, not English.
- Content packs share the existing music, sound effects and visuals. Changing
  language does not create another audio session or restart the score. Voice
  lookups read the current pack after persisted state has loaded.
- Language changes are disabled during atomic saves and reminder mutations,
  including a guarded callback, so a locale snapshot cannot overwrite a plan
  or pending reminder. A saved reminder keeps its ID and local time when its
  generic notification wording is rescheduled.
- Personal Pull, cue and Side B text is never machine-translated or rewritten.
  Display-only translation applies to an exact known built-in label with its
  matching stable ID. Stored plan text, IDs and `HH:mm` remain unchanged.

## Acceptance checks

Test English → Spanish → German, quit and reopen, then replay onboarding.
Listen for the selected character's identity and natural pronunciation, and
compare the displayed caption with every spoken word. Check a long overlay
hold, muted mode and return to Home for uninterrupted ambience. Choose a
Premium Pull with Pro access and confirm translated captions without an
English voice. Confirm all custom text is unchanged.

Repeat on a small iPhone, at enlarged text size, and with an existing reminder.
Desktop Chromium coverage is not evidence that the physical iOS checks passed.
The serialized delivery manifest and listening notes identify the particular
generated takes; they are not a commercial-rights clearance.
