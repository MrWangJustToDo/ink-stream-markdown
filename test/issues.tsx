import stringWidth from 'string-width'
import stripAnsi from 'strip-ansi'
import wrapAnsi from 'wrap-ansi'

import { parseMarkdown, renderNodesToString } from '../src'
import type { ParsedNode } from 'stream-markdown-parser'

export interface Check {
  /** 期望的行为；`ok: false` 表示问题复现 */
  name: string
  ok: boolean
  /** 实测到的现象，便于对照 */
  actual?: string
}

export interface IssueContext {
  markdown: string
  width: number
  nodes: ParsedNode[]
  rendered: string
  /** 渲染结果按 '\n' 切开的行（含 ANSI，比较文本时用 plain()） */
  lines: string[]
}

export interface Issue {
  id: string
  title: string
  /** 观察到的现象 */
  problem: string
  /**
   * 已知限制 / 需产品决策：失败时不计入退出码，报告里单独标注
   */
  known?: boolean
  width: number
  markdown: string
  /** 对照组：同样的内容换个场景，用来对比"应该长什么样" */
  control?: { title: string; markdown: string }
  checks: (ctx: IssueContext) => Check[]
  /** 额外打印的原始信息（解析结果、字节对比等） */
  details?: (ctx: IssueContext) => string[]
}

export const plain = (line: string): string => stripAnsi(line)
export const lineWidth = (line: string): number => stringWidth(line)

const maxWidth = (lines: string[]): number =>
  lines.length ? Math.max(...lines.map(lineWidth)) : 0

const nodeTypes = (nodes: ParsedNode[]): string[] => {
  const types = new Set<string>()
  const walk = (node: ParsedNode) => {
    types.add(node.type)
    const n = node as ParsedNode & Record<string, unknown>
    for (const key of ['children', 'items', 'rows']) {
      const children = n[key]
      if (Array.isArray(children)) {
        for (const child of children) walk(child as ParsedNode)
      }
    }
  }
  for (const node of nodes) walk(node)
  return [...types]
}

const expect = (name: string, ok: boolean, actual?: string): Check => ({
  name,
  ok,
  actual,
})

/** 对照组：所有单元格内容本身就只有 1 字符宽 —— 1 字符宽的列属于合理布局 */
const THIN_TABLE = '| a | b |\n| --- | --- |\n| 1 | 2 |'

const build = (parse: string, theme: { width: number }) =>
  renderNodesToString(parseMarkdown(parse), theme)

export const issues: Issue[] = [
  {
    id: 'blockquote',
    title: 'blockquote：块级子节点被粘连 / 未为 "│ " 预留宽度',
    problem:
      'renderBlockquote 用 renderChildren 拼接子节点（无分隔）后 filter 掉空行，段落/hr/列表/表格会挤成一行；' +
      '且渲染子节点时没有把 "│ "（2 列）计入 ctx.prefix，填满宽度的表格会整行超宽。',
    width: 40,
    markdown: `> 第一段文字。
>
> 第二段文字。
>
> ---
>
> - 列表项一
> - 列表项二
>
> | 列一 | https://example.com/a/very/long/path/that/never/breaks |
> | --- | --- |
> | 值 | 另一个值 |
`,
    control: {
      title: '对照组：同样的内容放在顶层',
      markdown: `第一段文字。

第二段文字。

---

- 列表项一
- 列表项二

| 列一 | https://example.com/a/very/long/path/that/never/breaks |
| --- | --- |
| 值 | 另一个值 |
`,
    },
    checks: ({ lines, width }) => {
      const text = lines.map(plain)
      return [
        expect(
          '两个段落各自成行（不应出现在同一行）',
          !text.some(
            (l) => l.includes('第一段文字') && l.includes('第二段文字'),
          ),
          text.find((l) => l.includes('第一段文字')),
        ),
        expect(
          'hr 独占一行',
          text.some((l) => /^│ ─+$/.test(l)),
          text.find((l) => l.includes('─')),
        ),
        expect(
          '两个列表项各自成行',
          text.filter((l) => l.includes('列表项')).length === 2,
          String(text.filter((l) => l.includes('列表项')).length) + ' 行',
        ),
        expect(
          `每一行都带 "│ " 前缀（空行只留竖线）且不超过可用宽度 ${width}`,
          lines.every((l) => {
            const text = plain(l)
            return (
              (text === '│' || text.startsWith('│ ')) && lineWidth(l) <= width
            )
          }),
          `最宽 ${maxWidth(lines)} 列`,
        ),
      ]
    },
  },
  {
    id: 'admonition',
    title: 'admonition：正文只有首行有 "│ " 前缀 / 子节点粘连 / 未预留宽度',
    problem:
      'renderAdmonition 只把 "│ " 拼在正文最前面（不做逐行前缀），所以多行正文、列表、表格全都跑到竖线外面；' +
      '块级子节点之间也没有分隔（段落和列表会被粘在一行）。',
    width: 40,
    markdown: `:::note
第一行说明文字。

- 事项一，比较长的一段说明文字
- 事项二

| 列一 | https://example.com/a/very/long/path/that/never/breaks |
| --- | --- |
| 值 | 另一个值 |
:::
`,
    control: {
      title: '对照组：同样的正文放在顶层（不带 admonition 容器）',
      markdown: `第一行说明文字。

- 事项一，比较长的一段说明文字
- 事项二

| 列一 | https://example.com/a/very/long/path/that/never/breaks |
| --- | --- |
| 值 | 另一个值 |
`,
    },
    checks: ({ lines, width }) => {
      const text = lines.map(plain)
      const body = text.slice(1)
      return [
        expect(
          `标题行之后每一行都带 "│ " 前缀（空行只留竖线），且加前缀后不超过可用宽度 ${width}`,
          body.every((l) => {
            if (l === '│') return true
            return l.startsWith('│ ') && lineWidth(l) <= width
          }),
          body.find((l) => l !== '│' && !l.startsWith('│ ')),
        ),
        expect(
          '正文没有和列表项粘在同一行',
          !text.some((l) => l.includes('第一行说明文字') && l.includes('• ')),
          text.find((l) => l.includes('第一行说明文字')),
        ),
      ]
    },
  },
  {
    id: 'preprocess',
    title: 'parse.ts 预处理：代码块里的连续空行被吞掉',
    problem:
      'preprocessEmojiLists 用 markdown.split(/\\n\\n+/) 切块、再 join("\\n\\n") 拼回，于是整篇文档里连续空行被压缩；' +
      '代码块内部的空行同样被改写（静默改内容）。',
    width: 60,
    markdown: '```ts\nconst a = 1\n\n\n\nconst b = 2\n```\n',
    checks: ({ nodes, markdown }) => {
      const source = /```[a-z]*\n([\s\S]*?)```/.exec(markdown)?.[1] ?? ''
      const parsed =
        nodes.find((n) => n.type === 'code_block')?.code ?? '(没有 code_block)'
      const emojiNodes = parseMarkdown('✅ 甲\n⚠️ 乙\n')
      return [
        expect(
          '代码块内容与原文逐字节一致',
          parsed === source,
          `code=${JSON.stringify(parsed)}`,
        ),
        expect(
          '（功能对照）表情符号列表转换仍然生效',
          emojiNodes.some((n) => n.type === 'list'),
          emojiNodes.map((n) => n.type).join(', '),
        ),
      ]
    },
    details: ({ nodes, markdown }) => {
      const source = /```[a-z]*\n([\s\S]*?)```/.exec(markdown)?.[1] ?? ''
      const parsed = nodes.find((n) => n.type === 'code_block')?.code ?? ''
      return [
        `原文:   ${JSON.stringify(source)}`,
        `解析后: ${JSON.stringify(parsed)}`,
      ]
    },
  },
  {
    id: 'cell-html',
    title: '表格单元格里的行内 HTML 被原样打印',
    problem:
      'parser 在单元格里把 <code>x</code> 解析成 html_block，renderHtmlBlock 直接输出 content，' +
      '于是标签字面出现在表格里；同样的写法在段落里（html_inline）会被解释掉。',
    width: 40,
    markdown: `| 左列 | 右列 |
| --- | --- |
| <code>x</code> | 第一行<br>第二行 |
`,
    control: {
      title: '对照组：同样的行内 HTML 放在段落里',
      markdown: '段落里的 <code>x</code> 会被解释成 x。\n',
    },
    checks: ({ lines }) => {
      const text = lines.map(plain).join('\n')
      return [
        expect(
          '单元格里不应出现字面标签 <code>',
          !text.includes('<code>'),
          text.split('\n').find((l) => l.includes('code')),
        ),
        expect(
          '单元格里的 <br> 应换行（多行单元格）',
          text.includes('第一行') && text.includes('第二行'),
        ),
      ]
    },
  },
  {
    id: 'narrow-columns',
    title: 'table：极窄宽度下内容被挤成"每列 1 字符"的逐字符行',
    problem:
      'calculateColumnWidths 的收缩分支把所有列一律压到 1 字符下限：于是内容远长于 1 字符的列也被逐字符折行（│ 0 │ / │ . │ / │ 3 │）。' +
      '正确的下限是：列可以窄到 1 字符，但仅当该列内容本身就只有 1 字符宽；否则宁可回退原始 markdown。',
    width: 9,
    markdown: `| ver | dep |
| --- | --- |
| 0.3.10 | ^0.54.0 |
| 0.3.14 | ^0.58.0 |`,
    control: {
      title: '内容本身就是单字符时，1 字符宽的列是合理的',
      markdown: THIN_TABLE,
    },
    checks: ({ markdown: md }) => {
      // 表头分隔行的短横数 = 列宽 + 两侧 cell padding（默认 1）
      const columnWidths = (text: string): number[] | undefined => {
        const separator = text
          .split('\n')
          .map(plain)
          .find((l) => /^├─/.test(l) && l.endsWith('┤'))
        if (!separator) return undefined
        return separator
          .slice(1, -1)
          .split('┼')
          .map((seg) => stringWidth(seg) - 2)
      }

      const report: string[] = []
      let perChar = false
      for (const width of [8, 9, 10, 11, 12, 14, 20, 30]) {
        const text = build(md, { width })
        const cols = columnWidths(text)
        if (!cols) {
          // 回退为原始 markdown 是允许的降级，但内容不能丢
          const kept = plain(text).includes('| 0.3.10 | ^0.54.0 |')
          if (!kept) perChar = true
          report.push(`w=${width}: 回退原始 md${kept ? '' : '（内容丢失!）'}`)
          continue
        }
        if (cols.some((c) => c < 2)) perChar = true
        report.push(`w=${width}: 列宽 [${cols.join(', ')}]`)
      }

      const thin = columnWidths(build(THIN_TABLE, { width: 9 }))
      const styled = renderNodesToString(parseMarkdown(md), {
        width: 9,
        tableFallback: (s) => `«${s}»`,
      })

      return [
        expect(
          '内容宽 > 1 的列不会被挤成 1 字符列（宁可回退原始 md）',
          !perChar,
          JSON.stringify(report),
        ),
        expect(
          '内容本身只有 1 字符宽的列仍可正常画框（不被误伤回退）',
          !!thin && thin.every((c) => c === 1),
          JSON.stringify(thin),
        ),
        expect(
          '回退的原始 md 走 theme.tableFallback（默认不改变外观，可自定义）',
          styled.includes('«\n| ver | dep |'),
          JSON.stringify(plain(styled).split('\n')[0]),
        ),
      ]
    },
  },
  {
    id: 'footnote',
    title: 'footnote：多行正文不缩进，且正文末尾多打印一个锚点',
    problem:
      'renderFootnote 只拼一次 "label + children"，多行正文后续行没有缩进；' +
      'footnote_anchor 节点又会在正文末尾再打印一个 [^1]。',
    width: 40,
    markdown: '正文带脚注[^1]。\n\n[^1]: 脚注正文第一行\n    脚注正文第二行\n',
    checks: ({ lines }) => {
      const text = lines.map(plain)
      const body = text.filter((l) => l.includes('脚注正文'))
      return [
        expect(
          '脚注正文的第二行与第一行对齐（缩进）',
          body.length === 2 && body[1]!.startsWith(' '),
          JSON.stringify(body),
        ),
        expect(
          '脚注正文末尾不再出现 [^1] 锚点',
          !text.some((l) => /脚注正文.*\[\^1\]/.test(l)),
          text.find((l) => /脚注正文.*\[\^1\]/.test(l)),
        ),
      ]
    },
  },
  {
    id: 'list-paragraphs',
    title: '（次要）列表项内多个段落之间没有空行',
    problem:
      'joinBlocks 只在缺少换行时补一个换行，所以列表项内的多个段落只是相邻两行；' +
      '顶层块之间用的是空行（\\n\\n），两处间距不一致。',
    width: 40,
    markdown: '- 第一段。\n\n  第二段。\n\n  第三段。\n',
    checks: ({ lines }) => {
      const text = lines.map(plain)
      const first = text.findIndex((l) => l.includes('第一段'))
      return [
        expect(
          '段落之间留空行（与顶层块间距一致）',
          text[first + 1] === '',
          JSON.stringify(text.slice(first, first + 4)),
        ),
      ]
    },
  },
  {
    id: 'dead-renderers',
    title:
      '（清理项）definition_list / definition_item / table_row 渲染器不可达',
    problem:
      '默认 parser 把 "Term\\n: Definition" 解析成普通段落，definition_list / definition_item 永远不会出现；' +
      'renderTable 直接渲染 cell children，也不会派发 table_row —— defaultRenderers 里有三个死条目。',
    width: 60,
    markdown:
      'Term\n: Definition text\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n',
    checks: ({ nodes }) => {
      const types = nodeTypes(nodes)
      const withOverride = build('| a | b |\n| --- | --- |\n| 1 | 2 |\n', {
        width: 60,
      })
      const overridden = renderNodesToString(
        parseMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |\n'),
        {
          width: 60,
          renderers: { table_row: () => '<<TABLE_ROW>>' },
        },
      )
      return [
        expect(
          '默认 parser 不产生 definition_list / definition_item',
          !types.includes('definition_list') &&
            !types.includes('definition_item'),
          types.join(', '),
        ),
        expect(
          '覆盖 table_row 渲染器后输出不变（该分支不会被派发）',
          overridden === withOverride,
          overridden === withOverride ? '输出一致' : '输出被改写了',
        ),
      ]
    },
    details: ({ nodes }) => [
      `解析出的节点类型: ${nodeTypes(nodes).join(', ')}`,
    ],
  },
  {
    id: 'ink-wrap',
    known: true,
    title: '（已知限制）容器内长段落由 Ink 折行，续行丢失容器前缀',
    problem:
      'renderer 不折段落，超宽的长行交给 Ink 折行；Ink 折出来的续行不带 blockquote 的 "│ " / 列表的缩进。' +
      '要修就得由 renderer 自己按 width - prefix 折段落（会全局改变输出行数），先留作已知限制。' +
      '这里用 Ink 自己的 wrapAnsi 参数模拟折行来观察。',
    width: 40,
    markdown:
      '> 这是一段很长的说明文字，用来观察 blockquote 内的长段落在 Ink 折行之后，续行是否还保留竖线前缀，需要超过终端宽度才能看出来。\n',
    checks: ({ rendered, width }) => {
      const wrapped = wrapAnsi(rendered, width, {
        hard: true,
        trim: false,
      }).split('\n')
      return [
        expect(
          `Ink 折行后每一行都保留 "│ " 前缀（需要 renderer 自己折段落才能做到）`,
          wrapped.every((l) => plain(l).startsWith('│ ')),
          JSON.stringify(wrapped.map(plain)),
        ),
      ]
    },
  },
]
