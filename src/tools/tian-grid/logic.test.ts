import { describe, expect, it } from 'vitest'
import { createPracticeGrid } from './logic'

describe('田字格生成', () => {
  it('生成指定数量的正方形格子并保留 Unicode 码点', () => {
    const grid = createPracticeGrid({ rows: 2, columns: 3, content: '中𠮷😀\r\n文' })
    expect(grid.cells.map(cell => cell.text)).toEqual(['中', '𠮷', '😀', '文', '', ''])
    expect(grid.cells[3]?.y).toBe(10 + grid.cellSize)
    expect(grid.truncated).toBe(false)
  })
  it('格子不超过 A4 页边距并限制最大尺寸', () => {
    for (const [rows, columns] of [[1, 1], [20, 15], [12, 8]] as const) {
      const grid = createPracticeGrid({ rows, columns, content: '' })
      expect(grid.cellSize).toBeLessThanOrEqual(80)
      expect(10 + grid.cellSize * columns).toBeLessThanOrEqual(200)
      expect(10 + grid.cellSize * rows).toBeLessThanOrEqual(287)
      expect(grid.cells).toHaveLength(rows * columns)
    }
  })
  it('保留空白行并明确提示内容截断', () => {
    expect(createPracticeGrid({ rows: 2, columns: 2, content: '\n字' }).cells.map(cell => cell.text)).toEqual(['', '', '字', ''])
    expect(createPracticeGrid({ rows: 1, columns: 1, content: '两个' }).truncated).toBe(true)
    expect(createPracticeGrid({ rows: 1, columns: 1, content: '字\n外' }).truncated).toBe(true)
  })
  it('拒绝非法行列与过长内容', () => {
    for (const rows of [0, 21, 1.5, NaN]) expect(() => createPracticeGrid({ rows, columns: 8, content: '' })).toThrow('行数')
    for (const columns of [0, 16, 1.5, NaN]) expect(() => createPracticeGrid({ rows: 12, columns, content: '' })).toThrow('列数')
    expect(() => createPracticeGrid({ rows: 12, columns: 8, content: '字'.repeat(10001) })).toThrow('10,000')
  })
})
