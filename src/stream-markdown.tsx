import { type FC, useMemo } from 'react'
import { Text } from 'ink'
import { getMarkdown } from 'stream-markdown-parser'

import { parseMarkdownWithHighlight } from './parse-with-highlight'
import { renderNodesToString } from './render'
import type { ThemeOptions } from './theme'
import type {
  GetMarkdownOptions,
  ParseOptions,
} from 'stream-markdown-parser'

export interface StreamMarkdownProps {
  children: string
  /** Custom theme overrides — see `ThemeOptions` for available keys. */
  theme?: ThemeOptions
  /**
   * Parser instance options passed to `getMarkdown()`.
   * Controls markdown-it behaviour: plugins, math, containers, custom HTML tags, etc.
   */
  parserOptions?: GetMarkdownOptions
  /**
   * Per-parse options passed to `parseMarkdownToStructure()`.
   * Controls token transforms, custom HTML tags, link validation, etc.
   */
  parseOptions?: ParseOptions
}

/**
 * Markdown component with source-side syntax highlighting.
 *
 * This component parses markdown and pre-highlights code blocks at parse time,
 * which improves rendering performance by avoiding per-frame highlighting.
 *
 * Uses a string-based renderer with chalk for full control over terminal output,
 * avoiding Ink's layout wrapping behaviors that can cause alignment issues.
 *
 * For streaming content (code blocks with `loading: true`), the component
 * falls back to streaming highlighting to provide real-time feedback.
 */
export const StreamMarkdown: FC<StreamMarkdownProps> = ({
  children,
  theme,
  parserOptions,
  parseOptions,
}) => {
  const instance = useMemo(
    () => getMarkdown(undefined, parserOptions),
    [parserOptions],
  )

  const nodes = useMemo(
    () => parseMarkdownWithHighlight(children || '', instance, parseOptions),
    [children, instance, parseOptions],
  )

  const rendered = useMemo(
    () => renderNodesToString(nodes, theme),
    [nodes, theme],
  )

  return <Text>{rendered}</Text>
}
