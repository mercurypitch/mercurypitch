# Corky motion refresh: generation and integration handoff

Status: preparation only. The owner will generate and approve the footage.
No Corky video, voice, audio scheduling, or living-loop implementation is changed
by this document. Keep this follow-up in the title/dial polish PR, unmerged until
the owner requests the next integration/release step.

## Generation authority

The copy/paste prompt master is in the owner's durable creative archive:

`/home/maff/.dotfiles/personal/besidecue/BESIDE-CUE-CORKY-FLOW-MOTION-BATCH-2026-09-05.md`

It contains seven independently usable shots, source links, timing evidence,
separate Character/Prop briefs, and review gates. Use the saved Flow Corky
Character and record-player Prop, not a new image-first identity setup. This is
the owner's explicit change from the older plate-only prompt workflow.

| Shot | Deliverable                                               | First use                                                                 |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| G01  | Six-second greeting, selected English voice cadence       | Replace the old baked mouth performance after approval.                   |
| R01  | Eight-second, eye-led gold-control press and record start | Restore Corky's character and clear physical cause/effect.                |
| R02  | Eight-second living Corky beside a rotating whole record  | Playback hold loop candidate; requires seam and prop review.              |
| L01  | Eight-second Corky-only living neutral rest               | Replace indefinite frozen normal-motion rest after offline compositing.   |
| L02  | Six-second Corky-only gaze-left welcome                   | One-shot reaction to an actual pull entrance.                             |
| L03  | Eight-second Corky-only attentive listening               | Living background during pull speech and choices.                         |
| L04  | Six-second silent return/acknowledgment                   | Return after a pull exits; saved acknowledgment only after save succeeds. |

Generate G01, R01, and L01 first. The other shots reuse their approved identity
and staging. Requested filenames in the master are not evidence that footage
already exists. Do not automatically enable looping because a prompt asked for
a loop.

## Audit findings

### Greeting mismatch is both authored performance and scheduling

The current app picture is
`public/onboarding/corky-v2.5/picture/b01-corky-greeting-direct-to-p02-v0_1.mp4`:
6.125 seconds, 24 fps, 147 frames, silent. It retains the older generated mouth
performance, while the selected English audio is a 1.869021-second original-tempo
cut from Corky batch-02-i:

`public/audio/voice/en/corky/en__corky__onboarding-greeting__v1_01.m4a`

The selected WAV and alignment are archived under:

`/home/maff/.dotfiles/personal/besidecue/assets/voice-auditions/2026-09-05-v1-selected/`

| Word  | Audio-relative start | Audio-relative end |
| ----- | -------------------: | -----------------: |
| Hi    |              0.099 s |            0.259 s |
| there |              0.340 s |            0.539 s |
| I     |              0.839 s |            0.859 s |
| am    |              0.899 s |            1.039 s |
| Corky |              1.100 s |            1.519 s |

These are automatic word-alignment spans, not verified phoneme/viseme markers.
The proposed new G01 audio onset is 0.750 seconds into its performance clip;
that is an editorial target, **not existing runtime behavior**. Do not use the
older Google greeting WAV as the new tempo reference.

`V2OnboardingDirector.tsx` calls `audioDirector.enterBeat()` on phase entry.
`web-audio-output.ts` resumes/prepares audio and then starts the source; video
readiness is independent. There is no authored B01 media-time onset contract.
The 1,550 ms automatic duration is a minimum dwell, not a voice delay. The
audited app asset also does not include the previously discussed 2.6-second
camera pre-roll. Any future camera lead-in must be accounted for once in the
final video's voice cue; do not add a wall-clock sleep to compensate.

### Existing motion is incomplete, not entirely missing

The creative archive's
`assets/generated_video_outs/higgsfield/corky-motion-library-v0_2/` contains three
actual 4.042-second takes and their saved review:

- C01 rest/blink is review-only: Corky's body changes shape, so it is not a
  seamless living-rest keeper.
- C02 screen-left gaze and C03 warm acknowledgment are technical donors worth
  reviewing before new L02/L04 generations. They are not current app-ready room
  compositions and do not constitute an integrated living loop.
- The separate Gemini `corky-motion-library/` contains a README naming planned
  files, not a delivered six-clip library.

The active media pack explicitly uses still resources for pull holds and the
table-ready scene. Its B06 spin is a finite full-frame video before the existing
platter/stopped-state handoff. Thus generating a living donor alone will not
make these states animate: the prepared derivatives and state mapping must
change after approval.

## Integration contract after footage approval

1. **Review picture before changing playback.** Preserve saved Character/Prop
   identity, body proportions, support contacts, player topology, target control,
   scene geography, and whole-disc rotation. Review loops across at least three
   cycles for pose, velocity, breathing, light and record-phase seams.
2. **Compose donors offline.** Existing pull movies may already contain Corky;
   replace that baked subject rather than overlaying a second copy. Preserve
   dark eyes/hollow tips with proper matting. Register body, shadow, room, crop
   and pull entry edge. Do not switch unrelated ambient scenes between states.
3. **Preserve the working iOS path.** Deliver opaque prepared video through the
   existing compatibility process, retain selected localized audio separately,
   and avoid new live alpha/keying/canvas or concurrent decoder-heavy layers.
   Leave the current audio fixes and platter fallback intact unless a specific
   measured integration change requires otherwise.
4. **Author a real dialogue cue.** Coordinate media presentation and decoded
   locale audio readiness; define the onset in the final video's media time and
   fire caption/voice once for its active token. Cancel obsolete cues, handle
   background/resume, and preserve reduced-motion immediate greeting and the
   bounded readiness fallback. A frame callback that never fires must not hang
   onboarding. Do not use minimum dwell or an arbitrary wall-clock delay as
   synchronization.
5. **Keep language-specific mouths honest.** ES greeting is 1.740 seconds and
   DE is 1.980 seconds with different syllables. Exact lip-sync requires separate
   performances. Silent listening/rest footage is reusable. The English spin
   line is 4.700 seconds versus 7.280 seconds in ES/DE; do not time-stretch the
   selected voices into the English speech window.
6. **Map reactions to events.** Welcome once on pull entry, then listen; return
   attention after exit. Maintain gentle living rest during longer overlays.
   Respect reduced motion and pause hidden/background presentation. Stop input
   must respond immediately, without waiting for an entire eight-second loop.
   A saved acknowledgment follows actual save success.
7. **Verify the whole join.** Regression tests must cover cold/warm load,
   exactly-once cues, replay, stale token cancellation, locale changes, mute,
   background/resume, readiness failure and reduced motion. Visually test the
   final speech and loop joins on physical iOS native and browser builds as well
   as the existing desktop/Android path. Prompt timestamps alone are not proof
   of synchronization.

## Provider capability boundary

Flow currently documents saved Character/asset references and custom voices
made from a preset plus instructions. That does not establish sample-locked
lip-sync to an imported ElevenLabs WAV. The master provides measured timing as
an audition target; if the owner's UI offers an actual audio-performance binding,
verify that it drives the mouth. Otherwise accept only after comparing to our
selected audio, or propose an audio-driven facial/editing pass after repeated
timing failure. [Google reference/voice workflow](https://support.google.com/flow/answer/16353334?hl=en)

The selected reference-based generation mode is Gemini Omni Flash 1.1. Do not
silently switch this batch to a model that cannot accept the requested saved
ingredients. [Google model/features table](https://support.google.com/flow/answer/16352836?hl=en)

## Verification boundary

The title/dial implementation and its existing regression checks are documented
in `title-and-dial-polish-2026-09-05.md`. This follow-up is documentary preparation;
there are no newly generated assets, AV-clock fix, living loops, or physical iOS
animation test results to claim yet.
