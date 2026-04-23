// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/app.css'
import { App } from './App'

// Global error handler to catch module errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error || e.message)
    ;(window as any).__globalError = e.error || e.message
  })
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason)
    ;(window as any).__globalError = e.reason
  })
}

// Capture console logs for debugging
if (typeof window !== 'undefined') {
  ;(window as any).__consoleLogs = []
  const oldLog = console.log
  console.log = (...args) => {
    ;(window as any).__consoleLogs.push({
      type: 'log',
      args: args.map((a) => String(a)),
    })
    oldLog(...args)
  }
  const oldError = console.error
  console.error = (...args) => {
    ;(window as any).__consoleLogs.push({
      type: 'error',
      args: args.map((a) => String(a)),
    })
    oldError(...args)
  }
  console.error('index.tsx: Console capture installed')
}

const root = document.getElementById('root')
if (!root) {
  console.error('index.tsx: #root element not found')
  ;(window as any).__appStore = null
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
