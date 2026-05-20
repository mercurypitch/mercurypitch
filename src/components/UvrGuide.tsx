// ============================================================
// UVR Guide — Tutorial for Vocal Separation Feature
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { IconArrowLeft, IconArrowRight, } from '@/components/hidden-features-icons'
import { Headphones, Music, MusicBoard, Voice } from './icons'
import styles from './UvrGuide.module.css'

interface UvrGuideProps {
  onClose?: () => void
}

export const UvrGuide: Component<UvrGuideProps> = (props) => {
  const [activeStep, setActiveStep] = createSignal(0)

  const steps = [
    {
      title: 'What is Vocal Separation?',
      icon: <Music />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            <strong>Vocal Separation (UVR)</strong> is a powerful feature that
            separates vocals from instrumental music in real-time. This lets you
            practice singing along to your favorite songs with different audio
            focus options.
          </p>
          <div class={styles.guideFeatures}>
            <div class={styles.featureCard}>
              <span class={styles.featureIcon}>
                <Voice />
              </span>
              <span>Practice with clean vocals</span>
            </div>
            <div class={styles.featureCard}>
              <span class={styles.featureIcon}>
                <Headphones />
              </span>
              <span>Improve pitch accuracy</span>
            </div>
            <div class={styles.featureCard}>
              <span class={styles.featureIcon}>
                <MusicBoard />
              </span>
              <span>Learn melodies independently</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Separation Modes',
      icon: <MusicBoard />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            Choose a mode that fits your practice goals:
          </p>
          <div class={styles.guideModeCards}>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <MusicBoard />
              </div>
              <div class={styles.modeInfo}>
                <strong>Separate</strong>
                <span>Default — hear both vocals & instrumental</span>
              </div>
            </div>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <Headphones />
              </div>
              <div class={styles.modeInfo}>
                <strong>Instrumental</strong>
                <span>Remove vocals, focus on melody</span>
              </div>
            </div>
            <div class={`${styles.modeCard} ${styles.guideMode}`}>
              <div class={styles.modeIcon}>
                <Voice />
              </div>
              <div class={styles.modeInfo}>
                <strong>Vocal Only</strong>
                <span>Isolate vocals, practice singing</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Intensity Controls',
      icon: <Headphones />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            Adjust the balance between vocals and instrumental:
          </p>
          <div class={styles.intensityExplanation}>
            <div class={styles.intensityItem}>
              <span class={styles.intensityName}>Vocal Intensity</span>
              <span class={styles.intensityDesc}>
                Controls how prominent vocals are. Higher = more vocal presence
              </span>
              <div class={styles.intensityRange}>
                <span>Soft</span>
                <span>Focus</span>
                <span>Loud</span>
              </div>
            </div>
            <div class={styles.intensityItem}>
              <span class={styles.intensityName}>Instrumental Intensity</span>
              <span class={styles.intensityDesc}>
                Controls music volume. Higher = more musical accompaniment
              </span>
              <div class={styles.intensityRange}>
                <span>Muted</span>
                <span>Background</span>
                <span>Full</span>
              </div>
            </div>
          </div>
          <p class={styles.guideTip}>
            <strong>Pro Tip:</strong> In "Separate" mode, the two sliders work
            together to create your preferred mix. Experiment to find your ideal
            balance!
          </p>
        </div>
      ),
    },
    {
      title: 'Smoothing & Transitions',
      icon: <IconArrowRight />,
      content: (
        <div class={styles.guideSection}>
          <p class={styles.guideText}>
            The <strong>Transition Smoothness</strong> slider controls how
            smoothly the vocal/instrumental balance changes:
          </p>
          <div class={styles.smoothExamples}>
            <div class={styles.smoothItem}>
              <div class={styles.smoothToggle}>
                <span class={styles.toggleLabel}>Low</span>
                <span class={styles.toggleValue}>0%</span>
              </div>
              <span class={styles.smoothResult}>
                Abrupt changes — noticeable splits
              </span>
            </div>
            <div class={styles.smoothItem}>
              <div
                class={`${styles.smoothToggle} ${styles.smoothToggleActive}`}
              >
                <span class={styles.toggleLabel}>Medium</span>
                <span class={styles.toggleValue}>30%</span>
              </div>
              <span class={styles.smoothResult}>
                Balanced — smooth but distinct
              </span>
            </div>
            <div class={styles.smoothItem}>
              <div class={styles.smoothToggle}>
                <span class={styles.toggleLabel}>High</span>
                <span class={styles.toggleValue}>100%</span>
              </div>
              <span class={styles.smoothResult}>
                Very smooth — blended transitions
              </span>
            </div>
          </div>
          <p class={styles.guideTip}>
            <strong>Pro Tip:</strong> Use medium smoothing for most practice
            sessions. Increase for seamless playback between different parts.
          </p>
        </div>
      ),
    },
    {
      title: 'When to Use Each Mode',
      icon: <Voice />,
      content: (
        <div class={styles.guideSection}>
          <h4 class={styles.useCaseTitle}>Practice Scenarios</h4>
          <div class={styles.useCases}>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <Headphones />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Learning Melodies</strong>
                <p>
                  Use <em>Instrumental Mode</em> to focus on the melody line
                  without vocals.
                </p>
              </div>
            </div>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <Voice />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Vocal Training</strong>
                <p>
                  Use <em>Vocal Only</em> to practice hitting exact pitch
                  targets.
                </p>
              </div>
            </div>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <MusicBoard />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Full Practice</strong>
                <p>
                  Use <em>Separate Mode</em> to hear the full arrangement.
                </p>
              </div>
            </div>
            <div class={styles.useCase}>
              <div class={styles.useCaseIcon}>
                <Headphones />
              </div>
              <div class={styles.useCaseContent}>
                <strong>Background Practice</strong>
                <p>
                  Lower both intensities and set smoothing to high for subtle
                  accompaniment.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Shazam & Sing',
      icon: <Voice />,
      content: (
        <div class={styles.guideSection}>
          <h4 class={styles.useCaseTitle}>Sing Any Song Instantly</h4>
          <p class={styles.guideText}>
            Use the <strong>Shazam tab</strong> to identify music playing around
            you, and instantly turn it into a karaoke track!
          </p>
          <div class={styles.quickSteps}>
            <div class={styles.step}>
              <div class={styles.stepNumber}>1</div>
              <div class={styles.stepContent}>
                <strong>Listen</strong>
                <p>
                  Click "Listen" so the app can hear the song playing in the
                  background.
                </p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>2</div>
              <div class={styles.stepContent}>
                <strong>Identify</strong>
                <p>
                  We'll match it using the Shazam library and fetch the song
                  data.
                </p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>3</div>
              <div class={styles.stepContent}>
                <strong>Sing!</strong>
                <p>
                  Click "Sing" to find a streaming source (YouTube), separate
                  the vocals in real-time, and fetch synced lyrics.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Quick Start Guide',
      icon: <Music />,
      content: (
        <div class={styles.guideSection}>
          <h4 class={styles.useCaseTitle}>First Steps</h4>
          <div class={styles.quickSteps}>
            <div class={styles.step}>
              <div class={styles.stepNumber}>1</div>
              <div class={styles.stepContent}>
                <strong>Open UVR Settings</strong>
                <p>Click the gear icon in the Vocal Separation panel header.</p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>2</div>
              <div class={styles.stepContent}>
                <strong>Choose Your Mode</strong>
                <p>
                  Select Separate, Instrumental, or Vocal Only based on your
                  goal.
                </p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>3</div>
              <div class={styles.stepContent}>
                <strong>Adjust Intensities</strong>
                <p>
                  Tune the sliders to your preferred vocal/instrumental balance.
                </p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>4</div>
              <div class={styles.stepContent}>
                <strong>Set Smoothing</strong>
                <p>Choose a transition smoothness that feels natural.</p>
              </div>
            </div>
            <div class={styles.step}>
              <div class={styles.stepNumber}>5</div>
              <div class={styles.stepContent}>
                <strong>Start Practicing!</strong>
                <p>Open a song and watch the UVR process in real-time.</p>
              </div>
            </div>
          </div>
          <div class={styles.guideSuccess}>
            <Music />
            <span>Your settings are saved automatically!</span>
          </div>
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
