import { md2 as md } from './data'
import { StreamMarkdown } from '../src'

export const Example = () => {
  return <StreamMarkdown>{md}</StreamMarkdown>
}
