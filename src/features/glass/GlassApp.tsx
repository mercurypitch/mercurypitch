// ============================================================
// Glass — the shattering voice mirror (P0: landing skeleton).
//
// Phase P0 of docs/plans/glass-handoff-2026-07-17.md: the SEO
// landing with the brand promise, the three-step preview and the
// required "Powered by TypeGPU" credit. The mic flow, rep loop
// and renderer land in P1–P4 behind the Start tap.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { IconGlide, IconReplay, IconShatter } from './icons'

export const GlassApp: Component = () => {
  const [previewOpen, setPreviewOpen] = createSignal(false)

  return (
    <div class="glass-shell">
      <div class="glass-cosmos" aria-hidden="true" />

      <main class="glass-main">
        <Show
          when={previewOpen()}
          fallback={<Landing onStart={() => setPreviewOpen(true)} />}
        >
          <HowItWillWork onBack={() => setPreviewOpen(false)} />
        </Show>
      </main>

      <footer class="glass-foot">
        <a
          class="glass-foot-link glass-foot-typegpu"
          href="https://docs.swmansion.com/TypeGPU/"
          target="_blank"
          rel="noopener"
        >
          Powered by TypeGPU
        </a>
        <span class="glass-foot-sep" aria-hidden="true">
          ·
        </span>
        <a class="glass-foot-link" href="/mirror">
          Voice Mirror
        </a>
        <span class="glass-foot-sep" aria-hidden="true">
          ·
        </span>
        <a class="glass-foot-link" href="/karaoke-night">
          Karaoke Night
        </a>
      </footer>
    </div>
  )
}

const Landing: Component<{ onStart: () => void }> = (props) => (
  <section class="glass-panel glass-landing">
    <p class="glass-wordmark">MercuryPitch</p>
    <h1>Break glass with your voice</h1>
    <p class="glass-lead">
      This mirror rings at a note near the top of <em>your</em> range. Land it,
      hold it, and the resonance builds until the glass gives way — real
      fracture physics, live in your browser.
    </p>
    <div class="glass-actions">
      <button class="glass-cta" onClick={() => props.onStart()}>
        Start singing
      </button>
    </div>
    <p class="glass-trust">
      Your audio never leaves this device. Takes are recorded on-device, played
      back to you, then deleted.
    </p>
  </section>
)

const HowItWillWork: Component<{ onBack: () => void }> = (props) => (
  <section class="glass-panel glass-steps">
    <h2>How it works</h2>
    <ol class="glass-step-list">
      <li>
        <span class="glass-step-icon">
          <IconGlide />
        </span>
        <div>
          <h3>Calibrate</h3>
          <p>
            Slide low to high, like a siren — you will hear an example first.
            The glass tunes itself just below your ceiling.
          </p>
        </div>
      </li>
      <li>
        <span class="glass-step-icon">
          <IconReplay />
        </span>
        <div>
          <h3>Sing, then hear yourself</h3>
          <p>
            Your voice dances in the mirror as you reach for the gold line.
            After each take it plays back to you — getting used to your own
            voice is the exercise.
          </p>
        </div>
      </li>
      <li>
        <span class="glass-step-icon">
          <IconShatter />
        </span>
        <div>
          <h3>Shatter it</h3>
          <p>
            Every near-miss leaves a real crack. Hold the note and the glass
            bursts into a hundred shards — persistence always wins.
          </p>
        </div>
      </li>
    </ol>
    <p class="glass-soon">
      The glass is being silvered — the full experience lands here shortly.
    </p>
    <div class="glass-actions">
      <button
        class="glass-cta glass-cta-secondary"
        onClick={() => props.onBack()}
      >
        Back
      </button>
    </div>
  </section>
)
