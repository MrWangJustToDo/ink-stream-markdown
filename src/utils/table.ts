import wrapAnsi from 'wrap-ansi'
import stringWidth from 'string-width'
import stripAnsi from 'strip-ansi'

import type { TableOptions, TableBorderChars } from '../theme'

const DEFAULT_MIN_COL_WIDTH = 5
const DEFAULT_CELL_PADDING = 1

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
  const wrapped = wrapAnsi(trimmed, width, { hard, wordWrap: true, trim: false })
  const lines = wrapped.split('\n').filter((l) => l.length > 0)
  return lines.length > 0 ? lines : ['']
}

function longestWordWidth(text: string, minWidth: number): number {
  const plain = stripAnsi(text)
  const words = plain.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return minWidth
  return Math.max(...words.map((w) => stringWidth(w)), minWidth)
}

function cellContentWidth(text: string, minWidth: number): number {
  return Math.max(stringWidth(stripAnsi(text)), minWidth)
}

/**
 * Calculate column widths that fit within availableWidth.
 * Distributes space proportionally based on content needs.
 */
export function calculateColumnWidths(
  headers: string[],
  rows: string[][],
  availableWidth: number,
  minColWidth = DEFAULT_MIN_COL_WIDTH,
): { widths: number[]; needsHardWrap: boolean } {
  const numCols = headers.length

  const minWidths = headers.map((h, col) => {
    let w = longestWordWidth(h, minColWidth)
    for (const row of rows) {
      if (row[col]) w = Math.max(w, longestWordWidth(row[col], minColWidth))
    }
    return w
  })

  const idealWidths = headers.map((h, col) => {
    let w = cellContentWidth(h, minColWidth)
    for (const row of rows) {
      if (row[col]) w = Math.max(w, cellContentWidth(row[col], minColWidth))
    }
    return w
  })

  const totalIdeal = idealWidths.reduce((s, w) => s + w, 0)
  const totalMin = minWidths.reduce((s, w) => s + w, 0)
  const space = Math.max(availableWidth, numCols * minColWidth)

  if (totalIdeal <= space) {
    return { widths: idealWidths, needsHardWrap: false }
  }

  if (totalMin <= space) {
    const extra = space - totalMin
    const overflows = idealWidths.map((ideal, i) => ideal - minWidths[i]!)
    const totalOverflow = overflows.reduce((s, o) => s + o, 0)
    const widths = minWidths.map((min, i) => {
      if (totalOverflow === 0) return min
      return min + Math.floor((overflows[i]! / totalOverflow) * extra)
    })
    return { widths, needsHardWrap: false }
  }

  const scale = space / totalMin
  const widths = minWidths.map((w) => Math.max(Math.floor(w * scale), minColWidth))
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
  const box: Required<TableBorderChars> = { ...DEFAULT_BORDER, ...options?.borderChars }

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
