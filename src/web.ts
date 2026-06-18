/**
 * Web entry point for ink-stream-markdown.
 *
 * Uses browser-compatible shims:
 * - shiki/bundle/web instead of shiki/bundle-full.mjs
 * - OSC 8 hyperlinks instead of terminal-link (works with xterm.js)
 * - No process.stdout.columns dependency
 *
 * Usage with ink-web:
 *   import { StreamMarkdown } from 'ink-stream-markdown/web'
 */
export { StreamMarkdown } from './stream-markdown'
export type { StreamMarkdownProps } from './stream-markdown'

export { parseMarkdown, createParser } from './parse'
export { initHighlighter, clearHighlightCache } from './platform'
export {
  renderNodesToString,
  renderNodeToString,
  defaultRenderers,
  defaultHighlightCode,
} from './render'
export { defaultTheme, resolveTheme } from './theme'
export type {
  ChalkStyle,
  ThemeOptions,
  ResolvedTheme,
  RenderContext,
  NodeRenderer,
  Renderers,
  HighlightOptions,
  TableOptions,
  TableBorderChars,
} from './theme'
export type {
  GetMarkdownOptions,
  ParseOptions,
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
