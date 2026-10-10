// @vitest-environment jsdom
import { createApp, defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exampleDrawGroup, getDrawPool, lotteryStorageKey, maxGroups, maxRecords, type DrawGroup } from './logic'
import { useLottery } from './useLottery'

const cleanups: (() => void)[] = []

/** 挂载分组持久化逻辑；无参数，返回状态与方法，并注册清理以隔离测试。 */
function mountLottery() {
  let lottery!: ReturnType<typeof useLottery>
  const app = createApp(defineComponent({ setup() { lottery = useLottery(); return () => null } }))
  app.mount(document.createElement('div'))
  cleanups.push(() => app.unmount())
  return lottery
}

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.restoreAllMocks()
})

describe('抽签分组本地持久化', () => {
  it('示例名称与项目一次保存，不影响已有分组，写入失败不留下空分组', () => {
    const lottery = mountLottery()
    lottery.createGroup('已有分组', '自己的项目')
    const id = lottery.createGroup(exampleDrawGroup.name, exampleDrawGroup.items.join('\n'))!
    expect(mountLottery().groups.value).toEqual(lottery.groups.value)
    expect(lottery.groups.value[0]?.items).toEqual(['自己的项目'])
    expect(lottery.groups.value.find(group => group.id === id)?.items).toEqual(exampleDrawGroup.items)
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足') })
    expect(lottery.createGroup('另一个示例', '项目')).toBeNull()
    expect(lottery.groups.value).toHaveLength(2)
    write.mockRestore()
  })
  it('新建、独立维护项目、重命名、按轮次记录并恢复分组', () => {
    const lottery = mountLottery()
    const first = lottery.createGroup('周末😀')!
    const second = lottery.createGroup('午餐')!
    expect(lottery.saveGroup(first, '周末活动', '散步\n读书')).toBe(true)
    lottery.saveGroup(second, '午餐', '面条')
    const record = lottery.draw(first, 'cards', 2, false)!
    expect(new Set(record.results)).toEqual(new Set(['散步', '读书']))
    const slotRecord = lottery.draw(first, 'slot', 1, false)!
    expect(slotRecord.results).toHaveLength(1)
    expect(lottery.draw(first, 'cards', 1, false)).toBeNull()
    const secondRecord = lottery.draw(second, 'wheel', 1, false)!
    expect(secondRecord.results).toEqual(['面条'])
    expect(mountLottery().groups.value).toEqual(lottery.groups.value)
    expect(lottery.groups.value[0]?.records).toEqual([record, slotRecord])
  })

  it('放回允许同轮重复，清空只恢复当前组，项目编辑保留历史快照', () => {
    const lottery = mountLottery()
    const first = lottery.createGroup('一组')!
    const second = lottery.createGroup('二组')!
    lottery.saveGroup(first, '一组', '甲')
    lottery.saveGroup(second, '二组', '乙')
    const a = lottery.draw(first, 'sticks', 3, true)!
    expect(a.results).toEqual(['甲', '甲', '甲'])
    lottery.draw(second, 'cards', 1, false)
    lottery.saveGroup(first, '一组', '甲\n丙')
    expect(getDrawPool(lottery.groups.value[0]!, false, 'sticks')).toEqual(['丙'])
    expect(lottery.groups.value[0]?.records[0]?.results).toEqual(a.results)
    lottery.clearRecords(first, 'sticks')
    expect(getDrawPool(lottery.groups.value[0]!, false, 'sticks')).toEqual(['甲', '丙'])
    expect(lottery.groups.value[1]?.records).toHaveLength(1)
    lottery.removeGroup(first)
    expect(mountLottery().groups.value.map(group => group.id)).toEqual([second])
  })

  it('写入失败时创建、项目维护、抽签与删除均不生效，不覆盖原存档', () => {
    const lottery = mountLottery()
    const id = lottery.createGroup('分组')!
    lottery.saveGroup(id, '分组', '甲')
    const saved = window.localStorage.getItem(lotteryStorageKey)
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足') })
    expect(lottery.createGroup('新组')).toBeNull()
    expect(lottery.saveGroup(id, '更名', '乙')).toBe(false)
    expect(lottery.draw(id, 'cards', 1, false)).toBeNull()
    expect(lottery.removeGroup(id)).toBe(false)
    expect(window.localStorage.getItem(lotteryStorageKey)).toBe(saved)
    expect(lottery.groups.value[0]).toMatchObject({ name: '分组', items: ['甲'], records: [] })
    expect(lottery.error.value).toContain('空间不足')
    write.mockRestore()
    expect(lottery.draw(id, 'wheel', 1, false)?.results).toEqual(['甲'])
  })

  it('拒绝同名、空白名称与非法候选，失败保留原数据', () => {
    const lottery = mountLottery()
    const id = lottery.createGroup('分组')!
    const saved = window.localStorage.getItem(lotteryStorageKey)
    expect(lottery.createGroup(' 分组 ')).toBeNull()
    expect(lottery.createGroup(' ')).toBeNull()
    expect(lottery.saveGroup(id, '新名字', '中'.repeat(51))).toBe(false)
    expect(window.localStorage.getItem(lotteryStorageKey)).toBe(saved)
  })

  it('损坏存档和访问失败时禁止操作，可重新读取或明确重新开始', () => {
    window.localStorage.setItem(lotteryStorageKey, 'broken')
    const lottery = mountLottery()
    expect(lottery.ready.value).toBe(false)
    expect(lottery.createGroup('分组')).toBeNull()
    expect(window.localStorage.getItem(lotteryStorageKey)).toBe('broken')
    lottery.resetUnreadable()
    expect(lottery.ready.value).toBe(true)
    const access = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('访问禁止') })
    lottery.load()
    expect(lottery.error.value).toContain('访问禁止')
    expect(lottery.draw('g', 'cards', 1, true)).toBeNull()
    access.mockRestore()
    lottery.load()
    expect(lottery.ready.value).toBe(true)
  })

  it('分组与轮次达到上限时不静默删除历史', () => {
    const full: DrawGroup[] = Array.from({ length: maxGroups }, (_, index) => ({
      id: `${index}`, name: `组${index}`, items: ['甲'],
      records: index === 0 ? Array.from({ length: maxRecords }, (_, round) => ({ id: `${round}`, mode: 'cards', repeat: true, createdAt: round, results: ['甲'] })) : [],
    }))
    window.localStorage.setItem(lotteryStorageKey, JSON.stringify({ version: 1, groups: full }))
    const lottery = mountLottery()
    expect(lottery.createGroup('额外')).toBeNull()
    expect(lottery.draw('0', 'cards', 1, true)).toBeNull()
    expect(lottery.groups.value[0]?.records).toHaveLength(maxRecords)
    expect(lottery.error.value).toContain('100')
    expect(lottery.draw('0', 'slot', 1, false)?.results).toEqual(['甲'])
    expect(mountLottery().groups.value[0]?.records).toHaveLength(maxRecords + 1)
    lottery.clearRecords('0', 'slot')
    expect(lottery.groups.value[0]?.records).toHaveLength(maxRecords)
    expect(lottery.groups.value[0]?.records.every(record => record.mode === 'cards')).toBe(true)
  })
})
