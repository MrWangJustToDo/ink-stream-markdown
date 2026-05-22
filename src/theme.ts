import chalk from 'chalk'

import type { ParsedNode } from 'stream-markdown-parser'

/** A chalk-compatible style function: takes a string, returns a styled string. */
export type ChalkStyle = (text: string) => string

/** Rendering context threaded through all render functions */
export interface RenderContext {
  /** Current list nesting depth (0 = top level) */
  listDepth: number
  /** Resolved theme colors/styles */
  theme: ResolvedTheme
}

/**
 * A render function for a single node type.
 *
 * @param node - The parsed markdown node
 * @param ctx - Rendering context (theme, nesting depth, etc.)
 * @param renderChildren - Helper to render child nodes; avoids needing to import internals
 */
export type NodeRenderer<T = ParsedNode> = (
  node: T,
  ctx: RenderContext,
  renderChildren: (children: ParsedNode[], ctx: RenderContext) => string,
) => string

/**
 * Map of node type to custom render function.
 * Any key left unset falls back to the built-in default renderer.
 */
export interface Renderers {
  text?: NodeRenderer
  heading?: NodeRenderer
  paragraph?: NodeRenderer
  code_block?: NodeRenderer
  inline_code?: NodeRenderer
  list?: NodeRenderer
  list_item?: NodeRenderer
  blockquote?: NodeRenderer
  link?: NodeRenderer
  image?: NodeRenderer
  table?: NodeRenderer
  table_row?: NodeRenderer
  table_cell?: NodeRenderer
  thematic_break?: NodeRenderer
  strong?: NodeRenderer
  emphasis?: NodeRenderer
  strikethrough?: NodeRenderer
  hardbreak?: NodeRenderer
  checkbox?: NodeRenderer
  checkbox_input?: NodeRenderer
  highlight?: NodeRenderer
  insert?: NodeRenderer
  subscript?: NodeRenderer
  superscript?: NodeRenderer
  emoji?: NodeRenderer
  admonition?: NodeRenderer
  math_inline?: NodeRenderer
  math_block?: NodeRenderer
  html_block?: NodeRenderer
  html_inline?: NodeRenderer
  definition_list?: NodeRenderer
  definition_item?: NodeRenderer
  footnote?: NodeRenderer
  footnote_reference?: NodeRenderer
  footnote_anchor?: NodeRenderer
  vmr_container?: NodeRenderer
  reference?: NodeRenderer
  inline?: NodeRenderer
  custom_component?: NodeRenderer
  [key: string]: NodeRenderer | undefined
}

/**
 * Options to customize the code highlighting pipeline.
 *
 * Provide a single `highlightCode` callback that takes source code and a
 * language identifier and returns a fully styled string. The default
 * implementation uses Shiki for tokenization and chalk for coloring.
 */
export interface HighlightOptions {
  /**
   * Replace the entire code-to-styled-string pipeline.
   * Default: built-in Shiki tokenize + chalk render.
   *
   * Return a terminal-styled string (e.g. using chalk, ansi-colors, etc.).
   * If the language is unsupported, return the plain code string.
   */
  highlightCode?: (code: string, lang: string) => string
}

/**
 * User-facing theme options. Every key is optional — unset keys fall back
 * to the built-in defaults.
 *
 * Follows the same pattern as marked-terminal's `defaultOptions`:
 * each value is a `(text: string) => string` chalk style function.
 */
export interface ThemeOptions {
  /** Plain text */
  text?: ChalkStyle
  /** Headings (h2–h6) */
  heading?: ChalkStyle
  /** First-level heading (h1) — uses a distinct style by default */
  firstHeading?: ChalkStyle
  /** Link text wrapper */
  link?: ChalkStyle
  /** Link href / URL */
  href?: ChalkStyle
  /** Bold / strong text */
  strong?: ChalkStyle
  /** Italic / emphasis text */
  em?: ChalkStyle
  /** Strikethrough / deleted text */
  del?: ChalkStyle
  /** Inline code spans */
  code?: ChalkStyle
  /** Code block text (fallback when shiki tokens are unavailable) */
  codeBlock?: ChalkStyle
  /** Blockquote text */
  blockquote?: ChalkStyle
  /** List item text */
  listItem?: ChalkStyle
  /** Horizontal rule */
  hr?: ChalkStyle
  /** Raw HTML blocks */
  html?: ChalkStyle
  /** Table wrapper */
  table?: ChalkStyle

  /* Semantic / utility colors */
  /** Muted / secondary text (prefixes, labels, etc.) */
  muted?: ChalkStyle
  /** Borders (code block left bar, blockquote bar) */
  border?: ChalkStyle
  /** Success indicators (checked checkboxes, tip admonitions) */
  success?: ChalkStyle
  /** Warning indicators */
  warning?: ChalkStyle
  /** Error indicators */
  error?: ChalkStyle
  /** Informational indicators (links, footnote refs, note admonitions) */
  info?: ChalkStyle
  /** Purple accents (math, important admonitions) */
  purple?: ChalkStyle

  /** Marked text (==marked== / `<mark>`) */
  mark?: ChalkStyle

  /** Terminal width override (defaults to `process.stdout.columns` or 80) */
  width?: number
  /** cli-table3 options passthrough */
  tableOptions?: Record<string, unknown>

  /** Custom node renderers — override rendering for specific node types */
  renderers?: Renderers

  /** Custom code highlighting pipeline — override tokenization and/or token rendering */
  highlight?: HighlightOptions
}

/**
 * Fully resolved theme — all keys are guaranteed present.
 * Produced by `resolveTheme()`.
 */
export type ResolvedTheme = Required<ThemeOptions>

const identity: ChalkStyle = (text) => text

/**
 * GitHub-flavored dark theme.
 *
 * Mirrors the color palette from github.com's dark mode markdown rendering.
 * Inline code uses a cyan tint instead of a background color so it stays
 * readable across different terminal emulators and background colors.
 */
export const defaultTheme: ResolvedTheme = {
  text: chalk.hex('#e6edf3'),
  heading: chalk.hex('#e6edf3').bold,
  firstHeading: chalk.hex('#e6edf3').bold.underline,
  link: chalk.hex('#58a6ff'),
  href: chalk.hex('#58a6ff').underline,
  strong: chalk.bold,
  em: chalk.italic,
  del: chalk.dim.strikethrough,
  code: chalk.hex('#a7b5e6'),
  codeBlock: chalk.hex('#79c0ff'),
  blockquote: chalk.hex('#8b949e').italic,
  listItem: identity,
  hr: chalk.hex('#30363d'),
  html: chalk.hex('#8b949e'),
  table: identity,

  muted: chalk.hex('#8b949e'),
  border: chalk.hex('#30363d'),
  success: chalk.hex('#3fb950'),
  warning: chalk.hex('#d29922'),
  error: chalk.hex('#f85149'),
  info: chalk.hex('#58a6ff'),
  purple: chalk.hex('#a371f7'),

  mark: chalk.bgHex('#bb800926').hex('#e6edf3'),

  width: 0,
  tableOptions: {},
  renderers: {},
  highlight: {},
}

/**
 * Merge user-supplied theme overrides with the built-in defaults.
 *
 * ```ts
 * const theme = resolveTheme({ code: chalk.cyan, heading: chalk.red.bold })
 * ```
 */
export const resolveTheme = (options?: ThemeOptions): ResolvedTheme => {
  if (!options) return defaultTheme
  return { ...defaultTheme, ...options }
}
