import { type FC, useEffect, useMemo, useReducer } from 'react'
import { Text } from 'ink'
import { getMarkdown } from 'stream-markdown-parser'

import { parseMarkdown } from './parse'
import { renderNodesToString } from './render'
import { ensureLanguage, getTerminalWidth } from './platform'
import { clampToHeight, type FoldIndicator } from './utils/line-clamp'
import type { ThemeOptions, HighlightOptions } from './theme'
import type {
  GetMarkdownOptions,
  ParseOptions,
  ParsedNode,
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
  /**
   * Custom code highlighting pipeline.
   * Provide a `highlightCode(code, lang)` function that returns a styled string.
   */
  highlight?: HighlightOptions
  /**
   * Maximum number of visible lines. When the rendered content exceeds this
   * height, the overflow is folded and a fold indicator line is shown.
   * Defaults to unlimited.
   */
  height?: number
  /**
   * Whether the content is still streaming in. This single flag drives both the
   * visible window and the parser:
   *
   * - While `true`, the parser runs in incremental stream mode (`final: false`,
   *   re-parsing only the appended tail) and the visible window is tail-anchored
   *   with the fold indicator on top.
   * - When set to `false` (or omitted), the parser performs a final one-shot
   *   parse (resetting its stream cache) and content renders from the start
   *   with the fold indicator at the bottom.
   *
   * An explicit `final` in `parseOptions` takes precedence over this flag.
   */
  streaming?: boolean
  /**
   * Custom renderer for the fold indicator line. Receives the number of folded
   * lines and the current streaming state; return the full (styled) line text.
   * Defaults to a dim "↓/↑ N lines folded".
   */
  foldIndicator?: FoldIndicator
}

/** Collect the language tags of every code block, including nested ones. */
const collectCodeLanguages = (nodes: ParsedNode[]): string[] => {
  const languages = new Set<string>()
  const walk = (list: ParsedNode[]) => {
    for (const node of list) {
      const n = node as {
        type?: string
        language?: string
        children?: ParsedNode[]
      }
      if (n.type === 'code_block' && n.language) languages.add(n.language)
      if (Array.isArray(n.children)) walk(n.children)
    }
  }
  walk(nodes)
  return [...languages]
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
  highlight,
  height,
  streaming = false,
  foldIndicator,
}) => {
  const instance = useMemo(
    () => getMarkdown(undefined, parserOptions),
    [parserOptions],
  )

  // Pre-compute the unified streaming state — a single source of truth that
  // both consumers derive from instead of reading the raw props:
  //   - `parseOptions` fixes `final`: while streaming it stays incremental
  //     (`final: false` keeps the parser's stream cache so only the appended
  //     tail is re-parsed); once complete `final: true` does a one-shot parse
  //     and resets the cache. An explicit user `final` wins.
  //   - `streaming` keeps the fold window in sync with the parser.
  const streamState = useMemo(
    (): { streaming: boolean; parseOptions: ParseOptions } => {
      const final = parseOptions?.final ?? !streaming
      return { streaming, parseOptions: { ...parseOptions, final } }
    },
    [parseOptions, streaming],
  )

  const nodes = useMemo(
    () =>
      parseMarkdown(children || '', instance, streamState.parseOptions),
    [children, instance, streamState],
  )

  // Lazily load grammars for code blocks that are not preloaded, then bump a
  // version to re-render so their highlighting appears on the next pass.
  const [highlightVersion, bumpHighlight] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const languages = collectCodeLanguages(nodes)
    if (languages.length === 0) return

    let cancelled = false
    Promise.all(languages.map((lang) => ensureLanguage(lang)))
      .then((loaded) => {
        if (!cancelled && loaded.some(Boolean)) bumpHighlight()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [nodes])

  const mergedTheme = useMemo(() => {
    if (!highlight) return theme
    return {
      ...theme,
      highlight: { ...theme?.highlight, ...highlight },
    } as ThemeOptions
  }, [theme, highlight])

  const rendered = useMemo(() => {
    // Recompute after lazily loaded grammars become available.
    void highlightVersion
    const full = renderNodesToString(nodes, mergedTheme)
    if (!height || height <= 0) return full
    return clampToHeight(full, {
      height,
      width: getTerminalWidth(),
      streaming: streamState.streaming,
      foldIndicator,
    })
  }, [nodes, mergedTheme, height, streamState, foldIndicator, highlightVersion])

  return <Text>{rendered}</Text>
}
