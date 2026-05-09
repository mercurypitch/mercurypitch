// ============================================================
// UVR Guide — Tutorial for Vocal Separation Feature
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { Headphones, Music, MusicBoard, Voice } from './icons'

interface UvrGuideProps {
  onClose?: () => void
}

export const UvrGuide: Component<UvrGuideProps> = (props) => {
  const [activeStep, setActiveStep] = createSignal(0)

  const steps = [
    {
      title: 'What is Vocal Separation?',
      content: (
        <div class="guide-section">
          <p class="guide-text">
            <strong>Vocal Separation (UVR)</strong> is a powerful feature that
            separates vocals from instrumental music in real-time. This lets you
            practice singing along to your favorite songs with different audio
            focus options.
          </p>
          <div class="guide-features">
            <div class="feature-card">
              <span class="feature-icon">
                <Voice />
              </span>
              <span>Practice with clean vocals</span>
            </div>
            <div class="feature-card">
              <span class="feature-icon">
                <Headphones />
              </span>
              <span>Improve pitch accuracy</span>
            </div>
            <div class="feature-card">
              <span class="feature-icon">
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
      content: (
        <div class="guide-section">
          <p class="guide-text">Choose a mode that fits your practice goals:</p>
          <div class="guide-mode-cards">
            <div class="mode-card guide-mode">
              <div class="mode-icon">
                <MusicBoard />
              </div>
              <div class="mode-info">
                <strong>Separate</strong>
                <span>Default — hear both vocals & instrumental</span>
              </div>
            </div>
            <div class="mode-card guide-mode">
              <div class="mode-icon">
                <Headphones />
              </div>
              <div class="mode-info">
                <strong>Instrumental</strong>
                <span>Remove vocals, focus on melody</span>
              </div>
            </div>
            <div class="mode-card guide-mode">
              <div class="mode-icon">
                <Voice />
              </div>
              <div class="mode-info">
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
      content: (
        <div class="guide-section">
          <p class="guide-text">
            Adjust the balance between vocals and instrumental:
          </p>
          <div class="intensity-explanation">
            <div class="intensity-item">
              <span class="intensity-name">Vocal Intensity</span>
              <span class="intensity-desc">
                Controls how prominent vocals are. Higher = more vocal presence
              </span>
              <div class="intensity-range">
                <span>Soft</span>
                <span>Focus</span>
                <span>Loud</span>
              </div>
            </div>
            <div class="intensity-item">
              <span class="intensity-name">Instrumental Intensity</span>
              <span class="intensity-desc">
                Controls music volume. Higher = more musical accompaniment
              </span>
              <div class="intensity-range">
                <span>Muted</span>
                <span>Background</span>
                <span>Full</span>
              </div>
            </div>
          </div>
          <p class="guide-tip">
            <strong>Pro Tip:</strong> In "Separate" mode, the two sliders work
            together to create your preferred mix. Experiment to find your ideal
            balance!
          </p>
        </div>
      ),
    },
    {
      title: 'Smoothing & Transitions',
      content: (
        <div class="guide-section">
          <p class="guide-text">
            The <strong>Transition Smoothness</strong> slider controls how
            smoothly the vocal/instrumental balance changes:
          </p>
          <div class="smooth-examples">
            <div class="smooth-item">
              <div class="smooth-toggle">
                <span class="toggle-label">Low</span>
                <span class="toggle-value">0%</span>
              </div>
              <span class="smooth-result">
                Abrupt changes — noticeable splits
              </span>
            </div>
            <div class="smooth-item">
              <div class="smooth-toggle active">
                <span class="toggle-label">Medium</span>
                <span class="toggle-value">30%</span>
              </div>
              <span class="smooth-result">Balanced — smooth but distinct</span>
            </div>
            <div class="smooth-item">
              <div class="smooth-toggle">
                <span class="toggle-label">High</span>
                <span class="toggle-value">100%</span>
              </div>
              <span class="smooth-result">
                Very smooth — blended transitions
              </span>
            </div>
          </div>
          <p class="guide-tip">
            <strong>Pro Tip:</strong> Use medium smoothing for most practice
            sessions. Increase for seamless playback between different parts.
          </p>
        </div>
      ),
    },
    {
      title: 'When to Use Each Mode',
      content: (
        <div class="guide-section">
          <h4 class="use-case-title">Practice Scenarios</h4>
          <div class="use-cases">
            <div class="use-case">
              <div class="use-case-icon">
                <Headphones />
              </div>
              <div class="use-case-content">
                <strong>Learning Melodies</strong>
                <p>
                  Use <em>Instrumental Mode</em> to focus on the melody line
                  without vocals.
                </p>
              </div>
            </div>
            <div class="use-case">
              <div class="use-case-icon">
                <Voice />
              </div>
              <div class="use-case-content">
                <strong>Vocal Training</strong>
                <p>
                  Use <em>Vocal Only</em> to practice hitting exact pitch
                  targets.
                </p>
              </div>
            </div>
            <div class="use-case">
              <div class="use-case-icon">
                <MusicBoard />
              </div>
              <div class="use-case-content">
                <strong>Full Practice</strong>
                <p>
                  Use <em>Separate Mode</em> to hear the full arrangement.
                </p>
              </div>
            </div>
            <div class="use-case">
              <div class="use-case-icon">
                <Headphones />
              </div>
              <div class="use-case-content">
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
      title: 'Quick Start Guide',
      content: (
        <div class="guide-section">
          <h4 class="use-case-title">First Steps</h4>
          <div class="quick-steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <strong>Open UVR Settings</strong>
                <p>Click the gear icon in the Vocal Separation panel header.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <strong>Choose Your Mode</strong>
                <p>
                  Select Separate, Instrumental, or Vocal Only based on your
                  goal.
                </p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <strong>Adjust Intensities</strong>
                <p>
                  Tune the sliders to your preferred vocal/instrumental balance.
                </p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">4</div>
              <div class="step-content">
                <strong>Set Smoothing</strong>
                <p>Choose a transition smoothness that feels natural.</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">5</div>
              <div class="step-content">
                <strong>Start Practicing!</strong>
                <p>Open a song and watch the UVR process in real-time.</p>
              </div>
            </div>
          </div>
          <div class="guide-success">
            <Music />
            <span>Your settings are saved automatically!</span>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div class="uvr-guide-container">
      {/* Unified Header — icons + current step title with arrows */}
      <div class="guide-step-header">
        <button
          class="guide-step-arrow"
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep() === 0}
          aria-label="Previous step"
        >
          ←
        </button>
        <div class="guide-step-icons">
          <Voice />
          <Music />
        </div>
        <div class="guide-step-title-area">
          <h3 class="guide-step-title">{steps[activeStep()].title}</h3>
          <span class="guide-step-badge">
            {activeStep() + 1} / {steps.length}
          </span>
        </div>
        <button
          class="guide-step-arrow"
          onClick={() =>
            setActiveStep((s) => Math.min(steps.length - 1, s + 1))
          }
          disabled={activeStep() === steps.length - 1}
          aria-label="Next step"
        >
          →
        </button>
      </div>

      {/* Step Dots */}
      <div class="guide-step-dots">
        <For each={steps}>
          {(_, i) => (
            <button
              class={`guide-step-dot ${activeStep() === i() ? 'active' : ''}`}
              onClick={() => setActiveStep(i())}
              aria-label={`Go to step ${i() + 1}`}
            />
          )}
        </For>
      </div>

      {/* Progress bar */}
      <div class="guide-progress-bar">
        <div
          class="guide-progress-fill"
          style={{ width: `${((activeStep() + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Content Area */}
      <div class="guide-content">{steps[activeStep()].content}</div>

      {/* Navigation Buttons */}
      <div class="guide-nav-buttons">
        <button
          class="guide-btn guide-btn-primary"
          onClick={() => {
            if (activeStep() === steps.length - 1) {
              props.onClose?.()
            } else {
              setActiveStep((s) => Math.min(steps.length - 1, s + 1))
            }
          }}
        >
          {activeStep() === steps.length - 1 ? 'Close' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const _UvrGuideStyles: string = `
.uvr-guide-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 720px;
  margin: 0 auto;
  overflow-y: auto;
}

.guide-step-header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.8rem 0.85rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}

.guide-step-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  padding: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.guide-step-arrow:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--accent);
}

.guide-step-arrow:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.guide-step-icons {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--accent);
  flex-shrink: 0;
}

.guide-step-icons svg {
  width: 1.25rem;
  height: 1.25rem;
}

.guide-step-title-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  min-width: 0;
}

.guide-step-badge {
  display: inline-block;
  padding: 0.12rem 0.5rem;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 1rem;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  line-height: 1.3;
}

.guide-step-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.guide-step-dots {
  display: flex;
  justify-content: center;
  gap: 0.45rem;
}

.guide-step-dot {
  width: 0.45rem;
  height: 0.45rem;
  padding: 0;
  background: var(--border);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.guide-step-dot:hover {
  background: var(--accent);
  opacity: 0.6;
}

.guide-step-dot.active {
  background: var(--accent);
  width: 1.25rem;
  border-radius: 0.5rem;
}

.guide-content {
  padding: 1.25rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  min-height: 200px;
}

.guide-progress-bar {
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.guide-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.guide-section h4 {
  font-size: 1rem;
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
}

.guide-text {
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 1rem 0;
}

.guide-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.feature-card {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.feature-card:hover {
  border-color: var(--accent);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--accent);
}

.feature-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.guide-mode-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.mode-card.guide-mode {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s;
}

.mode-card.guide-mode:hover {
  border-color: var(--accent);
}

.mode-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--accent);
}

.mode-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.mode-info {
  text-align: center;
}

.mode-info strong {
  display: block;
  color: var(--text-primary);
  font-size: 0.85rem;
}

.mode-info span {
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.intensity-explanation {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.intensity-item {
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border: 1px solid var(--border);
}

.intensity-name {
  display: block;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.intensity-desc {
  display: block;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.intensity-range {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.4rem;
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 0.25rem;
}

.guide-tip {
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg-secondary);
  border-left: 3px solid var(--accent);
  color: var(--text-secondary);
  font-size: 0.85rem;
  border-radius: 0 0.25rem 0.25rem 0;
}

.smooth-examples {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.smooth-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.smooth-toggle {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border: 1px solid var(--border);
}

.smooth-toggle.active {
  background: var(--bg-tertiary);
  border-left: 3px solid var(--accent);
}

.toggle-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.toggle-value {
  color: var(--accent);
  font-weight: bold;
}

.smooth-result {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.use-case-title {
  margin-bottom: 0.75rem;
}

.use-cases {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.use-case {
  display: flex;
  gap: 0.6rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border: 1px solid var(--border);
}

.use-case-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  color: var(--accent);
}

.use-case-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.use-case-content strong {
  display: block;
  color: var(--text-primary);
  margin-bottom: 0.15rem;
  font-size: 0.9rem;
}

.use-case-content p {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0;
}

.quick-steps {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  border: 1px solid var(--border);
}

.step-number {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
}

.step-content strong {
  display: block;
  margin-bottom: 0.15rem;
  font-size: 0.9rem;
}

.step-content p {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
}

.guide-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--accent);
  font-size: 0.85rem;
}

.guide-nav-buttons {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.guide-btn {
  flex: 1;
  padding: 0.65rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.guide-btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.guide-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.guide-btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.guide-btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.guide-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

`
