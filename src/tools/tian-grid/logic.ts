export interface GridOptions {
  rows: number
  columns: number
  content: string
}

/** 根据 options 行列和练习内容生成 A4 方格数据；返回格子尺寸、文字和截断提示，非法尺寸时抛错。 */
export function createPracticeGrid(options: GridOptions) {
  const { rows, columns, content } = options
  if (!Number.isInteger(rows) || rows < 1 || rows > 20) throw new Error('行数必须为 1–20 的整数')
  if (!Number.isInteger(columns) || columns < 1 || columns > 15) throw new Error('列数必须为 1–15 的整数')
  if (content.length > 10000) throw new Error('练习内容最多 10,000 个 UTF-16 单元')
  const lines = content.replace(/\r\n?/g, '\n').split('\n').map(line => Array.from(line))
  // 预留边框宽度，确保满宽或满高时外边框仍在 A4 的 10mm 页边距内。
  const cellSize = Math.min(189.6 / columns, 276.6 / rows, 80)
  const cells = Array.from({ length: rows * columns }, (_, index) => ({
    x: 10 + (index % columns) * cellSize,
    y: 10 + Math.floor(index / columns) * cellSize,
    text: lines[Math.floor(index / columns)]?.[index % columns] ?? '',
  }))
  const truncated = lines.some((line, index) => index >= rows ? line.length > 0 : line.length > columns)
  return { rows, columns, cellSize, cells, truncated }
}
