import { useEffect, useState } from 'react'
import { Text } from 'ink'
import { StreamMarkdown } from '../src'
import { md2 } from './data'

const CHUNKS = md2.split('\n\n')

export const FoldExample = () => {
  const [count, setCount] = useState(1)

  useEffect(() => {
    if (count >= CHUNKS.length) return
    const timer = setTimeout(() => setCount((c) => c + 1), 60)
    return () => clearTimeout(timer)
  }, [count])

  const streaming = count < CHUNKS.length
  const content = CHUNKS.slice(0, count).join('\n\n')

  return (
    <>
      <Text bold color="cyan">
        streaming={String(streaming)} · chunk {count}/{CHUNKS.length}
      </Text>
      <StreamMarkdown height={12} streaming={streaming}>
        {content}
      </StreamMarkdown>
      <Text dimColor>
        {streaming
          ? 'streaming: 增量解析 + 窗口锚定尾部（指示器在顶部）'
          : '完成: 一次性解析 + 从头渲染（指示器在底部）'}
      </Text>
    </>
  )
}