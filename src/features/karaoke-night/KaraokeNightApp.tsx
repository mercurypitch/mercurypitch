// Placeholder shell for the Karaoke Night page (routing PR). The real
// experience — theatre backdrop, left rail with upload + playlist, and the
// StemMixer performance stage with the demo song — lands in the next phase
// (docs/plans/karaoke-night.md, PR 3).
export function KaraokeNightApp() {
  return (
    <div class="kn-page">
      <main class="kn-hero">
        <p class="kn-brand">MercuryPitch</p>
        <h1>Karaoke Night</h1>
        <p class="kn-tagline">
          Turn any song you own into karaoke: AI removes the vocals, you sing
          with synced lyrics and live pitch scoring — right in your browser.
        </p>
        <a class="kn-cta" href="/#/karaoke/upload">
          Start in the studio
        </a>
        <p class="kn-note">
          The full Karaoke Night experience is being staged — the demo mix opens
          here soon.
        </p>
      </main>
    </div>
  )
}
