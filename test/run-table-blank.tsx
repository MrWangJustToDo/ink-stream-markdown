import stripAnsi from 'strip-ansi'
import { render } from 'ink'

import { parseMarkdown, renderNodesToString } from '../src'
import {
  mdTableBlankAbove,
  TableBlankAboveExample,
  TABLE_BLANK_WIDTHS,
  blankLinesAboveTables,
} from './table-blank-above'

/** 打印每张表格顶部边框附近的行，标出上方空行数。 */
const report = (width: number) => {
  const lines = renderNodesToString(parseMarkdown(mdTableBlankAbove), {
    width,
  })
    .split('\n')
    .map(stripAnsi)
  const blanks = blankLinesAboveTables(lines.join('\n'))

  console.log(`\n可用宽度 ${width}`)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('┌')) {
      console.log(`  ┌─ 表格（上方空行 ${blanks[0] ?? '?'}）`)
      blanks.shift()
      for (
        let j = Math.max(0, i - 3);
        j <= Math.min(lines.length - 1, i + 1);
        j++
      ) {
        console.log(`   ${lines[j] === '' ? '·' : lines[j]}`)
      }
      console.log('  ──────────')
    }
  }
  console.log(
    `  上方空行数组：${blankLinesAboveTables(lines.join('\n')).join(', ')}`,
  )
}

let failures = 0
for (const width of TABLE_BLANK_WIDTHS) {
  report(width)
  const rendered = renderNodesToString(parseMarkdown(mdTableBlankAbove), {
    width,
  })
  const bad = blankLinesAboveTables(rendered).filter((n) => n > 1)
  if (bad.length > 0) {
    failures++
    console.log(`❌ width=${width} 有表格上方空行 >1：${bad.join(', ')}`)
  }
}

if (failures > 0) {
  console.log(`\n失败：${failures} 个宽度存在「表格上方空行 >1」`)
  process.exitCode = 1
} else {
  console.log('\n✅ 所有宽度下表格上方空行均 ≤ 1')
}

// TTY 下额外渲染 Ink 组件看真实效果
if (process.stdout.isTTY) {
  render(<TableBlankAboveExample width={100} />, { exitOnCtrlC: false })
}
