import { showNotification, startTour, STEM_MIXER_TOUR_STEPS } from '@/stores'

/**
 * Start the StemMixer spotlight tour only when a song is actually loaded in the
 * mixer (its `data-tour="mixer.*"` targets exist). Otherwise nudge the user —
 * the default Karaoke view is the upload screen, where running the tour would
 * just show target-less, centered tooltips. Used by both the Guide modal entry
 * and the Karaoke Learn-tutorial bridge.
 */
export function startMixerTourIfReady(): void {
  const ready =
    typeof document !== 'undefined' &&
    document.querySelector('[data-tour="mixer.stems"]') !== null
  if (ready) {
    startTour(STEM_MIXER_TOUR_STEPS)
  } else {
    showNotification(
      'Open a song in the Karaoke mixer first, then take this tour.',
      'info',
    )
  }
}
