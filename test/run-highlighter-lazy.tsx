import { performance } from 'node:perf_hooks'

import { ensureLanguage, getHighlighter, initHighlighter } from '../src'
import { highlightCode } from '../src/utils/highlighter'

const rustCode = 'fn main() {\n  println!("hi");\n}\n'

let failures = 0
const check = (ok: boolean, label: string, detail = '') => {
  if (ok) {
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failures++
    console.log(`❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const main = async () => {
  const startedAt = performance.now()
  await initHighlighter()
  const initMs = performance.now() - startedAt

  const highlighter = await getHighlighter()
  const langs = highlighter.getLoadedLanguages()

  console.log(
    `默认初始化: ${initMs.toFixed(0)}ms | 已加载语言: ${langs.length}\n`,
  )

  check(initMs < 1500, 'init < 1500ms（懒加载生效）', `${initMs.toFixed(0)}ms`)
  check(langs.includes('typescript'), '预加载集包含 typescript')
  check(!langs.includes('rust'), '默认未加载 rust')

  check(
    highlightCode(rustCode, 'rust').length === 0,
    'rust 在补载前不返回 token',
  )

  const first = await ensureLanguage('rust')
  const second = await ensureLanguage('rust')
  check(first === true, 'ensureLanguage("rust") 首次返回 true')
  check(second === false, 'ensureLanguage("rust") 二次返回 false（幂等）')
  check(highlighter.getLoadedLanguages().includes('rust'), '补载后 rust 已注册')
  check(highlightCode(rustCode, 'rust').length > 0, '补载后可高亮 rust')

  check(
    (await ensureLanguage('does-not-exist')) === false,
    '未知语言返回 false',
  )
}

main()
  .then(() => {
    if (failures > 0) {
      console.log(`\n失败 ${failures} 项`)
      process.exitCode = 1
    } else {
      console.log('\n✅ 全部通过（懒加载行为符合预期）')
    }
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
