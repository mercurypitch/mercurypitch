// ============================================================
// UVR Guide — how the Karaoke tab actually works, start to finish
// ============================================================
//
// This replaces a seven-step tour of controls that no longer exist: the old
// guide walked through a "Separation Mode" picker, two intensity sliders and a
// "Transition Smoothness" slider, all of which fed signals nothing ever read
// (`applyUvrSettings` had no caller). It told users to open a settings panel
// and tune four things before they could sing.
//
// The real flow is: bring a song in, wait for separation, open the mixer, sing.
// That is what this describes, in that order, naming the buttons on screen.
//
// Keep it honest: if a step here cannot be followed by looking at the UI, the
// guide is wrong and should be fixed rather than worked around.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { IconArrowLeft, IconArrowRight, } from '@/components/hidden-features-icons'
import { Headphones, ImportFile, Music, MusicBoard, Playlist, SingMic, StageCurtains, Voice, } from './icons'
import styles from './UvrGuide.module.css'

interface UvrGuideProps {
  onClose?: () => void
}

export const UvrGuide: Component<UvrGuideProps> = (props) => {
  const [activeStep, setActiveStep] = createSignal(0)

  const steps = [
    {
      title: 'What the Karaoke tab does',
      icon: <Music />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            It turns <strong>a song file you own</strong> into a karaoke track:
            the vocals and the backing are split into separate stems, so you can
            mute the original singer, keep the band, and have the app score your
            pitch against the real melody.
          </p>
          <div class={styles.guideFeatures}>
            <div class={styles.featureCard}>
              <span class={styles.featureIcon}>
                <ImportFile />
              </span>
              <span>Bring your own MP3, WAV or FLAC</span>
            </div>
            <div class={styles.featureCard}>
              <span class={styles.featureIcon}>
                <Voice />
              </span>
              <span>Vocals and backing split apart</span>
            </div>
            <div class={styles.featureCard}>
              <span class={styles.featureIcon}>
                <Headphones />
              </span>
              <span>Lyrics, pitch trail and a score</span>
            </div>
          </div>
          <p class={styles.guideTip}>
            <strong>Nothing is streamed or downloaded for you.</strong> You
            supply the audio; separation happens on your own device unless you
            choose the studio GPU.
          </p>
        </div>
      ),
    },
    {
      title: 'Add a song',
      icon: <ImportFile />,
      content: (
        <div class={styles.guideSection}>
          <h4 class={styles.useCaseTitle}>Upload tab</h4>
          <div class={styles.quickSteps}>
            <div class={styles.step}>
              <div class={styles.stepNumber}>1</div>
              <div class={styles.stepContent}>
                <strong>Open Upload</strong>
                <p>
                  The second tab in this panel's header, beside <em>Sing</em>.
                </p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>2</div>
              <div class={styles.stepContent}>
                <strong>Drop files, or click the upload box</strong>
                <p>
                  MP3, WAV or FLAC, up to 15 at a time. Everything you drop is
                  queued and prepared in order.
                </p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>3</div>
              <div class={styles.stepContent}>
                <strong>Wait for separation</strong>
                <p>
                  A progress row appears per song. A four to five minute track
                  takes a couple of minutes on a typical laptop.
                </p>
              </div>
            </div>
          </div>
          <p class={styles.guideTip}>
            <strong>On a TV or a tablet with no file manager,</strong> the file
            picker may not open at all — the browser has nothing to open. Add
            the song on a phone or computer while signed in, then open it here
            from your library.
          </p>
        </div>
      ),
    },
    {
      title: 'On-device or studio',
      icon: <MusicBoard />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            One choice decides where the work happens. It lives in the panel
            header, and in <strong>Settings &rarr; Karaoke</strong>.
          </p>
          <div class={styles.guideModeCards}>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <MusicBoard />
              </div>
              <div class={styles.modeInfo}>
                <strong>On this device</strong>
                <span>
                  Free and private. Runs the separation model in your browser,
                  on the GPU when one is available. Needs a reasonably capable
                  machine — not a television.
                </span>
              </div>
            </div>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <Headphones />
              </div>
              <div class={styles.modeInfo}>
                <strong>Studio GPU</strong>
                <span>
                  One credit per song. Faster, cleaner, and the only option on
                  hardware that cannot run the model locally. Requires an
                  account.
                </span>
              </div>
            </div>
          </div>
          <p class={styles.guideTip}>
            <strong>Prepared once, playable anywhere.</strong> A separated song
            is stored on the device that made it; sign in to reach it from
            another one.
          </p>
        </div>
      ),
    },
    {
      title: 'Sing it',
      icon: <Voice />,
      content: (
        <div class={styles.guideSection}>
          <h4 class={styles.useCaseTitle}>Inside the mixer</h4>
          <div class={styles.useCases}>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <Headphones />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Balance the stems</strong>
                <p>
                  Each stem has its own fader and mute. Mute the vocal to sing
                  it yourself; keep it low as a guide while you learn it.
                </p>
              </div>
            </div>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <Voice />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Turn the mic on</strong>
                <p>
                  Your pitch is drawn against the extracted melody as you sing,
                  and scored per note when the take ends.
                </p>
              </div>
            </div>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <MusicBoard />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Loop the hard bar</strong>
                <p>
                  Set <strong>A</strong> and <strong>B</strong> on the transport
                  to repeat one phrase until it is yours.
                </p>
              </div>
            </div>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <Music />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Add lyrics</strong>
                <p>
                  The lyrics panel fetches synced words where they exist, or
                  generates timings from the vocal stem itself.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Set lists and the stage',
      icon: <Playlist />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            Once a few songs are prepared, they stop being files and start being
            a night out.
          </p>
          <div class={styles.guideModeCards}>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <Playlist />
              </div>
              <div class={styles.modeInfo}>
                <strong>Playlists</strong>
                <span>
                  Build a set list from your prepared songs; it plays straight
                  through, one song into the next.
                </span>
              </div>
            </div>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <StageCurtains />
              </div>
              <div class={styles.modeInfo}>
                <strong>Karaoke Night</strong>
                <span>
                  The full-screen theatre stage. Same songs, no app chrome — the
                  link is in this panel's header.
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Shazam & Sing',
      icon: <SingMic />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            The <strong>Sing</strong> tab finds a song in{' '}
            <em>your own library</em> from your voice. Every song you separate
            is fingerprinted from its vocal stem, so humming the chorus is
            enough to pull it back up.
          </p>
          <div class={styles.quickSteps}>
            <div class={styles.step}>
              <div class={styles.stepNumber}>1</div>
              <div class={styles.stepContent}>
                <strong>Press Listen</strong>
                <p>Sing or hum a few seconds of the melody.</p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>2</div>
              <div class={styles.stepContent}>
                <strong>Pick the match</strong>
                <p>Candidates are ranked by how closely the melody lines up.</p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>3</div>
              <div class={styles.stepContent}>
                <strong>Straight to the mixer</strong>
                <p>The match opens its prepared session, ready to sing.</p>
              </div>
            </div>
          </div>
          <p class={styles.guideTip}>
            <strong>Say &ldquo;Shazam sing&rdquo;</strong> with voice control on
            and this opens from anywhere in the app — no need to find the tab
            first. &ldquo;Name that song&rdquo; works too.
          </p>
          <p class={styles.guideTip}>
            <strong>Indexing is a setting.</strong> Settings &rarr; Karaoke
            &rarr; Shazam &amp; Sing controls whether new songs are
            fingerprinted, and whether their stems are denoised first.
          </p>
        </div>
      ),
    },
  ]

  return (
    <div class={styles.uvrGuideContainer}>
      {/* Unified Header — icons + current step title with arrows */}
      <div class={styles.guideStepHeader}>
        <button
          class={styles.guideStepArrow}
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep() === 0}
          aria-label="Previous step"
        >
          <IconArrowLeft />
        </button>
        <div class={styles.guideStepTitleArea}>
          <h3 class={styles.guideStepTitle}>
            <span class={styles.guideStepDynamicIcon}>
              {steps[activeStep()].icon}
            </span>
            {steps[activeStep()].title}
          </h3>
          <span class={styles.guideStepBadge}>
            {activeStep() + 1} / {steps.length}
          </span>
        </div>
        <button
          class={styles.guideStepArrow}
          onClick={() =>
            setActiveStep((s) => Math.min(steps.length - 1, s + 1))
          }
          disabled={activeStep() === steps.length - 1}
          aria-label="Next step"
        >
          <IconArrowRight />
        </button>
      </div>

      {/* Step Dots */}
      <div class={styles.guideStepDots}>
        <For each={steps}>
          {(_, i) => (
            <button
              class={
                activeStep() === i()
                  ? `${styles.guideStepDot} ${styles.guideStepDotActive}`
                  : styles.guideStepDot
              }
              onClick={() => setActiveStep(i())}
              aria-label={`Go to step ${i() + 1}`}
            />
          )}
        </For>
      </div>

      {/* Content Area */}
      <div class={styles.guideContent}>{steps[activeStep()].content}</div>

      {/* Navigation Buttons */}
      <div class={styles.guideNavButtons}>
        <button
          class={`${styles.guideBtn} ${styles.guideBtnPrimary}`}
          onClick={() => {
            if (activeStep() === steps.length - 1) {
              props.onClose?.()
            } else {
              setActiveStep((s) => Math.min(steps.length - 1, s + 1))
            }
          }}
        >
          {activeStep() === steps.length - 1 ? (
            'Close'
          ) : (
            <>
              Next <IconArrowRight />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
