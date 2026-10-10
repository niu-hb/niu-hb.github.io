// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TodoTool from './TodoTool.vue'
import { todoStorageKey } from './logic'

const cleanups: (() => void)[] = []

/** 挂载真实待办页面；无参数，返回 DOM 容器，等待本地存档加载和视图更新。 */
async function mountTool() {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(TodoTool)
  app.mount(host)
  cleanups.push(() => { app.unmount(); host.remove() })
  await nextTick()
  return host
}

/** 点击具备指定文字的按钮；host 为作用域，text 为按钮文本，无返回值，等待视图更新。 */
async function clickButton(host: Element, text: string): Promise<void> {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim().endsWith(text))
  if (!button) throw new Error(`未找到按钮：${text}`)
  button.click()
  await nextTick()
}

/** 填写行内编辑草稿；host 为页面容器，text 为新内容，无返回值，触发输入并等待视图更新。 */
async function fillEditor(host: Element, text: string): Promise<void> {
  const input = host.querySelector<HTMLTextAreaElement>('.todo-editor textarea')
  if (!input) throw new Error('未找到编辑输入框')
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(todoStorageKey, JSON.stringify([{ id: 'history', content: '历史待办😀', status: 'in-progress' }]))
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.restoreAllMocks()
})

it('历史内容可以编辑，取消不保存，保存后安全显示 HTML 文本并保持状态', async () => {
  const host = await mountTool()
  await clickButton(host, '编辑')
  expect(host.querySelector<HTMLTextAreaElement>('.todo-editor textarea')?.value).toBe('历史待办😀')
  await fillEditor(host, '取消的草稿')
  await clickButton(host, '取消')
  expect(host.querySelector('.todo-content')?.textContent).toContain('历史待办😀')
  await clickButton(host, '编辑')
  await fillEditor(host, '<script>文本😀</script>')
  await clickButton(host, '保存修改')
  expect(host.querySelector('.todo-editor')).toBeNull()
  expect(host.querySelector('.todo-content')?.textContent).toContain('<script>文本😀</script>')
  expect(host.querySelector('.todo-content script')).toBeNull()
  expect(host.querySelector('.todo-item')?.classList.contains('status-in-progress')).toBe(true)
  expect(JSON.parse(window.localStorage.getItem(todoStorageKey)!)[0].content).toBe('<script>文本😀</script>')
})

it('编辑失败保留草稿，Esc 取消，状态按钮更新卡片与筛选结果', async () => {
  const host = await mountTool()
  await clickButton(host, '编辑')
  await fillEditor(host, '  ')
  await clickButton(host, '保存修改')
  expect(host.querySelector('.todo-editor')).not.toBeNull()
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('空白')
  await fillEditor(host, '新草稿')
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('空间不足') })
  await clickButton(host, '保存修改')
  expect(host.querySelector<HTMLTextAreaElement>('.todo-editor textarea')?.value).toBe('新草稿')
  expect(JSON.parse(window.localStorage.getItem(todoStorageKey)!)[0].content).toBe('历史待办😀')
  write.mockRestore()
  host.querySelector('.todo-editor textarea')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await nextTick()
  expect(host.querySelector('.todo-editor')).toBeNull()
  await clickButton(host.querySelector('.todo-status-switch')!, '已完成')
  expect(host.querySelector('.todo-item')?.classList.contains('status-done')).toBe(true)
  expect(host.querySelector('.switch-done')?.getAttribute('aria-pressed')).toBe('true')
  await clickButton(host.querySelector('[aria-label="按待办状态筛选"]')!, '待处理')
  expect(host.querySelector('.todo-item')).toBeNull()
  expect(host.textContent).toContain('当前状态下没有待办事项')
})
