// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/app.css'
import '@/styles/vocal-analysis.css'
import '@/styles/uvr.css'
import '@/styles/jam.css'
import '@/styles/exercises.css'
import '@/styles/pitch-testing.css'
import '@/styles/pitch-reference.css'
import '@/styles/changelog.css'
import '@/styles/daily-routine.css'
import '@/styles/restored-legacy.css'
import '@/components/Modal.css'
import { App } from './App'

import { consumeGoogleRedirect } from '@/db/services/auth-service'
import { initGlobalErrorHandlers } from '@/lib/global-error-handler'

initGlobalErrorHandlers()
// Store the JWT from a Google sign-in redirect (#gauth=…) before the
// app boots and ensureAuth() runs.
consumeGoogleRedirect()

const root = document.getElementById('root')
if (!root) {
  console.error('index.tsx: #root element not found')
} else {
  console.log('index.tsx: root element found, rendering App')

  // Add loaded class once app mounts to prevent FOUC
  render(
    () => (
      <App
        onMounted={() => {
          console.log('index.tsx: App mounted')
          root.classList.add('loaded')
        }}
      />
    ),
    root,
  )
}
