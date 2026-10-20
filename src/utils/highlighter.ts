import {
  createHighlighter,
  bundledLanguages,
  type HighlighterGeneric,
  type BundledLanguage,
  type BundledTheme,
} from 'shiki/bundle-full.mjs'
import type { ThemedToken } from 'shiki'

import { loadCanonicalLanguages } from './canonical-languages'

export type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>

// Lazily initialized Shiki highlighter (avoids top-level await for CJS compat)
let highlighter: Highlighter | null = null
let initPromise: Promise<void> | null = null

const ensureHighlighter = async () => {
  if (highlighter) return
  if (!initPromise) {
    initPromise = loadCanonicalLanguages(bundledLanguages)
      .then((langs) =>
        createHighlighter({
          themes: ['github-dark'],
          langs,
        }),
      )
      .then((h) => {
        highlighter = h
      })
  }
  await initPromise
}

export const initHighlighter = ensureHighlighter

/**
 * Return the shared Shiki highlighter, initializing it first if needed.
 *
 * The instance is a singleton: callers can add themes/languages or run
 * `codeToHast`/`codeToTokens` against it without creating a second engine.
 */
export const getHighlighter = async (): Promise<Highlighter> => {
  await ensureHighlighter()
  return highlighter!
}

const tokenCache = new Map<string, ThemedToken[][]>()
const MAX_CACHE = 128

/**
 * Synchronously highlight code and return tokens.
 * Results are LRU-cached by (lang, code) to avoid re-tokenizing
 * identical code blocks across streaming re-renders.
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

/** Clear the Shiki token cache (e.g. to free memory after large renders). */
export const clearHighlightCache = (): void => {
  tokenCache.clear()
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
