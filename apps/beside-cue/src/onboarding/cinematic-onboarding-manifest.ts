// ============================================================
// Cinematic onboarding manifests — approved picture plus v0.4 runtime mapping
// ============================================================

import type { CinematicOnboardingMediaManifest, LegacyCinematicOnboardingMediaManifestV03, } from './cinematic-onboarding-media'

const ROOT = '/onboarding/corky-v0.7'
const H08_V0_8_ROOT = '/onboarding/corky-v0.8'

const stills = {
  greeting: {
    poster: `${ROOT}/stills/h01-h02-greeting-poster.webp`,
    reducedStill: `${ROOT}/stills/h01-h02-greeting-reduced.webp`,
  },
  transition: {
    poster: `${ROOT}/stills/h03-table-reveal-poster.webp`,
    reducedStill: `${ROOT}/stills/h03-table-reveal-reduced.webp`,
  },
  scroll: {
    poster: `${ROOT}/stills/h04-scroll-arrival-poster.webp`,
    reducedStill: `${ROOT}/stills/h04-scroll-arrival-reduced.webp`,
  },
  sort: {
    poster: `${ROOT}/stills/h05-sort-sides-poster.webp`,
    reducedStill: `${ROOT}/stills/h05-sort-sides-reduced.webp`,
  },
  press: {
    poster: `${ROOT}/stills/h06-press-and-play-poster.webp`,
    reducedStill: `${ROOT}/stills/h06-press-and-play-reduced.webp`,
  },
  stopped: {
    poster: `${ROOT}/stills/h07-stop-and-acknowledge-poster.webp`,
    reducedStill: `${ROOT}/stills/h07-stop-and-acknowledge-reduced.webp`,
  },
} as const

/**
 * Delivery manifest for the user-approved 746-frame v0.7 picture. H08 reuses
 * H07's final authority still to avoid an independent-encode cut shift.
 */
/** @deprecated Retained as byte/provenance compatibility for contract v0.3. */
export const CORKY_ONBOARDING_MEDIA_V0_7: LegacyCinematicOnboardingMediaManifestV03 =
  Object.freeze({
    revision: 'corky-onboarding-v0.7',
    sourceContractVersion: '0.3.0',
    sourceContractSha256:
      '5cce2db9574035749784171b47af0a4b2d49733d6b2a38d9e80557e25522c27f',
    audio: Object.freeze({
      kind: 'continuous_review_mix',
      src: `${ROOT}/audio/review-mix-continuous-746f.m4a`,
      sourceDurationFrames: 746,
      clockPolicy: 'pause_with_picture',
    }),
    segments: Object.freeze({
      S01_S02_AUTO_ENTRANCE_HELLO: Object.freeze({
        kind: 'automatic',
        ...stills.greeting,
        video: `${ROOT}/picture/h01-h02-greeting.mp4`,
        alt: 'Corky swings into the warm paper scene and greets the viewer.',
      }),
      S03_AUTO_TRACKED_TRANSITION: Object.freeze({
        kind: 'automatic',
        ...stills.transition,
        video: `${ROOT}/picture/h03-table-reveal.mp4`,
        alt: 'A cream paper wall reveals Corky beside the record player.',
      }),
      S04_AUTO_CUE_ENTRANCE: Object.freeze({
        kind: 'automatic',
        ...stills.scroll,
        video: `${ROOT}/picture/h04-scroll-arrival.mp4`,
        alt: 'The Scroll arrives beside Corky and the record player.',
      }),
      S04_SIM_CUE_TAP_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.scroll,
        alt: 'Corky and The Scroll wait beside the record player.',
      }),
      S05_AUTO_REFRAME_SORT: Object.freeze({
        kind: 'automatic',
        ...stills.sort,
        video: `${ROOT}/picture/h05-sort-sides.mp4`,
        alt: 'Six cream and coral reason tiles sort into two tray wells.',
      }),
      S05_SIM_SORT_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.sort,
        alt: 'Six reason tiles rest in two balanced groups.',
      }),
      S06_AUTO_CORKY_PRESS: Object.freeze({
        kind: 'automatic',
        ...stills.press,
        video: `${ROOT}/picture/h06-press-and-play.mp4`,
        alt: 'Corky presses the record player control and the record begins.',
      }),
      S06_SIM_USER_SPIN_STOP_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.press,
        alt: 'Corky waits beside the playing record.',
      }),
      S07_AUTO_STOPPED_ACKNOWLEDGEMENT: Object.freeze({
        kind: 'automatic',
        ...stills.stopped,
        video: `${ROOT}/picture/h07-stop-and-acknowledge.mp4`,
        alt: 'The record is still while Corky gives a small calm blink.',
      }),
      S07_AUTO_REMINDER_DIAL_REVEAL: Object.freeze({
        kind: 'automatic_native_overlay',
        ...stills.stopped,
        alt: 'Corky waits beside the stopped record as reminder controls appear.',
      }),
      S07_SIM_REMINDER_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.stopped,
        alt: 'Corky waits beside the stopped record.',
      }),
      S07_AUTO_CONFIRM: Object.freeze({
        kind: 'automatic_native_overlay',
        ...stills.stopped,
        alt: 'Corky remains beside the stopped record as the choice is confirmed.',
      }),
      S08_AUTO_TITLE_CLOSE: Object.freeze({
        kind: 'automatic_native_overlay',
        poster: stills.stopped.reducedStill,
        reducedStill: stills.stopped.reducedStill,
        alt: 'Corky rests beside the stopped record for the Beside Cue close.',
      }),
    }),
  })

/**
 * Active v0.4 runtime mapping. H01/H02-H07 retain the approved v0.7 bytes;
 * H08 adds the visually approved, deterministic eye-only v0.8 close.
 */
export const CORKY_ONBOARDING_MEDIA_V0_8: CinematicOnboardingMediaManifest =
  Object.freeze({
    revision: 'corky-onboarding-v0.8',
    sourceContractVersion: '0.4.0',
    sourceContractSha256:
      'b6fc235b78532930ef6e8856b1b5b616217149ae468d307b10fd1ee7cc114cf4',
    audio: Object.freeze({
      kind: 'continuous_review_mix',
      src: `${ROOT}/audio/review-mix-continuous-746f.m4a`,
      sourceDurationFrames: 746,
      clockPolicy: 'pause_with_picture',
    }),
    segments: Object.freeze({
      S01_S02_AUTO_ENTRANCE_HELLO: Object.freeze({
        kind: 'automatic',
        ...stills.greeting,
        video: `${ROOT}/picture/h01-h02-greeting.mp4`,
        alt: 'Corky swings into the warm paper scene and greets the viewer.',
      }),
      S03_AUTO_TRACKED_TRANSITION: Object.freeze({
        kind: 'automatic',
        ...stills.transition,
        video: `${ROOT}/picture/h03-table-reveal.mp4`,
        alt: 'A cream paper wall reveals Corky beside the record player.',
      }),
      S04_AUTO_PULL_ENTRANCE: Object.freeze({
        kind: 'automatic',
        ...stills.scroll,
        video: `${ROOT}/picture/h04-scroll-arrival.mp4`,
        alt: 'The Scroll character arrives beside Corky and the record player.',
      }),
      S04_AUTO_PULL_INTRO: Object.freeze({
        kind: 'automatic_native_overlay',
        ...stills.scroll,
        alt: 'Corky and The Scroll rest while endless scrolling is introduced.',
      }),
      S05_AUTO_REFRAME_SIDE_CHOICE: Object.freeze({
        kind: 'automatic',
        ...stills.sort,
        video: `${ROOT}/picture/h05-sort-sides.mp4`,
        alt: 'Cream and coral tiles move into two tray wells.',
      }),
      S05_CHOOSE_B_SIDE_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.sort,
        alt: 'The tiles rest in the tray while Side B is chosen.',
      }),
      S06_AUTO_CORKY_PRESS: Object.freeze({
        kind: 'automatic',
        ...stills.press,
        video: `${ROOT}/picture/h06-press-and-play.mp4`,
        alt: 'Corky presses the record player control.',
      }),
      S06_CONFIRM_AND_SAVE_PLAN_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.press,
        alt: 'Corky waits beside the record while the two sides are saved.',
      }),
      S07_AUTO_STOPPED_ACKNOWLEDGEMENT: Object.freeze({
        kind: 'automatic',
        ...stills.stopped,
        video: `${ROOT}/picture/h07-stop-and-acknowledge.mp4`,
        alt: 'The record is still while Corky gives a small calm blink.',
      }),
      S07_REMINDER_HOLD: Object.freeze({
        kind: 'hold',
        ...stills.stopped,
        alt: 'Corky waits beside the stopped record while a reminder is considered.',
      }),
      S08_AUTO_TITLE_CLOSE: Object.freeze({
        kind: 'automatic',
        poster: stills.stopped.reducedStill,
        reducedStill: stills.stopped.reducedStill,
        video: `${H08_V0_8_ROOT}/picture/h08-quiet-close-eye-ack.mp4`,
        alt: 'Corky gives a calm blink beside the stopped record for the Beside Cue close.',
      }),
    }),
  })
