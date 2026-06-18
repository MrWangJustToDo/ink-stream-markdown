import terminalLink from 'terminal-link'
import { highlightCode, initHighlighter, clearHighlightCache } from './utils/highlighter'

export { terminalLink, highlightCode, initHighlighter, clearHighlightCache }

export const getTerminalWidth = (): number =>
  (typeof process !== 'undefined' && process.stdout?.columns) || 80
