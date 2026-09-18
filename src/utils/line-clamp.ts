import chalk from 'chalk'
import wrapAnsi from 'wrap-ansi'

/** Renders the fold indicator line shown when content exceeds `height`. */
export type FoldIndicator = (folded: number, streaming: boolean) => string

export interface ClampToHeightOptions {
  /** Maximum number of visible lines. */
  height: number
  /** Terminal width used to simulate Ink's wrapping. */
  width: number
  /**
   * When true the latest lines are kept (tail-anchored, indicator on top);
   * otherwise the first lines are kept (indicator at the bottom).
   */
  streaming: boolean
  /** Custom fold indicator renderer. Defaults to a dim arrow + count. */
  foldIndicator?: FoldIndicator
}

const defaultFoldIndicator: FoldIndicator = (folded, streaming) =>
  chalk.dim(`${streaming ? '↓' : '↑'} ${folded} lines folded`)

/**
 * Clamp a rendered ANSI string to a maximum number of visible lines.
 *
 * Mimics Ink's `<Text wrap="wrap">` exactly: Ink wraps with
 * `wrapAnsi(text, maxWidth, { trim: false, hard: true })`
 * (see ink/build/wrap-text.js), so splitting with the same call yields the
 * precise line count Ink will display. Each produced line is at most `width`
 * columns and ANSI-safe, so Ink renders the returned string without re-wrapping
 * and no color bleeds across the fold boundary.
 *
 * When content fits within `height` the input is returned unchanged.
 */
export const clampToHeight = (
  text: string,
  options: ClampToHeightOptions,
): string => {
  const { height, width, streaming } = options
  if (!text || height <= 0) return text

  const lines = wrapAnsi(text, width, { trim: false, hard: true }).split('\n')
  if (lines.length <= height) return text

  const keep = height - 1
  const folded = lines.length - keep
  const indicator = (options.foldIndicator ?? defaultFoldIndicator)(
    folded,
    streaming,
  )

  if (streaming) {
    return [indicator, ...lines.slice(-keep)].join('\n')
  }
  return [...lines.slice(0, keep), indicator].join('\n')
}
