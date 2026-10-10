import { describe, expect, it, vi } from 'vitest'
import { drawItems, getDrawPool, maxArchiveLength, normalizeGroupName, parseDrawItems, parseLotteryArchive, randomDrawIndex, type DrawGroup } from './logic'

describe('抽签候选与分组校验', () => {
  it('支持 Unicode、换行、空列表和规范化去重，同名候选不增加概率', () => {
    expect(parseDrawItems('  散步😀\r\n电影\n散步😀\né\ne\u0301\n ')).toEqual(['散步😀', '电影', 'é'])
    expect(parseDrawItems(' \n\t')).toEqual([])
    expect(parseDrawItems('😀'.repeat(50))).toEqual(['😀'.repeat(50)])
    expect(normalizeGroupName(' 周末😀 ')).toBe('周末😀')
    expect(() => normalizeGroupName(' ')).toThrow()
    expect(() => normalizeGroupName('中'.repeat(31))).toThrow()
  })

  it('拒绝候选超长、超量和超大原文，接受候选最大数量', () => {
    expect(() => parseDrawItems('😀'.repeat(51))).toThrow('50')
    expect(() => parseDrawItems('a'.repeat(10001))).toThrow('10,000')
    const lines = Array.from({ length: 100 }, (_, index) => `${index}`)
    expect(parseDrawItems(lines.join('\n'))).toHaveLength(100)
    expect(() => parseDrawItems([...lines, '额外'].join('\n'))).toThrow('100')
  })
})

describe('等概率抽取与重复规则', () => {
  it('不放回时按抽取顺序移除候选，原候选保持不变', () => {
    const pool = ['甲', '乙', '丙']
    const choose = vi.fn().mockReturnValueOnce(2).mockReturnValueOnce(0).mockReturnValueOnce(0)
    expect(drawItems(pool, 3, false, 'cards', choose)).toEqual(['丙', '甲', '乙'])
    expect(choose.mock.calls.map(call => call[0])).toEqual([3, 2, 1])
    expect(pool).toEqual(['甲', '乙', '丙'])
  })

  it('放回时同轮可重复，四种模式使用相同抽取规则', () => {
    for (const mode of ['cards', 'slot', 'sticks'] as const) {
      expect(drawItems(['甲'], 20, true, mode, () => 0)).toEqual(Array(20).fill('甲'))
    }
    expect(drawItems(['甲', '乙'], 1, true, 'wheel', () => 1)).toEqual(['乙'])
  })

  it('只排除当前模式历史项目，放回时恢复候选，其他模式保留完整候选', () => {
    const group: DrawGroup = { id: 'g', name: '分组', items: ['甲', '乙', '丙'], records: [{ id: 'r', mode: 'cards', repeat: true, results: ['乙', '乙', '已移除项目'], createdAt: 1 }] }
    expect(getDrawPool(group, false, 'cards')).toEqual(['甲', '丙'])
    expect(getDrawPool(group, false, 'slot')).toEqual(['甲', '乙', '丙'])
    expect(getDrawPool(group, true, 'cards')).toEqual(['甲', '乙', '丙'])
    expect(getDrawPool({ ...group, records: [] }, false, 'cards')).toEqual(group.items)
  })

  it('拒绝空池、数量不足、转盘多抽和非法索引', () => {
    expect(() => drawItems([], 1, false, 'cards')).toThrow('没有可抽')
    expect(() => drawItems(['甲'], 2, false, 'slot')).toThrow('仅剩 1')
    expect(() => drawItems(['甲'], 2, true, 'wheel')).toThrow('只能')
    for (const count of [0, -1, 1.5, 21, NaN]) expect(() => drawItems(['甲'], count, true, 'cards')).toThrow('整数')
    expect(() => drawItems(['甲'], 1, true, 'cards', () => 1)).toThrow('随机索引')
    expect(() => drawItems(['甲', '甲'], 1, true, 'cards')).toThrow('候选列表')
  })

  it('拒绝随机尾部区间，处理单候选与随机源失败', () => {
    const source = vi.spyOn(crypto, 'getRandomValues')
    let attempt = 0
    source.mockImplementation(array => {
      if (!(array instanceof Uint32Array)) throw new Error('随机缓冲区错误')
      array[0] = attempt++ === 0 ? 0xffffffff : 4
      return array
    })
    expect(randomDrawIndex(3)).toBe(1)
    expect(source).toHaveBeenCalledTimes(2)
    expect(randomDrawIndex(1)).toBe(0)
    source.mockImplementation(() => { throw new Error('随机源不可用') })
    expect(() => randomDrawIndex(3)).toThrow('随机源不可用')
    source.mockRestore()
    expect(() => randomDrawIndex(0)).toThrow('无效')
  })
})

describe('抽签存档恢复', () => {
  const group: DrawGroup = { id: 'g', name: '周末😀', items: ['散步', '读书'], records: [{ id: 'r', mode: 'cards', repeat: true, createdAt: 10, results: ['散步', '散步'] }] }

  it('保留分组、轮次、重复结果和轮内顺序，接受空存档', () => {
    expect(parseLotteryArchive(JSON.stringify({ version: 1, groups: [group] }))).toEqual([group])
    expect(parseLotteryArchive('{"version":1,"groups":[]}')).toEqual([])
  })

  it('拒绝非法版本、标识、候选、记录和重复分组', () => {
    const invalid = [
      { version: 2, groups: [] }, { version: 1, groups: [group, group] },
      { version: 1, groups: [{ ...group, items: ['散步', '散步'] }] },
      { version: 1, groups: [{ ...group, items: [123] }] },
      { version: 1, groups: [{ ...group, records: [{ ...group.records[0], repeat: false }] }] },
      { version: 1, groups: [{ ...group, records: [{ ...group.records[0], mode: 'wheel' }] }] },
      { version: 1, groups: [{ ...group, records: [{ ...group.records[0], createdAt: -1 }] }] },
      { version: 1, groups: [{ ...group, records: [{ ...group.records[0], results: [] }] }] },
    ]
    for (const archive of invalid) expect(() => parseLotteryArchive(JSON.stringify(archive))).toThrow()
    expect(() => parseLotteryArchive('broken')).toThrow()
    expect(() => parseLotteryArchive(' '.repeat(maxArchiveLength + 1))).toThrow('过大')
  })
})
