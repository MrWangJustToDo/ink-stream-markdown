import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'

import type {
  ParsedNode,
  ParseOptions,
  GetMarkdownOptions,
} from 'stream-markdown-parser'

// Common emoji patterns used as visual list markers
// Matches lines starting with emoji followed by space (with optional leading whitespace)
const EMOJI_BULLET_REGEX =
  /^(\s*)([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3030}\u{303D}\u{3297}\u{3299}][\uFE0F]?)\s+(.+)$/gmu

/**
 * Preprocess markdown to convert emoji-prefixed lines into proper unordered lists.
 *
 * Converts patterns like:
 *   ✅ No urgent updates needed
 *   ⚠️ Monitor internal packages
 *
 * Into:
 *   - ✅ No urgent updates needed
 *   - ⚠️ Monitor internal packages
 */
const preprocessEmojiLists = (markdown: string): string => {
  const blocks = markdown.split(/\n\n+/)

  const processedBlocks = blocks.map((block) => {
    const lines = block.split('\n')
    let emojiLineCount = 0
    let hasNonEmojiLine = false

    for (const line of lines) {
      EMOJI_BULLET_REGEX.lastIndex = 0
      if (EMOJI_BULLET_REGEX.test(line)) {
        emojiLineCount++
      } else if (line.trim() !== '') {
        hasNonEmojiLine = true
      }
    }

    if (emojiLineCount >= 2 && !hasNonEmojiLine) {
      EMOJI_BULLET_REGEX.lastIndex = 0
      return block.replace(EMOJI_BULLET_REGEX, '$1- $2 $3')
    }

    return block
  })

  return processedBlocks.join('\n\n')
}

/**
 * Parse markdown with emoji-list preprocessing.
 *
 * This is a pure parsing step — no syntax highlighting is performed here.
 * Highlighting is handled at render time by `renderCodeBlock`, which
 * either uses the built-in Shiki pipeline or a user-supplied `highlightCode`.
 *
 * @param markdown - The markdown content to parse
 * @param md - Optional MarkdownIt instance (created if not provided)
 * @param parseOptions - Optional per-parse options (token transforms, link validation, etc.)
 * @returns Array of parsed nodes
 */
export const parseMarkdown = (
  markdown: string,
  md?: ReturnType<typeof getMarkdown>,
  parseOptions?: ParseOptions,
): ParsedNode[] => {
  const instance = md ?? getMarkdown()
  const preprocessed = preprocessEmojiLists(markdown)
  return parseMarkdownToStructure(preprocessed, instance, parseOptions)
}

/**
 * Create a memoized parser instance for use in React components.
 *
 * @param parserOptions - Options for the markdown-it instance (plugins, math, containers, etc.)
 */
export const createParser = (parserOptions?: GetMarkdownOptions) => {
  const instance = getMarkdown(undefined, parserOptions)

  return {
    instance,
    parse: (markdown: string, parseOptions?: ParseOptions) =>
      parseMarkdown(markdown, instance, parseOptions),
  }
}
