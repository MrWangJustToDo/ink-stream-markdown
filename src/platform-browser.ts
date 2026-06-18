import terminalLink from './utils/terminal-link-browser'
import { highlightCode, initHighlighter, clearHighlightCache } from './utils/highlighter-browser'

export { terminalLink, highlightCode, initHighlighter, clearHighlightCache }

export const getTerminalWidth = (): number => 80
