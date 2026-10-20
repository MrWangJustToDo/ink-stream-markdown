import terminalLink from './utils/terminal-link-browser'
import {
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
  ensureLanguage,
} from './utils/highlighter-browser'
import type {
  Highlighter,
  InitHighlighterOptions,
} from './utils/highlighter-browser'

export {
  terminalLink,
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
  ensureLanguage,
}
export type { Highlighter, InitHighlighterOptions }

export const getTerminalWidth = (): number => 80
