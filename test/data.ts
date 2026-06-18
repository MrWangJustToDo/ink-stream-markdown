export const md = `# @git-diff-view/core

> Core diff engine for git diff processing with syntax highlighting

[![npm version](https://img.shields.io/npm/v/@git-diff-view/core)](https://www.npmjs.com/package/@git-diff-view/core)
[![npm downloads](https://img.shields.io/npm/dm/@git-diff-view/core)](https://www.npmjs.com/package/@git-diff-view/core)

## Features

- ✅ Git diff parsing and processing
- ✅ Syntax highlighting with HAST AST
- ✅ Split & Unified view data generation
- ✅ Web Worker / Node.js compatible
- ✅ Bundle-based data transfer
- ✅ Theme support (light/dark)

## Installation

\`\`\`bash
npm install @git-diff-view/core
# or
pnpm add @git-diff-view/core
# or
yarn add @git-diff-view/core
\`\`\`

## Usage

### Basic Usage

\`\`\`typescript
import { DiffFile } from "@git-diff-view/core";

// Create diff file instance
const file = new DiffFile(
  oldFileName,
  oldContent,
  newFileName,
  newContent,
  hunks,        // git diff hunks
  oldFileLang,  // e.g., "typescript"
  newFileLang
);

// Initialize theme (optional, default: light)
file.initTheme('dark');

// Initialize diff data
file.init();

// Build view data
file.buildSplitDiffLines();      // For split view
file.buildUnifiedDiffLines();    // For unified view
\`\`\`

### Advanced: Separate Initialization

\`\`\`typescript
// For more control over initialization
file.initRaw();      // Parse git diff
file.initSyntax();   // Apply syntax highlighting (optional)

file.buildSplitDiffLines();
file.buildUnifiedDiffLines();
\`\`\`

### Worker/Server Pattern

Process diff data in a separate thread or server for better performance:

\`\`\`typescript
// Worker/Server side - generate bundle
const file = new DiffFile(/* ... */);
file.initTheme('dark');
file.init();
file.buildSplitDiffLines();
file.buildUnifiedDiffLines();

const bundle = file.getBundle();
// Send bundle to main thread/client

// Main thread/Client side - reconstruct
import { DiffFile } from "@git-diff-view/core";

const mergedFile = DiffFile.createInstance(data, bundle);

// Use with UI components
<DiffView diffFile={mergedFile} />
\`\`\`

## API Reference

### DiffFile Class

#### Constructor

\`\`\`typescript
new DiffFile(
  oldFileName: string,
  oldContent: string,
  newFileName: string,
  newContent: string,
  hunks: string[],
  oldFileLang?: string,
  newFileLang?: string
)
\`\`\`

#### Methods

| Method | Description |
|--------|-------------|
| \`initTheme(theme)\` | Set theme ('light' or 'dark') |
| \`init()\` | Initialize diff data (calls initRaw + initSyntax) |
| \`initRaw()\` | Parse git diff without syntax highlighting |
| \`initSyntax()\` | Apply syntax highlighting |
| \`buildSplitDiffLines()\` | Generate split view data |
| \`buildUnifiedDiffLines()\` | Generate unified view data |
| \`getBundle()\` | Export data for transfer |

#### Static Methods

| Method | Description |
|--------|-------------|
| \`createInstance(data, bundle)\` | Reconstruct DiffFile from bundle |

\`\`\`mermaid
graph TD
  A[Source] -->|solid| B[Target 1]
  A -.->|dotted| C[Target 2]
  A ==>|thick| D[Target 3]
\`\`\`

\`\`\`mermaid
graph TD
  subgraph Cloud
    subgraph us-east [US East Region]
      A[Web Server] --> B[App Server]
    end
    subgraph us-west [US West Region]
      C[Web Server] --> D[App Server]
    end
  end
  E[Load Balancer] --> A
  E --> C
\`\`\`

$$x^2 + y^2 = z^2$$

\\[
e^x = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots + \\frac{x^n}{n!} + \\cdots, \\quad x \\in \\mathbb{R}
\\]

## Use Cases

- **Client-side**: Direct rendering with UI frameworks
- **Worker pattern**: Offload processing to Web Worker
- **Server-side**: Pre-process diffs in Node.js, send to client
- **Hybrid**: Mix of client and server processing

## Related Packages

- [@git-diff-view/react](https://www.npmjs.com/package/@git-diff-view/react) - React components
- [@git-diff-view/vue](https://www.npmjs.com/package/@git-diff-view/vue) - Vue components
- [@git-diff-view/file](https://www.npmjs.com/package/@git-diff-view/file) - File comparison mode
- [@git-diff-view/lowlight](https://www.npmjs.com/package/@git-diff-view/lowlight) - Syntax highlighter

## License

MIT © [MrWangJustToDo](https://github.com/MrWangJustToDo) 
`

export const md2 = `## Recent Announcements

| Date | Category | Details |
|------|----------|---------|
| Jun 3 | Announcement 🤖 | [Introducing the Services Track and Partner Hub of the Claude Partner Network](https://www.anthropic.com/news/partner-hub) — Launch of partner services and collaboration hub |
| Jun 3 | Policy | [What we learned mapping a year's worth of AI-enabled cyber threats](https://www.anthropic.com/news/ai-cyber-threats) — A year of AI threat landscape research |
| Jun 2 | Announcement | [Expanding Project Glasswing](https://www.anthropic.com/news/glasswing) — Expanding to 15 countries and approximately 150 new organizations |
| Jun 1 | Announcement | [Anthropic confidentially submits draft S-1 to the SEC](https://www.anthropic.com/news/s1) — Anthropic files confidential S-1 draft with the SEC (IPO preparation) |

## Math Examples

Inline math: The Pythagorean theorem states $a^2 + b^2 = c^2$ and Euler's identity is $e^{i\\pi} + 1 = 0$.

$$
\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}
$$

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## Blockquote & Nested List

> **Note:** This is a blockquote with **bold** and *italic* text.
> It can span multiple lines.

1. First item with nested bullets:
   - Alpha
   - Beta
   - Gamma
2. Second item with \`inline code\` and a [link](https://example.com)
3. Third item

## Code Blocks

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence up to n terms."""
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

print(fibonacci(10))
\`\`\`

---

That's all for now!
`
