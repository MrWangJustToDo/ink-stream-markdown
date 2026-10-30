# ink-stream-markdown

[![npm version](https://img.shields.io/npm/v/ink-stream-markdown)](https://www.npmjs.com/package/ink-stream-markdown)
[![npm downloads](https://img.shields.io/npm/dm/ink-stream-markdown)](https://www.npmjs.com/package/ink-stream-markdown)

A streaming markdown renderer for [Ink](https://github.com/vadimdemedes/ink). Parses markdown with [stream-markdown-parser](https://github.com/nicepkg/stream-markdown-parser), highlights code blocks with [Shiki](https://shiki.style), renders Mermaid diagrams as ASCII art with [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid), and outputs styled text to the terminal.

| Markdown rendering                    | Syntax highlighting                  |
| ------------------------------------- | ------------------------------------ |
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

| Prop            | Type                 | Description                                                             |
| --------------- | -------------------- | ----------------------------------------------------------------------- |
| `children`      | `string`             | Markdown content to render                                              |
| `theme`         | `ThemeOptions`       | Style overrides (colors, renderers, width, table options)               |
| `highlight`     | `HighlightOptions`   | Custom code highlighting pipeline (tokenization and/or token rendering) |
| `parserOptions` | `GetMarkdownOptions` | markdown-it instance options (plugins, math, containers, etc.)          |
| `parseOptions`  | `ParseOptions`       | Per-parse options (token transforms, link validation, etc.). Defaults to `{ final: true }` unless `final`/`streamParse` is set |
| `height`        | `number`             | Max visible lines. Overflow is folded behind a fold-indicator line. Unlimited by default |
| `streaming`     | `boolean`            | One flag driving both parser and window: `true` → incremental parse (`final:false`, re-parse only the appended tail) + tail-anchored window (fold indicator on top); `false` → final one-shot parse (resets stream cache, explicit `parseOptions.final` wins) + render from start with fold indicator at bottom |
| `foldIndicator` | `FoldIndicator`      | `(folded, streaming) => string` — custom indicator line. Default: dim `↓/↑ N lines folded` |

## Theming

The default theme uses a GitHub dark mode color palette. Override any style with a chalk function:

```tsx
import chalk from 'chalk'
import { StreamMarkdown } from 'ink-stream-markdown'
<StreamMarkdown
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

**Text styles** — `text`, `heading`, `firstHeading`, `link`, `href`, `strong`, `em`, `del`, `code`, `codeBlock`, `blockquote`, `listItem`, `hr`, `html`, `table`, `tableFallback`, `mark`

**Semantic colors** — `muted`, `border`, `success`, `warning`, `error`, `info`, `purple`

**Layout** — `width` (terminal width override, defaults to `process.stdout.columns`), `tableOptions` (table rendering options, see below), `mermaidASCII` (ASCII mermaid renderer options, see below)

**Renderers** — `renderers` (custom render functions per node type, see below)

**Highlight** — `highlight` (custom code highlighting pipeline, see below)

### Table Options

Fine-tune table rendering via `theme.tableOptions`:

```tsx
<StreamMarkdown
  theme={{
    tableOptions: {
      minColumnWidth: 8,
      cellPadding: 2,
      rowSeparator: false,
      borderChars: {
        topLeft: '╭', topRight: '╮',
        bottomLeft: '╰', bottomRight: '╯',
        horizontal: '─', vertical: '│',
        teeDown: '┬', teeUp: '┴',
        teeRight: '├', teeLeft: '┤',
        cross: '┼',
      },
    },
  }}
>
  {md}
</StreamMarkdown>
```

| Option           | Type               | Default | Description                                        |
| ---------------- | ------------------ | ------- | -------------------------------------------------- |
| `minColumnWidth` | `number`           | `5`     | Minimum column width; a column only goes narrower when its content is narrower, else the table is printed as markdown |
| `cellPadding`    | `number`           | `1`     | Spaces on each side of cell content                 |
| `rowSeparator`   | `boolean`          | `true`  | Draw horizontal lines between body rows             |
| `borderChars`    | `TableBorderChars` | —       | Override box-drawing characters (e.g. rounded corners) |

A table that does not fit the available width is squeezed first: columns that
already fit in an even split keep their content width, and the rest share the
remaining budget in proportion to their content, with a floor at
`minColumnWidth` (or the column's own content width when that is narrower).
Cell text is hard-wrapped when it overflows its share. When even that does not
fit, the table is printed as its markdown source instead of a box that shreds
cells into one or two characters per line (or that Ink wraps and shatters):

```md
| Date | Category | Details |
| :--- | :--- | :--- |
| Jun 3 | Announcement | ... |
```

Cell text is taken from the source, so inline markup and links stay intact.
That fallback output goes through `theme.tableFallback` (default: no styling) —
pass e.g. `tableFallback: chalk.dim` to mark it as degraded rendering.

### Mermaid Diagrams

Fenced code blocks with language `mermaid` are rendered as ASCII diagrams via [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid). If a diagram is unsupported or wider than the terminal, it falls back to a plain code block.

````markdown
```mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]
```
````

Fine-tune ASCII rendering via `theme.mermaidASCII` (options from beautiful-mermaid's `AsciiRenderOptions`):

```tsx
<StreamMarkdown
  theme={{
    mermaidASCII: {
      useAscii: true,       // use +,-,|,> instead of box-drawing chars
      colorMode: 'truecolor',
    },
  }}
>
  {md}
</StreamMarkdown>
```

| Option            | Type                                      | Default | Description                                      |
| ----------------- | ----------------------------------------- | ------- | ------------------------------------------------ |
| `useAscii`        | `boolean`                                 | `false` | Use plain ASCII chars instead of Unicode borders |
| `paddingX`        | `number`                                  | `5`     | Horizontal spacing between nodes                 |
| `paddingY`        | `number`                                  | `5`     | Vertical spacing between nodes                   |
| `boxBorderPadding`| `number`                                  | `1`     | Padding inside node boxes                        |
| `colorMode`       | `'none' \| 'auto' \| 'ansi16' \| 'ansi256' \| 'truecolor' \| 'html'` | `'auto'` | ANSI color mode for diagram output    |
| `theme`           | `Partial<AsciiTheme>`                     | —       | Per-element colors (fg, border, line, arrow, etc.) |

Override or disable mermaid rendering via `highlight.renderMermaid` (on the `highlight` prop or `theme.highlight`):

```tsx
// Custom renderer
<StreamMarkdown
  highlight={{
    renderMermaid: (code) => myCustomMermaidRenderer(code),
  }}
>
  {md}
</StreamMarkdown>

// Disable mermaid rendering (show as plain code block)
<StreamMarkdown highlight={{ renderMermaid: false }}>
  {md}
</StreamMarkdown>
```

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

| Argument         | Type                        | Description                                       |
| ---------------- | --------------------------- | ------------------------------------------------- |
| `node`           | `ParsedNode`                | The parsed markdown AST node                      |
| `ctx`            | `RenderContext`             | Rendering context: `theme`, `listDepth`, `prefix` |
| `renderChildren` | `(children, ctx) => string` | Helper to render child nodes                      |

`ctx.prefix` holds the indentation already applied to the lines of the block
being rendered (list indent + the blank run that aligns with the item marker).
Renderers that lay out to a fixed width — like the built-in table — subtract the
width of `ctx.prefix` from the terminal width so nested content still fits.

The `defaultRenderers` map is exported so you can compose on top of built-in behavior.

## Custom Highlight Pipeline

The default highlighting uses [Shiki](https://shiki.style) for tokenization and chalk for coloring. You can replace the entire pipeline with any highlighter by providing a single `highlightCode` callback that takes source code and a language and returns a styled string:

```tsx
import { StreamMarkdown, defaultHighlightCode } from 'ink-stream-markdown'

// Use highlight.js instead of Shiki
<StreamMarkdown
  highlight={{
    highlightCode: (code, lang) => hljs.highlight(code, { language: lang }).value,
  }}
>
  {md}
</StreamMarkdown>

// Wrap the default Shiki pipeline with custom logic
<StreamMarkdown
  highlight={{
    highlightCode: (code, lang) => {
      const highlighted = defaultHighlightCode(code, lang)
      return '>>>\n' + highlighted + '\n<<<'
    },
  }}
>
  {md}
</StreamMarkdown>
```

| Option          | Type                                              | Description                                                                       |
| --------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `highlightCode` | `(code: string, lang: string) => string`          | Replace the code-to-styled-string pipeline (default: Shiki + chalk)               |
| `renderMermaid` | `((code: string) => string) \| false` | Custom mermaid renderer, or `false` to disable (default: beautiful-mermaid ASCII) |

`defaultHighlightCode` is exported so you can compose custom logic on top of the built-in Shiki pipeline.

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
  parseMarkdown,
  createParser,
  renderNodesToString,
  renderNodeToString,
  initHighlighter,
  resolveTheme,
} from 'ink-stream-markdown'

await initHighlighter()

// One-shot parse + render
const nodes = parseMarkdown('# Hello **world**')
const output = renderNodesToString(nodes)
console.log(output)

// With custom theme
const output2 = renderNodesToString(nodes, { code: chalk.cyan })

// Reusable parser instance
const parser = createParser({ enableMath: true })
const nodes2 = parser.parse('$E = mc^2$')
```

### Shared Shiki highlighter

`initHighlighter()` and the markdown renderer use one lazy Shiki instance. Call
`getHighlighter()` to reuse that same instance for other renderers (for example a diff
view) instead of creating a second engine:

```typescript
import { getHighlighter } from 'ink-stream-markdown'

const highlighter = await getHighlighter()

// `github-dark` is loaded by default; add any theme the consumer needs.
await highlighter.loadTheme('github-light')

const hast = highlighter.codeToHast(code, {
  lang: 'typescript',
  themes: { dark: 'github-dark', light: 'github-light' },
})
```

`getHighlighter()` initializes the highlighter when necessary and resolves to the
shared instance. Do not call `dispose()` on it — the markdown renderer keeps using it.

### Lazy language loading

To keep startup cheap, `initHighlighter()` preloads only a common set of languages
(JavaScript, TypeScript, JSX, TSX, JSON, JSONC, Bash, Python, HTML, CSS, Markdown,
YAML, SQL) instead of the whole Shiki bundle. Other languages are loaded on demand.

```typescript
import { initHighlighter, ensureLanguage } from 'ink-stream-markdown'

// Preload your own set instead of the default one…
await initHighlighter({ preload: ['rust', 'go', 'diff'] })
// …or load everything up front (the previous behavior).
// await initHighlighter({ preload: 'all' })

// Load a single grammar later:
await ensureLanguage('rust')
```

`<StreamMarkdown>` detects the languages used by its code blocks and calls
`ensureLanguage()` automatically, re-rendering once they are ready. With the
synchronous `renderNodesToString()` API, call `await ensureLanguage(lang)` (or
preload the language) before rendering when a code block uses a language outside
the default set — otherwise that block renders without highlighting.

> **Note:** grammars that rely on Shiki *injections* (e.g. `ts-tags` / `lit`, whose
> `inline.es6-*` grammars inject into `source.ts`) only take effect when they are
> present at highlighter creation. Loaded later via `ensureLanguage()`, their
> injections are not applied to already-compiled grammars, so `ts-tags` / `lit`
> blocks render as plain TypeScript. To get full injection support, preload them at
> init — `await initHighlighter({ preload: ['ts-tags', ...] })` — which also brings
> back their tokenization cost.

## Browser Usage (ink-web)

This package provides a web-compatible entry point for use with [ink-web](https://github.com/cjroth/ink-web), which renders Ink components into an xterm.js terminal in the browser.

```bash
npm install ink-stream-markdown ink-web react
```

Import from `ink-stream-markdown/web` instead of `ink-stream-markdown`:

```tsx
import { StreamMarkdown, initHighlighter } from 'ink-stream-markdown/web'
```

The web entry swaps terminal-specific dependencies with browser-compatible shims:

- **Shiki** uses `shiki/bundle/web` (loads grammars via fetch instead of fs)
- **Links** use OSC 8 escape sequences (supported by xterm.js) instead of `terminal-link`
- **Terminal width** defaults to `80` (override via `theme.width`)

### Vite Setup

Use `ink-web`'s Vite plugin and alias `ink` to `ink-web`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { inkWebPlugin } from 'ink-web/vite'

export default defineConfig({
  plugins: [react(), inkWebPlugin()],
  resolve: {
    alias: { ink: 'ink-web' },
  },
})
```

### Next.js / Webpack Setup

Alias `ink` to `ink-web` so Webpack resolves the web-compatible renderer:

```javascript
/** @type {import('next').NextConfig} */
const config = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ink: 'ink-web',
    }
    return config
  },
}

export default config
```

For a standalone webpack config:

```javascript
module.exports = {
  resolve: {
    alias: { ink: 'ink-web' },
  },
}
```

## Supported Markdown Features

- Headings (h1–h6)
- Paragraphs, bold, italic, strikethrough
- Inline code and fenced code blocks (with Shiki syntax highlighting)
- Mermaid diagrams (rendered as ASCII art via beautiful-mermaid)
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
