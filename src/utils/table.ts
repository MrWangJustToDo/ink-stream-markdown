import wrapAnsi from 'wrap-ansi'
import stringWidth from 'string-width'
import stripAnsi from 'strip-ansi'

import type { TableOptions, TableBorderChars } from '../theme'

const DEFAULT_MIN_COL_WIDTH = 5
export const DEFAULT_CELL_PADDING = 1

const DEFAULT_BORDER: Required<TableBorderChars> = {
  topLeft: '\u250C',
  topRight: '\u2510',
  bottomLeft: '\u2514',
  bottomRight: '\u2518',
  horizontal: '\u2500',
  vertical: '\u2502',
  teeDown: '\u252C',
  teeUp: '\u2534',
  teeRight: '\u251C',
  teeLeft: '\u2524',
  cross: '\u253C',
}

export type CellAlign = 'left' | 'right' | 'center'

function padAligned(
  text: string,
  textWidth: number,
  width: number,
  align: CellAlign,
): string {
  const gap = width - textWidth
  if (gap <= 0) return text
  switch (align) {
    case 'right':
      return ' '.repeat(gap) + text
    case 'center': {
      const left = Math.floor(gap / 2)
      return ' '.repeat(left) + text + ' '.repeat(gap - left)
    }
    default:
      return text + ' '.repeat(gap)
  }
}

function wrapCell(text: string, width: number, hard: boolean): string[] {
  if (width <= 0) return [text]
  const trimmed = text.trimEnd()
  const wrapped = wrapAnsi(trimmed, width, {
    hard,
    wordWrap: true,
    trim: false,
  })
  const lines = wrapped.split('\n').filter((l) => l.length > 0)
  return lines.length > 0 ? lines : ['']
}

// CJK / fullwidth glyphs are breakable anywhere: `wrap-ansi` splits them even
// without `hard`, so they must not make a column as wide as the whole run.
// Script properties cover astral planes (Ext-B+ Han, Kana Supplement, Hangul
// Jamo Ext-B); the explicit ranges add the Common-script punctuation and
// fullwidth forms that have no CJK script of their own.
const CJK_CHAR =
  /[\u2E80-\u33FF\uFE10-\uFE1F\uFE30-\uFE4F\uFF00-\uFFEF\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\p{Script=Yi}]/u

function longestWordWidth(text: string, minWidth: number): number {
  const plain = stripAnsi(text)
  let longest = minWidth
  for (const word of plain.split(/\s+/)) {
    if (!word) continue
    if (CJK_CHAR.test(word)) {
      // Only the ASCII runs inside a mixed token are unbreakable; a single CJK
      // glyph is at most two columns wide.
      for (const run of word.split(CJK_CHAR)) {
        longest = Math.max(longest, stringWidth(run))
      }
      longest = Math.max(longest, 2)
    } else {
      longest = Math.max(longest, stringWidth(word))
    }
  }
  return longest
}

/**
 * Allocate `space` across columns in proportion to their content width, never
 * giving a column less than its longest unbreakable run.
 *
 * When a floor exceeds a column's proportional share, that column is fixed at
 * its floor and the rest of the budget is shared by the remaining columns, so
 * narrow columns do not stay pinned at their minimum while a wide one takes
 * everything.
 */
const allocateProportional = (
  weights: number[],
  floors: number[],
  space: number,
): number[] => {
  const widths = new Array<number>(weights.length).fill(0)
  const active = new Set(weights.map((_, i) => i))
  let budget = space
  let weightSum = weights.reduce((s, w) => s + w, 0)

  let changed = true
  while (changed && active.size > 0) {
    changed = false
    for (const i of [...active]) {
      const share = weightSum > 0 ? (budget * weights[i]!) / weightSum : 0
      if (share < floors[i]!) {
        widths[i] = floors[i]!
        budget -= floors[i]!
        weightSum -= weights[i]!
        active.delete(i)
        changed = true
      }
    }
  }

  if (active.size === 0) return widths

  const ids = [...active]
  const exact = ids.map((i) =>
    weightSum > 0 ? (budget * weights[i]!) / weightSum : budget / ids.length,
  )
  let assigned = 0
  ids.forEach((i, k) => {
    const width = Math.min(weights[i]!, Math.floor(exact[k]!))
    widths[i] = width
    assigned += width
  })

  // Hand the rounding remainder to the largest fractional parts.
  let rest = Math.max(0, budget - assigned)
  const order = ids
    .map((i, k) => ({ i, frac: exact[k]! - Math.floor(exact[k]!) }))
    .sort((a, b) => b.frac - a.frac)
  while (rest > 0) {
    let progressed = false
    for (const { i } of order) {
      if (rest <= 0) break
      if (widths[i]! < weights[i]!) {
        widths[i]!++
        rest--
        progressed = true
      }
    }
    if (!progressed) break
  }
  return widths
}

/**
 * Calculate column widths that fit within availableWidth.
 *
 * Widths track the content: when the table does not fit, every column shrinks
 * in proportion to its own content width, with a floor at its longest
 * unbreakable run.
 */
export function calculateColumnWidths(
  headers: string[],
  rows: string[][],
  availableWidth: number,
  minColWidth = DEFAULT_MIN_COL_WIDTH,
): { widths: number[]; needsHardWrap: boolean } {
  const numCols = headers.length
  // Never budget below one character per column: less than that cannot be drawn
  // at all (the caller falls back to the markdown source instead).
  const space = Math.max(availableWidth, numCols)

  const minWidths = headers.map((h, col) => {
    let w = longestWordWidth(h, minColWidth)
    for (const row of rows) {
      if (row[col]) w = Math.max(w, longestWordWidth(row[col], minColWidth))
    }
    return w
  })

  // Natural (unfloored) content width per column, measured in the same pass as
  // the ideal widths — `stringWidth` is expensive, so one pass per column only.
  const naturalWidths: number[] = []
  const idealWidths = headers.map((h, col) => {
    let w = stringWidth(h)
    for (const row of rows) {
      if (row[col]) w = Math.max(w, stringWidth(row[col]))
    }
    naturalWidths[col] = w
    return Math.max(w, minColWidth)
  })

  const totalIdeal = idealWidths.reduce((s, w) => s + w, 0)
  const totalMin = minWidths.reduce((s, w) => s + w, 0)

  if (totalIdeal <= space) {
    return { widths: idealWidths, needsHardWrap: false }
  }

  if (totalMin <= space) {
    const widths = allocateProportional(idealWidths, minWidths, space)
    return {
      widths,
      // A column narrower than its content may hold a run with no break
      // opportunities (CJK text has no spaces), so wrapping must be able to
      // split it.
      needsHardWrap: widths.some((w, i) => w < naturalWidths[i]!),
    }
  }

  // Space is tighter than the natural column widths: shrink all columns
  // proportionally, hard-wrapping where they end up narrower than one word.
  const scale = space / totalMin
  const floored = minWidths.map((w) =>
    Math.max(Math.floor(w * scale), minColWidth),
  )
  if (floored.reduce((s, w) => s + w, 0) <= space) {
    return { widths: floored, needsHardWrap: true }
  }

  // Keeping every column at `minColWidth` does not fit: squeeze down to a
  // readable minimum — a column may only end up narrower than `minColWidth`
  // when its content is narrower to begin with. Below that the cells would be
  // shredded (one or two characters per line), which is less useful than the
  // markdown source, so the caller falls back to it (the squeezed widths may
  // overrun the budget).
  const floors = naturalWidths.map((natural) =>
    Math.max(Math.min(minColWidth, natural), 1),
  )
  const widths = minWidths.map((w, i) =>
    Math.max(Math.floor(w * scale), floors[i]!),
  )
  let diff = space - widths.reduce((s, w) => s + w, 0)
  while (diff > 0) {
    const deficit = widths.map((w, i) => minWidths[i]! - w)
    widths[deficit.indexOf(Math.max(...deficit))]!++
    diff--
  }
  while (diff < 0) {
    // Shrink the widest column that is still above its floor
    let widest = -1
    for (let i = 0; i < widths.length; i++) {
      if (
        widths[i]! > floors[i]! &&
        (widest === -1 || widths[i]! > widths[widest]!)
      ) {
        widest = i
      }
    }
    if (widest === -1) break
    widths[widest]!--
    diff++
  }
  return { widths, needsHardWrap: true }
}

/**
 * Render a table with Unicode box-drawing borders.
 * Uses wrap-ansi for word-wrapping, which properly handles
 * ANSI SGR codes and OSC 8 hyperlinks across wrapped lines.
 */
export function renderTableString(
  headers: string[],
  rows: string[][],
  colWidths: number[],
  aligns: CellAlign[],
  borderStyle?: (s: string) => string,
  needsHardWrap = false,
  options?: TableOptions,
): string {
  const style = borderStyle ?? ((s: string) => s)
  const pad = options?.cellPadding ?? DEFAULT_CELL_PADDING
  const rowSep = options?.rowSeparator ?? true
  const box: Required<TableBorderChars> = {
    ...DEFAULT_BORDER,
    ...options?.borderChars,
  }

  function renderRow(cells: string[], isHeader: boolean): string[] {
    const wrappedCells = cells.map((cell, i) =>
      wrapCell(cell, colWidths[i]!, needsHardWrap),
    )
    const maxLines = Math.max(...wrappedCells.map((c) => c.length), 1)

    const lines: string[] = []
    for (let line = 0; line < maxLines; line++) {
      const parts = wrappedCells.map((cellLines, i) => {
        const text = cellLines[line] ?? ''
        const w = stringWidth(text)
        const align = isHeader ? 'center' : (aligns[i] ?? 'left')
        return (
          ' '.repeat(pad) +
          padAligned(text, w, colWidths[i]!, align) +
          ' '.repeat(pad)
        )
      })
      lines.push(
        style(box.vertical) +
          parts.join(style(box.vertical)) +
          style(box.vertical),
      )
    }
    return lines
  }

  function horizontalLine(left: string, mid: string, right: string): string {
    const segments = colWidths.map((w) => box.horizontal.repeat(w + pad * 2))
    return style(left + segments.join(mid) + right)
  }

  const output: string[] = []

  output.push(horizontalLine(box.topLeft, box.teeDown, box.topRight))
  output.push(...renderRow(headers, true))
  output.push(horizontalLine(box.teeRight, box.cross, box.teeLeft))

  for (let r = 0; r < rows.length; r++) {
    output.push(...renderRow(rows[r]!, false))
    if (rowSep && r < rows.length - 1) {
      output.push(horizontalLine(box.teeRight, box.cross, box.teeLeft))
    }
  }

  output.push(horizontalLine(box.bottomLeft, box.teeUp, box.bottomRight))

  return output.join('\n')
}
