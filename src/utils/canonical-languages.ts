import type { LanguageRegistration } from 'shiki'

type LanguageLoader = () => Promise<{ default: LanguageRegistration[] }>

/**
 * Load one registration set per primary grammar, collapsing redundant aliases.
 *
 * `bundledLanguages` maps every id and alias (plus derived grammars like `ts`,
 * `edge`, `glimmer-ts`, `ts-tags`, …) to a loader. Grouping them by each
 * language's OWN grammar — the *last* registration — keeps distinct languages
 * apart: for embedded grammars the first registration is usually another
 * language (e.g. `html` → `source.js`, `cpp` → `source.regexp.python`), so
 * keying on it would collapse unrelated languages together. The last
 * registration is the language's primary grammar (`handlebars` →
 * `text.html.handlebars`). For a scope that several ids share (aliases like
 * `js`/`cjs`/`mjs`, or `ts`/`cts`/`mts`), prefer the entry whose id matches
 * the primary grammar name, else keep the first.
 *
 * The flattened result is deduped by scope so repeated embedded grammars (the
 * `ts-tags` loader embeds `source.ts` five times) load only once.
 */
export const loadCanonicalLanguages = async (
  bundledLanguages: Record<string, LanguageLoader>,
): Promise<LanguageRegistration[]> => {
  const loaded = await Promise.all(
    Object.entries(bundledLanguages).map(async ([id, load]) => ({
      id,
      registrations: (await load()).default,
    })),
  )

  const byScope = new Map<
    string,
    { id: string; registrations: LanguageRegistration[] }
  >()
  for (const entry of loaded) {
    const own = entry.registrations[entry.registrations.length - 1]!
    const key = own.scopeName ?? own.name
    const current = byScope.get(key)
    const isCanonical = entry.id === own.name
    const currentIsCanonical =
      current !== undefined &&
      current.id ===
        current.registrations[current.registrations.length - 1]!.name
    if (!current || (isCanonical && !currentIsCanonical)) {
      byScope.set(key, entry)
    }
  }

  const uniqueByScope = new Map<string, LanguageRegistration>()
  for (const { registrations } of byScope.values()) {
    for (const registration of registrations) {
      const key = registration.scopeName ?? registration.name
      if (!uniqueByScope.has(key)) uniqueByScope.set(key, registration)
    }
  }
  return [...uniqueByScope.values()]
}
