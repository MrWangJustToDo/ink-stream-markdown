import stripAnsi from 'strip-ansi'
import { Text } from 'ink'

import { StreamMarkdown } from '../src'
import type { ParsedNode } from '../src'

/**
 * stream-markdown-parser 1.2.16 → 1.2.21 的行为冒烟用例。
 *
 * 覆盖两处升级变化：
 * - CJK-friendly 强调（默认开启）：`**` 紧贴中日韩标点时按 CJK 规则配对；
 * - final 解析保留字面量标记：未闭合的 `**`、仅有标记的文本（`|`/反引号）、
 *   三下划线强调不再被丢弃或字面化。
 *
 * 这些用例在 1.2.16 上会失败、在 1.2.21 上应全部通过，用来在升级后确认行为。
 */
export interface ParserBehaviorCase {
  id: string
  title: string
  markdown: string
  /** 返回 null 表示符合预期，返回字符串描述失败原因。 */
  check: (nodes: ParsedNode[], rendered: string) => string | null
}

const asRecord = (node: ParsedNode): Record<string, unknown> =>
  node as unknown as Record<string, unknown>

/** 拼接节点最终可见的文本。 */
export const nodeText = (node: ParsedNode): string => {
  const n = asRecord(node)
  if (n.type === 'inline_code' && typeof n.code === 'string') return n.code
  if (typeof n.content === 'string') return n.content
  if (typeof n.text === 'string') return n.text
  if (Array.isArray(n.children)) {
    return (n.children as ParsedNode[]).map(nodeText).join('')
  }
  return ''
}

const nodesOfType = (nodes: ParsedNode[], type: string): ParsedNode[] => {
  const out: ParsedNode[] = []
  const walk = (list: ParsedNode[]) => {
    for (const node of list) {
      const n = asRecord(node)
      if (n.type === type) out.push(node)
      if (Array.isArray(n.children)) walk(n.children as ParsedNode[])
    }
  }
  walk(nodes)
  return out
}

export const strongTexts = (nodes: ParsedNode[]): string[] =>
  nodesOfType(nodes, 'strong').map(nodeText)

/** 去掉 ANSI 并 trim，便于断言可见文本。 */
export const plain = (rendered: string): string => stripAnsi(rendered).trim()

export const parserBehaviorCases: ParserBehaviorCase[] = [
  {
    id: 'cjk-strong',
    title: 'CJK 标点旁的 ** 正确配对（markdown-it-cjk-friendly）',
    markdown: '说明**「A」**。和**「B」**。',
    check: (nodes) => {
      const actual = strongTexts(nodes)
      const expected = ['「A」', '「B」']
      return JSON.stringify(actual) === JSON.stringify(expected)
        ? null
        : `strong 应为 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`
    },
  },
  {
    id: 'final-unclosed-strong',
    title: 'final 解析保留未闭合 ** 的字面量',
    markdown: 'text ***',
    check: (_nodes, rendered) =>
      rendered.includes('***')
        ? null
        : `应保留字面量 "***"，实际 ${JSON.stringify(rendered)}`,
  },
  {
    id: 'final-trailing-star-em',
    title: 'final 解析保留 *italic** 末尾的 *',
    markdown: '*italic**',
    check: (_nodes, rendered) =>
      rendered.includes('italic') && rendered.endsWith('*')
        ? null
        : `应为 "italic*"，实际 ${JSON.stringify(rendered)}`,
  },
  {
    id: 'final-trailing-star-strong',
    title: 'final 解析保留 **bold*** 末尾的 *',
    markdown: '**bold***',
    check: (_nodes, rendered) =>
      rendered.includes('bold') && rendered.endsWith('*')
        ? null
        : `应为 "bold*"，实际 ${JSON.stringify(rendered)}`,
  },
  {
    id: 'final-pipe-only',
    title: 'final 解析保留仅有 | 的段落',
    markdown: '|',
    check: (_nodes, rendered) =>
      rendered.includes('|')
        ? null
        : `应渲染 "|"，实际 ${JSON.stringify(rendered)}`,
  },
  {
    id: 'triple-underscore',
    title: '三下划线 ___text___ 解析为强调而非字面量',
    markdown: '___text___',
    check: (_nodes, rendered) =>
      rendered.includes('text') && !rendered.includes('___')
        ? null
        : `应只渲染 "text"（无字面下划线），实际 ${JSON.stringify(rendered)}`,
  },
]

export const combinedParserBehaviorMarkdown = parserBehaviorCases
  .map((c) => `${c.title}\n\n${c.markdown}`)
  .join('\n\n')

export const ParserBehaviorExample = ({
  width = 80,
}: {
  width?: number
} = {}) => (
  <>
    <Text bold color="cyan">
      {`parser 1.2.22 行为检查 · width=${width}`}
    </Text>
    <StreamMarkdown theme={{ width }}>
      {combinedParserBehaviorMarkdown}
    </StreamMarkdown>
  </>
)
