import { onMounted, ref } from 'vue'
import { drawItems, getDrawPool, lotteryStorageKey, maxArchiveLength, maxGroups, maxRecords, normalizeGroupName, parseDrawItems, parseLotteryArchive, type DrawGroup, type DrawMode, type DrawRecord } from './logic'

/** 管理分组和抽签记录；无参数，返回本地状态与操作方法，任何操作只在本地写入成功后生效。 */
export function useLottery() {
  const groups = ref<DrawGroup[]>([])
  const ready = ref(false)
  const error = ref('')
  const feedback = ref('')

  /** 恢复存档；无参数、无返回值，读取失败时阻止覆盖原数据。 */
  function load(): void {
    ready.value = false
    error.value = ''
    feedback.value = ''
    try {
      const raw = window.localStorage.getItem(lotteryStorageKey)
      groups.value = raw === null ? [] : parseLotteryArchive(raw)
      ready.value = true
    } catch (cause) {
      error.value = `读取抽签存档失败：${cause instanceof Error ? cause.message : '本地存储不可用'}`
    }
  }
  onMounted(load)

  /** 执行并保存一项变更；change 返回候选分组，返回是否成功，异常和写入失败均保留原数据。 */
  function commit(change: () => DrawGroup[]): boolean {
    error.value = ''
    feedback.value = ''
    try {
      const next = change()
      const raw = JSON.stringify({ version: 1, groups: next })
      if (raw.length > maxArchiveLength) throw new Error('存档过大，请先清空不需要的抽签记录')
      window.localStorage.setItem(lotteryStorageKey, raw)
      groups.value = next
      ready.value = true
      feedback.value = '已保存到当前浏览器'
      return true
    } catch (cause) {
      error.value = `操作未保存：${cause instanceof Error ? cause.message : '本地存储不可用'}。原数据保持不变。`
      return false
    }
  }

  /** 创建分组；name 为分组名称、text 为可选的每行一项初始项目，返回新标识，校验或保存失败返回 null。 */
  function createGroup(name: string, text = ''): string | null {
    if (!ready.value) return null
    let id: string | null = null
    const saved = commit(() => {
      const normalized = normalizeGroupName(name)
      if (groups.value.length >= maxGroups) throw new Error(`最多创建 ${maxGroups} 个分组`)
      if (groups.value.some(group => group.name === normalized)) throw new Error('已有同名分组，请换一个名称')
      id = window.crypto.randomUUID()
      return [...groups.value, { id, name: normalized, items: parseDrawItems(text), records: [] }]
    })
    return saved ? id : null
  }

  /** 保存分组名称与项目；id 为分组标识，name 为名称，text 每行一项，返回保存是否成功并保留历史快照。 */
  function saveGroup(id: string, name: string, text: string): boolean {
    if (!ready.value) return false
    return commit(() => {
      const normalized = normalizeGroupName(name)
      if (!groups.value.some(group => group.id === id)) throw new Error('当前分组已不存在')
      if (groups.value.some(group => group.id !== id && group.name === normalized)) throw new Error('已有同名分组，请换一个名称')
      const items = parseDrawItems(text)
      return groups.value.map(group => group.id === id ? { ...group, name: normalized, items } : group)
    })
  }

  /** 抽签并追加记录；id 为分组、mode 为模式、count 为数量、repeat 为是否放回，返回已保存的本轮记录或 null。 */
  function draw(id: string, mode: DrawMode, count: number, repeat: boolean): DrawRecord | null {
    if (!ready.value) return null
    let record: DrawRecord | null = null
    const saved = commit(() => {
      const group = groups.value.find(item => item.id === id)
      if (!group) throw new Error('请先创建并选择一个分组')
      if (group.records.filter(record => record.mode === mode).length >= maxRecords) throw new Error(`当前模式最多记录 ${maxRecords} 轮，请先清空当前模式记录`)
      const results = drawItems(getDrawPool(group, repeat, mode), count, repeat, mode)
      record = { id: window.crypto.randomUUID(), mode, repeat, results, createdAt: Date.now() }
      return groups.value.map(item => item.id === id ? { ...item, records: [...item.records, record!] } : item)
    })
    return saved ? record : null
  }

  /** 重置分组内指定模式；id 为分组标识、mode 为模式，返回是否成功，保留候选、其他模式及其他分组记录。 */
  function clearRecords(id: string, mode: DrawMode): boolean {
    if (!ready.value) return false
    return commit(() => groups.value.map(group => group.id === id ? { ...group, records: group.records.filter(record => record.mode !== mode) } : group))
  }

  /** 删除整个分组；id 为分组标识，返回是否保存成功，同时移除该组项目与记录。 */
  function removeGroup(id: string): boolean {
    if (!ready.value) return false
    return commit(() => groups.value.filter(group => group.id !== id))
  }

  /** 明确放弃无法读取的存档；无参数、无返回值，仅在用户选择重新开始后保存空分组。 */
  function resetUnreadable(): void {
    if (!ready.value) commit(() => [])
  }

  return { groups, ready, error, feedback, load, createGroup, saveGroup, draw, clearRecords, removeGroup, resetUnreadable }
}
