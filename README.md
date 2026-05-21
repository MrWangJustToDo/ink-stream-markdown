# ink-stream-markdown

A streaming markdown renderer for [Ink](https://github.com/vadimdemedes/ink). Parses markdown with [stream-markdown-parser](https://github.com/nicepkg/stream-markdown-parser), highlights code blocks with [Shiki](https://shiki.style), and renders styled output to the terminal.

| Markdown rendering | Syntax highlighting |
| --- | --- |
| ![Markdown rendering](./markdown.png) | ![Syntax highlighting](./syntax.png) |

## Install

```bash
npm install ink-stream-markdown ink react
# or
pnpm add ink-stream-markdown ink react
```

`ink` and `react` are peer dependencies.

## Quick Start

```tsx
import { render } from 'ink'
import { StreamMarkdown, initHighlighter } from 'ink-stream-markdown'

// Initialize Shiki before first render (loads syntax grammars)
await initHighlighter()

function App() {
  const md = `
# Hello World

Here is some **bold** and *italic* text with \`inline code\`.

\`\`\`typescript
const greeting = 'Hello from ink-stream-markdown!'
console.log(greeting)
\`\`\`
  `

  return <StreamMarkdown>{md}</StreamMarkdown>
}

render(<App />)
```

## Streaming Usage

The component works naturally with streaming content — just pass the growing string as it arrives:

```tsx
import { useState, useEffect } from 'react'
import { render } from 'ink'
import { StreamMarkdown, initHighlighter } from 'ink-stream-markdown'

function StreamingApp() {
  const [content, setContent] = useState('')

  useEffect(() => {
    // Append chunks as they arrive from an LLM, API, etc.
    someStream.on('data', (chunk) => {
      setContent((prev) => prev + chunk)
    })
  }, [])

  return <StreamMarkdown>{content}</StreamMarkdown>
}

await initHighlighter()
render(<StreamingApp />)
```

## Props

| Prop            | Type                 | Description                                                    |
| --------------- | -------------------- | -------------------------------------------------------------- |
| `children`      | `string`             | Markdown content to render                                     |
| `theme`         | `ThemeOptions`       | Style overrides (colors, renderers, width, table options)      |
| `parserOptions` | `GetMarkdownOptions` | markdown-it instance options (plugins, math, containers, etc.) |
| `parseOptions`  | `ParseOptions`       | Per-parse options (token transforms, link validation, etc.)    |

## Theming

The default theme uses a GitHub dark mode color palette. Override any style with a chalk function:

```tsx
import chalk from 'chalk'
import { StreamMarkdown } from 'ink-stream-markdown'
;<StreamMarkdown
  theme={{
    heading: chalk.red.bold,
    code: chalk.cyan,
    link: chalk.green.underline,
    width: 100,
  }}
>
  {md}
</StreamMarkdown>
```

### Available Theme Keys

**Text styles** — `text`, `heading`, `firstHeading`, `link`, `href`, `strong`, `em`, `del`, `code`, `codeBlock`, `blockquote`, `listItem`, `hr`, `html`, `table`, `highlight`

**Semantic colors** — `muted`, `border`, `success`, `warning`, `error`, `info`, `purple`

**Layout** — `width` (terminal width override, defaults to `process.stdout.columns`), `tableOptions` (passthrough to [cli-table3](https://github.com/cli-table/cli-table3))

**Renderers** — `renderers` (custom render functions per node type, see below)

## Custom Renderers

Override how any node type is rendered without forking the whole renderer:

```tsx
import { StreamMarkdown, defaultRenderers } from 'ink-stream-markdown'
import type { NodeRenderer } from 'ink-stream-markdown'

// Wrap the default code block renderer with a custom border
const myCodeBlock: NodeRenderer = (node, ctx, renderChildren) => {
  const original = defaultRenderers.code_block!(node, ctx, renderChildren)
  return '┌──────────\n' + original + '\n└──────────'
}

// Replace heading rendering entirely
const myHeading: NodeRenderer = (node, ctx, renderChildren) => {
  const text = renderChildren(node.children, ctx)
  return `>>> ${text} <<<`
}

;<StreamMarkdown
  theme={{ renderers: { code_block: myCodeBlock, heading: myHeading } }}
>
  {md}
</StreamMarkdown>
```

Every renderer receives three arguments:

| Argument         | Type                        | Description                                    |
| ---------------- | --------------------------- | ---------------------------------------------- |
| `node`           | `ParsedNode`                | The parsed markdown AST node                   |
| `ctx`            | `RenderContext`             | Rendering context with `theme` and `listDepth` |
| `renderChildren` | `(children, ctx) => string` | Helper to render child nodes                   |

The `defaultRenderers` map is exported so you can compose on top of built-in behavior.

## Parser Options

Configure the underlying markdown-it parser:

```tsx
<StreamMarkdown
  parserOptions={{
    enableMath: true,
    enableContainers: true,
    customHtmlTags: ['thinking'],
  }}
  parseOptions={{
    final: true,
    validateLink: (url) => !url.startsWith('javascript:'),
  }}
>
  {md}
</StreamMarkdown>
```

## Programmatic API

Use the parser and renderer independently outside of React/Ink:

```typescript
import {
  parseMarkdownWithHighlight,
  createHighlightedParser,
  renderNodesToString,
  renderNodeToString,
  initHighlighter,
  resolveTheme,
} from 'ink-stream-markdown'

await initHighlighter()

// One-shot parse + render
const nodes = parseMarkdownWithHighlight('# Hello **world**')
const output = renderNodesToString(nodes)
console.log(output)

// With custom theme
const output2 = renderNodesToString(nodes, { code: chalk.cyan })

// Reusable parser instance
const parser = createHighlightedParser({ enableMath: true })
const nodes2 = parser.parse('$E = mc^2$')
```

## Supported Markdown Features

- Headings (h1–h6)
- Paragraphs, bold, italic, strikethrough
- Inline code and fenced code blocks (with Shiki syntax highlighting)
- Ordered and unordered lists (with nesting)
- Blockquotes
- Tables
- Links (clickable in supported terminals via [terminal-link](https://github.com/sindresorhus/terminal-link))
- Images (rendered as `[Image: alt]`)
- Horizontal rules
- Checkboxes
- Footnotes and footnote references
- Definition lists
- Admonitions (note, tip, warning, caution, etc.)
- Math (inline and block)
- Highlight, insert, subscript, superscript
- Emoji shortcodes
- HTML blocks and inline HTML
- Custom HTML-like components

## License

MIT
