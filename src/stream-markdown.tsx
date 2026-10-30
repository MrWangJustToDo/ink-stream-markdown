import { type FC, useEffect, useId, useMemo, useReducer } from 'react'
import { Text } from 'ink'
import { getMarkdown } from 'stream-markdown-parser'

import { parseMarkdown } from './parse'
import { renderNodesToStringCached, type RenderCache } from './render'
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
 * Deep value comparison for theme objects; non-plain values (style functions,
 * renderer callbacks) compare by identity.
 */
const isSameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((value, index) => isSameValue(value, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      isSameValue(left[key], right[key]),
  )
}

/**
 * Theme comparison (nested options included).
 *
 * Callers commonly build `theme` inline (`{...baseTheme, width}`), so identity
 * changes every render even when the resolved styles do not. Comparing values
 * lets the block cache survive those re-renders.
 */
const isSameTheme = (a?: ThemeOptions, b?: ThemeOptions): boolean =>
  isSameValue(a, b)

interface BlockCache {
  theme?: ThemeOptions
  width: number
  version: number
  cache: RenderCache
}

/**
 * One block cache per mounted component, keyed by `useId`.
 *
 * Module state rather than a ref/memo value because the cache is read and
 * mutated while rendering, which the react-hooks lint rules reject for values
 * owned by a hook. Losing an entry only costs one full re-render.
 */
const blockCaches = new Map<string, BlockCache>()

const getBlockCache = (id: string): BlockCache => {
  let entry = blockCaches.get(id)
  if (!entry) {
    entry = {
      theme: undefined,
      width: -1,
      version: -1,
      cache: { keys: [], values: [] },
    }
    blockCaches.set(id, entry)
  }
  return entry
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

  const cacheId = useId()

  useEffect(
    () => () => {
      blockCaches.delete(cacheId)
    },
    [cacheId],
  )

  const rendered = useMemo(() => {
    // Recompute after lazily loaded grammars become available.
    void highlightVersion

    // Anything that changes the output without changing a node invalidates the
    // block cache: resolved styles, the effective width, or the grammars that
    // happened to be loaded when a block was rendered.
    const width = mergedTheme?.width ?? getTerminalWidth()
    const entry = getBlockCache(cacheId)
    if (
      entry.version !== highlightVersion ||
      entry.width !== width ||
      !isSameTheme(entry.theme, mergedTheme)
    ) {
      entry.cache.keys.length = 0
      entry.cache.values.length = 0
      entry.theme = mergedTheme
      entry.width = width
      entry.version = highlightVersion
    }

    const full = renderNodesToStringCached(nodes, mergedTheme, entry.cache)
    if (!height || height <= 0) return full
    return clampToHeight(full, {
      height,
      width: getTerminalWidth(),
      streaming: streamState.streaming,
      foldIndicator,
    })
  }, [
    nodes,
    mergedTheme,
    height,
    streamState,
    foldIndicator,
    highlightVersion,
    cacheId,
  ])

  return <Text>{rendered}</Text>
}
