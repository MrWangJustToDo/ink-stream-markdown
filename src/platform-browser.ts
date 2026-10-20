import terminalLink from './utils/terminal-link-browser'
import {
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
} from './utils/highlighter-browser'
import type { Highlighter } from './utils/highlighter-browser'

export {
  terminalLink,
  highlightCode,
  initHighlighter,
  clearHighlightCache,
  getHighlighter,
}
export type { Highlighter }

export const getTerminalWidth = (): number => 80
