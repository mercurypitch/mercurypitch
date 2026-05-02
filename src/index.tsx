// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/app.css'
import '@/styles/vocal-analysis.css'
import { App } from './App'

import { initGlobalErrorHandlers } from '@/lib/global-error-handler'

initGlobalErrorHandlers()

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
