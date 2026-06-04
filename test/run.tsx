import { render } from 'ink'
import { Example } from './example'
import { initHighlighter } from '../src'

initHighlighter().then(() => {
  render(<Example />, { exitOnCtrlC: false })
})
