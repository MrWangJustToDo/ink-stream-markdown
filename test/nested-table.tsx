import { Text } from 'ink'

import { StreamMarkdown } from '../src'

/**
 * 浮现案例：**列表项里嵌 table**。
 *
 * 修复前：`renderTable` 用终端全宽算列宽，没有扣掉列表缩进与标记（`• ` /
 * `1. `）；`renderList` 又只在整块内容的首行拼前缀。结果是：
 *   - 表格首行被拼到同级段落末尾、末行被拼上后续段落（`└──┘要么钉死…`）；
 *   - 表格按全宽布局，加前缀后超宽 → Ink 二次折行打散边框；
 *   - 续行没有缩进 → 与首行左边框错位。
 *
 * 修复后：块级子节点之间补换行；表格宽度扣除 `ctx.prefix`（列表缩进 +
 * 标记宽度）；列表项内所有行都有悬挂缩进。文档末尾的顶层 table 是对照组。
 */
export const mdNestedTable = `### 阻塞项

1. 版本闸门。仓库是 @tanstack/ai@0.54.0，npm 上 @tanstack/ai-acp 的 peer 依赖：

   | ai-acp | peer @tanstack/ai |
   | --- | --- |
   | 0.3.10 | ^0.54.0 ← 唯一匹配 |
   | 0.3.11 | ^0.55.0 |
   | 0.3.13 / 0.3.14 | ^0.57.0 / ^0.58.0 |

   要么钉死旧版本，要么整体升 core/app/node/im-bridge。

- 无序列表里的表格：

  - 更深一层列表里的表格：

    | 列 A | 列 B |
    | --- | --- |
    | 单元格内容长一点以触发换行 | 另一列内容也长一点 |

对照：顶层 table（无前缀，宽度正确）

| ai-acp | peer @tanstack/ai |
| --- | --- |
| 0.3.10 | ^0.54.0 ← 唯一匹配 |
| 0.3.13 / 0.3.14 | ^0.57.0 / ^0.58.0 |
`

/** 固定列宽，便于在任何终端下复现。 */
export const NESTED_TABLE_WIDTH = 60

/** 列宽极其紧张的场景：挤不下时才回退为原始 markdown。 */
export const NESTED_TABLE_NARROW_WIDTH = 12

export const NestedTableExample = ({
  width = NESTED_TABLE_WIDTH,
}: {
  width?: number
} = {}) => (
  <>
    <Text bold color="cyan">
      {`列表项内 table · theme.width=${width}`}
    </Text>
    <StreamMarkdown theme={{ width }}>{mdNestedTable}</StreamMarkdown>
    <Text dimColor>↑ 表格应与标记对齐且不超宽；放不下时回退为原始 md</Text>
  </>
)
