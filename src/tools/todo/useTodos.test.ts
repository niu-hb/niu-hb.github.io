// @vitest-environment jsdom
import { createApp, defineComponent } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todoStorageKey } from './logic'
import { useTodos } from './useTodos'

const cleanups: (() => void)[] = []

/** 挂载待办状态；无参数，返回可操作状态，并注册卸载以隔离测试的生命周期。 */
function mountTodos() {
  let todos!: ReturnType<typeof useTodos>
  const host = document.createElement('div')
  const app = createApp(defineComponent({
    setup() {
      todos = useTodos()
      return () => null
    },
  }))
  app.mount(host)
  cleanups.push(() => app.unmount())
  return todos
}

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.restoreAllMocks()
})

describe('待办自动本地保存', () => {
  it('编辑历史存档内容并恢复，保留状态、标识和排序', () => {
    const original = [
      { id: 'first', content: '原内容', status: 'done' },
      { id: 'second', content: '其他内容', status: 'in-progress' },
    ]
    window.localStorage.setItem(todoStorageKey, JSON.stringify(original))
    const todos = mountTodos()
    expect(todos.edit('first', ' 新内容😀\n第二行 ')).toBe(true)
    expect(mountTodos().items.value).toEqual([
      { ...original[0], content: '新内容😀\n第二行' }, original[1],
    ])
  })

  it('非法编辑和写入失败保留原内容与存档，重试后保存', () => {
    const todos = mountTodos()
    todos.add('原内容')
    const id = todos.items.value[0]!.id
    const saved = window.localStorage.getItem(todoStorageKey)
    expect(todos.edit(id, ' \n ')).toBe(false)
    expect(todos.edit(id, '😀'.repeat(501))).toBe(false)
    expect(todos.edit('missing', '新内容')).toBe(false)
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足') })
    expect(todos.edit(id, '新内容')).toBe(false)
    expect(todos.items.value[0]?.content).toBe('原内容')
    expect(window.localStorage.getItem(todoStorageKey)).toBe(saved)
    expect(todos.error.value).toContain('空间不足')
    write.mockRestore()
    expect(todos.edit(id, '新内容')).toBe(true)
    expect(mountTodos().items.value[0]?.content).toBe('新内容')
  })

  it('添加、修改三个状态和删除后立即保存，重新挂载恢复', () => {
    const todos = mountTodos()
    expect(todos.ready.value).toBe(true)
    expect(todos.add(' 买菜😀 ')).toBe(true)
    const id = todos.items.value[0]!.id
    expect(mountTodos().items.value[0]).toMatchObject({ id, content: '买菜😀', status: 'pending' })
    todos.setStatus(id, 'in-progress')
    expect(mountTodos().items.value[0]?.status).toBe('in-progress')
    todos.setStatus(id, 'done')
    expect(mountTodos().items.value[0]?.status).toBe('done')
    todos.setStatus(id, 'pending')
    expect(mountTodos().items.value[0]?.status).toBe('pending')
    todos.remove(id)
    expect(mountTodos().items.value).toEqual([])
    expect(todos.feedback.value).toContain('已自动保存')
  })

  it('空白和超长输入不覆盖原存档，相同内容仍有独立标识', () => {
    const todos = mountTodos()
    todos.add('事项')
    const saved = window.localStorage.getItem(todoStorageKey)
    expect(todos.add('  ')).toBe(false)
    expect(todos.add('中'.repeat(501))).toBe(false)
    expect(window.localStorage.getItem(todoStorageKey)).toBe(saved)
    todos.add('事项')
    expect(new Set(todos.items.value.map(item => item.id)).size).toBe(2)
  })

  it('写入失败时添加、状态修改和删除均不生效，可恢复后重试', () => {
    const todos = mountTodos()
    todos.add('原事项')
    const saved = window.localStorage.getItem(todoStorageKey)
    const id = todos.items.value[0]!.id
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足') })
    expect(todos.add('新事项')).toBe(false)
    todos.setStatus(id, 'done')
    todos.remove(id)
    expect(todos.items.value).toEqual([{ id, content: '原事项', status: 'pending' }])
    expect(window.localStorage.getItem(todoStorageKey)).toBe(saved)
    expect(todos.error.value).toContain('空间不足')
    expect(todos.feedback.value).toBe('')
    write.mockRestore()
    todos.setStatus(id, 'done')
    expect(todos.error.value).toBe('')
    expect(mountTodos().items.value[0]?.status).toBe('done')
  })

  it('非法存档不会被操作覆盖，用户明确重新开始才保存空列表', () => {
    window.localStorage.setItem(todoStorageKey, 'broken')
    const todos = mountTodos()
    expect(todos.ready.value).toBe(false)
    expect(todos.error.value).toContain('读取待办失败')
    expect(todos.add('事项')).toBe(false)
    todos.remove('unknown')
    expect(window.localStorage.getItem(todoStorageKey)).toBe('broken')
    todos.resetUnreadable()
    expect(todos.ready.value).toBe(true)
    expect(window.localStorage.getItem(todoStorageKey)).toBe('[]')
  })

  it('存储访问被禁止时显示错误，权限恢复后可重新读取', () => {
    const access = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('访问被禁止') })
    const todos = mountTodos()
    expect(todos.error.value).toContain('访问被禁止')
    todos.resetUnreadable()
    expect(todos.ready.value).toBe(false)
    expect(todos.error.value).toContain('保存待办失败')
    access.mockRestore()
    todos.load()
    expect(todos.ready.value).toBe(true)
    expect(todos.error.value).toBe('')
  })
})
