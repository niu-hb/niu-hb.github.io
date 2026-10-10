// @vitest-environment jsdom
import { webcrypto } from 'node:crypto'
import { createApp, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import CipherTool from './CipherTool.vue'
import type { CipherMessage } from './logic'

const workers = vi.hoisted(() => [] as { onmessage?: (event: { data: CipherMessage }) => void; onerror?: () => void; terminate: ReturnType<typeof vi.fn>; postMessage: ReturnType<typeof vi.fn> }[])
vi.mock('./worker?worker', () => ({ default: class {
  onmessage?: (event: { data: CipherMessage }) => void
  onerror?: () => void
  terminate = vi.fn()
  postMessage = vi.fn()
  constructor() { workers.push(this) }
} }))
const cleanups: (() => void)[] = []

/** 挂载页面并提供测试环境的标准密码学接口；无参数，返回容器，结束时释放组件及任务。 */
async function mountTool() {
  vi.stubGlobal('crypto', webcrypto)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(CipherTool)
  app.mount(host)
  cleanups.push(() => { app.unmount(); host.remove() })
  await nextTick()
  return host
}

/** 点击指定按钮；host 为页面容器、text 为完整名称，无返回值，等待 Vue 更新。 */
async function click(host: Element, text: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent?.trim() === text)
  if (!button) throw new Error(`未找到按钮：${text}`)
  button.click()
  await nextTick()
}

/** 修改明文输入；host 为容器、text 为内容，无返回值。 */
async function fillInput(host: Element, text: string) {
  const input = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="加解密输入"]')!
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  workers.splice(0)
  vi.unstubAllGlobals()
})

it('缺失密钥反馈错误，自动 IV 每次更新，旧回调不能覆盖新输入', async () => {
  const host = await mountTool()
  await click(host, '开始加密')
  expect(workers).toHaveLength(0)
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('AES 密钥')
  await click(host, '生成随机密钥')
  await fillInput(host, 'abc')
  await click(host, '开始加密')
  const first = workers[0]!
  const firstIv = first.postMessage.mock.calls[0]![0].input.ivHex
  expect(firstIv).toHaveLength(24)
  first.onmessage?.({ data: { type: 'result', output: { text: 'QUJD', inputBytes: 3, outputBytes: 3, operation: 'encrypt' } } })
  await nextTick()
  expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="加解密结果"]')?.value).toBe('QUJD')
  await fillInput(host, 'new')
  first.onmessage?.({ data: { type: 'result', output: { text: '旧结果', inputBytes: 3, outputBytes: 3, operation: 'encrypt' } } })
  await nextTick()
  expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="加解密结果"]')?.value).toBe('')
  await click(host, '开始加密')
  expect(workers[1]!.postMessage.mock.calls[0]![0].input.ivHex).not.toBe(firstIv)
  await click(host, '取消任务')
  expect(workers[1]!.terminate).toHaveBeenCalled()
  expect(host.textContent).toContain('已取消任务')
})

it('将密文用于解密保留原有参数，清空移除密钥、输入及结果', async () => {
  const host = await mountTool()
  await click(host, '生成随机密钥')
  await fillInput(host, 'abc')
  await click(host, '开始加密')
  const original = workers[0]!.postMessage.mock.calls[0]![0].input
  workers[0]!.onmessage?.({ data: { type: 'result', output: { text: 'AA==', inputBytes: 3, outputBytes: 1, operation: 'encrypt' } } })
  await nextTick()
  await click(host, '将结果作为解密输入')
  expect(host.querySelector<HTMLInputElement>('input[aria-label="IV 或计数块"]')?.value).toBe(original.ivHex)
  expect(host.querySelector<HTMLInputElement>('input[aria-label="AES 密钥"]')?.value).toBe(original.keyHex)
  expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="加解密输入"]')?.value).toBe('AA==')
  await click(host, '清空输入与密钥')
  expect(host.querySelector<HTMLInputElement>('input[aria-label="AES 密钥"]')?.value).toBe('')
  expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="加解密输入"]')?.value).toBe('')
  expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="加解密结果"]')?.value).toBe('')
})

it('后台错误、复制失败和卸载都有处理', async () => {
  const host = await mountTool()
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
  await click(host, '生成随机密钥')
  await click(host, '开始加密')
  workers[0]!.onmessage?.({ data: { type: 'error', error: '解密失败' } })
  await nextTick()
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('解密失败')
  await click(host, '开始加密')
  workers[1]!.onmessage?.({ data: { type: 'result', output: { text: 'QUJD', inputBytes: 3, outputBytes: 3, operation: 'encrypt' } } })
  await nextTick()
  await click(host, '复制结果')
  await nextTick()
  expect(host.textContent).toContain('复制失败')
  await click(host, '开始加密')
  cleanups.pop()!()
  expect(workers[2]!.terminate).toHaveBeenCalled()
})
