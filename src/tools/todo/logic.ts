export type TodoStatus = 'pending' | 'in-progress' | 'done'

export interface TodoItem {
  id: string
  content: string
  status: TodoStatus
}

export const todoStorageKey = 'toolbox:todos:v1'
export const maxTodoLength = 500
export const maxTodoCount = 1000
export const todoStatuses: { value: TodoStatus; label: string }[] = [
  { value: 'pending', label: '待处理' },
  { value: 'in-progress', label: '进行中' },
  { value: 'done', label: '已完成' },
]

/** 校验并整理待办文本；content 为原文，返回去除首尾空白的文本，空白或超长内容抛错。 */
export function normalizeTodoContent(content: string): string {
  const normalized = content.trim()
  if (!normalized) throw new Error('请输入待办内容，不能仅包含空白')
  if (Array.from(normalized).length > maxTodoLength) throw new Error(`每条待办最多 ${maxTodoLength} 个 Unicode 字符`)
  return normalized
}

/** 解析本地存档；raw 为 JSON 文本，返回校验后的待办列表，非法结构或重复标识抛错。 */
export function parseTodos(raw: string): TodoItem[] {
  // 留出 JSON 将控制字符转为六字符转义序列的空间，确保合法的最大列表仍能恢复。
  if (raw.length > 4_000_000) throw new Error('待办存档过大')
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data) || data.length > maxTodoCount) throw new Error(`待办存档必须是最多 ${maxTodoCount} 条的列表`)
  const ids = new Set<string>()
  return data.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('待办存档包含非法条目')
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id.trim() || record.id.length > 100 || ids.has(record.id)) {
      throw new Error('待办标识无效或重复')
    }
    if (typeof record.content !== 'string') throw new Error('待办内容必须是文本')
    if (record.status !== 'pending' && record.status !== 'in-progress' && record.status !== 'done') {
      throw new Error('待办状态无效')
    }
    ids.add(record.id)
    return { id: record.id, content: normalizeTodoContent(record.content), status: record.status }
  })
}
