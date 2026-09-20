# Merc voice selection and enrollment v3

The owner selected the original **D2 Gentle Whimsical** audition for Merc, preserving its whimsical nature. The permanent ElevenLabs voice name is **Merc V1 Gentle Whimsical D2**.

This directory records the selection and the bounded enrollment operation. The false scope fields in `selection.json` mean production-line generation and runtime integration were outside that enrollment operation; they do not limit later work authorized by the owner. Later production and runtime work belongs in its own manifest so the enrollment record remains historical and exact.

## Enrollment result

- **Availability:** verified in the ElevenLabs saved voice library
- **Permanent name:** `Merc V1 Gentle Whimsical D2`
- **Permanent voice ID:** `B4fBPRmasEsTgd6YlSok`
- **Source:** unchanged original v1 D2 preview
- **Enrollment:** one successful create call after an exact-name search found no existing match
- **Verification:** provider name, generated category, ownership and unchanged description confirmed through the voice-list endpoint

`enrollment-receipt.json` is the durable operation record. `enrolled-voice.json` is the compact permanent identity for later approved production work.

## Source identity

`selection.json` pins the chosen preview to all three original v1 records:

- direction D, take D2;
- generated preview ID from the v1 Voice Design response;
- unchanged D voice description;
- original lossless PCM byte count and SHA-256;
- exact ASR and zero-clipping evidence from the v1 review manifest.

`enroll.mjs` refuses any mismatch across the v1 batch, direction ledger, review manifest, and raw PCM. It does not contain a generation endpoint and cannot reinterpret or regenerate D.

## Bounded enrollment

The enrollment flow follows the current official ElevenLabs contracts:

- list/search voices: <https://elevenlabs.io/docs/api-reference/voices/search>
- create a voice from a generated preview: <https://elevenlabs.io/docs/api-reference/text-to-voice/create>

Before its one permitted create call, it searches the saved voice library for the exact permanent name. An exact compatible existing voice is reconciled without creating a duplicate. An ambiguous or incompatible match stops the operation.

The script reserves `enrollment-receipt.json` before `POST /v1/text-to-voice`. A rejected, interrupted, ambiguous, or partially verified outcome blocks automatic retry. A successful call stores only non-secret provider metadata and writes the verified permanent voice ID to `enrolled-voice.json`.

Local validation is non-networked and free:

```sh
rtk node enroll.mjs --dry-run
```

After enrollment, verify the source identity and durable receipt offline:

```sh
rtk node verify.mjs
```

The credential is injected by the password manager only for the enrollment process. No key or password-manager reference is stored in this directory, request receipt, or command documentation.

## Work tracked separately

- production narration line generation;
- runtime voice mapping;
- sung-reference provider and pitch-accuracy work;
- voice settings acceptance and in-game audio QA.

Their manifests and receipts remain separate from this enrollment record.
