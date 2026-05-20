import {
  createHighlighter,
  bundledLanguages,
  type HighlighterGeneric,
  type BundledLanguage,
  type BundledTheme,
} from 'shiki/bundle-full.mjs'
import type { ThemedToken } from 'shiki'

// Lazily initialized Shiki highlighter (avoids top-level await for CJS compat)
let highlighter: HighlighterGeneric<BundledLanguage, BundledTheme> | null = null
let initPromise: Promise<void> | null = null

const ensureHighlighter = async () => {
  if (highlighter) return
  if (!initPromise) {
    initPromise = createHighlighter({
      themes: ['github-dark'],
      langs: Object.values(bundledLanguages),
    }).then((h) => {
      highlighter = h
    })
  }
  await initPromise
}

export const initHighlighter = ensureHighlighter

/**
 * Synchronously highlight code and return tokens.
 * Used for source-side highlighting when content is complete.
 */
export const highlightCode = (code: string, lang?: string): ThemedToken[][] => {
  if (!highlighter || !lang || !lang.trim()) {
    return []
  }

  try {
    const loadedLangs = highlighter.getLoadedLanguages()
    if (!loadedLangs.includes(lang)) {
      return []
    }

    const tokens = highlighter.codeToTokens(code, {
      lang: lang as Parameters<typeof highlighter.codeToTokens>[1]['lang'],
      theme: 'github-dark',
    })
    return tokens.tokens
  } catch {
    return []
  }
}

/**
 * Check if a language is supported by the highlighter.
 */
export const isLanguageSupported = (lang: string): boolean => {
  if (!highlighter) return false
  try {
    const languages = highlighter.getLoadedLanguages()
    return languages.includes(lang)
  } catch {
    return false
  }
}

export { highlighter }
