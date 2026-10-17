import { Text } from 'ink'

import { StreamMarkdown } from '../src'

/**
 * 浮现案例：**表格上方空了两行**（应为一行）。
 *
 * 用户反馈：某些情况下表格上方会多一个空行。这段 markdown 是用户粘贴的
 * 原始文本（一段正文 + 一个 `##` 标题 + 一张表格）。
 *
 * 验证点：每一张渲染出来的表格，其上方连续空行数必须 **≤ 1**（顶层 join 是
 * `\n\n`，即段落/标题与表格之间只空一行）。修复前的疑似来源：某处 join 没把
 * 表格自带的前导 `\n` 清掉，`正文\n\n` + `\n┌…` 会变成两个空行。
 */
export const mdTableBlankAbove = `我把整条渲染链路都查了一遍，常见结构在字符串层都**只有 1 个空行**，没有复现出来——需要你给精确输入。

## 我已排除的（都验证为 1 空行）

| 场景 | 表格上方空行 |
| --- | --- |
| 顶层 段落 → 表格 | 1 |
| 列表项 段落 → 表格（\`-\` 和 \`1. \` 都试了） | 1 |
| 标题 → 表格 | 1 |
| 源码里 2/3 个空行 → 表格 | 1（parser 会折叠） |
| 空行是"空格/tab"或 CRLF | 1 |
| 引用/提醒/vmr 容器内 | 1（\`renderBlockChildren\`/\`joinBlocks\` 会 trim） |
| 顶层 \`renderNodesToString\` | 1（每节点 \`replace(/^\\n+|\\n+$/g,'')\` + \`\\n\\n\` 拼接） |

链路：\`parseMarkdown → renderNodesToString →（可选 clampToHeight，不插空行）→ <Text>\`。每处 join 都会把表格自带的前导 \`\\n\` 清掉，所以理论上不会有 2 空行。

我唯一没跑过的真实分支是 **Ink \`<Text>\` + 具体输入**（它理论上只是原样打印字符串）。

## 我需要你提供（好按仓库惯例先做复现）

1. **那段表格的原始 markdown 源码**（直接贴出来，不用格式化）；
2. 渲染方式：是 \`<StreamMarkdown>\` 组件、还是直接 \`renderNodesToString\`？有没有设 \`streaming\` / \`height\`？
3. 当时的终端宽度（大概即可）。

拿到源码我先跑复现用例确认，再决定怎么修（大概率是要么某个 join 没 trim，要么 parser 对某种结构产出了多余空段落节点）。
`

/** 在这些宽度下检查：宽一点画框、窄一点可能回退。 */
export const TABLE_BLANK_WIDTHS = [120, 100, 80, 60]

/**
 * 返回每张渲染表格顶部边框上方的连续空行数。
 * 没画框（回退为原始 markdown）时这一行不存在，不计入。
 */
export const blankLinesAboveTables = (rendered: string): number[] => {
  const lines = rendered.split('\n')
  const result: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.trimStart().startsWith('┌')) continue
    let blanks = 0
    for (let j = i - 1; j >= 0 && lines[j]!.trim() === ''; j--) blanks++
    result.push(blanks)
  }
  return result
}

export const TableBlankAboveExample = ({
  width,
}: {
  width?: number
} = {}) => (
  <>
    <Text bold color="cyan">
      {`表格上方空行检查 · theme.width=${width ?? 'auto'}`}
    </Text>
    <StreamMarkdown theme={width ? { width } : undefined}>
      {mdTableBlankAbove}
    </StreamMarkdown>
  </>
)
