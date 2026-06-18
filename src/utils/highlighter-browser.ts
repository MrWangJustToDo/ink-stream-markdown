import {
  createHighlighter,
  bundledLanguages,
  type HighlighterGeneric,
  type BundledLanguage,
  type BundledTheme,
} from 'shiki/bundle/web'
import type { ThemedToken } from 'shiki'

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

const tokenCache = new Map<string, ThemedToken[][]>()
const MAX_CACHE = 128

/**
 * Synchronously highlight code and return tokens (browser version).
 * Uses shiki/bundle/web which loads grammars via fetch instead of fs.
 */
export const highlightCode = (code: string, lang?: string): ThemedToken[][] => {
  if (!highlighter || !lang || !lang.trim()) {
    return []
  }

  const key = `${lang}\0${code}`
  const cached = tokenCache.get(key)
  if (cached) return cached

  try {
    const loadedLangs = highlighter.getLoadedLanguages()
    if (!loadedLangs.includes(lang)) {
      return []
    }

    const tokens = highlighter.codeToTokens(code, {
      lang: lang as Parameters<typeof highlighter.codeToTokens>[1]['lang'],
      theme: 'github-dark',
    })
    const result = tokens.tokens
    tokenCache.set(key, result)
    if (tokenCache.size > MAX_CACHE) {
      tokenCache.delete(tokenCache.keys().next().value!)
    }
    return result
  } catch {
    return []
  }
}

export const clearHighlightCache = (): void => {
  tokenCache.clear()
}

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
