export type DrawMode = 'wheel' | 'cards' | 'slot' | 'sticks'

export interface DrawRecord {
  id: string
  mode: DrawMode
  repeat: boolean
  results: string[]
  createdAt: number
}

export interface DrawGroup {
  id: string
  name: string
  items: string[]
  records: DrawRecord[]
}

export const lotteryStorageKey = 'toolbox:lottery:v1'
export const maxGroups = 20
export const maxItems = 100
export const maxDrawCount = 20
export const maxRecords = 100
export const maxArchiveLength = 4_000_000
export const exampleDrawGroup = {
  name: '周末去干嘛',
  items: ['公园散步', '看一场电影', '骑行兜风', '逛博物馆', '打羽毛球', '做一顿大餐', '读一本书', '郊外野餐'],
}
export const drawModes: { value: DrawMode; label: string; icon: string; hint: string }[] = [
  { value: 'wheel', label: '幸运转盘', icon: '◉', hint: '指针停在哪里，幸运就在哪里 · 每次 1 项' },
  { value: 'cards', label: '翻牌揭晓', icon: '▣', hint: '翻开神秘卡牌，按顺序揭晓答案' },
  { value: 'slot', label: '滚动抽选', icon: '↕', hint: '让候选滚动起来，看看最后是谁' },
  { value: 'sticks', label: '签筒摇签', icon: '✦', hint: '摇一摇签筒，抽出今天的幸运签' },
]

/** 整理分组名称；name 为输入文本，返回规范名称，空白或超过 30 个 Unicode 字符时抛错。 */
export function normalizeGroupName(name: string): string {
  const value = name.trim().normalize('NFC')
  if (!value || Array.from(value).length > 30) throw new Error('分组名称需为 1–30 个 Unicode 字符')
  return value
}

/** 解析候选项目；text 为每行一项的文本，返回规范化且去重的项目，空列表用于尚未配置的分组。 */
export function parseDrawItems(text: string): string[] {
  if (text.length > 10000) throw new Error('候选文本最多 10,000 个字符')
  const lines = text.split(/\r\n?|\n/).map(line => line.trim().normalize('NFC')).filter(Boolean)
  if (lines.length > maxItems) throw new Error(`每个分组最多 ${maxItems} 个非空行`)
  if (lines.some(line => Array.from(line).length > 50)) throw new Error('每个项目最多 50 个 Unicode 字符')
  return [...new Set(lines)]
}

/** 获取当前模式候选；group 为分组，repeat 决定是否放回，mode 为模式，返回不受其他模式影响的候选数组。 */
export function getDrawPool(group: DrawGroup, repeat: boolean, mode: DrawMode): string[] {
  const used = new Set(group.records.filter(record => record.mode === mode).flatMap(record => record.results))
  return group.items.filter(item => repeat || !used.has(item))
}

/** 使用浏览器加密随机源生成等概率索引；length 为候选数量，返回索引，非法范围或随机源失败时抛错。 */
export function randomDrawIndex(length: number): number {
  if (!Number.isInteger(length) || length < 1 || length > maxItems) throw new Error('候选数量无效')
  const limit = Math.floor(0x100000000 / length) * length
  const buffer = new Uint32Array(1)
  // 拒绝不能整除的尾部区间，避免简单取模让部分候选概率更高。
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0]! >= limit)
  return buffer[0]! % length
}

/** 按顺序抽取；pool 为候选、count 为数量、repeat 为是否放回、mode 为模式，choose 为可替换随机索引源，返回结果。 */
export function drawItems(pool: readonly string[], count: number, repeat: boolean, mode: DrawMode, choose = randomDrawIndex): string[] {
  if (!drawModes.some(item => item.value === mode)) throw new Error('抽签模式无效')
  if (!Number.isInteger(count) || count < 1 || count > maxDrawCount) throw new Error(`每次抽取数量需为 1–${maxDrawCount} 的整数`)
  if (mode === 'wheel' && count !== 1) throw new Error('转盘每次只能抽取 1 项')
  if (!pool.length) throw new Error('没有可抽项目，请添加项目、允许重复或清空当前分组记录')
  if (pool.length > maxItems || new Set(pool).size !== pool.length) throw new Error('候选列表无效')
  if (!repeat && count > pool.length) throw new Error(`可抽项目仅剩 ${pool.length} 项，请减少抽取数量`)
  const available = [...pool]
  const results: string[] = []
  for (let index = 0; index < count; index += 1) {
    const selected = choose(available.length)
    if (!Number.isInteger(selected) || selected < 0 || selected >= available.length) throw new Error('随机索引无效')
    results.push(available[selected]!)
    if (!repeat) available.splice(selected, 1)
  }
  return results
}

/** 校验存档对象字段；value 为未知值，返回可读取的对象，拒绝数组和空对象引用。 */
function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('抽签存档结构无效')
  return value as Record<string, unknown>
}

/** 校验存档标识；value 为未知标识，seen 为已使用标识集合，返回唯一标识。 */
function readId(value: unknown, seen: Set<string>): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || seen.has(value)) throw new Error('抽签存档标识无效或重复')
  seen.add(value)
  return value
}

/** 校验存档候选或结果名称；value 为未知数组、limit 为数量上限，返回有效项目名称并保留结果重复及顺序。 */
function readItems(value: unknown, limit: number): string[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('抽签存档项目数量无效')
  return value.map((item: unknown) => {
    if (typeof item !== 'string' || !item.trim() || /[\r\n]/.test(item) || Array.from(item).length > 50) throw new Error('抽签存档项目内容无效')
    return item.trim().normalize('NFC')
  })
}

/** 解析完整本地存档；raw 为 JSON 文本，返回有效分组，拒绝无效版本、记录与重复分组。 */
export function parseLotteryArchive(raw: string): DrawGroup[] {
  if (raw.length > maxArchiveLength) throw new Error('抽签存档过大')
  const archive = readObject(JSON.parse(raw))
  if (archive.version !== 1 || !Array.isArray(archive.groups) || archive.groups.length > maxGroups) throw new Error('抽签存档版本或分组数量无效')
  const ids = new Set<string>()
  const names = new Set<string>()
  return archive.groups.map((value: unknown) => {
    const group = readObject(value)
    const id = readId(group.id, ids)
    if (typeof group.name !== 'string') throw new Error('抽签分组名称无效')
    const name = normalizeGroupName(group.name)
    if (names.has(name)) throw new Error('抽签分组名称重复')
    names.add(name)
    const items = readItems(group.items, maxItems)
    if (new Set(items).size !== items.length) throw new Error('抽签候选项目重复')
    if (!Array.isArray(group.records) || group.records.length > maxRecords * drawModes.length) throw new Error('抽签记录数量无效')
    const recordIds = new Set<string>()
    const records = group.records.map((entry: unknown): DrawRecord => {
      const record = readObject(entry)
      const recordId = readId(record.id, recordIds)
      const mode = drawModes.find(item => item.value === record.mode)?.value
      if (!mode || typeof record.repeat !== 'boolean' || typeof record.createdAt !== 'number'
        || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0 || record.createdAt > 8_640_000_000_000_000) {
        throw new Error('抽签记录配置无效')
      }
      const results = readItems(record.results, maxDrawCount)
      if (!results.length || (mode === 'wheel' && results.length !== 1) || (!record.repeat && new Set(results).size !== results.length)) throw new Error('抽签记录结果无效')
      return { id: recordId, mode, repeat: record.repeat, createdAt: record.createdAt, results }
    })
    if (drawModes.some(option => records.filter(record => record.mode === option.value).length > maxRecords)) throw new Error('当前模式抽签记录数量无效')
    return { id, name, items, records }
  })
}
