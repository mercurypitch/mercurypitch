# Owner test route — approved items 1–8

This is the acceptance stop before new campaign islands or levels. Existing
progress is retained. The new current Cloudway route has a separate versioned
save because its topology differs from the old straight route.

Use the HTTPS LAN host for tablet microphone testing. The standalone path skips
app onboarding. The playtest server disables hot reload; a manual page reload
is enough to restart a play session, but edited source needs a server restart.

## Short pre-merge recovery check

1. Cold-open the current Cloudway link in Chrome. If startup graphics fail, use
   the loading screen's **Retry**. Your checkpoint should remain intact. Report
   any recurring mailbox/texture warning; the specific driver failure has not
   been reproduced locally.
2. At a singing station, try the microphone. **Use it here** transfers a mic
   held by another cooperating same-origin app tab. **Try again** retries a
   permission/device error after its stated cause is addressed. The game cannot
   reset OS permissions or seize capture from unrelated apps. The optional
   melody practice has the same recovery controls.
3. In an Encore, select **Keep a recording of my next melody**, sing, then try
   **Sing again**. The second attempt must not record unless you opt in again.
   Check playback/Stop and switching away/returning once.

## Suggested order

1. **Museum map:** `/glass-game/?campaign=1`. Orbit and zoom around Twin Galleries
   and the Conservatory. Inspect the camellia planting, leaf/flower detail, temple
   joins, waterfall sources and cliff sides. Check touch navigation and map text.
2. **Current Cloudway trial:** `/glass-game/?layout=cloudway-current`. This dev
   shortcut opens the same crescent route/save as the campaign trial, without
   requiring a new unlock. Check marble/ice/glide detail at normal and close zoom,
   gradual turns, fog, landings and moving/collapsing platforms. Walk and jump to
   a safe checkpoint, then reload **before breaking glass**; Merc should resume
   there. The old `?layout=cloudway` route remains available with its old save.
3. **Camera comfort:** try turning while moving diagonally at near and far zoom.
   In the development “Tune” controls, compare the comfort presets and pointer
   sensitivity, then reload to confirm the preference persists. Check that manual
   orbit, follow recovery and challenge framing remain comfortable on tablet.
4. **Twin Galleries:** `/glass-game/?layout=twin-galleries`. Reach the upper-note
   Celadon decanter. Inspect its rim, base contact, and shatter. Confirm low/high
   learning and the exit still behave as before. Inspect an artwork and return
   to play; revisit the mirror at an oblique angle.
5. **Stars and collection:** from the campaign, complete an existing full gallery
   on its easy profile. Replay a harder tier and check the changed challenge goal.
   A partial harder run must not award a harder star. Optional discoveries and
   earned portraits survive replay; repeated visits must not duplicate tokens.
   Check the collection and the three distinct gallery portraits.
6. **Optional Coda Echo:** after completing a gallery, choose “Sing an optional
   encore,” or open Collection and choose “Sing or hear your encore” on an earned
   portrait. First use “Hear Merc,” then “Find my note and sing,” and sing the
   simple contour. Try another melody shape/pace. The trace should advance from
   actual singing, and reference playback must never score for you. Leaving the
   coda keeps the lesson, stars and portrait.
7. **A musical memory:** explicitly enable recording, sing a short coda, listen
   back, save it, reload, and replay it from the collection. Test Stop and Delete.
   Try cancelling or switching apps once during capture; audio and microphone
   use should stop cleanly. Nothing is recorded by default or uploaded by the game.

The ribbon and terrace route auditions remain development comparisons at
`?layout=cloudway-ribbon` and `?layout=cloudway-terrace`. They do not add campaign
chapters or replace the selected crescent.

## Feedback that decides the next stage

- Physical tablet smoothness and loading time, especially the dense platform kit.
- Camera comfort under your normal touch/keyboard play.
- Whether easy holds, the two-note lesson and gentle sway feel approachable.
- Melody reference, pace and judging feel when **you** sing; these are configurable.
- Any source/detail regressions visible at your preferred inspection distance.

Automated PCM, structural, screenshot and desktop rendering checks are saved
with the batch. They do not replace real singing or physical-device acceptance.
After acceptance, roadmap 9 can expand handcrafted rooms, levels and map stages;
10 (further mechanics/rivals) and 11 (release) remain later decisions.
