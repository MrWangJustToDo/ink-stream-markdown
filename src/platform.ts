import terminalLink from 'terminal-link'
import {
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
  ensureLanguage,
} from './utils/highlighter'
import type { Highlighter, InitHighlighterOptions } from './utils/highlighter'

export {
  terminalLink,
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
  ensureLanguage,
}
export type { Highlighter, InitHighlighterOptions }

export const getTerminalWidth = (): number =>
  (typeof process !== 'undefined' && process.stdout?.columns) || 80
