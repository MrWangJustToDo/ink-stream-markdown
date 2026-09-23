import chalk from 'chalk'
import stripAnsi from 'strip-ansi'
import stringWidth from 'string-width'
import { renderMermaidASCII } from 'beautiful-mermaid'
import unicodeit from 'unicodeit'

import { terminalLink, highlightCode, getTerminalWidth } from './platform'
import {
  renderTableString,
  calculateColumnWidths,
  DEFAULT_CELL_PADDING,
} from './utils/table'
import type { CellAlign } from './utils/table'
import { defaultTheme, resolveTheme } from './theme'
import type { RenderContext, NodeRenderer, ThemeOptions } from './theme'
import type { ThemedToken } from 'shiki'
import type {
  ParsedNode,
  CodeBlockNode,
  TextNode,
  HeadingNode,
  ParagraphNode,
  InlineCodeNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
  LinkNode,
  ImageNode,
  TableNode,
  StrongNode,
  EmphasisNode,
  StrikethroughNode,
  CheckboxNode,
  CheckboxInputNode,
  HighlightNode,
  InsertNode,
  SubscriptNode,
  SuperscriptNode,
  EmojiNode,
  AdmonitionNode,
  MathInlineNode,
  MathBlockNode,
  HtmlBlockNode,
  HtmlInlineNode,
  DefinitionListNode,
  DefinitionItemNode,
  FootnoteNode,
  FootnoteReferenceNode,
  VmrContainerNode,
  ReferenceNode,
  InlineNode,
  TableRowNode,
  TableCellNode,
  CustomComponentNode,
  UnknownNode,
} from 'stream-markdown-parser'

const createContext = (theme: typeof defaultTheme): RenderContext => ({
  listDepth: 0,
  prefix: '',
  theme,
})

/** Display width reserved by the current line prefix (list indent + marker). */
const prefixWidth = (ctx: RenderContext): number =>
  // `prefix` only ever holds spaces, so its width is its length — cheaper than
  // running grapheme segmentation over it.
  ctx.prefix.length

/* Render a single node — checks for custom renderer first, then falls back to defaults */
const renderNode = (node: ParsedNode, ctx: RenderContext): string => {
  const custom = ctx.theme.renderers[node.type]
  if (custom) {
    return custom(node, ctx, renderChildren)
  }

  const builtin = defaultRenderers[node.type]
  if (builtin) {
    return builtin(node, ctx, renderChildren)
  }

  return defaultRenderers._unknown!(node, ctx, renderChildren)
}

/* Render children nodes */
const renderChildren = (children: ParsedNode[], ctx: RenderContext): string => {
  return children.map((node) => renderNode(node, ctx)).join('')
}

/* ─── Individual render functions ───────────────────────────────────── */

/**
 * Default token-to-string renderer: applies chalk.hex per token color.
 * Used internally by the default highlight pipeline.
 */
const defaultRenderTokens = (
  tokens: ThemedToken[][],
  ctx: RenderContext,
): string => {
  return tokens
    .map((line) => {
      return line
        .map((token) => {
          if (token.color) {
            return chalk.hex(token.color)(token.content)
          }
          return ctx.theme.codeBlock(token.content)
        })
        .join('')
    })
    .join('\n')
}

/**
 * Default highlight pipeline: Shiki tokenize + chalk render.
 * Exported so users can compose custom logic on top:
 *
 * ```ts
 * highlight={{ highlightCode: (code, lang) => '>>>\n' + defaultHighlightCode(code, lang) + '\n<<<' }}
 * ```
 */
export const defaultHighlightCode = (
  code: string,
  lang: string,
  _ctx?: RenderContext,
): string => {
  const ctx = _ctx || createContext(defaultTheme)
  if (lang === 'mermaid') {
    const mermaidOpt = ctx.theme.highlight?.renderMermaid
    if (mermaidOpt === false) {
      return ctx.theme.codeBlock(code)
    }
    if (typeof mermaidOpt === 'function') {
      return mermaidOpt(code)
    }
    try {
      const ascii = renderMermaidASCII(code, ctx.theme.mermaidASCII || {})
      const maxWidth =
        (ctx.theme.width || getTerminalWidth()) - prefixWidth(ctx)
      const tooWide = ascii
        .split('\n')
        .some((line) => stripAnsi(line).length > maxWidth)
      if (!tooWide) return ascii
    } catch {
      // unsupported diagram type — fall through to code block
    }
    return ctx.theme.codeBlock(code)
  }
  const tokens = highlightCode(code, lang)
  if (tokens.length === 0) return ctx.theme.codeBlock(code)
  return defaultRenderTokens(tokens, ctx)
}

const renderText: NodeRenderer = (node, ctx) => {
  return ctx.theme.text((node as TextNode).content)
}

const renderHeading: NodeRenderer = (node, ctx, rc) => {
  const n = node as HeadingNode
  const text = rc(n.children, ctx)
  const prefix = ctx.theme.muted('#'.repeat(n.level) + ' ')
  const style = n.level === 1 ? ctx.theme.firstHeading : ctx.theme.heading
  return prefix + style(text)
}

const renderParagraph: NodeRenderer = (node, ctx, rc) => {
  return rc((node as ParagraphNode).children, ctx)
}

const renderCodeBlock: NodeRenderer = (node, ctx) => {
  const n = node as CodeBlockNode
  const customHighlight = ctx.theme.highlight?.highlightCode

  let code: string
  if (customHighlight && n.language) {
    code = customHighlight(n.code, n.language)
  } else if (n.language && n.language.trim()) {
    code = defaultHighlightCode(n.code, n.language, ctx)
  } else {
    code = ctx.theme.codeBlock(n.code)
  }

  // Clean up trailing newlines and whitespace
  code = code.replace(/\n+$/, '')
  // Remove closing fence if it appears at the end (can happen during streaming)
  code = code.replace(/\n?`{3,}\s*$/, '')

  // Add loading indicator for streaming content
  const loadingIndicator = n.loading ? ctx.theme.muted('...') : ''

  // Add left border to each line
  // const leftBar = ctx.theme.border('\u2502 ')
  // const lines = code
  //   .split('\n')
  //   .map((line) => leftBar + line)
  //   .join('\n')
  const lines = code

  // Language label on first line if present
  // const langLabel = n.language ? ctx.theme.muted(n.language) + '\n' : ''
  const langLabel = ''

  return '\n' + langLabel + lines + loadingIndicator + '\n'
}

const renderInlineCode: NodeRenderer = (node, ctx) => {
  return ctx.theme.code((node as InlineCodeNode).code)
}

/**
 * Blank line (or whitespace/ANSI only). The escaped-character check keeps the
 * hot path free of any stripping work for the blank separators `joinBlocks` and
 * the nested-list padding insert.
 */
const isBlank = (line: string): boolean =>
  line.trim() === '' ||
  (line.includes('\u001b') && stripAnsi(line).trim() === '')

/**
 * Prefix the lines of a rendered block with the item marker: the marker on the
 * first line, an equally wide blank run on the rest (hanging indent), so
 * multi-line blocks (tables, code blocks, nested lists) stay aligned under the
 * item text. Blank lines are left untouched to avoid trailing whitespace.
 *
 * Only the current marker is added — inherited indentation is applied by the
 * enclosing levels (their hanging indent equals their marker width), which
 * keeps `ctx.prefix` in sync with the indentation actually prepended by text.
 */
const indentLines = (
  content: string,
  marker: string,
  markerWidth: number,
): string => {
  const breakAt = content.indexOf('\n')
  // Single-line item (the common case): no splitting/joining needed
  if (breakAt === -1) return marker + content

  const hang = ' '.repeat(markerWidth)
  const head = content.slice(0, breakAt)
  const rest = content.slice(breakAt + 1).split('\n')
  return [
    marker + head,
    ...rest.map((line) => (isBlank(line) ? '' : hang + line)),
  ].join('\n')
}

const renderList: NodeRenderer = (node, ctx, _rc) => {
  const n = node as ListNode
  const nested = { ...ctx, listDepth: ctx.listDepth + 1 }

  const items = n.items
    .map((item, index) => {
      const markerText = n.ordered ? `${(n.start ?? 1) + index}. ` : '\u2022 '
      // The marker is a single-width bullet or ASCII digits plus '. ', so its
      // display width is its length — no need to measure it per item.
      const markerWidth = markerText.length
      // Item children are laid out next to the marker, so they carry the
      // marker width as their indentation — visible to them via `prefix`.
      const content = renderNode(item, {
        ...nested,
        prefix: ctx.prefix + ' '.repeat(markerWidth),
      })
      return indentLines(content, ctx.theme.muted(markerText), markerWidth)
    })
    .join('\n')

  return ctx.listDepth === 0 ? items : '\n\n' + items + '\n\n'
}

/**
 * Prepend `prefix` to every line of a block; blank lines get `blankLine` (the
 * bare quote/admonition bar) so the container stays visually continuous.
 *
 * Each nesting level adds only its own prefix: the indentation of enclosing
 * levels is applied by them (see `indentLines`), which keeps `ctx.prefix` in
 * sync with the indentation actually prepended to the text.
 */
const prefixLines = (content: string, prefix: string, blankLine = ''): string =>
  content
    .split('\n')
    .map((line) => (isBlank(line) ? blankLine : prefix + line))
    .join('\n')

/**
 * Render the block children of a container, separated so that two blocks never
 * end up glued on one line (see `joinBlocks`).
 */
const renderBlockChildren = (
  children: ParsedNode[],
  ctx: RenderContext,
  rc: (children: ParsedNode[], ctx: RenderContext) => string,
): string => joinBlocks(children.map((child) => rc([child], ctx)))

/**
 * Concatenate the block children of a container: every pair of blocks is
 * separated by a blank line, and the padding the blocks add themselves is
 * trimmed (`renderCodeBlock` and nested lists carry their own; a bare paragraph
 * or table does not) — so container spacing matches the top-level `\n\n` join.
 */
const joinBlocks = (parts: string[]): string =>
  parts
    .filter((part) => part !== '')
    .reduce(
      (acc, part) =>
        acc === ''
          ? part
          : acc.replace(/\n+$/, '') + '\n\n' + part.replace(/^\n+/, ''),
      '',
    )

const renderListItem: NodeRenderer = (node, ctx, _rc) => {
  const n = node as ListItemNode
  const parts = n.children.map((child) => renderNode(child, ctx))

  return ctx.theme.listItem(joinBlocks(parts).replace(/\n$/, ''))
}

const renderBlockquote: NodeRenderer = (node, ctx, rc) => {
  // Reserve the "│ " prefix for the children so fixed-width content (tables,
  // hr, mermaid) is laid out inside the quote instead of overflowing it.
  const inner = renderBlockChildren(
    (node as BlockquoteNode).children,
    { ...ctx, prefix: ctx.prefix + '  ' },
    rc,
  )

  return prefixLines(
    ctx.theme.blockquote(inner),
    ctx.theme.border('\u2502 '),
    ctx.theme.border('\u2502'),
  )
}

const renderLink: NodeRenderer = (node, ctx) => {
  const n = node as LinkNode
  const text = n.text || n.href
  return ctx.theme.link(terminalLink(ctx.theme.href(text), n.href))
}

const renderImage: NodeRenderer = (node, ctx) => {
  return ctx.theme.muted(`[Image: ${(node as ImageNode).alt || 'image'}]`)
}

/** GFM delimiter cell for a column alignment. */
const ALIGN_MARKERS: Record<CellAlign, string> = {
  left: ':---',
  center: ':---:',
  right: '---:',
}

/**
 * Rebuild the markdown source of a table from its parsed cells.
 *
 * `TableCellNode.raw` holds the original source text (inline markup included),
 * so the result stays valid GFM — used when the table cannot be laid out within
 * the available width.
 */
const rawTableMarkdown = (n: TableNode): string => {
  // A literal `|` inside a cell has to stay escaped to keep the row parseable
  const cell = (c: TableCellNode): string =>
    (c.raw ?? '').trim().replace(/(^|[^\\])\|/g, '$1\\|')
  const row = (cells: TableCellNode[]): string =>
    `| ${cells.map(cell).join(' | ')} |`
  const delimiter = `| ${n.header.cells
    .map((c) => ALIGN_MARKERS[(c.align ?? 'left') as CellAlign])
    .join(' | ')} |`

  return [
    row(n.header.cells),
    delimiter,
    ...n.rows.map((r) => row(r.cells)),
  ].join('\n')
}

const renderTable: NodeRenderer = (node, ctx, rc) => {
  const n = node as TableNode
  const numCols = n.header.cells.length
  if (numCols === 0) return ''

  const termWidth = (ctx.theme.width || getTerminalWidth()) - prefixWidth(ctx)

  const tableOpts = ctx.theme.tableOptions
  const minColWidth = tableOpts.minColumnWidth
  // Column borders + cell padding on both sides of every column
  const borderOverhead =
    numCols + 1 + numCols * (tableOpts.cellPadding ?? DEFAULT_CELL_PADDING) * 2

  const headers = n.header.cells.map((cell) =>
    ctx.theme.heading(rc(cell.children, ctx)).toString(),
  )
  const rows = n.rows.map((row) => {
    const cells = row.cells.map((cell) => rc(cell.children, ctx))
    while (cells.length < numCols) cells.push('')
    return cells.slice(0, numCols)
  })
  const aligns: CellAlign[] = n.header.cells.map(
    (cell) => (cell as TableCellNode).align ?? 'left',
  )

  const { widths, needsHardWrap } = calculateColumnWidths(
    headers,
    rows,
    termWidth - borderOverhead,
    minColWidth,
  )

  const table = renderTableString(
    headers,
    rows,
    widths,
    aligns,
    ctx.theme.border,
    needsHardWrap,
    tableOpts,
  )

  // A box wider than the available width is worse than no box at all: Ink wraps
  // the line and shatters the borders. The computed widths are exact — a cell is
  // hard-wrapped when it does not fit — with one exception: a column squeezed to
  // a single character cannot hold a wide glyph (CJK/emoji take two columns), so
  // only then is it worth measuring the rendered lines.
  const tableWidth = widths.reduce((sum, w) => sum + w, 0) + borderOverhead
  const overflows =
    tableWidth > termWidth ||
    (widths.includes(1) &&
      table.split('\n').some((line) => stringWidth(line) > termWidth))

  if (overflows) {
    // Styled separately from the box: `tableFallback` defaults to no styling, so
    // the source can be marked (dim, muted, …) as a degraded rendering.
    return ctx.theme.tableFallback('\n' + rawTableMarkdown(n))
  }

  return ctx.theme.table(
    // Leading newline like `renderCodeBlock`: a table never shares a line with
    // the preceding block (or with an item marker when it opens a list item).
    '\n' + table,
  )
}

const renderTableRow: NodeRenderer = (node, ctx, rc) => {
  return (node as TableRowNode).cells
    .map((cell) => rc(cell.children, ctx))
    .join(' | ')
}

const renderTableCell: NodeRenderer = (node, ctx, rc) => {
  return rc((node as TableCellNode).children, ctx)
}

const renderThematicBreak: NodeRenderer = (_node, ctx) => {
  const width = (ctx.theme.width || getTerminalWidth()) - prefixWidth(ctx)
  return ctx.theme.hr('\u2500'.repeat(Math.max(Math.min(width, 40), 1)))
}

const renderStrong: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.strong(rc((node as StrongNode).children, ctx))
}

const renderEmphasis: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.em(rc((node as EmphasisNode).children, ctx))
}

const renderStrikethrough: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.del(rc((node as StrikethroughNode).children, ctx))
}

const renderHardBreak: NodeRenderer = () => {
  return '\n'
}

const renderCheckbox: NodeRenderer = (node, ctx) => {
  return (node as CheckboxNode | CheckboxInputNode).checked
    ? ctx.theme.success('[x] ')
    : ctx.theme.muted('[ ] ')
}

const renderHighlight: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.mark(rc((node as HighlightNode).children, ctx))
}

const renderInsert: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.em(rc((node as InsertNode).children, ctx))
}

const renderSubscript: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.muted(rc((node as SubscriptNode).children, ctx))
}

const renderSuperscript: NodeRenderer = (node, ctx, rc) => {
  return ctx.theme.muted(rc((node as SuperscriptNode).children, ctx))
}

const renderEmoji: NodeRenderer = (node) => {
  return (node as EmojiNode).markup
}

const renderAdmonition: NodeRenderer = (node, ctx, rc) => {
  const n = node as AdmonitionNode
  const kindColors: Record<string, (typeof ctx.theme)['info']> = {
    note: ctx.theme.info,
    tip: ctx.theme.success,
    important: ctx.theme.purple,
    warning: ctx.theme.warning,
    caution: ctx.theme.warning,
    danger: ctx.theme.error,
    error: ctx.theme.error,
  }

  const icons: Record<string, string> = {
    note: '\u2139',
    tip: '\uD83D\uDCA1',
    important: '\u2757',
    warning: '\u26A0',
    caution: '\u26A0',
    danger: '\uD83D\uDD34',
    error: '\uD83D\uDD34',
  }

  const color = kindColors[n.kind.toLowerCase()] || ctx.theme.muted
  const icon = icons[n.kind.toLowerCase()] || '\uD83D\uDCDD'
  const title = n.title || n.kind.charAt(0).toUpperCase() + n.kind.slice(1)
  // Same treatment as blockquotes: reserve the "│ " prefix for the children and
  // prefix every body line, so multi-line bodies stay inside the bar.
  const content = renderBlockChildren(
    n.children,
    { ...ctx, prefix: ctx.prefix + '  ' },
    rc,
  )

  return (
    color(`${icon} ${title}`) +
    '\n' +
    prefixLines(content, color('\u2502 '), color('\u2502'))
  )
}

const renderMathInline: NodeRenderer = (node, ctx) => {
  const raw = (node as MathInlineNode).content
  return ctx.theme.purple(unicodeit.replace(raw))
}

const renderMathBlock: NodeRenderer = (node, ctx) => {
  const raw = (node as MathBlockNode).content
  const converted = raw
    .split('\n')
    .map((line) => unicodeit.replace(line))
    .join('\n')
  return ctx.theme.purple(converted)
}

/**
 * Inert single-line inline HTML, e.g. `<code>x</code>`: the parser emits this as
 * `html_block` (without children) inside table cells, and printing the tag
 * verbatim would leak the markup into the table.
 *
 * Only attribute-less wrapper tags around plain text are unwrapped — anything
 * that carries information (attributes, nested tags, multi-line blocks) is left
 * as the source text.
 */
const INERT_INLINE_TAG = /^<([a-z][a-z0-9]*)\s*>([^<]*)<\/\1\s*>$/i
const VOID_INLINE_TAG = /^<(br|hr)\s*\/?>$/i

const unwrapInertInlineTag = (content: string): string | undefined => {
  const trimmed = content.trim()
  if (trimmed.includes('\n')) return undefined
  const voidTag = VOID_INLINE_TAG.exec(trimmed)
  if (voidTag) return voidTag[1]!.toLowerCase() === 'br' ? '\n' : ''
  return INERT_INLINE_TAG.exec(trimmed)?.[2]
}

const renderHtmlBlock: NodeRenderer = (node, ctx) => {
  const content = (node as HtmlBlockNode).content
  return ctx.theme.html(unwrapInertInlineTag(content) ?? content)
}

const renderHtmlInline: NodeRenderer = (node, ctx, rc) => {
  const n = node as HtmlInlineNode
  if (n.children && n.children.length > 0) {
    return rc(n.children, ctx)
  }
  return ctx.theme.html(unwrapInertInlineTag(n.content) ?? n.content)
}

const renderDefinitionList: NodeRenderer = (node, ctx, rc) => {
  return (node as DefinitionListNode).items
    .map((item: DefinitionItemNode) => {
      const term = ctx.theme.heading(rc(item.term, ctx))
      const definition = '  ' + rc(item.definition, ctx)
      return term + '\n' + definition
    })
    .join('\n')
}

const renderDefinitionItem: NodeRenderer = (node, ctx, rc) => {
  const n = node as DefinitionItemNode
  const term = ctx.theme.heading(rc(n.term, ctx))
  const definition = '  ' + rc(n.definition, ctx)
  return term + '\n' + definition
}

const renderFootnote: NodeRenderer = (node, ctx, rc) => {
  const n = node as FootnoteNode
  const label = ctx.theme.muted(`[^${n.id}]: `)
  // `[^id]: ` is single-width, so its length is its display width — body lines
  // are aligned under the label and children reserve the same space.
  const labelWidth = n.id.length + 5
  const body = renderBlockChildren(
    n.children,
    { ...ctx, prefix: ctx.prefix + ' '.repeat(labelWidth) },
    rc,
  )

  return indentLines(body, label, labelWidth)
}

const renderFootnoteReference: NodeRenderer = (node, ctx) => {
  return ctx.theme.info(`[^${(node as FootnoteReferenceNode).id}]`)
}

const renderFootnoteAnchor: NodeRenderer = () => {
  // The definition anchor (`[^1]` next to the body) is not part of the visible
  // text — the reference in the body already carries the marker.
  return ''
}

const renderVmrContainer: NodeRenderer = (node, ctx, rc) => {
  const n = node as VmrContainerNode
  const name = n.name ? ctx.theme.muted(`:::${n.name}`) + '\n' : ''
  const content = renderBlockChildren(n.children, ctx, rc)
  const closing = n.loading ? '' : '\n' + ctx.theme.muted(':::')
  return name + content + closing
}

const renderReference: NodeRenderer = (node, ctx) => {
  return ctx.theme.muted(`[${(node as ReferenceNode).id}]`)
}

const renderInline: NodeRenderer = (node, ctx, rc) => {
  const n = node as InlineNode
  if (n.children && n.children.length > 0) {
    return rc(n.children, ctx)
  }
  return n.content || ''
}

const renderCustomComponent: NodeRenderer = (node, ctx, rc) => {
  const n = node as CustomComponentNode
  if (n.children && n.children.length > 0) {
    return rc(n.children, ctx)
  }
  return n.content || ''
}

const renderUnknown: NodeRenderer = (node, ctx, rc) => {
  const n = node as UnknownNode
  if ('children' in n && Array.isArray(n.children)) {
    return rc(n.children as ParsedNode[], ctx)
  }
  if ('content' in n && typeof n.content === 'string') {
    return n.content
  }
  return ''
}

/* ─── Default renderers map ─────────────────────────────────────────── */

/**
 * Built-in render functions keyed by node type.
 * Export so users can compose custom renderers on top of defaults:
 *
 * ```ts
 * const myCodeBlock: NodeRenderer = (node, ctx, rc) => {
 *   return '>>>\n' + defaultRenderers.code_block!(node, ctx, rc) + '\n<<<'
 * }
 * ```
 */
export const defaultRenderers: Record<string, NodeRenderer | undefined> = {
  text: renderText,
  heading: renderHeading,
  paragraph: renderParagraph,
  code_block: renderCodeBlock,
  inline_code: renderInlineCode,
  list: renderList,
  list_item: renderListItem,
  blockquote: renderBlockquote,
  link: renderLink,
  image: renderImage,
  table: renderTable,
  table_row: renderTableRow,
  table_cell: renderTableCell,
  thematic_break: renderThematicBreak,
  strong: renderStrong,
  emphasis: renderEmphasis,
  strikethrough: renderStrikethrough,
  hardbreak: renderHardBreak,
  checkbox: renderCheckbox,
  checkbox_input: renderCheckbox,
  highlight: renderHighlight,
  insert: renderInsert,
  subscript: renderSubscript,
  superscript: renderSuperscript,
  emoji: renderEmoji,
  admonition: renderAdmonition,
  math_inline: renderMathInline,
  math_block: renderMathBlock,
  html_block: renderHtmlBlock,
  html_inline: renderHtmlInline,
  definition_list: renderDefinitionList,
  definition_item: renderDefinitionItem,
  footnote: renderFootnote,
  footnote_reference: renderFootnoteReference,
  footnote_anchor: renderFootnoteAnchor,
  vmr_container: renderVmrContainer,
  reference: renderReference,
  inline: renderInline,
  custom_component: renderCustomComponent,
  _unknown: renderUnknown,
}

/* ─── Public API ────────────────────────────────────────────────────── */

/* Render a single node to string */
export const renderNodeToString = (
  node: ParsedNode,
  theme?: ThemeOptions,
): string => {
  const resolved = theme ? resolveTheme(theme) : defaultTheme
  const ctx = createContext(resolved)
  return renderNode(node, ctx)
}

/* Render all nodes to string */
export const renderNodesToString = (
  nodes: ParsedNode[],
  theme?: ThemeOptions,
): string => {
  const resolved = theme ? resolveTheme(theme) : defaultTheme
  const ctx = createContext(resolved)

  return nodes
    .map((node) => renderNode(node, ctx))
    .map((i) => i.replace(/^\n+|\n+$/g, ''))
    .join('\n\n')
}
