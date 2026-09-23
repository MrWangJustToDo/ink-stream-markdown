import stripAnsi from 'strip-ansi'
import stringWidth from 'string-width'
import { Text, render } from 'ink'

import { parseMarkdown, renderNodesToString } from '../src'
import {
  mdNestedTable,
  NestedTableExample,
  NESTED_TABLE_NARROW_WIDTH,
  NESTED_TABLE_WIDTH,
} from './nested-table'

/**
 * 打印每行实际显示宽度 vs 可用宽度：`!` 标出超宽的行。
 * 只有长段落和回退出来的原始 md 行应该出现在这里，表格框线不应超宽。
 */
const report = (width: number) => {
  const lines = renderNodesToString(parseMarkdown(mdNestedTable), {
    width,
  }).split('\n')
  const ruler = Array.from({ length: width }, (_, i) =>
    String((i + 1) % 10),
  ).join('')
  console.log(`\n可用宽度 ${width}`)
  console.log(ruler)
  for (const [i, line] of lines.entries()) {
    const w = stringWidth(stripAnsi(line))
    console.log(`${w > width ? '!' : ' '}${String(i + 1).padStart(3)}|${line}`)
  }
  const over = lines.filter((l) => stringWidth(stripAnsi(l)) > width).length
  console.log(`超宽行：${over} / ${lines.length}`)
}

report(NESTED_TABLE_WIDTH)
report(NESTED_TABLE_NARROW_WIDTH)

// 管道/重定向时只输出上面的测量结果，TTY 下额外渲染 Ink 组件看真实折行
if (process.stdout.isTTY) {
  render(
    <>
      <NestedTableExample width={NESTED_TABLE_WIDTH} />
      <Text> </Text>
      <NestedTableExample width={NESTED_TABLE_NARROW_WIDTH} />
    </>,
    { exitOnCtrlC: false },
  )
}
