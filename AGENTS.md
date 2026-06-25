# AGENTS.md

Instructions for AI coding agents working on **ink-stream-markdown**.

## Project overview

Streaming markdown renderer for [Ink](https://github.com/vadimdemedes/ink). Parses markdown with `stream-markdown-parser`, highlights code with Shiki, renders Mermaid diagrams as ASCII via `beautiful-mermaid`, and outputs styled terminal strings (chalk + ANSI).

Published as an npm library with two entry points:

| Entry | Path | Use case |
| ----- | ---- | -------- |
| Node / CLI | `ink-stream-markdown` | Terminal apps using Ink |
| Browser | `ink-stream-markdown/web` | [ink-web](https://github.com/cjroth/ink-web) + xterm.js |

`ink` and `react` are **peer dependencies** — never bundle them.

## Repository layout

```
src/
  index.ts              # Node entry — re-exports public API
  web.ts                # Web entry — same API, browser platform shim
  stream-markdown.tsx   # React component (Ink `<Text>` wrapper)
  parse.ts              # Markdown parsing + emoji-list preprocessing
  render.ts             # AST → styled string (node renderers, Shiki, mermaid)
  theme.ts              # Theme types, defaults, resolveTheme()
  platform.ts           # Node: terminal-link, Shiki full bundle, stdout width
  platform-browser.ts   # Web: OSC-8 links, shiki/bundle/web, width=80
  utils/                # highlighter, table layout, browser shims
test/                   # Manual examples (not a formal test suite)
dist/                   # Build output (generated — do not edit)
```

## Commands

Use **pnpm** (lockfile is `pnpm-lock.yaml`).

```bash
pnpm install          # install dependencies
pnpm build            # tsdown → dist/
pnpm dev              # tsdown watch mode
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm lint:fix         # eslint --fix
pnpm format           # prettier --write
pnpm format:check     # prettier --check
pnpm example          # tsx test/run.tsx — visual smoke test
```

Before opening a PR, run at minimum:

```bash
pnpm typecheck && pnpm lint && pnpm build
```

There is no automated unit-test runner. Use `pnpm example` for manual verification.

## Architecture

**Pipeline:** markdown string → `parseMarkdown()` → `ParsedNode[]` → `renderNodesToString()` → ANSI string → Ink `<Text>`.

**Dual build:** `tsdown.config.ts` builds two ESM bundles. The web bundle aliases `src/platform` → `src/platform-browser`. Platform-specific code (Shiki bundle, terminal links, width) lives behind that shim — keep Node-only imports out of shared modules.

**Rendering model:** String-based output with chalk, not Ink layout per node. Custom behavior is exposed via `ThemeOptions` (styles, `renderers`, `highlight`, `mermaidASCII`, `tableOptions`).

**Highlighting:** Call `initHighlighter()` before first render (loads Shiki grammars). Code blocks are highlighted at parse time in `StreamMarkdown`; mermaid blocks use `beautiful-mermaid` ASCII rendering in `defaultHighlightCode`.

## Coding conventions

- **Language:** TypeScript (strict), ESM (`"type": "module"`), target ES2022
- **Formatting:** Prettier — no semicolons, single quotes, trailing commas, 80-char width
- **Imports:** Use `verbatimModuleSyntax`; prefer `import type` for type-only imports
- **React:** Functional components only; follow existing hooks patterns in `stream-markdown.tsx`
- **Exports:** Public API is defined by `src/index.ts` and `src/web.ts`. Add new exports there explicitly
- **Unused vars:** Prefix with `_` to satisfy ESLint (`argsIgnorePattern` / `varsIgnorePattern`)
- **Comments:** Only for non-obvious logic; keep code self-explanatory
- **Scope:** Minimal diffs — match existing naming, types, and file organization

## When changing behavior

- **Public API or props** → update `README.md` (user-facing docs live there, not in JSDoc alone)
- **New platform-specific code** → add to `platform.ts` / `platform-browser.ts` (or `utils/*-browser.ts`), not inline in shared files
- **Theme / highlight options** → update types in `theme.ts`, defaults in `defaultTheme`, and README tables/examples
- **Parser features** → prefer `stream-markdown-parser` options; local preprocessing belongs in `parse.ts`

## Do not

- Edit files in `dist/` — run `pnpm build` instead
- Add `ink` or `react` to `dependencies` (peer deps only)
- Bundle peer dependencies in tsdown (already configured with `neverBundle`)
- Add markdown docs the user did not ask for (e.g. extra README sections, CHANGELOG) unless requested
- Create git commits or push unless explicitly asked

## Key files for common tasks

| Task | Start here |
| ---- | ---------- |
| Component props / streaming | `src/stream-markdown.tsx` |
| New node type rendering | `src/render.ts` (`defaultRenderers`, `Renderers` in `theme.ts`) |
| Colors / theme keys | `src/theme.ts` |
| Syntax highlighting | `src/utils/highlighter.ts`, `src/utils/highlighter-browser.ts` |
| Mermaid ASCII | `src/render.ts` (`defaultHighlightCode`), `theme.mermaidASCII` |
| Table layout | `src/utils/table.ts` |
| Build / entry points | `tsdown.config.ts` |
| Try changes visually | `test/example.tsx`, `test/data.ts`, `pnpm example` |
