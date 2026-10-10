import { onMounted, ref } from 'vue'
import { maxTodoCount, normalizeTodoContent, parseTodos, todoStorageKey, type TodoItem, type TodoStatus } from './logic'

/** 管理待办及自动本地保存；无参数，返回列表、读取状态、反馈和操作方法，失败时保留原存档。 */
export function useTodos() {
  const items = ref<TodoItem[]>([])
  const error = ref('')
  const feedback = ref('')
  const ready = ref(false)

  /** 读取当前浏览器存档；无参数、无返回值，读取失败时阻止后续操作覆盖未知数据。 */
  function load(): void {
    error.value = ''
    feedback.value = ''
    ready.value = false
    try {
      const saved = window.localStorage.getItem(todoStorageKey)
      items.value = saved === null ? [] : parseTodos(saved)
      ready.value = true
    } catch (cause) {
      error.value = `读取待办失败：${cause instanceof Error ? cause.message : '浏览器存储不可用'}`
    }
  }
  onMounted(load)

  /** 保存候选列表；next 为新列表，返回是否成功，写入成功后才更新界面，避免显示未持久化的状态。 */
  function persist(next: TodoItem[]): boolean {
    error.value = ''
    feedback.value = ''
    try {
      window.localStorage.setItem(todoStorageKey, JSON.stringify(next))
      items.value = next
      ready.value = true
      feedback.value = '已自动保存到当前浏览器'
      return true
    } catch (cause) {
      error.value = `保存待办失败：${cause instanceof Error ? cause.message : '浏览器存储不可用'}。本次操作未生效，请重试。`
      return false
    }
  }

  /** 添加待办；content 为输入内容，返回是否保存成功，新增待办默认待处理并显示在最前。 */
  function add(content: string): boolean {
    if (!ready.value) return false
    error.value = ''
    feedback.value = ''
    try {
      const normalized = normalizeTodoContent(content)
      if (items.value.length >= maxTodoCount) throw new Error(`最多保存 ${maxTodoCount} 条待办，请先删除不需要的事项`)
      const item: TodoItem = { id: window.crypto.randomUUID(), content: normalized, status: 'pending' }
      return persist([item, ...items.value])
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '添加待办失败'
      return false
    }
  }

  /** 修改待办状态；id 为条目标识，status 为目标状态，无返回值，保存失败时保留原状态。 */
  function setStatus(id: string, status: TodoStatus): void {
    if (!ready.value || !items.value.some(item => item.id === id)) return
    persist(items.value.map(item => item.id === id ? { ...item, status } : item))
  }

  /** 编辑已有待办；id 为条目标识，content 为新文本，返回是否保存成功，保留原标识、状态和顺序。 */
  function edit(id: string, content: string): boolean {
    if (!ready.value) return false
    error.value = ''
    feedback.value = ''
    try {
      if (!items.value.some(item => item.id === id)) throw new Error('该待办已不存在，请重新读取列表')
      const normalized = normalizeTodoContent(content)
      return persist(items.value.map(item => item.id === id ? { ...item, content: normalized } : item))
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '编辑待办失败'
      return false
    }
  }

  /** 删除一条待办；id 为条目标识，无返回值，仅在保存成功后移除条目。 */
  function remove(id: string): void {
    if (!ready.value) return
    persist(items.value.filter(item => item.id !== id))
  }

  /** 放弃无法读取的存档并保存空列表；无参数、无返回值，仅供用户明确选择重新开始时调用。 */
  function resetUnreadable(): void {
    if (!ready.value) persist([])
  }

  return { items, error, feedback, ready, load, add, edit, setStatus, remove, resetUnreadable }
}
