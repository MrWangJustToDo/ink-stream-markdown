import { render } from 'ink'

import { createParser, parseMarkdown, renderNodesToString } from '../src'
import type { GetMarkdownOptions } from '../src'
import {
  parserBehaviorCases,
  plain,
  strongTexts,
  ParserBehaviorExample,
} from './parser-behavior'

let failures = 0
const fail = (id: string, message: string) => {
  failures++
  console.log(`❌ [${id}] ${message}`)
}

console.log('parser 行为检查（针对 stream-markdown-parser ^1.2.22）\n')

for (const testCase of parserBehaviorCases) {
  const nodes = parseMarkdown(testCase.markdown)
  const rendered = plain(renderNodesToString(nodes))
  const problem = testCase.check(nodes, rendered)

  if (problem) {
    fail(testCase.id, problem)
  } else {
    console.log(`✅ [${testCase.id}] ${testCase.title}`)
  }
  console.log(
    `   输入 ${JSON.stringify(testCase.markdown)} → 渲染 ${JSON.stringify(rendered)}`,
  )
}

// 流式过程中仍丢弃尾部纯标记，final 解析才保留。
{
  const id = 'streaming-vs-final-marker'
  const mid = plain(
    renderNodesToString(parseMarkdown('text *', undefined, { final: false })),
  )
  const done = plain(renderNodesToString(parseMarkdown('text *')))
  if (mid !== 'text' || done !== 'text *') {
    fail(
      id,
      `流式应为 "text"、final 应为 "text *"；实际 mid=${JSON.stringify(mid)} final=${JSON.stringify(done)}`,
    )
  } else {
    console.log(`✅ [${id}] 流式丢弃尾部标记、final 保留`)
  }
}

// cjkFriendly:false 通过现有 parserOptions 透传，回到 CommonMark 配对。
{
  const id = 'cjk-friendly-opt-out'
  const markdown = '说明**「A」**。和**「B」**。'
  const options: GetMarkdownOptions & { cjkFriendly?: boolean } = {
    cjkFriendly: false,
  }
  const actual = strongTexts(createParser(options).parse(markdown))
  if (JSON.stringify(actual) === JSON.stringify(['「A」', '「B」'])) {
    fail(
      id,
      `cjkFriendly:false 应回到旧 CommonMark 配对，实际仍为 ${JSON.stringify(actual)}`,
    )
  } else {
    console.log(
      `✅ [${id}] cjkFriendly:false 可透传（strong=${JSON.stringify(actual)}）`,
    )
  }
}

if (failures > 0) {
  console.log(
    `\n失败 ${failures} 项：若当前仍是 stream-markdown-parser 1.2.16，这些就是升级前的预期差异；升级到 ^1.2.21 后应全部通过。`,
  )
  process.exitCode = 1
} else {
  console.log('\n✅ 全部通过（stream-markdown-parser 1.2.22 行为符合预期）')
}

// TTY 下额外渲染 Ink 组件看真实效果。
if (process.stdout.isTTY) {
  render(<ParserBehaviorExample width={80} />, { exitOnCtrlC: false })
}
