import { describe, expect, it } from 'vitest'
import { compareTexts, splitDiffLines } from './logic'

describe('文本对比', () => {
  it('拆分视图配对替换行并为单侧变化留空', () => {
    const rows = splitDiffLines(compareTexts('首\n旧\n尾', '首\n新\n增加\n尾'))
    expect(rows.map(row => [row.left?.text ?? null, row.right?.text ?? null])).toEqual([['首', '首'], ['旧', '新'], [null, '增加'], ['尾', '尾']])
    expect(splitDiffLines(compareTexts('删除', ''))[0]?.right).toBeNull()
    expect(splitDiffLines([])).toEqual([])
  })
  it('一致文本与两侧空输入', () => {
    expect(compareTexts('', '')).toEqual([])
    expect(compareTexts('中文😀', '中文😀')).toEqual([{ kind: 'equal', text: '中文😀', leftLine: 1, rightLine: 1 }])
    expect(compareTexts('', '新增')[0]?.kind).toBe('added')
    expect(compareTexts('删除', '')[0]?.kind).toBe('removed')
  })
  it('替换行保留双侧行号和后续共同内容', () => {
    expect(compareTexts('开始\n旧行\n结束', '开始\n新行\n结束')).toEqual([
      { kind: 'equal', text: '开始', leftLine: 1, rightLine: 1 },
      { kind: 'removed', text: '旧行', leftLine: 2, rightLine: null },
      { kind: 'added', text: '新行', leftLine: null, rightLine: 2 },
      { kind: 'equal', text: '结束', leftLine: 3, rightLine: 3 },
    ])
  })
  it('保留空格与末尾空行，统一换行形式', () => {
    expect(compareTexts('a\r\nb\r', 'a\nb\n').every(line => line.kind === 'equal')).toBe(true)
    expect(compareTexts('a', 'a\n').at(-1)).toEqual({ kind: 'added', text: '', leftLine: null, rightLine: 2 })
    expect(compareTexts('a ', 'a').filter(line => line.kind !== 'equal')).toHaveLength(2)
  })
  it('重复行的差异可以完整重建两侧文本', () => {
    const left = 'a\na\nb\na'
    const right = 'b\na\nc\na'
    const lines = compareTexts(left, right)
    expect(lines.filter(line => line.kind !== 'added').map(line => line.text).join('\n')).toBe(left)
    expect(lines.filter(line => line.kind !== 'removed').map(line => line.text).join('\n')).toBe(right)
    expect(lines.filter(line => line.kind === 'equal')).toHaveLength(2)
  })
  it('限制超大输入和计算矩阵', () => {
    expect(() => compareTexts('a'.repeat(200001), '')).toThrow('200,000')
    expect(() => compareTexts('a\n'.repeat(1000), 'b\n'.repeat(1000))).toThrow('行数过多')
  })
})
