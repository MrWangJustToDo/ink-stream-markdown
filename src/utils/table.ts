import wrapAnsi from 'wrap-ansi'
import stringWidth from 'string-width'

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

/**
 * Allocate `space` across columns in proportion to their content width, never
 * giving a column less than its floor.
 *
 * When a floor exceeds a column's proportional share, that column is fixed at
 * its floor and the rest of the budget is shared by the remaining columns.
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
 * Columns that already fit in an even split keep their content width; the rest
 * share the remaining budget in proportion to their content, with a floor at
 * `minColWidth` (or the column's own content width when that is narrower).
 * Content that overflows its share is hard-wrapped by the renderer.
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

  // Natural (unfloored) content width per column — `stringWidth` is expensive,
  // so one pass per column only.
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
  if (totalIdeal <= space) {
    return { widths: idealWidths, needsHardWrap: false }
  }

  // Columns that fit in an even split keep their content width (dates,
  // statuses, categories); the rest share what is left in proportion to their
  // content. This keeps short columns readable while the widest column absorbs
  // the squeezing.
  const equalShare = space / numCols
  const fixed = idealWidths.map((w) => w <= equalShare)
  const fixedTotal = idealWidths.reduce((s, w, i) => s + (fixed[i] ? w : 0), 0)
  const freeIndexes = idealWidths.map((_, i) => i).filter((i) => !fixed[i])
  const freeBudget = space - fixedTotal
  const freeWeights = freeIndexes.map((i) => idealWidths[i]!)
  const freeFloors = freeIndexes.map((i) =>
    Math.max(Math.min(minColWidth, naturalWidths[i]!), 1),
  )

  const widths = [...idealWidths]
  if (freeFloors.reduce((s, w) => s + w, 0) > freeBudget) {
    // Overrun the budget so the caller falls back to the markdown source
    // instead of shredding cells into one or two characters.
    freeIndexes.forEach((i, k) => {
      widths[i] = freeFloors[k]!
    })
    return { widths, needsHardWrap: true }
  }

  const freeWidths = allocateProportional(freeWeights, freeFloors, freeBudget)
  freeIndexes.forEach((i, k) => {
    widths[i] = freeWidths[k]!
  })
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
