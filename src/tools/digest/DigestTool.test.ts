// @vitest-environment jsdom
import { createApp, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import DigestTool from './DigestTool.vue'
import type { DigestMessage } from './logic'

const workers = vi.hoisted(() => [] as {
  onmessage?: (event: { data: DigestMessage }) => void
  onerror?: () => void
  terminate: ReturnType<typeof vi.fn>
  postMessage: ReturnType<typeof vi.fn>
}[])
vi.mock('./worker?worker', () => ({ default: class {
  onmessage?: (event: { data: DigestMessage }) => void
  onerror?: () => void
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { workers.push(this) }
} }))
const cleanups: (() => void)[] = []

/** 挂载摘要页面；无参数，返回 DOM 容器，测试结束时清理组件和后台任务。 */
async function mountTool() {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(DigestTool)
  app.mount(host)
  cleanups.push(() => { app.unmount(); host.remove() })
  await nextTick()
  return host
}

/** 点击页面按钮；host 为容器、text 为完整按钮文字，无返回值，等待 Vue 更新。 */
async function click(host: Element, text: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === text)
  if (!button) throw new Error(`未找到按钮：${text}`)
  button.click()
  await nextTick()
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  workers.splice(0)
  vi.unstubAllGlobals()
})

it('空文本可计算；显示后台结果，修改输入取消任务，旧回调不能写入新结果', async () => {
  const host = await mountTool()
  await click(host, '计算摘要')
  const first = workers[0]!
  expect(first.postMessage.mock.calls[0]![0]).toEqual({ source: '', algorithms: ['md5', 'sha1', 'sha256', 'sha512'] })
  first.onmessage?.({ data: { type: 'progress', processed: 1, total: 2 } })
  await nextTick()
  expect(host.textContent).toContain('已处理 50%')
  first.onmessage?.({ data: { type: 'done', output: { results: [{ id: 'md5', hex: '00abff' }], bytes: 3 } } })
  await nextTick()
  expect(host.querySelector('.digest-result code')?.textContent).toBe('00abff')
  const input = host.querySelector<HTMLTextAreaElement>('textarea')!
  input.value = '新文本'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  expect(host.querySelector('.digest-result')).toBeNull()
  first.onmessage?.({ data: { type: 'done', output: { results: [{ id: 'md5', hex: 'abcdef' }], bytes: 3 } } })
  await nextTick()
  expect(host.querySelector('.digest-result')).toBeNull()
  expect(first.terminate).toHaveBeenCalled()
})

it('取消、错误和非法配置均有反馈，算法改变终止任务', async () => {
  const host = await mountTool()
  await click(host, '取消全选')
  await click(host, '计算摘要')
  expect(workers).toHaveLength(0)
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('至少选择')
  await click(host, '常用组合')
  await click(host, '计算摘要')
  await click(host, '取消计算')
  expect(workers[0]!.terminate).toHaveBeenCalled()
  expect(host.textContent).toContain('已取消计算')
  await click(host, '计算摘要')
  workers[1]!.onmessage?.({ data: { type: 'error', error: '读取文件失败' } })
  await nextTick()
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('读取文件失败')
  await click(host, '计算摘要')
  await click(host, '全选')
  expect(workers[2]!.terminate).toHaveBeenCalled()
  await click(host, '文件摘要')
  await click(host, '计算摘要')
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('先选择文件')
})

it('复制全部使用当前结果，剪贴板失败反馈，卸载释放任务', async () => {
  const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
  vi.stubGlobal('navigator', { clipboard })
  const host = await mountTool()
  await click(host, '计算摘要')
  workers[0]!.onmessage?.({ data: { type: 'done', output: { results: [{ id: 'md5', hex: '00abff' }], bytes: 3 } } })
  await nextTick()
  await click(host, '复制全部')
  await nextTick()
  expect(clipboard.writeText).toHaveBeenCalledWith('MD5: 00abff')
  expect(host.textContent).toContain('复制失败')
  await click(host, '计算摘要')
  cleanups.pop()!()
  expect(workers[1]!.terminate).toHaveBeenCalled()
})

it('选择文件后显示当前文件名并传递原始文件，切换模式会清空结果', async () => {
  const host = await mountTool()
  await click(host, '文件摘要')
  const file = new File(['abc'], 'example.txt', { type: 'text/plain' })
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  expect(host.querySelector('.file-name')?.textContent).toContain('example.txt · 3 字节')
  expect(host.textContent).toContain('重新选择文件')
  await click(host, '计算摘要')
  expect(workers[0]!.postMessage.mock.calls[0]![0].source).toBe(file)
  workers[0]!.onmessage?.({ data: { type: 'done', output: { results: [{ id: 'md5', hex: '00abff' }], bytes: 3 } } })
  await nextTick()
  await click(host, '文本摘要')
  expect(host.querySelector('.digest-result')).toBeNull()
})
