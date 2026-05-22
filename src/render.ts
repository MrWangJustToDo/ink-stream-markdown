import chalk from 'chalk'
import Table from 'cli-table3'
import terminalLink from 'terminal-link'

import { defaultTheme, resolveTheme } from './theme'
import { highlightCode } from './utils/highlighter'
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
  FootnoteAnchorNode,
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
  theme,
})

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
export const defaultHighlightCode = (code: string, lang: string, _ctx?: RenderContext): string => {
  const tokens = highlightCode(code, lang)
  const ctx = _ctx || createContext(defaultTheme)
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
    code = defaultHighlightCode(n.code, n.language, ctx);
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

const renderList: NodeRenderer = (node, ctx, _rc) => {
  const n = node as ListNode
  const indent = '  '.repeat(ctx.listDepth)
  const nestedCtx = { ...ctx, listDepth: ctx.listDepth + 1 }

  let items = n.items
    .map((item, index) => {
      const marker = n.ordered
        ? ctx.theme.muted(`${(n.start ?? 1) + index}. `)
        : ctx.theme.muted('\u2022 ')
      const content = renderNode(item, nestedCtx)
      return indent + marker + content
    })
    .join('\n')

  while (items.endsWith('\n')) {
    items = items.substring(0, items.length - 1)
  }

  return ctx.listDepth === 0 ? items : '\n\n' + items + '\n\n'
}

const renderListItem: NodeRenderer = (node, ctx, _rc) => {
  const n = node as ListItemNode
  const parts: string[] = []

  for (const child of n.children) {
    parts.push(renderNode(child, ctx))
  }

  return ctx.theme.listItem(parts.join('').replace(/\n$/, ''))
}

const renderBlockquote: NodeRenderer = (node, ctx, rc) => {
  const content = rc((node as BlockquoteNode).children, ctx)
  const lines = content.split('\n').filter((l) => l)
  return lines
    .map((line) => ctx.theme.border('\u2502 ') + ctx.theme.blockquote(line))
    .join('\n')
}

const renderLink: NodeRenderer = (node, ctx) => {
  const n = node as LinkNode
  const text = n.text || n.href
  // Use terminal-link to make clickable links in supported terminals
  return ctx.theme.link(terminalLink(ctx.theme.href(text), n.href))
}

const renderImage: NodeRenderer = (node, ctx) => {
  return ctx.theme.muted(`[Image: ${(node as ImageNode).alt || 'image'}]`)
}

const renderTable: NodeRenderer = (node, ctx, rc) => {
  const n = node as TableNode
  const numCols = n.header.cells.length
  const termWidth = ctx.theme.width || process.stdout.columns || 80
  const availableWidth = termWidth - (numCols + 1) * 3 - 1
  const colWidth = Math.max(10, Math.floor(availableWidth / numCols))

  const colWidths = Array.from({ length: numCols }, () => colWidth)

  const table = new Table({
    head: n.header.cells.map((cell) =>
      ctx.theme.heading(rc(cell.children, ctx)).toString(),
    ),
    colWidths,
    wordWrap: true,
    wrapOnWordBoundary: true,
    style: {
      head: [],
      border: ['gray'],
    },
    ...ctx.theme.tableOptions,
  })

  n.rows.forEach((row) => {
    table.push(row.cells.map((cell) => rc(cell.children, ctx)))
  })

  return ctx.theme.table(table.toString())
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
  const width = ctx.theme.width || process.stdout.columns || 80
  return ctx.theme.hr('\u2500'.repeat(Math.min(width, 40)))
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
  const content = rc(n.children, ctx)

  return color(`${icon} ${title}`) + '\n' + color('\u2502 ') + content
}

const renderMathInline: NodeRenderer = (node, ctx) => {
  return ctx.theme.purple(`$${(node as MathInlineNode).content}$`)
}

const renderMathBlock: NodeRenderer = (node, ctx) => {
  return ctx.theme.purple((node as MathBlockNode).content)
}

const renderHtmlBlock: NodeRenderer = (node, ctx) => {
  return ctx.theme.html((node as HtmlBlockNode).content)
}

const renderHtmlInline: NodeRenderer = (node, ctx, rc) => {
  const n = node as HtmlInlineNode
  if (n.children && n.children.length > 0) {
    return rc(n.children, ctx)
  }
  return ctx.theme.html(n.content)
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
  return label + rc(n.children, ctx)
}

const renderFootnoteReference: NodeRenderer = (node, ctx) => {
  return ctx.theme.info(`[^${(node as FootnoteReferenceNode).id}]`)
}

const renderFootnoteAnchor: NodeRenderer = (node, ctx) => {
  return ctx.theme.info(`[^${(node as unknown as FootnoteAnchorNode).id}]`)
}

const renderVmrContainer: NodeRenderer = (node, ctx, rc) => {
  const n = node as VmrContainerNode
  const name = n.name ? ctx.theme.muted(`:::${n.name}`) + '\n' : ''
  const content = rc(n.children, ctx)
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
    .map((i) => {
      while (i.startsWith('\n')) {
        i = i.slice(1)
      }
      while (i.endsWith('\n')) {
        i = i.slice(0, i.length - 1)
      }
      return i
    })
    .join('\n\n')
}
