import { render } from 'ink'
import { FoldExample } from './fold'
import { initHighlighter } from '../src'

initHighlighter().then(() => {
  render(<FoldExample />)
})