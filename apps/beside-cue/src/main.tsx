import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import '@fontsource/coiny/latin-400.css'
import '@fontsource/saira-condensed/latin-600.css'
import '@fontsource/saira-condensed/latin-700.css'
import './styles.css'
import { App } from './App'

const root = document.querySelector<HTMLDivElement>('#root')

if (root === null) {
  throw new Error('Beside Cue could not find its application root.')
}

render(() => <App />, root)
