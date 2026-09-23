import { Box, Text, render } from 'ink'

import { parseMarkdown, renderNodesToString, StreamMarkdown } from '../src'
import { issues, lineWidth } from './issues'

const args = process.argv.slice(2)
const selected = issues.filter(
  (issue) => args.length === 0 || args.includes(issue.id),
)

if (selected.length === 0) {
  console.log(`没有匹配的用例；可用: ${issues.map((i) => i.id).join(', ')}`)
  process.exit(1)
}

const printLines = (lines: string[], width: number) => {
  for (const line of lines) {
    const w = lineWidth(line)
    console.log(`${w > width ? '!' : ' '}${String(w).padStart(3)}| ${line}`)
  }
}

let total = 0
let failed = 0
let knownFailed = 0

for (const issue of selected) {
  const nodes = parseMarkdown(issue.markdown)
  const rendered = renderNodesToString(nodes, { width: issue.width })
  const lines = rendered.split('\n')
  const ctx = {
    markdown: issue.markdown,
    width: issue.width,
    nodes,
    rendered,
    lines,
  }

  console.log(`\n${'━'.repeat(72)}`)
  console.log(`[${issue.id}] ${issue.title}`)
  console.log(`现象: ${issue.problem}`)
  console.log(`\n用例 (width=${issue.width}，! 标记超过可用宽度的行):`)
  printLines(lines, issue.width)

  if (issue.control) {
    const controlLines = renderNodesToString(
      parseMarkdown(issue.control.markdown),
      { width: issue.width },
    ).split('\n')
    console.log(`\n${issue.control.title}:`)
    printLines(controlLines, issue.width)
  }

  for (const detail of issue.details?.(ctx) ?? []) {
    console.log(`\n${detail}`)
  }

  console.log('\n检查:')
  for (const check of issue.checks(ctx)) {
    total++
    if (!check.ok) {
      if (issue.known) knownFailed++
      else failed++
    }
    const mark = check.ok ? '✅' : issue.known ? '⚠️' : '❌'
    const note = !check.ok && issue.known ? '（已知限制）' : ''
    const actual = check.ok || !check.actual ? '' : `   实测: ${check.actual}`
    console.log(`  ${mark} ${check.name}${note}${actual}`)
  }
}

console.log(`\n${'━'.repeat(72)}`)
console.log(
  `汇总: ${selected.length} 个用例 / ${total} 项检查，` +
    `失败 ${failed} 项（❌ = 待修问题），已知限制 ${knownFailed} 项（⚠️）`,
)

if (failed > 0) {
  process.exitCode = 1
}

// 非交互时只输出上面的报告；TTY 下额外渲染 Ink 组件看真实排版
if (process.stdout.isTTY) {
  render(
    <>
      {selected.map((issue) => (
        <Box key={issue.id} flexDirection="column" marginBottom={1}>
          <Text bold color="cyan">
            {`[${issue.id}] ${issue.title}`}
          </Text>
          <StreamMarkdown theme={{ width: issue.width }}>
            {issue.markdown}
          </StreamMarkdown>
        </Box>
      ))}
    </>,
    { exitOnCtrlC: false },
  )
}
