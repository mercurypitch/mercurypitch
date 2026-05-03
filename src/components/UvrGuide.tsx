// ============================================================
// UVR Guide — Tutorial for Vocal Separation Feature
// ============================================================

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'

export const UvrGuide: Component = () => {
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
              <span class="feature-icon">🎤</span>
              <span>Practice with clean vocals</span>
            </div>
            <div class="feature-card">
              <span class="feature-icon">🎵</span>
              <span>Improve pitch accuracy</span>
            </div>
            <div class="feature-card">
              <span class="feature-icon">🎶</span>
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
              <div class="mode-icon">🎭</div>
              <div class="mode-info">
                <strong>Separate</strong>
                <span>Default — hear both vocals & instrumental</span>
              </div>
            </div>
            <div class="mode-card guide-mode">
              <div class="mode-icon">🎵</div>
              <div class="mode-info">
                <strong>Instrumental</strong>
                <span>Remove vocals, focus on melody</span>
              </div>
            </div>
            <div class="mode-card guide-mode">
              <div class="mode-icon">🎤</div>
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
            💡 <strong>Pro Tip:</strong> In "Separate" mode, the two sliders
            work together to create your preferred mix. Experiment to find your
            ideal balance!
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
            💡 <strong>Pro Tip:</strong> Use medium smoothing for most practice
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
              <div class="use-case-icon">🎵</div>
              <div class="use-case-content">
                <strong>Learning Melodies</strong>
                <p>
                  Use <em>Instrumental Mode</em> to focus on the melody line
                  without vocals.
                </p>
              </div>
            </div>
            <div class="use-case">
              <div class="use-case-icon">🎤</div>
              <div class="use-case-content">
                <strong>Vocal Training</strong>
                <p>
                  Use <em>Vocal Only</em> to practice hitting exact pitch
                  targets.
                </p>
              </div>
            </div>
            <div class="use-case">
              <div class="use-case-icon">🎭</div>
              <div class="use-case-content">
                <strong>Full Practice</strong>
                <p>
                  Use <em>Separate Mode</em> to hear the full arrangement.
                </p>
              </div>
            </div>
            <div class="use-case">
              <div class="use-case-icon">🎧</div>
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
                <strong>Open the UVR Settings</strong>
                <p>Access in the Settings panel under the Music section.</p>
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
            <span class="success-icon">✓</span>
            <span>Your settings are saved automatically!</span>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div class="uvr-guide-container">
      {/* Header */}
      <div class="guide-header">
        <div class="guide-icon-wrapper">
          <span class="guide-icon">🎤🎵</span>
        </div>
        <h2>Vocal Separation Guide</h2>
        <p class="guide-subtitle">
          Learn how to use UVR for effective practice
        </p>
      </div>

      {/* Steps Navigation */}
      <div class="guide-steps-nav">
        {steps.map((_, i) => (
          <button
            class={`step-nav-btn ${activeStep() === i ? 'active' : ''}`}
            onClick={() => setActiveStep(i)}
            aria-label={`Go to step ${i + 1}`}
          >
            <span class="step-nav-num">{i + 1}</span>
            <span class="step-nav-label">{steps[i].title}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div class="guide-content">
        <div class="guide-progress-bar">
          <div
            class="guide-progress-fill"
            style={{ width: `${((activeStep() + 1) / steps.length) * 100}%` }}
          />
        </div>
        {steps[activeStep()].content}
      </div>

      {/* Navigation Buttons */}
      <div class="guide-nav-buttons">
        <button
          class="guide-btn guide-btn-secondary"
          onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
          disabled={activeStep() === 0}
        >
          ← Previous
        </button>
        <button
          class="guide-btn guide-btn-primary"
          onClick={() =>
            setActiveStep((s) => Math.min(steps.length - 1, s + 1))
          }
          disabled={activeStep() === steps.length - 1}
        >
          {activeStep() === steps.length - 1 ? 'Complete!' : 'Next →'}
        </button>
      </div>

      {/* Progress Indicator */}
      <div class="guide-progress-indicator">
        <span class="progress-text">
          {activeStep() + 1} of {steps.length}
        </span>
      </div>
    </div>
  )
}

// ============================================================
// CSS Styles (inline for this component)
// ============================================================

export const UvrGuideStyles: string = `
.uvr-guide-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto;
}

.guide-header {
  text-align: center;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 1rem;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.guide-icon-wrapper {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.guide-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.guide-steps-nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
}

.step-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  color: var(--fg-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.step-nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.step-nav-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.step-nav-num {
  font-size: 1.25rem;
  font-weight: bold;
}

.step-nav-label {
  font-size: 0.7rem;
  text-align: center;
  line-height: 1.2;
}

.guide-content {
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: 0.75rem;
  min-height: 200px;
}

.guide-progress-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.guide-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

.guide-section h4 {
  font-size: 1.1rem;
  margin-bottom: 1rem;
  color: var(--fg-primary);
}

.guide-text {
  color: var(--fg-secondary);
  line-height: 1.7;
  margin-bottom: 1.5rem;
}

.guide-feature-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-top: 1rem;
}

.guide-mode-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-top: 1rem;
}

.mode-card.guide-mode {
  padding: 1rem;
  background: var(--bg-primary);
  border: 2px solid var(--border);
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.mode-card.guide-mode:hover {
  border-color: var(--accent);
}

.mode-icon {
  font-size: 1.5rem;
}

.mode-info strong {
  display: block;
  color: var(--fg-primary);
  font-size: 0.9rem;
}

.mode-info span {
  font-size: 0.75rem;
  color: var(--fg-secondary);
}

.intensity-explanation {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.intensity-item {
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.intensity-name {
  display: block;
  color: var(--fg-primary);
  margin-bottom: 0.25rem;
  font-weight: 600;
}

.intensity-desc {
  display: block;
  color: var(--fg-secondary);
  font-size: 0.85rem;
}

.intensity-range {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--fg-tertiary);
  margin-top: 0.5rem;
  padding: 0.25rem;
  background: var(--bg-tertiary);
  border-radius: 0.25rem;
}

.guide-tip {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border-left: 3px solid #667eea;
  color: var(--fg-primary);
  font-size: 0.9rem;
  border-radius: 0 0.25rem 0.25rem 0;
}

.smooth-examples {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.smooth-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.smooth-toggle {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.smooth-toggle.active {
  background: rgba(102, 126, 234, 0.1);
  border-left: 3px solid #667eea;
}

.toggle-label {
  font-weight: 600;
  color: var(--fg-primary);
}

.toggle-value {
  color: var(--accent);
  font-weight: bold;
}

.smooth-result {
  color: var(--fg-secondary);
  font-size: 0.9rem;
}

.use-case-title {
  margin-bottom: 1rem;
}

.use-cases {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.use-case {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.use-case-icon {
  font-size: 1.5rem;
}

.use-case-content strong {
  display: block;
  color: var(--fg-primary);
  margin-bottom: 0.25rem;
}

.use-case-content p {
  font-size: 0.9rem;
  color: var(--fg-secondary);
  line-height: 1.5;
}

.quick-steps {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-primary);
  border-radius: 0.5rem;
}

.step-number {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.step-content strong {
  display: block;
  margin-bottom: 0.25rem;
}

.step-content p {
  font-size: 0.9rem;
  color: var(--fg-secondary);
}

.guide-success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(32, 201, 151, 0.1);
  border: 1px solid rgba(32, 201, 151, 0.2);
  border-radius: 0.5rem;
  color: var(--success);
}

.guide-nav-buttons {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.guide-btn {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.guide-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.guide-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.guide-btn-secondary {
  background: var(--bg-secondary);
  color: var(--fg-primary);
  border: 1px solid var(--border);
}

.guide-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
}

.guide-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.guide-progress-indicator {
  text-align: center;
  padding: 0.75rem;
  color: var(--fg-tertiary);
  font-size: 0.85rem;
  border-top: 1px solid var(--border);
}
`
