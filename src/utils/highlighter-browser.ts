import {
  createHighlighter,
  bundledLanguages,
  type HighlighterGeneric,
  type BundledLanguage,
  type BundledTheme,
} from 'shiki/bundle/web'
import type { LanguageRegistration, ThemedToken } from 'shiki'

import { loadCanonicalLanguages } from './canonical-languages'
import type { LanguageLoader } from './canonical-languages'

export type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>

export interface InitHighlighterOptions {
  /**
   * Languages to preload. Defaults to a small common set; pass `'all'` to load
   * every bundled language (the pre-lazy behavior).
   *
   * Unlisted languages are loaded on demand by `ensureLanguage()`.
   */
  preload?: readonly string[] | 'all'
}

const COMMON_LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'jsonc',
  'bash',
  'python',
  'html',
  'css',
  'markdown',
  'yaml',
  'sql',
] as const

let highlighter: Highlighter | null = null
let initPromise: Promise<void> | null = null

const ensureHighlighter = async (options?: InitHighlighterOptions) => {
  if (highlighter) return
  if (!initPromise) {
    const preload = options?.preload ?? COMMON_LANGUAGES
    const ids = preload === 'all' ? undefined : preload
    initPromise = loadCanonicalLanguages(bundledLanguages, ids)
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

export const initHighlighter = (options?: InitHighlighterOptions) =>
  ensureHighlighter(options)

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

const languageLoads = new Map<string, Promise<void>>()

/**
 * Load a language grammar into the shared highlighter on demand.
 *
 * Resolves to `true` when the language became available during this call (so
 * callers can trigger a re-render), and `false` when it was already loaded when
 * the call started or is unknown.
 *
 * Note: injection grammars (e.g. `ts-tags` / `lit`) only take effect when loaded
 * at highlighter creation; adding them here registers the grammar but does not
 * apply its injections to already-compiled target scopes.
 */
export const ensureLanguage = (lang: string): Promise<boolean> => {
  const alreadyLoaded =
    highlighter?.getLoadedLanguages().includes(lang) ?? false
  if (alreadyLoaded) return Promise.resolve(false)

  let pending = languageLoads.get(lang)
  if (!pending) {
    pending = (async (): Promise<void> => {
      await ensureHighlighter()
      const h = highlighter!
      if (h.getLoadedLanguages().includes(lang)) return

      const loader = (
        bundledLanguages as Record<string, LanguageLoader | undefined>
      )[lang]
      if (!loader) return

      try {
        const registrations: LanguageRegistration[] = (await loader()).default
        if (registrations.length > 0) await h.loadLanguage(...registrations)
      } catch {
        // Unknown or broken grammar — leave it unhighlighted.
      }
    })()
    languageLoads.set(lang, pending)
  }

  return pending.then(() => highlighter!.getLoadedLanguages().includes(lang))
}

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
