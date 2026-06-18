const ESC = '\u001B'
const OSC = `${ESC}]`
const BEL = '\u0007'

/**
 * Browser-compatible terminal link using OSC 8 escape sequences.
 * Works with xterm.js (used by ink-web).
 */
export default function terminalLink(text: string, url: string): string {
  return `${OSC}8;;${url}${BEL}${text}${OSC}8;;${BEL}`
}
