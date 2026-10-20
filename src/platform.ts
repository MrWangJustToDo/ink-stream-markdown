import terminalLink from 'terminal-link'
import {
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
} from './utils/highlighter'
import type { Highlighter } from './utils/highlighter'

export {
  terminalLink,
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
}
export type { Highlighter }

export const getTerminalWidth = (): number =>
  (typeof process !== 'undefined' && process.stdout?.columns) || 80
